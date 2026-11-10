import { harness } from './whatsapp-accuracy.test-support';

// Build all pending selections via the router. No historic session is injected.
for (const family of ['Combo', 'Wrap', 'Bowl']) {
  for (const agent of [false, true]) {
    for (const choice of ['number', 'name', 'ordinal']) {
      for (const keep of [0, 1]) {
        test(`${family}/${agent}/${choice}/keep=${keep}: correct, remove, inquire and close`, async () => {
          const names = [`${family} Clásico`, `${family} Especial`];
          const h = harness(names.map((name, i) => ({
            id: 94831 + i, code: 81 + i, name, price: 30000 + i * 5000,
            description: 'Acompañado de arroz y ensalada fresca.', availableNow: true, attributes: [],
          })), agent);
          h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
          h.service.aiService.generateTurn = jest.fn().mockResolvedValue({ reply: '¿Qué deseas?', actions: {} });
          h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 483, dailyOrderNumber: 483 });
          h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
          await h.sendQueued(`quiero 2 ${names[0]} y 2 ${names[1]}`);
          expect(h.cartRows().map(row => row.qty)).toEqual([2, 2]);
          await h.sendQueued('qué precio tienen');
          expect(h.conv.sessionData.pendingPriceInquiry).toBeDefined();
          const clarification = await h.sendQueued(`es solo un ${family}`);
          expect(clarification).toMatch(/Cuál línea/);
          expect(h.conv.sessionData.pendingPriceInquiry).toBeUndefined();
          expect(h.conv.sessionData.pendingCartQuantity).toBeDefined();
          const selection = choice === 'number' ? String(keep + 1)
            : choice === 'name' ? names[keep] : keep === 0 ? 'el primero' : 'el segundo';
          const corrected = await h.sendQueued(selection);
          expect(corrected).not.toMatch(/varias listas|no me quedó clara la dirección/i);
          expect(h.cartRows()).toEqual([
            expect.objectContaining({ id: 94831, qty: keep === 0 ? 1 : 2 }),
            expect.objectContaining({ id: 94832, qty: keep === 1 ? 1 : 2 }),
          ]);
          expect(h.conv.sessionData.pendingCartQuantity).toBeUndefined();
          await h.sendQueued(`quita el ${names[1 - keep]}`);
          expect(h.cartRows()).toEqual([expect.objectContaining({ id: 94831 + keep, qty: 1 })]);
          const before = structuredClone(h.conv.sessionData.cart);
          const contents = await h.sendQueued(`qué trae el ${names[keep]}`);
          expect(contents).toMatch(/arroz|ensalada/i);
          const price = await h.sendQueued('y qué precio');
          expect(price).toMatch(keep === 0 ? /30[.,]000/ : /35[.,]000/);
          expect(h.conv.sessionData.cart).toEqual(before);
          expect(h.service.ordersService.create).not.toHaveBeenCalled();
          await h.sendQueued('no más, recojo en el local');
          await h.sendQueued('en efectivo');
          expect(h.conv.state).toBe('awaiting_final_confirm');
          await h.sendQueued('confirmar');
          expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
          expect(h.service.ordersService.create.mock.calls[0][0].items)
            .toEqual([expect.objectContaining({ productId: 94831 + keep })]);
        });
      }
    }
  }
}
