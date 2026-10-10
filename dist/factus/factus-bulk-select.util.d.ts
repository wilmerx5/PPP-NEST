export type CatalogProductAttr = {
    attributeName: string;
    attributeValue: string;
};
export type CatalogProductRef = {
    id: number;
    name: string;
    code: number;
    price: number;
    defaultAttributes?: CatalogProductAttr[];
};
export type BulkInvoiceLine = {
    productId: number;
    name: string;
    code: number;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
    attributes?: CatalogProductAttr[];
};
export type BulkInvoicePlan = {
    index: number;
    targetAmount: number;
    lines: BulkInvoiceLine[];
    sum: number;
};
export type BulkCatalogPlanResult = {
    targetTotal: number;
    quantity: number;
    invoices: BulkInvoicePlan[];
    plannedSum: number;
    deviation: number;
    deviationRatio: number;
    withinTolerance: boolean;
    maxDeviationRatio: number;
    message: string;
};
export declare function splitUnevenTargets(total: number, quantity: number): number[];
export declare function fillInvoiceFromCatalog(targetAmount: number, products: CatalogProductRef[]): BulkInvoiceLine[];
export declare function planBulkInvoicesFromCatalog(targetTotal: number, quantity: number, products: CatalogProductRef[], maxDeviationRatio?: number): BulkCatalogPlanResult;
