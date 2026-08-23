import { WhatsappConversation } from './whatsapp-conversation.entity';
export declare class WhatsappMessage {
    id: string;
    conversationId: number;
    direction: 'in' | 'out';
    messageType: string;
    body: string | null;
    waMessageId: string | null;
    sentBy: 'bot' | 'human' | 'system';
    rawPayload: Record<string, unknown> | null;
    createdAt: Date;
    conversation: WhatsappConversation;
}
