import { v4 as uuidv4 } from 'uuid';

export class IdGenerator {
    static generateCorrelationId(): string {
        return `corr_${uuidv4()}`;
    }

    static generateTraceId(): string {
        return `trace_${uuidv4()}`;
    }

    static generateEventId(): string {
        return `evt_${Date.now()}_${uuidv4().split('-')[0]}`;
    }

    static generateOrderId(): string {
        return `ord_${Date.now()}_${uuidv4().split('-')[0]}`;
    }

    static generatePaymentId(): string {
        return `pay_${Date.now()}_${uuidv4().split('-')[0]}`;
    }

    static generateReservationId(): string {
        return `res_${Date.now()}_${uuidv4().split('-')[0]}`;
    }
}
