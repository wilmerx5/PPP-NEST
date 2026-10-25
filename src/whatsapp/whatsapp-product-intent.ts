import {kitchenDescriptionNote} from './whatsapp-kitchen-description';
import {applyLocalGlossary} from './whatsapp-local-glossary';
type NamedProduct = { id: number; name: string };
const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Separate an explicitly qualified kitchen request from an exact catalog name.
 * Do not treat arbitrary "with X" compositions as notes or infer another SKU.
 */
/** "bien frito" y "arto ají" dicen cómo lo quieren, no un plato que falte en la carta. */
export function stripNonDishKitchenWords(text: string): string {
  return (text || '')
    .replace(/\b(?:muy\s+)+(?:bien\s+)?(?=(?:asad[oa]s?|cocid[oa]s?|frit[oa]s?|hornead[oa]s?|dorad[oa]s?)\b)/gi, ' ')
    .replace(/\bbien\s+(?=(?:asad[oa]s?|cocid[oa]s?|frit[oa]s?|hornead[oa]s?|dorad[oa]s?)\b)/gi, ' ')
    .replace(/\b(?:con\s+)?(?:harto|arto|mucho|mucha|bastante|extra|poco|poca)\s+aj[ií]\b/gi, ' ');
}

export function condimentIntensityNote(text: string): string | undefined {
  const match = (text || '').match(/\b(?:con\s+)?(?:harto|arto|mucho|mucha|bastante|extra|poco|poca)\s+aj[ií]\b/i);
  if (!match) return undefined;
  return match[0].replace(/\barto\b/gi, 'harto').replace(/\bahi\b/gi, 'ají').replace(/\baji\b/gi, 'ají').replace(/\s+/g, ' ').trim();
}

/** A burst that repeats a note ("sin azúcar" / "sin azucar") keeps it once; distinct parts stay as written. */
export function dedupeKitchenNoteParts(note: string | null | undefined): string | undefined {
  if (!note?.trim()) return note ?? undefined;
  const parts = note.split(/\s*(?:\r?\n|;|,)\s*/).filter(Boolean);
  if (parts.length < 2) return note;
  const keyOf = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  const kept: string[] = [];
  for (const part of parts) {
    const key = keyOf(part);
    const index = kept.findIndex(existing => keyOf(existing).includes(key) || key.includes(keyOf(existing)));
    if (index < 0) { kept.push(part); continue; }
    const [longer, shorter] = key.length > keyOf(kept[index]).length ? [part, kept[index]] : [kept[index], part];
    const at = keyOf(longer).indexOf(keyOf(shorter));
    // Keep the written accents of the shorter form when both line up character by character.
    kept[index] = at >= 0 && keyOf(longer).length === longer.length && keyOf(shorter).length === shorter.length && /[^\x00-\x7f]/.test(shorter)
      ? longer.slice(0, at) + shorter + longer.slice(at + shorter.length)
      : longer;
  }
  return kept.length === parts.length ? note : kept.join(', ');
}

export function joinKitchenNotes(...parts: Array<string | null | undefined>): string | undefined {
  const kept: string[] = [];
  const keys: string[] = [];
  const keyOf = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\barto\b/g, 'harto').replace(/\ba[jh]i\b/g, 'aji').replace(/\s+/g, ' ').trim();
  for (const part of parts) {
    const clean = (part || '').replace(/\s+/g, ' ').trim().replace(/\s+(?:por(?:\s+favor)?|porfa|gracias)$/i, '');
    if (!clean) continue;
    const key = keyOf(clean);
    const container = keys.findIndex((existing) => existing === key || existing.includes(key) || key.includes(existing));
    if (container >= 0) {
      if (key.length > keys[container].length) {
        keys[container] = key;
        kept[container] = clean;
      }
      continue;
    }
    keys.push(key);
    kept.push(clean);
  }
  const joined = kept.join('; ').slice(0, 200).trim();
  return joined || undefined;
}

export function interpretProductNote(source: string, products: NamedProduct[]):
  { productId: number; productText: string; note: string } | null {
  const prepared = applyLocalGlossary(source);
  const normalized = normalize(prepared);
  for (const product of [...products].sort((a,b)=>b.name.length-a.name.length)) {
    const name = normalize(product.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g,'\\s+')
      .replace(/^1\/4/, '(?:1\\s*\\/\\s*4|cuarto(?:\\s+de)?)')
      .replace(/^1\/2/, '(?:1\\s*\\/\\s*2|medio(?:\\s+de)?)');
    const match = new RegExp(`\\b${name}\\b`,'i').exec(normalized);
    if (!match) continue;
    const tail = normalized.slice(match.index + match[0].length).trim()
      .replace(/[\s,]+(?:por favor|porfa|gracias)[.!]*$/, '').replace(/[.!]+$/, '').trim();
    if(!tail)return null; // An exact longer catalogue name owns its adjectives.
    const description=kitchenDescriptionNote(prepared.slice(match.index+match[0].length));
    if(description)return {productId:product.id,productText:prepared.slice(0,match.index+match[0].length).trim(),note:description};
    // A compact accompaniment substitution is a kitchen request, not a new SKU.
    // Require an exact dish anchor and two separate words after the article;
    // never swallow a coordinated purchase or a question.
    if (/^a cambio (?:del|de la|de el) \p{L}+ (?!y\b|con\b|un\b|una\b)\p{L}+(?: \p{L}+){0,2}$/u.test(tail) &&
        !/\b(?:y|otro|otra|quiero|dame|agrega)\b/.test(tail)) {
      return {productId:product.id,productText:prepared.slice(0,match.index+match[0].length).trim(),note:tail};
    }
    const descriptor = '(?:dorad[oa]s?|delgad[oa]s?|grues[oa]s?|picad[oa]s?|tajad[oa]s?|crocantes?|crujientes?)';
    if (new RegExp(`^(?:(?:bien|muy)\\s+)?${descriptor}(?:\\s+(?:y\\s+)?(?:(?:bien|muy)\\s+)?${descriptor})*$`).test(tail)) {
      return {productId:product.id,productText:prepared.slice(0,match.index+match[0].length).trim(),note:tail};
    }
    if (!/^(?:con\s+(?:h?art[oa]s?|much[oa]s?|bastantes?|extra|poc[oa]s?)\s+\p{L}|con\s+aji\b)/u.test(tail)) continue;
    if (tail.length>180 || /[?¿;,]|\b(?:y|agrega|quiero|dame|si|cambia|por)\b/.test(tail)) continue;
    const note = tail.replace(/\bart([oa])\b/g,'hart$1').replace(/\bahi\b/g,'ají').replace(/\baji\b/g,'ají');
    return {productId:product.id,productText:prepared.slice(0,match.index+match[0].length).trim(),note};
  }
  return null;
}

/** An uncounted request for condiment packets modifies food, not the delivery address. */
export function isCondimentPacketNote(text: string): boolean {
  return /^(?:con\s+)?(?:h?art[oa]s?|much[oa]s?|bastantes?)\s+sobres?\s+de\s+(?:salsa(?:\s+de\s+\p{L}+)?|mostaza|mayonesa|aj[ií]|ketchup)(?:\s+por favor)?[.!]*$/iu.test(text.trim());
}
