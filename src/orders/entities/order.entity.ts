import { ApiProperty } from '@nestjs/swagger';
import {
    Column,
    CreateDateColumn,
    Entity,
    OneToMany,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { OrderItem } from './order-item.entity';

export type OrderType = 'delivery' | 'pickup' | 'table' | 'counter';
export type OrderStatus = 'cooking' | 'cooked'| 'packing' | 'canceled'|'inDelivery' |'completed';

@Entity({name:'ppp_orders',synchronize: true})
export class Order {

  @ApiProperty({
    description: 'ID autogenerado de la orden.',
    example: 125,
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    description: 'Nombre del cliente que realiza la orden.',
    example: 'Carlos López',
  })
  @Column({ name: 'customer_name', length: 100 })
  customerName: string;

  @ApiProperty({
    description: 'Número telefónico del cliente.',
    example: '+57 300 456 7890',
  })
  @Column({ length: 20 })
  phone: string;

  @ApiProperty({
    description: 'Dirección de entrega del cliente.',
    example: 'Calle 123 #45-67, Bogotá',
  })
  @Column({ type: 'text' })
  address: string;

  @ApiProperty({
    description: 'Fecha de creación de la orden.',
    example: '2025-11-14T20:12:00.000Z',
  })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({
    description: 'Lista de items incluidos en la orden.',
    type: () => [OrderItem],
  })
  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: OrderItem[];

  @ApiProperty({
    description: 'Número consecutivo de la orden dentro del día.',
    example: 7,
    nullable: true,
  })
  @Column({ name: 'daily_order_number', type: 'int', nullable: true })
  dailyOrderNumber: number;

  @ApiProperty({
    description: 'Tipo de la orden.',
    example: 'pickup',
    enum: ['delivery', 'pickup', 'table', 'counter'],
  })
  @Column({
    type: 'enum',
    enum: ['delivery', 'pickup', 'table', 'counter'],
    default: 'pickup',
    name: 'order_type',
  })
  orderType: OrderType;

  @ApiProperty({
    description: 'Estado actual de la orden.',
    example: 'cooking',
    enum: ['cooking', 'packing', 'canceled', 'completed'],
  })
  @Column({
    type: 'enum',
    enum: ['cooking' , 'cooked', 'packing' , 'canceled','inDelivery' ,'completed'],
    default: 'cooking',
    name: 'order_status',
  })
  orderStatus: OrderStatus;

  @ApiProperty({
    description: 'Indica si la orden ya fue impresa.',
    example: false,
  })
  @Column({ type: 'boolean', default: false })
  printed: boolean;

}
