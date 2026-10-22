type Product = { description?: string | null; attributes?: { attributeName: string; options: string[] }[] };
export type Inclusion = 'yes' | 'no' | 'unknown';
const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const SODA_BRAND = /\b(?:coca[\s-]?cola|pepsi|sprite|fanta|seven[\s-]?up|7[\s-]?up|quatro|postobon|colombiana|kola roman|ginger ale)\b/;
const kinds = (text: string) => [...normalize(text).matchAll(/\b(bebida|gaseosa|refresco|jugo|soda)s?\b/g)]
  .map(match => match[1] === 'soda' ? 'gaseosa' : match[1]);

/** The soda brand named in a message, as written ("coca cola"), or null. */
export function sodaBrandIn(text: string): string | null {
  return normalize(text || '').match(SODA_BRAND)?.[0] || null;
}

/** Absence from a description is not evidence of exclusion. Generic drinks do not prove a specific type. */
export function drinkInclusion(product: Product, requested: string): Inclusion {
  const wanted=kinds(requested)[0];
  if(!wanted) return 'unknown';
  const description=normalize(product.description || '');
  // Optional/charged selections are not proof of something included in the price.
  if(/\b(?:opcional|adicional|extra|costo|recargo|suplemento)\b/.test(description)) return 'unknown';
  const negatives:string[]=[];
  const positives:string[]=[];
  for(const clause of description.split(/[.;\n]/)) {
    const mentions=kinds(clause);
    if(!mentions.length) continue;
    if(/\b(?:sin|no\s+(?:incluye|incluyen|trae|traen|lleva|llevan|viene))\s+(?:(?:la|el|ninguna?)\s+)?(?:bebida|gaseosa|refresco|jugo|soda)s?\b/.test(clause)) negatives.push(...mentions);
    else if(/\b(?:incluye|incluyen|trae|traen|lleva|llevan|con|acompanad[oa])\b/.test(clause)) positives.push(...mentions);
  }
  for(const attr of product.attributes || []) {
    if(!kinds(attr.attributeName).length) continue;
    if(attr.options.some(option=>/\b(?:sin|ningun[oa]?|no|extra|adicional|recargo)\b/.test(normalize(option)))) continue;
    positives.push(...kinds(attr.attributeName),...attr.options.flatMap(kinds));
  }
  const yes=positives.some(kind=>wanted==='bebida' || kind===wanted);
  const no=negatives.some(kind=>kind==='bebida' || kind===wanted);
  return yes&&no ? 'unknown' : no ? 'no' : yes ? 'yes' : 'unknown';
}
