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
exports.IssueElectronicInvoiceDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class IssueElectronicInvoiceDto {
    identificationDocumentCode;
    identification;
    dv;
    legalOrganizationCode;
    names;
    company;
    email;
    phone;
    address;
    municipalityCode;
    paymentMethodCode;
    sendEmail;
    observation;
}
exports.IssueElectronicInvoiceDto = IssueElectronicInvoiceDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Tipo de documento DIAN: 13=cédula, 31=NIT, 22=cédula extranjería, etc.',
        example: '13',
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(['11', '12', '13', '21', '22', '31', '41', '42', '47', '50', '91']),
    __metadata("design:type", String)
], IssueElectronicInvoiceDto.prototype, "identificationDocumentCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Número de identificación sin DV ni guion',
        example: '1234567890',
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(5),
    (0, class_validator_1.MaxLength)(20),
    __metadata("design:type", String)
], IssueElectronicInvoiceDto.prototype, "identification", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'DV del NIT (opcional; Factus lo calcula si falta)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1),
    __metadata("design:type", String)
], IssueElectronicInvoiceDto.prototype, "dv", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '1=persona jurídica, 2=persona natural',
        example: '2',
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(['1', '2']),
    __metadata("design:type", String)
], IssueElectronicInvoiceDto.prototype, "legalOrganizationCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Nombre (obligatorio si persona natural)',
        example: 'Carlos López',
    }),
    (0, class_validator_1.ValidateIf)((o) => o.legalOrganizationCode === '2'),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    (0, class_validator_1.MaxLength)(150),
    __metadata("design:type", String)
], IssueElectronicInvoiceDto.prototype, "names", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Razón social (obligatorio si persona jurídica)',
    }),
    (0, class_validator_1.ValidateIf)((o) => o.legalOrganizationCode === '1'),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    (0, class_validator_1.MaxLength)(150),
    __metadata("design:type", String)
], IssueElectronicInvoiceDto.prototype, "company", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'cliente@email.com' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], IssueElectronicInvoiceDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '3001234567' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(20),
    __metadata("design:type", String)
], IssueElectronicInvoiceDto.prototype, "phone", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Calle 10 # 20-30' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(250),
    __metadata("design:type", String)
], IssueElectronicInvoiceDto.prototype, "address", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Código municipio DIAN (ej. 11001 Bogotá)',
        example: '11001',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(10),
    __metadata("design:type", String)
], IssueElectronicInvoiceDto.prototype, "municipalityCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Código método de pago DIAN: 10 efectivo, 31 transferencia, 47 Nequi/digital, etc.',
        example: '10',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(5),
    __metadata("design:type", String)
], IssueElectronicInvoiceDto.prototype, "paymentMethodCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Si false, Factus no envía correo (default true)',
        default: true,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], IssueElectronicInvoiceDto.prototype, "sendEmail", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(250),
    __metadata("design:type", String)
], IssueElectronicInvoiceDto.prototype, "observation", void 0);
//# sourceMappingURL=issue-electronic-invoice.dto.js.map