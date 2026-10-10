import { correctionMatchesLine, normalizeCorrection } from './whatsapp-quantity-correction';
import type { WhatsappCartItem } from './types/whatsapp-session.types';

/** The customer is refusing a removal the bot just suggested. The cart stays. */
export function isKeepCartRefusal(text: string): boolean {
  const t = normalizeCorrection(text);
  if (!t || t.length > 80) return false;
  return /^(?:no quiero que (?:me )?(?:lo|la|los|las) quites|no (?:me )?(?:lo|la|los|las) quites|no quites nada|no quiero que quites nada)$/.test(t);
}

/** Only a single explicit dish removal, optionally followed by preservation clauses. */
export function parseScopedCartRemoval(text: string): { query: string; preserve: string[] } | null {
  if (!text.trim() || text.length > 350 || /[¿?]/.test(text)) return null;
  const clauses = text.trim().replace(/[.!]+$/, '').split(/\s*;\s*|\s*,\s*(?=(?:conserva|deja|mant[eé]n|no quites)\b)|\s+y\s+(?=(?:conserva|deja|mant[eé]n|no quites)\b)/i);
  const match = clauses.shift()?.match(/^(?:quita(?:me|r)?|saca(?:me|r)?|elimina(?:me|r)?|retira(?:me|r)?|borra(?:me|r)?)\s+(?:solamente\s+|solo\s+)?(.+)$/i);
  if (!match) return null;
  const query = match[1].replace(/\s+(?:por favor|porfa|gracias)$/i, '').replace(/\s+(?:del carrito|de mi pedido|del pedido)$/i, '').trim();
  const normalized = normalizeCorrection(query);
  if (!normalized || query.includes(',') || /\b(?:y|nota|notas|observacion|observaciones|atributo|opcion|sin|no|solo|solamente|todo|carrito|pedido|agrega|pon|cambia|reemplaza|mejor|por)\b/.test(normalized)) return null;
  const preserve: string[] = [];
  for (const clause of clauses) {
    const keep = clause.match(/^(?:conserva|deja|mant[eé]n|no quites)\s+(.+)$/i);
    if (!keep) return null;
    if (/\b(?:agrega|anade|pon|cambia|reemplaza|quita|elimina|retira|borra)\b/.test(normalizeCorrection(keep[1]))) return null;
    preserve.push(...keep[1].replace(/\s+(?:igual|como est[aá]n|por favor|porfa)$/i, '').split(/\s*,\s*|\s+y\s+/i));
  }
  return { query, preserve };
}

export function preservedRemovalConflict(line: WhatsappCartItem, preserve: string[]): boolean {
  return preserve.some(query => correctionMatchesLine(line, query));
}
