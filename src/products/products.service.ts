import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Category } from './entities/category.entity';
import { Product } from './entities/product.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>
  ) {}

  /**
   * Create a new product.
   * Currently returns a placeholder message.
   *
   * @param createProductDto - DTO containing product creation data.
   * @returns {string} Confirmation message.
   */
  create(createProductDto: CreateProductDto) {
    return 'This action adds a new product';
  }

  /**
   * Get all products with their categories and attributes.
   * - Loads relations: categories, attributes
   * - Transforms attribute.options from string → JSON array
   *
   * @returns {Promise<any[]>} List of transformed products.
   */
  async findAll() {
    const products = await this.productRepo.find({
      relations: ['categories', 'attributes'],
      order: { id: 'ASC' },
    });

    return products.map(product => ({
      ...product,

      // Convert the "options" string into a JSON array
      attributes: product.attributes.map(attr => ({
        ...attr,
        options: JSON.parse(attr.options),
      })),
    }));
  }

  /**
   * Returns a list of categories,
   * each category containing its list of products grouped by category.
   *
   * Each product contains:
   * - Basic info (id, name, price...)
   * - Attributes (converted from JSON string to JS array)
   *
   * @returns {Promise<any[]>} Categories with grouped products.
   */
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

  /**
   * Find a single product by ID with its categories and attributes.
   * - Loads relations: categories, attributes
   * - Transforms attribute.options from string → JSON array
   *
   * @param id - Product ID.
   * @returns {Promise<any>} Product with transformed attributes.
   */
  async findOne(id: number) {
    const product = await this.productRepo.findOne({
      where: { id },
      relations: ['categories', 'attributes'],
    });

    if (!product) {
      return null;
    }

    return {
      ...product,
      // Convert the "options" string into a JSON array
      attributes: product.attributes.map(attr => ({
        ...attr,
        options: JSON.parse(attr.options),
      })),
    };
  }

  /**
   * Update product by ID.
   * Currently returns placeholder text.
   *
   * @param id - Product ID.
   * @param updateProductDto - DTO with update data.
   * @returns {string} Placeholder result.
   */
  update(id: number, updateProductDto: UpdateProductDto) {
    return `This action updates a #${id} product`;
  }

  /**
   * Remove a product by ID.
   * Currently returns placeholder text.
   *
   * @param id - Product ID.
   * @returns {string} Placeholder result.
   */
  remove(id: number) {
    return `This action removes a #${id} product`;
  }
}
