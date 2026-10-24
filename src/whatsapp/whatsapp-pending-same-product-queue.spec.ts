import { harness } from './whatsapp-accuracy.test-support';

for (const [dish, drink, flavor, category, extra] of [
  ['Bowl Verde', 'Gaseosa 400ml', 'Cola', 'Bebidas', 'Malteada 500ml'],
  ['Pizza Vegetal', 'Jugo 500ml', 'Mora', 'Bebidas', 'Cafe Frio'],
  ['Arroz Marinero', 'Refresco 600ml', 'Limon', 'Bebidas', 'Batido 400ml'],
]) for (const enabled of [false, true]) for (const scenario of ['differentFlavor', 'sameFlavorDifferentNote']) for (const reversed of [false, true]) {
  it(`${dish}: same product queued twice ${scenario}, agent=${enabled}, reversed=${reversed}`, async () => {
    const menu = [
      { id: 98101, code: 98101, name: dish, description: 'Sin bebida', price: 24000, availableNow: true, attributes: [] },
      { id: 98102, code: 98102, name: drink, description: 'Preparada con agua filtrada. Presentación individual.', price: 7000, availableNow: true, hasAttributes: true,
        attributes: [{ attributeName: 'Sabor', options: [flavor, 'Naranja'] }] },
      { id: 98103, code: 98103, name: extra, categoryName: category, description: 'Preparado con ingredientes de la casa.', price: 4000, availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Sabor', options: ['Vainilla', 'Chocolate'] }] },
    ];
    const h = harness(menu, enabled);
    h.service.aiService.generateTurn = jest.fn().mockResolvedValue({ reply: '¿Cuál prefieres?', actions: {} });
    h.cfg.ignoreBusinessHours = false;
    h.service.businessService.getStatus = jest.fn().mockResolvedValue({ isOpen: true });
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
    const secondFlavor = scenario === 'differentFlavor' ? 'Chocolate' : 'Vainilla';
    const requests = [`Agrega dos ${extra} Vainilla sin azucar`, `Agrega tres ${extra} ${secondFlavor} sin hielo`];
    if (reversed) requests.reverse();
    let reply: string | undefined;
    for (const request of requests) {
      reply = await h.sendQueued(request);
      expect(reply).toContain(extra);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.pendingAttribute).toEqual(pending);
    }
    expect(h.conv.sessionData.pendingMultiOrder?.needsAttributes.map((item: any) => item.productId)).toEqual([98102, 98103, 98103]);
    reply = await h.sendQueued(`¿Qué trae ${drink}?`);
    expect(reply).toContain('agua filtrada');
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    reply = await h.sendQueued(flavor);
    expect(reply).toContain(extra);
    expect(h.conv.sessionData.cart.find((item: any) => item.productId === 98103 && /sin az[uú]car/i.test(item.note || ''))).toMatchObject({ quantity: 2, note: expect.stringMatching(/sin az[uú]car/i) });
    expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
    expect(h.conv.sessionData.pendingMultiOrder).toBeFalsy();
    expect(h.conv.sessionData.cart[0]).toEqual(before[0]);
    expect(h.conv.state).toBe('awaiting_payment');
    await h.sendQueued('contraentrega'); await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const dto = h.service.ordersService.create.mock.calls[0][0];
    expect(dto.items.filter((item: any) => item.productId === 98101)).toHaveLength(1);
    const drinks = dto.items.filter((item: any) => item.productId === 98102);
    expect(drinks).toHaveLength(2);
    for (const item of drinks) {
      expect(item.productId).toBe(98102);
      expect(item.note).toMatch(/sin hielo/i);
      expect(item.attributes).toEqual([{ attributeName: 'Sabor', attributeValue: flavor }]);
    }
    const extras = dto.items.filter((item: any) => item.productId === 98103);
    expect(extras).toHaveLength(5);
    const withoutSugar = extras.filter((item: any) => /sin az[uú]car/i.test(item.note || ''));
    const withoutIce = extras.filter((item: any) => /sin hielo/i.test(item.note || ''));
    expect(withoutSugar).toHaveLength(2);
    expect(withoutIce).toHaveLength(3);
    for (const item of withoutSugar) {
      expect(item.note).not.toMatch(/sin hielo/i);
      expect(item.attributes).toEqual([{ attributeName: 'Sabor', attributeValue: 'Vainilla' }]);
    }
    for (const item of withoutIce) {
      expect(item.note).not.toMatch(/sin az[uú]car/i);
      expect(item.attributes).toEqual([{ attributeName: 'Sabor', attributeValue: secondFlavor }]);
    }
    expect(dto.items).toHaveLength(8);
    expect(dto.customerName).toBe('Wilmer');
    expect(dto.address).toContain('20-30');
    expect(dto.phone.replace(/\D/g, '')).toContain('3000000001');
  });
}
