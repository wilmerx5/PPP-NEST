/** Cooking preferences are metadata, distinct from units and catalog portions. */
export function parseCookingTerm(text: string): {note: string; productText: string} | null {
  if (/[¿?]/.test(text)) return null;
  const match = /\b(?:a(?:l)?\s+)?(?:(?:t[eé]rmino\s+)?(?:3\s*\/\s*4|tres\s+cuartos)|t[eé]rmino\s+medio|bien\s+(?:asad[oa]s?|cocid[oa]s?|frit[oa]s?)|al\s+punto)\b/i.exec(text);
  if (!match) return null;
  const term = match[0].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const note = /3\s*\/\s*4|tres cuartos/.test(term) ? 'término tres cuartos' :
    /termino medio/.test(term) ? 'término medio' : term;
  return {note,productText:(text.slice(0,match.index)+' '+text.slice(match.index+match[0].length)).replace(/\s+/g,' ').trim()};
}
export function supportsCookingTerm(product: {name: string; categoryName?: string}, note?: string): boolean {
  const text = `${product.name} ${product.categoryName || ''}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const asked = (note || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if (/\bbien frit[oa]s?\b/.test(asked) && /\b(?:pollo|ejecutivo|broaster|pechuga|presa|alitas?)\b/.test(text)) return true;
  if (/\bbien asad[oa]s?\b/.test(asked) && /\balmuerzo\b/.test(text)) return true;
  return /\b(?:churrascos?|carnes?|res|bifes?|bistecs?|steaks?|lomos?|filetes?|parrilla)\b/.test(text);
}
