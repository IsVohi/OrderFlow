import { BusinessException, TechnicalException } from '@orderflow/common';

export class PaymentNotFoundException extends BusinessException {
    constructor(paymentId: string) {
        super(
            `Payment not found: ${paymentId}`,
            'PAY_NOT_FOUND',
            404,
            { paymentId },
        );
    }
}

export class InvalidPaymentStateException extends BusinessException {
    constructor(paymentId: string, currentState: string, expectedState: string) {
        super(
            `Payment ${paymentId} is in ${currentState} state, expected ${expectedState}`,
            'PAY_INVALID_STATE',
            409,
            { paymentId, currentState, expectedState },
        );
    }
}

export class PaymentDeclinedException extends BusinessException {
    constructor(orderId: string, reason: string) {
        super(
            `Payment declined: ${reason}`,
            'PAY_DECLINED',
            402,
            { orderId, reason },
        );
    }
}

export class InsufficientFundsException extends BusinessException {
    constructor(orderId: string) {
        super(
            `Payment failed: Insufficient funds`,
            'PAY_INSUFFICIENT_FUNDS',
            402,
            { orderId },
        );
    }
}

export class PaymentGatewayException extends TechnicalException {
    constructor(message: string, code?: string) {
        super(
            `Payment gateway error: ${message}`,
            code || 'PAY_GATEWAY_ERROR',
            502,
            { gatewayMessage: message },
        );
    }
}

export class RefundFailedException extends TechnicalException {
    constructor(paymentId: string, reason: string) {
        super(
            `Refund failed: ${reason}`,
            'PAY_REFUND_FAILED',
            500,
            { paymentId, reason },
        );
    }
}

export class PaymentAlreadyRefundedException extends BusinessException {
    constructor(paymentId: string) {
        super(
            `Payment already refunded: ${paymentId}`,
            'PAY_ALREADY_REFUNDED',
            409,
            { paymentId },
        );
    }
}
