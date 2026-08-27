export type WhatsappMessageIntent = 'order_product' | 'side_note' | 'menu_question' | 'price_question' | 'payment' | 'checkout_data' | 'address' | 'clear_cart' | 'human' | 'chitchat' | 'other';
export declare function looksLikeClearCartMessage(text: string): boolean;
export type WhatsappIntentHints = {
    text: string;
    cartLength: number;
    looksLikeSideModificationNote?: boolean;
    isPriceInquiry?: boolean;
    isMenuExplore?: boolean;
    isCategoryBrowse?: boolean;
    isGenericProductInquiry?: boolean;
    isOffTopicChitchat?: boolean;
    isHumanRequest?: boolean;
    isPaymentMention?: boolean;
    isCheckoutFieldReply?: boolean;
    looksLikeAddressOnly?: boolean;
    compoundAddress?: string | null;
    compoundProductText?: string | null;
};
export declare function looksLikeNonAddressCommand(text: string): boolean;
export type AddressOnlyHints = {
    compoundAddress?: string | null;
    compoundProductText?: string | null;
};
export declare function looksLikeAddressOnlyMessage(text: string, hints?: AddressOnlyHints): boolean;
export declare function classifyWhatsappCustomerIntent(hints: WhatsappIntentHints): WhatsappMessageIntent;
export declare function intentAllowsAddItems(intent: WhatsappMessageIntent): boolean;
export declare function formatIntentHintForAi(intent: WhatsappMessageIntent): string;
