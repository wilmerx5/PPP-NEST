import { Request } from 'express';
import { SendWhatsappMessageDto, TakeoverWhatsappConversationDto, UpdateWhatsappSettingsDto } from './dto/whatsapp.dto';
import { WhatsappSettingsService } from './whatsapp-settings.service';
import { WhatsappConversationService } from './whatsapp-conversation.service';
import { WhatsappOrchestratorService } from './whatsapp-orchestrator.service';
export declare class WhatsappAdminController {
    private readonly settingsService;
    private readonly conversationService;
    private readonly orchestrator;
    constructor(settingsService: WhatsappSettingsService, conversationService: WhatsappConversationService, orchestrator: WhatsappOrchestratorService);
    getSettings(): Promise<{
        id: number;
        enabled: boolean;
        displayPhone: string | null;
        phoneNumberId: string | null;
        wabaId: string | null;
        accessTokenSet: boolean;
        accessTokenPreview: string | null;
        verifyTokenSet: boolean;
        verifyTokenPreview: string | null;
        openaiApiKeySet: boolean;
        openaiApiKeyPreview: string | null;
        openaiModel: string;
        systemPrompt: string | null;
        defaultDeliveryFee: number;
        allowMercadoPago: boolean;
        welcomeMessage: string | null;
        updatedAt: Date;
        webhookUrlHint: string;
    }>;
    updateSettings(dto: UpdateWhatsappSettingsDto): Promise<{
        id: number;
        enabled: boolean;
        displayPhone: string | null;
        phoneNumberId: string | null;
        wabaId: string | null;
        accessTokenSet: boolean;
        accessTokenPreview: string | null;
        verifyTokenSet: boolean;
        verifyTokenPreview: string | null;
        openaiApiKeySet: boolean;
        openaiApiKeyPreview: string | null;
        openaiModel: string;
        systemPrompt: string | null;
        defaultDeliveryFee: number;
        allowMercadoPago: boolean;
        welcomeMessage: string | null;
        updatedAt: Date;
        webhookUrlHint: string;
    }>;
    listConversations(): Promise<{
        id: number;
        phoneE164: string;
        customerName: string | null;
        state: string;
        humanTakeover: boolean;
        humanAgentName: string | null;
        lastMessageAt: Date | null;
        updatedAt: Date;
        cartCount: number;
    }[]>;
    getConversation(id: number): Promise<{
        id: number;
        waId: string;
        phoneE164: string;
        customerName: string | null;
        state: string;
        sessionData: import("./types/whatsapp-session.types").WhatsappSessionData | null;
        humanTakeover: boolean;
        humanAgentName: string | null;
        messages: {
            id: string;
            direction: "in" | "out";
            body: string | null;
            sentBy: "bot" | "human" | "system";
            createdAt: Date;
        }[];
    }>;
    takeover(id: number, body: TakeoverWhatsappConversationDto, req: Request): Promise<{
        success: boolean;
        humanTakeover: boolean;
    }>;
    sendMessage(id: number, dto: SendWhatsappMessageDto, req: Request): Promise<{
        success: boolean;
    }>;
}
