import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaClient, ReservationStatus } from '../../generated/client';
import { AppLogger } from '@orderflow/logger';
import { InventoryEventProducer } from '../messaging/producers/inventory-event.producer';

@Injectable()
export class ReservationExpirationJob {
    constructor(
        private prisma: PrismaClient,
        private eventProducer: InventoryEventProducer,
        private logger: AppLogger,
    ) { }

    @Cron(CronExpression.EVERY_MINUTE)
    async cleanupExpiredReservations(): Promise<void> {
        const now = new Date();

        try {
            // Find expired reservations
            const expiredReservations = await this.prisma.reservation.findMany({
                where: {
                    status: ReservationStatus.RESERVED,
                    expiresAt: { lt: now },
                },
                include: { items: true },
                take: 100, // Process in batches
            });

            if (expiredReservations.length === 0) {
                return;
            }

            this.logger.log(
                `Found ${expiredReservations.length} expired reservations`,
            );

            for (const reservation of expiredReservations) {
                try {
                    await this.releaseExpiredReservation(reservation);
                } catch (error) {
                    this.logger.error(
                        'Failed to release expired reservation',
                        (error as Error).stack || String(error),
                    );
                }
            }
        } catch (error) {
            this.logger.error('Expiration job failed', (error as Error).stack || String(error));
        }
    }

    private async releaseExpiredReservation(reservation: any): Promise<void> {
        await this.prisma.$transaction(async (tx) => {
            // Release inventory back to available pool
            for (const item of reservation.items) {
                await tx.$executeRaw`
          UPDATE inventory
          SET
            quantity_available = quantity_available + ${item.quantityReserved},
            quantity_reserved = quantity_reserved - ${item.quantityReserved},
            version = version + 1,
            updated_at = NOW()
          WHERE product_id = ${item.productId}
        `;
            }

            // Mark as expired
            await tx.reservation.update({
                where: { id: reservation.id },
                data: { status: ReservationStatus.EXPIRED },
            });
        });

        // Publish expiration event
        await this.eventProducer.publishInventoryReleased(
            reservation,
            'Reservation expired - payment timeout',
            'system-cron',
        );

        this.logger.warn('Reservation expired and released', {
            reservationId: reservation.id,
            orderId: reservation.orderId,
            expiresAt: reservation.expiresAt,
        });
    }
}
