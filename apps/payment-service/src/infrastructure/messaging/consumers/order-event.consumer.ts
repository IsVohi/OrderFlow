import { Injectable, OnModuleInit } from '@nestjs/common';
import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import {
    OrderCancelledEvent,
    KAFKA_TOPIC_ORDERS,
    KAFKA_GROUP_PAYMENT_SERVICE,
} from '@orderflow/event-contracts';
import { AppLogger } from '@orderflow/logger';
import { PaymentService } from '../../../application/services/payment.service';
import { PrismaClient } from '../../persistence/client';

@Injectable()
export class OrderEventConsumer implements OnModuleInit {
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
        });
    }

    async onModuleInit() {
        await this.consumer.connect();
        await this.consumer.subscribe({
            topic: KAFKA_TOPIC_ORDERS,
            fromBeginning: false,
        });

        await this.consumer.run({
            eachMessage: this.handleMessage.bind(this),
        });

        this.logger.log('Order event consumer started');
    }

    async onModuleDestroy() {
        await this.consumer.disconnect();
    }

    private async handleMessage(payload: EachMessagePayload): Promise<void> {
        const { message } = payload;
        const event = JSON.parse(message.value!.toString());
        const { eventId, eventType, correlationId } = event.metadata;

        this.logger.setCorrelationId(correlationId);

        try {
            // Idempotency check
            const alreadyProcessed = await this.prisma.processedEvent.findUnique({
                where: { eventId },
            });

            if (alreadyProcessed) {
                this.logger.debug('Event already processed (idempotent)', { eventId });
                await this.consumer.commitOffsets([
                    {
                        topic: payload.topic,
                        partition: payload.partition,
                        offset: (parseInt(message.offset) + 1).toString(),
                    },
                ]);
                return;
            }

            switch (eventType) {
                case 'order.cancelled':
                    await this.handleOrderCancelled(event as OrderCancelledEvent, eventId);
                    break;
                default:
                    this.logger.debug('Unknown order event type', { eventType });
            }

            await this.consumer.commitOffsets([
                {
                    topic: payload.topic,
                    partition: payload.partition,
                    offset: (parseInt(message.offset) + 1).toString(),
                },
            ]);
        } catch (error) {
            this.logger.error('Failed to process order event', (error as Error).stack, {
                eventType,
                correlationId,
                eventId,
            });
            throw error;
        }
    }

    private async handleOrderCancelled(
        event: OrderCancelledEvent,
        eventId: string,
    ): Promise<void> {
        const { orderId, refundRequired, cancellationReason, refundAmount } = event.payload;
        // const { correlationId } = event.metadata; // Unused

        this.logger.log(`Processing order.cancelled event for order ${orderId} (Refund: ${refundRequired})`);

        if (!refundRequired) {
            this.logger.debug(`No refund required for cancelled order ${orderId}`);

            // Still mark as processed
            await this.prisma.processedEvent.create({
                data: {
                    eventId,
                    eventType: 'order.cancelled',
                },
            });
            return;
        }

        await this.prisma.$transaction(async (tx) => {
            // Process refund
            await this.paymentService.processRefund({
                orderId,
                reason: cancellationReason,
                amount: refundAmount || 0, // Should be passed in event if PAID
            });

            // Mark event as processed
            await tx.processedEvent.create({
                data: {
                    eventId,
                    eventType: 'order.cancelled',
                },
            });
        });
    }
}
