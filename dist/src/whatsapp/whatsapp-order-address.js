"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.composeWhatsappOrderAddress = composeWhatsappOrderAddress;
const whatsapp_payment_methods_1 = require("./whatsapp-payment-methods");
function composeWhatsappOrderAddress(session, paymentMethods = []) {
    const base = (session.address || '').trim();
    const parts = [];
    if (session.paymentMethod?.trim()) {
        parts.push((0, whatsapp_payment_methods_1.paymentMethodLabel)(session.paymentMethod, paymentMethods).trim());
    }
    if (session.cashChangeFor?.trim()) {
        parts.push(session.cashChangeFor.trim());
    }
    if (session.customerNotes?.trim()) {
        parts.push(session.customerNotes.trim());
    }
    if (!parts.length)
        return base;
    const suffix = parts.join(' / ');
    if (!base)
        return suffix.slice(0, 500);
    const lower = base.toLowerCase();
    if (parts.every((p) => lower.includes(p.toLowerCase()))) {
        return base.slice(0, 500);
    }
    return `${base} / ${suffix}`.slice(0, 500);
}
//# sourceMappingURL=whatsapp-order-address.js.map