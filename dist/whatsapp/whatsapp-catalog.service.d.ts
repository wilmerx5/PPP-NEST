import { ProductsService } from '../products/products.service';
import type { WhatsappProductCandidate } from './types/whatsapp-session.types';
export declare class WhatsappCatalogService {
    private readonly productsService;
    private menuCache;
    private readonly TTL_MS;
    constructor(productsService: ProductsService);
    getMenuProducts(): Promise<WhatsappProductCandidate[]>;
    getMenuCompactText(): Promise<string>;
    extractCodeFromMessage(text: string): number | null;
    findByCode(code: number, products: WhatsappProductCandidate[]): WhatsappProductCandidate | null;
    searchByName(query: string, products: WhatsappProductCandidate[], limit?: number): WhatsappProductCandidate[];
}
