import { harness } from './whatsapp-accuracy.test-support';

// Synthetic full journeys expanding the reported multi-dish kitchen-note patterns.
for (const names of [
  ['Hamburguesa Clasica', 'Hamburguesa Doble'],
  ['Taco Pastor', 'Taco Pollo'],
])
  for (const agent of [false, true])
    for (const scenario of [
      'ambos',
      'para ambos',
      'ambas',
      'las dos',
      'select-second',
      'cancel',
      'premature-confirm',
      'too-many',
    ]) {
      it(`${names[0]} ${scenario}, agent mock=${agent}`, async () => {
        const h = harness(
          names.map((name, i) => ({
            id: 94401 + i,
            code: i + 1,
            name,
            price: 18000 + i * 2000,
            availableNow: true,
            hasAttributes: false,
            attributes: [],
          })),
          agent,
        );
        h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
        h.service.aiService.generateTurn = jest
          .fn()
          .mockResolvedValue({ reply: '¿Cuál prefieres?', actions: {} });
        h.service.ordersService.create = jest
          .fn()
          .mockResolvedValue({ id: 320, dailyOrderNumber: 320 });
        h.service.ordersService.findTodayOrdersByPhone = jest
          .fn()
          .mockResolvedValue([]);
        await h.sendQueued(`Una ${names[0]} y una ${names[1]}`);
        const before = structuredClone(h.conv.sessionData.cart);
        expect(before.map((x) => [x.productId, x.quantity])).toEqual([
          [94401, 1],
          [94402, 1],
        ]);
        let noted = [false, true];
        if (['ambos', 'para ambos', 'ambas', 'las dos'].includes(scenario)) {
          await h.sendQueued(`${scenario} sin cebolla`);
          noted = [true, true];
        } else {
          const reply = await h.sendQueued(
            scenario === 'too-many' ? 'tres sin cebolla' : 'una sin cebolla',
          );
          expect(h.conv.sessionData.cart).toEqual(before);
          expect(reply).toMatch(
            scenario === 'too-many' ? /2 unidades/ : /1\..*|cu[aá]l/i,
          );
          if (scenario === 'too-many') await h.sendQueued('una sin cebolla');
          if (scenario === 'premature-confirm') {
            await h.sendQueued('confirmar');
            expect(h.service.ordersService.create).not.toHaveBeenCalled();
            expect(h.conv.sessionData.cart).toEqual(before);
          }
          await h.sendQueued(
            scenario === 'cancel' ? 'no apliques esa nota' : '2',
          );
          if (scenario === 'cancel') noted = [false, false];
        }
        expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeFalsy();
        const cart = h.conv.sessionData.cart;
        expect(cart.map((x) => [x.productId, x.quantity, x.unitPrice])).toEqual(
          [
            [94401, 1, 18000],
            [94402, 1, 20000],
          ],
        );
        cart.forEach((x, i) =>
          expect(x.note || '').toBe(noted[i] ? 'sin cebolla' : ''),
        );
        const stable = structuredClone(cart);
        const total = await h.sendQueued('cuánto es el total');
        expect(total).toContain('38.000');
        expect(h.conv.sessionData.cart).toEqual(stable);
        await h.sendQueued('Solo eso porfa');
        await h.sendQueued('Contraentrega');
        expect(h.conv.state).toBe('awaiting_final_confirm');
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
        const receipt = await h.sendQueued('Confirmo');
        expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
        const dto = h.service.ordersService.create.mock.calls[0][0];
        expect(dto.items.map((x) => x.productId)).toEqual([94401, 94402]);
        dto.items.forEach((x, i) =>
          expect(x.note || '').toBe(noted[i] ? 'sin cebolla' : ''),
        );
        expect(receipt).toContain('38.000');
        if (noted.some(Boolean)) expect(receipt).toContain('sin cebolla');
        else expect(receipt).not.toContain('sin cebolla');
        expect(h.conv.state).toBe('completed');
      });
    }

for (const agent of [false, true])
  for (const text of [
    'ambos sin cebolla',
    'para ambos sin cebolla',
    'ambas sin cebolla',
  ]) {
    it(`three units require clarification: ${text}, agent mock=${agent}`, async () => {
      const h = harness(
        ['Plato Vegetal', 'Pasta De Hongos', 'Arroz Oriental'].map(
          (name, i) => ({
            id: 94501 + i,
            code: i + 1,
            name,
            price: 18000,
            availableNow: true,
            attributes: [],
          }),
        ),
        agent,
      );
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      for (const name of ['Plato Vegetal', 'Pasta De Hongos', 'Arroz Oriental'])
        await h.sendQueued(`Un ${name}`);
      const before = structuredClone(h.conv.sessionData.cart);
      const reply = await h.sendQueued(text);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.pendingSubsetKitchenNote).toMatchObject({
        quantity: 2,
        note: 'sin cebolla',
      });
      expect(reply).toMatch(/cu[aá]l|elige|indica/i);
    });
    it(`question does not apply: ${text}, agent mock=${agent}`, async () => {
      const h = harness(
        ['Plato Vegetal', 'Pasta De Hongos'].map((name, i) => ({
          id: 94501 + i,
          code: i + 1,
          name,
          price: 18000,
          availableNow: true,
          attributes: [],
        })),
        agent,
      );
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      await h.sendQueued('Un Plato Vegetal');
      await h.sendQueued('Un Pasta De Hongos');
      const before = structuredClone(h.conv.sessionData.cart);
      await h.sendQueued(`¿${text}?`);
      expect(h.conv.sessionData.cart).toEqual(before);
    });
  }
