import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('ppp_whatsapp_settings')
export class WhatsappSettings {
  @PrimaryColumn({ type: 'int' })
  id: number;

  @Column({ type: 'boolean', default: false })
  enabled: boolean;

  @Column({ name: 'display_phone', type: 'varchar', length: 32, nullable: true })
  displayPhone: string | null;

  @Column({ name: 'phone_number_id', type: 'varchar', length: 64, nullable: true })
  phoneNumberId: string | null;

  @Column({ name: 'waba_id', type: 'varchar', length: 64, nullable: true })
  wabaId: string | null;

  @Column({ name: 'access_token', type: 'text', nullable: true })
  accessToken: string | null;

  @Column({ name: 'verify_token', type: 'varchar', length: 128, nullable: true })
  verifyToken: string | null;

  @Column({ name: 'openai_api_key', type: 'text', nullable: true })
  openaiApiKey: string | null;

  @Column({ name: 'openai_model', type: 'varchar', length: 64, default: 'gpt-4o-mini' })
  openaiModel: string;

  @Column({ name: 'system_prompt', type: 'text', nullable: true })
  systemPrompt: string | null;

  @Column({ name: 'default_delivery_fee', type: 'int', default: 2000 })
  defaultDeliveryFee: number;

  @Column({ name: 'allow_mercado_pago', type: 'boolean', default: true })
  allowMercadoPago: boolean;

  @Column({ name: 'welcome_message', type: 'text', nullable: true })
  welcomeMessage: string | null;

  /** Contexto del local para la IA */
  @Column({ name: 'restaurant_name', type: 'varchar', length: 120, nullable: true })
  restaurantName: string | null;

  @Column({ name: 'restaurant_address', type: 'varchar', length: 500, nullable: true })
  restaurantAddress: string | null;

  @Column({ name: 'restaurant_city', type: 'varchar', length: 120, nullable: true })
  restaurantCity: string | null;

  @Column({ name: 'restaurant_neighborhood', type: 'varchar', length: 120, nullable: true })
  restaurantNeighborhood: string | null;

  @Column({ name: 'maps_url', type: 'varchar', length: 500, nullable: true })
  mapsUrl: string | null;

  @Column({ name: 'public_phone', type: 'varchar', length: 40, nullable: true })
  publicPhone: string | null;

  @Column({ name: 'landmarks', type: 'text', nullable: true })
  landmarks: string | null;

  @Column({ name: 'pickup_notes', type: 'text', nullable: true })
  pickupNotes: string | null;

  @Column({ name: 'delivery_notes', type: 'text', nullable: true })
  deliveryNotes: string | null;

  @Column({ name: 'ai_extra_context', type: 'text', nullable: true })
  aiExtraContext: string | null;

  /** URLs y operación */
  @Column({ name: 'menu_url', type: 'varchar', length: 500, nullable: true })
  menuUrl: string | null;

  @Column({ name: 'website_url', type: 'varchar', length: 500, nullable: true })
  websiteUrl: string | null;

  @Column({ name: 'instagram_url', type: 'varchar', length: 500, nullable: true })
  instagramUrl: string | null;

  @Column({ name: 'ignore_business_hours', type: 'boolean', default: false })
  ignoreBusinessHours: boolean;

  @Column({ name: 'prep_time_note', type: 'varchar', length: 255, nullable: true })
  prepTimeNote: string | null;

  @Column({ name: 'delivery_time_note', type: 'varchar', length: 255, nullable: true })
  deliveryTimeNote: string | null;

  @Column({ name: 'min_order_amount', type: 'int', default: 0 })
  minOrderAmount: number;

  @Column({ name: 'payment_instructions', type: 'text', nullable: true })
  paymentInstructions: string | null;

  @Column({ name: 'hours_note', type: 'text', nullable: true })
  hoursNote: string | null;

  @Column({ name: 'cancel_policy_note', type: 'text', nullable: true })
  cancelPolicyNote: string | null;

  /** Mensajes bot (plantillas; {menuUrl} {brand} {mapsUrl}) */
  @Column({ name: 'human_handoff_message', type: 'text', nullable: true })
  humanHandoffMessage: string | null;

  @Column({ name: 'closed_message', type: 'text', nullable: true })
  closedMessage: string | null;

  @Column({ name: 'menu_link_message', type: 'text', nullable: true })
  menuLinkMessage: string | null;

  @Column({ name: 'order_success_message', type: 'text', nullable: true })
  orderSuccessMessage: string | null;

  @Column({
    name: 'ai_temperature',
    type: 'decimal',
    precision: 3,
    scale: 2,
    default: 0.2,
    nullable: true,
  })
  aiTemperature: number | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
