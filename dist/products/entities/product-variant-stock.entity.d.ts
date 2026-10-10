import { Product } from './product.entity';
export declare class ProductVariantStock {
    id: number;
    productId: number;
    product: Product;
    attributeName: string;
    attributeValue: string;
    stock: number;
}
