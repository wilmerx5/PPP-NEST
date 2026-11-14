import { harness } from './whatsapp-accuracy.test-support';

const menu = ['Bowl Andino', 'Ensalada Campestre', 'Sopa del Huerto'].map((name, index) => ({
  id: 97100 + index, code: 97100 + index, name, price: 18000,
  hasAttributes: false, attributes: [],
}));

function draft(agent: boolean, state = 'awaiting_payment') {
  const h = harness(menu, agent);
  h.conv.state = state;
  h.conv.sessionData = {
    cart: [{ productId: menu[0].id, code: menu[0].code, name: menu[0].name, unitPrice: menu[0].price, quantity: 1 }],
    orderType: 'pickup', fulfillmentChosen: true, phoneConfirmed: true,
    contactPhone: h.conv.phoneE164, recentUnavailableOrder: { items: ['lo que quiero es'], expiresAt: Date.now() + 60000 },
  };
  h.service.ordersService.create = jest.fn();
  return h;
}
const request = 'Buenas tardes por favor me envía una Ensalada Campestre y una Sopa del Huerto';

for (const agent of [false, true]) {
  it(`keeps an explicitly separate purchase separate while a dish needs clarification agent=${agent}`, async () => {
    const h = draft(agent), before = structuredClone(h.conv.sessionData);
    await h.sendQueued('Quiero hacer otro pedido, una Ensalada Campestre y una pizza volcánica');
    expect(h.conv.sessionData.pendingOrderBoundary).toBeDefined();
    const { pendingOrderBoundary, ...retained } = h.conv.sessionData;
    expect(retained).toEqual(before);
  });
  it(`recognizes a single new purchase and freezes contact clauses agent=${agent}`, async () => {
    const h = draft(agent, 'awaiting_name'), before = structuredClone(h.conv.sessionData);
    await h.sendQueued('Buenas tardes, una Ensalada Campestre. A nombre de Natalia');
    expect(h.conv.sessionData.pendingOrderBoundary).toBeDefined();
    expect(h.conv.customerName).toBe('Wilmer');
    const { pendingOrderBoundary, ...retained } = h.conv.sessionData;
    expect(retained).toEqual(before);
  });
  it(`freezes a different purchase until an exact decision agent=${agent}`, async () => {
    const h = draft(agent), before = structuredClone(h.conv.sessionData);
    await h.sendQueued(request);
    expect(h.replies.at(-1)).toMatch(/continuar pedido.*nuevo pedido/s);
    const { pendingOrderBoundary, ...retained } = h.conv.sessionData;
    expect(pendingOrderBoundary?.request).toBe(request);
    expect(retained).toEqual(before);
    expect(h.conv.state).toBe('awaiting_payment');
    await h.sendQueued('sí');
    expect(h.conv.sessionData.pendingOrderBoundary).toEqual(pendingOrderBoundary);
    expect(h.agent.runTurn).not.toHaveBeenCalled();
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
  it(`adds the saved request once after continuation agent=${agent}`, async () => {
    const h = draft(agent);
    await h.sendQueued(request);
    await h.sendQueued('continuar pedido');
    expect(h.conv.sessionData.pendingOrderBoundary).toBeUndefined();
    expect(h.conv.sessionData.cart.map(line => [line.productId, line.quantity])).toEqual(menu.map(product => [product.id, 1]));
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
  it(`replaces the draft only after new-order choice agent=${agent}`, async () => {
    const h = draft(agent);
    const reset = jest.spyOn(h.service.conversationService, 'resetOrderSession');
    await h.sendQueued('Quiero hacer otro pedido, una Ensalada Campestre y una Sopa del Huerto');
    await h.sendQueued('nuevo pedido');
    expect(reset).toHaveBeenCalledWith(h.conv, 'building_cart', { ignorePriorHistory: true, rememberDeliveryAddress: true });
    expect(h.conv.sessionData.pendingOrderBoundary).toBeUndefined();
    expect(h.conv.sessionData.cart.map(line => [line.productId, line.quantity])).toEqual(menu.slice(1).map(product => [product.id, 1]));
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
  it(`rejects replay after a changed draft agent=${agent}`, async () => {
    const h = draft(agent);
    await h.sendQueued(request);
    h.conv.sessionData.cart[0].quantity = 3;
    await h.sendQueued('nuevo pedido');
    expect(h.replies.at(-1)).toMatch(/pedido pendiente cambió/i);
    expect(h.conv.sessionData.cart).toHaveLength(1);
    expect(h.conv.sessionData.cart[0].quantity).toBe(3);
    expect(h.conv.sessionData.pendingOrderBoundary).toBeUndefined();
  });
  it(`leaves the saved request untouched on duplicate inbound agent=${agent}`, async () => {
    const h = draft(agent);
    await h.sendQueued(request);
    const before = structuredClone(h.conv.sessionData);
    h.service.conversationService.claimInboundMessage = jest.fn().mockResolvedValue(null);
    await h.sendQueued('nuevo pedido');
    expect(h.conv.sessionData).toEqual(before);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
  for (const state of ['completed', 'closed', 'awaiting_mp_payment']) {
    it(`does not own postorder or payment-link routing ${state} agent=${agent}`, async () => {
      const h = draft(agent, state);
      if (state === 'awaiting_mp_payment') h.conv.sessionData.mpPreferenceId = 'existing-link';
      // The boundary hook deliberately delegates these states to their existing router.
      expect(await h.service.resolveOrderBoundary(h.conv, 'customer', request, h.cfg, true)).toBeUndefined();
      expect(h.conv.sessionData.pendingOrderBoundary).toBeUndefined();
    });
  }
  for (const text of ['Buenas tardes', 'Buenas tardes agrega una Ensalada Campestre y una Sopa del Huerto']) {
    it(`preserves the existing greeting/addition route agent=${agent} ${text}`, async () => {
      const h = draft(agent);
      await h.sendQueued(text);
      expect(h.conv.sessionData.pendingOrderBoundary).toBeUndefined();
      expect(h.conv.sessionData.cart[0].productId).toBe(menu[0].id);
    });
  }
}
