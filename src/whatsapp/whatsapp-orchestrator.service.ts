import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { WhatsappSettingsService } from './whatsapp-settings.service';
import { WhatsappMetaService, IncomingWhatsappText } from './whatsapp-meta.service';
import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { WhatsappAiService } from './whatsapp-ai.service';
import { WhatsappConversationService } from './whatsapp-conversation.service';
import { BusinessService } from '../business/business.service';
import { OrdersService } from '../orders/orders.service';
import { PaymentsService } from '../payments/payments.service';
import { WhatsappActionGuardService } from './whatsapp-action-guard.service';
import { buildWhatsappBusinessRulesBlock } from './whatsapp-business-rules';
import type {
  AiOrderAction,
  WhatsappCartItem,
  WhatsappSessionData,
} from './types/whatsapp-session.types';
import { WhatsappConversation } from './entities/whatsapp-conversation.entity';
import { CreateOrderDto } from '../orders/DTOS/orderDTO';

type MenuProduct = Awaited<ReturnType<WhatsappCatalogService['getMenuProducts']>>[number];

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

  async handleIncoming(msg: IncomingWhatsappText): Promise<void> {
    const cfg = await this.settingsService.getEffectiveConfig();
    const conv = await this.conversationService.findOrCreateConversation(msg.waId, msg.phoneE164);
    await this.conversationService.touchInbound(conv);

    await this.conversationService.logMessage({
      conversationId: conv.id,
      direction: 'in',
      body: msg.text,
      waMessageId: msg.messageId,
      sentBy: 'bot',
      raw: msg.raw,
    });

    if (!cfg.enabled) {
      await this.reply(conv, msg.waId, 'En este momento el canal de WhatsApp no está activo. Pedidos por la web o teléfono del local.');
      return;
    }

    if (conv.humanTakeover) {
      return;
    }

    const text = msg.text.trim();
    const lower = text.toLowerCase();

    if (/\b(humano|persona|agente|asesor)\b/.test(lower)) {
      await this.conversationService.setHumanTakeover(conv.id, true);
      await this.reply(
        conv,
        msg.waId,
        'Te comunico con el equipo 🙋. Un agente tomará este chat desde el panel admin. Puedes seguir escribiendo aquí.',
      );
      return;
    }

    if (lower === 'cancelar' || lower === 'reiniciar') {
      await this.conversationService.saveSession(
        conv,
        { cart: [], pendingMatch: undefined, pendingAttribute: undefined, address: undefined, paymentMethod: undefined },
        'building_cart',
      );
      await this.reply(conv, msg.waId, 'Listo, reinicié tu pedido. ¿Qué te gustaría ordenar?');
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

    // Primer mensaje de la conversación: siempre saludo + link menú
    const inboundCount = await this.conversationService.countInboundMessages(conv.id);
    if (inboundCount <= 1) {
      await this.reply(conv, msg.waId, this.buildWelcomeMessage(cfg.menuUrl, true));
      if (this.isGreetingKeyword(text) || text.length < 2) return;
      // Si ya pidió algo en el primer mensaje, seguimos procesando abajo
    }

    if (session.pendingAttribute) {
      const pa = session.pendingAttribute;
      const product = this.catalogService.getProductById(pa.productId, products);
      if (product) {
        const attrs = this.catalogService.resolveAttributesFromText(product, text);
        if (attrs?.length) {
          session = this.addProductToCart(session, product, 1, undefined, attrs);
          session.pendingAttribute = undefined;
          await this.conversationService.saveSession(conv, session);
          await this.reply(
            conv,
            msg.waId,
            `Agregué *${product.name}* (${attrs.map((a) => a.attributeValue).join(', ')}). ¿Algo más o *confirmar*?`,
          );
          return;
        }
        await this.reply(
          conv,
          msg.waId,
          this.catalogService.formatProductOptionsPrompt(product),
        );
        return;
      }
      session.pendingAttribute = undefined;
    }

    if (!status.isOpen && !cfg.ignoreBusinessHours) {
      await this.reply(
        conv,
        msg.waId,
        `Ahora estamos *cerrados*. ${status.message}. ${status.subMessage ?? ''}\n\nHorario hoy: ${status.openTime}–${status.closeTime}. Cuando abramos escríbenos de nuevo para pedir.`,
      );
      return;
    }

    // Confirmación / palabras clave de flujo — ANTES de tratar el texto como nombre o dirección
    const isConfirm = this.isConfirmKeyword(text);
    const isGreeting = this.isGreetingKeyword(text);

    if (conv.state === 'awaiting_name' && !isConfirm && !isGreeting && text.length >= 2) {
      if (this.looksLikeAddress(text) || this.looksLikePayment(text, cfg.allowMercadoPago)) {
        await this.reply(
          conv,
          msg.waId,
          'Necesito tu *nombre completo* para el pedido (ej. Juan Pérez). Luego te pediré la dirección.',
        );
        return;
      }
      await this.conversationService.updateCustomerName(conv, text);
      await this.conversationService.saveSession(conv, session, 'building_cart');
      // Releer sesión y seguir el flujo de confirmación (no pedir otro producto)
      const fresh = await this.conversationService.reloadConversation(conv.id);
      Object.assign(conv, fresh);
      session = this.conversationService.getSession(conv);
      await this.reply(conv, msg.waId, `Gracias, *${text.trim()}*.`);
      await this.tryConfirmOrder(conv, msg.waId, session);
      return;
    }

    if (conv.state === 'awaiting_address' && !isConfirm && !isGreeting && text.length >= 8) {
      if (!this.looksLikeAddress(text)) {
        await this.reply(
          conv,
          msg.waId,
          'Necesito una *dirección de entrega* completa (barrio, calle/carrera, número o punto de referencia). Ejemplo: Calle 10 #5-20, barrio Centro.',
        );
        return;
      }
      session.address = text.trim();
      await this.conversationService.saveSession(conv, session, 'building_cart');
      const fresh = await this.conversationService.reloadConversation(conv.id);
      Object.assign(conv, fresh);
      session = this.conversationService.getSession(conv);
      await this.reply(conv, msg.waId, 'Perfecto, dirección anotada ✅');
      await this.tryConfirmOrder(conv, msg.waId, session);
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
      let opts = 'Responde *contraentrega* (efectivo al recibir).';
      if (cfg.allowMercadoPago) opts += ' O *mercado pago* para un link de pago.';
      await this.reply(conv, msg.waId, `¿Cómo deseas pagar?\n${opts}`);
      return;
    }

    // Saludo / menú (siempre respuesta fija, no diluye el carrito)
    if (isGreeting) {
      const inboundCount = await this.conversationService.countInboundMessages(conv.id);
      await this.reply(conv, msg.waId, this.buildWelcomeMessage(cfg.menuUrl, inboundCount <= 1));
      return;
    }

    const pick = session.pendingMatch && /^[1-9]\d*$/.test(lower) ? parseInt(lower, 10) : null;
    if (pick && session.pendingMatch && pick <= session.pendingMatch.candidates.length) {
      const chosenLite = session.pendingMatch.candidates[pick - 1];
      const chosen =
        this.catalogService.getProductById(chosenLite.id, products) || (chosenLite as MenuProduct);
      session.pendingMatch = undefined;
      if (chosen.hasAttributes && chosen.attributes?.length) {
        session = { ...session, pendingAttribute: this.toPendingAttribute(chosen) };
        await this.conversationService.saveSession(conv, session);
        await this.reply(conv, msg.waId, this.catalogService.formatProductOptionsPrompt(chosen));
        return;
      }
      session = this.addProductToCart(session, chosen, 1);
      await this.conversationService.saveSession(conv, session);
      await this.reply(
        conv,
        msg.waId,
        `Agregué *${chosen.name}* (código ${chosen.code}) — $${Math.round(chosen.price).toLocaleString('es-CO')}. ¿Algo más o escribe *confirmar*?`,
      );
      return;
    }

    const code = this.catalogService.extractCodeFromMessage(text);
    if (code != null) {
      const found = this.catalogService.findByCode(code, products);
      if (found) {
        if (found.availableNow === false) {
          await this.reply(conv, msg.waId, `*${found.name}* no está disponible en este horario. Prueba otro producto.`);
          return;
        }
        if (found.hasAttributes && found.attributes?.length) {
          session = { ...session, pendingAttribute: this.toPendingAttribute(found), pendingMatch: undefined };
          await this.conversationService.saveSession(conv, session);
          await this.reply(conv, msg.waId, this.catalogService.formatProductOptionsPrompt(found));
          return;
        }
        session = this.addProductToCart(session, found, 1);
        await this.conversationService.saveSession(conv, { ...session, pendingMatch: undefined });
        const desc = found.description ? `\n_${found.description}_` : '';
        await this.reply(
          conv,
          msg.waId,
          `Agregué *${found.name}* (código ${found.code}) — $${Math.round(found.price).toLocaleString('es-CO')}.${desc}\n¿Deseas algo más?`,
        );
        return;
      }
      await this.reply(conv, msg.waId, `No encontré un producto activo con código *${code}*. Prueba por nombre.`);
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

    // Categoría completa (ej. "sopas", "qué bebidas tienen")
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

    const nameMatches = this.catalogService.searchByName(text, products, 8);
    if (nameMatches.length === 1 && !session.pendingMatch) {
      const one = nameMatches[0];
      if (one.hasAttributes && one.attributes?.length) {
        session = { ...session, pendingAttribute: this.toPendingAttribute(one), pendingMatch: undefined };
        await this.conversationService.saveSession(conv, session);
        await this.reply(conv, msg.waId, this.catalogService.formatProductOptionsPrompt(one));
        return;
      }
      session = this.addProductToCart(session, one, 1);
      await this.conversationService.saveSession(conv, session);
      const desc = one.description ? `\n_${one.description}_` : '';
      await this.reply(
        conv,
        msg.waId,
        `Agregué *${one.name}* (código ${one.code}) — $${Math.round(one.price).toLocaleString('es-CO')}.${desc}\n¿Algo más?`,
      );
      return;
    }
    if (nameMatches.length > 1 && !session.pendingMatch) {
      session.pendingMatch = { query: text, candidates: nameMatches };
      await this.conversationService.saveSession(conv, session);
      const opts = nameMatches.map((c, i) => this.catalogService.formatProductListItem(c, i + 1)).join('\n\n');
      await this.reply(
        conv,
        msg.waId,
        `Encontré varias opciones:\n\n${opts}\n\nResponde con el *número* o el *código*.`,
      );
      return;
    }

    const menuDetailed = await this.catalogService.getMenuDetailedText();
    const recent = await this.conversationService.getRecentMessageTexts(conv.id, 10);
    const customerHint = session.linkedUserId
      ? `Cliente web: ${session.linkedUserName}. Igual pide nombre y dirección nuevos para este pedido.`
      : 'Sin usuario guardado en WhatsApp. Pide nombre y dirección antes de confirmar.';

    const rulesBlock = buildWhatsappBusinessRulesBlock({
      brandName: 'Pronto Pollo Portal',
      businessStatus: businessOpenForBot ? { ...status, isOpen: true } : status,
      deliveryFee: cfg.defaultDeliveryFee,
      allowMercadoPago: !!cfg.allowMercadoPago,
      menuProductCount: products.filter((p) => p.availableNow !== false).length,
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

    session = await this.applyActions(conv, session, guarded.actions, products);

    if (ai.actions?.setCustomerName) {
      await this.conversationService.updateCustomerName(conv, ai.actions.setCustomerName);
    }

    await this.conversationService.saveSession(conv, session);

    let reply = ai.reply;
    if (guarded.warnings.length) {
      reply += `\n\n_${guarded.warnings.slice(0, 2).join(' ')}_`;
    }
    if (session.pendingMatch?.candidates?.length) {
      const opts = session.pendingMatch.candidates
        .map((c, i) => this.catalogService.formatProductListItem(c, i + 1))
        .join('\n\n');
      reply += `\n\n¿Cuál prefieres?\n\n${opts}\n\nResponde con el *número* o el *código*.`;
    }

    // Si la IA intentó agregar producto con opciones y el guard lo bloqueó → pedir opciones + descripción
    if (!session.pendingAttribute && ai.actions?.addItems?.length && !guarded.actions?.addItems?.length) {
      const firstId = ai.actions.addItems[0]?.productId;
      const product = firstId != null ? this.catalogService.getProductById(firstId, products) : null;
      if (product?.hasAttributes) {
        session = { ...session, pendingAttribute: this.toPendingAttribute(product) };
        await this.conversationService.saveSession(conv, session);
        reply = this.catalogService.formatProductOptionsPrompt(product);
      }
    }

    if ((ai.actions?.requestConfirm || /\bconfirmar\b/.test(lower)) && this.isReadyToConfirm(session, conv)) {
      reply += `\n\n${this.formatOrderSummary(conv, session, cfg.defaultDeliveryFee)}`;
      reply += '\n\nResponde *confirmar* para crear el pedido.';
    }

    await this.reply(conv, msg.waId, reply);
  }

  private async applyActions(
    conv: WhatsappConversation,
    session: WhatsappSessionData,
    actions: AiOrderAction | undefined,
    products: MenuProduct[],
  ): Promise<WhatsappSessionData> {
    if (!actions) return session;
    let next = { ...session };

    if (actions.clearCart) {
      // Solo vaciar si el cliente lo pidió explícitamente (el orquestador usa cancelar/reiniciar)
      // Evita que la IA borre el carrito por error y luego "confirmar" diga vacío.
    }

    if (actions.setAddress) {
      const addr = actions.setAddress.trim();
      if (addr.length >= 10 && !this.isConfirmKeyword(addr) && !this.isGreetingKeyword(addr)) {
        next.address = addr;
      }
    }
    if (actions.setOrderType) next.orderType = actions.setOrderType;
    if (actions.setPaymentMethod) next.paymentMethod = actions.setPaymentMethod;

    if (actions.addItems?.length) {
      for (const item of actions.addItems) {
        const product = products.find((p) => p.id === item.productId);
        if (!product) continue;
        next = this.addProductToCart(next, product, item.quantity ?? 1, item.note, item.attributes);
      }
    }

    if (actions.removeProductIds?.length) {
      next.cart = next.cart.filter((c) => !actions.removeProductIds!.includes(c.productId));
    }

    if (actions.requestHuman) {
      await this.conversationService.setHumanTakeover(conv.id, true);
    }

    return next;
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
    return [
      `Nombre: ${conv.customerName || '(pendiente)'}`,
      `Teléfono: ${conv.phoneE164}`,
      `Dirección: ${session.address || '(pendiente)'}`,
      `Tipo: ${session.orderType}`,
      `Pago: ${session.paymentMethod || '(pendiente)'}`,
      `Carrito (${session.cart.length}): ${session.cart.map((c) => `${c.name} $${Math.round(c.unitPrice).toLocaleString('es-CO')}`).join(', ') || 'vacío'}`,
      `Subtotal sistema: $${Math.round(subtotal).toLocaleString('es-CO')} + domicilio $${Math.round(fee).toLocaleString('es-CO')}`,
    ].join('\n');
  }

  private formatOrderSummary(
    conv: WhatsappConversation,
    session: WhatsappSessionData,
    deliveryFee: number,
  ): string {
    const subtotal = session.cart.reduce((s, c) => s + c.unitPrice, 0);
    const fee = session.orderType === 'delivery' ? deliveryFee : 0;
    const total = subtotal + fee;
    return (
      `📋 *Resumen*\n` +
      session.cart.map((c) => `• ${c.name} — $${Math.round(c.unitPrice).toLocaleString('es-CO')}`).join('\n') +
      `\n\nSubtotal: $${Math.round(subtotal).toLocaleString('es-CO')}` +
      (fee ? `\nDomicilio: $${Math.round(fee).toLocaleString('es-CO')}` : '') +
      `\n*Total: $${Math.round(total).toLocaleString('es-CO')}*` +
      `\nNombre: ${conv.customerName}` +
      `\nDirección: ${session.address}` +
      `\nPago: ${session.paymentMethod === 'mercadopago' ? 'Mercado Pago' : 'Contra entrega'}`
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
    if (!session.cart.length) {
      await this.reply(conv, waId, 'Tu carrito está vacío. Dime productos por nombre o código.');
      return;
    }
    if (!conv.customerName?.trim()) {
      await this.conversationService.saveSession(conv, session, 'awaiting_name');
      await this.reply(
        conv,
        waId,
        `${this.formatOrderSummary(conv, session, (await this.settingsService.getEffectiveConfig()).defaultDeliveryFee)}\n\n` +
          'Para continuar, ¿cuál es tu *nombre completo*?',
      );
      return;
    }
    if (!session.address?.trim()) {
      await this.conversationService.saveSession(conv, session, 'awaiting_address');
      await this.reply(
        conv,
        waId,
        'Indícame la *dirección de entrega* completa (calle/carrera, número, barrio o referencia).',
      );
      return;
    }
    if (!session.paymentMethod) {
      const cfgPay = await this.settingsService.getEffectiveConfig();
      let opts = 'Responde *contraentrega* (efectivo al recibir).';
      if (cfgPay.allowMercadoPago) opts += ' O *mercado pago* para un link de pago.';
      await this.conversationService.saveSession(conv, session, 'awaiting_payment');
      await this.reply(conv, waId, `¿Cómo pagas?\n${opts}`);
      return;
    }

    const cfg = await this.settingsService.getEffectiveConfig();
    const items = session.cart.flatMap((c) =>
      Array.from({ length: c.quantity }, () => ({
        productId: c.productId,
        note: c.note,
        attributes: c.attributes,
      })),
    );

    const orderDto: CreateOrderDto = {
      customerName: conv.customerName.trim(),
      phone: conv.phoneE164,
      address: session.address.trim(),
      orderType: session.orderType,
      deliveryFee: session.orderType === 'delivery' ? cfg.defaultDeliveryFee : undefined,
      orderSource: 'whatsapp',
      items,
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
        );
        await this.conversationService.saveSession(conv, session, 'awaiting_mp_payment');
        await this.reply(
          conv,
          waId,
          `Link de pago Mercado Pago:\n${pref.initPoint}\n\nAl confirmarse el pago crearemos tu pedido.`,
        );
        return;
      }

      const order = await this.ordersService.create(orderDto);
      const snapshot = { ...session };
      const cfg2 = cfg;
      await this.conversationService.saveSession(
        conv,
        { cart: [], address: undefined, paymentMethod: undefined, pendingMatch: undefined, pendingAttribute: undefined },
        'completed',
      );
      await this.reply(
        conv,
        waId,
        this.formatOrderSuccessMessage(conv, snapshot, order, cfg2.defaultDeliveryFee),
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al crear pedido';
      this.logger.error(`Order create failed: ${message}`);
      await this.reply(conv, waId, `No pude registrar el pedido: ${message}. Escribe *humano* para ayuda.`);
    }
  }

  async sendHumanReply(conversationId: number, body: string, _agent: { id: string; fullName: string }) {
    const conv = await this.conversationService.getConversation(conversationId);
    await this.metaService.sendText(conv.waId, body);
    await this.conversationService.logMessage({
      conversationId: conv.id,
      direction: 'out',
      body,
      sentBy: 'human',
    });
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

  private looksLikeAddress(text: string): boolean {
    const t = text.trim().toLowerCase();
    if (t.length < 10) return false;
    if (this.isConfirmKeyword(t) || this.isGreetingKeyword(t)) return false;
    if (/^(contraentrega|efectivo|mercado\s*pago|humano)$/i.test(t)) return false;
    // Heurística: calle/carrera/av/barrio/# o texto largo con números
    if (/\b(calle|carrera|cra|cll|av\.?|avenida|diag|diagonal|transversal|barrio|conjunto|apto|apartamento|torre|casa|mz|manzana|#)\b/i.test(t)) {
      return true;
    }
    return t.length >= 15 && /\d/.test(t);
  }

  private looksLikePayment(text: string, allowMp: boolean): boolean {
    const t = text.toLowerCase();
    if (/\b(contraentrega|efectivo|cash)\b/.test(t)) return true;
    if (allowMp && /\b(mercado\s*pago|tarjeta)\b/.test(t)) return true;
    return false;
  }

  private buildWelcomeMessage(menuUrl: string, firstContact: boolean): string {
    const hello = firstContact
      ? '¡Hola! 👋 ¿Cómo podemos ayudarte?'
      : '¡Hola de nuevo! 👋 ¿Cómo podemos ayudarte?';
    return (
      `${hello}\n\n` +
      `Puedes pedir por *nombre*, *código* o categoría (ej. sopas).\n` +
      `También conoce nuestro menú completo aquí:\n${menuUrl}\n\n` +
      `Cuando quieras, dime qué deseas ordenar. Para finalizar escribe *confirmar*.`
    );
  }

  private formatOrderSuccessMessage(
    conv: WhatsappConversation,
    session: WhatsappSessionData,
    order: { orderId?: number; dailyOrderNumber?: number },
    deliveryFee: number,
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
      `✅ *¡Tu pedido se creó con éxito!*\n\n` +
      `🧾 Orden *#${num}*\n` +
      `🕐 ${now}\n\n` +
      `*Detalle:*\n${items}\n\n` +
      `Subtotal: $${Math.round(subtotal).toLocaleString('es-CO')}\n` +
      (fee ? `Domicilio: $${Math.round(fee).toLocaleString('es-CO')}\n` : '') +
      `*Total: $${Math.round(total).toLocaleString('es-CO')}*\n\n` +
      `👤 ${conv.customerName}\n` +
      `📍 ${session.address}\n` +
      `📞 ${conv.phoneE164}\n` +
      `💳 ${session.paymentMethod === 'mercadopago' ? 'Mercado Pago' : 'Contra entrega'}\n\n` +
      `¡Gracias por elegir Pronto Pollo Portal! 🍗`
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
  }
}
