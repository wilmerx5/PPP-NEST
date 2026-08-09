import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('ppp_holiday_closures')
export class HolidayClosure {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'closure_date', type: 'date' })
  closureDate: string;

  @Column({ length: 255 })
  name: string;

  @Column({ name: 'all_day', type: 'boolean', default: true })
  allDay: boolean;

  @Column({ name: 'start_time', type: 'varchar', length: 5, nullable: true })
  startTime?: string | null;

  @Column({ name: 'end_time', type: 'varchar', length: 5, nullable: true })
  endTime?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
