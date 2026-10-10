import { WhatsappSettingsService } from './whatsapp-settings.service';
import { WhatsappCatalogService, type WhatsappCatalogProduct } from './whatsapp-catalog.service';
import type { AiOrderAction } from './types/whatsapp-session.types';
import type { MenuConceptGroup } from './whatsapp-menu-concepts';
export type AgentV1TurnInput = {
    userMessage: string;
    sessionSummary: string;
    recentMessages: string[];
    businessRulesBlock: string;
    brandName: string;
    products: WhatsappCatalogProduct[];
    menuUrl?: string | null;
    humanPhone?: string | null;
    menuConceptGroups?: MenuConceptGroup[];
    cart?: Array<{
        productId: number;
        name: string;
        quantity?: number;
        note?: string;
        attributes?: {
            attributeName: string;
            attributeValue: string;
        }[];
    }>;
};
export type AgentV1TurnResult = {
    reply: string;
    actions: AiOrderAction;
    needsAttributeProductId?: number;
    lookupPlacedOrder?: {
        orderNumber?: number;
    };
    lookupDeliveryTime?: boolean;
    toolCalls: string[];
    error?: string;
};
export declare class WhatsappAgentService {
    private readonly settingsService;
    private readonly catalogService;
    private readonly logger;
    private readonly toolCartIndexes;
    private readonly maxIterations;
    constructor(settingsService: WhatsappSettingsService, catalogService: WhatsappCatalogService);
    runTurn(input: AgentV1TurnInput): Promise<AgentV1TurnResult>;
    private toolCartView;
    private executeTool;
    private productCard;
    private toChatMessages;
}
