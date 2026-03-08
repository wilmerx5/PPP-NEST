import { User } from './entities/user.entity';
import { Request } from 'express';
import { PointsService } from './services/points.service';
import { Repository } from 'typeorm';
import { UserPoints } from './entities/user-points.entity';
import { OrdersService } from '../orders/orders.service';
import { ProductsService } from '../products/products.service';
import { ExpensesService } from '../expenses/expenses.service';
export declare class AdminController {
    private readonly pointsService;
    private readonly ordersService;
    private readonly productsService;
    private readonly expensesService;
    private readonly userRepo;
    private readonly pointsRepo;
    constructor(pointsService: PointsService, ordersService: OrdersService, productsService: ProductsService, expensesService: ExpensesService, userRepo: Repository<User>, pointsRepo: Repository<UserPoints>);
    getAllUsers(page?: string, limit?: string, search?: string): Promise<{
        data: User[];
        total: number;
    }>;
    updateUserActive(id: string, body: {
        isActive: boolean;
    }): Promise<{
        success: boolean;
        message: string;
        user: {
            id: string;
            email: string;
            fullName: string;
            isActive: boolean;
        };
    }>;
    createPoints(req: Request, body: {
        pointsCount: number;
        description?: string;
    }): Promise<{
        success: boolean;
        message: string;
        points: UserPoints[];
        pointCodes: string[];
    }>;
    getUserPoints(userId: string): Promise<{
        totalPoints: number;
        availablePoints: number;
        history: UserPoints[];
    }>;
    getOrdersByDate(date: string): Promise<any[]>;
    getDailySummary(date?: string): Promise<any>;
    backfillOrderItemsUnitPrices(): Promise<{
        success: boolean;
        updated: number;
    }>;
    getSalesReport(from?: string, to?: string, period?: string): Promise<any>;
    getAllProducts(): Promise<{
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
            product: import("../products/entities/product.entity").Product;
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
        categories: import("../products/entities/category.entity").Category[];
        orderItems: import("../orders/entities/order-item.entity").OrderItem[];
        imageUrl: string;
        alsoDeductProductId?: number | null;
        alsoDeductAttributeName?: string | null;
        alsoDeductAttributeValue?: string | null;
        alsoDeductBaseUnits?: number | null;
    }[]>;
    updateProductActive(id: string, body: {
        isActive: boolean;
    }): Promise<{
        success: boolean;
        product: {
            id: number;
            isActive: boolean;
        };
    }>;
    adjustProductInventory(id: string, body: {
        delta: number;
    }): Promise<{
        success: boolean;
        stock: number;
    }>;
    adjustProductVariantInventory(id: string, body: {
        attributeName: string;
        attributeValue: string;
        delta: number;
    }): Promise<{
        success: boolean;
        stock: number;
    }>;
    getInventoryGroups(): Promise<{
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
    }[]>;
    createInventoryGroup(body: {
        name: string;
    }): Promise<import("../products/entities/inventory-group.entity").InventoryGroup>;
    updateInventoryGroup(id: string, body: {
        name: string;
    }): Promise<{
        success: boolean;
    }>;
    deleteInventoryGroup(id: string): Promise<{
        success: boolean;
    }>;
    addInventoryGroupItem(id: string, body: {
        productId: number;
        baseUnits: number;
        attributeName?: string;
        attributeValue?: string;
    }): Promise<import("../products/entities/inventory-group-item.entity").InventoryGroupItem>;
    removeInventoryGroupItem(id: string, productId: string, attributeName?: string, attributeValue?: string): Promise<{
        success: boolean;
    }>;
    setGroupItemAlsoDeduct(id: string, body: {
        productId: number;
        attributeName?: string;
        attributeValue?: string;
        alsoDeductProductId?: number | null;
        alsoDeductAttributeName?: string | null;
        alsoDeductAttributeValue?: string | null;
        alsoDeductBaseUnits?: number | null;
    }): Promise<{
        success: boolean;
    }>;
    createSelection(id: string, body: {
        productId: number;
        attributeName?: string;
        attributeValue?: string;
        name: string;
    }): Promise<import("../products/entities/inventory-selection.entity").InventorySelection>;
    updateSelection(selectionId: string, body: {
        name: string;
    }): Promise<void>;
    deleteSelection(selectionId: string): Promise<void>;
    addProductToSelection(selectionId: string, body: {
        productId: number;
        baseUnits?: number;
        sortOrder?: number;
    }): Promise<import("../products/entities/inventory-selection-product.entity").InventorySelectionProduct>;
    removeProductFromSelection(selectionId: string, productId: string): Promise<void>;
    adjustInventoryGroupStock(id: string, body: {
        delta: number;
    }): Promise<{
        success: boolean;
        stock: number;
    }>;
    getPointsSummary(date?: string, from?: string, to?: string, allTime?: string): Promise<{
        total: number;
        used: number;
        unused: number;
    }>;
    getPointsRecords(date?: string, from?: string, to?: string): Promise<{
        records: {
            id: number;
            code: string;
            userId: string | null;
            user: {
                id: string;
                fullName: string;
                email: string;
            } | null;
            orderId: number | null;
            orderDailyNumber: number | null;
            orderCreatedAt: string | null;
            type: "admin" | "automatic" | "manual";
            isUsed: boolean;
            isCanceled: boolean;
            isRedeemed: boolean;
            description: string | null;
            createdAt: string;
        }[];
        total: number;
    }>;
    searchPointByCode(code: string): Promise<{
        records: {
            id: number;
            code: string;
            userId: string | null;
            user: {
                id: string;
                fullName: string;
                email: string;
            } | null;
            orderId: number | null;
            orderDailyNumber: number | null;
            orderCreatedAt: string | null;
            type: "admin" | "automatic" | "manual";
            isUsed: boolean;
            isCanceled: boolean;
            isRedeemed: boolean;
            description: string | null;
            createdAt: string;
        }[];
    }>;
    invalidatePoint(id: string): Promise<{
        success: boolean;
        message: string;
        point: {
            id: number;
            code: string;
            isCanceled: boolean;
        };
    }>;
    redeemPoint(id: string): Promise<{
        success: boolean;
        message: string;
        point: {
            id: number;
            code: string;
            isRedeemed: boolean;
        };
    }>;
    getExpenseCategories(): {
        categories: string[];
    };
    createExpense(body: {
        category: string;
        name: string;
        amount: number;
        expenseDate: string;
    }): Promise<{
        success: boolean;
        expense: import("../expenses/entities/expense.entity").Expense;
    }>;
    getExpenses(from: string, to: string): Promise<{
        expenses: import("../expenses/entities/expense.entity").Expense[];
    }>;
    deleteExpense(id: string): Promise<{
        success: boolean;
    }>;
    getExpensesStats(from: string, to: string): Promise<{
        period: {
            from: string;
            to: string;
        };
        sales: {
            total: any;
            totalOrders: any;
            totals: any;
        };
        expenses: {
            total: number;
            count: number;
            list: import("../expenses/entities/expense.entity").Expense[];
        };
        net: number;
    }>;
    getLeaderboard(limit?: string, offset?: string, search?: string): Promise<{
        users: Array<{
            userId: string;
            fullName: string;
            email: string;
            phone: string | null;
            totalPoints: number;
            availablePoints: number;
            redeemedPoints: number;
            rank: number;
        }>;
        total: number;
    }>;
}
