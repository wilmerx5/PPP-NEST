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
var WhatsappWebhookController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsappWebhookController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const whatsapp_settings_service_1 = require("./whatsapp-settings.service");
const whatsapp_meta_service_1 = require("./whatsapp-meta.service");
const whatsapp_orchestrator_service_1 = require("./whatsapp-orchestrator.service");
const whatsapp_rate_limit_service_1 = require("./whatsapp-rate-limit.service");
const whatsapp_conversation_service_1 = require("./whatsapp-conversation.service");
const whatsapp_meta_signature_1 = require("./whatsapp-meta-signature");
let WhatsappWebhookController = WhatsappWebhookController_1 = class WhatsappWebhookController {
    settingsService;
    metaService;
    orchestrator;
    rateLimit;
    conversationService;
    logger = new common_1.Logger(WhatsappWebhookController_1.name);
    constructor(settingsService, metaService, orchestrator, rateLimit, conversationService) {
        this.settingsService = settingsService;
        this.metaService = metaService;
        this.orchestrator = orchestrator;
        this.rateLimit = rateLimit;
        this.conversationService = conversationService;
    }
    async verify(mode, token, challenge, res) {
        const cfg = await this.settingsService.getEffectiveConfig();
        const expected = (cfg.verifyToken || '').trim();
        const received = (token || '').trim();
        if (mode === 'subscribe' && received && expected && received === expected) {
            this.logger.log('Webhook Meta verificado correctamente');
            return res.status(200).type('text/plain').send(challenge);
        }
        if (!expected) {
            this.logger.warn('Webhook verify falló: no hay verify token en servidor. Guárdalo en Admin → WhatsApp IA o env WHATSAPP_VERIFY_TOKEN.');
        }
        else {
            this.logger.warn('Webhook verify falló: token recibido no coincide con el configurado en PPP.');
        }
        return res.status(403).type('text/plain').send('Forbidden');
    }
    async receive(req, signature, res) {
        const cfg = await this.settingsService.getEffectiveConfig();
        const appSecret = (cfg.appSecret || '').trim();
        if (appSecret) {
            const raw = req.rawBody;
            if (!raw || !Buffer.isBuffer(raw)) {
                this.logger.warn('Webhook rechazado: falta rawBody para verificar firma Meta');
                return res.status(401).json({ ok: false, error: 'raw_body_missing' });
            }
            if (!(0, whatsapp_meta_signature_1.verifyWhatsappMetaSignature)(raw, signature, appSecret)) {
                this.logger.warn('Webhook rechazado: firma X-Hub-Signature-256 inválida');
                return res.status(401).json({ ok: false, error: 'invalid_signature' });
            }
        }
        else {
            this.logger.warn('WhatsApp App Secret no configurado — webhook sin verificación de firma. Configúralo en Admin.');
        }
        const body = (req.body || {});
        const messages = this.metaService.parseWebhookPayload(body);
        const limit = Math.max(1, Number(cfg.rateLimitPerMinute) || 25);
        for (const msg of messages) {
            try {
                if (msg.messageId) {
                    const dup = await this.conversationService.findByWaMessageId(msg.messageId);
                    if (dup) {
                        this.logger.debug(`Skip duplicate waMessageId=${msg.messageId}`);
                        continue;
                    }
                }
                if (!this.rateLimit.allow(msg.waId || msg.phoneE164, limit)) {
                    try {
                        await this.metaService.sendText(msg.waId, 'Estás enviando muchos mensajes seguidos 🙏 Espera un momento e intenta de nuevo.');
                    }
                    catch {
                    }
                    continue;
                }
                await this.orchestrator.handleIncoming(msg);
            }
            catch (err) {
                this.logger.error('[WhatsApp webhook] message error', err);
            }
        }
        return res.status(200).json({ ok: true });
    }
};
exports.WhatsappWebhookController = WhatsappWebhookController;
__decorate([
    (0, common_1.Get)('webhook'),
    __param(0, (0, common_1.Query)('hub.mode')),
    __param(1, (0, common_1.Query)('hub.verify_token')),
    __param(2, (0, common_1.Query)('hub.challenge')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", Promise)
], WhatsappWebhookController.prototype, "verify", null);
__decorate([
    (0, common_1.Post)('webhook'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Headers)('x-hub-signature-256')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], WhatsappWebhookController.prototype, "receive", null);
exports.WhatsappWebhookController = WhatsappWebhookController = WhatsappWebhookController_1 = __decorate([
    (0, swagger_1.ApiExcludeController)(),
    (0, common_1.Controller)('whatsapp'),
    __metadata("design:paramtypes", [whatsapp_settings_service_1.WhatsappSettingsService,
        whatsapp_meta_service_1.WhatsappMetaService,
        whatsapp_orchestrator_service_1.WhatsappOrchestratorService,
        whatsapp_rate_limit_service_1.WhatsappRateLimitService,
        whatsapp_conversation_service_1.WhatsappConversationService])
], WhatsappWebhookController);
//# sourceMappingURL=whatsapp-webhook.controller.js.map