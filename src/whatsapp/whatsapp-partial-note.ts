import { normalizeCorrection } from './whatsapp-quantity-correction';

const counts: Record<string, number> = { un:1, uno:1, una:1, dos:2, tres:3, cuatro:4, cinco:5, seis:6, siete:7, ocho:8, nueve:9, diez:10 };
const count = (word: string) => counts[word] || (/^\d{1,2}$/.test(word) ? Number(word) : 0);

/** Two or three explicit exclusions belonging to the same unit, not separate orders.
 * Ingredients remain catalog-independent; commands, quantities and conditions are excluded.
 */
export function isCompoundExclusionNote(text: string): boolean {
  if (text.length > 120 || /[¿?;]/.test(text)) return false;
  const parts = normalizeCorrection(text).split(' y ');
  return parts.length >= 2 && parts.length <= 3 && parts.every(part =>
    /^sin [a-zñ]+(?: [a-zñ]+){0,2}$/.test(part) &&
    !/\b(?:y|e|o|con|no|un|una|uno|dos|tres|cuatro|cinco|agrega|agregar|anade|anadir|quita|quitar|cambia|cambiar|reemplaza|reemplazar|pagar|pago|pedido|quiero|pero|si|mas|otra|otro|otras|otros|adicional|aparte|normal|normales)\b/.test(part));
}

/** An explicit exclusion for a subset, with an explicit unchanged remainder. */
export function parsePartialNote(text: string): { quantity: number; note: string; remainder?: number; query?: string; total?: number; implied?: boolean } | null {
  if (/[¿?;]/.test(text) || text.length > 250) return null;
  const normalized = normalizeCorrection(text).replace(/[.!]+$/, '').trim()
    .replace(/\by (?:el otro|la otra) normal$/, 'y los otros uno normales');
  const amount = '(?:\\d{1,2}|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)';
  const tail = '(sin\\s+.+?)\\s+y\\s+(?:los|las)\\s+(?:(?:otros|otras)\\s+(' + amount + ')|(?:demas|resto))\\s+normales?$';
  const quantityFirst = normalized.match(new RegExp('^(' + amount + ')\\s+de\\s+(?:los|las)\\s+(' + amount + ')\\s+(.+?)\\s+' + tail));
  const productFirst = !quantityFirst && normalized.match(new RegExp('^de\\s+(?:los|las)\\s+(' + amount + ')\\s+(.+?)\\s+(' + amount + ')\\s+' + tail));
  if (quantityFirst || productFirst) {
    const scoped = (quantityFirst || productFirst)!;
    const quantity = count(scoped[quantityFirst ? 1 : 3]);
    const total = count(scoped[quantityFirst ? 2 : 1]);
    const query = scoped[quantityFirst ? 3 : 2];
    const note = scoped[4];
    const remainder = scoped[5] ? count(scoped[5]) : undefined;
    if (!quantity || !total || (scoped[5] && !remainder) ||
        /\b(?:agrega|quita|cambia|reemplaza|pero|si|quiero)\b/.test(query + ' ' + note)) return null;
    return {quantity, total, query, note, ...(remainder === undefined ? {} : {remainder})};
  }
  const match = normalized.match(/^(\w+)\s+(sin\s+.+?)\s+y\s+(?:los|las)\s+(?:(?:otros|otras)\s+(\w+)|(?:demas|resto))\s+normales?$/);
  if (match && match[2].length <= 200 && !/\b(?:agrega|quita|cambia|reemplaza|pero|si)\b/.test(match[2])) {
    const quantity = count(match[1]); const remainder = match[3] ? count(match[3]) : undefined;
    if (quantity && (!match[3] || remainder)) return { quantity, note: match[2], remainder };
  }
  // "una sin cebolla" / "una de ellas sin cebolla": the rest stays as it is, but only a single
  // unnoted line with more units can take it; the caller falls through otherwise.
  const implied = normalized.replace(/\s+(?:por favor|porfa|gracias)$/, '')
    .match(/^(?:y\s+)?(\w+)\s+(?:de\s+(?:ellas|ellos|esas|esos|las\s+dos|los\s+dos)\s+)?((?:sin|poco|poca|bien|extra)\s+.+)$/);
  if (implied && count(implied[1]) && implied[2].length <= 120 &&
      (isCompoundExclusionNote(implied[2]) || !/\b(?:y|agrega|quita|cambia|reemplaza|pero|si|mas|otra|otro|otras|otros|adicional|aparte|normal|normales)\b/.test(implied[2]))) {
    return { quantity: count(implied[1]), note: implied[2], implied: true };
  }
  const other = normalized.match(/^(\w+)\s+(sin\s+.+?)\s+y\s+el\s+otro\s+normal$/);
  if (!other || count(other[1]) !== 1 || other[2].length > 200 || /\b(?:agrega|quita|cambia|reemplaza|pero|si)\b/.test(other[2])) return null;
  return { quantity: 1, note: other[2], remainder: 1 };
}
