import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RestaurantSettings } from '../business/entities/restaurant-settings.entity';
import type { UpdateFactusInvoiceSettingsDto } from './dto/factus-invoice-settings.dto';
import type {
  FactusInvoiceSettingsResponse,
  FactusItemTaxLine,
  ResolvedFactusTaxConfig,
} from './factus-invoice-settings.types';

const SETTINGS_ID = 1;
const CACHE_MS = 30_000;

@Injectable()
export class FactusInvoiceSettingsService {
  private cache: { at: number; config: ResolvedFactusTaxConfig } | null = null;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(RestaurantSettings)
    private readonly settingsRepo: Repository<RestaurantSettings>,
  ) {}

  /** Config efectiva para emitir FE (BD → fallback .env). */
  async getResolvedTaxConfig(): Promise<ResolvedFactusTaxConfig> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) {
      return this.cache.config;
    }
    const row = await this.settingsRepo.findOne({ where: { id: SETTINGS_ID } });
    const fromDb = this.parseTaxesFromDb(row);
    if (fromDb) {
      const resolved: ResolvedFactusTaxConfig = {
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

  async getAdminSettings(): Promise<FactusInvoiceSettingsResponse> {
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

  async updateAdminSettings(
    dto: UpdateFactusInvoiceSettingsDto,
  ): Promise<FactusInvoiceSettingsResponse> {
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

  private parseTaxesFromDb(
    row: RestaurantSettings | null,
  ): { taxes: FactusItemTaxLine[]; pricesIncludeTax: boolean } | null {
    if (!row?.factusItemTaxes) return null;
    const raw = this.parseJson<FactusItemTaxLine[]>(row.factusItemTaxes, []);
    if (!Array.isArray(raw) || raw.length === 0) return null;
    const taxes = raw
      .map((t) => ({
        code: String(t?.code ?? '').trim(),
        rate: Number(t?.rate),
        isExcluded: !!t?.isExcluded,
      }))
      .filter((t) => t.code && Number.isFinite(t.rate));
    if (!taxes.length) return null;
    return {
      taxes,
      pricesIncludeTax: row.factusPricesIncludeTax !== false,
    };
  }

  private configFromEnv(): ResolvedFactusTaxConfig {
    const code = this.config.get<string>('FACTUS_ITEM_TAX_CODE') || '04';
    const rate = parseFloat(this.config.get<string>('FACTUS_ITEM_TAX_RATE') || '8') || 0;
    const excluded =
      (this.config.get<string>('FACTUS_ITEM_TAX_EXCLUDED') || 'false').toLowerCase() ===
      'true';
    const pricesIncludeTax =
      (this.config.get<string>('FACTUS_PRICES_INCLUDE_TAX') || 'true').toLowerCase() !==
      'false';
    return {
      taxes: [{ code: code.trim(), rate, isExcluded: excluded }],
      pricesIncludeTax,
      source: 'env',
    };
  }

  private parseJson<T>(value: T | string | null | undefined, fallback: T): T {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as T;
      } catch {
        return fallback;
      }
    }
    return (value ?? fallback) as T;
  }
}
