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
exports.User = void 0;
const swagger_1 = require("@nestjs/swagger");
const typeorm_1 = require("typeorm");
const verification_token_entity_1 = require("./verification-token.entity");
let User = class User {
    id;
    email;
    password;
    fullName;
    isActive;
    phone;
    roles;
    verificationTokens;
};
exports.User = User;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'UUID único del usuario.',
        example: 'a3f1c9a9-7431-4e74-aed2-db70762e99ad',
    }),
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], User.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Correo electrónico del usuario. Debe ser único.',
        example: 'user@example.com',
    }),
    (0, typeorm_1.Column)({ unique: true }),
    __metadata("design:type", String)
], User.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Contraseña del usuario (no se expone en respuestas).',
        example: 'hashedPassword123',
        required: false,
    }),
    (0, typeorm_1.Column)({ select: false }),
    __metadata("design:type", String)
], User.prototype, "password", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Nombre completo del usuario.',
        example: 'Juan Pérez',
    }),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], User.prototype, "fullName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Estado de activación del usuario.',
        example: false,
        default: false,
    }),
    (0, typeorm_1.Column)('boolean', { default: false }),
    __metadata("design:type", Boolean)
], User.prototype, "isActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Número de teléfono del usuario.',
        example: '+57 300 123 4567',
    }),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], User.prototype, "phone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Roles asignados al usuario.',
        example: ['user', 'admin'],
        isArray: true,
        type: String,
        nullable: true,
    }),
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Array)
], User.prototype, "roles", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Tokens asociados al usuario para verificación, activación, etc.',
        type: () => [verification_token_entity_1.VerificationToken],
        required: false,
    }),
    (0, typeorm_1.OneToMany)(() => verification_token_entity_1.VerificationToken, (token) => token.user),
    __metadata("design:type", Array)
], User.prototype, "verificationTokens", void 0);
exports.User = User = __decorate([
    (0, typeorm_1.Entity)('ppp_users')
], User);
//# sourceMappingURL=user.entity.js.map