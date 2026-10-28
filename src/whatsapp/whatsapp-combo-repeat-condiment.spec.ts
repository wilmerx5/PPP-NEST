import { harness } from './whatsapp-accuracy.test-support';
const menus = [
  {
    name: 'Combo De Pollo Frito',
    from: 'papa salada',
    said: 'papá salda',
    to: 'yuca',
  },
  {
    name: 'Combo De Pizza Vegetal',
    from: 'pan de ajo',
    said: 'pan de ajo',
    to: 'ensalada',
  },
  { name: 'Combo De Ramen Miso', from: 'arroz', said: 'arroz', to: 'fideos' },
];
for (const m of menus)
  for (const agent of [false, true])
    it(`${m.name}/${agent}: condiment and differently worded repeat keep previous options through DTO`, async () => {
      const menu = [
        {
          id: 9801,
          code: 81,
          name: m.name,
          price: 30000,
          description: `Acompañado con ${m.from} y bebida.`,
          availableNow: true,
          hasAttributes: true,
          attributes: [
            { attributeName: 'Bebida', options: ['Colombiana', 'Pepsi'] },
          ],
        },
        {
          id: 9802,
          code: 82,
          name: `Porción De ${m.to}`,
          price: 5000,
          availableNow: true,
          hasAttributes: false,
          attributes: [],
        },
      ];
      const h = harness(menu, agent);
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      h.service.ordersService.findTodayOrdersByPhone = jest
        .fn()
        .mockResolvedValue([]);
      h.service.ordersService.create = jest
        .fn()
        .mockResolvedValue({ id: 999, dailyOrderNumber: 99 });
      Object.assign(h.conv.sessionData, {
        phoneConfirmed: true,
        contactPhone: h.conv.phoneE164,
        notesCollected: true,
      });
      await h.sendQueued(`Me regalas un ${m.name} con Pepsi`);
      await h.sendQueued('Con que viene el\nCombo\n?');
      await h.sendQueued(
        `no, el combo que ya te pedi, lo quiero con en vez de ${m.said} me regalas ${m.to}`,
      );
      const changed = structuredClone(h.conv.sessionData.cart);
      expect(changed).toHaveLength(1);
      expect(changed[0].note).toContain(m.to);
      await h.sendQueued('Y dos ajíes me puedes enviar porfi');
      const seasoned = structuredClone(h.conv.sessionData.cart);
      expect(seasoned).toHaveLength(1);
      expect(seasoned[0].note).toMatch(/dos aj[ií]es/i);
      expect(seasoned[0].note).toContain(m.to);
      await h.sendQueued(
        `tambienlo quiero lo quiero con en vez de ${m.said} me regalas ${m.to}`,
      );
      expect(h.conv.sessionData.cart).toEqual(seasoned);
      expect(h.replies.at(-1)).not.toMatch(
        /no entend|no pude|cu[aá]l prefieres/i,
      );
      expect(h.conv.sessionData.cart[0].attributes).toContainEqual({
        attributeName: 'Bebida',
        attributeValue: 'Pepsi',
      });
      await h.sendQueued('contraentrega');
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      await h.sendQueued('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const dto = h.service.ordersService.create.mock.calls[0][0];
      expect(dto.items).toHaveLength(1);
      expect(dto.items[0]).toMatchObject({
        productId: 9801,
        note: seasoned[0].note,
        attributes: seasoned[0].attributes,
      });
    });

for (const m of menus)
  for (const agent of [false, true])
    for (const fault of [
      'repeat',
      'two-units',
      'two-lines',
      'payment',
      'selection',
      'long-note',
      'sold',
      'query',
      'ambiguous-repeat',
      'quantity-repeat',
      'unknown-repeat',
    ])
      it(`${m.name}/${agent}/${fault}: preserve ownership and pending work`, async () => {
        const product = {
          id: 9801,
          code: 81,
          name: m.name,
          price: 30000,
          description: `Acompañado con ${m.from} y bebida.`,
          availableNow: true,
          hasAttributes: true,
          attributes: [
            { attributeName: 'Bebida', options: ['Colombiana', 'Pepsi'] },
          ],
        };
        const menu: any[] = [product];
        if (fault === 'sold')
          menu.push({
            id: 9802,
            code: 82,
            name: 'Ají Casero',
            price: 2000,
            availableNow: true,
            hasAttributes: false,
            attributes: [],
          });
        const h = harness(menu, agent);
        h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
        h.conv.sessionData.cart = [
          {
            productId: 9801,
            code: 81,
            name: m.name,
            unitPrice: 30000,
            quantity: ['two-units', 'quantity-repeat'].includes(fault) ? 2 : 1,
            attributes: [{ attributeName: 'Bebida', attributeValue: 'Pepsi' }],
            note: fault === 'long-note' ? 'x'.repeat(195) : 'Sin cebolla',
          },
        ];
        if (['two-lines', 'ambiguous-repeat'].includes(fault))
          h.conv.sessionData.cart.push({
            ...h.conv.sessionData.cart[0],
            note: 'Sin sal',
          });
        if (fault === 'payment') {
          h.conv.state = 'awaiting_mp_payment';
          h.conv.sessionData.mpPreferenceId = 'synthetic';
        }
        if (fault === 'selection')
          h.conv.sessionData.pendingAttribute = { productId: 9801 } as never;
        const before = structuredClone(h.conv.sessionData);
        if (fault.endsWith('repeat') && fault !== 'repeat') {
          await h.sendQueued(
            `tambienlo quiero lo quiero con en vez de ${fault === 'unknown-repeat' ? 'ingrediente inexistente' : m.said} me regalas ${m.to}`,
          );
          expect(h.conv.sessionData).toEqual(before);
          expect(h.replies.at(-1)).toMatch(/igual/i);
          return;
        }
        await h.sendQueued(
          fault === 'query'
            ? '¿Y dos ajíes me puedes enviar porfi?'
            : 'Y dos ajíes me puedes enviar porfi',
        );
        if (fault === 'repeat') {
          const after = structuredClone(h.conv.sessionData);
          expect(after.cart[0].note).toMatch(/dos ajíes/i);
          await h.sendQueued('Y dos ajíes me puedes enviar porfi');
          expect(h.conv.sessionData).toEqual(after);
        } else if (['two-units', 'two-lines'].includes(fault)) {
          expect(h.conv.sessionData.cart).toEqual(before.cart);
          expect(h.conv.sessionData.customerNotes).toMatch(/dos ajíes/i);
          const after = structuredClone(h.conv.sessionData);
          await h.sendQueued('Y dos ajíes me puedes enviar porfi');
          expect(h.conv.sessionData).toEqual(after);
        } else {
          expect(h.conv.sessionData.cart).toEqual(before.cart);
          expect(h.conv.sessionData.customerNotes).toBe(before.customerNotes);
          if (fault !== 'query') expect(h.replies.at(-1)).toMatch(/igual/i);
        }
      });

for (const request of ['tres servilletas', '2 sobres de mostaza'])
  for (const agent of [false, true])
    for (const state of ['building_cart', 'awaiting_final_confirm'])
      it(`${request}/${agent}/${state}: supply request retains checkout and prior note`, async () => {
        const h = harness(
          [
            {
              id: 9801,
              code: 81,
              name: 'Plato Vegetal',
              price: 10000,
              availableNow: true,
              hasAttributes: false,
              attributes: [],
            },
          ],
          agent,
        );
        h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
        h.service.ordersService.create = jest.fn();
        h.conv.state = state;
        h.conv.sessionData.cart = [
          {
            productId: 9801,
            code: 81,
            name: 'Plato Vegetal',
            unitPrice: 10000,
            quantity: 1,
            note: 'Sin cebolla',
          },
        ];
        await h.sendQueued(`Y ${request} me puedes enviar por favor`);
        expect(h.conv.state).toBe(state);
        expect(h.conv.sessionData.cart).toHaveLength(1);
        expect(h.conv.sessionData.cart[0].note).toContain(request);
        expect(h.conv.sessionData.cart[0].note).toContain('Sin cebolla');
        expect(h.replies.at(-1)).toContain(request);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
      });
