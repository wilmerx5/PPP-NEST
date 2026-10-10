import type { WhatsappCartItem } from './types/whatsapp-session.types';
export declare const normalizeCorrection: (text: string) => string;
export declare function parseCartQuantityCorrection(text: string): {
    quantity: number;
    query: string;
} | null;
export declare function correctionMatchesLine(line: WhatsappCartItem, query: string): boolean;
export declare function omitRedundantAttributeNote(note: string | undefined, attributes: WhatsappCartItem['attributes']): string | undefined;
