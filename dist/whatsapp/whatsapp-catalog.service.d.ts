import { ProductsService } from '../products/products.service';
import type { WhatsappProductCandidate } from './types/whatsapp-session.types';
export type WhatsappCatalogProduct = WhatsappProductCandidate;
export declare class WhatsappCatalogService {
    private readonly productsService;
    private menuCache;
    private readonly TTL_MS;
    constructor(productsService: ProductsService);
    getMenuProducts(): Promise<WhatsappCatalogProduct[]>;
    getMenuCompactText(): Promise<string>;
    getMenuDetailedText(): Promise<string>;
    getProductById(id: number, products: WhatsappCatalogProduct[]): WhatsappCatalogProduct | null;
    extractCodeFromMessage(text: string): number | null;
    findByCode(code: number, products: WhatsappCatalogProduct[]): WhatsappCatalogProduct | null;
    searchByName(query: string, products: WhatsappCatalogProduct[], limit?: number): WhatsappCatalogProduct[];
    resolveAttributesFromText(product: WhatsappCatalogProduct, text: string): {
        attributeName: string;
        attributeValue: string;
    }[] | null;
}
