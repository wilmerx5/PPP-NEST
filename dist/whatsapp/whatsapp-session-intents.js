"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAddressChangeIntent = isAddressChangeIntent;
exports.isAddressRejectionIntent = isAddressRejectionIntent;
exports.isAddressClarificationIntent = isAddressClarificationIntent;
exports.isPostOrderFollowUpIntent = isPostOrderFollowUpIntent;
exports.isInterruptedPhoneOrderInquiry = isInterruptedPhoneOrderInquiry;
exports.isReuseLastAddressIntent = isReuseLastAddressIntent;
exports.isConfirmCurrentAddressIntent = isConfirmCurrentAddressIntent;
exports.isUsableWhatsappCustomerName = isUsableWhatsappCustomerName;
exports.isCourtesyAffirmation = isCourtesyAffirmation;
exports.isDeliveryEtaInquiry = isDeliveryEtaInquiry;
exports.isSpecificOrderProgressInquiry = isSpecificOrderProgressInquiry;
exports.extractDailyOrderNumberHint = extractDailyOrderNumberHint;
exports.isDeliveryAvailabilityFaq = isDeliveryAvailabilityFaq;
exports.isDeliveryRangeQuestion = isDeliveryRangeQuestion;
exports.isUnansweredHumanComplaint = isUnansweredHumanComplaint;
exports.isDeliveryCoverageInquiry = isDeliveryCoverageInquiry;
exports.parseCartItemReplacement = parseCartItemReplacement;
exports.isCartItemReplacementIntent = isCartItemReplacementIntent;
exports.parseEachOfQuantity = parseEachOfQuantity;
exports.parseQtyMenuCodeLines = parseQtyMenuCodeLines;
exports.parseQtyDishCorrection = parseQtyDishCorrection;
exports.isCartChargeQuestion = isCartChargeQuestion;
exports.looksLikeKitchenSendRequest = looksLikeKitchenSendRequest;
exports.productNamesMentionedInOffer = productNamesMentionedInOffer;
exports.isPendingAddOfferDecline = isPendingAddOfferDecline;
exports.extractCoverageAddressProbe = extractCoverageAddressProbe;
exports.isAbandonPendingSelectionIntent = isAbandonPendingSelectionIntent;
exports.pickProductNamedInLastOffer = pickProductNamedInLastOffer;
exports.resolvePendingListOrMenuCode = resolvePendingListOrMenuCode;
function isAddressChangeIntent(text) {
    const t = (text || '').trim().toLowerCase();
    if (!t || t.length < 8)
        return false;
    if (isAddressRejectionIntent(t))
        return true;
    return (/\b(cambia(r|me)?|actualiza(r|me)?|modifica(r|me)?|corrige|corregir)\s+(la\s+)?(direcci[oó]n|direcion|domicilio|ubicaci[oó]n)\b/i.test(t) ||
        /\b(la\s+)?(direcci[oó]n|direcion|domicilio)\s+(es|queda|ahora|nueva)\b/i.test(t) ||
        /\b(nueva\s+direcci[oó]n|otro\s+domicilio|cambiar\s+domicilio)\b/i.test(t));
}
function isAddressRejectionIntent(text) {
    const t = (text || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\bdirecion\b/g, 'direccion');
    if (!t || t.length < 8)
        return false;
    if (/\b(calle|carrera|cra|cll|av\.?|avenida|diag|torre|apto|apartamento|conjunto)\b/.test(t) &&
        /\d/.test(t)) {
        return false;
    }
    if (/\bno\s+(esa|eso|esta|este)\s+no\s+es\s+(mi\s+)?(direccion|domicilio|ubicacion)\b/.test(t)) {
        return true;
    }
    if (/\bno\s+es\s+(mi\s+)?(direccion|domicilio|ubicacion)\b/.test(t))
        return true;
    if (/\b(esa|eso|esta|este)\s+no\s+es\s+(mi\s+)?(direccion|domicilio|ubicacion)\b/.test(t)) {
        return true;
    }
    if (/\b(direccion|domicilio)\s+(incorrect[ao]|equivocad[ao]|mal|errada)\b/.test(t)) {
        return true;
    }
    if (/^no[,.]?\s+(esa|eso)\s+no\s+es\b/.test(t) && /\b(direccion|domicilio|direcion)\b/.test(t)) {
        return true;
    }
    return false;
}
function isAddressClarificationIntent(text) {
    const t = (text || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\bdirecion\b/g, 'direccion');
    if (!t || t.length < 10)
        return false;
    if (isAddressRejectionIntent(t))
        return false;
    return (/\b(esa|eso|esta|este)\s+(era|es|fue)\s+(mi\s+)?(direccion|domicilio|ubicacion)\b/.test(t) ||
        /\b(era|es)\s+(mi\s+)?(direccion|domicilio)\b/.test(t) ||
        /\bte\s+(pas[eé]|mand[eé]|envi[eé])\s+(la\s+)?(direccion|domicilio)\b/.test(t));
}
function isPostOrderFollowUpIntent(text) {
    const raw = (text || '').trim();
    if (raw.length < 3)
        return false;
    const t = raw
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    if (/\b(quiero|dame|ponme|regala|pedi|pido|ordenar|me\s+envias|me\s+mandas)\b/.test(t) &&
        /\b(pollo|arroz|sopa|combo|bandeja|ejecutivo|churrasco|hamburguesa|ajiaco|mondongo|gaseosa)\b/.test(t)) {
        return false;
    }
    if (/\b(se\s+demora|esta\s+demorado|esta\s+demorada|muy\s+demorado|cuanto\s+(tiempo|se\s+tarda|tarda)|en\s+cuanto\s+(llega|llegaria|llegara)|cuando\s+(llega|sale|salen)|ya\s+(salio|salieron|va\s+en\s+camino|esta\s+en\s+camino|debe\s+estar)|nada\s+que\s+llega|van\s+a\s+llegar\s+frias|ya\s+vamos\s+(una\s+hora|para\s+mas)|me\s+tengo\s+que\s+ir|mejor\s+(lo\s+)?cancelo|cancelarl[oa]|va\s+(a\s+)?tocar\s+cancel|cancelar?\s+(el\s+)?pedido|ya\s+salieron\s+para\s+aca)\b/.test(t)) {
        return true;
    }
    if (/\bya\s+lleg[oó]\b/.test(t) && t.length <= 40) {
        return true;
    }
    if (/\b(trajo\s+(un|el|otro)|no\s+me\s+(regalaron|trajeron|enviaron)|falto|me\s+falta)\b/.test(t)) {
        return true;
    }
    return false;
}
function isInterruptedPhoneOrderInquiry(text) {
    const raw = (text || '').trim();
    if (raw.length < 12)
        return false;
    const t = raw
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    if (/\b(quiero|dame|ponme|regala|pedi|pido|agrega|ordenar)\b/.test(t) &&
        /\b(pollo|arroz|sopa|combo|bandeja|ejecutivo|churrasco|hamburguesa|ajiaco|mondongo|gaseosa)\b/.test(t)) {
        return false;
    }
    const callCut = /\b(se\s+corto|se\s+cortaron|cortaron|cayo\s+la\s+llamada|se\s+cayo)\b/.test(t) &&
        /\b(llamada|llamado|telefono|celular)\b/.test(t);
    const validateTaken = /\b(alcanzaron\s+a\s+tomar|alcanzo\s+a\s+tomar|lo\s+tomaron|qued[oó]\s+(registrado|tomado|el\s+pedido)|validar?\s+(si\s+)?(el\s+)?pedido|si\s+(ya\s+)?(lo\s+)?(tomaron|registraron|anotaron))\b/.test(t);
    const wasOrdering = /\b(estaba\s+pidiendo|estoy\s+pidiendo|pedi\s+por\s+(llamada|telefono)|pedido\s+por\s+(llamada|telefono))\b/.test(t);
    if (callCut && (/\b(pedido|domicilio|orden)\b/.test(t) || validateTaken || wasOrdering)) {
        return true;
    }
    if (validateTaken && (/\b(llamada|telefono|pedido|domicilio|orden)\b/.test(t) || wasOrdering)) {
        return true;
    }
    if (wasOrdering && (callCut || validateTaken || /\b(validar|confirmar|revisar)\b/.test(t))) {
        return true;
    }
    return false;
}
function isReuseLastAddressIntent(text) {
    const t = (text || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    if (!t || t.length > 40)
        return false;
    if (/^(si|sep|ok|okay|dale|listo|correcto|exacto|esa|esa misma|confirmo|esta bien|estan bien|todo bien|asi esta bien|de acuerdo)([\s!.?]*|(\s+por\s+fa(vor|fa)?[\s!.?]*))$/i.test(t)) {
        return true;
    }
    if (/^(aca|acá|ahi|ahí|alli|allí|aqui|aquí)([\s!.?]*|(\s+si[\s!.?]*))$/i.test(t)) {
        return true;
    }
    if (/^(la\s+misma(\s+direcci[oó]n)?|misma\s+direcci[oó]n|la\s+de\s+siempre|la\s+anterior)[\s!.?]*$/i.test(t)) {
        return true;
    }
    return false;
}
function isConfirmCurrentAddressIntent(text) {
    const t = (text || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\bdirecion\b/g, 'direccion')
        .replace(/[¡!?.]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!t || t.length < 5 || t.length > 72)
        return false;
    if (/\b(calle|carrera|cra|cll|av\.?|avenida|diag|dg|transversal|torre|apto|apartamento|conjunto)\b/.test(t) &&
        /\d/.test(t)) {
        return false;
    }
    if (isAddressRejectionIntent(t) || isAddressChangeIntent(t))
        return false;
    const courtesy = String.raw `(?:\s+(?:plis|porfa|por\s+favor|please|gracias))?`;
    return (new RegExp(String.raw `^(?:(?:si|sí|ok|dale|listo)\s+)?(?:a|para)\s+(?:esta|esa|la\s+misma)\s+(?:direccion|domicilio|ubicacion)${courtesy}$`).test(t) ||
        new RegExp(String.raw `^(?:esta|esa|la\s+misma)\s+(?:direccion|domicilio|ubicacion)${courtesy}$`).test(t) ||
        new RegExp(String.raw `^(?:envia(?:me|lo|nos)?|manda(?:me|lo|nos)?|lleva(?:me|lo|nos)?|trae(?:me|lo)?)\s+(?:a\s+)?(?:esta|esa)\s+(?:direccion|domicilio)${courtesy}$`).test(t) ||
        new RegExp(String.raw `^(?:a|para)\s+(?:esa|esta|ahi|alla)${courtesy}$`).test(t));
}
function isUsableWhatsappCustomerName(name) {
    const raw = (name || '').trim();
    if (raw.length < 2 || raw.length > 80)
        return false;
    const t = raw
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!t)
        return false;
    if (/\d{3,}/.test(t))
        return false;
    if (/\b(calle|carrera|cra|cll|domicilio|direccion|whatsapp|telefono|celular)\b/.test(t)) {
        return false;
    }
    const blockedExact = new Set([
        'pedido',
        'pedidos',
        'cliente',
        'clientes',
        'customer',
        'user',
        'usuario',
        'admin',
        'test',
        'prueba',
        'whatsapp',
        'ppp',
        'pronto',
        'pollo',
        'portal',
        'delivery',
        'domicilio',
        'nombre',
        'sin nombre',
        'n a',
        'na',
        'none',
        'null',
        'undefined',
        'asd',
        'qwerty',
        'no',
        'si',
        'sí',
        'ok',
        'listo',
        'necesito',
        'quiero',
        'quería',
        'queria',
        'dame',
        'ponme',
        'pido',
        'pedi',
        'regalame',
        'regáleme',
        'hola',
        'buenas',
        'buenos',
        'tardes',
        'dias',
        'días',
        'seria',
        'querria',
        'regalas',
        'regala',
    ]);
    if (blockedExact.has(t))
        return false;
    if (/^(?:(?:solo|solamente)\s+)?(?:eran?|faltan?|quita|quitar|cambia|cambiar)\b/.test(t))
        return false;
    if (/^(este|esta|esto|ese|esa|eso|aquel|aquella)$/.test(t))
        return false;
    if (/[?¿]/.test(raw))
        return false;
    if (/^(por\s*que|porque|cuanto|cuantos|cuantas)\b/.test(t))
        return false;
    if (/^(necesito|quiero|queria|seria|dame|ponme|pido|pedi|regalame|regalas|regala|para|hacer|buenas|buenos|hola)\b/.test(t)) {
        return false;
    }
    if (/^me\s+(regalas?|das|pones|mandas|traes|puedes|colaboras|ayudas|envias|envías)\b/.test(t)) {
        return false;
    }
    if (/\bpor favor\b/.test(t) && /\b(envia|envias|enviar|enviame|manda|mandas|mandame|ponle)\b/.test(t)) {
        return false;
    }
    if (/^(y\s+)?(envia|envias|enviar|enviame|manda|mandas|mandame|ponle)\b/.test(t)) {
        return false;
    }
    if (/\b(hacer|pedir|ordenar|domicilio|pedido|orden|combo|pollo|arroz|regalas?)\b/.test(t) &&
        /^(para|quiero|necesito|voy|vengo|me|seria)\b/.test(t)) {
        return false;
    }
    if (/^(pronto\s+pollo(\s+portal)?|ppp\s+pedidos?)$/.test(t))
        return false;
    if (/^pedidos?\b/.test(t) && t.split(' ').length <= 2)
        return false;
    if (isCourtesyAffirmation(t))
        return false;
    return true;
}
function isCourtesyAffirmation(text) {
    const t = (text || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[¡!?.…,;:"'`´]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!t || t.length > 40)
        return false;
    return /^(si|sep|ok|okay|dale|listo|claro|va|vale|bueno|perfecto|correcto|exacto|confirmo|agrega|agregalo|agregalos|asi)(\s+que\s+si)?(\s+(por favor|porfa|porfis|gracias|pls|please|agregalo|agregamelo))?$/.test(t);
}
function isDeliveryEtaInquiry(text) {
    const raw = (text || '').trim();
    if (raw.length < 6)
        return false;
    if (/\b(quiero|dame|ponme|regala|pedi|pido|agrega|ordenar)\b/i.test(raw) &&
        /\b(pollo|arroz|sopa|combo|bandeja|ejecutivo|churrasco|hamburguesa)\b/i.test(raw)) {
        return false;
    }
    const t = raw
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    return (/\b(se\s+demora|cuanto\s+(se\s+)?(demora|tarda|tardaria)|cuanto\s+tiempo|en\s+cuanto\s+(llega|llegaria|llegara|sale|salen)|cuando\s+(llega|llegaria)|tiempo\s+de\s+(domicilio|entrega|espera)|demora\s+(el\s+)?(domicilio|pedido|envio)|eta)\b/.test(t) ||
        /\b(cuanto|cuanto\s+aprox|mas\s*o?\s*menos|masomenos|aprox(?:imadamente)?)\b.+\b(minutos?|mins?|demora|tarda|lleg)\b/.test(t) ||
        /\b(mas\s*o?\s*menos|masomenos|aprox(?:imadamente)?)\s+cuanto\b/.test(t));
}
function isSpecificOrderProgressInquiry(text) {
    const raw = (text || '').trim();
    if (raw.length < 4)
        return false;
    const t = raw
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    if (/\b(terminar|cerrar|finalizar|completar|confirmar)\s+(el\s+|mi\s+|este\s+)?pedido\b/.test(t) ||
        /\b(quiero|vamos\s+a|deseo|necesito)\s+(terminar|cerrar|finalizar|completar|confirmar)\b/.test(t) ||
        /^(ya\s+)?(eso\s+)?es\s+todo$/.test(t) ||
        /^(eso\s+todo|listo\s+es\s+todo|ya\s+todo)$/.test(t) ||
        /^(asi\s+)?nada\s+mas$/.test(t) ||
        /^(eso\s+es\s+todo|solo\s+eso)$/.test(t)) {
        return false;
    }
    if (extractDailyOrderNumberHint(raw) != null)
        return true;
    if (/\b(mi\s+pedido|el\s+pedido|mi\s+orden|la\s+orden|mi\s+compra|el\s+#\s*\d+)\b/.test(t)) {
        return true;
    }
    if (/\b(en\s+que\s+(va|esta|andan)|donde\s+(va|esta|andan)|ya\s+(salio|salieron|va\s+en\s+camino|esta\s+en\s+camino)|estado\s+(del?\s+)?(pedido|orden)|ubicar\s+(al\s+)?domiciliario)\b/.test(t)) {
        return true;
    }
    if (isDeliveryEtaInquiry(raw) &&
        /\b(pedido|orden|ordenes|domiciliario|repartidor|mi\s+comida)\b/.test(t)) {
        return true;
    }
    return false;
}
function extractDailyOrderNumberHint(text) {
    const raw = (text || '').trim();
    if (!raw)
        return null;
    const m = raw.match(/\b(?:orden|pedido|order)\s*#?\s*(\d{1,4})\b/i) ||
        raw.match(/(?<!\d\s*)#\s*(\d{1,4})\b/) ||
        raw.match(/^(?:el\s+|la\s+)?(?:n[uú]mero\s+)?(\d{1,3})[\s!.?]*$/i);
    if (!m?.[1])
        return null;
    const n = parseInt(m[1], 10);
    if (!Number.isFinite(n) || n < 1 || n > 9999)
        return null;
    return n;
}
function isDeliveryAvailabilityFaq(text) {
    const raw = (text || '').trim();
    if (raw.length < 6 || raw.length > 80)
        return false;
    if (/\b(para|en|hasta|por)\s+(?!domicilio\b)\S/i.test(raw) && /\d|#|calle|carrera|castilla|torre|apto/i.test(raw)) {
        return false;
    }
    const t = raw
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    return (/\b(tienen|tiene|tienes|hacen|hace|hay)\s+(servicio\s+a\s+)?domicilios?\b/.test(t) ||
        /\btienes\s+domicilio\b/.test(t) ||
        /^domicilios?\s*[?¿]*$/.test(t));
}
function isDeliveryRangeQuestion(text) {
    const raw = (text || '').trim();
    if (raw.length < 8 || raw.length > 140)
        return false;
    const t = raw
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    if (/\b(pollo|sopa|arroz|combo|ejecutivo|bandeja|hamburguesa|mojarra)\b/.test(t)) {
        return false;
    }
    if (/\d{2,}|#|\b(calle|carrera|cra|cll|diagonal|transversal)\b/.test(t))
        return false;
    const asksHowFar = /\b(que\s+tan\s+lejos|tan\s+lejos|hasta\s+donde|hasta\s+que\s+(zona|barrio|parte)|que\s+distancia|cuantos?\s+(km|kilometros)|que\s+radio|radio\s+de|zona\s+de\s+cobertura)\b/.test(t);
    if (!asksHowFar)
        return false;
    return /\b(domicilios?|delivery|llevan|llevas|llega|llegan|cubren|cubre|reparten|reparto)\b/.test(t);
}
function isUnansweredHumanComplaint(text) {
    const raw = (text || '').trim();
    if (!raw || raw.length > 120)
        return false;
    const t = raw
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    if (/^\?{2,6}[!¿?]*$/.test(raw.trim()))
        return true;
    return (/\bno\s+me\s+(han|has)\s+(escrito|contestado|respondido)\b/.test(t) ||
        /\bnadie\s+(me\s+)?(responde|contesta|escribe)\b/.test(t) ||
        /\by\s+el\s+asesor\b/.test(t) ||
        /\bsiguen\s+sin\s+(responder|contestar)\b/.test(t));
}
function isDeliveryCoverageInquiry(text) {
    const raw = (text || '').trim();
    if (raw.length < 12)
        return false;
    const orderingFood = /\b(quiero|dame|ponme|regala|pedi|pido|agrega|ordenar|un\s+pollo|una\s+sopa|combo\s+de|ejecutivo|arroz\s+con)\b/i.test(raw);
    if (orderingFood)
        return false;
    if (/\b(tienen|tiene|hacen|hace|hay)\s+(servicio\s+a\s+)?domicilios?\s*[?.!]*$/i.test(raw) ||
        /\b(servicio\s+a\s+domicilio|domicilio\s+a\s+domicilio)\s*[?.!]*$/i.test(raw) ||
        /\bustedes\s+tienen\s+(servicio\s+a\s+)?domicilio\b/i.test(raw)) {
        if (!/\b(para|en|hasta|por)\s+(?!domicilio\b)(\S)/i.test(raw)) {
            return false;
        }
    }
    if (/\b(domicilios?|entregas?)\s+(para|a|en|hasta)\b/i.test(raw)) {
        if (/\bdomicilios?\s+a\s+domicilio\b/i.test(raw))
            return false;
        return true;
    }
    if (/\b(tienen|hacen|hay|cubren|cubre|llegan|llega)\b/i.test(raw) &&
        /\b(domicilios?|entregas?|env[ií]os?)\b/i.test(raw) &&
        /\b(para|en|hasta|por)\s+(?!domicilio\b)/i.test(raw)) {
        return true;
    }
    if (/\b(tienen|hacen|hay|cubren|cubre|llegan|llega)\b/i.test(raw) &&
        /\b(domicilios?|entregas?|env[ií]os?)\b/i.test(raw) &&
        /\b(?:para|en|hasta|por)\s+(?!domicilio\b)\S/i.test(raw)) {
        return true;
    }
    if (/\b(hacen|tienen)\s+(servicio\s+a\s+)?domicilio\b/i.test(raw) &&
        /\b(para|en|hasta)\s+(?!domicilio\b)\S/i.test(raw)) {
        return true;
    }
    return false;
}
const CART_SWAP_SIDE_ONLY = /^(?:m[aá]s\s+)?(?:arepas?|papas?(?:\s+salada)?|yuca(?:\s+frita)?|ensalada|aguacate|maduro|patacones?|cebolla|tomate)$/i;
const CART_SWAP_DISH_TOKEN = /\b(?:combo|pollo|broaster|frito|asado|sopa|bandeja|costillas?|mojarras?|arroz|hamburguesa|pechuga|alitas?|churrascos?|ejecutivo|gaseosa|limonada|platano|pl[aá]tano|ajiaco|mondongo|sobrebarriga|tacos?|bagre|trucha)\b/i;
function parseCartItemReplacement(text) {
    const raw = (text || '').trim();
    if (!raw || raw.length < 12)
        return null;
    const patterns = [
        /^no\s+quiero\s+(.+?)(?:\s*[,;]\s*|\s+)(?:quiero|dame|pon(?:me)?|mejor(?:\s+quiero)?)\s+(.+)$/i,
        /^(?:cambia(?:r|me)?|c[aá]mbial[oa]|reemplaza(?:r|me)?)\s+(.+?)\s+por\s+(.+)$/i,
        /^(?:en\s+vez\s+de)\s+(.+?)(?:\s*[,;]\s*|\s+)(?:quiero|dame|pon(?:me)?)?\s*(.+)$/i,
    ];
    for (const re of patterns) {
        const m = raw.match(re);
        if (!m?.[1]?.trim() || !m?.[2]?.trim())
            continue;
        const removeQuery = m[1]
            .replace(/^(el|la|los|las|un|una|unos|unas)\s+/i, '')
            .replace(/\s+/g, ' ')
            .trim();
        const addQuery = m[2]
            .replace(/^(el|la|los|las|un|una|unos|unas)\s+/i, '')
            .replace(/\s+/g, ' ')
            .trim();
        if (removeQuery.length < 3 || addQuery.length < 3)
            continue;
        if (CART_SWAP_SIDE_ONLY.test(removeQuery) || CART_SWAP_SIDE_ONLY.test(addQuery)) {
            continue;
        }
        if (!CART_SWAP_DISH_TOKEN.test(addQuery))
            continue;
        return { removeQuery, addQuery };
    }
    return null;
}
function isCartItemReplacementIntent(text) {
    return !!parseCartItemReplacement(text);
}
function parseEachOfQuantity(text) {
    const m = (text || '').match(/\b(\d{1,2})\s+de\s+cada\s+(una|uno)\b/i);
    if (!m)
        return null;
    const n = parseInt(m[1], 10);
    if (n < 1 || n > 20)
        return null;
    return n;
}
function parseQtyMenuCodeLines(text) {
    const lines = (text || '')
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    if (!lines.length)
        return null;
    const out = [];
    for (const line of lines) {
        const m = line.match(/^(\d{1,2})\s*#\s*(\d{1,4})$/);
        if (!m)
            return null;
        const qty = parseInt(m[1], 10);
        const code = parseInt(m[2], 10);
        if (qty < 1 || qty > 30 || code < 1)
            return null;
        out.push({ qty, code });
    }
    return out;
}
function parseQtyDishCorrection(text) {
    const raw = (text || '').trim();
    if (!raw)
        return null;
    const t = raw
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    if (!/\b(no|esta mal|estan mal|son solo|solo son)\b/.test(t))
        return null;
    const heading = raw.match(/\bson\s+(\d{1,2})\s+sopas?\s*[:,]?\s*/i);
    const list = heading ? raw.slice((heading.index || 0) + heading[0].length).split(';')[0] : raw;
    const parts = [
        ...list.matchAll(/(\d{1,2})\s+(?:de\s+)?([a-záéíóúñü]+(?:\s+(?!y\b|e\b)[a-záéíóúñü]+)*)/gi),
    ];
    const lines = parts
        .map((m) => ({ qty: parseInt(m[1], 10), dish: m[2].trim() }))
        .filter((l) => l.qty >= 1 && l.qty <= 20 && !/^(cada|esas|esos|ellas|ellos)$/i.test(l.dish));
    if (lines.length < 2)
        return null;
    if (heading && lines.reduce((sum, line) => sum + line.qty, 0) !== Number(heading[1]))
        return null;
    return lines;
}
function isCartChargeQuestion(text) {
    const t = (text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    return /\b(cobrando|me cobran)\b/.test(t);
}
function looksLikeKitchenSendRequest(text) {
    const raw = (text || '').trim();
    if (raw.length < 8 || raw.length > 120)
        return false;
    const t = raw
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    if (/\d/.test(t))
        return false;
    if (/\b(sopa|pollo|combo|ajiaco|menudencia|gaseosa|pedido|menu|nequi|link|pago|direccion)\b/.test(t)) {
        return false;
    }
    return /^(y\s+)?(envia|envias|enviame|enviar|manda|mandas|mandame|ponle)\b/.test(t);
}
function productNamesMentionedInOffer(offerText, productNames) {
    const blob = (offerText || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    const ranked = productNames
        .map((raw) => ({
        raw,
        norm: raw
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, ''),
    }))
        .filter((n) => n.norm.length >= 10 && blob.includes(n.norm))
        .sort((a, b) => b.norm.length - a.norm.length);
    const kept = [];
    for (const n of ranked) {
        if (kept.some((k) => k.norm.includes(n.norm)))
            continue;
        kept.push(n);
    }
    return kept.map((n) => n.raw);
}
function isPendingAddOfferDecline(text) {
    const t = (text || '').trim();
    if (!t)
        return false;
    if (/^(no|nop|nope|nel|despues|después|luego|ahora\s+no|no\s+gracias|mejor\s+no|nah)[\s!.?]*$/i.test(t)) {
        return true;
    }
    if (/^(no\s+se[nñ]or[a]?|no\s+gracias)([\s,!.?]+gracias)?[\s!.?]*$/i.test(t) &&
        !/\bdirecci/i.test(t)) {
        return true;
    }
    const n = t
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    if (/\bno\b/.test(n) &&
        /\bsolo\b/.test(n) &&
        !/\b(quiero|dame|agrega|ponme|pedi)\s+(un|una|unos|unas|otro|otra)\b/.test(n)) {
        return true;
    }
    if (/^(solo|solamente|unicamente)\b.{0,60}\b(combo|carrito|pedido|eso|ese|esa|lo\s+que\s+(ya\s+)?(hay|tengo|pedi))\b/i.test(t)) {
        return true;
    }
    if (/\bno\s+(lo\s+|la\s+|el\s+)?(agregues|agregar|metas|añadas|sumes)\b/i.test(t)) {
        return true;
    }
    if (/^no\b[,!.\s]+gracias\b/i.test(t) && t.length < 48 && !/\bdirecci/i.test(t)) {
        return true;
    }
    return false;
}
function extractCoverageAddressProbe(text) {
    const raw = (text || '').trim();
    if (!raw)
        return null;
    const patterns = [
        /\b(?:domicilios?|entregas?|env[ií]os?)\s+(?:para|a|en|hasta)\s+(?!domicilio\b)(.+?)[\s?!.]*$/i,
        /\bservicio\s+a\s+domicilio\s+(?:para|en|hasta)\s+(.+?)[\s?!.]*$/i,
        /\b(?:para|a|en|hasta)\s+((?:calle|carrera|cra|cll|dg|diagonal|av\.?|avenida|conjunto|torre|barrio)\b.+?)[\s?!.]*$/i,
        /\b(?:para|en|hasta)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9].{5,90})[\s?!.]*$/i,
    ];
    for (const re of patterns) {
        const m = raw.match(re);
        if (m?.[1]) {
            const addr = m[1]
                .replace(/\b(por\s+favor|porfa|gracias|ok|vale)\b/gi, '')
                .replace(/[?!.]+$/g, '')
                .replace(/\s+/g, ' ')
                .trim();
            if (addr.length < 6)
                continue;
            if (/^(domicilios?|entregas?|env[ií]os?|servicio)$/i.test(addr))
                continue;
            return addr;
        }
    }
    return null;
}
function isAbandonPendingSelectionIntent(text) {
    const t = text.trim().toLowerCase();
    if (!t)
        return false;
    if (/^(hola|buenas|buenos\s+dias|buenas\s+tardes|buenas\s+noches|hey|hi)[\s!.?]*$/i.test(t)) {
        return true;
    }
    if (/^(reinicio|reiniciar|reinicia|reset|resetear|resetea)[\s!.?]*$/i.test(t)) {
        return true;
    }
    if (/^(pollo\s+no|no\s+(el\s+)?pollo|no\s+quiero\s+(el\s+)?pollo)[\s!.?]*$/i.test(t)) {
        return true;
    }
    if (/^ya\s+no[\s!.?]*$/.test(t))
        return true;
    if (/^(no|nop|nel)[\s!.?]*$/.test(t))
        return true;
    if (/\bya\s+no\s+(quiero|deseo|pido|me\s+interesa)\b/.test(t))
        return true;
    if (/\bno\s+eso\s+no\s+es\b/.test(t) || /\bno\s+esa\s+no\s+es\b/.test(t))
        return true;
    if (/\b(no\s+lo\s+quiero|no\s+la\s+quiero|no\s+era\s+eso|no\s+es\s+eso|me\s+equivoqu[eé]|olvidalo|olvídalo|olvidate|olvídate|dejalo|d[eé]jalo|cancelalo|cancelala|canc[eé]lalo|quitalo|qu[ií]talo|sacalo|no\s+agregues|no\s+lo\s+agregues)\b/.test(t)) {
        return true;
    }
    if (/\b(cancelar?\s+(eso|este|esta|ese|esa|el\s+producto|la\s+opci[oó]n|el\s+pollo|esa\s+opci[oó]n)|que\s+lo\s+cancel|que\s+la\s+cancel)\b/.test(t)) {
        return true;
    }
    if (/\b(no\s+quiero\s+(?:eso|este|esta|ese|esa|el\s+producto|el\s+pollo|pollo|continuar|seguir|eso\s+del\s+pollo|la\s+sopa\s+peque[nñ]a|sopa\s+peque[nñ]a))\b/.test(t)) {
        return true;
    }
    if (/\b(no\s+quie[ro]+\s+(?:eso|este|esta|ese|el\s+pollo|pollo|broaster))\b/.test(t)) {
        return true;
    }
    return false;
}
const OFFER_GLUE = new Set([
    'de',
    'del',
    'der',
    'da',
    'la',
    'el',
    'las',
    'los',
    'un',
    'una',
    'con',
    'por',
    'para',
    'que',
    'quiero',
    'quieres',
]);
function offerNorm(text) {
    return (text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function offerOptionNorm(text) {
    return (text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9$\s()]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function escapeOfferName(name) {
    return name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function nameListedAsOfferOption(offer, name) {
    const priced = new RegExp(`${escapeOfferName(name)}\\s*\\(\\s*\\$`).test(offer);
    if (priced)
        return true;
    const bounded = new RegExp(`(?:^|[?¿]|quieres|cual|\\bo\\b|,)\\s*${escapeOfferName(name)}(?:\\s*(?:\\(|\\$|\\bo\\b|,|\\?|$))`);
    return bounded.test(offer);
}
function offerEditDistance(a, b) {
    const m = a.length;
    const n = b.length;
    const dp = Array.from({ length: n + 1 }, (_, i) => i);
    for (let i = 1; i <= m; i++) {
        let prev = dp[0];
        dp[0] = i;
        for (let j = 1; j <= n; j++) {
            const tmp = dp[j];
            dp[j] =
                a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
            prev = tmp;
        }
    }
    return dp[n];
}
function isOfferGlueToken(token) {
    if (OFFER_GLUE.has(token))
        return true;
    if (token.length > 4)
        return false;
    return ['de', 'del', 'la', 'el', 'las', 'los', 'una', 'con'].some((base) => base !== token && offerEditDistance(token, base) <= 1);
}
function offerContentTokens(text) {
    return [
        ...new Set(offerNorm(text).split(' ').filter((t) => t.length >= 3 && !isOfferGlueToken(t))),
    ];
}
function pickProductNamedInLastOffer(userText, offerText, products) {
    const rawOffer = offerNorm(offerText);
    const asked = /[?¿]/.test(offerText || '') ||
        rawOffer.includes('quieres') ||
        rawOffer.includes('cual');
    if (!rawOffer || !asked)
        return null;
    const offer = rawOffer;
    const optionOffer = offerOptionNorm(offerText);
    const offered = products.filter((p) => {
        const name = offerNorm(p.name);
        return name.length >= 8 && offer.includes(name) && nameListedAsOfferOption(optionOffer, name);
    });
    if (offered.length < 2)
        return null;
    const said = offerContentTokens(userText);
    if (!said.length || !said.some((t) => t.length >= 5))
        return null;
    const scored = offered
        .map((product) => {
        const nameTokens = offerContentTokens(product.name);
        const covered = said.filter((t) => nameTokens.some((n) => n === t || (t.length >= 5 && n.length >= 5 && offerEditDistance(t, n) <= 1)));
        const extra = nameTokens.filter((n) => !said.some((t) => t === n || (t.length >= 5 && n.length >= 5 && offerEditDistance(t, n) <= 1)));
        return {
            product,
            covered: covered.length,
            extra: extra.length,
        };
    })
        .filter((row) => row.covered === said.length);
    if (!scored.length)
        return null;
    scored.sort((a, b) => a.extra - b.extra || b.covered - a.covered);
    if (scored.length > 1 && scored[0].extra === scored[1].extra)
        return null;
    return { id: scored[0].product.id, name: scored[0].product.name };
}
function resolvePendingListOrMenuCode(opts) {
    const { bareNum, candidates } = opts;
    if (bareNum == null || !candidates.length)
        return null;
    const codeHit = candidates.find((c) => Number(c.code) === bareNum);
    if (bareNum >= 1 && bareNum <= candidates.length) {
        return 'list_index';
    }
    if (codeHit || bareNum > candidates.length)
        return 'menu_code';
    return null;
}
//# sourceMappingURL=whatsapp-session-intents.js.map