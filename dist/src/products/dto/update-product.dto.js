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
exports.UpdateProductDto = exports.UpdateVariantStockAttributeDto = exports.UpdateProductScheduleDto = exports.UpdateVariantStockItemDto = exports.UpdateProductAttributeDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
function toNullableId(value) {
    if (value === undefined)
        return undefined;
    if (value === null || value === '' || value === 0 || value === '0')
        return null;
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
}
function toNullableNumber(value) {
    if (value === undefined)
        return undefined;
    if (value === null || value === '')
        return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}
function toOptionalBoolean(value) {
    if (value === undefined || value === null || value === '')
        return undefined;
    if (value === true || value === 1 || value === 'true' || value === '1')
        return true;
    if (value === false || value === 0 || value === 'false' || value === '0')
        return false;
    return undefined;
}
class UpdateProductAttributeDto {
    id;
    attributeName;
    options;
}
exports.UpdateProductAttributeDto = UpdateProductAttributeDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID del atributo (opcional, para actualizar existente)', required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpdateProductAttributeDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Nombre del atributo', example: 'Salsa' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpdateProductAttributeDto.prototype, "attributeName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Opciones disponibles (array de strings)', example: ['Dulce', 'Picante', 'BBQ'], type: [String] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], UpdateProductAttributeDto.prototype, "options", void 0);
class UpdateVariantStockItemDto {
    attributeValue;
    stock;
}
exports.UpdateVariantStockItemDto = UpdateVariantStockItemDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Limonada' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateVariantStockItemDto.prototype, "attributeValue", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 10 }),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpdateVariantStockItemDto.prototype, "stock", void 0);
class UpdateProductScheduleDto {
    dayOfWeek;
    startTime;
    endTime;
}
exports.UpdateProductScheduleDto = UpdateProductScheduleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, description: '0=Domingo … 6=Sábado' }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpdateProductScheduleDto.prototype, "dayOfWeek", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, example: '11:00' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null && v !== undefined && v !== ''),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdateProductScheduleDto.prototype, "startTime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, example: '15:00' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null && v !== undefined && v !== ''),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdateProductScheduleDto.prototype, "endTime", void 0);
class UpdateVariantStockAttributeDto {
    attributeName;
    trackStock;
    stocks;
}
exports.UpdateVariantStockAttributeDto = UpdateVariantStockAttributeDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Sabor', description: 'Nombre del atributo (ej. Sabor, Tamaño)' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateVariantStockAttributeDto.prototype, "attributeName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateVariantStockAttributeDto.prototype, "trackStock", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [UpdateVariantStockItemDto], description: 'Stock por cada opción (solo si trackStock !== false)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => UpdateVariantStockItemDto),
    __metadata("design:type", Array)
], UpdateVariantStockAttributeDto.prototype, "stocks", void 0);
class UpdateProductDto {
    name;
    description;
    price;
    hasAttributes;
    attributes;
    categoryIds;
    trackInventory;
    stock;
    variantStocks;
    alsoDeductProductId;
    alsoDeductAttributeName;
    alsoDeductAttributeValue;
    alsoDeductBaseUnits;
    hasSchedule;
    schedules;
}
exports.UpdateProductDto = UpdateProductDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Nombre del producto', example: 'Pollo Asado Familiar', required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateProductDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Descripción del producto', example: 'Pollo asado a la leña acompañado de papas criollas.', required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateProductDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Precio del producto', example: 29900, required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpdateProductDto.prototype, "price", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Indica si el producto tiene atributos configurables', example: true, required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateProductDto.prototype, "hasAttributes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Lista de atributos del producto',
        type: [UpdateProductAttributeDto],
        required: false
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => UpdateProductAttributeDto),
    __metadata("design:type", Array)
], UpdateProductDto.prototype, "attributes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'IDs de las categorías a las que pertenece el producto',
        example: [1, 2, 3],
        type: [Number],
        required: false
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsNumber)({}, { each: true }),
    __metadata("design:type", Array)
], UpdateProductDto.prototype, "categoryIds", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Si se controla inventario para este producto', example: false, required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateProductDto.prototype, "trackInventory", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Unidades en stock (solo si trackInventory = true)', example: 0, required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpdateProductDto.prototype, "stock", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: [UpdateVariantStockAttributeDto],
        required: false,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => UpdateVariantStockAttributeDto),
    __metadata("design:type", Array)
], UpdateProductDto.prototype, "variantStocks", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => toNullableId(value)),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null && v !== undefined),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Object)
], UpdateProductDto.prototype, "alsoDeductProductId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null && v !== undefined),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdateProductDto.prototype, "alsoDeductAttributeName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null && v !== undefined),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdateProductDto.prototype, "alsoDeductAttributeValue", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => toNullableNumber(value)),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null && v !== undefined),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Object)
], UpdateProductDto.prototype, "alsoDeductBaseUnits", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Si true, el producto solo está disponible en los días/horas de schedules.',
        required: false,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => toOptionalBoolean(value)),
    (0, class_validator_1.ValidateIf)((_, v) => v !== undefined),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateProductDto.prototype, "hasSchedule", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Días/horas de disponibilidad (0=Domingo … 6=Sábado). start/end null = todo el día.',
        required: false,
        type: [UpdateProductScheduleDto],
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => UpdateProductScheduleDto),
    __metadata("design:type", Array)
], UpdateProductDto.prototype, "schedules", void 0);
//# sourceMappingURL=update-product.dto.js.map