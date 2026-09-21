import type { WhatsappCartItem } from './types/whatsapp-session.types';
export type WhatsappCartLimitsConfig = {
    minOrderAmount: number;
    maxOrderAmount: number;
    maxUnitsPerItem: number;
    maxTotalUnits: number;
    maxCartLines: number;
    handoffWhenMaxExceeded: boolean;
    defaultDeliveryFee: number;
};
export type CartLimitCheck = {
    ok: boolean;
    reason?: string;
    handoff?: boolean;
    kind?: 'min' | 'max_amount' | 'max_units_item' | 'max_total_units' | 'max_lines';
};
declare function cartSubtotal(cart: WhatsappCartItem[]): number;
declare function totalUnits(cart: WhatsappCartItem[]): number;
declare function unitsForProduct(cart: WhatsappCartItem[], productId: number): number;
export declare function evaluateCartLimits(cart: WhatsappCartItem[], cfg: WhatsappCartLimitsConfig, opts?: {
    orderType?: 'delivery' | 'pickup';
    checkMin?: boolean;
}): CartLimitCheck;
export declare function buildOrderLimitsPromptBlock(cfg: WhatsappCartLimitsConfig): string;
export { unitsForProduct, cartSubtotal, totalUnits };
