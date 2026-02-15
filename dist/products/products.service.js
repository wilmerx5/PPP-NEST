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
const cache_service_1 = require("../common/cache/cache.service");
const circuit_breaker_service_1 = require("../common/circuit-breaker/circuit-breaker.service");
let ProductsService = class ProductsService {
    productRepo;
    categoryRepo;
    attributeRepo;
    cache;
    circuitBreaker;
    CACHE_KEY_ALL = 'products:all';
    CACHE_KEY_CATEGORIES = 'products:categories';
    CACHE_KEY_GROUPED = 'products:grouped';
    CACHE_TTL = 45000;
    constructor(productRepo, categoryRepo, attributeRepo, cache, circuitBreaker) {
        this.productRepo = productRepo;
        this.categoryRepo = categoryRepo;
        this.attributeRepo = attributeRepo;
        this.cache = cache;
        this.circuitBreaker = circuitBreaker;
    }
    create(createProductDto) {
        this.cache.invalidate('products:');
        return 'This action adds a new product';
    }
    async findAll() {
        const cached = this.cache.get(this.CACHE_KEY_ALL);
        if (cached)
            return cached;
        const result = await this.circuitBreaker.execute(async () => {
            const products = await this.productRepo.find({
                where: { isActive: true },
                relations: ['categories', 'attributes'],
                order: { id: 'ASC' },
            });
            const transformed = products.map((product) => ({
                ...product,
                attributes: product.attributes.map((attr) => ({
                    ...attr,
                    options: JSON.parse(attr.options),
                })),
            }));
            this.cache.set(this.CACHE_KEY_ALL, transformed, this.CACHE_TTL);
            return transformed;
        }, async () => {
            const stale = this.cache.get(this.CACHE_KEY_ALL);
            return stale || [];
        });
        return result || [];
    }
    async findAllCategories() {
        const cached = this.cache.get(this.CACHE_KEY_CATEGORIES);
        if (cached)
            return cached;
        const result = await this.circuitBreaker.execute(async () => {
            const categories = await this.categoryRepo.find({ order: { id: 'ASC' } });
            this.cache.set(this.CACHE_KEY_CATEGORIES, categories, this.CACHE_TTL);
            return categories;
        }, async () => {
            const stale = this.cache.get(this.CACHE_KEY_CATEGORIES);
            return stale || [];
        });
        return result || [];
    }
    async findProductsGroupedByCategory() {
        const cached = this.cache.get(this.CACHE_KEY_GROUPED);
        if (cached)
            return cached;
        const result = await this.circuitBreaker.execute(async () => {
            const categories = await this.categoryRepo.find({
                relations: ['products', 'products.attributes'],
                order: { id: 'ASC' },
            });
            const transformed = categories
                .filter((category) => category != null)
                .map((category) => ({
                categoryId: category.id,
                categoryName: category.name,
                imageUrl: category.imageUrl,
                products: (category.products || [])
                    .filter((product) => product != null && product.isActive !== false)
                    .map((product) => ({
                    id: product.id,
                    name: product.name,
                    description: product.description,
                    code: product.code,
                    price: product.price,
                    imageUrl: product.imageUrl,
                    hasAttributes: product.hasAttributes,
                    attributes: (product.attributes || [])
                        .filter((attr) => attr != null)
                        .map((attr) => ({
                        attributeName: attr.attributeName,
                        options: JSON.parse(attr.options || '[]'),
                    })),
                })),
            }));
            this.cache.set(this.CACHE_KEY_GROUPED, transformed, this.CACHE_TTL);
            return transformed;
        }, async () => {
            const stale = this.cache.get(this.CACHE_KEY_GROUPED);
            return stale || [];
        });
        return result || [];
    }
    async findAllForAdmin() {
        const products = await this.productRepo.find({
            relations: ['categories', 'attributes'],
            order: { id: 'ASC' },
        });
        return products.map((product) => ({
            ...product,
            attributes: product.attributes.map((attr) => ({
                ...attr,
                options: JSON.parse(attr.options || '[]'),
            })),
        }));
    }
    async updateActive(id, isActive) {
        const product = await this.productRepo.findOne({ where: { id } });
        if (!product) {
            throw new common_1.NotFoundException(`Product with ID ${id} not found`);
        }
        product.isActive = isActive;
        await this.productRepo.save(product);
        this.cache.invalidate('products:');
        return { success: true, product: { id: product.id, isActive: product.isActive } };
    }
    async checkByCode(code) {
        const product = await this.productRepo.findOne({
            where: { code },
            select: ['id', 'name', 'isActive'],
        });
        if (!product) {
            return { exists: false };
        }
        return {
            exists: true,
            isActive: product.isActive !== false,
            name: product.name,
        };
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
            await this.attributeRepo
                .createQueryBuilder()
                .delete()
                .where('product_id = :id', { id })
                .execute();
            const newAttributes = updateProductDto.attributes.map(attrDto => {
                const attr = new product_attribute_entity_1.ProductAttribute();
                attr.attributeName = attrDto.attributeName;
                attr.options = JSON.stringify(attrDto.options);
                attr.product = product;
                return attr;
            });
            const savedAttributes = await this.attributeRepo.save(newAttributes);
            product.attributes = savedAttributes;
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
        this.cache.invalidate('products:');
        const updated = await this.productRepo.findOne({
            where: { id },
            relations: ['categories', 'attributes'],
        });
        if (!updated) {
            throw new common_1.NotFoundException(`Product with ID ${id} not found`);
        }
        return {
            ...updated,
            attributes: updated.attributes.map((attr) => ({
                ...attr,
                options: JSON.parse(attr.options),
            })),
        };
    }
    remove(id) {
        this.cache.invalidate('products:');
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
        typeorm_2.Repository,
        cache_service_1.CacheService,
        circuit_breaker_service_1.CircuitBreakerService])
], ProductsService);
//# sourceMappingURL=products.service.js.map