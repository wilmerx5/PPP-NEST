import type { WhatsappCartItem } from './types/whatsapp-session.types';
export declare function parseScopedCartRemoval(text: string): {
    query: string;
    preserve: string[];
} | null;
export declare function preservedRemovalConflict(line: WhatsappCartItem, preserve: string[]): boolean;
