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
  if (n.length > 3 && n.endsWith('s') && !n.endsWith('es')) return n.slice(0, -1);
  if (n.length > 4 && n.endsWith('es')) return n.slice(0, -2);
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
    if (q === t || q.includes(t) || (q.length >= 4 && t.includes(q))) {
      matched.push(t);
      continue;
    }
    for (const token of q.split(' ').filter((x) => x.length >= 3)) {
      const ts = stemLoose(token);
      const tst = stemLoose(t);
      if (
        token === t ||
        ts === tst ||
        t.includes(token) ||
        token.includes(t) ||
        tst.includes(ts) ||
        ts.includes(tst)
      ) {
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
  const needles = [...new Set(triggers.map((t) => stemLoose(t)).filter((t) => t.length >= 3))];
  if (!needles.length) return products;
  return products.filter((p) => {
    const hay = normalizeText(`${p.name} ${p.description || ''}`);
    return needles.some((n) => hay.includes(n));
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
    if (!triggers.length || !productKeywords.length) continue;
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
    if (q === t || q.includes(t) || (q.length >= 4 && t.includes(q))) return true;
    for (const token of q.split(' ').filter((x) => x.length >= 3)) {
      if (token === t || t.includes(token) || token.includes(t)) return true;
    }
  }
  return false;
}

function productMatchesConcept(p: WhatsappProductCandidate, concept: MenuConceptGroup): boolean {
  const hay = normalizeText(`${p.name} ${p.description || ''} ${p.categoryName || ''}`);
  for (const kw of concept.productKeywords) {
    if (kw.length >= 3 && hay.includes(kw)) return true;
  }
  return false;
}

/**
 * Agrupa productos por concepto del menú cuando NO hay categoría con ese nombre.
 * Ej: "carne" → churrasco, sobrebarriga (aunque estén en otra categoría).
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
    }

    let score = 70;
    if (concept.triggers.some((t) => q === normalizeText(t))) score = 100;
    else if (concept.triggers.some((t) => q.includes(normalizeText(t)))) score = 85;
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
  const lines = concepts.map(
    (c) =>
      `  • "${c.label}": si piden ${c.triggers.slice(0, 4).join(', ')}… busca productos como ${c.productKeywords.slice(0, 4).join(', ')}`,
  );
  return (
    `CONCEPTOS DEL MENÚ (no siempre = nombre de categoría; usa esto para orientar):\n` +
    lines.join('\n')
  );
}
