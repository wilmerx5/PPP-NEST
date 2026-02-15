import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags
} from '@nestjs/swagger';

import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // -------------------------------------------------------------
  // CREATE PRODUCT
  // -------------------------------------------------------------
  @Post()
  @ApiOperation({ summary: 'Create a new product' })
  @ApiBody({ type: CreateProductDto })
  @ApiResponse({
    status: 201,
    description: 'Product created successfully (placeholder response)',
  })
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  // -------------------------------------------------------------
  // GET ALL PRODUCTS
  // -------------------------------------------------------------
  @Get()
  @ApiOperation({
    summary: 'Get all products',
    description:
      'Returns a list of all products including categories and parsed attributes.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of products retrieved successfully',
  })
  async getAllProducts() {
    return this.productsService.findAll();
  }

  // -------------------------------------------------------------
  // GET ALL CATEGORIES
  // -------------------------------------------------------------
  @Get('categories/list')
  @ApiOperation({
    summary: 'Get all categories',
    description: 'Returns a list of all available categories.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of categories retrieved successfully',
  })
  async getAllCategories() {
    return this.productsService.findAllCategories();
  }

  // -------------------------------------------------------------
  // GET PRODUCTS GROUPED BY CATEGORY
  // -------------------------------------------------------------
  @Get('categories')
  @ApiOperation({
    summary: 'Get products grouped by category',
    description:
      'Returns categories with their respective products and product attributes.',
  })
  @ApiResponse({
    status: 200,
    description: 'Products grouped by category retrieved successfully',
  })
  async getProductsByCategory() {
    return this.productsService.findProductsGroupedByCategory();
  }

  // -------------------------------------------------------------
  // CHECK PRODUCT BY CODE (exists + isActive, for order/mesas UX)
  // -------------------------------------------------------------
  @Get('check-code/:code')
  @ApiOperation({
    summary: 'Check product by code',
    description: 'Returns whether a product exists and if it is active. Used when adding by code to show "producto desactivado" message.',
  })
  @ApiParam({ name: 'code', description: 'Product code', example: 101 })
  @ApiResponse({ status: 200, description: '{ exists, isActive?, name? }' })
  async checkByCode(@Param('code') code: string) {
    return this.productsService.checkByCode(+code);
  }

  // -------------------------------------------------------------
  // GET ONE PRODUCT
  // -------------------------------------------------------------
  @Get(':id')
  @ApiOperation({ summary: 'Get a product by ID' })
  @ApiParam({ name: 'id', description: 'Product ID', example: 1 })
  @ApiResponse({
    status: 200,
    description: 'Product retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Product not found',
  })
  async findOne(@Param('id') id: string) {
    const product = await this.productsService.findOne(+id);
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  // -------------------------------------------------------------
  // UPDATE PRODUCT
  // -------------------------------------------------------------
  @Patch(':id')
  @ApiOperation({ summary: 'Update product by ID' })
  @ApiParam({ name: 'id', description: 'Product ID', example: 1 })
  @ApiBody({ type: UpdateProductDto })
  @ApiResponse({
    status: 200,
    description: 'Product updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Product not found',
  })
  async update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(+id, updateProductDto);
  }

  // -------------------------------------------------------------
  // DELETE PRODUCT
  // -------------------------------------------------------------
  @Delete(':id')
  @ApiOperation({ summary: 'Delete product by ID' })
  @ApiParam({ name: 'id', description: 'Product ID', example: 1 })
  @ApiResponse({
    status: 200,
    description: 'Product removed successfully (placeholder response)',
  })
  @ApiResponse({
    status: 404,
    description: 'Product not found',
  })
  remove(@Param('id') id: string) {
    return this.productsService.remove(+id);
  }
}
