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
exports.VerificationToken = void 0;
const swagger_1 = require("@nestjs/swagger");
const user_entity_1 = require("./user.entity");
const typeorm_1 = require("typeorm");
let VerificationToken = class VerificationToken {
    id;
    token;
    expiresAt;
    isUsed;
    createdAt;
    user;
};
exports.VerificationToken = VerificationToken;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID autogenerado del token de verificación.',
        example: 145,
    }),
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], VerificationToken.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Código de verificación enviado al usuario. Siempre de 6 dígitos.',
        example: '493028',
        minLength: 6,
        maxLength: 6,
    }),
    (0, typeorm_1.Column)({ length: 6 }),
    __metadata("design:type", String)
], VerificationToken.prototype, "token", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Fecha y hora de expiración del token.',
        example: '2025-11-14T20:45:50.000Z',
    }),
    (0, typeorm_1.Column)(),
    __metadata("design:type", Date)
], VerificationToken.prototype, "expiresAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Indica si el token ya fue utilizado.',
        example: false,
        default: false,
    }),
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], VerificationToken.prototype, "isUsed", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Fecha de creación del token. Se asigna de forma automática.',
        example: '2025-11-14T20:25:50.000Z',
    }),
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], VerificationToken.prototype, "createdAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Usuario al que pertenece este token.',
        type: () => user_entity_1.User,
    }),
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, (user) => user.verificationTokens, {
        onDelete: 'CASCADE',
    }),
    __metadata("design:type", user_entity_1.User)
], VerificationToken.prototype, "user", void 0);
exports.VerificationToken = VerificationToken = __decorate([
    (0, typeorm_1.Entity)('ppp_verification_token')
], VerificationToken);
//# sourceMappingURL=verification-token.entity.js.map