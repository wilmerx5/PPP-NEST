import { ApiProperty } from '@nestjs/swagger';
import { OrderItem } from 'src/orders/entities/order-item.entity';
import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn
} from 'typeorm';
import { Category } from './category.entity';
import { ProductAttribute } from './product-attribute.entity';

@Entity('ppp_products')
export class Product {

  @ApiProperty({
    description: 'ID autogenerado del producto.',
    example: 1,
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    description: 'Nombre del producto.',
    example: 'Pollo Asado Familiar',
    maxLength: 100,
  })
  @Column({ length: 100 })
  name: string;

  @ApiProperty({
    description: 'Descripción del producto.',
    example: 'Pollo asado a la leña acompañado de papas criollas.',
    required: false,
  })
  @Column({ type: 'text', nullable: true })
  description?: string;

  @ApiProperty({
    description: 'Precio del producto.',
    example: 29900,
    type: Number,
  })
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @ApiProperty({
    description:
      'Indica si el producto tiene atributos configurables (bebida, salsa, acompañamiento, etc).',
    example: true,
    default: false,
  })
  @Column({ name: 'has_attributes', type: 'boolean', default: false })
  hasAttributes: boolean;

  @ApiProperty({
    description: 'Código único del producto. Usado en POS o pedidos rápidos.',
    example: 101,
    type: Number,
    uniqueItems: true,
  })
  @Column({ type: 'int', unique: true })
  code: number;

  @ApiProperty({
    description: 'Si el producto está activo y visible en listados y pedidos.',
    example: true,
    default: true,
  })
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  // ------------------------------------------------------------------------
  // Atributos configurables
  // ------------------------------------------------------------------------
  @ApiProperty({
    description: 'Lista de atributos configurables del producto.',
    type: () => [ProductAttribute],
    required: false,
  })
  @OneToMany(() => ProductAttribute, (attr) => attr.product, { cascade: true })
  attributes: ProductAttribute[];

  // ------------------------------------------------------------------------
  // Categorías
  // ------------------------------------------------------------------------
  @ApiProperty({
    description: 'Categorías a las que pertenece este producto.',
    type: () => [Category],
  })
  @ManyToMany(() => Category, (category) => category.products, { cascade: true })
  @JoinTable({
    name: 'ppp_product_categories',
    joinColumn: { name: 'product_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'category_id', referencedColumnName: 'id' },
  })
  categories: Category[];

  // ------------------------------------------------------------------------
  // Items de órdenes
  // ------------------------------------------------------------------------
  @ApiProperty({
    description: 'Items de órdenes donde este producto fue utilizado.',
    type: () => [OrderItem],
    required: false,
  })
  @OneToMany(() => OrderItem, (item) => item.product)
  orderItems: OrderItem[];

  @ApiProperty({
    description: 'URL de la imagen del producto.',
    example: 'https://cdn.prontopollo.com/products/pollo-asado.png',
    required: false,
  })
  @Column({ type: 'varchar', nullable: true, name: 'image_url' })
  imageUrl: string;
}
