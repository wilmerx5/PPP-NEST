"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PAYMENT_METHODS = void 0;
exports.sanitizePaymentMethodsInput = sanitizePaymentMethodsInput;
exports.resolvePaymentMethods = resolvePaymentMethods;
exports.getEnabledPaymentMethods = getEnabledPaymentMethods;
exports.findPaymentMethodByText = findPaymentMethodByText;
exports.isPaymentCapabilityQuestion = isPaymentCapabilityQuestion;
exports.buildPaymentOptionsPrompt = buildPaymentOptionsPrompt;
exports.paymentMethodLabel = paymentMethodLabel;
exports.applyPaymentReplyTemplate = applyPaymentReplyTemplate;
exports.DEFAULT_PAYMENT_METHODS = [
    {
        id: 'cash',
        enabled: true,
        label: 'Contraentrega',
        keywords: ['contraentrega', 'contra entrega', 'efectivo', 'cash', 'en efectivo'],
        optionText: '*contraentrega* (efectivo al recibir)',
        confirmReply: '',
        flow: 'immediate',
    },
    {
        id: 'transfer',
        enabled: true,
        label: 'Transferencia',
        keywords: ['transferencia', 'transferir', 'nequi', 'daviplata', 'llave', 'bancolombia', 'consignacion', 'consignación'],
        optionText: '*transferencia* (Nequi / llave / banco)',
        confirmReply: 'Perfecto, queda como *transferencia*.\n\n{transferInfo}\n\nCuando pagues puedes mandar el comprobante por aquí.',
        flow: 'immediate',
    },
    {
        id: 'mercadopago',
        enabled: true,
        label: 'Mercado Pago',
        keywords: ['mercado pago', 'mercadopago', 'tarjeta', 'link de pago', 'mp'],
        optionText: '*mercado pago* (link de pago)',
        confirmReply: '',
        flow: 'mercadopago',
    },
];
function slugifyId(raw) {
    return raw
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 40);
}
function normalizeKeyword(s) {
    return s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}
function sanitizePaymentMethodsInput(input, opts) {
    if (!Array.isArray(input) || !input.length) {
        return resolvePaymentMethods(null, opts);
    }
    const out = [];
    const usedIds = new Set();
    for (const raw of input) {
        if (!raw || typeof raw !== 'object')
            continue;
        const row = raw;
        let id = slugifyId(String(row.id || row.label || '').trim());
        if (!id)
            continue;
        if (usedIds.has(id))
            id = `${id}_${out.length + 1}`;
        usedIds.add(id);
        const label = String(row.label || id).trim().slice(0, 80) || id;
        const keywordsRaw = Array.isArray(row.keywords)
            ? row.keywords.map((k) => String(k).trim()).filter(Boolean)
            : String(row.keywords || '')
                .split(',')
                .map((k) => k.trim())
                .filter(Boolean);
        const keywords = [...new Set(keywordsRaw.map(normalizeKeyword).filter(Boolean))].slice(0, 20);
        if (!keywords.length)
            keywords.push(normalizeKeyword(label));
        const flow = row.flow === 'mercadopago' || id === 'mercadopago' ? 'mercadopago' : 'immediate';
        out.push({
            id,
            enabled: row.enabled !== false,
            label,
            keywords,
            optionText: String(row.optionText || `*${keywords[0] || label}*`).trim().slice(0, 200),
            confirmReply: String(row.confirmReply ?? '').trim().slice(0, 1500),
            flow,
        });
    }
    if (!out.length)
        return resolvePaymentMethods(null, opts);
    if (opts?.allowMercadoPago === false) {
        for (const m of out) {
            if (m.flow === 'mercadopago' || m.id === 'mercadopago')
                m.enabled = false;
        }
    }
    return out;
}
function resolvePaymentMethods(stored, opts) {
    const allowMp = opts?.allowMercadoPago !== false;
    let list;
    if (Array.isArray(stored) && stored.length) {
        list = sanitizePaymentMethodsInput(stored, { allowMercadoPago: allowMp });
    }
    else {
        list = exports.DEFAULT_PAYMENT_METHODS.map((m) => ({
            ...m,
            keywords: [...m.keywords],
            enabled: m.flow === 'mercadopago' ? allowMp : m.enabled,
        }));
    }
    return list;
}
function getEnabledPaymentMethods(methods) {
    return methods.filter((m) => m.enabled);
}
function findPaymentMethodByText(text, methods) {
    const t = normalizeKeyword(text);
    if (!t)
        return null;
    const enabled = getEnabledPaymentMethods(methods);
    let best = null;
    for (const m of enabled) {
        for (const kw of m.keywords) {
            const k = normalizeKeyword(kw);
            if (!k)
                continue;
            let score = 0;
            if (t === k)
                score = 100;
            else if (t.includes(k))
                score = 80 + Math.min(15, k.length);
            else if (k.includes(t) && t.length >= 4)
                score = 60;
            if (score > 0 && (!best || score > best.score))
                best = { m, score };
        }
    }
    return best && best.score >= 60 ? best.m : null;
}
function isPaymentCapabilityQuestion(text) {
    const raw = (text || '').trim();
    if (raw.length < 8)
        return false;
    const t = normalizeKeyword(raw);
    if (/\b(se puede|puedo|pueden|podemos|aceptan|acepta|tienen|tiene|hay forma de|hay manera)\b/.test(t) &&
        /\b(pagar|pago|tarjeta|datafono|credito|nequi|daviplata|transferencia|efectivo|mercadopago|mercado pago|llave)\b/.test(t)) {
        return true;
    }
    if (/\b(tarjeta(\s+de)?\s+credito|tarjeta(\s+de)?\s+debito|pagar\s+con\s+tarjeta|pago\s+con\s+tarjeta|aceptan\s+tarjeta)\b/.test(t) &&
        (/\?/.test(raw) ||
            /\b(se puede|puedo|pueden|aceptan|acepta|tienen|tiene)\b/.test(t))) {
        return true;
    }
    return false;
}
function buildPaymentOptionsPrompt(methods, globalHint) {
    const enabled = getEnabledPaymentMethods(methods);
    if (!enabled.length) {
        return 'Por ahora no hay métodos de pago configurados. Escribe *humano* y te ayudamos.';
    }
    const lines = enabled.map((m, i) => `${i + 1}. ${m.optionText || `*${m.keywords[0] || m.label}*`}`);
    let msg = `¿Cómo pagas?\n${lines.join('\n')}`;
    if (globalHint?.trim())
        msg += `\n\n_${globalHint.trim()}_`;
    return msg;
}
function paymentMethodLabel(methodId, methods) {
    if (!methodId)
        return '(pendiente)';
    const found = methods.find((m) => m.id === methodId);
    return found?.label || methodId;
}
function applyPaymentReplyTemplate(tpl, vars) {
    return (tpl || '').replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');
}
//# sourceMappingURL=whatsapp-payment-methods.js.map