import { OrderStatus, OrderType } from "../entities/order.entity";

export class CreateOrderItemAttributeDto {
    attributeName: string;
    attributeValue: string;
}

export class CreateOrderItemDto {
    productId: number;
    note?: string; 
    attributes?: {
        attributeName: string;
        attributeValue: string;
    }[];
}

export class CreateOrderDto {
    customerName: string;
    phone: string;
    address: string;
    orderType?:OrderType;
    items: CreateOrderItemDto[];
}


export class UpdateOrderItemAttributeDto {
    attributeName: string;
    attributeValue: string;
}

export class UpdateOrderItemDto {
    id?: number; 
    productId: number;
    attributes?: UpdateOrderItemAttributeDto[];
    note?: string;

}

export class UpdateOrderItemsDto {
    items: UpdateOrderItemDto[];
}


export class UpdateOrderGeneralDto {
    customerName?: string;
    phone?: string;
    address?: string;
    orderType?: OrderType;
    orderStatus?:OrderStatus;
    printed?: boolean;

}

