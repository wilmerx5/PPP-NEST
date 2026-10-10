"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveCartLineIndex = resolveCartLineIndex;
exports.applyCartLineEdits = applyCartLineEdits;
function resolveCartLineIndex(cart, productId, index) {
    if (index !== undefined) {
        return typeof index === 'number' && Number.isInteger(index) && index >= 0 &&
            cart[index]?.productId === productId ? index : -1;
    }
    const indexes = cart.flatMap((line, i) => line.productId === productId ? [i] : []);
    return indexes.length === 1 ? indexes[0] : -1;
}
function applyCartLineEdits(cart, actions) {
    const edited = cart.map(line => ({ ...line, attributes: line.attributes?.map(a => ({ ...a })) }));
    for (const update of actions.updateAttributes || []) {
        const index = resolveCartLineIndex(cart, update.productId, update.cartLineIndex);
        if (index < 0)
            continue;
        const attributes = edited[index].attributes || [];
        const old = attributes.findIndex(a => a.attributeName.toLowerCase() === update.attributeName.toLowerCase());
        const value = { attributeName: update.attributeName, attributeValue: update.attributeValue };
        if (old < 0)
            attributes.push(value);
        else
            attributes[old] = value;
        edited[index].attributes = attributes;
    }
    for (const update of actions.updateCartLines || []) {
        const index = resolveCartLineIndex(cart, update.productId, update.cartLineIndex);
        if (index < 0)
            continue;
        if (update.quantity !== undefined && Number.isInteger(update.quantity) && update.quantity >= 1 && update.quantity <= 10) {
            edited[index].quantity = update.quantity;
        }
        if (typeof update.note === 'string')
            edited[index].note = update.note.trim().slice(0, 200) || undefined;
    }
    const removed = new Set((actions.removeCartLines || []).map(remove => resolveCartLineIndex(cart, remove.productId, remove.cartLineIndex)).filter(i => i >= 0));
    return edited.filter((_, i) => !removed.has(i));
}
//# sourceMappingURL=whatsapp-cart-edits.js.map