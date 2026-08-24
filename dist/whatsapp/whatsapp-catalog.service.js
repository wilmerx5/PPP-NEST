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
    return (text || '')
        .replace(/\bquieor\b/gi, 'quiero')
        .replace(/\bquiiero\b/gi, 'quiero')
        .replace(/\bqiero\b/gi, 'quiero')
        .replace(/\bkiero\b/gi, 'quiero')
        .replace(/\bquero\b/gi, 'quiero')
        .replace(/\bejeuctivo\b/gi, 'ejecutivo')
        .replace(/\bejecutvo\b/gi, 'ejecutivo')
        .replace(/\bejecutivo\b/gi, 'ejecutivo')
        .replace(/\bpollo\s+frito\b/gi, 'pollo frito')
        .replace(/\b(?:roaster|broster|brouster|broaster)\b/gi, 'broaster')
        .replace(/\bpollo\s+a\s+la\s+broaster\b/gi, 'pollo broaster')
        .replace(/\bpollo\s+ala\s+broaster\b/gi, 'pollo broaster')
        .replace(/\ba\s+la\s+broaster\b/gi, 'broaster')
        .replace(/\sala\s+broaster\b/gi, 'broaster')
        .replace(/\bun\s+medio\s+(?:de\s+)?pollo\b/gi, 'medio pollo')
        .replace(/\bmedio\s+de\s+pollo\b/gi, 'medio pollo')
        .replace(/\s+/g, ' ')
        .trim();
}
const DRINK_ORDER_TOKEN = '(?:gaseosa|gaseosas|coca\\s*cola?|cola|sprite|pepsi|jugo|jugos|limonada|malta|cerveza|agua|hit|postobon|postob[oó]n|mr\\s*tea|cysco)';
const FOOD_ORDER_TOKEN = '(?:medio|cuarto|entero|pollo|broaster|frito|asado|pechuga|alas?|ejecutivo|bandeja|costilla|churrasco|sobrebarriga|mondongo|sopa|arroz|paisa|chino)';
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
    if (q === c || c.includes(q) || q.includes(c))
        return true;
    if (q.length < 4 || c.length < 4)
        return false;
    const maxDist = q.length <= 5 ? 1 : 2;
    return tokenEditDistance(q, c) <= maxDist;
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
    isMenuExploreIntent(text, products = []) {
        const q = normalizeText(text);
        if (!q || q.length < 5)
            return false;
        if (/\b(link|enlace|url)\b/.test(q) ||
            /\b(pasa|dame|envia|manda|comparte)\b.*\b(menu|carta)\b/.test(q) ||
            /^(ver\s+)?(el\s+)?(menu|carta)(\s+completo)?$/.test(q)) {
            return false;
        }
        if (this.extractCodeFromMessage(text) != null)
            return false;
        if (products.length && this.findProductEmbeddedInMessage(text, products))
            return false;
        if (products.length && this.findByCategory(text, products))
            return false;
        const explorePatterns = [
            /\b(que|qué)\s+(hay|tienen|tiene|ofrecen|sirven|ponen|venden)\b/,
            /\b(que|qué)\s+(me\s+)?(recomiend|sugier|aconsej)/,
            /\b(que|qué)\s+(de|para)\s+(almuerzo|comer|comida|cena|desayuno|merienda|hoy|la\s+casa)\b/,
            /\b(que|qué)\s+(hay|tienen)\s+(de\s+)?(comida|comer|almuerzo|cena)\b/,
            /\b(que|qué)\s+(se\s+)?(puede|podemos|puedo)\s+(pedir|ordenar|comer)\b/,
            /\b(opciones|recomendaciones|sugerencias)\b/,
            /\b(carta|menu)\s+(de|del)\s+(hoy|dia|día)\b/,
            /\bque\s+me\s+antoj/,
            /\bno\s+se\s+que\s+(pedir|comer|ordenar)\b/,
            /\b(estoy|ando)\s+(indecis|buscando)\b/,
            /\b(muestrame|mostrame|ver)\s+(las\s+)?(opciones|categorias|categorías)\b/,
        ];
        if (!explorePatterns.some((re) => re.test(q)))
            return false;
        const hasExploreQuestion = /\b(que|qué|hay|tienen|recomiend|categor|opciones|antoj)\b/.test(q);
        if (/\b(quiero|dame|necesito)\b/.test(q) && !hasExploreQuestion)
            return false;
        return true;
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
                lines.push(`   • ${p.name} — $${Math.round(p.price).toLocaleString('es-CO')}`);
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
        if (/^[1-9]\d{0,2}$/.test(raw)) {
            const n = parseInt(raw, 10);
            if (n >= 1 && n <= categories.length)
                return categories[n - 1];
        }
        let best = null;
        for (const cat of categories) {
            const c = normalizeText(cat);
            const cs = stemLoose(cat);
            let score = 0;
            if (lower === c || lower === cs)
                score = 100;
            else if (lower.includes(c) || c.includes(lower))
                score = 85;
            else if (lower.includes(cs))
                score = 75;
            else {
                for (const token of lower.split(' ').filter((t) => t.length >= 3)) {
                    const ts = stemLoose(token);
                    if (c === token || cs === ts || c.includes(token) || token.includes(c)) {
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
            .replace(/^(quisiera|gustaria|deseo|necesito|dame|me das|me gustaria)\s+/i, '')
            .replace(/^(quieor|qiero|kiero|quiiero|quero|quiero|voy a pedir)\s+(un|una|unos|unas|el|la|los|las)?\s*/i, '')
            .replace(/\s+(por favor|porfa|pf|gracias)[\s!.?]*$/i, '')
            .trim();
        q = this.cleanOrderSegment(q);
        q = this.stripProductSearchNoise(q);
        return q || fixCommonOrderTypos(text.trim());
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
    ]);
    looksLikeFoodPlusDrinkOrder(text) {
        const q = normalizeText(text);
        if (!q || q.length < 8)
            return false;
        const hasFood = /\b(pollo|broaster|frito|asado|pechuga|alas?|ejecutivo|bandeja|costilla|churrasco|sobrebarriga|mondongo|sopa|arroz|paisa|chino)\b/.test(q);
        const hasDrink = /\b(gaseosa|gaseosas|coca|sprite|pepsi|jugo|jugos|limonada|malta|cerveza|agua|hit|postobon|postob[oó]n)\b/.test(q);
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
        if (/\b(combo|bandeja|ejecutivo|alitas|arroz chino|taco|hamburguesa)\b/.test(q)) {
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
        const candidates = available.filter((p) => {
            const n = normalizeText(p.name);
            if (/\b(combo|bandeja|ejecutivo|alitas|arroz|taco|hamburguesa|milensa|pechuga)\b/.test(n)) {
                return false;
            }
            if (style === 'broaster' && !/\bbroaster\b/.test(n))
                return false;
            if (style === 'frito' && !/\bfrito\b/.test(n))
                return false;
            if (!style && !/\bpollo\b/.test(n))
                return false;
            return this.detectProductPortionSize(n) === portion;
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
                    ? `1 pollo ${style}`
                    : '1 pollo';
        const exact = available.find((p) => normalizeText(p.name) === want);
        return exact || null;
    }
    isLikelyDrinkProduct(product) {
        const hay = normalizeText(`${product.name} ${product.categoryName || ''} ${product.description || ''}`);
        return /\b(gaseosa|bebida|jugo|limonada|malta|coca|sprite|pepsi|cerveza|agua|refresco|hit|postobon)\b/.test(hay);
    }
    findAllProductsEmbeddedInMessage(text, products) {
        const raw = fixCommonOrderTypos(text);
        const q = normalizeText(raw);
        if (!q || q.length < 4)
            return [];
        const available = products.filter((p) => p.availableNow !== false);
        const foodDrink = this.looksLikeFoodPlusDrinkOrder(raw);
        const hits = [];
        for (const p of available) {
            const name = normalizeText(p.name);
            if (name.length < 4)
                continue;
            let idx = 0;
            let foundFull = false;
            while ((idx = q.indexOf(name, idx)) !== -1) {
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
                .filter((t) => t.length >= 5 && !this.WEAK_PRODUCT_TOKENS.has(t));
            for (const tok of tokens) {
                const re = new RegExp(`(?:^|\\s)${escapeRegExp(tok)}(?:\\s|$)`);
                let m = re.exec(q);
                let start = m?.index ?? null;
                if (start == null) {
                    const qWords = q.split(/\s+/).filter((w) => w.length >= 4);
                    for (const w of qWords) {
                        if (fuzzyTokenMatch(w, tok)) {
                            start = q.indexOf(w);
                            break;
                        }
                    }
                }
                if (start == null)
                    continue;
                hits.push({
                    p,
                    start,
                    end: start + tok.length,
                    nameLen: tok.length,
                    priority: tok.length + 30,
                });
                break;
            }
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
        hits.sort((a, b) => b.priority - a.priority || b.nameLen - a.nameLen || a.start - b.start);
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
                    .sort((a, b) => this.drinkPreferenceRank(a.p) - this.drinkPreferenceRank(b.p));
                if (drinkHits[0]) {
                    result.push(drinkHits[0].p);
                }
                else {
                    const companion = this.findFoodDrinkCompanionProduct(raw, result[0], available);
                    if (companion && this.isLikelyDrinkProduct(companion)) {
                        result.push(companion);
                    }
                }
            }
            else if (hasDrink) {
                const drinks = result.filter((p) => this.isLikelyDrinkProduct(p));
                if (drinks.length >= 1 && /gaseosa/.test(q) && !/\d/.test(q)) {
                    const best = available
                        .filter((p) => this.isLikelyDrinkProduct(p) && /\bgaseosa\b/.test(normalizeText(p.name)))
                        .sort((a, b) => this.drinkPreferenceRank(a) - this.drinkPreferenceRank(b))[0] ||
                        [...drinks].sort((a, b) => this.drinkPreferenceRank(a) - this.drinkPreferenceRank(b))[0];
                    if (best) {
                        result = [...result.filter((p) => !this.isLikelyDrinkProduct(p)), best];
                    }
                }
            }
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
    looksLikeMultiItemOrderMessage(text) {
        if (this.isPriceInquiryIntent(text))
            return false;
        if (this.looksLikeFoodPlusDrinkOrder(text))
            return true;
        if (!/\s+\by\b\s+|\s*,\s*|\s+(?:mas|más|\+)\s+/i.test(text))
            return false;
        return this.splitMultiProductSegments(text).length >= 2;
    }
    findProductEmbeddedInMessage(text, products) {
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
            return { p, score: (inSegment ? name.length + 50 : 0) + tokenHits * 20 };
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
        const pairRe = new RegExp(`^(.+?)\\s+(?:y|con|mas|más|\\+|,)\\s+(?:un|una|unos|unas|el|la|los|las)?\\s*(${DRINK_ORDER_TOKEN}(?:\\s+(?:de\\s+)?[\\w]+)*)`, 'i');
        let m = raw.match(pairRe);
        if (m?.[1] && m?.[2]) {
            const food = this.cleanOrderSegment(m[1]);
            const drink = this.cleanOrderSegment(m[2]);
            if (food.length >= 3 && drink.length >= 3)
                return [food, drink];
        }
        const articleDrinkRe = new RegExp(`^(.+?)\\s+(?:un|una|unos|unas)\\s+(${DRINK_ORDER_TOKEN}(?:\\s+(?:de\\s+)?[\\w]+)*)`, 'i');
        m = raw.match(articleDrinkRe);
        if (m?.[1] && m?.[2]) {
            const food = this.cleanOrderSegment(m[1]);
            const drink = this.cleanOrderSegment(m[2]);
            if (food.length >= 3 && drink.length >= 3 && new RegExp(FOOD_ORDER_TOKEN, 'i').test(food)) {
                return [food, drink];
            }
        }
        if (drinkTail.test(raw) && new RegExp(FOOD_ORDER_TOKEN, 'i').test(raw)) {
            const idx = raw.search(new RegExp(`\\b(?:y|con|mas|más)\\s+(?:un|una|el|la)?\\s*${DRINK_ORDER_TOKEN}`, 'i'));
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
        const scored = this.searchByNameScored(drinkMatch[0], products, 8).filter((x) => this.isLikelyDrinkProduct(x.p));
        if (!scored.length)
            return null;
        const preferred = [...scored].sort((a, b) => this.drinkPreferenceRank(a.p) - this.drinkPreferenceRank(b.p))[0];
        return preferred?.p ?? null;
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
        if (/\b(calle|carrera|cra|cll|av|avenida|barrio|conjunto|apto|apartamento|torre|#)\b/.test(t)) {
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
            return ((opts?.intro || `Encontré *${deduped[0].name}* (cód. ${deduped[0].code}).`) +
                `\n\n${this.formatProductListItem(deduped[0])}\n\n` +
                `¿Lo agrego? Responde *sí* o dime la porción/opción si aplica.`);
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
        const intro = opts?.intro || `Encontré *${deduped.length} opciones*:`;
        const body = deduped
            .map((p, i) => {
            const base = this.getProductNameBase(p.name);
            const label = base && normalizeText(p.name) !== base
                ? this.getVariantDisplayLabel(p.name, base)
                : p.name;
            const price = `$${Math.round(p.price).toLocaleString('es-CO')}`;
            let line = `${i + 1}. *${label}* (cód. ${p.code}) — ${price}`;
            if (label !== p.name)
                line += `\n   _${p.name}_`;
            if (p.hasAttributes)
                line += `\n   ↳ Elige opciones al pedirlo`;
            return line;
        })
            .join('\n\n');
        return `${intro}\n\n${body}\n\nRespóndeme con el *número* o el *código*.`;
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
        const q = normalizeText(query);
        if (!q || q.length < 2)
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
        ]);
        const available = products.filter((p) => p.availableNow !== false);
        const qStem = stemLoose(q);
        const tokens = q
            .split(' ')
            .map((t) => t.trim())
            .filter((t) => t.length > 2 && !STOP.has(t) && !ORDER_INTENT_ONLY.has(t));
        if (!tokens.length && (STOP.has(q) || q === 'menu' || q === 'carta'))
            return [];
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
                const hits = nameTokens.filter((t) => wordHas(q, t) || q.includes(t)).length;
                if (hits === nameTokens.length)
                    score += 85;
                else if (hits >= Math.ceil(nameTokens.length * 0.75))
                    score += 40;
            }
            else if (nameTokens.length === 1) {
                if (wordHas(q, nameTokens[0]))
                    score += 35;
            }
            if (q.length >= 4 && q.split(' ').length <= 4) {
                if (wordHas(name, q) || wordHas(name, qStem))
                    score += 50;
                if (q.includes(name) && name.length > 3)
                    score += 40;
            }
            if (tokens.length) {
                for (const t of tokens) {
                    const ts = stemLoose(t);
                    if (wordHas(name, t) || wordHas(name, ts))
                        score += 18;
                    else if (name.includes(t) && t.length >= 5)
                        score += 10;
                    else if (nameTokens.some((nt) => fuzzyTokenMatch(t, nt)))
                        score += 16;
                    if (wordHas(desc, t) || (desc.includes(t) && t.length >= 5))
                        score += 4;
                    if (wordHas(cat, t))
                        score += 6;
                }
            }
            if (score >= 50 && nameTokens.length >= 2) {
                score += Math.min(12, nameTokens.length * 3);
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
                !/\b(combo|bandeja|ejecutivo|alitas|arroz|taco|hamburguesa)\b/.test(q)) {
                if (/\b(combo|bandeja|ejecutivo|alitas|arroz|taco|hamburguesa)\b/.test(name)) {
                    score -= 60;
                }
            }
            return { p, score };
        })
            .filter((x) => x.score >= 18)
            .sort((a, b) => b.score - a.score || b.p.name.length - a.p.name.length)
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
        if (product.hasAttributes && product.attributes?.length) {
            return this.formatProductVariantsOverview(product, 'info');
        }
        const price = `$${Math.round(product.price).toLocaleString('es-CO')}`;
        let msg = `*${product.name}* (cód. ${product.code}) — *${price}*`;
        if (product.description) {
            msg += `\n\n_${product.description}_`;
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
                return (`*${product.name}* — precio base $${Math.round(product.price).toLocaleString('es-CO')}.\n\n` +
                    `_Si pides *combo*, después eliges las gaseosas._\n\n` +
                    `_Dime cuál porción te interesa o si quieres pedir._`);
            }
            if (infoAttrs.length === 1) {
                return this.formatAttributeStepPrompt(product, infoAttrs[0], alreadySelected, {
                    mode: 'info',
                });
            }
            let msg = `*${product.name}* — precio base $${Math.round(product.price).toLocaleString('es-CO')}.`;
            for (const attr of infoAttrs) {
                msg += `\n\n${this.formatAttributeStepPrompt(product, attr, alreadySelected, { mode: 'info', skipHeader: true })}`;
            }
            return msg;
        }
        if (!next?.options?.length) {
            return `*${product.name}* — ¿cuál opción prefieres?`;
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
            const price = `$${Math.round(r.price).toLocaleString('es-CO')}`;
            const code = r.code != null ? ` · cód. ${r.code}` : '';
            return `${this.optionNumberEmoji(r.index)} *${r.label}* — ${price}${code}`;
        })
            .join('\n');
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
        const totalSteps = (product.attributes || []).filter((a) => !this.isComboOnlyAttribute(a) || showComboOnly).length;
        const doneSteps = alreadySelected.filter((s) => !this.isComboOnlyAttribute({ attributeName: s.attributeName }) || showComboOnly).length;
        const stepNum = Math.min(totalSteps, doneSteps + 1);
        if (!opts?.skipHeader) {
            parts.push(`🍽️ *${product.name}* · cód. ${product.code}`);
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
        const q = normalizeText(this.extractProductSearchQuery(query));
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
        let bestBase = '';
        let bestCount = 0;
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
        if (!bestBase)
            return null;
        const queryHitsBase = q.includes(bestBase) ||
            bestBase.includes(q) ||
            q.split(' ').filter((t) => t.length >= 4).every((t) => bestBase.includes(t));
        if (!queryHitsBase && bestCount < 2)
            return null;
        const variants = available.filter((p) => {
            const base = this.getProductNameBase(p.name);
            const name = normalizeText(p.name);
            return base === bestBase || (name.includes(bestBase) && base.length >= 4);
        });
        if (variants.length < 2)
            return null;
        const hasVariantCue = variants.some((p) => /\b(solo|sola|combo|completo|completa|gaseosa|bebida)\b/i.test(p.name));
        if (!hasVariantCue && !variants.some((p) => p.hasAttributes))
            return null;
        const uniq = new Map();
        for (const v of variants)
            uniq.set(v.id, v);
        const sorted = [...uniq.values()].sort((a, b) => {
            const rank = (n) => {
                const x = normalizeText(n);
                if (/\bsolo\b/.test(x))
                    return 0;
                if (/\bcombo\b/.test(x))
                    return 1;
                if (/\b(completo|gaseosa|bebida)\b/.test(x))
                    return 2;
                return 3;
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
            `_Responde con el *número* o escribe *solo* / *combo*._`);
    }
    getRemainingAttributes(product, alreadySelected = [], opts) {
        const attrs = product.attributes || [];
        const showComboOnly = this.shouldShowComboOnlyAttributes(product, alreadySelected, opts);
        return attrs.filter((attr) => {
            if (alreadySelected.some((s) => s.attributeName === attr.attributeName))
                return false;
            if (this.isComboOnlyAttribute(attr) && !showComboOnly)
                return false;
            return true;
        });
    }
    isComboOnlyAttribute(attr) {
        const n = normalizeText(attr.attributeName);
        return /\b(gaseosa|gaseosas|bebida|bebidas|refresco|refrescos)\b/.test(n);
    }
    isModalityAttribute(attr) {
        const n = normalizeText(attr.attributeName);
        if (/\b(modalidad|presentacion|presentación|porcion|porción|tipo|variante|estilo|formato)\b/.test(n)) {
            return true;
        }
        return attr.options.some((opt) => {
            const v = normalizeText(opt);
            return (/\b(solo|combo|completo|completa)\b/.test(v) ||
                /\b(con\s+bebida|con\s+gaseosa|sin\s+bebida|sin\s+gaseosa)\b/.test(v));
        });
    }
    hasModalityAttribute(attrs) {
        return attrs.some((a) => !this.isComboOnlyAttribute(a) && this.isModalityAttribute(a));
    }
    hasComboPortionSelected(alreadySelected) {
        return alreadySelected.some((s) => this.isComboLikeValue(s.attributeValue));
    }
    hasSoloPortionSelected(alreadySelected) {
        return alreadySelected.some((s) => this.isSoloLikeValue(s.attributeValue));
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
            /\b(sin\s+bebida|sin\s+gaseosa|sin\s+combo)\b/.test(v));
    }
    shouldShowComboOnlyAttributes(product, alreadySelected, opts) {
        if (opts?.variantIntent === 'solo' || this.hasSoloPortionSelected(alreadySelected)) {
            return false;
        }
        if (opts?.variantIntent === 'combo' || this.hasComboPortionSelected(alreadySelected)) {
            return true;
        }
        const attrs = product.attributes || [];
        const nonComboAttrs = attrs.filter((a) => !this.isComboOnlyAttribute(a));
        const allNonComboSelected = nonComboAttrs.length > 0 &&
            nonComboAttrs.every((a) => alreadySelected.some((s) => s.attributeName === a.attributeName));
        if (!allNonComboSelected)
            return false;
        if (!this.hasModalityAttribute(nonComboAttrs))
            return true;
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
    isGenericProductInquiry(text) {
        if (this.isPriceInquiryIntent(text))
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
    extractExplicitAttributeChoice(text, product) {
        const step = this.resolveAttributesFromMessage(product, text, []);
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
        return (`Estas son las opciones relacionadas:\n\n${body}\n\n` +
            `¿Cuál te interesa? Dime el *número* o el *nombre*.`);
    }
    splitMultiProductSegments(text) {
        if (this.looksLikeFoodPlusDrinkOrder(text)) {
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
        let q = this.extractProductSearchQuery(text);
        if (!q)
            return [];
        const byCommaOrY = q
            .split(/\s*,\s*|\s+\by\b\s+|\s+(?:mas|más|\+)\s+/i)
            .map((s) => this.cleanOrderSegment(s.trim()))
            .filter((s) => s.length >= 3);
        const expanded = [];
        for (const chunk of byCommaOrY.length ? byCommaOrY : [q]) {
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
        return use.length ? use : [fixed.trim()].filter((s) => s.length >= 3);
    }
    resolveMultiProductOrder(text, products) {
        if (this.isPriceInquiryIntent(text))
            return null;
        if (this.isMenuExploreIntent(text, products))
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
        if (embeddedAll.length === 1 && this.looksLikeFoodPlusDrinkOrder(text)) {
            const companion = this.findFoodDrinkCompanionProduct(text, embeddedAll[0], products);
            if (companion && companion.id !== embeddedAll[0].id) {
                embeddedAll = this.isLikelyDrinkProduct(embeddedAll[0])
                    ? [companion, embeddedAll[0]]
                    : [embeddedAll[0], companion];
            }
        }
        if (embeddedAll.length >= 2) {
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
                if (drinks.length >= 1) {
                    const preferred = drinks.find((x) => /\b400\s*ml\b/.test(normalizeText(x.p.name))) ||
                        drinks.find((x) => /\bpersonal\b/.test(normalizeText(x.p.name))) ||
                        drinks.find((x) => /\b250\s*ml\b/.test(normalizeText(x.p.name))) ||
                        drinks[0];
                    if (!usedProductIds.has(preferred.p.id)) {
                        usedProductIds.add(preferred.p.id);
                        const match = { segment, product: preferred.p, score: preferred.score };
                        if (preferred.p.hasAttributes && preferred.p.attributes?.length) {
                            needsAttributes.push(match);
                        }
                        else {
                            confident.push(match);
                        }
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
    formatProductListItem(product, index) {
        const prefix = index != null ? `${index}. ` : '';
        const price = `$${Math.round(product.price).toLocaleString('es-CO')}`;
        let line = `${prefix}*${product.name}* (cód. ${product.code}) — ${price}`;
        if (product.description) {
            const short = product.description.length > 120
                ? `${product.description.slice(0, 117)}…`
                : product.description;
            line += `\n   _${short}_`;
        }
        if (product.hasAttributes) {
            line += `\n   ↳ Elige opciones al pedirlo`;
        }
        return line;
    }
    formatCategoryList(categoryName, list) {
        const body = list.map((p, i) => this.formatProductListItem(p, i + 1)).join('\n\n');
        return (`*${categoryName}* — ${list.length} ${list.length === 1 ? 'opción' : 'opciones'}:\n\n` +
            `${body}\n\n` +
            `Respóndeme con el *número* o el *código* del que quieras.`);
    }
    formatProductOptionsPrompt(product, alreadySelected = [], opts) {
        const remaining = this.getRemainingAttributes(product, alreadySelected, opts);
        const next = remaining[0];
        if (!product.hasAttributes || !product.attributes?.length || !next) {
            return `*${product.name}* (cód. ${product.code})`;
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
                return { status: 'complete', attributes: selected };
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
        const stillRemaining = this.getRemainingAttributes(product, selected, opts);
        if (!stillRemaining.length)
            return { status: 'complete', attributes: selected };
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
        const fromMessage = this.resolveAttributesFromMessage(product, text, alreadySelected, opts);
        if (fromMessage.status !== 'invalid')
            return fromMessage;
        const remaining = this.getRemainingAttributes(product, alreadySelected, opts);
        if (!remaining.length) {
            return { status: 'complete', attributes: alreadySelected };
        }
        const attr = remaining[0];
        const t = normalizeText(text);
        let picked = null;
        const bare = text.trim().match(/^([1-9]\d{0,2})$/);
        if (bare) {
            const num = parseInt(bare[1], 10);
            if (num >= 1 && num <= attr.options.length) {
                picked = attr.options[num - 1];
            }
        }
        if (!picked) {
            picked = this.pickAttributeOptionFromText(text, attr);
        }
        if (!picked) {
            const m = text.trim().match(/(?:opci[oó]n|la|el)\s*([1-9]\d{0,2})/i);
            if (m) {
                const num = parseInt(m[1], 10);
                if (num >= 1 && num <= attr.options.length)
                    picked = attr.options[num - 1];
            }
        }
        if (!picked)
            return { status: 'invalid' };
        const nextSelected = [
            ...alreadySelected,
            { attributeName: attr.attributeName, attributeValue: picked },
        ];
        if (!this.getRemainingAttributes(product, nextSelected, opts).length) {
            return { status: 'complete', attributes: nextSelected };
        }
        return { status: 'partial', attributes: nextSelected };
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