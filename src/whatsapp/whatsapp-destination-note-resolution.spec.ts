import { harness } from './whatsapp-accuracy.test-support';
import { DEFAULT_PAYMENT_METHODS } from './whatsapp-payment-methods';

describe('Destination note clarification continues through checkout', () => {
  for (const names of [['Ravioles De Ricota', 'Lasagna De Hongos', 'Risotto De Setas'], ['Bowl De Garbanzos', 'Curry De Lentejas', 'Falafel']]) {
    for (const enabled of [false, true]) for (const scenario of ['numbers', 'names', 'cancel', 'partial-units', 'unscoped', 'invalid-selection', 'wrong-count', 'confirm-pending', 'destination-again']) {
      it(`${names[0]} / ${scenario} / agent=${enabled}`, async () => {
        const h = harness(names.map((name, i) => ({id: 83001+i, code: 83001+i, name, price: 20000, availableNow: true, attributes: []})), enabled);
        h.cfg.paymentMethods = DEFAULT_PAYMENT_METHODS.map(p => ({...p, enabled: p.flow !== 'mercadopago'}));
        Object.assign(h.conv.sessionData, {orderType: 'delivery', fulfillmentChosen: true, phoneConfirmed: true, notesCollected: true, contactPhone: h.conv.phoneE164});
        h.service.ordersService.create = jest.fn().mockResolvedValue({id: 8300, dailyOrderNumber: 93});
        if (scenario === 'partial-units') await h.sendQueued(`Quiero tres ${names[0]}`);
        else for (const name of names) await h.sendQueued(`Quiero un ${name}`);
        await h.sendQueued('Calle 10 #20-30');
        await h.sendQueued('contraentrega');
        expect(h.conv.state).toBe('awaiting_final_confirm');
        const reply = await h.sendQueued(`Cambiar dirección a Carrera 22 #45-60, ${scenario === 'unscoped' ? '' : 'los dos '}sin cebolla`);
        expect(reply).toMatch(/cu[aá]les.*sin cebolla/i);
        expect(h.conv.sessionData.address).toMatch(/45-60/);
        expect(h.conv.sessionData.address).not.toMatch(/cebolla/);
        expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeTruthy();
        expect(h.cartRows().every(row => !row.note)).toBe(true);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
        const total = await h.sendQueued('Cuánto es el total');
        expect(total).toMatch(/60[.,]000|62[.,]000/);
        expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeTruthy();
        if (scenario === 'invalid-selection' || scenario === 'wrong-count' || scenario === 'confirm-pending') {
          await h.sendQueued(scenario === 'wrong-count' ? '1' : scenario === 'confirm-pending' ? 'confirmar' : '9');
          expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeTruthy();
          expect(h.cartRows().every(row => !row.note)).toBe(true);
        }
        let finalAddress = /45-60/;
        if (scenario === 'destination-again') {
          await h.sendQueued('Cambiar dirección a Calle 33 #40-50');
          expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeTruthy();
          finalAddress = /40-50/;
        }
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
        const answer = scenario === 'cancel' ? 'no apliques esa nota' : scenario === 'partial-units' ? '1' : scenario === 'names' ? `${names[0]} y ${names[1]}` : scenario === 'unscoped' ? '2' : '1 y 2';
        const resolved = await h.sendQueued(answer);
        expect(resolved).toMatch(scenario === 'cancel' ? /retir[eé]/i : /anotad/i);
        expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeFalsy();
        const noted = h.conv.sessionData.cart.filter(line => /sin cebolla/i.test(line.note || ''));
        expect(noted.reduce((sum, line) => sum + line.quantity, 0)).toBe(scenario === 'cancel' ? 0 : scenario === 'unscoped' ? 1 : 2);
        expect(h.conv.sessionData.cart.reduce((sum, line) => sum + line.quantity, 0)).toBe(3);
        expect(h.conv.state).toBe('awaiting_final_confirm');
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
        await h.sendQueued('confirmar');
        expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
        const dto = h.service.ordersService.create.mock.calls[0][0];
        expect(dto.address).toMatch(finalAddress);
        expect(dto.items).toHaveLength(3);
        expect(dto.items.filter((item: any) => /sin cebolla/i.test(item.note || ''))).toHaveLength(scenario === 'cancel' ? 0 : scenario === 'unscoped' ? 1 : 2);
      });
    }
  }
});
