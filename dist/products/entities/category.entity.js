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
exports.Category = void 0;
const swagger_1 = require("@nestjs/swagger");
const typeorm_1 = require("typeorm");
const product_entity_1 = require("./product.entity");
let Category = class Category {
    id;
    name;
    products;
    imageUrl;
};
exports.Category = Category;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID autoincremental de la categoría.',
        example: 1,
    }),
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], Category.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Nombre único de la categoría.',
        example: 'Bebidas',
        maxLength: 100,
    }),
    (0, typeorm_1.Column)({ length: 100, unique: true }),
    __metadata("design:type", String)
], Category.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Lista de productos asociados a esta categoría.',
        type: () => [product_entity_1.Product],
        required: false,
    }),
    (0, typeorm_1.ManyToMany)(() => product_entity_1.Product, (product) => product.categories),
    __metadata("design:type", Array)
], Category.prototype, "products", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'URL de la imagen asociada a la categoría.',
        example: 'https://cdn.misitio.com/categories/bebidas.png',
        required: false,
    }),
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true, name: 'image_url' }),
    __metadata("design:type", Object)
], Category.prototype, "imageUrl", void 0);
exports.Category = Category = __decorate([
    (0, typeorm_1.Entity)('ppp_categories')
], Category);
//# sourceMappingURL=category.entity.js.map