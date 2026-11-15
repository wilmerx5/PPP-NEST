import { harness } from './whatsapp-accuracy.test-support';

for (const agent of [false, true]) {
  for (const text of ['Con platos y cucharas porfa', 'Y unos platos y cubiertos', 'Me envías servilletas por favor']) {
    it(`confirmed supplies are persisted before acknowledgement ${agent}/${text}`, async () => {
      const h = harness([], agent);
      h.conv.state = 'completed';
      h.service.conversationService.getLastOrderConfirmation = jest.fn().mockResolvedValue({dailyOrderNumber:105,createdAt:new Date()});
      const items = [
        { id: 1051, product: { id: 94, code: 94, name: 'Combo De Arroz Paisa' }, unitPrice: 47000, note: 'sin cebolla', attributes: [] },
        { id: 1052, product: { id: 4, code: 4, name: '1 Pollo Broaster' }, unitPrice: 46000, note: '', attributes: [] },
      ];
      const order = { id: 105, dailyOrderNumber: 105, orderStatus: 'cooking', items };
      h.service.ordersService.getWhatsappOrderForNotes = jest.fn().mockResolvedValue(order);
      h.service.ordersService.appendWhatsappOrderNote = jest.fn(async (_id, _conversation, ids, note) => {
        for (const item of items.filter(item => ids.includes(item.id))) item.note = note;
        return { orderId: 105, dailyOrderNumber: 105, changed: true };
      });
      const originalReply = h.service.reply;
      h.service.reply = async (...args) => {
        expect(items.every(item => /Incluir/.test(item.note))).toBe(true);
        return originalReply(...args);
      };
      const reply = await h.sendQueued(text);
      expect(h.service.ordersService.appendWhatsappOrderNote).toHaveBeenCalledWith(105, 1, [1051, 1052], expect.stringContaining('Incluir'));
      expect(reply).toMatch(/guard[eé].*nota.*105/i);
      expect(h.conv.state).toBe('completed');
      expect(h.conv.sessionData.cart).toEqual([]);
      expect(h.agent.runTurn).not.toHaveBeenCalled();
    });
  }

  for (const fault of ['missing', 'delivered', 'canceled', 'database', 'ambiguous']) {
    it(`confirmed note does not claim a write on ${fault}/${agent}`, async () => {
      const h = harness([], agent);
      h.conv.state = 'completed';
      h.service.conversationService.getLastOrderConfirmation = jest.fn().mockResolvedValue({dailyOrderNumber:105,createdAt:new Date()});
      const order = { id: 105, dailyOrderNumber: 105,
        orderStatus: fault === 'delivered' ? 'completed' : fault === 'canceled' ? 'canceled' : 'cooking',
        items: [
          { id: 1, product: { id: 4, code: 4, name: 'Pollo Broaster' }, note: '', attributes: [] },
          { id: 2, product: { id: 98, code: 98, name: 'Combo De Pollo Broaster' }, note: '', attributes: [] },
        ],
      };
      h.service.ordersService.getWhatsappOrderForNotes = jest.fn().mockResolvedValue(fault === 'missing' ? null : order);
      h.service.ordersService.appendWhatsappOrderNote = jest.fn().mockRejectedValue(new Error('database unavailable'));
      const reply = await h.sendQueued(fault === 'ambiguous' ? 'Al pollo ponle sin salsa' : 'Con platos y cucharas porfa');
      expect(reply).not.toMatch(/listo.*guard|ya est[aá] guardada|dej[eé] anotado/i);
      if (fault !== 'database') expect(h.service.ordersService.appendWhatsappOrderNote).not.toHaveBeenCalled();
      expect(h.conv.sessionData.cart).toEqual([]);
      expect(h.conv.state).toBe('completed');
    });
  }

  it(`a named confirmed product receives its own note ${agent}`, async () => {
    const h = harness([], agent);
    h.conv.state = 'completed';
    h.service.conversationService.getLastOrderConfirmation = jest.fn().mockResolvedValue({dailyOrderNumber:105,createdAt:new Date()});
    h.service.ordersService.getWhatsappOrderForNotes = jest.fn().mockResolvedValue({
      id: 105, dailyOrderNumber: 105, orderStatus: 'pending', items: [
        { id: 1, product: { id: 4, code: 4, name: 'Pollo Broaster' }, attributes: [], note: '' },
        { id: 2, product: { id: 23, code: 23, name: 'Arroz Con Pollo' }, attributes: [], note: '' },
      ],
    });
    h.service.ordersService.appendWhatsappOrderNote = jest.fn().mockResolvedValue({ orderId: 105, dailyOrderNumber: 105, changed: true });
    await h.sendQueued('Al pollo broaster ponle sin salsa');
    expect(h.service.ordersService.appendWhatsappOrderNote).toHaveBeenCalledWith(105, 1, [1], 'sin salsa');
    expect(h.conv.sessionData.cart).toEqual([]);
  });
}
