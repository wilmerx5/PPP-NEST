import { harness } from './whatsapp-accuracy.test-support';

// Real-router replay of the November 8 inquiry that used to add a second combo.
// All external ports are supplied by the harness; order creation is a DTO mock.
for (const family of ['Combo', 'Wrap', 'Bowl']) {
  for (const agent of [false, true]) {
    for (const question of ['Q trae', 'Que trae', 'Qué incluye', 'Cómo viene']) {
      test(`${family}/${agent}/${question}: inquiry preserves the purchase through confirmation`, async () => {
        const names = [`${family} Clásico`, `${family} Especial`];
        const h = harness(names.map((name, index) => ({
          id: 94821 + index, code: 81 + index, name,
          price: 30000 + index * 5000, availableNow: true,
          description: 'Acompañado de arroz y ensalada fresca.', attributes: [],
        })), agent);
        h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
        h.service.aiService.generateTurn = jest.fn().mockResolvedValue({ reply: '¿Qué deseas?', actions: {} });
        h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 482, dailyOrderNumber: 482 });
        h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
        await h.sendQueued(`quiero un ${names[0]}`);
        expect(h.cartRows()).toEqual([expect.objectContaining({ id: 94821, qty: 1 })]);
        const before = structuredClone(h.conv.sessionData.cart);
        const answer = await h.sendQueued(`${question} el ${family.toLowerCase()}`);
        expect(answer).toMatch(/arroz|ensalada/i);
        expect(answer).not.toMatch(/no manejamos|Listo ✅/i);
        expect(h.conv.sessionData.cart).toEqual(before);
        const price = await h.sendQueued('Y q precio');
        expect(price).toMatch(/30[.,]000/);
        expect(h.conv.sessionData.cart).toEqual(before);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
        await h.sendQueued('no más, recojo en el local');
        await h.sendQueued('en efectivo');
        expect(h.conv.state).toBe('awaiting_final_confirm');
        await h.sendQueued('confirmar');
        expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
        expect(h.service.ordersService.create.mock.calls[0][0].items)
          .toEqual([expect.objectContaining({ productId: 94821 })]);
      });
    }
  }
}
