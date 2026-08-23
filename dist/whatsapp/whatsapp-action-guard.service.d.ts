import type { AiOrderAction } from './types/whatsapp-session.types';
import type { WhatsappCatalogProduct } from './whatsapp-catalog.service';
export type GuardResult = {
    actions: AiOrderAction | undefined;
    warnings: string[];
    blockedClosed: boolean;
};
export declare class WhatsappActionGuardService {
    private readonly logger;
    sanitize(params: {
        actions: AiOrderAction | undefined;
        products: WhatsappCatalogProduct[];
        businessOpen: boolean;
        allowMercadoPago: boolean;
    }): GuardResult;
    private normalizeAttributes;
    formatAttributeOptions(product: WhatsappCatalogProduct): string;
    private formatProductOptionsInline;
}
