import {harness} from './whatsapp-accuracy.test-support';

const fields = ['A nombre de Camila Rojas', 'Mi celular es 3000000002',
  'La dirección es Calle 6B #81B-51 Torre 3 apto 510', 'Pago por Nequi'];
for (const family of ['Arroz Chino', 'Pasta Artesanal']) for (const agent of [false, true])
for (const order of [0, 1, 2, 3]) for (const separator of ['\n', '; ', ', ']) for (const prefix of ['', 'Sí, ']) {
  it(`captures multiple contact fields without approving ${family}/${agent}/${order}/${JSON.stringify(separator)}/${prefix}`, async () => {
    const menu = [
      {id: 40201, code: 1, name: family, price: 38000},
      {id: 40202, code: 2, name: 'Costillas De Cerdo', price: 30000},
      {id: 40203, code: 3, name: `${family} Con Costillas De Cerdo`, price: 50000},
    ].map(p => ({...p, availableNow: true, hasAttributes: false, attributes: []}));
    const h = harness(menu, agent);
    h.conv.state = 'awaiting_final_confirm';
    Object.assign(h.conv.sessionData, {orderType: 'delivery', address: 'Calle 1 #2-3', addressConfirmed: true,
      fulfillmentChosen: true, deliveryFeeCalculated: 2000, paymentMethod: 'cash',
      contactPhone: h.conv.phoneE164, phoneConfirmed: true, notesCollected: true});
    h.conv.sessionData.cart = menu.slice(0, 2).map((p, i) => ({productId: p.id, code: p.code, name: p.name, unitPrice: p.price, quantity: 1, ...(i ? {note: 'sin gaseosa'} : {})}));
    h.service.ordersService.create = jest.fn().mockResolvedValue({id: 402, dailyOrderNumber: 402});
    h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
    h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
    await h.sendQueued('En combo');
    const before = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued(prefix + [...fields.slice(order), ...fields.slice(0, order)].join(separator));
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.conv.sessionData.pendingComposedDishRecovery?.productId).toBe(40203);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    expect(h.conv.customerName).toBe('Camila Rojas');
    expect(h.conv.sessionData.contactPhone?.replace(/\D/g, '')).toMatch(/3000000002$/);
    expect(h.conv.sessionData.address).toMatch(/6b.*81b.*51.*3.*510/i);
    expect(h.conv.sessionData.paymentMethod).toBe('transfer');
    expect(h.replies.at(-1)).toMatch(/sí.*no/is);
    await h.sendQueued('Correcto');
    expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId: 40203, quantity: 1, note: 'sin gaseosa'})]);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();

    await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const dto = h.service.ordersService.create.mock.calls[0][0];
    expect(dto.items).toEqual([expect.objectContaining({productId: 40203, note: 'sin gaseosa'})]);
    expect(dto.customerName).toBe('Camila Rojas');
    expect(dto.phone.replace(/\D/g, '')).toMatch(/3000000002$/);
    expect(dto.address).toMatch(/6b.*81b.*51.*3.*510/i);
    expect(h.conv.state).toBe('completed');
  });
}

