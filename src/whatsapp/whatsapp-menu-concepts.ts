import type { WhatsappProductCandidate } from './types/whatsapp-session.types';

export type MenuConceptGroup = {
  id: string;
  label: string;
  /** Palabras que el cliente puede decir: carne, sopas, etc. */
  triggers: string[];
  /** Palabras en nombre/descripción del producto para incluirlo en el grupo */
  productKeywords: string[];
  enabled?: boolean;
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Match de palabra completa / stem — evita que "res" matchee dentro de "restaurante".
 */
function hasWholeWordOrStem(haystack: string, needle: string): boolean {
  const h = normalizeText(haystack);
  const n = normalizeText(needle);
  if (!h || !n || n.length < 2) return false;
  if (h === n) return true;
  const nStem = stemLoose(n);
  // Triggers cortos (res, lomo…): solo frontera de palabra
  if (n.length <= 4) {
    const re = new RegExp(`(?:^|\\s)${escapeRegExp(n)}(?:\\s|$)`);
    const reStem =
      nStem !== n && nStem.length >= 3
        ? new RegExp(`(?:^|\\s)${escapeRegExp(nStem)}(?:\\s|$)`)
        : null;
    return re.test(h) || (!!reStem && reStem.test(h));
  }
  if (new RegExp(`(?:^|\\s)${escapeRegExp(n)}(?:\\s|$)`).test(h)) return true;
  if (
    nStem.length >= 5 &&
    new RegExp(`(?:^|\\s)${escapeRegExp(nStem)}(?:\\s|$)`).test(h)
  ) {
    return true;
  }
  // Substring solo si el needle es largo (p. ej. "sobrebarriga" dentro de una frase)
  if (n.length >= 6 && h.includes(n)) return true;
  return false;
}

/** ¿El token del mensaje corresponde al trigger? Sin substrings sueltos. */
function tokenMatchesTrigger(token: string, trigger: string): boolean {
  const t = normalizeText(token);
  const tr = normalizeText(trigger);
  if (!t || !tr) return false;
  if (t === tr) return true;
  const ts = stemLoose(t);
  const trs = stemLoose(tr);
  if (ts === trs) return true;
  // "res" ⊂ "restaurante" → NO
  if (tr.length <= 4 || t.length <= 4) return false;
  const ratio = Math.min(t.length, tr.length) / Math.max(t.length, tr.length);
  if (ratio < 0.75) return false;
  return t.includes(tr) || tr.includes(t) || ts.includes(trs) || trs.includes(ts);
}

/** Conceptos por defecto (Colombia / restaurante). El admin puede ampliar vía JSON. */
export const DEFAULT_MENU_CONCEPTS: MenuConceptGroup[] = [
  {
    id: 'carne',
    label: 'Carne',
    triggers: ['carne', 'carnes', 'res', 'cerdo', 'bistec', 'lomo', 'asado', 'vacuno'],
    productKeywords: [
      'churrasco',
      'sobrebarriga',
      'sobre barriga',
      'bistec',
      'lomo',
      'punta',
      'posta',
      'carne',
      'res',
      'pechuga de res',
      'higado',
      'hígado',
    ],
  },
  {
    id: 'pollo',
    label: 'Pollo',
    triggers: ['pollo', 'pollos', 'broaster', 'asado'],
    productKeywords: ['pollo', 'broaster', 'pechuga', 'ala', 'alas', 'entero', 'medio', 'cuarto'],
  },
  {
    id: 'sopa',
    label: 'Sopas',
    triggers: ['sopa', 'sopas', 'caldo', 'caldos'],
    productKeywords: ['sopa', 'caldo', 'consome', 'consomé', 'cazuela'],
  },
  {
    id: 'arroz',
    label: 'Arroz',
    triggers: ['arroz', 'chino', 'paisa'],
    productKeywords: ['arroz', 'chino', 'paisa', 'cantones'],
  },
  {
    id: 'pescado',
    label: 'Pescado',
    triggers: ['pescado', 'pescados', 'marisco', 'mariscos', 'mojarra', 'trucha', 'bagre'],
    productKeywords: ['mojarra', 'trucha', 'bagre', 'pescado', 'filete', 'tilapia'],
  },
  {
    id: 'bebida',
    label: 'Bebidas',
    triggers: [
      'bebida',
      'bebidas',
      'gaseosa',
      'gaseosas',
      'refresco',
      'refrescos',
      'jugo',
      'jugos',
      'limonada',
      'limonadas',
      'malta',
      'agua',
      'cerveza',
    ],
    productKeywords: [
      'gaseosa',
      'coca',
      'sprite',
      'pepsi',
      'postobon',
      'limonada',
      'jugo',
      'malta',
      'agua',
      'te',
      'té',
      'cerveza',
      'hit',
      'mr tea',
      'cysco',
    ],
  },
];

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
  // No cortar días / -antes / -entes: "lunes"↛"lun", "restaurantes"→"restaurante"
  if (/(antes|entes|iones|unes|artes|ueves|iernes|abados|omingos)$/.test(n)) {
    if (n.length > 3 && n.endsWith('s') && !n.endsWith('es')) return n.slice(0, -1);
    if (n.length > 4 && n.endsWith('es') && /(antes|entes|iones)$/.test(n)) {
      return n.slice(0, -1); // restaurantes → restaurante
    }
    return n;
  }
  // Plural simple: sopas→sopa, pollos→pollo
  if (n.length > 3 && n.endsWith('s') && !n.endsWith('es')) return n.slice(0, -1);
  // "carnes"→"carne", "flores"→"flor": preferir -s cuando queda vocal+consonante típica
  // (evitar "carnes"→"carn" que rompe match con "carne")
  if (n.length > 4 && n.endsWith('es')) {
    const minusS = n.slice(0, -1);
    if (/(ne|re|le|de|se|te|pe)$/.test(minusS)) return minusS;
    return n.slice(0, -2);
  }
  return n;
}

