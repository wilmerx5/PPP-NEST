import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { WhatsappSettings } from './entities/whatsapp-settings.entity';
import { UpdateWhatsappSettingsDto } from './dto/whatsapp.dto';
export declare class WhatsappSettingsService {
    private readonly settingsRepo;
    private readonly config;
    constructor(settingsRepo: Repository<WhatsappSettings>, config: ConfigService);
    getSettings(): Promise<WhatsappSettings>;
    getEffectiveConfig(): Promise<{
        enabled: boolean;
        accessToken: string | null;
        phoneNumberId: string | null;
        verifyToken: string | null;
        openaiApiKey: string | null;
        openaiModel: string;
        systemPrompt: string;
        welcomeMessage: string;
        ignoreBusinessHours: boolean;
        id: number;
        displayPhone: string | null;
        wabaId: string | null;
        defaultDeliveryFee: number;
        allowMercadoPago: boolean;
        updatedAt: Date;
    }>;
    updateSettings(dto: UpdateWhatsappSettingsDto): Promise<WhatsappSettings>;
    maskSettings(row: WhatsappSettings): {
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
    };
}
