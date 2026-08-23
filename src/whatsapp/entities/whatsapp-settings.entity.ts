import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('ppp_whatsapp_settings')
export class WhatsappSettings {
  @PrimaryColumn()
  id: number;

  @Column({ type: 'tinyint', default: 0 })
  enabled: boolean;

  @Column({ name: 'display_phone', length: 32, nullable: true })
  displayPhone: string | null;

  @Column({ name: 'phone_number_id', length: 64, nullable: true })
  phoneNumberId: string | null;

  @Column({ name: 'waba_id', length: 64, nullable: true })
  wabaId: string | null;

  @Column({ name: 'access_token', type: 'text', nullable: true })
  accessToken: string | null;

  @Column({ name: 'verify_token', length: 128, nullable: true })
  verifyToken: string | null;

  @Column({ name: 'openai_api_key', type: 'text', nullable: true })
  openaiApiKey: string | null;

  @Column({ name: 'openai_model', length: 64, default: 'gpt-4o-mini' })
  openaiModel: string;

  @Column({ name: 'system_prompt', type: 'text', nullable: true })
  systemPrompt: string | null;

  @Column({ name: 'default_delivery_fee', type: 'int', default: 0 })
  defaultDeliveryFee: number;

  @Column({ name: 'allow_mercado_pago', type: 'tinyint', default: 1 })
  allowMercadoPago: boolean;

  @Column({ name: 'welcome_message', type: 'text', nullable: true })
  welcomeMessage: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
