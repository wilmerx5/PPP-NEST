import { User } from "src/auth/entities/user.entity";
export declare class VerificationToken {
    id: number;
    token: string;
    expiresAt: Date;
    isUsed: boolean;
    createdAt: Date;
    user: User;
}
