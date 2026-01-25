import { User } from './user.entity';
export declare class UserPoints {
    id: number;
    code: string;
    user: User | null;
    userId: string | null;
    orderId: number | null;
    isUsed: boolean;
    isCanceled: boolean;
    isRedeemed: boolean;
    type: 'automatic' | 'manual' | 'admin';
    orderDailyNumber: number | null;
    description: string | null;
    createdAt: Date;
}
