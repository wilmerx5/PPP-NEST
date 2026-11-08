import { harness } from './whatsapp-accuracy.test-support';

for (const [dish, drink, flavor, category, extra] of [
  ['Bowl Verde', 'Gaseosa 400ml', 'Cola', 'Bebidas', 'Malteada 500ml'],
  ['Pizza Vegetal', 'Jugo 500ml', 'Mora', 'Bebidas', 'Cafe Frio'],
  ['Arroz Marinero', 'Refresco 600ml', 'Limon', 'Bebidas', 'Batido 400ml'],
]) for (const enabled of [false,true]) for (const quantity of [2,3]) for (const fulfillment of ['pickup','delivery']) for (const reverse of [false,true]) for (const numeric of [false,true]) {
  it(`${dish}: same product flavor boundary ${enabled}/${quantity}/${fulfillment}/${reverse}/${numeric}`, async () => {
    const menu = [
      { id: 98101, code: 98101, name: dish, description: 'Sin bebida', price: 24000, availableNow: true, attributes: [] },
      { id: 98102, code: 98102, name: drink, description: 'Preparada con agua filtrada. Presentación individual.', price: 7000, availableNow: true, hasAttributes: true,
        attributes: [{ attributeName: 'Sabor', options: [flavor, 'Naranja'] }] },
      { id: 98103, code: 98103, name: extra, categoryName: category, description: 'Preparado con ingredientes de la casa.', price: 4000, availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Sabor', options: ['Vainilla', 'Chocolate'] }] },
      { id: 98104, code: 98104, name: 'Te Helado', description: 'Preparado con hojas de te.', price: 5000, availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Sabor', options: ['Durazno', 'Mandarina'] }] },
    ];
    const h = harness(menu, enabled);
    h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
    h.service.aiService.generateTurn = jest.fn().mockResolvedValue({ reply: '¿Cuál prefieres?', actions: {} });
    h.cfg.ignoreBusinessHours = false;
    h.service.businessService.getStatus = jest.fn().mockResolvedValue({ isOpen: true });
    h.conv.state = 'awaiting_payment';
    Object.assign(h.conv.sessionData, {
      cart: [{ productId: 98101, code: 98101, name: dish, quantity: 1, unitPrice: 24000, attributes: [], note: 'sin cebolla' }],
      orderType: fulfillment, fulfillmentChosen: true, address: 'Calle 10 #20-30', addressConfirmed: true,
      phoneConfirmed: true, contactPhone: h.conv.phoneE164, notesCollected: true, deliveryFeeCalculated: 2000,
    });
    h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 9810, dailyOrderNumber: 99 });
    const before = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued(`el ${dish} trae ${drink.split(' ')[0]}? Si no, agrega ${quantity} ${drink} sin hielo`);
    expect(h.conv.sessionData.pendingAttribute).toMatchObject({ productId: 98102, quantity });
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
    const existingId=98102,existingFlavor='Naranja';
    h.conv.sessionData.cart.push({productId:existingId,code:existingId,name:drink,unitPrice:7000,quantity:1,attributes:[{attributeName:'Sabor',attributeValue:existingFlavor}],note:'pedido previo'});
    const beforeInquiry=structuredClone(h.conv.sessionData);
    const requested=reverse?['Te Helado',extra]:[extra,'Te Helado'];
    const question=`¿Cuánto cuesta cada ${requested[0]} y cada ${requested[1]}?`;
    const responseStart=h.replies.length;await h.sendQueued(question);reply=h.replies.slice(responseStart).join('\n');
    expect(reply).toContain(extra);expect(reply).toContain('Te Helado');expect(reply).toMatch(/4[.,]000/);expect(reply).toMatch(/5[.,]000/);
    const prices=[...reply.matchAll(/\$\s*([\d.,]+)/g)].slice(0,2).map(match=>match[1].replace(/[^\d]/g,''));expect(prices).toEqual(reverse?['5000','4000']:['4000','5000']);
    expect(reply).toMatch(/sabor|elige|prefieres|opci[oó]n/i);
    expect(h.conv.sessionData.cart).toEqual(beforeInquiry.cart);expect(h.conv.sessionData.pendingAttribute).toEqual(beforeInquiry.pendingAttribute);expect(h.conv.sessionData.pendingMultiOrder).toEqual(beforeInquiry.pendingMultiOrder);expect(h.service.ordersService.create).not.toHaveBeenCalled();
    const expectedQuantity=quantity;
    await h.sendQueued(numeric?'1':flavor);
    expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
    expect(h.conv.sessionData.pendingMultiOrder).toBeFalsy();
    expect(h.conv.sessionData.cart[0]).toEqual(before[0]);
    expect(h.conv.state).toBe('awaiting_payment');
    await h.sendQueued('contraentrega'); await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const dto = h.service.ordersService.create.mock.calls[0][0];
    expect(dto.items.filter((item: any) => item.productId === 98101)).toHaveLength(1);
    const drinks = dto.items.filter((item: any) => item.productId === 98102);
    expect(drinks).toHaveLength(expectedQuantity+1);
    for (const item of drinks.filter(item=>item.note!=='pedido previo')) {
      expect(item.productId).toBe(98102);
      expect(item.note).toMatch(/sin hielo/i);
      expect(item.attributes).toEqual([{ attributeName: 'Sabor', attributeValue: flavor }]);
    }
    const extras = dto.items.filter((item: any) => item.productId === 98103);
    expect(extras).toHaveLength(2);
    for (const item of extras.filter(item=>item.note!=='pedido previo')) {
      expect(item.note).toMatch(/sin az[uú]car/i);
      expect(item.attributes).toEqual([{ attributeName: 'Sabor', attributeValue: 'Vainilla' }]);
    }
    const teas = dto.items.filter((item: any) => item.productId === 98104);
    expect(teas).toHaveLength(3);
    for (const item of teas.filter(item=>item.note!=='pedido previo')) {
      expect(item.note).toMatch(/sin hielo/i);
      expect(item.attributes).toEqual([{ attributeName: 'Sabor', attributeValue: 'Durazno' }]);
    }
    const old=dto.items.filter(item=>item.note==='pedido previo');expect(old).toHaveLength(1);expect(old[0].productId).toBe(existingId);expect(old[0].attributes).toEqual([{attributeName:'Sabor',attributeValue:existingFlavor}]);
    expect(dto.items).toHaveLength(7 + expectedQuantity);
    expect(dto.customerName).toBe('Wilmer');
    expect(dto.address).toContain('20-30');
    expect(dto.phone.replace(/\D/g, '')).toContain('3000000001');
  });
}
