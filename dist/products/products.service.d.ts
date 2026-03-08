import { EntityManager, Repository } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Category } from './entities/category.entity';
import { Product } from './entities/product.entity';
import { ProductAttribute } from './entities/product-attribute.entity';
import { ProductVariantStock } from './entities/product-variant-stock.entity';
import { InventoryGroup } from './entities/inventory-group.entity';
import { InventoryGroupItem } from './entities/inventory-group-item.entity';
import { InventorySelection } from './entities/inventory-selection.entity';
import { InventorySelectionProduct } from './entities/inventory-selection-product.entity';
import { CacheService } from '../common/cache/cache.service';
import { CircuitBreakerService } from '../common/circuit-breaker/circuit-breaker.service';
export type InventoryInfo = {
    trackInventory: boolean;
    stock: number;
    variantStocks: Array<{
        attributeName: string;
        attributeValue: string;
        stock: number;
    }>;
    groupId?: number;
    groupBaseUnits?: number;
    groupStock?: number;
    variantGroups?: Array<{
        attributeName: string;
        attributeValue: string;
        groupId: number;
        groupBaseUnits: number;
        groupStock: number;
    }>;
    alsoDeductFrom?: Array<{
        productId: number;
        baseUnits: number;
        attributeName?: string;
        attributeValue?: string;
    }>;
};
export declare class ProductsService {
    private readonly productRepo;
    private readonly categoryRepo;
    private readonly attributeRepo;
    private readonly variantStockRepo;
    private readonly inventoryGroupRepo;
    private readonly inventoryGroupItemRepo;
    private readonly selectionRepo;
    private readonly selectionProductRepo;
    private readonly cache;
    private readonly circuitBreaker;
    private readonly CACHE_KEY_ALL;
    private readonly CACHE_KEY_CATEGORIES;
    private readonly CACHE_KEY_GROUPED;
    private readonly CACHE_TTL;
    constructor(productRepo: Repository<Product>, categoryRepo: Repository<Category>, attributeRepo: Repository<ProductAttribute>, variantStockRepo: Repository<ProductVariantStock>, inventoryGroupRepo: Repository<InventoryGroup>, inventoryGroupItemRepo: Repository<InventoryGroupItem>, selectionRepo: Repository<InventorySelection>, selectionProductRepo: Repository<InventorySelectionProduct>, cache: CacheService, circuitBreaker: CircuitBreakerService);
    create(createProductDto: CreateProductDto): string;
    private static buildProductTarget;
    private loadAlsoDeductFromForProductIds;
    findAll(): Promise<any[]>;
    findAllCategories(): Promise<Category[]>;
    findProductsGroupedByCategory(): Promise<any[]>;
    findAllForAdmin(): Promise<{
        inventoryGroup?: {
            groupId: number;
            groupName: string;
            groupStock: number;
            baseUnits: number;
            derivedStock: number;
        } | undefined;
        attributes: {
            options: any;
            id: number;
            attributeName: string;
            product: Product;
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
        categories: Category[];
        orderItems: import("../orders/entities/order-item.entity").OrderItem[];
        imageUrl: string;
        alsoDeductProductId?: number | null;
        alsoDeductAttributeName?: string | null;
        alsoDeductAttributeValue?: string | null;
        alsoDeductBaseUnits?: number | null;
    }[]>;
    updateActive(id: number, isActive: boolean): Promise<{
        success: boolean;
        product: {
            id: number;
            isActive: boolean;
        };
    }>;
    checkByCode(code: number): Promise<{
        exists: boolean;
        isActive?: boolean;
        name?: string;
    }>;
    findOne(id: number): Promise<{
        inventoryGroup?: {
            groupId: number;
            groupName: string;
            groupStock: number;
            baseUnits: number;
            derivedStock: number;
        } | undefined;
        attributes: {
            options: any;
            id: number;
            attributeName: string;
            product: Product;
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
        categories: Category[];
        orderItems: import("../orders/entities/order-item.entity").OrderItem[];
        imageUrl: string;
        alsoDeductProductId?: number | null;
        alsoDeductAttributeName?: string | null;
        alsoDeductAttributeValue?: string | null;
        alsoDeductBaseUnits?: number | null;
    } | null>;
    update(id: number, updateProductDto: UpdateProductDto): Promise<{
        attributes: {
            options: any;
            id: number;
            attributeName: string;
            product: Product;
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
        categories: Category[];
        orderItems: import("../orders/entities/order-item.entity").OrderItem[];
        imageUrl: string;
        alsoDeductProductId?: number | null;
        alsoDeductAttributeName?: string | null;
        alsoDeductAttributeValue?: string | null;
        alsoDeductBaseUnits?: number | null;
    }>;
    private syncGroupTrackInventory;
    adjustStock(id: number, delta: number): Promise<{
        success: boolean;
        stock: number;
    }>;
    getInventoryByProductIds(productIds: number[], opts?: {
        includeAlsoDeductTargets?: boolean;
    }): Promise<Map<number, InventoryInfo>>;
    decrementStock(manager: EntityManager, productId: number, quantity: number): Promise<void>;
    incrementStock(manager: EntityManager, productId: number, quantity: number): Promise<void>;
    decrementGroupStock(manager: EntityManager, groupId: number, baseUnits: number): Promise<void>;
    incrementGroupStock(manager: EntityManager, groupId: number, baseUnits: number): Promise<void>;
    decrementVariantStock(manager: EntityManager, productId: number, attributeName: string, attributeValue: string, quantity: number): Promise<void>;
    incrementVariantStock(manager: EntityManager, productId: number, attributeName: string, attributeValue: string, quantity: number): Promise<void>;
    adjustVariantStock(productId: number, attributeName: string, attributeValue: string, delta: number): Promise<{
        success: boolean;
        stock: number;
    }>;
    setVariantStocks(productId: number, attributeName: string, stocks: Array<{
        attributeValue: string;
        stock: number;
    }>): Promise<void>;
    remove(id: number): string;
    findAllInventoryGroups(): Promise<Array<{
        id: number;
        name: string;
        stock: number;
        items: Array<{
            groupItemId: number;
            productId: number;
            productCode: number;
            productName: string;
            baseUnits: number;
            attributeName: string;
            attributeValue: string;
            alsoDeductProductId: number | null;
            alsoDeductAttributeName: string | null;
            alsoDeductAttributeValue: string | null;
            alsoDeductBaseUnits: number | null;
            selections: Array<{
                id: number;
                name: string;
                sortOrder: number;
                products: Array<{
                    productId: number;
                    productName: string;
                    baseUnits: number;
                    sortOrder: number;
                }>;
            }>;
        }>;
    }>>;
    setGroupItemAlsoDeduct(groupId: number, productId: number, attributeName: string | undefined, attributeValue: string | undefined, alsoDeduct: {
        productId: number;
        baseUnits: number;
        attributeName?: string | null;
        attributeValue?: string | null;
    } | null): Promise<void>;
    createInventoryGroup(name: string): Promise<InventoryGroup>;
    updateInventoryGroup(id: number, name: string): Promise<void>;
    deleteInventoryGroup(id: number): Promise<void>;
    addInventoryGroupItem(groupId: number, productId: number, baseUnits: number, attributeName?: string, attributeValue?: string): Promise<InventoryGroupItem>;
    removeInventoryGroupItem(groupId: number, productId: number, attributeName?: string, attributeValue?: string): Promise<void>;
    adjustGroupStock(groupId: number, delta: number): Promise<{
        success: boolean;
        stock: number;
    }>;
    createSelection(groupId: number, productId: number, name: string, attributeName?: string, attributeValue?: string): Promise<InventorySelection>;
    updateSelection(selectionId: number, name: string): Promise<void>;
    deleteSelection(selectionId: number): Promise<void>;
    addProductToSelection(selectionId: number, productId: number, baseUnits?: number, sortOrder?: number): Promise<InventorySelectionProduct>;
    removeProductFromSelection(selectionId: number, productId: number): Promise<void>;
}