function titleCaseWords(s: string): string {
  return s
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Triggers genéricos del concepto (muestran todo el grupo). */
const BROAD_CONCEPT_TRIGGERS: Record<string, string[]> = {
  bebida: ['bebida', 'bebidas'],
  pollo: ['pollo', 'pollos'],
  sopa: ['sopa', 'sopas', 'caldo', 'caldos'],
  carne: ['carne', 'carnes'],
  arroz: ['arroz'],
};

function isBroadConceptTrigger(concept: MenuConceptGroup, trigger: string): boolean {
  const t = stemLoose(trigger);
  const label = stemLoose(concept.label);
  if (t === label) return true;
  const broad = BROAD_CONCEPT_TRIGGERS[concept.id] || [label];
  return broad.some((b) => stemLoose(b) === t);
}

function getMatchedConceptTriggers(q: string, concept: MenuConceptGroup): string[] {
  const matched: string[] = [];
  for (const trigger of concept.triggers) {
    const t = normalizeText(trigger);
    if (!t || t.length < 3) continue;
    if (q === t || hasWholeWordOrStem(q, t)) {
      matched.push(t);
      continue;
    }
    for (const token of q.split(' ').filter((x) => x.length >= 3)) {
      if (tokenMatchesTrigger(token, t)) {
        matched.push(t);
      }
    }
  }
  return [...new Set(matched)];
}

function filterProductsByConceptTriggers(
  products: WhatsappProductCandidate[],
  triggers: string[],
): WhatsappProductCandidate[] {
  const needles = [...new Set(triggers.map((t) => normalizeText(t)).filter((t) => t.length >= 3))];
  if (!needles.length) return products;
  return products.filter((p) => {
    const hay = normalizeText(`${p.name} ${p.description || ''}`);
    return needles.some((n) => hasWholeWordOrStem(hay, n));
  });
}

function buildConceptListLabel(concept: MenuConceptGroup, narrowTriggers: string[]): string {
  if (!narrowTriggers.length) return concept.label;
  if (narrowTriggers.length === 1) return titleCaseWords(narrowTriggers[0]);
  return titleCaseWords(narrowTriggers.slice(0, 3).join(' / '));
}

export function resolveMenuConceptGroups(stored: unknown): MenuConceptGroup[] {
  if (!Array.isArray(stored) || !stored.length) {
    return DEFAULT_MENU_CONCEPTS.map((c) => ({ ...c, triggers: [...c.triggers], productKeywords: [...c.productKeywords] }));
  }
  const out: MenuConceptGroup[] = [];
  for (const raw of stored) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    const id = normalizeText(String(row.id || row.label || '')).replace(/\s+/g, '_') || `concept_${out.length + 1}`;
    const label = String(row.label || id).trim().slice(0, 80) || id;
    const triggers = (Array.isArray(row.triggers)
      ? row.triggers
      : String(row.triggers || '')
          .split(',')
          .map((t) => t.trim())
    )
      .map((t) => normalizeText(String(t)))
      .filter(Boolean);
    const productKeywords = (Array.isArray(row.productKeywords)
      ? row.productKeywords
      : String(row.productKeywords || row.productMatch || '')
          .split(',')
          .map((t) => t.trim())
    )
      .map((t) => normalizeText(String(t)))
      .filter(Boolean);
    if (!triggers.length) continue;
    out.push({
      id,
      label,
      triggers: [...new Set(triggers)],
      productKeywords: [...new Set(productKeywords)],
      enabled: row.enabled !== false,
    });
  }
  return out.length ? out : resolveMenuConceptGroups(null);
}

