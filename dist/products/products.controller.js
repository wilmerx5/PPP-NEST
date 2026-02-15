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
exports.ProductsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const create_product_dto_1 = require("./dto/create-product.dto");
const update_product_dto_1 = require("./dto/update-product.dto");
const products_service_1 = require("./products.service");
let ProductsController = class ProductsController {
    productsService;
    constructor(productsService) {
        this.productsService = productsService;
    }
    create(createProductDto) {
        return this.productsService.create(createProductDto);
    }
    async getAllProducts() {
        return this.productsService.findAll();
    }
    async getAllCategories() {
        return this.productsService.findAllCategories();
    }
    async getProductsByCategory() {
        return this.productsService.findProductsGroupedByCategory();
    }
    async checkByCode(code) {
        return this.productsService.checkByCode(+code);
    }
    async findOne(id) {
        const product = await this.productsService.findOne(+id);
        if (!product) {
            throw new common_1.NotFoundException(`Product with ID ${id} not found`);
        }
        return product;
    }
    async update(id, updateProductDto) {
        return this.productsService.update(+id, updateProductDto);
    }
    remove(id) {
        return this.productsService.remove(+id);
    }
};
exports.ProductsController = ProductsController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new product' }),
    (0, swagger_1.ApiBody)({ type: create_product_dto_1.CreateProductDto }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: 'Product created successfully (placeholder response)',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_product_dto_1.CreateProductDto]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Get all products',
        description: 'Returns a list of all products including categories and parsed attributes.',
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'List of products retrieved successfully',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ProductsController.prototype, "getAllProducts", null);
__decorate([
    (0, common_1.Get)('categories/list'),
    (0, swagger_1.ApiOperation)({
        summary: 'Get all categories',
        description: 'Returns a list of all available categories.',
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'List of categories retrieved successfully',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ProductsController.prototype, "getAllCategories", null);
__decorate([
    (0, common_1.Get)('categories'),
    (0, swagger_1.ApiOperation)({
        summary: 'Get products grouped by category',
        description: 'Returns categories with their respective products and product attributes.',
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Products grouped by category retrieved successfully',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ProductsController.prototype, "getProductsByCategory", null);
__decorate([
    (0, common_1.Get)('check-code/:code'),
    (0, swagger_1.ApiOperation)({
        summary: 'Check product by code',
        description: 'Returns whether a product exists and if it is active. Used when adding by code to show "producto desactivado" message.',
    }),
    (0, swagger_1.ApiParam)({ name: 'code', description: 'Product code', example: 101 }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '{ exists, isActive?, name? }' }),
    __param(0, (0, common_1.Param)('code')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProductsController.prototype, "checkByCode", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get a product by ID' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Product ID', example: 1 }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Product retrieved successfully',
    }),
    (0, swagger_1.ApiResponse)({
        status: 404,
        description: 'Product not found',
    }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProductsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Update product by ID' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Product ID', example: 1 }),
    (0, swagger_1.ApiBody)({ type: update_product_dto_1.UpdateProductDto }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Product updated successfully',
    }),
    (0, swagger_1.ApiResponse)({
        status: 404,
        description: 'Product not found',
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_product_dto_1.UpdateProductDto]),
    __metadata("design:returntype", Promise)
], ProductsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Delete product by ID' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Product ID', example: 1 }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Product removed successfully (placeholder response)',
    }),
    (0, swagger_1.ApiResponse)({
        status: 404,
        description: 'Product not found',
    }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "remove", null);
exports.ProductsController = ProductsController = __decorate([
    (0, swagger_1.ApiTags)('Products'),
    (0, common_1.Controller)('products'),
    __metadata("design:paramtypes", [products_service_1.ProductsService])
], ProductsController);
//# sourceMappingURL=products.controller.js.map