import { harness } from './whatsapp-accuracy.test-support';

for (const [dish, drink, flavor, alternative] of [
  ['Bowl Verde', 'Gaseosa 400ml', 'Cola', 'Agua 600ml'],
  ['Pizza Vegetal', 'Jugo 500ml', 'Mora', 'Limonada Natural'],
  ['Arroz Marinero', 'Refresco 600ml', 'Limon', 'Te Frio'],
]) for (const enabled of [false, true]) for (const scenario of ['name', 'phone', 'address', 'all', 'allCancel', 'switchFlavor', 'switch', 'switchImplicit', 'unavailable']) {
  it(`${dish}: ${scenario} while choosing flavor, agent=${enabled}`, async () => {
    const menu = [
      { id: 98001, code: 98001, name: dish, description: 'Sin bebida', price: 24000, availableNow: true, attributes: [] },
      { id: 98002, code: 98002, name: drink, price: 7000, availableNow: true, hasAttributes: true,
        attributes: [{ attributeName: 'Sabor', options: [flavor, 'Naranja'] }] },
      { id: 98003, code: 98003, name: alternative, price: 4000, availableNow: true, hasAttributes: scenario === 'switchFlavor', attributes: scenario === 'switchFlavor' ? [{ attributeName: 'Sabor', options: ['Mango', 'Fresa'] }] : [] },
    ];
    const h = harness(menu, enabled);
    const needsName = scenario === 'name' || scenario.startsWith('all');
    const needsPhone = scenario === 'phone' || scenario.startsWith('all');
    const needsAddress = scenario === 'address' || scenario.startsWith('all');
    h.conv.state = needsName ? 'awaiting_name' : needsPhone ? 'awaiting_phone' : needsAddress ? 'awaiting_address' : 'awaiting_payment';
    if (needsName) h.conv.customerName = '';
    Object.assign(h.conv.sessionData, {
      cart: [{ productId: 98001, code: 98001, name: dish, quantity: 1, unitPrice: 24000, attributes: [], note: 'sin cebolla' }],
      orderType: 'delivery', fulfillmentChosen: true, address: needsAddress ? undefined : 'Calle 10 #20-30',
      addressConfirmed: !needsAddress, phoneConfirmed: !needsPhone, contactPhone: needsPhone ? undefined : h.conv.phoneE164,
      notesCollected: true, deliveryFeeCalculated: 2000,
    });
    h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 9800, dailyOrderNumber: 99 });
    const before = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued(`el ${dish} trae ${drink.split(' ')[0]}? Si no, agrega dos ${drink} sin hielo`);
    expect(h.conv.sessionData.pendingAttribute).toMatchObject({ productId: 98002, quantity: 2 });
    const interrupt = scenario === 'name' ? 'a nombre de Ana Torres' : scenario === 'phone' ? '3001112233' : scenario === 'address' ? 'Calle 10 #20-30' : scenario.startsWith('all') ? 'a nombre de Ana Torres\n3001112233\nCalle 10 #20-30' : scenario === 'switchImplicit' ? `cambia esas bebidas por ${alternative}` : scenario.startsWith('switch') ? `mejor cambia esas bebidas por dos ${alternative} sin hielo` : 'mejor cambia esas bebidas por dos bebidas de tamarindo';
    let reply = await h.sendQueued(interrupt);
    if (scenario === 'switchFlavor') {
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.pendingAttribute).toMatchObject({ productId: 98003, quantity: 2 });
      expect(reply).toContain('Mango');
      reply = await h.sendQueued('Mango');
    }
    if (scenario.startsWith('switch')) {
      expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
      expect(h.conv.sessionData.cart).toHaveLength(2);
      expect(h.conv.sessionData.cart[1]).toMatchObject({ productId: 98003, quantity: 2, note: expect.stringMatching(/sin hielo/i) });
      expect(reply).toContain(alternative);
    } else {
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.pendingAttribute).toMatchObject({ productId: 98002, quantity: 2 });
      expect(reply).toMatch(/Sabor|sabor/);
      if (needsName) expect(h.conv.customerName).toBe('Ana Torres');
      if (needsPhone) expect(h.conv.sessionData.contactPhone?.replace(/\D/g, '')).toContain('3001112233');
      if (needsAddress) expect(h.conv.sessionData.address).toContain('20-30');
      await h.sendQueued(scenario === 'allCancel' ? 'no gracias' : flavor);
    }
    expect(h.conv.state).toBe('awaiting_payment');
    expect(h.conv.sessionData.pendingCheckoutResume).toBeFalsy();
    expect(h.conv.sessionData.pendingCheckoutDetailsCaptured).toBeFalsy();
    expect(h.conv.sessionData.cart[0]).toEqual(before[0]);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    await h.sendQueued('contraentrega'); await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const dto = h.service.ordersService.create.mock.calls[0][0];
    expect(dto.items.filter((item: any) => item.productId === 98001)).toHaveLength(1);
    const drinks = dto.items.filter((item: any) => item.productId !== 98001);
    expect(drinks).toHaveLength(scenario === 'allCancel' ? 0 : 2);
    for (const item of drinks) {
      expect(item.productId).toBe(scenario.startsWith('switch') ? 98003 : 98002);
      expect(item.note).toMatch(/sin hielo/i);
      if (scenario === 'switchFlavor') expect(item.attributes).toEqual([{ attributeName: 'Sabor', attributeValue: 'Mango' }]);
      if (!scenario.startsWith('switch')) expect(item.attributes).toEqual([{ attributeName: 'Sabor', attributeValue: flavor }]);
    }
    expect(dto.customerName).toBe(needsName ? 'Ana Torres' : 'Wilmer');
    expect(dto.phone.replace(/\D/g, '')).toContain(needsPhone ? '3001112233' : '3000000001');
    expect(dto.address).toContain('20-30');
  });
}