function queryMatchesConcept(q: string, concept: MenuConceptGroup): boolean {
  for (const trigger of concept.triggers) {
    const t = normalizeText(trigger);
    if (!t || t.length < 3) continue;
    if (q === t || hasWholeWordOrStem(q, t)) return true;
    for (const token of q.split(' ').filter((x) => x.length >= 3)) {
      if (tokenMatchesTrigger(token, t)) return true;
    }
  }
  return false;
}

/** Nombres de categoría del menú que cuentan para cada concepto (sin listar cada corte). */
const CATEGORY_ALIASES: Record<string, string[]> = {
  carne: ['carne', 'carnes', 'res', 'cerdo', 'parrilla', 'asados', 'asado', 'grill', 'cortes'],
  pollo: ['pollo', 'pollos', 'aves', 'broaster'],
  sopa: ['sopa', 'sopas', 'caldo', 'caldos', 'sopitas'],
  arroz: ['arroz', 'arroces', 'chinos'],
  pescado: ['pescado', 'pescados', 'mariscos', 'pescaderia'],
  bebida: ['bebida', 'bebidas', 'gaseosa', 'gaseosas', 'jugo', 'jugos', 'refresco', 'refrescos'],
};

/** Categorías genéricas mezcladas (carta / especiales) — el LLM debe filtrar. */
const GENERIC_CATEGORY_RE =
  /\b(carta|especial(?:es)?|platos?(?:\s+fuertes?)?|fuertes?|menu|almuerzo|comida|recomend\w*|del\s*dia|principales?|ejecutivos?)\b/i;

const SIDE_OR_DRINK_CATEGORY_RE =
  /\b(bebida|bebidas|gaseosa|jugos?|limonada|extra|adiciones?|guarnici\w*|acompan\w*|arepas?\s+suelt)/i;

const SEMANTIC_FILTER_HINTS: Record<string, string> = {
  carne:
    'Filtra SEMÁNTICAMENTE entre candidates: solo carne de res/cerdo/ternera ' +
    '(churrasco, sobrebarriga, solomillo, punta de anca, bistec, lomo, posta, costilla de res…). ' +
    'EXCLUYE pollo, pescado/mojarra/trucha/bagre, sopas, arroz, bebidas y acompañamientos. ' +
    'Ofrece 2–4 en tono natural. NUNCA digas "no encontré". Si ninguno encaja, dilo breve y ofrece menú.',
  pollo:
    'Filtra SEMÁNTICAMENTE: solo platos de pollo (frito, broaster, pechuga, alitas, combos de pollo). ' +
    'EXCLUYE carne de res, pescado, sopas sueltas y bebidas. Ofrece 2–4 natural. NO digas "no encontré".',
  sopa:
    'Filtra SEMÁNTICAMENTE: solo sopas/caldos (ajiaco, mondongo, menudencias, sancocho…). ' +
    'EXCLUYE platos secos, carnes a la plancha, pollo entero y bebidas. Ofrece 2–4 natural.',
  arroz:
    'Filtra SEMÁNTICAMENTE: arroces (chino, paisa, etc.). EXCLUYE pollo suelto, carnes y bebidas.',
  pescado:
    'Filtra SEMÁNTICAMENTE: pescados/mariscos (mojarra, trucha, bagre…). EXCLUYE carne de res, pollo y bebidas.',
  bebida:
    'Filtra SEMÁNTICAMENTE: solo bebidas (gaseosa, jugo, limonada…). EXCLUYE comida.',
};

function categoryMatchesConcept(
  categoryName: string | null | undefined,
  concept: MenuConceptGroup,
): boolean {
  const cat = normalizeText(categoryName || '');
  if (!cat || cat.length < 3) return false;
  const catStem = stemLoose(cat);
  const needles = [
    concept.label,
    concept.id,
    ...concept.triggers,
    ...(CATEGORY_ALIASES[concept.id] || []),
  ];
  for (const raw of needles) {
    const n = normalizeText(raw);
    if (!n || n.length < 3) continue;
    if (cat === n || catStem === stemLoose(n)) return true;
    if (hasWholeWordOrStem(cat, n)) return true;
    // "Carnes a la parrilla" contiene alias
    if (cat.includes(n) || cat.includes(stemLoose(n))) return true;
  }
  return false;
}

