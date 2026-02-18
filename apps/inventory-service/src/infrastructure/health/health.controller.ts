import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma/prisma.service';

@Controller('health')
export class HealthController {
    constructor(
        private readonly prisma: PrismaService,
    ) { }

    @Get()
    async check() {
        const checks = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            service: 'inventory-service',
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
