import { Repository, DataSource } from 'typeorm';
import { UserPoints } from '../entities/user-points.entity';
import { PointRedemption } from '../entities/point-redemption.entity';
import { User } from '../entities/user.entity';
import { Product } from '../../products/entities/product.entity';
export declare class PointsService {
    private readonly pointsRepo;
    private readonly redemptionRepo;
    private readonly userRepo;
    private readonly productRepo;
    private readonly dataSource;
    private readonly REDEMPTION_POINTS_REQUIRED;
    constructor(pointsRepo: Repository<UserPoints>, redemptionRepo: Repository<PointRedemption>, userRepo: Repository<User>, productRepo: Repository<Product>, dataSource: DataSource);
    calculatePointsForOrder(items: Array<{
        productId: number;
        quantity: number;
    }>): Promise<number>;
    calculatePointsFromCodes(codes: number[]): number;
    generateUniquePointCode(): Promise<string>;
    createPointsForOrder(userId: string, orderId: number, orderDailyNumber: number, pointsCount: number): Promise<UserPoints[]>;
    registerPointByCode(userId: string, code: string): Promise<UserPoints>;
    assignPointsToUser(userId: string, pointsCount: number, description?: string): Promise<UserPoints[]>;
    getTotalPoints(userId: string): Promise<number>;
    getPointsHistory(userId: string, limit?: number): Promise<UserPoints[]>;
    getPointCodesByOrderId(orderId: number): Promise<string[]>;
    getPointCodesByOrderIds(orderIds: number[]): Promise<Map<number, string[]>>;
    updatePointCodesForOrder(orderId: number, orderDailyNumber: number, newPointsCount: number): Promise<string[]>;
    invalidatePointsForCanceledOrder(orderId: number): Promise<number>;
    getAvailablePoints(userId: string): Promise<number>;
    redeemPointsForVoucher(userId: string): Promise<PointRedemption>;
    generateUniqueRedemptionCode(): Promise<string>;
    validateRedemptionCode(code: string): Promise<PointRedemption>;
    applyRedemptionToOrder(code: string, orderId: number): Promise<PointRedemption>;
    getUserRedemptions(userId: string): Promise<any[]>;
    getActiveRedemptions(userId: string): Promise<PointRedemption[]>;
    getLeaderboard(limit?: number, offset?: number, search?: string): Promise<{
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
