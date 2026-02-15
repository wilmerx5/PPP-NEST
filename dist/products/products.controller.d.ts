import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';
export declare class ProductsController {
    private readonly productsService;
    constructor(productsService: ProductsService);
    create(createProductDto: CreateProductDto): string;
    getAllProducts(): Promise<any[]>;
    getAllCategories(): Promise<import("./entities/category.entity").Category[]>;
    getProductsByCategory(): Promise<any[]>;
    checkByCode(code: string): Promise<{
        exists: boolean;
        isActive?: boolean;
        name?: string;
    }>;
    findOne(id: string): Promise<{
        attributes: {
            options: any;
            id: number;
            attributeName: string;
            product: import("./entities/product.entity").Product;
        }[];
        id: number;
        name: string;
        description?: string;
        price: number;
        hasAttributes: boolean;
        code: number;
        isActive: boolean;
        categories: import("./entities/category.entity").Category[];
        orderItems: import("../orders/entities/order-item.entity").OrderItem[];
        imageUrl: string;
    }>;
    update(id: string, updateProductDto: UpdateProductDto): Promise<{
        attributes: {
            options: any;
            id: number;
            attributeName: string;
            product: import("./entities/product.entity").Product;
        }[];
        id: number;
        name: string;
        description?: string;
        price: number;
        hasAttributes: boolean;
        code: number;
        isActive: boolean;
        categories: import("./entities/category.entity").Category[];
        orderItems: import("../orders/entities/order-item.entity").OrderItem[];
        imageUrl: string;
    }>;
    remove(id: string): string;
}
