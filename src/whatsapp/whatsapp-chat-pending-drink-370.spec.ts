import { harness } from './whatsapp-accuracy.test-support';
for (const agent of [false, true])
  for (const answer of ['1', 'Combo De Pollo Broaster'])
    it(`historical combo and half chicken keep Pepsi ${agent}/${answer}`, async () => {
      const h = harness(undefined, agent);
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      h.service.ordersService.create = jest
        .fn()
        .mockResolvedValue({ id: 370, dailyOrderNumber: 370 });
      h.service.ordersService.findTodayOrdersByPhone = jest
        .fn()
        .mockResolvedValue([]);
      const first = await h.sendQueued(
        '1 combo de pollo y medio pollo broaster con pepsi',
      );
      expect(first).toMatch(/broaster/i);
      expect(h.conv.sessionData.pendingMatch).toBeTruthy();
      await h.sendQueued(answer);
      expect(h.conv.sessionData.cart).toHaveLength(2);
      const combo = h.conv.sessionData.cart.find((l) => /combo/i.test(l.name));
      expect(combo?.attributes).toContainEqual({
        attributeName: 'Bebida',
        attributeValue: 'Pepsi',
      });
      expect(h.replies.at(-1)).toContain('Pepsi');
      expect(h.conv.sessionData.cart.every((l) => l.quantity === 1)).toBe(true);
      await h.sendQueued('no más');
      await h.sendQueued('contraentrega');
      await h.sendQueued('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const items = h.service.ordersService.create.mock.calls[0][0].items;
      expect(items).toHaveLength(2);
      expect(
        items.find((i) => i.productId === combo!.productId).attributes,
      ).toContainEqual({ attributeName: 'Bebida', attributeValue: 'Pepsi' });
    });

for (const protein of ['Pollo', 'Pescado'])
  for (const agent of [false, true])
    for (const quantity of [1, 2])
      for (const position of ['tail', 'owner'])
        for (const flavor of ['Pepsi', 'Ginger'])
          it(`pending drink ${protein}/${agent}/${quantity}/${position}/${flavor}`, async () => {
            const base = `Combo De ${protein}`;
            const half = `1/2 ${protein} Asado`;
            const menu = [`${base} Asado`, `${base} Frito`, half].map(
              (name, i) => ({
                id: 99001 + i,
                code: 931 + i,
                name,
                price: 20000 + i * 1000,
                availableNow: true,
                hasAttributes: true,
                attributes:
                  i < 2
                    ? [
                        {
                          attributeName: 'Bebida',
                          options: ['Colombiana', 'Pepsi', 'Ginger'],
                        },
                        {
                          attributeName: 'Arepas',
                          options: ['Blancas', 'Fritas'],
                        },
                      ]
                    : [
                        {
                          attributeName: 'Arepas',
                          options: ['Blancas', 'Fritas'],
                        },
                      ],
              }),
            );
            const h = harness(menu, agent);
            h.service.aiService.classifyMessage = jest
              .fn()
              .mockResolvedValue(null);
            h.service.ordersService.create = jest
              .fn()
              .mockResolvedValue({ id: 370, dailyOrderNumber: 370 });
            h.service.ordersService.findTodayOrdersByPhone = jest
              .fn()
              .mockResolvedValue([]);
            const request =
              position === 'tail'
                ? `${quantity} ${base} y medio ${protein} asado con ${flavor}`
                : `${quantity} ${base} con ${flavor} y medio ${protein} asado`;
            const question = await h.sendQueued(request);
            expect(question).toMatch(/asado|frito/i);
            expect(h.service.ordersService.create).not.toHaveBeenCalled();
            if (
              h.conv.sessionData.pendingMatch ||
              h.conv.sessionData.pendingMultiOrder
            )
              await h.sendQueued('1');
            expect(h.conv.sessionData.cart).toHaveLength(2);
            const combo = h.conv.sessionData.cart.find(
              (l) => l.productId === 99001,
            );
            expect(combo).toMatchObject({ quantity });
            expect(combo?.attributes).toContainEqual({
              attributeName: 'Bebida',
              attributeValue: flavor,
            });
            expect(
              h.conv.sessionData.cart.find((l) => l.productId === 99003),
            ).toMatchObject({ quantity: 1 });
            expect(h.replies.at(-1)).toContain(flavor);
            await h.sendQueued('no más');
            await h.sendQueued('contraentrega');
            await h.sendQueued('confirmar');
            expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
            const items = h.service.ordersService.create.mock.calls[0][0].items;
            expect(items).toHaveLength(quantity + 1);
            expect(items.filter((i) => i.productId === 99001)).toHaveLength(
              quantity,
            );
            expect(
              items
                .filter((i) => i.productId === 99001)
                .every((i) =>
                  i.attributes.some(
                    (a) =>
                      a.attributeName === 'Bebida' &&
                      a.attributeValue === flavor,
                  ),
                ),
            ).toBe(true);
          });

for (const agent of [false, true])
  for (const explicit of [false, true])
    it(`separate drink remains separate ${agent}/${explicit}`, async () => {
      const h = harness(undefined, agent);
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      h.service.ordersService.create = jest
        .fn()
        .mockResolvedValue({ id: 370, dailyOrderNumber: 370 });
      h.service.ordersService.findTodayOrdersByPhone = jest
        .fn()
        .mockResolvedValue([]);
      await h.sendQueued(
        `1 combo de pollo${explicit ? ' con Ginger' : ''} y medio pollo broaster y una gaseosa 400ml con Pepsi aparte`,
      );
      if (
        h.conv.sessionData.pendingMatch ||
        h.conv.sessionData.pendingMultiOrder
      )
        await h.sendQueued('1');
      expect(h.conv.sessionData.cart).toHaveLength(3);
      const combo = h.conv.sessionData.cart.find((l) => /combo/i.test(l.name));
      const drink = h.conv.sessionData.cart.find((l) =>
        /gaseosa/i.test(l.name),
      );
      expect(combo?.attributes).toContainEqual({
        attributeName: 'Bebida',
        attributeValue: explicit ? 'Ginger' : 'Colombiana',
      });
      expect(drink?.attributes).toContainEqual({
        attributeName: 'Sabor',
        attributeValue: 'Pepsi',
      });
      await h.sendQueued('no más');
      await h.sendQueued('contraentrega');
      await h.sendQueued('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      expect(
        h.service.ordersService.create.mock.calls[0][0].items,
      ).toHaveLength(3);
    });
