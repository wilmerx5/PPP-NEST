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
exports.Order = void 0;
const swagger_1 = require("@nestjs/swagger");
const typeorm_1 = require("typeorm");
const order_item_entity_1 = require("./order-item.entity");
let Order = class Order {
    id;
    customerName;
    phone;
    address;
    createdAt;
    items;
    dailyOrderNumber;
    orderType;
    orderStatus;
    printed;
};
exports.Order = Order;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID autogenerado de la orden.',
        example: 125,
    }),
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], Order.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Nombre del cliente que realiza la orden.',
        example: 'Carlos López',
    }),
    (0, typeorm_1.Column)({ name: 'customer_name', length: 100 }),
    __metadata("design:type", String)
], Order.prototype, "customerName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Número telefónico del cliente.',
        example: '+57 300 456 7890',
    }),
    (0, typeorm_1.Column)({ length: 20 }),
    __metadata("design:type", String)
], Order.prototype, "phone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Dirección de entrega del cliente.',
        example: 'Calle 123 #45-67, Bogotá',
    }),
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], Order.prototype, "address", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Fecha de creación de la orden.',
        example: '2025-11-14T20:12:00.000Z',
    }),
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Order.prototype, "createdAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Lista de items incluidos en la orden.',
        type: () => [order_item_entity_1.OrderItem],
    }),
    (0, typeorm_1.OneToMany)(() => order_item_entity_1.OrderItem, (item) => item.order, { cascade: true }),
    __metadata("design:type", Array)
], Order.prototype, "items", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Número consecutivo de la orden dentro del día.',
        example: 7,
        nullable: true,
    }),
    (0, typeorm_1.Column)({ name: 'daily_order_number', type: 'int', nullable: true }),
    __metadata("design:type", Number)
], Order.prototype, "dailyOrderNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Tipo de la orden.',
        example: 'pickup',
        enum: ['delivery', 'pickup', 'table', 'counter'],
    }),
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ['delivery', 'pickup', 'table', 'counter'],
        default: 'pickup',
        name: 'order_type',
    }),
    __metadata("design:type", String)
], Order.prototype, "orderType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Estado actual de la orden.',
        example: 'cooking',
        enum: ['cooking', 'packing', 'canceled', 'completed'],
    }),
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ['cooking', 'cooked', 'packing', 'canceled', 'inDelivery', 'completed'],
        default: 'cooking',
        name: 'order_status',
    }),
    __metadata("design:type", String)
], Order.prototype, "orderStatus", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Indica si la orden ya fue impresa.',
        example: false,
    }),
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], Order.prototype, "printed", void 0);
exports.Order = Order = __decorate([
    (0, typeorm_1.Entity)({ name: 'ppp_orders', synchronize: false })
], Order);
//# sourceMappingURL=order.entity.js.map