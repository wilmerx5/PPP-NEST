import { ApiProperty } from '@nestjs/swagger';
import { Product } from 'src/products/entities/product.entity';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OrderItemAttribute } from './order-item-attribute.entity';
import { Order } from './order.entity';

@Entity('ppp_order_items')
export class OrderItem {

  @ApiProperty({
    description: 'ID autogenerado del ítem dentro de una orden.',
    example: 45,
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    description: 'Orden a la que pertenece este ítem.',
    type: () => Order,
  })
  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @ApiProperty({
    description: 'Producto asociado a este ítem.',
    type: () => Product,
    example: { id: 12, name: 'Pollo Asado' },
  })
  @ManyToOne(() => Product, (product) => product.orderItems)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  /** Precio unitario en el momento del pedido. NULL en órdenes antiguas → se usa product.price como fallback. */
  @Column({ name: 'unit_price', type: 'decimal', precision: 10, scale: 2, nullable: true })
  unitPrice?: number | null;

  @ApiProperty({
    description: 'Atributos seleccionados para el producto (salsas, bebidas, acompañamientos).',
    type: () => [OrderItemAttribute],
    required: false,
  })
  @OneToMany(() => OrderItemAttribute, (attr) => attr.orderItem, {
    cascade: true,
  })
  attributes: OrderItemAttribute[];

  @ApiProperty({
    description: 'Nota opcional asociada al producto (ej: sin cebolla, bien tostado).',
    example: 'Sin picante',
    required: false,
  })
  @Column({ type: 'text', nullable: false })
  note?: string;

  /** Cuando la cocina marca este ítem como preparado (orden en cooked/packing). Null = pendiente de cocina. */
  @Column({ name: 'kitchen_prepared_at', type: 'timestamp', nullable: true })
  kitchenPreparedAt?: Date | null;
}
