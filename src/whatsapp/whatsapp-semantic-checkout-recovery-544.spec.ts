import { harness } from './whatsapp-accuracy.test-support';
import { WhatsappAgentService } from './whatsapp-agent.service';
import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { WhatsappConversationService } from './whatsapp-conversation.service';
import { DEFAULT_PAYMENT_METHODS } from './whatsapp-payment-methods';

const names = ['Combo De Pollo Mixto', 'Combo De Tofu'];
function setup(name = names[0], state = 'building_cart') {
  const menu = [{ id: 54401, code: 89, name, price: 57000, availableNow: true, hasAttributes: true,
    attributes: [{ attributeName: 'Bebida', options: ['Colombiana', '7up', 'Ginger', '3fresh'] }] }];
  const h = harness(menu, true);
  h.conv.state = state;
  h.conv.customerName = null;
  h.conv.sessionData = { cart: [{ productId: 54401, code: 89, name, unitPrice: 57000, quantity: 1,
    attributes: [{ attributeName: 'Bebida', attributeValue: 'Colombiana' }] }], orderType: 'delivery' };
  h.service.settingsService.semanticRoutingEnabled = () => true;
  h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
  h.service.conversationService.saveSemanticSession = jest.fn(async (_conv, expected, next, state, name) => {
    if (h.conv.state !== expected.state || JSON.stringify(h.conv.sessionData) !== JSON.stringify(expected.session)) return false;
    h.conv.sessionData = structuredClone(next); h.conv.state = state;
    if (name) h.conv.customerName = name;
    return true;
  });
  return { ...h, menu };
}
const call = (name: string, args: unknown) => ({ id: `call-${name}`, type: 'function', function: { name, arguments: JSON.stringify(args) } });
const answer = (content: string | null, calls?: unknown[]) => new Response(JSON.stringify({ choices: [{ message: { content, tool_calls: calls } }] }), { status: 200 });
function agent() {
  return new WhatsappAgentService({ getEffectiveConfig: async () => ({ openaiApiKey: 'synthetic-key', openaiModel: 'gpt-4o-mini',
    systemPrompt: '', aiTemperature: 0.2, localContext: {}, paymentMethods: DEFAULT_PAYMENT_METHODS }) } as never, new WhatsappCatalogService({} as never));
}
beforeEach(() => jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Unexpected network in free regression')));
afterEach(() => jest.restoreAllMocks());

for (const name of names) for (const text of ['No señor', 'No señora', 'No gracias', 'Eso sería todo', 'Nada más', 'No así no más']) {
  it(`a complete closing reaches customer details with semantics enabled ${name}/${text}`, async () => {
    const h = setup(name);
    h.agent.runTurn.mockRejectedValue(new Error('Closed protocol must not need inference'));
    const reply = await h.sendQueued(text);
    expect(h.agent.runTurn).not.toHaveBeenCalled();
    expect(h.conv.state).toBe('awaiting_name');
    expect(reply).toMatch(/nombre/i);
    expect(h.conv.sessionData.cart).toHaveLength(1);
    expect(h.conv.sessionData.cart[0].quantity).toBe(1);
    expect(reply).not.toMatch(/aclaras|qué quieres pedir/i);
  });
}

for (const name of names) for (const state of ['building_cart', 'awaiting_name', 'awaiting_address']) {
  for (const text of ['Conjunto altavista Torre 4 1105', 'es para Conjunto altavista Torre 4 1105',
    'Conjunto residencial villa galante apto 286 interior 43', 'Calle 7b #78c-79 apto 302']) {
    it(`complete address uses its existing protocol ${name}/${state}/${text}`, async () => {
      const h = setup(name, state);
      if (state === 'awaiting_address') h.conv.customerName = 'Natalia Campos';
      h.agent.runTurn.mockRejectedValue(new Error('Address protocol must not need inference'));
      const reply = await h.sendQueued(text);
      expect(h.agent.runTurn).not.toHaveBeenCalled();
      expect(h.conv.sessionData.cart).toHaveLength(1);
      expect(h.conv.sessionData.cart[0].quantity).toBe(1);
      expect(h.conv.sessionData.address).toMatch(/altavista|villa galante|7b/i);
      expect(reply).not.toMatch(/aclaras qué quieres|no entend/i);
    });
  }
}

for (const name of names) for (const value of ['7up', '3fresh']) for (const text of [`Con${value}`, `el combo lo quiero con${value}`]) {
  it(`joined numeric options retain the original quantity ${name}/${text}`, async () => {
    const h = setup(name);
    const real = agent();
    h.service.agentService = real;
    jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(answer(null, [call('interpret_message', { segments: [{ text, role: 'edit', productIds: [54401] }] })]))
      .mockResolvedValueOnce(answer(null, [call('set_attribute', { sourceText: text, productId: 54401, cartLineIndex: 0,
        attributeName: 'Bebida', attributeValue: value })]))
      .mockResolvedValueOnce(answer('Listo'));
    const reply = await h.sendQueued(text);
    expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({ productId: 54401, quantity: 1,
      attributes: [{ attributeName: 'Bebida', attributeValue: value }] })]);
    expect(reply).not.toMatch(/aclaras/i);
    await h.sendQueued('No señor');
    expect(h.conv.state).toBe('awaiting_name');
  });
}

