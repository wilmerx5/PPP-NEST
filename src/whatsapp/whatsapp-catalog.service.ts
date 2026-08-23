import { Injectable } from '@nestjs/common';
import { ProductsService } from '../products/products.service';
import type { WhatsappProductCandidate } from './types/whatsapp-session.types';
import { findByMenuConcept, type MenuConceptGroup } from './whatsapp-menu-concepts';

export type WhatsappCatalogProduct = WhatsappProductCandidate;

export type MultiProductSegmentMatch = {
  segment: string;
  product: WhatsappCatalogProduct;
  score: number;
};

export type MultiProductResolveResult = {
  segments: string[];
  confident: MultiProductSegmentMatch[];
  ambiguous: Array<{ segment: string; candidates: WhatsappCatalogProduct[] }>;
  unresolved: string[];
  needsAttributes: MultiProductSegmentMatch[];
};

export type ProductVariantFamily = {
  baseLabel: string;
  baseKey: string;
  variants: WhatsappCatalogProduct[];
};

function titleCaseWords(s: string): string {
  return s
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

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

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

  groupProductsByCategory(
    products: WhatsappCatalogProduct[],
  ): Map<string, WhatsappCatalogProduct[]> {
    const available = products.filter((p) => p.availableNow !== false);
    const byCat = new Map<string, WhatsappCatalogProduct[]>();
    for (const p of available) {
      const key = p.categoryName || 'Otros';
      if (!byCat.has(key)) byCat.set(key, []);
      byCat.get(key)!.push(p);
    }
    return byCat;
  }

  /** Pregunta abierta sobre el menú (almuerzo, qué hay, recomiendan…). */
  isMenuExploreIntent(text: string, products: WhatsappCatalogProduct[] = []): boolean {
    const q = normalizeText(text);
    if (!q || q.length < 5) return false;

    if (
      /\b(link|enlace|url)\b/.test(q) ||
      /\b(pasa|dame|envia|manda|comparte)\b.*\b(menu|carta)\b/.test(q) ||
      /^(ver\s+)?(el\s+)?(menu|carta)(\s+completo)?$/.test(q)
    ) {
      return false;
    }

    if (this.extractCodeFromMessage(text) != null) return false;
    if (products.length && this.findProductEmbeddedInMessage(text, products)) return false;
    if (products.length && this.findByCategory(text, products)) return false;

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
    if (!explorePatterns.some((re) => re.test(q))) return false;

    const hasExploreQuestion = /\b(que|qué|hay|tienen|recomiend|categor|opciones|antoj)\b/.test(q);
    if (/\b(quiero|dame|necesito)\b/.test(q) && !hasExploreQuestion) return false;

    return true;
  }

  buildMenuExploreIntro(text: string): string {
    const q = normalizeText(text);
    if (/\balmuerzo\b/.test(q)) {
      return 'Para *almorzar* tenemos varias cosas ricas.';
    }
    if (/\bcena\b/.test(q)) return 'Para *cenar* también tenemos buenas opciones.';
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

  formatMenuCategoryOverview(
    products: WhatsappCatalogProduct[],
    opts?: { intro?: string; examplesPerCategory?: number; menuUrl?: string | null },
  ): { text: string; categories: string[] } {
    const examplesPerCategory = opts?.examplesPerCategory ?? 2;
    const byCat = this.groupProductsByCategory(products);
    const categories = [...byCat.keys()];
    const lines: string[] = [];
    const menuUrl = (opts?.menuUrl || '').trim();

    if (opts?.intro) {
      lines.push(opts.intro);
    }

    if (menuUrl) {
      lines.push(
        '',
        `Puedes conocer *todos nuestros productos* aquí:\n${menuUrl}`,
        '',
        'O si prefieres, te oriento por acá. Un resumen por categorías:',
      );
    } else if (opts?.intro) {
      lines.push('', 'Te dejo un resumen por categorías:');
    }

    lines.push('');

    categories.forEach((cat, idx) => {
      const list = byCat.get(cat)!;
      lines.push(`*${idx + 1}. ${cat}* (${list.length} ${list.length === 1 ? 'opción' : 'opciones'})`);
      for (const p of list.slice(0, examplesPerCategory)) {
        lines.push(`   • ${p.name} — $${Math.round(p.price).toLocaleString('es-CO')}`);
      }
      if (list.length > examplesPerCategory) {
        lines.push(`   _…y ${list.length - examplesPerCategory} más_`);
      }
      lines.push('');
    });

    lines.push(
      '¿Qué categoría te provoca? Escríbeme el *número* o el *nombre* (ej. *pollo*).',
      'Si ya sabes el plato, dime el *nombre* o *código* y te lo agrego.',
    );

    return { text: lines.join('\n').replace(/\n{3,}/g, '\n\n'), categories };
  }

  buildMenuCategoryContextForAi(products: WhatsappCatalogProduct[]): string {
    const { text } = this.formatMenuCategoryOverview(products, {
      intro: 'Resumen por categorías (orienta al cliente; NO vuelques todo el menú ni códigos en bloque):',
      examplesPerCategory: 2,
    });
    return text;
  }

  resolveCategoryBrowsePick(text: string, categories: string[]): string | null {
    const raw = text.trim();
    const lower = normalizeText(raw);
    if (!lower) return null;

    if (/^[1-9]\d{0,2}$/.test(raw)) {
      const n = parseInt(raw, 10);
      if (n >= 1 && n <= categories.length) return categories[n - 1];
    }

    let best: { name: string; score: number } | null = null;
    for (const cat of categories) {
      const c = normalizeText(cat);
      const cs = stemLoose(cat);
      let score = 0;
      if (lower === c || lower === cs) score = 100;
      else if (lower.includes(c) || c.includes(lower)) score = 85;
      else if (lower.includes(cs)) score = 75;
      else {
        for (const token of lower.split(' ').filter((t) => t.length >= 3)) {
          const ts = stemLoose(token);
          if (c === token || cs === ts || c.includes(token) || token.includes(c)) {
            score = Math.max(score, 70);
          }
        }
      }
      if (score >= 70 && (!best || score > best.score)) best = { name: cat, score };
    }
    return best?.name ?? null;
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
   * Quita muletillas y la parte de domicilio ("… para calle 10") para buscar producto.
   */
  extractProductSearchQuery(text: string): string {
    let q = text.trim();
    if (!q) return q;

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

  /** Quita porción/bebida del texto para buscar el producto base. */
  stripProductSearchNoise(query: string): string {
    return query
      .replace(
        /\s+con\s+(?:la\s+|el\s+|las?\s+|una\s+)?(?:gaseosa\s+(?:de\s+)?)?(?:manzana|coca\s*cola?|cola|sprite|pepsi|uva|postobon|postob[oó]n|litro\s*personal|personal|limonada|hit|mr\s*tea|cysco|agua|fresa|naranja|maracuya|maracuy[aá]|mango|poker|costena|coste[nñ]a)[\w\s]*/gi,
        '',
      )
      .replace(/^combo\s+de\s+/i, '')
      .replace(/^combo\s+/i, '')
      .replace(/\s+de\s+combo\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Limpia ruido coloquial dentro de un segmento de pedido. */
  cleanOrderSegment(segment: string): string {
    return segment
      .replace(/^(me\s+puedes\s+(?:enviar|mandar|traer|dar|regalar|poner)\s+)/i, '')
      .replace(/^(puedes\s+(?:enviarme|mandarme|traerme|darme)\s+)/i, '')
      .replace(/^(?:env[ií]ame|m[aá]ndame|tra[eé]me)\s+/i, '')
      .replace(/^(?:un|una|unos|unas|el|la|los|las)\s+/i, '')
      .replace(/\bde\s+con\b/gi, 'con')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Todos los productos cuyo nombre aparece en el mensaje (sin solaparse). */
  findAllProductsEmbeddedInMessage(
    text: string,
    products: WhatsappCatalogProduct[],
  ): WhatsappCatalogProduct[] {
    const q = normalizeText(text);
    if (!q || q.length < 4) return [];

    const available = products.filter((p) => p.availableNow !== false);
    const hits: Array<{
      p: WhatsappCatalogProduct;
      start: number;
      end: number;
      nameLen: number;
    }> = [];

    for (const p of available) {
      const name = normalizeText(p.name);
      if (name.length < 4) continue;
      let idx = 0;
      while ((idx = q.indexOf(name, idx)) !== -1) {
        hits.push({ p, start: idx, end: idx + name.length, nameLen: name.length });
        idx += 1;
      }
    }

    hits.sort((a, b) => b.nameLen - a.nameLen || a.start - b.start);

    const picked: WhatsappCatalogProduct[] = [];
    const ranges: Array<{ start: number; end: number }> = [];
    const usedIds = new Set<number>();

    for (const h of hits) {
      if (usedIds.has(h.p.id)) continue;
      const overlaps = ranges.some((r) => !(h.end <= r.start || h.start >= r.end));
      if (overlaps) continue;
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

  /** Mensaje con varios ítems unidos por "y" o coma. */
  looksLikeMultiItemOrderMessage(text: string): boolean {
    if (!/\s+\by\b\s+|\s*,\s*/i.test(text)) return false;
    if (this.isPriceInquiryIntent(text)) return false;
    return this.splitMultiProductSegments(text).length >= 2;
  }

  /**
   * Si el mensaje contiene el título exacto de un producto (ej. "arroz con pollo" dentro de la frase),
   * devuelve el match más específico (nombre más largo).
   */
  findProductEmbeddedInMessage(
    text: string,
    products: WhatsappCatalogProduct[],
  ): WhatsappCatalogProduct | null {
    const q = normalizeText(text);
    if (!q || q.length < 4) return null;

    const available = products.filter((p) => p.availableNow !== false);
    const hits: Array<{ p: WhatsappCatalogProduct; nameLen: number; tokenCount: number }> = [];

    for (const p of available) {
      const name = normalizeText(p.name);
      if (name.length < 4) continue;
      if (!q.includes(name)) continue;
      hits.push({
        p,
        nameLen: name.length,
        tokenCount: name.split(' ').filter((t) => t.length > 2).length,
      });
    }

    if (!hits.length) return null;
    hits.sort((a, b) => b.nameLen - a.nameLen || b.tokenCount - a.tokenCount);
    const best = hits[0];
    if (
      hits.length >= 2 &&
      hits[1].nameLen === best.nameLen &&
      hits[1].p.id !== best.p.id
    ) {
      return null;
    }
    return best.p;
  }

  private looksLikeDeliveryTail(tail: string): boolean {
    const t = normalizeText(tail);
    if (t.length < 5) return false;
    if (/\b(domicilio|delivery|la casa|mi casa|mi direccion)\b/.test(t)) return true;
    if (/\b(calle|carrera|cra|cll|av|avenida|barrio|conjunto|apto|apartamento|torre|#)\b/.test(t)) {
      return true;
    }
    return t.length >= 8 && /\d/.test(t);
  }

  /**
   * Si el mensaje pide una categoría (ej. "sopas", "qué bebidas tienen"),
   * devuelve TODOS los productos de esa categoría.
   * No debe dispararse cuando el cliente nombra un producto concreto
   * (ej. "arroz con pollo" ≠ categoría "Pollo").
   */
  findByCategory(
    query: string,
    products: WhatsappCatalogProduct[],
  ): { categoryName: string; products: WhatsappCatalogProduct[] } | null {
    const q = normalizeText(query);
    if (!q || q.length < 3) return null;

    // "… arroz con pollo para calle 10" → producto concreto, no categoría Pollo
    if (this.findProductEmbeddedInMessage(query, products)) return null;

    // Pedir el link/carta del menú ≠ pedir una categoría
    if (
      /\b(link|enlace|url)\b/.test(q) ||
      /\b(pasa|dame|envia|manda|comparte)\b.*\b(menu|carta)\b/.test(q) ||
      /^(ver\s+)?(el\s+)?(menu|carta)(\s+completo)?$/.test(q)
    ) {
      return null;
    }

    // "quiero hacer un pedido" no es categoría
    if (
      /\b(hacer|realizar)\s+(un\s+)?(pedido|orden)\b/.test(q) ||
      /\b(quiero|gustaria|quisiera)\s+(pedir|ordenar|hacer)\b/.test(q) ||
      (/\b(pedido|orden)\b/.test(q) &&
        !/\b(pollo|sopa|bebida|porcion|porciones|combo|alas)\b/.test(q) &&
        q.split(' ').length >= 3)
    ) {
      return null;
    }

    const available = products.filter((p) => p.availableNow !== false);
    const categoryNames = [
      ...new Set(available.map((p) => p.categoryName).filter(Boolean) as string[]),
    ];

    const significantTokens = q.split(' ').filter((t) => t.length >= 3);
    const isBrowseIntent =
      /\b(que|qué|tienen|hay|ver|lista|categoria|categoría|mostrame|muestrame|mostrar|opciones|recomiend|sugier|almuerzo|cena|antojo|platos|comer)\b/.test(
        q,
      );
    // "pollo" / "las sopas" → OK; "quiero un arroz con pollo para la 10" → NO
    const isShortCategoryQuery = significantTokens.length <= 2;

    let best: { categoryName: string; score: number } | null = null;

    for (const cat of categoryNames) {
      const c = normalizeText(cat);
      const cs = stemLoose(cat);
      let score = 0;

      if (q === c || q === cs) {
        score = 100;
      } else if (isShortCategoryQuery && (q.includes(c) || c.includes(q) || q.includes(cs))) {
        score = 85;
      } else if (isBrowseIntent) {
        if (q.includes(c) || q.includes(cs) || c.includes(q)) score = 80;
        else {
          for (const t of significantTokens) {
            const ts = stemLoose(t);
            if (c === t || cs === ts || (t.length >= 4 && (c.includes(t) || t.includes(c)))) {
              score = Math.max(score, 70);
            }
          }
        }
      }

      // "ahora pollo", "pregunto por carne" (sin ver/lista explícito)
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
          if (SKIP.has(t)) continue;
          const ts = stemLoose(t);
          if (c === t || cs === ts || (t.length >= 4 && (c.includes(t) || t.includes(c)))) {
            score = Math.max(score, 72);
          }
        }
      }

      // Frase larga de pedido sin intención de “ver categoría”: no matchear
      // solo porque incluye la palabra de la categoría (pollo dentro de “arroz con pollo”).

      if (score >= 70 && isBrowseIntent) score += 10;

      if (score >= 70 && (!best || score > best.score)) {
        best = { categoryName: cat, score };
      }
    }

    if (!best) return null;

    const list = available.filter((p) => p.categoryName === best!.categoryName);
    if (!list.length) return null;
    return { categoryName: best.categoryName, products: list };
  }

  /** Busca categoría en texto crudo y en versión sin muletillas de pedido. */
  findCategoryBrowseHit(
    text: string,
    products: WhatsappCatalogProduct[],
    menuConceptGroups?: MenuConceptGroup[],
  ): { categoryName: string; products: WhatsappCatalogProduct[] } | null {
    const trimmed = text.trim();
    if (!trimmed) return null;
    const extracted = this.extractProductSearchQuery(trimmed);
    const queries = extracted !== trimmed ? [extracted, trimmed] : [extracted];

    for (const q of queries) {
      const byCat = this.findByCategory(q, products);
      if (byCat) return byCat;
    }

    for (const q of queries) {
      const byConcept = findByMenuConcept(q, products, menuConceptGroups);
      if (byConcept) {
        return { categoryName: byConcept.categoryName, products: byConcept.products };
      }
    }

    return null;
  }

  searchByName(query: string, products: WhatsappCatalogProduct[], limit = 8): WhatsappCatalogProduct[] {
    return this.searchByNameScored(query, products, limit).map((x) => x.p);
  }

  /** Igual que searchByName pero con score (para priorizar vs categoría). */
  searchByNameScored(
    query: string,
    products: WhatsappCatalogProduct[],
    limit = 8,
  ): Array<{ p: WhatsappCatalogProduct; score: number }> {
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

    // Si tras quitar stopwords no queda nada útil, no buscar
    if (!tokens.length && (STOP.has(q) || q === 'menu' || q === 'carta')) return [];

    const wordHas = (hay: string, needle: string) => {
      if (!needle) return false;
      // Evitar que "menu" matchee "menudencias"
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
        if (name === q) score += 120;

        // Título del producto contenido en la frase (aunque sea larga: "... arroz con pollo para ...")
        if (name.length >= 5 && q.includes(name)) {
          score += 95;
        }

        // Cobertura de tokens del título (arroz + pollo → producto "Arroz con pollo")
        const nameTokens = name
          .split(' ')
          .map((t) => t.trim())
          .filter((t) => t.length > 2 && !STOP.has(t));
        if (nameTokens.length >= 2) {
          const hits = nameTokens.filter((t) => wordHas(q, t) || q.includes(t)).length;
          if (hits === nameTokens.length) score += 85;
          else if (hits >= Math.ceil(nameTokens.length * 0.75)) score += 40;
        } else if (nameTokens.length === 1) {
          if (wordHas(q, nameTokens[0])) score += 35;
        }

        // Query corta tipo producto
        if (q.length >= 4 && q.split(' ').length <= 4) {
          if (wordHas(name, q) || wordHas(name, qStem)) score += 50;
          if (q.includes(name) && name.length > 3) score += 40;
        }

        if (tokens.length) {
          for (const t of tokens) {
            const ts = stemLoose(t);
            if (wordHas(name, t) || wordHas(name, ts)) score += 18;
            else if (name.includes(t) && t.length >= 5) score += 10;
            if (wordHas(desc, t) || (desc.includes(t) && t.length >= 5)) score += 4;
            if (wordHas(cat, t)) score += 6;
          }
        }

        // Preferir títulos más específicos (más tokens) cuando empatan
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

  /** Match fuerte de producto (priorizar sobre listar categoría). */
  isStrongProductMatch(scored: Array<{ p: WhatsappCatalogProduct; score: number }>): boolean {
    if (!scored.length) return false;
    const top = scored[0].score;
    if (top >= 80) return true;
    if (scored.length === 1 && top >= 50) return true;
    if (scored.length >= 2 && top >= 70 && top - scored[1].score >= 25) return true;
    return false;
  }

  /** Pregunta por precio, no por pedir: "¿cuánto vale un pollo frito?" */
  isPriceInquiryIntent(text: string): boolean {
    const raw = text.trim();
    const q = normalizeText(raw);
    if (!q) return false;

    const hasPriceAsk =
      /\b(cuanto vale|cuanto cuesta|cuanto sale|cuanto esta|cuanto cobran|cuanto seria|cuanto costaria|a cuanto|que precio|precio de|precio del|precio tiene|precio por|valor de|me costaria|cuanto me sale)\b/.test(
        q,
      ) ||
      (/\b(cuanto|precio|valor|cuesta)\b/.test(q) && /\?/.test(raw));

    if (!hasPriceAsk) return false;

    const orderDominant =
      /^(quiero|dame|ponme|agrega|agregame|me das|me regalas|voy a pedir)\s+(un|una|unos|unas|el|la|los|las)\s+/i.test(
        raw,
      ) && !/\b(cuanto|precio|vale|cuesta|valor)\b/i.test(raw);

    return !orderDominant;
  }

  /** Quita muletillas de consulta de precio para buscar el producto. */
  stripPriceInquiryNoise(text: string): string {
    return text
      .replace(
        /\b(cu[aá]nto vale|cu[aá]nto cuesta|cu[aá]nto sale|cu[aá]nto est[aá]|cu[aá]nto cobran|cu[aá]nto ser[ií]a|cu[aá]nto costar[ií]a|a cu[aá]nto|qu[eé] precio|precio de(l| la| los| las)?|precio tiene|precio por|valor de(l| la| los| las)?|cu[aá]nto me sale|me costar[ií]a)\b/gi,
        ' ',
      )
      .replace(/\b(cu[aá]nto|precio|valor|cuesta|cobran)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Respuesta informativa de precio — NO inicia flujo de pedido ni pide elegir opción. */
  formatProductPriceReply(product: WhatsappCatalogProduct): string {
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

  /**
   * Muestra porciones/opciones — una sola pregunta, formato tabla.
   */
  formatProductVariantsOverview(
    product: WhatsappCatalogProduct,
    mode: 'info' | 'order' = 'info',
    alreadySelected: { attributeName: string; attributeValue: string }[] = [],
  ): string {
    const remaining = this.getRemainingAttributes(product, alreadySelected);
    const next = remaining[0];

    if (mode === 'info') {
      const infoAttrs = remaining.filter((a) => !this.isComboOnlyAttribute(a));
      if (!infoAttrs.length && (product.attributes || []).some((a) => this.isComboOnlyAttribute(a))) {
        return (
          `*${product.name}* — precio base $${Math.round(product.price).toLocaleString('es-CO')}.\n\n` +
          `_Si pides *combo*, después eliges las gaseosas._\n\n` +
          `_Dime cuál porción te interesa o si quieres pedir._`
        );
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

  /** Tabla compacta para WhatsApp (monoespaciado). */
  formatOptionsTable(
    rows: Array<{ index: number; label: string; price: number; code?: number }>,
  ): string {
    const labelWidth = Math.min(
      26,
      Math.max(10, ...rows.map((r) => r.label.length)),
    );
    const lines: string[] = [
      '```',
      `${'#'.padEnd(3)} ${'Opción'.padEnd(labelWidth)} Precio`,
      '─'.repeat(labelWidth + 16),
    ];
    for (const r of rows) {
      const label =
        r.label.length > labelWidth ? `${r.label.slice(0, labelWidth - 1)}…` : r.label;
      const price = `$${Math.round(r.price).toLocaleString('es-CO')}`;
      lines.push(`${String(r.index).padEnd(3)} ${label.padEnd(labelWidth)} ${price}`);
    }
    lines.push('```');
    return lines.join('\n');
  }

  /** Una sola pregunta por atributo (porción, gaseosa…). */
  formatAttributeStepPrompt(
    product: WhatsappCatalogProduct,
    attr: { attributeName: string; options: string[] },
    alreadySelected: { attributeName: string; attributeValue: string }[] = [],
    opts?: { mode?: 'info' | 'order'; skipHeader?: boolean },
  ): string {
    const rows = attr.options.map((opt, i) => ({
      index: i + 1,
      label: opt,
      price: product.price,
    }));
    const parts: string[] = [];

    if (!opts?.skipHeader) {
      parts.push(`*${product.name}* (cód. ${product.code})`);
    }

    if (alreadySelected.length) {
      parts.push(
        `✅ ${alreadySelected.map((s) => s.attributeValue).join(' · ')}`,
      );
    }

    const question = this.isComboOnlyAttribute(attr)
      ? `¿Qué *${attr.attributeName}* lleva tu combo?`
      : `¿Qué *${attr.attributeName}* prefieres?`;

    parts.push(question);
    parts.push(this.formatOptionsTable(rows));

    if (opts?.mode === 'info') {
      parts.push('_Dime el número o el nombre si quieres pedir._');
    } else {
      parts.push('Responde con el *número* o el *nombre* de la opción.');
    }

    return parts.filter(Boolean).join('\n\n');
  }

  /** Base del nombre sin sufijos solo/combo/gaseosa… */
  getProductNameBase(name: string): string {
    return normalizeText(name)
      .replace(
        /\b(solo|sola|completo|completa|combo|con\s+gaseosa|con\s+bebida|sin\s+gaseosa|sin\s+bebida|mas\s+gaseosa|y\s+gaseosa)\b/g,
        ' ',
      )
      .replace(/\s+/g, ' ')
      .trim();
  }

  getVariantDisplayLabel(fullName: string, baseKey: string): string {
    const n = normalizeText(fullName);
    const tail = n.replace(baseKey, '').trim();
    if (/\bsolo\b/.test(tail) || /\bsola\b/.test(tail)) return 'Solo (sin combo/bebida)';
    if (/\bcombo\b/.test(tail)) return 'Combo (con bebida)';
    if (/\b(completo|completa)\b/.test(tail)) return 'Completo (con bebida)';
    if (/\b(con\s+gaseosa|con\s+bebida|gaseosa|bebida)\b/.test(tail)) {
      return 'Con gaseosa / bebida';
    }
    if (tail.length >= 3) return titleCaseWords(tail);
    return fullName;
  }

  /**
   * Detecta familia de productos: "arroz paisa" → solo vs con gaseosa/combo.
   */
  findProductVariantFamily(
    query: string,
    products: WhatsappCatalogProduct[],
    hints: WhatsappCatalogProduct[] = [],
  ): ProductVariantFamily | null {
    const q = normalizeText(this.extractProductSearchQuery(query));
    if (q.length < 4) return null;

    const available = products.filter((p) => p.availableNow !== false);
    const scored = this.searchByNameScored(q, available, 12).filter((x) => x.score >= 38);
    const seed = [
      ...hints,
      ...scored.map((x) => x.p),
    ];
    if (!seed.length) return null;

    let bestBase = '';
    let bestCount = 0;
    const baseCounts = new Map<string, number>();
    for (const p of seed) {
      const base = this.getProductNameBase(p.name);
      if (base.length < 4) continue;
      baseCounts.set(base, (baseCounts.get(base) || 0) + 1);
      if ((baseCounts.get(base) || 0) > bestCount) {
        bestCount = baseCounts.get(base) || 0;
        bestBase = base;
      }
    }

    if (!bestBase) return null;

    const queryHitsBase =
      q.includes(bestBase) ||
      bestBase.includes(q) ||
      q.split(' ').filter((t) => t.length >= 4).every((t) => bestBase.includes(t));

    if (!queryHitsBase && bestCount < 2) return null;

    const variants = available.filter((p) => {
      const base = this.getProductNameBase(p.name);
      const name = normalizeText(p.name);
      return base === bestBase || (name.includes(bestBase) && base.length >= 4);
    });

    if (variants.length < 2) return null;

    const hasVariantCue = variants.some((p) =>
      /\b(solo|sola|combo|completo|completa|gaseosa|bebida)\b/i.test(p.name),
    );
    if (!hasVariantCue && !variants.some((p) => p.hasAttributes)) return null;

    const uniq = new Map<number, WhatsappCatalogProduct>();
    for (const v of variants) uniq.set(v.id, v);
    const sorted = [...uniq.values()].sort((a, b) => {
      const rank = (n: string) => {
        const x = normalizeText(n);
        if (/\bsolo\b/.test(x)) return 0;
        if (/\bcombo\b/.test(x)) return 1;
        if (/\b(completo|gaseosa|bebida)\b/.test(x)) return 2;
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

  pickVariantFromFamilyText(
    text: string,
    family: ProductVariantFamily,
  ): WhatsappCatalogProduct | null {
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
      return (
        family.variants.find((p) =>
          /\b(combo|completo|completa|gaseosa|bebida)\b/.test(normalizeText(p.name)),
        ) || null
      );
    }
    return null;
  }

  formatVariantFamilyPrompt(family: ProductVariantFamily): string {
    const rows = family.variants.map((p, i) => ({
      index: i + 1,
      label: this.getVariantDisplayLabel(p.name, family.baseKey),
      price: p.price,
      code: p.code,
    }));
    return (
      `Para *${family.baseLabel}*, ¿cómo lo quieres?\n\n` +
      `${this.formatOptionsTable(rows)}\n\n` +
      `Responde con el *número* o escribe *solo* / *combo*.`
    );
  }

  /** Atributos que faltan por elegir (respeta reglas tipo combo → gaseosas). */
  getRemainingAttributes(
    product: WhatsappCatalogProduct,
    alreadySelected: { attributeName: string; attributeValue: string }[] = [],
  ): NonNullable<WhatsappCatalogProduct['attributes']> {
    return (product.attributes || []).filter((attr) => {
      if (alreadySelected.some((s) => s.attributeName === attr.attributeName)) return false;
      if (this.isComboOnlyAttribute(attr) && !this.hasComboPortionSelected(alreadySelected)) {
        return false;
      }
      return true;
    });
  }

  /** Gaseosas/bebidas del combo: solo después de elegir porción combo. */
  isComboOnlyAttribute(attr: { attributeName: string }): boolean {
    const n = normalizeText(attr.attributeName);
    return /\b(gaseosa|gaseosas|bebida|bebidas|refresco|refrescos)\b/.test(n);
  }

  hasComboPortionSelected(
    alreadySelected: { attributeName: string; attributeValue: string }[],
  ): boolean {
    return alreadySelected.some((s) => /\bcombo\b/.test(normalizeText(s.attributeValue)));
  }

  /** Oculta notas de combo/gaseosas hasta que aplique ese paso. */
  formatDescriptionForAttributeStep(
    description: string | null | undefined,
    alreadySelected: { attributeName: string; attributeValue: string }[],
    nextAttr?: { attributeName: string },
  ): string | null {
    if (!description?.trim()) return null;

    const showComboNotes =
      this.hasComboPortionSelected(alreadySelected) ||
      (nextAttr != null && this.isComboOnlyAttribute(nextAttr));

    if (showComboNotes) return description.trim();

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

  /** Consulta informativa: precio, qué hay, opciones — sin pedir porción concreta aún. */
  isGenericProductInquiry(text: string): boolean {
    if (this.isPriceInquiryIntent(text)) return true;
    const raw = text.trim();
    const q = normalizeText(raw);
    return (
      /\?$/.test(raw) &&
      /\b(cuanto|precio|valor|cuesta|cobran|sale|tienen|hay|opciones|que hay|informacion|info)\b/.test(
        q,
      )
    );
  }

  /** Query corta tipo concepto: "pollo", "sopa", "carne". */
  isShortGenericFoodQuery(query: string): boolean {
    const q = normalizeText(this.extractProductSearchQuery(query));
    const tokens = q.split(' ').filter((t) => t.length >= 3);
    return tokens.length === 1;
  }

  /** ¿El cliente ya nombró variante(s) en el mensaje (medio, combo, manzana…)? */
  extractExplicitAttributeChoice(
    text: string,
    product: WhatsappCatalogProduct,
  ): { attributeName: string; attributeValue: string }[] | null {
    const step = this.resolveAttributesFromMessage(product, text, []);
    if (step.status === 'complete') return step.attributes;
    return null;
  }

  /** Producto con variantes pero el cliente no dijo cuál → mostrar todas, no asumir "medio". */
  shouldShowVariantsOverview(text: string, product: WhatsappCatalogProduct): boolean {
    if (!product.hasAttributes || !product.attributes?.length) return false;
    if (this.extractExplicitAttributeChoice(text, product)) return false;
    if (this.isGenericProductInquiry(text)) return true;

    const q = normalizeText(this.stripPriceInquiryNoise(this.extractProductSearchQuery(text)));
    for (const attr of product.attributes) {
      for (const opt of attr.options) {
        const o = normalizeText(opt);
        if (o.length >= 4 && q.includes(o)) return false;
      }
    }
    return true;
  }

  formatPriceInquiryList(products: WhatsappCatalogProduct[]): string {
    const body = products.map((p, i) => this.formatProductListItem(p, i + 1)).join('\n\n');
    return (
      `Estas son las opciones relacionadas:\n\n${body}\n\n` +
      `¿Cuál te interesa? Dime el *número* o el *nombre*.`
    );
  }

  /**
   * Parte un mensaje con varios platos: "sopa de mondongo, cuarto de pollo y costillas".
   */
  splitMultiProductSegments(text: string): string[] {
    let q = this.extractProductSearchQuery(text);
    if (!q) return [];

    const byCommaOrY = q
      .split(/\s*,\s*|\s+\by\b\s+/i)
      .map((s) => this.cleanOrderSegment(s.trim()))
      .filter((s) => s.length >= 3);

    const expanded: string[] = [];
    for (const chunk of byCommaOrY.length ? byCommaOrY : [q]) {
      expanded.push(...this.splitSegmentOnArticles(chunk));
    }

    const seen = new Set<string>();
    const out: string[] = [];
    for (const seg of expanded) {
      const cleaned = this.cleanOrderSegment(
        seg.replace(/\s+(por favor|porfa|pf|gracias)[\s!.?]*$/i, '').trim(),
      );
      if (cleaned.length < 3) continue;
      const key = normalizeText(cleaned);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(cleaned);
    }
    return out;
  }

  private splitSegmentOnArticles(chunk: string): string[] {
    const parts = chunk
      .split(/\s+(?=(?:un|una|unos|unas|el|la|los|las)\s+)/i)
      .map((s) => s.trim())
      .filter((s) => s.length >= 3);
    return parts.length ? parts : [chunk.trim()].filter((s) => s.length >= 3);
  }

  /**
   * Resuelve varios productos nombrados en un solo mensaje.
   * Devuelve null si no parece un pedido multi-ítem.
   */
  resolveMultiProductOrder(
    text: string,
    products: WhatsappCatalogProduct[],
  ): MultiProductResolveResult | null {
    if (this.isPriceInquiryIntent(text)) return null;
    if (this.isMenuExploreIntent(text, products)) return null;

    const segments = this.splitMultiProductSegments(text);
    const embeddedAll = this.findAllProductsEmbeddedInMessage(text, products);

    if (embeddedAll.length >= 2) {
      const confident: MultiProductSegmentMatch[] = [];
      const needsAttributes: MultiProductSegmentMatch[] = [];
      for (const product of embeddedAll) {
        const segment =
          segments.find((s) => normalizeText(s).includes(normalizeText(product.name))) ||
          product.name;
        const match = { segment, product, score: 100 };
        if (product.hasAttributes && product.attributes?.length) {
          const explicit = this.extractExplicitAttributeChoice(segment, product);
          if (explicit) confident.push(match);
          else needsAttributes.push(match);
        } else {
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

    if (segments.length < 2) return null;

    const confident: MultiProductSegmentMatch[] = [];
    const ambiguous: Array<{ segment: string; candidates: WhatsappCatalogProduct[] }> = [];
    const unresolved: string[] = [];
    const needsAttributes: MultiProductSegmentMatch[] = [];
    const usedProductIds = new Set<number>();

    for (const rawSegment of segments) {
      const segment = this.cleanOrderSegment(rawSegment);
      const embedded = this.findProductEmbeddedInMessage(segment, products);
      if (embedded) {
        if (usedProductIds.has(embedded.id)) continue;
        usedProductIds.add(embedded.id);
        const match = { segment, product: embedded, score: 100 };
        if (embedded.hasAttributes && embedded.attributes?.length) {
          if (this.extractExplicitAttributeChoice(segment, embedded)) confident.push(match);
          else needsAttributes.push(match);
        } else confident.push(match);
        continue;
      }

      const query = this.extractProductSearchQuery(segment);
      const scored = this.searchByNameScored(query, products, 5);
      if (!scored.length) {
        unresolved.push(segment);
        continue;
      }

      // Segmentos tipo "ejecutivo con pierna..." → priorizar productos con "ejecutivo" en el nombre
      const segNorm = normalizeText(segment);
      if (/\bejecutivo\b/.test(segNorm)) {
        const ejecutivoHits = scored.filter((x) => normalizeText(x.p.name).includes('ejecutivo'));
        if (ejecutivoHits.length === 1) {
          const top = ejecutivoHits[0];
          if (!usedProductIds.has(top.p.id)) {
            usedProductIds.add(top.p.id);
            const match = { segment, product: top.p, score: top.score };
            if (top.p.hasAttributes && top.p.attributes?.length) {
              if (this.extractExplicitAttributeChoice(segment, top.p)) confident.push(match);
              else needsAttributes.push(match);
            } else confident.push(match);
            continue;
          }
        }
      }

      if (this.isStrongProductMatch(scored)) {
        const top = scored[0];
        if (usedProductIds.has(top.p.id)) continue;
        usedProductIds.add(top.p.id);
        const match = { segment, product: top.p, score: top.score };
        if (top.p.hasAttributes && top.p.attributes?.length) {
          if (this.extractExplicitAttributeChoice(segment, top.p)) confident.push(match);
          else needsAttributes.push(match);
        } else confident.push(match);
        continue;
      }

      if (scored.length >= 2 && scored[0].score >= 35) {
        ambiguous.push({ segment, candidates: scored.slice(0, 4).map((x) => x.p) });
      } else if (scored.length === 1 && scored[0].score >= 40) {
        const top = scored[0];
        if (usedProductIds.has(top.p.id)) continue;
        usedProductIds.add(top.p.id);
        const match = { segment, product: top.p, score: top.score };
        if (top.p.hasAttributes && top.p.attributes?.length) {
          if (this.extractExplicitAttributeChoice(segment, top.p)) confident.push(match);
          else needsAttributes.push(match);
        } else confident.push(match);
      } else {
        unresolved.push(segment);
      }
    }

    const resolvedCount = confident.length + ambiguous.length + needsAttributes.length;
    if (segments.length >= 2 && (resolvedCount >= 1 || unresolved.length > 0)) {
      return { segments, confident, ambiguous, unresolved, needsAttributes };
    }
    if (resolvedCount < 2) return null;

    return { segments, confident, ambiguous, unresolved, needsAttributes };
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
      `*${categoryName}* — ${list.length} ${list.length === 1 ? 'opción' : 'opciones'}:\n\n` +
      `${body}\n\n` +
      `Respóndeme con el *número* o el *código* del que quieras.`
    );
  }

  /** Texto para pedir atributos — una pregunta, formato tabla. */
  formatProductOptionsPrompt(
    product: WhatsappCatalogProduct,
    alreadySelected: { attributeName: string; attributeValue: string }[] = [],
  ): string {
    const remaining = this.getRemainingAttributes(product, alreadySelected);
    const next = remaining[0];
    if (!product.hasAttributes || !product.attributes?.length || !next) {
      return `*${product.name}* (cód. ${product.code})`;
    }
    return this.formatAttributeStepPrompt(product, next, alreadySelected, { mode: 'order' });
  }

  /**
   * Resuelve todas las opciones que el cliente nombró en un mensaje
   * (ej. "combo de pollo frito con manzana" → combo + gaseosa).
   */
  resolveAttributesFromMessage(
    product: WhatsappCatalogProduct,
    text: string,
    alreadySelected: { attributeName: string; attributeValue: string }[] = [],
  ):
    | { status: 'complete'; attributes: { attributeName: string; attributeValue: string }[] }
    | { status: 'partial'; attributes: { attributeName: string; attributeValue: string }[] }
    | { status: 'invalid' } {
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
        if (!picked) continue;
        selected = [...selected, { attributeName: attr.attributeName, attributeValue: picked }];
        progress = true;
        break;
      }
    }

    const stillRemaining = this.getRemainingAttributes(product, selected);
    if (!stillRemaining.length) return { status: 'complete', attributes: selected };
    if (selected.length > alreadySelected.length) {
      return { status: 'partial', attributes: selected };
    }
    return { status: 'invalid' };
  }

  /** Encuentra una opción de atributo mencionada en texto libre. */
  pickAttributeOptionFromText(
    text: string,
    attr: { attributeName: string; options: string[] },
  ): string | null {
    const q = normalizeText(text);
    if (!q) return null;

    if (this.isComboOnlyAttribute(attr)) {
      const conMatch = q.match(
        /\bcon\s+(?:la\s+|el\s+|las?\s+|una\s+)?(?:gaseosa\s+(?:de\s+)?)?([a-z0-9\s]{3,40})/,
      );
      if (conMatch?.[1]) {
        const tail = normalizeText(conMatch[1]);
        for (const opt of attr.options) {
          const o = normalizeText(opt);
          if (tail.includes(o) || o.includes(tail)) return opt;
          const tailTokens = tail.split(' ').filter((t) => t.length >= 3);
          for (const tok of tailTokens) {
            if (o.includes(tok) && tok.length >= 4) return opt;
            if (
              tok.length >= 4 &&
              o.split(' ').some((part) => part.startsWith(tok) || tok.startsWith(part))
            ) {
              return opt;
            }
          }
        }
      }
    }

    for (const opt of attr.options) {
      const o = normalizeText(opt);
      if (o.length >= 3 && (q === o || q.includes(o))) return opt;
    }

    if (/\bcombo\b/.test(q)) {
      const comboOpt = attr.options.find((o) => normalizeText(o).includes('combo'));
      if (comboOpt) return comboOpt;
    }

    const portionHints: Array<{ re: RegExp; needle: string }> = [
      { re: /\b(medio|media)\b/, needle: 'medio' },
      { re: /\b(cuarto|cuarta)\b/, needle: 'cuarto' },
      { re: /\b(entero|entera|unidad)\b/, needle: 'entero' },
      { re: /\b(uno|una)\b/, needle: 'uno' },
    ];
    for (const hint of portionHints) {
      if (!hint.re.test(q)) continue;
      const hit = attr.options.find((o) => normalizeText(o).includes(hint.needle));
      if (hit) return hit;
    }

    for (const opt of attr.options) {
      const o = normalizeText(opt);
      for (const token of o.split(' ').filter((t) => t.length >= 3)) {
        if (['pollo', 'frito', 'broaster', 'pechuga', 'gaseosa', 'combo'].includes(token)) {
          continue;
        }
        const re = new RegExp(`(?:^|\\s)${escapeRegExp(token)}(?:\\s|$)`);
        if (re.test(q)) return opt;
      }
    }

    return null;
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
      return { status: 'complete', attributes: alreadySelected };
    }

    const fromMessage = this.resolveAttributesFromMessage(product, text, alreadySelected);
    if (fromMessage.status !== 'invalid') return fromMessage;

    const remaining = this.getRemainingAttributes(product, alreadySelected);
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
      picked = this.pickAttributeOptionFromText(text, attr);
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

    if (!this.getRemainingAttributes(product, nextSelected).length) {
      return { status: 'complete', attributes: nextSelected };
    }
    return { status: 'partial', attributes: nextSelected };
  }

  /** Intenta resolver opciones de atributos desde texto libre del cliente (legacy / todo de una vez) */
  resolveAttributesFromText(
    product: WhatsappCatalogProduct,
    text: string,
  ): { attributeName: string; attributeValue: string }[] | null {
    const step = this.resolveAttributesFromMessage(product, text, []);
    if (step.status === 'complete') return step.attributes;
    if (step.status === 'partial') return null;
    return null;
  }
}
