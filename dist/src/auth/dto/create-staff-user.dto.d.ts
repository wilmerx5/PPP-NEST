import { ValidRoles } from '../interfaces/valid.roles.interface';
export declare class CreateStaffUserDto {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    roles: ValidRoles[];
}
