import { PointsService } from './services/points.service';
import { Request } from 'express';
export declare class PointsController {
    private readonly pointsService;
    constructor(pointsService: PointsService);
    getTotalPoints(req: Request): Promise<{
        totalPoints: number;
        userId: string;
    }>;
    getPointsHistory(req: Request): Promise<{
        history: import("./entities/user-points.entity").UserPoints[];
        total: number;
    }>;
    registerPointByCode(req: Request, body: {
        code: string;
    }): Promise<{
        success: boolean;
        message: string;
        pointRecord: import("./entities/user-points.entity").UserPoints;
        newTotal: number;
    }>;
    getAvailablePoints(req: Request): Promise<{
        availablePoints: number;
        totalPoints: number;
        userId: string;
    }>;
    redeemPoints(req: Request): Promise<{
        success: boolean;
        message: string;
        redemption: {
            code: string;
            createdAt: Date;
            expiresAt: Date | null;
        };
        newTotal: number;
        availablePoints: number;
    }>;
    getRedemptions(req: Request): Promise<{
        all: any[];
        active: import("./entities/point-redemption.entity").PointRedemption[];
    }>;
    validateRedemption(req: Request, body: {
        code: string;
    }): Promise<{
        valid: boolean;
        code: string;
        expiresAt: Date | null;
        message: string;
    }>;
}
