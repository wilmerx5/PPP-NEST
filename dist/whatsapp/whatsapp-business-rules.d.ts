import type { BusinessStatus } from '../business/business.service';
import type { WhatsappPaymentMethodConfig } from './whatsapp-payment-methods';
export type WhatsappRulesContext = {
    brandName: string;
    businessStatus: BusinessStatus;
    deliveryFee: number;
    deliveryFeeTiersBlock?: string;
    allowMercadoPago: boolean;
    menuProductCount: number;
    localContextBlock?: string;
    orderLimitsBlock?: string;
    paymentMethods?: WhatsappPaymentMethodConfig[];
};
export declare function buildWhatsappBusinessRulesBlock(ctx: WhatsappRulesContext): string;
export declare const WHATSAPP_AI_JSON_SCHEMA: string;
