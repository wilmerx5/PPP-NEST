import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { WhatsappConversation } from './whatsapp-conversation.entity';

@Entity('ppp_whatsapp_messages')
export class WhatsappMessage {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'conversation_id', type: 'int' })
  conversationId: number;

  @Column({ type: 'enum', enum: ['in', 'out'] })
  direction: 'in' | 'out';

  @Column({ name: 'message_type', type: 'varchar', length: 20, default: 'text' })
  messageType: string;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  @Column({ name: 'wa_message_id', type: 'varchar', length: 128, nullable: true })
  waMessageId: string | null;

  @Column({ name: 'sent_by', type: 'varchar', length: 20, default: 'bot' })
  sentBy: string;

  @Column({ name: 'raw_payload', type: 'json', nullable: true })
  rawPayload: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @ManyToOne(() => WhatsappConversation, (c) => c.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: WhatsappConversation;
}
