import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from '../../orders/entities/order.entity';

export type PaymentStatus = 
  | 'pending' 
  | 'approved' 
  | 'rejected' 
  | 'cancelled' 
  | 'refunded';

@Entity({ name: 'ppp_payments', synchronize: true })
export class Payment {
  @ApiProperty({
    description: 'ID autogenerado del pago.',
    example: 1,
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    description: 'ID de la orden asociada (null hasta que se confirme el pago).',
    example: 125,
    nullable: true,
  })
  @Column({ name: 'order_id', type: 'int', nullable: true })
  orderId: number | null;

  @ManyToOne(() => Order, { onDelete: 'CASCADE', eager: false })
  order: Order;

  @ApiProperty({
    description: 'ID de preferencia de Mercado Pago.',
    example: '123456789-abc123',
  })
  @Column({ name: 'preference_id', nullable: true })
  preferenceId: string;

  @ApiProperty({
    description: 'ID de pago de Mercado Pago.',
    example: '12345678901',
    nullable: true,
  })
  @Column({ name: 'payment_id', nullable: true })
  paymentId: string;

  @ApiProperty({
    description: 'Estado del pago.',
    example: 'approved',
    enum: ['pending', 'approved', 'rejected', 'cancelled', 'refunded'],
  })
  @Column({
    type: 'enum',
    enum: ['pending', 'approved', 'rejected', 'cancelled', 'refunded'],
    default: 'pending',
  })
  status: PaymentStatus;

  @ApiProperty({
    description: 'Monto del pago.',
    example: 50000.00,
  })
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @ApiProperty({
    description: 'Información adicional del pago (JSON).',
    example: { method: 'credit_card', installments: 1 },
    nullable: true,
  })
  @Column({ type: 'text', nullable: true })
  metadata: string;

  @ApiProperty({
    description: 'Fecha de creación del pago.',
    example: '2025-01-15T20:12:00.000Z',
  })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({
    description: 'Fecha de última actualización del pago.',
    example: '2025-01-15T20:15:00.000Z',
  })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
