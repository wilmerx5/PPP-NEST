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
        await this.conversations.releaseHumanTakeover(conv.id);
        this.logger.log(`Takeover liberado (agente idle) conv=#${conv.id}`);
        if (notify) {
          // Recargar: no notificar con snapshot que aún tiene humanTakeover=true
          const live = await this.conversations.reloadConversation(conv.id);
          await this.safeNotify(live, botResumeCustomerMessage('agent_idle'));
        }
      }

      // 2) Cliente no responde con humano al mando → liberar + soft reset
      const clientIdle = await this.conversations.findClientIdleTakeovers(
        cfg.humanClientIdleMinutes,
      );
      for (const conv of clientIdle) {
        // Puede haber sido liberado en el paso 1
        const fresh = await this.conversations.reloadConversation(conv.id);
        if (!fresh.humanTakeover) continue;
        await this.conversations.releaseHumanTakeover(fresh.id);
        const afterRelease = await this.conversations.reloadConversation(fresh.id);
        await this.conversations.resetOrderSession(afterRelease, 'building_cart', {
          ignorePriorHistory: true,
        });
        this.logger.log(`Takeover + carrito limpios (cliente idle) conv=#${conv.id}`);
        if (notify) {
          const live = await this.conversations.reloadConversation(fresh.id);
          await this.safeNotify(
            live,
            'Como no hubo respuesta, cerramos esta atención por ahora. Cuando quieras pedir, escríbenos de nuevo 👍',
          );
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
      for (const conv of drafts) {
        if (lateCheckout.has(conv.state) && draftIdle > 0) {
          const last = conv.lastInboundAt || conv.lastMessageAt || conv.updatedAt;
          const ageMin = last ? (Date.now() - new Date(last).getTime()) / 60000 : draftIdle;
          if (ageMin < draftIdle * 2) continue;
        }
        const session = this.conversations.getSession(conv);
        const hasDraft =
          session.cart.length > 0 ||
          !!session.address ||
          !!session.paymentMethod ||
          !!session.pendingMatch ||
          !!session.pendingAttribute ||
          lateCheckout.has(conv.state);
        if (!hasDraft) continue;
        await this.conversations.resetOrderSession(conv, 'building_cart', {
          ignorePriorHistory: true,
        });
        this.logger.log(`Order draft idle → reset conv=#${conv.id}`);
        if (notify) {
          await this.safeNotify(
            conv,
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
