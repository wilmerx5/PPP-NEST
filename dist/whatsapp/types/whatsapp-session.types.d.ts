export type WhatsappCartItem = {
    productId: number;
    name: string;
    code: number;
    quantity: number;
    unitPrice: number;
    note?: string;
    attributes?: {
        attributeName: string;
        attributeValue: string;
    }[];
};
export type WhatsappProductAttribute = {
    attributeName: string;
    options: string[];
};
export type WhatsappProductCandidate = {
    id: number;
    name: string;
    code: number;
    price: number;
    description?: string | null;
    categoryName?: string;
    hasAttributes?: boolean;
    attributes?: WhatsappProductAttribute[];
    availableNow?: boolean;
};
export type WhatsappPendingAttribute = {
    productId: number;
    name: string;
    code: number;
    price: number;
    attributes: WhatsappProductAttribute[];
    selected: {
        attributeName: string;
        attributeValue: string;
    }[];
};
export type WhatsappSessionData = {
    cart: WhatsappCartItem[];
    orderType: 'delivery' | 'pickup';
    address?: string;
    paymentMethod?: string;
    cashChangeFor?: string;
    customerNotes?: string;
    notesCollected?: boolean;
    mpPreferenceId?: string;
    ignorePriorOrderHistory?: boolean;
    pendingMatch?: {
        query: string;
        candidates: WhatsappProductCandidate[];
    };
    pendingMultiOrder?: {
        confident: Array<{
            segment: string;
            productId: number;
            name: string;
            code: number;
            price: number;
        }>;
        ambiguous: Array<{
            segment: string;
            candidates: WhatsappProductCandidate[];
        }>;
        needsAttributes: Array<{
            segment: string;
            productId: number;
            name: string;
            code: number;
            price: number;
        }>;
        unresolved: string[];
    };
    pendingCategoryBrowse?: {
        categories: string[];
    };
    pendingAttribute?: WhatsappPendingAttribute;
    productFocus?: {
        productId: number;
        name: string;
        variantBaseKey?: string;
    };
    pendingCartRemoval?: {
        options: Array<{
            cartIndex: number;
            label: string;
        }>;
    };
    fulfillmentChosen?: boolean;
    addressConfirmed?: boolean;
    phoneConfirmed?: boolean;
    contactPhone?: string | null;
    awaitingField?: 'name' | 'address' | 'payment' | 'notes' | 'confirm' | 'phone' | 'fulfillment';
    linkedUserId?: string | null;
    linkedUserName?: string | null;
    pendingRedemptionCode?: string | null;
    pendingRedemptionExpiresAt?: string | null;
};
export type WhatsappConversationState = 'building_cart' | 'awaiting_attribute' | 'awaiting_name' | 'awaiting_fulfillment' | 'awaiting_address' | 'awaiting_phone' | 'awaiting_payment' | 'awaiting_notes' | 'awaiting_final_confirm' | 'confirming' | 'awaiting_mp_payment' | 'completed' | 'closed';
export declare const EMPTY_SESSION: WhatsappSessionData;
export type AiOrderAction = {
    addItems?: Array<{
        productId: number;
        quantity?: number;
        note?: string;
        attributes?: {
            attributeName: string;
            attributeValue: string;
        }[];
    }>;
    removeProductIds?: number[];
    setCustomerName?: string;
    setAddress?: string;
    setOrderType?: 'delivery' | 'pickup';
    setPaymentMethod?: string;
    setCashChangeFor?: string;
    setCustomerNotes?: string;
    requestConfirm?: boolean;
    requestHuman?: boolean;
    clearCart?: boolean;
};
export type AiTurnResult = {
    reply: string;
    actions?: AiOrderAction;
};
