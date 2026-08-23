import type { WhatsappProductCandidate } from './types/whatsapp-session.types';
export type MenuConceptGroup = {
    id: string;
    label: string;
    triggers: string[];
    productKeywords: string[];
    enabled?: boolean;
};
export declare const DEFAULT_MENU_CONCEPTS: MenuConceptGroup[];
export declare function resolveMenuConceptGroups(stored: unknown): MenuConceptGroup[];
export declare function findByMenuConcept(query: string, products: WhatsappProductCandidate[], groups?: MenuConceptGroup[]): {
    categoryName: string;
    products: WhatsappProductCandidate[];
    conceptId: string;
} | null;
export declare function buildMenuConceptsPromptBlock(groups?: MenuConceptGroup[]): string;
