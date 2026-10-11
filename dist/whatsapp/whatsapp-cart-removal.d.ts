import type { WhatsappCartItem } from './types/whatsapp-session.types';
export declare function isKeepCartRefusal(text: string): boolean;
export declare function parseScopedCartRemoval(text: string): {
    query: string;
    preserve: string[];
    quantity?: number;
} | null;
export declare function preservedRemovalConflict(line: WhatsappCartItem, preserve: string[]): boolean;
