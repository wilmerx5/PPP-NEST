/** Remove boundary courtesy around an explicit request, preserving dish clauses and notes. */
export function normalizeSpokenOrderCourtesy(text: string): string {
  const separator = '[\\s,.!]*';
  let body = text.trim();
  const request = /\bme\s+(?:env[ií]a|manda|trae|regala)\b/i;
  if (!request.test(body)) return body;
  body = body
    .replace(/^(?:hola|buenas(?:\s+tardes|\s+noches)?|buenos\s+d[ií]as)[\s,.!]+/i, '')
    .replace(new RegExp(`^me${separator}hace${separator}(?:el${separator})?favor${separator}`, 'i'), '')
    .replace(/^por\s+favor[\s,.!]+/i, '')
    .replace(/^me\s+(?:env[ií]a|manda|trae|regala)\s+/i, 'Quiero ')
    .replace(/[\s,.!]+(?:muchas\s+)?gracias[\s,.!]*$/i, '')
    .replace(/[.!]+$/, '').trim();
  return body;
}
