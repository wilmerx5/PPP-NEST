import { harness } from './whatsapp-accuracy.test-support';

const families = [
  ['Platano Con Queso Y Bocadillo', 'plátano con queso y bocadillo', 'bocadillo'],
  ['Bowl Con Tofu Y Verduras', 'bowl con tofu y verduras', 'verduras'],
  ['Sandwich Con Jamon Y Queso', 'sandwich con jamón y queso', 'queso'],
];
for (const [name, spoken, word] of families)
  for (const agent of [false, true])
    for (const typo of [word.slice(0, -1) + '9', word.slice(0, -1) + '0', word + '9', word.slice(0, -1) + '3'])
      for (const quantity of [1, 2, 3, 5])
        for (const phase of ['empty', 'other-dish', 'payment', 'final']) {
          it(`${name} embedded digit ${typo} quantity=${quantity} agent=${agent} phase=${phase}`, async () => {
            const h = harness([
              { id: 46101, code: 31, name, price: 9000, availableNow: true, attributes: [] },
              { id: 46102, code: 32, name: 'Sopa De Lentejas', price: 7000, availableNow: true, attributes: [] },
            ], agent);
            h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
            h.service.aiService.generateTurn = jest.fn().mockResolvedValue({ reply: '¿Cuál prefieres?', actions: {} });
            h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 461, dailyOrderNumber: 461 });
            h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
            Object.assign(h.conv.sessionData, {
              orderType: 'pickup', fulfillmentChosen: true, phoneConfirmed: true,
              contactPhone: h.conv.phoneE164, notesCollected: true,
            });
            if (phase !== 'empty') await h.sendQueued('Una Sopa De Lentejas sin cebolla');
            if (['payment', 'final'].includes(phase)) await h.sendQueued('nada más');
            if (phase === 'final') await h.sendQueued('contraentrega');
            if (phase === 'payment') expect(h.conv.state).toBe('awaiting_payment');
            if (phase === 'final') expect(h.conv.state).toBe('awaiting_final_confirm');
            const before = structuredClone(h.conv.sessionData.cart);
            const text = `Me regalas ${quantity === 1 ? 'un' : quantity} ${spoken.replace(word, typo)}`;
            const start = h.replies.length;
            await h.sendQueued(text);
            expect(h.conv.sessionData.cart.filter(p => p.productId === 46101).map(p => p.quantity)).toEqual([quantity]);
            expect(h.conv.sessionData.cart.filter(p => p.productId === 46102)).toEqual(before);
            const reply = h.replies.slice(start).join('\n');
            expect(reply).toContain(name);
            expect(reply).not.toMatch(/no manejamos|no pude|no entend[ií]/i);
            expect(h.conv.sessionData.pendingMatch).toBeFalsy();
            expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
            expect(h.service.ordersService.create).not.toHaveBeenCalled();
            await h.sendQueued('nada mas');
            await h.sendQueued('contraentrega');
            await h.sendQueued('confirmar');
            expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
            const dto = h.service.ordersService.create.mock.calls[0][0];
            expect(dto.items.filter(p => p.productId === 46101)).toHaveLength(quantity);
            expect(dto.items.filter(p => p.productId === 46102)).toHaveLength(phase === 'empty' ? 0 : 1);
            if (phase !== 'empty') expect(dto.items.find(p => p.productId === 46102).note).toBe('sin cebolla');
          });
        }
