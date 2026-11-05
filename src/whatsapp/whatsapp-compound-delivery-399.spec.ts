import { harness } from './whatsapp-accuracy.test-support';

for (const agent of [false, true]) for (const family of ['Arroz Chino', 'Pasta Artesanal']) {
  it(`fragmented compound delivery closes once ${family} agent=${agent}`, async () => {
    const menu = [
      {id: 39901, code: 1, name: family, price: 38000},
      {id: 39902, code: 2, name: 'Costillas De Cerdo', price: 30000},
      {id: 39903, code: 3, name: `${family} Con Costillas De Cerdo`, price: 50000},
    ].map(p => ({...p, availableNow: true, hasAttributes: false, attributes: []}));
    const h = harness(menu, agent);
    h.conv.customerName = '';
    h.conv.sessionData = {cart: [], orderType: 'delivery', phoneConfirmed: true, contactPhone: h.conv.phoneE164};
    Object.assign(h.cfg, {deliveryFeeMode: 'distance', restaurantLat: 4.63, restaurantLng: -74.15});
    h.service.deliveryRouting = {quoteDeliveryFee: jest.fn(async ({customerAddress}: {customerAddress: string}) =>
      /6b.*81b/i.test(customerAddress) ? {ok: true, fee: 2000, distanceKm: 1.6, source: 'google_directions', customer: {lat: 4.63, lng: -74.15}}
      : {ok: false, reason: 'address_ambiguous', message: 'Comparte la calle y el número o la ubicación.'})};
    h.service.ordersService.create = jest.fn().mockResolvedValue({id: 399, dailyOrderNumber: 399});
    h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
    h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
    await h.sendQueued(`Buen día, por favor un ${family}, costillas de cerdo y sin gaseosa.`);
    await h.sendQueued('Pago con nequi.');
    await h.sendQueued('Conjunto Tierra del Sol.');
    expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId: 39903, quantity: 1})]);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    await h.sendQueued('Calle 6b #81b -51 Torre 3 //apto 510');
    await h.sendQueued('Adriana Peña.');
    expect(h.conv.customerName).toMatch(/^Adriana Peña\.?$/);
    expect(h.conv.sessionData.address).toMatch(/81b.*51/i);
    expect(h.conv.sessionData.address).toMatch(/Torre 3/i);
    expect(h.conv.sessionData.address).toMatch(/510/);
    expect(h.conv.sessionData.paymentMethod).toBe('transfer');
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const dto = h.service.ordersService.create.mock.calls[0][0];
    expect(dto.items).toEqual([expect.objectContaining({productId: 39903, note: expect.stringMatching(/sin gaseosa/i)})]);
    expect(h.conv.state).toBe('completed');
  });
}

function splitFixture(family: string, agent: boolean) {
  const menu = [
    {id: 39911, code: 1, name: family, price: 38000},
    {id: 39912, code: 2, name: 'Costillas De Cerdo', price: 30000},
    {id: 39913, code: 3, name: `${family} Con Costillas De Cerdo`, price: 50000},
  ].map(p => ({...p, availableNow: true, hasAttributes: false, attributes: []}));
  const h = harness(menu, agent);
  h.conv.state = 'awaiting_final_confirm';
  h.conv.sessionData.paymentMethod = 'transfer';
  h.conv.sessionData.cart = menu.slice(0, 2).map((p, i) => ({productId: p.id, code: p.code, name: p.name, unitPrice: p.price, quantity: 1, ...(i ? {note: 'sin gaseosa'} : {})}));
  h.service.ordersService.create = jest.fn().mockResolvedValue({id: 399, dailyOrderNumber: 399});
  h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
  h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
  return h;
}
for (const family of ['Arroz Chino', 'Pasta Artesanal']) for (const agent of [false, true]) {
  for (const clarification of ['Es un solo plato', 'Es un solo producto', 'Los quiero juntos', 'Va todo junto', 'Es el mismo plato']) {
    it(`clarifies a split before replacing: ${family}/${agent}/${clarification}`, async () => {
      const h = splitFixture(family, agent);
      const before = structuredClone(h.conv.sessionData.cart);
      await h.sendQueued(clarification);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.pendingComposedDishRecovery?.productId).toBe(39913);
      expect(h.replies.at(-1)).toContain(`${family} Con Costillas De Cerdo`);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      await h.sendQueued('sí');
      expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId: 39913, quantity: 1, note: 'sin gaseosa'})]);
      await h.sendQueued('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      expect(h.service.ordersService.create.mock.calls[0][0].items).toEqual([expect.objectContaining({productId: 39913, note: 'sin gaseosa'})]);
    });
  }
  for (const text of ['¿Es un solo plato?', '¿En combo?', '"Es un solo plato"', 'No los quiero juntos', 'Si fuera un solo plato cuánto sería', 'Los quiero juntos con otro arroz']) {
    it(`does not infer a correction from ${family}/${agent}/${text}`, async () => {
      const h = splitFixture(family, agent);
      const before = structuredClone(h.conv.sessionData.cart);
      await h.sendQueued(text);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.pendingComposedDishRecovery).toBeFalsy();
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
  }
}
