import { ValidRoles } from 'src/auth/interfaces/valid.roles.interface';
export declare const META_ROLES = "roles";
export declare const RoleProtected: (...args: ValidRoles[]) => import("@nestjs/common").CustomDecorator<string>;
