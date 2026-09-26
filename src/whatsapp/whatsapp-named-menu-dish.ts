/**
 * Platos cuyo nombre es un "menú/envoltorio" (ejecutivo, especial, de la casa…),
 * distintos de pedir el link de la carta ("pásame el menú").
 */

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tokens de envoltorio en nombre de producto o pedido. */
export const MENU_WRAPPER_TOKENS = new Set([
  'menu',
  'ejecutivo',
  'almuerzo',
  'almuerzos',
  'bandeja',
  'bandejas',
  'especial',
  'especiales',
  'promocion',
  'promo',
  'combo',
  'combos',
  'casa',
  'gourmet',
  'infantil',
  'familiar',
  'chef',
  'economico',
]);

/**
 * Pedido de un plato tipo "menú X" / ejecutivo / bandeja / almuerzo con proteína.
 * Distinto de "pásame el menú" (ver la carta online).
 */
export function isNamedMenuDishOrderPhrase(query: string): boolean {
  const q = normalizeText(query || '');
  if (!q || q.length < 4) return false;
  // Carta / link suelto → no es plato
  if (/^(ver\s+)?(el\s+)?(menu|carta)(\s+completo)?$/.test(q)) return false;
  if (/\b(link|enlace|url|pagina)\b/.test(q) && /\b(menu|carta)\b/.test(q)) return false;
  if (
    /\b(pasame|pasa|dame|enviame|envia|mandame|manda|comparte|mostrame|muestra|quiero\s+ver|necesito\s+ver)\b/.test(
      q,
    ) &&
    /\b(el\s+)?(menu|carta)\b/.test(q) &&
    !/\b(ejecutivo|especial|infantil|familiar|gourmet|economico|chef|promo|bandeja|combo|almuerzo)\b/.test(
      q,
    ) &&
    !/\bde\s+la\s+casa\b/.test(q) &&
    !/\bdel\s+dia\b/.test(q) &&
    !/\bcon\s+\w{3,}/.test(q)
  ) {
    return false;
  }

  if (/\bejecutivo\b/.test(q)) return true;

  if (/\bmenu\b/.test(q)) {
    if (
      /\b(especial(?:es)?|ejecutivo|infantil|familiar|gourmet|economico|completo|chef|promo(?:cion)?)\b/.test(
        q,
      ) ||
      /\bde\s+la\s+casa\b/.test(q) ||
      /\bdel\s+dia\b/.test(q) ||
      /\bcon\s+\w{3,}/.test(q)
    ) {
      return true;
    }
  }

  if (
    /\balmuerzo\b/.test(q) &&
    /\b(pechuga|pollo|frito|broaster|churrasco|costilla|sobrebarriga|ajiaco|mondongo|sopa)\b/.test(q)
  ) {
    return true;
  }

  if (
    /\bbandeja\b/.test(q) &&
    (/\bcon\b/.test(q) || /\b(pollo|frito|broaster|paisa|mixta|especial)\b/.test(q))
  ) {
    return true;
  }

  return false;
}

export function productLooksLikeNamedMenuDish(name: string): boolean {
  const n = normalizeText(name || '');
  if (!n) return false;
  if (/\bmenu\b/.test(n)) return true;
  if (/\bejecutivo\b/.test(n)) return true;
  if (/\bde\s+la\s+casa\b/.test(n)) return true;
  if (/\bdel\s+dia\b/.test(n)) return true;
  if (/\bbandeja\b/.test(n)) return true;
  if (/\bespecial\b/.test(n) && /\b(menu|almuerzo|plato|promo|dia)\b/.test(n)) return true;
  return false;
}
