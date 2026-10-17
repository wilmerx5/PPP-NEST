/** Separate explicit preparation instructions from a single dish request.
 * Unqualified compositions, questions and additional purchases stay with the normal router.
 */
export function splitKitchenPreference(source: string): {productText: string; note: string} | null {
  if (/[?¿;]/.test(source)) return null;
  const containers = '(?:cajas?|partes|porciones|empaques?|bolsas?|platos?)';
  const split = `(?:dos|tres|2|3)\\s+${containers}`;
  const handling = `(?:(?:dividid|partid|cortad|empacad|servid)[oa]s?(?:\\s+(?:por\\s+separado|aparte|en\\s+(?:dos|tres|2|3)(?:\\s+${containers})?))?|por\\s+separado|en\\s+${split}|bien\\s+tostad[oa]s?|tostadit[oa]s?|(?:bien\\s+|muy\\s+)?crocantes?)`;
  const match = new RegExp(`\\b(?:sin\\s+|bien\\s+empacad[oa]s?\\b|en\\s+(?:cajas?|bolsas?|empaques?)\\s+separad[oa]s?\\b|${handling}(?![\\p{L}]))`, 'iu').exec(source);
  if (!match || !match.index) return null;
  const productText = source.slice(0, match.index).replace(/[\s,.]+$/, '').trim();
  const note = source.slice(match.index).replace(/\s+(?:por favor|porfa|gracias)[.!]*$/i, '').replace(/[.!]+$/, '').trim();
  if (!productText || note.length > 180 ||
    /\d|\b(?:agrega|quiero|dame|otro|otra|un|una|dos|tres|cuatro)\b/i.test(note.replace(new RegExp(handling, 'giu'), ' '))) return null;
  const phrase = '[\\p{L}]+(?:\\s+[\\p{L}]+){0,2}';
  const packaging = `(?:bien\\s+empacad[oa]s?|en\\s+(?:cajas?|bolsas?|empaques?)\\s+separad[oa]s?|${handling})`;
  const sinPhrase = `(?:sin\\s+${phrase}|${packaging})`;
  const preference = new RegExp(`^${sinPhrase}(?:(?:,\\s*|\\s+y\\s+)${sinPhrase})*(?:(?:,\\s*|\\s+y\\s+)(?:en\\s+vez\\s+de\\s+${phrase}\\s+)?(?:m[aá]s|h?arto|much[oa]|bastante|poc[oa]|extra|con\\s+(?:m[aá]s|extra|h?arto|much[oa]|bastante|poc[oa]))\\s+${phrase})?$`, 'iu');
  return preference.test(note) ? {productText, note:note.replace(/\s+y\s+(?=(?:m[aá]s|con\s+))/ig, ', ')} : null;
}
