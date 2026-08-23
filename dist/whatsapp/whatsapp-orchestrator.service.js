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
const whatsapp_payment_methods_1 = require("./whatsapp-payment-methods");
const whatsapp_cart_limits_1 = require("./whatsapp-cart-limits");
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
        let text = (msg.text || '').trim();
        if (msg.messageType === 'audio' && msg.mediaId) {
            const resolved = await this.resolveAudioToText(msg, logged.id);
            if (!resolved) {
                await this.reply(conv, msg.waId, 'No pude escuchar bien el audio 🙏 ¿Me lo escribes por texto?\n\n' + this.humanHelpHint());
                return;
            }
            text = resolved;
            await this.reply(conv, msg.waId, `Te escuché: _${this.shortQuote(text)}_`);
        }
        else if (msg.messageType === 'image' && msg.mediaId) {
            const img = await this.resolveImageMessage(msg, logged.id, conv, cfg);
            if (img.done)
                return;
            text = img.text;
            await this.reply(conv, msg.waId, `Vi en tu foto: _${this.shortQuote(text)}_`);
        }
        else if (msg.messageType === 'location') {
            const addr = this.formatLocationAddress(msg);
            if (!addr) {
                await this.reply(conv, msg.waId, 'Recibí tu ubicación pero no pude leerla. ¿Me escribes la dirección o mandas de nuevo el pin?');
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
            }
            else {
                await this.reply(conv, msg.waId, '¿Qué se te antoja pedir? Dime por nombre o código.');
            }
            return;
        }
        else if (msg.messageType !== 'text') {
            await this.reply(conv, msg.waId, 'Recibí tu mensaje 👍 El asistente trabaja mejor con *texto*, *nota de voz*, *foto del menú* o *ubicación*.\n\n' +
                this.humanHelpHint());
            return;
        }
        if (!text) {
            await this.reply(conv, msg.waId, '¿Qué se te antoja? Puedes pedir por código o nombre.');
            return;
        }
        const lower = text.toLowerCase();
        if (/\b(humano|persona|agente|asesor|asesora|hablar\s+con\s+alguien)\b/.test(lower)) {
            await this.conversationService.setHumanTakeover(conv.id, true);
            await this.reply(conv, msg.waId, cfg.humanHandoffMessage);
            return;
        }
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
        const products = cfg.ignoreBusinessHours
            ? productsRaw.map((p) => ({ ...p, availableNow: true }))
            : productsRaw;
        const inboundCount = await this.conversationService.countInboundMessages(conv.id);
        if (inboundCount <= 1) {
            if (this.isVagueOrderIntent(text) &&
                this.catalogService.extractCodeFromMessage(text) == null &&
                this.catalogService.findProductEmbeddedInMessage(text, products) == null &&
                this.catalogService.searchByName(this.catalogService.extractProductSearchQuery(text), products, 5).length === 0) {
                await this.reply(conv, msg.waId, this.buildAskWhatToOrderMessage(cfg));
                return;
            }
            await this.reply(conv, msg.waId, this.buildWelcomeMessage(cfg));
            if (this.isGreetingKeyword(text) || text.length < 2)
                return;
        }
        {
            const fresh = await this.conversationService.reloadConversation(conv.id);
            Object.assign(conv, fresh);
            session = this.conversationService.getSession(conv);
        }
        if (session.pendingAttribute || conv.state === 'awaiting_attribute') {
            const pa = session.pendingAttribute;
            const product = pa
                ? this.catalogService.getProductById(pa.productId, products) ||
                    {
                        id: pa.productId,
                        name: pa.name,
                        code: pa.code,
                        price: pa.price,
                        hasAttributes: true,
                        attributes: pa.attributes,
                        availableNow: true,
                    }
                : null;
            if (pa && product) {
                const step = this.catalogService.resolveNextAttributeChoice(product, text, pa.selected || []);
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
                    await this.reply(conv, msg.waId, `Te agregué *${product.name}* (${chosen}) — $${Math.round(product.price).toLocaleString('es-CO')}.\n\n` +
                        `${this.formatCartOnly(session, cfg.defaultDeliveryFee)}\n\n` +
                        `¿Algo más? Cuando quieras escribe *confirmar*.`);
                    return;
                }
                if (step.status === 'partial') {
                    session.pendingAttribute = {
                        ...pa,
                        selected: step.attributes,
                    };
                    await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
                    await this.reply(conv, msg.waId, this.catalogService.formatProductOptionsPrompt(product, step.attributes));
                    return;
                }
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
                await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
                await this.reply(conv, msg.waId, `No te capté esa opción. Respóndeme con el *nombre* (medio, cuarto…) o el *número*.\n\n` +
                    this.catalogService.formatProductVariantsOverview(product, 'order'));
                return;
            }
            session.pendingAttribute = undefined;
            await this.conversationService.saveSession(conv, session, 'building_cart');
            if (/^[1-9]\d{0,2}$/.test(text.trim())) {
                await this.reply(conv, msg.waId, 'Uy, se me fue la selección. Dime otra vez el *nombre* o *código* del producto y te muestro las opciones.');
                return;
            }
        }
        if (!status.isOpen && !cfg.ignoreBusinessHours) {
            await this.reply(conv, msg.waId, cfg.closedMessage ||
                `Ahora estamos *cerrados*. ${status.message}. ${status.subMessage ?? ''}\n\nHorario hoy: ${status.openTime}–${status.closeTime}. Cuando abramos escríbenos de nuevo para pedir.`);
            return;
        }
        const isConfirm = this.isConfirmKeyword(text);
        const isGreeting = this.isGreetingKeyword(text);
        if (reopenedFreshOrder) {
            if (isGreeting || this.isVagueOrderIntent(text) || text.length < 2) {
                await this.reply(conv, msg.waId, `Listo, el pedido anterior ya quedó. ¿Qué se te antoja ahora?\n\n` +
                    `Puedes pedir por *nombre* o *código*, o escribe *menú*.`);
                return;
            }
        }
        if (conv.state === 'awaiting_name' && !isConfirm && !isGreeting && text.length >= 2) {
            if (this.looksLikeAddress(text) ||
                this.looksLikePayment(text, cfg.paymentMethods) ||
                this.isPickupIntent(text) ||
                this.isDeliveryIntent(text)) {
                await this.reply(conv, msg.waId, '¿Me regalas tu *nombre completo*? (ej. Juan Pérez). Después te pregunto si es domicilio o si pasas tú.');
                return;
            }
            await this.conversationService.updateCustomerName(conv, text);
            await this.conversationService.saveSession(conv, session, 'building_cart');
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
            if (this.isPickupIntent(text)) {
                session = this.applyPickupIntent(session, text);
                await this.conversationService.saveSession(conv, session, 'building_cart');
                const fresh = await this.conversationService.reloadConversation(conv.id);
                Object.assign(conv, fresh);
                session = this.conversationService.getSession(conv);
                await this.reply(conv, msg.waId, `Perfecto, entonces *pasas tú por el local* ✅ (sin domicilio).\n_${session.address}_`);
                await this.tryConfirmOrder(conv, msg.waId, session);
                return;
            }
            if (text.length >= 8) {
                if (!this.looksLikeAddress(text)) {
                    await this.reply(conv, msg.waId, '¿Me pasas la *dirección de entrega* o me dices si *pasas a recoger*? (ej. “paso en 15 minutos”).\nEjemplo domicilio: Calle 10 #5-20, barrio Centro.');
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
            await this.reply(conv, msg.waId, '¿Te lo enviamos a *domicilio* o *pasas tú*?\n' +
                '• Domicilio: escríbeme la dirección completa.\n' +
                '• Si pasas: algo como *paso en 15 minutos*.');
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
            await this.reply(conv, msg.waId, (0, whatsapp_payment_methods_1.buildPaymentOptionsPrompt)(cfg.paymentMethods, cfg.paymentInstructions));
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
        if (isGreeting || this.isMenuLinkIntent(text)) {
            if (this.isMenuLinkIntent(text)) {
                await this.reply(conv, msg.waId, cfg.menuLinkMessage);
                return;
            }
            await this.reply(conv, msg.waId, this.buildWelcomeMessage(cfg));
            return;
        }
        if (this.isVagueOrderIntent(text)) {
            const codeProbe = this.catalogService.extractCodeFromMessage(text);
            const nameProbe = this.catalogService.searchByName(text, products, 5);
            if (codeProbe == null && nameProbe.length === 0) {
                await this.reply(conv, msg.waId, this.buildAskWhatToOrderMessage(cfg));
                return;
            }
        }
        const pick = session.pendingMatch && /^[1-9]\d*$/.test(lower) ? parseInt(lower, 10) : null;
        if (pick && session.pendingMatch && pick <= session.pendingMatch.candidates.length) {
            const chosenLite = session.pendingMatch.candidates[pick - 1];
            const chosen = this.catalogService.getProductById(chosenLite.id, products) || chosenLite;
            session.pendingMatch = undefined;
            if (chosen.hasAttributes && chosen.attributes?.length) {
                if (await this.handleProductWithVariants(conv, msg.waId, session, chosen, text, cfg)) {
                    return;
                }
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
            await this.reply(conv, msg.waId, `Te agregué *${chosen.name}* (código ${chosen.code}) — $${Math.round(chosen.price).toLocaleString('es-CO')}.\n\n` +
                `${this.formatCartOnly(session, cfg.defaultDeliveryFee)}\n\n` +
                `¿Algo más, o escribes *confirmar*?`);
            return;
        }
        if (session.pendingMultiOrder) {
            const multiHandled = await this.tryResolvePendingMultiOrder(conv, msg.waId, session, text, products, cfg);
            if (multiHandled)
                return;
        }
        if (session.pendingCategoryBrowse?.categories?.length) {
            const pickedCategory = this.catalogService.resolveCategoryBrowsePick(text, session.pendingCategoryBrowse.categories);
            if (pickedCategory) {
                const catProducts = products.filter((p) => p.categoryName === pickedCategory && p.availableNow !== false);
                session = {
                    ...session,
                    pendingCategoryBrowse: undefined,
                    pendingMatch: { query: pickedCategory, candidates: catProducts },
                };
                await this.conversationService.saveSession(conv, session);
                await this.reply(conv, msg.waId, this.catalogService.formatCategoryList(pickedCategory, catProducts));
                return;
            }
        }
        const categorySwitch = await this.tryHandleCategoryBrowse(conv, msg.waId, session, products, text, cfg.menuConceptGroups);
        if (categorySwitch === null)
            return;
        session = categorySwitch;
        if (this.isPickupIntent(text)) {
            session = this.applyPickupIntent(session, text);
            await this.conversationService.saveSession(conv, session);
            await this.reply(conv, msg.waId, `Listo, queda como *recoger en el local* (sin domicilio).\n_${session.address}_`);
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
                await this.reply(conv, msg.waId, `${this.formatCartOnly(session, cfg.defaultDeliveryFee)}\n\n` +
                    `Dale, *domicilio*. ¿Me escribes la *dirección de entrega* completa?`);
                return;
            }
            await this.reply(conv, msg.waId, 'Dale, lo dejamos en *domicilio*.');
            return;
        }
        const code = this.catalogService.extractCodeFromMessage(text);
        const bareOptionNumber = /^[1-9]\d{0,2}$/.test(text.trim());
        if (code != null && !(bareOptionNumber && (session.pendingMatch || session.pendingAttribute || conv.state === 'awaiting_attribute'))) {
            const found = this.catalogService.findByCode(code, products);
            if (found) {
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
                await this.reply(conv, msg.waId, `Te agregué *${found.name}* (código ${found.code}) — $${Math.round(found.price).toLocaleString('es-CO')}.${desc}\n\n` +
                    `${this.formatCartOnly(session, cfg.defaultDeliveryFee)}\n\n¿Se te antoja algo más? Cuando quieras escribe *confirmar*.`);
                return;
            }
            await this.reply(conv, msg.waId, `No hallé un producto activo con código *${code}*. ¿Lo buscamos por nombre?`);
            return;
        }
        if (/\b(confirmar|confirmo|listo pedido|finalizar)\b/.test(lower)) {
            const fresh = await this.conversationService.reloadConversation(conv.id);
            Object.assign(conv, fresh);
            session = this.conversationService.getSession(conv);
            await this.tryConfirmOrder(conv, msg.waId, session);
            return;
        }
        if (conv.state === 'building_cart' &&
            session.cart.length > 0 &&
            !session.pendingMatch &&
            !session.pendingAttribute &&
            this.looksLikeStandaloneOrderNote(text)) {
            session = this.appendCustomerNote(session, text);
            await this.conversationService.saveSession(conv, session);
            await this.reply(conv, msg.waId, `Anotado 📝 _${session.customerNotes}_\n\n¿Algo más o escribes *confirmar*?`);
            return;
        }
        if (/\b(contraentrega|efectivo|cash|transferencia|nequi|mercadopago|mercado\s*pago)\b/.test(lower) ||
            (0, whatsapp_payment_methods_1.findPaymentMethodByText)(text, cfg.paymentMethods)) {
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
        if (this.catalogService.isMenuExploreIntent(text, products) &&
            !session.pendingAttribute &&
            conv.state === 'building_cart') {
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
        if (!session.pendingMatch &&
            !session.pendingAttribute &&
            !session.pendingMultiOrder &&
            (await this.tryHandleProductInfoInquiry(conv, msg.waId, text, products, cfg))) {
            return;
        }
        if (!session.pendingMatch && !session.pendingAttribute && !session.pendingMultiOrder) {
            const multi = this.catalogService.resolveMultiProductOrder(text, products);
            if (multi) {
                const handled = await this.tryHandleMultiProductOrder(conv, msg.waId, session, multi, cfg, text);
                if (handled)
                    return;
            }
        }
        const embeddedProduct = this.catalogService.findProductEmbeddedInMessage(text, products);
        if (embeddedProduct && !session.pendingMatch) {
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
            const embeddedDesc = embeddedProduct.description
                ? `\n_${embeddedProduct.description}_`
                : '';
            const addrNote = deliveryTail ? `\n\nDomicilio anotado: _${deliveryTail}_` : '';
            await this.reply(conv, msg.waId, `Te agregué *${embeddedProduct.name}* (código ${embeddedProduct.code}) — $${Math.round(embeddedProduct.price).toLocaleString('es-CO')}.${embeddedDesc}\n\n` +
                `${this.formatCartOnly(session, cfg.defaultDeliveryFee)}${addrNote}\n\n¿Algo más? Cuando quieras escribe *confirmar*.`);
            return;
        }
        const productQuery = this.catalogService.extractProductSearchQuery(text);
        const nameScored = this.mergeNameScores(this.catalogService.searchByNameScored(productQuery, products, 8), productQuery === text
            ? []
            : this.catalogService.searchByNameScored(text, products, 8));
        const nameMatches = nameScored.map((x) => x.p);
        const strongProduct = this.catalogService.isStrongProductMatch(nameScored);
        const resolvedMatches = strongProduct && nameScored.length >= 1 && nameScored[0].score >= 80
            ? [nameScored[0].p]
            : nameMatches;
        if (resolvedMatches.length === 1 && !session.pendingMatch) {
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
            const desc = one.description ? `\n_${one.description}_` : '';
            const addrNote = deliveryTail ? `\n\nDomicilio anotado: _${deliveryTail}_` : '';
            await this.reply(conv, msg.waId, `Te agregué *${one.name}* (código ${one.code}) — $${Math.round(one.price).toLocaleString('es-CO')}.${desc}\n\n` +
                `${this.formatCartOnly(session, cfg.defaultDeliveryFee)}${addrNote}\n\n¿Algo más? Cuando quieras escribe *confirmar*.`);
            return;
        }
        if (resolvedMatches.length > 1 && !session.pendingMatch) {
            session.pendingMatch = { query: text, candidates: resolvedMatches };
            await this.conversationService.saveSession(conv, session);
            const opts = resolvedMatches.map((c, i) => this.catalogService.formatProductListItem(c, i + 1)).join('\n\n');
            await this.reply(conv, msg.waId, `Encontré varias, mira:\n\n${opts}\n\nRespóndeme con el *número* o el *código*.`);
            return;
        }
        const menuDetailed = await this.catalogService.getMenuDetailedText();
        const recent = await this.conversationService.getRecentMessageTexts(conv.id, 10);
        const exploringMenu = this.catalogService.isMenuExploreIntent(text, products) ||
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
        const rulesBlock = (0, whatsapp_business_rules_1.buildWhatsappBusinessRulesBlock)({
            brandName: cfg.brandName || cfg.localContext?.restaurantName || 'Pronto Pollo Portal',
            businessStatus: businessOpenForBot ? { ...status, isOpen: true } : status,
            deliveryFee: cfg.defaultDeliveryFee,
            allowMercadoPago: !!cfg.allowMercadoPago,
            menuProductCount: products.filter((p) => p.availableNow !== false).length,
            localContextBlock: cfg.localContextBlock,
            orderLimitsBlock: (0, whatsapp_cart_limits_1.buildOrderLimitsPromptBlock)(this.toCartLimitsConfig(cfg)),
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
        if ((this.catalogService.isPriceInquiryIntent(text) ||
            this.catalogService.isGenericProductInquiry(text)) &&
            guarded.actions) {
            delete guarded.actions.addItems;
            delete guarded.actions.setAddress;
            delete guarded.actions.setPaymentMethod;
        }
        if (session.ignorePriorOrderHistory &&
            session.cart.length === 0 &&
            guarded.actions?.addItems?.length) {
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
        if (!session.pendingAttribute && ai.actions?.addItems?.length) {
            const guardedIds = new Set((guarded.actions?.addItems || []).map((i) => i.productId));
            const blocked = ai.actions.addItems.find((item) => {
                if (guardedIds.has(item.productId))
                    return false;
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
        if (session.pendingAttribute) {
            const pa = session.pendingAttribute;
            const product = this.catalogService.getProductById(pa.productId, products) ||
                {
                    id: pa.productId,
                    name: pa.name,
                    code: pa.code,
                    price: pa.price,
                    hasAttributes: true,
                    attributes: pa.attributes,
                    availableNow: true,
                };
            await this.conversationService.saveSession(conv, session, 'building_cart');
            await this.reply(conv, msg.waId, this.catalogService.formatProductVariantsOverview(product, this.catalogService.isGenericProductInquiry(text) ? 'info' : 'order'));
            return;
        }
        if (session.pendingMatch?.candidates?.length && this.isPendingListRepromptText(text)) {
            const catName = session.pendingMatch.candidates[0]?.categoryName;
            const allSameCat = catName &&
                session.pendingMatch.candidates.every((c) => c.categoryName === catName);
            if (allSameCat) {
                await this.conversationService.saveSession(conv, session);
                await this.reply(conv, msg.waId, this.catalogService.formatCategoryList(catName, session.pendingMatch.candidates));
                return;
            }
            const opts = session.pendingMatch.candidates
                .map((c, i) => this.catalogService.formatProductListItem(c, i + 1))
                .join('\n\n');
            await this.conversationService.saveSession(conv, session);
            await this.reply(conv, msg.waId, `Encontré varias, mira:\n\n${opts}\n\nRespóndeme con el *número* o el *código*.`);
            return;
        }
        const wantsCheckout = !!ai.actions?.requestConfirm ||
            /\b(confirmar|listo|finalizar|pagar|domicilio)\b/.test(lower) ||
            !!(ai.actions?.setCustomerName || ai.actions?.setAddress || ai.actions?.setPaymentMethod);
        if (wantsCheckout && session.cart.length > 0) {
            await this.conversationService.saveSession(conv, session);
            await this.tryConfirmOrder(conv, msg.waId, session);
            return;
        }
        await this.conversationService.saveSession(conv, session);
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
        const softWarnings = guarded.warnings.filter((w) => !/requiere elegir|opciones inválidas|elige:/i.test(w));
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
    async applyActions(conv, session, actions, products, cfg) {
        if (!actions)
            return { session };
        let next = { ...session };
        if (actions.clearCart) {
        }
        if (actions.setAddress) {
            const addr = actions.setAddress.trim();
            if (addr.length >= 10 && !this.isConfirmKeyword(addr) && !this.isGreetingKeyword(addr)) {
                next.address = addr;
                if (!this.isPickupIntent(addr))
                    next.orderType = 'delivery';
            }
        }
        if (actions.setOrderType === 'pickup') {
            next = this.applyPickupIntent(next, actions.setAddress || 'pickup');
        }
        else if (actions.setOrderType === 'delivery') {
            next.orderType = 'delivery';
        }
        if (actions.setPaymentMethod)
            next.paymentMethod = actions.setPaymentMethod;
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
                if (!product)
                    continue;
                const attempt = this.tryAddProductToCart(next, product, item.quantity ?? 1, cfg, item.note, item.attributes);
                if (attempt.blocked) {
                    return { session: next, limitBlocked: attempt.blocked };
                }
                next = attempt.session;
            }
        }
        if (actions.removeProductIds?.length) {
            next.cart = next.cart.filter((c) => !actions.removeProductIds.includes(c.productId));
        }
        if (actions.requestHuman) {
            await this.conversationService.setHumanTakeover(conv.id, true);
        }
        return { session: next };
    }
    toCartLimitsConfig(cfg) {
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
    tryAddProductToCart(session, product, quantity, cfg, note, attributes) {
        const projected = this.addProductToCart(session, product, quantity, note, attributes);
        const check = (0, whatsapp_cart_limits_1.evaluateCartLimits)(projected.cart, this.toCartLimitsConfig(cfg), {
            orderType: projected.orderType,
        });
        if (!check.ok)
            return { session, blocked: check };
        return {
            session: {
                ...projected,
                ignorePriorOrderHistory: false,
            },
        };
    }
    async handleCartLimitBlocked(conv, waId, blocked, cfg) {
        const shouldHandoff = !!blocked.handoff && cfg.handoffWhenMaxExceeded !== false && blocked.kind !== 'min';
        if (shouldHandoff) {
            await this.conversationService.setHumanTakeover(conv.id, true);
            await this.reply(conv, waId, cfg.largeOrderHandoffMessage ||
                `${blocked.reason || 'Ese pedido se sale del tope por WhatsApp.'}\n\n${cfg.humanHandoffMessage}`);
            return;
        }
        await this.reply(conv, waId, blocked.reason || 'Ese pedido supera el límite permitido.');
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
            lines.push('NUEVO PEDIDO: carrito vacío tras pedido anterior. NO reutilices ítems del historial.');
        }
        if (session.pendingAttribute) {
            const pa = session.pendingAttribute;
            const remaining = (pa.attributes || []).filter((a) => !(pa.selected || []).some((s) => s.attributeName === a.attributeName));
            const next = remaining[0];
            lines.push(`ELECCIÓN PENDIENTE: producto "${pa.name}" (código ${pa.code}, id ${pa.productId}).` +
                (pa.selected?.length
                    ? ` Ya eligió: ${pa.selected.map((s) => `${s.attributeName}=${s.attributeValue}`).join(', ')}.`
                    : '') +
                (next
                    ? ` Falta elegir "${next.attributeName}": ${next.options.map((o, i) => `${i + 1}) ${o}`).join(', ')}.`
                    : ''));
        }
        if (session.pendingMatch?.candidates?.length) {
            lines.push(`LISTA PENDIENTE (${session.pendingMatch.candidates.length}): el cliente debe elegir número o código.`);
        }
        if (session.pendingCategoryBrowse?.categories?.length) {
            lines.push(`EXPLORANDO MENÚ — categorías mostradas: ${session.pendingCategoryBrowse.categories.join(', ')}. Espera que elija categoría o plato concreto.`);
        }
        if (session.pendingMultiOrder) {
            const pm = session.pendingMultiOrder;
            lines.push(`PEDIDO MULTI PENDIENTE: ${pm.confident.length} claro(s), ${pm.ambiguous.length} dudoso(s), ${pm.unresolved.length} sin hallar. Espera *sí* o corrección/número.`);
        }
        return lines.join('\n');
    }
    replyLooksLikeProductDump(reply) {
        const codeHits = (reply.match(/\bc[oó]d(?:igo|\.)?\s*\d{1,3}\b/gi) || []).length;
        const numberedList = (reply.match(/^\s*\d{1,2}[.)]\s/mg) || []).length;
        return codeHits >= 4 || numberedList >= 5;
    }
    async tryHandleCategoryBrowse(conv, waId, session, products, text, menuConceptGroups) {
        const hit = this.catalogService.findCategoryBrowseHit(text, products, menuConceptGroups);
        if (!hit?.products.length)
            return session;
        const pendingKey = session.pendingMatch?.query || session.pendingMatch?.candidates?.[0]?.categoryName;
        if (pendingKey === hit.categoryName)
            return session;
        const next = {
            ...session,
            pendingCategoryBrowse: undefined,
            pendingMatch: {
                query: hit.categoryName,
                candidates: hit.products,
            },
        };
        await this.conversationService.saveSession(conv, next);
        await this.reply(conv, waId, this.catalogService.formatCategoryList(hit.categoryName, hit.products));
        return null;
    }
    isPendingListRepromptText(text) {
        const t = text.trim().toLowerCase();
        if (!t)
            return true;
        if (/^[1-9]\d{0,2}$/.test(t))
            return true;
        if (/\?/.test(t))
            return true;
        if (/\b(cuales|cuáles|opciones|lista|no entendi|no entendí|otra vez|de nuevo|cuál|cual|numero|número)\b/i.test(t)) {
            return true;
        }
        return false;
    }
    looksLikeSideQuestion(text) {
        const t = text.trim();
        if (!t || /^[1-9]\d{0,2}$/.test(t))
            return false;
        if (/^(opci[oó]n|la|el)\s*[1-9]\d{0,2}$/i.test(t))
            return false;
        if (t.length <= 2)
            return false;
        if (/\?/.test(t))
            return true;
        if (/\b(qu[eé]|c[oó]mo|cu[aá]nto|cu[aá]nta|cu[aá]ndo|d[oó]nde|por\s+qu[eé]|tiene|tienen|hay|incluye|viene|vienen|es\s+que|puedo|me\s+puedes|expl[ií]came|diferencia|tama[nñ]o|grande|peque|gratis|demora|tiempo|horario|abierto)\b/i.test(t)) {
            return true;
        }
        return t.length >= 18;
    }
    async answerSideQuestionWithAi(params) {
        const { conv, session, text, products, cfg, businessOpenForBot, status, pendingProduct } = params;
        const menuDetailed = await this.catalogService.getMenuDetailedText();
        const recent = await this.conversationService.getRecentMessageTexts(conv.id, 14);
        const pa = session.pendingAttribute;
        const nextAttr = (pa.attributes || []).find((a) => !(pa.selected || []).some((s) => s.attributeName === a.attributeName));
        const optionsHint = nextAttr
            ? nextAttr.options.map((o, i) => `${i + 1}) ${o}`).join(', ')
            : '';
        const rulesBlock = (0, whatsapp_business_rules_1.buildWhatsappBusinessRulesBlock)({
            brandName: cfg.brandName || cfg.localContext?.restaurantName || 'Pronto Pollo Portal',
            businessStatus: businessOpenForBot ? { ...status, isOpen: true } : status,
            deliveryFee: cfg.defaultDeliveryFee,
            allowMercadoPago: !!cfg.allowMercadoPago,
            menuProductCount: products.filter((p) => p.availableNow !== false).length,
            localContextBlock: cfg.localContextBlock,
            orderLimitsBlock: (0, whatsapp_cart_limits_1.buildOrderLimitsPromptBlock)(this.toCartLimitsConfig(cfg)),
            paymentMethods: cfg.paymentMethods,
        });
        const ai = await this.aiService.generateTurn({
            userMessage: text,
            businessRulesBlock: rulesBlock,
            menuDetailedText: menuDetailed,
            sessionSummary: this.buildSessionSummary(conv, session, cfg.defaultDeliveryFee),
            recentMessages: recent,
            customerHint: `El cliente aún NO eligió las opciones de *${pendingProduct.name}*. ` +
                `Respóndele con tuteo colombiano, cálido y natural (sin empalagar). ` +
                `NO reenvíes el menú completo ni la lista numerada entera. ` +
                `Al final, UNA sola frase corta recordando que falta elegir` +
                (nextAttr ? ` *${nextAttr.attributeName}* (${optionsHint})` : '') +
                `. No uses addItems hasta que elija.`,
            conversational: true,
        });
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
        if (nextAttr &&
            !/\b(elige|eleg[ií]|opci[oó]n|responde\s*[123]|cuando quieras|falta)\b/i.test(reply)) {
            reply += `\n\n_Cuando quieras: ${nextAttr.attributeName} → ${optionsHint}_`;
        }
        return reply;
    }
    formatCartOnly(session, deliveryFee) {
        if (!session.cart.length)
            return '🛒 Carrito vacío';
        const subtotal = session.cart.reduce((s, c) => s + c.unitPrice, 0);
        const fee = session.orderType === 'delivery' ? deliveryFee : 0;
        const total = subtotal + fee;
        const lines = session.cart.map((c) => {
            const attrs = c.attributes?.length
                ? ` (${c.attributes.map((a) => a.attributeValue).join(', ')})`
                : '';
            return `• ${c.name}${attrs} — $${Math.round(c.unitPrice).toLocaleString('es-CO')}`;
        });
        return (`🛒 *Tu carrito*\n` +
            lines.join('\n') +
            `\n\nSubtotal: $${Math.round(subtotal).toLocaleString('es-CO')}` +
            (fee ? `\nDomicilio: $${Math.round(fee).toLocaleString('es-CO')}` : '') +
            `\n*Total: $${Math.round(total).toLocaleString('es-CO')}*`);
    }
    formatOrderSummary(conv, session, deliveryFee, paymentMethods = []) {
        const tipo = session.orderType === 'pickup' ? 'Recoger en el local' : 'Domicilio';
        const lugarLabel = session.orderType === 'pickup' ? '📍' : '📍 Dirección';
        return (`${this.formatCartOnly(session, deliveryFee)}\n` +
            `\n🛵 Tipo: ${tipo}` +
            `\n👤 Nombre: ${conv.customerName || '(pendiente)'}` +
            `\n${lugarLabel}: ${session.address || '(pendiente)'}` +
            `\n💳 Pago: ${(0, whatsapp_payment_methods_1.paymentMethodLabel)(session.paymentMethod, paymentMethods)}` +
            (session.cashChangeFor ? `\n💵 Cambio de: ${session.cashChangeFor}` : '') +
            (session.customerNotes ? `\n📝 Notas: ${session.customerNotes}` : ''));
    }
    isReadyToConfirm(session, conv) {
        return (session.cart.length > 0 &&
            !!conv.customerName?.trim() &&
            !!session.address?.trim() &&
            !!session.paymentMethod);
    }
    async tryConfirmOrder(conv, waId, session) {
        const cfg = await this.settingsService.getEffectiveConfig();
        if (!session.cart.length) {
            await this.reply(conv, waId, 'Aún no tienes nada en el carrito. Dime qué quieres por nombre o código.');
            return;
        }
        const limitsCfg = this.toCartLimitsConfig(cfg);
        const maxCheck = (0, whatsapp_cart_limits_1.evaluateCartLimits)(session.cart, limitsCfg, {
            orderType: session.orderType,
        });
        if (!maxCheck.ok) {
            await this.handleCartLimitBlocked(conv, waId, maxCheck, cfg);
            return;
        }
        const minCheck = (0, whatsapp_cart_limits_1.evaluateCartLimits)(session.cart, limitsCfg, {
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
            await this.reply(conv, waId, `${this.formatCartOnly(session, cfg.defaultDeliveryFee)}\n\n` +
                `Para seguir, ¿me regalas tu *nombre completo*?`);
            return;
        }
        if (!session.address?.trim()) {
            session.pendingMatch = undefined;
            session.pendingAttribute = undefined;
            if (session.orderType === 'pickup') {
                session.address = session.address?.trim() || 'Recoge en el local';
                await this.conversationService.saveSession(conv, session);
            }
            else {
                await this.conversationService.saveSession(conv, session, 'awaiting_address');
                await this.reply(conv, waId, `${this.formatCartOnly(session, cfg.defaultDeliveryFee)}\n\n` +
                    `¿Te lo mandamos a *domicilio* o *pasas tú*?\n` +
                    `• Domicilio: escribe la dirección completa.\n` +
                    `• Si pasas: p. ej. *paso en 15 minutos*.`);
                return;
            }
        }
        if (!session.paymentMethod) {
            session.pendingMatch = undefined;
            session.pendingAttribute = undefined;
            await this.conversationService.saveSession(conv, session, 'awaiting_payment');
            await this.reply(conv, waId, `${this.formatCartOnly(session, cfg.defaultDeliveryFee)}\n\n` +
                (0, whatsapp_payment_methods_1.buildPaymentOptionsPrompt)(cfg.paymentMethods, cfg.paymentInstructions));
            return;
        }
        if (cfg.askOrderNotes !== false && !session.notesCollected) {
            session.pendingMatch = undefined;
            session.pendingAttribute = undefined;
            await this.conversationService.saveSession(conv, session, 'awaiting_notes');
            await this.reply(conv, waId, this.buildAskNotesMessage(cfg, session));
            return;
        }
        if (conv.state !== 'awaiting_final_confirm') {
            await this.conversationService.saveSession(conv, session, 'awaiting_final_confirm');
            await this.reply(conv, waId, `${this.formatOrderSummary(conv, session, cfg.defaultDeliveryFee, cfg.paymentMethods)}\n\n` +
                `Si todo te cuadra, escribe *confirmar* y armamos el pedido.`);
            return;
        }
        const items = session.cart.flatMap((c) => Array.from({ length: c.quantity }, () => ({
            productId: c.productId,
            note: c.note,
            attributes: c.attributes,
        })));
        const extras = this.buildOrderExtras(session);
        const orderDto = {
            customerName: conv.customerName.trim(),
            phone: conv.phoneE164,
            address: session.address.trim(),
            orderType: session.orderType,
            deliveryFee: session.orderType === 'delivery' ? cfg.defaultDeliveryFee : undefined,
            orderSource: 'whatsapp',
            items,
            ...(extras.length ? { extras } : {}),
            clientRequestId: `wa-${conv.id}-${(0, crypto_1.randomUUID)()}`.slice(0, 64),
        };
        try {
            const payMethod = (0, whatsapp_payment_methods_1.getEnabledPaymentMethods)(cfg.paymentMethods).find((m) => m.id === session.paymentMethod) || (0, whatsapp_payment_methods_1.findPaymentMethodByText)(session.paymentMethod || '', cfg.paymentMethods);
            if (payMethod?.flow === 'mercadopago' || session.paymentMethod === 'mercadopago') {
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
                }, {
                    channel: 'whatsapp',
                    conversationId: conv.id,
                    waId: conv.waId,
                    bypassOnlineHours: !!cfg.ignoreBusinessHours,
                });
                session.mpPreferenceId = pref.preferenceId;
                await this.conversationService.saveSession(conv, session, 'awaiting_mp_payment');
                await this.reply(conv, waId, `${this.formatOrderSummary(conv, session, cfg.defaultDeliveryFee, cfg.paymentMethods)}\n\n` +
                    `Link de pago Mercado Pago:\n${pref.initPoint}\n\nCuando el pago se confirme, te avisamos aquí y armamos el pedido.`);
                return;
            }
            const order = await this.ordersService.create(orderDto);
            const snapshot = { ...session };
            await this.conversationService.resetOrderSession(conv, 'completed', {
                ignorePriorHistory: true,
            });
            await this.reply(conv, waId, this.formatOrderSuccessMessage(conv, snapshot, order, cfg.defaultDeliveryFee, cfg.orderSuccessMessage, cfg.paymentMethods));
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Error al crear pedido';
            this.logger.error(`Order create failed: ${message}`);
            await this.reply(conv, waId, `Uy, no pude registrar el pedido: ${message}. Escribe *humano* y te ayudamos.`);
        }
    }
    async completeAfterMercadoPagoPayment(params) {
        try {
            const conv = await this.conversationService.getConversation(params.conversationId);
            const session = this.conversationService.getSession(conv);
            const cfg = await this.settingsService.getEffectiveConfig();
            const snapshot = { ...session };
            await this.conversationService.resetOrderSession(conv, 'completed', {
                ignorePriorHistory: true,
            });
            const success = this.formatOrderSuccessMessage(conv, snapshot, { orderId: params.orderId }, cfg.defaultDeliveryFee, cfg.orderSuccessMessage, cfg.paymentMethods) || `Pago recibido ✅ Pedido #${params.orderId} creado. ${cfg.orderSuccessMessage}`;
            await this.reply(conv, params.waId || conv.waId, success);
        }
        catch (err) {
            this.logger.error(`completeAfterMercadoPagoPayment failed conv=${params.conversationId} order=${params.orderId}`, err);
        }
    }
    async sendHumanReply(conversationId, body, agent) {
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
    shortQuote(text, max = 160) {
        const t = text.replace(/\s+/g, ' ').trim();
        if (t.length <= max)
            return t;
        return `${t.slice(0, max - 1)}…`;
    }
    async resolveAudioToText(msg, loggedMessageId) {
        try {
            const { buffer, mimeType } = await this.metaService.downloadMedia(msg.mediaId);
            const transcript = await this.aiService.transcribeAudio(buffer, msg.mimeType || mimeType);
            if (!transcript)
                return null;
            await this.conversationService.updateMessageBody(loggedMessageId, `🎤 ${transcript}`);
            return transcript;
        }
        catch (err) {
            this.logger.error(`Audio resolve failed: ${err}`);
            return null;
        }
    }
    humanHelpHint() {
        return 'Si prefieres, escribe *asesor* o *humano* y una persona te atiende por aquí 😊';
    }
    resolveImageOrderText(analysis, caption, products) {
        const blobs = [analysis.textForBot, analysis.visibleText, caption].filter((s) => !!s?.trim());
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
    async resolveImageMessage(msg, loggedMessageId, conv, cfg) {
        try {
            const { buffer, mimeType } = await this.metaService.downloadMedia(msg.mediaId);
            const products = await this.catalogService.getMenuProducts();
            const menuSummary = await this.catalogService.getMenuDetailedText();
            const captionRaw = (msg.text || '').trim();
            const caption = captionRaw && !/^🖼️/.test(captionRaw) && captionRaw !== 'Imagen'
                ? captionRaw
                : undefined;
            let analysis = await this.aiService.analyzeOrderImage({
                buffer,
                mimeType: msg.mimeType || mimeType,
                caption,
                menuSummary,
            });
            if (analysis.kind === 'payment_proof') {
                await this.conversationService.updateMessageBody(loggedMessageId, `🧾 Comprobante de pago${caption ? `: ${caption}` : ''}`);
                await this.conversationService.setHumanTakeover(conv.id, true);
                await this.reply(conv, msg.waId, analysis.reply ||
                    'Recibí tu comprobante ✅ Un asesor lo revisa en un momento.\n\n' + this.humanHelpHint());
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
                await this.conversationService.updateMessageBody(loggedMessageId, `🖼️ ${orderText}`);
                return { done: false, text: orderText };
            }
            await this.conversationService.updateMessageBody(loggedMessageId, captionRaw || '🖼️ Imagen');
            await this.reply(conv, msg.waId, analysis.reply || this.aiService.imageFallbackReply());
            return { done: true };
        }
        catch (err) {
            this.logger.error(`Image resolve failed: ${err}`);
            await this.reply(conv, msg.waId, 'No pude abrir la imagen 😅 ¿Me escribes el pedido (código o nombre)?\n\n' + this.humanHelpHint());
            return { done: true };
        }
    }
    isRestartIntent(lower) {
        return /^(reiniciar|empezar\s+de\s+nuevo|borrar\s+carrito)$/i.test(lower.trim());
    }
    isCancelIntent(text) {
        const t = text.trim().toLowerCase();
        if (/\bno\s+(quiero\s+)?(cancelar|anular)\b/i.test(t))
            return false;
        if (/^(cancelar|cancela|cancelo|anular|anula)$/i.test(t))
            return true;
        return /\b(quiero\s+cancelar|cancelar\s+(el\s+)?pedido|cancela(r|me)?(\s+el)?\s*pedido|anular\s+(el\s+)?pedido|cancelen\s+(el\s+)?pedido)\b/i.test(t);
    }
    formatOrderStatusLabel(status) {
        const map = {
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
    async handleCancelRequest(conv, waId, cfg) {
        const todayOrders = await this.ordersService.findTodayOrdersByPhone(conv.phoneE164);
        const active = todayOrders.find((o) => o.orderStatus !== 'canceled');
        if (active) {
            const num = String(active.dailyOrderNumber).padStart(2, '0');
            const statusLabel = this.formatOrderStatusLabel(active.orderStatus);
            await this.reply(conv, waId, `Ya tienes un pedido de hoy: *#${num}*.\n` +
                `Estado actual: *${statusLabel}*.\n\n` +
                `Por este chat no puedo cancelártelo. Si necesitas ayuda, escribe *humano* y el equipo te atiende.` +
                (cfg.cancelPolicyNote ? `\n\n_${cfg.cancelPolicyNote}_` : ''));
            return;
        }
        await this.conversationService.resetOrderSession(conv, 'building_cart', {
            ignorePriorHistory: true,
        });
        await this.reply(conv, waId, 'Listo, *quedó cancelado* ✅ (todavía no se había registrado ninguna orden).\n¿Armamos otro?');
    }
    isConfirmKeyword(text) {
        return /^(confirmar|confirmo|listo pedido|finalizar)$/i.test(text.trim()) ||
            /\b(confirmar|confirmo|listo pedido|finalizar)\b/i.test(text.trim());
    }
    isGreetingKeyword(text) {
        const t = text.trim().toLowerCase();
        return /^(hola|buenas|buen[oa]s?\s*(d[ií]as|tardes|noches)?|hey|hi|menu|menú|ver menu|ver menú)[\s!.?]*$/i.test(t);
    }
    isVagueOrderIntent(text) {
        const t = text
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
        if (!t || t.length < 5)
            return false;
        if (/\b(codigo|código|code)\s*\d+/i.test(t) || /#\s*\d+/.test(t))
            return false;
        if (/^\d{1,4}$/.test(t.trim()))
            return false;
        const wantsOrder = /\b(quiero|gustaria|deseo|necesito|vengo\s+a|vine\s+a|quisiera)\b.{0,50}\b(hacer\s+)?(un\s+)?(pedido|orden)\b/i.test(t) ||
            /\b(hacer|realizar|armar|tomar)\s+(un\s+)?(pedido|orden)\b/i.test(t) ||
            /\b(quiero|voy\s+a|me\s+gustaria|quisiera)\s+(pedir|ordenar)\b/i.test(t) ||
            /\b(para\s+hacer\s+(un\s+)?pedido|a\s+pedir)\b/i.test(t) ||
            /^(pedir|ordenar)(\s+por\s+favor)?[\s!.?]*$/i.test(t) ||
            /\bhola\b.{0,40}\b(pedido|pedir|ordenar)\b/i.test(t);
        if (!wantsOrder)
            return false;
        if (/\b(pollo|medio|cuarto|entero|porcion|porciones|sopa|bebida|gaseosa|limonada|arepa|papa|maduro|chorizo|alas|pechuga|combo|menudencia|arroz|bandeja|chino|paisa)\b/i.test(t)) {
            return false;
        }
        return true;
    }
    buildAskWhatToOrderMessage(cfg) {
        const menuUrl = (cfg.menuUrl || '').trim();
        const linkLine = menuUrl
            ? `\n\nSi quieres mirar la carta: ${menuUrl}`
            : `\n\nTambién puedes escribir *menú* para el link.`;
        return (`¡Dale! ¿Qué se te antoja?\n\n` +
            `Pídeme por *nombre* o *código* del producto (ej. "medio pollo" o "28").` +
            linkLine);
    }
    isMenuLinkIntent(text) {
        const t = text
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
        if (!t)
            return false;
        if (/\b(link|enlace|url|pagina)\b.{0,40}\b(menu|carta)\b/i.test(t) ||
            /\b(menu|carta)\b.{0,40}\b(link|enlace|url|pagina)\b/i.test(t)) {
            return true;
        }
        if (/\b(pasame|pasa|dame|enviame|envia|mandame|manda|comparte|quiero|necesito|mostrame|muestra)\b.{0,40}\b(el\s+)?(menu|carta)\b/i.test(t)) {
            return true;
        }
        if (/\b(pasame|dame|enviame|mandame|comparte)\b.{0,20}\b(link|enlace|url)\b/i.test(t)) {
            return true;
        }
        if (/^(ver\s+)?(el\s+)?(menu|carta)(\s+completo)?[\s!.?]*$/i.test(t))
            return true;
        if (/^(link|enlace)\s+(del?\s+)?(menu|carta)[\s!.?]*$/i.test(t))
            return true;
        return false;
    }
    isPickupIntent(text) {
        const t = text.trim().toLowerCase();
        if (t.length < 4)
            return false;
        if (/\b(codigo|código|code)\s*\d+/i.test(t))
            return false;
        return (/\b(para\s+llevar|pickup|recogida|pasar[eé]\s+a\s+recoger|lo\s+recojo|voy\s+por\s+(é|e)l|paso\s+yo|sin\s+domicilio|no\s+(quiero\s+)?domicilio)\b/i.test(t) ||
            /\b(paso|pasar[eé]|pasar|voy|recojo|recoger|llegar[eé]|llego)\b.{0,50}\b(minutos?|mins?|horas?|hrs?|rato|momento)\b/i.test(t) ||
            /\b(en|para)\s+\d{1,3}\s*(-|a|o|\/)?\s*\d{0,3}\s*(minutos?|mins?)\b.{0,30}\b(paso|recojo|voy|pasar)/i.test(t) ||
            /\bpaso\s+en\s+\d/i.test(t) ||
            /\brecojo\s+(en|por|a)\b/i.test(t) ||
            /\b(paso|pasar[eé])\s+por\s+(el\s+)?(local|restaurante|all[ií]|allá)\b/i.test(t));
    }
    isDeliveryIntent(text) {
        const t = text.trim().toLowerCase();
        return (/\b(domicilio|delivery|env[ií]en(me|lo)?|me\s+lo\s+(llevan|env[ií]an)|para\s+la\s+casa|a\s+domicilio)\b/i.test(t) && !this.isPickupIntent(t));
    }
    applyPickupIntent(session, text) {
        const eta = this.extractEtaPhrase(text);
        const address = eta ? `Recoge en el local (${eta})` : 'Recoge en el local';
        return {
            ...session,
            orderType: 'pickup',
            address,
        };
    }
    extractEtaPhrase(text) {
        const m = text.match(/\b(?:en|para|dentro\s+de)\s+(\d{1,3}\s*(?:-|a|o|\/)?\s*\d{0,3}\s*(?:minutos?|mins?|horas?|hrs?))\b/i) ||
            text.match(/\b(\d{1,3}\s*(?:-|a|o|\/)\s*\d{1,3}\s*(?:minutos?|mins?))\b/i) ||
            text.match(/\b(\d{1,3}\s*(?:minutos?|mins?))\b/i);
        if (!m?.[1])
            return null;
        const cleaned = m[1].replace(/\s+/g, ' ').trim().toLowerCase();
        return `paso en ~${cleaned}`;
    }
    extractDeliveryTail(text) {
        const m = text.match(/\bpara\b\s+(.+)$/is);
        if (!m?.[1])
            return null;
        const tail = m[1].trim();
        if (/\b(domicilio|la casa|mi casa|mi direccion|mi dirección)\b/i.test(tail))
            return tail;
        if (this.looksLikeAddress(tail))
            return tail;
        if (tail.length >= 10 && /\d/.test(tail) && !/\b(minutos?|mins?|horas?)\b/i.test(tail)) {
            return tail;
        }
        return null;
    }
    mergeNameScores(primary, secondary) {
        const byId = new Map();
        for (const row of [...primary, ...secondary]) {
            const prev = byId.get(row.p.id);
            if (!prev || row.score > prev.score)
                byId.set(row.p.id, row);
        }
        return [...byId.values()].sort((a, b) => b.score - a.score || b.p.name.length - a.p.name.length);
    }
    looksLikeAddress(text) {
        const t = text.trim().toLowerCase();
        if (t.length < 10)
            return false;
        if (this.isConfirmKeyword(t) || this.isGreetingKeyword(t))
            return false;
        if (this.isPickupIntent(t))
            return false;
        if (/^(contraentrega|efectivo|mercado\s*pago|humano)$/i.test(t))
            return false;
        if (/^📍/.test(text.trim()) || /\b-?\d{1,2}\.\d+\s*,\s*-?\d{1,3}\.\d+\b/.test(t))
            return true;
        if (/\b(calle|carrera|cra|cll|av\.?|avenida|diag|diagonal|transversal|barrio|conjunto|apto|apartamento|torre|casa|mz|manzana|#)\b/i.test(t)) {
            return true;
        }
        return t.length >= 15 && /\d/.test(t) && !/\b(minutos?|mins?|horas?)\b/i.test(t);
    }
    formatLocationAddress(msg) {
        const parts = [];
        if (msg.locationName)
            parts.push(msg.locationName);
        if (msg.locationAddress)
            parts.push(msg.locationAddress);
        if (msg.latitude != null && msg.longitude != null) {
            parts.push(`📍 ${msg.latitude}, ${msg.longitude}`);
            parts.push(`https://maps.google.com/?q=${msg.latitude},${msg.longitude}`);
        }
        const out = parts.filter(Boolean).join(' — ');
        return out.trim() || null;
    }
    buildAskNotesMessage(cfg, session) {
        const hint = (cfg.localContext?.cashChangeNote || '').trim();
        const existing = session?.customerNotes?.trim();
        let msg = existing
            ? `Ya anoté: _${existing}_\n\n¿Algo *más* para cocina o domicilio (o cambio si pagas en efectivo)?`
            : '¿Alguna *nota* para el pedido o *cambio* (con cuánto pagas)?';
        msg +=
            '\nEj: _platos y cubiertos_ / _sin cebolla_ / _no quiero ají_ / _timbre 302_ / _cambio de 50 mil_.\n' +
                'Si no aplica, escribe *ninguno*.';
        if (hint)
            msg += `\n\n_${hint}_`;
        return msg;
    }
    looksLikeStandaloneOrderNote(text) {
        const t = text.trim();
        const lower = t.toLowerCase();
        if (t.length < 4 || t.length > 220)
            return false;
        if (/\b(quiero|dame|ponme|agrega|agregar|pedir|ordenar|confirmar|men[uú]|c[oó]digo)\b/.test(lower)) {
            return false;
        }
        const patterns = [
            /^(sin|no\s+quiero)\s+/i,
            /\b(platos?\s*y\s*cubiertos?|solo\s*cubiertos?|con\s*cubiertos?)\b/i,
            /\b(timbre|apto|apartamento|torre|piso|intercomunicador|porter[ií]a|rejas?)\b/i,
            /\b(cambio\s+de|billete|paga\s+con)\b/i,
            /\bsin\s+(cebolla|aj[ií]|sal|picante|huevo|queso|tomate)\b/i,
            /^(nota|notas?)[:\s]/i,
        ];
        return patterns.some((p) => p.test(t));
    }
    appendCustomerNote(session, note) {
        const trimmed = note.trim().slice(0, 400);
        if (!trimmed)
            return session;
        const existing = session.customerNotes?.trim();
        const combined = existing ? `${existing}; ${trimmed}`.slice(0, 400) : trimmed;
        return { ...session, customerNotes: combined };
    }
    applyNotesFromText(session, text) {
        const t = text.trim();
        const lower = t.toLowerCase();
        const next = { ...session, notesCollected: true };
        if (/^(ninguno|ninguna|no|nada|sin notas?|n\/a|na)$/i.test(lower)) {
            return next;
        }
        const changeMatch = t.match(/(?:cambio|billete|paga(?:s|r)?(?:\s+con)?)\s*(?:de\s*)?\$?\s*([\d.,]+(?:\s*(?:mil|k))?)/i);
        if (changeMatch?.[1]) {
            next.cashChangeFor = changeMatch[0].replace(/\s+/g, ' ').trim().slice(0, 120);
        }
        else if (/^\d[\d.,\s]*(mil|k)?$/i.test(t) && (session.paymentMethod === 'cash' || session.paymentMethod === 'contraentrega')) {
            next.cashChangeFor = `cambio de ${t}`;
        }
        const notesOnly = t
            .replace(/(?:cambio|billete|paga(?:s|r)?(?:\s+con)?)\s*(?:de\s*)?\$?\s*[\d.,]+(?:\s*(?:mil|k))?/gi, '')
            .replace(/^[,.\s\-–—]+|[,.\s\-–—]+$/g, '')
            .trim();
        if (notesOnly && !/^(ninguno|ninguna|no|nada)$/i.test(notesOnly)) {
            next.customerNotes = notesOnly.slice(0, 400);
        }
        else if (!next.cashChangeFor) {
            next.customerNotes = t.slice(0, 400);
        }
        return next;
    }
    buildOrderExtras(session) {
        const extras = [];
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
    looksLikePayment(text, methods) {
        return !!(0, whatsapp_payment_methods_1.findPaymentMethodByText)(text, methods);
    }
    resolvePaymentChoice(text, cfg) {
        const enabled = (0, whatsapp_payment_methods_1.getEnabledPaymentMethods)(cfg.paymentMethods || []);
        const trimmed = text.trim();
        if (/^[1-9]\d{0,1}$/.test(trimmed)) {
            const n = parseInt(trimmed, 10);
            if (n >= 1 && n <= enabled.length)
                return enabled[n - 1];
        }
        return (0, whatsapp_payment_methods_1.findPaymentMethodByText)(text, cfg.paymentMethods || []);
    }
    buildPaymentConfirmReply(method, cfg) {
        const tpl = (method.confirmReply || '').trim();
        if (!tpl)
            return null;
        return (0, whatsapp_payment_methods_1.applyPaymentReplyTemplate)(tpl, {
            label: method.label,
            brand: cfg.brandName || '',
            transferInfo: (cfg.localContext?.transferInfoNote || '').trim() ||
                'Te pasamos los datos de cuenta en el local / por aquí.',
            paymentInstructions: (cfg.paymentInstructions || '').trim(),
        });
    }
    buildWelcomeMessage(cfg) {
        const w = (cfg.welcomeMessage || '').trim();
        if (!w) {
            return (`¡Hola! 👋 Bienvenido a *${cfg.brandName}*.\n\n` +
                `Menú: ${cfg.menuUrl}\n\nDime qué se te antoja.`);
        }
        if (w.includes(cfg.menuUrl) || /\bmenu\b|\bmenú\b/i.test(w))
            return w;
        return `${w}\n\nMenú: ${cfg.menuUrl}`;
    }
    formatOrderSuccessMessage(conv, session, order, deliveryFee, thanksMessage, paymentMethods = []) {
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
        return (`✅ *¡Listo! Tu pedido quedó registrado*\n\n` +
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
            `💳 ${(0, whatsapp_payment_methods_1.paymentMethodLabel)(session.paymentMethod, paymentMethods)}\n\n` +
            (thanksMessage?.trim() || 'Gracias por pedirnos, te esperamos 🍗'));
    }
    isMultiOrderAffirmative(text) {
        const t = text.trim().toLowerCase();
        return /^(si|sí|sep|ok|okay|dale|listo|correcto|exacto|as[ií]|confirmo|agrega|agregalo|agregalos|va|perfecto|bueno)$/.test(t);
    }
    async handleProductWithVariants(conv, waId, session, product, text, cfg) {
        if (!product.hasAttributes || !product.attributes?.length)
            return false;
        const step = this.catalogService.resolveNextAttributeChoice(product, text, []);
        if (step.status === 'complete') {
            const added = this.tryAddProductToCart(session, product, 1, cfg, undefined, step.attributes);
            if (added.blocked) {
                await this.conversationService.saveSession(conv, session);
                await this.handleCartLimitBlocked(conv, waId, added.blocked, cfg);
                return true;
            }
            session = { ...added.session, pendingAttribute: undefined };
            await this.conversationService.saveSession(conv, session, 'building_cart');
            const chosen = step.attributes.map((a) => a.attributeValue).join(', ');
            await this.reply(conv, waId, `Te agregué *${product.name}* (${chosen}) — $${Math.round(product.price).toLocaleString('es-CO')}.\n\n` +
                `${this.formatCartOnly(session, cfg.defaultDeliveryFee)}\n\n` +
                `¿Algo más? Cuando quieras escribe *confirmar*.`);
            return true;
        }
        const mode = this.catalogService.isGenericProductInquiry(text) ||
            this.catalogService.shouldShowVariantsOverview(text, product)
            ? 'info'
            : 'order';
        session = {
            ...session,
            pendingAttribute: this.toPendingAttribute(product),
            pendingMatch: undefined,
        };
        await this.conversationService.saveSession(conv, session, 'building_cart');
        await this.reply(conv, waId, this.catalogService.formatProductVariantsOverview(product, mode));
        return true;
    }
    async tryHandleProductInfoInquiry(conv, waId, text, products, cfg) {
        if (!this.catalogService.isGenericProductInquiry(text))
            return false;
        const stripped = this.catalogService.stripPriceInquiryNoise(text);
        const query = this.catalogService.extractProductSearchQuery(stripped || text);
        if (this.catalogService.isShortGenericFoodQuery(query)) {
            const hit = this.catalogService.findCategoryBrowseHit(query, products, cfg.menuConceptGroups);
            if (hit?.products.length) {
                const body = hit.products
                    .slice(0, 10)
                    .map((p, i) => this.catalogService.formatProductListItem(p, i + 1))
                    .join('\n\n');
                await this.reply(conv, waId, `Sobre *${hit.categoryName}*, tenemos:\n\n${body}\n\n` +
                    `¿Cuál te interesa? Dime el *número* o el *nombre*.`);
                return true;
            }
        }
        const embedded = this.catalogService.findProductEmbeddedInMessage(query, products) ||
            this.catalogService.findProductEmbeddedInMessage(text, products);
        if (embedded) {
            await this.reply(conv, waId, this.catalogService.formatProductPriceReply(embedded));
            return true;
        }
        const scored = this.catalogService.searchByNameScored(query, products, 6);
        if (!scored.length) {
            await this.reply(conv, waId, '¿De qué plato quieres saber? Dime el nombre (ej. *pollo frito*, *sopa de mondongo*) y te cuento.');
            return true;
        }
        if (scored.length === 1 || this.catalogService.isStrongProductMatch(scored)) {
            await this.reply(conv, waId, this.catalogService.formatProductPriceReply(scored[0].p));
            return true;
        }
        await this.reply(conv, waId, this.catalogService.formatPriceInquiryList(scored.slice(0, 5).map((x) => x.p)));
        return true;
    }
    toPendingMultiProduct(p) {
        return {
            productId: p.id,
            name: p.name,
            code: p.code,
            price: p.price,
        };
    }
    formatMultiOrderProposal(multi) {
        const lines = ['Entendí *varios platos* en tu mensaje:\n'];
        let idx = 1;
        for (const c of multi.confident) {
            lines.push(`${idx}. ✅ *${c.product.name}* (cód. ${c.product.code}) — $${Math.round(c.product.price).toLocaleString('es-CO')}`);
            idx++;
        }
        for (const group of multi.ambiguous) {
            lines.push(`\n❓ Sobre *${group.segment}*, ¿cuál te gusta?`);
            group.candidates.forEach((c, i) => {
                lines.push(`   ${i + 1}) *${c.name}* (cód. ${c.code}) — $${Math.round(c.price).toLocaleString('es-CO')}`);
            });
        }
        for (const item of multi.needsAttributes) {
            lines.push(`\n🔸 *${item.product.name}* (cód. ${item.product.code}) — hay que elegir opciones después.`);
        }
        for (const miss of multi.unresolved) {
            lines.push(`\n⚠️ No encontré en el menú: _${miss}_`);
        }
        lines.push('\nSi está bien lo que marqué ✅, escribe *sí*.', 'Si algo no cuadra, dime el plato correcto o el *número* de la opción dudosa.');
        return lines.join('\n');
    }
    sessionFromMultiResolve(multi) {
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
    async addPendingMultiConfidentToCart(conv, waId, session, cfg, products) {
        const pending = session.pendingMultiOrder;
        if (!pending?.confident.length) {
            return { session, addedNames: [] };
        }
        let next = { ...session };
        const addedNames = [];
        for (const item of pending.confident) {
            const product = products.find((p) => p.id === item.productId);
            if (!product)
                continue;
            const attempt = this.tryAddProductToCart(next, product, 1, cfg);
            if (attempt.blocked) {
                return { session: next, addedNames, blocked: attempt.blocked };
            }
            next = attempt.session;
            addedNames.push(product.name);
        }
        return { session: next, addedNames };
    }
    async tryHandleMultiProductOrder(conv, waId, session, multi, cfg, text) {
        const deliveryTail = this.extractDeliveryTail(text);
        if (deliveryTail) {
            session = { ...session, orderType: 'delivery', address: deliveryTail };
        }
        const needsConfirm = multi.ambiguous.length > 0 ||
            multi.unresolved.length > 0 ||
            multi.needsAttributes.length > 0;
        if (!needsConfirm && multi.confident.length >= 2) {
            let next = session;
            const added = [];
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
            const addrNote = deliveryTail ? `\n\nDomicilio anotado: _${deliveryTail}_` : '';
            await this.reply(conv, waId, `Te agregué:\n${added.map((n) => `• *${n}*`).join('\n')}\n\n` +
                `${this.formatCartOnly(next, cfg.defaultDeliveryFee)}${addrNote}\n\n` +
                `¿Algo más? Cuando quieras escribe *confirmar*.`);
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
    async tryResolvePendingMultiOrder(conv, waId, session, text, products, cfg) {
        const pending = session.pendingMultiOrder;
        if (!pending)
            return false;
        const lower = text.trim().toLowerCase();
        const numPick = /^[1-9]\d*$/.test(lower) ? parseInt(lower, 10) : null;
        if (numPick && pending.ambiguous.length) {
            const group = pending.ambiguous[0];
            if (numPick <= group.candidates.length) {
                const chosen = group.candidates[numPick - 1];
                const full = products.find((p) => p.id === chosen.id) || chosen;
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
                    session.pendingMultiOrder.needsAttributes = [
                        ...session.pendingMultiOrder.needsAttributes,
                        { segment: group.segment, ...this.toPendingMultiProduct(full) },
                    ];
                    session.pendingMultiOrder.confident = session.pendingMultiOrder.confident.filter((c) => c.productId !== full.id);
                }
                await this.conversationService.saveSession(conv, session);
                if (session.pendingMultiOrder.ambiguous.length ||
                    session.pendingMultiOrder.unresolved.length ||
                    session.pendingMultiOrder.needsAttributes.length) {
                    await this.reply(conv, waId, `Listo, *${full.name}* ✅\n\n` +
                        this.formatMultiOrderProposal({
                            segments: [],
                            confident: session.pendingMultiOrder.confident.map((c) => ({
                                segment: c.segment,
                                product: products.find((p) => p.id === c.productId),
                                score: 100,
                            })),
                            ambiguous: session.pendingMultiOrder.ambiguous.map((a) => ({
                                segment: a.segment,
                                candidates: a.candidates,
                            })),
                            unresolved: session.pendingMultiOrder.unresolved,
                            needsAttributes: session.pendingMultiOrder.needsAttributes.map((c) => ({
                                segment: c.segment,
                                product: products.find((p) => p.id === c.productId),
                                score: 100,
                            })),
                        }));
                    return true;
                }
                pending.confident = session.pendingMultiOrder.confident;
                pending.ambiguous = [];
                pending.unresolved = session.pendingMultiOrder.unresolved;
                pending.needsAttributes = session.pendingMultiOrder.needsAttributes;
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
                pendingMultiOrder: pending.ambiguous.length || pending.unresolved.length || pending.needsAttributes.length
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
                        ? `Te agregué:\n${addResult.addedNames.map((n) => `• *${n}*`).join('\n')}\n\n`
                        : '';
                    await this.reply(conv, waId, `${prefix}Ahora elige opciones para *${product.name}*:\n\n` +
                        this.catalogService.formatProductOptionsPrompt(product, []));
                    return true;
                }
            }
            await this.conversationService.saveSession(conv, next, 'building_cart');
            let msg = addResult.addedNames.length > 0
                ? `Te agregué:\n${addResult.addedNames.map((n) => `• *${n}*`).join('\n')}\n\n`
                : '';
            msg += this.formatCartOnly(next, cfg.defaultDeliveryFee);
            if (next.pendingMultiOrder?.ambiguous.length || next.pendingMultiOrder?.unresolved.length) {
                msg += `\n\n${this.formatMultiOrderProposal({
                    segments: [],
                    confident: [],
                    ambiguous: next.pendingMultiOrder.ambiguous.map((a) => ({
                        segment: a.segment,
                        candidates: a.candidates,
                    })),
                    unresolved: next.pendingMultiOrder.unresolved,
                    needsAttributes: [],
                })}`;
            }
            else {
                msg += '\n\n¿Algo más? Cuando quieras escribe *confirmar*.';
            }
            await this.reply(conv, waId, msg);
            return true;
        }
        if (pending.ambiguous.length || pending.unresolved.length) {
            await this.reply(conv, waId, this.formatMultiOrderProposal({
                segments: [],
                confident: pending.confident.map((c) => ({
                    segment: c.segment,
                    product: products.find((p) => p.id === c.productId),
                    score: 100,
                })),
                ambiguous: pending.ambiguous.map((a) => ({
                    segment: a.segment,
                    candidates: a.candidates,
                })),
                unresolved: pending.unresolved,
                needsAttributes: pending.needsAttributes.map((c) => ({
                    segment: c.segment,
                    product: products.find((p) => p.id === c.productId),
                    score: 100,
                })),
            }));
            return true;
        }
        return false;
    }
    async reply(conv, waId, body) {
        await this.metaService.sendText(waId, body);
        await this.conversationService.logMessage({
            conversationId: conv.id,
            direction: 'out',
            body,
            sentBy: 'bot',
        });
        await this.conversationService.touchOutbound(conv, 'bot');
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