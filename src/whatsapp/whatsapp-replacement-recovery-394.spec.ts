import { harness } from './whatsapp-accuracy.test-support';

for (const agent of [false, true]) {
 for (const food of ['Pollo', 'Hamburguesa']) {
  for (const interruption of ['¿Mejor broaster?', 'mejor sudado', 'mejor frito']) {
   for (const cancel of [false, true]) {
    it(`recover a pending replacement ${agent}/${food}/${interruption}/${cancel}`, async () => {
     const menu = [`${food} Frito`, `Combo ${food} Frito`, `Combo ${food} Broaster`].map((name, i) => ({
      id: 39401 + i, code: i + 1, name, price: 20000 + 5000 * i, availableNow: true,
      hasAttributes: i > 0,
      attributes: i > 0 ? [{ attributeName: 'Bebida', options: ['Limonada', 'Colombiana'] }] : [],
     }));
     const h = harness(menu, agent);
     const original = { productId: 39401, code: 1, name: menu[0].name, unitPrice: 20000, quantity: 2, note: 'Sin cebolla' };
     h.conv.sessionData.cart = [structuredClone(original)];
     h.conv.state = 'awaiting_attribute';
     h.conv.sessionData.pendingAttribute = {
      productId: 39402, code: 2, name: menu[1].name, price: 25000, quantity: 2,
      attributes: menu[1].attributes, selected: [], sourceText: `cambia a ${menu[1].name}`,
      replacement: { originalLine: structuredClone(original) },
     };
     h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 394, dailyOrderNumber: 394 });
     const clarification = await h.sendQueued(interruption);
     expect(h.conv.sessionData.cart).toEqual([original]);
     expect(h.conv.sessionData.pendingAttribute?.productId).toBe(39402);
     expect(clarification).not.toMatch(/algo más/i);
     if (interruption.includes('?')) expect(clarification).toMatch(/conservé la selección pendiente/i);
     if (interruption.includes('sudado')) expect(clarification).toMatch(/no encontré esa preparación/i);
     if (interruption.includes('frito')) expect(clarification).toMatch(/bebida/i);
     expect(h.service.ordersService.create).not.toHaveBeenCalled();

     const redirect = await h.sendQueued('mejor broaster');
     expect(redirect).toContain(menu[2].name);
     expect(h.conv.sessionData.cart).toEqual([original]);
     expect(h.conv.sessionData.pendingAttribute?.productId).toBe(39403);
     await h.sendQueued(cancel ? 'cancela ese cambio' : 'Limonada sin azúcar');
     expect(h.conv.sessionData.pendingAttribute).toBeUndefined();
     expect(h.conv.sessionData.cart).toHaveLength(1);
     expect(h.conv.sessionData.cart[0]).toMatchObject({ productId: cancel ? 39401 : 39403, quantity: 2, note: expect.stringMatching(/sin cebolla/i) });
     if (cancel) expect(h.conv.sessionData.cart).toEqual([original]);
     else {
      expect(h.conv.sessionData.cart[0].note).toMatch(/sin az[uú]car/i);
      expect(h.conv.sessionData.cart[0].attributes).toContainEqual({ attributeName: 'Bebida', attributeValue: 'Limonada' });
     }
     const before = structuredClone(h.conv.sessionData.cart);
     await h.sendQueued('Por favor');
     expect(h.conv.sessionData.cart).toEqual(before);
     await h.sendQueued('no más');
     const summary = await h.sendQueued('contraentrega');
     expect(summary).toMatch(/confirmar/i);
     expect(summary).not.toMatch(/Sigue pendiente agregar/i);
     await h.sendQueued('confirmar');
     expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
     const items = h.service.ordersService.create.mock.calls[0][0].items;
     expect(items).toHaveLength(2);
     for (const item of items) {
      expect(item.productId).toBe(cancel ? 39401 : 39403);
      expect(item.note).toMatch(/sin cebolla/i);
      if (!cancel) expect(item.note).toMatch(/sin az[uú]car/i);
     }
    });
   }
  }
 }
}
