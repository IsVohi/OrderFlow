import { Injectable, OnModuleInit } from '@nestjs/common';
import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import {
    OrderCreatedEvent,
    OrderCancelledEvent,
    KAFKA_TOPIC_ORDERS,
    KAFKA_GROUP_INVENTORY_SERVICE,
} from '@orderflow/event-contracts';
import { AppLogger } from '@orderflow/logger';
import { InventoryService } from '../../../application/services/inventory.service';
import { Prisma } from '../../../generated/client';

/**
 * REFACTORED: Idempotent Order Event Consumer for Inventory Service
 * 
 * Features:
 * - Checks processed_events table before processing
 * - Atomic transaction: business logic + processed_events insert
 * - Double-check for race conditions
 * - Manual offset commits after successful processing
 */
@Injectable()
export class OrderEventConsumer implements OnModuleInit {
    private consumer: Consumer;

    constructor(
        private kafka: Kafka,
        private inventoryService: InventoryService,
        private prisma: PrismaService,
        private logger: AppLogger,
    ) {
        this.consumer = this.kafka.consumer({
            groupId: KAFKA_GROUP_INVENTORY_SERVICE,
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
            topic: KAFKA_TOPIC_ORDERS,
            fromBeginning: false,
        });

        await this.consumer.run({
            autoCommit: false, // Manual commits for idempotency
            eachMessage: async (payload: EachMessagePayload) => {
                await this.handleMessage(payload);
            },
        });

        this.logger.log('Inventory order event consumer connected (idempotent mode)');
    }

    private async handleMessage(payload: EachMessagePayload): Promise<void> {
        const { topic, partition, message } = payload;
        const offset = message.offset;

        try {
            const event = JSON.parse(message.value!.toString());
            const eventId = event.metadata?.eventId;
            const correlationId = event.metadata?.correlationId || 'unknown';

            if (!eventId) {
                this.logger.error('Order event missing event ID, using fallback', `topic=${topic}, partition=${partition}, offset=${offset}`);
                // Generate fallback event ID from offset
                const fallbackEventId = `${topic}-${partition}-${offset}`;
                await this.processWithEventId(event, fallbackEventId, partition, offset, correlationId);
                await this.commitOffset(topic, partition, offset);
                return;
            }

            // IDEMPOTENCY CHECK
            const alreadyProcessed = await this.prisma.processedEvent.findUnique({
                where: { eventId },
            });

            if (alreadyProcessed) {
                this.logger.debug('Order event already processed, skipping', {
                    eventId,
                    eventType: event.metadata?.eventType,
                    partition,
                    offset,
                    processedAt: alreadyProcessed.processedAt,
                });
                await this.commitOffset(topic, partition, offset);
                return;
            }

            // Process event
            await this.processWithEventId(event, eventId, partition, offset, correlationId);

            // Commit offset AFTER successful processing
            await this.commitOffset(topic, partition, offset);

        } catch (error) {
            this.logger.error('Failed to process order event', (error as Error).stack, {
                topic,
                partition,
                offset,
            });
            // DO NOT commit offset - Kafka will re-deliver
            throw error;
        }
    }

    private async processWithEventId(
        event: any,
        eventId: string,
        partition: number,
        offset: string,
        correlationId: string,
    ): Promise<void> {
        const eventType = event.metadata?.eventType || 'unknown';

        // ATOMIC TRANSACTION: Business logic + processed_events record
        await this.prisma.$transaction(async (tx) => {
            // Double-check for race conditions
            const doubleCheck = await tx.processedEvent.findUnique({
                where: { eventId },
            });

            if (doubleCheck) {
                this.logger.debug('Event already processed (race condition)', {
                    eventId,
                });
                return;
            }

            // Execute business logic with Transaction Client (tx)
            switch (eventType) {
                case 'order.created':
                    await this.handleOrderCreated(tx as Prisma.TransactionClient, event as OrderCreatedEvent, correlationId);
                    break;

                case 'order.cancelled':
                    await this.handleOrderCancelled(tx as Prisma.TransactionClient, event as OrderCancelledEvent, correlationId);
                    break;

                case 'order.fulfilled':
                    await this.handleOrderFulfilled(tx as Prisma.TransactionClient, event, correlationId);
                    break;

                default:
                    this.logger.warn('Unknown order event type', { eventType });
                    break;
            }

            // Mark as processed (IN SAME TRANSACTION)
            await tx.processedEvent.create({
                data: {
                    eventId,
                    eventType,
                    consumerGroup: KAFKA_GROUP_INVENTORY_SERVICE,
                    partition,
                    offset: BigInt(offset),
                    processedAt: new Date(),
                },
            });

            this.logger.log('Order event processed successfully', {
                eventId,
                eventType,
                partition,
                offset,
                correlationId,
            });
        });
    }

    private async handleOrderCreated(
        tx: Prisma.TransactionClient,
        event: OrderCreatedEvent,
        _correlationId: string,
    ): Promise<void> {
        try {
            // Reserve inventory for the order
            await this.inventoryService.reserveInventory({
                productId: event.payload.items[0].productId, // TODO: Handle multiple items
                quantity: event.payload.items[0].quantity,
                orderId: event.payload.orderId
            }, tx);

            this.logger.log(`Inventory reserved for order ${event.payload.orderId}`);
        } catch (error) {
            this.logger.error(`Failed to reserve inventory for order ${event.payload.orderId}. Stack: ${(error as Error).stack}`);
            // Let error propagate to trigger retry
            throw error;
        }
    }

    private async handleOrderCancelled(
        tx: Prisma.TransactionClient,
        event: OrderCancelledEvent,
        _correlationId: string,
    ): Promise<void> {
        try {
            // Release inventory when order is cancelled
            await this.inventoryService.releaseInventory({
                productId: 'unknown', // TODO: Need items in cancellation event or lookup
                quantity: 0,
                orderId: event.payload.orderId
            }, tx);

            this.logger.log(`Inventory released for cancelled order ${event.payload.orderId}`);
        } catch (error) {
            // If reservation doesn't exist, log warning but don't fail
            if ((error as Error).message?.includes('not found')) {
                this.logger.warn(`Reservation not found for cancelled order ${event.payload.orderId} (already released or never created)`);
                return; // Don't throw, allow transaction to complete
            }

            this.logger.error(`Failed to release inventory for cancelled order ${event.payload.orderId}. Stack: ${(error as Error).stack}`);
            throw error;
        }
    }

    private async handleOrderFulfilled(
        tx: Prisma.TransactionClient,
        event: any,
        _correlationId: string,
    ): Promise<void> {
        try {
            const items = event.payload.items || [];

            for (const item of items) {
                await this.inventoryService.commitInventory({
                    productId: item.productId,
                    quantity: item.quantity,
                    orderId: event.payload.orderId,
                }, tx);

                this.logger.log(
                    `Inventory committed for order ${event.payload.orderId}: ${item.productId} x${item.quantity}`
                );
            }
        } catch (error) {
            this.logger.error(
                `Failed to commit inventory for fulfilled order ${event.payload.orderId}. Stack: ${(error as Error).stack}`
            );
            throw error;
        }
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
