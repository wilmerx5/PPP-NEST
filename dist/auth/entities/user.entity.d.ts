import { VerificationToken } from "./verification-token.entity";
export declare class User {
    id: string;
    email: string;
    password: string;
    fullName: string;
    isActive: boolean;
    phone: string;
    roles: string[];
    createdAt: Date;
    verificationTokens: VerificationToken[];
}
