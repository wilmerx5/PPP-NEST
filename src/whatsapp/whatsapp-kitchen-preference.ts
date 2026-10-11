/** Separate explicit preparation instructions from a single dish request.
 * Unqualified compositions, questions and additional purchases stay with the normal router.
 */
export function splitKitchenPreference(source: string): {productText: string; note: string} | null {
  if (/[?¿;]/.test(source)) return null;
  const match = /\bsin\s+/i.exec(source);
  if (!match || !match.index) return null;
  const productText = source.slice(0, match.index).replace(/[\s,.]+$/, '').trim();
  const note = source.slice(match.index).replace(/\s+(?:por favor|porfa|gracias)[.!]*$/i, '').replace(/[.!]+$/, '').trim();
  if (!productText || note.length > 180 || /\d|\b(?:agrega|quiero|dame|otro|otra|un|una|dos|tres|cuatro)\b/i.test(note)) return null;
  const phrase = '[\\p{L}]+(?:\\s+[\\p{L}]+){0,2}';
  const preference = new RegExp(`^sin\\s+${phrase}(?:(?:,\\s*|\\s+y\\s+)(?:en\\s+vez\\s+de\\s+${phrase}\\s+)?(?:m[aá]s|h?arto|con\\s+(?:m[aá]s|extra|h?arto))\\s+${phrase})?$`, 'iu');
  return preference.test(note) ? {productText, note:note.replace(/\s+y\s+(?=(?:m[aá]s|con\s+))/ig, ', ')} : null;
}
