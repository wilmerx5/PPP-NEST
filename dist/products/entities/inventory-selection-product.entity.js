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
exports.InventorySelectionProduct = void 0;
const swagger_1 = require("@nestjs/swagger");
const typeorm_1 = require("typeorm");
const inventory_selection_entity_1 = require("./inventory-selection.entity");
const product_entity_1 = require("./product.entity");
let InventorySelectionProduct = class InventorySelectionProduct {
    id;
    selectionId;
    selection;
    productId;
    product;
    baseUnits;
    sortOrder;
};
exports.InventorySelectionProduct = InventorySelectionProduct;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], InventorySelectionProduct.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'selection_id' }),
    __metadata("design:type", Number)
], InventorySelectionProduct.prototype, "selectionId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => inventory_selection_entity_1.InventorySelection, (s) => s.products, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'selection_id' }),
    __metadata("design:type", inventory_selection_entity_1.InventorySelection)
], InventorySelectionProduct.prototype, "selection", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'product_id' }),
    __metadata("design:type", Number)
], InventorySelectionProduct.prototype, "productId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => product_entity_1.Product, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'product_id' }),
    __metadata("design:type", product_entity_1.Product)
], InventorySelectionProduct.prototype, "product", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0.1 }),
    (0, typeorm_1.Column)({ name: 'base_units', type: 'decimal', precision: 10, scale: 4, default: 0 }),
    __metadata("design:type", Number)
], InventorySelectionProduct.prototype, "baseUnits", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'sort_order', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], InventorySelectionProduct.prototype, "sortOrder", void 0);
exports.InventorySelectionProduct = InventorySelectionProduct = __decorate([
    (0, typeorm_1.Entity)('ppp_inventory_selection_product')
], InventorySelectionProduct);
//# sourceMappingURL=inventory-selection-product.entity.js.map