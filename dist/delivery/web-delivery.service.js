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
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebDeliveryService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const business_service_1 = require("../business/business.service");
const whatsapp_delivery_routing_service_1 = require("../whatsapp/whatsapp-delivery-routing.service");
const whatsapp_delivery_fee_1 = require("../whatsapp/whatsapp-delivery-fee");
const web_delivery_fee_1 = require("./web-delivery-fee");
const DEFAULT_RESTAURANT = { lat: 4.6323019, lng: -74.1471957 };
let WebDeliveryService = class WebDeliveryService {
    routing;
    config;
    businessService;
    constructor(routing, config, businessService) {
        this.routing = routing;
        this.config = config;
        this.businessService = businessService;
    }
    restaurantCoords() {
        const lat = Number(this.config.get('RESTAURANT_LAT') || DEFAULT_RESTAURANT.lat);
        const lng = Number(this.config.get('RESTAURANT_LNG') || DEFAULT_RESTAURANT.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng))
            return { lat, lng };
        return DEFAULT_RESTAURANT;
    }
    async getConfig() {
        return this.businessService.getWebDeliveryConfig();
    }
    async quote(params) {
        const { defaultFee, maxKm, tiers } = await this.getConfig();
        const restaurant = this.restaurantCoords();
        const lat = params.lat != null && Number.isFinite(Number(params.lat))
            ? Number(params.lat)
            : null;
        const lng = params.lng != null && Number.isFinite(Number(params.lng))
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
                source: quote.source === 'google_directions'
                    ? 'google_directions'
                    : 'fallback_default',
            };
        }
        if (lat != null && lng != null) {
            const km = this.haversineKm(restaurant, { lat, lng });
            const priced = (0, whatsapp_delivery_fee_1.feeFromDistanceKm)(km, tiers, maxKm);
            if ('outOfCoverage' in priced) {
                return {
                    ok: false,
                    reason: 'out_of_coverage',
                    message: `Tu dirección queda a ~${km.toFixed(1)} km y está fuera de cobertura (máx. ${maxKm} km).`,
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
    async assertOnlineDeliveryFee(deliveryFee, params) {
        const quote = await this.quote(params);
        if (!quote.ok) {
            throw new Error(quote.message);
        }
        if (Math.round(Number(deliveryFee)) !== quote.fee) {
            throw new Error(`El costo de envío cambió ($${quote.fee.toLocaleString('es-CO')}). Actualiza la página e intenta de nuevo.`);
        }
        return quote.fee;
    }
    async getTiers() {
        const cfg = await this.getConfig();
        return cfg.tiers.length ? cfg.tiers : [...web_delivery_fee_1.WEB_DELIVERY_FEE_TIERS];
    }
    haversineKm(a, b) {
        const R = 6371;
        const toRad = (d) => (d * Math.PI) / 180;
        const dLat = toRad(b.lat - a.lat);
        const dLng = toRad(b.lng - a.lng);
        const x = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
        return 2 * R * Math.asin(Math.sqrt(x));
    }
};
exports.WebDeliveryService = WebDeliveryService;
exports.WebDeliveryService = WebDeliveryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [whatsapp_delivery_routing_service_1.WhatsappDeliveryRoutingService,
        config_1.ConfigService,
        business_service_1.BusinessService])
], WebDeliveryService);
//# sourceMappingURL=web-delivery.service.js.map