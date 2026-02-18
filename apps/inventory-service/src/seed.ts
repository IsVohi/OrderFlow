// apps/inventory-service/src/seed.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { InventoryService } from './application/services/inventory.service';
import { CreateProductDto } from './application/dto/inventory.dto';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const inventoryService = app.get(InventoryService);

    const products: CreateProductDto[] = [
        {
            id: 'prod_real_1',
            name: 'MacBook Pro M3',
            description: 'Latest model with M3 chip',
            price: 1999.00,
            totalStock: 50,
            imageUrl: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&q=80&w=1000'
        },
        {
            id: 'prod_real_2',
            name: 'Mechanical Keyboard',
            description: 'Clicky switches, RGB',
            price: 149.00,
            totalStock: 200,
            imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b91a051?auto=format&fit=crop&q=80&w=1000'
        }
    ];

    for (const p of products) {
        if (!p.description) p.description = ''; // fix optional check
        try {
            await inventoryService.createProduct(p, 'seed-seller-1');
            console.log(`Created ${p.name}`);
        } catch (e: any) {
            console.log(`Skipping ${p.name}: ${e.message}`);
        }
    }

    await app.close();
}
bootstrap();