function productMatchesConcept(p: WhatsappProductCandidate, concept: MenuConceptGroup): boolean {
  // 1) Categoría del menú (punta de anca / solomillo en "Carnes" sin listar cortes)
  if (categoryMatchesConcept(p.categoryName, concept)) return true;

  // 2) Keywords solo en nombre/descripcion (respaldo si el plato está mal categorizado)
  const hay = normalizeText(`${p.name} ${p.description || ''}`);
  for (const kw of concept.productKeywords) {
    const k = normalizeText(kw);
    if (k.length >= 3 && hasWholeWordOrStem(hay, k)) return true;
  }
  return false;
}

/**
 * Agrupa productos por concepto del menú.
 * Prioridad: categoría del menú (Carnes → todos los cortes) + keywords de respaldo.
 * No hace falta listar "punta de anca", "solomillo", etc. a mano.
 */
export function findByMenuConcept(
  query: string,
  products: WhatsappProductCandidate[],
  groups?: MenuConceptGroup[],
): { categoryName: string; products: WhatsappProductCandidate[]; conceptId: string } | null {
  const q = normalizeText(query);
  if (!q || q.length < 3) return null;

  const concepts = resolveMenuConceptGroups(groups);
  let best: {
    concept: MenuConceptGroup;
    products: WhatsappProductCandidate[];
    score: number;
    narrowTriggers: string[];
  } | null = null;

  for (const concept of concepts) {
    if (concept.enabled === false) continue;
    if (!queryMatchesConcept(q, concept)) continue;

    const available = products.filter((p) => p.availableNow !== false);
    let matched = available.filter((p) => productMatchesConcept(p, concept));
    if (!matched.length) continue;

    const matchedTriggers = getMatchedConceptTriggers(q, concept);
    const narrowTriggers = matchedTriggers.filter((t) => !isBroadConceptTrigger(concept, t));
    if (narrowTriggers.length) {
      const filtered = filterProductsByConceptTriggers(matched, narrowTriggers);
      if (filtered.length) matched = filtered;
    } else {
      // "sopa de menudencias": no listar todas las sopas si hay detalle específico
      const stop = new Set([
        'con', 'de', 'del', 'la', 'el', 'los', 'las', 'una', 'un', 'unos', 'unas',
        'quiero', 'dame', 'ponme', 'para', 'por',
        // Disponibilidad / cortesía: "tienes carne?" no filtra por "tienes"
        'tiene', 'tienen', 'tienes', 'hay', 'ofrecen', 'ofreces', 'venden', 'vendes',
        'manejan', 'manejas', 'disponible', 'disponibles', 'hola', 'buenas', 'buenos',
        'favor', 'porfa', 'gracias',
      ]);
      const broadNeedles = new Set(
        [...matchedTriggers, ...(BROAD_CONCEPT_TRIGGERS[concept.id] || []), concept.label]
          .map((t) => stemLoose(normalizeText(t)))
          .filter((t) => t.length >= 3),
      );
      const extraTokens = q
        .split(' ')
        .map((t) => t.trim())
        .filter((t) => t.length >= 4 && !stop.has(t) && !broadNeedles.has(stemLoose(t)));
      if (extraTokens.length) {
        const filtered = matched.filter((p) => {
          const hay = normalizeText(`${p.name} ${p.description || ''}`);
          return extraTokens.some(
            (tok) => hay.includes(tok) || hay.includes(stemLoose(tok)),
          );
        });
        if (filtered.length >= 1) {
          matched = filtered;
        } else {
          // Dejar que el buscador por nombre resuelva el plato concreto
          continue;
        }
      }
    }

    let score = 70;
    if (concept.triggers.some((t) => q === normalizeText(t))) score = 100;
    else if (concept.triggers.some((t) => hasWholeWordOrStem(q, normalizeText(t)))) score = 85;
    if (narrowTriggers.length) score += 8;

    if (!best || score > best.score || (score === best.score && matched.length > best.products.length)) {
      best = { concept, products: matched, score, narrowTriggers };
    }
  }

  if (!best) return null;
  return {
    categoryName: buildConceptListLabel(best.concept, best.narrowTriggers),
    products: best.products,
    conceptId: best.concept.id,
  };
}

