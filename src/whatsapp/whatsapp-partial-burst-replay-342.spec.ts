import { harness } from './whatsapp-accuracy.test-support';

const catalogs = [
  ['Bagre Sudado', 'Sobrebarriga Asada', 'Sopa De Menudencias', 'Sopa De Ajiaco'],
  ['Bowl Vegetal', 'Pasta Del Huerto', 'Sopa De Lentejas', 'Crema De Tomate'],
];
for (const names of catalogs) for (const agent of [false, true]) {
  for (const scenario of ['split', 'duplicate-in-burst', 'replay', 'mixed-replay', 'courtesy', 'another']) {
    it(`${names[0]} agent=${agent} scenario=${scenario}`, async () => {
      const menu = names.map((name, i) => ({
        id: 96701 + i, code: i + 1, name, price: 10000 + i * 1000,
        availableNow: true, hasAttributes: false, attributes: [],
      }));
      const h = harness(menu, agent);
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      h.service.aiService.generateTurn = jest.fn().mockResolvedValue({ reply: '¿Cuál prefieres?', actions: {} });
      h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 342, dailyOrderNumber: 342 });
      h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
      // Model the persistence contract: an already claimed Meta ID returns null.
      // This exercises the real receiver/router, not database uniqueness itself.
      const originalClaim = h.service.conversationService.claimInboundMessage;
      const claimed = new Set<string>();
      h.service.conversationService.claimInboundMessage = jest.fn(async (input) => {
        if (input.waMessageId && claimed.has(input.waMessageId)) return null;
        if (input.waMessageId) claimed.add(input.waMessageId);
        return originalClaim(input);
      });
      const texts = [`Un ${names[0]}`, `Una ${names[1]} también por fis`, `Una ${names[2]}`, `Y un ${names[3]}`];
      async function burst(entries: Array<[string, string]>) {
        jest.useFakeTimers();
        try {
          const pending = entries.map(([messageId, text]) => h.service.handleIncoming({
            waId: 'customer', phoneE164: h.conv.phoneE164, messageId, messageType: 'text',
            text, timestamp: Date.now() / 1000, raw: {},
          }));
          await jest.advanceTimersByTimeAsync(4000);
          await Promise.all(pending);
        } finally { jest.useRealTimers(); }
      }
      const entries = texts.map((text, i) => [`buy-${i}`, text] as [string, string]);
      if (scenario === 'duplicate-in-burst') await burst([entries[0], entries[1], entries[0], entries[2], entries[3]]);
      else {
        await burst(entries.slice(0, 2));
        if (scenario === 'mixed-replay') await burst([entries[0], ...entries.slice(2)]);
        else await burst(entries.slice(2));
      }
      if (scenario === 'replay') {
        const before = structuredClone(h.conv.sessionData);
        const replyCount = h.replies.length;
        await burst(entries);
        expect(h.conv.sessionData).toEqual(before);
        expect(h.replies).toHaveLength(replyCount);
      }
      if (scenario === 'courtesy') {
        const before = structuredClone(h.conv.sessionData.cart);
        await burst([['courtesy', 'por fis']]);
        expect(h.conv.sessionData.cart).toEqual(before);
      }
      if (scenario === 'another') await burst([['extra', `Otro ${names[0]}`]]);
      const expected = menu.map((p, i) => [p.id, scenario === 'another' && i === 0 ? 2 : 1]);
      expect(h.conv.sessionData.cart.map(line => [line.productId, line.quantity]).sort()).toEqual(expected.sort());
      expect(h.conv.sessionData.orderType).toBe('pickup');
      expect(h.conv.sessionData.address).toBeUndefined();
      for (const name of names) expect(h.replies.join('\n').toLowerCase()).toContain(name.toLowerCase());
      await h.sendQueued('no mas');
      await h.sendQueued('contraentrega');
      const receipt = await h.sendQueued('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const ids = h.service.ordersService.create.mock.calls[0][0].items.map(item => item.productId).sort();
      expect(ids).toEqual(expected.flatMap(([id, qty]) => Array(qty).fill(id)).sort());
      expect(receipt).toContain(scenario === 'another' ? '56.000' : '46.000');
    });
  }
}
