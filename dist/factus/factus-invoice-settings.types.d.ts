export type FactusItemTaxLine = {
    code: string;
    rate: number;
    isExcluded?: boolean;
};
export type ResolvedFactusTaxConfig = {
    taxes: FactusItemTaxLine[];
    pricesIncludeTax: boolean;
    source: 'database' | 'env';
};
export type FactusInvoiceSettingsResponse = {
    itemTaxes: FactusItemTaxLine[];
    pricesIncludeTax: boolean;
    configuredInDatabase: boolean;
    effectiveSource: 'database' | 'env';
    envDefaults: {
        itemTaxes: FactusItemTaxLine[];
        pricesIncludeTax: boolean;
    };
};
