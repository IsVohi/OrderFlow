import { BaseEvent, ExtendedEventMetadata } from '../base/base-event.interface';


export interface ShippingAddress {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
}

export interface OrderItem {
    productId: string;
    quantity: number;
    price: number;
    currency: string;
}

export interface OrderCreatedPayload {
    orderId: string;
    customerId: string;
    items: OrderItem[];
    totalAmount: number;
    currency: string;
    shippingAddress: ShippingAddress;
    idempotencyKey: string;
    createdAt: string;
}

export type OrderCreatedEvent = BaseEvent<OrderCreatedPayload> & {
    metadata: ExtendedEventMetadata;
};

export interface OrderCompletedPayload {
    orderId: string;
    customerId: string;
    totalAmount: number;
    currency: string;
    itemCount: number;
    status: string;
    completedAt: string;
    durationMs: number;
    timeline: {
        orderCreated: string;
        inventoryReserved: string;
        paymentSucceeded: string;
        inventoryCommitted: string;
        orderCompleted: string;
    };
}

export type OrderCompletedEvent = BaseEvent<OrderCompletedPayload> & {
    metadata: ExtendedEventMetadata;
};

export interface OrderCancelledPayload {
    orderId: string;
    customerId: string;
    cancellationReason: string;
    cancelledBy: 'user' | 'system';
    previousStatus: string;
    refundRequired: boolean;
    refundAmount: number | null;
    cancelledAt: string;
}

export type OrderCancelledEvent = BaseEvent<OrderCancelledPayload> & {
    metadata: ExtendedEventMetadata;
};
