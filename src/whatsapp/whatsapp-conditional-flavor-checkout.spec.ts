import { harness } from './whatsapp-accuracy.test-support';

for (const [dish, drink, flavor] of [
  ['Bowl Verde', 'Gaseosa 400ml', 'Cola'],
  ['Pizza Vegetal', 'Jugo 500ml', 'Mora'],
  ['Arroz Marinero', 'Refresco 600ml', 'Limon'],
]) for (const enabled of [false, true]) for (const state of ['awaiting_name', 'awaiting_phone', 'awaiting_address']) {
  for (const scenario of ['choose', 'change', 'cancel']) {
    it(`${dish}: ${scenario}, return ${state}, agent=${enabled}`, async () => {
      const menu = [
        { id: 96001, code: 96001, name: dish, description: 'Sin bebida', price: 24000, availableNow: true, attributes: [] },
        { id: 96002, code: 96002, name: drink, price: 7000, availableNow: true, hasAttributes: true,
          attributes: [{ attributeName: 'Sabor', options: [flavor, 'Naranja'] }] },
      ];
      const h = harness(menu, enabled);
      h.conv.state = state;
      if (state === 'awaiting_name') h.conv.customerName = '';
      Object.assign(h.conv.sessionData, {
        cart: [{ productId: 96001, code: 96001, name: dish, quantity: 1, unitPrice: 24000, attributes: [], note: 'sin cebolla' }],
        orderType: 'delivery', fulfillmentChosen: true,
        address: state === 'awaiting_address' ? undefined : 'Calle 10 #20-30',
        addressConfirmed: state !== 'awaiting_address',
        phoneConfirmed: state !== 'awaiting_phone',
        contactPhone: state === 'awaiting_phone' ? undefined : h.conv.phoneE164,
        notesCollected: true, deliveryFeeCalculated: 2000,
      });
      h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 9600, dailyOrderNumber: 99 });
      const before = structuredClone(h.conv.sessionData.cart);
      const type = drink.split(' ')[0];
      const first = await h.sendQueued(`el ${dish} trae ${type}? Si no, agrega dos ${drink} sin hielo`);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.pendingAttribute).toMatchObject({ productId: 96002, quantity: 2 });
      expect(h.conv.sessionData.pendingCheckoutResume).toBe(state);
      expect(first).toContain(flavor);
      const reply = await h.sendQueued(scenario === 'cancel' ? 'no gracias' : scenario === 'change' ? `mejor solo una con ${flavor}` : flavor);
      expect(h.conv.state).toBe(state);
      expect(h.conv.customerName).toBe(state === 'awaiting_name' ? '' : 'Wilmer');
      expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
      expect(h.conv.sessionData.pendingCheckoutResume).toBeFalsy();
      expect(h.conv.sessionData.cart[0]).toEqual(before[0]);
      const qty = scenario === 'cancel' ? 0 : scenario === 'change' ? 1 : 2;
      expect(h.conv.sessionData.cart).toHaveLength(qty ? 2 : 1);
      if (qty) expect(h.conv.sessionData.cart[1]).toMatchObject({ productId: 96002, quantity: qty,
        note: expect.stringMatching(/sin hielo/i), attributes: [{ attributeName: 'Sabor', attributeValue: flavor }] });
      expect(reply).toMatch(state === 'awaiting_name' ? /nombre/i : state === 'awaiting_phone' ? /(?:tel[eé]fono|n[uú]mero|contacto)/i : /direcci[oó]n/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      await h.sendQueued(state === 'awaiting_name' ? 'Ana Torres' : state === 'awaiting_phone' ? '3001112233' : 'Calle 10 #20-30');
      await h.sendQueued('contraentrega');
      await h.sendQueued('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const dto = h.service.ordersService.create.mock.calls[0][0];
      expect(dto.items.filter((item: any) => item.productId === 96001)).toHaveLength(1);
      const drinks = dto.items.filter((item: any) => item.productId === 96002);
      expect(drinks).toHaveLength(qty);
      for (const item of drinks) {
        expect(item.note).toMatch(/sin hielo/i);
        expect(item.attributes).toEqual([{ attributeName: 'Sabor', attributeValue: flavor }]);
      }
      expect(dto.address).toContain('20-30');
      expect(dto.customerName).toBe(state === 'awaiting_name' ? 'Ana Torres' : 'Wilmer');
      expect(dto.phone.replace(/\D/g, '')).toContain(state === 'awaiting_phone' ? '3001112233' : '3000000001');
    });
  }
}

for (const enabled of [false, true]) for (const [text, isName] of [
  ['Ana Torres', true], ['Luis Mosquera', true],
  ['Torres del Sol', false], ['Hospital Central', false], ['Calle 12 #3-45', false], ['que precio tiene', false],
] as const) {
  it(`name prompt distinguishes ${text}, agent=${enabled}`, async () => {
    const h = harness([{ id: 97001, code: 97001, name: 'Bowl Verde', price: 24000, availableNow: true, attributes: [] }], enabled);
    h.conv.state = 'awaiting_name'; h.conv.customerName = '';
    Object.assign(h.conv.sessionData, { cart: [{ productId: 97001, code: 97001, name: 'Bowl Verde', quantity: 1, unitPrice: 24000, attributes: [] }],
      orderType: 'delivery', fulfillmentChosen: true, address: 'Calle 10 #20-30', addressConfirmed: true,
      phoneConfirmed: true, contactPhone: h.conv.phoneE164, notesCollected: true, deliveryFeeCalculated: 2000 });
    const before = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued(text);
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.conv.customerName).toBe(isName ? text : '');
    if (isName) {
      expect(h.conv.sessionData.address).toBe('Calle 10 #20-30');
      expect(h.conv.state).toBe('awaiting_payment');
    }
  });
}
