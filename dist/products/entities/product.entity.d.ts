import { Category } from './category.entity';
import { OrderItem } from 'src/orders/entities/order-item.entity';
import { ProductAttribute } from './product-attribute.entity';
export declare class Product {
    id: number;
    name: string;
    description?: string;
    price: number;
    hasAttributes: boolean;
    code: number;
    attributes: ProductAttribute[];
    categories: Category[];
    orderItems: OrderItem[];
    imageUrl: string;
}
