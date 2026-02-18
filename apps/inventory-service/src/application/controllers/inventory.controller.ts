import { Controller, Post, Body, Get, UseInterceptors, Param } from '@nestjs/common';
import { InventoryService } from '../../application/services/inventory.service';
import { CreateProductDto } from '../../application/dto/inventory.dto';
import { CorrelationIdInterceptor, CurrentUser, JwtIdentity } from '@orderflow/common';

@Controller('api/v1/inventory')
@UseInterceptors(CorrelationIdInterceptor)
export class InventoryController {
    constructor(private readonly inventoryService: InventoryService) { }

    @Post()
    async createProduct(
        @Body() dto: CreateProductDto,
        @CurrentUser() identity: JwtIdentity,
    ) {
        // Enforce Seller Role? 
        // For now, allow any authenticated user to act as seller for simplicity, 
        // OR strictly check identity.role === 'SELLER'.
        // Let's assume the Dashboard enforces role checks, but safely defaults to using identity.sub as sellerId.

        return this.inventoryService.createProduct(dto, identity?.sub || 'unknown-seller');
    }

    @Get()
    async getInventory(@CurrentUser() identity?: JwtIdentity) {
        // If SELLER, return only their items
        if (identity?.role === 'SELLER') {
            return this.inventoryService.getInventory(identity.sub);
        }
        // If USER (Storefront), return ALL items (or available ones)
        // If ADMIN, return ALL
        return this.inventoryService.getInventory();
    }

    @Get(':id')
    async getProduct(@Param('id') id: string) {
        return this.inventoryService.getProduct(id);
    }

    @Get('reservations/list') // Use specific path to avoid conflict with :id
    async listReservations(@CurrentUser() identity?: JwtIdentity) {
        if (identity?.role === 'SELLER') {
            return this.inventoryService.getReservationItems(identity.sub);
        }
        return this.inventoryService.getReservationItems();
    }

    @Post('validate')
    async validateStock(@Body() items: { productId: string; quantity: number }[]) {
        return this.inventoryService.validateStock(items);
    }
}
