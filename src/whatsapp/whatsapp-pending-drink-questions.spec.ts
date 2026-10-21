import { harness } from './whatsapp-accuracy.test-support';

for (const [dish, drink, flavor, alternative] of [
  ['Bowl Verde', 'Gaseosa 400ml', 'Cola', 'Agua 600ml'],
  ['Pizza Vegetal', 'Jugo 500ml', 'Mora', 'Limonada Natural'],
  ['Arroz Marinero', 'Refresco 600ml', 'Limon', 'Te Frio'],
]) for (const enabled of [false, true]) for (const scenario of ['other', 'otherKeep', 'change', 'composition', 'knownFlavor', 'missingFlavor', 'priceSwitch']) {
  it(`${dish}: pending flavor inquiry ${scenario}, agent=${enabled}`, async () => {
    const menu = [
      { id: 98101, code: 98101, name: dish, description: 'Sin bebida', price: 24000, availableNow: true, attributes: [] },
      { id: 98102, code: 98102, name: drink, description: 'Preparada con agua filtrada. Presentación individual.', price: 7000, availableNow: true, hasAttributes: true,
        attributes: [{ attributeName: 'Sabor', options: [flavor, 'Naranja'] }] },
      { id: 98103, code: 98103, name: alternative, price: 4000, availableNow: true, attributes: [] },
      { id: 98104, code: 98104, name: 'Agua Mineral 1L', price: 6000, availableNow: true, attributes: [] },
      { id: 98105, code: 98105, name: 'Jugo de Durazno', price: 5000, availableNow: false, attributes: [] },
    ];
    const h = harness(menu, enabled);
    h.service.aiService.generateTurn = jest.fn().mockResolvedValue({ reply: '¿Cuál prefieres?', actions: {} });
    h.conv.state = 'awaiting_payment';
    Object.assign(h.conv.sessionData, {
      cart: [{ productId: 98101, code: 98101, name: dish, quantity: 1, unitPrice: 24000, attributes: [], note: 'sin cebolla' }],
      orderType: 'delivery', fulfillmentChosen: true, address: 'Calle 10 #20-30', addressConfirmed: true,
      phoneConfirmed: true, contactPhone: h.conv.phoneE164, notesCollected: true, deliveryFeeCalculated: 2000,
    });
    h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 9810, dailyOrderNumber: 99 });
    const before = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued(`el ${dish} trae ${drink.split(' ')[0]}? Si no, agrega dos ${drink} sin hielo`);
    expect(h.conv.sessionData.pendingAttribute).toMatchObject({ productId: 98102, quantity: 2 });
    const pending = structuredClone(h.conv.sessionData.pendingAttribute);
    const question = scenario.startsWith('other') ? 'mejor la otra bebida' : scenario === 'change' ? 'cambia esas bebidas por otra' : scenario === 'composition' ? 'que trae esa bebida?' : scenario === 'knownFlavor' ? `tienes de ${flavor}?` : scenario === 'missingFlavor' ? 'tienes de tamarindo?' : 'cuanto cuestan las dos bebidas?';
    const reply = await h.sendQueued(question);
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.conv.sessionData.pendingAttribute).toMatchObject(pending!);
    expect(h.conv.state).toBe('awaiting_attribute');
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    if (scenario.startsWith('other') || scenario === 'change') {
      expect(reply).toContain(alternative);
      expect(reply).toContain('Agua Mineral 1L');
      expect(reply).not.toContain('Jugo de Durazno');
      expect(h.conv.sessionData.pendingAttribute?.alternativeProductIds).toEqual([98103, 98104]);
      expect(reply).toMatch(/nombre|cu[aá]l/i);
    } else if (scenario === 'composition') {
      expect(reply).toContain('agua filtrada');
      expect(reply).toContain(drink);
    } else if (scenario === 'knownFlavor') {
      expect(reply).toMatch(/s[ií].*(?:disponible|tenemos|hay)/i);
      expect(reply).toContain(flavor);
    } else if (scenario === 'missingFlavor') {
      expect(reply).toMatch(/no.*(?:tamarindo|figura|aparece)/i);
      expect(reply).toContain(flavor);
    } else expect(reply).toContain('14.000');
    const switching = ['other', 'change', 'priceSwitch'].includes(scenario);
    await h.sendQueued(scenario === 'other' ? alternative : switching ? `cambia esas bebidas por ${alternative}` : flavor);
    expect(h.conv.state).toBe('awaiting_payment');
    expect(h.conv.sessionData.cart[0]).toEqual(before[0]);
    expect(h.conv.sessionData.cart).toHaveLength(2);
    expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
    expect(h.conv.sessionData.cart[1]).toMatchObject({ productId: switching ? 98103 : 98102, quantity: 2, note: expect.stringMatching(/sin hielo/i) });
    await h.sendQueued('contraentrega'); await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const dto = h.service.ordersService.create.mock.calls[0][0];
    expect(dto.items.filter((item: any) => item.productId === 98101)).toHaveLength(1);
    const drinks = dto.items.filter((item: any) => item.productId !== 98101);
    expect(drinks).toHaveLength(2);
    for (const item of drinks) {
      expect(item.productId).toBe(switching ? 98103 : 98102);
      expect(item.note).toMatch(/sin hielo/i);
      if (!switching) expect(item.attributes).toEqual([{ attributeName: 'Sabor', attributeValue: flavor }]);
    }
    expect(dto.customerName).toBe('Wilmer');
    expect(dto.address).toContain('20-30');
    expect(dto.phone.replace(/\D/g, '')).toContain('3000000001');
  });
}
