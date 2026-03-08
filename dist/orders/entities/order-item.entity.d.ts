import { Product } from 'src/products/entities/product.entity';
import { OrderItemAttribute } from './order-item-attribute.entity';
import { Order } from './order.entity';
export declare class OrderItem {
    id: number;
    order: Order;
    product: Product;
    unitPrice?: number | null;
    attributes: OrderItemAttribute[];
    note?: string;
    kitchenPreparedAt?: Date | null;
}
