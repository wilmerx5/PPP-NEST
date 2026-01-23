import { Repository } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Category } from './entities/category.entity';
import { Product } from './entities/product.entity';
import { ProductAttribute } from './entities/product-attribute.entity';
export declare class ProductsService {
    private readonly productRepo;
    private readonly categoryRepo;
    private readonly attributeRepo;
    constructor(productRepo: Repository<Product>, categoryRepo: Repository<Category>, attributeRepo: Repository<ProductAttribute>);
    create(createProductDto: CreateProductDto): string;
    findAll(): Promise<{
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
    }[]>;
    findAllCategories(): Promise<Category[]>;
    findProductsGroupedByCategory(): Promise<{
        categoryId: number;
        categoryName: string;
        imageUrl: string;
        products: {
            id: number;
            name: string;
            description: string | undefined;
            code: number;
            price: number;
            imageUrl: string;
            hasAttributes: boolean;
            attributes: {
                attributeName: string;
                options: any;
            }[];
        }[];
    }[]>;
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
