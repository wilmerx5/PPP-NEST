import { harness } from './whatsapp-accuracy.test-support';
import { DEFAULT_PAYMENT_METHODS } from './whatsapp-payment-methods';

// Complete conversations with mocked models, maps, transport and order creation.
// Each case asserts what the customer sees, session/cart and final order DTO.
describe('Checkout destination block — fragmented inputs and interruptions', () => {
  for (const name of ['Ravioles De Ricota', 'Bowl De Garbanzos']) {
    for (const enabled of [false, true]) {
      for (const scenario of ['fragments', 'new-after-edit', 'return-saved', 'pending-variant', 'coverage-recovery', 'address-and-note']) {
        it(`${name}: ${scenario}, agent=${enabled}`, async () => {
          const h = harness([
            { id: 82001, code: 82001, name, price: 21000, availableNow: true, attributes: [] },
            { id: 82002, code: 82002, name: 'Jugo De Fruta', price: 18000, availableNow: true,
              hasAttributes: true, attributes: [{ attributeName: 'Sabor', options: ['Mango', 'Lulo', 'Mora'] }] },
          ], enabled);
          Object.assign(h.cfg, { deliveryFeeMode: 'route_tiers', restaurantLat: 4.62, restaurantLng: -74.15 });
          h.cfg.paymentMethods = DEFAULT_PAYMENT_METHODS.map(p => ({ ...p, enabled: p.flow !== 'mercadopago' }));
          const oldAddress = 'Calle 10 #81A-20 torre B apto 304B';
          Object.assign(h.conv.sessionData, {
            orderType: 'delivery', fulfillmentChosen: true, notesCollected: true,
            phoneConfirmed: true, contactPhone: h.conv.phoneE164, lastDeliveryAddress: oldAddress,
          });
          h.service.deliveryRouting = { quoteDeliveryFee: jest.fn().mockImplementation(async ({ customerAddress }: any) =>
            customerAddress.includes('90-99')
              ? { ok: false, reason: 'out_of_coverage', message: 'Fuera de cobertura.', distanceKm: 12 }
              : { ok: true, fee: customerAddress.includes('45-60') ? 6000 : 2000,
                distanceKm: customerAddress.includes('45-60') ? 4 : 1, source: 'google_directions', customer: { lat: 4.62, lng: -74.15 } }) };
          h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 8200, dailyOrderNumber: 92 });
          await h.sendQueued(`Quiero dos ${name}`);
          let expectedItems = 2;
          let expectedFee = 2000;
          let expectedAddress = /81A-20/;
          if (scenario === 'fragments') {
            await h.sendQueued('Calle 10 #81A-20');
            for (const input of ['Conjunto Los Cedros', 'Torre B', 'Apartamento 304B', 'Apartamento 402']) {
              const reply = await h.sendQueued(input);
              expect(reply).not.toMatch(/algo m[aá]s|qu[eé] se te antoja/i);
              expect(h.conv.state).toBe('awaiting_payment');
              expect(h.service.ordersService.create).not.toHaveBeenCalled();
            }
            expect(h.conv.sessionData.address).toMatch(/81A-20.*Los Cedros.*Torre B.*402/i);
            expect(h.conv.sessionData.address).not.toContain('304B');
          } else if (scenario === 'pending-variant') {
            await h.sendQueued('Agrega un Jugo De Fruta');
            expect(h.conv.sessionData.pendingAttribute).toBeTruthy();
            await h.sendQueued('A una nueva');
            expect(h.conv.sessionData.pendingAttribute).toBeTruthy();
            await h.sendQueued('Carrera 22 #45-60');
            await h.sendQueued('Lulo');
            expect(h.cartRows()).toEqual(expect.arrayContaining([
              expect.objectContaining({ id: 82001, qty: 2 }),
              expect.objectContaining({ id: 82002, qty: 1, attrs: expect.arrayContaining(['Sabor:Lulo']) }),
            ]));
            expectedItems = 3; expectedFee = 6000; expectedAddress = /45-60/;
            await h.sendQueued('Nada más');
          } else {
            await h.sendQueued(oldAddress);
            await h.sendQueued('contraentrega');
            expect(h.conv.state).toBe('awaiting_final_confirm');
            if (scenario === 'new-after-edit' || scenario === 'return-saved') {
              await h.sendQueued('A una nueva');
              if (scenario === 'return-saved') {
                const reply = await h.sendQueued('Mejor a la misma de antes');
                expect(reply).toMatch(/81A-20/);
                expect(h.conv.sessionData.address).toBe(oldAddress);
              } else {
                const total = await h.sendQueued('Cuánto es el total');
                expect(total).toMatch(/42[.,]000/);
                expect(h.conv.sessionData.address).toBeFalsy();
                await h.sendQueued(`Agrega un ${name}`);
                expectedItems = 3;
                await h.sendQueued('Carrera 22 #45-60');
                expectedAddress = /45-60/; expectedFee = 6000;
              }
            } else if (scenario === 'coverage-recovery') {
              const outside = await h.sendQueued('Cambiar dirección a Calle 90 #90-99');
              expect(outside).toMatch(/fuera de cobertura/i);
              expect(h.conv.sessionData.deliveryOutOfCoverage).toBe(true);
              expect(h.service.ordersService.create).not.toHaveBeenCalled();
              await h.sendQueued('Cambiar dirección a Carrera 22 #45-60');
              expect(h.conv.sessionData.deliveryOutOfCoverage).not.toBe(true);
              expectedAddress = /45-60/; expectedFee = 6000;
            } else {
              await h.sendQueued('Cambiar dirección a Carrera 22 #45-60, los dos sin cebolla por favor');
              expect(h.cartRows()).toEqual([expect.objectContaining({ id: 82001, qty: 2, note: expect.stringMatching(/sin cebolla/i) })]);
              expect(h.conv.sessionData.address).not.toMatch(/cebolla|por favor/i);
              expectedAddress = /45-60/; expectedFee = 6000;
            }
          }
          expect(h.conv.sessionData.address).toMatch(expectedAddress);
          expect(h.conv.sessionData.deliveryFeeCalculated).toBe(expectedFee);
          if (expectedFee === 6000) expect(h.conv.sessionData.address).not.toMatch(/81A-20|304B/);
          expect(h.service.ordersService.create).not.toHaveBeenCalled();
          if (h.conv.state === 'awaiting_payment') await h.sendQueued('contraentrega');
          expect(h.conv.state).toBe('awaiting_final_confirm');
          await h.sendQueued('confirmar');
          expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
          const dto = h.service.ordersService.create.mock.calls[0][0];
          expect(dto.address).toMatch(expectedAddress);
          expect(dto.deliveryFee).toBe(expectedFee);
          expect(dto.items).toHaveLength(expectedItems);
          if(scenario === 'address-and-note') expect(dto.items.every((item:any)=>/sin cebolla/i.test(item.note))).toBe(true);
          expect(dto.items.filter((item: any) => item.productId === 82001)).toHaveLength(scenario === 'new-after-edit' ? 3 : 2);
        });
      }
    }
  }
});

