import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppLogger } from '@orderflow/logger';

export interface ChargeRequest {
    amount: number;
    currency: string;
    paymentMethod: {
        type: string;
        last4: string;
        brand: string;
    };
    idempotencyKey: string;
    metadata?: {
        orderId?: string;
    };
}

export interface ChargeResult {
    success: boolean;
    transactionId?: string;
    authCode?: string;
    fee?: number;
    failureReason?: string;
    failureCode?: string;
    retryable?: boolean;
}

export interface RefundRequest {
    transactionId: string;
    amount: number;
    idempotencyKey: string;
}

export interface RefundResult {
    success: boolean;
    transactionId?: string;
    amount?: number;
    error?: string;
}

@Injectable()
export class MockPaymentGateway {
    private idempotencyCache = new Map<string, ChargeResult>();
    private refundCache = new Map<string, RefundResult>();

    constructor(
        private config: ConfigService,
        private logger: AppLogger,
    ) { }

    async charge(request: ChargeRequest): Promise<ChargeResult> {
        // Simulate network latency
        const latencyMs = this.config.get<number>('payment.gateway.latencyMs') || 300;
        await this.sleep(latencyMs);

        // Check idempotency cache (simulates gateway-level deduplication)
        const cached = this.idempotencyCache.get(request.idempotencyKey);
        if (cached) {
            this.logger.debug('Returning cached payment result', {
                idempotencyKey: request.idempotencyKey,
            });
            return cached;
        }

        // Determine if should inject failure
        const shouldFail = this.shouldInjectFailure(request);

        let result: ChargeResult;

        if (shouldFail) {
            const failureType = this.config.get<string>('payment.gateway.failureType') || 'card_declined';
            result = {
                success: false,
                failureReason: this.getFailureReason(failureType),
                failureCode: failureType,
                retryable: failureType === 'network_error' || failureType === 'gateway_timeout',
            };

            this.logger.warn('Mock payment failed', {
                idempotencyKey: request.idempotencyKey,
                failureType,
                amount: request.amount,
            });
        } else {
            // Success path
            const transactionId = `txn_mock_${Date.now()}_${this.randomString(8)}`;
            const authCode = `AUTH_${this.randomString(6)}`;
            const fee = Number((request.amount * 0.029 + 0.30).toFixed(2)); // 2.9% + $0.30

            result = {
                success: true,
                transactionId,
                authCode,
                fee,
            };

            this.logger.log('Mock payment succeeded', {
                idempotencyKey: request.idempotencyKey,
                transactionId,
                amount: request.amount,
            });
        }

        // Cache result
        this.idempotencyCache.set(request.idempotencyKey, result);

        return result;
    }

    async refund(request: RefundRequest): Promise<RefundResult> {
        // Simulate network latency
        const latencyMs = this.config.get<number>('payment.gateway.latencyMs') || 300;
        await this.sleep(latencyMs);

        // Check idempotency cache
        const cached = this.refundCache.get(request.idempotencyKey);
        if (cached) {
            return cached;
        }

        // Mock always succeeds refunds for simplicity
        const result: RefundResult = {
            success: true,
            transactionId: `refund_mock_${Date.now()}_${this.randomString(8)}`,
            amount: request.amount,
        };

        this.logger.log('Mock refund succeeded', {
            originalTransactionId: request.transactionId,
            refundTransactionId: result.transactionId,
            amount: request.amount,
        });

        this.refundCache.set(request.idempotencyKey, result);

        return result;
    }

    private shouldInjectFailure(request: ChargeRequest): boolean {
        // Always fail for orders with specific prefix (deterministic testing)
        const failPrefix = this.config.get<string>('payment.gateway.alwaysFailForOrderPrefix');
        if (failPrefix && request.metadata?.orderId?.startsWith(failPrefix)) {
            return true;
        }

        // Random failure injection
        const failureRate = this.config.get<number>('payment.gateway.failureRate') || 0;
        return Math.random() < failureRate;
    }

    private getFailureReason(failureType: string): string {
        const reasons: Record<string, string> = {
            card_declined: 'Your card was declined',
            insufficient_funds: 'Insufficient funds in account',
            invalid_card: 'Invalid card number',
            expired_card: 'Card has expired',
            network_error: 'Network communication error',
            gateway_timeout: 'Gateway timeout',
        };
        return reasons[failureType] || 'Payment failed';
    }

    private randomString(length: number): string {
        const chars = 'ABCDEFGHIJK LMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
