import { Order } from '../../orders/entities/order.entity';
export type PaymentStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'refunded';
export declare class Payment {
    id: number;
    orderId: number | null;
    order: Order;
    preferenceId: string;
    paymentId: string;
    status: PaymentStatus;
    amount: number;
    metadata: string;
    createdAt: Date;
    updatedAt: Date;
}
