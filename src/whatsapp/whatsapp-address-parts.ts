import { splitKitchenPreference } from './whatsapp-kitchen-preference';

const ROAD = '(?:avenida\\s+(?:calle|carrera)|av\\.?\\s*(?:calle|carrera|cra|cl)|calle|cll?|carrera|cra?|kra?|kr|ak|ac|diagonal|diag|dg|transversal|transv|trv|tv|avenida|av)';
const STREET = new RegExp(`\\b${ROAD}\\.?\\s*\\d`, 'i');
const COLOR = '(?:blanc|negr|verde|azul|roj|amarill|gris|caf[eé]|marr[oó]n|naranja|morad|rosad|beige|vinotinto)';
const REFERENCE = new RegExp('(?:^|[\\s,;(-])((?:(?:queda|es|estoy)\\s+)?(?:' + [
  '(?:en\\s*)?frente\\s+(?:a|al|de|del)\\b', 'al\\s+frente\\s+de(?:l)?\\b', 'al\\s+lado\\s+de(?:l)?\\b', 'junto\\s+a(?:l)?\\b',
  'cerca\\s+de(?:l)?\\b', 'cerquita\\s+de(?:l)?\\b', 'diagonal\\s+(?:a|al|de|del)\\s+(?!\\d)', 'detr[aá]s\\s+de(?:l)?\\b',
  'atr[aá]s\\s+de(?:l)?\\b', 'despu[eé]s\\s+de(?:l)?\\b', 'antes\\s+de(?:l)?\\b', 'enseguida\\s+de(?:l)?\\b',
  'a\\s+(?:una|dos|tres|media|\\d)\\s+cuadras?\\b', 'en\\s+(?:toda\\s+)?la\\s+esquina\\b', 'esquinera\\b',
  `(?:port[oó]n|reja|puerta|fachada|casa|edificio)\\s+(?:de\\s+)?(?:color\\s+)?${COLOR}`,
  'timbr\\w*', 'tocar\\s+(?:el\\s+)?(?:timbre|puerta)', 'llam(?:ar|e|en|ame|enme)\\s+(?:al\\s+llegar|cuando\\s+llegue)',
  'alfrente\\s+de(?:l)?\\b', 'a\\s+un\\s+costado\\s+de(?:l)?\\b',
  '(?:en\\s+)?(?:la\\s+)?esquina\\b', '(?:la\\s+)?casa\\s+esquinera\\b',
  'por\\s+la\\s+entrada\\b', 'porter[ií]a\\s+(?:principal|de\\s+visitantes)\\b',
  'referencia\\b', 'ref\\.?\\s*:',
].join('|') + '))', 'i');

/** A landmark or access hint after a destination ("…, frente al parque") is for the driver, not the map. */
export function splitAddressReference(source: string): { address: string; reference: string } {
  const raw = (source || '').trim();
  const match = REFERENCE.exec(raw);
  if (!match) return { address: raw, reference: '' };
  const start = match.index + match[0].indexOf(match[1]);
  const address = raw.slice(0, start).replace(/[\s,;(-]+$/, '').trim();
  if (!address) {
    // A clearly delimited leading hint is not the street itself.
    const delimiter = /[;\n]/.exec(raw);
    if (delimiter) {
      const destination = raw.slice(delimiter.index + 1).trim();
      const hint = raw.slice(0, delimiter.index).trim();
      if (canonicalStreetAddress(destination) && !STREET.test(hint)) {
        return { address: destination, reference: hint };
      }
    }
    return { address: raw, reference: '' };
  }
  const reference = raw.slice(start).replace(/\)\s*$/, '').trim();
  const namedPlace = /\b(?:conjunto|edificio|residencial|urbanizaci[oó]n|condominio|agrupaci[oó]n|torres?|barrio)\s+\S+/i.test(address);
  // Never truncate an intersection, a second street, or the name “Frente al Parque”.
  if (STREET.test(reference) || !(canonicalStreetAddress(address) || (!STREET.test(address) && namedPlace))) {
    return { address: raw, reference: '' };
  }
  return { address, reference };
}

