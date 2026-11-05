import {harness} from './whatsapp-accuracy.test-support';

async function setup(family: string, agent: boolean) {
  const menu = [
    {id: 40001, code: 1, name: family, price: 38000},
    {id: 40002, code: 2, name: 'Costillas De Cerdo', price: 30000},
    {id: 40003, code: 3, name: `${family} Con Costillas De Cerdo`, price: 50000},
  ].map(p => ({...p, availableNow: true, hasAttributes: false, attributes: []}));
  const h = harness(menu, agent);
  h.conv.state = 'awaiting_final_confirm';
  h.conv.sessionData.paymentMethod = 'transfer';
  h.conv.sessionData.cart = menu.slice(0, 2).map((p, i) => ({productId: p.id, code: p.code, name: p.name, unitPrice: p.price, quantity: 1, ...(i ? {note: 'sin gaseosa'} : {})}));
  h.service.ordersService.create = jest.fn().mockResolvedValue({id: 400, dailyOrderNumber: 400});
  h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
  h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
  await h.sendQueued('En combo');
  expect(h.conv.sessionData.pendingComposedDishRecovery?.productId).toBe(40003);
  return h;
}
for (const family of ['Arroz Chino', 'Pasta Artesanal']) for (const agent of [false, true]) {
  for (const answer of ['Sí, gracias', 'Correcto', 'De una', 'Sí, ese', 'Así es']) {
    it(`accepts only the proposed replacement ${family}/${agent}/${answer}`, async () => {
      const h = await setup(family, agent);
      await h.sendQueued(answer);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      expect(h.conv.sessionData.pendingComposedDishRecovery).toBeFalsy();
      expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId: 40003, quantity: 1, note: 'sin gaseosa'})]);
      await h.sendQueued('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      expect(h.service.ordersService.create.mock.calls[0][0].items).toEqual([expect.objectContaining({productId: 40003, note: 'sin gaseosa'})]);
    });
  }
  for (const answer of ['No gracias', 'No, déjalos separados', 'No, mejor separados']) {
    it(`declines and restores the next checkout step ${family}/${agent}/${answer}`, async () => {
      const h = await setup(family, agent);
      const before = structuredClone(h.conv.sessionData.cart);
      await h.sendQueued(answer);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.pendingComposedDishRecovery).toBeFalsy();
      expect(h.replies.at(-1)).toMatch(/confirmar/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      await h.sendQueued('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      expect(h.service.ordersService.create.mock.calls[0][0].items.map((p: {productId: number}) => p.productId)).toEqual([40001, 40002]);
    });
  }
  for (const answer of ['¿Sí?', '"sí"', 'Si cuesta menos sí', 'Sí, pero sin costillas', 'confirmar']) {
    it(`does not authorize a change or an order ${family}/${agent}/${answer}`, async () => {
      const h = await setup(family, agent);
      const before = structuredClone(h.conv.sessionData.cart);
      await h.sendQueued(answer);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.pendingComposedDishRecovery?.productId).toBe(40003);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
  }
}
