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
exports.WhatsappSettings = void 0;
const typeorm_1 = require("typeorm");
let WhatsappSettings = class WhatsappSettings {
    id;
    enabled;
    displayPhone;
    phoneNumberId;
    wabaId;
    accessToken;
    verifyToken;
    openaiApiKey;
    openaiModel;
    systemPrompt;
    defaultDeliveryFee;
    allowMercadoPago;
    welcomeMessage;
    updatedAt;
};
exports.WhatsappSettings = WhatsappSettings;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'int' }),
    __metadata("design:type", Number)
], WhatsappSettings.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], WhatsappSettings.prototype, "enabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'display_phone', type: 'varchar', length: 32, nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "displayPhone", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'phone_number_id', type: 'varchar', length: 64, nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "phoneNumberId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'waba_id', type: 'varchar', length: 64, nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "wabaId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'access_token', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "accessToken", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'verify_token', type: 'varchar', length: 128, nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "verifyToken", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'openai_api_key', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "openaiApiKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'openai_model', type: 'varchar', length: 64, default: 'gpt-4o-mini' }),
    __metadata("design:type", String)
], WhatsappSettings.prototype, "openaiModel", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'system_prompt', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "systemPrompt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'default_delivery_fee', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], WhatsappSettings.prototype, "defaultDeliveryFee", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'allow_mercado_pago', type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], WhatsappSettings.prototype, "allowMercadoPago", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'welcome_message', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "welcomeMessage", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamp' }),
    __metadata("design:type", Date)
], WhatsappSettings.prototype, "updatedAt", void 0);
exports.WhatsappSettings = WhatsappSettings = __decorate([
    (0, typeorm_1.Entity)('ppp_whatsapp_settings')
], WhatsappSettings);
//# sourceMappingURL=whatsapp-settings.entity.js.map