/** "calle 38 sur 72 j 15" → "Calle 38 Sur # 72J-15"; null when the text has no full numbered street. */
export function canonicalStreetAddress(source: string): string | null {
  const text = (source || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[–—−_]/g, '-').replace(/\bn[°º]\s*/g, '# ');
  const roadNames: Array<[RegExp, string]> = [
    [/^(?:avenida\s+carrera|av\.?\s*(?:carrera|cra)|ak)$/, 'Avenida Carrera'], [/^(?:avenida\s+calle|av\.?\s*(?:calle|cl)|ac)$/, 'Avenida Calle'],
    [/^(?:calle|cll?)$/, 'Calle'], [/^(?:carrera|cra?|kra?|kr)$/, 'Carrera'], [/^(?:diagonal|diag|dg)$/, 'Diagonal'],
    [/^(?:transversal|transv|trv|tv)$/, 'Transversal'], [/^(?:avenida|av)$/, 'Avenida'],
  ];
  const part = '(\\d{1,3})\\s*([a-z](?![a-z]))?\\s*(bis\\b)?\\s*([a-z](?![a-z]))?';
  const zone = '(?:\\s*\\b(sur|este|norte)\\b)?';
  const re = new RegExp(`\\b(${ROAD})\\.?\\s*${part}${zone}\\s*(?:#|n[°ºo]\\.?|no\\.|numero|num\\.?)?\\s*${part}${zone}\\s*(?:-|\\s)\\s*(\\d{1,3})(?![\\d])${zone}`, 'i');
  const m = re.exec(text);
  if (!m) return null;
  const road = roadNames.find(([pattern]) => pattern.test(m[1].replace(/\.$/, '').replace(/\s+/g, ' ')))?.[1];
  if (!road) return null;
  const piece = (n: string, a?: string, bis?: string, b?: string) =>
    `${n}${(a || '').toUpperCase()}${bis ? ' Bis' : ''}${b ? ` ${b.toUpperCase()}` : ''}`;
  const zone1 = m[6] ? ` ${m[6][0].toUpperCase()}${m[6].slice(1)}` : '';
  const late = m[11] || m[13];
  const zone2 = late && late !== m[6] ? ` ${late[0].toUpperCase()}${late.slice(1)}` : '';
  return `${road} ${piece(m[2], m[3], m[4], m[5])}${zone1} # ${piece(m[7], m[8], m[9], m[10])}-${m[12]}${zone2}`;
}

/** Keep labelled internal access identifiers for the driver, out of map queries.
 * A standalone unit or a building name is not an external destination. */
export function splitDeliveryAddressParts(source: string): { base: string; details: string } {
  const referenced = splitAddressReference(source);
  if (!referenced.reference) return splitDeliveryUnitParts(source);
  const inner = splitDeliveryUnitParts(referenced.address);
  return { base: inner.base, details: [inner.details, referenced.reference].filter(Boolean).join(', ') };
}

function splitDeliveryUnitParts(source: string): { base: string; details: string } {
  const raw = (source || '').trim();
  const label = '(?:entrada|torre|bloque|apartamento|apto|interior|int|casa|piso|local|oficina)';
  const identifier = '(?:\\d+[a-z]?(?:-\\d+[a-z]?)?|[a-z](?:-\\d+)?)';
  const unitPattern = `${label}\\.?\\s*(?:#\\s*)?${identifier}(?=$|[\\s,;])`;
  const unit = new RegExp(`\\s+(?=${unitPattern})`, 'i').exec(raw);
  if (!unit || new RegExp(`^${unitPattern}`, 'i').test(raw)) return { base: raw, details: '' };
  const base = raw.slice(0, unit.index).replace(/[,;\s]+$/, '').replace(/^a\s+/i, '').trim();
  if (!base || /^(?:conjunto|edificio|residencial|urbanizaci[oó]n|condominio|hotel)$/i.test(base)) {
    return { base: raw, details: '' };
  }
  const details = raw.slice(unit.index).trim();
  // A street after the unit is still part of the external destination. Until
  // that mixed ordering is separated safely, retain it rather than discard it.
  if (/\b(?:calle|cll?|carrera|cra?|diagonal|dg|transversal|tv)\.?\s*\d/i.test(details)) {
    return { base: raw, details: '' };
  }
  return { base, details };
}

