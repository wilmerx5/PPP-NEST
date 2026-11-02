import { isCartTotalAndEtaInquiry } from './whatsapp-session-intents';
import { harness } from './whatsapp-accuracy.test-support';

for (const dish of ['Churrasco', 'Bowl Vegetal']) for (const agent of [false, true]) {
  for (const stage of ['address', 'confirm']) for (const text of [
    'cuanto es y cuanto demora?',
    'cuanto tarda y cuanto es todo?',
    'la cuenta por favor y en cuanto llega?',
    'me confirmas tiempo y valor',
  ]) {
    it(`${dish} ${stage}: ${text} agent=${agent}`, async () => {
      const h = harness([{ id: 96001, code: 1, name: dish, price: 30000, availableNow: true, hasAttributes: false, attributes: [] }], agent);
      Object.assign(h.cfg.localContext, { deliveryTimeNote: '25-35' });
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      h.service.aiService.generateTurn = jest.fn().mockResolvedValue({ reply: '¿Cuál prefieres?', actions: {} });
      h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 336, dailyOrderNumber: 336 });
      h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
      await h.sendQueued(`un ${dish}`);
      if (stage === 'address') {
        h.conv.sessionData.orderType = 'delivery';
        await h.sendQueued('no mas');
        expect(h.conv.state).toBe('awaiting_address');
      } else {
        await h.sendQueued('no mas');
        await h.sendQueued('contraentrega');
        expect(h.conv.state).toBe('awaiting_final_confirm');
      }
      const before = structuredClone(h.conv.sessionData);
      const state = h.conv.state;
      const reply = await h.sendQueued(text);
      expect(h.conv.sessionData.cart).toEqual(before.cart);
      expect(h.conv.sessionData.address).toEqual(before.address);
      expect(h.conv.state).toBe(state);
      expect(reply).toContain('30.000');
      expect(reply).toMatch(/25-35 minutos/);
      expect(reply).toMatch(stage === 'address' ? /direcci[oó]n/ : /confirmar/);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      if (stage === 'confirm') {
        const receipt = await h.sendQueued('confirmar');
        expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
        expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(1);
        expect(receipt).toContain('30.000');
      }
    });
  }
}

for (const text of [
  'cuanto es y agrega un arroz',
  'cuanto demora y confirmar',
  'cuanto es y cuanto demora y quita el pollo',
  'cuanto cuesta el churrasco y cuanto demora',
  'si cambio el pollo cuanto es y cuanto demora',
  'cuanto es y cuando llega mi orden #60',
]) {
  it(`does not consume mixed actions or individual price: ${text}`, () => {
    expect(isCartTotalAndEtaInquiry(text)).toBe(false);
  });
}

for (const dish of ['Churrasco', 'Bowl Vegetal']) for (const agent of [false, true]) {
  it(`${dish}: unknown ETA preserves pending flavor, agent=${agent}`, async () => {
    const h = harness([
      { id: 96001, code: 1, name: dish, price: 30000, availableNow: true, hasAttributes: false, attributes: [] },
      { id: 96002, code: 2, name: 'Coca Cola 1.5L', price: 8500, availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Sabor', options: ['Original', 'Zero'] }] },
    ], agent);
    h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
    h.service.aiService.generateTurn = jest.fn().mockResolvedValue({ reply: '¿Cuál prefieres?', actions: {} });
    await h.sendQueued(`un ${dish}`);
    await h.sendQueued('una Coca Cola 1.5L');
    expect(h.conv.sessionData.pendingAttribute).toBeDefined();
    const before = structuredClone(h.conv.sessionData);
    const reply = await h.sendQueued('cuanto es y cuanto demora');
    expect(h.conv.sessionData.cart).toEqual(before.cart);
    expect(h.conv.sessionData.pendingAttribute).toEqual(before.pendingAttribute);
    expect(reply).toContain('30.000');
    expect(reply).toMatch(/confirmar el tiempo/);
    expect(reply).not.toMatch(/35.?45/);
    expect(reply).toMatch(/sabor/i);
    await h.sendQueued('Original');
    expect(h.conv.sessionData.cart.map(line => line.productId)).toEqual([96001, 96002]);
  });
}
