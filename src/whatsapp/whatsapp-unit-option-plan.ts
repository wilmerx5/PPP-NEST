import type { WhatsappCartItem } from './types/whatsapp-session.types';
import type { WhatsappCatalogProduct, WhatsappCatalogService } from './whatsapp-catalog.service';

/** One request describes ONE subset. All its attributes belong to those same units. */
export type UnitOptionEdit = {
  productId: number;
  cartLineIndex: number;
  affectedQuantity: number;
  attributes: Array<{ attributeName: string; attributeValue: string }>;
};
export type UnitOptionPlan =
  | { ok: false; reason: string; cartLineIndex?: number }
  | { ok: true; changed: boolean; cart: WhatsappCartItem[];
      partitions: Array<{ sourceIndex: number; unchangedQuantity: number; changedQuantity: number }> };

/** Prepare the entire edit before mutation. Indexes always identify the input snapshot.
 * Deliberately not wired to model tools yet: callers must invalidate old projected IDs
 * after applying a partition and validate mixed purchase/approval actions separately.
 */
export function prepareUnitOptionPlan(
  cart: WhatsappCartItem[],
  edits: UnitOptionEdit[],
  products: WhatsappCatalogProduct[],
  catalog: Pick<WhatsappCatalogService, 'matchAttributeOptionValue'>,
): UnitOptionPlan {
  if (!Array.isArray(edits) || !edits.length) return { ok: false, reason: 'empty_edits' };
  const prepared = new Map<number, { quantity: number; attributes: UnitOptionEdit['attributes'] }>();
  for (const edit of edits) {
    const index = edit?.cartLineIndex;
    const fail = (reason: string): UnitOptionPlan => ({ ok: false, reason, cartLineIndex: index });
    if (!Number.isInteger(index) || index < 0 || !cart[index] || cart[index].productId !== edit.productId) {
      return fail('invalid_cart_line');
    }
    if (prepared.has(index)) return fail('overlapping_subsets');
    const line = cart[index];
    if (!Number.isInteger(line.quantity) || line.quantity < 1 ||
      !Number.isInteger(edit.affectedQuantity) || edit.affectedQuantity < 1 || edit.affectedQuantity > line.quantity) {
      return fail('invalid_affected_quantity');
    }
    const product = products.find(candidate => candidate.id === edit.productId);
    if (!product || product.availableNow === false) return fail('unavailable_product');
    if (!Array.isArray(edit.attributes) || !edit.attributes.length) return fail('empty_attributes');
    const seen = new Set<string>();
    const attributes: UnitOptionEdit['attributes'] = [];
    for (const option of edit.attributes) {
      if (typeof option?.attributeName !== 'string' || typeof option.attributeValue !== 'string') {
        return fail('invalid_attribute');
      }
      const name = option.attributeName.trim().toLowerCase();
      if (seen.has(name)) return fail('duplicate_attribute');
      seen.add(name);
      const attribute = product.attributes?.find(candidate => candidate.attributeName.toLowerCase() === name);
      const matched = attribute && catalog.matchAttributeOptionValue(option.attributeValue, attribute.options);
      if (!attribute || !matched) return fail('unknown_option');
      // A fuzzy flavor match must not silently discard a requested milk/water base.
      if (/\b(?:agua|leche)\b/i.test(option.attributeValue) && !/\b(?:agua|leche)\b/i.test(matched)) {
        return fail('unknown_option');
      }
      attributes.push({ attributeName: attribute.attributeName, attributeValue: matched });
    }
    prepared.set(index, { quantity: edit.affectedQuantity, attributes });
  }

  const partitions: Extract<UnitOptionPlan, { ok: true }>['partitions'] = [];
  let changed = false;
  const clone = (line: WhatsappCartItem): WhatsappCartItem => ({ ...line,
    attributes: line.attributes?.map(attribute => ({ ...attribute })) });
  const result = cart.flatMap((original, sourceIndex) => {
    const line = clone(original);
    const edit = prepared.get(sourceIndex);
    if (!edit) return [line];
    const attributes = line.attributes || [];
    let lineChanged = false;
    for (const option of edit.attributes) {
      const index = attributes.findIndex(attribute => attribute.attributeName.toLowerCase() === option.attributeName.toLowerCase());
      if (index >= 0 && attributes[index].attributeValue === option.attributeValue) continue;
      lineChanged = true;
      if (index >= 0) attributes[index] = { ...option };
      else attributes.push({ ...option });
    }
    if (!lineChanged) return [line];
    changed = true;
    const remaining = original.quantity - edit.quantity;
    partitions.push({ sourceIndex, unchangedQuantity: remaining, changedQuantity: edit.quantity });
    const modified = { ...line, quantity: edit.quantity, attributes };
    return remaining ? [{ ...clone(original), quantity: remaining }, modified] : [modified];
  });
  return { ok: true, changed, cart: result, partitions };
}
