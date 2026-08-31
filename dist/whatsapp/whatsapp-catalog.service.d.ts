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
    possibleCustomerNames?: string[];
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
    isCourtesyOnlyMessage(text: string): boolean;
    formatCourtesyReply(brandName?: string): string;
    isOffTopicChitchat(text: string): boolean;
    formatOffTopicRedirect(brandName?: string): string;
    isMenuExploreIntent(text: string, products?: WhatsappCatalogProduct[]): boolean;
    isCategoryBrowseQuestion(text: string): boolean;
    isRestaurantLocationInquiry(text: string): boolean;
    private readonly QTY_WORD_MAP;
    private readonly QTY_SKIP_AFTER_NUM;
    countQuantityMentions(text: string): number;
    extractQuantityNearProduct(fullText: string, productName: string): number | null;
    extractQuantityFromSegment(text: string): number;
    extractQuantityFromMessage(text: string): number;
    stripQuantityFromSearchQuery(text: string): string;
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
    extractListPickNumber(text: string): number | null;
    findByCode(code: number, products: WhatsappCatalogProduct[]): WhatsappCatalogProduct | null;
    extractProductSearchQuery(text: string): string;
    stripProductDescriptionInquiryNoise(text: string): string;
    stripProductSearchNoise(query: string): string;
    cleanOrderSegment(segment: string): string;
    isPolitenessOnlySegment(segment: string): boolean;
    looksLikePersonNameSegment(segment: string): boolean;
    private readonly WEAK_PRODUCT_TOKENS;
    private isDistinctiveProductToken;
    private productNameHasPackMultiplier;
    private queryAsksForPackMultiplier;
    private unrequestedNameTokens;
    private queryHasToken;
    looksLikeFoodPlusDrinkOrder(text: string): boolean;
    detectPortionHint(text: string): 'medio' | 'cuarto' | 'entero' | null;
    detectServingSizeHint(text: string): 'pequena' | 'grande' | null;
    productIsSmallServing(name: string): boolean;
    detectProductPortionSize(name: string): 'medio' | 'cuarto' | 'entero' | null;
    resolveSizedChickenProduct(text: string, products: WhatsappCatalogProduct[]): WhatsappCatalogProduct | null;
    isEjecutivoLunchOrderPhrase(text: string): boolean;
    resolveEjecutivoOrderProduct(text: string, products: WhatsappCatalogProduct[]): WhatsappCatalogProduct | null;
    resolveSizedSoupProduct(text: string, products: WhatsappCatalogProduct[]): WhatsappCatalogProduct | null;
    isLikelyDrinkProduct(product: WhatsappCatalogProduct): boolean;
    private readonly SIDE_NOTE_TOKENS;
    isLikelySideOnlyProduct(product: WhatsappCatalogProduct): boolean;
    hasAccompanimentModifierWithMain(text: string): boolean;
    looksLikeExplicitAddProductRequest(text: string): boolean;
    extractProductModificationNote(text: string): string | null;
    looksLikeSideModificationNote(text: string): boolean;
    looksLikeSingleProductWithMods(text: string): boolean;
    looksLikeClearlyMultiDishOrder(text: string): boolean;
    looksLikeArrozComboPlusSizedChicken(text: string): boolean;
    stripProductModificationNoise(text: string): string;
    private tokenAppearsOnlyUnderSin;
    findAllProductsEmbeddedInMessage(text: string, products: WhatsappCatalogProduct[]): WhatsappCatalogProduct[];
    private drinkPreferenceRank;
    extractRequestedDrinkVolumeMl(text: string): number | null;
    productDrinkVolumeMl(product: WhatsappCatalogProduct): number | null;
    pickBestDrinkProduct(drinks: WhatsappCatalogProduct[], queryText: string): WhatsappCatalogProduct | null;
    looksLikeMultiItemOrderMessage(text: string): boolean;
    findProductEmbeddedInMessage(text: string, products: WhatsappCatalogProduct[]): WhatsappCatalogProduct | null;
    splitFoodPlusDrinkSegments(text: string): string[];
    private findFoodDrinkCompanionProduct;
    private looksLikeDeliveryTail;
    private isLogisticsOnlySegment;
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
    formatProductPriceReply(product: WhatsappCatalogProduct, opts?: {
        offerAdd?: boolean;
    }): string;
    formatMultiProductPriceReply(products: WhatsappCatalogProduct[]): string;
    resolvePriceInquiryProducts(text: string, products: WhatsappCatalogProduct[]): WhatsappCatalogProduct[];
    private dedupeSoupHitsForInquiry;
    private orderProductsByTextMention;
    private firstMentionIndex;
    formatProductVariantsOverview(product: WhatsappCatalogProduct, mode?: 'info' | 'order', alreadySelected?: {
        attributeName: string;
        attributeValue: string;
    }[]): string;
    optionNumberEmoji(index: number): string;
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
    stripCookingStyleTokens(name: string): string;
    getVariantDisplayLabel(fullName: string, baseKey: string): string;
    findProductVariantFamily(query: string, products: WhatsappCatalogProduct[], hints?: WhatsappCatalogProduct[]): ProductVariantFamily | null;
    pickVariantFromFamilyText(text: string, family: ProductVariantFamily): WhatsappCatalogProduct | null;
    pickFromCandidateList(text: string, candidates: WhatsappCatalogProduct[]): WhatsappCatalogProduct | null;
    formatComboExplanation(family: ProductVariantFamily): string;
    isComboMeaningInquiry(text: string): boolean;
    isMixtoCompositionInquiry(text: string): boolean;
    formatVariantFamilyPrompt(family: ProductVariantFamily): string;
    getRemainingAttributes(product: WhatsappCatalogProduct, alreadySelected?: {
        attributeName: string;
        attributeValue: string;
    }[], opts?: {
        variantIntent?: 'combo' | 'solo';
    }): NonNullable<WhatsappCatalogProduct['attributes']>;
    isAttributeSelectionComplete(product: WhatsappCatalogProduct, alreadySelected?: {
        attributeName: string;
        attributeValue: string;
    }[], opts?: {
        variantIntent?: 'combo' | 'solo';
    }): boolean;
    coerceAttributeStep(product: WhatsappCatalogProduct, step: {
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
    }, opts?: {
        variantIntent?: 'combo' | 'solo';
    }): {
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
    isDeferredDrinkAttribute(attr: {
        attributeName: string;
    }, product?: WhatsappCatalogProduct): boolean;
    isComboOnlyAttribute(attr: {
        attributeName: string;
    }): boolean;
    isModalityAttribute(attr: {
        attributeName: string;
        options: string[];
    }): boolean;
    hasModalityAttribute(attrs: NonNullable<WhatsappCatalogProduct['attributes']>): boolean;
    hasComboPortionSelected(alreadySelected: {
        attributeName: string;
        attributeValue: string;
    }[], product?: WhatsappCatalogProduct): boolean;
    hasSoloPortionSelected(alreadySelected: {
        attributeName: string;
        attributeValue: string;
    }[], product?: WhatsappCatalogProduct): boolean;
    private selectionIsModalityChoice;
    private isComboLikeValue;
    private isSoloLikeValue;
    productImpliesCombo(product: WhatsappCatalogProduct): boolean;
    private shouldShowComboOnlyAttributes;
    formatDescriptionForAttributeStep(description: string | null | undefined, alreadySelected: {
        attributeName: string;
        attributeValue: string;
    }[], nextAttr?: {
        attributeName: string;
    }): string | null;
    isProductDescriptionInquiry(text: string): boolean;
    isAvailabilityInquiry(text: string): boolean;
    isExternalMarketplaceOrderMessage(text: string): boolean;
    isServingSizeChangeIntent(text: string): boolean;
    isLargerPackInquiry(text: string): boolean;
    isVaguePackSizeQuery(text: string): boolean;
    getCoreFoodTokens(name: string): string[];
    productsShareCoreFoodTokens(a: WhatsappCatalogProduct, b: WhatsappCatalogProduct): boolean;
    detectPackMultiplierRank(name: string): number;
    findRelatedLargerPackProducts(focus: WhatsappCatalogProduct, products: WhatsappCatalogProduct[]): WhatsappCatalogProduct[];
    isGenericProductInquiry(text: string): boolean;
    isShortGenericFoodQuery(query: string): boolean;
    extractExplicitAttributeChoice(text: string, product: WhatsappCatalogProduct, opts?: {
        variantIntent?: 'combo' | 'solo';
    }): {
        attributeName: string;
        attributeValue: string;
    }[] | null;
    shouldShowVariantsOverview(text: string, product: WhatsappCatalogProduct): boolean;
    formatPriceInquiryList(products: WhatsappCatalogProduct[]): string;
    splitMultiProductSegments(text: string): string[];
    private expandInlineMultiDishLine;
    private splitSegmentOnArticles;
    private splitSegmentOnQuantityBoundaries;
    resolveMultiProductOrder(text: string, products: WhatsappCatalogProduct[]): MultiProductResolveResult | null;
    formatMoney(amount: number): string;
    formatProductCode(code: number): string;
    formatProductMeta(price: number, code: number): string;
    formatProductSubtitle(description: string, maxLen?: number): string;
    formatProductHeader(name: string, price?: number, code?: number): string;
    formatListChoiceHint(): string;
    formatProductListItem(product: WhatsappCatalogProduct, index?: number): string;
    formatCategoryList(categoryName: string, list: WhatsappCatalogProduct[]): string;
    formatProductOptionsPrompt(product: WhatsappCatalogProduct, alreadySelected?: {
        attributeName: string;
        attributeValue: string;
    }[], opts?: {
        variantIntent?: 'combo' | 'solo';
    }): string;
    resolveAttributesFromMessage(product: WhatsappCatalogProduct, text: string, alreadySelected?: {
        attributeName: string;
        attributeValue: string;
    }[], opts?: {
        variantIntent?: 'combo' | 'solo';
    }): {
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
    }[], opts?: {
        variantIntent?: 'combo' | 'solo';
    }): {
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
