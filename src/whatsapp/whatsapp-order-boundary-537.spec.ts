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
  it(`uses the effective night-test availability when deciding the boundary agent=${agent}`, async () => {
    const h = draft(agent), before = structuredClone(h.conv.sessionData.cart);
    h.service.catalogService.getMenuProducts = jest.fn().mockResolvedValue(menu.map(product => ({ ...product, availableNow: false })));
    await h.sendQueued(request);
    expect(h.conv.sessionData.pendingOrderBoundary?.request).toBe(request);
    expect(h.conv.sessionData.cart).toEqual(before);
  });
  for (const timestamp of ['expired', 'missing', 'malformed'] as const) {
    it(`retires a ${timestamp} boundary timestamp without applying its stored request agent=${agent}`, async () => {
      const h = draft(agent);
      await h.sendQueued(request);
      if (timestamp === 'missing') delete h.conv.sessionData.pendingOrderBoundary!.createdAt;
      else h.conv.sessionData.pendingOrderBoundary!.createdAt = timestamp === 'expired' ? Date.now() - 31 * 60_000 : NaN;
      const beforeCart = structuredClone(h.conv.sessionData.cart);
      await h.sendQueued('nuevo pedido');
      expect(h.conv.sessionData.pendingOrderBoundary).toBeUndefined();
      expect(h.conv.sessionData.cart).toEqual(beforeCart);
      expect(h.conv.state).toBe('awaiting_payment');
      expect(h.replies.at(-1)).toMatch(/pregunta.*venció.*Envíame de nuevo/s);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
  }
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

for (const agent of [false, true]) {
  for (const choice of ['continuar pedido', 'nuevo pedido']) {
    it(`transcribes each boundary audio once and replays its purchase ${choice} agent=${agent}`, async () => {
      const h = draft(agent), before = structuredClone(h.conv.sessionData);
      const transcribe = jest.fn().mockResolvedValueOnce(request).mockResolvedValueOnce(choice);
      h.service.resolveAudioToText = transcribe;
      await h.sendQueued('', { messageType: 'audio', mediaId: 'boundary-request' });
      expect(h.conv.sessionData.pendingOrderBoundary?.request).toBe(request);
      const { pendingOrderBoundary, ...retained } = h.conv.sessionData;
      expect(retained).toEqual(before);
      expect(transcribe).toHaveBeenCalledTimes(1);
      expect(transcribe.mock.calls[0][0].messageType).toBe('audio');
      await h.sendQueued('', { messageType: 'audio', mediaId: 'boundary-choice' });
      expect(transcribe).toHaveBeenCalledTimes(2);
      expect(transcribe.mock.calls[1][0].messageType).toBe('audio');
      expect(h.conv.sessionData.pendingOrderBoundary).toBeUndefined();
      const expected = choice === 'nuevo pedido' ? menu.slice(1) : menu;
      expect(h.conv.sessionData.cart.map(line => [line.productId, line.quantity])).toEqual(expected.map(product => [product.id, 1]));
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
  }
  it(`preserves the question when audio transcription fails agent=${agent}`, async () => {
    const h = draft(agent);
    await h.sendQueued(request);
    const before = structuredClone(h.conv.sessionData);
    h.service.resolveAudioToText = jest.fn().mockResolvedValue(null);
    await h.sendQueued('', { messageType: 'audio', mediaId: 'unreadable' });
    expect(h.service.resolveAudioToText).toHaveBeenCalledTimes(1);
    expect(h.replies.at(-1)).toMatch(/No pude escuchar el audio/i);
    expect(h.conv.sessionData).toEqual(before);
  });
  it(`keeps a cancellation question from discarding the saved purchase agent=${agent}`, async () => {
    const h = draft(agent);
    await h.sendQueued(request);
    const before = structuredClone(h.conv.sessionData);
    await h.sendQueued('¿Puedo cancelar el pedido?');
    expect(h.conv.sessionData).toEqual(before);
    expect(h.replies.at(-1)).toMatch(/continuar pedido.*nuevo pedido/s);
  });
  for (const command of ['cancelar', 'reiniciar']) {
    for (const closed of [false, true]) {
      it(`lets ${command} discard the draft while the boundary is pending closed=${closed} agent=${agent}`, async () => {
        const h = draft(agent);
        h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
        await h.sendQueued(request);
        if (closed) {
          h.cfg.ignoreBusinessHours = false;
          h.service.businessService.getStatus = jest.fn().mockResolvedValue({ isOpen: false });
          const before = structuredClone(h.conv.sessionData);
          await h.sendQueued('nuevo pedido');
          expect(h.conv.sessionData).toEqual(before);
          expect(h.replies.at(-1)).toMatch(/cerrad/i);
        }
        await h.sendQueued(command);
        expect(h.conv.sessionData.pendingOrderBoundary).toBeUndefined();
        expect(h.conv.sessionData.cart).toEqual([]);
        expect(h.conv.state).toBe('building_cart');
        expect(h.replies.at(-1)).toMatch(command === 'cancelar' ? /cancelado/i : /vaciamos/i);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
      });
    }
  }
  it(`preserves the pending draft and skips audio work during human takeover agent=${agent}`, async () => {
    const h = draft(agent);
    await h.sendQueued(request);
    const before = structuredClone(h.conv.sessionData);
    Object.assign(h.conv, { humanTakeover: true });
    h.service.resolveAudioToText = jest.fn().mockResolvedValue('nuevo pedido');
    await h.sendQueued('', { messageType: 'audio', mediaId: 'human-turn' });
    expect(h.service.resolveAudioToText).not.toHaveBeenCalled();
    expect(h.conv.sessionData).toEqual(before);
  });
}
