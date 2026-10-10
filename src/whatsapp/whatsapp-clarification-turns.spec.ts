import { readFileSync } from 'fs';
import { join } from 'path';
import { WhatsappOrchestratorService } from './whatsapp-orchestrator.service';
import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { WhatsappActionGuardService } from './whatsapp-action-guard.service';
import { WhatsappPointsService } from './whatsapp-points.service';
import { WhatsappTurnTelemetryService } from './whatsapp-turn-telemetry.service';
import type { WhatsappSessionData } from './types/whatsapp-session.types';
import { DEFAULT_PAYMENT_METHODS } from './whatsapp-payment-methods';

const products = JSON.parse(readFileSync(join(__dirname, '../../scripts/fixtures/whatsapp-beta-menu.json'), 'utf8'));

// Real inbound routing, catalog, guard and cart. Only persistence, model and
// transports are isolated. Reload/save clone data just as DB serialization does.
function harness() {
  let count = 0;
  const conv = { id: 1, waId: 'customer', phoneE164: '+573000000001', customerName: 'Wilmer', state: 'building_cart',
    sessionData: { cart: [], orderType: 'pickup' } as WhatsappSessionData };
  const replies: string[] = [];
  const history: string[] = [];
  const conversations = {
    findOrCreateConversation: async () => conv,
    touchInbound: async () => undefined,
    claimInboundMessage: async ({ body }: { body: string }) => { count++; history.push(`Cliente: ${body}`); return { id: count }; },
    reloadConversation: async () => structuredClone(conv),
    getSession: () => structuredClone(conv.sessionData),
    saveSession: async (_conv: unknown, session: WhatsappSessionData, state?: string) => {
      conv.sessionData = structuredClone(session); if (state) conv.state = state;
    },
    resetOrderSession: async () => { conv.sessionData = { cart: [], orderType: 'pickup', ignorePriorOrderHistory: true }; conv.state = 'building_cart'; },
    countInboundMessages: async () => count + 1,
    getRecentMessageTexts: async () => history,
    getLastOutboundBody: async () => replies.at(-1) || null,
    updateCustomerName: async (_conv: unknown, name: string) => { conv.customerName = name; },
  };
  const catalog = new WhatsappCatalogService({} as never);
  jest.spyOn(catalog, 'getMenuProducts').mockResolvedValue(products);
  const agent = { runTurn: jest.fn().mockResolvedValue({ reply: '¿Cuál prefieres?', actions: {}, toolCalls: [] }) };
  const cfg = { enabled: true, agentV1Enabled: true, ignoreBusinessHours: true,
    brandName: 'PPP', localContext: {}, paymentMethods: DEFAULT_PAYMENT_METHODS, menuConceptGroups: [] };
  const service = new WhatsappOrchestratorService(
    { getEffectiveConfig: async () => cfg } as never, {} as never, catalog, {} as never,
    conversations as never, { getStatus: async () => ({ isOpen: true, message: 'Abierto', openTime: '00:00', closeTime: '23:59' }) } as never,
    {} as never, {} as never, new WhatsappActionGuardService(catalog), new WhatsappPointsService({} as never),
    {} as never, agent as never, new WhatsappTurnTelemetryService(),
  ) as any;
  service.reply = async (_conv: unknown, _waId: string, reply: string) => { replies.push(reply); history.push(`Bot: ${reply}`); };
  const send = async (text: string) => {
    await service.handleIncomingUnlocked({ waId: 'customer', phoneE164: conv.phoneE164,
      messageId: `test-${count}`, messageType: 'text', text, raw: {} });
    return replies[replies.length - 1];
  };
  return { conv, send, agent, replies, service };
}

