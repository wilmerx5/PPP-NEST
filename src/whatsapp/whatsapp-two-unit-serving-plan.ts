import { splitKitchenPreference, trailingServingNote } from './whatsapp-kitchen-preference';

/** A bounded purchase grammar. Its unit clauses are data, never re-segmented as purchases. */
export function twoUnitServingPlan(text: string): {
  total: number; subject: string; shared?: string; notes: [string, string]; extra?: string;
} | null {
  if (/[¿?;\n]/.test(text)) return null;
  const match = text.trim().match(/^(?:(?:quiero|dame|me das|me regalas?|env[ií]ame)\s+)?(dos|2|tres|3)\s+(.+?)\s*,?\s+un[oa]\s+((?:con|sin)\s+.+?)\s+y\s+(?:el|la)\s+otr[oa]\s+(.+?)[.!]*$/i);
  if (!match) return null;
  const [right, extra, ...rest] = match[4].split(/,\s*y\s+/i);
  if (rest.length || (extra && !/^(?:una?|\d{1,2})\s+porci[oó]n\s+(?:adicional|extra)\s+de\s+[\p{L} ]+$/iu.test(extra))) return null;
  const allowed = (note: string) => /^(?:con|sin)\s+[\p{L}]+(?:\s+[\p{L}]+){0,5}$/iu.test(note) &&
    !/\b(?:y|o|para|pago|quiero|agrega|dame|adicional|extra|otro|otra|una?|dos|tres|cu[aá]nto|cuesta|tarda|llega|confirmar|nombre|tel[eé]fono|direcci[oó]n)\b/i.test(note);
  // Bare second accompaniment is accepted only in an explicit portion distribution.
  const second = /^(?:con|sin)\s/i.test(right) ? right.trim() :
    /^con\s+porci[oó]n\s+de\s/i.test(match[3]) ? `con ${right.trim()}` : '';
  if (!allowed(match[3]) || !allowed(second)) return null;
  const subject = match[2].trim();
  const serving = trailingServingNote(subject);
  const handling = !serving ? splitKitchenPreference(subject) : null;
  return { total: /^(?:dos|2)$/i.test(match[1]) ? 2 : 3,
    subject: serving?.head || handling?.productText || subject,
    shared: serving?.note || handling?.note,
    notes: [match[3].trim(), second], extra: extra?.trim() };
}
