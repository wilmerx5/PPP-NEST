import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { prepareUnitOptionPlan, type UnitOptionEdit } from './whatsapp-unit-option-plan';

const catalog = new WhatsappCatalogService({} as never);
const menus = ['Caja De Falafel', 'Bento Vegetal', 'Combo De Arepas'].map((name, i) => ({
  id: 9501 + i, code: 9501 + i, name, price: 27000 + i * 1000, availableNow: true,
  hasAttributes: true, attributes: [{ attributeName: 'Bebida', options: ['Te Frio', 'Limonada'] },
    { attributeName: 'Salsa', options: ['Suave', 'Picante'] }],
}));
const line = (product = menus[0], quantity = 4) => ({ productId: product.id, code: product.code,
  name: product.name, quantity, unitPrice: product.price - 1000, note: 'sin cebolla',
  attributes: [{ attributeName: 'Bebida', attributeValue: 'Te Frio' }, { attributeName: 'Salsa', attributeValue: 'Suave' }] });
const edit = (overrides: Partial<UnitOptionEdit> = {}): UnitOptionEdit => ({
  productId: menus[0].id, cartLineIndex: 0, affectedQuantity: 2,
  attributes: [{ attributeName: 'Bebida', attributeValue: 'Limonada' }], ...overrides,
});
const plan = (cart = [line()], edits = [edit()], products = menus) => prepareUnitOptionPlan(cart, edits, products, catalog);
const freeze = (value: any) => { Object.freeze(value); Object.values(value).forEach(child => {
  if (child && typeof child === 'object' && !Object.isFrozen(child)) freeze(child);
}); return value; };

