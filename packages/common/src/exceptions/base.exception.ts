export abstract class BaseException extends Error {
    public readonly code: string;
    public readonly statusCode: number;
    public readonly isOperational: boolean;
    public readonly context?: Record<string, any>;
    public readonly timestamp: string;

    constructor(
        message: string,
        code: string,
        statusCode: number,
        isOperational = true,
        context?: Record<string, any>,
    ) {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);

        this.code = code;
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.context = context;
        this.timestamp = new Date().toISOString();

        Error.captureStackTrace(this);
    }

    toJSON() {
        return {
            code: this.code,
            message: this.message,
            statusCode: this.statusCode,
            context: this.context,
            timestamp: this.timestamp,
        };
    }
}
