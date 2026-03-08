import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { InventorySelection } from './inventory-selection.entity';
import { Product } from './product.entity';

/**
 * Producto que forma parte de una selección (ej. producto 28 o 37 en la selección "Bebida").
 */
@Entity('ppp_inventory_selection_product')
export class InventorySelectionProduct {
  @ApiProperty()
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'selection_id' })
  selectionId: number;

  @ManyToOne(() => InventorySelection, (s) => s.products, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'selection_id' })
  selection: InventorySelection;

  @Column({ name: 'product_id' })
  productId: number;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @ApiProperty({ example: 0.1 })
  @Column({ name: 'base_units', type: 'decimal', precision: 10, scale: 4, default: 0 })
  baseUnits: number;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
