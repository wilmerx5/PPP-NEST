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
    paymentMethod?: 'cash' | 'mercadopago';
    cashChangeFor?: string;
    customerNotes?: string;
    notesCollected?: boolean;
    mpPreferenceId?: string;
    ignorePriorOrderHistory?: boolean;
    pendingMatch?: {
        query: string;
        candidates: WhatsappProductCandidate[];
    };
    pendingCategoryBrowse?: {
        categories: string[];
    };
    pendingAttribute?: WhatsappPendingAttribute;
    awaitingField?: 'name' | 'address' | 'payment' | 'notes' | 'confirm';
    linkedUserId?: string | null;
    linkedUserName?: string | null;
};
export type WhatsappConversationState = 'building_cart' | 'awaiting_attribute' | 'awaiting_name' | 'awaiting_address' | 'awaiting_payment' | 'awaiting_notes' | 'awaiting_final_confirm' | 'confirming' | 'awaiting_mp_payment' | 'completed' | 'closed';
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
    setPaymentMethod?: 'cash' | 'mercadopago';
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
