import { WhatsappSettingsService } from './whatsapp-settings.service';
import type { AiTurnResult } from './types/whatsapp-session.types';
export declare class WhatsappAiService {
    private readonly settingsService;
    private readonly logger;
    constructor(settingsService: WhatsappSettingsService);
    generateTurn(input: {
        userMessage: string;
        menuText: string;
        businessOpen: boolean;
        sessionSummary: string;
        recentMessages: string[];
        customerHint: string;
    }): Promise<AiTurnResult>;
}
