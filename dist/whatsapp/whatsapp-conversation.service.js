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
        conv.lastMessageAt = new Date();
        return this.convRepo.save(conv);
    }
    async touchOutbound(conv, kind = 'bot') {
        const now = new Date();
        conv.lastMessageAt = now;
        if (kind === 'human') {
            conv.lastHumanOutboundAt = now;
        }
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
        const raw = (conv.sessionData || {});
        return {
            ...whatsapp_session_types_1.EMPTY_SESSION,
            ...raw,
            cart: Array.isArray(raw.cart) ? raw.cart : [],
        };
    }
    async saveSession(conv, patch, state) {
        const current = this.getSession(conv);
        const next = {
            ...current,
            ...patch,
            cart: patch.cart !== undefined ? patch.cart : current.cart,
        };
        conv.sessionData = JSON.parse(JSON.stringify(next));
        if (state)
            conv.state = state;
        conv.lastMessageAt = new Date();
        const saved = await this.convRepo.save(conv);
        const fresh = await this.convRepo.findOne({ where: { id: saved.id } });
        if (fresh) {
            conv.sessionData = fresh.sessionData;
            conv.state = fresh.state;
            conv.customerName = fresh.customerName;
        }
        return conv;
    }
    async resetOrderSession(conv, state, opts) {
        const current = this.getSession(conv);
        const next = {
            cart: [],
            orderType: 'delivery',
            linkedUserId: current.linkedUserId ?? null,
            linkedUserName: current.linkedUserName ?? null,
            ignorePriorOrderHistory: opts?.ignorePriorHistory !== false,
            fulfillmentChosen: false,
            addressConfirmed: false,
            phoneConfirmed: false,
            contactPhone: null,
        };
        conv.sessionData = next;
        conv.state = state;
        conv.lastMessageAt = new Date();
        const saved = await this.convRepo.save(conv);
        const fresh = await this.convRepo.findOne({ where: { id: saved.id } });
        if (fresh) {
            conv.sessionData = fresh.sessionData;
            conv.state = fresh.state;
            conv.customerName = fresh.customerName;
            conv.humanTakeover = fresh.humanTakeover;
        }
        return conv;
    }
    async reloadConversation(id) {
        const conv = await this.convRepo.findOne({ where: { id } });
        if (!conv)
            throw new common_1.NotFoundException('Conversación no encontrada');
        return conv;
    }
    async countInboundMessages(conversationId) {
        return this.msgRepo.count({ where: { conversationId, direction: 'in' } });
    }
    async findByWaMessageId(waMessageId) {
        const id = (waMessageId || '').trim();
        if (!id)
            return null;
        return this.msgRepo.findOne({ where: { waMessageId: id } });
    }
    async logMessage(params) {
        if (params.waMessageId) {
            const existing = await this.findByWaMessageId(params.waMessageId);
            if (existing)
                return existing;
        }
        try {
            const msg = this.msgRepo.create({
                conversationId: params.conversationId,
                direction: params.direction,
                body: params.body,
                waMessageId: params.waMessageId ?? null,
                sentBy: params.sentBy ?? (params.direction === 'in' ? 'bot' : 'bot'),
                rawPayload: params.raw ?? null,
                messageType: params.messageType || 'text',
                mediaId: params.mediaId ?? null,
                mimeType: params.mimeType ?? null,
            });
            return await this.msgRepo.save(msg);
        }
        catch (err) {
            if (params.waMessageId) {
                const again = await this.findByWaMessageId(params.waMessageId);
                if (again)
                    return again;
            }
            throw err;
        }
    }
    async updateMessageBody(messageId, body) {
        await this.msgRepo.update({ id: messageId }, { body });
    }
    async getMessage(conversationId, messageId) {
        const msg = await this.msgRepo.findOne({
            where: { id: messageId, conversationId },
        });
        if (!msg)
            throw new common_1.NotFoundException('Mensaje no encontrado');
        return msg;
    }
    async listConversations(limit = 80) {
        const rows = await this.convRepo.find({
            order: { updatedAt: 'DESC' },
            take: limit,
        });
        if (!rows.length)
            return [];
        const ids = rows.map((r) => r.id);
        const lastByConv = new Map();
        const placeholders = ids.map(() => '?').join(',');
        const lastRows = await this.msgRepo.query(`
      SELECT m.conversation_id, m.body, m.direction, m.sent_by, m.created_at
      FROM ppp_whatsapp_messages m
      INNER JOIN (
        SELECT conversation_id, MAX(id) AS max_id
        FROM ppp_whatsapp_messages
        WHERE conversation_id IN (${placeholders})
        GROUP BY conversation_id
      ) t ON m.id = t.max_id
      `, ids);
        for (const row of lastRows) {
            lastByConv.set(Number(row.conversation_id), {
                body: row.body || '',
                direction: row.direction,
                sentBy: row.sent_by,
                createdAt: row.created_at,
            });
        }
        return rows.map((c) => {
            const last = lastByConv.get(c.id) ?? null;
            return {
                conversation: c,
                lastMessage: last,
                inboxStatus: this.deriveInboxStatus(c),
            };
        });
    }
    deriveInboxStatus(c) {
        if (c.humanTakeover)
            return 'needs_human';
        if (c.state === 'closed')
            return 'closed';
        if (c.state === 'completed')
            return 'completed';
        return 'ordering';
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
        const now = new Date();
        conv.humanTakeover = takeover;
        conv.humanAgentId = takeover && agent ? agent.id : null;
        conv.humanAgentName = takeover && agent ? agent.fullName : null;
        if (takeover) {
            conv.humanTakeoverAt = now;
            conv.lastHumanOutboundAt = now;
            if (conv.state === 'closed')
                conv.state = 'building_cart';
        }
        else {
            conv.humanTakeoverAt = null;
        }
        return this.convRepo.save(conv);
    }
    async closeConversation(id) {
        const conv = await this.convRepo.findOne({ where: { id } });
        if (!conv)
            throw new common_1.NotFoundException('Conversación no encontrada');
        conv.state = 'closed';
        conv.humanTakeover = false;
        conv.humanAgentId = null;
        conv.humanAgentName = null;
        conv.humanTakeoverAt = null;
        conv.sessionData = {
            cart: [],
            orderType: 'delivery',
            linkedUserId: this.getSession(conv).linkedUserId ?? null,
            linkedUserName: this.getSession(conv).linkedUserName ?? null,
            ignorePriorOrderHistory: true,
        };
        return this.convRepo.save(conv);
    }
    async releaseHumanTakeover(id) {
        return this.setHumanTakeover(id, false);
    }
    async clearPendingChoices(conv) {
        const session = this.getSession(conv);
        return this.saveSession(conv, {
            ...session,
            pendingMatch: undefined,
            pendingAttribute: undefined,
        }, conv.state === 'awaiting_attribute' ? 'building_cart' : conv.state);
    }
    async findAgentIdleTakeovers(minutes, limit = 50) {
        if (minutes <= 0)
            return [];
        return this.convRepo
            .createQueryBuilder('c')
            .where('c.humanTakeover = 1')
            .andWhere('COALESCE(c.lastHumanOutboundAt, c.humanTakeoverAt, c.updatedAt) < DATE_SUB(NOW(), INTERVAL :m MINUTE)', { m: minutes })
            .orderBy('c.updatedAt', 'ASC')
            .take(limit)
            .getMany();
    }
    async findClientIdleTakeovers(minutes, limit = 50) {
        if (minutes <= 0)
            return [];
        return this.convRepo
            .createQueryBuilder('c')
            .where('c.humanTakeover = 1')
            .andWhere('COALESCE(c.lastInboundAt, c.humanTakeoverAt, c.createdAt) < DATE_SUB(NOW(), INTERVAL :m MINUTE)', { m: minutes })
            .orderBy('c.updatedAt', 'ASC')
            .take(limit)
            .getMany();
    }
    async findIdleOrderDrafts(minutes, limit = 50) {
        if (minutes <= 0)
            return [];
        const states = [
            'building_cart',
            'awaiting_name',
            'awaiting_fulfillment',
            'awaiting_address',
            'awaiting_phone',
            'awaiting_payment',
            'awaiting_notes',
            'awaiting_final_confirm',
            'confirming',
        ];
        return this.convRepo
            .createQueryBuilder('c')
            .where('c.humanTakeover = 0')
            .andWhere('c.state IN (:...states)', { states })
            .andWhere('COALESCE(c.lastInboundAt, c.lastMessageAt, c.updatedAt) < DATE_SUB(NOW(), INTERVAL :m MINUTE)', { m: minutes })
            .orderBy('c.updatedAt', 'ASC')
            .take(limit)
            .getMany();
    }
    async findIdlePendingChoices(minutes, limit = 50) {
        if (minutes <= 0)
            return [];
        return this.convRepo
            .createQueryBuilder('c')
            .where('c.humanTakeover = 0')
            .andWhere(`(c.state = :attr
          OR JSON_EXTRACT(c.session_data, '$.pendingMatch') IS NOT NULL
          OR JSON_EXTRACT(c.session_data, '$.pendingAttribute') IS NOT NULL)`, { attr: 'awaiting_attribute' })
            .andWhere('COALESCE(c.lastInboundAt, c.lastMessageAt, c.updatedAt) < DATE_SUB(NOW(), INTERVAL :m MINUTE)', { m: minutes })
            .orderBy('c.updatedAt', 'ASC')
            .take(limit)
            .getMany();
    }
    async findIdleMpPayments(minutes, limit = 50) {
        if (minutes <= 0)
            return [];
        return this.convRepo
            .createQueryBuilder('c')
            .where('c.humanTakeover = 0')
            .andWhere('c.state = :st', { st: 'awaiting_mp_payment' })
            .andWhere('COALESCE(c.lastInboundAt, c.lastMessageAt, c.updatedAt) < DATE_SUB(NOW(), INTERVAL :m MINUTE)', { m: minutes })
            .orderBy('c.updatedAt', 'ASC')
            .take(limit)
            .getMany();
    }
    async reopenForNewOrder(conv) {
        if (conv.state !== 'completed' && conv.state !== 'closed')
            return conv;
        return this.resetOrderSession(conv, 'building_cart', { ignorePriorHistory: true });
    }
    async getRecentMessageTexts(conversationId, limit = 10) {
        const rows = await this.msgRepo.find({
            where: { conversationId },
            order: { createdAt: 'DESC' },
            take: limit,
        });
        return rows.reverse().map((r) => `${r.direction === 'in' ? 'Cliente' : 'Bot'}: ${r.body || ''}`);
    }
    async purgeMessagesOlderThan(retentionDays = 90, batchSize = 2000) {
        const days = Math.max(1, Math.floor(retentionDays));
        const batch = Math.min(5000, Math.max(100, Math.floor(batchSize)));
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        let total = 0;
        for (let i = 0; i < 50; i++) {
            const oldIds = await this.msgRepo
                .createQueryBuilder('m')
                .select('m.id', 'id')
                .where('m.createdAt < :cutoff', { cutoff })
                .orderBy('m.id', 'ASC')
                .take(batch)
                .getRawMany();
            if (!oldIds.length)
                break;
            const ids = oldIds.map((r) => r.id);
            const del = await this.msgRepo
                .createQueryBuilder()
                .delete()
                .from(whatsapp_message_entity_1.WhatsappMessage)
                .where('id IN (:...ids)', { ids })
                .execute();
            const n = del.affected ?? 0;
            total += n;
            if (n < batch)
                break;
        }
        return total;
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