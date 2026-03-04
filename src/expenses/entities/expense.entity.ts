import { ApiProperty } from '@nestjs/swagger';
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export const EXPENSE_CATEGORIES = [
  'proveedores',
  'impuestos',
  'nomina',
  'arriendo',
  'servicios',
  'otros',
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

@Entity({ name: 'ppp_expenses' })
export class Expense {
  @ApiProperty()
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ enum: EXPENSE_CATEGORIES, description: 'Categoría del egreso' })
  @Column({ type: 'varchar', length: 50 })
  category: string;

  @ApiProperty({ description: 'Nombre o concepto del egreso' })
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @ApiProperty({ description: 'Monto del egreso (positivo)' })
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  /**
   * Fecha del egreso (día en zona Bogotá).
   * Se guarda como DATE; las consultas por rango usan la misma lógica que órdenes (getBogotaDateRange).
   */
  @ApiProperty({ example: '2025-01-15' })
  @Column({ name: 'expense_date', type: 'date' })
  expenseDate: string;

  @ApiProperty({ required: false })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
