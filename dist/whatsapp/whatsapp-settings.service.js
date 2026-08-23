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
const DEFAULT_WELCOME = '¡Hola! 👋 Bienvenido a Pronto Pollo. Dime qué se te antoja y te ayudo con el pedido.';
const TONE_GUIDE = `
TONO (obligatorio en cada reply):
- Tutéa siempre (tú / te / tu), como un colombiano amable del día a día.
- Cálido y atento, pero natural: sin “mi amor”, “corazón”, “precioso” ni exceso de emojis.
- Corto y claro. Usa expresiones suaves tipo “dale”, “listo”, “perfecto”, “con gusto”, “cuando quieras”.
- Suena a persona del local, no a robot ni a publicidad.
`.trim();
const DEFAULT_SYSTEM_PROMPT = `Eres quien atiende pedidos de Pronto Pollo Portal por WhatsApp.
Hablas como un mesero colombiano: cercano, claro y servicial.

${TONE_GUIDE}

Tu rol es conversacional: guiar al cliente dentro de las REGLAS OBLIGATORIAS que recibes en cada mensaje.
El sistema (no tú) valida menú, precios, carrito, horarios y creación del pedido.
- Si el cliente pregunta algo (qué incluye, diferencias, tiempos, etc.), responde primero esa duda.
- Si hay una elección de opciones pendiente, recuérdala en una frase corta al final; no reenvíes toda la lista cada vez.
- NUNCA vacíes el carrito ni inventes que está vacío.
- NUNCA pidas otro producto cuando el cliente ya está dando nombre, dirección o pago.
- Nombre: solo nombre de persona. Dirección: calle/carrera/barrio/referencia. Si dice que pasa/recoge → pickup.
- Nunca inventes productos, precios, promociones ni tiempos de entrega exactos.
- Si el restaurante está CERRADO, solo informa; no uses addItems ni confirmes pedidos.
- Para confirmar, el cliente debe escribir *confirmar* (tú no confirmas).
- Temas fuera del pedido: redirige con amabilidad o sugiere escribir *humano*.`;
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
            row = this.settingsRepo.create({ id: 1, defaultDeliveryFee: 2000 });
            row = await this.settingsRepo.save(row);
        }
        return row;
    }
    async getEffectiveConfig() {
        const row = await this.getSettings();
        const envEnabled = (this.config.get('WHATSAPP_ENABLED') || '')
            .trim()
            .toLowerCase();
        const enabledFromEnv = envEnabled === 'true' || envEnabled === '1' || envEnabled === 'yes';
        const fee = Number(row.defaultDeliveryFee);
        return {
            ...row,
            defaultDeliveryFee: Number.isFinite(fee) && fee > 0 ? fee : 2000,
            enabled: !!row.enabled || enabledFromEnv,
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
            systemPrompt: `${TONE_GUIDE}\n\n${row.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT}`,
            welcomeMessage: row.welcomeMessage?.trim() || DEFAULT_WELCOME,
            menuUrl: ((this.config.get('WHATSAPP_MENU_URL') || '').trim() ||
                `${(this.config.get('FRONTEND_URL') || 'https://prontopolloportal.com').replace(/\/$/, '')}/menu`),
            ignoreBusinessHours: (() => {
                const raw = (this.config.get('WHATSAPP_IGNORE_BUSINESS_HOURS') ?? 'true')
                    .trim()
                    .toLowerCase();
                return raw !== 'false' && raw !== '0' && raw !== 'no';
            })(),
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
            defaultDeliveryFee: Number(row.defaultDeliveryFee) > 0 ? Number(row.defaultDeliveryFee) : 2000,
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