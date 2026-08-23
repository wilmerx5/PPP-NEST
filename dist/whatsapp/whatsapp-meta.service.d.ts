import { WhatsappSettingsService } from './whatsapp-settings.service';
export type IncomingWhatsappText = {
    waId: string;
    phoneE164: string;
    messageId: string;
    text: string;
    timestamp: number;
    raw: Record<string, unknown>;
};
export declare class WhatsappMetaService {
    private readonly settingsService;
    private readonly logger;
    constructor(settingsService: WhatsappSettingsService);
    parseWebhookPayload(body: Record<string, unknown>): IncomingWhatsappText[];
    normalizePhone(raw: string): string;
    sendText(toWaId: string, body: string): Promise<void>;
}
