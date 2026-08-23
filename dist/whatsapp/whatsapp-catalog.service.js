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
        for (const cat of grouped || []) {
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
                    categoryName: cat.categoryName,
                    hasAttributes: !!p.hasAttributes && attrs.length > 0,
                    attributes: attrs,
                    availableNow: p.availableNow !== false,
                });
            }
        }
        const compact = products
            .filter((p) => p.availableNow !== false)
            .map((p) => `[id=${p.id}] código ${p.code} — ${p.name} — $${Math.round(p.price).toLocaleString('es-CO')}` +
            (p.hasAttributes ? ' (requiere opciones)' : ''))
            .join('\n');
        const detailed = products
            .filter((p) => p.availableNow !== false)
            .map((p) => {
            let line = `[id=${p.id}] código ${p.code} — ${p.name} — $${Math.round(p.price).toLocaleString('es-CO')}`;
            if (p.hasAttributes && p.attributes?.length) {
                const opts = p.attributes
                    .map((a) => `${a.attributeName}: ${a.options.join(', ')}`)
                    .join(' | ');
                line += ` → ${opts}`;
            }
            return line;
        })
            .join('\n');
        this.menuCache = { at: Date.now(), products, compact, detailed };
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
    getProductById(id, products) {
        return products.find((p) => p.id === id) ?? null;
    }
    extractCodeFromMessage(text) {
        const m = text.match(/\b(?:codigo|código|code|#)?\s*(\d{1,4})\b/i);
        if (m?.[1])
            return parseInt(m[1], 10);
        if (/^\d{1,4}$/.test(text.trim()))
            return parseInt(text.trim(), 10);
        return null;
    }
    findByCode(code, products) {
        return products.find((p) => p.code === code) ?? null;
    }
    searchByName(query, products, limit = 5) {
        const q = normalizeText(query);
        if (!q || q.length < 2)
            return [];
        const available = products.filter((p) => p.availableNow !== false);
        const scored = available
            .map((p) => {
            const name = normalizeText(p.name);
            let score = 0;
            if (name === q)
                score += 100;
            if (name.includes(q))
                score += 50;
            if (q.includes(name) && name.length > 3)
                score += 40;
            const tokens = q.split(' ').filter((t) => t.length > 2);
            for (const t of tokens) {
                if (name.includes(t))
                    score += 10;
            }
            return { p, score };
        })
            .filter((x) => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
        return scored.map((x) => x.p);
    }
    resolveAttributesFromText(product, text) {
        if (!product.attributes?.length)
            return [];
        const t = normalizeText(text);
        const selected = [];
        for (const attr of product.attributes) {
            let picked = null;
            for (const opt of attr.options) {
                if (normalizeText(opt) === t || t.includes(normalizeText(opt))) {
                    picked = opt;
                    break;
                }
            }
            if (!picked) {
                const num = parseInt(text.trim(), 10);
                if (Number.isFinite(num) && num >= 1 && num <= attr.options.length) {
                    picked = attr.options[num - 1];
                }
            }
            if (!picked)
                return null;
            selected.push({ attributeName: attr.attributeName, attributeValue: picked });
        }
        return selected;
    }
};
exports.WhatsappCatalogService = WhatsappCatalogService;
exports.WhatsappCatalogService = WhatsappCatalogService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [products_service_1.ProductsService])
], WhatsappCatalogService);
//# sourceMappingURL=whatsapp-catalog.service.js.map