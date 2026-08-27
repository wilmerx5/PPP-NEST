import { OrderSource, OrderStatus, OrderType } from "../entities/order.entity";
export declare class CreateOrderItemAttributeDto {
    attributeName: string;
    attributeValue: string;
}
export declare class AlsoDeductVariantDto {
    productId: number;
    attributes: CreateOrderItemAttributeDto[];
}
export declare class CreateOrderItemDto {
    productId: number;
    note?: string;
    attributes?: CreateOrderItemAttributeDto[];
    alsoDeductVariant?: AlsoDeductVariantDto;
    unitPrice?: number;
}
export declare class CreateOrderExtraDto {
    title: string;
    description?: string;
    amount: number;
    quantity?: number;
}
export declare class CreateOrderDto {
    customerName: string;
    phone: string;
    address: string;
    customerEmail?: string;
    orderType?: OrderType;
    deliveryFee?: number;
    orderSource?: OrderSource;
    items: CreateOrderItemDto[];
    extras?: CreateOrderExtraDto[];
    redemptionCode?: string;
    clientRequestId?: string;
    deliveryLat?: number;
    deliveryLng?: number;
}
export declare class DeliveryQuoteDto {
    address?: string;
    lat?: number;
    lng?: number;
}
export declare class UpdateOrderItemAttributeDto {
    attributeName: string;
    attributeValue: string;
}
export declare class UpdateOrderItemDto {
    id?: number;
    productId: number;
    attributes?: UpdateOrderItemAttributeDto[];
    note?: string;
    kitchenPrepared?: boolean;
    alsoDeductVariant?: AlsoDeductVariantDto;
    unitPrice?: number;
}
export declare class UpdateOrderItemUnitPriceDto {
    productId: number;
    unitPrice: number;
}
export declare class UpdateOrderItemsDto {
    items: UpdateOrderItemDto[];
    extrasToAdd?: CreateOrderExtraDto[];
    baseItemCount?: number;
}
export declare class AppendOrderItemsDto {
    items: UpdateOrderItemDto[];
    extrasToAdd?: CreateOrderExtraDto[];
}
export declare class RemoveOrderItemsDto {
    productId: number;
    unitIndex?: number;
}
export declare class AddOrderExtraDto {
    title: string;
    description?: string;
    amount: number;
    quantity?: number;
}
export declare class UpdateOrderExtraDto {
    title?: string;
    description?: string;
    amount?: number;
    quantity?: number;
}
export declare class UpdateOrderGeneralDto {
    customerName?: string;
    phone?: string;
    address?: string;
    orderType?: OrderType;
    orderStatus?: OrderStatus;
    forceCancel?: boolean;
    printed?: boolean;
    deliveryFee?: number;
}
export declare class ChangeTableDto {
    newTable: string;
}
export declare class LinkTablesDto {
    tableNumbers: string[];
}
