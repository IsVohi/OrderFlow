import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';
import { AppLogger } from '@orderflow/logger';
import { PaymentStatus } from '../../infrastructure/persistence/client';
import { randomUUID } from 'crypto';
import { PaymentEventProducer } from '../../infrastructure/messaging/producers/payment-event.producer';

@Injectable()
export class PaymentService {
    constructor(
        private prisma: PrismaService,
        private logger: AppLogger,
        private eventProducer: PaymentEventProducer,
    ) { }

    async processPayment(dto: { orderId: string; amount: number; currency: string; paymentMethod: any }) {
        this.logger.log('Processing payment', { orderId: dto.orderId, amount: dto.amount });

        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Mock Success
        const transactionId = `txn_${randomUUID()}`;

        const payment = await this.prisma.payment.create({
            data: {
                id: randomUUID(),
                orderId: dto.orderId,
                amount: dto.amount,
                currency: dto.currency,
                status: PaymentStatus.CAPTURED,
                gatewayProvider: 'mock_stripe',
                transactionId: transactionId,
                idempotencyKey: `pay_${dto.orderId}_${Date.now()}`, // simple for now
            }
        });

        await this.eventProducer.publishPaymentCaptured(payment);

        return payment;
    }

    async processRefund(data: { orderId: string; amount: number; reason: string }) {
        this.logger.log(`Processing refund for order ${data.orderId}: ${data.amount}`);
        // TODO: Implement refund logic
        return { status: 'REFUNDED' };
    }
}
