import { Order } from './order.entity';
export declare class OrderExtra {
    id: number;
    order: Order;
    title: string;
    description: string | null;
    amount: number;
    quantity: number;
    createdAt: Date;
}
