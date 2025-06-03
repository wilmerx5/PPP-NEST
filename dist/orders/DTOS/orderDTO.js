"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateOrderGeneralDto = exports.UpdateOrderItemsDto = exports.UpdateOrderItemDto = exports.UpdateOrderItemAttributeDto = exports.CreateOrderDto = exports.CreateOrderItemDto = exports.CreateOrderItemAttributeDto = void 0;
class CreateOrderItemAttributeDto {
    attributeName;
    attributeValue;
}
exports.CreateOrderItemAttributeDto = CreateOrderItemAttributeDto;
class CreateOrderItemDto {
    productId;
    note;
    attributes;
}
exports.CreateOrderItemDto = CreateOrderItemDto;
class CreateOrderDto {
    customerName;
    phone;
    address;
    orderType;
    items;
}
exports.CreateOrderDto = CreateOrderDto;
class UpdateOrderItemAttributeDto {
    attributeName;
    attributeValue;
}
exports.UpdateOrderItemAttributeDto = UpdateOrderItemAttributeDto;
class UpdateOrderItemDto {
    id;
    productId;
    attributes;
    note;
}
exports.UpdateOrderItemDto = UpdateOrderItemDto;
class UpdateOrderItemsDto {
    items;
}
exports.UpdateOrderItemsDto = UpdateOrderItemsDto;
class UpdateOrderGeneralDto {
    customerName;
    phone;
    address;
    orderType;
}
exports.UpdateOrderGeneralDto = UpdateOrderGeneralDto;
//# sourceMappingURL=orderDTO.js.map