it('the semantic router reads history strictly before the first current inbound message', async () => {
  const h = setup();
  const text = 'el combo lo quiero con Ginger';
  const history = jest.spyOn(h.service.conversationService, 'getRecentMessageTexts').mockResolvedValue([]);
  h.agent.runTurn.mockResolvedValue({ semanticIntent: { segments: [{ text, role: 'edit', productIds: [54401] }] },
    fulfilledSemanticSegments: [text], actions: { updateAttributes: [{ productId: 54401, cartLineIndex: 0,
      attributeName: 'Bebida', attributeValue: 'Ginger' }] }, reply: '', toolCalls: ['interpret_message', 'set_attribute'] });
  await h.sendQueued(text);
  expect(history).toHaveBeenCalledWith(1, 14, '1');
  expect(h.conv.sessionData.cart[0].quantity).toBe(1);
});

for (const start of [undefined, '9007199254740990']) it(`database history excludes this turn and respects conversation reset ${start}`, async () => {
  const messages = { find: jest.fn().mockResolvedValue([]) };
  const conversations = { findOne: jest.fn().mockResolvedValue({ sessionData: { historyStartMessageId: start } }) };
  const service = new WhatsappConversationService(conversations as never, messages as never, {} as never, {} as never);
  await service.getRecentMessageTexts(1, 14, '9007199254740999');
  const filter = messages.find.mock.calls[0][0];
  expect(filter.take).toBe(14);
  if (start) {
    expect(filter.where.id.type).toBe('and');
    expect(filter.where.id.value.map(value => [value.type, value.value])).toEqual([
      ['moreThanOrEqual', start], ['lessThan', '9007199254740999'],
    ]);
  } else {
    expect(filter.where.id.type).toBe('lessThan');
    expect(filter.where.id.value).toBe('9007199254740999');
  }
});

for (const text of ['Conjunto altavista Torre 4 1105', 'Solo 1', 'No señor', 'el combo lo quiero con7up']) {
  it(`one invalid initial interpretation can be repaired without replaying a mutation ${text}`, async () => {
    const h = setup();
    const role = text.startsWith('Conjunto') ? 'checkout' : text === 'No señor' ? 'finish' : 'edit';
    const segment = { text, role, productIds: role === 'edit' ? [54401] : [] };
    const fetch = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(answer(null, [call('interpret_message', { segments: [segment, segment] })]))
      .mockResolvedValueOnce(answer(null, [call('interpret_message', { segments: [segment] })]))
      .mockResolvedValueOnce(answer('¿Qué dato quieres revisar?'));
    const result = await agent().runTurn({ semanticInterpretation: true, userMessage: text, products: h.menu,
      cart: h.conv.sessionData.cart, sessionSummary: 'Pedido activo', recentMessages: [`Cliente: ${text}`], businessRulesBlock: 'Abierto', brandName: 'Restaurante' });
    expect(result.error).toBeUndefined();
    expect(result.semanticIntent.segments).toEqual([segment]);
    expect(result.actions).toEqual({});
    expect(fetch).toHaveBeenCalledTimes(3);
    const repairRequest = JSON.parse(String(fetch.mock.calls[1][1]?.body));
    expect(repairRequest.tool_choice.function.name).toBe('interpret_message');
    expect(repairRequest.messages.at(-1).content).toContain('currentMessage');
  });
}

it('a second invalid interpretation fails once and cannot keep retrying', async () => {
  const h = setup(); const text = 'No agregues otro combo';
  const fetch = jest.spyOn(global, 'fetch').mockResolvedValue(answer(null, [call('interpret_message', {
    segments: [{ text: 'agregues otro combo', role: 'purchase', productIds: [54401] }],
  })]));
  const result = await agent().runTurn({ semanticInterpretation: true, userMessage: text, products: h.menu,
    cart: h.conv.sessionData.cart, sessionSummary: '', recentMessages: [], businessRulesBlock: '', brandName: 'Restaurante' });
  expect(result.error).toBe('semantic_contract_rejected'); expect(result.actions).toEqual({});
  expect(fetch).toHaveBeenCalledTimes(2);
});

