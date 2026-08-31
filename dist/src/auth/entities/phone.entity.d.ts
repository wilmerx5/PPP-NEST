import { User } from "./user.entity";
export declare class Phone {
    id: number;
    user: User;
    userId: string;
    number: string;
    label: string;
    isDefault: boolean;
    type: 'mobile' | 'home' | 'work' | 'other';
    createdAt: Date;
    updatedAt: Date;
}
