"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.interpretProductNote = interpretProductNote;
const whatsapp_local_glossary_1 = require("./whatsapp-local-glossary");
const normalize = (text) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
function interpretProductNote(source, products) {
    const prepared = (0, whatsapp_local_glossary_1.applyLocalGlossary)(source);
    const normalized = normalize(prepared);
    for (const product of [...products].sort((a, b) => b.name.length - a.name.length)) {
        const name = normalize(product.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
        const match = new RegExp(`\\b${name}\\b`, 'i').exec(normalized);
        if (!match)
            continue;
        const tail = normalized.slice(match.index + match[0].length).trim()
            .replace(/\s+(?:por favor|porfa|gracias)[.!]*$/, '').replace(/[.!]+$/, '').trim();
        const descriptor = '(?:dorad[oa]s?|delgad[oa]s?|grues[oa]s?|picad[oa]s?|tajad[oa]s?|crocantes?|crujientes?)';
        if (new RegExp(`^(?:(?:bien|muy)\\s+)?${descriptor}(?:\\s+(?:y\\s+)?(?:(?:bien|muy)\\s+)?${descriptor})*$`).test(tail)) {
            return { productId: product.id, productText: prepared.slice(0, match.index + match[0].length).trim(), note: tail };
        }
        if (!/^(?:con\s+(?:harto|arto|mucho|mucha|bastante|extra|poco|poca)\s+\p{L}|con\s+aji\b)/u.test(tail))
            continue;
        if (tail.length > 180 || /[?¿;,]|\b(?:y|agrega|quiero|dame|si|cambia|por)\b/.test(tail))
            continue;
        const note = tail.replace(/\barto\b/g, 'harto').replace(/\bahi\b/g, 'ají').replace(/\baji\b/g, 'ají');
        return { productId: product.id, productText: prepared.slice(0, match.index + match[0].length).trim(), note };
    }
    return null;
}
//# sourceMappingURL=whatsapp-product-intent.js.map