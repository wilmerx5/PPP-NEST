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
exports.BulkElectronicInvoiceIssueDto = exports.BulkInvoicePlanDto = exports.BulkInvoiceLineDto = exports.BulkInvoiceAttrDto = exports.BulkElectronicInvoicePreviewDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class BulkElectronicInvoicePreviewDto {
    targetTotal;
    quantity;
    maxDeviationRatio;
}
exports.BulkElectronicInvoicePreviewDto = BulkElectronicInvoicePreviewDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Total objetivo en COP (suma aproximada de las facturas)',
        example: 1_000_000,
    }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1000),
    (0, class_validator_1.Max)(50_000_000),
    __metadata("design:type", Number)
], BulkElectronicInvoicePreviewDto.prototype, "targetTotal", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Cantidad de facturas a generar',
        example: 4,
    }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(40),
    __metadata("design:type", Number)
], BulkElectronicInvoicePreviewDto.prototype, "quantity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Desviación máxima (fracción, default 0.08)',
        example: 0.08,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0.01),
    (0, class_validator_1.Max)(0.25),
    __metadata("design:type", Number)
], BulkElectronicInvoicePreviewDto.prototype, "maxDeviationRatio", void 0);
class BulkInvoiceAttrDto {
    attributeName;
    attributeValue;
}
exports.BulkInvoiceAttrDto = BulkInvoiceAttrDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], BulkInvoiceAttrDto.prototype, "attributeName", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], BulkInvoiceAttrDto.prototype, "attributeValue", void 0);
class BulkInvoiceLineDto {
    productId;
    name;
    code;
    unitPrice;
    quantity;
    lineTotal;
    attributes;
}
exports.BulkInvoiceLineDto = BulkInvoiceLineDto;
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], BulkInvoiceLineDto.prototype, "productId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], BulkInvoiceLineDto.prototype, "name", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], BulkInvoiceLineDto.prototype, "code", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], BulkInvoiceLineDto.prototype, "unitPrice", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(40),
    __metadata("design:type", Number)
], BulkInvoiceLineDto.prototype, "quantity", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], BulkInvoiceLineDto.prototype, "lineTotal", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => BulkInvoiceAttrDto),
    __metadata("design:type", Array)
], BulkInvoiceLineDto.prototype, "attributes", void 0);
class BulkInvoicePlanDto {
    index;
    targetAmount;
    sum;
    lines;
}
exports.BulkInvoicePlanDto = BulkInvoicePlanDto;
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], BulkInvoicePlanDto.prototype, "index", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], BulkInvoicePlanDto.prototype, "targetAmount", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], BulkInvoicePlanDto.prototype, "sum", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => BulkInvoiceLineDto),
    __metadata("design:type", Array)
], BulkInvoicePlanDto.prototype, "lines", void 0);
class BulkElectronicInvoiceIssueDto {
    invoices;
    targetTotal;
    quantity;
    maxDeviationRatio;
    paymentMethodCode;
    sendEmail;
    observation;
}
exports.BulkElectronicInvoiceIssueDto = BulkElectronicInvoiceIssueDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Plan del preview (recomendado). Si falta, se regenera con targetTotal+quantity.',
        type: [BulkInvoicePlanDto],
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => BulkInvoicePlanDto),
    __metadata("design:type", Array)
], BulkElectronicInvoiceIssueDto.prototype, "invoices", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 1_000_000 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1000),
    (0, class_validator_1.Max)(50_000_000),
    __metadata("design:type", Number)
], BulkElectronicInvoiceIssueDto.prototype, "targetTotal", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 4 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(40),
    __metadata("design:type", Number)
], BulkElectronicInvoiceIssueDto.prototype, "quantity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0.08 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0.01),
    (0, class_validator_1.Max)(0.25),
    __metadata("design:type", Number)
], BulkElectronicInvoiceIssueDto.prototype, "maxDeviationRatio", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '31' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(5),
    __metadata("design:type", String)
], BulkElectronicInvoiceIssueDto.prototype, "paymentMethodCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], BulkElectronicInvoiceIssueDto.prototype, "sendEmail", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(250),
    __metadata("design:type", String)
], BulkElectronicInvoiceIssueDto.prototype, "observation", void 0);
//# sourceMappingURL=bulk-electronic-invoice.dto.js.map