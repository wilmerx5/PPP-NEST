import { isDeclineMoreItemsIntent, isNothingElseOrderIntent } from './whatsapp-intent';
import { harness } from './whatsapp-accuracy.test-support';

// User transcripts are the source of the interruptions, not an independent holdout.
// Identities, prices, address and successful continuation are synthetic.
for (const dish of ['Arroz Con Pollo', 'Bowl Vegetal'])
for (const agent of [false, true]) describe(`real-chat-derived journeys: ${dish}; agent mock=${agent}`, () => {
  function start() {
    const h = harness([{ id: 94140, code: 140, name: dish, price: 18000, availableNow: true, attributes: [] }], agent);
    h.conv.customerName = '';
    Object.assign(h.conv.sessionData, { orderType: 'delivery', fulfillmentChosen: true });
    h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
    h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 314, dailyOrderNumber: 314 });
    h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
    h.cfg.localContext = { transferInfoNote: 'Nequi de pruebas 3000000008' };
    return h;
  }
  async function purchase(h: ReturnType<typeof start>) {
    expect(h.conv.sessionData.cart).toEqual([]);
    await h.sendQueued('Buenas tardes');
    await h.sendQueued(`Veci me envías un ${dish.toLowerCase()}`);
    expect(h.cartRows()).toEqual([{ id: 94140, qty: 1, note: undefined, attrs: [] }]);
    expect(h.replies.at(-1)).toMatch(/algo m[aá]s/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  }
  async function finish(h: ReturnType<typeof start>, payment: string, approval: string) {
    const addressReply = await h.sendQueued('Calle 10 #20-30');
    expect(addressReply).toMatch(/paga|pago/i);
    expect(h.conv.sessionData.address).toContain('20-30');
    const review = await h.sendQueued(payment);
    expect(review).toMatch(/confirmar/i);
    expect(h.conv.state).toBe('awaiting_final_confirm');
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    const receipt = await h.sendQueued(approval);
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const dto = h.service.ordersService.create.mock.calls[0][0];
    expect(dto.customerName).toBe('Camila Rojas');
    expect(dto.items).toHaveLength(1);
    expect(JSON.stringify(dto)).toContain('20-30');
    expect(receipt).toMatch(/314/);
    expect(receipt).toContain(dish);
    expect(receipt).toMatch(/20\.000/);
    expect(h.conv.state).toBe('completed');
  }
  it.each(['así?', 'así pero sin salsa'])('does not close on qualified response %s', async text => {
    const h = start(); await purchase(h);
    await h.sendQueued(text);
    expect(h.conv.state).toBe('building_cart');
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    expect(h.conv.sessionData.cart).toHaveLength(1);
  });
  it('bare así is not authorization to submit the final review', async () => {
    const h = start(); await purchase(h);
    await h.sendQueued('No más'); await h.sendQueued('Camila Rojas');
    await h.sendQueued('Calle 10 #20-30'); await h.sendQueued('Contraentrega');
    expect(h.conv.state).toBe('awaiting_final_confirm');
    await h.sendQueued('Así veci');
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
  it('CHAT-NAME-WAIT: a separate wait bubble never becomes part of the name', async () => {
    const h = start(); await purchase(h);
    await h.sendQueued('Así veci');
    expect(h.conv.state).toBe('awaiting_name');
    await h.sendQueued('Camila Rojas');
    expect(h.conv.state).toBe('awaiting_address');
    const before = structuredClone(h.conv.sessionData);
    const wait = await h.sendQueued('Voy');
    expect(wait).toMatch(/espero|cuando/i);
    expect(h.conv.customerName).toBe('Camila Rojas');
    expect(h.conv.sessionData).toEqual(before);
    await finish(h, 'Por nequi', 'Confirmar');
  });
  it('CHAT-PAYMENT-INTERRUPTION: answers Nequi while retaining the missing-address step', async () => {
    const h = start(); await purchase(h);
    await h.sendQueued('Solo eso porfa');
    await h.sendQueued('Camila Rojas');
    const before = structuredClone(h.conv.sessionData.cart);
    const info = await h.sendQueued('Me indicas el nequi');
    expect(info).toContain('3000000008');
    expect(h.conv.state).toBe('awaiting_address');
    expect(h.conv.sessionData.address).toBeUndefined();
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    await finish(h, 'Por nequi', 'Confirmo');
  });
  it('CHAT-TOTAL-AS-ADDRESS: close and total questions survive the full checkout', async () => {
    const h = start(); await purchase(h);
    const total = await h.sendQueued('no mas, cuanto es?');
    expect(total).toMatch(/18\.000/);
    expect(h.conv.state).toBe('awaiting_name');
    await h.sendQueued('Camila Rojas');
    const before = structuredClone(h.conv.sessionData);
    const again = await h.sendQueued('de todo lo que pedi');
    expect(again).toMatch(/18\.000/);
    expect(h.conv.sessionData.address).toBeUndefined();
    expect(h.conv.sessionData.cart).toEqual(before.cart);
    expect(h.conv.state).toBe('awaiting_address');
    await finish(h, 'Contraentrega', 'Sí');
  });
});

describe('short colloquial close boundaries', () => {
  it.each(['Así veci', 'asi', 'Así, señor', 'así porfa'])('accepts complete cart response %s', text => {
    expect(isDeclineMoreItemsIntent(text)).toBe(true);
    expect(isNothingElseOrderIntent(text)).toBe(false);
  });
  it.each(['así pero sin salsa', 'así con más ensalada', 'así?', '¿así?', 'si queda así', 'así no', 'así y otra bebida'])('does not consume a qualification/question: %s', text => {
    expect(isDeclineMoreItemsIntent(text)).toBe(false);
  });
});
