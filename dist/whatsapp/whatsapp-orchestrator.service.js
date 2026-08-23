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
var WhatsappOrchestratorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsappOrchestratorService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const whatsapp_settings_service_1 = require("./whatsapp-settings.service");
const whatsapp_meta_service_1 = require("./whatsapp-meta.service");
const whatsapp_catalog_service_1 = require("./whatsapp-catalog.service");
const whatsapp_ai_service_1 = require("./whatsapp-ai.service");
const whatsapp_conversation_service_1 = require("./whatsapp-conversation.service");
const business_service_1 = require("../business/business.service");
const orders_service_1 = require("../orders/orders.service");
const payments_service_1 = require("../payments/payments.service");
const whatsapp_action_guard_service_1 = require("./whatsapp-action-guard.service");
const whatsapp_business_rules_1 = require("./whatsapp-business-rules");
let WhatsappOrchestratorService = WhatsappOrchestratorService_1 = class WhatsappOrchestratorService {
    settingsService;
    metaService;
    catalogService;
    aiService;
    conversationService;
    businessService;
    ordersService;
    paymentsService;
    actionGuard;
    logger = new common_1.Logger(WhatsappOrchestratorService_1.name);
    constructor(settingsService, metaService, catalogService, aiService, conversationService, businessService, ordersService, paymentsService, actionGuard) {
        this.settingsService = settingsService;
        this.metaService = metaService;
        this.catalogService = catalogService;
        this.aiService = aiService;
        this.conversationService = conversationService;
        this.businessService = businessService;
        this.ordersService = ordersService;
        this.paymentsService = paymentsService;
        this.actionGuard = actionGuard;
    }
    async handleIncoming(msg) {
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
            await this.reply(conv, msg.waId, 'Te comunico con el equipo 🙋. Un agente tomará este chat desde el panel admin. Puedes seguir escribiendo aquí.');
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
                    await this.reply(conv, msg.waId, `Agregué *${product.name}* (${attrs.map((a) => a.attributeValue).join(', ')}). ¿Algo más o *confirmar*?`);
                    return;
                }
                await this.reply(conv, msg.waId, `Indica la opción para *${product.name}*:\n${this.actionGuard.formatAttributeOptions(product)}`);
                return;
            }
            session.pendingAttribute = undefined;
        }
        if (!status.isOpen && !cfg.ignoreBusinessHours) {
            await this.reply(conv, msg.waId, `Ahora estamos *cerrados*. ${status.message}. ${status.subMessage ?? ''}\n\nHorario hoy: ${status.openTime}–${status.closeTime}. Cuando abramos escríbenos de nuevo para pedir.`);
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
            await this.reply(conv, msg.waId, `Agregué *${chosen.name}* (código ${chosen.code}). ¿Algo más o escribe *confirmar*?`);
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
                    await this.reply(conv, msg.waId, `*${found.name}* (código ${found.code}). Elige opción:\n${this.actionGuard.formatAttributeOptions(found)}`);
                    return;
                }
                session = this.addProductToCart(session, found, 1);
                await this.conversationService.saveSession(conv, { ...session, pendingMatch: undefined });
                await this.reply(conv, msg.waId, `Agregué *${found.name}* (código ${found.code}) — $${Math.round(found.price).toLocaleString('es-CO')}. ¿Deseas algo más?`);
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
        }
        else if (cfg.allowMercadoPago && /\b(mercado\s*pago|tarjeta|link\s*de\s*pago)\b/.test(lower)) {
            session.paymentMethod = 'mercadopago';
            await this.conversationService.saveSession(conv, session, 'confirming');
        }
        const nameMatches = this.catalogService.searchByName(text, products, 5);
        if (nameMatches.length === 1 && !session.pendingMatch) {
            const one = nameMatches[0];
            if (one.hasAttributes && one.attributes?.length) {
                session = { ...session, pendingAttribute: this.toPendingAttribute(one), pendingMatch: undefined };
                await this.conversationService.saveSession(conv, session);
                await this.reply(conv, msg.waId, `*${one.name}* (código ${one.code}). Elige opción:\n${this.actionGuard.formatAttributeOptions(one)}`);
                return;
            }
            session = this.addProductToCart(session, one, 1);
            await this.conversationService.saveSession(conv, session);
            await this.reply(conv, msg.waId, `Agregué *${nameMatches[0].name}* (código ${nameMatches[0].code}). ¿Algo más?`);
            return;
        }
        if (nameMatches.length > 1 && !session.pendingMatch) {
            session.pendingMatch = { query: text, candidates: nameMatches };
            await this.conversationService.saveSession(conv, session);
            const opts = nameMatches
                .map((c, i) => `${i + 1}. ${c.name} (código ${c.code}) — $${Math.round(c.price).toLocaleString('es-CO')}`)
                .join('\n');
            await this.reply(conv, msg.waId, `Encontré varias opciones parecidas:\n${opts}\n\nResponde con el *número* de tu elección.`);
            return;
        }
        const menuDetailed = await this.catalogService.getMenuDetailedText();
        const recent = await this.conversationService.getRecentMessageTexts(conv.id, 10);
        const customerHint = session.linkedUserId
            ? `Cliente web: ${session.linkedUserName}. Igual pide nombre y dirección nuevos para este pedido.`
            : 'Sin usuario guardado en WhatsApp. Pide nombre y dirección antes de confirmar.';
        const rulesBlock = (0, whatsapp_business_rules_1.buildWhatsappBusinessRulesBlock)({
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
    async applyActions(conv, session, actions, products) {
        if (!actions)
            return session;
        let next = { ...session };
        if (actions.clearCart)
            next.cart = [];
        if (actions.setAddress)
            next.address = actions.setAddress.trim();
        if (actions.setOrderType)
            next.orderType = actions.setOrderType;
        if (actions.setPaymentMethod)
            next.paymentMethod = actions.setPaymentMethod;
        if (actions.addItems?.length) {
            for (const item of actions.addItems) {
                const product = products.find((p) => p.id === item.productId);
                if (!product)
                    continue;
                next = this.addProductToCart(next, product, item.quantity ?? 1, item.note, item.attributes);
            }
        }
        if (actions.removeProductIds?.length) {
            next.cart = next.cart.filter((c) => !actions.removeProductIds.includes(c.productId));
        }
        if (actions.requestHuman) {
            await this.conversationService.setHumanTakeover(conv.id, true);
        }
        return next;
    }
    addProductToCart(session, product, quantity, note, attributes) {
        const cart = [...session.cart];
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
    toPendingAttribute(product) {
        return {
            productId: product.id,
            name: product.name,
            code: product.code,
            price: product.price,
            attributes: product.attributes || [],
            selected: [],
        };
    }
    buildSessionSummary(conv, session, deliveryFee) {
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
    formatOrderSummary(conv, session, deliveryFee) {
        const subtotal = session.cart.reduce((s, c) => s + c.unitPrice, 0);
        const fee = session.orderType === 'delivery' ? deliveryFee : 0;
        const total = subtotal + fee;
        return (`📋 *Resumen*\n` +
            session.cart.map((c) => `• ${c.name} — $${Math.round(c.unitPrice).toLocaleString('es-CO')}`).join('\n') +
            `\n\nSubtotal: $${Math.round(subtotal).toLocaleString('es-CO')}` +
            (fee ? `\nDomicilio: $${Math.round(fee).toLocaleString('es-CO')}` : '') +
            `\n*Total: $${Math.round(total).toLocaleString('es-CO')}*` +
            `\nNombre: ${conv.customerName}` +
            `\nDirección: ${session.address}` +
            `\nPago: ${session.paymentMethod === 'mercadopago' ? 'Mercado Pago' : 'Contra entrega'}`);
    }
    isReadyToConfirm(session, conv) {
        return (session.cart.length > 0 &&
            !!conv.customerName?.trim() &&
            !!session.address?.trim() &&
            !!session.paymentMethod);
    }
    async tryConfirmOrder(conv, waId, session) {
        if (!session.cart.length) {
            await this.reply(conv, waId, 'Tu carrito está vacío. Dime productos por nombre o código.');
            return;
        }
        if (!conv.customerName?.trim()) {
            await this.conversationService.saveSession(conv, session, 'awaiting_name');
            await this.reply(conv, waId, 'No tenemos tu nombre guardado aquí. ¿Cómo te llamas? (para este pedido)');
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
            if (cfg.allowMercadoPago)
                opts += ' O *mercado pago* para un link de pago.';
            await this.conversationService.saveSession(conv, session, 'awaiting_payment');
            await this.reply(conv, waId, `¿Cómo pagas?\n${opts}`);
            return;
        }
        const cfg = await this.settingsService.getEffectiveConfig();
        const items = session.cart.flatMap((c) => Array.from({ length: c.quantity }, () => ({
            productId: c.productId,
            note: c.note,
            attributes: c.attributes,
        })));
        const orderDto = {
            customerName: conv.customerName.trim(),
            phone: conv.phoneE164,
            address: session.address.trim(),
            orderType: session.orderType,
            deliveryFee: session.orderType === 'delivery' ? cfg.defaultDeliveryFee : undefined,
            orderSource: 'whatsapp',
            items,
            clientRequestId: `wa-${conv.id}-${(0, crypto_1.randomUUID)()}`.slice(0, 64),
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
                const pref = await this.paymentsService.createPreference(orderDto, mpItems, total, {
                    name: conv.customerName.trim(),
                    email: `${conv.phoneE164.replace(/\D/g, '')}@whatsapp.ppp.local`,
                    phone: conv.phoneE164,
                });
                await this.conversationService.saveSession(conv, session, 'awaiting_mp_payment');
                await this.reply(conv, waId, `Link de pago Mercado Pago:\n${pref.initPoint}\n\nAl confirmarse el pago crearemos tu pedido.`);
                return;
            }
            const order = await this.ordersService.create(orderDto);
            await this.conversationService.saveSession(conv, { cart: [], address: undefined, paymentMethod: undefined }, 'completed');
            await this.reply(conv, waId, `✅ *Pedido registrado* #${String(order.dailyOrderNumber).padStart(2, '0')}\n` +
                `A nombre de: ${conv.customerName}\n` +
                `Pago: contra entrega\n` +
                `¡Gracias por tu pedido en Pronto Pollo Portal!`);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Error al crear pedido';
            this.logger.error(`Order create failed: ${message}`);
            await this.reply(conv, waId, `No pude registrar el pedido: ${message}. Escribe *humano* para ayuda.`);
        }
    }
    async sendHumanReply(conversationId, body, _agent) {
        const conv = await this.conversationService.getConversation(conversationId);
        await this.metaService.sendText(conv.waId, body);
        await this.conversationService.logMessage({
            conversationId: conv.id,
            direction: 'out',
            body,
            sentBy: 'human',
        });
    }
    async reply(conv, waId, body) {
        await this.metaService.sendText(waId, body);
        await this.conversationService.logMessage({
            conversationId: conv.id,
            direction: 'out',
            body,
            sentBy: 'bot',
        });
    }
};
exports.WhatsappOrchestratorService = WhatsappOrchestratorService;
exports.WhatsappOrchestratorService = WhatsappOrchestratorService = WhatsappOrchestratorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [whatsapp_settings_service_1.WhatsappSettingsService,
        whatsapp_meta_service_1.WhatsappMetaService,
        whatsapp_catalog_service_1.WhatsappCatalogService,
        whatsapp_ai_service_1.WhatsappAiService,
        whatsapp_conversation_service_1.WhatsappConversationService,
        business_service_1.BusinessService,
        orders_service_1.OrdersService,
        payments_service_1.PaymentsService,
        whatsapp_action_guard_service_1.WhatsappActionGuardService])
], WhatsappOrchestratorService);
//# sourceMappingURL=whatsapp-orchestrator.service.js.map