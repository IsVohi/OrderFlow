import { BusinessException } from '@orderflow/common';

export class OrderNotFoundException extends BusinessException {
    constructor(orderId: string) {
        super(
            `Order not found: ${orderId}`,
            'ORDER_NOT_FOUND',
            404,
            { orderId },
        );
    }
}

export class InvalidOrderStateException extends BusinessException {
    constructor(orderId: string, currentState: string, action: string) {
        super(
            `Cannot ${action} order in ${currentState} state`,
            'ORDER_INVALID_STATE',
            409,
            { orderId, currentState, action },
        );
    }
}

export class DuplicateOrderException extends BusinessException {
    constructor(idempotencyKey: string, existingOrderId: string) {
        super(
            'Order already exists with this idempotency key',
            'ORDER_DUPLICATE',
            400,
            { idempotencyKey, existingOrderId },
        );
    }
}
