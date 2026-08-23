import { WhatsappMessage } from './whatsapp-message.entity';
import type { WhatsappSessionData } from '../types/whatsapp-session.types';
export declare class WhatsappConversation {
    id: number;
    waId: string;
    phoneE164: string;
    customerName: string | null;
    state: string;
    sessionData: WhatsappSessionData | null;
    humanTakeover: boolean;
    humanAgentId: string | null;
    humanAgentName: string | null;
    lastMessageAt: Date | null;
    lastInboundAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    messages?: WhatsappMessage[];
}
