"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateCartLimits = evaluateCartLimits;
exports.buildOrderLimitsPromptBlock = buildOrderLimitsPromptBlock;
exports.unitsForProduct = unitsForProduct;
exports.cartSubtotal = cartSubtotal;
exports.totalUnits = totalUnits;
function cartSubtotal(cart) {
    return cart.reduce((s, c) => s + c.unitPrice * Math.max(1, c.quantity || 1), 0);
}
function totalUnits(cart) {
    return cart.reduce((s, c) => s + Math.max(1, c.quantity || 1), 0);
}
function unitsForProduct(cart, productId) {
    return cart
        .filter((c) => c.productId === productId)
        .reduce((s, c) => s + Math.max(1, c.quantity || 1), 0);
}
function evaluateCartLimits(cart, cfg, opts) {
    const fee = opts?.orderType === 'delivery' ? Math.max(0, Number(cfg.defaultDeliveryFee) || 0) : 0;
    const subtotal = cartSubtotal(cart);
    const total = subtotal + fee;
    const units = totalUnits(cart);
    const lines = cart.length;
    if (cfg.maxCartLines > 0 && lines > cfg.maxCartLines) {
        return {
            ok: false,
            handoff: true,
            kind: 'max_lines',
            reason: `Por WhatsApp manejamos hasta ${cfg.maxCartLines} ítems. Si necesitas más, te paso con el equipo.`,
        };
    }
    if (cfg.maxTotalUnits > 0 && units > cfg.maxTotalUnits) {
        return {
            ok: false,
            handoff: true,
            kind: 'max_total_units',
            reason: `Por WhatsApp el tope es ${cfg.maxTotalUnits} unidades en total. Si es un pedido grande, te paso con alguien del local.`,
        };
    }
    if (cfg.maxUnitsPerItem > 0) {
        const byId = new Map();
        for (const c of cart) {
            const id = c.productId;
            byId.set(id, (byId.get(id) || 0) + Math.max(1, c.quantity || 1));
        }
        for (const [id, n] of byId) {
            if (n > cfg.maxUnitsPerItem) {
                const name = cart.find((c) => c.productId === id)?.name || 'ese producto';
                return {
                    ok: false,
                    handoff: true,
                    kind: 'max_units_item',
                    reason: `Por WhatsApp el máximo de *${name}* es ${cfg.maxUnitsPerItem} unidades. Si necesitas más, te paso con el equipo.`,
                };
            }
        }
    }
    if (cfg.maxOrderAmount > 0 && total > cfg.maxOrderAmount) {
        return {
            ok: false,
            handoff: true,
            kind: 'max_amount',
            reason: `Por WhatsApp el pedido máximo es $${cfg.maxOrderAmount.toLocaleString('es-CO')} COP. Si es un pedido grande, te paso con alguien del local.`,
        };
    }
    if (opts?.checkMin && cfg.minOrderAmount > 0 && subtotal < cfg.minOrderAmount) {
        return {
            ok: false,
            handoff: false,
            kind: 'min',
            reason: `El pedido mínimo es $${cfg.minOrderAmount.toLocaleString('es-CO')} COP (ahora llevas $${subtotal.toLocaleString('es-CO')}). ¿Agregamos algo más?`,
        };
    }
    return { ok: true };
}
function buildOrderLimitsPromptBlock(cfg) {
    const lines = [];
    if (cfg.minOrderAmount > 0) {
        lines.push(`Pedido mínimo (subtotal productos): $${cfg.minOrderAmount.toLocaleString('es-CO')} COP.`);
    }
    if (cfg.maxOrderAmount > 0) {
        lines.push(`Pedido máximo por WhatsApp: $${cfg.maxOrderAmount.toLocaleString('es-CO')} COP (incluye domicilio si aplica). Si el cliente quiere más → sugiere *humano*; no confirmes.`);
    }
    if (cfg.maxUnitsPerItem > 0) {
        lines.push(`Máx. unidades del mismo producto: ${cfg.maxUnitsPerItem}.`);
    }
    if (cfg.maxTotalUnits > 0) {
        lines.push(`Máx. unidades totales en el carrito: ${cfg.maxTotalUnits}.`);
    }
    if (cfg.maxCartLines > 0) {
        lines.push(`Máx. ítems/líneas en el carrito: ${cfg.maxCartLines}.`);
    }
    if (!lines.length)
        return '';
    return (`LÍMITES DE PEDIDO (el sistema los valida; no los ignores):\n` +
        lines.map((l) => `- ${l}`).join('\n') +
        (cfg.handoffWhenMaxExceeded
            ? `\n- Si el cliente insiste en superar un tope: requestHuman true.`
            : `\n- Si supera un tope: explica el límite y sugiere reducir el pedido.`));
}
//# sourceMappingURL=whatsapp-cart-limits.js.map