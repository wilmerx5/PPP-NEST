import { harness } from './whatsapp-accuracy.test-support';

// Derived from the returning-customer combo/Ginger/fried-arepas transcript.
// Saved profile and address are fixture data; this does not exercise profile persistence across days.
for (const dish of ['Combo De Pollo Frito', 'Combo Vegetal'])
  for (const agent of [false, true])
    for (const payment of ['contraentrega', 'Por nequi'])
      for (const scenario of [
        'same',
        'typo-reuse',
        'new',
        'inquiry-before-reuse',
        'coverage-recovery',
        'new-then-return',
      ]) {
        it(`${dish} ${scenario} ${payment}, agent mock=${agent}`, async () => {
          const h = harness(
            [
              {
                id: 94180,
                code: 180,
                name: dish,
                price: 53000,
                availableNow: true,
                hasAttributes: true,
                attributes: [
                  {
                    attributeName: 'Bebida',
                    options: ['Colombiana', 'Ginger'],
                  },
                  { attributeName: 'Arepas', options: ['Blancas', 'Fritas'] },
                ],
              },
            ],
            agent,
          );
          h.conv.customerName = 'Camila Rojas';
          const saved = 'Calle 10 #81A-20 torre B apto 304B';
          const replacement = 'Carrera 22 #45-60';
          Object.assign(h.conv.sessionData, {
            orderType: 'delivery',
            fulfillmentChosen: true,
            lastDeliveryAddress: saved,
          });
          Object.assign(h.cfg, {
            deliveryFeeMode: 'distance',
            restaurantLat: 4.63,
            restaurantLng: -74.15,
          });
          h.cfg.localContext = {
            transferInfoNote: 'Nequi de pruebas 3000000008',
          };
          h.service.aiService.classifyMessage = jest
            .fn()
            .mockResolvedValue(null);
          h.service.aiService.generateTurn = jest
            .fn()
            .mockResolvedValue({ reply: '¿Cuál prefieres?', actions: {} });
          h.service.ordersService.create = jest
            .fn()
            .mockResolvedValue({ id: 317, dailyOrderNumber: 317 });
          h.service.ordersService.findTodayOrdersByPhone = jest
            .fn()
            .mockResolvedValue([]);
          h.service.deliveryRouting = {
            quoteDeliveryFee: jest.fn(
              async ({ customerAddress }: { customerAddress: string }) =>
                customerAddress.includes('90-99')
                  ? {
                      ok: false,
                      reason: 'out_of_coverage',
                      message: 'Fuera de cobertura.',
                      distanceKm: 12,
                    }
                  : {
                      ok: true,
                      fee: customerAddress.includes('45-60') ? 6000 : 2000,
                      distanceKm: customerAddress.includes('45-60') ? 4 : 1,
                      source: 'google_directions',
                      customer: { lat: 4.63, lng: -74.15 },
                    },
            ),
          };
          expect(h.conv.sessionData.cart).toEqual([]);
          await h.sendQueued('Buenas tardes');
          await h.sendQueued(`Un ${dish}`);
          expect(h.conv.sessionData.cart).toHaveLength(1);
          const changed = await h.sendQueued('Bebida ginger y arepas fritas');
          expect(changed).not.toMatch(/para cu[aá]l/i);
          const expectedAttributes = [
            { attributeName: 'Bebida', attributeValue: 'Ginger' },
            { attributeName: 'Arepas', attributeValue: 'Fritas' },
          ];
          expect(h.conv.sessionData.cart[0]).toMatchObject({
            productId: 94180,
            quantity: 1,
            unitPrice: 53000,
            attributes: expect.arrayContaining(expectedAttributes),
          });
          const before = structuredClone(h.conv.sessionData.cart);
          const next = await h.sendQueued('No señor');
          expect(next).toMatch(/misma.*direcci[oó]n|direcci[oó]n.*misma/i);
          expect(h.conv.state).toBe('awaiting_address');
          expect(h.service.ordersService.create).not.toHaveBeenCalled();
          let expectedAddress = saved,
            fee = 2000;
          if (scenario === 'inquiry-before-reuse') {
            const info = await h.sendQueued('Me indicas el nequi');
            expect(info).toContain('3000000008');
            expect(h.conv.state).toBe('awaiting_address');
            expect(h.conv.sessionData.addressConfirmed).not.toBe(true);
          }
          if (
            scenario === 'new' ||
            scenario === 'coverage-recovery' ||
            scenario === 'new-then-return'
          ) {
            await h.sendQueued('a una nueva');
            expect(h.conv.sessionData.addressConfirmed).not.toBe(true);
            await h.sendQueued('confirmar');
            expect(h.service.ordersService.create).not.toHaveBeenCalled();
            if (scenario === 'new-then-return')
              await h.sendQueued('Mejor a la misma de antes');
            else {
              if (scenario === 'coverage-recovery') {
                const outside = await h.sendQueued('Calle 90 #90-99');
                expect(outside).toMatch(/fuera de cobertura/i);
                expect(h.conv.sessionData.deliveryOutOfCoverage).toBe(true);
                await h.sendQueued('confirmar');
                expect(h.service.ordersService.create).not.toHaveBeenCalled();
              }
              await h.sendQueued(replacement);
              expectedAddress = replacement;
              fee = 6000;
            }
          } else
            await h.sendQueued(
              scenario === 'typo-reuse'
                ? 'Si a la misma direction'
                : 'Si esa misma dirección',
            );
          expect(h.conv.sessionData.cart).toEqual(before);
          expect(h.conv.sessionData.address).toBe(expectedAddress);
          expect(h.conv.sessionData.deliveryFeeCalculated).toBe(fee);
          expect(h.conv.sessionData.deliveryOutOfCoverage).not.toBe(true);
          const review = await h.sendQueued(payment);
          expect(review).toMatch(/confirmar/i);
          expect(review).toMatch(/Ginger/);
          expect(review).toMatch(/Fritas/);
          expect(h.conv.state).toBe('awaiting_final_confirm');
          expect(h.service.ordersService.create).not.toHaveBeenCalled();
          const receipt = await h.sendQueued('Confirmo');
          expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
          const dto = h.service.ordersService.create.mock.calls[0][0];
          expect(dto.customerName).toBe('Camila Rojas');
          expect(dto.address).toBe(
            `${expectedAddress} / ${payment === 'contraentrega' ? 'Contraentrega' : 'Transferencia'}`,
          );
          expect(dto.deliveryFee).toBe(fee);
          expect(dto.items).toHaveLength(1);
          expect(dto.items[0]).toMatchObject({
            productId: 94180,
            attributes: expect.arrayContaining(expectedAttributes),
          });
          expect(receipt).toContain(dish);
          expect(receipt).toMatch(/Ginger/);
          expect(receipt).toMatch(/Fritas/);
          expect(receipt).toContain(fee === 2000 ? '55.000' : '59.000');
          if (expectedAddress === replacement) {
            expect(dto.address).not.toContain('304B');
            expect(receipt).not.toContain('304B');
          }
          expect(h.conv.state).toBe('completed');
        });
      }
