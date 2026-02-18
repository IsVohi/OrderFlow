import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { Kafka } from 'kafkajs';
import configuration from './config/configuration';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { HttpModule } from '@nestjs/axios';
import { OrdersController } from './application/controllers/orders.controller';
import { PaymentEventConsumer } from './infrastructure/messaging/consumers/payment-event.consumer';
import { OrderService } from './application/services/order.service';
import { PrismaService } from './infrastructure/persistence/prisma/prisma.service';
import { OrderEventProducer } from './infrastructure/messaging/producers/order-event.producer';
import { OutboxPublisherJob } from './infrastructure/jobs/outbox-publisher.job';
import { AppLogger } from '@orderflow/logger';
import { ServiceNames } from '@orderflow/common';

import { HealthController } from './infrastructure/health/health.controller';

@Module({
    imports: [
        HttpModule,
        ScheduleModule.forRoot(),
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration],
        }),
        ClientsModule.registerAsync([
            {
                name: 'KAFKA_SERVICE',
                imports: [ConfigModule],
                useFactory: (configService: ConfigService) => ({
                    transport: Transport.KAFKA,
                    options: {
                        client: {
                            clientId: 'order-service',
                            brokers: (configService.get('KAFKA_BROKERS') || 'localhost:9092').split(','),
                        },
                        producer: {
                            allowAutoTopicCreation: true,
                        },
                    },
                }),
                inject: [ConfigService],
            },
        ]),
    ],
    controllers: [OrdersController, PaymentEventConsumer, HealthController],
    providers: [
        OrderService,
        PrismaService,
        OrderEventProducer,
        OutboxPublisherJob,
        {
            provide: Kafka,
            useFactory: (configService: ConfigService) => {
                return new Kafka({
                    clientId: 'order-service',
                    brokers: (configService.get('KAFKA_BROKERS') || 'localhost:9092').split(','),
                });
            },
            inject: [ConfigService],
        },
        {
            provide: AppLogger,
            useFactory: () => new AppLogger({ service: 'order-service' }),
        },
        {
            provide: 'SERVICE_NAME',
            useValue: ServiceNames.ORDER_SERVICE,
        },
    ],
})
export class AppModule { }
