"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_DELIVERY_FEE_TIERS = void 0;
exports.normalizeDeliveryFeeTiers = normalizeDeliveryFeeTiers;
exports.feeFromDistanceKm = feeFromDistanceKm;
exports.formatDeliveryFeeTiersForPrompt = formatDeliveryFeeTiersForPrompt;
exports.DEFAULT_DELIVERY_FEE_TIERS = [
    { maxKm: 2.5, fee: 2000 },
    { maxKm: 3.5, fee: 5000 },
    { maxKm: 5.5, fee: 6000 },
];
function normalizeDeliveryFeeTiers(raw) {
    if (!Array.isArray(raw) || !raw.length)
        return [...exports.DEFAULT_DELIVERY_FEE_TIERS];
    const tiers = [];
    for (const row of raw) {
        if (!row || typeof row !== 'object')
            continue;
        const maxKm = Number(row.maxKm);
        const fee = Number(row.fee);
        if (!Number.isFinite(maxKm) || maxKm <= 0)
            continue;
        if (!Number.isFinite(fee) || fee < 0)
            continue;
        tiers.push({ maxKm, fee: Math.round(fee) });
    }
    if (!tiers.length)
        return [...exports.DEFAULT_DELIVERY_FEE_TIERS];
    return tiers.sort((a, b) => a.maxKm - b.maxKm);
}
function feeFromDistanceKm(distanceKm, tiers, maxKm) {
    const km = Math.max(0, Number(distanceKm) || 0);
    const cap = Number.isFinite(maxKm) && maxKm > 0 ? maxKm : tiers[tiers.length - 1]?.maxKm || 5.5;
    if (km > cap + 1e-6)
        return { outOfCoverage: true };
    const sorted = [...tiers].sort((a, b) => a.maxKm - b.maxKm);
    for (const t of sorted) {
        if (km <= t.maxKm + 1e-6)
            return { fee: t.fee };
    }
    return { outOfCoverage: true };
}
function formatDeliveryFeeTiersForPrompt(tiers, maxKm) {
    const sorted = [...tiers].sort((a, b) => a.maxKm - b.maxKm);
    let prev = 0;
    const lines = sorted.map((t) => {
        const from = prev;
        const line = `  • ${from}–${t.maxKm} km → $${t.fee.toLocaleString('es-CO')}`;
        prev = t.maxKm;
        return line;
    });
    return (`Tarifas de domicilio por ruta (hasta ${maxKm} km):\n` +
        lines.join('\n') +
        `\n  • > ${maxKm} km → fuera de cobertura`);
}
//# sourceMappingURL=whatsapp-delivery-fee.js.map