import { harness } from './whatsapp-accuracy.test-support';

for (const dish of ['Churrasco', 'Bowl Vegetal']) {
  for (const agent of [false, true]) {
    for (const text of ['somos dos', 'para dos', 'somos 3 personas', 'para cuatro personas']) {
      it(`${dish}: ${text} preserves order, agent=${agent}`, async () => {
        const h = harness([{ id: 95901, code: 1, name: dish, price: 30000, availableNow: true, hasAttributes: false, attributes: [] }], agent);
        h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
        h.service.aiService.generateTurn = jest.fn().mockResolvedValue({ reply: '¿Cuál prefieres?', actions: {} });
        h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 335, dailyOrderNumber: 335 });
        h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
        await h.sendQueued(`un ${dish}`);
        const before = structuredClone(h.conv.sessionData.cart);
        const reply = await h.sendQueued(text);
        expect(h.conv.sessionData.cart).toEqual(before);
        expect(h.conv.state).toBe('building_cart');
        expect(reply).toMatch(/personas/);
        expect(reply).toMatch(/unidades/);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
        await h.sendQueued('otro igual');
        expect(h.conv.sessionData.cart[0].quantity).toBe(2);
        await h.sendQueued('no mas');
        await h.sendQueued('contraentrega');
        const receipt = await h.sendQueued('confirmar');
        expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
        expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(2);
        expect(receipt).toContain('60.000');
      });
    }
  }
}

for (const dish of ['Churrasco', 'Bowl Vegetal']) {
  for (const agent of [false, true]) {
    for (const stage of ['pending', 'checkout']) {
      for (const text of ['somos dos', 'para 3 personas']) {
        it(`${dish}: ${text} preserves ${stage}, agent=${agent}`, async () => {
          const h = harness([{ id: 95902, code: 2, name: dish, price: 30000, availableNow: true, hasAttributes: false, attributes: [] }, { id: 95903, code: 3, name: 'Coca Cola 1.5L', price: 8500, availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Sabor', options: ['Original', 'Zero'] }] }], agent);
          h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
          h.service.aiService.generateTurn = jest.fn().mockResolvedValue({ reply: '¿Cuál prefieres?', actions: {} });
          h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 335, dailyOrderNumber: 335 });
          h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
          await h.sendQueued(`un ${dish}`);
          if (stage === 'pending') await h.sendQueued('una Coca Cola 1.5L');
          if (stage === 'checkout') {
            await h.sendQueued('no mas');
            await h.sendQueued('contraentrega');
            expect(h.conv.state).toBe('awaiting_final_confirm');
          } else expect(h.conv.sessionData.pendingAttribute).toBeDefined();
          const before = structuredClone(h.conv.sessionData);
          const state = h.conv.state;
          const reply = await h.sendQueued(text);
          expect(h.conv.sessionData.cart).toEqual(before.cart);
          expect(h.conv.sessionData.pendingAttribute).toEqual(before.pendingAttribute);
          expect(h.conv.state).toBe(state);
          expect(reply).toMatch(/personas.*unidades/);
          expect(h.service.ordersService.create).not.toHaveBeenCalled();
          if (stage === 'pending') {
            await h.sendQueued('Original');
            await h.sendQueued('no mas');
            await h.sendQueued('contraentrega');
          }
          const receipt = await h.sendQueued('confirmar');
          expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
          expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(stage === 'pending' ? 2 : 1);
          expect(receipt).toContain(stage === 'pending' ? '38.500' : '30.000');
        });
      }
    }
  }
}
