import { exec } from 'child_process';
import { promisify } from 'util';
import { PrismaClient as OrderPrisma } from '../../apps/order-service/node_modules/.prisma/client';
import { PrismaClient as InventoryPrisma } from '../../apps/inventory-service/node_modules/.prisma/client';
import { PrismaClient as PaymentPrisma } from '../../apps/payment-service/node_modules/.prisma/client';

const execAsync = promisify(exec);

export class ChaosTestHelpers {
    private orderPrisma: OrderPrisma;
    private inventoryPrisma: InventoryPrisma;
    private paymentPrisma: PaymentPrisma;

    constructor() {
        this.orderPrisma = new OrderPrisma();
        this.inventoryPrisma = new InventoryPrisma();
        this.paymentPrisma = new PaymentPrisma();
    }

    /**
     * Wait for a condition to be true with timeout
     */
    async waitForCondition(
        condition: () => Promise<boolean>,
        timeoutMs: number,
        intervalMs: number = 1000,
        description?: string,
    ): Promise<void> {
        const startTime = Date.now();
        let lastError: Error | null = null;

        while (Date.now() - startTime < timeoutMs) {
            try {
                if (await condition()) {
                    return;
                }
            } catch (error) {
                lastError = error as Error;
            }

            await new Promise((resolve) => setTimeout(resolve, intervalMs));
        }

        const message = description
            ? `Timeout waiting for condition: ${description}`
            : 'Timeout waiting for condition';

        if (lastError) {
            throw new Error(`${message}. Last error: ${lastError.message}`);
        }

        throw new Error(message);
    }

    /**
     * Wait for order to reach specific status
     */
    async waitForOrderStatus(
        orderId: string,
        expectedStatus: string,
        timeoutMs: number = 30000,
    ): Promise<void> {
        await this.waitForCondition(
            async () => {
                const order = await this.orderPrisma.order.findUnique({
                    where: { id: orderId },
                });
                return order?.status === expectedStatus;
            },
            timeoutMs,
            1000,
            `Order ${orderId} to reach status ${expectedStatus}`,
        );
    }

    /**
     * Restart a Docker Compose service
     */
    async restartService(serviceName: string): Promise<void> {
        console.log(`[CHAOS] Restarting service: ${serviceName}`);
        await this.stopService(serviceName);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await this.startService(serviceName);
        await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for startup
        console.log(`[CHAOS] Service restarted: ${serviceName}`);
    }

    /**
     * Stop a Docker Compose service
     */
    async stopService(serviceName: string): Promise<void> {
        console.log(`[CHAOS] Stopping service: ${serviceName}`);
        try {
            await execAsync(`docker-compose stop ${serviceName}`);
        } catch (error) {
            console.error(`Failed to stop ${serviceName}:`, error.message);
            throw error;
        }
    }

    /**
     * Start a Docker Compose service
     */
    async startService(serviceName: string): Promise<void> {
        console.log(`[CHAOS] Starting service: ${serviceName}`);
        try {
            await execAsync(`docker-compose start ${serviceName}`);
        } catch (error) {
            console.error(`Failed to start ${serviceName}:`, error.message);
            throw error;
        }
    }

    /**
     * Stop a Docker container
     */
    async stopContainer(containerName: string): Promise<void> {
        console.log(`[CHAOS] Stopping container: ${containerName}`);
        await execAsync(`docker stop ${containerName}`);
    }

    /**
     * Start a Docker container
     */
    async startContainer(containerName: string): Promise<void> {
        console.log(`[CHAOS] Starting container: ${containerName}`);
        await execAsync(`docker start ${containerName}`);
    }

    /**
     * Get Kafka consumer lag for a consumer group
     */
    async getConsumerLag(consumerGroup: string, topic: string): Promise<number> {
        try {
            const { stdout } = await execAsync(
                `docker exec kafka kafka-consumer-groups \\
          --bootstrap-server localhost:9092 \\
          --group ${consumerGroup} \\
          --describe`,
            );

            // Parse lag from output
            const lines = stdout.split('\n');
            const topicLine = lines.find((line) => line.includes(topic));

            if (topicLine) {
                const columns = topicLine.split(/\s+/);
                const lagIndex = columns.findIndex((col) => col === 'LAG') + 1;
                return parseInt(columns[lagIndex]) || 0;
            }

            return 0;
        } catch (error) {
            console.error('Failed to get consumer lag:', error.message);
            return 0;
        }
    }

    /**
     * Reset Kafka consumer offset to replay messages
     */
    async resetConsumerOffset(
        consumerGroup: string,
        topic: string,
        partition: number,
        offset: number,
    ): Promise<void> {
        console.log(
            `[CHAOS] Resetting consumer offset: ${consumerGroup}, ${topic}:${partition} to ${offset}`,
        );

        // Stop consumers first
        await execAsync(
            `docker exec kafka kafka-consumer-groups \\
        --bootstrap-server localhost:9092 \\
        --group ${consumerGroup} \\
        --reset-offsets \\
        --topic ${topic}:${partition} \\
        --to-offset ${offset} \\
        --execute`,
        );
    }

