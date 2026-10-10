"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MENU_WRAPPER_TOKENS = void 0;
exports.isNamedMenuDishOrderPhrase = isNamedMenuDishOrderPhrase;
exports.productLooksLikeNamedMenuDish = productLooksLikeNamedMenuDish;
function normalizeText(s) {
    return s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
exports.MENU_WRAPPER_TOKENS = new Set([
    'menu',
    'ejecutivo',
    'almuerzo',
    'almuerzos',
    'bandeja',
    'bandejas',
    'especial',
    'especiales',
    'promocion',
    'promo',
    'combo',
    'combos',
    'casa',
    'gourmet',
    'infantil',
    'familiar',
    'chef',
    'economico',
]);
function isNamedMenuDishOrderPhrase(query) {
    const q = normalizeText(query || '');
    if (!q || q.length < 4)
        return false;
    if (/^(ver\s+)?(el\s+)?(menu|carta)(\s+completo)?$/.test(q))
        return false;
    if (/\b(link|enlace|url|pagina)\b/.test(q) && /\b(menu|carta)\b/.test(q))
        return false;
    if (/\b(pasame|pasa|dame|enviame|envia|mandame|manda|comparte|mostrame|muestra|quiero\s+ver|necesito\s+ver)\b/.test(q) &&
        /\b(el\s+)?(menu|carta)\b/.test(q) &&
        !/\b(ejecutivo|especial|infantil|familiar|gourmet|economico|chef|promo|bandeja|combo|almuerzo)\b/.test(q) &&
        !/\bde\s+la\s+casa\b/.test(q) &&
        !/\bdel\s+dia\b/.test(q) &&
        !/\bcon\s+\w{3,}/.test(q)) {
        return false;
    }
    if (/\bejecutivo\b/.test(q))
        return true;
    if (/\bmenu\b/.test(q)) {
        if (/\b(especial(?:es)?|ejecutivo|infantil|familiar|gourmet|economico|completo|chef|promo(?:cion)?)\b/.test(q) ||
            /\bde\s+la\s+casa\b/.test(q) ||
            /\bdel\s+dia\b/.test(q) ||
            /\bcon\s+\w{3,}/.test(q)) {
            return true;
        }
    }
    if (/\balmuerzo\b/.test(q) &&
        /\b(pechuga|pollo|frito|broaster|churrasco|costilla|sobrebarriga|ajiaco|mondongo|sopa)\b/.test(q)) {
        return true;
    }
    if (/\bbandeja\b/.test(q) &&
        (/\bcon\b/.test(q) || /\b(pollo|frito|broaster|paisa|mixta|especial)\b/.test(q))) {
        return true;
    }
    return false;
}
function productLooksLikeNamedMenuDish(name) {
    const n = normalizeText(name || '');
    if (!n)
        return false;
    if (/\bmenu\b/.test(n))
        return true;
    if (/\bejecutivo\b/.test(n))
        return true;
    if (/\bde\s+la\s+casa\b/.test(n))
        return true;
    if (/\bdel\s+dia\b/.test(n))
        return true;
    if (/\bbandeja\b/.test(n))
        return true;
    if (/\bespecial\b/.test(n) && /\b(menu|almuerzo|plato|promo|dia)\b/.test(n))
        return true;
    return false;
}
//# sourceMappingURL=whatsapp-named-menu-dish.js.map