type NamedProduct = {
    id: number;
    name: string;
};
export declare function interpretProductNote(source: string, products: NamedProduct[]): {
    productId: number;
    productText: string;
    note: string;
} | null;
export {};
