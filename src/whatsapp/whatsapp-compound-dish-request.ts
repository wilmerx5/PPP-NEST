/**
 * A counted dish followed by its named component and a drink exclusion can
 * identify a single catalog dish even when speech transcription uses a comma.
 * Only rewrite a whole, unambiguous request; never infer a discount or a combo.
 */
export function canonicalCompoundDishRequest(
  text: string,
  products: Array<{ name: string }>,
): string | null {
  if (/[?¿\n]/.test(text)) return null;
  const normalize = (value: string) => value.toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  const raw = normalize(text).replace(/[.!]+$/, '').trim()
    .replace(/^(?:buen dia|buenos dias|buenas tardes|buenas noches|hola)[, ]+/, '')
    .replace(/^por favor[, ]+/, '')
    .replace(/^(?:quiero|dame|me das|me regalas)\s+/, '');
  const match = raw.match(/^(un|una|uno|dos|tres|cuatro|cinco|\d{1,2}) ([a-z ]+?)(?:,\s*| con )([a-z ]+?)\s+(?:y )?sin (gaseosa|bebida|refresco)[.!]*$/);
  if (!match) return null;
  const [ , count, base, component, excluded ] = match;
  if (/\b(?:y|otro|otra|aparte|separado|separados|combo|si|no|sin|con|un|una|dos|tres)\b/.test(base + ' ' + component)) return null;
  const quantity = ({ un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5 } as Record<string, number>)[count] ?? Number(count);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 30) return null;
  const requested = base.trim() + ' con ' + component.trim();
  // Include unavailable products in uniqueness: never fall back to components
  // just because the intended composed dish is out of stock.
  const candidates = products.filter(product => {
    const name = normalize(product.name);
    return name === requested || name.startsWith(requested + ' ');
  });
  if (candidates.length !== 1) return null;
  return `${quantity === 1 ? "un" : quantity} ${candidates[0].name} sin ${excluded}`;
}
