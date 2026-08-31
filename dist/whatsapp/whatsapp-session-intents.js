"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAddressChangeIntent = isAddressChangeIntent;
exports.isAddressRejectionIntent = isAddressRejectionIntent;
exports.isAddressClarificationIntent = isAddressClarificationIntent;
exports.isPostOrderFollowUpIntent = isPostOrderFollowUpIntent;
exports.isReuseLastAddressIntent = isReuseLastAddressIntent;
exports.isConfirmCurrentAddressIntent = isConfirmCurrentAddressIntent;
exports.isUsableWhatsappCustomerName = isUsableWhatsappCustomerName;
exports.isDeliveryEtaInquiry = isDeliveryEtaInquiry;
exports.isDeliveryCoverageInquiry = isDeliveryCoverageInquiry;
exports.extractCoverageAddressProbe = extractCoverageAddressProbe;
exports.isAbandonPendingSelectionIntent = isAbandonPendingSelectionIntent;
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
function isReuseLastAddressIntent(text) {
    const t = (text || '').trim().toLowerCase();
    if (!t || t.length > 40)
        return false;
    if (/^(si|sí|sep|ok|okay|dale|listo|correcto|exacto|esa|esa misma|confirmo)([\s!.?]*|(\s+por\s+fa(vor|fa)?[\s!.?]*))$/i.test(t)) {
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
    ]);
    if (blockedExact.has(t))
        return false;
    if (/^(pronto\s+pollo(\s+portal)?|ppp\s+pedidos?)$/.test(t))
        return false;
    if (/^pedidos?\b/.test(t) && t.split(' ').length <= 2)
        return false;
    return true;
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
function isDeliveryCoverageInquiry(text) {
    const raw = (text || '').trim();
    if (raw.length < 12)
        return false;
    const orderingFood = /\b(quiero|dame|ponme|regala|pedi|pido|agrega|ordenar|un\s+pollo|una\s+sopa|combo\s+de|ejecutivo|arroz\s+con)\b/i.test(raw);
    if (orderingFood)
        return false;
    if (/\b(domicilios?|entregas?)\s+(para|a|en|hasta)\b/i.test(raw))
        return true;
    if (/\b(tienen|hacen|hay|cubren|cubre|llegan|llega)\b/i.test(raw) &&
        /\b(domicilios?|entregas?|env[ií]os?)\b/i.test(raw) &&
        /\b(para|a|en|hasta|por)\b/i.test(raw)) {
        return true;
    }
    if (/\b(hacen|tienen)\s+(servicio\s+a\s+)?domicilio\b/i.test(raw) &&
        /\b(para|a|en|hasta)\b/i.test(raw)) {
        return true;
    }
    return false;
}
function extractCoverageAddressProbe(text) {
    const raw = (text || '').trim();
    if (!raw)
        return null;
    const patterns = [
        /\b(?:domicilios?|entregas?|env[ií]os?|servicio\s+a\s+domicilio)\s+(?:para|a|en|hasta)\s+(.+?)[\s?!.]*$/i,
        /\b(?:para|a|en|hasta)\s+((?:calle|carrera|cra|cll|dg|diagonal|av\.?|avenida|conjunto|torre|barrio)\b.+?)[\s?!.]*$/i,
        /\b(?:para|a|en|hasta)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9].{5,90})[\s?!.]*$/i,
    ];
    for (const re of patterns) {
        const m = raw.match(re);
        if (m?.[1]) {
            const addr = m[1]
                .replace(/\b(por\s+favor|porfa|gracias|ok|vale)\b/gi, '')
                .replace(/[?!.]+$/g, '')
                .replace(/\s+/g, ' ')
                .trim();
            if (addr.length >= 6)
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
function resolvePendingListOrMenuCode(opts) {
    const { bareNum, candidates } = opts;
    if (bareNum == null || !candidates.length)
        return null;
    const codeHit = candidates.find((c) => Number(c.code) === bareNum);
    if (bareNum >= 1 && bareNum <= candidates.length) {
        const row = candidates[bareNum - 1];
        if (codeHit && row.id !== codeHit.id)
            return 'menu_code';
        return 'list_index';
    }
    if (codeHit || bareNum > candidates.length)
        return 'menu_code';
    return null;
}
//# sourceMappingURL=whatsapp-session-intents.js.map