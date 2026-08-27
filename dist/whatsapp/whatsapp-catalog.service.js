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
    if (n.length > 4 && n.endsWith('es'))
        return n.slice(0, -2);
    return n;
}
function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function fixCommonOrderTypos(text) {
    return (0, whatsapp_local_glossary_1.applyLocalGlossary)(text);
}
const DRINK_ORDER_TOKEN = '(?:gaseosa|gaseosas|coca\\s*cola?|cola|sprite|pepsi|jugo|jugos|limonada|malta|cerveza|agua|hit|postobon|postob[oó]n|mr\\s*tea|cysco)';
const FOOD_ORDER_TOKEN = '(?:medio|cuarto|entero|pollo|broaster|frito|asado|pechuga|alas?|ejecutivo|bandeja|costilla|churrasco|churrascos|sobrebarriga|mondongo|sopa|arroz|paisa|chino|mojarra|mojarras|platano|plátano|alitas?|yuca|papa|papas|hamburguesa|hamburguesas)';
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
const MENU_WRAPPER_TOKENS = new Set([
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
    if (q.length >= 5 && c.length >= 5 && (c.includes(q) || q.includes(c))) {
        if (Math.min(q.length, c.length) / Math.max(q.length, c.length) >= 0.75)
            return true;
    }
    if (q.length < 6 || c.length < 6)
        return false;
    if (q.slice(1) === c.slice(1))
        return false;
    const maxDist = q.length <= 8 ? 1 : 2;
    return tokenEditDistance(q, c) <= maxDist;
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
    'horno',
    'sudado',
    'sudada',
    'guisado',
    'guisada',
    'maduro',
    'maduros',
    'verde',
    'verdes',
]);
function singularizeEsToken(token) {
    const t = normalizeText(token);
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
    async getMenuProducts() {
        const cached = this.menuCache;
        if (cached && Date.now() - cached.at < this.TTL_MS) {
            return cached.products;
        }
        const grouped = await this.productsService.findProductsGroupedByCategory();
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
        const compact = available
            .map((p) => `[id=${p.id}] código ${p.code} — ${p.name} — $${Math.round(p.price).toLocaleString('es-CO')}` +
            (p.categoryName ? ` [${p.categoryName}]` : '') +
            (p.hasAttributes ? ' (requiere opciones)' : ''))
            .join('\n');
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
            compact,
            detailed: detailedParts.join('\n\n'),
        };
        return products;
    }
    async getMenuCompactText() {
        await this.getMenuProducts();
        return this.menuCache?.compact || '';
    }
    async getMenuDetailedText() {
        await this.getMenuProducts();
        return this.menuCache?.detailed || '';
    }
    async getCategoryNames() {
        await this.getMenuProducts();
        return this.menuCache?.categories || [];
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
        return (`Jaja, por *${brand}* soy el asistente de *pedidos* 🍗\n\n` +
            `Si quieres ordenar, dime el *plato* o el *código*, o escribe *menú*.\n` +
            `_Si prefieres hablar con alguien, escribe *asesor*._`);
    }
    isMenuExploreIntent(text, products = []) {
        const q = normalizeText(text);
        if (!q || q.length < 5)
            return false;
        if (this.isRestaurantLocationInquiry(text))
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
        return (/\b(que|qué)\s+(hay|tienen|tiene|tienes|ofrecen|ofreces|sirven|venden|ponen)\b/.test(q) ||
            /\b(muestrame|mostrame|ver)\s+(las?\s+)?(opciones|lista)?\b/.test(q) ||
            /\b(opciones|lista)\s+de\b/.test(q));
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
        const q = normalizeText(text || '');
        if (!q)
            return 0;
        let count = 0;
        const re = /\b(\d{1,2}|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\s+(?:de\s+)?([a-z0-9]{3,})/g;
        for (const m of q.matchAll(re)) {
            const rawNum = m[1];
            const after = m[2];
            if (this.QTY_SKIP_AFTER_NUM.has(after))
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
    extractQuantityFromSegment(text) {
        const raw = fixCommonOrderTypos((text || '').trim());
        if (!raw)
            return 1;
        const q = normalizeText(raw);
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
        const examplesPerCategory = opts?.examplesPerCategory ?? 2;
        const byCat = this.groupProductsByCategory(products);
        const categories = [...byCat.keys()];
        const lines = [];
        const menuUrl = (opts?.menuUrl || '').trim();
        if (opts?.intro) {
            lines.push(opts.intro);
        }
        if (menuUrl) {
            lines.push('', `Puedes conocer *todos nuestros productos* aquí:\n${menuUrl}`, '', 'O si prefieres, te oriento por acá. Un resumen por categorías:');
        }
        else if (opts?.intro) {
            lines.push('', 'Te dejo un resumen por categorías:');
        }
        lines.push('');
        categories.forEach((cat, idx) => {
            const list = byCat.get(cat);
            lines.push(`*${idx + 1}. ${cat}* (${list.length} ${list.length === 1 ? 'opción' : 'opciones'})`);
            for (const p of list.slice(0, examplesPerCategory)) {
                lines.push(`   • *${p.name}* — ${this.formatMoney(p.price)}`);
            }
            if (list.length > examplesPerCategory) {
                lines.push(`   _…y ${list.length - examplesPerCategory} más_`);
            }
            lines.push('');
        });
        lines.push('¿Qué categoría te provoca? Escríbeme el *número* o el *nombre* (ej. *pollo*).', 'Si ya sabes el plato, dime el *nombre* o *código* y te lo agrego.');
        return { text: lines.join('\n').replace(/\n{3,}/g, '\n\n'), categories };
    }
    buildMenuCategoryContextForAi(products) {
        const { text } = this.formatMenuCategoryOverview(products, {
            intro: 'Resumen por categorías (orienta al cliente; NO vuelques todo el menú ni códigos en bloque):',
            examplesPerCategory: 2,
        });
        return text;
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
        const explicit = raw.match(/\b(?:codigo|código|code)\s*(\d{1,4})\b/i) || raw.match(/#\s*(\d{1,4})\b/);
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
            .replace(/^(me\s+puedes\s+(?:enviar|mandar|traer|dar|regalar|poner)\s+)/i, '')
            .replace(/^(puedes\s+(?:enviarme|mandarme|traerme|darme|regalarme)\s+)/i, '')
            .replace(/^(?:env[ií]ame|m[aá]ndame|tra[eé]me)\s+/i, '')
            .replace(/^(me\s+(?:regalas|das|traes|pones|mandas)\s+)/i, '')
            .replace(/^(?:reg[aá]lame|reg[aá]la)\s+/i, '')
            .replace(/^(quisiera|gustaria|deseo|necesito|dame|me das|me gustaria)[.!?,;:]*\s*/i, '')
            .replace(/^(quieor|qiero|kiero|quiiero|quero|quiero|voy a pedir|pedi|pido|pedimos|pedire)[.!?,;:]*\s*(?:un|una|unos|unas|el|la|los|las)?\s*/i, '')
            .replace(/\s+(por favor|porfa|pf|gracias)[\s!.?]*$/i, '')
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
            .replace(/\s+/g, ' ')
            .trim();
        return cleaned;
    }
    stripProductSearchNoise(query) {
        return query
            .replace(/\s+con\s+(?:la\s+|el\s+|las?\s+|una\s+)?(?:gaseosa\s+(?:de\s+)?)?(?:manzana|coca\s*cola?|cola|sprite|pepsi|uva|postobon|postob[oó]n|litro\s*personal|personal|limonada|hit|mr\s*tea|cysco|agua|fresa|naranja|maracuya|maracuy[aá]|mango|poker|costena|coste[nñ]a)[\w\s]*/gi, '')
            .replace(/^combo\s+de\s+/i, '')
            .replace(/^combo\s+/i, '')
            .replace(/\s+de\s+combo\b/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
    }
    cleanOrderSegment(segment) {
        return segment
            .replace(/^(me\s+puedes\s+(?:enviar|mandar|traer|dar|regalar|poner)\s+)/i, '')
            .replace(/^(puedes\s+(?:enviarme|mandarme|traerme|darme)\s+)/i, '')
            .replace(/^(?:env[ií]ame|m[aá]ndame|tra[eé]me)\s+/i, '')
            .replace(/^(?:pedi|pido|pedimos|quiero|dame|ponme)\s+/i, '')
            .replace(/^(?:un|una|unos|unas|el|la|los|las)\s+/i, '')
            .replace(/\bde\s+con\b/gi, 'con')
            .replace(/\s+/g, ' ')
            .trim();
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
    unrequestedNameTokens(productName, query) {
        const q = normalizeText(fixCommonOrderTypos(query || ''));
        const name = normalizeText(productName);
        const weak = new Set([
            ...this.WEAK_PRODUCT_TOKENS,
            'de',
            'del',
            'la',
            'el',
            'con',
            'y',
        ]);
        return name
            .split(/\s+/)
            .filter((t) => t.length >= 3 && !weak.has(t))
            .filter((t) => !this.queryHasToken(q, t) && !q.includes(singularizeEsToken(t)));
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
    looksLikeFoodPlusDrinkOrder(text) {
        const q = normalizeText(fixCommonOrderTypos(text));
        if (!q || q.length < 8)
            return false;
        const hasFood = /\b(pollo|pollos|broaster|frito|asado|pechuga|alas?|ejecutivo|bandeja|costilla|churrascos?|sobrebarriga|mondongo|sopa|arroz|paisa|chino|mojarras?|platanos?|alitas?|arepas?)\b/.test(q);
        const hasDrink = /\b(gaseosa|gaseosas|coca|sprite|pepsi|jugo|jugos|limonadas?|malta|cerveza|agua|hit|postobon|postob[oó]n)\b/.test(q);
        return hasFood && hasDrink;
    }
    detectPortionHint(text) {
        const q = normalizeText(text);
        if (/\b(medio|media)\b/.test(q))
            return 'medio';
        if (/\b(cuarto|cuarta)\b/.test(q))
            return 'cuarto';
        if (/\b(entero|entera|unidad)\b/.test(q))
            return 'entero';
        return null;
    }
    detectServingSizeHint(text) {
        const q = normalizeText(text);
        if (/\b(pequenas?|pequenitas?|chicas?|chiquitas?)\b/.test(q))
            return 'pequena';
        if (/\b(grandes?|grandotas?)\b/.test(q))
            return 'grande';
        return null;
    }
    productIsSmallServing(name) {
        const n = normalizeText(name);
        return /\b(pequena|pequenas|chica|chicas)\b/.test(n);
    }
    detectProductPortionSize(name) {
        const n = normalizeText(name);
        if (/\bmedio\b/.test(n) || /\b1\s*2\b/.test(n))
            return 'medio';
        if (/\bcuarto\b/.test(n) || /\b1\s*4\b/.test(n))
            return 'cuarto';
        if (/^1\s+pollo\b/.test(n))
            return 'entero';
        return null;
    }
    resolveSizedChickenProduct(text, products) {
        const q = normalizeText(fixCommonOrderTypos(text));
        if (!/\bpollo\b/.test(q) && !/\bbroaster\b/.test(q) && !/\bfrito\b/.test(q)) {
            return null;
        }
        if (/\b(combo|bandeja|ejecutivo|alitas|arroz chino|taco|hamburguesa|menu)\b/.test(q)) {
            return null;
        }
        const style = /\bbroaster\b/.test(q)
            ? 'broaster'
            : /\bfrito\b/.test(q)
                ? 'frito'
                : null;
        if (!style && !/\bpollo\b/.test(q))
            return null;
        const portion = this.detectPortionHint(q) || 'entero';
        const available = products.filter((p) => p.availableNow !== false);
        const isChickenSku = (n) => {
            if (/\b(combo|bandeja|ejecutivo|alitas|arroz|taco|hamburguesa|milensa|pechuga|menu)\b/.test(n)) {
                return false;
            }
            if (style === 'broaster' && !/\bbroaster\b/.test(n))
                return false;
            if (style === 'frito' && !/\bfrito\b/.test(n))
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
    resolveSizedSoupProduct(text, products) {
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
        const hay = normalizeText(`${product.name} ${product.categoryName || ''} ${product.description || ''}`);
        return /\b(gaseosa|bebida|jugo|limonada|malta|coca|sprite|pepsi|cerveza|agua|refresco|hit|postobon)\b/.test(hay);
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
    ]);
    extractProductModificationNote(text) {
        const raw = fixCommonOrderTypos((text || '').trim());
        if (!raw)
            return null;
        if (this.looksLikeClearlyMultiDishOrder(raw))
            return null;
        const q = normalizeText(raw);
        if (!/\b(sin|con|mas|más|en\s+vez\s+de|envez\s+de|pero\s+sin|pero\s+con|no\s+quiero|no\s+me\s+(?:pongan?|pongas)|quiero\s+(?:mas|más))\b/.test(q)) {
            return null;
        }
        const chunks = [];
        const source = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const patterns = [
            /\b((?:sin|con|mas|más|pero\s+sin|pero\s+con|en\s+vez\s+de)\s+(?:de\s+)?[a-záéíóúñ]+(?:\s+[a-záéíóúñ]+){0,2})/gi,
            /\b((?:no\s+quiero|no\s+me\s+(?:pongan?|pongas)|sin)\s+(?:de\s+)?(?:la\s+|el\s+|las\s+|los\s+|una\s+|un\s+)?[a-záéíóúñ]+(?:\s+[a-záéíóúñ]+){0,2})/gi,
            /\b((?:quiero\s+)?(?:mas|más)\s+(?:de\s+)?[a-záéíóúñ]+(?:\s+[a-záéíóúñ]+){0,1})/gi,
        ];
        for (const re of patterns) {
            let m;
            re.lastIndex = 0;
            while ((m = re.exec(source)) !== null) {
                const phrase = m[1].replace(/\s+/g, ' ').trim();
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
        const withoutMods = q
            .replace(/\b(?:sin|con|mas|más|pero\s+sin|pero\s+con|en\s+vez\s+de|no\s+quiero|no\s+me\s+(?:pongan?|pongas)|quiero\s+(?:mas|más))\s+(?:de\s+)?(?:la\s+|el\s+|las\s+|los\s+|una\s+|un\s+)?[a-z]+(?:\s+[a-z]+){0,2}/g, ' ')
            .replace(/\b(quiero|dame|ponme|agrega|un|una|unos|unas|el|la|los|las|por|favor|para|del|en|sobre)\b/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        const mainTokens = withoutMods
            .split(' ')
            .filter((t) => t.length >= 3)
            .filter((t) => !this.SIDE_NOTE_TOKENS.has(t) && !this.SIDE_NOTE_TOKENS.has(singularizeEsToken(t)));
        if (!mainTokens.length)
            return chunks.join(', ').slice(0, 180);
        if (mainTokens.length === 1 && /^(combo|combos|plato|pedido)$/.test(mainTokens[0])) {
            return chunks.join(', ').slice(0, 180);
        }
        if (mainTokens.length >= 1 && mainTokens.length <= 4) {
            return chunks.join(', ').slice(0, 180);
        }
        return chunks.join(', ').slice(0, 180);
    }
    looksLikeSideModificationNote(text) {
        const raw = fixCommonOrderTypos((text || '').trim());
        if (!raw || raw.length < 6)
            return false;
        const q = normalizeText(raw);
        const sideAlt = [...this.SIDE_NOTE_TOKENS].join('|');
        const hasNegSide = new RegExp(`\\b(?:no\\s+quiero|no\\s+me\\s+(?:pongan?|pongas)|sin)\\s+(?:de\\s+)?(?:la\\s+|el\\s+|las\\s+|los\\s+|una\\s+|un\\s+)?(?:${sideAlt})\\b`).test(q);
        const hasMoreSide = new RegExp(`\\b(?:quiero\\s+)?(?:mas|más)\\s+(?:de\\s+)?(?:${sideAlt})\\b`).test(q);
        const hasSinConSide = new RegExp(`\\b(?:sin|con|mas|más)\\s+(?:de\\s+)?(?:${sideAlt})\\b`).test(q);
        const refsCombo = /\b(?:para|del|en|sobre|el|la)\s+(?:el\s+|la\s+)?combo\b/.test(q) || /\bcombo\b/.test(q);
        if (!hasNegSide && !hasMoreSide && !hasSinConSide)
            return false;
        const mainDish = /\b(pollos?|churrascos?|mojarras?|hamburguesas?|bandejas?|sopas?|alitas?|pechugas?|costillas?|broaster|ejecutivo|sancocho|ajiaco)\b/.test(q);
        if (mainDish && !refsCombo)
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
        const raw = fixCommonOrderTypos((text || '').trim());
        if (!raw)
            return false;
        if (this.countQuantityMentions(raw) >= 2)
            return true;
        const withoutCourtesy = raw
            .replace(/[,;]?\s*(por\s+favor|porfa|pf|gracias|porfis)[\s!.?]*$/i, '')
            .trim();
        if (!/\s*,\s*|\s+\by\b\s+/i.test(withoutCourtesy))
            return false;
        let q = normalizeText(withoutCourtesy);
        q = q
            .replace(/\bpollos?\s+(?:fritos?|asados?|broaster|apana(?:do|da)s?)\b/g, 'pollo')
            .replace(/\bmojarras?\s+(?:fritas?|asadas?|plancha)\b/g, 'mojarra')
            .replace(/\bpechugas?\s+(?:fritas?|asadas?|plancha|broaster)\b/g, 'pechuga');
        const dishRe = /\b(churrascos?|mojarras?|platanos?|pollos?|sopas?|bandejas?|costillas?|arepas?|pechugas?|mondongo|sobrebarriga|alitas?|ejecutivos?|sancocho|ajiaco|broaster|limonadas?|hamburguesas?|gaseosas?)\b/g;
        const hits = new Set();
        for (const m of q.matchAll(dishRe)) {
            hits.add(singularizeEsToken(m[1]));
        }
        return hits.size >= 2;
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
            const nameHasMenuWrapper = [...MENU_WRAPPER_TOKENS].some((t) => this.queryHasToken(name, t));
            const queryHasMenuWrapper = [...MENU_WRAPPER_TOKENS].some((t) => this.queryHasToken(q, t));
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
            const styleHits = styleInQuery.filter((st) => pname.includes(st)).length;
            if (styleHits > 0)
                h.priority += 40 * styleHits;
            else if (styleInQuery.length && [...COOKING_STYLE_TOKENS].some((st) => pname.includes(st))) {
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
            const nameHasMenuWrapper = [...MENU_WRAPPER_TOKENS].some((t) => this.queryHasToken(pname, t));
            const queryHasMenuWrapper = [...MENU_WRAPPER_TOKENS].some((t) => this.queryHasToken(q, t));
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
        m = q.match(/\b(\d{2,4})\s*(?:ml|cc)\b/);
        if (m) {
            const ml = Number(m[1]);
            if (ml >= 200 && ml <= 5000)
                return ml;
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
        m = raw.toLowerCase().match(/\b(\d+)\s*[.,]\s*(\d+)\s*l\b/);
        if (m) {
            const v = Number(m[1]) + Number(m[2]) / Math.pow(10, m[2].length);
            if (v > 0 && v <= 5)
                return Math.round(v * 1000);
        }
        m = n.match(/\b(\d)\s+(\d)\s*l\b/);
        if (m) {
            return Math.round((Number(m[1]) + Number(m[2]) / 10) * 1000);
        }
        m = n.match(/\b(\d)\s*l\b/);
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
        const want = this.extractRequestedDrinkVolumeMl(queryText);
        if (want != null) {
            const ranked = drinks
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
        return [...drinks].sort((a, b) => this.drinkPreferenceRank(a) - this.drinkPreferenceRank(b))[0];
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
        if (!/\s+\by\b\s+|\s*,\s*|\s+(?:mas|más|\+)\s+/i.test(withoutCourtesy))
            return false;
        const q = normalizeText(text);
        if (!new RegExp(FOOD_ORDER_TOKEN, 'i').test(q) &&
            !new RegExp(DRINK_ORDER_TOKEN, 'i').test(q) &&
            !/\b(mojarra|bandeja|mondongo|arepa|chorizo|pechuga|costilla|ajiaco|sancocho|churrasco)\b/.test(q)) {
            return false;
        }
        return this.splitMultiProductSegments(text).length >= 2;
    }
    findProductEmbeddedInMessage(text, products) {
        const sizedSoup = this.resolveSizedSoupProduct(text, products);
        if (sizedSoup)
            return sizedSoup;
        const embedded = this.findAllProductsEmbeddedInMessage(text, products);
        if (!embedded.length)
            return null;
        if (embedded.length === 1)
            return embedded[0];
        const q = normalizeText(text);
        const ranked = embedded
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
            return { p, score };
        })
            .sort((a, b) => b.score - a.score);
        if (ranked.length >= 2 && ranked[0].score === ranked[1].score && ranked[0].score === 0) {
            return null;
        }
        return ranked[0]?.p ?? null;
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
        return t.length >= 6 && /\d/.test(t);
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
        if (this.findProductEmbeddedInMessage(query, products))
            return null;
        if (/\b(link|enlace|url)\b/.test(q) ||
            /\b(pasa|dame|envia|manda|comparte)\b.*\b(menu|carta)\b/.test(q) ||
            /^(ver\s+)?(el\s+)?(menu|carta)(\s+completo)?$/.test(q)) {
            return null;
        }
        if (/\b(hacer|realizar)\s+(un\s+)?(pedido|orden)\b/.test(q) ||
            /\b(quiero|gustaria|quisiera)\s+(pedir|ordenar|hacer)\b/.test(q) ||
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
            const c = normalizeText(cat);
            const cs = stemLoose(cat);
            let score = 0;
            if (q === c || q === cs) {
                score = 100;
            }
            else if (isShortCategoryQuery && (q.includes(c) || c.includes(q) || q.includes(cs))) {
                score = 85;
            }
            else if (isBrowseIntent) {
                if (q.includes(c) || q.includes(cs) || c.includes(q))
                    score = 80;
                else {
                    for (const t of significantTokens) {
                        const ts = stemLoose(t);
                        if (c === t || cs === ts || (t.length >= 4 && (c.includes(t) || t.includes(c)))) {
                            score = Math.max(score, 70);
                        }
                    }
                }
            }
            const SKIP = new Set([
                'por',
                'que',
                'un',
                'una',
                'el',
                'la',
                'los',
                'las',
                'de',
                'del',
                'y',
                'o',
                'ahora',
                'tambien',
                'pregunto',
                'interesa',
                'ver',
                'dame',
                'favor',
                'gracias',
                'quiero',
                'necesito',
            ]);
            if (significantTokens.length <= 4) {
                for (const t of significantTokens) {
                    if (SKIP.has(t))
                        continue;
                    const ts = stemLoose(t);
                    if (c === t || cs === ts || (t.length >= 4 && (c.includes(t) || t.includes(c)))) {
                        score = Math.max(score, 72);
                    }
                }
            }
            if (score >= 70 && isBrowseIntent)
                score += 10;
            if (score >= 70 && (!best || score > best.score)) {
                best = { categoryName: cat, score };
            }
        }
        if (!best)
            return null;
        const list = available.filter((p) => p.categoryName === best.categoryName);
        if (!list.length)
            return null;
        return this.refineCategoryListByQuery(q, best.categoryName, list);
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
            return { categoryName, products: list };
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
        if (/^(quiero|dame|ponme|agrega)[.!?,;:]*/i.test(trimmed) &&
            new RegExp(FOOD_ORDER_TOKEN, 'i').test(trimmed)) {
            return null;
        }
        const extracted = this.extractProductSearchQuery(trimmed);
        const queries = extracted !== trimmed ? [extracted, trimmed] : [extracted];
        const orderNoise = new Set([
            'quiero', 'dame', 'ponme', 'pedir', 'ordenar', 'agrega', 'agregame', 'necesito',
            'gustaria', 'quisiera', 'una', 'uno', 'unos', 'unas', 'por', 'favor',
        ]);
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
        for (const q of queries) {
            const byCat = this.findByCategory(q, products);
            if (byCat)
                return byCat;
        }
        for (const q of queries) {
            const byConcept = (0, whatsapp_menu_concepts_1.findByMenuConcept)(q, products, menuConceptGroups);
            if (byConcept) {
                return { categoryName: byConcept.categoryName, products: byConcept.products };
            }
        }
        return null;
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
                        score += 8;
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
                    if (name.includes(st) ||
                        nameTokens.some((nt) => singularizeEsToken(nt) === singularizeEsToken(st))) {
                        score += 45;
                        styleOnProduct += 1;
                    }
                }
                if (styleOnProduct === 0)
                    score -= 15;
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
            const nameHasMenuWrapper = [...MENU_WRAPPER_TOKENS].some((t) => this.queryHasToken(name, t));
            const queryHasMenuWrapper = [...MENU_WRAPPER_TOKENS].some((t) => this.queryHasToken(q, t));
            if (nameHasMenuWrapper && !queryHasMenuWrapper) {
                return { p, score: 0 };
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
            return { p, score };
        })
            .filter((x) => x.score >= 18)
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
        const hasPriceAsk = /\b(cuanto vale|cuanto cuesta|cuanto sale|cuanto esta|cuanto cobran|cuanto seria|cuanto costaria|a cuanto|que precio|precio de|precio del|precio tiene|precio por|valor de|me costaria|cuanto me sale)\b/.test(q) ||
            (/\b(cuanto|precio|valor|cuesta)\b/.test(q) && /\?/.test(raw));
        if (!hasPriceAsk)
            return false;
        const orderDominant = /^(quiero|dame|ponme|agrega|agregame|me das|me regalas|voy a pedir)\s+(un|una|unos|unas|el|la|los|las)\s+/i.test(raw) && !/\b(cuanto|precio|vale|cuesta|valor)\b/i.test(raw);
        return !orderDominant;
    }
    stripPriceInquiryNoise(text) {
        return text
            .replace(/\b(cu[aá]nto vale|cu[aá]nto cuesta|cu[aá]nto sale|cu[aá]nto est[aá]|cu[aá]nto cobran|cu[aá]nto ser[ií]a|cu[aá]nto costar[ií]a|a cu[aá]nto|qu[eé] precio|precio de(l| la| los| las)?|precio tiene|precio por|valor de(l| la| los| las)?|cu[aá]nto me sale|me costar[ií]a)\b/gi, ' ')
            .replace(/\b(cu[aá]nto|precio|valor|cuesta|cobran)\b/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    formatProductPriceReply(product) {
        let msg = this.formatProductHeader(product.name, product.price, product.code);
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
        msg += '\n\n_¿Te lo agrego al pedido?_';
        return msg;
    }
    formatProductVariantsOverview(product, mode = 'info', alreadySelected = []) {
        const remaining = this.getRemainingAttributes(product, alreadySelected);
        const next = remaining[0];
        if (mode === 'info') {
            const infoAttrs = remaining.filter((a) => !this.isComboOnlyAttribute(a));
            if (!infoAttrs.length && (product.attributes || []).some((a) => this.isComboOnlyAttribute(a))) {
                return (`${this.formatProductHeader(product.name, product.price, product.code)}\n\n` +
                    `_Si pides *combo*, después eliges las gaseosas._\n\n` +
                    `_Dime cuál porción te interesa o si quieres pedir._`);
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
            const code = r.code != null ? `  ·  Cód. ${this.formatProductCode(r.code)}` : '';
            return `${this.optionNumberEmoji(r.index)} *${r.label}*\n   💰 ${this.formatMoney(r.price)}${code}`;
        })
            .join('\n\n');
    }
    formatOptionsTable(rows) {
        return this.formatOptionsList(rows);
    }
    isVariantPreferenceIntent(text) {
        const q = normalizeText(text);
        if (!q || q.length < 4)
            return false;
        if (/\b(en\s+combo|en\s+solo|sin\s+combo|con\s+combo|que\s+sea\s+combo|que\s+sea\s+solo|mejor\s+en\s+combo|mejor\s+en\s+solo|mejor\s+combo|mejor\s+solo|cambiar\s+a\s+combo|cambialo\s+a\s+combo|cambiar\s+a\s+solo)\b/.test(q)) {
            return true;
        }
        if (/\b(dame(lo|melo)|demelo|pon(lo|me)|ponme|agrega(me)?|quiero)\s+(en\s+)?(combo|solo)\b/.test(q)) {
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
            parts.push(`🍽️ *${product.name}*`);
            parts.push(`Cód. ${this.formatProductCode(product.code)}`);
        }
        if (alreadySelected.length) {
            parts.push(`✅ Ya llevas: _${alreadySelected.map((s) => s.attributeValue).join(' · ')}_`);
        }
        if (totalSteps > 1 && opts?.mode !== 'info') {
            parts.push(`*Paso ${stepNum} de ${totalSteps}*`);
        }
        const question = this.isComboOnlyAttribute(attr)
            ? `¿Qué *${attr.attributeName}* quieres?`
            : `Elige *${attr.attributeName}*:`;
        parts.push(question);
        parts.push(this.formatOptionsList(rows));
        if (opts?.mode === 'info') {
            parts.push('_Dime el número o solo / combo._');
        }
        else {
            parts.push('_Número o nombre (ej. 2)._');
        }
        return parts.filter(Boolean).join('\n\n');
    }
    getProductNameBase(name) {
        return normalizeText(name)
            .replace(/\b(solo|sola|completo|completa|combo|con\s+gaseosa|con\s+bebida|sin\s+gaseosa|sin\s+bebida|mas\s+gaseosa|y\s+gaseosa)\b/g, ' ')
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
        const scored = this.searchByNameScored(q, available, 12).filter((x) => x.score >= 38);
        const seed = [
            ...hints,
            ...scored.map((x) => x.p),
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
        const styleSiblings = bestStyleBase
            ? available.filter((p) => this.stripCookingStyleTokens(p.name) === bestStyleBase)
            : [];
        const hasCookingStyleVariants = styleSiblings.length >= 2 &&
            styleSiblings.some((p) => normalizeText(p.name) !== this.stripCookingStyleTokens(p.name));
        if (hasCookingStyleVariants && bestStyleCount >= 1) {
            const qHitsStyleBase = this.queryHasToken(q, bestStyleBase) ||
                q.includes(bestStyleBase) ||
                bestStyleBase.includes(q.split(/\s+/).filter((t) => !COOKING_STYLE_TOKENS.has(t))[0] || '');
            if (qHitsStyleBase || bestStyleCount >= 2) {
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
        const variants = available.filter((p) => {
            if (useCookingStyleFamily) {
                return this.stripCookingStyleTokens(p.name) === bestBase;
            }
            const base = this.getProductNameBase(p.name);
            const name = normalizeText(p.name);
            return base === bestBase || (name.includes(bestBase) && base.length >= 4);
        });
        if (variants.length < 2)
            return null;
        const hasVariantCue = variants.some((p) => /\b(solo|sola|combo|completo|completa|gaseosa|bebida)\b/i.test(p.name));
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
            return (family.variants.find((p) => /\b(combo|completo|completa|gaseosa|bebida)\b/.test(normalizeText(p.name))) || null);
        }
        return null;
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
        return attrs.filter((attr) => {
            if (alreadySelected.some((s) => s.attributeName === attr.attributeName))
                return false;
            if (this.isDeferredDrinkAttribute(attr, product) && !showComboOnly)
                return false;
            return true;
        });
    }
    isAttributeSelectionComplete(product, alreadySelected = [], opts) {
        if (!product.hasAttributes || !product.attributes?.length)
            return true;
        return this.getRemainingAttributes(product, alreadySelected, opts).length === 0;
    }
    coerceAttributeStep(product, step, opts) {
        if (step.status === 'invalid')
            return step;
        if (this.isAttributeSelectionComplete(product, step.attributes, opts)) {
            return { status: 'complete', attributes: step.attributes };
        }
        return { status: 'partial', attributes: step.attributes };
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
    formatDescriptionForAttributeStep(description, alreadySelected, nextAttr) {
        if (!description?.trim())
            return null;
        const showComboNotes = this.hasComboPortionSelected(alreadySelected) ||
            (nextAttr != null && this.isComboOnlyAttribute(nextAttr));
        if (showComboNotes)
            return description.trim();
        const filtered = description
            .split(/(?<=[.!?])\s+/)
            .filter((sentence) => {
            const n = normalizeText(sentence);
            return !/\b(combo|gaseosa|gaseosas|bebida|bebidas|refresco|refrescos)\b/.test(n);
        })
            .join(' ')
            .trim();
        return filtered || null;
    }
    isProductDescriptionInquiry(text) {
        const raw = text.trim();
        if (!raw || raw.length < 5)
            return false;
        if (/^(quiero|dame|ponme|agrega|agregame|me regalas|me das|voy a pedir)\s/i.test(raw)) {
            return false;
        }
        if (this.isPriceInquiryIntent(text))
            return false;
        const q = normalizeText(raw);
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
            /\bque incluye\b/,
            /\bque contiene\b/,
            /\bque ingredientes\b/,
            /\bque tiene el\b/,
            /\bque tiene la\b/,
            /\b(incluye|trae|viene|va)\s+con\b/,
            /\b(tiene|lleva|trae|viene|va)\s+(cebolla|aji|ají|huevo|huevos|queso|lechuga|tomate|gluten|lacteos|lacteos|arepa|papas|yuca|arroz|sopa|bebida|gaseosa)\b/,
            /\b(composicion|preparacion|descripcion|descrpcion)\b/,
            /\bcomo es el\b/,
            /\bcomo es la\b/,
            /\bcomo viene\b/,
            /\bcomo va\b/,
        ];
        if (patterns.some((p) => p.test(q)))
            return true;
        return (/\?/.test(raw) &&
            /\b(lleva|llava|trae|viene|va|incluye|contiene|ingredientes|descripcion|composicion)\b/.test(q));
    }
    isGenericProductInquiry(text) {
        if (this.isPriceInquiryIntent(text))
            return true;
        if (this.isProductDescriptionInquiry(text))
            return true;
        const raw = text.trim();
        const q = normalizeText(raw);
        return (/\?$/.test(raw) &&
            /\b(cuanto|precio|valor|cuesta|cobran|sale|tienen|hay|opciones|que hay|informacion|info)\b/.test(q));
    }
    isShortGenericFoodQuery(query) {
        const q = normalizeText(this.extractProductSearchQuery(query));
        const tokens = q.split(' ').filter((t) => t.length >= 3);
        return tokens.length === 1;
    }
    extractExplicitAttributeChoice(text, product, opts) {
        const step = this.coerceAttributeStep(product, this.resolveAttributesFromMessage(product, text, [], opts), opts);
        if (step.status === 'complete')
            return step.attributes;
        return null;
    }
    shouldShowVariantsOverview(text, product) {
        if (!product.hasAttributes || !product.attributes?.length)
            return false;
        if (this.extractExplicitAttributeChoice(text, product))
            return false;
        if (this.isGenericProductInquiry(text))
            return true;
        const q = normalizeText(this.stripPriceInquiryNoise(this.extractProductSearchQuery(text)));
        for (const attr of product.attributes) {
            for (const opt of attr.options) {
                const o = normalizeText(opt);
                if (o.length >= 4 && q.includes(o))
                    return false;
            }
        }
        return true;
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
        if (this.looksLikeFoodPlusDrinkOrder(text)) {
            if (this.countQuantityMentions(text) < 2) {
                const foodDrink = this.splitFoodPlusDrinkSegments(text);
                if (foodDrink.length >= 2) {
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
        q = q.replace(/\bsin\s+[^\s,]+(?:\s+[^\s,]+)?\s+(?:mas|más)\s+[^\s,]+(?:\s+[^\s,]+)?/gi, (m) => m.replace(/\s+(?:mas|más)\s+/i, ' con '));
        q = q.replace(/\bcon\s+[^\s,]+(?:\s+[^\s,]+)?(?:\s+y\s+[^\s,]+)+/gi, (m) => m.replace(/\s+y\s+/gi, ' __Y__ '));
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
            const cleaned = this.cleanOrderSegment(seg.replace(/\s+(por favor|porfa|pf|gracias)[\s!.?]*$/i, '').trim());
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
    splitSegmentOnArticles(chunk) {
        const fixed = fixCommonOrderTypos(chunk);
        const parts = fixed
            .split(/\s+(?=(?:un|una|unos|unas|el|la|los|las)\s+)/i)
            .map((s) => s.trim())
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
    resolveMultiProductOrder(text, products) {
        if (this.isOffTopicChitchat(text))
            return null;
        if (this.isPriceInquiryIntent(text))
            return null;
        if (this.isMenuExploreIntent(text, products))
            return null;
        if (this.isProductDescriptionInquiry(text))
            return null;
        let segments = this.splitMultiProductSegments(text);
        let embeddedAll = this.findAllProductsEmbeddedInMessage(text, products);
        const sizedChicken = this.resolveSizedChickenProduct(text, products);
        if (sizedChicken) {
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
        const sizedSoup = this.resolveSizedSoupProduct(text, products);
        if (sizedSoup) {
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
                    if (qn.includes(name) || name.length >= 5 && qn.includes(singularizeEsToken(name))) {
                        return true;
                    }
                    const toks = name
                        .split(' ')
                        .filter((t) => this.isDistinctiveProductToken(t));
                    return toks.some((t) => this.queryHasToken(qn, t));
                });
            }
        }
        if (embeddedAll.length >= 2 && !this.looksLikeClearlyMultiDishOrder(text)) {
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
                const attrText = `${segment} ${text}`;
                const match = { segment, product, score: 100 };
                if (product.hasAttributes && product.attributes?.length) {
                    const explicit = this.extractExplicitAttributeChoice(attrText, product);
                    if (explicit)
                        confident.push({ ...match, segment: attrText });
                    else
                        needsAttributes.push(match);
                }
                else {
                    confident.push(match);
                }
            }
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
            if (segments.length < 2 && embeddedAll.length < 2)
                return null;
        }
        const confident = [];
        const ambiguous = [];
        const unresolved = [];
        const needsAttributes = [];
        const usedProductIds = new Set();
        for (const rawSegment of segments) {
            const segment = this.cleanOrderSegment(rawSegment);
            const embedded = this.findProductEmbeddedInMessage(segment, products);
            if (embedded) {
                const skipGenericMedio = /^medio\s+pollo$/.test(normalizeText(embedded.name)) &&
                    /\bbroaster\b/.test(normalizeText(`${segment} ${text}`));
                if (!skipGenericMedio) {
                    if (usedProductIds.has(embedded.id))
                        continue;
                    usedProductIds.add(embedded.id);
                    const match = { segment, product: embedded, score: 100 };
                    if (embedded.hasAttributes && embedded.attributes?.length) {
                        const attrText = `${segment} ${text}`;
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
                unresolved.push(segment);
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
            if (/\bejecutivo\b/.test(segNorm)) {
                const ejecutivoHits = uniqueScored.filter((x) => normalizeText(x.p.name).includes('ejecutivo'));
                if (ejecutivoHits.length >= 1) {
                    const withPollo = ejecutivoHits.find((x) => /\bpollo\b/.test(normalizeText(x.p.name)));
                    const top = withPollo || ejecutivoHits[0];
                    if (!usedProductIds.has(top.p.id)) {
                        usedProductIds.add(top.p.id);
                        const match = { segment, product: top.p, score: top.score };
                        if (top.p.hasAttributes && top.p.attributes?.length) {
                            const attrText = `${segment} ${text}`;
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
                }
            }
            if (this.isStrongProductMatch(uniqueScored)) {
                const top = uniqueScored[0];
                if (usedProductIds.has(top.p.id))
                    continue;
                const family = this.findProductVariantFamily(segment, products, uniqueScored.map((x) => x.p));
                if (family &&
                    family.variants.length >= 2 &&
                    !this.pickVariantFromFamilyText(segment, family)) {
                    const bare = family.variants.find((p) => normalizeText(p.name) === family.baseKey) || null;
                    if (bare && !usedProductIds.has(bare.id)) {
                        usedProductIds.add(bare.id);
                        const match = { segment, product: bare, score: top.score };
                        if (bare.hasAttributes && bare.attributes?.length) {
                            const attrText = `${segment} ${text}`;
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
                            candidates: family.variants.slice(0, 4),
                        });
                    }
                    continue;
                }
                usedProductIds.add(top.p.id);
                const match = { segment, product: top.p, score: top.score };
                if (top.p.hasAttributes && top.p.attributes?.length) {
                    const attrText = `${segment} ${text}`;
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
                ambiguous.push({ segment, candidates: uniqueScored.slice(0, 4).map((x) => x.p) });
            }
            else if (uniqueScored.length === 1 && uniqueScored[0].score >= 40) {
                const top = uniqueScored[0];
                if (usedProductIds.has(top.p.id))
                    continue;
                usedProductIds.add(top.p.id);
                const match = { segment, product: top.p, score: top.score };
                if (top.p.hasAttributes && top.p.attributes?.length) {
                    const attrText = `${segment} ${text}`;
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
                if (!usedProductIds.has(top.p.id) && !this.isLikelyDrinkProduct(top.p)) {
                    usedProductIds.add(top.p.id);
                    const match = { segment, product: top.p, score: top.score };
                    if (top.p.hasAttributes && top.p.attributes?.length) {
                        needsAttributes.push(match);
                    }
                    else
                        confident.push(match);
                }
                else {
                    unresolved.push(segment);
                }
            }
            else {
                unresolved.push(segment);
            }
        }
        const resolvedCount = confident.length + ambiguous.length + needsAttributes.length;
        if (segments.length >= 2 && (resolvedCount >= 1 || unresolved.length > 0)) {
            return { segments, confident, ambiguous, unresolved, needsAttributes };
        }
        if (resolvedCount < 2)
            return null;
        return { segments, confident, ambiguous, unresolved, needsAttributes };
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
        return '_Responde con el *número* o el *código* (#)._';
    }
    formatProductListItem(product, index) {
        const prefix = index != null ? `${this.optionNumberEmoji(index)} ` : '• ';
        const lines = [
            `${prefix}*${product.name}*`,
            `   ${this.formatProductMeta(product.price, product.code)}`,
        ];
        if (product.description) {
            lines.push(`   ${this.formatProductSubtitle(product.description)}`);
        }
        if (product.hasAttributes) {
            lines.push(`   ↳ Elige opciones al pedir`);
        }
        return lines.join('\n');
    }
    formatCategoryList(categoryName, list) {
        const body = list.map((p, i) => this.formatProductListItem(p, i + 1)).join('\n\n');
        return (`📋 *${categoryName}*\n` +
            `_${list.length} ${list.length === 1 ? 'opción' : 'opciones'} en el menú_\n\n` +
            `${body}\n\n` +
            this.formatListChoiceHint());
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
                const picked = this.pickAttributeOptionFromText(text, attr);
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
    pickAttributeOptionFromText(text, attr) {
        const q = normalizeText(text);
        if (!q)
            return null;
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
            if (o.length >= 3 && (q === o || q.includes(o)))
                return opt;
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
        for (const hint of portionHints) {
            if (!hint.re.test(q))
                continue;
            const hit = attr.options.find((o) => normalizeText(o).includes(hint.needle));
            if (hit)
                return hit;
        }
        for (const opt of attr.options) {
            const o = normalizeText(opt);
            for (const token of o.split(' ').filter((t) => t.length >= 3)) {
                if (['pollo', 'frito', 'broaster', 'pechuga', 'gaseosa', 'combo'].includes(token)) {
                    continue;
                }
                const re = new RegExp(`(?:^|\\s)${escapeRegExp(token)}(?:\\s|$)`);
                if (re.test(q))
                    return opt;
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