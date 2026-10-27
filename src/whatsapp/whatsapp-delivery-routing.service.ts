import {canonicalStreetAddress, splitDeliveryAddressParts} from './whatsapp-address-parts';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  feeFromDistanceKm,
  type DeliveryFeeTier,
} from './whatsapp-delivery-fee';

class AmbiguousDeliveryAddressError extends Error {
  constructor(readonly alternatives: string[] = []) { super('Ambiguous delivery address'); }
}

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
      reason: 'address_ambiguous' | 'out_of_coverage' | 'no_api_key' | 'geocode_failed' | 'route_failed' | 'no_restaurant_coords';
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
        this.logQuote({
          source: 'app',
          api: 'geocode',
          reason: 'pin_too_far',
          km: Number(pinKm.toFixed(1)),
          maxKm: maxStraightKm,
        });
        return {
          ok: false,
          reason: 'geocode_failed',
          message:
            'Esa ubicación queda muy lejos del local. ¿Me confirmas la dirección en Bogotá (barrio / conjunto)?',
        };
      }
    } else {
      let geo: (LatLng & { formatted?: string }) | null;
      try {
        geo = await this.geocodeAddress(params.customerAddress, {
        region: params.regionBias || 'co',
        near: params.restaurant,
        maxStraightKm,
        });
      } catch (error) {
        if (!(error instanceof AmbiguousDeliveryAddressError)) throw error;
        return { ok: false, reason: 'address_ambiguous', message:
          canonicalStreetAddress(params.customerAddress)
            ? error.alternatives.length
              ? `No pude identificar con seguridad esa dirección. El mapa devuelve direcciones diferentes de la que escribiste: ${error.alternatives.join(' / ')}. No cambié tu dirección ni calculé el domicilio. Escribe la dirección correcta completa o comparte la ubicación de WhatsApp.`
              : 'No pude identificar con seguridad esa dirección en el mapa. Ya tengo la calle y el número; ¿me compartes la ubicación de WhatsApp para precisar el punto?'
            : 'No pude identificar con seguridad ese conjunto o lugar. ¿Me compartes la ubicación de WhatsApp o la dirección con calle y número?' };
      }
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
      this.logQuote({
        source: 'app',
        api: 'directions',
        reason: 'route_too_long',
        km: route.distanceKm,
        maxKm: absurdRouteKm,
      });
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
      geocodedAddress: formatted || (params.customerCoords ? route.destinationAddress : undefined),
      customer,
    };
  }

  private async geocodeAddress(
    address: string,
    opts: { region: string; near: LatLng; maxStraightKm: number },
  ): Promise<(LatLng & { formatted?: string }) | null> {
    const q = (address || '').trim();
    if (q.length < 4) return null;

    const variants = this.geocodeQueryVariants(q);
    // A prior successful fallback is reusable before retrying earlier misses.
    // Only positive results are cached; failures remain retryable.
    for (const variant of variants) {
      const cached = this.cachedGeocode(this.geocodeCacheKey(variant, opts));
      if (cached) return cached;
    }
    let ambiguous = false;
    const alternatives = new Set<string>();
    for (const variant of variants) {
      try {
        const hit = await this.geocodeOnce(variant, opts);
        if (hit) return hit;
      } catch (error) {
        if (!(error instanceof AmbiguousDeliveryAddressError)) throw error;
        ambiguous = true;
        error.alternatives.forEach(value => alternatives.add(value));
      }
    }
    if (ambiguous) throw new AmbiguousDeliveryAddressError([...alternatives].slice(0, 3));
    return null;
  }

  /**
   * Primero variantes locales (Bogotá/Kennedy), al final el texto crudo.
   * Evita que "Castilla" solo resuelva a Castilla (España).
   */
  private geocodeQueryVariants(address: string): string[] {
    const q = splitDeliveryAddressParts(address).base.trim();
    const street = canonicalStreetAddress(q);
    const out: string[] = [];
    for (const text of street && street.toLowerCase() !== q.toLowerCase() ? [street, q] : [q]) {
      if (!/\b(bogot[aá]|colombia|cundinamarca)\b/i.test(text)) {
        out.push(`${text}, Kennedy, Bogotá, Colombia`);
        out.push(`${text}, Bogotá, Colombia`);
        out.push(`${text}, Colombia`);
      }
      out.push(text);
    }
    if (street) {
      // Same numbered destination, alternative separators; never strip letters or zones.
      const plain = street.replace(/[#-]/g, ' ').replace(/\s+/g, ' ').trim();
      out.splice(Math.min(2, out.length), 0, `${plain}, Kennedy, Bogotá, Colombia`, `${plain}, Bogotá, Colombia`);
    }
    return [...new Set(out)];
  }

  private geocodeCacheKey(
    query: string,
    opts: { region: string; near: LatLng; maxStraightKm: number },
  ): string {
    // Exact origin and acceptance radius prevent sharing a looser validation.
    return JSON.stringify([opts.region, opts.near.lat, opts.near.lng, opts.maxStraightKm, query.toLowerCase()]);
  }

  private cachedGeocode(key: string): (LatLng & { formatted?: string }) | null {
    const entry = this.geocodeCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.at >= this.CACHE_TTL_MS) {
      this.geocodeCache.delete(key);
      return null;
    }
    return entry.value;
  }

  private async geocodeOnce(
    q: string,
    opts: { region: string; near: LatLng; maxStraightKm: number },
  ): Promise<(LatLng & { formatted?: string }) | null> {
    const cacheKey = this.geocodeCacheKey(q, opts);
    const cached = this.cachedGeocode(cacheKey);
    if (cached) return cached;

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
        this.logQuote({
          source: 'google',
          api: 'geocode',
          http: res.status,
          status: data.status || null,
          error: this.googleErrorText(data.error_message),
          query: q.slice(0, 120),
        });
        return null;
      }

      let uncertain = false;
      const alternatives: string[] = [];
      for (const result of data.results) {
        if (!this.resultMatchesNamedPlace(q, result)) {
          uncertain = true;
          const street = canonicalStreetAddress(result.formatted_address || '');
          if (canonicalStreetAddress(q) && street && !result.partial_match && this.acceptGeocodeResult(result, opts.near, opts.maxStraightKm)) alternatives.push(street);
          continue;
        }
        const accepted = this.acceptGeocodeResult(result, opts.near, opts.maxStraightKm);
        if (accepted) {
          this.geocodeCache.set(cacheKey, { at: Date.now(), value: accepted });
          return accepted;
        }
      }

      if (uncertain) throw new AmbiguousDeliveryAddressError([...new Set(alternatives)].slice(0, 3));

      this.logQuote({
        source: 'app',
        api: 'geocode',
        reason: 'results_rejected',
        results: data.results.length,
        query: q.slice(0, 120),
      });
      return null;
    } catch (e) {
      if (e instanceof AmbiguousDeliveryAddressError) throw e;
      this.logQuote({
        source: 'app',
        api: 'geocode',
        reason: 'request_failed',
        error: (e as Error).message,
        query: q.slice(0, 120),
      });
      return null;
    }
  }

  /** Solo Colombia y cerca del restaurante. */
  private resultMatchesNamedPlace(query: string, result: any): boolean {
    const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const streetKey=(value:string):string|null=>{
      const street=canonicalStreetAddress(value);
      if(!street)return null;
      const zones=[...new Set(street.match(/\b(?:Sur|Este|Norte)\b/g)||[])].sort();
      return `${street.replace(/\b(?:Sur|Este|Norte)\b/g,'').replace(/^Avenida (Carrera|Calle)/,'$1').replace(/\s+/g,' ').trim().toLowerCase()}|${zones.join(',')}`;
    };
    const numberedStreet=streetKey(query);
    if (numberedStreet) {
      if (result.partial_match) return false;
      const formattedKey = streetKey(result.formatted_address || '');
      // A contradictory formatted street cannot be rescued by component fallback.
      if (formattedKey) return formattedKey === numberedStreet;
      const components = Array.isArray(result.address_components) ? result.address_components : [];
      const route = components.find((part: any) => part.types?.includes('route'));
      const number = components.find((part: any) => part.types?.includes('street_number'));
      return !!route && !!number && streetKey(`${route.long_name || route.short_name || ''} # ${number.long_name || number.short_name || ''}`) === numberedStreet;
    }
    const raw = normalize(splitDeliveryAddressParts(query).base).replace(/^a\s+/,'').replace(/^condomino\b/, 'condominio').split(',')[0];
    if (!/\b(?:plazuelas?|condominio|conjunto|residencial|urbanizacion|hotel|almacen|edificio|villa)\b/.test(raw)) return true;
    const ignored = new Set(['plazuela','plazuelas','condominio','conjunto','residencial','urbanizacion','hotel','almacen','edificio','de','del','la','el','las','los','para','en']);
    const tokens = (raw.match(/[a-z0-9]+/g) || []).filter(token => !ignored.has(token));
    if (!tokens.length) return false;
    const candidate = normalize([result.formatted_address || '', result.name || '',
      ...(result.address_components || []).map((part: any) => part.long_name || '')].join(' '));
    const words = new Set(candidate.match(/[a-z0-9]+/g) || []);
    return !result.partial_match && tokens.every(token => words.has(token));
  }

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
      this.logQuote({
        source: 'app',
        api: 'geocode',
        reason: 'foreign_country',
        country: country.short_name,
        formatted: formatted.slice(0, 120),
      });
      return null;
    }

    // Texto tipo España / Madrid sin Colombia
    if (
      /\b(españa|spain|madrid|barcelona|valencia|sevilla|portugal|méxico|mexico|peru|perú|argentina|chile)\b/i.test(
        formatted,
      ) &&
      !/\b(colombia|bogot[aá]|cundinamarca|kennedy|bosa|soacha)\b/i.test(formatted)
    ) {
      this.logQuote({
        source: 'app',
        api: 'geocode',
        reason: 'foreign_looking',
        formatted: formatted.slice(0, 120),
      });
      return null;
    }

    const km = this.haversineKm(near, { lat, lng });
    if (km > maxStraightKm) {
      this.logQuote({
        source: 'app',
        api: 'geocode',
        reason: 'too_far',
        km: Number(km.toFixed(1)),
        maxKm: maxStraightKm,
        formatted: formatted.slice(0, 120),
      });
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
  ): Promise<{ distanceKm: number; durationMinutes: number | null; destinationAddress?: string } | null> {
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
        this.logQuote({
          source: 'google',
          api: 'directions',
          http: res.status,
          status: data.status || null,
          error: this.googleErrorText(data.error_message),
        });
        return null;
      }
      const leg = data.routes[0].legs[0];
      const meters = Number(leg.distance?.value);
      const seconds = Number(leg.duration?.value);
      if (!Number.isFinite(meters) || meters < 0) return null;
      return {
        destinationAddress: typeof leg.end_address === 'string' ? leg.end_address.trim() || undefined : undefined,
        distanceKm: Math.round((meters / 1000) * 100) / 100,
        durationMinutes: Number.isFinite(seconds) ? Math.max(1, Math.round(seconds / 60)) : null,
      };
    } catch (e) {
      this.logQuote({
        source: 'app',
        api: 'directions',
        reason: 'request_failed',
        error: (e as Error).message,
      });
      return null;
    }
  }

  /** Google's message names the cause. Never include the API key. */
  private googleErrorText(message: unknown): string | null {
    const raw = String(message || '').trim();
    if (!raw) return null;
    const key = this.apiKey();
    return (key ? raw.replaceAll(key, 'REDACTED') : raw).slice(0, 300);
  }

  private logQuote(detail: Record<string, unknown>): void {
    this.logger.warn(`delivery_quote ${JSON.stringify(detail)}`);
  }

}
