import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { RestaurantSettings } from '../business/entities/restaurant-settings.entity';
import type { UpdateFactusInvoiceSettingsDto } from './dto/factus-invoice-settings.dto';
import type { FactusInvoiceSettingsResponse, ResolvedFactusTaxConfig } from './factus-invoice-settings.types';
export declare class FactusInvoiceSettingsService {
    private readonly config;
    private readonly settingsRepo;
    private cache;
    constructor(config: ConfigService, settingsRepo: Repository<RestaurantSettings>);
    getResolvedTaxConfig(): Promise<ResolvedFactusTaxConfig>;
    getAdminSettings(): Promise<FactusInvoiceSettingsResponse>;
    updateAdminSettings(dto: UpdateFactusInvoiceSettingsDto): Promise<FactusInvoiceSettingsResponse>;
    private parseTaxesFromDb;
    private configFromEnv;
    private parseJson;
}
