import { harness } from './whatsapp-accuracy.test-support';

for (const dish of ['Bowl De Lentejas', 'Pizza Vegetal', 'Pescado Al Horno']) {
 for (const enabled of [false, true]) for (const state of ['awaiting_name', 'awaiting_address', 'awaiting_phone', 'awaiting_payment', 'awaiting_final_confirm']) {
  it(`${dish}: questions and contact correction during ${state}, agent=${enabled}`, async () => {
   const h = harness([{ id: 99201, code: 99201, name: dish, description: 'Con arroz y ensalada', price: 24000, availableNow: true, attributes: [] }], enabled);
   h.service.aiService.generateTurn = jest.fn().mockResolvedValue({ reply: '¿Cuál prefieres?', actions: {} });
   h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 9920, dailyOrderNumber: 101 });
   h.cfg.paymentMethods = h.cfg.paymentMethods.map(method => ({ ...method, enabled: method.flow !== 'mercadopago' }));
   await h.sendQueued(`Quiero un ${dish} sin cebolla`);
   const cart = structuredClone(h.conv.sessionData.cart);
   expect(cart).toHaveLength(1);
   h.conv.state = state;
   h.conv.customerName = state === 'awaiting_name' ? '' : 'Carlos Torres';
   Object.assign(h.conv.sessionData, { orderType: 'delivery', fulfillmentChosen: true,
    address: state === 'awaiting_address' ? undefined : 'Calle 10 #20-30', addressConfirmed: state !== 'awaiting_address',
    contactPhone: state === 'awaiting_phone' ? undefined : '3000000006', phoneConfirmed: state !== 'awaiting_phone',
    notesCollected: true, deliveryFeeCalculated: state === 'awaiting_address' ? undefined : 2000,
    paymentMethod: state === 'awaiting_final_confirm' ? 'cash' : undefined });
   const before = structuredClone(h.conv.sessionData);
   const name = h.conv.customerName;
   let reply = await h.sendQueued('Que precio tiene?');
   expect(reply).toMatch(/24.000/);
   expect(h.conv.sessionData.cart).toEqual(cart);
   expect(h.conv.customerName).toBe(name);
   expect(h.conv.state).toBe(state);
   expect(h.conv.sessionData.address).toBe(before.address);
   expect(h.conv.sessionData.contactPhone).toBe(before.contactPhone);
   reply = await h.sendQueued('Me dejas ver que tengo en el carrito?');
   expect(reply).toContain(dish);
   expect(reply).toMatch(/sin cebolla/i);
   expect(h.conv.state).toBe(state);
   expect(h.conv.sessionData.cart).toEqual(cart);
   expect(h.service.ordersService.create).not.toHaveBeenCalled();
   if (state === 'awaiting_name') await h.sendQueued('Carlos Torres');
   if (state === 'awaiting_address') await h.sendQueued('Calle 10 #20-30');
   if (state === 'awaiting_phone') await h.sendQueued('3000000006');
   expect(h.conv.state).toBe(state === 'awaiting_final_confirm' ? state : 'awaiting_payment');
   reply = await h.sendQueued('A nombre de Ana Martinez');
   expect(h.conv.customerName).toBe('Ana Martinez');
   expect(reply).toMatch(/Ana Martinez/i);
   expect(h.service.ordersService.create).not.toHaveBeenCalled();
   reply = await h.sendQueued('Mi teléfono es 3000000007');
   expect(h.conv.sessionData.contactPhone?.replace(/\D/g, '')).toContain('3000000007');
   expect(reply).toMatch(/300\s?000\s?0007|tel[eé]fono|contacto|n[uú]mero/i);
   expect(h.conv.sessionData.cart).toEqual(cart);
   expect(h.service.ordersService.create).not.toHaveBeenCalled();
   if (state !== 'awaiting_final_confirm') await h.sendQueued('contraentrega');
   expect(h.conv.state).toBe('awaiting_final_confirm');
   await h.sendQueued('confirmar');
   expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
   const dto = h.service.ordersService.create.mock.calls[0][0];
   expect(dto.items).toHaveLength(1);
   expect(dto.items[0]).toMatchObject({ productId: 99201, note: expect.stringMatching(/sin cebolla/i) });
   expect(dto.customerName).toBe('Ana Martinez');
   expect(dto.address).toMatch(/20.?30/);
   expect(dto.phone.replace(/\D/g, '')).toContain('3000000007');
   expect(h.conv.state).toBe('completed');
  });
 }
}
