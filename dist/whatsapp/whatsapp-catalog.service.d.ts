import { ProductsService } from '../products/products.service';
import type { WhatsappProductCandidate } from './types/whatsapp-session.types';
import { type MenuConceptGroup } from './whatsapp-menu-concepts';
export type WhatsappCatalogProduct = WhatsappProductCandidate;
export type MultiProductSegmentMatch = {
    segment: string;
    product: WhatsappCatalogProduct;
    score: number;
    note?: string;
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
    getMenuProducts(forceRefresh?: boolean): Promise<WhatsappCatalogProduct[]>;
    getMenuDetailedText(): Promise<string>;
    groupProductsByCategory(products: WhatsappCatalogProduct[]): Map<string, WhatsappCatalogProduct[]>;
    isCourtesyOnlyMessage(text: string): boolean;
    formatCourtesyReply(brandName?: string): string;
    isOffTopicChitchat(text: string): boolean;
    formatOffTopicRedirect(brandName?: string): string;
    isMenuExploreIntent(text: string, products?: WhatsappCatalogProduct[]): boolean;
    isCategoryBrowseQuestion(text: string): boolean;
    extractCookingStyleBrowseIntent(text: string): string | null;
    findProductsByCookingStyle(style: string, products: WhatsappCatalogProduct[], limit?: number): WhatsappCatalogProduct[];
    private spreadCookingStyleHits;
    private isPrepAttributeName;
    private findPrepOptionMatchingStyle;
    resolveCookingStyleMenuLabel(style: string, hits: WhatsappCatalogProduct[]): string;
    listAvailableCookingStyles(products: WhatsappCatalogProduct[]): string[];
    formatCookingStyleBrowseReply(style: string, hits: WhatsappCatalogProduct[], opts?: {
        menuUrl?: string | null;
        availableStyles?: string[];
    }): string;
    isRestaurantLocationInquiry(text: string): boolean;
    private readonly QTY_WORD_MAP;
    private readonly QTY_SKIP_AFTER_NUM;
    countQuantityMentions(text: string): number;
    extractQuantityNearProduct(fullText: string, productName: string): number | null;
    extractCorrectedQuantityForProduct(text: string, productName: string): number | null;
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
    resolveCategoryBrowsePick(text: string, categories: string[]): string | null;
    getProductById(id: number, products: WhatsappCatalogProduct[]): WhatsappCatalogProduct | null;
    extractCodeFromMessage(text: string): number | null;
    extractListPickNumber(text: string): number | null;
    findByCode(code: number, products: WhatsappCatalogProduct[]): WhatsappCatalogProduct | null;
    extractProductSearchQuery(text: string): string;
    stripProductDescriptionInquiryNoise(text: string): string;
    extractHowItIsQualifier(text: string): string | null;
    variantsMatchingQualifier(focus: WhatsappCatalogProduct, qualifier: string, products: WhatsappCatalogProduct[]): WhatsappCatalogProduct[];
    stripProductSearchNoise(query: string): string;
    cleanOrderSegment(segment: string): string;
    isPolitenessOnlySegment(segment: string): boolean;
    isPendingOrderCorrection(text: string): boolean;
    orderCorrectionClauses(text: string): {
        quantity: number;
        dish: string;
    }[];
    spokenDishOnMenu(segment: string, products: WhatsappCatalogProduct[]): boolean;
    resolveSpokenDish(segment: string, products: WhatsappCatalogProduct[]): WhatsappCatalogProduct | null;
    followUpDishClaim(text: string, unresolved?: string[]): string | null;
    productByDishMention(claim: string, products: WhatsappCatalogProduct[]): WhatsappCatalogProduct | null;
    menuNameMatchesDishQuery(productName: string, dish: string): boolean;
    looksLikePersonNameSegment(segment: string): boolean;
    private readonly WEAK_PRODUCT_TOKENS;
    private isDistinctiveProductToken;
    missingDishQualifiers(query: string, products: WhatsappCatalogProduct[]): string[];
    uncoveredDishWords(query: string, products: WhatsappCatalogProduct[]): string[];
    uncoveredWordsAgainstOffers(query: string, products: WhatsappCatalogProduct[]): string[];
    leftoverFoodWords(query: string, product: WhatsappCatalogProduct): string[];
    private spokenCandidateCoversClause;
    formatWeDontOfferPreface(askedLabel: string, alternativeCount: number): string;
    uncoveredWordsAnchoredByProduct(query: string, product: WhatsappCatalogProduct, products?: WhatsappCatalogProduct[]): string[];
    private stripOrderMetadata;
    orderSegmentForProduct(text: string, product: WhatsappCatalogProduct, products: WhatsappCatalogProduct[], selected?: Array<{
        attributeName: string;
        attributeValue: string;
    }>): string;
    private dishClauses;
    private dishContentTokens;
    productsAnchoringDish(query: string, products: WhatsappCatalogProduct[]): WhatsappCatalogProduct[];
    private bestClauseCoverage;
    private productTextCoversToken;
    private productNameHasPackMultiplier;
    private queryAsksForPackMultiplier;
    private queryHasToken;
    dishTextBeforeSwap(text: string): string;
    productCarriesMention(product: WhatsappCatalogProduct, phrase: string): boolean;
    swapChangeNote(removed: string, added: string): string;
    productsForSwapAddition(added: string, products: WhatsappCatalogProduct[]): WhatsappCatalogProduct[];
    mostSpecificNamedProduct(text: string, products: WhatsappCatalogProduct[]): WhatsappCatalogProduct | null;
    swapRemovesDrink(text: string): boolean;
    looksLikeFoodPlusDrinkOrder(text: string): boolean;
    swapIntent(text: string): {
        removed: string;
        added: string;
    } | null;
    dishSpecificTokens(name: string): string[];
    isLooserSameDish(looser: WhatsappCatalogProduct, host: WhatsappCatalogProduct): boolean;
    askedForOneComboEach(text: string): boolean;
    keepCombosWhenBothRequested<T extends {
        productId: number;
        quantity?: number;
    }>(text: string, products: WhatsappCatalogProduct[], kept: T[]): T[];
    nameMentionedInText(name: string, text: string): boolean;
    productNameFitsUtterance(product: WhatsappCatalogProduct, text: string): boolean;
    similarNamedProducts(text: string, products: WhatsappCatalogProduct[]): WhatsappCatalogProduct[];
    formatSimilarOfferReply(text: string, products: WhatsappCatalogProduct[]): string;
    productIsSwapRemoval(product: WhatsappCatalogProduct, removed: string, added: string): boolean;
    wantsSeparateDrink(text: string): boolean;
    drinkTextMatchesAttribute(product: WhatsappCatalogProduct, drinkText: string): {
        attributeName: string;
        attributeValue: string;
    } | null;
    hostedMenuDrink(text: string, products: WhatsappCatalogProduct[]): {
        product: WhatsappCatalogProduct;
        attributes: {
            attributeName: string;
            attributeValue: string;
        }[];
    } | null;
    cartDrinkClarification(text: string, cart: {
        productId: number;
        name: string;
        attributes?: {
            attributeName: string;
            attributeValue: string;
        }[];
    }[], products: WhatsappCatalogProduct[]): {
        cartIndex: number;
        itemName: string;
        attributeName: string;
        attributeValue: string;
    } | null;
    isDrinkOnlyAccompanimentMessage(text: string): boolean;
    detectPortionHint(text: string): 'medio' | 'cuarto' | 'entero' | null;
    isBareChickenPortionFollowUp(text: string, normalized?: string): boolean;
    detectServingSizeHint(text: string): 'pequena' | 'grande' | null;
    isBareServingSizeReply(text: string): boolean;
    productIsSmallServing(name: string): boolean;
    detectProductPortionSize(name: string): 'medio' | 'cuarto' | 'entero' | null;
    resolveSizedChickenProduct(text: string, products: WhatsappCatalogProduct[], opts?: {
        preferStyleFromName?: string;
    }): WhatsappCatalogProduct | null;
    isEjecutivoLunchOrderPhrase(text: string): boolean;
    resolveNamedMenuDishProduct(text: string, products: WhatsappCatalogProduct[]): WhatsappCatalogProduct | null;
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
    menuDrinkProducts(products: WhatsappCatalogProduct[]): WhatsappCatalogProduct[];
    resolveStandaloneDrinkOrder(text: string, products: WhatsappCatalogProduct[]): {
        product: WhatsappCatalogProduct;
        attributes: {
            attributeName: string;
            attributeValue: string;
        }[];
    } | null;
    shouldOfferMenuDrinks(text: string, products: WhatsappCatalogProduct[]): boolean;
    private foodNameAnchorsTokens;
    missingStyleAlternatives(text: string, products: WhatsappCatalogProduct[]): WhatsappCatalogProduct[] | null;
    formatMissingStyleOffer(text: string, products: WhatsappCatalogProduct[]): string | null;
    formatMenuDrinksOffer(asked: string, products: WhatsappCatalogProduct[]): string;
    looksLikeMultiItemOrderMessage(text: string): boolean;
    findProductEmbeddedInMessage(text: string, products: WhatsappCatalogProduct[]): WhatsappCatalogProduct | null;
    private foodSideHasAnotherDish;
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
    private scoreCategoryNameMatch;
    private refineCategoryListByQuery;
    findCategoryBrowseHit(text: string, products: WhatsappCatalogProduct[], menuConceptGroups?: MenuConceptGroup[]): {
        categoryName: string;
        products: WhatsappCatalogProduct[];
        askedButMissing?: string;
    } | null;
    resolveCatalogQuestion(text: string, products: WhatsappCatalogProduct[]): {
        label: string;
        products: WhatsappCatalogProduct[];
    } | null;
    private productMatchesCatalogKind;
    findAlternativeMenuList(text: string, products: WhatsappCatalogProduct[], menuConceptGroups?: MenuConceptGroup[]): {
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
    stripAvailabilityInquiryNoise(text: string): string;
    availabilitySubject(text: string): string | null;
    private isAvailabilityVerbToken;
    menuMentionsSubject(subject: string, products: WhatsappCatalogProduct[]): boolean;
    unavailableAskReply(text: string, products: WhatsappCatalogProduct[], menuUrl?: string | null): string | null;
    formatNotOnMenuReply(dishLabel: string, menuUrl?: string | null): string;
    extractMentionedPriceCop(text: string): number | null;
    pickProductByMentionedPrice(products: WhatsappCatalogProduct[], priceCop: number, tolerance?: number): WhatsappCatalogProduct | null;
    stripMentionedPriceFromQuery(text: string): string;
    formatProductPriceReply(product: WhatsappCatalogProduct, opts?: {
        offerAdd?: boolean;
        scheduleLead?: string;
    }): string;
    formatProductScheduleNote(product: WhatsappCatalogProduct): string | null;
    isWeekendScheduleQuestion(text: string): boolean;
    formatMultiProductPriceReply(products: WhatsappCatalogProduct[]): string;
    resolvePriceInquiryProducts(text: string, products: WhatsappCatalogProduct[], opts?: {
        preferStyleFromName?: string;
    }): WhatsappCatalogProduct[];
    private listSizedChickenProductsForInquiry;
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
    isDishStyleSubstitutionInquiry(text: string): boolean;
    extractRequestedProteinStyle(text: string): string | null;
    extractBaseDishQueryForStyleSwap(text: string): string;
    resolveCookingStyleAttributeOption(product: WhatsappCatalogProduct, style: string): {
        attributeName: string;
        attributeValue: string;
    } | null;
    applyCookingStyleToAttributes(product: WhatsappCatalogProduct, selected: {
        attributeName: string;
        attributeValue: string;
    }[], style: string): {
        attributes: {
            attributeName: string;
            attributeValue: string;
        }[];
        attributeName: string;
        attributeValue: string;
    } | null;
    formatVariantFamilyPrompt(family: ProductVariantFamily): string;
    getRemainingAttributes(product: WhatsappCatalogProduct, alreadySelected?: {
        attributeName: string;
        attributeValue: string;
    }[], opts?: {
        variantIntent?: 'combo' | 'solo';
        omitSwappedDrink?: boolean;
    }): NonNullable<WhatsappCatalogProduct['attributes']>;
    isAttributeSelectionComplete(product: WhatsappCatalogProduct, alreadySelected?: {
        attributeName: string;
        attributeValue: string;
    }[], opts?: {
        variantIntent?: 'combo' | 'solo';
        omitSwappedDrink?: boolean;
    }): boolean;
    fillDefaultAttributes(product: WhatsappCatalogProduct, alreadySelected?: {
        attributeName: string;
        attributeValue: string;
    }[], opts?: {
        variantIntent?: 'combo' | 'solo';
        omitSwappedDrink?: boolean;
    }): {
        attributeName: string;
        attributeValue: string;
    }[];
    findCookingStyleSibling(product: WhatsappCatalogProduct, products: WhatsappCatalogProduct[], style: string): WhatsappCatalogProduct | null;
    isCookingStyleAttribute(attributeName: string): boolean;
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
    applyDefaultAttributeStep(product: WhatsappCatalogProduct, step: {
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
    isDailyPromoInquiry(text: string): boolean;
    specificNamedDish(text: string, products: WhatsappCatalogProduct[]): WhatsappCatalogProduct | null;
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
    extractExplicitAttributeChoice(text: string, product: WhatsappCatalogProduct, opts?: {
        variantIntent?: 'combo' | 'solo';
    }): {
        attributeName: string;
        attributeValue: string;
    }[] | null;
    formatPriceInquiryList(products: WhatsappCatalogProduct[]): string;
    splitMultiProductSegments(text: string): string[];
    private expandInlineMultiDishLine;
    private splitSegmentOnArticles;
    private splitSegmentOnQuantityBoundaries;
    chickenStyleChoicesForSegment(segment: string, products: WhatsappCatalogProduct[]): WhatsappCatalogProduct[] | null;
    resolveMultiProductOrder(text: string, products: WhatsappCatalogProduct[]): MultiProductResolveResult | null;
    private keepOnlyOpenAttributeChoices;
    formatMoney(amount: number): string;
    formatProductCode(code: number): string;
    formatProductMeta(price: number, code: number): string;
    formatProductSubtitle(description: string, maxLen?: number): string;
    formatProductHeader(name: string, price?: number, code?: number): string;
    formatListChoiceHint(): string;
    formatProductListItem(product: WhatsappCatalogProduct, index?: number): string;
    formatCategoryList(categoryName: string, list: WhatsappCatalogProduct[]): string;
    formatCategoryAlternatives(missingLabel: string, categoryName: string, list: WhatsappCatalogProduct[]): string;
    comesWithOffer(text: string, products: WhatsappCatalogProduct[]): {
        reply: string;
    } | null;
    formatCategoryBrowseReply(hit: {
        categoryName: string;
        products: WhatsappCatalogProduct[];
        askedButMissing?: string;
    }): string;
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
    findCartAttributeOptionChange(text: string, cart: {
        productId: number;
        name: string;
        attributes?: {
            attributeName: string;
            attributeValue: string;
        }[];
    }[], products: WhatsappCatalogProduct[]): {
        cartIndex: number;
        itemName: string;
        attributeName: string;
        attributeValue: string;
    } | null;
    listCartAttributeOptionsNamedInText(text: string, cart: {
        productId: number;
        name: string;
        attributes?: {
            attributeName: string;
            attributeValue: string;
        }[];
    }[], products: WhatsappCatalogProduct[]): {
        cartIndex: number;
        productId: number;
        itemName: string;
        attributeName: string;
        attributeValue: string;
    }[];
    matchAttributeOptionValue(value: string, options: string[]): string | null;
    pickAttributeOptionFromText(text: string, attr: {
        attributeName: string;
        options: string[];
    }, allowPortionChoice?: boolean): string | null;
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
