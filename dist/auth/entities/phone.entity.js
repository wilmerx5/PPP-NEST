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
exports.Phone = void 0;
const swagger_1 = require("@nestjs/swagger");
const typeorm_1 = require("typeorm");
const user_entity_1 = require("./user.entity");
let Phone = class Phone {
    id;
    user;
    userId;
    number;
    label;
    isDefault;
    type;
    createdAt;
    updatedAt;
};
exports.Phone = Phone;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID único del teléfono.',
        example: 1,
    }),
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], Phone.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Usuario propietario del teléfono.',
        type: () => user_entity_1.User,
    }),
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, (user) => user.phones, { onDelete: 'CASCADE' }),
    __metadata("design:type", user_entity_1.User)
], Phone.prototype, "user", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID del usuario propietario.',
        example: 'a3f1c9a9-7431-4e74-aed2-db70762e99ad',
    }),
    (0, typeorm_1.Column)({ name: 'user_id' }),
    __metadata("design:type", String)
], Phone.prototype, "userId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Número de teléfono.',
        example: '+57 300 123 4567',
    }),
    (0, typeorm_1.Column)({ length: 20 }),
    __metadata("design:type", String)
], Phone.prototype, "number", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Nombre descriptivo del teléfono (ej: Personal, Trabajo, etc.).',
        example: 'Personal',
    }),
    (0, typeorm_1.Column)({ length: 100 }),
    __metadata("design:type", String)
], Phone.prototype, "label", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Indica si este es el teléfono por defecto.',
        example: true,
        default: false,
    }),
    (0, typeorm_1.Column)({ name: 'is_default', default: false }),
    __metadata("design:type", Boolean)
], Phone.prototype, "isDefault", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Tipo de teléfono.',
        example: 'mobile',
        enum: ['mobile', 'home', 'work', 'other'],
        default: 'mobile',
    }),
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ['mobile', 'home', 'work', 'other'],
        default: 'mobile',
    }),
    __metadata("design:type", String)
], Phone.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Fecha de creación.',
        example: '2025-01-18T10:00:00.000Z',
    }),
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Phone.prototype, "createdAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Fecha de última actualización.',
        example: '2025-01-18T10:00:00.000Z',
    }),
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], Phone.prototype, "updatedAt", void 0);
exports.Phone = Phone = __decorate([
    (0, typeorm_1.Entity)('ppp_user_phones')
], Phone);
//# sourceMappingURL=phone.entity.js.map