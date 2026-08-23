import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { WhatsappSettingsService } from './whatsapp-settings.service';
import { WhatsappMetaService, IncomingWhatsappMessage } from './whatsapp-meta.service';
import { WhatsappCatalogService, type MultiProductResolveResult } from './whatsapp-catalog.service';
import { WhatsappAiService, type WhatsappImageAnalysis } from './whatsapp-ai.service';
import { WhatsappConversationService } from './whatsapp-conversation.service';
import { BusinessService } from '../business/business.service';
import { OrdersService } from '../orders/orders.service';
import { PaymentsService } from '../payments/payments.service';
import { WhatsappActionGuardService } from './whatsapp-action-guard.service';
import { WhatsappPointsService } from './whatsapp-points.service';
import {
  formatCartNeedsHalfChickenForPremio,
  formatPremioAppliedNote,
} from './whatsapp-points-help';
import { buildWhatsappBusinessRulesBlock } from './whatsapp-business-rules';
import {
  applyPaymentReplyTemplate,
  buildPaymentOptionsPrompt,
  findPaymentMethodByText,
  getEnabledPaymentMethods,
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
import type {
  AiOrderAction,
  WhatsappCartItem,
  WhatsappPendingAttribute,
  WhatsappSessionData,
} from './types/whatsapp-session.types';
import { WhatsappConversation } from './entities/whatsapp-conversation.entity';
import { CreateOrderDto } from '../orders/DTOS/orderDTO';

type MenuProduct = Awaited<ReturnType<WhatsappCatalogService['getMenuProducts']>>[number];
type EffectiveWhatsappConfig = Awaited<
  ReturnType<WhatsappSettingsService['getEffectiveConfig']>
>;

@Injectable()
export class WhatsappOrchestratorService {
  private readonly logger = new Logger(WhatsappOrchestratorService.name);

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
  ) {}

  async handleIncoming(msg: IncomingWhatsappMessage): Promise<void> {
    const cfg = await this.settingsService.getEffectiveConfig();
    const conv = await this.conversationService.findOrCreateConversation(msg.waId, msg.phoneE164);
    await this.conversationService.touchInbound(conv);

    const logged = await this.conversationService.logMessage({
      conversationId: conv.id,
      direction: 'in',
      body: msg.text,
      waMessageId: msg.messageId,
      sentBy: 'bot',
      raw: msg.raw,
      messageType: msg.messageType,
      mediaId: msg.mediaId,
      mimeType: msg.mimeType,
    });

    if (!cfg.enabled) {
      await this.reply(conv, msg.waId, 'Por ahora WhatsApp no está activo. Puedes pedir por la web o llamar al local.');
      return;
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
          'No pude escuchar bien el audio 🙏 ¿Me lo escribes por texto?\n\n' + this.humanHelpHint(),
        );
        return;
      }
      text = resolved;
      await this.reply(conv, msg.waId, `Te escuché: _${this.shortQuote(text)}_`);
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
          'Recibí tu ubicación pero no pude leerla. ¿Me escribes la dirección o mandas de nuevo el pin?',
        );
        return;
      }
      let sessionLoc = this.conversationService.getSession(conv);
      sessionLoc = {
        ...sessionLoc,
        orderType: 'delivery',
        address: addr,
      };
      await this.conversationService.saveSession(conv, sessionLoc, 'building_cart');
      await this.reply(conv, msg.waId, `Listo, anoté tu ubicación como domicilio ✅\n_${addr}_`);
      const freshLoc = await this.conversationService.reloadConversation(conv.id);
      Object.assign(conv, freshLoc);
      sessionLoc = this.conversationService.getSession(conv);
      if (sessionLoc.cart.length > 0) {
        await this.tryConfirmOrder(conv, msg.waId, sessionLoc);
      } else {
        await this.reply(conv, msg.waId, '¿Qué se te antoja pedir? Dime por nombre o código.');
      }
      return;
    } else if (msg.messageType !== 'text') {
      await this.reply(
        conv,
        msg.waId,
          'Recibí tu mensaje 👍 El asistente trabaja mejor con *texto*, *nota de voz*, *foto del menú* o *ubicación*.\n\n' +
          this.humanHelpHint(),
      );
      return;
    }

    if (!text) {
      await this.reply(conv, msg.waId, '¿Qué se te antoja? Puedes pedir por código o nombre.');
      return;
    }

    const lower = text.toLowerCase();

    if (/\b(humano|persona|agente|asesor|asesora|hablar\s+con\s+alguien)\b/.test(lower)) {
      await this.conversationService.setHumanTakeover(conv.id, true);
      await this.reply(
        conv,
        msg.waId,
        cfg.humanHandoffMessage,
      );
      return;
    }

    // Mismo chat por número: al escribir de nuevo tras pedido o cierre, empieza pedido nuevo
    let reopenedFreshOrder = false;
    if (conv.state === 'completed' || conv.state === 'closed') {
      await this.conversationService.reopenForNewOrder(conv);
      const freshReopen = await this.conversationService.reloadConversation(conv.id);
      Object.assign(conv, freshReopen);
      reopenedFreshOrder = true;
    }

    if (this.isClearCartIntent(text)) {
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

    if (this.isCancelIntent(text)) {
      await this.handleCancelRequest(conv, msg.waId, cfg);
      return;
    }

    let session = this.conversationService.getSession(conv);
    const productsRaw = await this.catalogService.getMenuProducts();
    const status = await this.businessService.getStatus();
    const businessOpenForBot = status.isOpen || !!cfg.ignoreBusinessHours;
    // En pruebas nocturnas: no filtrar por horario de producto
    const products = cfg.ignoreBusinessHours
      ? productsRaw.map((p) => ({ ...p, availableNow: true }))
      : productsRaw;

    // Primer mensaje de la conversación
    const inboundCount = await this.conversationService.countInboundMessages(conv.id);
    if (inboundCount <= 1) {
      // Audio/texto tipo “quiero pedir” sin producto → no inundar con menú completo
      if (
        this.isVagueOrderIntent(text) &&
        this.catalogService.extractCodeFromMessage(text) == null &&
        this.catalogService.findProductEmbeddedInMessage(text, products) == null &&
        this.catalogService.searchByName(
          this.catalogService.extractProductSearchQuery(text),
          products,
          5,
        ).length === 0
      ) {
        await this.reply(conv, msg.waId, this.buildAskWhatToOrderMessage(cfg));
        return;
      }
      await this.reply(conv, msg.waId, this.buildWelcomeMessage(cfg));
      if (this.isGreetingKeyword(text) || text.length < 2) return;
      // Si ya pidió algo en el primer mensaje, seguimos procesando abajo
    }

    // Releer sesión: pendingAttribute / carrito deben venir de DB
    {
      const fresh = await this.conversationService.reloadConversation(conv.id);
      Object.assign(conv, fresh);
      session = this.conversationService.getSession(conv);
    }

    session = this.applyDeliveryHintFromMessage(session, text);

    if (
      await this.tryHandleCartModification(conv, msg.waId, session, text, products, cfg)
    ) {
      return;
    }

    if (await this.tryHandlePointsFlow(conv, msg.waId, session, text, cfg)) {
      return;
    }

    // PRIORIDAD 1: eligiendo opción de un producto (1, 2, 3… NO es código de producto)
    if (session.pendingAttribute || conv.state === 'awaiting_attribute') {
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
      if (pa && product) {
        const step = this.catalogService.resolveNextAttributeChoice(
          product,
          text,
          pa.selected || [],
        );
        if (step.status === 'complete') {
          const fresh = await this.conversationService.reloadConversation(conv.id);
          Object.assign(conv, fresh);
          session = this.conversationService.getSession(conv);
          const added = this.tryAddProductToCart(session, product, 1, cfg, undefined, step.attributes);
          if (added.blocked) {
            await this.conversationService.saveSession(conv, session);
            await this.handleCartLimitBlocked(conv, msg.waId, added.blocked, cfg);
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
            session = {
              ...session,
              pendingAttribute: this.toPendingAttribute(nextProduct),
            };
            await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
            const chosen = step.attributes.map((a) => a.attributeValue).join(', ');
            await this.reply(
              conv,
              msg.waId,
              `${this.buildCartAddReply(
                session,
                cfg.defaultDeliveryFee,
                `${product.name} (${chosen})`,
                { suffix: '' },
              )}\n\n` +
                `Ahora elige opciones para *${nextProduct.name}*:\n\n` +
                this.catalogService.formatProductOptionsPrompt(nextProduct, []),
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
              cfg.defaultDeliveryFee,
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
            this.catalogService.formatProductOptionsPrompt(product, step.attributes),
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

        // No es una opción válida: si parece pregunta/otro tema → IA responde (sin perder la elección)
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

        // Intento de opción fallido (número fuera de rango, etc.): re-preguntar corto
        await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
        await this.reply(
          conv,
          msg.waId,
          `No te capté esa opción. Respóndeme con el *nombre* (medio, cuarto…) o el *número*.\n\n` +
            this.catalogService.formatProductOptionsPrompt(product, pa.selected || []),
        );
        return;
      }
      // Estado inconsistente: no interpretar el mensaje como código de producto
      session.pendingAttribute = undefined;
      await this.conversationService.saveSession(conv, session, 'building_cart');
      await this.reply(
        conv,
        msg.waId,
        'Se me fue la selección pendiente 🙏 Dime otra vez el *nombre* o *código* del producto y te muestro las opciones.',
      );
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

    // Confirmación / palabras clave de flujo — ANTES de tratar el texto como nombre o dirección
    const isConfirm = this.isConfirmKeyword(text);
    const isGreeting = this.isGreetingKeyword(text);

    // Tras pedido completado: saludo / “quiero pedir” → no pasar por IA (evita rearmar carrito del historial)
    if (reopenedFreshOrder) {
      if (isGreeting || this.isVagueOrderIntent(text) || text.length < 2) {
        await this.reply(
          conv,
          msg.waId,
          `Listo, el pedido anterior ya quedó. ¿Qué se te antoja ahora?\n\n` +
            `Puedes pedir por *nombre* o *código*, o escribe *menú*.`,
        );
        return;
      }
    }

    if (conv.state === 'awaiting_name' && !isConfirm && !isGreeting && text.length >= 2) {
      if (
        this.looksLikeAddress(text) ||
        this.looksLikePayment(text, cfg.paymentMethods) ||
        this.isPickupIntent(text) ||
        this.isDeliveryIntent(text)
      ) {
        await this.reply(
          conv,
          msg.waId,
          '¿Me regalas tu *nombre completo*? (ej. Juan Pérez). Después te pregunto si es domicilio o si pasas tú.',
        );
        return;
      }
      await this.conversationService.updateCustomerName(conv, text);
      await this.conversationService.saveSession(conv, session, 'building_cart');
      // Releer sesión y seguir el flujo de confirmación (no pedir otro producto)
      const fresh = await this.conversationService.reloadConversation(conv.id);
      Object.assign(conv, fresh);
      session = this.conversationService.getSession(conv);
      await this.reply(conv, msg.waId, `Con gusto, *${text.trim()}*.`);
      await this.tryConfirmOrder(conv, msg.waId, session);
      return;
    }
    if (conv.state === 'awaiting_name') {
      await this.reply(conv, msg.waId, '¿Me dices tu *nombre completo*? (ej. Juan Pérez)');
      return;
    }

    if (conv.state === 'awaiting_address' && !isConfirm && !isGreeting) {
      // "paso en 15 minutos" / "lo recojo" → pickup, no dirección
      if (this.isPickupIntent(text)) {
        session = this.applyPickupIntent(session, text);
        await this.conversationService.saveSession(conv, session, 'building_cart');
        const fresh = await this.conversationService.reloadConversation(conv.id);
        Object.assign(conv, fresh);
        session = this.conversationService.getSession(conv);
        await this.reply(
          conv,
          msg.waId,
          `Perfecto, entonces *pasas tú por el local* ✅ (sin domicilio).\n_${session.address}_`,
        );
        await this.tryConfirmOrder(conv, msg.waId, session);
        return;
      }
      if (text.length >= 6) {
        const addrHint = this.extractDeliveryTail(text) || text.trim();
        if (!this.isPlausibleDeliveryAddress(addrHint)) {
          await this.reply(
            conv,
            msg.waId,
            '¿Me pasas la *dirección de entrega* o me dices si *pasas a recoger*? (ej. “paso en 15 minutos”).\nEjemplo domicilio: Calle 10 #5-20, habitación 202, barrio Centro.',
          );
          return;
        }
        session.orderType = 'delivery';
        session.address = addrHint;
        await this.conversationService.saveSession(conv, session, 'building_cart');
        const fresh = await this.conversationService.reloadConversation(conv.id);
        Object.assign(conv, fresh);
        session = this.conversationService.getSession(conv);
        await this.reply(conv, msg.waId, 'Listo, anoté la dirección ✅');
        await this.tryConfirmOrder(conv, msg.waId, session);
        return;
      }
    }
    if (conv.state === 'awaiting_address') {
      await this.reply(
        conv,
        msg.waId,
        '¿Te lo enviamos a *domicilio* o *pasas tú*?\n' +
          '• Domicilio: escríbeme la dirección completa.\n' +
          '• Si pasas: algo como *paso en 15 minutos*.',
      );
      return;
    }

    if (conv.state === 'awaiting_payment' && !isConfirm && !isGreeting) {
      const payPick = this.resolvePaymentChoice(text, cfg);
      if (payPick) {
        session.paymentMethod = payPick.id;
        await this.conversationService.saveSession(conv, session, 'confirming');
        const confirmExtra = this.buildPaymentConfirmReply(payPick, cfg);
        if (confirmExtra) {
          await this.reply(conv, msg.waId, confirmExtra);
        }
        session = this.conversationService.getSession(conv);
        await this.tryConfirmOrder(conv, msg.waId, session);
        return;
      }
    }
    if (conv.state === 'awaiting_payment') {
      await this.reply(
        conv,
        msg.waId,
        buildPaymentOptionsPrompt(cfg.paymentMethods, cfg.paymentInstructions),
      );
      return;
    }

    if (conv.state === 'awaiting_notes' && !isConfirm && !isGreeting) {
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

    // Saludo / menú / “quiero pedir” sin producto concreto
    if (isGreeting || this.isMenuLinkIntent(text)) {
      if (this.isMenuLinkIntent(text)) {
        await this.reply(conv, msg.waId, cfg.menuLinkMessage);
        return;
      }
      await this.reply(conv, msg.waId, this.buildWelcomeMessage(cfg));
      return;
    }

    // "Hola, quiero hacer un pedido" → preguntar qué ordenar (no listar porciones/productos)
    if (this.isVagueOrderIntent(text)) {
      const codeProbe = this.catalogService.extractCodeFromMessage(text);
      const nameProbe = this.catalogService.searchByName(text, products, 5);
      if (codeProbe == null && nameProbe.length === 0) {
        await this.reply(
          conv,
          msg.waId,
          this.buildAskWhatToOrderMessage(cfg),
        );
        return;
      }
      // Si además nombró algo del menú, seguimos el flujo normal abajo
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

    if (session.pendingCategoryBrowse?.categories?.length) {
      const pickedCategory = this.catalogService.resolveCategoryBrowsePick(
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
    }

    // Cambio de categoría (ej. ya vio sopas y pregunta por pollo / carne)
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

    // Pickup / delivery explícito (antes de códigos: "paso en 15 minutos" ≠ código 15)
    if (this.isPickupIntent(text)) {
      session = this.applyPickupIntent(session, text);
      await this.conversationService.saveSession(conv, session);
      await this.reply(
        conv,
        msg.waId,
        `Listo, queda como *recoger en el local* (sin domicilio).\n_${session.address}_`,
      );
      if (session.cart.length > 0) {
        const fresh = await this.conversationService.reloadConversation(conv.id);
        Object.assign(conv, fresh);
        session = this.conversationService.getSession(conv);
        await this.tryConfirmOrder(conv, msg.waId, session);
      }
      return;
    }
    if (this.isDeliveryIntent(text) && !this.looksLikeAddress(text)) {
      session.orderType = 'delivery';
      if (/^recoge en el local/i.test(session.address || '')) {
        session.address = undefined;
      }
      await this.conversationService.saveSession(conv, session);
      if (session.cart.length > 0 && !session.address?.trim()) {
        await this.conversationService.saveSession(conv, session, 'awaiting_address');
        await this.reply(
          conv,
          msg.waId,
          `${this.formatCartOnly(session, cfg.defaultDeliveryFee)}\n\n` +
            `Dale, *domicilio*. ¿Me escribes la *dirección de entrega* completa?`,
        );
        return;
      }
      await this.reply(conv, msg.waId, 'Dale, lo dejamos en *domicilio*.');
      return;
    }

    const code = this.catalogService.extractCodeFromMessage(text);
    const bareOptionNumber = /^[1-9]\d{0,3}$/.test(text.trim());
    const pendingListIndex =
      bareOptionNumber &&
      session.pendingMatch &&
      code != null &&
      code >= 1 &&
      code <= session.pendingMatch.candidates.length &&
      !session.pendingMatch.candidates.some((c) => c.code === code);
    if (
      code != null &&
      !pendingListIndex &&
      !(bareOptionNumber && (session.pendingAttribute || conv.state === 'awaiting_attribute'))
    ) {
      const found = this.catalogService.findByCode(code, products);
      if (found) {
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
        const added = this.tryAddProductToCart(session, found, 1, cfg);
        if (added.blocked) {
          await this.conversationService.saveSession(conv, session);
          await this.handleCartLimitBlocked(conv, msg.waId, added.blocked, cfg);
          return;
        }
        session = added.session;
        await this.conversationService.saveSession(conv, { ...session, pendingMatch: undefined }, 'building_cart');
        const desc = found.description ? `\n_${found.description}_` : '';
        const addrLine = session.address?.trim()
          ? `\nDomicilio anotado: _${session.address.trim()}_`
          : '';
        await this.reply(
          conv,
          msg.waId,
          this.buildCartAddReply(session, cfg.defaultDeliveryFee, found.name, {
            extraLine: [desc || undefined, addrLine || undefined].filter(Boolean).join('') || undefined,
          }),
        );
        return;
      }
      await this.reply(conv, msg.waId, `No hallé un producto activo con código *${code}*. ¿Lo buscamos por nombre?`);
      return;
    }

    if (/\b(confirmar|confirmo|listo pedido|finalizar)\b/.test(lower)) {
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
      session = this.applyInlineOrderNote(session, text);
      await this.conversationService.saveSession(conv, session);
      const ack = this.formatInlineNoteAck(session);
      await this.reply(
        conv,
        msg.waId,
        `${ack}\n\n${this.formatCartOnly(session, cfg.defaultDeliveryFee)}\n\n${this.formatContinueShoppingPrompt()}`,
      );
      return;
    }

    if (/\b(contraentrega|efectivo|cash|transferencia|nequi|mercadopago|mercado\s*pago)\b/.test(lower) ||
      findPaymentMethodByText(text, cfg.paymentMethods)) {
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
        await this.tryConfirmOrder(conv, msg.waId, session);
        return;
      }
    }

    // "¿Qué hay de almuerzo?" / recomendaciones → categorías con ejemplos (no códigos 1-9)
    if (
      this.catalogService.isMenuExploreIntent(text, products) &&
      !session.pendingAttribute &&
      conv.state === 'building_cart'
    ) {
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
      await this.conversationService.saveSession(conv, session);
      await this.reply(conv, msg.waId, overview.text);
      return;
    }

    if (
      !session.pendingMatch &&
      !session.pendingAttribute &&
      !session.pendingMultiOrder &&
      (await this.tryHandleProductCompositionQuestion(conv, msg.waId, text, products, cfg))
    ) {
      return;
    }

    if (
      !session.pendingMatch &&
      !session.pendingAttribute &&
      !session.pendingMultiOrder &&
      (await this.tryHandleProductInfoInquiry(conv, msg.waId, text, products, cfg))
    ) {
      return;
    }

    // Varios platos en un mensaje ("sopa de mondongo, cuarto de pollo y costillas")
    if (!session.pendingMatch && !session.pendingAttribute && !session.pendingMultiOrder) {
      const multi = this.catalogService.resolveMultiProductOrder(text, products);
      if (multi) {
        const handled = await this.tryHandleMultiProductOrder(
          conv,
          msg.waId,
          session,
          multi,
          cfg,
          text,
        );
        if (handled) return;
      }
    }

    // Título embebido en la frase ("… arroz con pollo para calle 10") — prioridad máxima
    const embeddedProduct = this.catalogService.findProductEmbeddedInMessage(text, products);
    if (embeddedProduct && !session.pendingMatch && !session.pendingAttribute) {
      const deliveryTail = this.extractDeliveryTail(text);
      if (deliveryTail) {
        session = { ...session, orderType: 'delivery', address: deliveryTail };
      }
      if (embeddedProduct.hasAttributes && embeddedProduct.attributes?.length) {
        if (await this.handleProductWithVariants(conv, msg.waId, session, embeddedProduct, text, cfg)) {
          return;
        }
      }
      const embeddedAdd = this.tryAddProductToCart(session, embeddedProduct, 1, cfg);
      if (embeddedAdd.blocked) {
        await this.conversationService.saveSession(conv, session);
        await this.handleCartLimitBlocked(conv, msg.waId, embeddedAdd.blocked, cfg);
        return;
      }
      session = embeddedAdd.session;
      await this.conversationService.saveSession(conv, session, 'building_cart');
      await this.reply(
        conv,
        msg.waId,
        this.buildCartAddReply(session, cfg.defaultDeliveryFee, embeddedProduct.name, {
          extraLine: [
            embeddedProduct.description ? `_${embeddedProduct.description}_` : '',
            deliveryTail ? `\nDomicilio anotado: _${deliveryTail}_` : '',
          ]
            .filter(Boolean)
            .join('\n'),
        }),
      );
      return;
    }

    const productQuery = this.catalogService.extractProductSearchQuery(text);
    const nameScored = this.mergeNameScores(
      this.catalogService.searchByNameScored(productQuery, products, 8),
      productQuery === text
        ? []
        : this.catalogService.searchByNameScored(text, products, 8),
    );
    const nameMatches = nameScored.map((x) => x.p);
    const strongProduct = this.catalogService.isStrongProductMatch(nameScored);

    if (
      !session.pendingMatch &&
      (await this.tryHandleVariantFamily(conv, msg.waId, session, text, products, cfg))
    ) {
      return;
    }

    // (Categoría ya se maneja arriba con tryHandleCategoryBrowse)

    // Si hay un ganador claro por título (ej. "arroz con pollo"), no listar ambigüedades débiles
    const resolvedMatches =
      strongProduct && nameScored.length >= 1 && nameScored[0].score >= 80
        ? [nameScored[0].p]
        : nameMatches;

    if (resolvedMatches.length === 1 && !session.pendingMatch && !session.pendingAttribute) {
      const one = resolvedMatches[0];
      const deliveryTail = this.extractDeliveryTail(text);
      if (deliveryTail) {
        session = { ...session, orderType: 'delivery', address: deliveryTail };
      }
      if (one.hasAttributes && one.attributes?.length) {
        if (await this.handleProductWithVariants(conv, msg.waId, session, one, text, cfg)) {
          return;
        }
      }
      const added = this.tryAddProductToCart(session, one, 1, cfg);
      if (added.blocked) {
        await this.conversationService.saveSession(conv, session);
        await this.handleCartLimitBlocked(conv, msg.waId, added.blocked, cfg);
        return;
      }
      session = added.session;
      await this.conversationService.saveSession(conv, session, 'building_cart');
      await this.reply(
        conv,
        msg.waId,
        this.buildCartAddReply(session, cfg.defaultDeliveryFee, one.name, {
          extraLine: [
            one.description ? `_${one.description}_` : '',
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
          );
          if (handledMulti) return;
        }
      }
      const family = this.catalogService.findProductVariantFamily(text, products, resolvedMatches);
      if (family && family.variants.length >= 2) {
        session = { ...session, pendingMatch: { query: text, candidates: family.variants } };
        await this.conversationService.saveSession(conv, session);
        await this.reply(conv, msg.waId, this.catalogService.formatVariantFamilyPrompt(family));
        return;
      }
      session.pendingMatch = { query: text, candidates: resolvedMatches };
      await this.conversationService.saveSession(conv, session);
      const opts = resolvedMatches.map((c, i) => this.catalogService.formatProductListItem(c, i + 1)).join('\n\n');
      await this.reply(
        conv,
        msg.waId,
        `Encontré varias opciones:\n\n${opts}\n\nRespóndeme con el *número* o el *código*.`,
      );
      return;
    }

    const menuDetailed = await this.catalogService.getMenuDetailedText();
    const recent = await this.conversationService.getRecentMessageTexts(conv.id, 10);
    const exploringMenu =
      this.catalogService.isMenuExploreIntent(text, products) ||
      !!session.pendingCategoryBrowse?.categories?.length;
    const menuForAi = exploringMenu
      ? this.catalogService.buildMenuCategoryContextForAi(products)
      : menuDetailed;
    const customerHint = [
      session.linkedUserId
        ? `Cliente web: ${session.linkedUserName}. Igual pide nombre y dirección nuevos para este pedido.`
        : 'Sin usuario guardado en WhatsApp. Pide nombre y dirección antes de confirmar.',
      session.ignorePriorOrderHistory && session.cart.length === 0
        ? 'IMPORTANTE: El pedido anterior YA se cerró. El carrito está VACÍO. NO uses addItems con productos del historial; solo agrega si el cliente nombra un producto AHORA.'
        : '',
      exploringMenu
        ? 'El cliente EXPLORA el menú. Comparte el link del menú online si está disponible. NO listes productos numerados ni códigos en bloque. Orienta por CATEGORÍAS con 1-2 ejemplos, pregunta qué categoría le antoja, y sigue el hilo. addItems solo si nombra un plato concreto.'
        : '',
      session.pendingCategoryBrowse?.categories?.length
        ? `CATEGORÍAS MOSTRADAS: ${session.pendingCategoryBrowse.categories.join(', ')}. Si elige una, profundiza ahí; no repitas todo el menú.`
        : '',
    ]
      .filter(Boolean)
      .join(' ');

    const rulesBlock = buildWhatsappBusinessRulesBlock({
      brandName: cfg.brandName || cfg.localContext?.restaurantName || 'Pronto Pollo Portal',
      businessStatus: businessOpenForBot ? { ...status, isOpen: true } : status,
      deliveryFee: cfg.defaultDeliveryFee,
      allowMercadoPago: !!cfg.allowMercadoPago,
      menuProductCount: products.filter((p) => p.availableNow !== false).length,
      localContextBlock: cfg.localContextBlock,
      orderLimitsBlock: buildOrderLimitsPromptBlock(this.toCartLimitsConfig(cfg)),
      paymentMethods: cfg.paymentMethods,
    });

    const ai = await this.aiService.generateTurn({
      userMessage: text,
      businessRulesBlock: rulesBlock,
      menuDetailedText: menuForAi,
      sessionSummary: this.buildSessionSummary(conv, session, cfg.defaultDeliveryFee),
      recentMessages: recent,
      customerHint,
      conversational: exploringMenu,
    });

    const guarded = this.actionGuard.sanitize({
      actions: ai.actions,
      products,
      businessOpen: businessOpenForBot,
      allowMercadoPago: !!cfg.allowMercadoPago,
      paymentMethods: cfg.paymentMethods,
    });

    if (
      (this.catalogService.isPriceInquiryIntent(text) ||
        this.catalogService.isGenericProductInquiry(text)) &&
      guarded.actions
    ) {
      delete guarded.actions.addItems;
      delete guarded.actions.setAddress;
      delete guarded.actions.setPaymentMethod;
    }

    // Tras pedido cerrado: no dejar que la IA rearme el carrito desde el historial
    if (
      session.ignorePriorOrderHistory &&
      session.cart.length === 0 &&
      guarded.actions?.addItems?.length
    ) {
      const code = this.catalogService.extractCodeFromMessage(text);
      const nameHits = this.catalogService.searchByName(text, products, 5);
      if (code == null && nameHits.length === 0) {
        delete guarded.actions.addItems;
      }
    }

    const cartCountBeforeAi = session.cart.length;

    const applied = await this.applyActions(conv, session, guarded.actions, products, cfg);
    session = this.applyDeliveryHintFromMessage(applied.session, text);
    if (session.cart.length > 0 && session.ignorePriorOrderHistory) {
      session = { ...session, ignorePriorOrderHistory: false };
    }
    if (applied.limitBlocked) {
      await this.conversationService.saveSession(conv, session);
      await this.handleCartLimitBlocked(conv, msg.waId, applied.limitBlocked, cfg);
      return;
    }

    if (ai.actions?.setCustomerName) {
      await this.conversationService.updateCustomerName(conv, ai.actions.setCustomerName);
    }

    // Si la IA intentó agregar producto con opciones → priorizar SOLO pedir la opción
    if (!session.pendingAttribute && ai.actions?.addItems?.length) {
      const guardedIds = new Set((guarded.actions?.addItems || []).map((i) => i.productId));
      const blocked = ai.actions.addItems.find((item) => {
        if (guardedIds.has(item.productId)) return false;
        const p = this.catalogService.getProductById(item.productId, products);
        return !!(p?.hasAttributes && p.attributes?.length);
      });
      if (blocked) {
        const product = this.catalogService.getProductById(blocked.productId, products);
        if (product?.hasAttributes) {
          session = {
            ...session,
            pendingAttribute: this.toPendingAttribute(product),
            pendingMatch: undefined,
          };
        }
      }
    }

    // Una sola pregunta por mensaje (nunca mezclar nombre/dirección con opciones de producto)
    if (session.pendingAttribute) {
      const pa = session.pendingAttribute;
      const product =
        this.catalogService.getProductById(pa.productId, products) ||
        ({
          id: pa.productId,
          name: pa.name,
          code: pa.code,
          price: pa.price,
          hasAttributes: true,
          attributes: pa.attributes,
          availableNow: true,
        } as MenuProduct);
      await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
      const attrPrompt = this.catalogService.formatProductOptionsPrompt(product, pa.selected || []);
      if (session.cart.length > cartCountBeforeAi) {
        const addedNames = session.cart.slice(cartCountBeforeAi).map((c) => c.name);
        await this.reply(
          conv,
          msg.waId,
          `${this.buildCartAddReply(session, cfg.defaultDeliveryFee, addedNames, {
            suffix: '',
          })}\n\n` +
            `Ahora elige opciones para *${product.name}*:\n\n${attrPrompt}`,
        );
      } else {
        await this.reply(conv, msg.waId, attrPrompt);
      }
      return;
    }

    if (session.pendingMatch?.candidates?.length && this.isPendingListRepromptText(text, session.pendingMatch)) {
      const family = this.catalogService.findProductVariantFamily(
        session.pendingMatch.query || text,
        products,
        session.pendingMatch.candidates,
      );
      if (family && family.variants.length >= 2) {
        await this.conversationService.saveSession(conv, session);
        await this.reply(conv, msg.waId, this.catalogService.formatVariantFamilyPrompt(family));
        return;
      }
      const catName = session.pendingMatch.candidates[0]?.categoryName;
      const allSameCat =
        catName &&
        session.pendingMatch.candidates.every((c) => c.categoryName === catName);
      if (allSameCat) {
        await this.conversationService.saveSession(conv, session);
        await this.reply(
          conv,
          msg.waId,
          this.catalogService.formatCategoryList(catName, session.pendingMatch.candidates),
        );
        return;
      }
      const opts = session.pendingMatch.candidates
        .map((c, i) => this.catalogService.formatProductListItem(c, i + 1))
        .join('\n\n');
      await this.conversationService.saveSession(conv, session);
      await this.reply(
        conv,
        msg.waId,
        `Encontré varias, mira:\n\n${opts}\n\nRespóndeme con el *número* o el *código*.`,
      );
      return;
    }

    // Checkout: no usar reply mezclado de la IA; una pregunta a la vez vía tryConfirmOrder
    const wantsCheckout =
      !!ai.actions?.requestConfirm ||
      /\b(confirmar|listo|finalizar|pagar|domicilio)\b/.test(lower) ||
      !!(ai.actions?.setCustomerName || ai.actions?.setAddress || ai.actions?.setPaymentMethod);

    if (wantsCheckout && session.cart.length > 0) {
      await this.conversationService.saveSession(conv, session);
      await this.tryConfirmOrder(conv, msg.waId, session);
      return;
    }

    await this.conversationService.saveSession(conv, session);

    // Reply limpio: solo texto de la IA (sin pegar listas ni warnings de opciones)
    let reply = (ai.reply || '').trim();
    if (exploringMenu && this.replyLooksLikeProductDump(reply)) {
      const overview = this.catalogService.formatMenuCategoryOverview(products, {
        intro: this.catalogService.buildMenuExploreIntro(text),
        menuUrl: cfg.menuUrl,
      });
      reply = overview.text;
      session = {
        ...session,
        pendingCategoryBrowse: { categories: overview.categories },
      };
    }
    const softWarnings = guarded.warnings.filter(
      (w) => !/requiere elegir|opciones inválidas|elige:/i.test(w),
    );
    if (softWarnings.length) {
      reply += `\n\n_${softWarnings.slice(0, 1).join(' ')}_`;
    }
    if (!reply) {
      reply = session.cart.length
        ? `${this.formatCartOnly(session, cfg.defaultDeliveryFee)}\n\n${this.formatContinueShoppingPrompt()}`
        : 'Dime qué quieres pedir por *nombre* o *código*, o escribe *menú*.';
    } else if (
      (guarded.actions?.addItems?.length ?? 0) > 0 &&
      session.cart.length > 0 &&
      !session.pendingAttribute &&
      !/\bas[ií]\s+va tu pedido|subtotal:/i.test(reply)
    ) {
      reply =
        `${reply.trim()}\n\n${this.formatCartOnly(session, cfg.defaultDeliveryFee)}\n\n` +
        this.formatContinueShoppingPrompt();
    }

    await this.reply(conv, msg.waId, reply);
  }

  private async applyActions(
    conv: WhatsappConversation,
    session: WhatsappSessionData,
    actions: AiOrderAction | undefined,
    products: MenuProduct[],
    cfg: EffectiveWhatsappConfig,
  ): Promise<{ session: WhatsappSessionData; limitBlocked?: CartLimitCheck }> {
    if (!actions) return { session };
    let next = { ...session };

    if (actions.clearCart) {
      next = {
        ...next,
        cart: [],
        pendingMatch: undefined,
        pendingAttribute: undefined,
        pendingMultiOrder: undefined,
        pendingCartRemoval: undefined,
        pendingCategoryBrowse: undefined,
      };
    }

    if (actions.setAddress) {
      const addr = actions.setAddress.trim();
      if (addr.length >= 10 && !this.isConfirmKeyword(addr) && !this.isGreetingKeyword(addr)) {
        next.address = addr;
        if (!this.isPickupIntent(addr)) next.orderType = 'delivery';
      }
    }
    if (actions.setOrderType === 'pickup') {
      next = this.applyPickupIntent(next, actions.setAddress || 'pickup');
    } else if (actions.setOrderType === 'delivery') {
      next.orderType = 'delivery';
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
      for (const item of actions.addItems) {
        const product = products.find((p) => p.id === item.productId);
        if (!product) continue;
        const attempt = this.tryAddProductToCart(
          next,
          product,
          item.quantity ?? 1,
          cfg,
          item.note,
          item.attributes,
        );
        if (attempt.blocked) {
          return { session: next, limitBlocked: attempt.blocked };
        }
        next = attempt.session;
      }
    }

    if (actions.removeProductIds?.length) {
      next.cart = next.cart.filter((c) => !actions.removeProductIds!.includes(c.productId));
    }

    if (actions.requestHuman) {
      await this.conversationService.setHumanTakeover(conv.id, true);
    }

    return { session: next };
  }

  private toCartLimitsConfig(cfg: EffectiveWhatsappConfig): WhatsappCartLimitsConfig {
    return {
      minOrderAmount: Math.max(0, Number(cfg.minOrderAmount) || 0),
      maxOrderAmount: Math.max(0, Number(cfg.maxOrderAmount) || 0),
      maxUnitsPerItem: Math.max(0, Number(cfg.maxUnitsPerItem) || 0),
      maxTotalUnits: Math.max(0, Number(cfg.maxTotalUnits) || 0),
      maxCartLines: Math.max(0, Number(cfg.maxCartLines) || 0),
      handoffWhenMaxExceeded: cfg.handoffWhenMaxExceeded !== false,
      defaultDeliveryFee: Math.max(0, Number(cfg.defaultDeliveryFee) || 0),
    };
  }

  private tryAddProductToCart(
    session: WhatsappSessionData,
    product: MenuProduct,
    quantity: number,
    cfg: EffectiveWhatsappConfig,
    note?: string,
    attributes?: { attributeName: string; attributeValue: string }[],
  ): { session: WhatsappSessionData; blocked?: CartLimitCheck } {
    const projected = this.addProductToCart(session, product, quantity, note, attributes);
    const check = evaluateCartLimits(projected.cart, this.toCartLimitsConfig(cfg), {
      orderType: projected.orderType,
    });
    if (!check.ok) return { session, blocked: check };
    return {
      session: {
        ...projected,
        ignorePriorOrderHistory: false,
      },
    };
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
      await this.conversationService.setHumanTakeover(conv.id, true);
      await this.reply(
        conv,
        waId,
        cfg.largeOrderHandoffMessage ||
          `${blocked.reason || 'Ese pedido se sale del tope por WhatsApp.'}\n\n${cfg.humanHandoffMessage}`,
      );
      return;
    }
    await this.reply(conv, waId, blocked.reason || 'Ese pedido supera el límite permitido.');
  }

  private addProductToCart(
    session: WhatsappSessionData,
    product: MenuProduct,
    quantity: number,
    note?: string,
    attributes?: { attributeName: string; attributeValue: string }[],
  ): WhatsappSessionData {
    const cart: WhatsappCartItem[] = [...session.cart];
    for (let i = 0; i < Math.max(1, quantity); i++) {
      cart.push({
        productId: product.id,
        name: product.name,
        code: product.code,
        quantity: 1,
        unitPrice: product.price,
        note,
        attributes,
      });
    }
    return { ...session, cart };
  }

  private toPendingAttribute(product: MenuProduct): WhatsappPendingAttribute {
    return {
      productId: product.id,
      name: product.name,
      code: product.code,
      price: product.price,
      attributes: product.attributes || [],
      selected: [],
    };
  }

  private buildSessionSummary(
    conv: WhatsappConversation,
    session: WhatsappSessionData,
    deliveryFee: number,
  ): string {
    const subtotal = session.cart.reduce((s, c) => s + c.unitPrice, 0);
    const fee = session.orderType === 'delivery' ? deliveryFee : 0;
    const lines = [
      `Nombre: ${conv.customerName || '(pendiente)'}`,
      `Teléfono: ${conv.phoneE164}`,
      `Dirección: ${session.address || '(pendiente)'}`,
      `Tipo: ${session.orderType}`,
      `Pago: ${session.paymentMethod || '(pendiente)'}`,
      `Carrito (${session.cart.length}): ${session.cart.map((c) => `${c.name} $${Math.round(c.unitPrice).toLocaleString('es-CO')}`).join(', ') || 'vacío'}`,
      `Subtotal sistema: $${Math.round(subtotal).toLocaleString('es-CO')} + domicilio $${Math.round(fee).toLocaleString('es-CO')}`,
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
      );
      const next = remaining[0];
      lines.push(
        `ELECCIÓN PENDIENTE: producto "${pa.name}" (código ${pa.code}, id ${pa.productId}).` +
          (pa.selected?.length
            ? ` Ya eligió: ${pa.selected.map((s) => `${s.attributeName}=${s.attributeValue}`).join(', ')}.`
            : '') +
          (next
            ? ` Falta elegir "${next.attributeName}": ${next.options.map((o, i) => `${i + 1}) ${o}`).join(', ')}.`
            : ''),
      );
    }
    if (session.pendingMatch?.candidates?.length) {
      lines.push(
        `LISTA PENDIENTE (${session.pendingMatch.candidates.length}): el cliente debe elegir número o código.`,
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
    return lines.join('\n');
  }

  /** La IA a veces vuelca códigos 1-9; lo reemplazamos por resumen de categorías. */
  private replyLooksLikeProductDump(reply: string): boolean {
    const codeHits = (reply.match(/\bc[oó]d(?:igo|\.)?\s*\d{1,3}\b/gi) || []).length;
    const numberedList = (reply.match(/^\s*\d{1,2}[.)]\s/mg) || []).length;
    return codeHits >= 4 || numberedList >= 5;
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
      this.catalogService.formatCategoryList(hit.categoryName, hit.products),
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

  private async tryHandleVariantFamily(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    products: MenuProduct[],
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    const family = this.catalogService.findProductVariantFamily(text, products);
    if (!family || family.variants.length < 2) return false;

    const picked = this.catalogService.pickVariantFromFamilyText(text, family);
    if (picked) {
      session = { ...session, pendingMatch: undefined };
      if (picked.hasAttributes && picked.attributes?.length) {
        if (await this.handleProductWithVariants(conv, waId, session, picked, text, cfg)) {
          return true;
        }
      }
      const added = this.tryAddProductToCart(session, picked, 1, cfg);
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
        this.buildCartAddReply(session, cfg.defaultDeliveryFee, picked.name),
      );
      return true;
    }

    session = {
      ...session,
      pendingMatch: { query: text, candidates: family.variants },
    };
    await this.conversationService.saveSession(conv, session);
    await this.reply(conv, waId, this.catalogService.formatVariantFamilyPrompt(family));
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

    const trimmed = text.trim();
    const code = this.catalogService.extractCodeFromMessage(text);
    const bareNum = /^[1-9]\d{0,3}$/.test(trimmed) ? parseInt(trimmed, 10) : null;
    let chosenLite = pending.candidates.find((c) => code != null && c.code === code) ?? null;

    if (!chosenLite && bareNum != null && bareNum >= 1 && bareNum <= pending.candidates.length) {
      chosenLite = pending.candidates[bareNum - 1];
    }

    if (!chosenLite && code != null) {
      const found = this.catalogService.findByCode(code, products);
      if (found && pending.candidates.some((c) => c.id === found.id)) {
        chosenLite = found;
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

    session = { ...session, pendingMatch: undefined };
    session = this.applyDeliveryHintFromMessage(session, text);

    if (chosen.hasAttributes && chosen.attributes?.length) {
      if (await this.handleProductWithVariants(conv, waId, session, chosen, text, cfg)) {
        return true;
      }
    }

    const added = this.tryAddProductToCart(session, chosen, 1, cfg);
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
      this.buildCartAddReply(session, cfg.defaultDeliveryFee, chosen.name, {
        extraLine: session.address?.trim()
          ? `\nDomicilio anotado: _${session.address.trim()}_`
          : undefined,
      }),
    );
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
    );
    const nextAttr = remainingAttrs[0];
    const optionsHint = nextAttr
      ? nextAttr.options.map((o, i) => `${i + 1}) ${o}`).join(', ')
      : '';

    const rulesBlock = buildWhatsappBusinessRulesBlock({
      brandName: cfg.brandName || cfg.localContext?.restaurantName || 'Pronto Pollo Portal',
      businessStatus: businessOpenForBot ? { ...status, isOpen: true } : status,
      deliveryFee: cfg.defaultDeliveryFee,
      allowMercadoPago: !!cfg.allowMercadoPago,
      menuProductCount: products.filter((p) => p.availableNow !== false).length,
      localContextBlock: cfg.localContextBlock,
      orderLimitsBlock: buildOrderLimitsPromptBlock(this.toCartLimitsConfig(cfg)),
      paymentMethods: cfg.paymentMethods,
    });

    const ai = await this.aiService.generateTurn({
      userMessage: text,
      businessRulesBlock: rulesBlock,
      menuDetailedText: menuDetailed,
      sessionSummary: this.buildSessionSummary(conv, session, cfg.defaultDeliveryFee),
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

    const applied = await this.applyActions(conv, session, guarded.actions, products, cfg);
    // Preservar elección pendiente sí o sí
    const nextSession = {
      ...applied.session,
      pendingAttribute: session.pendingAttribute,
    };
    if (ai.actions?.setCustomerName) {
      await this.conversationService.updateCustomerName(conv, ai.actions.setCustomerName);
    }
    await this.conversationService.saveSession(conv, nextSession, 'awaiting_attribute');

    let reply = (ai.reply || '').trim();
    if (!reply) {
      reply = `Claro. Cuando quieras, elige la opción para *${pendingProduct.name}*.`;
    }
    if (
      nextAttr &&
      !/\b(elige|eleg[ií]|opci[oó]n|responde\s*[123]|cuando quieras|falta)\b/i.test(reply)
    ) {
      reply += `\n\n_Cuando quieras: ${nextAttr.attributeName} → ${optionsHint}_`;
    }
    return reply;
  }

  private formatContinueShoppingPrompt(): string {
    return '¿Te gustaría agregar algo más? Cuando quieras escribe *confirmar*.';
  }

  private formatCartOnly(session: WhatsappSessionData, deliveryFee: number): string {
    if (!session.cart.length) return '🛒 Carrito vacío';
    const subtotal = session.cart.reduce((s, c) => s + c.unitPrice, 0);
    const fee = session.orderType === 'delivery' ? deliveryFee : 0;
    const total = subtotal + fee;
    const lines = session.cart.map((c) => {
      const attrs = c.attributes?.length
        ? ` (${c.attributes.map((a) => a.attributeValue).join(', ')})`
        : '';
      return `• ${c.name}${attrs} — $${Math.round(c.unitPrice).toLocaleString('es-CO')}`;
    });
    return (
      `🛒 *Así va tu pedido*\n` +
      lines.join('\n') +
      `\n\nSubtotal: $${Math.round(subtotal).toLocaleString('es-CO')}` +
      (fee ? `\nDomicilio: $${Math.round(fee).toLocaleString('es-CO')}` : '') +
      `\n*Total: $${Math.round(total).toLocaleString('es-CO')}*`
    );
  }

  /** Confirmación de ítem + carrito actual + invitación a seguir pidiendo. */
  private buildCartAddReply(
    session: WhatsappSessionData,
    deliveryFee: number,
    added: string | string[],
    opts?: { extraLine?: string; suffix?: string },
  ): string {
    const names = (Array.isArray(added) ? added : [added]).filter(Boolean);
    let head =
      names.length === 1
        ? `Listo, te agregué *${names[0]}* ✅`
        : `Listo, te agregué:\n${names.map((n) => `• *${n}*`).join('\n')} ✅`;
    if (opts?.extraLine) head += `\n${opts.extraLine}`;

    return (
      `${head}\n\n${this.formatCartOnly(session, deliveryFee)}\n\n` +
      (opts?.suffix ?? this.formatContinueShoppingPrompt())
    );
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
    return (
      `${this.formatCartOnly(session, deliveryFee)}\n` +
      `\n🛵 Tipo: ${tipo}` +
      `\n👤 Nombre: ${conv.customerName || '(pendiente)'}` +
      `\n${lugarLabel}: ${session.address || '(pendiente)'}` +
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

  private isReadyToConfirm(session: WhatsappSessionData, conv: WhatsappConversation): boolean {
    return (
      session.cart.length > 0 &&
      !!conv.customerName?.trim() &&
      !!session.address?.trim() &&
      !!session.paymentMethod
    );
  }

  private async tryConfirmOrder(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
  ): Promise<void> {
    const cfg = await this.settingsService.getEffectiveConfig();

    if (!session.cart.length) {
      await this.reply(conv, waId, 'Aún no tienes nada en el carrito. Dime qué quieres por nombre o código.');
      return;
    }

    const limitsCfg = this.toCartLimitsConfig(cfg);
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
      await this.reply(conv, waId, minCheck.reason || 'El pedido no alcanza el mínimo.');
      return;
    }

    if (!conv.customerName?.trim()) {
      session.pendingMatch = undefined;
      session.pendingAttribute = undefined;
      await this.conversationService.saveSession(conv, session, 'awaiting_name');
      await this.reply(
        conv,
        waId,
        `${this.formatCartOnly(session, cfg.defaultDeliveryFee)}\n\n` +
          `Para seguir, ¿me regalas tu *nombre completo*?`,
      );
      return;
    }
    if (!session.address?.trim()) {
      session.pendingMatch = undefined;
      session.pendingAttribute = undefined;
      // Pickup: no pedir dirección de calle
      if (session.orderType === 'pickup') {
        session.address = session.address?.trim() || 'Recoge en el local';
        await this.conversationService.saveSession(conv, session);
        // continuar al pago / confirmación
      } else {
        await this.conversationService.saveSession(conv, session, 'awaiting_address');
        await this.reply(
          conv,
          waId,
          `${this.formatCartOnly(session, cfg.defaultDeliveryFee)}\n\n` +
            `¿Te lo mandamos a *domicilio* o *pasas tú*?\n` +
            `• Domicilio: escribe la dirección completa.\n` +
            `• Si pasas: p. ej. *paso en 15 minutos*.`,
        );
        return;
      }
    }
    if (!session.paymentMethod) {
      session.pendingMatch = undefined;
      session.pendingAttribute = undefined;
      await this.conversationService.saveSession(conv, session, 'awaiting_payment');
      await this.reply(
        conv,
        waId,
        `${this.formatCartOnly(session, cfg.defaultDeliveryFee)}\n\n` +
          buildPaymentOptionsPrompt(cfg.paymentMethods, cfg.paymentInstructions),
      );
      return;
    }

    // Notas / cambio (una sola vez)
    if (cfg.askOrderNotes !== false && !session.notesCollected) {
      session.pendingMatch = undefined;
      session.pendingAttribute = undefined;
      await this.conversationService.saveSession(conv, session, 'awaiting_notes');
      await this.reply(conv, waId, this.buildAskNotesMessage(cfg, session));
      return;
    }

    // Datos listos: mostrar carrito + total y pedir confirmación (aún no crea)
    if (conv.state !== 'awaiting_final_confirm') {
      if (
        session.pendingRedemptionCode &&
        !this.pointsHandler.cartHasHalfChicken(session.cart)
      ) {
        await this.conversationService.saveSession(conv, session, 'awaiting_final_confirm');
        await this.reply(
          conv,
          waId,
          `${this.formatOrderSummary(conv, session, cfg.defaultDeliveryFee, cfg.paymentMethods)}\n\n` +
            `${formatCartNeedsHalfChickenForPremio()}\n\n` +
            `Cuando agregues el medio pollo, escribe *confirmar*.`,
        );
        return;
      }
      await this.conversationService.saveSession(conv, session, 'awaiting_final_confirm');
      await this.reply(
        conv,
        waId,
        `${this.formatOrderSummary(conv, session, cfg.defaultDeliveryFee, cfg.paymentMethods)}\n\n` +
          `Si todo te cuadra, escribe *confirmar* y armamos el pedido.`,
      );
      return;
    }

    const items = session.cart.flatMap((c) =>
      Array.from({ length: c.quantity }, () => ({
        productId: c.productId,
        note: c.note,
        attributes: c.attributes,
      })),
    );

    const extras = this.buildOrderExtras(session);

    const orderDto: CreateOrderDto = {
      customerName: conv.customerName.trim(),
      phone: conv.phoneE164,
      address: session.address.trim(),
      orderType: session.orderType,
      deliveryFee: session.orderType === 'delivery' ? cfg.defaultDeliveryFee : undefined,
      orderSource: 'whatsapp',
      items,
      ...(extras.length ? { extras } : {}),
      ...(session.pendingRedemptionCode
        ? { redemptionCode: session.pendingRedemptionCode }
        : {}),
      clientRequestId: `wa-${conv.id}-${randomUUID()}`.slice(0, 64),
    };

    if (
      session.pendingRedemptionCode &&
      !this.pointsHandler.cartHasHalfChicken(session.cart)
    ) {
      await this.reply(
        conv,
        waId,
        `${formatCartNeedsHalfChickenForPremio()}\n\nAgrega medio pollo (cód. 2 o 5) y vuelve a *confirmar*.`,
      );
      return;
    }

    try {
      const payMethod =
        getEnabledPaymentMethods(cfg.paymentMethods).find(
          (m) => m.id === session.paymentMethod,
        ) || findPaymentMethodByText(session.paymentMethod || '', cfg.paymentMethods);

      if (payMethod?.flow === 'mercadopago' || session.paymentMethod === 'mercadopago') {
        const subtotal = session.cart.reduce((s, c) => s + c.unitPrice, 0);
        const total = subtotal + (orderDto.deliveryFee ?? 0);
        const mpItems = session.cart.map((c) => ({
          title: c.name,
          quantity: 1,
          unit_price: c.unitPrice,
        }));
        const pref = await this.paymentsService.createPreference(
          orderDto,
          mpItems,
          total,
          {
            name: conv.customerName.trim(),
            email: `${conv.phoneE164.replace(/\D/g, '')}@whatsapp.ppp.local`,
            phone: conv.phoneE164,
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
        await this.reply(
          conv,
          waId,
          `${this.formatOrderSummary(conv, session, cfg.defaultDeliveryFee, cfg.paymentMethods)}\n\n` +
            `Link de pago Mercado Pago:\n${pref.initPoint}\n\nCuando el pago se confirme, te avisamos aquí y armamos el pedido.`,
        );
        return;
      }

      const order = await this.ordersService.create(orderDto);
      const snapshot = { ...session };
      await this.conversationService.resetOrderSession(conv, 'completed', {
        ignorePriorHistory: true,
      });
      await this.reply(
        conv,
        waId,
        this.formatOrderSuccessMessage(
          conv,
          snapshot,
          order,
          cfg.defaultDeliveryFee,
          cfg.orderSuccessMessage,
          cfg.paymentMethods,
        ),
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al crear pedido';
      this.logger.error(`Order create failed: ${message}`);
      await this.reply(conv, waId, `Uy, no pude registrar el pedido: ${message}. Escribe *humano* y te ayudamos.`);
    }
  }

  /** Tras pago MP aprobado (llamado desde payments webhook). */
  async completeAfterMercadoPagoPayment(params: {
    conversationId: number;
    waId: string;
    orderId: number;
  }): Promise<void> {
    try {
      const conv = await this.conversationService.getConversation(params.conversationId);
      const session = this.conversationService.getSession(conv);
      const cfg = await this.settingsService.getEffectiveConfig();
      const snapshot = { ...session };
      await this.conversationService.resetOrderSession(conv, 'completed', {
        ignorePriorHistory: true,
      });
      const success =
        this.formatOrderSuccessMessage(
          conv,
          snapshot,
          { orderId: params.orderId },
          cfg.defaultDeliveryFee,
          cfg.orderSuccessMessage,
          cfg.paymentMethods,
        ) || `Pago recibido ✅ Pedido #${params.orderId} creado. ${cfg.orderSuccessMessage}`;
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
    const conv = await this.conversationService.getConversation(conversationId);
    if (!conv.humanTakeover) {
      await this.conversationService.setHumanTakeover(conversationId, true, agent);
    }
    await this.metaService.sendText(conv.waId, body);
    await this.conversationService.logMessage({
      conversationId: conv.id,
      direction: 'out',
      body,
      sentBy: 'human',
    });
    await this.conversationService.touchOutbound(conv, 'human');
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

  private humanHelpHint(): string {
    return 'Si prefieres, escribe *asesor* o *humano* y una persona te atiende por aquí 😊';
  }

  /** "la ensalada de qué", "qué lleva", ingredientes, alérgenos… */
  private isProductCompositionQuestion(text: string): boolean {
    const t = text.trim();
    if (!t || t.length < 6) return false;
    if (/^(quiero|dame|ponme|agrega|agregame|me regalas|me das|voy a pedir)\s/i.test(t)) {
      return false;
    }
    if (this.catalogService.isPriceInquiryIntent(text)) return false;

    const q = t
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const patterns = [
      /\bde\s+que\b/,
      /\bde\s+que\s+es\b/,
      /\bde\s+que\s+tr(ae|ae)/,
      /\bque\s+lleva\b/,
      /\bque\s+trae\b/,
      /\bcon\s+que\s+viene\b/,
      /\bque\s+ingredientes\b/,
      /\bque\s+tiene\b/,
      /\b(incluye|trae|viene)\s+con\b/,
      /\b(tiene|lleva|trae)\s+(cebolla|aji|ají|huevo|huevos|queso|lechuga|tomate|gluten|lacteos|lácteos)\b/,
      /\b(alergeno|alergenos|alérgeno|alérgenos)\b/,
      /\b(composicion|composición|preparacion|preparación)\b/,
    ];
    if (patterns.some((p) => p.test(q))) return true;
    return (
      /\?/.test(t) &&
      /\b(lleva|trae|viene|ingredientes|ensalada|sopa|arroz|pollo|bebida|postre)\b/i.test(t)
    );
  }

  private findProductForCompositionQuestion(text: string, products: MenuProduct[]): MenuProduct | null {
    const embedded = this.catalogService.findProductEmbeddedInMessage(text, products);
    if (embedded) return embedded;
    const query = this.catalogService.extractProductSearchQuery(text);
    const scored = this.catalogService.searchByNameScored(query, products, 5);
    if (scored.length === 1 && scored[0].score >= 40) return scored[0].p;
    if (scored.length >= 1 && this.catalogService.isStrongProductMatch(scored)) return scored[0].p;
    return null;
  }

  private buildProductCompositionReply(
    text: string,
    product: MenuProduct | null,
    cfg: Awaited<ReturnType<WhatsappSettingsService['getEffectiveConfig']>>,
  ): string {
    const allergens = (cfg.localContext?.allergensNote || '').trim();
    const desc = product?.description?.trim();

    let msg = 'No tengo esa información por este chat 😅';

    if (product && desc) {
      msg += `\n\nEn el menú de *${product.name}* solo aparece:\n_${desc}_`;
    } else if (product) {
      msg += `\n\nSobre *${product.name}*, no tengo el detalle de ingredientes aquí.`;
    }

    if (allergens && /\b(alergeno|alérgeno|gluten|lacteo|lácteo|celiaco)\b/i.test(text)) {
      msg += `\n\nLo que sí tenemos registrado sobre alérgenos:\n_${allergens}_`;
    }

    msg += `\n\n${this.humanHelpHint()}`;
    return msg;
  }

  private async tryHandleProductCompositionQuestion(
    conv: WhatsappConversation,
    waId: string,
    text: string,
    products: MenuProduct[],
    cfg: Awaited<ReturnType<WhatsappSettingsService['getEffectiveConfig']>>,
  ): Promise<boolean> {
    if (!this.isProductCompositionQuestion(text)) return false;
    const product = this.findProductForCompositionQuestion(text, products);
    await this.reply(conv, waId, this.buildProductCompositionReply(text, product, cfg));
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

    return analysis.textForBot?.trim() || null;
  }

  private async resolveImageMessage(
    msg: IncomingWhatsappMessage,
    loggedMessageId: string,
    conv: WhatsappConversation,
    cfg: Awaited<ReturnType<WhatsappSettingsService['getEffectiveConfig']>>,
  ): Promise<{ done: true } | { done: false; text: string }> {
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

      if (analysis.kind === 'payment_proof') {
        await this.conversationService.updateMessageBody(
          loggedMessageId,
          `🧾 Comprobante de pago${caption ? `: ${caption}` : ''}`,
        );
        await this.conversationService.setHumanTakeover(conv.id, true);
        await this.reply(
          conv,
          msg.waId,
          analysis.reply ||
            'Recibí tu comprobante ✅ Un asesor lo revisa en un momento.\n\n' + this.humanHelpHint(),
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
        if (analysis.kind !== 'payment_proof') {
          orderText = this.resolveImageOrderText(analysis, caption, products);
        }
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
      await this.reply(
        conv,
        msg.waId,
        analysis.reply || this.aiService.imageFallbackReply(),
      );
      return { done: true };
    } catch (err) {
      this.logger.error(`Image resolve failed: ${err}`);
      await this.reply(
        conv,
        msg.waId,
        'No pude abrir la imagen 😅 ¿Me escribes el pedido (código o nombre)?\n\n' + this.humanHelpHint(),
      );
      return { done: true };
    }
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

    const t = this.normalizeForMatch(text);
    if (!t) return false;

    if (
      /^(reiniciar|empezar\s+de\s+nuevo|borrar\s+carrito|limpiar\s+carrito|vaciar\s+carrito|vaciar\s+pedido|borrar\s+pedido|borrar\s+todo|quitar\s+todo|limpiar\s+todo|vaciar\s+todo)$/.test(
        t,
      )
    ) {
      return true;
    }

    if (/\b(limpiar|vaciar|borrar|quitar)\s+(el\s+)?(carrito|pedido|todo)\b/.test(t)) {
      return true;
    }
    if (/\b(carrito|pedido)\s+(vacio|limpio|en blanco)\b/.test(t)) {
      return true;
    }
    if (/^(ya\s+)?no\s+quiero\s+nada\b/.test(t)) {
      return true;
    }
    if (/\bdejar\s+(el\s+)?(carrito|pedido)\s+(vacio|en blanco)\b/.test(t)) {
      return true;
    }

    return false;
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
      q = q.replace(/^(el|la|los|las|un|una|unos|unas)\s+/i, '').trim();
      const qNorm = this.normalizeForMatch(q);
      if (qNorm.length < 3 || reject.has(qNorm)) continue;
      if (/^(producto|plato|item|item)$/i.test(qNorm)) continue;
      return q;
    }

    return null;
  }

  private formatCartLineLabel(item: WhatsappCartItem): string {
    const attrs = item.attributes?.length
      ? ` (${item.attributes.map((a) => a.attributeValue).join(', ')})`
      : '';
    return `*${item.name}*${attrs}`;
  }

  private matchCartItemsForRemoval(
    query: string,
    session: WhatsappSessionData,
    products: MenuProduct[],
  ):
    | { kind: 'none' }
    | { kind: 'single'; indices: number[]; label: string }
    | { kind: 'ambiguous'; options: Array<{ cartIndex: number; label: string }> } {
    const q = this.normalizeForMatch(query);
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

  private async tryHandleCartModification(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    text: string,
    products: MenuProduct[],
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    const trimmed = text.trim();

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
          `Listo, quité ${removedLabel}.\n\n${this.formatCartOnly(session, cfg.defaultDeliveryFee)}\n\n${this.formatContinueShoppingPrompt()}`,
        );
        return true;
      }
    }

    if (/^ya\s+no[\s!.?]*$/i.test(trimmed) && session.pendingAttribute) {
      session = {
        ...session,
        pendingAttribute: undefined,
        pendingCartRemoval: undefined,
      };
      await this.conversationService.saveSession(conv, session, 'building_cart');
      await this.reply(
        conv,
        waId,
        'Listo, no agregamos ese producto 👍 ¿Qué más te gustaría?',
      );
      return true;
    }

    if (this.isClearCartIntent(text)) {
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

    const removalQuery = this.extractCartRemovalQuery(text);
    if (!removalQuery) return false;

    if (!session.cart.length) {
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
        `No encontré *${removalQuery}* en tu carrito.\n\n${this.formatCartOnly(session, cfg.defaultDeliveryFee)}`,
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
      `Listo, quité ${match.label}${removedNote}.\n\n${this.formatCartOnly(session, cfg.defaultDeliveryFee)}\n\n${this.formatContinueShoppingPrompt()}`,
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
          `Por este chat no puedo cancelártelo. Si necesitas ayuda, escribe *humano* y el equipo te atiende.` +
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

  private isConfirmKeyword(text: string): boolean {
    return /^(confirmar|confirmo|listo pedido|finalizar)$/i.test(text.trim()) ||
      /\b(confirmar|confirmo|listo pedido|finalizar)\b/i.test(text.trim());
  }

  private isGreetingKeyword(text: string): boolean {
    const t = text.trim().toLowerCase();
    return /^(hola|buenas|buen[oa]s?\s*(d[ií]as|tardes|noches)?|hey|hi|menu|menú|ver menu|ver menú)[\s!.?]*$/i.test(
      t,
    );
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
      /\b(pollo|medio|cuarto|entero|porcion|porciones|sopa|bebida|gaseosa|limonada|arepa|papa|maduro|chorizo|alas|pechuga|combo|menudencia|arroz|bandeja|chino|paisa)\b/i.test(
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
    const linkLine = menuUrl
      ? `\n\nSi quieres mirar la carta: ${menuUrl}`
      : `\n\nTambién puedes escribir *menú* para el link.`;
    return (
      `¡Dale! ¿Qué se te antoja?\n\n` +
      `Pídeme por *nombre* o *código* del producto (ej. "medio pollo" o "28").` +
      linkLine
    );
  }

  /** “pásame el menú”, “link del menú”, “carta”, etc. — no es un pedido. */
  private isMenuLinkIntent(text: string): boolean {
    const t = text
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (!t) return false;
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
    if (
      /\b(pasame|dame|enviame|mandame|comparte)\b.{0,20}\b(link|enlace|url)\b/i.test(t)
    ) {
      return true;
    }
    if (/^(ver\s+)?(el\s+)?(menu|carta)(\s+completo)?[\s!.?]*$/i.test(t)) return true;
    if (/^(link|enlace)\s+(del?\s+)?(menu|carta)[\s!.?]*$/i.test(t)) return true;
    return false;
  }

  private isPickupIntent(text: string): boolean {
    const t = text.trim().toLowerCase();
    if (t.length < 4) return false;
    if (/\b(codigo|código|code)\s*\d+/i.test(t)) return false;
    return (
      /\b(para\s+llevar|pickup|recogida|pasar[eé]\s+a\s+recoger|lo\s+recojo|voy\s+por\s+(é|e)l|paso\s+yo|sin\s+domicilio|no\s+(quiero\s+)?domicilio)\b/i.test(
        t,
      ) ||
      /\b(paso|pasar[eé]|pasar|voy|recojo|recoger|llegar[eé]|llego)\b.{0,50}\b(minutos?|mins?|horas?|hrs?|rato|momento)\b/i.test(
        t,
      ) ||
      /\b(en|para)\s+\d{1,3}\s*(-|a|o|\/)?\s*\d{0,3}\s*(minutos?|mins?)\b.{0,30}\b(paso|recojo|voy|pasar)/i.test(
        t,
      ) ||
      /\bpaso\s+en\s+\d/i.test(t) ||
      /\brecojo\s+(en|por|a)\b/i.test(t) ||
      /\b(paso|pasar[eé])\s+por\s+(el\s+)?(local|restaurante|all[ií]|allá)\b/i.test(t)
    );
  }

  private isDeliveryIntent(text: string): boolean {
    const t = text.trim().toLowerCase();
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

  private applyDeliveryHintFromMessage(
    session: WhatsappSessionData,
    text: string,
  ): WhatsappSessionData {
    const addr = this.extractDeliveryTail(text);
    if (!addr) return session;
    return {
      ...session,
      orderType: 'delivery',
      address: addr,
    };
  }

  private normalizeDeliveryAddress(raw: string): string {
    return (raw || '')
      .replace(/\s+/g, ' ')
      .replace(/^[\s,.-]+|[\s,.-]+$/g, '')
      .trim();
  }

  private isPlausibleDeliveryAddress(text: string): boolean {
    const t = text.trim();
    if (!t || t.length < 3) return false;
    if (this.isConfirmKeyword(t) || this.isGreetingKeyword(t)) return false;
    if (this.isPickupIntent(t)) return false;
    if (/^(contraentrega|efectivo|mercado\s*pago|humano)$/i.test(t)) return false;
    if (/\b(minutos?|mins?|horas?)\b/i.test(t) && !/\b(habitaci[oó]n|apto|apartamento|calle|carrera|barrio|torre)\b/i.test(t)) {
      return false;
    }

    if (
      /\b(habitaci[oó]n|apto?|apartamento|cuarto|suite|oficina|hostal|hotel|residencia)\b/i.test(t) &&
      /\d/.test(t)
    ) {
      return true;
    }
    if (/\b(domicilio|la casa|mi casa|mi direccion|mi dirección)\b/i.test(t)) return true;
    if (this.looksLikeAddress(t)) return true;

    return t.length >= 6 && /\d/.test(t);
  }

  private extractDeliveryTail(text: string): string | null {
    const raw = (text || '').trim();
    if (!raw) return null;

    const tailPatterns = [
      /\bpara\b\s+(.+)$/is,
      /\ba la\b\s+(.+)$/is,
      /\ben la\b\s+(.+)$/is,
      /\ba\b\s+(?:la|el)\s+(.+)$/is,
      /\ben\b\s+(?:la|el|los|las)\s+(.+)$/is,
      /\b(?:enviar|mandar|llevar|traer)\s+(?:a|en|para)\s+(.+)$/is,
    ];

    for (const pattern of tailPatterns) {
      const m = raw.match(pattern);
      if (!m?.[1]) continue;
      const addr = this.normalizeDeliveryAddress(m[1]);
      if (addr && this.isPlausibleDeliveryAddress(addr)) return addr;
    }

    const inlinePatterns = [
      /\b(?:para|a|en)\s+(?:la\s+|el\s+)?(habitaci[oó]n\s*(?:n[°o]?\.?\s*)?\d{1,4}[a-z]?)\b/i,
      /\b(?:para|a|en)\s+(?:la\s+|el\s+)?((?:apto?|apartamento|cuarto|suite|oficina)\s*(?:n[°o]?\.?\s*)?\d{1,4}[a-z]?)\b/i,
      /\b(habitaci[oó]n\s*(?:n[°o]?\.?\s*)?\d{1,4}[a-z]?)\b/i,
      /\b(?:apto?|apartamento|cuarto|suite|oficina)\s*(?:n[°o]?\.?\s*)?\d{1,4}[a-z]?\b/i,
      /\b(?:torre|bloque|piso|interior|local)\s+[a-z0-9#\-\s]{1,24}\d{1,4}[a-z]?\b/i,
    ];

    for (const pattern of inlinePatterns) {
      const m = raw.match(pattern);
      if (!m?.[0]) continue;
      const addr = this.normalizeDeliveryAddress(m[1] || m[0]);
      if (addr && this.isPlausibleDeliveryAddress(addr)) return addr;
    }

    return null;
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
      /\b(calle|carrera|cra|cll|av\.?|avenida|diag|diagonal|transversal|barrio|conjunto|apto|apartamento|torre|casa|mz|manzana|#)\b/i.test(
        t,
      )
    ) {
      return true;
    }
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

  private buildAskNotesMessage(
    cfg: Awaited<ReturnType<WhatsappSettingsService['getEffectiveConfig']>>,
    session?: WhatsappSessionData,
  ): string {
    const hint = (cfg.localContext?.cashChangeNote || '').trim();
    const existing = session?.customerNotes?.trim();
    let msg = existing
      ? `Ya anoté: _${existing}_\n\n¿Algo *más* para cocina o domicilio (o cambio si pagas en efectivo)?`
      : '¿Alguna *nota* para el pedido o *cambio* (con cuánto pagas)?';
    msg +=
      '\nEj: _platos y cubiertos_ / _sin cebolla_ / _timbre 302_ / _cambio de 50 mil_ / _traer vueltas de 20 mil_.\n' +
      'Si no aplica, escribe *ninguno*.';
    if (hint) msg += `\n\n_${hint}_`;
    return msg;
  }

  /** Mensaje suelto que parece nota de cocina/domicilio, no un producto nuevo. */
  private looksLikeStandaloneOrderNote(text: string): boolean {
    const t = text.trim();
    const lower = t.toLowerCase();
    if (t.length < 4 || t.length > 220) return false;
    if (/\b(quiero|dame|ponme|agrega|agregar|pedir|ordenar|confirmar|men[uú]|c[oó]digo)\b/.test(lower)) {
      return false;
    }
    const patterns = [
      /^(sin|no\s+quiero)\s+/i,
      /\b(platos?\s*y\s*cubiertos?|solo\s*cubiertos?|con\s*cubiertos?)\b/i,
      /\b(timbre|apto|apartamento|torre|piso|intercomunicador|porter[ií]a|rejas?)\b/i,
      /\b(cambio\s+de|billete|paga\s+con|vueltas?|devuelta|traer?\s+vueltas?|trae\s+vueltas?|traeme\s+vueltas?)\b/i,
      /\bsin\s+(cebolla|aj[ií]|sal|picante|huevo|queso|tomate)\b/i,
      /^(nota|notas?)[:\s]/i,
    ];
    return patterns.some((p) => p.test(t));
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

  /** Nota suelta en mitad del pedido (sin marcar notesCollected). */
  private applyInlineOrderNote(session: WhatsappSessionData, text: string): WhatsappSessionData {
    const t = text.trim();
    const change = this.extractCashChangeFromText(t);
    let next = { ...session };
    if (change) {
      next.cashChangeFor = change;
    }
    const rest = this.stripCashChangePhrases(t);
    if (rest && !/^(ninguno|ninguna|no|nada)$/i.test(rest)) {
      next = this.appendCustomerNote(next, rest);
    } else if (!change) {
      next = this.appendCustomerNote(next, t);
    }
    return next;
  }

  private formatInlineNoteAck(session: WhatsappSessionData): string {
    const parts: string[] = [];
    if (session.cashChangeFor?.trim()) {
      parts.push(`Anotado 💵 _${session.cashChangeFor.trim()}_`);
    }
    if (session.customerNotes?.trim()) {
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

  private buildOrderExtras(session: WhatsappSessionData): Array<{
    title: string;
    description?: string;
    amount: number;
  }> {
    const extras: Array<{ title: string; description?: string; amount: number }> = [];
    if (session.cashChangeFor?.trim()) {
      extras.push({
        title: 'Cambio / billete',
        description: session.cashChangeFor.trim(),
        amount: 0,
      });
    }
    if (session.paymentMethod?.trim()) {
      extras.push({
        title: 'Método de pago',
        description: session.paymentMethod.trim(),
        amount: 0,
      });
    }
    if (session.customerNotes?.trim()) {
      extras.push({
        title: 'Notas del cliente',
        description: session.customerNotes.trim(),
        amount: 0,
      });
    }
    return extras;
  }

  private looksLikePayment(text: string, methods: WhatsappPaymentMethodConfig[]): boolean {
    return !!findPaymentMethodByText(text, methods);
  }

  private resolvePaymentChoice(
    text: string,
    cfg: EffectiveWhatsappConfig,
  ): WhatsappPaymentMethodConfig | null {
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
      return (
        `¡Hola! 👋 Bienvenido a *${cfg.brandName}*.\n\n` +
        `Menú: ${cfg.menuUrl}\n\nDime qué se te antoja.`
      );
    }
    if (w.includes(cfg.menuUrl) || /\bmenu\b|\bmenú\b/i.test(w)) return w;
    return `${w}\n\nMenú: ${cfg.menuUrl}`;
  }

  private formatOrderSuccessMessage(
    conv: WhatsappConversation,
    session: WhatsappSessionData,
    order: { orderId?: number; dailyOrderNumber?: number },
    deliveryFee: number,
    thanksMessage?: string,
    paymentMethods: WhatsappPaymentMethodConfig[] = [],
  ): string {
    const subtotal = session.cart.reduce((s, c) => s + c.unitPrice, 0);
    const fee = session.orderType === 'delivery' ? deliveryFee : 0;
    const total = subtotal + fee;
    const now = new Date().toLocaleString('es-CO', {
      timeZone: 'America/Bogota',
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    const num = String(order.dailyOrderNumber ?? order.orderId ?? '').padStart(2, '0');
    const items = session.cart
      .map((c) => {
        const attrs = c.attributes?.length
          ? ` (${c.attributes.map((a) => a.attributeValue).join(', ')})`
          : '';
        return `• ${c.name}${attrs} — $${Math.round(c.unitPrice).toLocaleString('es-CO')}`;
      })
      .join('\n');

    return (
      `✅ *¡Listo! Tu pedido quedó registrado*\n\n` +
      `🧾 Orden *#${num}*\n` +
      `🕐 ${now}\n\n` +
      `*Detalle:*\n${items}\n\n` +
      `Subtotal: $${Math.round(subtotal).toLocaleString('es-CO')}\n` +
      (fee ? `Domicilio: $${Math.round(fee).toLocaleString('es-CO')}\n` : '') +
      `*Total: $${Math.round(total).toLocaleString('es-CO')}*\n\n` +
      `🛵 ${session.orderType === 'pickup' ? 'Recoges en el local' : 'Domicilio'}\n` +
      `👤 ${conv.customerName}\n` +
      `📍 ${session.address}\n` +
      `📞 ${conv.phoneE164}\n` +
      `💳 ${paymentMethodLabel(session.paymentMethod, paymentMethods)}\n\n` +
      (thanksMessage?.trim() || 'Gracias por pedirnos, te esperamos 🍗')
    );
  }

  private isMultiOrderAffirmative(text: string): boolean {
    const t = text.trim().toLowerCase();
    return /^(si|sí|sep|ok|okay|dale|listo|correcto|exacto|as[ií]|confirmo|agrega|agregalo|agregalos|va|perfecto|bueno)$/.test(
      t,
    );
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

    const step = this.catalogService.resolveAttributesFromMessage(product, text, []);
    const deliveryHint = this.extractDeliveryTail(text);
    if (step.status === 'complete') {
      const fresh = await this.conversationService.reloadConversation(conv.id);
      Object.assign(conv, fresh);
      session = this.conversationService.getSession(conv);
      if (deliveryHint) {
        session = { ...session, orderType: 'delivery', address: deliveryHint };
      }
      const added = this.tryAddProductToCart(session, product, 1, cfg, undefined, step.attributes);
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
          cfg.defaultDeliveryFee,
          `${product.name} (${chosen})`,
        ),
      );
      return true;
    }

    if (step.status === 'partial') {
      session = {
        ...session,
        ...(deliveryHint ? { orderType: 'delivery' as const, address: deliveryHint } : {}),
        pendingAttribute: {
          productId: product.id,
          name: product.name,
          code: product.code,
          price: product.price,
          attributes: product.attributes || [],
          selected: step.attributes,
        },
        pendingMatch: undefined,
      };
      await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
      await this.reply(
        conv,
        waId,
        this.catalogService.formatProductOptionsPrompt(product, step.attributes),
      );
      return true;
    }

    const mode =
      this.catalogService.isGenericProductInquiry(text) ||
      this.catalogService.shouldShowVariantsOverview(text, product)
        ? 'info'
        : 'order';

    session = {
      ...session,
      ...(deliveryHint ? { orderType: 'delivery' as const, address: deliveryHint } : {}),
      pendingAttribute: this.toPendingAttribute(product),
      pendingMatch: undefined,
    };
    await this.conversationService.saveSession(conv, session, 'building_cart');
    await this.reply(conv, waId, this.catalogService.formatProductVariantsOverview(product, mode));
    return true;
  }

  private async tryHandleProductInfoInquiry(
    conv: WhatsappConversation,
    waId: string,
    text: string,
    products: MenuProduct[],
    cfg: EffectiveWhatsappConfig,
  ): Promise<boolean> {
    if (!this.catalogService.isGenericProductInquiry(text)) return false;

    const stripped = this.catalogService.stripPriceInquiryNoise(text);
    const query = this.catalogService.extractProductSearchQuery(stripped || text);

    if (this.catalogService.isShortGenericFoodQuery(query)) {
      const hit = this.catalogService.findCategoryBrowseHit(query, products, cfg.menuConceptGroups);
      if (hit?.products.length) {
        const body = hit.products
          .slice(0, 10)
          .map((p, i) => this.catalogService.formatProductListItem(p, i + 1))
          .join('\n\n');
        await this.reply(
          conv,
          waId,
          `Sobre *${hit.categoryName}*, tenemos:\n\n${body}\n\n` +
            `¿Cuál te interesa? Dime el *número* o el *nombre*.`,
        );
        return true;
      }
    }

    const embedded =
      this.catalogService.findProductEmbeddedInMessage(query, products) ||
      this.catalogService.findProductEmbeddedInMessage(text, products);

    if (embedded) {
      await this.reply(conv, waId, this.catalogService.formatProductPriceReply(embedded));
      return true;
    }

    const scored = this.catalogService.searchByNameScored(query, products, 6);
    if (!scored.length) {
      await this.reply(
        conv,
        waId,
        '¿De qué plato quieres saber? Dime el nombre (ej. *pollo frito*, *sopa de mondongo*) y te cuento.',
      );
      return true;
    }

    if (scored.length === 1 || this.catalogService.isStrongProductMatch(scored)) {
      await this.reply(conv, waId, this.catalogService.formatProductPriceReply(scored[0].p));
      return true;
    }

    await this.reply(
      conv,
      waId,
      this.catalogService.formatPriceInquiryList(scored.slice(0, 5).map((x) => x.p)),
    );
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
    const lines: string[] = ['Entendí *varios platos* en tu mensaje:\n'];
    let idx = 1;
    for (const c of multi.confident) {
      lines.push(
        `${idx}. ✅ *${c.product.name}* (cód. ${c.product.code}) — $${Math.round(c.product.price).toLocaleString('es-CO')}`,
      );
      idx++;
    }
    for (const group of multi.ambiguous) {
      lines.push(`\n❓ Sobre *${group.segment}*, ¿cuál te gusta?`);
      group.candidates.forEach((c, i) => {
        lines.push(
          `   ${i + 1}) *${c.name}* (cód. ${c.code}) — $${Math.round(c.price).toLocaleString('es-CO')}`,
        );
      });
    }
    for (const item of multi.needsAttributes) {
      lines.push(
        `\n🔸 *${item.product.name}* (cód. ${item.product.code}) — hay que elegir opciones después.`,
      );
    }
    for (const miss of multi.unresolved) {
      lines.push(`\n⚠️ No encontré en el menú: _${miss}_`);
    }
    lines.push(
      '\nSi está bien lo que marqué ✅, escribe *sí*.',
      'Si algo no cuadra, dime el plato correcto o el *número* de la opción dudosa.',
    );
    return lines.join('\n');
  }

  private sessionFromMultiResolve(multi: MultiProductResolveResult): WhatsappSessionData['pendingMultiOrder'] {
    return {
      confident: multi.confident.map((c) => ({
        segment: c.segment,
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
  ): Promise<{ session: WhatsappSessionData; addedNames: string[]; blocked?: CartLimitCheck }> {
    const pending = session.pendingMultiOrder;
    if (!pending?.confident.length) {
      return { session, addedNames: [] };
    }
    let next = { ...session };
    const addedNames: string[] = [];
    for (const item of pending.confident) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) continue;
      const attempt = this.tryAddProductToCart(next, product, 1, cfg);
      if (attempt.blocked) {
        return { session: next, addedNames, blocked: attempt.blocked };
      }
      next = attempt.session;
      addedNames.push(product.name);
    }
    return { session: next, addedNames };
  }

  private async tryHandleMultiProductOrder(
    conv: WhatsappConversation,
    waId: string,
    session: WhatsappSessionData,
    multi: MultiProductResolveResult,
    cfg: EffectiveWhatsappConfig,
    text: string,
  ): Promise<boolean> {
    const deliveryTail = this.extractDeliveryTail(text);
    if (deliveryTail) {
      session = { ...session, orderType: 'delivery', address: deliveryTail };
    }

    const needsConfirm =
      multi.ambiguous.length > 0 ||
      multi.unresolved.length > 0 ||
      multi.needsAttributes.length > 0;

    if (!needsConfirm && multi.confident.length >= 2) {
      let next = session;
      const added: string[] = [];
      for (const match of multi.confident) {
        const attempt = this.tryAddProductToCart(next, match.product, 1, cfg);
        if (attempt.blocked) {
          await this.conversationService.saveSession(conv, next);
          await this.handleCartLimitBlocked(conv, waId, attempt.blocked, cfg);
          return true;
        }
        next = attempt.session;
        added.push(match.product.name);
      }
      await this.conversationService.saveSession(conv, next, 'building_cart');
      await this.reply(
        conv,
        waId,
        this.buildCartAddReply(next, cfg.defaultDeliveryFee, added, {
          extraLine: deliveryTail ? `\nDomicilio anotado: _${deliveryTail}_` : undefined,
        }),
      );
      return true;
    }

    session = {
      ...session,
      pendingMultiOrder: this.sessionFromMultiResolve(multi),
      pendingMatch: undefined,
    };
    await this.conversationService.saveSession(conv, session, 'building_cart');
    await this.reply(conv, waId, this.formatMultiOrderProposal(multi));
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

    const lower = text.trim().toLowerCase();
    const numPick = /^[1-9]\d*$/.test(lower) ? parseInt(lower, 10) : null;

    if (numPick && pending.ambiguous.length) {
      const group = pending.ambiguous[0];
      if (numPick <= group.candidates.length) {
        const chosen = group.candidates[numPick - 1];
        const full = products.find((p) => p.id === chosen.id) || (chosen as MenuProduct);
        const nextAmb = pending.ambiguous.slice(1);
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
      const addResult = await this.addPendingMultiConfidentToCart(conv, waId, session, cfg, products);
      if (addResult.blocked) {
        await this.conversationService.saveSession(conv, addResult.session);
        await this.handleCartLimitBlocked(conv, waId, addResult.blocked, cfg);
        return true;
      }
      let next = {
        ...addResult.session,
        pendingMultiOrder:
          pending.ambiguous.length || pending.unresolved.length || pending.needsAttributes.length
            ? {
                confident: [],
                ambiguous: pending.ambiguous,
                unresolved: pending.unresolved,
                needsAttributes: pending.needsAttributes,
              }
            : undefined,
      };

      if (pending.needsAttributes.length) {
        const first = pending.needsAttributes[0];
        const product = products.find((p) => p.id === first.productId);
        if (product?.hasAttributes && product.attributes?.length) {
          next = {
            ...next,
            pendingAttribute: this.toPendingAttribute(product),
            pendingMultiOrder: next.pendingMultiOrder,
          };
          await this.conversationService.saveSession(conv, next, 'awaiting_attribute');
          const prefix = addResult.addedNames.length
            ? this.buildCartAddReply(next, cfg.defaultDeliveryFee, addResult.addedNames, {
                suffix: '',
              }) + '\n\n'
            : next.cart.length
              ? `${this.formatCartOnly(next, cfg.defaultDeliveryFee)}\n\n`
              : '';
          await this.reply(
            conv,
            waId,
            `${prefix}Ahora elige opciones para *${product.name}*:\n\n` +
              this.catalogService.formatProductOptionsPrompt(product, []),
          );
          return true;
        }
      }

      await this.conversationService.saveSession(conv, next, 'building_cart');
      if (addResult.addedNames.length > 0) {
        const pendingNote =
          next.pendingMultiOrder?.ambiguous.length || next.pendingMultiOrder?.unresolved.length
            ? `\n\n${this.formatMultiOrderProposal({
                segments: [],
                confident: [],
                ambiguous: next.pendingMultiOrder.ambiguous.map((a) => ({
                  segment: a.segment,
                  candidates: a.candidates as MenuProduct[],
                })),
                unresolved: next.pendingMultiOrder.unresolved,
                needsAttributes: [],
              })}`
            : undefined;
        await this.reply(
          conv,
          waId,
          this.buildCartAddReply(next, cfg.defaultDeliveryFee, addResult.addedNames, {
            suffix: pendingNote ?? this.formatContinueShoppingPrompt(),
          }),
        );
      } else {
        await this.reply(
          conv,
          waId,
          `${this.formatCartOnly(next, cfg.defaultDeliveryFee)}\n\n${this.formatContinueShoppingPrompt()}`,
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
      `${this.buildCartAddReply(nextSession, cfg.defaultDeliveryFee, candidate.name, {
        extraLine: nextSession.address?.trim()
          ? `\nDomicilio anotado: _${nextSession.address.trim()}_`
          : undefined,
        suffix: '',
      })}\n\n` +
        `Cuando quieras, sigue con las opciones de *${pendingProduct.name}*:\n\n` +
        this.catalogService.formatProductOptionsPrompt(pendingProduct, pa.selected || []),
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

    const code = this.pointsHandler.extractTwelveCharCode(text);

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
    await this.metaService.sendText(waId, body);
    await this.conversationService.logMessage({
      conversationId: conv.id,
      direction: 'out',
      body,
      sentBy: 'bot',
    });
    await this.conversationService.touchOutbound(conv, 'bot');
  }
}
