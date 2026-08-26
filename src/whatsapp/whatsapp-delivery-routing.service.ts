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
  private readonly geocodeCache = new Map<
    string,
    { at: number; value: LatLng & { formatted?: string } }
  >();
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

    // Tope de distancia en línea recta: evita “Castilla (España)” u otros matches lejanos.
    const maxStraightKm = Math.max(20, Number(params.maxKm) * 4 || 22);

    let customer = params.customerCoords || null;
    let formatted: string | undefined;

    if (customer) {
      const pinKm = this.haversineKm(params.restaurant, customer);
      if (pinKm > maxStraightKm) {
        this.logger.warn(
          `Customer pin too far (${pinKm.toFixed(1)} km) — treating as geocode_failed`,
        );
        return {
          ok: false,
          reason: 'geocode_failed',
          message:
            'Esa ubicación queda muy lejos del local. ¿Me confirmas la dirección en Bogotá (barrio / conjunto)?',
        };
      }
    } else {
      const geo = await this.geocodeAddress(params.customerAddress, {
        region: params.regionBias || 'co',
        near: params.restaurant,
        maxStraightKm,
      });
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

    // Cinturón de seguridad: ruta absurda (match extranjero / error de Maps)
    const absurdRouteKm = Math.max(40, Number(params.maxKm) * 8 || 44);
    if (route.distanceKm > absurdRouteKm) {
      this.logger.warn(
        `Route absurdly long (${route.distanceKm} km) — treating as geocode_failed`,
      );
      return {
        ok: false,
        reason: 'geocode_failed',
        distanceKm: route.distanceKm,
        message:
          'No pude ubicar bien esa dirección cerca del local. ¿Me la detallas un poco más (Bogotá / barrio)?',
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
    opts: { region: string; near: LatLng; maxStraightKm: number },
  ): Promise<(LatLng & { formatted?: string }) | null> {
    const q = (address || '').trim();
    if (q.length < 4) return null;

    const variants = this.geocodeQueryVariants(q);
    for (const variant of variants) {
      const hit = await this.geocodeOnce(variant, opts);
      if (hit) return hit;
    }
    return null;
  }

  /**
   * Primero variantes locales (Bogotá/Kennedy), al final el texto crudo.
   * Evita que "Castilla" solo resuelva a Castilla (España).
   */
  private geocodeQueryVariants(address: string): string[] {
    const q = address.trim();
    const out: string[] = [];
    if (!/\b(bogot[aá]|colombia|cundinamarca)\b/i.test(q)) {
      out.push(`${q}, Kennedy, Bogotá, Colombia`);
      out.push(`${q}, Bogotá, Colombia`);
      out.push(`${q}, Colombia`);
    }
    out.push(q);
    return out;
  }

  private async geocodeOnce(
    q: string,
    opts: { region: string; near: LatLng; maxStraightKm: number },
  ): Promise<(LatLng & { formatted?: string }) | null> {
    const cacheKey = `${opts.region}::${opts.near.lat.toFixed(3)},${opts.near.lng.toFixed(3)}::${q.toLowerCase()}`;
    const cached = this.geocodeCache.get(cacheKey);
    if (cached && Date.now() - cached.at < this.CACHE_TTL_MS) return cached.value;

    const key = this.apiKey();
    if (!key) return null;

    // Viewport ~±0.18° (~20 km) alrededor del restaurante (bias, no hard lock).
    const d = 0.18;
    const sw = `${opts.near.lat - d},${opts.near.lng - d}`;
    const ne = `${opts.near.lat + d},${opts.near.lng + d}`;

    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', q);
    url.searchParams.set('key', key);
    url.searchParams.set('region', opts.region);
    url.searchParams.set('language', 'es');
    url.searchParams.set('components', 'country:CO');
    url.searchParams.set('bounds', `${sw}|${ne}`);

    try {
      const res = await fetch(url.toString());
      const data = (await res.json()) as any;
      if (data.status !== 'OK' || !Array.isArray(data.results) || !data.results.length) {
        this.logger.warn(`Geocode fail status=${data.status} for "${q.slice(0, 80)}"`);
        return null;
      }

      for (const result of data.results) {
        const accepted = this.acceptGeocodeResult(result, opts.near, opts.maxStraightKm);
        if (accepted) {
          this.geocodeCache.set(cacheKey, { at: Date.now(), value: accepted });
          return accepted;
        }
      }

      this.logger.warn(
        `Geocode: ${data.results.length} result(s) rejected (far/foreign) for "${q.slice(0, 80)}"`,
      );
      return null;
    } catch (e) {
      this.logger.warn(`Geocode error: ${(e as Error).message}`);
      return null;
    }
  }

  /** Solo Colombia y cerca del restaurante. */
  private acceptGeocodeResult(
    result: any,
    near: LatLng,
    maxStraightKm: number,
  ): (LatLng & { formatted?: string }) | null {
    const loc = result?.geometry?.location;
    if (!loc) return null;
    const lat = Number(loc.lat);
    const lng = Number(loc.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const formatted = String(result.formatted_address || '');
    const comps: Array<{ long_name?: string; short_name?: string; types?: string[] }> =
      Array.isArray(result.address_components) ? result.address_components : [];

    const country = comps.find((c) => (c.types || []).includes('country'));
    if (country?.short_name && country.short_name !== 'CO') {
      this.logger.warn(`Geocode reject foreign country=${country.short_name}: ${formatted}`);
      return null;
    }

    // Texto tipo España / Madrid sin Colombia
    if (
      /\b(españa|spain|madrid|barcelona|valencia|sevilla|portugal|méxico|mexico|peru|perú|argentina|chile)\b/i.test(
        formatted,
      ) &&
      !/\b(colombia|bogot[aá]|cundinamarca|kennedy|bosa|soacha)\b/i.test(formatted)
    ) {
      this.logger.warn(`Geocode reject foreign-looking: ${formatted}`);
      return null;
    }

    const km = this.haversineKm(near, { lat, lng });
    if (km > maxStraightKm) {
      this.logger.warn(
        `Geocode reject far ${km.toFixed(1)}km (>${maxStraightKm}): ${formatted}`,
      );
      return null;
    }

    return { lat, lng, formatted };
  }

  private haversineKm(a: LatLng, b: LatLng): number {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
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
