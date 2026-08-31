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
var WhatsappCleanupService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsappCleanupService = void 0;
const common_1 = require("@nestjs/common");
const whatsapp_conversation_service_1 = require("./whatsapp-conversation.service");
const whatsapp_settings_service_1 = require("./whatsapp-settings.service");
const whatsapp_meta_service_1 = require("./whatsapp-meta.service");
const whatsapp_bot_resume_1 = require("./whatsapp-bot-resume");
const RETENTION_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;
const SESSION_TICK_MS = 2 * 60 * 1000;
let WhatsappCleanupService = WhatsappCleanupService_1 = class WhatsappCleanupService {
    conversations;
    settings;
    meta;
    logger = new common_1.Logger(WhatsappCleanupService_1.name);
    purgeTimer = null;
    sessionTimer = null;
    sessionRunning = false;
    constructor(conversations, settings, meta) {
        this.conversations = conversations;
        this.settings = settings;
        this.meta = meta;
    }
    onModuleInit() {
        setTimeout(() => {
            void this.runPurge();
            void this.runSessionExpiry();
        }, 60_000);
        this.purgeTimer = setInterval(() => {
            void this.runPurge();
        }, DAY_MS);
        this.sessionTimer = setInterval(() => {
            void this.runSessionExpiry();
        }, SESSION_TICK_MS);
    }
    onModuleDestroy() {
        if (this.purgeTimer)
            clearInterval(this.purgeTimer);
        if (this.sessionTimer)
            clearInterval(this.sessionTimer);
    }
    async runPurge() {
        try {
            const deleted = await this.conversations.purgeMessagesOlderThan(RETENTION_DAYS);
            if (deleted > 0) {
                this.logger.log(`WhatsApp: borrados ${deleted} mensajes con más de ${RETENTION_DAYS} días`);
            }
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.error(`WhatsApp purge falló: ${msg}`);
        }
    }
    async runSessionExpiry() {
        if (this.sessionRunning)
            return;
        this.sessionRunning = true;
        try {
            const cfg = await this.settings.getEffectiveConfig();
            const notify = cfg.sessionIdleNotify !== false;
            const agentIdle = await this.conversations.findAgentIdleTakeovers(cfg.humanAgentIdleMinutes);
            for (const conv of agentIdle) {
                await this.conversations.releaseHumanTakeover(conv.id);
                this.logger.log(`Takeover liberado (agente idle) conv=#${conv.id}`);
                if (notify) {
                    const live = await this.conversations.reloadConversation(conv.id);
                    await this.safeNotify(live, (0, whatsapp_bot_resume_1.botResumeCustomerMessage)('agent_idle'));
                }
            }
            const clientIdle = await this.conversations.findClientIdleTakeovers(cfg.humanClientIdleMinutes);
            for (const conv of clientIdle) {
                const fresh = await this.conversations.reloadConversation(conv.id);
                if (!fresh.humanTakeover)
                    continue;
                await this.conversations.releaseHumanTakeover(fresh.id);
                const afterRelease = await this.conversations.reloadConversation(fresh.id);
                await this.conversations.resetOrderSession(afterRelease, 'building_cart', {
                    ignorePriorHistory: true,
                });
                this.logger.log(`Takeover + carrito limpios (cliente idle) conv=#${conv.id}`);
                if (notify) {
                    const live = await this.conversations.reloadConversation(fresh.id);
                    await this.safeNotify(live, 'Como no hubo respuesta, cerramos esta atención por ahora. Cuando quieras pedir, escríbenos de nuevo 👍');
                }
            }
            const pendingIdle = await this.conversations.findIdlePendingChoices(cfg.pendingChoiceIdleMinutes);
            for (const conv of pendingIdle) {
                const session = this.conversations.getSession(conv);
                if (!session.pendingMatch && !session.pendingAttribute && conv.state !== 'awaiting_attribute') {
                    continue;
                }
                await this.conversations.clearPendingChoices(conv);
                this.logger.log(`Pending choice limpiado (idle) conv=#${conv.id}`);
                if (notify) {
                    await this.safeNotify(conv, 'Se venció la elección pendiente. Cuando quieras, dime de nuevo el producto (nombre o código).');
                }
            }
            const mpIdle = await this.conversations.findIdleMpPayments(cfg.mpPaymentIdleMinutes);
            for (const conv of mpIdle) {
                await this.conversations.resetOrderSession(conv, 'building_cart', {
                    ignorePriorHistory: true,
                });
                this.logger.log(`MP payment idle → reset conv=#${conv.id}`);
                if (notify) {
                    await this.safeNotify(conv, 'El link de pago quedó pendiente mucho tiempo. Si aún quieres pedir, armamos el carrito de nuevo.');
                }
            }
            const draftIdle = cfg.orderDraftIdleMinutes;
            const drafts = await this.conversations.findIdleOrderDrafts(draftIdle);
            const lateCheckout = new Set([
                'awaiting_name',
                'awaiting_fulfillment',
                'awaiting_address',
                'awaiting_phone',
                'awaiting_payment',
                'awaiting_notes',
                'awaiting_final_confirm',
                'confirming',
            ]);
            for (const conv of drafts) {
                if (lateCheckout.has(conv.state) && draftIdle > 0) {
                    const last = conv.lastInboundAt || conv.lastMessageAt || conv.updatedAt;
                    const ageMin = last ? (Date.now() - new Date(last).getTime()) / 60000 : draftIdle;
                    if (ageMin < draftIdle * 2)
                        continue;
                }
                const session = this.conversations.getSession(conv);
                const hasDraft = session.cart.length > 0 ||
                    !!session.address ||
                    !!session.paymentMethod ||
                    !!session.pendingMatch ||
                    !!session.pendingAttribute ||
                    lateCheckout.has(conv.state);
                if (!hasDraft)
                    continue;
                await this.conversations.resetOrderSession(conv, 'building_cart', {
                    ignorePriorHistory: true,
                });
                this.logger.log(`Order draft idle → reset conv=#${conv.id}`);
                if (notify) {
                    await this.safeNotify(conv, 'Tu pedido a medias expiró por inactividad. Cuando quieras, empezamos de nuevo 🍗');
                }
            }
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.error(`WhatsApp session expiry falló: ${msg}`);
        }
        finally {
            this.sessionRunning = false;
        }
    }
    async safeNotify(conv, body) {
        try {
            await this.meta.sendText(conv.waId, body);
            await this.conversations.logMessage({
                conversationId: conv.id,
                direction: 'out',
                body,
                sentBy: 'system',
            });
            await this.conversations.touchOutbound(conv, 'bot');
        }
        catch (err) {
            this.logger.warn(`No se pudo notificar idle conv=#${conv.id}: ${String(err)}`);
        }
    }
};
exports.WhatsappCleanupService = WhatsappCleanupService;
exports.WhatsappCleanupService = WhatsappCleanupService = WhatsappCleanupService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [whatsapp_conversation_service_1.WhatsappConversationService,
        whatsapp_settings_service_1.WhatsappSettingsService,
        whatsapp_meta_service_1.WhatsappMetaService])
], WhatsappCleanupService);
//# sourceMappingURL=whatsapp-cleanup.service.js.map