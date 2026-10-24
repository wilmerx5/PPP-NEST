import { harness } from './whatsapp-accuracy.test-support';

for (const [dish, drink, flavor, category, extra] of [
  ['Bowl Verde', 'Gaseosa 400ml', 'Cola', 'Sopas', 'Sopa De Lentejas'],
  ['Pizza Vegetal', 'Jugo 500ml', 'Mora', 'Postres', 'Flan De Coco'],
  ['Arroz Marinero', 'Refresco 600ml', 'Limon', 'Entradas', 'Croquetas De Verduras'],
]) for (const enabled of [false, true]) for (const scenario of ['available', 'unavailable', 'missing']) {
  it(`${dish}: category interruption during flavor ${scenario}, agent=${enabled}`, async () => {
    const menu = [
      { id: 98101, code: 98101, name: dish, description: 'Sin bebida', price: 24000, availableNow: true, attributes: [] },
      { id: 98102, code: 98102, name: drink, description: 'Preparada con agua filtrada. Presentación individual.', price: 7000, availableNow: true, hasAttributes: true,
        attributes: [{ attributeName: 'Sabor', options: [flavor, 'Naranja'] }] },
      ...(scenario === 'missing' ? [] : [{ id: 98103, code: 98103, name: extra, categoryName: category, description: 'Preparado con ingredientes de la casa.', price: 4000, availableNow: scenario === 'available', attributes: [] }]),
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
    const reply = await h.sendQueued(`¿Qué ${category.toLowerCase()} tienes?`);
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.conv.sessionData.pendingAttribute).toEqual(pending);
    expect(h.conv.state).toBe('awaiting_attribute');
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    if (scenario === 'available') expect(reply).toContain(extra);
    else expect(reply).toMatch(/no (?:tenemos|hay|manejamos|encuentro)|agotad|no.*disponible/i);
    expect(reply).toContain(drink);
    expect(reply).toContain(flavor);
    expect(h.conv.sessionData.pendingMatch).toBeFalsy();
    expect(reply).not.toMatch(/no entend[ií]|dime la opci[oó]n.*pedido sigue igual/i);
    await h.sendQueued(flavor);
    expect(h.conv.state).toBe('awaiting_payment');
    expect(h.conv.sessionData.cart[0]).toEqual(before[0]);
    expect(h.conv.sessionData.cart).toHaveLength(2);
    expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
    expect(h.conv.sessionData.cart[1]).toMatchObject({ productId: 98102, quantity: 2, note: expect.stringMatching(/sin hielo/i) });
    await h.sendQueued('contraentrega'); await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const dto = h.service.ordersService.create.mock.calls[0][0];
    expect(dto.items.filter((item: any) => item.productId === 98101)).toHaveLength(1);
    const drinks = dto.items.filter((item: any) => item.productId !== 98101);
    expect(drinks).toHaveLength(2);
    for (const item of drinks) {
      expect(item.productId).toBe(98102);
      expect(item.note).toMatch(/sin hielo/i);
      expect(item.attributes).toEqual([{ attributeName: 'Sabor', attributeValue: flavor }]);
    }
    expect(dto.customerName).toBe('Wilmer');
    expect(dto.address).toContain('20-30');
    expect(dto.phone.replace(/\D/g, '')).toContain('3000000001');
  });
}
