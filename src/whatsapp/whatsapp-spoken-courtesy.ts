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

/** "una porción adicional de arroz" names the catalog portion "Porción De Arroz", not a dish with rice. */
export function foldAdditionalPortion(text: string): string {
  return text.replace(/\b(porci[oó]n(?:es)?)\s+(?:adicional(?:es)?|extra|aparte)\s+(de)\b/gi, '$1 $2');
}

/** "Un arroz con pollo si es tan amable": a closing courtesy is not part of the dish name. */
export function stripTrailingCourtesy(text: string): string {
  const stripped = text.replace(
    /[\s,]+si\s+(?:es|eres|fuera|fueras|fuese|me\s+hace|me\s+haces)\s+(?:tan\s+(?:amable|gentil)|el\s+favor)[\s,.!]*$/i,
    '',
  ).trim();
  return /\p{L}/u.test(stripped) ? stripped : text;
}
