export declare class WhatsappPaymentMethodDto {
    id?: string;
    enabled?: boolean;
    label?: string;
    keywords?: string[];
    optionText?: string;
    confirmReply?: string;
    flow?: 'immediate' | 'mercadopago';
}
export declare class MenuConceptGroupDto {
    id?: string;
    label?: string;
    triggers?: string[];
    productKeywords?: string[];
    enabled?: boolean;
}
export declare class UpdateWhatsappSettingsDto {
    enabled?: boolean;
    displayPhone?: string;
    phoneNumberId?: string;
    wabaId?: string;
    accessToken?: string;
    appSecret?: string;
    verifyToken?: string;
    openaiApiKey?: string;
    openaiModel?: string;
    systemPrompt?: string;
    defaultDeliveryFee?: number;
    allowMercadoPago?: boolean;
    paymentMethods?: WhatsappPaymentMethodDto[];
    menuConceptGroups?: MenuConceptGroupDto[];
    welcomeMessage?: string;
    restaurantName?: string;
    restaurantAddress?: string;
    restaurantCity?: string;
    restaurantNeighborhood?: string;
    mapsUrl?: string;
    publicPhone?: string;
    landmarks?: string;
    pickupNotes?: string;
    deliveryNotes?: string;
    aiExtraContext?: string;
    menuUrl?: string;
    websiteUrl?: string;
    instagramUrl?: string;
    ignoreBusinessHours?: boolean;
    prepTimeNote?: string;
    deliveryTimeNote?: string;
    minOrderAmount?: number;
    maxOrderAmount?: number;
    maxUnitsPerItem?: number;
    maxTotalUnits?: number;
    maxCartLines?: number;
    handoffWhenMaxExceeded?: boolean;
    largeOrderHandoffMessage?: string;
    allergensNote?: string;
    promotionsNote?: string;
    serviceAreaNote?: string;
    cashChangeNote?: string;
    transferInfoNote?: string;
    specialRequestsNote?: string;
    askOrderNotes?: boolean;
    rateLimitPerMinute?: number;
    humanAgentIdleMinutes?: number;
    humanClientIdleMinutes?: number;
    orderDraftIdleMinutes?: number;
    pendingChoiceIdleMinutes?: number;
    mpPaymentIdleMinutes?: number;
    sessionIdleNotify?: boolean;
    paymentInstructions?: string;
    hoursNote?: string;
    cancelPolicyNote?: string;
    humanHandoffMessage?: string;
    closedMessage?: string;
    menuLinkMessage?: string;
    orderSuccessMessage?: string;
    aiTemperature?: number;
}
export declare class SendWhatsappMessageDto {
    body: string;
}
export declare class TakeoverWhatsappConversationDto {
    takeover?: boolean;
}
