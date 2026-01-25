import { User } from './entities/user.entity';
import { Request } from 'express';
import { PointsService } from './services/points.service';
import { Repository } from 'typeorm';
import { UserPoints } from './entities/user-points.entity';
import { OrdersService } from '../orders/orders.service';
export declare class AdminController {
    private readonly pointsService;
    private readonly ordersService;
    private readonly userRepo;
    private readonly pointsRepo;
    constructor(pointsService: PointsService, ordersService: OrdersService, userRepo: Repository<User>, pointsRepo: Repository<UserPoints>);
    getAllUsers(): Promise<User[]>;
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
