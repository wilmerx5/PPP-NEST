import { harness } from './whatsapp-accuracy.test-support';
import { WhatsappConversationService } from './whatsapp-conversation.service';

const hour = 60 * 60_000;
for (const agent of [false, true]) for (const state of ['completed', 'closed', 'awaiting_payment']) {
  for (const elapsed of [hour, 4 * hour - 60_000, 4 * hour, 24 * hour]) {
    it(`conversation window ${agent}/${state}/${elapsed}`, async () => {
      const h = harness([{ id: 53901, code: 91, name: 'Pasta Vegetal', price: 20000, availableNow: true, attributes: [] }], agent);
      h.conv.state = state;
      Object.assign(h.conv, { lastInboundAt: new Date(Date.now() - elapsed) });
      const cart = state === 'awaiting_payment'
        ? [{ productId: 53901, code: 91, name: 'Pasta Vegetal', quantity: 2, unitPrice: 20000, attributes: [] }] : [];
      h.conv.sessionData.cart = structuredClone(cart);
      const originalReset = h.service.conversationService.resetOrderSession;
      h.service.conversationService.resetOrderSession = jest.fn(async (conv, nextState, options) => {
        await originalReset(conv, nextState);
        if (options?.historyStartMessageId) h.conv.sessionData.historyStartMessageId = options.historyStartMessageId;
      });
      h.service.conversationService.reopenForNewOrder = jest.fn(async conv => {
        await h.service.conversationService.resetOrderSession(conv, 'building_cart', { ignorePriorHistory: true });
      });
      await h.sendQueued('Hola buenas tardes');
      if (elapsed >= 4 * hour) {
        expect(h.conv.sessionData.cart).toEqual([]);
        expect(h.conv.sessionData.historyStartMessageId).toBe('1');
        expect(h.conv.sessionData.ignorePriorOrderHistory).toBe(true);
        expect(h.replies.at(-1)).not.toMatch(/pedido anterior listo/i);
        expect(h.replies.at(-1)).toMatch(/hola|bienvenido|buenas tardes/i);
        expect(h.service.conversationService.reopenForNewOrder).not.toHaveBeenCalled();
      } else if (state === 'awaiting_payment') {
        expect(h.conv.sessionData.cart).toEqual(cart);
        expect(h.service.conversationService.resetOrderSession).not.toHaveBeenCalled();
      } else {
        expect(h.replies.at(-1)).toMatch(/pedido anterior listo/i);
        expect(h.conv.sessionData.historyStartMessageId).toBeUndefined();
      }
    });
  }
}

for (const agent of [false, true]) {
  it(`old draft is replaced by today's explicit purchase ${agent}`, async () => {
    const menu = ['Pasta Vegetal', 'Bowl De Tofu'].map((name, i) => ({ id: 53901 + i, code: 91 + i, name, price: 20000, availableNow: true, attributes: [] }));
    const h = harness(menu, agent);
    Object.assign(h.conv, { lastInboundAt: new Date(Date.now() - 48 * hour) });
    h.conv.state = 'awaiting_final_confirm';
    h.conv.sessionData.cart = [{ productId: 53901, code: 91, name: menu[0].name, quantity: 3, unitPrice: 20000, attributes: [] }];
    await h.sendQueued('Quiero un Bowl De Tofu');
    expect(h.conv.sessionData.cart.map(item => [item.productId, item.quantity])).toEqual([[53902, 1]]);
    expect(h.conv.sessionData.pendingOrderBoundary).toBeFalsy();
  });
}

for (const boundary of [undefined, null, 'abc', -1, 45, '45', '9007199254740999']) {
  it(`history readers honor a valid persisted message boundary ${boundary}`, async () => {
    const messages = { find: jest.fn().mockResolvedValue([]), findOne: jest.fn().mockResolvedValue(null) };
    const conversations = { findOne: jest.fn().mockResolvedValue({ sessionData: { historyStartMessageId: boundary } }) };
    const service = new WhatsappConversationService(conversations as never, messages as never, {} as never, {} as never);
    await service.getRecentMessageTexts(1, 12);
    await service.getLastOutboundBody(1);
    for (const mock of [messages.find, messages.findOne]) {
      const filter = mock.mock.calls[0][0].where;
      expect(filter.conversationId).toBe(1);
      if (typeof boundary === 'string' && /^\d+$/.test(boundary)) {
        expect(filter.id.type).toBe('moreThanOrEqual');
        expect(filter.id.value).toBe(boundary);
      } else expect(filter.id).toBeUndefined();
    }
  });
}

it('confirmed-note lookup uses a trusted outbound receipt from the current history window', async () => {
  const date = new Date();
  const query = { where: jest.fn(), andWhere: jest.fn(), orderBy: jest.fn(), getOne: jest.fn().mockResolvedValue({
    body: '✅ *¡Listo! Tu pedido quedó registrado*\n\n🧾 Orden *#105*', createdAt: date,
  }) };
  for (const key of ['where', 'andWhere', 'orderBy']) query[key].mockReturnValue(query);
  const conversations = { findOne: jest.fn().mockResolvedValue({ sessionData: { historyStartMessageId: '9007199254740999' } }) };
  const messages = { createQueryBuilder: jest.fn().mockReturnValue(query) };
  const service = new WhatsappConversationService(conversations as never, messages as never, {} as never, {} as never);
  await expect(service.getLastOrderConfirmation(1)).resolves.toEqual({ dailyOrderNumber: 105, createdAt: date });
  expect(query.andWhere).toHaveBeenCalledWith('m.direction = :direction', { direction: 'out' });
  expect(query.andWhere).toHaveBeenCalledWith('m.id >= :historyStart', { historyStart: '9007199254740999' });
});
