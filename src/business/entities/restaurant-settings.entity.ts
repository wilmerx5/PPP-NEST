import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export type DayHours = {
  dayOfWeek: number;
  closed: boolean;
  openTime: string;
  closeTime: string;
};

@Entity('ppp_restaurant_settings')
export class RestaurantSettings {
  @PrimaryColumn()
  id: number;

  @Column({ length: 64, default: 'America/Bogota' })
  timezone: string;

  /** 0=Domingo … 6=Sábado (JSON array). Derivado de weeklyHours. */
  @Column({ name: 'weekly_closed_days', type: 'json', nullable: true })
  weeklyClosedDays: number[] | null;

  @Column({ name: 'open_time', length: 5, default: '11:00' })
  openTime: string;

  @Column({ name: 'close_time', length: 5, default: '22:00' })
  closeTime: string;

  /** Horario por día (0=Dom … 6=Sáb). Si es null, se usa openTime/closeTime + weeklyClosedDays. */
  @Column({ name: 'weekly_hours', type: 'json', nullable: true })
  weeklyHours: DayHours[] | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
