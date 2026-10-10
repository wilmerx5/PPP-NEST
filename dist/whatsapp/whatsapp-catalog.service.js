"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsappCatalogService = void 0;
const common_1 = require("@nestjs/common");
const products_service_1 = require("../products/products.service");
const whatsapp_menu_concepts_1 = require("./whatsapp-menu-concepts");
const whatsapp_local_glossary_1 = require("./whatsapp-local-glossary");
const whatsapp_distributed_variants_1 = require("./whatsapp-distributed-variants");
const whatsapp_compound_parse_1 = require("./whatsapp-compound-parse");
const whatsapp_named_menu_dish_1 = require("./whatsapp-named-menu-dish");
const whatsapp_session_intents_1 = require("./whatsapp-session-intents");
const whatsapp_intent_1 = require("./whatsapp-intent");
function titleCaseWords(s) {
    return s
        .split(' ')
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}
function normalizeText(s) {
    return s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\b1\s*\/\s*2\b/g, 'medio')
        .replace(/\b1\s*\/\s*4\b/g, 'cuarto')
        .replace(/\bmedias?\b/g, 'medio')
        .replace(/\bcuartos?\b/g, 'cuarto')
        .replace(/\barroces\b/g, 'arroz')
        .replace(/\bpollos\b/g, 'pollo')
        .replace(/\bfritos\b/g, 'frito')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function stemLoose(s) {
    const n = normalizeText(s);
    if (/(antes|entes|iones|unes|artes|ueves|iernes|abados|omingos)$/.test(n)) {
        if (n.length > 3 && n.endsWith('s') && !n.endsWith('es'))
            return n.slice(0, -1);
        if (n.length > 4 && n.endsWith('es') && /(antes|entes|iones)$/.test(n)) {
            return n.slice(0, -1);
        }
        return n;
    }
    if (n.length > 3 && n.endsWith('s') && !n.endsWith('es'))
        return n.slice(0, -1);
    if (n.length > 4 && n.endsWith('es')) {
        const minusS = n.slice(0, -1);
        if (/(ne|re|le|de|se|te|pe)$/.test(minusS))
            return minusS;
        return n.slice(0, -2);
    }
    return n;
}
function isBottleSizeToken(token) {
    const m = (token || '').match(/^(\d{3,4})(?:ml|cc)?$/);
    if (!m)
        return false;
    const n = Number(m[1]);
    return n >= 200 && n <= 3000;
}
function compactAlphaNum(s) {
    return normalizeText(s).replace(/\s+/g, '');
}
function boundedEditDistance(a, b, max) {
    if (Math.abs(a.length - b.length) > max)
        return null;
    const prev = new Array(b.length + 1);
    const curr = new Array(b.length + 1);
    for (let j = 0; j <= b.length; j++)
        prev[j] = j;
    for (let i = 1; i <= a.length; i++) {
        curr[0] = i;
        let rowMin = curr[0];
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
            if (curr[j] < rowMin)
                rowMin = curr[j];
        }
        if (rowMin > max)
            return null;
        for (let j = 0; j <= b.length; j++)
            prev[j] = curr[j];
    }
    return prev[b.length] <= max ? prev[b.length] : null;
}
function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function fixCommonOrderTypos(text) {
    return (0, whatsapp_local_glossary_1.applyLocalGlossary)(text);
}
const DRINK_ORDER_TOKEN = '(?:gaseosa|gaseosas|coca\\s*cola?|cola|sprite|pepsi|jugo|jugos|limonada|malta|cerveza|agua|hit|postobon|postob[oó]n|mr\\s*tea|cysco|colombiana|manzana|uva|ginger)';
const FOOD_ORDER_TOKEN = '(?:medio|cuarto|entero|pollo|broaster|frito|asado|pechuga|alas?|ejecutivo|bandeja|costilla|churrasco|churrascos|sobrebarriga|ajiacos?|menudencias?|mondongo|sopa|arroz|paisa|chino|mojarra|mojarras|platano|plátano|alitas?|yuca|papa|papas|hamburguesa|hamburguesas|trucha|bagre|pescado)';
const PACK_MULTIPLIER_TOKENS = new Set([
    'duo',
    'doble',
    'dupla',
    'trio',
    'triple',
    'pack',
    'paquete',
    'pareja',
    'combo',
    'promocion',
    'promo',
    'familiar',
    'x2',
    'x3',
    'x4',
]);
const ORDER_INTENT_ONLY = new Set([
    'quiero',
    'quieor',
    'qiero',
    'kiero',
    'quisiera',
    'gustaria',
    'dame',
    'ponme',
    'mandame',
    'enviame',
    'traeme',
    'regalame',
    'necesito',
    'deseo',
    'pedido',
    'pedidos',
    'orden',
    'ordenar',
    'pedir',
    'hacer',
    'vendes',
    'venden',
    'vendeme',
    'vendame',
]);
const CHITCHAT_NOISE_TOKENS = new Set([
    'cuento',
    'cuentos',
    'cuentes',
    'cuentame',
    'contame',
    'narrame',
    'historia',
    'historias',
    'chiste',
    'chistes',
    'poema',
    'cancion',
    'canciones',
    'programar',
    'programacion',
    'programador',
    'codigo',
    'html',
    'css',
    'javascript',
    'python',
    'java',
    'react',
    'inteligencia',
    'artificial',
    'chatgpt',
    'clima',
    'futbol',
    'politica',
    'religion',
    'matematica',
    'matematicas',
    'tarea',
    'traducir',
    'traduccion',
    'bromear',
    'broma',
    'enamorar',
    'novia',
    'novio',
    'filosofia',
    'adivinanza',
]);
function isAdjacentTransposition(a, b) {
    if (a.length !== b.length || a.length < 5)
        return false;
    const diffs = [];
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i])
            diffs.push(i);
    }
    if (diffs.length !== 2 || diffs[1] !== diffs[0] + 1)
        return false;
    return a[diffs[0]] === b[diffs[1]] && a[diffs[1]] === b[diffs[0]];
}
function tokenEditDistance(a, b) {
    if (a === b)
        return 0;
    if (!a.length)
        return b.length;
    if (!b.length)
        return a.length;
    const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++)
        dp[i][0] = i;
    for (let j = 0; j <= b.length; j++)
        dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
        }
    }
    return dp[a.length][b.length];
}
function fuzzyTokenMatch(queryToken, candidateToken) {
    const q = normalizeText(queryToken);
    const c = normalizeText(candidateToken);
    if (!q || !c)
        return false;
    if (q === c)
        return true;
    if (whatsapp_intent_1.PPP_ZONE_LANDMARK_RE.test(q) || whatsapp_intent_1.PPP_ZONE_LANDMARK_RE.test(c)) {
        return false;
    }
    if (q.length >= 5 && c.length >= 5 && (c.includes(q) || q.includes(c))) {
        if (Math.min(q.length, c.length) / Math.max(q.length, c.length) >= 0.75)
            return true;
    }
    if (q.length < 6 || c.length < 6)
        return false;
    if (q.slice(1) === c.slice(1))
        return false;
    if (q.slice(0, 3) === c.slice(0, 3) && isAdjacentTransposition(q, c))
        return true;
    const dist = tokenEditDistance(q, c);
    const maxDist = q.length <= 8 ? 1 : 2;
    if (dist > maxDist)
        return false;
    if (q.length === c.length && dist === 1) {
        const vowels = new Set(['a', 'e', 'i', 'o', 'u']);
        for (let i = 0; i < q.length; i++) {
            if (q[i] !== c[i] && vowels.has(q[i]) && vowels.has(c[i]) && i < 3)
                return false;
        }
    }
    return true;
}
function nearDishToken(word, tok) {
    const w = singularizeEsToken(word);
    const t = singularizeEsToken(tok);
    if (fuzzyTokenMatch(w, t) || fuzzyTokenMatch(word, tok))
        return true;
    if (w.length >= 4 && t.length >= 4 && w.slice(0, 3) === t.slice(0, 3) && tokenEditDistance(w, t) <= 1) {
        return true;
    }
    return w.length >= 7 && t.length >= 7 && w.slice(0, 3) === t.slice(0, 3) && tokenEditDistance(w, t) <= 2 ||
        w.length >= 6 && t.length >= 6 && w.slice(0, 4) === t.slice(0, 4) && tokenEditDistance(w, t) <= 2;
}
const COOKING_STYLE_TOKENS = new Set([
    'frito',
    'frita',
    'fritos',
    'fritas',
    'asado',
    'asada',
    'asados',
    'asadas',
    'apanado',
    'apanada',
    'broaster',
    'plancha',
    'gratinada',
    'gratinado',
    'horno',
    'sudado',
    'sudada',
    'guisado',
    'guisada',
    'salsa',
    'maduro',
    'maduros',
    'verde',
    'verdes',
]);
const COOKING_STYLE_SYNONYM_GROUPS = [
    ['asado', 'asada', 'asados', 'asadas', 'plancha'],
    ['frito', 'frita', 'fritos', 'fritas'],
    ['gratinada', 'gratinado'],
    ['apanado', 'apanada'],
    ['broaster'],
    ['horno', 'al horno'],
    ['sudado', 'sudada', 'en salsa', 'salsa', 'guisado', 'guisada'],
];
function cookingStyleGroup(style) {
    const s = singularizeEsToken(normalizeText(style));
    const full = normalizeText(style);
    for (const g of COOKING_STYLE_SYNONYM_GROUPS) {
        if (g.some((x) => singularizeEsToken(x) === s ||
            normalizeText(x) === full ||
            normalizeText(x) === s ||
            (full.length >= 4 && normalizeText(x).includes(full)) ||
            (s.length >= 4 && normalizeText(x).includes(s)))) {
            return g;
        }
    }
    return [s || style];
}
function productOffersCookingStyle(product, style) {
    if (productNameHasCookingStyle(product.name, style))
        return true;
    for (const attr of product.attributes || []) {
        for (const opt of attr.options || []) {
            if (productNameHasCookingStyle(opt, style))
                return true;
        }
    }
    return false;
}
function productNameHasCookingStyle(productName, style) {
    const name = normalizeText(productName);
    if (!name || !style)
        return false;
    const group = cookingStyleGroup(style);
    return group.some((st) => {
        const needle = normalizeText(st);
        if (!needle)
            return false;
        if (needle.includes(' '))
            return name.includes(needle);
        return (name.includes(needle) ||
            name.split(/\s+/).some((nt) => singularizeEsToken(nt) === singularizeEsToken(needle)));
    });
}
function productHasConflictingCookingStyle(productName, queryStyles) {
    if (!queryStyles.length)
        return false;
    const name = normalizeText(productName);
    const nameStyles = [...COOKING_STYLE_TOKENS].filter((st) => name.includes(st) ||
        name.split(/\s+/).some((nt) => singularizeEsToken(nt) === singularizeEsToken(st)));
    if (!nameStyles.length)
        return false;
    return nameStyles.every((ns) => !queryStyles.some((qs) => productNameHasCookingStyle(ns, qs) || productNameHasCookingStyle(qs, ns)));
}
function singularizeEsToken(token) {
    const t = normalizeText(token);
    if (t === 'arroces')
        return 'arroz';
    if (t.length < 4)
        return t;
    if (/(?:ciones|siones)$/.test(t))
        return t.replace(/(?:ciones|siones)$/, 'cion');
    if (/as$/.test(t) && t.length > 4)
        return t.slice(0, -1);
    if (/os$/.test(t) && t.length > 4)
        return t.slice(0, -1);
    if (/es$/.test(t) && t.length > 5)
        return t.slice(0, -2);
    if (/s$/.test(t) && t.length > 3)
        return t.slice(0, -1);
    return t;
}
let WhatsappCatalogService = class WhatsappCatalogService {
    productsService;
    menuCache = null;
    TTL_MS = 60_000;
    constructor(productsService) {
        this.productsService = productsService;
    }
    async getMenuProducts(forceRefresh = false) {
        const cached = this.menuCache;
        if (!forceRefresh && cached && Date.now() - cached.at < this.TTL_MS) {
            return cached.products;
        }
        const grouped = await this.productsService.findProductsGroupedByCategory(forceRefresh);
        const products = [];
        const categories = [];
        for (const cat of grouped || []) {
            const catName = String(cat.categoryName || '').trim();
            if (catName)
                categories.push(catName);
            for (const p of cat.products || []) {
                const attrs = (p.attributes || []).map((a) => ({
                    attributeName: a.attributeName,
                    options: Array.isArray(a.options) ? a.options.map(String) : [],
                }));
                products.push({
                    id: p.id,
                    name: p.name,
                    code: Number(p.code) || 0,
                    price: Number(p.price) || 0,
                    description: p.description ? String(p.description).trim() : null,
                    categoryName: catName || undefined,
                    hasAttributes: !!p.hasAttributes && attrs.length > 0,
                    attributes: attrs,
                    availableNow: p.availableNow !== false,
                });
            }
        }
        const available = products.filter((p) => p.availableNow !== false);
        const byCat = new Map();
        for (const p of available) {
            const key = p.categoryName || 'Otros';
            if (!byCat.has(key))
                byCat.set(key, []);
            byCat.get(key).push(p);
        }
        const detailedParts = [];
        for (const [cat, list] of byCat) {
            detailedParts.push(`## Categoría: ${cat}`);
            for (const p of list) {
                let block = `[id=${p.id}] código ${p.code} — ${p.name} — $${Math.round(p.price).toLocaleString('es-CO')}`;
                if (p.description)
                    block += `\n  Descripción: ${p.description}`;
                if (p.hasAttributes && p.attributes?.length) {
                    const opts = p.attributes
                        .map((a) => `  ${a.attributeName}: ${a.options.map((o, i) => `${i + 1}) ${o}`).join(', ')}`)
                        .join('\n');
                    block += `\n  Opciones a elegir:\n${opts}`;
                }
                detailedParts.push(block);
            }
        }
        this.menuCache = {
            at: Date.now(),
            products,
            categories: [...new Set(categories)],
            detailed: detailedParts.join('\n\n'),
        };
        return products;
    }
    async getMenuDetailedText() {
        await this.getMenuProducts();
        return this.menuCache?.detailed || '';
    }
    groupProductsByCategory(products) {
        const available = products.filter((p) => p.availableNow !== false);
        const byCat = new Map();
        for (const p of available) {
            const key = p.categoryName || 'Otros';
            if (!byCat.has(key))
                byCat.set(key, []);
            byCat.get(key).push(p);
        }
        return byCat;
    }
    isCourtesyOnlyMessage(text) {
        const raw = (text || '').trim();
        if (!raw || raw.length > 80)
            return false;
        const q = normalizeText(raw);
        if (!q)
            return false;
        if (this.extractCodeFromMessage(raw) != null)
            return false;
        if (new RegExp(FOOD_ORDER_TOKEN, 'i').test(q) || new RegExp(DRINK_ORDER_TOKEN, 'i').test(q)) {
            return false;
        }
        if (/\b(mojarra|bandeja|mondongo|arepa|chorizo|pechuga|costilla|ajiaco|sancocho|frito|broaster|plancha)\b/.test(q)) {
            return false;
        }
        if (/^(gracias|muchas\s+gracias|mil\s+gracias|te\s+agradezco|thanks|thank\s+you|ty|ok|okay|oki|dale|listo|perfecto|genial|super|excelente|vale|va|bien|bueno|de\s+nada|con\s+gusto|entendido|claro|okey|okis)([\s!.?]|$)/.test(q) &&
            !/\b(quiero|dame|ponme|agrega|pedir|ordenar|codigo|menu|carta)\b/.test(q)) {
            const stripped = q
                .replace(/\b(gracias|muchas|mil|te|agradezco|thanks|thank|you|ty|ok|okay|oki|dale|listo|perfecto|genial|super|excelente|vale|va|bien|bueno|de|nada|con|gusto|entendido|claro|okey|okis|si|sí|por|favor|porfa)\b/g, ' ')
                .replace(/[!.?]+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            return stripped.length < 3;
        }
        return false;
    }
    formatCourtesyReply(brandName) {
        const brand = (brandName || '').trim();
        return brand
            ? `¡Con gusto! Cuando quieras pedir en *${brand}*, dime el plato o el código 🍗`
            : `¡Con gusto! Cuando quieras pedir, dime el plato o el código 🍗`;
    }
    isOffTopicChitchat(text) {
        const raw = (text || '').trim();
        if (!raw || raw.length < 4)
            return false;
        if (this.isCourtesyOnlyMessage(raw))
            return true;
        if (this.extractCodeFromMessage(raw) != null)
            return false;
        if (this.isPriceInquiryIntent(raw))
            return false;
        if (this.isProductDescriptionInquiry(raw))
            return false;
        if (this.isMenuExploreIntent(raw, []))
            return false;
        if (/\b(quiero|dame|ponme|agrega|pedir|ordenar|pedi|pido|medio|cuarto|combo|domicilio|recojo)\b/i.test(raw) &&
            new RegExp(FOOD_ORDER_TOKEN, 'i').test(raw)) {
            return false;
        }
        const q = normalizeText(raw);
        const patterns = [
            /\b(cuentame|contame|narrame|dime)\s+(un|una|el|la)?\s*(cuento|historia|chiste|poema|adivinanza|cancion)\b/,
            /\b(un|una)\s+(cuento|historia|chiste|poema|adivinanza)\b/,
            /\b(me\s+)?(cuentas|contas|narras)\s+(un|una)?\s*(cuento|historia|chiste)\b/,
            /\bque\s+me\s+(cuentes|contes|narres)\b/,
            /\b(sabes|puedes|quieres)\s+(programar|codear|hackear)\b/,
            /\b(programar|programacion|desarrollar)\s+(en\s+)?(html|css|js|javascript|python|java|react)?\b/,
            /\b(que\s+es|explicame|ensename)\s+(html|css|javascript|python|programacion)\b/,
            /\b(inteligencia\s+artificial|chatgpt|gpt|openai)\b/,
            /\b(como\s+esta\s+el\s+clima|que\s+clima|va\s+a\s+llover)\b/,
            /\b(quien\s+(gano|juega)|partido\s+de\s+futbol|mundial)\b/,
            /\b(hazme|haceme|inventa)\s+(un|una)\s+(cuento|chiste|poema)\b/,
            /\b(canta|baila|dibuja)\b/,
            /\b(eres\s+un\s+robot|estas\s+vivo|tienes\s+sentimientos)\b/,
            /\b(resolveme|ayudame\s+con)\s+(la\s+)?(tarea|matematica|ecuacion)\b/,
            /\b(traduce|traducir)\b/,
        ];
        if (patterns.some((re) => re.test(q)))
            return true;
        const tokens = q.split(' ').filter((t) => t.length >= 3);
        const hasChitchat = tokens.some((t) => CHITCHAT_NOISE_TOKENS.has(t));
        const hasFood = new RegExp(FOOD_ORDER_TOKEN, 'i').test(q) ||
            new RegExp(DRINK_ORDER_TOKEN, 'i').test(q) ||
            /\b(mojarra|bandeja|mondongo|arepa|chorizo|pechuga|costilla|ajiaco|sancocho|frito|broaster)\b/.test(q);
        if (hasChitchat && !hasFood)
            return true;
        return false;
    }
    formatOffTopicRedirect(brandName) {
        const brand = (brandName || 'acá').trim();
        return `Por *${brand}* solo tomo pedidos 🍗 Escribe el *plato* o contáctanos al *3118866823*.`;
    }
    isMenuExploreIntent(text, products = []) {
        const q = normalizeText(text);
        if (!q || q.length < 5)
            return false;
        if (this.isRestaurantLocationInquiry(text))
            return false;
        if ((0, whatsapp_named_menu_dish_1.isNamedMenuDishOrderPhrase)(text))
            return false;
        if (/\b(link|enlace|url)\b/.test(q) ||
            /\b(pasa|dame|envia|manda|comparte)\b.*\b(menu|carta)\b/.test(q) ||
            /^(ver\s+)?(el\s+)?(menu|carta)(\s+completo)?$/.test(q)) {
            return false;
        }
        if (this.extractCodeFromMessage(text) != null)
            return false;
        if (products.length) {
            const embedded = this.findProductEmbeddedInMessage(text, products);
            if (embedded) {
                const name = normalizeText(embedded.name);
                if (name.length >= 5 && q.includes(name))
                    return false;
            }
        }
        const explorePatterns = [
            /\b(que|qué)\s+(hay|tienen|tiene|tienes|ofrecen|ofreces|sirven|ponen|venden)\b/,
            /\b(que|qué)\s+(me\s+)?(recomiend|sugier|aconsej)/,
            /\b(que|qué)\s+(de|para)\s+(almuerzo|comer|comida|cena|desayuno|merienda|hoy|la\s+casa)\b/,
            /\b(que|qué)\s+(hay|tienen|tiene|tienes|ofrecen|ofreces)\s+(de\s+)?(comida|comer|almuerzo|cena|platos?|carne|carnes|pollo|sopas?|bebidas?)?\b/,
            /\b(que|qué)\s+(?:unas?|los?|las?)?\s*(bebidas?|sopas?|pollos?|arroces?|bandejas?|porciones?|gaseosas?|carnes?|hamburguesas?|combos?|platos?|jugos?|limonadas?)\s+(?:\w+\s+){0,2}(hay|tienen|tiene|tienes|ofrecen|ofreces)\b/,
            /\b(que|qué)\s+(se\s+)?(puede|podemos|puedo)\s+(pedir|ordenar|comer)\b/,
            /\b(que|qué)\s+tienes\s+(de\s+)?(comer|comida|almuerzo|cena)?\b/,
            /\b(que|qué)\s+ofreces\b/,
            /\b(opciones|recomendaciones|sugerencias)\b/,
            /\b(carta|menu)\s+(de|del)\s+(hoy|dia|día)\b/,
            /\bque\s+me\s+antoj/,
            /\bno\s+se\s+que\s+(pedir|comer|ordenar)\b/,
            /\b(estoy|ando)\s+(indecis|buscando)\b/,
            /\b(muestrame|mostrame|ver)\s+(las\s+)?(opciones|categorias|categorías)\b/,
        ];
        if (!explorePatterns.some((re) => re.test(q)))
            return false;
        if (this.extractQuantityFromMessage(text) >= 2 && new RegExp(FOOD_ORDER_TOKEN, 'i').test(q)) {
            return false;
        }
        if (/^(quiero|dame|ponme|agrega)\b/.test(q) &&
            new RegExp(FOOD_ORDER_TOKEN, 'i').test(q)) {
            return false;
        }
        const hasExploreQuestion = /\b(que|qué|hay|tienen|tiene|tienes|ofrecen|ofreces|recomiend|categor|opciones|antoj|comer|comida)\b/.test(q);
        if (/\b(quiero|dame|necesito)\b/.test(q) && !hasExploreQuestion)
            return false;
        return true;
    }
    isCategoryBrowseQuestion(text) {
        const q = normalizeText(text);
        if (!q || q.length < 5)
            return false;
        if (this.isRestaurantLocationInquiry(text))
            return false;
        if (this.extractCodeFromMessage(text) != null)
            return false;
        if (/^(quiero|dame|ponme|agrega)\b/.test(q))
            return false;
        const catWord = '(?:bebidas?|sopas?|pollos?|arroces?|bandejas?|porciones?|gaseosas?|carnes?|hamburguesas?|combos?|platos?|categorias?|jugos?|limonadas?|aguas?)';
        return (/\b(que|qué)\s+(hay|tienen|tiene|tienes|ofrecen|ofreces|sirven|venden|ponen)\b/.test(q) ||
            new RegExp(`\\b(que|qué)\\s+(?:unas?\\s+|los?\\s+|las?\\s+)?${catWord}\\s+(?:\\w+\\s+){0,2}(hay|tienen|tiene|tienes|ofrecen|ofreces|sirven|venden|ponen)\\b`).test(q) ||
            new RegExp(`\\b(que|qué)\\s+(hay|tienen|tiene|tienes)\\s+(?:de\\s+)?${catWord}\\b`).test(q) ||
            /\b(muestrame|mostrame|ver)\s+(las?\s+)?(opciones|lista)?\b/.test(q) ||
            /\b(opciones|lista)\s+de\b/.test(q) ||
            /\b(tiene|tienen|tienes|hay|manejan|venden)\b.{0,30}\b(mexicana|mexicano|mexicanos|tacos?|comida\s+rapid)/.test(q));
    }
    extractCookingStyleBrowseIntent(text) {
        const raw = (text || '').trim();
        if (!raw || raw.length < 4)
            return null;
        if (this.extractCodeFromMessage(raw) != null)
            return null;
        if (/^(quiero|dame|ponme|agrega|regalame|me\s+regalas)\b/i.test(raw) &&
            new RegExp(FOOD_ORDER_TOKEN, 'i').test(normalizeText(raw))) {
            const qCheck = normalizeText(raw);
            const foodHits = (qCheck.match(new RegExp(FOOD_ORDER_TOKEN, 'gi')) || []).length;
            const styleHits = [...COOKING_STYLE_TOKENS].filter((st) => this.queryHasToken(qCheck, st));
            if (foodHits >= 1 && styleHits.length >= 1) {
                if (!/\b(que|qué|tienes|tienen|hay|ofreces|ofrecen|algo)\b/.test(qCheck)) {
                    return null;
                }
            }
        }
        const q = normalizeText(fixCommonOrderTypos(raw));
        const stylesInMsg = [...COOKING_STYLE_TOKENS]
            .filter((st) => this.queryHasToken(q, st))
            .sort((a, b) => b.length - a.length);
        if (!stylesInMsg.length)
            return null;
        const style = stylesInMsg[0];
        const asksBrowse = /\b(que|qué)\s+(tienes|tiene|tienen|hay|ofreces|ofrecen|sirven|venden|manejan)\b/.test(q) ||
            /\b(que|qué)\s+sea\b/.test(q) ||
            /\balgo\s+\w*(sudad|frit|asad|apanad|broaster|plancha|guisad|horno)/.test(q) ||
            /\b(tienes|tiene|tienen|hay|ofreces|ofrecen|manejan)\b.{0,40}\b/.test(q) ||
            /\bpreparaci[oó]n\b/.test(q) ||
            new RegExp(`^(el\\s+|la\\s+|en\\s+)?${style}\\??$`).test(q);
        if (!asksBrowse)
            return null;
        const withoutStyle = q
            .replace(new RegExp(`\\b${style}\\b`, 'g'), ' ')
            .replace(/\b(que|qué|sea|algo|tienes|tiene|tienen|hay|ofreces|ofrecen|sirven|venden|manejan|de|del|la|el|los|las|unas?|unos?|preparacion|preparación|estilo|forma)\b/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        const leftoverFood = withoutStyle
            .split(' ')
            .filter((t) => t.length >= 4 && !COOKING_STYLE_TOKENS.has(t) && !ORDER_INTENT_ONLY.has(t));
        if (leftoverFood.some((t) => new RegExp(FOOD_ORDER_TOKEN, 'i').test(t) && t !== style)) {
            if (leftoverFood.length >= 1 && /^(quiero|dame|ponme)/.test(q))
                return null;
            if (leftoverFood.length >= 1 && !/\b(que|qué|algo|tienes|hay)\b/.test(q))
                return null;
        }
        return singularizeEsToken(style) || style;
    }
    findProductsByCookingStyle(style, products, limit = 12) {
        const st = singularizeEsToken(normalizeText(style));
        if (!st)
            return [];
        const hits = [];
        for (const p of products) {
            if (p.availableNow === false)
                continue;
            if (productNameHasCookingStyle(p.name, st)) {
                hits.push(p);
                continue;
            }
            if (this.findPrepOptionMatchingStyle(p, st)) {
                hits.push(p);
            }
        }
        return this.spreadCookingStyleHits(hits, st).slice(0, limit);
    }
    spreadCookingStyleHits(hits, style) {
        const groups = new Map();
        for (const product of hits) {
            const base = this.getProductNameBase(product.name) || normalizeText(product.name);
            const key = this.stripCookingStyleTokens(base) || base;
            const list = groups.get(key) || [];
            list.push(product);
            groups.set(key, list);
        }
        const rank = (product) => productNameHasCookingStyle(product.name, style) ? 0 : 1;
        for (const list of groups.values()) {
            list.sort((a, b) => rank(a) - rank(b) || a.price - b.price);
        }
        const families = [...groups.values()].sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].price - b[0].price);
        const out = [];
        for (const list of families)
            out.push(list[0]);
        for (const list of families) {
            for (const product of list.slice(1))
                out.push(product);
        }
        return out;
    }
    isPrepAttributeName(attributeName) {
        const an = String(attributeName || '');
        if (/\b(arepas?|bebida|bebidas|sabor|sabores|presa|sopas?|guarnicion|acompanamiento|tama[nñ]o)\b/i.test(an)) {
            return false;
        }
        if (/^(pollo)$/i.test(an.trim()) ||
            /\b(seleccion|selección|preparacion|preparación|estilo|coccion|cocción|tipo|modo|opcion|opción)\b/i.test(an)) {
            return true;
        }
        return /prep|estilo|selec|cocin|modo|tipo/i.test(an);
    }
    findPrepOptionMatchingStyle(product, style) {
        for (const a of product.attributes || []) {
            if (!this.isPrepAttributeName(a.attributeName))
                continue;
            for (const opt of a.options || []) {
                const raw = String(opt || '').trim();
                if (raw && productNameHasCookingStyle(raw, style))
                    return raw;
            }
        }
        return null;
    }
    resolveCookingStyleMenuLabel(style, hits) {
        const asked = normalizeText(style);
        const counts = new Map();
        for (const p of hits) {
            const opt = this.findPrepOptionMatchingStyle(p, style);
            if (opt) {
                const key = normalizeText(opt);
                counts.set(key, (counts.get(key) || 0) + 1);
                continue;
            }
            if (productNameHasCookingStyle(p.name, style)) {
                const group = cookingStyleGroup(style);
                const name = normalizeText(p.name);
                const fromName = group.find((g) => g.includes(' ') && name.includes(normalizeText(g))) ||
                    group.find((g) => !g.includes(' ') && name.split(/\s+/).includes(normalizeText(g))) ||
                    asked;
                counts.set(normalizeText(fromName), (counts.get(normalizeText(fromName)) || 0) + 1);
            }
        }
        if (!counts.size)
            return asked;
        const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
        return best;
    }
    listAvailableCookingStyles(products) {
        const found = new Set();
        for (const p of products) {
            if (p.availableNow === false)
                continue;
            const name = normalizeText(p.name);
            for (const st of COOKING_STYLE_TOKENS) {
                if (st === 'salsa' || st === 'sudado' || st === 'sudada')
                    continue;
                if (productNameHasCookingStyle(name, st) && name.includes(singularizeEsToken(st))) {
                    found.add(singularizeEsToken(st));
                }
            }
            for (const a of p.attributes || []) {
                if (!this.isPrepAttributeName(a.attributeName))
                    continue;
                for (const opt of a.options || []) {
                    const raw = String(opt || '').trim();
                    const o = normalizeText(raw);
                    if (!o)
                        continue;
                    if ([...COOKING_STYLE_SYNONYM_GROUPS].some((g) => g.some((x) => productNameHasCookingStyle(o, x) || o.includes(normalizeText(x)))) ||
                        [...COOKING_STYLE_TOKENS].some((st) => productNameHasCookingStyle(o, st))) {
                        found.add(o);
                    }
                }
            }
        }
        return [...found].filter(Boolean).sort();
    }
    formatCookingStyleBrowseReply(style, hits, opts) {
        const asked = style.trim().toLowerCase();
        if (hits.length) {
            const menuLabel = this.resolveCookingStyleMenuLabel(style, hits);
            const shown = menuLabel || asked;
            const synonym = normalizeText(shown) !== normalizeText(asked) &&
                !normalizeText(shown).includes(normalizeText(asked));
            const header = synonym
                ? `Sí 👍 Lo más cercano a *${asked}* es *${shown}*. Te ofrezco:\n\n`
                : `Sí 👍 Esto lo manejamos *${shown}*:\n\n`;
            return header + this.formatCategoryList(shown, hits);
        }
        const alts = (opts?.availableStyles || [])
            .filter((s) => {
            const n = normalizeText(s);
            return n && n !== normalizeText(asked) && !cookingStyleGroup(asked).includes(n);
        })
            .slice(0, 6);
        const altLine = alts.length
            ? `\nEn carta sí tenemos: *${alts.join('*, *')}*.`
            : '';
        const link = (opts?.menuUrl || '').trim();
        return (`Por ahora no manejamos preparación *${asked}* en la carta.${altLine}\n` +
            (link ? `\nPuedes ver todo aquí:\n${link}\n` : '') +
            `\n¿Qué otra preparación o plato te antoja?`);
    }
    isRestaurantLocationInquiry(text) {
        const q = normalizeText(text);
        if (!q || q.length < 5)
            return false;
        if (new RegExp(FOOD_ORDER_TOKEN, 'i').test(q) && /\b(quiero|dame|ponme|agrega)\b/.test(q)) {
            return false;
        }
        return (/\bdonde\s+(queda|quedan|estan|es|esta|ubican|ubica|encuentran|encuentra)\b/.test(q) ||
            /\bcomo\s+(llego|llegar|llegamos|ubicar|ubicarlos)\b/.test(q) ||
            /\b(cual\s+es\s+la\s+)?(direccion|ubicacion)\s+(del?\s+)?(local|restaurante|negocio|sitio)?\b/.test(q) ||
            /\bdonde\s+(queda|estan)\s+(su|el|la)?\s*(local|restaurante|negocio|sede)\b/.test(q) ||
            /\b(mapa|google\s+maps|pin)\s+(del?\s+)?(local|restaurante)?\b/.test(q) ||
            /\b(ubicacion|direccion)\s+del\s+(local|restaurante)\b/.test(q));
    }
    QTY_WORD_MAP = {
        un: 1,
        una: 1,
        uno: 1,
        dos: 2,
        tres: 3,
        cuatro: 4,
        cinco: 5,
        seis: 6,
        siete: 7,
        ocho: 8,
        nueve: 9,
        diez: 10,
        once: 11,
        doce: 12,
    };
    QTY_SKIP_AFTER_NUM = new Set([
        'calle',
        'carrera',
        'cra',
        'cl',
        'cll',
        'av',
        'avenida',
        'casa',
        'apto',
        'apartamento',
        'torre',
        'piso',
        'local',
        'numero',
        'num',
        'norte',
        'sur',
        'este',
        'oeste',
        'bis',
    ]);
    countQuantityMentions(text) {
        let q = normalizeText(text || '');
        if (!q)
            return 0;
        q = q
            .replace(/\b\d+[.,]\d+\s*(?:l|lt|lts|litro|litros)?\b/g, ' ')
            .replace(/\b\d\s+\d\s*(?:l|lt|lts|litro|litros)?\b/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        let count = 0;
        const re = /\b(\d{1,2}|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\s+(?:de\s+)?([a-z0-9]{3,})/g;
        for (const m of q.matchAll(re)) {
            const rawNum = m[1];
            const after = m[2];
            if (this.QTY_SKIP_AFTER_NUM.has(after))
                continue;
            if (/^(l|lt|lts|litro|litros|ml|cc)$/.test(after))
                continue;
            const n = this.QTY_WORD_MAP[rawNum] ?? parseInt(rawNum, 10);
            if (Number.isFinite(n) && n >= 1 && n <= 30)
                count += 1;
        }
        return count;
    }
    extractQuantityNearProduct(fullText, productName) {
        const raw = fixCommonOrderTypos((fullText || '').trim());
        if (!raw || !productName)
            return null;
        const corrected = this.extractCorrectedQuantityForProduct(raw, productName);
        if (corrected != null)
            return corrected;
        const segments = this.splitMultiProductSegments(raw);
        const pn = normalizeText(productName);
        const tokens = pn
            .split(/\s+/)
            .filter((t) => t.length >= 4 && !this.WEAK_PRODUCT_TOKENS.has(t) && !COOKING_STYLE_TOKENS.has(t));
        const tokenHitsIn = (sn) => {
            let hits = 0;
            for (const t of tokens) {
                const sing = singularizeEsToken(t);
                if (sn.includes(t) || sn.includes(sing)) {
                    hits += 1;
                    continue;
                }
                for (const w of sn.split(/\s+/)) {
                    if (w.length < 4)
                        continue;
                    if (fuzzyTokenMatch(w, t) ||
                        fuzzyTokenMatch(singularizeEsToken(w), sing)) {
                        hits += 1;
                        break;
                    }
                }
            }
            return hits;
        };
        let bestSeg = '';
        let bestScore = 0;
        for (const seg of segments) {
            const sn = normalizeText(fixCommonOrderTypos(seg));
            if (!sn)
                continue;
            let score = 0;
            if (sn.includes(pn) || (pn.length >= 6 && pn.includes(sn)))
                score = 100;
            else
                score = tokenHitsIn(sn) * 25;
            if (score > 0 && this.countQuantityMentions(seg) >= 1)
                score += 10;
            if (score > bestScore) {
                bestScore = score;
                bestSeg = seg;
            }
        }
        if (bestScore >= 25 && bestSeg) {
            return this.extractQuantityFromSegment(bestSeg);
        }
        const q = normalizeText(raw);
        const qtyWords = 'dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce';
        for (const t of tokens.length ? tokens : pn.split(/\s+/).filter((x) => x.length >= 4)) {
            const re = new RegExp(`\\b(\\d{1,2}|${qtyWords})\\s+(?:de\\s+)?[\\w\\s]{0,40}\\b${escapeRegExp(t)}\\b`);
            const m = q.match(re);
            if (m?.[1]) {
                const n = this.QTY_WORD_MAP[m[1]] ?? parseInt(m[1], 10);
                if (Number.isFinite(n) && n >= 1 && n <= 30)
                    return n;
            }
            const loose = new RegExp(`\\b(\\d{1,2}|${qtyWords})\\s+(?:de\\s+)?([a-z0-9]{4,})`, 'g');
            for (const hm of q.matchAll(loose)) {
                const word = hm[2];
                if (fuzzyTokenMatch(word, t) ||
                    fuzzyTokenMatch(singularizeEsToken(word), singularizeEsToken(t))) {
                    const n = this.QTY_WORD_MAP[hm[1]] ?? parseInt(hm[1], 10);
                    if (Number.isFinite(n) && n >= 1 && n <= 30)
                        return n;
                }
            }
        }
        return null;
    }
    extractCorrectedQuantityForProduct(text, productName) {
        const quantity = '\\d{1,2}|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce';
        const match = normalizeText(text).match(new RegExp(`\\bno\\s+(?:son|eran)\\s+(?:${quantity})\\s+(.+?)\\s+(?:son|sino)\\s+(${quantity})\\b`));
        if (!match || /\b(?:y|o)\b/.test(match[1]))
            return null;
        const anchors = normalizeText(productName).split(' ').filter(token => token.length >= 4 && !['porcion', 'pequena', 'grande', 'natural'].includes(token));
        const spoken = match[1].split(' ');
        if (!anchors.length || !anchors.every(anchor => spoken.some(word => nearDishToken(word, anchor))))
            return null;
        const value = this.QTY_WORD_MAP[match[2]] ?? Number(match[2]);
        return Number.isFinite(value) && value >= 1 && value <= 30 ? value : null;
    }
    extractQuantityFromSegment(text) {
        const raw = fixCommonOrderTypos((text || '').trim());
        if (!raw)
            return 1;
        if (/^\d{1,2}$/.test(raw))
            return 1;
        if (/^(?:opci[oó]n|la|el|numero|n[uú]mero)\s*[1-9]\d{0,2}$/i.test(raw))
            return 1;
        let q = normalizeText(raw);
        if (/\s\d{1,2}$/.test(q) && /\b(pollo|broaster|frito|asado|sopa|mojarra|arepa)\b/.test(q)) {
            const withoutTrail = q.replace(/\s+\d{1,2}$/, '').trim();
            if (withoutTrail &&
                !/\b([2-9]|1[0-9]|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\b/.test(withoutTrail)) {
                q = withoutTrail;
            }
        }
        if (/\b(medio|media|cuarto|cuarta|1\/2|1\/4)\b/.test(q) && !/\b\d+\s*(pollo|sopas?|bandejas?)/.test(q)) {
            if (!/\b([2-9]|1[0-9]|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b/.test(q)) {
                return 1;
            }
        }
        const wordMap = this.QTY_WORD_MAP;
        const xMatch = q.match(/(?:^|\s)(?:x|×)\s*(\d{1,2})(?:\s|$)/) || q.match(/(?:^|\s)(\d{1,2})\s*(?:x|×)(?:\s|$)/);
        if (xMatch?.[1]) {
            const n = parseInt(xMatch[1], 10);
            if (n >= 1 && n <= 30)
                return n;
        }
        const digitMatch = q.match(/\b(\d{1,2})\s*(?:de\s+)?(?:pollos?|sopas?|bandejas?|platos?|unidades?|porciones?|combos?|arepas?|gaseosas?|jugos?|limonadas?|carnes?|mojarras?|churrascos?|ejecutivos?|almuerzos?|platanos?|broaster|fritos?)?\b/);
        if (digitMatch?.[1]) {
            const n = parseInt(digitMatch[1], 10);
            if (n >= 2 && n <= 30)
                return n;
            if (n === 1)
                return 1;
        }
        for (const [word, n] of Object.entries(wordMap)) {
            if (n < 2)
                continue;
            const re = new RegExp(`\\b${word}\\s+(?:de\\s+)?(?:pollos?|sopas?|bandejas?|platos?|unidades?|porciones?|combos?|arepas?|gaseosas?|jugos?|limonadas?|carnes?|mojarras?|churrascos?|ejecutivos?|almuerzos?|platanos?|broaster|fritos?)\\b`);
            if (re.test(q))
                return n;
        }
        for (const [word, n] of Object.entries(wordMap)) {
            if (n < 2)
                continue;
            if (new RegExp(`\\b${word}\\b`).test(q) &&
                new RegExp(FOOD_ORDER_TOKEN, 'i').test(q)) {
                return n;
            }
        }
        return 1;
    }
    extractQuantityFromMessage(text) {
        const raw = (text || '').trim();
        if (!raw)
            return 1;
        if (this.countQuantityMentions(raw) >= 2)
            return 1;
        return this.extractQuantityFromSegment(raw);
    }
    stripQuantityFromSearchQuery(text) {
        let t = text || '';
        t = t
            .replace(/\b(?:x|×)\s*\d{1,2}\b/gi, ' ')
            .replace(/\b\d{1,2}\s*(?:x|×)\b/gi, ' ')
            .replace(/\b(\d{1,2}|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\s+(?:de\s+)?/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        return t || text;
    }
    buildMenuExploreIntro(text) {
        const q = normalizeText(text);
        if (/\balmuerzo\b/.test(q)) {
            return 'Para *almorzar* tenemos varias cosas ricas.';
        }
        if (/\bcena\b/.test(q))
            return 'Para *cenar* también tenemos buenas opciones.';
        if (/\brecomiend|\bsugier|\baconsej/.test(q)) {
            return 'Con gusto te oriento.';
        }
        if (/\bno\s+se\s+que\s+(pedir|comer|ordenar)\b/.test(q)) {
            return 'Te ayudo a orientarte.';
        }
        if (/\b(comida|platos|carta)\b/.test(q)) {
            return 'Claro, tenemos varias opciones de comida.';
        }
        return 'Dale, te cuento qué manejamos.';
    }
    formatMenuCategoryOverview(products, opts) {
        const examplesPerCategory = opts?.examplesPerCategory ?? 0;
        const byCat = this.groupProductsByCategory(products);
        const categories = [...byCat.keys()];
        const lines = [];
        const menuUrl = (opts?.menuUrl || '').trim();
        if (opts?.intro) {
            lines.push(opts.intro);
        }
        if (menuUrl) {
            lines.push('', `Menú completo:\n${menuUrl}`);
        }
        if (categories.length) {
            lines.push('', 'Categorías:');
            categories.forEach((cat, idx) => {
                const list = byCat.get(cat);
                if (examplesPerCategory <= 0) {
                    lines.push(`*${idx + 1}.* ${cat}`);
                    return;
                }
                lines.push(`*${idx + 1}. ${cat}* (${list.length} ${list.length === 1 ? 'opción' : 'opciones'})`);
                for (const p of list.slice(0, examplesPerCategory)) {
                    lines.push(`   • *${p.name}* — ${this.formatMoney(p.price)}`);
                }
                if (list.length > examplesPerCategory) {
                    lines.push(`   _…y ${list.length - examplesPerCategory} más_`);
                }
            });
        }
        lines.push('', 'Escribe el *número* de categoría o el *plato*.');
        return { text: lines.join('\n').replace(/\n{3,}/g, '\n\n'), categories };
    }
    resolveCategoryBrowsePick(text, categories) {
        const raw = text.trim();
        const lower = normalizeText(raw);
        if (!lower)
            return null;
        if (this.extractQuantityFromMessage(raw) >= 2)
            return null;
        if (/\b(quiero|dame|ponme|agrega|necesito)\b/.test(lower) &&
            new RegExp(FOOD_ORDER_TOKEN, 'i').test(lower)) {
            return null;
        }
        if (/^[1-9]\d{0,2}$/.test(raw)) {
            const n = parseInt(raw, 10);
            if (n >= 1 && n <= categories.length)
                return categories[n - 1];
        }
        const NOISE = new Set([
            'quiero',
            'dame',
            'ponme',
            'agrega',
            'necesito',
            'pedir',
            'ordenar',
            'por',
            'favor',
            'porfa',
            'gracias',
            'hola',
            'buenas',
            'una',
            'uno',
            'unos',
            'unas',
            'los',
            'las',
            'del',
            'con',
            'sin',
            'para',
        ]);
        let best = null;
        for (const cat of categories) {
            const c = normalizeText(cat);
            const cs = stemLoose(cat);
            let score = 0;
            if (lower === c || lower === cs)
                score = 100;
            else if (lower.includes(c) || (c.length >= 4 && c.includes(lower)))
                score = 85;
            else if (lower.includes(cs) && cs.length >= 4)
                score = 75;
            else {
                for (const token of lower.split(' ').filter((t) => t.length >= 4 && !NOISE.has(t))) {
                    const ts = stemLoose(token);
                    if (c === token || cs === ts)
                        score = Math.max(score, 90);
                    else if (c.length >= 4 && token.length >= 4 && (c.includes(token) || token.includes(c))) {
                        const ratio = Math.min(c.length, token.length) / Math.max(c.length, token.length);
                        if (ratio >= 0.6)
                            score = Math.max(score, 70);
                    }
                }
            }
            if (score >= 70 && (!best || score > best.score))
                best = { name: cat, score };
        }
        return best?.name ?? null;
    }
    getProductById(id, products) {
        return products.find((p) => p.id === id) ?? null;
    }
    extractCodeFromMessage(text) {
        const raw = text.trim();
        if (/\b\d{1,3}\s*(?:-|a|o|\/)?\s*\d{0,3}\s*(?:minutos?|mins?|horas?|hrs?)\b/i.test(raw)) {
            return null;
        }
        if (/\b(?:en|para|dentro\s+de)\s+\d{1,3}\b/i.test(raw) && !/\b(?:codigo|código|code|#)\b/i.test(raw)) {
            return null;
        }
        const hasStreet = /\b(calle|carrera|cra|cll|av\.?|avenida|diag(?:onal)?|dg|transversal|tv)\b/i.test(raw);
        const hasStreetPlate = /#\s*\d{1,4}[a-z]?\s*-\s*\d/i.test(raw);
        if ((hasStreet && /#\s*\d/i.test(raw)) || hasStreetPlate) {
            const onlyCodigo = raw.match(/\b(?:codigo|código|code)\s*#?\s*(\d{1,4})\b/i);
            if (onlyCodigo?.[1])
                return parseInt(onlyCodigo[1], 10);
            return null;
        }
        const explicit = raw.match(/\b(?:codigo|código|code)\s*#?\s*(\d{1,4})\b/i) ||
            raw.match(/#\s*(\d{1,4})\b(?!\s*-\s*\d)/);
        if (explicit?.[1])
            return parseInt(explicit[1], 10);
        if (/^\d{1,4}$/.test(raw))
            return parseInt(raw, 10);
        return null;
    }
    extractListPickNumber(text) {
        const trimmed = text.trim();
        if (/^[1-9]\d{0,3}$/.test(trimmed))
            return parseInt(trimmed, 10);
        const labeled = trimmed.match(/^(?:opci[oó]n|la|el|numero|n[uú]mero)\s*([1-9]\d{0,2})$/i);
        if (labeled?.[1])
            return parseInt(labeled[1], 10);
        return null;
    }
    findByCode(code, products) {
        return products.find((p) => p.code === code) ?? null;
    }
    extractProductSearchQuery(text) {
        let q = fixCommonOrderTypos(text.trim());
        if (!q)
            return q;
        const paraSplit = q.match(/^(.+?)\s+\bpara\b\s+(.+)$/is);
        if (paraSplit) {
            const tail = paraSplit[2].trim();
            if (this.looksLikeDeliveryTail(tail)) {
                q = paraSplit[1].trim();
            }
        }
        q = q
            .replace(/^(hola|buenas|buenos dias|buenas tardes|buenas noches)[\s,!.-]*/i, '')
            .replace(/^(veci(?:no|na)?|amigo|amiga|parce|compadre)[\s,!.-]*/i, '')
            .replace(/^(?:para\s+)?(?:un\s+|una\s+)?domicilios?\s+(?:de\s+|con\s+|a\s+)?(?:un\s+|una\s+|unos\s+|unas\s+|el\s+|la\s+)?/i, '')
            .replace(/^(?:a\s+)?domicilio\s+(?:de\s+|con\s+)?(?:un\s+|una\s+|el\s+|la\s+)?/i, '')
            .replace(/^(me\s+puedes\s+(?:enviar|mandar|traer|dar|regalar|poner)\s+)/i, '')
            .replace(/^(puedes\s+(?:enviarme|mandarme|traerme|darme|regalarme)\s+)/i, '')
            .replace(/^(?:env[ií]ame|m[aá]ndame|tra[eé]me)\s+/i, '')
            .replace(/^(me\s+(?:regalas|das|traes|pones|mandas)\s+)/i, '')
            .replace(/^(?:reg[aá]lame|reg[aá]la)\s+/i, '')
            .replace(/^(quisiera|gustaria|deseo|necesito|dame|me das|me gustaria)[.!?,;:]*\s*/i, '')
            .replace(/^(quieor|qiero|kiero|quiiero|quero|quiero|voy a pedir|pedi|pido|pedimos|pedire)[.!?,;:]*\s*(?:(?:una|unos|unas|un|el|la|los|las)\b\s*)?/i, '')
            .replace(/^(?:para\s+)?(?:pedirte|pedir|encargarte|encargar)\s+(?:por\s+fa|porfa|por\s+favor)?\s*/i, '')
            .replace(/\s+(por favor|porfa|por\s+fa|pf|gracias)[\s!.?]*$/i, '')
            .trim();
        q = this.cleanOrderSegment(q);
        q = this.stripProductDescriptionInquiryNoise(q);
        q = this.stripProductSearchNoise(q);
        return q || fixCommonOrderTypos(text.trim());
    }
    stripProductDescriptionInquiryNoise(text) {
        let cleaned = (text || '')
            .replace(/\b(?:con\s+qu[eé]|de\s+qu[eé]|qu[eé])\s+(?:viene|vienen|va|van|trae|traen|lleva|llava|incluye|incluyen|contiene|contienen|tiene|tienen|acompa[nñ]a)\s+(?:el|la|los|las|una|un|unos|unas)?\s*/gi, ' ')
            .replace(/\b(?:como|c[oó]mo)\s+(?:viene|va|es)\s+(?:el|la|los|las|un|una)?\s*/gi, ' ')
            .replace(/\b(?:qu[eé]|cu[aá]les)\s+(?:ingredientes|componentes)\s+(?:tiene|trae|lleva)\s+(?:el|la|los|las)?\s*/gi, ' ')
            .replace(/\b(?:me\s+)?(?:puedes\s+)?(?:decir|contar|explicar)\s+(?:qu[eé]|con\s+qu[eé])\s+(?:viene|va|trae|lleva)\s+(?:el|la)?\s*/gi, ' ')
            .replace(/\b(?:de\s+)?cu[aá]ntos\s+gramos\s+(?:es|tiene|trae|pesa)?\s*(?:el|la|los|las|un|una)?\s*/gi, ' ')
            .replace(/\b(?:para\s+)?cu[aá]nt[oa]s?\s+personas?\s+(?:alcanza|alcanzan|rinde|rinden|sirve|sirven|allcanza)?\s*/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        return cleaned;
    }
    extractHowItIsQualifier(text) {
        const q = normalizeText(text || '');
        const m = q.match(/\bcomo es(?:\s+con)?\s+(.+)$/);
        if (!m?.[1])
            return null;
        const qual = m[1]
            .replace(/\b(el|la|los|las|un|una|de|del)\b/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (!qual || qual.length < 3)
            return null;
        return qual;
    }
    variantsMatchingQualifier(focus, qualifier, products) {
        const family = this.findProductVariantFamily(focus.name, products, [focus]);
        const pool = family?.variants?.length ? family.variants : [focus];
        const q = normalizeText(qualifier);
        const tokens = q.split(' ').filter((t) => t.length >= 4);
        const matched = pool.filter((p) => {
            const name = normalizeText(p.name);
            if (q && name.includes(q))
                return true;
            return tokens.length > 0 && tokens.every((t) => name.includes(t));
        });
        return matched;
    }
    stripProductSearchNoise(query) {
        return this.stripMentionedPriceFromQuery(query)
            .replace(/\s+con\s+(?:la\s+|el\s+|las?\s+|una\s+)?(?:gaseosa\s+(?:de\s+)?)?(?:manzana|coca\s*cola?|cola|sprite|pepsi|uva|postobon|postob[oó]n|litro\s*personal|personal|limonada|hit|mr\s*tea|cysco|agua|fresa|naranja|maracuya|maracuy[aá]|mango|poker|costena|coste[nñ]a)[\w\s]*/gi, '')
            .replace(/^combo\s+de\s+/i, '')
            .replace(/^combo\s+/i, '')
            .replace(/\s+de\s+combo\b/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
    }
    cleanOrderSegment(segment) {
        return segment
            .replace(/^(veci(?:no|na)?|amigo|amiga|parce|compadre)[\s,!.-]*/i, '')
            .replace(/^(me\s+puedes\s+(?:enviar|mandar|traer|dar|regalar|poner)\s+)/i, '')
            .replace(/^(puedes\s+(?:enviarme|mandarme|traerme|darme|regalarme)\s+)/i, '')
            .replace(/^(?:env[ií]ame|m[aá]ndame|tra[eé]me)\s+/i, '')
            .replace(/^(me\s+(?:regalas|das|traes|pones|mandas)\s+)/i, '')
            .replace(/^(?:reg[aá]lame|reg[aá]la)\s+/i, '')
            .replace(/^(?:para\s+)?(?:pedirte|pedir|encargarte|encargar)\s+(?:por\s+fa|porfa|por\s+favor)?\s*/i, '')
            .replace(/^(?:pedi|pido|pedimos|quiero|dame|ponme)\s+/i, '')
            .replace(/^(?:un|una|unos|unas|el|la|los|las)\s+/i, '')
            .replace(/\b(?:veci(?:no|na)?|amigo|amiga|parce)\s+(?:me\s+)?(?:puedes|podes|podrias)\s+(?:enviar|mandar|traer|dar|regalar|poner)\b/gi, ' ')
            .replace(/\bme\s+(?:puedes|podes|podrias)\s+(?:enviar|mandar|traer|dar|regalar|poner)\b/gi, ' ')
            .replace(/\bde\s+con\b/gi, 'con')
            .replace(/\s+(por\s+favor|porfavor|porfa|por\s+fa|pf|gracias)[\s!.?]*$/i, '')
            .replace(/\s+/g, ' ')
            .trim();
    }
    isPolitenessOnlySegment(segment) {
        const raw = (segment || '').trim();
        if (!raw)
            return true;
        let n = normalizeText(raw);
        if (!n)
            return true;
        if (/\b(pollo|pechuga|mojarra|mojarras|arroz|sopa|bandeja|alitas?|alas?\b|churrasco|costilla|hamburguesa|limonada|gaseosa|ajiaco|broaster|plancha|frito|asado|platano|papa|papas|yuca|mondongo|sobrebarriga|ejecutivo|combo|codigo|menu|trucha|bagre|pescado)\b/.test(n)) {
            return false;
        }
        if (/\d/.test(n) && /\b(codigo|#)\b/.test(n))
            return false;
        n = n
            .replace(/\b(veci(?:no|na)?|amigo|amiga|parce|compadre|por\s+favor|porfa|por\s+fa|pf|gracias|pedirte|pedir|encargar|encargarte|para|fa|me|te|le|nos|puedes|puede|podes|podrias|podria|enviar|enviarme|mandar|mandarme|traer|traerme|dar|darme|regalar|regalarme|regala|poner|ponerme|das|regalas|traes|pones|mandas|vendes|venden|vendeme|vendame|vender|hola|buenas|tardes|noches|dias|ok|okay|entonces|listo|bueno)\b/g, ' ')
            .replace(/[!.?,;:]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        return !n || n.length < 3 || ORDER_INTENT_ONLY.has(n);
    }
    isPendingOrderCorrection(text) {
        const q = normalizeText(text || '');
        if (!q)
            return false;
        if (/\b(me\s+falto|te\s+falto|se\s+te\s+olvido|faltaron|falto)\b/.test(q))
            return true;
        return /\b(eran|son|era)\s+(?:\d{1,2}|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b/.test(q);
    }
    orderCorrectionClauses(text) {
        if (!this.isPendingOrderCorrection(text))
            return [];
        const parts = normalizeText(text)
            .split(/\s+\by\b\s+/)
            .map((p) => p
            .replace(/^(?:me\s+falto|te\s+falto|se\s+te\s+olvido|faltaron|falto)\s+/, '')
            .replace(/^(?:la|el|los|las|un|una|unos|unas)\s+/, '')
            .trim())
            .filter((p) => p.length >= 3);
        return parts.map((p) => {
            const dish = this.stripQuantityFromSearchQuery(p)
                .replace(/^(?:eran|son|era)\s+/, '')
                .replace(/^(?:la|el|los|las|un|una)\s+/, '')
                .trim();
            return {
                quantity: Math.max(1, this.extractQuantityFromSegment(p)),
                dish: dish || p,
            };
        });
    }
    spokenDishOnMenu(segment, products) {
        return !!this.resolveSpokenDish(segment, products);
    }
    resolveSpokenDish(segment, products) {
        const q = normalizeText(segment || '');
        if (!q || q.length < 4)
            return null;
        const scored = this.searchByNameScored(q, products, 3);
        const aligned = scored.find((s) => this.spokenCandidateCoversClause(s.p, q));
        if (aligned)
            return aligned.p;
        const qTokens = q.split(/\s+/).filter((t) => t.length >= 6);
        if (!qTokens.length)
            return null;
        let best = null;
        for (const p of products) {
            if (p.availableNow === false)
                continue;
            for (const raw of normalizeText(p.name).split(/\s+/)) {
                const nameTok = singularizeEsToken(raw);
                if (nameTok.length < 6)
                    continue;
                for (const qt of qTokens) {
                    const queryTok = singularizeEsToken(qt);
                    const transposed = queryTok.slice(0, 3) === nameTok.slice(0, 3) &&
                        isAdjacentTransposition(queryTok, nameTok);
                    if (queryTok.slice(0, 4) !== nameTok.slice(0, 4) && !transposed)
                        continue;
                    const dist = tokenEditDistance(queryTok, nameTok);
                    if (dist > 2)
                        continue;
                    if (!this.spokenCandidateCoversClause(p, q))
                        continue;
                    if (!best || dist < best.dist)
                        best = { p, dist };
                }
            }
        }
        return best?.p || null;
    }
    followUpDishClaim(text, unresolved = []) {
        const q = normalizeText(text || '');
        if (!q || q.length < 5)
            return null;
        const stop = new Set([
            'menu', 'carta', 'tiene', 'tienen', 'tienes', 'tengo', 'esta', 'estan',
            'visto', 'vimos', 'donde', 'porque', 'estaba', 'dice', 'sale', 'salió',
            'seguro', 'claro', 'bueno',
        ]);
        const tokens = q.split(' ').filter((t) => t.length >= 5 && !stop.has(t));
        if (!tokens.length)
            return null;
        for (const miss of unresolved) {
            const missTokens = normalizeText(miss).split(' ').filter((t) => t.length >= 4);
            const hit = missTokens.some((mt) => tokens.some((tok) => fuzzyTokenMatch(tok, mt) ||
                fuzzyTokenMatch(tok, singularizeEsToken(mt)) ||
                (tok.length >= 5 && mt.length >= 5 && (tok.includes(mt) || mt.includes(tok)))));
            if (hit)
                return miss.trim();
        }
        return null;
    }
    productByDishMention(claim, products) {
        const spoken = this.resolveSpokenDish(claim, products);
        if (spoken)
            return spoken;
        const tokens = normalizeText(claim)
            .split(' ')
            .filter((t) => t.length >= 5);
        if (!tokens.length)
            return null;
        const hits = products.filter((p) => {
            if (p.availableNow === false)
                return false;
            const words = normalizeText(`${p.name} ${p.description || ''}`)
                .split(' ')
                .filter((w) => w.length >= 5);
            return tokens.every((tok) => words.some((w) => fuzzyTokenMatch(tok, w) ||
                fuzzyTokenMatch(tok, singularizeEsToken(w)) ||
                (tok.length >= 5 && w.length >= 5 && (w.includes(tok) || tok.includes(w)))));
        });
        return hits.length === 1 ? hits[0] : null;
    }
    menuNameMatchesDishQuery(productName, dish) {
        const pn = normalizeText(productName);
        const q = normalizeText(dish);
        if (!pn || !q)
            return false;
        if (pn.includes(q) || q.includes(singularizeEsToken(pn)) || pn.includes(singularizeEsToken(q))) {
            return true;
        }
        const qTokens = q.split(/\s+/).filter((t) => t.length >= 4);
        const pTokens = pn.split(/\s+/).filter((t) => t.length >= 4);
        return qTokens.some((qt) => pTokens.some((pt) => fuzzyTokenMatch(qt, pt) ||
            fuzzyTokenMatch(singularizeEsToken(qt), singularizeEsToken(pt)) ||
            (qt.slice(0, 4) === pt.slice(0, 4) &&
                tokenEditDistance(singularizeEsToken(qt), singularizeEsToken(pt)) <= 2)));
    }
    looksLikePersonNameSegment(segment) {
        const raw = (segment || '').trim();
        if (!raw || raw.length > 40)
            return false;
        let t = normalizeText(raw);
        if (!t || /\d/.test(t))
            return false;
        t = t.replace(/\bser[ií]a\b/g, ' ').replace(/\s+/g, ' ').trim();
        if (!t)
            return false;
        if (/\b(pollo|arroz|sopa|bandeja|mojarras?|bebida|gaseosa|limonada|arepa|papa|combo|broaster|frito|asado|pechuga|alitas?|churrascos?|costilla|ajiaco|mondongo|sancocho|menudencias?|chino|sobrebarriga|ejecutivo|hamburguesa|costillas?|domicilio|calle|carrera|quiero|necesito|pido|pedi|regalame|dame|ponme|pedido|orden|para|hacer|pedir|ordenar|cambia|cambiar|direccion|dirección|tres|dos|cuatro|cinco|seis|siete|ocho|nueve|diez|unos?|unas?|plancha|gratinada|horno|apanad[oa])\b/.test(t)) {
            return false;
        }
        if (COOKING_STYLE_TOKENS.has(t) || [...COOKING_STYLE_TOKENS].some((st) => t === st)) {
            return false;
        }
        const words = t.split(/\s+/).filter(Boolean);
        if (words.length < 1 || words.length > 3)
            return false;
        if (words.some((w) => w.length < 2))
            return false;
        if (!/^[a-z]+(?:\s+[a-z]+){0,2}$/.test(t))
            return false;
        return true;
    }
    WEAK_PRODUCT_TOKENS = new Set([
        'pollo',
        'carne',
        'arroz',
        'sopa',
        'bebida',
        'bebidas',
        'gaseosa',
        'gaseosas',
        'combo',
        'solo',
        'medio',
        'cuarto',
        'entero',
        'porcion',
        'porciones',
        'plato',
        'orden',
        ...COOKING_STYLE_TOKENS,
    ]);
    isDistinctiveProductToken(token) {
        const t = normalizeText(token);
        if (t.length < 5)
            return false;
        if (this.WEAK_PRODUCT_TOKENS.has(t))
            return false;
        if (COOKING_STYLE_TOKENS.has(t))
            return false;
        if (PACK_MULTIPLIER_TOKENS.has(t))
            return false;
        return true;
    }
    missingDishQualifiers(query, products) {
        const stripped = this.stripAvailabilityInquiryNoise(this.extractProductSearchQuery(query) || query);
        const q = normalizeText(stripped);
        const foodToken = new RegExp(`^${FOOD_ORDER_TOKEN}$`, 'i');
        const tokens = [
            ...new Set(q
                .split(/\s+/)
                .filter((t) => foodToken.test(t) &&
                this.isDistinctiveProductToken(t) &&
                !this.SIDE_NOTE_TOKENS.has(t) &&
                !this.SIDE_NOTE_TOKENS.has(singularizeEsToken(t)))),
        ];
        if (!tokens.length || !products.length)
            return [];
        return tokens.filter((t) => !products.some((p) => this.queryHasToken(normalizeText(p.name), t)));
    }
    uncoveredDishWords(query, products) {
        if (!products.length)
            return [];
        const leftover = [];
        const unknown = [];
        let anchored = false;
        for (const tokens of this.dishClauses(query)) {
            const best = this.bestClauseCoverage(tokens, products);
            if (!best)
                unknown.push(...tokens);
            else {
                anchored = true;
                leftover.push(...best.leftover);
            }
        }
        if (!anchored)
            return [];
        return [...new Set([...leftover, ...unknown])];
    }
    uncoveredWordsAgainstOffers(query, products) {
        if (!products.length)
            return [];
        const leftover = [];
        const unknown = [];
        let anchored = false;
        for (const tokens of this.dishClauses(query)) {
            const best = this.bestClauseCoverage(tokens, products, { includeDescription: true });
            if (!best)
                unknown.push(...tokens);
            else {
                anchored = true;
                leftover.push(...best.leftover);
            }
        }
        if (!anchored)
            return [];
        return [...new Set([...leftover, ...unknown])];
    }
    leftoverFoodWords(query, product) {
        const discourse = new Set([
            'pero',
            'cambia',
            'cambiar',
            'cambiame',
            'cambiale',
            'cambialo',
            'cambiala',
            'entonces',
            'quiero',
            'porque',
            'favor',
            'porfa',
        ]);
        return this.uncoveredWordsAgainstOffers(query, [product])
            .map((t) => normalizeText(t))
            .filter((t) => t.length >= 5 && !discourse.has(t));
    }
    spokenCandidateCoversClause(product, query) {
        return (this.productNameFitsUtterance(product, query) &&
            this.leftoverFoodWords(query, product).length === 0);
    }
    formatWeDontOfferPreface(askedLabel, alternativeCount) {
        const label = (askedLabel || '')
            .replace(/[¿?¡!.]+$/g, '')
            .replace(/\s+/g, ' ')
            .trim() || 'eso';
        const offer = alternativeCount > 1
            ? 'Te ofrecemos estas alternativas:'
            : 'Te ofrecemos esta alternativa:';
        return `No te ofrecemos *${label}* en el momento.\n${offer}\n\n`;
    }
    uncoveredWordsAnchoredByProduct(query, product, products) {
        const dishQuery = this.stripOrderMetadata(query, product);
        const out = [];
        for (const tokens of this.dishClauses(dishQuery)) {
            const anchor = products?.length ? this.bestClauseCoverage(tokens, products) : null;
            if (anchor && !anchor.products.some(p => p.id === product.id))
                continue;
            const best = this.bestClauseCoverage(tokens, [product]);
            if (best)
                out.push(...best.leftover);
        }
        return [...new Set(out)];
    }
    stripOrderMetadata(query, product) {
        let dishQuery = query.replace(/\bpara\s+llevar\b|\b(?:paso|voy)\s+a\s+recoger\b/gi, ' ');
        if (/\bsopa\b/i.test(product.name) &&
            this.detectServingSizeHint(query) === 'grande' &&
            !/peque[nñ]a/i.test(product.name)) {
            dishQuery = dishQuery.replace(/\bgrandes?\b/gi, ' ');
        }
        const volume = this.extractRequestedDrinkVolumeMl(query);
        if (volume && this.isLikelyDrinkProduct(product) &&
            volume === this.productDrinkVolumeMl(product)) {
            dishQuery = dishQuery.replace(/\b(?:un\s+)?litro\s+y\s+medi[oa]\b/gi, ' ')
                .replace(/\b\d+(?:[.,]\d+)?\s*(?:ml|cc|l|lt|lts|litros?)\b/gi, ' ');
        }
        return dishQuery;
    }
    orderSegmentForProduct(text, product, products, selected) {
        text = (0, whatsapp_distributed_variants_1.expandDistributedVariants)(text, products, this);
        const clauses = text.split(/;\s*|\.\s+|\r?\n+/).filter(Boolean);
        const explicitSegments = clauses.flatMap(clause => clause.split(/(?:\s+y\s+|,\s*)(?=(?:(?:aparte|adem[aá]s)\s+)?(?:otr[oa]s?|un[oa]?s?|\d+|dos|tres|cuatro|cinco)\b)|\s+con\s+(?=(?:un[oa]?|\d+|dos|tres|cuatro|cinco)\s+porci[oó]n(?:es)?\b)/i));
        const segments = explicitSegments.length > 1 ? explicitSegments : this.splitMultiProductSegments(text);
        if (segments.length < 2)
            return text;
        const swap = this.swapIntent(text);
        if (explicitSegments.length === 1 && swap && this.productCarriesMention(product, swap.removed) &&
            !segments.some(segment => {
                const other = this.findProductEmbeddedInMessage(segment, products);
                return other && other.id !== product.id && !this.isLikelySideOnlyProduct(other);
            }))
            return text;
        if (explicitSegments.length === 1 && segments.slice(1).every(segment => !/\b(extra|adicional|porcion)\b/i.test(segment) &&
            (product.attributes?.some(attr => this.pickAttributeOptionFromText(segment, attr)) ||
                /^arepas?\s+aparte\b/.test(normalizeText(segment)))))
            return text;
        const named = segments.filter(segment => this.productNameFitsUtterance(product, segment));
        if (named.length === 1) {
            const following = [];
            for (const segment of segments.slice(segments.indexOf(named[0]) + 1)) {
                const q = normalizeText(segment).replace(/^(?:el|la|las|los|sus)\s+/, '');
                if (!/\b(?:aparte|bolsa|empaque)\b/.test(q) ||
                    !product.attributes?.some(attr => q.startsWith(normalizeText(attr.attributeName) + ' ')))
                    break;
                following.push(segment);
            }
            if (following.length)
                return [named[0], ...following].join('. ');
        }
        const owned = segments.filter(segment => {
            const tokens = this.dishContentTokens(normalizeText(segment));
            const anchor = this.bestClauseCoverage(tokens, products);
            return anchor?.products.some(p => p.id === product.id);
        });
        if (selected?.length) {
            const matching = [...new Set([...named, ...owned])].filter(segment => {
                const parsed = this.resolveAttributesFromMessage(product, segment, []);
                return parsed.status !== 'invalid' && parsed.attributes.length > 0 && parsed.attributes.every(a => selected.some(choice => normalizeText(a.attributeName) === normalizeText(choice.attributeName) &&
                    normalizeText(a.attributeValue) === normalizeText(choice.attributeValue)));
            });
            if (matching.length === 1)
                return matching[0];
        }
        if (named.length === 1)
            return named[0];
        if (owned.length === 1)
            return owned[0];
        return text;
    }
    dishClauses(query) {
        const raw = this.stripAvailabilityInquiryNoise(this.extractProductSearchQuery(query) || query);
        const withoutAddress = (0, whatsapp_compound_parse_1.splitTrailingEmbeddedAddress)(raw)?.productText || raw;
        const clauses = withoutAddress
            .split(/\s*[,;]\s*|\.\s+|\s+y\s+|\r?\n/)
            .map((s) => normalizeText(s).trim())
            .filter(Boolean);
        return (clauses.length ? clauses : [normalizeText(withoutAddress)])
            .map((clause) => this.dishContentTokens(clause))
            .filter((tokens) => tokens.length > 0);
    }
    dishContentTokens(clause) {
        const skip = new Set([
            'con',
            'de',
            'del',
            'las',
            'los',
            'una',
            'uno',
            'unos',
            'unas',
            'por',
            'para',
            'favor',
            'porfa',
            'aparte',
            'bolsa',
            'empaque',
            'adicional',
            'adicionales',
            'ademas',
            'mas',
            'que',
            'sus',
            'tambien',
            'medio',
            'media',
            'cuarto',
            'cuarta',
            'entero',
            'entera',
            'hay',
            'tienes',
            'tiene',
            'tienen',
            'venden',
            'vendes',
            'manejan',
            'maneja',
            'consiguen',
            'cual',
            'cuales',
            'pueden',
            'hacer',
            'total',
            'sean',
            'son',
            'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez',
            'deja', 'dejen', 'dejar', 'solo', 'mejor', 'cambialos', 'cambialo', 'cambia',
            'cambies', 'iguales', 'igual', 'conserva', 'mantiene', 'queden', 'quede',
            'ponle', 'otro', 'otra', 'dejalo', 'normal', 'iba', 'quitale', 'nota',
            'agrega', 'agregar', 'regalame', 'quiero', 'dame', 'grande', 'pequena', 'pequeno',
        ]);
        const cleaned = clause.replace(/\bsin\s+[a-z0-9]{3,}\b/g, ' ');
        const glueBases = ['de', 'del', 'la', 'el', 'las', 'los', 'una', 'con'];
        return [
            ...new Set(cleaned.split(/\s+/).filter((t) => {
                if (t.length < 3 || skip.has(t) || isBottleSizeToken(t))
                    return false;
                if (t.length <= 4 &&
                    glueBases.some((base) => base !== t && tokenEditDistance(t, base) <= 1)) {
                    return false;
                }
                return true;
            })),
        ];
    }
    productsAnchoringDish(query, products) {
        const out = [];
        const seen = new Set();
        for (const tokens of this.dishClauses(query)) {
            const best = this.bestClauseCoverage(tokens, products);
            for (const product of best?.products || []) {
                if (seen.has(product.id))
                    continue;
                seen.add(product.id);
                out.push(product);
                if (out.length >= 8)
                    return out;
            }
        }
        return out;
    }
    bestClauseCoverage(tokens, products, opts) {
        let best = null;
        for (const product of products) {
            const covered = tokens.map((t) => this.productTextCoversToken(product, t, opts));
            const first = covered.findIndex(Boolean);
            if (first < 0)
                continue;
            const coveredCount = covered.filter(Boolean).length;
            const leftover = tokens.filter((t, i) => i > first && !covered[i]);
            const better = best == null ||
                coveredCount > best.coveredCount ||
                (coveredCount === best.coveredCount && first < best.first) ||
                (coveredCount === best.coveredCount &&
                    first === best.first &&
                    leftover.length < best.leftover.length);
            const same = !!best &&
                coveredCount === best.coveredCount &&
                first === best.first &&
                leftover.length === best.leftover.length;
            if (better)
                best = { coveredCount, first, leftover, products: [product] };
            else if (same && best)
                best.products.push(product);
        }
        return best ? { leftover: best.leftover, products: best.products } : null;
    }
    productTextCoversToken(product, token, opts) {
        const parts = [product.name];
        if (opts?.includeDescription && product.description)
            parts.push(product.description);
        for (const attr of product.attributes || []) {
            if (opts?.ignoreDrinkOptions &&
                !this.isLikelyDrinkProduct(product) &&
                this.isComboOnlyAttribute(attr)) {
                continue;
            }
            parts.push(attr.attributeName);
            parts.push(...(attr.options || []));
        }
        const blob = normalizeText(parts.join(' '));
        if (this.queryHasToken(blob, token))
            return true;
        if (blob.split(/\s+/).some((w) => nearDishToken(token, w)))
            return true;
        const style = singularizeEsToken(token);
        if (COOKING_STYLE_TOKENS.has(style) || COOKING_STYLE_TOKENS.has(normalizeText(token))) {
            return productOffersCookingStyle(product, token);
        }
        return false;
    }
    productNameHasPackMultiplier(name) {
        const n = normalizeText(name);
        if (!n)
            return false;
        if (PACK_MULTIPLIER_TOKENS.has(n.split(/\s+/)[0] || ''))
            return true;
        return [...PACK_MULTIPLIER_TOKENS].some((t) => this.queryHasToken(n, t));
    }
    queryAsksForPackMultiplier(text) {
        const q = normalizeText(fixCommonOrderTypos(text || ''));
        if (!q)
            return false;
        return [...PACK_MULTIPLIER_TOKENS].some((t) => this.queryHasToken(q, t));
    }
    queryHasToken(q, token) {
        const t = normalizeText(token);
        const sing = singularizeEsToken(t);
        const words = q.split(/\s+/).filter(Boolean);
        const similarLen = (a, b) => {
            if (a.length < 5 || b.length < 5)
                return false;
            return Math.min(a.length, b.length) / Math.max(a.length, b.length) >= 0.75;
        };
        for (const w of words) {
            const ws = singularizeEsToken(w);
            if (w === t || ws === sing || w === sing || ws === t)
                return true;
            if (t.length <= 4 || w.length <= 4)
                continue;
            if (similarLen(t, w) && (w.includes(t) || t.includes(w)))
                return true;
            if (similarLen(sing, ws) && (ws.includes(sing) || sing.includes(ws)))
                return true;
        }
        return false;
    }
    dishTextBeforeSwap(text) {
        const raw = (text || '').trim();
        const cut = raw.split(/\b(?:pero\s+)?cambia/i)[0]?.trim() || raw;
        const parts = cut
            .split(/\s*,\s*|\s+\by\b\s+/i)
            .map((s) => s.trim())
            .filter((s) => s.length >= 3);
        return parts[parts.length - 1] || cut;
    }
    productCarriesMention(product, phrase) {
        const skip = new Set(['para', 'por', 'una', 'uno', 'unas', 'unos', 'con', 'del']);
        const tokens = normalizeText(phrase)
            .split(/\s+/)
            .map((t) => singularizeEsToken(t))
            .filter((t) => t.length >= 4 && !skip.has(t));
        if (!tokens.length)
            return false;
        const parts = [product.description || ''];
        for (const attr of product.attributes || []) {
            parts.push(attr.attributeName || '');
            parts.push(...(attr.options || []));
        }
        const blob = normalizeText(parts.join(' '));
        const words = blob.split(/\s+/).filter(Boolean);
        const mentioned = tokens.every((t) => this.queryHasToken(blob, t) || words.some((w) => nearDishToken(t, w) || nearDishToken(w, t)));
        if (mentioned)
            return true;
        const asksDrink = tokens.some((t) => /^(gaseosa|bebida|refresco|jugo|limonada)$/.test(t));
        return asksDrink && (product.attributes || []).some((a) => this.isComboOnlyAttribute(a));
    }
    swapChangeNote(removed, added) {
        const trimLead = (s) => s.replace(/^(?:la|el|las|los|una|un|unas|unos|de)\s+/i, '').trim();
        return `Sin ${trimLead(removed)}; cambio por ${trimLead(added)}`.slice(0, 200);
    }
    productsForSwapAddition(added, products) {
        const skip = new Set(['porcion', 'porciones', 'una', 'uno']);
        const tokens = normalizeText(added)
            .split(/\s+/)
            .map((t) => singularizeEsToken(t))
            .filter((t) => t.length >= 4 && !skip.has(t));
        if (!tokens.length)
            return [];
        return products.filter((p) => {
            if (p.availableNow === false)
                return false;
            const words = normalizeText(p.name)
                .split(/\s+/)
                .map((w) => singularizeEsToken(w));
            return tokens.every((t) => words.some((w) => w === t || nearDishToken(t, w)));
        });
    }
    mostSpecificNamedProduct(text, products) {
        const q = (text || '').trim();
        const generic = new Set(['pollo', 'carne', 'arroz', 'sopa', 'bebida', 'gaseosa', 'natural']);
        const weight = (p) => normalizeText(p.name)
            .split(/\s+/)
            .filter((t) => t.length >= 4 && !generic.has(t) && !/\d/.test(t)).length;
        const fits = products.filter((p) => p.availableNow !== false && this.spokenCandidateCoversClause(p, q));
        if (!fits.length)
            return this.resolveSpokenDish(q, products);
        return [...fits].sort((a, b) => weight(b) - weight(a) || b.name.length - a.name.length)[0];
    }
    swapRemovesDrink(text) {
        const swap = this.swapIntent(text);
        if (!swap)
            return false;
        return /\b(gaseosa|bebida|refresco|jugo|limonada)\b/.test(normalizeText(swap.removed));
    }
    looksLikeFoodPlusDrinkOrder(text) {
        if (this.swapRemovesDrink(text))
            return false;
        const q = normalizeText(fixCommonOrderTypos(text));
        if (!q || q.length < 8)
            return false;
        const hasFood = /\b(pollo|pollos|broaster|frito|asado|pechuga|alas?|ejecutivo|bandeja|costilla|churrascos?|sobrebarriga|mondongo|sopa|arroz|paisa|chino|mojarras?|platanos?|alitas?|arepas?)\b/.test(q);
        const hasDrink = /\b(gaseosa|gaseosas|coca|sprite|pepsi|jugo|jugos|limonadas?|malta|cerveza|agua|hit|postobon|postob[oó]n)\b/.test(q);
        return hasFood && hasDrink;
    }
    swapIntent(text) {
        const q = normalizeText(text || '');
        const m = q.match(/\bcambia(?:r|me|le|les|melo|melas)?\s+(.+?)\s+\bpor\b\s+(.+)/);
        if (!m?.[1] || !m?.[2])
            return null;
        const added = m[2].split(/\s*,\s*|\s+\by\b\s+|\s+pero\b/)[0].trim();
        const removed = m[1].trim();
        if (removed.length < 3 || added.length < 3)
            return null;
        return { removed, added };
    }
    dishSpecificTokens(name) {
        const generic = new Set(['pollo', 'carne', 'arroz', 'sopa', 'bebida', 'gaseosa', 'natural']);
        return normalizeText(name)
            .split(/\s+/)
            .filter((t) => t.length >= 4 && !generic.has(t) && !/\d/.test(t));
    }
    isLooserSameDish(looser, host) {
        if (looser.id === host.id)
            return false;
        const a = this.dishSpecificTokens(looser.name);
        const b = this.dishSpecificTokens(host.name);
        if (!a.length || a.length >= b.length)
            return false;
        return a.every((t) => b.some((h) => h === t || nearDishToken(t, h)));
    }
    askedForOneComboEach(text) {
        const q = normalizeText(text || '');
        const styles = ['frito', 'broaster'].filter((style) => new RegExp(`\\b${style}\\b`).test(q));
        return /\b(los dos|ambas|ambos)\b/.test(q) && /\bcombo\b/.test(q) && styles.length >= 2;
    }
    keepCombosWhenBothRequested(text, products, kept) {
        if (!this.askedForOneComboEach(text))
            return kept;
        const q = normalizeText(text || '');
        const styles = ['frito', 'broaster'].filter((style) => new RegExp(`\\b${style}\\b`).test(q));
        const next = kept.map((item) => ({ ...item }));
        const drop = new Set();
        for (const style of styles) {
            const combo = products.find((p) => {
                const name = normalizeText(p.name);
                return (p.availableNow !== false &&
                    /\bcombo\b/.test(name) &&
                    new RegExp(`\\b${style}\\b`).test(name) &&
                    !/\b(ejecutivo|bandeja)\b/.test(name));
            });
            if (!combo)
                continue;
            const loose = [];
            const comboIdx = [];
            next.forEach((item, i) => {
                if (drop.has(i))
                    return;
                const product = products.find((p) => p.id === item.productId);
                if (!product)
                    return;
                if (product.id === combo.id)
                    comboIdx.push(i);
                else if (this.isLooserSameDish(product, combo))
                    loose.push(i);
            });
            if (comboIdx.length) {
                next[comboIdx[0]] = { ...next[comboIdx[0]], quantity: 1 };
                for (const i of comboIdx.slice(1))
                    drop.add(i);
                for (const i of loose)
                    drop.add(i);
            }
            else if (loose.length) {
                next[loose[0]] = { ...next[loose[0]], productId: combo.id, quantity: 1 };
                for (const i of loose.slice(1))
                    drop.add(i);
            }
            else {
                next.push({ productId: combo.id, quantity: 1 });
            }
        }
        return next.filter((_, i) => !drop.has(i));
    }
    nameMentionedInText(name, text) {
        const words = normalizeText(text).split(/\s+/).filter(Boolean);
        return this.dishSpecificTokens(name).some((t) => words.some((w) => w === t || nearDishToken(w, t)));
    }
    productNameFitsUtterance(product, text) {
        const utter = normalizeText(text || '');
        const words = utter.split(/\s+/).filter((w) => w.length >= 4);
        const generic = new Set(['pollo', 'carne', 'arroz', 'sopa', 'bebida', 'gaseosa', 'natural']);
        const nameTokens = normalizeText(product.name)
            .split(/\s+/)
            .filter((t) => t.length >= 4 && !/\d/.test(t) && !generic.has(t));
        if (!nameTokens.length)
            return true;
        return nameTokens.every((tok) => words.some((w) => nearDishToken(w, tok)));
    }
    similarNamedProducts(text, products) {
        const asked = normalizeText(this.extractProductSearchQuery(text) || text);
        if (!asked)
            return [];
        if (products.some((p) => p.availableNow !== false && this.productNameFitsUtterance(p, asked))) {
            return [];
        }
        const generic = new Set(['pollo', 'carne', 'arroz', 'sopa', 'bebida', 'gaseosa', 'natural']);
        const tokens = this.dishContentTokens(asked).filter((t) => t.length >= 4 && !generic.has(t));
        if (!tokens.length)
            return [];
        const hits = [];
        for (const product of products) {
            if (product.availableNow === false)
                continue;
            const nameWords = normalizeText(product.name).split(/\s+/).filter(Boolean);
            const head = nameWords.find((w) => w.length >= 4 &&
                !generic.has(w) &&
                !COOKING_STYLE_TOKENS.has(w) &&
                !/\d/.test(w));
            if (!head)
                continue;
            const saidHead = tokens.some((t) => t === head || nearDishToken(t, head));
            if (saidHead)
                continue;
            const sharesOtherWord = tokens.some((t) => nameWords.some((w) => w !== head && w.length >= 4 && (w === t || nearDishToken(t, w))));
            if (!sharesOtherWord)
                continue;
            hits.push(product);
            if (hits.length >= 4)
                break;
        }
        return hits;
    }
    formatSimilarOfferReply(text, products) {
        const asked = (this.extractProductSearchQuery(text) || text)
            .replace(/[¿?¡!.]+$/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
        const preface = this.formatWeDontOfferPreface(asked || 'eso', products.length);
        if (products.length === 1) {
            return preface + this.formatProductPriceReply(products[0]);
        }
        const rows = products
            .map((p) => `• *${p.name}* · ${this.formatMoney(p.price)}`)
            .join('\n');
        return `${preface}${rows}\n\n_Dime cuál quieres._`;
    }
    productIsSwapRemoval(product, removed, added) {
        if (this.isLikelyDrinkProduct(product) &&
            /\b(gaseosa|bebida|refresco)\b/.test(normalizeText(removed))) {
            return true;
        }
        if (this.productNameFitsUtterance(product, added) && normalizeText(added).length >= 5) {
            const addedTokens = normalizeText(added).split(/\s+/).filter((t) => t.length >= 5);
            const name = normalizeText(product.name);
            if (addedTokens.some((t) => name.includes(t) || fuzzyTokenMatch(t, name)))
                return false;
        }
        return this.productNameFitsUtterance(product, removed) && !this.productNameFitsUtterance(product, added);
    }
    wantsSeparateDrink(text) {
        return /\b(aparte|adicional(?:mente)?|por separado|suelt[ao]s?)\b/i.test(normalizeText(text || ''));
    }
    drinkTextMatchesAttribute(product, drinkText) {
        if (!drinkText?.trim() || this.wantsSeparateDrink(drinkText))
            return null;
        const attrs = product.attributes || [];
        const hostsDrink = attrs.some((a) => this.isComboOnlyAttribute(a)) &&
            (attrs.some((a) => !this.isComboOnlyAttribute(a)) || /\bcombo\b/i.test(product.name));
        if (!hostsDrink)
            return null;
        for (const attr of attrs) {
            if (!this.isComboOnlyAttribute(attr))
                continue;
            const picked = this.pickAttributeOptionFromText(drinkText, attr);
            if (picked)
                return { attributeName: attr.attributeName, attributeValue: picked };
        }
        return null;
    }
    hostedMenuDrink(text, products) {
        const raw = (text || '').trim();
        if (!raw || this.wantsSeparateDrink(raw) || this.swapRemovesDrink(raw))
            return null;
        const hosts = this.findAllProductsEmbeddedInMessage(raw, products).filter((p) => !this.isLikelyDrinkProduct(p) && this.drinkTextMatchesAttribute(p, raw));
        const host = hosts[0];
        if (!host)
            return null;
        const fromMsg = this.resolveAttributesFromMessage(host, raw, []);
        const selected = fromMsg.status === 'complete' || fromMsg.status === 'partial' ? fromMsg.attributes : [];
        return { product: host, attributes: this.fillDefaultAttributes(host, selected) };
    }
    cartDrinkClarification(text, cart, products) {
        const q = normalizeText(text || '');
        if (!q || !cart.length || this.wantsSeparateDrink(text))
            return null;
        for (let i = cart.length - 1; i >= 0; i--) {
            const line = cart[i];
            const product = products.find((p) => p.id === line.productId);
            if (!product)
                continue;
            const hit = this.drinkTextMatchesAttribute(product, text);
            if (!hit)
                continue;
            const lineName = normalizeText(line.name);
            const refersToLine = (/\bcombo\b/.test(q) && /\bcombo\b/.test(lineName)) ||
                lineName
                    .split(' ')
                    .filter((t) => t.length >= 5 && !this.WEAK_PRODUCT_TOKENS.has(t))
                    .some((t) => q.includes(t));
            if (!refersToLine)
                continue;
            const current = (line.attributes || []).find((a) => normalizeText(a.attributeName) === normalizeText(hit.attributeName));
            if (current && normalizeText(current.attributeValue) === normalizeText(hit.attributeValue)) {
                continue;
            }
            return {
                cartIndex: i,
                itemName: line.name,
                attributeName: hit.attributeName,
                attributeValue: hit.attributeValue,
            };
        }
        return null;
    }
    isDrinkOnlyAccompanimentMessage(text) {
        const raw = fixCommonOrderTypos((text || '').trim());
        if (!raw || raw.length < 3)
            return false;
        const q = normalizeText(raw);
        const hasDrink = /\b(gaseosa|gaseosas|bebida|bebidas|coca|cola|sprite|pepsi|jugo|jugos|limonada|limonadas|malta|cerveza|agua|hit|postobon|postob[oó]n|colombiana|manzana)\b/.test(q);
        if (!hasDrink)
            return false;
        if (/\b(pollo|pollos|broaster|frito|asado|pechuga|ejecutivo|bandeja|costilla|churrasco|sobrebarriga|mondongo|sopa|arroz|mojarra|alitas?|hamburguesa|combo)\b/.test(q)) {
            return false;
        }
        return (/^(con|y|una?|la|el)\b/.test(q) ||
            /^(gaseosa|bebida|limonada|jugo)\b/.test(q) ||
            q.split(/\s+/).length <= 5);
    }
    detectPortionHint(text) {
        const q = normalizeText(fixCommonOrderTypos(text));
        if (/\b(medio|media)\b/.test(q))
            return 'medio';
        if (/\b(cuarto|cuarta)\b/.test(q))
            return 'cuarto';
        if (/\b(entero|entera|unidad)\b/.test(q))
            return 'entero';
        return null;
    }
    isBareChickenPortionFollowUp(text, normalized) {
        const q = normalized ?? normalizeText(fixCommonOrderTypos(text));
        if (!this.detectPortionHint(q))
            return false;
        if (/\bpollo\b/.test(q))
            return false;
        if (/\b(arroz|sopa|bandeja|costilla|pechuga|mojarra|taco|hamburguesa|ejecutivo|alitas?|chino|paisa)\b/.test(q)) {
            return false;
        }
        if (/\b(broaster|frito|asado)\b/.test(q))
            return true;
        if (this.isPriceInquiryIntent(text))
            return true;
        if (/^(?:y|tambien|también)?\s*(?:el|la|un|una)?\s*(medio|media|cuarto|cuarta|entero|entera)\b/.test(q)) {
            return true;
        }
        const tokens = q.split(/\s+/).filter(Boolean);
        return tokens.length <= 5;
    }
    detectServingSizeHint(text) {
        const q = normalizeText(text);
        if (/\b(pequenas?|pequenitas?|chicas?|chiquitas?)\b/.test(q))
            return 'pequena';
        if (/\b(grandes?|grandotas?)\b/.test(q))
            return 'grande';
        return null;
    }
    isBareServingSizeReply(text) {
        const raw = (text || '').trim();
        if (!raw || raw.length > 48)
            return false;
        const q = normalizeText(raw);
        if (!q)
            return false;
        if (/\b(calle|carrera|cra|apto|torre|conjunto|barrio|domicilio|direccion)\b/.test(q)) {
            return false;
        }
        if (/\d/.test(q))
            return false;
        const core = q
            .replace(/\b(por\s+favor|porfavor|porfa|pf|gracias|me|regala(?:s|me)?|dame|quiero|ponme|una?|unos?|unas?|el|la|los|las|de|del)\b/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        return /^(pequenas?|pequenitas?|chicas?|chiquitas?|grandes?|grandotas?)$/.test(core);
    }
    productIsSmallServing(name) {
        const n = normalizeText(name);
        return /\b(pequena|pequenas|chica|chicas)\b/.test(n);
    }
    detectProductPortionSize(name) {
        const n = normalizeText(name);
        if (/\b(arroz|bandeja|ejecutivo|menu|taco|hamburguesa)\b/.test(n)) {
            return null;
        }
        if (/\bmedio\b/.test(n) || /\b1\s*2\b/.test(n))
            return 'medio';
        if (/\bcuarto\b/.test(n) || /\b1\s*4\b/.test(n))
            return 'cuarto';
        if (/^1\s+pollo\b/.test(n))
            return 'entero';
        return null;
    }
    resolveSizedChickenProduct(text, products, opts) {
        let q = normalizeText(fixCommonOrderTypos(text));
        if (this.isBareChickenPortionFollowUp(text, q)) {
            const portion = this.detectPortionHint(q);
            const explicitStyle = q.match(/\b(?:pollo|cuarto|medio|1\s*\/\s*[24])\s+(frito|broaster|asado)\b/)?.[1] ||
                (/\bbroaster\b/.test(q) ? 'broaster' : '');
            const styleFromFocus = explicitStyle || (opts?.preferStyleFromName
                ? /\bbroaster\b/.test(normalizeText(opts.preferStyleFromName))
                    ? 'broaster'
                    : /\bfrit[oa]s?\b/.test(normalizeText(opts.preferStyleFromName))
                        ? 'frito'
                        : /\basado\b/.test(normalizeText(opts.preferStyleFromName))
                            ? 'asado'
                            : ''
                : '');
            q = normalizeText(`${portion} pollo ${styleFromFocus}`.trim());
        }
        if (!/\bpollo\b/.test(q) &&
            /\b(?:cuarto|medio|1\s*\/\s*[24])\s+(?:frito|broaster|asado)\b/.test(q)) {
            q += ' pollo';
        }
        if (!/\bpollo\b/.test(q) && !/\bbroaster\b/.test(q)) {
            return null;
        }
        if (this.isMixtoCompositionInquiry(text) ||
            this.isProductDescriptionInquiry(text) ||
            this.isDishStyleSubstitutionInquiry(text)) {
            return null;
        }
        if (/\barroz\b/.test(q) &&
            /\bcon\s+(?:un\s+|una\s+)?(?:medio|media|1\s*\/\s*2|1\/2)\s+pollo\b/.test(q) &&
            !this.looksLikeArrozComboPlusSizedChicken(text)) {
            return null;
        }
        if (/\b(combo|bandeja|ejecutivo|alitas|taco|hamburguesa|menu)\b/.test(q) &&
            !this.detectPortionHint(q)) {
            return null;
        }
        if (/\barroz\b/.test(q) && !this.detectPortionHint(q)) {
            return null;
        }
        let style = /\bbroaster\b/.test(q)
            ? 'broaster'
            : /\bfrit[oa]s?\b/.test(q)
                ? 'frito'
                : /\basado\b/.test(q)
                    ? 'asado'
                    : null;
        if (!style && opts?.preferStyleFromName) {
            const focus = normalizeText(opts.preferStyleFromName);
            if (/\bbroaster\b/.test(focus))
                style = 'broaster';
            else if (/\bfrit[oa]s?\b/.test(focus))
                style = 'frito';
            else if (/\basado\b/.test(focus))
                style = 'asado';
        }
        if (!style && !/\bpollo\b/.test(q))
            return null;
        const portionHint = this.detectPortionHint(q);
        const explicitWhole = /\b(entero|entera|unidad)\b/.test(q) || /\b1\s+pollo\b/.test(q);
        const chickenCore = q
            .replace(/\b(quiero|dame|ponme|pedir|ordenar|agrega|agregame|necesito|gustaria|quisiera|me|por|favor|un|una|unos|unas|el|la|de|del)\b/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (!style &&
            !portionHint &&
            !explicitWhole &&
            !/\b(1\s*\/\s*[24]|1\/[24])\b/.test(q) &&
            /^pollos?$/.test(chickenCore)) {
            return null;
        }
        const portion = portionHint || 'entero';
        const available = products.filter((p) => p.availableNow !== false);
        const isChickenSku = (n) => {
            if (/\b(combo|bandeja|ejecutivo|alitas|arroz|taco|hamburguesa|milensa|pechuga|menu)\b/.test(n)) {
                return false;
            }
            if (style === 'broaster' && !/\bbroaster\b/.test(n))
                return false;
            if (style === 'frito' && !/\bfrito\b/.test(n))
                return false;
            if (style === 'asado' && !/\basado\b/.test(n))
                return false;
            if (!style && !/\bpollo\b/.test(n))
                return false;
            return true;
        };
        const candidates = available.filter((p) => {
            const n = normalizeText(p.name);
            if (!isChickenSku(n))
                return false;
            const pPortion = this.detectProductPortionSize(n);
            if (pPortion === portion)
                return true;
            if (portion === 'entero' &&
                !pPortion &&
                /^pollo\s+(frito|broaster)\b/.test(n) &&
                !/\b(medio|cuarto|1\s*2|1\s*4)\b/.test(n)) {
                return true;
            }
            return false;
        });
        if (candidates.length === 1)
            return candidates[0];
        if (candidates.length > 1) {
            if (!style) {
                const styleKeys = new Set(candidates.map((p) => {
                    const n = normalizeText(p.name);
                    if (/\bmixto\b/.test(n))
                        return 'mixto';
                    if (/\bbroaster\b/.test(n))
                        return 'broaster';
                    if (/\bfrito\b/.test(n))
                        return 'frito';
                    if (/\basado\b/.test(n))
                        return 'asado';
                    return 'other';
                }));
                const real = [...styleKeys].filter((s) => s !== 'other');
                if (real.length >= 2)
                    return null;
            }
            return [...candidates].sort((a, b) => a.name.length - b.name.length)[0];
        }
        const want = portion === 'medio'
            ? style
                ? `medio pollo ${style}`
                : 'medio pollo'
            : portion === 'cuarto'
                ? style
                    ? `cuarto pollo ${style}`
                    : 'cuarto pollo'
                : style
                    ? [`1 pollo ${style}`, `pollo ${style}`]
                    : ['1 pollo', 'pollo'];
        if (Array.isArray(want)) {
            for (const w of want) {
                const exact = available.find((p) => normalizeText(p.name) === w);
                if (exact)
                    return exact;
            }
            return null;
        }
        const exact = available.find((p) => normalizeText(p.name) === want);
        return exact || null;
    }
    isEjecutivoLunchOrderPhrase(text) {
        const q = normalizeText(fixCommonOrderTypos(text || ''));
        if (!q)
            return false;
        if (/\bejecutivo\b/.test(q))
            return true;
        return (/\balmuerzo\b/.test(q) &&
            /\b(pechuga|pollo|frito|broaster|churrasco|costilla|sobrebarriga|ajiaco|mondongo|sopa)\b/.test(q));
    }
    resolveNamedMenuDishProduct(text, products) {
        if (!(0, whatsapp_named_menu_dish_1.isNamedMenuDishOrderPhrase)(text))
            return null;
        const ejecutivo = this.resolveEjecutivoOrderProduct(text, products);
        if (ejecutivo)
            return ejecutivo;
        const q = normalizeText(fixCommonOrderTypos(text));
        const available = products.filter((p) => p.availableNow !== false);
        let pool = available.filter((p) => (0, whatsapp_named_menu_dish_1.productLooksLikeNamedMenuDish)(p.name));
        if (!pool.length)
            return null;
        const wantCasa = /\bde\s+la\s+casa\b/.test(q) || (/\bcasa\b/.test(q) && /\bmenu\b/.test(q));
        const wantDia = /\bdel\s+dia\b/.test(q);
        const wantEspecial = /\bespecial(?:es)?\b/.test(q);
        const wantInfantil = /\binfantil\b/.test(q);
        const wantFamiliar = /\bfamiliar\b/.test(q);
        const wantGourmet = /\bgourmet\b/.test(q);
        const wantBandeja = /\bbandeja\b/.test(q) && !/\bmenu\b/.test(q);
        const narrowed = pool.filter((p) => {
            const n = normalizeText(p.name);
            if (wantCasa && !/\bcasa\b/.test(n))
                return false;
            if (wantDia && !/\bdia\b/.test(n))
                return false;
            if (wantEspecial && !/\bespecial\b/.test(n))
                return false;
            if (wantInfantil && !/\binfantil\b/.test(n))
                return false;
            if (wantFamiliar && !/\bfamiliar\b/.test(n))
                return false;
            if (wantGourmet && !/\bgourmet\b/.test(n))
                return false;
            if (wantBandeja && !/\bbandeja\b/.test(n))
                return false;
            return true;
        });
        if (narrowed.length)
            pool = narrowed;
        if (this.uncoveredDishWords(q, pool).length)
            return null;
        const proteinHints = [
            { re: /\bpechuga\b/, nameRe: /\bpechuga\b/ },
            { re: /\bbroaster\b/, nameRe: /\bbroaster\b/ },
            { re: /\bchurrasco\b/, nameRe: /\bchurrasco\b/ },
            { re: /\bcostilla/, nameRe: /\bcostilla/ },
            { re: /\bsobrebarriga\b/, nameRe: /\bsobrebarriga\b/ },
            { re: /\bfrito\b/, nameRe: /\bfrito\b/ },
            { re: /\basado\b/, nameRe: /\basado\b/ },
            { re: /\bpaisa\b/, nameRe: /\bpaisa\b/ },
            { re: /\bpollo\b/, nameRe: /\bpollo\b/ },
        ];
        for (const hint of proteinHints) {
            if (!hint.re.test(q))
                continue;
            const hit = pool.find((p) => hint.nameRe.test(normalizeText(p.name)));
            if (hit)
                return hit;
        }
        if (pool.length === 1)
            return pool[0];
        const scored = this.searchByNameScored(text, pool, 5);
        if (scored[0] && scored[0].score >= 40)
            return scored[0].p;
        return pool[0] || null;
    }
    resolveEjecutivoOrderProduct(text, products) {
        if (!this.isEjecutivoLunchOrderPhrase(text))
            return null;
        const q = normalizeText(fixCommonOrderTypos(text));
        const ejecutivos = products.filter((p) => p.availableNow !== false && /\bejecutivo\b/.test(normalizeText(p.name)));
        if (!ejecutivos.length)
            return null;
        const proteinHints = [
            { re: /\bpechuga\b/, nameRe: /\bpechuga\b/ },
            { re: /\bbroaster\b/, nameRe: /\bbroaster\b/ },
            { re: /\bchurrasco\b/, nameRe: /\bchurrasco\b/ },
            { re: /\bcostilla/, nameRe: /\bcostilla/ },
            { re: /\bsobrebarriga\b/, nameRe: /\bsobrebarriga\b/ },
            { re: /\bfrito\b/, nameRe: /\bfrito\b/ },
            { re: /\basado\b/, nameRe: /\basado\b/ },
            { re: /\bpollo\b/, nameRe: /\bpollo\b/ },
        ];
        for (const hint of proteinHints) {
            if (!hint.re.test(q))
                continue;
            const hit = ejecutivos.find((p) => hint.nameRe.test(normalizeText(p.name)));
            if (hit)
                return hit;
        }
        if (/\bpechuga\b/.test(q)) {
            const withPresa = ejecutivos.find((p) => (p.attributes || []).some((a) => /\b(presa|proteina|proteína|corte)\b/i.test(a.attributeName || '') &&
                (a.options || []).some((o) => /\bpechuga\b/i.test(o))));
            if (withPresa)
                return withPresa;
        }
        if (ejecutivos.length === 1)
            return ejecutivos[0];
        const withSoupAttr = ejecutivos.filter((p) => (p.attributes || []).some((a) => /\bsopa\b/i.test(a.attributeName || '')));
        const pool = /\b(sopa|ajiaco|mondongo|menudencias?)\b/.test(q) && withSoupAttr.length
            ? withSoupAttr
            : ejecutivos;
        return (pool.find((p) => /\bpollo\s+frito\b/.test(normalizeText(p.name))) ||
            pool.find((p) => /\bpollo\b/.test(normalizeText(p.name))) ||
            pool[0] ||
            null);
    }
    resolveSizedSoupProduct(text, products) {
        if (this.isEjecutivoLunchOrderPhrase(text) && /\bejecutivo\b/.test(normalizeText(text))) {
            return null;
        }
        const q = normalizeText(fixCommonOrderTypos(text));
        if (!/\b(sopas?|ajiaco|mondongo|menudencias?)\b/.test(q))
            return null;
        const size = this.detectServingSizeHint(q);
        if (!size)
            return null;
        const available = products.filter((p) => p.availableNow !== false);
        const flavor = /\bajiaco\b/.test(q)
            ? 'ajiaco'
            : /\bmondongo\b/.test(q)
                ? 'mondongo'
                : /\bmenudencias?\b/.test(q)
                    ? 'menudencias'
                    : null;
        const byName = (pred) => available.filter((p) => pred(normalizeText(p.name)));
        const shortest = (list) => [...list].sort((a, b) => a.name.length - b.name.length)[0] || null;
        if (size === 'pequena') {
            if (flavor === 'mondongo') {
                const named = byName((n) => n.includes('mondongo') && this.productIsSmallServing(n));
                if (named.length)
                    return shortest(named);
            }
            const genericSmall = byName((n) => (/^sopa\s+pequena\b/.test(n) || n === 'sopa pequena') && !n.includes('mondongo'));
            if (flavor === 'ajiaco' || flavor === 'menudencias') {
                const namedSmall = byName((n) => n.includes(flavor) && this.productIsSmallServing(n));
                if (namedSmall.length)
                    return shortest(namedSmall);
                if (genericSmall.length)
                    return shortest(genericSmall);
            }
            if (!flavor && genericSmall.length)
                return shortest(genericSmall);
            const anySoupSmall = byName((n) => /\bsopa\b/.test(n) && this.productIsSmallServing(n));
            if (flavor) {
                const flavored = anySoupSmall.filter((p) => {
                    const n = normalizeText(p.name);
                    if (n.includes(flavor))
                        return true;
                    const opts = (p.attributes || [])
                        .flatMap((a) => a.options || [])
                        .map((o) => normalizeText(o));
                    return opts.some((o) => o.includes(flavor) || flavor.includes(o));
                });
                if (flavored.length)
                    return shortest(flavored);
            }
            if (anySoupSmall.length)
                return shortest(anySoupSmall);
            return null;
        }
        if (flavor === 'ajiaco') {
            const large = byName((n) => n.includes('ajiaco') && !this.productIsSmallServing(n));
            if (large.length)
                return shortest(large);
        }
        if (flavor === 'mondongo') {
            const large = byName((n) => n.includes('mondongo') && !this.productIsSmallServing(n));
            if (large.length)
                return shortest(large);
        }
        if (flavor === 'menudencias') {
            const large = byName((n) => n.includes('menudencia') && !this.productIsSmallServing(n));
            if (large.length)
                return shortest(large);
        }
        return null;
    }
    isLikelyDrinkProduct(product) {
        const hay = normalizeText(`${product.name} ${product.categoryName || ''}`);
        return /\b(gaseosa|bebida|jugo|limonada|malta|coca|sprite|pepsi|cerveza|agua|refresco|hit|postobon|colombiana|tea|pola)\b/.test(hay);
    }
    SIDE_NOTE_TOKENS = new Set([
        'yuca',
        'yucas',
        'papa',
        'papas',
        'patacon',
        'patacones',
        'platano',
        'platanos',
        'arroz',
        'ensalada',
        'ensaladas',
        'salada',
        'aguacate',
        'huevo',
        'huevos',
        'arepa',
        'arepas',
        'cebolla',
        'tomate',
        'limon',
        'ají',
        'aji',
        'picante',
        'queso',
        'maduro',
        'verde',
        'cilantro',
        'salsa',
        'salsas',
        'miel',
        'bocadillo',
        'francesa',
        'frita',
        'fritas',
    ]);
    isLikelySideOnlyProduct(product) {
        const n = normalizeText(product.name);
        if (!n)
            return false;
        if (this.SIDE_NOTE_TOKENS.has(n) || this.SIDE_NOTE_TOKENS.has(singularizeEsToken(n))) {
            return true;
        }
        if (/^(porci[oó]n|porciones)\s+(de\s+)?(papa|papas|yuca|arepa|arepas|maduro)\b/.test(n)) {
            return true;
        }
        if (/^arepas?\b/.test(n) && n.split(/\s+/).length <= 3)
            return true;
        return false;
    }
    hasAccompanimentModifierWithMain(text) {
        const q = normalizeText(fixCommonOrderTypos(text || ''));
        if (!q)
            return false;
        const hasSide = /\b(con|sin)\s+(?:las?\s+|unos?\s+|una\s+)?(?:arepas?|papas?|yuca|ensalada|maduro|cebolla)\b/.test(q) ||
            /\b(?:no\s+)?(?:lleva|viene|vienen|trae|traen)\s+(?:solo\s+)?(?:con\s+)?(?:las?\s+|una\s+)?(?:arepas?|papas?|papa|yuca|ensalada)\b/.test(q);
        if (!hasSide)
            return false;
        return /\b(pollos?|broaster|frito|asado|churrascos?|mojarras?|bandejas?|ejecutivos?|sobrebarriga|pechugas?|alitas?|arroz|sopas?|costillas?)\b/.test(q);
    }
    looksLikeExplicitAddProductRequest(text) {
        const raw = fixCommonOrderTypos((text || '').trim());
        if (!raw || raw.length < 8)
            return false;
        const q = normalizeText(raw);
        if (/\bme\s+pod(?:r[ií]as|rias)\s+(?:adicionar|agregar|poner|añadir|anadir)\b/.test(q) ||
            /\b(?:pod(?:r[ií]as|rias)|puedes)\s+(?:adicionar|agregar|poner|añadir|anadir)\b/.test(q)) {
            return true;
        }
        if (/\b(regala(?:me|s|nos)?|me\s+regalas?|enviame|mandame|traeme)\b/.test(q) &&
            (whatsapp_intent_1.FOOD_ORDER_SIGNAL_RE.test(raw) ||
                /\b(\d{1,2}|un|una|dos|tres)\s+(?:de\s+)?[a-z]{3,}/.test(q))) {
            return true;
        }
        if (!/\b(adicionar|adiciona|adicioname|agregame|agregar|añadir|anadir|ponme|dame|traeme|traer)\b/.test(q)) {
            return false;
        }
        return (/\b(?:un|una|el|la|los|las)\s+(?:platano|plato|pollo|sopa|bandeja|mojarra|churrasco|hamburguesa|arepa|combo|ejecutivo|arroz|costilla|pechuga|alitas?|sobrebarriga|mondongo|ajiaco|bebida|gaseosa|jugo|limonada|broaster|frito|trucha|bagre|pescado)\b/.test(q) || /\b(?:un|una)\s+plato\b/.test(q));
    }
    extractProductModificationNote(text) {
        const raw = fixCommonOrderTypos((text || '').trim());
        if (!raw)
            return null;
        if (this.looksLikeExplicitAddProductRequest(raw))
            return null;
        if (this.looksLikeClearlyMultiDishOrder(raw))
            return null;
        const q = normalizeText(raw);
        if (!/\b(sin|con|mas|más|en\s+vez\s+de|envez\s+de|a\s+cambio|pero\s+sin|pero\s+con|no\s+quiero|no\s+me\s+(?:pongan?|pongas)|quiero\s+(?:mas|más)|papa\s+salada|yuca\s+frita)\b/.test(q)) {
            return null;
        }
        const chunks = [];
        const source = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const patterns = [
            /\b((?:sin|con|mas|más|pero\s+sin|pero\s+con|en\s+vez\s+de)\s+(?:de\s+)?(?:(?:la|el|las|los)\s+)?[a-záéíóúñ]+(?:\s+[a-záéíóúñ]+){0,2})/gi,
            /\b((?:no\s+quiero|no\s+me\s+(?:pongan?|pongas)|sin)\s+(?:de\s+)?(?:la\s+|el\s+|las\s+|los\s+|una\s+|un\s+)?[a-záéíóúñ]+(?:\s+[a-záéíóúñ]+){0,2})/gi,
            /\b((?:quiero\s+)?(?:mas|más)\s+(?:de\s+)?[a-záéíóúñ]+(?:\s+[a-záéíóúñ]+){0,1})/gi,
            /\b((?:cambia(?:r|me)?|cambiar)\s+(?:la\s+|el\s+)?(?:ensalada|papa|papas|yuca|arepa)(?:\s+por\s+[a-záéíóúñ]+(?:\s+[a-záéíóúñ]+){0,2})?)/gi,
            /\b((?:a\s+cambio(?:\s+de)?)\s+(?:la\s+|el\s+|unas?\s+|unos?\s+)?[a-záéíóúñ]+(?:\s+[a-záéíóúñ]+){0,2})/gi,
            /\b(papa\s+salada|yuca\s+frita|papas?\s+saladas?)\b/gi,
        ];
        for (const re of patterns) {
            let m;
            re.lastIndex = 0;
            while ((m = re.exec(source)) !== null) {
                const phrase = m[1].replace(/\s+y\s+(?:sin|con|mas|más)\b.*$/i, '')
                    .replace(/\s+y\s*$/i, '').replace(/\s+/g, ' ').trim();
                const norm = normalizeText(phrase);
                if (new RegExp(`\\b${DRINK_ORDER_TOKEN}\\b`, 'i').test(norm))
                    continue;
                if (/\b(con|mas|más)\s+(pollo|carne|churrasco|pechuga|mojarra|bandeja|sopa)\b/.test(norm)) {
                    continue;
                }
                if (!chunks.some((c) => normalizeText(c) === norm))
                    chunks.push(phrase);
            }
        }
        if (!chunks.length)
            return null;
        const dedupedChunks = chunks.filter((c, i) => {
            const n = normalizeText(c);
            return !chunks.some((other, j) => {
                if (i === j)
                    return false;
                const o = normalizeText(other);
                return o !== n && o.includes(n);
            });
        });
        const noteBody = (dedupedChunks.length ? dedupedChunks : chunks)
            .map((c) => c
            .replace(/\bmas\b/gi, 'más')
            .replace(/^a\s+cambio(?:\s+de)?\s+/i, '')
            .trim())
            .filter(Boolean)
            .join(', ')
            .slice(0, 180);
        const withoutMods = q
            .replace(/\b(?:sin|con|mas|más|pero\s+sin|pero\s+con|en\s+vez\s+de|no\s+quiero|no\s+me\s+(?:pongan?|pongas)|quiero\s+(?:mas|más))\s+(?:de\s+)?(?:la\s+|el\s+|las\s+|los\s+|una\s+|un\s+)?[a-z]+(?:\s+[a-z]+){0,2}/g, ' ')
            .replace(/\b(quiero|dame|ponme|agrega|un|una|unos|unas|el|la|los|las|por|favor|para|del|en|sobre|se|puede|puedo|podria|podría)\b/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        const mainTokens = withoutMods
            .split(' ')
            .filter((t) => t.length >= 3)
            .filter((t) => !this.SIDE_NOTE_TOKENS.has(t) && !this.SIDE_NOTE_TOKENS.has(singularizeEsToken(t)));
        if (!mainTokens.length)
            return noteBody;
        if (mainTokens.length === 1 && /^(combo|combos|plato|pedido)$/.test(mainTokens[0])) {
            return noteBody;
        }
        if (mainTokens.length >= 1 && mainTokens.length <= 4) {
            return noteBody;
        }
        return noteBody;
    }
    looksLikeSideModificationNote(text) {
        const raw = fixCommonOrderTypos((text || '').trim());
        if (!raw || raw.length < 6)
            return false;
        if (/^no\s+quiero\s+.+\b(?:quiero|dame|pon(?:me)?)\s+/i.test(raw) &&
            /\b(combo|pollo|broaster|frito|asado|sopa|bandeja|costilla)\b/i.test(raw)) {
            const sideAlt = [...this.SIDE_NOTE_TOKENS].join('|');
            const onlySides = new RegExp(`\\bno\\s+quiero\\s+(?:de\\s+)?(?:la\\s+|el\\s+|las\\s+|los\\s+|una\\s+|un\\s+)?(?:${sideAlt})\\b`, 'i').test(raw);
            if (!onlySides)
                return false;
        }
        const q = normalizeText(raw);
        const sideAlt = [...this.SIDE_NOTE_TOKENS].join('|');
        const hasNegSide = new RegExp(`\\b(?:no\\s+quiero|no\\s+me\\s+(?:pongan?|pongas)|sin)\\s+(?:de\\s+)?(?:la\\s+|el\\s+|las\\s+|los\\s+|una\\s+|un\\s+)?(?:${sideAlt})\\b`).test(q);
        const hasMoreSide = new RegExp(`\\b(?:quiero\\s+)?(?:mas|más)\\s+(?:de\\s+)?(?:${sideAlt})\\b`).test(q);
        const hasSinConSide = new RegExp(`\\b(?:sin|con|mas|más)\\s+(?:de\\s+)?(?:${sideAlt})\\b`).test(q);
        const hasSwapSide = new RegExp(`\\ben\\s+vez\\s+de\\s+(?:la\\s+|el\\s+|las\\s+|los\\s+)?(?:${sideAlt})\\b`).test(q);
        const hasACambioSide = new RegExp(`\\ba\\s+cambio(?:\\s+de)?\\s+(?:la\\s+|el\\s+)?(?:${sideAlt}|papa\\s+salada|yuca\\s+frita)\\b`).test(q);
        const hasChangeSide = new RegExp(`\\b(?:puedo|puedes|se\\s+puede|me\\s+(?:dejan|dejas)|dejame|d[eé]jame)?\\s*cambiar\\s+(?:la\\s+|el\\s+|las\\s+|los\\s+|una\\s+|un\\s+)?(?:${sideAlt})\\b` +
            `|\\bcambiar\\s+(?:la\\s+|el\\s+|las\\s+|los\\s+)?(?:${sideAlt})\\s+por\\b` +
            `|\\b(?:${sideAlt})\\s+por\\s+(?:otra\\s+cosa|${sideAlt})\\b`).test(q);
        const refsCombo = /\b(?:para|del|en|sobre|el|la)\s+(?:el\s+|la\s+)?combo\b/.test(q) || /\bcombo\b/.test(q);
        const refsExistingDishUnit = /\b(?:una?\s+de\s+(?:las?\s+|los?\s+)?|para\s+(?:la\s+|el\s+|las?\s+|los?\s+)|de\s+la\s+|de\s+el\s+)\b/.test(q);
        if (!hasNegSide &&
            !hasMoreSide &&
            !hasSinConSide &&
            !hasSwapSide &&
            !hasChangeSide &&
            !hasACambioSide) {
            return false;
        }
        const mainDish = /\b(pollos?|churrascos?|mojarras?|hamburguesas?|bandejas?|sopas?|alitas?|pechugas?|costillas?|broaster|ejecutivo|sancocho|ajiaco)\b/.test(q);
        if (mainDish && !refsCombo && !refsExistingDishUnit)
            return false;
        return true;
    }
    looksLikeSingleProductWithMods(text) {
        if (this.looksLikeClearlyMultiDishOrder(text))
            return false;
        if (this.looksLikeSideModificationNote(text))
            return true;
        return !!this.extractProductModificationNote(text);
    }
    looksLikeClearlyMultiDishOrder(text) {
        const raw = fixCommonOrderTypos((text || '').trim())
            .replace(/^(?:bueno|listo|hola|buenas|dale|ok)\s*[,!:]\s*/i, '');
        if (!raw)
            return false;
        if (this.countQuantityMentions(raw) >= 2)
            return true;
        const separatelyOrdered = normalizeText(raw).split(/(?:\s+y\s+|,\s*)(?=(?:(?:aparte|ademas)\s+)?(?:otr[oa]s?|un[oa]?s?|\d+|dos|tres|cuatro|cinco)\b)/);
        if (separatelyOrdered.length >= 2 && separatelyOrdered.every(segment => new RegExp(FOOD_ORDER_TOKEN, 'i').test(segment) ||
            /\b(truchas?|ejecutivos?|churrascos?|sobrebarriga|mojarras?|jugos?|limonadas?|gaseosas?|sopas?|ajiaco|mondongo|menudencias?)\b/.test(segment)))
            return true;
        if (this.looksLikeArrozComboPlusSizedChicken(raw))
            return true;
        const lineish = raw
            .split(/\r?\n+|(?=\s[*•\-–—]\s+)/)
            .map((l) => l
            .replace(/^[\s*•\-–—▪︎]+/, '')
            .replace(/^[0-9]{1,2}[.)]\s*/, '')
            .trim())
            .filter((l) => l.length >= 3);
        if (lineish.length >= 2) {
            const dishLine = (l) => /^(?:un|una|unos|unas|el|la|los|las|medio|media|cuarto|porci[oó]n|\d{1,2})\b/i.test(l) ||
                new RegExp(FOOD_ORDER_TOKEN, 'i').test(l) ||
                /\b(ajiaco|mondongo|sancocho|menudencias?|churrasco|mojarra|sobrebarriga|ejecutivo|hamburguesa|limonada|gaseosa|papas?|yuca)\b/i.test(l);
            if (lineish.filter(dishLine).length >= 2)
                return true;
        }
        const withoutCourtesy = raw
            .replace(/[,;]?\s*(por\s+favor|porfavor|porfa|pf|gracias|porfis)[\s!.?]*$/i, '')
            .trim();
        if (!/\s*,\s*|\s+\by\b\s+/i.test(withoutCourtesy)) {
            return false;
        }
        let q = normalizeText(withoutCourtesy);
        q = q
            .replace(/\b(con|sin)\s+(?:las?\s+|unos?\s+|una\s+)?(?:arepas?|papas?|yuca|ensalada|maduro|aguacate)(?:\s+\w+){0,2}\b/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        q = q
            .replace(/\bpollos?\s+(?:fritos?|asados?|broaster|apana(?:do|da)s?)\b/g, 'pollo')
            .replace(/\bmojarras?\s+(?:fritas?|asadas?|plancha)\b/g, 'mojarra')
            .replace(/\bpechugas?\s+(?:fritas?|asadas?|plancha|broaster)\b/g, 'pechuga')
            .replace(/\barroz\s+con\s+pollo\b/g, 'arrozpollo')
            .replace(/\barroz\s+chino\b/g, 'arrozchino');
        if (/\bejecutivo\b/.test(q) || /\balmuerzo\b/.test(q)) {
            q = q
                .replace(/\b(?:con|y)\s+sopa(?:\s+de)?\s+\w+/g, ' ')
                .replace(/\bsopa\s+de\s+\w+/g, ' ')
                .replace(/\b(ajiaco|mondongo|menudencias?)\b/g, ' ')
                .replace(/\bcon\s+pechuga\b/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        }
        const dishRe = /\b(churrascos?|mojarras?|platanos?|pollos?|sopas?|bandejas?|costillas?|arepas?|pechugas?|mondongo|sobrebarriga|alitas?|ejecutivos?|sancocho|ajiaco|broaster|limonadas?|hamburguesas?|gaseosas?|arrozpollo|arrozchino)\b/g;
        const hits = new Set();
        for (const m of q.matchAll(dishRe)) {
            hits.add(singularizeEsToken(m[1]));
        }
        return hits.size >= 2;
    }
    looksLikeArrozComboPlusSizedChicken(text) {
        const q = normalizeText(fixCommonOrderTypos(text || ''));
        if (!q)
            return false;
        if (!/\barroz\b/.test(q))
            return false;
        if (!/\b(medio|media|cuarto|1\s*\/\s*2|1\/2|1\s*\/\s*4|1\/4)\b/.test(q))
            return false;
        if (!/\bpollo\b/.test(q) && !/\bbroaster\b/.test(q) && !/\bfrito\b/.test(q))
            return false;
        if (/\barroz(?:\s+chino)?\s+combo\s+con\s+(?:un\s+|una\s+)?(?:medio|media|1\s*\/\s*2|1\/2)\s+pollo\b/.test(q)) {
            if (/\b(a\s+la\s+broaster|pollo\s+broaster|medio\s+pollo\s+broaster|medio\s+pollo\s+frito)\b/.test(q) &&
                !/\b(gaseosa|ginger|bebida|colombiana|manzana|pepsi|sprite|coca|7up|uva)\b/.test(q)) {
                return true;
            }
            return false;
        }
        if (/\bcombo\s+(?:de\s+)?arroz(?:\s+chino)?\s+con\s+(?:un\s+|una\s+)?(?:medio|media|1\s*\/\s*2|1\/2)\s+pollo\b/.test(q)) {
            return false;
        }
        const arrozCombo = /\barroz(?:\s+chino)?\s+(?:en\s+)?combo\b/.test(q) ||
            /\bcombo\s+(?:de\s+)?arroz\b/.test(q) ||
            (/\ben\s+combo\b/.test(q) && /\barroz\b/.test(q));
        const chickenStyle = /\b(broaster|frito|asado|a\s+la\s+broaster)\b/.test(q);
        return arrozCombo || chickenStyle;
    }
    stripProductModificationNoise(text) {
        const raw = fixCommonOrderTypos((text || '').trim());
        if (!raw)
            return raw;
        let cleaned = raw
            .replace(/\b(?:sin|con|mas|más|pero\s+sin|pero\s+con|en\s+vez\s+de|no\s+quiero|no\s+me\s+(?:pongan?|pongas)|quiero\s+(?:mas|más))\s+(?:de\s+)?(?:la\s+|el\s+|las\s+|los\s+|una\s+|un\s+)?[^\s,]+(?:\s+[^\s,]+){0,2}/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        cleaned = this.extractProductSearchQuery(cleaned) || cleaned;
        cleaned = this.cleanOrderSegment(cleaned);
        return cleaned;
    }
    tokenAppearsOnlyUnderSin(q, token) {
        const t = normalizeText(token);
        if (!t || t.length < 3)
            return false;
        const re = new RegExp(`\\b${escapeRegExp(t)}\\b`, 'g');
        let m;
        let found = false;
        let positive = false;
        while ((m = re.exec(q)) !== null) {
            found = true;
            const before = q.slice(Math.max(0, m.index - 28), m.index);
            const negated = /\bsin\s+(?:la|el|las|los|de|una|un)?\s*$/.test(before) ||
                /\bno\s+(?:quiero|quieras|me\s+(?:pongan?|pongas)|le\s+(?:pongan?|pongas)|deseo)\s+(?:de\s+)?(?:la|el|las|los|una|un)?\s*$/.test(before);
            if (!negated)
                positive = true;
        }
        return found && !positive;
    }
    findAllProductsEmbeddedInMessage(text, products) {
        const raw = fixCommonOrderTypos(text);
        const q = normalizeText(raw);
        const modNote = this.extractProductModificationNote(raw);
        if (!q || q.length < 4)
            return [];
        if (this.looksLikeSideModificationNote(raw))
            return [];
        const available = products.filter((p) => p.availableNow !== false);
        const foodDrink = this.looksLikeFoodPlusDrinkOrder(raw);
        const hits = [];
        for (const p of available) {
            const name = normalizeText(p.name);
            if (name.length < 4)
                continue;
            if (this.hasAccompanimentModifierWithMain(raw) && this.isLikelySideOnlyProduct(p)) {
                continue;
            }
            const nameHasMenuWrapper = [...whatsapp_named_menu_dish_1.MENU_WRAPPER_TOKENS].some((t) => this.queryHasToken(name, t));
            const queryHasMenuWrapper = [...whatsapp_named_menu_dish_1.MENU_WRAPPER_TOKENS].some((t) => this.queryHasToken(q, t));
            if (nameHasMenuWrapper && !queryHasMenuWrapper) {
                continue;
            }
            let idx = 0;
            let foundFull = false;
            while ((idx = q.indexOf(name, idx)) !== -1) {
                const before = q.slice(Math.max(0, idx - 28), idx);
                if (/\bsin\s+(?:la|el|las|los|de|una|un)?\s*$/.test(before) ||
                    /\bno\s+(?:quiero|quieras|me\s+(?:pongan?|pongas)|le\s+(?:pongan?|pongas)|deseo)\s+(?:de\s+)?(?:la|el|las|los|una|un)?\s*$/.test(before)) {
                    idx += 1;
                    continue;
                }
                hits.push({
                    p,
                    start: idx,
                    end: idx + name.length,
                    nameLen: name.length,
                    priority: name.length + (this.isLikelyDrinkProduct(p) ? 5 : 40),
                });
                foundFull = true;
                idx += 1;
            }
            if (foundFull)
                continue;
            const tokens = name
                .split(' ')
                .map((t) => t.trim())
                .filter((t) => this.isDistinctiveProductToken(t));
            let matched = false;
            for (const tok of tokens) {
                if (this.tokenAppearsOnlyUnderSin(q, tok))
                    continue;
                const sing = singularizeEsToken(tok);
                const qWords = q.split(/\s+/).filter(Boolean);
                let hitWord = null;
                for (const w of qWords) {
                    const ws = singularizeEsToken(w);
                    if (w === tok || ws === sing || w === sing || ws === tok) {
                        hitWord = w;
                        break;
                    }
                }
                if (!hitWord && tok.length >= 7) {
                    for (const w of qWords) {
                        if (w.length < 6 || COOKING_STYLE_TOKENS.has(singularizeEsToken(w)))
                            continue;
                        if (fuzzyTokenMatch(w, tok) ||
                            fuzzyTokenMatch(singularizeEsToken(w), singularizeEsToken(tok))) {
                            hitWord = w;
                            break;
                        }
                    }
                }
                if (!hitWord)
                    continue;
                if (this.tokenAppearsOnlyUnderSin(q, hitWord))
                    continue;
                if (modNote &&
                    (this.SIDE_NOTE_TOKENS.has(tok) || this.SIDE_NOTE_TOKENS.has(sing)) &&
                    normalizeText(modNote).includes(sing)) {
                    continue;
                }
                const start = Math.max(0, q.indexOf(hitWord));
                hits.push({
                    p,
                    start,
                    end: start + hitWord.length,
                    nameLen: tok.length,
                    priority: tok.length + 30 + (name.split(' ').length >= 2 ? 10 : 0),
                });
                matched = true;
                break;
            }
            if (matched)
                continue;
            if (foodDrink && this.isLikelyDrinkProduct(p)) {
                const drinkToks = name
                    .split(' ')
                    .filter((t) => /\b(gaseosa|jugo|limonada|malta|coca|sprite|pepsi|cerveza|agua|hit|postobon)\b/.test(t));
                for (const tok of drinkToks) {
                    const re = new RegExp(`(?:^|\\s)${escapeRegExp(tok)}(?:\\s|$)`);
                    const m = re.exec(q);
                    if (!m || m.index == null)
                        continue;
                    hits.push({
                        p,
                        start: m.index,
                        end: m.index + tok.length,
                        nameLen: tok.length,
                        priority: 15,
                    });
                    break;
                }
            }
        }
        if (/\bbroaster\b/.test(q)) {
            for (const h of hits) {
                if (/\bbroaster\b/.test(normalizeText(h.p.name)))
                    h.priority += 50;
                if (/^medio\s+pollo$/.test(normalizeText(h.p.name)))
                    h.priority -= 40;
            }
        }
        const variantHint = this.extractVariantPreferenceHint(raw);
        if (variantHint === 'combo') {
            for (const h of hits) {
                const pn = normalizeText(h.p.name);
                if (/\bcombo\b/.test(pn))
                    h.priority += 90;
                else if (this.productImpliesCombo(h.p))
                    h.priority += 40;
            }
        }
        else if (variantHint === 'solo') {
            for (const h of hits) {
                const pn = normalizeText(h.p.name);
                if (/\bsolo\b/.test(pn))
                    h.priority += 90;
                else if (/\bcombo\b/.test(pn))
                    h.priority -= 50;
            }
        }
        const portionHint = this.detectPortionHint(q);
        if (portionHint) {
            for (const h of hits) {
                const pPortion = this.detectProductPortionSize(normalizeText(h.p.name));
                if (pPortion === portionHint)
                    h.priority += 80;
                else if (pPortion && pPortion !== portionHint)
                    h.priority -= 50;
                if (portionHint === 'medio' &&
                    /^1\s+pollo\b/.test(normalizeText(h.p.name))) {
                    h.priority -= 70;
                }
            }
        }
        const styleInQuery = [...COOKING_STYLE_TOKENS].filter((st) => this.queryHasToken(q, st));
        for (const h of hits) {
            const pname = normalizeText(h.p.name);
            const styleHits = styleInQuery.filter((st) => productNameHasCookingStyle(pname, st)).length;
            if (styleHits > 0)
                h.priority += 40 * styleHits;
            else if (styleInQuery.length && productHasConflictingCookingStyle(pname, styleInQuery)) {
                h.priority -= 30;
            }
            if (!styleInQuery.length) {
                const stripped = this.stripCookingStyleTokens(pname);
                if (pname === stripped)
                    h.priority += 35;
                else
                    h.priority -= 25;
            }
            const nameToks = pname.split(' ').filter((t) => t.length >= 4);
            const covered = nameToks.filter((t) => this.queryHasToken(q, t)).length;
            const extra = nameToks.filter((t) => !this.queryHasToken(q, t) &&
                !COOKING_STYLE_TOKENS.has(t) &&
                t !== 'de');
            if (nameToks.length >= 2 && covered === nameToks.length)
                h.priority += 60;
            else if (covered >= 2)
                h.priority += 25;
            if (extra.length)
                h.priority -= 20 * extra.length;
            if (this.productNameHasPackMultiplier(pname) && !this.queryAsksForPackMultiplier(q)) {
                h.priority -= 100;
            }
            const nameHasMenuWrapper = [...whatsapp_named_menu_dish_1.MENU_WRAPPER_TOKENS].some((t) => this.queryHasToken(pname, t));
            const queryHasMenuWrapper = [...whatsapp_named_menu_dish_1.MENU_WRAPPER_TOKENS].some((t) => this.queryHasToken(q, t));
            if (nameHasMenuWrapper && !queryHasMenuWrapper) {
                h.priority -= 110;
            }
            const qCore = singularizeEsToken(q.replace(/\b(un|una|unos|unas|pedi|pido|quiero|dame)\b/g, '').trim());
            if (pname === qCore || singularizeEsToken(pname) === qCore)
                h.priority += 90;
            else if (nameToks.length === 1 &&
                singularizeEsToken(nameToks[0]) === qCore) {
                h.priority += 70;
            }
            else if (qCore.length >= 8 &&
                (pname === qCore ||
                    pname.endsWith(qCore) ||
                    pname.replace(/^\d+\s+/, '') === qCore)) {
                h.priority += 80;
            }
        }
        hits.sort((a, b) => b.priority - a.priority ||
            normalizeText(a.p.name).length - normalizeText(b.p.name).length ||
            a.start - b.start);
        const picked = [];
        const ranges = [];
        const usedIds = new Set();
        for (const h of hits) {
            if (usedIds.has(h.p.id))
                continue;
            if (foodDrink &&
                /^medio\s+pollo$/.test(normalizeText(h.p.name)) &&
                /\bbroaster\b/.test(q)) {
                continue;
            }
            const overlaps = ranges.some((r) => !(h.end <= r.start || h.start >= r.end));
            if (overlaps) {
                continue;
            }
            picked.push(h.p);
            usedIds.add(h.p.id);
            ranges.push({ start: h.start, end: h.end });
        }
        let result = [...picked];
        if (foodDrink) {
            const hasDrink = result.some((p) => this.isLikelyDrinkProduct(p));
            const hasFood = result.some((p) => !this.isLikelyDrinkProduct(p));
            if (hasFood && !hasDrink) {
                const drinkHits = hits
                    .filter((h) => this.isLikelyDrinkProduct(h.p) && !usedIds.has(h.p.id))
                    .map((h) => h.p);
                const bestDrink = this.pickBestDrinkProduct(drinkHits, raw) ||
                    this.findFoodDrinkCompanionProduct(raw, result[0], available);
                if (bestDrink && this.isLikelyDrinkProduct(bestDrink)) {
                    result.push(bestDrink);
                }
            }
            else if (hasDrink) {
                const drinks = result.filter((p) => this.isLikelyDrinkProduct(p));
                if (drinks.length >= 1 && /gaseosa/.test(q)) {
                    const pool = available.filter((p) => this.isLikelyDrinkProduct(p) && /\bgaseosa\b/.test(normalizeText(p.name))) || drinks;
                    const best = this.pickBestDrinkProduct(pool.length ? pool : drinks, raw);
                    if (best) {
                        result = [...result.filter((p) => !this.isLikelyDrinkProduct(p)), best];
                    }
                }
            }
        }
        const styleAsked = [...COOKING_STYLE_TOKENS].filter((st) => this.queryHasToken(q, st));
        if (result.length >= 1 &&
            !this.looksLikeFoodPlusDrinkOrder(raw) &&
            !this.looksLikeClearlyMultiDishOrder(raw)) {
            const head = result.find((p) => !this.isLikelyDrinkProduct(p));
            if (head) {
                const baseKey = this.stripCookingStyleTokens(normalizeText(head.name));
                const siblings = available.filter((p) => !this.isLikelyDrinkProduct(p) &&
                    this.stripCookingStyleTokens(normalizeText(p.name)) === baseKey);
                if (siblings.length >= 2) {
                    if (styleAsked.length) {
                        const styled = siblings.filter((p) => styleAsked.some((st) => normalizeText(p.name).includes(st)));
                        if (styled.length === 1) {
                            result = [
                                ...styled,
                                ...result.filter((p) => this.isLikelyDrinkProduct(p)),
                            ];
                        }
                        else if (styled.length > 1) {
                            result = result.filter((p) => this.isLikelyDrinkProduct(p));
                        }
                    }
                    else {
                        const bare = siblings.find((p) => normalizeText(p.name) === baseKey);
                        if (bare) {
                            result = [
                                bare,
                                ...result.filter((p) => this.isLikelyDrinkProduct(p)),
                            ];
                        }
                        else {
                            result = result.filter((p) => this.isLikelyDrinkProduct(p));
                        }
                    }
                }
            }
        }
        else if (result.length >= 1 &&
            this.looksLikeClearlyMultiDishOrder(raw) &&
            !this.looksLikeFoodPlusDrinkOrder(raw)) {
            const foods = result.filter((p) => !this.isLikelyDrinkProduct(p));
            const drinks = result.filter((p) => this.isLikelyDrinkProduct(p));
            const kept = [];
            const seenBase = new Set();
            for (const food of foods) {
                const baseKey = this.stripCookingStyleTokens(normalizeText(food.name));
                if (seenBase.has(baseKey))
                    continue;
                seenBase.add(baseKey);
                const siblings = available.filter((p) => !this.isLikelyDrinkProduct(p) &&
                    this.stripCookingStyleTokens(normalizeText(p.name)) === baseKey);
                if (siblings.length < 2) {
                    kept.push(food);
                    continue;
                }
                if (styleAsked.length) {
                    const styled = siblings.filter((p) => styleAsked.some((st) => normalizeText(p.name).includes(st)));
                    if (styled.length === 1)
                        kept.push(styled[0]);
                }
                else {
                    const bare = siblings.find((p) => normalizeText(p.name) === baseKey);
                    if (bare)
                        kept.push(bare);
                }
            }
            result = [...kept, ...drinks];
        }
        if (modNote) {
            const noteQ = normalizeText(modNote);
            result = result.filter((p) => {
                if (this.isLikelyDrinkProduct(p))
                    return true;
                const name = normalizeText(p.name);
                const sideHit = name
                    .split(' ')
                    .map((t) => singularizeEsToken(t))
                    .some((t) => this.SIDE_NOTE_TOKENS.has(t) && (noteQ.includes(t) || this.tokenAppearsOnlyUnderSin(q, t)));
                const baseToks = name
                    .split(' ')
                    .filter((t) => t.length >= 3 && !COOKING_STYLE_TOKENS.has(t) && t !== 'porcion' && t !== 'porciones');
                if (baseToks.length &&
                    baseToks.every((t) => this.SIDE_NOTE_TOKENS.has(t) || this.SIDE_NOTE_TOKENS.has(singularizeEsToken(t))) &&
                    sideHit) {
                    return false;
                }
                return true;
            });
        }
        return result.sort((a, b) => {
            const aDrink = this.isLikelyDrinkProduct(a) ? 1 : 0;
            const bDrink = this.isLikelyDrinkProduct(b) ? 1 : 0;
            if (aDrink !== bDrink)
                return aDrink - bDrink;
            const aIdx = hits.find((h) => h.p.id === a.id)?.start ?? 0;
            const bIdx = hits.find((h) => h.p.id === b.id)?.start ?? 0;
            return aIdx - bIdx;
        });
    }
    drinkPreferenceRank(product) {
        const n = normalizeText(product.name);
        if (/\b400\s*ml\b/.test(n))
            return 1;
        if (/\b250\s*ml\b/.test(n))
            return 2;
        if (/\b500\s*ml\b/.test(n))
            return 3;
        if (/\bpersonal\b/.test(n))
            return 4;
        if (/\b1\s*5\s*l\b/.test(n))
            return 6;
        if (/\b2\s*5\s*l\b/.test(n))
            return 9;
        return 5;
    }
    extractRequestedDrinkVolumeMl(text) {
        const raw = fixCommonOrderTypos(text || '');
        if (!raw.trim())
            return null;
        const lower = raw.toLowerCase();
        let m = lower.match(/\b(\d+)\s*[.,]\s*(\d+)\s*(?:l|lt|lts|litro|litros|litrso)\b/i);
        if (m) {
            const v = Number(m[1]) + Number(m[2]) / Math.pow(10, m[2].length);
            if (v > 0 && v <= 5)
                return Math.round(v * 1000);
        }
        if (/\b(?:un\s+)?litro\s+y\s+medi[oa]\b/i.test(lower))
            return 1500;
        if (/\bmedia?\s+de\s+litro\b/i.test(lower))
            return 500;
        const q = normalizeText(raw);
        const drinkBrand = /\b(colombiana|manzana|pepsi|coca|gaseosa|sprite|postobon|jugo|limonada|uva|ginger|hit)\b/.test(q);
        if (drinkBrand) {
            m = lower.match(/\b(\d+)\s*[.,]\s*(\d+)\b/);
            if (m) {
                const v = Number(m[1]) + Number(m[2]) / Math.pow(10, m[2].length);
                if (v >= 0.3 && v <= 5)
                    return Math.round(v * 1000);
            }
            m = q.match(/\b(\d)\s+(\d)\b/);
            if (m) {
                const whole = Number(m[1]);
                const frac = Number(m[2]);
                if (whole >= 1 && whole <= 3 && frac >= 0 && frac <= 9) {
                    const v = whole + frac / 10;
                    if (v >= 0.3 && v <= 5)
                        return Math.round(v * 1000);
                }
            }
        }
        m = q.match(/\b(\d{2,4})\s*(?:ml|cc)\b/);
        if (m) {
            const ml = Number(m[1]);
            if (ml >= 200 && ml <= 5000)
                return ml;
        }
        if (drinkBrand) {
            const bare = q.match(/\b(\d{3,4})\b/);
            if (bare) {
                const ml = Number(bare[1]);
                if (ml >= 200 && ml <= 3000)
                    return ml;
            }
        }
        m = q.match(/\b(\d)\s+(\d)\s*(?:l|lt|lts|litro|litros)\b/);
        if (m) {
            const whole = Number(m[1]);
            const frac = Number(m[2]);
            if (whole >= 1 && whole <= 3 && frac >= 0 && frac <= 9) {
                return Math.round((whole + frac / 10) * 1000);
            }
        }
        m = q.match(/\b(\d)\s*(?:l|lt|lts|litro|litros)\b/);
        if (m) {
            const n = Number(m[1]);
            if (n >= 1 && n <= 5)
                return n * 1000;
        }
        if (/\bpersonal\b/.test(q))
            return 400;
        if (/\bfamiliar\b/.test(q))
            return 2500;
        return null;
    }
    productDrinkVolumeMl(product) {
        const raw = product.name || '';
        const n = normalizeText(raw);
        let m = n.match(/\b(\d{2,4})\s*ml\b/);
        if (m)
            return Number(m[1]);
        m = raw.toLowerCase().match(/\b(\d+)\s*[.,]\s*(\d+)\s*(?:l|lt|lts|litro|litros)\b/);
        if (m) {
            const v = Number(m[1]) + Number(m[2]) / Math.pow(10, m[2].length);
            if (v > 0 && v <= 5)
                return Math.round(v * 1000);
        }
        m = n.match(/\b(\d)\s+(\d)\s*(?:l|lt|lts|litro|litros)\b/);
        if (m) {
            return Math.round((Number(m[1]) + Number(m[2]) / 10) * 1000);
        }
        m = n.match(/\b(\d)\s*(?:l|lt|lts|litro|litros)\b/);
        if (m) {
            const lit = Number(m[1]);
            if (lit >= 1 && lit <= 5)
                return lit * 1000;
        }
        if (/\bpersonal\b/.test(n))
            return 400;
        if (/\bfamiliar\b/.test(n))
            return 2500;
        return null;
    }
    pickBestDrinkProduct(drinks, queryText) {
        if (!drinks.length)
            return null;
        const q = normalizeText(fixCommonOrderTypos(queryText || ''));
        const brandHints = [
            'colombiana',
            'manzana',
            'pepsi',
            'coca',
            'sprite',
            'uva',
            'ginger',
            'postobon',
            'limonada',
        ];
        const brand = brandHints.find((b) => this.queryHasToken(q, b));
        let pool = drinks;
        if (brand) {
            const branded = drinks.filter((p) => {
                const n = normalizeText(`${p.name} ${(p.attributes || []).flatMap((a) => a.options || []).join(' ')}`);
                return n.includes(brand);
            });
            if (branded.length)
                pool = branded;
        }
        const want = this.extractRequestedDrinkVolumeMl(queryText);
        const blobOf = (p) => normalizeText(`${p.name} ${(p.attributes || []).flatMap((a) => a.options || []).join(' ')}`);
        if (want != null) {
            const close = (p) => {
                const vol = this.productDrinkVolumeMl(p);
                if (vol == null)
                    return false;
                return Math.abs(vol - want) <= Math.max(150, want * 0.2);
            };
            const sized = drinks.filter(close);
            const sizedBrand = brand ? sized.filter((p) => blobOf(p).includes(brand)) : sized;
            if (sizedBrand.length)
                pool = sizedBrand;
            else if (brand) {
                const branded = drinks.filter((p) => blobOf(p).includes(brand));
                if (branded.length)
                    pool = branded;
                else if (sized.length)
                    pool = sized;
            }
            else if (sized.length)
                pool = sized;
        }
        if (want != null) {
            const ranked = pool
                .map((p) => {
                const vol = this.productDrinkVolumeMl(p);
                const diff = vol == null ? 99999 : Math.abs(vol - want);
                return { p, vol, diff };
            })
                .sort((a, b) => a.diff - b.diff ||
                this.drinkPreferenceRank(a.p) - this.drinkPreferenceRank(b.p));
            const best = ranked[0];
            if (best && best.diff <= Math.max(150, want * 0.2)) {
                return best.p;
            }
            if (best && best.vol != null && best.diff < want) {
                return best.p;
            }
        }
        return [...pool].sort((a, b) => this.drinkPreferenceRank(a) - this.drinkPreferenceRank(b))[0];
    }
    menuDrinkProducts(products) {
        return products.filter((p) => p.availableNow !== false && this.isLikelyDrinkProduct(p));
    }
    resolveStandaloneDrinkOrder(text, products) {
        const raw = (text || '').trim();
        if (this.looksLikeFoodPlusDrinkOrder(raw))
            return null;
        const drinks = this.menuDrinkProducts(products);
        if (!drinks.length)
            return null;
        const clauses = this.dishClauses(raw);
        if (clauses.length !== 1 || !clauses[0].length)
            return null;
        const tokens = clauses[0];
        if (this.foodNameAnchorsTokens(tokens, products))
            return null;
        const covering = drinks.filter((p) => {
            const candidateTokens = this.dishClauses(this.stripOrderMetadata(raw, p)).flat();
            return candidateTokens.length > 0 && candidateTokens.every(t => this.productTextCoversToken(p, t));
        });
        if (!covering.length)
            return null;
        const want = this.extractRequestedDrinkVolumeMl(raw);
        let pool = covering;
        if (want != null) {
            const sized = covering.filter((p) => {
                const vol = this.productDrinkVolumeMl(p);
                if (vol == null)
                    return false;
                return Math.abs(vol - want) <= Math.max(150, want * 0.2);
            });
            if (!sized.length)
                return null;
            pool = sized;
        }
        const product = [...pool].sort((a, b) => this.drinkPreferenceRank(a) - this.drinkPreferenceRank(b))[0];
        if (!product)
            return null;
        if (!this.productNameFitsUtterance(product, raw))
            return null;
        const fromMsg = this.resolveAttributesFromMessage(product, raw, []);
        const selected = fromMsg.status === 'complete' || fromMsg.status === 'partial'
            ? fromMsg.attributes
            : [];
        return { product, attributes: this.fillDefaultAttributes(product, selected) };
    }
    shouldOfferMenuDrinks(text, products) {
        const raw = (text || '').trim();
        if (!raw || raw.length < 3)
            return false;
        if (!this.menuDrinkProducts(products).length)
            return false;
        if (this.looksLikeFoodPlusDrinkOrder(raw))
            return false;
        if (this.isAvailabilityInquiry(raw) || this.isPriceInquiryIntent(raw))
            return false;
        if (this.isCategoryBrowseQuestion(raw) || this.isProductDescriptionInquiry(raw))
            return false;
        if (this.resolveStandaloneDrinkOrder(raw, products))
            return false;
        const clauses = this.dishClauses(raw);
        if (clauses.length !== 1 || !clauses[0].length)
            return false;
        const tokens = clauses[0];
        if (this.foodNameAnchorsTokens(tokens, products))
            return false;
        const embedded = this.findProductEmbeddedInMessage(raw, products);
        if (embedded && !this.isLikelyDrinkProduct(embedded))
            return false;
        return this.menuDrinkProducts(products).some((p) => tokens.some((t) => this.productTextCoversToken(p, t)));
    }
    foodNameAnchorsTokens(tokens, products) {
        const foods = products.filter((p) => p.availableNow !== false && !this.isLikelyDrinkProduct(p));
        const best = this.bestClauseCoverage(tokens, foods, { ignoreDrinkOptions: true });
        return !!best && best.leftover.length < tokens.length;
    }
    missingStyleAlternatives(text, products) {
        const raw = (text || '').trim();
        if (!raw || raw.length < 3)
            return null;
        if (this.looksLikeFoodPlusDrinkOrder(raw))
            return null;
        if (this.isAvailabilityInquiry(raw) || this.isPriceInquiryIntent(raw))
            return null;
        if (this.isCategoryBrowseQuestion(raw) || this.isProductDescriptionInquiry(raw))
            return null;
        const clauses = this.dishClauses(raw);
        if (clauses.length !== 1 || !clauses[0].length)
            return null;
        const tokens = clauses[0];
        const isStyle = (t) => {
            const s = singularizeEsToken(t);
            return COOKING_STYLE_TOKENS.has(t) || COOKING_STYLE_TOKENS.has(s) || t === 'mixto' || s === 'mixto';
        };
        const styleTokens = tokens.filter(isStyle);
        const dishTokens = tokens.filter((t) => !isStyle(t));
        if (!styleTokens.length || !dishTokens.length)
            return null;
        const q = normalizeText(fixCommonOrderTypos(raw));
        const portion = this.detectPortionHint(raw);
        const skipName = new Set([
            'de',
            'del',
            'con',
            'para',
            'por',
            'las',
            'los',
            'una',
            'uno',
            'medio',
            'media',
            'cuarto',
            'cuarta',
            'entero',
            'entera',
            'porcion',
        ]);
        const nameFitsQuery = (name) => normalizeText(name)
            .split(/\s+/)
            .filter((t) => t.length >= 4 && !skipName.has(t) && !isStyle(t))
            .every((t) => this.queryHasToken(q, t));
        let family = products.filter((p) => {
            if (p.availableNow === false || this.isLikelyDrinkProduct(p))
                return false;
            if (!dishTokens.every((t) => this.productTextCoversToken(p, t, { ignoreDrinkOptions: true }))) {
                return false;
            }
            if (!nameFitsQuery(p.name))
                return false;
            if (!portion)
                return true;
            const pPortion = this.detectProductPortionSize(normalizeText(p.name));
            if (portion === 'entero')
                return pPortion === 'entero' || pPortion == null;
            return pPortion === portion;
        });
        if (!portion) {
            const enteros = family.filter((p) => {
                const pPortion = this.detectProductPortionSize(normalizeText(p.name));
                return pPortion === 'entero' || pPortion == null;
            });
            if (enteros.length)
                family = enteros;
        }
        if (!family.length)
            return null;
        if (family.some((p) => styleTokens.every((t) => productOffersCookingStyle(p, t))))
            return null;
        return [...family].sort((a, b) => a.price - b.price || a.name.length - b.name.length).slice(0, 6);
    }
    formatMissingStyleOffer(text, products) {
        const alts = this.missingStyleAlternatives(text, products);
        if (!alts?.length)
            return null;
        const label = this.cleanOrderSegment(text).replace(/[¿?¡!.]+$/g, '').trim() || 'eso';
        if (alts.length === 1) {
            const p = alts[0];
            const prep = (p.attributes || [])
                .filter((a) => this.isPrepAttributeName(a.attributeName))
                .flatMap((a) => a.options || [])
                .filter(Boolean);
            const prepLine = prep.length ? `\nLa preparación es: ${prep.join(', ')}.` : '';
            return (`No tenemos *${label}*.\n` +
                `*${p.name}* sí está · ${this.formatMoney(p.price)}${prepLine}\n\n` +
                `Dime cuál te llevo.`);
        }
        const lines = alts.map((p) => `• *${p.name}* · ${this.formatMoney(p.price)}`);
        return (`No tenemos *${label}*.\n` +
            `En esa porción sí hay:\n${lines.join('\n')}\n\n` +
            `Dime cuál te llevo.`);
    }
    formatMenuDrinksOffer(asked, products) {
        const label = (asked || '')
            .replace(/^(?:una|un|unos|unas|el|la|los|las)\s+/i, '')
            .replace(/[¿?¡!.]+$/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        const lines = this.menuDrinkProducts(products)
            .slice(0, 8)
            .map((p) => {
            const opts = (p.attributes || [])
                .flatMap((a) => a.options || [])
                .filter(Boolean)
                .slice(0, 8);
            const flavors = opts.length ? ` · ${opts.join(', ')}` : '';
            return `• *${p.name}* · ${this.formatMoney(p.price)}${flavors}`;
        });
        return (`No tenemos *${label || 'eso'}*.\n` +
            `De bebidas sí hay:\n${lines.join('\n')}\n\n` +
            `Dime cuál, o el plato si buscabas otra cosa.`);
    }
    looksLikeMultiItemOrderMessage(text) {
        if (this.isOffTopicChitchat(text))
            return false;
        if (this.isPriceInquiryIntent(text))
            return false;
        if (this.looksLikeFoodPlusDrinkOrder(text))
            return true;
        if (this.looksLikeClearlyMultiDishOrder(text)) {
            return this.splitMultiProductSegments(text).length >= 2;
        }
        if (this.looksLikeSingleProductWithMods(text))
            return false;
        const withoutCourtesy = (text || '')
            .replace(/[,;]?\s*(por\s+favor|porfa|pf|gracias|porfis)[\s!.?]*$/i, '')
            .trim();
        if (!/\s+\by\b\s+|\s*,\s*|\s+(?:mas|más|\+)\s+|\r?\n/i.test(withoutCourtesy)) {
            return false;
        }
        const q = normalizeText(text);
        if (!new RegExp(FOOD_ORDER_TOKEN, 'i').test(q) &&
            !new RegExp(DRINK_ORDER_TOKEN, 'i').test(q) &&
            !/\b(mojarra|bandeja|mondongo|arepa|chorizo|pechuga|costilla|ajiaco|sancocho|churrasco)\b/.test(q)) {
            return false;
        }
        return this.splitMultiProductSegments(text).length >= 2;
    }
    findProductEmbeddedInMessage(text, products) {
        if (this.isDishStyleSubstitutionInquiry(text)) {
            const baseQ = this.extractBaseDishQueryForStyleSwap(text);
            if (!baseQ || this.isDishStyleSubstitutionInquiry(baseQ))
                return null;
            return this.findProductEmbeddedInMessage(baseQ, products);
        }
        const namedMenu = this.resolveNamedMenuDishProduct(text, products);
        if (namedMenu)
            return namedMenu;
        const sizedSoup = this.resolveSizedSoupProduct(text, products);
        if (sizedSoup && !this.looksLikeClearlyMultiDishOrder(text))
            return sizedSoup;
        const sizedChicken = this.resolveSizedChickenProduct(text, products);
        if (sizedChicken && !this.looksLikeClearlyMultiDishOrder(text))
            return sizedChicken;
        const embedded = this.findAllProductsEmbeddedInMessage(text, products);
        if (!embedded.length)
            return null;
        const accompaniment = this.hasAccompanimentModifierWithMain(text);
        const withoutSides = accompaniment
            ? embedded.filter((p) => !this.isLikelySideOnlyProduct(p))
            : embedded;
        if (accompaniment && !withoutSides.length)
            return null;
        const pool = withoutSides.length ? withoutSides : embedded;
        const leavesWordsOut = (p) => this.missingDishQualifiers(text, [p]).length > 0 ||
            this.uncoveredWordsAnchoredByProduct(text, p).length > 0;
        const namedEnough = (p) => this.productNameFitsUtterance(p, text);
        if (pool.length === 1) {
            if (leavesWordsOut(pool[0]) || !namedEnough(pool[0]))
                return null;
            return pool[0];
        }
        const q = normalizeText(text);
        const ranked = pool
            .map((p) => {
            const name = normalizeText(p.name);
            const inSegment = q.includes(name);
            const tokens = name
                .split(' ')
                .filter((t) => t.length >= 4 && !this.WEAK_PRODUCT_TOKENS.has(t));
            const tokenHits = tokens.filter((t) => new RegExp(`(?:^|\\s)${escapeRegExp(t)}(?:\\s|$)`).test(q) ||
                q.split(/\s+/).some((w) => fuzzyTokenMatch(w, t))).length;
            let score = (inSegment ? name.length + 50 : 0) + tokenHits * 20;
            const servingSize = this.detectServingSizeHint(q);
            if (servingSize === 'pequena') {
                if (this.productIsSmallServing(name))
                    score += 80;
                else if (/\bsopa\b/.test(name))
                    score -= 60;
            }
            if (/\bmixto\b/.test(q)) {
                if (/\bmixto\b/.test(name))
                    score += 120;
                else if (/\b(broaster|frito|asado)\b/.test(name))
                    score -= 50;
            }
            else if (/\bbroaster\b/.test(q)) {
                if (/\bbroaster\b/.test(name))
                    score += 120;
                else if (/\b(frito|mixto|asado)\b/.test(name))
                    score -= 50;
            }
            else if (/\bfrito\b/.test(q)) {
                if (/\bfrito\b/.test(name))
                    score += 120;
                else if (/\b(broaster|mixto|asado)\b/.test(name))
                    score -= 50;
            }
            return { p, score };
        })
            .sort((a, b) => b.score - a.score);
        if (ranked.length >= 2 && ranked[0].score === ranked[1].score && ranked[0].score === 0) {
            return null;
        }
        const best = ranked[0]?.p ?? null;
        if (best && (leavesWordsOut(best) || !namedEnough(best)))
            return null;
        return best;
    }
    foodSideHasAnotherDish(food) {
        const parts = (food || '')
            .split(/\s+\by\b\s+/i)
            .map((s) => s.trim())
            .filter((s) => s.length >= 3);
        if (parts.length < 2)
            return false;
        const foodRe = new RegExp(FOOD_ORDER_TOKEN, 'i');
        const onlyPortion = /^(?:un|una|el|la|\d+)?\s*(medio|media|cuarto|cuarta|entero|entera)$/i;
        return parts.every((p) => foodRe.test(p) && !onlyPortion.test(p.trim()));
    }
    splitFoodPlusDrinkSegments(text) {
        const raw = fixCommonOrderTypos(text.trim());
        if (!raw)
            return [];
        const drinkTail = new RegExp(DRINK_ORDER_TOKEN, 'i');
        const qtyWord = 'dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce';
        const drinkWithSize = `${DRINK_ORDER_TOKEN}(?:\\s+(?:de\\s+)?[\\w.,]+)*`;
        const pairRe = new RegExp(`^(.+?)\\s+(?:y|con|mas|más|\\+|,)\\s+(?:(\\d{1,2}|${qtyWord})\\s+)?(?:un|una|unos|unas|el|la|los|las)?\\s*(${drinkWithSize})`, 'i');
        let m = raw.match(pairRe);
        if (m?.[1] && m?.[3]) {
            const food = this.cleanOrderSegment(m[1]);
            const drinkQty = m[2]?.trim();
            const drink = this.cleanOrderSegment(`${drinkQty ? `${drinkQty} ` : ''}${m[3]}`);
            if (food.length >= 3 && drink.length >= 3)
                return [food, drink];
        }
        const articleDrinkRe = new RegExp(`^(.+?)\\s+(?:(\\d{1,2}|${qtyWord})\\s+)?(?:un|una|unos|unas)\\s+(${drinkWithSize})`, 'i');
        m = raw.match(articleDrinkRe);
        if (m?.[1] && m?.[3]) {
            const food = this.cleanOrderSegment(m[1]);
            const drinkQty = m[2]?.trim();
            const drink = this.cleanOrderSegment(`${drinkQty ? `${drinkQty} ` : ''}${m[3]}`);
            if (food.length >= 3 && drink.length >= 3 && new RegExp(FOOD_ORDER_TOKEN, 'i').test(food)) {
                return [food, drink];
            }
        }
        if (drinkTail.test(raw) && new RegExp(FOOD_ORDER_TOKEN, 'i').test(raw)) {
            const idx = raw.search(new RegExp(`\\b(?:y|con|mas|más)\\s+(?:(?:\\d{1,2}|${qtyWord})\\s+)?(?:un|una|el|la)?\\s*${DRINK_ORDER_TOKEN}`, 'i'));
            if (idx > 0) {
                const food = this.cleanOrderSegment(raw.slice(0, idx));
                const drink = this.cleanOrderSegment(raw.slice(idx).replace(/^(?:y|con|mas|más)\s+/i, ''));
                if (food.length >= 3 && drink.length >= 3)
                    return [food, drink];
            }
        }
        return [];
    }
    findFoodDrinkCompanionProduct(text, known, products) {
        const q = normalizeText(text);
        if (!q)
            return null;
        if (this.isLikelyDrinkProduct(known)) {
            const pair = this.splitFoodPlusDrinkSegments(text);
            const foodQuery = pair[0] || text.replace(/\s+(?:y|con|mas|más)\s+.*$/i, '').trim();
            const scored = this.searchByNameScored(foodQuery, products, 6);
            const foodHits = scored.filter((x) => !this.isLikelyDrinkProduct(x.p));
            if (foodHits.length && (this.isStrongProductMatch(foodHits) || foodHits[0].score >= 40)) {
                return foodHits[0].p;
            }
            const strongTok = normalizeText(foodQuery)
                .split(' ')
                .filter((t) => t.length >= 5 && !this.WEAK_PRODUCT_TOKENS.has(t));
            if (strongTok.length) {
                const retry = this.searchByNameScored(strongTok.join(' '), products, 6).filter((x) => !this.isLikelyDrinkProduct(x.p));
                if (retry.length && retry[0].score >= 35)
                    return retry[0].p;
            }
            return null;
        }
        const drinkMatch = q.match(new RegExp(DRINK_ORDER_TOKEN, 'i'));
        if (!drinkMatch)
            return null;
        const pair = this.splitFoodPlusDrinkSegments(text);
        const drinkQuery = pair[1] || drinkMatch[0];
        if (this.drinkTextMatchesAttribute(known, drinkQuery || text))
            return null;
        const scored = this.searchByNameScored(`${drinkQuery} ${text}`, products, 10).filter((x) => this.isLikelyDrinkProduct(x.p));
        const pool = scored.length > 0
            ? scored.map((x) => x.p)
            : products.filter((p) => p.availableNow !== false && this.isLikelyDrinkProduct(p));
        return this.pickBestDrinkProduct(pool, `${drinkQuery} ${text}`);
    }
    looksLikeDeliveryTail(tail) {
        const t = normalizeText(tail);
        if (t.length < 4)
            return false;
        if (/\b(domicilio|delivery|la casa|mi casa|mi direccion|direccion)\b/.test(t))
            return true;
        if (/\b(habitacion|apto|apartamento|cuarto|suite|hostal|hotel|residencia)\b/.test(t) &&
            /\d/.test(t)) {
            return true;
        }
        if (/\b(calle|carrera|cra|cll|av|avenida|barrio|conjunto|conj|urbanizacion|urb|apto|apartamento|torre|edificio|senderos?|#)\b/.test(t)) {
            return true;
        }
        if ((0, whatsapp_intent_1.looksLikeDeliveryAddressFragment)(tail))
            return true;
        return t.length >= 6 && /\d/.test(t);
    }
    isLogisticsOnlySegment(segment) {
        const raw = (segment || '').trim();
        if (!raw)
            return true;
        if (this.isPolitenessOnlySegment(raw))
            return true;
        const n = normalizeText(raw);
        if (/^(un|una|unos|unas|el|la|los|las|para|por|favor|porfa)?\s*(domicilios?|delivery)\s*$/.test(n)) {
            return true;
        }
        if (/^(para\s+)?(un\s+|una\s+)?domicilios?$/.test(n))
            return true;
        return (0, whatsapp_intent_1.looksLikeDeliveryAddressFragment)(raw);
    }
    dedupeProductsById(products) {
        const map = new Map();
        for (const p of products)
            map.set(p.id, p);
        return [...map.values()];
    }
    formatProductChoicePrompt(query, candidates, opts) {
        const deduped = this.dedupeProductsById(candidates);
        if (deduped.length === 1) {
            return ((opts?.intro || `Encontré esto en el menú 👇`) +
                `\n\n${this.formatProductListItem(deduped[0])}\n\n` +
                `_¿Lo agrego? Responde *sí* o dime la porción/opción si aplica._`);
        }
        const family = this.findProductVariantFamily(query, deduped, deduped);
        if (family && family.variants.length >= 2) {
            return this.formatVariantFamilyPrompt(family);
        }
        const baseGroups = new Map();
        for (const p of deduped) {
            const base = this.getProductNameBase(p.name) || normalizeText(p.name);
            const list = baseGroups.get(base) || [];
            list.push(p);
            baseGroups.set(base, list);
        }
        if (baseGroups.size === 1) {
            const base = [...baseGroups.keys()][0];
            const variants = baseGroups.get(base);
            if (variants.length >= 2) {
                return this.formatVariantFamilyPrompt({
                    baseLabel: titleCaseWords(base),
                    baseKey: base,
                    variants,
                });
            }
        }
        const intro = opts?.intro || `Encontré *${deduped.length} opciones* 👇`;
        const body = deduped
            .map((p, i) => {
            const base = this.getProductNameBase(p.name);
            const label = base && normalizeText(p.name) !== base
                ? this.getVariantDisplayLabel(p.name, base)
                : p.name;
            const lines = [
                `${this.optionNumberEmoji(i + 1)} *${label}*`,
                `   ${this.formatProductMeta(p.price, p.code)}`,
            ];
            if (label !== p.name)
                lines.push(`   _${p.name}_`);
            if (p.hasAttributes)
                lines.push(`   ↳ Elige opciones al pedir`);
            return lines.join('\n');
        })
            .join('\n\n');
        return `${intro}\n\n${body}\n\n${this.formatListChoiceHint()}`;
    }
    findByCategory(query, products) {
        const q = normalizeText(query);
        if (!q || q.length < 3)
            return null;
        if (!this.isCategoryBrowseQuestion(query) &&
            this.findProductEmbeddedInMessage(query, products)) {
            return null;
        }
        if (/\b(link|enlace|url)\b/.test(q) ||
            /\b(pasa|dame|envia|manda|comparte)\b.*\b(menu|carta)\b/.test(q) ||
            /^(ver\s+)?(el\s+)?(menu|carta)(\s+completo)?$/.test(q)) {
            return null;
        }
        if (/\b(hacer|realizar)\s+(un\s+)?(pedido|orden)\b/.test(q) ||
            (/\b(quiero|gustaria|quisiera)\s+(pedir|ordenar|hacer)\b/.test(q) &&
                !/\b(pollos?|sopas?|bebidas?|gaseosas?|arroces?|bandejas?|porciones?|carnes?|hamburguesas?|combos?|jugos?|limonadas?|alas?|alitas?)\b/.test(q)) ||
            (/\b(pedido|orden)\b/.test(q) &&
                !/\b(pollo|sopa|bebida|porcion|porciones|combo|alas)\b/.test(q) &&
                q.split(' ').length >= 3)) {
            return null;
        }
        const available = products.filter((p) => p.availableNow !== false);
        const categoryNames = [
            ...new Set(available.map((p) => p.categoryName).filter(Boolean)),
        ];
        const significantTokens = q.split(' ').filter((t) => t.length >= 3);
        const isBrowseIntent = /\b(que|qué|tienen|hay|ver|lista|categoria|categoría|mostrame|muestrame|mostrar|opciones|recomiend|sugier|almuerzo|cena|antojo|platos|comer)\b/.test(q);
        const isShortCategoryQuery = significantTokens.length <= 2;
        let best = null;
        for (const cat of categoryNames) {
            const score = this.scoreCategoryNameMatch(q, cat, {
                isBrowseIntent,
                isShortCategoryQuery,
            });
            if (score >= 70 && (!best || score > best.score)) {
                best = { categoryName: cat, score };
            }
        }
        if (!best)
            return null;
        const list = available.filter((p) => p.categoryName === best.categoryName);
        if (!list.length)
            return null;
        const refined = this.refineCategoryListByQuery(q, best.categoryName, list);
        if (!refined.products.length)
            return null;
        return refined;
    }
    scoreCategoryNameMatch(q, categoryName, opts) {
        const c = normalizeText(categoryName);
        const cs = stemLoose(categoryName);
        if (!c)
            return 0;
        if (q === c || q === cs)
            return 100;
        const skip = new Set([
            'por', 'que', 'un', 'una', 'el', 'la', 'los', 'las', 'de', 'del', 'y', 'o',
            'ahora', 'tambien', 'pregunto', 'interesa', 'ver', 'dame', 'favor', 'gracias',
            'quiero', 'necesito', 'pedir', 'ordenar', 'tiene', 'tienen', 'tienes', 'hay',
            'hola', 'vecino', 'vecina', 'veci', 'buenas',
        ]);
        const generic = new Set(['comida', 'comidas', 'plato', 'platos', 'menu', 'carta', 'algo']);
        const qTokens = q.split(' ').filter((t) => t.length >= 3 && !skip.has(t));
        const cWords = c.split(' ').filter((w) => w.length >= 3);
        const wordHit = (w) => {
            const ws = stemLoose(w);
            return qTokens.some((tok) => tok === w || stemLoose(tok) === ws);
        };
        if (cWords.length >= 2) {
            const distinctive = cWords.filter((w) => !generic.has(w) && !generic.has(stemLoose(w)));
            const needed = distinctive.length ? distinctive : cWords;
            if (!needed.every(wordHit))
                return 0;
            return opts.isBrowseIntent ? 90 : 82;
        }
        const only = cWords[0] || c;
        if (!wordHit(only) && !(opts.isShortCategoryQuery && (q.includes(c) || c.includes(q)))) {
            return 0;
        }
        let score = opts.isShortCategoryQuery ? 85 : 72;
        if (opts.isBrowseIntent)
            score += 10;
        return score;
    }
    refineCategoryListByQuery(q, categoryName, list) {
        const catNorm = stemLoose(categoryName);
        const STOP = new Set([
            'que',
            'hay',
            'tienen',
            'tiene',
            'ver',
            'lista',
            'mostrar',
            'muestrame',
            'mostrame',
            'opciones',
            'categoria',
            'categoría',
            'como',
            'cual',
            'cuales',
            'para',
            'por',
            'con',
            'sin',
            'algo',
            'algun',
            'alguna',
            'dime',
            'dame',
            'quiero',
            'tengo',
            'interesa',
            'pregunto',
        ]);
        const tokens = q
            .split(' ')
            .filter((t) => t.length >= 3 && !STOP.has(t))
            .map((t) => stemLoose(t))
            .filter((t) => t !== catNorm && !catNorm.includes(t) && !t.includes(catNorm));
        if (!tokens.length) {
            return { categoryName, products: list };
        }
        const relevant = tokens.filter((t) => list.some((p) => {
            const hay = normalizeText(`${p.name} ${p.description || ''}`);
            return hay.includes(t);
        }));
        if (!relevant.length) {
            return { categoryName, products: [] };
        }
        const filtered = list.filter((p) => {
            const hay = normalizeText(`${p.name} ${p.description || ''}`);
            return relevant.some((t) => hay.includes(t));
        });
        if (!filtered.length) {
            return { categoryName, products: list };
        }
        const displayName = relevant.length === 1
            ? titleCaseWords(relevant[0])
            : relevant.length <= 3
                ? titleCaseWords(relevant.join(' / '))
                : categoryName;
        return { categoryName: displayName, products: filtered };
    }
    findCategoryBrowseHit(text, products, menuConceptGroups) {
        const trimmed = text.trim();
        if (!trimmed)
            return null;
        if (this.isRestaurantLocationInquiry(trimmed))
            return null;
        if (this.extractQuantityFromMessage(trimmed) >= 2)
            return null;
        const orderNoise = new Set([
            'quiero', 'dame', 'ponme', 'pedir', 'ordenar', 'agrega', 'agregame', 'necesito',
            'gustaria', 'quisiera', 'una', 'uno', 'unos', 'unas', 'por', 'favor',
        ]);
        if (/^(quiero|dame|ponme|agrega)[.!?,;:]*/i.test(trimmed) &&
            new RegExp(FOOD_ORDER_TOKEN, 'i').test(trimmed)) {
            const qNorm = normalizeText(this.extractProductSearchQuery(trimmed) || trimmed);
            const significant = qNorm
                .split(' ')
                .filter((t) => t.length >= 3 && !orderNoise.has(t));
            const hasStyleOrPortion = [...COOKING_STYLE_TOKENS].some((st) => this.queryHasToken(qNorm, st)) ||
                !!this.detectPortionHint(qNorm) ||
                /\b(1\s*\/\s*[24]|1\/[24]|combo|solo)\b/.test(qNorm);
            if (significant.length >= 2 || (significant.length === 1 && hasStyleOrPortion)) {
                return null;
            }
        }
        const extracted = this.extractProductSearchQuery(trimmed);
        const queries = extracted !== trimmed ? [extracted, trimmed] : [extracted];
        if (!this.isCategoryBrowseQuestion(trimmed) && !this.isMenuExploreIntent(trimmed, products)) {
            for (const q of queries) {
                const qNorm = normalizeText(q);
                const significant = qNorm
                    .split(' ')
                    .filter((t) => t.length >= 3 && !orderNoise.has(t));
                const looksSpecificDish = significant.length >= 2;
                if (!looksSpecificDish)
                    continue;
                const scored = this.searchByNameScored(q, products, 5);
                if (this.isStrongProductMatch(scored) && scored[0].score >= 70)
                    return null;
                if (this.findProductEmbeddedInMessage(q, products))
                    return null;
            }
        }
        for (const q of queries) {
            const byCat = this.findByCategory(q, products);
            if (byCat)
                return byCat;
        }
        for (const q of queries) {
            const byConcept = (0, whatsapp_menu_concepts_1.findByMenuConcept)(q, products, menuConceptGroups);
            if (byConcept) {
                return {
                    categoryName: byConcept.categoryName,
                    products: byConcept.products,
                    askedButMissing: byConcept.askedButMissing,
                };
            }
        }
        return null;
    }
    resolveCatalogQuestion(text, products) {
        const q = normalizeText(fixCommonOrderTypos((text || '').trim()));
        if (!q || q.length < 5)
            return null;
        if (this.isPriceInquiryIntent(text))
            return null;
        if (/^(quiero|dame|ponme|agrega|me\s+regalas|cambia|cambie|cambialo)\b/.test(q))
            return null;
        if (/\b(cambia|cambiar|cambie|en\s+vez|en\s+lugar)\b/.test(q))
            return null;
        if (!/\b(que|tienes|tienen|tiene|hay|manejan|venden|ofreces|ofrecen)\b/.test(q))
            return null;
        let kind = null;
        if (/\bjugos?\b/.test(q))
            kind = 'jugo';
        else if (/\blimonadas?\b/.test(q))
            kind = 'limonada';
        else if (/\bgaseosas?\b/.test(q))
            kind = 'gaseosa';
        else if (/\bsopas?\b/.test(q))
            kind = 'sopa';
        if (!kind)
            return null;
        const label = kind === 'jugo'
            ? 'Jugos'
            : kind === 'limonada'
                ? 'Limonadas'
                : kind === 'gaseosa'
                    ? 'Gaseosas'
                    : 'Sopas';
        const hits = products.filter((p) => p.availableNow !== false && this.productMatchesCatalogKind(p, kind));
        return { label, products: this.dedupeProductsById(hits).slice(0, 16) };
    }
    productMatchesCatalogKind(product, kind) {
        const name = normalizeText(product.name);
        const cat = normalizeText(product.categoryName || '');
        const hay = `${name} ${cat}`;
        if (/\b(combo|pollo|hamburguesa|arroz|bandeja|taco|alitas|ejecutivo)\b/.test(name)) {
            return false;
        }
        if (kind === 'jugo') {
            if (/\b(gaseosa|gaseosas|coca|pepsi|sprite|colombiana|postobon|7up)\b/.test(name) && !/\bjugo\b/.test(name)) {
                return false;
            }
            return /\b(jugos?|limonadas?|zumos?)\b/.test(hay);
        }
        if (kind === 'limonada')
            return /\blimonadas?\b/.test(hay);
        if (kind === 'gaseosa')
            return /\b(gaseosas?|coca|pepsi|sprite|colombiana|postobon)\b/.test(name);
        return /\bsopas?\b/.test(hay) || /\b(ajiaco|mondongo|sancocho)\b/.test(name);
    }
    findAlternativeMenuList(text, products, menuConceptGroups) {
        const q = normalizeText(fixCommonOrderTypos(text || ''));
        if (!q || !/\s+o\s+/.test(q))
            return null;
        if (this.extractQuantityFromMessage(text) >= 2)
            return null;
        if (/\b(o\s+no|o\s+que|o\s+algo|o\s+sea|horario|direccion)\b/.test(q))
            return null;
        const parts = q
            .split(/\s+o\s+/)
            .map((part) => part
            .replace(/^(quiero|dame|ponme|agrega|regalame|me\s+regalas|unas?|unos?|las?|los?|el|la|de|del)\s+/g, '')
            .replace(/\s+/g, ' ')
            .trim())
            .filter((part) => part.length >= 4);
        if (parts.length !== 2)
            return null;
        const styleOnly = /^(broaster|frit[oa]s?|asad[oa]s?|plancha|sudad[oa]s?|apanad[oa]s?)$/;
        if (parts.every((part) => styleOnly.test(part)))
            return null;
        const labels = [];
        const collected = [];
        for (const part of parts) {
            if (styleOnly.test(part))
                return null;
            const byCat = this.findByCategory(part, products);
            const byConcept = (0, whatsapp_menu_concepts_1.findByMenuConcept)(part, products, menuConceptGroups);
            let hits = byCat?.products?.length
                ? byCat.products
                : byConcept?.products?.length
                    ? byConcept.products
                    : [];
            if (!hits.length) {
                const stem = stemLoose(part.split(' ').filter((t) => t.length >= 4).pop() || part);
                hits = this.searchByName(part, products, 8).filter((p) => {
                    const n = normalizeText(p.name);
                    return n.includes(stem) || stemLoose(n).includes(stem);
                });
            }
            if (!hits.length)
                return null;
            labels.push(byCat?.categoryName || byConcept?.categoryName || titleCaseWords(part));
            collected.push(...hits);
        }
        const deduped = this.dedupeProductsById(collected).slice(0, 16);
        if (deduped.length < 2)
            return null;
        const categoryName = [...new Set(labels)].slice(0, 2).join(' / ');
        return { categoryName, products: deduped };
    }
    searchByName(query, products, limit = 8) {
        return this.searchByNameScored(query, products, limit).map((x) => x.p);
    }
    searchByNameScored(query, products, limit = 8) {
        const q = normalizeText(fixCommonOrderTypos(query));
        if (!q || q.length < 2)
            return [];
        if (this.isCourtesyOnlyMessage(query) || this.isOffTopicChitchat(query))
            return [];
        if (this.isRestaurantLocationInquiry(query))
            return [];
        if (this.looksLikeSideModificationNote(query))
            return [];
        const dropSides = this.hasAccompanimentModifierWithMain(query);
        if (/\b(link|enlace|url)\b/.test(q) ||
            /\b(pasa|dame|envia|manda|comparte)\b.*\b(menu|carta)\b/.test(q) ||
            /^(ver\s+)?(el\s+)?(menu|carta)(\s+completo)?$/.test(q)) {
            return [];
        }
        const STOP = new Set([
            'link',
            'enlace',
            'url',
            'menu',
            'carta',
            'pasa',
            'pasame',
            'dame',
            'quiero',
            'necesito',
            'envia',
            'enviame',
            'manda',
            'mandame',
            'ver',
            'por',
            'para',
            'una',
            'unos',
            'unas',
            'del',
            'los',
            'las',
            'con',
            'sin',
            'que',
            'como',
            'tiene',
            'tienen',
            'hay',
            'favor',
            'gracias',
            'gracia',
            'muchas',
            'thanks',
            'thank',
            'ok',
            'okay',
            'dale',
            'listo',
            'perfecto',
            'hola',
            'buenas',
            'buenos',
            'dias',
            'tardes',
            'noches',
            'completo',
            'pagina',
            'web',
            'hacer',
            'realizar',
            'armar',
            'pedido',
            'orden',
            'ordenar',
            'pedir',
            'gustaria',
            'quisiera',
            'deseo',
            'algo',
            'este',
            'esta',
            'tambien',
            'solo',
            'vengo',
            'vine',
            'direccion',
            'domicilio',
            'envio',
            'llevar',
            'calle',
            'carrera',
            'barrio',
            'cuentame',
            'contame',
            'narrame',
            'cuento',
            'cuentos',
            'cuentes',
            'historia',
            'chiste',
            'programar',
            'sabes',
            'puedes',
            'donde',
            'queda',
            'quedan',
            'estan',
            'restaurante',
            'restaurantes',
            'local',
            'negocio',
            'ubicacion',
            'mapa',
            'llego',
            'llegar',
            'sede',
            ...CHITCHAT_NOISE_TOKENS,
        ]);
        const available = products.filter((p) => p.availableNow !== false);
        const qStem = stemLoose(q);
        const tokenSet = new Set();
        for (const rawTok of q.split(' ').map((x) => x.trim()).filter((t) => t.length > 2)) {
            if (STOP.has(rawTok) || ORDER_INTENT_ONLY.has(rawTok))
                continue;
            if (/^\d+$/.test(rawTok))
                continue;
            tokenSet.add(rawTok);
            tokenSet.add(singularizeEsToken(rawTok));
        }
        const tokens = [...tokenSet].filter((t) => t.length > 2 && !STOP.has(t) && !ORDER_INTENT_ONLY.has(t));
        if (!tokens.length)
            return [];
        const styleInQuery = [...COOKING_STYLE_TOKENS].filter((st) => this.queryHasToken(q, st));
        const wordHas = (hay, needle) => {
            if (!needle)
                return false;
            if (needle.length <= 4) {
                return new RegExp(`(?:^|\\s)${escapeRegExp(needle)}(?:\\s|$)`).test(hay);
            }
            return hay.includes(needle);
        };
        const scored = available
            .map((p) => {
            const name = normalizeText(p.name);
            const desc = normalizeText(p.description || '');
            const cat = normalizeText(p.categoryName || '');
            let score = 0;
            if (name === q)
                score += 120;
            if (name.length >= 5 && q.includes(name)) {
                score += 95;
            }
            const nameTokens = name
                .split(' ')
                .map((t) => t.trim())
                .filter((t) => t.length > 2 && !STOP.has(t));
            if (nameTokens.length >= 2) {
                const hits = nameTokens.filter((t) => wordHas(q, t) || this.queryHasToken(q, t) || q.includes(t)).length;
                if (hits === nameTokens.length)
                    score += 85;
                else if (hits >= Math.ceil(nameTokens.length * 0.75))
                    score += 40;
            }
            else if (nameTokens.length === 1) {
                if (wordHas(q, nameTokens[0]) || this.queryHasToken(q, nameTokens[0]))
                    score += 35;
            }
            if (q.length >= 4 && q.split(' ').length <= 4) {
                if (wordHas(name, q) || wordHas(name, qStem))
                    score += 50;
                if (q.includes(name) && name.length > 3)
                    score += 40;
            }
            const coreTokens = tokens.filter((t) => !COOKING_STYLE_TOKENS.has(t));
            let coreNameHits = 0;
            if (tokens.length) {
                for (const t of tokens) {
                    if (COOKING_STYLE_TOKENS.has(t)) {
                        continue;
                    }
                    const ts = stemLoose(t);
                    if (wordHas(name, t) || wordHas(name, ts) || this.queryHasToken(name, t)) {
                        score += 18;
                        coreNameHits += 1;
                    }
                    else if (name.includes(t) && t.length >= 5) {
                        score += 10;
                        coreNameHits += 1;
                    }
                    else if (t.length >= 7 &&
                        nameTokens.some((nt) => fuzzyTokenMatch(t, nt) || fuzzyTokenMatch(t, singularizeEsToken(nt)))) {
                        score += 18;
                        coreNameHits += 1;
                    }
                    if (wordHas(desc, t) && t.length >= 5)
                        score += 2;
                    if (wordHas(cat, t))
                        score += 4;
                }
            }
            if (styleInQuery.length && coreNameHits > 0) {
                let styleOnProduct = 0;
                for (const st of styleInQuery) {
                    if (productOffersCookingStyle(p, st)) {
                        score += 45;
                        styleOnProduct += 1;
                    }
                }
                if (styleOnProduct === 0) {
                    score -= 15;
                    if (productHasConflictingCookingStyle(name, styleInQuery)) {
                        score -= 55;
                    }
                }
            }
            else if (styleInQuery.length && coreNameHits === 0 && coreTokens.length > 0) {
                score = Math.min(score, 8);
            }
            if (score >= 50 && nameTokens.length >= 2) {
                const extra = nameTokens.filter((t) => !COOKING_STYLE_TOKENS.has(t) &&
                    !wordHas(q, t) &&
                    !this.queryHasToken(q, t) &&
                    !q.includes(singularizeEsToken(t)));
                const packExtra = extra.filter((t) => PACK_MULTIPLIER_TOKENS.has(t));
                if (!extra.length)
                    score += Math.min(12, nameTokens.length * 3);
                else if (packExtra.length)
                    score -= 45 * packExtra.length;
                else
                    score -= Math.min(12, extra.length * 4);
            }
            if (this.productNameHasPackMultiplier(name) && !this.queryAsksForPackMultiplier(q)) {
                score -= 90;
            }
            const variantHint = this.extractVariantPreferenceHint(q);
            if (variantHint === 'combo') {
                if (/\bcombo\b/.test(name) || this.productImpliesCombo(p))
                    score += 80;
                else if (!/\bcombo\b/.test(name) && !/\bsolo\b/.test(name))
                    score -= 25;
            }
            else if (variantHint === 'solo') {
                if (/\bsolo\b/.test(name))
                    score += 80;
                else if (/\bcombo\b/.test(name))
                    score -= 50;
            }
            const nameHasMenuWrapper = [...whatsapp_named_menu_dish_1.MENU_WRAPPER_TOKENS].some((t) => this.queryHasToken(name, t));
            const queryHasMenuWrapper = [...whatsapp_named_menu_dish_1.MENU_WRAPPER_TOKENS].some((t) => this.queryHasToken(q, t));
            if (nameHasMenuWrapper && !queryHasMenuWrapper) {
                return { p, score: 0 };
            }
            if (queryHasMenuWrapper) {
                if (nameHasMenuWrapper)
                    score += 110;
                else if (/\b(pollo|broaster|frito|asado|pechuga)\b/.test(name) && !nameHasMenuWrapper) {
                    score -= 90;
                }
            }
            if (q.length >= 5 && name.includes(q) && name !== q) {
                const ratio = q.length / Math.max(name.length, 1);
                if (ratio >= 0.75)
                    score += 40;
                else if (ratio >= 0.45)
                    score += 10;
                else
                    score -= 55;
            }
            const qSing = singularizeEsToken(q.replace(/\b(un|una|unos|unas|pedi|pido|quiero|dame)\b/g, ' ').replace(/\s+/g, ' ').trim());
            const nameSing = singularizeEsToken(name);
            if (name === q || nameSing === qSing)
                score += 80;
            else if (nameTokens.length === 1 &&
                (nameTokens[0] === qSing || singularizeEsToken(nameTokens[0]) === qSing)) {
                score += 55;
            }
            if (qSing.length >= 8 &&
                (name === qSing ||
                    name.endsWith(qSing) ||
                    name.replace(/^\d+\s+/, '') === qSing ||
                    name.replace(/^1\s+/, '') === qSing)) {
                score += 70;
            }
            const qPortion = this.detectPortionHint(q);
            const pPortion = this.detectProductPortionSize(name);
            if (qPortion && pPortion) {
                if (qPortion === pPortion)
                    score += 90;
                else
                    score -= 55;
            }
            else if (qPortion === 'medio' &&
                /\barroz\b/.test(q) &&
                /\barroz\b/.test(name) &&
                /\bmedio\b/.test(name)) {
                score += 90;
            }
            else if (qPortion === 'medio' && /^1\s+pollo\b/.test(name)) {
                score -= 50;
            }
            if (/\b(pollo|broaster|frito)\b/.test(q) &&
                !/\b(combo|bandeja|ejecutivo|alitas|arroz|taco|hamburguesa|menu)\b/.test(q)) {
                if (/\b(combo|bandeja|ejecutivo|alitas|arroz|taco|hamburguesa|menu)\b/.test(name)) {
                    score -= 80;
                }
            }
            if (this.isLikelyDrinkProduct(p)) {
                const wantMl = this.extractRequestedDrinkVolumeMl(query);
                const vol = this.productDrinkVolumeMl(p);
                if (wantMl != null && vol != null) {
                    const diff = Math.abs(vol - wantMl);
                    if (diff === 0)
                        score += 95;
                    else if (diff <= 100)
                        score += 60;
                    else if (diff <= wantMl * 0.2)
                        score += 30;
                    else
                        score -= 70;
                }
            }
            const servingSize = this.detectServingSizeHint(q);
            if (servingSize && /\b(sopa|ajiaco|mondongo|menudencia)\b/.test(q + ' ' + name)) {
                const smallSku = this.productIsSmallServing(name);
                if (servingSize === 'pequena') {
                    if (smallSku)
                        score += 95;
                    else if (/\bsopa\b/.test(name))
                        score -= 70;
                }
                else if (servingSize === 'grande') {
                    if (smallSku)
                        score -= 80;
                    else if (/\bsopa\b/.test(name) || /\bajiaco\b/.test(name))
                        score += 35;
                }
            }
            if (/\bejecutivo\b/.test(q) || (/\balmuerzo\b/.test(q) && /\bejecutivo\b/.test(q))) {
                if (/\bejecutivo\b/.test(name))
                    score += 100;
                if (/^sopa\b/.test(name) || /\bsopa\s+de\b/.test(name))
                    score -= 120;
                if (/\bpechuga\b/.test(q) && /\bpechuga\b/.test(name) && /\bejecutivo\b/.test(name)) {
                    score += 60;
                }
                if (/\bpechuga\b/.test(q) &&
                    /\bpechuga\b/.test(name) &&
                    !/\bejecutivo\b/.test(name)) {
                    score -= 40;
                }
            }
            const wantsPapa = /\bpapas?\b/.test(q) && !/\byuca\b/.test(q);
            const wantsYuca = /\byuca\b/.test(q) && !/\bpapas?\b/.test(q);
            if (wantsPapa && /\byuca\b/.test(name))
                score -= 130;
            if (wantsYuca && /\bpapas?\b/.test(name) && !/\byuca\b/.test(name))
                score -= 130;
            if (wantsPapa &&
                (/\bfritas?\b/.test(q) || /\bfrancesa\b/.test(q)) &&
                (/\bfrancesa\b/.test(name) || (/\bpapas?\b/.test(name) && /\bfritas?\b/.test(name)))) {
                score += 90;
            }
            if (/\bagua\b/.test(q) && !/\bjugo\b/.test(q)) {
                if (/\bjugo\b/.test(name) || /\ben\s+agua\b/.test(name))
                    score -= 100;
                if (/^agua\b/.test(name) || /\bagua\s+\d/.test(name))
                    score += 40;
                if (/\b600\b/.test(q) && /\b600\b/.test(name))
                    score += 50;
            }
            return { p, score };
        })
            .filter((x) => x.score >= 18)
            .filter((x) => !(dropSides && this.isLikelySideOnlyProduct(x.p)))
            .sort((a, b) => b.score - a.score || a.p.name.length - b.p.name.length)
            .slice(0, limit);
        return scored;
    }
    isStrongProductMatch(scored) {
        if (!scored.length)
            return false;
        const top = scored[0].score;
        if (top >= 80)
            return true;
        if (scored.length === 1 && top >= 50)
            return true;
        if (scored.length >= 2 && top >= 70 && top - scored[1].score >= 25)
            return true;
        return false;
    }
    isPriceInquiryIntent(text) {
        const raw = text.trim();
        const q = normalizeText(raw);
        if (!q)
            return false;
        const hasPriceAsk = /\b(cuanto vale|cuanto valen|cuanto cuesta|cuanto cuestan|cuanto sale|cuanto salen|cuanto esta|cuanto cobran|cuanto seria|cuanto costaria|a cuanto|a como|que precio|q precio|precio de|precio del|precio tiene|precio por|valor de|me costaria|cuanto me sale|que cuestan|q cuestan|que cuesta|q cuesta|que valen|q valen|que vale|q vale|regala(?:s|me)? el costo|regala(?:s|me)? el precio|el costo por favor)\b/.test(q) ||
            /\b(cuesta|cuestan|valen)\b/.test(q) ||
            (/\b(cuanto|precio|valor|costo)\b/.test(q) &&
                (/\?/.test(raw) || /\b(sopa|pollo|arroz|bandeja|combo|gaseosa|menudencia|ajiaco|pechuga)\b/.test(q)));
        if (!hasPriceAsk)
            return false;
        const orderDominant = /^(quiero|dame|ponme|agrega|agregame|me das|me regalas|voy a pedir)\s+(un|una|unos|unas|el|la|los|las)\s+/i.test(raw) && !/\b(cuanto|precio|vale|valen|cuesta|cuestan|valor|costo|a\s+como|a\s+cuanto|regala(?:s|me)?\s+el\s+costo)\b/i.test(raw);
        return !orderDominant;
    }
    stripPriceInquiryNoise(text) {
        return text
            .replace(/\b(cu[aá]nto vale[n]?|cu[aá]nto cuesta[n]?|cu[aá]nto sale[n]?|cu[aá]nto est[aá]|cu[aá]nto cobran|cu[aá]nto ser[ií]a|cu[aá]nto costar[ií]a|a cu[aá]nto|a c[oó]mo|qu[eé] precio|q precio|precio de(l| la| los| las)?|precio tiene|precio por|valor de(l| la| los| las)?|cu[aá]nto me sale|me costar[ií]a|qu[eé] cuesta[n]?|q cuesta[n]?|qu[eé] vale[n]?|q vale[n]?)\b/gi, ' ')
            .replace(/\b(cu[aá]nto|precio|valor|cuesta[n]?|vale[n]?|cobran)\b/gi, ' ')
            .replace(/^\s*q\s+/i, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    stripAvailabilityInquiryNoise(text) {
        return (text || '')
            .replace(/[¿?¡!]+/g, ' ')
            .replace(/^(?:y\s+)?(?:no\s+)?(?:me\s+)?(?:tienes|tiene|tienen|hay|venden|vendes|manejan|maneja|consiguen)\s+(?:de\s+|we\s+|unas?\s+|unos?\s+|el\s+|la\s+|los\s+|las\s+)?/i, '')
            .replace(/\b(?:por\s+favor|porfa|por\s+fa|pf|gracias|ahora|hoy|alla|allá)\b/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    availabilitySubject(text) {
        let q = normalizeText(text || '');
        if (!q || q.length < 6)
            return null;
        if (/^(?:que|cual|cuales|como)\b/.test(q))
            return null;
        q = q
            .replace(/^(?:te|le)\s+(?:pregunte|pregunto|dije|digo|estoy\s+preguntando|volvi\s+a\s+preguntar)\s+(?:que\s+)?(?:si\s+)?/, '')
            .trim();
        const tokens = q.split(/\s+/).filter(Boolean);
        const idx = tokens.findIndex((t) => this.isAvailabilityVerbToken(t));
        if (idx < 0)
            return null;
        const lead = new Set([
            'algo',
            'alguna',
            'algun',
            'alguno',
            'algunas',
            'algunos',
            'un',
            'una',
            'unos',
            'unas',
            'de',
            'del',
            'el',
            'la',
            'los',
            'las',
            'me',
            'por',
            'favor',
            'we',
        ]);
        const rest = tokens.slice(idx + 1);
        while (rest.length && lead.has(rest[0]))
            rest.shift();
        const subject = rest.join(' ').replace(/[?.!]+$/g, '').trim();
        if (subject.length < 3)
            return null;
        if (/^(domicilio|horario|servicio|abierto|abiertos|pedido)$/.test(subject))
            return null;
        return subject;
    }
    isAvailabilityVerbToken(token) {
        const t = normalizeText(token);
        if (t === 'hay')
            return true;
        const verbs = [
            'tienes',
            'tiene',
            'tienen',
            'venden',
            'vendes',
            'manejan',
            'maneja',
            'consiguen',
            'conseguiste',
        ];
        if (verbs.includes(t))
            return true;
        if (t.length < 4)
            return false;
        return verbs.some((v) => t.slice(0, 2) === v.slice(0, 2) && tokenEditDistance(t, v) <= 1);
    }
    menuMentionsSubject(subject, products) {
        const words = normalizeText(subject)
            .split(/\s+/)
            .filter((w) => w.length >= 4);
        if (!words.length)
            return false;
        return products.some((p) => {
            if (p.availableNow === false)
                return false;
            const blobWords = normalizeText(`${p.name} ${p.description || ''} ${p.categoryName || ''}`).split(/\s+/);
            return words.every((w) => blobWords.some((b) => b === w || nearDishToken(w, b)));
        });
    }
    unavailableAskReply(text, products, menuUrl) {
        const subject = this.availabilitySubject(text);
        if (!subject || this.menuMentionsSubject(subject, products))
            return null;
        const menu = (menuUrl || '').trim();
        return (`No tenemos productos de ${subject}.` +
            (menu ? `\n\nSi quieres mira el menú: ${menu}` : '') +
            `\n\n¿Qué se te antoja?`);
    }
    formatNotOnMenuReply(dishLabel, menuUrl) {
        const label = (dishLabel || '')
            .replace(/[¿?¡!.]+$/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        const nice = label || 'eso';
        const menu = (menuUrl || '').trim();
        return (`Por ahora no manejamos *${nice}* 🙏\n` +
            (menu
                ? `Si quieres mira el menú: ${menu}`
                : 'Si quieres escribe *menú* y te oriento con lo que sí tenemos.') +
            `\n\n¿Qué se te antoja?`);
    }
    extractMentionedPriceCop(text) {
        const raw = (text || '').trim();
        if (!raw)
            return null;
        let m = raw.match(/\b(?:de\s+|a\s+|por\s+|vale\s+|cuesta\s+|sale\s+)?\$?\s*(\d{1,3})\s*(?:mil|k)\b/i);
        if (m?.[1]) {
            const n = parseInt(m[1], 10);
            if (Number.isFinite(n) && n >= 5 && n <= 500)
                return n * 1000;
        }
        m = raw.match(/\b(?:de\s+|a\s+|por\s+|vale\s+|cuesta\s+|sale\s+)?\$?\s*(\d{1,3}(?:[.,]\d{3})+|\d{4,6})\b/);
        if (m?.[1]) {
            const n = parseInt(m[1].replace(/[.,]/g, ''), 10);
            if (Number.isFinite(n) && n >= 3000 && n <= 500000)
                return n;
        }
        return null;
    }
    pickProductByMentionedPrice(products, priceCop, tolerance = 1500) {
        if (!products.length || !Number.isFinite(priceCop) || priceCop <= 0)
            return null;
        const hits = products
            .filter((p) => p.availableNow !== false)
            .map((p) => ({ p, diff: Math.abs(Math.round(Number(p.price) || 0) - priceCop) }))
            .filter((x) => x.diff <= tolerance)
            .sort((a, b) => a.diff - b.diff || a.p.name.length - b.p.name.length);
        if (!hits.length)
            return null;
        const best = hits[0].diff;
        const tied = hits.filter((x) => x.diff === best);
        if (tied.length > 1)
            return null;
        return tied[0].p;
    }
    stripMentionedPriceFromQuery(text) {
        return (text || '')
            .replace(/\b(?:de\s+|a\s+|por\s+|vale\s+|cuesta\s+|sale\s+)?\$?\s*\d{1,3}\s*(?:mil|k)\b/gi, ' ')
            .replace(/\b(?:de\s+|a\s+|por\s+|vale\s+|cuesta\s+|sale\s+)?\$?\s*\d{1,3}(?:[.,]\d{3})+\b/gi, ' ')
            .replace(/\b(?:de\s+|a\s+|por\s+|vale\s+|cuesta\s+|sale\s+)?\$?\s*\d{4,6}\b/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    formatProductPriceReply(product, opts) {
        const schedule = (opts?.scheduleLead || '').trim() || this.formatProductScheduleNote(product) || '';
        let msg = schedule ? `${schedule}\n\n` : '';
        msg += this.formatProductHeader(product.name, product.price, product.code);
        if (product.description?.trim()) {
            msg += `\n\n${this.formatProductSubtitle(product.description.trim(), 280)}`;
        }
        else {
            msg += `\n\n_No tengo el detalle de ingredientes aquí._`;
        }
        if (product.hasAttributes && product.attributes?.length) {
            const optionLines = product.attributes
                .filter((a) => !this.isComboOnlyAttribute(a))
                .map((a) => `• *${a.attributeName}:* ${a.options.slice(0, 6).join(' · ')}`)
                .filter(Boolean);
            if (optionLines.length) {
                msg += `\n\n*Al pedirlo eliges:*\n${optionLines.join('\n')}`;
            }
        }
        if (opts?.offerAdd !== false) {
            msg += '\n\n_¿Te lo agrego al pedido? Responde *sí*._';
        }
        return msg;
    }
    formatProductScheduleNote(product) {
        const blob = `${product.name || ''} ${product.description || ''}`;
        const weekendOnly = /\bfines?\s+de\s+semana\b/i.test(blob) ||
            /\bs[aá]bados?\s+y\s+domingos?\b/i.test(blob);
        if (!weekendOnly)
            return null;
        if (product.availableNow === false) {
            return '⏰ Es de *fines de semana* y *ahora no está* en horario.';
        }
        return '⏰ Es de *fines de semana* y *hoy sí lo tenemos* ✅';
    }
    isWeekendScheduleQuestion(text) {
        const q = normalizeText(text);
        if (!q)
            return false;
        return (/\b(solo\s+(el\s+)?fin(es)?\s+de\s+semana|fines?\s+de\s+semana|entre\s+semana|solo\s+los?\s+(sabados?|domingos?))\b/.test(q) || /\bo\s+solo\s+(el\s+)?fin/.test(q));
    }
    formatMultiProductPriceReply(products) {
        if (!products.length)
            return '';
        if (products.length === 1)
            return this.formatProductPriceReply(products[0]);
        const lines = ['💰 *Cotización:*\n'];
        let total = 0;
        for (const p of products) {
            total += Math.round(p.price || 0);
            lines.push(this.formatProductHeader(p.name, p.price, p.code));
            const hints = [];
            if (p.hasAttributes && p.attributes?.length) {
                for (const a of p.attributes.filter((x) => !this.isComboOnlyAttribute(x))) {
                    hints.push(`*${a.attributeName}:* ${a.options.slice(0, 4).join(' · ')}`);
                }
            }
            if (hints.length) {
                lines.push(`   _${hints.join(' · ')}_`);
            }
            lines.push('');
        }
        lines.push(`*Estimado (sin domicilio): $${total.toLocaleString('es-CO')}*`);
        lines.push('\n_¿Te los agrego al pedido? Responde *sí*._');
        return lines.join('\n');
    }
    resolvePriceInquiryProducts(text, products, opts) {
        const stripped = this.stripPriceInquiryNoise(text);
        const source = (stripped || text || '').trim();
        if (!source)
            return [];
        const sizedChicken = this.resolveSizedChickenProduct(text, products, opts);
        if (sizedChicken) {
            return [sizedChicken];
        }
        const portionChicken = this.listSizedChickenProductsForInquiry(source, products, opts);
        if (portionChicken.length) {
            return portionChicken;
        }
        let hits = this.findAllProductsEmbeddedInMessage(source, products);
        const sizedSoup = this.resolveSizedSoupProduct(source, products);
        if (sizedSoup) {
            hits = [sizedSoup, ...hits.filter((p) => p.id !== sizedSoup.id)];
        }
        hits = this.dedupeSoupHitsForInquiry(source, hits);
        if (hits.length >= 2) {
            return this.orderProductsByTextMention(source, hits);
        }
        const one = this.findProductEmbeddedInMessage(source, products) ||
            this.findProductEmbeddedInMessage(text, products) ||
            hits[0];
        return one ? [one] : [];
    }
    listSizedChickenProductsForInquiry(text, products, opts) {
        const q = normalizeText(fixCommonOrderTypos(text));
        if (!/\bpollo\b/.test(q) && !this.isBareChickenPortionFollowUp(text, q))
            return [];
        if (/\b(arroz|bandeja|ejecutivo|taco|hamburguesa)\b/.test(q))
            return [];
        const portion = this.detectPortionHint(q);
        if (!portion)
            return [];
        let style = /\bbroaster\b/.test(q)
            ? 'broaster'
            : /\bfrit[oa]s?\b/.test(q)
                ? 'frito'
                : /\basado\b/.test(q)
                    ? 'asado'
                    : null;
        if (!style && opts?.preferStyleFromName) {
            const focus = normalizeText(opts.preferStyleFromName);
            if (/\bbroaster\b/.test(focus))
                style = 'broaster';
            else if (/\bfrit[oa]s?\b/.test(focus))
                style = 'frito';
            else if (/\basado\b/.test(focus))
                style = 'asado';
        }
        const available = products.filter((p) => p.availableNow !== false);
        const cands = available.filter((p) => {
            const n = normalizeText(p.name);
            if (/\b(combo|bandeja|ejecutivo|alitas|arroz|taco|hamburguesa|pechuga|menu)\b/.test(n)) {
                return false;
            }
            if (!/\bpollo\b/.test(n))
                return false;
            if (this.detectProductPortionSize(n) !== portion)
                return false;
            if (style === 'broaster' && !/\bbroaster\b/.test(n))
                return false;
            if (style === 'frito' && !/\bfrito\b/.test(n))
                return false;
            if (style === 'asado' && !/\basado\b/.test(n))
                return false;
            return true;
        });
        return this.dedupeProductsById(cands).sort((a, b) => a.name.length - b.name.length);
    }
    dedupeSoupHitsForInquiry(text, hits) {
        if (hits.length < 2)
            return hits;
        const q = normalizeText(text);
        const hasSmallSku = hits.some((p) => {
            const n = normalizeText(p.name);
            return /^sopa\s+pequena\b/.test(n) || n === 'sopa pequena';
        });
        if (hasSmallSku || this.detectServingSizeHint(q) === 'pequena') {
            return hits.filter((p) => {
                const n = normalizeText(p.name);
                if (/^sopa\s+de\s+(ajiaco|menudencias?|mondongo)\b/.test(n))
                    return false;
                return true;
            });
        }
        return hits;
    }
    orderProductsByTextMention(text, hits) {
        const q = normalizeText(text);
        return [...hits].sort((a, b) => {
            const ia = this.firstMentionIndex(q, a);
            const ib = this.firstMentionIndex(q, b);
            return ia - ib || a.name.length - b.name.length;
        });
    }
    firstMentionIndex(q, product) {
        const name = normalizeText(product.name);
        let idx = name.length >= 4 ? q.indexOf(name) : -1;
        if (idx >= 0)
            return idx;
        const toks = name
            .split(' ')
            .filter((t) => t.length >= 5 && this.isDistinctiveProductToken(t));
        for (const t of toks) {
            const i = q.indexOf(t);
            if (i >= 0)
                return i;
        }
        return 9999;
    }
    formatProductVariantsOverview(product, mode = 'info', alreadySelected = []) {
        const remaining = this.getRemainingAttributes(product, alreadySelected);
        const next = remaining[0];
        if (mode === 'info') {
            const infoAttrs = remaining.filter((a) => !this.isComboOnlyAttribute(a));
            if (!infoAttrs.length && remaining.length > 0) {
                return this.formatAttributeStepPrompt(product, remaining[0], alreadySelected, {
                    mode: 'order',
                });
            }
            if (!infoAttrs.length && (product.attributes || []).some((a) => this.isComboOnlyAttribute(a))) {
                return (`${this.formatProductHeader(product.name, product.price, product.code)}\n` +
                    `_Combo: eliges gaseosa al pedir. Di porción o “pedir”._`);
            }
            if (infoAttrs.length === 1) {
                return this.formatAttributeStepPrompt(product, infoAttrs[0], alreadySelected, {
                    mode: 'info',
                });
            }
            let msg = this.formatProductHeader(product.name, product.price, product.code);
            for (const attr of infoAttrs) {
                msg += `\n\n${this.formatAttributeStepPrompt(product, attr, alreadySelected, { mode: 'info', skipHeader: true })}`;
            }
            return msg;
        }
        if (!next?.options?.length) {
            return `${this.formatProductHeader(product.name, product.price, product.code)}\n\n_¿Cuál opción prefieres?_`;
        }
        return this.formatAttributeStepPrompt(product, next, alreadySelected, { mode: 'order' });
    }
    optionNumberEmoji(index) {
        const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
        return emojis[index - 1] || `${index}.`;
    }
    formatOptionsList(rows) {
        return rows
            .map((r) => {
            const code = r.code != null ? ` · ${this.formatProductCode(r.code)}` : '';
            return `${this.optionNumberEmoji(r.index)} *${r.label}* · ${this.formatMoney(r.price)}${code}`;
        })
            .join('\n');
    }
    isVariantPreferenceIntent(text) {
        const q = normalizeText(text);
        if (!q || q.length < 4)
            return false;
        if (/\b(en\s+combo|en\s+solo|sin\s+combo|con\s+combo|que\s+sea\s+combo|que\s+sea\s+solo|mejor\s+en\s+combo|mejor\s+en\s+solo|mejor\s+combo|mejor\s+solo|cambiar\s+a\s+combo|cambialo\s+a\s+combo|cambiar\s+a\s+solo)\b/.test(q)) {
            return true;
        }
        if (/\b(dame(lo|melo)|demelo|pon(lo|me)|ponme|agrega(me)?|quiero|quieor|qiero|kiero)\s+(el\s+|un\s+|una\s+)?(pollo\s+)?(frito\s+|broaster\s+)?(en\s+)?(combo|solo)\b/.test(q)) {
            return true;
        }
        if (/\b(no\s+quiero\s+(un\s+)?solo|no\s+quiero\s+solo)\b/.test(q) && /\bcombo\b/.test(q)) {
            return true;
        }
        if (/^(combo|solo)[\s!.?]*$/.test(q.trim()))
            return true;
        return false;
    }
    isComboAvailabilityQuestion(text) {
        const q = normalizeText(text);
        if (!q || q.length < 6)
            return false;
        if (!/\?/.test(text.trim()) && !/\b(tienen|tiene|hay|venden|manejan|sirven)\b/.test(q)) {
            return false;
        }
        return (/\b(en\s+combo|version\s+combo|opcion\s+combo|la\s+opcion\s+combo|modo\s+combo)\b/.test(q) ||
            (/\bcombo\b/.test(q) &&
                /\b(tienen|tiene|hay|viene|manejan|venden|lo\s+tienen|la\s+tienen)\b/.test(q)));
    }
    extractVariantPreferenceHint(text) {
        const q = normalizeText(text);
        if (/\bcombo\b/.test(q) && !/\bsolo\b/.test(q))
            return 'combo';
        if (/\bsolo\b/.test(q) && !/\bcombo\b/.test(q))
            return 'solo';
        if (/\bcombo\b/.test(q))
            return 'combo';
        return null;
    }
    formatAttributeStepPrompt(product, attr, alreadySelected = [], opts) {
        const rows = attr.options.map((opt, i) => ({
            index: i + 1,
            label: opt,
            price: product.price,
        }));
        const parts = [];
        const showComboOnly = this.shouldShowComboOnlyAttributes(product, alreadySelected);
        const totalSteps = (product.attributes || []).filter((a) => !this.isDeferredDrinkAttribute(a, product) || showComboOnly).length;
        const doneSteps = alreadySelected.filter((s) => !this.isDeferredDrinkAttribute({ attributeName: s.attributeName }, product) ||
            showComboOnly).length;
        const stepNum = Math.min(totalSteps, doneSteps + 1);
        if (!opts?.skipHeader) {
            parts.push(`🍽️ *${product.name}* (${this.formatProductCode(product.code)})`);
        }
        if (alreadySelected.length) {
            parts.push(`✅ _${alreadySelected.map((s) => s.attributeValue).join(' · ')}_`);
        }
        if (totalSteps > 1 && opts?.mode !== 'info') {
            parts.push(`*${stepNum}/${totalSteps}* · *${attr.attributeName}*`);
        }
        const question = totalSteps > 1 && opts?.mode !== 'info'
            ? null
            : this.isComboOnlyAttribute(attr)
                ? `¿Qué *${attr.attributeName}* quieres?`
                : `Elige *${attr.attributeName}*:`;
        if (question)
            parts.push(question);
        parts.push(this.formatOptionsList(rows));
        parts.push('_Escribe el número._');
        return parts.filter(Boolean).join('\n');
    }
    getProductNameBase(name) {
        return normalizeText(name)
            .replace(/\b(solo|sola|completo|completa|combo|con\s+gaseosa|con\s+bebida|sin\s+gaseosa|sin\s+bebida|mas\s+gaseosa|y\s+gaseosa)\b/g, ' ')
            .replace(/\b(con\s+(?:1\s*\/\s*2|medio|media)\s+pollo|con\s+pollo(?:\s+entero)?|con\s+costillas?(?:\s+de\s+cerdo)?|con\s+papa(?:s)?\s+(?:a\s+la\s+)?francesa|con\s+francesa|caja)\b/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/^(?:1\s*\/\s*[24]|1\/[24]|medio|media|cuarto|cuarta|entero|entera|1)\s+/i, '')
            .replace(/^de\s+/i, '')
            .replace(/\s+/g, ' ')
            .trim();
    }
    stripCookingStyleTokens(name) {
        return normalizeText(name)
            .split(/\s+/)
            .filter((t) => t.length > 0 && !COOKING_STYLE_TOKENS.has(t) && !COOKING_STYLE_TOKENS.has(singularizeEsToken(t)))
            .join(' ')
            .trim();
    }
    getVariantDisplayLabel(fullName, baseKey) {
        const n = normalizeText(fullName);
        const tail = n.replace(baseKey, '').trim();
        if (/\bsolo\b/.test(tail) || /\bsola\b/.test(tail))
            return 'Solo (sin combo/bebida)';
        if (/\bcombo\b/.test(tail))
            return 'Combo (con bebida)';
        if (/\b(completo|completa)\b/.test(tail))
            return 'Completo (con bebida)';
        if (/\b(con\s+gaseosa|con\s+bebida|gaseosa|bebida)\b/.test(tail)) {
            return 'Con gaseosa / bebida';
        }
        if (/\b(medio|1\s*\/\s*2|1\/2)\s+pollo\b/.test(n))
            return 'Con medio pollo';
        if (/\bcostillas?\b/.test(n))
            return 'Con costillas';
        if (/\b(francesa|caja)\b/.test(n))
            return 'Caja / papa francesa';
        if (tail.length >= 3)
            return titleCaseWords(tail);
        return fullName;
    }
    findProductVariantFamily(query, products, hints = []) {
        const rawQ = this.extractProductSearchQuery(query);
        const q = normalizeText(this.stripQuantityFromSearchQuery(rawQ) || rawQ);
        if (q.length < 4)
            return null;
        const available = products.filter((p) => p.availableNow !== false);
        if (/\b(?:menu\s+)?ejecutivo\b/.test(q)) {
            const executiveVariants = available.filter((p) => /\bejecutivo\b/.test(normalizeText(p.name)));
            if (executiveVariants.length >= 2) {
                return { baseKey: 'ejecutivo', baseLabel: 'Ejecutivo', variants: executiveVariants };
            }
        }
        const scored = this.searchByNameScored(q, available, 12).filter((x) => x.score >= 38);
        const byBaseName = available.filter((p) => {
            const base = this.getProductNameBase(p.name);
            if (base.length < 4)
                return false;
            return (base === q ||
                q.includes(base) ||
                (q.length >= 5 && (base.startsWith(q) || q.startsWith(base))) ||
                (q.split(/\s+/).length >= 2 && base === q));
        });
        const seed = [
            ...hints,
            ...scored.map((x) => x.p),
            ...byBaseName,
        ];
        if (!seed.length)
            return null;
        const styleBaseCounts = new Map();
        for (const p of seed) {
            const styleBase = this.stripCookingStyleTokens(p.name);
            if (styleBase.length < 4)
                continue;
            styleBaseCounts.set(styleBase, (styleBaseCounts.get(styleBase) || 0) + 1);
        }
        let bestStyleBase = '';
        let bestStyleCount = 0;
        for (const [k, c] of styleBaseCounts) {
            if (c > bestStyleCount) {
                bestStyleCount = c;
                bestStyleBase = k;
            }
        }
        let bestBase = '';
        let bestCount = 0;
        let useCookingStyleFamily = false;
        const baseCounts = new Map();
        for (const p of seed) {
            const base = this.getProductNameBase(p.name);
            if (base.length < 4)
                continue;
            baseCounts.set(base, (baseCounts.get(base) || 0) + 1);
            if ((baseCounts.get(base) || 0) > bestCount) {
                bestCount = baseCounts.get(base) || 0;
                bestBase = base;
            }
        }
        const baseMentionedInQuery = (base) => {
            if (!base || base.length < 4)
                return false;
            if (q.includes(base))
                return true;
            const parts = base
                .split(/\s+/)
                .filter((t) => t.length >= 4 &&
                !COOKING_STYLE_TOKENS.has(t) &&
                !this.WEAK_PRODUCT_TOKENS.has(t));
            if (parts.length >= 2 && parts.every((t) => this.queryHasToken(q, t)))
                return true;
            if (parts.length === 1 && this.queryHasToken(q, parts[0]))
                return true;
            return false;
        };
        const mentionedBases = [...baseCounts.keys()].filter(baseMentionedInQuery);
        if (mentionedBases.length === 1) {
            bestBase = mentionedBases[0];
            bestCount = baseCounts.get(bestBase) || bestCount;
        }
        else if (mentionedBases.length > 1) {
            let top = mentionedBases[0];
            let topC = baseCounts.get(top) || 0;
            for (const b of mentionedBases) {
                const c = baseCounts.get(b) || 0;
                if (c > topC || (c === topC && b.length > top.length)) {
                    top = b;
                    topC = c;
                }
            }
            bestBase = top;
            bestCount = topC;
        }
        else if (scored[0]?.p) {
            const topBase = this.getProductNameBase(scored[0].p.name);
            if (topBase.length >= 4 && (scored[0].score >= 80 || scored.length === 1)) {
                bestBase = topBase;
                bestCount = Math.max(bestCount, baseCounts.get(topBase) || 1);
            }
        }
        const styleSiblings = bestStyleBase
            ? available.filter((p) => this.stripCookingStyleTokens(p.name) === bestStyleBase)
            : [];
        const hasCookingStyleVariants = styleSiblings.length >= 2 &&
            styleSiblings.some((p) => normalizeText(p.name) !== this.stripCookingStyleTokens(p.name));
        if (hasCookingStyleVariants && bestStyleCount >= 1) {
            const qHitsStyleBase = this.queryHasToken(q, bestStyleBase) ||
                q.includes(bestStyleBase) ||
                (bestStyleBase.split(/\s+/).filter((t) => t.length >= 4).every((t) => this.queryHasToken(q, t)) &&
                    bestStyleBase.split(/\s+/).filter((t) => t.length >= 4).length >= 2);
            const otherNamedBase = mentionedBases.some((b) => b !== bestStyleBase && !bestStyleBase.includes(b) && !b.includes(bestStyleBase));
            if (qHitsStyleBase || (bestStyleCount >= 2 && !otherNamedBase)) {
                bestBase = bestStyleBase;
                useCookingStyleFamily = true;
            }
        }
        if (!useCookingStyleFamily && styleSiblings.length >= 2) {
            const queryNamesStyle = [...COOKING_STYLE_TOKENS].some((st) => this.queryHasToken(q, st));
            const distinctive = bestStyleBase
                .split(/\s+/)
                .filter((t) => this.isDistinctiveProductToken(t));
            const queryHitsDish = distinctive.length > 0 && distinctive.every((t) => this.queryHasToken(q, t));
            const stripStyleWords = (base) => base
                .split(/\s+/)
                .filter((t) => t && !COOKING_STYLE_TOKENS.has(t))
                .join(' ');
            const styleCore = stripStyleWords(bestStyleBase);
            const conflictingOther = mentionedBases.some((b) => {
                const core = stripStyleWords(b);
                if (!core || core.length < 4)
                    return false;
                if (core === styleCore || styleCore.includes(core) || core.includes(styleCore))
                    return false;
                return true;
            });
            if (!queryNamesStyle && queryHitsDish && !conflictingOther) {
                bestBase = bestStyleBase;
                useCookingStyleFamily = true;
            }
        }
        if (!bestBase)
            return null;
        const queryHitsBase = q.includes(bestBase) ||
            bestBase.includes(q) ||
            this.queryHasToken(q, bestBase) ||
            q.split(' ').filter((t) => t.length >= 4 && !COOKING_STYLE_TOKENS.has(t)).every((t) => bestBase.includes(t));
        if (!queryHitsBase && bestCount < 2 && !useCookingStyleFamily)
            return null;
        const queryTokens = q.split(' ').filter((t) => t.length >= 4 && t !== 'menu' && t !== 'carta');
        const baseTokens = bestBase.split(' ').filter((t) => t.length >= 4);
        const namesThisFamily = baseTokens.some((bt) => queryTokens.some((qt) => this.queryHasToken(qt, bt) ||
            fuzzyTokenMatch(qt, bt) ||
            (qt.length >= 5 && bt.length >= 5 && (qt.includes(bt) || bt.includes(qt)))));
        if (queryTokens.length && baseTokens.length && !namesThisFamily && !queryHitsBase)
            return null;
        const variants = available.filter((p) => {
            if (useCookingStyleFamily) {
                return this.stripCookingStyleTokens(p.name) === bestBase;
            }
            const base = this.getProductNameBase(p.name);
            const name = normalizeText(p.name);
            if (base === bestBase)
                return true;
            if (!(name.includes(bestBase) && base.length >= 4))
                return false;
            const wrappers = ['ejecutivo', 'bandeja', 'arroz', 'hamburguesa', 'taco', 'almuerzo'];
            const baseHasWrapper = wrappers.some((w) => bestBase.includes(w));
            if (!baseHasWrapper && wrappers.some((w) => name.includes(w)))
                return false;
            return true;
        });
        if (variants.length < 2)
            return null;
        const hasVariantCue = variants.some((p) => /\b(solo|sola|combo|completo|completa|gaseosa|bebida|medio\s+pollo|costillas?|papa\s+francesa|caja)\b/i.test(p.name));
        const hasStyleCue = useCookingStyleFamily ||
            variants.some((p) => {
                const n = normalizeText(p.name);
                return [...COOKING_STYLE_TOKENS].some((st) => n.includes(st));
            });
        if (!hasVariantCue && !hasStyleCue && !variants.some((p) => p.hasAttributes))
            return null;
        const uniq = new Map();
        for (const v of variants)
            uniq.set(v.id, v);
        const sorted = [...uniq.values()].sort((a, b) => {
            const rank = (n) => {
                const x = normalizeText(n);
                if (/\bsolo\b/.test(x))
                    return 0;
                if (x === bestBase)
                    return 1;
                if (/\bcombo\b/.test(x))
                    return 2;
                if (/\b(completo|gaseosa|bebida)\b/.test(x))
                    return 3;
                return 4;
            };
            const d = rank(a.name) - rank(b.name);
            return d !== 0 ? d : a.name.localeCompare(b.name, 'es');
        });
        return {
            baseLabel: titleCaseWords(bestBase),
            baseKey: bestBase,
            variants: sorted,
        };
    }
    pickVariantFromFamilyText(text, family) {
        const q = normalizeText(text);
        const mentionedPrice = this.extractMentionedPriceCop(text);
        if (mentionedPrice != null) {
            const byPrice = this.pickProductByMentionedPrice(family.variants, mentionedPrice);
            if (byPrice)
                return byPrice;
        }
        const styleAsked = [...COOKING_STYLE_TOKENS].filter((st) => this.queryHasToken(q, st));
        if (styleAsked.length) {
            const styled = family.variants.filter((p) => styleAsked.some((st) => normalizeText(p.name).includes(st)));
            if (styled.length === 1)
                return styled[0];
        }
        const servingSize = this.detectServingSizeHint(q);
        if (servingSize === 'pequena') {
            const small = family.variants.filter((p) => this.productIsSmallServing(p.name));
            if (small.length === 1)
                return small[0];
        }
        if (servingSize === 'grande') {
            const large = family.variants.filter((p) => !this.productIsSmallServing(p.name));
            if (large.length === 1)
                return large[0];
        }
        for (const p of family.variants) {
            const name = normalizeText(p.name);
            if (name.length > family.baseKey.length + 3 && (q === name || q.includes(name))) {
                return p;
            }
        }
        if (/\bsolo\b/.test(q)) {
            return family.variants.find((p) => /\bsolo\b/.test(normalizeText(p.name))) || null;
        }
        if (/\b(combo|completo|completa|gaseosa|bebida)\b/.test(q)) {
            const combos = family.variants.filter((p) => /\b(combo|completo|completa|gaseosa|bebida)\b/.test(normalizeText(p.name)));
            if (combos.length === 1)
                return combos[0];
            if (combos.length > 1) {
                const withQueryTok = combos.filter((p) => {
                    const toks = normalizeText(p.name)
                        .split(/\s+/)
                        .filter((t) => t.length >= 4 &&
                        !/\b(combo|completo|completa|gaseosa|bebida)\b/.test(t) &&
                        !COOKING_STYLE_TOKENS.has(t));
                    return toks.some((t) => this.queryHasToken(q, t));
                });
                if (withQueryTok.length === 1)
                    return withQueryTok[0];
                if (withQueryTok.length > 1) {
                    return [...withQueryTok].sort((a, b) => normalizeText(b.name).length - normalizeText(a.name).length)[0];
                }
            }
            return combos[0] || null;
        }
        if (/\b(medio|1\s*\/\s*2|1\/2)\s+pollo\b/.test(q) || /\bcon\s+medio\s+pollo\b/.test(q)) {
            return (family.variants.find((p) => /\b(medio|1\s*\/\s*2|1\/2)\s+pollo\b/.test(normalizeText(p.name))) || null);
        }
        if (/\bcostillas?\b/.test(q)) {
            return family.variants.find((p) => /\bcostillas?\b/.test(normalizeText(p.name))) || null;
        }
        if (/\b(francesa|caja|sencillo)\b/.test(q)) {
            return (family.variants.find((p) => /\b(francesa|caja)\b/.test(normalizeText(p.name))) ||
                family.variants.find((p) => /\bsolo\b/.test(normalizeText(p.name))) ||
                null);
        }
        return null;
    }
    pickFromCandidateList(text, candidates) {
        if (!candidates.length)
            return null;
        const q = normalizeText(text);
        if (!q || q.length < 2)
            return null;
        for (const p of candidates) {
            const name = normalizeText(p.name);
            if (q === name || (name.length >= 5 && (q.includes(name) || name.includes(q)))) {
                return p;
            }
        }
        const portion = this.detectPortionHint(text);
        if (portion) {
            const sized = candidates.filter((p) => this.detectProductPortionSize(p.name) === portion);
            if (sized.length === 1)
                return sized[0];
        }
        const asFamily = {
            baseLabel: '',
            baseKey: '',
            variants: candidates,
        };
        const byFamily = this.pickVariantFromFamilyText(text, asFamily);
        if (byFamily && candidates.some((c) => c.id === byFamily.id))
            return byFamily;
        const styleAsked = [...COOKING_STYLE_TOKENS].filter((st) => this.queryHasToken(q, st));
        if (styleAsked.length) {
            const styled = candidates.filter((p) => styleAsked.some((st) => normalizeText(p.name).includes(st)));
            if (styled.length === 1)
                return styled[0];
        }
        const hits = candidates.filter((p) => {
            const toks = normalizeText(p.name)
                .split(' ')
                .filter((t) => t.length >= 4 && this.isDistinctiveProductToken(t));
            return toks.some((t) => this.queryHasToken(q, t));
        });
        if (hits.length === 1)
            return hits[0];
        const relaxed = q.replace(/\bder\b/g, 'de');
        if (relaxed !== q) {
            const byDe = candidates.filter((p) => {
                const name = normalizeText(p.name);
                return relaxed === name || (name.length >= 5 && (relaxed.includes(name) || name.includes(relaxed)));
            });
            if (byDe.length === 1)
                return byDe[0];
        }
        const fromOffer = (0, whatsapp_session_intents_1.pickProductNamedInLastOffer)(text, `¿Quieres ${candidates.map((p) => p.name).join(' o ')}?`, candidates);
        return fromOffer ? candidates.find((p) => p.id === fromOffer.id) || null : null;
    }
    formatComboExplanation(family) {
        const lines = family.variants.map((p) => {
            const label = this.getVariantDisplayLabel(p.name, family.baseKey);
            const price = Math.round(p.price).toLocaleString('es-CO');
            return `• *${label}* — $${price} (cód. ${p.code})`;
        });
        return (`Para *${family.baseLabel}* manejamos varias presentaciones:\n\n` +
            `${lines.join('\n')}\n\n` +
            `_El *combo* suele incluir gaseosa. Elige el *número* o el nombre si quieres pedir._`);
    }
    isComboMeaningInquiry(text) {
        const t = (text || '').trim();
        if (!t)
            return false;
        if (this.isMixtoCompositionInquiry(t))
            return true;
        return (/\b(qu[eé]\s+(significa|es|trae|incluye|viene|valdr[ií]a)|c[oó]mo\s+(es|viene|funciona))\s+(el\s+|en\s+|a\s+)?combo\b/i.test(t) ||
            /\bcombo\s+(qu[eé]|significa|incluye|trae|es|valdr[ií]a)\b/i.test(t) ||
            /\ben\s+combo\b.*\bcu[aá]nto\b/i.test(t) ||
            /\bcu[aá]nto\b.*\ben\s+combo\b/i.test(t) ||
            /\b(significa|qu[eé]\s+es)\s+a?\s*en\s+combo\b/i.test(t));
    }
    isMixtoCompositionInquiry(text) {
        const raw = fixCommonOrderTypos((text || '').trim());
        if (!raw || raw.length < 8)
            return false;
        if (/^(quiero|dame|ponme|agrega|me\s+regalas|me\s+das|vendeme)\b/i.test(raw))
            return false;
        const q = normalizeText(raw);
        const asksMixto = /\b(?:combo\s+)?(?:de\s+)?(?:pollo\s+)?mixto\b/.test(q);
        const halfAndHalf = /\b(?:medio|mitad)\s+(?:pollo\s+)?(?:broaster|frito|asado)\b/.test(q) &&
            /\b(?:medio|mitad)\s+(?:pollo\s+)?(?:broaster|frito|asado)\b/.test(q.replace(/\b(?:medio|mitad)\s+(?:pollo\s+)?(?:broaster|frito|asado)\b/, ' '));
        if (asksMixto && (/\bes\b/.test(q) || /\?/.test(raw) || halfAndHalf))
            return true;
        if (halfAndHalf && (/\bes\b/.test(q) || /\?/.test(raw)) && !/\b(quiero|dame|ponme)\b/.test(q)) {
            return true;
        }
        return false;
    }
    isDishStyleSubstitutionInquiry(text) {
        const raw = fixCommonOrderTypos((text || '').trim());
        if (!raw || raw.length < 8)
            return false;
        const q = normalizeText(raw);
        const cartStyleChange = /\b(lo|la|los|las)\s+quiero\s+con\b/.test(q) ||
            /\b(lo|la)\s+prefiero\s+con\b/.test(q) ||
            /^(quiero|prefiero)\s+(con\s+)?(el\s+|la\s+|lo\s+)?(pollo\s+)?(broaster|frito|asado|plancha)\b/.test(q) ||
            /^(quiero|prefiero)\s+(el|la|lo)\s+(de\s+)?(pollo\s+)?(broaster|frito|asado)\b/.test(q);
        if (/^(quiero|dame|ponme|agrega|me\s+regalas|me\s+das|vendeme|pedi|pido)\b/i.test(raw) &&
            !cartStyleChange) {
            return false;
        }
        if (this.isMixtoCompositionInquiry(raw))
            return false;
        const hasStyle = /\b(broaster|frito|asado|apanad[oa]|en\s+salsa|plancha|sudado)\b/.test(q);
        if (!hasStyle)
            return false;
        const hasBaseDish = /\barroz(\s+chino)?\b/.test(q) ||
            /\b(bandeja|ejecutivo|sopa|ajiaco|mondongo|mojarra|churrasco|costilla|hamburguesa|tacos?|alitas?)\b/.test(q);
        const asksSwap = /\b(podr[ií]a|puede|pudiera|se\s+puede|se\s+podr[ií]a)\s+(ser|con)\b/.test(q) ||
            /\b(se\s+puede|puede\s+ser|podr[ií]a\s+ser)\b/.test(q) ||
            /\b(en\s+vez\s+de|en\s+lugar\s+de)\b/.test(q) ||
            /\b(cambiar(?:lo|la)?|hacerlo|hacerla|dejalo|d[eé]jalo|mejor)\s+(a|por|con|en)?\b/.test(q) ||
            (/\?/.test(raw) &&
                /\b(podr[ií]a|puede|posible|ser[ií]a|se\s+puede)\b/.test(q) &&
                /\b(broaster|frito|asado)\b/.test(q));
        const shortStyleSwap = /\bse\s+puede\s+(con\s+)?(pollo\s+)?(broaster|frito|asado|plancha)\b/.test(q) ||
            /\bpuede\s+ser\s+(pollo\s+)?(broaster|frito|asado)\b/.test(q) ||
            /\bmejor\s+(con\s+)?(pollo\s+)?(broaster|frito|asado)\b/.test(q) ||
            /\b(lo|la|los|las)\s+quiero\s+con\s+(pollo\s+)?(broaster|frito|asado|plancha)\b/.test(q) ||
            /\bquiero\s+con\s+(pollo\s+)?(broaster|frito|asado|plancha)\b/.test(q);
        if (asksSwap && hasBaseDish)
            return true;
        if (asksSwap || shortStyleSwap)
            return true;
        return false;
    }
    extractRequestedProteinStyle(text) {
        const q = normalizeText(text || '');
        if (/\bbroaster\b/.test(q))
            return 'broaster';
        if (/\bfrito\b/.test(q))
            return 'frito';
        if (/\basado\b/.test(q))
            return 'asado';
        if (/\bsudad[oa]\b/.test(q))
            return 'sudado';
        if (/\bplancha\b/.test(q))
            return 'plancha';
        if (/\bapanad[oa]\b/.test(q))
            return 'apanado';
        if (/\bguisad[oa]\b/.test(q))
            return 'guisado';
        return null;
    }
    extractBaseDishQueryForStyleSwap(text) {
        let q = normalizeText(fixCommonOrderTypos((text || '').trim()));
        q = q
            .replace(/\b(podr[ií]a|puede|pudiera|se\s+puede|se\s+podr[ií]a)\s+(ser|con)\b.*$/i, ' ')
            .replace(/\b(se\s+puede|puede\s+ser)\s+(con\s+)?(pollo\s+)?(broaster|frito|asado|plancha)\b.*$/i, ' ')
            .replace(/\b(en\s+vez\s+de|en\s+lugar\s+de)\b.*$/i, ' ')
            .replace(/\b(cambiar(?:lo|la)?|hacerlo|hacerla|dejalo|d[eé]jalo|mejor)\s+(a|por|con|en)?\b.*$/i, ' ')
            .replace(/\b(pollo\s+)?(broaster|frito|asado|plancha)\b/gi, ' ')
            .replace(/\b(veci(?:no|na|o)?|parce|compadre|amigo|amiga)\b/gi, ' ')
            .replace(/\b(el|la|los|las|un|una|unos|unas)\b/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        return q;
    }
    resolveCookingStyleAttributeOption(product, style) {
        if (!product?.attributes?.length || !style)
            return null;
        for (const a of product.attributes) {
            if (!this.isCookingStyleAttribute(a.attributeName))
                continue;
            for (const opt of a.options || []) {
                const raw = String(opt || '').trim();
                if (raw && productNameHasCookingStyle(raw, style)) {
                    return { attributeName: a.attributeName, attributeValue: raw };
                }
            }
        }
        return null;
    }
    applyCookingStyleToAttributes(product, selected, style) {
        const hit = this.resolveCookingStyleAttributeOption(product, style);
        if (!hit)
            return null;
        const attrs = [...(selected || [])];
        const idx = attrs.findIndex((a) => normalizeText(a.attributeName) === normalizeText(hit.attributeName));
        if (idx >= 0) {
            attrs[idx] = { ...attrs[idx], attributeValue: hit.attributeValue };
        }
        else {
            attrs.push(hit);
        }
        return {
            attributes: attrs,
            attributeName: hit.attributeName,
            attributeValue: hit.attributeValue,
        };
    }
    formatVariantFamilyPrompt(family) {
        const rows = family.variants.map((p, i) => ({
            index: i + 1,
            label: this.getVariantDisplayLabel(p.name, family.baseKey),
            price: p.price,
            code: p.code,
        }));
        return (`Para *${family.baseLabel}*, ¿cómo lo quieres?\n\n` +
            `${this.formatOptionsList(rows)}\n\n` +
            `_Responde con el *número* o el nombre de la variante._`);
    }
    getRemainingAttributes(product, alreadySelected = [], opts) {
        const attrs = product.attributes || [];
        const showComboOnly = this.shouldShowComboOnlyAttributes(product, alreadySelected, opts);
        const remaining = attrs.filter((attr) => {
            if (alreadySelected.some((s) => s.attributeName === attr.attributeName))
                return false;
            if (opts?.omitSwappedDrink && this.isComboOnlyAttribute(attr))
                return false;
            if (this.isDeferredDrinkAttribute(attr, product) && !showComboOnly)
                return false;
            return true;
        });
        return [...remaining].sort((a, b) => {
            const aDrink = this.isComboOnlyAttribute(a) ? 1 : 0;
            const bDrink = this.isComboOnlyAttribute(b) ? 1 : 0;
            return aDrink - bDrink;
        });
    }
    isAttributeSelectionComplete(product, alreadySelected = [], opts) {
        if (!product.hasAttributes || !product.attributes?.length)
            return true;
        return this.getRemainingAttributes(product, alreadySelected, opts).length === 0;
    }
    fillDefaultAttributes(product, alreadySelected = [], opts) {
        if (!product.hasAttributes || !product.attributes?.length) {
            return [...alreadySelected];
        }
        let selected = [...alreadySelected];
        for (let i = 0; i < 12; i++) {
            if (this.isAttributeSelectionComplete(product, selected, opts))
                break;
            const remaining = this.getRemainingAttributes(product, selected, opts);
            const next = remaining[0];
            if (!next?.options?.length)
                break;
            const first = next.options[0];
            selected = [
                ...selected,
                { attributeName: next.attributeName, attributeValue: first },
            ];
        }
        return selected;
    }
    findCookingStyleSibling(product, products, style) {
        const base = this.stripCookingStyleTokens(product?.name || '');
        if (!base || base.length < 4 || !style)
            return null;
        const hits = products.filter((p) => {
            if (p.availableNow === false)
                return false;
            if (this.stripCookingStyleTokens(p.name) !== base)
                return false;
            return productNameHasCookingStyle(p.name, style);
        });
        return hits.length === 1 ? hits[0] : null;
    }
    isCookingStyleAttribute(attributeName) {
        const an = String(attributeName || '').trim();
        if (!an)
            return false;
        if (/^(pollo|seleccion|selección|preparacion|preparación|estilo|coccion|cocción)$/i.test(an)) {
            return true;
        }
        return this.isPrepAttributeName(an) && !/\b(arepas?|bebida|sabor|presa|sopa)\b/i.test(an);
    }
    coerceAttributeStep(product, step, opts) {
        if (step.status === 'invalid')
            return step;
        if (this.isAttributeSelectionComplete(product, step.attributes, opts)) {
            return { status: 'complete', attributes: step.attributes };
        }
        return { status: 'partial', attributes: step.attributes };
    }
    applyDefaultAttributeStep(product, step, opts) {
        const base = step.status === 'invalid' ? [] : step.attributes;
        const filled = this.fillDefaultAttributes(product, base, opts);
        if (this.isAttributeSelectionComplete(product, filled, opts)) {
            return { status: 'complete', attributes: filled };
        }
        if (!filled.length && step.status === 'invalid')
            return step;
        return { status: 'partial', attributes: filled };
    }
    isDeferredDrinkAttribute(attr, product) {
        if (!this.isComboOnlyAttribute(attr))
            return false;
        const attrs = product?.attributes || [];
        if (!attrs.length)
            return true;
        const hasNonDrink = attrs.some((a) => !this.isComboOnlyAttribute(a));
        return hasNonDrink;
    }
    isComboOnlyAttribute(attr) {
        const n = normalizeText(attr.attributeName);
        if (/\b(gaseosa|gaseosas|bebida|bebidas|refresco|refrescos)\b/.test(n)) {
            return true;
        }
        if (/\bsabor/.test(n)) {
            return true;
        }
        return false;
    }
    isModalityAttribute(attr) {
        const n = normalizeText(attr.attributeName);
        const optionsHaveSoloCombo = attr.options.some((opt) => {
            const v = normalizeText(opt);
            return (/\b(solo|combo|completo|completa)\b/.test(v) ||
                /\b(con\s+bebida|con\s+gaseosa|sin\s+bebida|sin\s+gaseosa)\b/.test(v));
        });
        if (/\b(arepa|arepas|papa|papas|yuca|ensalada|acompan|acompañ|sabor|sabores)\b/.test(n)) {
            return false;
        }
        if (/\b(modalidad|presentacion|presentación)\b/.test(n)) {
            return optionsHaveSoloCombo || attr.options.length <= 4;
        }
        if (/\b(porcion|porción|tipo|variante|estilo|formato)\b/.test(n)) {
            return optionsHaveSoloCombo;
        }
        return optionsHaveSoloCombo;
    }
    hasModalityAttribute(attrs) {
        return attrs.some((a) => !this.isComboOnlyAttribute(a) && this.isModalityAttribute(a));
    }
    hasComboPortionSelected(alreadySelected, product) {
        return alreadySelected.some((s) => {
            if (!this.isComboLikeValue(s.attributeValue))
                return false;
            return this.selectionIsModalityChoice(s, product);
        });
    }
    hasSoloPortionSelected(alreadySelected, product) {
        return alreadySelected.some((s) => {
            if (!this.isSoloLikeValue(s.attributeValue))
                return false;
            return this.selectionIsModalityChoice(s, product);
        });
    }
    selectionIsModalityChoice(selected, product) {
        const attr = product?.attributes?.find((a) => a.attributeName === selected.attributeName);
        if (attr) {
            return this.isModalityAttribute(attr);
        }
        const v = normalizeText(selected.attributeValue);
        if (/\b(arepa|queso|huevo|carne|chicharr|chorizo|papa|yuca|aguacate|jamon|pollo|maiz|maíz)\b/.test(v)) {
            return false;
        }
        return (/^(solo|sola|combo|completo|completa)$/.test(v) ||
            /\b(sin\s+(bebida|gaseosa|combo)|con\s+(bebida|gaseosa))\b/.test(v));
    }
    isComboLikeValue(value) {
        const v = normalizeText(value);
        return (/\bcombo\b/.test(v) ||
            /\b(completo|completa)\b/.test(v) ||
            /\b(con\s+bebida|con\s+gaseosa|incluye\s+bebida|incluye\s+gaseosa)\b/.test(v));
    }
    isSoloLikeValue(value) {
        const v = normalizeText(value);
        return (/\bsolo\b/.test(v) ||
            /\bsola\b/.test(v) ||
            /\b(sin\s+bebida|sin\s+gaseosa|sin\s+combo)\b/.test(v));
    }
    productImpliesCombo(product) {
        return /\bcombo\b/.test(normalizeText(product.name));
    }
    shouldShowComboOnlyAttributes(product, alreadySelected, opts) {
        const attrs = product.attributes || [];
        const nonDrinkAttrs = attrs.filter((a) => !this.isComboOnlyAttribute(a));
        if (attrs.length > 0 && nonDrinkAttrs.length === 0) {
            return true;
        }
        if (opts?.variantIntent === 'solo' || this.hasSoloPortionSelected(alreadySelected, product)) {
            return false;
        }
        if (opts?.variantIntent === 'combo' ||
            this.hasComboPortionSelected(alreadySelected, product) ||
            this.productImpliesCombo(product)) {
            return true;
        }
        const allNonDrinkSelected = nonDrinkAttrs.length > 0 &&
            nonDrinkAttrs.every((a) => alreadySelected.some((s) => s.attributeName === a.attributeName));
        if (allNonDrinkSelected)
            return true;
        const hasDrinkPending = attrs.some((a) => this.isDeferredDrinkAttribute(a, product) &&
            !alreadySelected.some((s) => s.attributeName === a.attributeName));
        const anyNonDrinkSelected = nonDrinkAttrs.some((a) => alreadySelected.some((s) => s.attributeName === a.attributeName));
        if (hasDrinkPending && anyNonDrinkSelected && !this.hasModalityAttribute(attrs)) {
            return true;
        }
        return false;
    }
    isDailyPromoInquiry(text) {
        const q = normalizeText(text || '');
        if (!q)
            return false;
        return /\b(promocion|promo|oferta)\b/.test(q) && /\b(dia|hoy)\b/.test(q);
    }
    specificNamedDish(text, products) {
        const q = normalizeText(text || '');
        if (q.length < 4)
            return null;
        const hits = products.filter((p) => {
            if (p.availableNow === false)
                return false;
            const name = normalizeText(p.name);
            return name.length >= 8 && q.includes(name);
        });
        if (!hits.length)
            return null;
        hits.sort((a, b) => normalizeText(b.name).length - normalizeText(a.name).length);
        return hits[0];
    }
    isProductDescriptionInquiry(text) {
        const raw = text.trim();
        if (!raw || raw.length < 5)
            return false;
        if (this.isPriceInquiryIntent(text))
            return false;
        const q = normalizeText(raw);
        const sizeOrYieldAsk = /\b(de\s+)?cuantos\s+gramos\b/.test(q) ||
            /\bcuanto\s+pesa\b/.test(q) ||
            (/\b(peso|gramos?|kilogramos?|kg)\b/.test(q) &&
                /\b(cuanto|cuantos|de\s+cuanto|tiene|trae|es|viene)\b/.test(q)) ||
            /\bpara\s+cuant[oa]s?\s+personas?\b/.test(q) ||
            /\bcuant[oa]s?\s+personas?\s+(alcanza|alcanzan|rinde|rinden|sirve|sirven|da|dan)\b/.test(q) ||
            /\b(alcanza|alcanzan|rinde|rinden|sirve)\s+(?:para\s+)?(?:cuant[oa]s?\s+)?personas?\b/.test(q) ||
            /\bcuanto\s+(rinde|alcanza|sirve)\b/.test(q);
        if (sizeOrYieldAsk)
            return true;
        if (/^(quiero|dame|ponme|agrega|agregame|me regalas|me das|voy a pedir)\s/i.test(raw)) {
            return false;
        }
        if (this.isMixtoCompositionInquiry(raw))
            return true;
        const patterns = [
            /\bde que\b/,
            /\bde que es\b/,
            /\bde que trae\b/,
            /\bde que viene\b/,
            /\bde que va\b/,
            /\bque lleva\b/,
            /\bque llava\b/,
            /\bque trae\b/,
            /\bcon que viene\b/,
            /\bcon que va\b/,
            /\bcon que trae\b/,
            /\bcon que acompana\b/,
            /\bviene acompana/,
            /\by\s+con\s+que\s+(viene|va|trae)\b/,
            /\bque incluye\b/,
            /\bque contiene\b/,
            /\bque ingredientes\b/,
            /\bque tiene el\b/,
            /\bque tiene la\b/,
            /\b(incluye|trae|viene|va)\s+con\b/,
            /\b(tienen?|llevan?|traen?|vienen?|incluyen?|contienen?|va)\s+(?:con\s+)?(cebolla|aji|huevo|huevos|queso|lechuga|tomate|ensalada|gluten|lacteos|arepas?|papas?|yuca|arroz|sopa|bebida|gaseosa)\b/,
            /\b(composicion|preparacion|descripcion|descrpcion)\b/,
            /\bcomo es el\b/,
            /\bcomo es la\b/,
            /\bcomo es con\b/,
            /\bcomo es\b/,
            /\bcomo viene\b/,
            /\bcomo va\b/,
        ];
        if (patterns.some((p) => p.test(q)))
            return true;
        return (/\?/.test(raw) &&
            /\b(llevan?|llava|traen?|vienen?|va|incluyen?|contienen?|ingredientes|descripcion|composicion|gramos|rinde|alcanza)\b/.test(q));
    }
    isAvailabilityInquiry(text) {
        const raw = text.trim();
        if (!raw || raw.length < 6)
            return false;
        if (this.isPriceInquiryIntent(text))
            return false;
        if (this.isProductDescriptionInquiry(text))
            return false;
        {
            const q = normalizeText(raw);
            if (/\b(servicio|servicios|abierto|abiertos|abierta|abiertas|horario|horarios)\b/.test(q) &&
                !new RegExp(FOOD_ORDER_TOKEN, 'i').test(q)) {
                return false;
            }
        }
        if (/^(quiero|dame|ponme|agrega|agregame|me regalas|me das)\s+(un|una|unos|unas|el|la)\b/i.test(raw)) {
            return false;
        }
        const q = normalizeText(raw);
        if (this.countQuantityMentions(raw) >= 2)
            return false;
        const orderQty = '(?:\\d{1,2}|un|una|uno|unos|unas|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)';
        if (new RegExp(`\\b(me\\s+vendes|me\\s+venden|vendeme|vendame|me\\s+regalas|me\\s+das)\\s+${orderQty}\\b`).test(q)) {
            return false;
        }
        if (new RegExp(`\\b(vendes|venden)\\s+${orderQty}\\b`).test(q) &&
            !/\?/.test(raw) &&
            !this.isLargerPackInquiry(raw) &&
            (this.extractVariantPreferenceHint(raw) || new RegExp(FOOD_ORDER_TOKEN, 'i').test(q))) {
            return false;
        }
        if (/^(quiero|dame|ponme|agrega)\b/.test(q) &&
            !/\b(tienes|tiene|tienen|hay|venden|vendes|manejan|maneja)\b/.test(q)) {
            return false;
        }
        if (/\b(?:pueden|puede|podrian)\s+(?:hacer|preparar|cocinar)\b/.test(q) ||
            /\b(?:se\s+puede|puedo|podria)\s+(?:pedir|comprar|ordenar)\b/.test(q))
            return true;
        const availVerb = /\b(tienes|tiene|tienen|hay|venden|vendes|manejan|maneja|consiguen|conseguiste)\b/.test(q) ||
            !!this.availabilitySubject(raw);
        if (!availVerb)
            return false;
        if (/\b(no\s+)?(tienes|tiene|tienen|hay|venden|vendes)\s+(?:de\s+|we\s+|una?\s+|el\s+|la\s+)?/.test(q)) {
            return true;
        }
        if (this.availabilitySubject(raw))
            return true;
        return (availVerb &&
            new RegExp(FOOD_ORDER_TOKEN, 'i').test(q));
    }
    isExternalMarketplaceOrderMessage(text) {
        const q = normalizeText(text);
        if (!q)
            return false;
        if (!/\b(rappi|uber\s*eats|didi\s*food|ifood|pedidos\s*ya)\b/.test(q))
            return false;
        return (/\b(pedido|orden|cambiar|cambio|sabor|gaseosa|domicilio|entregaron|entregado)\b/.test(q) ||
            /\bhice\b/.test(q) ||
            /\bquiero\s+cambiar\b/.test(q));
    }
    isServingSizeChangeIntent(text) {
        const q = normalizeText(text);
        if (!q || q.length < 8)
            return false;
        const sizeWord = /\b(pequena|pequenas|pequenita|chica|chicas|chiquita|menos|media\s+taza|taza)\b/.test(q);
        const portionWord = /\b(porcion|porciones|cantidad|tamano|tama[nñ]o|taza|sopa)\b/.test(q) ||
            /\bmas\s+pequena\b/.test(q) ||
            /\bmenos\s+cantidad\b/.test(q);
        return sizeWord && portionWord;
    }
    isLargerPackInquiry(text) {
        const q = normalizeText(text);
        if (!q || q.length < 8)
            return false;
        const sizeUp = /\b(mas\s+grande|mas\s+grandes|mas\s+grandecito|tamano\s+grande|combo\s+grande|pack\s+grande|paquete\s+grande|version\s+grande|otro\s+tamano|mas\s+tacos|mas\s+hamburguesas)\b/.test(q);
        if (!sizeUp)
            return false;
        return (/\b(vendes|venden|tienen|tiene|hay|manejan|quiero|dame|ponme|no|tienen|existe|habrá|habra)\b/.test(q) || /\b(combo|pack|duo|trio|paquete|promocion)\b/.test(q));
    }
    isVaguePackSizeQuery(text) {
        if (!this.isLargerPackInquiry(text) && !/\bcombo\b/.test(normalizeText(text)))
            return false;
        const q = normalizeText(this.extractProductSearchQuery(text));
        const noise = new Set([
            'no',
            'me',
            'un',
            'una',
            'unos',
            'unas',
            'el',
            'la',
            'los',
            'las',
            'de',
            'del',
            'mas',
            'grande',
            'grandes',
            'grandecito',
            'tamano',
            'version',
            'otro',
            'algo',
            'vendes',
            'venden',
            'tienen',
            'tiene',
            'hay',
            'manejan',
            'quiero',
            'dame',
            'ponme',
            'existe',
            'habra',
            'combo',
            'combos',
            'pack',
            'paquete',
            'duo',
            'trio',
            'promocion',
            'promo',
        ]);
        const foodTokens = q
            .split(/\s+/)
            .filter((t) => t.length >= 3 && !noise.has(t) && !PACK_MULTIPLIER_TOKENS.has(t));
        return foodTokens.length === 0;
    }
    getCoreFoodTokens(name) {
        const weak = new Set([
            ...this.WEAK_PRODUCT_TOKENS,
            'de',
            'del',
            'la',
            'el',
            'los',
            'las',
            'con',
            'y',
            'al',
            'un',
            'una',
            'para',
        ]);
        const seen = new Set();
        const out = [];
        for (const raw of normalizeText(name).split(/\s+/)) {
            if (raw.length < 4)
                continue;
            if (weak.has(raw) || PACK_MULTIPLIER_TOKENS.has(raw))
                continue;
            const sing = singularizeEsToken(raw);
            if (seen.has(sing))
                continue;
            seen.add(sing);
            out.push(sing);
        }
        return out;
    }
    productsShareCoreFoodTokens(a, b) {
        const ta = new Set(this.getCoreFoodTokens(a.name));
        if (!ta.size)
            return false;
        return this.getCoreFoodTokens(b.name).some((t) => ta.has(t));
    }
    detectPackMultiplierRank(name) {
        const n = normalizeText(name);
        if (/\b(familiar|pack|paquete|x4)\b/.test(n))
            return 4;
        if (/\b(trio|triple|x3)\b/.test(n))
            return 3;
        if (/\b(duo|doble|dupla|pareja|x2)\b/.test(n))
            return 2;
        if (/\bcombo\b/.test(n))
            return 2;
        return 1;
    }
    findRelatedLargerPackProducts(focus, products) {
        const focusRank = this.detectPackMultiplierRank(focus.name);
        const focusTokens = this.getCoreFoodTokens(focus.name);
        const available = products.filter((p) => p.availableNow !== false && p.id !== focus.id);
        let related = available.filter((p) => this.productsShareCoreFoodTokens(focus, p));
        if (!related.length && focusTokens.length === 0) {
            const family = this.findProductVariantFamily(focus.name, products, [focus]);
            related = (family?.variants || []).filter((p) => p.id !== focus.id);
        }
        return related
            .filter((p) => {
            const rank = this.detectPackMultiplierRank(p.name);
            if (rank > focusRank)
                return true;
            if (rank >= focusRank && p.price >= focus.price * 1.12)
                return true;
            return false;
        })
            .sort((a, b) => this.detectPackMultiplierRank(b.name) - this.detectPackMultiplierRank(a.name) ||
            b.price - a.price)
            .slice(0, 6);
    }
    isGenericProductInquiry(text) {
        if (this.isPriceInquiryIntent(text))
            return true;
        if (this.isProductDescriptionInquiry(text))
            return true;
        if (this.isAvailabilityInquiry(text))
            return true;
        const raw = text.trim();
        const q = normalizeText(raw);
        return (/\?$/.test(raw) &&
            /\b(cuanto|precio|valor|cuesta|cobran|sale|tienen|hay|opciones|que hay|informacion|info)\b/.test(q));
    }
    extractExplicitAttributeChoice(text, product, opts) {
        const step = this.coerceAttributeStep(product, this.resolveAttributesFromMessage(product, text, [], opts), opts);
        if (step.status === 'complete')
            return step.attributes;
        return null;
    }
    formatPriceInquiryList(products) {
        const body = products.map((p, i) => this.formatProductListItem(p, i + 1)).join('\n\n');
        return (`Estas son las opciones relacionadas 👇\n\n${body}\n\n` +
            `_¿Cuál te interesa? Dime el *número* o el *nombre*._`);
    }
    splitMultiProductSegments(text) {
        if (this.isOffTopicChitchat(text))
            return [];
        if (this.looksLikeSingleProductWithMods(text) && !this.looksLikeFoodPlusDrinkOrder(text)) {
            const main = this.stripProductModificationNoise(text);
            return main ? [main] : [];
        }
        const bulletLines = (text || '')
            .split(/\r?\n+|(?=\s[*•\-–—]\s+)/)
            .map((l) => l
            .replace(/^[\s*•\-–—▪︎]+/, '')
            .replace(/^[0-9]{1,2}[.)]\s*/, '')
            .trim())
            .filter((l) => l.length >= 3);
        if (bulletLines.length >= 2) {
            const dishish = (l) => /^(?:un|una|unos|unas|el|la|los|las|medio|media|cuarto|porci[oó]n|\d{1,2})\b/i.test(l) ||
                new RegExp(FOOD_ORDER_TOKEN, 'i').test(l) ||
                new RegExp(DRINK_ORDER_TOKEN, 'i').test(l) ||
                /\b(ajiaco|mondongo|sancocho|menudencias?|churrasco|mojarra|sobrebarriga|ejecutivo|hamburguesa|limonada|gaseosa|papas?|yuca|arepa|trucha|bagre|costillas?|bbq)\b/i.test(l);
            if (bulletLines.filter(dishish).length >= 2) {
                const seen = new Set();
                const out = [];
                for (const line of bulletLines) {
                    const subSegs = this.expandInlineMultiDishLine(line);
                    for (const cleaned of subSegs) {
                        if (cleaned.length < 3)
                            continue;
                        const key = normalizeText(cleaned);
                        if (seen.has(key))
                            continue;
                        seen.add(key);
                        out.push(cleaned);
                    }
                }
                if (out.length >= 2)
                    return out;
            }
        }
        if (this.looksLikeArrozComboPlusSizedChicken(text)) {
            const splitChicken = (text || '').match(/^(.+?)\s+con\s+((?:un\s+|una\s+)?(?:medio|media|cuarto|1\s*\/\s*2|1\/2|1\s*\/\s*4|1\/4)\s+(?:de\s+)?(?:pollo|broaster).+)$/i);
            if (splitChicken?.[1] && splitChicken?.[2]) {
                const a = this.cleanOrderSegment(splitChicken[1].trim());
                const b = this.cleanOrderSegment(splitChicken[2].trim());
                if (a.length >= 3 && b.length >= 3)
                    return [a, b];
            }
        }
        if (this.looksLikeFoodPlusDrinkOrder(text)) {
            if (this.countQuantityMentions(text) < 2) {
                const foodDrink = this.splitFoodPlusDrinkSegments(text);
                if (foodDrink.length >= 2 && !this.foodSideHasAnotherDish(foodDrink[0])) {
                    const seen = new Set();
                    return foodDrink.filter((seg) => {
                        const key = normalizeText(seg);
                        if (seen.has(key))
                            return false;
                        seen.add(key);
                        return true;
                    });
                }
            }
        }
        let q = this.extractProductSearchQuery(text);
        if (!q)
            return [];
        q = q.replace(/[,;]?\s*(por\s+favor|porfavor|porfa|por\s+fa|pf|gracias)[\s!.?]*$/i, '').trim();
        if (!q)
            return [];
        q = q.replace(/\bsin\s+[^\s,]+(?:\s+[^\s,]+)?\s+(?:mas|más)\s+[^\s,]+(?:\s+[^\s,]+)?/gi, (m) => m.replace(/\s+(?:mas|más)\s+/i, ' con '));
        q = q.replace(/\bcon\s+[^\s,]+(?:\s+[^\s,]+)?(?:\s+y\s+[^\s,]+)+/gi, (m) => {
            if (/\by\s+(?:\d+(?:\s*\/\s*\d+)?|medio|media|cuarto|un|una|unos|unas|dos|tres|cuatro|cinco)\b/i.test(m)) {
                return m;
            }
            if (/\by\s+(?:pollos?|mojarras?|sopas?|churrascos?|limonadas?|gaseosas?|arroces?|bandejas?|jugos?|costillas?|pechugas?|alitas?|hamburguesas?|platanos?|sobrebarriga)\b/i.test(m)) {
                return m;
            }
            return m.replace(/\s+y\s+/gi, ' __Y__ ');
        });
        const byCommaOrY = q
            .split(/\s*,\s*|\s+\by\b\s+|\s+(?:mas|más|\+)\s+/i)
            .map((s) => this.cleanOrderSegment(s.replace(/__Y__/g, ' y ').trim()))
            .filter((s) => s.length >= 3);
        const expanded = [];
        for (const chunk of byCommaOrY.length
            ? byCommaOrY
            : [q.replace(/__Y__/g, ' y ')]) {
            expanded.push(...this.splitSegmentOnArticles(chunk));
        }
        const seen = new Set();
        const out = [];
        for (const seg of expanded) {
            const cleaned = this.cleanOrderSegment(seg.replace(/\s+(por\s+favor|porfavor|porfa|por\s+fa|pf|gracias)[\s!.?]*$/i, '').trim());
            if (cleaned.length < 3)
                continue;
            const key = normalizeText(cleaned);
            if (seen.has(key))
                continue;
            seen.add(key);
            out.push(cleaned);
        }
        return out;
    }
    expandInlineMultiDishLine(line) {
        const raw = (line || '').trim();
        if (!raw)
            return [];
        const cleanedOnce = this.cleanOrderSegment(raw);
        if (!cleanedOnce)
            return [];
        if (this.isEjecutivoLunchOrderPhrase(cleanedOnce) ||
            (0, whatsapp_named_menu_dish_1.isNamedMenuDishOrderPhrase)(cleanedOnce)) {
            return [cleanedOnce];
        }
        const qtyMentions = this.countQuantityMentions(cleanedOnce);
        const hasCommaOrY = /\s*,\s*|\s+\by\b\s+/i.test(cleanedOnce);
        const hasArticleChain = /\b(?:\d{1,2}|un|una|unos|unas)\s+\S+.+\b(?:un|una|unos|unas|\d{1,2})\s+\S+/i.test(cleanedOnce);
        if (qtyMentions < 2 && !hasCommaOrY && !hasArticleChain) {
            return [cleanedOnce];
        }
        let q = cleanedOnce.replace(/[,;]?\s*(por\s+favor|porfavor|porfa|pf|gracias)[\s!.?]*$/i, '').trim();
        q = q.replace(/\bsin\s+[^\s,]+(?:\s+[^\s,]+)?\s+(?:mas|más)\s+[^\s,]+(?:\s+[^\s,]+)?/gi, (m) => m.replace(/\s+(?:mas|más)\s+/i, ' con '));
        q = q.replace(/\bcon\s+[^\s,]+(?:\s+[^\s,]+)?(?:\s+y\s+[^\s,]+)+/gi, (m) => {
            if (/\by\s+(?:\d+(?:\s*\/\s*\d+)?|medio|media|cuarto|un|una|unos|unas|dos|tres|cuatro|cinco)\b/i.test(m)) {
                return m;
            }
            if (/\by\s+(?:pollos?|mojarras?|sopas?|churrascos?|limonadas?|gaseosas?|arroces?|bandejas?|jugos?|costillas?|pechugas?|alitas?|hamburguesas?|platanos?|sobrebarriga|trucha|bagre|ajiaco|porci[oó]n)\b/i.test(m)) {
                return m;
            }
            return m.replace(/\s+y\s+/gi, ' __Y__ ');
        });
        const byCommaOrY = q
            .split(/\s*,\s*|\s+\by\b\s+|\s+(?:mas|más|\+)\s+/i)
            .map((s) => this.cleanOrderSegment(s.replace(/__Y__/g, ' y ').trim()))
            .filter((s) => s.length >= 3);
        const expanded = [];
        for (const chunk of byCommaOrY.length ? byCommaOrY : [q.replace(/__Y__/g, ' y ')]) {
            expanded.push(...this.splitSegmentOnArticles(chunk));
        }
        const seen = new Set();
        const out = [];
        for (const seg of expanded) {
            const cleaned = this.cleanOrderSegment(seg);
            if (cleaned.length < 3)
                continue;
            const key = normalizeText(cleaned);
            if (seen.has(key))
                continue;
            seen.add(key);
            out.push(cleaned);
        }
        return out.length ? out : [cleanedOnce];
    }
    splitSegmentOnArticles(chunk) {
        let fixed = fixCommonOrderTypos(chunk);
        fixed = fixed
            .replace(/^(?:para\s+)?(?:pedirte|pedir|encargarte|encargar)\s+(?:por\s+fa|porfa|por\s+favor)?\s*/i, '')
            .trim();
        if (/^para\s+(el|la|los|las)\s+/i.test(fixed) &&
            !this.looksLikeClearlyMultiDishOrder(fixed) &&
            !this.looksLikeFoodPlusDrinkOrder(fixed)) {
            return [fixed.trim()].filter((s) => s.length >= 3);
        }
        const protectedStyle = fixed
            .replace(/\ba\s+la\s+/gi, 'a__LA__')
            .replace(/\b(con|sin)\s+(el|la|los|las)\s+/gi, '$1__SIDE__$2 ')
            .replace(/\bal\s+(?=horno|ajillo|vapor|grill|carbon|carb[oó]n)\b/gi, 'a__L__');
        const parts = protectedStyle
            .split(/\s+(?=(?:un|una|unos|unas|el|la|los|las)\s+)/i)
            .map((s) => s.replace(/a__LA__/g, 'a la ').replace(/__SIDE__/g, ' ').replace(/a__L__/g, 'al ').trim())
            .filter((s) => s.length >= 3);
        const merged = parts.filter((s) => !ORDER_INTENT_ONLY.has(normalizeText(s)));
        const use = merged.length ? merged : parts;
        if (use.length > 1)
            return use;
        if (this.countQuantityMentions(fixed) >= 2) {
            const qtyParts = this.splitSegmentOnQuantityBoundaries(fixed);
            if (qtyParts.length >= 2)
                return qtyParts;
        }
        return use.length ? use : [fixed.trim()].filter((s) => s.length >= 3);
    }
    splitSegmentOnQuantityBoundaries(chunk) {
        const fixed = fixCommonOrderTypos((chunk || '').trim());
        if (!fixed)
            return [];
        const qtyWord = '(?:un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|\\d{1,2})';
        const boundary = new RegExp(`(?=(?:^|\\s)(?:${qtyWord})\\s+(?:de\\s+)?(?:${FOOD_ORDER_TOKEN}|${DRINK_ORDER_TOKEN}))`, 'i');
        const parts = fixed
            .split(boundary)
            .map((s) => this.cleanOrderSegment(s.trim()))
            .filter((s) => s.length >= 3);
        return parts.length >= 2 ? parts : [fixed];
    }
    chickenStyleChoicesForSegment(segment, products) {
        const q = normalizeText(fixCommonOrderTypos(segment || ''));
        if (!q)
            return null;
        if (/\b(broaster|frito|asado|mixto)\b/.test(q))
            return null;
        if (/\b(arroz|bandeja|ejecutivo|menu)\b/.test(q))
            return null;
        const available = products.filter((p) => p.availableNow !== false);
        if (/\bcombo\b/.test(q) && /\bpollo\b/.test(q) && !/\b(arroz|taco|chino)\b/.test(q)) {
            const combos = available.filter((p) => {
                const n = normalizeText(p.name);
                return (/\bcombo\b/.test(n) &&
                    /\bpollo\b/.test(n) &&
                    /\b(frito|broaster|mixto)\b/.test(n));
            });
            if (combos.length >= 2)
                return this.dedupeProductsById(combos).slice(0, 4);
        }
        const portion = this.detectPortionHint(q);
        const barePortion = this.isBareChickenPortionFollowUp(segment, q);
        const wantsEntero = portion === 'entero' ||
            (!portion &&
                !barePortion &&
                /\bpollo\b/.test(q) &&
                !/\bcombo\b/.test(q) &&
                (/\b(un|una|el|la|1)\s+pollo\b/.test(q) ||
                    /^(dame|ponme|quiero|me\s+da|regalame|y\s+)?\s*(un\s+)?pollos?$/.test(q) ||
                    /\by\s+(me\s+da|quiero|dame)?\s*(un\s+)?pollo\b/.test(q)));
        const wantPortion = portion || (barePortion ? 'medio' : wantsEntero ? 'entero' : null);
        if (!wantPortion)
            return null;
        if (/\bcombo\b/.test(q) && wantPortion !== 'entero')
            return null;
        if (!/\bpollo\b/.test(q) && !barePortion)
            return null;
        const cands = available.filter((p) => {
            const n = normalizeText(p.name);
            if (/\b(combo|bandeja|ejecutivo|arroz|pechuga|alitas|taco|hamburguesa|menu)\b/.test(n)) {
                return false;
            }
            if (!/\bpollo\b/.test(n))
                return false;
            const pPortion = this.detectProductPortionSize(n);
            if (wantPortion === 'entero') {
                return (pPortion === 'entero' ||
                    (!pPortion && /^pollo\s+(frito|broaster|asado|mixto)\b/.test(n)));
            }
            return pPortion === wantPortion;
        });
        if (cands.length >= 2)
            return this.dedupeProductsById(cands).slice(0, 4);
        return null;
    }
    resolveMultiProductOrder(text, products) {
        const distributedText = (0, whatsapp_distributed_variants_1.expandDistributedVariants)(text, products, this);
        const hasDistributedVariants = distributedText !== text;
        text = distributedText;
        if (this.isOffTopicChitchat(text))
            return null;
        if (this.isPriceInquiryIntent(text))
            return null;
        if (this.isMenuExploreIntent(text, products))
            return null;
        if (this.isProductDescriptionInquiry(text))
            return null;
        if (this.isAvailabilityInquiry(text))
            return null;
        if (this.isDishStyleSubstitutionInquiry(text))
            return null;
        if (this.isExternalMarketplaceOrderMessage(text))
            return null;
        if ((0, whatsapp_session_intents_1.isAddressChangeIntent)(text))
            return null;
        if ((0, whatsapp_intent_1.isDeliverySetupWithoutFood)(text))
            return null;
        {
            const q = normalizeText(this.extractProductSearchQuery(text) || text);
            const tokens = q.split(/\s+/).filter(Boolean);
            const foodish = tokens.some((t) => !ORDER_INTENT_ONLY.has(t) &&
                t.length > 2 &&
                !/^(un|una|unos|unas|el|la|los|las|de|del|para|por|favor|hacer|realizar|con|sin|mas|mas)$/.test(t));
            if (!foodish && /\b(pedido|orden|pedir|ordenar)\b/.test(q))
                return null;
        }
        if ((0, whatsapp_intent_1.looksLikeAddressOnlyMessage)(text)) {
            return null;
        }
        if ((0, whatsapp_intent_1.isUpcomingAddressIntent)(text))
            return null;
        {
            const soft = normalizeText(text);
            if (/\b(gracias|no\s+senora|no\s+senor|no\s+gracias)\b/.test(soft) &&
                /\bdirecci/.test(soft) &&
                !new RegExp(FOOD_ORDER_TOKEN, 'i').test(soft)) {
                return null;
            }
        }
        const swap = this.swapIntent(text);
        let segments = this.splitMultiProductSegments(text);
        segments = segments.filter((s) => !this.isPolitenessOnlySegment(s));
        segments = segments.filter((s) => !(0, whatsapp_intent_1.looksLikeAddressOnlyMessage)(s) &&
            !(0, whatsapp_intent_1.looksLikeDeliveryAddressFragment)(s) &&
            !/^(?:para\s+)?(?:la\s+|el\s+)?(?:direcci[oó]n|domicilio)\b/i.test(s.trim()));
        let embeddedAll = this.findAllProductsEmbeddedInMessage(text, products);
        const clearlyMulti = this.looksLikeClearlyMultiDishOrder(text) ||
            this.looksLikeMultiItemOrderMessage(text) ||
            segments.length >= 2;
        const sizedChicken = this.resolveSizedChickenProduct(text, products);
        if (sizedChicken) {
            const qAll = normalizeText(fixCommonOrderTypos(text));
            const combinedArrozMedioSku = /\barroz(?:\s+chino)?\s+combo\s+con\s+(?:medio|media|1\s*\/\s*2|1\/2)\s+pollo\b/.test(qAll) ||
                /\bcombo\s+(?:de\s+)?arroz(?:\s+chino)?\s+con\s+(?:medio|media|1\s*\/\s*2|1\/2)\s+pollo\b/.test(qAll);
            const skipCombinedSkuHalf = combinedArrozMedioSku && !this.looksLikeArrozComboPlusSizedChicken(text);
            const styleSaid = /\b(broaster|frito|asado|mixto)\b/.test(qAll);
            const skipAssumedHalf = clearlyMulti &&
                /\bcombo\b/.test(qAll) &&
                !!this.detectPortionHint(qAll) &&
                !styleSaid;
            if (!skipCombinedSkuHalf && !skipAssumedHalf) {
                if (clearlyMulti) {
                    embeddedAll = [
                        sizedChicken,
                        ...embeddedAll.filter((p) => p.id !== sizedChicken.id),
                    ];
                }
                else {
                    embeddedAll = [
                        sizedChicken,
                        ...embeddedAll.filter((p) => p.id !== sizedChicken.id && this.isLikelyDrinkProduct(p)),
                    ];
                    if (this.looksLikeFoodPlusDrinkOrder(text) && !embeddedAll.some((p) => this.isLikelyDrinkProduct(p))) {
                        const drinkCompanion = this.findFoodDrinkCompanionProduct(text, sizedChicken, products);
                        if (drinkCompanion)
                            embeddedAll.push(drinkCompanion);
                    }
                }
            }
        }
        {
            const qCombined = normalizeText(fixCommonOrderTypos(text));
            const combinedArrozMedio = (/\barroz(?:\s+chino)?\s+combo\s+con\s+(?:medio|media|1\s*\/\s*2|1\/2)\s+pollo\b/.test(qCombined) ||
                /\bcombo\s+(?:de\s+)?arroz(?:\s+chino)?\s+con\s+(?:medio|media|1\s*\/\s*2|1\/2)\s+pollo\b/.test(qCombined) ||
                /\barroz(?:\s+chino)?\s+con\s+(?:medio|media|1\s*\/\s*2|1\/2)\s+pollo\b/.test(qCombined)) &&
                !this.looksLikeArrozComboPlusSizedChicken(text);
            if (combinedArrozMedio) {
                embeddedAll = embeddedAll.filter((p) => !/^1\s*\/\s*2\s+pollo/i.test(p.name) && !/^medio\s+pollo$/i.test(normalizeText(p.name)));
            }
        }
        if (this.looksLikeArrozComboPlusSizedChicken(text)) {
            embeddedAll = embeddedAll.filter((p) => !/\barroz\b/i.test(p.name) || !/\bmedio\s+pollo\b/i.test(normalizeText(p.name)));
            const arrozSeg = segments.find((s) => /\barroz\b/i.test(s)) ||
                text.replace(/\s+con\s+(?:un\s+|una\s+)?(?:medio|media|cuarto|1\s*\/\s*[24]|1\/[24]).+$/i, '');
            const arrozFamily = this.findProductVariantFamily(arrozSeg, products);
            const arrozCombo = (arrozFamily
                ? this.pickVariantFromFamilyText(arrozSeg, arrozFamily)
                : null) ||
                this.searchByNameScored(/\bcombo\b/i.test(arrozSeg) ? arrozSeg : `${arrozSeg} combo`, products, 5).find((x) => /\barroz\b/i.test(x.p.name) && /\bcombo\b/i.test(normalizeText(x.p.name)))
                    ?.p ||
                this.searchByNameScored(arrozSeg, products, 5).find((x) => /\barroz\b/i.test(x.p.name))?.p;
            if (arrozCombo && !embeddedAll.some((p) => p.id === arrozCombo.id)) {
                embeddedAll = [arrozCombo, ...embeddedAll];
            }
            if (sizedChicken && !embeddedAll.some((p) => p.id === sizedChicken.id)) {
                embeddedAll = [sizedChicken, ...embeddedAll.filter((p) => p.id !== sizedChicken.id)];
            }
        }
        {
            const qSkip = normalizeText(fixCommonOrderTypos(text));
            const skipHalfForCombinedArroz = (/\barroz(?:\s+chino)?\s+combo\s+con\s+(?:medio|media|1\s*\/\s*2|1\/2)\s+pollo\b/.test(qSkip) ||
                /\bcombo\s+(?:de\s+)?arroz(?:\s+chino)?\s+con\s+(?:medio|media|1\s*\/\s*2|1\/2)\s+pollo\b/.test(qSkip) ||
                /\barroz(?:\s+chino)?\s+con\s+(?:medio|media|1\s*\/\s*2|1\/2)\s+pollo\b/.test(qSkip)) &&
                !this.looksLikeArrozComboPlusSizedChicken(text);
            if (clearlyMulti && !skipHalfForCombinedArroz) {
                for (const seg of segments) {
                    if (this.chickenStyleChoicesForSegment(seg, products)?.length)
                        continue;
                    const sc = this.resolveSizedChickenProduct(seg, products);
                    if (sc && !embeddedAll.some((p) => p.id === sc.id)) {
                        embeddedAll.push(sc);
                    }
                }
            }
        }
        const sizedSoup = this.resolveSizedSoupProduct(text, products);
        if (sizedSoup) {
            if (clearlyMulti) {
                embeddedAll = [
                    sizedSoup,
                    ...embeddedAll.filter((p) => p.id !== sizedSoup.id),
                ];
            }
            else {
                embeddedAll = [
                    sizedSoup,
                    ...embeddedAll.filter((p) => p.id !== sizedSoup.id && this.isLikelyDrinkProduct(p)),
                ];
                if (this.looksLikeFoodPlusDrinkOrder(text) && !embeddedAll.some((p) => this.isLikelyDrinkProduct(p))) {
                    const drinkCompanion = this.findFoodDrinkCompanionProduct(text, sizedSoup, products);
                    if (drinkCompanion)
                        embeddedAll.push(drinkCompanion);
                }
            }
        }
        if (embeddedAll.length === 1 && this.looksLikeFoodPlusDrinkOrder(text)) {
            const companion = this.findFoodDrinkCompanionProduct(text, embeddedAll[0], products);
            if (companion && companion.id !== embeddedAll[0].id) {
                embeddedAll = this.isLikelyDrinkProduct(embeddedAll[0])
                    ? [companion, embeddedAll[0]]
                    : [embeddedAll[0], companion];
            }
        }
        if (embeddedAll.length >= 2) {
            if (!this.looksLikeClearlyMultiDishOrder(text) &&
                !this.looksLikeMultiItemOrderMessage(text) &&
                !this.looksLikeFoodPlusDrinkOrder(text)) {
                const best = this.findProductEmbeddedInMessage(text, products);
                embeddedAll = best ? [best] : embeddedAll.slice(0, 1);
            }
            else {
                embeddedAll = embeddedAll.filter((p) => {
                    const name = normalizeText(p.name);
                    const qn = normalizeText(text);
                    if (qn.includes(name) || (name.length >= 5 && qn.includes(singularizeEsToken(name)))) {
                        return true;
                    }
                    if (this.detectProductPortionSize(name) &&
                        segments.some((seg) => this.resolveSizedChickenProduct(seg, products)?.id === p.id)) {
                        return true;
                    }
                    if (sizedChicken?.id === p.id || sizedSoup?.id === p.id)
                        return true;
                    const toks = name
                        .split(' ')
                        .filter((t) => this.isDistinctiveProductToken(t));
                    if (!toks.length && this.detectProductPortionSize(name)) {
                        return false;
                    }
                    return toks.some((t) => this.queryHasToken(qn, t));
                });
            }
        }
        let swapNotedHostId = null;
        if (swap) {
            embeddedAll = embeddedAll.filter((p) => !this.productIsSwapRemoval(p, swap.removed, swap.added));
            const dish = this.dishTextBeforeSwap(text);
            const host = this.mostSpecificNamedProduct(dish, products);
            const generic = new Set(['pollo', 'carne', 'arroz', 'sopa', 'bebida', 'gaseosa', 'natural']);
            const weight = (p) => normalizeText(p.name)
                .split(/\s+/)
                .filter((t) => t.length >= 4 && !generic.has(t) && !/\d/.test(t)).length;
            if (host) {
                const hostWeight = weight(host);
                embeddedAll = embeddedAll.filter((p) => {
                    if (p.id === host.id)
                        return true;
                    return !(this.productNameFitsUtterance(p, dish) && weight(p) < hostWeight);
                });
                if (!embeddedAll.some((p) => p.id === host.id))
                    embeddedAll.unshift(host);
                if (this.productCarriesMention(host, swap.removed)) {
                    swapNotedHostId = host.id;
                    const extraIds = new Set(this.productsForSwapAddition(swap.added, products)
                        .filter((p) => p.id !== host.id)
                        .map((p) => p.id));
                    embeddedAll = embeddedAll.filter((p) => !extraIds.has(p.id));
                }
            }
            const removed = normalizeText(swap.removed);
            segments = segments.filter((s) => {
                const seg = normalizeText(s);
                if (!seg || seg.split(/\s+/).length > 4)
                    return true;
                return !(seg === removed || removed.includes(seg));
            });
        }
        if (swap && swapNotedHostId != null && !this.looksLikeClearlyMultiDishOrder(text)) {
            const host = products.find((p) => p.id === swapNotedHostId);
            if (host) {
                const match = {
                    segment: this.dishTextBeforeSwap(text),
                    product: host,
                    score: 100,
                    note: this.swapChangeNote(swap.removed, swap.added),
                };
                const stillMissing = this.getRemainingAttributes(host, [], {
                    omitSwappedDrink: this.swapRemovesDrink(text),
                });
                return {
                    segments: [match.segment],
                    confident: stillMissing.length ? [] : [match],
                    ambiguous: [],
                    unresolved: [],
                    needsAttributes: stillMissing.length ? [match] : [],
                };
            }
        }
        if (!this.wantsSeparateDrink(text) && embeddedAll.length >= 2) {
            const drinkSeg = this.splitFoodPlusDrinkSegments(text)[1] || '';
            const hosts = embeddedAll.filter((p) => this.drinkTextMatchesAttribute(p, drinkSeg || text));
            if (drinkSeg && hosts.length) {
                const hostIds = new Set(hosts.map((p) => p.id));
                embeddedAll = embeddedAll.filter((p) => {
                    if (hostIds.has(p.id))
                        return true;
                    return !this.isLikelyDrinkProduct(p);
                });
            }
        }
        if (embeddedAll.length >= 2 && !this.looksLikeClearlyMultiDishOrder(text) && !hasDistributedVariants) {
            const confident = [];
            const needsAttributes = [];
            for (const product of embeddedAll) {
                const segment = segments.find((s) => {
                    const sn = normalizeText(s);
                    const pn = normalizeText(product.name);
                    if (sn.includes(pn) || pn.includes(sn))
                        return true;
                    const tokens = pn
                        .split(' ')
                        .filter((t) => t.length >= 5 && !this.WEAK_PRODUCT_TOKENS.has(t));
                    return tokens.some((t) => sn.includes(t));
                }) || product.name;
                const attrText = this.looksLikeClearlyMultiDishOrder(text) || segments.length >= 2
                    ? segment
                    : `${segment} ${text}`;
                const match = { segment, product, score: 100 };
                const textSwap = this.swapIntent(text);
                if (textSwap &&
                    product.id === swapNotedHostId &&
                    this.productCarriesMention(product, textSwap.removed)) {
                    match.note = this.swapChangeNote(textSwap.removed, textSwap.added);
                }
                if (product.hasAttributes && product.attributes?.length) {
                    const drinkSwapped = !!match.note && this.swapRemovesDrink(text);
                    const stillMissing = this.getRemainingAttributes(product, [], {
                        omitSwappedDrink: drinkSwapped,
                    });
                    if (drinkSwapped && !stillMissing.length) {
                        confident.push(match);
                    }
                    else {
                        const explicit = this.extractExplicitAttributeChoice(attrText, product);
                        if (explicit)
                            confident.push({ ...match, segment: attrText });
                        else
                            needsAttributes.push(match);
                    }
                }
                else {
                    confident.push(match);
                }
            }
            this.keepOnlyOpenAttributeChoices(confident, needsAttributes);
            const resolvedCount = confident.length + needsAttributes.length;
            if (resolvedCount >= 2) {
                return {
                    segments,
                    confident,
                    ambiguous: [],
                    unresolved: [],
                    needsAttributes,
                };
            }
        }
        if (segments.length < 2) {
            if (this.looksLikeFoodPlusDrinkOrder(text)) {
                const forced = this.splitFoodPlusDrinkSegments(text);
                if (forced.length >= 2)
                    segments = forced;
            }
            if (segments.length < 2 && embeddedAll.length < 2 && swapNotedHostId == null)
                return null;
        }
        const confident = [];
        const ambiguous = [];
        const unresolved = [];
        const possibleCustomerNames = [];
        const needsAttributes = [];
        const usedProductIds = new Set();
        if (swap && swapNotedHostId != null && this.looksLikeClearlyMultiDishOrder(text)) {
            const host = products.find((p) => p.id === swapNotedHostId);
            if (host) {
                usedProductIds.add(host.id);
                const match = {
                    segment: this.dishTextBeforeSwap(text),
                    product: host,
                    score: 100,
                    note: this.swapChangeNote(swap.removed, swap.added),
                };
                const stillMissing = this.getRemainingAttributes(host, [], {
                    omitSwappedDrink: this.swapRemovesDrink(text),
                });
                if (stillMissing.length)
                    needsAttributes.push(match);
                else
                    confident.push(match);
            }
        }
        for (const rawSegment of segments) {
            const segment = this.cleanOrderSegment(rawSegment);
            const standaloneDrink = this.resolveStandaloneDrinkOrder(segment, products);
            if (standaloneDrink && !usedProductIds.has(standaloneDrink.product.id) &&
                !(swap && this.productIsSwapRemoval(standaloneDrink.product, swap.removed, swap.added))) {
                usedProductIds.add(standaloneDrink.product.id);
                confident.push({ segment, product: standaloneDrink.product, score: 100 });
                continue;
            }
            if (swap && swapNotedHostId != null) {
                const segN = normalizeText(segment);
                const removedTokens = normalizeText(swap.removed)
                    .split(/\s+/)
                    .filter((t) => t.length >= 5);
                const addedTokens = normalizeText(swap.added)
                    .split(/\s+/)
                    .map((t) => singularizeEsToken(t))
                    .filter((t) => t.length >= 4);
                const touchesChange = removedTokens.some((t) => segN.includes(t)) &&
                    (/\bpor\b/.test(segN) || addedTokens.some((t) => segN.includes(t)));
                const segWords = segN
                    .split(/\s+/)
                    .map((t) => singularizeEsToken(t))
                    .filter((t) => t.length >= 4);
                const onlyTheChange = segWords.length > 0 &&
                    segWords.every((w) => addedTokens.some((t) => w === t || nearDishToken(w, t)));
                if (/\bcambia/.test(segN) || touchesChange || onlyTheChange)
                    continue;
            }
            const segSwap = this.swapIntent(segment);
            if (segSwap) {
                const dish = this.dishTextBeforeSwap(segment);
                const host = this.mostSpecificNamedProduct(dish, products);
                const carries = !!host && this.productCarriesMention(host, segSwap.removed);
                if (host && !usedProductIds.has(host.id)) {
                    usedProductIds.add(host.id);
                    const match = {
                        segment: dish || segment,
                        product: host,
                        score: 100,
                        note: carries ? this.swapChangeNote(segSwap.removed, segSwap.added) : undefined,
                    };
                    const stillMissing = this.getRemainingAttributes(host, [], {
                        omitSwappedDrink: carries && this.swapRemovesDrink(segment),
                    });
                    if (host.hasAttributes && host.attributes?.length && stillMissing.length) {
                        needsAttributes.push(match);
                    }
                    else {
                        confident.push(match);
                    }
                }
                continue;
            }
            if (!this.wantsSeparateDrink(text)) {
                const host = [...confident, ...needsAttributes].find((m) => this.drinkTextMatchesAttribute(m.product, segment));
                if (host) {
                    host.segment = `${host.segment} ${segment}`.trim();
                    continue;
                }
            }
            const namedMenuHit = this.resolveNamedMenuDishProduct(segment, products);
            if (namedMenuHit) {
                if (!usedProductIds.has(namedMenuHit.id)) {
                    usedProductIds.add(namedMenuHit.id);
                    const match = { segment, product: namedMenuHit, score: 100 };
                    if (namedMenuHit.hasAttributes && namedMenuHit.attributes?.length) {
                        const attrText = this.looksLikeClearlyMultiDishOrder(text) || segments.length >= 2
                            ? segment
                            : `${segment} ${text}`;
                        if (this.extractExplicitAttributeChoice(attrText, namedMenuHit)) {
                            confident.push({ ...match, segment: attrText });
                        }
                        else
                            needsAttributes.push(match);
                    }
                    else
                        confident.push(match);
                }
                continue;
            }
            const styleChoices = this.chickenStyleChoicesForSegment(segment, products);
            if (styleChoices?.length) {
                ambiguous.push({
                    segment,
                    candidates: styleChoices,
                });
                continue;
            }
            if (/^(?:un(?:a)?\s+|la\s+)?pechugas?$/.test(normalizeText(segment))) {
                const pechugaVariants = this.dedupeProductsById(products.filter((p) => p.availableNow !== false &&
                    /^pechuga(?:\s|$)/.test(normalizeText(p.name))));
                if (pechugaVariants.length >= 2) {
                    ambiguous.push({ segment, candidates: pechugaVariants.slice(0, 6) });
                    continue;
                }
            }
            const embedded = this.findProductEmbeddedInMessage(segment, products);
            if (!embedded &&
                this.looksLikePersonNameSegment(segment) &&
                !this.spokenDishOnMenu(segment, products) &&
                !this.looksLikeClearlyMultiDishOrder(text)) {
                possibleCustomerNames.push(segment.replace(/\s+/g, ' ').trim());
                continue;
            }
            if (embedded) {
                const skipGenericMedio = /^medio\s+pollo$/.test(normalizeText(embedded.name)) &&
                    /\bbroaster\b/.test(normalizeText(`${segment} ${text}`));
                if (!skipGenericMedio) {
                    if (usedProductIds.has(embedded.id) && !hasDistributedVariants) {
                        const selected = this.extractExplicitAttributeChoice(segment, embedded) || [];
                        const distinctChoice = selected.length > 0 && confident.some(previous => previous.product.id === embedded.id &&
                            (this.extractExplicitAttributeChoice(previous.segment, embedded) || []).some(choice => selected.some(current => normalizeText(current.attributeName) === normalizeText(choice.attributeName) &&
                                normalizeText(current.attributeValue) !== normalizeText(choice.attributeValue))));
                        if (!distinctChoice)
                            continue;
                    }
                    usedProductIds.add(embedded.id);
                    const match = { segment, product: embedded, score: 100 };
                    if (embedded.hasAttributes && embedded.attributes?.length) {
                        const attrText = this.looksLikeClearlyMultiDishOrder(text) || segments.length >= 2
                            ? segment
                            : `${segment} ${text}`;
                        if (this.extractExplicitAttributeChoice(attrText, embedded)) {
                            confident.push({ ...match, segment: attrText });
                        }
                        else
                            needsAttributes.push(match);
                    }
                    else
                        confident.push(match);
                    continue;
                }
            }
            const query = this.extractProductSearchQuery(segment);
            let scored = this.searchByNameScored(query, products, 5);
            if (!scored.length || (scored[0].score < 40 && /\bbroaster\b/.test(normalizeText(segment)))) {
                const strongTok = normalizeText(segment)
                    .split(' ')
                    .filter((t) => t.length >= 5 && !this.WEAK_PRODUCT_TOKENS.has(t));
                if (strongTok.length) {
                    const retry = this.searchByNameScored(strongTok.join(' '), products, 5);
                    if (retry.length && (!scored.length || retry[0].score > scored[0].score)) {
                        scored = retry;
                    }
                }
                if (/\bbroaster\b/.test(normalizeText(segment))) {
                    for (const alias of ['pollo broaster', 'broaster', 'pollo frito', 'pollo asado']) {
                        const retry = this.searchByNameScored(alias, products, 5).filter((x) => !this.isLikelyDrinkProduct(x.p));
                        if (!retry.length)
                            continue;
                        if (!scored.length || retry[0].score > scored[0].score) {
                            scored = retry;
                        }
                        if (this.isStrongProductMatch(retry) || retry[0].score >= 50)
                            break;
                    }
                }
            }
            if (!scored.length) {
                if (this.looksLikePersonNameSegment(segment) &&
                    !this.spokenDishOnMenu(segment, products) &&
                    !this.looksLikeClearlyMultiDishOrder(text)) {
                    possibleCustomerNames.push(segment.replace(/\s+/g, ' ').trim());
                }
                else if (ORDER_INTENT_ONLY.has(normalizeText(segment)) ||
                    /^(un|una|unos|unas|el|la|los|las)$/i.test(segment.trim()) ||
                    this.isLogisticsOnlySegment(segment)) {
                }
                else {
                    unresolved.push(segment);
                }
                continue;
            }
            let uniqueScored = (() => {
                const seen = new Set();
                return scored.filter((x) => {
                    if (seen.has(x.p.id))
                        return false;
                    seen.add(x.p.id);
                    return true;
                });
            })();
            const segNorm = normalizeText(segment);
            if (/\bbroaster\b/.test(segNorm)) {
                const broasterHits = uniqueScored.filter((x) => /\bbroaster\b/.test(normalizeText(x.p.name)));
                if (broasterHits.length)
                    uniqueScored = broasterHits;
                else {
                    uniqueScored = uniqueScored.filter((x) => !/^medio\s+pollo$/.test(normalizeText(x.p.name)));
                }
            }
            for (const style of ['plancha', 'gratinada', 'gratinado', 'asado', 'asada', 'apanada', 'apanado']) {
                if (!new RegExp(`\\b${style}\\b`).test(segNorm))
                    continue;
                const styleHits = uniqueScored.filter((x) => productNameHasCookingStyle(normalizeText(x.p.name), style));
                if (styleHits.length) {
                    uniqueScored = styleHits;
                    break;
                }
            }
            if (this.looksLikeFoodPlusDrinkOrder(text) &&
                new RegExp(`^${DRINK_ORDER_TOKEN}`, 'i').test(segNorm)) {
                const drinks = uniqueScored.filter((x) => this.isLikelyDrinkProduct(x.p));
                const pool = drinks.length > 0
                    ? drinks.map((x) => x.p)
                    : products.filter((p) => p.availableNow !== false && this.isLikelyDrinkProduct(p));
                const preferredP = this.pickBestDrinkProduct(pool, `${segment} ${text}`);
                if (preferredP && !usedProductIds.has(preferredP.id)) {
                    const preferredScore = drinks.find((x) => x.p.id === preferredP.id)?.score ?? drinks[0]?.score ?? 50;
                    usedProductIds.add(preferredP.id);
                    const match = { segment, product: preferredP, score: preferredScore };
                    if (preferredP.hasAttributes && preferredP.attributes?.length) {
                        needsAttributes.push(match);
                    }
                    else {
                        confident.push(match);
                    }
                    continue;
                }
            }
            if (/\bejecutivo\b/.test(segNorm) ||
                /\balmuerzo\b/.test(segNorm) ||
                (0, whatsapp_named_menu_dish_1.isNamedMenuDishOrderPhrase)(segment)) {
                const resolved = this.resolveNamedMenuDishProduct(segment, products) ||
                    (() => {
                        const wrapperHits = uniqueScored.filter((x) => (0, whatsapp_named_menu_dish_1.productLooksLikeNamedMenuDish)(x.p.name));
                        if (!wrapperHits.length)
                            return null;
                        return (this.resolveNamedMenuDishProduct(segment, wrapperHits.map((x) => x.p)) || wrapperHits[0].p);
                    })();
                if (resolved && !usedProductIds.has(resolved.id)) {
                    if (!this.productNameFitsUtterance(resolved, segment) &&
                        this.leftoverFoodWords(segment, resolved).length) {
                        unresolved.push(segment);
                        continue;
                    }
                    usedProductIds.add(resolved.id);
                    const match = {
                        segment,
                        product: resolved,
                        score: uniqueScored.find((x) => x.p.id === resolved.id)?.score ?? 80,
                    };
                    if (resolved.hasAttributes && resolved.attributes?.length) {
                        const attrText = this.looksLikeClearlyMultiDishOrder(text) || segments.length >= 2
                            ? segment
                            : `${segment} ${text}`;
                        if (this.extractExplicitAttributeChoice(attrText, resolved)) {
                            confident.push({ ...match, segment: attrText });
                        }
                        else
                            needsAttributes.push(match);
                    }
                    else
                        confident.push(match);
                    continue;
                }
            }
            if (this.isStrongProductMatch(uniqueScored)) {
                const top = uniqueScored[0];
                if (!this.productNameFitsUtterance(top.p, segment) &&
                    this.leftoverFoodWords(segment, top.p).length) {
                    unresolved.push(segment);
                    continue;
                }
                if (usedProductIds.has(top.p.id))
                    continue;
                const family = this.findProductVariantFamily(segment, products, uniqueScored.map((x) => x.p));
                if (family && family.variants.length >= 2) {
                    const pickedVariant = this.pickVariantFromFamilyText(segment, family);
                    if (pickedVariant) {
                        if (usedProductIds.has(pickedVariant.id))
                            continue;
                        usedProductIds.add(pickedVariant.id);
                        const match = { segment, product: pickedVariant, score: top.score };
                        if (pickedVariant.hasAttributes && pickedVariant.attributes?.length) {
                            const attrText = this.looksLikeClearlyMultiDishOrder(text) || segments.length >= 2
                                ? segment
                                : `${segment} ${text}`;
                            if (this.extractExplicitAttributeChoice(attrText, pickedVariant)) {
                                confident.push({ ...match, segment: attrText });
                            }
                            else
                                needsAttributes.push(match);
                        }
                        else
                            confident.push(match);
                        continue;
                    }
                    const bare = family.variants.find((p) => normalizeText(p.name) === family.baseKey) || null;
                    if (bare && !usedProductIds.has(bare.id)) {
                        usedProductIds.add(bare.id);
                        const match = { segment, product: bare, score: top.score };
                        if (bare.hasAttributes && bare.attributes?.length) {
                            const attrText = this.looksLikeClearlyMultiDishOrder(text) || segments.length >= 2
                                ? segment
                                : `${segment} ${text}`;
                            if (this.extractExplicitAttributeChoice(attrText, bare)) {
                                confident.push({ ...match, segment: attrText });
                            }
                            else
                                needsAttributes.push(match);
                        }
                        else
                            confident.push(match);
                    }
                    else {
                        ambiguous.push({
                            segment,
                            candidates: this.dedupeProductsById(family.variants).slice(0, 4),
                        });
                    }
                    continue;
                }
                usedProductIds.add(top.p.id);
                const match = { segment, product: top.p, score: top.score };
                if (top.p.hasAttributes && top.p.attributes?.length) {
                    const attrText = this.looksLikeClearlyMultiDishOrder(text) || segments.length >= 2
                        ? segment
                        : `${segment} ${text}`;
                    if (this.extractExplicitAttributeChoice(attrText, top.p)) {
                        confident.push({ ...match, segment: attrText });
                    }
                    else
                        needsAttributes.push(match);
                }
                else
                    confident.push(match);
                continue;
            }
            if (uniqueScored.length >= 2 && uniqueScored[0].score >= 35) {
                ambiguous.push({
                    segment,
                    candidates: this.dedupeProductsById(uniqueScored.slice(0, 6).map((x) => x.p)).slice(0, 4),
                });
            }
            else if (uniqueScored.length === 1 && uniqueScored[0].score >= 40) {
                const top = uniqueScored[0];
                if (!this.productNameFitsUtterance(top.p, segment) &&
                    this.leftoverFoodWords(segment, top.p).length) {
                    unresolved.push(segment);
                    continue;
                }
                if (usedProductIds.has(top.p.id))
                    continue;
                usedProductIds.add(top.p.id);
                const match = { segment, product: top.p, score: top.score };
                if (top.p.hasAttributes && top.p.attributes?.length) {
                    const attrText = this.looksLikeClearlyMultiDishOrder(text) || segments.length >= 2
                        ? segment
                        : `${segment} ${text}`;
                    if (this.extractExplicitAttributeChoice(attrText, top.p)) {
                        confident.push({ ...match, segment: attrText });
                    }
                    else
                        needsAttributes.push(match);
                }
                else
                    confident.push(match);
            }
            else if (uniqueScored.length >= 1 && uniqueScored[0].score >= 30) {
                const top = uniqueScored[0];
                if (!this.productNameFitsUtterance(top.p, segment) &&
                    this.leftoverFoodWords(segment, top.p).length) {
                    unresolved.push(segment);
                    continue;
                }
                if (!usedProductIds.has(top.p.id) && !this.isLikelyDrinkProduct(top.p)) {
                    usedProductIds.add(top.p.id);
                    const match = { segment, product: top.p, score: top.score };
                    if (top.p.hasAttributes && top.p.attributes?.length) {
                        needsAttributes.push(match);
                    }
                    else
                        confident.push(match);
                }
                else if (this.looksLikePersonNameSegment(segment) &&
                    !this.spokenDishOnMenu(segment, products) &&
                    !this.looksLikeClearlyMultiDishOrder(text)) {
                    possibleCustomerNames.push(segment.replace(/\s+/g, ' ').trim());
                }
                else if (!this.isLogisticsOnlySegment(segment)) {
                    unresolved.push(segment);
                }
            }
            else if (this.looksLikePersonNameSegment(segment) &&
                !this.spokenDishOnMenu(segment, products) &&
                !this.looksLikeClearlyMultiDishOrder(text)) {
                possibleCustomerNames.push(segment.replace(/\s+/g, ' ').trim());
            }
            else if (!this.isLogisticsOnlySegment(segment)) {
                unresolved.push(segment);
            }
        }
        this.keepOnlyOpenAttributeChoices(confident, needsAttributes);
        const leftover = unresolved.filter((s) => !this.isPolitenessOnlySegment(s));
        unresolved.splice(0, unresolved.length, ...leftover);
        const resolvedCount = confident.length + ambiguous.length + needsAttributes.length;
        const names = possibleCustomerNames.length > 0
            ? [...new Set(possibleCustomerNames.map((n) => n.replace(/\bser[ií]a\b/gi, '').replace(/\s+/g, ' ').trim()).filter(Boolean))]
            : undefined;
        if (resolvedCount === 0 && unresolved.length === 0)
            return null;
        if (segments.length >= 2 && (resolvedCount >= 1 || unresolved.length > 0)) {
            return {
                segments,
                confident,
                ambiguous,
                unresolved,
                needsAttributes,
                possibleCustomerNames: names,
            };
        }
        if (resolvedCount < 2 && swapNotedHostId == null)
            return null;
        return {
            segments,
            confident,
            ambiguous,
            unresolved,
            needsAttributes,
            possibleCustomerNames: names,
        };
    }
    keepOnlyOpenAttributeChoices(confident, needsAttributes) {
        const pending = [];
        for (const item of needsAttributes) {
            const explicit = this.extractExplicitAttributeChoice(item.segment, item.product) || [];
            const filled = this.fillDefaultAttributes(item.product, explicit);
            if (this.isAttributeSelectionComplete(item.product, filled))
                confident.push(item);
            else
                pending.push(item);
        }
        needsAttributes.length = 0;
        needsAttributes.push(...pending);
    }
    formatMoney(amount) {
        return `$${Math.round(amount).toLocaleString('es-CO')}`;
    }
    formatProductCode(code) {
        return `*#${code}*`;
    }
    formatProductMeta(price, code) {
        return `💰 ${this.formatMoney(price)}  ·  Cód. ${this.formatProductCode(code)}`;
    }
    formatProductSubtitle(description, maxLen = 120) {
        const short = description.length > maxLen ? `${description.slice(0, maxLen - 1)}…` : description;
        return `_${short}_`;
    }
    formatProductHeader(name, price, code) {
        const lines = [`🍽️ *${name}*`];
        if (price != null && code != null) {
            lines.push(this.formatProductMeta(price, code));
        }
        else if (code != null) {
            lines.push(`Cód. ${this.formatProductCode(code)}`);
        }
        return lines.join('\n');
    }
    formatListChoiceHint() {
        return '_Escribe el número._';
    }
    formatProductListItem(product, index) {
        const prefix = index != null ? `${this.optionNumberEmoji(index)} ` : '• ';
        const lines = [
            `${prefix}*${product.name}* · ${this.formatMoney(product.price)} · ${this.formatProductCode(product.code)}`,
        ];
        if (product.description) {
            lines.push(`   ${this.formatProductSubtitle(product.description, 80)}`);
        }
        return lines.join('\n');
    }
    formatCategoryList(categoryName, list) {
        const body = list.map((p, i) => this.formatProductListItem(p, i + 1)).join('\n');
        return (`📋 *${categoryName}* (_${list.length}_)\n` +
            `${body}\n\n` +
            this.formatListChoiceHint());
    }
    formatCategoryAlternatives(missingLabel, categoryName, list) {
        return (`No tenemos *${missingLabel}*.\n` +
            `Te ofrecemos estas alternativas:\n\n` +
            this.formatCategoryList(categoryName, list));
    }
    comesWithOffer(text, products) {
        const q = normalizeText(text || '');
        if (!q || !/\bcon\b/.test(q))
            return null;
        if (this.looksLikeSideModificationNote(text))
            return null;
        const noise = new Set([
            'tiene', 'tienen', 'tienes', 'hay', 'alguna', 'algun', 'alguno', 'algo',
            'unas', 'unos', 'una', 'uno', 'por', 'favor', 'porfa',
        ]);
        const cleaned = q
            .split(' ')
            .filter((t) => t && !noise.has(t))
            .join(' ');
        const match = cleaned.match(/\b([a-z]{4,})\s+con\s+([a-z]{3,})\b/);
        if (!match?.[1] || !match?.[2])
            return null;
        const head = singularizeEsToken(match[1]);
        const inclusion = singularizeEsToken(match[2]);
        if (!head || !inclusion || head === inclusion)
            return null;
        if (products.some((p) => p.availableNow !== false && this.productNameFitsUtterance(p, cleaned))) {
            return null;
        }
        const blobOf = (p) => {
            const attrs = (p.attributes || [])
                .flatMap((a) => [a.attributeName, ...(a.options || [])])
                .join(' ');
            return normalizeText(`${p.name} ${p.description || ''} ${attrs}`);
        };
        const wordIn = (blob, token) => blob.split(/\s+/).some((w) => w === token || singularizeEsToken(w) === token);
        const headProducts = products.filter((p) => {
            if (p.availableNow === false)
                return false;
            return wordIn(normalizeText(p.name), head);
        });
        if (!headProducts.length)
            return null;
        const matching = headProducts.filter((p) => wordIn(blobOf(p), inclusion));
        const label = `${head} con ${inclusion}`;
        if (matching.length) {
            return {
                reply: `Sí, estas *${head}* traen *${inclusion}*:\n\n` +
                    this.formatCategoryList(titleCaseWords(head), matching.slice(0, 8)),
            };
        }
        return {
            reply: this.formatCategoryAlternatives(label, titleCaseWords(head), headProducts.slice(0, 8)),
        };
    }
    formatCategoryBrowseReply(hit) {
        if (hit.askedButMissing) {
            return this.formatCategoryAlternatives(hit.askedButMissing, hit.categoryName, hit.products);
        }
        return this.formatCategoryList(hit.categoryName, hit.products);
    }
    formatProductOptionsPrompt(product, alreadySelected = [], opts) {
        const remaining = this.getRemainingAttributes(product, alreadySelected, opts);
        const next = remaining[0];
        if (!product.hasAttributes || !product.attributes?.length || !next) {
            return this.formatProductHeader(product.name, product.price, product.code);
        }
        return this.formatAttributeStepPrompt(product, next, alreadySelected, { mode: 'order' });
    }
    resolveAttributesFromMessage(product, text, alreadySelected = [], opts) {
        if (!product.attributes?.length) {
            return { status: 'complete', attributes: alreadySelected };
        }
        let selected = [...alreadySelected];
        let progress = true;
        for (const attr of product.attributes) {
            if (selected.some(choice => choice.attributeName === attr.attributeName))
                continue;
            const picked = this.pickAttributeOptionFromText(text, attr, this.isLikelySideOnlyProduct(product));
            if (picked)
                selected.push({ attributeName: attr.attributeName, attributeValue: picked });
        }
        if (opts?.variantIntent === 'solo' || opts?.variantIntent === 'combo') {
            const remaining = this.getRemainingAttributes(product, selected, opts);
            for (const attr of remaining) {
                if (!this.isModalityAttribute(attr))
                    continue;
                const needle = opts.variantIntent === 'combo' ? 'combo' : 'solo';
                let picked = attr.options.find((o) => normalizeText(o).includes(needle));
                if (!picked && opts.variantIntent === 'combo') {
                    picked = attr.options.find((o) => /\b(completo|completa|con\s+bebida|con\s+gaseosa)\b/.test(normalizeText(o)));
                }
                if (!picked && opts.variantIntent === 'solo') {
                    picked = attr.options.find((o) => /\b(sin\s+bebida|sin\s+gaseosa)\b/.test(normalizeText(o)));
                }
                if (picked) {
                    selected = [
                        ...selected,
                        { attributeName: attr.attributeName, attributeValue: picked },
                    ];
                }
                break;
            }
        }
        while (progress) {
            progress = false;
            const remaining = this.getRemainingAttributes(product, selected, opts);
            if (!remaining.length) {
                break;
            }
            for (const attr of remaining) {
                const picked = this.pickAttributeOptionFromText(text, attr, this.isLikelySideOnlyProduct(product));
                if (!picked)
                    continue;
                selected = [...selected, { attributeName: attr.attributeName, attributeValue: picked }];
                progress = true;
                break;
            }
        }
        if (this.isAttributeSelectionComplete(product, selected, opts)) {
            return { status: 'complete', attributes: selected };
        }
        if (selected.length > alreadySelected.length) {
            return { status: 'partial', attributes: selected };
        }
        return { status: 'invalid' };
    }
    findCartAttributeOptionChange(text, cart, products) {
        const q = normalizeText(text || '');
        if (!q || !cart.length)
            return null;
        const wantsChange = /\b(puede ser|se puede|cambiar|en vez|en lugar|que sea|dejalo|dejala|cambialo|cambiala)\b/.test(q);
        if (!wantsChange)
            return null;
        const hits = [];
        for (let i = cart.length - 1; i >= 0; i--) {
            const line = cart[i];
            const product = products.find((p) => p.id === line.productId);
            if (!product?.attributes?.length)
                continue;
            for (const attr of product.attributes) {
                const picked = this.pickAttributeOptionFromText(text, attr);
                if (!picked)
                    continue;
                const current = (line.attributes || []).find((a) => normalizeText(a.attributeName) === normalizeText(attr.attributeName));
                if (current && normalizeText(current.attributeValue) === normalizeText(picked))
                    continue;
                hits.push({
                    cartIndex: i,
                    itemName: line.name,
                    attributeName: attr.attributeName,
                    attributeValue: picked,
                    drink: this.isComboOnlyAttribute(attr),
                });
            }
        }
        if (!hits.length)
            return null;
        const mentionsDrink = /\b(gaseosa|bebida|sabor)\b/.test(q);
        const hit = (mentionsDrink ? hits.find((h) => h.drink) : null) || hits[0];
        return {
            cartIndex: hit.cartIndex,
            itemName: hit.itemName,
            attributeName: hit.attributeName,
            attributeValue: hit.attributeValue,
        };
    }
    listCartAttributeOptionsNamedInText(text, cart, products) {
        const q = normalizeText(text || '');
        if (!q || !cart.length)
            return [];
        const hits = [];
        for (let i = cart.length - 1; i >= 0; i--) {
            const line = cart[i];
            const product = products.find((p) => p.id === line.productId);
            if (!product?.attributes?.length)
                continue;
            for (const attr of product.attributes) {
                const named = attr.options
                    .filter((opt) => {
                    const o = normalizeText(opt);
                    if (o.length < 3)
                        return false;
                    if (o.includes(' '))
                        return q.includes(o);
                    return new RegExp(`(?:^|\\s)${escapeRegExp(o)}(?:\\s|$)`).test(q);
                })
                    .sort((a, b) => normalizeText(b).length - normalizeText(a).length)[0];
                if (!named)
                    continue;
                const current = (line.attributes || []).find((a) => normalizeText(a.attributeName) === normalizeText(attr.attributeName));
                if (current && normalizeText(current.attributeValue) === normalizeText(named))
                    continue;
                hits.push({
                    cartIndex: i,
                    productId: line.productId,
                    itemName: line.name,
                    attributeName: attr.attributeName,
                    attributeValue: named,
                });
            }
        }
        return hits;
    }
    matchAttributeOptionValue(value, options) {
        const q = normalizeText(value || '');
        if (!q || !options.length)
            return null;
        const exact = options.find((o) => normalizeText(o) === q);
        if (exact)
            return exact;
        const contained = options
            .filter((o) => {
            const n = normalizeText(o);
            return n.length >= 3 && q.includes(n);
        })
            .sort((a, b) => normalizeText(b).length - normalizeText(a).length);
        if (contained[0])
            return contained[0];
        const qCompact = compactAlphaNum(value);
        const compactHits = options
            .filter((o) => {
            const n = compactAlphaNum(o);
            return n.length >= 4 && qCompact.includes(n);
        })
            .sort((a, b) => compactAlphaNum(b).length - compactAlphaNum(a).length);
        if (compactHits[0])
            return compactHits[0];
        let best = null;
        for (const opt of options) {
            const n = normalizeText(opt);
            if (n.length < 4 || q.length < 4)
                continue;
            const distance = boundedEditDistance(n, q, 2);
            if (distance == null)
                continue;
            if (!best || distance < best.distance)
                best = { opt, distance };
        }
        return best?.opt || null;
    }
    pickAttributeOptionFromText(text, attr, allowPortionChoice = false) {
        let cleaned = text || '';
        if (!allowPortionChoice)
            cleaned = cleaned.replace(/\bporci[oó]n(?:es)?\s+(?:de\s+)?(?:papas?|yuca|arepas?|maduro)(?:\s+\w+){0,3}\b/gi, ' ');
        cleaned = cleaned.replace(/\bpapas?\s+fritas?\b/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        const q = normalizeText(cleaned);
        if (!q)
            return null;
        const rejectsOption = /\b(no quiero|ya no|que no|no era|no es eso)\b/.test(q) &&
            !/\bsin\s+arepas?\b/.test(q);
        const attrName = normalizeText(attr.attributeName || '');
        const isArepaAttr = /\barepas?\b/.test(attrName);
        if (this.isComboOnlyAttribute(attr)) {
            const conMatch = q.match(/\bcon\s+(?:la\s+|el\s+|las?\s+|una\s+)?(?:gaseosa\s+(?:de\s+)?)?([a-z0-9\s]{3,40})/);
            if (conMatch?.[1]) {
                const tail = normalizeText(conMatch[1]);
                for (const opt of attr.options) {
                    const o = normalizeText(opt);
                    if (tail.includes(o) || o.includes(tail))
                        return opt;
                    const tailTokens = tail.split(' ').filter((t) => t.length >= 3);
                    for (const tok of tailTokens) {
                        if (o.includes(tok) && tok.length >= 4)
                            return opt;
                        if (tok.length >= 4 &&
                            o.split(' ').some((part) => part.startsWith(tok) || tok.startsWith(part))) {
                            return opt;
                        }
                    }
                }
            }
        }
        for (const opt of attr.options) {
            const o = normalizeText(opt);
            if (o.length < 3)
                continue;
            if (!(q === o || q.includes(o)))
                continue;
            if (rejectsOption)
                continue;
            if (isArepaAttr && /^(fritas?|blancas?)$/.test(o)) {
                if (!/\barepas?\s+(?:fritas?|blancas?)\b/.test(q) &&
                    !/\b(?:fritas?|blancas?)\s+arepas?\b/.test(q) &&
                    !/\barepas?\b/.test(q)) {
                    continue;
                }
            }
            return opt;
        }
        const styleAttr = /\b(seleccion|preparacion|estilo|coccion|pollo)\b/.test(attrName) &&
            !isArepaAttr &&
            !/\b(bebida|sabor|presa|arepas?)\b/.test(attrName);
        if (!rejectsOption && styleAttr) {
            const styleWords = q.split(/\s+/).filter((w) => {
                const s = singularizeEsToken(w);
                return COOKING_STYLE_TOKENS.has(w) || COOKING_STYLE_TOKENS.has(s);
            });
            for (const word of styleWords) {
                const hit = attr.options.find((opt) => productNameHasCookingStyle(opt, word));
                if (hit)
                    return hit;
            }
        }
        const compactPick = this.matchAttributeOptionValue(cleaned, attr.options);
        if (compactPick && !rejectsOption) {
            const o = normalizeText(compactPick);
            const arepaBare = isArepaAttr && /^(fritas?|blancas?)$/.test(o) && !/\barepas?\b/.test(q);
            if (!arepaBare)
                return compactPick;
        }
        if (/\b(presa|proteina|proteína|corte)\b/.test(attrName) || /\bpechuga\b/.test(attrName)) {
            if (/\bpechuga\b/.test(q)) {
                const pechugaOpt = attr.options.find((o) => /\bpechuga\b/.test(normalizeText(o)));
                if (pechugaOpt)
                    return pechugaOpt;
            }
            if (/\b(pierna|pernil)\b/.test(q)) {
                const piernaOpt = attr.options.find((o) => /\b(pierna|pernil)\b/.test(normalizeText(o)));
                if (piernaOpt)
                    return piernaOpt;
            }
        }
        if (/\b(en\s+combo|modo\s+combo|version\s+combo|que\s+sea\s+combo|dame(lo|melo)\s+en\s+combo|demelo\s+en\s+combo|pon(lo|me)\s+en\s+combo)\b/.test(q) ||
            (/\bcombo\b/.test(q) && !/\bsolo\b/.test(q))) {
            let comboOpt = attr.options.find((o) => normalizeText(o).includes('combo'));
            if (!comboOpt) {
                comboOpt = attr.options.find((o) => /\b(completo|completa|con\s+bebida|con\s+gaseosa)\b/.test(normalizeText(o)));
            }
            if (comboOpt)
                return comboOpt;
        }
        if (/\b(en\s+solo|modo\s+solo|que\s+sea\s+solo|dame(lo|melo)\s+en\s+solo|demelo\s+en\s+solo|sin\s+combo)\b/.test(q) ||
            (/\bsolo\b/.test(q) && !/\bcombo\b/.test(q))) {
            let soloOpt = attr.options.find((o) => /\bsolo\b/.test(normalizeText(o)));
            if (!soloOpt) {
                soloOpt = attr.options.find((o) => /\b(sin\s+bebida|sin\s+gaseosa)\b/.test(normalizeText(o)));
            }
            if (soloOpt)
                return soloOpt;
        }
        const portionHints = [
            { re: /\b(medio|media)\b/, needle: 'medio' },
            { re: /\b(cuarto|cuarta)\b/, needle: 'cuarto' },
            { re: /\b(entero|entera|unidad)\b/, needle: 'entero' },
            { re: /\b(uno|una)\b/, needle: 'uno' },
        ];
        if (!rejectsOption) {
            for (const hint of portionHints) {
                if (!hint.re.test(q))
                    continue;
                const hit = attr.options.find((o) => normalizeText(o).includes(hint.needle));
                if (hit)
                    return hit;
            }
        }
        if (!rejectsOption) {
            for (const opt of attr.options) {
                const o = normalizeText(opt);
                if (isArepaAttr && /\bsin\b/.test(o) && !/\bsin\s+arepas?\b/.test(q))
                    continue;
                for (const token of o.split(' ').filter((t) => t.length >= 3)) {
                    if (['pollo', 'frito', 'broaster', 'pechuga', 'gaseosa', 'combo', 'sin'].includes(token)) {
                        continue;
                    }
                    const re = new RegExp(`(?:^|\\s)${escapeRegExp(token)}(?:\\s|$)`);
                    if (re.test(q))
                        return opt;
                }
            }
        }
        return null;
    }
    resolveNextAttributeChoice(product, text, alreadySelected, opts) {
        if (!product.attributes?.length) {
            return { status: 'complete', attributes: alreadySelected };
        }
        const remaining = this.getRemainingAttributes(product, alreadySelected, opts);
        if (!remaining.length) {
            return { status: 'complete', attributes: alreadySelected };
        }
        const attr = remaining[0];
        let picked = null;
        const bare = text.trim().match(/^([1-9]\d{0,2})$/);
        if (bare) {
            const num = parseInt(bare[1], 10);
            if (num >= 1 && num <= attr.options.length) {
                picked = attr.options[num - 1];
            }
        }
        if (!picked) {
            const m = text.trim().match(/(?:opci[oó]n|la|el)\s*([1-9]\d{0,2})\s*$/i);
            if (m) {
                const num = parseInt(m[1], 10);
                if (num >= 1 && num <= attr.options.length)
                    picked = attr.options[num - 1];
            }
        }
        if (!picked) {
            picked = this.pickAttributeOptionFromText(text, attr);
        }
        if (picked) {
            const nextSelected = [
                ...alreadySelected,
                { attributeName: attr.attributeName, attributeValue: picked },
            ];
            const bulk = this.resolveAttributesFromMessage(product, text, nextSelected, opts);
            const merged = bulk.status === 'complete' || bulk.status === 'partial' ? bulk.attributes : nextSelected;
            return this.coerceAttributeStep(product, this.isAttributeSelectionComplete(product, merged, opts)
                ? { status: 'complete', attributes: merged }
                : { status: 'partial', attributes: merged }, opts);
        }
        const fromMessage = this.coerceAttributeStep(product, this.resolveAttributesFromMessage(product, text, alreadySelected, opts), opts);
        if (fromMessage.status !== 'invalid')
            return fromMessage;
        return { status: 'invalid' };
    }
    resolveAttributesFromText(product, text) {
        const step = this.resolveAttributesFromMessage(product, text, []);
        if (step.status === 'complete')
            return step.attributes;
        if (step.status === 'partial')
            return null;
        return null;
    }
};
exports.WhatsappCatalogService = WhatsappCatalogService;
exports.WhatsappCatalogService = WhatsappCatalogService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [products_service_1.ProductsService])
], WhatsappCatalogService);
//# sourceMappingURL=whatsapp-catalog.service.js.map