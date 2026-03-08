import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { InventoryGroupItem } from './inventory-group-item.entity';

/**
 * Grupo de inventario: varios productos comparten un mismo stock en "unidades base".
 * Ej: Pollo completo (1), medio (0.5), cuarto (0.25), bandeja cuarto (0.25).
 * El stock del grupo está en unidades base (ej. 10 = 10 pollos completos = 20 medios = 40 cuartos).
 */
@Entity('ppp_inventory_group')
export class InventoryGroup {
  @ApiProperty()
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 'Pollo', description: 'Nombre del grupo' })
  @Column({ length: 100 })
  name: string;

  /** Stock en unidades base (decimal). Ej: 10 = 10 pollos completos. */
  @ApiProperty({ example: 10 })
  @Column({ type: 'decimal', precision: 12, scale: 4, default: 0 })
  stock: number;

  @OneToMany(() => InventoryGroupItem, (item) => item.group)
  items: InventoryGroupItem[];
}