export function buildMenuConceptsPromptBlock(groups?: MenuConceptGroup[]): string {
  const concepts = resolveMenuConceptGroups(groups).filter((c) => c.enabled !== false);
  if (!concepts.length) return '';
  const lines = concepts.map((c) => {
    const catHint = (CATEGORY_ALIASES[c.id] || [c.label]).slice(0, 3).join('/');
    const kw = c.productKeywords.slice(0, 3).join(', ');
    return (
      `  • "${c.label}": si piden ${c.triggers.slice(0, 4).join(', ')}… ` +
      `lista productos de categorías tipo ${catHint}` +
      (kw ? ` (también nombres con ${kw}…)` : '') +
      `; si el menú mezcla todo en "carta/especiales", search_menu te da candidates y TÚ filtras por significado`
    );
  });
  return (
    `CONCEPTOS DEL MENÚ (categoría limpia O filtro semántico del agente):\n` +
    lines.join('\n')
  );
}

export type ConceptBrowseForAgent = {
  /** category_clean = menú ordenado; semantic_filter = carta mezclada → el LLM filtra */
  mode: 'category_clean' | 'semantic_filter';
  conceptId: string;
  conceptLabel: string;
  products: WhatsappProductCandidate[];
  hint: string;
};

function isGenericMenuCategory(categoryName: string | null | undefined): boolean {
  const cat = (categoryName || '').trim();
  if (!cat) return true; // sin categoría = menú desordenado
  if (SIDE_OR_DRINK_CATEGORY_RE.test(cat)) return false;
  return GENERIC_CATEGORY_RE.test(cat);
}

function keywordMatchesProduct(
  p: WhatsappProductCandidate,
  concept: MenuConceptGroup,
): boolean {
  const hay = normalizeText(`${p.name} ${p.description || ''}`);
  for (const kw of concept.productKeywords) {
    const k = normalizeText(kw);
    if (k.length >= 3 && hasWholeWordOrStem(hay, k)) return true;
  }
  return false;
}

/**
 * Búsqueda por concepto lista para el agente:
 * 1) Categoría clara (Carnes) → resultados directos
 * 2) Menú mezclado (carta/especiales) → pool amplio + hint para filtro semántico del LLM
 */
export function resolveConceptBrowseForAgent(
  query: string,
  products: WhatsappProductCandidate[],
  groups?: MenuConceptGroup[],
): ConceptBrowseForAgent | null {
  const q = normalizeText(query);
  if (!q || q.length < 3) return null;

  const concepts = resolveMenuConceptGroups(groups).filter((c) => c.enabled !== false);
  const concept = concepts.find((c) => queryMatchesConcept(q, c));
  if (!concept) return null;

  const available = products.filter((p) => p.availableNow !== false);
  const fromSpecificCategory = available.filter((p) => categoryMatchesConcept(p.categoryName, concept));
  const fromKeywords = available.filter((p) => keywordMatchesProduct(p, concept));
  const fromGenericCategories = available.filter(
    (p) =>
      isGenericMenuCategory(p.categoryName) &&
      !SIDE_OR_DRINK_CATEGORY_RE.test(p.categoryName || ''),
  );

  const specificIsClean =
    fromSpecificCategory.length >= 1 &&
    fromSpecificCategory.every((p) => !isGenericMenuCategory(p.categoryName));

  // Mundo perfecto: categoría Carnes/Pollos bien armada
  if (specificIsClean && fromSpecificCategory.length >= 1) {
    const merged = new Map<number, WhatsappProductCandidate>();
    for (const p of [...fromSpecificCategory, ...fromKeywords]) merged.set(p.id, p);
    return {
      mode: 'category_clean',
      conceptId: concept.id,
      conceptLabel: concept.label,
      products: [...merged.values()].slice(0, 12),
      hint:
        `Categoría clara "${concept.label}". Ofrece 2–4 opciones en tono natural. ` +
        `NUNCA digas "no encontré".`,
    };
  }

  // Menú desordenado / vacío de categoría: pool para que el LLM filtre
  const pool = new Map<number, WhatsappProductCandidate>();
  for (const p of [...fromSpecificCategory, ...fromKeywords, ...fromGenericCategories]) {
    pool.set(p.id, p);
  }
  // Si sigue muy vacío, meter platos no-bebida (último recurso)
  if (pool.size < 3) {
    for (const p of available) {
      if (SIDE_OR_DRINK_CATEGORY_RE.test(p.categoryName || '')) continue;
      if (concept.id === 'bebida') continue;
      pool.set(p.id, p);
      if (pool.size >= 28) break;
    }
  }

  if (!pool.size) return null;

  const hint =
    SEMANTIC_FILTER_HINTS[concept.id] ||
    `Filtra SEMÁNTICAMENTE candidates que encajen con "${concept.label}". ` +
      `Ofrece 2–4 natural. NUNCA digas "no encontré".`;

  return {
    mode: 'semantic_filter',
    conceptId: concept.id,
    conceptLabel: concept.label,
    products: [...pool.values()].slice(0, 35),
    hint,
  };
}
