export declare class UpdateProductAttributeDto {
    id?: number;
    attributeName: string;
    options: string[];
}
export declare class UpdateVariantStockItemDto {
    attributeValue: string;
    stock: number;
}
export declare class UpdateVariantStockAttributeDto {
    attributeName: string;
    trackStock?: boolean;
    stocks?: UpdateVariantStockItemDto[];
}
export declare class UpdateProductDto {
    name?: string;
    description?: string;
    price?: number;
    hasAttributes?: boolean;
    attributes?: UpdateProductAttributeDto[];
    categoryIds?: number[];
    trackInventory?: boolean;
    stock?: number;
    variantStocks?: UpdateVariantStockAttributeDto[];
    alsoDeductProductId?: number | null;
    alsoDeductAttributeName?: string | null;
    alsoDeductAttributeValue?: string | null;
    alsoDeductBaseUnits?: number | null;
}
