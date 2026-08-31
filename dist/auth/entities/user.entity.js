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
const address_entity_1 = require("./address.entity");
const phone_entity_1 = require("./phone.entity");
let User = class User {
    id;
    email;
    password;
    fullName;
    isActive;
    phone;
    googleId;
    provider;
    roles;
    totpEnabled;
    totpSecret;
    totpRecoveryCodes;
    createdAt;
    verificationTokens;
    addresses;
    phones;
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
    (0, typeorm_1.Column)({ select: false, nullable: true }),
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
        required: false,
    }),
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], User.prototype, "phone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID de Google OAuth.',
        example: '1234567890',
        required: false,
    }),
    (0, typeorm_1.Column)({ name: 'google_id', nullable: true, unique: true }),
    __metadata("design:type", String)
], User.prototype, "googleId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Proveedor de autenticación.',
        example: 'google',
        required: false,
    }),
    (0, typeorm_1.Column)({ nullable: true, default: 'local' }),
    __metadata("design:type", String)
], User.prototype, "provider", void 0);
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
        description: 'Si el usuario tiene 2FA TOTP activo.',
        example: false,
        default: false,
    }),
    (0, typeorm_1.Column)({ name: 'totp_enabled', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], User.prototype, "totpEnabled", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Secreto TOTP (no se expone en respuestas).',
        required: false,
    }),
    (0, typeorm_1.Column)({ name: 'totp_secret', type: 'varchar', length: 64, nullable: true, select: false }),
    __metadata("design:type", Object)
], User.prototype, "totpSecret", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Códigos de recuperación hasheados (no se exponen).',
        required: false,
    }),
    (0, typeorm_1.Column)({ name: 'totp_recovery_codes', type: 'simple-json', nullable: true, select: false }),
    __metadata("design:type", Object)
], User.prototype, "totpRecoveryCodes", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({
        name: 'created_at',
        type: 'timestamp',
    }),
    __metadata("design:type", Date)
], User.prototype, "createdAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Tokens asociados al usuario para verificación, activación, etc.',
        type: () => [verification_token_entity_1.VerificationToken],
        required: false,
    }),
    (0, typeorm_1.OneToMany)(() => verification_token_entity_1.VerificationToken, (token) => token.user),
    __metadata("design:type", Array)
], User.prototype, "verificationTokens", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Direcciones asociadas al usuario.',
        type: () => [address_entity_1.Address],
        required: false,
    }),
    (0, typeorm_1.OneToMany)(() => address_entity_1.Address, (address) => address.user),
    __metadata("design:type", Array)
], User.prototype, "addresses", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Teléfonos asociados al usuario.',
        type: () => [phone_entity_1.Phone],
        required: false,
    }),
    (0, typeorm_1.OneToMany)(() => phone_entity_1.Phone, (phone) => phone.user),
    __metadata("design:type", Array)
], User.prototype, "phones", void 0);
exports.User = User = __decorate([
    (0, typeorm_1.Entity)('ppp_users')
], User);
//# sourceMappingURL=user.entity.js.map