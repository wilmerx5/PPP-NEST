import { User } from './user.entity';
export declare class PointRedemption {
    id: number;
    code: string;
    user: User;
    userId: string;
    isUsed: boolean;
    usedAt: Date | null;
    usedInOrderId: number | null;
    createdAt: Date;
    updatedAt: Date;
    expiresAt: Date | null;
}
