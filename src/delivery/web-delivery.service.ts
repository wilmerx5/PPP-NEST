import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BusinessService } from '../business/business.service';
import { WhatsappDeliveryRoutingService } from '../whatsapp/whatsapp-delivery-routing.service';
import {
  feeFromDistanceKm,
  type DeliveryFeeTier,
} from '../whatsapp/whatsapp-delivery-fee';
import {
  WEB_DELIVERY_DEFAULT_FEE,
  WEB_DELIVERY_FEE_TIERS,
  WEB_DELIVERY_MAX_KM,
} from './web-delivery-fee';

export type WebDeliveryQuote =
  | {
      ok: true;
      fee: number;
      distanceKm: number;
      source: 'google_directions' | 'haversine_estimate' | 'fallback_default';
    }
  | {
      ok: false;
      message: string;
      reason?: string;
    };

const DEFAULT_RESTAURANT = { lat: 4.6323019, lng: -74.1471957 };

@Injectable()
export class WebDeliveryService {
  constructor(
    private readonly routing: WhatsappDeliveryRoutingService,
    private readonly config: ConfigService,
    private readonly businessService: BusinessService,
  ) {}

  private restaurantCoords(): { lat: number; lng: number } {
    const lat = Number(this.config.get('RESTAURANT_LAT') || DEFAULT_RESTAURANT.lat);
    const lng = Number(this.config.get('RESTAURANT_LNG') || DEFAULT_RESTAURANT.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    return DEFAULT_RESTAURANT;
  }

  async getConfig() {
    return this.businessService.getWebDeliveryConfig();
  }

  async quote(params: {
    address?: string;
    lat?: number | null;
    lng?: number | null;
  }): Promise<WebDeliveryQuote> {
    const { defaultFee, maxKm, tiers } = await this.getConfig();
    const restaurant = this.restaurantCoords();
    const lat =
      params.lat != null && Number.isFinite(Number(params.lat))
        ? Number(params.lat)
        : null;
    const lng =
      params.lng != null && Number.isFinite(Number(params.lng))
        ? Number(params.lng)
        : null;
    const address = (params.address || '').trim();

    const quote = await this.routing.quoteDeliveryFee({
      customerAddress: address,
      customerCoords: lat != null && lng != null ? { lat, lng } : null,
      restaurant,
      tiers,
      maxKm,
      fallbackFee: defaultFee,
      regionBias: 'co',
    });

    if (quote.ok) {
      return {
        ok: true,
        fee: quote.fee,
        distanceKm: quote.distanceKm,
        source:
          quote.source === 'google_directions'
            ? 'google_directions'
            : 'fallback_default',
      };
    }

    if (lat != null && lng != null) {
      const km = this.haversineKm(restaurant, { lat, lng });
      const priced = feeFromDistanceKm(km, tiers, maxKm);
      if ('outOfCoverage' in priced) {
        return {
          ok: false,
          reason: 'out_of_coverage',
          message:
            `Tu dirección queda a ~${km.toFixed(1)} km y está fuera de cobertura (máx. ${maxKm} km).`,
        };
      }
      return {
        ok: true,
        fee: priced.fee,
        distanceKm: Math.round(km * 100) / 100,
        source: 'haversine_estimate',
      };
    }

    if (quote.reason === 'no_api_key') {
      return {
        ok: true,
        fee: defaultFee,
        distanceKm: 0,
        source: 'fallback_default',
      };
    }

    return {
      ok: false,
      reason: quote.reason,
      message: quote.message,
    };
  }

  async assertOnlineDeliveryFee(
    deliveryFee: number,
    params: { address?: string; lat?: number | null; lng?: number | null },
  ): Promise<number> {
    const quote = await this.quote(params);
    if (!quote.ok) {
      throw new Error(quote.message);
    }
    if (Math.round(Number(deliveryFee)) !== quote.fee) {
      throw new Error(
        `El costo de envío cambió ($${quote.fee.toLocaleString('es-CO')}). Actualiza la página e intenta de nuevo.`,
      );
    }
    return quote.fee;
  }

  async getTiers(): Promise<DeliveryFeeTier[]> {
    const cfg = await this.getConfig();
    return cfg.tiers.length ? cfg.tiers : [...WEB_DELIVERY_FEE_TIERS];
  }

  private haversineKm(
    a: { lat: number; lng: number },
    b: { lat: number; lng: number },
  ): number {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }
}
