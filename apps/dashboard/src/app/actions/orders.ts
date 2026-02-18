'use server';

import { Order } from '@/types';

const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL;
const NEXT_PUBLIC_ORDER_API_URL = process.env.NEXT_PUBLIC_ORDER_API_URL || 'http://localhost:3001/api/v1/orders';

// Prefer internal URL if available (server-side), otherwise public URL
const ORDER_API_URL = ORDER_SERVICE_URL ? `${ORDER_SERVICE_URL}/api/v1/orders` : NEXT_PUBLIC_ORDER_API_URL;

export async function createOrderAction(formData: {
    productId: string;
    productName: string;
    productPrice: number;
    quantity: number;
    sellerId: string;
    customerId: string;
    address: {
        street: string;
        city: string;
        country: string;
        postalCode: string;
    }
}, token: string) {

    // Construct Backend DTO
    // DTO: { customerId, items: [{ productId, quantity, price }], shippingAddress: { ... } }
    const payload = {
        customerId: formData.customerId,
        items: [{
            productId: formData.productId,
            quantity: formData.quantity,
            price: formData.productPrice,
            sellerId: formData.sellerId
        }],
        shippingAddress: {
            street: formData.address.street,
            city: formData.address.city,
            state: 'N/A', // Defaulting as form doesn't have state yet
            zipCode: formData.address.postalCode,
            country: formData.address.country
        },
        currency: 'USD'
    };

    try {
        const response = await fetch(ORDER_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'x-idempotency-key': `idemp_${Date.now()}_${Math.random().toString(36).substring(2)}`
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Create order failed:', response.status, errorText);
            throw new Error(`Failed to create order: ${response.statusText}`);
        }

        const result = await response.json();
        // Result.data contains { orderId, ... }
        return { success: true, orderId: result.data.orderId };
    } catch (error) {
        console.error('Error in createOrderAction:', error);
        throw error;
    }
}

export async function getOrderAction(orderId: string, token: string): Promise<Order | null> {
    try {
        const response = await fetch(`${ORDER_API_URL}/${orderId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
            cache: 'no-store',
        });

        if (!response.ok) {
            if (response.status === 404 || response.status === 403) {
                return null;
            }
            console.error('Get order failed:', response.status);
            throw new Error(`Failed to get order: ${response.statusText}`);
        }

        const result = await response.json();
        const backendOrder = result.data;

        // Map backend flat fields to frontend nested structure
        const order: Order = {
            ...backendOrder,
            shippingAddress: {
                street: backendOrder.shippingStreet,
                city: backendOrder.shippingCity,
                state: backendOrder.shippingState,
                zipCode: backendOrder.shippingZipCode,
                country: backendOrder.shippingCountry,
            },
            events: backendOrder.events?.map((e: any) => ({
                id: String(e.id),
                type: e.eventType,
                timestamp: e.occurredAt,
                payload: e.eventData,
                service: 'order-service', // Default, or derive if available in metadata
            })) || [],
        };

        return order;
        return order;
    } catch (error) {
        console.error('Error in getOrderAction:', error);
        return null;
    }
}

export async function listOrdersAction(
    filters: {
        page?: number;
        limit?: number;
        status?: string;
        customerId?: string;
    },
    token: string
) {
    const queryParams = new URLSearchParams();
    if (filters.page) queryParams.append('offset', ((filters.page - 1) * (filters.limit || 10)).toString());
    if (filters.limit) queryParams.append('limit', filters.limit.toString());
    if (filters.status && filters.status !== 'ALL') queryParams.append('status', filters.status);
    if (filters.customerId) queryParams.append('customerId', filters.customerId);

    try {
        const response = await fetch(`${ORDER_API_URL}?${queryParams.toString()}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
            cache: 'no-store',
        });

        if (!response.ok) {
            console.error('List orders failed:', response.status);
            return { orders: [], total: 0, pages: 0 };
        }

        const result = await response.json();
        const orders = result.data.orders.map((backendOrder: any) => ({
            ...backendOrder,
            shippingAddress: {
                street: backendOrder.shippingStreet,
                city: backendOrder.shippingCity,
                state: backendOrder.shippingState,
                zipCode: backendOrder.shippingZipCode,
                country: backendOrder.shippingCountry,
            },
            events: [], // List view doesn't show events
        }));

        return {
            orders,
            total: result.data.pagination.total,
            pages: Math.ceil(result.data.pagination.total / (filters.limit || 10))
        };
    } catch (error) {
        console.error('Error in listOrdersAction:', error);
        return { orders: [], total: 0, pages: 0 };
    }
}

export async function updateOrderStatusAction(
    orderId: string,
    action: 'confirm' | 'pay' | 'fulfill' | 'cancel',
    token: string,
    payload?: any
) {
    const endpointMap = {
        confirm: `${ORDER_API_URL}/${orderId}/confirm`,
        pay: `${ORDER_API_URL}/${orderId}/pay`,
        fulfill: `${ORDER_API_URL}/${orderId}/fulfill`,
        cancel: `${ORDER_API_URL}/${orderId}`, // Delete method
    };

    const method = action === 'cancel' ? 'DELETE' : 'POST';
    const body = action === 'cancel' ? JSON.stringify(payload) : undefined;

    try {
        const response = await fetch(endpointMap[action], {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Order action ${action} failed:`, response.status, errorText);
            throw new Error(`Failed to ${action} order: ${response.statusText}`);
        }

        return { success: true };
    } catch (error) {
        console.error(`Error in updateOrderStatusAction (${action}):`, error);
        throw error;
    }
}
