import { OrderStatus, OrderType } from "../entities/order.entity";
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
    orderType?: OrderType;
    deliveryFee?: number;
    items: CreateOrderItemDto[];
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
}
export declare class UpdateOrderItemsDto {
    items: UpdateOrderItemDto[];
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
