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
exports.InventoryGroupItem = void 0;
const swagger_1 = require("@nestjs/swagger");
const typeorm_1 = require("typeorm");
const inventory_group_entity_1 = require("./inventory-group.entity");
const inventory_selection_entity_1 = require("./inventory-selection.entity");
const product_entity_1 = require("./product.entity");
let InventoryGroupItem = class InventoryGroupItem {
    id;
    groupId;
    group;
    productId;
    product;
    attributeName;
    attributeValue;
    baseUnits;
    alsoDeductProductId;
    alsoDeductAttributeName;
    alsoDeductAttributeValue;
    alsoDeductBaseUnits;
    selections;
};
exports.InventoryGroupItem = InventoryGroupItem;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], InventoryGroupItem.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'group_id' }),
    __metadata("design:type", Number)
], InventoryGroupItem.prototype, "groupId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => inventory_group_entity_1.InventoryGroup, (g) => g.items, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'group_id' }),
    __metadata("design:type", inventory_group_entity_1.InventoryGroup)
], InventoryGroupItem.prototype, "group", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'product_id' }),
    __metadata("design:type", Number)
], InventoryGroupItem.prototype, "productId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => product_entity_1.Product, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'product_id' }),
    __metadata("design:type", product_entity_1.Product)
], InventoryGroupItem.prototype, "product", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, typeorm_1.Column)({ name: 'attribute_name', length: 100, default: '' }),
    __metadata("design:type", String)
], InventoryGroupItem.prototype, "attributeName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, typeorm_1.Column)({ name: 'attribute_value', length: 100, default: '' }),
    __metadata("design:type", String)
], InventoryGroupItem.prototype, "attributeValue", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0.25 }),
    (0, typeorm_1.Column)({ name: 'base_units', type: 'decimal', precision: 10, scale: 4 }),
    __metadata("design:type", Number)
], InventoryGroupItem.prototype, "baseUnits", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, typeorm_1.Column)({ name: 'also_deduct_product_id', type: 'int', nullable: true }),
    __metadata("design:type", Object)
], InventoryGroupItem.prototype, "alsoDeductProductId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'also_deduct_attribute_name', type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", Object)
], InventoryGroupItem.prototype, "alsoDeductAttributeName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'also_deduct_attribute_value', type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", Object)
], InventoryGroupItem.prototype, "alsoDeductAttributeValue", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'also_deduct_base_units', type: 'decimal', precision: 10, scale: 4, nullable: true }),
    __metadata("design:type", Object)
], InventoryGroupItem.prototype, "alsoDeductBaseUnits", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => inventory_selection_entity_1.InventorySelection, (s) => s.groupItem),
    __metadata("design:type", Array)
], InventoryGroupItem.prototype, "selections", void 0);
exports.InventoryGroupItem = InventoryGroupItem = __decorate([
    (0, typeorm_1.Entity)('ppp_inventory_group_item'),
    (0, typeorm_1.Index)(['groupId', 'productId', 'attributeName', 'attributeValue'], { unique: true })
], InventoryGroupItem);
//# sourceMappingURL=inventory-group-item.entity.js.map