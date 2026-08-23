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
    findByCategory(query, products) {
        const q = normalizeText(query);
        if (!q || q.length < 3)
            return null;
        const available = products.filter((p) => p.availableNow !== false);
        const categoryNames = [
            ...new Set(available.map((p) => p.categoryName).filter(Boolean)),
        ];
        let best = null;
        for (const cat of categoryNames) {
            const c = normalizeText(cat);
            const cs = stemLoose(cat);
            let score = 0;
            if (q === c || q === cs)
                score = 100;
            else if (q.includes(c) || c.includes(q))
                score = 80;
            else if (q.includes(cs) || cs.includes(stemLoose(q)))
                score = 70;
            else {
                const tokens = q.split(' ').filter((t) => t.length >= 3);
                for (const t of tokens) {
                    const ts = stemLoose(t);
                    if (c.includes(t) || c.includes(ts) || ts === cs)
                        score = Math.max(score, 60);
                }
            }
            if (score >= 60 && /\b(que|qué|tienen|hay|menu|menú|ver|lista|categoria|categoría)\b/.test(q)) {
                score += 10;
            }
            if (score >= 60 && (!best || score > best.score)) {
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
    searchByName(query, products, limit = 8) {
        const q = normalizeText(query);
        if (!q || q.length < 2)
            return [];
        const available = products.filter((p) => p.availableNow !== false);
        const qStem = stemLoose(q);
        const scored = available
            .map((p) => {
            const name = normalizeText(p.name);
            const desc = normalizeText(p.description || '');
            const cat = normalizeText(p.categoryName || '');
            let score = 0;
            if (name === q)
                score += 100;
            if (name.includes(q) || name.includes(qStem))
                score += 50;
            if (q.includes(name) && name.length > 3)
                score += 40;
            if (desc.includes(q) || desc.includes(qStem))
                score += 25;
            if (cat.includes(q) || cat.includes(qStem))
                score += 15;
            const tokens = q.split(' ').filter((t) => t.length > 2);
            for (const t of tokens) {
                const ts = stemLoose(t);
                if (name.includes(t) || name.includes(ts))
                    score += 10;
                if (desc.includes(t) || desc.includes(ts))
                    score += 5;
            }
            return { p, score };
        })
            .filter((x) => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
        return scored.map((x) => x.p);
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
        return (`*${categoryName}* — ${list.length} opción${list.length === 1 ? '' : 'es'}:\n\n` +
            `${body}\n\n` +
            `Respóndeme con el *número* o el *código* del que quieras.`);
    }
    formatProductOptionsPrompt(product, alreadySelected = []) {
        const price = `$${Math.round(product.price).toLocaleString('es-CO')}`;
        let msg = `*${product.name}* (código ${product.code}) — ${price}`;
        if (product.description) {
            msg += `\n\n📝 ${product.description}`;
        }
        if (!product.hasAttributes || !product.attributes?.length) {
            return msg;
        }
        const remaining = product.attributes.filter((a) => !alreadySelected.some((s) => s.attributeName === a.attributeName));
        const next = remaining[0];
        if (!next)
            return msg;
        if (alreadySelected.length) {
            msg +=
                '\n\nElegido: ' +
                    alreadySelected.map((s) => `${s.attributeName}: ${s.attributeValue}`).join(', ');
        }
        msg += `\n\n¿Con qué *${next.attributeName}* lo quieres?`;
        next.options.forEach((opt, i) => {
            msg += `\n  ${i + 1}) ${opt}`;
        });
        msg +=
            '\n\nRespóndeme con el *número* (1, 2, 3…) o el nombre. _Aquí el número es la opción, no el código del producto._';
        return msg;
    }
    resolveNextAttributeChoice(product, text, alreadySelected) {
        if (!product.attributes?.length) {
            return { status: 'complete', attributes: [] };
        }
        const remaining = product.attributes.filter((a) => !alreadySelected.some((s) => s.attributeName === a.attributeName));
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
            for (const opt of attr.options) {
                const no = normalizeText(opt);
                if (no === t || t.includes(no) || no.includes(t)) {
                    picked = opt;
                    break;
                }
            }
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
        if (nextSelected.length >= product.attributes.length) {
            return { status: 'complete', attributes: nextSelected };
        }
        return { status: 'partial', attributes: nextSelected };
    }
    resolveAttributesFromText(product, text) {
        const step = this.resolveNextAttributeChoice(product, text, []);
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