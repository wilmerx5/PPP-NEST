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
