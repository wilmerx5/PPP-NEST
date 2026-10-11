import type { WhatsappCartItem } from './types/whatsapp-session.types';

const words: Record<string, number> = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4,
  cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12 };
const number = '\\d{1,4}|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce';
export const normalizeCorrection = (text: string) => text.toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[¿?¡!.,;:]/g, ' ').replace(/\s+/g, ' ').trim();

/** Explicit absolute quantity corrections, rather than orders restricted to a single dish. */
export function parseCartQuantityCorrection(text: string): { quantity: number; query: string } | null {
  if (/[¿?]/.test(text)) return null;
  const t = normalizeCorrection(text).replace(/\s+(?:por favor|porfa|gracias)$/, '')
    .replace(new RegExp(`( en total) no (?:${number}) mas$`), '$1');
  if (/\b(?:y|ademas|tambien|nada mas|quita|borra|vacia|solo quiero|solo pedi|solo te pedi)\b/.test(t)) return null;
  // "Para la calle 48 sur 87 86" es domicilio. El último número no es una cantidad.
  if (/\b(?:calle|carrera|cra|cll|avenida|av|diagonal|diag|dg|transversal|tv|autopista)\b/.test(t) && /\d/.test(t)) return null;
  const result = (amount: string, query: string) =>
    /\b(?:no|pero|mas|menos|otros?|resto|igual|conserva|pedido|en vez)\b/.test(query) ? null
      : { quantity: words[amount] ?? Number(amount), query };
  let m = t.match(new RegExp(`^(?:(?:solo|solamente|unicamente)\\s+)?(?:era|eran|es|son|queria)\\s+(?:solo\\s+)?(${number})\\s+(.+?)(?:\\s+en total)?$`));
  if (m) return result(m[1], m[2]);
  m = t.match(new RegExp(`^(?:del?|para el|para la)\\s+(.+?)\\s+(?:(?:solo|solamente|unicamente)\\s+)?(?:(?:era|eran|es|son|deja|quiero)\\s+)?(${number})(?:\\s+en total)?$`));
  if (m && /\d/.test(m[1])) return null;
  if (m) return result(m[2], m[1]);
  m = t.match(new RegExp(`^(?:deja(?: solo)?|que (?:sean|queden)|que quede)\\s+(${number})\\s+(.+?)(?:\\s+en total)?$`));
  if (m) return result(m[1], m[2]);
  m = t.match(new RegExp(`^no (?:son|eran) (?:${number}) (.+?) (?:son|eran|era|sino) (${number})(?:\\s+en total)?$`));
  return m ? result(m[2], m[1]) : null;
}

export function correctionMatchesLine(line: WhatsappCartItem, query: string): boolean {
  const singular = (word: string) => word.endsWith('ces') ? word.slice(0, -3) + 'z'
    : word.endsWith('s') ? word.slice(0, -1) : word;
  const tokens = normalizeCorrection(query).split(' ').filter(w => !['el', 'la', 'los', 'las', 'de', 'con'].includes(w));
  const name = normalizeCorrection(line.name).split(' ').map(singular);
  const head = tokens[0] && singular(tokens[0]);
  const position = name.indexOf(head);
  // "pollo" names the chicken dish, not the ingredient in "arroz con pollo".
  if (position > 0 && name.slice(0, position).some(w => ['con', 'de', 'en'].includes(w)) &&
    !name.slice(0, position).includes('combo')) return false;
  const available = normalizeCorrection([line.name, ...(line.attributes || []).map(a => `${a.attributeName} ${a.attributeValue}`)].join(' '))
    .split(' ').map(singular);
  return tokens.length > 0 && tokens.every(w => available.includes(singular(w)));
}

/** Omit an attribute-only note; keep packaging instructions and mixed kitchen notes intact. */
export function omitRedundantAttributeNote(note: string | undefined, attributes: WhatsappCartItem['attributes']): string | undefined {
  if (!note?.trim()) return note;
  const text = normalizeCorrection(note);
  for (const attr of attributes || []) {
    const name = normalizeCorrection(attr.attributeName), value = normalizeCorrection(attr.attributeValue);
    const allowed = new Set(`${name} ${value} con el la los las de al estilo`.split(' '));
    if ((text === value || text.split(' ').some(w => name.split(' ').includes(w))) &&
      value.split(' ').every(w => text.split(' ').includes(w)) && text.split(' ').every(w => allowed.has(w))) return undefined;
  }
  return note;
}
