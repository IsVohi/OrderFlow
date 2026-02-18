import { Module } from '@nestjs/common';
import { InventoryController } from './application/controllers/inventory.controller';
import { InventoryService } from './application/services/inventory.service';
import { PrismaService } from './infrastructure/persistence/prisma/prisma.service';
import { ConfigModule } from '@nestjs/config';
import { AppLogger } from '@orderflow/logger';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { OrderEventConsumer } from './infrastructure/messaging/consumers/order-event.consumer';
import { InventoryEventProducer } from './infrastructure/messaging/producers/inventory-event.producer';
import { Kafka } from 'kafkajs';

import { HealthController } from './infrastructure/health/health.controller';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        ClientsModule.registerAsync([
            {
                name: 'KAFKA_SERVICE',
                imports: [ConfigModule],
                useFactory: () => ({
                    transport: Transport.KAFKA,
                    options: {
                        client: {
                            clientId: 'inventory-service',
                            brokers: process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(',') : ['localhost:9092'],
                        },
                        producer: {
                            allowAutoTopicCreation: true,
                        },
                    },
                }),
            },
        ]),
    ],
    controllers: [InventoryController, HealthController],
    providers: [
        InventoryService,
        PrismaService,
        InventoryEventProducer,
        OrderEventConsumer,
        {
            provide: Kafka,
            useFactory: () => {
                return new Kafka({
                    clientId: 'inventory-service',
                    brokers: process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(',') : ['localhost:9092'],
                });
            },
        },
        {
            provide: AppLogger,
            useFactory: () => new AppLogger({ service: 'inventory-service' }),
        },
    ],
})
export class AppModule { }
