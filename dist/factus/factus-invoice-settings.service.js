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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FactusInvoiceSettingsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const restaurant_settings_entity_1 = require("../business/entities/restaurant-settings.entity");
const SETTINGS_ID = 1;
const CACHE_MS = 30_000;
let FactusInvoiceSettingsService = class FactusInvoiceSettingsService {
    config;
    settingsRepo;
    cache = null;
    constructor(config, settingsRepo) {
        this.config = config;
        this.settingsRepo = settingsRepo;
    }
    async getResolvedTaxConfig() {
        if (this.cache && Date.now() - this.cache.at < CACHE_MS) {
            return this.cache.config;
        }
        const row = await this.settingsRepo.findOne({ where: { id: SETTINGS_ID } });
        const fromDb = this.parseTaxesFromDb(row);
        if (fromDb) {
            const resolved = {
                taxes: fromDb.taxes,
                pricesIncludeTax: fromDb.pricesIncludeTax,
                source: 'database',
            };
            this.cache = { at: Date.now(), config: resolved };
            return resolved;
        }
        const resolved = this.configFromEnv();
        this.cache = { at: Date.now(), config: resolved };
        return resolved;
    }
    async getAdminSettings() {
        const row = await this.settingsRepo.findOne({ where: { id: SETTINGS_ID } });
        const fromDb = this.parseTaxesFromDb(row);
        const envDefaults = this.configFromEnv();
        if (fromDb) {
            return {
                itemTaxes: fromDb.taxes,
                pricesIncludeTax: fromDb.pricesIncludeTax,
                configuredInDatabase: true,
                effectiveSource: 'database',
                envDefaults: {
                    itemTaxes: envDefaults.taxes,
                    pricesIncludeTax: envDefaults.pricesIncludeTax,
                },
            };
        }
        return {
            itemTaxes: envDefaults.taxes,
            pricesIncludeTax: envDefaults.pricesIncludeTax,
            configuredInDatabase: false,
            effectiveSource: 'env',
            envDefaults: {
                itemTaxes: envDefaults.taxes,
                pricesIncludeTax: envDefaults.pricesIncludeTax,
            },
        };
    }
    async updateAdminSettings(dto) {
        let row = await this.settingsRepo.findOne({ where: { id: SETTINGS_ID } });
        if (!row) {
            row = this.settingsRepo.create({ id: SETTINGS_ID, timezone: 'America/Bogota' });
        }
        row.factusItemTaxes = dto.itemTaxes.map((t) => ({
            code: t.code.trim(),
            rate: Number(t.rate),
            isExcluded: !!t.isExcluded,
        }));
        row.factusPricesIncludeTax = dto.pricesIncludeTax;
        await this.settingsRepo.save(row);
        this.cache = null;
        return this.getAdminSettings();
    }
    parseTaxesFromDb(row) {
        if (!row?.factusItemTaxes)
            return null;
        const raw = this.parseJson(row.factusItemTaxes, []);
        if (!Array.isArray(raw) || raw.length === 0)
            return null;
        const taxes = raw
            .map((t) => ({
            code: String(t?.code ?? '').trim(),
            rate: Number(t?.rate),
            isExcluded: !!t?.isExcluded,
        }))
            .filter((t) => t.code && Number.isFinite(t.rate));
        if (!taxes.length)
            return null;
        return {
            taxes,
            pricesIncludeTax: row.factusPricesIncludeTax !== false,
        };
    }
    configFromEnv() {
        const code = this.config.get('FACTUS_ITEM_TAX_CODE') || '04';
        const rate = parseFloat(this.config.get('FACTUS_ITEM_TAX_RATE') || '8') || 0;
        const excluded = (this.config.get('FACTUS_ITEM_TAX_EXCLUDED') || 'false').toLowerCase() ===
            'true';
        const pricesIncludeTax = (this.config.get('FACTUS_PRICES_INCLUDE_TAX') || 'true').toLowerCase() !==
            'false';
        return {
            taxes: [{ code: code.trim(), rate, isExcluded: excluded }],
            pricesIncludeTax,
            source: 'env',
        };
    }
    parseJson(value, fallback) {
        if (typeof value === 'string') {
            try {
                return JSON.parse(value);
            }
            catch {
                return fallback;
            }
        }
        return (value ?? fallback);
    }
};
exports.FactusInvoiceSettingsService = FactusInvoiceSettingsService;
exports.FactusInvoiceSettingsService = FactusInvoiceSettingsService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, typeorm_1.InjectRepository)(restaurant_settings_entity_1.RestaurantSettings)),
    __metadata("design:paramtypes", [config_1.ConfigService,
        typeorm_2.Repository])
], FactusInvoiceSettingsService);
//# sourceMappingURL=factus-invoice-settings.service.js.map