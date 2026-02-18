import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import { AppLogger } from '@orderflow/logger';

/**
 * Chaos Middleware: Simulates service crashes for testing
 * 
 * Configuration:
 * - CHAOS_MODE_ENABLED: Enable chaos mode
 * - CHAOS_CRASH_PROBABILITY: Probability of crash (0.0 - 1.0)
 * - CHAOS_LATENCY_MS: Add latency to requests
 */
@Injectable()
export class ChaosMiddleware implements NestMiddleware {
    constructor(
        private config: ConfigService,
        private logger: AppLogger,
    ) { }

    async use(req: Request, _res: Response, next: NextFunction) {
        const chaosEnabled = this.config.get<boolean>('chaos.enabled', false);

        if (!chaosEnabled) {
            return next();
        }

        // Simulate crash
        const crashProbability = this.config.get<number>('chaos.crashProbability', 0);
        if (crashProbability > 0 && Math.random() < crashProbability) {
            this.logger.error('🔥 CHAOS: Simulating service crash!', '', {
                method: req.method,
                path: req.path,
            });

            // Exit process to simulate crash
            setTimeout(() => process.exit(1), 100);
            return;
        }

        // Simulate latency
        const latencyMs = this.config.get<number>('chaos.latencyMs', 0);
        if (latencyMs > 0) {
            this.logger.warn(`⏱️  CHAOS: Adding ${latencyMs}ms latency`, {
                method: req.method,
                path: req.path,
            });

            await new Promise((resolve) => setTimeout(resolve, latencyMs));
        }

        next();
    }
}
