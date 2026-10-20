import type { WhatsappCatalogProduct, WhatsappCatalogService } from './whatsapp-catalog.service';

/** "Dos combos, uno con colombiana y el otro con coca cola" → dos líneas del mismo SKU. */
export function expandSpokenSameSkuPair(text: string, products: WhatsappCatalogProduct[], catalog: WhatsappCatalogService): string {
  return expandSpokenSameSkuNotes(expandSpokenAttributePair(text, products, catalog), products, catalog);
}

function expandSpokenAttributePair(text: string, products: WhatsappCatalogProduct[], catalog: WhatsappCatalogService): string {
  const quantities: Record<string, number> = { un: 1, una: 1, uno: 1, dos: 2 };
  const quantity = (word: string) => quantities[word.toLowerCase()] ?? Number(word);
  return text.replace(/\b(\d{1,2}|dos)\s+([^,:\n.]{3,70}?)\s*,?\s*(?:uno|una)\s+con\s+([^,\n.]{2,40}?)\s+y\s+(?:el|la)\s+otr[oa]\s+con\s+([^,\n.]{2,40}?)(?=\s*(?:,|para\b|pago\b|[.!?]|$))/gi,
    (original, totalWord: string, subject: string, left: string, right: string) => {
      if (quantity(totalWord) !== 2) return original;
      const singular = subject.replace(/\bcombos\b/gi, 'combo');
      let candidates = catalog.findAllProductsEmbeddedInMessage(singular, products)
        .filter(product => product.availableNow !== false && product.attributes?.length);
      if (candidates.length > 1) {
        const ranked = [...candidates].sort((a, b) => b.name.length - a.name.length);
        const longest = ranked[0];
        const longestName = longest.name.toLowerCase();
        if (ranked.slice(1).every(other => longestName.includes(other.name.toLowerCase()))) candidates = [longest];
      }
      if (candidates.length !== 1) return original;
      const product = candidates[0];
      for (const choice of [left, right]) {
        const parsed = catalog.resolveAttributesFromMessage(product, `con ${choice.trim()}`, []);
        if (parsed.status === 'invalid' || !parsed.attributes.length) return original;
      }
      return `1 ${product.name} con ${left.trim()} y 1 ${product.name} con ${right.trim()}`;
    });
}

function expandSpokenSameSkuNotes(text: string, products: WhatsappCatalogProduct[], catalog: WhatsappCatalogService): string {
  const quantities: Record<string, number> = { un: 1, una: 1, uno: 1, dos: 2 };
  const quantity = (word: string) => quantities[word.toLowerCase()] ?? Number(word);
  const noteKey = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  return text.replace(/\b(\d{1,2}|dos)\s+([^,:\n.]{3,70}?)\s*,?\s*(?:uno|una)\s+(sin\s+[^,\n.]{2,40}?)\s+y\s+(?:el|la)\s+otr[oa]\s+(sin\s+[^,\n.]{2,40}?)(?=\s*(?:,|para\b|pago\b|[.!?]|$))/gi,
    (original, totalWord: string, subject: string, left: string, right: string) => {
      if (quantity(totalWord) !== 2 || noteKey(left) === noteKey(right)) return original;
      let candidates = catalog.findAllProductsEmbeddedInMessage(subject, products)
        .filter(product => product.availableNow !== false);
      if (candidates.length > 1) {
        const ranked = [...candidates].sort((a, b) => b.name.length - a.name.length);
        const longest = ranked[0];
        const longestName = longest.name.toLowerCase();
        if (ranked.slice(1).every(other => longestName.includes(other.name.toLowerCase()))) candidates = [longest];
      }
      if (candidates.length !== 1) return original;
      const product = candidates[0];
      return `1 ${product.name} ${left.trim()} y 1 ${product.name} ${right.trim()}`;
    });
}

function attributeOwner(subject: string, products: WhatsappCatalogProduct[], catalog: WhatsappCatalogService): WhatsappCatalogProduct | undefined {
  const words = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9ñ]+/).filter(Boolean).map(word => word.replace(/(?<=[a-z]{3})(?:es|s)$/, ''));
  let candidates = catalog.findAllProductsEmbeddedInMessage(subject, products)
    .filter(p => p.availableNow !== false && p.attributes?.length);
  const said = new Set(words(subject));
  const covered = candidates.filter(product => words(product.name).every(word => said.has(word)));
  if (covered.length) candidates = covered;
  if (candidates.length > 1) {
    const [longest, ...rest] = [...candidates].sort((a, b) => b.name.length - a.name.length);
    if (rest.every(other => longest.name.toLowerCase().includes(other.name.toLowerCase()))) candidates = [longest];
  }
  return candidates.length === 1 ? candidates[0] : undefined;
}

