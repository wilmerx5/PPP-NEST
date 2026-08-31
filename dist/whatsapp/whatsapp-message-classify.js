"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.needsAiMessageClassify = needsAiMessageClassify;
exports.hasFuzzyDomicilioCandidate = hasFuzzyDomicilioCandidate;
exports.parseClassifyResult = parseClassifyResult;
exports.fixFuzzyDomicilioTypos = fixFuzzyDomicilioTypos;
const FOOD_HINT_RE = /\b(pollo|sopa|bandeja|mojarra|churrasco|hamburguesa|ajiaco|mondongo|gaseosa|limonada|broaster|arepa|combo|ejecutivo|arroz|costilla|pechuga|alitas?|sobrebarriga|chino|paisa|maduro|frito|asado|medio|cuarto)\b/i;
const LOGISTICS_HINT_RE = /\b(domicil|direcci|delivery|bosques?|castilla|tabaku|nuevo\s+sol|altavista|torre|apto|apartamento|calle|carrera|cra|porter[ií]a|conjunto|habitaci)\b/i;
function needsAiMessageClassify(text) {
    const raw = (text || '').trim();
    if (raw.length < 6)
        return false;
    if (/^\d{1,4}$/.test(raw))
        return false;
    if (/^(listo|ok|dale|confirmar|confirmo|s[ií]|no|gracias|hola|buenas|buenos\s+dias|buenas\s+tardes|buenas\s+noches)[\s!.?]*$/i.test(raw)) {
        return false;
    }
    const hasFood = FOOD_HINT_RE.test(raw);
    const hasLogistics = LOGISTICS_HINT_RE.test(raw) || hasFuzzyDomicilioCandidate(raw);
    if (hasLogistics && !hasFood)
        return true;
    if (hasLogistics && hasFood)
        return true;
    if (/,/.test(raw) && !hasFood && raw.length >= 12)
        return true;
    if (hasFuzzyDomicilioCandidate(raw))
        return true;
    return false;
}
function hasFuzzyDomicilioCandidate(text) {
    const words = (text || '').toLowerCase().match(/[a-záéíóúüñ]{6,14}/gi) || [];
    for (const w of words) {
        const n = normalizeWord(w);
        if (n === 'domicilio' || n === 'domicilios')
            continue;
        if (!n.startsWith('d'))
            continue;
        if (editDistance(n, 'domicilio') <= 2 || editDistance(n, 'domicilios') <= 2) {
            return true;
        }
    }
    return false;
}
function parseClassifyResult(raw, fallbackText) {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw;
    const intentRaw = String(o.intent || '').toLowerCase().trim();
    const allowed = [
        'delivery_setup',
        'address',
        'order',
        'question',
        'chitchat',
        'other',
    ];
    if (!allowed.includes(intentRaw))
        return null;
    const normalizedText = typeof o.normalizedText === 'string' && o.normalizedText.trim()
        ? o.normalizedText.trim().slice(0, 500)
        : fallbackText;
    const address = typeof o.address === 'string' && o.address.trim().length >= 4
        ? o.address.trim().slice(0, 200)
        : null;
    const hasFoodItems = o.hasFoodItems === true;
    const confidence = typeof o.confidence === 'number' && Number.isFinite(o.confidence)
        ? Math.max(0, Math.min(1, o.confidence))
        : 0.5;
    return {
        intent: intentRaw,
        normalizedText,
        address,
        hasFoodItems,
        confidence,
    };
}
function normalizeWord(w) {
    return w
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}
function editDistance(a, b) {
    if (a === b)
        return 0;
    if (!a.length)
        return b.length;
    if (!b.length)
        return a.length;
    const rows = a.length + 1;
    const cols = b.length + 1;
    const dp = new Array(cols);
    for (let j = 0; j < cols; j++)
        dp[j] = j;
    for (let i = 1; i < rows; i++) {
        let prev = dp[0];
        dp[0] = i;
        for (let j = 1; j < cols; j++) {
            const tmp = dp[j];
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
            prev = tmp;
        }
    }
    return dp[cols - 1];
}
function fixFuzzyDomicilioTypos(text) {
    return (text || '').replace(/\b[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{6,14}\b/g, (word) => {
        const n = normalizeWord(word);
        if (n === 'domicilio' || n === 'domicilios')
            return word;
        if (!n.startsWith('d'))
            return word;
        if (!/^dom|^dmi|^dcm|^dmo|^domi|^domc|^domk|^doml/.test(n) && !n.includes('micil')) {
            if (editDistance(n, 'domicilio') > 2 && editDistance(n, 'domicilios') > 2) {
                return word;
            }
        }
        const d1 = editDistance(n, 'domicilio');
        const d2 = editDistance(n, 'domicilios');
        if (d1 === 0 || d2 === 0)
            return word;
        if (d1 <= 2 && d1 <= d2)
            return 'domicilio';
        if (d2 <= 2)
            return 'domicilios';
        return word;
    });
}
//# sourceMappingURL=whatsapp-message-classify.js.map