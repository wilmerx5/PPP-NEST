import { harness } from './whatsapp-accuracy.test-support';
for (const other of [false, true])
  for (const agent of [false, true])
    for (const checkout of [false, true])
      for (const removal of [
        'quita el combo que va con Colombiana',
        'quita el combo con Colombiana',
      ]) {
        it(`chat combo repair ${other} ${agent} ${checkout} ${removal}`, async () => {
          const names = other
            ? [
                'Combo Hamburguesa Con Queso',
                'Combo Hamburguesa Con Tocineta',
                'Gaseosa 400ml',
                'Porcion De Yuca',
              ]
            : [
                'Combo Arroz Paisa',
                'Combo Arroz Con Pollo',
                'Gaseosa 400ml',
                'Porcion De Papa Francesa',
              ];
          const menu = names.map((name, i) => ({
            id: 98901 + i,
            code: 911 + i,
            name,
            price: [30000, 35000, 5000, 7000][i],
            availableNow: true,
            hasAttributes: i < 3,
            attributes:
              i < 3
                ? [
                    {
                      attributeName: i === 2 ? 'Sabor' : 'Bebida',
                      options: ['Colombiana', 'Ginger'],
                    },
                  ]
                : [],
          }));
          const h = harness(menu, agent);
          h.service.aiService.classifyMessage = jest
            .fn()
            .mockResolvedValue(null);
          h.service.ordersService.create = jest
            .fn()
            .mockResolvedValue({ id: 369, dailyOrderNumber: 369 });
          h.service.ordersService.findTodayOrdersByPhone = jest
            .fn()
            .mockResolvedValue([]);
          await h.sendQueued(
            `Quiero un ${names[0]} con Colombiana sin cebolla`,
          );
          await h.sendQueued(`Agrega una ${names[2]} sabor Colombiana aparte`);
          await h.sendQueued(`Agrega una ${names[3]}`);
          expect(h.conv.sessionData.cart).toHaveLength(3);
          if (checkout) {
            await h.sendQueued('no más');
            await h.sendQueued('contraentrega');
            expect(h.conv.state).toBe('awaiting_final_confirm');
          }
          const extra = structuredClone(
            h.conv.sessionData.cart.filter((l) => l.productId !== 98901),
          );
          const reply = await h.sendQueued(
            `El ${names[0]} lo quiero con gaseosa Ginger`,
          );
          expect(reply).toMatch(/Bebida: Ginger/);
          if (checkout) expect(h.conv.state).toBe('awaiting_final_confirm');
          expect(h.conv.sessionData.cart).toHaveLength(3);
          expect(
            h.conv.sessionData.cart.find((l) => l.productId === 98901),
          ).toMatchObject({
            quantity: 1,
            attributes: [{ attributeName: 'Bebida', attributeValue: 'Ginger' }],
          });
          expect(
            h.conv.sessionData.cart.find((l) => l.productId === 98901)?.note,
          ).toMatch(/sin cebolla/i);
          await h.sendQueued(`Agrega otro ${names[0]} con Colombiana`);
          expect(h.conv.sessionData.cart).toHaveLength(4);
          await h.sendQueued(removal);
          expect(h.conv.sessionData.cart).toHaveLength(3);
          expect(
            h.conv.sessionData.cart.filter((l) => l.productId !== 98901),
          ).toEqual(extra);
          expect(
            h.conv.sessionData.cart.find((l) => l.productId === 98901),
          ).toMatchObject({
            quantity: 1,
            attributes: [{ attributeName: 'Bebida', attributeValue: 'Ginger' }],
          });
          await h.sendQueued(`Quita el ${names[0]} y dame el ${names[1]}`);
          expect(
            h.conv.sessionData.cart.map((l) => l.productId).sort(),
          ).toEqual([98902, 98903, 98904]);
          expect(
            h.conv.sessionData.cart.find((l) => l.productId === 98902),
          ).toMatchObject({
            quantity: 1,
            attributes: [{ attributeName: 'Bebida', attributeValue: 'Ginger' }],
          });
          expect(
            h.conv.sessionData.cart.find((l) => l.productId === 98902)?.note,
          ).toMatch(/sin cebolla/i);
          await h.sendQueued('no más');
          await h.sendQueued('contraentrega');
          await h.sendQueued('confirmar');
          expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
          const items = h.service.ordersService.create.mock.calls[0][0].items;
          expect(items.map((item) => item.productId).sort()).toEqual([
            98902, 98903, 98904,
          ]);
          expect(
            items.find((item) => item.productId === 98902).attributes,
          ).toContainEqual({
            attributeName: 'Bebida',
            attributeValue: 'Ginger',
          });
          expect(items.find((item) => item.productId === 98902).note).toMatch(
            /sin cebolla/i,
          );
          expect(
            items.find((item) => item.productId === 98903).attributes,
          ).toContainEqual({
            attributeName: 'Sabor',
            attributeValue: 'Colombiana',
          });
        });
      }

for (const agent of [false, true])
  for (const guard of [
    'quantity',
    'two-lines',
    'payment',
    'missing-option',
    'missing-removal',
  ]) {
    it(`included option safety ${agent} ${guard}`, async () => {
      const menu = [
        {
          id: 98911,
          code: 921,
          name: 'Combo Sandwich',
          price: 20000,
          availableNow: true,
          hasAttributes: true,
          attributes: [
            { attributeName: 'Bebida', options: ['Colombiana', 'Ginger'] },
          ],
        },
      ];
      const h = harness(menu, agent);
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      await h.sendQueued('Quiero un Combo Sandwich con Ginger sin cebolla');
      if (guard === 'quantity') h.conv.sessionData.cart[0].quantity = 2;
      if (guard === 'two-lines')
        h.conv.sessionData.cart.push({
          ...structuredClone(h.conv.sessionData.cart[0]),
          note: 'sin tomate',
        });
      if (guard === 'payment') {
        h.conv.state = 'awaiting_mp_payment';
        h.conv.sessionData.mpPreferenceId = 'isolated-test';
      }
      const before = structuredClone(h.conv.sessionData.cart);
      const reply = await h.sendQueued(
        guard === 'missing-removal'
          ? 'quita el combo que va con Colombiana'
          : `El Combo Sandwich lo quiero con gaseosa ${guard === 'missing-option' ? 'Uva' : 'Colombiana'}`,
      );
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(reply).not.toMatch(/Listo ✅|quité/i);
    });
  }
