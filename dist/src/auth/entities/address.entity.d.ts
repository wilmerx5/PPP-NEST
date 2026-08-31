import { User } from "./user.entity";
export declare class Address {
    id: number;
    user: User;
    userId: string;
    label: string;
    address: string;
    isDefault: boolean;
    type: 'home' | 'work' | 'other';
    notes?: string;
    lat?: number | null;
    lng?: number | null;
    locationConfirmed: boolean;
    createdAt: Date;
    updatedAt: Date;
}
