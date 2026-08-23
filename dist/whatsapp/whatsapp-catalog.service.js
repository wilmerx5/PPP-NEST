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
        let q = text.trim();
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
            .replace(/^(quiero|voy a pedir)\s+(un|una|unos|unas|el|la|los|las)?\s*/i, '')
            .replace(/\s+(por favor|porfa|pf|gracias)[\s!.?]*$/i, '')
            .trim();
        q = this.cleanOrderSegment(q);
        q = this.stripProductSearchNoise(q);
        return q || text.trim();
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
    findAllProductsEmbeddedInMessage(text, products) {
        const q = normalizeText(text);
        if (!q || q.length < 4)
            return [];
        const available = products.filter((p) => p.availableNow !== false);
        const hits = [];
        for (const p of available) {
            const name = normalizeText(p.name);
            if (name.length < 4)
                continue;
            let idx = 0;
            while ((idx = q.indexOf(name, idx)) !== -1) {
                hits.push({ p, start: idx, end: idx + name.length, nameLen: name.length });
                idx += 1;
            }
        }
        hits.sort((a, b) => b.nameLen - a.nameLen || a.start - b.start);
        const picked = [];
        const ranges = [];
        const usedIds = new Set();
        for (const h of hits) {
            if (usedIds.has(h.p.id))
                continue;
            const overlaps = ranges.some((r) => !(h.end <= r.start || h.start >= r.end));
            if (overlaps)
                continue;
            picked.push(h.p);
            usedIds.add(h.p.id);
            ranges.push({ start: h.start, end: h.end });
        }
        return picked.sort((a, b) => {
            const aIdx = q.indexOf(normalizeText(a.name));
            const bIdx = q.indexOf(normalizeText(b.name));
            return aIdx - bIdx;
        });
    }
    looksLikeMultiItemOrderMessage(text) {
        if (!/\s+\by\b\s+|\s*,\s*/i.test(text))
            return false;
        if (this.isPriceInquiryIntent(text))
            return false;
        return this.splitMultiProductSegments(text).length >= 2;
    }
    findProductEmbeddedInMessage(text, products) {
        const q = normalizeText(text);
        if (!q || q.length < 4)
            return null;
        const available = products.filter((p) => p.availableNow !== false);
        const hits = [];
        for (const p of available) {
            const name = normalizeText(p.name);
            if (name.length < 4)
                continue;
            if (!q.includes(name))
                continue;
            hits.push({
                p,
                nameLen: name.length,
                tokenCount: name.split(' ').filter((t) => t.length > 2).length,
            });
        }
        if (!hits.length)
            return null;
        hits.sort((a, b) => b.nameLen - a.nameLen || b.tokenCount - a.tokenCount);
        const best = hits[0];
        if (hits.length >= 2 &&
            hits[1].nameLen === best.nameLen &&
            hits[1].p.id !== best.p.id) {
            return null;
        }
        return best.p;
    }
    looksLikeDeliveryTail(tail) {
        const t = normalizeText(tail);
        if (t.length < 5)
            return false;
        if (/\b(domicilio|delivery|la casa|mi casa|mi direccion)\b/.test(t))
            return true;
        if (/\b(calle|carrera|cra|cll|av|avenida|barrio|conjunto|apto|apartamento|torre|#)\b/.test(t)) {
            return true;
        }
        return t.length >= 8 && /\d/.test(t);
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
        return { categoryName: best.categoryName, products: list };
    }
    findCategoryBrowseHit(text, products, menuConceptGroups) {
        const trimmed = text.trim();
        if (!trimmed)
            return null;
        const extracted = this.extractProductSearchQuery(trimmed);
        const queries = extracted !== trimmed ? [extracted, trimmed] : [extracted];
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
            .filter((t) => t.length > 2 && !STOP.has(t));
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
                    if (wordHas(desc, t) || (desc.includes(t) && t.length >= 5))
                        score += 4;
                    if (wordHas(cat, t))
                        score += 6;
                }
            }
            if (score >= 50 && nameTokens.length >= 2) {
                score += Math.min(12, nameTokens.length * 3);
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
    formatOptionsTable(rows) {
        const labelWidth = Math.min(26, Math.max(10, ...rows.map((r) => r.label.length)));
        const lines = [
            '```',
            `${'#'.padEnd(3)} ${'Opción'.padEnd(labelWidth)} Precio`,
            '─'.repeat(labelWidth + 16),
        ];
        for (const r of rows) {
            const label = r.label.length > labelWidth ? `${r.label.slice(0, labelWidth - 1)}…` : r.label;
            const price = `$${Math.round(r.price).toLocaleString('es-CO')}`;
            lines.push(`${String(r.index).padEnd(3)} ${label.padEnd(labelWidth)} ${price}`);
        }
        lines.push('```');
        return lines.join('\n');
    }
    formatAttributeStepPrompt(product, attr, alreadySelected = [], opts) {
        const rows = attr.options.map((opt, i) => ({
            index: i + 1,
            label: opt,
            price: product.price,
        }));
        const parts = [];
        if (!opts?.skipHeader) {
            parts.push(`*${product.name}* (cód. ${product.code})`);
        }
        if (alreadySelected.length) {
            parts.push(`✅ ${alreadySelected.map((s) => s.attributeValue).join(' · ')}`);
        }
        const question = this.isComboOnlyAttribute(attr)
            ? `¿Qué *${attr.attributeName}* lleva tu combo?`
            : `¿Qué *${attr.attributeName}* prefieres?`;
        parts.push(question);
        parts.push(this.formatOptionsTable(rows));
        if (opts?.mode === 'info') {
            parts.push('_Dime el número o el nombre si quieres pedir._');
        }
        else {
            parts.push('Responde con el *número* o el *nombre* de la opción.');
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
            `${this.formatOptionsTable(rows)}\n\n` +
            `Responde con el *número* o escribe *solo* / *combo*.`);
    }
    getRemainingAttributes(product, alreadySelected = []) {
        return (product.attributes || []).filter((attr) => {
            if (alreadySelected.some((s) => s.attributeName === attr.attributeName))
                return false;
            if (this.isComboOnlyAttribute(attr) && !this.hasComboPortionSelected(alreadySelected)) {
                return false;
            }
            return true;
        });
    }
    isComboOnlyAttribute(attr) {
        const n = normalizeText(attr.attributeName);
        return /\b(gaseosa|gaseosas|bebida|bebidas|refresco|refrescos)\b/.test(n);
    }
    hasComboPortionSelected(alreadySelected) {
        return alreadySelected.some((s) => /\bcombo\b/.test(normalizeText(s.attributeValue)));
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
        let q = this.extractProductSearchQuery(text);
        if (!q)
            return [];
        const byCommaOrY = q
            .split(/\s*,\s*|\s+\by\b\s+/i)
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
        const parts = chunk
            .split(/\s+(?=(?:un|una|unos|unas|el|la|los|las)\s+)/i)
            .map((s) => s.trim())
            .filter((s) => s.length >= 3);
        return parts.length ? parts : [chunk.trim()].filter((s) => s.length >= 3);
    }
    resolveMultiProductOrder(text, products) {
        if (this.isPriceInquiryIntent(text))
            return null;
        if (this.isMenuExploreIntent(text, products))
            return null;
        const segments = this.splitMultiProductSegments(text);
        const embeddedAll = this.findAllProductsEmbeddedInMessage(text, products);
        if (embeddedAll.length >= 2) {
            const confident = [];
            const needsAttributes = [];
            for (const product of embeddedAll) {
                const segment = segments.find((s) => normalizeText(s).includes(normalizeText(product.name))) ||
                    product.name;
                const match = { segment, product, score: 100 };
                if (product.hasAttributes && product.attributes?.length) {
                    const explicit = this.extractExplicitAttributeChoice(segment, product);
                    if (explicit)
                        confident.push(match);
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
        if (segments.length < 2)
            return null;
        const confident = [];
        const ambiguous = [];
        const unresolved = [];
        const needsAttributes = [];
        const usedProductIds = new Set();
        for (const rawSegment of segments) {
            const segment = this.cleanOrderSegment(rawSegment);
            const embedded = this.findProductEmbeddedInMessage(segment, products);
            if (embedded) {
                if (usedProductIds.has(embedded.id))
                    continue;
                usedProductIds.add(embedded.id);
                const match = { segment, product: embedded, score: 100 };
                if (embedded.hasAttributes && embedded.attributes?.length) {
                    if (this.extractExplicitAttributeChoice(segment, embedded))
                        confident.push(match);
                    else
                        needsAttributes.push(match);
                }
                else
                    confident.push(match);
                continue;
            }
            const query = this.extractProductSearchQuery(segment);
            const scored = this.searchByNameScored(query, products, 5);
            if (!scored.length) {
                unresolved.push(segment);
                continue;
            }
            const segNorm = normalizeText(segment);
            if (/\bejecutivo\b/.test(segNorm)) {
                const ejecutivoHits = scored.filter((x) => normalizeText(x.p.name).includes('ejecutivo'));
                if (ejecutivoHits.length === 1) {
                    const top = ejecutivoHits[0];
                    if (!usedProductIds.has(top.p.id)) {
                        usedProductIds.add(top.p.id);
                        const match = { segment, product: top.p, score: top.score };
                        if (top.p.hasAttributes && top.p.attributes?.length) {
                            if (this.extractExplicitAttributeChoice(segment, top.p))
                                confident.push(match);
                            else
                                needsAttributes.push(match);
                        }
                        else
                            confident.push(match);
                        continue;
                    }
                }
            }
            if (this.isStrongProductMatch(scored)) {
                const top = scored[0];
                if (usedProductIds.has(top.p.id))
                    continue;
                usedProductIds.add(top.p.id);
                const match = { segment, product: top.p, score: top.score };
                if (top.p.hasAttributes && top.p.attributes?.length) {
                    if (this.extractExplicitAttributeChoice(segment, top.p))
                        confident.push(match);
                    else
                        needsAttributes.push(match);
                }
                else
                    confident.push(match);
                continue;
            }
            if (scored.length >= 2 && scored[0].score >= 35) {
                ambiguous.push({ segment, candidates: scored.slice(0, 4).map((x) => x.p) });
            }
            else if (scored.length === 1 && scored[0].score >= 40) {
                const top = scored[0];
                if (usedProductIds.has(top.p.id))
                    continue;
                usedProductIds.add(top.p.id);
                const match = { segment, product: top.p, score: top.score };
                if (top.p.hasAttributes && top.p.attributes?.length) {
                    if (this.extractExplicitAttributeChoice(segment, top.p))
                        confident.push(match);
                    else
                        needsAttributes.push(match);
                }
                else
                    confident.push(match);
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
    formatProductOptionsPrompt(product, alreadySelected = []) {
        const remaining = this.getRemainingAttributes(product, alreadySelected);
        const next = remaining[0];
        if (!product.hasAttributes || !product.attributes?.length || !next) {
            return `*${product.name}* (cód. ${product.code})`;
        }
        return this.formatAttributeStepPrompt(product, next, alreadySelected, { mode: 'order' });
    }
    resolveAttributesFromMessage(product, text, alreadySelected = []) {
        if (!product.attributes?.length) {
            return { status: 'complete', attributes: alreadySelected };
        }
        let selected = [...alreadySelected];
        let progress = true;
        while (progress) {
            progress = false;
            const remaining = this.getRemainingAttributes(product, selected);
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
        const stillRemaining = this.getRemainingAttributes(product, selected);
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
        if (/\bcombo\b/.test(q)) {
            const comboOpt = attr.options.find((o) => normalizeText(o).includes('combo'));
            if (comboOpt)
                return comboOpt;
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
    resolveNextAttributeChoice(product, text, alreadySelected) {
        if (!product.attributes?.length) {
            return { status: 'complete', attributes: alreadySelected };
        }
        const fromMessage = this.resolveAttributesFromMessage(product, text, alreadySelected);
        if (fromMessage.status !== 'invalid')
            return fromMessage;
        const remaining = this.getRemainingAttributes(product, alreadySelected);
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
        if (!this.getRemainingAttributes(product, nextSelected).length) {
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