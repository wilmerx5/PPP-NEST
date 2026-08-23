import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { WhatsappMessage } from './whatsapp-message.entity';

@Entity('ppp_whatsapp_conversations')
export class WhatsappConversation {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  @Column({ name: 'wa_id', type: 'varchar', length: 32 })
  waId: string;

  @Column({ name: 'phone_e164', type: 'varchar', length: 32 })
  phoneE164: string;

  @Column({ name: 'customer_name', type: 'varchar', length: 120, nullable: true })
  customerName: string | null;

  @Column({ type: 'varchar', length: 40, default: 'building_cart' })
  state: string;

  /** JSON — no usar `import type` en la propiedad; TypeORM necesita `type: 'json'`. */
  @Column({ name: 'session_data', type: 'json', nullable: true })
  sessionData: Record<string, unknown> | null;

  @Column({ name: 'human_takeover', type: 'boolean', default: false })
  humanTakeover: boolean;

  @Column({ name: 'human_agent_id', type: 'varchar', length: 36, nullable: true })
  humanAgentId: string | null;

  @Column({ name: 'human_agent_name', type: 'varchar', length: 120, nullable: true })
  humanAgentName: string | null;

  @Column({ name: 'last_message_at', type: 'timestamp', nullable: true })
  lastMessageAt: Date | null;

  @Column({ name: 'last_inbound_at', type: 'timestamp', nullable: true })
  lastInboundAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @OneToMany(() => WhatsappMessage, (m) => m.conversation)
  messages?: WhatsappMessage[];
}
