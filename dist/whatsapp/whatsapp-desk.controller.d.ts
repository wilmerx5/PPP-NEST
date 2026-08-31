import { MessageEvent } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { SendWhatsappMessageDto, TakeoverWhatsappConversationDto } from './dto/whatsapp.dto';
import { WhatsappConversationService } from './whatsapp-conversation.service';
import { WhatsappOrchestratorService } from './whatsapp-orchestrator.service';
import { WhatsappMetaService } from './whatsapp-meta.service';
import { WhatsappAdminAlertService } from './whatsapp-admin-alert.service';
export declare class WhatsappDeskController {
    private readonly conversationService;
    private readonly orchestrator;
    private readonly metaService;
    private readonly adminAlerts;
    constructor(conversationService: WhatsappConversationService, orchestrator: WhatsappOrchestratorService, metaService: WhatsappMetaService, adminAlerts: WhatsappAdminAlertService);
    alertsStream(): Observable<MessageEvent>;
    me(req: Request): {
        id: string;
        fullName: string;
        roles: string[];
    };
    listConversations(): Promise<{
        id: number;
        phoneE164: string;
        customerName: string | null;
        state: string;
        inboxStatus: "needs_human" | "ordering" | "completed" | "closed";
        humanTakeover: boolean;
        humanAgentName: string | null;
        lastMessageAt: Date | null;
        lastInboundAt: Date | null;
        updatedAt: Date;
        cartCount: number;
        lastMessagePreview: string | null;
        lastMessageDirection: string | null;
        lastMessageSentBy: string | null;
    }[]>;
    getConversation(id: number): Promise<{
        id: number;
        waId: string;
        phoneE164: string;
        customerName: string | null;
        state: string;
        inboxStatus: "needs_human" | "ordering" | "completed" | "closed";
        sessionData: Record<string, unknown> | null;
        humanTakeover: boolean;
        humanAgentName: string | null;
        cartCount: number;
        orderType: "delivery" | "pickup" | null;
        paymentMethod: string | null;
        address: string | null;
        messages: {
            id: string;
            direction: "in" | "out";
            body: string | null;
            sentBy: string;
            createdAt: Date;
            messageType: string;
            mediaId: string | null;
            mimeType: string | null;
            hasMedia: boolean;
        }[];
    }>;
    getMessageMedia(id: number, messageId: string, res: Response): Promise<Response<any, Record<string, any>>>;
    takeover(id: number, body: TakeoverWhatsappConversationDto, req: Request): Promise<{
        success: boolean;
        humanTakeover: boolean;
    }>;
    closeConversation(id: number): Promise<{
        success: boolean;
        state: string;
    }>;
    sendMessage(id: number, dto: SendWhatsappMessageDto, req: Request): Promise<{
        success: boolean;
    }>;
    sendMedia(id: number, file: {
        buffer: Buffer;
        mimetype: string;
        originalname: string;
        size: number;
    } | undefined, caption: string | undefined, req: Request): Promise<{
        success: boolean;
        messageType: import("./whatsapp-outbound-media").OutboundMediaKind;
        mediaId: string;
    }>;
}
