import { harness } from './whatsapp-accuracy.test-support';
import type { WhatsappProductCandidate } from './types/whatsapp-session.types';
import { WhatsappCatalogService } from './whatsapp-catalog.service';

const side = { attributeName: 'Acompañamiento', options: ['Ensalada', 'Yuca'] };
const drink = { attributeName: 'Bebida', options: ['Manzana', 'Cola'] };
const menu = (): WhatsappProductCandidate[] => [
  { id: 701, code: 11, name: 'Bowl Andino', price: 18000, availableNow: true, hasAttributes: true, attributes: [side] },
  // Names intentionally do not encode the relationship.
  { id: 702, code: 12, name: 'Experiencia Serrana', price: 26000, comboBaseProductId: 701, availableNow: true, hasAttributes: true, attributes: [side, drink] },
  { id: 703, code: 13, name: 'Combo De Bowl Andino', price: 99000, availableNow: true, attributes: [] },
  { id: 704, code: 14, name: 'Sopa Casera', price: 5000, availableNow: true, attributes: [] },
];
function setup(combo: boolean, quantity = 2, products = menu()) {
  const h = harness(products, false);
  h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
  h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 514, dailyOrderNumber: 514 });
  h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
  const product = products[combo ? 1 : 0];
  h.conv.sessionData.cart = [
    { productId: product.id, name: product.name, code: product.code, quantity, unitPrice: product.price,
      attributes: [{ attributeName: 'Acompañamiento', attributeValue: 'Yuca' }, ...(combo ? [{ attributeName: 'Bebida', attributeValue: 'Manzana' }] : [])], note: 'Sin sal' },
    { productId: 704, name: 'Sopa Casera', code: 14, quantity: 1, unitPrice: 5000 },
  ];
  h.conv.sessionData.productFocus = { productId: product.id, name: product.name };
  return h;
}
async function close(h: ReturnType<typeof setup>, productId: number, quantity: number, total: string) {
  await h.sendQueued('no más, recojo en el local');
  await h.sendQueued('efectivo');
  expect(h.replies.at(-1)).toContain(total);
  await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items = h.service.ordersService.create.mock.calls[0][0].items;
  expect(items.filter((item: {productId: number}) => item.productId === productId)).toHaveLength(quantity);
  expect(items.filter((item: {productId: number}) => item.productId === 704)).toHaveLength(1);
  expect(items).toHaveLength(quantity + 1);
}
for (const quantity of [1, 2]) {
  test(`configured combo to normal preserves ${quantity}, options and exact final total`, async () => {
    const h = setup(true, quantity);
    await h.sendQueued('cámbialo sin combo');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({ id: 701, qty: quantity, attrs: ['Acompañamiento:Yuca'], note: 'Sin sal' }),
      expect.objectContaining({ id: 704, qty: 1 }),
    ]);
    await close(h, 701, quantity, quantity === 1 ? '23.000' : '41.000');
  });
  test(`normal to configured combo preserves ${quantity} and closes once`, async () => {
    const h = setup(false, quantity);
    await h.sendQueued('pásalo a combo con manzana');
    if (h.conv.sessionData.pendingAttribute) await h.sendQueued('Manzana');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({ id: 702, qty: quantity, attrs: expect.arrayContaining(['Acompañamiento:Yuca', 'Bebida:Manzana']) }),
      expect.objectContaining({ id: 704, qty: 1 }),
    ]);
    await close(h, 702, quantity, quantity === 1 ? '31.000' : '57.000');
  });
}
for (const combo of [false, true]) {
  test(`unavailable linked destination retains original cart, direction ${combo}`, async () => {
    const products = menu(); products[combo ? 0 : 1].availableNow = false;
    const h = setup(combo, 2, products);
    const before = structuredClone(h.conv.sessionData.cart);
    const reply = await h.sendQueued(combo ? 'cámbialo sin combo' : 'pásalo a combo');
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(reply).toMatch(/disponible/i);
    expect(h.conv.sessionData.pendingAttribute).toBeUndefined();
  });
}
test('several linked combos require a choice and do not add a second dish', async () => {
  const products = [...menu(), { ...menu()[1], id: 705, code: 15, name: 'Experiencia Festiva', price: 30000 }];
  const h = setup(false, 2, products);
  const before = structuredClone(h.conv.sessionData.cart);
  const reply = await h.sendQueued('pásalo a combo');
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(reply).toContain('Experiencia Serrana');
  expect(reply).toContain('Experiencia Festiva');
  await h.sendQueued('2');
  if (h.conv.sessionData.pendingAttribute) await h.sendQueued('Manzana');
  expect(h.cartRows()).toEqual([
    expect.objectContaining({ id: 705, qty: 2 }), expect.objectContaining({ id: 704, qty: 1 }),
  ]);
  await close(h, 705, 2, '65.000');
});
test('catalog transport carries the real relationship', async () => {
  const catalog = new WhatsappCatalogService({ findProductsGroupedByCategory: async () => [{ categoryName: 'Carta', products: menu() }] } as never);
  expect((await catalog.getMenuProducts()).find(product => product.id === 702)?.comboBaseProductId).toBe(701);
});
test('configured family excludes similarly named unrelated combos', () => {
  const catalog = new WhatsappCatalogService({} as never);
  const products = menu();
  expect(catalog.findProductVariantFamily('Bowl Andino', products)?.variants.map(product => product.id)).toEqual([701, 702]);
  expect(catalog.productImpliesCombo(products[1])).toBe(true);
});

