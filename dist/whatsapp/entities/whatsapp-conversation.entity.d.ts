import { WhatsappMessage } from './whatsapp-message.entity';
export declare class WhatsappConversation {
    id: number;
    waId: string;
    phoneE164: string;
    customerName: string | null;
    state: string;
    sessionData: Record<string, unknown> | null;
    humanTakeover: boolean;
    humanAgentId: string | null;
    humanAgentName: string | null;
    humanTakeoverAt: Date | null;
    lastHumanOutboundAt: Date | null;
    lastMessageAt: Date | null;
    lastInboundAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    messages?: WhatsappMessage[];
}
