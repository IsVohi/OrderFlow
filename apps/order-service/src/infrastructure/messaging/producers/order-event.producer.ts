import { Injectable } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';
import { ConfigService } from '@nestjs/config';
import { Order } from '../../persistence/client';
import {
    OrderCreatedEvent,
    OrderCancelledEvent,
    KAFKA_TOPIC_ORDERS,
} from '@orderflow/event-contracts';
import { IdGenerator } from '@orderflow/common';
import { AppLogger } from '@orderflow/logger';

@Injectable()
export class OrderEventProducer {
    private producer: Producer;

    constructor(
        private kafka: Kafka,
        private config: ConfigService,
        private logger: AppLogger,
    ) {
        // I use the KafkaJS producer directly here for fine-grained transactional control.
        this.producer = this.kafka.producer({
            idempotent: true,
            maxInFlightRequests: 5,
            transactionalId: `order - service - producer - ${process.env.HOSTNAME || 'unknown'} `,
        });
    }

    async onModuleInit() {
        const retries = 5;
        const delay = 3000;
        for (let i = 0; i < retries; i++) {
            try {
                await this.producer.connect();
                this.logger.log('Order event producer connected to Kafka');
                return;
            } catch (error) {
                this.logger.warn(`Failed to connect to Kafka (attempt ${i + 1}/${retries}). Retrying in ${delay}ms...`, { error });
                if (i === retries - 1) throw error;
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
    }

    async onModuleDestroy() {
        await this.producer.disconnect();
    }

    async publishOrderCreated(
        order: Order & { items: any[] },
        correlationId: string,
    ): Promise<void> {
        const event: OrderCreatedEvent = {
            metadata: {
                eventId: IdGenerator.generateEventId(),
                eventType: 'order.created',
                eventVersion: '1.0',
                timestamp: new Date().toISOString(),
                correlationId,
                causationId: null,
                source: {
                    service: 'order-service',
                    version: this.config.get('app.version') || '1.0.0',
                    instance: process.env.HOSTNAME || 'unknown',
                },
            },
            payload: {
                orderId: order.id,
                customerId: order.customerId,
                items: order.items.map((item: any) => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    price: parseFloat(item.price.toString()),
                    currency: order.currency,
                })),
                totalAmount: parseFloat(order.totalAmount.toString()),
                currency: order.currency,
                shippingAddress: {
                    street: order.shippingStreet!,
                    city: order.shippingCity!,
                    state: order.shippingState!,
                    zipCode: order.shippingZipCode!,
                    country: order.shippingCountry!,
                },
                idempotencyKey: order.idempotencyKey,
                createdAt: order.createdAt.toISOString(),
            },
        };

        await this.producer.send({
            topic: KAFKA_TOPIC_ORDERS,
            messages: [
                {
                    key: order.id,
                    value: JSON.stringify(event),
                    headers: {
                        'x-correlation-id': correlationId,
                        'x-event-version': '1.0',
                    },
                },
            ],
        });

        this.logger.log('OrderCreated event published', {
            correlationId,
            orderId: order.id,
            eventId: event.metadata.eventId,
        });
    }

    async publishOrderCancelled(
        order: Order,
        reason: string,
        cancelledBy: 'user' | 'system',
        correlationId: string,
        previousStatus: string,
    ): Promise<void> {
        const event: OrderCancelledEvent = {
            metadata: {
                eventId: IdGenerator.generateEventId(),
                eventType: 'order.cancelled',
                eventVersion: '1.0',
                timestamp: new Date().toISOString(),
                correlationId,
                causationId: null,
                source: {
                    service: 'order-service',
                    version: this.config.get('app.version') || '1.0.0',
                    instance: process.env.HOSTNAME || 'unknown',
                },
            },
            payload: {
                orderId: order.id,
                customerId: order.customerId,
                cancellationReason: reason,
                cancelledBy,
                previousStatus,
                refundRequired: previousStatus === 'PAID',
                refundAmount:
                    previousStatus === 'PAID'
                        ? parseFloat(order.totalAmount.toString())
                        : null,
                cancelledAt: new Date().toISOString(),
            },
        };

        await this.producer.send({
            topic: KAFKA_TOPIC_ORDERS,
            messages: [
                {
                    key: order.id,
                    value: JSON.stringify(event),
                },
            ],
        });

        this.logger.log('OrderCancelled event published', {
            correlationId,
            orderId: order.id,
            reason,
        });
    }
}
