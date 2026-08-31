export type DeliveryFeeTier = {
    maxKm: number;
    fee: number;
};
export declare const DEFAULT_DELIVERY_FEE_TIERS: DeliveryFeeTier[];
export declare function normalizeDeliveryFeeTiers(raw: unknown): DeliveryFeeTier[];
export declare function feeFromDistanceKm(distanceKm: number, tiers: DeliveryFeeTier[], maxKm: number): {
    fee: number;
} | {
    outOfCoverage: true;
};
export declare function formatDeliveryFeeTiersForPrompt(tiers: DeliveryFeeTier[], maxKm: number): string;
