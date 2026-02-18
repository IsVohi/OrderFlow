'use server';

import { Product } from '@/types';

const INVENTORY_SERVICE_URL = process.env.INVENTORY_SERVICE_URL;
const NEXT_PUBLIC_INVENTORY_API_URL = process.env.NEXT_PUBLIC_INVENTORY_API_URL || 'http://localhost:3002/api/v1/inventory';

// Prefer internal URL if available (server-side), otherwise public URL
const INVENTORY_API_URL = INVENTORY_SERVICE_URL ? `${INVENTORY_SERVICE_URL}/api/v1/inventory` : NEXT_PUBLIC_INVENTORY_API_URL;

export async function createProductAction(data: {
    sku: string;
    name: string;
    description?: string;
    price: number;
    quantity: number;
    sellerId: string;
}, token: string) { // Accept token as argument

    // Map dashboard form data to Backend DTO
    // DTO: id (optional?), name, description, price, imageUrl?, totalStock
    // The backend creates ID if not provided? Backend controller expects CreateProductDto
    /*
    export class CreateProductDto {
        @IsString() @IsNotEmpty() id: string; // Backend expects ID currently? Let's check service. 
        // Service says: productId: dto.id. So we must generate it or backend should.
        // Actually InventoryService.createProduct takes dto with id. 
        // Let's generate one here if needed.
    }
    */

    // Generate an ID if the backend requires strict ID (Service used dto.id)
    const productId = `prod_${Math.random().toString(36).substring(2, 8)}`;

    const payload = {
        id: productId, // Mapping SKU/Generated ID to DTO id
        name: data.name,
        description: data.description || '',
        price: data.price,
        totalStock: data.quantity,
    };

    try {
        const response = await fetch(INVENTORY_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Create product failed:', response.status, errorText);
            throw new Error(`Failed to create product: ${response.statusText}`);
        }

        const result = await response.json();
        return { success: true, productId: result.productId || productId };
    } catch (error) {
        console.error('Error in createProductAction:', error);
        throw error;
    }
}

export async function getInventoryAction(token: string) {
    try {
        const response = await fetch(INVENTORY_API_URL, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
            cache: 'no-store', // Ensure fresh data
        });

        if (!response.ok) {
            console.error('Get inventory failed:', response.status);
            return []; // Return empty on error to avoid crashing UI
        }

        const data = await response.json();

        // Transform backend data to frontend Product type if needed
        // Backend returns Inventory model: 
        // { productId, sellerId, name, description, price, quantityAvailable, quantityReserved, ... }
        // Frontend Product: 
        // { id, name, description, price, sellerId, totalStock, reservedStock, availableStock, ... }

        return data.map((item: any) => ({
            id: item.productId,
            name: item.name,
            description: item.description,
            price: Number(item.price),
            sellerId: item.sellerId,
            totalStock: item.quantityAvailable + item.quantityReserved, // Approximation
            reservedStock: item.quantityReserved,
            availableStock: item.quantityAvailable,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
        }));
    } catch (error) {
        console.error('Error in getInventoryAction:', error);
        return [];
    }
}

export async function listReservationsAction(token: string) {
    try {
        const response = await fetch(`${INVENTORY_API_URL}/reservations/list`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
            cache: 'no-store',
        });

        if (!response.ok) {
            console.error('List reservations failed:', response.status);
            return [];
        }

        const data = await response.json();
        return data.map((item: any) => ({
            id: item.id,
            orderId: item.orderId,
            productId: item.productId,
            sellerId: item.sellerId || 'unknown',
            quantity: item.quantity, // mapped from quantityReserved in backend
            status: item.status,
            createdAt: item.createdAt,
            expiresAt: item.expiresAt,
            releasedAt: item.releasedAt
        }));
    } catch (error) {
        console.error('Error in listReservationsAction:', error);
        return [];
    }
}
