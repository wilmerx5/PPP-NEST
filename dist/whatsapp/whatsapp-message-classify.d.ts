export type WhatsappClassifyIntent = 'delivery_setup' | 'address' | 'order' | 'question' | 'chitchat' | 'other';
export type WhatsappClassifyResult = {
    intent: WhatsappClassifyIntent;
    normalizedText: string;
    address: string | null;
    hasFoodItems: boolean;
    confidence: number;
};
export declare function needsAiMessageClassify(text: string): boolean;
export declare function hasFuzzyDomicilioCandidate(text: string): boolean;
export declare function parseClassifyResult(raw: unknown, fallbackText: string): WhatsappClassifyResult | null;
export declare function fixFuzzyDomicilioTypos(text: string): string;
