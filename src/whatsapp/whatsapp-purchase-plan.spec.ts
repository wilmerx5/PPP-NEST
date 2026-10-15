import { readFileSync } from 'fs';
import { join } from 'path';
import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { prepareValidatedPurchases } from './whatsapp-purchase-plan';

const menu = JSON.parse(
  readFileSync(
    join(__dirname, '../../scripts/fixtures/whatsapp-alternate-menu.json'),
    'utf8',
  ),
);
const catalog = new WhatsappCatalogService({} as never);
const prepare = (additions, extra = {}) =>
  prepareValidatedPurchases({
    additions,
    products: menu,
    catalog,
    forcedQty: 1,
    resolveQuantity: (evidence) => evidence.aiQuantity ?? 1,
    ...extra,
  });

describe('Purchase plan contract — no transport or session writes', () => {
  it('preserves structured quantities, notes and choices independently of product order', () => {
    const additions = [
      { productId: 501, quantity: 2, note: 'sin cebolla' },
      {
        productId: 502,
        quantity: 3,
        attributes: [{ attributeName: 'Salsa', attributeValue: 'Tahini' }],
      },
    ];
    const before = structuredClone(additions);
    const result = prepare(additions);
    const reordered = prepare(additions, { products: [...menu].reverse() });
    expect(result).toEqual(reordered);
    expect(
      result.lines.map((line) => [line.product.id, line.quantity]),
    ).toEqual([
      [501, 2],
      [502, 3],
    ]);
    expect(result.lines[0].note).toBe('sin cebolla');
    expect(result.lines[1].attributes).toEqual(additions[1].attributes);
    result.lines[1].attributes![0].attributeValue = 'Yogur';
    expect(additions).toEqual(before);
  });

  it('exposes quantity overrides rather than silently replacing the proposal', () => {
    const result = prepare([{ productId: 501, quantity: 3 }], {
      resolveQuantity: () => 1,
    });
    expect(result.lines[0].quantity).toBe(1);
    expect(result.diagnostics).toEqual([
      {
        code: 'quantity_recomputed',
        productId: 501,
        proposedQuantity: 3,
        resolvedQuantity: 1,
      },
    ]);
  });

  it('merges duplicate calls for the same clause without mutating their evidence', () => {
    const additions = [
      { productId: 501, quantity: 1 },
      { productId: 501, quantity: 1 },
    ];
    const result = prepare(additions, { sourceText: 'Dos bowls andinos' });
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].quantity).toBe(2);
    expect(result.diagnostics).toContainEqual({
      code: 'duplicate_proposals_merged',
      productId: 501,
    });
    expect(additions.map((line) => line.quantity)).toEqual([1, 1]);
  });

  it('keeps distinct choices and notes as distinct lines', () => {
    const result = prepare(
      [
        {
          productId: 502,
          quantity: 2,
          attributes: [{ attributeName: 'Salsa', attributeValue: 'Tahini' }],
        },
        {
          productId: 502,
          quantity: 1,
          attributes: [{ attributeName: 'Salsa', attributeValue: 'Yogur' }],
        },
        { productId: 502, quantity: 1, note: 'sin cebolla' },
      ],
      { sourceText: 'Wrap vegetariano' },
    );
    expect(result.lines).toHaveLength(3);
    expect(result.lines.map((line) => line.quantity)).toEqual([2, 1, 1]);
    expect(result.diagnostics).toEqual([]);
  });

  it('exposes the existing side filtering policy for the next migration', () => {
    const products = [
      {
        id: 1,
        code: 1,
        name: 'Pollo Frito',
        price: 10000,
        hasAttributes: false,
        attributes: [],
      },
      {
        id: 2,
        code: 2,
        name: 'Porcion De Papa Salada',
        price: 3000,
        hasAttributes: false,
        attributes: [],
      },
    ];
    const result = prepare(
      [
        { productId: 1, quantity: 1 },
        { productId: 2, quantity: 1 },
      ],
      {
        products,
        sourceText: 'Quiero pollo frito con papa salada',
        catalog: {
          ...catalog,
          looksLikeMultiItemOrderMessage: () => false,
          countQuantityMentions: () => 1,
          extractProductModificationNote: () => 'con papa salada',
          orderSegmentForProduct: (text) => text,
          looksLikeClearlyMultiDishOrder: () => false,
          extractExplicitAttributeChoice: () => null,
        },
      },
    );
    expect(result.lines.map((line) => line.product.id)).toEqual([1]);
    expect(result.diagnostics).toContainEqual({
      code: 'purchase_filtered_as_side',
      productId: 2,
    });
  });

  it('does not invent a product for a query or an unknown id', () => {
    expect(prepare([]).lines).toEqual([]);
    expect(prepare([{ productId: 99999, quantity: 4 }]).lines).toEqual([]);
  });
});
