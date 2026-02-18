import { Injectable, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { OrderStatus } from '../../infrastructure/persistence/client';
import { CreateOrderDto } from '../dto/order.dto';
import { IdGenerator } from '@orderflow/common';
import { OrderNotFoundException, InvalidOrderStateException } from '../../domain/exceptions/order.exceptions';
import { AppLogger } from '@orderflow/logger';

import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';

/**
 * I use the Transactional Outbox pattern here to ensure data consistency by writing events locally within the same transaction.
 */
@Injectable()
export class OrderService {
    constructor(
        private prisma: PrismaService,
        private logger: AppLogger,
        private httpService: HttpService,
        private configService: ConfigService,
    ) { }

    async createOrder(
        dto: CreateOrderDto,
        idempotencyKey: string,
        correlationId: string,
    ): Promise<any> {
        // Check for existing order (idempotency)
        const existingOrder = await this.prisma.order.findUnique({
            where: { idempotencyKey },
            include: { items: true },
        });

        if (existingOrder) {
            this.logger.debug('Order already exists (idempotent)', {
                orderId: existingOrder.id,
                idempotencyKey,
            });
            return existingOrder;
        }

        const orderId = IdGenerator.generateOrderId();
        const totalAmount = dto.items.reduce((sum, item) => sum + item.quantity * item.price, 0);

        // Validate stock before creating order
        await this.validateStock(dto.items);

        // I atomically create the order and event to prevent data inconsistencies.
        return await this.prisma.$transaction(async (tx) => {

            const order = await tx.order.create({
                data: {
                    id: orderId,
                    customerId: dto.customerId,
                    totalAmount,
                    currency: dto.currency || 'USD',
                    status: OrderStatus.PENDING,
                    shippingStreet: dto.shippingAddress.street,
                    shippingCity: dto.shippingAddress.city,
                    shippingState: dto.shippingAddress.state,
                    shippingZipCode: dto.shippingAddress.zipCode,
                    shippingCountry: dto.shippingAddress.country,
                    idempotencyKey,
                    items: {
                        create: dto.items.map((item) => ({
                            id: IdGenerator.generateEventId(),
                            productId: item.productId,
                            productName: (item as any).productName || 'Unknown Product', // TODO: Fetch from Inventory Service
                            sellerId: item.sellerId,
                            quantity: item.quantity,
                            price: item.price,
                            currency: dto.currency || 'USD',
                        })),
                    },
                },
                include: { items: true },
            });

            // I include the idempotency key so consumers can de-duplicate.
            const event = {
                metadata: {
                    eventId: IdGenerator.generateEventId(),
                    eventType: 'order.created',
                    eventVersion: '1.0',
                    timestamp: new Date().toISOString(),
                    correlationId,
                    causationId: null,
                    source: {
                        service: 'order-service',
                        version: '1.0.0',
                        instance: process.env.HOSTNAME || 'unknown',
                    },
                },
                payload: {
                    orderId: order.id,
                    customerId: order.customerId,
                    items: order.items.map((item) => ({
                        productId: item.productId,
                        productName: (item as any).productName,
                        sellerId: item.sellerId,
                        quantity: item.quantity,
                        price: parseFloat(item.price.toString()),
                        currency: item.currency,
                    })),
                    totalAmount: parseFloat(order.totalAmount.toString()),
                    currency: order.currency,
                    shippingAddress: {
                        street: dto.shippingAddress.street,
                        city: dto.shippingAddress.city,
                        state: dto.shippingAddress.state,
                        zipCode: dto.shippingAddress.zipCode,
                        country: dto.shippingAddress.country,
                    },
                    idempotencyKey: order.idempotencyKey,
                    createdAt: order.createdAt.toISOString(),
                },
            };

            // I write to the outbox (unpublished) for the worker to pick up.
            await tx.outbox.create({
                data: {
                    eventId: event.metadata.eventId,
                    eventType: 'order.created',
                    aggregateType: 'order',
                    aggregateId: order.id,
                    payload: event as any,
                    published: false,
                },
            });

            // Add audit log entry
            await tx.orderEvent.create({
                data: {
                    orderId: order.id,
                    eventType: 'order.created',
                    eventData: {
                        customerId: order.customerId,
                        totalAmount: parseFloat(order.totalAmount.toString()),
                        itemCount: order.items.length,
                    },
                },
            });

            this.logger.log('Order created and event stored in outbox', {
                orderId: order.id,
                eventId: event.metadata.eventId,
                correlationId,
            });

            return order;
        });
    }

    async listOrders(params: {
        customerId?: string;
        status?: string;
        limit?: number;
        offset?: number;
        identity?: { sub: string; role: string } | null;
    }): Promise<{ orders: any[]; total: number }> {
        const { customerId, status, limit = 50, offset = 0, identity } = params;
        const where: any = {};

        // Apply role-based scoping
        if (identity) {
            if (identity.role === 'USER') {
                // USERs can only see their own orders
                where.customerId = identity.sub;
            } else if (identity.role === 'SELLER') {
                // SELLERs see orders containing their products
                where.items = { some: { sellerId: identity.sub } };
                if (customerId) {
                    where.customerId = customerId;
                }
            }
            // ADMIN: no filtering, sees all
        } else if (customerId) {
            // Fallback for unauthenticated or legacy requests
            where.customerId = customerId;
        }

        if (status) {
            where.status = status;
        }

        const [orders, total] = await this.prisma.$transaction([
            this.prisma.order.findMany({
                where,
                include: { items: true },
                take: limit,
                skip: offset,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.order.count({ where }),
        ]);

        return { orders, total };
    }

    async transitionToCancelled(
        orderId: string,
        reason: string,
        cancelledBy: string,
        correlationId: string,
    ): Promise<void> {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: { items: true },
        });

        if (!order) {
            throw new OrderNotFoundException(orderId);
        }

        const validTransitions = ['PENDING', 'CONFIRMED', 'PAYMENT_PENDING', 'PAID'];
        if (!validTransitions.includes(order.status)) {
            throw new InvalidOrderStateException(
                orderId,
                order.status,
                validTransitions.join(', '),
            );
        }

        const refundRequired = order.status === 'PAID';

        // I update status and queue the cancellation event atomically.
        await this.prisma.$transaction(async (tx) => {

            await tx.order.update({
                where: { id: orderId },
                data: {
                    status: OrderStatus.CANCELLED,
                    cancelledAt: new Date(),
                },
            });


            const event = {
                metadata: {
                    eventId: IdGenerator.generateEventId(),
                    eventType: 'order.cancelled',
                    eventVersion: '1.0',
                    timestamp: new Date().toISOString(),
                    correlationId,
                    causationId: null,
                    source: {
                        service: 'order-service',
                        version: '1.0.0',
                        instance: process.env.HOSTNAME || 'unknown',
                    },
                },
                payload: {
                    orderId: order.id,
                    customerId: order.customerId,
                    cancellationReason: reason,
                    cancelledBy,
                    refundRequired,
                    previousStatus: order.status,
                    cancelledAt: new Date().toISOString(),
                },
            };

            // I queue the event in the outbox.
            await tx.outbox.create({
                data: {
                    eventId: event.metadata.eventId,
                    eventType: 'order.cancelled',
                    aggregateType: 'order',
                    aggregateId: order.id,
                    payload: event as any,
                    published: false,
                },
            });

            // Audit entry
            await tx.orderEvent.create({
                data: {
                    orderId: order.id,
                    eventType: 'order.cancelled',
                    eventData: {
                        reason,
                        cancelledBy,
                        refundRequired,
                    },
                },
            });

            this.logger.log('Order cancelled and event stored in outbox', {
                orderId: order.id,
                reason,
                refundRequired,
                correlationId,
            });
        });
    }

    async transitionToConfirmed(orderId: string, correlationId: string): Promise<void> {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
        });

        if (!order) {
            throw new OrderNotFoundException(orderId);
        }

        if (order.status !== OrderStatus.PENDING) {
            throw new InvalidOrderStateException(orderId, order.status, 'PENDING');
        }

        // Transition: PENDING → CONFIRMED → PAYMENT_PENDING
        await this.prisma.$transaction(async (tx) => {
            await tx.order.update({
                where: { id: orderId },
                data: { status: OrderStatus.PAYMENT_PENDING },
            });

            await tx.orderEvent.create({
                data: {
                    orderId,
                    eventType: 'order.confirmed',
                    eventData: { previousStatus: 'PENDING' },
                },
            });

            this.logger.log('Order confirmed (PAYMENT_PENDING)', {
                orderId,
                correlationId,
            });
        });
    }

    async transitionToPaid(orderId: string, correlationId: string): Promise<void> {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
        });

        if (!order) {
            throw new OrderNotFoundException(orderId);
        }

        if (order.status !== OrderStatus.PAYMENT_PENDING) {
            throw new InvalidOrderStateException(orderId, order.status, 'PAYMENT_PENDING');
        }

        await this.prisma.$transaction(async (tx) => {
            await tx.order.update({
                where: { id: orderId },
                data: { status: OrderStatus.PAID },
            });

            await tx.orderEvent.create({
                data: {
                    orderId,
                    eventType: 'order.paid',
                    eventData: { previousStatus: 'PAYMENT_PENDING' },
                },
            });

            this.logger.log('Order paid', {
                orderId,
                correlationId,
            });
        });
    }

    async transitionToPaymentFailed(orderId: string, reason: string, correlationId: string): Promise<void> {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
        });

        if (!order) {
            throw new OrderNotFoundException(orderId);
        }

        if (order.status !== OrderStatus.PAYMENT_PENDING) {
            // If already CANCELLED or FAILED, ignore
            if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.PAYMENT_FAILED) {
                this.logger.warn(`Order ${orderId} already in terminal state ${order.status}, ignoring payment failure`, { correlationId });
                return;
            }
            throw new InvalidOrderStateException(orderId, order.status, 'PAYMENT_PENDING');
        }

        await this.prisma.$transaction(async (tx) => {
            await tx.order.update({
                where: { id: orderId },
                data: { status: OrderStatus.PAYMENT_FAILED },
            });

            await tx.orderEvent.create({
                data: {
                    orderId,
                    eventType: 'order.payment_failed',
                    eventData: { reason },
                },
            });

            this.logger.warn(`Order payment failed: ${reason}`, {
                orderId,
                correlationId,
            });
        });
    }

    async transitionToFulfilled(orderId: string, correlationId: string): Promise<void> {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: { items: true },
        });

        if (!order) {
            throw new OrderNotFoundException(orderId);
        }

        if (order.status !== OrderStatus.PAID) {
            throw new InvalidOrderStateException(orderId, order.status, 'PAID');
        }

        await this.prisma.$transaction(async (tx) => {
            await tx.order.update({
                where: { id: orderId },
                data: { status: OrderStatus.FULFILLED },
            });

            await tx.orderEvent.create({
                data: {
                    orderId,
                    eventType: 'order.fulfilled',
                    eventData: { previousStatus: 'PAID' },
                },
            });

            // Create outbox event for Kafka (THIS WAS MISSING!)
            const event = {
                metadata: {
                    eventId: IdGenerator.generateEventId(),
                    eventType: 'order.fulfilled',
                    eventVersion: '1.0',
                    timestamp: new Date().toISOString(),
                    correlationId,
                    causationId: null,
                    source: {
                        service: 'order-service',
                        version: '1.0.0',
                        instance: process.env.HOSTNAME || 'unknown',
                    },
                },
                payload: {
                    orderId: order.id,
                    customerId: order.customerId,
                    items: order.items.map((item) => ({
                        productId: item.productId,
                        sellerId: item.sellerId,
                        quantity: item.quantity,
                        price: item.price,
                    })),
                    totalAmount: order.totalAmount,
                    previousStatus: 'PAID',
                },
            };

            await tx.outbox.create({
                data: {
                    eventId: event.metadata.eventId,
                    aggregateId: orderId,
                    aggregateType: 'Order',
                    eventType: 'order.fulfilled',
                    payload: event as any,
                    published: false,
                },
            });

            this.logger.log('Order fulfilled and event stored in outbox', {
                orderId,
                correlationId,
            });
        });
    }

    async getOrderById(orderId: string): Promise<any> {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                items: true,
                events: {
                    orderBy: { occurredAt: 'asc' },
                },
            },
        });

        if (!order) {
            throw new OrderNotFoundException(orderId);
        }

        return order;
    }

    private async validateStock(items: { productId: string; quantity: number }[]): Promise<void> {
        const inventoryUrl = this.configService.get('INVENTORY_SERVICE_URL', 'http://localhost:3002/api/v1/inventory');
        try {
            await firstValueFrom(
                this.httpService.post(`${inventoryUrl}/validate`, items)
            );
        } catch (error: any) {
            this.logger.error(`Stock validation failed: ${error.message}`, JSON.stringify(error.response?.data));
            if (error.response?.status === 400) {
                // Propagate the specific validation error
                throw new BadRequestException(error.response.data.message || 'Stock validation failed');
            }
            // For other errors (e.g. connection refused), throw generic or service unavailable
            throw new Error('Could not validate stock: Service unavailable');
        }
    }

}
