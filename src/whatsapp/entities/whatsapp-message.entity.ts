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

  /** FK explícita (queries / inserts). */
  @Column({ name: 'conversation_id', type: 'int' })
  conversationId: number;

  @Column({ type: 'enum', enum: ['in', 'out'] })
  direction: 'in' | 'out';

  @Column({ name: 'message_type', type: 'varchar', length: 20, default: 'text' })
  messageType: string;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  @Column({ name: 'media_id', type: 'varchar', length: 128, nullable: true })
  mediaId: string | null;

  @Column({ name: 'mime_type', type: 'varchar', length: 120, nullable: true })
  mimeType: string | null;

  @Column({ name: 'wa_message_id', type: 'varchar', length: 128, nullable: true })
  waMessageId: string | null;

  @Column({ name: 'sent_by', type: 'varchar', length: 20, default: 'bot' })
  sentBy: string;

  @Column({ name: 'raw_payload', type: 'json', nullable: true })
  rawPayload: Record<string, unknown> | null;

  /**
   * "completed" como default protege el historial previo a esta migración:
   * no volver a ejecutar accidentalmente mensajes antiguos.
   */
  @Column({ name: 'processing_status', type: 'varchar', length: 16, default: 'completed' })
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';

  @Column({ name: 'processed_at', type: 'timestamp', nullable: true })
  processedAt: Date | null;

  @Column({ name: 'processing_error', type: 'varchar', length: 80, nullable: true })
  processingError: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  /**
   * Relación solo para joins. La FK la escribe `conversationId`
   * (evitar que save() anule conversation_id si `conversation` viene undefined).
   */
  @ManyToOne(() => WhatsappConversation, (c) => c.messages, {
    onDelete: 'CASCADE',
    nullable: false,
    createForeignKeyConstraints: true,
  })
  @JoinColumn({ name: 'conversation_id' })
  conversation?: WhatsappConversation;
}
