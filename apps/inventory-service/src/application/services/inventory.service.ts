import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';
import { CreateProductDto } from '../dto/inventory.dto';
import { AppLogger } from '@orderflow/logger';
import { Prisma } from '../../generated/client'; // Import Prisma namespace

@Injectable()
export class InventoryService {
    constructor(
        private prisma: PrismaService,
        private logger: AppLogger,
    ) { }

    async createProduct(dto: CreateProductDto, sellerId: string): Promise<any> {
        this.logger.log('Creating product', { productId: dto.id, sellerId });

        // Check if product existing logic...

        return this.prisma.inventory.create({
            data: {
                productId: dto.id,
                sellerId,
                name: dto.name,
                description: dto.description,
                price: dto.price,
                imageUrl: dto.imageUrl,
                quantityAvailable: dto.totalStock,
                quantityReserved: 0,
                warehouseId: 'default-warehouse',
            },
        });
    }

    async getInventory(sellerId?: string) {
        if (sellerId) {
            return this.prisma.inventory.findMany({
                where: { sellerId },
                orderBy: { createdAt: 'desc' }
            });
        }
        return this.prisma.inventory.findMany({
            orderBy: { createdAt: 'desc' }
        });
    }

    async reserveInventory(data: { productId: string; quantity: number; orderId: string }, tx?: Prisma.TransactionClient) {
        this.logger.log(`Reserving ${data.quantity} of ${data.productId} for order ${data.orderId}`);

        const run = async (client: Prisma.TransactionClient) => {
            // Idempotency: Check if reservation already exists
            this.logger.log(`[Idempotency] Checking partial existence for orderId: '${data.orderId}'`);

            // Use findFirst to be safe
            const existingReservation = await client.reservation.findFirst({
                where: { orderId: data.orderId },
            });

            this.logger.log(`[Idempotency] Result for '${data.orderId}': ${existingReservation ? 'FOUND (' + existingReservation.id + ')' : 'NOT FOUND'}`);

            if (existingReservation) {
                this.logger.log(`Reservation already exists for ${data.orderId}, skipping creation`);
                return { success: true, reservationId: existingReservation.id };
            }

            const product = await client.inventory.findUnique({
                where: { productId: data.productId },
            });

            if (!product) {
                throw new NotFoundException(`Product ${data.productId} not found`);
            }

            if (product.quantityAvailable - product.quantityReserved < data.quantity) {
                throw new BadRequestException(`Insufficient stock for ${data.productId}`);
            }

            // 1. Update Inventory (Increase Reserved)
            await client.inventory.update({
                where: { productId: data.productId },
                data: {
                    quantityReserved: { increment: data.quantity },
                },
            });

            // 2. Create Reservation
            const reservationId = `res_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            const reservation = await client.reservation.create({
                data: {
                    id: reservationId,
                    orderId: data.orderId,
                    status: 'RESERVED',
                    expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 mins expiry
                    items: {
                        create: {
                            productId: data.productId,
                            quantityRequested: data.quantity,
                            quantityReserved: data.quantity,
                            warehouseId: product.warehouseId,
                        },
                    },
                },
            });

            this.logger.log(`Reservation created: ${reservation.id} for order ${data.orderId}`);
            return { success: true, reservationId: reservation.id };
        };

        if (tx) {
            return run(tx);
        } else {
            return this.prisma.$transaction(run);
        }
    }

    async releaseInventory(data: { productId: string; quantity: number; orderId: string }, tx?: Prisma.TransactionClient) {
        this.logger.log(`Releasing inventory for order ${data.orderId}`);

        const run = async (client: Prisma.TransactionClient) => {
            const reservation = await client.reservation.findUnique({
                where: { orderId: data.orderId },
                include: { items: true },
            });

            if (!reservation) {
                this.logger.warn(`Reservation not found for order ${data.orderId}, skipping release`);
                return { success: false, message: 'Reservation not found' };
            }

            if (reservation.status !== 'RESERVED') {
                this.logger.warn(`Reservation ${reservation.id} status is ${reservation.status}, skipping release`);
                return { success: false, message: 'Reservation already processed' };
            }

            // 1. Update Inventory (Decrease Reserved)
            for (const item of reservation.items) {
                await client.inventory.update({
                    where: { productId: item.productId },
                    data: {
                        quantityReserved: { decrement: item.quantityReserved },
                    },
                });
            }

            // 2. Update Reservation Status
            await client.reservation.update({
                where: { id: reservation.id },
                data: { status: 'RELEASED' }, // or EXPIRED based on context
            });

            this.logger.log(`Reservation ${reservation.id} released`);
            return { success: true };
        };

        if (tx) {
            return run(tx);
        } else {
            return this.prisma.$transaction(run);
        }
    }

    async commitInventory(data: { productId: string; quantity: number; orderId: string }, tx?: Prisma.TransactionClient) {
        this.logger.log(`Committing inventory for order ${data.orderId}`);

        const run = async (client: Prisma.TransactionClient) => {
            // Find the reservation first given the orderId
            const reservation = await client.reservation.findUnique({
                where: { orderId: data.orderId },
                include: { items: true },
            });

            // If reservation exists, commit it
            if (reservation && reservation.status === 'RESERVED') {
                // 1. Update Inventory (Decrease Available AND Reserved)
                for (const item of reservation.items) {
                    await client.inventory.update({
                        where: { productId: item.productId },
                        data: {
                            quantityAvailable: { decrement: item.quantityReserved },
                            quantityReserved: { decrement: item.quantityReserved },
                        },
                    });
                }

                // 2. Update Reservation Status
                await client.reservation.update({
                    where: { id: reservation.id },
                    data: { status: 'COMMITTED' },
                });

                this.logger.log(`Reservation ${reservation.id} committed`);
                return { success: true };
            }

            // Fallback: If no reservation exists (direct fulfillment?), just reduce stock
            this.logger.warn(`No active reservation found for order ${data.orderId}, performing direct stock deduction`);

            const product = await client.inventory.findUnique({
                where: { productId: data.productId },
            });

            if (!product) {
                throw new NotFoundException(`Product ${data.productId} not found`);
            }

            if (product.quantityAvailable < data.quantity) {
                throw new BadRequestException(`Insufficient stock for ${data.productId}`);
            }

            await client.inventory.update({
                where: { productId: data.productId },
                data: {
                    quantityAvailable: { decrement: data.quantity },
                    // Do not touch quantityReserved here as we assume it wasn't reserved
                },
            });

            return { success: true, message: 'Direct deduction performed' };
        };

        if (tx) {
            return run(tx);
        } else {
            return this.prisma.$transaction(run);
        }
    }

    async getProduct(productId: string) {
        const item = await this.prisma.inventory.findUnique({
            where: { productId },
        });
        if (!item) throw new NotFoundException('Product not found');
        return item;
    }

    async getReservationItems(sellerId?: string) {
        let productIds: string[] | undefined;

        if (sellerId) {
            const inventory = await this.prisma.inventory.findMany({
                where: { sellerId },
                select: { productId: true }
            });
            productIds = inventory.map(i => i.productId);
        }

        const items = await this.prisma.reservationItem.findMany({
            where: productIds ? { productId: { in: productIds } } : undefined,
            include: {
                reservation: true,
            },
            orderBy: { id: 'desc' }
        });

        return items.map(item => ({
            id: item.id.toString(),
            orderId: item.reservation.orderId,
            productId: item.productId,
            quantity: item.quantityReserved,
            status: item.reservation.status,
            createdAt: item.reservation.createdAt,
            expiresAt: item.reservation.expiresAt,
        }));
    }

    async validateStock(items: { productId: string; quantity: number }[]): Promise<{ success: boolean; errors?: string[] }> {
        const productIds = items.map(i => i.productId);
        const products = await this.prisma.inventory.findMany({
            where: { productId: { in: productIds } },
        });

        const productMap = new Map(products.map(p => [p.productId, p]));
        const errors: string[] = [];

        for (const item of items) {
            const product = productMap.get(item.productId);
            if (!product) {
                errors.push(`Product ${item.productId} not found`);
                continue;
            }

            if (product.quantityAvailable - product.quantityReserved < item.quantity) {
                errors.push(`Insufficient stock for product ${product.name} (ID: ${item.productId}). Requested: ${item.quantity}, Available: ${product.quantityAvailable - product.quantityReserved}`);
            }
        }

        if (errors.length > 0) {
            throw new BadRequestException(`Stock validation failed: ${errors.join('; ')}`);
        }

        return { success: true };
    }
}
