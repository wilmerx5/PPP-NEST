import { ValidRoles } from './interfaces/valid.roles.interface';

/** Roles de operación interna (no clientes del portal). */
export const STAFF_ROLES: ValidRoles[] = [
  ValidRoles.admin,
  ValidRoles.kitchenUser,
  ValidRoles.tableUser,
  ValidRoles.ordersUser,
  ValidRoles.whatsappUser,
];

export function isStaffRole(role: string): role is ValidRoles {
  return (STAFF_ROLES as string[]).includes(role);
}

export function userHasStaffRole(roles: string[] | null | undefined): boolean {
  if (!roles?.length) return false;
  return roles.some((r) => isStaffRole(r));
}

/** Condición SQL para filtrar usuarios con al menos un rol de staff (MySQL JSON text). */
export function staffRolesSqlWhere(alias = 'user'): string {
  return STAFF_ROLES.map((r) => `${alias}.roles LIKE :staff_${r}`).join(' OR ');
}

export function staffRolesSqlParams(): Record<string, string> {
  const params: Record<string, string> = {};
  for (const r of STAFF_ROLES) {
    params[`staff_${r}`] = `%${r}%`;
  }
  return params;
}
