import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { InventoryGroup } from './inventory-group.entity';
import { InventorySelection } from './inventory-selection.entity';
import { Product } from './product.entity';

/**
 * Producto dentro de un grupo: cuántas unidades base consume por unidad vendida.
 * Ej: producto "Cuarto de pollo" (code 3) → base_units = 0.25.
 */
@Entity('ppp_inventory_group_item')
@Index(['groupId', 'productId', 'attributeName', 'attributeValue'], { unique: true })
export class InventoryGroupItem {
  @ApiProperty()
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'group_id' })
  groupId: number;

  @ManyToOne(() => InventoryGroup, (g) => g.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group: InventoryGroup;

  @Column({ name: 'product_id' })
  productId: number;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  /** Vacío = nivel producto; si tiene valor = esta variante del producto comparte el pool del grupo. */
  @ApiProperty({ required: false })
  @Column({ name: 'attribute_name', length: 100, default: '' })
  attributeName: string;

  @ApiProperty({ required: false })
  @Column({ name: 'attribute_value', length: 100, default: '' })
  attributeValue: string;

  /** Unidades base por unidad vendida. Ej: 1 pollo completo = 1, medio = 0.5, cuarto = 0.25. */
  @ApiProperty({ example: 0.25 })
  @Column({ name: 'base_units', type: 'decimal', precision: 10, scale: 4 })
  baseUnits: number;

  /** Opcional: al vender este producto, también descontar de esta variante de otro producto. */
  @ApiProperty({ required: false })
  @Column({ name: 'also_deduct_product_id', type: 'int', nullable: true })
  alsoDeductProductId: number | null;

  @Column({ name: 'also_deduct_attribute_name', type: 'varchar', length: 100, nullable: true })
  alsoDeductAttributeName: string | null;

  @Column({ name: 'also_deduct_attribute_value', type: 'varchar', length: 100, nullable: true })
  alsoDeductAttributeValue: string | null;

  @Column({ name: 'also_deduct_base_units', type: 'decimal', precision: 10, scale: 4, nullable: true })
  alsoDeductBaseUnits: number | null;

  @OneToMany(() => InventorySelection, (s) => s.groupItem)
  selections: InventorySelection[];
}
