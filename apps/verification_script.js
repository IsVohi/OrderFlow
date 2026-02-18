
const { execSync } = require('child_process');

function run(cmd) {
    try {
        return execSync(cmd, { encoding: 'utf8' });
    } catch (e) {
        console.error(`Command failed: ${cmd}`);
        console.error(e.stderr);
        throw e;
    }
}

async function verify() {
    console.log('--- Starting Verification ---');

    // Helper to wait for service
    async function waitForService(url, name) {
        console.log(`Waiting for ${name} to be ready...`);
        const maxRetries = 30;
        for (let i = 0; i < maxRetries; i++) {
            try {
                // check if connection is possible (any status code)
                execSync(`curl -s -o /dev/null ${url}`, { stdio: 'ignore' });
                console.log(`   ${name} is ready!`);
                return;
            } catch (e) {
                if (i === maxRetries - 1) throw new Error(`${name} failed to start after ${maxRetries}s`);
                await new Promise(r => setTimeout(r, 1000));
            }
        }
    }

    // 1. Get Inventory
    await waitForService('http://localhost:3002', 'Inventory Service');

    console.log('1. Fetching Inventory...');
    const inventoryJson = run('curl -s http://localhost:3002/api/v1/inventory');
    const inventory = JSON.parse(inventoryJson);
    console.log(`   Found ${inventory.length} products.`);

    if (inventory.length === 0) {
        throw new Error('No products found in inventory. Seed failed?');
    }

    const product = inventory[0];
    console.log(`   Selected Product: ${product.name} (${product.id}, $${product.price})`);

    // 2. Create Order
    await waitForService('http://localhost:3001', 'Order Service');

    console.log('2. Creating Order...');
    const orderPayload = JSON.stringify({
        customerId: 'customer-123',
        items: [{ productId: product.id, quantity: 1, price: product.price }],
        shippingAddress: {
            street: '123 Main St',
            city: 'New York',
            state: 'NY',
            zipCode: '10001',
            country: 'USA'
        }
    });

    const orderCmd = `curl -s -X POST http://localhost:3001/api/v1/orders \
        -H "Content-Type: application/json" \
        -d '${orderPayload}'`;

    const orderJson = run(orderCmd);
    const orderRes = JSON.parse(orderJson);
    const order = orderRes.data || orderRes;
    const orderId = order.id;
    console.log(`   Order Created: ${orderId} (Status: ${order.status}, Total: $${order.totalAmount})`);

    // 3. Process Payment
    console.log('3. Processing Payment...');
    const paymentPayload = JSON.stringify({
        orderId: orderId,
        amount: Number(order.totalAmount),
        currency: order.currency,
        paymentMethod: { type: 'card', last4: '4242' }
    });

    const paymentCmd = `curl -s -X POST http://localhost:3003/api/v1/payments \
        -H "Content-Type: application/json" \
        -d '${paymentPayload}'`;

    const paymentJson = run(paymentCmd);
    const paymentRes = JSON.parse(paymentJson);
    const payment = paymentRes.data || paymentRes;
    const paymentId = payment.paymentId || payment.id;

    console.log(`   Payment Processed: ${paymentId} (Status: ${payment.status})`);

    // 4. Verify Order Status Update (Event Driven)
    console.log('4. Waiting for Event Propagation (5s)...');
    await new Promise(r => setTimeout(r, 5000));

    const checkCmd = `curl -s http://localhost:3001/api/v1/orders/${orderId}`;
    const updatedOrderRes = JSON.parse(run(checkCmd));
    const updatedOrder = updatedOrderRes.data || updatedOrderRes;
    console.log(`   Order Status: ${updatedOrder.status}`);

    if (updatedOrder.status === 'PAID') {
        console.log('✅ SUCCESS: Real Flow Verified! (PENDING -> PAID)');
    } else {
        console.error('❌ FAILURE: Order status did not update to PAID.');
    }
}

verify().catch(e => console.error(e));
