import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

@Entity('ppp_user_points')
export class UserPoints {
  @ApiProperty({
    description: 'ID único del registro de puntos.',
    example: 1,
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    description: 'Código alfanumérico único del punto (12 caracteres). Este es el código que se imprime en la factura.',
    example: 'A3F9K2M8P1Q7',
  })
  @Column({ length: 12, unique: true })
  code: string;

  @ApiProperty({
    description: 'Usuario al que pertenecen los puntos.',
  })
  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ name: 'user_id', nullable: true })
  userId: string | null;

  @ApiProperty({
    description: 'ID de la orden que generó este punto (null si fue registrado manualmente).',
    example: 125,
    nullable: true,
  })
  @Column({ name: 'order_id', type: 'int', nullable: true })
  orderId: number | null;

  @ApiProperty({
    description: 'Indica si el punto ya fue usado/reclamado por el usuario.',
    example: false,
    default: false,
  })
  @Column({ name: 'is_used', type: 'boolean', default: false })
  isUsed: boolean;

  @ApiProperty({
    description: 'Indica si el punto fue cancelado (la orden asociada fue cancelada).',
    example: false,
    default: false,
  })
  @Column({ name: 'is_canceled', type: 'boolean', default: false })
  isCanceled: boolean;

  @ApiProperty({
    description: 'Indica si el punto fue usado para crear un premio de redención.',
    example: false,
    default: false,
  })
  @Column({ name: 'is_redeemed', type: 'boolean', default: false })
  isRedeemed: boolean;

  @ApiProperty({
    description: 'Tipo de registro: automatic (de orden online), manual (registrado por cliente) o admin (generado por administrador).',
    example: 'automatic',
    enum: ['automatic', 'manual', 'admin'],
  })
  @Column({
    type: 'enum',
    enum: ['automatic', 'manual', 'admin'],
    default: 'automatic',
  })
  type: 'automatic' | 'manual' | 'admin';

  @ApiProperty({
    description: 'Número diario de la orden (para referencias).',
    example: 5,
    nullable: true,
  })
  @Column({ name: 'order_daily_number', type: 'int', nullable: true })
  orderDailyNumber: number | null;

  @ApiProperty({
    description: 'Descripción o notas del registro.',
    example: 'Punto de orden #5',
    nullable: true,
  })
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ApiProperty({
    description: 'Fecha de creación del registro.',
  })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
