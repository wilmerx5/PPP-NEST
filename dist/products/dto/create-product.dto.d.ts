import { UpdateProductAttributeDto, UpdateProductScheduleDto, UpdateVariantStockAttributeDto } from './update-product.dto';
export declare class CreateProductDto {
    name: string;
    description?: string;
    price: number;
    code: number;
    imageUrl?: string;
    hasAttributes?: boolean;
    isActive?: boolean;
    trackInventory?: boolean;
    stock?: number;
    attributes?: UpdateProductAttributeDto[];
    categoryIds?: number[];
    variantStocks?: UpdateVariantStockAttributeDto[];
    hasSchedule?: boolean;
    schedules?: UpdateProductScheduleDto[];
}
