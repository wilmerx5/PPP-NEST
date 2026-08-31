import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { WhatsappConversationService } from './whatsapp-conversation.service';
import { WhatsappSettingsService } from './whatsapp-settings.service';
import { WhatsappMetaService } from './whatsapp-meta.service';
export declare class WhatsappCleanupService implements OnModuleInit, OnModuleDestroy {
    private readonly conversations;
    private readonly settings;
    private readonly meta;
    private readonly logger;
    private purgeTimer;
    private sessionTimer;
    private sessionRunning;
    constructor(conversations: WhatsappConversationService, settings: WhatsappSettingsService, meta: WhatsappMetaService);
    onModuleInit(): void;
    onModuleDestroy(): void;
    private runPurge;
    private runSessionExpiry;
    private safeNotify;
}
