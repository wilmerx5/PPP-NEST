import { harness } from './whatsapp-accuracy.test-support';

// Real router/cart; only external order creation and inference are simulated.
for (const agent of [false, true]) {
 for (const food of ['Pollo', 'Hamburguesa']) {
  for (const courtesy of ['Por favor', 'gracias', 'porfa']) {
   for (const cancelChange of [false, true]) {
    it(`replacement recovery reaches one order ${agent}/${food}/${courtesy}/${cancelChange}`, async () => {
     const menu = [`${food} Frito`, `Combo ${food} Frito`, `Combo ${food} Broaster`].map((name, i) => ({
      id: 39201 + i, code: i + 1, name, price: 20000 + i * 5000, availableNow: true,
      hasAttributes: i > 0,
      attributes: i > 0 ? [{ attributeName: 'Bebida', options: ['Limonada', 'Colombiana'] }] : [],
     }));
     const h = harness(menu, agent);
     h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 392, dailyOrderNumber: 392 });
     const original = { productId: 39201, code: 1, name: menu[0].name, unitPrice: 20000, quantity: 2, note: 'Sin cebolla' };
     h.conv.sessionData.cart = [structuredClone(original)];
     h.conv.state = 'awaiting_attribute';
     h.conv.sessionData.pendingAttribute = {
      productId: 39202, code: 2, price: 25000, name: menu[1].name,
      attributes: menu[1].attributes, selected: [], quantity: 2,
      sourceText: `cambia a ${menu[1].name}`, replacement: { originalLine: structuredClone(original) },
     };
     await h.sendQueued(`Mejor quiero el ${menu[2].name}`);
     if (cancelChange) {
      await h.sendQueued('cancela ese cambio');
      expect(h.conv.sessionData.cart).toEqual([original]);
     } else {
      await h.sendQueued('Limonada sin azúcar');
      expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({
       productId: 39203, quantity: 2,
       attributes: expect.arrayContaining([{ attributeName: 'Bebida', attributeValue: 'Limonada' }]),
       note: expect.stringMatching(/sin az[uú]car/i),
      })]);
     }
     expect(h.conv.sessionData.pendingAttribute).toBeUndefined();
     const before = structuredClone(h.conv.sessionData.cart);
     await h.sendQueued(courtesy);
     expect(h.conv.sessionData.cart).toEqual(before);
     expect(h.service.ordersService.create).not.toHaveBeenCalled();
     await h.sendQueued('no más');
     const summary = await h.sendQueued('contraentrega');
     expect(summary).toMatch(/confirmar/i);
     expect(summary).not.toMatch(/Sigue pendiente agregar/i);
     await h.sendQueued('confirmar');
     expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
     const items = h.service.ordersService.create.mock.calls[0][0].items;
     expect(items).toHaveLength(2);
     for (const item of items) {
      expect(item.productId).toBe(cancelChange ? 39201 : 39203);
      expect(item.note).toMatch(/sin cebolla/i);
      if (!cancelChange) expect(item.note).toMatch(/sin az[uú]car/i);
     }
    });
   }
  }
 }
}
