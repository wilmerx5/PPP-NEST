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
    groupProductsByCategory(products: WhatsappCatalogProduct[]): Map<string, WhatsappCatalogProduct[]>;
    isMenuExploreIntent(text: string, products?: WhatsappCatalogProduct[]): boolean;
    buildMenuExploreIntro(text: string): string;
    formatMenuCategoryOverview(products: WhatsappCatalogProduct[], opts?: {
        intro?: string;
        examplesPerCategory?: number;
        menuUrl?: string | null;
    }): {
        text: string;
        categories: string[];
    };
    buildMenuCategoryContextForAi(products: WhatsappCatalogProduct[]): string;
    resolveCategoryBrowsePick(text: string, categories: string[]): string | null;
    getProductById(id: number, products: WhatsappCatalogProduct[]): WhatsappCatalogProduct | null;
    extractCodeFromMessage(text: string): number | null;
    findByCode(code: number, products: WhatsappCatalogProduct[]): WhatsappCatalogProduct | null;
    extractProductSearchQuery(text: string): string;
    findProductEmbeddedInMessage(text: string, products: WhatsappCatalogProduct[]): WhatsappCatalogProduct | null;
    private looksLikeDeliveryTail;
    findByCategory(query: string, products: WhatsappCatalogProduct[]): {
        categoryName: string;
        products: WhatsappCatalogProduct[];
    } | null;
    searchByName(query: string, products: WhatsappCatalogProduct[], limit?: number): WhatsappCatalogProduct[];
    searchByNameScored(query: string, products: WhatsappCatalogProduct[], limit?: number): Array<{
        p: WhatsappCatalogProduct;
        score: number;
    }>;
    isStrongProductMatch(scored: Array<{
        p: WhatsappCatalogProduct;
        score: number;
    }>): boolean;
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
