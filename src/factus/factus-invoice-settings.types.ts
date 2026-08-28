/** Línea de impuesto por ítem (Factus items[].taxes[]). */
export type FactusItemTaxLine = {
  code: string;
  rate: number;
  isExcluded?: boolean;
};

export type ResolvedFactusTaxConfig = {
  taxes: FactusItemTaxLine[];
  pricesIncludeTax: boolean;
  /** database = ppp_restaurant_settings; env = variables FACTUS_* del servidor */
  source: 'database' | 'env';
};

export type FactusInvoiceSettingsResponse = {
  itemTaxes: FactusItemTaxLine[];
  pricesIncludeTax: boolean;
  configuredInDatabase: boolean;
  effectiveSource: 'database' | 'env';
  /** Referencia: qué usaría el sistema si borras la config en BD */
  envDefaults: {
    itemTaxes: FactusItemTaxLine[];
    pricesIncludeTax: boolean;
  };
};
