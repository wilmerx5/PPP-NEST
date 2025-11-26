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
exports.ValidateTokenDTO = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class ValidateTokenDTO {
    idUser;
    otp;
}
exports.ValidateTokenDTO = ValidateTokenDTO;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID del usuario al que pertenece el token. Generalmente un UUID.',
        example: 'f2a1bd87-acc8-45b6-9d13-65e7bd982a2a',
    }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ValidateTokenDTO.prototype, "idUser", void 0);
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
], ValidateTokenDTO.prototype, "otp", void 0);
//# sourceMappingURL=validate-token.dto.js.map