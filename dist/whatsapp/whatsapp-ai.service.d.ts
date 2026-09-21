import { WhatsappSettingsService } from './whatsapp-settings.service';
import type { AiTurnResult } from './types/whatsapp-session.types';
import { type WhatsappClassifyResult } from './whatsapp-message-classify';
export type WhatsappImageAnalysis = {
    kind: 'order' | 'payment_proof' | 'other' | 'unclear';
    textForBot: string;
    visibleText?: string;
    reply?: string;
};
export declare class WhatsappAiService {
    private readonly settingsService;
    private readonly logger;
    constructor(settingsService: WhatsappSettingsService);
    classifyMessage(input: {
        userMessage: string;
        cartLength: number;
        recentMessages?: string[];
    }): Promise<WhatsappClassifyResult | null>;
    generateTurn(input: {
        userMessage: string;
        businessRulesBlock: string;
        menuDetailedText: string;
        sessionSummary: string;
        recentMessages: string[];
        customerHint: string;
        conversational?: boolean;
        detectedIntent?: string;
    }): Promise<AiTurnResult>;
    transcribeAudio(buffer: Buffer, mimeType: string): Promise<string | null>;
    analyzeOrderImage(input: {
        buffer: Buffer;
        mimeType: string;
        caption?: string;
        menuSummary: string;
        ocrRetry?: boolean;
    }): Promise<WhatsappImageAnalysis>;
    imageFallbackReply(): string;
    private audioExtension;
    private toChatMessages;
}
