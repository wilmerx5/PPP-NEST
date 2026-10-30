import { harness } from './whatsapp-accuracy.test-support';

// Synthetic multi-dish continuations of the user-shared condiment requests.
for (const names of [
  ['Arroz Con Pollo', 'Churrasco'],
  ['Bowl Vegetal', 'Pasta De Hongos'],
])
  for (const agent of [false, true])
    for (const scenario of ['first', 'second', 'general', 'sold']) {
      it(`${names[0]} ${scenario}, agent mock=${agent}`, async () => {
        const menu = names.map((name, i) => ({
          id: 94301 + i,
          code: 1 + i,
          name,
          price: 18000 + i * 2000,
          availableNow: true,
          hasAttributes: false,
          attributes: [],
        }));
        if (scenario === 'sold')
          menu.push({
            id: 94303,
            code: 3,
            name: 'Ají Casero',
            price: 2000,
            availableNow: true,
            hasAttributes: false,
            attributes: [],
          });
        const h = harness(menu, agent);
        h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
        h.service.aiService.generateTurn = jest
          .fn()
          .mockResolvedValue({ reply: '¿Cuál prefieres?', actions: {} });
        h.service.ordersService.create = jest
          .fn()
          .mockResolvedValue({ id: 319, dailyOrderNumber: 319 });
        h.service.ordersService.findTodayOrdersByPhone = jest
          .fn()
          .mockResolvedValue([]);
        await h.sendQueued(`Un ${names[0]}`);
        await h.sendQueued(`Un ${names[1]}`);
        expect(
          h.conv.sessionData.cart.map((x) => [x.productId, x.quantity]),
        ).toEqual([
          [94301, 1],
          [94302, 1],
        ]);
        const before = structuredClone(h.conv.sessionData.cart);
        const text =
          scenario === 'first'
            ? 'a la primera ponle como nota sobres de mostaza aparte'
            : scenario === 'second'
              ? 'a la segunda ponle como nota sobres de mostaza aparte'
              : 'Y dos ajíes me puedes enviar porfi';
        const reply = await h.sendQueued(text);
        if (scenario === 'first' || scenario === 'second') {
          const target = scenario === 'first' ? 0 : 1;
          expect(h.conv.sessionData.cart[target].note).toContain(
            'sobres de mostaza',
          );
          expect(h.conv.sessionData.cart[1 - target]).toEqual(
            before[1 - target],
          );
          expect(reply).toMatch(/mostaza/i);
        } else {
          expect(h.conv.sessionData.cart).toEqual(before);
          if (scenario === 'general')
            expect(h.conv.sessionData.customerNotes).toMatch(/dos ajíes/i);
          else {
            expect(h.conv.sessionData.customerNotes).toBeFalsy();
            expect(reply).toMatch(/igual/i);
          }
        }
        const after = structuredClone(h.conv.sessionData.cart);
        const orderNote = h.conv.sessionData.customerNotes;
        await h.sendQueued(text);
        expect(h.conv.sessionData.cart).toEqual(after);
        expect(h.conv.sessionData.customerNotes).toBe(orderNote);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
        if (scenario === 'sold') {
          await h.sendQueued('Dos Ají Casero');
          expect(
            h.conv.sessionData.cart.map((x) => [x.productId, x.quantity]),
          ).toEqual([
            [94301, 1],
            [94302, 1],
            [94303, 2],
          ]);
        }
        await h.sendQueued('Solo eso porfa');
        await h.sendQueued('Contraentrega');
        expect(h.conv.state).toBe('awaiting_final_confirm');
        const receipt = await h.sendQueued('Confirmo');
        expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
        const dto = h.service.ordersService.create.mock.calls[0][0];
        expect(dto.items.map((x) => x.productId)).toEqual(
          scenario === 'sold' ? [94301, 94302, 94303, 94303] : [94301, 94302],
        );
        expect(receipt).toContain(scenario === 'sold' ? '42.000' : '38.000');
        if (scenario === 'first' || scenario === 'second') {
          const target = scenario === 'first' ? 0 : 1;
          expect(dto.items[target].note).toContain('sobres de mostaza');
          expect(dto.items[1 - target].note || '').not.toContain('mostaza');
          expect(receipt).toMatch(/mostaza/i);
        } else if (scenario === 'general') {
          expect(dto.address).toMatch(/dos ajíes/i);
          expect(receipt).toMatch(/dos ajíes/i);
        } else {
          expect(dto.address).not.toMatch(/ají/i);
          expect(receipt).toMatch(/Ají Casero/i);
        }
        expect(h.conv.state).toBe('completed');
      });
    }
