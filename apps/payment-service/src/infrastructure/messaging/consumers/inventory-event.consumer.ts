import { Injectable, OnModuleInit } from '@nestjs/common';
import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { PrismaClient } from '../../persistence/client';
import {
    InventoryReservedEvent,
    InventoryReservationFailedEvent,
    InventoryReleasedEvent,
    KAFKA_TOPIC_INVENTORY,
    KAFKA_GROUP_PAYMENT_SERVICE,
} from '@orderflow/event-contracts';
import { AppLogger } from '@orderflow/logger';
import { PaymentService } from '../../../application/services/payment.service';

/**
 * REFACTORED: Idempotent Inventory Event Consumer for Payment Service
 * 
 * Features:
 * - Checks processed_events table before processing
 * - Atomic transaction: business logic + processed_events insert
 * - Double-check for race conditions
 * - Manual offset commits after successful processing
 */
@Injectable()
export class InventoryEventConsumer implements OnModuleInit {
    private consumer: Consumer;

    constructor(
        private kafka: Kafka,
        private paymentService: PaymentService,
        private prisma: PrismaClient,
        private logger: AppLogger,
    ) {
        this.consumer = this.kafka.consumer({
            groupId: KAFKA_GROUP_PAYMENT_SERVICE,
            sessionTimeout: 30000,
            heartbeatInterval: 3000,
            retry: {
                retries: 5,
                initialRetryTime: 300,
                maxRetryTime: 30000,
            },
        });
    }

    async onModuleInit() {
        await this.consumer.connect();
        await this.consumer.subscribe({
            topic: KAFKA_TOPIC_INVENTORY,
            fromBeginning: false,
        });

        await this.consumer.run({
            autoCommit: false, // Manual offset commits for precise control
            eachMessage: async (payload: EachMessagePayload) => {
                await this.handleMessage(payload);
            },
        });

        this.logger.log('Payment inventory event consumer connected (idempotent mode)');
    }

    private async handleMessage(payload: EachMessagePayload): Promise<void> {
        const { topic, partition, message } = payload;
        const offset = message.offset;

        try {
            const event = JSON.parse(message.value!.toString());
            const eventId = event.metadata?.eventId;
            const correlationId = event.metadata?.correlationId || 'unknown';

            if (!eventId) {
                this.logger.error('Inventory event missing event ID', `topic=${topic}, partition=${partition}, offset=${offset}`);
                // Commit offset to skip malformed events
                await this.commitOffset(topic, partition, offset);
                return;
            }

            // IDEMPOTENCY CHECK: Has this event been processed before?
            const alreadyProcessed = await this.prisma.processedEvent.findUnique({
                where: { eventId },
            });

            if (alreadyProcessed) {
                this.logger.debug('Inventory event already processed, skipping', {
                    eventId,
                    eventType: event.metadata?.eventType,
                    partition,
                    offset,
                    processedAt: alreadyProcessed.processedAt,
                });
                // Still commit offset even though we skipped processing
                await this.commitOffset(topic, partition, offset);
                return;
            }

            // Process event with idempotency guarantee
            await this.processEvent(event, eventId, partition, offset, correlationId);

            // Commit offset AFTER successful processing
            await this.commitOffset(topic, partition, offset);

        } catch (error) {
            this.logger.error('Failed to process inventory event', (error as Error).stack, {
                topic,
                partition,
                offset,
            });
            // DO NOT commit offset - Kafka will re-deliver
            throw error;
        }
    }

    private async processEvent(
        event: any,
        eventId: string,
        partition: number,
        offset: string,
        correlationId: string,
    ): Promise<void> {
        const eventType = event.metadata.eventType;

        // ATOMIC TRANSACTION: Business logic + processed_events record
        await this.prisma.$transaction(async (tx) => {
            // Double-check for race conditions (two consumers processing same event)
            const doubleCheck = await tx.processedEvent.findUnique({
                where: { eventId },
            });

            if (doubleCheck) {
                this.logger.debug('Event already processed (race condition detected)', {
                    eventId,
                    eventType,
                });
                return; // Exit transaction without error
            }

            // Execute business logic based on event type
            switch (eventType) {
                case 'inventory.reserved':
                    await this.handleInventoryReserved(
                        tx,
                        event as InventoryReservedEvent,
                        correlationId,
                    );
                    break;

                case 'inventory.reservation_failed':
                    await this.handleInventoryReservationFailed(
                        tx,
                        event as InventoryReservationFailedEvent,
                        correlationId,
                    );
                    break;

                case 'inventory.released':
                    await this.handleInventoryReleased(
                        tx,
                        event as InventoryReleasedEvent,
                        correlationId,
                    );
                    break;

                default:
                    this.logger.warn('Unknown inventory event type', { eventType });
                    break;
            }

            // Mark event as processed (IN SAME TRANSACTION)
            await tx.processedEvent.create({
                data: {
                    eventId,
                    eventType,
                },
            });

            this.logger.log('Inventory event processed successfully', {
                eventId,
                eventType,
                partition,
                offset,
                correlationId,
            });
        });
    }

    private async handleInventoryReserved(
        _tx: any,
        event: InventoryReservedEvent,
        correlationId: string,
    ): Promise<void> {
        try {
            // Trigger payment processing
            await this.paymentService.processPayment(
                {
                    orderId: event.payload.orderId,
                    amount: 0, // Amount will be fetched/updated
                    currency: 'USD',
                    paymentMethod: 'credit_card',
                }
            );
        } catch (error) {
            this.logger.error(`Failed to process payment for reserved inventory. OrderId: ${event.payload.orderId}, ReservationId: ${event.payload.reservationId}, CorrectionId: ${correlationId}. Stack: ${(error as Error).stack}`);
            throw error;
        }
    }

    private async handleInventoryReservationFailed(
        _tx: any,
        event: InventoryReservationFailedEvent,
        correlationId: string,
    ): Promise<void> {
        this.logger.warn('Inventory reservation failed, no payment needed', {
            orderId: event.payload.orderId,
            reason: (event.payload as any).reason || 'Unknown reason',
            correlationId,
        });
        // No action needed - order will be cancelled by order service
    }

    private async handleInventoryReleased(
        _tx: any,
        event: InventoryReleasedEvent,
        _correlationId: string,
    ): Promise<void> {
        this.logger.log(`Inventory released event received for order ${event.payload.orderId}. Reason: ${event.payload.reason}`);
        // No action needed in payment service
    }

    private async commitOffset(topic: string, partition: number, offset: string): Promise<void> {
        try {
            await this.consumer.commitOffsets([
                {
                    topic,
                    partition,
                    offset: (parseInt(offset) + 1).toString(), // Kafka expects next offset
                },
            ]);

            this.logger.debug('Kafka offset committed', {
                topic,
                partition,
                offset,
            });
        } catch (error) {
            this.logger.error('Failed to commit Kafka offset', (error as Error).stack, {
                topic,
                partition,
                offset,
            });
            throw error;
        }
    }

    async onModuleDestroy() {
        await this.consumer.disconnect();
    }
}
