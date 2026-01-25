import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from './entities/category.entity';
import { ProductAttribute } from './entities/product-attribute.entity';
import { Product } from './entities/product.entity';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { CommonModule } from '../common/common.module';

@Module({
  controllers: [ProductsController],
  imports: [TypeOrmModule.forFeature([Product, Category, ProductAttribute]), CommonModule],
  providers: [ProductsService],
})
export class ProductsModule {}
