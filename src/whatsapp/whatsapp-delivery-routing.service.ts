import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  feeFromDistanceKm,
  normalizeDeliveryFeeTiers,
  type DeliveryFeeTier,
} from './whatsapp-delivery-fee';

export type LatLng = { lat: number; lng: number };

export type DeliveryRouteQuote =
  | {
      ok: true;
      distanceKm: number;
      durationMinutes: number | null;
      fee: number;
      source: 'google_directions' | 'fallback_fixed';
      geocodedAddress?: string;
      customer: LatLng;
    }
  | {
      ok: false;
      reason: 'out_of_coverage' | 'no_api_key' | 'geocode_failed' | 'route_failed' | 'no_restaurant_coords';
      distanceKm?: number;
      message: string;
    };

@Injectable()
export class WhatsappDeliveryRoutingService {
  private readonly logger = new Logger(WhatsappDeliveryRoutingService.name);
  private readonly geocodeCache = new Map<string, { at: number; value: LatLng & { formatted?: string } }>();
  private readonly CACHE_TTL_MS = 1000 * 60 * 60 * 12;

  constructor(private readonly config: ConfigService) {}

  private apiKey(): string | null {
    const k = (this.config.get<string>('GOOGLE_MAPS_API_KEY') || '').trim();
    return k || null;
  }

  /** Sin exponer la key: útil para el endpoint de prueba. */
  hasApiKey(): boolean {
    return !!this.apiKey();
  }

  async quoteDeliveryFee(params: {
    customerAddress: string;
    customerCoords?: LatLng | null;
    restaurant: LatLng;
    tiers: DeliveryFeeTier[];
    maxKm: number;
    fallbackFee: number;
    regionBias?: string;
  }): Promise<DeliveryRouteQuote> {
    const key = this.apiKey();
    if (!key) {
      return {
        ok: false,
        reason: 'no_api_key',
        message:
          'No hay GOOGLE_MAPS_API_KEY configurada. Se usará el domicilio fijo hasta que la configures.',
      };
    }
    if (!Number.isFinite(params.restaurant.lat) || !Number.isFinite(params.restaurant.lng)) {
      return {
        ok: false,
        reason: 'no_restaurant_coords',
        message: 'Faltan coordenadas del restaurante en la configuración.',
      };
    }

    let customer = params.customerCoords || null;
    let formatted: string | undefined;
    if (!customer) {
      const geo = await this.geocodeAddress(params.customerAddress, params.regionBias || 'co');
      if (!geo) {
        return {
          ok: false,
          reason: 'geocode_failed',
          message:
            'No pude ubicar esa dirección en el mapa. ¿Me la escribes más completa (calle, número, barrio)?',
        };
      }
      customer = { lat: geo.lat, lng: geo.lng };
      formatted = geo.formatted;
    }

    const route = await this.directionsDistance(params.restaurant, customer);
    if (!route) {
      return {
        ok: false,
        reason: 'route_failed',
        message:
          'No pude calcular la ruta hasta esa dirección. ¿Confirmas la dirección o prefieres *recojo* en el local?',
      };
    }

    const priced = feeFromDistanceKm(route.distanceKm, params.tiers, params.maxKm);
    if ('outOfCoverage' in priced) {
      return {
        ok: false,
        reason: 'out_of_coverage',
        distanceKm: route.distanceKm,
        message:
          `Esa dirección queda a *~${route.distanceKm.toFixed(1)} km* por ruta y está *fuera de cobertura* ` +
          `(máx. ${params.maxKm} km). ¿Me das otra dirección más cerca o prefieres *recojo* en el local?`,
      };
    }

    return {
      ok: true,
      distanceKm: route.distanceKm,
      durationMinutes: route.durationMinutes,
      fee: priced.fee,
      source: 'google_directions',
      geocodedAddress: formatted,
      customer,
    };
  }

  /** Fallback local si no hay API: no inventa ruta; el orquestador usa fee fijo. */
  fixedFeeQuote(fallbackFee: number): DeliveryRouteQuote {
    return {
      ok: true,
      distanceKm: 0,
      durationMinutes: null,
      fee: Math.max(0, Math.round(fallbackFee)),
      source: 'fallback_fixed',
      customer: { lat: 0, lng: 0 },
    };
  }

  private async geocodeAddress(
    address: string,
    region: string,
  ): Promise<(LatLng & { formatted?: string }) | null> {
    const q = (address || '').trim();
    if (q.length < 5) return null;
    const cacheKey = `${region}::${q.toLowerCase()}`;
    const cached = this.geocodeCache.get(cacheKey);
    if (cached && Date.now() - cached.at < this.CACHE_TTL_MS) return cached.value;

    const key = this.apiKey();
    if (!key) return null;

    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', q);
    url.searchParams.set('key', key);
    url.searchParams.set('region', region);
    url.searchParams.set('language', 'es');
    url.searchParams.set('components', 'country:CO');

    try {
      const res = await fetch(url.toString());
      const data = (await res.json()) as any;
      if (data.status !== 'OK' || !data.results?.[0]?.geometry?.location) {
        this.logger.warn(`Geocode fail status=${data.status} for "${q.slice(0, 80)}"`);
        return null;
      }
      const loc = data.results[0].geometry.location;
      const value = {
        lat: Number(loc.lat),
        lng: Number(loc.lng),
        formatted: String(data.results[0].formatted_address || q),
      };
      if (!Number.isFinite(value.lat) || !Number.isFinite(value.lng)) return null;
      this.geocodeCache.set(cacheKey, { at: Date.now(), value });
      return value;
    } catch (e) {
      this.logger.warn(`Geocode error: ${(e as Error).message}`);
      return null;
    }
  }

  private async directionsDistance(
    origin: LatLng,
    destination: LatLng,
  ): Promise<{ distanceKm: number; durationMinutes: number | null } | null> {
    const key = this.apiKey();
    if (!key) return null;

    const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
    url.searchParams.set('origin', `${origin.lat},${origin.lng}`);
    url.searchParams.set('destination', `${destination.lat},${destination.lng}`);
    url.searchParams.set('mode', 'driving');
    url.searchParams.set('units', 'metric');
    url.searchParams.set('language', 'es');
    url.searchParams.set('region', 'co');
    url.searchParams.set('key', key);

    try {
      const res = await fetch(url.toString());
      const data = (await res.json()) as any;
      if (data.status !== 'OK' || !data.routes?.[0]?.legs?.[0]) {
        this.logger.warn(`Directions fail status=${data.status}`);
        return null;
      }
      const leg = data.routes[0].legs[0];
      const meters = Number(leg.distance?.value);
      const seconds = Number(leg.duration?.value);
      if (!Number.isFinite(meters) || meters < 0) return null;
      return {
        distanceKm: Math.round((meters / 1000) * 100) / 100,
        durationMinutes: Number.isFinite(seconds) ? Math.max(1, Math.round(seconds / 60)) : null,
      };
    } catch (e) {
      this.logger.warn(`Directions error: ${(e as Error).message}`);
      return null;
    }
  }

  normalizeTiers(raw: unknown): DeliveryFeeTier[] {
    return normalizeDeliveryFeeTiers(raw);
  }
}
