export interface BaseResponseDto<T = any> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        context?: Record<string, any>;
        timestamp: string;
        correlationId?: string;
    };
    metadata?: {
        correlationId: string;
        timestamp: string;
    };
}
