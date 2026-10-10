"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WEB_DELIVERY_DEFAULT_FEE = exports.WEB_DELIVERY_MAX_KM = exports.WEB_DELIVERY_FEE_TIERS = void 0;
exports.formatWebDeliveryTiersHint = formatWebDeliveryTiersHint;
exports.formatWebDeliveryTiersHintDefault = formatWebDeliveryTiersHintDefault;
exports.WEB_DELIVERY_FEE_TIERS = [
    { maxKm: 4, fee: 4000 },
    { maxKm: 6, fee: 6000 },
];
exports.WEB_DELIVERY_MAX_KM = 6;
exports.WEB_DELIVERY_DEFAULT_FEE = 4000;
function formatWebDeliveryTiersHint(tiers, maxKm) {
    const sorted = [...tiers].sort((a, b) => a.maxKm - b.maxKm);
    if (!sorted.length) {
        return `Domicilio según distancia (máx. ${maxKm} km)`;
    }
    const parts = [];
    let prev = 0;
    for (const t of sorted) {
        if (prev === 0) {
            parts.push(`Hasta ${t.maxKm} km: $${t.fee.toLocaleString('es-CO')}`);
        }
        else {
            parts.push(`Más de ${prev} km: $${t.fee.toLocaleString('es-CO')}`);
        }
        prev = t.maxKm;
    }
    return `${parts.join(' · ')} (máx. ${maxKm} km)`;
}
function formatWebDeliveryTiersHintDefault() {
    return formatWebDeliveryTiersHint(exports.WEB_DELIVERY_FEE_TIERS, exports.WEB_DELIVERY_MAX_KM);
}
//# sourceMappingURL=web-delivery-fee.js.map