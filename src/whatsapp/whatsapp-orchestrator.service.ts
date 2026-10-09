import { applyCartLineEdits } from './whatsapp-cart-edits';
import { correctionMatchesLine, omitRedundantAttributeNote, parseCartQuantityCorrection } from './whatsapp-quantity-correction';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { WhatsappSettingsService } from './whatsapp-settings.service';
import { WhatsappMetaService, IncomingWhatsappMessage } from './whatsapp-meta.service';
import { WhatsappCatalogService, type MultiProductResolveResult, type MultiProductSegmentMatch, type ProductVariantFamily } from './whatsapp-catalog.service';
import { WhatsappAiService, type WhatsappImageAnalysis } from './whatsapp-ai.service';
import { WhatsappConversationService } from './whatsapp-conversation.service';
import { BusinessService } from '../business/business.service';
import { OrdersService } from '../orders/orders.service';
import { PaymentsService } from '../payments/payments.service';
import { WhatsappActionGuardService } from './whatsapp-action-guard.service';
import { WhatsappPointsService } from './whatsapp-points.service';
import { WhatsappDeliveryRoutingService } from './whatsapp-delivery-routing.service';
import { WhatsappAgentService } from './whatsapp-agent.service';
import { WhatsappTurnTelemetryService } from './whatsapp-turn-telemetry.service';
import {
  formatCartNeedsHalfChickenForPremio,
  formatPremioAppliedNote,
} from './whatsapp-points-help';
import { buildWhatsappBusinessRulesBlock } from './whatsapp-business-rules';
import {
  classifyWhatsappCustomerIntent,
  looksLikeAddressOnlyMessage,
  looksLikeClearCartMessage,
  looksLikeExplicitCartItemNote,
  looksLikeNonAddressCommand,
  isDeliverySetupWithoutFood,
  extractDeliverySetupAddress,
  isDeliveryLogisticsFluff,
  isHumanHandoffRequest,
  isNothingElseOrderIntent,
  isDeclineMoreItemsIntent,
  isFinishCheckoutIntent,
  isUpcomingAddressIntent,
  PPP_ZONE_LANDMARK_RE,
  FOOD_ORDER_SIGNAL_RE,
  type WhatsappMessageIntent,
} from './whatsapp-intent';
import { applyLocalGlossary } from './whatsapp-local-glossary';
import {
  needsAiMessageClassify,
  type WhatsappClassifyResult,
} from './whatsapp-message-classify';
import { composeWhatsappOrderAddress } from './whatsapp-order-address';
import {
  isAbandonPendingSelectionIntent,
  isAddressChangeIntent,
  isAddressClarificationIntent,
  isAddressRejectionIntent,
  isCartItemReplacementIntent,
  isConfirmCurrentAddressIntent,
  isDeliveryCoverageInquiry,
  extractCoverageAddressProbe,
  isDeliveryEtaInquiry,
  isDeliveryAvailabilityFaq,
  isDeliveryRangeQuestion,
  isUnansweredHumanComplaint,
  isInterruptedPhoneOrderInquiry,
  isPendingAddOfferDecline,
  isPostOrderFollowUpIntent,
  isReuseLastAddressIntent,
  isSpecificOrderProgressInquiry,
  extractDailyOrderNumberHint,
  isCourtesyAffirmation,
  isUsableWhatsappCustomerName,
  parseCartItemReplacement,
  parseEachOfQuantity,
  parseQtyMenuCodeLines,
  parseQtyDishCorrection,
  isCartChargeQuestion,
  looksLikeKitchenSendRequest,
  productNamesMentionedInOffer,
  pickProductNamedInLastOffer,
  resolvePendingListOrMenuCode,
} from './whatsapp-session-intents';
import { splitTrailingEmbeddedAddress, stripTrailingAddressFluff } from './whatsapp-compound-parse';
import {
  applyPaymentReplyTemplate,
  buildPaymentOptionsPrompt,
  findPaymentMethodByText,
  getEnabledPaymentMethods,
  isPaymentCapabilityQuestion,
  paymentMethodLabel,
  type WhatsappPaymentMethodConfig,
} from './whatsapp-payment-methods';
import {
  buildOrderLimitsPromptBlock,
  evaluateCartLimits,
  type CartLimitCheck,
  type WhatsappCartLimitsConfig,
} from './whatsapp-cart-limits';
import type { MenuConceptGroup } from './whatsapp-menu-concepts';
import { isNamedMenuDishOrderPhrase } from './whatsapp-named-menu-dish';
import type {
  AiOrderAction,
  WhatsappCartItem,
  WhatsappPendingAttribute,
  WhatsappSessionData,
} from './types/whatsapp-session.types';
import { botResumeCustomerMessage } from './whatsapp-bot-resume';
import {
  scrubAiDisclaimerCopy,
  scrubOutboundAsesorMentions,
  WHATSAPP_HUMAN_CONTACT_MESSAGE,
  WHATSAPP_HUMAN_CONTACT_PHONE,
} from './whatsapp-human-contact';
import {
  classifyOutboundMedia,
  outboundMediaBodyLabel,
  type OutboundMediaKind,
} from './whatsapp-outbound-media';
import {
  coalesceDelayMsForBatch,
  isCoalesceableInboundMessage,
  mergeCoalescedInboundMessages,
  WHATSAPP_INBOUND_COALESCE_MAX,
} from './whatsapp-inbound-coalesce';
import { WhatsappConversation } from './entities/whatsapp-conversation.entity';
import { CreateOrderDto } from '../orders/DTOS/orderDTO';

type MenuProduct = Awaited<ReturnType<WhatsappCatalogService['getMenuProducts']>>[number];
type EffectiveWhatsappConfig = Awaited<
  ReturnType<WhatsappSettingsService['getEffectiveConfig']>
>;

type InboundCoalesceState = {
  pending: IncomingWhatsappMessage[];
  waiters: Array<{ resolve: () => void; reject: (err: unknown) => void }>;
  timer?: ReturnType<typeof setTimeout>;
  flushing: boolean;
  /** Evita que media/ubicación se meta delante de un flush de textos en curso. */
  flushPromise?: Promise<void>;
};

@Injectable()
export class WhatsappOrchestratorService {
  private readonly logger = new Logger(WhatsappOrchestratorService.name);
  /** Serializa webhooks por waId para no pisar humanTakeover (ASESOR → gracias). */
  private readonly inboundByWaId = new Map<string, Promise<void>>();
  /** IDs reclamados por el turno activo, para auditar su resultado sin reejecutarlo. */
  private readonly claimedInboundIdsByWaId = new Map<string, string[]>();
  /**
   * Junta textos rápidos del mismo waId (calle + apto) antes de responder,
   * para una sola respuesta en lugar de dos turnos a medias.
   */
  private readonly inboundCoalesceByWaId = new Map<string, InboundCoalesceState>();
  /**
   * Durante un turno: acumula replies. Si llega otro texto a mitad de proceso,
   * se conservan (carry) y se envían con el siguiente flush — no se descartan.
   */
  private readonly outboundHoldByWaId = new Map<string, string[]>();
  /** Replies de un turno que no se enviaron porque llegó otro inbound a mitad de proceso. */
  private readonly outboundCarryByWaId = new Map<string, string[]>();

  constructor(
    private readonly settingsService: WhatsappSettingsService,
    private readonly metaService: WhatsappMetaService,
    private readonly catalogService: WhatsappCatalogService,
    private readonly aiService: WhatsappAiService,
    private readonly conversationService: WhatsappConversationService,
    private readonly businessService: BusinessService,
    private readonly ordersService: OrdersService,
    private readonly paymentsService: PaymentsService,
    private readonly actionGuard: WhatsappActionGuardService,
    private readonly pointsHandler: WhatsappPointsService,
    private readonly deliveryRouting: WhatsappDeliveryRoutingService,
    private readonly agentService: WhatsappAgentService,
    private readonly turnTelemetry: WhatsappTurnTelemetryService,
  ) {}

  async handleIncoming(msg: IncomingWhatsappMessage): Promise<void> {
    const key = (msg.waId || msg.phoneE164 || 'unknown').trim() || 'unknown';

    // Media / ubicación: no fusionar (cada uno es un turno propio).
    if (!isCoalesceableInboundMessage(msg)) {
      await this.flushInboundCoalesce(key);
      return this.enqueueInboundUnlocked(key, msg);
    }

    return new Promise<void>((resolve, reject) => {
      let state = this.inboundCoalesceByWaId.get(key);
      if (!state) {
        state = { pending: [], waiters: [], flushing: false };
        this.inboundCoalesceByWaId.set(key, state);
      }
      state.pending.push(msg);
      state.waiters.push({ resolve, reject });
      if (state.pending.length >= WHATSAPP_INBOUND_COALESCE_MAX) {
        this.flushInboundCoalesceInBackground(key);
        return;
      }
      this.scheduleInboundCoalesceFlush(key);
    });
  }

  private scheduleInboundCoalesceFlush(key: string): void {
    const state = this.inboundCoalesceByWaId.get(key);
    if (!state || state.flushing) return;
    if (state.timer) clearTimeout(state.timer);
    const delayMs = coalesceDelayMsForBatch(state.pending);
    state.timer = setTimeout(() => {
      this.flushInboundCoalesceInBackground(key);
    }, delayMs);
  }

  private flushInboundCoalesceInBackground(key: string): void {
    // flushInboundCoalesce forwards errors to every awaiting handleIncoming caller.
    // Its background promise also needs a handler so provider failures cannot
    // become unhandled rejections and terminate the Node process.
    void this.flushInboundCoalesce(key).catch((err: unknown) => {
      this.logger.error('WhatsApp background inbound flush failed', err);
    });
  }

  private hasInboundCoalescePending(key: string): boolean {
    const state = this.inboundCoalesceByWaId.get(key);
    return !!(state && state.pending.length > 0);
  }

  private beginOutboundHold(key: string): void {
    this.outboundHoldByWaId.set(key, []);
  }

  private async flushOrDiscardOutboundHold(
    key: string,
    conv: WhatsappConversation,
    waId: string,
  ): Promise<void> {
    const buffered = this.outboundHoldByWaId.get(key);
    this.outboundHoldByWaId.delete(key);
    if (!buffered?.length) {
      // Sin reply nuevo: igual soltar lo que venía en carry si ya no hay inbound pendiente
      if (!this.hasInboundCoalescePending(key)) {
        const carryOnly = this.outboundCarryByWaId.get(key);
        this.outboundCarryByWaId.delete(key);
        if (carryOnly?.length) {
          for (const body of carryOnly) {
            await this.sendReplyNow(conv, waId, body);
          }
        }
      }
      return;
    }

    if (this.hasInboundCoalescePending(key)) {
      // No descartar (ej. precio de pollo + "y dos sopas"): conservar para el siguiente flush
      const prev = this.outboundCarryByWaId.get(key) || [];
      this.outboundCarryByWaId.set(key, [...prev, ...buffered]);
      this.logger.log(
        `[WhatsApp coalesce] carry ${buffered.length} reply(ies); newer inbound pending waId=${key}`,
      );
      return;
    }

    const carry = this.outboundCarryByWaId.get(key) || [];
    this.outboundCarryByWaId.delete(key);
    for (const body of [...carry, ...buffered]) {
      await this.sendReplyNow(conv, waId, body);
    }
  }

  private async sendReplyNow(
    conv: WhatsappConversation,
    waId: string,
    body: string,
  ): Promise<void> {
    const trimmed = (body || '').trim();
    if (!trimmed) {
      this.logger.warn(`[WhatsApp] skip empty reply waId=${waId}`);
      return;
    }
    await this.metaService.sendText(waId, trimmed);
    await this.conversationService.logMessage({
      conversationId: conv.id,
      direction: 'out',
      body: trimmed,
      sentBy: 'bot',
    });
    await this.conversationService.touchOutbound(conv, 'bot');
  }

  private async flushInboundCoalesce(key: string): Promise<void> {
    const state = this.inboundCoalesceByWaId.get(key);
    if (!state) return;
    if (state.flushPromise) {
      await state.flushPromise;
    }
    const current = this.inboundCoalesceByWaId.get(key);
    if (!current || current.flushing) return;
    if (current.timer) {
      clearTimeout(current.timer);
      current.timer = undefined;
    }
    if (current.pending.length === 0) {
      if (current.waiters.length === 0) this.inboundCoalesceByWaId.delete(key);
      return;
    }

    current.flushing = true;
    const run = (async () => {
      const batch = current.pending.splice(0, current.pending.length);
      const waiters = current.waiters.splice(0, current.waiters.length);
      const merged = mergeCoalescedInboundMessages(batch);
      if (batch.length > 1) {
        this.logger.log(
          `[WhatsApp coalesce] waId=${key} fused ${batch.length} texts → one turn`,
        );
      }
      try {
        await this.enqueueInboundUnlocked(key, merged);
        for (const w of waiters) w.resolve();
      } catch (err) {
        for (const w of waiters) w.reject(err);
        throw err;
      } finally {
        current.flushing = false;
        current.flushPromise = undefined;
        if (current.pending.length > 0) {
          this.scheduleInboundCoalesceFlush(key);
        } else if (current.waiters.length === 0) {
          this.inboundCoalesceByWaId.delete(key);
        }
      }
    })();
    current.flushPromise = run.then(
      () => undefined,
      () => undefined,
    );
    await run;
  }

  private enqueueInboundUnlocked(
    key: string,
    msg: IncomingWhatsappMessage,
  ): Promise<void> {
    const prev = this.inboundByWaId.get(key) ?? Promise.resolve();
    const run = prev.then(
      () => this.runInboundUnlockedWithOutboundHold(key, msg),
      () => this.runInboundUnlockedWithOutboundHold(key, msg),
    );
    this.inboundByWaId.set(
      key,
      run.then(
        () => undefined,
        () => undefined,
      ),
    );
    return run;
  }

  private async runInboundUnlockedWithOutboundHold(
    key: string,
    msg: IncomingWhatsappMessage,
  ): Promise<void> {
    this.beginOutboundHold(key);
    let succeeded = false;
    try {
      await this.handleIncomingUnlocked(msg);
      const conv = await this.conversationService.findOrCreateConversation(
        msg.waId,
        msg.phoneE164,
      );
      // Un turno no está completado hasta finalizar también sus respuestas.
      // Si Meta falla al enviarlas, dejar failed para revisión y NO reejecutar
      // ciegamente las mutaciones del carrito o la creación de la orden.
      await this.flushOrDiscardOutboundHold(key, conv, msg.waId);
      succeeded = true;
    } finally {
      if (!succeeded) {
        // No enviar respuestas parciales de un turno que falló.
        this.outboundHoldByWaId.delete(key);
      }
      const claimedIds = this.claimedInboundIdsByWaId.get(key) || [];
      this.claimedInboundIdsByWaId.delete(key);
      if (claimedIds.length) {
        await this.conversationService.setInboundProcessingOutcome(
          claimedIds,
          succeeded ? 'completed' : 'failed',
        );
      }
    }
  }

  private async handleIncomingUnlocked(msg: IncomingWhatsappMessage): Promise<void> {
    const cfg = await this.settingsService.getEffectiveConfig();
    const conv = await this.conversationService.findOrCreateConversation(msg.waId, msg.phoneE164);
    await this.conversationService.touchInbound(conv);

    // Cada burbuja del lote tiene su propio ID de Meta. Reclamar todos,
    // conservando únicamente los fragmentos nuevos para este turno.
    const batch = Array.isArray(msg.raw?.coalescedMessages)
      ? (msg.raw.coalescedMessages as Array<{
          messageId: string;
          text: string;
          timestamp?: number;
          raw?: Record<string, unknown>;
        }>)
      : null;
    const freshTexts: string[] = [];
    const newlyClaimedIds: string[] = [];
    let logged: Awaited<ReturnType<WhatsappConversationService['claimInboundMessage']>> = null;
    if (batch?.length) {
      for (const part of batch) {
        const claimed = await this.conversationService.claimInboundMessage({
          conversationId: conv.id,
          body: part.text,
          waMessageId: part.messageId,
          raw: part.raw,
          messageType: 'text',
        });
        if (!claimed) continue;
        if (part.messageId) newlyClaimedIds.push(part.messageId);
        if (!logged) logged = claimed;
        // Evitar repetir la misma línea si el cliente envía un texto idéntico
        // en dos burbujas consecutivas (comportamiento previo del coalescer).
        if (freshTexts[freshTexts.length - 1] !== part.text.trim()) {
          freshTexts.push(part.text.trim());
        }
      }
      if (logged) msg = { ...msg, text: freshTexts.join('\n') };
    } else {
      logged = await this.conversationService.claimInboundMessage({
        conversationId: conv.id,
        body: msg.text,
        waMessageId: msg.messageId,
        raw: msg.raw,
        messageType: msg.messageType,
        mediaId: msg.mediaId,
        mimeType: msg.mimeType,
      });
      if (logged && msg.messageId) newlyClaimedIds.push(msg.messageId);
    }
    // Otro worker/instancia ya reclamó este messageId mediante UNIQUE.
    // No tocar sesión ni crear pedidos a partir del webhook duplicado.
    if (!logged) {
      this.logger.debug(`Skip duplicate inbound waMessageId=${msg.messageId}`);
      return;
    }
    const key = (msg.waId || msg.phoneE164 || 'unknown').trim() || 'unknown';
    // Nunca cambiar el estado de IDs duplicados reclamados por otro worker.
    this.claimedInboundIdsByWaId.set(key, newlyClaimedIds);

    if (!cfg.enabled) {
      await this.reply(conv, msg.waId, 'Por ahora WhatsApp no está activo. Puedes pedir por la web o llamar al local.');
      return;
    }

    // Releer: otro mensaje pudo activar ASESOR / takeover mientras este esperaba en cola
    {
      const fresh = await this.conversationService.reloadConversation(conv.id);
      Object.assign(conv, fresh);
    }
    if (conv.humanTakeover) {
      return;
    }

    // Audio / imagen → texto (Whisper / Vision); resto: avisar
    let text = (msg.text || '').trim();
    if (msg.messageType === 'audio' && msg.mediaId) {
      const resolved = await this.resolveAudioToText(msg, logged.id);
      if (!resolved) {
        await this.reply(
          conv,
          msg.waId,
          'No pude escuchar el audio. Escríbelo por texto.\n' + this.humanHelpHint(),
        );
        return;
      }
      text = resolved;
      // Sin eco aparte: el siguiente mensaje útil ya responde (menos burbujas / latencia)
    } else if (msg.messageType === 'image' && msg.mediaId) {
      const img = await this.resolveImageMessage(msg, logged.id, conv, cfg);
      if (img.done) return;
      text = img.text;
      await this.reply(conv, msg.waId, `Vi en tu foto: _${this.shortQuote(text)}_`);
    } else if (msg.messageType === 'location') {
      const addr = this.formatLocationAddress(msg);
      if (!addr) {
        await this.reply(
          conv,
          msg.waId,
          'No pude leer la ubicación. Escribe la *dirección* o manda el pin otra vez.',
        );
        return;
      }
      let sessionLoc = this.conversationService.getSession(conv);
      sessionLoc = {
        ...sessionLoc,
        orderType: 'delivery',
        address: addr,
        fulfillmentChosen: true,
        addressConfirmed: true,
        deliveryLat: msg.latitude ?? null,
        deliveryLng: msg.longitude ?? null,
        deliveryFeeCalculated: undefined,
        deliveryDistanceKm: undefined,
        deliveryOutOfCoverage: false,
      };
      const feeResult = await this.recalculateDeliveryFee(sessionLoc, cfg, {
        lat: msg.latitude,
        lng: msg.longitude,
      });
      sessionLoc = feeResult.session;
      await this.conversationService.saveSession(conv, sessionLoc, 'building_cart');
      const feeLine = feeResult.notice ? `\n${feeResult.notice}` : '';
      await this.reply(
        conv,
        msg.waId,
        `Listo, anoté tu ubicación como domicilio ✅\n_${sessionLoc.address || addr}_${feeLine}`,
      );
      if (feeResult.blocked) {
        await this.reply(conv, msg.waId, feeResult.blocked);
        return;
      }
      const freshLoc = await this.conversationService.reloadConversation(conv.id);
      Object.assign(conv, freshLoc);
      sessionLoc = this.conversationService.getSession(conv);
      if (sessionLoc.cart.length > 0) {
        await this.tryConfirmOrder(conv, msg.waId, sessionLoc);
      } else {
        await this.reply(conv, msg.waId, '¿Qué se te antoja? Escribe el *plato* o el *código*.');
      }
      return;
    } else if (msg.messageType !== 'text') {
      await this.reply(
        conv,
        msg.waId,
          'Mejor por *texto*, *audio*, *foto* o *ubicación*.\n' +
          this.humanHelpHint(),
      );
      return;
    }

    if (!text) {
      await this.reply(conv, msg.waId, '¿Qué se te antoja? Escribe el *plato* o el *código*.');
      return;
    }

    // Glosario local: typos / aliases antes de matching e IA
    text = applyLocalGlossary(text);
    const originalText = text;

    const lower = text.toLowerCase();

    if (isHumanHandoffRequest(text)) {
      // Temporal: no activar asesor por chat; orientar a llamada
      await this.reply(conv, msg.waId, this.humanContactMessage());
      return;
    }

    // Tras idle de “asesor”: nadie contestó
    if (isUnansweredHumanComplaint(originalText)) {
      await this.reply(
        conv,
        msg.waId,
        'Qué pena que no te hayan contestado por aquí 🙏\n\n' +
          `Puedo ayudarte yo con el pedido, o ${this.humanContactMessage()}\n` +
          'Dime qué se te antoja (plato o código).',
      );
      return;
    }

    // Error de Meta pegado / foto caducada (en cualquier estado)
    if (this.looksLikeFailedMediaNotice(originalText)) {
      await this.reply(
        conv,
        msg.waId,
        'No pude abrir esa foto 🙏 A veces Meta la deja caducar.\n' +
          'Si era el *comprobante*, mándala de nuevo; si no, escribe el *plato* o el *código*.\n' +
          this.humanContactMessage(),
      );
      return;
    }

    // Mismo chat por número: al escribir de nuevo tras pedido o cierre, empieza pedido nuevo
    let reopenedFreshOrder = false;
    if (conv.state === 'completed' || conv.state === 'closed') {
      // ETA / demora / faltante: no reabrir carrito ni buscar platos
      if (isPostOrderFollowUpIntent(originalText)) {
        await this.handlePostOrderFollowUp(conv, msg.waId, originalText, cfg);
        return;
      }
      await this.conversationService.reopenForNewOrder(conv);
      const freshReopen = await this.conversationService.reloadConversation(conv.id);
      Object.assign(conv, freshReopen);
      reopenedFreshOrder = true;
    }

    if (this.isClearCartIntent(originalText)) {
      await this.conversationService.resetOrderSession(conv, 'building_cart', {
        ignorePriorHistory: true,
      });
      await this.reply(
        conv,
        msg.waId,
        'Listo, *vaciamos el carrito* ✅ ¿Qué te gustaría pedir?',
      );
      return;
    }

    if (this.isCancelIntent(originalText)) {
      await this.handleCancelRequest(conv, msg.waId, cfg);
      return;
    }

    let session = this.conversationService.getSession(conv);
    // Resolve scoped quantity changes before extracting names/addresses or asking the model.
    // A correction refers to an existing cart line, even while a variant list is open.
    if (session.cart.length &&
      await this.tryHandleCartQuantityCorrection(conv, msg.waId, session, originalText, cfg)) return;
    // Mensaje largo / audio: guardar texto completo para no perder domicilio al cortar productos
    const compound = this.parseCompoundOrderMessage(text);
    session = this.withDeliveryAddress(session, compound.address);
    if (compound.phone) {
      session = {
        ...session,
        contactPhone: compound.phone,
        phoneConfirmed: true,
      };
    } else if (compound.phoneUsesWhatsapp) {
      session = {
        ...session,
        phoneConfirmed: true,
      };
    }
    // Pago en el mismo mensaje del pedido ("… pago por nequi / llave / efectivo")
    if (!session.paymentMethod) {
      const payInMsg = findPaymentMethodByText(originalText, cfg.paymentMethods);
      if (payInMsg) {
        session = { ...session, paymentMethod: payInMsg.id };
      }
    }
    if (compound.customerName && !isUsableWhatsappCustomerName(conv.customerName || '')) {
      if (isUsableWhatsappCustomerName(compound.customerName)) {
        await this.conversationService.updateCustomerName(conv, compound.customerName);
        const freshName = await this.conversationService.reloadConversation(conv.id);
        Object.assign(conv, freshName);
      }
    } else if (compound.customerName && !conv.customerName?.trim()) {
      if (isUsableWhatsappCustomerName(compound.customerName)) {
        await this.conversationService.updateCustomerName(conv, compound.customerName);
        const freshName = await this.conversationService.reloadConversation(conv.id);
        Object.assign(conv, freshName);
      }
    }
    if (compound.productText.length >= 3) {
      text = compound.productText;
    }
    await this.conversationService.saveSession(conv, session);
    const productsRaw = await this.catalogService.getMenuProducts();
    const status = await this.businessService.getStatus();
    const businessOpenForBot = status.isOpen || !!cfg.ignoreBusinessHours;
    // En pruebas nocturnas: no filtrar por horario de producto
    const products = cfg.ignoreBusinessHours
      ? productsRaw.map((p) => ({ ...p, availableNow: true }))
      : productsRaw;

    // Primer mensaje de la conversación — aviso IA + bienvenida
    const inboundCount = await this.conversationService.countInboundMessages(conv.id);
    const isFirstInbound = inboundCount <= 1;
    if (isFirstInbound) {
      // Audio/texto tipo “quiero pedir” sin producto → no inundar con menú completo
      if (!cfg.agentV1Enabled && this.isVagueOrderIntent(text)) {
        await this.replyFirstContactWelcome(conv, msg.waId, cfg);
        await this.reply(conv, msg.waId, this.buildAskWhatToOrderMessage(cfg));
        return;
      }
      // Solo saludo → bienvenida y listo (un mensaje)
      if (this.isGreetingKeyword(text) || text.length < 2) {
        await this.replyFirstContactWelcome(conv, msg.waId, cfg);
        return;
      }
      // Saludo + pregunta/pedido: NO mandar bienvenida aparte (evita 2 burbujas).
      // El aviso IA va pegado a la única respuesta de contenido más abajo.
      const withoutGreeting = this.stripLeadingGreeting(text);
      if (withoutGreeting !== text && withoutGreeting.length >= 2) {
        if (this.isGreetingKeyword(withoutGreeting)) {
          await this.replyFirstContactWelcome(conv, msg.waId, cfg);
          return;
        }
        text = withoutGreeting;
      }
    }

    // Releer sesión: pendingAttribute / carrito deben venir de DB
    {
      const fresh = await this.conversationService.reloadConversation(conv.id);
      Object.assign(conv, fresh);
      session = this.conversationService.getSession(conv);
    }

    // Respuesta al “¿cuál es el # de orden?” (sin geocodificar el número)
    if (
      await this.tryResolvePendingOrderStatusLookup(
        conv,
        msg.waId,
        session,
        originalText,
        cfg,
      )
    ) {
      return;
    }

    // "No, no más" / "terminar mi pedido" / "no" tras ¿Algo más? → checkout ANTES de ETA / agente / dirección
    // (no interrumpir attrs / lista pendiente; bare "no" solo en building_cart)
    if (
      session.cart.length > 0 &&
      !session.pendingAttribute &&
      !session.pendingMatch?.candidates?.length &&
      !session.pendingMultiOrder &&
      (this.isConfirmKeyword(originalText) ||
        isNothingElseOrderIntent(originalText) ||
        isFinishCheckoutIntent(originalText) ||
        (isDeclineMoreItemsIntent(originalText) &&
          (conv.state === 'building_cart' || !conv.state)))
    ) {
      const fresh = await this.conversationService.reloadConversation(conv.id);
      Object.assign(conv, fresh);
      session = this.conversationService.getSession(conv);
      await this.tryConfirmOrder(conv, msg.waId, session);
      return;
    }

    // Con el agente encendido, él lee primero si preguntan por un pedido ya hecho
    // o por el tiempo de domicilio. Si no lo resuelve, el mismo respaldo corre después.
    if (!cfg.agentV1Enabled) {
      if (
        await this.tryHandleDeliveryEtaInquiry(
          conv,
          msg.waId,
          session,
          originalText,
          text,
          cfg,
        )
      ) {
        return;
      }

      if (
        await this.tryHandleInterruptedPhoneOrderInquiry(
          conv,
          msg.waId,
          originalText,
          cfg,
        )
      ) {
        return;
      }
    }

    // Reaplicar domicilio desde el texto ORIGINAL (el de productos ya no trae "para …")
    const customerIntent = this.resolveCustomerIntent(
      originalText,
      session,
      products,
      cfg,
      compound,
    );


    if (
      !looksLikeClearCartMessage(originalText) &&
      !looksLikeNonAddressCommand(originalText) &&
      !isNothingElseOrderIntent(originalText) &&
      !this.isConfirmKeyword(originalText) &&
      !isDeliveryEtaInquiry(originalText) &&
      !isDeliveryEtaInquiry(text) &&
      !cfg.agentV1Enabled &&
      !this.isPickupIntent(originalText) &&
      !this.isPickupIntent(text) &&
      customerIntent === 'address'
    ) {
      // Regla general: con domicilio ya confirmado, NO reemplazar por notas
      // (torre/apto/ref). Solo pisar si el mensaje es otra dirección completa.
      const preserve =
        !!session.address?.trim() &&
        !!session.addressConfirmed &&
        !this.looksLikeAddressReplacement(originalText) &&
        !this.looksLikeAddressReplacement(text);
      if (!preserve) {
        session = this.applyDeliveryHintFromMessage(session, originalText);
        if (!session.address?.trim() && compound.address) {
          session = this.withDeliveryAddress(session, compound.address);
        }
        if (session.address?.trim()) {
          await this.conversationService.saveSession(conv, session);
        }
      }
    }

    // Con el agente encendido estas frases las lee él. Si no las resuelve, el mismo respaldo corre después.
    if (!cfg.agentV1Enabled) {
    // "no quiero combo de broaster, quiero combo de frito" → swap, no nota
    if (
      await this.tryHandleCartItemReplacement(
        conv,
        msg.waId,
        session,
        originalText,
        products,
        cfg,
      )
    ) {
      return;
    }

    if (
      await this.tryHandleInlineOrderNoteEarly(
        conv,
        msg.waId,
        session,
        originalText,
        customerIntent,
        cfg,
        products,
      )
    ) {
      return;
    }

    // "así nada más" / "no" / listo → checkout ANTES de tratar el texto como dirección
    if (
      (this.isConfirmKeyword(originalText) ||
        isNothingElseOrderIntent(originalText) ||
        (isDeclineMoreItemsIntent(originalText) &&
          (conv.state === 'building_cart' || !conv.state))) &&
      session.cart.length > 0
    ) {
      const fresh = await this.conversationService.reloadConversation(conv.id);
      Object.assign(conv, fresh);
      session = this.conversationService.getSession(conv);
      await this.tryConfirmOrder(conv, msg.waId, session);
      return;
    }

    // "No esa no es mi dirección" → quitar domicilio malo y pedir el correcto
    if (await this.tryHandleAddressChange(conv, msg.waId, session, originalText, cfg)) {
      return;
    }

    // "esa era mi dirección" → recuperar placa previa mal leída como código (#2)
    if (
      await this.tryHandleAddressClarification(conv, msg.waId, session, originalText, cfg)
    ) {
      return;
    }

    // "A esta dirección plis" → confirma el domicilio ya anotado (no geocodificar basura)
    if (
      await this.tryHandleConfirmCurrentAddress(
        conv,
        msg.waId,
        session,
        originalText,
        cfg,
      )
    ) {
      return;
    }

    // Referencia de acceso con dirección ya fija (portón verde…) — antes de tratarla como nueva calle
    if (
      await this.tryAppendUnitDetailsToAddress(
        conv,
        msg.waId,
        session,
        originalText,
        cfg,
      )
    ) {
      return;
    }

    if (
      await this.tryAppendDeliveryAccessReference(
        conv,
        msg.waId,
        session,
        originalText,
        cfg,
      )
    ) {
      return;
    }

    // Con carrito: dirección suelta o “acá” / misma dirección guardada
    // (nunca si es recojo / “paso por el local”)
    if (
      !this.isPickupIntent(originalText) &&
      !this.isPickupIntent(text) &&
      (customerIntent === 'address' ||
        isReuseLastAddressIntent(originalText) ||
        looksLikeAddressOnlyMessage(originalText, {
          compoundAddress: compound.address,
          compoundProductText: compound.productText,
        })) &&
      (await this.tryHandleAddressOnlyWhileBuildingCart(
        conv,
        msg.waId,
        session,
        originalText,
        compound,
        cfg,
      ))
    ) {
      return;
    }

    // Pickup explícito temprano (antes del agente): "recogo en el local" / "paso por ella"
    if (
      session.cart.length > 0 &&
      (this.isPickupIntent(originalText) || this.isPickupIntent(text))
    ) {
      session = this.applyPickupIntent(session, text || originalText);
      await this.conversationService.saveSession(conv, session, 'building_cart');
      await this.reply(
        conv,
        msg.waId,
        `Listo, queda como *recoger en el local* (sin domicilio).\n_${session.address}_`,
      );
      const freshPu = await this.conversationService.reloadConversation(conv.id);
      Object.assign(conv, freshPu);
      session = this.conversationService.getSession(conv);
      await this.tryConfirmOrder(conv, msg.waId, session);
      return;
    }

    if (
      await this.tryHandleCartModification(
        conv,
        msg.waId,
        session,
        text,
        products,
        cfg,
        originalText,
      )
    ) {
      return;
    }
    }

    if (await this.tryHandlePointsFlow(conv, msg.waId, session, text, cfg)) {
      return;
    }

    if (!cfg.agentV1Enabled) {
    if (await this.tryHandleDeliveryRangeQuestion(conv, msg.waId, originalText, cfg)) {
      return;
    }

    if (await this.tryHandleBusinessServiceInquiry(conv, msg.waId, originalText, cfg)) {
      return;
    }

    if (await this.tryHandleCoverageInquiry(conv, msg.waId, session, originalText, cfg)) {
      return;
    }

    if (
      await this.tryHandleComboAvailabilityQuestion(conv, msg.waId, session, text, products, cfg)
    ) {
      return;
    }
    }

    // Explorar otra categoría mientras hay attrs pendientes → soltar y listar (no atrapar en arepas)
    {
      const browseWhilePending =
        this.catalogService.isMenuExploreIntent(text, products) ||
        this.catalogService.isCategoryBrowseQuestion(text);
      if (
        browseWhilePending &&
        (session.pendingAttribute || session.pendingMatch || session.pendingMultiOrder)
      ) {
        session = {
          ...session,
          pendingAttribute: undefined,
          pendingMatch: undefined,
          pendingMultiOrder: undefined,
        };
        await this.conversationService.saveSession(conv, session, 'building_cart');
      }
    }

    // PRIORIDAD 1: eligiendo opción de un producto (1, 2, 3… NO es código de producto).
    // Una frase ("no, yo quería el otro") no se traga aquí: la lee el agente.
    let deferHumanIntentToAgent = false;
    if (session.pendingAttribute || conv.state === 'awaiting_attribute') {
      if (
        await this.tryHandleCartModification(
          conv,
          msg.waId,
          session,
          text,
          products,
          cfg,
          originalText,
        )
      ) {
        return;
      }
      if (
        await this.tryAbandonPendingSelection(conv, msg.waId, session, text, cfg)
      ) {
        return;
      }
      // Pregunta de mixto / composición mientras está atrapado en arepas → soltar y responder
      if (
        this.catalogService.isMixtoCompositionInquiry(text) ||
        this.catalogService.isDishStyleSubstitutionInquiry(text) ||
        this.catalogService.isProductDescriptionInquiry(text) ||
        this.catalogService.isComboMeaningInquiry(text)
      ) {
        session = {
          ...session,
          pendingAttribute: undefined,
          pendingMatch: undefined,
        };
        await this.conversationService.saveSession(conv, session, 'building_cart');
        if (await this.tryHandleMixtoCompositionInquiry(conv, msg.waId, session, text, products, cfg)) {
          return;
        }
        if (
          await this.tryHandleDishStyleSubstitutionInquiry(
            conv,
            msg.waId,
            session,
            text,
            products,
            cfg,
          )
        ) {
          return;
        }
        if (
          await this.tryHandleProductCompositionQuestion(
            conv,
            msg.waId,
            text,
            products,
            cfg,
            session,
          )
        ) {
          return;
        }
      }
      if (
        await this.tryHandleServingSizeChange(conv, msg.waId, session, text, products, cfg)
      ) {
        return;
      }
      if (
        await this.tryHandleLargerPackInquiry(conv, msg.waId, session, text, products, cfg)
      ) {
        return;
      }
      const multiDishUpFront =
        this.catalogService.looksLikeClearlyMultiDishOrder(originalText || text) ||
        this.catalogService.looksLikeMultiItemOrderMessage(originalText || text) ||
        this.catalogService.looksLikeClearlyMultiDishOrder(text) ||
        this.catalogService.looksLikeMultiItemOrderMessage(text);
      if (
        !multiDishUpFront &&
        (this.catalogService.isAvailabilityInquiry(text) ||
          this.catalogService.isProductDescriptionInquiry(text))
      ) {
        if (
          await this.tryHandleProductCompositionQuestion(
            conv,
            msg.waId,
            text,
            products,
            cfg,
            session,
          )
        ) {
          return;
        }
        if (await this.tryHandleProductInfoInquiry(conv, msg.waId, text, products, cfg)) {
          return;
        }
      }
      const pa = session.pendingAttribute;
      // Preferir catálogo vivo; si no está, usar snapshot de sesión (evita caer a "código 2")
      const product = pa
        ? this.catalogService.getProductById(pa.productId, products) ||
          ({
            id: pa.productId,
            name: pa.name,
            code: pa.code,
            price: pa.price,
            hasAttributes: true,
            attributes: pa.attributes,
            availableNow: true,
          } as MenuProduct)
        : null;
      if (pa && product && cfg.agentV1Enabled && this.looksLikeHumanIntentSentence(text)) {
        deferHumanIntentToAgent = true;
      } else if (pa && product) {
        if (this.catalogService.isVariantPreferenceIntent(text)) {
          if (
            await this.tryApplyVariantPreferenceToProduct(
              conv,
              msg.waId,
              session,
              text,
              products,
              cfg,
              product,
              { fromPendingAttribute: true },
            )
          ) {
            return;
          }
        }

        const attrOpts = this.attributeFlowOpts(pa);
        if (this.catalogService.isLikelyDrinkProduct(product) && session.cart.length) {
          const clarified = this.catalogService.cartDrinkClarification(
            text,
            session.cart,
            products,
          );
          if (clarified) {
            const line = session.cart[clarified.cartIndex];
            const attributes = [...(line?.attributes || [])];
            const idx = attributes.findIndex(
              (a) => a.attributeName.toLowerCase() === clarified.attributeName.toLowerCase(),
            );
            const nextAttr = {
              attributeName: clarified.attributeName,
              attributeValue: clarified.attributeValue,
            };
            if (idx >= 0) attributes[idx] = nextAttr;
            else attributes.push(nextAttr);
            const cart = session.cart.map((item, i) =>
              i === clarified.cartIndex ? { ...item, attributes } : item,
            );
            const pm = session.pendingMultiOrder;
            const needsAttributes = (pm?.needsAttributes || []).filter(
              (n) => n.productId !== product.id,
            );
            session = {
              ...session,
              cart,
              pendingAttribute: undefined,
              pendingMatch: undefined,
              pendingMultiOrder:
                pm &&
                (needsAttributes.length ||
                  pm.confident.length ||
                  pm.ambiguous.length ||
                  pm.unresolved.length)
                  ? { ...pm, needsAttributes }
                  : undefined,
            };
            await this.conversationService.saveSession(conv, session, 'building_cart');
            await this.reply(
              conv,
              msg.waId,
              `Listo ✅ *${clarified.itemName}* queda con *${clarified.attributeName}: ${clarified.attributeValue}*.\n\n¿*Algo más*?`,
            );
            return;
          }
        }
        if (this.messageRejectsPendingProduct(text, product)) {
          session = {
            ...session,
            pendingAttribute: undefined,
            pendingAddOffer: undefined,
            pendingMatch: undefined,
          };
          await this.conversationService.saveSession(conv, session, 'building_cart');
          await this.reply(
            conv,
            msg.waId,
            `Listo, dejamos pasar *${product.name}* 👍 ¿Qué te gustaría pedir?`,
          );
          return;
        }
        let step = this.catalogService.resolveNextAttributeChoice(
          product,
          text,
          pa.selected || [],
          attrOpts,
        );
        if (step.status === 'complete' || step.status === 'partial') {
          const filled = this.catalogService.fillDefaultAttributes(
            product,
            step.attributes,
            attrOpts,
          );
          step = this.catalogService.isAttributeSelectionComplete(product, filled, attrOpts)
            ? { status: 'complete', attributes: filled }
            : { status: 'partial', attributes: filled };
        }
        if (step.status === 'complete') {
          const stillNeed = this.catalogService.getRemainingAttributes(
            product,
            step.attributes,
            attrOpts,
          );
          if (stillNeed.length) {
            session.pendingAttribute = {
              ...pa,
              selected: step.attributes,
            };
            await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
            await this.reply(
              conv,
              msg.waId,
              this.catalogService.formatProductOptionsPrompt(
                product,
                step.attributes,
                attrOpts,
              ),
            );
            return;
          }
          const fresh = await this.conversationService.reloadConversation(conv.id);
          Object.assign(conv, fresh);
          session = this.conversationService.getSession(conv);
          const addQty = this.resolveAddQuantity(session, product, {
            // sourceText del pending puede ser "3" (fila de lista) — no usarlo como qty.
            // Tampoco usar el mensaje actual si es solo "2" (elección de arepas).
            sourceText:
              pa.sourceText && !/^\d{1,2}$/.test(pa.sourceText.trim())
                ? pa.sourceText
                : undefined,
          });
          const added = this.tryAddProductToCart(
            session,
            product,
            addQty,
            cfg,
            undefined,
            step.attributes,
            attrOpts,
          );
          if (added.missingAttributes) {
            session = this.buildPendingAttributeSession(session, product, added.missingAttributes, {
              variantIntent: pa.variantIntent,
              pendingMultiOrder: session.pendingMultiOrder,
            });
            await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
            await this.reply(
              conv,
              msg.waId,
              this.catalogService.formatProductOptionsPrompt(
                product,
                added.missingAttributes,
                attrOpts,
              ),
            );
            return;
          }
          if (added.blocked) {
            await this.conversationService.saveSession(conv, session);
            const qtyNote = addQty > 1 ? ` ×${addQty}` : '';
            await this.reply(
              conv,
              msg.waId,
              `${added.blocked.reason || 'Ese pedido se sale del tope por WhatsApp.'}\n\n` +
                `No agregué *${product.name}*${qtyNote}. El resto del pedido sigue igual.`,
            );
            return;
          }
          session = added.session;
          session.pendingAttribute = undefined;
          session = this.popCompletedNeedsAttribute(session, product.id);
          const nextNeeds = session.pendingMultiOrder?.needsAttributes?.[0];
          const nextProduct = nextNeeds
            ? products.find((p) => p.id === nextNeeds.productId)
            : null;
          if (nextProduct?.hasAttributes && nextProduct.attributes?.length) {
            const fromSeg = this.catalogService.resolveAttributesFromMessage(
              nextProduct,
              nextNeeds?.segment || '',
              [],
            );
            const ready = this.catalogService.applyDefaultAttributeStep(
              nextProduct,
              fromSeg.status === 'invalid' ? { status: 'invalid' } : fromSeg,
            );
            if (ready.status === 'complete') {
              const nextAdd = this.tryAddProductToCart(
                session,
                nextProduct,
                this.resolveAddQuantity(session, nextProduct, {
                  sourceText: nextNeeds?.segment,
                }),
                cfg,
                undefined,
                ready.attributes,
              );
              if (!nextAdd.missingAttributes && !nextAdd.blocked) {
                session = this.popCompletedNeedsAttribute(nextAdd.session, nextProduct.id);
                await this.conversationService.saveSession(conv, session, 'building_cart');
                const firstChosen = step.attributes.map((a) => a.attributeValue).join(', ');
                const nextChosen = ready.attributes.map((a) => a.attributeValue).join(', ');
                await this.reply(
                  conv,
                  msg.waId,
                  this.buildCartAddReply(
                    session,
                    this.deliveryFeeFor(session, cfg),
                    [
                      `${product.name} (${firstChosen})`,
                      `${nextProduct.name} (${nextChosen})`,
                    ],
                  ),
                );
                return;
              }
            }
            session = {
              ...session,
              pendingAttribute: {
                ...this.toPendingAttribute(nextProduct, {
                  // Solo el segmento del plato — NO pegar "2" (elección de arepas)
                  // o se interpreta como cantidad ×2.
                  sourceText: nextNeeds?.segment || undefined,
                }),
                selected: ready.status === 'partial' ? ready.attributes : [],
              },
            };
            await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
            const chosen = step.attributes.map((a) => a.attributeValue).join(', ');
            await this.reply(
              conv,
              msg.waId,
              `${this.buildCartAddReply(
                session,
                this.deliveryFeeFor(session, cfg),
                `${product.name} (${chosen})`,
                { suffix: '' },
              )}\n\n` +
                `Ahora elige opciones para *${nextProduct.name}*:\n\n` +
                this.catalogService.formatProductOptionsPrompt(
                  nextProduct,
                  ready.status === 'partial' ? ready.attributes : [],
                ),
            );
            return;
          }
          await this.conversationService.saveSession(conv, session, 'building_cart');
          const chosen = step.attributes.map((a) => a.attributeValue).join(', ');
          await this.reply(
            conv,
            msg.waId,
            this.buildCartAddReply(
              session,
              this.deliveryFeeFor(session, cfg),
              `${product.name} (${chosen})`,
            ),
          );
          return;
        }
        if (step.status === 'partial') {
          session.pendingAttribute = {
            ...pa,
            selected: step.attributes,
          };
          await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
          await this.reply(
            conv,
            msg.waId,
            this.catalogService.formatProductOptionsPrompt(product, step.attributes, attrOpts),
          );
          return;
        }

        if (
          await this.tryAddProductDuringPendingAttribute(
            conv,
            msg.waId,
            session,
            text,
            products,
            cfg,
            product,
          )
        ) {
          return;
        }

        // Pregunta mientras elige opción: la carta responde. El modelo viejo solo si el agente está apagado.
        if (this.looksLikeSideQuestion(text)) {
          await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
          if (this.isProductCompositionQuestion(text)) {
            await this.reply(
              conv,
              msg.waId,
              this.buildProductCompositionReply(text, product, cfg),
            );
            return;
          }
          if (!cfg.agentV1Enabled) {
            const reply = await this.answerSideQuestionWithAi({
              conv,
              session,
              text,
              products,
              cfg,
              businessOpenForBot,
              status,
              pendingProduct: product,
            });
            await this.reply(conv, msg.waId, reply);
            return;
          }
        }

        // Número o nombre de opción que no coincidió. Una frase la lee el agente.
        if (cfg.agentV1Enabled && this.looksLikeHumanIntentSentence(text)) {
          deferHumanIntentToAgent = true;
        } else {
          await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
          await this.reply(
            conv,
            msg.waId,
            `No te capté esa opción. Respóndeme con el *nombre* (medio, cuarto…) o el *número*.\n\n` +
              this.catalogService.formatProductOptionsPrompt(
                product,
                pa.selected || [],
                attrOpts,
              ),
          );
          return;
        }
      }
      if (deferHumanIntentToAgent) {
        // La selección sigue abierta. El agente lee la frase más abajo.
      } else {
      // Estado inconsistente: no interpretar el mensaje como código de producto
      session.pendingAttribute = undefined;
      await this.conversationService.saveSession(conv, session, 'building_cart');
      await this.reply(
        conv,
        msg.waId,
        'Se me fue la selección. Escribe el *plato* o el *código*.',
      );
      return;
      }
    }

    if (!cfg.agentV1Enabled && !status.isOpen && !cfg.ignoreBusinessHours) {
      await this.reply(
        conv,
        msg.waId,
        cfg.closedMessage ||
          `Ahora estamos *cerrados*. ${status.message}. ${status.subMessage ?? ''}\n\nHorario hoy: ${status.openTime}–${status.closeTime}. Cuando abramos escríbenos de nuevo para pedir.`,
      );
      return;
    }

    // Confirmación / palabras clave de flujo — ANTES de tratar el texto como nombre o dirección
    const isConfirm = this.isConfirmKeyword(text);
    const isGreeting = this.isGreetingKeyword(text);

    // Tras pedido completado: saludo / “quiero pedir” → no pasar por IA (evita rearmar carrito del historial)
    if (reopenedFreshOrder) {
      if (isGreeting || this.isVagueOrderIntent(text) || text.length < 2) {
        await this.reply(
          conv,
          msg.waId,
          `Pedido anterior listo. ¿Qué se te antoja? Escribe el *plato* o el *código*.`,
        );
        return;
      }
    }

    // En checkout, una frase la lee el agente antes de tomarla como nombre, dirección o pago.
    // Si es un pedido que ya hizo, Nest consulta el estado y no sigue el paso abierto.
    if (
      cfg.agentV1Enabled &&
      this.looksLikeHumanIntentSentence(originalText || text) &&
      conv.state !== 'building_cart' &&
      conv.state !== 'awaiting_attribute'
    ) {
      if (
        await this.tryHandleAgentV1({
          conv,
          msg,
          session,
          text,
          originalText,
          products,
          cfg,
          status,
          businessOpenForBot,
          prependFirstContactDisclaimer: isFirstInbound,
          placedOrderOnly: true,
        })
      ) {
        return;
      }
    }

    // "Nombre: Sandra Sánchez" / "Me llamo …" en cualquier paso de checkout
    if (
      !isConfirm &&
      !isGreeting &&
      (await this.tryHandleExplicitCustomerNameLabel(conv, msg.waId, session, originalText))
    ) {
      return;
    }

    // “Buenos días para pedir un domicilio” no es un nombre fallido: es el pedido.
    const deliveryKickoffWhileNaming =
      (isDeliverySetupWithoutFood(text) ||
        isDeliveryLogisticsFluff(this.stripLeadingGreeting(text))) &&
      !this.looksLikeAddressRejectingPersonName(text);

    if (conv.state === 'awaiting_name' && !isConfirm && !isGreeting && text.length >= 2) {
      if (
        await this.tryHandleCartModification(
          conv,
          msg.waId,
          session,
          text,
          products,
          cfg,
          originalText,
        )
      ) {
        return;
      }
      if (deliveryKickoffWhileNaming) {
        if (!session.cart.length) {
          await this.conversationService.saveSession(conv, session, 'building_cart');
          session = this.conversationService.getSession(conv);
        } else {
          await this.reply(
            conv,
            msg.waId,
            this.buildAskNameMessage(session, this.deliveryFeeFor(session, cfg)),
          );
          return;
        }
      } else if (
        // No usar looksLikeAddress genérico: "Josseph Arlet Pabón…" (2–7 palabras)
        // caía en el heurístico de conjunto/barrio y pedía nombre otra vez.
        this.looksLikeAddressRejectingPersonName(text) ||
        this.looksLikePayment(text, cfg.paymentMethods) ||
        this.isPickupIntent(text) ||
        this.isDeliveryIntent(text) ||
        this.looksLikePhoneNumber(text)
      ) {
        await this.reply(
          conv,
          msg.waId,
          'Primero necesito tu *nombre completo* (ej. Juan Pérez).\n' +
            'Después te pido la dirección de domicilio.',
        );
        return;
      } else if (!isUsableWhatsappCustomerName(text)) {
        await this.reply(
          conv,
          msg.waId,
          'Necesito tu *nombre real* para el pedido (ej. *Juan Pérez*).',
        );
        return;
      } else {
        await this.conversationService.updateCustomerName(conv, text);
        await this.conversationService.saveSession(conv, session, 'building_cart');
        const fresh = await this.conversationService.reloadConversation(conv.id);
        Object.assign(conv, fresh);
        session = this.conversationService.getSession(conv);
        await this.tryConfirmOrder(conv, msg.waId, session, {
          preface: `Con gusto, *${text.trim()}* ✅`,
        });
        return;
      }
    }
    if (conv.state === 'awaiting_name') {
      await this.reply(
        conv,
        msg.waId,
        this.buildAskNameMessage(session, this.deliveryFeeFor(session, cfg)),
      );
      return;
    }

    if (conv.state === 'awaiting_fulfillment' && !isConfirm && !isGreeting) {
      // Legacy: ya no preguntamos domicilio vs recojo; por defecto domicilio.
      if (this.isPickupIntent(text)) {
        session = this.applyPickupIntent(session, text);
        await this.conversationService.saveSession(conv, session, 'building_cart');
        const fresh = await this.conversationService.reloadConversation(conv.id);
        Object.assign(conv, fresh);
        session = this.conversationService.getSession(conv);
        await this.tryConfirmOrder(conv, msg.waId, session, {
          preface: `Perfecto, *pasas tú por el local* ✅`,
        });
        return;
      }
      session = {
        ...session,
        orderType: 'delivery',
        fulfillmentChosen: true,
      };
      const addrHint =
        this.extractDeliveryTail(text) ||
        (this.isPlausibleDeliveryAddress(text) ? text.trim() : null);
      if (addrHint && this.isPlausibleDeliveryAddress(addrHint)) {
        session = this.withDeliveryAddress(session, addrHint);
      }
      if (session.addressConfirmed && session.address?.trim()) {
        await this.conversationService.saveSession(conv, session, 'building_cart');
        await this.tryConfirmOrder(conv, msg.waId, session, {
          preface: `Perfecto, domicilio a *${session.address.trim()}* ✅`,
        });
        return;
      }
      await this.conversationService.saveSession(conv, session, 'awaiting_address');
      await this.reply(conv, msg.waId, this.buildAskAddressMessage(session, this.deliveryFeeFor(session, cfg)));
      return;
    }
    if (conv.state === 'awaiting_fulfillment') {
      session = { ...session, orderType: 'delivery', fulfillmentChosen: true };
      await this.conversationService.saveSession(conv, session, 'awaiting_address');
      await this.reply(conv, msg.waId, this.buildAskAddressMessage(session, this.deliveryFeeFor(session, cfg)));
      return;
    }

    if (conv.state === 'awaiting_address' && !isGreeting) {
      if (
        await this.tryHandleCartModification(
          conv,
          msg.waId,
          session,
          text,
          products,
          cfg,
          originalText,
        )
      ) {
        return;
      }
      if (this.isPickupIntent(text)) {
        session = this.applyPickupIntent(session, text);
        await this.conversationService.saveSession(conv, session, 'building_cart');
        const fresh = await this.conversationService.reloadConversation(conv.id);
        Object.assign(conv, fresh);
        session = this.conversationService.getSession(conv);
        await this.tryConfirmOrder(conv, msg.waId, session, {
          preface: `Perfecto, *pasas tú por el local* ✅`,
        });
        return;
      }
      // Confirmar dirección sugerida o última guardada (“sí” / “acá”)
      if (isReuseLastAddressIntent(text)) {
        const reuse =
          session.address?.trim() ||
          session.lastDeliveryAddress?.trim() ||
          '';
        if (reuse) {
          session = this.withDeliveryAddress(
            {
              ...session,
              orderType: 'delivery',
              fulfillmentChosen: true,
              addressConfirmed: true,
            },
            reuse,
          );
          const feeOk = await this.recalculateDeliveryFee(session, cfg);
          session = feeOk.session;
          await this.conversationService.saveSession(conv, session, 'building_cart');
          if (feeOk.blocked) {
            await this.reply(
              conv,
              msg.waId,
              `Dirección anotada: _${session.address}_\n\n${feeOk.blocked}`,
            );
            return;
          }
          const fresh = await this.conversationService.reloadConversation(conv.id);
          Object.assign(conv, fresh);
          session = this.conversationService.getSession(conv);
          await this.tryConfirmOrder(conv, msg.waId, session, {
            preface:
              `Dirección lista ✅ _${session.address}_` +
              (feeOk.notice ? `\n${feeOk.notice}` : ''),
          });
          return;
        }
      }
      if (text.length >= 6) {
        const addrHint = this.extractDeliveryTail(text) || text.trim();
        if (!this.isPlausibleDeliveryAddress(addrHint)) {
          await this.reply(
            conv,
            msg.waId,
            this.buildAskAddressMessage(session, this.deliveryFeeFor(session, cfg), true),
          );
          return;
        }
        session = this.withDeliveryAddress(
          { ...session, fulfillmentChosen: true },
          addrHint,
        );
        session = {
          ...session,
          addressConfirmed: true,
          deliveryFeeCalculated: undefined,
          deliveryDistanceKm: undefined,
          deliveryOutOfCoverage: false,
          deliveryLat: null,
          deliveryLng: null,
        };
        const feeOk = await this.recalculateDeliveryFee(session, cfg);
        session = feeOk.session;
        await this.conversationService.saveSession(conv, session, 'building_cart');
        if (feeOk.blocked) {
          await this.reply(
            conv,
            msg.waId,
            `Dirección anotada: _${session.address}_\n\n${feeOk.blocked}`,
          );
          return;
        }
        const fresh = await this.conversationService.reloadConversation(conv.id);
        Object.assign(conv, fresh);
        session = this.conversationService.getSession(conv);
        await this.tryConfirmOrder(conv, msg.waId, session, {
          preface:
            `Dirección lista ✅ _${session.address}_` +
            (feeOk.notice ? `\n${feeOk.notice}` : ''),
        });
        return;
      }
    }
    if (conv.state === 'awaiting_address') {
      await this.reply(conv, msg.waId, this.buildAskAddressMessage(session, this.deliveryFeeFor(session, cfg)));
      return;
    }

    if (conv.state === 'awaiting_phone' && !isConfirm && !isGreeting) {
      // Add-on (gaseosa…) mientras pedimos el teléfono — antes del phone handler
      if (
        await this.tryHandleCheckoutSideAdd(
          conv,
          msg.waId,
          session,
          text,
          products,
          cfg,
          'phone',
        )
      ) {
        return;
      }
      const phoneHandled = await this.tryResolvePhoneConfirmation(
        conv,
        msg.waId,
        session,
        text,
        cfg,
      );
      if (phoneHandled) return;
    }
    if (conv.state === 'awaiting_phone') {
      await this.reply(conv, msg.waId, this.buildAskPhoneMessage(conv, session, this.deliveryFeeFor(session, cfg)));
      return;
    }

    if (conv.state === 'awaiting_payment' && !isConfirm && !isGreeting) {
      if (
        await this.tryHandlePaymentCapabilityQuestion(
          conv,
          msg.waId,
          session,
          text,
          cfg,
        )
      ) {
        return;
      }
      if (await this.tryExplainPaymentMethodOption(conv, msg.waId, text, cfg)) {
        return;
      }
      if (
        await this.tryHandleCartModification(
          conv,
          msg.waId,
          session,
          text,
          products,
          cfg,
          originalText,
        )
      ) {
        return;
      }
      // "cuál es el método 4?" no debe seleccionar el método
      if (this.looksLikePaymentMethodQuestion(text)) {
        await this.reply(
          conv,
          msg.waId,
          buildPaymentOptionsPrompt(cfg.paymentMethods, cfg.paymentInstructions),
        );
        return;
      }
      const payPick = this.resolvePaymentChoice(text, cfg);
      if (payPick) {
        session.paymentMethod = payPick.id;
        session.notesCollected = true;
        await this.conversationService.saveSession(conv, session, 'confirming');
        const confirmExtra = this.buildPaymentConfirmReply(payPick, cfg);
        session = this.conversationService.getSession(conv);
        const skipFinal =
          payPick.flow === 'mercadopago' || payPick.id === 'mercadopago';
        await this.tryConfirmOrder(conv, msg.waId, session, {
          preface: confirmExtra || undefined,
          skipFinalConfirm: skipFinal,
        });
        return;
      }
    }
    if (conv.state === 'awaiting_payment') {
      if (
        await this.tryAddDishDuringPayment(
          conv,
          msg.waId,
          session,
          originalText || text,
          products,
          cfg,
        )
      ) {
        return;
      }
      await this.reply(
        conv,
        msg.waId,
        buildPaymentOptionsPrompt(cfg.paymentMethods, cfg.paymentInstructions),
      );
      return;
    }

    if (conv.state === 'awaiting_notes' && !isConfirm && !isGreeting) {
      if (
        await this.tryHandleCartModification(
          conv,
          msg.waId,
          session,
          text,
          products,
          cfg,
          originalText,
        )
      ) {
        return;
      }
      session = this.applyNotesFromText(session, text);
      await this.conversationService.saveSession(conv, session, 'confirming');
      const freshNotes = await this.conversationService.reloadConversation(conv.id);
      Object.assign(conv, freshNotes);
      session = this.conversationService.getSession(conv);
      await this.tryConfirmOrder(conv, msg.waId, session);
      return;
    }
    if (conv.state === 'awaiting_notes') {
      await this.reply(conv, msg.waId, this.buildAskNotesMessage(cfg, session));
      return;
    }

    // "listo" / "confirmar" / typos → checkout (antes de menú/cortesía/productos)
    if (isConfirm && session.cart.length > 0) {
      const fresh = await this.conversationService.reloadConversation(conv.id);
      Object.assign(conv, fresh);
      session = this.conversationService.getSession(conv);
      await this.tryConfirmOrder(conv, msg.waId, session);
      return;
    }

    // "envíame el link de Mercado Pago" → generar/reenviar preferencia (no menú)
    if (
      this.isPaymentLinkRequest(originalText) ||
      this.isPaymentLinkRequest(text)
    ) {
      if (session.cart.length > 0) {
        const mp =
          getEnabledPaymentMethods(cfg.paymentMethods).find(
            (m) => m.id === 'mercadopago' || m.flow === 'mercadopago',
          ) || findPaymentMethodByText('mercado pago', cfg.paymentMethods);
        if (cfg.allowMercadoPago && mp) {
          session = {
            ...session,
            paymentMethod: mp.id || 'mercadopago',
            notesCollected: true,
          };
          await this.conversationService.saveSession(conv, session, 'confirming');
          const freshMp = await this.conversationService.reloadConversation(conv.id);
          Object.assign(conv, freshMp);
          session = this.conversationService.getSession(conv);
          await this.tryConfirmOrder(conv, msg.waId, session, {
            preface: 'Listo, te mando el *link de Mercado Pago* 👇',
            skipFinalConfirm: true,
          });
          return;
        }
      }
      await this.reply(
        conv,
        msg.waId,
        session.cart.length
          ? 'Para el link de pago, primero escribe *confirmar* con el pedido listo.'
          : 'Arma el pedido y al *confirmar* te mando el link de Mercado Pago.',
      );
      return;
    }

    // Saludo / menú / “quiero pedir” sin producto concreto
    if (isGreeting || this.isMenuLinkIntent(text)) {
      if (this.isMenuLinkIntent(text)) {
        await this.reply(conv, msg.waId, cfg.menuLinkMessage);
        return;
      }
      // Con carrito: no reiniciar con bienvenida; retomar el pedido
      if (session.cart.length > 0) {
        await this.reply(
          conv,
          msg.waId,
          `¡Hola! 👋 Sigues con tu pedido:\n\n` +
            `${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}\n\n` +
            this.formatContinueShoppingPrompt(session),
        );
        return;
      }
      await this.reply(conv, msg.waId, this.buildWelcomeMessage(cfg));
      return;
    }

    // "Hola, para un domicilio" / "buenas quiero pedir" → quitar saludo y seguir
    // (sin reenviar bienvenida: una sola burbuja con la respuesta de contenido).
    // "Veci el arroz…" es vocativo: quitar "veci" sin bienvenida.
    {
      const withoutGreeting = this.stripLeadingGreeting(text);
      if (
        withoutGreeting !== text &&
        withoutGreeting.length >= 2 &&
        !this.isGreetingKeyword(text)
      ) {
        text = withoutGreeting;
        // (isConfirm / intents más abajo usan `text`)
      }
    }

    // "gracias" suelto → NUNCA agregar productos.
    // "listo"/"ok"/"dale" con carrito → checkout (no tragar la confirmación).
    if (this.catalogService.isCourtesyOnlyMessage(text)) {
      if (session.cart.length > 0 && this.isConfirmKeyword(text)) {
        const fresh = await this.conversationService.reloadConversation(conv.id);
        Object.assign(conv, fresh);
        session = this.conversationService.getSession(conv);
        await this.tryConfirmOrder(conv, msg.waId, session);
        return;
      }
      await this.reply(
        conv,
        msg.waId,
        this.catalogService.formatCourtesyReply(
          cfg.brandName || cfg.localContext?.restaurantName || undefined,
        ),
      );
      return;
    }

    // "Hola, quiero hacer un pedido" → preguntar qué ordenar (no listar porciones/productos).
    // Con el agente encendido, él lee esa intención primero.
    if (!cfg.agentV1Enabled && this.isVagueOrderIntent(text)) {
      // isVagueOrderIntent ya excluye frases con comida; no usar searchByName
      // (matcheaba basura y caía en “Entendí varios… _pedido_”).
      await this.reply(conv, msg.waId, this.buildAskWhatToOrderMessage(cfg));
      return;
    }

    // “¿El combo mixto es medio broaster medio frito?” → info, no 1/2 pollo
    if (
      !cfg.agentV1Enabled &&
      (await this.tryHandleMixtoCompositionInquiry(conv, msg.waId, session, text, products, cfg))
    ) {
      return;
    }

    // Con el agente encendido, el texto libre lo lee él. Este clasificador solo corre si el agente está apagado.
    if (!cfg.agentV1Enabled) {
      const classified = await this.tryApplyAiClassify(
        conv,
        msg.waId,
        session,
        text,
        originalText,
        cfg,
      );
      if (classified.handled) return;
      if (classified.text && classified.text !== text) {
        text = classified.text;
      }
      if (classified.session) {
        session = classified.session;
      }
    }

    // Varios platos en un mensaje se arman aquí, también con el agente encendido.
    // Si no, "me vendes 2 costillas / 1 mojarra" se queda solo con la mojarra.
    if (
      !session.pendingMatch &&
      !session.pendingAttribute &&
      !session.pendingMultiOrder &&
      (this.catalogService.looksLikeClearlyMultiDishOrder(text) ||
        this.catalogService.looksLikeMultiItemOrderMessage(text) ||
        this.catalogService.looksLikeClearlyMultiDishOrder(originalText) ||
        this.catalogService.looksLikeMultiItemOrderMessage(originalText))
    ) {
      const multi = this.catalogService.resolveMultiProductOrder(text, products);
      const multiClean =
        !!multi &&
        multi.ambiguous.length === 0 &&
        multi.unresolved.length === 0 &&
        multi.confident.length + multi.needsAttributes.length >= 1;
      const multiAskStyle =
        !!multi &&
        multi.unresolved.length === 0 &&
        multi.ambiguous.length > 0 &&
        multi.confident.length + multi.needsAttributes.length >= 1;
      if (
        multiAskStyle &&
        (await this.tryAskChickenStyleKeepingOthers(
          conv,
          msg.waId,
          session,
          multi!,
          text,
        ))
      ) {
        return;
      }
      if (multiClean || multiAskStyle) {
        const handled = await this.tryHandleMultiProductOrder(
          conv,
          msg.waId,
          session,
          multi!,
          cfg,
          text,
          products,
          originalText,
        );
        if (handled) return;
      }
    }

    // Pollo sin estilo ANTES del agente (evita que asuma Frito)
    if (
      !session.pendingMatch &&
      !session.pendingAttribute &&
      !session.pendingMultiOrder &&
      (await this.tryHandleChickenStyleAmbiguity(conv, msg.waId, session, text, products, cfg))
    ) {
      return;
    }

    // "menú ejecutivo" sin frito/broaster → listar esos SKUs, no asumir Frito
    if (
      !cfg.agentV1Enabled &&
      (await this.tryHandleUnspecifiedCookingStyleFamily(
        conv,
        msg.waId,
        session,
        text,
        products,
        cfg,
      ))
    ) {
      return;
    }

    if (
      await this.tryHandleQtyMenuCodes(conv, msg.waId, session, originalText || text, products, cfg)
    ) {
      return;
    }
    if (
      await this.tryHandleEachOfListed(conv, msg.waId, session, originalText || text, products, cfg)
    ) {
      return;
    }
    if (
      await this.tryHandleQtyDishCorrection(
        conv,
        msg.waId,
        session,
        originalText || text,
        products,
        cfg,
      )
    ) {
      return;
    }
    if (await this.tryHandleKitchenSendRequest(conv, msg.waId, session, originalText || text, cfg)) {
      return;
    }
    if (await this.tryHandleCartChargeQuestion(conv, msg.waId, session, originalText || text, cfg)) {
      return;
    }

    // Número o "broaster" sobre una lista ya mostrada, antes del agente.
    // Una frase ("no, yo quería el otro") no elige sola: la lee el agente.
    if (session.pendingMatch?.candidates?.length) {
      if (
        !this.looksLikeHumanIntentSentence(text) &&
        (await this.tryResolvePendingMatchPick(conv, msg.waId, session, text, products, cfg))
      ) {
        return;
      }
      session = { ...session, pendingMatch: undefined };
      await this.conversationService.saveSession(conv, session);
    }

    // "costillas der cerdo" responde la pregunta anterior, no es un plato nuevo.
    if (
      await this.tryHandlePriorOfferPick(
        conv,
        msg.waId,
        session,
        originalText || text,
        products,
        cfg,
      )
    ) {
      return;
    }

    // Categoría, "¿tienes X?" y "¿cómo es?" las responde el agente comparando el menú.
    // Si el agente está apagado o no contesta, Nest sigue con la misma carta.
    const answerMenuWithNest = async () => {
      if (
        await this.tryHandleDeterministicMenuBrowse(
          conv,
          msg.waId,
          session,
          text,
          products,
          cfg,
        )
      ) {
        return true;
      }
      if (
        await this.tryHandleProductAvailabilityQuestion(
          conv,
          msg.waId,
          session,
          text,
          products,
          cfg,
        )
      ) {
        return true;
      }
      if (
        await this.tryHandleProductCompositionQuestion(
          conv,
          msg.waId,
          text,
          products,
          cfg,
          session,
        )
      ) {
        return true;
      }
      if (
        await this.tryResolvePendingCompositionAsk(conv, msg.waId, session, text, products, cfg)
      ) {
        return true;
      }
      return false;
    };

    if (!cfg.agentV1Enabled && (await this.tryHandleDailyPromoInquiry(conv, msg.waId, text, cfg))) {
      return;
    }

    if (!cfg.agentV1Enabled && (await answerMenuWithNest())) {
      return;
    }

    // Agent V1 (feature flag): LLM + tools. Pendings numéricos / checkout ya se resolvieron arriba.
    if (
      cfg.agentV1Enabled &&
      (await this.tryHandleAgentV1({
        conv,
        msg,
        session,
        text,
        originalText,
        products,
        cfg,
        status,
        businessOpenForBot,
        prependFirstContactDisclaimer: isFirstInbound,
      }))
    ) {
      return;
    }

    if (cfg.agentV1Enabled) {
      if (
        await this.tryHandleDeliveryEtaInquiry(
          conv,
          msg.waId,
          session,
          originalText,
          text,
          cfg,
        )
      ) {
        return;
      }
      if (
        await this.tryHandleInterruptedPhoneOrderInquiry(
          conv,
          msg.waId,
          originalText,
          cfg,
        )
      ) {
        return;
      }
      if (!status.isOpen && !cfg.ignoreBusinessHours) {
        await this.reply(
          conv,
          msg.waId,
          cfg.closedMessage ||
            `Ahora estamos *cerrados*. ${status.message}. ${status.subMessage ?? ''}\n\nHorario hoy: ${status.openTime}–${status.closeTime}. Cuando abramos escríbenos de nuevo para pedir.`,
        );
        return;
      }
      if (
        this.isVagueOrderIntent(text) ||
        (session.cart.length === 0 &&
          (isDeliverySetupWithoutFood(text) || isDeliverySetupWithoutFood(originalText)))
      ) {
        await this.reply(conv, msg.waId, this.buildAskWhatToOrderMessage(cfg));
        return;
      }
    }

    if (cfg.agentV1Enabled && (await answerMenuWithNest())) {
      return;
    }

    // El agente no resolvió la frase. Nest ejecuta lo que la carta, el carrito y la config permiten.
    if (cfg.agentV1Enabled) {
      if (
        await this.tryHandleCartItemReplacement(
          conv,
          msg.waId,
          session,
          originalText,
          products,
          cfg,
        )
      ) {
        return;
      }
      if (
        await this.tryHandleInlineOrderNoteEarly(
          conv,
          msg.waId,
          session,
          originalText,
          customerIntent,
          cfg,
          products,
        )
      ) {
        return;
      }
      if (await this.tryHandleAddressChange(conv, msg.waId, session, originalText, cfg)) {
        return;
      }
      if (
        await this.tryHandleAddressClarification(conv, msg.waId, session, originalText, cfg)
      ) {
        return;
      }
      if (
        await this.tryHandleConfirmCurrentAddress(
          conv,
          msg.waId,
          session,
          originalText,
          cfg,
        )
      ) {
        return;
      }
      if (
        await this.tryAppendUnitDetailsToAddress(
          conv,
          msg.waId,
          session,
          originalText,
          cfg,
        )
      ) {
        return;
      }
      if (
        await this.tryAppendDeliveryAccessReference(
          conv,
          msg.waId,
          session,
          originalText,
          cfg,
        )
      ) {
        return;
      }
      if (
        !this.isPickupIntent(originalText) &&
        !this.isPickupIntent(text) &&
        (customerIntent === 'address' ||
          isReuseLastAddressIntent(originalText) ||
          looksLikeAddressOnlyMessage(originalText, {
            compoundAddress: compound.address,
            compoundProductText: compound.productText,
          })) &&
        (await this.tryHandleAddressOnlyWhileBuildingCart(
          conv,
          msg.waId,
          session,
          originalText,
          compound,
          cfg,
        ))
      ) {
        return;
      }
      if (
        session.cart.length > 0 &&
        (this.isPickupIntent(originalText) || this.isPickupIntent(text))
      ) {
        session = this.applyPickupIntent(session, text || originalText);
        await this.conversationService.saveSession(conv, session, 'building_cart');
        await this.reply(
          conv,
          msg.waId,
          `Listo, queda como *recoger en el local* (sin domicilio).\n_${session.address}_`,
        );
        const freshPu = await this.conversationService.reloadConversation(conv.id);
        Object.assign(conv, freshPu);
        session = this.conversationService.getSession(conv);
        await this.tryConfirmOrder(conv, msg.waId, session);
        return;
      }
      if (
        await this.tryHandleCartModification(
          conv,
          msg.waId,
          session,
          text,
          products,
          cfg,
          originalText,
        )
      ) {
        return;
      }
      if (await this.tryHandleDeliveryRangeQuestion(conv, msg.waId, originalText, cfg)) {
        return;
      }
      if (await this.tryHandleBusinessServiceInquiry(conv, msg.waId, originalText, cfg)) {
        return;
      }
      if (await this.tryHandleCoverageInquiry(conv, msg.waId, session, originalText, cfg)) {
        return;
      }
      if (
        await this.tryHandleComboAvailabilityQuestion(conv, msg.waId, session, text, products, cfg)
      ) {
        return;
      }
      if (
        await this.tryHandleMixtoCompositionInquiry(conv, msg.waId, session, text, products, cfg)
      ) {
        return;
      }
      if (await this.tryHandleDailyPromoInquiry(conv, msg.waId, text, cfg)) {
        return;
      }
      if (
        await this.tryHandleUnspecifiedCookingStyleFamily(
          conv,
          msg.waId,
          session,
          text,
          products,
          cfg,
        )
      ) {
        return;
      }
    }

    // El agente ya leyó la frase. Si no la resolvió, Nest cambia la opción del carrito.
    if (
      await this.tryHandleDishStyleSubstitutionInquiry(conv, msg.waId, session, text, products, cfg)
    ) {
      return;
    }
    if (await this.tryHandleCartAttributeOptionChange(conv, msg.waId, session, text, products)) {
      return;
    }

    // Pedido Rappi / Uber Eats: no se gestiona por este chat
    if (this.catalogService.isExternalMarketplaceOrderMessage(text)) {
      await this.reply(
        conv,
        msg.waId,
        'Ese pedido por *Rappi/Uber* no lo podemos cambiar desde este WhatsApp 🙏\n' +
          `Para cambios de sabor/gaseosa toca el chat del domicilio en la app. ${this.humanContactMessage()}`,
      );
      return;
    }

    // Charla fuera del pedido (cuentos, programar, etc.) → no buscar platos
    if (this.catalogService.isOffTopicChitchat(text)) {
      await this.reply(
        conv,
        msg.waId,
        this.catalogService.formatOffTopicRedirect(
          cfg.brandName || cfg.localContext?.restaurantName || undefined,
        ),
      );
      return;
    }

    // "dónde queda el restaurante" → ubicación del local (no productos con "res")
    if (this.catalogService.isRestaurantLocationInquiry(text)) {
      await this.reply(conv, msg.waId, this.formatRestaurantLocationReply(cfg));
      return;
    }

    // Explorar menú / "qué ofreces de carne" / categoría suelta ("Pollo") → listar
    // (también corre antes del agente; aquí queda si el agente no tomó el turno)
    if (
      await this.tryHandleDeterministicMenuBrowse(
        conv,
        msg.waId,
        session,
        text,
        products,
        cfg,
      )
    ) {
      return;
    }

    const pendingPickHandled = await this.tryResolvePendingMatchPick(
      conv,
      msg.waId,
      session,
      text,
      products,
      cfg,
    );
    if (pendingPickHandled) return;

    // Cancelar selección pendiente (lista / atributos / multi) con respuesta clara
    if (
      await this.tryAbandonPendingSelection(conv, msg.waId, session, text, cfg)
    ) {
      return;
    }

    // "Cambia la dirección a …" / rechazo (si no se manejó arriba)
    if (await this.tryHandleAddressChange(conv, msg.waId, session, text, cfg)) {
      return;
    }

    const abandoned = this.tryAbandonStalePendingState(session, text, products);
    if (abandoned) {
      session = abandoned;
      await this.conversationService.saveSession(conv, session);
    }

    if (session.pendingMultiOrder) {
      const multiHandled = await this.tryResolvePendingMultiOrder(
        conv,
        msg.waId,
        session,
        text,
        products,
        cfg,
      );
      if (multiHandled) return;
    }

    if (
      await this.tryHandlePendingAddOffer(conv, msg.waId, session, text, products, cfg)
    ) {
      return;
    }

    if (
      await this.tryHandlePaymentCapabilityQuestion(conv, msg.waId, session, text, cfg)
    ) {
      return;
    }

    if (session.pendingCategoryBrowse?.categories?.length) {
      const qtyHere = this.catalogService.extractQuantityFromMessage(text);
      const looksLikeFoodOrder =
        qtyHere >= 2 ||
        (/\b(quiero|dame|ponme|agrega)\b/i.test(text) &&
          /\b(mojarra|pollo|sopa|pechuga|bandeja|alitas?|arepa|broaster|frito)\b/i.test(text));
      const pickedCategory = looksLikeFoodOrder
        ? null
        : this.catalogService.resolveCategoryBrowsePick(
            text,
            session.pendingCategoryBrowse.categories,
          );
      if (pickedCategory) {
        const catProducts = products.filter(
          (p) => p.categoryName === pickedCategory && p.availableNow !== false,
        );
        session = {
          ...session,
          pendingCategoryBrowse: undefined,
          pendingMatch: { query: pickedCategory, candidates: catProducts },
        };
        await this.conversationService.saveSession(conv, session);
        await this.reply(
          conv,
          msg.waId,
          this.catalogService.formatCategoryList(pickedCategory, catProducts),
        );
        return;
      }
      // Pedido concreto con browse pendiente → soltar categorías y seguir al match de producto
      if (looksLikeFoodOrder) {
        session = { ...session, pendingCategoryBrowse: undefined };
      }
    }

    // Cambio de categoría solo si NO hay producto concreto claro
    {
      const productQueryEarly = this.catalogService.extractProductSearchQuery(text);
      const qCheck = productQueryEarly || text;
      const orderNoise = new Set([
        'quiero', 'dame', 'ponme', 'pedir', 'ordenar', 'agrega', 'necesito', 'una', 'uno',
        'por', 'favor', 'gracias',
      ]);
      const significant = qCheck
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .split(/\s+/)
        .filter((t) => t.length >= 3 && !orderNoise.has(t) && !/^\d+$/.test(t));
      const earlyQty = this.catalogService.extractQuantityFromMessage(text);
      const earlyScored = this.catalogService.searchByNameScored(
        this.catalogService.stripQuantityFromSearchQuery(qCheck) || qCheck,
        products,
        5,
      );
      const looksSpecificDish =
        significant.length >= 2 ||
        (significant.length === 1 &&
          (this.catalogService.isStrongProductMatch(earlyScored) ||
            earlyScored[0]?.score >= 40));
      const hasConcreteProduct =
        earlyQty >= 2 ||
        (looksSpecificDish &&
          (this.catalogService.isStrongProductMatch(earlyScored) ||
            earlyScored[0]?.score >= 40 ||
            !!this.catalogService.findProductEmbeddedInMessage(text, products)));
      if (!hasConcreteProduct) {
        const categorySwitch = await this.tryHandleCategoryBrowse(
          conv,
          msg.waId,
          session,
          products,
          text,
          cfg.menuConceptGroups,
        );
        if (categorySwitch === null) return;
        session = categorySwitch;
      }
    }

    // Pickup / delivery explícito (antes de códigos: "paso en 15 minutos" ≠ código 15)
    if (this.isPickupIntent(text)) {
      session = this.applyPickupIntent(session, text);
      await this.conversationService.saveSession(conv, session, 'building_cart');
      if (session.cart.length > 0) {
        await this.reply(
          conv,
          msg.waId,
          `Listo, queda como *recoger en el local* (sin domicilio).\n_${session.address}_`,
        );
        const fresh = await this.conversationService.reloadConversation(conv.id);
        Object.assign(conv, fresh);
        session = this.conversationService.getSession(conv);
        await this.tryConfirmOrder(conv, msg.waId, session);
      } else {
        await this.reply(
          conv,
          msg.waId,
          `Dale, queda *recoger*. ¿Qué se te antoja? Escribe el *plato* o el *código*.`,
        );
      }
      return;
    }

    // "Tienes domicilio?" → FAQ (sí), no arrancar checkout vacío
    if (isDeliveryAvailabilityFaq(originalText) || isDeliveryAvailabilityFaq(text)) {
      session = {
        ...session,
        orderType: 'delivery',
        fulfillmentChosen: true,
      };
      await this.conversationService.saveSession(conv, session, 'building_cart');
      await this.reply(
        conv,
        msg.waId,
        'Sí, hacemos *domicilio* ✅ ¿Qué se te antoja? Escribe el *plato* o el *código*.',
      );
      return;
    }

    // "Quiero un domicilio / para Bosques de Castilla" (sin platos) — antes de multi/menú
    if (
      await this.tryHandleDeliverySetup(
        conv,
        msg.waId,
        session,
        originalText,
        text,
        cfg,
      )
    ) {
      return;
    }

    // Solo celular (carrito vacío): anotar y pedir plato — NUNCA saltar a pago
    if (
      session.cart.length === 0 &&
      this.isPhoneOnlyCustomerMessage(originalText) &&
      !this.isConfirmKeyword(text)
    ) {
      const digits = (originalText || text).replace(/\D/g, '');
      const normalized =
        this.normalizeContactPhone(originalText || text, conv.phoneE164) ||
        (digits.length >= 10 ? `+57${digits.slice(-10)}` : null);
      if (normalized) {
        session = {
          ...session,
          contactPhone: normalized,
          phoneConfirmed: true,
        };
        await this.conversationService.saveSession(conv, session, 'building_cart');
        await this.reply(
          conv,
          msg.waId,
          `Celular *${this.formatWaPhoneDisplay(normalized)}* ✅ ¿Qué se te antoja? Escribe el *plato* o el *código*.`,
        );
        return;
      }
    }

    // Celular con carrito: guardar contacto y seguir checkout (nombre/pago…)
    if (
      session.cart.length > 0 &&
      this.isPhoneOnlyCustomerMessage(originalText) &&
      !this.isConfirmKeyword(text)
    ) {
      const digits = (originalText || text).replace(/\D/g, '');
      const normalized =
        this.normalizeContactPhone(originalText || text, conv.phoneE164) ||
        (digits.length >= 10 ? `+57${digits.slice(-10)}` : null);
      if (normalized) {
        session = {
          ...session,
          contactPhone: normalized,
          phoneConfirmed: true,
        };
        await this.conversationService.saveSession(conv, session, 'building_cart');
        await this.tryConfirmOrder(conv, msg.waId, session, {
          preface: `Perfecto, anoté el teléfono *${this.formatWaPhoneDisplay(normalized)}* ✅`,
        });
        return;
      }
    }

    if (this.isDeliveryIntent(text) && !this.looksLikeAddress(text)) {
      session = {
        ...session,
        orderType: 'delivery',
        fulfillmentChosen: true,
        addressConfirmed: false,
      };
      if (/^recoge en el local/i.test(session.address || '')) {
        session.address = undefined;
      }
      // "Para un domicilio de un arroz con pollo" → marcar domicilio y SEGUIR al matcher
      const alsoOrdersFood =
        FOOD_ORDER_SIGNAL_RE.test(text) ||
        FOOD_ORDER_SIGNAL_RE.test(originalText) ||
        this.catalogService.looksLikeExplicitAddProductRequest(text) ||
        this.catalogService.looksLikeExplicitAddProductRequest(originalText);
      if (alsoOrdersFood) {
        await this.conversationService.saveSession(conv, session, 'building_cart');
        // no return: el flujo normal agrega el plato
      } else if (session.cart.length === 0) {
        // Sin carrito: solo anotar domicilio y preguntar qué ordenar (NO pedir nombre aún)
        await this.conversationService.saveSession(conv, session, 'building_cart');
        await this.reply(
          conv,
          msg.waId,
          this.formatDeliverySetupEmptyCartReply(),
        );
        return;
      } else {
        await this.conversationService.saveSession(conv, session);
        if (!session.address?.trim()) {
          await this.conversationService.saveSession(conv, session, 'awaiting_address');
          await this.reply(
            conv,
            msg.waId,
            `Con gusto, voy a tomar tu pedido a *domicilio*.\n\n` +
              this.buildAskAddressMessage(session, this.deliveryFeeFor(session, cfg)),
          );
          return;
        }
        if (session.address?.trim() && !session.addressConfirmed) {
          await this.conversationService.saveSession(conv, session, 'awaiting_address');
          await this.reply(
            conv,
            msg.waId,
            this.buildAskAddressMessage(session, this.deliveryFeeFor(session, cfg)),
          );
          return;
        }
        await this.reply(conv, msg.waId, 'Con gusto, voy a tomar tu pedido a *domicilio*.');
        return;
      }
    }

    // Precio + pedido ANTES de código de menú (evita que "38 y precio del pollo" solo cotice/añada mal)
    {
      const splitEarly = this.splitPriceAndOrderParts(text);
      if (
        splitEarly &&
        !session.pendingAttribute &&
        !session.pendingMultiOrder
      ) {
        await this.tryHandleProductInfoInquiry(
          conv,
          msg.waId,
          splitEarly.priceText,
          products,
          cfg,
        );
        text = splitEarly.orderText;
        // originalText sigue teniendo todo; matching de productos usa `text`
      }
    }

    const codeRaw = this.catalogService.extractCodeFromMessage(text);
    // "1" suelto con carrito ≠ código #1 (suele ser qty “una” tras “¿una o dos?”)
    const bareSingleDigit = /^\d$/.test(text.trim());
    const code =
      codeRaw != null &&
      bareSingleDigit &&
      session.cart.length > 0 &&
      !session.pendingMatch?.candidates?.length &&
      !session.pendingAttribute &&
      conv.state !== 'awaiting_attribute' &&
      !session.pendingCategoryBrowse?.categories?.length
        ? null
        : codeRaw;
    const listPick = this.catalogService.extractListPickNumber(text);
    const bareOptionNumber = listPick != null;
    const hasPendingList =
      !!session.pendingMatch?.candidates?.length ||
      !!session.pendingCategoryBrowse?.categories?.length ||
      !!session.pendingAttribute ||
      conv.state === 'awaiting_attribute' ||
      !!session.pendingCartRemoval?.options?.length;
    const pendingListIndex =
      bareOptionNumber &&
      !!session.pendingMatch?.candidates?.length &&
      listPick != null &&
      listPick >= 1 &&
      listPick <= session.pendingMatch.candidates.length;
    // "5 pollos" / "quiero 3 mojarras" → no tratar el dígito como código de menú
    const qtyInText = this.catalogService.extractQuantityFromMessage(text);
    const qtyLooksLikeOrder =
      qtyInText >= 2 &&
      /\b(pollos?|sopas?|bandejas?|platos?|unidades?|combos?|gaseosas?|broaster|fritos?|mojarras?|pechugas?|alitas?|arepas?|carnes?|ejecutivos?|churrascos?)\b/i.test(
        text,
      );
    // Lista pendiente: fila 1..N; si el número es código de menú (99) o fuera de rango, sí buscar por código
    const codeMatchesPendingCandidate =
      code != null &&
      !!session.pendingMatch?.candidates?.some((c) => Number(c.code) === code);
    const codeOutsideListRange =
      code != null &&
      !!session.pendingMatch?.candidates?.length &&
      code > session.pendingMatch.candidates.length;
    const allowCodeDespiteList =
      !hasPendingList ||
      codeMatchesPendingCandidate ||
      codeOutsideListRange ||
      (!!session.pendingMatch?.candidates?.length &&
        listPick != null &&
        listPick > session.pendingMatch.candidates.length);
    // "CRA 80b #2-38" / dirección suelta: nunca pedir 1/2 pollo por la placa
    const codeLooksLikeStreetAddress =
      looksLikeAddressOnlyMessage(text) ||
      looksLikeAddressOnlyMessage(originalText) ||
      this.isAddressOnlyCustomerMessage(originalText) ||
      this.isAddressOnlyCustomerMessage(text);
    if (
      code != null &&
      !pendingListIndex &&
      allowCodeDespiteList &&
      !qtyLooksLikeOrder &&
      !codeLooksLikeStreetAddress
    ) {
      const found = this.catalogService.findByCode(code, products);
      if (found) {
        // "Código 38 y un pollo frito qué precio tiene"
        let skipCodeAdd = false;
        if (this.catalogService.isPriceInquiryIntent(text)) {
          const split = this.splitPriceAndOrderParts(text);
          if (split) {
            await this.tryHandleProductInfoInquiry(
              conv,
              msg.waId,
              split.priceText,
              products,
              cfg,
            );
            text = split.orderText;
            const code2 = this.catalogService.extractCodeFromMessage(text);
            if (code2 == null || code2 !== code) {
              skipCodeAdd = true;
            }
          } else {
            if (await this.tryHandleProductInfoInquiry(conv, msg.waId, text, products, cfg)) {
              return;
            }
            await this.reply(conv, msg.waId, this.catalogService.formatProductPriceReply(found));
            return;
          }
        }
        if (!skipCodeAdd) {
        // Qty: texto explícito ("3 sopas") > hint sticky ("Pediste 2")
        const qtyExplicit = this.catalogService.extractQuantityFromMessage(
          `${originalText}\n${text}`,
        );
        const qtyForCode =
          qtyExplicit >= 2
            ? Math.min(30, qtyExplicit)
            : session.pendingQuantityHint?.quantity &&
                session.pendingQuantityHint.quantity >= 2
              ? Math.min(30, session.pendingQuantityHint.quantity)
              : 1;
        // Mismo SKU ya en carrito y el mensaje no pide "otro/más": no apilar +1
        const alreadyInCart = session.cart.some((c) => c.productId === found.id);
        const wantsExtra =
          /\b(otro|otra|otros|otras|mas|m[aá]s|tambi[eé]n|agrega|agreg[aá]me|suma|sumame)\b/i.test(
            text,
          );
        if (alreadyInCart && !wantsExtra) {
          session = { ...session, pendingMatch: undefined };
          session = this.clearQuantityHint(session);
          await this.conversationService.saveSession(conv, session, 'building_cart');
          await this.reply(
            conv,
            msg.waId,
            `*${found.name}* ya está en tu carrito ✅\n\n` +
              `${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}\n\n` +
              this.formatContinueShoppingPrompt(session),
          );
          return;
        }
        session = this.applyDeliveryHintFromMessage(session, text);
        if (found.availableNow === false) {
          await this.reply(conv, msg.waId, `*${found.name}* no está disponible en este horario. ¿Probamos con otro?`);
          return;
        }
        if (found.hasAttributes && found.attributes?.length) {
          if (await this.handleProductWithVariants(conv, msg.waId, session, found, text, cfg)) {
            return;
          }
        }
        const added = this.tryAddProductToCart(
          session,
          found,
          qtyForCode,
          cfg,
          undefined,
          undefined,
          {
            sourceText: text,
          },
        );
        if (added.blocked) {
          await this.conversationService.saveSession(conv, session);
          await this.handleCartLimitBlocked(conv, msg.waId, added.blocked, cfg);
          return;
        }
        if (added.alreadyHad && qtyForCode <= 1) {
          await this.conversationService.saveSession(conv, session, 'building_cart');
          await this.reply(
            conv,
            msg.waId,
            `Listo, dejamos *${found.name}* como está ✅\n\n` +
              `${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}\n\n` +
              this.formatContinueShoppingPrompt(session),
          );
          return;
        }
        session = this.clearQuantityHint(added.session);
        await this.conversationService.saveSession(
          conv,
          { ...session, pendingMatch: undefined },
          'building_cart',
        );
        const desc = found.description ? `\n_${found.description}_` : '';
        const freshAddr = this.extractDeliveryTail(text);
        const addrLine = freshAddr
          ? `\nDomicilio anotado: _${freshAddr}_`
          : '';
        const qtyNote = qtyForCode > 1 ? ` ×${qtyForCode}` : '';
        await this.reply(
          conv,
          msg.waId,
          this.buildCartAddReply(
            session,
            this.deliveryFeeFor(session, cfg),
            `${found.name}${qtyNote}`,
            {
              extraLine:
                [desc || undefined, addrLine || undefined].filter(Boolean).join('') ||
                undefined,
            },
          ),
        );
        return;
        }
      }
      await this.reply(conv, msg.waId, `No hallé un producto activo con código *${code}*. ¿Lo buscamos por nombre?`);
      return;
    }

    if (this.isConfirmKeyword(text)) {
      // Recargar sesión desde DB (fuente de verdad del carrito)
      const fresh = await this.conversationService.reloadConversation(conv.id);
      Object.assign(conv, fresh);
      session = this.conversationService.getSession(conv);
      await this.tryConfirmOrder(conv, msg.waId, session);
      return;
    }

    if (
      conv.state === 'building_cart' &&
      session.cart.length > 0 &&
      !session.pendingMatch &&
      !session.pendingAttribute &&
      this.looksLikeStandaloneOrderNote(text)
    ) {
      const applied = this.applyInlineOrderNote(session, text);
      session = applied.session;
      await this.conversationService.saveSession(conv, session);
      const ack = this.formatInlineNoteAck(session, applied.notedItemIndex);
      await this.reply(
        conv,
        msg.waId,
        `${ack}\n\n${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}\n\n${this.formatContinueShoppingPrompt(session)}`,
      );
      return;
    }

    if (
      await this.tryHandlePaymentCapabilityQuestion(conv, msg.waId, session, text, cfg)
    ) {
      return;
    }

    if (
      !isPaymentCapabilityQuestion(text) &&
      (/\b(contraentrega|efectivo|cash|transferencia|nequi|daviplata|llave|mercadopago|mercado\s*pago)\b/.test(
        lower,
      ) ||
        findPaymentMethodByText(text, cfg.paymentMethods))
    ) {
      const payPick = this.resolvePaymentChoice(text, cfg);
      if (payPick) {
        session.paymentMethod = payPick.id;
        await this.conversationService.saveSession(conv, session, 'confirming');
        const confirmExtra = this.buildPaymentConfirmReply(payPick, cfg);
        if (confirmExtra) {
          await this.reply(conv, msg.waId, confirmExtra);
        }
        const fresh = await this.conversationService.reloadConversation(conv.id);
        Object.assign(conv, fresh);
        session = this.conversationService.getSession(conv);
        const skipFinal =
          payPick.flow === 'mercadopago' || payPick.id === 'mercadopago';
        await this.tryConfirmOrder(conv, msg.waId, session, {
          skipFinalConfirm: skipFinal,
        });
        return;
      }
    }

    // "¿Qué hay de almuerzo?" ya se maneja arriba (antes de matching)

    // "¿Qué significa en combo y cuánto?" → explicar presentaciones, no agregar
    if (
      !session.pendingAttribute &&
      !session.pendingMultiOrder &&
      this.catalogService.isComboMeaningInquiry(text) &&
      (await this.tryHandleComboExplanation(conv, msg.waId, session, text, products))
    ) {
      return;
    }

    // Precio + pedido en el mismo turno ("¿precio pollo?\nY dos sopas"): responde precio y sigue con el pedido
    {
      const split = this.splitPriceAndOrderParts(text);
      if (
        split &&
        !session.pendingAttribute &&
        !session.pendingMultiOrder &&
        (await this.tryHandleProductInfoInquiry(conv, msg.waId, split.priceText, products, cfg))
      ) {
        text = split.orderText;
      } else if (
        !session.pendingAttribute &&
        !session.pendingMultiOrder &&
        (await this.tryHandleProductInfoInquiry(conv, msg.waId, text, products, cfg))
      ) {
        return;
      }
    }

    // "Te mando la dirección" / cortesía + anuncio ≠ multi platos
    if (isUpcomingAddressIntent(text) || isUpcomingAddressIntent(originalText || text)) {
      if (
        await this.tryHandleUpcomingAddressIntent(conv, msg.waId, session, text, cfg)
      ) {
        return;
      }
    }

    // "pollo frito con gaseosa" → preferir Combo De Pollo Frito (trae bebida)
    if (
      !session.pendingMatch &&
      !session.pendingAttribute &&
      !session.pendingMultiOrder &&
      (await this.tryPreferChickenComboForFoodDrink(conv, msg.waId, session, text, products, cfg))
    ) {
      return;
    }

    // "Una Coca-Cola 400" → gaseosa de la carta, no "no manejamos"
    if (
      !session.pendingMatch &&
      !session.pendingAttribute &&
      !session.pendingMultiOrder &&
      (await this.tryHandleStandaloneDrink(
        conv,
        msg.waId,
        session,
        originalText || text,
        products,
        cfg,
      ))
    ) {
      return;
    }

    // Varios platos en un mensaje ("sopa de mondongo, cuarto de pollo y costillas")
    if (!session.pendingMatch && !session.pendingAttribute && !session.pendingMultiOrder) {
      const dishQuery = (
        this.catalogService.extractProductSearchQuery(originalText || text) ||
        text
      )
        .replace(/^(?:y|tambien|también)\s+/i, '')
        .trim();
      if (
        dishQuery &&
        !this.catalogService.isAvailabilityInquiry(text) &&
        !this.catalogService.isProductDescriptionInquiry(text) &&
        !this.catalogService.isPriceInquiryIntent(text) &&
        this.catalogService.shouldOfferMenuDrinks(originalText || text, products)
      ) {
        await this.reply(
          conv,
          msg.waId,
          this.catalogService.formatMenuDrinksOffer(dishQuery, products),
        );
        return;
      }
      const multiSentence =
        this.catalogService.looksLikeClearlyMultiDishOrder(originalText || text) ||
        this.catalogService.looksLikeMultiItemOrderMessage(originalText || text) ||
        this.catalogService.looksLikeClearlyMultiDishOrder(text) ||
        this.catalogService.looksLikeMultiItemOrderMessage(text);
      const styleMiss = this.catalogService.formatMissingStyleOffer(
        originalText || text,
        products,
      );
      if (
        !multiSentence &&
        styleMiss &&
        !this.catalogService.isAvailabilityInquiry(text) &&
        !this.catalogService.isProductDescriptionInquiry(text) &&
        !this.catalogService.isPriceInquiryIntent(text)
      ) {
        await this.reply(conv, msg.waId, styleMiss);
        return;
      }
      const swapChange = this.catalogService.swapIntent(originalText || text);
      if (
        !swapChange &&
        !multiSentence &&
        dishQuery &&
        !this.catalogService.isAvailabilityInquiry(text) &&
        !this.catalogService.isProductDescriptionInquiry(text) &&
        !this.catalogService.isPriceInquiryIntent(text) &&
        this.catalogService.uncoveredDishWords(dishQuery, products).length
      ) {
        await this.reply(
          conv,
          msg.waId,
          this.catalogService.formatNotOnMenuReply(dishQuery, cfg.menuUrl),
        );
        return;
      }

      const multi = this.catalogService.resolveMultiProductOrder(originalText || text, products);
      if (multi) {
        const handled = await this.tryHandleMultiProductOrder(
          conv,
          msg.waId,
          session,
          multi,
          cfg,
          text,
          products,
          originalText,
        );
        if (handled) return;
      }
    }

    if (
      !session.pendingMatch &&
      !session.pendingAttribute &&
      !session.pendingMultiOrder &&
      (await this.tryHandleVariantPreferenceChange(conv, msg.waId, session, text, products, cfg))
    ) {
      return;
    }

    if (
      !session.pendingMatch &&
      !session.pendingMultiOrder &&
      (await this.tryHandleServingSizeChange(conv, msg.waId, session, text, products, cfg))
    ) {
      return;
    }

    if (
      (await this.tryHandleLargerPackInquiry(conv, msg.waId, session, text, products, cfg))
    ) {
      return;
    }

    if (
      await this.tryReplySimilarNamedOffer(conv, msg.waId, text, products)
    ) {
      return;
    }

    // "un pollo" / "medio pollo" / "combo de pollo" sin frito|broaster → preguntar estilo
    if (
      !session.pendingMatch &&
      !session.pendingAttribute &&
      !session.pendingMultiOrder &&
      (await this.tryHandleChickenStyleAmbiguity(conv, msg.waId, session, text, products, cfg))
    ) {
      return;
    }

    // Título embebido / pollo con tamaño / "arroz con pollo"
    let orderQty = this.resolveOrderQuantity(session, text);
    if (orderQty >= 2) {
      session = this.rememberQuantityHint(session, text, orderQty);
    }
    const embeddedProductRaw =
      this.catalogService.findProductEmbeddedInMessage(text, products) ||
      this.catalogService.resolveSizedChickenProduct(text, products);
    // Si el plato tiene presentaciones (arroz chino caja/medio/costillas…),
    // no agregar la base a ciegas: usar precio ("de 56 mil") o listar variantes.
    let embeddedProduct = embeddedProductRaw;
    if (embeddedProductRaw) {
      const family = this.catalogService.findProductVariantFamily(text, products, [
        embeddedProductRaw,
      ]);
      if (family && family.variants.length >= 2) {
        const picked = this.catalogService.pickVariantFromFamilyText(text, family);
        if (picked) {
          embeddedProduct = picked;
        } else {
          embeddedProduct = null;
        }
      }
    }
    if (
      embeddedProduct &&
      !this.catalogService.isLikelySideOnlyProduct(embeddedProduct) &&
      !this.catalogService.isProductDescriptionInquiry(text) &&
      !this.catalogService.isPriceInquiryIntent(text) &&
      !this.catalogService.isAvailabilityInquiry(text) &&
      !this.catalogService.isDishStyleSubstitutionInquiry(text) &&
      !this.catalogService.isGenericProductInquiry(text) &&
      !this.catalogService.isServingSizeChangeIntent(text) &&
      !this.catalogService.isLargerPackInquiry(text) &&
      !this.catalogService.isExternalMarketplaceOrderMessage(text) &&
      !looksLikeExplicitCartItemNote(text) &&
      !this.looksLikeStandaloneOrderNote(text) &&
      !this.catalogService.isCategoryBrowseQuestion(text) &&
      !this.catalogService.isMenuExploreIntent(text, products) &&
      !session.pendingMatch &&
      !session.pendingAttribute &&
      !(
        this.catalogService.looksLikeFoodPlusDrinkOrder(text) &&
        this.catalogService.isLikelyDrinkProduct(embeddedProduct)
      ) &&
      !this.catalogService.looksLikeMultiItemOrderMessage(text) &&
      !this.catalogService.looksLikeClearlyMultiDishOrder(text)
    ) {
      const deliveryTail =
        this.extractDeliveryTail(originalText) || this.extractDeliveryTail(text);
      if (deliveryTail) {
        session = this.withDeliveryAddress(session, deliveryTail);
        const feeEarly = await this.ensureDeliveryFeeQuoted(session, cfg);
        session = feeEarly.session;
        if (feeEarly.blocked) {
          await this.conversationService.saveSession(conv, session);
          await this.reply(conv, msg.waId, feeEarly.blocked);
          return;
        }
      }
      if (embeddedProduct.hasAttributes && embeddedProduct.attributes?.length) {
        if (await this.handleProductWithVariants(conv, msg.waId, session, embeddedProduct, text, cfg)) {
          return;
        }
      }
      const lineNote = this.catalogService.extractProductModificationNote(text) || undefined;
      const embeddedAdd = this.tryAddProductToCart(
        session,
        embeddedProduct,
        orderQty,
        cfg,
        lineNote,
        undefined,
        { sourceText: text },
      );
      if (embeddedAdd.blocked) {
        await this.conversationService.saveSession(conv, session);
        await this.handleCartLimitBlocked(conv, msg.waId, embeddedAdd.blocked, cfg);
        return;
      }
      if (embeddedAdd.alreadyHad) {
        await this.conversationService.saveSession(conv, session, 'building_cart');
        await this.reply(
          conv,
          msg.waId,
          `Listo, dejamos *${embeddedProduct.name}* como está ✅\n\n` +
            `${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}\n\n` +
            this.formatContinueShoppingPrompt(session),
        );
        return;
      }
      session = this.clearQuantityHint(embeddedAdd.session);
      await this.conversationService.saveSession(conv, session, 'building_cart');
      const qtyNote = orderQty > 1 ? ` _(x${orderQty})_` : '';
      await this.reply(
        conv,
        msg.waId,
        this.buildCartAddReply(session, this.deliveryFeeFor(session, cfg), `${embeddedProduct.name}${qtyNote}`, {
          extraLine: [
            lineNote ? `📝 _${lineNote}_` : '',
            embeddedProduct.description && !lineNote ? `_${embeddedProduct.description}_` : '',
            deliveryTail ? `\nDomicilio anotado: _${deliveryTail}_` : '',
          ]
            .filter(Boolean)
            .join('\n'),
        }),
      );
      return;
    }

    const productQueryRaw = this.catalogService.extractProductSearchQuery(text);
    const productQueryStrippedMods =
      this.catalogService.stripProductModificationNoise(productQueryRaw) || productQueryRaw;
    const productQuery =
      orderQty > 1
        ? this.catalogService.stripQuantityFromSearchQuery(productQueryStrippedMods) ||
          productQueryStrippedMods
        : productQueryStrippedMods;
    let nameScored = this.mergeNameScores(
      this.catalogService.searchByNameScored(productQuery, products, 8),
      productQuery === text
        ? []
        : this.catalogService.searchByNameScored(text, products, 8),
    );
    // "2 sopas de ajiaco pequeñas" → forzar SKU chico antes del ranking genérico
    const sizedSoup = this.catalogService.resolveSizedSoupProduct(text, products);
    if (sizedSoup) {
      nameScored = [
        { p: sizedSoup, score: 200 },
        ...nameScored.filter((x) => x.p.id !== sizedSoup.id),
      ];
    }
    const nameMatches = nameScored.map((x) => x.p);
    const strongProduct = this.catalogService.isStrongProductMatch(nameScored);
    const uniqueNameMatches = this.catalogService.dedupeProductsById(nameMatches);

    if (
      !session.pendingMatch &&
      (await this.tryHandleVariantFamily(conv, msg.waId, session, text, products, cfg))
    ) {
      return;
    }

    // (Categoría ya se maneja arriba con tryHandleCategoryBrowse)

    // Si hay un ganador claro por título (ej. "arroz con pollo"), no listar ambigüedades débiles
    let resolvedMatches =
      strongProduct && nameScored.length >= 1 && nameScored[0].score >= 80
        ? [nameScored[0].p]
        : uniqueNameMatches;

    // "5 pollos" / "cinco gaseosas": aunque el score sea flojo, tratar como pedido con cantidad
    if (
      orderQty >= 2 &&
      !session.pendingMatch &&
      !session.pendingAttribute &&
      !this.catalogService.isPriceInquiryIntent(text) &&
      !this.catalogService.isGenericProductInquiry(text) &&
      !looksLikeExplicitCartItemNote(text) &&
      !this.looksLikeStandaloneOrderNote(text) &&
      !this.catalogService.isCategoryBrowseQuestion(text) &&
      !this.catalogService.isMenuExploreIntent(text, products)
    ) {
      const qtyScored =
        nameScored.length > 0
          ? nameScored
          : this.catalogService.searchByNameScored(productQuery, products, 8);
      if (qtyScored.length >= 1 && qtyScored[0].score >= 12) {
        const family = this.catalogService.findProductVariantFamily(
          productQuery || text,
          products,
          qtyScored.map((x) => x.p),
        );
        if (family && family.variants.length >= 2) {
          session = {
            ...session,
            pendingMatch: {
              query: text,
              candidates: family.variants,
              quantity: orderQty,
            },
            pendingQuantityHint: { quantity: orderQty, query: productQuery || text },
          };
          await this.conversationService.saveSession(conv, session);
          await this.reply(
            conv,
            msg.waId,
            `Pediste *${orderQty}*. ¿Cuál variante?\n\n` +
              this.catalogService.formatVariantFamilyPrompt(family),
          );
          return;
        }
        if (qtyScored.length === 1 || this.catalogService.isStrongProductMatch(qtyScored)) {
          resolvedMatches = [qtyScored[0].p];
        } else if (qtyScored.length >= 2) {
          session = {
            ...session,
            pendingMatch: {
              query: text,
              candidates: qtyScored.slice(0, 6).map((x) => x.p),
              quantity: orderQty,
            },
            pendingQuantityHint: { quantity: orderQty, query: productQuery || text },
          };
          await this.conversationService.saveSession(conv, session);
          await this.reply(
            conv,
            msg.waId,
            `Pediste *${orderQty}*. ¿Cuál de estos?\n\n` +
              this.catalogService.formatProductChoicePrompt(text, qtyScored.slice(0, 6).map((x) => x.p)),
          );
          return;
        }
      }
    }

    if (
      resolvedMatches.length === 1 &&
      !this.catalogService.isProductDescriptionInquiry(text) &&
      !this.catalogService.isPriceInquiryIntent(text) &&
      !this.catalogService.isAvailabilityInquiry(text) &&
      !this.catalogService.isDishStyleSubstitutionInquiry(text) &&
      !this.catalogService.isGenericProductInquiry(text) &&
      !this.catalogService.isServingSizeChangeIntent(text) &&
      !this.catalogService.isLargerPackInquiry(text) &&
      !this.catalogService.isExternalMarketplaceOrderMessage(text) &&
      !looksLikeExplicitCartItemNote(text) &&
      !this.looksLikeStandaloneOrderNote(text) &&
      !this.catalogService.isCategoryBrowseQuestion(text) &&
      !this.catalogService.isMenuExploreIntent(text, products) &&
      !session.pendingMatch &&
      !session.pendingAttribute
    ) {
      const one = resolvedMatches[0];
      if (
        this.catalogService.looksLikeFoodPlusDrinkOrder(text) &&
        this.catalogService.isLikelyDrinkProduct(one)
      ) {
        const multiRetry = this.catalogService.resolveMultiProductOrder(text, products);
        if (multiRetry) {
          const handledMulti = await this.tryHandleMultiProductOrder(
            conv,
            msg.waId,
            session,
            multiRetry,
            cfg,
            text,
            products,
            originalText,
          );
          if (handledMulti) return;
        }
      }
      const deliveryTail = this.extractDeliveryTail(originalText) || this.extractDeliveryTail(text);
      if (deliveryTail) {
        session = this.withDeliveryAddress(session, deliveryTail);
        const feeEarly = await this.ensureDeliveryFeeQuoted(session, cfg);
        session = feeEarly.session;
        if (feeEarly.blocked) {
          await this.conversationService.saveSession(conv, session);
          await this.reply(conv, msg.waId, feeEarly.blocked);
          return;
        }
      }
      if (one.hasAttributes && one.attributes?.length) {
        if (await this.handleProductWithVariants(conv, msg.waId, session, one, text, cfg)) {
          return;
        }
      }
      const lineNote = this.catalogService.extractProductModificationNote(text) || undefined;
      const added = this.tryAddProductToCart(session, one, orderQty, cfg, lineNote, undefined, {
        sourceText: text,
      });
      if (added.blocked) {
        await this.conversationService.saveSession(conv, session);
        await this.handleCartLimitBlocked(conv, msg.waId, added.blocked, cfg);
        return;
      }
      if (added.alreadyHad) {
        await this.conversationService.saveSession(conv, session, 'building_cart');
        await this.reply(
          conv,
          msg.waId,
          `Listo, dejamos *${one.name}* como está ✅\n\n` +
            `${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}\n\n` +
            this.formatContinueShoppingPrompt(session),
        );
        return;
      }
      session = this.clearQuantityHint(added.session);
      await this.conversationService.saveSession(conv, session, 'building_cart');
      const qtyNote = orderQty > 1 ? ` _(x${orderQty})_` : '';
      await this.reply(
        conv,
        msg.waId,
        this.buildCartAddReply(session, this.deliveryFeeFor(session, cfg), `${one.name}${qtyNote}`, {
          extraLine: [
            lineNote ? `📝 _${lineNote}_` : '',
            one.description && !lineNote ? `_${one.description}_` : '',
            deliveryTail ? `\nDomicilio anotado: _${deliveryTail}_` : '',
          ]
            .filter(Boolean)
            .join('\n'),
        }),
      );
      return;
    }
    if (resolvedMatches.length > 1 && !session.pendingMatch) {
      if (this.catalogService.looksLikeMultiItemOrderMessage(text)) {
        const multiRetry = this.catalogService.resolveMultiProductOrder(text, products);
        if (multiRetry) {
          const handledMulti = await this.tryHandleMultiProductOrder(
            conv,
            msg.waId,
            session,
            multiRetry,
            cfg,
            text,
            products,
            originalText,
          );
          if (handledMulti) return;
        }
      }
      const infoAsk = this.catalogService.isProductDescriptionInquiry(text);
      const family = this.catalogService.findProductVariantFamily(text, products, resolvedMatches);
      if (family && family.variants.length >= 2) {
        session = {
          ...session,
          pendingMatch: {
            query: text,
            candidates: family.variants,
            intent: infoAsk ? 'info' : 'order',
            quantity: orderQty > 1 ? orderQty : undefined,
          },
          ...(orderQty > 1
            ? { pendingQuantityHint: { quantity: orderQty, query: productQuery || text } }
            : {}),
        };
        await this.conversationService.saveSession(conv, session);
        const qtyHint = orderQty > 1 ? `\n_Cantidad anotada: *${orderQty}*_\n\n` : '\n\n';
        await this.reply(
          conv,
          msg.waId,
          (orderQty > 1 ? `Pediste *${orderQty}*. ` : '') +
            this.catalogService.formatVariantFamilyPrompt(family) +
            (orderQty > 1 ? qtyHint.replace(/^\n/, '\n') : ''),
        );
        return;
      }
      session.pendingMatch = {
        query: text,
        candidates: resolvedMatches,
        intent: infoAsk ? 'info' : 'order',
        quantity: orderQty > 1 ? orderQty : undefined,
      };
      if (orderQty > 1) {
        session.pendingQuantityHint = { quantity: orderQty, query: productQuery || text };
      }
      await this.conversationService.saveSession(conv, session);
      await this.reply(
        conv,
        msg.waId,
        this.catalogService.formatProductChoicePrompt(text, resolvedMatches),
      );
      return;
    }

    const aiSessionCleanup = this.tryAbandonStalePendingState(session, text, products);
    if (aiSessionCleanup) {
      session = aiSessionCleanup;
      await this.conversationService.saveSession(conv, session);
    }

    const unavailableAsk = this.catalogService.unavailableAskReply(
      originalText || text,
      products,
      cfg.menuUrl,
    );
    if (unavailableAsk) {
      await this.reply(conv, msg.waId, unavailableAsk);
      return;
    }

    if (
      session.pendingMatch?.candidates?.length &&
      (await this.tryResolvePendingMatchPick(conv, msg.waId, session, text, products, cfg))
    ) {
      return;
    }

    const nudge = session.cart.length
      ? `${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}\n\n${this.formatContinueShoppingPrompt(session)}`
      : this.buildAskWhatToOrderMessage(cfg);
    await this.reply(conv, msg.waId, nudge);
  }

  private async applyActions(
    conv: WhatsappConversation,
    session: WhatsappSessionData,
    actions: AiOrderAction | undefined,
    products: MenuProduct[],
    cfg: EffectiveWhatsappConfig,
    sourceText = '',
  ): Promise<{ session: WhatsappSessionData; limitBlocked?: CartLimitCheck }> {
    if (!actions) return { session };
    let next = { ...session };

    if (actions.updateAttributes?.length || actions.updateCartLines?.length || actions.removeCartLines?.length) {
      next = { ...next, cart: this.consolidateCart(applyCartLineEdits(next.cart, actions)),
        pendingAttribute: undefined, pendingMatch: undefined };
    }

    if (actions.clearCart) {
      next = {
        ...next,
        cart: [],
        pendingMatch: undefined,
        pendingAttribute: undefined,
        pendingMultiOrder: undefined,
        pendingCartRemoval: undefined,
        pendingCartQuantity: undefined,
        pendingCategoryBrowse: undefined,
        pendingQuantityHint: undefined,
      };
    }

    // A replacement may remove and re-add the same SKU with new quantity/options.
    // Remove the old line before inserting its replacement.
    if (actions.removeProductIds?.length) {
      next.cart = next.cart.filter((c) => !actions.removeProductIds!.includes(c.productId));
    }

    if (actions.setAddress) {
      const addr = actions.setAddress.trim();
      // Agente a veces toma "Las mojarras fritas" / "es todo" como domicilio
      if (
        this.looksLikeFoodNotAddress(addr) ||
        this.looksLikeFoodNotAddress(sourceText || '') ||
        FOOD_ORDER_SIGNAL_RE.test(addr) ||
        isNothingElseOrderIntent(addr) ||
        isNothingElseOrderIntent(sourceText || '') ||
        isFinishCheckoutIntent(addr) ||
        isFinishCheckoutIntent(sourceText || '')
      ) {
        delete actions.setAddress;
      }
    }
    if (actions.setAddress) {
      const addr = actions.setAddress.trim();
      if (
        addr.length >= 5 &&
        !this.isConfirmKeyword(addr) &&
        !this.isGreetingKeyword(addr) &&
        !looksLikeClearCartMessage(sourceText || addr) &&
        !isConfirmCurrentAddressIntent(sourceText || '') &&
        !isConfirmCurrentAddressIntent(addr)
      ) {
        // No pisar dirección fuerte con una referencia de acceso (portón verde…)
        const accessRef =
          this.looksLikeDeliveryAccessReference(addr) ||
          this.looksLikeDeliveryAccessReference(sourceText || '');
        const existingAddr = (next.address || '').trim();
        if (
          accessRef &&
          next.addressConfirmed &&
          existingAddr &&
          this.isStrongExplicitAddress(existingAddr)
        ) {
          const note = (sourceText || addr).trim().slice(0, 160);
          next = this.appendCustomerNote(next, note);
          const addrNow = (next.address || existingAddr).trim();
          if (addrNow && !addrNow.toLowerCase().includes(note.toLowerCase())) {
            const base = addrNow.replace(/\s*\(ref\.\s*[^)]*\)\s*$/i, '').trim();
            next = { ...next, address: `${base} — ${note}`.slice(0, 240) };
          }
        } else if (!this.isPickupIntent(addr) && !this.isPickupIntent(sourceText || '')) {
          next = this.withDeliveryAddress(next, addr);
        } else {
          next = this.applyPickupIntent(next, addr || sourceText || 'pickup');
        }
      }
    }
    if (actions.setOrderType === 'pickup') {
      next = this.applyPickupIntent(next, actions.setAddress || 'pickup');
    } else if (actions.setOrderType === 'delivery') {
      next.orderType = 'delivery';
      next.fulfillmentChosen = true;
    }
    if (actions.setPaymentMethod) next.paymentMethod = actions.setPaymentMethod;

    if (actions.setCashChangeFor) {
      next.cashChangeFor = actions.setCashChangeFor.trim().slice(0, 120);
      next.notesCollected = true;
    }
    if (actions.setCustomerNotes) {
      next.customerNotes = actions.setCustomerNotes.trim().slice(0, 400);
      next.notesCollected = true;
    }

    if (actions.addItems?.length) {
      const forcedQty = sourceText ? this.resolveOrderQuantity(next, sourceText) : 1;
      const multiQtyOrder =
        actions.addItems.length > 1 ||
        (!!sourceText &&
          (this.catalogService.looksLikeMultiItemOrderMessage(sourceText) ||
            this.catalogService.countQuantityMentions(sourceText) >= 2));
      const modNote = sourceText
        ? this.catalogService.extractProductModificationNote(sourceText)
        : null;
      // Un plato + nota: no dejar que la IA meta acompañamientos (yuca/papa)
      let items = actions.addItems;
      const repeatedClauseQuantities = new Map<typeof items[number], number>();
      // The model may split "2 arroces" into two identical add_item calls.
      // Resolve the customer's single quantity once for each identical line.
      if (sourceText) {
        const grouped = new Map<string, typeof items[number]>();
        for (const item of items) {
          const attrs = (item.attributes || []).map(a =>
            `${a.attributeName.toLowerCase()}:${a.attributeValue.toLowerCase()}`).sort();
          const product = products.find(p => p.id === item.productId);
          const ownSegment = product && this.catalogService.orderSegmentForProduct(sourceText, product, products, item.attributes);
          const uniqueClause = !this.catalogService.looksLikeClearlyMultiDishOrder(sourceText) || ownSegment !== sourceText;
          const clauses = !uniqueClause && product && !item.note ? sourceText
            .split(/(?:\s+y\s+|,\s*|;\s*)(?=(?:(?:aparte|adem[aá]s)\s+)?(?:otr[oa]s?|un[oa]?s?|\d+|dos|tres|cuatro|cinco)\b)/i)
            .filter(segment => {
              const codes = [...segment.matchAll(/(?:#|c[oó]digo\s*)\s*(\d{1,4})\b/gi)];
              return codes.length ? codes.some(match => Number(match[1]) === product.code) :
                this.catalogService.productNameFitsUtterance(product, segment);
            }) : [];
          const choicesKey = (choices: typeof item.attributes) => JSON.stringify((choices || [])
            .map(a => `${a.attributeName.toLowerCase()}:${a.attributeValue.toLowerCase()}`).sort());
          const sameChoices = clauses.length > 1 && clauses.every(segment => {
            const parsed = this.catalogService.resolveAttributesFromMessage(product!, segment, []);
            return parsed.status !== 'invalid' &&
              choicesKey(this.catalogService.fillDefaultAttributes(product!, parsed.attributes)) ===
              choicesKey(this.catalogService.fillDefaultAttributes(product!, item.attributes || [])) &&
              !this.catalogService.extractProductModificationNote(segment);
          });
          const key = JSON.stringify([item.productId, attrs, (item.note || '').trim().toLowerCase(),
            uniqueClause || sameChoices ? null : grouped.size]);
          const previous = grouped.get(key);
          const combined = previous ? {...previous,quantity:(previous.quantity || 1)+(item.quantity || 1)} : item;
          grouped.set(key, combined);
          if (sameChoices) repeatedClauseQuantities.set(combined, clauses.reduce((sum, segment) =>
            sum + this.catalogService.extractQuantityFromSegment(segment), 0));
        }
        items = [...grouped.values()];
      }
      if (modNote && items.length > 1) {
        items = items.filter((item) => {
          const product = products.find((p) => p.id === item.productId);
          if (!product) return false;
          const name = product.name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
          const noteQ = modNote
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
          const sideToks = ['yuca', 'papa', 'papas', 'patacon', 'platano', 'ensalada', 'arroz'];
          return !sideToks.some((t) => name.includes(t) && noteQ.includes(t));
        });
        if (!items.length) items = actions.addItems.slice(0, 1);
      }
      const deferredNeedsAttrs: Array<{
        segment: string;
        productId: number;
        name: string;
        code: number;
        price: number;
      }> = [];
      let pendingAttr:
        | {
            product: (typeof products)[number];
            selected: { attributeName: string; attributeValue: string }[];
            sourceText: string;
          }
        | undefined;
      for (const item of items) {
        const product = products.find((p) => p.id === item.productId);
        if (!product) continue;
        const itemSource = sourceText && multiQtyOrder
          ? this.catalogService.orderSegmentForProduct(sourceText, product, products, item.attributes)
          : sourceText;
        const qty = repeatedClauseQuantities.get(item) ?? this.resolveAddItemQuantity({
          product,
          aiQuantity: item.quantity,
          sourceText,
          quantitySource: itemSource,
          multiQtyOrder,
          forcedQty,
        });
        // En multi-ítem: la nota de "con queso" solo aplica al plato que la menciona
        const itemNote =
          item.note?.trim() || (multiQtyOrder ? undefined : modNote || undefined) || undefined;
        const fromText = itemSource
          ? this.catalogService.extractExplicitAttributeChoice(itemSource, product)
          : null;
        const attempt = this.tryAddProductToCart(
          next,
          product,
          qty,
          cfg,
          itemNote,
          fromText || item.attributes,
          { sourceText: itemSource },
        );
        if (attempt.missingAttributes) {
          deferredNeedsAttrs.push({
            segment: sourceText || product.name,
            ...this.toPendingMultiProduct(product),
          });
          if (!pendingAttr) {
            pendingAttr = {
              product,
              selected: attempt.missingAttributes,
              sourceText: itemNote || sourceText || product.name,
            };
          }
          continue;
        }
        if (attempt.blocked) {
          return { session: next, limitBlocked: attempt.blocked };
        }
        next = this.clearQuantityHint(attempt.session);
      }
      if (pendingAttr) {
        next = this.buildPendingAttributeSession(
          next,
          pendingAttr.product,
          pendingAttr.selected,
          {
            sourceText: pendingAttr.sourceText,
            pendingMultiOrder: {
              confident: [],
              ambiguous: [],
              unresolved: [],
              needsAttributes: deferredNeedsAttrs,
            },
          },
        );
      }
    }

    if (actions.updateCartLines?.some(update => update.quantity !== undefined &&
      update.quantity > (session.cart[update.cartLineIndex]?.quantity || 0))) {
      const limit = evaluateCartLimits(next.cart, this.toCartLimitsConfig(cfg, next), {orderType:next.orderType});
      if (!limit.ok) return {session,limitBlocked:limit};
    }

    if (actions.requestHuman) {
      // Temporal: no activar asesor; la reply de la IA / humanContactMessage orientan al teléfono
    }

    return { session: next };
  }

  private toCartLimitsConfig(
    cfg: EffectiveWhatsappConfig,
    session?: WhatsappSessionData,
  ): WhatsappCartLimitsConfig {
    return {
      minOrderAmount: Math.max(0, Number(cfg.minOrderAmount) || 0),
      maxOrderAmount: Math.max(0, Number(cfg.maxOrderAmount) || 0),
      maxUnitsPerItem: Math.max(0, Number(cfg.maxUnitsPerItem) || 0),
      maxTotalUnits: Math.max(0, Number(cfg.maxTotalUnits) || 0),
      maxCartLines: Math.max(0, Number(cfg.maxCartLines) || 0),
      handoffWhenMaxExceeded: cfg.handoffWhenMaxExceeded !== false,
      defaultDeliveryFee: session
        ? this.deliveryFeeFor(session, cfg)
        : Math.max(0, Number(cfg.defaultDeliveryFee) || 0),
    };
  }

  /** Fee a mostrar/cobrar: solo el calculado por ruta (o 0 si aún no hay). */
  private deliveryFeeFor(session: WhatsappSessionData, cfg: EffectiveWhatsappConfig): number {
    if (session.orderType === 'pickup') return 0;
    if (typeof session.deliveryFeeCalculated === 'number' && session.deliveryFeeCalculated >= 0) {
      return session.deliveryFeeCalculated;
    }
    // No mostrar tarifa fija provisional (evita $2.000 → luego $5.000)
    return 0;
  }

  /** ¿Ya tenemos fee de ruta/fijo resuelto para este pedido? */
  private hasResolvedDeliveryFee(session: WhatsappSessionData): boolean {
    return typeof session.deliveryFeeCalculated === 'number' && session.deliveryFeeCalculated >= 0;
  }

  /**
   * Si la dirección ya está confirmada y aún no hay fee, cotiza ya
   * (evita mostrar un valor y luego otro al confirmar).
   */
  private async ensureDeliveryFeeQuoted(
    session: WhatsappSessionData,
    cfg: EffectiveWhatsappConfig,
  ): Promise<{
    session: WhatsappSessionData;
    notice?: string;
    blocked?: string;
  }> {
    if (session.orderType === 'pickup') return { session };
    if (!session.address?.trim() || !session.addressConfirmed) return { session };
    if (this.hasResolvedDeliveryFee(session)) return { session };
    return this.recalculateDeliveryFee(session, cfg);
  }

  /**
   * Calcula domicilio por ruta (Google) al confirmar dirección.
   * Si no hay API key o falla → fee fijo.
   */
  private async recalculateDeliveryFee(
    session: WhatsappSessionData,
    cfg: EffectiveWhatsappConfig,
    coords?: { lat?: number | null; lng?: number | null },
  ): Promise<{
    session: WhatsappSessionData;
    notice?: string;
    blocked?: string;
  }> {
    if (session.orderType === 'pickup') {
      return {
        session: {
          ...session,
          deliveryFeeCalculated: 0,
          deliveryDistanceKm: null,
          deliveryOutOfCoverage: false,
        },
      };
    }
    const address = (session.address || '').trim();
    if (!address) return { session };

    const { geocodeQuery, customerHint } = this.splitAddressCustomerHint(address);

    if (cfg.deliveryFeeMode === 'fixed') {
      return {
        session: {
          ...session,
          deliveryFeeCalculated: cfg.defaultDeliveryFee,
          deliveryDistanceKm: null,
          deliveryOutOfCoverage: false,
        },
        notice: `🚚 Domicilio: *$${cfg.defaultDeliveryFee.toLocaleString('es-CO')}*`,
      };
    }

    const lat =
      coords?.lat != null && Number.isFinite(Number(coords.lat))
        ? Number(coords.lat)
        : session.deliveryLat != null && Number.isFinite(Number(session.deliveryLat))
          ? Number(session.deliveryLat)
          : null;
    const lng =
      coords?.lng != null && Number.isFinite(Number(coords.lng))
        ? Number(coords.lng)
        : session.deliveryLng != null && Number.isFinite(Number(session.deliveryLng))
          ? Number(session.deliveryLng)
          : null;

    const quote = await this.deliveryRouting.quoteDeliveryFee({
      customerAddress: geocodeQuery,
      customerCoords: lat != null && lng != null ? { lat, lng } : null,
      restaurant: { lat: Number(cfg.restaurantLat), lng: Number(cfg.restaurantLng) },
      tiers: cfg.deliveryFeeTiers || [],
      maxKm: Number(cfg.deliveryMaxKm) || 5.5,
      fallbackFee: cfg.defaultDeliveryFee,
      regionBias: 'co',
    });

    if (!quote.ok) {
      if (quote.reason === 'out_of_coverage') {
        return {
          session: {
            ...session,
            deliveryOutOfCoverage: true,
            deliveryDistanceKm: quote.distanceKm ?? null,
            deliveryFeeCalculated: null,
            deliveryLat: lat,
            deliveryLng: lng,
          },
          blocked: quote.message,
        };
      }
      if (quote.reason === 'no_api_key' || quote.reason === 'no_restaurant_coords') {
        this.logger.warn(`Delivery fee fallback: ${quote.reason}`);
        return {
          session: {
            ...session,
            deliveryFeeCalculated: cfg.defaultDeliveryFee,
            deliveryDistanceKm: null,
            deliveryOutOfCoverage: false,
            deliveryLat: lat,
            deliveryLng: lng,
          },
          notice: `🚚 Domicilio: *$${cfg.defaultDeliveryFee.toLocaleString('es-CO')}* _(tarifa fija)_`,
        };
      }
      // Dirección tipo landmark/conjunto no geocodificable: se toma igual con fee default.
      if (quote.reason === 'geocode_failed' || quote.reason === 'route_failed') {
        this.logger.warn(`Delivery fee unverified address (${quote.reason}): ${address.slice(0, 80)}`);
        return {
          session: {
            ...session,
            deliveryFeeCalculated: cfg.defaultDeliveryFee,
            deliveryDistanceKm: null,
            deliveryOutOfCoverage: false,
            deliveryLat: lat,
            deliveryLng: lng,
          },
          notice:
            `📍 Anoté: _${address}_\n` +
            `🚚 Domicilio por ahora: *$${cfg.defaultDeliveryFee.toLocaleString('es-CO')}*\n` +
            `_No pude ubicarla exacta en el mapa; el costo del domicilio puede cambiar al confirmar la ubicación._`,
        };
      }
      return {
        session: {
          ...session,
          deliveryOutOfCoverage: false,
          deliveryFeeCalculated: null,
          deliveryDistanceKm: null,
        },
        blocked: quote.message,
      };
    }

    // Distancia sí; tiempo de ruta no (Google suele dar ETA de auto muy bajo vs cocina+domicilio)
    const kmPart =
      quote.source === 'google_directions' && quote.distanceKm > 0
        ? ` · ruta ~${quote.distanceKm.toFixed(1)} km`
        : '';
    return {
      session: {
        ...session,
        deliveryFeeCalculated: quote.fee,
        deliveryDistanceKm: quote.distanceKm > 0 ? quote.distanceKm : null,
        deliveryOutOfCoverage: false,
        deliveryLat: quote.customer.lat || lat,
        deliveryLng: quote.customer.lng || lng,
        address: this.mergeGeocodedAddressWithCustomerHint(
          quote.geocodedAddress || geocodeQuery,
          customerHint,
        ),
      },
      notice: `🚚 Domicilio: *$${quote.fee.toLocaleString('es-CO')}*${kmPart}`,
    };
  }

  private tryAddProductToCart(
    session: WhatsappSessionData,
    product: MenuProduct,
    quantity: number,
    cfg: EffectiveWhatsappConfig,
    note?: string,
    attributes?: { attributeName: string; attributeValue: string }[],
    attrOpts?: {
      variantIntent?: 'combo' | 'solo';
      sourceText?: string;
      omitSwappedDrink?: boolean;
    },
  ): {
    session: WhatsappSessionData;
    blocked?: CartLimitCheck;
    /** Faltan atributos: no se agregó al carrito */
    missingAttributes?: { attributeName: string; attributeValue: string }[];
    /** Ya estaba en carrito y el cliente aclaró "solo X" */
    alreadyHad?: boolean;
  } {
    let selected = attributes ? [...attributes] : [];
    const textSwap = attrOpts?.sourceText
      ? this.catalogService.swapIntent(attrOpts.sourceText)
      : null;
    // La bebida del combo sigue (es obligatoria). El cambio va en la nota de la línea.
    if (
      textSwap &&
      this.catalogService.productCarriesMention(product, textSwap.removed) &&
      !note?.trim()
    ) {
      note = this.catalogService.swapChangeNote(textSwap.removed, textSwap.added);
    }
    const attrOptsForFill = attrOpts;
    // Si el mensaje ya nombra opciones (frita, blancas…), respétalas
    if (attrOpts?.sourceText && product.hasAttributes && product.attributes?.length) {
      const fromMsg = this.catalogService.resolveAttributesFromMessage(
        product,
        attrOpts.sourceText,
        selected,
        attrOpts,
      );
      if (fromMsg.status === 'complete' || fromMsg.status === 'partial') {
        selected = fromMsg.attributes;
      }
    }
    if (
      product.hasAttributes &&
      product.attributes?.length &&
      !this.catalogService.isAttributeSelectionComplete(product, selected, attrOptsForFill)
    ) {
      // Primera opción por defecto (arepas Blancas, etc.) — el cliente puede cambiar después
      selected = this.catalogService.fillDefaultAttributes(product, selected, attrOptsForFill);
    }
    if (
      product.hasAttributes &&
      product.attributes?.length &&
      !this.catalogService.isAttributeSelectionComplete(product, selected, attrOptsForFill)
    ) {
      return { session, missingAttributes: selected };
    }

    note = omitRedundantAttributeNote(note, selected);
    const incomingKey = this.cartLineKey({
      productId: product.id,
      note,
      attributes: selected,
    });
    const alreadyInCart = session.cart.some((c) => this.cartLineKey(c) === incomingKey);
    if (alreadyInCart && this.isOnlyThisProductCorrection(attrOpts?.sourceText || '')) {
      return { session, alreadyHad: true };
    }

    const projected = this.addProductToCart(session, product, quantity, note, selected);
    const check = evaluateCartLimits(projected.cart, this.toCartLimitsConfig(cfg, session), {
      orderType: projected.orderType,
    });
    if (!check.ok) return { session, blocked: check };
    return {
      session: {
        ...projected,
        ignorePriorOrderHistory: false,
        productFocus: {
          productId: product.id,
          name: product.name,
          variantBaseKey: this.catalogService.getProductNameBase(product.name) || undefined,
        },
      },
    };
  }

  /** "solo arroz…", "solamente eso", "nada más que X" → no sumar otra unidad. */
  private isOnlyThisProductCorrection(text: string): boolean {
    const t = (text || '').trim().toLowerCase();
    if (!t) return false;
    return (
      /\b(solo|solamente|unicamente|únicamente)\b/.test(t) ||
      /\bnada\s+m[aá]s\s+(que|de)\b/.test(t) ||
      /\b(eso\s+no|no\s+agregues|no\s+sumes|no\s+otro)\b/.test(t)
    );
  }

  /** Si faltan attrs, deja pendingAttribute y arma el prompt del siguiente paso. */
  private buildPendingAttributeSession(
    session: WhatsappSessionData,
    product: MenuProduct,
    selected: { attributeName: string; attributeValue: string }[],
    opts?: {
      sourceText?: string;
      variantIntent?: 'combo' | 'solo';
      pendingMultiOrder?: WhatsappSessionData['pendingMultiOrder'];
    },
  ): WhatsappSessionData {
    return {
      ...session,
      pendingAttribute: {
        ...this.toPendingAttribute(product, {
          sourceText: opts?.sourceText,
          variantIntent: opts?.variantIntent,
          selected,
        }),
      },
      pendingMatch: undefined,
      ...(opts?.pendingMultiOrder !== undefined
        ? { pendingMultiOrder: opts.pendingMultiOrder }
        : {}),
    };
  }

  /** Cantidad del mensaje actual, o la que quedó pendiente ("3 mojarras" → luego "mojarras"). */
  private resolveOrderQuantity(session: WhatsappSessionData, text: string): number {
    const fromText = this.catalogService.extractQuantityFromMessage(text);
    if (fromText >= 2) return Math.min(30, fromText);
    const hint = session.pendingQuantityHint;
    if (!hint || hint.quantity < 2) return Math.max(1, fromText);
    const q = this.normalizeForMatch(
      this.catalogService.stripQuantityFromSearchQuery(
        this.catalogService.extractProductSearchQuery(text),
      ) || text,
    );
    const hintQ = this.normalizeForMatch(hint.query || '');
    if (!q || q.length < 4) return Math.max(1, fromText);
    // Misma familia de producto (mojarras / mojarra frita)
    if (
      hintQ.includes(q) ||
      q.includes(hintQ) ||
      hintQ.split(' ').some((t) => t.length >= 5 && q.includes(t)) ||
      q.split(' ').some((t) => t.length >= 5 && hintQ.includes(t))
    ) {
      return Math.min(30, hint.quantity);
    }
    return Math.max(1, fromText);
  }

  /**
   * Cantidad al aplicar addItems de la IA.
   * En pedidos multi-ítem nunca reutilizar el primer número del mensaje para todos.
   */
  private resolveAddItemQuantity(opts: {
    product: { name: string; code?: number };
    aiQuantity?: number;
    sourceText?: string;
    quantitySource?: string;
    multiQtyOrder: boolean;
    forcedQty: number;
  }): number {
    const aiQty = Math.max(1, Math.min(30, opts.aiQuantity ?? 1));
    const correctedQty = this.catalogService.extractCorrectedQuantityForProduct(opts.sourceText || '', opts.product.name);
    if (correctedQty != null) return correctedQty;
    if (opts.sourceText && opts.product.code != null) {
      const codeMentions = [...opts.sourceText.matchAll(/\b(\d{1,2}|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s*(?:#|(?:del?\s+)?c[oó]digo\s*)\s*(\d{1,4})\b/gi)]
        .filter(match => Number(match[2]) === opts.product.code);
      if (codeMentions.length === 1) {
        return this.catalogService.extractQuantityFromSegment(`${codeMentions[0][1]} platos`);
      }
    }
    const correction = opts.sourceText ? parseQtyDishCorrection(opts.sourceText) : null;
    const correctedLine = correction?.filter(line =>
      this.normalizeForMatch(opts.product.name).includes(this.normalizeForMatch(line.dish)));
    if (correctedLine?.length === 1) return correctedLine[0].qty;
    if (opts.multiQtyOrder && opts.sourceText) {
      const near = this.catalogService.extractQuantityNearProduct(
        opts.quantitySource || opts.sourceText,
        opts.product.name,
      );
      if (near != null) return Math.max(1, Math.min(30, near));
      // No confiar en la qty de la IA: suele copiar "dos" al plato equivocado
      return 1;
    }
    if (opts.forcedQty >= 2) return Math.min(30, opts.forcedQty);
    return aiQty;
  }

  /** Cantidad de un ítem multi-pedido según su segmento (y el mensaje completo si hace falta). */
  private quantityForMultiSegment(
    segment: string,
    productName: string,
    fullText?: string,
  ): number {
    const rawSeg = this.rawOrderSegmentForQuantity(segment, fullText);
    const fromSeg = this.catalogService.extractQuantityFromSegment(rawSeg || '');
    if (fromSeg >= 2) return Math.min(30, fromSeg);
    const near = this.catalogService.extractQuantityNearProduct(
      fullText || rawSeg || '',
      productName,
    );
    return Math.max(1, Math.min(30, near ?? fromSeg));
  }

  /** Quita texto de atributos repetido al calcular qty ("3 pollos 3 pollos y 2 limonadas" → "3 pollos"). */
  private rawOrderSegmentForQuantity(segment: string, fullText?: string): string {
    let s = (segment || '').trim();
    const ft = (fullText || '').trim();
    if (!s || !ft || s === ft) return s;
    if (s.endsWith(ft) && s.length > ft.length) {
      s = s.slice(0, -ft.length).trim();
    }
    return s;
  }

  /** Cantidad al agregar tras elegir variante o completar pendingAttribute. */
  private resolveAddQuantity(
    session: WhatsappSessionData,
    product: MenuProduct,
    opts?: { sourceText?: string; segment?: string },
  ): number {
    const pm = session.pendingMultiOrder;
    const segment =
      opts?.segment ||
      pm?.needsAttributes?.find((n) => n.productId === product.id)?.segment ||
      pm?.confident?.find((n) => n.productId === product.id)?.segment;
    const sourceText = opts?.sourceText || segment || session.pendingMatch?.query || '';

    if (segment || sourceText) {
      const qty = this.quantityForMultiSegment(segment || sourceText, product.name, sourceText);
      if (qty >= 2) return qty;
      if (segment && this.catalogService.extractQuantityFromSegment(
        this.rawOrderSegmentForQuantity(segment, sourceText),
      ) >= 1) {
        return qty;
      }
    }

    if (session.pendingMatch?.quantity && session.pendingMatch.quantity >= 2) {
      const ids = new Set(session.pendingMatch.candidates?.map((c) => c.id) || []);
      if (ids.has(product.id)) return Math.min(30, session.pendingMatch.quantity);
    }

    const hint = session.pendingQuantityHint;
    if (hint && hint.quantity >= 2) {
      const pn = this.normalizeForMatch(product.name);
      const hq = this.normalizeForMatch(hint.query || '');
      if (hq && (pn.includes(hq) || hq.split(' ').some((t) => t.length >= 4 && pn.includes(t)))) {
        return Math.min(30, hint.quantity);
      }
    }

    if (sourceText) {
      const fromSeg = this.catalogService.extractQuantityFromSegment(sourceText);
      if (fromSeg >= 2) return Math.min(30, fromSeg);
    }

    return 1;
  }

  private rememberQuantityHint(
    session: WhatsappSessionData,
    text: string,
    quantity: number,
  ): WhatsappSessionData {
    if (quantity < 2) return session;
    const query =
      this.catalogService.stripQuantityFromSearchQuery(
        this.catalogService.extractProductSearchQuery(text),
      ) || text;
    return {
      ...session,
      pendingQuantityHint: { quantity: Math.min(30, quantity), query },
    };
  }

  private clearQuantityHint(session: WhatsappSessionData): WhatsappSessionData {
    if (!session.pendingQuantityHint) return session;
    const { pendingQuantityHint: _drop, ...rest } = session;
    return rest;
  }

  private async handleCartLimitBlocked(
    conv: WhatsappConversation,
    waId: string,
    blocked: CartLimitCheck,
    cfg: EffectiveWhatsappConfig,
  ): Promise<void> {
    const shouldHandoff =
      !!blocked.handoff && cfg.handoffWhenMaxExceeded !== false && blocked.kind !== 'min';
    if (shouldHandoff) {
      await this.reply(
        conv,
        waId,
        blocked.reason || 'Ese pedido se sale del tope por WhatsApp.',
      );
      return;
    }
    await this.reply(conv, waId, blocked.reason || 'Ese pedido supera el límite permitido.');
  }

  private cartLineKey(item: {
    productId: number;
    note?: string;
    attributes?: { attributeName: string; attributeValue: string }[];
  }): string {
    const attrs = [...(item.attributes || [])]
      .map((a) => `${a.attributeName}=${a.attributeValue}`)
      .sort()
      .join('|');
    return `${item.productId}::${item.note || ''}::${attrs}`;
  }

  /** Une líneas repetidas del mismo producto/opciones en una sola con cantidad. */
  private consolidateCart(cart: WhatsappCartItem[]): WhatsappCartItem[] {
    const map = new Map<string, WhatsappCartItem>();
    for (const raw of cart) {
      const qty = Math.max(1, raw.quantity || 1);
      const key = this.cartLineKey(raw);
      const prev = map.get(key);
      if (prev) {
        map.set(key, {
          ...prev,
          quantity: (prev.quantity || 1) + qty,
        });
      } else {
        map.set(key, { ...raw, quantity: qty });
      }
    }
    return [...map.values()];
  }

  private addProductToCart(
    session: WhatsappSessionData,
    product: MenuProduct,
    quantity: number,
    note?: string,
    attributes?: { attributeName: string; attributeValue: string }[],
    opts?: { mode?: 'add' | 'set' },
  ): WhatsappSessionData {
    const qty = Math.min(30, Math.max(1, Math.round(quantity) || 1));
    const cart: WhatsappCartItem[] = [...session.cart];
    const incomingKey = this.cartLineKey({
      productId: product.id,
      note,
      attributes,
    });
    const sameIdx = cart.findIndex((c) => this.cartLineKey(c) === incomingKey);
    if (sameIdx >= 0) {
      const prevQty = Math.max(1, cart[sameIdx].quantity || 1);
      cart[sameIdx] = {
        ...cart[sameIdx],
        quantity:
          opts?.mode === 'set'
            ? qty
            : Math.min(30, prevQty + qty),
      };
    } else {
      cart.push({
        productId: product.id,
        name: product.name,
        code: product.code,
        unitPrice: product.price,
        quantity: qty,
        note,
        attributes,
      });
    }
    return { ...session, cart, pendingMatch: undefined };
  }

  private toPendingAttribute(
    product: MenuProduct,
    opts?: {
      selected?: { attributeName: string; attributeValue: string }[];
      variantIntent?: 'combo' | 'solo';
      sourceText?: string;
    },
  ): WhatsappPendingAttribute {
    const variantIntent =
      opts?.variantIntent ||
      (opts?.sourceText
        ? this.catalogService.extractVariantPreferenceHint(opts.sourceText) || undefined
        : undefined) ||
      (this.catalogService.productImpliesCombo(product) ? 'combo' : undefined);
    return {
      productId: product.id,
      name: product.name,
      code: product.code,
      price: product.price,
      attributes: product.attributes || [],
      selected: opts?.selected || [],
      variantIntent,
      ...(opts?.sourceText ? { sourceText: opts.sourceText.slice(0, 200) } : {}),
    };
  }

  private attributeFlowOpts(
    pa?: { variantIntent?: 'combo' | 'solo' },
  ): { variantIntent?: 'combo' | 'solo' } | undefined {
    return pa?.variantIntent ? { variantIntent: pa.variantIntent } : undefined;
  }

  private buildSessionSummary(
    conv: WhatsappConversation,
    session: WhatsappSessionData,
    deliveryFee: number,
    products?: MenuProduct[],
  ): string {
    const subtotal = session.cart.reduce(
      (s, c) => s + c.unitPrice * Math.max(1, c.quantity || 1),
      0,
    );
    const fee = session.orderType === 'delivery' ? deliveryFee : 0;
    const lines = [
      `Nombre: ${this.displayCustomerName(conv)}`,
      `Teléfono WA: ${conv.phoneE164}`,
      `Teléfono contacto: ${session.contactPhone || (session.phoneConfirmed ? conv.phoneE164 : '(pendiente confirmar)')}`,
      `Dirección: ${session.address || '(pendiente)'} (confirmada: ${session.addressConfirmed ? 'sí' : 'no'})`,
      `Tipo: ${session.orderType} (elegido: ${session.fulfillmentChosen ? 'sí' : 'no'})`,
      `Pago: ${session.paymentMethod || '(pendiente)'}`,
      `Carrito (${session.cart.reduce((n, c) => n + Math.max(1, c.quantity || 1), 0)}): ${
        session.cart
          .map((c) => {
            const q = Math.max(1, c.quantity || 1);
            return `${c.name}${q > 1 ? ` x${q}` : ''} $${Math.round(c.unitPrice * q).toLocaleString('es-CO')}`;
          })
          .join(', ') || 'vacío'
      }`,
      `Subtotal sistema: $${Math.round(subtotal).toLocaleString('es-CO')} + domicilio $${Math.round(fee).toLocaleString('es-CO')}` +
        (session.deliveryDistanceKm != null
          ? ` (ruta ~${Number(session.deliveryDistanceKm).toFixed(1)} km)`
          : '') +
        (session.deliveryOutOfCoverage ? ' [FUERA DE COBERTURA]' : ''),
      'Checkout: el sistema pregunta UNA cosa a la vez (nombre → dirección de domicilio → teléfono → pago). Por defecto es *domicilio*; recojo solo si el cliente lo dijo (ej. paso en 15 min). NO inventes ni saltes esos pasos.',
    ];
    if (session.ignorePriorOrderHistory && session.cart.length === 0) {
      lines.push(
        'NUEVO PEDIDO: carrito vacío tras pedido anterior. NO reutilices ítems del historial.',
      );
    }
    if (session.pendingAttribute) {
      const pa = session.pendingAttribute;
      const productForRemaining = {
        id: pa.productId,
        name: pa.name,
        code: pa.code,
        price: pa.price,
        hasAttributes: true,
        attributes: pa.attributes || [],
      } as MenuProduct;
      const remaining = this.catalogService.getRemainingAttributes(
        productForRemaining,
        pa.selected || [],
        this.attributeFlowOpts(pa),
      );
      const next = remaining[0];
      lines.push(
        `ELECCIÓN PENDIENTE: producto "${pa.name}" (código ${pa.code}, id ${pa.productId}).` +
          (pa.selected?.length
            ? ` Ya eligió: ${pa.selected.map((s) => `${s.attributeName}=${s.attributeValue}`).join(', ')}.`
            : '') +
          (next
            ? ` Falta elegir "${next.attributeName}": ${next.options.map((o, i) => `${i + 1}) ${o}`).join(', ')}. Si dice "era el broaster" o "no, yo quería la otra", cambia esa opción.`
            : ''),
      );
    }
    if (session.pendingMatch?.candidates?.length) {
      const names = session.pendingMatch.candidates
        .slice(0, 8)
        .map((c, i) => `${i + 1}) ${c.name}`)
        .join(', ');
      lines.push(
        `LISTA ABIERTA: ${names}. Si el cliente dice "era ese", "no, yo quería el otro" o nombra uno, elige ese de la lista. Un número sigue siendo la fila.`,
      );
    }
    if (session.pendingCategoryBrowse?.categories?.length) {
      lines.push(
        `EXPLORANDO MENÚ — categorías mostradas: ${session.pendingCategoryBrowse.categories.join(', ')}. Espera que elija categoría o plato concreto.`,
      );
    }
    if (session.pendingMultiOrder) {
      const pm = session.pendingMultiOrder;
      lines.push(
        `PEDIDO MULTI PENDIENTE: ${pm.confident.length} claro(s), ${pm.ambiguous.length} dudoso(s), ${pm.unresolved.length} sin hallar. Espera *sí* o corrección/número.`,
      );
    }
    if (products?.length && session.cart.length) {
      const detail = session.cart
        .map((c, i) => {
          const product = products.find((p) => p.id === c.productId);
          const attrs = (product?.attributes || [])
            .map((a) => {
              const current = (c.attributes || []).find(
                (s) => s.attributeName.toLowerCase() === a.attributeName.toLowerCase(),
              );
              return `${a.attributeName}=${current?.attributeValue || '(sin elegir)'} [opciones: ${a.options.join(' | ')}]`;
            })
            .join('; ');
          return `${i + 1}. productId=${c.productId} ${c.name}${attrs ? ` — ${attrs}` : ''}`;
        })
        .join('\n');
      lines.push(
        `Opciones reales del carrito (set_attribute solo con estos valores):\n${detail}`,
      );
    }
    if (session.cart.length > 0) {
      const last = session.cart[session.cart.length - 1];
      const q = Math.max(1, last.quantity || 1);
      lines.push(
        `ÚLTIMO ÍTEM DEL CARRITO: "${last.name}"` +
          (q > 1 ? ` x${q}` : '') +
          ` (productId=${last.productId}).` +
          (last.note?.trim() ? ` Nota actual: "${last.note.trim()}".` : '') +
          ' Preferencias de guarnición (sin X, más Y, no quiero arepas, para el combo…) → NOTA de este ítem; PROHIBIDO addItems de acompañamientos.',
      );
    }
    if (session.customerNotes?.trim()) {
      lines.push(`Notas del pedido: ${session.customerNotes.trim()}`);
    }
    if (session.cashChangeFor?.trim()) {
      lines.push(`Cambio/vueltas: ${session.cashChangeFor.trim()}`);
    }
    return lines.join('\n');
  }

  /** Respuesta a "dónde queda el restaurante / cómo llego". */
  private formatRestaurantLocationReply(cfg: EffectiveWhatsappConfig): string {
    const ctx = cfg.localContext;
    const brand = cfg.brandName || ctx?.restaurantName || 'el local';
    const lines: string[] = [`📍 *${brand}*`];
    const addressParts = [
      ctx?.restaurantAddress,
      ctx?.restaurantNeighborhood,
      ctx?.restaurantCity,
    ].filter(Boolean);
    if (addressParts.length) {
      lines.push(addressParts.join(', '));
    }
    if (ctx?.landmarks?.trim()) {
      lines.push(`_Referencia:_ ${ctx.landmarks.trim()}`);
    }
    if (ctx?.mapsUrl?.trim()) {
      lines.push(`Mapa: ${ctx.mapsUrl.trim()}`);
    }
    if (ctx?.publicPhone?.trim()) {
      lines.push(`Tel: ${ctx.publicPhone.trim()}`);
    }
    if (ctx?.pickupNotes?.trim()) {
      lines.push(ctx.pickupNotes.trim());
    }
    if (lines.length <= 1) {
      return (
        `Aún no tengo la dirección del local configurada por aquí.\n` +
        `_${this.humanContactMessage()}_`
      );
    }
    lines.push('\n_¿Te antoja algo del menú o prefieres *recojo* / *domicilio*?_');
    return lines.join('\n');
  }

  /**
   * Muestra lista de categoría; reemplaza pendingMatch anterior (sopas → pollo).
   * @returns null si ya respondió; session actualizada si no aplicó.
   */
  private async tryHandleCategoryBrowse(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    products: MenuProduct[],
    text: string,
    menuConceptGroups?: MenuConceptGroup[],
  ): Promise<WhatsappSessionData | null> {
    const hit = this.catalogService.findCategoryBrowseHit(text, products, menuConceptGroups);
    if (!hit?.products.length) return session;

    const pendingKey = session.pendingMatch?.query || session.pendingMatch?.candidates?.[0]?.categoryName;
    if (pendingKey === hit.categoryName) return session;

    const next: WhatsappSessionData = {
      ...session,
      pendingCategoryBrowse: undefined,
      pendingMatch: {
        query: hit.categoryName,
        candidates: hit.products,
      },
    };
    await this.conversationService.saveSession(conv, next);
    await this.reply(
      conv,
      waId,
      this.catalogService.formatCategoryBrowseReply(hit),
    );
    return null;
  }

  /** Re-mostrar lista pendiente solo si el cliente pide aclaración, no si eligió código válido. */
  private isPendingListRepromptText(
    text: string,
    pending?: WhatsappSessionData['pendingMatch'],
  ): boolean {
    const t = text.trim().toLowerCase();
    if (!t) return true;
    if (/^[1-9]\d{0,3}$/.test(t)) {
      if (!pending?.candidates?.length) return true;
      const n = parseInt(t, 10);
      if (n >= 1 && n <= pending.candidates.length) return false;
      if (pending.candidates.some((c) => c.code === n)) return false;
      return true;
    }
    if (/\?/.test(t)) return true;
    if (
      /\b(cuales|cuáles|opciones|lista|no entendi|no entendí|otra vez|de nuevo|cuál|cual|numero|número)\b/i.test(
        t,
      )
    ) {
      return true;
    }
    return false;
  }

  /** El cliente cambió de tema: no seguir atascado en una lista vieja. */
  private looksLikeFreshOrderIntent(text: string): boolean {
    const t = text.trim().toLowerCase();
    if (!t) return false;
    if (this.isGreetingKeyword(text) || this.isMenuLinkIntent(text)) return true;
    if (/\b(hola|buenas|hey|menu|menú|humano|asesor|agente)\b/i.test(t)) return true;
    if (/\b(quiero|quieor|qiero|kiero|dame|ponme|me das|pedir|ordenar|agrega|agregame|otro|otra|mejor|en realidad|no era|olvidalo|olvídalo|olvidate|empezar de nuevo|de nuevo)\b/i.test(t)) {
      return true;
    }
    const q = this.catalogService.extractProductSearchQuery(text);
    return q.length >= 4;
  }

  private messageRelatesToPendingMatch(
    text: string,
    pending: NonNullable<WhatsappSessionData['pendingMatch']>,
  ): boolean {
    const trimmed = text.trim();
    if (!trimmed) return true;

    const bareNum = /^[1-9]\d{0,3}$/.test(trimmed) ? parseInt(trimmed, 10) : null;
    // "1" en una lista numerada ≠ código de menú 1
    if (bareNum != null) {
      if (bareNum >= 1 && bareNum <= pending.candidates.length) return true;
      if (pending.candidates.some((c) => c.code === bareNum)) return true;
      return false;
    }

    const listPick = trimmed.match(/(?:opci[oó]n|la|el|numero|n[uú]mero)\s*([1-9]\d{0,2})/i);
    if (listPick) {
      const pick = parseInt(listPick[1], 10);
      if (pick >= 1 && pick <= pending.candidates.length) return true;
    }

    const code = this.catalogService.extractCodeFromMessage(text);
    if (code != null) {
      return pending.candidates.some((c) => c.code === code);
    }

    if (this.isPendingListRepromptText(text, pending)) return true;

    const q = this.normalizeForMatch(this.catalogService.extractProductSearchQuery(text));
    if (q.length < 3) return false;

    for (const c of pending.candidates) {
      const name = this.normalizeForMatch(c.name);
      if (name.includes(q) || q.includes(name)) return true;
      const qTokens = q.split(' ').filter((tok) => tok.length >= 4);
      if (qTokens.some((tok) => name.includes(tok))) return true;
    }
    return false;
  }

  private shouldAbandonPendingMultiOrder(
    text: string,
    pending: NonNullable<WhatsappSessionData['pendingMultiOrder']>,
    products: MenuProduct[],
  ): boolean {
    if (this.isMultiOrderAffirmative(text)) return false;
    if (this.catalogService.isPendingOrderCorrection(text)) return false;
    if (isAbandonPendingSelectionIntent(text)) return true;
    if (isAddressChangeIntent(text)) return true;
    // Pregunta de acompañamiento / precio del plato ya marcado → no soltar el multi
    if (
      this.catalogService.isProductDescriptionInquiry(text) ||
      this.catalogService.isPriceInquiryIntent(text) ||
      this.catalogService.isAvailabilityInquiry(text)
    ) {
      return false;
    }
    const lower = text.trim().toLowerCase();
    if (/^[1-9]\d*$/.test(lower) && pending.ambiguous.length) return false;

    // "broaster" / "frito" resolviendo la duda del multi → no abandonar
    if (pending.ambiguous.length) {
      const group = pending.ambiguous[0];
      if (
        this.catalogService.pickFromCandidateList(
          text,
          group.candidates as MenuProduct[],
        )
      ) {
        return false;
      }
    }

    for (const seg of [
      ...pending.unresolved,
      ...pending.ambiguous.map((a) => a.segment),
    ]) {
      const segNorm = this.normalizeForMatch(seg);
      if (segNorm.length >= 4 && this.normalizeForMatch(text).includes(segNorm)) return false;
    }

    if (this.catalogService.followUpDishClaim(text, pending.unresolved)) return false;
    if (this.looksLikeFreshOrderIntent(text)) return true;
    // “Con gaseosa” mientras falta frito/broaster → no soltar el multi
    if (
      this.catalogService.isDrinkOnlyAccompanimentMessage(text) &&
      (pending.ambiguous.length > 0 || pending.unresolved.length > 0 || pending.needsAttributes.length > 0)
    ) {
      return false;
    }
    if (this.catalogService.findProductEmbeddedInMessage(text, products)) return true;
    return text.trim().length >= 12;
  }

  /**
   * Si el cliente manda algo distinto a la lista pendiente, limpiar estado
   * para que el flujo de productos vuelva a funcionar (evita loop de IA).
   */
  private tryAbandonStalePendingState(
    session: WhatsappSessionData,
    text: string,
    products: MenuProduct[],
  ): WhatsappSessionData | null {
    let next = session;
    let changed = false;

    if (session.pendingMatch?.candidates?.length) {
      if (!this.messageRelatesToPendingMatch(text, session.pendingMatch)) {
        next = { ...next, pendingMatch: undefined };
        changed = true;
      }
    }

    if (session.pendingMultiOrder) {
      if (this.shouldAbandonPendingMultiOrder(text, session.pendingMultiOrder, products)) {
        next = { ...next, pendingMultiOrder: undefined };
        changed = true;
      }
    }

    if (session.pendingCategoryBrowse?.categories?.length) {
      const picked = this.catalogService.resolveCategoryBrowsePick(
        text,
        session.pendingCategoryBrowse.categories,
      );
      const embedded = this.catalogService.findProductEmbeddedInMessage(text, products);
      if (
        !picked &&
        embedded &&
        !this.catalogService.isMenuExploreIntent(text, products)
      ) {
        next = { ...next, pendingCategoryBrowse: undefined };
        changed = true;
      }
    }

    return changed ? next : null;
  }

  private async tryHandleVariantFamily(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    products: MenuProduct[],
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    if (this.catalogService.isDishStyleSubstitutionInquiry(text)) return false;
    const family = this.catalogService.findProductVariantFamily(text, products);
    if (!family || family.variants.length < 2) return false;

    const picked = this.catalogService.pickVariantFromFamilyText(text, family);
    const qty = this.resolveOrderQuantity(session, text);
    if (qty >= 2) {
      session = this.rememberQuantityHint(session, text, qty);
    }
    if (picked) {
      session = { ...session, pendingMatch: undefined };
      if (picked.hasAttributes && picked.attributes?.length) {
        if (await this.handleProductWithVariants(conv, waId, session, picked, text, cfg)) {
          return true;
        }
      }
      const added = this.tryAddProductToCart(session, picked, qty, cfg);
      if (added.blocked) {
        await this.conversationService.saveSession(conv, session);
        await this.handleCartLimitBlocked(conv, waId, added.blocked, cfg);
        return true;
      }
      session = this.clearQuantityHint(added.session);
      await this.conversationService.saveSession(conv, session, 'building_cart');
      const qtyNote = qty > 1 ? ` _(x${qty})_` : '';
      await this.reply(
        conv,
        waId,
        this.buildCartAddReply(session, this.deliveryFeeFor(session, cfg), `${picked.name}${qtyNote}`),
      );
      return true;
    }

    session = {
      ...session,
      pendingMatch: {
        query: text,
        candidates: family.variants,
        quantity: qty > 1 ? qty : undefined,
      },
      ...(qty > 1
        ? {
            pendingQuantityHint: {
              quantity: qty,
              query: this.catalogService.extractProductSearchQuery(text) || text,
            },
          }
        : {}),
    };
    await this.conversationService.saveSession(conv, session);
    const mentionedPrice = this.catalogService.extractMentionedPriceCop(text);
    const priceMiss =
      mentionedPrice != null
        ? `No tengo exactamente $${mentionedPrice.toLocaleString('es-CO')}. Estas son las presentaciones:\n\n`
        : '';
    await this.reply(
      conv,
      waId,
      (qty > 1 ? `Pediste *${qty}*. ` : '') +
        priceMiss +
        this.catalogService.formatVariantFamilyPrompt(family),
    );
    return true;
  }

  /**
   * Pedido de un plato que existe en frito y en broaster (u otro estilo)
   * como SKUs distintos, sin que el cliente haya dicho cuál.
   */
  private async tryHandleUnspecifiedCookingStyleFamily(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    products: MenuProduct[],
    _cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    if (session.pendingMatch || session.pendingAttribute || session.pendingMultiOrder) return false;
    if (this.catalogService.isPriceInquiryIntent(text)) return false;
    if (this.catalogService.isAvailabilityInquiry(text)) return false;
    if (this.catalogService.isProductDescriptionInquiry(text)) return false;
    if (this.catalogService.isDishStyleSubstitutionInquiry(text)) return false;
    if (this.catalogService.isMenuExploreIntent(text, products)) return false;
    if (this.catalogService.isCategoryBrowseQuestion(text)) return false;

    const family = this.catalogService.findProductVariantFamily(text, products);
    if (!family || family.variants.length < 2) return false;
    if (this.catalogService.pickVariantFromFamilyText(text, family)) return false;

    const styled = family.variants.filter((p) => {
      const n = this.normalizeForMatch(p.name);
      return /\b(broaster|frito|asado|plancha|sudado|apanado)\b/.test(n);
    });
    const styles = new Set(
      styled.map((p) => {
        const n = this.normalizeForMatch(p.name);
        if (/\bbroaster\b/.test(n)) return 'broaster';
        if (/\bfrito\b/.test(n)) return 'frito';
        if (/\basado\b/.test(n)) return 'asado';
        if (/\bplancha\b/.test(n)) return 'plancha';
        if (/\bsudado\b/.test(n)) return 'sudado';
        return 'apanado';
      }),
    );
    if (styled.length < 2 || styles.size < 2) return false;

    const qty = this.resolveOrderQuantity(session, text);
    session = {
      ...session,
      pendingMatch: {
        query: text,
        candidates: styled,
        quantity: qty > 1 ? qty : undefined,
      },
      ...(qty > 1
        ? {
            pendingQuantityHint: {
              quantity: qty,
              query: this.catalogService.extractProductSearchQuery(text) || text,
            },
          }
        : {}),
    };
    await this.conversationService.saveSession(conv, session, 'building_cart');
    await this.reply(
      conv,
      waId,
      (qty > 1 ? `Pediste *${qty}*. ` : '') +
        this.catalogService.formatVariantFamilyPrompt({
          ...family,
          variants: styled,
        }),
    );
    return true;
  }

  /**
   * Pollo sin estilo (frito/broaster): listar opciones en vez de asumir Frito.
   */
  private async tryHandleChickenStyleAmbiguity(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    products: MenuProduct[],
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    if (this.catalogService.isPriceInquiryIntent(text)) return false;
    if (this.catalogService.isAvailabilityInquiry(text)) return false;
    if (this.catalogService.isProductDescriptionInquiry(text)) return false;
    if (this.catalogService.isMenuExploreIntent(text, products)) return false;
    // "medio pollo y una sopa" no es solo el estilo del pollo: el otro plato se pierde.
    if (
      this.catalogService.looksLikeClearlyMultiDishOrder(text) ||
      this.catalogService.looksLikeMultiItemOrderMessage(text)
    ) {
      return false;
    }
    const choices = this.catalogService.chickenStyleChoicesForSegment(text, products);
    if (!choices || choices.length < 2) return false;

    const qty = this.resolveOrderQuantity(session, text);
    session = {
      ...session,
      pendingMatch: {
        query: text,
        candidates: choices,
        quantity: qty > 1 ? qty : undefined,
      },
      ...(qty > 1
        ? {
            pendingQuantityHint: {
              quantity: qty,
              query: this.catalogService.extractProductSearchQuery(text) || text,
            },
          }
        : {}),
    };
    await this.conversationService.saveSession(conv, session, 'building_cart');
    const label = /\bcombo\b/i.test(text)
      ? 'combo de pollo'
      : /\b(medio|1\s*\/\s*2|1\/2)\b/i.test(text)
        ? 'medio pollo'
        : /\b(cuarto|1\s*\/\s*4|1\/4)\b/i.test(text)
          ? 'cuarto de pollo'
          : 'pollo';
    await this.reply(
      conv,
      waId,
      `¿Cómo lo quieres el *${label}*?\n\n` +
        this.catalogService.formatCategoryList(label, choices),
    );
    return true;
  }

  /**
   * Lista de productos pendiente: número de fila (1, 2…) o código del menú (cód. 28).
   */
  private async tryResolvePendingMatchPick(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    products: MenuProduct[],
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    const pending = session.pendingMatch;
    if (!pending?.candidates?.length) return false;
    if (this.catalogService.isProductDescriptionInquiry(text)) return false;

    const trimmed = text.trim();
    const bareNum = this.catalogService.extractListPickNumber(text);
    let chosenLite: (typeof pending.candidates)[number] | null = null;

    // Número de fila (1, 2…) vs código de menú (ej. cód. 99 en lista de 9)
    const listOrCode = resolvePendingListOrMenuCode({
      bareNum,
      candidates: pending.candidates,
    });
    if (listOrCode === 'list_index' && bareNum != null) {
      chosenLite = pending.candidates[bareNum - 1];
    } else if (listOrCode === 'menu_code' && bareNum != null) {
      chosenLite =
        pending.candidates.find((c) => Number(c.code) === bareNum) ?? null;
    }

    const code = this.catalogService.extractCodeFromMessage(text);
    if (!chosenLite && code != null) {
      chosenLite =
        pending.candidates.find((c) => Number(c.code) === code) ?? null;
    }

    // Código de menú fuera del rango de filas (99 con 9 opciones) o global
    if (!chosenLite && code != null) {
      const found = this.catalogService.findByCode(code, products);
      if (found) {
        if (
          pending.candidates.some((c) => c.id === found.id) ||
          bareNum == null ||
          bareNum > pending.candidates.length
        ) {
          chosenLite = found;
        }
      }
    }

    if (!chosenLite) {
      const listPick = trimmed.match(/(?:opci[oó]n|la|el|numero|n[uú]mero)\s*([1-9]\d{0,2})/i);
      if (listPick) {
        const pick = parseInt(listPick[1], 10);
        if (pick >= 1 && pick <= pending.candidates.length) {
          chosenLite = pending.candidates[pick - 1];
        }
      }
    }

    if (!chosenLite) {
      const family = this.catalogService.findProductVariantFamily(
        pending.query || text,
        products,
        pending.candidates,
      );
      if (family) {
        const byFamily = this.catalogService.pickVariantFromFamilyText(text, family);
        if (byFamily) chosenLite = byFamily;
      }
    }

    if (!chosenLite) {
      const q = this.normalizeForMatch(this.catalogService.extractProductSearchQuery(text));
      if (q.length >= 3) {
        chosenLite =
          pending.candidates.find((c) => {
            const name = this.normalizeForMatch(c.name);
            return name.includes(q) || q.includes(name);
          }) ?? null;
      }
    }

    if (!chosenLite) return false;

    const chosen =
      this.catalogService.getProductById(chosenLite.id, products) || (chosenLite as MenuProduct);

    if (chosen.availableNow === false) {
      await this.reply(
        conv,
        waId,
        `*${chosen.name}* no está disponible en este horario. Elige otro de la lista o dime otro plato.`,
      );
      return true;
    }

    const infoIntent = pending.intent === 'info';
    // Cantidad explícita ("3 sopas") gana sobre sticky; un "3" de lista NO es cantidad
    const usedAsListIndex = listOrCode === 'list_index' && bareNum != null;
    const qtyFromText = usedAsListIndex
      ? 1
      : this.catalogService.extractQuantityFromMessage(text);
    const qty = Math.max(
      1,
      qtyFromText >= 2
        ? Math.min(30, qtyFromText)
        : pending.quantity || this.resolveOrderQuantity(session, text) || 1,
    );
    session = {
      ...session,
      pendingMatch: undefined,
      // El número de una lista “si quieres agregarlo” reemplaza cualquier oferta vieja
      pendingAddOffer: undefined,
    };
    // Si eligieron por número de lista, no guardar "3" como sourceText (infla qty en attrs)
    const attrSourceText = usedAsListIndex ? chosen.name : text;
    session = this.rememberProductFocus(session, chosen, products);

    // Lista informativa sin número: mostrar detalle. Si ya están pidiendo
    // (“quiero el cuarto…”, “cambiar la yuca…”), se agrega esa opción.
    const orderingFromList =
      /\b(quiero|dame|ponme|regalame|regalas|pideme|cambia)\b/.test(
        this.normalizeForMatch(text),
      ) || !!this.catalogService.swapIntent(text);
    if (
      infoIntent &&
      !orderingFromList &&
      !usedAsListIndex &&
      bareNum == null &&
      code == null
    ) {
      await this.conversationService.saveSession(conv, session, 'building_cart');
      await this.reply(conv, waId, this.catalogService.formatProductPriceReply(chosen, { offerAdd: false }));
      return true;
    }

    session = this.applyDeliveryHintFromMessage(session, text);

    if (
      await this.tryKeepSiblingDishesAfterStylePick(
        conv,
        waId,
        session,
        pending,
        chosen,
        products,
        cfg,
      )
    ) {
      return true;
    }

    if (chosen.hasAttributes && chosen.attributes?.length) {
      if (
        await this.handleProductWithVariants(conv, waId, session, chosen, attrSourceText, cfg)
      ) {
        return true;
      }
    }

    const added = this.tryAddProductToCart(session, chosen, qty, cfg);
    if (added.blocked) {
      await this.conversationService.saveSession(conv, session);
      await this.handleCartLimitBlocked(conv, waId, added.blocked, cfg);
      return true;
    }
    session = this.clearQuantityHint(added.session);
    // "4" y luego "2" siguen siendo filas de la misma lista.
    const keepList =
      usedAsListIndex && bareNum != null && trimmed === String(bareNum);
    if (keepList) {
      session = { ...session, pendingMatch: pending };
    }
    await this.conversationService.saveSession(conv, session, 'building_cart');
    const qtyNote = qty > 1 ? ` _(x${qty})_` : '';
    await this.reply(
      conv,
      waId,
      this.buildCartAddReply(session, this.deliveryFeeFor(session, cfg), `${chosen.name}${qtyNote}`, {
        extraLine: this.extractDeliveryTail(text)
          ? `\nDomicilio anotado: _${this.extractDeliveryTail(text)}_`
          : undefined,
      }),
    );
    return true;
  }

  /**
   * El "1" eligió el medio pollo, pero la frase original también pedía otra cosa
   * ("y una sopa de mondongo"). Esa parte sigue en el pedido.
   */
  private async tryKeepSiblingDishesAfterStylePick(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    pending: NonNullable<WhatsappSessionData['pendingMatch']>,
    chosen: MenuProduct,
    products: MenuProduct[],
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    const siblings = (pending.alsoAdd || [])
      .map((item) => {
        const product = products.find((p) => p.id === item.productId);
        return product ? { product, segment: item.segment } : null;
      })
      .filter((item): item is { product: MenuProduct; segment: string } => !!item);
    const stored = (pending.query || '').trim();
    const multi =
      siblings.length || !stored
        ? null
        : this.catalogService.resolveMultiProductOrder(stored, products);
    const fromResolve = [
      ...(multi?.confident || []),
      ...(multi?.needsAttributes || []),
    ].filter((row) => row.product.id !== chosen.id);
    const others = siblings.length
      ? siblings
      : fromResolve.map((row) => ({ product: row.product, segment: row.segment }));
    if (!others.length) return false;
    return this.addResolvedDishesToCart(conv, waId, session, [
      { product: chosen, segment: chosen.name },
      ...others,
    ], cfg);
  }

  /**
   * Solo falta frito/broaster. Los otros platos del mensaje se agregan al elegir el número,
   * sin el resumen "entendí varios platos".
   */
  private async tryAskChickenStyleKeepingOthers(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    multi: MultiProductResolveResult,
    text: string,
  ): Promise<boolean> {
    if (multi.ambiguous.length !== 1 || multi.unresolved.length) return false;
    const group = multi.ambiguous[0];
    const others = [...multi.confident, ...multi.needsAttributes];
    if (!others.length || group.candidates.length < 2) return false;
    const styleChoice = group.candidates.every((c) =>
      /\b(frito|broaster|asado|mixto)\b/i.test(c.name),
    );
    if (!styleChoice) return false;

    const segment = group.segment || text;
    session = {
      ...session,
      pendingMultiOrder: undefined,
      pendingMatch: {
        query: text,
        candidates: group.candidates,
        alsoAdd: others.map((item) => ({
          productId: item.product.id,
          segment: item.segment,
        })),
      },
    };
    await this.conversationService.saveSession(conv, session, 'building_cart');
    const label = /\bcombo\b/i.test(segment)
      ? 'combo de pollo'
      : /\b(medio|1\s*\/\s*2|1\/2)\b/i.test(segment)
        ? 'medio pollo'
        : /\b(cuarto|1\s*\/\s*4|1\/4)\b/i.test(segment)
          ? 'cuarto de pollo'
          : 'pollo';
    const kept = others.map((item) => {
      const qty = Math.max(1, this.catalogService.extractQuantityFromSegment(item.segment) || 1);
      return qty > 1 ? `*${item.product.name}* ×${qty}` : `*${item.product.name}*`;
    });
    const keptLine =
      kept.length === 1
        ? `${kept[0]} queda en el pedido.`
        : `${kept.join(', ')} quedan en el pedido.`;
    await this.reply(
      conv,
      waId,
      `${keptLine}\n\n¿Cómo lo quieres el *${label}*?\n\n` +
        this.catalogService.formatCategoryList(label, group.candidates),
    );
    return true;
  }

  /** Agrega los platos ya resueltos. La primera opción de arepa/sabor/bebida queda sola. */
  private async addResolvedDishesToCart(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    items: Array<{ product: MenuProduct; segment: string; note?: string }>,
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    let next: WhatsappSessionData = {
      ...session,
      pendingMatch: undefined,
      pendingMultiOrder: undefined,
      pendingAttribute: undefined,
    };
    const labels: string[] = [];
    for (const item of items) {
      const qty = Math.max(1, this.catalogService.extractQuantityFromSegment(item.segment) || 1);
      const added = this.tryAddProductToCart(next, item.product, qty, cfg, item.note, undefined, {
        sourceText: item.segment,
      });
      if (added.blocked) {
        await this.conversationService.saveSession(conv, next);
        await this.handleCartLimitBlocked(conv, waId, added.blocked, cfg);
        return true;
      }
      if (added.missingAttributes) {
        next = this.buildPendingAttributeSession(next, item.product, added.missingAttributes, {
          sourceText: item.segment,
        });
        await this.conversationService.saveSession(conv, next, 'awaiting_attribute');
        const prefix = labels.length
          ? `${this.buildCartAddReply(next, this.deliveryFeeFor(next, cfg), labels, { suffix: '' })}\n\n`
          : '';
        await this.reply(
          conv,
          waId,
          `${prefix}Para *${item.product.name}* elige:\n\n` +
            this.catalogService.formatProductOptionsPrompt(item.product, added.missingAttributes),
        );
        return true;
      }
      next = added.session;
      labels.push(this.formatAddedProductLabel(item.product.name, qty));
    }
    await this.conversationService.saveSession(conv, next, 'building_cart');
    const fee = this.deliveryFeeFor(next, cfg);
    await this.reply(
      conv,
      waId,
      `${this.buildCartAddReply(next, fee, labels, { suffix: '' })}\n\n` +
        `${this.formatCartOnly(next, fee)}\n\n` +
        this.formatContinueShoppingPrompt(next),
    );
    return true;
  }

  /**
   * Frase humana, no un protocolo cerrado.
   * "2" / "broaster" eligen la opción. "no, yo quería el otro" lo lee el agente.
   */
  private looksLikeHumanIntentSentence(text: string): boolean {
    const t = (text || '').trim();
    if (t.length < 6 || !/\s/.test(t)) return false;
    if (/^[1-9]\d{0,2}$/.test(t)) return false;
    if (/^(?:opci[oó]n|la|el|n[uú]mero)\s*[1-9]\d{0,2}$/i.test(t)) return false;
    return true;
  }

  /** Pregunta / comentario mientras hay opciones pendientes (no es un "1"/"2"). */
  private looksLikeSideQuestion(text: string): boolean {
    const t = text.trim();
    if (!t || /^[1-9]\d{0,2}$/.test(t)) return false;
    if (/^(opci[oó]n|la|el)\s*[1-9]\d{0,2}$/i.test(t)) return false;
    if (t.length <= 2) return false;
    if (/\?/.test(t)) return true;
    if (
      /\b(qu[eé]|c[oó]mo|cu[aá]nto|cu[aá]nta|cu[aá]ndo|d[oó]nde|por\s+qu[eé]|tiene|tienen|hay|incluye|viene|vienen|es\s+que|puedo|me\s+puedes|expl[ií]came|diferencia|tama[nñ]o|grande|peque|gratis|demora|tiempo|horario|abierto)\b/i.test(
        t,
      )
    ) {
      return true;
    }
    // Frases largas casi nunca son solo el nombre de una opción corta
    return t.length >= 18;
  }

  private async answerSideQuestionWithAi(params: {
    conv: WhatsappConversation;
    session: WhatsappSessionData;
    text: string;
    products: MenuProduct[];
    cfg: Awaited<ReturnType<WhatsappSettingsService['getEffectiveConfig']>>;
    businessOpenForBot: boolean;
    status: Awaited<ReturnType<BusinessService['getStatus']>>;
    pendingProduct: MenuProduct;
  }): Promise<string> {
    const { conv, session, text, products, cfg, businessOpenForBot, status, pendingProduct } =
      params;
    const menuDetailed = await this.catalogService.getMenuDetailedText();
    const recent = await this.conversationService.getRecentMessageTexts(conv.id, 14);
    const pa = session.pendingAttribute!;
    const productForRemaining = {
      id: pa.productId,
      name: pa.name,
      code: pa.code,
      price: pa.price,
      hasAttributes: true,
      attributes: pa.attributes || [],
    } as MenuProduct;
    const remainingAttrs = this.catalogService.getRemainingAttributes(
      productForRemaining,
      pa.selected || [],
      this.attributeFlowOpts(pa),
    );
    const nextAttr = remainingAttrs[0];
    const optionsHint = nextAttr
      ? nextAttr.options.map((o, i) => `${i + 1}) ${o}`).join(', ')
      : '';

    const rulesBlock = buildWhatsappBusinessRulesBlock({
      brandName: cfg.brandName || cfg.localContext?.restaurantName || 'Pronto Pollo Portal',
      businessStatus: businessOpenForBot ? { ...status, isOpen: true } : status,
      deliveryFee: this.deliveryFeeFor(session, cfg),
      deliveryFeeTiersBlock: cfg.deliveryFeeTiersPrompt,
      allowMercadoPago: !!cfg.allowMercadoPago,
      menuProductCount: products.filter((p) => p.availableNow !== false).length,
      localContextBlock: cfg.localContextBlock,
      orderLimitsBlock: buildOrderLimitsPromptBlock(this.toCartLimitsConfig(cfg, session)),
      paymentMethods: cfg.paymentMethods,
    });

    const ai = await this.aiService.generateTurn({
      userMessage: text,
      businessRulesBlock: rulesBlock,
      menuDetailedText: menuDetailed,
      sessionSummary: this.buildSessionSummary(conv, session, this.deliveryFeeFor(session, cfg)),
      recentMessages: recent,
      customerHint:
        `El cliente aún NO eligió las opciones de *${pendingProduct.name}*. ` +
        `Respóndele con tuteo colombiano, cálido y natural (sin empalagar). ` +
        `NO reenvíes el menú completo ni la lista numerada entera. ` +
        `Al final, UNA sola frase corta recordando que falta elegir` +
        (nextAttr ? ` *${nextAttr.attributeName}* (${optionsHint})` : '') +
        `. No uses addItems hasta que elija.`,
      conversational: true,
    });

    // Acciones seguras solamente (no agregar productos ni vaciar carrito)
    const safe = ai.actions
      ? {
          setCustomerName: ai.actions.setCustomerName,
          setAddress: ai.actions.setAddress,
          setOrderType: ai.actions.setOrderType,
          setPaymentMethod: ai.actions.setPaymentMethod,
          requestHuman: ai.actions.requestHuman,
        }
      : undefined;

    const guarded = this.actionGuard.sanitize({
      actions: safe,
      products,
      businessOpen: businessOpenForBot,
      allowMercadoPago: !!cfg.allowMercadoPago,
      paymentMethods: cfg.paymentMethods,
    });

    const applied = await this.applyActions(conv, session, guarded.actions, products, cfg, text);
    // Preservar elección pendiente sí o sí
    const nextSession = {
      ...applied.session,
      pendingAttribute: session.pendingAttribute,
    };
    if (
      guarded.actions?.setCustomerName &&
      isUsableWhatsappCustomerName(guarded.actions.setCustomerName)
    ) {
      await this.conversationService.updateCustomerName(conv, guarded.actions.setCustomerName);
    }
    await this.conversationService.saveSession(conv, nextSession, 'awaiting_attribute');

    let reply = (ai.reply || '').trim();
    if (!reply) {
      reply = `Elige la opción de *${pendingProduct.name}*.`;
    }
    if (
      nextAttr &&
      !/\b(elige|eleg[ií]|opci[oó]n|responde\s*[123]|cuando quieras|falta)\b/i.test(reply)
    ) {
      reply += `\n_${nextAttr.attributeName}: ${optionsHint}_`;
    }
    return reply;
  }

  private formatContinueShoppingPrompt(_session?: WhatsappSessionData): string {
    // Una sola pregunta clara; nombre/dirección/pago los pide el checkout al confirmar
    return '¿*Algo más*?';
  }

  private formatCartTiny(session: WhatsappSessionData, deliveryFee: number): string {
    const cart = this.consolidateCart(session.cart);
    const n = cart.reduce((s, c) => s + Math.max(1, c.quantity || 1), 0);
    if (!n) return '🛒 Carrito vacío';
    const subtotal = cart.reduce(
      (s, c) => s + c.unitPrice * Math.max(1, c.quantity || 1),
      0,
    );
    const fee =
      session.orderType === 'delivery' && this.hasResolvedDeliveryFee(session)
        ? deliveryFee
        : 0;
    const total = subtotal + fee;
    return `🛒 ${n} ${n === 1 ? 'ítem' : 'ítems'} · *$${Math.round(total).toLocaleString('es-CO')}*`;
  }

  private withPreface(preface: string | undefined, body: string): string {
    const p = (preface || '').trim();
    if (!p) return body;
    return `${p}\n\n${body}`;
  }

  /** Carrito compacto: ítem × cant · total (legible en móvil). */
  private formatCartOnly(session: WhatsappSessionData, deliveryFee: number): string {
    const cart = this.consolidateCart(session.cart);
    if (!cart.length) return '🛒 Carrito vacío';

    const subtotal = cart.reduce(
      (s, c) => s + c.unitPrice * Math.max(1, c.quantity || 1),
      0,
    );
    const feeResolved = this.hasResolvedDeliveryFee(session);
    const fee =
      session.orderType === 'delivery' && feeResolved ? deliveryFee : 0;
    const total = subtotal + fee;
    const lines = cart.map((c, i) => {
      const qty = Math.max(1, c.quantity || 1);
      const lineTotal = c.unitPrice * qty;
      const unitBit =
        qty > 1
          ? ` ×${qty} · $${Math.round(c.unitPrice).toLocaleString('es-CO')} c/u →`
          : ' ·';
      const attrs = c.attributes?.length
        ? `\n   _${c.attributes
            .map((a) =>
              a.attributeName?.trim()
                ? `${a.attributeName}: ${a.attributeValue}`
                : a.attributeValue,
            )
            .join(' · ')}_`
        : '';
      const note = c.note?.trim() ? `\n   📝 _${c.note.trim()}_` : '';
      return (
        `*${i + 1}.* *${c.name}*${unitBit} *$${Math.round(lineTotal).toLocaleString('es-CO')}*` +
        attrs +
        note
      );
    });

    let deliveryBit = '';
    if (session.orderType === 'delivery') {
      if (feeResolved && fee > 0) {
        deliveryBit = ` · Dom.${
          session.deliveryDistanceKm != null && session.deliveryDistanceKm > 0
            ? ` ~${Number(session.deliveryDistanceKm).toFixed(1)} km`
            : ''
        } $${Math.round(fee).toLocaleString('es-CO')}`;
      } else if (session.address?.trim()) {
        deliveryBit = ` · Dom. según ruta`;
      } else {
        deliveryBit = ` · Dom. según dir.`;
      }
    }

    return (
      `🛒 *Carrito*\n` +
      lines.join('\n') +
      `\n────────────\n` +
      `Subtotal $${Math.round(subtotal).toLocaleString('es-CO')}${deliveryBit}\n` +
      `*Total $${Math.round(total).toLocaleString('es-CO')}*` +
      (session.orderType === 'delivery' && session.address?.trim()
        ? `\n📍 ${session.address.trim()}${session.addressConfirmed ? ' ✅' : ''}`
        : '')
    );
  }

  /**
   * Confirmación corta al agregar: *producto* ×cant (+ attrs si hay, ej. Sabor: Con gas).
   * Sin precios; el carrito completo va en domicilio / confirmación.
   */
  private buildCartAddReply(
    session: WhatsappSessionData,
    deliveryFee: number,
    added: string | string[],
    opts?: { extraLine?: string; suffix?: string; showCartSummary?: boolean },
  ): string {
    const rawNames = (Array.isArray(added) ? added : [added]).filter(Boolean);
    const names = rawNames.map((n) => this.compactAddedProductLabel(session, n));

    let head =
      names.length === 1
        ? `Listo ✅ *${names[0]}*`
        : `Listo ✅ ${names.map((n) => `*${n}*`).join(', ')}`;

    // Attrs del ítem (auto o elegidos): "Sabor: Con gas" — sin decir "por defecto"
    if (names.length === 1) {
      const baseNorm = this.normalizeForMatch(names[0].replace(/\s*×\s*\d+\s*$/, '').trim());
      const cart = this.consolidateCart(session.cart);
      const hit =
        cart.find((c) => this.normalizeForMatch(c.name) === baseNorm) ||
        session.cart[session.cart.length - 1];
      if (hit?.attributes?.length) {
        const attrLine = hit.attributes
          .map((a) =>
            a.attributeName?.trim()
              ? `${a.attributeName}: ${a.attributeValue}`
              : a.attributeValue,
          )
          .filter(Boolean)
          .join(' · ');
        if (attrLine) head += `\n_${attrLine}_`;
      }
      if (hit?.note?.trim()) head += `\n📝 _${hit.note.trim()}_`;
    } else {
      const cart = this.consolidateCart(session.cart);
      for (const name of names) {
        const baseNorm = this.normalizeForMatch(name.replace(/\s*×\s*\d+\s*$/, '').trim());
        const hit = cart.find((c) => this.normalizeForMatch(c.name) === baseNorm);
        if (hit?.note?.trim()) head += `\n📝 _${hit.note.trim()}_`;
      }
    }
    if (opts?.extraLine) head += `\n${opts.extraLine}`;

    const prompt = opts?.suffix !== undefined ? opts.suffix : this.formatContinueShoppingPrompt(session);
    const body = head.trim();
    if (opts?.showCartSummary) {
      const summary = this.formatCartTiny(session, deliveryFee);
      return prompt ? `${body}\n${summary}\n\n${prompt}` : `${body}\n${summary}`;
    }
    return prompt ? `${body}\n\n${prompt}` : body;
  }

  /** "Mojarra (Frita)" + qty 3 en carrito → "Mojarra ×3" (sin attrs ni precio). */
  private compactAddedProductLabel(session: WhatsappSessionData, label: string): string {
    const raw = (label || '').trim();
    if (!raw) return raw;

    const explicitQty = raw.match(/×\s*(\d+)/i)?.[1] || raw.match(/_\(x(\d+)\)_/i)?.[1];
    const base = raw
      .replace(/_\(x\d+\)_/gi, '')
      .replace(/×\s*\d+/gi, '')
      .replace(/\s*[·(].*$/, '')
      .trim();
    if (!base) return raw.replace(/_\(x(\d+)\)_/i, '×$1');

    let qty = explicitQty ? Math.max(1, parseInt(explicitQty, 10) || 1) : 0;
    if (qty <= 1) {
      const baseNorm = this.normalizeForMatch(base);
      const cart = this.consolidateCart(session.cart);
      const hit = cart.find((c) => this.normalizeForMatch(c.name) === baseNorm);
      qty = Math.max(1, hit?.quantity || 0);
    }
    return qty > 1 ? `${base} ×${qty}` : base;
  }

  private formatAddedProductLabel(name: string, quantity = 1): string {
    const qty = Math.max(1, quantity || 1);
    return qty > 1 ? `${name} ×${qty}` : name;
  }

  private formatOrderSummary(
    conv: WhatsappConversation,
    session: WhatsappSessionData,
    deliveryFee: number,
    paymentMethods: WhatsappPaymentMethodConfig[] = [],
  ): string {
    const tipo =
      session.orderType === 'pickup' ? 'Recoger en el local' : 'Domicilio';
    const lugarLabel = session.orderType === 'pickup' ? '📍' : '📍 Dirección';
    const phone = session.contactPhone || conv.phoneE164;
    const name = this.displayCustomerName(conv);
    return (
      `${this.formatCartOnly(session, deliveryFee)}\n` +
      `\n🛵 Tipo: ${tipo}` +
      `\n👤 Nombre: ${name}` +
      `\n${lugarLabel}: ${session.address || '(pendiente)'}` +
      `\n📞 Teléfono: ${phone ? this.formatWaPhoneDisplay(phone) : '(pendiente)'}` +
      `\n💳 Pago: ${paymentMethodLabel(session.paymentMethod, paymentMethods)}` +
      (session.cashChangeFor ? `\n💵 Cambio de: ${session.cashChangeFor}` : '') +
      (session.customerNotes ? `\n📝 Notas: ${session.customerNotes}` : '') +
      (session.pendingRedemptionCode
        ? `\n${formatPremioAppliedNote(
            session.pendingRedemptionCode,
            session.pendingRedemptionExpiresAt
              ? new Date(session.pendingRedemptionExpiresAt)
              : null,
          )}`
        : '')
    );
  }

  /** Nunca mostrar placeholders (“Necesito”, “Pedidos”) como si fueran el nombre. */
  private displayCustomerName(conv: WhatsappConversation): string {
    const n = (conv.customerName || '').trim();
    return isUsableWhatsappCustomerName(n) ? n : '(pendiente)';
  }

  private isReadyToConfirm(session: WhatsappSessionData, conv: WhatsappConversation): boolean {
    return (
      session.cart.length > 0 &&
      isUsableWhatsappCustomerName(conv.customerName || '') &&
      !!session.fulfillmentChosen &&
      !!session.address?.trim() &&
      !!session.addressConfirmed &&
      !!session.phoneConfirmed &&
      !!session.paymentMethod
    );
  }

  private formatWaPhoneDisplay(phoneE164: string): string {
    const digits = (phoneE164 || '').replace(/\D/g, '');
    if (digits.length >= 10) {
      const local = digits.slice(-10);
      return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
    }
    return phoneE164 || '(sin número)';
  }

  private looksLikePhoneNumber(text: string): boolean {
    const digits = text.replace(/\D/g, '');
    return digits.length >= 7 && digits.length <= 15 && /[\d\s+()-]{7,}/.test(text.trim());
  }

  /** "Cel 321…" / "[teléfono]" sin platos ni dirección. */
  private isPhoneOnlyCustomerMessage(text: string): boolean {
    const raw = (text || '').trim();
    if (!raw || raw.length > 40) return false;
    if (!this.looksLikePhoneNumber(raw)) return false;
    if (
      /\b(pollo|sopa|bandeja|domicilio|calle|carrera|conjunto|quiero|dame|agrega|men[uú]|listo|confirmar)\b/i.test(
        raw,
      )
    ) {
      return false;
    }
    const withoutLabel = raw
      .replace(/^(?:mi\s+)?(?:cel(?:ular)?|tel(?:[eé]fono)?|whatsapp|wa|n[uú]mero)\s*(?:es|:)?\s*/i, '')
      .trim();
    return this.looksLikePhoneNumber(withoutLabel || raw);
  }

  private normalizeContactPhone(raw: string, fallbackE164: string): string | null {
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) return null;
    if (digits.length === 10) return `+57${digits}`;
    if (digits.length === 12 && digits.startsWith('57')) return `+${digits}`;
    if (raw.trim().startsWith('+') && digits.length >= 10) return `+${digits}`;
    if (digits.length >= 10) return `+${digits}`;
    // Número corto: asumir mismo país que el WA
    const base = fallbackE164.replace(/\D/g, '');
    if (base.length >= 10 && digits.length >= 7) {
      return `+${base.slice(0, base.length - 10)}${digits}`.replace(/\+\+/, '+');
    }
    return `+${digits}`;
  }

  private buildAskNameMessage(session: WhatsappSessionData, deliveryFee: number): string {
    return `${this.formatCartTiny(session, deliveryFee)}\nEscribe tu *nombre completo*.`;
  }

  private buildAskAddressMessage(
    session: WhatsappSessionData,
    deliveryFee: number,
    retry = false,
  ): string {
    const head = retry
      ? 'No me quedó clara la dirección 🙏'
      : `${this.formatCartTiny(session, deliveryFee)}`;

    if (session.address?.trim() && !session.addressConfirmed) {
      return (
        `${head}\n📍 _${session.address.trim()}_\n` +
        `¿Está bien? Escribe *sí* o la dirección correcta.`
      );
    }

    const last = session.lastDeliveryAddress?.trim();
    if (last) {
      return (
        `${head}\n📍 _${last}_\n` +
        `¿Te lo enviamos a esta misma dirección o a una nueva?`
      );
    }

    return `${head}\nEscribe la *dirección* del domicilio.`;
  }

  private buildAskPhoneMessage(
    conv: WhatsappConversation,
    session: WhatsappSessionData,
    deliveryFee: number,
  ): string {
    const wa = this.formatWaPhoneDisplay(conv.phoneE164);
    return (
      `${this.formatCartTiny(session, deliveryFee)}\n` +
      `¿Usamos *${wa}*? Escribe *sí* u otro número.`
    );
  }

  private async tryResolvePhoneConfirmation(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    const trimmed = text.trim();
    if (/^(si|sí|sep|ok|okay|dale|listo|ese|ese mismo|el mismo|confirmo)[\s!.?]*$/i.test(trimmed)) {
      session = {
        ...session,
        phoneConfirmed: true,
        contactPhone: conv.phoneE164,
      };
      await this.conversationService.saveSession(conv, session, 'building_cart');
      const fresh = await this.conversationService.reloadConversation(conv.id);
      Object.assign(conv, fresh);
      session = this.conversationService.getSession(conv);
      await this.tryConfirmOrder(conv, waId, session, {
        preface: `Teléfono listo ✅ *${this.formatWaPhoneDisplay(conv.phoneE164)}*`,
      });
      return true;
    }

    if (this.looksLikePhoneNumber(trimmed)) {
      const normalized = this.normalizeContactPhone(trimmed, conv.phoneE164);
      if (!normalized) {
        await this.reply(
          conv,
          waId,
          'No me quedó claro. Escribe el número (10 dígitos) o *sí* para el de WhatsApp.',
        );
        return true;
      }
      session = {
        ...session,
        phoneConfirmed: true,
        contactPhone: normalized,
      };
      await this.conversationService.saveSession(conv, session, 'building_cart');
      const fresh = await this.conversationService.reloadConversation(conv.id);
      Object.assign(conv, fresh);
      session = this.conversationService.getSession(conv);
      await this.tryConfirmOrder(conv, waId, session, {
        preface: `Teléfono listo ✅ *${this.formatWaPhoneDisplay(normalized)}*`,
      });
      return true;
    }

    return false;
  }

  /**
   * Durante checkout (p. ej. pidiendo teléfono): permitir agregar gaseosa/add-on
   * sin perder el hilo — "1 colombiana 1,5".
   */
  /** Gaseosa suelta (“Una Coca-Cola 400”) se agrega con su sabor y tamaño. */
  private async tryHandleStandaloneDrink(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    products: MenuProduct[],
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    const resolved = this.catalogService.resolveStandaloneDrinkOrder(text, products);
    if (!resolved) return false;
    const { product } = resolved;
    let attributes = resolved.attributes;
    if (
      product.hasAttributes &&
      product.attributes?.length &&
      !this.catalogService.isAttributeSelectionComplete(product, attributes)
    ) {
      session = {
        ...session,
        pendingAttribute: this.toPendingAttribute(product, {
          sourceText: text,
          selected: attributes,
        }),
        pendingMatch: undefined,
      };
      await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
      await this.reply(
        conv,
        waId,
        this.catalogService.formatProductOptionsPrompt(
          product,
          attributes,
          this.attributeFlowOpts(session.pendingAttribute),
        ),
      );
      return true;
    }

    const qty = Math.max(1, this.catalogService.extractQuantityFromSegment(text));
    const added = this.tryAddProductToCart(
      session,
      product,
      qty,
      cfg,
      undefined,
      attributes,
      { sourceText: text },
    );
    if (added.blocked) {
      await this.handleCartLimitBlocked(conv, waId, added.blocked, cfg);
      return true;
    }
    if (added.missingAttributes) {
      session = {
        ...session,
        pendingAttribute: this.toPendingAttribute(product, {
          sourceText: text,
          selected: added.missingAttributes,
        }),
      };
      await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
      await this.reply(
        conv,
        waId,
        this.catalogService.formatProductOptionsPrompt(
          product,
          added.missingAttributes,
          this.attributeFlowOpts(session.pendingAttribute),
        ),
      );
      return true;
    }
    session = added.session;
    await this.conversationService.saveSession(conv, session, 'building_cart');
    const qtyNote = qty > 1 ? ` _(x${qty})_` : '';
    const flavor = attributes.map((a) => a.attributeValue).filter(Boolean).join(', ');
    await this.reply(
      conv,
      waId,
      this.buildCartAddReply(session, this.deliveryFeeFor(session, cfg), `${product.name}${qtyNote}`, {
        extraLine: flavor ? `_${flavor}_` : undefined,
      }),
    );
    return true;
  }

  /**
   * En “¿Cómo pagas?”, un plato (“un plátano maduro”) se suma al carrito
   * y se vuelve a pedir el pago. No se trata como respuesta de pago.
   */
  private async tryAddDishDuringPayment(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    products: MenuProduct[],
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    const raw = (text || '').trim();
    if (raw.length < 3) return false;
    if (this.resolvePaymentChoice(raw, cfg)) return false;
    if (this.looksLikePaymentMethodQuestion(raw)) return false;
    if (this.looksLikePhoneNumber(raw)) return false;
    if (looksLikeAddressOnlyMessage(raw) || this.isAddressOnlyCustomerMessage(raw)) return false;
    if (isCourtesyAffirmation(raw) || this.isConfirmKeyword(raw)) return false;

    let dish = this.catalogService.findProductEmbeddedInMessage(raw, products);
    if (!dish) {
      const top = this.catalogService.searchByNameScored(raw, products, 1)[0];
      if (
        top &&
        top.score >= 35 &&
        !this.catalogService.uncoveredWordsAnchoredByProduct(raw, top.p).length
      ) {
        dish = top.p;
      }
    }
    if (!dish) return false;

    const qty = Math.max(1, this.catalogService.extractQuantityFromSegment(raw));
    const attempt = this.tryAddProductToCart(session, dish, qty, cfg, undefined, undefined, {
      sourceText: raw,
    });
    if (attempt.blocked) {
      await this.handleCartLimitBlocked(conv, waId, attempt.blocked, cfg);
      return true;
    }
    if (attempt.missingAttributes) {
      session = {
        ...session,
        pendingAttribute: this.toPendingAttribute(dish, {
          sourceText: raw,
          selected: attempt.missingAttributes,
        }),
        pendingMatch: undefined,
      };
      await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
      await this.reply(
        conv,
        waId,
        this.catalogService.formatProductOptionsPrompt(
          dish,
          attempt.missingAttributes,
          this.attributeFlowOpts(session.pendingAttribute),
        ),
      );
      return true;
    }

    session = attempt.session;
    await this.conversationService.saveSession(conv, session, 'building_cart');
    const fresh = await this.conversationService.reloadConversation(conv.id);
    Object.assign(conv, fresh);
    session = this.conversationService.getSession(conv);
    const label = qty > 1 ? `${dish.name} ×${qty}` : dish.name;
    await this.tryConfirmOrder(conv, waId, session, {
      preface: `Listo, agregué *${label}* ✅`,
    });
    return true;
  }

  private async tryHandleCheckoutSideAdd(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    products: MenuProduct[],
    cfg: EffectiveWhatsappConfig,
    resume: 'phone' | 'notes' | 'payment' = 'phone',
  ): Promise<boolean> {
    const raw = (text || '').trim();
    if (raw.length < 3) return false;
    if (this.looksLikePhoneNumber(raw)) return false;
    if (looksLikeAddressOnlyMessage(raw) || this.isAddressOnlyCustomerMessage(raw)) return false;

    const q = this.normalizeForMatch(raw);
    const looksDrink =
      /\b(colombiana|manzana|pepsi|coca|gaseosa|sprite|jugo|limonada|uva|ginger|postobon)\b/.test(
        q,
      ) ||
      (this.catalogService.extractRequestedDrinkVolumeMl(raw) != null &&
        /\b(litro|litros|ml|gaseosa|bebida)\b/.test(q));
    if (!looksDrink) return false;

    const drinks = products.filter(
      (p) => p.availableNow !== false && this.catalogService.isLikelyDrinkProduct(p),
    );
    const drink =
      this.catalogService.pickBestDrinkProduct(drinks, raw) ||
      this.catalogService.findProductEmbeddedInMessage(raw, products);
    if (!drink || !this.catalogService.isLikelyDrinkProduct(drink)) return false;

    const qty = Math.max(1, this.catalogService.extractQuantityFromMessage(raw));
    let attrs =
      this.catalogService.extractExplicitAttributeChoice(raw, drink) ||
      this.catalogService.resolveAttributesFromText(drink, raw) ||
      undefined;

    // Sabor desde marca en el texto si el SKU tiene atributo Sabor/Gaseosa
    if ((!attrs || !attrs.length) && drink.hasAttributes && drink.attributes?.length) {
      const flavorAttr = drink.attributes.find((a) =>
        /\b(sabor|gaseosa|bebida)\b/i.test(a.attributeName || ''),
      );
      if (flavorAttr) {
        const picked = this.catalogService.pickAttributeOptionFromText(raw, flavorAttr);
        if (picked) {
          attrs = [{ attributeName: flavorAttr.attributeName, attributeValue: picked }];
        }
      }
    }

    if (drink.hasAttributes && drink.attributes?.length) {
      const remaining = this.catalogService.getRemainingAttributes(drink, attrs || []);
      if (remaining.length) {
        // Pedir sabor/attrs; luego el checkout retoma
        session = {
          ...session,
          pendingAttribute: this.toPendingAttribute(drink, {
            sourceText: raw,
            selected: attrs || [],
          }),
          pendingMatch: undefined,
        };
        await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
        await this.reply(
          conv,
          waId,
          this.catalogService.formatProductOptionsPrompt(
            drink,
            attrs || [],
            this.attributeFlowOpts(session.pendingAttribute),
          ),
        );
        return true;
      }
    }

    const added = this.tryAddProductToCart(session, drink, qty, cfg, undefined, attrs, {
      sourceText: raw,
    });
    if (added.blocked) {
      await this.handleCartLimitBlocked(conv, waId, added.blocked, cfg);
      return true;
    }
    if (added.missingAttributes) {
      session = {
        ...session,
        pendingAttribute: this.toPendingAttribute(drink, {
          sourceText: raw,
          selected: added.missingAttributes,
        }),
      };
      await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
      await this.reply(
        conv,
        waId,
        this.catalogService.formatProductOptionsPrompt(
          drink,
          added.missingAttributes,
          this.attributeFlowOpts(session.pendingAttribute),
        ),
      );
      return true;
    }
    session = added.session;
    await this.conversationService.saveSession(conv, session, 'awaiting_phone');

    const phoneAsk =
      resume === 'phone'
        ? `\n\n${this.buildAskPhoneMessage(conv, session, this.deliveryFeeFor(session, cfg))}`
        : '';
    await this.reply(
      conv,
      waId,
      `Listo, agregué *${drink.name}* ✅\n\n` +
        `${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}` +
        phoneAsk,
    );
    return true;
  }

  private async tryConfirmOrder(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    opts?: { preface?: string; skipFinalConfirm?: boolean },
  ): Promise<void> {
    const cfg = await this.settingsService.getEffectiveConfig();
    const say = async (body: string) => {
      await this.reply(conv, waId, this.withPreface(opts?.preface, body));
      opts = { ...opts, preface: undefined };
    };

    if (!session.cart.length) {
      await say('Aún no tienes nada en el carrito. Dime qué quieres por nombre o código.');
      return;
    }

    const limitsCfg = this.toCartLimitsConfig(cfg, session);
    const maxCheck = evaluateCartLimits(session.cart, limitsCfg, {
      orderType: session.orderType,
    });
    if (!maxCheck.ok) {
      await this.handleCartLimitBlocked(conv, waId, maxCheck, cfg);
      return;
    }
    const minCheck = evaluateCartLimits(session.cart, limitsCfg, {
      orderType: session.orderType,
      checkMin: true,
    });
    if (!minCheck.ok && minCheck.kind === 'min') {
      await say(minCheck.reason || 'El pedido no alcanza el mínimo.');
      return;
    }

    // 1) Nombre (rechazar placeholders tipo “Pedidos”)
    if (!isUsableWhatsappCustomerName(conv.customerName || '')) {
      if (conv.customerName?.trim()) {
        await this.conversationService.updateCustomerName(conv, '');
        const cleared = await this.conversationService.reloadConversation(conv.id);
        Object.assign(conv, cleared);
      }
      session.pendingMatch = undefined;
      session.pendingAttribute = undefined;
      await this.conversationService.saveSession(conv, session, 'awaiting_name');
      await say(this.buildAskNameMessage(session, this.deliveryFeeFor(session, cfg)));
      return;
    }

    // 2) Entrega: por defecto domicilio (no preguntar). Recojo solo si ya lo dijo el cliente.
    if (!session.fulfillmentChosen) {
      session.pendingMatch = undefined;
      session.pendingAttribute = undefined;
      if (session.orderType === 'pickup') {
        session = {
          ...session,
          fulfillmentChosen: true,
          addressConfirmed: true,
          address: session.address?.trim() || 'Recoge en el local',
        };
        await this.conversationService.saveSession(conv, session);
      } else {
        session = {
          ...session,
          orderType: 'delivery',
          fulfillmentChosen: true,
        };
        if (session.address?.trim() && this.isStrongExplicitAddress(session.address)) {
          session = { ...session, addressConfirmed: true };
        }
        await this.conversationService.saveSession(conv, session);
        // Sigue al paso 3 (dirección) abajo
      }
    }

    // 3) Dirección
    if (session.orderType !== 'pickup') {
      if (session.address?.trim() && !session.addressConfirmed && this.isStrongExplicitAddress(session.address)) {
        session = { ...session, addressConfirmed: true, fulfillmentChosen: true };
        const feeOk = await this.recalculateDeliveryFee(session, cfg);
        session = feeOk.session;
        await this.conversationService.saveSession(conv, session);
        if (feeOk.blocked) {
          await say(`Dirección: _${session.address}_\n\n${feeOk.blocked}`);
          return;
        }
        if (feeOk.notice) {
          opts = { ...opts, preface: this.withPreface(opts?.preface, feeOk.notice) };
        }
      }
      if (!session.address?.trim() || !session.addressConfirmed) {
        session.pendingMatch = undefined;
        session.pendingAttribute = undefined;
        await this.conversationService.saveSession(conv, session, 'awaiting_address');
        await say(this.buildAskAddressMessage(session, this.deliveryFeeFor(session, cfg)));
        return;
      }
      if (
        session.deliveryOutOfCoverage ||
        session.deliveryFeeCalculated == null ||
        session.deliveryFeeCalculated === undefined
      ) {
        const feeOk = await this.recalculateDeliveryFee(session, cfg);
        session = feeOk.session;
        await this.conversationService.saveSession(conv, session);
        if (feeOk.blocked) {
          await say(feeOk.blocked);
          return;
        }
        if (feeOk.notice) {
          opts = { ...opts, preface: this.withPreface(opts?.preface, feeOk.notice) };
        }
      }
    } else if (!session.address?.trim()) {
      session = {
        ...session,
        address: 'Recoge en el local',
        addressConfirmed: true,
        fulfillmentChosen: true,
      };
      await this.conversationService.saveSession(conv, session);
    }

    // 4) Teléfono — por defecto el de WhatsApp (sin preguntar)
    if (!session.phoneConfirmed) {
      session = {
        ...session,
        phoneConfirmed: true,
        contactPhone: session.contactPhone || conv.phoneE164,
      };
      await this.conversationService.saveSession(conv, session);
    }

    // 5) Pago
    if (!session.paymentMethod) {
      session.pendingMatch = undefined;
      session.pendingAttribute = undefined;
      await this.conversationService.saveSession(conv, session, 'awaiting_payment');
      await say(
        `${this.formatOrderSummary(conv, session, this.deliveryFeeFor(session, cfg), cfg.paymentMethods)}\n\n` +
          buildPaymentOptionsPrompt(cfg.paymentMethods, cfg.paymentInstructions),
      );
      return;
    }

    // 6) Notas — opcional: no bloquear el pedido
    if (!session.notesCollected) {
      session = { ...session, notesCollected: true };
      await this.conversationService.saveSession(conv, session);
    }

    // 7) Resumen + confirmar (o crear ya si venimos del pago / MP ya elegido)
    const payMethodEarly =
      getEnabledPaymentMethods(cfg.paymentMethods).find(
        (m) => m.id === session.paymentMethod,
      ) || findPaymentMethodByText(session.paymentMethod || '', cfg.paymentMethods);
    const paymentIsMercadoPago =
      payMethodEarly?.flow === 'mercadopago' || session.paymentMethod === 'mercadopago';
    // MP: no pedir "confirmar" otra vez — (re)generar link con el carrito actual
    const canSkipFinal =
      this.isReadyToConfirm(session, conv) &&
      (!!opts?.skipFinalConfirm || paymentIsMercadoPago);
    if (conv.state !== 'awaiting_final_confirm' && !canSkipFinal) {
      if (
        session.pendingRedemptionCode &&
        !this.pointsHandler.cartHasHalfChicken(session.cart)
      ) {
        await this.conversationService.saveSession(conv, session, 'awaiting_final_confirm');
        await say(
          `${this.formatOrderSummary(conv, session, this.deliveryFeeFor(session, cfg), cfg.paymentMethods)}\n\n` +
            `${formatCartNeedsHalfChickenForPremio()}\n\n` +
            `Agrega medio pollo y escribe *confirmar*.`,
        );
        return;
      }
      await this.conversationService.saveSession(conv, session, 'awaiting_final_confirm');
      await say(
        `${this.formatOrderSummary(conv, session, this.deliveryFeeFor(session, cfg), cfg.paymentMethods)}\n\n` +
          `Si está bien, escribe *confirmar*.`,
      );
      return;
    }

    if (
      session.pendingRedemptionCode &&
      !this.pointsHandler.cartHasHalfChicken(session.cart)
    ) {
      await say(
        `${formatCartNeedsHalfChickenForPremio()}\n\nAgrega medio pollo y escribe *confirmar*.`,
      );
      return;
    }

    // Refresh both caches before committing the quoted cart. A changed price
    // requires a new customer confirmation, including the payment-link path.
    const currentProducts = await this.catalogService.getMenuProducts(true);
    const currentById = new Map(currentProducts.map(p => [p.id, p]));
    const unavailable = session.cart.find(line => !currentById.has(line.productId) ||
      currentById.get(line.productId)!.availableNow === false);
    if (unavailable) {
      await say(`*${unavailable.name}* ya no está disponible. Conservé tu carrito; cambia o retira ese producto para continuar.`);
      return;
    }
    const priceChanged = session.cart.some(line => Number(currentById.get(line.productId)!.price) !== Number(line.unitPrice));
    if (priceChanged) {
      session = { ...session, cart: session.cart.map(line => ({ ...line,
        unitPrice: Number(currentById.get(line.productId)!.price) })) };
      await this.conversationService.saveSession(conv, session, 'awaiting_final_confirm');
      await say(`El precio del menú cambió. Revisa el nuevo resumen:\n\n${this.formatOrderSummary(conv, session, this.deliveryFeeFor(session, cfg), cfg.paymentMethods)}\n\nSi está bien, escribe *confirmar*.`);
      return;
    }

    // Crear pedido
    session = { ...session, cart: this.consolidateCart(session.cart) };
    const items = session.cart.flatMap((c) =>
      Array.from({ length: Math.max(1, c.quantity || 1) }, () => ({
        productId: c.productId,
        note: c.note,
        attributes: c.attributes,
      })),
    );

    const orderDto: CreateOrderDto = {
      customerName: conv.customerName!.trim(),
      phone: (session.contactPhone || conv.phoneE164).trim(),
      // Pago/cambio/notas van en address con " / " — no usar extras (son productos adicionales)
      address: composeWhatsappOrderAddress(session, cfg.paymentMethods),
      orderType: session.orderType,
      deliveryFee: session.orderType === 'delivery' ? this.deliveryFeeFor(session, cfg) : undefined,
      orderSource: 'whatsapp',
      items,
      ...(session.pendingRedemptionCode
        ? { redemptionCode: session.pendingRedemptionCode }
        : {}),
      clientRequestId: `wa-${conv.id}-${randomUUID()}`.slice(0, 64),
    };

    try {
      const payMethod =
        getEnabledPaymentMethods(cfg.paymentMethods).find(
          (m) => m.id === session.paymentMethod,
        ) || findPaymentMethodByText(session.paymentMethod || '', cfg.paymentMethods);

      if (payMethod?.flow === 'mercadopago' || session.paymentMethod === 'mercadopago') {
        const subtotal = session.cart.reduce(
          (s, c) => s + c.unitPrice * Math.max(1, c.quantity || 1),
          0,
        );
        const deliveryFeeMp =
          session.orderType === 'delivery'
            ? Math.max(0, Math.round(Number(this.deliveryFeeFor(session, cfg)) || 0))
            : 0;
        orderDto.deliveryFee = deliveryFeeMp || undefined;
        const total = Math.round(subtotal) + deliveryFeeMp;
        const mpItems = session.cart.map((c) => ({
          title: c.name,
          quantity: Math.max(1, c.quantity || 1),
          unit_price: Math.round(Number(c.unitPrice) || 0),
        }));
        const hadPriorLink = !!session.mpPreferenceId;
        const pref = await this.paymentsService.createPreference(
          orderDto,
          mpItems,
          total,
          {
            name: conv.customerName!.trim(),
            email: `${(session.contactPhone || conv.phoneE164).replace(/\D/g, '')}@whatsapp.ppp.local`,
            phone: session.contactPhone || conv.phoneE164,
          },
          {
            channel: 'whatsapp',
            conversationId: conv.id,
            waId: conv.waId,
            bypassOnlineHours: !!cfg.ignoreBusinessHours,
          },
        );
        session.mpPreferenceId = pref.preferenceId;
        await this.conversationService.saveSession(conv, session, 'awaiting_mp_payment');
        const linkLead = hadPriorLink
          ? `🛒 El carrito cambió — *nuevo* link de pago (el anterior ya no aplica):\n${pref.initPoint}`
          : `Link de pago Mercado Pago:\n${pref.initPoint}`;
        await say(
          `${this.formatOrderSummary(conv, session, this.deliveryFeeFor(session, cfg), cfg.paymentMethods)}\n\n` +
            `${linkLead}\n\nCuando el pago se confirme, te avisamos aquí y armamos el pedido.`,
        );
        return;
      }

      const order = await this.ordersService.create(orderDto);
      const snapshot = { ...session };
      await this.conversationService.resetOrderSession(conv, 'completed', {
        ignorePriorHistory: true,
        rememberDeliveryAddress: true,
      });
      await say(
        this.formatOrderSuccessMessage(
          conv,
          snapshot,
          order,
          this.deliveryFeeFor(snapshot, cfg),
          cfg.orderSuccessMessage,
          cfg.paymentMethods,
        ),
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al crear pedido';
      this.logger.error(`Order create failed: ${message}`);
      await say(`Uy, no pude registrar el pedido: ${message}. ${this.humanContactMessage()}`);
    }
  }

  /** Tras pago MP aprobado (llamado desde payments webhook). */
  async completeAfterMercadoPagoPayment(params: {
    conversationId: number;
    waId: string;
    orderId: number;
    dailyOrderNumber?: number | null;
  }): Promise<void> {
    try {
      const conv = await this.conversationService.getConversation(params.conversationId);
      const session = this.conversationService.getSession(conv);
      const cfg = await this.settingsService.getEffectiveConfig();
      const snapshot = { ...session };
      await this.conversationService.resetOrderSession(conv, 'completed', {
        ignorePriorHistory: true,
        rememberDeliveryAddress: true,
      });
      let daily =
        params.dailyOrderNumber != null && Number(params.dailyOrderNumber) > 0
          ? Number(params.dailyOrderNumber)
          : null;
      if (daily == null && params.orderId) {
        try {
          const brief = await this.ordersService.getOrdersBrief([params.orderId]);
          const n = brief[0]?.dailyOrderNumber;
          if (n != null && Number(n) > 0) daily = Number(n);
        } catch {
          /* seguir con fallback */
        }
      }
      const success =
        this.formatOrderSuccessMessage(
          conv,
          snapshot,
          { orderId: params.orderId, dailyOrderNumber: daily ?? undefined },
          this.deliveryFeeFor(snapshot, cfg),
          cfg.orderSuccessMessage,
          cfg.paymentMethods,
        ) ||
        `Pago recibido ✅ Pedido #${daily ?? params.orderId} creado. ${cfg.orderSuccessMessage}`;
      await this.reply(conv, params.waId || conv.waId, success);
    } catch (err) {
      this.logger.error(
        `completeAfterMercadoPagoPayment failed conv=${params.conversationId} order=${params.orderId}`,
        err,
      );
    }
  }

  async sendHumanReply(
    conversationId: number,
    body: string,
    agent: { id: string; fullName: string },
  ) {
    const text = (body || '').trim();
    if (!text) {
      throw new BadRequestException('Mensaje vacío');
    }

    const conv = await this.conversationService.getConversation(conversationId);
    if (!conv.humanTakeover) {
      await this.conversationService.setHumanTakeover(conversationId, true, agent);
    }

    // Meta primero: si esto ok, el cliente ya tiene el mensaje.
    await this.metaService.sendText(conv.waId, text);

    // Persistencia local: no tumbar la respuesta HTTP si falla después del envío.
    try {
      await this.conversationService.logMessage({
        conversationId, // id de la ruta, no confiar solo en conv.id
        direction: 'out',
        body: text,
        sentBy: 'human',
      });
      await this.conversationService.touchOutbound(conv, 'human');
    } catch (err) {
      this.logger.error(
        `sendHumanReply: enviado a Meta pero falló log/touch conv=${conversationId}`,
        err instanceof Error ? err.stack : err,
      );
    }
  }

  /** Asesor envía foto / documento / video / audio. */
  async sendHumanMedia(
    conversationId: number,
    file: {
      buffer: Buffer;
      mimetype: string;
      originalname: string;
      size: number;
    },
    agent: { id: string; fullName: string },
    caption?: string | null,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Archivo vacío');
    }

    const classified = classifyOutboundMedia(file.mimetype, file.size);
    if ('error' in classified) {
      throw new BadRequestException(classified.error);
    }
    const kind: OutboundMediaKind = classified.kind;
    const filename = (file.originalname || 'archivo').slice(0, 180);
    const cap = (caption || '').trim() || null;

    const conv = await this.conversationService.getConversation(conversationId);
    if (!conv.humanTakeover) {
      await this.conversationService.setHumanTakeover(conversationId, true, agent);
    }

    const { mediaId } = await this.metaService.uploadMedia({
      buffer: file.buffer,
      mimeType: file.mimetype,
      filename,
    });

    await this.metaService.sendMediaMessage({
      toWaId: conv.waId,
      mediaId,
      kind,
      caption: cap,
      filename: kind === 'document' ? filename : null,
    });

    const body = outboundMediaBodyLabel({ kind, caption: cap, filename });
    try {
      await this.conversationService.logMessage({
        conversationId,
        direction: 'out',
        body,
        sentBy: 'human',
        messageType: kind,
        mediaId,
        mimeType: file.mimetype,
        raw: { filename, caption: cap },
      });
      await this.conversationService.touchOutbound(conv, 'human');
    } catch (err) {
      this.logger.error(
        `sendHumanMedia: enviado a Meta pero falló log conv=${conversationId}`,
        err instanceof Error ? err.stack : err,
      );
    }

    return { success: true, messageType: kind, mediaId };
  }

  /**
   * Asesor devuelve el chat al bot (manual o idle).
   * Avisa al cliente que la asistencia humana terminó.
   */
  async releaseToBot(
    conversationId: number,
    opts?: { reason?: 'manual' | 'agent_idle'; notify?: boolean },
  ): Promise<{ released: boolean }> {
    const reason = opts?.reason ?? 'manual';
    const notify = opts?.notify !== false;
    const conv = await this.conversationService.getConversation(conversationId);
    if (!conv.humanTakeover) return { released: false };

    await this.conversationService.releaseHumanTakeover(conversationId);

    if (!notify) return { released: true };

    const body = botResumeCustomerMessage(reason);
    try {
      const live = await this.conversationService.reloadConversation(conversationId);
      await this.metaService.sendText(live.waId, body);
      await this.conversationService.logMessage({
        conversationId: live.id,
        direction: 'out',
        body,
        sentBy: 'system',
      });
      await this.conversationService.touchOutbound(live, 'bot');
    } catch (err) {
      this.logger.warn(
        `releaseToBot: liberado pero no se pudo avisar conv=${conversationId}: ${String(err)}`,
      );
    }
    return { released: true };
  }

  private shortQuote(text: string, max = 160): string {
    const t = text.replace(/\s+/g, ' ').trim();
    if (t.length <= max) return t;
    return `${t.slice(0, max - 1)}…`;
  }

  private async resolveAudioToText(
    msg: IncomingWhatsappMessage,
    loggedMessageId: string,
  ): Promise<string | null> {
    try {
      const { buffer, mimeType } = await this.metaService.downloadMedia(msg.mediaId!);
      const transcript = await this.aiService.transcribeAudio(
        buffer,
        msg.mimeType || mimeType,
      );
      if (!transcript) return null;
      await this.conversationService.updateMessageBody(
        loggedMessageId,
        `🎤 ${transcript}`,
      );
      return transcript;
    } catch (err) {
      this.logger.error(`Audio resolve failed: ${err}`);
      return null;
    }
  }

  /** Temporal: no pasar a asesor por chat. */
  private static readonly HUMAN_CONTACT_PHONE = WHATSAPP_HUMAN_CONTACT_PHONE;

  private humanContactMessage(): string {
    return WHATSAPP_HUMAN_CONTACT_MESSAGE;
  }

  /**
   * "Nombre: Sandra Sánchez" / "Me llamo Juan" — corrige placeholders tipo “Necesito”.
   */
  private async tryHandleExplicitCustomerNameLabel(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
  ): Promise<boolean> {
    const raw = (text || '').trim();
    if (raw.length < 5 || raw.length > 90) return false;
    const m = raw.match(
      /^(?:mi\s+)?nombre\s*[:\-]\s*(.+)$/i,
    ) || raw.match(
      /^(?:me\s+llamo|soy)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s.'-]{1,60})$/i,
    );
    if (!m?.[1]) return false;
    const name = m[1].replace(/\s+/g, ' ').trim().replace(/[.,;]+$/, '');
    if (!isUsableWhatsappCustomerName(name) || this.looksLikeAddressRejectingPersonName(name)) {
      return false;
    }
    // Solo en checkout / carrito (no hijackear charla suelta)
    const inCheckout =
      session.cart.length > 0 ||
      ['awaiting_name', 'awaiting_payment', 'awaiting_address', 'awaiting_final_confirm', 'awaiting_phone'].includes(
        conv.state,
      );
    if (!inCheckout) return false;

    await this.conversationService.updateCustomerName(conv, name);
    const fresh = await this.conversationService.reloadConversation(conv.id);
    Object.assign(conv, fresh);
    session = this.conversationService.getSession(conv);

    if (conv.state === 'awaiting_name' || !session.paymentMethod) {
      await this.tryConfirmOrder(conv, waId, session, {
        preface: `Perfecto, *${name}* ✅`,
      });
      return true;
    }

    await this.conversationService.saveSession(conv, session, conv.state);
    await this.reply(
      conv,
      waId,
      `Perfecto *${name}*, ya la tengo. Si todo está bien, escribe *confirmar*.`,
    );
    return true;
  }

  private humanHelpHint(): string {
    return this.humanContactMessage();
  }

  /**
   * Pedido ya creado (completed/closed): demora, ETA, faltante, amenaza de cancelar.
   * No reabre carrito ni busca productos.
   */
  private async handlePostOrderFollowUp(
    conv: WhatsappConversation,
    waId: string,
    text: string,
    cfg: EffectiveWhatsappConfig,
  ): Promise<void> {
    const t = (text || '').toLowerCase();
    const wantsCancel =
      /\b(cancel|me\s+tengo\s+que\s+ir|mejor\s+lo\s+cancelo)\b/i.test(t);
    const complaint =
      /\b(trajo|no\s+me\s+(regalaron|trajeron|enviaron)|falto|faltó|me\s+falta)\b/i.test(t);
    const arrived = /\b(ya\s+lleg|gracias\s+ya\s+lleg)\b/i.test(t);

    if (arrived) {
      await this.reply(conv, waId, '¡Qué bueno que ya te llegó! 🙌 Gracias por pedir con nosotros.');
      return;
    }

    if (wantsCancel || complaint) {
      await this.reply(
        conv,
        waId,
        (wantsCancel
          ? 'Entiendo, qué pena con la demora 🙏\n\n'
          : 'Qué pena con eso 🙏\n\n') + this.humanContactMessage(),
      );
      return;
    }

    // Demora / “ya salió” → estado real o pedir #
    const handled = await this.replyOrderProgressOrAskNumber(conv, waId, text, cfg, {
      postOrderFallback: true,
    });
    if (!handled) {
      await this.reply(
        conv,
        waId,
        `Tu pedido *ya quedó registrado* ✅ ${this.formatDeliveryEtaSentence(cfg)}\n` +
          'Si ya pasó más de eso o necesitas ubicar al domiciliario, ' + this.humanContactMessage(),
      );
    }
  }

  /** ETA domicilio: config admin o default 35–45 min. */
  private getDeliveryEtaRangeText(cfg: EffectiveWhatsappConfig): string {
    const note = (cfg.localContext?.deliveryTimeNote || '').trim();
    if (note) return note;
    return 'unos 35–45 minutos';
  }

  private formatDeliveryEtaSentence(cfg: EffectiveWhatsappConfig): string {
    const range = this.getDeliveryEtaRangeText(cfg);
    if (/demora|tarda|minut/i.test(range)) {
      return `Suele demorar *${range.replace(/^\s*unos\s+/i, '')}* según la zona.`;
    }
    return `Suele demorar *${range}* según la zona.`;
  }

  private async tryResolvePendingOrderStatusLookup(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    if (!session.pendingOrderStatusLookup) return false;
    const num = extractDailyOrderNumberHint(text);
    if (num == null && !/^\d{1,4}[\s!.?]*$/.test(text.trim())) {
      // Otro tema: soltar el pendiente
      if (
        looksLikeClearCartMessage(text) ||
        isHumanHandoffRequest(text) ||
        this.catalogService.looksLikeExplicitAddProductRequest(text)
      ) {
        await this.conversationService.saveSession(conv, {
          ...session,
          pendingOrderStatusLookup: undefined,
        });
        return false;
      }
      await this.reply(
        conv,
        waId,
        'Para ubicar tu pedido necesito el *número de orden* (ej. *15* o *#15*). Si no lo tienes, ' + this.humanContactMessage(),
      );
      return true;
    }
    const orderNum = num ?? parseInt(text.trim(), 10);
    await this.conversationService.saveSession(conv, {
      ...session,
      pendingOrderStatusLookup: undefined,
    });
    await this.replyOrderProgressOrAskNumber(conv, waId, `#${orderNum}`, cfg, {
      forceNumber: orderNum,
    });
    return true;
  }

  private async tryHandleDeliveryEtaInquiry(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    originalText: string,
    text: string,
    cfg: EffectiveWhatsappConfig,
    opts?: { forceGeneric?: boolean },
  ): Promise<boolean> {
    const probe = originalText || text;
    const specific =
      !opts?.forceGeneric &&
      (isSpecificOrderProgressInquiry(probe) || isSpecificOrderProgressInquiry(text));
    const genericEta =
      !!opts?.forceGeneric ||
      isDeliveryEtaInquiry(originalText) ||
      isDeliveryEtaInquiry(text);

    if (!specific && !genericEta) return false;

    // Pedido concreto (mi pedido / # / ya salió) → estado o pedir número
    if (specific) {
      return this.replyOrderProgressOrAskNumber(conv, waId, probe, cfg);
    }

    // Tiempo genérico de domicilio (sin “mi pedido”)
    let body = this.formatDeliveryEtaSentence(cfg);
    if (conv.state === 'awaiting_phone' && !session.phoneConfirmed) {
      body += `\nEscribe el *número* de contacto o *sí* para el de WhatsApp.`;
    } else if (session.address?.trim() && session.cart.length > 0) {
      body += `\n📍 _${session.address}_\n${this.formatContinueShoppingPrompt(session)}`;
    } else if (session.cart.length > 0) {
      body += `\n${this.formatContinueShoppingPrompt(session)}`;
    } else {
      body +=
        `\n\nSi preguntas por *un pedido ya hecho*, dime el *número de orden* (ej. *#15*) y te digo en qué va.`;
    }
    await this.reply(conv, waId, body);
    return true;
  }

  /**
   * Resuelve estado de orden de hoy por teléfono / #, o pide el número.
   * @returns true si ya respondió (incluido pedir #).
   */
  private async replyOrderProgressOrAskNumber(
    conv: WhatsappConversation,
    waId: string,
    text: string,
    cfg: EffectiveWhatsappConfig,
    opts?: { forceNumber?: number; postOrderFallback?: boolean; interruptedCall?: boolean },
  ): Promise<boolean> {
    const today = await this.ordersService.findTodayOrdersByPhone(conv.phoneE164);
    const hint = opts?.forceNumber ?? extractDailyOrderNumberHint(text);
    const active = today.filter((o) => !['canceled', 'completed'].includes(o.orderStatus));
    const pool = active.length ? active : today.filter((o) => o.orderStatus !== 'canceled');

    let match =
      hint != null ? today.find((o) => Number(o.dailyOrderNumber) === hint) : undefined;

    if (!match && hint == null && pool.length === 1) {
      match = pool[0];
    }

    const preface = opts?.interruptedCall
      ? 'Revisé si quedó registrado un pedido con este número tras la llamada.\n\n'
      : '';

    if (match) {
      const num = String(match.dailyOrderNumber).padStart(2, '0');
      const statusLabel = this.formatOrderStatusLabel(match.orderStatus);
      const eta = this.formatDeliveryEtaSentence(cfg);
      let body =
        preface +
        `🧾 Orden *#${num}*\n` +
        `Estado: *${statusLabel}*.\n` +
        (match.orderStatus === 'completed'
          ? 'Si ya te llegó, ¡buen provecho! 🙌'
          : match.orderStatus === 'canceled'
            ? 'Esa orden aparece *cancelada*.'
            : eta);

      if (
        !['completed', 'canceled'].includes(match.orderStatus) &&
        ['inDelivery', 'packing', 'cooked', 'cooking', 'pending'].includes(match.orderStatus)
      ) {
        body +=
          '\n\nSi ya pasó ese tiempo o necesitas ubicar al domiciliario, ' + this.humanContactMessage();
      }
      await this.reply(conv, waId, body);
      return true;
    }

    if (hint != null) {
      await this.reply(
        conv,
        waId,
        `No encontré la orden *#${hint}* asociada a este WhatsApp hoy 🙏\n` +
          `Revisa el número (el de *#XX* del mensaje de confirmación). ` +
          `Si prefieres, llámanos al *${WHATSAPP_HUMAN_CONTACT_PHONE}*.`,
      );
      return true;
    }

    if (pool.length > 1) {
      const list = pool
        .slice(0, 5)
        .map((o) => {
          const n = String(o.dailyOrderNumber).padStart(2, '0');
          return `• *#${n}* — ${this.formatOrderStatusLabel(o.orderStatus)}`;
        })
        .join('\n');
      await this.conversationService.saveSession(conv, {
        ...this.conversationService.getSession(conv),
        pendingOrderStatusLookup: true,
      });
      await this.reply(
        conv,
        waId,
        preface +
          `Tienes varios pedidos hoy:\n${list}\n\n¿Cuál consultamos? Escribe el *número* (ej. *15*).`,
      );
      return true;
    }

    // Sin pedido en este número → pedir #
    await this.conversationService.saveSession(conv, {
      ...this.conversationService.getSession(conv),
      pendingOrderStatusLookup: true,
    });
    await this.reply(
      conv,
      waId,
      (opts?.interruptedCall
        ? 'Con este WhatsApp *no veo un pedido registrado hoy* tras la llamada.\n' +
          'Si te dieron un *número de orden* (#15), escríbelo y lo busco.\n' +
          'Si no quedó tomado, dime qué se te antoja y lo armamos por aquí.\n' +
          'Si necesitas ayuda: ' +
          this.humanContactMessage()
        : (opts?.postOrderFallback
            ? 'Para decirte en qué va, '
            : 'Para ubicar *tu* pedido, ') +
          'necesito el *número de orden* (aparece como *#15* al confirmar).\n' +
          'Escríbelo aquí. Si no lo tienes, ' +
          this.humanContactMessage()),
    );
    return true;
  }

  private async tryHandleInterruptedPhoneOrderInquiry(
    conv: WhatsappConversation,
    waId: string,
    text: string,
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    if (!isInterruptedPhoneOrderInquiry(text)) return false;
    return this.replyOrderProgressOrAskNumber(conv, waId, text, cfg, {
      interruptedCall: true,
    });
  }

  /** "la ensalada de qué", "qué lleva", ingredientes, alérgenos… */
  private isProductCompositionQuestion(text: string): boolean {
    return this.catalogService.isProductDescriptionInquiry(text);
  }

  private findProductsForCompositionQuestion(
    text: string,
    products: MenuProduct[],
    session: WhatsappSessionData,
  ): MenuProduct[] {
    const stripped = this.catalogService.stripProductDescriptionInquiryNoise(text);
    const query = this.catalogService.extractProductSearchQuery(stripped || text);

    // "el pollo lleva arepas / no lleva papa" → la familia del plato, no la porción de arepas
    if (this.catalogService.hasAccompanimentModifierWithMain(text)) {
      const dishText = text
        .replace(
          /\b(?:solo\s+)?(?:con|sin)\s+(?:las?\s+|una\s+|un\s+)?(?:arepas?|papas?|papa|yuca|ensalada|cebolla)\b/gi,
          ' ',
        )
        .replace(
          /\b(?:no\s+)?(?:lleva|viene|vienen|trae|traen)\s+(?:solo\s+)?(?:con\s+)?(?:las?\s+|una\s+)?(?:arepas?|papas?|papa|yuca|ensalada)\b/gi,
          ' ',
        );
      const dishFamily = this.catalogService.findProductVariantFamily(dishText, products);
      if (dishFamily?.variants.length) return dishFamily.variants;
    }

    const qual = this.catalogService.extractHowItIsQualifier(text);
    const focus =
      this.resolveDiscussedProduct(session, stripped || text, products) || null;
    if (qual && focus) {
      const matched = this.catalogService.variantsMatchingQualifier(focus, qual, products);
      if (matched.length) return matched;
    }

    // Follow-up sin nombrar plato: "y con qué viene acompañado" → usar foco / multi / carrito
    const focusedEarly = focus;
    if (focusedEarly && this.isCompositionFollowUpWithoutProductName(text, query)) {
      if (session.pendingMatch?.intent === 'info' && session.pendingMatch.candidates?.length) {
        return session.pendingMatch.candidates as MenuProduct[];
      }
      return [focusedEarly];
    }

    const named = this.catalogService.specificNamedDish(stripped || text, products);
    if (named) return [named];

    const family = this.catalogService.findProductVariantFamily(query || text, products);
    if (family && family.variants.length >= 2) {
      return family.variants;
    }

    const embedded = this.catalogService.findProductEmbeddedInMessage(stripped || text, products);
    if (embedded) {
      const embFamily = this.catalogService.findProductVariantFamily(
        embedded.name,
        products,
        [embedded],
      );
      if (embFamily && embFamily.variants.length >= 2) return embFamily.variants;
      return [embedded];
    }

    let scored = this.catalogService.searchByNameScored(query, products, 6);
    if (this.catalogService.hasAccompanimentModifierWithMain(text)) {
      const mains = scored.filter((x) => !this.catalogService.isLikelySideOnlyProduct(x.p));
      if (mains.length) scored = mains;
    }
    if (scored.length >= 2) {
      const top = scored[0].score;
      const close = scored
        .filter((x) => x.score >= Math.max(40, top - 20))
        .map((x) => x.p);
      const uniq = this.catalogService.dedupeProductsById(close);
      if (uniq.length >= 2) {
        const asFamily = this.catalogService.findProductVariantFamily(
          query || text,
          products,
          uniq,
        );
        if (asFamily && asFamily.variants.length >= 2) return asFamily.variants;
        return uniq.slice(0, 5);
      }
    }
    if (scored.length === 1 && scored[0].score >= 40) return [scored[0].p];
    if (scored.length >= 1 && this.catalogService.isStrongProductMatch(scored)) {
      return [scored[0].p];
    }

    return focusedEarly ? [focusedEarly] : [];
  }

  /** "y con qué viene" / "acompañado" sin repetir el nombre del plato. */
  private isCompositionFollowUpWithoutProductName(text: string, query: string): boolean {
    const q = (query || '').trim().toLowerCase();
    if (!q || q.length < 4) return true;
    const tokens = q.split(/\s+/).filter((t) => t.length >= 3);
    const fillers = new Set([
      'y',
      'eso',
      'ese',
      'esa',
      'este',
      'esta',
      'el',
      'la',
      'lo',
      'los',
      'las',
      'tambien',
      'también',
      'viene',
      'va',
      'trae',
      'lleva',
      'acompanado',
      'acompañada',
      'acompanada',
      'acompanado',
      'con',
      'que',
      'qué',
    ]);
    if (tokens.every((t) => fillers.has(t))) return true;
    if (
      /^(y|tambien|también)\b/i.test(text.trim()) &&
      !/\b(pollo|arroz|sopa|bandeja|mojarra|churrasco|mondongo|ajiaco|pechuga|costilla|gaseosa|limonada|hamburguesa|ejecutivo|trucha|bagre)\b/i.test(
        text,
      )
    ) {
      return true;
    }
    return false;
  }

  private buildProductCompositionReply(
    text: string,
    product: MenuProduct | null,
    cfg: Awaited<ReturnType<WhatsappSettingsService['getEffectiveConfig']>>,
    session?: WhatsappSessionData,
    opts?: { offerAdd?: boolean },
  ): string {
    const allergens = (cfg.localContext?.allergensNote || '').trim();
    const q = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (product) {
      const alreadyInCart = !!session?.cart.some((c) => c.productId === product.id);
      let msg = this.catalogService.formatProductPriceReply(product, {
        offerAdd: opts?.offerAdd !== false && !alreadyInCart,
      });
      if (alreadyInCart) {
        msg += '\n\n_Ya lo tienes en el carrito._';
      }
      if (/\bporcion\b/.test(q)) {
        msg = `Sí. Esa es la porción de la carta.\n\n${msg}`;
      }
      return msg;
    }

    let msg =
      '¿De qué plato? Escribe el *nombre*.';
    // "con qué viene la mazorcada" sin match → soft-miss si hay nombre
    const hint = this.catalogService
      .stripAvailabilityInquiryNoise(
        this.catalogService.stripProductDescriptionInquiryNoise(
          this.catalogService.extractProductSearchQuery(text),
        ),
      )
      .replace(/^(?:un|una|unos|unas|el|la|los|las)\s+/i, '')
      .trim();
    if (hint.length >= 3 && !/^(plato|producto|comida|algo|eso|esto)$/i.test(hint)) {
      msg = this.catalogService.formatNotOnMenuReply(hint, cfg.menuUrl);
    } else if (allergens && /\b(alergeno|alérgeno|gluten|lacteo|lácteo|celiaco)\b/i.test(text)) {
      msg += `\n\nLo que sí tenemos registrado sobre alérgenos:\n_${allergens}_`;
    }
    return msg;
  }

  private rememberProductFocus(
    session: WhatsappSessionData,
    product: MenuProduct,
    products: MenuProduct[],
  ): WhatsappSessionData {
    const family = this.catalogService.findProductVariantFamily(product.name, products, [product]);
    return {
      ...session,
      productFocus: {
        productId: product.id,
        name: product.name,
        variantBaseKey: family?.baseKey,
      },
    };
  }

  /** Último plato mencionado en el chat (p. ej. el bot acaba de hablar de arroz chino). */
  private async discussedProductFromRecent(
    conversationId: number,
    products: MenuProduct[],
  ): Promise<MenuProduct | null> {
    const recent = await this.conversationService.getRecentMessageTexts(conversationId, 8);
    for (const line of [...recent].reverse()) {
      const body = line.replace(/^(Cliente|Bot):\s*/i, '').trim();
      if (!body) continue;
      const hit = this.catalogService.findProductEmbeddedInMessage(body, products);
      if (
        hit &&
        !this.catalogService.isLikelyDrinkProduct(hit) &&
        !this.catalogService.isLikelySideOnlyProduct(hit)
      ) {
        return hit;
      }
    }
    return null;
  }

  private resolveDiscussedProduct(
    session: WhatsappSessionData,
    text: string,
    products: MenuProduct[],
  ): MenuProduct | null {
    if (session.pendingAttribute?.productId) {
      const pending = this.catalogService.getProductById(session.pendingAttribute.productId, products);
      if (pending) return pending;
    }
    if (session.pendingAddOffer?.productId) {
      const offer = this.catalogService.getProductById(session.pendingAddOffer.productId, products);
      if (offer) return offer;
    }
    if (session.productFocus?.productId) {
      const focused = this.catalogService.getProductById(session.productFocus.productId, products);
      if (focused) return focused;
    }
    const multiFirst =
      session.pendingMultiOrder?.confident?.[0] ||
      session.pendingMultiOrder?.needsAttributes?.[0];
    if (multiFirst?.productId) {
      const fromMulti = this.catalogService.getProductById(multiFirst.productId, products);
      if (fromMulti) return fromMulti;
    }
    if (session.pendingMatch?.candidates?.length) {
      const fromMatch = session.pendingMatch.candidates[0];
      const live =
        this.catalogService.getProductById(fromMatch.id, products) || (fromMatch as MenuProduct);
      if (live) return live;
    }
    if (session.cart.length) {
      const last = session.cart[session.cart.length - 1];
      const fromCart = this.catalogService.getProductById(last.productId, products);
      if (fromCart) return fromCart;
    }
    const embedded = this.catalogService.findProductEmbeddedInMessage(text, products);
    if (embedded) return embedded;
    const query = this.catalogService.extractProductSearchQuery(text);
    const scored = this.catalogService.searchByNameScored(query, products, 5);
    if (scored.length === 1 && scored[0].score >= 45) return scored[0].p;
    if (scored.length >= 1 && this.catalogService.isStrongProductMatch(scored)) return scored[0].p;
    return null;
  }

  private removeCartLinesForProductId(
    session: WhatsappSessionData,
    productId: number,
  ): WhatsappSessionData {
    const indices = session.cart
      .map((item, i) => ({ item, i }))
      .filter(({ item }) => item.productId === productId)
      .map(({ i }) => i);
    return indices.length ? this.removeCartLines(session, indices) : session;
  }

  private removeCartLinesForVariantFamily(
    session: WhatsappSessionData,
    family: ProductVariantFamily,
    products: MenuProduct[],
  ): WhatsappSessionData {
    const variantIds = new Set(family.variants.map((v) => v.id));
    const indices = session.cart
      .map((item, i) => ({ item, i }))
      .filter(({ item }) => {
        if (variantIds.has(item.productId)) return true;
        const p = this.catalogService.getProductById(item.productId, products);
        if (!p) return false;
        return this.catalogService.getProductNameBase(p.name) === family.baseKey;
      })
      .map(({ i }) => i);
    return indices.length ? this.removeCartLines(session, indices) : session;
  }

  private async tryHandleComboAvailabilityQuestion(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    products: MenuProduct[],
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    if (!this.catalogService.isComboAvailabilityQuestion(text)) return false;

    const product = this.resolveDiscussedProduct(session, text, products);
    if (!product) {
      await this.reply(
        conv,
        waId,
        '¿De cuál plato quieres saber si hay *combo*? Dime el nombre (ej. *pollo frito*).',
      );
      return true;
    }

    session = this.rememberProductFocus(session, product, products);

    const family = this.catalogService.findProductVariantFamily(product.name, products, [
      product,
      ...(session.pendingMatch?.candidates || []),
    ]);
    if (family && family.variants.length >= 2) {
      session = {
        ...session,
        pendingMatch: { query: family.baseLabel, candidates: family.variants },
        pendingAttribute: undefined,
      };
      await this.conversationService.saveSession(conv, session);
      await this.reply(
        conv,
        waId,
        `Sí 👍 Para *${family.baseLabel}* manejamos estas versiones:\n\n` +
          this.catalogService.formatVariantFamilyPrompt(family) +
          `\n\n_Si quieres el combo, dime *en combo* o el número._`,
      );
      return true;
    }

    if (product.hasAttributes && product.attributes?.length) {
      await this.conversationService.saveSession(conv, session);
      await this.reply(
        conv,
        waId,
        this.catalogService.formatProductVariantsOverview(product, 'info'),
      );
      return true;
    }

    await this.conversationService.saveSession(conv, session);
    await this.reply(
      conv,
      waId,
      `Sobre *${product.name}*, en el menú no veo una variante *combo* aparte. Si quieres, te lo agrego tal cual. ${this.humanContactMessage()}`,
    );
    return true;
  }

  private async tryHandleVariantPreferenceChange(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    products: MenuProduct[],
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    if (!this.catalogService.isVariantPreferenceIntent(text)) return false;
    const product = this.resolveDiscussedProduct(session, text, products);
    if (!product) return false;

    return this.tryApplyVariantPreferenceToProduct(
      conv,
      waId,
      session,
      text,
      products,
      cfg,
      product,
      { fromPendingAttribute: false },
    );
  }

  /**
   * "No vendes un combo más grande" con Duo de Tacos en foco:
   * listar trío/packs del mismo plato — nunca saltar a Combo Arroz Chino.
   */
  private async tryHandleLargerPackInquiry(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    products: MenuProduct[],
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    if (!this.catalogService.isLargerPackInquiry(text)) return false;

    const product = this.resolveDiscussedProduct(session, text, products);
    if (!product) {
      if (!this.catalogService.isVaguePackSizeQuery(text)) return false;
      await this.reply(
        conv,
        waId,
        '¿De cuál plato quieres un *combo/pack más grande*? Dime el nombre (ej. *tacos*).',
      );
      return true;
    }

    session = this.rememberProductFocus(session, product, products);
    const larger = this.catalogService.findRelatedLargerPackProducts(product, products);

    if (larger.length) {
      const candidates = [product, ...larger.filter((p) => p.id !== product.id)];
      session = {
        ...session,
        pendingMatch: {
          query: this.catalogService.getCoreFoodTokens(product.name).join(' ') || product.name,
          candidates,
        },
        pendingAttribute: undefined,
      };
      await this.conversationService.saveSession(conv, session);
      const rows = candidates.map((p, i) => ({
        index: i + 1,
        label: p.name,
        price: p.price,
        code: p.code,
      }));
      await this.reply(
        conv,
        waId,
        `Sobre *${product.name}*, estas son las versiones/packs que manejamos:\n\n` +
          this.catalogService.formatOptionsList(rows) +
          `\n\n_Dime el *número* del que quieras (el más grande suele ser el de mayor precio)._`,
      );
      return true;
    }

    const pa = session.pendingAttribute;
    const keepPending =
      pa &&
      (pa.productId === product.id ||
        this.catalogService.getProductById(pa.productId, products)?.id === product.id);

    await this.conversationService.saveSession(
      conv,
      session,
      keepPending ? 'awaiting_attribute' : undefined,
    );

    const suffix = keepPending
      ? `\n\nSeguimos con *${product.name}*:\n\n` +
        this.catalogService.formatProductOptionsPrompt(product, pa?.selected || [])
      : `\n\nSi quieres, te dejo *${product.name}* o dime otro plato.`;

    await this.reply(
      conv,
      waId,
      `De *${product.name}* no tengo un combo/pack *más grande* en el menú 🙏` + suffix,
    );
    return true;
  }

  /**
   * "Quiero una porción más pequeña" con sopa/mondongo en foco:
   * no es dirección; aclara si hay tamaño chico (ajiaco/menudencias, no mondongo).
   */
  private async tryHandleServingSizeChange(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    products: MenuProduct[],
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    if (!this.catalogService.isServingSizeChangeIntent(text)) return false;

    // Dirección fantasma tipo "porción más pequeña"
    if (session.address && this.looksLikeFoodNotAddress(session.address)) {
      session = {
        ...session,
        address: undefined,
        addressConfirmed: false,
        deliveryFeeCalculated: null,
        deliveryDistanceKm: null,
        deliveryLat: null,
        deliveryLng: null,
        deliveryOutOfCoverage: false,
      };
    }

    const product = this.resolveDiscussedProduct(session, text, products);
    const smallSoup =
      products.find(
        (p) =>
          p.availableNow !== false &&
          /sopa\s+peque/i.test(p.name),
      ) || null;

    const talkingMondongo =
      /\bmondongo\b/i.test(text) ||
      (product ? /\bmondongo\b/i.test(product.name) : false) ||
      session.cart.some((c) => /\bmondongo\b/i.test(c.name));

    if (talkingMondongo && smallSoup) {
      const smallHasMondongo = (smallSoup.attributes || []).some((a) =>
        a.options.some((o) => /mondongo/i.test(o)),
      );
      if (!smallHasMondongo) {
        session = {
          ...session,
          pendingAttribute: undefined,
          pendingMatch: undefined,
        };
        await this.conversationService.saveSession(conv, session, 'building_cart');
        const cartLine = session.cart.length
          ? `\n\n${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}`
          : '';
        await this.reply(
          conv,
          waId,
          `La *Sopa de Mondongo* solo la manejamos en el tamaño normal` +
            (product && /\bmondongo\b/i.test(product.name) ? ` (*${product.name}*)` : '') +
            `.\n` +
            `La *Sopa pequeña* es de *Ajiaco* o *Menudencias*, no de mondongo.\n\n` +
            `_¿Dejamos la mondongo o la quitas?_` +
            cartLine,
        );
        return true;
      }
    }

    if (smallSoup && (talkingMondongo || /\bsopa\b/i.test(text) || (product && /\bsopa\b/i.test(product.name)))) {
      session = {
        ...session,
        pendingAttribute: undefined,
        pendingMatch: undefined,
      };
      if (await this.handleProductWithVariants(conv, waId, session, smallSoup, text, cfg)) {
        return true;
      }
    }

    const focusName = product?.name || 'ese plato';
    await this.conversationService.saveSession(conv, session, 'building_cart');
    await this.reply(
      conv,
      waId,
      `Para *${focusName}* no veo un tamaño más pequeño aparte en el menú. ` +
        `Si buscas *sopa pequeña* (ajiaco/menudencias), dímelo. ${this.humanContactMessage()}`,
    );
    return true;
  }

  private async tryApplyVariantPreferenceToProduct(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    products: MenuProduct[],
    cfg: EffectiveWhatsappConfig,
    product: MenuProduct,
    opts: { fromPendingAttribute: boolean },
  ): Promise<boolean> {
    const hint = this.catalogService.extractVariantPreferenceHint(text);
    const cartContext = session.cart.length > 0 || opts.fromPendingAttribute;

    const family = this.catalogService.findProductVariantFamily(product.name, products, [
      product,
      ...(session.pendingMatch?.candidates || []),
      ...session.cart
        .map((c) => this.catalogService.getProductById(c.productId, products))
        .filter((p): p is MenuProduct => !!p),
    ]);

    if (family && family.variants.length >= 2) {
      let picked =
        this.catalogService.pickVariantFromFamilyText(text, family) ||
        (hint === 'combo'
          ? family.variants.find((p) => /\bcombo\b/.test(p.name.toLowerCase())) || null
          : hint === 'solo'
            ? family.variants.find((p) => /\bsolo\b/.test(p.name.toLowerCase())) || null
            : null);
      if (!picked) {
        // Fallback: buscar "Combo De Pollo Frito" aunque la familia no agrupe bien
        if (hint === 'combo') {
          const style = /\bbroaster\b/i.test(product.name)
            ? 'broaster'
            : /\bfrito\b/i.test(product.name)
              ? 'frito'
              : null;
          const comboHits = products.filter(
            (p) =>
              p.availableNow !== false &&
              /\bcombo\b/i.test(p.name) &&
              /\bpollo\b/i.test(p.name) &&
              (!style || new RegExp(`\\b${style}\\b`, 'i').test(p.name)),
          );
          picked = comboHits[0] || null;
        }
        if (!picked) return false;
      }

      if (cartContext) {
        session = this.removeCartLinesForVariantFamily(session, family, products);
      }
      session = {
        ...this.rememberProductFocus(session, picked, products),
        pendingMatch: undefined,
        pendingAttribute: undefined,
      };

      if (picked.hasAttributes && picked.attributes?.length) {
        const step = this.catalogService.coerceAttributeStep(
          picked,
          this.catalogService.resolveAttributesFromMessage(picked, text, []),
        );
        if (step.status === 'complete') {
          const added = this.tryAddProductToCart(
            session,
            picked,
            this.resolveAddQuantity(session, picked, { sourceText: text }),
            cfg,
            undefined,
            step.attributes,
          );
          if (added.missingAttributes) {
            session = this.buildPendingAttributeSession(
              session,
              picked,
              added.missingAttributes,
              { sourceText: text },
            );
            await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
            await this.reply(
              conv,
              waId,
              `${cartContext ? 'Listo, vamos con esa opción 👍\n\n' : ''}` +
                this.catalogService.formatProductOptionsPrompt(
                  picked,
                  added.missingAttributes,
                ),
            );
            return true;
          }
          if (added.blocked) {
            await this.conversationService.saveSession(conv, session);
            await this.handleCartLimitBlocked(conv, waId, added.blocked, cfg);
            return true;
          }
          session = added.session;
          await this.conversationService.saveSession(conv, session, 'building_cart');
          const chosen = step.attributes.map((a) => a.attributeValue).join(', ');
          await this.reply(
            conv,
            waId,
            `${cartContext ? 'Listo, lo cambié 👍\n\n' : ''}` +
              this.buildCartAddReply(session, this.deliveryFeeFor(session, cfg), `${picked.name} (${chosen})`),
          );
          return true;
        }
        session = {
          ...session,
          pendingAttribute: {
            productId: picked.id,
            name: picked.name,
            code: picked.code,
            price: picked.price,
            attributes: picked.attributes || [],
            selected: step.status === 'partial' ? step.attributes : [],
          },
        };
        await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
        await this.reply(
          conv,
          waId,
          `${cartContext ? 'Listo, vamos con *combo* 👍\n\n' : ''}` +
            this.catalogService.formatProductOptionsPrompt(
              picked,
              step.status === 'partial' ? step.attributes : [],
            ),
        );
        return true;
      }

      const added = this.tryAddProductToCart(
        session,
        picked,
        this.resolveAddQuantity(session, picked, { sourceText: text }),
        cfg,
      );
      if (added.blocked) {
        await this.conversationService.saveSession(conv, session);
        await this.handleCartLimitBlocked(conv, waId, added.blocked, cfg);
        return true;
      }
      session = added.session;
      await this.conversationService.saveSession(conv, session, 'building_cart');
      await this.reply(
        conv,
        waId,
        `${cartContext ? 'Listo, lo cambié 👍\n\n' : ''}` +
          this.buildCartAddReply(session, this.deliveryFeeFor(session, cfg), picked.name),
      );
      return true;
    }

    // Sin familia agrupada: aún así saltar a Combo De Pollo Frito/Broaster
    if (hint === 'combo') {
      const style = /\bbroaster\b/i.test(product.name)
        ? 'broaster'
        : /\bfrito\b/i.test(product.name)
          ? 'frito'
          : null;
      const combo =
        products.find(
          (p) =>
            p.availableNow !== false &&
            /\bcombo\b/i.test(p.name) &&
            /\bpollo\b/i.test(p.name) &&
            (!style || new RegExp(`\\b${style}\\b`, 'i').test(p.name)),
        ) || null;
      if (combo && combo.id !== product.id) {
        if (cartContext) {
          session = this.removeCartLinesForProductId(session, product.id);
        }
        session = {
          ...this.rememberProductFocus(session, combo, products),
          pendingMatch: undefined,
          pendingAttribute: undefined,
        };
        if (combo.hasAttributes && combo.attributes?.length) {
          if (await this.handleProductWithVariants(conv, waId, session, combo, text, cfg)) {
            return true;
          }
        }
        const added = this.tryAddProductToCart(
          session,
          combo,
          this.resolveAddQuantity(session, combo, { sourceText: text }),
          cfg,
        );
        if (added.blocked) {
          await this.conversationService.saveSession(conv, session);
          await this.handleCartLimitBlocked(conv, waId, added.blocked, cfg);
          return true;
        }
        session = added.session;
        await this.conversationService.saveSession(conv, session, 'building_cart');
        await this.reply(
          conv,
          waId,
          `Perfecto, lo dejamos en *${combo.name}* ✅\n\n` +
            this.buildCartAddReply(session, this.deliveryFeeFor(session, cfg), combo.name),
        );
        return true;
      }
    }

    if (!product.hasAttributes || !product.attributes?.length) return false;

    if (cartContext) {
      session = this.removeCartLinesForProductId(session, product.id);
    }

    let step = this.catalogService.resolveAttributesFromMessage(
      product,
      text,
      [],
      hint ? { variantIntent: hint } : undefined,
    );
    if (step.status === 'invalid' && hint) {
      step = this.catalogService.resolveAttributesFromMessage(
        product,
        hint === 'combo' ? 'en combo' : 'solo',
        [],
        { variantIntent: hint },
      );
    }
    if (step.status === 'invalid') return false;

    session = {
      ...this.rememberProductFocus(session, product, products),
      pendingMatch: undefined,
    };

    if (step.status === 'complete') {
      const stillNeed = this.catalogService.getRemainingAttributes(
        product,
        step.attributes,
        hint ? { variantIntent: hint } : undefined,
      );
      if (stillNeed.length) {
        session = {
          ...session,
          pendingAttribute: {
            productId: product.id,
            name: product.name,
            code: product.code,
            price: product.price,
            attributes: product.attributes || [],
            selected: step.attributes,
            variantIntent: hint || undefined,
          },
        };
        await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
        await this.reply(
          conv,
          waId,
          `${cartContext ? 'Listo, vamos con esa opción 👍\n\n' : ''}` +
            this.catalogService.formatProductOptionsPrompt(
              product,
              step.attributes,
              hint ? { variantIntent: hint } : undefined,
            ),
        );
        return true;
      }
      const added = this.tryAddProductToCart(
        session,
        product,
        this.resolveAddQuantity(session, product, { sourceText: text }),
        cfg,
        undefined,
        step.attributes,
        hint ? { variantIntent: hint } : undefined,
      );
      if (added.missingAttributes) {
        session = this.buildPendingAttributeSession(session, product, added.missingAttributes, {
          sourceText: text,
          variantIntent: hint || undefined,
        });
        await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
        await this.reply(
          conv,
          waId,
          `${cartContext ? 'Listo, vamos con esa opción 👍\n\n' : ''}` +
            this.catalogService.formatProductOptionsPrompt(
              product,
              added.missingAttributes,
              hint ? { variantIntent: hint } : undefined,
            ),
        );
        return true;
      }
      if (added.blocked) {
        await this.conversationService.saveSession(conv, session);
        await this.handleCartLimitBlocked(conv, waId, added.blocked, cfg);
        return true;
      }
      session = { ...added.session, pendingAttribute: undefined };
      await this.conversationService.saveSession(conv, session, 'building_cart');
      const chosen = step.attributes.map((a) => a.attributeValue).join(', ');
      await this.reply(
        conv,
        waId,
        `${cartContext ? 'Listo, lo cambié 👍\n\n' : ''}` +
          this.buildCartAddReply(session, this.deliveryFeeFor(session, cfg), `${product.name} (${chosen})`),
      );
      return true;
    }

    session = {
      ...session,
      pendingAttribute: {
        productId: product.id,
        name: product.name,
        code: product.code,
        price: product.price,
        attributes: product.attributes || [],
        selected: step.attributes,
        variantIntent: hint || undefined,
      },
    };
    await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
    await this.reply(
      conv,
      waId,
      `${cartContext ? 'Listo, vamos con esa opción 👍\n\n' : ''}` +
        this.catalogService.formatProductOptionsPrompt(
          product,
          step.attributes,
          hint ? { variantIntent: hint } : undefined,
        ),
    );
    return true;
  }

  /**
   * "¿Tienes arroz chino?" → lista la familia (caja, con pollo, costillas)
   * y deja el foco para "cómo es con pollo" / "con qué viene".
   */
  private async tryHandleDailyPromoInquiry(
    conv: WhatsappConversation,
    waId: string,
    text: string,
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    if (!this.catalogService.isDailyPromoInquiry(text)) return false;
    const menu = (cfg.menuUrl || '').trim();
    await this.reply(
      conv,
      waId,
      `No hay *promoción del día* en la carta.\n` +
        `Dime el plato y te digo la porción y el precio.` +
        (menu ? `\nMenú: ${menu}` : ''),
    );
    return true;
  }

  private async tryHandleProductAvailabilityQuestion(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    products: MenuProduct[],
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    if (!this.catalogService.isAvailabilityInquiry(text)) return false;
    if (this.catalogService.isProductDescriptionInquiry(text)) return false;
    const q = this.normalizeForMatch(text);
    if (
      /\b(domicilio|servicio|horario|abiertos?|direccion|pedido|demora|propina)\b/.test(q) &&
      !/\b(arroz|pollo|sopa|bandeja|costilla|hamburguesa|taco|jugo|mojarra|churrasco)\b/.test(q)
    ) {
      return false;
    }

    const stripped = this.catalogService.stripAvailabilityInquiryNoise(text);
    const query = this.catalogService.extractProductSearchQuery(stripped || text);
    if (!query || query.length < 3) return false;

    const family = this.catalogService.findProductVariantFamily(query, products);
    let variants = family?.variants?.length ? family.variants : [];
    if (!variants.length) {
      const embedded = this.catalogService.findProductEmbeddedInMessage(query, products);
      if (embedded) variants = [embedded];
    }
    if (!variants.length) return false;

    const missing = this.catalogService.uncoveredWordsAgainstOffers(text, variants);
    const anchor = variants[0];
    session = {
      ...this.rememberProductFocus(session, anchor, products),
      ...(variants.length > 1
        ? {
            pendingMatch: {
              query,
              candidates: variants,
              intent: 'info' as const,
            },
          }
        : {}),
    };
    await this.conversationService.saveSession(conv, session, 'building_cart');

    if (variants.length === 1) {
      const qty = this.catalogService.extractQuantityFromMessage(text);
      await this.savePendingAddOffer(conv, variants[0], qty, { sourceText: text });
      const card = this.catalogService.formatProductPriceReply(variants[0]);
      await this.reply(
        conv,
        waId,
        missing.length
          ? this.catalogService.formatWeDontOfferPreface(query, 1) + card
          : card,
      );
      return true;
    }

    const baseKey = family?.baseKey || '';
    const baseLabel = family?.baseLabel || query;
    const rows = variants.map((p, i) => {
      const desc = (p.description || '').trim();
      const short = desc.length > 140 ? `${desc.slice(0, 139)}…` : desc;
      const label = baseKey
        ? this.catalogService.getVariantDisplayLabel(p.name, baseKey)
        : p.name;
      return (
        `${this.catalogService.optionNumberEmoji(i + 1)} *${label}* · ${this.catalogService.formatMoney(p.price)}` +
        (short ? `\n   _${short}_` : '')
      );
    });
    const listBody =
      `${rows.join('\n\n')}\n\n` +
      `_Dime el *número* si quieres agregarlo, o pregunta cómo es._`;
    await this.reply(
      conv,
      waId,
      missing.length
        ? this.catalogService.formatWeDontOfferPreface(query, variants.length) + listBody
        : `Sí, *${baseLabel}*:\n\n${listBody}`,
    );
    return true;
  }

  private async tryHandleProductCompositionQuestion(
    conv: WhatsappConversation,
    waId: string,
    text: string,
    products: MenuProduct[],
    cfg: Awaited<ReturnType<WhatsappSettingsService['getEffectiveConfig']>>,
    session: WhatsappSessionData,
  ): Promise<boolean> {
    if (!this.isProductCompositionQuestion(text)) return false;
    if (/\b(domicilio|horario|direccion|pedido|demora)\b/i.test(text) && !/\b(pollo|arroz|sopa|bandeja|costilla)\b/i.test(text)) {
      return false;
    }

    const fromRecent = await this.discussedProductFromRecent(conv.id, products);
    if (fromRecent) {
      const current = session.productFocus?.productId
        ? this.catalogService.getProductById(session.productFocus.productId, products)
        : null;
      const sameFamily =
        !!current &&
        this.catalogService.getProductNameBase(current.name) ===
          this.catalogService.getProductNameBase(fromRecent.name);
      if (!sameFamily) {
        session = this.rememberProductFocus(session, fromRecent, products);
      }
    }

    const candidates = this.findProductsForCompositionQuestion(text, products, session);

    // Varias variantes: mostrar nombre, precio y descripción (no solo “¿cuál?”)
    if (candidates.length > 1) {
      const family = this.catalogService.findProductVariantFamily(
        candidates[0].name,
        products,
        candidates,
      );
      const baseKey = family?.baseKey || '';
      const baseLabel = family?.baseLabel || candidates[0].name;
      session = {
        ...session,
        pendingAddOffer: undefined,
        pendingMatch: {
          query: text,
          candidates,
          intent: 'info',
        },
      };
      await this.conversationService.saveSession(conv, session, 'building_cart');
      const rows = candidates.map((p, i) => {
        const desc = (p.description || '').trim();
        const short = desc.length > 140 ? `${desc.slice(0, 139)}…` : desc;
        const label = baseKey
          ? this.catalogService.getVariantDisplayLabel(p.name, baseKey)
          : p.name;
        return (
          `${this.catalogService.optionNumberEmoji(i + 1)} *${label}* · ${this.catalogService.formatMoney(p.price)}` +
          (short ? `\n   _${short}_` : '\n   _Sin descripción de ingredientes en el menú._')
        );
      });
      const prompt =
        `*${baseLabel}*:\n\n` +
        `${rows.join('\n\n')}\n\n` +
        `_Dime el *número* si quieres agregarlo._`;
      await this.reply(conv, waId, prompt);
      return true;
    }

    const product = candidates[0] || null;
    const askingContents =
      /\b(lleva|vienen|viene|trae|traen|va solo|con qu[eé] viene|qu[eé] (?:trae|lleva))\b/i.test(
        text,
      );
    if (product) {
      session = {
        ...this.rememberProductFocus(session, product, products),
        pendingCompositionAsk: undefined,
        ...(askingContents ? { pendingAddOffer: undefined } : {}),
      };
      await this.conversationService.saveSession(conv, session);
      const alreadyInCart = session.cart.some((c) => c.productId === product.id);
      if (!alreadyInCart && !askingContents) {
        await this.savePendingAddOffer(conv, product, 1);
      }
    } else {
      // Esperar nombre del plato: "Arroz con pollo" → detalle, no carrito
      session = {
        ...session,
        pendingCompositionAsk: { originalText: text },
      };
      await this.conversationService.saveSession(conv, session, 'building_cart');
    }
    await this.reply(
      conv,
      waId,
      this.buildProductCompositionReply(text, product, cfg, session, {
        offerAdd: !askingContents,
      }),
    );
    return true;
  }

  /**
   * Tras “¿de qué plato quieres saber?”: el cliente nombra el plato → acompañamiento/info.
   */
  private async tryResolvePendingCompositionAsk(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    products: MenuProduct[],
    cfg: Awaited<ReturnType<WhatsappSettingsService['getEffectiveConfig']>>,
  ): Promise<boolean> {
    const ask = session.pendingCompositionAsk;
    if (!ask?.originalText) return false;

    if (isAbandonPendingSelectionIntent(text)) {
      session = { ...session, pendingCompositionAsk: undefined };
      await this.conversationService.saveSession(conv, session, 'building_cart');
      await this.reply(conv, waId, 'Listo, lo dejamos pasar 👍 ¿Qué se te antoja?');
      return true;
    }

    // Sigue siendo pregunta genérica sin plato
    if (
      this.isProductCompositionQuestion(text) &&
      this.isCompositionFollowUpWithoutProductName(
        text,
        this.catalogService.extractProductSearchQuery(
          this.catalogService.stripProductDescriptionInquiryNoise(text) || text,
        ),
      )
    ) {
      await this.reply(
        conv,
        waId,
        this.buildProductCompositionReply(ask.originalText, null, cfg),
      );
      return true;
    }

    const product =
      this.catalogService.findProductEmbeddedInMessage(text, products) ||
      this.catalogService.resolveSizedChickenProduct(text, products) ||
      this.catalogService.resolveSizedSoupProduct(text, products) ||
      (() => {
        const scored = this.catalogService.searchByNameScored(
          this.catalogService.extractProductSearchQuery(text) || text,
          products,
          5,
        );
        if (scored.length === 1 && scored[0].score >= 40) return scored[0].p;
        if (this.catalogService.isStrongProductMatch(scored) && scored[0].score >= 50) {
          return scored[0].p;
        }
        return null;
      })();

    if (!product) return false;

    session = {
      ...this.rememberProductFocus(session, product, products),
      pendingCompositionAsk: undefined,
    };
    await this.conversationService.saveSession(conv, session, 'building_cart');
    await this.reply(
      conv,
      waId,
      this.buildProductCompositionReply(ask.originalText, product, cfg),
    );
    return true;
  }

  /** Intenta deducir pedido desde OCR / visión + catálogo. */
  private resolveImageOrderText(
    analysis: WhatsappImageAnalysis,
    caption: string | undefined,
    products: MenuProduct[],
  ): string | null {
    const blobs = [analysis.textForBot, analysis.visibleText, caption].filter(
      (s): s is string => !!s?.trim(),
    );

    for (const raw of blobs) {
      const code = this.catalogService.extractCodeFromMessage(raw);
      if (code != null) {
        const found = this.catalogService.findByCode(code, products);
        if (found) {
          return `código ${found.code} ${found.name}`;
        }
        return `código ${code}`;
      }

      const embedded = this.catalogService.findProductEmbeddedInMessage(raw, products);
      if (embedded) {
        return `código ${embedded.code} ${embedded.name}`;
      }

      const query = this.catalogService.extractProductSearchQuery(raw);
      const scored = this.catalogService.searchByNameScored(query, products, 3);
      if (scored.length === 1 && scored[0].score >= 45) {
        return `código ${scored[0].p.code} ${scored[0].p.name}`;
      }
      if (scored.length >= 1 && this.catalogService.isStrongProductMatch(scored)) {
        return `código ${scored[0].p.code} ${scored[0].p.name}`;
      }
    }

    // Sin match de catálogo: no inventar pedido desde OCR dudoso
    return null;
  }

  /** Pie de foto vago (“esta”, “de estos”) — no alcanza para pedir. */
  private isVagueImageCaption(caption: string | undefined): boolean {
    const t = (caption || '').trim().toLowerCase();
    if (!t) return true;
    if (t.length > 80) return false;
    return /^(esta|este|estos|esas|eso|de\s+estos|de\s+estas|la\s+de\s+la\s+foto|me\s+regalas\s+(esta|este|eso)|me\s+vendes\s+(esta|este)|esta\s+por\s+fa(vor)?|este\s+por\s+fa(vor)?)[\s!.?]*$/i.test(
      t,
    );
  }

  private async resolveImageMessage(
    msg: IncomingWhatsappMessage,
    loggedMessageId: string,
    conv: WhatsappConversation,
    cfg: Awaited<ReturnType<WhatsappSettingsService['getEffectiveConfig']>>,
  ): Promise<{ done: true } | { done: false; text: string }> {
    const proofCtx = this.isLikelyPaymentProofContext(conv);
    try {
      const { buffer, mimeType } = await this.metaService.downloadMedia(msg.mediaId!);
      const products = await this.catalogService.getMenuProducts();
      const menuSummary = await this.catalogService.getMenuDetailedText();
      const captionRaw = (msg.text || '').trim();
      const caption =
        captionRaw && !/^🖼️/.test(captionRaw) && captionRaw !== 'Imagen'
          ? captionRaw
          : undefined;

      let analysis = await this.aiService.analyzeOrderImage({
        buffer,
        mimeType: msg.mimeType || mimeType,
        caption,
        menuSummary,
      });

      const treatAsProof =
        analysis.kind === 'payment_proof' ||
        (proofCtx &&
          (analysis.kind === 'unclear' ||
            analysis.kind === 'other' ||
            this.isVagueImageCaption(caption)));

      if (treatAsProof) {
        await this.conversationService.updateMessageBody(
          loggedMessageId,
          `🧾 Comprobante de pago${caption ? `: ${caption}` : ''}`,
        );
        await this.reply(
          conv,
          msg.waId,
          analysis.kind === 'payment_proof' && analysis.reply?.includes(WHATSAPP_HUMAN_CONTACT_PHONE)
            ? analysis.reply
            : `Recibí tu comprobante ✅ ${this.humanContactMessage()}`,
        );
        return { done: true };
      }

      let orderText = this.resolveImageOrderText(analysis, caption, products);

      if (!orderText && (analysis.kind === 'unclear' || analysis.kind === 'other')) {
        analysis = await this.aiService.analyzeOrderImage({
          buffer,
          mimeType: msg.mimeType || mimeType,
          caption,
          menuSummary,
          ocrRetry: true,
        });
        if (analysis.kind === 'payment_proof' || proofCtx) {
          await this.conversationService.updateMessageBody(
            loggedMessageId,
            `🧾 Comprobante de pago${caption ? `: ${caption}` : ''}`,
          );
          await this.reply(
            conv,
            msg.waId,
            `Recibí tu comprobante ✅ ${this.humanContactMessage()}`,
          );
          return { done: true };
        }
        orderText = this.resolveImageOrderText(analysis, caption, products);
      }

      if (orderText) {
        await this.conversationService.updateMessageBody(
          loggedMessageId,
          `🖼️ ${orderText}`,
        );
        return { done: false, text: orderText };
      }

      await this.conversationService.updateMessageBody(
        loggedMessageId,
        captionRaw || '🖼️ Imagen',
      );
      const vague = this.isVagueImageCaption(caption);
      const fallback = (analysis.reply || this.aiService.imageFallbackReply()).replace(
        /\*ASESOR\*/gi,
        `*${WhatsappOrchestratorService.HUMAN_CONTACT_PHONE}*`,
      );
      await this.reply(
        conv,
        msg.waId,
        vague
          ? 'Vi tu foto 👀 Escribe el *plato* o el *código*.\n' + this.humanHelpHint()
          : fallback,
      );
      return { done: true };
    } catch (err) {
      this.logger.error(`Image resolve failed: ${err}`);
      await this.reply(
        conv,
        msg.waId,
        proofCtx
          ? 'No pude abrir tu foto del comprobante (a veces Meta la deja caducar).\n' +
              'Mándala de nuevo por aquí, o ' +
              this.humanContactMessage()
          : 'No pude leer la imagen. Escribe el *plato* o el *código*.\n' +
              this.humanHelpHint(),
      );
      return { done: true };
    }
  }

  /** Tras pedido cerrado o pago por transferencia: la foto suele ser comprobante. */
  private isLikelyPaymentProofContext(conv: WhatsappConversation): boolean {
    if (conv.state === 'completed' || conv.state === 'closed') return true;
    const session = this.conversationService.getSession(conv);
    const pay = (session.paymentMethod || '').toLowerCase();
    return /\b(transfer|nequi|daviplata|banc|llave)\b/.test(pay);
  }

  /** Texto que el cliente pega cuando falla la descarga de media en WhatsApp/Meta. */
  private looksLikeFailedMediaNotice(text: string): boolean {
    const t = (text || '').toLowerCase();
    return (
      /no\s+se\s+pudo\s+cargar/.test(t) ||
      /expirad[oa].*meta|meta.*expirad[oa]/.test(t) ||
      /media\s+no\s+disponible/.test(t)
    );
  }

  private normalizeForMatch(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Vaciar / limpiar carrito o pedido en armado (no cancelar orden ya registrada). */
  private isClearCartIntent(text: string): boolean {
    if (this.isCancelIntent(text)) return false;
    return looksLikeClearCartMessage(text);
  }

  private messageRejectsPendingProduct(
    text: string,
    product: { name?: string },
  ): boolean {
    const q = this.normalizeForMatch(text);
    if (!/\b(no quiero|ya no|que no)\b/.test(q)) return false;
    if (/^(no|nop)\b/.test(q) && /\b(la|el|opcion)\s*\d/.test(q)) return false;
    const name = this.normalizeForMatch(product.name || '');
    const tokens = name.split(' ').filter((w) => w.length >= 5);
    if (!tokens.length) return false;
    return tokens.some((w) => q.includes(w));
  }

  private extractCartRemovalQuery(text: string): string | null {
    const raw = text.trim();
    if (!raw || raw.length < 4) return null;

    const reject = new Set([
      'cancelar',
      'anular',
      'nada',
      'pedido',
      'carrito',
      'todo',
      'eso',
      'confirmar',
    ]);

    const patterns = [
      /^(?:ya\s+)?no\s+(?:quiero|necesito|pido)\s+(?:el|la|los|las|un|una|unos|unas)?\s*(.+)$/i,
      /^(?:quita(?:me|r)?|saca(?:me|r)?|elimina(?:me|r)?|borra(?:me|r)?)\s+(?:el|la|los|las|un|una)?\s*(.+)$/i,
      /^sin\s+(?:el|la|los|las|un|una)?\s*(.+)$/i,
      /^(.+?)\s+ya\s+no\s*[\s!.?]*$/i,
      /^ya\s+no\s+(?:el|la|los|las|un|una)?\s*(.+)$/i,
      /^(?:me\s+equivoqu[eé]\s+(?:con|en)\s+(?:el|la|los|las|un|una)?\s*(.+))$/i,
      /^(?:retira(?:me|r)?|saca(?:me)?\s+del\s+carrito)\s+(?:el|la|los|las|un|una)?\s*(.+)$/i,
    ];

    for (const re of patterns) {
      const m = raw.match(re);
      if (!m?.[1]) continue;
      let q = m[1]
        .replace(/\s+(por favor|porfa|gracias)[\s!.?]*$/i, '')
        .replace(/\s+(del carrito|en el carrito|de mi pedido|del pedido)$/i, '')
        .trim();
      // "no quiero combo de broaster, quiero combo de frito" → solo la parte a quitar
      q = q.split(/[,;]\s*(?:quiero|dame|pon(?:me)?|mejor)\b/i)[0].trim();
      q = q.replace(/\s+(?:quiero|dame|pon(?:me)?|mejor)\s+.+$/i, '').trim();
      q = q.replace(/^(el|la|los|las|un|una|unos|unas)\s+/i, '').trim();
      q = q
        .replace(/^(?:\d{1,2}|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+/i, '')
        .trim();
      const qNorm = this.normalizeForMatch(q);
      if (qNorm.length < 3 || reject.has(qNorm)) continue;
      if (/^(producto|plato|item|item)$/i.test(qNorm)) continue;
      return q;
    }

    return null;
  }

  private formatCartLineLabel(item: WhatsappCartItem): string {
    const qty = Math.max(1, item.quantity || 1);
    const attrs = item.attributes?.length
      ? ` (${item.attributes.map((a) => a.attributeValue).join(', ')})`
      : '';
    const qtyLabel = qty > 1 ? ` ×${qty}` : '';
    return `*${item.name}*${qtyLabel}${attrs}`;
  }

  private matchCartItemsForRemoval(
    query: string,
    session: WhatsappSessionData,
    products: MenuProduct[],
  ):
    | { kind: 'none' }
    | { kind: 'single'; indices: number[]; label: string }
    | { kind: 'ambiguous'; options: Array<{ cartIndex: number; label: string }> } {
    const q = this.normalizeForMatch(query).replace(/(.)\1{2,}/g, '$1$1');
    const cart = session.cart;
    if (!cart.length || !q) return { kind: 'none' };

    let hits: number[] = [];
    const code = this.catalogService.extractCodeFromMessage(query);

    for (let i = 0; i < cart.length; i++) {
      const item = cart[i];
      const nameNorm = this.normalizeForMatch(item.name);
      const attrNorm = (item.attributes || [])
        .map((a) => this.normalizeForMatch(a.attributeValue))
        .join(' ');
      const full = `${nameNorm} ${attrNorm}`.trim();

      if (code != null && item.code === code) {
        hits.push(i);
        continue;
      }
      if (nameNorm.includes(q) || q.includes(nameNorm)) {
        hits.push(i);
        continue;
      }
      const tokens = q.split(' ').filter((t) => t.length >= 3);
      if (tokens.length && tokens.every((t) => full.includes(t))) {
        hits.push(i);
      }
    }

    if (!hits.length) {
      const scored = this.catalogService.searchByNameScored(query, products, 4);
      const strong = scored.filter((x) => x.score >= 45);
      if (strong.length === 1) {
        hits = cart
          .map((c, i) => (c.productId === strong[0].p.id ? i : -1))
          .filter((i) => i >= 0);
      } else if (strong.length >= 2) {
        const ids = new Set(strong.map((x) => x.p.id));
        hits = cart.map((c, i) => (ids.has(c.productId) ? i : -1)).filter((i) => i >= 0);
      }
    }

    if (!hits.length) return { kind: 'none' };

    const groups = new Map<string, number[]>();
    for (const i of hits) {
      const c = cart[i];
      const key = `${c.productId}|${JSON.stringify(c.attributes || [])}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(i);
    }

    if (groups.size === 1) {
      const indices = [...groups.values()][0];
      return { kind: 'single', indices, label: this.formatCartLineLabel(cart[indices[0]]) };
    }

    const options = [...groups.entries()].map(([, indices]) => ({
      cartIndex: indices[0],
      label: this.formatCartLineLabel(cart[indices[0]]),
    }));
    return { kind: 'ambiguous', options };
  }

  private removeCartLines(session: WhatsappSessionData, indices: number[]): WhatsappSessionData {
    const remove = new Set(indices);
    const removedProductIds = new Set(
      indices
        .map((i) => session.cart[i]?.productId)
        .filter((id): id is number => id != null),
    );
    const next: WhatsappSessionData = {
      ...session,
      cart: session.cart.filter((_, i) => !remove.has(i)),
      pendingCartRemoval: undefined,
    };
    if (next.pendingAttribute && removedProductIds.has(next.pendingAttribute.productId)) {
      next.pendingAttribute = undefined;
    }
    return next;
  }

  /** Cliente quiere salir de lista pendiente o de elegir atributos (sin cancelar pedido completo). */
  private extractAddressChangeTarget(text: string): string | null {
    const raw = (text || '').trim();
    if (!raw) return null;
    const m =
      raw.match(
        /\b(?:cambia(?:r|me)?|actualiza(?:r|me)?|modifica(?:r|me)?|corrige|corregir)\s+(?:la\s+)?(?:direcci[oó]n|domicilio|ubicaci[oó]n)\s*(?:a|por|:)?\s*(.+)$/i,
      ) ||
      raw.match(
        /\b(?:la\s+)?(?:direcci[oó]n|domicilio)\s+(?:es|queda|ahora|nueva)\s*:?\s*(.+)$/i,
      ) ||
      raw.match(/\bnueva\s+direcci[oó]n\s*:?\s*(.+)$/i);
    const addr = this.normalizeDeliveryAddress((m?.[1] || '').trim());
    if (!addr || addr.length < 4) return null;
    if (this.looksLikeFoodNotAddress(addr)) return null;
    return addr;
  }

  private async tryHandleAddressChange(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    if (!isAddressChangeIntent(text) && !isAddressRejectionIntent(text)) return false;

    // Rechazo sin dirección nueva: limpiar la anotada y pedir la correcta
    if (isAddressRejectionIntent(text) && !this.extractAddressChangeTarget(text)) {
      const next: WhatsappSessionData = {
        ...session,
        address: undefined,
        addressConfirmed: false,
        deliveryFeeCalculated: null,
        deliveryDistanceKm: null,
        deliveryLat: null,
        deliveryLng: null,
        deliveryOutOfCoverage: false,
        pendingMultiOrder: undefined,
        pendingMatch: undefined,
      };
      await this.conversationService.saveSession(conv, next, 'awaiting_address');
      await this.reply(
        conv,
        waId,
        'Listo, quité esa dirección 👍\n' +
          '¿Cuál es tu *dirección correcta*? (calle/carrera, barrio o conjunto y una referencia).',
      );
      return true;
    }

    const addr =
      this.extractAddressChangeTarget(text) ||
      this.extractDeliveryTail(text) ||
      null;
    if (!addr) {
      await this.reply(
        conv,
        waId,
        'Claro, ¿cuál es la *nueva dirección* del domicilio?',
      );
      await this.conversationService.saveSession(
        conv,
        { ...session, pendingMultiOrder: undefined, pendingMatch: undefined },
        'awaiting_address',
      );
      return true;
    }

    let next = this.withDeliveryAddress(
      {
        ...session,
        pendingMultiOrder: undefined,
        pendingMatch: undefined,
      },
      addr,
    );
    const fee = await this.ensureDeliveryFeeQuoted(next, cfg);
    next = fee.session;
    await this.conversationService.saveSession(conv, next, 'building_cart');
    const feeLine = fee.blocked
      ? `\n\n${fee.blocked}`
      : fee.notice
        ? `\n\n${fee.notice}`
        : '';
    await this.reply(
      conv,
      waId,
      `Listo, dirección actualizada:\n📍 _${next.address}_${feeLine}\n\n` +
        (next.cart.length
          ? `${this.formatCartOnly(next, this.deliveryFeeFor(next, cfg))}\n\n${this.formatContinueShoppingPrompt(next)}`
          : '¿Qué se te antoja pedir?'),
    );
    return true;
  }

  private async tryAbandonPendingSelection(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    if (!isAbandonPendingSelectionIntent(text)) return false;
    if (
      !session.pendingAttribute &&
      !session.pendingMatch &&
      !session.pendingMultiOrder &&
      !session.pendingCompositionAsk
    ) {
      return false;
    }

    const pa = session.pendingAttribute;
    let next: WhatsappSessionData = {
      ...session,
      pendingAttribute: undefined,
      pendingMatch: undefined,
      pendingMultiOrder: undefined,
      pendingCartRemoval: undefined,
      pendingCompositionAsk: undefined,
    };

    if (pa) {
      const indices = next.cart
        .map((item, i) => ({ item, i }))
        .filter(({ item }) => item.productId === pa.productId)
        .map(({ i }) => i);
      if (indices.length) {
        next = this.removeCartLines(next, indices);
      }
    }

    await this.conversationService.saveSession(conv, next, 'building_cart');
    const suffix =
      next.cart.length > 0
        ? `\n\n${this.formatCartOnly(next, this.deliveryFeeFor(next, cfg))}\n\n${this.formatContinueShoppingPrompt(next)}`
        : '\n\n¿Qué te gustaría pedir?';
    await this.reply(conv, waId, `Listo, lo dejamos pasar 👍${suffix}`);
    return true;
  }

  /**
   * "no quiero combo de broaster, quiero combo de frito":
   * quita el ítem rechazado y arranca el reemplazo (no anotar como nota).
   */
  private async tryHandleCartItemReplacement(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    products: MenuProduct[],
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    const parsed = parseCartItemReplacement(text);
    if (!parsed) return false;

    const pending = session.pendingAttribute;
    const rejectsPending =
      !session.cart.length &&
      !!pending &&
      this.messageRejectsPendingProduct(text, { name: pending.name } as MenuProduct);

    if (!session.cart.length && !rejectsPending) return false;

    let removedLabel = '';
    if (rejectsPending) {
      removedLabel = pending?.name || parsed.removeQuery;
      session = {
        ...session,
        pendingAttribute: undefined,
        pendingMatch: undefined,
        pendingAddOffer: undefined,
      };
      await this.conversationService.saveSession(conv, session, 'building_cart');
    } else {
      const match = this.matchCartItemsForRemoval(parsed.removeQuery, session, products);
      if (match.kind === 'none') return false;

      if (match.kind === 'ambiguous') {
        session = {
          ...session,
          pendingCartRemoval: { options: match.options },
          pendingAttribute: undefined,
        };
        await this.conversationService.saveSession(conv, session, 'building_cart');
        const opts = match.options.map((o, i) => `${i + 1}. ${o.label}`).join('\n');
        await this.reply(
          conv,
          waId,
          `Tienes varias opciones parecidas a *${parsed.removeQuery}*. ¿Cuál quitamos para poner *${parsed.addQuery}*?\n\n${opts}\n\nRespóndeme con el *número*.`,
        );
        return true;
      }

      removedLabel = match.label;
      session = this.removeCartLines(session, match.indices);
    }

    const addText = parsed.addQuery;
    const styleHint = await this.discussedProductFromRecent(conv.id, products);
    const sizedHalf = this.catalogService.resolveSizedChickenProduct(addText, products, {
      preferStyleFromName: styleHint?.name,
    });
    const replacement =
      sizedHalf ||
      this.catalogService.findProductEmbeddedInMessage(addText, products) ||
      (() => {
        const scored = this.catalogService.searchByNameScored(addText, products, 5);
        if (this.catalogService.isStrongProductMatch(scored)) return scored[0].p;
        if (scored.length === 1 && scored[0].score >= 45) return scored[0].p;
        // "combo de frito" → Combo De Pollo Frito
        if (/\bcombo\b/i.test(addText)) {
          const style = /\bbroaster\b/i.test(addText)
            ? 'broaster'
            : /\bfrito\b/i.test(addText)
              ? 'frito'
              : /\bmixto\b/i.test(addText)
                ? 'mixto'
                : null;
          return (
            products.find(
              (p) =>
                p.availableNow !== false &&
                /\bcombo\b/i.test(p.name) &&
                /\bpollo\b/i.test(p.name) &&
                (!style || new RegExp(`\\b${style}\\b`, 'i').test(p.name)),
            ) || null
          );
        }
        return null;
      })();

    if (!replacement) {
      await this.conversationService.saveSession(conv, session, 'building_cart');
      await this.reply(
        conv,
        waId,
        `Listo, quité ${removedLabel}.\n` +
          `No encontré *${parsed.addQuery}* en el menú para ponerlo en su lugar.\n\n` +
          `${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}\n\n` +
          `Dime el plato (o código) que quieres.`,
      );
      return true;
    }

    const swappedNote = `Listo, quité ${removedLabel}. Vamos con *${replacement.name}* 👍\n\n`;
    if (replacement.hasAttributes && replacement.attributes?.length) {
      // Guardar carrito ya sin el ítem rechazado antes de pedir attrs del nuevo
      await this.conversationService.saveSession(conv, session, 'building_cart');
      const before = session;
      if (
        await this.handleProductWithVariants(conv, waId, before, replacement, addText, cfg)
      ) {
        // Prefijo de swap: reescribir no es trivial; el flujo de attrs ya confirma el plato
        return true;
      }
      session = before;
    }

    const added = this.tryAddProductToCart(
      session,
      replacement,
      this.resolveAddQuantity(session, replacement, { sourceText: addText }),
      cfg,
      undefined,
      undefined,
      { sourceText: addText },
    );
    if (added.blocked) {
      await this.conversationService.saveSession(conv, session);
      await this.handleCartLimitBlocked(conv, waId, added.blocked, cfg);
      return true;
    }
    if (added.missingAttributes) {
      session = this.buildPendingAttributeSession(
        session,
        replacement,
        added.missingAttributes,
        { sourceText: addText },
      );
      await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
      await this.reply(
        conv,
        waId,
        swappedNote +
          this.catalogService.formatProductOptionsPrompt(
            replacement,
            added.missingAttributes,
          ),
      );
      return true;
    }

    session = added.session;
    await this.conversationService.saveSession(conv, session, 'building_cart');
    await this.reply(
      conv,
      waId,
      swappedNote +
        this.buildCartAddReply(
          session,
          this.deliveryFeeFor(session, cfg),
          replacement.name,
        ),
    );
    return true;
  }

  /**
   * "está mal el pedido" / "es solo el combo…" / "me están agregando medio pollo y limonada"
   * → quitar extras o dejar solo el ítem que el cliente confirma. No sumar platos.
   */
  private async tryHandleCartComplaintCorrection(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    products: MenuProduct[],
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    const raw = (text || '').trim();
    if (!raw || session.cart.length === 0) return false;
    const t = this.normalizeForMatch(raw);

    const isComplaint =
      /\b(esta\s+mal|esta\s+mal\s+el\s+pedido|pedido\s+mal|mal\s+el\s+pedido|incorrecto|equivocado)\b/.test(
        t,
      ) ||
      /\b(me\s+estan\s+agregando|me\s+estan\s+poniendo|me\s+agregaron|agregaron\s+de\s+mas|me\s+pusieron)\b/.test(
        t,
      ) ||
      /\b(no\s+pedi|no\s+ped[ií]|no\s+encargue|no\s+quiero\s+eso|eso\s+no\s+es)\b/.test(t) ||
      /\b(como me vas a dar|como vas a dar|por que me (?:das|diste|pusiste|agregaste))\b/.test(
        t,
      ) ||
      /\b(solo\s+(?:el|la|ese|esa|eso)|es\s+solo|unicamente|únicamente|nada\s+mas\s+que)\b/.test(t) ||
      !!this.youAddedClause(raw) ||
      this.cartHasUnaskedExtra(raw, session);

    if (!isComplaint) return false;

    // "qué está mal?" follow-up without cart change
    if (
      /^(esta\s+mal(\s+el\s+pedido)?|el\s+pedido\s+esta\s+mal)[\s!.?]*$/i.test(raw) ||
      /^mal[\s!.?]*$/i.test(raw)
    ) {
      await this.reply(
        conv,
        waId,
        `Listo, disculpa. ¿Qué está mal?\n\n${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}\n\n` +
          `_Puedes decir *quita el medio pollo* o *solo deja el combo*._`,
      );
      return true;
    }

    const rhetorical =
      /\b(como me vas a dar|como vas a dar|por que me (?:das|diste|pusiste|agregaste))\b/.test(t);
    if (rhetorical) {
      const indices: number[] = [];
      for (let i = 0; i < session.cart.length; i++) {
        const name = this.normalizeForMatch(session.cart[i].name);
        const tokens = name
          .split(' ')
          .filter((w) => w.length >= 5 && !['pollo', 'broaster', 'frito'].includes(w));
        if (!tokens.length) continue;
        const hits = tokens.filter((tok) => t.includes(tok) || t.includes(tok.replace(/s$/, '')));
        if (hits.length >= Math.min(2, tokens.length) || (tokens.length === 1 && hits.length === 1)) {
          indices.push(i);
        }
      }
      if (indices.length) {
        const labels = indices.map((i) => this.formatCartLineLabel(session.cart[i]));
        session = this.removeCartLines(session, indices);
        await this.conversationService.saveSession(conv, session, 'building_cart');
        const gone = labels.join(', ');
        const cart = session.cart.length
          ? `\n\n${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}\n\n${this.formatContinueShoppingPrompt(session)}`
          : '\n\n🛒 Carrito vacío. ¿Qué te gustaría pedir?';
        await this.reply(conv, waId, `Listo, quité ${gone}.${cart}`);
        return true;
      }
    }

    // Quitar ítems mencionados como "agregando X" / "no pedí X"
    const unwantedBits = raw
      .split(/\s+y\s+|\s*,\s*|\s+e\s+/i)
      .map((s) =>
        s
          .replace(
            /^(?:me\s+estan\s+agregando|me\s+estan\s+poniendo|me\s+agregaron|no\s+pedi|no\s+quiero|quita|saca)\s+(?:el|la|los|las|un|una)?\s*/i,
            '',
          )
          .replace(/\b(medio\s+pollo|limonada|gaseosa|arepas?)\b.*/i, (m) => m)
          .trim(),
      )
      .filter((s) => s.length >= 3);

    const removeQueries: string[] = [];
    for (const bit of unwantedBits) {
      if (/\b(medio\s+pollo|1\s*\/\s*2\s*pollo|medio\s+frito)\b/i.test(bit)) {
        removeQueries.push('medio pollo');
      }
      if (/\blimonada\b/i.test(bit)) removeQueries.push('limonada');
      if (/\b(gaseosa|coca|ginger)\b/i.test(bit) && !/\bcombo\b/i.test(bit)) {
        // no quitar ginger del combo salvo que digan gaseosa suelta
      }
    }
    // Frase completa también
    if (/\b(medio\s+pollo|1\s*\/\s*2)\b/i.test(raw) && /\b(agreg|poniendo|pedi|mal|solo)\b/i.test(t)) {
      removeQueries.push('medio pollo');
    }
    if (/\blimonada\b/i.test(raw) && /\b(agreg|poniendo|pedi|mal|solo)\b/i.test(t)) {
      removeQueries.push('limonada');
    }

    // "solo el combo…" → dejar solo líneas que matchean combo/arroz chino
    const keepOnlyCombo =
      /\b(solo|unicamente|únicamente|es\s+solo|nada\s+mas\s+que)\b/.test(t) &&
      /\b(combo|combro|arroz)\b/.test(t);

    let next = { ...session, cart: [...session.cart] };
    let changed = false;
    const removedNames: string[] = [];

    const extraClause = this.youAddedClause(raw);
    if (extraClause) {
      const victims = next.cart.filter((line) => {
        const product = products.find((p) => p.id === line.productId);
        if (!product) return false;
        const name = this.normalizeForMatch(product.name);
        const mentioned = this.normalizeForMatch(extraClause)
          .split(/\s+/)
          .filter((w) => w.length >= 4);
        const sharesWord = mentioned.some((w) => name.includes(w));
        if (!sharesWord) return false;
        return next.cart.some((other) => {
          if (other.productId === line.productId) return false;
          const host = products.find((p) => p.id === other.productId);
          return !!host && this.catalogService.isLooserSameDish(product, host);
        });
      });
      if (victims.length && victims.length < next.cart.length) {
        const drop = new Set(victims.map((v) => v.productId));
        removedNames.push(...victims.map((v) => v.name));
        next = { ...next, cart: next.cart.filter((c) => !drop.has(c.productId)) };
        changed = true;
      }
    }

    if (!changed && this.cartHasUnaskedExtra(raw, session)) {
      const named = next.cart.filter((c) =>
        this.catalogService.nameMentionedInText(c.name, raw),
      );
      if (named.length && named.length < next.cart.length) {
        const keep = new Set(named.map((c) => c.productId));
        removedNames.push(...next.cart.filter((c) => !keep.has(c.productId)).map((c) => c.name));
        next = { ...next, cart: next.cart.filter((c) => keep.has(c.productId)) };
        changed = true;
      }
    }

    if (keepOnlyCombo) {
      const keep = next.cart.filter((c) =>
        /\bcombo\b/i.test(c.name) || /\barroz\s+chino\b/i.test(c.name),
      );
      if (keep.length && keep.length < next.cart.length) {
        next = {
          ...next,
          cart: keep,
          pendingAttribute: undefined,
          pendingMatch: undefined,
          pendingMultiOrder: undefined,
        };
        changed = true;
      }
    }

    for (const q of [...new Set(removeQueries)]) {
      const match = this.matchCartItemsForRemoval(q, next, products);
      if (match.kind === 'single') {
        next = this.removeCartLines(next, match.indices);
        changed = true;
      } else if (match.kind === 'ambiguous' && match.options?.length) {
        // Quitar todas las ambiguas del mismo tipo (medio pollo)
        next = this.removeCartLines(
          next,
          match.options.map((o) => o.cartIndex),
        );
        changed = true;
      }
    }

    if (!changed) {
      await this.reply(
        conv,
        waId,
        `Disculpa 🙏 Dime qué quitamos (ej. *quita el medio pollo* o *quita la limonada*).\n\n` +
          this.formatCartOnly(next, this.deliveryFeeFor(next, cfg)),
      );
      return true;
    }

    await this.conversationService.saveSession(conv, next, 'building_cart');
    if (!next.cart.length) {
      await this.reply(conv, waId, 'Listo, corregí el carrito (quedó vacío). ¿Qué te gustaría pedir?');
      return true;
    }
    const gone = removedNames.length
      ? `Listo, quité ${removedNames.map((n) => `*${n}*`).join(', ')} ✅`
      : 'Listo, corregí el pedido ✅';
    if (
      conv.state === 'awaiting_payment' ||
      conv.state === 'awaiting_address' ||
      conv.state === 'awaiting_name' ||
      conv.state === 'confirming'
    ) {
      const fresh = await this.conversationService.reloadConversation(conv.id);
      Object.assign(conv, fresh);
      await this.tryConfirmOrder(conv, waId, this.conversationService.getSession(conv), {
        preface: gone,
      });
      return true;
    }
    await this.reply(
      conv,
      waId,
      `${gone}\n\n${this.formatCartOnly(next, this.deliveryFeeFor(next, cfg))}\n\n` +
        this.formatContinueShoppingPrompt(next),
    );
    return true;
  }

  /** “añadiste / agregaste …” aunque venga con typo (añladiste). */
  private youAddedClause(text: string): string | null {
    const q = this.normalizeForMatch(text);
    const m = q.match(
      /\b(?:a[nñ][a-z]{0,2}ad(?:iste|ieron)|agreg(?:aste|aron)|pus(?:iste|ieron)|met(?:iste|ieron)|coloc(?:aste|aron))\s+(.+)/,
    );
    const clause = m?.[1]?.trim();
    return clause && clause.length >= 3 ? clause : null;
  }

  /** “solo te pedí un combo” y en el carrito hay otro plato que no nombró. */
  private cartHasUnaskedExtra(text: string, session: WhatsappSessionData): boolean {
    if (parseCartQuantityCorrection(text)) return false;
    const t = this.normalizeForMatch(text);
    if (!/\b(solo|solamente|unicamente|nada mas)\b/.test(t)) return false;
    if (session.cart.length < 2) return false;
    const named = session.cart.filter((c) =>
      this.catalogService.nameMentionedInText(c.name, text),
    );
    return named.length > 0 && named.length < session.cart.length;
  }

  /**
   * En el pago, si el agente quitó un plato, se aplica y se sigue el cobro.
   * No quita el plato que el cliente acaba de decir que sí pidió.
   */
  private async applyCheckoutCartCorrection(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    _products: MenuProduct[],
    _cfg: EffectiveWhatsappConfig,
    agentRemoveIds?: number[],
  ): Promise<boolean> {
    if (!session.cart.length || !agentRemoveIds?.length) return false;
    const named = new Set(
      session.cart
        .filter((c) => this.catalogService.nameMentionedInText(c.name, text))
        .map((c) => c.productId),
    );
    const dropIds = agentRemoveIds.filter(
      (id) =>
        session.cart.some((c) => c.productId === id) &&
        !(named.has(id) && named.size < session.cart.length),
    );
    if (!dropIds.length || dropIds.length >= session.cart.length) return false;
    const removedNames = session.cart
      .filter((c) => dropIds.includes(c.productId))
      .map((c) => c.name);
    const next = {
      ...session,
      cart: session.cart.filter((c) => !dropIds.includes(c.productId)),
    };
    await this.conversationService.saveSession(conv, next, 'building_cart');
    const fresh = await this.conversationService.reloadConversation(conv.id);
    Object.assign(conv, fresh);
    await this.tryConfirmOrder(conv, waId, this.conversationService.getSession(conv), {
      preface: `Listo, quité ${removedNames.map((n) => `*${n}*`).join(', ')} ✅`,
    });
    return true;
  }

  /** "con las arepas fritas" cambia la opción de lo que ya está en el carrito. */
  private applySideChoiceToCart(
    session: WhatsappSessionData,
    text: string,
    products: MenuProduct[],
  ): WhatsappSessionData | null {
    if (!session.cart.length) return null;
    if (!this.catalogService.looksLikeSideModificationNote(text)) return null;
    if (this.catalogService.looksLikeClearlyMultiDishOrder(text)) return null;
    let changed = false;
    const cart = session.cart.map((line) => {
      const product = products.find((p) => p.id === line.productId);
      if (!product?.attributes?.length) return line;
      const explicit = this.catalogService.extractExplicitAttributeChoice(text, product);
      if (!explicit?.length) return line;
      const attrs = [...(line.attributes || [])];
      let lineChanged = false;
      for (const choice of explicit) {
        const idx = attrs.findIndex(
          (a) =>
            this.normalizeForMatch(a.attributeName) ===
            this.normalizeForMatch(choice.attributeName),
        );
        if (idx >= 0) {
          if (
            this.normalizeForMatch(attrs[idx].attributeValue) !==
            this.normalizeForMatch(choice.attributeValue)
          ) {
            attrs[idx] = choice;
            lineChanged = true;
          }
        } else {
          attrs.push(choice);
          lineChanged = true;
        }
      }
      if (!lineChanged) return line;
      changed = true;
      return { ...line, attributes: attrs };
    });
    if (!changed) return null;
    return { ...session, cart };
  }

  private async tryHandleCartQuantityCorrection(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    const correction = parseCartQuantityCorrection(text);
    const pending = session.pendingCartQuantity;
    const pick = /^\d+$/.test(text.trim()) ? Number(text.trim()) : null;
    if (!correction && !(pending && pick !== null)) return false;
    // A payment preference already contains a payable order snapshot. Clearing its
    // local ID does not cancel that external link, so do not silently change it.
    if (conv.state === 'awaiting_mp_payment' && session.mpPreferenceId) {
      await this.reply(conv, waId, 'Ya tienes un enlace de pago. Para cambiar ese pedido debemos revisar el pago con el restaurante. El carrito sigue igual.');
      return true;
    }
    const quantity = correction?.quantity ?? pending!.quantity;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 30) {
      await this.reply(conv, waId, 'Dime una cantidad entre 1 y 30. Para quitar un plato, dime cuál quitamos.');
      return true;
    }
    let indices: number[];
    if (correction) {
      indices = session.cart.flatMap((line, index) => correctionMatchesLine(line, correction.query) ? [index] : []);
      if (!indices.length) {
        await this.reply(conv, waId, 'Ese plato no está en tu carrito. Dime cuál cantidad corregimos.');
        return true;
      }
    } else {
      if (JSON.stringify(session.cart) !== pending!.cartSignature) {
        await this.conversationService.saveSession(conv, { ...session, pendingCartQuantity: undefined });
        await this.reply(conv, waId, 'El carrito cambió. Dime otra vez qué plato y cantidad corregimos.');
        return true;
      }
      if (!pick || pick > pending!.options.length) {
        await this.reply(conv, waId, 'Elige uno de los números de la lista para corregir esa línea.');
        return true;
      }
      indices = [pending!.options[pick - 1].cartIndex];
    }
    if (indices.length > 1) {
      const options = indices.map(cartIndex => ({ cartIndex, label: this.formatCartLineLabel(session.cart[cartIndex]) +
        (session.cart[cartIndex].note ? ` · ${session.cart[cartIndex].note}` : '') }));
      await this.conversationService.saveSession(conv, { ...session, pendingCartQuantity: {
        quantity, options, cartSignature: JSON.stringify(session.cart),
      } });
      await this.reply(conv, waId, `¿Cuál línea dejamos en *${quantity}*?\n\n${options.map((o, i) => `${i + 1}. ${o.label}`).join('\n')}\n\nEscribe el número. Los demás platos se conservan.`);
      return true;
    }
    const index = indices[0];
    const next: WhatsappSessionData = { ...session, cart: session.cart.map((line, i) => i === index ?
      { ...line, quantity, note: omitRedundantAttributeNote(line.note, line.attributes) } : line),
      pendingCartQuantity: undefined, pendingMatch: undefined, pendingAttribute: undefined,
      pendingMultiOrder: undefined, pendingQuantityHint: undefined, mpPreferenceId: undefined, awaitingField: undefined };
    const check = evaluateCartLimits(next.cart, this.toCartLimitsConfig(cfg, next), { orderType: next.orderType });
    if (!check.ok) {
      await this.reply(conv, waId, check.reason || 'Esa cantidad supera el límite del pedido.');
      return true;
    }
    await this.conversationService.saveSession(conv, next, 'building_cart');
    await this.reply(conv, waId, `Listo, corregí la cantidad ✅\n\n${this.formatCartOnly(next, this.deliveryFeeFor(next, cfg))}\n\n${this.formatContinueShoppingPrompt(next)}`);
    return true;
  }

  private async tryHandleCartModification(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    products: MenuProduct[],
    cfg: EffectiveWhatsappConfig,
    probeText?: string,
  ): Promise<boolean> {
    const probe = (probeText || text).trim();
    const trimmed = probe;

    if (await this.tryHandleCartQuantityCorrection(conv, waId, session, probe, cfg)) return true;

    if (session.pendingCartRemoval?.options.length) {
      const pick = /^[1-9]\d*$/.test(trimmed) ? parseInt(trimmed, 10) : null;
      if (pick && pick <= session.pendingCartRemoval.options.length) {
        const chosen = session.pendingCartRemoval.options[pick - 1];
        const removedLabel = chosen.label;
        session = this.removeCartLines(session, [chosen.cartIndex]);
        await this.conversationService.saveSession(conv, session, 'building_cart');
        if (!session.cart.length) {
          await this.reply(
            conv,
            waId,
            `Listo, quité ${removedLabel}.\n\n🛒 Carrito vacío. ¿Qué te gustaría pedir?`,
          );
          return true;
        }
        await this.reply(
          conv,
          waId,
          `Listo, quité ${removedLabel}.\n\n${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}\n\n${this.formatContinueShoppingPrompt(session)}`,
        );
        return true;
      }
    }

    if (
      await this.tryAbandonPendingSelection(conv, waId, session, text, cfg)
    ) {
      return true;
    }

    const withSide = this.applySideChoiceToCart(session, probe, products);
    if (withSide) {
      await this.conversationService.saveSession(conv, withSide, 'building_cart');
      await this.reply(
        conv,
        waId,
        `Listo, quedó con esa opción ✅\n\n${this.formatCartOnly(withSide, this.deliveryFeeFor(withSide, cfg))}\n\n${this.formatContinueShoppingPrompt(withSide)}`,
      );
      return true;
    }

    if (this.isClearCartIntent(probe)) {
      if (
        !session.cart.length &&
        !session.pendingAttribute &&
        !session.pendingMatch &&
        !session.pendingMultiOrder
      ) {
        await this.reply(conv, waId, 'Tu carrito ya está vacío. ¿Qué te gustaría pedir?');
        return true;
      }
      await this.conversationService.resetOrderSession(conv, 'building_cart', {
        ignorePriorHistory: true,
      });
      await this.reply(
        conv,
        waId,
        'Listo, *vaciamos el carrito* ✅ ¿Qué te gustaría pedir?',
      );
      return true;
    }

    // "está mal el pedido" / "solo el combo" / "me están agregando X" → corregir, no sumar
    if (await this.tryHandleCartComplaintCorrection(conv, waId, session, probe, products, cfg)) {
      return true;
    }

    const removalQuery = this.extractCartRemovalQuery(probe);
    if (!removalQuery) return false;

    if (!session.cart.length) {
      const bareSin = /^sin\s+\S/i.test(trimmed);
      const pending = session.pendingAttribute;
      const pendingName = this.normalizeForMatch(pending?.name || '');
      const removalNorm = this.normalizeForMatch(removalQuery);
      if (
        bareSin &&
        pending &&
        pendingName &&
        !pendingName.includes(removalNorm) &&
        !removalNorm.includes(pendingName)
      ) {
        const note = (
          this.catalogService.extractProductModificationNote(trimmed) || trimmed
        ).slice(0, 200);
        const prev = (session.customerNotes || '').trim();
        session = {
          ...session,
          customerNotes: [prev, note].filter(Boolean).join('. ').slice(0, 400),
        };
        await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
        const product = this.catalogService.getProductById(pending.productId, products);
        const prompt = product
          ? this.catalogService.formatProductOptionsPrompt(
              product,
              pending.selected || [],
              this.attributeFlowOpts(pending),
            )
          : 'Respóndeme con el *número* de la opción.';
        await this.reply(
          conv,
          waId,
          `Anoté *${note}* para *${pending.name}*.\n\nSigo con la elección:\n\n${prompt}`,
        );
        return true;
      }

      // Carrito vacío pero había pendiente de atributos del mismo plato → limpiar
      if (
        session.pendingAttribute &&
        this.normalizeForMatch(session.pendingAttribute.name).includes(
          this.normalizeForMatch(removalQuery),
        )
      ) {
        session = {
          ...session,
          pendingAttribute: undefined,
          pendingMatch: undefined,
        };
        await this.conversationService.saveSession(conv, session, 'building_cart');
        await this.reply(
          conv,
          waId,
          `Listo, dejamos pasar *${removalQuery}* 👍 ¿Qué te gustaría pedir?`,
        );
        return true;
      }
      await this.reply(
        conv,
        waId,
        `No tienes nada en el carrito ahora. Si quieres pedir *${removalQuery}*, dime y te lo agrego.`,
      );
      return true;
    }

    const match = this.matchCartItemsForRemoval(removalQuery, session, products);
    if (match.kind === 'none') {
      await this.reply(
        conv,
        waId,
        `No encontré *${removalQuery}* en tu carrito.\n\n${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}`,
      );
      return true;
    }

    if (match.kind === 'ambiguous') {
      session = {
        ...session,
        pendingCartRemoval: { options: match.options },
        pendingAttribute: undefined,
      };
      await this.conversationService.saveSession(conv, session, 'building_cart');
      const opts = match.options.map((o, i) => `${i + 1}. ${o.label}`).join('\n');
      await this.reply(
        conv,
        waId,
        `Tienes varias opciones parecidas. ¿Cuál quitamos?\n\n${opts}\n\nRespóndeme con el *número*.`,
      );
      return true;
    }

    session = this.removeCartLines(session, match.indices);
    await this.conversationService.saveSession(conv, session, 'building_cart');

    const count = match.indices.length;
    const removedNote =
      count > 1 ? ` (${count} unidades)` : '';
    if (!session.cart.length) {
      await this.reply(
        conv,
        waId,
        `Listo, quité ${match.label}${removedNote}.\n\n🛒 Carrito vacío. ¿Qué te gustaría pedir?`,
      );
      return true;
    }

    await this.reply(
      conv,
      waId,
      `Listo, quité ${match.label}${removedNote}.\n\n${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}\n\n${this.formatContinueShoppingPrompt(session)}`,
    );
    return true;
  }

  private isCancelIntent(text: string): boolean {
    const t = text.trim().toLowerCase();
    if (/\bno\s+(quiero\s+)?(cancelar|anular)\b/i.test(t)) return false;
    if (/^(cancelar|cancela|cancelo|anular|anula)$/i.test(t)) return true;
    return /\b(quiero\s+cancelar|cancelar\s+(el\s+)?pedido|cancela(r|me)?(\s+el)?\s*pedido|anular\s+(el\s+)?pedido|cancelen\s+(el\s+)?pedido)\b/i.test(
      t,
    );
  }

  private formatOrderStatusLabel(status: string): string {
    const map: Record<string, string> = {
      pending: 'pendiente / recibido',
      cooking: 'en preparación (cocina)',
      cooked: 'listo en cocina',
      packing: 'empacando',
      inDelivery: 'en camino',
      completed: 'completado / entregado',
      canceled: 'cancelado',
    };
    return map[status] || status;
  }

  private async handleCancelRequest(
    conv: WhatsappConversation,
    waId: string,
    cfg: Awaited<ReturnType<WhatsappSettingsService['getEffectiveConfig']>>,
  ): Promise<void> {
    const todayOrders = await this.ordersService.findTodayOrdersByPhone(conv.phoneE164);
    const active = todayOrders.find((o) => o.orderStatus !== 'canceled');

    if (active) {
      const num = String(active.dailyOrderNumber).padStart(2, '0');
      const statusLabel = this.formatOrderStatusLabel(active.orderStatus);
      await this.reply(
        conv,
        waId,
        `Ya tienes un pedido de hoy: *#${num}*.\n` +
          `Estado actual: *${statusLabel}*.\n\n` +
          `Por este chat no puedo cancelártelo. ${this.humanContactMessage()}` +
          (cfg.cancelPolicyNote ? `\n\n_${cfg.cancelPolicyNote}_` : ''),
      );
      return;
    }

    // Sin pedido creado hoy → cancelar/limpiar lo que se estaba armando
    await this.conversationService.resetOrderSession(conv, 'building_cart', {
      ignorePriorHistory: true,
    });
    await this.reply(
      conv,
      waId,
      'Listo, *quedó cancelado* ✅ (todavía no se había registrado ninguna orden).\n¿Armamos otro?',
    );
  }

  /**
   * Cliente quiere cerrar/confirmar el pedido.
   * Acepta sinónimos (confirmar, aprobado…) y typos leves (conirfmar, listoo…).
   */
  private isConfirmKeyword(text: string): boolean {
    const raw = (text || '').trim();
    if (!raw || raw.length > 72) return false;

    const t = raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[¡!?.…,;:"'`´]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!t) return false;

    // Frases claras de cierre
    if (isNothingElseOrderIntent(raw) || isFinishCheckoutIntent(raw)) return true;
    if (
      /^(ya esta|ya esta todo|ya quedo|todo bien|asi esta|asi quedo|de una|mande(lo)?|envia(lo|me)?|hagalo|hagale|proceda|vamos|dale pues)$/.test(
        t,
      ) ||
      /\b((confirmar?|confirmo|confirmado|aprobar|apruebo|aprobado|finalizar|terminar|cerrar|listo)\s+(el\s+|mi\s+)?pedido|pedido\s+(listo|confirmado|aprobado)|listo\s+pedido)\b/.test(
        t,
      )
    ) {
      return true;
    }

    const tokens = t.split(' ').filter(Boolean);
    if (!tokens.length || tokens.length > 6) return false;

    // No confundir con pedido nuevo (salvo "quiero terminar/confirmar…")
    if (
      /\b(quiero|dame|ponme|agrega|agregame|pedir|ordenar|codigo|#\d+|gaseosa|pollo|medio|cuarto|domicilio\s+a)\b/.test(
        t,
      ) &&
      !/\b(terminar|cerrar|finalizar|completar|confirmar)\b/.test(t)
    ) {
      return false;
    }

    const confirmWords = [
      'listo',
      'lista',
      'confirmar',
      'confirmo',
      'confirma',
      'confirmado',
      'confirmada',
      'aprobado',
      'aprobada',
      'apruebo',
      'aprobar',
      'finalizar',
      'finaliza',
      'finalizo',
      'ok',
      'okay',
      'oki',
      'okey',
      'dale',
      'va',
      'vale',
      'perfecto',
      'correcto',
    ];

    // Solo si TODO el mensaje es cierre ("listo", "listo por favor").
    // Si sobra otra intención, la lee el agente.
    const fillers = new Set([
      'el', 'la', 'los', 'las', 'mi', 'un', 'una', 'pedido',
      'por', 'favor', 'porfa', 'porfis', 'gracias', 'ya', 'que', 'y', 'entonces',
    ]);
    return (
      tokens.some((tok) => confirmWords.some((w) => this.confirmTokenMatches(tok, w))) &&
      tokens.every(
        (tok) => fillers.has(tok) || confirmWords.some((w) => this.confirmTokenMatches(tok, w)),
      )
    );
  }

  /** Match exacto o typo leve (edit distance / anagrama corto). */
  private confirmTokenMatches(token: string, word: string): boolean {
    if (token === word) return true;
    // listoo / listooo
    if (word.length >= 4 && token.length <= word.length + 3 && token.startsWith(word)) {
      return /^o*$/.test(token.slice(word.length));
    }
    // Cortos: solo exacto (ok, va)
    if (token.length < 4 || word.length < 4) return false;

    const dist = this.simpleEditDistance(token, word);
    const maxDist = word.length <= 5 ? 1 : word.length <= 8 ? 2 : 3;
    if (dist <= maxDist) return true;

    // Mismo largo + mismos caracteres + mismo prefijo → typo scramble (conirfmar≈confirmar)
    if (
      word.length >= 7 &&
      token.length === word.length &&
      token.slice(0, 3) === word.slice(0, 3) &&
      [...token].sort().join('') === [...word].sort().join('')
    ) {
      return true;
    }
    return false;
  }

  private simpleEditDistance(a: string, b: string): number {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      let diag = prev[0];
      prev[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const nextDiag = prev[j];
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + cost);
        diag = nextDiag;
      }
    }
    return prev[b.length];
  }

  private isGreetingKeyword(text: string): boolean {
    const t = text
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[¡!¿?.,;:]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!t) return false;

    // Cortesía colombiana suelta: "veci", "vecio", "parce"
    if (
      /^(veci(?:no|na|o)?|parce|compadre)(\s+(hola|hey|hi|buenas|buenos))*(\s+(dias|tardes|noches))?$/.test(
        t,
      )
    ) {
      return true;
    }

    // Saludos sueltos o compuestos: "hola", "buenas tardes", "hola veci", "hola vecio buenas", etc.
    return (
      /^(hola|hey|hi|buenas|buenos)(\s+(hola|hey|hi|buenas|buenos|veci(?:no|na|o)?|parce|compadre))*(\s+(dias|tardes|noches))?(\s+(hola|hey|hi|veci(?:no|na|o)?))?$/.test(
        t,
      ) ||
      /^(hola\s+)?buen(os|as)\s+(dias|tardes|noches)(\s+(veci(?:no|na|o)?|parce))?$/.test(t) ||
      /^(menu|ver\s+menu)$/.test(t)
    );
  }

  /**
   * Quita un saludo inicial del mensaje (si lo hay).
   * Ej: "hola buenas tardes, para un domicilio" → "para un domicilio"
   * Ej: "hola veci buenas" → ""
   */
  private stripLeadingGreeting(text: string): string {
    const raw = (text || '').trim();
    if (!raw) return raw;
    const stripped = raw
      .replace(
        /^(hola|hey|hi|buenas|buenos|veci(?:no|na|o)?|parce)(\s+(hola|hey|hi|buenas|buenos|veci(?:no|na|o)?|parce))*(\s+(días|dias|tardes|noches))?[^\w\n]*/i,
        '',
      )
      .trim();
    return stripped || raw;
  }

  /**
   * Quiere pedir pero aún no dijo qué producto.
   * Ej: "hola quiero hacer un pedido", "me gustaría ordenar".
   */
  private isVagueOrderIntent(text: string): boolean {
    const t = text
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (!t || t.length < 5) return false;
    // Ya trajo código o parece producto concreto → no es “vago”
    if (/\b(codigo|código|code)\s*\d+/i.test(t) || /#\s*\d+/.test(t)) return false;
    if (/^\d{1,4}$/.test(t.trim())) return false;

    const wantsOrder =
      /\b(quiero|gustaria|deseo|necesito|vengo\s+a|vine\s+a|quisiera)\b.{0,50}\b(hacer\s+)?(un\s+)?(pedido|orden)\b/i.test(
        t,
      ) ||
      /\b(hacer|realizar|armar|tomar)\s+(un\s+)?(pedido|orden)\b/i.test(t) ||
      /\b(quiero|voy\s+a|me\s+gustaria|quisiera)\s+(pedir|ordenar)\b/i.test(t) ||
      /\b(para\s+hacer\s+(un\s+)?pedido|a\s+pedir)\b/i.test(t) ||
      /^(pedir|ordenar)(\s+por\s+favor)?[\s!.?]*$/i.test(t) ||
      /\bhola\b.{0,40}\b(pedido|pedir|ordenar)\b/i.test(t);

    if (!wantsOrder) return false;

    // Si nombra algo típico del menú en la misma frase, no cortar el flujo
    if (
      /\b(pollo|medio|cuarto|entero|porcion|porciones|sopa|bebida|gaseosa|limonada|arepa|papa|maduro|chorizo|alas|pechuga|combo|menudencia|arroz|bandeja|chino|paisa|ejecutivo|frito)\b/i.test(
        t,
      )
    ) {
      return false;
    }
    return true;
  }

  private buildAskWhatToOrderMessage(
    cfg: Awaited<ReturnType<WhatsappSettingsService['getEffectiveConfig']>>,
  ): string {
    const menuUrl = (cfg.menuUrl || '').trim();
    return menuUrl
      ? `¿Qué se te antoja? Escribe el *plato* o el *código*.\n${menuUrl}`
      : `¿Qué se te antoja? Escribe el *plato* o el *código*.`;
  }

  /** “pásame el menú”, “link del menú”, “carta”, etc. — no es un pedido. */
  private isMenuLinkIntent(text: string): boolean {
    const t = text
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (!t) return false;
    // "envíame el enlace de Mercado Pago" ≠ menú
    if (this.isPaymentLinkRequest(text)) return false;
    // "quiero el menú especial / ejecutivo / de la casa" = plato, no link
    if (isNamedMenuDishOrderPhrase(text)) return false;
    if (
      /\b(link|enlace|url|pagina)\b.{0,40}\b(menu|carta)\b/i.test(t) ||
      /\b(menu|carta)\b.{0,40}\b(link|enlace|url|pagina)\b/i.test(t)
    ) {
      return true;
    }
    // "pasame el menu", "dame el menu", "mandame el menu", "quiero ver el menu"
    if (
      /\b(pasame|pasa|dame|enviame|envia|mandame|manda|comparte|quiero|necesito|mostrame|muestra)\b.{0,40}\b(el\s+)?(menu|carta)\b/i.test(
        t,
      )
    ) {
      return true;
    }
    // Solo "envíame el link/enlace" sin menú → menú SOLO si no habla de pago
    if (
      /\b(pasame|dame|enviame|mandame|comparte)\b.{0,20}\b(link|enlace|url)\b/i.test(t) &&
      !/\b(pago|pagar|tarjeta|mercado|nequi|daviplata|transferencia|mp)\b/i.test(t)
    ) {
      return true;
    }
    if (/^(ver\s+)?(el\s+)?(menu|carta)(\s+completo)?[\s!.?]*$/i.test(t)) return true;
    if (/^(link|enlace)\s+(del?\s+)?(menu|carta)[\s!.?]*$/i.test(t)) return true;
    return false;
  }

  /** Pedido explícito del link de pago (Mercado Pago / tarjeta). */
  private isPaymentLinkRequest(text: string): boolean {
    const t = (text || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (!t || t.length < 6) return false;
    const asksLink =
      /\b(link|enlace|url)\b/.test(t) ||
      /\b(envia|enviame|manda|mandame|pasa|pasame|dame|comparte)\b/.test(t);
    if (!asksLink) return false;
    return (
      /\b(mercado\s*pago|mercadopago|\bmp\b)\b/.test(t) ||
      (/\b(pago|pagar|tarjeta|checkout)\b/.test(t) &&
        !/\b(menu|carta)\b/.test(t))
    );
  }

  private isPickupIntent(text: string): boolean {
    // WhatsApp a menudo manda "no\nrecogo en el local" — colapsar saltos
    const t = text
      .trim()
      .toLowerCase()
      .replace(/[\r\n]+/g, ' ')
      .replace(/\s+/g, ' ');
    if (t.length < 4) return false;
    if (/\b(codigo|código|code)\s*\d+/i.test(t)) return false;
    return (
      /\b(para\s+llevar|pickup|recogida|pasar[eé]\s+a\s+recoger|lo\s+recojo|voy\s+por\s+(é|e)l|paso\s+yo|sin\s+domicilio|no\s+(quiero\s+)?domicilio)\b/i.test(
        t,
      ) ||
      /\b(paso|pasar[eé]|pasar|voy|recojo|recogo|recoger|llegar[eé]|llego)\b.{0,50}\b(minutos?|mins?|horas?|hrs?|rato|momento)\b/i.test(
        t,
      ) ||
      /\b(en|para)\s+\d{1,3}\s*(-|a|o|\/)?\s*\d{0,3}\s*(minutos?|mins?)\b.{0,30}\b(paso|recojo|recogo|voy|pasar)/i.test(
        t,
      ) ||
      /\bpaso\s+en\s+\d/i.test(t) ||
      /\brecogo\s+(en|por|a|yo)\b/i.test(t) ||
      /\brecojo\s+(en|por|a|yo)\b/i.test(t) ||
      /\brecoger\s+en\s+(el\s+)?(local|restaurante)\b/i.test(t) ||
      /\b(paso|pasar[eé])\s+por\s+(?:(?:el|ella|la|él)\s+)?(?:al\s+)?(local|restaurante|all[ií]|allá|él|el)\b/i.test(
        t,
      ) ||
      /\byo\s+paso(\s+por)?\b/i.test(t) ||
      /\bya\s+paso\b/i.test(t) ||
      /\bal[ií]st(a|e|o)(lo|la)?\b.{0,40}\bpaso\b/i.test(t) ||
      /\b(paso|pasar[eé])\s+(a\s+)?(recoger|buscar)(la|lo|las|los)?\b/i.test(t) ||
      /\b(lo\s+)?paso\s+a\s+(buscar|recoger)\b/i.test(t) ||
      /\bpasa(r[eé])?\s+a\s+(buscar|recoger)(la|lo|las|los)?\b/i.test(t) ||
      /\bvoy\s+(pasando|para\s+all[aá]|para\s+el\s+local)\b/i.test(t) ||
      // "no / recogo en el local" coalescido
      /\bno\b.{0,40}\b(recojo|recogo|recoger)\s+en\s+(el\s+)?local\b/i.test(t) ||
      /\b(recojo|recogo|recoger)\s+en\s+(el\s+)?local\b/i.test(t)
    );
  }

  private isDeliveryIntent(text: string): boolean {
    const t = text.trim().toLowerCase();
    if (isInterruptedPhoneOrderInquiry(t)) return false;
    if (isDeliveryRangeQuestion(text)) return false;
    return (
      /\b(domicilio|delivery|env[ií]en(me|lo)?|me\s+lo\s+(llevan|env[ií]an)|para\s+la\s+casa|a\s+domicilio)\b/i.test(
        t,
      ) && !this.isPickupIntent(t)
    );
  }

  private applyPickupIntent(session: WhatsappSessionData, text: string): WhatsappSessionData {
    const eta = this.extractEtaPhrase(text);
    const address = eta ? `Recoge en el local (${eta})` : 'Recoge en el local';
    return {
      ...session,
      orderType: 'pickup',
      address,
      fulfillmentChosen: true,
      addressConfirmed: true,
      deliveryFeeCalculated: 0,
      deliveryDistanceKm: null,
      deliveryOutOfCoverage: false,
      deliveryLat: null,
      deliveryLng: null,
    };
  }

  private extractEtaPhrase(text: string): string | null {
    const m =
      text.match(/\b(?:en|para|dentro\s+de)\s+(\d{1,3}\s*(?:-|a|o|\/)?\s*\d{0,3}\s*(?:minutos?|mins?|horas?|hrs?))\b/i) ||
      text.match(/\b(\d{1,3}\s*(?:-|a|o|\/)\s*\d{1,3}\s*(?:minutos?|mins?))\b/i) ||
      text.match(/\b(\d{1,3}\s*(?:minutos?|mins?))\b/i);
    if (!m?.[1]) return null;
    const cleaned = m[1].replace(/\s+/g, ' ').trim().toLowerCase();
    return `paso en ~${cleaned}`;
  }

  private withDeliveryAddress(
    session: WhatsappSessionData,
    address: string | null | undefined,
  ): WhatsappSessionData {
    const addr = this.normalizeDeliveryAddress(address || '');
    if (!addr) return session;
    const prev = (session.address || '').trim();

    // Regla general: domicilio ya confirmado + nota de unidad/ref (apto, torre, portón…)
    // → anexar sin pisar ni borrar fee/coords. Solo se reemplaza si es otra dirección completa.
    if (prev && session.addressConfirmed && !this.looksLikeAddressReplacement(addr)) {
      const isUnit = this.looksLikeUnitOrTowerDetailOnly(addr);
      const isRef = this.looksLikeDeliveryAccessReference(addr);
      if (isUnit || isRef) {
        const detail = isUnit ? this.normalizeUnitDetailText(addr) || addr : addr;
        const addrBase = prev.replace(/\s*\(ref\.\s*[^)]*\)\s*$/i, '').trim();
        if (addrBase.toLowerCase().includes(detail.toLowerCase())) {
          return session;
        }
        const refMatch = prev.match(/(\s*\(ref\.\s*[^)]*\))\s*$/i);
        const refSuffix = refMatch?.[1] || '';
        const joined = isUnit
          ? `${addrBase}, ${detail}${refSuffix}`
          : `${addrBase} — ${detail}${refSuffix}`;
        return {
          ...session,
          address: joined.slice(0, 240),
          orderType: 'delivery',
          fulfillmentChosen: true,
          addressConfirmed: true,
        };
      }
      // No es dirección nueva → no pisar el domicilio confirmado en applies silenciosos
      return session;
    }

    const addressChanged = !prev || prev.toLowerCase() !== addr.toLowerCase();
    const strong =
      this.isStrongExplicitAddress(addr) ||
      (this.isPlausibleDeliveryAddress(addr) && this.looksLikeAddress(addr));
    let next: WhatsappSessionData = {
      ...session,
      orderType: 'delivery',
      address: addr,
      fulfillmentChosen: true,
      addressConfirmed: !!session.addressConfirmed || strong,
      ...(addressChanged
        ? {
            deliveryFeeCalculated: undefined,
            deliveryDistanceKm: undefined,
            deliveryOutOfCoverage: false,
            deliveryLat: null,
            deliveryLng: null,
          }
        : {}),
    };

    const deliveryNote = this.extractDeliveryInstructionNote(addr);
    if (deliveryNote) {
      const existing = (next.customerNotes || '').trim();
      if (!existing.toLowerCase().includes(deliveryNote.toLowerCase())) {
        next = {
          ...next,
          customerNotes: existing ? `${existing}. ${deliveryNote}` : deliveryNote,
        };
      }
    }
    return next;
  }

  /** “portería”, “recepción”, “hotel X” como nota de domicilio. */
  private extractDeliveryInstructionNote(address: string): string | null {
    const t = (address || '').trim();
    if (!t) return null;
    const bits: string[] = [];
    if (/\bporter[ií]a\b/i.test(t)) bits.push('Entregar en portería');
    if (/\brecepci[oó]n\b/i.test(t)) bits.push('Entregar en recepción');
    const hotel = t.match(
      /\bhotel\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9][\wÁÉÍÓÚÜÑáéíóúüñ\s.'-]{1,40})/i,
    );
    if (hotel?.[1]) bits.push(`Hotel ${hotel[1].trim()}`);
    else if (/\bhotel\b/i.test(t) && !bits.some((b) => /hotel/i.test(b))) {
      bits.push('Entrega en hotel');
    }
    if (/\banuncie?\s+(al\s+)?apto\b/i.test(t) || /\bque\s+se\s+anuncie\b/i.test(t)) {
      bits.push('Que se anuncie al llegar');
    }
    if (/\bport[oó]n\b/i.test(t)) {
      const m = t.match(/\bport[oó]n\s+([^\n,.]{2,40})/i);
      bits.push(m ? `Portón ${m[1].trim()}` : 'Portón');
    }
    if (/\bmitad\s+de\s+(?:la\s+)?cuadra\b/i.test(t)) {
      bits.push('Mitad de cuadra');
    }
    return bits.length ? bits.join('. ') : null;
  }

  private applyDeliveryHintFromMessage(
    session: WhatsappSessionData,
    text: string,
  ): WhatsappSessionData {
    return this.withDeliveryAddress(session, this.extractDeliveryTail(text));
  }

  private resolveCustomerIntent(
    text: string,
    session: WhatsappSessionData,
    products: MenuProduct[],
    cfg: EffectiveWhatsappConfig,
    compound?: { productText: string; address: string | null },
  ): WhatsappMessageIntent {
    const exploringMenu =
      this.catalogService.isMenuExploreIntent(text, products) ||
      !!session.pendingCategoryBrowse?.categories?.length;

    return classifyWhatsappCustomerIntent({
      text,
      cartLength: session.cart.length,
      looksLikeSideModificationNote:
        this.catalogService.looksLikeSideModificationNote(text),
      isPriceInquiry: this.catalogService.isPriceInquiryIntent(text),
      isMenuExplore: exploringMenu,
      isCategoryBrowse: this.catalogService.isCategoryBrowseQuestion(text),
      isGenericProductInquiry: this.catalogService.isGenericProductInquiry(text),
      isOffTopicChitchat: this.catalogService.isOffTopicChitchat(text),
      isHumanRequest: isHumanHandoffRequest(text),
      isPaymentMention: !!findPaymentMethodByText(text, cfg.paymentMethods),
      looksLikeAddressOnly: this.isAddressOnlyCustomerMessage(text, compound),
      compoundAddress: compound?.address,
      compoundProductText: compound?.productText,
    });
  }

  /** Pepsi / Manzana del combo no son nota: cambian el atributo y el resto sí se anota. */
  private applyNamedCartAttributes(
    session: WhatsappSessionData,
    text: string,
    products: MenuProduct[],
  ): { session: WhatsappSessionData; noteText: string; lines: string[] } {
    const hits = this.catalogService.listCartAttributeOptionsNamedInText(
      text,
      session.cart,
      products,
    );
    if (!hits.length) return { session, noteText: text, lines: [] };
    const cart = session.cart.map((line) => ({
      ...line,
      attributes: line.attributes ? [...line.attributes] : line.attributes,
    }));
    const lines: string[] = [];
    let noteText = text;
    for (const hit of hits) {
      const line = cart[hit.cartIndex];
      if (!line) continue;
      const attributes = [...(line.attributes || [])];
      const idx = attributes.findIndex(
        (a) => a.attributeName.toLowerCase() === hit.attributeName.toLowerCase(),
      );
      const nextAttr = {
        attributeName: hit.attributeName,
        attributeValue: hit.attributeValue,
      };
      if (idx >= 0) attributes[idx] = nextAttr;
      else attributes.push(nextAttr);
      cart[hit.cartIndex] = { ...line, attributes };
      lines.push(
        `*${hit.itemName}* queda con *${hit.attributeName}: ${hit.attributeValue}*`,
      );
      const escaped = hit.attributeValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      noteText = noteText.replace(new RegExp(`\\b${escaped}\\b`, 'ig'), ' ');
    }
    noteText = noteText
      .replace(/\s+/g, ' ')
      .replace(/(?:\s+\b(?:y|con|de|el|la|un|una)\b)+\s*$/i, '')
      .trim();
    const meaningful = noteText
      .replace(/\b(?:con|y|de|el|la|un|una|por\s+favor|porfa)\b/gi, '')
      .trim();
    if (meaningful.length < 2) noteText = '';
    return { session: { ...session, cart }, noteText, lines };
  }

  private async tryHandleInlineOrderNoteEarly(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    intent: WhatsappMessageIntent,
    cfg: EffectiveWhatsappConfig,
    products: MenuProduct[],
  ): Promise<boolean> {
    if (session.cart.length === 0) return false;
    if (session.pendingAttribute || session.pendingMatch || session.pendingMultiOrder) {
      return false;
    }
    if (isCartItemReplacementIntent(text)) return false;
    if (this.catalogService.looksLikeExplicitAddProductRequest(text)) return false;
    if (intent !== 'side_note' && !this.looksLikeStandaloneOrderNote(text)) {
      return false;
    }

    // "puedo cambiar la ensalada por otra cosa" sin decir el reemplazo
    if (
      this.catalogService.looksLikeSideModificationNote(text) &&
      /\b(otra\s+cosa|algo\s+m[aá]s|qu[eé]\s+otra|en\s+vez)\b/i.test(text) &&
      !/\bpor\s+(?:m[aá]s\s+)?(?:papa(?:s|\s+salada)?|yuca(?:\s+frita)?|arepas?|aguacate|maduro|arroz|pl[aá]tano)\b/i.test(
        text,
      )
    ) {
      await this.reply(
        conv,
        waId,
        `Sí 👍 La ensalada se puede cambiar por *papa salada* o *yuca frita*.\n\n` +
          `Dime cómo lo dejas, por ejemplo:\n` +
          `• *sin ensalada, papa salada*\n` +
          `• *ensalada por yuca frita*`,
      );
      return true;
    }

    const named = this.applyNamedCartAttributes(session, text, products);
    session = named.session;
    let notedItemIndex: number | null = null;
    if (named.noteText) {
      const applied = this.applyInlineOrderNote(session, named.noteText);
      session = applied.session;
      notedItemIndex = applied.notedItemIndex;
    }
    await this.conversationService.saveSession(conv, session);
    const ack = [
      ...named.lines,
      named.noteText ? this.formatInlineNoteAck(session, notedItemIndex) : '',
    ]
      .filter(Boolean)
      .join('\n');
    const inCheckout = [
      'awaiting_payment',
      'awaiting_notes',
      'confirming',
      'awaiting_final_confirm',
    ].includes(conv.state);
    if (inCheckout) {
      await this.tryConfirmOrder(conv, waId, session, {
        preface: ack || undefined,
      });
      return true;
    }
    await this.reply(
      conv,
      waId,
      `${ack}\n\n${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}\n\n${this.formatContinueShoppingPrompt(session)}`,
    );
    return true;
  }

  /**
   * "A esta dirección plis" — confirma el domicilio ya anotado; no inventar otra calle.
   */
  private async tryHandleConfirmCurrentAddress(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    if (!isConfirmCurrentAddressIntent(text)) return false;
    if (session.cart.length === 0) return false;

    const addr = (session.address || '').trim();
    if (!addr || !this.isStrongExplicitAddress(addr)) {
      await this.conversationService.saveSession(conv, session, 'building_cart');
      await this.reply(
        conv,
        waId,
        'Escribe la *dirección* del domicilio.',
      );
      return true;
    }

    session = {
      ...session,
      fulfillmentChosen: true,
      orderType: 'delivery',
      addressConfirmed: true,
      pendingAttribute: undefined,
      pendingMatch: undefined,
      pendingMultiOrder: undefined,
    };

    // Si ya hay fee cotizado, no re-geocodificar
    const hasFee =
      typeof session.deliveryFeeCalculated === 'number' &&
      session.deliveryFeeCalculated >= 0 &&
      !session.deliveryOutOfCoverage;

    if (!hasFee) {
      const feeOk = await this.recalculateDeliveryFee(session, cfg);
      session = feeOk.session;
      await this.conversationService.saveSession(conv, session, 'building_cart');
      if (feeOk.blocked) {
        await this.reply(
          conv,
          waId,
          `Sigue valiendo _${session.address}_\n\n${feeOk.blocked}`,
        );
        return true;
      }
      const feeLine = feeOk.notice ? `\n${feeOk.notice}` : '';
      await this.reply(
        conv,
        waId,
        `📍 Perfecto, enviamos a _${session.address}_${feeLine}\n` +
          `${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}\n` +
          this.formatContinueShoppingPrompt(session),
      );
      return true;
    }

    await this.conversationService.saveSession(conv, session, 'building_cart');
    await this.reply(
      conv,
      waId,
      `📍 Listo, seguimos con _${session.address}_\n` +
        `${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}\n` +
        this.formatContinueShoppingPrompt(session),
    );
    return true;
  }

  /**
   * "esa era mi dirección" — el mensaje anterior era domicilio (p.ej. CRA #2-38)
   * y el bot lo tomó como código de menú.
   */
  private async tryHandleAddressClarification(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    if (!isAddressClarificationIntent(text)) return false;
    if (session.cart.length === 0) return false;

    let addr: string | null = session.address?.trim() || null;
    if (!addr || !this.isPlausibleDeliveryAddress(addr)) {
      const recent = await this.conversationService.getRecentMessageTexts(conv.id, 12);
      for (let i = recent.length - 1; i >= 0; i--) {
        const line = recent[i];
        if (!/^Cliente:\s*/i.test(line)) continue;
        const body = line.replace(/^Cliente:\s*/i, '').trim();
        if (!body || isAddressClarificationIntent(body)) continue;
        if (
          looksLikeAddressOnlyMessage(body) ||
          this.isPlausibleDeliveryAddress(body)
        ) {
          addr = body;
          break;
        }
      }
    }

    session = {
      ...session,
      pendingAttribute: undefined,
      pendingMatch: undefined,
      pendingMultiOrder: undefined,
    };

    if (!addr || !this.isPlausibleDeliveryAddress(addr)) {
      await this.conversationService.saveSession(conv, session, 'building_cart');
      await this.reply(
        conv,
        waId,
        'Perdón 🙏 Escribe de nuevo la *dirección*.',
      );
      return true;
    }

    session = this.withDeliveryAddress(
      {
        ...session,
        fulfillmentChosen: true,
        orderType: 'delivery',
        addressConfirmed: true,
        deliveryFeeCalculated: undefined,
        deliveryDistanceKm: undefined,
        deliveryOutOfCoverage: false,
        deliveryLat: null,
        deliveryLng: null,
      },
      addr,
    );
    const feeOk = await this.recalculateDeliveryFee(session, cfg);
    session = feeOk.session;
    await this.conversationService.saveSession(conv, session, 'building_cart');

    if (feeOk.blocked) {
      await this.reply(
        conv,
        waId,
        `Perfecto, ya registré la dirección _${session.address}_.\n\n${feeOk.blocked}`,
      );
      return true;
    }
    const feeLine = feeOk.notice ? `\n${feeOk.notice}` : '';
    await this.reply(
      conv,
      waId,
      `Perfecto, ya registré la dirección _${session.address}_${feeLine}\n` +
        `${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}\n` +
        this.formatContinueShoppingPrompt(session),
    );
    return true;
  }

  private resolveDishPhrase(phrase: string, products: MenuProduct[]): MenuProduct | null {
    const spoken = this.catalogService.resolveSpokenDish(phrase, products);
    if (spoken) return spoken;
    const q = this.normalizeForMatch(phrase);
    if (q.length < 5) return null;
    const hits = products.filter((p) => {
      if (p.availableNow === false) return false;
      return this.normalizeForMatch(p.name).split(/\s+/).includes(q);
    });
    return hits.length === 1 ? hits[0] : null;
  }

  /** "2 #20" y "2 #38" agregan esos códigos del menú. */
  private async tryHandleQtyMenuCodes(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    products: MenuProduct[],
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    const lines = parseQtyMenuCodeLines(text);
    if (!lines) return false;
    const picks: { product: MenuProduct; qty: number }[] = [];
    for (const line of lines) {
      const product = this.catalogService.findByCode(line.code, products);
      if (!product || product.availableNow === false) {
        await this.reply(
          conv,
          waId,
          `No encontré *#${line.code}* en el menú. Dime el nombre del plato.`,
        );
        return true;
      }
      picks.push({ product, qty: line.qty });
    }
    let next = session;
    const labels: string[] = [];
    for (const pick of picks) {
      const added = this.tryAddProductToCart(next, pick.product, pick.qty, cfg, undefined, undefined, {
        sourceText: text,
      });
      if (added.blocked) {
        await this.handleCartLimitBlocked(conv, waId, added.blocked, cfg);
        return true;
      }
      if (added.missingAttributes) return false;
      next = added.session;
      labels.push(this.formatAddedProductLabel(pick.product.name, pick.qty));
    }
    await this.conversationService.saveSession(conv, next, 'building_cart');
    await this.reply(
      conv,
      waId,
      this.buildCartAddReply(next, this.deliveryFeeFor(next, cfg), labels.join(', ')),
    );
    return true;
  }

  /**
   * El bot preguntó entre platos y el cliente nombró uno, con typo o sin él.
   * Se queda ese plato y lo demás que ya había pedido en el mensaje anterior.
   */
  private async tryHandlePriorOfferPick(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    products: MenuProduct[],
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    const raw = (text || '').trim();
    if (raw.length < 3 || raw.length > 80 || /[?¿]/.test(raw)) return false;
    if (session.pendingAttribute || session.pendingMultiOrder) return false;
    if (conv.state !== 'building_cart' && conv.state !== 'awaiting_attribute') return false;
    if (
      this.catalogService.looksLikeClearlyMultiDishOrder(raw) ||
      this.catalogService.looksLikeMultiItemOrderMessage(raw) ||
      this.catalogService.isAvailabilityInquiry(raw)
    ) {
      return false;
    }
    const last = await this.conversationService.getLastOutboundBody(conv.id);
    if (!last) return false;
    const picked = pickProductNamedInLastOffer(raw, last, products);
    if (!picked) return false;
    const product = products.find((p) => p.id === picked.id && p.availableNow !== false);
    if (!product) return false;

    const recent = await this.conversationService.getRecentMessageTexts(conv.id, 8);
    const customerLines = recent
      .filter((line) => line.startsWith('Cliente:'))
      .map((line) => line.slice('Cliente:'.length).trim());
    const prev = customerLines.length >= 2 ? customerLines[customerLines.length - 2] : '';
    const items: Array<{ product: MenuProduct; segment: string }> = [];
    if (
      prev &&
      (this.catalogService.looksLikeClearlyMultiDishOrder(prev) ||
        this.catalogService.looksLikeMultiItemOrderMessage(prev))
    ) {
      const multi = this.catalogService.resolveMultiProductOrder(prev, products);
      const group = multi?.ambiguous.find((row) =>
        row.candidates.some((c) => c.id === product.id),
      );
      const known = [...(multi?.confident || []), ...(multi?.needsAttributes || [])].find(
        (row) => row.product.id === product.id,
      );
      if (group || known) {
        items.push({ product, segment: group?.segment || known?.segment || raw });
        for (const row of [...(multi?.confident || []), ...(multi?.needsAttributes || [])]) {
          if (row.product.id === product.id) continue;
          if (group?.candidates.some((c) => c.id === row.product.id)) continue;
          items.push({ product: row.product, segment: row.segment });
        }
      }
    }
    if (!items.length) items.push({ product, segment: raw });

    return this.addResolvedDishesToCart(
      conv,
      waId,
      { ...session, pendingMatch: undefined, pendingMultiOrder: undefined },
      items,
      cfg,
    );
  }

  /** "2 de cada una" agrega esa cantidad de cada plato nombrado en el último mensaje del bot. */
  private async tryHandleEachOfListed(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    products: MenuProduct[],
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    const qty = parseEachOfQuantity(text);
    if (!qty) return false;
    const last = await this.conversationService.getLastOutboundBody(conv.id);
    if (!last) return false;
    const names = productNamesMentionedInOffer(
      last,
      products.map((p) => p.name),
    );
    const dishes: MenuProduct[] = [];
    for (const name of names) {
      const dish = products.find(
        (p) =>
          p.availableNow !== false &&
          this.normalizeForMatch(p.name) === this.normalizeForMatch(name),
      );
      if (dish && !dishes.some((d) => d.id === dish.id)) dishes.push(dish);
    }
    if (dishes.length < 2) return false;

    // "2 de cada una" puede referirse a variantes listadas junto a una
    // categoría genérica ("sopa pequeña", que exige elegir sabor).
    // No modificar el carrito hasta que el cliente precise qué presentaciones.
    if (dishes.some((dish) => dish.hasAttributes && dish.attributes?.length)) {
      await this.reply(
        conv,
        waId,
        `Para no equivocarme, ¿cuáles quieres exactamente? Te mencioné ${dishes
          .map((dish) => dish.name)
          .join(', ')}. Dime los nombres y las cantidades antes de agregarlas.`,
      );
      return true;
    }

    let next = session;
    const labels: string[] = [];
    for (const dish of dishes) {
      const added = this.tryAddProductToCart(next, dish, qty, cfg, undefined, undefined, {
        sourceText: text,
      });
      if (added.blocked) {
        await this.handleCartLimitBlocked(conv, waId, added.blocked, cfg);
        return true;
      }
      if (added.missingAttributes) return false;
      next = added.session;
      labels.push(this.formatAddedProductLabel(dish.name, qty));
    }

    const addrLine = text
      .split('\n')
      .map((s) => s.trim())
      .find((line) => looksLikeAddressOnlyMessage(line) && this.isPlausibleDeliveryAddress(line));
    if (addrLine) {
      next = this.withDeliveryAddress(
        { ...next, fulfillmentChosen: true, orderType: 'delivery' },
        addrLine,
      );
      const feeOk = await this.recalculateDeliveryFee(next, cfg);
      next = feeOk.session;
    }

    await this.conversationService.saveSession(conv, next, 'building_cart');
    await this.reply(
      conv,
      waId,
      this.buildCartAddReply(next, this.deliveryFeeFor(next, cfg), labels.join(', ')),
    );
    return true;
  }

  /** "No, son 2 de ajiaco y 2 de menudencias" deja el carrito solo con eso. */
  private async tryHandleQtyDishCorrection(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    products: MenuProduct[],
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    const lines = parseQtyDishCorrection(text);
    if (!lines || !session.cart.length) return false;
    const resolved: { product: MenuProduct; qty: number }[] = [];
    for (const line of lines) {
      const product = this.resolveDishPhrase(line.dish, products);
      if (!product) return false;
      resolved.push({ product, qty: line.qty });
    }
    let next: WhatsappSessionData = {
      ...session,
      cart: [],
      pendingAttribute: undefined,
      pendingMatch: undefined,
      pendingMultiOrder: undefined,
    };
    for (const line of resolved) {
      const added = this.tryAddProductToCart(next, line.product, line.qty, cfg, undefined, undefined, {
        sourceText: text,
      });
      if (added.blocked || added.missingAttributes) return false;
      next = added.session;
    }
    await this.conversationService.saveSession(conv, next, 'building_cart');
    await this.reply(
      conv,
      waId,
      `Listo, dejé solo eso ✅\n\n${this.formatCartOnly(next, this.deliveryFeeFor(next, cfg))}\n\n¿*Algo más*?`,
    );
    return true;
  }

  /** "Y envias mucho ají, por favor" queda en la nota, no en el nombre. */
  private async tryHandleKitchenSendRequest(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    if (!session.cart.length || !looksLikeKitchenSendRequest(text)) return false;
    const note = text
      .replace(/^(y\s+)/i, '')
      .replace(/[,.]?\s*por favor[\s!.?]*$/i, '')
      .trim();
    if (!note) return false;
    const next = this.appendCustomerNote(session, note);
    await this.conversationService.saveSession(conv, next, 'building_cart');
    await this.reply(
      conv,
      waId,
      `Listo, lo dejo en la nota: _${note}_ ✅\n\n${this.formatCartOnly(next, this.deliveryFeeFor(next, cfg))}\n\n¿*Algo más*?`,
    );
    return true;
  }

  /** Con carrito, "¿cuánto me están cobrando?" responde el total, no abre la carta. */
  private async tryHandleCartChargeQuestion(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    if (!session.cart.length || !isCartChargeQuestion(text)) return false;
    await this.reply(
      conv,
      waId,
      `Esto es lo que va en el pedido:\n\n${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}\n\nSi algo no es, dime cómo queda (ej. *2 de ajiaco y 2 de menudencias*).`,
    );
    return true;
  }

  private async tryHandleAddressOnlyWhileBuildingCart(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    originalText: string,
    compound: { productText: string; address: string | null },
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    if (parseEachOfQuantity(originalText) || parseQtyMenuCodeLines(originalText)) return false;
    // Solo calle/#/landmark conocido gana sobre attrs pendientes.
    // NUNCA frases genéricas (ej. "Las mojarras fritas" ≠ dirección).
    const clearStreetAddress =
      this.isAddressOnlyCustomerMessage(originalText, compound) &&
      this.isPlausibleDeliveryAddress(originalText.trim()) &&
      !this.looksLikeFoodNotAddress(originalText) &&
      (/\b(calle|carrera|cra|cll|av\.?|avenida|diag|dg|transversal|#)\b/i.test(originalText) ||
        this.looksLikeLandmarkOrComplexName(originalText) ||
        PPP_ZONE_LANDMARK_RE.test(originalText));
    if (
      !clearStreetAddress &&
      (session.pendingAttribute || session.pendingMatch || session.pendingMultiOrder)
    ) {
      return false;
    }
    if (looksLikeClearCartMessage(originalText)) return false;

    // Ya hay dirección: "Torre 7 apto 901" / "casa 115" = detalle de unidad, no otra dirección
    if (
      await this.tryAppendUnitDetailsToAddress(
        conv,
        waId,
        session,
        originalText,
        cfg,
      )
    ) {
      return true;
    }

    // Ya hay dirección fuerte: "portón verde / mitad de cuadra" = referencia, no nueva dirección
    if (
      await this.tryAppendDeliveryAccessReference(
        conv,
        waId,
        session,
        originalText,
        cfg,
      )
    ) {
      return true;
    }

    // Domicilio confirmado + mensaje que NO es otra dirección completa → no geocodificar
    if (
      session.addressConfirmed &&
      session.address?.trim() &&
      !this.looksLikeAddressReplacement(originalText)
    ) {
      return false;
    }

    // “acá” / “la misma” con dirección guardada del pedido anterior
    if (
      isReuseLastAddressIntent(originalText) &&
      session.lastDeliveryAddress?.trim() &&
      !session.addressConfirmed
    ) {
      const wasAwaitingAddress = conv.state === 'awaiting_address';
      const addr = session.lastDeliveryAddress.trim();
      session = this.withDeliveryAddress(
        {
          ...session,
          fulfillmentChosen: true,
          orderType: 'delivery',
          addressConfirmed: true,
          deliveryFeeCalculated: undefined,
          deliveryDistanceKm: undefined,
          deliveryOutOfCoverage: false,
          deliveryLat: null,
          deliveryLng: null,
        },
        addr,
      );
      const feeOk = await this.recalculateDeliveryFee(session, cfg);
      session = feeOk.session;
      await this.conversationService.saveSession(conv, session, 'building_cart');
      if (feeOk.blocked) {
        await this.reply(
          conv,
          waId,
          `Dirección anotada: _${session.address}_\n\n${feeOk.blocked}`,
        );
        return true;
      }
      const feeLine = feeOk.notice ? `\n${feeOk.notice}` : '';
      // Tras “¿Misma dirección?” (awaiting_address) → seguir checkout, no ¿algo más?
      if (wasAwaitingAddress) {
        await this.tryConfirmOrder(conv, waId, session, {
          preface: `📍 Misma dirección ✅ _${session.address}_${feeLine}`,
        });
        return true;
      }
      await this.reply(
        conv,
        waId,
        `📍 Misma dirección ✅ _${session.address}_${feeLine}\n` +
          `${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}\n` +
          this.formatContinueShoppingPrompt(session),
      );
      return true;
    }
    // No interferir en pasos de pago / notas / confirmación final
    if (
      conv.state &&
      [
        'awaiting_payment',
        'awaiting_notes',
        'awaiting_phone',
        'awaiting_name',
        'confirming',
        'completed',
        'closed',
        'human_takeover',
      ].includes(conv.state)
    ) {
      return false;
    }

    if (!this.isAddressOnlyCustomerMessage(originalText, compound)) return false;

    const wasAwaitingAddress = conv.state === 'awaiting_address';
    const addr =
      compound.address ||
      this.extractDeliveryTail(originalText) ||
      (this.isPlausibleDeliveryAddress(originalText.trim())
        ? originalText.trim()
        : null);
    if (!addr || !this.isPlausibleDeliveryAddress(addr)) return false;
    if (this.isPickupIntent(originalText) || this.isPickupIntent(addr)) return false;

    session = this.withDeliveryAddress(
      {
        ...session,
        fulfillmentChosen: true,
        orderType: 'delivery',
        // Soltar selección errónea (ej. #2 de "CRA … #2-38" tratado como 1/2 pollo)
        pendingAttribute: undefined,
        pendingMatch: undefined,
        pendingMultiOrder: undefined,
      },
      addr,
    );
    session = {
      ...session,
      addressConfirmed: true,
      deliveryFeeCalculated: undefined,
      deliveryDistanceKm: undefined,
      deliveryOutOfCoverage: false,
      deliveryLat: null,
      deliveryLng: null,
    };

    const feeOk = await this.recalculateDeliveryFee(session, cfg);
    session = feeOk.session;
    await this.conversationService.saveSession(conv, session, 'building_cart');

    if (feeOk.blocked) {
      await this.reply(
        conv,
        waId,
        `Dirección anotada: _${session.address}_\n\n${feeOk.blocked}`,
      );
      return true;
    }

    const feeLine = feeOk.notice ? `\n${feeOk.notice}` : '';
    if (!session.cart.length) {
      await this.reply(
        conv,
        waId,
        `📍 Domicilio anotado: _${session.address}_${feeLine}\n\nDime qué se te antoja y lo armo.`,
      );
      return true;
    }
    // Dirección nueva mientras pedimos domicilio → seguir checkout (pago/confirmar)
    if (wasAwaitingAddress) {
      await this.tryConfirmOrder(conv, waId, session, {
        preface: `📍 Domicilio anotado: _${session.address}_${feeLine}`,
      });
      return true;
    }
    await this.reply(
      conv,
      waId,
      `📍 Domicilio anotado: _${session.address}_${feeLine}\n` +
        `${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}\n` +
        this.formatContinueShoppingPrompt(session),
    );
    return true;
  }

  /**
   * Con dirección ya confirmada: "Torre 7 apto 901", "casa 115", "int 2"
   * son detalle de unidad — se anexan sin re-geocodificar (no pisar el conjunto).
   */
  private async tryAppendUnitDetailsToAddress(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    const raw = (text || '').trim();
    if (!raw || raw.length < 3) return false;
    if (!session.address?.trim() || !session.addressConfirmed) return false;
    if (!this.looksLikeUnitOrTowerDetailOnly(raw)) return false;

    const detail = this.normalizeUnitDetailText(raw);
    if (!detail) return false;

    const addrBase = session.address
      .replace(/\s*\(ref\.\s*[^)]*\)\s*$/i, '')
      .trim();
    const alreadyInAddr = addrBase.toLowerCase().includes(detail.toLowerCase());
    // Preservar "(ref. mapa: …)" del geocode previo
    const refMatch = session.address.match(/(\s*\(ref\.\s*[^)]*\))\s*$/i);
    const refSuffix = refMatch?.[1] || '';
    const nextAddr = alreadyInAddr
      ? session.address
      : `${addrBase}, ${detail}${refSuffix}`.slice(0, 240);

    session = {
      ...session,
      address: nextAddr,
      // Mantener fee/coords del conjunto; no recalcular por torre/apto
      // No duplicar en Notas: el detalle ya va en la dirección
    };
    await this.conversationService.saveSession(conv, session, 'building_cart');
    await this.reply(
      conv,
      waId,
      `Perfecto, anoté: _${nextAddr.replace(/\s*\(ref\.\s*[^)]*\)\s*$/i, '').trim()}_\n` +
        `${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}\n` +
        (session.phoneConfirmed
          ? this.formatContinueShoppingPrompt(session)
          : `¿Número de contacto para el domicilio?`),
    );
    if (!session.phoneConfirmed && conv.state !== 'awaiting_phone') {
      await this.conversationService.saveSession(conv, session, 'awaiting_phone');
    }
    return true;
  }

  /**
   * Solo detalle de unidad/torre/apto/casa — sin calle ni conjunto nuevo.
   * Regla general (cualquier domicilio previo), no un barrio concreto.
   */
  looksLikeUnitOrTowerDetailOnly(text: string): boolean {
    let t = (text || '').trim();
    if (!t || t.length < 2 || t.length > 60) return false;
    if (looksLikeClearCartMessage(t) || looksLikeNonAddressCommand(t)) return false;
    if (this.looksLikeFoodNotAddress(t)) return false;
    if (isDeliveryEtaInquiry(t)) return false;

    t = this.normalizeUnitDetailText(t);
    if (!t) return false;

    if (
      /\b(calle|carrera|cra|cll|av\.?|avenida|diag(?:onal)?|dg|transversal)\b/i.test(t) &&
      /\d/.test(t)
    ) {
      return false;
    }
    if (
      /\b(balcones|bosques|castilla|castell[oó]n|tabaku|altavista|nuevo\s+sol|terrazas|aralia|portal|conjunto|urbanizaci[oó]n|hospital|cl[ií]nica|brisas|alameda)\b/i.test(
        t,
      )
    ) {
      return false;
    }

    const n = t
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (
      /^(?:torre\s*)?\d{1,2}\s*(?:apto|apartamento|apt|ap)\.?\s*\d{2,4}[a-z]?$/.test(n) ||
      /^torre\s*\d{1,2}(?:\s*(?:apto|apartamento|apt|ap|int\.?|interior|casa)?\.?\s*\d{0,4}[a-z]?)?$/.test(
        n,
      ) ||
      /^(?:apto|apartamento|apt|ap)\.?\s*\d{2,4}[a-z]?(?:\s*(?:torre|bloque)\s*\d{1,2})?$/.test(n) ||
      /^(?:casa|int\.?|interior|bloque|piso|local|oficina|habitaci[oó]n)\s*\d{1,4}[a-z]?$/.test(n) ||
      /^(?:torre|bloque)\s*\d{1,2}\s*(?:apto|apartamento|apt|ap|int\.?|interior)?\.?\s*\d{0,4}[a-z]?$/.test(
        n,
      )
    ) {
      return true;
    }

    if (
      (/\b(torre|bloque)\s*\d{1,2}\b/.test(n) ||
        /\b(apto|apartamento|apt|ap|int\.?|interior|casa|local|oficina)\.?\s*\d{1,4}\b/.test(n)) &&
      !/\b(calle|carrera|cra|av|avenida)\b/.test(n)
    ) {
      const words = n.split(/\s+/).filter(Boolean);
      return words.length >= 1 && words.length <= 6;
    }

    return false;
  }

  /**
   * ¿Mensaje = otra dirección completa que SÍ debe reemplazar el domicilio?
   * Si no → con dirección confirmada se trata como nota (torre/apto/ref).
   */
  looksLikeAddressReplacement(text: string): boolean {
    const raw = (text || '').trim();
    if (!raw || raw.length < 5) return false;
    if (this.looksLikeUnitOrTowerDetailOnly(raw)) return false;
    if (this.looksLikeDeliveryAccessReference(raw)) return false;
    if (looksLikeClearCartMessage(raw) || looksLikeNonAddressCommand(raw)) return false;
    if (this.looksLikeFoodNotAddress(raw)) return false;

    if (
      /\b(calle|carrera|cra|cll|av\.?|avenida|diag(?:onal)?|dg|transversal|tv)\b/i.test(raw) &&
      /\d/.test(raw)
    ) {
      return true;
    }
    if (this.looksLikeLandmarkOrComplexName(raw) && raw.length >= 8) {
      return true;
    }
    if (
      /#\s*\d{1,4}[a-z]?\s*-\s*\d/i.test(raw) &&
      !/\b(apto|apartamento|apt|ap)\b/i.test(raw)
    ) {
      return true;
    }
    return false;
  }

  private normalizeUnitDetailText(text: string): string {
    return (text || '')
      .replace(/\bt[\s\-]*(\d{1,2})\b/gi, 'Torre $1')
      .replace(/\btorre[\s\-]*(\d{1,2})\b/gi, 'Torre $1')
      .replace(/\bbloque[\s\-]*(\d{1,2})\b/gi, 'Bloque $1')
      .replace(/\bapt\.?(?=\s*\d)/gi, 'apto')
      .replace(/\bapartamento\.?\s*/gi, 'apto ')
      .replace(/\b(\d)\s*apto\.?\s*(\d{2,4})\b/gi, '$1 apto $2')
      .replace(/\btorre\s*(\d+)\s*apto\.?\s*(\d{2,4})\b/gi, 'Torre $1 apto $2')
      .replace(/\bapto\.?\s*(\d{2,4})\b/gi, 'apto $1')
      .replace(/\bcasa\s*(\d{1,4})\b/gi, 'Casa $1')
      .replace(/\bint(?:erior)?\.?\s*(\d{1,4})\b/gi, 'int $1')
      .replace(/\blocal\s*(\d{1,4})\b/gi, 'Local $1')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);
  }

  /**
   * Con dirección ya confirmada: "portón verde", "mitad de cuadra", "casa blanca"
   * son referencias de acceso — se anexan, no reemplazan ni re-geocodifican.
   */
  private async tryAppendDeliveryAccessReference(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    const raw = (text || '').trim();
    if (!raw || raw.length < 4) return false;
    if (!session.address?.trim() || !session.addressConfirmed) return false;
    if (!this.isStrongExplicitAddress(session.address)) return false;
    if (this.isStrongExplicitAddress(raw)) return false;
    if (!this.looksLikeDeliveryAccessReference(raw)) return false;

    const note = raw.replace(/\s+/g, ' ').trim().slice(0, 160);
    const addrBase = session.address
      .replace(/\s*\(ref\.\s*[^)]*\)\s*$/i, '')
      .trim();
    const alreadyInAddr = addrBase.toLowerCase().includes(note.toLowerCase());
    const nextAddr = alreadyInAddr ? session.address : `${addrBase} — ${note}`.slice(0, 240);

    session = this.appendCustomerNote(
      {
        ...session,
        address: nextAddr,
        // Mantener fee/coords de la dirección fuerte; no recalcular por la referencia
      },
      note,
    );
    await this.conversationService.saveSession(conv, session, 'building_cart');
    await this.reply(
      conv,
      waId,
      `📝 Ref: _${note}_\n` +
        `📍 _${session.address}_\n` +
        `${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}\n` +
        this.formatContinueShoppingPrompt(session),
    );
    return true;
  }

  /**
   * Indicaciones visuales / de acceso (no calle ni placa).
   * Ej: "Portón verde grande a mitad de cuadra", "casa blanca", "timbre 302".
   */
  looksLikeDeliveryAccessReference(text: string): boolean {
    const t = (text || '').trim();
    if (!t || t.length < 4 || t.length > 120) return false;
    if (looksLikeClearCartMessage(t) || looksLikeNonAddressCommand(t)) return false;
    if (this.looksLikeFoodNotAddress(t)) return false;
    // Si trae vía + número, es dirección real
    if (
      /\b(calle|carrera|cra|cll|av\.?|avenida|diag(?:onal)?|dg|transversal|tv)\b/i.test(t) &&
      /\d/.test(t)
    ) {
      return false;
    }
    if (/#\s*\d/i.test(t) && /\b(calle|carrera|cra|diag|dg|av)\b/i.test(t)) return false;

    const n = t
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (
      /\b(porton|puerta|reja|timbre|intercomunicador|porteria|recepcion)\b/.test(n)
    ) {
      return true;
    }
    if (
      /\b(mitad\s+de\s+(?:la\s+)?cuadra|al\s+fondo|esquina|segundo\s+piso|tercer\s+piso|casa\s+(?:de\s+)?color|fachada|frente\s+a(?:l)?\s+(?:un\s+)?(?:parqueadero|parque|tienda|iglesia))\b/.test(
        n,
      )
    ) {
      return true;
    }
    // "verde grande", "casa blanca", "porton azul"
    if (
      /\b(verde|azul|rojo|roja|blanco|blanca|negro|negra|cafe|amarrillo|amarillo|gris)\b/.test(
        n,
      ) &&
      /\b(porton|puerta|reja|casa|grande|pequeno|pequena|fachada|pintura)\b/.test(n)
    ) {
      return true;
    }
    return false;
  }

  /** ¿El mensaje es solo domicilio (sin platos nuevos)? */
  private isAddressOnlyCustomerMessage(
    text: string,
    compound?: { productText: string; address: string | null },
  ): boolean {
    const raw = (text || '').trim();
    if (raw.length < 4) return false;

    // "qué bebidas hay" / explorar menú ≠ dirección
    // Comida / estilo ("Las mojarras fritas") nunca es solo domicilio
    if (
      this.catalogService.isMenuExploreIntent(raw, []) ||
      this.catalogService.isCategoryBrowseQuestion(raw) ||
      looksLikeNonAddressCommand(raw) ||
      isDeliveryEtaInquiry(raw) ||
      this.looksLikeFoodNotAddress(raw) ||
      FOOD_ORDER_SIGNAL_RE.test(raw) ||
      this.catalogService.looksLikeSideModificationNote(raw)
    ) {
      return false;
    }

    if (
      this.catalogService.looksLikeClearlyMultiDishOrder(raw) ||
      this.catalogService.looksLikeFoodPlusDrinkOrder(raw) ||
      this.catalogService.looksLikeMultiItemOrderMessage(raw)
    ) {
      return false;
    }

    if (
      looksLikeAddressOnlyMessage(raw, {
        compoundAddress: compound?.address,
        compoundProductText: compound?.productText,
      })
    ) {
      return true;
    }

    // Con carrito: barrio/conjunto suelto ("Bosques de Castilla") = domicilio, no plato
    if (this.looksLikeLandmarkOrComplexName(raw, { allowGenericPhrase: true })) {
      return true;
    }

    const tail = this.extractDeliveryTail(raw);
    if (tail && looksLikeAddressOnlyMessage(tail)) {
      return true;
    }

    return false;
  }

  /** Quita prefijos de entrega ("domicilio a", "estoy ubicado en") del texto de dirección. */
  private stripDeliveryAddressPreface(raw: string): string {
    let t = (raw || '').trim();
    for (let i = 0; i < 3; i++) {
      const next = t
        .replace(/^(?:enviar|mandar|llevar|traer)\s+(?:a\s+)?domicilio\s+(?:a|en|para)\s+/i, '')
        .replace(/^domicilio\s+(?:a|en|para)\s+/i, '')
        .replace(/^(?:a|en|para)\s+domicilio\s+(?:a|en|para)\s+/i, '')
        .replace(/^domicilio\s+/i, '')
        .replace(
          /^(?:estoy|estamos|ando|ando\s+ubicad[oa]|me\s+encuentro|quedo|quedamos)\s+(?:ubicad[oa]s?\s+)?(?:en|en\s+el|en\s+la|en\s+los|en\s+las)\s+/i,
          '',
        )
        .replace(/^estoy\s+ubicad[oa]\s+en\s+(?:el\s+|la\s+)?/i, '')
        .replace(/^(?:vivo|vivimos)\s+en\s+(?:el\s+|la\s+)?/i, '')
        .trim();
      if (next === t) break;
      t = next;
    }
    // "para la calle 39 sur…" / "para el hospital…" → quitar muletilla de destino
    const withoutPara = t
      .replace(/^(?:para)\s+(?:la\s+|el\s+|los\s+|las\s+)?/i, '')
      .trim();
    if (
      withoutPara.length >= 4 &&
      withoutPara !== t &&
      (/\b(calle|carrera|cra|cll|av\.?|avenida|diag|dg\.?|transversal|autopista|km)\b/i.test(
        withoutPara,
      ) ||
        /#|\d/.test(withoutPara) ||
        PPP_ZONE_LANDMARK_RE.test(withoutPara) ||
        /\b(hospital|cl[ií]nica|hotel|hostal|conjunto|torre|centro|plaza|bosques?|castilla)\b/i.test(
          withoutPara,
        ))
    ) {
      t = withoutPara;
    }
    return t;
  }

  /** Corta teléfono, nombre u otras colas que no son parte de la dirección. */
  private truncateAddressAfterContactClauses(raw: string): string {
    let t = (raw || '').trim();
    if (!t) return t;

    const cutPatterns = [
      /[,;]\s*(?:mi\s+)?(?:cel(?:ular)?|tel\w*|whatsapp|wa|n[uú]mero)\b.*/is,
      /[,;]\s*(?:me\s+llamo|soy|mi\s+nombre\s+es|nombre\s*:)\b.*/is,
      /\s+(?:mi\s+)?(?:cel(?:ular)?|tel\w*|whatsapp|wa|n[uú]mero)\s*(?:es|:)\s*(?:este|el\s+de\s+(?:whatsapp|wa|aqu[ií])|este\s+n[uú]mero|el\s+mismo|el\s+que\s+(?:tengo|escribo|est[aá]\s+usando))\b.*/is,
      /\s+y\s+(?:mi\s+)?(?:cel(?:ular)?|tel\w*)\b.*/is,
    ];

    for (const re of cutPatterns) {
      t = t.replace(re, '').trim();
    }
    return t.replace(/[,;]\s*$/, '').trim();
  }

  private normalizeDeliveryAddress(raw: string): string {
    let t = (raw || '')
      .replace(/\s+/g, ' ')
      .replace(/^[\s,.-]+|[\s,.-]+$/g, '')
      .trim();
    t = this.truncateAddressAfterContactClauses(t);
    t = this.stripDeliveryAddressPreface(t);
    t = stripTrailingAddressFluff(t);
    // Cortesía / setup pegado: "Me colaboras con . Dirección Conjunto…"
    t = t
      .replace(
        /^(?:me\s+)?(?:colaboras|ayudas|colaborame|ayudame|puedes\s+ayudarme?)\b[\s\w.]*?(?=\bdirecci[oó]n\b|$)/i,
        '',
      )
      .replace(/^(?:con\s+)?(?:un\s+|una\s+)?domicilio\b[\s.]*/i, '')
      .replace(/^(?:por\s+favor|porfa)\b[\s.]*/i, '')
      .replace(/^\.?\s*/g, '')
      .replace(/\bdirecci[oó]n\s*[:\-]?\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    return t
      .replace(/^(?:a\s+)?(?:la|el|los|las|al)\s+/i, '')
      .replace(/^[\s,.-]+|[\s,.-]+$/g, '')
      .trim();
  }

  /**
   * Separa dirección geocodificada de la referencia que dijo el cliente.
   * Ej. "Calle 10, Bogotá (nuevo sol)" → query + hint "nuevo sol".
   */
  private splitAddressCustomerHint(address: string): { geocodeQuery: string; customerHint: string } {
    const trimmed = (address || '').trim();
    if (!trimmed) return { geocodeQuery: '', customerHint: '' };
    const paren = trimmed.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    if (paren?.[1] && paren[2]) {
      return { geocodeQuery: paren[1].trim(), customerHint: paren[2].trim() };
    }
    return { geocodeQuery: trimmed, customerHint: trimmed };
  }

  /**
   * Guarda la dirección del cliente como principal cuando trae calle/número claros.
   * Google solo ayuda como referencia (evita reemplazar "Calle 6d #79a-76" por otra calle).
   */
  private mergeGeocodedAddressWithCustomerHint(geocoded: string, customerHint: string): string {
    const geo = (geocoded || '').trim();
    const hint = (customerHint || '').trim();
    if (!geo) return hint;
    if (!hint) return geo;

    const norm = (s: string) =>
      s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    const ng = norm(geo);
    const nh = norm(hint);
    if (ng === nh || ng.includes(nh)) return geo;
    // "ref. mapa: Cl. 51… (mapa: Cl. 51…)" — el geo ya está en el texto
    if (/\bmapa\s*:/i.test(hint) && nh.includes(ng)) return hint;

    const existingParen = geo.match(/\(([^)]+)\)\s*$/);
    if (existingParen?.[1] && norm(existingParen[1]) === nh) return geo;

    // Cliente dio dirección explícita → no pisar con formatted_address de Google
    if (this.isStrongExplicitAddress(hint) || this.looksLikeAddress(hint)) {
      // Conjuntos / plazuelas / torres: lo que escribió el cliente es lo útil para el domiciliario
      if (
        /\b(plazuelas?|conjunto|residencial|torres?|urbanizaci[oó]n|edificio|balcones|parques\s+de)\b/i.test(
          hint,
        )
      ) {
        return hint.slice(0, 240);
      }
      // Google a veces devuelve basura ("#6d40 #6d- a") — no ensuciar el pedido
      if (/#\S+\s+#/.test(geo) || /\b\d+[a-z]?-\s*[a-z]?\b/i.test(geo)) {
        return hint.slice(0, 240);
      }
      if (this.streetsClearlyDisagree(nh, ng)) {
        return `${hint} (ref. mapa: ${geo})`.slice(0, 240);
      }
      if (ng.includes(nh) || nh.includes(ng.slice(0, Math.min(24, ng.length)))) {
        return `${hint} (mapa: ${geo})`.slice(0, 240);
      }
      // Calle distinta (6d vs 7a): priorizar lo que escribió el cliente
      return `${hint} (ref. mapa: ${geo})`.slice(0, 240);
    }

    return `${geo} (${hint.slice(0, 120)})`;
  }

  /** Detecta si Google devolvió otra vía (ej. Cl. 7a Bis vs Calle 6d). */
  private streetsClearlyDisagree(customerNorm: string, geoNorm: string): boolean {
    const extract = (s: string): { kind: string; num: string } | null => {
      const m = s.match(
        /\b(calle|cll?\.?|carrera|cra\.?|kr\.?|av(?:enida|\.)?|diag(?:onal)?\.?|transversal|tv\.?)\s*([0-9]+[a-z]?)\b/i,
      );
      if (!m?.[1] || !m[2]) return null;
      const raw = m[1].toLowerCase().replace(/\./g, '');
      const kind = /^(carrera|cra|kr)$/.test(raw)
        ? 'carrera'
        : /^(calle|cl|cll)$/.test(raw)
          ? 'calle'
          : /^(av|avenida)$/.test(raw)
            ? 'avenida'
            : raw;
      return { kind, num: m[2].toLowerCase() };
    };
    const a = extract(customerNorm);
    const b = extract(geoNorm);
    if (!a || !b) return false;
    if (a.kind !== b.kind) return true;
    // "6d" vs "7a" / "6" vs "6d" con bis distinto
    const base = (n: string) => n.replace(/[a-z]+$/i, '');
    if (a.num !== b.num && base(a.num) !== base(b.num)) return true;
    if (a.num !== b.num && (base(a.num) === base(b.num) || a.num.startsWith(base(b.num)) || b.num.startsWith(base(a.num)))) {
      // Misma vía base pero sufijo distinto (6 vs 6d) → aún preferir cliente
      return a.num !== b.num;
    }
    return false;
  }

  private isPlausibleDeliveryAddress(text: string): boolean {
    const t = text.trim();
    if (!t || t.length < 3) return false;
    if (this.isConfirmKeyword(t) || this.isGreetingKeyword(t)) return false;
    if (isNothingElseOrderIntent(t) || isFinishCheckoutIntent(t)) return false;
    if (this.isPickupIntent(t)) return false;
    if (isConfirmCurrentAddressIntent(t)) return false;
    if (/^(contraentrega|efectivo|mercado\s*pago|humano)$/i.test(t)) return false;
    if (isDeliveryLogisticsFluff(t)) return false;
    if (this.looksLikeFoodNotAddress(t)) return false;
    // Tras normalizar "A esta dirección plis" → "A esta plis": basura
    if (
      /^(?:a\s+)?(?:esta|esa|la\s+misma)\s+(?:plis|porfa|por\s+favor)?$/i.test(t) ||
      /^(?:esta|esa)\s+plis$/i.test(t)
    ) {
      return false;
    }
    if (/\b(minutos?|mins?|horas?)\b/i.test(t) && !/\b(habitaci[oó]n|apto|apartamento|calle|carrera|barrio|torre|conjunto|hospital)\b/i.test(t)) {
      return false;
    }

    if (
      /\b(habitaci[oó]n|apto?|apartamento|cuarto|suite|oficina|hostal|hotel|residencia)\b/i.test(t) &&
      /\d/.test(t)
    ) {
      return true;
    }
    if (/\b(la casa|mi casa|mi direccion|mi dirección)\b/i.test(t)) {
      return true;
    }
    // "domicilio" solo cuenta si hay lugar concreto (no "pedir un domicilio porfa")
    if (
      /\bdomicilios?\b/i.test(t) &&
      (PPP_ZONE_LANDMARK_RE.test(t) ||
        /\b(calle|carrera|cra|apto|apartamento|torre|conjunto|hospital|barrio|terrazas)\b/i.test(t) ||
        /\d/.test(t))
    ) {
      return true;
    }
    if (this.looksLikeAddress(t)) return true;
    if (this.looksLikeExplicitLandmarkKeyword(t)) return true;

    return t.length >= 6 && /\d/.test(t);
  }

  /** Landmarks/barrios conocidos — sin aceptar frases genéricas sueltas. */
  private looksLikeExplicitLandmarkKeyword(text: string): boolean {
    return (
      looksLikeAddressOnlyMessage(text) ||
      PPP_ZONE_LANDMARK_RE.test(text) ||
      /\b(kennedy|bosa|fontib[oó]n|engativ[aá]|suba|usaqu[eé]n|chapinero|soacha|mosquera)\b/i.test(
        text,
      )
    );
  }

  /**
   * Referencias sueltas: hospital, conjunto, "Nuevo Sol", "Tierras del Sol", etc.
   * (sin exigir calle/#).
   */
  private looksLikeLandmarkOrComplexName(
    text: string,
    opts?: { allowGenericPhrase?: boolean },
  ): boolean {
    const t = text.trim();
    if (t.length < 4 || t.length > 90) return false;
    if (looksLikeClearCartMessage(t) || looksLikeNonAddressCommand(t)) return false;
    if (this.looksLikeFoodNotAddress(t)) return false;
    if (this.looksLikeDeliveryAccessReference(t)) return false;
    if (
      this.catalogService.isMenuExploreIntent(t, []) ||
      this.catalogService.isCategoryBrowseQuestion(t)
    ) {
      return false;
    }
    if (this.looksLikeExplicitLandmarkKeyword(t)) return true;

    if (!opts?.allowGenericPhrase) return false;

    // "no solo eso" / "no era eso" no es un barrio (aunque sean 2–7 palabras)
    if (
      /^(no|nop|nel)\b/i.test(t) &&
      !/\d/.test(t) &&
      !/\b(calle|carrera|cra|cll|av|avenida|torre|apto|apartamento|conjunto|barrio|hospital)\b/i.test(
        t,
      )
    ) {
      return false;
    }

    // "solicitar un domicilio" ≠ conjunto / barrio
    if (
      /\bdomicilios?\b/i.test(t) &&
      !/\b(calle|carrera|cra|cll|av|avenida|torre|apto|apartamento|conjunto|barrio|hospital|cl[ií]nica|urbanizaci[oó]n)\b/i.test(
        t,
      ) &&
      !/\d/.test(t)
    ) {
      return false;
    }
    if (
      /\b(solicitar|pedir|hacer|tramitar)\b/i.test(t) &&
      !/\b(calle|carrera|torre|apto|apartamento|conjunto|barrio|hospital)\b/i.test(t) &&
      !/\d/.test(t)
    ) {
      return false;
    }

    // Preguntas (ETA, precio, menú) ≠ nombre de conjunto/barrio
    if (
      isDeliveryEtaInquiry(t) ||
      /\b(cuanto|cu[aá]nto|demora|tarda|tardaria|tiempo|minutos?|llega|llegaria|masomenos|mas\s+o\s+menos|aprox)\b/i.test(
        t,
      )
    ) {
      return false;
    }

    const words = t.split(/\s+/).filter(Boolean);
    const looksLikePlaceName = /\b(de|del)\b/i.test(t);
    if (
      looksLikePlaceName &&
      words.length >= 2 &&
      words.length <= 7 &&
      !/\d/.test(t) &&
      /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s.'°-]+$/.test(t) &&
      !/^(hola|buenas|buenos|gracias|listo|ok|dale|claro|menu|menú|carta|quiero|dame|ponme|que|qué|cuanto|cuánto|puedo|puedes|solicitar|pedir|asi|nada|eso|solo|solamente|masomenos)\b/i.test(
        t,
      ) &&
      !/\b(hay|tienen|tiene|tienes|ofrecen|ofreces|bebidas?|sopas?|pollos?|cambiar|ensalada|otra\s+cosa|guarnici[oó]n|nada\s+m[aá]s|nomas|eso\s+es\s+todo|demora|tarda|tiempo)\b/i.test(
        t,
      ) &&
      !isConfirmCurrentAddressIntent(t) &&
      !/\b(esta|esa|la\s+misma)\s+(direcci[oó]n|domicilio|ubicaci[oó]n)\b/i.test(t)
    ) {
      return true;
    }
    return false;
  }

  /** Dirección lo bastante clara para no pedir confirmación (calle/carrera + número, etc.). */
  private isStrongExplicitAddress(text: string): boolean {
    const t = this.normalizeDeliveryAddress(text);
    if (!t || this.looksLikeFoodNotAddress(t)) return false;
    if (
      /\b(calle|carrera|cra|cll|av\.?|avenida|diag(?:onal)?|transversal|tv)\b/i.test(t) &&
      /\d/.test(t)
    ) {
      return true;
    }
    if (
      /\b(habitaci[oó]n|apto?|apartamento|cuarto|suite|torre|bloque|conjunto)\b/i.test(t) &&
      /\d/.test(t) &&
      t.length >= 8
    ) {
      return true;
    }
    if (/\bbarrio\b/i.test(t) && /\d/.test(t) && t.length >= 12) return true;
    // Landmarks / conjuntos por nombre (hospital de kennedy, nuevo sol…)
    if (this.looksLikeLandmarkOrComplexName(t) && t.length >= 6) return true;
    return false;
  }

  /** Evita tomar "a la broaster / frito / plancha" / platos como dirección. */
  private looksLikeFoodNotAddress(text: string): boolean {
    const t = text.trim().toLowerCase();
    if (!t) return false;

    const hasStreetCue =
      /\b(calle|carrera|cra|cll|av|avenida|barrio|habitaci[oó]n|apto|apartamento|torre|#)\b/i.test(
        t,
      );

    // "Las mojarras fritas" / "pillos fritos" / plurales (FOOD_ORDER ya trae mojarras)
    if (FOOD_ORDER_SIGNAL_RE.test(t) && !hasStreetCue) {
      return true;
    }

    // Respuesta de estilo: "las fritas", "fritas", "asadas", "las mojarras fritas"
    if (
      /^(?:las?\s+|los?\s+|el\s+)?(?:mojarras?|truchas?|bagres?|pollos?|pillos?|costillas?|pechugas?)?\s*(?:broasters?|frit[oa]s?|asad[oa]s?|plancha|apanad[oa]s?|mixt[oa]s?)\s*$/i.test(
        t,
      )
    ) {
      return true;
    }

    if (
      /^(?:la\s+|el\s+|las\s+|los\s+)?(broaster|frito|frita|asado|asada|plancha|apanad[oa]|francesa|salada|yuca|arepa|gaseosa|combo|solo|medio|cuarto)s?\b/i.test(
        t,
      )
    ) {
      return true;
    }
    if (
      /\b(broasters?|frit[oa]s?|asad[oa]s?|plancha|gaseosas?|arepas?|combos?|mondongos?|ajiacos?|pechugas?|costillas?|pollos?|pillos?|arroz|sopas?|bandejas?|mojarras?|churrascos?|hamburguesas?|alitas?|ejecutivos?|sancochos?|limonadas?|bebidas?|ensaladas?|papas?|yuca|aguacate|maduro)\b/i.test(
        t,
      ) &&
      !hasStreetCue
    ) {
      return true;
    }
    // Cambio de guarnición ≠ dirección
    if (
      /\bcambiar\b/i.test(t) &&
      /\b(ensalada|papa|papas|yuca|arepa|aguacate|maduro|guarnici[oó]n|acompa[nñ]amiento)\b/i.test(t)
    ) {
      return true;
    }
    if (this.catalogService.looksLikeSideModificationNote(t)) return true;
    // "porción más pequeña" / "menos cantidad" / "taza chica" ≠ dirección
    if (
      /\b(porci[oó]n|porciones|cantidad|taza|gramos|personas)\b/i.test(t) &&
      /\b(peque[nñ]a|peque[nñ]as|chica|chicas|menos|m[aá]s\s+peque|allcanza|alcanza|rinde)\b/i.test(
        t,
      )
    ) {
      return true;
    }
    // "una pequeña(s) por favor" = tamaño de sopa, no barrio
    if (this.catalogService.isBareServingSizeReply(t)) return true;
    if (this.catalogService.isServingSizeChangeIntent(t)) return true;
    if (this.catalogService.isProductDescriptionInquiry(t)) return true;
    if (this.catalogService.isAvailabilityInquiry(t)) return true;
    if (isAddressRejectionIntent(t) || isAddressChangeIntent(t)) return true;
    // Pregunta de menú / categoría
    if (
      /\b(que|qué)\b/i.test(t) &&
      /\b(hay|tienen|tiene|tienes|ofrecen)\b/i.test(t)
    ) {
      return true;
    }
    return false;
  }

  private extractDeliveryTail(text: string): string | null {
    // Normalizar typos de "para" antes de buscar domicilio
    const raw = (text || '')
      .trim()
      .replace(/\bpar\s+ale\b/gi, 'para el')
      .replace(/\bpar\s+a\s+la\b/gi, 'para la')
      .replace(/\bpar\s+a\s+el\b/gi, 'para el')
      .replace(/\bpar\s+el\b/gi, 'para el')
      .replace(/\bpar\s+la\b/gi, 'para la')
      .replace(/\bpala\s+el\b/gi, 'para el')
      .replace(/\bpala\s+la\b/gi, 'para la');
    if (!raw) return null;

    // Mensaje completo ya es dirección (conjunto + torre/apto) → no cortar a "apto 112"
    if (
      looksLikeAddressOnlyMessage(raw) ||
      (PPP_ZONE_LANDMARK_RE.test(raw) &&
        /\b(torre|apto|apartamento|int\.?|interior|bloque)\b/i.test(raw))
    ) {
      const full = this.normalizeDeliveryAddress(raw);
      if (full && !isDeliveryLogisticsFluff(full) && this.isPlausibleDeliveryAddress(full)) {
        return full;
      }
    }

    const candidates: string[] = [];

    // Cláusulas típicas al final (audio/Whisper): ", para hospital de kennedy"
    const endPatterns: RegExp[] = [
      /(?:^|[.,;:\n]\s*)\b(?:para|direcci[oó]n|domicilio)\s*[:\-]?\s+(.+)$/is,
      /\b(?:es\s+para|seria\s+para|ser[ií]a\s+para)\s+(.+)$/is,
      /\b(?:enviar|mandar|llevar|traer)\s+a\s+domicilio\s+(?:a|en|para)\s+(.+)$/is,
      /\b(?:enviar|mandar|llevar|traer|domicilio)\s+(?:a|en|para)\s+(.+)$/is,
      /\ben\b\s+(?:la\s+|el\s+)?((?:calle|carrera|cra|cll|av\.?|avenida|habitaci[oó]n|apto|apartamento|torre|barrio|hospital|conjunto|urbanizaci[oó]n)\b.+)$/is,
      /\ba la\b\s+(.+)$/is,
      /\ben la\b\s+(.+)$/is,
    ];
    for (const re of endPatterns) {
      const m = raw.match(re);
      if (m?.[1]) candidates.push(m[1]);
    }

    // Último "para …" del mensaje (evita tomar el primero si hay varios)
    const paraRe = /\bpara\b/gi;
    let lastParaIdx = -1;
    let pm: RegExpExecArray | null;
    while ((pm = paraRe.exec(raw)) !== null) lastParaIdx = pm.index;
    if (lastParaIdx >= 0) {
      const after = raw.slice(lastParaIdx).replace(/^\s*para\s+/i, '').trim();
      if (after) candidates.push(after);
    }

    const inlinePatterns = [
      /\b(?:para|a|en)\s+(?:la\s+|el\s+)?(habitaci[oó]n\s*(?:n[°o]?\.?\s*)?\d{1,4}[a-z]?)\b/i,
      /\b(?:para|a|en)\s+(?:la\s+|el\s+)?((?:apto?|apartamento|cuarto|suite|oficina)\s*(?:n[°o]?\.?\s*)?\d{1,4}[a-z]?)\b/i,
      /\b(?:para|a|en)\s+(?:la\s+|el\s+)?((?:calle|carrera|cra|cll|av\.?|avenida)\s+\d[\w\s#\-.]{2,40})\b/i,
      /\b(habitaci[oó]n\s*(?:n[°o]?\.?\s*)?\d{1,4}[a-z]?)\b/i,
      /\b(?:apto?|apartamento|cuarto|suite|oficina)\s*(?:n[°o]?\.?\s*)?\d{1,4}[a-z]?\b/i,
      /\b(?:torre|bloque|piso|interior|local)\s+[a-z0-9#\-\s]{1,24}\d{1,4}[a-z]?\b/i,
      // "Casa 11 terrazas de Castilla 3"
      /\b(casa\s*\d{1,4}[a-z]?(?:\s+[^\n,]{0,60})?(?:terrazas?|bosques?|castilla|tabaku|tintal)[^\n,]{0,40})/i,
    ];
    for (const pattern of inlinePatterns) {
      const m = raw.match(pattern);
      if (m?.[0]) candidates.push(stripTrailingAddressFluff(m[1] || m[0]));
    }

    // Preferir candidatos más largos / con landmark (evitar quedarse solo con "apto 112")
    candidates.sort((a, b) => b.trim().length - a.trim().length);

    const orderLike =
      this.catalogService.looksLikeMultiItemOrderMessage(raw) ||
      this.catalogService.looksLikeFoodPlusDrinkOrder(raw) ||
      /\b(quiero|dame|pedi|pedir|medio|cuarto|gaseosa|pollo)\b/i.test(raw);

    for (const cand of candidates) {
      const addr = this.normalizeDeliveryAddress(cand);
      if (!addr || addr.length < 3) continue;
      if (this.isPickupOnlyDeliveryClause(addr)) continue;
      if (isDeliveryLogisticsFluff(addr)) continue;
      if (this.looksLikeFoodNotAddress(addr)) continue;
      // En pedido compuesto, aceptar landmarks / nombres sueltos aunque no tengan #
      if (orderLike) {
        if (
          this.isPlausibleDeliveryAddress(addr) ||
          this.looksLikeLandmarkOrComplexName(addr, { allowGenericPhrase: true }) ||
          (addr.length >= 4 &&
            !this.isConfirmKeyword(addr) &&
            !this.isGreetingKeyword(addr) &&
            !/^(llevar|recoger|el\s+local|all[ií]|allá|mi|me|yo)\b/i.test(addr))
        ) {
          return addr;
        }
        continue;
      }
      if (!this.isPlausibleDeliveryAddress(addr)) continue;
      return addr;
    }

    return null;
  }

  /** "para llevar / para el local" no es dirección. */
  private isPickupOnlyDeliveryClause(text: string): boolean {
    const t = text.trim().toLowerCase();
    if (isDeliveryLogisticsFluff(t)) return true;
    if (/^(llevar|recoger|el\s+local|el\s+restaurante|all[ií]|allá)\b/i.test(t)) return true;
    if (/^llevar\b.{0,20}$/i.test(t)) return true;
    return false;
  }

  /** Separa el pedido del domicilio para matching de producto (audios compuestos). */
  private splitProductAndDelivery(text: string): { productText: string; address: string | null } {
    const address = this.extractDeliveryTail(text);
    if (!address) return { productText: text.trim(), address: null };

    let productText = text.trim();
    const escaped = address.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    productText = productText
      .replace(
        new RegExp(
          `(?:^|[.,;:\\n]\\s*)(?:para|direcci[oó]n|domicilio)\\s*[:\\-]?\\s*${escaped}\\s*$`,
          'i',
        ),
        '',
      )
      .replace(new RegExp(`\\b(?:para|a|en)\\s+(?:la\\s+|el\\s+)?${escaped}\\s*$`, 'i'), '')
      .replace(new RegExp(`\\bpara\\b\\s+${escaped}\\s*$`, 'i'), '')
      .replace(/[.,;:\s]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Si el corte falló, quitar desde el último "para …dirección"
    if (productText === text.trim() || productText.length < 3) {
      const paraRe = /\bpara\b/gi;
      let lastParaIdx = -1;
      let pm: RegExpExecArray | null;
      while ((pm = paraRe.exec(text)) !== null) lastParaIdx = pm.index;
      if (lastParaIdx > 0) {
        const head = text.slice(0, lastParaIdx).replace(/[.,;:\s]+$/g, '').trim();
        if (head.length >= 3) productText = head;
      } else if (lastParaIdx === 0) {
        // Todo el mensaje es domicilio: "para el hospital de kennedy"
        productText = '';
      }
    }

    // No devolver el texto completo como "producto" si solo era la dirección
    if (!productText.trim() && address) {
      return { productText: '', address };
    }

    return { productText: productText || text.trim(), address };
  }

  /**
   * Un solo mensaje largo: "sopa de menudencias y medio broaster para la carrera 78,
   * me llamo Juan, cel [teléfono]".
   */
  private parseCompoundOrderMessage(text: string): {
    productText: string;
    address: string | null;
    phone: string | null;
    customerName: string | null;
    phoneUsesWhatsapp?: boolean;
  } {
    let working = (text || '').trim().replace(/\s*\n+\s*/g, ' ');
    let phone: string | null = null;
    let customerName: string | null = null;
    let phoneUsesWhatsapp = false;

    // Quitar cláusulas de pago para no contaminar matching / dirección
    working = working
      .replace(
        /\b(?:pago|pagar|pagarte|pagarle|transferir|cancelo|te\s+cancelo)\s+(?:por|con|x|en)\s+(?:nequi|daviplata|llave|efectivo|transferencia|contraentrega)\b/gi,
        ' ',
      )
      .replace(/\b(?:para\s+pagarte|para\s+pagar)\s+(?:por|con|en)\s+\w+\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const phoneRefPatterns = [
      /\b(?:mi\s+)?(?:cel(?:ular)?|tel\w*|whatsapp|wa|n[uú]mero)\s*(?:es|:)?\s*(?:este|el\s+de\s+(?:whatsapp|wa|aqu[ií])|este\s+n[uú]mero|el\s+mismo|el\s+que\s+(?:tengo|escribo|est[aá]\s+usando))\b/gi,
    ];
    for (const re of phoneRefPatterns) {
      if (!re.test(working)) continue;
      phoneUsesWhatsapp = true;
      working = working.replace(re, ' ').replace(/\s+/g, ' ').trim();
      break;
    }

    const phonePatterns = [
      /\b(?:cel(?:ular)?|tel(?:[eé]fono)?|whatsapp|wa|n[uú]mero)\s*(?:es|:)?\s*([+]?\d[\d\s().-]{6,16}\d)\b/i,
      /\b(?:al|llamar\s+al)\s*([+]?\d[\d\s().-]{6,16}\d)\b/i,
      /(?:^|[,\s])([3](?:\d[\s().-]*){9})(?=$|[,\s.])/i,
    ];
    for (const re of phonePatterns) {
      const m = working.match(re);
      if (!m?.[1] || !this.looksLikePhoneNumber(m[1])) continue;
      phone = this.normalizeContactPhone(m[1], '') || null;
      if (!phone) continue;
      working = working.replace(m[0], ' ').replace(/\s+/g, ' ').trim();
      break;
    }

    const namePatterns = [
      /\b(?:me\s+llamo|soy|mi\s+nombre\s+es|nombre\s*:)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s.'-]{1,60}?)(?=$|[.,;]|\b(?:para|cel|tel|whatsapp|direcci[oó]n|domicilio)\b)/i,
    ];
    for (const re of namePatterns) {
      const m = working.match(re);
      if (!m?.[1]) continue;
      const name = m[1].replace(/\s+/g, ' ').trim();
      if (
        name.length >= 2 &&
        name.split(' ').length <= 6 &&
        !this.looksLikeAddress(name) &&
        isUsableWhatsappCustomerName(name)
      ) {
        customerName = name;
        working = working.replace(m[0], ' ').replace(/\s+/g, ' ').trim();
        break;
      }
    }

    // "Natalia seria un arroz…" / nombre al inicio + intención de pedido
    // Ojo: "Necesito un domicilio" NO es nombre=Necesito (el lookahead `un` lo atrapaba).
    if (!customerName) {
      const leading = working.match(
        /^([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2,}(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2,}){0,2})\s+(?=ser[ií]a\b|quiero\b|dame\b|ponme\b|necesito\b|pido\b|un\b|una\b)/i,
      );
      if (leading?.[1]) {
        const candidate = leading[1].replace(/\s+/g, ' ').trim();
        const words = candidate.split(/\s+/);
        const last = words[words.length - 1]?.toLowerCase() || '';
        const firstNorm = words[0]
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        const intentVerb = new Set([
          'necesito',
          'quiero',
          'queria',
          'dame',
          'ponme',
          'pido',
          'pedi',
          'regalame',
          'regalas',
          'regala',
          'hola',
          'buenas',
          'buenos',
          'para',
          'hacer',
          'pedir',
          'ordenar',
          'voy',
          'vengo',
          'seria',
          'me',
        ]);
        // No capturar si el “nombre” es claramente comida / verbo de pedido
        // ("Para hacer un pedido" → Para hacer; "Necesito un domicilio" → Necesito)
        if (
          !intentVerb.has(firstNorm) &&
          !words.some((w) =>
            intentVerb.has(
              w
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, ''),
            ),
          ) &&
          isUsableWhatsappCustomerName(candidate) &&
          !/\b(pollo|arroz|sopa|bandeja|mojarra|bebida|gaseosa|combo|broaster|domicilio|pedido)\b/i.test(
            candidate,
          ) &&
          !/^(un|una|el|la|los|las)$/i.test(last) &&
          words.length <= 3
        ) {
          customerName = candidate;
          working = working.slice(leading[0].length).replace(/\s+/g, ' ').trim();
        }
      }
    }

    const { productText, address } = this.splitProductAndDelivery(working);
    if (address) {
      return { productText, address, phone, customerName, phoneUsesWhatsapp };
    }

    // Corpus: dirección al final sin "para" (calle/torre/Castilla…)
    const embedded = splitTrailingEmbeddedAddress(working);
    if (embedded) {
      return {
        productText: embedded.productText,
        address: embedded.address,
        phone,
        customerName,
        phoneUsesWhatsapp,
      };
    }

    return { productText, address: null, phone, customerName, phoneUsesWhatsapp };
  }

  private mergeNameScores(
    primary: Array<{ p: MenuProduct; score: number }>,
    secondary: Array<{ p: MenuProduct; score: number }>,
  ): Array<{ p: MenuProduct; score: number }> {
    const byId = new Map<number, { p: MenuProduct; score: number }>();
    for (const row of [...primary, ...secondary]) {
      const prev = byId.get(row.p.id);
      if (!prev || row.score > prev.score) byId.set(row.p.id, row);
    }
    return [...byId.values()].sort(
      (a, b) => b.score - a.score || b.p.name.length - a.p.name.length,
    );
  }

  private looksLikeAddress(text: string): boolean {
    const t = text.trim().toLowerCase();
    if (t.length < 6) return false;
    if (isDeliveryLogisticsFluff(text)) return false;
    if (this.isConfirmKeyword(t) || this.isGreetingKeyword(t)) return false;
    if (this.isPickupIntent(t)) return false;
    if (/^(contraentrega|efectivo|mercado\s*pago|humano)$/i.test(t)) return false;
    if (/^📍/.test(text.trim()) || /\b-?\d{1,2}\.\d+\s*,\s*-?\d{1,3}\.\d+\b/.test(t)) return true;
    if (
      /\b(habitaci[oó]n|apto?|apartamento|cuarto|suite|oficina|hostal|hotel|residencia)\b/i.test(t) &&
      /\d/.test(t)
    ) {
      return true;
    }
    if (
      /\b(calle|carrera|cra|cll|av\.?|avenida|diag|diagonal|transversal|barrio|conjunto|apto|apartamento|torre|casa|mz|manzana|#|hospital|cl[ií]nica|urbanizaci[oó]n)\b/i.test(
        t,
      )
    ) {
      return true;
    }
    if (this.looksLikeLandmarkOrComplexName(text, { allowGenericPhrase: true })) {
      return true;
    }
    return t.length >= 12 && /\d/.test(t) && !/\b(minutos?|mins?|horas?)\b/i.test(t);
  }

  /**
   * En awaiting_name: solo señales fuertes de dirección.
   * Evita tratar nombres de 2–7 palabras como “conjunto/barrio”.
   */
  private looksLikeAddressRejectingPersonName(text: string): boolean {
    const t = text.trim().toLowerCase();
    if (t.length < 6) return false;
    if (isDeliveryLogisticsFluff(text)) return false;
    if (this.isConfirmKeyword(t) || this.isGreetingKeyword(t)) return false;
    if (/^📍/.test(text.trim()) || /\b-?\d{1,2}\.\d+\s*,\s*-?\d{1,3}\.\d+\b/.test(t)) {
      return true;
    }
    if (
      /\b(habitaci[oó]n|apto?|apartamento|cuarto|suite|oficina|hostal|hotel|residencia)\b/i.test(
        t,
      ) &&
      /\d/.test(t)
    ) {
      return true;
    }
    if (
      /\b(calle|carrera|cra|cll|av\.?|avenida|diag|diagonal|transversal|barrio|conjunto|apto|apartamento|torre|casa|mz|manzana|#|hospital|cl[ií]nica|urbanizaci[oó]n)\b/i.test(
        t,
      )
    ) {
      return true;
    }
    if (this.looksLikeExplicitLandmarkKeyword(text)) return true;
    return t.length >= 12 && /\d/.test(t) && !/\b(minutos?|mins?|horas?)\b/i.test(t);
  }

  private formatLocationAddress(msg: IncomingWhatsappMessage): string | null {
    const parts: string[] = [];
    if (msg.locationName) parts.push(msg.locationName);
    if (msg.locationAddress) parts.push(msg.locationAddress);
    if (msg.latitude != null && msg.longitude != null) {
      parts.push(`📍 ${msg.latitude}, ${msg.longitude}`);
      parts.push(`https://maps.google.com/?q=${msg.latitude},${msg.longitude}`);
    }
    const out = parts.filter(Boolean).join(' — ');
    return out.trim() || null;
  }

  private formatDeliverySetupEmptyCartReply(): string {
    return `Pedido a *domicilio* ✅ ¿Qué se te antoja? Escribe el *plato* o el *código*.`;
  }

  private buildAskNotesMessage(
    cfg: Awaited<ReturnType<WhatsappSettingsService['getEffectiveConfig']>>,
    session?: WhatsappSessionData,
  ): string {
    const hint = (cfg.localContext?.cashChangeNote || '').trim();
    const existing = session?.customerNotes?.trim();
    let msg = existing
      ? `Nota: _${existing}_\n¿Algo más? Si no, escribe *ninguno*.`
      : `¿Alguna *nota*? Si no, escribe *ninguno*.`;
    if (hint) msg += `\n_${hint}_`;
    return msg;
  }

  /** Mensaje suelto que parece nota de cocina/domicilio, no un producto nuevo. */
  private looksLikeStandaloneOrderNote(text: string): boolean {
    const t = text.trim();
    const lower = t.toLowerCase();
    if (t.length < 4 || t.length > 280) return false;

    // "no quiero X, quiero Y" es cambio de plato, no nota
    if (isCartItemReplacementIntent(t)) return false;

    // Dirección completa (Castellón + torre + apto) ≠ nota de cocina
    if (
      looksLikeAddressOnlyMessage(t) ||
      this.isAddressOnlyCustomerMessage(t) ||
      (PPP_ZONE_LANDMARK_RE.test(t) &&
        /\b(torre|apto|apartamento|int\.?|interior|bloque)\b/i.test(t))
    ) {
      return false;
    }

    // "Pon una nota en la sobrebarriga …" / "nota: …"
    if (looksLikeExplicitCartItemNote(t)) return true;

    if (this.catalogService.looksLikeExplicitAddProductRequest(t)) return false;

    // Guarnición sobre combo/plato ya en carrito: "para el combo no quiero arepas, quiero más papas"
    if (this.catalogService.looksLikeSideModificationNote(t)) return true;

    // Verbos de pedido nuevo (no aplica a "no quiero" / "quiero más papas" / nota explícita)
    if (
      /\b(dame|ponme|agrega|agregar|adicionar|adiciona|adicioname|pedir|ordenar|confirmar|men[uú]|c[oó]digo)\b/.test(
        lower,
      )
    ) {
      return false;
    }
    if (
      /\bquiero\b/.test(lower) &&
      !/\bno\s+quiero\b/.test(lower) &&
      !/\bquiero\s+(mas|más)\b/.test(lower)
    ) {
      return false;
    }
    const patterns = [
      /^(sin|no\s+quiero)\s+/i,
      /\b(platos?\s*y\s*cubiertos?|solo\s*cubiertos?|con\s*cubiertos?)\b/i,
      // Solo nota corta de entrega (“portería”, “timbre”), no dirección con torre+apto+conjunto
      /^(timbre|porter[ií]a|rejas?|intercomunicador)[\s!.]*$/i,
      /\b(port[oó]n|puerta|reja)\s+(verde|azul|rojo|roja|blanco|blanca|negro|negra|caf[eé]|amarillo|gris|grande)/i,
      /\bmitad\s+de\s+(?:la\s+)?cuadra\b/i,
      /\b(cambio\s+de|billete|paga\s+con|vueltas?|devuelta|traer?\s+vueltas?|trae\s+vueltas?|traeme\s+vueltas?)\b/i,
      /\bsin\s+(cebolla|aj[ií]|sal|picante|huevo|queso|tomate|arepa|papas?|yuca)\b/i,
      /\b(mas|más)\s+(papas?|yuca|arepa|ensalada)\b/i,
      /^(nota|notas?)[:\s]/i,
    ];
    return patterns.some((p) => p.test(t));
  }

  /** Extrae texto limpio de nota + pista del plato (“en la sobrebarriga”). */
  private extractCartItemNotePayload(text: string): {
    note: string;
    productHint: string | null;
  } | null {
    const t = text.trim();
    if (!t) return null;

    const quoted = t.match(/["“«]([^"”»]{2,160})["”»]/);
    if (quoted?.[1]?.trim()) {
      const before = t
        .slice(0, quoted.index ?? 0)
        .replace(
          /\b(pon(?:me|le)?|agrega(?:r|me|le)?|a[nñ]ade|deja|escribe)\s+(?:una?\s+)?notas?\s*/i,
          '',
        )
        .replace(/^(en|para|de|a)\s+/i, '')
        .replace(/^(la|el|las|los|este|esta|esa|ese)\s+/i, '')
        .replace(/[:\-–—]+\s*$/g, '')
        .trim();
      return {
        note: quoted[1].trim(),
        productHint: before.length >= 3 && before.length <= 48 ? before : null,
      };
    }

    const labeled = t.match(
      /\bnotas?\s+(?:en|para|de|a)\s+(?:la|el|las|los)?\s*([a-záéíóúñüA-ZÁÉÍÓÚÑÜ\s]{3,40}?)\s*[:\-–—]\s*(.+)$/i,
    );
    if (labeled?.[2]?.trim()) {
      return {
        note: labeled[2].trim().replace(/^["“«]|["”»]$/g, ''),
        productHint: labeled[1].trim(),
      };
    }

    const colon = t.match(
      /^(?:pon(?:me|le)?|agrega(?:r|me|le)?|a[nñ]ade|deja|escribe)\s+(?:una?\s+)?notas?\s*[:\-–—]\s*(.+)$/i,
    );
    if (colon?.[1]?.trim()) {
      return { note: colon[1].trim().replace(/^["“«]|["”»]$/g, ''), productHint: null };
    }

    if (/^(nota|notas?)[:\s]/i.test(t)) {
      const rest = t.replace(/^(nota|notas?)[:\s]+/i, '').trim();
      if (rest.length >= 2) return { note: rest.slice(0, 200), productHint: null };
    }

    return null;
  }

  private resolveCartNoteTargetIndex(
    session: WhatsappSessionData,
    text: string,
    productHint?: string | null,
  ): number {
    if (!session.cart.length) return -1;
    const q = `${productHint || ''} ${text}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    let best = session.cart.length - 1;
    let bestScore = 0;
    for (let i = 0; i < session.cart.length; i++) {
      const name = (session.cart[i].name || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!name) continue;
      if (q.includes(name) && name.length > bestScore) {
        best = i;
        bestScore = name.length + 20;
        continue;
      }
      const tokens = name.split(/\s+/).filter((tok) => tok.length >= 4);
      const hits = tokens.filter((tok) => q.includes(tok)).length;
      const score = hits * 12 + (hits ? tokens[0].length : 0);
      if (score > bestScore) {
        best = i;
        bestScore = score;
      }
    }
    return best;
  }

  /** Nota suelta en mitad del pedido (sin marcar notesCollected). */
  private applyInlineOrderNote(
    session: WhatsappSessionData,
    text: string,
  ): { session: WhatsappSessionData; notedItemIndex: number | null } {
    const t = text.trim();
    const change = this.extractCashChangeFromText(t);
    let next = { ...session };
    let notedItemIndex: number | null = null;
    if (change) {
      next.cashChangeFor = change;
    }

    const explicit = looksLikeExplicitCartItemNote(t)
      ? this.extractCartItemNotePayload(t)
      : null;

    const rest = this.stripCashChangePhrases(t);
    const noteText =
      explicit?.note ||
      this.catalogService.extractProductModificationNote(rest || t) ||
      (rest && !/^(ninguno|ninguna|no|nada)$/i.test(rest) && !looksLikeExplicitCartItemNote(t)
        ? rest
        : null) ||
      (!change && !looksLikeExplicitCartItemNote(t) ? t : null);

    if (noteText?.trim()) {
      const cleaned = noteText.trim().slice(0, 200);
      if (next.cart.length) {
        const cart = [...next.cart];
        const idx = this.resolveCartNoteTargetIndex(next, t, explicit?.productHint);
        const targetIdx = idx >= 0 ? idx : cart.length - 1;
        const item = { ...cart[targetIdx] };
        const existing = item.note?.trim();
        const norm = cleaned.toLowerCase();
        const parts = existing
          ? existing.split(/;\s*/).map((p) => p.trim()).filter(Boolean)
          : [];
        if (!parts.some((p) => p.toLowerCase() === norm)) {
          const noteQty = this.extractPartialCartNoteQuantity(t, item.quantity || 1);
          const lineQty = Math.max(1, item.quantity || 1);
          // "Una de las mojarras…" → separar 1 unidad con la nota del resto
          if (noteQty > 0 && noteQty < lineQty && !existing) {
            cart[targetIdx] = { ...item, quantity: lineQty - noteQty };
            cart.push({
              ...item,
              quantity: noteQty,
              note: cleaned,
            });
            notedItemIndex = cart.length - 1;
            next = { ...next, cart };
          } else {
            item.note = existing ? `${existing}; ${cleaned}`.slice(0, 200) : cleaned;
            cart[targetIdx] = item;
            next = { ...next, cart };
            notedItemIndex = targetIdx;
          }
        }
      }
      next = this.appendCustomerNote(next, cleaned);
    }
    return { session: next, notedItemIndex };
  }

  /**
   * "Una de las mojarras…" / "solo una" → cuántas unidades llevan la nota.
   * 0 = aplicar a toda la línea.
   */
  private extractPartialCartNoteQuantity(text: string, maxQty: number): number {
    const q = (text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!q || maxQty <= 1) return 0;

    const unaDe =
      /\b(una?|1)\s+de\s+(las?\s+|los?\s+|ellas?\s+|ellos?\s+)?/.test(q) ||
      /\bsolo\s+(una?|1)\b/.test(q) ||
      /\b(una?\s+sola)\b/.test(q);
    if (unaDe) return 1;

    const m = q.match(/\b(\d{1,2})\s+de\s+(las?\s+|los?\s+)?/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= 1 && n < maxQty) return n;
    }
    return 0;
  }

  private readonly CASH_CHANGE_AMOUNT = String.raw`[\d.,]+(?:\s*(?:mil|k))?`;

  /** Detecta cambio / vueltas en lenguaje colombiano. */
  private extractCashChangeFromText(text: string): string | null {
    const t = text.trim();
    const patterns = [
      new RegExp(
        String.raw`(?:traer|trae|traeme|traiga|con)\s+vueltas?\s*(?:de\s*)?\$?\s*(${this.CASH_CHANGE_AMOUNT})`,
        'i',
      ),
      new RegExp(String.raw`(?:vueltas?|devuelta)\s*(?:de\s*)?\$?\s*(${this.CASH_CHANGE_AMOUNT})`, 'i'),
      new RegExp(
        String.raw`(?:cambio|billete|paga(?:s|r)?(?:\s+con)?)\s*(?:de\s*)?\$?\s*(${this.CASH_CHANGE_AMOUNT})`,
        'i',
      ),
    ];
    for (const re of patterns) {
      const m = t.match(re);
      if (m?.[0]) {
        return m[0].replace(/\s+/g, ' ').trim().slice(0, 120);
      }
    }
    if (/^\d[\d.,\s]*(mil|k)?$/i.test(t)) {
      return `cambio de ${t}`;
    }
    return null;
  }

  private stripCashChangePhrases(text: string): string {
    return text
      .replace(
        new RegExp(
          String.raw`(?:traer|trae|traeme|traiga|con)\s+vueltas?\s*(?:de\s*)?\$?\s*${this.CASH_CHANGE_AMOUNT}`,
          'gi',
        ),
        '',
      )
      .replace(
        new RegExp(String.raw`(?:vueltas?|devuelta)\s*(?:de\s*)?\$?\s*${this.CASH_CHANGE_AMOUNT}`, 'gi'),
        '',
      )
      .replace(
        new RegExp(
          String.raw`(?:cambio|billete|paga(?:s|r)?(?:\s+con)?)\s*(?:de\s*)?\$?\s*${this.CASH_CHANGE_AMOUNT}`,
          'gi',
        ),
        '',
      )
      .replace(/\s+(por favor|porfa|pf|gracias)[\s!.?]*$/gi, '')
      .replace(/^[,.\s\-–—]+|[,.\s\-–—]+$/g, '')
      .trim();
  }

  private formatInlineNoteAck(
    session: WhatsappSessionData,
    notedItemIndex?: number | null,
  ): string {
    const parts: string[] = [];
    if (session.cashChangeFor?.trim()) {
      parts.push(`Anotado 💵 _${session.cashChangeFor.trim()}_`);
    }
    const idx =
      notedItemIndex != null && notedItemIndex >= 0
        ? notedItemIndex
        : session.cart.length - 1;
    const notedItem = idx >= 0 ? session.cart[idx] : undefined;
    const lastNote = notedItem?.note?.trim();
    if (lastNote && notedItem) {
      parts.push(`En *${notedItem.name}*: 📝 _${lastNote}_`);
    } else if (session.customerNotes?.trim()) {
      parts.push(`Anotado 📝 _${session.customerNotes.trim()}_`);
    }
    return parts.join('\n') || 'Anotado ✅';
  }

  private appendCustomerNote(session: WhatsappSessionData, note: string): WhatsappSessionData {
    const trimmed = note.trim().slice(0, 400);
    if (!trimmed) return session;
    const existing = session.customerNotes?.trim();
    const combined = existing ? `${existing}; ${trimmed}`.slice(0, 400) : trimmed;
    return { ...session, customerNotes: combined };
  }

  private applyNotesFromText(session: WhatsappSessionData, text: string): WhatsappSessionData {
    const t = text.trim();
    const lower = t.toLowerCase();
    const next = { ...session, notesCollected: true as const };
    if (/^(ninguno|ninguna|no|nada|sin notas?|n\/a|na)$/i.test(lower)) {
      return next;
    }
    const change = this.extractCashChangeFromText(t);
    if (change) {
      next.cashChangeFor = change;
    } else if (
      /^\d[\d.,\s]*(mil|k)?$/i.test(t) &&
      (session.paymentMethod === 'cash' || session.paymentMethod === 'contraentrega')
    ) {
      next.cashChangeFor = `cambio de ${t}`;
    }
    const notesOnly = this.stripCashChangePhrases(t);
    if (notesOnly && !/^(ninguno|ninguna|no|nada)$/i.test(notesOnly)) {
      next.customerNotes = notesOnly.slice(0, 400);
    } else if (!next.cashChangeFor) {
      next.customerNotes = t.slice(0, 400);
    }
    return next;
  }

  private looksLikePayment(text: string, methods: WhatsappPaymentMethodConfig[]): boolean {
    return !!findPaymentMethodByText(text, methods);
  }

  private looksLikePaymentMethodQuestion(text: string): boolean {
    const raw = (text || '').trim();
    if (!raw) return false;
    if (/\?/.test(raw)) return true;
    const t = this.normalizeForMatch(raw);
    return (
      /\b(cual|que|que es|que significa|explicame|explica|info|informacion)\b/.test(t) &&
      /\b(metodo|opcion|pago|pagar)\b/.test(t)
    );
  }

  /** “¿Cuál es el método 4?” → explicar, no seleccionar. */
  private async tryExplainPaymentMethodOption(
    conv: WhatsappConversation,
    waId: string,
    text: string,
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    if (!this.looksLikePaymentMethodQuestion(text)) return false;
    const enabled = getEnabledPaymentMethods(cfg.paymentMethods || []);
    if (!enabled.length) return false;

    const m = text.match(
      /\b(?:m[eé]todo|opci[oó]n)\s*(?:n[uú]mero\s*)?([1-9]\d?)\b|\b([1-9]\d?)\s*(?:\?|$)/i,
    );
    const n = m ? parseInt(m[1] || m[2], 10) : NaN;
    if (n >= 1 && n <= enabled.length) {
      const method = enabled[n - 1];
      await this.reply(
        conv,
        waId,
        `El *método ${n}* es: ${method.optionText || `*${method.label}*`}` +
          (method.confirmReply?.trim()
            ? `\n\n_${method.confirmReply.trim().slice(0, 280)}_`
            : '') +
          `\n\n¿Pagamos así o prefieres otro?\n` +
          buildPaymentOptionsPrompt(cfg.paymentMethods, cfg.paymentInstructions),
      );
      return true;
    }

    await this.reply(
      conv,
      waId,
      buildPaymentOptionsPrompt(cfg.paymentMethods, cfg.paymentInstructions),
    );
    return true;
  }

  private resolvePaymentChoice(
    text: string,
    cfg: EffectiveWhatsappConfig,
  ): WhatsappPaymentMethodConfig | null {
    if (this.looksLikePaymentMethodQuestion(text)) return null;
    const enabled = getEnabledPaymentMethods(cfg.paymentMethods || []);
    const trimmed = text.trim();
    // Número de opción: "1", "2", "3"
    if (/^[1-9]\d{0,1}$/.test(trimmed)) {
      const n = parseInt(trimmed, 10);
      if (n >= 1 && n <= enabled.length) return enabled[n - 1];
    }
    return findPaymentMethodByText(text, cfg.paymentMethods || []);
  }

  private buildPaymentConfirmReply(
    method: WhatsappPaymentMethodConfig,
    cfg: EffectiveWhatsappConfig,
  ): string | null {
    const tpl = (method.confirmReply || '').trim();
    if (!tpl) return null;
    return applyPaymentReplyTemplate(tpl, {
      label: method.label,
      brand: cfg.brandName || '',
      transferInfo:
        (cfg.localContext?.transferInfoNote || '').trim() ||
        'Te pasamos los datos de cuenta en el local / por aquí.',
      paymentInstructions: (cfg.paymentInstructions || '').trim(),
    });
  }

  private buildWelcomeMessage(
    cfg: Awaited<ReturnType<WhatsappSettingsService['getEffectiveConfig']>>,
  ): string {
    const w = (cfg.welcomeMessage || '').trim();
    if (!w) {
      return `¡Hola! 👋 *${cfg.brandName}*. ¿Qué se te antoja?\nMenú: ${cfg.menuUrl}`;
    }
    if (w.includes(cfg.menuUrl) || /\bmenu\b|\bmenú\b/i.test(w)) return w;
    return `${w}\nMenú: ${cfg.menuUrl}`;
  }

  private buildAiDisclaimerMessage(
    cfg: Awaited<ReturnType<WhatsappSettingsService['getEffectiveConfig']>>,
  ): string {
    return scrubAiDisclaimerCopy(cfg.aiDisclaimerMessage || '');
  }

  private async replyFirstContactWelcome(
    conv: WhatsappConversation,
    waId: string,
    cfg: EffectiveWhatsappConfig,
  ): Promise<void> {
    // Un solo mensaje: aviso corto + bienvenida (menos ruido en el chat)
    await this.reply(
      conv,
      waId,
      `${this.buildAiDisclaimerMessage(cfg)}\n\n${this.buildWelcomeMessage(cfg)}`,
    );
  }

  private formatOrderSuccessMessage(
    conv: WhatsappConversation,
    session: WhatsappSessionData,
    order: { orderId?: number; dailyOrderNumber?: number },
    deliveryFee: number,
    thanksMessage?: string,
    paymentMethods: WhatsappPaymentMethodConfig[] = [],
  ): string {
    const subtotal = session.cart.reduce(
      (s, c) => s + c.unitPrice * Math.max(1, c.quantity || 1),
      0,
    );
    const fee = session.orderType === 'delivery' ? deliveryFee : 0;
    const total = subtotal + fee;
    const now = new Date().toLocaleString('es-CO', {
      timeZone: 'America/Bogota',
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    const numRaw =
      order.dailyOrderNumber != null && Number(order.dailyOrderNumber) > 0
        ? Number(order.dailyOrderNumber)
        : null;
    // Nunca mostrar el id interno (p.ej. 54487) como # de orden al cliente
    const num =
      numRaw != null
        ? String(numRaw).padStart(2, '0')
        : '—';
    const cart = this.consolidateCart(session.cart);
    const items = cart
      .map((c, i) => {
        const qty = Math.max(1, c.quantity || 1);
        const attrs = c.attributes?.length
          ? `\n   _${c.attributes.map((a) => a.attributeValue).join(', ')}_`
          : '';
        return (
          `*${i + 1}.* *${c.name}*\n` +
          `   Cant: *${qty}*  ·  $${Math.round(c.unitPrice * qty).toLocaleString('es-CO')}` +
          attrs
        );
      })
      .join('\n\n');

    return (
      `✅ *¡Listo! Tu pedido quedó registrado*\n\n` +
      `🧾 Orden *#${num}*\n` +
      `🕐 ${now}\n\n` +
      `*Detalle:*\n${items}\n\n` +
      `Subtotal: $${Math.round(subtotal).toLocaleString('es-CO')}\n` +
      (fee ? `Domicilio: $${Math.round(fee).toLocaleString('es-CO')}\n` : '') +
      `*Total: $${Math.round(total).toLocaleString('es-CO')}*\n\n` +
      `🛵 ${session.orderType === 'pickup' ? 'Recoges en el local' : 'Domicilio'}\n` +
      `👤 ${this.displayCustomerName(conv)}\n` +
      `📍 ${session.address}\n` +
      `📞 ${this.formatWaPhoneDisplay(session.contactPhone || conv.phoneE164)}\n` +
      `💳 ${paymentMethodLabel(session.paymentMethod, paymentMethods)}\n\n` +
      this.resolveOrderThanksMessage(session, thanksMessage)
    );
  }

  /** Despedida: domicilio ≠ “te esperamos en el local”. */
  private resolveOrderThanksMessage(
    session: WhatsappSessionData,
    thanksMessage?: string,
  ): string {
    const custom = (thanksMessage || '').trim();
    const looksLikePickupDefault =
      !custom || /te esperamos/i.test(custom);

    if (session.orderType === 'delivery') {
      if (looksLikePickupDefault) {
        return 'Gracias por pedirnos 🍗 Te lo enviaremos lo más pronto posible.';
      }
      return custom;
    }

    return custom || 'Gracias por pedirnos, te esperamos 🍗';
  }

  private isMultiOrderAffirmative(text: string): boolean {
    return isCourtesyAffirmation(text);
  }

  private async handleProductWithVariants(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    product: MenuProduct,
    text: string,
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    if (!product.hasAttributes || !product.attributes?.length) return false;

    const variantIntent =
      this.catalogService.extractVariantPreferenceHint(text) ||
      (this.catalogService.productImpliesCombo(product) ? 'combo' : undefined);
    const swap = this.catalogService.swapIntent(text);
    const carriesSwap = !!swap && this.catalogService.productCarriesMention(product, swap.removed);
    const lineNote =
      carriesSwap && swap ? this.catalogService.swapChangeNote(swap.removed, swap.added) : undefined;
    const attrOpts = {
      ...(variantIntent ? { variantIntent } : {}),
      sourceText: text,
    };
    const stepRaw = this.catalogService.resolveAttributesFromMessage(product, text, [], attrOpts);
    // Arepas, sabor, presa: primera opción y al carrito. El estilo (frito/broaster) sí se pregunta.
    const prefilled =
      stepRaw.status === 'complete'
        ? stepRaw.attributes
        : this.catalogService.fillDefaultAttributes(
            product,
            stepRaw.status === 'partial' ? stepRaw.attributes : [],
            attrOpts,
          );
    const step = this.catalogService.isAttributeSelectionComplete(product, prefilled, attrOpts)
      ? { status: 'complete' as const, attributes: prefilled }
      : { status: 'partial' as const, attributes: prefilled };
    const deliveryHint = this.extractDeliveryTail(text);

    // Tras "complete", revalidar: combos suelen tener arepa + sabor gaseosa
    if (step.status === 'complete') {
      const stillNeed = this.catalogService.getRemainingAttributes(
        product,
        step.attributes,
        attrOpts,
      );
      if (stillNeed.length) {
        if (deliveryHint) {
          session = this.withDeliveryAddress(session, deliveryHint);
        }
        session = {
          ...session,
          pendingAttribute: {
            ...this.toPendingAttribute(product, {
              sourceText: text,
              variantIntent,
              selected: step.attributes,
            }),
          },
          pendingMatch: undefined,
        };
        await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
        await this.reply(
          conv,
          waId,
          this.catalogService.formatProductOptionsPrompt(product, step.attributes, attrOpts),
        );
        return true;
      }
      const fresh = await this.conversationService.reloadConversation(conv.id);
      Object.assign(conv, fresh);
      session = this.conversationService.getSession(conv);
      if (deliveryHint) {
        session = this.withDeliveryAddress(session, deliveryHint);
        const feeEarly = await this.ensureDeliveryFeeQuoted(session, cfg);
        session = feeEarly.session;
        if (feeEarly.blocked) {
          await this.conversationService.saveSession(conv, session);
          await this.reply(conv, waId, feeEarly.blocked);
          return true;
        }
      }
      const added = this.tryAddProductToCart(
        session,
        product,
        this.resolveAddQuantity(session, product, { sourceText: text }),
        cfg,
        lineNote,
        step.attributes,
        attrOpts,
      );
      if (added.missingAttributes) {
        session = this.buildPendingAttributeSession(session, product, added.missingAttributes, {
          sourceText: text,
          variantIntent,
        });
        await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
        await this.reply(
          conv,
          waId,
          this.catalogService.formatProductOptionsPrompt(
            product,
            added.missingAttributes,
            attrOpts,
          ),
        );
        return true;
      }
      if (added.blocked) {
        await this.conversationService.saveSession(conv, session);
        await this.handleCartLimitBlocked(conv, waId, added.blocked, cfg);
        return true;
      }
      session = { ...added.session, pendingAttribute: undefined };
      await this.conversationService.saveSession(conv, session, 'building_cart');
      const chosen = step.attributes.map((a) => a.attributeValue).join(', ');
      await this.reply(
        conv,
        waId,
        this.buildCartAddReply(
          session,
          this.deliveryFeeFor(session, cfg),
          `${product.name} (${chosen})`,
        ),
      );
      return true;
    }

    if (step.status === 'partial') {
      if (deliveryHint) {
        session = this.withDeliveryAddress(session, deliveryHint);
      }
      session = {
        ...session,
        pendingAttribute: {
          productId: product.id,
          name: product.name,
          code: product.code,
          price: product.price,
          attributes: product.attributes || [],
          selected: step.attributes,
          variantIntent,
        },
        pendingMatch: undefined,
      };
      await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
      await this.reply(
        conv,
        waId,
        this.catalogService.formatProductOptionsPrompt(product, step.attributes, attrOpts),
      );
      return true;
    }

    return false;
  }

  private async tryHandleMixtoCompositionInquiry(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    products: MenuProduct[],
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    if (!this.catalogService.isMixtoCompositionInquiry(text)) return false;

    session = {
      ...session,
      pendingAttribute: undefined,
      pendingMatch: undefined,
      pendingMultiOrder: undefined,
    };

    const mixtoHits = products.filter(
      (p) => p.availableNow !== false && /\bmixto\b/i.test(p.name),
    );
    let reply =
      'Sí 👍 El *mixto* es *medio broaster* y *medio frito* (mitad y mitad), no un solo 1/2 pollo.\n';
    if (mixtoHits.length === 1) {
      const p = mixtoHits[0];
      reply +=
        `\nEn el menú: *${p.name}* · Cód. ${this.catalogService.formatProductCode(p.code)} · ${this.catalogService.formatMoney(p.price)}\n` +
        `\n¿Te lo agrego? Escribe *sí*.`;
      session = this.rememberProductFocus(session, p, products);
      await this.savePendingAddOffer(conv, p, 1);
    } else if (mixtoHits.length > 1) {
      reply +=
        `\n\n${this.catalogService.formatProductChoicePrompt('mixto', mixtoHits, {
          intro: 'Estas son las opciones *mixtas* del menú:',
        })}`;
      session = {
        ...session,
        pendingMatch: { query: 'mixto', candidates: mixtoHits, intent: 'info' },
      };
    } else {
      reply +=
        `\nSi lo quieres pedir, escribe *mixto* o mira el menú: ${(cfg.menuUrl || '').trim() || '*menú*'}.`;
    }

    await this.conversationService.saveSession(conv, session, 'building_cart');
    await this.reply(conv, waId, reply);
    return true;
  }

  /**
   * Pedido de un solo plato que Nest puede agregar (no pregunta, no familia sin elegir).
   * Si el agente solo conversa, el flujo de carrito sigue.
   */
  /**
   * Un solo plato: “combo de pollo frito” no lleva también “1 pollo frito”.
   * En un pedido de varios platos distintos, cada uno se queda.
   */
  private dropLooserSameDishAdds(
    text: string,
    products: MenuProduct[],
    kept: { productId: number; quantity?: number; note?: string }[],
  ): void {
    if (this.catalogService.looksLikeClearlyMultiDishOrder(text)) return;
    const swap = this.catalogService.swapIntent(text);
    const dish = swap ? this.catalogService.dishTextBeforeSwap(text) : text;
    const host = this.catalogService.mostSpecificNamedProduct(dish, products);
    if (!host) return;
    let dropped = false;
    for (let i = kept.length - 1; i >= 0; i--) {
      const product = products.find((p) => p.id === kept[i].productId);
      if (!product || product.id === host.id) continue;
      if (this.catalogService.isLooserSameDish(product, host)) {
        kept.splice(i, 1);
        dropped = true;
      }
    }
    if (dropped && !kept.some((item) => item.productId === host.id)) {
      kept.unshift({ productId: host.id, quantity: 1 });
    }
  }

  /**
   * El agente propone; Nest no agrega un plato que la frase no nombró
   * ni lo que el cliente pidió cambiar por otra cosa.
   */
  private reconcileAgentAddsWithUtterance(
    text: string,
    products: MenuProduct[],
    actions?: {
      addItems?: {
        productId: number;
        quantity?: number;
        note?: string;
        attributes?: { attributeName: string; attributeValue: string }[];
      }[];
    },
  ): string[] {
    if (!actions) return [];
    const misses: string[] = [];
    const swap = this.catalogService.swapIntent(text);
    const kept = (actions.addItems || []).filter((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product) return false;
      if (
        swap &&
        this.catalogService.productIsSwapRemoval(product, swap.removed, swap.added)
      ) {
        return false;
      }
      if (!this.catalogService.productNameFitsUtterance(product, text)) return false;
      return true;
    });
    const ids = new Set(kept.map((item) => item.productId));
    const swapBlob = this.normalizeForMatch(`${swap?.removed || ''} ${swap?.added || ''}`);
    for (const seg of this.catalogService.splitMultiProductSegments(text)) {
      const spoken = this.catalogService.resolveSpokenDish(seg, products);
      const shortClause = seg.trim().split(/\s+/).length <= 6;
      const uncovered = spoken
        ? this.catalogService
            .leftoverFoodWords(seg, spoken)
            .filter((t) => !swapBlob.includes(this.normalizeForMatch(t)))
        : [];
      if (spoken && shortClause && uncovered.length) {
        misses.push(`No tenemos *${seg.trim()}* en la carta.`);
        continue;
      }
      if (!spoken) {
        if (
          shortClause &&
          !products.some((p) => this.catalogService.productNameFitsUtterance(p, seg))
        ) {
          misses.push(`No tenemos *${seg.trim()}* en la carta.`);
        }
        continue;
      }
      if (ids.has(spoken.id)) continue;
      if (swap && this.catalogService.productIsSwapRemoval(spoken, swap.removed, swap.added)) {
        continue;
      }
      const qty = Math.max(1, this.catalogService.extractQuantityFromSegment(seg));
      kept.push({ productId: spoken.id, quantity: qty });
      ids.add(spoken.id);
    }
    if (swap) {
      const dish = this.catalogService.dishTextBeforeSwap(text);
      const host = this.catalogService.mostSpecificNamedProduct(dish, products);
      if (host) {
        const generic = new Set(['pollo', 'carne', 'arroz', 'sopa', 'bebida', 'gaseosa']);
        const weight = (p: MenuProduct) =>
          this.normalizeForMatch(p.name)
            .split(/\s+/)
            .filter((t) => t.length >= 4 && !generic.has(t) && !/\d/.test(t)).length;
        const hostWeight = weight(host);
        for (let i = kept.length - 1; i >= 0; i--) {
          const product = products.find((p) => p.id === kept[i].productId);
          if (!product || product.id === host.id) continue;
          if (
            this.catalogService.productNameFitsUtterance(product, dish) &&
            weight(product) < hostWeight
          ) {
            kept.splice(i, 1);
          }
        }
        if (!kept.some((item) => item.productId === host.id)) {
          kept.unshift({ productId: host.id, quantity: 1 });
        }
      }
      if (host && this.catalogService.productCarriesMention(host, swap.removed)) {
        const note = this.catalogService.swapChangeNote(swap.removed, swap.added);
        const line = kept.find((item) => item.productId === host.id);
        if (line && !line.note) line.note = note;
        const extraIds = new Set(
          this.catalogService
            .productsForSwapAddition(swap.added, products)
            .filter((p) => p.id !== host.id)
            .map((p) => p.id),
        );
        for (let i = kept.length - 1; i >= 0; i--) {
          if (extraIds.has(kept[i].productId)) kept.splice(i, 1);
        }
      }
      if (host) ids.add(host.id);
    }
    this.dropLooserSameDishAdds(text, products, kept);
    const asCombos = this.catalogService.keepCombosWhenBothRequested(text, products, kept);
    kept.splice(0, kept.length, ...asCombos);
    actions.addItems = kept.length ? kept : undefined;
    return [...new Set(misses)];
  }

  /** Quita la gaseosa suelta cuando esa bebida ya es opción del combo nombrado. */
  private stripHostedDrinkAdds(
    text: string,
    products: MenuProduct[],
    actions?: { addItems?: { productId: number }[] },
  ): void {
    const hosted = this.catalogService.hostedMenuDrink(text, products);
    if (!hosted || !actions?.addItems?.length || this.catalogService.wantsSeparateDrink(text)) return;
    actions.addItems = actions.addItems.filter((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product || !this.catalogService.isLikelyDrinkProduct(product)) return true;
      return !this.catalogService.drinkTextMatchesAttribute(hosted.product, text);
    });
  }

  /**
   * Nest ya armó el pedido completo (sin dudas ni platos faltantes) y el agente
   * no agregó uno de esos platos. Una duda de Nest, o un nombre que no está,
   * no alcanza para tirar la respuesta del agente.
   */
  private agentDroppedResolvedDish(
    text: string,
    products: MenuProduct[],
    actions?: { addItems?: { productId: number }[] },
  ): boolean {
    const multi = this.catalogService.resolveMultiProductOrder(text, products);
    if (!multi) return false;
    if (multi.ambiguous.length > 0 || multi.unresolved.length > 0) return false;
    const added = new Set((actions?.addItems || []).map((a) => a.productId));
    const expected = [...multi.confident, ...multi.needsAttributes].filter(
      (c) => !this.catalogService.isLikelyDrinkProduct(c.product),
    );
    if (!expected.length) return false;
    return expected.some((c) => !added.has(c.product.id));
  }

  private nestWouldAddDirectDishOrder(text: string, products: MenuProduct[]): boolean {
    if (this.catalogService.isGenericProductInquiry(text)) return false;
    if (this.catalogService.isAvailabilityInquiry(text)) return false;
    if (this.catalogService.isProductDescriptionInquiry(text)) return false;
    if (this.catalogService.isPriceInquiryIntent(text)) return false;
    if (this.catalogService.isCategoryBrowseQuestion(text)) return false;
    if (this.catalogService.isDishStyleSubstitutionInquiry(text)) return false;
    if (this.catalogService.isMenuExploreIntent(text, products)) return false;
    if (this.catalogService.looksLikeMultiItemOrderMessage(text)) return false;
    if (this.catalogService.looksLikeClearlyMultiDishOrder(text)) return false;
    if (this.catalogService.looksLikeFoodPlusDrinkOrder(text)) return false;
    const query = this.catalogService.extractProductSearchQuery(text) || text;
    if (this.catalogService.uncoveredDishWords(query, products).length) return false;

    const embedded = this.catalogService.findProductEmbeddedInMessage(text, products);
    if (!embedded || this.catalogService.isLikelySideOnlyProduct(embedded)) return false;
    const family = this.catalogService.findProductVariantFamily(text, products, [embedded]);
    if (family && family.variants.length >= 2) {
      return !!this.catalogService.pickVariantFromFamilyText(text, family);
    }
    return true;
  }

  /**
   * Agent V1: entiende la frase. Nest solo ejecuta lo que la carta y el carrito permiten.
   * Un número o una sola opción no entra: eso ya lo resolvió el protocolo cerrado.
   */
  private async tryHandleAgentV1(params: {
    conv: WhatsappConversation;
    msg: IncomingWhatsappMessage;
    session: WhatsappSessionData;
    text: string;
    originalText: string;
    products: MenuProduct[];
    cfg: EffectiveWhatsappConfig;
    status: Awaited<ReturnType<BusinessService['getStatus']>>;
    businessOpenForBot: boolean;
    /** Primer inbound con contenido: pegar aviso IA a la única reply */
    prependFirstContactDisclaimer?: boolean;
    /**
     * Checkout (nombre, dirección, pago): el agente lee la frase y Nest solo
     * ejecuta la consulta de un pedido ya hecho. El resto lo sigue el paso abierto.
     */
    placedOrderOnly?: boolean;
  }): Promise<boolean> {
    const { conv, msg, text, originalText, products, cfg, status, businessOpenForBot } =
      params;
    let session = params.session;

    if (!params.placedOrderOnly) {
      if (conv.state !== 'building_cart' && conv.state !== 'awaiting_attribute') {
        return false;
      }
      // Un número o una sola opción se resolvió arriba. Una frase ("era el otro",
      // "no, yo quería eso") sí entra, aunque haya lista o atributo abierto.
      const choiceStillOpen = !!(
        session.pendingAttribute ||
        session.pendingMatch?.candidates?.length ||
        session.pendingMultiOrder ||
        session.pendingCartRemoval ||
        session.pendingCategoryBrowse?.categories?.length ||
        session.pendingAddOffer
      );
      if (choiceStillOpen && !this.looksLikeHumanIntentSentence(originalText || text)) {
        return false;
      }
      if (this.isConfirmKeyword(text) || this.isGreetingKeyword(text)) {
        return false;
      }
      if (isNothingElseOrderIntent(text) || isFinishCheckoutIntent(text)) {
        return false;
      }
      if (isDeclineMoreItemsIntent(text) && session.cart.length > 0) {
        return false;
      }
    }
    if ((text || '').trim().length < 2) {
      return false;
    }

    const started = Date.now();
    const recent = await this.conversationService.getRecentMessageTexts(conv.id, 14);
    const rulesBlock = buildWhatsappBusinessRulesBlock({
      brandName: cfg.brandName || cfg.localContext?.restaurantName || 'Pronto Pollo Portal',
      businessStatus: businessOpenForBot ? { ...status, isOpen: true } : status,
      deliveryFee: this.deliveryFeeFor(session, cfg),
      deliveryFeeTiersBlock: cfg.deliveryFeeTiersPrompt,
      allowMercadoPago: !!cfg.allowMercadoPago,
      menuProductCount: products.filter((p) => p.availableNow !== false).length,
      localContextBlock: cfg.localContextBlock,
      orderLimitsBlock: buildOrderLimitsPromptBlock(this.toCartLimitsConfig(cfg, session)),
      paymentMethods: cfg.paymentMethods,
    });

    const agent = await this.agentService.runTurn({
      userMessage: text,
      cart: session.cart.map((c) => ({
        productId: c.productId,
        name: c.name,
        quantity: c.quantity,
        note: c.note,
        attributes: c.attributes,
      })),
      sessionSummary: this.buildSessionSummary(
        conv,
        session,
        this.deliveryFeeFor(session, cfg),
        products,
      ),
      recentMessages: recent,
      businessRulesBlock: rulesBlock,
      brandName: cfg.brandName || cfg.localContext?.restaurantName || 'Pronto Pollo Portal',
      products,
      menuUrl: cfg.menuUrl,
      humanPhone: cfg.localContext?.publicPhone || WHATSAPP_HUMAN_CONTACT_PHONE,
      menuConceptGroups: cfg.menuConceptGroups,
    });

    if (agent.lookupPlacedOrder) {
      await this.replyOrderProgressOrAskNumber(conv, msg.waId, originalText || text, cfg, {
        forceNumber: agent.lookupPlacedOrder.orderNumber,
      });
      this.turnTelemetry.record({
        path: 'agent_v1',
        outcome: 'replied',
        waId: msg.waId,
        conversationId: conv.id,
        toolCalls: agent.toolCalls,
        latencyMs: Date.now() - started,
        userTextPreview: originalText || text,
      });
      return true;
    }

    const comesWith = this.catalogService.comesWithOffer(originalText || text, products);
    if (comesWith) {
      await this.reply(conv, msg.waId, comesWith.reply);
      this.turnTelemetry.record({
        path: 'agent_v1',
        outcome: 'replied',
        waId: msg.waId,
        conversationId: conv.id,
        toolCalls: agent.toolCalls,
        latencyMs: Date.now() - started,
        userTextPreview: originalText || text,
        warnings: ['comes_with'],
      });
      return true;
    }

    if (agent.lookupDeliveryTime) {
      await this.tryHandleDeliveryEtaInquiry(conv, msg.waId, session, originalText || text, text, cfg, {
        forceGeneric: true,
      });
      this.turnTelemetry.record({
        path: 'agent_v1',
        outcome: 'replied',
        waId: msg.waId,
        conversationId: conv.id,
        toolCalls: agent.toolCalls,
        latencyMs: Date.now() - started,
        userTextPreview: originalText || text,
      });
      return true;
    }

    if (params.placedOrderOnly) {
      const removed = await this.applyCheckoutCartCorrection(
        conv,
        msg.waId,
        session,
        originalText || text,
        products,
        cfg,
        agent.actions?.removeProductIds,
      );
      this.turnTelemetry.record({
        path: 'agent_v1',
        outcome: removed ? 'order_progress' : 'fallback_rules',
        waId: msg.waId,
        conversationId: conv.id,
        toolCalls: agent.toolCalls,
        latencyMs: Date.now() - started,
        userTextPreview: originalText || text,
        warnings: removed ? ['checkout_cart_correction'] : ['placed_order_only'],
      });
      return removed;
    }

    if (
      agent.error === 'no_openai_key' ||
      agent.error === 'openai_401' ||
      agent.error === 'empty_reply'
    ) {
      this.turnTelemetry.record({
        path: 'agent_v1',
        outcome: 'fallback_rules',
        waId: msg.waId,
        conversationId: conv.id,
        toolCalls: agent.toolCalls,
        latencyMs: Date.now() - started,
        userTextPreview: originalText || text,
        warnings: [agent.error],
      });
      return false;
    }

    const guarded = this.actionGuard.sanitize({
      actions: agent.actions,
      products,
      businessOpen: businessOpenForBot,
      allowMercadoPago: !!cfg.allowMercadoPago,
      paymentMethods: cfg.paymentMethods,
    });

    if (guarded.blockedClosed) {
      await this.reply(
        conv,
        msg.waId,
        cfg.closedMessage ||
          `Ahora estamos *cerrados*. ${status.message}. ${status.subMessage ?? ''}\n\nHorario hoy: ${status.openTime}–${status.closeTime}. Cuando abramos escríbenos de nuevo para pedir.`,
      );
      this.turnTelemetry.record({
        path: 'agent_v1',
        outcome: 'replied',
        waId: msg.waId,
        conversationId: conv.id,
        toolCalls: agent.toolCalls,
        latencyMs: Date.now() - started,
        userTextPreview: originalText || text,
        warnings: ['closed'],
      });
      return true;
    }

    if (looksLikeClearCartMessage(originalText || text) && guarded.actions) {
      guarded.actions.clearCart = true;
      delete guarded.actions.addItems;
      delete guarded.actions.setAddress;
    }

    // Nunca geocodificar comida / estilo ("Las mojarras fritas") vía set_address
    if (
      guarded.actions?.setAddress &&
      (this.looksLikeFoodNotAddress(guarded.actions.setAddress) ||
        this.looksLikeFoodNotAddress(originalText || text) ||
        FOOD_ORDER_SIGNAL_RE.test(guarded.actions.setAddress) ||
        FOOD_ORDER_SIGNAL_RE.test(originalText || text) ||
        isNothingElseOrderIntent(originalText || text) ||
        isFinishCheckoutIntent(originalText || text) ||
        isNothingElseOrderIntent(guarded.actions.setAddress) ||
        isFinishCheckoutIntent(guarded.actions.setAddress) ||
        this.isPickupIntent(guarded.actions.setAddress) ||
        this.isPickupIntent(originalText || text))
    ) {
      if (
        this.isPickupIntent(guarded.actions.setAddress) ||
        this.isPickupIntent(originalText || text)
      ) {
        guarded.actions.setOrderType = 'pickup';
      }
      delete guarded.actions.setAddress;
    }

    // Una dirección suelta no agrega platos (el "5" de la casa no es cantidad).
    if (looksLikeAddressOnlyMessage(originalText || text) && guarded.actions) {
      delete guarded.actions.addItems;
    }

    const hasProductiveActions = !!(
      guarded.actions?.addItems?.length ||
      guarded.actions?.removeProductIds?.length ||
      guarded.actions?.removeCartLines?.length ||
      guarded.actions?.updateCartLines?.length ||
      guarded.actions?.clearCart ||
      guarded.actions?.setAddress ||
      guarded.actions?.setOrderType ||
      guarded.actions?.setCustomerNotes ||
      guarded.actions?.setPaymentMethod ||
      guarded.actions?.updateAttributes?.length ||
      guarded.actions?.requestHuman ||
      agent.needsAttributeProductId
    );
    const agentReply = (agent.reply || '').trim();
    const replyIsVagueAsk =
      !agentReply ||
      /\bqu[eé]\s+se\s+te\s+antoja\b/i.test(agentReply) ||
      /\bdime el plato o el c[oó]digo\b/i.test(agentReply) ||
      /\bescribe\s+\*?men[uú]\*?\b/i.test(agentReply);
    const replyIsMenuSoftMiss =
      /\bpor ahora no manejamos\b/i.test(agentReply) ||
      /\bno lo tenemos en la carta\b/i.test(agentReply) ||
      /\bno manejamos\b.{0,40}\ben (el|nuestro|la)\b/i.test(agentReply);
    // Agente sin tools + reply vacío/genérico → siempre reglas
    // (multi-pedido, "Pollo", browse, etc.). Evita eco del historial.
    if (!hasProductiveActions && replyIsVagueAsk) {
      this.turnTelemetry.record({
        path: 'agent_v1',
        outcome: 'fallback_rules',
        waId: msg.waId,
        conversationId: conv.id,
        toolCalls: agent.toolCalls,
        latencyMs: Date.now() - started,
        userTextPreview: text,
        warnings: ['agent_vague_no_actions'],
      });
      return false;
    }

    // “No manejamos X” sin decir qué sí hay: Nest arma el pedido.
    // Si el agente ya contestó desde la carta (nombró precios), esa respuesta se queda.
    const agentQuotedMenu =
      /\$\s?\d{1,3}(?:\.\d{3})+/.test(agentReply) || /\b\d{2}\.\d{3}\b/.test(agentReply);
    if (!hasProductiveActions && replyIsMenuSoftMiss && !agentQuotedMenu) {
      this.turnTelemetry.record({
        path: 'agent_v1',
        outcome: 'fallback_rules',
        waId: msg.waId,
        conversationId: conv.id,
        toolCalls: agent.toolCalls,
        latencyMs: Date.now() - started,
        userTextPreview: text,
        warnings: ['agent_menu_soft_miss'],
      });
      return false;
    }
    if (agent.error === 'max_iterations' && !hasProductiveActions) {
      this.turnTelemetry.record({
        path: 'agent_v1',
        outcome: 'fallback_rules',
        waId: msg.waId,
        conversationId: conv.id,
        toolCalls: agent.toolCalls,
        latencyMs: Date.now() - started,
        userTextPreview: text,
        warnings: ['max_iterations_no_actions'],
      });
      return false;
    }

    const editsExistingCart = !!(guarded.actions?.updateAttributes?.length ||
      guarded.actions?.updateCartLines?.length || guarded.actions?.removeCartLines?.length ||
      guarded.actions?.removeProductIds?.length || guarded.actions?.clearCart ||
      (session.cart.length && guarded.actions?.setCustomerNotes));
    this.stripHostedDrinkAdds(text, products, guarded.actions);
    // Solo si Nest resolvió el pedido completo y el agente se dejó un plato
    // (combo + sopas, y agregó la gaseosa suelta). Si Nest duda o no encuentra
    // un nombre, se queda la lectura del agente: no la reemplaza la lista vieja.
    if (!editsExistingCart && this.agentDroppedResolvedDish(text, products, guarded.actions)) {
      this.turnTelemetry.record({
        path: 'agent_v1',
        outcome: 'fallback_rules',
        waId: msg.waId,
        conversationId: conv.id,
        toolCalls: agent.toolCalls,
        latencyMs: Date.now() - started,
        userTextPreview: text,
        warnings: ['agent_dropped_resolved_dish'],
      });
      return false;
    }

    const intentMisses = editsExistingCart ? [] : this.reconcileAgentAddsWithUtterance(text, products, guarded.actions);
    if (
      !editsExistingCart && !guarded.actions?.addItems?.length &&
      /\bagregu[eé]\b/i.test(agentReply) &&
      !guarded.actions?.setAddress &&
      !guarded.actions?.setCustomerNotes
    ) {
      this.turnTelemetry.record({
        path: 'agent_v1',
        outcome: 'fallback_rules',
        waId: msg.waId,
        conversationId: conv.id,
        toolCalls: agent.toolCalls,
        latencyMs: Date.now() - started,
        userTextPreview: text,
        warnings: ['agent_claimed_add_without_items'],
      });
      return false;
    }
    if (
      !editsExistingCart && !guarded.actions?.addItems?.length &&
      (await this.tryReplySimilarNamedOffer(conv, msg.waId, originalText || text, products))
    ) {
      this.turnTelemetry.record({
        path: 'agent_v1',
        outcome: 'replied',
        waId: msg.waId,
        conversationId: conv.id,
        toolCalls: agent.toolCalls,
        latencyMs: Date.now() - started,
        userTextPreview: originalText || text,
        warnings: ['similar_offer'],
      });
      return true;
    }
    const applied = await this.applyActions(
      conv,
      session,
      guarded.actions,
      products,
      cfg,
      text,
    );
    session = applied.session;

    if (applied.limitBlocked) {
      await this.conversationService.saveSession(conv, session);
      await this.handleCartLimitBlocked(conv, msg.waId, applied.limitBlocked, cfg);
      this.turnTelemetry.record({
        path: 'agent_v1',
        outcome: 'handoff',
        waId: msg.waId,
        conversationId: conv.id,
        toolCalls: agent.toolCalls,
        latencyMs: Date.now() - started,
        userTextPreview: text,
        warnings: guarded.warnings,
      });
      return true;
    }

    // "Un churrasco" es un pedido. Si el agente solo preguntó "¿lo agrego?", Nest lo agrega.
    if (
      !editsExistingCart && !guarded.actions?.addItems?.length &&
      this.nestWouldAddDirectDishOrder(text, products)
    ) {
      this.turnTelemetry.record({
        path: 'agent_v1',
        outcome: 'fallback_rules',
        waId: msg.waId,
        conversationId: conv.id,
        toolCalls: agent.toolCalls,
        latencyMs: Date.now() - started,
        userTextPreview: text,
        warnings: ['agent_asked_instead_of_add'],
      });
      return false;
    }

    // Nombre del cliente vía agente → Nest guarda y sigue checkout (no cortar en “nombre registrado”)
    {
      const nameFromAction =
        guarded.actions?.setCustomerName &&
        isUsableWhatsappCustomerName(guarded.actions.setCustomerName)
          ? guarded.actions.setCustomerName.trim()
          : null;
      const nameFromText =
        !nameFromAction &&
        session.cart.length > 0 &&
        !isUsableWhatsappCustomerName(conv.customerName || '') &&
        isUsableWhatsappCustomerName(originalText || text) &&
        !this.looksLikeAddressRejectingPersonName(originalText || text) &&
        !this.looksLikePayment(originalText || text, cfg.paymentMethods) &&
        !this.isPickupIntent(originalText || text) &&
        !FOOD_ORDER_SIGNAL_RE.test(originalText || text)
          ? (originalText || text).trim()
          : null;
      const nameToSet = nameFromAction || nameFromText;
      if (nameToSet && session.cart.length > 0) {
        await this.conversationService.saveSession(conv, session, 'building_cart');
        await this.conversationService.updateCustomerName(conv, nameToSet);
        const fresh = await this.conversationService.reloadConversation(conv.id);
        Object.assign(conv, fresh);
        session = this.conversationService.getSession(conv);
        await this.tryConfirmOrder(conv, msg.waId, session, {
          preface: `Con gusto, *${nameToSet}* ✅`,
        });
        this.turnTelemetry.record({
          path: 'agent_v1',
          outcome: 'order_progress',
          waId: msg.waId,
          conversationId: conv.id,
          toolCalls: agent.toolCalls,
          latencyMs: Date.now() - started,
          warnings: [...(guarded.warnings || []), 'agent_name_to_confirm'],
        });
        return true;
      }
    }

    // Agente eligió Mercado Pago (u otro pago) con carrito → Nest manda link / sigue checkout
    // (no dejar que el LLM diga "escribe confirmar" sin generar el link)
    {
      const payFromText =
        !isPaymentCapabilityQuestion(originalText || text)
          ? this.resolvePaymentChoice(originalText || text, cfg)
          : null;
      if (
        session.cart.length > 0 &&
        (guarded.actions?.setPaymentMethod || payFromText)
      ) {
        if (payFromText && !session.paymentMethod) {
          session = { ...session, paymentMethod: payFromText.id };
        }
        const payIsMp =
          session.paymentMethod === 'mercadopago' ||
          getEnabledPaymentMethods(cfg.paymentMethods).find((m) => m.id === session.paymentMethod)
            ?.flow === 'mercadopago';
        await this.conversationService.saveSession(conv, session, 'confirming');
        await this.tryConfirmOrder(conv, msg.waId, session, {
          skipFinalConfirm: !!payIsMp,
        });
        this.turnTelemetry.record({
          path: 'agent_v1',
          outcome: 'order_progress',
          waId: msg.waId,
          conversationId: conv.id,
          toolCalls: agent.toolCalls,
          latencyMs: Date.now() - started,
          warnings: [...(guarded.warnings || []), 'agent_payment_to_confirm'],
        });
        return true;
      }
    }

    // Agente marcó pickup y el cliente ya cerró ("nada más" / "no") → seguir checkout
    if (
      session.cart.length > 0 &&
      guarded.actions?.setOrderType === 'pickup' &&
      (isNothingElseOrderIntent(originalText || text) ||
        /^(no|nop|nel)[\s!.?]*$/i.test((originalText || text).trim()))
    ) {
      await this.conversationService.saveSession(conv, session, 'building_cart');
      await this.tryConfirmOrder(conv, msg.waId, session);
      this.turnTelemetry.record({
        path: 'agent_v1',
        outcome: 'order_progress',
        waId: msg.waId,
        conversationId: conv.id,
        toolCalls: agent.toolCalls,
        latencyMs: Date.now() - started,
        warnings: [...(guarded.warnings || []), 'agent_pickup_to_confirm'],
      });
      return true;
    }

    let reply = (agent.reply || '').trim();
    const withFirstContactDisclaimer = (body: string): string => {
      if (!params.prependFirstContactDisclaimer) return body;
      const d = this.buildAiDisclaimerMessage(cfg).trim();
      if (!d) return body;
      // Evitar duplicar si el modelo ya lo metió
      if (body.includes(d) || /con gusto te atiendo/i.test(body)) return body;
      return `${d}\n\n${body}`;
    };
    if (guarded.actions?.requestHuman) {
      reply = this.humanContactMessage();
      await this.conversationService.saveSession(conv, session, 'building_cart');
      await this.reply(conv, msg.waId, withFirstContactDisclaimer(reply));
      this.turnTelemetry.record({
        path: 'agent_v1',
        outcome: 'handoff',
        waId: msg.waId,
        conversationId: conv.id,
        toolCalls: agent.toolCalls,
        latencyMs: Date.now() - started,
        replyPreview: reply,
      });
      return true;
    }

    // Abrir flujo de attrs si el agente encontró el plato pero faltan opciones
    if (agent.needsAttributeProductId) {
      const product = products.find((p) => p.id === agent.needsAttributeProductId);
      if (product?.hasAttributes && product.attributes?.length) {
        session = this.buildPendingAttributeSession(session, product, [], {
          sourceText: text,
        });
        await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
        const attrPrompt = this.catalogService.formatProductOptionsPrompt(product, []);
        reply = reply
          ? `${reply}\n\n${attrPrompt}`
          : `Para *${product.name}* elige opciones:\n\n${attrPrompt}`;
        await this.reply(conv, msg.waId, withFirstContactDisclaimer(reply));
        this.turnTelemetry.record({
          path: 'agent_v1',
          outcome: 'order_progress',
          waId: msg.waId,
          conversationId: conv.id,
          toolCalls: agent.toolCalls,
          latencyMs: Date.now() - started,
          replyPreview: reply,
          warnings: guarded.warnings,
        });
        return true;
      }
    }

    const fee = this.deliveryFeeFor(session, cfg);
    if (session.cart.length > 0 && guarded.actions?.addItems?.length) {
      const addedNames = (guarded.actions.addItems || [])
        .map((a) => {
          const name = products.find((p) => p.id === a.productId)?.name;
          if (!name) return null;
          return this.formatAddedProductLabel(name, Number(a.quantity) || 1);
        })
        .filter(Boolean) as string[];
      // Una sola burbuja del sistema (evita "añadí… ¿pasamos a tu nombre?" del LLM).
      // Si el agente dijo que un plato no está, esa frase se queda.
      const cartReply = this.buildCartAddReply(
        session,
        fee,
        addedNames.length ? addedNames : 'ítems',
      );
      const missLine = agentReply
        .split('\n')
        .map((line) => line.trim())
        .find((line) => /no (?:te ofrecemos|tenemos|manejamos)\b/i.test(line));
      const misses = [missLine, ...intentMisses].filter(Boolean);
      reply = misses.length ? `${misses.join('\n')}\n\n${cartReply}` : cartReply;
    } else if (guarded.actions?.updateAttributes?.length) {
      reply =
        guarded.actions.updateAttributes
          .map((u) => {
            const name =
              session.cart.find((c) => c.productId === u.productId)?.name || 'el pedido';
            return `Listo ✅ *${name}* queda con *${u.attributeName}: ${u.attributeValue}*.`;
          })
          .join('\n') + '\n\n¿*Algo más*?';
    } else if (guarded.warnings?.length && !reply) {
      reply = guarded.warnings[0];
    }

    if (
      looksLikeAddressOnlyMessage(originalText || text) &&
      /\bagregu[eé]\b/i.test(reply)
    ) {
      reply = session.address?.trim()
        ? `📍 Domicilio anotado: _${session.address}_\n\n${
            session.cart.length
              ? `${this.formatCartOnly(session, fee)}\n`
              : ''
          }${this.formatContinueShoppingPrompt(session)}`
        : 'Dime qué se te antoja y lo armo.';
    }

    if (!reply) {
      reply = '¿Qué se te antoja? Dime el plato o el código, o escribe *menú*.';
    }

    reply = withFirstContactDisclaimer(reply);
    await this.conversationService.saveSession(conv, session, 'building_cart');
    await this.reply(conv, msg.waId, reply);

    this.turnTelemetry.record({
      path: 'agent_v1',
      outcome: session.cart.length > 0 ? 'order_progress' : 'replied',
      waId: msg.waId,
      conversationId: conv.id,
      toolCalls: agent.toolCalls,
      latencyMs: Date.now() - started,
      userTextPreview: text,
      replyPreview: reply,
      warnings: guarded.warnings,
    });
    return true;
  }

  /**
   * Lista categoría, estilo de preparación o “X o Y” sin pasar por el agente.
   */
  private async tryHandleDeterministicMenuBrowse(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    products: MenuProduct[],
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    const comesWith = this.catalogService.comesWithOffer(text, products);
    if (comesWith) {
      await this.conversationService.saveSession(conv, session, 'building_cart');
      await this.reply(conv, waId, comesWith.reply);
      return true;
    }

    const catalogAsk = this.catalogService.resolveCatalogQuestion(text, products);
    if (catalogAsk) {
      session = {
        ...session,
        pendingAttribute: undefined,
        pendingMultiOrder: undefined,
        pendingCategoryBrowse: undefined,
      };
      if (!catalogAsk.products.length) {
        session = { ...session, pendingMatch: undefined };
        await this.conversationService.saveSession(conv, session, 'building_cart');
        const menuUrl = (cfg.menuUrl || '').trim();
        await this.reply(
          conv,
          waId,
          `Por ahora no manejamos *${catalogAsk.label.toLowerCase()}* en la carta.` +
            (menuUrl ? `\nMenú: ${menuUrl}` : '') +
            `\n\n¿*Algo más*?`,
        );
        return true;
      }
      session = {
        ...session,
        pendingMatch: {
          query: catalogAsk.label,
          candidates: catalogAsk.products,
        },
      };
      await this.conversationService.saveSession(conv, session, 'building_cart');
      await this.reply(
        conv,
        waId,
        this.catalogService.formatCategoryList(catalogAsk.label, catalogAsk.products),
      );
      return true;
    }

    // "¿Tienes arroz chino?" es un plato (familia), no un dump de categoría.
    // "qué bandejas hay" sí es la categoría, aunque exista una familia de bandeja.
    if (
      this.catalogService.isAvailabilityInquiry(text) &&
      !this.catalogService.isCategoryBrowseQuestion(text)
    ) {
      const stripped = this.catalogService.stripAvailabilityInquiryNoise(text);
      const query = this.catalogService.extractProductSearchQuery(stripped || text);
      const family = query
        ? this.catalogService.findProductVariantFamily(query, products)
        : null;
      if (family?.variants?.length) return false;
    }

    const alternative = this.catalogService.findAlternativeMenuList(
      text,
      products,
      cfg.menuConceptGroups,
    );
    if (alternative?.products.length) {
      session = {
        ...session,
        pendingAttribute: undefined,
        pendingMultiOrder: undefined,
        pendingCategoryBrowse: undefined,
        pendingMatch: {
          query: alternative.categoryName,
          candidates: alternative.products,
        },
      };
      await this.conversationService.saveSession(conv, session, 'building_cart');
      await this.reply(
        conv,
        waId,
        this.catalogService.formatCategoryList(
          alternative.categoryName,
          alternative.products,
        ),
      );
      return true;
    }

    const styleBrowse = this.catalogService.extractCookingStyleBrowseIntent(text);
    if (styleBrowse) {
      const styleHits = this.catalogService.findProductsByCookingStyle(
        styleBrowse,
        products,
        12,
      );
      const reply = this.catalogService.formatCookingStyleBrowseReply(styleBrowse, styleHits, {
        menuUrl: cfg.menuUrl,
        availableStyles: this.catalogService.listAvailableCookingStyles(products),
      });
      session = {
        ...session,
        pendingMatch: styleHits.length
          ? { query: styleBrowse, candidates: styleHits }
          : undefined,
        pendingCategoryBrowse: undefined,
        pendingAttribute: undefined,
        pendingMultiOrder: undefined,
      };
      await this.conversationService.saveSession(conv, session, 'building_cart');
      await this.reply(conv, waId, reply);
      return true;
    }

    const browseAsk =
      this.catalogService.isMenuExploreIntent(text, products) ||
      this.catalogService.isCategoryBrowseQuestion(text);
    const hit = this.catalogService.findCategoryBrowseHit(
      text,
      products,
      cfg.menuConceptGroups,
    );
    if (
      /\bmexican[oa]s?\b/i.test(text) &&
      !hit?.products?.length
    ) {
      const menuUrl = (cfg.menuUrl || '').trim();
      await this.reply(
        conv,
        waId,
        `Por ahora no manejamos *comida mexicana*.` +
          (menuUrl ? `\nMenú: ${menuUrl}` : ''),
      );
      return true;
    }
    const bareConceptOrCategory =
      !!hit?.products?.length &&
      (text || '').trim().split(/\s+/).filter(Boolean).length <= 3 &&
      this.catalogService.extractQuantityFromMessage(text) < 2 &&
      !this.catalogService.looksLikeClearlyMultiDishOrder(text) &&
      !/\b(quiero|dame|ponme|agrega|regala)\b/i.test(text);
    if (browseAsk || bareConceptOrCategory) {
      session = {
        ...session,
        pendingMatch: undefined,
        pendingMultiOrder: undefined,
        pendingAttribute: undefined,
      };
      const specificCue =
        /\b(carne|carnes|pollo|pollos|sopa|sopas|bebida|bebidas|gaseosa|jugo|jugos|limonada|arroz|bandeja|pescado|mojarra|frito|broaster|ejecutivo|hamburguesa|salchipapa|comida\s+rapid|mexicana|mexicano|tacos?)\b/i.test(
          text,
        );
      const orderingOne =
        /\b(quiero|dame|ponme|agrega|regalame|me\s+regalas)\b/i.test(text) &&
        !/\b(qu[eé]|cu[aá]les|opciones|tienes|tienen|hay)\b/i.test(text);
      if (orderingOne && hit?.products.length === 1) {
        return false;
      }
      if (
        hit?.products.length &&
        (bareConceptOrCategory ||
          specificCue ||
          this.catalogService.isCategoryBrowseQuestion(text) ||
          this.catalogService.isMenuExploreIntent(text, products))
      ) {
        session = {
          ...session,
          pendingCategoryBrowse: undefined,
          pendingMatch: {
            query: hit.categoryName,
            candidates: hit.products,
          },
        };
        await this.conversationService.saveSession(conv, session, 'building_cart');
        await this.reply(
          conv,
          waId,
          this.catalogService.formatCategoryBrowseReply(hit),
        );
        return true;
      }
      if (this.catalogService.isMenuExploreIntent(text, products)) {
        const intro = this.catalogService.buildMenuExploreIntro(text);
        const overview = this.catalogService.formatMenuCategoryOverview(products, {
          intro,
          menuUrl: cfg.menuUrl,
        });
        session = {
          ...session,
          pendingCategoryBrowse: { categories: overview.categories },
          pendingMatch: undefined,
        };
        await this.conversationService.saveSession(conv, session, 'building_cart');
        await this.reply(conv, waId, overview.text);
        return true;
      }
    }
    return false;
  }

  /** Cambia una opción ya elegida (bebida, arepa, presa) si el cliente nombra otra del mismo atributo. */
  private async tryHandleCartAttributeOptionChange(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    products: MenuProduct[],
  ): Promise<boolean> {
    if (!session.cart.length) return false;
    const change = this.catalogService.findCartAttributeOptionChange(text, session.cart, products);
    if (!change) return false;
    const line = session.cart[change.cartIndex];
    if (!line) return false;
    const attributes = [...(line.attributes || [])];
    const idx = attributes.findIndex(
      (a) => a.attributeName.toLowerCase() === change.attributeName.toLowerCase(),
    );
    if (idx >= 0) attributes[idx] = { attributeName: change.attributeName, attributeValue: change.attributeValue };
    else attributes.push({ attributeName: change.attributeName, attributeValue: change.attributeValue });
    const cart = session.cart.map((item, i) => (i === change.cartIndex ? { ...item, attributes } : item));
    session = { ...session, cart, pendingAttribute: undefined, pendingMatch: undefined };
    await this.conversationService.saveSession(conv, session, 'building_cart');
    await this.reply(
      conv,
      waId,
      `Listo ✅ *${change.itemName}* queda con *${change.attributeName}: ${change.attributeValue}*.\n\n¿*Algo más*?`,
    );
    return true;
  }

  /**
   * “¿Se puede con pollo broaster?” → cambiar attr Pollo del ítem del carrito
   * (no nota genérica ni abrir menú de Pollo Broaster suelto).
   */
  private async tryHandleDishStyleSubstitutionInquiry(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    products: MenuProduct[],
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    if (!this.catalogService.isDishStyleSubstitutionInquiry(text)) return false;

    const style = this.catalogService.extractRequestedProteinStyle(text);
    if (!style) return false;

    const baseQuery = this.catalogService.extractBaseDishQueryForStyleSwap(text);
    const applied = this.tryApplyCookingStyleToCartItem(session, products, style, baseQuery);

    if (applied) {
      session = {
        ...applied.session,
        pendingAttribute: undefined,
        pendingMatch: undefined,
        pendingMultiOrder: undefined,
      };
      await this.conversationService.saveSession(conv, session, 'building_cart');
      const styleLabel =
        applied.attributeValue.charAt(0).toUpperCase() + applied.attributeValue.slice(1);
      await this.reply(
        conv,
        waId,
        `Listo ✅ *${applied.itemName}* queda con *${applied.attributeName}: ${styleLabel}*.\n\n¿*Algo más*?`,
      );
      return true;
    }

    const swapped = this.trySwapCartLineToCookingStyleSku(session, products, style, baseQuery);
    if (swapped) {
      const remaining = this.catalogService.getRemainingAttributes(
        swapped.product,
        swapped.keptAttributes,
      );
      if (remaining.length) {
        session = {
          ...swapped.session,
          cart: swapped.session.cart.filter((_, i) => i !== swapped.cartIndex),
          pendingAttribute: {
            productId: swapped.product.id,
            name: swapped.product.name,
            code: swapped.product.code,
            price: swapped.product.price,
            attributes: swapped.product.attributes || [],
            selected: swapped.keptAttributes,
          },
          pendingMatch: undefined,
          pendingMultiOrder: undefined,
        };
        await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
        await this.reply(
          conv,
          waId,
          `Listo, *${swapped.product.name}* en vez de *${swapped.previousName}*.\n\n` +
            this.catalogService.formatProductOptionsPrompt(
              swapped.product,
              swapped.keptAttributes,
            ),
        );
        return true;
      }
      session = {
        ...swapped.session,
        pendingAttribute: undefined,
        pendingMatch: undefined,
        pendingMultiOrder: undefined,
      };
      await this.conversationService.saveSession(conv, session, 'building_cart');
      await this.reply(
        conv,
        waId,
        `Listo ✅ lo cambié a *${swapped.product.name}*.\n\n¿*Algo más*?`,
      );
      return true;
    }

    if (session.pendingMatch?.candidates?.length) return false;

    const dishLeft = this.normalizeForMatch(baseQuery)
      .split(' ')
      .filter((t) => t.length >= 4 && !/^(pollo|quiero|con|este|esta|ese|eso)$/.test(t));
    if (!dishLeft.length && session.cart.length) {
      const last = session.cart[session.cart.length - 1];
      await this.conversationService.saveSession(conv, session, 'building_cart');
      await this.reply(
        conv,
        waId,
        `*${last.name}* no tiene otra versión en *${style}* en la carta.\n\n¿*Algo más*?`,
      );
      return true;
    }
    if (!dishLeft.length) return false;

    // Sin attr de estilo en el carrito: nota en el plato (no agregar Broaster suelto)
    const styleNote = `pollo ${style}`;
    session = {
      ...session,
      pendingAttribute: undefined,
      pendingMatch: undefined,
      pendingMultiOrder: undefined,
      customerNotes: [session.customerNotes?.trim(), styleNote].filter(Boolean).join(' · ').slice(0, 400),
    };

    const family =
      (baseQuery
        ? this.catalogService.findProductVariantFamily(baseQuery, products)
        : null) ||
      this.catalogService.findProductVariantFamily(text, products);

    if (family && family.variants.length >= 2) {
      const rows = family.variants.map((p, i) => ({
        index: i + 1,
        label: this.catalogService.getVariantDisplayLabel(p.name, family.baseKey),
        price: p.price,
        code: p.code,
      }));
      const reply =
        `Sí 👍 Lo podemos dejar en *nota* del pedido: *${styleNote}* en el *${family.baseLabel}*.\n\n` +
        `¿Cuál presentación quieres?\n\n` +
        `${this.catalogService.formatOptionsList(rows)}\n\n` +
        `_Responde con el *número* o el nombre de la variante._`;
      session = {
        ...session,
        pendingMatch: {
          query: baseQuery || family.baseLabel,
          candidates: family.variants,
          intent: 'order',
        },
      };
      await this.conversationService.saveSession(conv, session, 'building_cart');
      await this.reply(conv, waId, reply);
      return true;
    }

    const hit =
      (baseQuery
        ? this.catalogService.findProductEmbeddedInMessage(baseQuery, products)
        : null) ||
      family?.variants?.[0] ||
      null;
    let reply = `Sí 👍 Lo podemos dejar en *nota* del pedido: *${styleNote}*.\n`;
    if (hit) {
      reply +=
        `\nEn el menú: *${hit.name}* · Cód. ${this.catalogService.formatProductCode(hit.code)} · ${this.catalogService.formatMoney(hit.price)}\n` +
        `\n¿Te lo agrego con esa nota? Escribe *sí*.`;
      session = this.rememberProductFocus(session, hit, products);
      await this.savePendingAddOffer(conv, hit, 1);
    } else if (session.cart.length) {
      reply =
        `Sí 👍 Dejo la nota *${styleNote}* para cocina.\n\n¿*Algo más*?`;
    } else {
      reply +=
        `\nDime el plato (ej. *arroz chino*) y te muestro las opciones` +
        ((cfg.menuUrl || '').trim() ? `: ${cfg.menuUrl.trim()}` : ' del menú.');
    }

    await this.conversationService.saveSession(conv, session, 'building_cart');
    await this.reply(conv, waId, reply);
    return true;
  }

  /**
   * Cambia Pollo/Selección/… del ítem del carrito al estilo pedido (broaster, frito…).
   */
  private tryApplyCookingStyleToCartItem(
    session: WhatsappSessionData,
    products: MenuProduct[],
    style: string,
    baseQuery: string,
  ): {
    session: WhatsappSessionData;
    itemName: string;
    attributeName: string;
    attributeValue: string;
  } | null {
    if (!session.cart.length) return null;

    const byId = new Map(products.map((p) => [p.id, p]));
    const baseNorm = this.normalizeForMatch(baseQuery || '');

    const scoreIndex = (i: number): number => {
      const item = session.cart[i];
      const product = byId.get(item.productId);
      if (!product) return -1;
      if (!this.catalogService.resolveCookingStyleAttributeOption(product, style)) return -1;
      let score = 10;
      if (session.productFocus?.productId === item.productId) score += 50;
      if (i === session.cart.length - 1) score += 20;
      const nameNorm = this.normalizeForMatch(item.name);
      if (baseNorm && (nameNorm.includes(baseNorm) || baseNorm.includes(nameNorm))) {
        score += 40;
      }
      if (baseNorm && /\barroz\b/.test(baseNorm) && /\barroz\b/.test(nameNorm)) score += 30;
      return score;
    };

    let bestIdx = -1;
    let bestScore = 0;
    for (let i = 0; i < session.cart.length; i++) {
      const s = scoreIndex(i);
      if (s > bestScore) {
        bestScore = s;
        bestIdx = i;
      }
    }
    if (bestIdx < 0) return null;

    const item = session.cart[bestIdx];
    const product = byId.get(item.productId)!;
    const applied = this.catalogService.applyCookingStyleToAttributes(
      product,
      item.attributes || [],
      style,
    );
    if (!applied) return null;

    const cart = session.cart.map((c, i) =>
      i === bestIdx ? { ...c, attributes: applied.attributes } : c,
    );
    return {
      session: {
        ...session,
        cart,
        productFocus: {
          productId: item.productId,
          name: item.name,
          variantBaseKey:
            this.catalogService.getProductNameBase(item.name) || undefined,
        },
      },
      itemName: item.name,
      attributeName: applied.attributeName,
      attributeValue: applied.attributeValue,
    };
  }

  /**
   * Frito y broaster son SKUs distintos (ejecutivo, no un atributo Pollo).
   * "lo quiero con pollo broaster" reemplaza esa línea, no agrega otro pollo.
   */
  private trySwapCartLineToCookingStyleSku(
    session: WhatsappSessionData,
    products: MenuProduct[],
    style: string,
    baseQuery: string,
  ): {
    session: WhatsappSessionData;
    product: MenuProduct;
    previousName: string;
    cartIndex: number;
    keptAttributes: { attributeName: string; attributeValue: string }[];
  } | null {
    if (!session.cart.length) return null;
    const byId = new Map(products.map((p) => [p.id, p]));
    const baseNorm = this.normalizeForMatch(baseQuery || '');
    let bestIdx = -1;
    let bestSibling: MenuProduct | null = null;
    let bestScore = 0;

    for (let i = 0; i < session.cart.length; i++) {
      const item = session.cart[i];
      const product = byId.get(item.productId);
      if (!product) continue;
      const sibling = this.catalogService.findCookingStyleSibling(product, products, style);
      if (!sibling || sibling.id === product.id) continue;
      let score = 10;
      if (i === session.cart.length - 1) score += 20;
      if (session.productFocus?.productId === item.productId) score += 40;
      const nameNorm = this.normalizeForMatch(this.catalogService.stripCookingStyleTokens(item.name));
      if (baseNorm && nameNorm && (nameNorm.includes(baseNorm) || baseNorm.includes(nameNorm))) {
        score += 30;
      }
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
        bestSibling = sibling;
      }
    }
    if (bestIdx < 0 || !bestSibling) return null;

    const item = session.cart[bestIdx];
    const keptAttributes = (item.attributes || []).filter((a) => {
      const attr = (bestSibling!.attributes || []).find(
        (x) => this.normalizeForMatch(x.attributeName) === this.normalizeForMatch(a.attributeName),
      );
      if (!attr?.options?.length) return false;
      return attr.options.some(
        (o) => this.normalizeForMatch(o) === this.normalizeForMatch(a.attributeValue),
      );
    });
    const cart = session.cart.map((c, i) =>
      i === bestIdx
        ? {
            ...c,
            productId: bestSibling!.id,
            name: bestSibling!.name,
            code: bestSibling!.code,
            unitPrice: bestSibling!.price,
            attributes: keptAttributes,
          }
        : c,
    );
    return {
      session: {
        ...session,
        cart,
        productFocus: {
          productId: bestSibling.id,
          name: bestSibling.name,
          variantBaseKey: this.catalogService.stripCookingStyleTokens(bestSibling.name) || undefined,
        },
      },
      product: bestSibling,
      previousName: item.name,
      cartIndex: bestIdx,
      keptAttributes,
    };
  }

  private async tryHandleComboExplanation(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    products: MenuProduct[],
  ): Promise<boolean> {
    if (this.catalogService.isMixtoCompositionInquiry(text)) {
      return this.tryHandleMixtoCompositionInquiry(
        conv,
        waId,
        session,
        text,
        products,
        await this.settingsService.getEffectiveConfig(),
      );
    }
    // Contexto: último plato del carrito, focus, o mención en el texto
    const focusId = session.productFocus?.productId;
    const focus =
      (focusId != null ? products.find((p) => p.id === focusId) : null) ||
      (session.cart.length
        ? products.find((p) => p.id === session.cart[session.cart.length - 1]?.productId)
        : null);

    let family = focus
      ? this.catalogService.findProductVariantFamily(focus.name, products, [focus])
      : null;
    if (!family || family.variants.length < 2) {
      family = this.catalogService.findProductVariantFamily(text, products);
    }
    if (!family || family.variants.length < 2) {
      // Fallback típico: pollo frito/broaster
      family =
        this.catalogService.findProductVariantFamily('pollo frito', products) ||
        this.catalogService.findProductVariantFamily('pollo broaster', products);
    }
    if (!family || family.variants.length < 2) {
      await this.reply(
        conv,
        waId,
        'El *combo* suele ser el plato *con gaseosa* (y a veces papas/arepas según el ítem).\n' +
          'Dime el plato (ej. *pollo frito* o *arroz chino*) y te paso precios de cada presentación.',
      );
      return true;
    }

    session = {
      ...session,
      pendingMatch: {
        query: text,
        candidates: family.variants,
        intent: 'info',
      },
      productFocus: {
        productId: family.variants[0].id,
        name: family.variants[0].name,
        variantBaseKey: family.baseKey,
      },
    };
    await this.conversationService.saveSession(conv, session);
    await this.reply(conv, waId, this.catalogService.formatComboExplanation(family));
    return true;
  }

  /**
   * Parte "qué precio tiene el pollo frito" + "y dos sopas" (líneas o cola con Y + cantidad).
   * Así no se pierde el precio ni el pedido ambiguo en el mismo turno.
   */
  private splitPriceAndOrderParts(
    text: string,
  ): { priceText: string; orderText: string } | null {
    const raw = (text || '').trim();
    if (!raw) return null;

    const lines = raw
      .split(/\r?\n+/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length >= 2) {
      const priceLines: string[] = [];
      const orderLines: string[] = [];
      for (const line of lines) {
        const looksPrice = this.catalogService.isPriceInquiryIntent(line);
        const isBareCode = /^(?:c[oó]digo\s*)?#?\s*\d{1,3}\s*$/i.test(line);
        const looksOrder =
          isBareCode ||
          (/^(y|ademas|además)\b/i.test(line) && !looksPrice) ||
          (/\b(dame|regalame|regáleme|quiero|ponme|agrega|ped[ií]|necesito)\b/i.test(line) &&
            !looksPrice) ||
          (this.catalogService.extractQuantityFromMessage(line) >= 2 && !looksPrice);
        if (looksPrice) {
          priceLines.push(line.replace(/^(y|ademas|además)\s+/i, '').trim());
        } else if (looksOrder) {
          orderLines.push(line);
        } else if (this.catalogService.isPriceInquiryIntent(raw) && !looksPrice) {
          // Línea corta sin señal clara: con contexto de precio global, suele ser pedido
          orderLines.push(line);
        } else {
          priceLines.push(line);
        }
      }
      if (priceLines.length && orderLines.length) {
        return {
          priceText: priceLines.join('\n'),
          orderText: orderLines.join('\n').replace(/^(y|ademas|además)\s+/i, '').trim(),
        };
      }
    }

    // "Código 38 y un pollo frito que precio tiene"
    const codeThenPrice = raw.match(
      /^(?:c[oó]digo\s*)?#?\s*(\d{1,3})\s*(?:y|,|\n+)\s*(.+\b(?:precio|cuesta|cuestan|vale|valen|cu[aá]nto)\b.*)$/i,
    );
    if (codeThenPrice) {
      const priceText = codeThenPrice[2].trim().replace(/^(y|ademas|además)\s+/i, '');
      if (
        this.catalogService.isPriceInquiryIntent(priceText) &&
        !this.catalogService.isPriceInquiryIntent(codeThenPrice[1])
      ) {
        return {
          priceText,
          orderText: `código ${codeThenPrice[1]}`,
        };
      }
    }

    if (!this.catalogService.isPriceInquiryIntent(raw)) return null;

    // Una sola línea: "…precio tiene el pollo frito y dos sopas"
    const m = raw.match(
      /^(.+?\b(?:precio|cuesta|cuestan|vale|valen|cu[aá]nto)\b[^.?\n]*[.?]?)(?:\s+y\s+)(.+)$/i,
    );
    if (m) {
      const priceText = m[1].trim();
      const orderText = m[2].trim();
      if (
        this.catalogService.isPriceInquiryIntent(priceText) &&
        orderText.length >= 3 &&
        !this.catalogService.isPriceInquiryIntent(orderText)
      ) {
        return { priceText, orderText };
      }
    }
    return null;
  }

  private async tryHandleProductInfoInquiry(
    conv: WhatsappConversation,
    waId: string,
    text: string,
    products: MenuProduct[],
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    if (this.catalogService.isProductDescriptionInquiry(text)) return false;
    const unavailable = this.catalogService.unavailableAskReply(text, products, cfg.menuUrl);
    if (unavailable) {
      await this.reply(conv, waId, unavailable);
      return true;
    }
    if (!this.catalogService.isGenericProductInquiry(text)) return false;

    const session = this.conversationService.getSession(conv);
    const focusName =
      session.productFocus?.name ||
      (session.pendingAddOffer?.name ?? undefined);

    const stripped = this.catalogService.stripAvailabilityInquiryNoise(
      this.catalogService.stripPriceInquiryNoise(text),
    );
    const query = this.catalogService.extractProductSearchQuery(stripped || text);
    const dishHint = (stripped || query || '')
      .replace(/^(?:un|una|unos|unas|el|la|los|las)\s+/i, '')
      .trim();

    const browseHit =
      this.catalogService.findCategoryBrowseHit(query, products, cfg.menuConceptGroups) ||
      this.catalogService.findCategoryBrowseHit(text, products, cfg.menuConceptGroups);
    if (browseHit?.products.length) {
      const list = browseHit.products.slice(0, 12);
      await this.conversationService.saveSession(conv, {
        ...session,
        pendingMatch: { query: browseHit.categoryName, candidates: list },
      });
      await this.reply(
        conv,
        waId,
        this.catalogService.formatCategoryBrowseReply({
          categoryName: browseHit.categoryName,
          products: list,
          askedButMissing: browseHit.askedButMissing,
        }),
      );
      return true;
    }

    const priceProducts = this.catalogService.resolvePriceInquiryProducts(text, products, {
      preferStyleFromName: focusName,
    });
    if (priceProducts.length >= 2) {
      const qty = this.catalogService.extractQuantityFromMessage(text);
      await this.savePendingAddOffer(conv, priceProducts[0], qty, {
        sourceText: text,
        productIds: priceProducts.map((p) => p.id),
      });
      await this.reply(
        conv,
        waId,
        this.catalogService.formatMultiProductPriceReply(priceProducts),
      );
      return true;
    }

    const sizedFollowUp = this.catalogService.resolveSizedChickenProduct(text, products, {
      preferStyleFromName: focusName,
    });
    const embedded =
      priceProducts[0] ||
      sizedFollowUp ||
      this.catalogService.findProductEmbeddedInMessage(query, products) ||
      this.catalogService.findProductEmbeddedInMessage(dishHint, products) ||
      this.catalogService.findProductEmbeddedInMessage(text, products);

    const family =
      this.catalogService.findProductVariantFamily(text, products, embedded ? [embedded] : undefined) ||
      this.catalogService.findProductVariantFamily(query, products, embedded ? [embedded] : undefined);
    const familyPick = family
      ? this.catalogService.pickVariantFromFamilyText(text, family) ||
        this.catalogService.pickVariantFromFamilyText(query, family)
      : null;
    const infoProduct = familyPick || embedded;

    if (infoProduct) {
      const qty = this.catalogService.extractQuantityFromMessage(text);
      await this.savePendingAddOffer(conv, infoProduct, qty, { sourceText: text });
      await this.reply(
        conv,
        waId,
        this.formatOfferedProductReply(infoProduct, qty, text, dishHint || query),
      );
      return true;
    }

    let scored = this.catalogService.searchByNameScored(query, products, 6);
    if (!scored.length && dishHint && dishHint !== query) {
      scored = this.catalogService.searchByNameScored(dishHint, products, 6);
    }
    if (!scored.length) {
      // "tienes mazorcada?" con nombre concreto → soft-miss, no "¿de qué plato?"
      if (dishHint.length >= 3 && !/^(plato|producto|comida|algo|eso|esto)$/i.test(dishHint)) {
        await this.reply(
          conv,
          waId,
          this.catalogService.formatNotOnMenuReply(dishHint, cfg.menuUrl),
        );
        return true;
      }
      await this.reply(
        conv,
        waId,
        '¿De qué plato quieres saber? Dime el nombre (ej. *pollo frito*, *sopa de mondongo*) y te cuento.',
      );
      return true;
    }

    if (scored.length === 1 || this.catalogService.isStrongProductMatch(scored)) {
      const qty = this.catalogService.extractQuantityFromMessage(text);
      await this.savePendingAddOffer(conv, scored[0].p, qty, { sourceText: text });
      await this.reply(
        conv,
        waId,
        this.formatOfferedProductReply(scored[0].p, qty, text, dishHint || query),
      );
      return true;
    }

    await this.reply(
      conv,
      waId,
      this.catalogService.formatPriceInquiryList(scored.slice(0, 5).map((x) => x.p)),
    );
    return true;
  }

  private formatOfferedProductReply(
    product: MenuProduct,
    quantity: number,
    sourceText: string,
    askedLabel: string,
  ): string {
    const card = this.formatPriceInquiryReply(product, quantity, sourceText);
    const missing = this.catalogService.uncoveredWordsAgainstOffers(sourceText, [product]);
    if (!missing.length) return card;
    return this.catalogService.formatWeDontOfferPreface(askedLabel || sourceText, 1) + card;
  }

  private formatPriceInquiryReply(
    product: MenuProduct,
    quantity = 1,
    sourceText?: string,
  ): string {
    const qty = Math.max(1, quantity || 1);
    let scheduleLead: string | undefined;
    if (this.catalogService.isWeekendScheduleQuestion(sourceText || '')) {
      const note = this.catalogService.formatProductScheduleNote(product);
      if (note) {
        scheduleLead = note.replace(/^⏰\s*/, 'Sí: ');
      } else if (product.availableNow === false) {
        scheduleLead = 'Por horario *ahora no está*; si es de otro día, dime y te oriento.';
      } else {
        scheduleLead = 'Sí, *hoy lo tenemos* ✅ (no es solo fin de semana según el menú).';
      }
    }
    const base = this.catalogService.formatProductPriceReply(product, { scheduleLead });
    if (qty <= 1) {
      return base;
    }
    const line = Math.round(product.price * qty);
    return (
      `${base}\n\n` +
      `Para *${qty}* unidades: *$${line.toLocaleString('es-CO')}* ` +
      `($${Math.round(product.price).toLocaleString('es-CO')} c/u).\n\n` +
      `_Escribe *sí* y te agrego las ${qty}._`
    );
  }

  /**
   * "Quiero una leche": no es el jugo. Se ofrece lo parecido y no se agrega.
   */
  private async tryReplySimilarNamedOffer(
    conv: WhatsappConversation,
    waId: string,
    text: string,
    products: MenuProduct[],
  ): Promise<boolean> {
    if (this.catalogService.isAvailabilityInquiry(text)) return false;
    if (this.catalogService.isPriceInquiryIntent(text)) return false;
    if (this.catalogService.isProductDescriptionInquiry(text)) return false;
    if (this.catalogService.isCategoryBrowseQuestion(text)) return false;
    if (this.catalogService.isGenericProductInquiry(text)) return false;
    const similars = this.catalogService.similarNamedProducts(text, products);
    if (!similars.length) return false;
    if (similars.length === 1) {
      await this.savePendingAddOffer(conv, similars[0], 1, { sourceText: text });
    }
    await this.reply(conv, waId, this.catalogService.formatSimilarOfferReply(text, similars));
    return true;
  }

  private async savePendingAddOffer(
    conv: WhatsappConversation,
    product: MenuProduct,
    quantity = 1,
    opts?: { sourceText?: string; productIds?: number[] },
  ): Promise<void> {
    const session = this.conversationService.getSession(conv);
    const qty = Math.max(1, Math.min(30, quantity || 1));
    const productIds =
      opts?.productIds?.length && opts.productIds.length > 1
        ? opts.productIds
        : undefined;
    await this.conversationService.saveSession(conv, {
      ...session,
      pendingAddOffer: {
        productId: product.id,
        name: product.name,
        code: product.code,
        price: product.price,
        quantity: qty,
        ...(opts?.sourceText ? { sourceText: opts.sourceText.slice(0, 400) } : {}),
        ...(productIds ? { productIds } : {}),
      },
      productFocus: {
        productId: product.id,
        name: product.name,
      },
    });
  }

  private async tryHandlePendingAddOffer(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    products: MenuProduct[],
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    const offer = session.pendingAddOffer;
    if (!offer?.productId) return false;
    if (session.pendingAttribute || session.pendingMatch || session.pendingMultiOrder) {
      return false;
    }

    if (isPendingAddOfferDecline(text)) {
      await this.conversationService.saveSession(conv, {
        ...session,
        pendingAddOffer: undefined,
      });
      const suffix =
        session.cart.length > 0
          ? `\n\n${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}\n\n${this.formatContinueShoppingPrompt(session)}`
          : '\nEscribe el *plato* o el *código*.';
      await this.reply(conv, waId, `Listo, no lo agrego 👍${suffix}`);
      return true;
    }

    const bareSize = this.catalogService.isBareServingSizeReply(text);
    const sizeHint = this.catalogService.detectServingSizeHint(text);
    const acceptsOffer =
      this.isMultiOrderAffirmative(text) ||
      /^agrega(r|lo|los|las|me)?$/i.test(text.trim()) ||
      bareSize ||
      (!!sizeHint && text.trim().split(/\s+/).filter(Boolean).length <= 5);

    if (!acceptsOffer) {
      // Otro mensaje: soltar la oferta pendiente (no atrapar el chat)
      if (
        this.catalogService.isPriceInquiryIntent(text) ||
        this.catalogService.isGenericProductInquiry(text) ||
        this.catalogService.looksLikeExplicitAddProductRequest(text) ||
        this.catalogService.looksLikeClearlyMultiDishOrder(text) ||
        this.catalogService.looksLikeMultiItemOrderMessage(text) ||
        this.catalogService.countQuantityMentions(text) >= 2 ||
        looksLikeAddressOnlyMessage(text) ||
        isUpcomingAddressIntent(text) ||
        isPaymentCapabilityQuestion(text) ||
        findPaymentMethodByText(text, cfg.paymentMethods) ||
        this.catalogService.findProductEmbeddedInMessage(text, products)
      ) {
        session = { ...session, pendingAddOffer: undefined };
        await this.conversationService.saveSession(conv, session);
        return false;
      }
      return false;
    }

    const sourceText = (offer.sourceText || text || '').trim();
    const sizeSource =
      sizeHint || bareSize
        ? `${sourceText} ${text}`.trim()
        : sourceText;
    const multiIds =
      offer.productIds?.length && offer.productIds.length > 1
        ? offer.productIds
        : null;

    if (multiIds) {
      const offerProducts = multiIds
        .map((id) => this.catalogService.getProductById(id, products) || products.find((p) => p.id === id))
        .filter((p): p is MenuProduct => !!p && p.availableNow !== false);
      if (!offerProducts.length) {
        await this.conversationService.saveSession(conv, {
          ...session,
          pendingAddOffer: undefined,
        });
        await this.reply(conv, waId, 'Esos platos ya no están disponibles. ¿Probamos con otros?');
        return true;
      }

      const confident: MultiProductSegmentMatch[] = [];
      const needsAttributes: MultiProductSegmentMatch[] = [];
      for (const product of offerProducts) {
        const sized =
          (sizeHint === 'pequena' || bareSize
            ? this.catalogService.resolveSizedSoupProduct(`${product.name} pequeña`, products)
            : null) || product;
        const match = { segment: sizeSource, product: sized, score: 100 };
        if (sized.hasAttributes && sized.attributes?.length) {
          if (this.catalogService.extractExplicitAttributeChoice(sizeSource, sized)) {
            confident.push(match);
          } else {
            needsAttributes.push(match);
          }
        } else {
          confident.push(match);
        }
      }

      session = {
        ...session,
        pendingAddOffer: undefined,
        pendingMultiOrder: this.sessionFromMultiResolve({
          segments: [sizeSource],
          confident,
          needsAttributes,
          ambiguous: [],
          unresolved: [],
        }),
      };

      const added = await this.addPendingMultiConfidentToCart(
        conv,
        waId,
        session,
        cfg,
        products,
        sizeSource,
      );
      session = { ...added.session };
      if (added.blocked) {
        await this.conversationService.saveSession(conv, {
          ...session,
          pendingMultiOrder: undefined,
        });
        await this.handleCartLimitBlocked(conv, waId, added.blocked, cfg);
        return true;
      }

      const pending = session.pendingMultiOrder;
      if (pending?.needsAttributes?.length) {
        const nextItem = pending.needsAttributes[0];
        const nextProduct =
          this.catalogService.getProductById(nextItem.productId, products) ||
          products.find((p) => p.id === nextItem.productId);
        if (nextProduct) {
          session = {
            ...session,
            pendingMultiOrder: {
              ...pending,
              needsAttributes: pending.needsAttributes.slice(1),
              confident: [],
            },
            pendingAttribute: this.toPendingAttribute(nextProduct, {
              sourceText: nextItem.segment || sourceText,
            }),
          };
          await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
          const preface =
            added.addedNames.length > 0
              ? `Listo, agregué *${added.addedNames.join(', ')}* ✅\n\n`
              : '';
          await this.reply(
            conv,
            waId,
            `${preface}${this.catalogService.formatProductOptionsPrompt(
              nextProduct,
              [],
              this.attributeFlowOpts(session.pendingAttribute),
            )}`,
          );
          return true;
        }
      }

      session = { ...session, pendingMultiOrder: undefined };
      await this.conversationService.saveSession(conv, session, 'building_cart');
      const names = added.addedNames.length
        ? added.addedNames.join(', ')
        : offerProducts.map((p) => p.name).join(', ');
      await this.reply(
        conv,
        waId,
        this.buildCartAddReply(session, this.deliveryFeeFor(session, cfg), names),
      );
      return true;
    }

    const productBase =
      this.catalogService.getProductById(offer.productId, products) ||
      products.find((p) => p.id === offer.productId);
    if (!productBase || productBase.availableNow === false) {
      await this.conversationService.saveSession(conv, {
        ...session,
        pendingAddOffer: undefined,
      });
      await this.reply(
        conv,
        waId,
        'Ese plato ya no está disponible. ¿Probamos con otro?',
      );
      return true;
    }

    const product =
      (sizeHint === 'pequena' || bareSize
        ? this.catalogService.resolveSizedSoupProduct(
            `${productBase.name} pequeña`,
            products,
          )
        : null) ||
      (sizeHint === 'grande'
        ? this.catalogService.resolveSizedSoupProduct(
            `${productBase.name} grande`,
            products,
          )
        : null) ||
      productBase;

    if (product.hasAttributes && product.attributes?.length) {
      session = { ...session, pendingAddOffer: undefined };
      // Usar el texto de la cotización (menudencias / en salsa), no el "sí"
      if (await this.handleProductWithVariants(conv, waId, session, product, sizeSource, cfg)) {
        return true;
      }
    }

    const qty = Math.max(1, offer.quantity || 1);
    const added = this.tryAddProductToCart(session, product, qty, cfg, undefined, undefined, {
      sourceText: sizeSource || `${qty} ${product.name}`,
    });
    if (added.blocked) {
      await this.conversationService.saveSession(conv, {
        ...session,
        pendingAddOffer: undefined,
      });
      await this.handleCartLimitBlocked(conv, waId, added.blocked, cfg);
      return true;
    }

    session = { ...added.session, pendingAddOffer: undefined };
    await this.conversationService.saveSession(conv, session, 'building_cart');
    const qtyNote = qty > 1 ? ` ×${qty}` : '';
    await this.reply(
      conv,
      waId,
      this.buildCartAddReply(session, this.deliveryFeeFor(session, cfg), `${product.name}${qtyNote}`),
    );
    return true;
  }

  /** "Te mando la dirección" — no interpretar como platos; pedir la dirección. */
  private async tryHandleUpcomingAddressIntent(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    if (!isUpcomingAddressIntent(text)) return false;

    session = {
      ...session,
      orderType: 'delivery',
      fulfillmentChosen: true,
      pendingAddOffer: undefined,
      pendingMultiOrder: undefined,
      pendingMatch: undefined,
    };

    if (session.cart.length === 0) {
      await this.conversationService.saveSession(conv, session, 'building_cart');
      await this.reply(
        conv,
        waId,
        '¿Qué se te antoja? Escribe el *plato* o el *código*.',
      );
      return true;
    }

    await this.conversationService.saveSession(conv, session, 'awaiting_address');
    await this.reply(
      conv,
      waId,
      `Escribe la *dirección*.\n${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}`,
    );
    return true;
  }

  private async tryHandlePaymentCapabilityQuestion(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    if (!isPaymentCapabilityQuestion(text)) return false;

    const enabled = getEnabledPaymentMethods(cfg.paymentMethods || []);
    const hasMp = enabled.some((m) => m.id === 'mercadopago' || m.flow === 'mercadopago');
    const asksCard = /\btarjeta|credito|crédito|d[eé]bito|datafono|dat[aá]fono\b/i.test(text);

    const lines: string[] = [];
    if (asksCard) {
      if (hasMp) {
        lines.push(
          'Sí: con *Mercado Pago* te mandamos un *link* y puedes pagar con *tarjeta* (débito/crédito) desde el celular.',
        );
        lines.push('_No tenemos datáfono a domicilio; es pago por link._');
      } else {
        lines.push(
          'Por WhatsApp *no* recibimos tarjeta/datáfono presencial.',
        );
      }
    } else {
      lines.push('Claro, te cuento cómo puedes pagar:');
    }

    if (enabled.length) {
      lines.push('');
      lines.push('*Métodos disponibles:*');
      for (const m of enabled) {
        lines.push(`• ${m.optionText || `*${m.label}*`}`);
      }
    }

    const payHint = (cfg.paymentInstructions || '').trim();
    if (payHint) {
      lines.push('');
      lines.push(`_${payHint}_`);
    }

    if (session.cart.length > 0) {
      lines.push('');
      lines.push('Escribe *confirmar* y te pido el método, o di ya *nequi* / *contraentrega*.');
    } else {
      lines.push('');
      lines.push('Cuando armes el pedido te pido el método al *confirmar*.');
    }

    // No mutar paymentMethod ni abrir checkout
    if (session.pendingAddOffer) {
      await this.conversationService.saveSession(conv, {
        ...session,
        pendingAddOffer: undefined,
      });
    }

    await this.reply(conv, waId, lines.join('\n'));
    return true;
  }

  private toPendingMultiProduct(p: MenuProduct) {
    return {
      productId: p.id,
      name: p.name,
      code: p.code,
      price: p.price,
    };
  }

  private formatMultiOrderProposal(multi: MultiProductResolveResult): string {
    const lines: string[] = ['📝 *Entendí varios platos en tu mensaje:*\n'];
    let idx = 1;
    for (const c of multi.confident) {
      const qty = this.catalogService.extractQuantityFromSegment(c.segment);
      const qtyLabel = qty >= 2 ? ` ×${qty}` : '';
      lines.push(`${this.catalogService.optionNumberEmoji(idx)} ✅ *${c.product.name}${qtyLabel}*`);
      lines.push(`   ${this.catalogService.formatProductMeta(c.product.price, c.product.code)}`);
      if (c.note) lines.push(`   _${c.note}_`);
      idx++;
    }
    for (const group of multi.ambiguous) {
      lines.push(`\n❓ Sobre *${group.segment}*, ¿cuál te gusta?`);
      group.candidates.forEach((c, i) => {
        lines.push(`${this.catalogService.optionNumberEmoji(i + 1)} *${c.name}*`);
        lines.push(`   ${this.catalogService.formatProductMeta(c.price, c.code)}`);
      });
    }
    for (const item of multi.needsAttributes) {
      lines.push(
        `\n🔸 *${item.product.name}${
          this.catalogService.extractQuantityFromSegment(item.segment) >= 2
            ? ` ×${this.catalogService.extractQuantityFromSegment(item.segment)}`
            : ''
        }*`,
        `   ${this.catalogService.formatProductMeta(item.product.price, item.product.code)}`,
        `   _Hay que elegir opciones después._`,
      );
    }
    for (const miss of multi.unresolved) {
      lines.push(`\n⚠️ Por ahora no manejamos: _${miss}_`);
    }
    // Una sola CTA: si hay dudas ❓, solo elegir; si todo ✅, solo confirmar
    if (multi.ambiguous.length > 0) {
      lines.push('\n_Elige *número* o nombre (ej. *broaster*)._');
      if (multi.confident.length > 0) {
        lines.push('_Lo marcado ✅ queda listo cuando resuelvas la duda._');
      }
    } else if (multi.needsAttributes.length > 0) {
      lines.push('\n_Cuando puedas, aclara lo pendiente o escribe *sí* para lo ✅._');
    } else if (multi.unresolved.length > 0) {
      lines.push('\n_El resto, si está bien, escribe *sí*._');
    } else {
      lines.push('\n_Si está bien, escribe *sí*._');
    }
    return lines.join('\n');
  }

  private sessionFromMultiResolve(multi: MultiProductResolveResult): WhatsappSessionData['pendingMultiOrder'] {
    return {
      confident: multi.confident.map((c) => ({
        segment: c.segment,
        note: c.note,
        ...this.toPendingMultiProduct(c.product),
      })),
      ambiguous: multi.ambiguous.map((a) => ({
        segment: a.segment,
        candidates: a.candidates.map((p) => ({
          id: p.id,
          name: p.name,
          code: p.code,
          price: p.price,
          description: p.description,
          categoryName: p.categoryName,
          hasAttributes: p.hasAttributes,
          attributes: p.attributes,
          availableNow: p.availableNow,
        })),
      })),
      needsAttributes: multi.needsAttributes.map((c) => ({
        segment: c.segment,
        ...this.toPendingMultiProduct(c.product),
      })),
      unresolved: multi.unresolved,
    };
  }

  private async addPendingMultiConfidentToCart(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    cfg: EffectiveWhatsappConfig,
    products: MenuProduct[],
    sourceText?: string,
  ): Promise<{ session: WhatsappSessionData; addedNames: string[]; blocked?: CartLimitCheck }> {
    const pending = session.pendingMultiOrder;
    if (!pending?.confident.length) {
      return { session, addedNames: [] };
    }
    if (sourceText && this.catalogService.askedForOneComboEach(sourceText)) {
      const collapsed = this.catalogService.keepCombosWhenBothRequested(
        sourceText,
        products,
        pending.confident.map((item) => ({
          productId: item.productId,
          quantity: 1,
        })),
      );
      pending.confident = collapsed.flatMap((item) => {
        const product = products.find((p) => p.id === item.productId);
        if (!product) return [];
        const prev = pending.confident.find((c) => c.productId === item.productId);
        return [
          {
            segment: prev?.segment || sourceText,
            note: prev?.note,
            productId: product.id,
            name: product.name,
            code: product.code,
            price: product.price,
          },
        ];
      });
    }
    let next = { ...session };
    const addedNames: string[] = [];
    for (const item of pending.confident) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) continue;
      const attrSource = [item.segment, sourceText].filter(Boolean).join(' ');
      const qty =
        sourceText &&
        this.catalogService.askedForOneComboEach(sourceText) &&
        /\bcombo\b/i.test(product.name)
          ? 1
          : this.quantityForMultiSegment(item.segment, product.name, sourceText);
      const swap = sourceText ? this.catalogService.swapIntent(sourceText) : null;
      const carriesSwap = !!swap && this.catalogService.productCarriesMention(product, swap.removed);
      const explicit =
        product.hasAttributes && product.attributes?.length
          ? this.catalogService.extractExplicitAttributeChoice(attrSource, product) || []
          : [];
      const filled =
        product.hasAttributes && product.attributes?.length
          ? this.catalogService.fillDefaultAttributes(product, explicit)
          : explicit;
      const attrs = filled.length ? filled : undefined;
      if (
        product.hasAttributes &&
        product.attributes?.length &&
        !this.catalogService.isAttributeSelectionComplete(product, filled)
      ) {
        // No agregar sin opciones: pasar a cola de atributos
        next = {
          ...next,
          pendingMultiOrder: {
            ...(next.pendingMultiOrder || pending),
            confident: (next.pendingMultiOrder || pending).confident.filter(
              (c) => c.productId !== product.id,
            ),
            needsAttributes: [
              ...((next.pendingMultiOrder || pending).needsAttributes || []),
              { segment: item.segment, ...this.toPendingMultiProduct(product) },
            ],
          },
        };
        continue;
      }
      const lineNote =
        item.note ||
        (carriesSwap && swap
          ? this.catalogService.swapChangeNote(swap.removed, swap.added)
          : undefined);
      const attempt = this.tryAddProductToCart(next, product, qty, cfg, lineNote, attrs, {
        sourceText,
      });
      if (attempt.missingAttributes) {
        next = {
          ...next,
          pendingMultiOrder: {
            ...(next.pendingMultiOrder || pending),
            confident: (next.pendingMultiOrder || pending).confident.filter(
              (c) => c.productId !== product.id,
            ),
            needsAttributes: [
              ...((next.pendingMultiOrder || pending).needsAttributes || []),
              { segment: item.segment, ...this.toPendingMultiProduct(product) },
            ],
          },
        };
        continue;
      }
      if (attempt.blocked) {
        return { session: next, addedNames, blocked: attempt.blocked };
      }
      next = attempt.session;
      const label = attrs?.length
        ? `${product.name} (${attrs.map((a) => a.attributeValue).join(', ')})`
        : product.name;
      addedNames.push(this.formatAddedProductLabel(label, qty));
    }
    return { session: next, addedNames };
  }

  /**
   * "Quiero un pollo frito con gaseosa manzana" → Combo De Pollo Frito (trae bebida),
   * no listar 9 porciones de pollo sueltas.
   */
  private async tryPreferChickenComboForFoodDrink(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    products: MenuProduct[],
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    if (!this.catalogService.looksLikeFoodPlusDrinkOrder(text)) return false;
    const q = text.toLowerCase();
    if (!/\bpollo\b/.test(q)) return false;
    // Si ya pidió combo explícito, deja el flujo normal
    if (/\bcombo\b/.test(q)) return false;
    // Porción explícita (medio/cuarto) → no forzar combo entero
    if (/\b(medio|media|cuarto|1\s*\/\s*2|1\s*\/\s*4)\b/.test(q)) return false;

    const style = /\bbroaster\b/.test(q)
      ? 'broaster'
      : /\bfrito\b/.test(q)
        ? 'frito'
        : null;
    if (!style) return false;

    const combo =
      products.find(
        (p) =>
          p.availableNow !== false &&
          /\bcombo\b/i.test(p.name) &&
          /\bpollo\b/i.test(p.name) &&
          new RegExp(`\\b${style}\\b`, 'i').test(p.name),
      ) || null;
    if (!combo) return false;

    session = this.applyDeliveryHintFromMessage(session, text);
    if (combo.hasAttributes && combo.attributes?.length) {
      if (await this.handleProductWithVariants(conv, waId, session, combo, text, cfg)) {
        return true;
      }
    }
    const added = this.tryAddProductToCart(session, combo, 1, cfg, undefined, undefined, {
      sourceText: text,
    });
    if (added.blocked) {
      await this.conversationService.saveSession(conv, session);
      await this.handleCartLimitBlocked(conv, waId, added.blocked, cfg);
      return true;
    }
    session = added.session;
    await this.conversationService.saveSession(conv, session, 'building_cart');
    await this.reply(
      conv,
      waId,
      `Como pediste *pollo ${style}* con bebida, te conviene el *${combo.name}* (cód. ${combo.code}) ✅\n\n` +
        this.buildCartAddReply(session, this.deliveryFeeFor(session, cfg), combo.name, {
          extraLine: '_Si preferías el pollo suelto + gaseosa aparte, dímelo y lo armamos así._',
        }),
    );
    return true;
  }

  private async tryHandleMultiProductOrder(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    multi: MultiProductResolveResult,
    cfg: EffectiveWhatsappConfig,
    text: string,
    products: MenuProduct[],
    /** Texto completo del mensaje (antes de cortar "para …") */
    fullTextForDelivery?: string,
  ): Promise<boolean> {
    const foodHits =
      multi.confident.length +
      multi.ambiguous.length +
      multi.needsAttributes.length +
      multi.unresolved.length;
    if (foodHits === 0) return false;

    // Nombre detectado en el mismo mensaje que los platos (ej. "Natalia seria un arroz…")
    // No usar platos del menú como nombre (ajiaco, mondongo…)
    const inferredName = multi.possibleCustomerNames?.[0]?.trim();
    if (
      inferredName &&
      !isUsableWhatsappCustomerName(conv.customerName || '') &&
      isUsableWhatsappCustomerName(inferredName) &&
      !this.catalogService.findProductEmbeddedInMessage(inferredName, products) &&
      this.catalogService.looksLikePersonNameSegment(inferredName)
    ) {
      await this.conversationService.updateCustomerName(conv, inferredName);
      const freshName = await this.conversationService.reloadConversation(conv.id);
      Object.assign(conv, freshName);
    }

    const deliverySource = (fullTextForDelivery || text || '').trim();
    const deliveryTail =
      this.extractDeliveryTail(deliverySource) ||
      (deliverySource !== text ? this.extractDeliveryTail(text) : null);
    if (deliveryTail) {
      session = this.withDeliveryAddress(session, deliveryTail);
    }
    {
      const feeEarly = await this.ensureDeliveryFeeQuoted(session, cfg);
      session = feeEarly.session;
      if (feeEarly.blocked) {
        await this.conversationService.saveSession(conv, session);
        await this.reply(conv, waId, feeEarly.blocked);
        return true;
      }
    }
    if (this.catalogService.looksLikeFoodPlusDrinkOrder(text) && multi.unresolved.length) {
      const stillUnresolved: string[] = [];
      for (const seg of multi.unresolved) {
        let foodProduct: MenuProduct | undefined;
        const embedded = this.catalogService.findProductEmbeddedInMessage(seg, products);
        if (embedded && !this.catalogService.isLikelyDrinkProduct(embedded)) {
          foodProduct = embedded;
        }
        if (!foodProduct) {
          const queries = [seg, 'pollo broaster', 'broaster', 'pollo frito'].filter(
            (q, i, arr) => arr.indexOf(q) === i,
          );
          for (const q of queries) {
            const hit = this.catalogService
              .searchByNameScored(q, products, 6)
              .find((x) => !this.catalogService.isLikelyDrinkProduct(x.p));
            if (hit && hit.score >= 30) {
              foodProduct = hit.p;
              break;
            }
          }
        }
        if (!foodProduct) {
          stillUnresolved.push(seg);
          continue;
        }
        const match = { segment: seg, product: foodProduct, score: 100 };
        if (foodProduct.hasAttributes && foodProduct.attributes?.length) {
          const attrText = `${seg} ${text}`;
          if (this.catalogService.extractExplicitAttributeChoice(attrText, foodProduct)) {
            multi.confident.push({ ...match, segment: attrText });
          } else {
            multi.needsAttributes.push(match);
          }
        } else {
          multi.confident.push(match);
        }
      }
      multi.unresolved = stillUnresolved;
    }

    const onlyNeedsAttrs =
      multi.needsAttributes.length > 0 && multi.ambiguous.length === 0;
    const missNote = multi.unresolved.length
      ? `Por ahora no manejamos: _${multi.unresolved.join(' · ')}_.\n\n`
      : '';

    const drinkFirstFoodPending =
      this.catalogService.looksLikeFoodPlusDrinkOrder(text) &&
      multi.confident.length >= 1 &&
      multi.confident.every((c) => this.catalogService.isLikelyDrinkProduct(c.product)) &&
      (multi.needsAttributes.length > 0 || multi.unresolved.length > 0) &&
      multi.ambiguous.length === 0;

    // Comida + gaseosa aparte: solo la COMIDA va en modalidad "solo"
    // (no aplicar a la gaseosa: debe pedir sabor/variante)
    const isFoodPlusDrink = this.catalogService.looksLikeFoodPlusDrinkOrder(text);
    const drinkTail = this.catalogService.splitFoodPlusDrinkSegments(text)[1] || '';
    const drinkIsComboOption =
      !!drinkTail &&
      [...multi.confident, ...multi.needsAttributes].some((m) =>
        this.catalogService.drinkTextMatchesAttribute(m.product, drinkTail),
      );
    const attrOptsFor = (product: MenuProduct): { variantIntent: 'solo' } | undefined =>
      isFoodPlusDrink &&
      !drinkIsComboOption &&
      !this.catalogService.isLikelyDrinkProduct(product)
        ? { variantIntent: 'solo' }
        : undefined;

    const needsConfirm =
      multi.ambiguous.length > 0 ||
      (multi.unresolved.length > 0 && !drinkFirstFoodPending);

    const readyToAddWithoutConfirm =
      !needsConfirm &&
      multi.confident.length >= 1 &&
      multi.ambiguous.length === 0 &&
      multi.unresolved.length === 0;

    if (readyToAddWithoutConfirm || onlyNeedsAttrs || drinkFirstFoodPending) {
      session = {
        ...session,
        pendingMultiOrder: this.sessionFromMultiResolve(multi),
        pendingMatch: undefined,
      };
      const addResult = await this.addPendingMultiConfidentToCart(
        conv,
        waId,
        session,
        cfg,
        products,
        text,
      );
      if (addResult.blocked) {
        await this.conversationService.saveSession(conv, addResult.session);
        await this.handleCartLimitBlocked(conv, waId, addResult.blocked, cfg);
        return true;
      }

      let next = addResult.session;
      const pendingAfter = next.pendingMultiOrder;
      const needsQueue = pendingAfter?.needsAttributes?.length
        ? pendingAfter.needsAttributes
        : multi.needsAttributes.map((c) => ({
            segment: c.segment,
            ...this.toPendingMultiProduct(c.product),
          }));

      if (needsQueue.length) {
        const first = needsQueue[0];
        const product = products.find((p) => p.id === first.productId);
        if (product?.hasAttributes && product.attributes?.length) {
          const productAttrOpts = attrOptsFor(product);
          // Usar el segmento de comida (sin “con gaseosa”) para no confundir atributos del combo
          const foodAttrText = productAttrOpts
            ? first.segment
            : `${first.segment} ${text}`;
          const step = this.catalogService.applyDefaultAttributeStep(
            product,
            this.catalogService.coerceAttributeStep(
              product,
              this.catalogService.resolveAttributesFromMessage(
                product,
                foodAttrText,
                [],
                productAttrOpts,
              ),
              productAttrOpts,
            ),
            productAttrOpts,
          );
          if (step.status === 'complete') {
            const attrQty = this.quantityForMultiSegment(first.segment, product.name, text);
            const attempt = this.tryAddProductToCart(
              next,
              product,
              attrQty,
              cfg,
              undefined,
              step.attributes,
              productAttrOpts,
            );
            if (attempt.missingAttributes) {
              next = this.buildPendingAttributeSession(
                next,
                product,
                attempt.missingAttributes,
                {
                  sourceText: foodAttrText,
                  variantIntent: productAttrOpts?.variantIntent,
                  pendingMultiOrder: {
                    confident: [],
                    ambiguous: [],
                    unresolved: [],
                    needsAttributes: needsQueue,
                  },
                },
              );
              await this.conversationService.saveSession(conv, next, 'awaiting_attribute');
              const prefix =
                missNote +
                (addResult.addedNames.length
                  ? this.buildCartAddReply(next, this.deliveryFeeFor(next, cfg), addResult.addedNames, {
                      suffix: '',
                    }) + '\n\n'
                  : '');
              await this.reply(
                conv,
                waId,
                `${prefix}Ahora elige opciones para *${product.name}*:\n\n` +
                  this.catalogService.formatProductOptionsPrompt(
                    product,
                    attempt.missingAttributes,
                    productAttrOpts,
                  ),
              );
              return true;
            }
            if (attempt.blocked) {
              await this.conversationService.saveSession(conv, next);
              await this.handleCartLimitBlocked(conv, waId, attempt.blocked, cfg);
              return true;
            }
            next = {
              ...attempt.session,
              pendingMultiOrder:
                needsQueue.length > 1
                  ? {
                      confident: [],
                      ambiguous: [],
                      unresolved: [],
                      needsAttributes: needsQueue.slice(1),
                    }
                  : undefined,
              pendingAttribute: undefined,
            };
            const rest = needsQueue.slice(1);
            if (rest.length) {
              const nextProd = products.find((p) => p.id === rest[0].productId);
              if (nextProd?.hasAttributes) {
                const nextAttrOpts = attrOptsFor(nextProd);
                const preText = nextAttrOpts
                  ? rest[0].segment
                  : `${rest[0].segment} ${text}`;
                const preRaw = this.catalogService.resolveAttributesFromMessage(
                  nextProd,
                  preText,
                  [],
                  nextAttrOpts,
                );
                const pre = this.catalogService.applyDefaultAttributeStep(
                  nextProd,
                  preRaw.status === 'invalid' ? { status: 'invalid' } : preRaw,
                  nextAttrOpts,
                );
                if (pre.status === 'complete') {
                  const nextQty = this.quantityForMultiSegment(rest[0].segment, nextProd.name, text);
                  const nextAdd = this.tryAddProductToCart(
                    next,
                    nextProd,
                    nextQty,
                    cfg,
                    undefined,
                    pre.attributes,
                    nextAttrOpts,
                  );
                  if (!nextAdd.missingAttributes && !nextAdd.blocked) {
                    const more = rest.slice(1);
                    next = {
                      ...nextAdd.session,
                      pendingAttribute: undefined,
                      pendingMultiOrder: more.length
                        ? {
                            confident: [],
                            ambiguous: [],
                            unresolved: [],
                            needsAttributes: more,
                          }
                        : undefined,
                    };
                    await this.conversationService.saveSession(conv, next, 'building_cart');
                    const nextChosen = pre.attributes.map((a) => a.attributeValue).join(', ');
                    await this.reply(
                      conv,
                      waId,
                      this.buildCartAddReply(
                        next,
                        this.deliveryFeeFor(next, cfg),
                        [
                          ...addResult.addedNames,
                          `${product.name} (${step.attributes.map((a) => a.attributeValue).join(', ')})`,
                          `${nextProd.name} (${nextChosen})`,
                        ],
                        {
                          extraLine: deliveryTail
                            ? `\nDomicilio anotado: _${deliveryTail}_`
                            : undefined,
                        },
                      ),
                    );
                    return true;
                  }
                }
                next = {
                  ...next,
                  pendingAttribute: {
                    ...this.toPendingAttribute(nextProd, {
                      sourceText: preText,
                      variantIntent: nextAttrOpts?.variantIntent,
                      selected: pre.status === 'partial' ? pre.attributes : [],
                    }),
                  },
                  pendingMultiOrder: {
                    confident: [],
                    ambiguous: [],
                    unresolved: [],
                    needsAttributes: rest,
                  },
                };
                await this.conversationService.saveSession(conv, next, 'awaiting_attribute');
                const chosen = step.attributes.map((a) => a.attributeValue).join(', ');
                await this.reply(
                  conv,
                  waId,
                  `${this.buildCartAddReply(
                    next,
                    this.deliveryFeeFor(next, cfg),
                    [
                      ...addResult.addedNames,
                      `${product.name} (${chosen})`,
                    ],
                    { suffix: '' },
                  )}\n\nAhora elige opciones para *${nextProd.name}*:\n\n` +
                    this.catalogService.formatProductOptionsPrompt(
                      nextProd,
                      pre.status === 'partial' ? pre.attributes : [],
                      nextAttrOpts,
                    ),
                );
                return true;
              }
            }
            await this.conversationService.saveSession(conv, next, 'building_cart');
            const chosen = step.attributes.map((a) => a.attributeValue).join(', ');
            await this.reply(
              conv,
              waId,
              this.buildCartAddReply(next, this.deliveryFeeFor(next, cfg), [
                ...addResult.addedNames,
                `${product.name} (${chosen})`,
              ], {
                extraLine: deliveryTail ? `\nDomicilio anotado: _${deliveryTail}_` : undefined,
              }),
            );
            return true;
          }

          next = {
            ...next,
            pendingAttribute: {
              ...this.toPendingAttribute(product, {
                sourceText: foodAttrText,
                variantIntent: productAttrOpts?.variantIntent,
                selected: step.status === 'partial' ? step.attributes : [],
              }),
            },
            pendingMultiOrder: {
              confident: [],
              ambiguous: [],
              unresolved: [],
              needsAttributes: needsQueue,
            },
          };
          await this.conversationService.saveSession(conv, next, 'awaiting_attribute');
          const prefix =
            missNote +
            (addResult.addedNames.length
              ? this.buildCartAddReply(next, this.deliveryFeeFor(next, cfg), addResult.addedNames, {
                  suffix: '',
                }) + '\n\n'
              : next.cart.length
                ? `${this.formatCartOnly(next, this.deliveryFeeFor(next, cfg))}\n\n`
                : '');
          await this.reply(
            conv,
            waId,
            `${prefix}Ahora elige opciones para *${product.name}*:\n\n` +
              this.catalogService.formatProductOptionsPrompt(
                product,
                step.status === 'partial' ? step.attributes : [],
                productAttrOpts,
              ),
          );
          return true;
        }
      }

      await this.conversationService.saveSession(conv, { ...next, pendingMultiOrder: undefined }, 'building_cart');
      if (addResult.addedNames.length) {
        await this.reply(
          conv,
          waId,
          this.buildCartAddReply(next, this.deliveryFeeFor(next, cfg), addResult.addedNames, {
            extraLine: deliveryTail ? `\nDomicilio anotado: _${deliveryTail}_` : undefined,
          }),
        );
      }
      return true;
    }

    session = {
      ...session,
      pendingMultiOrder: this.sessionFromMultiResolve(multi),
      pendingMatch: undefined,
    };
    const focusProduct =
      multi.confident[0]?.product ||
      multi.needsAttributes[0]?.product ||
      multi.ambiguous[0]?.candidates?.[0];
    if (focusProduct) {
      session = this.rememberProductFocus(session, focusProduct, products);
    }
    await this.conversationService.saveSession(conv, session, 'building_cart');
    await this.reply(conv, waId, this.formatMultiOrderProposal(multi));
    return true;
  }

  /** "Me faltó la milanesa y eran dos churrascos" ajusta el multi abierto. */
  private async tryAmendPendingMultiFromCorrection(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    products: MenuProduct[],
  ): Promise<boolean> {
    const current = session.pendingMultiOrder;
    if (!current || !this.catalogService.isPendingOrderCorrection(text)) return false;
    const clauses = this.catalogService.orderCorrectionClauses(text);
    if (!clauses.length) return false;

    const pending: NonNullable<WhatsappSessionData['pendingMultiOrder']> = {
      confident: current.confident.map((c) => ({ ...c })),
      ambiguous: current.ambiguous.map((a) => ({
        ...a,
        candidates: a.candidates.map((c) => ({ ...c })),
      })),
      needsAttributes: current.needsAttributes.map((c) => ({ ...c })),
      unresolved: [...current.unresolved],
    };
    const notes: string[] = [];

    for (const clause of clauses) {
      const lines = [...pending.confident, ...pending.needsAttributes].filter((line) =>
        this.catalogService.menuNameMatchesDishQuery(line.name, clause.dish),
      );
      if (lines.length && clause.quantity >= 2) {
        for (const line of lines) line.segment = `${clause.quantity} ${line.name}`;
        notes.push(`*${lines[0].name}* queda en ×${clause.quantity}`);
        continue;
      }
      if (lines.length) {
        notes.push(`*${lines[0].name}* ya estaba`);
        continue;
      }

      const segment = clause.quantity >= 2 ? `${clause.quantity} ${clause.dish}` : clause.dish;
      const style = this.catalogService.chickenStyleChoicesForSegment(segment, products);
      if (style?.length) {
        pending.ambiguous.push({ segment, candidates: style });
        notes.push(`falta el estilo de *${clause.dish}*`);
        continue;
      }

      const product = this.catalogService.resolveSpokenDish(clause.dish, products);
      if (!product) {
        pending.unresolved.push(clause.dish);
        notes.push(`no veo *${clause.dish}* en la carta`);
        continue;
      }
      const entry = { segment, ...this.toPendingMultiProduct(product) };
      if (product.hasAttributes && product.attributes?.length) pending.needsAttributes.push(entry);
      else pending.confident.push(entry);
      notes.push(
        `sumé *${product.name}*${clause.quantity >= 2 ? ` ×${clause.quantity}` : ''}`,
      );
    }

    session = { ...session, pendingMultiOrder: pending };
    await this.conversationService.saveSession(conv, session, 'building_cart');
    const proposal = this.formatMultiOrderProposal({
      segments: [],
      confident: pending.confident.map((c) => ({
        segment: c.segment,
        product: products.find((p) => p.id === c.productId) || {
          id: c.productId,
          code: c.code,
          name: c.name,
          price: c.price,
        },
        score: 100,
      })),
      ambiguous: pending.ambiguous.map((a) => ({
        segment: a.segment,
        candidates: a.candidates as MenuProduct[],
      })),
      unresolved: pending.unresolved,
      needsAttributes: pending.needsAttributes.map((c) => ({
        segment: c.segment,
        product: products.find((p) => p.id === c.productId) || {
          id: c.productId,
          code: c.code,
          name: c.name,
          price: c.price,
        },
        score: 100,
      })),
    });
    await this.reply(conv, waId, `${notes.join('\n')}\n\n${proposal}`);
    return true;
  }

  private async tryResolvePendingMultiOrder(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    products: MenuProduct[],
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    const pending = session.pendingMultiOrder;
    if (!pending) return false;

    if (await this.tryAmendPendingMultiFromCorrection(conv, waId, session, text, products)) {
      return true;
    }

    const dishClaim = this.catalogService.followUpDishClaim(text, pending.unresolved);
    if (dishClaim) {
      const product = this.catalogService.productByDishMention(dishClaim, products);
      if (product) {
        const claimNorm = this.normalizeForMatch(dishClaim);
        const nextUnresolved = pending.unresolved.filter(
          (u) => this.normalizeForMatch(u) !== claimNorm,
        );
        const entry = { segment: dishClaim, ...this.toPendingMultiProduct(product) };
        const filled = this.catalogService.fillDefaultAttributes(product, []);
        const stillOpen = !this.catalogService.isAttributeSelectionComplete(product, filled);
        const nextPending: NonNullable<WhatsappSessionData['pendingMultiOrder']> = {
          ...pending,
          unresolved: nextUnresolved,
          confident: stillOpen ? pending.confident : [...pending.confident, entry],
          needsAttributes: stillOpen
            ? [...pending.needsAttributes, entry]
            : pending.needsAttributes,
        };
        session = { ...session, pendingMultiOrder: nextPending };
        await this.conversationService.saveSession(conv, session, 'building_cart');
        await this.reply(
          conv,
          waId,
          `Sí, *${product.name}* sí está. La dejo en el pedido.\n\n` +
            this.formatMultiOrderProposal({
              segments: [],
              confident: nextPending.confident.map((c) => ({
                segment: c.segment,
                product: products.find((p) => p.id === c.productId) || product,
                score: 100,
              })),
              ambiguous: nextPending.ambiguous.map((a) => ({
                segment: a.segment,
                candidates: a.candidates as MenuProduct[],
              })),
              unresolved: nextPending.unresolved,
              needsAttributes: nextPending.needsAttributes.map((c) => ({
                segment: c.segment,
                product: products.find((p) => p.id === c.productId) || product,
                score: 100,
              })),
            }),
        );
        return true;
      }
      const menuUrl = (cfg.menuUrl || '').trim();
      await this.reply(
        conv,
        waId,
        `Lo siento, no tenemos *${dishClaim}* en la carta.` +
          (menuUrl ? `\nMenú: ${menuUrl}` : '') +
          `\n\nSeguimos con lo demás. Si está bien, escribe *sí*.\n\n` +
          this.formatMultiOrderProposal({
            segments: [],
            confident: pending.confident.map((c) => ({
              segment: c.segment,
              product: products.find((p) => p.id === c.productId) || {
                id: c.productId,
                code: c.code,
                name: c.name,
                price: c.price,
              },
              score: 100,
            })),
            ambiguous: pending.ambiguous.map((a) => ({
              segment: a.segment,
              candidates: a.candidates as MenuProduct[],
            })),
            unresolved: pending.unresolved,
            needsAttributes: pending.needsAttributes.map((c) => ({
              segment: c.segment,
              product: products.find((p) => p.id === c.productId) || {
                id: c.productId,
                code: c.code,
                name: c.name,
                price: c.price,
              },
              score: 100,
            })),
          }),
      );
      return true;
    }

    const lower = text.trim().toLowerCase();
    const numPick = /^[1-9]\d*$/.test(lower) ? parseInt(lower, 10) : null;

    // “Con gaseosa” mientras falta elegir frito/broaster → anotar y re-preguntar
    if (
      this.catalogService.isDrinkOnlyAccompanimentMessage(text) &&
      (pending.ambiguous.length > 0 || pending.unresolved.length > 0)
    ) {
      const drinkNote = text.trim().replace(/^(con|y)\s+/i, '').slice(0, 80);
      session = {
        ...session,
        customerNotes: [session.customerNotes?.trim(), drinkNote]
          .filter(Boolean)
          .join(' · ')
          .slice(0, 400),
      };
      await this.conversationService.saveSession(conv, session);
      await this.reply(
        conv,
        waId,
        `Dale, anoté *${drinkNote}* 👍\n\n` +
          `Primero termina de elegir el pollo 👇\n\n` +
          this.formatMultiOrderProposal({
            segments: [],
            confident: pending.confident.map((c) => ({
              segment: c.segment,
              product: products.find((p) => p.id === c.productId)!,
              score: 100,
            })),
            ambiguous: pending.ambiguous.map((a) => ({
              segment: a.segment,
              candidates: a.candidates as MenuProduct[],
            })),
            unresolved: pending.unresolved,
            needsAttributes: pending.needsAttributes.map((c) => ({
              segment: c.segment,
              product: products.find((p) => p.id === c.productId)!,
              score: 100,
            })),
          }),
      );
      return true;
    }

    if (pending.ambiguous.length) {
      const group = pending.ambiguous[0];
      const textChosen =
        !numPick
          ? this.catalogService.pickFromCandidateList(
              text,
              group.candidates as MenuProduct[],
            )
          : null;
      const chosenFromNum =
        numPick && numPick <= group.candidates.length
          ? group.candidates[numPick - 1]
          : null;
      const chosenRaw = textChosen || chosenFromNum;
      if (chosenRaw) {
        const full = products.find((p) => p.id === chosenRaw.id) || (chosenRaw as MenuProduct);
        const nextAmb = pending.ambiguous.slice(1);
        if (!nextAmb.length && !pending.unresolved.length) {
          const extras = [...pending.confident, ...pending.needsAttributes].filter(
            (item) => item.productId !== full.id,
          );
          const items = [
            { product: full, segment: group.segment || full.name, note: undefined as string | undefined },
            ...extras.map((item) => {
              const product =
                products.find((p) => p.id === item.productId) ||
                ({
                  id: item.productId,
                  code: item.code,
                  name: item.name,
                  price: item.price,
                  hasAttributes: false,
                  attributes: [],
                  availableNow: true,
                } as MenuProduct);
              return { product, segment: item.segment, note: item.note };
            }),
          ];
          return this.addResolvedDishesToCart(conv, waId, session, items, cfg);
        }
        const nextConfident = [
          ...pending.confident,
          { segment: group.segment, ...this.toPendingMultiProduct(full) },
        ];
        session = {
          ...session,
          pendingMultiOrder: {
            ...pending,
            confident: nextConfident,
            ambiguous: nextAmb,
          },
        };
        if (full.hasAttributes && full.attributes?.length) {
          session.pendingMultiOrder!.needsAttributes = [
            ...session.pendingMultiOrder!.needsAttributes,
            { segment: group.segment, ...this.toPendingMultiProduct(full) },
          ];
          session.pendingMultiOrder!.confident = session.pendingMultiOrder!.confident.filter(
            (c) => c.productId !== full.id,
          );
        }
        await this.conversationService.saveSession(conv, session);
        if (
          session.pendingMultiOrder!.ambiguous.length ||
          session.pendingMultiOrder!.unresolved.length ||
          session.pendingMultiOrder!.needsAttributes.length
        ) {
          await this.reply(
            conv,
            waId,
            `Listo, *${full.name}* ✅\n\n` +
              this.formatMultiOrderProposal({
                segments: [],
                confident: session.pendingMultiOrder!.confident.map((c) => ({
                  segment: c.segment,
                  product: products.find((p) => p.id === c.productId)!,
                  score: 100,
                })),
                ambiguous: session.pendingMultiOrder!.ambiguous.map((a) => ({
                  segment: a.segment,
                  candidates: a.candidates as MenuProduct[],
                })),
                unresolved: session.pendingMultiOrder!.unresolved,
                needsAttributes: session.pendingMultiOrder!.needsAttributes.map((c) => ({
                  segment: c.segment,
                  product: products.find((p) => p.id === c.productId)!,
                  score: 100,
                })),
              }),
          );
          return true;
        }
        // all clear now — fall through to affirmative add below
        pending.confident = session.pendingMultiOrder!.confident;
        pending.ambiguous = [];
        pending.unresolved = session.pendingMultiOrder!.unresolved;
        pending.needsAttributes = session.pendingMultiOrder!.needsAttributes;
      }
    }

    if (this.isMultiOrderAffirmative(text) && pending.confident.length) {
      // "sí" con opciones dudosas abiertas → no agregar aún (evita perder el 1/4)
      if (pending.ambiguous.length) {
        await this.conversationService.saveSession(conv, session);
        await this.reply(
          conv,
          waId,
          `Todavía falta elegir lo dudoso 👇\n\n` +
            this.formatMultiOrderProposal({
              segments: [],
              confident: pending.confident.map((c) => ({
                segment: c.segment,
                product: products.find((p) => p.id === c.productId)!,
                score: 100,
              })),
              ambiguous: pending.ambiguous.map((a) => ({
                segment: a.segment,
                candidates: a.candidates as MenuProduct[],
              })),
              unresolved: pending.unresolved,
              needsAttributes: pending.needsAttributes.map((c) => ({
                segment: c.segment,
                product: products.find((p) => p.id === c.productId)!,
                score: 100,
              })),
            }),
        );
        return true;
      }

      const addResult = await this.addPendingMultiConfidentToCart(
        conv,
        waId,
        session,
        cfg,
        products,
        text,
      );
      if (addResult.blocked) {
        await this.conversationService.saveSession(conv, addResult.session);
        await this.handleCartLimitBlocked(conv, waId, addResult.blocked, cfg);
        return true;
      }
      // "Sí" confirma lo marcado ✅; lo no encontrado se omite (evita loop Natalia Seria)
      let next: WhatsappSessionData = {
        ...addResult.session,
        pendingMultiOrder:
          pending.ambiguous.length || pending.needsAttributes.length
            ? {
                confident: [],
                ambiguous: pending.ambiguous,
                unresolved: [],
                needsAttributes: pending.needsAttributes,
              }
            : undefined,
      };

      if (pending.needsAttributes.length) {
        const first = pending.needsAttributes[0];
        const product = products.find((p) => p.id === first.productId);
        if (product?.hasAttributes && product.attributes?.length) {
          const step = this.catalogService.applyDefaultAttributeStep(
            product,
            this.catalogService.coerceAttributeStep(
              product,
              this.catalogService.resolveAttributesFromMessage(
                product,
                `${first.segment} ${text}`,
                [],
              ),
            ),
          );
          if (step.status === 'complete') {
            const attrQty = this.quantityForMultiSegment(
              first.segment,
              product.name,
              `${first.segment} ${text}`,
            );
            const attempt = this.tryAddProductToCart(
              next,
              product,
              attrQty,
              cfg,
              undefined,
              step.attributes,
            );
            if (attempt.missingAttributes) {
              next = this.buildPendingAttributeSession(
                next,
                product,
                attempt.missingAttributes,
                {
                  sourceText: `${first.segment} ${text}`,
                  pendingMultiOrder: next.pendingMultiOrder,
                },
              );
              await this.conversationService.saveSession(conv, next, 'awaiting_attribute');
              const prefix = addResult.addedNames.length
                ? this.buildCartAddReply(next, this.deliveryFeeFor(next, cfg), addResult.addedNames, {
                    suffix: '',
                  }) + '\n\n'
                : '';
              await this.reply(
                conv,
                waId,
                `${prefix}Ahora elige opciones para *${product.name}*:\n\n` +
                  this.catalogService.formatProductOptionsPrompt(
                    product,
                    attempt.missingAttributes,
                  ),
              );
              return true;
            }
            if (attempt.blocked) {
              await this.conversationService.saveSession(conv, next);
              await this.handleCartLimitBlocked(conv, waId, attempt.blocked, cfg);
              return true;
            }
            next = this.popCompletedNeedsAttribute(
              attempt.session,
              product.id,
            ) as WhatsappSessionData;
            const nextNeeds = next.pendingMultiOrder?.needsAttributes?.[0];
            const nextProduct = nextNeeds
              ? products.find((p) => p.id === nextNeeds.productId)
              : null;
            if (nextProduct?.hasAttributes && nextNeeds) {
              const preRaw = this.catalogService.resolveAttributesFromMessage(
                nextProduct,
                nextNeeds.segment,
                [],
              );
              const pre = this.catalogService.applyDefaultAttributeStep(
                nextProduct,
                preRaw.status === 'invalid' ? { status: 'invalid' } : preRaw,
              );
              if (pre.status === 'complete') {
                const nextAdd = this.tryAddProductToCart(
                  next,
                  nextProduct,
                  this.quantityForMultiSegment(nextNeeds.segment, nextProduct.name, text),
                  cfg,
                  undefined,
                  pre.attributes,
                );
                if (!nextAdd.missingAttributes && !nextAdd.blocked) {
                  next = this.popCompletedNeedsAttribute(nextAdd.session, nextProduct.id);
                  await this.conversationService.saveSession(conv, next, 'building_cart');
                  const chosenFirst = step.attributes.map((a) => a.attributeValue).join(', ');
                  const chosenNext = pre.attributes.map((a) => a.attributeValue).join(', ');
                  await this.reply(
                    conv,
                    waId,
                    this.buildCartAddReply(next, this.deliveryFeeFor(next, cfg), [
                      ...addResult.addedNames,
                      `${product.name} (${chosenFirst})`,
                      `${nextProduct.name} (${chosenNext})`,
                    ]),
                  );
                  return true;
                }
              }
              next = {
                ...next,
                pendingAttribute: {
                  ...this.toPendingAttribute(nextProduct, {
                    sourceText: nextNeeds.segment || undefined,
                  }),
                  selected: pre.status === 'partial' ? pre.attributes : [],
                },
              };
              await this.conversationService.saveSession(conv, next, 'awaiting_attribute');
              const chosen = step.attributes.map((a) => a.attributeValue).join(', ');
              await this.reply(
                conv,
                waId,
                `${this.buildCartAddReply(
                  next,
                  this.deliveryFeeFor(next, cfg),
                  [...addResult.addedNames, `${product.name} (${chosen})`],
                  { suffix: '' },
                )}\n\nAhora elige opciones para *${nextProduct.name}*:\n\n` +
                  this.catalogService.formatProductOptionsPrompt(
                    nextProduct,
                    pre.status === 'partial' ? pre.attributes : [],
                  ),
              );
              return true;
            }
            await this.conversationService.saveSession(conv, next, 'building_cart');
            const chosen = step.attributes.map((a) => a.attributeValue).join(', ');
            await this.reply(
              conv,
              waId,
              this.buildCartAddReply(
                next,
                this.deliveryFeeFor(next, cfg),
                [...addResult.addedNames, `${product.name} (${chosen})`],
              ),
            );
            return true;
          }
          next = {
            ...next,
            pendingAttribute: {
              ...this.toPendingAttribute(product, { sourceText: text }),
              selected: step.status === 'partial' ? step.attributes : [],
            },
            pendingMultiOrder: next.pendingMultiOrder,
          };
          await this.conversationService.saveSession(conv, next, 'awaiting_attribute');
          const prefix = addResult.addedNames.length
            ? this.buildCartAddReply(next, this.deliveryFeeFor(next, cfg), addResult.addedNames, {
                suffix: '',
              }) + '\n\n'
            : next.cart.length
              ? `${this.formatCartOnly(next, this.deliveryFeeFor(next, cfg))}\n\n`
              : '';
          await this.reply(
            conv,
            waId,
            `${prefix}Ahora elige opciones para *${product.name}*:\n\n` +
              this.catalogService.formatProductOptionsPrompt(
                product,
                step.status === 'partial' ? step.attributes : [],
              ),
          );
          return true;
        }
      }

      await this.conversationService.saveSession(conv, next, 'building_cart');
      if (addResult.addedNames.length > 0) {
        await this.reply(
          conv,
          waId,
          this.buildCartAddReply(next, this.deliveryFeeFor(next, cfg), addResult.addedNames, {
            suffix: this.formatContinueShoppingPrompt(next),
          }),
        );
      } else {
        await this.reply(
          conv,
          waId,
          `${this.formatCartOnly(next, this.deliveryFeeFor(next, cfg))}\n\n${this.formatContinueShoppingPrompt(next)}`,
        );
      }
      return true;
    }

    // "Sí" sin platos pendientes ✅ pero con basura no encontrada → limpiar y seguir
    if (
      this.isMultiOrderAffirmative(text) &&
      !pending.confident.length &&
      !pending.ambiguous.length &&
      !pending.needsAttributes.length
    ) {
      session = { ...session, pendingMultiOrder: undefined };
      await this.conversationService.saveSession(conv, session, 'building_cart');
      if (session.cart.length > 0) {
        await this.reply(
          conv,
          waId,
          `${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}\n\n${this.formatContinueShoppingPrompt(session)}`,
        );
      } else {
        await this.reply(
          conv,
          waId,
          'Listo. ¿Qué se te antoja? Escribe el *plato* o el *código*.',
        );
      }
      return true;
    }

    if (pending.ambiguous.length || pending.unresolved.length) {
      await this.reply(
        conv,
        waId,
        this.formatMultiOrderProposal({
          segments: [],
          confident: pending.confident.map((c) => ({
            segment: c.segment,
            product: products.find((p) => p.id === c.productId)!,
            score: 100,
          })),
          ambiguous: pending.ambiguous.map((a) => ({
            segment: a.segment,
            candidates: a.candidates as MenuProduct[],
          })),
          unresolved: pending.unresolved,
          needsAttributes: pending.needsAttributes.map((c) => ({
            segment: c.segment,
            product: products.find((p) => p.id === c.productId)!,
            score: 100,
          })),
        }),
      );
      return true;
    }

    return false;
  }

  /** Quita de la cola multi-pedido el producto cuyas opciones ya se completaron. */
  private popCompletedNeedsAttribute(
    session: WhatsappSessionData,
    productId: number,
  ): WhatsappSessionData {
    const pm = session.pendingMultiOrder;
    if (!pm?.needsAttributes?.length) return session;
    const idx = pm.needsAttributes.findIndex((n) => n.productId === productId);
    const nextNeeds =
      idx >= 0 ? pm.needsAttributes.filter((_, i) => i !== idx) : pm.needsAttributes.slice(1);
    if (nextNeeds.length === pm.needsAttributes.length) return session;
    return {
      ...session,
      pendingMultiOrder: {
        ...pm,
        needsAttributes: nextNeeds,
      },
    };
  }

  private findNewProductOrderCandidate(
    text: string,
    products: MenuProduct[],
    excludeProductId: number,
  ): MenuProduct | null {
    const embedded = this.catalogService.findProductEmbeddedInMessage(text, products);
    if (embedded && embedded.id !== excludeProductId) return embedded;

    const query = this.catalogService.extractProductSearchQuery(text);
    const scored = this.mergeNameScores(
      this.catalogService.searchByNameScored(query, products, 6),
      query === text ? [] : this.catalogService.searchByNameScored(text, products, 6),
    );
    const filtered = scored.filter((x) => x.p.id !== excludeProductId);
    if (!filtered.length) return null;
    if (filtered.length === 1 && filtered[0].score >= 55) return filtered[0].p;
    if (this.catalogService.isStrongProductMatch(filtered) && filtered[0].score >= 70) {
      return filtered[0].p;
    }
    return null;
  }

  /**
   * Cliente pide otro producto mientras hay opciones pendientes del anterior.
   * Productos sin variantes → se agregan al carrito y se mantiene la elección pendiente.
   * Productos con variantes → se pide terminar la selección actual primero.
   */
  private async tryAddProductDuringPendingAttribute(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    products: MenuProduct[],
    cfg: EffectiveWhatsappConfig,
    pendingProduct: MenuProduct,
  ): Promise<boolean> {
    const pa = session.pendingAttribute;
    if (!pa) return false;

    const candidate = this.findNewProductOrderCandidate(text, products, pendingProduct.id);
    if (!candidate) return false;

    // "combo más grande" / solo "combo" sin plato: no saltar a Combo Arroz/Pollo ajenos
    if (
      this.catalogService.isLargerPackInquiry(text) ||
      this.catalogService.isVaguePackSizeQuery(text)
    ) {
      return false;
    }

    // Misma familia (1 Pollo Frito → Combo De Pollo Frito): cambiar, no bloquear
    const family = this.catalogService.findProductVariantFamily(pendingProduct.name, products, [
      pendingProduct,
      candidate,
    ]);
    const sameFamily =
      !!family &&
      family.variants.some((v) => v.id === candidate.id) &&
      family.variants.some((v) => v.id === pendingProduct.id);
    const wantsComboSwitch =
      this.catalogService.productsShareCoreFoodTokens(pendingProduct, candidate) &&
      (this.catalogService.isVariantPreferenceIntent(text) ||
        (/\bcombo\b/i.test(text) && /\bcombo\b/i.test(candidate.name)));

    if (sameFamily || wantsComboSwitch) {
      session = {
        ...this.rememberProductFocus(session, candidate, products),
        pendingAttribute: undefined,
        pendingMatch: undefined,
      };
      if (candidate.hasAttributes && candidate.attributes?.length) {
        if (await this.handleProductWithVariants(conv, waId, session, candidate, text, cfg)) {
          return true;
        }
      }
      const added = this.tryAddProductToCart(session, candidate, 1, cfg, undefined, undefined, {
        sourceText: text,
      });
      if (added.blocked) {
        await this.conversationService.saveSession(conv, session);
        await this.handleCartLimitBlocked(conv, waId, added.blocked, cfg);
        return true;
      }
      session = added.session;
      await this.conversationService.saveSession(conv, session, 'building_cart');
      await this.reply(
        conv,
        waId,
        `Perfecto, lo dejamos en *${candidate.name}* ✅\n\n` +
          this.buildCartAddReply(session, this.deliveryFeeFor(session, cfg), candidate.name),
      );
      return true;
    }

    if (candidate.hasAttributes && candidate.attributes?.length) {
      await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
      await this.reply(
        conv,
        waId,
        `Primero terminemos *${pendingProduct.name}* (falta elegir opciones). ` +
          `Después te ayudo con *${candidate.name}*.\n\n` +
          this.catalogService.formatProductOptionsPrompt(pendingProduct, pa.selected || []),
      );
      return true;
    }

    if (candidate.availableNow === false) {
      await this.reply(
        conv,
        waId,
        `*${candidate.name}* no está disponible ahora. ` +
          `Primero elige las opciones de *${pendingProduct.name}*:\n\n` +
          this.catalogService.formatProductOptionsPrompt(pendingProduct, pa.selected || []),
      );
      return true;
    }

    const fresh = await this.conversationService.reloadConversation(conv.id);
    Object.assign(conv, fresh);
    let liveSession = this.conversationService.getSession(conv);
    liveSession = this.applyDeliveryHintFromMessage(
      { ...liveSession, pendingAttribute: pa },
      text,
    );
    liveSession = {
      ...liveSession,
      pendingAttribute: pa,
    };

    const added = this.tryAddProductToCart(liveSession, candidate, 1, cfg);
    if (added.blocked) {
      await this.conversationService.saveSession(conv, liveSession, 'awaiting_attribute');
      await this.handleCartLimitBlocked(conv, waId, added.blocked, cfg);
      return true;
    }

    const nextSession = {
      ...added.session,
      pendingAttribute: pa,
    };
    await this.conversationService.saveSession(conv, nextSession, 'awaiting_attribute');
    await this.reply(
      conv,
      waId,
      `${this.buildCartAddReply(nextSession, this.deliveryFeeFor(nextSession, cfg), candidate.name, {
        extraLine: this.extractDeliveryTail(text)
          ? `\nDomicilio anotado: _${this.extractDeliveryTail(text)}_`
          : undefined,
        suffix: '',
      })}\n\n` +
        `Sigue con *${pendingProduct.name}*:\n` +
        this.catalogService.formatProductOptionsPrompt(pendingProduct, pa.selected || []),
    );
    return true;
  }

  /**
   * C18 — “¿tienen domicilios para Cra 81A…?”: cotiza cobertura/fee sin
   * mutar el carrito ni confirmar dirección del pedido en curso.
   */
  /**
   * C21 — Arranque logístico sin platos: “para un domicilio para Bosques…”
   * No debe caer en “Entendí varios platos”.
   */
  private async tryHandleDeliverySetup(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    originalText: string,
    text: string,
    cfg: EffectiveWhatsappConfig,
    addressOverride?: string | null,
  ): Promise<boolean> {
    const source = (originalText || text || '').trim();
    const probe = (text || source).trim();
    const forced = (addressOverride || '').trim();
    if (
      !forced &&
      !isDeliverySetupWithoutFood(probe) &&
      !isDeliverySetupWithoutFood(source)
    ) {
      return false;
    }

    const addr =
      forced ||
      extractDeliverySetupAddress(probe) ||
      extractDeliverySetupAddress(source) ||
      this.extractDeliveryTail(source) ||
      this.extractDeliveryTail(probe);

    // Nunca geocodificar muletillas ("pedir un domicilio porfa")
    const safeAddr =
      addr && !isDeliveryLogisticsFluff(addr) && this.isPlausibleDeliveryAddress(addr)
        ? addr
        : null;

    session = {
      ...session,
      orderType: 'delivery',
      fulfillmentChosen: true,
    };
    if (/^recoge en el local/i.test(session.address || '')) {
      session = { ...session, address: undefined, addressConfirmed: false };
    }

    if (safeAddr) {
      session = this.withDeliveryAddress(session, safeAddr);
      const fee = await this.recalculateDeliveryFee(session, cfg);
      session = fee.session;
      await this.conversationService.saveSession(conv, session, 'building_cart');
      if (fee.blocked) {
        await this.reply(
          conv,
          waId,
          `${fee.blocked}\n\nSi tienes otra dirección más cerca, pégamela. Si no, dime qué quieres pedir.`,
        );
        return true;
      }
      const feeLine = fee.notice ? `\n${fee.notice}` : '';
      await this.reply(
        conv,
        waId,
          `Domicilio a *${session.address?.trim() || safeAddr}* ✅${feeLine}\n¿Qué se te antoja? Escribe el *plato* o el *código*.`,
      );
      return true;
    }

    // Si había basura tipo "pedir un domicilio" pegada como dirección previa, limpiarla
    if (session.address?.trim() && isDeliveryLogisticsFluff(session.address)) {
      session = {
        ...session,
        address: undefined,
        addressConfirmed: false,
        deliveryFeeCalculated: undefined,
        deliveryDistanceKm: undefined,
        deliveryOutOfCoverage: false,
      };
    }

    await this.conversationService.saveSession(conv, session, 'building_cart');
    await this.reply(conv, waId, this.formatDeliverySetupEmptyCartReply());
    return true;
  }

  /**
   * Clasificador IA temprano (sin menú completo): typos + logística.
   * Solo en mensajes ambiguos (`needsAiMessageClassify`). Backend valida.
   */
  private async tryApplyAiClassify(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    originalText: string,
    cfg: EffectiveWhatsappConfig,
  ): Promise<{ handled: boolean; text?: string; session?: WhatsappSessionData }> {
    if (!needsAiMessageClassify(text) && !needsAiMessageClassify(originalText)) {
      return { handled: false };
    }

    const recent = await this.conversationService.getRecentMessageTexts(conv.id, 4);
    let result: WhatsappClassifyResult | null = null;
    try {
      result = await this.aiService.classifyMessage({
        userMessage: text,
        cartLength: session.cart.length,
        recentMessages: recent,
      });
    } catch (err) {
      this.logger.warn(`tryApplyAiClassify: ${err}`);
      return { handled: false };
    }
    if (!result || result.confidence < 0.45) return { handled: false };

    const nextText = applyLocalGlossary(result.normalizedText || text);

    if (
      (result.intent === 'delivery_setup' ||
        (result.intent === 'address' && !result.hasFoodItems && result.address)) &&
      !result.hasFoodItems
    ) {
      const ok = await this.tryHandleDeliverySetup(
        conv,
        waId,
        session,
        nextText,
        nextText,
        cfg,
        result.address,
      );
      if (ok) return { handled: true };
    }

    let nextSession = session;
    if (result.address && (result.intent === 'order' || result.hasFoodItems)) {
      nextSession = this.withDeliveryAddress(nextSession, result.address);
      await this.conversationService.saveSession(conv, nextSession);
    }

    if (nextText !== text) {
      return { handled: false, text: nextText, session: nextSession };
    }
    return { handled: false, session: nextSession !== session ? nextSession : undefined };
  }

  /** “¿Qué tan lejos llevas domicilios?” → radio y tarifas, no “arma el pedido”. */
  private async tryHandleDeliveryRangeQuestion(
    conv: WhatsappConversation,
    waId: string,
    text: string,
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    if (!isDeliveryRangeQuestion(text)) return false;
    const maxKm = Number(cfg.deliveryMaxKm) || 5.5;
    const tiers =
      cfg.deliveryFeeTiersPrompt?.trim() ||
      `Llevamos domicilio hasta *${maxKm} km* por ruta.`;
    const area = (cfg.localContext?.serviceAreaNote || '').trim();
    await this.reply(
      conv,
      waId,
      `Llevamos domicilio hasta *${maxKm} km* por ruta.\n\n${tiers}` +
        (area ? `\n\n_${area}_` : '') +
        `\n\nSi me pasas la dirección te confirmo si llegamos y cuánto sale.`,
    );
    return true;
  }

  /** “tienen servicio?” / “tienen servicio a domicilio?” / “están abiertos?” */
  private isBusinessServiceInquiry(text: string): boolean {
    const raw = (text || '').trim();
    if (raw.length < 6) return false;
    const t = this.normalizeForMatch(raw);
    if (
      /\b(pollo|arroz|sopa|combo|bandeja|ajiaco|mondongo|gaseosa|mojarra|hamburguesa)\b/.test(t)
    ) {
      return false;
    }
    if (/\b(horario|horarios|abierto|abiertos|abierta|abiertas)\b/.test(t)) return true;
    // ¿Tienen (servicio a) domicilio? sin zona concreta
    if (
      /\b(tienen|tiene|hacen|hace|hay)\b/.test(t) &&
      /\b(servicio|servicios|domicilio|domicilios)\b/.test(t) &&
      !/\b(para|en|hasta|por)\s+(?!domicilio\b)\S/.test(t)
    ) {
      return true;
    }
    return (
      /\b(tienen|tiene|hay|estan|esta)\b/.test(t) &&
      /\b(servicio|servicios)\b/.test(t)
    );
  }

  private async tryHandleBusinessServiceInquiry(
    conv: WhatsappConversation,
    waId: string,
    text: string,
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    if (!this.isBusinessServiceInquiry(text)) return false;
    const status = await this.businessService.getStatus();
    const openLine = status.isOpen
      ? `Sí, *estamos atendiendo* ahora 🙂 Horario hoy: *${status.openTime}–${status.closeTime}*.`
      : `Ahora estamos *cerrados*. Horario hoy: *${status.openTime}–${status.closeTime}*.`;
    const tiers =
      cfg.deliveryFeeTiersPrompt?.trim() ||
      'La tarifa de domicilio depende de la distancia.';
    const hoursExtra = (cfg.localContext?.hoursNote || '').trim()
      ? `\n_${(cfg.localContext?.hoursNote || '').trim()}_`
      : '';
    await this.reply(
      conv,
      waId,
      `${openLine}${hoursExtra}\n\nSí puedes pedir *domicilio por este chat*.\n${tiers}\n\n¿Qué se te antoja?`,
    );
    return true;
  }

  private async tryHandleCoverageInquiry(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    if (!isDeliveryCoverageInquiry(text)) return false;

    const addr = extractCoverageAddressProbe(text);
    if (!addr) {
      await this.reply(
        conv,
        waId,
        'Claro 🙂 Dime la dirección (calle/carrera o conjunto) y te confirmo si llegamos y cuánto sale el domicilio.',
      );
      return true;
    }

    const probe: WhatsappSessionData = {
      ...session,
      orderType: 'delivery',
      address: addr,
      addressConfirmed: true,
      deliveryFeeCalculated: undefined,
      deliveryOutOfCoverage: false,
      deliveryDistanceKm: null,
      deliveryLat: null,
      deliveryLng: null,
    };
    const feeResult = await this.recalculateDeliveryFee(probe, cfg);

    if (feeResult.blocked || feeResult.session.deliveryOutOfCoverage) {
      await this.reply(
        conv,
        waId,
        `📍 _${addr}_\n\n` +
          (feeResult.blocked ||
            'Esa dirección queda *fuera de cobertura* de domicilio por ahora.') +
          `\n\nSi tienes otra dirección más cerca del local, pégamela y la reviso.`,
      );
      return true;
    }

    const fee =
      typeof feeResult.session.deliveryFeeCalculated === 'number'
        ? feeResult.session.deliveryFeeCalculated
        : cfg.defaultDeliveryFee;
    const km = feeResult.session.deliveryDistanceKm;
    const kmPart = km != null && km > 0 ? ` (~${km.toFixed(1)} km)` : '';
    const notice =
      feeResult.notice ||
      `🚚 Domicilio: *$${fee.toLocaleString('es-CO')}*${kmPart}`;

    await this.reply(
      conv,
      waId,
      `✅ Sí, llegamos a _${addr}_${kmPart}.\n${notice}\n¿Qué se te antoja? Escribe el *plato* o el *código*.`,
    );
    return true;
  }

  private async tryHandlePointsFlow(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    const linkedUserId = session.linkedUserId ?? null;
    const available = linkedUserId
      ? await this.pointsHandler.getAvailablePoints(linkedUserId)
      : null;
    const helpCtx = this.pointsHandler.buildHelpContext(
      cfg.websiteUrl,
      session.linkedUserName,
      available,
    );

    if (this.pointsHandler.isRemovePremioIntent(text)) {
      if (!session.pendingRedemptionCode) {
        await this.reply(conv, waId, 'No tienes ningún premio anotado en este pedido.');
        return true;
      }
      session = {
        ...session,
        pendingRedemptionCode: null,
        pendingRedemptionExpiresAt: null,
      };
      await this.conversationService.saveSession(conv, session);
      await this.reply(conv, waId, 'Listo, quité el premio de este pedido ✅');
      return true;
    }

    if (this.pointsHandler.isAwaitingPointCodePrompt(text)) {
      await this.reply(
        conv,
        waId,
        'Perfecto 👍 Pégame el código de *12 caracteres* de la factura.\n' +
          'Ej: _registrar A3F9K2M8PQ75_ (o solo el código si tu cuenta está vinculada).',
      );
      return true;
    }

    const code = this.pointsHandler.extractPointCodeCandidate(text);

    if (code) {
      if (this.pointsHandler.isRegisterIntent(text) && !this.pointsHandler.isPremioApplyIntent(text)) {
        const reg = await this.pointsHandler.tryRegisterOnly(linkedUserId, code);
        if (reg.handled) {
          await this.reply(conv, waId, reg.message);
          return true;
        }
      }

      if (
        this.pointsHandler.isPremioApplyIntent(text) ||
        session.cart.length > 0 ||
        /\bpremio\b/i.test(text)
      ) {
        const premio = await this.pointsHandler.validatePremioCode(code, linkedUserId);
        if (premio.ok) {
          session = {
            ...session,
            pendingRedemptionCode: premio.code,
            pendingRedemptionExpiresAt: premio.expiresAt?.toISOString() ?? null,
          };
          await this.conversationService.saveSession(conv, session);
          const halfOk = this.pointsHandler.cartHasHalfChicken(session.cart);
          await this.reply(
            conv,
            waId,
            `✅ ${formatPremioAppliedNote(premio.code, premio.expiresAt)}\n\n` +
              (halfOk
                ? 'Cuando termines tu pedido, escribe *confirmar* y el premio se aplicará.'
                : formatCartNeedsHalfChickenForPremio()),
          );
          return true;
        }
        if (this.pointsHandler.isPremioApplyIntent(text)) {
          await this.reply(conv, waId, premio.message);
          return true;
        }
      }

      if (linkedUserId) {
        const reg = await this.pointsHandler.tryRegisterOnly(linkedUserId, code);
        if (reg.handled) {
          await this.reply(conv, waId, reg.message);
          return true;
        }
      } else if (this.pointsHandler.isRegisterIntent(text) || !session.cart.length) {
        await this.reply(conv, waId, this.pointsHandler.buildRegisterHelp(helpCtx));
        return true;
      }
    }

    if (this.pointsHandler.isRedeemIntent(text)) {
      if (!linkedUserId) {
        await this.reply(
          conv,
          waId,
          'Para redimir puntos necesitas una cuenta web con el mismo celular de WhatsApp.\n\n' +
            this.pointsHandler.buildOverviewMessage(helpCtx),
        );
        return true;
      }
      const avail = available ?? 0;
      // Pregunta de procedimiento (no “redimir” a secas) → explicar pasos
      if (
        !/^redimir[\s!.?]*$/i.test(text.trim()) &&
        /\b(procedimiento|proceso|pasos?|c[oó]mo|para\s+redimir)\b/i.test(text)
      ) {
        await this.reply(conv, waId, this.pointsHandler.buildRedeemHelp(avail));
        return true;
      }
      if (!/\bredimir\b/i.test(text) && avail < 9) {
        await this.reply(conv, waId, this.pointsHandler.buildRedeemHelp(avail));
        return true;
      }
      const result = await this.pointsHandler.redeemNinePoints(linkedUserId);
      if (!result.ok) {
        await this.reply(conv, waId, result.message);
        return true;
      }
      const exp = result.expiresAt
        ? result.expiresAt.toLocaleDateString('es-CO', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
        : '30 días';
      await this.reply(
        conv,
        waId,
        `🎉 *Premio generado*\n\n` +
          `Código: \`${result.code}\`\n` +
          `Válido hasta: *${exp}*\n\n` +
          `Te quedan *${result.availableAfter}* punto(s).\n\n` +
          `Para usarlo: pide un *medio pollo* (cód. 2 o 5) y escribe:\n` +
          `_premio ${result.code}_\n\n` +
          `O envía el código cuando vayas a *confirmar* el pedido.`,
      );
      return true;
    }

    if (this.pointsHandler.isBalanceIntent(text)) {
      if (linkedUserId && available != null) {
        await this.reply(
          conv,
          waId,
          `📊 Tienes *${available}* punto(s) disponible(s).\n\n` +
            this.pointsHandler.buildRedeemHelp(available),
        );
      } else {
        await this.reply(conv, waId, this.pointsHandler.buildOverviewMessage(helpCtx));
      }
      return true;
    }

    if (this.pointsHandler.isRegisterIntent(text) && !code) {
      await this.reply(conv, waId, this.pointsHandler.buildRegisterHelp(helpCtx));
      return true;
    }

    if (this.pointsHandler.isPointsTopic(text)) {
      await this.reply(conv, waId, this.pointsHandler.buildOverviewMessage(helpCtx));
      return true;
    }

    return false;
  }

  private async reply(conv: WhatsappConversation, waId: string, body: string) {
    const trimmed = scrubOutboundAsesorMentions((body || '').trim());
    if (!trimmed) {
      this.logger.warn(`[WhatsApp] skip empty reply waId=${waId}`);
      return;
    }
    const key = (waId || conv.waId || 'unknown').trim() || 'unknown';
    const hold = this.outboundHoldByWaId.get(key);
    if (hold) {
      hold.push(trimmed);
      return;
    }
    await this.sendReplyNow(conv, waId, trimmed);
  }
}
