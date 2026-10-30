import { harness } from './whatsapp-accuracy.test-support';

// Text derived from the user-shared audio transcript, not an audio transcription test.
for (const side of ['Porcion De Papa Francesa', 'Porcion De Yuca'])
  for (const agent of [false, true])
    for (const scenario of [
      'inline',
      'separate',
      'partial-repair',
      'contact',
      'replace-before-confirm',
      'correction-after-confirm',
    ]) {
      it(`${side}: ${scenario}, agent mock=${agent}`, async () => {
        const h = harness(
          [
            {
              id: 94201,
              code: 1,
              name: '1 Pollo Frito',
              price: 44000,
              availableNow: true,
              hasAttributes: false,
              attributes: [],
            },
            {
              id: 94202,
              code: 2,
              name: side,
              price: 8000,
              availableNow: true,
              hasAttributes: false,
              attributes: [],
            },
          ],
          agent,
        );
        h.conv.customerName = 'Camila Rojas';
        Object.assign(h.conv.sessionData, {
          orderType: 'delivery',
          fulfillmentChosen: true,
          phoneConfirmed: true,
          contactPhone: h.conv.phoneE164,
          notesCollected: true,
        });
        Object.assign(h.cfg, {
          deliveryFeeMode: 'distance',
          restaurantLat: 4.63,
          restaurantLng: -74.15,
        });
        h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
        h.service.aiService.generateTurn = jest
          .fn()
          .mockResolvedValue({ reply: '¿Cuál prefieres?', actions: {} });
        h.service.ordersService.create = jest
          .fn()
          .mockResolvedValue({ id: 318, dailyOrderNumber: 318 });
        h.service.ordersService.findTodayOrdersByPhone = jest
          .fn()
          .mockResolvedValue([]);
        h.service.conversationService.reopenForNewOrder = jest.fn();
        h.service.deliveryRouting = {
          quoteDeliveryFee: jest.fn(
            async ({ customerAddress }: { customerAddress: string }) => ({
              ok: true,
              fee: customerAddress.includes('34B') ? 6000 : 2000,
              distanceKm: customerAddress.includes('34B') ? 4 : 1,
              source: 'google_directions',
              customer: { lat: 4.63, lng: -74.15 },
            }),
          ),
        };
        await h.sendQueued(
          'Hola, buenas tardes, quisiera pedir un pollo frito, por favor.',
        );
        const dictated = 'calle 7B de Bogotá, número 78C de casa 79';
        if (scenario === 'inline' || scenario === 'correction-after-confirm') {
          await h.sendQueued(
            `Con una ${side}, por favor, para la ${dictated}.`,
          );
        } else {
          await h.sendQueued(`Una ${side}`);
          await h.sendQueued('No señor');
          if (scenario === 'partial-repair') {
            await h.sendQueued('Calle 7B de Bogotá');
            await h.sendQueued('contraentrega');
            await h.sendQueued('confirmo');
            expect(h.service.ordersService.create).not.toHaveBeenCalled();
            expect(h.conv.state).not.toBe('completed');
          }
          await h.sendQueued(
            scenario === 'contact'
              ? `${dictated}, mi teléfono 3001234567`
              : dictated,
          );
        }
        const expectedCart = [
          [94201, 1],
          [94202, 1],
        ];
        expect(
          h.conv.sessionData.cart.map((x) => [x.productId, x.quantity]),
        ).toEqual(expectedCart);
        expect(h.conv.sessionData.cart.every((x) => !x.note)).toBe(true);
        expect(h.conv.sessionData.address).toMatch(/7B.*78C-79/i);
        expect(h.conv.sessionData.address).not.toContain('3001234567');
        expect(h.conv.sessionData.deliveryFeeCalculated).toBe(2000);
        const before = structuredClone(h.conv.sessionData.cart);
        await h.sendQueued('contraentrega');
        expect(h.conv.state).toBe('awaiting_final_confirm');
        let fee = 2000;
        if (scenario === 'replace-before-confirm') {
          await h.sendQueued('Cambiar dirección a Carrera 12A #34B-56');
          expect(h.conv.sessionData.address).toMatch(/12A.*34B-56/i);
          expect(h.conv.sessionData.deliveryFeeCalculated).toBe(6000);
          fee = 6000;
          await h.sendQueued('contraentrega');
        }
        expect(h.conv.sessionData.cart).toEqual(before);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
        const receipt = await h.sendQueued('Confirmo');
        expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
        const dto = h.service.ordersService.create.mock.calls[0][0];
        expect(dto.address).toMatch(
          fee === 6000 ? /12A.*34B-56/i : /7B.*78C-79/i,
        );
        expect(dto.address).not.toContain('3001234567');
        expect(dto.deliveryFee).toBe(fee);
        expect(dto.items.map((x) => x.productId)).toEqual([94201, 94202]);
        expect(receipt).toContain(side);
        expect(receipt).toContain(fee === 6000 ? '58.000' : '54.000');
        expect(h.conv.state).toBe('completed');
        if (scenario === 'correction-after-confirm') {
          h.service.ordersService.findTodayOrdersByPhone.mockResolvedValue([
            { id: 318, dailyOrderNumber: 318, orderStatus: 'cooking' },
          ]);
          const session = structuredClone(h.conv.sessionData);
          const reply = await h.sendQueued(
            'Corrige la dirección a Carrera 12A #34B-56',
          );
          expect(reply).toMatch(/no.*(?:modifi|aplic|actualiz|cambi)/i);
          expect(reply).not.toMatch(/qué se te antoja|s[ií], llegamos/i);
          expect(h.conv.sessionData).toEqual(session);
          expect(
            h.service.conversationService.reopenForNewOrder,
          ).not.toHaveBeenCalled();
          expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
          expect(h.conv.state).toBe('completed');
        }
      });
    }
