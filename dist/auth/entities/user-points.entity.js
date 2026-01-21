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
exports.UserPoints = void 0;
const swagger_1 = require("@nestjs/swagger");
const typeorm_1 = require("typeorm");
const user_entity_1 = require("./user.entity");
let UserPoints = class UserPoints {
    id;
    code;
    user;
    userId;
    orderId;
    isUsed;
    isCanceled;
    isRedeemed;
    type;
    orderDailyNumber;
    description;
    createdAt;
};
exports.UserPoints = UserPoints;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID único del registro de puntos.',
        example: 1,
    }),
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], UserPoints.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Código alfanumérico único del punto (12 caracteres). Este es el código que se imprime en la factura.',
        example: 'A3F9K2M8P1Q7',
    }),
    (0, typeorm_1.Column)({ length: 12, unique: true }),
    __metadata("design:type", String)
], UserPoints.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Usuario al que pertenecen los puntos.',
    }),
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'user_id' }),
    __metadata("design:type", user_entity_1.User)
], UserPoints.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id', nullable: true }),
    __metadata("design:type", Object)
], UserPoints.prototype, "userId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID de la orden que generó este punto (null si fue registrado manualmente).',
        example: 125,
        nullable: true,
    }),
    (0, typeorm_1.Column)({ name: 'order_id', type: 'int', nullable: true }),
    __metadata("design:type", Object)
], UserPoints.prototype, "orderId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Indica si el punto ya fue usado/reclamado por el usuario.',
        example: false,
        default: false,
    }),
    (0, typeorm_1.Column)({ name: 'is_used', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], UserPoints.prototype, "isUsed", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Indica si el punto fue cancelado (la orden asociada fue cancelada).',
        example: false,
        default: false,
    }),
    (0, typeorm_1.Column)({ name: 'is_canceled', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], UserPoints.prototype, "isCanceled", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Indica si el punto fue usado para crear un premio de redención.',
        example: false,
        default: false,
    }),
    (0, typeorm_1.Column)({ name: 'is_redeemed', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], UserPoints.prototype, "isRedeemed", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Tipo de registro: automatic (de orden online) o manual (registrado por cliente).',
        example: 'automatic',
        enum: ['automatic', 'manual'],
    }),
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ['automatic', 'manual'],
        default: 'automatic',
    }),
    __metadata("design:type", String)
], UserPoints.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Número diario de la orden (para referencias).',
        example: 5,
        nullable: true,
    }),
    (0, typeorm_1.Column)({ name: 'order_daily_number', type: 'int', nullable: true }),
    __metadata("design:type", Object)
], UserPoints.prototype, "orderDailyNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Descripción o notas del registro.',
        example: 'Punto de orden #5',
        nullable: true,
    }),
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], UserPoints.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Fecha de creación del registro.',
    }),
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], UserPoints.prototype, "createdAt", void 0);
exports.UserPoints = UserPoints = __decorate([
    (0, typeorm_1.Entity)('ppp_user_points')
], UserPoints);
//# sourceMappingURL=user-points.entity.js.map