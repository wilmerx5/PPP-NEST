export declare function parseCookingTerm(text: string): {
    note: string;
    productText: string;
} | null;
export declare function supportsCookingTerm(product: {
    name: string;
    categoryName?: string;
}, note?: string): boolean;
