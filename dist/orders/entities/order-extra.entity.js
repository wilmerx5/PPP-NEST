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
exports.OrderExtra = void 0;
const swagger_1 = require("@nestjs/swagger");
const typeorm_1 = require("typeorm");
const order_entity_1 = require("./order.entity");
let OrderExtra = class OrderExtra {
    id;
    order;
    title;
    description;
    amount;
    quantity;
    createdAt;
};
exports.OrderExtra = OrderExtra;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID del adicional.', example: 1 }),
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], OrderExtra.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Orden a la que pertenece.', type: () => order_entity_1.Order }),
    (0, typeorm_1.ManyToOne)(() => order_entity_1.Order, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'order_id' }),
    __metadata("design:type", order_entity_1.Order)
], OrderExtra.prototype, "order", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Título o descripción del adicional (ej. Plato extra, Cubierto).',
        example: 'Plato extra',
    }),
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], OrderExtra.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Detalle opcional del adicional.',
        example: 'Para llevar',
        nullable: true,
    }),
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], OrderExtra.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Precio del adicional.',
        example: 5000,
    }),
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], OrderExtra.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Cantidad.',
        example: 1,
        default: 1,
    }),
    (0, typeorm_1.Column)({ type: 'int', default: 1 }),
    __metadata("design:type", Number)
], OrderExtra.prototype, "quantity", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], OrderExtra.prototype, "createdAt", void 0);
exports.OrderExtra = OrderExtra = __decorate([
    (0, typeorm_1.Entity)('ppp_order_extras')
], OrderExtra);
//# sourceMappingURL=order-extra.entity.js.map