import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import * as winston from 'winston';

import { LogContext, LoggerInterface } from './interfaces/logger.interface';

@Injectable()
/* eslint-disable @typescript-eslint/no-explicit-any */
export class AppLogger implements NestLoggerService, LoggerInterface {
    private logger: winston.Logger;
    private context: LogContext;

    constructor(context: LogContext) {
        this.context = { ...context };

        // I configured JSON output for production and pretty-printing for dev.
        this.logger = winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: winston.format.combine(
                winston.format.timestamp({ format: 'ISO' }),
                winston.format.errors({ stack: true }),
                winston.format.json(),
            ),
            defaultMeta: {
                service: context.service,
                environment: process.env.NODE_ENV || 'development',
            },
            transports: [
                new winston.transports.Console({
                    format:
                        process.env.NODE_ENV === 'development'
                            ? winston.format.combine(winston.format.colorize(), winston.format.simple())
                            : winston.format.json(),
                }),
            ],
        });
    }

    log(message: string, context?: Record<string, any>) {
        this.logger.info(message, { ...this.context, ...context });
    }

    error(message: string, trace?: string, context?: Record<string, any>) {
        this.logger.error(message, {
            ...this.context,
            ...context,
            stack: trace,
        });
    }

    warn(message: string, context?: Record<string, any>) {
        this.logger.warn(message, { ...this.context, ...context });
    }

    debug(message: string, context?: Record<string, any>) {
        this.logger.debug(message, { ...this.context, ...context });
    }

    verbose(message: string, context?: Record<string, any>) {
        this.logger.verbose(message, { ...this.context, ...context });
    }

    setCorrelationId(correlationId: string) {
        this.context.correlationId = correlationId;
    }

    setTraceId(traceId: string, spanId?: string) {
        this.context.traceId = traceId;
        if (spanId) this.context.spanId = spanId;
    }
}
