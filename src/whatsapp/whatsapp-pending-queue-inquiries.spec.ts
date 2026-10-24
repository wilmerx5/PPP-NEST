import { harness } from './whatsapp-accuracy.test-support';

for (const [dish, drink, flavor, category, extra] of [
  ['Bowl Verde', 'Gaseosa 400ml', 'Cola', 'Bebidas', 'Malteada 500ml'],
  ['Pizza Vegetal', 'Jugo 500ml', 'Mora', 'Bebidas', 'Cafe Frio'],
  ['Arroz Marinero', 'Refresco 600ml', 'Limon', 'Bebidas', 'Batido 400ml'],
]) for (const enabled of [false, true]) for (const scenario of ['price', 'contents', 'time', 'comment', 'quantityAndPrice', 'priceThenQuantity', 'quantityThree', 'ambiguousCart', 'invalidQuantity']) {
  it(`${dish}: pending inquiry ${scenario}, agent=${enabled}`, async () => {
    const menu = [
      { id: 98101, code: 98101, name: dish, description: 'Sin bebida', price: 24000, availableNow: true, attributes: [] },
      { id: 98102, code: 98102, name: drink, description: 'Preparada con agua filtrada. Presentación individual.', price: 7000, availableNow: true, hasAttributes: true,
        attributes: [{ attributeName: 'Sabor', options: [flavor, 'Naranja'] }] },
      { id: 98103, code: 98103, name: extra, categoryName: category, description: 'Preparado con ingredientes de la casa.', price: 4000, availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Sabor', options: ['Vainilla', 'Chocolate'] }] },
      { id: 98104, code: 98104, name: 'Te Helado', description: 'Preparado con hojas de te.', price: 5000, availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Sabor', options: ['Durazno', 'Mandarina'] }] },
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
    let reply = await h.sendQueued(`Agrega dos ${extra} Vainilla sin azucar`);
    expect(reply).toContain(extra);
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.conv.sessionData.pendingAttribute).toEqual(pending);
    await h.sendQueued(`Agrega tres Te Helado Durazno sin hielo`);
    expect(h.conv.sessionData.pendingMultiOrder?.needsAttributes.map((item: any) => item.productId)).toEqual([98102, 98103, 98104]);
    reply = await h.sendQueued(`¿Qué trae ${drink}?`);
    expect(reply).toContain('agua filtrada');
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    if (scenario === 'ambiguousCart') {
      h.conv.sessionData.cart.push({productId:98102,code:98102,name:drink,quantity:1,unitPrice:7000,attributes:[{attributeName:'Sabor',attributeValue:'Naranja'}]});
    }
    const beforeInquiry = structuredClone(h.conv.sessionData);
    const expectedQuantity = scenario === 'quantityThree' ? 3 : ['quantityAndPrice', 'priceThenQuantity'].includes(scenario) ? 1 : 2;
    const questions: Record<string, string> = {
      price: `¿Cuánto cuesta cada ${drink}?`, contents: `¿Qué trae ${drink}?`,
      time: '¿Cuánto demora en llegar el pedido?', comment: 'Eso está caro, ¿cuánto vale cada bebida?',
      quantityAndPrice: `De ${drink} déjame solo una, ¿cuánto cuesta?`,
      priceThenQuantity: `¿Cuánto cuesta?; deja una ${drink}`,
      quantityThree: `deja tres ${drink}; ¿cuánto vale cada unidad?`,
      ambiguousCart: `De ${drink} déjame solo una, ¿cuánto cuesta?`,
      invalidQuantity: `deja 0 ${drink}; ¿cuánto cuesta?`,
    };
    const responseStart = h.replies.length;
    await h.sendQueued(questions[scenario]);
    reply = h.replies.slice(responseStart).join('\n');
    if (scenario === 'contents') expect(reply).toContain('agua filtrada');
    else if (scenario === 'time') expect(reply).toMatch(/minut|tiempo|demor|estimad/i);
    else expect(reply).toMatch(/7[.,]000/);
    if (scenario === 'ambiguousCart' || scenario === 'invalidQuantity') {
      expect(reply).toMatch(scenario === 'ambiguousCart' ? /otra l[ií]nea|compra pendiente/i : /entre 1 y 30/);
      expect(h.conv.sessionData.cart).toEqual(beforeInquiry.cart);
      expect(h.conv.sessionData.pendingAttribute).toEqual(beforeInquiry.pendingAttribute);
      expect(h.conv.sessionData.pendingMultiOrder).toEqual(beforeInquiry.pendingMultiOrder);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      return;
    }
    expect(reply).toMatch(/sabor|elige|prefieres|opcion|opción/i);
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.conv.sessionData.pendingAttribute).toMatchObject({productId:98102,quantity:expectedQuantity});
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    await h.sendQueued(flavor);
    expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
    expect(h.conv.sessionData.pendingMultiOrder).toBeFalsy();
    expect(h.conv.sessionData.cart[0]).toEqual(before[0]);
    expect(h.conv.state).toBe('awaiting_payment');
    await h.sendQueued('contraentrega'); await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const dto = h.service.ordersService.create.mock.calls[0][0];
    expect(dto.items.filter((item: any) => item.productId === 98101)).toHaveLength(1);
    const drinks = dto.items.filter((item: any) => item.productId === 98102);
    expect(drinks).toHaveLength(expectedQuantity);
    for (const item of drinks) {
      expect(item.productId).toBe(98102);
      expect(item.note).toMatch(/sin hielo/i);
      expect(item.attributes).toEqual([{ attributeName: 'Sabor', attributeValue: flavor }]);
    }
    const extras = dto.items.filter((item: any) => item.productId === 98103);
    expect(extras).toHaveLength(2);
    for (const item of extras) {
      expect(item.note).toMatch(/sin az[uú]car/i);
      expect(item.attributes).toEqual([{ attributeName: 'Sabor', attributeValue: 'Vainilla' }]);
    }
    const teas = dto.items.filter((item: any) => item.productId === 98104);
    expect(teas).toHaveLength(3);
    for (const item of teas) {
      expect(item.note).toMatch(/sin hielo/i);
      expect(item.attributes).toEqual([{ attributeName: 'Sabor', attributeValue: 'Durazno' }]);
    }
    expect(dto.items).toHaveLength(6 + expectedQuantity);
    expect(dto.customerName).toBe('Wilmer');
    expect(dto.address).toContain('20-30');
    expect(dto.phone.replace(/\D/g, '')).toContain('3000000001');
  });
}
