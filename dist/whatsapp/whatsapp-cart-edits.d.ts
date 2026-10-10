import type { AiOrderAction, WhatsappCartItem } from './types/whatsapp-session.types';
export declare function resolveCartLineIndex(cart: Array<{
    productId: number;
}>, productId: number, index?: unknown): number;
export declare function applyCartLineEdits(cart: WhatsappCartItem[], actions: AiOrderAction): WhatsappCartItem[];
