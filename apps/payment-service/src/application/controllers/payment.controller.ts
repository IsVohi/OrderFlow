import { Controller, Post, Body } from '@nestjs/common';
import { PaymentService } from '../../application/services/payment.service';

@Controller('api/v1/payments')
export class PaymentController {
    constructor(
        private readonly paymentService: PaymentService,
    ) { }

    @Post()
    async createPayment(@Body() body: any) {
        // Validation skipped for MVP speed
        return this.paymentService.processPayment(body);
    }
}
