import { ValidRoles } from '../interfaces/valid.roles.interface';
export declare class UpdateStaffUserDto {
    fullName?: string;
    email?: string;
    phone?: string;
    roles?: ValidRoles[];
    isActive?: boolean;
    password?: string;
}
