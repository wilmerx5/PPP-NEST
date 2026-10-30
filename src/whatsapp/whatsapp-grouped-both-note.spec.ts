import { harness } from './whatsapp-accuracy.test-support';

for (const dish of ['Hamburguesa Clasica', 'Bowl Vegetal'])
  for (const agent of [false, true])
    for (const phrase of [
      'ambos sin cebolla',
      'para ambos sin cebolla',
      'ambas sin cebolla',
    ])
      for (const quantity of [2, 3]) {
        it(`${dish} x${quantity}: ${phrase}; agent mock=${agent}`, async () => {
          const h = harness(
            [
              {
                id: 94601,
                code: 1,
                name: dish,
                price: 18000,
                availableNow: true,
                attributes: [],
              },
            ],
            agent,
          );
          h.service.aiService.classifyMessage = jest
            .fn()
            .mockResolvedValue(null);
          h.service.aiService.generateTurn = jest
            .fn()
            .mockResolvedValue({ reply: '¿Cuál prefieres?', actions: {} });
          h.service.ordersService.create = jest
            .fn()
            .mockResolvedValue({ id: 321, dailyOrderNumber: 321 });
          h.service.ordersService.findTodayOrdersByPhone = jest
            .fn()
            .mockResolvedValue([]);
          await h.sendQueued(`${quantity} ${dish}`);
          expect(h.conv.sessionData.cart).toHaveLength(1);
          const before = structuredClone(h.conv.sessionData.cart);
          const reply = await h.sendQueued(phrase);
          if (quantity === 3) {
            expect(h.conv.sessionData.cart).toEqual(before);
            expect(reply).toMatch(/cu[aá]l|aclar|indica|elige/i);
            expect(h.conv.sessionData.pendingSubsetKitchenNote).toMatchObject({
              quantity: 2,
              note: 'sin cebolla',
            });
            await h.sendQueued('1');
            expect(
              h.conv.sessionData.cart.reduce((n, x) => n + x.quantity, 0),
            ).toBe(3);
            expect(
              h.conv.sessionData.cart
                .filter((x) => x.note?.includes('sin cebolla'))
                .reduce((n, x) => n + x.quantity, 0),
            ).toBe(2);
            expect(
              h.conv.sessionData.cart
                .filter((x) => !x.note)
                .reduce((n, x) => n + x.quantity, 0),
            ).toBe(1);
            return;
          }
          expect(h.conv.sessionData.cart).toHaveLength(1);
          expect(h.conv.sessionData.cart[0]).toMatchObject({
            productId: 94601,
            quantity: 2,
            unitPrice: 18000,
            note: expect.stringContaining('sin cebolla'),
          });
          await h.sendQueued('Solo eso porfa');
          await h.sendQueued('Contraentrega');
          expect(h.service.ordersService.create).not.toHaveBeenCalled();
          const receipt = await h.sendQueued('Confirmo');
          expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
          const dto = h.service.ordersService.create.mock.calls[0][0];
          expect(dto.items).toHaveLength(2);
          for (const item of dto.items)
            expect(item).toMatchObject({
              productId: 94601,
              note: expect.stringContaining('sin cebolla'),
            });
          expect(receipt).toContain('36.000');
          expect(receipt).toContain('sin cebolla');
        });
      }

for (const agent of [false, true])
  for (const quantity of [1, 2]) {
    it(`grouped both guard: quantity=${quantity}, question=${quantity === 2}, agent mock=${agent}`, async () => {
      const h = harness(
        [
          {
            id: 94601,
            code: 1,
            name: 'Bowl Vegetal',
            price: 18000,
            availableNow: true,
            attributes: [],
          },
        ],
        agent,
      );
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      await h.sendQueued(`${quantity} Bowl Vegetal`);
      const before = structuredClone(h.conv.sessionData.cart);
      await h.sendQueued(
        quantity === 1 ? 'ambos sin cebolla' : '¿ambos sin cebolla?',
      );
      expect(h.conv.sessionData.cart).toEqual(before);
    });
  }
