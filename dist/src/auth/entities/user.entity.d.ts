import { VerificationToken } from "./verification-token.entity";
import { Address } from "./address.entity";
import { Phone } from "./phone.entity";
export declare class User {
    id: string;
    email: string;
    password: string;
    fullName: string;
    isActive: boolean;
    phone: string;
    googleId: string;
    provider: string;
    roles: string[];
    totpEnabled: boolean;
    totpSecret: string | null;
    totpRecoveryCodes: string[] | null;
    createdAt: Date;
    verificationTokens: VerificationToken[];
    addresses: Address[];
    phones: Phone[];
}
