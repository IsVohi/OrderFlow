import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { IdGenerator } from '../utils/id-generator';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest();
        const response = context.switchToHttp().getResponse();

        // Extract or generate correlation ID
        const correlationId =
            request.headers[CORRELATION_ID_HEADER] || IdGenerator.generateCorrelationId();

        // Attach to request for downstream access
        request.correlationId = correlationId;

        // Add to response headers
        response.setHeader(CORRELATION_ID_HEADER, correlationId);

        return next.handle().pipe(
            tap(() => {
                // Correlation ID automatically propagated via response header
            }),
        );
    }
}
