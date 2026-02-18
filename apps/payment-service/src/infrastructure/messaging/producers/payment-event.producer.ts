import { Injectable, Inject } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { AppLogger } from '@orderflow/logger';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class PaymentEventProducer {
    constructor(
        @Inject('KAFKA_SERVICE') private readonly kafkaClient: ClientKafka,
        private readonly logger: AppLogger,
    ) { }

    async publishPaymentCaptured(payment: any, correlationId?: string) {
        this.logger.log('Publishing PaymentCaptured event', {
            paymentId: payment.id,
            orderId: payment.orderId
        });

        const event = {
            metadata: {
                eventId: payment.transactionId, // reuse for now
                eventType: 'payment.captured',
                timestamp: new Date().toISOString(),
                correlationId,
                source: 'payment-service',
            },
            payload: {
                paymentId: payment.id,
                orderId: payment.orderId,
                amount: payment.amount,
                currency: payment.currency,
                status: payment.status,
                method: payment.paymentMethodType,
                capturedAt: new Date().toISOString(),
            }
        };

        await lastValueFrom(this.kafkaClient.emit('payment.captured', event));
    }
}
