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
exports.CreateHolidayClosureDto = exports.UpdateRestaurantSettingsDto = exports.DayHoursDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
class DayHoursDto {
    dayOfWeek;
    closed;
    openTime;
    closeTime;
}
exports.DayHoursDto = DayHoursDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, description: '0=Domingo … 6=Sábado' }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(6),
    __metadata("design:type", Number)
], DayHoursDto.prototype, "dayOfWeek", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], DayHoursDto.prototype, "closed", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '11:00', required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(HHMM, { message: 'openTime debe ser HH:mm' }),
    __metadata("design:type", String)
], DayHoursDto.prototype, "openTime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '22:00', required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(HHMM, { message: 'closeTime debe ser HH:mm' }),
    __metadata("design:type", String)
], DayHoursDto.prototype, "closeTime", void 0);
class UpdateRestaurantSettingsDto {
    timezone;
    weeklyClosedDays;
    openTime;
    closeTime;
    weeklyHours;
}
exports.UpdateRestaurantSettingsDto = UpdateRestaurantSettingsDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'America/Bogota', required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], UpdateRestaurantSettingsDto.prototype, "timezone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: [0], description: '0=Domingo … 6=Sábado', required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayUnique)(),
    (0, class_validator_1.IsInt)({ each: true }),
    (0, class_validator_1.Min)(0, { each: true }),
    (0, class_validator_1.Max)(6, { each: true }),
    __metadata("design:type", Array)
], UpdateRestaurantSettingsDto.prototype, "weeklyClosedDays", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '11:00', required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(HHMM, { message: 'openTime debe ser HH:mm' }),
    __metadata("design:type", String)
], UpdateRestaurantSettingsDto.prototype, "openTime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '22:00', required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(HHMM, { message: 'closeTime debe ser HH:mm' }),
    __metadata("design:type", String)
], UpdateRestaurantSettingsDto.prototype, "closeTime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [DayHoursDto], required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => DayHoursDto),
    __metadata("design:type", Array)
], UpdateRestaurantSettingsDto.prototype, "weeklyHours", void 0);
class CreateHolidayClosureDto {
    closureDate;
    name;
    allDay;
    startTime;
    endTime;
}
exports.CreateHolidayClosureDto = CreateHolidayClosureDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-12-25' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^\d{4}-\d{2}-\d{2}$/, { message: 'closureDate debe ser YYYY-MM-DD' }),
    __metadata("design:type", String)
], CreateHolidayClosureDto.prototype, "closureDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Navidad' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], CreateHolidayClosureDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, default: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateHolidayClosureDto.prototype, "allDay", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, example: '11:00' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(HHMM, { message: 'startTime debe ser HH:mm' }),
    __metadata("design:type", String)
], CreateHolidayClosureDto.prototype, "startTime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, example: '15:00' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(HHMM, { message: 'endTime debe ser HH:mm' }),
    __metadata("design:type", String)
], CreateHolidayClosureDto.prototype, "endTime", void 0);
//# sourceMappingURL=business.dto.js.map