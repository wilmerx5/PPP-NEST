export type ScopedCartNote = {
    kind: 'append' | 'remove';
    query: string;
    note: string;
    preserve: string[];
};
export declare function parseScopedCartNote(text: string): ScopedCartNote | null;
export declare function notePartMatches(part: string, query: string): boolean;
export declare function editScopedCartNote(existing: string | undefined, edit: ScopedCartNote): {
    note: string | undefined;
    blocked?: boolean;
};