for (const agent of [false, true]) for (const suffix of [
  'Pago por Nequi si me descuentas', 'Mi celular es 3000000003',
  'Agrega otro plato', 'La dirección es Calle 7',
]) {
  it(`preserves the whole form when a field is ambiguous ${agent}/${suffix}`, async () => {
    const family = 'Arroz Chino';
    const menu = [
      {id: 40201, code: 1, name: family, price: 38000},
      {id: 40202, code: 2, name: 'Costillas De Cerdo', price: 30000},
      {id: 40203, code: 3, name: `${family} Con Costillas De Cerdo`, price: 50000},
    ].map(p => ({...p, availableNow: true, hasAttributes: false, attributes: []}));
    const h = harness(menu, agent);
    h.conv.state = 'awaiting_final_confirm';
    Object.assign(h.conv.sessionData, {orderType: 'delivery', address: 'Calle 1 #2-3', addressConfirmed: true,
      fulfillmentChosen: true, deliveryFeeCalculated: 2000, paymentMethod: 'cash',
      contactPhone: h.conv.phoneE164, phoneConfirmed: true, notesCollected: true});
    h.conv.sessionData.cart = menu.slice(0, 2).map((p, i) => ({productId: p.id, code: p.code, name: p.name, unitPrice: p.price, quantity: 1, ...(i ? {note: 'sin gaseosa'} : {})}));
    h.service.ordersService.create = jest.fn().mockResolvedValue({id: 402, dailyOrderNumber: 402});
    h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
    h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
    await h.sendQueued('En combo');
    const before = structuredClone(h.conv.sessionData.cart);
    const snapshot = structuredClone(h.conv.sessionData);
    await h.sendQueued('Sí, ' + fields.slice(0, 3).concat(suffix).join('; '));
    expect(h.conv.customerName).toBe('Wilmer');
    expect(h.conv.sessionData).toEqual(snapshot);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    expect(h.replies.at(-1)).toMatch(/No cambié los datos ni el carrito/);
  });
}

for (const family of ['Arroz Chino', 'Pasta Artesanal']) for (const agent of [false, true]) {
  it(`captures an actual coalesced contact burst ${family}/${agent}`, async () => {
    const menu = [
      {id: 40201, code: 1, name: family, price: 38000},
      {id: 40202, code: 2, name: 'Costillas De Cerdo', price: 30000},
      {id: 40203, code: 3, name: `${family} Con Costillas De Cerdo`, price: 50000},
    ].map(p => ({...p, availableNow: true, hasAttributes: false, attributes: []}));
    const h = harness(menu, agent);
    h.conv.state = 'awaiting_final_confirm';
    Object.assign(h.conv.sessionData, {orderType: 'delivery', address: 'Calle 1 #2-3', addressConfirmed: true,
      fulfillmentChosen: true, deliveryFeeCalculated: 2000, paymentMethod: 'cash',
      contactPhone: h.conv.phoneE164, phoneConfirmed: true, notesCollected: true});
    h.conv.sessionData.cart = menu.slice(0, 2).map((p, i) => ({productId: p.id, code: p.code, name: p.name, unitPrice: p.price, quantity: 1, ...(i ? {note: 'sin gaseosa'} : {})}));
    h.service.ordersService.create = jest.fn().mockResolvedValue({id: 402, dailyOrderNumber: 402});
    h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
    h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
    await h.sendQueued('En combo');
    const before = structuredClone(h.conv.sessionData.cart);
    jest.useFakeTimers();
    try {
      const requests = fields.map((text, i) => h.service.handleIncoming({
        waId: 'customer', phoneE164: h.conv.phoneE164, messageId: `contact-402-${i}`,
        messageType: 'text', text, timestamp: Date.now() / 1000, raw: {},
      }));
      await jest.advanceTimersByTimeAsync(4000);
      await Promise.all(requests);
    } finally { jest.useRealTimers(); }
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.conv.sessionData.pendingComposedDishRecovery?.productId).toBe(40203);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    expect(h.conv.customerName).toBe('Camila Rojas');
    expect(h.conv.sessionData.contactPhone?.replace(/\D/g, '')).toMatch(/3000000002$/);
    expect(h.conv.sessionData.address).toMatch(/6b.*81b.*51.*3.*510/i);
    expect(h.conv.sessionData.paymentMethod).toBe('transfer');
    expect(h.replies.at(-1)).toMatch(/sí.*no/is);
    await h.sendQueued('Correcto');
    expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId: 40203, quantity: 1, note: 'sin gaseosa'})]);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();

    await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const dto = h.service.ordersService.create.mock.calls[0][0];
    expect(dto.items).toEqual([expect.objectContaining({productId: 40203, note: 'sin gaseosa'})]);
    expect(dto.customerName).toBe('Camila Rojas');
    expect(dto.phone.replace(/\D/g, '')).toMatch(/3000000002$/);
    expect(dto.address).toMatch(/6b.*81b.*51.*3.*510/i);
    expect(h.conv.state).toBe('completed');
  });
}
