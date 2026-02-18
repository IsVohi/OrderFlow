import { Injectable } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';
import { ConfigService } from '@nestjs/config';
import {
    InventoryReservedEvent,
    InventoryReservationFailedEvent,
    InventoryReleasedEvent,
    InventoryCommittedEvent,
    KAFKA_TOPIC_INVENTORY,
} from '@orderflow/event-contracts';
import { IdGenerator } from '@orderflow/common';
import { AppLogger } from '@orderflow/logger';

@Injectable()
export class InventoryEventProducer {
    private producer: Producer;

    constructor(
        private kafka: Kafka,
        private config: ConfigService,
        private logger: AppLogger,
    ) {
        this.producer = this.kafka.producer({
            idempotent: true,
            maxInFlightRequests: 5,
            transactionalId: `inventory-service-producer-${process.env.HOSTNAME || 'unknown'}`,
        });
    }

    async onModuleInit() {
        await this.producer.connect();
        this.logger.log('Inventory event producer connected to Kafka');
    }

    async onModuleDestroy() {
        await this.producer.disconnect();
    }

    async publishInventoryReserved(
        reservation: any,
        correlationId: string,
    ): Promise<void> {
        const event: InventoryReservedEvent = {
            metadata: {
                eventId: IdGenerator.generateEventId(),
                eventType: 'inventory.reserved',
                eventVersion: '1.0',
                timestamp: new Date().toISOString(),
                correlationId,
                causationId: null,
                source: {
                    service: 'inventory-service',
                    version: this.config.get('app.version') || '1.0.0',
                    instance: process.env.HOSTNAME || 'unknown',
                },
            },
            payload: {
                reservationId: reservation.id,
                orderId: reservation.orderId,
                items: reservation.items.map((item: any) => ({
                    productId: item.productId,
                    quantityRequested: item.quantityRequested,
                    quantityReserved: item.quantityReserved,
                    warehouseId: item.warehouseId,
                })),
                expiresAt: reservation.expiresAt.toISOString(),
                reservedAt: reservation.createdAt.toISOString(),
            },
        };

        await this.producer.send({
            topic: KAFKA_TOPIC_INVENTORY,
            messages: [
                {
                    key: reservation.orderId,
                    value: JSON.stringify(event),
                    headers: {
                        'x-correlation-id': correlationId,
                        'x-event-version': '1.0',
                    },
                },
            ],
        });

        this.logger.log('InventoryReserved event published', {
            reservationId: reservation.id,
            orderId: reservation.orderId,
            correlationId,
        });
    }

    async publishInventoryReservationFailed(
        orderId: string,
        failureReason: string,
        items: any[],
        correlationId: string,
    ): Promise<void> {
        const event: InventoryReservationFailedEvent = {
            metadata: {
                eventId: IdGenerator.generateEventId(),
                eventType: 'inventory.reservation_failed',
                eventVersion: '1.0',
                timestamp: new Date().toISOString(),
                correlationId,
                causationId: null,
                source: {
                    service: 'inventory-service',
                    version: this.config.get('app.version') || '1.0.0',
                    instance: process.env.HOSTNAME || 'unknown',
                },
            },
            payload: {
                orderId,
                failureReason,
                failureDetails: `Failed to reserve inventory: ${failureReason}`,
                items: items.map((item) => ({
                    productId: item.productId,
                    quantityRequested: item.quantity,
                    quantityAvailable: item.available || 0,
                    warehouseId: item.warehouseId || 'wh_default',
                })),
                failedAt: new Date().toISOString(),
            },
        };

        await this.producer.send({
            topic: KAFKA_TOPIC_INVENTORY,
            messages: [
                {
                    key: orderId,
                    value: JSON.stringify(event),
                },
            ],
        });

        this.logger.warn('InventoryReservationFailed event published', {
            orderId,
            failureReason,
            correlationId,
        });
    }

    async publishInventoryReleased(
        reservation: any,
        reason: string,
        correlationId: string,
    ): Promise<void> {
        const event: InventoryReleasedEvent = {
            metadata: {
                eventId: IdGenerator.generateEventId(),
                eventType: 'inventory.released',
                eventVersion: '1.0',
                timestamp: new Date().toISOString(),
                correlationId,
                causationId: null,
                source: {
                    service: 'inventory-service',
                    version: this.config.get('app.version') || '1.0.0',
                    instance: process.env.HOSTNAME || 'unknown',
                },
            },
            payload: {
                reservationId: reservation.id,
                orderId: reservation.orderId,
                reason,
                items: reservation.items.map((item: any) => ({
                    productId: item.productId,
                    quantityReleased: item.quantityReserved,
                    warehouseId: item.warehouseId,
                })),
                releasedAt: new Date().toISOString(),
            },
        };

        await this.producer.send({
            topic: KAFKA_TOPIC_INVENTORY,
            messages: [
                {
                    key: reservation.orderId,
                    value: JSON.stringify(event),
                },
            ],
        });

        this.logger.log('InventoryReleased event published', {
            reservationId: reservation.id,
            orderId: reservation.orderId,
            reason,
            correlationId,
        });
    }

    async publishInventoryCommitted(
        reservation: any,
        correlationId: string,
    ): Promise<void> {
        const event: InventoryCommittedEvent = {
            metadata: {
                eventId: IdGenerator.generateEventId(),
                eventType: 'inventory.committed',
                eventVersion: '1.0',
                timestamp: new Date().toISOString(),
                correlationId,
                causationId: null,
                source: {
                    service: 'inventory-service',
                    version: this.config.get('app.version') || '1.0.0',
                    instance: process.env.HOSTNAME || 'unknown',
                },
            },
            payload: {
                reservationId: reservation.id,
                orderId: reservation.orderId,
                items: reservation.items.map((item: any) => ({
                    productId: item.productId,
                    quantityCommitted: item.quantityReserved,
                    warehouseId: item.warehouseId,
                })),
                committedAt: new Date().toISOString(),
            },
        };

        await this.producer.send({
            topic: KAFKA_TOPIC_INVENTORY,
            messages: [
                {
                    key: reservation.orderId,
                    value: JSON.stringify(event),
                },
            ],
        });

        this.logger.log('InventoryCommitted event published', {
            reservationId: reservation.id,
            orderId: reservation.orderId,
            correlationId,
        });
    }
}
