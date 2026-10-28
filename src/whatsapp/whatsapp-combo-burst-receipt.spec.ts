import { harness } from './whatsapp-accuracy.test-support';

for (const food of ['Pollo', 'Pescado', 'Tofu'])
  for (const agent of [false, true])
    for (const mode of ['burst', 'separate'])
      it(`${food}/${agent}/${mode}: initial combo follow-up and notes reach the customer receipt`, async () => {
        const meal = (id: number, combo: boolean, style: string) => ({
          id,
          code: id,
          name: `${combo ? 'Combo De ' : ''}${food} ${style}`,
          price: combo ? 30000 : 20000,
          description: 'Con papa salada y bebida',
          availableNow: true,
          hasAttributes: combo,
          attributes: combo
            ? [{ attributeName: 'Bebida', options: ['Colombiana', 'Pepsi'] }]
            : [],
        });
        const h = harness(
          [
            meal(9801, true, 'Frito'),
            meal(9802, true, 'Broaster'),
            meal(9803, false, 'Frito'),
          ],
          agent,
        );
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
        const messages = [
          `Me regalas por favor un ${food.toLowerCase()} frito`,
          'en combo',
        ];
        if (mode === 'burst') {
          jest.useFakeTimers();
          try {
            const pending = messages.map((text, i) =>
              h.service.handleIncoming({
                waId: 'customer',
                phoneE164: h.conv.phoneE164,
                messageId: `burst-${i}`,
                messageType: 'text',
                text,
                timestamp: Date.now() / 1000,
                raw: {},
              }),
            );
            await jest.advanceTimersByTimeAsync(4000);
            await Promise.all(pending);
          } finally {
            jest.useRealTimers();
          }
        } else for (const text of messages) await h.sendQueued(text);
        if (mode === 'burst')
          expect(
            h.conv.sessionData.cart.map((row) => [row.productId, row.quantity]),
          ).toEqual([[9801, 1]]);
        else {
          expect(h.conv.sessionData.pendingAttribute?.productId).toBe(9801);
          expect(h.conv.sessionData.cart.map((row) => row.productId)).toEqual([
            9803,
          ]);
        }
        await h.sendQueued('gaseosa pepsi');
        expect(
          h.conv.sessionData.cart.map((row) => [row.productId, row.quantity]),
        ).toEqual([[9801, 1]]);
        expect(h.conv.sessionData.cart[0].attributes).toContainEqual({
          attributeName: 'Bebida',
          attributeValue: 'Pepsi',
        });
        await h.sendQueued('Con que viene el\nCombo\n?');
        await h.sendQueued(
          'no, el combo que ya te pedi, lo quiero con en vez de papá salda me regalas yuca',
        );
        await h.sendQueued('Y dos ajíes me puedes enviar porfi');
        await h.sendQueued(
          'tambienlo quiero lo quiero con en vez de papá salda me regalas yuca',
        );
        const before = structuredClone(h.conv.sessionData.cart);
        expect(before).toHaveLength(1);
        expect(before[0].note).toMatch(/dos ajíes/);
        expect(before[0].note).toMatch(/Con yuca/);
        await h.sendQueued('contraentrega');
        await h.sendQueued('confirmar');
        expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
        const dto = h.service.ordersService.create.mock.calls[0][0];
        expect(dto.items).toEqual([
          {
            productId: 9801,
            note: before[0].note,
            attributes: before[0].attributes,
          },
        ]);
        const receipt = h.replies.at(-1);
        expect(receipt).toMatch(/pedido quedó registrado/);
        expect(receipt).toContain('Pepsi');
        expect(receipt).toContain(before[0].note);
      });

for (const scenario of [
  'line-note',
  'general-note',
  'different-notes',
  'identical-notes',
  'no-notes',
])
  it(`receipt/${scenario}: show notes with the correct scope and unchanged totals`, () => {
    const h = harness();
    const row = {
      productId: 9001,
      code: 1,
      name: 'Plato Vegetal',
      unitPrice: 10000,
      quantity: 1,
      attributes: [{ attributeName: 'Base', attributeValue: 'Arroz' }],
    };
    h.conv.sessionData.cart = [
      {
        ...row,
        ...(scenario === 'line-note' ||
        scenario === 'identical-notes' ||
        scenario === 'different-notes'
          ? { note: 'Sin cebolla' }
          : {}),
      },
    ];
    if (scenario === 'different-notes')
      h.conv.sessionData.cart.push({ ...row, note: 'Sin sal' });
    if (scenario === 'identical-notes')
      h.conv.sessionData.cart.push({ ...row, note: 'Sin cebolla' });
    if (scenario === 'general-note')
      h.conv.sessionData.customerNotes = 'Enviar dos servilletas';
    const before = structuredClone(h.conv.sessionData);
    const receipt = h.service.formatOrderSuccessMessage(
      h.conv,
      h.conv.sessionData,
      { dailyOrderNumber: 42 },
      0,
    );
    expect(h.conv.sessionData).toEqual(before);
    expect(receipt).toContain('Orden *#42*');
    expect(receipt).toContain('Arroz');
    expect(receipt).toContain(
      `*Total: $${scenario.includes('identical') || scenario.includes('different') ? '20.000' : '10.000'}*`,
    );
    if (scenario === 'no-notes')
      expect(receipt).not.toMatch(/📝|Notas del pedido/);
    if (
      scenario === 'line-note' ||
      scenario === 'identical-notes' ||
      scenario === 'different-notes'
    )
      expect(receipt.match(/Sin cebolla/g)).toHaveLength(1);
    if (scenario === 'different-notes') {
      expect(receipt).toMatch(/Sin cebolla[\s\S]+Plato Vegetal[\s\S]+Sin sal/);
    }
    if (scenario === 'identical-notes') expect(receipt).toContain('Cant: *2*');
    if (scenario === 'general-note')
      expect(receipt).toContain('Notas del pedido: Enviar dos servilletas');
  });

