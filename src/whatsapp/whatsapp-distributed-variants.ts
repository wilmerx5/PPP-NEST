import type { WhatsappCatalogProduct, WhatsappCatalogService } from './whatsapp-catalog.service';

/** Expand a verified total into the separately quantified options of one SKU. */
export function expandDistributedVariants(text: string, products: WhatsappCatalogProduct[], catalog: WhatsappCatalogService): string {
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
