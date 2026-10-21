import { splitKitchenPreference } from './whatsapp-kitchen-preference';

/** Keep labelled internal access identifiers for the driver, out of map queries.
 * A standalone unit or a building name is not an external destination. */
export function splitDeliveryAddressParts(source: string): { base: string; details: string } {
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