for (const name of names) it(`coalesced messages share one history boundary ${name}`, async () => {
  const h = setup(name);
  const text = 'el combo lo quiero\ncon Ginger';
  const history = jest.spyOn(h.service.conversationService, 'getRecentMessageTexts').mockResolvedValue([]);
  h.agent.runTurn.mockResolvedValue({ semanticIntent: { segments: [{ text, role: 'edit', productIds: [54401] }] },
    fulfilledSemanticSegments: [text], actions: { updateAttributes: [{ productId: 54401, cartLineIndex: 0,
      attributeName: 'Bebida', attributeValue: 'Ginger' }] }, reply: '', toolCalls: ['interpret_message', 'set_attribute'] });
  await h.sendQueued(text, { raw: { coalescedMessages: [
    { messageId: 'bubble-one', text: 'el combo lo quiero' }, { messageId: 'bubble-two', text: 'con Ginger' },
  ] } });
  expect(history).toHaveBeenCalledWith(1, 14, '1');
  expect(h.agent.runTurn).toHaveBeenCalledTimes(1);
  expect(h.agent.runTurn.mock.calls[0][0].userMessage).toBe(text);
  expect(h.conv.sessionData.cart).toHaveLength(1);
  expect(h.conv.sessionData.cart[0].attributes[0].attributeValue).toBe('Ginger');
});

for (const value of ['7up', '3fresh']) it(`a joined connector preserves the rejection of ${value}`, () => {
  const catalog = new WhatsappCatalogService({} as never);
  expect(catalog.pickAttributeOptionFromText(`No quiero con${value}`, { attributeName: 'Bebida', options: [value] })).toBeNull();
});

for (const name of names) it(`corrected count, beverage and details close exactly one unit ${name}`, async () => {
  const h = setup(name);
  h.conv.sessionData.cart[0].quantity = 2;
  Object.assign(h.conv.sessionData, { fulfillmentChosen: true, phoneConfirmed: true, contactPhone: h.conv.phoneE164, notesCollected: true });
  h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 544, dailyOrderNumber: 544 });
  h.service.agentService = agent();
  const fetch = jest.spyOn(global, 'fetch');
  for (const text of ['Solo 1', 'Otra vez solo es 1 combo, no 2']) {
    fetch.mockResolvedValueOnce(answer(null, [call('interpret_message', { segments: [{ text, role: 'edit', productIds: [54401] }] })]))
      .mockResolvedValueOnce(answer(null, [call('update_item', { sourceText: text, productId: 54401, cartLineIndex: 0, quantity: 1 })]))
      .mockResolvedValueOnce(answer('Listo'));
    await h.sendQueued(text);
    expect(h.conv.sessionData.cart).toHaveLength(1);
    expect(h.conv.sessionData.cart[0].quantity).toBe(1);
  }
  const text = 'el combo lo quiero con7up';
  fetch.mockResolvedValueOnce(answer(null, [call('interpret_message', { segments: [{ text, role: 'edit', productIds: [54401] }] })]))
    .mockResolvedValueOnce(answer(null, [call('set_attribute', { sourceText: text, productId: 54401, cartLineIndex: 0, attributeName: 'Bebida', attributeValue: '7up' })]))
    .mockResolvedValueOnce(answer('Listo'));
  await h.sendQueued(text);
  await h.sendQueued('No señor');
  expect(h.conv.state).toBe('awaiting_name');
  const customer = 'Natalia Campos';
  fetch.mockResolvedValueOnce(answer(null, [call('interpret_message', { segments: [{ text: customer, role: 'checkout', productIds: [] }] })]))
    .mockResolvedValueOnce(answer(null, [call('set_checkout_details', { sourceText: customer, customerName: customer })]))
    .mockResolvedValueOnce(answer('Listo'));
  await h.sendQueued(customer);
  await h.sendQueued('Calle 7b #78c-79 apto 302');
  await h.sendQueued('contraentrega');
  const reply = await h.sendQueued('confirmar');
  expect(reply).toMatch(/registrado/i);
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const payload = h.service.ordersService.create.mock.calls[0][0];
  expect(payload.items).toHaveLength(1);
  expect(payload.items[0].productId).toBe(54401);
  expect(JSON.stringify(payload.items[0])).toContain('7up');
});
