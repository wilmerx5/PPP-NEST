"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isKeepCartRefusal = isKeepCartRefusal;
exports.parseScopedCartRemoval = parseScopedCartRemoval;
exports.preservedRemovalConflict = preservedRemovalConflict;
const whatsapp_quantity_correction_1 = require("./whatsapp-quantity-correction");
function isKeepCartRefusal(text) {
    const t = (0, whatsapp_quantity_correction_1.normalizeCorrection)(text);
    if (!t || t.length > 80)
        return false;
    return /^(?:no quiero que (?:me )?(?:lo|la|los|las) quites|no (?:me )?(?:lo|la|los|las) quites|no quites nada|no quiero que quites nada)$/.test(t);
}
function parseScopedCartRemoval(text) {
    if (!text.trim() || text.length > 350 || /[¿?]/.test(text))
        return null;
    const clauses = text.trim().replace(/[.!]+$/, '').split(/\s*;\s*|\s*,\s*(?=(?:conserva|deja|mant[eé]n|no quites|(?:el|la|los|las)\b.*\b(?:dejo|conservo|mantengo))\b)|\s+y\s+(?=(?:conserva|deja|mant[eé]n|no quites|(?:el|la|los|las)\b.*\b(?:dejo|conservo|mantengo))\b)/i);
    const match = clauses.shift()?.match(/^(?:quita(?:me|r)?|saca(?:me|r)?|elimina(?:me|r)?|retira(?:me|r)?|borra(?:me|r)?)\s+(?:solamente\s+|solo\s+)?(.+)$/i);
    if (!match)
        return null;
    const partial = match[1].match(/^(?:uno|una|un|1)\s+de\s+(?:los|las|el|la)\s+(.+)$/i);
    const query = (partial?.[1] || match[1]).replace(/\s+(?:por favor|porfa|gracias)$/i, '').replace(/\s+(?:del carrito|de mi pedido|del pedido)$/i, '').trim();
    const normalized = (0, whatsapp_quantity_correction_1.normalizeCorrection)(query);
    if (!normalized || query.includes(',') || /\b(?:y|nota|notas|observacion|observaciones|atributo|opcion|sin|no|solo|solamente|todo|carrito|pedido|agrega|pon|cambia|reemplaza|mejor|por)\b/.test(normalized))
        return null;
    const preserve = [];
    for (const clause of clauses) {
        const keep = clause.match(/^(?:conserva|deja|mant[eé]n|no quites)\s+(.+)$/i) ||
            clause.match(/^((?:el|la|los|las)\s+.+?)\s+(?:s[ií]\s+)?(?:lo|la|los|las)\s+(?:dejo|conservo|mantengo)$/i);
        if (!keep)
            return null;
        if (/\b(?:agrega|anade|pon|cambia|reemplaza|quita|elimina|retira|borra)\b/.test((0, whatsapp_quantity_correction_1.normalizeCorrection)(keep[1])))
            return null;
        preserve.push(...keep[1].replace(/\s+(?:igual|como est[aá]n|por favor|porfa)$/i, '').split(/\s*,\s*|\s+y\s+/i));
    }
    return { query, preserve, ...(partial ? { quantity: 1 } : {}) };
}
function preservedRemovalConflict(line, preserve) {
    return preserve.some(query => (0, whatsapp_quantity_correction_1.correctionMatchesLine)(line, query));
}
//# sourceMappingURL=whatsapp-cart-removal.js.map