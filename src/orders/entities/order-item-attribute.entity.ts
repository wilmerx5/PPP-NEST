import {
    Column,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn
} from 'typeorm';
import { OrderItem } from './order-item.entity';
  
  @Entity('ppp_order_item_attributes')
  export class OrderItemAttribute {
    @PrimaryGeneratedColumn()
    id: number;
  
    @Column({ name: 'attribute_name', length: 100 })
    attributeName: string;
  
    @Column({ name: 'attribute_value', length: 100 })
    attributeValue: string;
  
    @ManyToOne(() => OrderItem, (item) => item.attributes, {
      onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'order_item_id' })
    orderItem: OrderItem;
  }
  