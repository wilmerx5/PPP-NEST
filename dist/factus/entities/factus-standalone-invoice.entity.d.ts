export declare class FactusStandaloneInvoice {
    id: number;
    batchId: string;
    batchIndex: number;
    referenceCode: string;
    customerName: string;
    invoiceStatus: string;
    invoiceNumber: string | null;
    invoiceCufe: string | null;
    publicUrl: string | null;
    qrUrl: string | null;
    issuedAt: Date | null;
    invoiceError: string | null;
    plannedSum: number;
    invoiceCustomerDocType: string | null;
    invoiceCustomerDocNumber: string | null;
    createdAt: Date;
}
