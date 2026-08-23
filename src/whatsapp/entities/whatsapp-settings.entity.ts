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

  /** App Secret de Meta (firma X-Hub-Signature-256). */
  @Column({ name: 'app_secret', type: 'text', nullable: true })
  appSecret: string | null;

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

  /** 0 = sin tope. Si el carrito lo supera → handoff a humano (si handoffWhenMaxExceeded). */
  @Column({ name: 'max_order_amount', type: 'int', default: 0 })
  maxOrderAmount: number;

  /** Máx. unidades del mismo producto (0 = sin límite). */
  @Column({ name: 'max_units_per_item', type: 'int', default: 10 })
  maxUnitsPerItem: number;

  /** Máx. unidades totales en el carrito (0 = sin límite). */
  @Column({ name: 'max_total_units', type: 'int', default: 0 })
  maxTotalUnits: number;

  /** Máx. líneas / ítems en el carrito (0 = sin límite). */
  @Column({ name: 'max_cart_lines', type: 'int', default: 0 })
  maxCartLines: number;

  @Column({ name: 'handoff_when_max_exceeded', type: 'boolean', default: true })
  handoffWhenMaxExceeded: boolean;

  @Column({ name: 'large_order_handoff_message', type: 'text', nullable: true })
  largeOrderHandoffMessage: string | null;

  @Column({ name: 'allergens_note', type: 'text', nullable: true })
  allergensNote: string | null;

  @Column({ name: 'promotions_note', type: 'text', nullable: true })
  promotionsNote: string | null;

  @Column({ name: 'service_area_note', type: 'text', nullable: true })
  serviceAreaNote: string | null;

  @Column({ name: 'cash_change_note', type: 'text', nullable: true })
  cashChangeNote: string | null;

  @Column({ name: 'transfer_info_note', type: 'text', nullable: true })
  transferInfoNote: string | null;

  @Column({ name: 'special_requests_note', type: 'text', nullable: true })
  specialRequestsNote: string | null;

  /** Pedir notas / cambio antes de confirmar (default true). */
  @Column({ name: 'ask_order_notes', type: 'boolean', default: true })
  askOrderNotes: boolean;

  /** Máx. mensajes entrantes por número / minuto (anti-abuso). */
  @Column({ name: 'rate_limit_per_minute', type: 'int', default: 25 })
  rateLimitPerMinute: number;

  /**
   * Timeouts (minutos). 0 = desactivado.
   * Agente en takeover sin responder → devolver bot (mantiene carrito).
   */
  @Column({ name: 'human_agent_idle_minutes', type: 'int', default: 30 })
  humanAgentIdleMinutes: number;

  /** Cliente sin responder con humano al mando → liberar + soft reset. */
  @Column({ name: 'human_client_idle_minutes', type: 'int', default: 120 })
  humanClientIdleMinutes: number;

  /** Pedido a medias sin actividad del cliente → vaciar carrito. */
  @Column({ name: 'order_draft_idle_minutes', type: 'int', default: 45 })
  orderDraftIdleMinutes: number;

  /** Elección de opción / match pendiente sin respuesta. */
  @Column({ name: 'pending_choice_idle_minutes', type: 'int', default: 15 })
  pendingChoiceIdleMinutes: number;

  /** Link MP enviado y sin pago / sin actividad. */
  @Column({ name: 'mp_payment_idle_minutes', type: 'int', default: 60 })
  mpPaymentIdleMinutes: number;

  /** Avisar por WhatsApp al expirar / devolver bot. */
  @Column({ name: 'session_idle_notify', type: 'boolean', default: true })
  sessionIdleNotify: boolean;

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
