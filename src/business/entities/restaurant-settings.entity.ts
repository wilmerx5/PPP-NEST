import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('ppp_restaurant_settings')
export class RestaurantSettings {
  @PrimaryColumn()
  id: number;

  @Column({ length: 64, default: 'America/Bogota' })
  timezone: string;

  /** 0=Domingo … 6=Sábado (JSON array). */
  @Column({ name: 'weekly_closed_days', type: 'json', nullable: true })
  weeklyClosedDays: number[] | null;

  @Column({ name: 'open_time', length: 5, default: '11:00' })
  openTime: string;

  @Column({ name: 'close_time', length: 5, default: '22:00' })
  closeTime: string;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
