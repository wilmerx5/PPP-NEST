"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FOOD_ORDER_SIGNAL_RE = exports.PPP_ZONE_LANDMARK_RE = void 0;
exports.looksLikeClearCartMessage = looksLikeClearCartMessage;
exports.isHumanHandoffRequest = isHumanHandoffRequest;
exports.isDeliveryLogisticsFluff = isDeliveryLogisticsFluff;
exports.isNothingElseOrderIntent = isNothingElseOrderIntent;
exports.isUpcomingAddressIntent = isUpcomingAddressIntent;
exports.looksLikeNonAddressCommand = looksLikeNonAddressCommand;
exports.looksLikeDeliveryAddressFragment = looksLikeDeliveryAddressFragment;
exports.isDeliverySetupWithoutFood = isDeliverySetupWithoutFood;
exports.extractDeliverySetupAddress = extractDeliverySetupAddress;
exports.looksLikeAddressOnlyMessage = looksLikeAddressOnlyMessage;
exports.looksLikeExplicitCartItemNote = looksLikeExplicitCartItemNote;
exports.classifyWhatsappCustomerIntent = classifyWhatsappCustomerIntent;
exports.intentAllowsAddItems = intentAllowsAddItems;
exports.formatIntentHintForAi = formatIntentHintForAi;
const whatsapp_session_intents_1 = require("./whatsapp-session-intents");
function normalizeIntentText(text) {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function looksLikeClearCartMessage(text) {
    const t = normalizeIntentText(text);
    if (!t)
        return false;
    if (/^(reiniciar|reinicia|reinicio|reinciar|reset|resetear|resetea|empezar\s+de\s+nuevo|empezar\s+otra\s+vez|nuevo\s+pedido|otro\s+pedido|borrar\s+carrito|limpiar\s+carrito|vaciar\s+carrito|vaciar\s+pedido|borrar\s+pedido|borrar\s+todo|quitar\s+todo|limpiar\s+todo|vaciar\s+todo|limpiar|limpia|vaciar|vacia)$/.test(t)) {
        return true;
    }
    const clearVerb = '(?:limpiar|limpia|vaciar|vacia|vacio|borrar|borra|quitar|quita|eliminar|elimina|sacar|saca|resetear|resetea|reiniciar|reinicia|reinicio|reinciar)';
    const clearTarget = '(?:el\\s+|la\\s+|mi\\s+)?(?:carrito|pedido|todo|orden|lo\\s+que\\s+llevo|lo\\s+que\\s+pedi|de\\s+nuevo)';
    if (new RegExp(`\\b${clearVerb}\\s+${clearTarget}\\b`).test(t)) {
        return true;
    }
    if (new RegExp(`\\b${clearVerb}\\b`).test(t) && /\b(todo|carrito|pedido|orden)\b/.test(t)) {
        return true;
    }
    if (/\b(carrito|pedido)\s+(vacio|vacia|limpio|en blanco)\b/.test(t)) {
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
const HUMAN_RE = /\b(humano|asesor|operador|alguien\s+del\s+(?:local|restaurante)|hablar\s+con\s+(?:alguien|una\s+persona)|agente|asesora)\b/i;
function isHumanHandoffRequest(text) {
    const raw = (text || '').trim();
    if (!raw)
        return false;
    if (/^asesor[!?.…]*$/i.test(raw))
        return true;
    if (/^asesora[!?.…]*$/i.test(raw))
        return true;
    if (/^humano[!?.…]*$/i.test(raw))
        return true;
    const t = raw
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\bpersona'?s\b/g, 'personas');
    if (/^(quiero|necesito|pasame|pasenme|pasar)\s+(con\s+)?(un\s+|una\s+)?asesor[!?.…]*$/.test(t) ||
        /^(quiero|necesito)\s+hablar\s+con\s+(un\s+|una\s+)?asesor[!?.…]*$/.test(t)) {
        return true;
    }
    if (HUMAN_RE.test(t))
        return true;
    if (/\bpersona\b/.test(t) && !/\bpersonas\b/.test(t))
        return true;
    return false;
}
const PAYMENT_RE = /\b(contraentrega|efectivo|cash|transferencia|nequi|daviplata|llave|mercadopago|mercado\s*pago|pago\s+con)\b/i;
const CHECKOUT_DATA_RE = /\b(me\s+llamo|mi\s+nombre\s+es|soy\s+[a-záéíóúñ]|vivo\s+en|dirección|direccion|carrera|calle|diagonal|transversal|conjunto|urbanizaci[oó]n|apto|apartamento|torre)\b/i;
const ADDRESS_ONLY_RE = /^(?:para|direcci[oó]n|domicilio)\b.+/i;
const LANDMARK_KEYWORD_RE = /\b(hospital|cl[ií]nica|ips|conjunto|conj\.?|urbanizaci[oó]n|urb\.?|residencial|edificio|torres?|supermercado|exito|éxito|jumbo|ol[ií]mpica|centro\s+comercial|\bcc\b|colegio|universidad|iglesia|parque|plaza|estaci[oó]n|portal|kennedy|bosa|fontib[oó]n|engativ[aá]|suba|usaqu[eé]n|chapinero|soacha|mosquera|hermanos?|padre|santa|san\s+[a-záéíóúñ]+)\b/i;
const NAMED_COMPLEX_RE = /\b(bosques?|tierras?|villas?|alamedas?|jardines?|prados?|rincones?|miradores?|portales?|ciudadelas?|parques?|brisas?|terrazas?|balcones?|agrupaci[oó]n)\s+(de|del|de\s+la|de\s+los|de\s+las)\b/i;
exports.PPP_ZONE_LANDMARK_RE = /\b(castilla|castell[oó]n?|tintal|tabaku|altavista|alta\s*vista|vizcaya|techo|nuevo\s+sol|terrazas|aralia|mandalay|toledo|natura|galante|plazuela|san\s+esteban|pio\s*xii|pi[oó]\s*12|senderos?|imperial)\b/i;
const STREET_ADDRESS_RE = /\b(calle|carrera|cra|cll|av\.?|avenida|diag(?:onal)?|dg|transversal|barrio|habitaci[oó]n|apto|apartamento|torre|porter[ií]a|int\.?|interior)\b/i;
exports.FOOD_ORDER_SIGNAL_RE = /\b(pollo|pollos|sopa|sopas|bandeja|mojarra|mojarras|churrasco|churrascos|hamburguesa|hamburguesas|ajiaco|mondongo|gaseosa|limonada|broaster|arepa|arepas|combo|ejecutivo|bebidas?|arroz|costilla|costillas|pechuga|alitas?|sobrebarriga|chino|paisa|maduro|trucha|bagre|pescado|tacos?|burritos?|salchipapa|patacon|patacones|yuca|papas?)\b/i;
function isDeliveryLogisticsFluff(text) {
    const t = (text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!t)
        return true;
    if (/^(un |una )?(domicilios?)( por favor| porfa)?$/.test(t))
        return true;
    if (/^(por favor|porfa|gracias)$/.test(t))
        return true;
    if (/^(buenas? (noches|tardes|dias)|hola|buenas)$/.test(t))
        return true;
    if (/\b(pedir|pido|pedi|quiero|necesito|solicitar|tramitar|hacer|vamos\s+a\s+pedir)\b/.test(t) &&
        /\bdomicilios?\b/.test(t) &&
        !/\d|torre|apto|apartamento|calle|carrera|castilla|castellon|tabaku|conjunto|barrio|terrazas|hospital/.test(t)) {
        return true;
    }
    if (/^(?:para\s+)?(?:solicitar|pedir|hacer|tramitar)\s+(?:un\s+|una\s+)?domicilio\b/.test(t) &&
        !/\d|torre|apto|apartamento|calle|carrera|castilla|castellon|tabaku|conjunto|barrio|terrazas|hospital/.test(t)) {
        return true;
    }
    if (/^solicitar\s+(?:un\s+|una\s+)?domicilio\b/.test(t) &&
        !/\d|torre|apto|apartamento|calle|carrera|castilla|castellon|tabaku|conjunto|barrio|terrazas|hospital/.test(t)) {
        return true;
    }
    if (/\b(me\s+)?(colaboras|ayudas|colaborame|ayudame|puedes\s+ayudar)\b/.test(t) &&
        /\bdomicilios?\b/.test(t) &&
        !/\d|torre|apto|apartamento|calle|carrera|castilla|castellon|tabaku|conjunto|barrio|terrazas|hospital|direccion/.test(t)) {
        return true;
    }
    if (/^(para )?(un |una )?domicilio\b/.test(t) &&
        t.split(' ').length <= 5 &&
        !/\d|torre|apto|apartamento|calle|carrera|castilla|castellon|tabaku|conjunto|barrio|terrazas/.test(t)) {
        return true;
    }
    if (/^(pedir|pido|pedi)\s+(un\s+|una\s+)?domicilio\b/.test(t) && t.split(' ').length <= 6) {
        return true;
    }
    return false;
}
function isNothingElseOrderIntent(text) {
    const t = normalizeIntentText(text);
    if (!t || t.length > 48)
        return false;
    return (/^(asi\s+)?nada\s+mas$/.test(t) ||
        /^(asi\s+)?nomas$/.test(t) ||
        /^(eso\s+es\s+todo|solo\s+eso|solamente\s+eso|unicamente\s+eso|no\s+mas|no\s+nada\s+mas|asi\s+nomas|ya\s+nada\s+mas|con\s+eso\s+es\s+todo)$/.test(t));
}
function isUpcomingAddressIntent(text) {
    const t = normalizeIntentText(text);
    if (!t)
        return false;
    return (/\b(te\s+mando|te\s+envio|te\s+envío|ahi\s+te\s+mando|ah[ií]\s+te\s+mando|ya\s+te\s+mando|le\s+mando)\s+(la\s+)?direcci/.test(t) ||
        /\b(mando|envio|envío)\s+(la\s+)?direcci/.test(t) ||
        /^(la\s+)?direcci[oó]n\s+(es|va|ahorita|ya)/.test(t));
}
function looksLikeNonAddressCommand(text) {
    if (looksLikeClearCartMessage(text))
        return true;
    if (isDeliveryLogisticsFluff(text) || isDeliverySetupWithoutFood(text))
        return true;
    if (isNothingElseOrderIntent(text))
        return true;
    if (isUpcomingAddressIntent(text))
        return true;
    const t = normalizeIntentText(text);
    if (!t)
        return false;
    if (/^(listo|ok|dale|confirmar|confirmo|si|no|ninguno|ninguna|nada|gracias)$/.test(t)) {
        return true;
    }
    if (/\b(cancelar|cancela|anular|anula)\b/.test(t))
        return true;
    if (/\b(humano|asesor|agente)\b/.test(t) || isHumanHandoffRequest(text))
        return true;
    if (PAYMENT_RE.test(text))
        return true;
    if (/\b(quiero|dame|ponme|pedi|pido|agrega|agregar|ordenar|mandame|traeme)\b/.test(t) &&
        /\b(pollo|sopa|bandeja|mojarra|churrasco|hamburguesa|ajiaco|mondongo|gaseosa|limonada|broaster|arepa|combo|ejecutivo)\b/.test(t)) {
        return true;
    }
    if (/\b(que|qué)\b/.test(t) &&
        /\b(hay|tienen|tiene|tienes|ofrecen|ofreces|sirven|venden)\b/.test(t) &&
        /\b(bebidas?|sopas?|pollos?|arroces?|bandejas?|porciones?|gaseosas?|carnes?|comida|comer|platos?|menu|menú|carta)\b/.test(t)) {
        return true;
    }
    if (/\b(que|qué)\s+(hay|tienen|tienes|ofrecen)\b/.test(t))
        return true;
    if (/\b(porci[oó]n|porciones|cantidad|taza|gramos|personas)\b/.test(t) &&
        /\b(peque[nñ]a|chica|menos|alcanza|rinde|allcanza)\b/.test(t)) {
        return true;
    }
    if (/\b(tienes|tiene|tienen|hay|venden)\b/.test(t) && /\b(sopa|mondongo|ajiaco|pollo|arroz)\b/.test(t)) {
        return true;
    }
    if (/\bcambiar\b/.test(t) &&
        /\b(ensalada|papa|papas|yuca|arepa|aguacate|maduro|guarnicion|acompanamiento)\b/.test(t)) {
        return true;
    }
    if ((0, whatsapp_session_intents_1.isAddressRejectionIntent)(text) || (0, whatsapp_session_intents_1.isAddressChangeIntent)(text))
        return true;
    if ((0, whatsapp_session_intents_1.isConfirmCurrentAddressIntent)(text))
        return true;
    return false;
}
function looksLikeDeliveryAddressFragment(text) {
    const raw = (text || '').trim();
    if (raw.length < 4)
        return false;
    if (looksLikeNonAddressCommand(raw))
        return false;
    if (isDeliveryLogisticsFluff(raw))
        return false;
    if (exports.FOOD_ORDER_SIGNAL_RE.test(raw))
        return false;
    const stripped = raw
        .replace(/^(?:para|direcci[oó]n|domicilio)\s*[:\-]?\s*/i, '')
        .replace(/\s+/g, ' ')
        .trim();
    const probe = stripped.length >= 4 ? stripped : raw;
    if (looksLikeAddressOnlyMessage(raw) || looksLikeAddressOnlyMessage(probe))
        return true;
    if (NAMED_COMPLEX_RE.test(raw) || NAMED_COMPLEX_RE.test(probe))
        return true;
    if (exports.PPP_ZONE_LANDMARK_RE.test(raw) || exports.PPP_ZONE_LANDMARK_RE.test(probe))
        return true;
    if (STREET_ADDRESS_RE.test(raw) || STREET_ADDRESS_RE.test(probe))
        return true;
    if (LANDMARK_KEYWORD_RE.test(raw) && raw.length >= 6)
        return true;
    return false;
}
function isDeliverySetupWithoutFood(text) {
    const raw = (text || '').trim();
    if (raw.length < 8)
        return false;
    if (/\b(pollo|sopa|bandeja|mojarra|churrasco|hamburguesa|ajiaco|mondongo|gaseosa|limonada|broaster|arepa|combo|ejecutivo|arroz|costilla|pechuga|alitas?|sobrebarriga|chino|paisa|maduro|trucha|bagre|pescado)\b/i.test(raw)) {
        return false;
    }
    if (!/\b(domicilios?|delivery)\b/i.test(raw))
        return false;
    if (/\b(tienen|hacen|hay|cubren|cubre|llegan|llega)\b/i.test(raw) &&
        /\b(domicilios?|entregas?|env[ií]os?)\b/i.test(raw)) {
        return false;
    }
    return true;
}
function extractDeliverySetupAddress(text) {
    const raw = (text || '').trim();
    if (!raw)
        return null;
    const dirClause = raw.match(/\bdirecci[oó]n\s*[:\-]?\s*(.+)$/is);
    if (dirClause?.[1]) {
        let addr = dirClause[1]
            .replace(/\b(por\s+favor|porfa|gracias)\b/gi, '')
            .replace(/[?!.]+$/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        if (addr.length >= 6 &&
            !isDeliveryLogisticsFluff(addr) &&
            (looksLikeDeliveryAddressFragment(addr) || looksLikeAddressOnlyMessage(addr))) {
            return addr;
        }
    }
    const patterns = [
        /\b(?:domicilios?|delivery)\b[\s,]*(?:para|a|en)\s+(.+)$/i,
        /\bpara\s+(?:un\s+|una\s+)?domicilio\b[\s,]*(?:para\s+)?(.+)$/i,
        /\b(?:quiero|dame|necesito)\s+(?:un\s+|una\s+)?domicilio\b[\s,]*(?:para\s+)?(.+)$/i,
    ];
    for (const re of patterns) {
        const m = raw.match(re);
        if (!m?.[1])
            continue;
        let addr = m[1]
            .replace(/^(?:para|a|en)\s+/i, '')
            .replace(/^(?:direcci[oó]n)\s*[:\-]?\s*/i, '')
            .replace(/\b(por\s+favor|porfa|gracias)\b/gi, '')
            .replace(/[?!.]+$/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        if (!addr || /^domicilios?$/i.test(addr) || isDeliveryLogisticsFluff(addr))
            continue;
        if (/^(me\s+)?(colaboras|ayudas|ayuda|colaborame|ayudame)\b/i.test(addr))
            continue;
        if (addr.length >= 6 && looksLikeDeliveryAddressFragment(addr))
            return addr;
        if (addr.length >= 8 && looksLikeAddressOnlyMessage(addr))
            return addr;
    }
    const rest = raw
        .replace(/\b(buenas?\s*(noches|tardes|dias)?|hola)\b/gi, ' ')
        .replace(/\b(me\s+)?(colaboras|ayudas|colaborame|ayudame|puedes\s+ayudar|me\s+ayudas)\b/gi, ' ')
        .replace(/\b(quiero|dame|necesito|pido|pedi|solicitar|por\s+favor|porfa)\b/gi, ' ')
        .replace(/\b(?:para\s+)?(?:un\s+|una\s+)?domicilios?\b/gi, ' ')
        .replace(/\bdelivery\b/gi, ' ')
        .replace(/\bpara\b/gi, ' ')
        .replace(/\bcon\b/gi, ' ')
        .replace(/\bdirecci[oó]n\s*[:\-]?\s*/gi, ' ')
        .replace(/[,;:]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (rest.length >= 6 &&
        !isDeliveryLogisticsFluff(rest) &&
        looksLikeDeliveryAddressFragment(rest)) {
        return rest;
    }
    return null;
}
function looksLikeAddressOnlyMessage(text, hints = {}) {
    const raw = (text || '').trim();
    if (raw.length < 4)
        return false;
    if (looksLikeNonAddressCommand(raw))
        return false;
    if (exports.FOOD_ORDER_SIGNAL_RE.test(raw))
        return false;
    if (/\b(regala(?:me|s|nos)?|quiero|dame|ponme|pedi|pido|agrega|traer|mandame)\b/i.test(raw) &&
        /\b(\d{1,2}|un|una|dos|tres|cuatro|cinco)\b/i.test(raw)) {
        return false;
    }
    if (/\b(que|qué)\b/i.test(raw) &&
        /\b(hay|tienen|tiene|tienes|ofrecen|ofreces)\b/i.test(raw)) {
        return false;
    }
    const compoundAddr = hints.compoundAddress?.trim();
    const compoundProduct = hints.compoundProductText?.trim() || '';
    if (compoundAddr && compoundProduct.length < 3)
        return true;
    if (ADDRESS_ONLY_RE.test(raw)) {
        if (LANDMARK_KEYWORD_RE.test(raw) || STREET_ADDRESS_RE.test(raw))
            return true;
    }
    const softPlace = raw
        .replace(/[,.]?\s*(por\s+favor|porfa|pf|gracias)[\s!.?]*$/i, '')
        .trim();
    if (/^(?:para)\s+(?:el|la|los|las)\s+\S+/i.test(softPlace) &&
        !isDeliveryLogisticsFluff(softPlace) &&
        softPlace.split(/\s+/).length >= 3 &&
        softPlace.split(/\s+/).length <= 14) {
        return true;
    }
    if (STREET_ADDRESS_RE.test(raw) && /\d/.test(raw))
        return true;
    if (LANDMARK_KEYWORD_RE.test(raw) && raw.length >= 6)
        return true;
    if (NAMED_COMPLEX_RE.test(raw) && raw.length >= 8)
        return true;
    if (exports.PPP_ZONE_LANDMARK_RE.test(raw) && raw.length >= 6)
        return true;
    if (exports.PPP_ZONE_LANDMARK_RE.test(raw) &&
        /\b(t\d+|torre\s*\d+|apto\.?\s*\d+|apartamento\s*\d+|\d{3,4})\b/i.test(raw)) {
        return true;
    }
    return false;
}
function looksLikeExplicitCartItemNote(text) {
    const t = (text || '').trim();
    if (t.length < 8 || t.length > 280)
        return false;
    if (/\b(pon(?:me|le)?|agrega(?:r|me|le)?|a[nñ]ade|deja|escribe)\s+(?:una?\s+)?notas?\b/i.test(t)) {
        return true;
    }
    if (/\bnotas?\s+(?:en|para|de|a)\s+(?:la|el|las|los|este|esta|esa|ese)?\s*\w+/i.test(t)) {
        return true;
    }
    if (/^(nota|notas?)[:\s]/i.test(t))
        return true;
    if (/\bnotas?\b/i.test(t) && /["“«][^"”»]{2,160}["”»]/.test(t))
        return true;
    return false;
}
function classifyWhatsappCustomerIntent(hints) {
    const text = (hints.text || '').trim();
    if (!text)
        return 'other';
    if (hints.isHumanRequest || isHumanHandoffRequest(text))
        return 'human';
    if (looksLikeClearCartMessage(text))
        return 'clear_cart';
    if (hints.isPaymentMention || PAYMENT_RE.test(text))
        return 'payment';
    if (hints.cartLength > 0 && looksLikeExplicitCartItemNote(text)) {
        return 'side_note';
    }
    if (hints.cartLength > 0 &&
        (hints.looksLikeSideModificationNote ||
            /\b(no\s+quiero|sin|mas|más)\s+(?:de\s+)?(?:arepas?|papas?|yuca|ensalada|cebolla)\b/i.test(text))) {
        if (!/\b(dame|ponme|agrega|agregar|pedi|pido|ordenar)\b/i.test(text) ||
            /\bno\s+quiero\b/i.test(text) ||
            looksLikeExplicitCartItemNote(text)) {
            if (hints.looksLikeSideModificationNote ||
                looksLikeExplicitCartItemNote(text) ||
                /\b(para\s+(?:el\s+)?combo|sin\s+|no\s+quiero|quiero\s+(?:mas|más))\b/i.test(text)) {
                return 'side_note';
            }
        }
    }
    if (hints.cartLength > 0 &&
        (looksLikeAddressOnlyMessage(text, {
            compoundAddress: hints.compoundAddress,
            compoundProductText: hints.compoundProductText,
        }) ||
            hints.looksLikeAddressOnly)) {
        return 'address';
    }
    if (hints.isPriceInquiry)
        return 'price_question';
    if (hints.isMenuExplore ||
        hints.isCategoryBrowse ||
        hints.isGenericProductInquiry) {
        return 'menu_question';
    }
    if (hints.isCheckoutFieldReply || CHECKOUT_DATA_RE.test(text)) {
        if (!/\b(pollo|sopa|bandeja|mojarra|churrasco|hamburguesa|ajiaco|mondongo|gaseosa|limonada|broaster)\b/i.test(text)) {
            return 'checkout_data';
        }
    }
    if (hints.isOffTopicChitchat)
        return 'chitchat';
    if (/\b(quiero|dame|ponme|pedi|pido|agrega|mandame|traeme|unos?|unas?|\d+)\b/i.test(text) ||
        /\b(pollo|sopa|bandeja|mojarra|churrasco|hamburguesa|ajiaco|mondongo|gaseosa|limonada|broaster|arepa|combo|ejecutivo)\b/i.test(text)) {
        return 'order_product';
    }
    return 'other';
}
function intentAllowsAddItems(intent) {
    return intent === 'order_product' || intent === 'other';
}
function formatIntentHintForAi(intent) {
    switch (intent) {
        case 'address':
            return ('INTENCIÓN DETECTADA: dirección de domicilio. ' +
                'Usa setAddress con el texto del cliente. PROHIBIDO addItems y PROHIBIDO decir que no encontraste un plato.');
        case 'clear_cart':
            return ('INTENCIÓN DETECTADA: vaciar o borrar el carrito/pedido en armado. ' +
                'Usa clearCart: true. PROHIBIDO setAddress, addItems y PROHIBIDO anotar el mensaje como dirección.');
        case 'side_note':
            return ('INTENCIÓN DETECTADA: nota de guarnición/preferencia sobre un ítem YA en el carrito. ' +
                'PROHIBIDO addItems. Usa setCustomerNotes o describe la nota; el sistema la pega al último ítem.');
        case 'price_question':
            return 'INTENCIÓN: consulta de precio. Informa precios del menú. NO uses addItems.';
        case 'menu_question':
            return 'INTENCIÓN: explorar/dudar del menú. Orienta por categorías. NO uses addItems.';
        case 'payment':
            return 'INTENCIÓN: método de pago. Usa setPaymentMethod con un id permitido. NO uses addItems.';
        case 'checkout_data':
            return 'INTENCIÓN: dato de checkout (nombre/dirección). Usa setCustomerName o setAddress. NO uses addItems.';
        case 'human':
            return 'INTENCIÓN: pedir asesor humano. Usa requestHuman.';
        case 'chitchat':
            return 'INTENCIÓN: charla fuera de pedido. Redirige amable al menú o *asesor*. NO uses addItems.';
        case 'order_product':
            return ('INTENCIÓN: pedido de producto. Solo addItems con productId del menú autorizado. ' +
                'Si el carrito ya tiene un combo/plato y el mensaje es solo preferencia de acompañamiento, NO agregues arepas/papas como ítems.');
        default:
            return 'INTENCIÓN: no clara. Si no hay producto claro, pregunta; no inventes addItems.';
    }
}
//# sourceMappingURL=whatsapp-intent.js.map