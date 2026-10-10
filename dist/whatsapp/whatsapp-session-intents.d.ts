export declare function isAddressChangeIntent(text: string): boolean;
export declare function isAddressRejectionIntent(text: string): boolean;
export declare function isAddressClarificationIntent(text: string): boolean;
export declare function isPostOrderFollowUpIntent(text: string): boolean;
export declare function isInterruptedPhoneOrderInquiry(text: string): boolean;
export declare function isReuseLastAddressIntent(text: string): boolean;
export declare function isConfirmCurrentAddressIntent(text: string): boolean;
export declare function isUsableWhatsappCustomerName(name: string): boolean;
export declare function isCourtesyAffirmation(text: string): boolean;
export declare function isDeliveryEtaInquiry(text: string): boolean;
export declare function isSpecificOrderProgressInquiry(text: string): boolean;
export declare function extractDailyOrderNumberHint(text: string): number | null;
export declare function isDeliveryAvailabilityFaq(text: string): boolean;
export declare function isDeliveryRangeQuestion(text: string): boolean;
export declare function isUnansweredHumanComplaint(text: string): boolean;
export declare function isDeliveryCoverageInquiry(text: string): boolean;
export declare function parseCartItemReplacement(text: string): {
    removeQuery: string;
    addQuery: string;
} | null;
export declare function isCartItemReplacementIntent(text: string): boolean;
export declare function parseEachOfQuantity(text: string): number | null;
export declare function parseQtyMenuCodeLines(text: string): {
    qty: number;
    code: number;
}[] | null;
export declare function parseQtyDishCorrection(text: string): {
    qty: number;
    dish: string;
}[] | null;
export declare function isCartChargeQuestion(text: string): boolean;
export declare function looksLikeKitchenSendRequest(text: string): boolean;
export declare function productNamesMentionedInOffer(offerText: string, productNames: string[]): string[];
export declare function isPendingAddOfferDecline(text: string): boolean;
export declare function extractCoverageAddressProbe(text: string): string | null;
export declare function isAbandonPendingSelectionIntent(text: string): boolean;
export declare function pickProductNamedInLastOffer(userText: string, offerText: string, products: Array<{
    id: number;
    name: string;
}>): {
    id: number;
    name: string;
} | null;
export declare function resolvePendingListOrMenuCode(opts: {
    bareNum: number | null;
    candidates: Array<{
        id: number;
        code: number;
    }>;
}): 'list_index' | 'menu_code' | null;
