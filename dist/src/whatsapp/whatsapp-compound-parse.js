"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.splitTrailingEmbeddedAddress = splitTrailingEmbeddedAddress;
exports.stripTrailingAddressFluff = stripTrailingAddressFluff;
const whatsapp_intent_1 = require("./whatsapp-intent");
const STREET_START_RE = /\b(?:calle|cll|carrera|cra|av\.?|avenida|diag(?:onal)?|dg|transversal|tv)\b/i;
const ADDR_TAIL_HINT_RE = /\b(?:torre|apto|apartamento|interior|int\.?|casa|porter[ií]a|bloque|etapa)\b/i;
function splitTrailingEmbeddedAddress(text) {
    const raw = (text || '').replace(/\s+/g, ' ').trim();
    if (raw.length < 12)
        return null;
    const esPara = raw.match(/^(.{3,}?)\s+(?:es\s+para|seria\s+para|ser[ií]a\s+para|para\s+la\s+direcci[oó]n)\s+(.+)$/i);
    if (esPara?.[1] && esPara[2] && esPara[2].trim().length >= 6) {
        const head = esPara[1].replace(/[.,;:\s]+$/g, '').trim();
        const addr = stripTrailingAddressFluff(esPara[2].trim());
        if (head.length >= 3 && looksLikeEmbeddedAddress(addr)) {
            return { productText: head, address: addr };
        }
    }
    const paraPlace = raw.match(/^(.{8,}?)\s+[Pp]ara\s+(?:la|el|los|las)\s+(?!llevar|recoger|el\s+local)(.+)$/);
    if (paraPlace?.[1] && paraPlace[2] && paraPlace[2].trim().length >= 6) {
        const head = paraPlace[1].replace(/[.,;:\s]+$/g, '').trim();
        const addr = stripTrailingAddressFluff(paraPlace[2].trim());
        if (head.length >= 8 &&
            looksLikeEmbeddedAddress(addr) &&
            /\b(pollo|arroz|sopa|combo|bandeja|ejecutivo|churrasco|costilla|sobrebarriga|hamburguesa|ajiaco|mondongo|pechuga|alitas?|mojarra|gaseosa|jugo|maduro|arepa|domicilio|regala(?:me|s)?|envia(?:me)?|manda(?:me)?|quiero|dame|pedi|pido|vende|vendes|trucha|bagre|pescado)\b/i.test(head)) {
            return { productText: head, address: addr };
        }
    }
    const casaIdx = lastMatchIndex(raw, /\bcasa\s*\d{1,4}[a-z]?\b/i);
    const complexIdx = lastMatchIndex(raw, /\b(?:terrazas?|bosques?|tierras?|villas?|parques?|brisas?|alamedas?|jardines?|ciudadelas?|portales?)\s+(?:de|del|de\s+la)\b/i);
    const streetIdx = lastMatchIndex(raw, STREET_START_RE);
    const zoneIdx = lastMatchIndex(raw, whatsapp_intent_1.PPP_ZONE_LANDMARK_RE);
    let cut = -1;
    const addrStarts = [casaIdx, complexIdx, streetIdx].filter((i) => i >= 0);
    if (addrStarts.length) {
        cut = Math.min(...addrStarts);
    }
    else if (zoneIdx >= 0) {
        cut = zoneIdx;
    }
    if (cut < 8)
        return null;
    const head = raw.slice(0, cut).replace(/[.,;:\s]+$/g, '').trim();
    const addr = stripTrailingAddressFluff(raw.slice(cut).trim());
    if (head.length < 3 || addr.length < 6)
        return null;
    if (!looksLikeEmbeddedAddress(addr))
        return null;
    if (!/\b(pollo|arroz|sopa|combo|bandeja|ejecutivo|churrasco|costilla|sobrebarriga|hamburguesa|ajiaco|mondongo|pechuga|alitas?|mojarra|gaseosa|jugo|maduro|arepa|domicilio|regala(?:me|s)?|envia(?:me)?|manda(?:me)?|quiero|dame|pedi|pido|vende|vendes|trucha|bagre|pescado)\b/i.test(head)) {
        return null;
    }
    return { productText: head, address: addr };
}
function stripTrailingAddressFluff(addr) {
    let t = (addr || '').trim();
    if (!t)
        return t;
    t = t
        .replace(/[,.]?\s*(?:si\s+es\s+tan\s+(?:gentil|amable|kind)|si\s+me\s+(?:haces|hace)\s+el\s+favor).*$/i, '')
        .replace(/[,.]?\s*(?:y\s+)?(?:me\s+)?(?:regala(?:s|me)?|dice(?:s|me)?|pasa(?:s|me)?|confirma(?:s|me)?)\s+(?:el\s+)?(?:costo|precio|valor|total|domicilio).*$/i, '')
        .replace(/[,.]?\s*(?:por\s+favor|porfa|pf|gracias)[\s!.?]*$/i, '')
        .replace(/[,.]?\s*(?:y\s+)?(?:me\s+regala(?:s|me)?\s+el\s+costo).*$/i, '')
        .replace(/[,\s]+$/g, '')
        .trim();
    return t;
}
function lastMatchIndex(text, re) {
    const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`;
    const global = new RegExp(re.source, flags);
    let last = -1;
    let m;
    while ((m = global.exec(text)) !== null)
        last = m.index;
    return last;
}
function looksLikeEmbeddedAddress(addr) {
    const a = addr.trim();
    if (a.length < 6 || a.length > 160)
        return false;
    if (STREET_START_RE.test(a) && /\d/.test(a))
        return true;
    if (whatsapp_intent_1.PPP_ZONE_LANDMARK_RE.test(a) && (ADDR_TAIL_HINT_RE.test(a) || /\d/.test(a) || a.split(/\s+/).length >= 2)) {
        return true;
    }
    if (ADDR_TAIL_HINT_RE.test(a) && /\d/.test(a) && a.split(/\s+/).length >= 2)
        return true;
    return false;
}
//# sourceMappingURL=whatsapp-compound-parse.js.map