    /**
     * Get service logs with filtering
     */
    async getServiceLogs(
        serviceName: string,
        filter?: { level?: string; message?: string },
        tailLines: number = 1000,
    ): Promise<any[]> {
        try {
            const { stdout } = await execAsync(
                `docker logs ${serviceName} --tail ${tailLines} 2>&1`,
            );

            const logs = stdout
                .split('\n')
                .filter((line) => line.trim().length > 0)
                .map((line) => {
                    try {
                        return JSON.parse(line);
                    } catch {
                        return { raw: line };
                    }
                })
                .filter((log) => {
                    if (!log) return false;
                    if (filter?.level && log.level !== filter.level) return false;
                    if (filter?.message && !log.message?.includes(filter.message))
                        return false;
                    return true;
                });

            return logs;
        } catch (error) {
            console.error(`Failed to get logs for ${serviceName}:`, error.message);
            return [];
        }
    }

    /**
     * Configure service environment variables and restart
     */
    async configureServiceEnv(
        serviceName: string,
        envVars: Record<string, string>,
    ): Promise<void> {
        console.log(`[CHAOS] Configuring ${serviceName} with env vars:`, envVars);

        // Update .env file
        const envPath = `apps/${serviceName}/.env`;
        const envContent = Object.entries(envVars)
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');

        const fs = require('fs').promises;
        await fs.writeFile(envPath, envContent);

        // Restart service
        await this.restartService(serviceName);
    }

    /**
     * Enable payment gateway failure injection
     */
    async enablePaymentFailures(
        failureRate: number = 1.0,
        failureType: string = 'card_declined',
    ): Promise<void> {
        await this.configureServiceEnv('payment-service', {
            PAYMENT_GATEWAY_FAILURE_RATE: failureRate.toString(),
            PAYMENT_GATEWAY_FAILURE_TYPE: failureType,
        });
    }

    /**
     * Disable payment gateway failure injection
     */
    async disablePaymentFailures(): Promise<void> {
        await this.configureServiceEnv('payment-service', {
            PAYMENT_GATEWAY_FAILURE_RATE: '0.0',
        });
    }

    /**
     * Enable consumer lag simulation
     */
    async enableConsumerLag(
        serviceName: string,
        delayMs: number = 5000,
    ): Promise<void> {
        await this.configureServiceEnv(serviceName, {
            CHAOS_KAFKA_PROCESSING_DELAY_MS: delayMs.toString(),
            CHAOS_MODE_ENABLED: 'true',
        });
    }

    /**
     * Disable consumer lag simulation
     */
    async disableConsumerLag(serviceName: string): Promise<void> {
        await this.configureServiceEnv(serviceName, {
            CHAOS_KAFKA_PROCESSING_DELAY_MS: '0',
            CHAOS_MODE_ENABLED: 'false',
        });
    }

    /**
     * Verify no data inconsistencies
     */
    async verifyDataConsistency(orderId: string): Promise<{
        consistent: boolean;
        issues: string[];
    }> {
        const issues: string[] = [];

        // Get order
        const order = await this.orderPrisma.order.findUnique({
            where: { id: orderId },
            include: { items: true },
        });

        if (!order) {
            issues.push('Order not found');
            return { consistent: false, issues };
        }

        // Get reservation
        const reservation = await this.inventoryPrisma.reservation.findUnique({
            where: { orderId },
            include: { items: true },
        });

        // Get payment
        const payment = await this.paymentPrisma.payment.findUnique({
            where: { orderId },
        });

        // Verify order-reservation consistency
        if (order.status === 'CANCELLED' && reservation?.status === 'RESERVED') {
            issues.push('Order cancelled but reservation still active');
        }

        if (order.status === 'PAID' && reservation?.status !== 'COMMITTED') {
            issues.push('Order paid but reservation not committed');
        }

        // Verify order-payment consistency
        if (order.status === 'PAID' && payment?.status !== 'CAPTURED') {
            issues.push('Order paid but payment not captured');
        }

        if (order.status === 'CANCELLED' && payment?.status === 'CAPTURED') {
            issues.push('Order cancelled but payment captured');
        }

        return {
            consistent: issues.length === 0,
            issues,
        };
    }

    /**
     * Cleanup test data
     */
    async cleanup(): Promise<void> {
        await this.orderPrisma.orderEvent.deleteMany({});
        await this.orderPrisma.orderItem.deleteMany({});
        await this.orderPrisma.order.deleteMany({});
        await this.orderPrisma.processedEvent.deleteMany({});
        await this.orderPrisma.outbox.deleteMany({});

        await this.inventoryPrisma.reservationItem.deleteMany({});
        await this.inventoryPrisma.reservation.deleteMany({});
        await this.inventoryPrisma.processedEvent.deleteMany({});
        await this.inventoryPrisma.outbox.deleteMany({});

        await this.paymentPrisma.payment.deleteMany({});
        await this.paymentPrisma.processedEvent.deleteMany({});
        await this.paymentPrisma.outbox.deleteMany({});
    }

    /**
     * Disconnect all Prisma clients
     */
    async disconnect(): Promise<void> {
        await this.orderPrisma.$disconnect();
        await this.inventoryPrisma.$disconnect();
        await this.paymentPrisma.$disconnect();
    }
}
