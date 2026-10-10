export declare function isNewOpenAiTokenModel(model: string): boolean;
export declare function openAiRejectsCustomTemperature(model: string): boolean;
export declare function applyOpenAiChatCompat(body: Record<string, unknown>, opts: {
    model: string;
    maxOutputTokens?: number;
    temperature?: number;
}): Record<string, unknown>;