test('round trip uses the configured SKUs and never duplicates quantities', async () => {
  const h = setup(true, 2);
  await h.sendQueued('cámbialo sin combo');
  await h.sendQueued('pásalo a combo con manzana');
  if (h.conv.sessionData.pendingAttribute) await h.sendQueued('Manzana');
  expect(h.cartRows()).toEqual([
    expect.objectContaining({ id: 702, qty: 2, note: 'Sin sal' }),
    expect.objectContaining({ id: 704, qty: 1 }),
  ]);
  await close(h, 702, 2, '57.000');
});

test('new required option retains the original line until the customer answers', async () => {
  const products = menu();
  products[1].attributes!.push({ attributeName: 'Salsa', options: ['Dulce', 'Picante'] });
  const h = setup(false, 2, products);
  const original = structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('pásalo a combo con cola');
  expect(h.conv.sessionData.pendingAttribute?.productId).toBe(702);
  expect(h.conv.sessionData.cart).toEqual(original);
  await h.sendQueued('Picante');
  expect(h.cartRows()).toEqual([
    expect.objectContaining({ id: 702, qty: 2, attrs: expect.arrayContaining(['Salsa:Picante', 'Acompañamiento:Yuca', 'Bebida:Cola']) }),
    expect.objectContaining({ id: 704, qty: 1 }),
  ]);
  await close(h, 702, 2, '57.000');
});

test('missing normal SKU cannot redirect to an unrelated same-name family', async () => {
  const products = menu();
  const h = setup(true, 2, products);
  products.splice(0, 1);
  const original = structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('cámbialo sin combo');
  expect(h.conv.sessionData.cart).toEqual(original);
  expect(h.replies.at(-1)).toMatch(/vinculada.*disponible/i);
});

test('an explicitly unlinked database product never converts by similar names', async () => {
  const products = menu();
  products[0].comboBaseProductId = null;
  products[1].comboBaseProductId = null;
  const h = setup(false, 2, products);
  const original = structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('pásalo a combo');
  expect(h.conv.sessionData.cart).toEqual(original);
  expect(h.replies.at(-1)).toMatch(/relación de combo configurada/i);
});

test('a new purchase with a normal name and combo preference selects the linked commercial product', async () => {
  const h = harness(menu(), false);
  h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
  await h.sendQueued('quiero un Bowl Andino en combo con manzana');
  if (h.conv.sessionData.pendingAttribute) await h.sendQueued('Yuca');
  expect(h.cartRows()).toEqual([expect.objectContaining({ id: 702, qty: 1 })]);
});

test('a new purchase with several configured combos asks which presentation without inventing a cart line', async () => {
  const products = [...menu(), { ...menu()[1], id: 705, code: 15, name: 'Experiencia Festiva', price: 30000 }];
  const h = harness(products, false);
  h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
  await h.sendQueued('quiero dos Bowl Andino en combo');
  expect(h.cartRows()).toEqual([]);
  expect(h.conv.sessionData.pendingMatch?.quantity).toBe(2);
  expect(h.replies.at(-1)).toContain('Experiencia Festiva');
  await h.sendQueued('2');
  if (h.conv.sessionData.pendingAttribute) await h.sendQueued('Yuca');
  if (h.conv.sessionData.pendingAttribute) await h.sendQueued('Manzana');
  expect(h.cartRows()).toEqual([expect.objectContaining({ id: 705, qty: 2 })]);
});

test('a second restaurant uses unrelated names and the same configured conversion contract', async () => {
  const products = menu();
  products[0].name = 'Taco Tradicional';
  products[1].name = 'Cena de la Casa';
  const h = setup(true, 3, products);
  await h.sendQueued('cámbialo sin combo');
  expect(h.cartRows()).toEqual([
    expect.objectContaining({ id: 701, qty: 3 }), expect.objectContaining({ id: 704, qty: 1 }),
  ]);
  await h.sendQueued('pásalo a combo con manzana');
  if (h.conv.sessionData.pendingAttribute) await h.sendQueued('Manzana');
  expect(h.cartRows()).toEqual([
    expect.objectContaining({ id: 702, qty: 3 }), expect.objectContaining({ id: 704, qty: 1 }),
  ]);
  await close(h, 702, 3, '83.000');
});

test('an exact linked combo name keeps its identity without needing the word combo', () => {
  const catalog = new WhatsappCatalogService({} as never);
  const family = catalog.getConfiguredVariantFamily(menu()[0], menu())!;
  expect(catalog.pickVariantFromFamilyText('quiero una Experiencia Serrana', family)?.id).toBe(702);
  expect(catalog.pickVariantFromFamilyText('quiero un Bowl Andino', family)?.id).toBe(701);
});

test('configured normal role takes precedence when the product name contains combo', async () => {
  const products = menu();
  products[0].name = 'Combo Tradicional';
  const catalog = new WhatsappCatalogService({ findProductsGroupedByCategory: async () => [{ categoryName: 'Carta', products }] } as never);
  const current = await catalog.getMenuProducts();
  expect(catalog.productImpliesCombo(current.find(product => product.id === 701)!)).toBe(false);
  expect(catalog.productImpliesCombo(current.find(product => product.id === 702)!)).toBe(true);
});
