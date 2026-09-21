"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WHATSAPP_INBOUND_COALESCE_MAX = exports.WHATSAPP_INBOUND_COALESCE_QUICK_MS = exports.WHATSAPP_INBOUND_COALESCE_MS = void 0;
exports.isCoalesceableInboundMessage = isCoalesceableInboundMessage;
exports.isQuickCoalesceText = isQuickCoalesceText;
exports.coalesceDelayMsForText = coalesceDelayMsForText;
exports.coalesceDelayMsForBatch = coalesceDelayMsForBatch;
exports.mergeCoalescedInboundMessages = mergeCoalescedInboundMessages;
exports.WHATSAPP_INBOUND_COALESCE_MS = 3000;
exports.WHATSAPP_INBOUND_COALESCE_QUICK_MS = 900;
exports.WHATSAPP_INBOUND_COALESCE_MAX = 8;
function isCoalesceableInboundMessage(msg) {
    if (msg.messageType !== 'text')
        return false;
    if (msg.mediaId)
        return false;
    return Boolean((msg.text || '').trim());
}
function isQuickCoalesceText(text) {
    const t = (text || '').trim();
    if (!t)
        return false;
    return /^(confirmar|confirma|confirm|listo|ok|okay|si|sí|no|reinicia|reiniciar|reinicio|reset|asesor|\d{1,2})$/i.test(t);
}
function coalesceDelayMsForText(text) {
    if (isQuickCoalesceText(text))
        return exports.WHATSAPP_INBOUND_COALESCE_QUICK_MS;
    return exports.WHATSAPP_INBOUND_COALESCE_MS;
}
function coalesceDelayMsForBatch(messages) {
    if (!messages.length)
        return exports.WHATSAPP_INBOUND_COALESCE_MS;
    return Math.max(...messages.map((m) => coalesceDelayMsForText(m.text || '')));
}
function mergeCoalescedInboundMessages(messages) {
    if (messages.length === 0) {
        throw new Error('mergeCoalescedInboundMessages: empty batch');
    }
    if (messages.length === 1)
        return messages[0];
    const texts = messages
        .map((m) => (m.text || '').trim())
        .filter(Boolean);
    const uniqueOrdered = [];
    for (const t of texts) {
        if (uniqueOrdered[uniqueOrdered.length - 1] === t)
            continue;
        uniqueOrdered.push(t);
    }
    const first = messages[0];
    const last = messages[messages.length - 1];
    return {
        ...first,
        messageId: first.messageId || last.messageId,
        text: uniqueOrdered.join('\n'),
        timestamp: last.timestamp || first.timestamp,
        raw: {
            ...first.raw,
            coalescedFrom: messages.map((m) => m.messageId).filter(Boolean),
            coalescedCount: messages.length,
        },
    };
}
//# sourceMappingURL=whatsapp-inbound-coalesce.js.map