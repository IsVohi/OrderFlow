import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PaymentController } from './application/controllers/payment.controller';
import { PaymentService } from './application/services/payment.service';
import { PrismaService } from './infrastructure/persistence/prisma/prisma.service';
import { PaymentEventProducer } from './infrastructure/messaging/producers/payment-event.producer';
import { AppLogger } from '@orderflow/logger';
import { ServiceNames } from '@orderflow/common';

import { HealthController } from './infrastructure/health/health.controller';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        ClientsModule.registerAsync([
            {
                name: 'KAFKA_SERVICE',
                imports: [ConfigModule],
                useFactory: (configService: ConfigService) => ({
                    transport: Transport.KAFKA,
                    options: {
                        client: {
                            clientId: 'payment-service',
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
    controllers: [PaymentController, HealthController],
    providers: [
        PaymentService,
        PrismaService,
        PaymentEventProducer,
        {
            provide: AppLogger,
            useFactory: () => new AppLogger({ service: 'payment-service' }),
        },
        {
            provide: 'SERVICE_NAME',
            useValue: ServiceNames.PAYMENT_SERVICE,
        },
    ],
})
export class AppModule { }
