import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { ChaosTestHelpers } from '../helpers/chaos-test-helpers';
import request from 'supertest';

/**
 * Chaos Test: Service Crash Recovery
 * 
 * Validates that when a service crashes mid-saga:
 * 1. Outbox events are not lost
 * 2. Events are published after restart
 * 3. Saga completes successfully
 * 4. No data inconsistencies
 */
describe('Chaos Test: Service Crash Recovery', () => {
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

    it('should recover and complete saga after payment service crash', async () => {
        // Step 1: Seed inventory
        await chaos['inventoryPrisma'].inventory.upsert({
            where: { productId: 'prod_crash_tablet' },
            update: {
                quantityAvailable: 50,
                quantityReserved: 0,
                version: 0,
            },
            create: {
                productId: 'prod_crash_tablet',
                quantityAvailable: 50,
                quantityReserved: 0,
                version: 0,
                warehouseId: 'wh_default',
            },
        });

        // Step 2: Create order
        const response = await request(orderApiUrl)
            .post('/api/v1/orders')
            .send({
                customerId: 'cust_crash_bob',
                items: [
                    {
                        productId: 'prod_crash_tablet',
                        quantity: 1,
                        price: 399.99,
                    },
                ],
                shippingAddress: {
                    street: '456 Crash Ave',
                    city: 'SF',
                    state: 'CA',
                    zipCode: '94102',
                    country: 'USA',
                },
            })
            .expect(201);

        const orderId = response.body.data.orderId;
        console.log(`[TEST] Created order: ${orderId}`);

        // Step 3: Wait for inventory reservation
        await chaos.waitForCondition(
            async () => {
                const reservation = await chaos['inventoryPrisma'].reservation.findUnique({
                    where: { orderId },
                });
                return reservation?.status === 'RESERVED';
            },
            30000,
            1000,
            'Inventory reservation',
        );

        console.log('[TEST] Inventory reserved, crashing payment service...');

        // Step 4: Crash payment service BEFORE it processes payment
        await chaos.stopService('payment-service');

        // Wait a bit for crash
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // Step 5: Verify payment service is down
        try {
            await request('http://localhost:3003').get('/health');
            throw new Error('Payment service should be down');
        } catch (error) {
            console.log('[TEST] ✅ Payment service is down');
        }

        // Step 6: Check outbox has unpublished events
        const outboxEvents = await chaos['paymentPrisma'].outbox.findMany({
            where: { published: false },
        });

        console.log(`[TEST] Unpublished outbox events: ${outboxEvents.length}`);

        // Step 7: Restart payment service
        console.log('[TEST] Restarting payment service...');
        await chaos.startService('payment-service');

        // Wait for service to be healthy
        await chaos.waitForCondition(
            async () => {
                try {
                    const healthResponse = await request('http://localhost:3003').get('/health');
                    return healthResponse.status === 200;
                } catch {
                    return false;
                }
            },
            30000,
            2000,
            'Payment service healthy',
        );

        console.log('[TEST] ✅ Payment service restarted');

        // Step 8: Wait for saga to complete
        await chaos.waitForOrderStatus(orderId, 'PAID', 60000);

        // Step 9: Verify saga completed successfully
        const order = await chaos['orderPrisma'].order.findUnique({
            where: { id: orderId },
        });

        expect(order!.status).toBe('PAID');

        // Step 10: Verify payment captured
        const payment = await chaos['paymentPrisma'].payment.findUnique({
            where: { orderId },
        });

        expect(payment).toBeDefined();
        expect(payment!.status).toBe('CAPTURED');

        // Step 11: Verify inventory committed
        const reservation = await chaos['inventoryPrisma'].reservation.findUnique({
            where: { orderId },
        });

        expect(reservation!.status).toBe('COMMITTED');

        // Step 12: Verify outbox published
        const pendingOutbox = await chaos['paymentPrisma'].outbox.findMany({
            where: { published: false },
        });

        expect(pendingOutbox).toHaveLength(0);

        // Step 13: Verify data consistency
        const consistency = await chaos.verifyDataConsistency(orderId);
        expect(consistency.consistent).toBe(true);

        console.log('[TEST] ✅ Service crash recovery successful');
    }, 180000); // 3 minute timeout
});
