import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { WhatsappMessage } from './whatsapp-message.entity';
import type { WhatsappSessionData } from '../types/whatsapp-session.types';

@Entity('ppp_whatsapp_conversations')
export class WhatsappConversation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'wa_id', length: 32 })
  waId: string;

  @Column({ name: 'phone_e164', length: 32 })
  phoneE164: string;

  @Column({ name: 'customer_name', length: 120, nullable: true })
  customerName: string | null;

  @Column({ length: 40, default: 'building_cart' })
  state: string;

  @Column({ name: 'session_data', type: 'json', nullable: true })
  sessionData: WhatsappSessionData | null;

  @Column({ name: 'human_takeover', type: 'tinyint', default: 0 })
  humanTakeover: boolean;

  @Column({ name: 'human_agent_id', length: 36, nullable: true })
  humanAgentId: string | null;

  @Column({ name: 'human_agent_name', length: 120, nullable: true })
  humanAgentName: string | null;

  @Column({ name: 'last_message_at', type: 'timestamp', nullable: true })
  lastMessageAt: Date | null;

  @Column({ name: 'last_inbound_at', type: 'timestamp', nullable: true })
  lastInboundAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => WhatsappMessage, (m) => m.conversation)
  messages?: WhatsappMessage[];
}
