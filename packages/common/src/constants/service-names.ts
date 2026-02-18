export const ServiceNames = {
    API_GATEWAY: 'api-gateway',
    ORDER_SERVICE: 'order-service',
    INVENTORY_SERVICE: 'inventory-service',
    PAYMENT_SERVICE: 'payment-service',
    AUTH_SERVICE: 'auth-service',
} as const;

export type ServiceName = (typeof ServiceNames)[keyof typeof ServiceNames];
