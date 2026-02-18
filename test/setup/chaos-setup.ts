import { beforeAll, afterAll } from '@jest/globals';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Global setup for chaos tests
 */
beforeAll(async () => {
    console.log('\n🔥 Starting Chaos Testing Environment...\n');

    // Check if Docker is running
    try {
        await execAsync('docker info');
    } catch (error) {
        throw new Error('Docker is not running. Please start Docker and try again.');
    }

    // Start infrastructure if not already running
    try {
        console.log('📦 Starting Docker infrastructure...');
        await execAsync('docker-compose up -d', {
            cwd: process.cwd(),
        });

        // Wait for services to be healthy
        console.log('⏳ Waiting for services to be healthy...');
        await new Promise((resolve) => setTimeout(resolve, 30000));

        console.log('✅ Infrastructure ready\n');
    } catch (error) {
        console.error('Failed to start infrastructure:', error);
        throw error;
    }
}, 60000); // 60 second timeout for setup

/**
 * Global teardown for chaos tests
 */
afterAll(async () => {
    console.log('\n🧹 Cleaning up chaos testing environment...\n');

    try {
        // Reset chaos configuration
        const services = ['order-service', 'inventory-service', 'payment-service'];

        for (const service of services) {
            try {
                await execAsync(`docker-compose restart ${service}`);
            } catch (error) {
                console.warn(`Failed to restart ${service}:`, error.message);
            }
        }

        console.log('✅ Cleanup complete\n');
    } catch (error) {
        console.error('Failed to cleanup:', error);
    }
}, 60000);
