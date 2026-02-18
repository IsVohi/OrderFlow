// Order Status and Related Types

export type OrderStatus =
    | 'PENDING'
    | 'CONFIRMED'
    | 'PAYMENT_PENDING'
    | 'PAID'
    | 'FULFILLED'
    | 'CANCELLED'
    | 'FAILED';

export type PaymentStatus =
    | 'PENDING'
    | 'PROCESSING'
    | 'CAPTURED'
    | 'FAILED'
    | 'REFUNDED';

export type InventoryStatus =
    | 'PENDING'
    | 'RESERVED'
    | 'COMMITTED'
    | 'RELEASED'
    | 'FAILED';

export type ServiceStatus = 'healthy' | 'degraded' | 'down';

export interface OrderItem {
    productId: string;
    productName: string;
    sellerId: string;
    quantity: number;
    price: number;
}

export interface Product {
    id: string;
    name: string;
    description?: string;
    price: number;
    sellerId: string;
    totalStock: number;
    availableStock: number;
    reservedStock: number;
    createdAt: string;
    updatedAt: string;
}

export interface InventoryReservation {
    id: string;
    productId: string;
    sellerId: string;
    orderId: string;
    quantity: number;
    status: 'RESERVED' | 'COMMITTED' | 'RELEASED' | 'EXPIRED';
    createdAt: string;
    expiresAt?: string;
    releasedAt?: string;
}

export interface Order {
    id: string;
    correlationId: string;
    customerId: string;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    inventoryStatus: InventoryStatus;
    items: OrderItem[];
    totalAmount: number;
    shippingAddress: {
        street: string;
        city: string;
        state: string;
        zipCode: string;
        country: string;
    };
    createdAt: string;
    updatedAt: string;
    events: OrderEvent[];
    failureReason?: string;
}

export interface OrderEvent {
    id: string;
    type: string;
    timestamp: string;
    payload: Record<string, unknown>;
    service: string;
}

export interface SystemMetrics {
    ordersProcessed: number;
    successfulOrders: number;
    failedOrders: number;
    activeSagas: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
    errorRate: number;
    retryCount: number;
}

export interface ServiceHealth {
    name: string;
    status: ServiceStatus;
    uptime: number;
    lastCheck: string;
}

export interface KafkaMetrics {
    consumerLag: number;
    messagesPerSecond: number;
    partitions: number;
    topics: number;
}

export interface TimeSeriesPoint {
    timestamp: string;
    value: number;
}

export interface LogEntry {
    id: string;
    timestamp: string;
    level: 'info' | 'warn' | 'error' | 'debug';
    service: string;
    message: string;
    correlationId?: string;
    orderId?: string;
    metadata?: Record<string, unknown>;
}

export interface ChaosConfig {
    failNextPayment: boolean;
    paymentFailureType: 'card_declined' | 'insufficient_funds' | 'network_error';
    delayInventoryMs: number;
    enableDatabaseTimeout: boolean;
    crashProbability: number;
}
