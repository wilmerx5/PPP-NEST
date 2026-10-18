import type { AiOrderAction, WhatsappCartItem } from './types/whatsapp-session.types';
import type { WhatsappCatalogProduct, WhatsappCatalogService } from './whatsapp-catalog.service';

/** One request describes ONE subset. All its attributes belong to those same units. */
export type UnitOptionEdit = NonNullable<AiOrderAction['updateUnitOptions']>[number];
export type UnitOptionPlan =
  | { ok: false; reason: string; cartLineIndex?: number }
  | { ok: true; changed: boolean; cart: WhatsappCartItem[]; edits: UnitOptionEdit[];
      partitions: Array<{ sourceIndex: number; unchangedQuantity: number; changedQuantity: number }> };

/** Prepare the entire edit before mutation. Indexes always identify the input snapshot.
 * Tools expose a read-only projection after partition; edits keep original IDs.
 * Mixed mutations must pass prepareUnitOptionActions before this function is used.
 */
export function prepareUnitOptionPlan(
  cart: WhatsappCartItem[],
  edits: UnitOptionEdit[],
  products: WhatsappCatalogProduct[],
  catalog: Pick<WhatsappCatalogService, 'matchAttributeOptionValue'>,
): UnitOptionPlan {
  if (!Array.isArray(edits) || !edits.length) return { ok: false, reason: 'empty_edits' };
  const prepared = new Map<number, { quantity: number; attributes: UnitOptionEdit['attributes']; note?: string; noteMode?: UnitOptionEdit['noteMode'] }>();
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
    if (edit.noteMode !== undefined && !['append','replace','clear'].includes(edit.noteMode)) return fail('invalid_note_mode');
    if (edit.noteMode === 'clear' && edit.note !== undefined) return fail('ambiguous_subset_note');
    if (edit.noteMode === 'replace' && edit.note === undefined) return fail('missing_replacement_note');
    if (edit.note !== undefined && (typeof edit.note !== 'string' || !edit.note.trim() || edit.note.length > 500)) {
      return fail('invalid_subset_note');
    }
    prepared.set(index, { quantity: edit.affectedQuantity, attributes,
      ...(edit.note !== undefined ? { note: edit.note.trim() } : {}),
      ...(edit.noteMode !== undefined ? { noteMode: edit.noteMode } : {}) });
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
    if (edit.noteMode === 'clear') {
      if (line.note) { delete line.note; lineChanged = true; }
    } else if (edit.noteMode === 'replace') {
      if (line.note !== edit.note) { line.note = edit.note; lineChanged = true; }
    } else if (edit.note !== undefined) {
      const key = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
      const prior = line.note || '';
      if (key(prior) !== key(edit.note) && !prior.split(/[,;\n]/).some(part => key(part) === key(edit.note!))) {
        line.note = prior ? `${prior}, ${edit.note}` : edit.note;
        lineChanged = true;
      }
    }
    if (!lineChanged) return [line];
    changed = true;
    const remaining = original.quantity - edit.quantity;
    partitions.push({ sourceIndex, unchangedQuantity: remaining, changedQuantity: edit.quantity });
    const modified = { ...line, quantity: edit.quantity, attributes };
    return remaining ? [{ ...clone(original), quantity: remaining }, modified] : [modified];
  });
  const normalized = [...prepared.entries()].sort(([a], [b]) => a - b).map(([cartLineIndex, edit]) => ({
    productId: cart[cartLineIndex].productId, cartLineIndex,
    affectedQuantity: edit.quantity, attributes: edit.attributes,
    ...(edit.note !== undefined ? { note: edit.note } : {}),
    ...(edit.noteMode !== undefined ? { noteMode: edit.noteMode } : {}),
  }));
  return { ok: true, changed, cart: result, partitions, edits: normalized };
}

/** Partial edits are atomic. Mixed purchases/removals/approval are deferred rather
 * than applying a valid fragment and claiming that the whole request succeeded. */
export function prepareUnitOptionActions(
  cart: WhatsappCartItem[], actions: AiOrderAction, products: WhatsappCatalogProduct[],
  catalog: Pick<WhatsappCatalogService, 'matchAttributeOptionValue'>,
): UnitOptionPlan {
  const mixed = Object.entries(actions).some(([key, value]) => key !== 'updateUnitOptions' &&
    (Array.isArray(value) ? value.length > 0 : !!value));
  if (mixed) return { ok: false, reason: 'mixed_unit_option_actions' };
  return prepareUnitOptionPlan(cart, actions.updateUnitOptions!, products, catalog);
}
