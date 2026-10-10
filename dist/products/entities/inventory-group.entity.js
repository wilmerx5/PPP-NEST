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
exports.InventoryGroup = void 0;
const swagger_1 = require("@nestjs/swagger");
const typeorm_1 = require("typeorm");
const inventory_group_item_entity_1 = require("./inventory-group-item.entity");
let InventoryGroup = class InventoryGroup {
    id;
    name;
    stock;
    items;
};
exports.InventoryGroup = InventoryGroup;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], InventoryGroup.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Pollo', description: 'Nombre del grupo' }),
    (0, typeorm_1.Column)({ length: 100 }),
    __metadata("design:type", String)
], InventoryGroup.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 10 }),
    (0, typeorm_1.Column)({ type: 'decimal', precision: 12, scale: 4, default: 0 }),
    __metadata("design:type", Number)
], InventoryGroup.prototype, "stock", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => inventory_group_item_entity_1.InventoryGroupItem, (item) => item.group),
    __metadata("design:type", Array)
], InventoryGroup.prototype, "items", void 0);
exports.InventoryGroup = InventoryGroup = __decorate([
    (0, typeorm_1.Entity)('ppp_inventory_group')
], InventoryGroup);
//# sourceMappingURL=inventory-group.entity.js.map