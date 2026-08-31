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
exports.UpdateFactusInvoiceSettingsDto = exports.FactusItemTaxLineDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class FactusItemTaxLineDto {
    code;
    rate;
    isExcluded;
}
exports.FactusItemTaxLineDto = FactusItemTaxLineDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '04', description: '04=INC impoconsumo, 01=IVA' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(5),
    __metadata("design:type", String)
], FactusItemTaxLineDto.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 8, description: 'Tarifa en porcentaje (ej. 8 = 8%)' }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], FactusItemTaxLineDto.prototype, "rate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, default: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], FactusItemTaxLineDto.prototype, "isExcluded", void 0);
class UpdateFactusInvoiceSettingsDto {
    itemTaxes;
    pricesIncludeTax;
}
exports.UpdateFactusInvoiceSettingsDto = UpdateFactusInvoiceSettingsDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        type: [FactusItemTaxLineDto],
        description: 'Impuestos aplicados a cada ítem de la FE (puede ser más de uno)',
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(5),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => FactusItemTaxLineDto),
    __metadata("design:type", Array)
], UpdateFactusInvoiceSettingsDto.prototype, "itemTaxes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: true,
        description: 'true si los precios del menú ya incluyen los impuestos listados',
    }),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateFactusInvoiceSettingsDto.prototype, "pricesIncludeTax", void 0);
//# sourceMappingURL=factus-invoice-settings.dto.js.map