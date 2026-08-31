"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateStaffUserDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const valid_roles_interface_1 = require("../interfaces/valid.roles.interface");
const staff_roles_util_1 = require("../staff.roles.util");
class CreateStaffUserDto {
    email;
    password;
    fullName;
    phone;
    roles;
}
exports.CreateStaffUserDto = CreateStaffUserDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'cocina@prontopolloportal.com' }),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], CreateStaffUserDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minLength: 6, example: 'Cocina2026!' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(6),
    __metadata("design:type", String)
], CreateStaffUserDto.prototype, "password", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'María Cocina' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateStaffUserDto.prototype, "fullName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '3001234567' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^[0-9+\-() ]{7,20}$/, {
        message: 'El número de teléfono no es válido',
    }),
    __metadata("design:type", String)
], CreateStaffUserDto.prototype, "phone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        isArray: true,
        enum: staff_roles_util_1.STAFF_ROLES,
        example: [valid_roles_interface_1.ValidRoles.kitchenUser],
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.IsEnum)(staff_roles_util_1.STAFF_ROLES, { each: true, message: 'Rol de staff inválido' }),
    __metadata("design:type", Array)
], CreateStaffUserDto.prototype, "roles", void 0);
//# sourceMappingURL=create-staff-user.dto.js.map