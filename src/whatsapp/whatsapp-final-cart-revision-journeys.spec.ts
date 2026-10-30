import { harness } from './whatsapp-accuracy.test-support';

// Known quantity/removal patterns, composed with final review and actual synthetic DTO.
for (const dish of ['Enchiladas De Frijol', 'Udon De Verduras'])
  for (const agent of [false, true])
    for (const payment of ['Contraentrega', 'Por nequi'])
      for (const edit of ['remove-one', 'set-two', 'remove-line']) {
        it(`${dish}: ${edit}; ${payment}; agent mock=${agent}`, async () => {
          const menu = [
            { id: 94901, code: 1, name: dish, price: 18000, availableNow: true, attributes: [] },
            { id: 94902, code: 2, name: 'Agua Mineral', price: 4000, availableNow: true, attributes: [] },
          ];
          const h = harness(menu, agent);
          Object.assign(h.conv.sessionData, { orderType: 'delivery', fulfillmentChosen: true });
          h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
          h.service.aiService.generateTurn = jest.fn().mockResolvedValue({ reply: '¿Cuál prefieres?', actions: {} });
          h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 325, dailyOrderNumber: 325 });
          h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
          h.cfg.localContext = { transferInfoNote: 'Nequi de pruebas 3000000008' };
          await h.sendQueued(`Tres ${dish}`);
          await h.sendQueued('a la primera ponle como nota sin cebolla');
          await h.sendQueued('Un Agua Mineral');
          await h.sendQueued('Solo eso porfa');
          await h.sendQueued('Calle 10 #20-30');
          const review = await h.sendQueued(payment);
          expect(review).toContain('60.000');
          expect(h.conv.state).toBe('awaiting_final_confirm');
          const before = structuredClone(h.conv.sessionData);
          const quantity = edit === 'remove-line' ? 0 : 2;
          const total = quantity ? '42.000' : '6.000';
          const request = edit === 'remove-one' ? `Quita una de las ${dish} y dime cuánto queda`
            : edit === 'set-two' ? `Deja solo dos ${dish} y cuánto vale todo?`
            : `Quita las ${dish}; dime el total por favor`;
          const changed = await h.sendQueued(request);
          expect(changed).toContain(total);
          expect(changed).not.toContain('60.000');
          expect(changed).toMatch(/confirmar/i);
          expect(h.conv.state).toBe('awaiting_final_confirm');
          expect(h.conv.sessionData.address).toBe(before.address);
          expect(h.conv.sessionData.paymentMethod).toBe(before.paymentMethod);
          expect(h.conv.sessionData.cart.find((line) => line.productId === 94902)).toEqual(before.cart[1]);
          const line = h.conv.sessionData.cart.find((row) => row.productId === 94901);
          if (quantity) expect(line).toMatchObject({ quantity, note: 'sin cebolla' });
          else expect(line).toBeUndefined();
          expect(h.service.ordersService.create).not.toHaveBeenCalled();
          const stable = structuredClone(h.conv.sessionData.cart);
          const totalReply = await h.sendQueued('no mas, cuanto es todo lo que pedi');
          expect(totalReply).toContain(total);
          expect(h.conv.sessionData.cart).toEqual(stable);
          expect(h.service.ordersService.create).not.toHaveBeenCalled();
          const receipt = await h.sendQueued('Confirmo');
          expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
          const dto = h.service.ordersService.create.mock.calls[0][0];
          expect(dto.items).toHaveLength(quantity + 1);
          expect(dto.items.filter((item) => item.productId === 94901)).toHaveLength(quantity);
          expect(dto.items.filter((item) => item.productId === 94901).every((item) => item.note === 'sin cebolla')).toBe(true);
          expect(dto.items.filter((item) => item.productId === 94902)).toHaveLength(1);
          expect(dto.address).toContain('20-30');
          expect(receipt).toContain(total);
          expect(receipt).not.toContain('60.000');
          expect(h.conv.state).toBe('completed');
          await h.sendQueued('Confirmo');
          expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
        });
      }
