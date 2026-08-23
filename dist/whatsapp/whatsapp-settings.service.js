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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsappSettingsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const config_1 = require("@nestjs/config");
const whatsapp_settings_entity_1 = require("./entities/whatsapp-settings.entity");
const DEFAULT_SYSTEM_PROMPT = `Eres el asistente de pedidos de Pronto Pollo Portal por WhatsApp.
- Responde en español colombiano, claro y amable.
- Ayuda a armar pedidos usando SOLO productos del menú que recibes en contexto.
- Puedes identificar productos por nombre (aproximado) o por código numérico.
- Si el cliente es ambiguo, pregunta cuál opción quiere; no inventes productos.
- No tenemos perfil guardado del cliente por WhatsApp: pide nombre y dirección de entrega cada pedido.
- Antes de confirmar, resume productos, total estimado, dirección y forma de pago.
- Formas de pago: contra entrega (efectivo) o link Mercado Pago si está habilitado.
- Si piden hablar con una persona, indica que un agente puede tomar el chat.
- Responde SIEMPRE con JSON válido (sin markdown) con esta forma:
{"reply":"texto para el cliente","actions":{...}}
actions opcionales: addItems, removeProductIds, setCustomerName, setAddress, setOrderType, setPaymentMethod, requestConfirm, requestHuman, clearCart.`;
const DEFAULT_WELCOME = '¡Hola! 👋 Soy el asistente de Pronto Pollo Portal. Puedes pedir por nombre o código del producto. ¿Qué te gustaría ordenar hoy?';
let WhatsappSettingsService = class WhatsappSettingsService {
    settingsRepo;
    config;
    constructor(settingsRepo, config) {
        this.settingsRepo = settingsRepo;
        this.config = config;
    }
    async getSettings() {
        let row = await this.settingsRepo.findOne({ where: { id: 1 } });
        if (!row) {
            row = this.settingsRepo.create({ id: 1 });
            row = await this.settingsRepo.save(row);
        }
        return row;
    }
    async getEffectiveConfig() {
        const row = await this.getSettings();
        return {
            ...row,
            enabled: !!row.enabled,
            accessToken: (row.accessToken || '').trim() ||
                (this.config.get('WHATSAPP_ACCESS_TOKEN') || '').trim() ||
                null,
            phoneNumberId: (row.phoneNumberId || '').trim() ||
                (this.config.get('WHATSAPP_PHONE_NUMBER_ID') || '').trim() ||
                null,
            verifyToken: (row.verifyToken || '').trim() ||
                (this.config.get('WHATSAPP_VERIFY_TOKEN') || '').trim() ||
                null,
            openaiApiKey: (row.openaiApiKey || '').trim() ||
                (this.config.get('OPENAI_API_KEY') || '').trim() ||
                null,
            openaiModel: row.openaiModel || 'gpt-4o-mini',
            systemPrompt: row.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT,
            welcomeMessage: row.welcomeMessage?.trim() || DEFAULT_WELCOME,
        };
    }
    async updateSettings(dto) {
        const row = await this.getSettings();
        Object.assign(row, {
            ...(dto.enabled !== undefined && { enabled: dto.enabled }),
            ...(dto.displayPhone !== undefined && { displayPhone: dto.displayPhone || null }),
            ...(dto.phoneNumberId !== undefined && { phoneNumberId: dto.phoneNumberId || null }),
            ...(dto.wabaId !== undefined && { wabaId: dto.wabaId || null }),
            ...(dto.accessToken !== undefined && { accessToken: dto.accessToken || null }),
            ...(dto.verifyToken !== undefined && { verifyToken: dto.verifyToken || null }),
            ...(dto.openaiApiKey !== undefined && { openaiApiKey: dto.openaiApiKey || null }),
            ...(dto.openaiModel !== undefined && { openaiModel: dto.openaiModel || 'gpt-4o-mini' }),
            ...(dto.systemPrompt !== undefined && { systemPrompt: dto.systemPrompt || null }),
            ...(dto.defaultDeliveryFee !== undefined && { defaultDeliveryFee: dto.defaultDeliveryFee }),
            ...(dto.allowMercadoPago !== undefined && { allowMercadoPago: dto.allowMercadoPago }),
            ...(dto.welcomeMessage !== undefined && { welcomeMessage: dto.welcomeMessage || null }),
        });
        return this.settingsRepo.save(row);
    }
    maskSettings(row) {
        const mask = (v) => {
            const s = (v || '').trim();
            if (!s)
                return null;
            if (s.length <= 8)
                return '••••••••';
            return `${s.slice(0, 4)}…${s.slice(-4)}`;
        };
        return {
            id: row.id,
            enabled: !!row.enabled,
            displayPhone: row.displayPhone,
            phoneNumberId: row.phoneNumberId,
            wabaId: row.wabaId,
            accessTokenSet: !!(row.accessToken || '').trim(),
            accessTokenPreview: mask(row.accessToken),
            verifyTokenSet: !!(row.verifyToken || '').trim(),
            verifyTokenPreview: mask(row.verifyToken),
            openaiApiKeySet: !!(row.openaiApiKey || '').trim(),
            openaiApiKeyPreview: mask(row.openaiApiKey),
            openaiModel: row.openaiModel,
            systemPrompt: row.systemPrompt,
            defaultDeliveryFee: row.defaultDeliveryFee,
            allowMercadoPago: !!row.allowMercadoPago,
            welcomeMessage: row.welcomeMessage,
            updatedAt: row.updatedAt,
            webhookUrlHint: '/api/whatsapp/webhook',
        };
    }
};
exports.WhatsappSettingsService = WhatsappSettingsService;
exports.WhatsappSettingsService = WhatsappSettingsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(whatsapp_settings_entity_1.WhatsappSettings)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        config_1.ConfigService])
], WhatsappSettingsService);
//# sourceMappingURL=whatsapp-settings.service.js.map