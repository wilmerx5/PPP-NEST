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
var WhatsappMetaService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsappMetaService = void 0;
const common_1 = require("@nestjs/common");
const whatsapp_settings_service_1 = require("./whatsapp-settings.service");
const GRAPH_VERSION = 'v21.0';
let WhatsappMetaService = WhatsappMetaService_1 = class WhatsappMetaService {
    settingsService;
    logger = new common_1.Logger(WhatsappMetaService_1.name);
    constructor(settingsService) {
        this.settingsService = settingsService;
    }
    parseWebhookPayload(body) {
        const out = [];
        if (body.object !== 'whatsapp_business_account')
            return out;
        const entries = Array.isArray(body.entry) ? body.entry : [];
        for (const entry of entries) {
            const changes = Array.isArray(entry.changes) ? entry.changes : [];
            for (const change of changes) {
                const value = change?.value;
                if (!value?.messages)
                    continue;
                const messages = Array.isArray(value.messages) ? value.messages : [];
                for (const msg of messages) {
                    if (msg.type !== 'text' || !msg.text?.body)
                        continue;
                    const from = String(msg.from || '');
                    out.push({
                        waId: from,
                        phoneE164: this.normalizePhone(from),
                        messageId: String(msg.id || ''),
                        text: String(msg.text.body).trim(),
                        timestamp: Number(msg.timestamp || 0),
                        raw: msg,
                    });
                }
            }
        }
        return out;
    }
    normalizePhone(raw) {
        const digits = raw.replace(/\D/g, '');
        if (digits.startsWith('57') && digits.length >= 12)
            return `+${digits}`;
        if (digits.length === 10)
            return `+57${digits}`;
        return digits ? `+${digits}` : raw;
    }
    async sendText(toWaId, body) {
        const cfg = await this.settingsService.getEffectiveConfig();
        if (!cfg.accessToken || !cfg.phoneNumberId) {
            this.logger.warn('WhatsApp no configurado — no se envía mensaje');
            return;
        }
        const url = `https://graph.facebook.com/${GRAPH_VERSION}/${cfg.phoneNumberId}/messages`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${cfg.accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: toWaId.replace(/\D/g, ''),
                type: 'text',
                text: { preview_url: false, body: body.slice(0, 4096) },
            }),
        });
        if (!res.ok) {
            const errText = await res.text();
            this.logger.error(`Meta send failed (${res.status}): ${errText}`);
            throw new Error(`WhatsApp send failed: ${res.status}`);
        }
    }
};
exports.WhatsappMetaService = WhatsappMetaService;
exports.WhatsappMetaService = WhatsappMetaService = WhatsappMetaService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [whatsapp_settings_service_1.WhatsappSettingsService])
], WhatsappMetaService);
//# sourceMappingURL=whatsapp-meta.service.js.map