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
exports.Product = void 0;
const swagger_1 = require("@nestjs/swagger");
const order_item_entity_1 = require("../../orders/entities/order-item.entity");
const typeorm_1 = require("typeorm");
const category_entity_1 = require("./category.entity");
const product_attribute_entity_1 = require("./product-attribute.entity");
let Product = class Product {
    id;
    name;
    description;
    price;
    hasAttributes;
    code;
    isActive;
    attributes;
    categories;
    orderItems;
    imageUrl;
};
exports.Product = Product;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID autogenerado del producto.',
        example: 1,
    }),
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], Product.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Nombre del producto.',
        example: 'Pollo Asado Familiar',
        maxLength: 100,
    }),
    (0, typeorm_1.Column)({ length: 100 }),
    __metadata("design:type", String)
], Product.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Descripción del producto.',
        example: 'Pollo asado a la leña acompañado de papas criollas.',
        required: false,
    }),
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Product.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Precio del producto.',
        example: 29900,
        type: Number,
    }),
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], Product.prototype, "price", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Indica si el producto tiene atributos configurables (bebida, salsa, acompañamiento, etc).',
        example: true,
        default: false,
    }),
    (0, typeorm_1.Column)({ name: 'has_attributes', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], Product.prototype, "hasAttributes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Código único del producto. Usado en POS o pedidos rápidos.',
        example: 101,
        type: Number,
        uniqueItems: true,
    }),
    (0, typeorm_1.Column)({ type: 'int', unique: true }),
    __metadata("design:type", Number)
], Product.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Si el producto está activo y visible en listados y pedidos.',
        example: true,
        default: true,
    }),
    (0, typeorm_1.Column)({ name: 'is_active', type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], Product.prototype, "isActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Lista de atributos configurables del producto.',
        type: () => [product_attribute_entity_1.ProductAttribute],
        required: false,
    }),
    (0, typeorm_1.OneToMany)(() => product_attribute_entity_1.ProductAttribute, (attr) => attr.product, { cascade: true }),
    __metadata("design:type", Array)
], Product.prototype, "attributes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Categorías a las que pertenece este producto.',
        type: () => [category_entity_1.Category],
    }),
    (0, typeorm_1.ManyToMany)(() => category_entity_1.Category, (category) => category.products, { cascade: true }),
    (0, typeorm_1.JoinTable)({
        name: 'ppp_product_categories',
        joinColumn: { name: 'product_id', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'category_id', referencedColumnName: 'id' },
    }),
    __metadata("design:type", Array)
], Product.prototype, "categories", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Items de órdenes donde este producto fue utilizado.',
        type: () => [order_item_entity_1.OrderItem],
        required: false,
    }),
    (0, typeorm_1.OneToMany)(() => order_item_entity_1.OrderItem, (item) => item.product),
    __metadata("design:type", Array)
], Product.prototype, "orderItems", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'URL de la imagen del producto.',
        example: 'https://cdn.prontopollo.com/products/pollo-asado.png',
        required: false,
    }),
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true, name: 'image_url' }),
    __metadata("design:type", String)
], Product.prototype, "imageUrl", void 0);
exports.Product = Product = __decorate([
    (0, typeorm_1.Entity)('ppp_products')
], Product);
//# sourceMappingURL=product.entity.js.map