describe('Real chat: quantities survive clarification turns', () => {
  const journeys = [1, 2].flatMap(quantity => ['named', 'numbered'].flatMap(choice =>
    [false, true].flatMap(chickenFirst => [0, 1].map(existingSoups =>
      ({ quantity, choice, chickenFirst, existingSoups })))));
  it.each(journeys)('sequential journey q=$quantity choice=$choice chickenFirst=$chickenFirst existing=$existingSoups', async scenario => {
    const h = harness();
    if (scenario.existingSoups) {
      const p = products.find(p => p.id === 38);
      h.conv.sessionData.cart = [{ productId: p.id, name: p.name, code: p.code,
        unitPrice: p.price, quantity: 1, attributes: [] }];
    }
    let soupCount = scenario.existingSoups, chickenCount = 0;
    const assertCart = () => expect(h.conv.sessionData.cart.map(c => [c.productId, c.quantity]).sort((a,b) => a[0]-b[0]))
      .toEqual([[1, chickenCount], [38, soupCount]].filter(c => c[1] > 0));
    const chicken = async () => {
      h.agent.runTurn.mockResolvedValue({ reply: 'Listo', toolCalls: ['add_item'], actions: {
        addItems: [{ productId: 1, quantity: 3 }, { productId: 38, quantity: 1 }],
        setCustomerNotes: 'cubiertos',
      }});
      await h.send('Tres pollos fritos'); chickenCount = 3; assertCart();
    };
    if (scenario.chickenFirst) await chicken();
    await h.send(`Quiero ${scenario.quantity === 1 ? 'una sopa' : 'dos sopas'}`); assertCart();
    const row = h.conv.sessionData.pendingMatch!.candidates.findIndex(p => p.id === 38) + 1;
    await h.send(scenario.choice === 'named' ? 'Ajiaco' : String(row));
    soupCount += scenario.quantity; assertCart();
    if (!scenario.chickenFirst) await chicken();
    await h.send('No mas'); assertCart();
    expect(h.conv.state).toBe('awaiting_payment');
    await h.send('1'); assertCart();
    expect(h.conv.state).toBe('awaiting_final_confirm');
    expect(h.conv.customerName).toBe('Wilmer');
  });
  it.each([
    { name: 'clean actions', actions: { addItems: [{ productId: 1, quantity: 3 }] } },
    { name: 'replayed soup from history', actions: { addItems: [{ productId: 38, quantity: 1 }, { productId: 1, quantity: 3 }] } },
    { name: 'replayed soup with a note update', actions: { addItems: [{ productId: 38, quantity: 1 }, { productId: 1, quantity: 3 }], setCustomerNotes: 'enviar cubiertos' } },
  ])('preserves numbered soup selection through chicken and checkout: $name', async ({ actions }) => {
    const h = harness();
    await h.send('Quiero dos sopas');
    const row = h.conv.sessionData.pendingMatch!.candidates.findIndex(p => p.id === 38) + 1;
    await h.send(String(row));
    expect(h.conv.sessionData.cart.map(c => [c.productId, c.quantity])).toEqual([[38, 2]]);
    h.agent.runTurn.mockResolvedValue({ reply: 'Listo', actions, toolCalls: ['add_item'] });
    await h.send('Tres pollos fritos');
    expect(h.conv.sessionData.cart.map(c => [c.productId, c.quantity])).toEqual([[38, 2], [1, 3]]);
    const before = structuredClone(h.conv.sessionData.cart);
    await h.send('No mas');
    expect(h.conv.sessionData.cart).toEqual(before);
  });
  it('keeps three chickens, then adds two ajiacos without losing the chickens', async () => {
    const h = harness();
    await h.send('Quiero Tres pillos');
    expect(h.conv.sessionData.pendingMatch?.quantity).toBe(3);
    await h.send('Fritos');
    expect(h.conv.sessionData.cart.map(c => [c.productId, c.quantity])).toEqual([[1, 3]]);
    await h.send('Dos sopas');
    expect(h.conv.sessionData.pendingMatch?.quantity).toBe(2);
    await h.send('Ajiaco');
    expect(h.conv.sessionData.cart.map(c => [c.productId, c.quantity])).toEqual([[1, 3], [38, 2]]);
  });

  it('does not emit a phantom add or silently select chicken preparation', async () => {
    const h = harness();
    h.agent.runTurn.mockResolvedValue({ reply: 'Listo, agregué tres pollos fritos. ¿Algo más?', actions: {}, toolCalls: [] });
    await h.send('Quiero Tres pollos');
    expect(h.conv.sessionData.cart).toEqual([]);
    expect(h.conv.sessionData.pendingMatch?.quantity).toBe(3);
    expect(h.replies.at(-1)).not.toMatch(/agregué/);
  });

  it('does not let model actions choose an unspecified chicken or soup', async () => {
    const h = harness();
    h.agent.runTurn.mockResolvedValue({ reply: 'Listo', actions: { addItems: [{ productId: 1, quantity: 1 }] }, toolCalls: ['add_item'] });
    await h.send('Quiero tres pollos');
    expect(h.agent.runTurn).not.toHaveBeenCalled();
    expect(h.conv.sessionData.cart).toEqual([]);
    await h.send('Fritos');
    await h.send('Dos sopas');
    expect(h.agent.runTurn).not.toHaveBeenCalled();
    expect(h.conv.sessionData.cart.map(c => [c.productId, c.quantity])).toEqual([[1, 3]]);
  });

  it.each(['Fritos', 'Los quiero fritos', 'Fritos porfa'])('keeps three chickens when the clarification is "%s"', async choice => {
    const h = harness();
    h.agent.runTurn.mockResolvedValue({ reply: 'Listo', actions: { addItems: [{ productId: 1, quantity: 1 }] }, toolCalls: ['add_item'] });
    await h.send('Quiero tres pollos');
    await h.send(choice);
    expect(h.conv.sessionData.cart.map(c => [c.productId, c.quantity])).toEqual([[1, 3]]);
  });

  it.each(['Ajiaco', 'Ajiaco porfa', 'Las dos de ajiaco'])('keeps two soups when the clarification is "%s"', async choice => {
    const h = harness();
    h.agent.runTurn.mockResolvedValue({ reply: 'Listo', actions: { addItems: [{ productId: 38, quantity: 1 }] }, toolCalls: ['add_item'] });
    await h.send('Dos sopas');
    await h.send(choice);
    expect(h.conv.sessionData.cart.map(c => [c.productId, c.quantity])).toEqual([[38, 2]]);
  });

  it('uses a numbered choice as a row, without changing the two requested soups', async () => {
    const h = harness();
    await h.send('Dos sopas');
    const row = h.conv.sessionData.pendingMatch!.candidates.findIndex(p => p.id === 38) + 1;
    await h.send(String(row));
    expect(h.conv.sessionData.cart.map(c => [c.productId, c.quantity])).toEqual([[38, 2]]);
  });

  it('reset clears pending selections and their quantities as well as the cart', async () => {
    const h = harness();
    await h.send('Quiero tres pollos');
    await h.send('Reiniciar');
    expect(h.conv.sessionData.pendingMatch).toBeUndefined();
    expect(h.conv.sessionData.pendingQuantityHint).toBeUndefined();
    expect(h.conv.sessionData.cart).toEqual([]);
    await h.send('Dos sopas');
    await h.send('Ajiaco');
    expect(h.conv.sessionData.cart.map(c => [c.productId, c.quantity])).toEqual([[38, 2]]);
  });

  it.each(['Listo, agregué el ajiaco.', 'Listo, añadí el ajiaco.', 'He agregado el ajiaco.'])('rejects an unexecuted "%s" for a specific order', async reply => {
    const h = harness();
    h.agent.runTurn.mockResolvedValue({ reply, actions: {}, toolCalls: [] });
    await h.send('Quiero un ajiaco');
    expect(h.conv.sessionData.cart.map(c => [c.productId, c.quantity])).toEqual([[38, 1]]);
    expect(h.replies.at(-1)).not.toBe(reply);
  });

  it('preserves a specific order quantity even if the model asks to add only one', async () => {
    const h = harness();
    h.agent.runTurn.mockResolvedValue({ reply: 'Listo', actions: { addItems: [{ productId: 1, quantity: 1 }] }, toolCalls: ['add_item'] });
    await h.send('Quiero tres pollos fritos');
    expect(h.conv.sessionData.cart.map(c => [c.productId, c.quantity])).toEqual([[1, 3]]);
  });

  it('availability questions do not turn into orders', async () => {
    const h = harness();
    await h.send('¿Tienen tres pollos?');
    expect(h.conv.sessionData.cart).toEqual([]);
    expect(h.conv.sessionData.pendingMatch?.intent).not.toBe('order');
  });

  it('preserves existing dishes and their kitchen notes through both clarifications', async () => {
    const h = harness();
    const p = products.find(p => p.id === 17);
    h.conv.sessionData.cart = [{ productId: p.id, name: p.name, code: p.code, unitPrice: p.price,
      quantity: 2, note: 'sin ensalada', attributes: [] }];
    const existing = structuredClone(h.conv.sessionData.cart[0]);
    await h.send('Quiero Tres pillos');
    await h.send('Fritos');
    await h.send('Dos sopas');
    await h.send('Ajiaco');
    expect(h.conv.sessionData.cart[0]).toEqual(existing);
    expect(h.conv.sessionData.cart.slice(1).map(c => [c.productId, c.quantity])).toEqual([[1, 3], [38, 2]]);
  });
});
