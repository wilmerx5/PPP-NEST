import type { AiOrderAction } from './types/whatsapp-session.types';
import type { WhatsappCatalogProduct } from './whatsapp-catalog.service';
import type { WhatsappPaymentMethodConfig } from './whatsapp-payment-methods';
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
        paymentMethods?: WhatsappPaymentMethodConfig[];
    }): GuardResult;
    private normalizeAttributes;
    formatAttributeOptions(product: WhatsappCatalogProduct): string;
    private formatProductOptionsInline;
}