for (const agent of [false, true])
  for (const scenario of [
    'query',
    'quantity',
    'rows',
    'payment',
    'selection',
    'unknown',
    'standalone',
    'explicit-extra',
  ])
    it(`drink/${agent}/${scenario}: do not guess the owner or swallow an additional drink`, async () => {
      const menu = [
        {
          id: 9801,
          code: 81,
          name: 'Combo Vegetal',
          price: 30000,
          availableNow: true,
          hasAttributes: true,
          attributes: [
            { attributeName: 'Bebida', options: ['Colombiana', 'Pepsi'] },
          ],
        },
        {
          id: 9802,
          code: 82,
          name: 'Gaseosa 400ml',
          price: 4000,
          availableNow: true,
          hasAttributes: true,
          attributes: [
            { attributeName: 'Sabor', options: ['Colombiana', 'Pepsi'] },
          ],
        },
      ];
      const h = harness(menu, agent);
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      h.service.ordersService.create = jest.fn();
      if (scenario !== 'standalone')
        h.conv.sessionData.cart = [
          {
            productId: 9801,
            code: 81,
            name: 'Combo Vegetal',
            unitPrice: 30000,
            quantity: scenario === 'quantity' ? 2 : 1,
            attributes: [
              { attributeName: 'Bebida', attributeValue: 'Colombiana' },
            ],
            note: 'Sin sal',
          },
        ];
      if (scenario === 'rows')
        h.conv.sessionData.cart.push({
          ...h.conv.sessionData.cart[0],
          note: 'Sin cebolla',
        });
      if (scenario === 'payment') {
        h.conv.state = 'awaiting_mp_payment';
        h.conv.sessionData.mpPreferenceId = 'synthetic';
      }
      if (scenario === 'selection')
        h.conv.sessionData.pendingSubsetKitchenNote = {
          quantity: 1,
          note: 'Sin cebolla',
          productIds: [9801],
        };
      const before = structuredClone(h.conv.sessionData);
      await h.sendQueued(
        ['standalone', 'explicit-extra'].includes(scenario)
          ? 'quiero una gaseosa 400ml pepsi'
          : scenario === 'query'
            ? '¿gaseosa Pepsi?'
            : scenario === 'unknown'
              ? 'gaseosa sabor inexistente'
              : 'gaseosa Pepsi',
      );
      if (['standalone', 'explicit-extra'].includes(scenario)) {
        expect(
          h.conv.sessionData.cart.find((row) => row.productId === 9802),
        ).toMatchObject({
          quantity: 1,
          attributes: [{ attributeName: 'Sabor', attributeValue: 'Pepsi' }],
        });
        if (scenario === 'explicit-extra')
          expect(h.conv.sessionData.cart[0]).toEqual(before.cart[0]);
      } else {
        expect(h.conv.sessionData).toEqual(before);
        if (scenario === 'selection')
          expect(h.replies.at(-1)).toMatch(
            /Sin cebolla[\s\S]+Responde con los nombres/,
          );
        else expect(h.replies.at(-1)).toMatch(/igual|incluida/i);
      }
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });

for (const option of ['Agua De Panela', 'Te Con Limon'])
  for (const agent of [false, true])
    it(`${option}/${agent}: prepositions inside exact catalog drink names remain valid`, async () => {
      const h = harness(
        [
          {
            id: 9801,
            code: 81,
            name: 'Combo Vegetal',
            price: 30000,
            availableNow: true,
            hasAttributes: true,
            attributes: [
              { attributeName: 'Bebida', options: ['Colombiana', option] },
            ],
          },
        ],
        agent,
      );
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      h.conv.sessionData.cart = [
        {
          productId: 9801,
          code: 81,
          name: 'Combo Vegetal',
          unitPrice: 30000,
          quantity: 1,
          attributes: [
            { attributeName: 'Bebida', attributeValue: 'Colombiana' },
          ],
          note: 'Sin cebolla',
        },
      ];
      await h.sendQueued(`la bebida ${option.toLowerCase()}`);
      expect(h.conv.sessionData.cart).toHaveLength(1);
      expect(h.conv.sessionData.cart[0]).toMatchObject({
        quantity: 1,
        note: 'Sin cebolla',
        attributes: [{ attributeName: 'Bebida', attributeValue: option }],
      });
      expect(h.replies.at(-1)).toMatch(/cambié la bebida incluida/);
    });