/** A delimited kitchen note after a street is not part of the destination. */
export function splitAddressKitchenNote(source: string): { address: string; note: string; count?: number; all: boolean } | null {
  const match = source.match(/^(.+?)[,;\n]\s*(?:(todos|todas|ambos|ambas|(?:los|las)\s+(?:dos|tres|cuatro|cinco|seis|\d{1,2}))\s+)?(sin\s+.+)$/iu);
  if (!match || !/\b(?:calle|cll?|carrera|cra|kr|diagonal|dg|transversal|tv|avenida)\.?\s*\d/i.test(match[1])) return null;
  const preference = splitKitchenPreference('pedido ' + match[3]);
  if (!preference) return null;
  const scope = (match[2] || '').toLowerCase();
  const counts: Record<string, number> = { dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6 };
  const amount = scope.replace(/^(?:los|las)\s+/, '');
  const count = /^(?:ambos|ambas)$/.test(scope) ? 2 : counts[amount] || (/^\d+$/.test(amount) ? Number(amount) : undefined);
  return { address: match[1].trim(), note: preference.note, count, all: /^(?:todos|todas)$/.test(scope) };
}

/** Replace only supplied access components, retaining the rest of the destination's details. */
export function mergeDeliveryUnitDetails(previous: string, incoming: string): string {
  const groups = ['apartamento|apto|apt|ap', 'interior|int', 'torre', 'bloque', 'casa', 'piso', 'local', 'oficina', 'entrada'];
  const identifier = '[a-z]\\d{0,3}|\\d{1,4}[a-z]?';
  let kept = previous.trim();
  let rest = incoming.trim();
  const additions: string[] = [];
  for (const aliases of groups) {
    const pattern = new RegExp(`\\b(?:${aliases})(?=\\b|\\d)\\.?\\s*(?:#\\s*)?(${identifier})\\b`, 'i');
    const found = rest.match(pattern);
    if (!found) continue;
    if (pattern.test(kept)) kept = kept.replace(pattern, found[0]);
    else additions.push(found[0]);
    rest = rest.replace(pattern, '');
  }
  rest = rest.replace(/^[\s,;]+|[\s,;]+$/g, '').trim();
  return [kept, ...additions, rest].filter(Boolean).join(', ');
}

/** Conflicting labels need clarification before any routing or address mutation. */
export function deliveryUnitConflict(source: string): { label: string; values: string[] } | null {
  const groups: Array<[string,string]> = [
    ['apartamento','apartamento|apto|apt|ap'], ['interior','interior|int'],
    ...['torre','bloque','casa','piso','local','oficina','entrada'].map(label=>[label,label] as [string,string]),
  ];
  for(const [label,aliases] of groups) {
    const pattern=new RegExp(`\\b(?:${aliases})(?=\\b|\\d)\\.?\\s*(?:#\\s*)?([a-z]\\d{0,3}|\\d{1,4}[a-z]?)\\b`,'gi');
    const values=[...new Set([...source.matchAll(pattern)].map(match=>match[1].toUpperCase()))];
    if(values.length>1) return {label,values};
  }
  return null;
}

/** Resolve one explicitly offered unit value without losing the street or other units. */
export function resolveDeliveryUnitConflict(source: string, label: string, value: string): string {
  const aliases = label === 'apartamento' ? 'apartamento|apto|apt|ap' : label === 'interior' ? 'interior|int' : label;
  if (!['apartamento','interior','torre','bloque','casa','piso','local','oficina','entrada'].includes(label)) return source;
  const pattern = new RegExp(`\\b(?:${aliases})(?=\\b|\\d)\\.?\\s*(?:#\\s*)?([a-z]\\d{0,3}|\\d{1,4}[a-z]?)\\b`, 'gi');
  let replaced = false;
  return source.replace(pattern, () => {
    if (replaced) return '';
    replaced = true;
    return `${label} ${value}`;
  }).replace(/\s+/g, ' ').trim();
}

/** Preserve spoken street/door numbers before contact-clause extraction. */
export function normalizeDictatedStreet(source: string): string {
  return source.replace(/\b((?:calle|carrera|cra|cll?|transversal|diagonal|avenida)\s+\d{1,3}[a-z]?(?:\s+sur)?)(?:\s+de\s+([\p{L} ]+?))?\s*,?\s*n[uú]mero\s+(\d{1,3}[a-z]?)\s*(?:de\s+casa\s+|casa\s+|-|\s)(\d{1,3})(?!\d)/giu,
    (_all,road,city,cross,door)=>`${road} #${cross}-${door}${city?`, ${city.trim()}`:''}`);
}
