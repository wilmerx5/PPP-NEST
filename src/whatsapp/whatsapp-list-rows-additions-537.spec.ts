import { harness } from './whatsapp-accuracy.test-support';

const families = [
  ['Medio Pollo Broaster', 'Medio Pollo Frito', 'Porción De Papas Fritas', 'Gaseosa 1.5 L'],
  ['Bowl Vegetal', 'Bowl Mixto', 'Porción De Hummus', 'Jugo Natural'],
];

function setup(names: string[], agent: boolean) {
  const menu = names.map((name, index) => ({
    id: 53701 + index, code: 61 + index, name, price: 12000 + index * 1000,
    availableNow: true, hasAttributes: false, attributes: [] as any[],
  }));
  const h = harness(menu, agent);
  h.cfg.ignoreBusinessHours = false;
  h.conv.sessionData.pendingMatch = {
    query: 'opciones', intent: 'order', quantity: 1,
    candidates: menu.slice(0, 2).map(({ id, code, name, price }) => ({ id, code, name, price })),
  };
  Object.assign(h.conv.sessionData, {
    fulfillmentChosen: true, phoneConfirmed: true, contactPhone: h.conv.phoneE164, notesCollected: true,
  });
  h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 537, dailyOrderNumber: 537 });
  h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
  return { h, menu };
}

for (const names of families) for (const agent of [false, true]) {
  it.each(['1 y 2', '1 y 2 y', '1, 2'])(`mixed rows and additions close with exact quantities %s ${names[0]}/${agent}`, async prefix => {
    const { h, menu } = setup(names, agent);
    const reply = await h.sendQueued(`${prefix} una ${names[2].toLowerCase()} y una ${names[3].toLowerCase()}`);
    expect(h.conv.sessionData.cart.map(line => [line.productId, line.quantity]).sort()).toEqual(menu.map(p => [p.id, 1]));
    expect(h.conv.sessionData.pendingMatch).toBeFalsy();
    for (const product of menu) expect(reply).toContain(product.name);
    await h.sendQueued('no más, recojo en el local');
    if (h.conv.state === 'awaiting_payment') await h.sendQueued('contraentrega');
    await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    expect(h.service.ordersService.create.mock.calls[0][0].items.map((line: any) => line.productId).sort())
      .toEqual(menu.map(p => p.id));
  });

  it.each(['dos', '2', '3'])(`additional options retain their own quantity and queue %s ${names[0]}/${agent}`, async count => {
    const { h, menu } = setup(names, agent);
    Object.assign(menu[3], { hasAttributes: true, attributes: [{ attributeName: 'Sabor', options: ['Mango', 'Fresa'] }] });
    await h.sendQueued(`1 y 2 y ${count} ${names[3].toLowerCase()}`);
    expect(h.conv.sessionData.cart.map(line => [line.productId, line.quantity]).sort()).toEqual([[53701, 1], [53702, 1]]);
    expect(h.conv.sessionData.pendingAttribute).toMatchObject({ productId: 53704, quantity: count === '3' ? 3 : 2 });
    await h.sendQueued('Mango');
    expect(h.conv.sessionData.cart.find(line => line.productId === 53704)).toMatchObject({ quantity: count === '3' ? 3 : 2 });
  });

  it(`mixed information list accepts complete configured defaults ${names[0]}/${agent}`, async () => {
    const { h, menu } = setup(names, agent);
    for (const product of menu.slice(0, 2)) Object.assign(product, {
      hasAttributes: true, attributes: [{ attributeName: 'Arepas', options: ['Blancas', 'Fritas', 'Sin arepas'] }],
    });
    h.conv.sessionData.pendingMatch!.intent = 'info';
    delete h.conv.sessionData.pendingMatch!.quantity;
    await h.sendQueued(`1 y 2 una ${names[2].toLowerCase()} y una ${names[3].toLowerCase()}`);
    expect(h.conv.sessionData.cart.map(line => [line.productId, line.quantity]).sort()).toEqual(menu.map(p => [p.id, 1]));
    for (const product of menu.slice(0, 2)) {
      expect(h.conv.sessionData.cart.find(line => line.productId === product.id)?.attributes)
        .toEqual([{ attributeName: 'Arepas', attributeValue: 'Blancas' }]);
    }
    expect(h.conv.sessionData.pendingMatch).toBeFalsy();
  });

  it(`list notes stay on selected rows ${names[0]}/${agent}`, async () => {
    const { h } = setup(names, agent);
    h.conv.sessionData.pendingMatch!.note = 'Sin sal';
    await h.sendQueued(`1 y 2 una ${names[2].toLowerCase()}`);
    expect(h.conv.sessionData.cart.filter(line => line.productId !== 53703).map(line => line.note)).toEqual(['Sin sal', 'Sin sal']);
    expect(h.conv.sessionData.cart.find(line => line.productId === 53703)?.note).toBeFalsy();
  });

  for (const guard of ['invalid', 'duplicate', 'missing', 'choice', 'limit', 'quantity', 'single', 'siblings'] as const) {
    it(`mixed list keeps the whole purchase on ${guard} ${names[0]}/${agent}`, async () => {
      const { h, menu } = setup(names, agent);
      if (guard === 'missing') menu.splice(1, 1);
      if (guard === 'choice') {
        Object.assign(menu[1], { name: 'Smoothie Tropical', hasAttributes: true,
          attributes: [{ attributeName: 'Sabor', options: ['Mango', 'Fresa'] }] });
        h.conv.sessionData.pendingMatch!.candidates[1].name = menu[1].name;
      }
      if (guard === 'limit') Object.assign(h.cfg, { maxTotalUnits: 2 });
      if (guard === 'siblings') h.conv.sessionData.pendingMatch!.alsoAdd = [{ productId: menu[3].id, segment: `una ${menu[3].name}` }];
      if (guard === 'quantity') h.conv.sessionData.pendingMatch!.quantity = 3;
      const pending = structuredClone(h.conv.sessionData.pendingMatch);
      const prefix = guard === 'invalid' ? '1 y 9' : guard === 'duplicate' ? '1 y 1' : guard === 'single' ? '2 y' : '1 y 2';
      const reply = await h.sendQueued(`${prefix} una ${names[2].toLowerCase()}`);
      expect(h.conv.sessionData.cart).toEqual([]);
      expect(h.conv.sessionData.pendingMatch).toEqual(pending);
      expect(reply).toBeTruthy();
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
  }
}
