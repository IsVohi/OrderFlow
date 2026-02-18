import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// I implemented this to extract correlation IDs from headers for distributed tracing.

export const CorrelationId = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): string => {
        const request = ctx.switchToHttp().getRequest();
        return request.correlationId || '';
    },
);
