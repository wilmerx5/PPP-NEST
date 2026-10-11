import { normalizeCorrection } from './whatsapp-quantity-correction';

export type ScopedCartNote = { kind: 'append' | 'remove'; query: string; note: string; preserve: string[] };
const clean = (text: string) => text.trim().replace(/[.!]+$/, '').replace(/\s+(?:por favor|porfa|gracias)$/i, '').trim();

/** Explicit notes for a named existing dish; questions and compound orders remain with the agent. */
export function parseScopedCartNote(text: string): ScopedCartNote | null {
  if (!text.trim() || text.length > 350 || /[¿?;]/.test(text)) return null;
  const t = clean(text);
  const removal = t.match(/^quita\s+(?:(?:solo|solamente)\s+)?la\s+nota\s+(?:de\s+)?(.+?)\s+de\s+(.+?)(?:\s+y\s+conserva\s+(.+))?$/i);
  if (removal) {
    if (/\b(?:agrega|cambia|reemplaza|quita|y)\b/.test(normalizeCorrection(removal[2]))) return null;
    return { kind: 'remove', note: removal[1], query: removal[2], preserve: removal[3] ? [removal[3]] : [] };
  }
  const addition = t.match(/^(?:a\s+(?:el|la|los|las)|al|para\s+(?:el|la|los|las))\s+(.+?)\s+(?:ponles?|an[oó]tales?|a[nñ][aá]deles?|agr[eé]gales?)\s+(?:(?:tambi[eé]n|adem[aá]s)\s+)?(?:(?:la\s+nota|como\s+nota)\s+)?(.+)$/i);
  if (!addition) return null;
  const clauses = clean(addition[2]).split(/\.\s+/);
  const preserve: string[] = [];
  for (const clause of clauses.slice(1)) {
    const keep = clause.match(/^(?:el|la|los|las)\s+(?:de\s+)?(.+?)\s+(?:d[eé]jal[oa]s?|mant[eé]nl[oa]s?)\s+igual(?:es)?$/i);
    if (!keep) return null;
    preserve.push(keep[1]);
  }
  const note = clean(clauses[0]);
  const norm = normalizeCorrection(note);
  if (/\b(?:agrega|cambia|reemplaza|quita|cuanto|precio|cantidad|pago|domicilio|y|dos|tres|cuatro|cinco)\b/.test(norm)) return null;
  if (!/\b(?:sin|aparte|separad[oa]s?|crocantes?|crujientes?|dorad[oa]s?|cocid[oa]s?|bolsa|empaque)\b/.test(norm)) return null;
  if (/\b(?:y|una?|dos|tres|cuatro|cinco)\b/.test(normalizeCorrection(addition[1]))) return null;
  return { kind: 'append', query: addition[1], note, preserve };
}

const noteTokens = (text: string) => normalizeCorrection(text).split(' ').filter(w => !['bien', 'muy'].includes(w));
export function notePartMatches(part: string, query: string): boolean {
  const have = noteTokens(part), wanted = noteTokens(query);
  return wanted.length > 0 && have.length === wanted.length && wanted.every((word, index) => word === have[index]);
}

/** Remove only a complete stored note clause; never erase another instruction from a mixed clause. */
export function editScopedCartNote(existing: string | undefined, edit: ScopedCartNote): { note: string | undefined; blocked?: boolean } {
  const parts = (existing || '').split(/[;.]+/).map(part => part.trim()).filter(Boolean);
  if (edit.kind === 'append') {
    if (!parts.some(part => notePartMatches(part, edit.note))) parts.push(edit.note);
    const combined = parts.join('; ');
    return combined.length > 200 ? { note: existing, blocked: true } : { note: combined || undefined };
  }
  const remaining = parts.filter(part => !notePartMatches(part, edit.note));
  const next = remaining.join('; ') || undefined;
  if (edit.preserve.some(query => !remaining.some(part => notePartMatches(part, query)))) return { note: existing, blocked: true };
  // Existing compound notes need clarification rather than a broad substring deletion.
  if (remaining.length === parts.length && parts.some(part => normalizeCorrection(part).includes(normalizeCorrection(edit.note)))) return { note: existing, blocked: true };
  return { note: next };
}
