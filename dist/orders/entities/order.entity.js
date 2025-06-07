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
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], Order.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'customer_name', length: 100 }),
    __metadata("design:type", String)
], Order.prototype, "customerName", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 20 }),
    __metadata("design:type", String)
], Order.prototype, "phone", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], Order.prototype, "address", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Order.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => order_item_entity_1.OrderItem, (item) => item.order, { cascade: true }),
    __metadata("design:type", Array)
], Order.prototype, "items", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'daily_order_number', type: 'int', nullable: true }),
    __metadata("design:type", Number)
], Order.prototype, "dailyOrderNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ['delivery', 'pickup', 'table', 'counter'],
        default: 'pickup',
        name: "order_type"
    }),
    __metadata("design:type", String)
], Order.prototype, "orderType", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ['cooking', 'packing', 'canceled'],
        default: 'cooking',
        name: "order_status"
    }),
    __metadata("design:type", String)
], Order.prototype, "orderStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean' }),
    __metadata("design:type", Boolean)
], Order.prototype, "printed", void 0);
exports.Order = Order = __decorate([
    (0, typeorm_1.Entity)('ppp_orders')
], Order);
//# sourceMappingURL=order.entity.js.map