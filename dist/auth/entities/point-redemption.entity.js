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
exports.PointRedemption = void 0;
const swagger_1 = require("@nestjs/swagger");
const typeorm_1 = require("typeorm");
const user_entity_1 = require("./user.entity");
let PointRedemption = class PointRedemption {
    id;
    code;
    user;
    userId;
    isUsed;
    usedAt;
    usedInOrderId;
    createdAt;
    updatedAt;
    expiresAt;
};
exports.PointRedemption = PointRedemption;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID único del premio de redención.',
        example: 1,
    }),
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], PointRedemption.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Código único del premio (12 caracteres alfanuméricos). Este es el código que se usa para canjear medio pollo gratis.',
        example: 'REDEEM9PTSX7',
    }),
    (0, typeorm_1.Column)({ length: 12, unique: true }),
    __metadata("design:type", String)
], PointRedemption.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Usuario que redimió los puntos.',
    }),
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'user_id' }),
    __metadata("design:type", user_entity_1.User)
], PointRedemption.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id' }),
    __metadata("design:type", String)
], PointRedemption.prototype, "userId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Indica si el premio ya fue usado.',
        example: false,
        default: false,
    }),
    (0, typeorm_1.Column)({ name: 'is_used', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], PointRedemption.prototype, "isUsed", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Fecha en que se usó el premio (null si aún no se ha usado).',
        example: '2025-01-15T10:30:00.000Z',
        nullable: true,
    }),
    (0, typeorm_1.Column)({ name: 'used_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], PointRedemption.prototype, "usedAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID de la orden donde se aplicó el premio (null si aún no se ha usado).',
        example: 125,
        nullable: true,
    }),
    (0, typeorm_1.Column)({ name: 'used_in_order_id', type: 'int', nullable: true }),
    __metadata("design:type", Object)
], PointRedemption.prototype, "usedInOrderId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Fecha de creación del premio.',
    }),
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], PointRedemption.prototype, "createdAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Fecha de última actualización.',
    }),
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], PointRedemption.prototype, "updatedAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Fecha de expiración del premio (opcional, null = sin expiración).',
        example: '2025-02-15T10:30:00.000Z',
        nullable: true,
    }),
    (0, typeorm_1.Column)({ name: 'expires_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], PointRedemption.prototype, "expiresAt", void 0);
exports.PointRedemption = PointRedemption = __decorate([
    (0, typeorm_1.Entity)('ppp_point_redemptions'),
    (0, typeorm_1.Index)(['userId'])
], PointRedemption);
//# sourceMappingURL=point-redemption.entity.js.map