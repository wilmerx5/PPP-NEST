import { OrderItem } from 'src/orders/entities/order-item.entity';
import { Category } from './category.entity';
import { ProductAttribute } from './product-attribute.entity';
import { ProductVariantStock } from './product-variant-stock.entity';
import { ProductSchedule } from './product-schedule.entity';
export declare class Product {
    id: number;
    name: string;
    description?: string;
    price: number;
    hasAttributes: boolean;
    code: number;
    isActive: boolean;
    trackInventory: boolean;
    stock: number;
    attributes: ProductAttribute[];
    variantStocks: ProductVariantStock[];
    hasSchedule: boolean;
    schedules: ProductSchedule[];
    categories: Category[];
    orderItems: OrderItem[];
    imageUrl: string;
    alsoDeductProductId?: number | null;
    alsoDeductAttributeName?: string | null;
    alsoDeductAttributeValue?: string | null;
    alsoDeductBaseUnits?: number | null;
}
