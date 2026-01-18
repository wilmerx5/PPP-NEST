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
exports.Address = void 0;
const swagger_1 = require("@nestjs/swagger");
const typeorm_1 = require("typeorm");
const user_entity_1 = require("./user.entity");
let Address = class Address {
    id;
    user;
    userId;
    label;
    address;
    isDefault;
    type;
    notes;
    createdAt;
    updatedAt;
};
exports.Address = Address;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID único de la dirección.',
        example: 1,
    }),
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], Address.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Usuario propietario de la dirección.',
        type: () => user_entity_1.User,
    }),
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, (user) => user.addresses, { onDelete: 'CASCADE' }),
    __metadata("design:type", user_entity_1.User)
], Address.prototype, "user", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID del usuario propietario.',
        example: 'a3f1c9a9-7431-4e74-aed2-db70762e99ad',
    }),
    (0, typeorm_1.Column)({ name: 'user_id' }),
    __metadata("design:type", String)
], Address.prototype, "userId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Nombre descriptivo de la dirección (ej: Casa, Trabajo, etc.).',
        example: 'Casa',
    }),
    (0, typeorm_1.Column)({ length: 100 }),
    __metadata("design:type", String)
], Address.prototype, "label", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Dirección completa.',
        example: 'Calle 123 #45-67, Bogotá',
    }),
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], Address.prototype, "address", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Indica si esta es la dirección por defecto.',
        example: true,
        default: false,
    }),
    (0, typeorm_1.Column)({ name: 'is_default', default: false }),
    __metadata("design:type", Boolean)
], Address.prototype, "isDefault", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Tipo de dirección.',
        example: 'home',
        enum: ['home', 'work', 'other'],
        default: 'other',
    }),
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ['home', 'work', 'other'],
        default: 'other',
    }),
    __metadata("design:type", String)
], Address.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Información adicional (barrio, referencias, etc.).',
        example: 'Cerca del parque principal',
        required: false,
    }),
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Address.prototype, "notes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Fecha de creación.',
        example: '2025-01-18T10:00:00.000Z',
    }),
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Address.prototype, "createdAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Fecha de última actualización.',
        example: '2025-01-18T10:00:00.000Z',
    }),
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], Address.prototype, "updatedAt", void 0);
exports.Address = Address = __decorate([
    (0, typeorm_1.Entity)('ppp_user_addresses')
], Address);
//# sourceMappingURL=address.entity.js.map