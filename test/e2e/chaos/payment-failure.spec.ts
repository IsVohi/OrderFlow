import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { ChaosTestHelpers } from '../helpers/chaos-test-helpers';
import request from 'supertest';

/**
 * Chaos Test: Payment Gateway Failure
 * 
 * Validates that when payment fails, the system correctly:
 * 1. Cancels the order
 * 2. Releases reserved inventory
 * 3. Publishes compensation events
 * 4. Maintains data consistency
 */
describe('Chaos Test: Payment Gateway Failure', () => {
    let chaos: ChaosTestHelpers;
    let orderApiUrl: string;

    beforeAll(async () => {
        chaos = new ChaosTestHelpers();
        orderApiUrl = process.env.ORDER_SERVICE_URL || 'http://localhost:3001';

        // Enable 100% payment failure
        await chaos.enablePaymentFailures(1.0, 'card_declined');
    });

    afterAll(async () => {
        // Disable payment failures
        await chaos.disablePaymentFailures();
        await chaos.disconnect();
    });

    beforeEach(async () => {
        await chaos.cleanup();
    });

    it('should cancel order and release inventory when payment fails', async () => {
        // Step 1: Seed inventory
        await chaos['inventoryPrisma'].inventory.upsert({
            where: { productId: 'prod_chaos_laptop' },
            update: {
                quantityAvailable: 10,
                quantityReserved: 0,
                version: 0,
            },
            create: {
                productId: 'prod_chaos_laptop',
                quantityAvailable: 10,
                quantityReserved: 0,
                version: 0,
                warehouseId: 'wh_default',
            },
        });

        // Step 2: Create order
        const response = await request(orderApiUrl)
            .post('/api/v1/orders')
            .send({
                customerId: 'cust_chaos_alice',
                items: [
                    {
                        productId: 'prod_chaos_laptop',
                        quantity: 1,
                        price: 999.99,
                    },
                ],
                shippingAddress: {
                    street: '123 Chaos St',
                    city: 'NYC',
                    state: 'NY',
                    zipCode: '10001',
                    country: 'USA',
                },
            })
            .expect(201);

        const orderId = response.body.data.orderId;
        console.log(`[TEST] Created order: ${orderId}`);

        // Step 3: Wait for order to be cancelled (saga compensation)
        await chaos.waitForOrderStatus(orderId, 'CANCELLED', 60000);

        // Step 4: Verify order cancelled
        const order = await chaos['orderPrisma'].order.findUnique({
            where: { id: orderId },
        });

        expect(order).toBeDefined();
        expect(order!.status).toBe('CANCELLED');
        expect(order!.cancelledAt).toBeDefined();

        // Step 5: Verify inventory released
        const inventory = await chaos['inventoryPrisma'].inventory.findUnique({
            where: { productId: 'prod_chaos_laptop' },
        });

        expect(inventory!.quantityAvailable).toBe(10); // Restored to original
        expect(inventory!.quantityReserved).toBe(0); // No reservations

        // Step 6: Verify no payment captured
        const payment = await chaos['paymentPrisma'].payment.findUnique({
            where: { orderId },
        });

        expect(payment).toBeNull();

        // Step 7: Verify data consistency
        const consistency = await chaos.verifyDataConsistency(orderId);
        expect(consistency.consistent).toBe(true);
        expect(consistency.issues).toHaveLength(0);

        console.log('[TEST] ✅ Payment failure handled correctly');
    }, 90000); // 90 second timeout

    it('should handle multiple concurrent order failures', async () => {
        // Seed inventory for 100 items
        await chaos['inventoryPrisma'].inventory.upsert({
            where: { productId: 'prod_chaos_phone' },
            update: {
                quantityAvailable: 100,
                quantityReserved: 0,
                version: 0,
            },
            create: {
                productId: 'prod_chaos_phone',
                quantityAvailable: 100,
                quantityReserved: 0,
                version: 0,
                warehouseId: 'wh_default',
            },
        });

        // Create 10 orders concurrently
        const createOrder = async (index: number) => {
            const response = await request(orderApiUrl)
                .post('/api/v1/orders')
                .send({
                    customerId: `cust_chaos_${index}`,
                    items: [
                        {
                            productId: 'prod_chaos_phone',
                            quantity: 1,
                            price: 599.99,
                        },
                    ],
                    shippingAddress: {
                        street: `${index} Chaos St`,
                        city: 'NYC',
                        state: 'NY',
                        zipCode: '10001',
                        country: 'USA',
                    },
                });

            return response.body.data.orderId;
        };

        const orderIds = await Promise.all(
            Array(10)
                .fill(0)
                .map((_, i) => createOrder(i)),
        );

        console.log(`[TEST] Created ${orderIds.length} concurrent orders`);

        // Wait for all to be cancelled
        await Promise.all(
            orderIds.map((orderId) =>
                chaos.waitForOrderStatus(orderId, 'CANCELLED', 60000),
            ),
        );

        // Verify inventory fully restored
        const inventory = await chaos['inventoryPrisma'].inventory.findUnique({
            where: { productId: 'prod_chaos_phone' },
        });

        expect(inventory!.quantityAvailable).toBe(100);
        expect(inventory!.quantityReserved).toBe(0);

        console.log('[TEST] ✅ Concurrent failures handled correctly');
    }, 120000);
});
