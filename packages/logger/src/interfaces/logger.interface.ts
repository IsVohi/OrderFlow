/* eslint-disable @typescript-eslint/no-explicit-any */
export interface LogContext {
    correlationId?: string;
    traceId?: string;
    spanId?: string;
    userId?: string;
    service: string;
    [key: string]: any;
}

export interface LoggerInterface {
    log(message: string, context?: Record<string, any>): void;
    error(message: string, trace?: string, context?: Record<string, any>): void;
    warn(message: string, context?: Record<string, any>): void;
    debug(message: string, context?: Record<string, any>): void;
    verbose(message: string, context?: Record<string, any>): void;
    setCorrelationId(correlationId: string): void;
    setTraceId(traceId: string, spanId?: string): void;
}
