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
exports.ProductSchedule = void 0;
const typeorm_1 = require("typeorm");
const product_entity_1 = require("./product.entity");
let ProductSchedule = class ProductSchedule {
    id;
    productId;
    dayOfWeek;
    startTime;
    endTime;
    product;
};
exports.ProductSchedule = ProductSchedule;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], ProductSchedule.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'product_id' }),
    __metadata("design:type", Number)
], ProductSchedule.prototype, "productId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'day_of_week', type: 'tinyint' }),
    __metadata("design:type", Number)
], ProductSchedule.prototype, "dayOfWeek", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'start_time', type: 'varchar', length: 5, nullable: true }),
    __metadata("design:type", Object)
], ProductSchedule.prototype, "startTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'end_time', type: 'varchar', length: 5, nullable: true }),
    __metadata("design:type", Object)
], ProductSchedule.prototype, "endTime", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => product_entity_1.Product, (product) => product.schedules, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'product_id' }),
    __metadata("design:type", product_entity_1.Product)
], ProductSchedule.prototype, "product", void 0);
exports.ProductSchedule = ProductSchedule = __decorate([
    (0, typeorm_1.Entity)('ppp_product_schedules')
], ProductSchedule);
//# sourceMappingURL=product-schedule.entity.js.map