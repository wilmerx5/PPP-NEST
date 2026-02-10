import { OrderSource, OrderStatus, OrderType } from "../entities/order.entity";
export declare class CreateOrderItemAttributeDto {
    attributeName: string;
    attributeValue: string;
}
export declare class CreateOrderItemDto {
    productId: number;
    note?: string;
    attributes?: {
        attributeName: string;
        attributeValue: string;
    }[];
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
    extras?: {
        title: string;
        description?: string;
        amount: number;
        quantity?: number;
    }[];
    redemptionCode?: string;
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
}
export declare class UpdateOrderItemsDto {
    items: UpdateOrderItemDto[];
    extrasToAdd?: {
        title: string;
        description?: string;
        amount: number;
        quantity?: number;
    }[];
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
    printed?: boolean;
    deliveryFee?: number;
}
