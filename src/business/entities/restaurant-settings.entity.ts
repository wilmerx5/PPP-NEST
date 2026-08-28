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

  /** Domicilio web (checkout): tarifa de respaldo si no hay ruta. */
  @Column({ name: 'web_delivery_default_fee', type: 'int', default: 4000 })
  webDeliveryDefaultFee: number;

  /** Cobertura máxima en km de ruta para pedidos online. */
  @Column({ name: 'web_delivery_max_km', type: 'decimal', precision: 6, scale: 2, nullable: true })
  webDeliveryMaxKm: number | string | null;

  /** [{ maxKm, fee }] — tramos para ppp-front */
  @Column({ name: 'web_delivery_fee_tiers', type: 'json', nullable: true })
  webDeliveryFeeTiers: unknown | null;

  /** Impuestos FE por ítem: [{ code, rate, isExcluded? }] — admin / SaaS */
  @Column({ name: 'factus_item_taxes', type: 'json', nullable: true })
  factusItemTaxes: Array<{ code: string; rate: number; isExcluded?: boolean }> | null;

  /** true = precios del menú ya incluyen los impuestos de factus_item_taxes */
  @Column({ name: 'factus_prices_include_tax', type: 'boolean', nullable: true })
  factusPricesIncludeTax: boolean | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
