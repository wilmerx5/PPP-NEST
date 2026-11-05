import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { WhatsappConversationService } from './whatsapp-conversation.service';
import { WhatsappSettingsService } from './whatsapp-settings.service';
import { WhatsappMetaService } from './whatsapp-meta.service';
import { botResumeCustomerMessage } from './whatsapp-bot-resume';
import type { WhatsappConversation } from './entities/whatsapp-conversation.entity';

const RETENTION_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;
const SESSION_TICK_MS = 2 * 60 * 1000;

/**
 * - Purga mensajes > 90 días (diario)
 * - Expira sesiones idle / takeover (cada ~2 min)
 */
@Injectable()
export class WhatsappCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsappCleanupService.name);
  private purgeTimer: ReturnType<typeof setInterval> | null = null;
  private sessionTimer: ReturnType<typeof setInterval> | null = null;
  private sessionRunning = false;

  constructor(
    private readonly conversations: WhatsappConversationService,
    private readonly settings: WhatsappSettingsService,
    private readonly meta: WhatsappMetaService,
  ) {}

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
    if (this.purgeTimer) clearInterval(this.purgeTimer);
    if (this.sessionTimer) clearInterval(this.sessionTimer);
  }

  private async runPurge() {
    try {
      const deleted = await this.conversations.purgeMessagesOlderThan(RETENTION_DAYS);
      if (deleted > 0) {
        this.logger.log(`WhatsApp: borrados ${deleted} mensajes con más de ${RETENTION_DAYS} días`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`WhatsApp purge falló: ${msg}`);
    }
  }

  private async runSessionExpiry() {
    if (this.sessionRunning) return;
    this.sessionRunning = true;
    try {
      const cfg = await this.settings.getEffectiveConfig();
      const notify = cfg.sessionIdleNotify !== false;

      // 1) Agente no responde → bot retoma (mantiene carrito)
      const agentIdle = await this.conversations.findAgentIdleTakeovers(
        cfg.humanAgentIdleMinutes,
      );
      for (const conv of agentIdle) {
        if (!await this.conversations.releaseIdleHumanTakeover(conv.id, cfg.humanAgentIdleMinutes)) continue;
        this.logger.log(`Takeover liberado (agente idle) conv=#${conv.id}`);
        if (notify) {
          // Recargar: no notificar con snapshot que aún tiene humanTakeover=true
          const live = await this.conversations.reloadConversation(conv.id);
          if (!live.humanTakeover && !['completed', 'closed', 'confirming'].includes(live.state)) {
            await this.safeNotify(live, botResumeCustomerMessage('agent_idle'));
          }
        }
      }

      // 2) Inactivity can release human attention, never erase order context.
      const clientIdle = await this.conversations.findClientIdleTakeovers(cfg.humanClientIdleMinutes);
      for (const conv of clientIdle) {
        if (!await this.conversations.releaseIdleHumanTakeover(conv.id, cfg.humanClientIdleMinutes)) continue;
        this.logger.log(`Takeover liberado (cliente idle) conv=#${conv.id}`);
        const live = await this.conversations.reloadConversation(conv.id);
        if (notify && !live.humanTakeover && !['completed', 'closed', 'confirming'].includes(live.state)) {
          await this.safeNotify(live, botResumeCustomerMessage('agent_idle'));
        }
      }

      // 3) Opción / match pendiente stale
      const pendingIdle = await this.conversations.findIdlePendingChoices(
        cfg.pendingChoiceIdleMinutes,
      );
      for (const conv of pendingIdle) {
        const session = this.conversations.getSession(conv);
        if (!session.pendingMatch && !session.pendingAttribute && conv.state !== 'awaiting_attribute') {
          continue;
        }
        await this.conversations.clearPendingChoices(conv);
        this.logger.log(`Pending choice limpiado (idle) conv=#${conv.id}`);
        if (notify) {
          await this.safeNotify(
            conv,
            'Se venció la elección pendiente. Cuando quieras, dime de nuevo el producto (nombre o código).',
          );
        }
      }

      // 4) MP abandonado
      const mpIdle = await this.conversations.findIdleMpPayments(cfg.mpPaymentIdleMinutes);
      for (const conv of mpIdle) {
        await this.conversations.resetOrderSession(conv, 'building_cart', {
          ignorePriorHistory: true,
        });
        this.logger.log(`MP payment idle → reset conv=#${conv.id}`);
        if (notify) {
          await this.safeNotify(
            conv,
            'El link de pago quedó pendiente mucho tiempo. Si aún quieres pedir, armamos el carrito de nuevo.',
          );
        }
      }

      // 5) Borrador de pedido (carrito / checkout) idle — sin humano.
      // Checkout tardío (nombre/dirección/pago) aguanta 2×: evita borrar carrito
      // justo cuando el bot pide el nombre tras la dirección.
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
      for (const candidate of drafts) {
        const conv = await this.conversations.reloadConversation(candidate.id);
        // Query results may predate a confirmation, new inbound or takeover.
        // Never expire an order while confirmation is in flight.
        if (draftIdle <= 0 || conv.humanTakeover || conv.state === 'confirming' ||
            (conv.state !== 'building_cart' && !lateCheckout.has(conv.state))) continue;
        const last = conv.lastInboundAt || conv.lastMessageAt || conv.updatedAt;
        const ageMs = last ? Date.now() - new Date(last).getTime() : NaN;
        const thresholdMs = draftIdle * (lateCheckout.has(conv.state) ? 2 : 1) * 60000;
        if (!Number.isFinite(ageMs) || ageMs < thresholdMs) continue;
        const session = this.conversations.getSession(conv);
        // A saved address/payment or an empty checkout is not a pending order.
        const hasDraft = session.cart.length > 0 ||
          !!session.pendingMatch || !!session.pendingAttribute;
        if (!hasDraft) continue;
        if (!await this.conversations.resetIdleOrderDraft(conv)) continue;
        this.logger.log(`Order draft idle → reset conv=#${conv.id}`);
        // Do not deliver a backlog of yesterday's expiry notices after downtime.
        if (notify && ageMs < DAY_MS && ageMs <= thresholdMs + 10 * 60000) {
          const live = await this.conversations.reloadConversation(conv.id);
          const liveSession = this.conversations.getSession(live);
          const sameInbound = String(live.lastInboundAt) === String(conv.lastInboundAt);
          if (!sameInbound || live.humanTakeover || live.state !== 'building_cart' ||
              liveSession.cart.length || liveSession.pendingMatch || liveSession.pendingAttribute) continue;
          await this.safeNotify(
            live,
            'Tu pedido a medias expiró por inactividad. Cuando quieras, empezamos de nuevo 🍗',
          );
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`WhatsApp session expiry falló: ${msg}`);
    } finally {
      this.sessionRunning = false;
    }
  }

  private async safeNotify(conv: WhatsappConversation, body: string) {
    try {
      await this.meta.sendText(conv.waId, body);
      await this.conversations.logMessage({
        conversationId: conv.id,
        direction: 'out',
        body,
        sentBy: 'system',
      });
      await this.conversations.touchOutbound(conv, 'bot');
    } catch (err) {
      this.logger.warn(`No se pudo notificar idle conv=#${conv.id}: ${String(err)}`);
    }
  }
}
