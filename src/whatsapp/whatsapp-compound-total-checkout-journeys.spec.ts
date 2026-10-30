import { harness } from './whatsapp-accuracy.test-support';

// Synthetic continuations of the real total-as-address incident; no external services.
for (const dish of ['Arroz Con Pollo', 'Bowl Vegetal'])
  for (const agent of [false, true])
    for (const payment of ['Contraentrega', 'Por nequi'])
      for (const question of [
        'no mas, cuanto es todo lo que pedi',
        'solo eso veci, cuanto vale todo lo que he pedido',
        'no mas cuanto cuesta todo lo que llevo',
      ]) {
        it(`${dish}: ${question}; ${payment}; agent mock=${agent}`, async () => {
          const h = harness([
            { id: 94801, code: 1, name: dish, price: 18000, availableNow: true, attributes: [] },
          ], agent);
          h.conv.customerName = '';
          Object.assign(h.conv.sessionData, { orderType: 'delivery', fulfillmentChosen: true });
          h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
          h.service.aiService.generateTurn = jest.fn().mockResolvedValue({ reply: '¿Cuál prefieres?', actions: {} });
          h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 324, dailyOrderNumber: 324 });
          h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
          h.cfg.localContext = { transferInfoNote: 'Nequi de pruebas 3000000008' };

          await h.sendQueued(`Dos ${dish}`);
          const cart = structuredClone(h.conv.sessionData.cart);
          expect(cart).toEqual([expect.objectContaining({ productId: 94801, quantity: 2 })]);
          const close = await h.sendQueued(question);
          expect(close).toContain('36.000');
          expect(h.conv.state).toBe('awaiting_name');
          await h.sendQueued('Camila Rojas');
          expect(h.conv.state).toBe('awaiting_address');
          const atAddress = await h.sendQueued(question);
          expect(atAddress).toContain('36.000');
          expect(atAddress).toMatch(/direcci[oó]n/i);
          expect(h.conv.sessionData.address).toBeFalsy();
          expect(h.conv.state).toBe('awaiting_address');
          expect(h.conv.sessionData.cart).toEqual(cart);
          await h.sendQueued('Calle 10 #20-30');
          expect(h.conv.state).toBe('awaiting_payment');
          const address = h.conv.sessionData.address;
          const atPayment = await h.sendQueued(question);
          expect(atPayment).toContain('38.000');
          expect(atPayment).toMatch(/paga|pago/i);
          expect(h.conv.state).toBe('awaiting_payment');
          await h.sendQueued(payment);
          expect(h.conv.state).toBe('awaiting_final_confirm');
          const review = await h.sendQueued(question);
          expect(review).toContain('38.000');
          expect(review).toMatch(/confirmar/i);
          expect(h.conv.state).toBe('awaiting_final_confirm');
          expect(h.conv.sessionData.address).toBe(address);
          expect(h.conv.sessionData.cart).toEqual(cart);
          expect(h.service.ordersService.create).not.toHaveBeenCalled();
          const receipt = await h.sendQueued('Confirmo');
          expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
          const dto = h.service.ordersService.create.mock.calls[0][0];
          expect(dto.items).toHaveLength(2);
          expect(dto.items.every((item) => item.productId === 94801)).toBe(true);
          expect(dto.customerName).toBe('Camila Rojas');
          expect(dto.address).toContain('20-30');
          expect(receipt).toContain('38.000');
          expect(receipt).toContain(dish);
          expect(h.conv.state).toBe('completed');
          await h.sendQueued('Confirmo');
          expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
        });
      }
