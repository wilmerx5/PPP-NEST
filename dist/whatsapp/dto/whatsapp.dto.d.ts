export declare class UpdateWhatsappSettingsDto {
    enabled?: boolean;
    displayPhone?: string;
    phoneNumberId?: string;
    wabaId?: string;
    accessToken?: string;
    verifyToken?: string;
    openaiApiKey?: string;
    openaiModel?: string;
    systemPrompt?: string;
    defaultDeliveryFee?: number;
    allowMercadoPago?: boolean;
    welcomeMessage?: string;
}
export declare class SendWhatsappMessageDto {
    body: string;
}
export declare class TakeoverWhatsappConversationDto {
    takeover?: boolean;
}
