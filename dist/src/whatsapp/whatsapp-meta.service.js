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
                    const parsed = this.parseOneMessage(msg);
                    if (parsed)
                        out.push(parsed);
                }
            }
        }
        return out;
    }
    parseOneMessage(msg) {
        const from = String(msg.from || '');
        if (!from)
            return null;
        const base = {
            waId: from,
            phoneE164: this.normalizePhone(from),
            messageId: String(msg.id || ''),
            timestamp: Number(msg.timestamp || 0),
            raw: msg,
        };
        const type = String(msg.type || '');
        if (type === 'text' && msg.text?.body) {
            return {
                ...base,
                messageType: 'text',
                text: String(msg.text.body).trim(),
            };
        }
        if (type === 'audio' && msg.audio?.id) {
            return {
                ...base,
                messageType: 'audio',
                text: msg.audio.voice ? '🎤 Nota de voz' : '🎵 Audio',
                mediaId: String(msg.audio.id),
                mimeType: msg.audio.mime_type ? String(msg.audio.mime_type) : 'audio/ogg',
            };
        }
        if (type === 'image' && msg.image?.id) {
            const caption = msg.image.caption ? String(msg.image.caption).trim() : '';
            return {
                ...base,
                messageType: 'image',
                text: caption || '🖼️ Imagen',
                mediaId: String(msg.image.id),
                mimeType: msg.image.mime_type ? String(msg.image.mime_type) : 'image/jpeg',
            };
        }
        if (type === 'video' && msg.video?.id) {
            const caption = msg.video.caption ? String(msg.video.caption).trim() : '';
            return {
                ...base,
                messageType: 'video',
                text: caption || '🎬 Video',
                mediaId: String(msg.video.id),
                mimeType: msg.video.mime_type ? String(msg.video.mime_type) : 'video/mp4',
            };
        }
        if (type === 'document' && msg.document?.id) {
            const name = msg.document.filename ? String(msg.document.filename) : 'Documento';
            const caption = msg.document.caption ? String(msg.document.caption).trim() : '';
            return {
                ...base,
                messageType: 'document',
                text: caption || `📄 ${name}`,
                mediaId: String(msg.document.id),
                mimeType: msg.document.mime_type ? String(msg.document.mime_type) : 'application/octet-stream',
                filename: name,
            };
        }
        if (type === 'sticker' && msg.sticker?.id) {
            return {
                ...base,
                messageType: 'sticker',
                text: 'Sticker',
                mediaId: String(msg.sticker.id),
                mimeType: msg.sticker.mime_type ? String(msg.sticker.mime_type) : 'image/webp',
            };
        }
        if (type === 'location' && msg.location) {
            const lat = Number(msg.location.latitude);
            const lng = Number(msg.location.longitude);
            const name = msg.location.name ? String(msg.location.name) : '';
            const address = msg.location.address ? String(msg.location.address) : '';
            const label = [name, address].filter(Boolean).join(' — ') || `${lat}, ${lng}`;
            return {
                ...base,
                messageType: 'location',
                text: `📍 ${label}`,
                latitude: Number.isFinite(lat) ? lat : undefined,
                longitude: Number.isFinite(lng) ? lng : undefined,
                locationName: name || undefined,
                locationAddress: address || undefined,
            };
        }
        if (type && type !== 'text') {
            return {
                ...base,
                messageType: 'other',
                text: `Mensaje (${type})`,
            };
        }
        return null;
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
    async uploadMedia(params) {
        const cfg = await this.settingsService.getEffectiveConfig();
        if (!cfg.accessToken || !cfg.phoneNumberId) {
            throw new Error('WhatsApp no configurado');
        }
        const form = new FormData();
        form.append('messaging_product', 'whatsapp');
        form.append('type', params.mimeType);
        const blob = new Blob([new Uint8Array(params.buffer)], { type: params.mimeType });
        form.append('file', blob, params.filename || 'file');
        const url = `https://graph.facebook.com/${GRAPH_VERSION}/${cfg.phoneNumberId}/media`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { Authorization: `Bearer ${cfg.accessToken}` },
            body: form,
        });
        if (!res.ok) {
            const errText = await res.text();
            this.logger.error(`Meta media upload failed (${res.status}): ${errText}`);
            throw new Error(`WhatsApp media upload failed: ${res.status}`);
        }
        const data = (await res.json());
        if (!data.id)
            throw new Error('Meta no devolvió media id');
        return { mediaId: data.id };
    }
    async sendMediaMessage(params) {
        const cfg = await this.settingsService.getEffectiveConfig();
        if (!cfg.accessToken || !cfg.phoneNumberId) {
            this.logger.warn('WhatsApp no configurado — no se envía media');
            return;
        }
        const caption = (params.caption || '').trim().slice(0, 1024) || undefined;
        let payload;
        if (params.kind === 'image') {
            payload = {
                type: 'image',
                image: { id: params.mediaId, ...(caption ? { caption } : {}) },
            };
        }
        else if (params.kind === 'video') {
            payload = {
                type: 'video',
                video: { id: params.mediaId, ...(caption ? { caption } : {}) },
            };
        }
        else if (params.kind === 'audio') {
            payload = {
                type: 'audio',
                audio: { id: params.mediaId },
            };
        }
        else {
            payload = {
                type: 'document',
                document: {
                    id: params.mediaId,
                    ...(caption ? { caption } : {}),
                    ...(params.filename ? { filename: params.filename } : {}),
                },
            };
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
                to: params.toWaId.replace(/\D/g, ''),
                ...payload,
            }),
        });
        if (!res.ok) {
            const errText = await res.text();
            this.logger.error(`Meta send media failed (${res.status}): ${errText}`);
            throw new Error(`WhatsApp send media failed: ${res.status}`);
        }
    }
    async downloadMedia(mediaId) {
        const cfg = await this.settingsService.getEffectiveConfig();
        if (!cfg.accessToken) {
            throw new common_1.NotFoundException('WhatsApp no configurado');
        }
        const metaRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${mediaId}`, {
            headers: { Authorization: `Bearer ${cfg.accessToken}` },
        });
        if (!metaRes.ok) {
            const errText = await metaRes.text();
            this.logger.error(`Meta media meta failed (${metaRes.status}): ${errText}`);
            throw new common_1.NotFoundException('Media no disponible (¿expiró en Meta?)');
        }
        const meta = (await metaRes.json());
        if (!meta.url)
            throw new common_1.NotFoundException('Media sin URL');
        const binRes = await fetch(meta.url, {
            headers: { Authorization: `Bearer ${cfg.accessToken}` },
        });
        if (!binRes.ok) {
            throw new common_1.NotFoundException('No se pudo descargar el media');
        }
        const arr = await binRes.arrayBuffer();
        return {
            buffer: Buffer.from(arr),
            mimeType: meta.mime_type || 'application/octet-stream',
        };
    }
};
exports.WhatsappMetaService = WhatsappMetaService;
exports.WhatsappMetaService = WhatsappMetaService = WhatsappMetaService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [whatsapp_settings_service_1.WhatsappSettingsService])
], WhatsappMetaService);
//# sourceMappingURL=whatsapp-meta.service.js.map