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
      await this.conversationService.saveSession(conv, { cart: [], pendingMatch: undefined }, 'building_cart');
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
          `Indica la opción para *${product.name}*:\n${this.actionGuard.formatAttributeOptions(product)}`,
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

    if (conv.state === 'awaiting_name' && text.length >= 2) {
      await this.conversationService.updateCustomerName(conv, text);
      await this.conversationService.saveSession(conv, session, 'building_cart');
      await this.reply(conv, msg.waId, `Gracias, ${text}. ¿Qué productos quieres? (nombre o código)`);
      return;
    }

    if (conv.state === 'awaiting_address' && text.length >= 8) {
      session.address = text;
      await this.conversationService.saveSession(conv, session, 'building_cart');
      await this.reply(conv, msg.waId, 'Dirección anotada. ¿Algo más en el pedido o escribe *confirmar*?');
      return;
    }

    const pick = session.pendingMatch && /^[1-9]\d*$/.test(lower) ? parseInt(lower, 10) : null;
    if (pick && session.pendingMatch && pick <= session.pendingMatch.candidates.length) {
      const chosen = session.pendingMatch.candidates[pick - 1];
      session = this.addProductToCart(session, chosen, 1);
      session.pendingMatch = undefined;
      await this.conversationService.saveSession(conv, session);
      await this.reply(
        conv,
        msg.waId,
        `Agregué *${chosen.name}* (código ${chosen.code}). ¿Algo más o escribe *confirmar*?`,
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
          await this.reply(
            conv,
            msg.waId,
            `*${found.name}* (código ${found.code}). Elige opción:\n${this.actionGuard.formatAttributeOptions(found)}`,
          );
          return;
        }
        session = this.addProductToCart(session, found, 1);
        await this.conversationService.saveSession(conv, { ...session, pendingMatch: undefined });
        await this.reply(
          conv,
          msg.waId,
          `Agregué *${found.name}* (código ${found.code}) — $${Math.round(found.price).toLocaleString('es-CO')}. ¿Deseas algo más?`,
        );
        return;
      }
      await this.reply(conv, msg.waId, `No encontré un producto activo con código *${code}*. Prueba por nombre.`);
      return;
    }

    if (/\b(confirmar|confirmo|listo pedido|finalizar)\b/.test(lower)) {
      await this.tryConfirmOrder(conv, msg.waId, session);
      return;
    }

    if (/\b(contraentrega|efectivo|cash)\b/.test(lower)) {
      session.paymentMethod = 'cash';
      await this.conversationService.saveSession(conv, session, 'confirming');
    } else if (cfg.allowMercadoPago && /\b(mercado\s*pago|tarjeta|link\s*de\s*pago)\b/.test(lower)) {
      session.paymentMethod = 'mercadopago';
      await this.conversationService.saveSession(conv, session, 'confirming');
    }

    const nameMatches = this.catalogService.searchByName(text, products, 5);
    if (nameMatches.length === 1 && !session.pendingMatch) {
      const one = nameMatches[0];
      if (one.hasAttributes && one.attributes?.length) {
        session = { ...session, pendingAttribute: this.toPendingAttribute(one), pendingMatch: undefined };
        await this.conversationService.saveSession(conv, session);
        await this.reply(
          conv,
          msg.waId,
          `*${one.name}* (código ${one.code}). Elige opción:\n${this.actionGuard.formatAttributeOptions(one)}`,
        );
        return;
      }
      session = this.addProductToCart(session, one, 1);
      await this.conversationService.saveSession(conv, session);
      await this.reply(
        conv,
        msg.waId,
        `Agregué *${nameMatches[0].name}* (código ${nameMatches[0].code}). ¿Algo más?`,
      );
      return;
    }
    if (nameMatches.length > 1 && !session.pendingMatch) {
      session.pendingMatch = { query: text, candidates: nameMatches };
      await this.conversationService.saveSession(conv, session);
      const opts = nameMatches
        .map((c, i) => `${i + 1}. ${c.name} (código ${c.code}) — $${Math.round(c.price).toLocaleString('es-CO')}`)
        .join('\n');
      await this.reply(
        conv,
        msg.waId,
        `Encontré varias opciones parecidas:\n${opts}\n\nResponde con el *número* de tu elección.`,
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
        .map((c, i) => `${i + 1}. ${c.name} (código ${c.code})`)
        .join('\n');
      reply += `\n\n¿Cuál prefieres?\n${opts}`;
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

    if (actions.clearCart) next.cart = [];

    if (actions.setAddress) next.address = actions.setAddress.trim();
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
        'No tenemos tu nombre guardado aquí. ¿Cómo te llamas? (para este pedido)',
      );
      return;
    }
    if (!session.address?.trim()) {
      await this.conversationService.saveSession(conv, session, 'awaiting_address');
      await this.reply(conv, waId, 'Indícame la *dirección de entrega* completa para este pedido.');
      return;
    }
    if (!session.paymentMethod) {
      const cfg = await this.settingsService.getEffectiveConfig();
      let opts = 'Responde *contraentrega* (efectivo al recibir).';
      if (cfg.allowMercadoPago) opts += ' O *mercado pago* para un link de pago.';
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
      await this.conversationService.saveSession(
        conv,
        { cart: [], address: undefined, paymentMethod: undefined },
        'completed',
      );
      await this.reply(
        conv,
        waId,
        `✅ *Pedido registrado* #${String(order.dailyOrderNumber).padStart(2, '0')}\n` +
          `A nombre de: ${conv.customerName}\n` +
          `Pago: contra entrega\n` +
          `¡Gracias por tu pedido en Pronto Pollo Portal!`,
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
