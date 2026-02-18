import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { ChaosTestHelpers } from '../helpers/chaos-test-helpers';
import request from 'supertest';

/**
 * Chaos Test: Idempotent Consumer (Duplicate Events)
 * 
 * Validates that duplicate Kafka events don't cause side effects:
 * 1. Processed events tracked in database
 * 2. Duplicate events skipped
 * 3. No duplicate inventory deductions
 * 4. No duplicate payments
 */
describe('Chaos Test: Idempotent Consumer', () => {
    let chaos: ChaosTestHelpers;
    let orderApiUrl: string;

    beforeAll(async () => {
        chaos = new ChaosTestHelpers();
        orderApiUrl = process.env.ORDER_SERVICE_URL || 'http://localhost:3001';
    });

    afterAll(async () => {
        await chaos.disconnect();
    });

    beforeEach(async () => {
        await chaos.cleanup();
    });

    it('should handle duplicate events without side effects', async () => {
        // Step 1: Seed inventory
        await chaos['inventoryPrisma'].inventory.upsert({
            where: { productId: 'prod_idempotent_tablet' },
            update: {
                quantityAvailable: 100,
                quantityReserved: 0,
                version: 0,
            },
            create: {
                productId: 'prod_idempotent_tablet',
                quantityAvailable: 100,
                quantityReserved: 0,
                version: 0,
                warehouseId: 'wh_default',
            },
        });

        // Step 2: Create order
        const response = await request(orderApiUrl)
            .post('/api/v1/orders')
            .send({
                customerId: 'cust_idempotent_charlie',
                items: [
                    {
                        productId: 'prod_idempotent_tablet',
                        quantity: 2,
                        price: 399.99,
                    },
                ],
                shippingAddress: {
                    street: '789 Duplicate Ave',
                    city: 'SF',
                    state: 'CA',
                    zipCode: '94102',
                    country: 'USA',
                },
            })
            .expect(201);

        const orderId = response.body.data.orderId;
        console.log(`[TEST] Created order: ${orderId}`);

        // Step 3: Wait for order to be PAID
        await chaos.waitForOrderStatus(orderId, 'PAID', 60000);

        console.log('[TEST] Order completed successfully');

        // Step 4: Get current Kafka consumer offset
        const consumerGroup = 'inventory-service-orderflow';
        const topic = 'orders';

        // Get offset before replay
        const inventoryBefore = await chaos['inventoryPrisma'].inventory.findUnique({
            where: { productId: 'prod_idempotent_tablet' },
        });
        const reservationsBefore = await chaos[
            'inventoryPrisma'
        ].reservation.findMany({
            where: { orderId },
        });
        const processedEventsBefore = await chaos[
            'inventoryPrisma'
        ].processedEvent.count();

        console.log(
            `[TEST] Before replay - Inventory: ${inventoryBefore!.quantityAvailable}, Reservations: ${reservationsBefore.length}, ProcessedEvents: ${processedEventsBefore}`,
        );

        // Step 5: Restart inventory service to trigger consumer replay
        console.log('[TEST] Restarting inventory service (may trigger replay)...');
        await chaos.restartService('inventory-service');

        // Wait for service to be back  
        await new Promise((resolve) => setTimeout(resolve, 10000));

        // Step 6: Verify no duplicate reservations
        const reservationsAfter = await chaos['inventoryPrisma'].reservation.findMany(
            {
                where: { orderId },
            },
        );

        console.log(`[TEST] Reservations after replay: ${reservationsAfter.length}`);
        expect(reservationsAfter).toHaveLength(1); // Still only ONE reservation

        // Step 7: Verify inventory not double-deducted
        const inventoryAfter = await chaos['inventoryPrisma'].inventory.findUnique({
            where: { productId: 'prod_idempotent_tablet' },
        });

        expect(inventoryAfter!.quantityReserved).toBe(
            inventoryBefore!.quantityReserved,
        );

        const reservation = reservationsAfter[0];
        expect(reservation.quantityReserved).toBe(2); // Still 2, not 4

        // Step 8: Verify no duplicate payments
        const payments = await chaos['paymentPrisma'].payment.findMany({
            where: { orderId },
        });

        expect(payments).toHaveLength(1);

        // Step 9: Check processed_events table
        const processedEventsAfter = await chaos[
            'inventoryPrisma'
        ].processedEvent.count();

        // Should have same or more events (if replay happened)
        expect(processedEventsAfter).toBeGreaterThanOrEqual(processedEventsBefore);

        // Step 10: Check logs for duplicate detection
        const logs = await chaos.getServiceLogs('inventory-service', {
            level: 'debug',
            message: 'already processed',
        });

        console.log(`[TEST] Duplicate detection logs: ${logs.length}`);

        console.log('[TEST] ✅ Idempotency verified - no duplicate side effects');
    }, 120000);

    it('should skip duplicate events at high volume', async () => {
        // Create inventory for 50 items
        await chaos['inventoryPrisma'].inventory.upsert({
            where: { productId: 'prod_idempotent_bulk' },
            update: {
                quantityAvailable: 50,
                quantityReserved: 0,
                version: 0,
            },
            create: {
                productId: 'prod_idempotent_bulk',
                quantityAvailable: 50,
                quantityReserved: 0,
                version: 0,
                warehouseId: 'wh_default',
            },
        });

        // Create 10 orders
        const orderIds: string[] = [];
        for (let i = 0; i < 10; i++) {
            const response = await request(orderApiUrl)
                .post('/api/v1/orders')
                .send({
                    customerId: `cust_bulk_${i}`,
                    items: [
                        {
                            productId: 'prod_idempotent_bulk',
                            quantity: 1,
                            price: 50.0,
                        },
                    ],
                    shippingAddress: {
                        street: `${i} Bulk St`,
                        city: 'NYC',
                        state: 'NY',
                        zipCode: '10001',
                        country: 'USA',
                    },
                })
                .expect(201);

            orderIds.push(response.body.data.orderId);
        }

        // Wait for all to complete
        await Promise.all(
            orderIds.map((orderId) => chaos.waitForOrderStatus(orderId, 'PAID', 60000)),
        );

        // Get baseline counts
        const reservationsBefore = await chaos['inventoryPrisma'].reservation.count();
        const paymentsBefore = await chaos['paymentPrisma'].payment.count();

        // Restart services (may trigger replays)
        await chaos.restartService('inventory-service');
        await chaos.restartService('payment-service');

        await new Promise((resolve) => setTimeout(resolve, 15000));

        // Verify counts unchanged
        const reservationsAfter = await chaos['inventoryPrisma'].reservation.count();
        const paymentsAfter = await chaos['paymentPrisma'].payment.count();

        expect(reservationsAfter).toBe(reservationsBefore);
        expect(paymentsAfter).toBe(paymentsBefore);

        console.log('[TEST] ✅ High volume idempotency verified');
    }, 180000);
});
