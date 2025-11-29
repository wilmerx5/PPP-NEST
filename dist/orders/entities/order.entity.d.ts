import { OrderItem } from './order-item.entity';
export type OrderType = 'delivery' | 'pickup' | 'table' | 'counter';
export type OrderStatus = 'cooking' | 'cooked' | 'packing' | 'canceled' | 'inDelivery' | 'completed';
export declare class Order {
    id: number;
    customerName: string;
    phone: string;
    address: string;
    createdAt: Date;
    items: OrderItem[];
    dailyOrderNumber: number;
    orderType: OrderType;
    orderStatus: OrderStatus;
    printed: boolean;
}
