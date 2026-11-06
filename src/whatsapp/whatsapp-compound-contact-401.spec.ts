import {harness} from './whatsapp-accuracy.test-support';

const details = [
  ['name', 'A nombre de Camila Rojas'],
  ['phone', 'Mi celular es 3000000002'],
  ['phone', 'Este es mi celular 3000000002'],
  ['phone', '3000000002'],
  ['address', 'La dirección es Calle 6B #81B-51 Torre 3 apto 510'],
  ['address', 'Calle 6B #81B-51 Torre 3 apto 510'],
  ['payment', 'Pago por Nequi'],
  ['payment', 'Nequi'],
] as const;
for (const family of ['Arroz Chino', 'Pasta Artesanal']) for (const agent of [false, true])
for (const [field, message] of details) for (const acknowledgement of ['', 'Sí, ', 'Claro, ', 'Listo, ']) {
  it(`keeps contact data without accepting the proposal ${family}/${agent}/${field}/${message}/${acknowledgement}`, async () => {
    const menu = [
      {id: 40101, code: 1, name: family, price: 38000},
      {id: 40102, code: 2, name: 'Costillas De Cerdo', price: 30000},
      {id: 40103, code: 3, name: `${family} Con Costillas De Cerdo`, price: 50000},
    ].map(p => ({...p, availableNow: true, hasAttributes: false, attributes: []}));
    const h = harness(menu, agent);
    h.conv.state = 'awaiting_final_confirm';
    Object.assign(h.conv.sessionData, {orderType: 'delivery', address: 'Calle 1 #2-3', addressConfirmed: true,
      fulfillmentChosen: true, deliveryFeeCalculated: 2000, paymentMethod: 'cash',
      contactPhone: h.conv.phoneE164, phoneConfirmed: true, notesCollected: true});
    h.conv.sessionData.cart = menu.slice(0, 2).map((p, i) => ({productId: p.id, code: p.code, name: p.name, unitPrice: p.price, quantity: 1, ...(i ? {note: 'sin gaseosa'} : {})}));
    h.service.ordersService.create = jest.fn().mockResolvedValue({id: 401, dailyOrderNumber: 401});
    h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
    h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
    await h.sendQueued('En combo');
    const before = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued(acknowledgement + message);
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.conv.sessionData.pendingComposedDishRecovery?.productId).toBe(40103);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    const assertDetails = () => {
      if (field === 'name') expect(h.conv.customerName).toBe('Camila Rojas');
      if (field === 'phone') expect(h.conv.sessionData.contactPhone?.replace(/\D/g, '')).toMatch(/3000000002$/);
      if (field === 'address') expect(h.conv.sessionData.address).toMatch(/6b.*81b.*51.*3.*510/i);
      if (field === 'payment') expect(h.conv.sessionData.paymentMethod).toBe('transfer');
    };
    assertDetails();
    await h.sendQueued('Correcto');
    expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId: 40103, quantity: 1, note: 'sin gaseosa'})]);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    assertDetails();
    await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const dto = h.service.ordersService.create.mock.calls[0][0];
    expect(dto.items).toEqual([expect.objectContaining({productId: 40103, note: 'sin gaseosa'})]);
    if (field === 'name') expect(dto.customerName).toBe('Camila Rojas');
    if (field === 'phone') expect(dto.phone.replace(/\D/g, '')).toMatch(/3000000002$/);
    if (field === 'address') expect(dto.address).toMatch(/6b.*81b.*51.*3.*510/i);
    expect(h.conv.state).toBe('completed');
  });
}

for (const family of ['Arroz Chino', 'Pasta Artesanal']) for (const agent of [false, true])
for (const message of ['¿Sí, pago por Nequi?', '"Sí, pago por Nequi"', 'Sí, pago por Nequi si me descuentas', 'Si puedo pagar por Nequi confirmo', 'Sí, pero sin costillas']) {
  it(`keeps conditional contact messages unapproved ${family}/${agent}/${message}`, async () => {
    const menu = [
      {id: 40101, code: 1, name: family, price: 38000},
      {id: 40102, code: 2, name: 'Costillas De Cerdo', price: 30000},
      {id: 40103, code: 3, name: `${family} Con Costillas De Cerdo`, price: 50000},
    ].map(p => ({...p, availableNow: true, hasAttributes: false, attributes: []}));
    const h = harness(menu, agent);
    h.conv.state = 'awaiting_final_confirm';
    h.conv.sessionData.paymentMethod = 'cash';
    h.conv.sessionData.cart = menu.slice(0, 2).map((p, i) => ({productId: p.id, code: p.code, name: p.name, unitPrice: p.price, quantity: 1, ...(i ? {note: 'sin gaseosa'} : {})}));
    h.service.ordersService.create = jest.fn();
    h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
    await h.sendQueued('En combo');
    const before = structuredClone(h.conv.sessionData);
    await h.sendQueued(message);
    expect(h.conv.sessionData.cart).toEqual(before.cart);
    expect(h.conv.sessionData.paymentMethod).toBe('cash');
    expect(h.conv.sessionData.pendingComposedDishRecovery).toEqual(before.pendingComposedDishRecovery);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
}
