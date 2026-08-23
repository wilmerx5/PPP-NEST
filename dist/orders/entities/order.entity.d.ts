import { OrderItem } from './order-item.entity';
import { OrderExtra } from './order-extra.entity';
export type OrderType = 'delivery' | 'pickup' | 'table' | 'counter' | 'rappi';
export type OrderSource = 'online' | 'internal' | 'whatsapp';
export type OrderStatus = 'pending' | 'cooking' | 'cooked' | 'packing' | 'inDelivery' | 'completed' | 'canceled';
export declare class Order {
    id: number;
    customerName: string;
    phone: string;
    address: string;
    customerEmail?: string | null;
    createdAt: Date;
    items: OrderItem[];
    dailyOrderNumber: number;
    orderType: OrderType;
    orderStatus: OrderStatus;
    deliveryFee: number;
    printed: boolean;
    orderSource: OrderSource;
    points: number;
    redemptionCode: string | null;
    tableGroupId: number | null;
    clientRequestId: string | null;
    extras?: OrderExtra[];
}
