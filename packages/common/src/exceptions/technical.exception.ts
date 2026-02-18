import { BaseException } from './base.exception';

export class TechnicalException extends BaseException {
    constructor(
        message: string,
        code: string,
        statusCode = 500,
        context?: Record<string, any>,
    ) {
        super(message, code, statusCode, false, context);
    }
}
