export declare class ResendElectronicInvoiceEmailDto {
    email: string;
}
export declare class CancelElectronicInvoiceDto {
    observation?: string;
    correctionConceptCode?: string;
}
export declare class LookupInvoiceCustomerQueryDto {
    identificationDocumentCode: string;
    identification: string;
}
export declare class SearchInvoiceCustomersQueryDto {
    q: string;
    limit?: number;
}
export declare class ListAdminInvoiceCustomersQueryDto {
    page?: number;
    limit?: number;
    search?: string;
}
