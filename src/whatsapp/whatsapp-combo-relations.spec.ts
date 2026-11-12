import { WhatsappAgentService } from './whatsapp-agent.service';
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
    expect.objectContaining({ id: 705, qty: 2, note: 'Sin sal', attrs: expect.arrayContaining(['Acompañamiento:Yuca', 'Bebida:Manzana']) }), expect.objectContaining({ id: 704, qty: 1 }),
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

test('the agent tool card and detailed menu expose the actual database relationship', async () => {
  const catalog = new WhatsappCatalogService({ findProductsGroupedByCategory: async () => [{ categoryName: 'Carta', products: menu() }] } as never);
  const current = await catalog.getMenuProducts();
  const agent = Object.create(WhatsappAgentService.prototype) as any;
  expect(agent.productCard(current.find(product => product.id === 702))).toMatchObject({ comboBaseProductId: 701, comboRole: 'combo' });
  expect(agent.productCard(current.find(product => product.id === 701))).toMatchObject({ comboBaseProductId: null, comboRole: 'normal' });
  expect(await catalog.getMenuDetailedText()).toContain('Producto normal vinculado: #11 Bowl Andino');
});

for (const previousFood of [false, true]) {
  test(`an independent combo without a normal counterpart can still be purchased, previous food ${previousFood}`, async () => {
    const products = menu();
    products[2] = {...products[2], name: 'Combo Mixto', comboBaseProductId: null};
    const h = harness(products, false);
    h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
    if (previousFood) h.conv.sessionData.cart = [{productId:704,name:'Sopa Casera',code:14,quantity:1,unitPrice:5000}];
    await h.sendQueued('quiero un Combo Mixto');
    expect(h.conv.sessionData.cart.filter(line => line.productId === 703)).toHaveLength(1);
    expect(h.conv.sessionData.cart.find(line => line.productId === 703)?.quantity).toBe(1);
    expect(h.conv.sessionData.cart).toHaveLength(previousFood ? 2 : 1);
  });
}

for (const correction of ['pásalo a combo con cola', 'pásalo a combo']) {
  test(`ambiguous combo choice keeps original options and an explicit drink, ${correction}`, async () => {
    const products = [...menu(), { ...menu()[1], id: 705, code: 15, name: 'Experiencia Festiva', price: 30000 }];
    const h = setup(false, 2, products);
    await h.sendQueued(correction);
    expect(h.conv.sessionData.pendingMatch?.configuredComboBaseProductId).toBe(701);
    await h.sendQueued('2');
    if (h.conv.sessionData.pendingAttribute) await h.sendQueued(correction.includes('cola') ? 'Cola' : 'Manzana');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({id:705,qty:2,note:'Sin sal',attrs:expect.arrayContaining(['Acompañamiento:Yuca', correction.includes('cola') ? 'Bebida:Cola' : 'Bebida:Manzana'])}),
      expect.objectContaining({id:704,qty:1}),
    ]);
    await close(h,705,2,'65.000');
  });
}
test('a relinked combo invalidates its old offer without changing the cart', async () => {
  const products = [...menu(), { ...menu()[1], id: 705, code: 15, name: 'Experiencia Festiva', price: 30000 }];
  const h = setup(false, 2, products);
  const before = structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('pásalo a combo');
  products[4].comboBaseProductId = 704;
  await h.sendQueued('2');
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(h.replies.at(-1)).toMatch(/ya no corresponde/i);
});

