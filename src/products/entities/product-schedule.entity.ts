import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Product } from './product.entity';

@Entity('ppp_product_schedules')
export class ProductSchedule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'product_id' })
  productId: number;

  /** 0=Domingo … 6=Sábado */
  @Column({ name: 'day_of_week', type: 'tinyint' })
  dayOfWeek: number;

  /** HH:mm; null = todo el día */
  @Column({ name: 'start_time', type: 'varchar', length: 5, nullable: true })
  startTime?: string | null;

  @Column({ name: 'end_time', type: 'varchar', length: 5, nullable: true })
  endTime?: string | null;

  @ManyToOne(() => Product, (product) => product.schedules, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;
}
