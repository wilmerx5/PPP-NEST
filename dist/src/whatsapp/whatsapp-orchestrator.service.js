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
const whatsapp_delivery_routing_service_1 = require("./whatsapp-delivery-routing.service");
const whatsapp_points_help_1 = require("./whatsapp-points-help");
const whatsapp_business_rules_1 = require("./whatsapp-business-rules");
const whatsapp_intent_1 = require("./whatsapp-intent");
const whatsapp_local_glossary_1 = require("./whatsapp-local-glossary");
const whatsapp_message_classify_1 = require("./whatsapp-message-classify");
const whatsapp_order_address_1 = require("./whatsapp-order-address");
const whatsapp_session_intents_1 = require("./whatsapp-session-intents");
const whatsapp_compound_parse_1 = require("./whatsapp-compound-parse");
const whatsapp_payment_methods_1 = require("./whatsapp-payment-methods");
const whatsapp_cart_limits_1 = require("./whatsapp-cart-limits");
const whatsapp_bot_resume_1 = require("./whatsapp-bot-resume");
const whatsapp_outbound_media_1 = require("./whatsapp-outbound-media");
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
    deliveryRouting;
    logger = new common_1.Logger(WhatsappOrchestratorService_1.name);
    inboundByWaId = new Map();
    constructor(settingsService, metaService, catalogService, aiService, conversationService, businessService, ordersService, paymentsService, actionGuard, pointsHandler, deliveryRouting) {
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
        this.deliveryRouting = deliveryRouting;
    }
    async handleIncoming(msg) {
        const key = (msg.waId || msg.phoneE164 || 'unknown').trim() || 'unknown';
        const prev = this.inboundByWaId.get(key) ?? Promise.resolve();
        const run = prev.then(() => this.handleIncomingUnlocked(msg), () => this.handleIncomingUnlocked(msg));
        this.inboundByWaId.set(key, run.then(() => undefined, () => undefined));
        await run;
    }
    async handleIncomingUnlocked(msg) {
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
        {
            const fresh = await this.conversationService.reloadConversation(conv.id);
            Object.assign(conv, fresh);
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
            await this.reply(conv, msg.waId, `Listo, anoté tu ubicación como domicilio ✅\n_${sessionLoc.address || addr}_${feeLine}`);
            if (feeResult.blocked) {
                await this.reply(conv, msg.waId, feeResult.blocked);
                return;
            }
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
        text = (0, whatsapp_local_glossary_1.applyLocalGlossary)(text);
        const originalText = text;
        const lower = text.toLowerCase();
        if ((0, whatsapp_intent_1.isHumanHandoffRequest)(text)) {
            await this.conversationService.setHumanTakeover(conv.id, true);
            const freshTakeover = await this.conversationService.reloadConversation(conv.id);
            Object.assign(conv, freshTakeover);
            await this.reply(conv, msg.waId, cfg.humanHandoffMessage ||
                'Dale, te paso con el equipo 🙋. Alguien te va a atender por aquí; puedes seguir escribiendo.');
            return;
        }
        let reopenedFreshOrder = false;
        if (conv.state === 'completed' || conv.state === 'closed') {
            if ((0, whatsapp_session_intents_1.isPostOrderFollowUpIntent)(originalText)) {
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
            await this.reply(conv, msg.waId, 'Listo, *vaciamos el carrito* ✅ ¿Qué te gustaría pedir?');
            return;
        }
        if (this.isCancelIntent(originalText)) {
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
        if (!session.paymentMethod) {
            const payInMsg = (0, whatsapp_payment_methods_1.findPaymentMethodByText)(originalText, cfg.paymentMethods);
            if (payInMsg) {
                session = { ...session, paymentMethod: payInMsg.id };
            }
        }
        if (compound.customerName && !(0, whatsapp_session_intents_1.isUsableWhatsappCustomerName)(conv.customerName || '')) {
            if ((0, whatsapp_session_intents_1.isUsableWhatsappCustomerName)(compound.customerName)) {
                await this.conversationService.updateCustomerName(conv, compound.customerName);
                const freshName = await this.conversationService.reloadConversation(conv.id);
                Object.assign(conv, freshName);
            }
        }
        else if (compound.customerName && !conv.customerName?.trim()) {
            if ((0, whatsapp_session_intents_1.isUsableWhatsappCustomerName)(compound.customerName)) {
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
        const products = cfg.ignoreBusinessHours
            ? productsRaw.map((p) => ({ ...p, availableNow: true }))
            : productsRaw;
        const inboundCount = await this.conversationService.countInboundMessages(conv.id);
        if (inboundCount <= 1) {
            if (this.isVagueOrderIntent(text)) {
                await this.replyFirstContactWelcome(conv, msg.waId, cfg);
                await this.reply(conv, msg.waId, this.buildAskWhatToOrderMessage(cfg));
                return;
            }
            await this.replyFirstContactWelcome(conv, msg.waId, cfg);
            if (this.isGreetingKeyword(text) || text.length < 2)
                return;
            const withoutGreeting = this.stripLeadingGreeting(text);
            if (withoutGreeting !== text && withoutGreeting.length >= 2) {
                text = withoutGreeting;
            }
        }
        {
            const fresh = await this.conversationService.reloadConversation(conv.id);
            Object.assign(conv, fresh);
            session = this.conversationService.getSession(conv);
        }
        const customerIntent = this.resolveCustomerIntent(originalText, session, products, cfg, compound);
        if (!(0, whatsapp_intent_1.looksLikeClearCartMessage)(originalText) &&
            !(0, whatsapp_intent_1.looksLikeNonAddressCommand)(originalText) &&
            !(0, whatsapp_intent_1.isNothingElseOrderIntent)(originalText) &&
            !this.isConfirmKeyword(originalText) &&
            customerIntent === 'address') {
            session = this.applyDeliveryHintFromMessage(session, originalText);
            if (!session.address?.trim() && compound.address) {
                session = this.withDeliveryAddress(session, compound.address);
            }
            if (session.address?.trim()) {
                await this.conversationService.saveSession(conv, session);
            }
        }
        if (await this.tryHandleInlineOrderNoteEarly(conv, msg.waId, session, originalText, customerIntent, cfg)) {
            return;
        }
        if ((this.isConfirmKeyword(originalText) || (0, whatsapp_intent_1.isNothingElseOrderIntent)(originalText)) &&
            session.cart.length > 0) {
            const fresh = await this.conversationService.reloadConversation(conv.id);
            Object.assign(conv, fresh);
            session = this.conversationService.getSession(conv);
            await this.tryConfirmOrder(conv, msg.waId, session);
            return;
        }
        if (await this.tryHandleAddressChange(conv, msg.waId, session, originalText, cfg)) {
            return;
        }
        if (await this.tryHandleAddressClarification(conv, msg.waId, session, originalText, cfg)) {
            return;
        }
        if (await this.tryHandleConfirmCurrentAddress(conv, msg.waId, session, originalText, cfg)) {
            return;
        }
        if (await this.tryAppendDeliveryAccessReference(conv, msg.waId, session, originalText, cfg)) {
            return;
        }
        if ((customerIntent === 'address' || (0, whatsapp_session_intents_1.isReuseLastAddressIntent)(originalText)) &&
            (await this.tryHandleAddressOnlyWhileBuildingCart(conv, msg.waId, session, originalText, compound, cfg))) {
            return;
        }
        if (await this.tryHandleCartModification(conv, msg.waId, session, text, products, cfg, originalText)) {
            return;
        }
        if (await this.tryHandlePointsFlow(conv, msg.waId, session, text, cfg)) {
            return;
        }
        if (await this.tryHandleCoverageInquiry(conv, msg.waId, session, originalText, cfg)) {
            return;
        }
        if (await this.tryHandleDeliveryEtaInquiry(conv, msg.waId, originalText, text, cfg)) {
            return;
        }
        if (await this.tryHandleComboAvailabilityQuestion(conv, msg.waId, session, text, products, cfg)) {
            return;
        }
        {
            const browseWhilePending = this.catalogService.isMenuExploreIntent(text, products) ||
                this.catalogService.isCategoryBrowseQuestion(text);
            if (browseWhilePending &&
                (session.pendingAttribute || session.pendingMatch || session.pendingMultiOrder)) {
                session = {
                    ...session,
                    pendingAttribute: undefined,
                    pendingMatch: undefined,
                    pendingMultiOrder: undefined,
                };
                await this.conversationService.saveSession(conv, session, 'building_cart');
            }
        }
        if (session.pendingAttribute || conv.state === 'awaiting_attribute') {
            if (await this.tryHandleCartModification(conv, msg.waId, session, text, products, cfg, originalText)) {
                return;
            }
            if (await this.tryAbandonPendingSelection(conv, msg.waId, session, text, cfg)) {
                return;
            }
            if (this.catalogService.isMixtoCompositionInquiry(text) ||
                this.catalogService.isProductDescriptionInquiry(text) ||
                this.catalogService.isComboMeaningInquiry(text)) {
                session = {
                    ...session,
                    pendingAttribute: undefined,
                    pendingMatch: undefined,
                };
                await this.conversationService.saveSession(conv, session, 'building_cart');
                if (await this.tryHandleMixtoCompositionInquiry(conv, msg.waId, session, text, products, cfg)) {
                    return;
                }
                if (await this.tryHandleProductCompositionQuestion(conv, msg.waId, text, products, cfg, session)) {
                    return;
                }
            }
            if (await this.tryHandleServingSizeChange(conv, msg.waId, session, text, products, cfg)) {
                return;
            }
            if (await this.tryHandleLargerPackInquiry(conv, msg.waId, session, text, products, cfg)) {
                return;
            }
            if (this.catalogService.isAvailabilityInquiry(text) ||
                this.catalogService.isProductDescriptionInquiry(text)) {
                if (await this.tryHandleProductCompositionQuestion(conv, msg.waId, text, products, cfg, session)) {
                    return;
                }
                if (await this.tryHandleProductInfoInquiry(conv, msg.waId, text, products, cfg)) {
                    return;
                }
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
                    const addQty = this.resolveAddQuantity(session, product, {
                        sourceText: pa.sourceText || text,
                    });
                    const added = this.tryAddProductToCart(session, product, addQty, cfg, undefined, step.attributes, attrOpts);
                    if (added.missingAttributes) {
                        session = this.buildPendingAttributeSession(session, product, added.missingAttributes, {
                            variantIntent: pa.variantIntent,
                            pendingMultiOrder: session.pendingMultiOrder,
                        });
                        await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
                        await this.reply(conv, msg.waId, this.catalogService.formatProductOptionsPrompt(product, added.missingAttributes, attrOpts));
                        return;
                    }
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
                        await this.reply(conv, msg.waId, `${this.buildCartAddReply(session, this.deliveryFeeFor(session, cfg), `${product.name} (${chosen})`, { suffix: '' })}\n\n` +
                            `Ahora elige opciones para *${nextProduct.name}*:\n\n` +
                            this.catalogService.formatProductOptionsPrompt(nextProduct, []));
                        return;
                    }
                    await this.conversationService.saveSession(conv, session, 'building_cart');
                    const chosen = step.attributes.map((a) => a.attributeValue).join(', ');
                    await this.reply(conv, msg.waId, this.buildCartAddReply(session, this.deliveryFeeFor(session, cfg), `${product.name} (${chosen})`));
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
                    this.catalogService.formatProductOptionsPrompt(product, pa.selected || [], attrOpts));
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
            if (await this.tryHandleCartModification(conv, msg.waId, session, text, products, cfg, originalText)) {
                return;
            }
            if (this.looksLikeAddress(text) ||
                this.looksLikePayment(text, cfg.paymentMethods) ||
                this.isPickupIntent(text) ||
                this.isDeliveryIntent(text) ||
                this.looksLikePhoneNumber(text)) {
                await this.reply(conv, msg.waId, 'Primero necesito tu *nombre completo* (ej. Juan Pérez).\n' +
                    'Después te pido la dirección de domicilio.');
                return;
            }
            if (!(0, whatsapp_session_intents_1.isUsableWhatsappCustomerName)(text)) {
                await this.reply(conv, msg.waId, 'Necesito tu *nombre real* para el pedido (ej. *Juan Pérez*).');
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
            await this.reply(conv, msg.waId, this.buildAskNameMessage(session, this.deliveryFeeFor(session, cfg)));
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
            session = {
                ...session,
                orderType: 'delivery',
                fulfillmentChosen: true,
            };
            const addrHint = this.extractDeliveryTail(text) ||
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
            if (await this.tryHandleCartModification(conv, msg.waId, session, text, products, cfg, originalText)) {
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
            if ((0, whatsapp_session_intents_1.isReuseLastAddressIntent)(text)) {
                const reuse = session.address?.trim() ||
                    session.lastDeliveryAddress?.trim() ||
                    '';
                if (reuse) {
                    session = this.withDeliveryAddress({
                        ...session,
                        orderType: 'delivery',
                        fulfillmentChosen: true,
                        addressConfirmed: true,
                    }, reuse);
                    const feeOk = await this.recalculateDeliveryFee(session, cfg);
                    session = feeOk.session;
                    await this.conversationService.saveSession(conv, session, 'building_cart');
                    if (feeOk.blocked) {
                        await this.reply(conv, msg.waId, `Dirección anotada: _${session.address}_\n\n${feeOk.blocked}`);
                        return;
                    }
                    const fresh = await this.conversationService.reloadConversation(conv.id);
                    Object.assign(conv, fresh);
                    session = this.conversationService.getSession(conv);
                    await this.tryConfirmOrder(conv, msg.waId, session, {
                        preface: `Dirección lista ✅ _${session.address}_` +
                            (feeOk.notice ? `\n${feeOk.notice}` : ''),
                    });
                    return;
                }
            }
            if (text.length >= 6) {
                const addrHint = this.extractDeliveryTail(text) || text.trim();
                if (!this.isPlausibleDeliveryAddress(addrHint)) {
                    await this.reply(conv, msg.waId, this.buildAskAddressMessage(session, this.deliveryFeeFor(session, cfg), true));
                    return;
                }
                session = this.withDeliveryAddress({ ...session, fulfillmentChosen: true }, addrHint);
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
                    await this.reply(conv, msg.waId, `Dirección anotada: _${session.address}_\n\n${feeOk.blocked}`);
                    return;
                }
                const fresh = await this.conversationService.reloadConversation(conv.id);
                Object.assign(conv, fresh);
                session = this.conversationService.getSession(conv);
                await this.tryConfirmOrder(conv, msg.waId, session, {
                    preface: `Dirección lista ✅ _${session.address}_` +
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
            if (await this.tryHandleCheckoutSideAdd(conv, msg.waId, session, text, products, cfg, 'phone')) {
                return;
            }
            const phoneHandled = await this.tryResolvePhoneConfirmation(conv, msg.waId, session, text, cfg);
            if (phoneHandled)
                return;
        }
        if (conv.state === 'awaiting_phone') {
            await this.reply(conv, msg.waId, this.buildAskPhoneMessage(conv, session, this.deliveryFeeFor(session, cfg)));
            return;
        }
        if (conv.state === 'awaiting_payment' && !isConfirm && !isGreeting) {
            if (await this.tryHandleCartModification(conv, msg.waId, session, text, products, cfg, originalText)) {
                return;
            }
            const payPick = this.resolvePaymentChoice(text, cfg);
            if (payPick) {
                session.paymentMethod = payPick.id;
                session.notesCollected = true;
                await this.conversationService.saveSession(conv, session, 'confirming');
                const confirmExtra = this.buildPaymentConfirmReply(payPick, cfg);
                session = this.conversationService.getSession(conv);
                await this.tryConfirmOrder(conv, msg.waId, session, {
                    preface: confirmExtra || undefined,
                });
                return;
            }
        }
        if (conv.state === 'awaiting_payment') {
            await this.reply(conv, msg.waId, (0, whatsapp_payment_methods_1.buildPaymentOptionsPrompt)(cfg.paymentMethods, cfg.paymentInstructions));
            return;
        }
        if (conv.state === 'awaiting_notes' && !isConfirm && !isGreeting) {
            if (await this.tryHandleCartModification(conv, msg.waId, session, text, products, cfg, originalText)) {
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
        if (isConfirm && session.cart.length > 0) {
            const fresh = await this.conversationService.reloadConversation(conv.id);
            Object.assign(conv, fresh);
            session = this.conversationService.getSession(conv);
            await this.tryConfirmOrder(conv, msg.waId, session);
            return;
        }
        if (isGreeting || this.isMenuLinkIntent(text)) {
            if (this.isMenuLinkIntent(text)) {
                await this.reply(conv, msg.waId, cfg.menuLinkMessage);
                return;
            }
            if (session.cart.length > 0) {
                await this.reply(conv, msg.waId, `¡Hola! 👋 Sigues con tu pedido:\n\n` +
                    `${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}\n\n` +
                    this.formatContinueShoppingPrompt());
                return;
            }
            await this.reply(conv, msg.waId, this.buildWelcomeMessage(cfg));
            return;
        }
        {
            const withoutGreeting = this.stripLeadingGreeting(text);
            if (withoutGreeting !== text &&
                withoutGreeting.length >= 2 &&
                !this.isGreetingKeyword(text)) {
                await this.reply(conv, msg.waId, this.buildWelcomeMessage(cfg));
                text = withoutGreeting;
            }
        }
        if (this.catalogService.isCourtesyOnlyMessage(text)) {
            if (session.cart.length > 0 && this.isConfirmKeyword(text)) {
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
            await this.reply(conv, msg.waId, this.buildAskWhatToOrderMessage(cfg));
            return;
        }
        if (await this.tryHandleMixtoCompositionInquiry(conv, msg.waId, session, text, products, cfg)) {
            return;
        }
        if (await this.tryHandleProductCompositionQuestion(conv, msg.waId, text, products, cfg, session)) {
            return;
        }
        if (await this.tryResolvePendingCompositionAsk(conv, msg.waId, session, text, products, cfg)) {
            return;
        }
        if (this.catalogService.isExternalMarketplaceOrderMessage(text)) {
            await this.reply(conv, msg.waId, 'Ese pedido por *Rappi/Uber* no lo podemos cambiar desde este WhatsApp 🙏\n' +
                'Para cambios de sabor/gaseosa toca el chat del domicilio en la app, o escribe *ASESOR* y te ayudamos por aquí con un pedido nuevo.');
            return;
        }
        if (this.catalogService.isOffTopicChitchat(text)) {
            await this.reply(conv, msg.waId, this.catalogService.formatOffTopicRedirect(cfg.brandName || cfg.localContext?.restaurantName || undefined));
            return;
        }
        if (this.catalogService.isRestaurantLocationInquiry(text)) {
            await this.reply(conv, msg.waId, this.formatRestaurantLocationReply(cfg));
            return;
        }
        const browseAsk = this.catalogService.isMenuExploreIntent(text, products) ||
            this.catalogService.isCategoryBrowseQuestion(text);
        if (browseAsk) {
            session = {
                ...session,
                pendingMatch: undefined,
                pendingMultiOrder: undefined,
                pendingAttribute: undefined,
            };
            const hit = this.catalogService.findCategoryBrowseHit(text, products, cfg.menuConceptGroups);
            const specificCue = /\b(carne|carnes|pollo|pollos|sopa|sopas|bebida|bebidas|gaseosa|jugo|jugos|limonada|arroz|bandeja|pescado|mojarra|frito|broaster|ejecutivo)\b/i.test(text);
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
        if (await this.tryAbandonPendingSelection(conv, msg.waId, session, text, cfg)) {
            return;
        }
        if (await this.tryHandleAddressChange(conv, msg.waId, session, text, cfg)) {
            return;
        }
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
        if (await this.tryHandlePendingAddOffer(conv, msg.waId, session, text, products, cfg)) {
            return;
        }
        if (await this.tryHandlePaymentCapabilityQuestion(conv, msg.waId, session, text, cfg)) {
            return;
        }
        if (session.pendingCategoryBrowse?.categories?.length) {
            const qtyHere = this.catalogService.extractQuantityFromMessage(text);
            const looksLikeFoodOrder = qtyHere >= 2 ||
                (/\b(quiero|dame|ponme|agrega)\b/i.test(text) &&
                    /\b(mojarra|pollo|sopa|pechuga|bandeja|alitas?|arepa|broaster|frito)\b/i.test(text));
            const pickedCategory = looksLikeFoodOrder
                ? null
                : this.catalogService.resolveCategoryBrowsePick(text, session.pendingCategoryBrowse.categories);
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
            if (looksLikeFoodOrder) {
                session = { ...session, pendingCategoryBrowse: undefined };
            }
        }
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
            const earlyScored = this.catalogService.searchByNameScored(this.catalogService.stripQuantityFromSearchQuery(qCheck) || qCheck, products, 5);
            const looksSpecificDish = significant.length >= 2 ||
                (significant.length === 1 &&
                    (this.catalogService.isStrongProductMatch(earlyScored) ||
                        earlyScored[0]?.score >= 40));
            const hasConcreteProduct = earlyQty >= 2 ||
                (looksSpecificDish &&
                    (this.catalogService.isStrongProductMatch(earlyScored) ||
                        earlyScored[0]?.score >= 40 ||
                        !!this.catalogService.findProductEmbeddedInMessage(text, products)));
            if (!hasConcreteProduct) {
                const categorySwitch = await this.tryHandleCategoryBrowse(conv, msg.waId, session, products, text, cfg.menuConceptGroups);
                if (categorySwitch === null)
                    return;
                session = categorySwitch;
            }
        }
        if (this.isPickupIntent(text)) {
            session = this.applyPickupIntent(session, text);
            await this.conversationService.saveSession(conv, session, 'building_cart');
            if (session.cart.length > 0) {
                await this.reply(conv, msg.waId, `Listo, queda como *recoger en el local* (sin domicilio).\n_${session.address}_`);
                const fresh = await this.conversationService.reloadConversation(conv.id);
                Object.assign(conv, fresh);
                session = this.conversationService.getSession(conv);
                await this.tryConfirmOrder(conv, msg.waId, session);
            }
            else {
                await this.reply(conv, msg.waId, `Dale, queda como *recoger en el local*.\n\n` +
                    `¿Qué se te antoja? Puedes pedir por *nombre* o *código*, o escribe *menú*.`);
            }
            return;
        }
        if (await this.tryHandleDeliverySetup(conv, msg.waId, session, originalText, text, cfg)) {
            return;
        }
        if (session.cart.length === 0 &&
            this.isPhoneOnlyCustomerMessage(originalText) &&
            !this.isConfirmKeyword(text)) {
            const digits = (originalText || text).replace(/\D/g, '');
            const normalized = this.normalizeContactPhone(originalText || text, conv.phoneE164) ||
                (digits.length >= 10 ? `+57${digits.slice(-10)}` : null);
            if (normalized) {
                session = {
                    ...session,
                    contactPhone: normalized,
                    phoneConfirmed: true,
                };
                await this.conversationService.saveSession(conv, session, 'building_cart');
                await this.reply(conv, msg.waId, `Listo, anoté el celular *${this.formatWaPhoneDisplay(normalized)}* ✅\n\n` +
                    `¿Qué se te antoja pedir? Puedes decir el *nombre* del plato o el *código*, o escribe *menú*.`);
                return;
            }
        }
        if (session.cart.length > 0 &&
            this.isPhoneOnlyCustomerMessage(originalText) &&
            !this.isConfirmKeyword(text)) {
            const digits = (originalText || text).replace(/\D/g, '');
            const normalized = this.normalizeContactPhone(originalText || text, conv.phoneE164) ||
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
        {
            const classified = await this.tryApplyAiClassify(conv, msg.waId, session, text, originalText, cfg);
            if (classified.handled)
                return;
            if (classified.text && classified.text !== text) {
                text = classified.text;
            }
            if (classified.session) {
                session = classified.session;
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
            if (session.cart.length === 0) {
                await this.conversationService.saveSession(conv, session, 'building_cart');
                await this.reply(conv, msg.waId, this.formatDeliverySetupEmptyCartReply());
                return;
            }
            await this.conversationService.saveSession(conv, session);
            if (!session.address?.trim()) {
                await this.conversationService.saveSession(conv, session, 'awaiting_address');
                await this.reply(conv, msg.waId, `Con gusto, voy a tomar tu pedido a *domicilio*.\n\n` +
                    this.buildAskAddressMessage(session, this.deliveryFeeFor(session, cfg)));
                return;
            }
            if (session.address?.trim() && !session.addressConfirmed) {
                await this.conversationService.saveSession(conv, session, 'awaiting_address');
                await this.reply(conv, msg.waId, this.buildAskAddressMessage(session, this.deliveryFeeFor(session, cfg)));
                return;
            }
            await this.reply(conv, msg.waId, 'Con gusto, voy a tomar tu pedido a *domicilio*.');
            return;
        }
        const codeRaw = this.catalogService.extractCodeFromMessage(text);
        const bareSingleDigit = /^\d$/.test(text.trim());
        const code = codeRaw != null &&
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
            /\b(pollos?|sopas?|bandejas?|platos?|unidades?|combos?|gaseosas?|broaster|fritos?|mojarras?|pechugas?|alitas?|arepas?|carnes?|ejecutivos?|churrascos?)\b/i.test(text);
        const codeMatchesPendingCandidate = code != null &&
            !!session.pendingMatch?.candidates?.some((c) => Number(c.code) === code);
        const codeOutsideListRange = code != null &&
            !!session.pendingMatch?.candidates?.length &&
            code > session.pendingMatch.candidates.length;
        const allowCodeDespiteList = !hasPendingList ||
            codeMatchesPendingCandidate ||
            codeOutsideListRange ||
            (!!session.pendingMatch?.candidates?.length &&
                listPick != null &&
                listPick > session.pendingMatch.candidates.length);
        const codeLooksLikeStreetAddress = (0, whatsapp_intent_1.looksLikeAddressOnlyMessage)(text) ||
            (0, whatsapp_intent_1.looksLikeAddressOnlyMessage)(originalText) ||
            this.isAddressOnlyCustomerMessage(originalText) ||
            this.isAddressOnlyCustomerMessage(text);
        if (code != null &&
            !pendingListIndex &&
            allowCodeDespiteList &&
            !qtyLooksLikeOrder &&
            !codeLooksLikeStreetAddress) {
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
                const added = this.tryAddProductToCart(session, found, 1, cfg, undefined, undefined, {
                    sourceText: text,
                });
                if (added.blocked) {
                    await this.conversationService.saveSession(conv, session);
                    await this.handleCartLimitBlocked(conv, msg.waId, added.blocked, cfg);
                    return;
                }
                if (added.alreadyHad) {
                    await this.conversationService.saveSession(conv, session, 'building_cart');
                    await this.reply(conv, msg.waId, `Listo, dejamos *${found.name}* como está ✅\n\n` +
                        `${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}\n\n` +
                        this.formatContinueShoppingPrompt());
                    return;
                }
                session = added.session;
                await this.conversationService.saveSession(conv, { ...session, pendingMatch: undefined }, 'building_cart');
                const desc = found.description ? `\n_${found.description}_` : '';
                const addrLine = session.address?.trim()
                    ? `\nDomicilio anotado: _${session.address.trim()}_`
                    : '';
                await this.reply(conv, msg.waId, this.buildCartAddReply(session, this.deliveryFeeFor(session, cfg), found.name, {
                    extraLine: [desc || undefined, addrLine || undefined].filter(Boolean).join('') || undefined,
                }));
                return;
            }
            await this.reply(conv, msg.waId, `No hallé un producto activo con código *${code}*. ¿Lo buscamos por nombre?`);
            return;
        }
        if (this.isConfirmKeyword(text)) {
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
            const applied = this.applyInlineOrderNote(session, text);
            session = applied.session;
            await this.conversationService.saveSession(conv, session);
            const ack = this.formatInlineNoteAck(session, applied.notedItemIndex);
            await this.reply(conv, msg.waId, `${ack}\n\n${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}\n\n${this.formatContinueShoppingPrompt()}`);
            return;
        }
        if (await this.tryHandlePaymentCapabilityQuestion(conv, msg.waId, session, text, cfg)) {
            return;
        }
        if (!(0, whatsapp_payment_methods_1.isPaymentCapabilityQuestion)(text) &&
            (/\b(contraentrega|efectivo|cash|transferencia|nequi|daviplata|llave|mercadopago|mercado\s*pago)\b/.test(lower) ||
                (0, whatsapp_payment_methods_1.findPaymentMethodByText)(text, cfg.paymentMethods))) {
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
            this.catalogService.isComboMeaningInquiry(text) &&
            (await this.tryHandleComboExplanation(conv, msg.waId, session, text, products))) {
            return;
        }
        if (!session.pendingAttribute &&
            !session.pendingMultiOrder &&
            (await this.tryHandleProductInfoInquiry(conv, msg.waId, text, products, cfg))) {
            return;
        }
        if ((0, whatsapp_intent_1.isUpcomingAddressIntent)(text) || (0, whatsapp_intent_1.isUpcomingAddressIntent)(originalText || text)) {
            if (await this.tryHandleUpcomingAddressIntent(conv, msg.waId, session, text, cfg)) {
                return;
            }
        }
        if (!session.pendingMatch &&
            !session.pendingAttribute &&
            !session.pendingMultiOrder &&
            (await this.tryPreferChickenComboForFoodDrink(conv, msg.waId, session, text, products, cfg))) {
            return;
        }
        if (!session.pendingMatch && !session.pendingAttribute && !session.pendingMultiOrder) {
            const multi = this.catalogService.resolveMultiProductOrder(originalText || text, products);
            if (multi) {
                const handled = await this.tryHandleMultiProductOrder(conv, msg.waId, session, multi, cfg, text, products, originalText);
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
        if (!session.pendingMatch &&
            !session.pendingMultiOrder &&
            (await this.tryHandleServingSizeChange(conv, msg.waId, session, text, products, cfg))) {
            return;
        }
        if ((await this.tryHandleLargerPackInquiry(conv, msg.waId, session, text, products, cfg))) {
            return;
        }
        let orderQty = this.resolveOrderQuantity(session, text);
        if (orderQty >= 2) {
            session = this.rememberQuantityHint(session, text, orderQty);
        }
        const embeddedProduct = this.catalogService.findProductEmbeddedInMessage(text, products) ||
            this.catalogService.resolveSizedChickenProduct(text, products);
        if (embeddedProduct &&
            !this.catalogService.isLikelySideOnlyProduct(embeddedProduct) &&
            !this.catalogService.isProductDescriptionInquiry(text) &&
            !this.catalogService.isPriceInquiryIntent(text) &&
            !this.catalogService.isAvailabilityInquiry(text) &&
            !this.catalogService.isGenericProductInquiry(text) &&
            !this.catalogService.isServingSizeChangeIntent(text) &&
            !this.catalogService.isLargerPackInquiry(text) &&
            !this.catalogService.isExternalMarketplaceOrderMessage(text) &&
            !(0, whatsapp_intent_1.looksLikeExplicitCartItemNote)(text) &&
            !this.looksLikeStandaloneOrderNote(text) &&
            !this.catalogService.isCategoryBrowseQuestion(text) &&
            !this.catalogService.isMenuExploreIntent(text, products) &&
            !session.pendingMatch &&
            !session.pendingAttribute &&
            !(this.catalogService.looksLikeFoodPlusDrinkOrder(text) &&
                this.catalogService.isLikelyDrinkProduct(embeddedProduct)) &&
            !this.catalogService.looksLikeMultiItemOrderMessage(text) &&
            !this.catalogService.looksLikeClearlyMultiDishOrder(text)) {
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
            if (embeddedProduct.hasAttributes && embeddedProduct.attributes?.length) {
                if (await this.handleProductWithVariants(conv, msg.waId, session, embeddedProduct, text, cfg)) {
                    return;
                }
            }
            const lineNote = this.catalogService.extractProductModificationNote(text) || undefined;
            const embeddedAdd = this.tryAddProductToCart(session, embeddedProduct, orderQty, cfg, lineNote, undefined, { sourceText: text });
            if (embeddedAdd.blocked) {
                await this.conversationService.saveSession(conv, session);
                await this.handleCartLimitBlocked(conv, msg.waId, embeddedAdd.blocked, cfg);
                return;
            }
            if (embeddedAdd.alreadyHad) {
                await this.conversationService.saveSession(conv, session, 'building_cart');
                await this.reply(conv, msg.waId, `Listo, dejamos *${embeddedProduct.name}* como está ✅\n\n` +
                    `${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}\n\n` +
                    this.formatContinueShoppingPrompt());
                return;
            }
            session = this.clearQuantityHint(embeddedAdd.session);
            await this.conversationService.saveSession(conv, session, 'building_cart');
            const qtyNote = orderQty > 1 ? ` _(x${orderQty})_` : '';
            await this.reply(conv, msg.waId, this.buildCartAddReply(session, this.deliveryFeeFor(session, cfg), `${embeddedProduct.name}${qtyNote}`, {
                extraLine: [
                    lineNote ? `📝 _${lineNote}_` : '',
                    embeddedProduct.description && !lineNote ? `_${embeddedProduct.description}_` : '',
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
        const productQueryStrippedMods = this.catalogService.stripProductModificationNoise(productQueryRaw) || productQueryRaw;
        const productQuery = orderQty > 1
            ? this.catalogService.stripQuantityFromSearchQuery(productQueryStrippedMods) ||
                productQueryStrippedMods
            : productQueryStrippedMods;
        let nameScored = this.mergeNameScores(this.catalogService.searchByNameScored(productQuery, products, 8), productQuery === text
            ? []
            : this.catalogService.searchByNameScored(text, products, 8));
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
            !this.catalogService.isPriceInquiryIntent(text) &&
            !this.catalogService.isGenericProductInquiry(text) &&
            !(0, whatsapp_intent_1.looksLikeExplicitCartItemNote)(text) &&
            !this.looksLikeStandaloneOrderNote(text) &&
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
                        pendingQuantityHint: { quantity: orderQty, query: productQuery || text },
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
                        pendingQuantityHint: { quantity: orderQty, query: productQuery || text },
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
            !this.catalogService.isPriceInquiryIntent(text) &&
            !this.catalogService.isAvailabilityInquiry(text) &&
            !this.catalogService.isGenericProductInquiry(text) &&
            !this.catalogService.isServingSizeChangeIntent(text) &&
            !this.catalogService.isLargerPackInquiry(text) &&
            !this.catalogService.isExternalMarketplaceOrderMessage(text) &&
            !(0, whatsapp_intent_1.looksLikeExplicitCartItemNote)(text) &&
            !this.looksLikeStandaloneOrderNote(text) &&
            !this.catalogService.isCategoryBrowseQuestion(text) &&
            !this.catalogService.isMenuExploreIntent(text, products) &&
            !session.pendingMatch &&
            !session.pendingAttribute) {
            const one = resolvedMatches[0];
            if (this.catalogService.looksLikeFoodPlusDrinkOrder(text) &&
                this.catalogService.isLikelyDrinkProduct(one)) {
                const multiRetry = this.catalogService.resolveMultiProductOrder(text, products);
                if (multiRetry) {
                    const handledMulti = await this.tryHandleMultiProductOrder(conv, msg.waId, session, multiRetry, cfg, text, products, originalText);
                    if (handledMulti)
                        return;
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
                await this.reply(conv, msg.waId, `Listo, dejamos *${one.name}* como está ✅\n\n` +
                    `${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}\n\n` +
                    this.formatContinueShoppingPrompt());
                return;
            }
            session = this.clearQuantityHint(added.session);
            await this.conversationService.saveSession(conv, session, 'building_cart');
            const qtyNote = orderQty > 1 ? ` _(x${orderQty})_` : '';
            await this.reply(conv, msg.waId, this.buildCartAddReply(session, this.deliveryFeeFor(session, cfg), `${one.name}${qtyNote}`, {
                extraLine: [
                    lineNote ? `📝 _${lineNote}_` : '',
                    one.description && !lineNote ? `_${one.description}_` : '',
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
                    const handledMulti = await this.tryHandleMultiProductOrder(conv, msg.waId, session, multiRetry, cfg, text, products, originalText);
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
                    ...(orderQty > 1
                        ? { pendingQuantityHint: { quantity: orderQty, query: productQuery || text } }
                        : {}),
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
            if (orderQty > 1) {
                session.pendingQuantityHint = { quantity: orderQty, query: productQuery || text };
            }
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
        const detectedIntent = this.resolveCustomerIntent(originalText || text, session, products, cfg, this.parseCompoundOrderMessage(originalText || text));
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
            (0, whatsapp_intent_1.formatIntentHintForAi)(detectedIntent),
            (0, whatsapp_local_glossary_1.buildLocalGlossaryPromptBlock)(),
        ]
            .filter(Boolean)
            .join(' ');
        const rulesBlock = (0, whatsapp_business_rules_1.buildWhatsappBusinessRulesBlock)({
            brandName: cfg.brandName || cfg.localContext?.restaurantName || 'Pronto Pollo Portal',
            businessStatus: businessOpenForBot ? { ...status, isOpen: true } : status,
            deliveryFee: this.deliveryFeeFor(session, cfg),
            deliveryFeeTiersBlock: cfg.deliveryFeeTiersPrompt,
            allowMercadoPago: !!cfg.allowMercadoPago,
            menuProductCount: products.filter((p) => p.availableNow !== false).length,
            localContextBlock: cfg.localContextBlock,
            orderLimitsBlock: (0, whatsapp_cart_limits_1.buildOrderLimitsPromptBlock)(this.toCartLimitsConfig(cfg, session)),
            paymentMethods: cfg.paymentMethods,
        });
        const ai = await this.aiService.generateTurn({
            userMessage: text,
            businessRulesBlock: rulesBlock,
            menuDetailedText: menuForAi,
            sessionSummary: this.buildSessionSummary(conv, session, this.deliveryFeeFor(session, cfg)),
            recentMessages: recent,
            customerHint,
            conversational: exploringMenu ||
                detectedIntent === 'chitchat' ||
                detectedIntent === 'menu_question',
            detectedIntent,
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
            exploringMenu ||
            !(0, whatsapp_intent_1.intentAllowsAddItems)(detectedIntent)) &&
            guarded.actions) {
            delete guarded.actions.addItems;
            if (detectedIntent === 'price_question' ||
                detectedIntent === 'menu_question' ||
                detectedIntent === 'chitchat' ||
                detectedIntent === 'clear_cart' ||
                detectedIntent === 'side_note' ||
                exploringMenu) {
                delete guarded.actions.setAddress;
                delete guarded.actions.setPaymentMethod;
            }
        }
        if ((0, whatsapp_intent_1.looksLikeClearCartMessage)(originalText || text) &&
            guarded.actions) {
            guarded.actions.clearCart = true;
            delete guarded.actions.setAddress;
            delete guarded.actions.addItems;
        }
        if (((0, whatsapp_intent_1.isNothingElseOrderIntent)(originalText || text) ||
            this.isConfirmKeyword(originalText || text) ||
            (0, whatsapp_session_intents_1.isConfirmCurrentAddressIntent)(originalText || text)) &&
            guarded.actions) {
            delete guarded.actions.setAddress;
            delete guarded.actions.addItems;
            if ((0, whatsapp_intent_1.isNothingElseOrderIntent)(originalText || text) ||
                this.isConfirmKeyword(originalText || text)) {
                guarded.actions.requestConfirm = true;
            }
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
        if (session.cart.length > 0 &&
            this.catalogService.looksLikeSideModificationNote(text)) {
            if (guarded.actions?.addItems?.length) {
                delete guarded.actions.addItems;
            }
            const applied = this.applyInlineOrderNote(session, text);
            session = applied.session;
            await this.conversationService.saveSession(conv, session);
            const ack = this.formatInlineNoteAck(session, applied.notedItemIndex);
            await this.reply(conv, msg.waId, `${ack}\n\n${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}\n\n${this.formatContinueShoppingPrompt()}`);
            return;
        }
        if (guarded.actions?.addItems?.length &&
            !session.pendingAttribute &&
            !session.pendingMultiOrder &&
            !this.catalogService.looksLikeClearlyMultiDishOrder(text) &&
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
            (this.catalogService.looksLikeClearlyMultiDishOrder(text) ||
                this.catalogService.looksLikeMultiItemOrderMessage(text) ||
                this.catalogService.looksLikeFoodPlusDrinkOrder(text))) {
            const multiLate = this.catalogService.resolveMultiProductOrder(text, products);
            if (multiLate &&
                multiLate.confident.length + multiLate.needsAttributes.length + multiLate.ambiguous.length >=
                    1 &&
                (multiLate.needsAttributes.length > 0 ||
                    multiLate.confident.length >= 2 ||
                    multiLate.ambiguous.length > 0)) {
                const handledMulti = await this.tryHandleMultiProductOrder(conv, msg.waId, session, multiLate, cfg, text, products, originalText);
                if (handledMulti)
                    return;
            }
        }
        const applied = await this.applyActions(conv, session, guarded.actions, products, cfg, text);
        session = this.applyDeliveryHintFromMessage(applied.session, originalText);
        if (!session.address?.trim()) {
            session = this.applyDeliveryHintFromMessage(session, text);
        }
        if (session.cart.length > 0 && session.ignorePriorOrderHistory) {
            session = { ...session, ignorePriorOrderHistory: false };
        }
        if (applied.limitBlocked) {
            await this.conversationService.saveSession(conv, session);
            await this.handleCartLimitBlocked(conv, msg.waId, applied.limitBlocked, cfg);
            return;
        }
        if (guarded.actions?.setCustomerName &&
            (0, whatsapp_session_intents_1.isUsableWhatsappCustomerName)(guarded.actions.setCustomerName)) {
            await this.conversationService.updateCustomerName(conv, guarded.actions.setCustomerName);
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
                this.catalogService.looksLikeClearlyMultiDishOrder(text) ||
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
                    const attempt = this.tryAddProductToCart(session, m.product, this.quantityForMultiSegment(m.segment, m.product.name, text), cfg, undefined, attrs || undefined);
                    if (attempt.missingAttributes) {
                        missingNeeds.push(m);
                        continue;
                    }
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
                await this.reply(conv, msg.waId, `${this.buildCartAddReply(session, this.deliveryFeeFor(session, cfg), addedNames, {
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
        const wantsCheckout = !!ai.actions?.requestConfirm || this.isConfirmKeyword(text);
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
                ? `${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}\n\n${this.formatContinueShoppingPrompt()}`
                : 'Dime qué quieres pedir por *nombre* o *código*, o escribe *menú*.';
        }
        else if ((guarded.actions?.addItems?.length ?? 0) > 0 &&
            session.cart.length > 0 &&
            !session.pendingAttribute &&
            !/\bas[ií]\s+va tu pedido|subtotal:/i.test(reply)) {
            reply =
                `${reply.trim()}\n\n${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}\n\n` +
                    this.formatContinueShoppingPrompt();
        }
        await this.reply(conv, msg.waId, reply);
    }
    async applyActions(conv, session, actions, products, cfg, sourceText = '') {
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
                pendingQuantityHint: undefined,
            };
        }
        if (actions.setAddress) {
            const addr = actions.setAddress.trim();
            if (addr.length >= 5 &&
                !this.isConfirmKeyword(addr) &&
                !this.isGreetingKeyword(addr) &&
                !(0, whatsapp_intent_1.looksLikeClearCartMessage)(sourceText || addr) &&
                !(0, whatsapp_session_intents_1.isConfirmCurrentAddressIntent)(sourceText || '') &&
                !(0, whatsapp_session_intents_1.isConfirmCurrentAddressIntent)(addr)) {
                const accessRef = this.looksLikeDeliveryAccessReference(addr) ||
                    this.looksLikeDeliveryAccessReference(sourceText || '');
                const existingAddr = (next.address || '').trim();
                if (accessRef &&
                    next.addressConfirmed &&
                    existingAddr &&
                    this.isStrongExplicitAddress(existingAddr)) {
                    const note = (sourceText || addr).trim().slice(0, 160);
                    next = this.appendCustomerNote(next, note);
                    const addrNow = (next.address || existingAddr).trim();
                    if (addrNow && !addrNow.toLowerCase().includes(note.toLowerCase())) {
                        const base = addrNow.replace(/\s*\(ref\.\s*[^)]*\)\s*$/i, '').trim();
                        next = { ...next, address: `${base} — ${note}`.slice(0, 240) };
                    }
                }
                else if (!this.isPickupIntent(addr)) {
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
            const forcedQty = sourceText ? this.resolveOrderQuantity(next, sourceText) : 1;
            const multiQtyOrder = actions.addItems.length > 1 ||
                (!!sourceText &&
                    (this.catalogService.looksLikeMultiItemOrderMessage(sourceText) ||
                        this.catalogService.countQuantityMentions(sourceText) >= 2));
            const modNote = sourceText
                ? this.catalogService.extractProductModificationNote(sourceText)
                : null;
            let items = actions.addItems;
            if (modNote && items.length > 1) {
                items = items.filter((item) => {
                    const product = products.find((p) => p.id === item.productId);
                    if (!product)
                        return false;
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
                if (!items.length)
                    items = actions.addItems.slice(0, 1);
            }
            const deferredNeedsAttrs = [];
            let pendingAttr;
            for (const item of items) {
                const product = products.find((p) => p.id === item.productId);
                if (!product)
                    continue;
                const qty = this.resolveAddItemQuantity({
                    product,
                    aiQuantity: item.quantity,
                    sourceText,
                    multiQtyOrder,
                    forcedQty,
                });
                const itemNote = item.note?.trim() || (multiQtyOrder ? undefined : modNote || undefined) || undefined;
                const attempt = this.tryAddProductToCart(next, product, qty, cfg, itemNote, item.attributes);
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
                next = this.buildPendingAttributeSession(next, pendingAttr.product, pendingAttr.selected, {
                    sourceText: pendingAttr.sourceText,
                    pendingMultiOrder: {
                        confident: [],
                        ambiguous: [],
                        unresolved: [],
                        needsAttributes: deferredNeedsAttrs,
                    },
                });
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
    toCartLimitsConfig(cfg, session) {
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
    deliveryFeeFor(session, cfg) {
        if (session.orderType === 'pickup')
            return 0;
        if (typeof session.deliveryFeeCalculated === 'number' && session.deliveryFeeCalculated >= 0) {
            return session.deliveryFeeCalculated;
        }
        return 0;
    }
    hasResolvedDeliveryFee(session) {
        return typeof session.deliveryFeeCalculated === 'number' && session.deliveryFeeCalculated >= 0;
    }
    async ensureDeliveryFeeQuoted(session, cfg) {
        if (session.orderType === 'pickup')
            return { session };
        if (!session.address?.trim() || !session.addressConfirmed)
            return { session };
        if (this.hasResolvedDeliveryFee(session))
            return { session };
        return this.recalculateDeliveryFee(session, cfg);
    }
    async recalculateDeliveryFee(session, cfg, coords) {
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
        if (!address)
            return { session };
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
        const lat = coords?.lat != null && Number.isFinite(Number(coords.lat))
            ? Number(coords.lat)
            : session.deliveryLat != null && Number.isFinite(Number(session.deliveryLat))
                ? Number(session.deliveryLat)
                : null;
        const lng = coords?.lng != null && Number.isFinite(Number(coords.lng))
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
                    notice: `📍 Anoté: _${address}_\n` +
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
        const kmPart = quote.source === 'google_directions' && quote.distanceKm > 0
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
                address: this.mergeGeocodedAddressWithCustomerHint(quote.geocodedAddress || geocodeQuery, customerHint),
            },
            notice: `🚚 Domicilio: *$${quote.fee.toLocaleString('es-CO')}*${kmPart}`,
        };
    }
    tryAddProductToCart(session, product, quantity, cfg, note, attributes, attrOpts) {
        const selected = attributes || [];
        if (product.hasAttributes &&
            product.attributes?.length &&
            !this.catalogService.isAttributeSelectionComplete(product, selected, attrOpts)) {
            return { session, missingAttributes: selected };
        }
        const incomingKey = this.cartLineKey({
            productId: product.id,
            note,
            attributes,
        });
        const alreadyInCart = session.cart.some((c) => this.cartLineKey(c) === incomingKey);
        if (alreadyInCart && this.isOnlyThisProductCorrection(attrOpts?.sourceText || '')) {
            return { session, alreadyHad: true };
        }
        const projected = this.addProductToCart(session, product, quantity, note, attributes);
        const check = (0, whatsapp_cart_limits_1.evaluateCartLimits)(projected.cart, this.toCartLimitsConfig(cfg, session), {
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
    isOnlyThisProductCorrection(text) {
        const t = (text || '').trim().toLowerCase();
        if (!t)
            return false;
        return (/\b(solo|solamente|unicamente|únicamente)\b/.test(t) ||
            /\bnada\s+m[aá]s\s+(que|de)\b/.test(t) ||
            /\b(eso\s+no|no\s+agregues|no\s+sumes|no\s+otro)\b/.test(t));
    }
    buildPendingAttributeSession(session, product, selected, opts) {
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
    resolveOrderQuantity(session, text) {
        const fromText = this.catalogService.extractQuantityFromMessage(text);
        if (fromText >= 2)
            return Math.min(30, fromText);
        const hint = session.pendingQuantityHint;
        if (!hint || hint.quantity < 2)
            return Math.max(1, fromText);
        const q = this.normalizeForMatch(this.catalogService.stripQuantityFromSearchQuery(this.catalogService.extractProductSearchQuery(text)) || text);
        const hintQ = this.normalizeForMatch(hint.query || '');
        if (!q || q.length < 4)
            return Math.max(1, fromText);
        if (hintQ.includes(q) ||
            q.includes(hintQ) ||
            hintQ.split(' ').some((t) => t.length >= 5 && q.includes(t)) ||
            q.split(' ').some((t) => t.length >= 5 && hintQ.includes(t))) {
            return Math.min(30, hint.quantity);
        }
        return Math.max(1, fromText);
    }
    resolveAddItemQuantity(opts) {
        const aiQty = Math.max(1, Math.min(30, opts.aiQuantity ?? 1));
        if (opts.multiQtyOrder && opts.sourceText) {
            const near = this.catalogService.extractQuantityNearProduct(opts.sourceText, opts.product.name);
            if (near != null)
                return Math.max(1, Math.min(30, near));
            return 1;
        }
        if (opts.forcedQty >= 2)
            return Math.min(30, opts.forcedQty);
        return aiQty;
    }
    quantityForMultiSegment(segment, productName, fullText) {
        const rawSeg = this.rawOrderSegmentForQuantity(segment, fullText);
        const fromSeg = this.catalogService.extractQuantityFromSegment(rawSeg || '');
        if (fromSeg >= 2)
            return Math.min(30, fromSeg);
        const near = this.catalogService.extractQuantityNearProduct(fullText || rawSeg || '', productName);
        return Math.max(1, Math.min(30, near ?? fromSeg));
    }
    rawOrderSegmentForQuantity(segment, fullText) {
        let s = (segment || '').trim();
        const ft = (fullText || '').trim();
        if (!s || !ft || s === ft)
            return s;
        if (s.endsWith(ft) && s.length > ft.length) {
            s = s.slice(0, -ft.length).trim();
        }
        return s;
    }
    resolveAddQuantity(session, product, opts) {
        const pm = session.pendingMultiOrder;
        const segment = opts?.segment ||
            pm?.needsAttributes?.find((n) => n.productId === product.id)?.segment ||
            pm?.confident?.find((n) => n.productId === product.id)?.segment;
        const sourceText = opts?.sourceText || segment || session.pendingMatch?.query || '';
        if (segment || sourceText) {
            const qty = this.quantityForMultiSegment(segment || sourceText, product.name, sourceText);
            if (qty >= 2)
                return qty;
            if (segment && this.catalogService.extractQuantityFromSegment(this.rawOrderSegmentForQuantity(segment, sourceText)) >= 1) {
                return qty;
            }
        }
        if (session.pendingMatch?.quantity && session.pendingMatch.quantity >= 2) {
            const ids = new Set(session.pendingMatch.candidates?.map((c) => c.id) || []);
            if (ids.has(product.id))
                return Math.min(30, session.pendingMatch.quantity);
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
            if (fromSeg >= 2)
                return Math.min(30, fromSeg);
        }
        return 1;
    }
    rememberQuantityHint(session, text, quantity) {
        if (quantity < 2)
            return session;
        const query = this.catalogService.stripQuantityFromSearchQuery(this.catalogService.extractProductSearchQuery(text)) || text;
        return {
            ...session,
            pendingQuantityHint: { quantity: Math.min(30, quantity), query },
        };
    }
    clearQuantityHint(session) {
        if (!session.pendingQuantityHint)
            return session;
        const { pendingQuantityHint: _drop, ...rest } = session;
        return rest;
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
    addProductToCart(session, product, quantity, note, attributes, opts) {
        const qty = Math.min(30, Math.max(1, Math.round(quantity) || 1));
        const cart = [...session.cart];
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
                quantity: opts?.mode === 'set'
                    ? qty
                    : Math.min(30, prevQty + qty),
            };
        }
        else {
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
    toPendingAttribute(product, opts) {
        const variantIntent = opts?.variantIntent ||
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
            `Subtotal sistema: $${Math.round(subtotal).toLocaleString('es-CO')} + domicilio $${Math.round(fee).toLocaleString('es-CO')}` +
                (session.deliveryDistanceKm != null
                    ? ` (ruta ~${Number(session.deliveryDistanceKm).toFixed(1)} km)`
                    : '') +
                (session.deliveryOutOfCoverage ? ' [FUERA DE COBERTURA]' : ''),
            'Checkout: el sistema pregunta UNA cosa a la vez (nombre → dirección de domicilio → teléfono → pago). Por defecto es *domicilio*; recojo solo si el cliente lo dijo (ej. paso en 15 min). NO inventes ni saltes esos pasos.',
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
        if (session.cart.length > 0) {
            const last = session.cart[session.cart.length - 1];
            const q = Math.max(1, last.quantity || 1);
            lines.push(`ÚLTIMO ÍTEM DEL CARRITO: "${last.name}"` +
                (q > 1 ? ` x${q}` : '') +
                ` (productId=${last.productId}).` +
                (last.note?.trim() ? ` Nota actual: "${last.note.trim()}".` : '') +
                ' Preferencias de guarnición (sin X, más Y, no quiero arepas, para el combo…) → NOTA de este ítem; PROHIBIDO addItems de acompañamientos.');
        }
        if (session.customerNotes?.trim()) {
            lines.push(`Notas del pedido: ${session.customerNotes.trim()}`);
        }
        if (session.cashChangeFor?.trim()) {
            lines.push(`Cambio/vueltas: ${session.cashChangeFor.trim()}`);
        }
        return lines.join('\n');
    }
    replyLooksLikeProductDump(reply) {
        const codeHits = (reply.match(/\bc[oó]d(?:igo|\.)?\s*\d{1,3}\b/gi) || []).length;
        const numberedList = (reply.match(/^\s*\d{1,2}[.)]\s/mg) || []).length;
        return codeHits >= 4 || numberedList >= 5;
    }
    formatRestaurantLocationReply(cfg) {
        const ctx = cfg.localContext;
        const brand = cfg.brandName || ctx?.restaurantName || 'el local';
        const lines = [`📍 *${brand}*`];
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
            return (`Aún no tengo la dirección del local configurada por aquí.\n` +
                `_Escribe *asesor* / *humano* y te orientan._`);
        }
        lines.push('\n_¿Te antoja algo del menú o prefieres *recojo* / *domicilio*?_');
        return lines.join('\n');
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
        if ((0, whatsapp_session_intents_1.isAbandonPendingSelectionIntent)(text))
            return true;
        if ((0, whatsapp_session_intents_1.isAddressChangeIntent)(text))
            return true;
        if (this.catalogService.isProductDescriptionInquiry(text) ||
            this.catalogService.isPriceInquiryIntent(text) ||
            this.catalogService.isAvailabilityInquiry(text)) {
            return false;
        }
        const lower = text.trim().toLowerCase();
        if (/^[1-9]\d*$/.test(lower) && pending.ambiguous.length)
            return false;
        if (pending.ambiguous.length) {
            const group = pending.ambiguous[0];
            if (this.catalogService.pickFromCandidateList(text, group.candidates)) {
                return false;
            }
        }
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
            await this.reply(conv, waId, this.buildCartAddReply(session, this.deliveryFeeFor(session, cfg), `${picked.name}${qtyNote}`));
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
        const listOrCode = (0, whatsapp_session_intents_1.resolvePendingListOrMenuCode)({
            bareNum,
            candidates: pending.candidates,
        });
        if (listOrCode === 'list_index' && bareNum != null) {
            chosenLite = pending.candidates[bareNum - 1];
        }
        else if (listOrCode === 'menu_code' && bareNum != null) {
            chosenLite =
                pending.candidates.find((c) => Number(c.code) === bareNum) ?? null;
        }
        const code = this.catalogService.extractCodeFromMessage(text);
        if (!chosenLite && code != null) {
            chosenLite =
                pending.candidates.find((c) => Number(c.code) === code) ?? null;
        }
        if (!chosenLite && code != null) {
            const found = this.catalogService.findByCode(code, products);
            if (found) {
                if (pending.candidates.some((c) => c.id === found.id) ||
                    bareNum == null ||
                    bareNum > pending.candidates.length) {
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
        const qty = Math.max(1, pending.quantity ||
            this.resolveOrderQuantity(session, text) ||
            1);
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
        session = this.clearQuantityHint(added.session);
        await this.conversationService.saveSession(conv, session, 'building_cart');
        const qtyNote = qty > 1 ? ` _(x${qty})_` : '';
        await this.reply(conv, waId, this.buildCartAddReply(session, this.deliveryFeeFor(session, cfg), `${chosen.name}${qtyNote}`, {
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
            deliveryFee: this.deliveryFeeFor(session, cfg),
            deliveryFeeTiersBlock: cfg.deliveryFeeTiersPrompt,
            allowMercadoPago: !!cfg.allowMercadoPago,
            menuProductCount: products.filter((p) => p.availableNow !== false).length,
            localContextBlock: cfg.localContextBlock,
            orderLimitsBlock: (0, whatsapp_cart_limits_1.buildOrderLimitsPromptBlock)(this.toCartLimitsConfig(cfg, session)),
            paymentMethods: cfg.paymentMethods,
        });
        const ai = await this.aiService.generateTurn({
            userMessage: text,
            businessRulesBlock: rulesBlock,
            menuDetailedText: menuDetailed,
            sessionSummary: this.buildSessionSummary(conv, session, this.deliveryFeeFor(session, cfg)),
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
        const applied = await this.applyActions(conv, session, guarded.actions, products, cfg, text);
        const nextSession = {
            ...applied.session,
            pendingAttribute: session.pendingAttribute,
        };
        if (guarded.actions?.setCustomerName &&
            (0, whatsapp_session_intents_1.isUsableWhatsappCustomerName)(guarded.actions.setCustomerName)) {
            await this.conversationService.updateCustomerName(conv, guarded.actions.setCustomerName);
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
        const lockNote = '_Cuando confirmes el pedido ya *no podrás modificarlo*._';
        const comboHint = this.softComboUpsellHint(session);
        if (session?.addressConfirmed && session.cart.length > 0) {
            return ((comboHint ? `${comboHint}\n` : '') +
                `Si ya está tu pedido, escribe *listo* o *confirmar*.\n${lockNote}`);
        }
        if (session?.cart.length && !session.address?.trim()) {
            return ((comboHint ? `${comboHint}\n` : '') +
                `¿Algo más?\n` +
                `También puedes mandar la *dirección* (ej. _para el hospital de Kennedy_).\n` +
                `Si ya está, escribe *listo* o *confirmar*.\n${lockNote}`);
        }
        return ((comboHint ? `${comboHint}\n` : '') +
            `¿Algo más? Si ya está, escribe *listo* o *confirmar*.\n${lockNote}`);
    }
    softComboUpsellHint(session) {
        if (!session?.cart?.length)
            return '';
        const last = session.cart[session.cart.length - 1];
        if (!last?.name)
            return '';
        const n = last.name.toLowerCase();
        if (/\bcombo\b/.test(n))
            return '';
        if (!/\bpollo\b/.test(n) && !/\bbroaster\b/.test(n) && !/\bfrito\b/.test(n))
            return '';
        if (/\b(arroz|sopa|bandeja|ejecutivo|hamburguesa)\b/.test(n))
            return '';
        return '_Si quieres, también hay versión *combo* con gaseosa — dime “en combo”._';
    }
    formatCartTiny(session, deliveryFee) {
        const cart = this.consolidateCart(session.cart);
        const n = cart.reduce((s, c) => s + Math.max(1, c.quantity || 1), 0);
        if (!n)
            return '🛒 Carrito vacío';
        const subtotal = cart.reduce((s, c) => s + c.unitPrice * Math.max(1, c.quantity || 1), 0);
        const fee = session.orderType === 'delivery' && this.hasResolvedDeliveryFee(session)
            ? deliveryFee
            : 0;
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
        const feeResolved = this.hasResolvedDeliveryFee(session);
        const fee = session.orderType === 'delivery' && feeResolved ? deliveryFee : 0;
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
        let deliveryLine = '';
        if (session.orderType === 'delivery') {
            if (feeResolved && fee > 0) {
                deliveryLine = `\nDomicilio${session.deliveryDistanceKm != null && session.deliveryDistanceKm > 0
                    ? ` (ruta ~${Number(session.deliveryDistanceKm).toFixed(1)} km)`
                    : ''}: $${Math.round(fee).toLocaleString('es-CO')}`;
            }
            else if (session.address?.trim()) {
                deliveryLine = `\nDomicilio: _se confirma según la ruta_`;
            }
            else {
                deliveryLine = `\nDomicilio: _según dirección_`;
            }
        }
        return (`🛒 *Tu carrito*\n\n` +
            lines.join('\n\n') +
            `\n\n────────────\n` +
            `Subtotal: $${Math.round(subtotal).toLocaleString('es-CO')}` +
            deliveryLine +
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
            (0, whatsapp_session_intents_1.isUsableWhatsappCustomerName)(conv.customerName || '') &&
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
    isPhoneOnlyCustomerMessage(text) {
        const raw = (text || '').trim();
        if (!raw || raw.length > 40)
            return false;
        if (!this.looksLikePhoneNumber(raw))
            return false;
        if (/\b(pollo|sopa|bandeja|domicilio|calle|carrera|conjunto|quiero|dame|agrega|men[uú]|listo|confirmar)\b/i.test(raw)) {
            return false;
        }
        const withoutLabel = raw
            .replace(/^(?:mi\s+)?(?:cel(?:ular)?|tel(?:[eé]fono)?|whatsapp|wa|n[uú]mero)\s*(?:es|:)?\s*/i, '')
            .trim();
        return this.looksLikePhoneNumber(withoutLabel || raw);
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
                `¿Está bien? Responde *sí* / *acá* o manda la dirección corregida.`);
        }
        const last = session.lastDeliveryAddress?.trim();
        if (last) {
            return (`${head}\n` +
                `¿Misma dirección de siempre?\n` +
                `📍 _${last}_\n\n` +
                `Responde *sí* / *acá* o manda la *nueva* dirección.\n` +
                `_Si pasas tú por el local, escribe p. ej. "paso en 15 minutos"._`);
        }
        return (`${head}\n` +
            `¿Me escribes la *dirección*?\n` +
            `_Ej: Calle 10 #5-20, apto 202_ · _Hospital de Kennedy_ · _Conjunto Nuevo Sol_\n` +
            `_Si pasas tú por el local, escribe p. ej. "paso en 15 minutos"._`);
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
        return false;
    }
    async tryHandleCheckoutSideAdd(conv, waId, session, text, products, cfg, resume = 'phone') {
        const raw = (text || '').trim();
        if (raw.length < 3)
            return false;
        if (this.looksLikePhoneNumber(raw))
            return false;
        if ((0, whatsapp_intent_1.looksLikeAddressOnlyMessage)(raw) || this.isAddressOnlyCustomerMessage(raw))
            return false;
        const q = this.normalizeForMatch(raw);
        const looksDrink = /\b(colombiana|manzana|pepsi|coca|gaseosa|sprite|jugo|limonada|uva|ginger|postobon)\b/.test(q) ||
            (this.catalogService.extractRequestedDrinkVolumeMl(raw) != null &&
                /\b(litro|litros|ml|gaseosa|bebida)\b/.test(q));
        if (!looksDrink)
            return false;
        const drinks = products.filter((p) => p.availableNow !== false && this.catalogService.isLikelyDrinkProduct(p));
        const drink = this.catalogService.pickBestDrinkProduct(drinks, raw) ||
            this.catalogService.findProductEmbeddedInMessage(raw, products);
        if (!drink || !this.catalogService.isLikelyDrinkProduct(drink))
            return false;
        const qty = Math.max(1, this.catalogService.extractQuantityFromMessage(raw));
        let attrs = this.catalogService.extractExplicitAttributeChoice(raw, drink) ||
            this.catalogService.resolveAttributesFromText(drink, raw) ||
            undefined;
        if ((!attrs || !attrs.length) && drink.hasAttributes && drink.attributes?.length) {
            const flavorAttr = drink.attributes.find((a) => /\b(sabor|gaseosa|bebida)\b/i.test(a.attributeName || ''));
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
                session = {
                    ...session,
                    pendingAttribute: this.toPendingAttribute(drink, {
                        sourceText: raw,
                        selected: attrs || [],
                    }),
                    pendingMatch: undefined,
                };
                await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
                await this.reply(conv, waId, this.catalogService.formatProductOptionsPrompt(drink, attrs || [], this.attributeFlowOpts(session.pendingAttribute)));
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
            await this.reply(conv, waId, this.catalogService.formatProductOptionsPrompt(drink, added.missingAttributes, this.attributeFlowOpts(session.pendingAttribute)));
            return true;
        }
        session = added.session;
        await this.conversationService.saveSession(conv, session, 'awaiting_phone');
        const phoneAsk = resume === 'phone'
            ? `\n\n${this.buildAskPhoneMessage(conv, session, this.deliveryFeeFor(session, cfg))}`
            : '';
        await this.reply(conv, waId, `Listo, agregué *${drink.name}* ✅\n\n` +
            `${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}` +
            phoneAsk);
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
        const limitsCfg = this.toCartLimitsConfig(cfg, session);
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
        if (!(0, whatsapp_session_intents_1.isUsableWhatsappCustomerName)(conv.customerName || '')) {
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
            else {
                session = {
                    ...session,
                    orderType: 'delivery',
                    fulfillmentChosen: true,
                };
                if (session.address?.trim() && this.isStrongExplicitAddress(session.address)) {
                    session = { ...session, addressConfirmed: true };
                }
                await this.conversationService.saveSession(conv, session);
            }
        }
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
            if (session.deliveryOutOfCoverage ||
                session.deliveryFeeCalculated == null ||
                session.deliveryFeeCalculated === undefined) {
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
            await say(`${this.formatOrderSummary(conv, session, this.deliveryFeeFor(session, cfg), cfg.paymentMethods)}\n\n` +
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
                await say(`${this.formatOrderSummary(conv, session, this.deliveryFeeFor(session, cfg), cfg.paymentMethods)}\n\n` +
                    `${(0, whatsapp_points_help_1.formatCartNeedsHalfChickenForPremio)()}\n\n` +
                    `Cuando agregues el medio pollo, escribe *listo* o *confirmar*.`);
                return;
            }
            await this.conversationService.saveSession(conv, session, 'awaiting_final_confirm');
            await say(`${this.formatOrderSummary(conv, session, this.deliveryFeeFor(session, cfg), cfg.paymentMethods)}\n\n` +
                `Si todo cuadra, responde *listo* o *confirmar* y armamos el pedido.\n` +
                `_Al confirmar ya *no podrás modificar* el carrito._`);
            return;
        }
        if (session.pendingRedemptionCode &&
            !this.pointsHandler.cartHasHalfChicken(session.cart)) {
            await say(`${(0, whatsapp_points_help_1.formatCartNeedsHalfChickenForPremio)()}\n\nAgrega medio pollo (cód. 2 o 5) y vuelve a escribir *listo* o *confirmar*.`);
            return;
        }
        session = { ...session, cart: this.consolidateCart(session.cart) };
        const items = session.cart.flatMap((c) => Array.from({ length: Math.max(1, c.quantity || 1) }, () => ({
            productId: c.productId,
            note: c.note,
            attributes: c.attributes,
        })));
        const orderDto = {
            customerName: conv.customerName.trim(),
            phone: (session.contactPhone || conv.phoneE164).trim(),
            address: (0, whatsapp_order_address_1.composeWhatsappOrderAddress)(session, cfg.paymentMethods),
            orderType: session.orderType,
            deliveryFee: session.orderType === 'delivery' ? this.deliveryFeeFor(session, cfg) : undefined,
            orderSource: 'whatsapp',
            items,
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
                await say(`${this.formatOrderSummary(conv, session, this.deliveryFeeFor(session, cfg), cfg.paymentMethods)}\n\n` +
                    `Link de pago Mercado Pago:\n${pref.initPoint}\n\nCuando el pago se confirme, te avisamos aquí y armamos el pedido.`);
                return;
            }
            const order = await this.ordersService.create(orderDto);
            const snapshot = { ...session };
            await this.conversationService.resetOrderSession(conv, 'completed', {
                ignorePriorHistory: true,
                rememberDeliveryAddress: true,
            });
            await say(this.formatOrderSuccessMessage(conv, snapshot, order, this.deliveryFeeFor(snapshot, cfg), cfg.orderSuccessMessage, cfg.paymentMethods));
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
                rememberDeliveryAddress: true,
            });
            const success = this.formatOrderSuccessMessage(conv, snapshot, { orderId: params.orderId }, this.deliveryFeeFor(snapshot, cfg), cfg.orderSuccessMessage, cfg.paymentMethods) || `Pago recibido ✅ Pedido #${params.orderId} creado. ${cfg.orderSuccessMessage}`;
            await this.reply(conv, params.waId || conv.waId, success);
        }
        catch (err) {
            this.logger.error(`completeAfterMercadoPagoPayment failed conv=${params.conversationId} order=${params.orderId}`, err);
        }
    }
    async sendHumanReply(conversationId, body, agent) {
        const text = (body || '').trim();
        if (!text) {
            throw new common_1.BadRequestException('Mensaje vacío');
        }
        const conv = await this.conversationService.getConversation(conversationId);
        if (!conv.humanTakeover) {
            await this.conversationService.setHumanTakeover(conversationId, true, agent);
        }
        await this.metaService.sendText(conv.waId, text);
        try {
            await this.conversationService.logMessage({
                conversationId,
                direction: 'out',
                body: text,
                sentBy: 'human',
            });
            await this.conversationService.touchOutbound(conv, 'human');
        }
        catch (err) {
            this.logger.error(`sendHumanReply: enviado a Meta pero falló log/touch conv=${conversationId}`, err instanceof Error ? err.stack : err);
        }
    }
    async sendHumanMedia(conversationId, file, agent, caption) {
        if (!file?.buffer?.length) {
            throw new common_1.BadRequestException('Archivo vacío');
        }
        const classified = (0, whatsapp_outbound_media_1.classifyOutboundMedia)(file.mimetype, file.size);
        if ('error' in classified) {
            throw new common_1.BadRequestException(classified.error);
        }
        const kind = classified.kind;
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
        const body = (0, whatsapp_outbound_media_1.outboundMediaBodyLabel)({ kind, caption: cap, filename });
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
        }
        catch (err) {
            this.logger.error(`sendHumanMedia: enviado a Meta pero falló log conv=${conversationId}`, err instanceof Error ? err.stack : err);
        }
        return { success: true, messageType: kind, mediaId };
    }
    async releaseToBot(conversationId, opts) {
        const reason = opts?.reason ?? 'manual';
        const notify = opts?.notify !== false;
        const conv = await this.conversationService.getConversation(conversationId);
        if (!conv.humanTakeover)
            return { released: false };
        await this.conversationService.releaseHumanTakeover(conversationId);
        if (!notify)
            return { released: true };
        const body = (0, whatsapp_bot_resume_1.botResumeCustomerMessage)(reason);
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
        }
        catch (err) {
            this.logger.warn(`releaseToBot: liberado pero no se pudo avisar conv=${conversationId}: ${String(err)}`);
        }
        return { released: true };
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
        return 'Si prefieres, escribe *ASESOR* y una persona te atiende por aquí 😊';
    }
    async handlePostOrderFollowUp(conv, waId, text, cfg) {
        const t = (text || '').toLowerCase();
        const wantsCancel = /\b(cancel|me\s+tengo\s+que\s+ir|mejor\s+lo\s+cancelo)\b/i.test(t);
        const complaint = /\b(trajo|no\s+me\s+(regalaron|trajeron|enviaron)|falto|faltó|me\s+falta)\b/i.test(t);
        const arrived = /\b(ya\s+lleg|gracias\s+ya\s+lleg)\b/i.test(t);
        if (arrived) {
            await this.reply(conv, waId, '¡Qué bueno que ya te llegó! 🙌 Gracias por pedir con nosotros.');
            return;
        }
        if (wantsCancel || complaint) {
            await this.conversationService.setHumanTakeover(conv.id, true);
            await this.reply(conv, waId, (wantsCancel
                ? 'Entiendo, qué pena con la demora 🙏 Un asesor te atiende ya para ayudarte con el pedido.\n\n'
                : 'Qué pena con eso 🙏 Un asesor revisa tu pedido ahora mismo.\n\n') +
                (cfg.humanHandoffMessage || this.humanHelpHint()));
            return;
        }
        await this.reply(conv, waId, `Tu pedido *ya quedó registrado* ✅ ${this.formatDeliveryEtaSentence(cfg)}\n` +
            'Si ya pasó más de eso o necesitas ubicar al domiciliario, escribe *asesor* y te pasamos con el equipo.');
    }
    getDeliveryEtaRangeText(cfg) {
        const note = (cfg.localContext?.deliveryTimeNote || '').trim();
        if (note)
            return note;
        return 'unos 35–45 minutos';
    }
    formatDeliveryEtaSentence(cfg) {
        const range = this.getDeliveryEtaRangeText(cfg);
        if (/demora|tarda|minut/i.test(range)) {
            return `Suele demorar *${range.replace(/^\s*unos\s+/i, '')}* según la zona.`;
        }
        return `Suele demorar *${range}* según la zona.`;
    }
    async tryHandleDeliveryEtaInquiry(conv, waId, originalText, text, cfg) {
        if (!(0, whatsapp_session_intents_1.isDeliveryEtaInquiry)(originalText) && !(0, whatsapp_session_intents_1.isDeliveryEtaInquiry)(text)) {
            return false;
        }
        await this.reply(conv, waId, `${this.formatDeliveryEtaSentence(cfg)}\n` +
            '_Es orientativo: cocina + camino. Cuando confirmemos el pedido te avisamos._');
        return true;
    }
    isProductCompositionQuestion(text) {
        return this.catalogService.isProductDescriptionInquiry(text);
    }
    findProductsForCompositionQuestion(text, products, session) {
        const stripped = this.catalogService.stripProductDescriptionInquiryNoise(text);
        const query = this.catalogService.extractProductSearchQuery(stripped || text);
        const focusedEarly = this.resolveDiscussedProduct(session, stripped || text, products);
        if (focusedEarly && this.isCompositionFollowUpWithoutProductName(text, query)) {
            return [focusedEarly];
        }
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
        return focusedEarly ? [focusedEarly] : [];
    }
    isCompositionFollowUpWithoutProductName(text, query) {
        const q = (query || '').trim().toLowerCase();
        if (!q || q.length < 4)
            return true;
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
        if (tokens.every((t) => fillers.has(t)))
            return true;
        if (/^(y|tambien|también)\b/i.test(text.trim()) &&
            !/\b(pollo|arroz|sopa|bandeja|mojarra|churrasco|mondongo|ajiaco|pechuga|costilla|gaseosa|limonada|hamburguesa|ejecutivo|trucha|bagre)\b/i.test(text)) {
            return true;
        }
        return false;
    }
    findProductForCompositionQuestion(text, products, session) {
        return this.findProductsForCompositionQuestion(text, products, session)[0] || null;
    }
    buildProductCompositionReply(text, product, cfg, session) {
        const allergens = (cfg.localContext?.allergensNote || '').trim();
        const q = text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
        const yieldOrWeightAsk = /\b(gramos?|peso|pesa|personas?|alcanza|allcanza|rinde|sirve)\b/.test(q);
        if (product) {
            const alreadyInCart = !!session?.cart.some((c) => c.productId === product.id);
            let msg = this.catalogService.formatProductPriceReply(product, {
                offerAdd: !alreadyInCart,
            });
            if (alreadyInCart) {
                msg += '\n\n_Ya lo tienes en el carrito._';
            }
            if (yieldOrWeightAsk) {
                msg +=
                    '\n\n_En la carta no tengo gramos ni para cuántas personas rinde exactamente._ ' +
                        '¿Para cuántas personas lo necesitas? Si prefieres, escribe *ASESOR* y te confirma alguien del equipo.';
            }
            return msg;
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
        if (session.pendingAddOffer?.productId) {
            const offer = this.catalogService.getProductById(session.pendingAddOffer.productId, products);
            if (offer)
                return offer;
        }
        if (session.productFocus?.productId) {
            const focused = this.catalogService.getProductById(session.productFocus.productId, products);
            if (focused)
                return focused;
        }
        const multiFirst = session.pendingMultiOrder?.confident?.[0] ||
            session.pendingMultiOrder?.needsAttributes?.[0];
        if (multiFirst?.productId) {
            const fromMulti = this.catalogService.getProductById(multiFirst.productId, products);
            if (fromMulti)
                return fromMulti;
        }
        if (session.pendingMatch?.candidates?.length) {
            const fromMatch = session.pendingMatch.candidates[0];
            const live = this.catalogService.getProductById(fromMatch.id, products) || fromMatch;
            if (live)
                return live;
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
    async tryHandleLargerPackInquiry(conv, waId, session, text, products, cfg) {
        if (!this.catalogService.isLargerPackInquiry(text))
            return false;
        const product = this.resolveDiscussedProduct(session, text, products);
        if (!product) {
            if (!this.catalogService.isVaguePackSizeQuery(text))
                return false;
            await this.reply(conv, waId, '¿De cuál plato quieres un *combo/pack más grande*? Dime el nombre (ej. *tacos*).');
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
            await this.reply(conv, waId, `Sobre *${product.name}*, estas son las versiones/packs que manejamos:\n\n` +
                this.catalogService.formatOptionsList(rows) +
                `\n\n_Dime el *número* del que quieras (el más grande suele ser el de mayor precio)._`);
            return true;
        }
        const pa = session.pendingAttribute;
        const keepPending = pa &&
            (pa.productId === product.id ||
                this.catalogService.getProductById(pa.productId, products)?.id === product.id);
        await this.conversationService.saveSession(conv, session, keepPending ? 'awaiting_attribute' : undefined);
        const suffix = keepPending
            ? `\n\nSeguimos con *${product.name}*:\n\n` +
                this.catalogService.formatProductOptionsPrompt(product, pa?.selected || [])
            : `\n\nSi quieres, te dejo *${product.name}* o dime otro plato.`;
        await this.reply(conv, waId, `De *${product.name}* no tengo un combo/pack *más grande* en el menú 🙏` + suffix);
        return true;
    }
    async tryHandleServingSizeChange(conv, waId, session, text, products, cfg) {
        if (!this.catalogService.isServingSizeChangeIntent(text))
            return false;
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
        const smallSoup = products.find((p) => p.availableNow !== false &&
            /sopa\s+peque/i.test(p.name)) || null;
        const talkingMondongo = /\bmondongo\b/i.test(text) ||
            (product ? /\bmondongo\b/i.test(product.name) : false) ||
            session.cart.some((c) => /\bmondongo\b/i.test(c.name));
        if (talkingMondongo && smallSoup) {
            const smallHasMondongo = (smallSoup.attributes || []).some((a) => a.options.some((o) => /mondongo/i.test(o)));
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
                await this.reply(conv, waId, `La *Sopa de Mondongo* solo la manejamos en el tamaño normal` +
                    (product && /\bmondongo\b/i.test(product.name) ? ` (*${product.name}*)` : '') +
                    `.\n` +
                    `La *Sopa pequeña* es de *Ajiaco* o *Menudencias*, no de mondongo.\n\n` +
                    `_¿Dejamos la mondongo o la quitas?_` +
                    cartLine);
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
        await this.reply(conv, waId, `Para *${focusName}* no veo un tamaño más pequeño aparte en el menú. ` +
            `Si buscas *sopa pequeña* (ajiaco/menudencias), dímelo. O escribe *ASESOR*.`);
        return true;
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
            if (!picked) {
                if (hint === 'combo') {
                    const style = /\bbroaster\b/i.test(product.name)
                        ? 'broaster'
                        : /\bfrito\b/i.test(product.name)
                            ? 'frito'
                            : null;
                    const comboHits = products.filter((p) => p.availableNow !== false &&
                        /\bcombo\b/i.test(p.name) &&
                        /\bpollo\b/i.test(p.name) &&
                        (!style || new RegExp(`\\b${style}\\b`, 'i').test(p.name)));
                    picked = comboHits[0] || null;
                }
                if (!picked)
                    return false;
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
                const step = this.catalogService.coerceAttributeStep(picked, this.catalogService.resolveAttributesFromMessage(picked, text, []));
                if (step.status === 'complete') {
                    const added = this.tryAddProductToCart(session, picked, this.resolveAddQuantity(session, picked, { sourceText: text }), cfg, undefined, step.attributes);
                    if (added.missingAttributes) {
                        session = this.buildPendingAttributeSession(session, picked, added.missingAttributes, { sourceText: text });
                        await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
                        await this.reply(conv, waId, `${cartContext ? 'Listo, vamos con esa opción 👍\n\n' : ''}` +
                            this.catalogService.formatProductOptionsPrompt(picked, added.missingAttributes));
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
                    await this.reply(conv, waId, `${cartContext ? 'Listo, lo cambié 👍\n\n' : ''}` +
                        this.buildCartAddReply(session, this.deliveryFeeFor(session, cfg), `${picked.name} (${chosen})`));
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
            const added = this.tryAddProductToCart(session, picked, this.resolveAddQuantity(session, picked, { sourceText: text }), cfg);
            if (added.blocked) {
                await this.conversationService.saveSession(conv, session);
                await this.handleCartLimitBlocked(conv, waId, added.blocked, cfg);
                return true;
            }
            session = added.session;
            await this.conversationService.saveSession(conv, session, 'building_cart');
            await this.reply(conv, waId, `${cartContext ? 'Listo, lo cambié 👍\n\n' : ''}` +
                this.buildCartAddReply(session, this.deliveryFeeFor(session, cfg), picked.name));
            return true;
        }
        if (hint === 'combo') {
            const style = /\bbroaster\b/i.test(product.name)
                ? 'broaster'
                : /\bfrito\b/i.test(product.name)
                    ? 'frito'
                    : null;
            const combo = products.find((p) => p.availableNow !== false &&
                /\bcombo\b/i.test(p.name) &&
                /\bpollo\b/i.test(p.name) &&
                (!style || new RegExp(`\\b${style}\\b`, 'i').test(p.name))) || null;
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
                const added = this.tryAddProductToCart(session, combo, this.resolveAddQuantity(session, combo, { sourceText: text }), cfg);
                if (added.blocked) {
                    await this.conversationService.saveSession(conv, session);
                    await this.handleCartLimitBlocked(conv, waId, added.blocked, cfg);
                    return true;
                }
                session = added.session;
                await this.conversationService.saveSession(conv, session, 'building_cart');
                await this.reply(conv, waId, `Perfecto, lo dejamos en *${combo.name}* ✅\n\n` +
                    this.buildCartAddReply(session, this.deliveryFeeFor(session, cfg), combo.name));
                return true;
            }
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
            const stillNeed = this.catalogService.getRemainingAttributes(product, step.attributes, hint ? { variantIntent: hint } : undefined);
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
                await this.reply(conv, waId, `${cartContext ? 'Listo, vamos con esa opción 👍\n\n' : ''}` +
                    this.catalogService.formatProductOptionsPrompt(product, step.attributes, hint ? { variantIntent: hint } : undefined));
                return true;
            }
            const added = this.tryAddProductToCart(session, product, this.resolveAddQuantity(session, product, { sourceText: text }), cfg, undefined, step.attributes, hint ? { variantIntent: hint } : undefined);
            if (added.missingAttributes) {
                session = this.buildPendingAttributeSession(session, product, added.missingAttributes, {
                    sourceText: text,
                    variantIntent: hint || undefined,
                });
                await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
                await this.reply(conv, waId, `${cartContext ? 'Listo, vamos con esa opción 👍\n\n' : ''}` +
                    this.catalogService.formatProductOptionsPrompt(product, added.missingAttributes, hint ? { variantIntent: hint } : undefined));
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
            await this.reply(conv, waId, `${cartContext ? 'Listo, lo cambié 👍\n\n' : ''}` +
                this.buildCartAddReply(session, this.deliveryFeeFor(session, cfg), `${product.name} (${chosen})`));
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
            session = {
                ...this.rememberProductFocus(session, product, products),
                pendingCompositionAsk: undefined,
            };
            await this.conversationService.saveSession(conv, session);
            const alreadyInCart = session.cart.some((c) => c.productId === product.id);
            if (!alreadyInCart) {
                await this.savePendingAddOffer(conv, product, 1);
            }
        }
        else {
            session = {
                ...session,
                pendingCompositionAsk: { originalText: text },
            };
            await this.conversationService.saveSession(conv, session, 'building_cart');
        }
        await this.reply(conv, waId, this.buildProductCompositionReply(text, product, cfg, session));
        return true;
    }
    async tryResolvePendingCompositionAsk(conv, waId, session, text, products, cfg) {
        const ask = session.pendingCompositionAsk;
        if (!ask?.originalText)
            return false;
        if ((0, whatsapp_session_intents_1.isAbandonPendingSelectionIntent)(text)) {
            session = { ...session, pendingCompositionAsk: undefined };
            await this.conversationService.saveSession(conv, session, 'building_cart');
            await this.reply(conv, waId, 'Listo, lo dejamos pasar 👍 ¿Qué se te antoja?');
            return true;
        }
        if (this.isProductCompositionQuestion(text) &&
            this.isCompositionFollowUpWithoutProductName(text, this.catalogService.extractProductSearchQuery(this.catalogService.stripProductDescriptionInquiryNoise(text) || text))) {
            await this.reply(conv, waId, this.buildProductCompositionReply(ask.originalText, null, cfg));
            return true;
        }
        const product = this.catalogService.findProductEmbeddedInMessage(text, products) ||
            this.catalogService.resolveSizedChickenProduct(text, products) ||
            this.catalogService.resolveSizedSoupProduct(text, products) ||
            (() => {
                const scored = this.catalogService.searchByNameScored(this.catalogService.extractProductSearchQuery(text) || text, products, 5);
                if (scored.length === 1 && scored[0].score >= 40)
                    return scored[0].p;
                if (this.catalogService.isStrongProductMatch(scored) && scored[0].score >= 50) {
                    return scored[0].p;
                }
                return null;
            })();
        if (!product)
            return false;
        session = {
            ...this.rememberProductFocus(session, product, products),
            pendingCompositionAsk: undefined,
        };
        await this.conversationService.saveSession(conv, session, 'building_cart');
        await this.reply(conv, waId, this.buildProductCompositionReply(ask.originalText, product, cfg));
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
        return null;
    }
    isVagueImageCaption(caption) {
        const t = (caption || '').trim().toLowerCase();
        if (!t)
            return true;
        if (t.length > 80)
            return false;
        return /^(esta|este|estos|esas|eso|de\s+estos|de\s+estas|la\s+de\s+la\s+foto|me\s+regalas\s+(esta|este|eso)|me\s+vendes\s+(esta|este)|esta\s+por\s+fa(vor)?|este\s+por\s+fa(vor)?)[\s!.?]*$/i.test(t);
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
            const vague = this.isVagueImageCaption(caption);
            await this.reply(conv, msg.waId, vague
                ? 'Vi tu foto 👀 ¿Me dices el *nombre* o *código* del plato que quieres?\n\n' +
                    'Si prefieres, escribe *asesor* y te pasamos con el equipo.'
                : analysis.reply || this.aiService.imageFallbackReply());
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
        return (0, whatsapp_intent_1.looksLikeClearCartMessage)(text);
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
    extractAddressChangeTarget(text) {
        const raw = (text || '').trim();
        if (!raw)
            return null;
        const m = raw.match(/\b(?:cambia(?:r|me)?|actualiza(?:r|me)?|modifica(?:r|me)?|corrige|corregir)\s+(?:la\s+)?(?:direcci[oó]n|domicilio|ubicaci[oó]n)\s*(?:a|por|:)?\s*(.+)$/i) ||
            raw.match(/\b(?:la\s+)?(?:direcci[oó]n|domicilio)\s+(?:es|queda|ahora|nueva)\s*:?\s*(.+)$/i) ||
            raw.match(/\bnueva\s+direcci[oó]n\s*:?\s*(.+)$/i);
        const addr = this.normalizeDeliveryAddress((m?.[1] || '').trim());
        if (!addr || addr.length < 4)
            return null;
        if (this.looksLikeFoodNotAddress(addr))
            return null;
        return addr;
    }
    async tryHandleAddressChange(conv, waId, session, text, cfg) {
        if (!(0, whatsapp_session_intents_1.isAddressChangeIntent)(text) && !(0, whatsapp_session_intents_1.isAddressRejectionIntent)(text))
            return false;
        if ((0, whatsapp_session_intents_1.isAddressRejectionIntent)(text) && !this.extractAddressChangeTarget(text)) {
            const next = {
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
            await this.reply(conv, waId, 'Listo, quité esa dirección 👍\n' +
                '¿Cuál es tu *dirección correcta*? (calle/carrera, barrio o conjunto y una referencia).');
            return true;
        }
        const addr = this.extractAddressChangeTarget(text) ||
            this.extractDeliveryTail(text) ||
            null;
        if (!addr) {
            await this.reply(conv, waId, 'Claro, ¿cuál es la *nueva dirección* del domicilio?');
            await this.conversationService.saveSession(conv, { ...session, pendingMultiOrder: undefined, pendingMatch: undefined }, 'awaiting_address');
            return true;
        }
        let next = this.withDeliveryAddress({
            ...session,
            pendingMultiOrder: undefined,
            pendingMatch: undefined,
        }, addr);
        const fee = await this.ensureDeliveryFeeQuoted(next, cfg);
        next = fee.session;
        await this.conversationService.saveSession(conv, next, 'building_cart');
        const feeLine = fee.blocked
            ? `\n\n${fee.blocked}`
            : fee.notice
                ? `\n\n${fee.notice}`
                : '';
        await this.reply(conv, waId, `Listo, dirección actualizada:\n📍 _${next.address}_${feeLine}\n\n` +
            (next.cart.length
                ? `${this.formatCartOnly(next, this.deliveryFeeFor(next, cfg))}\n\n${this.formatContinueShoppingPrompt()}`
                : '¿Qué se te antoja pedir?'));
        return true;
    }
    async tryAbandonPendingSelection(conv, waId, session, text, cfg) {
        if (!(0, whatsapp_session_intents_1.isAbandonPendingSelectionIntent)(text))
            return false;
        if (!session.pendingAttribute &&
            !session.pendingMatch &&
            !session.pendingMultiOrder &&
            !session.pendingCompositionAsk) {
            return false;
        }
        const pa = session.pendingAttribute;
        let next = {
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
        const suffix = next.cart.length > 0
            ? `\n\n${this.formatCartOnly(next, this.deliveryFeeFor(next, cfg))}\n\n${this.formatContinueShoppingPrompt()}`
            : '\n\n¿Qué te gustaría pedir?';
        await this.reply(conv, waId, `Listo, lo dejamos pasar 👍${suffix}`);
        return true;
    }
    async tryHandleCartModification(conv, waId, session, text, products, cfg, probeText) {
        const probe = (probeText || text).trim();
        const trimmed = probe;
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
                await this.reply(conv, waId, `Listo, quité ${removedLabel}.\n\n${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}\n\n${this.formatContinueShoppingPrompt()}`);
                return true;
            }
        }
        if (await this.tryAbandonPendingSelection(conv, waId, session, text, cfg)) {
            return true;
        }
        if (this.isClearCartIntent(probe)) {
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
        const removalQuery = this.extractCartRemovalQuery(probe);
        if (!removalQuery)
            return false;
        if (!session.cart.length) {
            if (session.pendingAttribute &&
                this.normalizeForMatch(session.pendingAttribute.name).includes(this.normalizeForMatch(removalQuery))) {
                session = {
                    ...session,
                    pendingAttribute: undefined,
                    pendingMatch: undefined,
                };
                await this.conversationService.saveSession(conv, session, 'building_cart');
                await this.reply(conv, waId, `Listo, dejamos pasar *${removalQuery}* 👍 ¿Qué te gustaría pedir?`);
                return true;
            }
            await this.reply(conv, waId, `No tienes nada en el carrito ahora. Si quieres pedir *${removalQuery}*, dime y te lo agrego.`);
            return true;
        }
        const match = this.matchCartItemsForRemoval(removalQuery, session, products);
        if (match.kind === 'none') {
            await this.reply(conv, waId, `No encontré *${removalQuery}* en tu carrito.\n\n${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}`);
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
        await this.reply(conv, waId, `Listo, quité ${match.label}${removedNote}.\n\n${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}\n\n${this.formatContinueShoppingPrompt()}`);
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
        const raw = (text || '').trim();
        if (!raw || raw.length > 72)
            return false;
        const t = raw
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[¡!?.…,;:"'`´]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (!t)
            return false;
        if ((0, whatsapp_intent_1.isNothingElseOrderIntent)(raw))
            return true;
        if (/^(ya esta|ya esta todo|ya quedo|todo bien|asi esta|asi quedo|de una|mande(lo)?|envia(lo|me)?|hagalo|hagale|proceda|vamos|dale pues)$/.test(t) ||
            /\b((confirmar?|confirmo|confirmado|aprobar|apruebo|aprobado|finalizar|listo)\s+(el\s+)?pedido|pedido\s+(listo|confirmado|aprobado)|listo\s+pedido)\b/.test(t)) {
            return true;
        }
        const tokens = t.split(' ').filter(Boolean);
        if (!tokens.length || tokens.length > 6)
            return false;
        if (/\b(quiero|dame|ponme|agrega|agregame|pedir|ordenar|codigo|#\d+|gaseosa|pollo|medio|cuarto|domicilio\s+a)\b/.test(t)) {
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
        return tokens.some((tok) => confirmWords.some((w) => this.confirmTokenMatches(tok, w)));
    }
    confirmTokenMatches(token, word) {
        if (token === word)
            return true;
        if (word.length >= 4 && token.length <= word.length + 3 && token.startsWith(word)) {
            return /^o*$/.test(token.slice(word.length));
        }
        if (token.length < 4 || word.length < 4)
            return false;
        const dist = this.simpleEditDistance(token, word);
        const maxDist = word.length <= 5 ? 1 : word.length <= 8 ? 2 : 3;
        if (dist <= maxDist)
            return true;
        if (word.length >= 7 &&
            token.length === word.length &&
            token.slice(0, 3) === word.slice(0, 3) &&
            [...token].sort().join('') === [...word].sort().join('')) {
            return true;
        }
        return false;
    }
    simpleEditDistance(a, b) {
        if (a === b)
            return 0;
        if (!a.length)
            return b.length;
        if (!b.length)
            return a.length;
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
    isGreetingKeyword(text) {
        const t = text
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[¡!¿?.,;:]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (!t)
            return false;
        return /^(hola|hey|hi|buenas|buenos)(\s+(hola|hey|hi|buenas|buenos))*(\s+(dias|tardes|noches))?(\s+(hola|hey|hi))?$/.test(t) || /^(hola\s+)?buen(os|as)\s+(dias|tardes|noches)$/.test(t)
            || /^(menu|ver\s+menu)$/.test(t);
    }
    stripLeadingGreeting(text) {
        const raw = (text || '').trim();
        if (!raw)
            return raw;
        const stripped = raw
            .replace(/^(hola|hey|hi|buenas|buenos)(\s+(hola|hey|hi|buenas|buenos))*(\s+(días|dias|tardes|noches))?[^\w\n]*/i, '')
            .trim();
        return stripped || raw;
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
            /\brecojo\s+(en|por|a|yo)\b/i.test(t) ||
            /\b(paso|pasar[eé])\s+por\s+(el\s+)?(local|restaurante|all[ií]|allá|él|el)\b/i.test(t) ||
            /\byo\s+paso(\s+por)?\b/i.test(t) ||
            /\bya\s+paso\b/i.test(t) ||
            /\bal[ií]st(a|e|o)(lo|la)?\b.{0,40}\bpaso\b/i.test(t) ||
            /\b(lo\s+)?paso\s+a\s+(buscar|recoger)\b/i.test(t) ||
            /\bpasa(r[eé])?\s+a\s+(buscar|recoger)\b/i.test(t) ||
            /\bvoy\s+(pasando|para\s+all[aá]|para\s+el\s+local)\b/i.test(t));
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
            deliveryFeeCalculated: 0,
            deliveryDistanceKm: null,
            deliveryOutOfCoverage: false,
            deliveryLat: null,
            deliveryLng: null,
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
        const prev = (session.address || '').trim();
        const addressChanged = !prev || prev.toLowerCase() !== addr.toLowerCase();
        const strong = this.isStrongExplicitAddress(addr) ||
            (this.isPlausibleDeliveryAddress(addr) && this.looksLikeAddress(addr));
        let next = {
            ...session,
            orderType: 'delivery',
            address: addr,
            fulfillmentChosen: true,
            addressConfirmed: strong || (!addressChanged && !!session.addressConfirmed),
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
    extractDeliveryInstructionNote(address) {
        const t = (address || '').trim();
        if (!t)
            return null;
        const bits = [];
        if (/\bporter[ií]a\b/i.test(t))
            bits.push('Entregar en portería');
        if (/\brecepci[oó]n\b/i.test(t))
            bits.push('Entregar en recepción');
        const hotel = t.match(/\bhotel\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9][\wÁÉÍÓÚÜÑáéíóúüñ\s.'-]{1,40})/i);
        if (hotel?.[1])
            bits.push(`Hotel ${hotel[1].trim()}`);
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
    applyDeliveryHintFromMessage(session, text) {
        return this.withDeliveryAddress(session, this.extractDeliveryTail(text));
    }
    resolveCustomerIntent(text, session, products, cfg, compound) {
        const exploringMenu = this.catalogService.isMenuExploreIntent(text, products) ||
            !!session.pendingCategoryBrowse?.categories?.length;
        return (0, whatsapp_intent_1.classifyWhatsappCustomerIntent)({
            text,
            cartLength: session.cart.length,
            looksLikeSideModificationNote: this.catalogService.looksLikeSideModificationNote(text),
            isPriceInquiry: this.catalogService.isPriceInquiryIntent(text),
            isMenuExplore: exploringMenu,
            isCategoryBrowse: this.catalogService.isCategoryBrowseQuestion(text),
            isGenericProductInquiry: this.catalogService.isGenericProductInquiry(text),
            isOffTopicChitchat: this.catalogService.isOffTopicChitchat(text),
            isHumanRequest: (0, whatsapp_intent_1.isHumanHandoffRequest)(text),
            isPaymentMention: !!(0, whatsapp_payment_methods_1.findPaymentMethodByText)(text, cfg.paymentMethods),
            looksLikeAddressOnly: this.isAddressOnlyCustomerMessage(text, compound),
            compoundAddress: compound?.address,
            compoundProductText: compound?.productText,
        });
    }
    async tryHandleInlineOrderNoteEarly(conv, waId, session, text, intent, cfg) {
        if (session.cart.length === 0)
            return false;
        if (session.pendingAttribute || session.pendingMatch || session.pendingMultiOrder) {
            return false;
        }
        if (this.catalogService.looksLikeExplicitAddProductRequest(text))
            return false;
        if (intent !== 'side_note' && !this.looksLikeStandaloneOrderNote(text)) {
            return false;
        }
        if (this.catalogService.looksLikeSideModificationNote(text) &&
            /\b(otra\s+cosa|algo\s+m[aá]s|qu[eé]\s+otra|en\s+vez)\b/i.test(text) &&
            !/\bpor\s+(?:m[aá]s\s+)?(?:papa(?:s|\s+salada)?|yuca(?:\s+frita)?|arepas?|aguacate|maduro|arroz|pl[aá]tano)\b/i.test(text)) {
            await this.reply(conv, waId, `Sí 👍 La ensalada se puede cambiar por *papa salada* o *yuca frita*.\n\n` +
                `Dime cómo lo dejas, por ejemplo:\n` +
                `• *sin ensalada, papa salada*\n` +
                `• *ensalada por yuca frita*`);
            return true;
        }
        const applied = this.applyInlineOrderNote(session, text);
        session = applied.session;
        await this.conversationService.saveSession(conv, session);
        const ack = this.formatInlineNoteAck(session, applied.notedItemIndex);
        await this.reply(conv, waId, `${ack}\n\n${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}\n\n${this.formatContinueShoppingPrompt()}`);
        return true;
    }
    async tryHandleConfirmCurrentAddress(conv, waId, session, text, cfg) {
        if (!(0, whatsapp_session_intents_1.isConfirmCurrentAddressIntent)(text))
            return false;
        if (session.cart.length === 0)
            return false;
        const addr = (session.address || '').trim();
        if (!addr || !this.isStrongExplicitAddress(addr)) {
            await this.conversationService.saveSession(conv, session, 'building_cart');
            await this.reply(conv, waId, 'Dale 👍 ¿Me escribes la *dirección* completa? (ej. _Carrera 80 #2-20_).');
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
        const hasFee = typeof session.deliveryFeeCalculated === 'number' &&
            session.deliveryFeeCalculated >= 0 &&
            !session.deliveryOutOfCoverage;
        if (!hasFee) {
            const feeOk = await this.recalculateDeliveryFee(session, cfg);
            session = feeOk.session;
            await this.conversationService.saveSession(conv, session, 'building_cart');
            if (feeOk.blocked) {
                await this.reply(conv, waId, `Sigue valiendo _${session.address}_\n\n${feeOk.blocked}`);
                return true;
            }
            const feeLine = feeOk.notice ? `\n${feeOk.notice}` : '';
            await this.reply(conv, waId, `📍 Perfecto, enviamos a _${session.address}_${feeLine}\n\n` +
                `${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}\n\n` +
                `¿Algo más o escribimos *listo* / *confirmar*?`);
            return true;
        }
        await this.conversationService.saveSession(conv, session, 'building_cart');
        await this.reply(conv, waId, `📍 Listo, seguimos con _${session.address}_\n\n` +
            `${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}\n\n` +
            `¿Algo más o escribimos *listo* / *confirmar*?`);
        return true;
    }
    async tryHandleAddressClarification(conv, waId, session, text, cfg) {
        if (!(0, whatsapp_session_intents_1.isAddressClarificationIntent)(text))
            return false;
        if (session.cart.length === 0)
            return false;
        let addr = session.address?.trim() || null;
        if (!addr || !this.isPlausibleDeliveryAddress(addr)) {
            const recent = await this.conversationService.getRecentMessageTexts(conv.id, 12);
            for (let i = recent.length - 1; i >= 0; i--) {
                const line = recent[i];
                if (!/^Cliente:\s*/i.test(line))
                    continue;
                const body = line.replace(/^Cliente:\s*/i, '').trim();
                if (!body || (0, whatsapp_session_intents_1.isAddressClarificationIntent)(body))
                    continue;
                if ((0, whatsapp_intent_1.looksLikeAddressOnlyMessage)(body) ||
                    this.isPlausibleDeliveryAddress(body)) {
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
            await this.reply(conv, waId, 'Perdón 🙏 Entendí mal. ¿Me vuelves a escribir la *dirección* del domicilio? ' +
                '(ej. _CRA 80b #2-38_).');
            return true;
        }
        session = this.withDeliveryAddress({
            ...session,
            fulfillmentChosen: true,
            orderType: 'delivery',
            addressConfirmed: true,
            deliveryFeeCalculated: undefined,
            deliveryDistanceKm: undefined,
            deliveryOutOfCoverage: false,
            deliveryLat: null,
            deliveryLng: null,
        }, addr);
        const feeOk = await this.recalculateDeliveryFee(session, cfg);
        session = feeOk.session;
        await this.conversationService.saveSession(conv, session, 'building_cart');
        if (feeOk.blocked) {
            await this.reply(conv, waId, `Perfecto, ya registré la dirección _${session.address}_.\n\n${feeOk.blocked}`);
            return true;
        }
        const feeLine = feeOk.notice ? `\n${feeOk.notice}` : '';
        await this.reply(conv, waId, `Perfecto, ya registré la dirección _${session.address}_${feeLine}\n\n` +
            `${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}\n\n` +
            `¿Algo más o escribimos *listo* / *confirmar*?`);
        return true;
    }
    async tryHandleAddressOnlyWhileBuildingCart(conv, waId, session, originalText, compound, cfg) {
        if (session.cart.length === 0)
            return false;
        const clearStreetAddress = this.isAddressOnlyCustomerMessage(originalText, compound) &&
            this.isPlausibleDeliveryAddress(originalText.trim()) &&
            /\b(calle|carrera|cra|cll|av\.?|avenida|diag|dg|transversal|#)\b/i.test(originalText);
        if (!clearStreetAddress &&
            (session.pendingAttribute || session.pendingMatch || session.pendingMultiOrder)) {
            return false;
        }
        if ((0, whatsapp_intent_1.looksLikeClearCartMessage)(originalText))
            return false;
        if (await this.tryAppendDeliveryAccessReference(conv, waId, session, originalText, cfg)) {
            return true;
        }
        if ((0, whatsapp_session_intents_1.isReuseLastAddressIntent)(originalText) &&
            session.lastDeliveryAddress?.trim() &&
            !session.addressConfirmed) {
            const addr = session.lastDeliveryAddress.trim();
            session = this.withDeliveryAddress({
                ...session,
                fulfillmentChosen: true,
                orderType: 'delivery',
                addressConfirmed: true,
                deliveryFeeCalculated: undefined,
                deliveryDistanceKm: undefined,
                deliveryOutOfCoverage: false,
                deliveryLat: null,
                deliveryLng: null,
            }, addr);
            const feeOk = await this.recalculateDeliveryFee(session, cfg);
            session = feeOk.session;
            await this.conversationService.saveSession(conv, session, 'building_cart');
            if (feeOk.blocked) {
                await this.reply(conv, waId, `Dirección anotada: _${session.address}_\n\n${feeOk.blocked}`);
                return true;
            }
            const feeLine = feeOk.notice ? `\n${feeOk.notice}` : '';
            await this.reply(conv, waId, `📍 Misma dirección ✅ _${session.address}_${feeLine}\n\n` +
                `${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}\n\n` +
                `¿Algo más o escribimos *listo* / *confirmar*?`);
            return true;
        }
        if (conv.state &&
            [
                'awaiting_payment',
                'awaiting_notes',
                'awaiting_phone',
                'awaiting_name',
                'confirming',
                'completed',
                'closed',
                'human_takeover',
            ].includes(conv.state)) {
            return false;
        }
        if (!this.isAddressOnlyCustomerMessage(originalText, compound))
            return false;
        const addr = compound.address ||
            this.extractDeliveryTail(originalText) ||
            (this.isPlausibleDeliveryAddress(originalText.trim())
                ? originalText.trim()
                : null);
        if (!addr || !this.isPlausibleDeliveryAddress(addr))
            return false;
        session = this.withDeliveryAddress({
            ...session,
            fulfillmentChosen: true,
            orderType: 'delivery',
            pendingAttribute: undefined,
            pendingMatch: undefined,
            pendingMultiOrder: undefined,
        }, addr);
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
            await this.reply(conv, waId, `Dirección anotada: _${session.address}_\n\n${feeOk.blocked}`);
            return true;
        }
        const feeLine = feeOk.notice ? `\n${feeOk.notice}` : '';
        await this.reply(conv, waId, `📍 Domicilio anotado: _${session.address}_${feeLine}\n\n` +
            `${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}\n\n` +
            `¿Algo más o escribimos *listo* / *confirmar*?`);
        return true;
    }
    async tryAppendDeliveryAccessReference(conv, waId, session, text, cfg) {
        const raw = (text || '').trim();
        if (!raw || raw.length < 4)
            return false;
        if (!session.address?.trim() || !session.addressConfirmed)
            return false;
        if (!this.isStrongExplicitAddress(session.address))
            return false;
        if (this.isStrongExplicitAddress(raw))
            return false;
        if (!this.looksLikeDeliveryAccessReference(raw))
            return false;
        const note = raw.replace(/\s+/g, ' ').trim().slice(0, 160);
        const addrBase = session.address
            .replace(/\s*\(ref\.\s*[^)]*\)\s*$/i, '')
            .trim();
        const alreadyInAddr = addrBase.toLowerCase().includes(note.toLowerCase());
        const nextAddr = alreadyInAddr ? session.address : `${addrBase} — ${note}`.slice(0, 240);
        session = this.appendCustomerNote({
            ...session,
            address: nextAddr,
        }, note);
        await this.conversationService.saveSession(conv, session, 'building_cart');
        await this.reply(conv, waId, `📝 Referencia anotada: _${note}_\n` +
            `📍 Sigue valiendo: _${session.address}_\n\n` +
            `${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}\n\n` +
            `¿Algo más o escribimos *listo* / *confirmar*?`);
        return true;
    }
    looksLikeDeliveryAccessReference(text) {
        const t = (text || '').trim();
        if (!t || t.length < 4 || t.length > 120)
            return false;
        if ((0, whatsapp_intent_1.looksLikeClearCartMessage)(t) || (0, whatsapp_intent_1.looksLikeNonAddressCommand)(t))
            return false;
        if (this.looksLikeFoodNotAddress(t))
            return false;
        if (/\b(calle|carrera|cra|cll|av\.?|avenida|diag(?:onal)?|dg|transversal|tv)\b/i.test(t) &&
            /\d/.test(t)) {
            return false;
        }
        if (/#\s*\d/i.test(t) && /\b(calle|carrera|cra|diag|dg|av)\b/i.test(t))
            return false;
        const n = t
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
        if (/\b(porton|puerta|reja|timbre|intercomunicador|porteria|recepcion)\b/.test(n)) {
            return true;
        }
        if (/\b(mitad\s+de\s+(?:la\s+)?cuadra|al\s+fondo|esquina|segundo\s+piso|tercer\s+piso|casa\s+(?:de\s+)?color|fachada|frente\s+a(?:l)?\s+(?:un\s+)?(?:parqueadero|parque|tienda|iglesia))\b/.test(n)) {
            return true;
        }
        if (/\b(verde|azul|rojo|roja|blanco|blanca|negro|negra|cafe|amarrillo|amarillo|gris)\b/.test(n) &&
            /\b(porton|puerta|reja|casa|grande|pequeno|pequena|fachada|pintura)\b/.test(n)) {
            return true;
        }
        return false;
    }
    isAddressOnlyCustomerMessage(text, compound) {
        const raw = (text || '').trim();
        if (raw.length < 4)
            return false;
        if (this.catalogService.isMenuExploreIntent(raw, []) ||
            this.catalogService.isCategoryBrowseQuestion(raw) ||
            (0, whatsapp_intent_1.looksLikeNonAddressCommand)(raw) ||
            this.looksLikeFoodNotAddress(raw) ||
            this.catalogService.looksLikeSideModificationNote(raw)) {
            return false;
        }
        if (this.catalogService.looksLikeClearlyMultiDishOrder(raw) ||
            this.catalogService.looksLikeFoodPlusDrinkOrder(raw) ||
            this.catalogService.looksLikeMultiItemOrderMessage(raw)) {
            return false;
        }
        if ((0, whatsapp_intent_1.looksLikeAddressOnlyMessage)(raw, {
            compoundAddress: compound?.address,
            compoundProductText: compound?.productText,
        })) {
            return true;
        }
        if (this.looksLikeLandmarkOrComplexName(raw, { allowGenericPhrase: true })) {
            return true;
        }
        const tail = this.extractDeliveryTail(raw);
        if (tail && (0, whatsapp_intent_1.looksLikeAddressOnlyMessage)(tail)) {
            return true;
        }
        return false;
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
        t = (0, whatsapp_compound_parse_1.stripTrailingAddressFluff)(t);
        t = t
            .replace(/^(?:me\s+)?(?:colaboras|ayudas|colaborame|ayudame|puedes\s+ayudarme?)\b[\s\w.]*?(?=\bdirecci[oó]n\b|$)/i, '')
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
    splitAddressCustomerHint(address) {
        const trimmed = (address || '').trim();
        if (!trimmed)
            return { geocodeQuery: '', customerHint: '' };
        const paren = trimmed.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
        if (paren?.[1] && paren[2]) {
            return { geocodeQuery: paren[1].trim(), customerHint: paren[2].trim() };
        }
        return { geocodeQuery: trimmed, customerHint: trimmed };
    }
    mergeGeocodedAddressWithCustomerHint(geocoded, customerHint) {
        const geo = (geocoded || '').trim();
        const hint = (customerHint || '').trim();
        if (!geo)
            return hint;
        if (!hint)
            return geo;
        const norm = (s) => s
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        const ng = norm(geo);
        const nh = norm(hint);
        if (ng === nh || ng.includes(nh))
            return geo;
        const existingParen = geo.match(/\(([^)]+)\)\s*$/);
        if (existingParen?.[1] && norm(existingParen[1]) === nh)
            return geo;
        if (this.isStrongExplicitAddress(hint) || this.looksLikeAddress(hint)) {
            if (this.streetsClearlyDisagree(nh, ng)) {
                return `${hint} (ref. mapa: ${geo})`.slice(0, 240);
            }
            if (ng.includes(nh) || nh.includes(ng.slice(0, Math.min(24, ng.length)))) {
                return `${hint} (mapa: ${geo})`.slice(0, 240);
            }
            return `${hint} (ref. mapa: ${geo})`.slice(0, 240);
        }
        return `${geo} (${hint.slice(0, 120)})`;
    }
    streetsClearlyDisagree(customerNorm, geoNorm) {
        const extract = (s) => {
            const m = s.match(/\b(calle|cll?\.?|carrera|cra\.?|kr\.?|av(?:enida|\.)?|diag(?:onal)?\.?|transversal|tv\.?)\s*([0-9]+[a-z]?)\b/i);
            if (!m?.[1] || !m[2])
                return null;
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
        if (!a || !b)
            return false;
        if (a.kind !== b.kind)
            return true;
        const base = (n) => n.replace(/[a-z]+$/i, '');
        if (a.num !== b.num && base(a.num) !== base(b.num))
            return true;
        if (a.num !== b.num && (base(a.num) === base(b.num) || a.num.startsWith(base(b.num)) || b.num.startsWith(base(a.num)))) {
            return a.num !== b.num;
        }
        return false;
    }
    isPlausibleDeliveryAddress(text) {
        const t = text.trim();
        if (!t || t.length < 3)
            return false;
        if (this.isConfirmKeyword(t) || this.isGreetingKeyword(t))
            return false;
        if (this.isPickupIntent(t))
            return false;
        if ((0, whatsapp_session_intents_1.isConfirmCurrentAddressIntent)(t))
            return false;
        if (/^(contraentrega|efectivo|mercado\s*pago|humano)$/i.test(t))
            return false;
        if ((0, whatsapp_intent_1.isDeliveryLogisticsFluff)(t))
            return false;
        if (this.looksLikeFoodNotAddress(t))
            return false;
        if (/^(?:a\s+)?(?:esta|esa|la\s+misma)\s+(?:plis|porfa|por\s+favor)?$/i.test(t) ||
            /^(?:esta|esa)\s+plis$/i.test(t)) {
            return false;
        }
        if (/\b(minutos?|mins?|horas?)\b/i.test(t) && !/\b(habitaci[oó]n|apto|apartamento|calle|carrera|barrio|torre|conjunto|hospital)\b/i.test(t)) {
            return false;
        }
        if (/\b(habitaci[oó]n|apto?|apartamento|cuarto|suite|oficina|hostal|hotel|residencia)\b/i.test(t) &&
            /\d/.test(t)) {
            return true;
        }
        if (/\b(la casa|mi casa|mi direccion|mi dirección)\b/i.test(t)) {
            return true;
        }
        if (/\bdomicilios?\b/i.test(t) &&
            (whatsapp_intent_1.PPP_ZONE_LANDMARK_RE.test(t) ||
                /\b(calle|carrera|cra|apto|apartamento|torre|conjunto|hospital|barrio|terrazas)\b/i.test(t) ||
                /\d/.test(t))) {
            return true;
        }
        if (this.looksLikeAddress(t))
            return true;
        if (this.looksLikeExplicitLandmarkKeyword(t))
            return true;
        return t.length >= 6 && /\d/.test(t);
    }
    looksLikeExplicitLandmarkKeyword(text) {
        return ((0, whatsapp_intent_1.looksLikeAddressOnlyMessage)(text) ||
            whatsapp_intent_1.PPP_ZONE_LANDMARK_RE.test(text) ||
            /\b(kennedy|bosa|fontib[oó]n|engativ[aá]|suba|usaqu[eé]n|chapinero|soacha|mosquera)\b/i.test(text));
    }
    looksLikeLandmarkOrComplexName(text, opts) {
        const t = text.trim();
        if (t.length < 4 || t.length > 90)
            return false;
        if ((0, whatsapp_intent_1.looksLikeClearCartMessage)(t) || (0, whatsapp_intent_1.looksLikeNonAddressCommand)(t))
            return false;
        if (this.looksLikeFoodNotAddress(t))
            return false;
        if (this.looksLikeDeliveryAccessReference(t))
            return false;
        if (this.catalogService.isMenuExploreIntent(t, []) ||
            this.catalogService.isCategoryBrowseQuestion(t)) {
            return false;
        }
        if (this.looksLikeExplicitLandmarkKeyword(t))
            return true;
        if (!opts?.allowGenericPhrase)
            return false;
        if (/\bdomicilios?\b/i.test(t) &&
            !/\b(calle|carrera|cra|cll|av|avenida|torre|apto|apartamento|conjunto|barrio|hospital|cl[ií]nica|urbanizaci[oó]n)\b/i.test(t) &&
            !/\d/.test(t)) {
            return false;
        }
        if (/\b(solicitar|pedir|hacer|tramitar)\b/i.test(t) &&
            !/\b(calle|carrera|torre|apto|apartamento|conjunto|barrio|hospital)\b/i.test(t) &&
            !/\d/.test(t)) {
            return false;
        }
        const words = t.split(/\s+/).filter(Boolean);
        if (words.length >= 2 &&
            words.length <= 7 &&
            !/\d/.test(t) &&
            /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s.'°-]+$/.test(t) &&
            !/^(hola|buenas|buenos|gracias|listo|ok|dale|claro|menu|menú|carta|quiero|dame|ponme|que|qué|puedo|puedes|solicitar|pedir|asi|nada|eso|solo|solamente)\b/i.test(t) &&
            !/\b(hay|tienen|tiene|tienes|ofrecen|ofreces|bebidas?|sopas?|pollos?|cambiar|ensalada|otra\s+cosa|guarnici[oó]n|nada\s+m[aá]s|nomas|eso\s+es\s+todo)\b/i.test(t) &&
            !(0, whatsapp_session_intents_1.isConfirmCurrentAddressIntent)(t) &&
            !/\b(esta|esa|la\s+misma)\s+(direcci[oó]n|domicilio|ubicaci[oó]n)\b/i.test(t)) {
            return true;
        }
        return false;
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
        if (this.looksLikeLandmarkOrComplexName(t) && t.length >= 6)
            return true;
        return false;
    }
    looksLikeFoodNotAddress(text) {
        const t = text.trim().toLowerCase();
        if (/^(?:la\s+|el\s+)?(broaster|frito|frita|asado|asada|plancha|apanad[oa]|francesa|salada|yuca|arepa|gaseosa|combo|solo|medio|cuarto)s?\b/i.test(t)) {
            return true;
        }
        if (/\b(broaster|frito|asado|plancha|gaseosa|arepa|combo|mondongo|ajiaco|pechuga|costilla|pollo|arroz|sopa|bandeja|mojarra|churrasco|hamburguesa|alitas?|ejecutivo|sancocho|limonada|bebidas?|ensalada|papas?|yuca|aguacate|maduro)\b/i.test(t) &&
            !/\b(calle|carrera|cra|cll|av|avenida|barrio|habitaci[oó]n|apto|apartamento|torre|#)\b/i.test(t)) {
            return true;
        }
        if (/\bcambiar\b/i.test(t) &&
            /\b(ensalada|papa|papas|yuca|arepa|aguacate|maduro|guarnici[oó]n|acompa[nñ]amiento)\b/i.test(t)) {
            return true;
        }
        if (this.catalogService.looksLikeSideModificationNote(t))
            return true;
        if (/\b(porci[oó]n|porciones|cantidad|taza|gramos|personas)\b/i.test(t) &&
            /\b(peque[nñ]a|peque[nñ]as|chica|chicas|menos|m[aá]s\s+peque|allcanza|alcanza|rinde)\b/i.test(t)) {
            return true;
        }
        if (this.catalogService.isServingSizeChangeIntent(t))
            return true;
        if (this.catalogService.isProductDescriptionInquiry(t))
            return true;
        if (this.catalogService.isAvailabilityInquiry(t))
            return true;
        if ((0, whatsapp_session_intents_1.isAddressRejectionIntent)(t) || (0, whatsapp_session_intents_1.isAddressChangeIntent)(t))
            return true;
        if (/\b(que|qué)\b/i.test(t) &&
            /\b(hay|tienen|tiene|tienes|ofrecen)\b/i.test(t)) {
            return true;
        }
        return false;
    }
    extractDeliveryTail(text) {
        const raw = (text || '')
            .trim()
            .replace(/\bpar\s+ale\b/gi, 'para el')
            .replace(/\bpar\s+a\s+la\b/gi, 'para la')
            .replace(/\bpar\s+a\s+el\b/gi, 'para el')
            .replace(/\bpar\s+el\b/gi, 'para el')
            .replace(/\bpar\s+la\b/gi, 'para la')
            .replace(/\bpala\s+el\b/gi, 'para el')
            .replace(/\bpala\s+la\b/gi, 'para la');
        if (!raw)
            return null;
        if ((0, whatsapp_intent_1.looksLikeAddressOnlyMessage)(raw) ||
            (whatsapp_intent_1.PPP_ZONE_LANDMARK_RE.test(raw) &&
                /\b(torre|apto|apartamento|int\.?|interior|bloque)\b/i.test(raw))) {
            const full = this.normalizeDeliveryAddress(raw);
            if (full && !(0, whatsapp_intent_1.isDeliveryLogisticsFluff)(full) && this.isPlausibleDeliveryAddress(full)) {
                return full;
            }
        }
        const candidates = [];
        const endPatterns = [
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
            if (m?.[1])
                candidates.push(m[1]);
        }
        const paraRe = /\bpara\b/gi;
        let lastParaIdx = -1;
        let pm;
        while ((pm = paraRe.exec(raw)) !== null)
            lastParaIdx = pm.index;
        if (lastParaIdx >= 0) {
            const after = raw.slice(lastParaIdx).replace(/^\s*para\s+/i, '').trim();
            if (after)
                candidates.push(after);
        }
        const inlinePatterns = [
            /\b(?:para|a|en)\s+(?:la\s+|el\s+)?(habitaci[oó]n\s*(?:n[°o]?\.?\s*)?\d{1,4}[a-z]?)\b/i,
            /\b(?:para|a|en)\s+(?:la\s+|el\s+)?((?:apto?|apartamento|cuarto|suite|oficina)\s*(?:n[°o]?\.?\s*)?\d{1,4}[a-z]?)\b/i,
            /\b(?:para|a|en)\s+(?:la\s+|el\s+)?((?:calle|carrera|cra|cll|av\.?|avenida)\s+\d[\w\s#\-.]{2,40})\b/i,
            /\b(habitaci[oó]n\s*(?:n[°o]?\.?\s*)?\d{1,4}[a-z]?)\b/i,
            /\b(?:apto?|apartamento|cuarto|suite|oficina)\s*(?:n[°o]?\.?\s*)?\d{1,4}[a-z]?\b/i,
            /\b(?:torre|bloque|piso|interior|local)\s+[a-z0-9#\-\s]{1,24}\d{1,4}[a-z]?\b/i,
            /\b(casa\s*\d{1,4}[a-z]?(?:\s+[^\n,]{0,60})?(?:terrazas?|bosques?|castilla|tabaku|tintal)[^\n,]{0,40})/i,
        ];
        for (const pattern of inlinePatterns) {
            const m = raw.match(pattern);
            if (m?.[0])
                candidates.push((0, whatsapp_compound_parse_1.stripTrailingAddressFluff)(m[1] || m[0]));
        }
        candidates.sort((a, b) => b.trim().length - a.trim().length);
        const orderLike = this.catalogService.looksLikeMultiItemOrderMessage(raw) ||
            this.catalogService.looksLikeFoodPlusDrinkOrder(raw) ||
            /\b(quiero|dame|pedi|pedir|medio|cuarto|gaseosa|pollo)\b/i.test(raw);
        for (const cand of candidates) {
            const addr = this.normalizeDeliveryAddress(cand);
            if (!addr || addr.length < 3)
                continue;
            if (this.isPickupOnlyDeliveryClause(addr))
                continue;
            if ((0, whatsapp_intent_1.isDeliveryLogisticsFluff)(addr))
                continue;
            if (this.looksLikeFoodNotAddress(addr))
                continue;
            if (orderLike) {
                if (this.isPlausibleDeliveryAddress(addr) ||
                    this.looksLikeLandmarkOrComplexName(addr, { allowGenericPhrase: true }) ||
                    (addr.length >= 4 &&
                        !this.isConfirmKeyword(addr) &&
                        !this.isGreetingKeyword(addr) &&
                        !/^(llevar|recoger|el\s+local|all[ií]|allá|mi|me|yo)\b/i.test(addr))) {
                    return addr;
                }
                continue;
            }
            if (!this.isPlausibleDeliveryAddress(addr))
                continue;
            return addr;
        }
        return null;
    }
    isPickupOnlyDeliveryClause(text) {
        const t = text.trim().toLowerCase();
        if ((0, whatsapp_intent_1.isDeliveryLogisticsFluff)(t))
            return true;
        if (/^(llevar|recoger|el\s+local|el\s+restaurante|all[ií]|allá)\b/i.test(t))
            return true;
        if (/^llevar\b.{0,20}$/i.test(t))
            return true;
        return false;
    }
    splitProductAndDelivery(text) {
        const address = this.extractDeliveryTail(text);
        if (!address)
            return { productText: text.trim(), address: null };
        let productText = text.trim();
        const escaped = address.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        productText = productText
            .replace(new RegExp(`(?:^|[.,;:\\n]\\s*)(?:para|direcci[oó]n|domicilio)\\s*[:\\-]?\\s*${escaped}\\s*$`, 'i'), '')
            .replace(new RegExp(`\\b(?:para|a|en)\\s+(?:la\\s+|el\\s+)?${escaped}\\s*$`, 'i'), '')
            .replace(new RegExp(`\\bpara\\b\\s+${escaped}\\s*$`, 'i'), '')
            .replace(/[.,;:\s]+$/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        if (productText === text.trim() || productText.length < 3) {
            const paraRe = /\bpara\b/gi;
            let lastParaIdx = -1;
            let pm;
            while ((pm = paraRe.exec(text)) !== null)
                lastParaIdx = pm.index;
            if (lastParaIdx > 0) {
                const head = text.slice(0, lastParaIdx).replace(/[.,;:\s]+$/g, '').trim();
                if (head.length >= 3)
                    productText = head;
            }
            else if (lastParaIdx === 0) {
                productText = '';
            }
        }
        if (!productText.trim() && address) {
            return { productText: '', address };
        }
        return { productText: productText || text.trim(), address };
    }
    parseCompoundOrderMessage(text) {
        let working = (text || '').trim().replace(/\s*\n+\s*/g, ' ');
        let phone = null;
        let customerName = null;
        let phoneUsesWhatsapp = false;
        working = working
            .replace(/\b(?:pago|pagar|pagarte|pagarle|transferir|cancelo|te\s+cancelo)\s+(?:por|con|x|en)\s+(?:nequi|daviplata|llave|efectivo|transferencia|contraentrega)\b/gi, ' ')
            .replace(/\b(?:para\s+pagarte|para\s+pagar)\s+(?:por|con|en)\s+\w+\b/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
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
        if (!customerName) {
            const leading = working.match(/^([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2,}(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2,}){0,2})\s+(?=ser[ií]a\b|quiero\b|dame\b|ponme\b|necesito\b|pido\b|un\b|una\b)/i);
            if (leading?.[1]) {
                const candidate = leading[1].replace(/\s+/g, ' ').trim();
                const words = candidate.split(/\s+/);
                const last = words[words.length - 1]?.toLowerCase() || '';
                if (!/\b(pollo|arroz|sopa|bandeja|mojarra|bebida|gaseosa|combo|broaster)\b/i.test(candidate) &&
                    !/^(un|una|el|la|los|las)$/i.test(last) &&
                    words.length <= 3) {
                    customerName = candidate;
                    working = working.slice(leading[0].length).replace(/\s+/g, ' ').trim();
                }
            }
        }
        const { productText, address } = this.splitProductAndDelivery(working);
        if (address) {
            return { productText, address, phone, customerName, phoneUsesWhatsapp };
        }
        const embedded = (0, whatsapp_compound_parse_1.splitTrailingEmbeddedAddress)(working);
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
        if ((0, whatsapp_intent_1.isDeliveryLogisticsFluff)(text))
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
        if (/\b(calle|carrera|cra|cll|av\.?|avenida|diag|diagonal|transversal|barrio|conjunto|apto|apartamento|torre|casa|mz|manzana|#|hospital|cl[ií]nica|urbanizaci[oó]n)\b/i.test(t)) {
            return true;
        }
        if (this.looksLikeLandmarkOrComplexName(text, { allowGenericPhrase: true })) {
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
    formatDeliverySetupEmptyCartReply() {
        return (`Con gusto, voy a tomar tu pedido a *domicilio* ✅\n\n` +
            `¿Qué se te antoja pedir? Puedes decir el *nombre* del plato o el *código*, o escribe *menú*.\n` +
            `_La dirección te la pido cuando confirmemos el pedido._`);
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
        if (t.length < 4 || t.length > 280)
            return false;
        if ((0, whatsapp_intent_1.looksLikeAddressOnlyMessage)(t) ||
            this.isAddressOnlyCustomerMessage(t) ||
            (whatsapp_intent_1.PPP_ZONE_LANDMARK_RE.test(t) &&
                /\b(torre|apto|apartamento|int\.?|interior|bloque)\b/i.test(t))) {
            return false;
        }
        if ((0, whatsapp_intent_1.looksLikeExplicitCartItemNote)(t))
            return true;
        if (this.catalogService.looksLikeExplicitAddProductRequest(t))
            return false;
        if (this.catalogService.looksLikeSideModificationNote(t))
            return true;
        if (/\b(dame|ponme|agrega|agregar|adicionar|adiciona|adicioname|pedir|ordenar|confirmar|men[uú]|c[oó]digo)\b/.test(lower)) {
            return false;
        }
        if (/\bquiero\b/.test(lower) &&
            !/\bno\s+quiero\b/.test(lower) &&
            !/\bquiero\s+(mas|más)\b/.test(lower)) {
            return false;
        }
        const patterns = [
            /^(sin|no\s+quiero)\s+/i,
            /\b(platos?\s*y\s*cubiertos?|solo\s*cubiertos?|con\s*cubiertos?)\b/i,
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
    extractCartItemNotePayload(text) {
        const t = text.trim();
        if (!t)
            return null;
        const quoted = t.match(/["“«]([^"”»]{2,160})["”»]/);
        if (quoted?.[1]?.trim()) {
            const before = t
                .slice(0, quoted.index ?? 0)
                .replace(/\b(pon(?:me|le)?|agrega(?:r|me|le)?|a[nñ]ade|deja|escribe)\s+(?:una?\s+)?notas?\s*/i, '')
                .replace(/^(en|para|de|a)\s+/i, '')
                .replace(/^(la|el|las|los|este|esta|esa|ese)\s+/i, '')
                .replace(/[:\-–—]+\s*$/g, '')
                .trim();
            return {
                note: quoted[1].trim(),
                productHint: before.length >= 3 && before.length <= 48 ? before : null,
            };
        }
        const labeled = t.match(/\bnotas?\s+(?:en|para|de|a)\s+(?:la|el|las|los)?\s*([a-záéíóúñüA-ZÁÉÍÓÚÑÜ\s]{3,40}?)\s*[:\-–—]\s*(.+)$/i);
        if (labeled?.[2]?.trim()) {
            return {
                note: labeled[2].trim().replace(/^["“«]|["”»]$/g, ''),
                productHint: labeled[1].trim(),
            };
        }
        const colon = t.match(/^(?:pon(?:me|le)?|agrega(?:r|me|le)?|a[nñ]ade|deja|escribe)\s+(?:una?\s+)?notas?\s*[:\-–—]\s*(.+)$/i);
        if (colon?.[1]?.trim()) {
            return { note: colon[1].trim().replace(/^["“«]|["”»]$/g, ''), productHint: null };
        }
        if (/^(nota|notas?)[:\s]/i.test(t)) {
            const rest = t.replace(/^(nota|notas?)[:\s]+/i, '').trim();
            if (rest.length >= 2)
                return { note: rest.slice(0, 200), productHint: null };
        }
        return null;
    }
    resolveCartNoteTargetIndex(session, text, productHint) {
        if (!session.cart.length)
            return -1;
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
            if (!name)
                continue;
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
    applyInlineOrderNote(session, text) {
        const t = text.trim();
        const change = this.extractCashChangeFromText(t);
        let next = { ...session };
        let notedItemIndex = null;
        if (change) {
            next.cashChangeFor = change;
        }
        const explicit = (0, whatsapp_intent_1.looksLikeExplicitCartItemNote)(t)
            ? this.extractCartItemNotePayload(t)
            : null;
        const rest = this.stripCashChangePhrases(t);
        const noteText = explicit?.note ||
            this.catalogService.extractProductModificationNote(rest || t) ||
            (rest && !/^(ninguno|ninguna|no|nada)$/i.test(rest) && !(0, whatsapp_intent_1.looksLikeExplicitCartItemNote)(t)
                ? rest
                : null) ||
            (!change && !(0, whatsapp_intent_1.looksLikeExplicitCartItemNote)(t) ? t : null);
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
                    item.note = existing ? `${existing}; ${cleaned}`.slice(0, 200) : cleaned;
                    cart[targetIdx] = item;
                    next = { ...next, cart };
                    notedItemIndex = targetIdx;
                }
            }
            next = this.appendCustomerNote(next, cleaned);
        }
        return { session: next, notedItemIndex };
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
    formatInlineNoteAck(session, notedItemIndex) {
        const parts = [];
        if (session.cashChangeFor?.trim()) {
            parts.push(`Anotado 💵 _${session.cashChangeFor.trim()}_`);
        }
        const idx = notedItemIndex != null && notedItemIndex >= 0
            ? notedItemIndex
            : session.cart.length - 1;
        const notedItem = idx >= 0 ? session.cart[idx] : undefined;
        const lastNote = notedItem?.note?.trim();
        if (lastNote && notedItem) {
            parts.push(`En *${notedItem.name}*: 📝 _${lastNote}_`);
        }
        else if (session.customerNotes?.trim()) {
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
    buildAiDisclaimerMessage(cfg) {
        const d = (cfg.aiDisclaimerMessage || '').trim();
        if (d)
            return d;
        return ('⚠️ *Aviso:* este chat lo atiende una *inteligencia artificial* y todavía está en *fase de implementación*, así que puede cometer errores.\n\n' +
            'Si algo no cuadra o prefieres una persona, escribe *asesor* y te pasamos con el equipo.');
    }
    async replyFirstContactWelcome(conv, waId, cfg) {
        await this.reply(conv, waId, this.buildAiDisclaimerMessage(cfg));
        await this.reply(conv, waId, this.buildWelcomeMessage(cfg));
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
            this.resolveOrderThanksMessage(session, thanksMessage));
    }
    resolveOrderThanksMessage(session, thanksMessage) {
        const custom = (thanksMessage || '').trim();
        const looksLikePickupDefault = !custom || /te esperamos/i.test(custom);
        if (session.orderType === 'delivery') {
            if (looksLikePickupDefault) {
                return 'Gracias por pedirnos 🍗 Te lo enviaremos lo más pronto posible.';
            }
            return custom;
        }
        return custom || 'Gracias por pedirnos, te esperamos 🍗';
    }
    isMultiOrderAffirmative(text) {
        const t = text.trim().toLowerCase();
        return /^(si|sí|sep|ok|okay|dale|listo|correcto|exacto|as[ií]|confirmo|agrega|agregalo|agregalos|va|perfecto|bueno)$/.test(t);
    }
    async handleProductWithVariants(conv, waId, session, product, text, cfg) {
        if (!product.hasAttributes || !product.attributes?.length)
            return false;
        const variantIntent = this.catalogService.extractVariantPreferenceHint(text) ||
            (this.catalogService.productImpliesCombo(product) ? 'combo' : undefined);
        const attrOpts = variantIntent ? { variantIntent } : undefined;
        const step = this.catalogService.resolveAttributesFromMessage(product, text, [], attrOpts);
        const deliveryHint = this.extractDeliveryTail(text);
        if (step.status === 'complete') {
            const stillNeed = this.catalogService.getRemainingAttributes(product, step.attributes, attrOpts);
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
                await this.reply(conv, waId, this.catalogService.formatProductOptionsPrompt(product, step.attributes, attrOpts));
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
            const added = this.tryAddProductToCart(session, product, this.resolveAddQuantity(session, product, { sourceText: text }), cfg, undefined, step.attributes, attrOpts);
            if (added.missingAttributes) {
                session = this.buildPendingAttributeSession(session, product, added.missingAttributes, {
                    sourceText: text,
                    variantIntent,
                });
                await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
                await this.reply(conv, waId, this.catalogService.formatProductOptionsPrompt(product, added.missingAttributes, attrOpts));
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
            await this.reply(conv, waId, this.buildCartAddReply(session, this.deliveryFeeFor(session, cfg), `${product.name} (${chosen})`));
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
        const mode = !/^(si|sí|\d{1,3}|opci[oó]n\s*\d+)$/i.test(text.trim()) &&
            !this.catalogService.productImpliesCombo(product) &&
            (this.catalogService.isGenericProductInquiry(text) ||
                this.catalogService.shouldShowVariantsOverview(text, product))
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
        await this.conversationService.saveSession(conv, session, 'awaiting_attribute');
        await this.reply(conv, waId, mode === 'order'
            ? this.catalogService.formatProductOptionsPrompt(product, [], this.attributeFlowOpts(session.pendingAttribute))
            : this.catalogService.formatProductVariantsOverview(product, mode));
        return true;
    }
    async tryHandleMixtoCompositionInquiry(conv, waId, session, text, products, cfg) {
        if (!this.catalogService.isMixtoCompositionInquiry(text))
            return false;
        session = {
            ...session,
            pendingAttribute: undefined,
            pendingMatch: undefined,
            pendingMultiOrder: undefined,
        };
        const mixtoHits = products.filter((p) => p.availableNow !== false && /\bmixto\b/i.test(p.name));
        let reply = 'Sí 👍 El *mixto* es *medio broaster* y *medio frito* (mitad y mitad), no un solo 1/2 pollo.\n';
        if (mixtoHits.length === 1) {
            const p = mixtoHits[0];
            reply +=
                `\nEn el menú: *${p.name}* · Cód. ${this.catalogService.formatProductCode(p.code)} · ${this.catalogService.formatMoney(p.price)}\n` +
                    `\n¿Te lo agrego? Responde *sí* o el *código*.`;
            session = this.rememberProductFocus(session, p, products);
            await this.savePendingAddOffer(conv, p, 1);
        }
        else if (mixtoHits.length > 1) {
            reply +=
                `\n\n${this.catalogService.formatProductChoicePrompt('mixto', mixtoHits, {
                    intro: 'Estas son las opciones *mixtas* del menú:',
                })}`;
            session = {
                ...session,
                pendingMatch: { query: 'mixto', candidates: mixtoHits, intent: 'info' },
            };
        }
        else {
            reply +=
                `\nSi lo quieres pedir, escribe *mixto* o mira el menú: ${(cfg.menuUrl || '').trim() || '*menú*'}.`;
        }
        await this.conversationService.saveSession(conv, session, 'building_cart');
        await this.reply(conv, waId, reply);
        return true;
    }
    async tryHandleComboExplanation(conv, waId, session, text, products) {
        if (this.catalogService.isMixtoCompositionInquiry(text)) {
            return this.tryHandleMixtoCompositionInquiry(conv, waId, session, text, products, await this.settingsService.getEffectiveConfig());
        }
        const focusId = session.productFocus?.productId;
        const focus = (focusId != null ? products.find((p) => p.id === focusId) : null) ||
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
            family =
                this.catalogService.findProductVariantFamily('pollo frito', products) ||
                    this.catalogService.findProductVariantFamily('pollo broaster', products);
        }
        if (!family || family.variants.length < 2) {
            await this.reply(conv, waId, 'El *combo* suele ser el plato *con gaseosa* (y a veces papas/arepas según el ítem).\n' +
                'Dime el plato (ej. *pollo frito* o *arroz chino*) y te paso precios de cada presentación.');
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
        const priceProducts = this.catalogService.resolvePriceInquiryProducts(text, products);
        if (priceProducts.length >= 2) {
            const qty = this.catalogService.extractQuantityFromMessage(text);
            await this.savePendingAddOffer(conv, priceProducts[0], qty, {
                sourceText: text,
                productIds: priceProducts.map((p) => p.id),
            });
            await this.reply(conv, waId, this.catalogService.formatMultiProductPriceReply(priceProducts));
            return true;
        }
        const embedded = priceProducts[0] ||
            this.catalogService.findProductEmbeddedInMessage(query, products) ||
            this.catalogService.findProductEmbeddedInMessage(text, products);
        const family = this.catalogService.findProductVariantFamily(text, products, embedded ? [embedded] : undefined) ||
            this.catalogService.findProductVariantFamily(query, products, embedded ? [embedded] : undefined);
        const familyPick = family
            ? this.catalogService.pickVariantFromFamilyText(text, family) ||
                this.catalogService.pickVariantFromFamilyText(query, family)
            : null;
        const infoProduct = familyPick || embedded;
        if (infoProduct) {
            const qty = this.catalogService.extractQuantityFromMessage(text);
            await this.savePendingAddOffer(conv, infoProduct, qty, { sourceText: text });
            await this.reply(conv, waId, this.formatPriceInquiryReply(infoProduct, qty));
            return true;
        }
        const scored = this.catalogService.searchByNameScored(query, products, 6);
        if (!scored.length) {
            await this.reply(conv, waId, '¿De qué plato quieres saber? Dime el nombre (ej. *pollo frito*, *sopa de mondongo*) y te cuento.');
            return true;
        }
        if (scored.length === 1 || this.catalogService.isStrongProductMatch(scored)) {
            const qty = this.catalogService.extractQuantityFromMessage(text);
            await this.savePendingAddOffer(conv, scored[0].p, qty, { sourceText: text });
            await this.reply(conv, waId, this.formatPriceInquiryReply(scored[0].p, qty));
            return true;
        }
        await this.reply(conv, waId, this.catalogService.formatPriceInquiryList(scored.slice(0, 5).map((x) => x.p)));
        return true;
    }
    formatPriceInquiryReply(product, quantity = 1) {
        const qty = Math.max(1, quantity || 1);
        const base = this.catalogService.formatProductPriceReply(product);
        if (qty <= 1) {
            return base;
        }
        const line = Math.round(product.price * qty);
        return (`${base}\n\n` +
            `Para *${qty}* unidades: *$${line.toLocaleString('es-CO')}* ` +
            `($${Math.round(product.price).toLocaleString('es-CO')} c/u).\n\n` +
            `_Responde *sí* y te agrego las ${qty}._`);
    }
    async savePendingAddOffer(conv, product, quantity = 1, opts) {
        const session = this.conversationService.getSession(conv);
        const qty = Math.max(1, Math.min(30, quantity || 1));
        const productIds = opts?.productIds?.length && opts.productIds.length > 1
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
    async tryHandlePendingAddOffer(conv, waId, session, text, products, cfg) {
        const offer = session.pendingAddOffer;
        if (!offer?.productId)
            return false;
        if (session.pendingAttribute || session.pendingMatch || session.pendingMultiOrder) {
            return false;
        }
        if (this.isAddOfferDecline(text)) {
            await this.conversationService.saveSession(conv, {
                ...session,
                pendingAddOffer: undefined,
            });
            const suffix = session.cart.length > 0
                ? `\n\n${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}\n\n${this.formatContinueShoppingPrompt()}`
                : '\n\nCuando quieras dime el plato o escribe *menú*.';
            await this.reply(conv, waId, `Listo, no lo agrego 👍${suffix}`);
            return true;
        }
        if (!this.isMultiOrderAffirmative(text) && !/^agrega(r|lo|los|las|me)?$/i.test(text.trim())) {
            if (this.catalogService.isPriceInquiryIntent(text) ||
                this.catalogService.isGenericProductInquiry(text) ||
                this.catalogService.looksLikeExplicitAddProductRequest(text) ||
                this.catalogService.looksLikeClearlyMultiDishOrder(text) ||
                this.catalogService.looksLikeMultiItemOrderMessage(text) ||
                this.catalogService.countQuantityMentions(text) >= 2 ||
                (0, whatsapp_intent_1.looksLikeAddressOnlyMessage)(text) ||
                (0, whatsapp_intent_1.isUpcomingAddressIntent)(text) ||
                (0, whatsapp_payment_methods_1.isPaymentCapabilityQuestion)(text) ||
                (0, whatsapp_payment_methods_1.findPaymentMethodByText)(text, cfg.paymentMethods) ||
                this.catalogService.findProductEmbeddedInMessage(text, products)) {
                session = { ...session, pendingAddOffer: undefined };
                await this.conversationService.saveSession(conv, session);
                return false;
            }
            return false;
        }
        const sourceText = (offer.sourceText || text || '').trim();
        const multiIds = offer.productIds?.length && offer.productIds.length > 1
            ? offer.productIds
            : null;
        if (multiIds) {
            const offerProducts = multiIds
                .map((id) => this.catalogService.getProductById(id, products) || products.find((p) => p.id === id))
                .filter((p) => !!p && p.availableNow !== false);
            if (!offerProducts.length) {
                await this.conversationService.saveSession(conv, {
                    ...session,
                    pendingAddOffer: undefined,
                });
                await this.reply(conv, waId, 'Esos platos ya no están disponibles. ¿Probamos con otros?');
                return true;
            }
            const confident = [];
            const needsAttributes = [];
            for (const product of offerProducts) {
                const match = { segment: sourceText, product, score: 100 };
                if (product.hasAttributes && product.attributes?.length) {
                    if (this.catalogService.extractExplicitAttributeChoice(sourceText, product)) {
                        confident.push(match);
                    }
                    else {
                        needsAttributes.push(match);
                    }
                }
                else {
                    confident.push(match);
                }
            }
            session = {
                ...session,
                pendingAddOffer: undefined,
                pendingMultiOrder: this.sessionFromMultiResolve({
                    segments: [sourceText],
                    confident,
                    needsAttributes,
                    ambiguous: [],
                    unresolved: [],
                }),
            };
            const added = await this.addPendingMultiConfidentToCart(conv, waId, session, cfg, products, sourceText);
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
                const nextProduct = this.catalogService.getProductById(nextItem.productId, products) ||
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
                    const preface = added.addedNames.length > 0
                        ? `Listo, agregué *${added.addedNames.join(', ')}* ✅\n\n`
                        : '';
                    await this.reply(conv, waId, `${preface}${this.catalogService.formatProductOptionsPrompt(nextProduct, [], this.attributeFlowOpts(session.pendingAttribute))}`);
                    return true;
                }
            }
            session = { ...session, pendingMultiOrder: undefined };
            await this.conversationService.saveSession(conv, session, 'building_cart');
            const names = added.addedNames.length
                ? added.addedNames.join(', ')
                : offerProducts.map((p) => p.name).join(', ');
            await this.reply(conv, waId, this.buildCartAddReply(session, this.deliveryFeeFor(session, cfg), names));
            return true;
        }
        const product = this.catalogService.getProductById(offer.productId, products) ||
            products.find((p) => p.id === offer.productId);
        if (!product || product.availableNow === false) {
            await this.conversationService.saveSession(conv, {
                ...session,
                pendingAddOffer: undefined,
            });
            await this.reply(conv, waId, 'Ese plato ya no está disponible. ¿Probamos con otro?');
            return true;
        }
        if (product.hasAttributes && product.attributes?.length) {
            session = { ...session, pendingAddOffer: undefined };
            if (await this.handleProductWithVariants(conv, waId, session, product, sourceText, cfg)) {
                return true;
            }
        }
        const qty = Math.max(1, offer.quantity || 1);
        const added = this.tryAddProductToCart(session, product, qty, cfg, undefined, undefined, {
            sourceText: sourceText || `${qty} ${product.name}`,
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
        const qtyNote = qty > 1 ? ` _(x${qty})_` : '';
        await this.reply(conv, waId, this.buildCartAddReply(session, this.deliveryFeeFor(session, cfg), `${product.name}${qtyNote}`));
        return true;
    }
    isAddOfferDecline(text) {
        const t = text.trim();
        if (/^(no|nop|nope|nel|despues|después|luego|ahora\s+no|no\s+gracias|mejor\s+no|nah)[\s!.?]*$/i.test(t)) {
            return true;
        }
        if (/^(no\s+se[nñ]or[a]?|no\s+gracias)([\s,!.?]+gracias)?[\s!.?]*$/i.test(t) &&
            !/\bdirecci/i.test(t)) {
            return true;
        }
        return false;
    }
    async tryHandleUpcomingAddressIntent(conv, waId, session, text, cfg) {
        if (!(0, whatsapp_intent_1.isUpcomingAddressIntent)(text))
            return false;
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
            await this.reply(conv, waId, 'Dale 👍 Cuando quieras mándame la *dirección*.\n\n¿Qué te gustaría pedir?');
            return true;
        }
        await this.conversationService.saveSession(conv, session, 'awaiting_address');
        await this.reply(conv, waId, `Perfecto 👍 Mándame la *dirección* (ej. _calle 10 #5-20 barrio…_ o un punto conocido).\n\n${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}`);
        return true;
    }
    async tryHandlePaymentCapabilityQuestion(conv, waId, session, text, cfg) {
        if (!(0, whatsapp_payment_methods_1.isPaymentCapabilityQuestion)(text))
            return false;
        const enabled = (0, whatsapp_payment_methods_1.getEnabledPaymentMethods)(cfg.paymentMethods || []);
        const hasMp = enabled.some((m) => m.id === 'mercadopago' || m.flow === 'mercadopago');
        const asksCard = /\btarjeta|credito|crédito|d[eé]bito|datafono|dat[aá]fono\b/i.test(text);
        const lines = [];
        if (asksCard) {
            if (hasMp) {
                lines.push('Sí: con *Mercado Pago* te mandamos un *link* y puedes pagar con *tarjeta* (débito/crédito) desde el celular.');
                lines.push('_No tenemos datáfono a domicilio; es pago por link._');
            }
            else {
                lines.push('Por WhatsApp *no* recibimos tarjeta/datáfono presencial.');
            }
        }
        else {
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
            lines.push('Cuando confirmes el pedido (*listo*) te pido el método. Si quieres, escribe ya *nequi*, *contraentrega* o *mercado pago*.');
        }
        else {
            lines.push('');
            lines.push('Cuando armes el carrito te pido el método al confirmar.');
        }
        if (session.pendingAddOffer) {
            await this.conversationService.saveSession(conv, {
                ...session,
                pendingAddOffer: undefined,
            });
        }
        await this.reply(conv, waId, lines.join('\n'));
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
        lines.push('\n_Si está bien lo que marqué ✅ y *no hay dudas*, escribe *sí*._', '_Si hay opciones ❓, elige *número* o nombre (ej. *broaster*)._');
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
            const qty = this.quantityForMultiSegment(item.segment, product.name, sourceText);
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
            const attempt = this.tryAddProductToCart(next, product, qty, cfg, undefined, attrs);
            if (attempt.missingAttributes) {
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
    async tryPreferChickenComboForFoodDrink(conv, waId, session, text, products, cfg) {
        if (!this.catalogService.looksLikeFoodPlusDrinkOrder(text))
            return false;
        const q = text.toLowerCase();
        if (!/\bpollo\b/.test(q))
            return false;
        if (/\bcombo\b/.test(q))
            return false;
        if (/\b(medio|media|cuarto|1\s*\/\s*2|1\s*\/\s*4)\b/.test(q))
            return false;
        const style = /\bbroaster\b/.test(q)
            ? 'broaster'
            : /\bfrito\b/.test(q)
                ? 'frito'
                : null;
        if (!style)
            return false;
        const combo = products.find((p) => p.availableNow !== false &&
            /\bcombo\b/i.test(p.name) &&
            /\bpollo\b/i.test(p.name) &&
            new RegExp(`\\b${style}\\b`, 'i').test(p.name)) || null;
        if (!combo)
            return false;
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
        await this.reply(conv, waId, `Como pediste *pollo ${style}* con bebida, te conviene el *${combo.name}* (cód. ${combo.code}) ✅\n\n` +
            this.buildCartAddReply(session, this.deliveryFeeFor(session, cfg), combo.name, {
                extraLine: '_Si preferías el pollo suelto + gaseosa aparte, dímelo y lo armamos así._',
            }));
        return true;
    }
    async tryHandleMultiProductOrder(conv, waId, session, multi, cfg, text, products, fullTextForDelivery) {
        const foodHits = multi.confident.length +
            multi.ambiguous.length +
            multi.needsAttributes.length +
            multi.unresolved.length;
        if (foodHits === 0)
            return false;
        const inferredName = multi.possibleCustomerNames?.[0]?.trim();
        if (inferredName &&
            !(0, whatsapp_session_intents_1.isUsableWhatsappCustomerName)(conv.customerName || '') &&
            (0, whatsapp_session_intents_1.isUsableWhatsappCustomerName)(inferredName) &&
            !this.catalogService.findProductEmbeddedInMessage(inferredName, products) &&
            this.catalogService.looksLikePersonNameSegment(inferredName)) {
            await this.conversationService.updateCustomerName(conv, inferredName);
            const freshName = await this.conversationService.reloadConversation(conv.id);
            Object.assign(conv, freshName);
        }
        const deliverySource = (fullTextForDelivery || text || '').trim();
        const deliveryTail = this.extractDeliveryTail(deliverySource) ||
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
        const isFoodPlusDrink = this.catalogService.looksLikeFoodPlusDrinkOrder(text);
        const attrOptsFor = (product) => isFoodPlusDrink && !this.catalogService.isLikelyDrinkProduct(product)
            ? { variantIntent: 'solo' }
            : undefined;
        const needsConfirm = multi.ambiguous.length > 0 ||
            (multi.unresolved.length > 0 && !drinkFirstFoodPending);
        const readyToAddWithoutConfirm = !needsConfirm &&
            multi.confident.length >= 1 &&
            multi.ambiguous.length === 0 &&
            multi.unresolved.length === 0;
        if (readyToAddWithoutConfirm || onlyNeedsAttrs || drinkFirstFoodPending) {
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
                    const productAttrOpts = attrOptsFor(product);
                    const foodAttrText = productAttrOpts
                        ? first.segment
                        : `${first.segment} ${text}`;
                    const step = this.catalogService.coerceAttributeStep(product, this.catalogService.resolveAttributesFromMessage(product, foodAttrText, [], productAttrOpts), productAttrOpts);
                    if (step.status === 'complete') {
                        const attrQty = this.quantityForMultiSegment(first.segment, product.name, text);
                        const attempt = this.tryAddProductToCart(next, product, attrQty, cfg, undefined, step.attributes, productAttrOpts);
                        if (attempt.missingAttributes) {
                            next = this.buildPendingAttributeSession(next, product, attempt.missingAttributes, {
                                sourceText: foodAttrText,
                                variantIntent: productAttrOpts?.variantIntent,
                                pendingMultiOrder: {
                                    confident: [],
                                    ambiguous: [],
                                    unresolved: [],
                                    needsAttributes: needsQueue,
                                },
                            });
                            await this.conversationService.saveSession(conv, next, 'awaiting_attribute');
                            const prefix = addResult.addedNames.length
                                ? this.buildCartAddReply(next, this.deliveryFeeFor(next, cfg), addResult.addedNames, {
                                    suffix: '',
                                }) + '\n\n'
                                : '';
                            await this.reply(conv, waId, `${prefix}Ahora elige opciones para *${product.name}*:\n\n` +
                                this.catalogService.formatProductOptionsPrompt(product, attempt.missingAttributes, productAttrOpts));
                            return true;
                        }
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
                                const nextAttrOpts = attrOptsFor(nextProd);
                                const preText = nextAttrOpts
                                    ? rest[0].segment
                                    : `${rest[0].segment} ${text}`;
                                const pre = this.catalogService.resolveAttributesFromMessage(nextProd, preText, [], nextAttrOpts);
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
                                await this.reply(conv, waId, `${this.buildCartAddReply(next, this.deliveryFeeFor(next, cfg), [
                                    ...addResult.addedNames,
                                    `${product.name} (${chosen})`,
                                ], { suffix: '' })}\n\nAhora elige opciones para *${nextProd.name}*:\n\n` +
                                    this.catalogService.formatProductOptionsPrompt(nextProd, pre.status === 'partial' ? pre.attributes : [], nextAttrOpts));
                                return true;
                            }
                        }
                        await this.conversationService.saveSession(conv, next, 'building_cart');
                        const chosen = step.attributes.map((a) => a.attributeValue).join(', ');
                        await this.reply(conv, waId, this.buildCartAddReply(next, this.deliveryFeeFor(next, cfg), [
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
                    const prefix = addResult.addedNames.length
                        ? this.buildCartAddReply(next, this.deliveryFeeFor(next, cfg), addResult.addedNames, {
                            suffix: '',
                        }) + '\n\n'
                        : next.cart.length
                            ? `${this.formatCartOnly(next, this.deliveryFeeFor(next, cfg))}\n\n`
                            : '';
                    await this.reply(conv, waId, `${prefix}Ahora elige opciones para *${product.name}*:\n\n` +
                        this.catalogService.formatProductOptionsPrompt(product, step.status === 'partial' ? step.attributes : [], productAttrOpts));
                    return true;
                }
            }
            await this.conversationService.saveSession(conv, { ...next, pendingMultiOrder: undefined }, 'building_cart');
            if (addResult.addedNames.length) {
                await this.reply(conv, waId, this.buildCartAddReply(next, this.deliveryFeeFor(next, cfg), addResult.addedNames, {
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
        const focusProduct = multi.confident[0]?.product ||
            multi.needsAttributes[0]?.product ||
            multi.ambiguous[0]?.candidates?.[0];
        if (focusProduct) {
            session = this.rememberProductFocus(session, focusProduct, products);
        }
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
        if (pending.ambiguous.length) {
            const group = pending.ambiguous[0];
            const textChosen = !numPick
                ? this.catalogService.pickFromCandidateList(text, group.candidates)
                : null;
            const chosenFromNum = numPick && numPick <= group.candidates.length
                ? group.candidates[numPick - 1]
                : null;
            const chosenRaw = textChosen || chosenFromNum;
            if (chosenRaw) {
                const full = products.find((p) => p.id === chosenRaw.id) || chosenRaw;
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
            if (pending.ambiguous.length) {
                await this.conversationService.saveSession(conv, session);
                await this.reply(conv, waId, `Todavía falta elegir lo dudoso 👇\n\n` +
                    this.formatMultiOrderProposal({
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
            const addResult = await this.addPendingMultiConfidentToCart(conv, waId, session, cfg, products, text);
            if (addResult.blocked) {
                await this.conversationService.saveSession(conv, addResult.session);
                await this.handleCartLimitBlocked(conv, waId, addResult.blocked, cfg);
                return true;
            }
            let next = {
                ...addResult.session,
                pendingMultiOrder: pending.ambiguous.length || pending.needsAttributes.length
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
                    const step = this.catalogService.coerceAttributeStep(product, this.catalogService.resolveAttributesFromMessage(product, `${first.segment} ${text}`, []));
                    if (step.status === 'complete') {
                        const attrQty = this.quantityForMultiSegment(first.segment, product.name, `${first.segment} ${text}`);
                        const attempt = this.tryAddProductToCart(next, product, attrQty, cfg, undefined, step.attributes);
                        if (attempt.missingAttributes) {
                            next = this.buildPendingAttributeSession(next, product, attempt.missingAttributes, {
                                sourceText: `${first.segment} ${text}`,
                                pendingMultiOrder: next.pendingMultiOrder,
                            });
                            await this.conversationService.saveSession(conv, next, 'awaiting_attribute');
                            const prefix = addResult.addedNames.length
                                ? this.buildCartAddReply(next, this.deliveryFeeFor(next, cfg), addResult.addedNames, {
                                    suffix: '',
                                }) + '\n\n'
                                : '';
                            await this.reply(conv, waId, `${prefix}Ahora elige opciones para *${product.name}*:\n\n` +
                                this.catalogService.formatProductOptionsPrompt(product, attempt.missingAttributes));
                            return true;
                        }
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
                            await this.reply(conv, waId, `${this.buildCartAddReply(next, this.deliveryFeeFor(next, cfg), [...addResult.addedNames, `${product.name} (${chosen})`], { suffix: '' })}\n\nAhora elige opciones para *${nextProduct.name}*:\n\n` +
                                this.catalogService.formatProductOptionsPrompt(nextProduct, pre.status === 'partial' ? pre.attributes : []));
                            return true;
                        }
                        await this.conversationService.saveSession(conv, next, 'building_cart');
                        const chosen = step.attributes.map((a) => a.attributeValue).join(', ');
                        await this.reply(conv, waId, this.buildCartAddReply(next, this.deliveryFeeFor(next, cfg), [...addResult.addedNames, `${product.name} (${chosen})`]));
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
                    await this.reply(conv, waId, `${prefix}Ahora elige opciones para *${product.name}*:\n\n` +
                        this.catalogService.formatProductOptionsPrompt(product, step.status === 'partial' ? step.attributes : []));
                    return true;
                }
            }
            await this.conversationService.saveSession(conv, next, 'building_cart');
            if (addResult.addedNames.length > 0) {
                await this.reply(conv, waId, this.buildCartAddReply(next, this.deliveryFeeFor(next, cfg), addResult.addedNames, {
                    suffix: this.formatContinueShoppingPrompt(),
                }));
            }
            else {
                await this.reply(conv, waId, `${this.formatCartOnly(next, this.deliveryFeeFor(next, cfg))}\n\n${this.formatContinueShoppingPrompt()}`);
            }
            return true;
        }
        if (this.isMultiOrderAffirmative(text) &&
            !pending.confident.length &&
            !pending.ambiguous.length &&
            !pending.needsAttributes.length) {
            session = { ...session, pendingMultiOrder: undefined };
            await this.conversationService.saveSession(conv, session, 'building_cart');
            if (session.cart.length > 0) {
                await this.reply(conv, waId, `${this.formatCartOnly(session, this.deliveryFeeFor(session, cfg))}\n\n${this.formatContinueShoppingPrompt()}`);
            }
            else {
                await this.reply(conv, waId, 'Listo. ¿Qué se te antoja? Puedes pedir por *nombre* o *código*.');
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
        if (this.catalogService.isLargerPackInquiry(text) ||
            this.catalogService.isVaguePackSizeQuery(text)) {
            return false;
        }
        const family = this.catalogService.findProductVariantFamily(pendingProduct.name, products, [
            pendingProduct,
            candidate,
        ]);
        const sameFamily = !!family &&
            family.variants.some((v) => v.id === candidate.id) &&
            family.variants.some((v) => v.id === pendingProduct.id);
        const wantsComboSwitch = this.catalogService.productsShareCoreFoodTokens(pendingProduct, candidate) &&
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
            await this.reply(conv, waId, `Perfecto, lo dejamos en *${candidate.name}* ✅\n\n` +
                this.buildCartAddReply(session, this.deliveryFeeFor(session, cfg), candidate.name));
            return true;
        }
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
        await this.reply(conv, waId, `${this.buildCartAddReply(nextSession, this.deliveryFeeFor(nextSession, cfg), candidate.name, {
            extraLine: nextSession.address?.trim()
                ? `\nDomicilio anotado: _${nextSession.address.trim()}_`
                : undefined,
            suffix: '',
        })}\n\n` +
            `Cuando quieras, sigue con las opciones de *${pendingProduct.name}*:\n\n` +
            this.catalogService.formatProductOptionsPrompt(pendingProduct, pa.selected || []));
        return true;
    }
    async tryHandleDeliverySetup(conv, waId, session, originalText, text, cfg, addressOverride) {
        const source = (originalText || text || '').trim();
        const probe = (text || source).trim();
        const forced = (addressOverride || '').trim();
        if (!forced &&
            !(0, whatsapp_intent_1.isDeliverySetupWithoutFood)(probe) &&
            !(0, whatsapp_intent_1.isDeliverySetupWithoutFood)(source)) {
            return false;
        }
        const addr = forced ||
            (0, whatsapp_intent_1.extractDeliverySetupAddress)(probe) ||
            (0, whatsapp_intent_1.extractDeliverySetupAddress)(source) ||
            this.extractDeliveryTail(source) ||
            this.extractDeliveryTail(probe);
        const safeAddr = addr && !(0, whatsapp_intent_1.isDeliveryLogisticsFluff)(addr) && this.isPlausibleDeliveryAddress(addr)
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
                await this.reply(conv, waId, `${fee.blocked}\n\nSi tienes otra dirección más cerca, pégamela. Si no, dime qué quieres pedir.`);
                return true;
            }
            const feeLine = fee.notice ? `\n${fee.notice}` : '';
            await this.reply(conv, waId, `Dale, domicilio a *${session.address?.trim() || safeAddr}* ✅${feeLine}\n\n` +
                `¿Qué se te antoja pedir? Puedes decir el *nombre* del plato o el *código*, o escribe *menú*.`);
            return true;
        }
        if (session.address?.trim() && (0, whatsapp_intent_1.isDeliveryLogisticsFluff)(session.address)) {
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
    async tryApplyAiClassify(conv, waId, session, text, originalText, cfg) {
        if (!(0, whatsapp_message_classify_1.needsAiMessageClassify)(text) && !(0, whatsapp_message_classify_1.needsAiMessageClassify)(originalText)) {
            return { handled: false };
        }
        const recent = await this.conversationService.getRecentMessageTexts(conv.id, 4);
        let result = null;
        try {
            result = await this.aiService.classifyMessage({
                userMessage: text,
                cartLength: session.cart.length,
                recentMessages: recent,
            });
        }
        catch (err) {
            this.logger.warn(`tryApplyAiClassify: ${err}`);
            return { handled: false };
        }
        if (!result || result.confidence < 0.45)
            return { handled: false };
        const nextText = (0, whatsapp_local_glossary_1.applyLocalGlossary)(result.normalizedText || text);
        if ((result.intent === 'delivery_setup' ||
            (result.intent === 'address' && !result.hasFoodItems && result.address)) &&
            !result.hasFoodItems) {
            const ok = await this.tryHandleDeliverySetup(conv, waId, session, nextText, nextText, cfg, result.address);
            if (ok)
                return { handled: true };
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
    async tryHandleCoverageInquiry(conv, waId, session, text, cfg) {
        if (!(0, whatsapp_session_intents_1.isDeliveryCoverageInquiry)(text))
            return false;
        const addr = (0, whatsapp_session_intents_1.extractCoverageAddressProbe)(text);
        if (!addr) {
            await this.reply(conv, waId, 'Claro 🙂 Dime la dirección (calle/carrera o conjunto) y te confirmo si llegamos y cuánto sale el domicilio.');
            return true;
        }
        const probe = {
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
            await this.reply(conv, waId, `📍 _${addr}_\n\n` +
                (feeResult.blocked ||
                    'Esa dirección queda *fuera de cobertura* de domicilio por ahora.') +
                `\n\nSi tienes otra dirección más cerca del local, pégamela y la reviso.`);
            return true;
        }
        const fee = typeof feeResult.session.deliveryFeeCalculated === 'number'
            ? feeResult.session.deliveryFeeCalculated
            : cfg.defaultDeliveryFee;
        const km = feeResult.session.deliveryDistanceKm;
        const kmPart = km != null && km > 0 ? ` (~${km.toFixed(1)} km)` : '';
        const notice = feeResult.notice ||
            `🚚 Domicilio: *$${fee.toLocaleString('es-CO')}*${kmPart}`;
        await this.reply(conv, waId, `✅ Sí, llegamos a _${addr}_${kmPart}.\n${notice}\n\n` +
            `Cuando quieras pedir, escribe lo que deseas (ej: *medio pollo*) y te armamos el pedido.`);
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
        if (this.pointsHandler.isAwaitingPointCodePrompt(text)) {
            await this.reply(conv, waId, 'Perfecto 👍 Pégame el código de *12 caracteres* de la factura.\n' +
                'Ej: _registrar A3F9K2M8PQ75_ (o solo el código si tu cuenta está vinculada).');
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
            if (!/^redimir[\s!.?]*$/i.test(text.trim()) &&
                /\b(procedimiento|proceso|pasos?|c[oó]mo|para\s+redimir)\b/i.test(text)) {
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
        whatsapp_points_service_1.WhatsappPointsService,
        whatsapp_delivery_routing_service_1.WhatsappDeliveryRoutingService])
], WhatsappOrchestratorService);
//# sourceMappingURL=whatsapp-orchestrator.service.js.map