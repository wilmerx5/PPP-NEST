export declare class FactusItemTaxLineDto {
    code: string;
    rate: number;
    isExcluded?: boolean;
}
export declare class UpdateFactusInvoiceSettingsDto {
    itemTaxes: FactusItemTaxLineDto[];
    pricesIncludeTax: boolean;
}
