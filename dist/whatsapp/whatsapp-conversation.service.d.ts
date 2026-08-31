import { Repository } from 'typeorm';
import { WhatsappConversation } from './entities/whatsapp-conversation.entity';
import { WhatsappMessage } from './entities/whatsapp-message.entity';
import { type WhatsappSessionData } from './types/whatsapp-session.types';
import { User } from '../auth/entities/user.entity';
import { WhatsappAdminAlertService } from './whatsapp-admin-alert.service';
export declare class WhatsappConversationService {
    private readonly convRepo;
    private readonly msgRepo;
    private readonly userRepo;
    private readonly adminAlerts;
    constructor(convRepo: Repository<WhatsappConversation>, msgRepo: Repository<WhatsappMessage>, userRepo: Repository<User>, adminAlerts: WhatsappAdminAlertService);
    findOrCreateConversation(waId: string, phoneE164: string): Promise<WhatsappConversation>;
    touchInbound(conv: WhatsappConversation): Promise<WhatsappConversation>;
    touchOutbound(conv: WhatsappConversation, kind?: 'bot' | 'human'): Promise<WhatsappConversation>;
    updateCustomerName(conv: WhatsappConversation, name: string): Promise<WhatsappConversation>;
    findUserByPhone(phoneE164: string): Promise<User | null>;
    getSession(conv: WhatsappConversation): WhatsappSessionData;
    saveSession(conv: WhatsappConversation, patch: Partial<WhatsappSessionData>, state?: string): Promise<WhatsappConversation>;
    resetOrderSession(conv: WhatsappConversation, state: string, opts?: {
        ignorePriorHistory?: boolean;
        rememberDeliveryAddress?: boolean;
    }): Promise<WhatsappConversation>;
    reloadConversation(id: number): Promise<WhatsappConversation>;
    countInboundMessages(conversationId: number): Promise<number>;
    findByWaMessageId(waMessageId: string): Promise<WhatsappMessage | null>;
    logMessage(params: {
        conversationId: number;
        direction: 'in' | 'out';
        body: string;
        waMessageId?: string;
        sentBy?: 'bot' | 'human' | 'system';
        raw?: Record<string, unknown>;
        messageType?: string;
        mediaId?: string;
        mimeType?: string;
    }): Promise<WhatsappMessage>;
    updateMessageBody(messageId: string, body: string): Promise<void>;
    getMessage(conversationId: number, messageId: string): Promise<WhatsappMessage>;
    listConversations(limit?: number): Promise<{
        conversation: WhatsappConversation;
        lastMessage: {
            body: string;
            direction: string;
            sentBy: string;
            createdAt: Date;
        } | null;
        inboxStatus: "needs_human" | "ordering" | "completed" | "closed";
    }[]>;
    deriveInboxStatus(c: WhatsappConversation): 'needs_human' | 'ordering' | 'completed' | 'closed';
    getConversation(id: number): Promise<WhatsappConversation>;
    setHumanTakeover(id: number, takeover: boolean, agent?: {
        id: string;
        fullName: string;
    }): Promise<WhatsappConversation>;
    closeConversation(id: number): Promise<WhatsappConversation>;
    releaseHumanTakeover(id: number): Promise<WhatsappConversation>;
    clearPendingChoices(conv: WhatsappConversation): Promise<WhatsappConversation>;
    findAgentIdleTakeovers(minutes: number, limit?: number): Promise<WhatsappConversation[]>;
    findClientIdleTakeovers(minutes: number, limit?: number): Promise<WhatsappConversation[]>;
    findIdleOrderDrafts(minutes: number, limit?: number): Promise<WhatsappConversation[]>;
    findIdlePendingChoices(minutes: number, limit?: number): Promise<WhatsappConversation[]>;
    findIdleMpPayments(minutes: number, limit?: number): Promise<WhatsappConversation[]>;
    reopenForNewOrder(conv: WhatsappConversation): Promise<WhatsappConversation>;
    getRecentMessageTexts(conversationId: number, limit?: number): Promise<string[]>;
    purgeMessagesOlderThan(retentionDays?: number, batchSize?: number): Promise<number>;
}
