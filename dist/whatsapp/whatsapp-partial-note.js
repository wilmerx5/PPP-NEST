"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePartialNote = parsePartialNote;
const whatsapp_quantity_correction_1 = require("./whatsapp-quantity-correction");
const counts = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 };
const count = (word) => counts[word] || (/^\d{1,2}$/.test(word) ? Number(word) : 0);
function parsePartialNote(text) {
    if (/[¿?;]/.test(text) || text.length > 250)
        return null;
    const normalized = (0, whatsapp_quantity_correction_1.normalizeCorrection)(text).replace(/[.!]+$/, '').trim();
    const match = normalized.match(/^(\w+)\s+(sin\s+.+?)\s+y\s+(?:los|las)\s+(?:(?:otros|otras)\s+(\w+)|(?:demas|resto))\s+normales?$/);
    if (!match || match[2].length > 200 || /\b(?:agrega|quita|cambia|reemplaza|pero|si)\b/.test(match[2]))
        return null;
    const quantity = count(match[1]);
    const remainder = match[3] ? count(match[3]) : undefined;
    if (!quantity || (match[3] && !remainder))
        return null;
    return { quantity, note: match[2], remainder };
}
//# sourceMappingURL=whatsapp-partial-note.js.map