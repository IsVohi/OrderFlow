import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { OrderService } from '../../../application/services/order.service';
import { AppLogger } from '@orderflow/logger';

@Controller()
export class PaymentEventConsumer {
    constructor(
        private readonly orderService: OrderService,
        private readonly logger: AppLogger,
    ) { }

    @EventPattern('payment.captured')
    async handlePaymentCaptured(
        @Payload() message: any,
    ) {
        const payload = message.payload || message; // Handle CloudEvent or raw
        this.logger.log('Received payment.captured event', {
            orderId: payload.orderId,
            paymentId: payload.paymentId
        });

        // correlationId extraction if needed
        const correlationId = 'event-driven';
        const orderId = payload.orderId;
        const paymentStatus = payload.status; // Assuming payment status is in payload.status

        try {
            if (paymentStatus === 'COMPLETED' || paymentStatus === 'CAPTURED') {
                await this.orderService.transitionToPaid(orderId, correlationId);
                this.logger.log(`Order ${orderId} transitioned to PAID. CorrelationId: ${correlationId}`);
            } else if (paymentStatus === 'FAILED') {
                const failureReason = payload.status || 'Payment failed';
                await this.orderService.transitionToPaymentFailed(orderId, failureReason, correlationId);
                this.logger.warn(`Order ${orderId} payment failed: ${failureReason}. CorrelationId: ${correlationId}`);
            } else {
                this.logger.warn(`Received payment.captured event with unhandled status: ${paymentStatus}`, { correlationId, orderId, paymentStatus });
            }
        } catch (error: any) {
            this.logger.error('Failed to process payment.captured', error, {
                orderId: payload.orderId,
                correlationId,
                stack: error?.stack
            });
            // Should decide on retry strategy (DLQ or RetryableException)
        }
    }
}

