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
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @ManyToOne(() => Product, (product) => product.orderItems)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @OneToMany(() => OrderItemAttribute, (attr) => attr.orderItem, {
    cascade: true,
  })
  attributes: OrderItemAttribute[];

  @Column({ type: 'text', nullable: false })
  note?: string;

}
