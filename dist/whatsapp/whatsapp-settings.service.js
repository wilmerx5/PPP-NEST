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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsappSettingsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const config_1 = require("@nestjs/config");
const whatsapp_settings_entity_1 = require("./entities/whatsapp-settings.entity");
const whatsapp_payment_methods_1 = require("./whatsapp-payment-methods");
const whatsapp_menu_concepts_1 = require("./whatsapp-menu-concepts");
const DEFAULT_WELCOME = '¡Hola! 👋 Bienvenido a {brand}. Dime qué se te antoja y te ayudo con el pedido.';
const DEFAULT_MENU_LINK = 'Claro, aquí tienes el *menú*:\n{menuUrl}\n\nQuedo atento: cuando quieras me dices qué se te antoja (por nombre o código) y te ayudo con el pedido 👍';
const DEFAULT_HUMAN_HANDOFF = 'Dale, te paso con el equipo 🙋. Alguien te va a atender por aquí; puedes seguir escribiendo.';
const DEFAULT_ORDER_SUCCESS = 'Gracias por pedirnos, te esperamos 🍗';
const DEFAULT_CLOSED_MESSAGE = 'Ahora estamos *cerrados*. Cuando abramos escríbenos de nuevo para pedir.';
const DEFAULT_LARGE_ORDER_HANDOFF = 'Ese pedido es más grande de lo que manejamos por WhatsApp.\n\nTe paso con alguien del equipo para ayudarte con el pedido.';
const TONE_GUIDE = `
TONO (obligatorio en cada reply):
- Tutéa siempre (tú / te / tu), como un colombiano amable del día a día.
- Cálido y atento, pero natural: sin “mi amor”, “corazón”, “precioso” ni exceso de emojis.
- Corto y claro. Usa expresiones suaves tipo “dale”, “listo”, “perfecto”, “con gusto”, “cuando quieras”.
- Suena a persona del local, no a robot ni a publicidad.
`.trim();
const DEFAULT_SYSTEM_PROMPT = `Eres quien atiende pedidos de {brand} por WhatsApp.
Hablas como un mesero colombiano: cercano, claro y servicial.

${TONE_GUIDE}

Tu rol es conversacional: guiar al cliente dentro de las REGLAS OBLIGATORIAS que recibes en cada mensaje.
El sistema (no tú) valida menú, precios, carrito, horarios y creación del pedido.
- Si el cliente pregunta algo (qué incluye, diferencias, tiempos, qué hay de almuerzo, etc.), responde primero esa duda de forma natural.
- Si exploran el menú sin saber qué pedir: guía por CATEGORÍAS con 1-2 ejemplos por categoría; pregunta qué les antoja. NO vuelques listas largas ni códigos 1, 2, 3… en bloque.
- Sigue el hilo: si ya hablaron de una categoría, profundiza ahí; no reinicies con todo el menú.
- Si hay una elección de opciones pendiente, recuérdala en una frase corta al final; no reenvíes toda la lista cada vez.
- NUNCA vacíes el carrito ni inventes que está vacío.
- NUNCA pidas otro producto cuando el cliente ya está dando nombre, dirección o pago.
- Nombre: solo nombre de persona. Dirección: calle/carrera/barrio/referencia. Si dice que pasa/recoge → pickup.
- Nunca inventes productos, precios, promociones ni tiempos de entrega exactos.
- Si el restaurante está CERRADO, solo informa; no uses addItems ni confirmes pedidos.
- Para confirmar, el cliente debe escribir *confirmar* (tú no confirmas).
- Temas fuera del pedido: redirige con amabilidad o sugiere escribir *humano*.
- Usa el CONTEXTO DEL LOCAL cuando pregunten dónde quedan o cómo llegar. No inventes ubicación.`;
let WhatsappSettingsService = class WhatsappSettingsService {
    settingsRepo;
    config;
    constructor(settingsRepo, config) {
        this.settingsRepo = settingsRepo;
        this.config = config;
    }
    async getSettings() {
        let row = await this.settingsRepo.findOne({ where: { id: 1 } });
        if (!row) {
            row = this.settingsRepo.create({ id: 1, defaultDeliveryFee: 2000 });
            row = await this.settingsRepo.save(row);
        }
        return row;
    }
    applyTemplate(tpl, vars) {
        return (tpl || '').replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');
    }
    async getEffectiveConfig() {
        const row = await this.getSettings();
        const envEnabled = (this.config.get('WHATSAPP_ENABLED') || '')
            .trim()
            .toLowerCase();
        const enabledFromEnv = envEnabled === 'true' || envEnabled === '1' || envEnabled === 'yes';
        const fee = Number(row.defaultDeliveryFee);
        const brand = (row.restaurantName || '').trim() || 'Pronto Pollo Portal';
        const menuUrl = (row.menuUrl || '').trim() ||
            (this.config.get('WHATSAPP_MENU_URL') || '').trim() ||
            `${(this.config.get('FRONTEND_URL') || 'https://prontopolloportal.com').replace(/\/$/, '')}/menu`;
        const localContext = this.extractLocalContext(row, menuUrl);
        const templateVars = {
            brand,
            menuUrl,
            mapsUrl: localContext.mapsUrl || '',
            websiteUrl: localContext.websiteUrl || '',
            phone: localContext.publicPhone || row.displayPhone || '',
            address: localContext.restaurantAddress || '',
        };
        const welcomeTpl = row.welcomeMessage?.trim() || DEFAULT_WELCOME;
        const systemTpl = row.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT;
        const menuLinkTpl = row.menuLinkMessage?.trim() || DEFAULT_MENU_LINK;
        const humanTpl = row.humanHandoffMessage?.trim() || DEFAULT_HUMAN_HANDOFF;
        const successTpl = row.orderSuccessMessage?.trim() || DEFAULT_ORDER_SUCCESS;
        const closedTpl = row.closedMessage?.trim() || DEFAULT_CLOSED_MESSAGE;
        const largeOrderTpl = row.largeOrderHandoffMessage?.trim() || DEFAULT_LARGE_ORDER_HANDOFF;
        const temp = Number(row.aiTemperature);
        const paymentMethods = (0, whatsapp_payment_methods_1.resolvePaymentMethods)(row.paymentMethods, {
            allowMercadoPago: row.allowMercadoPago !== false,
        });
        const menuConceptGroups = (0, whatsapp_menu_concepts_1.resolveMenuConceptGroups)(row.menuConceptGroups);
        const allowMercadoPago = paymentMethods.some((m) => m.enabled && (m.flow === 'mercadopago' || m.id === 'mercadopago'));
        return {
            ...row,
            brandName: brand,
            defaultDeliveryFee: Number.isFinite(fee) && fee > 0 ? fee : 2000,
            minOrderAmount: Math.max(0, Number(row.minOrderAmount) || 0),
            maxOrderAmount: Math.max(0, Number(row.maxOrderAmount) || 0),
            maxUnitsPerItem: Math.max(0, Number(row.maxUnitsPerItem) || 0),
            maxTotalUnits: Math.max(0, Number(row.maxTotalUnits) || 0),
            maxCartLines: Math.max(0, Number(row.maxCartLines) || 0),
            handoffWhenMaxExceeded: row.handoffWhenMaxExceeded !== false,
            largeOrderHandoffMessage: this.applyTemplate(largeOrderTpl, templateVars),
            askOrderNotes: row.askOrderNotes !== false,
            rateLimitPerMinute: Math.min(120, Math.max(5, Number(row.rateLimitPerMinute) || 25)),
            humanAgentIdleMinutes: Math.max(0, Number(row.humanAgentIdleMinutes ?? 30)),
            humanClientIdleMinutes: Math.max(0, Number(row.humanClientIdleMinutes ?? 120)),
            orderDraftIdleMinutes: Math.max(0, Number(row.orderDraftIdleMinutes ?? 45)),
            pendingChoiceIdleMinutes: Math.max(0, Number(row.pendingChoiceIdleMinutes ?? 15)),
            mpPaymentIdleMinutes: Math.max(0, Number(row.mpPaymentIdleMinutes ?? 60)),
            sessionIdleNotify: row.sessionIdleNotify !== false,
            enabled: !!row.enabled || enabledFromEnv,
            accessToken: (row.accessToken || '').trim() ||
                (this.config.get('WHATSAPP_ACCESS_TOKEN') || '').trim() ||
                null,
            appSecret: (row.appSecret || '').trim() ||
                (this.config.get('WHATSAPP_APP_SECRET') || '').trim() ||
                null,
            phoneNumberId: (row.phoneNumberId || '').trim() ||
                (this.config.get('WHATSAPP_PHONE_NUMBER_ID') || '').trim() ||
                null,
            verifyToken: (row.verifyToken || '').trim() ||
                (this.config.get('WHATSAPP_VERIFY_TOKEN') || '').trim() ||
                null,
            openaiApiKey: (row.openaiApiKey || '').trim() ||
                (this.config.get('OPENAI_API_KEY') || '').trim() ||
                null,
            openaiModel: row.openaiModel || 'gpt-4o-mini',
            aiTemperature: Number.isFinite(temp) ? Math.min(1.5, Math.max(0, temp)) : 0.2,
            systemPrompt: `${TONE_GUIDE}\n\n${this.applyTemplate(systemTpl, templateVars)}`,
            welcomeMessage: this.applyTemplate(welcomeTpl, templateVars),
            menuLinkMessage: this.applyTemplate(menuLinkTpl, templateVars),
            humanHandoffMessage: this.applyTemplate(humanTpl, templateVars),
            orderSuccessMessage: this.applyTemplate(successTpl, templateVars),
            closedMessage: this.applyTemplate(closedTpl, templateVars),
            menuUrl,
            websiteUrl: localContext.websiteUrl,
            ignoreBusinessHours: !!row.ignoreBusinessHours,
            localContext,
            localContextBlock: this.buildLocalContextBlock(localContext, menuConceptGroups),
            templateVars,
            paymentMethods,
            menuConceptGroups,
            allowMercadoPago,
        };
    }
    extractLocalContext(row, menuUrl) {
        const clean = (v) => {
            const s = (v || '').trim();
            return s.length ? s : null;
        };
        return {
            restaurantName: clean(row.restaurantName),
            restaurantAddress: clean(row.restaurantAddress),
            restaurantCity: clean(row.restaurantCity),
            restaurantNeighborhood: clean(row.restaurantNeighborhood),
            mapsUrl: clean(row.mapsUrl),
            publicPhone: clean(row.publicPhone),
            landmarks: clean(row.landmarks),
            pickupNotes: clean(row.pickupNotes),
            deliveryNotes: clean(row.deliveryNotes),
            aiExtraContext: clean(row.aiExtraContext),
            websiteUrl: clean(row.websiteUrl),
            instagramUrl: clean(row.instagramUrl),
            prepTimeNote: clean(row.prepTimeNote),
            deliveryTimeNote: clean(row.deliveryTimeNote),
            minOrderAmount: Math.max(0, Number(row.minOrderAmount) || 0),
            maxOrderAmount: Math.max(0, Number(row.maxOrderAmount) || 0),
            maxUnitsPerItem: Math.max(0, Number(row.maxUnitsPerItem) || 0),
            maxTotalUnits: Math.max(0, Number(row.maxTotalUnits) || 0),
            maxCartLines: Math.max(0, Number(row.maxCartLines) || 0),
            handoffWhenMaxExceeded: row.handoffWhenMaxExceeded !== false,
            allergensNote: clean(row.allergensNote),
            promotionsNote: clean(row.promotionsNote),
            serviceAreaNote: clean(row.serviceAreaNote),
            cashChangeNote: clean(row.cashChangeNote),
            transferInfoNote: clean(row.transferInfoNote),
            specialRequestsNote: clean(row.specialRequestsNote),
            paymentInstructions: clean(row.paymentInstructions),
            hoursNote: clean(row.hoursNote),
            cancelPolicyNote: clean(row.cancelPolicyNote),
            menuUrl: clean(menuUrl),
        };
    }
    buildLocalContextBlock(ctx, menuConceptGroups) {
        const lines = [];
        if (ctx.restaurantName)
            lines.push(`Nombre del local: ${ctx.restaurantName}`);
        if (ctx.restaurantAddress)
            lines.push(`Dirección: ${ctx.restaurantAddress}`);
        if (ctx.restaurantNeighborhood)
            lines.push(`Barrio: ${ctx.restaurantNeighborhood}`);
        if (ctx.restaurantCity)
            lines.push(`Ciudad: ${ctx.restaurantCity}`);
        if (ctx.mapsUrl)
            lines.push(`Google Maps / ubicación: ${ctx.mapsUrl}`);
        if (ctx.publicPhone)
            lines.push(`Teléfono del local: ${ctx.publicPhone}`);
        if (ctx.websiteUrl)
            lines.push(`Sitio web: ${ctx.websiteUrl}`);
        if (ctx.menuUrl)
            lines.push(`Menú online: ${ctx.menuUrl}`);
        if (ctx.instagramUrl)
            lines.push(`Instagram: ${ctx.instagramUrl}`);
        if (ctx.landmarks)
            lines.push(`Puntos de referencia / cómo llegar: ${ctx.landmarks}`);
        if (ctx.pickupNotes)
            lines.push(`Notas para recoger en el local: ${ctx.pickupNotes}`);
        if (ctx.deliveryNotes)
            lines.push(`Notas de domicilio / zonas: ${ctx.deliveryNotes}`);
        if (ctx.serviceAreaNote)
            lines.push(`Cobertura / zonas de servicio: ${ctx.serviceAreaNote}`);
        if (ctx.prepTimeNote)
            lines.push(`Tiempo de preparación (orientativo): ${ctx.prepTimeNote}`);
        if (ctx.deliveryTimeNote)
            lines.push(`Tiempo de domicilio (orientativo): ${ctx.deliveryTimeNote}`);
        if (ctx.minOrderAmount > 0) {
            lines.push(`Pedido mínimo: $${ctx.minOrderAmount.toLocaleString('es-CO')} COP`);
        }
        if (ctx.maxOrderAmount > 0) {
            lines.push(`Pedido máximo por WhatsApp: $${ctx.maxOrderAmount.toLocaleString('es-CO')} COP` +
                (ctx.handoffWhenMaxExceeded ? ' (si piden más → humano)' : ''));
        }
        if (ctx.maxUnitsPerItem > 0) {
            lines.push(`Máx. unidades del mismo producto: ${ctx.maxUnitsPerItem}`);
        }
        if (ctx.maxTotalUnits > 0) {
            lines.push(`Máx. unidades totales: ${ctx.maxTotalUnits}`);
        }
        if (ctx.maxCartLines > 0) {
            lines.push(`Máx. ítems en el carrito: ${ctx.maxCartLines}`);
        }
        if (ctx.paymentInstructions)
            lines.push(`Instrucciones de pago: ${ctx.paymentInstructions}`);
        if (ctx.cashChangeNote)
            lines.push(`Efectivo / cambio: ${ctx.cashChangeNote}`);
        if (ctx.transferInfoNote)
            lines.push(`Transferencia / cuentas: ${ctx.transferInfoNote}`);
        if (ctx.allergensNote)
            lines.push(`Alérgenos / restricciones: ${ctx.allergensNote}`);
        if (ctx.promotionsNote)
            lines.push(`Promociones vigentes: ${ctx.promotionsNote}`);
        if (ctx.specialRequestsNote) {
            lines.push(`Pedidos especiales / personalizaciones: ${ctx.specialRequestsNote}`);
        }
        if (ctx.hoursNote)
            lines.push(`Notas de horario: ${ctx.hoursNote}`);
        if (ctx.cancelPolicyNote)
            lines.push(`Política de cancelación: ${ctx.cancelPolicyNote}`);
        if (ctx.aiExtraContext)
            lines.push(`Info adicional: ${ctx.aiExtraContext}`);
        const conceptsBlock = (0, whatsapp_menu_concepts_1.buildMenuConceptsPromptBlock)(menuConceptGroups);
        if (conceptsBlock)
            lines.push(conceptsBlock.replace(/\n/g, ' '));
        if (!lines.length) {
            return 'CONTEXTO DEL LOCAL: (sin configurar en admin; no inventes dirección ni ubicación).';
        }
        return (`CONTEXTO DEL LOCAL (usa esto si preguntan dónde quedan, cómo llegar, tiempos, pagos, etc.; no inventes):\n` +
            lines.map((l) => `- ${l}`).join('\n'));
    }
    async updateSettings(dto) {
        const row = await this.getSettings();
        const strOrNull = (v) => v === undefined ? undefined : v.trim() ? v.trim() : null;
        Object.assign(row, {
            ...(dto.enabled !== undefined && { enabled: dto.enabled }),
            ...(dto.displayPhone !== undefined && { displayPhone: strOrNull(dto.displayPhone) }),
            ...(dto.phoneNumberId !== undefined && { phoneNumberId: strOrNull(dto.phoneNumberId) }),
            ...(dto.wabaId !== undefined && { wabaId: strOrNull(dto.wabaId) }),
            ...(dto.accessToken !== undefined && { accessToken: strOrNull(dto.accessToken) }),
            ...(dto.appSecret !== undefined && { appSecret: strOrNull(dto.appSecret) }),
            ...(dto.verifyToken !== undefined && { verifyToken: strOrNull(dto.verifyToken) }),
            ...(dto.openaiApiKey !== undefined && { openaiApiKey: strOrNull(dto.openaiApiKey) }),
            ...(dto.openaiModel !== undefined && { openaiModel: dto.openaiModel || 'gpt-4o-mini' }),
            ...(dto.systemPrompt !== undefined && { systemPrompt: strOrNull(dto.systemPrompt) }),
            ...(dto.defaultDeliveryFee !== undefined && { defaultDeliveryFee: dto.defaultDeliveryFee }),
            ...(dto.allowMercadoPago !== undefined && { allowMercadoPago: dto.allowMercadoPago }),
            ...(dto.paymentMethods !== undefined && {
                paymentMethods: (0, whatsapp_payment_methods_1.sanitizePaymentMethodsInput)(dto.paymentMethods, {
                    allowMercadoPago: dto.allowMercadoPago !== undefined
                        ? dto.allowMercadoPago
                        : row.allowMercadoPago !== false,
                }),
            }),
            ...(dto.menuConceptGroups !== undefined && {
                menuConceptGroups: dto.menuConceptGroups,
            }),
            ...(dto.welcomeMessage !== undefined && { welcomeMessage: strOrNull(dto.welcomeMessage) }),
            ...(dto.restaurantName !== undefined && { restaurantName: strOrNull(dto.restaurantName) }),
            ...(dto.restaurantAddress !== undefined && {
                restaurantAddress: strOrNull(dto.restaurantAddress),
            }),
            ...(dto.restaurantCity !== undefined && { restaurantCity: strOrNull(dto.restaurantCity) }),
            ...(dto.restaurantNeighborhood !== undefined && {
                restaurantNeighborhood: strOrNull(dto.restaurantNeighborhood),
            }),
            ...(dto.mapsUrl !== undefined && { mapsUrl: strOrNull(dto.mapsUrl) }),
            ...(dto.publicPhone !== undefined && { publicPhone: strOrNull(dto.publicPhone) }),
            ...(dto.landmarks !== undefined && { landmarks: strOrNull(dto.landmarks) }),
            ...(dto.pickupNotes !== undefined && { pickupNotes: strOrNull(dto.pickupNotes) }),
            ...(dto.deliveryNotes !== undefined && { deliveryNotes: strOrNull(dto.deliveryNotes) }),
            ...(dto.aiExtraContext !== undefined && { aiExtraContext: strOrNull(dto.aiExtraContext) }),
            ...(dto.menuUrl !== undefined && { menuUrl: strOrNull(dto.menuUrl) }),
            ...(dto.websiteUrl !== undefined && { websiteUrl: strOrNull(dto.websiteUrl) }),
            ...(dto.instagramUrl !== undefined && { instagramUrl: strOrNull(dto.instagramUrl) }),
            ...(dto.ignoreBusinessHours !== undefined && {
                ignoreBusinessHours: dto.ignoreBusinessHours,
            }),
            ...(dto.prepTimeNote !== undefined && { prepTimeNote: strOrNull(dto.prepTimeNote) }),
            ...(dto.deliveryTimeNote !== undefined && {
                deliveryTimeNote: strOrNull(dto.deliveryTimeNote),
            }),
            ...(dto.minOrderAmount !== undefined && { minOrderAmount: dto.minOrderAmount }),
            ...(dto.maxOrderAmount !== undefined && { maxOrderAmount: dto.maxOrderAmount }),
            ...(dto.maxUnitsPerItem !== undefined && { maxUnitsPerItem: dto.maxUnitsPerItem }),
            ...(dto.maxTotalUnits !== undefined && { maxTotalUnits: dto.maxTotalUnits }),
            ...(dto.maxCartLines !== undefined && { maxCartLines: dto.maxCartLines }),
            ...(dto.handoffWhenMaxExceeded !== undefined && {
                handoffWhenMaxExceeded: dto.handoffWhenMaxExceeded,
            }),
            ...(dto.largeOrderHandoffMessage !== undefined && {
                largeOrderHandoffMessage: strOrNull(dto.largeOrderHandoffMessage),
            }),
            ...(dto.allergensNote !== undefined && { allergensNote: strOrNull(dto.allergensNote) }),
            ...(dto.promotionsNote !== undefined && { promotionsNote: strOrNull(dto.promotionsNote) }),
            ...(dto.serviceAreaNote !== undefined && { serviceAreaNote: strOrNull(dto.serviceAreaNote) }),
            ...(dto.cashChangeNote !== undefined && { cashChangeNote: strOrNull(dto.cashChangeNote) }),
            ...(dto.transferInfoNote !== undefined && {
                transferInfoNote: strOrNull(dto.transferInfoNote),
            }),
            ...(dto.specialRequestsNote !== undefined && {
                specialRequestsNote: strOrNull(dto.specialRequestsNote),
            }),
            ...(dto.askOrderNotes !== undefined && { askOrderNotes: dto.askOrderNotes }),
            ...(dto.rateLimitPerMinute !== undefined && {
                rateLimitPerMinute: Math.min(120, Math.max(5, dto.rateLimitPerMinute)),
            }),
            ...(dto.humanAgentIdleMinutes !== undefined && {
                humanAgentIdleMinutes: Math.max(0, dto.humanAgentIdleMinutes),
            }),
            ...(dto.humanClientIdleMinutes !== undefined && {
                humanClientIdleMinutes: Math.max(0, dto.humanClientIdleMinutes),
            }),
            ...(dto.orderDraftIdleMinutes !== undefined && {
                orderDraftIdleMinutes: Math.max(0, dto.orderDraftIdleMinutes),
            }),
            ...(dto.pendingChoiceIdleMinutes !== undefined && {
                pendingChoiceIdleMinutes: Math.max(0, dto.pendingChoiceIdleMinutes),
            }),
            ...(dto.mpPaymentIdleMinutes !== undefined && {
                mpPaymentIdleMinutes: Math.max(0, dto.mpPaymentIdleMinutes),
            }),
            ...(dto.sessionIdleNotify !== undefined && { sessionIdleNotify: dto.sessionIdleNotify }),
            ...(dto.paymentInstructions !== undefined && {
                paymentInstructions: strOrNull(dto.paymentInstructions),
            }),
            ...(dto.hoursNote !== undefined && { hoursNote: strOrNull(dto.hoursNote) }),
            ...(dto.cancelPolicyNote !== undefined && {
                cancelPolicyNote: strOrNull(dto.cancelPolicyNote),
            }),
            ...(dto.humanHandoffMessage !== undefined && {
                humanHandoffMessage: strOrNull(dto.humanHandoffMessage),
            }),
            ...(dto.closedMessage !== undefined && { closedMessage: strOrNull(dto.closedMessage) }),
            ...(dto.menuLinkMessage !== undefined && { menuLinkMessage: strOrNull(dto.menuLinkMessage) }),
            ...(dto.orderSuccessMessage !== undefined && {
                orderSuccessMessage: strOrNull(dto.orderSuccessMessage),
            }),
            ...(dto.aiTemperature !== undefined && { aiTemperature: dto.aiTemperature }),
        });
        if (dto.paymentMethods !== undefined) {
            const methods = (0, whatsapp_payment_methods_1.resolvePaymentMethods)(row.paymentMethods, {
                allowMercadoPago: true,
            });
            row.allowMercadoPago = methods.some((m) => m.enabled && (m.flow === 'mercadopago' || m.id === 'mercadopago'));
            row.paymentMethods = methods;
        }
        else if (dto.allowMercadoPago !== undefined && Array.isArray(row.paymentMethods)) {
            const methods = (0, whatsapp_payment_methods_1.resolvePaymentMethods)(row.paymentMethods, {
                allowMercadoPago: dto.allowMercadoPago,
            }).map((m) => m.flow === 'mercadopago' || m.id === 'mercadopago'
                ? { ...m, enabled: !!dto.allowMercadoPago }
                : m);
            row.paymentMethods = methods;
        }
        return this.settingsRepo.save(row);
    }
    maskSettings(row) {
        const mask = (v) => {
            const s = (v || '').trim();
            if (!s)
                return null;
            if (s.length <= 8)
                return '••••••••';
            return `${s.slice(0, 4)}…${s.slice(-4)}`;
        };
        return {
            id: row.id,
            enabled: !!row.enabled,
            displayPhone: row.displayPhone,
            phoneNumberId: row.phoneNumberId,
            wabaId: row.wabaId,
            accessTokenSet: !!(row.accessToken || '').trim(),
            accessTokenPreview: mask(row.accessToken),
            appSecretSet: !!(row.appSecret || '').trim(),
            appSecretPreview: mask(row.appSecret),
            verifyTokenSet: !!(row.verifyToken || '').trim(),
            verifyTokenPreview: mask(row.verifyToken),
            openaiApiKeySet: !!(row.openaiApiKey || '').trim(),
            openaiApiKeyPreview: mask(row.openaiApiKey),
            openaiModel: row.openaiModel,
            systemPrompt: row.systemPrompt,
            defaultDeliveryFee: Number(row.defaultDeliveryFee) > 0 ? Number(row.defaultDeliveryFee) : 2000,
            allowMercadoPago: !!row.allowMercadoPago,
            paymentMethods: (0, whatsapp_payment_methods_1.resolvePaymentMethods)(row.paymentMethods, {
                allowMercadoPago: row.allowMercadoPago !== false,
            }),
            menuConceptGroups: (0, whatsapp_menu_concepts_1.resolveMenuConceptGroups)(row.menuConceptGroups),
            welcomeMessage: row.welcomeMessage,
            restaurantName: row.restaurantName,
            restaurantAddress: row.restaurantAddress,
            restaurantCity: row.restaurantCity,
            restaurantNeighborhood: row.restaurantNeighborhood,
            mapsUrl: row.mapsUrl,
            publicPhone: row.publicPhone,
            landmarks: row.landmarks,
            pickupNotes: row.pickupNotes,
            deliveryNotes: row.deliveryNotes,
            aiExtraContext: row.aiExtraContext,
            menuUrl: row.menuUrl,
            websiteUrl: row.websiteUrl,
            instagramUrl: row.instagramUrl,
            ignoreBusinessHours: !!row.ignoreBusinessHours,
            prepTimeNote: row.prepTimeNote,
            deliveryTimeNote: row.deliveryTimeNote,
            minOrderAmount: Number(row.minOrderAmount) || 0,
            maxOrderAmount: Number(row.maxOrderAmount) || 0,
            maxUnitsPerItem: Number(row.maxUnitsPerItem) || 0,
            maxTotalUnits: Number(row.maxTotalUnits) || 0,
            maxCartLines: Number(row.maxCartLines) || 0,
            handoffWhenMaxExceeded: row.handoffWhenMaxExceeded !== false,
            largeOrderHandoffMessage: row.largeOrderHandoffMessage,
            allergensNote: row.allergensNote,
            promotionsNote: row.promotionsNote,
            serviceAreaNote: row.serviceAreaNote,
            cashChangeNote: row.cashChangeNote,
            transferInfoNote: row.transferInfoNote,
            specialRequestsNote: row.specialRequestsNote,
            askOrderNotes: row.askOrderNotes !== false,
            rateLimitPerMinute: Math.min(120, Math.max(5, Number(row.rateLimitPerMinute) || 25)),
            humanAgentIdleMinutes: Number(row.humanAgentIdleMinutes ?? 30),
            humanClientIdleMinutes: Number(row.humanClientIdleMinutes ?? 120),
            orderDraftIdleMinutes: Number(row.orderDraftIdleMinutes ?? 45),
            pendingChoiceIdleMinutes: Number(row.pendingChoiceIdleMinutes ?? 15),
            mpPaymentIdleMinutes: Number(row.mpPaymentIdleMinutes ?? 60),
            sessionIdleNotify: row.sessionIdleNotify !== false,
            paymentInstructions: row.paymentInstructions,
            hoursNote: row.hoursNote,
            cancelPolicyNote: row.cancelPolicyNote,
            humanHandoffMessage: row.humanHandoffMessage,
            closedMessage: row.closedMessage,
            menuLinkMessage: row.menuLinkMessage,
            orderSuccessMessage: row.orderSuccessMessage,
            aiTemperature: row.aiTemperature != null ? Number(row.aiTemperature) : 0.2,
            updatedAt: row.updatedAt,
            webhookUrlHint: '/api/whatsapp/webhook',
        };
    }
};
exports.WhatsappSettingsService = WhatsappSettingsService;
exports.WhatsappSettingsService = WhatsappSettingsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(whatsapp_settings_entity_1.WhatsappSettings)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        config_1.ConfigService])
], WhatsappSettingsService);
//# sourceMappingURL=whatsapp-settings.service.js.map