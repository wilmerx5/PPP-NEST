import { editScopedCartNote, notePartMatches } from './whatsapp-cart-note';
import { normalizeCorrection } from './whatsapp-quantity-correction';

/** A change to stored kitchen notes: retire clauses (or every clause) and optionally add their opposite. */
export type CartNoteRevision = {
  query?: string;
  quantity?: number;
  remainder?: number;
  clearAll: boolean;
  remove: string[];
  add?: string;
};

const counts: Record<string, number> = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 };
const amount = '(?:\\d{1,2}|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)';
const count = (word?: string) => (word ? counts[word] || (/^\d{1,2}$/.test(word) ? Number(word) : 0) : 0);
const item = '([a-zñ]+(?: [a-zñ]+)?)';
const article = '(?:el|la|los|las) (?:de )?(.+?)';
const lineRef = `(?:a |para )?${article}`;
const addVerb = '(?:ponle|ponles|echale|echales|agregale|agregales)';
const removeVerb = '(?:quitale|quitales|borrale|borrales)';

/** Explicit retirement or reversal of a stored note; purchases, questions and new notes stay with their routes. */
export function parseCartNoteRevision(text: string): CartNoteRevision | null {
  if (!text.trim() || text.length > 250 || /[¿?]/.test(text)) return null;
  const t = normalizeCorrection(text).replace(/(?: (?:por favor|porfa|gracias))+$/, '').trim();
  const reverse = (query: string, food: string, quantity?: number, remainder?: number): CartNoteRevision =>
    ({ query, ...(quantity ? { quantity } : {}), ...(remainder ? { remainder } : {}), clearAll: false, remove: [`sin ${food}`], add: `con ${food}` });
  let m = t.match(new RegExp(`^(?:a )?(${amount}) de ${lineRef} ${addVerb} (?:con )?${item}(?:(?: y)? (?:las|los) (?:otr[ao]s (${amount})|demas) (?:siguen|quedan|van|igual)(?: sin \\S+(?: \\S+)?)?)?$`));
  if (m) {
    const quantity = count(m[1]);
    const remainder = m[4] ? count(m[4]) : undefined;
    if (!quantity || (m[4] && !remainder)) return null;
    return reverse(m[2], m[3], quantity, remainder);
  }
  m = t.match(new RegExp(`^${lineRef} (?:mejor|ahora|ya no sin \\S+(?: \\S+)? sino) con ${item}$`)) ||
    t.match(new RegExp(`^${lineRef} ${addVerb} ${item}$`));
  if (m) return reverse(m[1], m[2]);
  m = t.match(new RegExp(`^${lineRef} ${removeVerb} la nota$`)) ||
    t.match(new RegExp(`^(?:${removeVerb}|quita|borra) la nota (?:a|de) ${article}$`)) ||
    t.match(new RegExp(`^${lineRef} (?:ya )?sin (?:ninguna )?nota$`));
  if (m) return { query: m[1], clearAll: true, remove: [] };
  m = t.match(new RegExp(`^${lineRef} ${removeVerb} (?:el|lo de) sin ${item}$`)) ||
    t.match(new RegExp(`^${lineRef} ya no (?:van |vayan )?sin ${item}$`));
  if (m) return { query: m[1], clearAll: false, remove: [`sin ${m[2]}`] };
  m = t.match(new RegExp(`^${removeVerb} (?:el|lo de) sin ${item}(?: (?:a|en) (${amount}))?$`));
  if (m) {
    const quantity = m[2] ? count(m[2]) : undefined;
    if (m[2] && !quantity) return null;
    return { ...(quantity ? { quantity } : {}), clearAll: false, remove: [`sin ${m[1]}`] };
  }
  return null;
}

/** The revised note, or null when this line does not carry what the revision retires. */
export function reviseLineNote(note: string | undefined, revision: CartNoteRevision): { note: string | undefined } | null {
  const parts = (note || '').split(/[;.]+/).map(part => part.trim()).filter(Boolean);
  if (revision.clearAll) return parts.length ? { note: undefined } : null;
  if (!revision.remove.length || !revision.remove.every(clause => parts.some(part => notePartMatches(part, clause)))) return null;
  let next = note;
  for (const clause of revision.remove) {
    const removed = editScopedCartNote(next, { kind: 'remove', query: '', note: clause, preserve: [] });
    if (removed.blocked) return null;
    next = removed.note;
  }
  if (!revision.add) return { note: next };
  const added = editScopedCartNote(next, { kind: 'append', query: '', note: revision.add, preserve: [] });
  return added.blocked ? null : { note: added.note };
}
