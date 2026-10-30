import { harness } from './whatsapp-accuracy.test-support';

// Synthetic continuations of the counted-note incidents, from an empty cart to receipt.
for (const dish of ['Hamburguesa Clasica', 'Bowl Vegetal'])
  for (const agent of [false, true])
    for (const scenario of [
      'remove',
      'repeat-remove',
      'total-before-choice',
      'cancel',
      'cancel-retry',
      'total-after-remove',
      'repeat-confirm',
    ]) {
      it(`${dish}: ${scenario}, agent mock=${agent}`, async () => {
        const h = harness(
          [
            {
              id: 94701,
              code: 1,
              name: dish,
              price: 18000,
              availableNow: true,
              attributes: [],
            },
          ],
          agent,
        );
        h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
        h.service.aiService.generateTurn = jest
          .fn()
          .mockResolvedValue({ reply: '¿Cuál prefieres?', actions: {} });
        h.service.ordersService.create = jest
          .fn()
          .mockResolvedValue({ id: 322, dailyOrderNumber: 322 });
        h.service.ordersService.findTodayOrdersByPhone = jest
          .fn()
          .mockResolvedValue([]);
        await h.sendQueued(`3 ${dish}`);
        const original = structuredClone(h.conv.sessionData.cart);
        await h.sendQueued('para ambos sin cebolla');
        expect(h.conv.sessionData.cart).toEqual(original);
        expect(h.conv.sessionData.pendingSubsetKitchenNote).toMatchObject({
          quantity: 2,
          note: 'sin cebolla',
        });
        if (scenario === 'total-before-choice') {
          const total = await h.sendQueued('cuánto es el total');
          expect(total).toContain('54.000');
          expect(h.conv.sessionData.cart).toEqual(original);
          await h.sendQueued('confirmar');
          expect(h.service.ordersService.create).not.toHaveBeenCalled();
        }
        if (scenario === 'cancel-retry') {
          await h.sendQueued('no apliques esa nota');
          expect(h.conv.sessionData.cart).toEqual(original);
          expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeFalsy();
          await h.sendQueued('para ambos sin cebolla');
          expect(h.conv.sessionData.cart).toEqual(original);
          expect(h.conv.sessionData.pendingSubsetKitchenNote).toMatchObject({
            quantity: 2, note: 'sin cebolla',
          });
        }
        if (scenario === 'cancel') {
          await h.sendQueued('no apliques esa nota');
          expect(h.conv.sessionData.cart).toEqual(original);
        } else {
          await h.sendQueued('1');
          expect(
            h.conv.sessionData.cart.map((x) => [x.quantity, x.note || '']),
          ).toEqual([
            [1, ''],
            [2, 'sin cebolla'],
          ]);
          await h.sendQueued('a la segunda ponle como nota salsa aparte');
          expect(h.conv.sessionData.cart[1].note).toContain('sin cebolla');
          expect(h.conv.sessionData.cart[1].note).toContain('salsa aparte');
          const first = structuredClone(h.conv.sessionData.cart[0]);
          const reply = await h.sendQueued(
            'quita la nota sin cebolla de segunda',
          );
          expect(reply).toMatch(/nota|actualic/i);
          expect(h.conv.sessionData.cart[0]).toEqual(first);
          expect(h.conv.sessionData.cart[1]).toMatchObject({
            quantity: 2,
            note: 'salsa aparte',
          });
          if (scenario === 'repeat-remove') {
            const stable = structuredClone(h.conv.sessionData.cart);
            await h.sendQueued('quita la nota sin cebolla de segunda');
            expect(h.conv.sessionData.cart).toEqual(stable);
          }
        }
        if (scenario === 'total-after-remove') {
          const stable = structuredClone(h.conv.sessionData.cart);
          const total = await h.sendQueued('no mas, cuanto es todo lo que pedi');
          expect(total).toContain('54.000');
          expect(h.conv.sessionData.cart).toEqual(stable);
          expect(h.service.ordersService.create).not.toHaveBeenCalled();
        }
        expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeFalsy();
        expect(
          h.conv.sessionData.cart.reduce((n, x) => n + x.quantity, 0),
        ).toBe(3);
        expect(
          h.conv.sessionData.cart.every(
            (x) => x.productId === 94701 && x.unitPrice === 18000,
          ),
        ).toBe(true);
        await h.sendQueued('Solo eso porfa');
        await h.sendQueued('Contraentrega');
        expect(h.conv.state).toBe('awaiting_final_confirm');
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
        const receipt = await h.sendQueued('Confirmo');
        expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
        const dto = h.service.ordersService.create.mock.calls[0][0];
        expect(dto.items).toHaveLength(3);
        expect(dto.items.every((x) => x.productId === 94701)).toBe(true);
        expect(dto.items.filter((x) => x.note === 'salsa aparte')).toHaveLength(
          scenario === 'cancel' ? 0 : 2,
        );
        expect(dto.items.some((x) => x.note?.includes('sin cebolla'))).toBe(
          false,
        );
        expect(receipt).toContain('54.000');
        expect(receipt).not.toContain('sin cebolla');
        if (scenario !== 'cancel') expect(receipt).toContain('salsa aparte');
        expect(h.conv.state).toBe('completed');
        if (scenario === 'repeat-confirm') {
          await h.sendQueued('Confirmo');
          expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
          expect(h.conv.state).toBe('completed');
        }
      });
    }
