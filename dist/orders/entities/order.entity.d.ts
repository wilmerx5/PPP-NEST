import { OrderItem } from './order-item.entity';
export type OrderType = 'delivery' | 'pickup' | 'table' | 'counter';
export declare class Order {
    id: number;
    customerName: string;
    phone: string;
    address: string;
    createdAt: Date;
    items: OrderItem[];
    dailyOrderNumber: number;
    orderType: OrderType;
    printed: boolean;
}
