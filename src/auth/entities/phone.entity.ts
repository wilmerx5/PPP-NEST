import { ApiProperty } from "@nestjs/swagger";
import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { User } from "./user.entity";

@Entity('ppp_user_phones')
export class Phone {
  @ApiProperty({
    description: 'ID único del teléfono.',
    example: 1,
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    description: 'Usuario propietario del teléfono.',
    type: () => User,
  })
  @ManyToOne(() => User, (user) => user.phones, { onDelete: 'CASCADE' })
  user: User;

  @ApiProperty({
    description: 'ID del usuario propietario.',
    example: 'a3f1c9a9-7431-4e74-aed2-db70762e99ad',
  })
  @Column({ name: 'user_id' })
  userId: string;

  @ApiProperty({
    description: 'Número de teléfono.',
    example: '+57 300 123 4567',
  })
  @Column({ length: 20 })
  number: string;

  @ApiProperty({
    description: 'Nombre descriptivo del teléfono (ej: Personal, Trabajo, etc.).',
    example: 'Personal',
  })
  @Column({ length: 100 })
  label: string;

  @ApiProperty({
    description: 'Indica si este es el teléfono por defecto.',
    example: true,
    default: false,
  })
  @Column({ name: 'is_default', default: false })
  isDefault: boolean;

  @ApiProperty({
    description: 'Tipo de teléfono.',
    example: 'mobile',
    enum: ['mobile', 'home', 'work', 'other'],
    default: 'mobile',
  })
  @Column({
    type: 'enum',
    enum: ['mobile', 'home', 'work', 'other'],
    default: 'mobile',
  })
  type: 'mobile' | 'home' | 'work' | 'other';

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
