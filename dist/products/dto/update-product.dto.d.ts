export declare class UpdateProductAttributeDto {
    id?: number;
    attributeName: string;
    options: string[];
}
export declare class UpdateProductDto {
    name?: string;
    description?: string;
    price?: number;
    hasAttributes?: boolean;
    attributes?: UpdateProductAttributeDto[];
    categoryIds?: number[];
}
