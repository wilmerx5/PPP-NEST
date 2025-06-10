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
  ) { }

  create(createProductDto: CreateProductDto) {
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
        options: JSON.parse(attr.options), // <- transforma el JSON string a array
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
      imageUrl:category.imageUrl,
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
  findOne(id: number) {
    return `This action returns a #${id} product`;
  }

  update(id: number, updateProductDto: UpdateProductDto) {
    return `This action updates a #${id} product`;
  }

  remove(id: number) {
    return `This action removes a #${id} product`;
  }
}
