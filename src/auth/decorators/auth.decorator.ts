import { applyDecorators, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { UserRoleGuard } from "../guards/user-role-guard/user-role-guard.guard";
import { ValidRoles } from "../interfaces/valid.roles.interface";
import { RoleProtected } from "./role-protected/role-protected.decorator";

export function Auth(...roles:ValidRoles[]){
    return applyDecorators(
        RoleProtected(...roles),
        // Nombre explícito: ProductsModule no puede importar AuthModule (ciclo).
        // AuthGuard() sin nombre busca defaultStrategy del módulo → 500 Unknown strategy.
        UseGuards(AuthGuard('jwt'), UserRoleGuard)
    )
}
