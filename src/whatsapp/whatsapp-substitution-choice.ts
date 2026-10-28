/** A bounded kitchen substitution with two alternatives, not a separate purchase.
 * Delimiters stop at the next option, destination, sentence or purchase. */
export function parseSubstitutionChoice(
  text: string,
): { removed: string; choices: [string, string] } | null {
  const phrase = '[\\p{L}]+(?:\\s+[\\p{L}]+){0,2}?';
  const pattern = new RegExp(
    `\\ben\\s+ve[sz]\\s+de\\s+(?:la\\s+|el\\s+)?(${phrase})\\s+(?:m[aá]s|por)\\s+(${phrase})\\s+o\\s+(${phrase})(?=\\s+(?:con|sin|para|y|por favor|gracias)\\b|[,;.\\n!?]|$)`,
    'iu',
  );
  const match = pattern.exec(text);
  if (!match) return null;
  const parts = match.slice(1).map((value) => value.trim());
  if (
    parts.some((value) =>
      /\b(?:un|una|dos|tres|otro|otra|agrega|quiero|dame|no|si|con|sin|y|o|para)\b/i.test(
        value,
      ),
    )
  )
    return null;
  if (parts[1].toLocaleLowerCase() === parts[2].toLocaleLowerCase())
    return null;
  return { removed: parts[0], choices: [parts[1], parts[2]] };
}

/** Remove one bounded substitution so its alternatives are not purchased as dishes. */
export function omitSubstitutionChoice(text: string): string {
  if (!parseSubstitutionChoice(text)) return text;
  const phrase = '[\\p{L}]+(?:\\s+[\\p{L}]+){0,2}?';
  return text.replace(
    new RegExp(
      `\\ben\\s+ve[sz]\\s+de\\s+(?:la\\s+|el\\s+)?${phrase}\\s+(?:m[aá]s|por)\\s+${phrase}\\s+o\\s+${phrase}(?=\\s+(?:con|sin|para|y|por favor|gracias)\\b|[,;.\\n!?]|$)`,
      'iu',
    ),
    ' ',
  );
}
