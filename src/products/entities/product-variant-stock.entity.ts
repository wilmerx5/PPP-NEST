import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Product } from './product.entity';

/**
 * Stock por variante (atributo): ej. producto código 28 "Bebida" con atributo "Sabor".
 * Cada opción (Limonada, Gaseosa, etc.) puede tener su propio stock.
 * Si existe fila para (product_id, attribute_name, attribute_value), las órdenes
 * descontarán de aquí en lugar del stock a nivel producto.
 */
@Entity('ppp_product_variant_stock')
@Index(['productId', 'attributeName', 'attributeValue'], { unique: true })
export class ProductVariantStock {
  @ApiProperty()
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'Producto (ej. código 28 Bebida)' })
  @Column({ name: 'product_id' })
  productId: number;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @ApiProperty({ example: 'Sabor', description: 'Nombre del atributo' })
  @Column({ name: 'attribute_name', length: 100 })
  attributeName: string;

  @ApiProperty({ example: 'Limonada', description: 'Valor de la opción' })
  @Column({ name: 'attribute_value', length: 100 })
  attributeValue: string;

  @ApiProperty({ example: 10, description: 'Unidades en stock para esta variante' })
  @Column({ type: 'int', default: 0 })
  stock: number;
}
