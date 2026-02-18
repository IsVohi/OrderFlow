import { BaseEvent, ExtendedEventMetadata } from '../base/base-event.interface';


export interface ReservationItem {
    productId: string;
    quantityRequested: number;
    quantityReserved: number;
    warehouseId: string;
}

export interface InventoryReservedPayload {
    reservationId: string;
    orderId: string;
    items: ReservationItem[];
    expiresAt: string;
    reservedAt: string;
}

export type InventoryReservedEvent = BaseEvent<InventoryReservedPayload> & {
    metadata: ExtendedEventMetadata;
};

export interface InventoryFailureItem {
    productId: string;
    quantityRequested: number;
    quantityAvailable: number;
    warehouseId: string;
}

export interface InventoryReservationFailedPayload {
    orderId: string;
    failureReason: string;
    failureDetails: string;
    items: InventoryFailureItem[];
    failedAt: string;
}

export type InventoryReservationFailedEvent = BaseEvent<InventoryReservationFailedPayload> & {
    metadata: ExtendedEventMetadata;
};

export interface InventoryReleasedItem {
    productId: string;
    quantityReleased: number;
    warehouseId: string;
}

export interface InventoryReleasedPayload {
    reservationId: string;
    orderId: string;
    reason: string;
    items: InventoryReleasedItem[];
    releasedAt: string;
}

export type InventoryReleasedEvent = BaseEvent<InventoryReleasedPayload> & {
    metadata: ExtendedEventMetadata;
};

export interface InventoryCommittedItem {
    productId: string;
    quantityCommitted: number;
    warehouseId: string;
}

export interface InventoryCommittedPayload {
    reservationId: string;
    orderId: string;
    items: InventoryCommittedItem[];
    committedAt: string;
}

export type InventoryCommittedEvent = BaseEvent<InventoryCommittedPayload> & {
    metadata: ExtendedEventMetadata;
};
