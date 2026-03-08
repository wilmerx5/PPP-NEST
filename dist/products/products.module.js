"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const category_entity_1 = require("./entities/category.entity");
const product_attribute_entity_1 = require("./entities/product-attribute.entity");
const product_entity_1 = require("./entities/product.entity");
const product_variant_stock_entity_1 = require("./entities/product-variant-stock.entity");
const inventory_group_entity_1 = require("./entities/inventory-group.entity");
const inventory_group_item_entity_1 = require("./entities/inventory-group-item.entity");
const inventory_selection_entity_1 = require("./entities/inventory-selection.entity");
const inventory_selection_product_entity_1 = require("./entities/inventory-selection-product.entity");
const products_controller_1 = require("./products.controller");
const products_service_1 = require("./products.service");
const common_module_1 = require("../common/common.module");
let ProductsModule = class ProductsModule {
};
exports.ProductsModule = ProductsModule;
exports.ProductsModule = ProductsModule = __decorate([
    (0, common_1.Module)({
        controllers: [products_controller_1.ProductsController],
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                product_entity_1.Product,
                category_entity_1.Category,
                product_attribute_entity_1.ProductAttribute,
                product_variant_stock_entity_1.ProductVariantStock,
                inventory_group_entity_1.InventoryGroup,
                inventory_group_item_entity_1.InventoryGroupItem,
                inventory_selection_entity_1.InventorySelection,
                inventory_selection_product_entity_1.InventorySelectionProduct,
            ]),
            common_module_1.CommonModule,
        ],
        providers: [products_service_1.ProductsService],
        exports: [products_service_1.ProductsService],
    })
], ProductsModule);
//# sourceMappingURL=products.module.js.map