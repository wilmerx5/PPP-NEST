import { ApiProperty } from "@nestjs/swagger";
import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { User } from "./user.entity";

@Entity('ppp_user_addresses')
export class Address {
  @ApiProperty({
    description: 'ID único de la dirección.',
    example: 1,
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    description: 'Usuario propietario de la dirección.',
    type: () => User,
  })
  @ManyToOne(() => User, (user) => user.addresses, { onDelete: 'CASCADE' })
  user: User;

  @ApiProperty({
    description: 'ID del usuario propietario.',
    example: 'a3f1c9a9-7431-4e74-aed2-db70762e99ad',
  })
  @Column({ name: 'user_id' })
  userId: string;

  @ApiProperty({
    description: 'Nombre descriptivo de la dirección (ej: Casa, Trabajo, etc.).',
    example: 'Casa',
  })
  @Column({ length: 100 })
  label: string;

  @ApiProperty({
    description: 'Dirección completa.',
    example: 'Calle 123 #45-67, Bogotá',
  })
  @Column({ type: 'text' })
  address: string;

  @ApiProperty({
    description: 'Indica si esta es la dirección por defecto.',
    example: true,
    default: false,
  })
  @Column({ name: 'is_default', default: false })
  isDefault: boolean;

  @ApiProperty({
    description: 'Tipo de dirección.',
    example: 'home',
    enum: ['home', 'work', 'other'],
    default: 'other',
  })
  @Column({
    type: 'enum',
    enum: ['home', 'work', 'other'],
    default: 'other',
  })
  type: 'home' | 'work' | 'other';

  @ApiProperty({
    description: 'Información adicional (barrio, referencias, etc.).',
    example: 'Cerca del parque principal',
    required: false,
  })
  @Column({ type: 'text', nullable: true })
  notes?: string;

  @ApiProperty({
    description: 'Fecha de creación.',
    example: '2025-01-18T10:00:00.000Z',
  })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({
    description: 'Fecha de última actualización.',
    example: '2025-01-18T10:00:00.000Z',
  })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
