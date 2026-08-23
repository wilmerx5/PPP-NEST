import { Repository } from 'typeorm';
import { WhatsappConversation } from './entities/whatsapp-conversation.entity';
import { WhatsappMessage } from './entities/whatsapp-message.entity';
import { type WhatsappSessionData } from './types/whatsapp-session.types';
import { User } from '../auth/entities/user.entity';
export declare class WhatsappConversationService {
    private readonly convRepo;
    private readonly msgRepo;
    private readonly userRepo;
    constructor(convRepo: Repository<WhatsappConversation>, msgRepo: Repository<WhatsappMessage>, userRepo: Repository<User>);
    findOrCreateConversation(waId: string, phoneE164: string): Promise<WhatsappConversation>;
    touchInbound(conv: WhatsappConversation): Promise<WhatsappConversation>;
    updateCustomerName(conv: WhatsappConversation, name: string): Promise<WhatsappConversation>;
    findUserByPhone(phoneE164: string): Promise<User | null>;
    getSession(conv: WhatsappConversation): WhatsappSessionData;
    saveSession(conv: WhatsappConversation, patch: Partial<WhatsappSessionData>, state?: string): Promise<WhatsappConversation>;
    logMessage(params: {
        conversationId: number;
        direction: 'in' | 'out';
        body: string;
        waMessageId?: string;
        sentBy?: 'bot' | 'human' | 'system';
        raw?: Record<string, unknown>;
    }): Promise<WhatsappMessage>;
    listConversations(limit?: number): Promise<WhatsappConversation[]>;
    getConversation(id: number): Promise<WhatsappConversation>;
    setHumanTakeover(id: number, takeover: boolean, agent?: {
        id: string;
        fullName: string;
    }): Promise<WhatsappConversation>;
    getRecentMessageTexts(conversationId: number, limit?: number): Promise<string[]>;
}
