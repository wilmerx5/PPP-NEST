import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';
export declare class ProductsController {
    private readonly productsService;
    constructor(productsService: ProductsService);
    create(createProductDto: CreateProductDto): string;
    getAllProducts(): Promise<{
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
        categories: import("./entities/category.entity").Category[];
        orderItems: import("../orders/entities/order-item.entity").OrderItem[];
    }[]>;
    getProductsByCategory(): Promise<{
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
    findOne(id: string): string;
    update(id: string, updateProductDto: UpdateProductDto): string;
    remove(id: string): string;
}
