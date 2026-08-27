"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var WhatsappDeliveryRoutingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsappDeliveryRoutingService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const whatsapp_delivery_fee_1 = require("./whatsapp-delivery-fee");
let WhatsappDeliveryRoutingService = WhatsappDeliveryRoutingService_1 = class WhatsappDeliveryRoutingService {
    config;
    logger = new common_1.Logger(WhatsappDeliveryRoutingService_1.name);
    geocodeCache = new Map();
    CACHE_TTL_MS = 1000 * 60 * 60 * 12;
    constructor(config) {
        this.config = config;
    }
    apiKey() {
        const k = (this.config.get('GOOGLE_MAPS_API_KEY') || '').trim();
        return k || null;
    }
    hasApiKey() {
        return !!this.apiKey();
    }
    async quoteDeliveryFee(params) {
        const key = this.apiKey();
        if (!key) {
            return {
                ok: false,
                reason: 'no_api_key',
                message: 'No hay GOOGLE_MAPS_API_KEY configurada. Se usará el domicilio fijo hasta que la configures.',
            };
        }
        if (!Number.isFinite(params.restaurant.lat) || !Number.isFinite(params.restaurant.lng)) {
            return {
                ok: false,
                reason: 'no_restaurant_coords',
                message: 'Faltan coordenadas del restaurante en la configuración.',
            };
        }
        const maxStraightKm = Math.max(20, Number(params.maxKm) * 4 || 22);
        let customer = params.customerCoords || null;
        let formatted;
        if (customer) {
            const pinKm = this.haversineKm(params.restaurant, customer);
            if (pinKm > maxStraightKm) {
                this.logger.warn(`Customer pin too far (${pinKm.toFixed(1)} km) — treating as geocode_failed`);
                return {
                    ok: false,
                    reason: 'geocode_failed',
                    message: 'Esa ubicación queda muy lejos del local. ¿Me confirmas la dirección en Bogotá (barrio / conjunto)?',
                };
            }
        }
        else {
            const geo = await this.geocodeAddress(params.customerAddress, {
                region: params.regionBias || 'co',
                near: params.restaurant,
                maxStraightKm,
            });
            if (!geo) {
                return {
                    ok: false,
                    reason: 'geocode_failed',
                    message: 'No pude ubicar esa dirección en el mapa. ¿Me la escribes más completa (calle, número, barrio)?',
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
                message: 'No pude calcular la ruta hasta esa dirección. ¿Confirmas la dirección o prefieres *recojo* en el local?',
            };
        }
        const absurdRouteKm = Math.max(40, Number(params.maxKm) * 8 || 44);
        if (route.distanceKm > absurdRouteKm) {
            this.logger.warn(`Route absurdly long (${route.distanceKm} km) — treating as geocode_failed`);
            return {
                ok: false,
                reason: 'geocode_failed',
                distanceKm: route.distanceKm,
                message: 'No pude ubicar bien esa dirección cerca del local. ¿Me la detallas un poco más (Bogotá / barrio)?',
            };
        }
        const priced = (0, whatsapp_delivery_fee_1.feeFromDistanceKm)(route.distanceKm, params.tiers, params.maxKm);
        if ('outOfCoverage' in priced) {
            return {
                ok: false,
                reason: 'out_of_coverage',
                distanceKm: route.distanceKm,
                message: `Esa dirección queda a *~${route.distanceKm.toFixed(1)} km* por ruta y está *fuera de cobertura* ` +
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
    fixedFeeQuote(fallbackFee) {
        return {
            ok: true,
            distanceKm: 0,
            durationMinutes: null,
            fee: Math.max(0, Math.round(fallbackFee)),
            source: 'fallback_fixed',
            customer: { lat: 0, lng: 0 },
        };
    }
    async geocodeAddress(address, opts) {
        const q = (address || '').trim();
        if (q.length < 4)
            return null;
        const variants = this.geocodeQueryVariants(q);
        for (const variant of variants) {
            const hit = await this.geocodeOnce(variant, opts);
            if (hit)
                return hit;
        }
        return null;
    }
    geocodeQueryVariants(address) {
        const q = address.trim();
        const out = [];
        if (!/\b(bogot[aá]|colombia|cundinamarca)\b/i.test(q)) {
            out.push(`${q}, Kennedy, Bogotá, Colombia`);
            out.push(`${q}, Bogotá, Colombia`);
            out.push(`${q}, Colombia`);
        }
        out.push(q);
        return out;
    }
    async geocodeOnce(q, opts) {
        const cacheKey = `${opts.region}::${opts.near.lat.toFixed(3)},${opts.near.lng.toFixed(3)}::${q.toLowerCase()}`;
        const cached = this.geocodeCache.get(cacheKey);
        if (cached && Date.now() - cached.at < this.CACHE_TTL_MS)
            return cached.value;
        const key = this.apiKey();
        if (!key)
            return null;
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
            const data = (await res.json());
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
            this.logger.warn(`Geocode: ${data.results.length} result(s) rejected (far/foreign) for "${q.slice(0, 80)}"`);
            return null;
        }
        catch (e) {
            this.logger.warn(`Geocode error: ${e.message}`);
            return null;
        }
    }
    acceptGeocodeResult(result, near, maxStraightKm) {
        const loc = result?.geometry?.location;
        if (!loc)
            return null;
        const lat = Number(loc.lat);
        const lng = Number(loc.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng))
            return null;
        const formatted = String(result.formatted_address || '');
        const comps = Array.isArray(result.address_components) ? result.address_components : [];
        const country = comps.find((c) => (c.types || []).includes('country'));
        if (country?.short_name && country.short_name !== 'CO') {
            this.logger.warn(`Geocode reject foreign country=${country.short_name}: ${formatted}`);
            return null;
        }
        if (/\b(españa|spain|madrid|barcelona|valencia|sevilla|portugal|méxico|mexico|peru|perú|argentina|chile)\b/i.test(formatted) &&
            !/\b(colombia|bogot[aá]|cundinamarca|kennedy|bosa|soacha)\b/i.test(formatted)) {
            this.logger.warn(`Geocode reject foreign-looking: ${formatted}`);
            return null;
        }
        const km = this.haversineKm(near, { lat, lng });
        if (km > maxStraightKm) {
            this.logger.warn(`Geocode reject far ${km.toFixed(1)}km (>${maxStraightKm}): ${formatted}`);
            return null;
        }
        return { lat, lng, formatted };
    }
    haversineKm(a, b) {
        const toRad = (d) => (d * Math.PI) / 180;
        const R = 6371;
        const dLat = toRad(b.lat - a.lat);
        const dLng = toRad(b.lng - a.lng);
        const lat1 = toRad(a.lat);
        const lat2 = toRad(b.lat);
        const h = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    }
    async directionsDistance(origin, destination) {
        const key = this.apiKey();
        if (!key)
            return null;
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
            const data = (await res.json());
            if (data.status !== 'OK' || !data.routes?.[0]?.legs?.[0]) {
                this.logger.warn(`Directions fail status=${data.status}`);
                return null;
            }
            const leg = data.routes[0].legs[0];
            const meters = Number(leg.distance?.value);
            const seconds = Number(leg.duration?.value);
            if (!Number.isFinite(meters) || meters < 0)
                return null;
            return {
                distanceKm: Math.round((meters / 1000) * 100) / 100,
                durationMinutes: Number.isFinite(seconds) ? Math.max(1, Math.round(seconds / 60)) : null,
            };
        }
        catch (e) {
            this.logger.warn(`Directions error: ${e.message}`);
            return null;
        }
    }
    normalizeTiers(raw) {
        return (0, whatsapp_delivery_fee_1.normalizeDeliveryFeeTiers)(raw);
    }
};
exports.WhatsappDeliveryRoutingService = WhatsappDeliveryRoutingService;
exports.WhatsappDeliveryRoutingService = WhatsappDeliveryRoutingService = WhatsappDeliveryRoutingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], WhatsappDeliveryRoutingService);
//# sourceMappingURL=whatsapp-delivery-routing.service.js.map