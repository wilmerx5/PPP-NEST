"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LinkTablesDto = exports.ChangeTableDto = exports.UpdateOrderGeneralDto = exports.UpdateOrderExtraDto = exports.AddOrderExtraDto = exports.UpdateOrderItemsDto = exports.UpdateOrderItemUnitPriceDto = exports.UpdateOrderItemDto = exports.UpdateOrderItemAttributeDto = exports.CreateOrderDto = exports.CreateOrderItemDto = exports.CreateOrderItemAttributeDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class CreateOrderItemAttributeDto {
    attributeName;
    attributeValue;
}
exports.CreateOrderItemAttributeDto = CreateOrderItemAttributeDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Nombre del atributo seleccionable en el producto.',
        example: 'Salsa',
    }),
    __metadata("design:type", String)
], CreateOrderItemAttributeDto.prototype, "attributeName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Valor seleccionado para el atributo.',
        example: 'BBQ',
    }),
    __metadata("design:type", String)
], CreateOrderItemAttributeDto.prototype, "attributeValue", void 0);
class CreateOrderItemDto {
    productId;
    note;
    attributes;
    alsoDeductVariant;
    unitPrice;
}
exports.CreateOrderItemDto = CreateOrderItemDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID del producto seleccionado.',
        example: 12,
    }),
    __metadata("design:type", Number)
], CreateOrderItemDto.prototype, "productId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Nota opcional para el producto (picado, sin cebolla, etc).',
        example: 'Bien tostado',
        required: false,
    }),
    __metadata("design:type", String)
], CreateOrderItemDto.prototype, "note", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Lista de atributos seleccionados para este producto.',
        required: false,
        type: [CreateOrderItemAttributeDto],
    }),
    __metadata("design:type", Array)
], CreateOrderItemDto.prototype, "attributes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Variante del producto asociado del que descontar (cuando aplica "también descontar de").',
        required: false,
    }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], CreateOrderItemDto.prototype, "alsoDeductVariant", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Precio unitario con descuento (opcional).', required: false, example: 15000 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateOrderItemDto.prototype, "unitPrice", void 0);
class CreateOrderDto {
    customerName;
    phone;
    address;
    customerEmail;
    orderType;
    deliveryFee;
    orderSource;
    items;
    extras;
    redemptionCode;
}
exports.CreateOrderDto = CreateOrderDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Nombre del cliente que realiza la orden.',
        example: 'Carlos Pérez',
    }),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "customerName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Teléfono del cliente.',
        example: '+57 300 456 7890',
    }),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "phone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Dirección del cliente.',
        example: 'Calle 123 #45-67, Bogotá',
    }),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "address", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Email del cliente (solo lo asigna el backend desde el pago).',
        required: false,
    }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "customerEmail", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Tipo de orden.',
        example: 'delivery',
        enum: ['delivery', 'pickup', 'table', 'counter', 'rappi'],
        required: false,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(['delivery', 'pickup', 'table', 'counter', 'rappi']),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "orderType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Costo del servicio de delivery (solo requerido si orderType = delivery).',
        example: 5000,
        required: false,
    }),
    (0, class_validator_1.ValidateIf)((o) => o.orderType === 'delivery'),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateOrderDto.prototype, "deliveryFee", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Origen: online = cliente/ppp-front; internal = panel. No enviar = internal.',
        enum: ['online', 'internal'],
        required: false,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(['online', 'internal']),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "orderSource", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Lista de productos incluidos en la orden.',
        type: [CreateOrderItemDto],
    }),
    __metadata("design:type", Array)
], CreateOrderDto.prototype, "items", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Adicionales o extras (código 90). Título, descripción opcional, monto, cantidad.',
        type: 'array',
        items: {
            type: 'object',
            properties: {
                title: { type: 'string', example: 'Plato extra' },
                description: { type: 'string', example: 'Para llevar', nullable: true },
                amount: { type: 'number', example: 5000 },
                quantity: { type: 'number', example: 1, default: 1 },
            },
            required: ['title', 'amount'],
        },
        required: false,
    }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], CreateOrderDto.prototype, "extras", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Código de premio de redención a aplicar (opcional).',
        example: 'REDEEM9PTSX7',
        required: false,
    }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "redemptionCode", void 0);
