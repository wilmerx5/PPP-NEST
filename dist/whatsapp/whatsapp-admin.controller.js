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
const swagger_1 = require("@nestjs/swagger");
const auth_decorator_1 = require("../auth/decorators/auth.decorator");
const valid_roles_interface_1 = require("../auth/interfaces/valid.roles.interface");
const whatsapp_dto_1 = require("./dto/whatsapp.dto");
const whatsapp_settings_service_1 = require("./whatsapp-settings.service");
const whatsapp_conversation_service_1 = require("./whatsapp-conversation.service");
const whatsapp_orchestrator_service_1 = require("./whatsapp-orchestrator.service");
let WhatsappAdminController = class WhatsappAdminController {
    settingsService;
    conversationService;
    orchestrator;
    constructor(settingsService, conversationService, orchestrator) {
        this.settingsService = settingsService;
        this.conversationService = conversationService;
        this.orchestrator = orchestrator;
    }
    async getSettings() {
        const row = await this.settingsService.getSettings();
        return this.settingsService.maskSettings(row);
    }
    async updateSettings(dto) {
        const row = await this.settingsService.updateSettings(dto);
        return this.settingsService.maskSettings(row);
    }
    async listConversations() {
        const rows = await this.conversationService.listConversations(80);
        return rows.map((c) => ({
            id: c.id,
            phoneE164: c.phoneE164,
            customerName: c.customerName,
            state: c.state,
            humanTakeover: !!c.humanTakeover,
            humanAgentName: c.humanAgentName,
            lastMessageAt: c.lastMessageAt,
            updatedAt: c.updatedAt,
            cartCount: c.sessionData?.cart?.length ?? 0,
        }));
    }
    async getConversation(id) {
        const conv = await this.conversationService.getConversation(id);
        return {
            id: conv.id,
            waId: conv.waId,
            phoneE164: conv.phoneE164,
            customerName: conv.customerName,
            state: conv.state,
            sessionData: conv.sessionData,
            humanTakeover: !!conv.humanTakeover,
            humanAgentName: conv.humanAgentName,
            messages: (conv.messages || []).map((m) => ({
                id: m.id,
                direction: m.direction,
                body: m.body,
                sentBy: m.sentBy,
                createdAt: m.createdAt,
            })),
        };
    }
    async takeover(id, body, req) {
        const user = req.user;
        const takeover = body.takeover !== false;
        await this.conversationService.setHumanTakeover(id, takeover, {
            id: user.id,
            fullName: user.fullName,
        });
        return { success: true, humanTakeover: takeover };
    }
    async sendMessage(id, dto, req) {
        const user = req.user;
        await this.orchestrator.sendHumanReply(id, dto.body, {
            id: user.id,
            fullName: user.fullName,
        });
        return { success: true };
    }
};
exports.WhatsappAdminController = WhatsappAdminController;
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
    (0, common_1.Post)('conversations/:id/takeover'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, whatsapp_dto_1.TakeoverWhatsappConversationDto, Object]),
    __metadata("design:returntype", Promise)
], WhatsappAdminController.prototype, "takeover", null);
__decorate([
    (0, common_1.Post)('conversations/:id/messages'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, whatsapp_dto_1.SendWhatsappMessageDto, Object]),
    __metadata("design:returntype", Promise)
], WhatsappAdminController.prototype, "sendMessage", null);
exports.WhatsappAdminController = WhatsappAdminController = __decorate([
    (0, swagger_1.ApiTags)('Admin WhatsApp'),
    (0, common_1.Controller)('admin/whatsapp'),
    (0, auth_decorator_1.Auth)(valid_roles_interface_1.ValidRoles.admin),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [whatsapp_settings_service_1.WhatsappSettingsService,
        whatsapp_conversation_service_1.WhatsappConversationService,
        whatsapp_orchestrator_service_1.WhatsappOrchestratorService])
], WhatsappAdminController);
//# sourceMappingURL=whatsapp-admin.controller.js.map