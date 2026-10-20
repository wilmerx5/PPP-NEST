import { correctionMatchesLine, normalizeCorrection } from './whatsapp-quantity-correction';
import type { WhatsappCartItem } from './types/whatsapp-session.types';

/** The customer is refusing a removal the bot just suggested. The cart stays. */
export function isKeepCartRefusal(text: string): boolean {
  const t = normalizeCorrection(text);
  if (!t || t.length > 80) return false;
  return /^(?:no quiero que (?:me )?(?:lo|la|los|las) quites|no (?:me )?(?:lo|la|los|las) quites|no quites nada|no quiero que quites nada)$/.test(t);
}

/** Only a single explicit dish removal, optionally followed by preservation clauses. */
export function parseScopedCartRemoval(text: string): { query: string; preserve: string[]; quantity?: number; target?: number; all?: boolean } | null {
  if (!text.trim() || text.length > 350 || /[¿?]/.test(text)) return null;
  const finalCount = text.trim().replace(/[.!]+$/, '').match(/^(.+?)\s*(?:,\s*|\s+)(?:y\s+)?(?:que\s+(?:sean|queden|quede)|deja(?:me)?(?:\s+solo)?)\s+(\d{1,2}|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)$/i);
  const countWords: Record<string, number> = {una:1,uno:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10};
  const target = finalCount ? countWords[finalCount[2].toLowerCase()] ?? Number(finalCount[2]) : undefined;
  const clauses = (finalCount?.[1] || text.trim()).replace(/[.!]+$/, '')
    .replace(/^(?:(?:mejor|entonces|bueno|ok|okay|listo|ah|oye|ay|perd[oó]n|disculpa)\s*,?\s+)+/i, '')
    .replace(/^\S+/, (verb) => verb.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
    .split(/\s*;\s*|\s*,\s*(?=(?:conserva|deja|mant[eé]n|no quites|(?:el|la|los|las)\b.*\b(?:dejo|conservo|mantengo))\b)|\s+y\s+(?=(?:conserva|deja|mant[eé]n|no quites|(?:el|la|los|las)\b.*\b(?:dejo|conservo|mantengo))\b)/i);
  const match = clauses.shift()
    ?.replace(/^(\S+)\s+(?:del|de\s+(?:el|la|mi)|en\s+(?:el|la|mi))\s+(?:carrito|pedido|orden)\s+(?=\S)/i, '$1 ')
    .match(/^(?:quita(?:me|r)?|saca(?:me|r)?|elimina(?:me|r)?|retira(?:me|r)?|borra(?:me|r)?)\s+(?:solamente\s+|solo\s+)?(.+)$/i);
  if (!match) return null;
  const whole = match[1].match(/^tod[oa]s?\s+(?:lo\s+del?\s+|(?:el|la|los|las)\s+)(.+)$/i);
  const body = whole?.[1] || match[1];
  const partial = body.match(/^(?:una|1)\s+unidad\s+d(?:e\s+(?:(?:el|la|los|las)\s+)?|el\s+)(.+)$/i) ||
    (whole ? null : body.match(/^(?:uno|una|un|1)\s+de\s+(?:los|las|el|la)\s+(.+)$/i) || body.match(/^(?:uno|una|un|1)\s+(.+)$/i));
  const query = (partial?.[1] || body).replace(/\s+(?:por favor|porfa|gracias)$/i, '').replace(/\s+(?:del carrito|de mi pedido|del pedido)$/i, '').trim();
  const normalized = normalizeCorrection(query);
  if (!normalized || query.includes(',') || /\b(?:y|nota|notas|observacion|observaciones|atributo|opcion|sin|no|solo|solamente|todo|carrito|pedido|agrega|pon|cambia|reemplaza|mejor|por)\b/.test(normalized)) return null;
  const preserve: string[] = [];
  for (const clause of clauses) {
    const keep = clause.match(/^(?:conserva|deja|mant[eé]n|no quites)\s+(.+)$/i) ||
      clause.match(/^((?:el|la|los|las)\s+.+?)\s+(?:s[ií]\s+)?(?:lo|la|los|las)\s+(?:dejo|conservo|mantengo)$/i);
    if (!keep) return null;
    if (/\b(?:agrega|anade|pon|cambia|reemplaza|quita|elimina|retira|borra)\b/.test(normalizeCorrection(keep[1]))) return null;
    preserve.push(...keep[1].replace(/\s+(?:igual|como est[aá]n|por favor|porfa)$/i, '').split(/\s*,\s*|\s+y\s+/i));
  }
  return { query, preserve, ...(partial ? {quantity:1} : {}), ...(target !== undefined ? {target} : {}),
    ...(whole && !partial && target === undefined ? {all: true} : {}) };
}

/** "el 2", "el segundo", "el item dos", "la línea 3": a cart row, 1-based. */
export function cartRowReference(query: string): number | null {
  const q = normalizeCorrection(query);
  const ordinals: Record<string, number> = {primero:1,primera:1,segundo:2,segunda:2,tercero:3,tercera:3,cuarto:4,cuarta:4,quinto:5,quinta:5};
  const spelled: Record<string, number> = {uno:1,una:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10};
  const row = q.match(/^(?:(el|la)\s+)?(?:((?:item|producto|fila|linea|plato)(?:\s+(?:numero|no|#))?|numero)\s+)?(\d{1,2}|[a-z]+)$/);
  if (!row) return null;
  if (/^\d+$/.test(row[3])) return Number(row[3]);
  if (ordinals[row[3]]) return ordinals[row[3]];
  return row[2] && spelled[row[3]] ? spelled[row[3]] : null;
}

export function preservedRemovalConflict(line: WhatsappCartItem, preserve: string[]): boolean {
  return preserve.some(query => correctionMatchesLine(line, query));
}
