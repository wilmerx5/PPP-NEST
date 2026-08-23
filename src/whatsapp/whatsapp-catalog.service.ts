import { Injectable } from '@nestjs/common';
import { ProductsService } from '../products/products.service';
import type { WhatsappProductCandidate } from './types/whatsapp-session.types';
import { findByMenuConcept, type MenuConceptGroup } from './whatsapp-menu-concepts';

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
      .replace(/^(quisiera|gustaria|deseo|necesito|dame|me das|me gustaria)\s+/i, '')
      .replace(/^(quiero|voy a pedir)\s+(un|una|unos|unas|el|la|los|las)?\s*/i, '')
      .replace(/\s+(por favor|porfa|pf|gracias)[\s!.?]*$/i, '')
      .trim();

    return q || text.trim();
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
