'use server';

import { SystemMetrics, ServiceHealth, KafkaMetrics } from '@/types';
import { listOrdersAction } from './orders';

const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://localhost:3001';
const INVENTORY_SERVICE_URL = process.env.INVENTORY_SERVICE_URL || 'http://localhost:3002';
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3003';

export async function getSystemMetricsAction(token: string): Promise<SystemMetrics> {
    if (!token) {
        return {
            ordersProcessed: 0,
            successfulOrders: 0,
            failedOrders: 0,
            activeSagas: 0,
            avgLatencyMs: 0,
            p95LatencyMs: 0,
            p99LatencyMs: 0,
            errorRate: 0,
            retryCount: 0
        };
    }

    try {
        // Parallel fetch for counts
        const [all, successful, failed, pending] = await Promise.all([
            listOrdersAction({ limit: 1 }, token),
            listOrdersAction({ limit: 1, status: 'FULFILLED' }, token),
            listOrdersAction({ limit: 1, status: 'FAILED' }, token),
            listOrdersAction({ limit: 1, status: 'PENDING' }, token),
        ]);

        const total = all.total;
        const success = successful.total;
        const fail = failed.total;
        const active = pending.total;

        return {
            ordersProcessed: total,
            successfulOrders: success,
            failedOrders: fail,
            activeSagas: active,
            // Backend doesn't provide these yet, returning 0/placeholder to avoid random mock data
            avgLatencyMs: 0,
            p95LatencyMs: 0,
            p99LatencyMs: 0,
            errorRate: total > 0 ? parseFloat(((fail / total) * 100).toFixed(2)) : 0.0,
            retryCount: 0
        };
    } catch (error) {
        console.error('Failed to fetch system metrics', error);
        return {
            ordersProcessed: 0,
            successfulOrders: 0,
            failedOrders: 0,
            activeSagas: 0,
            avgLatencyMs: 0,
            p95LatencyMs: 0,
            p99LatencyMs: 0,
            errorRate: 0,
            retryCount: 0
        };
    }
}

async function checkService(name: string, url: string): Promise<ServiceHealth> {
    try {
        const res = await fetch(`${url}/health`, { next: { revalidate: 10 } });
        if (res.ok) {
            const data = await res.json();
            return {
                name,
                status: data.status === 'ok' ? 'healthy' : 'degraded',
                uptime: data.uptime || 0,
                lastCheck: new Date().toISOString()
            };
        }
        return { name, status: 'down', uptime: 0, lastCheck: new Date().toISOString() };
    } catch (e) {
        return { name, status: 'down', uptime: 0, lastCheck: new Date().toISOString() };
    }
}

export async function getServiceHealthAction(): Promise<ServiceHealth[]> {
    return Promise.all([
        checkService('Order Service', ORDER_SERVICE_URL),
        checkService('Inventory Service', INVENTORY_SERVICE_URL),
        checkService('Payment Service', PAYMENT_SERVICE_URL)
    ]);
}

export async function getKafkaMetricsAction(token: string): Promise<KafkaMetrics> {
    // Placeholder as we don't have a real Kafka metrics API exposed to dashboard yet
    return {
        consumerLag: 0,
        messagesPerSecond: 0,
        partitions: 3, // Known static value
        topics: 5
    };
}
