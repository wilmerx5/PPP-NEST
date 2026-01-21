import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Index,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('ppp_point_redemptions')
@Index(['userId'])
export class PointRedemption {
  @ApiProperty({
    description: 'ID único del premio de redención.',
    example: 1,
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    description: 'Código único del premio (12 caracteres alfanuméricos). Este es el código que se usa para canjear medio pollo gratis.',
    example: 'REDEEM9PTSX7',
  })
  @Column({ length: 12, unique: true })
  code: string;

  @ApiProperty({
    description: 'Usuario que redimió los puntos.',
  })
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @ApiProperty({
    description: 'Indica si el premio ya fue usado.',
    example: false,
    default: false,
  })
  @Column({ name: 'is_used', type: 'boolean', default: false })
  isUsed: boolean;

  @ApiProperty({
    description: 'Fecha en que se usó el premio (null si aún no se ha usado).',
    example: '2025-01-15T10:30:00.000Z',
    nullable: true,
  })
  @Column({ name: 'used_at', type: 'timestamp', nullable: true })
  usedAt: Date | null;

  @ApiProperty({
    description: 'ID de la orden donde se aplicó el premio (null si aún no se ha usado).',
    example: 125,
    nullable: true,
  })
  @Column({ name: 'used_in_order_id', type: 'int', nullable: true })
  usedInOrderId: number | null;

  @ApiProperty({
    description: 'Fecha de creación del premio.',
  })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({
    description: 'Fecha de última actualización.',
  })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ApiProperty({
    description: 'Fecha de expiración del premio (opcional, null = sin expiración).',
    example: '2025-02-15T10:30:00.000Z',
    nullable: true,
  })
  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date | null;
}
