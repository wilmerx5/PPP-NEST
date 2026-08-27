import type { DeliveryFeeTier } from '../whatsapp/whatsapp-delivery-fee';
export declare const WEB_DELIVERY_FEE_TIERS: DeliveryFeeTier[];
export declare const WEB_DELIVERY_MAX_KM = 6;
export declare const WEB_DELIVERY_DEFAULT_FEE = 4000;
export declare function formatWebDeliveryTiersHint(tiers: DeliveryFeeTier[], maxKm: number): string;
export declare function formatWebDeliveryTiersHintDefault(): string;
