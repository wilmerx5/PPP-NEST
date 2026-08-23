import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { WhatsappSettingsService } from './whatsapp-settings.service';
import { WhatsappMetaService, IncomingWhatsappMessage } from './whatsapp-meta.service';
import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { WhatsappAiService } from './whatsapp-ai.service';
import { WhatsappConversationService } from './whatsapp-conversation.service';
import { BusinessService } from '../business/business.service';
import { OrdersService } from '../orders/orders.service';
import { PaymentsService } from '../payments/payments.service';
import { WhatsappActionGuardService } from './whatsapp-action-guard.service';
import { buildWhatsappBusinessRulesBlock } from './whatsapp-business-rules';
import {
  buildOrderLimitsPromptBlock,
  evaluateCartLimits,
  type CartLimitCheck,
  type WhatsappCartLimitsConfig,
} from './whatsapp-cart-limits';
import type {
  AiOrderAction,
  WhatsappCartItem,
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
          'No pude escuchar bien el audio 🙏 ¿Me lo escribes por texto o mandas *humano*?',
        );
        return;
      }
      text = resolved;
      await this.reply(conv, msg.waId, `Te escuché: _${this.shortQuote(text)}_`);
    } else if (msg.messageType === 'image' && msg.mediaId) {
      const img = await this.resolveImageMessage(msg, logged.id, conv, cfg);
      if (img.done) return;
      text = img.text;
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
        'Recibí tu mensaje 👍 El asistente trabaja mejor con *texto*, *nota de voz* o *ubicación*.\n\n' +
          'Escríbenos el pedido (código o nombre) o *humano* y te atendemos.',
      );
      return;
    }

    if (!text) {
      await this.reply(conv, msg.waId, '¿Qué se te antoja? Puedes pedir por código o nombre.');
      return;
    }

    const lower = text.toLowerCase();

    if (/\b(humano|persona|agente|asesor)\b/.test(lower)) {
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

    if (this.isRestartIntent(lower)) {
      await this.conversationService.resetOrderSession(conv, 'building_cart', {
        ignorePriorHistory: true,
      });
      await this.reply(conv, msg.waId, 'Listo, borré lo que estabas armando. ¿Qué se te antoja?');
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
        this.catalogService.searchByName(text, products, 5).length === 0
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
          const added = this.tryAddProductToCart(session, product, 1, cfg, undefined, step.attributes);
          if (added.blocked) {
            await this.conversationService.saveSession(conv, session);
            await this.handleCartLimitBlocked(conv, msg.waId, added.blocked, cfg);
            return;
          }
          session = added.session;
          session.pendingAttribute = undefined;
          await this.conversationService.saveSession(conv, session, 'building_cart');
          const chosen = step.attributes.map((a) => a.attributeValue).join(', ');
          await this.reply(
            conv,
            msg.waId,
            `Te agregué *${product.name}* (${chosen}) — $${Math.round(product.price).toLocaleString('es-CO')}.\n\n` +
              `${this.formatCartOnly(session, cfg.defaultDeliveryFee)}\n\n` +
              `¿Algo más? Cuando quieras escribe *confirmar*.`,
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

        // No es una opción válida: si parece pregunta/otro tema → IA responde (sin perder la elección)
        if (this.looksLikeSideQuestion(text)) {
          await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
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
          `No te capté esa opción. Respóndeme con el *número* (1, 2, 3…).\n\n` +
            this.catalogService.formatProductOptionsPrompt(product, pa.selected || []),
        );
        return;
      }
      // Estado inconsistente: no interpretar el mensaje como código de producto
      session.pendingAttribute = undefined;
      await this.conversationService.saveSession(conv, session, 'building_cart');
      if (/^[1-9]\d{0,2}$/.test(text.trim())) {
        await this.reply(
          conv,
          msg.waId,
          'Uy, se me fue la selección. Dime otra vez el *nombre* o *código* del producto y te muestro las opciones.',
        );
        return;
      }
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
        this.looksLikePayment(text, cfg.allowMercadoPago) ||
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
      if (text.length >= 8) {
        if (!this.looksLikeAddress(text)) {
          await this.reply(
            conv,
            msg.waId,
            '¿Me pasas la *dirección de entrega* o me dices si *pasas a recoger*? (ej. “paso en 15 minutos”).\nEjemplo domicilio: Calle 10 #5-20, barrio Centro.',
          );
          return;
        }
        session.orderType = 'delivery';
        session.address = text.trim();
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
      if (/\b(contraentrega|efectivo|cash)\b/.test(lower)) {
        session.paymentMethod = 'cash';
        await this.conversationService.saveSession(conv, session, 'confirming');
        session = this.conversationService.getSession(conv);
        await this.tryConfirmOrder(conv, msg.waId, session);
        return;
      }
      if (cfg.allowMercadoPago && /\b(mercado\s*pago|tarjeta|link\s*de\s*pago)\b/.test(lower)) {
        session.paymentMethod = 'mercadopago';
        await this.conversationService.saveSession(conv, session, 'confirming');
        session = this.conversationService.getSession(conv);
        await this.tryConfirmOrder(conv, msg.waId, session);
        return;
      }
    }
    if (conv.state === 'awaiting_payment') {
      let opts = 'Escríbeme *contraentrega* (efectivo al recibir).';
      if (cfg.allowMercadoPago) opts += ' O *mercado pago* si quieres un link de pago.';
      await this.reply(conv, msg.waId, `¿Cómo te queda más fácil pagar?\n${opts}`);
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
      await this.reply(conv, msg.waId, this.buildAskNotesMessage(cfg));
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

    const pick = session.pendingMatch && /^[1-9]\d*$/.test(lower) ? parseInt(lower, 10) : null;
    if (pick && session.pendingMatch && pick <= session.pendingMatch.candidates.length) {
      const chosenLite = session.pendingMatch.candidates[pick - 1];
      const chosen =
        this.catalogService.getProductById(chosenLite.id, products) || (chosenLite as MenuProduct);
      session.pendingMatch = undefined;
      if (chosen.hasAttributes && chosen.attributes?.length) {
        session = {
          ...session,
          pendingAttribute: this.toPendingAttribute(chosen),
          pendingMatch: undefined,
        };
        await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
        await this.reply(
          conv,
          msg.waId,
          this.catalogService.formatProductOptionsPrompt(chosen, []),
        );
        return;
      }
      const added = this.tryAddProductToCart(session, chosen, 1, cfg);
      if (added.blocked) {
        await this.conversationService.saveSession(conv, session);
        await this.handleCartLimitBlocked(conv, msg.waId, added.blocked, cfg);
        return;
      }
      session = added.session;
      session.pendingMatch = undefined;
      await this.conversationService.saveSession(conv, session, 'building_cart');
      await this.reply(
        conv,
        msg.waId,
        `Te agregué *${chosen.name}* (código ${chosen.code}) — $${Math.round(chosen.price).toLocaleString('es-CO')}.\n\n` +
          `${this.formatCartOnly(session, cfg.defaultDeliveryFee)}\n\n` +
          `¿Algo más, o escribes *confirmar*?`,
      );
      return;
    }

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
    // Solo dígitos (1, 2, 3…): con lista o atributos pendientes = índice de opción, NUNCA código de producto.
    const bareOptionNumber = /^[1-9]\d{0,2}$/.test(text.trim());
    if (code != null && !(bareOptionNumber && (session.pendingMatch || session.pendingAttribute || conv.state === 'awaiting_attribute'))) {
      const found = this.catalogService.findByCode(code, products);
      if (found) {
        if (found.availableNow === false) {
          await this.reply(conv, msg.waId, `*${found.name}* no está disponible en este horario. ¿Probamos con otro?`);
          return;
        }
        if (found.hasAttributes && found.attributes?.length) {
          session = { ...session, pendingAttribute: this.toPendingAttribute(found), pendingMatch: undefined };
          await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
          await this.reply(conv, msg.waId, this.catalogService.formatProductOptionsPrompt(found, []));
          return;
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
        await this.reply(
          conv,
          msg.waId,
        `Te agregué *${found.name}* (código ${found.code}) — $${Math.round(found.price).toLocaleString('es-CO')}.${desc}\n\n` +
            `${this.formatCartOnly(session, cfg.defaultDeliveryFee)}\n\n¿Se te antoja algo más? Cuando quieras escribe *confirmar*.`,
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

    if (/\b(contraentrega|efectivo|cash)\b/.test(lower)) {
      session.paymentMethod = 'cash';
      await this.conversationService.saveSession(conv, session, 'confirming');
      const fresh = await this.conversationService.reloadConversation(conv.id);
      Object.assign(conv, fresh);
      session = this.conversationService.getSession(conv);
      await this.tryConfirmOrder(conv, msg.waId, session);
      return;
    }
    if (cfg.allowMercadoPago && /\b(mercado\s*pago|tarjeta|link\s*de\s*pago)\b/.test(lower)) {
      session.paymentMethod = 'mercadopago';
      await this.conversationService.saveSession(conv, session, 'confirming');
      const fresh = await this.conversationService.reloadConversation(conv.id);
      Object.assign(conv, fresh);
      session = this.conversationService.getSession(conv);
      await this.tryConfirmOrder(conv, msg.waId, session);
      return;
    }

    // Producto por nombre ANTES que categoría (evita: "arroz con pollo" → listar categoría Pollo)
    const nameScored = this.catalogService.searchByNameScored(text, products, 8);
    const nameMatches = nameScored.map((x) => x.p);
    const strongProduct = this.catalogService.isStrongProductMatch(nameScored);

    if (!strongProduct) {
      const categoryHit = this.catalogService.findByCategory(text, products);
      if (categoryHit && categoryHit.products.length > 0 && !session.pendingMatch) {
        session.pendingMatch = {
          query: text,
          candidates: categoryHit.products,
        };
        await this.conversationService.saveSession(conv, session);
        await this.reply(
          conv,
          msg.waId,
          this.catalogService.formatCategoryList(categoryHit.categoryName, categoryHit.products),
        );
        return;
      }
    }

    // Si hay un ganador claro por título (ej. "arroz con pollo"), no listar ambigüedades débiles
    const resolvedMatches =
      strongProduct && nameScored.length >= 1 && nameScored[0].score >= 80
        ? [nameScored[0].p]
        : nameMatches;

    if (resolvedMatches.length === 1 && !session.pendingMatch) {
      const one = resolvedMatches[0];
      if (one.hasAttributes && one.attributes?.length) {
        session = { ...session, pendingAttribute: this.toPendingAttribute(one), pendingMatch: undefined };
        await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
        await this.reply(conv, msg.waId, this.catalogService.formatProductOptionsPrompt(one, []));
        return;
      }
      const added = this.tryAddProductToCart(session, one, 1, cfg);
      if (added.blocked) {
        await this.conversationService.saveSession(conv, session);
        await this.handleCartLimitBlocked(conv, msg.waId, added.blocked, cfg);
        return;
      }
      session = added.session;
      await this.conversationService.saveSession(conv, session, 'building_cart');
      const desc = one.description ? `\n_${one.description}_` : '';
      await this.reply(
        conv,
        msg.waId,
        `Te agregué *${one.name}* (código ${one.code}) — $${Math.round(one.price).toLocaleString('es-CO')}.${desc}\n\n` +
          `${this.formatCartOnly(session, cfg.defaultDeliveryFee)}\n\n¿Algo más? Cuando quieras escribe *confirmar*.`,
      );
      return;
    }
    if (resolvedMatches.length > 1 && !session.pendingMatch) {
      session.pendingMatch = { query: text, candidates: resolvedMatches };
      await this.conversationService.saveSession(conv, session);
      const opts = resolvedMatches.map((c, i) => this.catalogService.formatProductListItem(c, i + 1)).join('\n\n');
      await this.reply(
        conv,
        msg.waId,
        `Encontré varias, mira:\n\n${opts}\n\nRespóndeme con el *número* o el *código*.`,
      );
      return;
    }

    const menuDetailed = await this.catalogService.getMenuDetailedText();
    const recent = await this.conversationService.getRecentMessageTexts(conv.id, 10);
    const customerHint = [
      session.linkedUserId
        ? `Cliente web: ${session.linkedUserName}. Igual pide nombre y dirección nuevos para este pedido.`
        : 'Sin usuario guardado en WhatsApp. Pide nombre y dirección antes de confirmar.',
      session.ignorePriorOrderHistory && session.cart.length === 0
        ? 'IMPORTANTE: El pedido anterior YA se cerró. El carrito está VACÍO. NO uses addItems con productos del historial; solo agrega si el cliente nombra un producto AHORA.'
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
    });

    const ai = await this.aiService.generateTurn({
      userMessage: text,
      businessRulesBlock: rulesBlock,
      menuDetailedText: menuDetailed,
      sessionSummary: this.buildSessionSummary(conv, session, cfg.defaultDeliveryFee),
      recentMessages: recent,
      customerHint,
    });

    const guarded = this.actionGuard.sanitize({
      actions: ai.actions,
      products,
      businessOpen: businessOpenForBot,
      allowMercadoPago: !!cfg.allowMercadoPago,
    });

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

    const applied = await this.applyActions(conv, session, guarded.actions, products, cfg);
    session = applied.session;
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
      await this.reply(
        conv,
        msg.waId,
        this.catalogService.formatProductOptionsPrompt(product, pa.selected || []),
      );
      return;
    }

    if (session.pendingMatch?.candidates?.length) {
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
    const softWarnings = guarded.warnings.filter(
      (w) => !/requiere elegir|opciones inválidas|elige:/i.test(w),
    );
    if (softWarnings.length) {
      reply += `\n\n_${softWarnings.slice(0, 1).join(' ')}_`;
    }
    if (!reply) {
      reply = session.cart.length
        ? `${this.formatCartOnly(session, cfg.defaultDeliveryFee)}\n\n¿Algo más o escribe *confirmar*?`
        : 'Dime qué quieres pedir por *nombre* o *código*, o escribe *menú*.';
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
      // Solo vaciar si el cliente lo pidió explícitamente (el orquestador usa cancelar/reiniciar)
      // Evita que la IA borre el carrito por error y luego "confirmar" diga vacío.
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

  private toPendingAttribute(product: MenuProduct): WhatsappSessionData['pendingAttribute'] {
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
      const remaining = (pa.attributes || []).filter(
        (a) => !(pa.selected || []).some((s) => s.attributeName === a.attributeName),
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
    return lines.join('\n');
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
    const nextAttr = (pa.attributes || []).find(
      (a) => !(pa.selected || []).some((s) => s.attributeName === a.attributeName),
    );
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
      `🛒 *Tu carrito*\n` +
      lines.join('\n') +
      `\n\nSubtotal: $${Math.round(subtotal).toLocaleString('es-CO')}` +
      (fee ? `\nDomicilio: $${Math.round(fee).toLocaleString('es-CO')}` : '') +
      `\n*Total: $${Math.round(total).toLocaleString('es-CO')}*`
    );
  }

  private formatOrderSummary(
    conv: WhatsappConversation,
    session: WhatsappSessionData,
    deliveryFee: number,
  ): string {
    const tipo =
      session.orderType === 'pickup' ? 'Recoger en el local' : 'Domicilio';
    const lugarLabel = session.orderType === 'pickup' ? '📍' : '📍 Dirección';
    return (
      `${this.formatCartOnly(session, deliveryFee)}\n` +
      `\n🛵 Tipo: ${tipo}` +
      `\n👤 Nombre: ${conv.customerName || '(pendiente)'}` +
      `\n${lugarLabel}: ${session.address || '(pendiente)'}` +
      `\n💳 Pago: ${
        session.paymentMethod === 'mercadopago'
          ? 'Mercado Pago'
          : session.paymentMethod === 'cash'
            ? 'Contra entrega'
            : '(pendiente)'
      }` +
      (session.cashChangeFor ? `\n💵 Cambio de: ${session.cashChangeFor}` : '') +
      (session.customerNotes ? `\n📝 Notas: ${session.customerNotes}` : '')
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
      let opts = 'Escríbeme *contraentrega* (efectivo al recibir).';
      if (cfg.allowMercadoPago) opts += ' O *mercado pago* si quieres un link de pago.';
      if (cfg.paymentInstructions) opts += `\n\n_${cfg.paymentInstructions}_`;
      await this.conversationService.saveSession(conv, session, 'awaiting_payment');
      await this.reply(
        conv,
        waId,
        `${this.formatCartOnly(session, cfg.defaultDeliveryFee)}\n\n¿Cómo pagas?\n${opts}`,
      );
      return;
    }

    // Notas / cambio (una sola vez)
    if (cfg.askOrderNotes !== false && !session.notesCollected) {
      session.pendingMatch = undefined;
      session.pendingAttribute = undefined;
      await this.conversationService.saveSession(conv, session, 'awaiting_notes');
      await this.reply(conv, waId, this.buildAskNotesMessage(cfg));
      return;
    }

    // Datos listos: mostrar carrito + total y pedir confirmación (aún no crea)
    if (conv.state !== 'awaiting_final_confirm') {
      await this.conversationService.saveSession(conv, session, 'awaiting_final_confirm');
      await this.reply(
        conv,
        waId,
        `${this.formatOrderSummary(conv, session, cfg.defaultDeliveryFee)}\n\n` +
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
      clientRequestId: `wa-${conv.id}-${randomUUID()}`.slice(0, 64),
    };

    try {
      if (session.paymentMethod === 'mercadopago') {
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
          `${this.formatOrderSummary(conv, session, cfg.defaultDeliveryFee)}\n\n` +
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

  private async resolveImageMessage(
    msg: IncomingWhatsappMessage,
    loggedMessageId: string,
    conv: WhatsappConversation,
    cfg: Awaited<ReturnType<WhatsappSettingsService['getEffectiveConfig']>>,
  ): Promise<{ done: true } | { done: false; text: string }> {
    try {
      const { buffer, mimeType } = await this.metaService.downloadMedia(msg.mediaId!);
      const menuSummary = await this.catalogService.getMenuDetailedText();
      const captionRaw = (msg.text || '').trim();
      const caption =
        captionRaw && !/^🖼️/.test(captionRaw) && captionRaw !== 'Imagen'
          ? captionRaw
          : undefined;

      const analysis = await this.aiService.analyzeOrderImage({
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
            'Recibí tu comprobante ✅ Un asesor lo revisa en un momento. Si necesitas algo más, escribe *humano*.',
        );
        return { done: true };
      }

      if (analysis.kind === 'order' && analysis.textForBot) {
        await this.conversationService.updateMessageBody(
          loggedMessageId,
          `🖼️ ${analysis.textForBot}`,
        );
        return { done: false, text: analysis.textForBot };
      }

      await this.conversationService.updateMessageBody(
        loggedMessageId,
        captionRaw || '🖼️ Imagen',
      );
      await this.reply(
        conv,
        msg.waId,
        analysis.reply ||
          'Vi la imagen 👍 Para el pedido me sirve más por *texto* o *nota de voz* (código o nombre). También puedes escribir *humano*.',
      );
      return { done: true };
    } catch (err) {
      this.logger.error(`Image resolve failed: ${err}`);
      await this.reply(
        conv,
        msg.waId,
        'No pude abrir la imagen. ¿Me escribes el pedido o *humano*?',
      );
      return { done: true };
    }
  }

  private isRestartIntent(lower: string): boolean {
    return /^(reiniciar|empezar\s+de\s+nuevo|borrar\s+carrito)$/i.test(lower.trim());
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
      /\b(pollo|medio|cuarto|entero|porcion|porciones|sopa|bebida|gaseosa|limonada|arepa|papa|maduro|chorizo|alas|pechuga|combo|menudencia)\b/i.test(
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

  private looksLikeAddress(text: string): boolean {
    const t = text.trim().toLowerCase();
    if (t.length < 10) return false;
    if (this.isConfirmKeyword(t) || this.isGreetingKeyword(t)) return false;
    if (this.isPickupIntent(t)) return false;
    if (/^(contraentrega|efectivo|mercado\s*pago|humano)$/i.test(t)) return false;
    if (/^📍/.test(text.trim()) || /\b-?\d{1,2}\.\d+\s*,\s*-?\d{1,3}\.\d+\b/.test(t)) return true;
    // Heurística: calle/carrera/av/barrio/# o texto largo con números
    if (/\b(calle|carrera|cra|cll|av\.?|avenida|diag|diagonal|transversal|barrio|conjunto|apto|apartamento|torre|casa|mz|manzana|#)\b/i.test(t)) {
      return true;
    }
    return t.length >= 15 && /\d/.test(t) && !/\b(minutos?|mins?|horas?)\b/i.test(t);
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
  ): string {
    const hint = (cfg.localContext?.cashChangeNote || '').trim();
    let msg =
      '¿Alguna *nota* para el pedido o *cambio* (con cuánto pagas)?\n' +
      'Ej: _cambio de 50 mil_ / _sin cebolla, timbre 302_.\n' +
      'Si no aplica, escribe *ninguno*.';
    if (hint) msg += `\n\n_${hint}_`;
    return msg;
  }

  private applyNotesFromText(session: WhatsappSessionData, text: string): WhatsappSessionData {
    const t = text.trim();
    const lower = t.toLowerCase();
    const next = { ...session, notesCollected: true as const };
    if (/^(ninguno|ninguna|no|nada|sin notas?|n\/a|na)$/i.test(lower)) {
      return next;
    }
    const changeMatch = t.match(
      /(?:cambio|billete|paga(?:s|r)?(?:\s+con)?)\s*(?:de\s*)?\$?\s*([\d.,]+(?:\s*(?:mil|k))?)/i,
    );
    if (changeMatch?.[1]) {
      next.cashChangeFor = changeMatch[0].replace(/\s+/g, ' ').trim().slice(0, 120);
    } else if (/^\d[\d.,\s]*(mil|k)?$/i.test(t) && session.paymentMethod === 'cash') {
      next.cashChangeFor = `cambio de ${t}`;
    }
    const notesOnly = t
      .replace(
        /(?:cambio|billete|paga(?:s|r)?(?:\s+con)?)\s*(?:de\s*)?\$?\s*[\d.,]+(?:\s*(?:mil|k))?/gi,
        '',
      )
      .replace(/^[,.\s\-–—]+|[,.\s\-–—]+$/g, '')
      .trim();
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
    if (session.customerNotes?.trim()) {
      extras.push({
        title: 'Notas del cliente',
        description: session.customerNotes.trim(),
        amount: 0,
      });
    }
    return extras;
  }

  private looksLikePayment(text: string, allowMp: boolean): boolean {
    const t = text.toLowerCase();
    if (/\b(contraentrega|efectivo|cash)\b/.test(t)) return true;
    if (allowMp && /\b(mercado\s*pago|tarjeta)\b/.test(t)) return true;
    return false;
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
      `💳 ${session.paymentMethod === 'mercadopago' ? 'Mercado Pago' : 'Contra entrega'}\n\n` +
      (thanksMessage?.trim() || 'Gracias por pedirnos, te esperamos 🍗')
    );
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
