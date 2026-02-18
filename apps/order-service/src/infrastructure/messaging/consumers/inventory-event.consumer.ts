import { Injectable, OnModuleInit } from '@nestjs/common';
import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { PrismaClient } from '../../persistence/client';
import {
    InventoryReservedEvent,
    InventoryReservationFailedEvent,
    KAFKA_TOPIC_INVENTORY,
    KAFKA_GROUP_ORDER_SERVICE,
} from '@orderflow/event-contracts';
import { AppLogger } from '@orderflow/logger';
import { OrderService } from '../../../application/services/order.service';

/**
 * I implement the Idempotent Inventory Event Consumer for the Order Service.
 */
@Injectable()
export class InventoryEventConsumer implements OnModuleInit {
    private consumer: Consumer;

    constructor(
        private kafka: Kafka,
        private orderService: OrderService,
        private prisma: PrismaClient,
        private logger: AppLogger,
    ) {
        this.consumer = this.kafka.consumer({
            groupId: KAFKA_GROUP_ORDER_SERVICE,
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
            autoCommit: false,
            eachMessage: async (payload: EachMessagePayload) => {
                await this.handleMessage(payload);
            },
        });

        this.logger.log('Order inventory event consumer connected (idempotent mode)');
    }

    private async handleMessage(payload: EachMessagePayload): Promise<void> {
        const { topic, partition, message } = payload;
        const offset = message.offset;

        try {
            const event = JSON.parse(message.value!.toString());
            const eventId = event.metadata?.eventId;
            const correlationId = event.metadata?.correlationId || 'unknown';

            if (!eventId) {
                this.logger.error('Inventory event missing event ID', JSON.stringify({
                    topic,
                    partition,
                    offset,
                }));
                await this.commitOffset(topic, partition, offset);
                return;
            }

            // I check if the event has already been processed to ensure idempotency.
            const alreadyProcessed = await this.prisma.processedEvent.findUnique({
                where: { eventId },
            });

            if (alreadyProcessed) {
                this.logger.debug('Inventory event already processed', {
                    eventId,
                    processedAt: alreadyProcessed.processedAt,
                });
                await this.commitOffset(topic, partition, offset);
                return;
            }

            // I process the event business logic.
            await this.processEvent(event, eventId, partition, offset, correlationId);

            // I commit the Kafka offset after successful processing.
            await this.commitOffset(topic, partition, offset);

        } catch (error) {
            this.logger.error('Failed to process inventory event', (error as Error).stack || String(error));
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

        await this.prisma.$transaction(async (tx) => {
            // I double-check for idempotency within the transaction.
            const doubleCheck = await tx.processedEvent.findUnique({
                where: { eventId },
            });

            if (doubleCheck) {
                return;
            }

            // I execute the business logic for the specific event type.
            switch (eventType) {
                case 'inventory.reserved':
                    await this.handleInventoryReserved(tx, event as InventoryReservedEvent, correlationId);
                    break;

                case 'inventory.reservation_failed':
                    await this.handleInventoryReservationFailed(
                        tx,
                        event as InventoryReservationFailedEvent,
                        correlationId,
                    );
                    break;

                default:
                    this.logger.warn('Unknown inventory event type', { eventType });
                    break;
            }

            // I mark the event as processed in the database.
            await tx.processedEvent.create({
                data: {
                    eventId,
                    eventType,
                    consumerGroup: KAFKA_GROUP_ORDER_SERVICE,
                    partition,
                    offset: BigInt(offset),
                },
            });

            this.logger.log('Inventory event processed: ' + JSON.stringify({
                eventId,
                eventType,
                correlationId,
            }));
        });
    }

    private async handleInventoryReserved(
        _tx: any,
        event: InventoryReservedEvent,
        correlationId: string,
    ): Promise<void> {
        await this.orderService.transitionToConfirmed(event.payload.orderId, correlationId);

        this.logger.log('Order confirmed after inventory reservation: ' + JSON.stringify({
            orderId: event.payload.orderId,
            reservationId: event.payload.reservationId,
            correlationId,
        }));
    }

    private async handleInventoryReservationFailed(
        _tx: any,
        event: InventoryReservationFailedEvent,
        correlationId: string,
    ): Promise<void> {
        const reason = (event.payload as any).reason || 'Unknown reason';
        await this.orderService.transitionToCancelled(
            event.payload.orderId,
            `Inventory reservation failed: ${reason}`,
            'system',
            correlationId,
        );

        this.logger.warn('Order cancelled due to inventory reservation failure', {
            orderId: event.payload.orderId,
            reason,
            correlationId,
        });
    }

    private async commitOffset(topic: string, partition: number, offset: string): Promise<void> {
        try {
            await this.consumer.commitOffsets([
                {
                    topic,
                    partition,
                    offset: (parseInt(offset) + 1).toString(),
                },
            ]);
        } catch (error) {
            this.logger.error('Failed to commit Kafka offset', (error as Error).stack || String(error));
            throw error;
        }
    }

    async onModuleDestroy() {
        await this.consumer.disconnect();
    }
}
