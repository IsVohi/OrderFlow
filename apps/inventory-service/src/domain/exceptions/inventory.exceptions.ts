import { BusinessException, TechnicalException } from '@orderflow/common';

export class InsufficientInventoryException extends BusinessException {
    constructor(productId: string, requested: number, available: number) {
        super(
            `Insufficient inventory for product ${productId}: requested ${requested}, available ${available}`,
            'INV_INSUFFICIENT',
            400,
            { productId, requested, available },
        );
    }
}

export class ProductNotFoundException extends BusinessException {
    constructor(productId: string) {
        super(
            `Product not found: ${productId}`,
            'INV_PRODUCT_NOT_FOUND',
            404,
            { productId },
        );
    }
}

export class ReservationNotFoundException extends BusinessException {
    constructor(orderId: string) {
        super(
            `Reservation not found for order: ${orderId}`,
            'INV_RESERVATION_NOT_FOUND',
            404,
            { orderId },
        );
    }
}

export class InvalidReservationStateException extends BusinessException {
    constructor(reservationId: string, currentState: string, expectedState: string) {
        super(
            `Reservation ${reservationId} is in ${currentState} state, expected ${expectedState}`,
            'INV_INVALID_STATE',
            409,
            { reservationId, currentState, expectedState },
        );
    }
}

export class ConcurrentModificationException extends TechnicalException {
    constructor(productId: string, retries: number) {
        super(
            `Concurrent modification detected for product ${productId} after ${retries} retries`,
            'SYS_CONCURRENT_MODIFICATION',
            409,
            { productId, retries },
        );
    }
}

export class ReservationExpiredException extends BusinessException {
    constructor(orderId: string) {
        super(
            `Reservation expired for order: ${orderId}`,
            'INV_RESERVATION_EXPIRED',
            410,
            { orderId },
        );
    }
}
