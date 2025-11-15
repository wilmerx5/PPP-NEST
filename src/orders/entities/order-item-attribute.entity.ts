import { ApiProperty } from '@nestjs/swagger';
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

  @ApiProperty({
    description: 'ID autogenerado del atributo asociado a un ítem de la orden.',
    example: 77,
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    description: 'Nombre del atributo configurado para el producto.',
    example: 'Salsa',
    maxLength: 100,
  })
  @Column({ name: 'attribute_name', length: 100 })
  attributeName: string;

  @ApiProperty({
    description: 'Valor del atributo seleccionado.',
    example: 'BBQ',
    maxLength: 100,
  })
  @Column({ name: 'attribute_value', length: 100 })
  attributeValue: string;

  @ApiProperty({
    description: 'Ítem de la orden al que pertenece este atributo.',
    type: () => OrderItem,
  })
  @ManyToOne(() => OrderItem, (item) => item.attributes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'order_item_id' })
  orderItem: OrderItem;
}
