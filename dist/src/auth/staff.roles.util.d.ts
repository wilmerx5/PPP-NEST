import { ValidRoles } from './interfaces/valid.roles.interface';
export declare const STAFF_ROLES: ValidRoles[];
export declare function isStaffRole(role: string): role is ValidRoles;
export declare function userHasStaffRole(roles: string[] | null | undefined): boolean;
export declare function staffRolesSqlWhere(alias?: string): string;
export declare function staffRolesSqlParams(): Record<string, string>;
