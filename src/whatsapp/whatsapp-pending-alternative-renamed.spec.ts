import { harness } from './whatsapp-accuracy.test-support';

for (const [dish, drink, flavor, alternative] of [
  ['Bowl Verde', 'Gaseosa 400ml', 'Cola', 'Agua 600ml'],
  ['Pizza Vegetal', 'Jugo 500ml', 'Mora', 'Limonada Natural'],
  ['Arroz Marinero', 'Refresco 600ml', 'Limon', 'Te Frio'],
]) for (const enabled of [false, true]) for (const scenario of ['oldName', 'newName', 'oldCode', 'newCode', 'ambiguousName', 'ambiguousCode']) {
  it(`${dish}: offered alternative ${scenario}, agent=${enabled}`, async () => {
    const menu = [
      { id: 98101, code: 98101, name: dish, description: 'Sin bebida', price: 24000, availableNow: true, attributes: [] },
      { id: 98102, code: 98102, name: drink, description: 'Preparada con agua filtrada. Presentación individual.', price: 7000, availableNow: true, hasAttributes: true,
        attributes: [{ attributeName: 'Sabor', options: [flavor, 'Naranja'] }] },
      { id: 98103, code: 98103, name: alternative, price: 4000, availableNow: true, attributes: [] },
      { id: 98104, code: 98104, name: 'Bebida Mineral 1L', price: 6000, availableNow: true, attributes: [] },
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
    const offered = await h.sendQueued('mejor la otra bebida');
    expect(offered).toContain(alternative);
    expect(h.conv.sessionData.cart).toEqual(before);
    menu[2].name = alternative + ' Especial';
    menu[2].code = 98203;
    if (scenario === 'ambiguousName') menu[3].name = alternative;
    if (scenario === 'ambiguousCode') menu[3].code = 98103;
    const message = scenario === 'oldName' || scenario === 'ambiguousName' ? alternative : scenario === 'newName' ? menu[2].name : scenario === 'oldCode' || scenario === 'ambiguousCode' ? '#98103' : '#98203';
    let reply = await h.sendQueued(message);
    if (scenario.startsWith('ambiguous')) {
      expect(reply).toMatch(/varias alternativas/i);
      expect(reply).toContain('#98203');
      expect(reply).toContain(menu[2].name);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.pendingAttribute).toMatchObject(pending!);
      expect(h.conv.state).toBe('awaiting_attribute');
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      reply = await h.sendQueued('#98203');
    }
    expect(reply).toContain(menu[2].name);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    const target = 98103;
    expect(h.conv.state).toBe('awaiting_payment');
    expect(h.conv.sessionData.cart[0]).toEqual(before[0]);
    expect(h.conv.sessionData.cart).toHaveLength(2);
    expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
    expect(h.conv.sessionData.cart[1]).toMatchObject({ productId: target, quantity: 2, note: expect.stringMatching(/sin hielo/i) });
    await h.sendQueued('contraentrega'); await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const dto = h.service.ordersService.create.mock.calls[0][0];
    expect(dto.items.filter((item: any) => item.productId === 98101)).toHaveLength(1);
    const drinks = dto.items.filter((item: any) => item.productId !== 98101);
    expect(drinks).toHaveLength(2);
    for (const item of drinks) {
      expect(item.productId).toBe(target);
      expect(item.note).toMatch(/sin hielo/i);
      expect(item.attributes || []).toEqual([]);
    }
    expect(dto.customerName).toBe('Wilmer');
    expect(dto.address).toContain('20-30');
    expect(dto.phone.replace(/\D/g, '')).toContain('3000000001');
  });
}
