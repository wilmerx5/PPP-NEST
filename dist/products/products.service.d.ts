import { Repository } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Category } from './entities/category.entity';
import { Product } from './entities/product.entity';
import { ProductAttribute } from './entities/product-attribute.entity';
import { CacheService } from '../common/cache/cache.service';
import { CircuitBreakerService } from '../common/circuit-breaker/circuit-breaker.service';
export declare class ProductsService {
    private readonly productRepo;
    private readonly categoryRepo;
    private readonly attributeRepo;
    private readonly cache;
    private readonly circuitBreaker;
    private readonly CACHE_KEY_ALL;
    private readonly CACHE_KEY_CATEGORIES;
    private readonly CACHE_KEY_GROUPED;
    private readonly CACHE_TTL;
    constructor(productRepo: Repository<Product>, categoryRepo: Repository<Category>, attributeRepo: Repository<ProductAttribute>, cache: CacheService, circuitBreaker: CircuitBreakerService);
    create(createProductDto: CreateProductDto): string;
    findAll(): Promise<any[]>;
    findAllCategories(): Promise<Category[]>;
    findProductsGroupedByCategory(): Promise<any[]>;
    findOne(id: number): Promise<{
        attributes: {
            options: any;
            id: number;
            attributeName: string;
            product: Product;
        }[];
        id: number;
        name: string;
        description?: string;
        price: number;
        hasAttributes: boolean;
        code: number;
        categories: Category[];
        orderItems: import("../orders/entities/order-item.entity").OrderItem[];
        imageUrl: string;
    } | null>;
    update(id: number, updateProductDto: UpdateProductDto): Promise<{
        attributes: {
            options: any;
            id: number;
            attributeName: string;
            product: Product;
        }[];
        id: number;
        name: string;
        description?: string;
        price: number;
        hasAttributes: boolean;
        code: number;
        categories: Category[];
        orderItems: import("../orders/entities/order-item.entity").OrderItem[];
        imageUrl: string;
    }>;
    remove(id: number): string;
}
