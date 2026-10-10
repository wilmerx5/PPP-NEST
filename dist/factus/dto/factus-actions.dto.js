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
exports.ListAdminInvoiceCustomersQueryDto = exports.SearchInvoiceCustomersQueryDto = exports.LookupInvoiceCustomerQueryDto = exports.CancelElectronicInvoiceDto = exports.ResendElectronicInvoiceEmailDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class ResendElectronicInvoiceEmailDto {
    email;
}
exports.ResendElectronicInvoiceEmailDto = ResendElectronicInvoiceEmailDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'cliente@email.com' }),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], ResendElectronicInvoiceEmailDto.prototype, "email", void 0);
class CancelElectronicInvoiceDto {
    observation;
    correctionConceptCode;
}
exports.CancelElectronicInvoiceDto = CancelElectronicInvoiceDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Motivo / observación de la nota crédito',
        example: 'Anulación solicitada por el cliente',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(250),
    __metadata("design:type", String)
], CancelElectronicInvoiceDto.prototype, "observation", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Código concepto corrección DIAN (2 = anulación factura)',
        example: '2',
        default: '2',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(5),
    __metadata("design:type", String)
], CancelElectronicInvoiceDto.prototype, "correctionConceptCode", void 0);
class LookupInvoiceCustomerQueryDto {
    identificationDocumentCode;
    identification;
}
exports.LookupInvoiceCustomerQueryDto = LookupInvoiceCustomerQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '31' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(5),
    __metadata("design:type", String)
], LookupInvoiceCustomerQueryDto.prototype, "identificationDocumentCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '901234567' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(5),
    (0, class_validator_1.MaxLength)(20),
    __metadata("design:type", String)
], LookupInvoiceCustomerQueryDto.prototype, "identification", void 0);
class SearchInvoiceCustomersQueryDto {
    q;
    limit;
}
exports.SearchInvoiceCustomersQueryDto = SearchInvoiceCustomersQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Juan' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], SearchInvoiceCustomersQueryDto.prototype, "q", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 10, default: 10 }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], SearchInvoiceCustomersQueryDto.prototype, "limit", void 0);
class ListAdminInvoiceCustomersQueryDto {
    page;
    limit;
    search;
}
exports.ListAdminInvoiceCustomersQueryDto = ListAdminInvoiceCustomersQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 1, default: 1 }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], ListAdminInvoiceCustomersQueryDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 50, default: 50 }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], ListAdminInvoiceCustomersQueryDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Juan' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], ListAdminInvoiceCustomersQueryDto.prototype, "search", void 0);
//# sourceMappingURL=factus-actions.dto.js.map