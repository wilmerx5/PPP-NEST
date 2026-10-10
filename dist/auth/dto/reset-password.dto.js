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
exports.ResetPasswordDTO = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class ResetPasswordDTO {
    email;
    code;
    newPassword;
}
exports.ResetPasswordDTO = ResetPasswordDTO;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Correo electrónico del usuario.',
        example: 'user@example.com',
    }),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], ResetPasswordDTO.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Código de verificación enviado al correo. Debe tener exactamente 6 dígitos.',
        example: '493028',
        minLength: 6,
        maxLength: 6,
    }),
    (0, class_validator_1.Length)(6, 6),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ResetPasswordDTO.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Nueva contraseña del usuario. Mínimo 6 caracteres.',
        example: 'newSecurePassword123',
        minLength: 6,
    }),
    (0, class_validator_1.MinLength)(6),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ResetPasswordDTO.prototype, "newPassword", void 0);
//# sourceMappingURL=reset-password.dto.js.map