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
exports.WhatsappAdminController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const swagger_1 = require("@nestjs/swagger");
const auth_decorator_1 = require("../auth/decorators/auth.decorator");
const valid_roles_interface_1 = require("../auth/interfaces/valid.roles.interface");
const rxjs_1 = require("rxjs");
const whatsapp_dto_1 = require("./dto/whatsapp.dto");
const whatsapp_settings_service_1 = require("./whatsapp-settings.service");
const whatsapp_conversation_service_1 = require("./whatsapp-conversation.service");
const whatsapp_orchestrator_service_1 = require("./whatsapp-orchestrator.service");
const whatsapp_meta_service_1 = require("./whatsapp-meta.service");
const whatsapp_delivery_routing_service_1 = require("./whatsapp-delivery-routing.service");
const whatsapp_admin_alert_service_1 = require("./whatsapp-admin-alert.service");
let WhatsappAdminController = class WhatsappAdminController {
    settingsService;
    conversationService;
    orchestrator;
    metaService;
    deliveryRouting;
    adminAlerts;
    constructor(settingsService, conversationService, orchestrator, metaService, deliveryRouting, adminAlerts) {
        this.settingsService = settingsService;
        this.conversationService = conversationService;
        this.orchestrator = orchestrator;
        this.metaService = metaService;
        this.deliveryRouting = deliveryRouting;
        this.adminAlerts = adminAlerts;
    }
    alertsStream() {
        return this.adminAlerts.asSse();
    }
    async getSettings() {
        const row = await this.settingsService.getSettings();
        return this.settingsService.maskSettings(row);
    }
    async updateSettings(dto) {
        const row = await this.settingsService.updateSettings(dto);
        return this.settingsService.maskSettings(row);
    }
    async testDeliveryQuote(dto) {
        const cfg = await this.settingsService.getEffectiveConfig();
        const address = (dto.address || '').trim();
        const hasCoords = dto.lat != null &&
            dto.lng != null &&
            Number.isFinite(Number(dto.lat)) &&
            Number.isFinite(Number(dto.lng));
        if (!address && !hasCoords) {
            return {
                ok: false,
                error: 'Envía address y/o lat+lng',
                hint: 'Ej: { "address": "Calle 80 #100-20, Bogotá" }',
            };
        }
        const apiKeyConfigured = this.deliveryRouting.hasApiKey();
        const restaurant = {
            lat: Number(cfg.restaurantLat),
            lng: Number(cfg.restaurantLng),
        };
        if (cfg.deliveryFeeMode === 'fixed') {
            return {
                ok: true,
                mode: 'fixed',
                apiKeyConfigured,
                restaurant,
                fee: cfg.defaultDeliveryFee,
                message: `Modo tarifa fija: $${cfg.defaultDeliveryFee.toLocaleString('es-CO')}`,
            };
        }
        const quote = await this.deliveryRouting.quoteDeliveryFee({
            customerAddress: address || `${dto.lat},${dto.lng}`,
            customerCoords: hasCoords
                ? { lat: Number(dto.lat), lng: Number(dto.lng) }
                : null,
            restaurant,
            tiers: cfg.deliveryFeeTiers || [],
            maxKm: Number(cfg.deliveryMaxKm) || 5.5,
            fallbackFee: cfg.defaultDeliveryFee,
            regionBias: 'co',
        });
        return {
            ok: quote.ok,
            mode: cfg.deliveryFeeMode,
            apiKeyConfigured,
            restaurant,
            tiers: cfg.deliveryFeeTiers,
            maxKm: cfg.deliveryMaxKm,
            input: {
                address: address || null,
                lat: hasCoords ? Number(dto.lat) : null,
                lng: hasCoords ? Number(dto.lng) : null,
            },
            quote,
        };
    }
    async listConversations() {
        const rows = await this.conversationService.listConversations(80);
        return rows.map(({ conversation: c, lastMessage, inboxStatus }) => ({
            id: c.id,
            phoneE164: c.phoneE164,
            customerName: c.customerName,
            state: c.state,
            inboxStatus,
            humanTakeover: !!c.humanTakeover,
            humanAgentName: c.humanAgentName,
            lastMessageAt: c.lastMessageAt,
            lastInboundAt: c.lastInboundAt,
            updatedAt: c.updatedAt,
            cartCount: c.sessionData?.cart?.length ?? 0,
            lastMessagePreview: lastMessage?.body?.slice(0, 120) ?? null,
            lastMessageDirection: lastMessage?.direction ?? null,
            lastMessageSentBy: lastMessage?.sentBy ?? null,
        }));
    }
    async getConversation(id) {
        const conv = await this.conversationService.getConversation(id);
        const session = conv.sessionData;
        return {
            id: conv.id,
            waId: conv.waId,
            phoneE164: conv.phoneE164,
            customerName: conv.customerName,
            state: conv.state,
            inboxStatus: this.conversationService.deriveInboxStatus(conv),
            sessionData: conv.sessionData,
            humanTakeover: !!conv.humanTakeover,
            humanAgentName: conv.humanAgentName,
            cartCount: session?.cart?.length ?? 0,
            orderType: session?.orderType ?? null,
            paymentMethod: session?.paymentMethod ?? null,
            address: session?.address ?? null,
            messages: (conv.messages || []).map((m) => ({
                id: m.id,
                direction: m.direction,
                body: m.body,
                sentBy: m.sentBy,
                createdAt: m.createdAt,
                messageType: m.messageType || 'text',
                mediaId: m.mediaId,
                mimeType: m.mimeType,
                hasMedia: !!m.mediaId,
            })),
        };
    }
    async getMessageMedia(id, messageId, res) {
        const msg = await this.conversationService.getMessage(id, messageId);
        if (!msg.mediaId) {
            return res.status(404).json({ message: 'Este mensaje no tiene media' });
        }
        try {
            const { buffer, mimeType } = await this.metaService.downloadMedia(msg.mediaId);
            res.setHeader('Content-Type', msg.mimeType || mimeType);
            res.setHeader('Cache-Control', 'private, max-age=3600');
            return res.send(buffer);
        }
        catch {
            return res.status(404).json({
                message: 'No se pudo cargar el archivo (puede haber expirado en Meta)',
            });
        }
    }
    async takeover(id, body, req) {
        const user = req.user;
        const takeover = body.takeover !== false;
        if (!takeover) {
            await this.orchestrator.releaseToBot(id, { reason: 'manual' });
        }
        else {
            await this.conversationService.setHumanTakeover(id, takeover, {
                id: user.id,
                fullName: user.fullName,
            });
        }
        return { success: true, humanTakeover: takeover };
    }
    async closeConversation(id) {
        await this.conversationService.closeConversation(id);
        return { success: true, state: 'closed' };
    }
    async sendMessage(id, dto, req) {
        const user = req.user;
        await this.orchestrator.sendHumanReply(id, dto.body, {
            id: user.id,
            fullName: user.fullName,
        });
        return { success: true };
    }
    async sendMedia(id, file, caption, req) {
        if (!file?.buffer?.length) {
            throw new common_1.BadRequestException('Adjunta un archivo (campo file)');
        }
        const user = req.user;
        return this.orchestrator.sendHumanMedia(id, {
            buffer: file.buffer,
            mimetype: file.mimetype,
            originalname: file.originalname,
            size: file.size,
        }, { id: user.id, fullName: user.fullName }, caption);
    }
};
exports.WhatsappAdminController = WhatsappAdminController;
__decorate([
    (0, common_1.Sse)('alerts/stream'),
    (0, swagger_1.ApiOperation)({
        summary: 'SSE: aviso inmediato cuando un chat pide ASESOR (pestaña en segundo plano)',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", rxjs_1.Observable)
], WhatsappAdminController.prototype, "alertsStream", null);
__decorate([
    (0, common_1.Get)('settings'),
    (0, swagger_1.ApiOperation)({ summary: 'Configuración del bot WhatsApp' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], WhatsappAdminController.prototype, "getSettings", null);
__decorate([
    (0, common_1.Patch)('settings'),
    (0, swagger_1.ApiOperation)({ summary: 'Actualizar configuración WhatsApp' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [whatsapp_dto_1.UpdateWhatsappSettingsDto]),
    __metadata("design:returntype", Promise)
], WhatsappAdminController.prototype, "updateSettings", null);
__decorate([
    (0, common_1.Post)('delivery/quote-test'),
    (0, swagger_1.ApiOperation)({
        summary: 'Probar cálculo de domicilio por ruta (Geocoding + Directions)',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [whatsapp_dto_1.TestDeliveryQuoteDto]),
    __metadata("design:returntype", Promise)
], WhatsappAdminController.prototype, "testDeliveryQuote", null);
__decorate([
    (0, common_1.Get)('conversations'),
    (0, swagger_1.ApiOperation)({ summary: 'Listar conversaciones recientes' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], WhatsappAdminController.prototype, "listConversations", null);
__decorate([
    (0, common_1.Get)('conversations/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], WhatsappAdminController.prototype, "getConversation", null);
__decorate([
    (0, common_1.Get)('conversations/:id/messages/:messageId/media'),
    (0, swagger_1.ApiOperation)({ summary: 'Proxy de audio/imagen desde Meta' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)('messageId')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String, Object]),
    __metadata("design:returntype", Promise)
], WhatsappAdminController.prototype, "getMessageMedia", null);
__decorate([
    (0, common_1.Post)('conversations/:id/takeover'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, whatsapp_dto_1.TakeoverWhatsappConversationDto, Object]),
    __metadata("design:returntype", Promise)
], WhatsappAdminController.prototype, "takeover", null);
__decorate([
    (0, common_1.Post)('conversations/:id/close'),
    (0, swagger_1.ApiOperation)({ summary: 'Archivar / cerrar conversación en el inbox' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], WhatsappAdminController.prototype, "closeConversation", null);
__decorate([
    (0, common_1.Post)('conversations/:id/messages'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, whatsapp_dto_1.SendWhatsappMessageDto, Object]),
    __metadata("design:returntype", Promise)
], WhatsappAdminController.prototype, "sendMessage", null);
__decorate([
    (0, common_1.Post)('conversations/:id/messages/media'),
    (0, swagger_1.ApiOperation)({ summary: 'Enviar imagen, documento, video o audio' }),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.memoryStorage)(),
        limits: { fileSize: 20 * 1024 * 1024 },
    })),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Body)('caption')),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], WhatsappAdminController.prototype, "sendMedia", null);
exports.WhatsappAdminController = WhatsappAdminController = __decorate([
    (0, swagger_1.ApiTags)('Admin WhatsApp'),
    (0, common_1.Controller)('admin/whatsapp'),
    (0, auth_decorator_1.Auth)(valid_roles_interface_1.ValidRoles.admin),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [whatsapp_settings_service_1.WhatsappSettingsService,
        whatsapp_conversation_service_1.WhatsappConversationService,
        whatsapp_orchestrator_service_1.WhatsappOrchestratorService,
        whatsapp_meta_service_1.WhatsappMetaService,
        whatsapp_delivery_routing_service_1.WhatsappDeliveryRoutingService,
        whatsapp_admin_alert_service_1.WhatsappAdminAlertService])
], WhatsappAdminController);
//# sourceMappingURL=whatsapp-admin.controller.js.map