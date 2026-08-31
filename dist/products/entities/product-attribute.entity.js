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
exports.ProductAttribute = void 0;
const swagger_1 = require("@nestjs/swagger");
const typeorm_1 = require("typeorm");
const product_entity_1 = require("./product.entity");
let ProductAttribute = class ProductAttribute {
    id;
    attributeName;
    options;
    product;
};
exports.ProductAttribute = ProductAttribute;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID autogenerado del atributo.',
        example: 12,
    }),
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], ProductAttribute.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Nombre del atributo asociado al producto.',
        example: 'Salsa',
        maxLength: 100,
    }),
    (0, typeorm_1.Column)({ name: 'attribute_name', length: 100 }),
    __metadata("design:type", String)
], ProductAttribute.prototype, "attributeName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Opciones disponibles para este atributo. Se almacena como JSON string y se convierte a array al retornar.',
        example: '["Dulce", "Picante", "BBQ"]',
        type: String,
    }),
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], ProductAttribute.prototype, "options", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Producto al que pertenece este atributo.',
        type: () => product_entity_1.Product,
    }),
    (0, typeorm_1.ManyToOne)(() => product_entity_1.Product, (product) => product.attributes, {
        onDelete: 'CASCADE',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'product_id' }),
    __metadata("design:type", product_entity_1.Product)
], ProductAttribute.prototype, "product", void 0);
exports.ProductAttribute = ProductAttribute = __decorate([
    (0, typeorm_1.Entity)('ppp_product_attributes')
], ProductAttribute);
//# sourceMappingURL=product-attribute.entity.js.map