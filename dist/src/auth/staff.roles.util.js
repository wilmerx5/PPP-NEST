"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STAFF_ROLES = void 0;
exports.isStaffRole = isStaffRole;
exports.userHasStaffRole = userHasStaffRole;
exports.staffRolesSqlWhere = staffRolesSqlWhere;
exports.staffRolesSqlParams = staffRolesSqlParams;
const valid_roles_interface_1 = require("./interfaces/valid.roles.interface");
exports.STAFF_ROLES = [
    valid_roles_interface_1.ValidRoles.admin,
    valid_roles_interface_1.ValidRoles.kitchenUser,
    valid_roles_interface_1.ValidRoles.tableUser,
    valid_roles_interface_1.ValidRoles.ordersUser,
    valid_roles_interface_1.ValidRoles.whatsappUser,
];
function isStaffRole(role) {
    return exports.STAFF_ROLES.includes(role);
}
function userHasStaffRole(roles) {
    if (!roles?.length)
        return false;
    return roles.some((r) => isStaffRole(r));
}
function staffRolesSqlWhere(alias = 'user') {
    return exports.STAFF_ROLES.map((r) => `${alias}.roles LIKE :staff_${r}`).join(' OR ');
}
function staffRolesSqlParams() {
    const params = {};
    for (const r of exports.STAFF_ROLES) {
        params[`staff_${r}`] = `%${r}%`;
    }
    return params;
}
//# sourceMappingURL=staff.roles.util.js.map