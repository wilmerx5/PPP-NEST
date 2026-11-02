import { isDeliveryLogisticsFluff } from './whatsapp-intent';
import { harness } from './whatsapp-accuracy.test-support';

for (const [oldDish, newDish] of [['Churrasco', 'Sopa De Lentejas'], ['Bowl Vegetal', 'Pasta Alfredo']]) {
  for (const agent of [false, true]) for (const state of ['completed', 'closed']) {
    for (const text of ['Buenas noches veci me regalas un domicilio', 'para un domicilio', 'hola veci me envias un domicilio porfa', 'me puedes regalar un domicilio']) {
      it(`${oldDish} ${state}: ${text}, agent=${agent}`, async () => {
        const h = harness([
          { id: 96101, code: 1, name: oldDish, price: 30000, availableNow: true, hasAttributes: false, attributes: [] },
          { id: 96102, code: 2, name: newDish, price: 20000, availableNow: true, hasAttributes: false, attributes: [] },
        ], agent);
        h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
        h.service.aiService.generateTurn = jest.fn().mockResolvedValue({ reply: '¿Cuál prefieres?', actions: {} });
        h.service.ordersService.create = jest.fn().mockResolvedValueOnce({ id: 337, dailyOrderNumber: 337 }).mockResolvedValueOnce({ id: 338, dailyOrderNumber: 338 });
        h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
        h.service.conversationService.reopenForNewOrder = jest.fn(async () => h.service.conversationService.resetOrderSession(h.conv, 'building_cart', { ignorePriorHistory: true }));
        await h.sendQueued(`un ${oldDish}`);
        await h.sendQueued('no mas');
        await h.sendQueued('contraentrega');
        await h.sendQueued('confirmar');
        expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
        expect(h.conv.state).toBe('completed');
        h.conv.state = state;
        h.service.ordersService.findTodayOrdersByPhone.mockResolvedValue([{ id: 337, dailyOrderNumber: 337, orderStatus: 'cooking' }]);
        const reply = await h.sendQueued(text);
        expect(h.service.conversationService.reopenForNewOrder).toHaveBeenCalledTimes(1);
        expect(h.conv.state).toBe('building_cart');
        expect(h.conv.sessionData.cart).toEqual([]);
        expect(h.conv.sessionData.orderType).toBe('delivery');
        expect(reply).toMatch(/pedir|plato|antoja/i);
        expect(reply).not.toMatch(/demor|preparaci[oó]n|n[uú]mero de orden|#337/i);
        expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
        await h.sendQueued(`un ${newDish}`);
        expect(h.conv.sessionData.cart.map(line => line.productId)).toEqual([96102]);
        await h.sendQueued('paso a recoger');
        await h.sendQueued('no mas');
        await h.sendQueued('contraentrega');
        const receipt = await h.sendQueued('confirmar');
        expect(h.service.ordersService.create).toHaveBeenCalledTimes(2);
        expect(h.service.ordersService.create.mock.calls[1][0].items.map(item => item.productId)).toEqual([96102]);
        expect(receipt).toContain('20.000');
      });
    }
  }
}

for (const agent of [false, true]) for (const state of ['completed', 'closed']) {
  for (const text of ['cuanto se demora mi pedido', 'gracias', 'si señor', 'me regalas unas salsas porfa']) {
    it(`preserves old ${state} order: ${text}, agent=${agent}`, async () => {
      const h = harness([{ id: 96101, code: 1, name: 'Bowl Vegetal', price: 30000, availableNow: true, hasAttributes: false, attributes: [] }], agent);
      h.conv.state = state;
      h.service.conversationService.reopenForNewOrder = jest.fn();
      h.service.ordersService.create = jest.fn();
      h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([{ id: 337, dailyOrderNumber: 337, orderStatus: 'cooking' }]);
      const before = structuredClone(h.conv.sessionData);
      const reply = await h.sendQueued(text);
      expect(h.conv.state).toBe(state);
      expect(h.conv.sessionData.cart).toEqual(before.cart);
      expect(h.service.conversationService.reopenForNewOrder).not.toHaveBeenCalled();
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      expect(reply).not.toMatch(/qué.*pedir|qu[eé].*antoja|cu[aá]l prefieres/i);
      expect(reply).toMatch(text.includes('demora') ? /preparaci[oó]n|estimad/ : text.includes('salsas') ? /no.*aplicada|confirmar/i : /con gusto/i);
    });
  }
}

for (const text of [
  'me regalas un domicilio para Calle 10 #20-30',
  'me regalas un domicilio y una sopa',
  'no me regalas un domicilio',
  'si me regalas un domicilio',
  'me regalas un domicilio para mañana',
  'me regalas un domicilio o paso a recoger',
]) it(`keeps additional intent or destination: ${text}`, () => {
  expect(isDeliveryLogisticsFluff(text)).toBe(false);
});
