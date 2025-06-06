export class CreateOrderItemAttributeDto {
    attributeName: string;
    attributeValue: string;
}

export class CreateOrderItemDto {
    productId: number;
    note?: string; // ✅ add this
    attributes?: {
        attributeName: string;
        attributeValue: string;
    }[];
}

export class CreateOrderDto {
    customerName: string;
    phone: string;
    address: string;
    orderType?: 'delivery' | 'pickup' | 'table' | 'counter';
    items: CreateOrderItemDto[];
}


export class UpdateOrderItemAttributeDto {
    attributeName: string;
    attributeValue: string;
}

export class UpdateOrderItemDto {
    id?: number; // Si es un item nuevo, no tendrá ID
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
    orderType?: 'delivery' | 'pickup' | 'table' | 'counter';
    printed?: boolean;

}

