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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var UserAddressesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserAddressesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const config_1 = require("@nestjs/config");
const address_entity_1 = require("./entities/address.entity");
const DEFAULT_NEAR = { lat: 4.6323019, lng: -74.1471957 };
let UserAddressesService = UserAddressesService_1 = class UserAddressesService {
    addressRepository;
    config;
    logger = new common_1.Logger(UserAddressesService_1.name);
    constructor(addressRepository, config) {
        this.addressRepository = addressRepository;
        this.config = config;
    }
    async create(userId, createAddressDto) {
        if (createAddressDto.isDefault) {
            await this.addressRepository.update({ userId, isDefault: true }, { isDefault: false });
        }
        const hasPin = createAddressDto.lat != null &&
            createAddressDto.lng != null &&
            Number.isFinite(Number(createAddressDto.lat)) &&
            Number.isFinite(Number(createAddressDto.lng));
        const address = this.addressRepository.create({
            label: createAddressDto.label,
            address: createAddressDto.address,
            notes: createAddressDto.notes,
            userId,
            isDefault: createAddressDto.isDefault ?? false,
            type: createAddressDto.type ?? 'other',
            lat: hasPin ? Number(createAddressDto.lat) : null,
            lng: hasPin ? Number(createAddressDto.lng) : null,
            locationConfirmed: hasPin && createAddressDto.locationConfirmed !== false
                ? true
                : !!createAddressDto.locationConfirmed && hasPin,
        });
        return await this.addressRepository.save(address);
    }
    async findAll(userId) {
        return await this.addressRepository.find({
            where: { userId },
            order: { isDefault: 'DESC', createdAt: 'DESC' },
        });
    }
    async findOne(userId, id) {
        const address = await this.addressRepository.findOne({
            where: { id, userId },
        });
        if (!address) {
            throw new common_1.NotFoundException(`Address with ID ${id} not found`);
        }
        return address;
    }
    async update(userId, id, updateAddressDto) {
        const address = await this.findOne(userId, id);
        if (updateAddressDto.isDefault === true && !address.isDefault) {
            await this.addressRepository.update({ userId, isDefault: true }, { isDefault: false });
        }
        const nextAddressText = updateAddressDto.address != null ? String(updateAddressDto.address).trim() : address.address;
        const addressTextChanged = updateAddressDto.address != null &&
            nextAddressText.toLowerCase() !== String(address.address || '').trim().toLowerCase();
        const hasPin = updateAddressDto.lat != null &&
            updateAddressDto.lng != null &&
            Number.isFinite(Number(updateAddressDto.lat)) &&
            Number.isFinite(Number(updateAddressDto.lng));
        if (updateAddressDto.label != null)
            address.label = updateAddressDto.label;
        if (updateAddressDto.address != null)
            address.address = nextAddressText;
        if (updateAddressDto.notes !== undefined)
            address.notes = updateAddressDto.notes;
        if (updateAddressDto.type != null)
            address.type = updateAddressDto.type;
        if (updateAddressDto.isDefault != null)
            address.isDefault = updateAddressDto.isDefault;
        if (hasPin) {
            address.lat = Number(updateAddressDto.lat);
            address.lng = Number(updateAddressDto.lng);
            address.locationConfirmed = updateAddressDto.locationConfirmed !== false;
        }
        else if (addressTextChanged) {
            address.lat = null;
            address.lng = null;
            address.locationConfirmed = false;
        }
        else if (updateAddressDto.locationConfirmed === false) {
            address.locationConfirmed = false;
        }
        return await this.addressRepository.save(address);
    }
    async remove(userId, id) {
        const address = await this.findOne(userId, id);
        await this.addressRepository.remove(address);
    }
    async setDefault(userId, id) {
        await this.addressRepository.update({ userId, isDefault: true }, { isDefault: false });
        const address = await this.findOne(userId, id);
        address.isDefault = true;
        return await this.addressRepository.save(address);
    }
    async geocodePreview(addressText) {
        const q = (addressText || '').trim();
        if (q.length < 4) {
            throw new common_1.BadRequestException('Escribe una dirección más completa para ubicarla.');
        }
        const key = (this.config.get('GOOGLE_MAPS_API_KEY') || '').trim();
        if (!key) {
            this.logger.warn('GOOGLE_MAPS_API_KEY missing — returning default map center');
            return {
                lat: DEFAULT_NEAR.lat,
                lng: DEFAULT_NEAR.lng,
                formattedAddress: q,
            };
        }
        const near = this.restaurantNear();
        const variants = this.geocodeQueryVariants(q);
        for (const variant of variants) {
            const hit = await this.geocodeOnce(variant, key, near);
            if (hit)
                return hit;
        }
        this.logger.warn(`Geocode no match for "${q.slice(0, 80)}" — default center`);
        return {
            lat: near.lat,
            lng: near.lng,
            formattedAddress: q,
        };
    }
    restaurantNear() {
        const lat = Number(this.config.get('RESTAURANT_LAT') || DEFAULT_NEAR.lat);
        const lng = Number(this.config.get('RESTAURANT_LNG') || DEFAULT_NEAR.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng))
            return { lat, lng };
        return DEFAULT_NEAR;
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
    async geocodeOnce(q, key, near) {
        const d = 0.18;
        const sw = `${near.lat - d},${near.lng - d}`;
        const ne = `${near.lat + d},${near.lng + d}`;
        const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
        url.searchParams.set('address', q);
        url.searchParams.set('key', key);
        url.searchParams.set('region', 'co');
        url.searchParams.set('language', 'es');
        url.searchParams.set('components', 'country:CO');
        url.searchParams.set('bounds', `${sw}|${ne}`);
        try {
            const res = await fetch(url.toString());
            const data = (await res.json());
            if (data.status !== 'OK' || !data.results?.length)
                return null;
            for (const result of data.results) {
                const loc = result.geometry?.location;
                if (!loc)
                    continue;
                const lat = Number(loc.lat);
                const lng = Number(loc.lng);
                if (!Number.isFinite(lat) || !Number.isFinite(lng))
                    continue;
                const country = result.address_components?.find((c) => (c.types || []).includes('country'));
                if (country?.short_name && country.short_name !== 'CO')
                    continue;
                const dist = this.haversineKm(near.lat, near.lng, lat, lng);
                if (dist > 25)
                    continue;
                return {
                    lat,
                    lng,
                    formattedAddress: result.formatted_address || q,
                };
            }
            return null;
        }
        catch (e) {
            this.logger.warn(`Geocode error: ${e.message}`);
            return null;
        }
    }
    async reverseGeocodePreview(lat, lng) {
        const la = Number(lat);
        const ln = Number(lng);
        if (!Number.isFinite(la) || !Number.isFinite(ln)) {
            throw new common_1.BadRequestException('Coordenadas inválidas.');
        }
        const key = (this.config.get('GOOGLE_MAPS_API_KEY') || '').trim();
        if (!key) {
            return { lat: la, lng: ln };
        }
        const near = this.restaurantNear();
        const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
        url.searchParams.set('latlng', `${la},${ln}`);
        url.searchParams.set('key', key);
        url.searchParams.set('language', 'es');
        url.searchParams.set('region', 'co');
        try {
            const res = await fetch(url.toString());
            const data = (await res.json());
            if (data.status !== 'OK' || !data.results?.length) {
                return { lat: la, lng: ln };
            }
            for (const result of data.results) {
                const country = result.address_components?.find((c) => (c.types || []).includes('country'));
                if (country?.short_name && country.short_name !== 'CO')
                    continue;
                const formatted = (result.formatted_address || '').trim();
                if (formatted) {
                    return { lat: la, lng: ln, formattedAddress: formatted };
                }
            }
        }
        catch (e) {
            this.logger.warn(`Reverse geocode error: ${e.message}`);
        }
        return { lat: la, lng: ln };
    }
    haversineKm(aLat, aLng, bLat, bLng) {
        const R = 6371;
        const toRad = (d) => (d * Math.PI) / 180;
        const dLat = toRad(bLat - aLat);
        const dLng = toRad(bLng - aLng);
        const x = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
        return 2 * R * Math.asin(Math.sqrt(x));
    }
};
exports.UserAddressesService = UserAddressesService;
exports.UserAddressesService = UserAddressesService = UserAddressesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(address_entity_1.Address)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        config_1.ConfigService])
], UserAddressesService);
//# sourceMappingURL=user-addresses.service.js.map