import { Injectable } from '@nestjs/common';
import { ProductsService } from '../products/products.service';
import type { WhatsappProductCandidate } from './types/whatsapp-session.types';

export type WhatsappCatalogProduct = WhatsappProductCandidate;

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stemLoose(s: string): string {
  const n = normalizeText(s);
  // quita plural simple (sopas→sopa, bebidas→bebida)
  if (n.length > 3 && n.endsWith('s') && !n.endsWith('es')) return n.slice(0, -1);
  if (n.length > 4 && n.endsWith('es')) return n.slice(0, -2);
  return n;
}

@Injectable()
export class WhatsappCatalogService {
  private menuCache: {
    at: number;
    products: WhatsappCatalogProduct[];
    categories: string[];
    compact: string;
    detailed: string;
  } | null = null;
  private readonly TTL_MS = 60_000;

  constructor(private readonly productsService: ProductsService) {}

  async getMenuProducts(): Promise<WhatsappCatalogProduct[]> {
    const cached = this.menuCache;
    if (cached && Date.now() - cached.at < this.TTL_MS) {
      return cached.products;
    }

    const grouped = await this.productsService.findProductsGroupedByCategory();
    const products: WhatsappCatalogProduct[] = [];
    const categories: string[] = [];

    for (const cat of grouped || []) {
      const catName = String(cat.categoryName || '').trim();
      if (catName) categories.push(catName);
      for (const p of cat.products || []) {
        const attrs = (p.attributes || []).map(
          (a: { attributeName: string; options: string[] | unknown[] }) => ({
            attributeName: a.attributeName,
            options: Array.isArray(a.options) ? a.options.map(String) : [],
          }),
        );
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
      .map(
        (p) =>
          `[id=${p.id}] código ${p.code} — ${p.name} — $${Math.round(p.price).toLocaleString('es-CO')}` +
          (p.categoryName ? ` [${p.categoryName}]` : '') +
          (p.hasAttributes ? ' (requiere opciones)' : ''),
      )
      .join('\n');

    // Menú para IA: agrupado por categoría + descripción + atributos
    const byCat = new Map<string, WhatsappCatalogProduct[]>();
    for (const p of available) {
      const key = p.categoryName || 'Otros';
      if (!byCat.has(key)) byCat.set(key, []);
      byCat.get(key)!.push(p);
    }
    const detailedParts: string[] = [];
    for (const [cat, list] of byCat) {
      detailedParts.push(`## Categoría: ${cat}`);
      for (const p of list) {
        let block = `[id=${p.id}] código ${p.code} — ${p.name} — $${Math.round(p.price).toLocaleString('es-CO')}`;
        if (p.description) block += `\n  Descripción: ${p.description}`;
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

  async getMenuCompactText(): Promise<string> {
    await this.getMenuProducts();
    return this.menuCache?.compact || '';
  }

  async getMenuDetailedText(): Promise<string> {
    await this.getMenuProducts();
    return this.menuCache?.detailed || '';
  }

  async getCategoryNames(): Promise<string[]> {
    await this.getMenuProducts();
    return this.menuCache?.categories || [];
  }

  getProductById(id: number, products: WhatsappCatalogProduct[]): WhatsappCatalogProduct | null {
    return products.find((p) => p.id === id) ?? null;
  }

  extractCodeFromMessage(text: string): number | null {
    const raw = text.trim();
    // Nunca tratar tiempos ("en 15 minutos", "15-20 min") como código
    if (/\b\d{1,3}\s*(?:-|a|o|\/)?\s*\d{0,3}\s*(?:minutos?|mins?|horas?|hrs?)\b/i.test(raw)) {
      return null;
    }
    if (/\b(?:en|para|dentro\s+de)\s+\d{1,3}\b/i.test(raw) && !/\b(?:codigo|código|code|#)\b/i.test(raw)) {
      return null;
    }
    // Prefijo explícito: "código 12", "#5", "code 28"
    const explicit = raw.match(/\b(?:codigo|código|code)\s*(\d{1,4})\b/i) || raw.match(/#\s*(\d{1,4})\b/);
    if (explicit?.[1]) return parseInt(explicit[1], 10);
    // Solo dígitos puros (el orquestador decide opción vs código)
    if (/^\d{1,4}$/.test(raw)) return parseInt(raw, 10);
    return null;
  }

  findByCode(code: number, products: WhatsappCatalogProduct[]): WhatsappCatalogProduct | null {
    return products.find((p) => p.code === code) ?? null;
  }

  /**
   * Si el mensaje pide una categoría (ej. "sopas", "qué bebidas tienen"),
   * devuelve TODOS los productos de esa categoría.
   */
  findByCategory(
    query: string,
    products: WhatsappCatalogProduct[],
  ): { categoryName: string; products: WhatsappCatalogProduct[] } | null {
    const q = normalizeText(query);
    if (!q || q.length < 3) return null;

    // Pedir el link/carta del menú ≠ pedir una categoría
    if (
      /\b(link|enlace|url)\b/.test(q) ||
      /\b(pasa|dame|envia|manda|comparte)\b.*\b(menu|carta)\b/.test(q) ||
      /^(ver\s+)?(el\s+)?(menu|carta)(\s+completo)?$/.test(q)
    ) {
      return null;
    }

    const available = products.filter((p) => p.availableNow !== false);
    const categoryNames = [
      ...new Set(available.map((p) => p.categoryName).filter(Boolean) as string[]),
    ];

    let best: { categoryName: string; score: number } | null = null;

    for (const cat of categoryNames) {
      const c = normalizeText(cat);
      const cs = stemLoose(cat);
      let score = 0;

      if (q === c || q === cs) score = 100;
      else if (q.includes(c) || c.includes(q)) score = 80;
      else if (q.includes(cs) || cs.includes(stemLoose(q))) score = 70;
      else {
        // tokens del mensaje vs categoría (ignorar "menu"/"carta" genéricos)
        const tokens = q
          .split(' ')
          .filter((t) => t.length >= 3 && !['menu', 'carta', 'link', 'ver', 'lista'].includes(t));
        for (const t of tokens) {
          const ts = stemLoose(t);
          if (c.includes(t) || c.includes(ts) || ts === cs) score = Math.max(score, 60);
        }
      }

      // palabras típicas de menú cerca de la categoría
      if (score >= 60 && /\b(que|qué|tienen|hay|ver|lista|categoria|categoría)\b/.test(q)) {
        score += 10;
      }

      if (score >= 60 && (!best || score > best.score)) {
        best = { categoryName: cat, score };
      }
    }

    if (!best) return null;

    const list = available.filter((p) => p.categoryName === best!.categoryName);
    if (!list.length) return null;
    return { categoryName: best.categoryName, products: list };
  }

  searchByName(query: string, products: WhatsappCatalogProduct[], limit = 8): WhatsappCatalogProduct[] {
    const q = normalizeText(query);
    if (!q || q.length < 2) return [];

    // Pedidos del tipo "link del menú" no deben buscar productos
    if (
      /\b(link|enlace|url)\b/.test(q) ||
      /\b(pasa|dame|envia|manda|comparte)\b.*\b(menu|carta)\b/.test(q) ||
      /^(ver\s+)?(el\s+)?(menu|carta)(\s+completo)?$/.test(q)
    ) {
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
      'completo',
      'pagina',
      'web',
    ]);

    const available = products.filter((p) => p.availableNow !== false);
    const qStem = stemLoose(q);
    const tokens = q
      .split(' ')
      .map((t) => t.trim())
      .filter((t) => t.length > 2 && !STOP.has(t));

    // Si tras quitar stopwords no queda nada útil, no buscar
    if (!tokens.length && (STOP.has(q) || q === 'menu' || q === 'carta')) return [];

    const wordHas = (hay: string, needle: string) => {
      if (!needle) return false;
      // Evitar que "menu" matchee "menudencias"
      if (needle.length <= 4) {
        return new RegExp(`(?:^|\\s)${needle}(?:\\s|$)`).test(hay);
      }
      return hay.includes(needle);
    };

    const scored = available
      .map((p) => {
        const name = normalizeText(p.name);
        const desc = normalizeText(p.description || '');
        const cat = normalizeText(p.categoryName || '');
        let score = 0;
        if (name === q) score += 100;
        // Solo substring completo si la query es “producto-like” (>= 4) y no es frase larga
        if (q.length >= 4 && q.split(' ').length <= 3) {
          if (wordHas(name, q) || wordHas(name, qStem)) score += 50;
          if (q.includes(name) && name.length > 3) score += 40;
        }
        if (tokens.length) {
          for (const t of tokens) {
            const ts = stemLoose(t);
            if (wordHas(name, t) || wordHas(name, ts)) score += 18;
            else if (name.includes(t) && t.length >= 5) score += 10;
            if (wordHas(desc, t) || (desc.includes(t) && t.length >= 5)) score += 4;
            if (wordHas(cat, t)) score += 8;
          }
        }
        return { p, score };
      })
      .filter((x) => x.score >= 18)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored.map((x) => x.p);
  }

  /** Línea corta para listados WhatsApp (precio + descripción corta). */
  formatProductListItem(product: WhatsappCatalogProduct, index?: number): string {
    const prefix = index != null ? `${index}. ` : '';
    const price = `$${Math.round(product.price).toLocaleString('es-CO')}`;
    let line = `${prefix}*${product.name}* (cód. ${product.code}) — ${price}`;
    if (product.description) {
      const short =
        product.description.length > 120
          ? `${product.description.slice(0, 117)}…`
          : product.description;
      line += `\n   _${short}_`;
    }
    if (product.hasAttributes) {
      line += `\n   ↳ Elige opciones al pedirlo`;
    }
    return line;
  }

  formatCategoryList(categoryName: string, list: WhatsappCatalogProduct[]): string {
    const body = list.map((p, i) => this.formatProductListItem(p, i + 1)).join('\n\n');
    return (
      `*${categoryName}* — ${list.length} opción${list.length === 1 ? '' : 'es'}:\n\n` +
      `${body}\n\n` +
      `Respóndeme con el *número* o el *código* del que quieras.`
    );
  }

  /** Texto para pedir atributos / “con qué viene”. */
  formatProductOptionsPrompt(
    product: WhatsappCatalogProduct,
    alreadySelected: { attributeName: string; attributeValue: string }[] = [],
  ): string {
    const price = `$${Math.round(product.price).toLocaleString('es-CO')}`;
    let msg = `*${product.name}* (código ${product.code}) — ${price}`;
    if (product.description) {
      msg += `\n\n📝 ${product.description}`;
    }
    if (!product.hasAttributes || !product.attributes?.length) {
      return msg;
    }

    const remaining = product.attributes.filter(
      (a) => !alreadySelected.some((s) => s.attributeName === a.attributeName),
    );
    const next = remaining[0];
    if (!next) return msg;

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

  /**
   * Resuelve la SIGUIENTE opción pendiente (una a la vez).
   * Cualquier número solo (1, 2, 3…) = índice de esa opción, no código de producto.
   */
  resolveNextAttributeChoice(
    product: WhatsappCatalogProduct,
    text: string,
    alreadySelected: { attributeName: string; attributeValue: string }[],
  ):
    | { status: 'complete'; attributes: { attributeName: string; attributeValue: string }[] }
    | { status: 'partial'; attributes: { attributeName: string; attributeValue: string }[] }
    | { status: 'invalid' } {
    if (!product.attributes?.length) {
      return { status: 'complete', attributes: [] };
    }

    const remaining = product.attributes.filter(
      (a) => !alreadySelected.some((s) => s.attributeName === a.attributeName),
    );
    if (!remaining.length) {
      return { status: 'complete', attributes: alreadySelected };
    }

    const attr = remaining[0];
    const t = normalizeText(text);
    let picked: string | null = null;

    // Solo dígitos → índice de opción (1-based)
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

    // "opcion 2" / "la 2"
    if (!picked) {
      const m = text.trim().match(/(?:opci[oó]n|la|el)\s*([1-9]\d{0,2})/i);
      if (m) {
        const num = parseInt(m[1], 10);
        if (num >= 1 && num <= attr.options.length) picked = attr.options[num - 1];
      }
    }

    if (!picked) return { status: 'invalid' };

    const nextSelected = [
      ...alreadySelected,
      { attributeName: attr.attributeName, attributeValue: picked },
    ];

    if (nextSelected.length >= product.attributes.length) {
      return { status: 'complete', attributes: nextSelected };
    }
    return { status: 'partial', attributes: nextSelected };
  }

  /** Intenta resolver opciones de atributos desde texto libre del cliente (legacy / todo de una vez) */
  resolveAttributesFromText(
    product: WhatsappCatalogProduct,
    text: string,
  ): { attributeName: string; attributeValue: string }[] | null {
    const step = this.resolveNextAttributeChoice(product, text, []);
    if (step.status === 'complete') return step.attributes;
    if (step.status === 'partial') return null;
    return null;
  }
}
