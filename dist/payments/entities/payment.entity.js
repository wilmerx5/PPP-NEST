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
exports.Payment = void 0;
const swagger_1 = require("@nestjs/swagger");
const typeorm_1 = require("typeorm");
const order_entity_1 = require("../../orders/entities/order.entity");
let Payment = class Payment {
    id;
    orderId;
    order;
    preferenceId;
    paymentId;
    status;
    amount;
    metadata;
    createdAt;
    updatedAt;
};
exports.Payment = Payment;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID autogenerado del pago.',
        example: 1,
    }),
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], Payment.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID de la orden asociada (null hasta que se confirme el pago).',
        example: 125,
        nullable: true,
    }),
    (0, typeorm_1.Column)({ name: 'order_id', type: 'int', nullable: true }),
    __metadata("design:type", Object)
], Payment.prototype, "orderId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => order_entity_1.Order, { onDelete: 'CASCADE', eager: false }),
    __metadata("design:type", order_entity_1.Order)
], Payment.prototype, "order", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID de preferencia de Mercado Pago.',
        example: '123456789-abc123',
    }),
    (0, typeorm_1.Column)({ name: 'preference_id', nullable: true }),
    __metadata("design:type", String)
], Payment.prototype, "preferenceId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID de pago de Mercado Pago.',
        example: '12345678901',
        nullable: true,
    }),
    (0, typeorm_1.Column)({ name: 'payment_id', nullable: true, unique: true }),
    __metadata("design:type", String)
], Payment.prototype, "paymentId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Estado del pago.',
        example: 'approved',
        enum: ['pending', 'approved', 'rejected', 'cancelled', 'refunded'],
    }),
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ['pending', 'approved', 'rejected', 'cancelled', 'refunded'],
        default: 'pending',
    }),
    __metadata("design:type", String)
], Payment.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Monto del pago.',
        example: 50000.00,
    }),
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], Payment.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Información adicional del pago (JSON).',
        example: { method: 'credit_card', installments: 1 },
        nullable: true,
    }),
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Payment.prototype, "metadata", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Fecha de creación del pago.',
        example: '2025-01-15T20:12:00.000Z',
    }),
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Payment.prototype, "createdAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Fecha de última actualización del pago.',
        example: '2025-01-15T20:15:00.000Z',
    }),
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], Payment.prototype, "updatedAt", void 0);
exports.Payment = Payment = __decorate([
    (0, typeorm_1.Entity)({ name: 'ppp_payments', synchronize: true })
], Payment);
//# sourceMappingURL=payment.entity.js.map