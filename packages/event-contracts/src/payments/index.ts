import { BaseEvent, ExtendedEventMetadata } from '../base/base-event.interface';


export interface PaymentMethod {
    type: 'CREDIT_CARD' | 'DEBIT_CARD' | 'PAYPAL' | 'BANK_TRANSFER';
    last4?: string;
    brand?: string;
    expiryMonth?: string;
    expiryYear?: string;
}

export interface PaymentFees {
    processingFee: number;
    currency: string;
}

export interface PaymentSucceededPayload {
    paymentId: string;
    orderId: string;
    amount: number;
    currency: string;
    paymentMethod: PaymentMethod;
    gatewayProvider: string;
    transactionId: string;
    authorizationCode: string;
    capturedAt: string;
    fees?: PaymentFees;
}

export type PaymentSucceededEvent = BaseEvent<PaymentSucceededPayload> & {
    metadata: ExtendedEventMetadata;
};

export interface PaymentFailedPayload {
    paymentId: string;
    orderId: string;
    amount: number;
    currency: string;
    failureReason: string;
    failureCode: string;
    failureMessage: string;
    gatewayProvider: string;
    gatewayErrorCode: string;
    retryAllowed: boolean;
    retryAfter: string | null;
    attemptNumber: number;
    failedAt: string;
}

export type PaymentFailedEvent = BaseEvent<PaymentFailedPayload> & {
    metadata: ExtendedEventMetadata;
};

export interface PaymentRefundedPayload {
    paymentId: string;
    orderId: string;
    amount: number;
    currency: string;
    refundTransactionId: string;
    reason: string;
    refundedAt: string;
}

export type PaymentRefundedEvent = BaseEvent<PaymentRefundedPayload> & {
    metadata: ExtendedEventMetadata;
};
