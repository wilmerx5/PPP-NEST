import { Injectable } from '@nestjs/common';
import { ProductsService } from '../products/products.service';
import type { WhatsappProductCandidate } from './types/whatsapp-session.types';

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

@Injectable()
export class WhatsappCatalogService {
  private menuCache: { at: number; products: WhatsappProductCandidate[]; compact: string } | null =
    null;
  private readonly TTL_MS = 60_000;

  constructor(private readonly productsService: ProductsService) {}

  async getMenuProducts(): Promise<WhatsappProductCandidate[]> {
    const cached = this.menuCache;
    if (cached && Date.now() - cached.at < this.TTL_MS) {
      return cached.products;
    }

    const grouped = await this.productsService.findProductsGroupedByCategory();
    const products: WhatsappProductCandidate[] = [];
    for (const cat of grouped || []) {
      for (const p of cat.products || []) {
        products.push({
          id: p.id,
          name: p.name,
          code: p.code,
          price: Number(p.price) || 0,
          categoryName: cat.categoryName,
        });
      }
    }

    const compact = products
      .map(
        (p) =>
          `[${p.id}] código ${p.code} — ${p.name} — $${Math.round(p.price).toLocaleString('es-CO')}`,
      )
      .join('\n');

    this.menuCache = { at: Date.now(), products, compact };
    return products;
  }

  async getMenuCompactText(): Promise<string> {
    await this.getMenuProducts();
    return this.menuCache?.compact || '';
  }

  extractCodeFromMessage(text: string): number | null {
    const m = text.match(/\b(?:codigo|código|code|#)?\s*(\d{1,4})\b/i);
    if (m?.[1]) return parseInt(m[1], 10);
    if (/^\d{1,4}$/.test(text.trim())) return parseInt(text.trim(), 10);
    return null;
  }

  findByCode(code: number, products: WhatsappProductCandidate[]): WhatsappProductCandidate | null {
    return products.find((p) => p.code === code) ?? null;
  }

  searchByName(query: string, products: WhatsappProductCandidate[], limit = 5): WhatsappProductCandidate[] {
    const q = normalizeText(query);
    if (!q || q.length < 2) return [];

    const scored = products
      .map((p) => {
        const name = normalizeText(p.name);
        let score = 0;
        if (name === q) score += 100;
        if (name.includes(q)) score += 50;
        if (q.includes(name) && name.length > 3) score += 40;
        const tokens = q.split(' ').filter((t) => t.length > 2);
        for (const t of tokens) {
          if (name.includes(t)) score += 10;
        }
        return { p, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored.map((x) => x.p);
  }
}
