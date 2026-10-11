import {applyLocalGlossary} from './whatsapp-local-glossary';
type NamedProduct = { id: number; name: string };
const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Separate an explicitly qualified kitchen request from an exact catalog name.
 * Do not treat arbitrary "with X" compositions as notes or infer another SKU.
 */
export function interpretProductNote(source: string, products: NamedProduct[]):
  { productId: number; productText: string; note: string } | null {
  const prepared = applyLocalGlossary(source);
  const normalized = normalize(prepared);
  for (const product of [...products].sort((a,b)=>b.name.length-a.name.length)) {
    const name = normalize(product.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g,'\\s+');
    const match = new RegExp(`\\b${name}\\b`,'i').exec(normalized);
    if (!match) continue;
    const tail = normalized.slice(match.index + match[0].length).trim()
      .replace(/\s+(?:por favor|porfa|gracias)[.!]*$/, '').replace(/[.!]+$/, '').trim();
    const descriptor = '(?:dorad[oa]s?|delgad[oa]s?|grues[oa]s?|picad[oa]s?|tajad[oa]s?|crocantes?|crujientes?)';
    if (new RegExp(`^(?:(?:bien|muy)\\s+)?${descriptor}(?:\\s+(?:y\\s+)?(?:(?:bien|muy)\\s+)?${descriptor})*$`).test(tail)) {
      return {productId:product.id,productText:prepared.slice(0,match.index+match[0].length).trim(),note:tail};
    }
    if (!/^(?:con\s+(?:harto|arto|mucho|mucha|bastante|extra|poco|poca)\s+\p{L}|con\s+aji\b)/u.test(tail)) continue;
    if (tail.length>180 || /[?¿;,]|\b(?:y|agrega|quiero|dame|si|cambia|por)\b/.test(tail)) continue;
    const note = tail.replace(/\barto\b/g,'harto').replace(/\bahi\b/g,'ají').replace(/\baji\b/g,'ají');
    return {productId:product.id,productText:prepared.slice(0,match.index+match[0].length).trim(),note};
  }
  return null;
}
