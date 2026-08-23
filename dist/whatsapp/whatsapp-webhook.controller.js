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
exports.WhatsappWebhookController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const whatsapp_settings_service_1 = require("./whatsapp-settings.service");
const whatsapp_meta_service_1 = require("./whatsapp-meta.service");
const whatsapp_orchestrator_service_1 = require("./whatsapp-orchestrator.service");
let WhatsappWebhookController = class WhatsappWebhookController {
    settingsService;
    metaService;
    orchestrator;
    constructor(settingsService, metaService, orchestrator) {
        this.settingsService = settingsService;
        this.metaService = metaService;
        this.orchestrator = orchestrator;
    }
    async verify(mode, token, challenge, res) {
        const cfg = await this.settingsService.getEffectiveConfig();
        if (mode === 'subscribe' && token && token === cfg.verifyToken) {
            return res.status(200).send(challenge);
        }
        return res.status(403).send('Forbidden');
    }
    async receive(req) {
        const body = (req.body || {});
        const messages = this.metaService.parseWebhookPayload(body);
        for (const msg of messages) {
            try {
                await this.orchestrator.handleIncoming(msg);
            }
            catch (err) {
                console.error('[WhatsApp webhook]', err);
            }
        }
        return { ok: true };
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
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WhatsappWebhookController.prototype, "receive", null);
exports.WhatsappWebhookController = WhatsappWebhookController = __decorate([
    (0, swagger_1.ApiExcludeController)(),
    (0, common_1.Controller)('whatsapp'),
    __metadata("design:paramtypes", [whatsapp_settings_service_1.WhatsappSettingsService,
        whatsapp_meta_service_1.WhatsappMetaService,
        whatsapp_orchestrator_service_1.WhatsappOrchestratorService])
], WhatsappWebhookController);
//# sourceMappingURL=whatsapp-webhook.controller.js.map