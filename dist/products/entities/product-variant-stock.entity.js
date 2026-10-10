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
exports.ProductVariantStock = void 0;
const swagger_1 = require("@nestjs/swagger");
const typeorm_1 = require("typeorm");
const product_entity_1 = require("./product.entity");
let ProductVariantStock = class ProductVariantStock {
    id;
    productId;
    product;
    attributeName;
    attributeValue;
    stock;
};
exports.ProductVariantStock = ProductVariantStock;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], ProductVariantStock.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Producto (ej. código 28 Bebida)' }),
    (0, typeorm_1.Column)({ name: 'product_id' }),
    __metadata("design:type", Number)
], ProductVariantStock.prototype, "productId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => product_entity_1.Product, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'product_id' }),
    __metadata("design:type", product_entity_1.Product)
], ProductVariantStock.prototype, "product", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Sabor', description: 'Nombre del atributo' }),
    (0, typeorm_1.Column)({ name: 'attribute_name', length: 100 }),
    __metadata("design:type", String)
], ProductVariantStock.prototype, "attributeName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Limonada', description: 'Valor de la opción' }),
    (0, typeorm_1.Column)({ name: 'attribute_value', length: 100 }),
    __metadata("design:type", String)
], ProductVariantStock.prototype, "attributeValue", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 10, description: 'Unidades en stock para esta variante' }),
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], ProductVariantStock.prototype, "stock", void 0);
exports.ProductVariantStock = ProductVariantStock = __decorate([
    (0, typeorm_1.Entity)('ppp_product_variant_stock'),
    (0, typeorm_1.Index)(['productId', 'attributeName', 'attributeValue'], { unique: true })
], ProductVariantStock);
//# sourceMappingURL=product-variant-stock.entity.js.map