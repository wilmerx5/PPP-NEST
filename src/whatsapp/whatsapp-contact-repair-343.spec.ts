import { harness } from './whatsapp-accuracy.test-support';

for (const names of [
  ['Bagre Sudado', 'Sobrebarriga Asada', 'Sopa De Ajiaco'],
  ['Bowl Vegetal', 'Pasta Del Huerto', 'Crema De Tomate'],
]) for (const agent of [false, true]) for (const burst of [false, true]) {
  for (const repair of [false, true]) {
    it(`contact and repair ${names[0]} agent=${agent} burst=${burst} repair=${repair}`, async () => {
      const menu = names.map((name, i) => ({
        id: 96801 + i, code: i + 1, name, price: 10000 + i * 1000,
        availableNow: true, hasAttributes: false, attributes: [],
      }));
      const h = harness(menu, agent);
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      h.service.aiService.generateTurn = jest.fn().mockResolvedValue({ reply: '¿Cuál prefieres?', actions: {} });
      h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 343, dailyOrderNumber: 343 });
      h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
      await h.sendQueued(`Dos ${names[0]}`);
      const messages = [`Una ${names[1]} por fis`, 'el teléfono es 3000000002', `Y un ${names[2]}`];
      if (burst) {
        jest.useFakeTimers();
        try {
          const pending = messages.map((text, i) => h.service.handleIncoming({
            waId: 'customer', phoneE164: h.conv.phoneE164, messageId: `contact-${i}`,
            messageType: 'text', text, timestamp: Date.now() / 1000, raw: {},
          }));
          await jest.advanceTimersByTimeAsync(4000);
          await Promise.all(pending);
        } finally { jest.useRealTimers(); }
      } else for (const text of messages) await h.sendQueued(text);
      expect(h.conv.sessionData.contactPhone?.replace(/\D/g, '').slice(-10)).toBe('3000000002');
      expect(h.conv.sessionData.cart.map(line => [line.productId, line.quantity]).sort()).toEqual([[96801, 2], [96802, 1], [96803, 1]]);
      if (repair) {
        const reply = await h.sendQueued(`Quita un ${names[0]} y añade una ${names[1]}`);
        expect(reply?.toLowerCase()).toContain(names[1].toLowerCase());
      }
      const expected = repair ? [[96801, 1], [96802, 2], [96803, 1]] : [[96801, 2], [96802, 1], [96803, 1]];
      expect(h.conv.sessionData.cart.map(line => [line.productId, line.quantity]).sort()).toEqual(expected);
      expect(h.conv.sessionData.orderType).toBe('pickup');
      expect([undefined, 'Recoge en el local']).toContain(h.conv.sessionData.address);
      await h.sendQueued('no mas');
      await h.sendQueued('contraentrega');
      const receipt = await h.sendQueued('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const dto = h.service.ordersService.create.mock.calls[0][0];
      expect(dto.phone.replace(/\D/g, '').slice(-10)).toBe('3000000002');
      expect(dto.items.map(item => item.productId).sort()).toEqual(expected.flatMap(([id, qty]) => Array(qty).fill(id)).sort());
      expect(receipt).toContain(repair ? '44.000' : '43.000');
    });
  }
}

for (const names of [['Bagre Sudado', 'Sobrebarriga Asada'], ['Bowl Vegetal', 'Pasta Del Huerto']]) {
  for (const scenario of ['excess', 'unknown', 'unavailable', 'question', 'condition', 'negative', 'ambiguous']) {
    it(`atomic direct repair guard ${names[0]} ${scenario}`, async () => {
      const menu = names.map((name, i) => ({ id: 96901 + i, code: i + 1, name, price: 10000,
        availableNow: true, hasAttributes: false, attributes: [] }));
      const h = harness(menu, true);
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      await h.sendQueued(`Dos ${names[0]}`);
      if (scenario === 'unavailable') menu[1].availableNow = false;
      if (scenario === 'ambiguous') h.conv.sessionData.cart.push({
        ...structuredClone(h.conv.sessionData.cart[0]), quantity: 1, note: 'Sin sal',
      });
      let text = `Quita ${scenario === 'excess' ? 'tres' : scenario === 'negative' ? '-1' : 'un'} ${names[0]} y añade una ${scenario === 'unknown' ? 'Comida Inexistente' : names[1]}`;
      if (scenario === 'question') text += '?';
      if (scenario === 'condition') text += ' si hay';
      const before = structuredClone(h.conv.sessionData.cart);
      const reply = await h.sendQueued(text);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(reply).toBeTruthy();
      if (scenario === 'ambiguous') expect(h.conv.sessionData.pendingCartRemoval?.options).toHaveLength(2);
      else expect(reply).toMatch(/igual/);
    });
  }
}
