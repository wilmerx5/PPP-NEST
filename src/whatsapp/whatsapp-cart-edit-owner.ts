import type { WhatsappCartItem } from './types/whatsapp-session.types';
import { normalizeCorrection } from './whatsapp-quantity-correction';

type CartLine = Pick<WhatsappCartItem, 'productId' | 'attributes' | 'note'> & {
  cartLineIndex: number;
};
const normalize = (text: string) =>
  normalizeCorrection(text)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** A valid model index must also identify the variant named by the customer. */
export function hasExplicitCartEditOwner(
  text: string,
  lines: CartLine[],
  productId: number,
  cartLineIndex: number,
  proposedNote?: string,
): boolean {
  const variants = lines.filter((line) => line.productId === productId);
  if (variants.length < 2) return true;
  const message = normalize(text)
    .replace(
      /\bno (?:me )?(?:agregues|anadas|sumes) (?:otr[oa]|mas|ningun[oa])\b.*$/,
      '',
    )
    .split(
      /\b(?:direccion|calle|cll|carrera|cra|diagonal|dg|transversal|tv|casa|manzana|bloque|torre|apto|apartamento)\s+(?:numero\s+)?(?=\d)|\bdireccion\b/,
    )[0]
    .trim();
  if (/\b(?:no|excepto|conserva|conserves)\b/.test(message)) return false;
  const references = [
    ...message.matchAll(/\b(?:linea|fila|item|numero)\s+(\d+)\b/g),
  ];
  const numberedOwner =
    references.length === 1 && Number(references[0][1]) === cartLineIndex + 1;
  if (references.length && !numberedOwner) return false;
  const destinationNote = normalize(proposedNote || '');
  const candidates = variants.filter((line) => {
    const values = [
      ...(line.attributes || []).map((attribute) => attribute.attributeValue),
      line.note || '',
    ];
    return values.some((value) => {
      const current = normalize(value);
      if (!current || current === destinationNote) return false;
      const isOption = (line.attributes || []).some(attribute => normalize(attribute.attributeValue) === current);
      const aliases = isOption && !/^(?:sin|no|cero|ningun|ninguna)\b/.test(current)
        ? [...new Set([current, ...current.split(' ').filter(word => word.length >= 4)])]
        : [current];
      return aliases.some(alias => {
        const shared = variants.some(peer => peer.cartLineIndex !== line.cartLineIndex &&
          [...(peer.attributes || []).map(attribute => normalize(attribute.attributeValue)), normalize(peer.note || '')]
            .some(other => alias === current ? other === current : (` ${other} `).includes(` ${alias} `)));
        if (shared) return false;
        const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(
          `\\b(?:de|del|entre|que tiene|que lleva|que va) (?:los |las |el |la )?(?:de )?${escaped}(?:s|es)?\\b`,
        ).test(message);
      });
    });
  });
  return candidates.length === 1
    ? candidates[0].cartLineIndex === cartLineIndex
    : candidates.length === 0 && numberedOwner;
}
