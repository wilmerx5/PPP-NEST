import {splitKitchenDescription} from './whatsapp-kitchen-description';
const CONTAINERS = '(?:ca[jh]as?|partes|porciones|empaques?|bolsas?|platos?)';
const SPLIT = `(?:dos|tres|2|3)\\s+${CONTAINERS}`;
const HANDLING = `(?:(?:dividid|partid|cortad|empacad|servid)[oa]s?(?:\\s+(?:por\\s+separado|aparte|en\\s+(?:dos|tres|2|3)(?:\\s+${CONTAINERS})?))?|por\\s+separado|en\\s+${SPLIT}|(?:bien|muy)\\s+(?:tostad|dorad)(?:it)?[oa]s?|(?:tostad|dorad)it[oa]s?|(?:bien\\s+|muy\\s+)?crocantes?)`;

/** Separate explicit preparation instructions from a single dish request.
 * Unqualified compositions, questions and additional purchases stay with the normal router.
 */
export function splitKitchenPreference(source: string): {productText: string; note: string} | null {
  if (/[?¿;]/.test(source)) return null;
  const packedPart=source.match(/^(.+?)\s+pero\s+((?:(?:medi[oa]|una\s+parte)(?:\s+de)?\s+\p{L}+(?:\s+\p{L}+){0,2}|la\s+mitad(?:\s+de\s+\p{L}+)?)\s+en\s+(?:una?\s+)?(?:caja|bolsa|empaque)\s+(?:diferente|aparte|separad[oa]))(?:\s+por\s+favor)?[.!]*$/iu);
  if(packedPart && !/\b(?:otro|otra|agrega|anade|y)\b/i.test(packedPart[2]))return {productText:packedPart[1],note:packedPart[2]};
  const description=splitKitchenDescription(source);
  if(description)return description;
  const handling = HANDLING;
  const match = new RegExp(`\\b(?:sin\\s+|bien\\s+empacad[oa]s?\\b|en\\s+(?:cajas?|bolsas?|empaques?)\\s+separad[oa]s?\\b|${handling}(?![\\p{L}]))`, 'iu').exec(source);
  if (!match || !match.index) return null;
  const productText = source.slice(0, match.index).replace(/[\s,.]+$/, '').trim();
  const note = source.slice(match.index).replace(/\s+(?:por favor|porfa|gracias)[.!]*$/i, '').replace(/[.!]+$/, '').trim();
  const phrase = '[\\p{L}]+(?:\\s+[\\p{L}]+){0,2}';
  const onlyCount = `solo\\s+(?:un|una|dos|tres|\\d)\\s+${phrase}$`;
  if (!productText || note.length > 180 ||
    /\d|\b(?:agrega|quiero|dame|otro|otra|un|una|dos|tres|cuatro)\b/i.test(note.replace(new RegExp(handling, 'giu'), ' ').replace(new RegExp(`(?:,\\s*|\\s+y\\s+|\\s+)${onlyCount}`, 'iu'), ''))) return null;
  const packaging = `(?:bien\\s+empacad[oa]s?|en\\s+(?:cajas?|bolsas?|empaques?)\\s+separad[oa]s?|${handling})`;
  const sinPhrase = `(?:sin\\s+${phrase}|${packaging})`;
  const preference = new RegExp(`^${sinPhrase}(?:(?:,\\s*|\\s+y\\s+)${sinPhrase})*(?:(?:,\\s*|\\s+y\\s+)(?:en\\s+vez\\s+de\\s+${phrase}\\s+)?(?:m[aá]s|h?arto|much[oa]|bastante|poc[oa]|extra|con\\s+(?:m[aá]s|extra|h?arto|much[oa]|bastante|poc[oa]))\\s+${phrase})?(?:(?:,\\s*|\\s+y\\s+|\\s+)${onlyCount.slice(0, -1)})?$`, 'iu');
  return preference.test(note) ? {productText, note:note.replace(/\s+y\s+(?=(?:m[aá]s|con\s+))/ig, ', ')} : null;
}

/** "Lo quiero normal, pero que le agreguen unas tres papitas saladas": an extra for the dish already in the cart.
 * "Lo quiero normal" restates the dish, so the new note replaces the previous one.
 */
export function followUpExtraNote(source: string): {note: string; item: string; replaces: boolean} | null {
  const text = (source || '').replace(/[¡!¿?.]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text || text.length > 160) return null;
  const match = /^(?:(?:y|pero|ok|bueno|listo)\s+)?(?:((?:lo|la)\s+quiero\s+(?:normal|as[ií]|tal\s+cual)(?:\s+con\s+\p{L}+(?:\s+\p{L}+){0,2}?)?)\s*,?\s+)?(?:pero\s+)?que\s+(?:le|les)\s+(?:agreguen|pongan|echen|incluyan|añadan|anadan)\s+(.{3,60}?)(?:\s+(?:as[ií]\s+)?como\s+(?:siempre|sie\p{L}*re|de\s+costumbre)\b.*)?$/iu.exec(text);
  if (!match) return null;
  return {note: `que le agreguen ${match[2].trim()}`, item: match[2].trim(), replaces: !!match[1]};
}

/** "¿Me lo puedes mandar en dos cajas?" after ordering: only a handling note for a dish already in the cart. */
export function followUpHandlingNote(source: string): string | null {
  let text = (source || '').replace(/[¿?¡!.,]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text || text.length > 120) return null;
  text = text
    .replace(/^(?:(?:y|no|oye|veci|porfa|por\s+favor)\s+)+/i, '')
    .replace(/^(?:(?:me\s+)?(?:lo|la|los|las)\s+)?(?:puedes|podr[ií]as|puede|podr[ií]a)\s+/i, '')
    .replace(/^(?:me\s+)?(?:lo|la|los|las)\s+(?:mandas|manda|env[ií]as|env[ií]a|traes|trae|empacas|empaca|sirves|sirve|quiero|quisiera)\s+/i, '')
    .replace(/^(?:mandar|enviar|traer|empacar|servir)(?:me)?(?:lo|la|los|las)?\s+/i, '')
    .replace(/^(?:m[aá]nda|env[ií]a|tr[aá]e|emp[aá]ca|s[ií]rve)(?:me)?(?:lo|la|los|las)\s+/i, '')
    .replace(/^que\s+(?:me\s+)?(?:(?:lo|la|los|las)\s+)?(?:venga|vengan|llegue|lleguen|est[eé]|est[eé]n|sea|sean|manden|env[ií]en)\s+/i, '')
    .replace(/^(divid|part|cort|empac|serv)ir(?:me)?(?:lo|la|los|las)?(?![\p{L}])/iu, (_whole, stem: string) => `${stem}ido`)
    .replace(/\s+(?:por\s+favor|porfa|gracias)$/i, '')
    .trim();
  const lead = new RegExp(`^${HANDLING}(?![\\p{L}])`, 'iu').exec(text);
  if (!lead) return null;
  // A short packing remark may follow ("al empacar, yo pago el excedente"); another item may not.
  const tail = text.slice(lead[0].length).trim();
  if (tail && (tail.length > 70 || /\d|\b(?:un|una|unos|unas|otr[oa]s?|tres|cuatro|cinco|agrega\w*|d[aá]me|quiero)\b/i.test(tail))) return null;
  return text.replace(/\bcahas?\b/gi, (word) => word.replace(/h/i, 'j'));
}