class UpdateOrderItemAttributeDto {
    attributeName;
    attributeValue;
}
exports.UpdateOrderItemAttributeDto = UpdateOrderItemAttributeDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Nombre del atributo a modificar.',
        example: 'Bebida',
    }),
    __metadata("design:type", String)
], UpdateOrderItemAttributeDto.prototype, "attributeName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Nuevo valor del atributo.',
        example: 'Gaseosa',
    }),
    __metadata("design:type", String)
], UpdateOrderItemAttributeDto.prototype, "attributeValue", void 0);
class UpdateOrderItemDto {
    id;
    productId;
    attributes;
    note;
    kitchenPrepared;
    alsoDeductVariant;
    unitPrice;
}
exports.UpdateOrderItemDto = UpdateOrderItemDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID del item dentro de la orden (opcional).',
        example: 3,
        required: false,
    }),
    __metadata("design:type", Number)
], UpdateOrderItemDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID del producto.',
        example: 14,
    }),
    __metadata("design:type", Number)
], UpdateOrderItemDto.prototype, "productId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Lista de atributos actualizados.',
        type: [UpdateOrderItemAttributeDto],
        required: false,
    }),
    __metadata("design:type", Array)
], UpdateOrderItemDto.prototype, "attributes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Nota del producto.',
        example: 'Sin picante',
        required: false,
    }),
    __metadata("design:type", String)
], UpdateOrderItemDto.prototype, "note", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], UpdateOrderItemDto.prototype, "kitchenPrepared", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], UpdateOrderItemDto.prototype, "alsoDeductVariant", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, example: 15000 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateOrderItemDto.prototype, "unitPrice", void 0);
class UpdateOrderItemUnitPriceDto {
    productId;
    unitPrice;
}
exports.UpdateOrderItemUnitPriceDto = UpdateOrderItemUnitPriceDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID del producto al que aplicar el precio unitario.' }),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpdateOrderItemUnitPriceDto.prototype, "productId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Precio unitario a aplicar (descuento o precio fijo).' }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], UpdateOrderItemUnitPriceDto.prototype, "unitPrice", void 0);
class UpdateOrderItemsDto {
    items;
    extrasToAdd;
}
exports.UpdateOrderItemsDto = UpdateOrderItemsDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Lista de items de la orden para reemplazar.',
        type: [UpdateOrderItemDto],
    }),
    __metadata("design:type", Array)
], UpdateOrderItemsDto.prototype, "items", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Adicionales a agregar a la orden (código 90).',
        type: 'array',
        items: {
            type: 'object',
            properties: {
                title: { type: 'string' },
                description: { type: 'string', nullable: true },
                amount: { type: 'number' },
                quantity: { type: 'number', default: 1 },
            },
            required: ['title', 'amount'],
        },
        required: false,
    }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], UpdateOrderItemsDto.prototype, "extrasToAdd", void 0);
class AddOrderExtraDto {
    title;
    description;
    amount;
    quantity;
}
exports.AddOrderExtraDto = AddOrderExtraDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Plato extra', description: 'Título del adicional' }),
    __metadata("design:type", String)
], AddOrderExtraDto.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Para llevar', required: false }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], AddOrderExtraDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 5000 }),
    __metadata("design:type", Number)
], AddOrderExtraDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, required: false }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], AddOrderExtraDto.prototype, "quantity", void 0);
class UpdateOrderExtraDto {
    title;
    description;
    amount;
    quantity;
}
exports.UpdateOrderExtraDto = UpdateOrderExtraDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Plato extra', required: false }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateOrderExtraDto.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Para llevar', required: false }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateOrderExtraDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 5000, required: false }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], UpdateOrderExtraDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, required: false }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], UpdateOrderExtraDto.prototype, "quantity", void 0);
class UpdateOrderGeneralDto {
    customerName;
    phone;
    address;
    orderType;
    orderStatus;
    printed;
    deliveryFee;
}
exports.UpdateOrderGeneralDto = UpdateOrderGeneralDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Nuevo nombre del cliente.',
        example: 'Juan López',
        required: false,
    }),
    __metadata("design:type", String)
], UpdateOrderGeneralDto.prototype, "customerName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Nuevo número telefónico.',
        example: '+57 302 555 1234',
        required: false,
    }),
    __metadata("design:type", String)
], UpdateOrderGeneralDto.prototype, "phone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Nueva dirección.',
        example: 'Carrera 15 #100-25, Bogotá',
        required: false,
    }),
    __metadata("design:type", String)
], UpdateOrderGeneralDto.prototype, "address", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Nuevo tipo de la orden.',
        example: "'delivery' | 'pickup' | 'table' | 'counter' | 'rappi'",
        enum: ['delivery', 'pickup', 'table', 'counter', 'rappi'],
        required: false,
    }),
    __metadata("design:type", String)
], UpdateOrderGeneralDto.prototype, "orderType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Estado actual de la orden.',
        example: 'completed',
        required: false,
    }),
    __metadata("design:type", String)
], UpdateOrderGeneralDto.prototype, "orderStatus", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Indica si la orden ya fue impresa.',
        example: true,
        required: false,
    }),
    __metadata("design:type", Boolean)
], UpdateOrderGeneralDto.prototype, "printed", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.orderType === 'delivery'),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateOrderGeneralDto.prototype, "deliveryFee", void 0);
class ChangeTableDto {
    newTable;
}
exports.ChangeTableDto = ChangeTableDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Número o identificador de la mesa destino.',
        example: '7',
    }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ChangeTableDto.prototype, "newTable", void 0);
class LinkTablesDto {
    tableNumbers;
}
exports.LinkTablesDto = LinkTablesDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Números de mesa a vincular con la orden actual (deben tener orden activa hoy).',
        example: ['4', '7'],
        type: [String],
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], LinkTablesDto.prototype, "tableNumbers", void 0);
//# sourceMappingURL=orderDTO.js.map