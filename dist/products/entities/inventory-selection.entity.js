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
exports.InventorySelection = void 0;
const swagger_1 = require("@nestjs/swagger");
const typeorm_1 = require("typeorm");
const inventory_group_item_entity_1 = require("./inventory-group-item.entity");
const inventory_selection_product_entity_1 = require("./inventory-selection-product.entity");
let InventorySelection = class InventorySelection {
    id;
    name;
    groupItemId;
    groupItem;
    sortOrder;
    products;
};
exports.InventorySelection = InventorySelection;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], InventorySelection.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Bebida', description: 'Nombre mostrado en el modal' }),
    (0, typeorm_1.Column)({ length: 100 }),
    __metadata("design:type", String)
], InventorySelection.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'group_item_id' }),
    __metadata("design:type", Number)
], InventorySelection.prototype, "groupItemId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => inventory_group_item_entity_1.InventoryGroupItem, (gi) => gi.selections, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'group_item_id' }),
    __metadata("design:type", inventory_group_item_entity_1.InventoryGroupItem)
], InventorySelection.prototype, "groupItem", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'sort_order', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], InventorySelection.prototype, "sortOrder", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => inventory_selection_product_entity_1.InventorySelectionProduct, (sp) => sp.selection),
    __metadata("design:type", Array)
], InventorySelection.prototype, "products", void 0);
exports.InventorySelection = InventorySelection = __decorate([
    (0, typeorm_1.Entity)('ppp_inventory_selection')
], InventorySelection);
//# sourceMappingURL=inventory-selection.entity.js.map