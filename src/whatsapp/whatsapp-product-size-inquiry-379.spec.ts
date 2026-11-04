import { harness } from './whatsapp-accuracy.test-support';

for (const name of ['Mojarra', 'Lasaña Vegetal'])
  for (const agent of [false, true])
    for (const state of ['building_cart', 'awaiting_final_confirm'])
      for (const question of [
        `Qué tan grande es la ${name}`,
        `La ${name} que tan grande es`,
        `De qué tamaño es la ${name}`,
        `La ${name} qué tamaño tiene`,
      ]) {
        it(`size remains informational: ${name}, ${agent}, ${state}, ${question}`, async () => {
          const menu = [
            { id: 37901, code: 1, name, description: 'Acompañada de ensalada.', price: 32000, availableNow: true, hasAttributes: false, attributes: [] },
            { id: 37902, code: 2, name: 'Sopa Del Día', description: 'Sopa de verduras.', price: 12000, availableNow: true, hasAttributes: false, attributes: [] },
          ];
          const h = harness(menu, agent);
          h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
          h.conv.state = state;
          Object.assign(h.conv.sessionData, { cart: [{ productId: 37902, name: menu[1].name, quantity: 1, unitPrice: 12000, attributes: [] }], paymentMethod: 'cash' });
          const before = structuredClone(h.conv.sessionData.cart);
          for (let repeat = 0; repeat < 2; repeat++) {
            const reply = await h.sendQueued(question);
            expect(h.conv.sessionData.cart).toEqual(before);
            expect(h.conv.state).toBe(state);
            expect(h.conv.sessionData.pendingMultiOrder).toBeFalsy();
            expect(reply).toMatch(/no tengo.*(?:tamaño|peso).*confirmado/i);
            expect(reply).toContain(name);
            expect(reply).not.toMatch(/cuál prefieres|Listo ✅|400 gramos/i);
          }
        });
      }

for (const agent of [false, true]) for (const names of [['Churrasco', 'Trucha'], ['Risotto', 'Lasaña']]) {
  const menu = names.map((name, i) => ({ id: 37911+i, code: i+1, name, description: i ? 'Con verduras de temporada.' : 'Porción de 400 gramos.', price: 20000, availableNow: true, hasAttributes: false, attributes: [] }));
  it(`description follow-up does not create a purchase choice ${agent} ${names}`, async () => {
    const h = harness(menu, agent);
    await h.sendQueued(`Como viene el ${names[0]}`);
    const reply = await h.sendQueued(`Y la ${names[1]}`);
    expect(reply).toContain('verduras de temporada');
    expect(reply).not.toMatch(/Escribe el número|Listo ✅/i);
    expect(h.conv.sessionData.cart).toEqual([]);
    expect(h.conv.sessionData.pendingMatch).toBeFalsy();
    expect(h.conv.sessionData.pendingMultiOrder).toBeFalsy();
    await h.sendQueued(`Agrégame una ${names[1]}`);
    expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({ productId: 37912, quantity: 1 })]);
  });
  it(`size uses catalog evidence and preserves purchase ${agent} ${names}`, async () => {
    const h = harness(menu, agent);
    const reply = await h.sendQueued(`Qué tan grande es el ${names[0]}`);
    expect(reply).toContain('400 gramos');
    expect(h.conv.sessionData.cart).toEqual([]);
    expect(h.conv.sessionData.pendingAddOffer).toBeFalsy();
    await h.sendQueued(`Dame un ${names[0]}`);
    expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({ productId: 37911, quantity: 1 })]);
  });
}

for (const agent of [false, true]) {
  it(`unknown and ambiguous product sizes never borrow another dish's weight ${agent}`, async () => {
    const menu = ['Mojarra', 'Trucha'].map((name, i) => ({ id: 37921+i, code: i+1, name, description: 'Porción de 400 gramos.', price: 20000, availableNow: true, hasAttributes: false, attributes: [] }));
    const h = harness(menu, agent);
    await h.sendQueued('Una Trucha');
    const before = structuredClone(h.conv.sessionData.cart);
    for (const question of ['Qué tan grande es la pizza', 'Qué tan grande es la Mojarra y la Trucha']) {
      const reply = await h.sendQueued(question);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(reply).toMatch(/cuál plato/i);
      expect(reply).not.toContain('400 gramos');
    }
  });
  it(`size interruption preserves pending options and closes with just the requested dish ${agent}`, async () => {
    const menu = [{ id: 37931, code: 1, name: 'Trucha', description: 'Con ensalada.', price: 32000, availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Preparación', options: ['Frita', 'Asada'] }] }, { id: 37932, code: 2, name: 'Mojarra', description: 'Con papas.', price: 30000, availableNow: true, hasAttributes: false, attributes: [] }];
    const h = harness(menu, agent);
    h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 379, dailyOrderNumber: 379 });
    h.conv.state = 'awaiting_attribute';
    h.conv.sessionData.pendingAttribute = { productId: 37931, code: 1, price: 32000, name: 'Trucha', quantity: 1, attributes: menu[0].attributes, selected: [] };
    const pending = structuredClone(h.conv.sessionData.pendingAttribute);
    const reply = await h.sendQueued('Qué tan grande es la Mojarra');
    expect(reply).toMatch(/no tengo.*tamaño/i);
    expect(h.conv.sessionData.cart).toEqual([]);
    expect(h.conv.sessionData.pendingAttribute).toEqual(pending);
    expect(h.conv.state).toBe('awaiting_attribute');
    await h.sendQueued('Frita');
    expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({ productId: 37931, quantity: 1 })]);
    await h.sendQueued('contraentrega');
    await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    expect(h.service.ordersService.create.mock.calls[0][0].items.map(item => item.productId)).toEqual([37931]);
  });
}
