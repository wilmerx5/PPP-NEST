import { harness } from './whatsapp-accuracy.test-support';
for (const agent of [false, true])
  for (const stage of ['pending', 'ready'])
    it(`original four executives restated ${agent}/${stage}`, async () => {
      const h = harness(undefined, agent);
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      h.service.ordersService.create = jest
        .fn()
        .mockResolvedValue({ id: 371, dailyOrderNumber: 371 });
      h.service.ordersService.findTodayOrdersByPhone = jest
        .fn()
        .mockResolvedValue([]);
      await h.sendQueued(
        'Por favor 4 ejecutivos\n3 ejecutivos con frito\n1 broster\nPierna pernil todos\n3 ajiacos\n1 menudencias',
      );
      await h.sendQueued('Sin ensaladas');
      if (stage === 'ready') await h.sendQueued('2');
      const before = structuredClone(h.conv.sessionData);
      for (const text of [
        'solo queria 4 ejecutivos',
        'solo eran 3 fritos y uno rboaster',
      ]) {
        const response = await h.sendQueued(text);
        if (stage === 'ready')
          expect(response).toMatch(/Ya son 4|Así está el reparto/);
        expect(h.conv.sessionData.cart).toEqual(before.cart);
        expect(h.conv.sessionData.pendingCountedHeaderOrder).toEqual(
          before.pendingCountedHeaderOrder,
        );
        expect(h.conv.sessionData.pendingCartQuantity).toBeFalsy();
      }
      if (stage === 'pending') await h.sendQueued('2');
      const cart = h.conv.sessionData.cart;
      expect(cart.reduce((n, l) => n + l.quantity, 0)).toBe(4);
      expect(cart.every((l) => [22, 18].includes(l.productId))).toBe(true);
      expect(
        cart
          .filter((l) => l.productId === 22)
          .reduce((n, l) => n + l.quantity, 0),
      ).toBe(3);
      expect(cart.every((l) => /sin ensaladas/i.test(l.note || ''))).toBe(true);
      await h.sendQueued('no más');
      await h.sendQueued('contraentrega');
      await h.sendQueued('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      expect(
        h.service.ordersService.create.mock.calls[0][0].items,
      ).toHaveLength(4);
    });

for (const other of [false, true])
  for (const agent of [false, true])
    for (const checkout of [false, true])
      for (const scenario of ['same', 'repair', 'ambiguous', 'foreign'])
        it(`count repair ${other}/${agent}/${checkout}/${scenario}`, async () => {
          const names = other
            ? [
                'Bandeja De Pescado Frito',
                'Bandeja De Pescado Asado',
                'Postre De La Casa',
                'Pescado Asado',
              ]
            : [
                'Ejecutivo Con Pollo Frito',
                'Ejecutivo Con Pollo Broaster',
                'Postre De La Casa',
                '1 Pollo Broaster',
              ];
          const menu = names.map((name, i) => ({
            id: 99501 + i,
            code: 951 + i,
            name,
            price: 20000 + i * 1000,
            availableNow: true,
            hasAttributes: i < 2,
            attributes:
              i < 2
                ? [
                    {
                      attributeName: 'Sopa',
                      options: ['Ajiaco', 'Menudencias'],
                    },
                    {
                      attributeName: 'Bebida',
                      options: ['Pepsi', 'Colombiana'],
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
            .mockResolvedValue({ id: 371, dailyOrderNumber: 371 });
          h.service.ordersService.findTodayOrdersByPhone = jest
            .fn()
            .mockResolvedValue([]);
          h.conv.sessionData.cart = menu.slice(0, 3).map((p, i) => ({
            productId: p.id,
            code: p.code,
            name: p.name,
            unitPrice: p.price,
            quantity:
              i === 0
                ? scenario === 'repair' || scenario === 'ambiguous'
                  ? 7
                  : 3
                : 1,
            note: i < 2 ? 'sin ensalada' : undefined,
            attributes:
              i < 2
                ? [
                    {
                      attributeName: 'Sopa',
                      attributeValue: i === 0 ? 'Ajiaco' : 'Menudencias',
                    },
                    { attributeName: 'Bebida', attributeValue: 'Pepsi' },
                  ]
                : [],
          }));
          if (scenario === 'ambiguous') {
            h.conv.sessionData.cart[0].quantity = 4;
            h.conv.sessionData.cart.push({
              ...structuredClone(h.conv.sessionData.cart[0]),
              quantity: 3,
              note: 'sin arroz',
            });
          }
          if (scenario === 'foreign') {
            h.conv.sessionData.cart[1] = {
              productId: 99504,
              code: 954,
              name: names[3],
              unitPrice: 23000,
              quantity: 1,
              attributes: [],
            };
          }
          if (checkout) {
            await h.sendQueued('no más');
            await h.sendQueued('contraentrega');
            expect(h.conv.state).toBe('awaiting_final_confirm');
          }
          const before = structuredClone(h.conv.sessionData.cart);
          const response = await h.sendQueued(
            other
              ? 'solo eran 3 fritos y uno asado'
              : 'solo eran 3 fritos y uno rboaster',
          );
          if (scenario === 'ambiguous' || scenario === 'foreign') {
            expect(h.conv.sessionData.cart).toEqual(before);
            expect(response).toMatch(/indica|varias líneas/i);
            expect(h.service.ordersService.create).not.toHaveBeenCalled();
            return;
          }
          expect(response).toMatch(/reparto|actualicé las cantidades/);
          expect(h.conv.sessionData.cart).toEqual(
            before.map((l, i) => (i === 0 ? { ...l, quantity: 3 } : l)),
          );
          if (checkout) expect(h.conv.state).toBe('awaiting_final_confirm');
          await h.sendQueued('no más');
          await h.sendQueued('contraentrega');
          await h.sendQueued('confirmar');
          expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
          const items = h.service.ordersService.create.mock.calls[0][0].items;
          expect(items).toHaveLength(5);
          expect(items.filter((i) => i.productId === 99501)).toHaveLength(3);
          expect(
            items
              .filter((i) => i.productId !== 99503)
              .every(
                (i) =>
                  i.note === 'sin ensalada' &&
                  i.attributes.some((a) => a.attributeValue === 'Pepsi'),
              ),
          ).toBe(true);
        });
for (const agent of [false, true])
  for (const prior of [false, true])
    for (const text of ['cancelo', 'cancela el pedido', 'cancelo con 50000'])
      it(`pending split cancellation ${agent}/${prior}/${text}`, async () => {
        const h = harness(undefined, agent);
        h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
        await h.sendQueued(
          'Por favor 4 ejecutivos\n3 ejecutivos con frito\n1 broster\nPierna pernil todos\n3 ajiacos\n1 menudencias',
        );
        expect(h.conv.sessionData.pendingCountedHeaderOrder).toBeTruthy();
        const registered = {
          id: 900371,
          dailyOrderNumber: 88,
          orderStatus: 'preparing',
        };
        h.service.ordersService.findTodayOrdersByPhone = jest
          .fn()
          .mockResolvedValue(prior ? [registered] : []);
        h.service.ordersService.create = jest.fn();
        await h.sendQueued(text);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
        expect(registered.orderStatus).toBe('preparing');
        expect(h.conv.sessionData.cart).toEqual([]);
        if (text === 'cancelo con 50000')
          expect(h.conv.sessionData.pendingCountedHeaderOrder).toBeTruthy();
        else {
          expect(h.conv.sessionData.pendingCountedHeaderOrder).toBeFalsy();
          expect(h.replies.at(-1)).toMatch(/descart|cancel|vaci/i);
        }
      });
