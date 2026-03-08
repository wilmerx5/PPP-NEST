import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { InventoryGroupItem } from './inventory-group-item.entity';
import { InventorySelectionProduct } from './inventory-selection-product.entity';

/**
 * Selección con nombre: ej. "Bebida". Agrupa varios productos (28, 37) bajo una sola opción en el modal.
 * Pertenece a un ítem del grupo (producto que se vende, ej. 22).
 */
@Entity('ppp_inventory_selection')
export class InventorySelection {
  @ApiProperty()
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 'Bebida', description: 'Nombre mostrado en el modal' })
  @Column({ length: 100 })
  name: string;

  @Column({ name: 'group_item_id' })
  groupItemId: number;

  @ManyToOne(() => InventoryGroupItem, (gi) => gi.selections, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_item_id' })
  groupItem: InventoryGroupItem;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @OneToMany(() => InventorySelectionProduct, (sp) => sp.selection)
  products: InventorySelectionProduct[];
}
