import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtIdentity, decodeJwtIdentity } from '../auth/jwt-identity';

/**
 * Parameter decorator that extracts JWT identity from the request
 * Usage: @CurrentUser() identity: JwtIdentity
 */
export const CurrentUser = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): JwtIdentity | null => {
        const request = ctx.switchToHttp().getRequest();

        // If identity was already extracted by middleware, use it
        if (request.identity) {
            return request.identity;
        }

        // Otherwise, extract from Authorization header
        const authHeader = request.headers.authorization;
        return decodeJwtIdentity(authHeader);
    },
);
