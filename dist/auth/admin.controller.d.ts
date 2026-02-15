import { User } from './entities/user.entity';
import { Request } from 'express';
import { PointsService } from './services/points.service';
import { Repository } from 'typeorm';
import { UserPoints } from './entities/user-points.entity';
import { OrdersService } from '../orders/orders.service';
import { ProductsService } from '../products/products.service';
export declare class AdminController {
    private readonly pointsService;
    private readonly ordersService;
    private readonly productsService;
    private readonly userRepo;
    private readonly pointsRepo;
    constructor(pointsService: PointsService, ordersService: OrdersService, productsService: ProductsService, userRepo: Repository<User>, pointsRepo: Repository<UserPoints>);
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
    getSalesReport(from?: string, to?: string, period?: string): Promise<any>;
    getAllProducts(): Promise<{
        attributes: {
            options: any;
            id: number;
            attributeName: string;
            product: import("../products/entities/product.entity").Product;
        }[];
        id: number;
        name: string;
        description?: string;
        price: number;
        hasAttributes: boolean;
        code: number;
        isActive: boolean;
        categories: import("../products/entities/category.entity").Category[];
        orderItems: import("../orders/entities/order-item.entity").OrderItem[];
        imageUrl: string;
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
