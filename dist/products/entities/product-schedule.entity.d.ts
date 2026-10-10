import { Product } from './product.entity';
export declare class ProductSchedule {
    id: number;
    productId: number;
    dayOfWeek: number;
    startTime?: string | null;
    endTime?: string | null;
    product: Product;
}
