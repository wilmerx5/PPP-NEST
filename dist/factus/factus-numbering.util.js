"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pickCreditNoteRangeId = pickCreditNoteRangeId;
exports.pickBillRangeId = pickBillRangeId;
const common_1 = require("@nestjs/common");
const NC_PREFIX_RE = /^(NC|CRTE|NCE|NCV|NCP)/i;
const NC_DOCUMENT_CODES = new Set(['91', '04', '20']);
function pickCreditNoteRangeId(ranges, billRangeId) {
    const active = ranges.filter((r) => r.is_active !== false);
    if (!active.length) {
        throw new common_1.BadRequestException('No hay rangos de numeración activos en Factus. Configura la resolución en el panel Factus.');
    }
    let candidates = active;
    if (billRangeId && Number.isFinite(billRangeId)) {
        candidates = candidates.filter((r) => r.id !== billRangeId);
    }
    const byPrefix = candidates.filter((r) => r.prefix && NC_PREFIX_RE.test(r.prefix.trim()));
    if (byPrefix.length === 1)
        return byPrefix[0].id;
    if (byPrefix.length > 1) {
        throw new common_1.BadRequestException(`Hay varios rangos de nota crédito en Factus (${byPrefix.map((r) => `${r.id}:${r.prefix}`).join(', ')}). ` +
            'Define FACTUS_CREDIT_NOTE_RANGE_ID en el servidor.');
    }
    const byDocName = candidates.filter((r) => r.document && /nota\s*cr[eé]dito/i.test(String(r.document)));
    if (byDocName.length === 1)
        return byDocName[0].id;
    const byDoc = candidates.filter((r) => r.document && NC_DOCUMENT_CODES.has(String(r.document).trim()));
    if (byDoc.length === 1)
        return byDoc[0].id;
    if (candidates.length === 1)
        return candidates[0].id;
    if (candidates.length === 0 && active.length === 1) {
        throw new common_1.BadRequestException('Solo hay un rango de numeración (facturas). Falta el rango de nota crédito en Factus/DIAN para poder anular.');
    }
    throw new common_1.BadRequestException(`No se pudo detectar el rango de nota crédito automáticamente. Rangos disponibles: ${active
        .map((r) => `${r.id} (${r.prefix || 'sin prefijo'}, doc ${r.document || '?'})`)
        .join('; ')}. Define FACTUS_CREDIT_NOTE_RANGE_ID.`);
}
function pickBillRangeId(ranges) {
    const active = ranges.filter((r) => r.is_active !== false);
    const byDocName = active.filter((r) => r.document && /factura\s*de\s*venta/i.test(String(r.document)));
    if (byDocName.length === 1)
        return byDocName[0].id;
    if (active.length === 1)
        return active[0].id;
    const bills = active.filter((r) => !r.prefix || !NC_PREFIX_RE.test(r.prefix.trim()));
    const saleBills = bills.filter((r) => !r.document || !/nota/i.test(String(r.document)));
    if (saleBills.length === 1)
        return saleBills[0].id;
    if (bills.length === 1)
        return bills[0].id;
    return undefined;
}
//# sourceMappingURL=factus-numbering.util.js.map