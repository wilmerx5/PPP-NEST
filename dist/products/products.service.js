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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const category_entity_1 = require("./entities/category.entity");
const product_entity_1 = require("./entities/product.entity");
const product_attribute_entity_1 = require("./entities/product-attribute.entity");
let ProductsService = class ProductsService {
    productRepo;
    categoryRepo;
    attributeRepo;
    constructor(productRepo, categoryRepo, attributeRepo) {
        this.productRepo = productRepo;
        this.categoryRepo = categoryRepo;
        this.attributeRepo = attributeRepo;
    }
    create(createProductDto) {
        return 'This action adds a new product';
    }
    async findAll() {
        const products = await this.productRepo.find({
            relations: ['categories', 'attributes'],
            order: { id: 'ASC' },
        });
        return products.map(product => ({
            ...product,
            attributes: product.attributes.map(attr => ({
                ...attr,
                options: JSON.parse(attr.options),
            })),
        }));
    }
    async findAllCategories() {
        return this.categoryRepo.find({
            order: { id: 'ASC' },
        });
    }
    async findProductsGroupedByCategory() {
        const categories = await this.categoryRepo.find({
            relations: ['products', 'products.attributes'],
            order: { id: 'ASC' }
        });
        return categories.map(category => ({
            categoryId: category.id,
            categoryName: category.name,
            imageUrl: category.imageUrl,
            products: category.products.map(product => ({
                id: product.id,
                name: product.name,
                description: product.description,
                code: product.code,
                price: product.price,
                imageUrl: product.imageUrl,
                hasAttributes: product.hasAttributes,
                attributes: product.attributes.map(attr => ({
                    attributeName: attr.attributeName,
                    options: JSON.parse(attr.options),
                })),
            })),
        }));
    }
    async findOne(id) {
        const product = await this.productRepo.findOne({
            where: { id },
            relations: ['categories', 'attributes'],
        });
        if (!product) {
            return null;
        }
        return {
            ...product,
            attributes: product.attributes.map(attr => ({
                ...attr,
                options: JSON.parse(attr.options),
            })),
        };
    }
    async update(id, updateProductDto) {
        const product = await this.productRepo.findOne({
            where: { id },
            relations: ['attributes', 'categories'],
        });
        if (!product) {
            throw new common_1.NotFoundException(`Product with ID ${id} not found`);
        }
        if (updateProductDto.name !== undefined) {
            product.name = updateProductDto.name;
        }
        if (updateProductDto.description !== undefined) {
            product.description = updateProductDto.description;
        }
        if (updateProductDto.price !== undefined) {
            product.price = updateProductDto.price;
        }
        if (updateProductDto.hasAttributes !== undefined) {
            product.hasAttributes = updateProductDto.hasAttributes;
        }
        if (updateProductDto.attributes !== undefined) {
            await this.attributeRepo.delete({ product: { id } });
            const newAttributes = updateProductDto.attributes.map(attrDto => {
                const attr = new product_attribute_entity_1.ProductAttribute();
                attr.attributeName = attrDto.attributeName;
                attr.options = JSON.stringify(attrDto.options);
                attr.product = product;
                return attr;
            });
            await this.attributeRepo.save(newAttributes);
        }
        if (updateProductDto.categoryIds !== undefined) {
            if (updateProductDto.categoryIds.length > 0) {
                const categories = await this.categoryRepo.find({
                    where: { id: (0, typeorm_2.In)(updateProductDto.categoryIds) },
                });
                product.categories = categories;
            }
            else {
                product.categories = [];
            }
        }
        await this.productRepo.save(product);
        const updated = await this.productRepo.findOne({
            where: { id },
            relations: ['categories', 'attributes'],
        });
        if (!updated) {
            throw new common_1.NotFoundException(`Product with ID ${id} not found`);
        }
        return {
            ...updated,
            attributes: updated.attributes.map(attr => ({
                ...attr,
                options: JSON.parse(attr.options),
            })),
        };
    }
    remove(id) {
        return `This action removes a #${id} product`;
    }
};
exports.ProductsService = ProductsService;
exports.ProductsService = ProductsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(product_entity_1.Product)),
    __param(1, (0, typeorm_1.InjectRepository)(category_entity_1.Category)),
    __param(2, (0, typeorm_1.InjectRepository)(product_attribute_entity_1.ProductAttribute)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], ProductsService);
//# sourceMappingURL=products.service.js.map