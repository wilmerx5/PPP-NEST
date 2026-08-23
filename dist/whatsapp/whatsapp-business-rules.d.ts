import type { BusinessStatus } from '../business/business.service';
export type WhatsappRulesContext = {
    brandName: string;
    businessStatus: BusinessStatus;
    deliveryFee: number;
    allowMercadoPago: boolean;
    menuProductCount: number;
};
export declare function buildWhatsappBusinessRulesBlock(ctx: WhatsappRulesContext): string;
export declare const WHATSAPP_AI_JSON_SCHEMA: string;
