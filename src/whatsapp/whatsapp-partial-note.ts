import { normalizeCorrection } from './whatsapp-quantity-correction';

const counts: Record<string, number> = { un:1, uno:1, una:1, dos:2, tres:3, cuatro:4, cinco:5, seis:6, siete:7, ocho:8, nueve:9, diez:10 };
const count = (word: string) => counts[word] || (/^\d{1,2}$/.test(word) ? Number(word) : 0);

/** An explicit exclusion for a subset, with an explicit unchanged remainder. */
export function parsePartialNote(text: string): { quantity: number; note: string; remainder?: number } | null {
  if (/[¿?;]/.test(text) || text.length > 250) return null;
  const normalized = normalizeCorrection(text).replace(/[.!]+$/, '').trim();
  const match = normalized.match(/^(\w+)\s+(sin\s+.+?)\s+y\s+(?:los|las)\s+(?:(?:otros|otras)\s+(\w+)|(?:demas|resto))\s+normales?$/);
  if (!match || match[2].length > 200 || /\b(?:agrega|quita|cambia|reemplaza|pero|si)\b/.test(match[2])) return null;
  const quantity = count(match[1]); const remainder = match[3] ? count(match[3]) : undefined;
  if (!quantity || (match[3] && !remainder)) return null;
  return { quantity, note: match[2], remainder };
}
