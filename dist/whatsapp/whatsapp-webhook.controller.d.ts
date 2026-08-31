import type { Request, Response } from 'express';
import { WhatsappSettingsService } from './whatsapp-settings.service';
import { WhatsappMetaService } from './whatsapp-meta.service';
import { WhatsappOrchestratorService } from './whatsapp-orchestrator.service';
import { WhatsappRateLimitService } from './whatsapp-rate-limit.service';
import { WhatsappConversationService } from './whatsapp-conversation.service';
export declare class WhatsappWebhookController {
    private readonly settingsService;
    private readonly metaService;
    private readonly orchestrator;
    private readonly rateLimit;
    private readonly conversationService;
    private readonly logger;
    constructor(settingsService: WhatsappSettingsService, metaService: WhatsappMetaService, orchestrator: WhatsappOrchestratorService, rateLimit: WhatsappRateLimitService, conversationService: WhatsappConversationService);
    verify(mode: string, token: string, challenge: string, res: Response): Promise<Response<any, Record<string, any>>>;
    receive(req: Request & {
        rawBody?: Buffer;
    }, signature: string | undefined, res: Response): Promise<Response<any, Record<string, any>>>;
}
