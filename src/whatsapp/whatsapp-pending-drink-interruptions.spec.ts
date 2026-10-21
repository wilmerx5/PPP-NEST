import { harness } from './whatsapp-accuracy.test-support';

for (const [dish, drink, flavor, alternative] of [
  ['Bowl Verde', 'Gaseosa 400ml', 'Cola', 'Agua 600ml'],
  ['Pizza Vegetal', 'Jugo 500ml', 'Mora', 'Limonada Natural'],
  ['Arroz Marinero', 'Refresco 600ml', 'Limon', 'Te Frio'],
]) for (const enabled of [false, true]) for (const scenario of ['name', 'phone', 'address', 'all', 'allCancel', 'switchFlavor', 'switch', 'switchImplicit', 'unavailable', 'nameCorrection', 'phoneCorrection', 'addressCorrection', 'allCorrection', 'allFlavor', 'allFlavorComma', 'allFlavorLast', 'priceExplicit', 'priceShort', 'priceTotal', 'switchPolite', 'switchReplace', 'switchInstead']) {
  it(`${dish}: ${scenario} while choosing flavor, agent=${enabled}`, async () => {
    const menu = [
      { id: 98001, code: 98001, name: dish, description: 'Sin bebida', price: 24000, availableNow: true, attributes: [] },
      { id: 98002, code: 98002, name: drink, price: 7000, availableNow: true, hasAttributes: true,
        attributes: [{ attributeName: 'Sabor', options: [flavor, 'Naranja'] }] },
      { id: 98003, code: 98003, name: alternative, price: 4000, availableNow: true, hasAttributes: scenario === 'switchFlavor', attributes: scenario === 'switchFlavor' ? [{ attributeName: 'Sabor', options: ['Mango', 'Fresa'] }] : [] },
    ];
    const h = harness(menu, enabled);
    const needsName = scenario.startsWith('name') || scenario.startsWith('all');
    const needsPhone = scenario.startsWith('phone') || scenario.startsWith('all');
    const needsAddress = scenario.startsWith('address') || scenario.startsWith('all');
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
    const interrupt = scenario.startsWith('name') ? 'a nombre de Ana Torres' : scenario.startsWith('phone') ? '3001112233' : scenario.startsWith('address') ? 'Calle 10 #20-30' : scenario.startsWith('all') ? 'a nombre de Ana Torres\n3001112233\nCalle 10 #20-30' : scenario === 'switchImplicit' ? `cambia esas bebidas por ${alternative}` : scenario === 'switchPolite' ? `me cambias las bebidas por dos ${alternative}` : scenario === 'switchReplace' ? `reemplaza esas bebidas por dos ${alternative}` : scenario === 'switchInstead' ? `en lugar de esas bebidas quiero dos ${alternative}` : scenario.startsWith('switch') ? `mejor cambia esas bebidas por dos ${alternative} sin hielo` : 'mejor cambia esas bebidas por dos bebidas de tamarindo';
    if (scenario.startsWith('price')) {
      const question = scenario === 'priceExplicit' ? `cuanto cuesta ${drink}?` : scenario === 'priceShort' ? 'cuanto cuesta esa bebida?' : 'cuanto cuestan las dos bebidas?';
      const snapshot = structuredClone(h.conv.sessionData.pendingAttribute);
      const answer = await h.sendQueued(question);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.pendingAttribute).toEqual(snapshot);
      expect(answer).toContain(scenario === 'priceTotal' ? '14.000' : '7.000');
      expect(answer).not.toMatch(/no manejamos|no tenemos/i);
      expect(answer).not.toContain(`${dish}:`);
      expect(answer).toContain(drink);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    }
    let reply = await h.sendQueued(scenario === 'allFlavorLast' ? `${interrupt}; ${flavor}` : scenario === 'allFlavorComma' ? `${flavor}, ${interrupt.replace(/\n/g, ', ')}` : scenario === 'allFlavor' ? `${flavor}; ${interrupt}` : interrupt);
    const corrected = scenario.endsWith('Correction');
    if (corrected) {
      const corrections = [needsName ? 'a nombre de Luis Perez' : '', needsPhone ? '3012223344' : '', needsAddress ? 'Carrera 12 #34-56' : ''].filter(Boolean).join('\n');
      reply = await h.sendQueued(corrections);
      expect(reply).toContain('Sabor');
      // Repeating contact details must not add units or complete a pending flavor.
      await h.sendQueued(corrections);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    }
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
    } else if (scenario.startsWith('allFlavor')) {
      expect(reply).toContain(flavor);
      expect(reply).toContain('Ana Torres');
      expect(reply).toMatch(/C[oó]mo pagas|contraentrega/i);
      expect(reply).not.toMatch(/Falta terminar|no manejamos/i);
      expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
      expect(h.conv.sessionData.cart).toHaveLength(2);
    } else {
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.pendingAttribute).toMatchObject({ productId: 98002, quantity: 2 });
      expect(reply).toMatch(/Sabor|sabor/);
      if (needsName) expect(h.conv.customerName).toBe(corrected ? 'Luis Perez' : 'Ana Torres');
      if (needsPhone) expect(h.conv.sessionData.contactPhone?.replace(/\D/g, '')).toContain(corrected ? '3012223344' : '3001112233');
      if (needsAddress) expect(h.conv.sessionData.address).toContain(corrected ? '34-56' : '20-30');
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
    expect(dto.customerName).toBe(needsName ? (corrected ? 'Luis Perez' : 'Ana Torres') : 'Wilmer');
    expect(dto.phone.replace(/\D/g, '')).toContain(needsPhone ? (corrected ? '3012223344' : '3001112233') : '3000000001');
    expect(dto.address).toContain(needsAddress && corrected ? '34-56' : '20-30');
  });
}
