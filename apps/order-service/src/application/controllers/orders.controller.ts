import {
    Controller,
    Post,
    Get,
    Delete,
    Body,
    Param,
    Query,
    Headers,
    UseInterceptors,
    HttpCode,
    HttpStatus,
    ForbiddenException,
} from '@nestjs/common';
import { OrderService } from '../../application/services/order.service';
import { OrderEventProducer } from '../../infrastructure/messaging/producers/order-event.producer';
import { CreateOrderDto, CancelOrderDto } from '../../application/dto/order.dto';
import { CorrelationIdInterceptor, CorrelationId, IdGenerator, BaseResponseDto, CurrentUser, JwtIdentity } from '@orderflow/common';
import { AppLogger } from '@orderflow/logger';

@Controller('api/v1/orders')
@UseInterceptors(CorrelationIdInterceptor)
export class OrdersController {
    constructor(
        private orderService: OrderService,
        private eventProducer: OrderEventProducer,
        private logger: AppLogger,
    ) { }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    async createOrder(
        @Body() dto: CreateOrderDto,
        @Headers('x-idempotency-key') idempotencyKey: string,
        @CorrelationId() correlationId: string,
    ): Promise<BaseResponseDto> {
        this.logger.setCorrelationId(correlationId);

        if (!idempotencyKey) {
            idempotencyKey = IdGenerator.generateEventId();
        }

        this.logger.log('Creating order', {
            customerId: dto.customerId,
            itemCount: dto.items.length,
            idempotencyKey,
        });

        const order = await this.orderService.createOrder(
            dto,
            idempotencyKey,
            correlationId,
        );

        // I publish the OrderCreated event to Kafka only if the order is newly created.
        const wasNew = !order.createdAt ||
            (new Date().getTime() - new Date(order.createdAt).getTime()) < 1000;

        if (wasNew) {
            await this.eventProducer.publishOrderCreated(order, correlationId);
        }

        return {
            success: true,
            data: {
                orderId: order.id,
                customerId: order.customerId,
                totalAmount: parseFloat(order.totalAmount.toString()),
                currency: order.currency,
                status: order.status,
                createdAt: order.createdAt.toISOString(),
            },
            metadata: {
                correlationId,
                timestamp: new Date().toISOString(),
            },
        };
    }

    @Get(':orderId')
    async getOrder(
        @Param('orderId') orderId: string,
        @CorrelationId() correlationId: string,
        @CurrentUser() identity?: JwtIdentity | null,
    ): Promise<BaseResponseDto> {
        this.logger.setCorrelationId(correlationId);

        const order = await this.orderService.getOrderById(orderId);

        // Authorization: USER can only access their own orders
        if (identity && identity.role === 'USER' && order.customerId !== identity.sub) {
            throw new ForbiddenException('You do not have access to this order');
        }

        return {
            success: true,
            data: order,
            metadata: {
                correlationId,
                timestamp: new Date().toISOString(),
            },
        };
    }

    @Get()
    async listOrders(
        @Query('customerId') customerId?: string,
        @Query('status') status?: string,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
        @CorrelationId() correlationId?: string,
        @CurrentUser() identity?: JwtIdentity | null,
    ): Promise<BaseResponseDto> {
        const { orders, total } = await this.orderService.listOrders({
            customerId,
            status: status as any,
            limit: limit ? parseInt(limit) : 20,
            offset: offset ? parseInt(offset) : 0,
            identity,
        });

        return {
            success: true,
            data: {
                orders,
                pagination: {
                    total,
                    limit: limit ? parseInt(limit) : 20,
                    offset: offset ? parseInt(offset) : 0,
                    hasMore: total > (parseInt(offset || '0') + orders.length),
                },
            },
            metadata: {
                correlationId: correlationId!,
                timestamp: new Date().toISOString(),
            },
        };
    }

    @Post(':orderId/confirm')
    @HttpCode(HttpStatus.OK)
    async confirmOrder(
        @Param('orderId') orderId: string,
        @CorrelationId() correlationId: string,
    ): Promise<BaseResponseDto> {
        this.logger.setCorrelationId(correlationId);
        await this.orderService.transitionToConfirmed(orderId, correlationId);
        return {
            success: true,
            data: { orderId, status: 'PAYMENT_PENDING' }, // Service transitions to PAYMENT_PENDING
            metadata: { correlationId, timestamp: new Date().toISOString() },
        };
    }

    @Post(':orderId/pay')
    @HttpCode(HttpStatus.OK)
    async markOrderPaid(
        @Param('orderId') orderId: string,
        @CorrelationId() correlationId: string,
    ): Promise<BaseResponseDto> {
        this.logger.setCorrelationId(correlationId);
        await this.orderService.transitionToPaid(orderId, correlationId);
        return {
            success: true,
            data: { orderId, status: 'PAID' },
            metadata: { correlationId, timestamp: new Date().toISOString() },
        };
    }

    @Post(':orderId/fulfill')
    @HttpCode(HttpStatus.OK)
    async fulfillOrder(
        @Param('orderId') orderId: string,
        @CorrelationId() correlationId: string,
    ): Promise<BaseResponseDto> {
        this.logger.setCorrelationId(correlationId);
        await this.orderService.transitionToFulfilled(orderId, correlationId);
        return {
            success: true,
            data: { orderId, status: 'FULFILLED' },
            metadata: { correlationId, timestamp: new Date().toISOString() },
        };
    }

    @Delete(':orderId')
    async cancelOrder(
        @Param('orderId') orderId: string,
        @Body() dto: CancelOrderDto,
        @CorrelationId() correlationId: string,
    ): Promise<BaseResponseDto> {
        this.logger.setCorrelationId(correlationId);

        const order = await this.orderService.getOrderById(orderId);
        const previousStatus = order.status;

        await this.orderService.transitionToCancelled(
            orderId,
            dto.reason,
            dto.cancelledBy,
            correlationId,
        );

        // I publish the OrderCancelled event.
        await this.eventProducer.publishOrderCancelled(
            order,
            dto.reason,
            dto.cancelledBy,
            correlationId,
            previousStatus,
        );

        return {
            success: true,
            data: {
                orderId,
                status: 'CANCELLED',
                cancelledAt: new Date().toISOString(),
            },
            metadata: {
                correlationId,
                timestamp: new Date().toISOString(),
            },
        };
    }
}
