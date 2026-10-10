"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseScopedCartNote = parseScopedCartNote;
exports.notePartMatches = notePartMatches;
exports.editScopedCartNote = editScopedCartNote;
const whatsapp_quantity_correction_1 = require("./whatsapp-quantity-correction");
const clean = (text) => text.trim().replace(/[.!]+$/, '').replace(/\s+(?:por favor|porfa|gracias)$/i, '').trim();
function parseScopedCartNote(text) {
    if (!text.trim() || text.length > 350 || /[¿?;]/.test(text))
        return null;
    const t = clean(text);
    const removal = t.match(/^quita\s+(?:(?:solo|solamente)\s+)?la\s+nota\s+(?:de\s+)?(.+?)\s+de\s+(.+?)(?:\s+y\s+conserva\s+(.+))?$/i);
    if (removal) {
        if (/\b(?:agrega|cambia|reemplaza|quita|y)\b/.test((0, whatsapp_quantity_correction_1.normalizeCorrection)(removal[2])))
            return null;
        return { kind: 'remove', note: removal[1], query: removal[2], preserve: removal[3] ? [removal[3]] : [] };
    }
    const addition = t.match(/^(?:a\s+(?:el|la|los|las)|al|para\s+(?:el|la|los|las))\s+(.+?)\s+(?:ponles?|an[oó]tales?|a[nñ][aá]deles?|agr[eé]gales?)\s+(?:(?:tambi[eé]n|adem[aá]s)\s+)?(?:(?:la\s+nota|como\s+nota)\s+)?(.+)$/i);
    if (!addition)
        return null;
    const note = clean(addition[2]);
    const norm = (0, whatsapp_quantity_correction_1.normalizeCorrection)(note);
    if (/\b(?:agrega|cambia|reemplaza|quita|cuanto|precio|cantidad|pago|domicilio|y|dos|tres|cuatro|cinco)\b/.test(norm))
        return null;
    if (!/\b(?:sin|aparte|separad[oa]s?|crocantes?|crujientes?|dorad[oa]s?|cocid[oa]s?|bolsa|empaque)\b/.test(norm))
        return null;
    if (/\b(?:y|una?|dos|tres|cuatro|cinco)\b/.test((0, whatsapp_quantity_correction_1.normalizeCorrection)(addition[1])))
        return null;
    return { kind: 'append', query: addition[1], note, preserve: [] };
}
const noteTokens = (text) => (0, whatsapp_quantity_correction_1.normalizeCorrection)(text).split(' ').filter(w => !['bien', 'muy'].includes(w));
function notePartMatches(part, query) {
    const have = noteTokens(part), wanted = noteTokens(query);
    return wanted.length > 0 && have.length === wanted.length && wanted.every((word, index) => word === have[index]);
}
function editScopedCartNote(existing, edit) {
    const parts = (existing || '').split(/[;.]+/).map(part => part.trim()).filter(Boolean);
    if (edit.kind === 'append') {
        if (!parts.some(part => notePartMatches(part, edit.note)))
            parts.push(edit.note);
        const combined = parts.join('; ');
        return combined.length > 200 ? { note: existing, blocked: true } : { note: combined || undefined };
    }
    const remaining = parts.filter(part => !notePartMatches(part, edit.note));
    const next = remaining.join('; ') || undefined;
    if (edit.preserve.some(query => !remaining.some(part => notePartMatches(part, query))))
        return { note: existing, blocked: true };
    if (remaining.length === parts.length && parts.some(part => (0, whatsapp_quantity_correction_1.normalizeCorrection)(part).includes((0, whatsapp_quantity_correction_1.normalizeCorrection)(edit.note))))
        return { note: existing, blocked: true };
    return { note: next };
}
//# sourceMappingURL=whatsapp-cart-note.js.map