describe('Grouped unit option plan — catalog-independent atomic preparation', () => {
  for (const product of menus) for (const quantity of [1, 2, 3, 4, 10, 31]) {
    for (const affectedQuantity of [...new Set([1, Math.ceil(quantity / 2), quantity])]) {
      it(`${product.name}: ${affectedQuantity} of ${quantity}, prices and all other fields conserved`, () => {
        const cart = freeze([line(product, quantity), line(menus[(menus.indexOf(product) + 1) % menus.length], 2)]);
        const before = JSON.stringify(cart);
        const result = plan(cart, [edit({ productId: product.id, affectedQuantity })]);
        expect(result.ok).toBe(true); if (!result.ok) return;
        expect(result.changed).toBe(true); expect(JSON.stringify(cart)).toBe(before);
        expect(result.cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0))
          .toBe(cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0));
        const changed = result.cart.find(item => item.productId === product.id && item.attributes?.[0].attributeValue === 'Limonada')!;
        expect(changed.quantity).toBe(affectedQuantity);
        expect(changed.unitPrice).toBe(cart[0].unitPrice); expect(changed.note).toBe('sin cebolla');
        expect(changed.attributes?.[1]).toEqual(cart[0].attributes[1]);
        const remainder = result.cart.find(item => item.productId === product.id && item.attributes?.[0].attributeValue === 'Te Frio');
        if (quantity > affectedQuantity) expect(remainder?.quantity).toBe(quantity - affectedQuantity);
        else expect(remainder).toBeUndefined();
        expect(result.cart[result.cart.length - 1]).toEqual(cart[1]);
        expect(result.partitions).toEqual([{ sourceIndex: 0, unchangedQuantity: quantity - affectedQuantity, changedQuantity: affectedQuantity }]);
      });
    }
  }
  it('applies two attributes to the same two units, never two different subsets', () => {
    const result = plan([line()], [edit({ attributes: [{ attributeName: 'Bebida', attributeValue: 'Limonada' },
      { attributeName: 'Salsa', attributeValue: 'Picante' }] })]);
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.cart.map(item => [item.quantity, item.attributes?.map(a => a.attributeValue)])).toEqual([
      [2, ['Te Frio', 'Suave']], [2, ['Limonada', 'Picante']],
    ]);
  });
  it.each([0, -1, 1.5, 5, NaN, Infinity, '2', undefined, null])('rejects quantity %s without preparing a partial success', quantity => {
    const cart = freeze([line(), line(menus[1])]);
    expect(plan(cart, [edit(), edit({ productId: menus[1].id, cartLineIndex: 1, affectedQuantity: quantity as number })]))
      .toMatchObject({ ok: false, reason: 'invalid_affected_quantity' });
    expect(cart).toEqual([line(), line(menus[1])]);
  });
  it.each([-1, 1.5, 99, '0', null, undefined])('rejects snapshot index %s', index => {
    expect(plan([line()], [edit({ cartLineIndex: index as number })])).toMatchObject({ ok: false, reason: 'invalid_cart_line' });
  });
  it('rejects a valid index belonging to another SKU', () => {
    expect(plan([line()], [edit({ productId: menus[1].id })])).toMatchObject({ ok: false, reason: 'invalid_cart_line' });
  });
  it.each(['Chocolate', 'Limonada en leche'])('does not discard an invalid requested value %s', value => {
    expect(plan([line()], [edit({ attributes: [{ attributeName: 'Bebida', attributeValue: value }] })]))
      .toMatchObject({ ok: false, reason: 'unknown_option' });
  });
  it.each([[], [{ attributeName: 'Tamaño', attributeValue: 'Grande' }],
    [{ attributeName: 'Bebida', attributeValue: 'Limonada' }, { attributeName: ' bebida ', attributeValue: 'Te Frio' }]].map(attributes => ({ attributes })))
  ('rejects empty, foreign or duplicate attributes %j', ({ attributes }) => {
    expect(plan([line()], [edit({ attributes })])).toMatchObject({ ok: false });
  });
  it.each([2, 1])('rejects overlapping subsets even with count %s', affectedQuantity => {
    expect(plan([line()], [edit(), edit({ affectedQuantity })])).toMatchObject({ ok: false, reason: 'overlapping_subsets' });
  });
  it('resolves two edited rows against the original snapshot after the first splits', () => {
    const result = plan([line(), line(menus[1], 3), line(menus[2])], [edit(), edit({ productId: menus[1].id, cartLineIndex: 1, affectedQuantity: 1 })]);
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.cart.map(item => [item.productId, item.quantity])).toEqual([[9501, 2], [9501, 2], [9502, 2], [9502, 1], [9503, 4]]);
    expect(result.partitions.map(partition => partition.sourceIndex)).toEqual([0, 1]);
  });
  it('requires a distinct snapshot row to distinguish two existing variants of one SKU', () => {
    const second = line(); second.attributes[0].attributeValue = 'Limonada';
    const result = plan([line(), second], [edit()]);
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.cart).toHaveLength(3); expect(result.cart[2]).toEqual(second);
  });
  it('is unchanged when the selected option already exists and does not split unnecessarily', () => {
    const result = plan([line()], [edit({ attributes: [{ attributeName: 'Bebida', attributeValue: 'Te Frio' }] })]);
    expect(result).toMatchObject({ ok: true, changed: false, cart: [line()], partitions: [] });
  });
  it('returns independent clones even for unchanged rows', () => {
    const cart = [line(), line(menus[1])]; const result = plan(cart);
    expect(result.ok).toBe(true); if (!result.ok) return;
    result.cart[0].attributes![0].attributeValue = 'mutated'; result.cart[result.cart.length - 1].note = 'mutated';
    expect(cart).toEqual([line(), line(menus[1])]);
  });
  it('rejects unavailable and removed catalog products without changing the cart', () => {
    expect(plan([line()], [edit()], [])).toMatchObject({ ok: false, reason: 'unavailable_product' });
    expect(plan([line()], [edit()], menus.map(product => ({ ...product, availableNow: false }))))
      .toMatchObject({ ok: false, reason: 'unavailable_product' });
  });
  it('rejects empty requests', () => expect(plan([line()], [])).toMatchObject({ ok: false, reason: 'empty_edits' }));
  it('rejects malformed attributes instead of throwing', () => {
    expect(plan([line()], [edit({ attributes: [null] as any })])).toMatchObject({ ok: false, reason: 'invalid_attribute' });
  });
  it('rejects the whole grouped edit when its second attribute is invalid', () => {
    const cart = freeze([line()]);
    const result = plan(cart, [edit({ attributes: [{ attributeName: 'Bebida', attributeValue: 'Limonada' },
      { attributeName: 'Salsa', attributeValue: 'Inexistente' }] })]);
    expect(result).toMatchObject({ ok: false, reason: 'unknown_option' });
    expect(cart).toEqual([line()]); expect(result).not.toHaveProperty('cart');
  });
  for (const quantity of [0, -1, 2.5, NaN, Infinity]) {
    it(`rejects malformed source quantity ${quantity}`, () => {
      expect(plan([line(menus[0], quantity)])).toMatchObject({ ok: false, reason: 'invalid_affected_quantity' });
    });
  }
  it('keeps a request with one valid and one invalid row entirely unapplied', () => {
    const cart = freeze([line(), line(menus[1])]);
    expect(plan(cart, [edit(), edit({ productId: menus[1].id, cartLineIndex: 1,
      attributes: [{ attributeName: 'Bebida', attributeValue: 'Inexistente' }] })]))
      .toMatchObject({ ok: false, reason: 'unknown_option', cartLineIndex: 1 });
    expect(cart).toEqual([line(), line(menus[1])]);
  });
  it('handles two variants of the same SKU with independent source indexes and prices', () => {
    const first = line(); const second = line(); second.unitPrice = 20000; second.note = 'sin hielo';
    const result = plan([first, second], [edit(), edit({ cartLineIndex: 1, affectedQuantity: 1,
      attributes: [{ attributeName: 'Salsa', attributeValue: 'Picante' }] })]);
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.cart.map(item => [item.quantity, item.unitPrice, item.note])).toEqual([
      [2, first.unitPrice, first.note], [2, first.unitPrice, first.note], [3, 20000, 'sin hielo'], [1, 20000, 'sin hielo'],
    ]);
    expect(result.cart[3].attributes?.map(attribute => attribute.attributeValue)).toEqual(['Te Frio', 'Picante']);
  });
  it('is independent of request ordering because all edits address the original snapshot', () => {
    const cart = [line(), line(menus[1])]; const edits = [edit(), edit({ productId: menus[1].id, cartLineIndex: 1 })];
    expect(plan(cart, edits)).toEqual(plan(cart, [...edits].reverse()));
  });

});
