import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../persistence/prisma/prisma.service';
import { Kafka, Producer } from 'kafkajs';
import { AppLogger } from '@orderflow/logger';
import { KAFKA_TOPIC_ORDERS } from '@orderflow/event-contracts';

@Injectable()
export class OutboxPublisherJob {
    private producer: Producer;

    constructor(
        private prisma: PrismaService,
        private kafka: Kafka,
        private logger: AppLogger,
    ) {
        this.producer = this.kafka.producer({
            idempotent: true,
            maxInFlightRequests: 5,
            transactionalId: `order-service-outbox-${process.env.HOSTNAME || 'unknown'}`,
        });
    }

    async onModuleInit() {
        await this.producer.connect();
        this.logger.log('Order outbox publisher producer connected');
    }

    async onModuleDestroy() {
        await this.producer.disconnect();
    }

    @Cron(CronExpression.EVERY_5_SECONDS)
    async publishOutboxEvents(): Promise<void> {
        try {
            // Fetch unpublished events (batched) with row-level locking
            const unpublishedEvents = await this.prisma.$queryRaw<any[]>`
        SELECT * FROM outbox
        WHERE published = FALSE
        ORDER BY created_at ASC
        LIMIT 100
        FOR UPDATE SKIP LOCKED
      `;

            if (unpublishedEvents.length === 0) {
                return;
            }

            this.logger.debug(`Publishing ${unpublishedEvents.length} order outbox events`);

            for (const event of unpublishedEvents) {
                try {
                    // Extract correlation ID from payload
                    const payload = event.payload;
                    const correlationId = payload.metadata?.correlationId || 'unknown';

                    // Publish to Kafka
                    await this.producer.send({
                        topic: KAFKA_TOPIC_ORDERS,
                        messages: [
                            {
                                key: event.aggregate_id,
                                value: JSON.stringify(payload),
                                headers: {
                                    'x-correlation-id': correlationId,
                                    'x-event-version': payload.metadata?.eventVersion || '1.0',
                                },
                            },
                        ],
                    });

                    // Mark as published
                    await this.prisma.outbox.update({
                        where: { id: event.id },
                        data: {
                            published: true,
                            publishedAt: new Date(),
                        },
                    });

                    this.logger.debug('Order outbox event published', {
                        eventId: event.event_id,
                        eventType: event.event_type,
                        aggregateId: event.aggregate_id,
                    });
                } catch (error) {
                    this.logger.error('Failed to publish order outbox event', (error as Error).stack || String(error));
                    // Will retry on next poll
                }
            }

            this.logger.log(`Successfully published ${unpublishedEvents.length} order outbox events`);
        } catch (error) {
            this.logger.error('Order outbox publisher job failed', (error as Error).stack || String(error));
        }
    }

    // Cleanup old published events (run daily)
    @Cron(CronExpression.EVERY_DAY_AT_2AM)
    async cleanupOldOutboxEvents(): Promise<void> {
        try {
            const retentionDays = 7;
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

            const result = await this.prisma.outbox.deleteMany({
                where: {
                    published: true,
                    publishedAt: {
                        lt: cutoffDate,
                    },
                },
            });

            this.logger.log(`Cleaned up ${result.count} old order outbox events`);
        } catch (error) {
            this.logger.error('Order outbox cleanup job failed', (error as Error).stack || String(error));
        }
    }

    // Cleanup old processed events (run daily)
    @Cron(CronExpression.EVERY_DAY_AT_3AM)
    async cleanupOldProcessedEvents(): Promise<void> {
        try {
            const retentionDays = 7;
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

            const result = await this.prisma.processedEvent.deleteMany({
                where: {
                    processedAt: {
                        lt: cutoffDate,
                    },
                },
            });

            this.logger.log(`Cleaned up ${result.count} old processed events`);
        } catch (error) {
            this.logger.error('Processed events cleanup job failed', (error as Error).stack || String(error));
        }
    }
}