describe('Destination changes never guess a missing saved address or a subset note', () => {
  for (const enabled of [false,true]) for (const name of ['Tacos De Hongos','Curry De Garbanzos']) {
    it(`${name}: no saved address, agent=${enabled}`, async () => {
      const h=harness([{id:82101,code:82101,name,price:21000,availableNow:true,attributes:[]}],enabled);
      Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,freshDeliveryAddressRequested:true});
      h.service.deliveryRouting={quoteDeliveryFee:jest.fn()};h.service.ordersService.create=jest.fn();
      await h.sendQueued(`Quiero un ${name}`);
      const before=structuredClone(h.conv.sessionData.cart);
      const reply=await h.sendQueued('Mejor a la misma de antes');
      expect(reply).toMatch(/no tengo.*direcci[oó]n anterior/i);
      expect(h.conv.sessionData.address).toBeFalsy();expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.service.deliveryRouting.quoteDeliveryFee).not.toHaveBeenCalled();expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
    it(`${name}: count does not match all units, agent=${enabled}`, async () => {
      const h=harness([{id:82101,code:82101,name,price:21000,availableNow:true,attributes:[]}],enabled);
      Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,phoneConfirmed:true,notesCollected:true,contactPhone:h.conv.phoneE164});
      h.service.ordersService.create=jest.fn();
      await h.sendQueued(`Quiero tres ${name}`);await h.sendQueued('Calle 10 #20-30');
      const before=structuredClone(h.conv.sessionData.cart);
      const reply=await h.sendQueued('Cambiar dirección a Carrera 22 #45-60, los dos sin cilantro');
      expect(reply).toMatch(/cu[aá]les productos.*sin cilantro/i);
      expect(h.conv.sessionData.address).toMatch(/45-60/);expect(h.conv.sessionData.address).not.toMatch(/cilantro/);
      expect(h.conv.sessionData.cart).toEqual(before);expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
  }
});
