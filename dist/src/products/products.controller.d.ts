import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';
export declare class ProductsController {
    private readonly productsService;
    constructor(productsService: ProductsService);
    create(createProductDto: CreateProductDto): Promise<{
        attributes: {
            options: any;
            id: number;
            attributeName: string;
            product: import("./entities/product.entity").Product;
        }[];
        schedules: {
            id: number;
            dayOfWeek: number;
            startTime: string | null;
            endTime: string | null;
        }[];
        variantStocks: {
            id: number;
            attributeName: string;
            attributeValue: string;
            stock: number;
        }[];
        id: number;
        name: string;
        description?: string;
        price: number;
        hasAttributes: boolean;
        code: number;
        isActive: boolean;
        trackInventory: boolean;
        stock: number;
        hasSchedule: boolean;
        categories: import("./entities/category.entity").Category[];
        orderItems: import("../orders/entities/order-item.entity").OrderItem[];
        imageUrl: string;
        alsoDeductProductId?: number | null;
        alsoDeductAttributeName?: string | null;
        alsoDeductAttributeValue?: string | null;
        alsoDeductBaseUnits?: number | null;
    }>;
    getAllProducts(): Promise<any[]>;
    getAllCategories(): Promise<import("./entities/category.entity").Category[]>;
    getProductsByCategory(): Promise<any[]>;
    checkByCode(code: string): Promise<{
        exists: boolean;
        isActive?: boolean;
        name?: string;
    }>;
    findOne(id: string): Promise<{
        inventoryGroup?: {
            groupId: number;
            groupName: string;
            groupStock: number;
            baseUnits: number;
            derivedStock: number;
        } | undefined;
        availableNow: boolean;
        attributes: {
            options: any;
            id: number;
            attributeName: string;
            product: import("./entities/product.entity").Product;
        }[];
        schedules: {
            id: number;
            dayOfWeek: number;
            startTime: string | null;
            endTime: string | null;
        }[];
        variantStocks: {
            inventoryGroup?: {
                groupId: number;
                groupName: string;
                groupStock: number;
                baseUnits: number;
                derivedStock: number;
            } | undefined;
            id: number;
            attributeName: string;
            attributeValue: string;
            stock: number;
        }[];
        id: number;
        name: string;
        description?: string;
        price: number;
        hasAttributes: boolean;
        code: number;
        isActive: boolean;
        trackInventory: boolean;
        stock: number;
        hasSchedule: boolean;
        categories: import("./entities/category.entity").Category[];
        orderItems: import("../orders/entities/order-item.entity").OrderItem[];
        imageUrl: string;
        alsoDeductProductId?: number | null;
        alsoDeductAttributeName?: string | null;
        alsoDeductAttributeValue?: string | null;
        alsoDeductBaseUnits?: number | null;
    }>;
    update(id: string, updateProductDto: UpdateProductDto): Promise<{
        hasSchedule: boolean;
        schedules: {
            id: number;
            dayOfWeek: number;
            startTime: string | null;
            endTime: string | null;
        }[];
        attributes: {
            options: unknown[];
            id: number;
            attributeName: string;
            product: import("./entities/product.entity").Product;
        }[];
        variantStocks: {
            id: number;
            attributeName: string;
            attributeValue: string;
            stock: number;
        }[];
        id: number;
        name: string;
        description?: string;
        price: number;
        hasAttributes: boolean;
        code: number;
        isActive: boolean;
        trackInventory: boolean;
        stock: number;
        categories: import("./entities/category.entity").Category[];
        orderItems: import("../orders/entities/order-item.entity").OrderItem[];
        imageUrl: string;
        alsoDeductProductId?: number | null;
        alsoDeductAttributeName?: string | null;
        alsoDeductAttributeValue?: string | null;
        alsoDeductBaseUnits?: number | null;
    }>;
    remove(id: string): string;
}
