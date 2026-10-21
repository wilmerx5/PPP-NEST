import type { WhatsappProductCandidate } from './types/whatsapp-session.types';
import { drinkInclusion } from './whatsapp-drink-inclusion';
const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
/** Only a bounded purchase, not questions, kitchen intensity, extra purchases or checkout data. */
export function splitAccompanimentPurchase(
  source: string,
): { dishText: string; accompaniment: string } | null {
  if (/[?¿;\n]/.test(source)) return null;
  const clean = source
    .trim()
    .replace(/\s+por favor[.!]*$/i, '')
    .replace(/[.!]+$/, '');
  const match = clean.match(
    /^((?:quiero|quisiera|dame|me das|me regalas|reg[aá]lame)\s+.+)\s+con\s+(.+)$/i,
  );
  if (!match) return null;
  const side = normalize(match[2]).replace(/^(?:una?|el|la)\s+/, '');
  if (
    !/^[a-zñ]+(?:\s+[a-zñ]+){0,3}$/.test(side) ||
    /\b(?:y|o|sin|con|para|aparte|adicional|extra|otro|otra|dos|tres|cuatro|much[oa]|h?art[oa]|bastante|poc[oa]|poquit[oa])\b/.test(
      side,
    )
  )
    return null;
  return { dishText: match[1], accompaniment: side };
}
/** Conservative catalogue evidence; absence is not exclusion and optional extras are not included. */
export function includesAccompaniment(
  product: WhatsappProductCandidate,
  side: string,
): boolean {
  if (/^(?:gaseosa|bebida|refresco|soda|jugo)s?$/.test(side))
    return (
      drinkInclusion(product, side) === 'yes' ||
      (drinkInclusion(product, side) !== 'no' &&
        /^(?:gaseosa|bebida|refresco|soda)s?$/.test(side) &&
        drinkInclusion(product, 'bebida') === 'yes')
    );
  const terms = (s: string) =>
    normalize(s)
      .split(/[^a-zñ]+/)
      .filter(Boolean)
      .map((t) => t.replace(/s$/, ''));
  const wanted = terms(side);
  const mentions = (s: string) => {
    const tokens = terms(s);
    return wanted.length > 0 && wanted.every((t) => tokens.includes(t));
  };
  const description = normalize(product.description || '');
  if (
    /\b(?:sin|no|opcional|adicional|extra|recargo|costo|suplemento)\b/.test(
      description,
    )
  )
    return false;
  return (
    description
      .split(/[.;\n]/)
      .some(
        (clause) =>
          /\b(?:incluye|incluyen|con|acompanad[oa]|trae|lleva)\b/.test(
            clause,
          ) && mentions(clause),
      ) ||
    (product.attributes || []).some(
      (attr) =>
        !attr.options.some((option) =>
          /\b(?:sin|extra|adicional|recargo)\b/.test(normalize(option)),
        ) && attr.options.some(mentions),
    )
  );
}