export function expandDistributedVariants(text: string, products: WhatsappCatalogProduct[], catalog: WhatsappCatalogService): string {
  text = expandSpokenSameSkuPair(text, products, catalog);
  const quantities: Record<string, number> = { un: 1, una: 1, uno: 1, otro: 1, otra: 1, dos: 2, tres: 3,
    cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 };
  const quantity = (word: string) => quantities[word.toLowerCase()] ?? Number(word);
  const expand = (original: string, totalWord: string, subject: string, distribution: string) => {
      const product = attributeOwner(subject, products, catalog);
      if (!product) return original;
      const parts = distribution.split(/\s+y\s+(?=(?:(?:el|la)\s+)?(?:un[ao]?|otr[oa]|\d{1,2}|dos|tres|cuatro|cinco)\b)/i);
      if (parts.length < 2) return original;
      const lines: string[] = []; let total = 0;
      for (const part of parts) {
        const match = part.trim().replace(/^(?:el|la)\s+(?=otr[oa]\b)/i, '').match(/^(un[ao]?|otr[oa]|\d{1,2}|dos|tres|cuatro|cinco)\s+(.+)$/i);
        if (!match) return original;
        const count = quantity(match[1]);
        const parsed = catalog.resolveAttributesFromMessage(product, match[2], []);
        if (!Number.isInteger(count) || count < 1 || count > 30 || parsed.status === 'invalid' || !parsed.attributes.length ||
          catalog.uncoveredWordsAnchoredByProduct(`${product.name} ${match[2]}`, product, products).length) return original;
        total += count; lines.push(`${count} ${product.name} ${match[2]}`);
      }
      return total === quantity(totalWord) ? lines.join(' y ') : original;
  };
  const count = String.raw`(?:(?:el|la)\s+)?(?:un[ao]?|otr[oa]|\d{1,2}|dos|tres|cuatro|cinco)`;
  // "una sopa pequeña de ajiaco y una de menudencias": the second count inherits the dish.
  // "una sopa de ajiaco y una de menudencias" keeps two products when both names exist.
  text = text.replace(/\b(un[ao]?|\d{1,2}|dos|tres)\s+([^:;.,\n]{3,40}?)\s+(de\s+[^:;.,\n]+?)\s+y\s+(un[ao]?|otr[oa]|\d{1,2}|dos|tres)\s+(de\s+[^:;.,\n]+?)(?=\s*(?:[,;.\n!]|para\b|$))/gi,
    (original, leftCount: string, subject: string, left: string, rightCount: string, right: string) => {
      if (/\b(?:un[ao]?|otr[oa]|dos|tres|cuatro|cinco|\d{1,2})\b/i.test(subject)) return original;
      const owner = attributeOwner(subject, products, catalog);
      if (!owner) return original;
      const named = [left, right].map(choice => catalog.findProductEmbeddedInMessage(`${subject} ${choice}`, products));
      if (named.some(product => product && product.id !== owner.id)) return original;
      const total = quantity(leftCount) + quantity(rightCount);
      const expanded = expand(original, String(total), subject, `${leftCount} ${left} y ${rightCount} ${right}`);
      return expanded === original ? original : expanded;
    });
  return text
    .replace(/\b(\d{1,2}|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+([^:;.\n]{3,65}?)\s*:\s*([^;.\n]+)(?=[;.\n]|$)/gi, expand)
    // "dos sopas pequeñas(,) una de ajiaco y una de menudencias": the same split without a colon.
    .replace(new RegExp(String.raw`\b(\d{1,2}|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+([^:;.,\n]{3,65}?)\s*,?\s+(${count}\s+de\s+[^:;.,\n]+?(?:\s+y\s+${count}\s+de\s+[^:;.,\n]+?)+)(?=\s*(?:[,;.\n!]|para\b|$))`, 'gi'), expand);
}
