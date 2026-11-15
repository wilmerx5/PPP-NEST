import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { normalizePurchaseIntroduction } from './whatsapp-local-glossary';
import { harness } from './whatsapp-accuracy.test-support';

const menus = [
  ['1 Pollo Frito', '1/2 Pollo Broaster', 'Sopa De Ajiaco'],
  ['Lasaña Vegetal', 'Risotto De Hongos', 'Sopa De Verduras'],
].map(names => names.map((name, index) => ({
  id: 54001 + index, code: index + 1, name, description: 'Con ensalada de la casa.',
  price: 10000, availableNow: true, hasAttributes: false, attributes: [],
})));

for (const menu of menus) for (const prefix of [
  'lo que quiero es',
  'Para hacer el pedido de',
  'quiero hacer un pedido de',
  'Buenas tardes, por favor, quisiera hacer un pedido de',
  'veci, lo que necesito es',
]) {
  const text = `${prefix} ${menu[0].name} y ${menu[1].name}`;
  it(`catalog preserves only requested dishes ${text}`, () => {
    const result = new WhatsappCatalogService({} as any).resolveMultiProductOrder(text, menu);
    expect(result?.unresolved).toEqual([]);
    expect(result?.confident.map(item => item.product.id).sort()).toEqual([54001, 54002]);
  });
  for (const agent of [false, true]) it(`router interprets framing ${agent} ${text}`, async () => {
    const h = harness(menu, agent);
    h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
    const reply = await h.sendQueued(text);
    expect(reply).not.toMatch(/no (?:tenemos|manejamos|encontr[eé])|pedido de\*|pedido de_/i);
    expect(h.conv.sessionData.recentUnavailableOrder).toBeFalsy();
    expect(h.conv.sessionData.address).toBeFalsy();
    expect(h.conv.sessionData.cart.map(item => [item.productId, item.quantity]).sort()).toEqual([[54001, 1], [54002, 1]]);
  });
}

for (const agent of [false, true]) for (const question of [
  'Como bienes el pollo broastes',
  'Como viene el pollo broaster',
  'El pollo broaster como viene',
]) it(`composition typo stays informational ${agent} ${question}`, async () => {
  const menu = [
    { ...menus[0][0], name: '1 Pollo Broaster', description: 'Con papas saladas y arepas.' },
    { ...menus[0][1], name: 'Bandeja Con Pollo Broaster' },
  ];
  const h = harness(menu, agent);
  await h.sendQueued('Dame un pollo broaster');
  const before = structuredClone(h.conv.sessionData.cart);
  const reply = await h.sendQueued(question);
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(reply).toContain('papas saladas');
  expect(h.conv.sessionData.pendingMatch).toBeFalsy();
  expect(h.conv.sessionData.pendingMultiOrder).toBeFalsy();
});

for (const menu of menus) for (const agent of [false, true]) {
  it(`a genuine missing dish is retained with its purchase framing ${menu[0].name} ${agent}`, async () => {
    const h = harness(menu, agent);
    h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
    const reply = await h.sendQueued(`Para hacer el pedido de un ${menu[0].name} y una milanesa`);
    expect(reply).toMatch(/milanesa/i);
    expect(reply).not.toMatch(/no.*(?:pedido de|lo que quiero es)/i);
    expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({ productId: 54001, quantity: 1 })]);
    expect(h.conv.sessionData.recentUnavailableOrder?.items.join(' ')).toMatch(/milanesa/i);
  });
  it(`preambles preserve quantities, notes and the final order ${menu[0].name} ${agent}`, async () => {
    const h = harness(menu, agent);
    h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
    h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 540, dailyOrderNumber: 540 });
    Object.assign(h.conv.sessionData, { fulfillmentChosen: true, phoneConfirmed: true,
      contactPhone: h.conv.phoneE164, notesCollected: true });
    await h.sendQueued(`Buenas tardes, por favor, quisiera hacer un pedido de dos ${menu[0].name} sin sal y un ${menu[2].name}`);
    expect(h.conv.sessionData.cart).toEqual([
      expect.objectContaining({ productId: 54001, quantity: 2 }),
      expect.objectContaining({ productId: 54003, quantity: 1 }),
    ]);
    expect(h.conv.sessionData.cart[0].note).toMatch(/sin sal/i);
    await h.sendQueued('contraentrega');
    await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const items = h.service.ordersService.create.mock.calls[0][0].items;
    expect(items.map(item => item.productId)).toEqual([54001, 54001, 54003]);
  });
}

for (const text of [
  'Quiero saber cómo viene el pollo',
  'Quisiera saber qué precio tiene la sopa',
  'Para hacer el pedido',
  'Pedido De La Casa',
  'Quiero cambiar el pedido de ayer',
  'No quiero hacer un pedido de pollo',
  'Calle 10 #20-30, hacer el pedido de pollo',
]) it(`an introduction normalizer preserves other intents ${text}`, () => {
  expect(normalizePurchaseIntroduction(text)).toBe(text);
});

for (const text of [
  'Qué tan grande es la Mojarra', 'La Mojarra que tan grande es',
  'De qué tamaño es la Lasaña', 'Como bienes el Risotto',
]) it(`an informational clause cannot become a missing dish ${text}`, () => {
  const catalog = new WhatsappCatalogService({} as any);
  expect(catalog.isProductDescriptionInquiry(text)).toBe(true);
  expect(catalog.resolveMultiProductOrder(text, menus[0])).toBeNull();
});

it('purchase introduction normalization is idempotent', () => {
  const text = 'Buenas tardes, por favor, quisiera hacer un pedido de dos sopas';
  const normalized = normalizePurchaseIntroduction(text);
  expect(normalized).toBe('quiero dos sopas');
  expect(normalizePurchaseIntroduction(normalized)).toBe(normalized);
});

it('restatements keep their correction intent while normalizing courtesy and typos', () => {
  const normalized = normalizePurchaseIntroduction('veci, lo que quieor es un pollo y una sopa');
  expect(normalized).toBe('lo que quiero es un pollo y una sopa');
  expect(normalizePurchaseIntroduction(normalized)).toBe(normalized);
});

for (const agent of [false, true]) for (const state of ['building_cart', 'awaiting_payment', 'awaiting_final_confirm']) {
  for (const question of ['Como bienes el pollo broastes', 'Como viene el pollo broaster', 'Con qué viene el pollo broaster']) {
    it(`cart description does not reopen other presentations ${agent} ${state} ${question}`, async () => {
      const menu = [
        { ...menus[0][0], name: '1 Pollo Broaster', description: 'Con papas saladas y arepas.' },
        { ...menus[0][1], name: '1/2 Pollo Broaster', description: 'Medio pollo con arepas.' },
        { ...menus[0][2], name: 'Combo De Pollo Broaster', description: 'Pollo con bebida de litro.' },
      ];
      const h = harness(menu, agent);
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      await h.sendQueued('Dame dos pollos broaster');
      expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({ productId: 54001, quantity: 2 })]);
      h.conv.state = state;
      const before = structuredClone(h.conv.sessionData.cart);
      const reply = await h.sendQueued(question);
      expect(reply).toContain('papas saladas');
      expect(reply).not.toMatch(/opciones disponibles|número.*agregarlo/i);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.state).toBe(state);
      expect(h.conv.sessionData.pendingMatch).toBeFalsy();
      expect(h.conv.sessionData.pendingMultiOrder).toBeFalsy();
      expect(h.conv.sessionData.pendingAddOffer).toBeFalsy();
      await h.sendQueued('1');
      expect(h.conv.sessionData.cart).toEqual(before);
    });
  }
}
