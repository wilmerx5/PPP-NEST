export declare function isAddressChangeIntent(text: string): boolean;
export declare function isAddressRejectionIntent(text: string): boolean;
export declare function isAddressClarificationIntent(text: string): boolean;
export declare function isPostOrderFollowUpIntent(text: string): boolean;
export declare function isReuseLastAddressIntent(text: string): boolean;
export declare function isConfirmCurrentAddressIntent(text: string): boolean;
export declare function isUsableWhatsappCustomerName(name: string): boolean;
export declare function isDeliveryEtaInquiry(text: string): boolean;
export declare function isDeliveryCoverageInquiry(text: string): boolean;
export declare function extractCoverageAddressProbe(text: string): string | null;
export declare function isAbandonPendingSelectionIntent(text: string): boolean;
export declare function resolvePendingListOrMenuCode(opts: {
    bareNum: number | null;
    candidates: Array<{
        id: number;
        code: number;
    }>;
}): 'list_index' | 'menu_code' | null;
