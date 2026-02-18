import { BaseException } from './base.exception';

export class BusinessException extends BaseException {
    constructor(
        message: string,
        code: string,
        statusCode = 400,
        context?: Record<string, any>,
    ) {
        super(message, code, statusCode, true, context);
    }
}
