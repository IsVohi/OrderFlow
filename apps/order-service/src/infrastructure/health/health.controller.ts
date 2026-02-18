import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma/prisma.service';

/**
 * Health Check Controller
 * 
 * Exposes /health endpoint for:
 * - Container orchestrators (Docker, K8s)
 * - Load balancer health probes
 * - Monitoring systems
 */
@Controller('health')
export class HealthController {
    constructor(
        private readonly prisma: PrismaService,
    ) { }

    /**
     * Basic liveness check
     * GET /health
     */
    @Get()
    async check() {
        const checks = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            service: 'order-service',
            version: process.env.npm_package_version || '1.0.0',
            uptime: process.uptime(),
            checks: {
                database: await this.checkDatabase(),
            },
        };

        const allHealthy = Object.values(checks.checks).every(
            (c) => c.status === 'ok',
        );

        return {
            ...checks,
            status: allHealthy ? 'ok' : 'degraded',
        };
    }

    /**
     * Readiness check for kubernetes
     * GET /health/ready
     */
    @Get('ready')
    async ready() {
        const dbReady = await this.checkDatabase();

        if (dbReady.status !== 'ok') {
            throw new Error('Database not ready');
        }

        return { status: 'ready' };
    }

    /**
     * Liveness check for kubernetes
     * GET /health/live
     */
    @Get('live')
    live() {
        return { status: 'alive' };
    }

    private async checkDatabase(): Promise<{ status: string; latencyMs?: number; error?: string }> {
        const start = Date.now();
        try {
            await this.prisma.$queryRaw`SELECT 1`;
            return {
                status: 'ok',
                latencyMs: Date.now() - start,
            };
        } catch (error) {
            return {
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
}
