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
exports.WhatsappConversationService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const whatsapp_conversation_entity_1 = require("./entities/whatsapp-conversation.entity");
const whatsapp_message_entity_1 = require("./entities/whatsapp-message.entity");
const whatsapp_session_types_1 = require("./types/whatsapp-session.types");
const user_entity_1 = require("../auth/entities/user.entity");
let WhatsappConversationService = class WhatsappConversationService {
    convRepo;
    msgRepo;
    userRepo;
    constructor(convRepo, msgRepo, userRepo) {
        this.convRepo = convRepo;
        this.msgRepo = msgRepo;
        this.userRepo = userRepo;
    }
    async findOrCreateConversation(waId, phoneE164) {
        let conv = await this.convRepo.findOne({ where: { waId } });
        if (conv)
            return conv;
        const linked = await this.findUserByPhone(phoneE164);
        conv = this.convRepo.create({
            waId,
            phoneE164,
            state: 'building_cart',
            sessionData: {
                ...whatsapp_session_types_1.EMPTY_SESSION,
                linkedUserId: linked?.id ?? null,
                linkedUserName: linked?.fullName ?? null,
            },
            customerName: linked?.fullName ?? null,
        });
        return this.convRepo.save(conv);
    }
    async touchInbound(conv) {
        conv.lastInboundAt = new Date();
        return this.convRepo.save(conv);
    }
    async updateCustomerName(conv, name) {
        conv.customerName = name.trim();
        return this.convRepo.save(conv);
    }
    async findUserByPhone(phoneE164) {
        const digits = phoneE164.replace(/\D/g, '');
        const tail = digits.slice(-10);
        if (tail.length < 10)
            return null;
        return this.userRepo
            .createQueryBuilder('u')
            .where('REPLACE(REPLACE(REPLACE(u.phone, " ", ""), "+", ""), "-", "") LIKE :tail', {
            tail: `%${tail}`,
        })
            .andWhere('u.isActive = 1')
            .getOne();
    }
    getSession(conv) {
        return { ...whatsapp_session_types_1.EMPTY_SESSION, ...(conv.sessionData || {}) };
    }
    async saveSession(conv, patch, state) {
        conv.sessionData = { ...this.getSession(conv), ...patch };
        if (state)
            conv.state = state;
        conv.lastMessageAt = new Date();
        return this.convRepo.save(conv);
    }
    async logMessage(params) {
        const msg = this.msgRepo.create({
            conversationId: params.conversationId,
            direction: params.direction,
            body: params.body,
            waMessageId: params.waMessageId ?? null,
            sentBy: params.sentBy ?? (params.direction === 'in' ? 'bot' : 'bot'),
            rawPayload: params.raw ?? null,
            messageType: 'text',
        });
        return this.msgRepo.save(msg);
    }
    async listConversations(limit = 50) {
        return this.convRepo.find({
            order: { updatedAt: 'DESC' },
            take: limit,
        });
    }
    async getConversation(id) {
        const conv = await this.convRepo.findOne({
            where: { id },
            relations: ['messages'],
            order: { messages: { createdAt: 'ASC' } },
        });
        if (!conv)
            throw new common_1.NotFoundException('Conversación no encontrada');
        conv.messages = (conv.messages || []).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        return conv;
    }
    async setHumanTakeover(id, takeover, agent) {
        const conv = await this.convRepo.findOne({ where: { id } });
        if (!conv)
            throw new common_1.NotFoundException('Conversación no encontrada');
        conv.humanTakeover = takeover;
        conv.humanAgentId = takeover && agent ? agent.id : null;
        conv.humanAgentName = takeover && agent ? agent.fullName : null;
        return this.convRepo.save(conv);
    }
    async getRecentMessageTexts(conversationId, limit = 10) {
        const rows = await this.msgRepo.find({
            where: { conversationId },
            order: { createdAt: 'DESC' },
            take: limit,
        });
        return rows.reverse().map((r) => `${r.direction === 'in' ? 'Cliente' : 'Bot'}: ${r.body || ''}`);
    }
};
exports.WhatsappConversationService = WhatsappConversationService;
exports.WhatsappConversationService = WhatsappConversationService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(whatsapp_conversation_entity_1.WhatsappConversation)),
    __param(1, (0, typeorm_1.InjectRepository)(whatsapp_message_entity_1.WhatsappMessage)),
    __param(2, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], WhatsappConversationService);
//# sourceMappingURL=whatsapp-conversation.service.js.map