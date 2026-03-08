import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from './entities/category.entity';
import { ProductAttribute } from './entities/product-attribute.entity';
import { Product } from './entities/product.entity';
import { ProductVariantStock } from './entities/product-variant-stock.entity';
import { InventoryGroup } from './entities/inventory-group.entity';
import { InventoryGroupItem } from './entities/inventory-group-item.entity';
import { InventorySelection } from './entities/inventory-selection.entity';
import { InventorySelectionProduct } from './entities/inventory-selection-product.entity';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { CommonModule } from '../common/common.module';

@Module({
  controllers: [ProductsController],
  imports: [
    TypeOrmModule.forFeature([
      Product,
      Category,
      ProductAttribute,
      ProductVariantStock,
      InventoryGroup,
      InventoryGroupItem,
      InventorySelection,
      InventorySelectionProduct,
    ]),
    CommonModule,
  ],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
