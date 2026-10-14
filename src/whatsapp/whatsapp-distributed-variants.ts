import type { WhatsappCatalogProduct, WhatsappCatalogService } from './whatsapp-catalog.service';

/** "Dos combos, uno con colombiana y el otro con coca cola" → dos líneas del mismo SKU. */
export function expandSpokenSameSkuPair(text: string, products: WhatsappCatalogProduct[], catalog: WhatsappCatalogService): string {
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

export function expandDistributedVariants(text: string, products: WhatsappCatalogProduct[], catalog: WhatsappCatalogService): string {
  text = expandSpokenSameSkuPair(text, products, catalog);
  const quantities: Record<string, number> = { un: 1, una: 1, uno: 1, otro: 1, otra: 1, dos: 2, tres: 3,
    cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 };
  const quantity = (word: string) => quantities[word.toLowerCase()] ?? Number(word);
  return text.replace(/\b(\d{1,2}|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+([^:;.\n]{3,65}?)\s*:\s*([^;.\n]+)(?=[;.\n]|$)/gi,
    (original, totalWord: string, subject: string, distribution: string) => {
      const candidates = catalog.findAllProductsEmbeddedInMessage(subject, products)
        .filter(p => p.availableNow !== false && p.attributes?.length);
      if (candidates.length !== 1) return original;
      const product = candidates[0];
      const parts = distribution.split(/\s+y\s+(?=(?:un[ao]?|otr[oa]|\d{1,2}|dos|tres|cuatro|cinco)\b)/i);
      if (parts.length < 2) return original;
      const lines: string[] = []; let total = 0;
      for (const part of parts) {
        const match = part.trim().match(/^(un[ao]?|otr[oa]|\d{1,2}|dos|tres|cuatro|cinco)\s+(.+)$/i);
        if (!match) return original;
        const count = quantity(match[1]);
        const parsed = catalog.resolveAttributesFromMessage(product, match[2], []);
        if (!Number.isInteger(count) || count < 1 || count > 30 || parsed.status === 'invalid' || !parsed.attributes.length ||
          catalog.uncoveredWordsAnchoredByProduct(`${product.name} ${match[2]}`, product, products).length) return original;
        total += count; lines.push(`${count} ${product.name} ${match[2]}`);
      }
      return total === quantity(totalWord) ? lines.join(' y ') : original;
    });
}
