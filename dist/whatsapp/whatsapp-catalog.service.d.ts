import { ProductsService } from '../products/products.service';
import type { WhatsappProductCandidate } from './types/whatsapp-session.types';
import { type MenuConceptGroup } from './whatsapp-menu-concepts';
export type WhatsappCatalogProduct = WhatsappProductCandidate;
export type MultiProductSegmentMatch = {
    segment: string;
    product: WhatsappCatalogProduct;
    score: number;
};
export type MultiProductResolveResult = {
    segments: string[];
    confident: MultiProductSegmentMatch[];
    ambiguous: Array<{
        segment: string;
        candidates: WhatsappCatalogProduct[];
    }>;
    unresolved: string[];
    needsAttributes: MultiProductSegmentMatch[];
};
export type ProductVariantFamily = {
    baseLabel: string;
    baseKey: string;
    variants: WhatsappCatalogProduct[];
};
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
    stripProductSearchNoise(query: string): string;
    cleanOrderSegment(segment: string): string;
    findAllProductsEmbeddedInMessage(text: string, products: WhatsappCatalogProduct[]): WhatsappCatalogProduct[];
    looksLikeMultiItemOrderMessage(text: string): boolean;
    findProductEmbeddedInMessage(text: string, products: WhatsappCatalogProduct[]): WhatsappCatalogProduct | null;
    private looksLikeDeliveryTail;
    dedupeProductsById(products: WhatsappCatalogProduct[]): WhatsappCatalogProduct[];
    formatProductChoicePrompt(query: string, candidates: WhatsappCatalogProduct[], opts?: {
        intro?: string;
    }): string;
    findByCategory(query: string, products: WhatsappCatalogProduct[]): {
        categoryName: string;
        products: WhatsappCatalogProduct[];
    } | null;
    private refineCategoryListByQuery;
    findCategoryBrowseHit(text: string, products: WhatsappCatalogProduct[], menuConceptGroups?: MenuConceptGroup[]): {
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
    isPriceInquiryIntent(text: string): boolean;
    stripPriceInquiryNoise(text: string): string;
    formatProductPriceReply(product: WhatsappCatalogProduct): string;
    formatProductVariantsOverview(product: WhatsappCatalogProduct, mode?: 'info' | 'order', alreadySelected?: {
        attributeName: string;
        attributeValue: string;
    }[]): string;
    private optionNumberEmoji;
    formatOptionsList(rows: Array<{
        index: number;
        label: string;
        price: number;
        code?: number;
    }>): string;
    formatOptionsTable(rows: Array<{
        index: number;
        label: string;
        price: number;
        code?: number;
    }>): string;
    isVariantPreferenceIntent(text: string): boolean;
    isComboAvailabilityQuestion(text: string): boolean;
    extractVariantPreferenceHint(text: string): 'combo' | 'solo' | null;
    formatAttributeStepPrompt(product: WhatsappCatalogProduct, attr: {
        attributeName: string;
        options: string[];
    }, alreadySelected?: {
        attributeName: string;
        attributeValue: string;
    }[], opts?: {
        mode?: 'info' | 'order';
        skipHeader?: boolean;
    }): string;
    getProductNameBase(name: string): string;
    getVariantDisplayLabel(fullName: string, baseKey: string): string;
    findProductVariantFamily(query: string, products: WhatsappCatalogProduct[], hints?: WhatsappCatalogProduct[]): ProductVariantFamily | null;
    pickVariantFromFamilyText(text: string, family: ProductVariantFamily): WhatsappCatalogProduct | null;
    formatVariantFamilyPrompt(family: ProductVariantFamily): string;
    getRemainingAttributes(product: WhatsappCatalogProduct, alreadySelected?: {
        attributeName: string;
        attributeValue: string;
    }[]): NonNullable<WhatsappCatalogProduct['attributes']>;
    isComboOnlyAttribute(attr: {
        attributeName: string;
    }): boolean;
    hasComboPortionSelected(alreadySelected: {
        attributeName: string;
        attributeValue: string;
    }[]): boolean;
    formatDescriptionForAttributeStep(description: string | null | undefined, alreadySelected: {
        attributeName: string;
        attributeValue: string;
    }[], nextAttr?: {
        attributeName: string;
    }): string | null;
    isGenericProductInquiry(text: string): boolean;
    isShortGenericFoodQuery(query: string): boolean;
    extractExplicitAttributeChoice(text: string, product: WhatsappCatalogProduct): {
        attributeName: string;
        attributeValue: string;
    }[] | null;
    shouldShowVariantsOverview(text: string, product: WhatsappCatalogProduct): boolean;
    formatPriceInquiryList(products: WhatsappCatalogProduct[]): string;
    splitMultiProductSegments(text: string): string[];
    private splitSegmentOnArticles;
    resolveMultiProductOrder(text: string, products: WhatsappCatalogProduct[]): MultiProductResolveResult | null;
    formatProductListItem(product: WhatsappCatalogProduct, index?: number): string;
    formatCategoryList(categoryName: string, list: WhatsappCatalogProduct[]): string;
    formatProductOptionsPrompt(product: WhatsappCatalogProduct, alreadySelected?: {
        attributeName: string;
        attributeValue: string;
    }[]): string;
    resolveAttributesFromMessage(product: WhatsappCatalogProduct, text: string, alreadySelected?: {
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
    pickAttributeOptionFromText(text: string, attr: {
        attributeName: string;
        options: string[];
    }): string | null;
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
