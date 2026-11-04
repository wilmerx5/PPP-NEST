import { harness } from './whatsapp-accuracy.test-support';

const catalogs = [
  { name: '1 Pollo Broaster', plural: 'pollos Broaster', side: 'arepa', otherSide: 'papas', description: 'Un pollo broaster, acompañado de papas saladas y arepas.' },
  { name: 'Plato Vegetariano', plural: 'platos Vegetarianos', side: 'ensalada', otherSide: 'lentejas', description: 'Plato vegetariano, acompañado de lentejas y ensalada.' },
];
function fixture(c: typeof catalogs[number], agent: boolean) {
  const menu = [
    { id: 38201, code: 1, name: c.name, description: c.description, price: 46000, availableNow: true, hasAttributes: false, attributes: [] as { attributeName: string; options: string[] }[] },
    { id: 38202, code: 2, name: `Combo ${c.name}`, description: `${c.description} Con bebida.`, price: 55000, availableNow: true, hasAttributes: false, attributes: [] as { attributeName: string; options: string[] }[] },
    { id: 38203, code: 3, name: `Porción de ${c.otherSide}`, description: 'Porción individual.', price: 5000, availableNow: true, hasAttributes: false, attributes: [] as { attributeName: string; options: string[] }[] },
  ];
  const h = harness(menu, agent);
  h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 382, dailyOrderNumber: 382 });
  return { ...h, menu };
}
for (const c of catalogs) for (const agent of [false, true]) for (const checkout of [false, true]) {
  for (const query of [
    `Son dos ${c.plural} y vienen con solo ${c.side}???`,
    `vienen con solo ${c.side}?`,
    `vienen solo con ${c.side}?`,
    `Solo vienen con ${c.side}?`,
    `incluyen ${c.otherSide}?`,
    `y las ${c.otherSide}?`,
  ]) it(`contents preserves two: ${query} checkout=${checkout} agent=${agent}`, async () => {
    const h = fixture(c, agent);
    await h.sendQueued(`Quiero 2 ${c.name}`);
    expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({ productId: 38201, quantity: 2 })]);
    if (checkout) {
      h.conv.sessionData.cart[0].note = 'sin sal';
      await h.sendQueued('contraentrega');
    }
    const before = structuredClone(h.conv.sessionData);
    const state = h.conv.state;
    const reply = await h.sendQueued(query);
    expect(h.conv.sessionData.cart).toEqual(before.cart);
    expect(h.conv.state).toBe(state);
    expect(reply).toContain(c.description);
    expect(reply).not.toMatch(/si quieres agregarlo|escribe el n[uú]mero|cu[aá]l prefieres|Listo ✅/i);
    expect(h.conv.sessionData.pendingMatch).toEqual(before.pendingMatch);
    expect(h.conv.sessionData.pendingAddOffer).toEqual(before.pendingAddOffer);
    if (!checkout) {
      await h.sendQueued('2');
      expect(h.conv.sessionData.cart).toEqual(before.cart);
    }
    await h.sendQueued(`Solo 2 ${c.plural}`);
    await h.sendQueued('contraentrega');
    await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    expect(h.service.ordersService.create.mock.calls[0][0].items.map(item => item.productId)).toEqual([38201, 38201]);
    if (checkout) expect(h.service.ordersService.create.mock.calls[0][0].items.every(item => item.note === 'sin sal')).toBe(true);
  });
}

for (const c of catalogs) for (const agent of [false, true]) {
  it(`explicit addition still adds one ${c.name} ${agent}`, async () => {
    const h = fixture(c, agent);
    await h.sendQueued(`Quiero 2 ${c.name}`);
    await h.sendQueued(`vienen con solo ${c.side}?`);
    await h.sendQueued(`Dame un ${c.name}`);
    expect(h.conv.sessionData.cart.reduce((sum, item) => sum + item.quantity, 0)).toBe(3);
  });
  it(`multiple dishes require clarification ${c.name} ${agent}`, async () => {
    const h = fixture(c, agent);
    await h.sendQueued(`Quiero 2 ${c.name}`);
    await h.sendQueued(`Dame una Porción de ${c.otherSide}`);
    const before = structuredClone(h.conv.sessionData.cart);
    const reply = await h.sendQueued('vienen con solo ensalada?');
    expect(reply).toMatch(/de cu[aá]l plato/i);
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.conv.sessionData.pendingMatch).toBeFalsy();
    expect(h.conv.sessionData.pendingCompositionAsk).toBeTruthy();
  });
  it(`missing description is unknown ${c.name} ${agent}`, async () => {
    const h = fixture(c, agent);
    h.menu[0].description = '';
    await h.sendQueued(`Quiero 2 ${c.name}`);
    const before = structuredClone(h.conv.sessionData.cart);
    const reply = await h.sendQueued('vienen con solo ensalada?');
    expect(reply).toMatch(/no tengo.*acompañamientos confirmados/i);
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.conv.sessionData.pendingMatch).toBeFalsy();
  });
  it(`unmentioned side does not assert inclusion ${c.name} ${agent}`, async () => {
    const h = fixture(c, agent);
    await h.sendQueued(`Quiero 2 ${c.name}`);
    const reply = await h.sendQueued('incluyen trufas?');
    expect(reply).toContain(c.description);
    expect(reply).not.toMatch(/s[ií].*trufas|no.*trae.*trufas/i);
    expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({ productId: 38201, quantity: 2 })]);
  });
}

for (const c of catalogs) for (const agent of [false, true]) it(`contents preserves an independent option ${c.name} ${agent}`, async () => {
  const h = fixture(c, agent);
  h.menu.push({ id: 38204, code: 4, name: 'Jugo Natural', description: 'Jugo natural.', price: 5000,
    availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Sabor', options: ['Mora', 'Mango'] }] });
  await h.sendQueued(`Quiero 2 ${c.name}`);
  await h.sendQueued('Dame un Jugo Natural');
  expect(h.conv.state).toBe('awaiting_attribute');
  const before = structuredClone(h.conv.sessionData);
  const reply = await h.sendQueued(`Son dos ${c.plural} y vienen con solo ${c.side}?`);
  expect(reply).toContain(c.description);
  expect(h.conv.sessionData.pendingAttribute).toEqual(before.pendingAttribute);
  expect(h.conv.sessionData.cart).toEqual(before.cart);
  expect(h.conv.state).toBe('awaiting_attribute');
  await h.sendQueued('2');
  expect(h.conv.sessionData.cart.find(item => item.productId === 38201)?.quantity).toBe(2);
  expect(h.conv.sessionData.cart.find(item => item.productId === 38204)?.attributes).toContainEqual({ attributeName: 'Sabor', attributeValue: 'Mango' });
  await h.sendQueued('contraentrega'); await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  expect(h.service.ordersService.create.mock.calls[0][0].items.map(item => item.productId)).toEqual([38201, 38201, 38204]);
});

for (const c of catalogs) for (const agent of [false, true]) it(`only two corrects a noted line without adding ${c.name} ${agent}`, async () => {
  const h = fixture(c, agent);
  await h.sendQueued(`Quiero 3 ${c.name}`);
  h.conv.sessionData.cart[0].note = 'sin sal';
  await h.sendQueued(`Solo 2 ${c.plural}`);
  expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({ productId: 38201, quantity: 2, note: 'sin sal' })]);
  await h.sendQueued('contraentrega'); await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  expect(h.service.ordersService.create.mock.calls[0][0].items).toEqual([
    expect.objectContaining({ productId: 38201, note: 'sin sal' }),
    expect.objectContaining({ productId: 38201, note: 'sin sal' }),
  ]);
});
