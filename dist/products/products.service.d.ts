import { Repository } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Category } from './entities/category.entity';
import { Product } from './entities/product.entity';
export declare class ProductsService {
    private readonly productRepo;
    private readonly categoryRepo;
    constructor(productRepo: Repository<Product>, categoryRepo: Repository<Category>);
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
    }[]>;
    findProductsGroupedByCategory(): Promise<{
        categoryId: number;
        categoryName: string;
        products: {
            id: number;
            name: string;
            description: string | undefined;
            code: number;
            price: number;
            attributes: {
                attributeName: string;
                options: any;
            }[];
        }[];
    }[]>;
    findOne(id: number): string;
    update(id: number, updateProductDto: UpdateProductDto): string;
    remove(id: number): string;
}
