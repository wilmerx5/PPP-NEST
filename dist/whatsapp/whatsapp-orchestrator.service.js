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
const whatsapp_points_service_1 = require("./whatsapp-points.service");
const whatsapp_points_help_1 = require("./whatsapp-points-help");
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
    pointsHandler;
    logger = new common_1.Logger(WhatsappOrchestratorService_1.name);
    constructor(settingsService, metaService, catalogService, aiService, conversationService, businessService, ordersService, paymentsService, actionGuard, pointsHandler) {
        this.settingsService = settingsService;
        this.metaService = metaService;
        this.catalogService = catalogService;
        this.aiService = aiService;
        this.conversationService = conversationService;
        this.businessService = businessService;
        this.ordersService = ordersService;
        this.paymentsService = paymentsService;
        this.actionGuard = actionGuard;
        this.pointsHandler = pointsHandler;
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
                fulfillmentChosen: true,
                addressConfirmed: true,
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
        if (this.isClearCartIntent(text)) {
            await this.conversationService.resetOrderSession(conv, 'building_cart', {
                ignorePriorHistory: true,
            });
            await this.reply(conv, msg.waId, 'Listo, *vaciamos el carrito* ✅ ¿Qué te gustaría pedir?');
            return;
        }
        if (this.isCancelIntent(text)) {
            await this.handleCancelRequest(conv, msg.waId, cfg);
            return;
        }
        let session = this.conversationService.getSession(conv);
        const compound = this.parseCompoundOrderMessage(text);
        session = this.withDeliveryAddress(session, compound.address);
        if (compound.phone) {
            session = {
                ...session,
                contactPhone: compound.phone,
                phoneConfirmed: true,
            };
        }
        else if (compound.phoneUsesWhatsapp) {
            session = {
                ...session,
                phoneConfirmed: true,
            };
        }
        if (compound.customerName && !conv.customerName?.trim()) {
            await this.conversationService.updateCustomerName(conv, compound.customerName);
            const freshName = await this.conversationService.reloadConversation(conv.id);
            Object.assign(conv, freshName);
        }
        if (compound.productText.length >= 3) {
            text = compound.productText;
        }
        await this.conversationService.saveSession(conv, session);
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
        session = this.applyDeliveryHintFromMessage(session, text);
        if (await this.tryHandleCartModification(conv, msg.waId, session, text, products, cfg)) {
            return;
        }
        if (await this.tryHandlePointsFlow(conv, msg.waId, session, text, cfg)) {
            return;
        }
        if (await this.tryHandleComboAvailabilityQuestion(conv, msg.waId, session, text, products, cfg)) {
            return;
        }
        if (session.pendingAttribute || conv.state === 'awaiting_attribute') {
            if (await this.tryAbandonPendingSelection(conv, msg.waId, session, text, cfg)) {
                return;
            }
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
                if (this.catalogService.isVariantPreferenceIntent(text)) {
                    if (await this.tryApplyVariantPreferenceToProduct(conv, msg.waId, session, text, products, cfg, product, { fromPendingAttribute: true })) {
                        return;
                    }
                }
                const attrOpts = this.attributeFlowOpts(pa);
                const step = this.catalogService.resolveNextAttributeChoice(product, text, pa.selected || [], attrOpts);
                if (step.status === 'complete') {
                    const stillNeed = this.catalogService.getRemainingAttributes(product, step.attributes, attrOpts);
                    if (stillNeed.length) {
                        session.pendingAttribute = {
                            ...pa,
                            selected: step.attributes,
                        };
                        await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
                        await this.reply(conv, msg.waId, this.catalogService.formatProductOptionsPrompt(product, step.attributes, attrOpts));
                        return;
                    }
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
                            pendingAttribute: this.toPendingAttribute(nextProduct, {
                                sourceText: nextNeeds?.segment ? `${nextNeeds.segment} ${text}` : text,
                            }),
                        };
                        await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
                        const chosen = step.attributes.map((a) => a.attributeValue).join(', ');
                        await this.reply(conv, msg.waId, `${this.buildCartAddReply(session, cfg.defaultDeliveryFee, `${product.name} (${chosen})`, { suffix: '' })}\n\n` +
                            `Ahora elige opciones para *${nextProduct.name}*:\n\n` +
                            this.catalogService.formatProductOptionsPrompt(nextProduct, []));
                        return;
                    }
                    await this.conversationService.saveSession(conv, session, 'building_cart');
                    const chosen = step.attributes.map((a) => a.attributeValue).join(', ');
                    await this.reply(conv, msg.waId, this.buildCartAddReply(session, cfg.defaultDeliveryFee, `${product.name} (${chosen})`));
                    return;
                }
                if (step.status === 'partial') {
                    session.pendingAttribute = {
                        ...pa,
                        selected: step.attributes,
                    };
                    await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
                    await this.reply(conv, msg.waId, this.catalogService.formatProductOptionsPrompt(product, step.attributes, attrOpts));
                    return;
                }
                if (await this.tryAddProductDuringPendingAttribute(conv, msg.waId, session, text, products, cfg, product)) {
                    return;
                }
                if (this.looksLikeSideQuestion(text)) {
                    await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
                    if (this.isProductCompositionQuestion(text)) {
                        await this.reply(conv, msg.waId, this.buildProductCompositionReply(text, product, cfg));
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
                await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
                await this.reply(conv, msg.waId, `No te capté esa opción. Respóndeme con el *nombre* (medio, cuarto…) o el *número*.\n\n` +
                    this.catalogService.formatProductOptionsPrompt(product, pa.selected || []));
                return;
            }
            session.pendingAttribute = undefined;
            await this.conversationService.saveSession(conv, session, 'building_cart');
            await this.reply(conv, msg.waId, 'Se me fue la selección pendiente 🙏 Dime otra vez el *nombre* o *código* del producto y te muestro las opciones.');
            return;
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
                this.isDeliveryIntent(text) ||
                this.looksLikePhoneNumber(text)) {
                await this.reply(conv, msg.waId, 'Primero necesito tu *nombre completo* (ej. Juan Pérez).\n' +
                    'Después te pregunto domicilio/recojo, dirección y teléfono.');
                return;
            }
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
        if (conv.state === 'awaiting_name') {
            await this.reply(conv, msg.waId, this.buildAskNameMessage(session, cfg.defaultDeliveryFee));
            return;
        }
        if (conv.state === 'awaiting_fulfillment' && !isConfirm && !isGreeting) {
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
            if (this.isDeliveryIntent(text) || this.looksLikeAddress(text) || text.length >= 6) {
                session = {
                    ...session,
                    orderType: 'delivery',
                    fulfillmentChosen: true,
                };
                const addrHint = this.extractDeliveryTail(text) || (this.isPlausibleDeliveryAddress(text) ? text.trim() : null);
                if (addrHint && this.isPlausibleDeliveryAddress(addrHint) && !this.isDeliveryIntent(text)) {
                    session = this.withDeliveryAddress(session, addrHint);
                }
                else {
                    session.address = undefined;
                    session.addressConfirmed = false;
                }
                if (session.addressConfirmed && session.address?.trim()) {
                    await this.conversationService.saveSession(conv, session, 'building_cart');
                    await this.tryConfirmOrder(conv, msg.waId, session, {
                        preface: `Perfecto, domicilio a *${session.address.trim()}* ✅`,
                    });
                    return;
                }
                await this.conversationService.saveSession(conv, session, 'awaiting_address');
                await this.reply(conv, msg.waId, this.buildAskAddressMessage(session, cfg.defaultDeliveryFee));
                return;
            }
        }
        if (conv.state === 'awaiting_fulfillment') {
            await this.reply(conv, msg.waId, this.buildAskFulfillmentMessage(session, cfg.defaultDeliveryFee));
            return;
        }
        if (conv.state === 'awaiting_address' && !isConfirm && !isGreeting) {
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
            if (session.address?.trim() &&
                !session.addressConfirmed &&
                /^(si|sí|sep|ok|okay|dale|listo|correcto|exacto|esa|esa misma|confirmo)[\s!.?]*$/i.test(text.trim())) {
                session = {
                    ...session,
                    orderType: 'delivery',
                    fulfillmentChosen: true,
                    addressConfirmed: true,
                };
                await this.conversationService.saveSession(conv, session, 'building_cart');
                const fresh = await this.conversationService.reloadConversation(conv.id);
                Object.assign(conv, fresh);
                session = this.conversationService.getSession(conv);
                await this.tryConfirmOrder(conv, msg.waId, session, {
                    preface: `Dirección lista ✅ _${session.address}_`,
                });
                return;
            }
            if (text.length >= 6) {
                const addrHint = this.extractDeliveryTail(text) || text.trim();
                if (!this.isPlausibleDeliveryAddress(addrHint)) {
                    await this.reply(conv, msg.waId, this.buildAskAddressMessage(session, cfg.defaultDeliveryFee, true));
                    return;
                }
                session = this.withDeliveryAddress({ ...session, fulfillmentChosen: true }, addrHint);
                session = { ...session, addressConfirmed: true };
                await this.conversationService.saveSession(conv, session, 'building_cart');
                const fresh = await this.conversationService.reloadConversation(conv.id);
                Object.assign(conv, fresh);
                session = this.conversationService.getSession(conv);
                await this.tryConfirmOrder(conv, msg.waId, session, {
                    preface: `Dirección lista ✅ _${addrHint}_`,
                });
                return;
            }
        }
        if (conv.state === 'awaiting_address') {
            await this.reply(conv, msg.waId, this.buildAskAddressMessage(session, cfg.defaultDeliveryFee));
            return;
        }
        if (conv.state === 'awaiting_phone' && !isConfirm && !isGreeting) {
            const phoneHandled = await this.tryResolvePhoneConfirmation(conv, msg.waId, session, text, cfg);
            if (phoneHandled)
                return;
        }
        if (conv.state === 'awaiting_phone') {
            await this.reply(conv, msg.waId, this.buildAskPhoneMessage(conv, session, cfg.defaultDeliveryFee));
            return;
        }
        if (conv.state === 'awaiting_payment' && !isConfirm && !isGreeting) {
            const payPick = this.resolvePaymentChoice(text, cfg);
            if (payPick) {
                session.paymentMethod = payPick.id;
                session.notesCollected = true;
                await this.conversationService.saveSession(conv, session, 'confirming');
                const confirmExtra = this.buildPaymentConfirmReply(payPick, cfg);
                session = this.conversationService.getSession(conv);
                await this.tryConfirmOrder(conv, msg.waId, session, {
                    preface: confirmExtra || undefined,
                    skipFinalConfirm: true,
                });
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
        if (this.catalogService.isCourtesyOnlyMessage(text)) {
            const courtesyConfirm = session.cart.length > 0 &&
                /^(ok|okay|oki|dale|listo|perfecto|va|vale)[\s!.?]*$/i.test(text.trim());
            if (courtesyConfirm) {
                const fresh = await this.conversationService.reloadConversation(conv.id);
                Object.assign(conv, fresh);
                session = this.conversationService.getSession(conv);
                await this.tryConfirmOrder(conv, msg.waId, session);
                return;
            }
            await this.reply(conv, msg.waId, this.catalogService.formatCourtesyReply(cfg.brandName || cfg.localContext?.restaurantName || undefined));
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
        if (await this.tryHandleProductCompositionQuestion(conv, msg.waId, text, products, cfg, session)) {
            return;
        }
        if (this.catalogService.isOffTopicChitchat(text)) {
            await this.reply(conv, msg.waId, this.catalogService.formatOffTopicRedirect(cfg.brandName || cfg.localContext?.restaurantName || undefined));
            return;
        }
        const browseAsk = this.catalogService.isMenuExploreIntent(text, products) ||
            this.catalogService.isCategoryBrowseQuestion(text);
        if (browseAsk && !session.pendingAttribute) {
            session = {
                ...session,
                pendingMatch: undefined,
                pendingMultiOrder: undefined,
            };
            const hit = this.catalogService.findCategoryBrowseHit(text, products, cfg.menuConceptGroups);
            const specificCue = /\b(carne|carnes|pollo|pollos|sopa|sopas|bebida|bebidas|gaseosa|arroz|bandeja|pescado|mojarra|frito|broaster|ejecutivo)\b/i.test(text);
            if (hit?.products.length && (specificCue || this.catalogService.isCategoryBrowseQuestion(text))) {
                session = {
                    ...session,
                    pendingCategoryBrowse: undefined,
                    pendingMatch: {
                        query: hit.categoryName,
                        candidates: hit.products,
                    },
                };
                await this.conversationService.saveSession(conv, session, 'building_cart');
                await this.reply(conv, msg.waId, this.catalogService.formatCategoryList(hit.categoryName, hit.products));
                return;
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
                await this.reply(conv, msg.waId, overview.text);
                return;
            }
        }
        const pendingPickHandled = await this.tryResolvePendingMatchPick(conv, msg.waId, session, text, products, cfg);
        if (pendingPickHandled)
            return;
        const abandoned = this.tryAbandonStalePendingState(session, text, products);
        if (abandoned) {
            session = abandoned;
            await this.conversationService.saveSession(conv, session);
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
        {
            const productQueryEarly = this.catalogService.extractProductSearchQuery(text);
            const qCheck = productQueryEarly || text;
            const orderNoise = new Set([
                'quiero', 'dame', 'ponme', 'pedir', 'ordenar', 'agrega', 'necesito', 'una', 'uno',
            ]);
            const significant = qCheck
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .split(/\s+/)
                .filter((t) => t.length >= 3 && !orderNoise.has(t));
            const looksSpecificDish = significant.length >= 2;
            const earlyScored = this.catalogService.searchByNameScored(qCheck, products, 5);
            const hasConcreteProduct = looksSpecificDish &&
                (this.catalogService.isStrongProductMatch(earlyScored) ||
                    !!this.catalogService.findProductEmbeddedInMessage(text, products));
            if (!hasConcreteProduct) {
                const categorySwitch = await this.tryHandleCategoryBrowse(conv, msg.waId, session, products, text, cfg.menuConceptGroups);
                if (categorySwitch === null)
                    return;
                session = categorySwitch;
            }
        }
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
            session = {
                ...session,
                orderType: 'delivery',
                fulfillmentChosen: true,
                addressConfirmed: false,
            };
            if (/^recoge en el local/i.test(session.address || '')) {
                session.address = undefined;
            }
            await this.conversationService.saveSession(conv, session);
            if (session.cart.length > 0 && !session.address?.trim()) {
                await this.conversationService.saveSession(conv, session, 'awaiting_address');
                await this.reply(conv, msg.waId, this.buildAskAddressMessage(session, cfg.defaultDeliveryFee));
                return;
            }
            if (session.cart.length > 0 && session.address?.trim() && !session.addressConfirmed) {
                await this.conversationService.saveSession(conv, session, 'awaiting_address');
                await this.reply(conv, msg.waId, this.buildAskAddressMessage(session, cfg.defaultDeliveryFee));
                return;
            }
            await this.reply(conv, msg.waId, 'Dale, lo dejamos en *domicilio*.');
            return;
        }
        const code = this.catalogService.extractCodeFromMessage(text);
        const listPick = this.catalogService.extractListPickNumber(text);
        const bareOptionNumber = listPick != null;
        const hasPendingList = !!session.pendingMatch?.candidates?.length ||
            !!session.pendingCategoryBrowse?.categories?.length ||
            !!session.pendingAttribute ||
            conv.state === 'awaiting_attribute' ||
            !!session.pendingCartRemoval?.options?.length;
        const pendingListIndex = bareOptionNumber &&
            !!session.pendingMatch?.candidates?.length &&
            listPick != null &&
            listPick >= 1 &&
            listPick <= session.pendingMatch.candidates.length;
        const qtyInText = this.catalogService.extractQuantityFromMessage(text);
        const qtyLooksLikeOrder = qtyInText >= 2 &&
            /\b(pollos?|sopas?|bandejas?|platos?|unidades?|combos?|gaseosas?|broaster|fritos?)\b/i.test(text);
        if (code != null && !pendingListIndex && !hasPendingList && !qtyLooksLikeOrder) {
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
                await this.reply(conv, msg.waId, this.buildCartAddReply(session, cfg.defaultDeliveryFee, found.name, {
                    extraLine: [desc || undefined, addrLine || undefined].filter(Boolean).join('') || undefined,
                }));
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
            session = this.applyInlineOrderNote(session, text);
            await this.conversationService.saveSession(conv, session);
            const ack = this.formatInlineNoteAck(session);
            await this.reply(conv, msg.waId, `${ack}\n\n${this.formatCartOnly(session, cfg.defaultDeliveryFee)}\n\n${this.formatContinueShoppingPrompt()}`);
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
        if (!session.pendingAttribute &&
            !session.pendingMultiOrder &&
            (await this.tryHandleProductInfoInquiry(conv, msg.waId, text, products, cfg))) {
            return;
        }
        if (!session.pendingMatch && !session.pendingAttribute && !session.pendingMultiOrder) {
            const multi = this.catalogService.resolveMultiProductOrder(text, products);
            if (multi) {
                const handled = await this.tryHandleMultiProductOrder(conv, msg.waId, session, multi, cfg, text, products);
                if (handled)
                    return;
            }
        }
        if (!session.pendingMatch &&
            !session.pendingAttribute &&
            !session.pendingMultiOrder &&
            (await this.tryHandleVariantPreferenceChange(conv, msg.waId, session, text, products, cfg))) {
            return;
        }
        const orderQty = this.catalogService.extractQuantityFromMessage(text);
        const embeddedProduct = this.catalogService.findProductEmbeddedInMessage(text, products);
        if (embeddedProduct &&
            !this.catalogService.isProductDescriptionInquiry(text) &&
            !this.catalogService.isCategoryBrowseQuestion(text) &&
            !this.catalogService.isMenuExploreIntent(text, products) &&
            !session.pendingMatch &&
            !session.pendingAttribute &&
            !(this.catalogService.looksLikeFoodPlusDrinkOrder(text) &&
                this.catalogService.isLikelyDrinkProduct(embeddedProduct)) &&
            !this.catalogService.looksLikeMultiItemOrderMessage(text)) {
            const deliveryTail = this.extractDeliveryTail(text);
            if (deliveryTail) {
                session = this.withDeliveryAddress(session, deliveryTail);
            }
            if (embeddedProduct.hasAttributes && embeddedProduct.attributes?.length) {
                if (await this.handleProductWithVariants(conv, msg.waId, session, embeddedProduct, text, cfg)) {
                    return;
                }
            }
            const embeddedAdd = this.tryAddProductToCart(session, embeddedProduct, orderQty, cfg);
            if (embeddedAdd.blocked) {
                await this.conversationService.saveSession(conv, session);
                await this.handleCartLimitBlocked(conv, msg.waId, embeddedAdd.blocked, cfg);
                return;
            }
            session = embeddedAdd.session;
            await this.conversationService.saveSession(conv, session, 'building_cart');
            if (await this.maybeAdvanceCheckoutAfterAdd(conv, msg.waId, session))
                return;
            const qtyNote = orderQty > 1 ? ` _(x${orderQty})_` : '';
            await this.reply(conv, msg.waId, this.buildCartAddReply(session, cfg.defaultDeliveryFee, `${embeddedProduct.name}${qtyNote}`, {
                extraLine: [
                    embeddedProduct.description ? `_${embeddedProduct.description}_` : '',
                    deliveryTail || session.address
                        ? `\nDomicilio anotado: _${deliveryTail || session.address}_`
                        : '',
                ]
                    .filter(Boolean)
                    .join('\n'),
            }));
            return;
        }
        const productQueryRaw = this.catalogService.extractProductSearchQuery(text);
        const productQuery = orderQty > 1
            ? this.catalogService.stripQuantityFromSearchQuery(productQueryRaw) || productQueryRaw
            : productQueryRaw;
        const nameScored = this.mergeNameScores(this.catalogService.searchByNameScored(productQuery, products, 8), productQuery === text
            ? []
            : this.catalogService.searchByNameScored(text, products, 8));
        const nameMatches = nameScored.map((x) => x.p);
        const strongProduct = this.catalogService.isStrongProductMatch(nameScored);
        const uniqueNameMatches = this.catalogService.dedupeProductsById(nameMatches);
        if (!session.pendingMatch &&
            (await this.tryHandleVariantFamily(conv, msg.waId, session, text, products, cfg))) {
            return;
        }
        let resolvedMatches = strongProduct && nameScored.length >= 1 && nameScored[0].score >= 80
            ? [nameScored[0].p]
            : uniqueNameMatches;
        if (orderQty >= 2 &&
            !session.pendingMatch &&
            !session.pendingAttribute &&
            !this.catalogService.isCategoryBrowseQuestion(text) &&
            !this.catalogService.isMenuExploreIntent(text, products)) {
            const qtyScored = nameScored.length > 0
                ? nameScored
                : this.catalogService.searchByNameScored(productQuery, products, 8);
            if (qtyScored.length >= 1 && qtyScored[0].score >= 12) {
                const family = this.catalogService.findProductVariantFamily(productQuery || text, products, qtyScored.map((x) => x.p));
                if (family && family.variants.length >= 2) {
                    session = {
                        ...session,
                        pendingMatch: {
                            query: text,
                            candidates: family.variants,
                            quantity: orderQty,
                        },
                    };
                    await this.conversationService.saveSession(conv, session);
                    await this.reply(conv, msg.waId, `Pediste *${orderQty}*. ¿Cuál variante?\n\n` +
                        this.catalogService.formatVariantFamilyPrompt(family));
                    return;
                }
                if (qtyScored.length === 1 || this.catalogService.isStrongProductMatch(qtyScored)) {
                    resolvedMatches = [qtyScored[0].p];
                }
                else if (qtyScored.length >= 2) {
                    session = {
                        ...session,
                        pendingMatch: {
                            query: text,
                            candidates: qtyScored.slice(0, 6).map((x) => x.p),
                            quantity: orderQty,
                        },
                    };
                    await this.conversationService.saveSession(conv, session);
                    await this.reply(conv, msg.waId, `Pediste *${orderQty}*. ¿Cuál de estos?\n\n` +
                        this.catalogService.formatProductChoicePrompt(text, qtyScored.slice(0, 6).map((x) => x.p)));
                    return;
                }
            }
        }
        if (resolvedMatches.length === 1 &&
            !this.catalogService.isProductDescriptionInquiry(text) &&
            !this.catalogService.isCategoryBrowseQuestion(text) &&
            !this.catalogService.isMenuExploreIntent(text, products) &&
            !session.pendingMatch &&
            !session.pendingAttribute) {
            const one = resolvedMatches[0];
            if (this.catalogService.looksLikeFoodPlusDrinkOrder(text) &&
                this.catalogService.isLikelyDrinkProduct(one)) {
                const multiRetry = this.catalogService.resolveMultiProductOrder(text, products);
                if (multiRetry) {
                    const handledMulti = await this.tryHandleMultiProductOrder(conv, msg.waId, session, multiRetry, cfg, text, products);
                    if (handledMulti)
                        return;
                }
            }
            const deliveryTail = this.extractDeliveryTail(text);
            if (deliveryTail) {
                session = this.withDeliveryAddress(session, deliveryTail);
            }
            if (one.hasAttributes && one.attributes?.length) {
                if (await this.handleProductWithVariants(conv, msg.waId, session, one, text, cfg)) {
                    return;
                }
            }
            const added = this.tryAddProductToCart(session, one, orderQty, cfg);
            if (added.blocked) {
                await this.conversationService.saveSession(conv, session);
                await this.handleCartLimitBlocked(conv, msg.waId, added.blocked, cfg);
                return;
            }
            session = added.session;
            await this.conversationService.saveSession(conv, session, 'building_cart');
            if (await this.maybeAdvanceCheckoutAfterAdd(conv, msg.waId, session))
                return;
            const qtyNote = orderQty > 1 ? ` _(x${orderQty})_` : '';
            await this.reply(conv, msg.waId, this.buildCartAddReply(session, cfg.defaultDeliveryFee, `${one.name}${qtyNote}`, {
                extraLine: [
                    one.description ? `_${one.description}_` : '',
                    deliveryTail || session.address
                        ? `\nDomicilio anotado: _${deliveryTail || session.address}_`
                        : '',
                ]
                    .filter(Boolean)
                    .join('\n'),
            }));
            return;
        }
        if (resolvedMatches.length > 1 && !session.pendingMatch) {
            if (this.catalogService.looksLikeMultiItemOrderMessage(text)) {
                const multiRetry = this.catalogService.resolveMultiProductOrder(text, products);
                if (multiRetry) {
                    const handledMulti = await this.tryHandleMultiProductOrder(conv, msg.waId, session, multiRetry, cfg, text, products);
                    if (handledMulti)
                        return;
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
                };
                await this.conversationService.saveSession(conv, session);
                const qtyHint = orderQty > 1 ? `\n_Cantidad anotada: *${orderQty}*_\n\n` : '\n\n';
                await this.reply(conv, msg.waId, (orderQty > 1 ? `Pediste *${orderQty}*. ` : '') +
                    this.catalogService.formatVariantFamilyPrompt(family) +
                    (orderQty > 1 ? qtyHint.replace(/^\n/, '\n') : ''));
                return;
            }
            session.pendingMatch = {
                query: text,
                candidates: resolvedMatches,
                intent: infoAsk ? 'info' : 'order',
                quantity: orderQty > 1 ? orderQty : undefined,
            };
            await this.conversationService.saveSession(conv, session);
            await this.reply(conv, msg.waId, this.catalogService.formatProductChoicePrompt(text, resolvedMatches));
            return;
        }
        const aiSessionCleanup = this.tryAbandonStalePendingState(session, text, products);
        if (aiSessionCleanup) {
            session = aiSessionCleanup;
            await this.conversationService.saveSession(conv, session);
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
            'Si el mensaje es charla (cuentos, programar, clima, chistes) y NO pide comida: NO busques platos ni digas "no encontré el plato X". Redirige al menú o *asesor*.',
            'Responde al ÚLTIMO mensaje del cliente. No repitas que no encontraste un plato si ya pidió otro distinto. Si no reconoces el producto, sugiere nombre/código o escribir *menú* — no insistas con el mensaje anterior.',
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
            this.catalogService.isGenericProductInquiry(text) ||
            this.catalogService.isMenuExploreIntent(text, products) ||
            this.catalogService.isCategoryBrowseQuestion(text) ||
            exploringMenu) &&
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
        if (guarded.actions?.addItems?.length &&
            !session.pendingAttribute &&
            !session.pendingMultiOrder &&
            !this.catalogService.looksLikeMultiItemOrderMessage(text) &&
            !this.catalogService.looksLikeFoodPlusDrinkOrder(text)) {
            const emb = this.catalogService.findProductEmbeddedInMessage(text, products);
            const q = this.catalogService.stripQuantityFromSearchQuery(this.catalogService.extractProductSearchQuery(text));
            const scored = this.catalogService.searchByNameScored(q || text, products, 5);
            const strong = emb ||
                (this.catalogService.isStrongProductMatch(scored) ? scored[0]?.p : null);
            if (strong) {
                const family = this.catalogService.findProductVariantFamily(text, products, [strong]);
                const allowed = new Set((family?.variants?.length ? family.variants : [strong]).map((p) => p.id));
                guarded.actions.addItems = guarded.actions.addItems.filter((i) => allowed.has(i.productId));
                if (!guarded.actions.addItems.length)
                    delete guarded.actions.addItems;
            }
        }
        const cartCountBeforeAi = session.cart.length;
        if (!session.pendingAttribute &&
            !session.pendingMultiOrder &&
            (this.catalogService.looksLikeMultiItemOrderMessage(text) ||
                this.catalogService.looksLikeFoodPlusDrinkOrder(text))) {
            const multiLate = this.catalogService.resolveMultiProductOrder(text, products);
            if (multiLate &&
                multiLate.confident.length + multiLate.needsAttributes.length + multiLate.ambiguous.length >=
                    1 &&
                (multiLate.needsAttributes.length > 0 ||
                    multiLate.confident.length >= 2 ||
                    multiLate.ambiguous.length > 0)) {
                const handledMulti = await this.tryHandleMultiProductOrder(conv, msg.waId, session, multiLate, cfg, text, products);
                if (handledMulti)
                    return;
            }
        }
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
        if (!session.pendingAttribute && ai.actions?.addItems?.length) {
            const guardedIds = new Set((guarded.actions?.addItems || []).map((i) => i.productId));
            const blockedItems = ai.actions.addItems.filter((item) => {
                if (guardedIds.has(item.productId))
                    return false;
                const p = this.catalogService.getProductById(item.productId, products);
                return !!(p?.hasAttributes && p.attributes?.length);
            });
            const blocked = blockedItems[0];
            if (blocked) {
                const product = this.catalogService.getProductById(blocked.productId, products);
                if (product?.hasAttributes) {
                    const fromAi = (blocked.attributes || [])
                        .map((a) => ({
                        attributeName: String(a.attributeName || '').trim(),
                        attributeValue: String(a.attributeValue || '').trim(),
                    }))
                        .filter((a) => a.attributeName && a.attributeValue);
                    const fromText = this.catalogService.resolveAttributesFromMessage(product, text, fromAi);
                    const selected = fromText.status === 'partial' || fromText.status === 'complete'
                        ? fromText.attributes
                        : fromAi;
                    const restNeeds = blockedItems.slice(1).map((item) => {
                        const p = this.catalogService.getProductById(item.productId, products);
                        return {
                            segment: text,
                            ...this.toPendingMultiProduct(p),
                        };
                    });
                    session = {
                        ...session,
                        pendingAttribute: {
                            ...this.toPendingAttribute(product, { sourceText: text }),
                            selected,
                        },
                        pendingMatch: undefined,
                        pendingMultiOrder: restNeeds.length
                            ? {
                                confident: [],
                                ambiguous: [],
                                unresolved: [],
                                needsAttributes: [
                                    {
                                        segment: text,
                                        ...this.toPendingMultiProduct(product),
                                    },
                                    ...restNeeds,
                                ],
                            }
                            : session.pendingMultiOrder,
                    };
                }
            }
        }
        if (!session.pendingAttribute &&
            (this.catalogService.looksLikeFoodPlusDrinkOrder(text) ||
                this.catalogService.looksLikeMultiItemOrderMessage(text))) {
            const multiRecover = this.catalogService.resolveMultiProductOrder(text, products);
            const cartIds = new Set(session.cart.map((c) => c.productId));
            const missingNeeds = multiRecover?.needsAttributes.filter((m) => !cartIds.has(m.product.id)) || [];
            const missingConf = multiRecover?.confident.filter((m) => !cartIds.has(m.product.id)) || [];
            if (missingNeeds.length || missingConf.length >= 1) {
                for (const m of missingConf) {
                    const attrs = this.catalogService.extractExplicitAttributeChoice(`${m.segment} ${text}`, m.product);
                    if (m.product.hasAttributes && !attrs?.length) {
                        missingNeeds.push(m);
                        continue;
                    }
                    const attempt = this.tryAddProductToCart(session, m.product, 1, cfg, undefined, attrs || undefined);
                    if (!attempt.blocked)
                        session = attempt.session;
                }
                if (missingNeeds.length) {
                    const first = missingNeeds[0].product;
                    const step = this.catalogService.resolveAttributesFromMessage(first, text, []);
                    session = {
                        ...session,
                        pendingAttribute: {
                            ...this.toPendingAttribute(first, { sourceText: text }),
                            selected: step.status === 'partial' ? step.attributes : [],
                        },
                        pendingMultiOrder: {
                            confident: [],
                            ambiguous: [],
                            unresolved: [],
                            needsAttributes: missingNeeds.map((m) => ({
                                segment: m.segment,
                                ...this.toPendingMultiProduct(m.product),
                            })),
                        },
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
            await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
            const attrPrompt = this.catalogService.formatProductOptionsPrompt(product, pa.selected || []);
            if (session.cart.length > cartCountBeforeAi) {
                const addedNames = session.cart.slice(cartCountBeforeAi).map((c) => c.name);
                await this.reply(conv, msg.waId, `${this.buildCartAddReply(session, cfg.defaultDeliveryFee, addedNames, {
                    suffix: '',
                })}\n\n` +
                    `Ahora elige opciones para *${product.name}*:\n\n${attrPrompt}`);
            }
            else {
                await this.reply(conv, msg.waId, attrPrompt);
            }
            return;
        }
        if (session.pendingMatch?.candidates?.length && this.isPendingListRepromptText(text, session.pendingMatch)) {
            const family = this.catalogService.findProductVariantFamily(session.pendingMatch.query || text, products, session.pendingMatch.candidates);
            if (family && family.variants.length >= 2) {
                await this.conversationService.saveSession(conv, session);
                await this.reply(conv, msg.waId, this.catalogService.formatVariantFamilyPrompt(family));
                return;
            }
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
            await this.reply(conv, msg.waId, `Encontré varias opciones 👇\n\n${opts}\n\n${this.catalogService.formatListChoiceHint()}`);
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
                ? `${this.formatCartOnly(session, cfg.defaultDeliveryFee)}\n\n${this.formatContinueShoppingPrompt()}`
                : 'Dime qué quieres pedir por *nombre* o *código*, o escribe *menú*.';
        }
        else if ((guarded.actions?.addItems?.length ?? 0) > 0 &&
            session.cart.length > 0 &&
            !session.pendingAttribute &&
            !/\bas[ií]\s+va tu pedido|subtotal:/i.test(reply)) {
            reply =
                `${reply.trim()}\n\n${this.formatCartOnly(session, cfg.defaultDeliveryFee)}\n\n` +
                    this.formatContinueShoppingPrompt();
        }
        await this.reply(conv, msg.waId, reply);
    }
    async applyActions(conv, session, actions, products, cfg) {
        if (!actions)
            return { session };
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
            if (addr.length >= 5 && !this.isConfirmKeyword(addr) && !this.isGreetingKeyword(addr)) {
                if (!this.isPickupIntent(addr)) {
                    next = this.withDeliveryAddress(next, addr);
                }
                else {
                    next.address = addr;
                }
            }
        }
        if (actions.setOrderType === 'pickup') {
            next = this.applyPickupIntent(next, actions.setAddress || 'pickup');
        }
        else if (actions.setOrderType === 'delivery') {
            next.orderType = 'delivery';
            next.fulfillmentChosen = true;
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
                productFocus: {
                    productId: product.id,
                    name: product.name,
                    variantBaseKey: this.catalogService.getProductNameBase(product.name) || undefined,
                },
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
    cartLineKey(item) {
        const attrs = [...(item.attributes || [])]
            .map((a) => `${a.attributeName}=${a.attributeValue}`)
            .sort()
            .join('|');
        return `${item.productId}::${item.note || ''}::${attrs}`;
    }
    consolidateCart(cart) {
        const map = new Map();
        for (const raw of cart) {
            const qty = Math.max(1, raw.quantity || 1);
            const key = this.cartLineKey(raw);
            const prev = map.get(key);
            if (prev) {
                map.set(key, {
                    ...prev,
                    quantity: Math.min(30, (prev.quantity || 1) + qty),
                });
            }
            else {
                map.set(key, { ...raw, quantity: qty });
            }
        }
        return [...map.values()];
    }
    addProductToCart(session, product, quantity, note, attributes) {
        const qty = Math.min(30, Math.max(1, Math.round(quantity) || 1));
        const cart = [...session.cart];
        const incomingKey = this.cartLineKey({
            productId: product.id,
            note,
            attributes,
        });
        const sameIdx = cart.findIndex((c) => this.cartLineKey(c) === incomingKey);
        if (sameIdx >= 0) {
            cart[sameIdx] = {
                ...cart[sameIdx],
                quantity: Math.min(30, Math.max(1, cart[sameIdx].quantity || 1) + qty),
            };
        }
        else {
            cart.push({
                productId: product.id,
                name: product.name,
                code: product.code,
                quantity: qty,
                unitPrice: product.price,
                note,
                attributes,
            });
        }
        return { ...session, cart: this.consolidateCart(cart) };
    }
    toPendingAttribute(product, opts) {
        const variantIntent = opts?.variantIntent ||
            (opts?.sourceText
                ? this.catalogService.extractVariantPreferenceHint(opts.sourceText) || undefined
                : undefined);
        return {
            productId: product.id,
            name: product.name,
            code: product.code,
            price: product.price,
            attributes: product.attributes || [],
            selected: opts?.selected || [],
            variantIntent,
        };
    }
    attributeFlowOpts(pa) {
        return pa?.variantIntent ? { variantIntent: pa.variantIntent } : undefined;
    }
    buildSessionSummary(conv, session, deliveryFee) {
        const subtotal = session.cart.reduce((s, c) => s + c.unitPrice * Math.max(1, c.quantity || 1), 0);
        const fee = session.orderType === 'delivery' ? deliveryFee : 0;
        const lines = [
            `Nombre: ${conv.customerName || '(pendiente)'}`,
            `Teléfono WA: ${conv.phoneE164}`,
            `Teléfono contacto: ${session.contactPhone || (session.phoneConfirmed ? conv.phoneE164 : '(pendiente confirmar)')}`,
            `Dirección: ${session.address || '(pendiente)'} (confirmada: ${session.addressConfirmed ? 'sí' : 'no'})`,
            `Tipo: ${session.orderType} (elegido: ${session.fulfillmentChosen ? 'sí' : 'no'})`,
            `Pago: ${session.paymentMethod || '(pendiente)'}`,
            `Carrito (${session.cart.reduce((n, c) => n + Math.max(1, c.quantity || 1), 0)}): ${session.cart
                .map((c) => {
                const q = Math.max(1, c.quantity || 1);
                return `${c.name}${q > 1 ? ` x${q}` : ''} $${Math.round(c.unitPrice * q).toLocaleString('es-CO')}`;
            })
                .join(', ') || 'vacío'}`,
            `Subtotal sistema: $${Math.round(subtotal).toLocaleString('es-CO')} + domicilio $${Math.round(fee).toLocaleString('es-CO')}`,
            'Checkout: el sistema pregunta UNA cosa a la vez (nombre → domicilio/recojo → dirección → teléfono → pago). NO inventes ni saltes esos pasos.',
        ];
        if (session.ignorePriorOrderHistory && session.cart.length === 0) {
            lines.push('NUEVO PEDIDO: carrito vacío tras pedido anterior. NO reutilices ítems del historial.');
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
            };
            const remaining = this.catalogService.getRemainingAttributes(productForRemaining, pa.selected || [], this.attributeFlowOpts(pa));
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
    isPendingListRepromptText(text, pending) {
        const t = text.trim().toLowerCase();
        if (!t)
            return true;
        if (/^[1-9]\d{0,3}$/.test(t)) {
            if (!pending?.candidates?.length)
                return true;
            const n = parseInt(t, 10);
            if (n >= 1 && n <= pending.candidates.length)
                return false;
            if (pending.candidates.some((c) => c.code === n))
                return false;
            return true;
        }
        if (/\?/.test(t))
            return true;
        if (/\b(cuales|cuáles|opciones|lista|no entendi|no entendí|otra vez|de nuevo|cuál|cual|numero|número)\b/i.test(t)) {
            return true;
        }
        return false;
    }
    looksLikeFreshOrderIntent(text) {
        const t = text.trim().toLowerCase();
        if (!t)
            return false;
        if (this.isGreetingKeyword(text) || this.isMenuLinkIntent(text))
            return true;
        if (/\b(hola|buenas|hey|menu|menú|humano|asesor|agente)\b/i.test(t))
            return true;
        if (/\b(quiero|quieor|qiero|kiero|dame|ponme|me das|pedir|ordenar|agrega|agregame|otro|otra|mejor|en realidad|no era|olvidalo|olvídalo|olvidate|empezar de nuevo|de nuevo)\b/i.test(t)) {
            return true;
        }
        const q = this.catalogService.extractProductSearchQuery(text);
        return q.length >= 4;
    }
    messageRelatesToPendingMatch(text, pending) {
        const trimmed = text.trim();
        if (!trimmed)
            return true;
        const bareNum = /^[1-9]\d{0,3}$/.test(trimmed) ? parseInt(trimmed, 10) : null;
        if (bareNum != null) {
            if (bareNum >= 1 && bareNum <= pending.candidates.length)
                return true;
            if (pending.candidates.some((c) => c.code === bareNum))
                return true;
            return false;
        }
        const listPick = trimmed.match(/(?:opci[oó]n|la|el|numero|n[uú]mero)\s*([1-9]\d{0,2})/i);
        if (listPick) {
            const pick = parseInt(listPick[1], 10);
            if (pick >= 1 && pick <= pending.candidates.length)
                return true;
        }
        const code = this.catalogService.extractCodeFromMessage(text);
        if (code != null) {
            return pending.candidates.some((c) => c.code === code);
        }
        if (this.isPendingListRepromptText(text, pending))
            return true;
        const q = this.normalizeForMatch(this.catalogService.extractProductSearchQuery(text));
        if (q.length < 3)
            return false;
        for (const c of pending.candidates) {
            const name = this.normalizeForMatch(c.name);
            if (name.includes(q) || q.includes(name))
                return true;
            const qTokens = q.split(' ').filter((tok) => tok.length >= 4);
            if (qTokens.some((tok) => name.includes(tok)))
                return true;
        }
        return false;
    }
    shouldAbandonPendingMultiOrder(text, pending, products) {
        if (this.isMultiOrderAffirmative(text))
            return false;
        const lower = text.trim().toLowerCase();
        if (/^[1-9]\d*$/.test(lower) && pending.ambiguous.length)
            return false;
        for (const seg of [
            ...pending.unresolved,
            ...pending.ambiguous.map((a) => a.segment),
        ]) {
            const segNorm = this.normalizeForMatch(seg);
            if (segNorm.length >= 4 && this.normalizeForMatch(text).includes(segNorm))
                return false;
        }
        if (this.looksLikeFreshOrderIntent(text))
            return true;
        if (this.catalogService.findProductEmbeddedInMessage(text, products))
            return true;
        return text.trim().length >= 12;
    }
    tryAbandonStalePendingState(session, text, products) {
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
            const picked = this.catalogService.resolveCategoryBrowsePick(text, session.pendingCategoryBrowse.categories);
            const embedded = this.catalogService.findProductEmbeddedInMessage(text, products);
            if (!picked &&
                embedded &&
                !this.catalogService.isMenuExploreIntent(text, products)) {
                next = { ...next, pendingCategoryBrowse: undefined };
                changed = true;
            }
        }
        return changed ? next : null;
    }
    async tryHandleVariantFamily(conv, waId, session, text, products, cfg) {
        const family = this.catalogService.findProductVariantFamily(text, products);
        if (!family || family.variants.length < 2)
            return false;
        const picked = this.catalogService.pickVariantFromFamilyText(text, family);
        const qty = this.catalogService.extractQuantityFromMessage(text);
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
            session = added.session;
            await this.conversationService.saveSession(conv, session, 'building_cart');
            const qtyNote = qty > 1 ? ` _(x${qty})_` : '';
            await this.reply(conv, waId, this.buildCartAddReply(session, cfg.defaultDeliveryFee, `${picked.name}${qtyNote}`));
            return true;
        }
        session = {
            ...session,
            pendingMatch: {
                query: text,
                candidates: family.variants,
                quantity: qty > 1 ? qty : undefined,
            },
        };
        await this.conversationService.saveSession(conv, session);
        await this.reply(conv, waId, (qty > 1 ? `Pediste *${qty}*. ` : '') +
            this.catalogService.formatVariantFamilyPrompt(family));
        return true;
    }
    async tryResolvePendingMatchPick(conv, waId, session, text, products, cfg) {
        const pending = session.pendingMatch;
        if (!pending?.candidates?.length)
            return false;
        if (this.catalogService.isProductDescriptionInquiry(text))
            return false;
        const trimmed = text.trim();
        const bareNum = this.catalogService.extractListPickNumber(text);
        let chosenLite = null;
        if (bareNum != null && bareNum >= 1 && bareNum <= pending.candidates.length) {
            chosenLite = pending.candidates[bareNum - 1];
        }
        const code = this.catalogService.extractCodeFromMessage(text);
        if (!chosenLite && code != null) {
            chosenLite = pending.candidates.find((c) => c.code === code) ?? null;
        }
        if (!chosenLite && code != null) {
            const found = this.catalogService.findByCode(code, products);
            if (found && pending.candidates.some((c) => c.id === found.id)) {
                chosenLite = found;
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
            const family = this.catalogService.findProductVariantFamily(pending.query || text, products, pending.candidates);
            if (family) {
                const byFamily = this.catalogService.pickVariantFromFamilyText(text, family);
                if (byFamily)
                    chosenLite = byFamily;
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
        if (!chosenLite)
            return false;
        const chosen = this.catalogService.getProductById(chosenLite.id, products) || chosenLite;
        if (chosen.availableNow === false) {
            await this.reply(conv, waId, `*${chosen.name}* no está disponible en este horario. Elige otro de la lista o dime otro plato.`);
            return true;
        }
        const infoIntent = pending.intent === 'info';
        const qty = Math.max(1, pending.quantity || this.catalogService.extractQuantityFromMessage(text) || 1);
        session = {
            ...session,
            pendingMatch: undefined,
        };
        session = this.rememberProductFocus(session, chosen, products);
        if (infoIntent) {
            await this.conversationService.saveSession(conv, session, 'building_cart');
            await this.reply(conv, waId, this.catalogService.formatProductPriceReply(chosen));
            return true;
        }
        session = this.applyDeliveryHintFromMessage(session, text);
        if (chosen.hasAttributes && chosen.attributes?.length) {
            if (await this.handleProductWithVariants(conv, waId, session, chosen, text, cfg)) {
                return true;
            }
        }
        const added = this.tryAddProductToCart(session, chosen, qty, cfg);
        if (added.blocked) {
            await this.conversationService.saveSession(conv, session);
            await this.handleCartLimitBlocked(conv, waId, added.blocked, cfg);
            return true;
        }
        session = added.session;
        await this.conversationService.saveSession(conv, session, 'building_cart');
        const qtyNote = qty > 1 ? ` _(x${qty})_` : '';
        await this.reply(conv, waId, this.buildCartAddReply(session, cfg.defaultDeliveryFee, `${chosen.name}${qtyNote}`, {
            extraLine: session.address?.trim()
                ? `\nDomicilio anotado: _${session.address.trim()}_`
                : undefined,
        }));
        return true;
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
        const productForRemaining = {
            id: pa.productId,
            name: pa.name,
            code: pa.code,
            price: pa.price,
            hasAttributes: true,
            attributes: pa.attributes || [],
        };
        const remainingAttrs = this.catalogService.getRemainingAttributes(productForRemaining, pa.selected || [], this.attributeFlowOpts(pa));
        const nextAttr = remainingAttrs[0];
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
    formatContinueShoppingPrompt(session) {
        if (session?.addressConfirmed && session.cart.length > 0) {
            return 'Si ya está tu pedido, escribe *listo* para continuar.';
        }
        return '¿Algo más? Si ya está, escribe *listo*.';
    }
    formatCartTiny(session, deliveryFee) {
        const cart = this.consolidateCart(session.cart);
        const n = cart.reduce((s, c) => s + Math.max(1, c.quantity || 1), 0);
        if (!n)
            return '🛒 Carrito vacío';
        const subtotal = cart.reduce((s, c) => s + c.unitPrice * Math.max(1, c.quantity || 1), 0);
        const fee = session.orderType === 'delivery' ? deliveryFee : 0;
        const total = subtotal + fee;
        return `🛒 ${n} ${n === 1 ? 'ítem' : 'ítems'} · *$${Math.round(total).toLocaleString('es-CO')}*`;
    }
    withPreface(preface, body) {
        const p = (preface || '').trim();
        if (!p)
            return body;
        return `${p}\n\n${body}`;
    }
    formatCartOnly(session, deliveryFee) {
        const cart = this.consolidateCart(session.cart);
        if (!cart.length)
            return '🛒 Carrito vacío';
        const subtotal = cart.reduce((s, c) => s + c.unitPrice * Math.max(1, c.quantity || 1), 0);
        const fee = session.orderType === 'delivery' ? deliveryFee : 0;
        const total = subtotal + fee;
        const lines = cart.map((c, i) => {
            const qty = Math.max(1, c.quantity || 1);
            const lineTotal = c.unitPrice * qty;
            const attrs = c.attributes?.length
                ? `\n   _${c.attributes.map((a) => a.attributeValue).join(' · ')}_`
                : '';
            const note = c.note?.trim() ? `\n   📝 _${c.note.trim()}_` : '';
            return (`*${i + 1}.* *${c.name}*\n` +
                `   Cant: *${qty}*  ·  $${Math.round(c.unitPrice).toLocaleString('es-CO')} c/u\n` +
                `   💰 *$${Math.round(lineTotal).toLocaleString('es-CO')}*` +
                attrs +
                note);
        });
        return (`🛒 *Tu carrito*\n\n` +
            lines.join('\n\n') +
            `\n\n────────────\n` +
            `Subtotal: $${Math.round(subtotal).toLocaleString('es-CO')}` +
            (fee ? `\nDomicilio: $${Math.round(fee).toLocaleString('es-CO')}` : '') +
            `\n*Total: $${Math.round(total).toLocaleString('es-CO')}*` +
            (session.orderType === 'delivery' && session.address?.trim()
                ? `\n\n📍 ${session.address.trim()}${session.addressConfirmed ? ' ✅' : ''}`
                : ''));
    }
    buildCartAddReply(session, deliveryFee, added, opts) {
        const names = (Array.isArray(added) ? added : [added]).filter(Boolean);
        let head = names.length === 1
            ? `Listo, agregué *${names[0]}* ✅`
            : `Listo, agregué:\n${names.map((n) => `• *${n}*`).join('\n')} ✅`;
        if (opts?.extraLine)
            head += `\n${opts.extraLine}`;
        return (`${head}\n\n${this.formatCartOnly(session, deliveryFee)}\n\n` +
            (opts?.suffix ?? this.formatContinueShoppingPrompt(session)));
    }
    async maybeAdvanceCheckoutAfterAdd(conv, waId, session) {
        if (!session.cart.length)
            return false;
        if (!(session.addressConfirmed && session.address?.trim()))
            return false;
        if (!conv.customerName?.trim() && !session.phoneConfirmed) {
            await this.tryConfirmOrder(conv, waId, session);
            return true;
        }
        if (conv.customerName?.trim()) {
            await this.tryConfirmOrder(conv, waId, session);
            return true;
        }
        return false;
    }
    formatOrderSummary(conv, session, deliveryFee, paymentMethods = []) {
        const tipo = session.orderType === 'pickup' ? 'Recoger en el local' : 'Domicilio';
        const lugarLabel = session.orderType === 'pickup' ? '📍' : '📍 Dirección';
        const phone = session.contactPhone || conv.phoneE164;
        return (`${this.formatCartOnly(session, deliveryFee)}\n` +
            `\n🛵 Tipo: ${tipo}` +
            `\n👤 Nombre: ${conv.customerName || '(pendiente)'}` +
            `\n${lugarLabel}: ${session.address || '(pendiente)'}` +
            `\n📞 Teléfono: ${phone ? this.formatWaPhoneDisplay(phone) : '(pendiente)'}` +
            `\n💳 Pago: ${(0, whatsapp_payment_methods_1.paymentMethodLabel)(session.paymentMethod, paymentMethods)}` +
            (session.cashChangeFor ? `\n💵 Cambio de: ${session.cashChangeFor}` : '') +
            (session.customerNotes ? `\n📝 Notas: ${session.customerNotes}` : '') +
            (session.pendingRedemptionCode
                ? `\n${(0, whatsapp_points_help_1.formatPremioAppliedNote)(session.pendingRedemptionCode, session.pendingRedemptionExpiresAt
                    ? new Date(session.pendingRedemptionExpiresAt)
                    : null)}`
                : ''));
    }
    isReadyToConfirm(session, conv) {
        return (session.cart.length > 0 &&
            !!conv.customerName?.trim() &&
            !!session.fulfillmentChosen &&
            !!session.address?.trim() &&
            !!session.addressConfirmed &&
            !!session.phoneConfirmed &&
            !!session.paymentMethod);
    }
    formatWaPhoneDisplay(phoneE164) {
        const digits = (phoneE164 || '').replace(/\D/g, '');
        if (digits.length >= 10) {
            const local = digits.slice(-10);
            return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
        }
        return phoneE164 || '(sin número)';
    }
    looksLikePhoneNumber(text) {
        const digits = text.replace(/\D/g, '');
        return digits.length >= 7 && digits.length <= 15 && /[\d\s+()-]{7,}/.test(text.trim());
    }
    normalizeContactPhone(raw, fallbackE164) {
        const digits = raw.replace(/\D/g, '');
        if (digits.length < 7 || digits.length > 15)
            return null;
        if (digits.length === 10)
            return `+57${digits}`;
        if (digits.length === 12 && digits.startsWith('57'))
            return `+${digits}`;
        if (raw.trim().startsWith('+') && digits.length >= 10)
            return `+${digits}`;
        if (digits.length >= 10)
            return `+${digits}`;
        const base = fallbackE164.replace(/\D/g, '');
        if (base.length >= 10 && digits.length >= 7) {
            return `+${base.slice(0, base.length - 10)}${digits}`.replace(/\+\+/, '+');
        }
        return `+${digits}`;
    }
    buildAskNameMessage(session, deliveryFee) {
        return (`${this.formatCartTiny(session, deliveryFee)}\n\n` +
            `¿Me regalas tu *nombre completo*?\n` +
            `_Ej: Juan Pérez_`);
    }
    buildAskFulfillmentMessage(session, deliveryFee) {
        return (`${this.formatCartTiny(session, deliveryFee)}\n\n` +
            `¿*Domicilio* o *paso a recoger*?\n` +
            `_Si es domicilio, puedes mandar la dirección de una._`);
    }
    buildAskAddressMessage(session, deliveryFee, retry = false) {
        const head = retry
            ? 'No me quedó clara la dirección 🙏'
            : `${this.formatCartTiny(session, deliveryFee)}\n\nDomicilio:`;
        if (session.address?.trim() && !session.addressConfirmed) {
            return (`${head}\n` +
                `📍 _${session.address.trim()}_\n\n` +
                `¿Está bien? Responde *sí* o manda la dirección corregida.`);
        }
        return (`${head}\n` +
            `¿Me escribes la *dirección*?\n` +
            `_Ej: Calle 10 #5-20, apto 202, Centro_\n` +
            `_O escribe *paso a recoger*._`);
    }
    buildAskPhoneMessage(conv, session, deliveryFee) {
        const wa = this.formatWaPhoneDisplay(conv.phoneE164);
        return (`${this.formatCartTiny(session, deliveryFee)}\n\n` +
            `¿Teléfono de contacto?\n` +
            `• *sí* → usar ${wa}\n` +
            `• u otro número (ej. 3001234567)`);
    }
    async tryResolvePhoneConfirmation(conv, waId, session, text, cfg) {
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
                await this.reply(conv, waId, 'No me quedó claro el número. Escríbelo con 10 dígitos (ej. *3001234567*) o responde *sí* para usar el de WhatsApp.');
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
        await this.reply(conv, waId, this.buildAskPhoneMessage(conv, session, cfg.defaultDeliveryFee));
        return true;
    }
    async tryConfirmOrder(conv, waId, session, opts) {
        const cfg = await this.settingsService.getEffectiveConfig();
        const say = async (body) => {
            await this.reply(conv, waId, this.withPreface(opts?.preface, body));
            opts = { ...opts, preface: undefined };
        };
        if (!session.cart.length) {
            await say('Aún no tienes nada en el carrito. Dime qué quieres por nombre o código.');
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
            await say(minCheck.reason || 'El pedido no alcanza el mínimo.');
            return;
        }
        if (!conv.customerName?.trim()) {
            session.pendingMatch = undefined;
            session.pendingAttribute = undefined;
            await this.conversationService.saveSession(conv, session, 'awaiting_name');
            await say(this.buildAskNameMessage(session, cfg.defaultDeliveryFee));
            return;
        }
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
            }
            else if (session.address?.trim() && session.addressConfirmed) {
                session = { ...session, orderType: 'delivery', fulfillmentChosen: true };
                await this.conversationService.saveSession(conv, session);
            }
            else if (session.address?.trim() && this.isStrongExplicitAddress(session.address)) {
                session = {
                    ...session,
                    orderType: 'delivery',
                    fulfillmentChosen: true,
                    addressConfirmed: true,
                };
                await this.conversationService.saveSession(conv, session);
            }
            else if (session.address?.trim()) {
                session = {
                    ...session,
                    orderType: 'delivery',
                    fulfillmentChosen: true,
                    addressConfirmed: false,
                };
                await this.conversationService.saveSession(conv, session, 'awaiting_address');
                await say(this.buildAskAddressMessage(session, cfg.defaultDeliveryFee));
                return;
            }
            else {
                await this.conversationService.saveSession(conv, session, 'awaiting_fulfillment');
                await say(this.buildAskFulfillmentMessage(session, cfg.defaultDeliveryFee));
                return;
            }
        }
        if (session.orderType !== 'pickup') {
            if (session.address?.trim() && !session.addressConfirmed && this.isStrongExplicitAddress(session.address)) {
                session = { ...session, addressConfirmed: true, fulfillmentChosen: true };
                await this.conversationService.saveSession(conv, session);
            }
            if (!session.address?.trim() || !session.addressConfirmed) {
                session.pendingMatch = undefined;
                session.pendingAttribute = undefined;
                await this.conversationService.saveSession(conv, session, 'awaiting_address');
                await say(this.buildAskAddressMessage(session, cfg.defaultDeliveryFee));
                return;
            }
        }
        else if (!session.address?.trim()) {
            session = {
                ...session,
                address: 'Recoge en el local',
                addressConfirmed: true,
                fulfillmentChosen: true,
            };
            await this.conversationService.saveSession(conv, session);
        }
        if (!session.phoneConfirmed) {
            session = {
                ...session,
                phoneConfirmed: true,
                contactPhone: session.contactPhone || conv.phoneE164,
            };
            await this.conversationService.saveSession(conv, session);
        }
        if (!session.paymentMethod) {
            session.pendingMatch = undefined;
            session.pendingAttribute = undefined;
            await this.conversationService.saveSession(conv, session, 'awaiting_payment');
            await say(`${this.formatCartTiny(session, cfg.defaultDeliveryFee)}\n\n` +
                (0, whatsapp_payment_methods_1.buildPaymentOptionsPrompt)(cfg.paymentMethods, cfg.paymentInstructions));
            return;
        }
        if (!session.notesCollected) {
            session = { ...session, notesCollected: true };
            await this.conversationService.saveSession(conv, session);
        }
        const canSkipFinal = !!opts?.skipFinalConfirm && this.isReadyToConfirm(session, conv);
        if (conv.state !== 'awaiting_final_confirm' && !canSkipFinal) {
            if (session.pendingRedemptionCode &&
                !this.pointsHandler.cartHasHalfChicken(session.cart)) {
                await this.conversationService.saveSession(conv, session, 'awaiting_final_confirm');
                await say(`${this.formatOrderSummary(conv, session, cfg.defaultDeliveryFee, cfg.paymentMethods)}\n\n` +
                    `${(0, whatsapp_points_help_1.formatCartNeedsHalfChickenForPremio)()}\n\n` +
                    `Cuando agregues el medio pollo, escribe *listo*.`);
                return;
            }
            await this.conversationService.saveSession(conv, session, 'awaiting_final_confirm');
            await say(`${this.formatOrderSummary(conv, session, cfg.defaultDeliveryFee, cfg.paymentMethods)}\n\n` +
                `Si todo cuadra, responde *listo* y armamos el pedido.`);
            return;
        }
        if (session.pendingRedemptionCode &&
            !this.pointsHandler.cartHasHalfChicken(session.cart)) {
            await say(`${(0, whatsapp_points_help_1.formatCartNeedsHalfChickenForPremio)()}\n\nAgrega medio pollo (cód. 2 o 5) y vuelve a escribir *listo*.`);
            return;
        }
        session = { ...session, cart: this.consolidateCart(session.cart) };
        const items = session.cart.flatMap((c) => Array.from({ length: Math.max(1, c.quantity || 1) }, () => ({
            productId: c.productId,
            note: c.note,
            attributes: c.attributes,
        })));
        const extras = this.buildOrderExtras(session);
        const orderDto = {
            customerName: conv.customerName.trim(),
            phone: (session.contactPhone || conv.phoneE164).trim(),
            address: (session.address || '').trim(),
            orderType: session.orderType,
            deliveryFee: session.orderType === 'delivery' ? cfg.defaultDeliveryFee : undefined,
            orderSource: 'whatsapp',
            items,
            ...(extras.length ? { extras } : {}),
            ...(session.pendingRedemptionCode
                ? { redemptionCode: session.pendingRedemptionCode }
                : {}),
            clientRequestId: `wa-${conv.id}-${(0, crypto_1.randomUUID)()}`.slice(0, 64),
        };
        try {
            const payMethod = (0, whatsapp_payment_methods_1.getEnabledPaymentMethods)(cfg.paymentMethods).find((m) => m.id === session.paymentMethod) || (0, whatsapp_payment_methods_1.findPaymentMethodByText)(session.paymentMethod || '', cfg.paymentMethods);
            if (payMethod?.flow === 'mercadopago' || session.paymentMethod === 'mercadopago') {
                const subtotal = session.cart.reduce((s, c) => s + c.unitPrice * Math.max(1, c.quantity || 1), 0);
                const total = subtotal + (orderDto.deliveryFee ?? 0);
                const mpItems = session.cart.map((c) => ({
                    title: c.name,
                    quantity: Math.max(1, c.quantity || 1),
                    unit_price: c.unitPrice,
                }));
                const pref = await this.paymentsService.createPreference(orderDto, mpItems, total, {
                    name: conv.customerName.trim(),
                    email: `${(session.contactPhone || conv.phoneE164).replace(/\D/g, '')}@whatsapp.ppp.local`,
                    phone: session.contactPhone || conv.phoneE164,
                }, {
                    channel: 'whatsapp',
                    conversationId: conv.id,
                    waId: conv.waId,
                    bypassOnlineHours: !!cfg.ignoreBusinessHours,
                });
                session.mpPreferenceId = pref.preferenceId;
                await this.conversationService.saveSession(conv, session, 'awaiting_mp_payment');
                await say(`${this.formatOrderSummary(conv, session, cfg.defaultDeliveryFee, cfg.paymentMethods)}\n\n` +
                    `Link de pago Mercado Pago:\n${pref.initPoint}\n\nCuando el pago se confirme, te avisamos aquí y armamos el pedido.`);
                return;
            }
            const order = await this.ordersService.create(orderDto);
            const snapshot = { ...session };
            await this.conversationService.resetOrderSession(conv, 'completed', {
                ignorePriorHistory: true,
            });
            await say(this.formatOrderSuccessMessage(conv, snapshot, order, cfg.defaultDeliveryFee, cfg.orderSuccessMessage, cfg.paymentMethods));
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Error al crear pedido';
            this.logger.error(`Order create failed: ${message}`);
            await say(`Uy, no pude registrar el pedido: ${message}. Escribe *humano* y te ayudamos.`);
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
    isProductCompositionQuestion(text) {
        return this.catalogService.isProductDescriptionInquiry(text);
    }
    findProductsForCompositionQuestion(text, products, session) {
        const stripped = this.catalogService.stripProductDescriptionInquiryNoise(text);
        const query = this.catalogService.extractProductSearchQuery(stripped || text);
        const family = this.catalogService.findProductVariantFamily(query || text, products);
        if (family && family.variants.length >= 2) {
            return family.variants;
        }
        const embedded = this.catalogService.findProductEmbeddedInMessage(stripped || text, products);
        if (embedded) {
            const embFamily = this.catalogService.findProductVariantFamily(embedded.name, products, [embedded]);
            if (embFamily && embFamily.variants.length >= 2)
                return embFamily.variants;
            return [embedded];
        }
        const scored = this.catalogService.searchByNameScored(query, products, 6);
        if (scored.length >= 2) {
            const top = scored[0].score;
            const close = scored
                .filter((x) => x.score >= Math.max(40, top - 20))
                .map((x) => x.p);
            const uniq = this.catalogService.dedupeProductsById(close);
            if (uniq.length >= 2) {
                const asFamily = this.catalogService.findProductVariantFamily(query || text, products, uniq);
                if (asFamily && asFamily.variants.length >= 2)
                    return asFamily.variants;
                return uniq.slice(0, 5);
            }
        }
        if (scored.length === 1 && scored[0].score >= 40)
            return [scored[0].p];
        if (scored.length >= 1 && this.catalogService.isStrongProductMatch(scored)) {
            return [scored[0].p];
        }
        const focused = this.resolveDiscussedProduct(session, stripped || text, products);
        return focused ? [focused] : [];
    }
    findProductForCompositionQuestion(text, products, session) {
        return this.findProductsForCompositionQuestion(text, products, session)[0] || null;
    }
    buildProductCompositionReply(text, product, cfg) {
        const allergens = (cfg.localContext?.allergensNote || '').trim();
        if (product) {
            return this.catalogService.formatProductPriceReply(product);
        }
        let msg = '¿De qué plato quieres saber? Dime el *nombre* (ej. *bandeja paisa*, *sopa de mondongo*) y te cuento qué trae.';
        if (allergens && /\b(alergeno|alérgeno|gluten|lacteo|lácteo|celiaco)\b/i.test(text)) {
            msg += `\n\nLo que sí tenemos registrado sobre alérgenos:\n_${allergens}_`;
        }
        return msg;
    }
    rememberProductFocus(session, product, products) {
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
    resolveDiscussedProduct(session, text, products) {
        if (session.pendingAttribute?.productId) {
            const pending = this.catalogService.getProductById(session.pendingAttribute.productId, products);
            if (pending)
                return pending;
        }
        if (session.productFocus?.productId) {
            const focused = this.catalogService.getProductById(session.productFocus.productId, products);
            if (focused)
                return focused;
        }
        if (session.cart.length) {
            const last = session.cart[session.cart.length - 1];
            const fromCart = this.catalogService.getProductById(last.productId, products);
            if (fromCart)
                return fromCart;
        }
        const embedded = this.catalogService.findProductEmbeddedInMessage(text, products);
        if (embedded)
            return embedded;
        const query = this.catalogService.extractProductSearchQuery(text);
        const scored = this.catalogService.searchByNameScored(query, products, 5);
        if (scored.length === 1 && scored[0].score >= 45)
            return scored[0].p;
        if (scored.length >= 1 && this.catalogService.isStrongProductMatch(scored))
            return scored[0].p;
        return null;
    }
    removeCartLinesForProductId(session, productId) {
        const indices = session.cart
            .map((item, i) => ({ item, i }))
            .filter(({ item }) => item.productId === productId)
            .map(({ i }) => i);
        return indices.length ? this.removeCartLines(session, indices) : session;
    }
    removeCartLinesForVariantFamily(session, family, products) {
        const variantIds = new Set(family.variants.map((v) => v.id));
        const indices = session.cart
            .map((item, i) => ({ item, i }))
            .filter(({ item }) => {
            if (variantIds.has(item.productId))
                return true;
            const p = this.catalogService.getProductById(item.productId, products);
            if (!p)
                return false;
            return this.catalogService.getProductNameBase(p.name) === family.baseKey;
        })
            .map(({ i }) => i);
        return indices.length ? this.removeCartLines(session, indices) : session;
    }
    async tryHandleComboAvailabilityQuestion(conv, waId, session, text, products, cfg) {
        if (!this.catalogService.isComboAvailabilityQuestion(text))
            return false;
        const product = this.resolveDiscussedProduct(session, text, products);
        if (!product) {
            await this.reply(conv, waId, '¿De cuál plato quieres saber si hay *combo*? Dime el nombre (ej. *pollo frito*).');
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
            await this.reply(conv, waId, `Sí 👍 Para *${family.baseLabel}* manejamos estas versiones:\n\n` +
                this.catalogService.formatVariantFamilyPrompt(family) +
                `\n\n_Si quieres el combo, dime *en combo* o el número._`);
            return true;
        }
        if (product.hasAttributes && product.attributes?.length) {
            await this.conversationService.saveSession(conv, session);
            await this.reply(conv, waId, this.catalogService.formatProductVariantsOverview(product, 'info'));
            return true;
        }
        await this.conversationService.saveSession(conv, session);
        await this.reply(conv, waId, `Sobre *${product.name}*, en el menú no veo una variante *combo* aparte. Si quieres, te lo agrego tal cual o escribe *humano*.`);
        return true;
    }
    async tryHandleVariantPreferenceChange(conv, waId, session, text, products, cfg) {
        if (!this.catalogService.isVariantPreferenceIntent(text))
            return false;
        const product = this.resolveDiscussedProduct(session, text, products);
        if (!product)
            return false;
        return this.tryApplyVariantPreferenceToProduct(conv, waId, session, text, products, cfg, product, { fromPendingAttribute: false });
    }
    async tryApplyVariantPreferenceToProduct(conv, waId, session, text, products, cfg, product, opts) {
        const hint = this.catalogService.extractVariantPreferenceHint(text);
        const cartContext = session.cart.length > 0 || opts.fromPendingAttribute;
        const family = this.catalogService.findProductVariantFamily(product.name, products, [
            product,
            ...(session.pendingMatch?.candidates || []),
            ...session.cart
                .map((c) => this.catalogService.getProductById(c.productId, products))
                .filter((p) => !!p),
        ]);
        if (family && family.variants.length >= 2) {
            let picked = this.catalogService.pickVariantFromFamilyText(text, family) ||
                (hint === 'combo'
                    ? family.variants.find((p) => /\bcombo\b/.test(p.name.toLowerCase())) || null
                    : hint === 'solo'
                        ? family.variants.find((p) => /\bsolo\b/.test(p.name.toLowerCase())) || null
                        : null);
            if (!picked)
                return false;
            if (cartContext) {
                session = this.removeCartLinesForVariantFamily(session, family, products);
            }
            session = {
                ...this.rememberProductFocus(session, picked, products),
                pendingMatch: undefined,
                pendingAttribute: undefined,
            };
            if (picked.hasAttributes && picked.attributes?.length) {
                const step = this.catalogService.resolveAttributesFromMessage(picked, text, []);
                if (step.status === 'complete') {
                    const added = this.tryAddProductToCart(session, picked, 1, cfg, undefined, step.attributes);
                    if (added.blocked) {
                        await this.conversationService.saveSession(conv, session);
                        await this.handleCartLimitBlocked(conv, waId, added.blocked, cfg);
                        return true;
                    }
                    session = added.session;
                    await this.conversationService.saveSession(conv, session, 'building_cart');
                    const chosen = step.attributes.map((a) => a.attributeValue).join(', ');
                    await this.reply(conv, waId, `${cartContext ? 'Listo, lo cambié 👍\n\n' : ''}` +
                        this.buildCartAddReply(session, cfg.defaultDeliveryFee, `${picked.name} (${chosen})`));
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
                await this.reply(conv, waId, `${cartContext ? 'Listo, vamos con *combo* 👍\n\n' : ''}` +
                    this.catalogService.formatProductOptionsPrompt(picked, step.status === 'partial' ? step.attributes : []));
                return true;
            }
            const added = this.tryAddProductToCart(session, picked, 1, cfg);
            if (added.blocked) {
                await this.conversationService.saveSession(conv, session);
                await this.handleCartLimitBlocked(conv, waId, added.blocked, cfg);
                return true;
            }
            session = added.session;
            await this.conversationService.saveSession(conv, session, 'building_cart');
            await this.reply(conv, waId, `${cartContext ? 'Listo, lo cambié 👍\n\n' : ''}` +
                this.buildCartAddReply(session, cfg.defaultDeliveryFee, picked.name));
            return true;
        }
        if (!product.hasAttributes || !product.attributes?.length)
            return false;
        if (cartContext) {
            session = this.removeCartLinesForProductId(session, product.id);
        }
        let step = this.catalogService.resolveAttributesFromMessage(product, text, [], hint ? { variantIntent: hint } : undefined);
        if (step.status === 'invalid' && hint) {
            step = this.catalogService.resolveAttributesFromMessage(product, hint === 'combo' ? 'en combo' : 'solo', [], { variantIntent: hint });
        }
        if (step.status === 'invalid')
            return false;
        session = {
            ...this.rememberProductFocus(session, product, products),
            pendingMatch: undefined,
        };
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
            await this.reply(conv, waId, `${cartContext ? 'Listo, lo cambié 👍\n\n' : ''}` +
                this.buildCartAddReply(session, cfg.defaultDeliveryFee, `${product.name} (${chosen})`));
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
        await this.reply(conv, waId, `${cartContext ? 'Listo, vamos con esa opción 👍\n\n' : ''}` +
            this.catalogService.formatProductOptionsPrompt(product, step.attributes, hint ? { variantIntent: hint } : undefined));
        return true;
    }
    async tryHandleProductCompositionQuestion(conv, waId, text, products, cfg, session) {
        if (!this.isProductCompositionQuestion(text))
            return false;
        const candidates = this.findProductsForCompositionQuestion(text, products, session);
        if (candidates.length > 1) {
            const family = this.catalogService.findProductVariantFamily(text, products, candidates);
            session = {
                ...session,
                pendingMatch: {
                    query: text,
                    candidates: family?.variants?.length ? family.variants : candidates,
                    intent: 'info',
                },
            };
            await this.conversationService.saveSession(conv, session, 'building_cart');
            let prompt;
            if (family?.variants?.length) {
                const rows = family.variants.map((p, i) => ({
                    index: i + 1,
                    label: this.catalogService.getVariantDisplayLabel(p.name, family.baseKey),
                    price: p.price,
                    code: p.code,
                }));
                prompt =
                    `Para contarte *con qué va ${family.baseLabel}*, ¿cuál variante?\n\n` +
                        `${this.catalogService.formatOptionsList(rows)}\n\n` +
                        `_Responde con el *número* y te muestro el detalle._`;
            }
            else {
                prompt = this.catalogService.formatProductChoicePrompt(text, candidates, {
                    intro: 'Hay *varias opciones*. ¿De cuál quieres el detalle?',
                });
            }
            await this.reply(conv, waId, prompt);
            return true;
        }
        const product = candidates[0] || null;
        if (product) {
            session = this.rememberProductFocus(session, product, products);
            await this.conversationService.saveSession(conv, session);
        }
        await this.reply(conv, waId, this.buildProductCompositionReply(text, product, cfg));
        return true;
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
    normalizeForMatch(text) {
        return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    isClearCartIntent(text) {
        if (this.isCancelIntent(text))
            return false;
        const t = this.normalizeForMatch(text);
        if (!t)
            return false;
        if (/^(reiniciar|empezar\s+de\s+nuevo|borrar\s+carrito|limpiar\s+carrito|vaciar\s+carrito|vaciar\s+pedido|borrar\s+pedido|borrar\s+todo|quitar\s+todo|limpiar\s+todo|vaciar\s+todo)$/.test(t)) {
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
    extractCartRemovalQuery(text) {
        const raw = text.trim();
        if (!raw || raw.length < 4)
            return null;
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
            if (!m?.[1])
                continue;
            let q = m[1]
                .replace(/\s+(por favor|porfa|gracias)[\s!.?]*$/i, '')
                .replace(/\s+(del carrito|en el carrito|de mi pedido|del pedido)$/i, '')
                .trim();
            q = q.replace(/^(el|la|los|las|un|una|unos|unas)\s+/i, '').trim();
            const qNorm = this.normalizeForMatch(q);
            if (qNorm.length < 3 || reject.has(qNorm))
                continue;
            if (/^(producto|plato|item|item)$/i.test(qNorm))
                continue;
            return q;
        }
        return null;
    }
    formatCartLineLabel(item) {
        const qty = Math.max(1, item.quantity || 1);
        const attrs = item.attributes?.length
            ? ` (${item.attributes.map((a) => a.attributeValue).join(', ')})`
            : '';
        const qtyLabel = qty > 1 ? ` ×${qty}` : '';
        return `*${item.name}*${qtyLabel}${attrs}`;
    }
    matchCartItemsForRemoval(query, session, products) {
        const q = this.normalizeForMatch(query);
        const cart = session.cart;
        if (!cart.length || !q)
            return { kind: 'none' };
        let hits = [];
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
            }
            else if (strong.length >= 2) {
                const ids = new Set(strong.map((x) => x.p.id));
                hits = cart.map((c, i) => (ids.has(c.productId) ? i : -1)).filter((i) => i >= 0);
            }
        }
        if (!hits.length)
            return { kind: 'none' };
        const groups = new Map();
        for (const i of hits) {
            const c = cart[i];
            const key = `${c.productId}|${JSON.stringify(c.attributes || [])}`;
            if (!groups.has(key))
                groups.set(key, []);
            groups.get(key).push(i);
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
    removeCartLines(session, indices) {
        const remove = new Set(indices);
        const removedProductIds = new Set(indices
            .map((i) => session.cart[i]?.productId)
            .filter((id) => id != null));
        const next = {
            ...session,
            cart: session.cart.filter((_, i) => !remove.has(i)),
            pendingCartRemoval: undefined,
        };
        if (next.pendingAttribute && removedProductIds.has(next.pendingAttribute.productId)) {
            next.pendingAttribute = undefined;
        }
        return next;
    }
    isAbandonPendingSelectionIntent(text) {
        const t = text.trim().toLowerCase();
        if (!t)
            return false;
        if (/^ya\s+no[\s!.?]*$/.test(t))
            return true;
        if (/^(no|nop|nel)[\s!.?]*$/.test(t))
            return true;
        if (/\b(no\s+lo\s+quiero|no\s+la\s+quiero|no\s+era\s+eso|no\s+es\s+eso|me\s+equivoqu[eé]|olvidalo|olvídalo|olvidate|olvídate|dejalo|d[eé]jalo|cancelalo|cancelala|canc[eé]lalo|quitalo|qu[ií]talo|sacalo|no\s+agregues|no\s+lo\s+agregues)\b/.test(t)) {
            return true;
        }
        if (/\b(cancelar\s+(eso|este|esta|el\s+producto|la\s+opci[oó]n)|que\s+lo\s+cancel|que\s+la\s+cancel)\b/.test(t)) {
            return true;
        }
        if (/\b(no\s+quiero\s+(?:eso|este|esta|el\s+producto|continuar|seguir))\b/.test(t)) {
            return true;
        }
        return false;
    }
    async tryAbandonPendingSelection(conv, waId, session, text, cfg) {
        if (!this.isAbandonPendingSelectionIntent(text))
            return false;
        if (!session.pendingAttribute && !session.pendingMatch)
            return false;
        const pa = session.pendingAttribute;
        let next = {
            ...session,
            pendingAttribute: undefined,
            pendingMatch: undefined,
            pendingCartRemoval: undefined,
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
        const suffix = next.cart.length > 0
            ? `\n\n${this.formatCartOnly(next, cfg.defaultDeliveryFee)}\n\n${this.formatContinueShoppingPrompt()}`
            : '\n\n¿Qué te gustaría pedir?';
        await this.reply(conv, waId, `Listo, lo dejamos pasar 👍${suffix}`);
        return true;
    }
    async tryHandleCartModification(conv, waId, session, text, products, cfg) {
        const trimmed = text.trim();
        if (session.pendingCartRemoval?.options.length) {
            const pick = /^[1-9]\d*$/.test(trimmed) ? parseInt(trimmed, 10) : null;
            if (pick && pick <= session.pendingCartRemoval.options.length) {
                const chosen = session.pendingCartRemoval.options[pick - 1];
                const removedLabel = chosen.label;
                session = this.removeCartLines(session, [chosen.cartIndex]);
                await this.conversationService.saveSession(conv, session, 'building_cart');
                if (!session.cart.length) {
                    await this.reply(conv, waId, `Listo, quité ${removedLabel}.\n\n🛒 Carrito vacío. ¿Qué te gustaría pedir?`);
                    return true;
                }
                await this.reply(conv, waId, `Listo, quité ${removedLabel}.\n\n${this.formatCartOnly(session, cfg.defaultDeliveryFee)}\n\n${this.formatContinueShoppingPrompt()}`);
                return true;
            }
        }
        if (await this.tryAbandonPendingSelection(conv, waId, session, text, cfg)) {
            return true;
        }
        if (this.isClearCartIntent(text)) {
            if (!session.cart.length &&
                !session.pendingAttribute &&
                !session.pendingMatch &&
                !session.pendingMultiOrder) {
                await this.reply(conv, waId, 'Tu carrito ya está vacío. ¿Qué te gustaría pedir?');
                return true;
            }
            await this.conversationService.resetOrderSession(conv, 'building_cart', {
                ignorePriorHistory: true,
            });
            await this.reply(conv, waId, 'Listo, *vaciamos el carrito* ✅ ¿Qué te gustaría pedir?');
            return true;
        }
        const removalQuery = this.extractCartRemovalQuery(text);
        if (!removalQuery)
            return false;
        if (!session.cart.length) {
            await this.reply(conv, waId, `No tienes nada en el carrito ahora. Si quieres pedir *${removalQuery}*, dime y te lo agrego.`);
            return true;
        }
        const match = this.matchCartItemsForRemoval(removalQuery, session, products);
        if (match.kind === 'none') {
            await this.reply(conv, waId, `No encontré *${removalQuery}* en tu carrito.\n\n${this.formatCartOnly(session, cfg.defaultDeliveryFee)}`);
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
            await this.reply(conv, waId, `Tienes varias opciones parecidas. ¿Cuál quitamos?\n\n${opts}\n\nRespóndeme con el *número*.`);
            return true;
        }
        session = this.removeCartLines(session, match.indices);
        await this.conversationService.saveSession(conv, session, 'building_cart');
        const count = match.indices.length;
        const removedNote = count > 1 ? ` (${count} unidades)` : '';
        if (!session.cart.length) {
            await this.reply(conv, waId, `Listo, quité ${match.label}${removedNote}.\n\n🛒 Carrito vacío. ¿Qué te gustaría pedir?`);
            return true;
        }
        await this.reply(conv, waId, `Listo, quité ${match.label}${removedNote}.\n\n${this.formatCartOnly(session, cfg.defaultDeliveryFee)}\n\n${this.formatContinueShoppingPrompt()}`);
        return true;
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
        return (/^(confirmar|confirmo|listo|listo pedido|finalizar|ok|dale)[\s!.?]*$/i.test(text.trim()) ||
            /\b(confirmar|confirmo|listo pedido|finalizar)\b/i.test(text.trim()));
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
        if (/\b(pollo|medio|cuarto|entero|porcion|porciones|sopa|bebida|gaseosa|limonada|arepa|papa|maduro|chorizo|alas|pechuga|combo|menudencia|arroz|bandeja|chino|paisa|ejecutivo|frito)\b/i.test(t)) {
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
            fulfillmentChosen: true,
            addressConfirmed: true,
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
    withDeliveryAddress(session, address) {
        const addr = this.normalizeDeliveryAddress(address || '');
        if (!addr)
            return session;
        const strong = this.isStrongExplicitAddress(addr) ||
            (this.isPlausibleDeliveryAddress(addr) && this.looksLikeAddress(addr));
        return {
            ...session,
            orderType: 'delivery',
            address: addr,
            fulfillmentChosen: true,
            addressConfirmed: strong || !!session.addressConfirmed,
        };
    }
    applyDeliveryHintFromMessage(session, text) {
        return this.withDeliveryAddress(session, this.extractDeliveryTail(text));
    }
    stripDeliveryAddressPreface(raw) {
        let t = (raw || '').trim();
        for (let i = 0; i < 3; i++) {
            const next = t
                .replace(/^(?:enviar|mandar|llevar|traer)\s+(?:a\s+)?domicilio\s+(?:a|en|para)\s+/i, '')
                .replace(/^domicilio\s+(?:a|en|para)\s+/i, '')
                .replace(/^(?:a|en|para)\s+domicilio\s+(?:a|en|para)\s+/i, '')
                .replace(/^domicilio\s+/i, '')
                .trim();
            if (next === t)
                break;
            t = next;
        }
        return t;
    }
    truncateAddressAfterContactClauses(raw) {
        let t = (raw || '').trim();
        if (!t)
            return t;
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
    normalizeDeliveryAddress(raw) {
        let t = (raw || '')
            .replace(/\s+/g, ' ')
            .replace(/^[\s,.-]+|[\s,.-]+$/g, '')
            .trim();
        t = this.truncateAddressAfterContactClauses(t);
        t = this.stripDeliveryAddressPreface(t);
        return t
            .replace(/^(?:a\s+)?(?:la|el|los|las|al)\s+/i, '')
            .replace(/^[\s,.-]+|[\s,.-]+$/g, '')
            .trim();
    }
    isPlausibleDeliveryAddress(text) {
        const t = text.trim();
        if (!t || t.length < 3)
            return false;
        if (this.isConfirmKeyword(t) || this.isGreetingKeyword(t))
            return false;
        if (this.isPickupIntent(t))
            return false;
        if (/^(contraentrega|efectivo|mercado\s*pago|humano)$/i.test(t))
            return false;
        if (this.looksLikeFoodNotAddress(t))
            return false;
        if (/\b(minutos?|mins?|horas?)\b/i.test(t) && !/\b(habitaci[oó]n|apto|apartamento|calle|carrera|barrio|torre)\b/i.test(t)) {
            return false;
        }
        if (/\b(habitaci[oó]n|apto?|apartamento|cuarto|suite|oficina|hostal|hotel|residencia)\b/i.test(t) &&
            /\d/.test(t)) {
            return true;
        }
        if (/\b(domicilio|la casa|mi casa|mi direccion|mi dirección|direccion|dirección)\b/i.test(t)) {
            return true;
        }
        if (this.looksLikeAddress(t))
            return true;
        return t.length >= 6 && /\d/.test(t);
    }
    isStrongExplicitAddress(text) {
        const t = this.normalizeDeliveryAddress(text);
        if (!t || this.looksLikeFoodNotAddress(t))
            return false;
        if (/\b(calle|carrera|cra|cll|av\.?|avenida|diag(?:onal)?|transversal|tv)\b/i.test(t) &&
            /\d/.test(t)) {
            return true;
        }
        if (/\b(habitaci[oó]n|apto?|apartamento|cuarto|suite|torre|bloque|conjunto)\b/i.test(t) &&
            /\d/.test(t) &&
            t.length >= 8) {
            return true;
        }
        if (/\bbarrio\b/i.test(t) && /\d/.test(t) && t.length >= 12)
            return true;
        return false;
    }
    looksLikeFoodNotAddress(text) {
        const t = text.trim().toLowerCase();
        if (/^(?:la\s+|el\s+)?(broaster|frito|frita|asado|asada|plancha|apanad[oa]|francesa|salada|yuca|arepa|gaseosa|combo|solo|medio|cuarto)s?\b/i.test(t)) {
            return true;
        }
        if (/\b(broaster|frito|asado|plancha|gaseosa|arepa|combo|mondongo|ajiaco|pechuga|costilla)\b/i.test(t) &&
            !/\b(calle|carrera|cra|cll|av|avenida|barrio|habitaci[oó]n|apto|apartamento|torre|#)\b/i.test(t)) {
            return true;
        }
        return false;
    }
    extractDeliveryTail(text) {
        const raw = (text || '').trim();
        if (!raw)
            return null;
        const tailPatterns = [
            { re: /\bpara\b\s+(.+)$/is },
            {
                re: /\b(?:enviar|mandar|llevar|traer)\s+a\s+domicilio\s+(?:a|en|para)\s+(.+)$/is,
            },
            { re: /\b(?:enviar|mandar|llevar|traer|domicilio)\s+(?:a|en|para)\s+(.+)$/is },
            { re: /\ben\b\s+(?:la\s+|el\s+)?((?:calle|carrera|cra|cll|av\.?|avenida|habitaci[oó]n|apto|apartamento|torre|barrio)\b.+)$/is },
            { re: /\ba la\b\s+(.+)$/is, requireStrong: true },
            { re: /\ben la\b\s+(.+)$/is, requireStrong: true },
        ];
        for (const { re, requireStrong } of tailPatterns) {
            const m = raw.match(re);
            if (!m?.[1])
                continue;
            const addr = this.normalizeDeliveryAddress(m[1]);
            if (!addr || !this.isPlausibleDeliveryAddress(addr))
                continue;
            if (requireStrong && !this.isStrongExplicitAddress(addr) && !this.looksLikeAddress(addr)) {
                continue;
            }
            if (this.looksLikeFoodNotAddress(addr))
                continue;
            return addr;
        }
        const inlinePatterns = [
            /\b(?:para|a|en)\s+(?:la\s+|el\s+)?(habitaci[oó]n\s*(?:n[°o]?\.?\s*)?\d{1,4}[a-z]?)\b/i,
            /\b(?:para|a|en)\s+(?:la\s+|el\s+)?((?:apto?|apartamento|cuarto|suite|oficina)\s*(?:n[°o]?\.?\s*)?\d{1,4}[a-z]?)\b/i,
            /\b(?:para|a|en)\s+(?:la\s+|el\s+)?((?:calle|carrera|cra|cll|av\.?|avenida)\s+\d[\w\s#\-.]{2,40})\b/i,
            /\b(habitaci[oó]n\s*(?:n[°o]?\.?\s*)?\d{1,4}[a-z]?)\b/i,
            /\b(?:apto?|apartamento|cuarto|suite|oficina)\s*(?:n[°o]?\.?\s*)?\d{1,4}[a-z]?\b/i,
            /\b(?:torre|bloque|piso|interior|local)\s+[a-z0-9#\-\s]{1,24}\d{1,4}[a-z]?\b/i,
        ];
        for (const pattern of inlinePatterns) {
            const m = raw.match(pattern);
            if (!m?.[0])
                continue;
            const addr = this.normalizeDeliveryAddress(m[1] || m[0]);
            if (addr && this.isPlausibleDeliveryAddress(addr) && !this.looksLikeFoodNotAddress(addr)) {
                return addr;
            }
        }
        return null;
    }
    splitProductAndDelivery(text) {
        const address = this.extractDeliveryTail(text);
        if (!address)
            return { productText: text.trim(), address: null };
        let productText = text.trim();
        const escaped = address.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        productText = productText
            .replace(new RegExp(`\\b(?:para|a|en)\\s+(?:la\\s+|el\\s+)?${escaped}\\s*$`, 'i'), '')
            .replace(new RegExp(`\\bpara\\b\\s+${escaped}\\s*$`, 'i'), '')
            .replace(/\s+/g, ' ')
            .trim();
        if (productText === text.trim() || productText.length < 3) {
            const m = text.match(/^(.*)\bpara\b\s+.+$/is);
            if (m?.[1]?.trim())
                productText = m[1].trim();
        }
        return { productText: productText || text.trim(), address };
    }
    parseCompoundOrderMessage(text) {
        let working = (text || '').trim();
        let phone = null;
        let customerName = null;
        let phoneUsesWhatsapp = false;
        const phoneRefPatterns = [
            /\b(?:mi\s+)?(?:cel(?:ular)?|tel\w*|whatsapp|wa|n[uú]mero)\s*(?:es|:)?\s*(?:este|el\s+de\s+(?:whatsapp|wa|aqu[ií])|este\s+n[uú]mero|el\s+mismo|el\s+que\s+(?:tengo|escribo|est[aá]\s+usando))\b/gi,
        ];
        for (const re of phoneRefPatterns) {
            if (!re.test(working))
                continue;
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
            if (!m?.[1] || !this.looksLikePhoneNumber(m[1]))
                continue;
            phone = this.normalizeContactPhone(m[1], '') || null;
            if (!phone)
                continue;
            working = working.replace(m[0], ' ').replace(/\s+/g, ' ').trim();
            break;
        }
        const namePatterns = [
            /\b(?:me\s+llamo|soy|mi\s+nombre\s+es|nombre\s*:)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s.'-]{1,60}?)(?=$|[.,;]|\b(?:para|cel|tel|whatsapp|direcci[oó]n|domicilio)\b)/i,
        ];
        for (const re of namePatterns) {
            const m = working.match(re);
            if (!m?.[1])
                continue;
            const name = m[1].replace(/\s+/g, ' ').trim();
            if (name.length >= 2 && name.split(' ').length <= 6 && !this.looksLikeAddress(name)) {
                customerName = name;
                working = working.replace(m[0], ' ').replace(/\s+/g, ' ').trim();
                break;
            }
        }
        const { productText, address } = this.splitProductAndDelivery(working);
        return { productText, address, phone, customerName, phoneUsesWhatsapp };
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
        if (t.length < 6)
            return false;
        if (this.isConfirmKeyword(t) || this.isGreetingKeyword(t))
            return false;
        if (this.isPickupIntent(t))
            return false;
        if (/^(contraentrega|efectivo|mercado\s*pago|humano)$/i.test(t))
            return false;
        if (/^📍/.test(text.trim()) || /\b-?\d{1,2}\.\d+\s*,\s*-?\d{1,3}\.\d+\b/.test(t))
            return true;
        if (/\b(habitaci[oó]n|apto?|apartamento|cuarto|suite|oficina|hostal|hotel|residencia)\b/i.test(t) &&
            /\d/.test(t)) {
            return true;
        }
        if (/\b(calle|carrera|cra|cll|av\.?|avenida|diag|diagonal|transversal|barrio|conjunto|apto|apartamento|torre|casa|mz|manzana|#)\b/i.test(t)) {
            return true;
        }
        return t.length >= 12 && /\d/.test(t) && !/\b(minutos?|mins?|horas?)\b/i.test(t);
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
            '\nEj: _platos y cubiertos_ / _sin cebolla_ / _timbre 302_ / _cambio de 50 mil_ / _traer vueltas de 20 mil_.\n' +
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
            /\b(cambio\s+de|billete|paga\s+con|vueltas?|devuelta|traer?\s+vueltas?|trae\s+vueltas?|traeme\s+vueltas?)\b/i,
            /\bsin\s+(cebolla|aj[ií]|sal|picante|huevo|queso|tomate)\b/i,
            /^(nota|notas?)[:\s]/i,
        ];
        return patterns.some((p) => p.test(t));
    }
    CASH_CHANGE_AMOUNT = String.raw `[\d.,]+(?:\s*(?:mil|k))?`;
    extractCashChangeFromText(text) {
        const t = text.trim();
        const patterns = [
            new RegExp(String.raw `(?:traer|trae|traeme|traiga|con)\s+vueltas?\s*(?:de\s*)?\$?\s*(${this.CASH_CHANGE_AMOUNT})`, 'i'),
            new RegExp(String.raw `(?:vueltas?|devuelta)\s*(?:de\s*)?\$?\s*(${this.CASH_CHANGE_AMOUNT})`, 'i'),
            new RegExp(String.raw `(?:cambio|billete|paga(?:s|r)?(?:\s+con)?)\s*(?:de\s*)?\$?\s*(${this.CASH_CHANGE_AMOUNT})`, 'i'),
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
    stripCashChangePhrases(text) {
        return text
            .replace(new RegExp(String.raw `(?:traer|trae|traeme|traiga|con)\s+vueltas?\s*(?:de\s*)?\$?\s*${this.CASH_CHANGE_AMOUNT}`, 'gi'), '')
            .replace(new RegExp(String.raw `(?:vueltas?|devuelta)\s*(?:de\s*)?\$?\s*${this.CASH_CHANGE_AMOUNT}`, 'gi'), '')
            .replace(new RegExp(String.raw `(?:cambio|billete|paga(?:s|r)?(?:\s+con)?)\s*(?:de\s*)?\$?\s*${this.CASH_CHANGE_AMOUNT}`, 'gi'), '')
            .replace(/\s+(por favor|porfa|pf|gracias)[\s!.?]*$/gi, '')
            .replace(/^[,.\s\-–—]+|[,.\s\-–—]+$/g, '')
            .trim();
    }
    applyInlineOrderNote(session, text) {
        const t = text.trim();
        const change = this.extractCashChangeFromText(t);
        let next = { ...session };
        if (change) {
            next.cashChangeFor = change;
        }
        const rest = this.stripCashChangePhrases(t);
        if (rest && !/^(ninguno|ninguna|no|nada)$/i.test(rest)) {
            next = this.appendCustomerNote(next, rest);
        }
        else if (!change) {
            next = this.appendCustomerNote(next, t);
        }
        return next;
    }
    formatInlineNoteAck(session) {
        const parts = [];
        if (session.cashChangeFor?.trim()) {
            parts.push(`Anotado 💵 _${session.cashChangeFor.trim()}_`);
        }
        if (session.customerNotes?.trim()) {
            parts.push(`Anotado 📝 _${session.customerNotes.trim()}_`);
        }
        return parts.join('\n') || 'Anotado ✅';
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
        const change = this.extractCashChangeFromText(t);
        if (change) {
            next.cashChangeFor = change;
        }
        else if (/^\d[\d.,\s]*(mil|k)?$/i.test(t) &&
            (session.paymentMethod === 'cash' || session.paymentMethod === 'contraentrega')) {
            next.cashChangeFor = `cambio de ${t}`;
        }
        const notesOnly = this.stripCashChangePhrases(t);
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
        const subtotal = session.cart.reduce((s, c) => s + c.unitPrice * Math.max(1, c.quantity || 1), 0);
        const fee = session.orderType === 'delivery' ? deliveryFee : 0;
        const total = subtotal + fee;
        const now = new Date().toLocaleString('es-CO', {
            timeZone: 'America/Bogota',
            dateStyle: 'medium',
            timeStyle: 'short',
        });
        const num = String(order.dailyOrderNumber ?? order.orderId ?? '').padStart(2, '0');
        const cart = this.consolidateCart(session.cart);
        const items = cart
            .map((c, i) => {
            const qty = Math.max(1, c.quantity || 1);
            const attrs = c.attributes?.length
                ? `\n   _${c.attributes.map((a) => a.attributeValue).join(', ')}_`
                : '';
            return (`*${i + 1}.* *${c.name}*\n` +
                `   Cant: *${qty}*  ·  $${Math.round(c.unitPrice * qty).toLocaleString('es-CO')}` +
                attrs);
        })
            .join('\n\n');
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
            `📞 ${this.formatWaPhoneDisplay(session.contactPhone || conv.phoneE164)}\n` +
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
        const variantIntent = this.catalogService.extractVariantPreferenceHint(text) || undefined;
        const attrOpts = variantIntent ? { variantIntent } : undefined;
        const step = this.catalogService.resolveAttributesFromMessage(product, text, [], attrOpts);
        const deliveryHint = this.extractDeliveryTail(text);
        if (step.status === 'complete') {
            const fresh = await this.conversationService.reloadConversation(conv.id);
            Object.assign(conv, fresh);
            session = this.conversationService.getSession(conv);
            if (deliveryHint) {
                session = this.withDeliveryAddress(session, deliveryHint);
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
            await this.reply(conv, waId, this.buildCartAddReply(session, cfg.defaultDeliveryFee, `${product.name} (${chosen})`));
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
            await this.reply(conv, waId, this.catalogService.formatProductOptionsPrompt(product, step.attributes, attrOpts));
            return true;
        }
        const mode = this.catalogService.isGenericProductInquiry(text) ||
            this.catalogService.shouldShowVariantsOverview(text, product)
            ? 'info'
            : 'order';
        if (deliveryHint) {
            session = this.withDeliveryAddress(session, deliveryHint);
        }
        session = {
            ...session,
            pendingAttribute: this.toPendingAttribute(product, { sourceText: text }),
            pendingMatch: undefined,
        };
        await this.conversationService.saveSession(conv, session, 'building_cart');
        await this.reply(conv, waId, this.catalogService.formatProductVariantsOverview(product, mode));
        return true;
    }
    async tryHandleProductInfoInquiry(conv, waId, text, products, cfg) {
        if (this.catalogService.isProductDescriptionInquiry(text))
            return false;
        if (!this.catalogService.isGenericProductInquiry(text))
            return false;
        const stripped = this.catalogService.stripPriceInquiryNoise(text);
        const query = this.catalogService.extractProductSearchQuery(stripped || text);
        const browseHit = this.catalogService.findCategoryBrowseHit(query, products, cfg.menuConceptGroups) ||
            this.catalogService.findCategoryBrowseHit(text, products, cfg.menuConceptGroups);
        if (browseHit?.products.length) {
            const list = browseHit.products.slice(0, 12);
            const session = this.conversationService.getSession(conv);
            await this.conversationService.saveSession(conv, {
                ...session,
                pendingMatch: { query: browseHit.categoryName, candidates: list },
            });
            await this.reply(conv, waId, this.catalogService.formatCategoryList(browseHit.categoryName, list));
            return true;
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
        const lines = ['📝 *Entendí varios platos en tu mensaje:*\n'];
        let idx = 1;
        for (const c of multi.confident) {
            lines.push(`${this.catalogService.optionNumberEmoji(idx)} ✅ *${c.product.name}*`);
            lines.push(`   ${this.catalogService.formatProductMeta(c.product.price, c.product.code)}`);
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
            lines.push(`\n🔸 *${item.product.name}*`, `   ${this.catalogService.formatProductMeta(item.product.price, item.product.code)}`, `   _Hay que elegir opciones después._`);
        }
        for (const miss of multi.unresolved) {
            lines.push(`\n⚠️ No encontré en el menú: _${miss}_`);
        }
        lines.push('\n_Si está bien lo que marqué ✅, escribe *sí*._', '_Si algo no cuadra, dime el plato correcto o el *número* de la opción dudosa._');
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
    async addPendingMultiConfidentToCart(conv, waId, session, cfg, products, sourceText) {
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
            const attrSource = [item.segment, sourceText].filter(Boolean).join(' ');
            const attrs = product.hasAttributes && product.attributes?.length
                ? this.catalogService.extractExplicitAttributeChoice(attrSource, product) || undefined
                : undefined;
            if (product.hasAttributes && product.attributes?.length && !attrs?.length) {
                next = {
                    ...next,
                    pendingMultiOrder: {
                        ...(next.pendingMultiOrder || pending),
                        confident: (next.pendingMultiOrder || pending).confident.filter((c) => c.productId !== product.id),
                        needsAttributes: [
                            ...((next.pendingMultiOrder || pending).needsAttributes || []),
                            { segment: item.segment, ...this.toPendingMultiProduct(product) },
                        ],
                    },
                };
                continue;
            }
            const attempt = this.tryAddProductToCart(next, product, 1, cfg, undefined, attrs);
            if (attempt.blocked) {
                return { session: next, addedNames, blocked: attempt.blocked };
            }
            next = attempt.session;
            const label = attrs?.length
                ? `${product.name} (${attrs.map((a) => a.attributeValue).join(', ')})`
                : product.name;
            addedNames.push(label);
        }
        return { session: next, addedNames };
    }
    async tryHandleMultiProductOrder(conv, waId, session, multi, cfg, text, products) {
        const deliveryTail = this.extractDeliveryTail(text);
        if (deliveryTail) {
            session = this.withDeliveryAddress(session, deliveryTail);
        }
        if (this.catalogService.looksLikeFoodPlusDrinkOrder(text) && multi.unresolved.length) {
            const stillUnresolved = [];
            for (const seg of multi.unresolved) {
                let foodProduct;
                const embedded = this.catalogService.findProductEmbeddedInMessage(seg, products);
                if (embedded && !this.catalogService.isLikelyDrinkProduct(embedded)) {
                    foodProduct = embedded;
                }
                if (!foodProduct) {
                    const queries = [seg, 'pollo broaster', 'broaster', 'pollo frito'].filter((q, i, arr) => arr.indexOf(q) === i);
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
                    }
                    else {
                        multi.needsAttributes.push(match);
                    }
                }
                else {
                    multi.confident.push(match);
                }
            }
            multi.unresolved = stillUnresolved;
        }
        const onlyNeedsAttrs = multi.needsAttributes.length > 0 &&
            multi.ambiguous.length === 0 &&
            multi.unresolved.length === 0;
        const drinkFirstFoodPending = this.catalogService.looksLikeFoodPlusDrinkOrder(text) &&
            multi.confident.length >= 1 &&
            multi.confident.every((c) => this.catalogService.isLikelyDrinkProduct(c.product)) &&
            (multi.needsAttributes.length > 0 || multi.unresolved.length > 0) &&
            multi.ambiguous.length === 0;
        const foodPlusDrinkAttrOpts = this.catalogService.looksLikeFoodPlusDrinkOrder(text)
            ? { variantIntent: 'solo' }
            : undefined;
        const needsConfirm = multi.ambiguous.length > 0 ||
            (multi.unresolved.length > 0 && !drinkFirstFoodPending);
        if ((!needsConfirm && multi.confident.length >= 2) || onlyNeedsAttrs || drinkFirstFoodPending) {
            session = {
                ...session,
                pendingMultiOrder: this.sessionFromMultiResolve(multi),
                pendingMatch: undefined,
            };
            const addResult = await this.addPendingMultiConfidentToCart(conv, waId, session, cfg, products, text);
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
                    const foodAttrText = foodPlusDrinkAttrOpts
                        ? first.segment
                        : `${first.segment} ${text}`;
                    const step = this.catalogService.resolveAttributesFromMessage(product, foodAttrText, [], foodPlusDrinkAttrOpts);
                    if (step.status === 'complete') {
                        const attempt = this.tryAddProductToCart(next, product, 1, cfg, undefined, step.attributes);
                        if (attempt.blocked) {
                            await this.conversationService.saveSession(conv, next);
                            await this.handleCartLimitBlocked(conv, waId, attempt.blocked, cfg);
                            return true;
                        }
                        next = {
                            ...attempt.session,
                            pendingMultiOrder: needsQueue.length > 1
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
                                const preText = foodPlusDrinkAttrOpts
                                    ? rest[0].segment
                                    : `${rest[0].segment} ${text}`;
                                const pre = this.catalogService.resolveAttributesFromMessage(nextProd, preText, [], foodPlusDrinkAttrOpts);
                                next = {
                                    ...next,
                                    pendingAttribute: {
                                        ...this.toPendingAttribute(nextProd, {
                                            sourceText: preText,
                                            variantIntent: foodPlusDrinkAttrOpts?.variantIntent,
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
                                await this.reply(conv, waId, `${this.buildCartAddReply(next, cfg.defaultDeliveryFee, [
                                    ...addResult.addedNames,
                                    `${product.name} (${chosen})`,
                                ], { suffix: '' })}\n\nAhora elige opciones para *${nextProd.name}*:\n\n` +
                                    this.catalogService.formatProductOptionsPrompt(nextProd, pre.status === 'partial' ? pre.attributes : [], foodPlusDrinkAttrOpts));
                                return true;
                            }
                        }
                        await this.conversationService.saveSession(conv, next, 'building_cart');
                        const chosen = step.attributes.map((a) => a.attributeValue).join(', ');
                        await this.reply(conv, waId, this.buildCartAddReply(next, cfg.defaultDeliveryFee, [
                            ...addResult.addedNames,
                            `${product.name} (${chosen})`,
                        ], {
                            extraLine: deliveryTail ? `\nDomicilio anotado: _${deliveryTail}_` : undefined,
                        }));
                        return true;
                    }
                    next = {
                        ...next,
                        pendingAttribute: {
                            ...this.toPendingAttribute(product, {
                                sourceText: foodAttrText,
                                variantIntent: foodPlusDrinkAttrOpts?.variantIntent,
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
                    const prefix = addResult.addedNames.length
                        ? this.buildCartAddReply(next, cfg.defaultDeliveryFee, addResult.addedNames, {
                            suffix: '',
                        }) + '\n\n'
                        : next.cart.length
                            ? `${this.formatCartOnly(next, cfg.defaultDeliveryFee)}\n\n`
                            : '';
                    await this.reply(conv, waId, `${prefix}Ahora elige opciones para *${product.name}*:\n\n` +
                        this.catalogService.formatProductOptionsPrompt(product, step.status === 'partial' ? step.attributes : [], foodPlusDrinkAttrOpts));
                    return true;
                }
            }
            await this.conversationService.saveSession(conv, { ...next, pendingMultiOrder: undefined }, 'building_cart');
            if (addResult.addedNames.length) {
                await this.reply(conv, waId, this.buildCartAddReply(next, cfg.defaultDeliveryFee, addResult.addedNames, {
                    extraLine: deliveryTail ? `\nDomicilio anotado: _${deliveryTail}_` : undefined,
                }));
            }
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
            const addResult = await this.addPendingMultiConfidentToCart(conv, waId, session, cfg, products, text);
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
                    const step = this.catalogService.resolveAttributesFromMessage(product, `${first.segment} ${text}`, []);
                    if (step.status === 'complete') {
                        const attempt = this.tryAddProductToCart(next, product, 1, cfg, undefined, step.attributes);
                        if (attempt.blocked) {
                            await this.conversationService.saveSession(conv, next);
                            await this.handleCartLimitBlocked(conv, waId, attempt.blocked, cfg);
                            return true;
                        }
                        next = this.popCompletedNeedsAttribute(attempt.session, product.id);
                        const nextNeeds = next.pendingMultiOrder?.needsAttributes?.[0];
                        const nextProduct = nextNeeds
                            ? products.find((p) => p.id === nextNeeds.productId)
                            : null;
                        if (nextProduct?.hasAttributes && nextNeeds) {
                            const pre = this.catalogService.resolveAttributesFromMessage(nextProduct, `${nextNeeds.segment} ${text}`, []);
                            next = {
                                ...next,
                                pendingAttribute: {
                                    ...this.toPendingAttribute(nextProduct, { sourceText: `${first.segment} ${text}` }),
                                    selected: pre.status === 'partial' ? pre.attributes : [],
                                },
                            };
                            await this.conversationService.saveSession(conv, next, 'awaiting_attribute');
                            const chosen = step.attributes.map((a) => a.attributeValue).join(', ');
                            await this.reply(conv, waId, `${this.buildCartAddReply(next, cfg.defaultDeliveryFee, [...addResult.addedNames, `${product.name} (${chosen})`], { suffix: '' })}\n\nAhora elige opciones para *${nextProduct.name}*:\n\n` +
                                this.catalogService.formatProductOptionsPrompt(nextProduct, pre.status === 'partial' ? pre.attributes : []));
                            return true;
                        }
                        await this.conversationService.saveSession(conv, next, 'building_cart');
                        const chosen = step.attributes.map((a) => a.attributeValue).join(', ');
                        await this.reply(conv, waId, this.buildCartAddReply(next, cfg.defaultDeliveryFee, [...addResult.addedNames, `${product.name} (${chosen})`]));
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
                        ? this.buildCartAddReply(next, cfg.defaultDeliveryFee, addResult.addedNames, {
                            suffix: '',
                        }) + '\n\n'
                        : next.cart.length
                            ? `${this.formatCartOnly(next, cfg.defaultDeliveryFee)}\n\n`
                            : '';
                    await this.reply(conv, waId, `${prefix}Ahora elige opciones para *${product.name}*:\n\n` +
                        this.catalogService.formatProductOptionsPrompt(product, step.status === 'partial' ? step.attributes : []));
                    return true;
                }
            }
            await this.conversationService.saveSession(conv, next, 'building_cart');
            if (addResult.addedNames.length > 0) {
                const pendingNote = next.pendingMultiOrder?.ambiguous.length || next.pendingMultiOrder?.unresolved.length
                    ? `\n\n${this.formatMultiOrderProposal({
                        segments: [],
                        confident: [],
                        ambiguous: next.pendingMultiOrder.ambiguous.map((a) => ({
                            segment: a.segment,
                            candidates: a.candidates,
                        })),
                        unresolved: next.pendingMultiOrder.unresolved,
                        needsAttributes: [],
                    })}`
                    : undefined;
                await this.reply(conv, waId, this.buildCartAddReply(next, cfg.defaultDeliveryFee, addResult.addedNames, {
                    suffix: pendingNote ?? this.formatContinueShoppingPrompt(),
                }));
            }
            else {
                await this.reply(conv, waId, `${this.formatCartOnly(next, cfg.defaultDeliveryFee)}\n\n${this.formatContinueShoppingPrompt()}`);
            }
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
    popCompletedNeedsAttribute(session, productId) {
        const pm = session.pendingMultiOrder;
        if (!pm?.needsAttributes?.length)
            return session;
        const idx = pm.needsAttributes.findIndex((n) => n.productId === productId);
        const nextNeeds = idx >= 0 ? pm.needsAttributes.filter((_, i) => i !== idx) : pm.needsAttributes.slice(1);
        if (nextNeeds.length === pm.needsAttributes.length)
            return session;
        return {
            ...session,
            pendingMultiOrder: {
                ...pm,
                needsAttributes: nextNeeds,
            },
        };
    }
    findNewProductOrderCandidate(text, products, excludeProductId) {
        const embedded = this.catalogService.findProductEmbeddedInMessage(text, products);
        if (embedded && embedded.id !== excludeProductId)
            return embedded;
        const query = this.catalogService.extractProductSearchQuery(text);
        const scored = this.mergeNameScores(this.catalogService.searchByNameScored(query, products, 6), query === text ? [] : this.catalogService.searchByNameScored(text, products, 6));
        const filtered = scored.filter((x) => x.p.id !== excludeProductId);
        if (!filtered.length)
            return null;
        if (filtered.length === 1 && filtered[0].score >= 55)
            return filtered[0].p;
        if (this.catalogService.isStrongProductMatch(filtered) && filtered[0].score >= 70) {
            return filtered[0].p;
        }
        return null;
    }
    async tryAddProductDuringPendingAttribute(conv, waId, session, text, products, cfg, pendingProduct) {
        const pa = session.pendingAttribute;
        if (!pa)
            return false;
        const candidate = this.findNewProductOrderCandidate(text, products, pendingProduct.id);
        if (!candidate)
            return false;
        if (candidate.hasAttributes && candidate.attributes?.length) {
            await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
            await this.reply(conv, waId, `Primero terminemos *${pendingProduct.name}* (falta elegir opciones). ` +
                `Después te ayudo con *${candidate.name}*.\n\n` +
                this.catalogService.formatProductOptionsPrompt(pendingProduct, pa.selected || []));
            return true;
        }
        if (candidate.availableNow === false) {
            await this.reply(conv, waId, `*${candidate.name}* no está disponible ahora. ` +
                `Primero elige las opciones de *${pendingProduct.name}*:\n\n` +
                this.catalogService.formatProductOptionsPrompt(pendingProduct, pa.selected || []));
            return true;
        }
        const fresh = await this.conversationService.reloadConversation(conv.id);
        Object.assign(conv, fresh);
        let liveSession = this.conversationService.getSession(conv);
        liveSession = this.applyDeliveryHintFromMessage({ ...liveSession, pendingAttribute: pa }, text);
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
        await this.reply(conv, waId, `${this.buildCartAddReply(nextSession, cfg.defaultDeliveryFee, candidate.name, {
            extraLine: nextSession.address?.trim()
                ? `\nDomicilio anotado: _${nextSession.address.trim()}_`
                : undefined,
            suffix: '',
        })}\n\n` +
            `Cuando quieras, sigue con las opciones de *${pendingProduct.name}*:\n\n` +
            this.catalogService.formatProductOptionsPrompt(pendingProduct, pa.selected || []));
        return true;
    }
    async tryHandlePointsFlow(conv, waId, session, text, cfg) {
        const linkedUserId = session.linkedUserId ?? null;
        const available = linkedUserId
            ? await this.pointsHandler.getAvailablePoints(linkedUserId)
            : null;
        const helpCtx = this.pointsHandler.buildHelpContext(cfg.websiteUrl, session.linkedUserName, available);
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
        const code = this.pointsHandler.extractPointCodeCandidate(text);
        if (code) {
            if (this.pointsHandler.isRegisterIntent(text) && !this.pointsHandler.isPremioApplyIntent(text)) {
                const reg = await this.pointsHandler.tryRegisterOnly(linkedUserId, code);
                if (reg.handled) {
                    await this.reply(conv, waId, reg.message);
                    return true;
                }
            }
            if (this.pointsHandler.isPremioApplyIntent(text) ||
                session.cart.length > 0 ||
                /\bpremio\b/i.test(text)) {
                const premio = await this.pointsHandler.validatePremioCode(code, linkedUserId);
                if (premio.ok) {
                    session = {
                        ...session,
                        pendingRedemptionCode: premio.code,
                        pendingRedemptionExpiresAt: premio.expiresAt?.toISOString() ?? null,
                    };
                    await this.conversationService.saveSession(conv, session);
                    const halfOk = this.pointsHandler.cartHasHalfChicken(session.cart);
                    await this.reply(conv, waId, `✅ ${(0, whatsapp_points_help_1.formatPremioAppliedNote)(premio.code, premio.expiresAt)}\n\n` +
                        (halfOk
                            ? 'Cuando termines tu pedido, escribe *confirmar* y el premio se aplicará.'
                            : (0, whatsapp_points_help_1.formatCartNeedsHalfChickenForPremio)()));
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
            }
            else if (this.pointsHandler.isRegisterIntent(text) || !session.cart.length) {
                await this.reply(conv, waId, this.pointsHandler.buildRegisterHelp(helpCtx));
                return true;
            }
        }
        if (this.pointsHandler.isRedeemIntent(text)) {
            if (!linkedUserId) {
                await this.reply(conv, waId, 'Para redimir puntos necesitas una cuenta web con el mismo celular de WhatsApp.\n\n' +
                    this.pointsHandler.buildOverviewMessage(helpCtx));
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
            await this.reply(conv, waId, `🎉 *Premio generado*\n\n` +
                `Código: \`${result.code}\`\n` +
                `Válido hasta: *${exp}*\n\n` +
                `Te quedan *${result.availableAfter}* punto(s).\n\n` +
                `Para usarlo: pide un *medio pollo* (cód. 2 o 5) y escribe:\n` +
                `_premio ${result.code}_\n\n` +
                `O envía el código cuando vayas a *confirmar* el pedido.`);
            return true;
        }
        if (this.pointsHandler.isBalanceIntent(text)) {
            if (linkedUserId && available != null) {
                await this.reply(conv, waId, `📊 Tienes *${available}* punto(s) disponible(s).\n\n` +
                    this.pointsHandler.buildRedeemHelp(available));
            }
            else {
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
        whatsapp_action_guard_service_1.WhatsappActionGuardService,
        whatsapp_points_service_1.WhatsappPointsService])
], WhatsappOrchestratorService);
//# sourceMappingURL=whatsapp-orchestrator.service.js.map