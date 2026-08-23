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
    getCategoryNames(): Promise<string[]>;
    getProductById(id: number, products: WhatsappCatalogProduct[]): WhatsappCatalogProduct | null;
    extractCodeFromMessage(text: string): number | null;
    findByCode(code: number, products: WhatsappCatalogProduct[]): WhatsappCatalogProduct | null;
    findByCategory(query: string, products: WhatsappCatalogProduct[]): {
        categoryName: string;
        products: WhatsappCatalogProduct[];
    } | null;
    searchByName(query: string, products: WhatsappCatalogProduct[], limit?: number): WhatsappCatalogProduct[];
    formatProductListItem(product: WhatsappCatalogProduct, index?: number): string;
    formatCategoryList(categoryName: string, list: WhatsappCatalogProduct[]): string;
    formatProductOptionsPrompt(product: WhatsappCatalogProduct, alreadySelected?: {
        attributeName: string;
        attributeValue: string;
    }[]): string;
    resolveNextAttributeChoice(product: WhatsappCatalogProduct, text: string, alreadySelected: {
        attributeName: string;
        attributeValue: string;
    }[]): {
        status: 'complete';
        attributes: {
            attributeName: string;
            attributeValue: string;
        }[];
    } | {
        status: 'partial';
        attributes: {
            attributeName: string;
            attributeValue: string;
        }[];
    } | {
        status: 'invalid';
    };
    resolveAttributesFromText(product: WhatsappCatalogProduct, text: string): {
        attributeName: string;
        attributeValue: string;
    }[] | null;
}
