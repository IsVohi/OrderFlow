import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { AppLogger } from '@orderflow/logger';
import { ServiceNames } from '@orderflow/common';

async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        bufferLogs: true,
    });

    // I initialize structured logging here.
    const logger = new AppLogger({ service: ServiceNames.ORDER_SERVICE });
    app.useLogger(logger);

    // I use a global validation pipe with whitelisting to prevent mass assignment.
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    );

    // I restrict CORS to the dashboard to prevent unauthorized access.
    app.enableCors({
        origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
        credentials: true,
    });

    const port = process.env.PORT || 3001;

    app.connectMicroservice({
        transport: Transport.KAFKA,
        options: {
            client: {
                brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
            },
            consumer: {
                groupId: 'order-service-consumer',
            },
        },
    });

    await app.startAllMicroservices();
    await app.listen(port);

    logger.log(`Order Service running on port ${port}`, {
        environment: process.env.NODE_ENV,
    });
}

bootstrap();
