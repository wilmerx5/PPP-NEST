import { ConfigService } from '@nestjs/config';
import { type DeliveryFeeTier } from './whatsapp-delivery-fee';
export type LatLng = {
    lat: number;
    lng: number;
};
export type DeliveryRouteQuote = {
    ok: true;
    distanceKm: number;
    durationMinutes: number | null;
    fee: number;
    source: 'google_directions' | 'fallback_fixed';
    geocodedAddress?: string;
    customer: LatLng;
} | {
    ok: false;
    reason: 'out_of_coverage' | 'no_api_key' | 'geocode_failed' | 'route_failed' | 'no_restaurant_coords';
    distanceKm?: number;
    message: string;
};
export declare class WhatsappDeliveryRoutingService {
    private readonly config;
    private readonly logger;
    private readonly geocodeCache;
    private readonly CACHE_TTL_MS;
    constructor(config: ConfigService);
    private apiKey;
    hasApiKey(): boolean;
    quoteDeliveryFee(params: {
        customerAddress: string;
        customerCoords?: LatLng | null;
        restaurant: LatLng;
        tiers: DeliveryFeeTier[];
        maxKm: number;
        fallbackFee: number;
        regionBias?: string;
    }): Promise<DeliveryRouteQuote>;
    fixedFeeQuote(fallbackFee: number): DeliveryRouteQuote;
    private geocodeAddress;
    private geocodeQueryVariants;
    private geocodeOnce;
    private acceptGeocodeResult;
    private haversineKm;
    private directionsDistance;
    normalizeTiers(raw: unknown): DeliveryFeeTier[];
}
