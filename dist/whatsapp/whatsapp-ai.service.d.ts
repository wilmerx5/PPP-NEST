import { WhatsappSettingsService } from './whatsapp-settings.service';
import type { AiTurnResult } from './types/whatsapp-session.types';
export declare class WhatsappAiService {
    private readonly settingsService;
    private readonly logger;
    constructor(settingsService: WhatsappSettingsService);
    generateTurn(input: {
        userMessage: string;
        businessRulesBlock: string;
        menuDetailedText: string;
        sessionSummary: string;
        recentMessages: string[];
        customerHint: string;
        conversational?: boolean;
    }): Promise<AiTurnResult>;
    private toChatMessages;
}
