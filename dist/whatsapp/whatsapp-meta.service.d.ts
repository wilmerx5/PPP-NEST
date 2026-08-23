import { WhatsappSettingsService } from './whatsapp-settings.service';
export type IncomingWhatsappMessageType = 'text' | 'audio' | 'image' | 'video' | 'document' | 'sticker' | 'location' | 'other';
export type IncomingWhatsappMessage = {
    waId: string;
    phoneE164: string;
    messageId: string;
    messageType: IncomingWhatsappMessageType;
    text: string;
    mediaId?: string;
    mimeType?: string;
    filename?: string;
    latitude?: number;
    longitude?: number;
    locationName?: string;
    locationAddress?: string;
    timestamp: number;
    raw: Record<string, unknown>;
};
export type IncomingWhatsappText = IncomingWhatsappMessage;
export declare class WhatsappMetaService {
    private readonly settingsService;
    private readonly logger;
    constructor(settingsService: WhatsappSettingsService);
    parseWebhookPayload(body: Record<string, unknown>): IncomingWhatsappMessage[];
    private parseOneMessage;
    normalizePhone(raw: string): string;
    sendText(toWaId: string, body: string): Promise<void>;
    downloadMedia(mediaId: string): Promise<{
        buffer: Buffer;
        mimeType: string;
    }>;
}
