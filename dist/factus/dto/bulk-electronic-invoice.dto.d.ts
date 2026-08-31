export declare class BulkElectronicInvoicePreviewDto {
    targetTotal: number;
    quantity: number;
    maxDeviationRatio?: number;
}
export declare class BulkInvoiceAttrDto {
    attributeName: string;
    attributeValue: string;
}
export declare class BulkInvoiceLineDto {
    productId: number;
    name: string;
    code: number;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
    attributes?: BulkInvoiceAttrDto[];
}
export declare class BulkInvoicePlanDto {
    index: number;
    targetAmount: number;
    sum: number;
    lines: BulkInvoiceLineDto[];
}
export declare class BulkElectronicInvoiceIssueDto {
    invoices?: BulkInvoicePlanDto[];
    targetTotal?: number;
    quantity?: number;
    maxDeviationRatio?: number;
    paymentMethodCode?: string;
    sendEmail?: boolean;
    observation?: string;
}
