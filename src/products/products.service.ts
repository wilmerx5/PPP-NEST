import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Category } from './entities/category.entity';
import { Product } from './entities/product.entity';
import { ProductAttribute } from './entities/product-attribute.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,

    @InjectRepository(ProductAttribute)
    private readonly attributeRepo: Repository<ProductAttribute>
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
   * Get all categories.
   *
   * @returns {Promise<Category[]>} List of all categories.
   */
  async findAllCategories() {
    return this.categoryRepo.find({
      order: { id: 'ASC' },
    });
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
   * Updates product fields (name, description, price, hasAttributes) and attributes.
   * 
   * @param id - Product ID.
   * @param updateProductDto - DTO with update data.
   * @returns {Promise<Product>} Updated product with transformed attributes.
   */
  async update(id: number, updateProductDto: UpdateProductDto) {
    const product = await this.productRepo.findOne({
      where: { id },
      relations: ['attributes', 'categories'],
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    // Update basic fields
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

    // Update attributes if provided
    if (updateProductDto.attributes !== undefined) {
      // Remove all existing attributes (so we don't duplicate when saving product)
      await this.attributeRepo
        .createQueryBuilder()
        .delete()
        .where('product_id = :id', { id })
        .execute();

      // Create and save new attributes
      const newAttributes = updateProductDto.attributes.map(attrDto => {
        const attr = new ProductAttribute();
        attr.attributeName = attrDto.attributeName;
        attr.options = JSON.stringify(attrDto.options);
        attr.product = product;
        return attr;
      });

      const savedAttributes = await this.attributeRepo.save(newAttributes);
      // Replace in-memory relation so cascade on product.save doesn't re-persist old (deleted) attributes
      product.attributes = savedAttributes;
    }

    // Update categories if provided
    if (updateProductDto.categoryIds !== undefined) {
      if (updateProductDto.categoryIds.length > 0) {
        const categories = await this.categoryRepo.find({
          where: { id: In(updateProductDto.categoryIds) },
        });
        product.categories = categories;
      } else {
        product.categories = [];
      }
    }

    // Save product changes
    await this.productRepo.save(product);

    // Return updated product with transformed attributes
    const updated = await this.productRepo.findOne({
      where: { id },
      relations: ['categories', 'attributes'],
    });

    if (!updated) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return {
      ...updated,
      attributes: updated.attributes.map(attr => ({
        ...attr,
        options: JSON.parse(attr.options),
      })),
    };
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
