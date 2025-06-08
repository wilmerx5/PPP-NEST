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
let ProductsService = class ProductsService {
    productRepo;
    categoryRepo;
    constructor(productRepo, categoryRepo) {
        this.productRepo = productRepo;
        this.categoryRepo = categoryRepo;
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
    async findProductsGroupedByCategory() {
        const categories = await this.categoryRepo.find({
            relations: ['products', 'products.attributes'],
            order: { id: 'ASC' }
        });
        return categories.map((category) => ({
            categoryId: category.id,
            categoryName: category.name,
            products: category.products.map((product) => ({
                id: product.id,
                name: product.name,
                description: product.description,
                code: product.code,
                price: product.price,
                hasAttributes: product.hasAttributes,
                attributes: product.attributes.map((attr) => ({
                    attributeName: attr.attributeName,
                    options: JSON.parse(attr.options)
                }))
            }))
        }));
    }
    findOne(id) {
        return `This action returns a #${id} product`;
    }
    update(id, updateProductDto) {
        return `This action updates a #${id} product`;
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
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], ProductsService);
//# sourceMappingURL=products.service.js.map