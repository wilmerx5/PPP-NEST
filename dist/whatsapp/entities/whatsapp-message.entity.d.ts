import { WhatsappConversation } from './whatsapp-conversation.entity';
export declare class WhatsappMessage {
    id: string;
    conversationId: number;
    direction: 'in' | 'out';
    messageType: string;
    body: string | null;
    mediaId: string | null;
    mimeType: string | null;
    waMessageId: string | null;
    sentBy: string;
    rawPayload: Record<string, unknown> | null;
    processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
    processedAt: Date | null;
    processingError: string | null;
    createdAt: Date;
    conversation?: WhatsappConversation;
}
