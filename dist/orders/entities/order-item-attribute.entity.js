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
exports.OrderItemAttribute = void 0;
const typeorm_1 = require("typeorm");
const order_item_entity_1 = require("./order-item.entity");
let OrderItemAttribute = class OrderItemAttribute {
    id;
    attributeName;
    attributeValue;
    orderItem;
};
exports.OrderItemAttribute = OrderItemAttribute;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], OrderItemAttribute.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'attribute_name', length: 100 }),
    __metadata("design:type", String)
], OrderItemAttribute.prototype, "attributeName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'attribute_value', length: 100 }),
    __metadata("design:type", String)
], OrderItemAttribute.prototype, "attributeValue", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => order_item_entity_1.OrderItem, (item) => item.attributes, {
        onDelete: 'CASCADE',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'order_item_id' }),
    __metadata("design:type", order_item_entity_1.OrderItem)
], OrderItemAttribute.prototype, "orderItem", void 0);
exports.OrderItemAttribute = OrderItemAttribute = __decorate([
    (0, typeorm_1.Entity)('ppp_order_item_attributes')
], OrderItemAttribute);
//# sourceMappingURL=order-item-attribute.entity.js.map