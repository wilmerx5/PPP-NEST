import { harness } from './whatsapp-accuracy.test-support';

for (const [dish, drink, flavor, category, extra] of [
  ['Bowl Verde', 'Gaseosa 400ml', 'Cola', 'Bebidas', 'Malteada 500ml'],
  ['Pizza Vegetal', 'Jugo 500ml', 'Mora', 'Bebidas', 'Cafe Frio'],
  ['Arroz Marinero', 'Refresco 600ml', 'Limon', 'Bebidas', 'Batido 400ml'],
]) for (const enabled of [false, true]) for (const scenario of ['complete', 'cancelFirst', 'cancelSecond', 'unavailable']) {
  it(`${dish}: two configurable products ${scenario}, agent=${enabled}`, async () => {
    const menu = [
      { id: 98101, code: 98101, name: dish, description: 'Sin bebida', price: 24000, availableNow: true, attributes: [] },
      { id: 98102, code: 98102, name: drink, description: 'Preparada con agua filtrada. Presentación individual.', price: 7000, availableNow: true, hasAttributes: true,
        attributes: [{ attributeName: 'Sabor', options: [flavor, 'Naranja'] }] },
      { id: 98103, code: 98103, name: extra, categoryName: category, description: 'Preparado con ingredientes de la casa.', price: 4000, availableNow: scenario !== 'unavailable', hasAttributes: true, attributes: [{ attributeName: 'Sabor', options: ['Vainilla', 'Chocolate'] }] },
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
    let reply = await h.sendQueued(`Agrega dos ${extra} sin azucar`);
    expect(reply).toContain(extra);
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.conv.sessionData.pendingAttribute).toEqual(pending);
    if (scenario === 'unavailable') {
      expect(reply).toMatch(/no est[aá] disponible/i);
      expect(h.conv.sessionData.pendingMultiOrder).toBeFalsy();
      await h.sendQueued(flavor);
    } else {
    expect(h.conv.sessionData.pendingMultiOrder?.needsAttributes.map((item: any) => item.productId)).toEqual([98102, 98103]);
    reply = await h.sendQueued(`¿Qué trae ${drink}?`);
    expect(reply).toContain('agua filtrada');
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    await h.sendQueued(scenario === 'cancelFirst' ? 'Cancela esa bebida' : flavor);
    expect(h.conv.sessionData.pendingAttribute?.productId).toBe(98103);
    reply = await h.sendQueued(`¿Qué trae ${extra}?`);
    expect(reply).toContain('ingredientes de la casa');
    await h.sendQueued(scenario === 'cancelSecond' ? 'Cancela esa bebida' : 'Vainilla');
    }
    expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
    expect(h.conv.sessionData.pendingMultiOrder).toBeFalsy();
    expect(h.conv.sessionData.cart[0]).toEqual(before[0]);
    expect(h.conv.state).toBe('awaiting_payment');
    await h.sendQueued('contraentrega'); await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const dto = h.service.ordersService.create.mock.calls[0][0];
    expect(dto.items.filter((item: any) => item.productId === 98101)).toHaveLength(1);
    const drinks = dto.items.filter((item: any) => item.productId === 98102);
    expect(drinks).toHaveLength(scenario === 'cancelFirst' ? 0 : 2);
    for (const item of drinks) {
      expect(item.productId).toBe(98102);
      expect(item.note).toMatch(/sin hielo/i);
      expect(item.attributes).toEqual([{ attributeName: 'Sabor', attributeValue: flavor }]);
    }
    const extras = dto.items.filter((item: any) => item.productId === 98103);
    expect(extras).toHaveLength(['cancelSecond', 'unavailable'].includes(scenario) ? 0 : 2);
    for (const item of extras) {
      expect(item.note).toMatch(/sin az[uú]car/i);
      expect(item.attributes).toEqual([{ attributeName: 'Sabor', attributeValue: 'Vainilla' }]);
    }
    expect(dto.customerName).toBe('Wilmer');
    expect(dto.address).toContain('20-30');
    expect(dto.phone.replace(/\D/g, '')).toContain('3000000001');
  });
}
