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
exports.OrderItem = void 0;
const swagger_1 = require("@nestjs/swagger");
const product_entity_1 = require("../../products/entities/product.entity");
const typeorm_1 = require("typeorm");
const order_item_attribute_entity_1 = require("./order-item-attribute.entity");
const order_entity_1 = require("./order.entity");
let OrderItem = class OrderItem {
    id;
    order;
    product;
    attributes;
    note;
};
exports.OrderItem = OrderItem;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID autogenerado del ítem dentro de una orden.',
        example: 45,
    }),
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], OrderItem.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Orden a la que pertenece este ítem.',
        type: () => order_entity_1.Order,
    }),
    (0, typeorm_1.ManyToOne)(() => order_entity_1.Order, (order) => order.items, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'order_id' }),
    __metadata("design:type", order_entity_1.Order)
], OrderItem.prototype, "order", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Producto asociado a este ítem.',
        type: () => product_entity_1.Product,
        example: { id: 12, name: 'Pollo Asado' },
    }),
    (0, typeorm_1.ManyToOne)(() => product_entity_1.Product, (product) => product.orderItems),
    (0, typeorm_1.JoinColumn)({ name: 'product_id' }),
    __metadata("design:type", product_entity_1.Product)
], OrderItem.prototype, "product", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Atributos seleccionados para el producto (salsas, bebidas, acompañamientos).',
        type: () => [order_item_attribute_entity_1.OrderItemAttribute],
        required: false,
    }),
    (0, typeorm_1.OneToMany)(() => order_item_attribute_entity_1.OrderItemAttribute, (attr) => attr.orderItem, {
        cascade: true,
    }),
    __metadata("design:type", Array)
], OrderItem.prototype, "attributes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Nota opcional asociada al producto (ej: sin cebolla, bien tostado).',
        example: 'Sin picante',
        required: false,
    }),
    (0, typeorm_1.Column)({ type: 'text', nullable: false }),
    __metadata("design:type", String)
], OrderItem.prototype, "note", void 0);
exports.OrderItem = OrderItem = __decorate([
    (0, typeorm_1.Entity)('ppp_order_items')
], OrderItem);
//# sourceMappingURL=order-item.entity.js.map