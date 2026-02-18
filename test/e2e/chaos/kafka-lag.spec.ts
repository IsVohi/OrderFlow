import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { ChaosTestHelpers } from '../helpers/chaos-test-helpers';
import request from 'supertest';

/**
 * Chaos Test: Kafka Consumer Lag
 * 
 * Validates that system handles consumer lag gracefully:
 * 1. Messages eventually processed despite lag
 * 2. No data loss during high lag
 * 3. No inventory overselling
 * 4. Eventual consistency maintained
 */
describe('Chaos Test: Kafka Consumer Lag', () => {
    let chaos: ChaosTestHelpers;
    let orderApiUrl: string;

    beforeAll(async () => {
        chaos = new ChaosTestHelpers();
        orderApiUrl = process.env.ORDER_SERVICE_URL || 'http://localhost:3001';
    });

    afterAll(async () => {
        // Disable consumer lag
        await chaos.disableConsumerLag('inventory-service');
        await chaos.disconnect();
    });

    beforeEach(async () => {
        await chaos.cleanup();
    });

    it('should handle high consumer lag without data loss', async () => {
        // Step 1: Seed inventory
        await chaos['inventoryPrisma'].inventory.upsert({
            where: { productId: 'prod_lag_widget' },
            update: {
                quantityAvailable: 200,
                quantityReserved: 0,
                version: 0,
            },
            create: {
                productId: 'prod_lag_widget',
                quantityAvailable: 200,
                quantityReserved: 0,
                version: 0,
                warehouseId: 'wh_default',
            },
        });

        console.log('[TEST] Enabling consumer lag (10 second delay)...');

        // Step 2: Enable consumer lag (10 seconds per message)
        await chaos.enableConsumerLag('inventory-service', 10000);

        // Step 3: Create 20 orders rapidly
        console.log('[TEST] Creating 20 orders rapidly...');
        const orderIds: string[] = [];

        for (let i = 0; i < 20; i++) {
            const response = await request(orderApiUrl)
                .post('/api/v1/orders')
                .send({
                    customerId: `cust_lag_${i}`,
                    items: [
                        {
                            productId: 'prod_lag_widget',
                            quantity: 1,
                            price: 10.0,
                        },
                    ],
                    shippingAddress: {
                        street: `${i} Lag St`,
                        city: 'NYC',
                        state: 'NY',
                        zipCode: '10001',
                        country: 'USA',
                    },
                })
                .expect(201);

            orderIds.push(response.body.data.orderId);
        }

        console.log(`[TEST] Created ${orderIds.length} orders`);

        // Step 4: Check consumer lag
        await new Promise((resolve) => setTimeout(resolve, 5000));
        const lag = await chaos.getConsumerLag(
            'inventory-service-orderflow',
            'orders',
        );
        console.log(`[TEST] Consumer lag: ${lag} messages`);
        expect(lag).toBeGreaterThan(5); // Should have significant lag

        // Step 5: Wait for all orders to be processed (with patience)
        console.log('[TEST] Waiting for all orders to be processed...');
        await chaos.waitForCondition(
            async () => {
                const pendingOrders = await chaos['orderPrisma'].order.count({
                    where: {
                        id: { in: orderIds },
                        status: 'PENDING',
                    },
                });
                return pendingOrders === 0;
            },
            400000, // ~6.5 minutes (20 orders * 10 sec + buffer)
            5000, // Check every 5 seconds
            'All orders processed',
        );

        // Step 6: Verify all orders processed
        const orders = await chaos['orderPrisma'].order.findMany({
            where: { id: { in: orderIds } },
        });

        const successful = orders.filter((o) =>
            ['CONFIRMED', 'PAID', 'FULFILLED'].includes(o.status),
        ).length;
        const cancelled = orders.filter((o) => o.status === 'CANCELLED').length;

        console.log(`[TEST] Orders - Successful: ${successful}, Cancelled: ${cancelled}`);

        expect(successful + cancelled).toBe(20); // All processed
        expect(successful).toBeGreaterThan(0); // Some succeeded

        // Step 7: Verify no inventory overselling
        const inventory = await chaos['inventoryPrisma'].inventory.findUnique({
            where: { productId: 'prod_lag_widget' },
        });

        const totalReservedCommitted = await chaos[
            'inventoryPrisma'
        ].reservation.aggregate({
            where: {
                status: { in: ['RESERVED', 'COMMITTED'] },
            },
            _sum: { quantityReserved: true },
        });

        const reservedQuantity = totalReservedCommitted._sum.quantityReserved || 0;

        console.log(
            `[TEST] Inventory - Available: ${inventory!.quantityAvailable}, Reserved: ${inventory!.quantityReserved}`,
        );
        console.log(`[TEST] Total reserved/committed: ${reservedQuantity}`);

        expect(reservedQuantity).toBe(successful);
        expect(inventory!.quantityAvailable + reservedQuantity).toBe(200);

        console.log('[TEST] ✅ Kafka consumer lag handled correctly');
    }, 450000); // 7.5 minute timeout
});