test('a required option after ambiguous conversion keeps source options and drink choice', async () => {
  const products = [...menu(), { ...menu()[1], id: 705, code: 15, name: 'Experiencia Festiva', price: 30000 }];
  products[4].attributes = [...products[4].attributes!, {attributeName:'Salsa',options:['Dulce','Picante']}];
  const h = setup(false,2,products);
  const before = structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('pásalo a combo con cola');
  await h.sendQueued('2');
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(h.conv.sessionData.pendingAttribute?.productId).toBe(705);
  await h.sendQueued('Picante');
  expect(h.cartRows()).toEqual([
    expect.objectContaining({id:705,qty:2,note:'Sin sal',attrs:expect.arrayContaining(['Acompañamiento:Yuca','Bebida:Cola','Salsa:Picante'])}),
    expect.objectContaining({id:704,qty:1}),
  ]);
  await close(h,705,2,'65.000');
});

test('a changed price is re-quoted before completing the configured conversion',async()=>{
  const products = [...menu(), { ...menu()[1], id: 705, code: 15, name: 'Experiencia Festiva', price: 30000 }];
  const h = setup(false,2,products);
  const before=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('pásalo a combo con cola');
  products[4].price=32000;
  await h.sendQueued('2');
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(h.replies.at(-1)).toMatch(/precio.*cambi[oó]/i);
  await h.sendQueued('2');
  if(h.conv.sessionData.pendingAttribute) await h.sendQueued('Cola');
  expect(h.cartRows()).toEqual([
    expect.objectContaining({id:705,qty:2,attrs:expect.arrayContaining(['Acompañamiento:Yuca','Bebida:Cola'])}),
    expect.objectContaining({id:704,qty:1}),
  ]);
  await close(h,705,2,'69.000');
});

for (const preparation of ['Broaster', 'Frito']) {
  for (const withPriorItem of [false, true]) {
    test(`direct configured ${preparation} combo retains normal purchase defaults, prior item ${withPriorItem}`, async () => {
      const arepas = { attributeName: 'Arepas', options: ['Blancas', 'Fritas'] };
      const beverage = { attributeName: 'Bebida', options: ['Colombiana', 'Manzana'] };
      const original: WhatsappProductCandidate[] = [
        { id: 701, code: 11, name: `1 Pollo ${preparation}`, price: 18000, availableNow: true, hasAttributes: true, attributes: [arepas] },
        { id: 702, code: 12, name: `Combo De Pollo ${preparation}`, price: 26000, availableNow: true, hasAttributes: true, attributes: [arepas, beverage] },
        { id: 704, code: 14, name: 'Sopa Casera', price: 5000, availableNow: true, attributes: [] },
      ];
      const linked = original.map(product => ({ ...product, comboBaseProductId: product.id === 702 ? 701 : null }));
      const oldFlow = harness(original, false);
      const newFlow = harness(linked, false);
      for (const h of [oldFlow, newFlow]) {
        h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
        h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 514, dailyOrderNumber: 514 });
        h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
        if (withPriorItem) await h.sendQueued('Una Sopa Casera');
        await h.sendQueued(`quiero un Combo De Pollo ${preparation}`);
      }
      expect(oldFlow.conv.sessionData.cart).toEqual(expect.arrayContaining([
        expect.objectContaining({ productId: 702, quantity: 1, unitPrice: 26000,
          attributes: expect.arrayContaining([
            { attributeName: 'Arepas', attributeValue: 'Blancas' },
            { attributeName: 'Bebida', attributeValue: 'Colombiana' },
          ]) }),
      ]));
      expect(newFlow.conv.sessionData.cart).toEqual(oldFlow.conv.sessionData.cart);
      expect(newFlow.replies.at(-1)).toEqual(oldFlow.replies.at(-1));
      expect(newFlow.conv.sessionData.pendingAttribute).toBeUndefined();
      await newFlow.sendQueued('no más, recojo en el local');
      await newFlow.sendQueued('efectivo');
      await newFlow.sendQueued('confirmar');
      expect(newFlow.service.ordersService.create).toHaveBeenCalledTimes(1);
      const items = newFlow.service.ordersService.create.mock.calls[0][0].items;
      expect(items.map((item: { productId: number }) => item.productId).sort()).toEqual(withPriorItem ? [702, 704] : [702]);
    });
  }
}
