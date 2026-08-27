import { ConfigService } from '@nestjs/config';
import { BusinessService } from '../business/business.service';
import { WhatsappDeliveryRoutingService } from '../whatsapp/whatsapp-delivery-routing.service';
import { type DeliveryFeeTier } from '../whatsapp/whatsapp-delivery-fee';
export type WebDeliveryQuote = {
    ok: true;
    fee: number;
    distanceKm: number;
    source: 'google_directions' | 'haversine_estimate' | 'fallback_default';
} | {
    ok: false;
    message: string;
    reason?: string;
};
export declare class WebDeliveryService {
    private readonly routing;
    private readonly config;
    private readonly businessService;
    constructor(routing: WhatsappDeliveryRoutingService, config: ConfigService, businessService: BusinessService);
    private restaurantCoords;
    getConfig(): Promise<import("../business/business.service").WebDeliveryConfig>;
    quote(params: {
        address?: string;
        lat?: number | null;
        lng?: number | null;
    }): Promise<WebDeliveryQuote>;
    assertOnlineDeliveryFee(deliveryFee: number, params: {
        address?: string;
        lat?: number | null;
        lng?: number | null;
    }): Promise<number>;
    getTiers(): Promise<DeliveryFeeTier[]>;
    private haversineKm;
}
