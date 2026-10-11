import { readFileSync } from 'fs';
import { join } from 'path';
import { WhatsappOrchestratorService } from './whatsapp-orchestrator.service';
import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { WhatsappActionGuardService } from './whatsapp-action-guard.service';
import { WhatsappPointsService } from './whatsapp-points.service';
import { WhatsappTurnTelemetryService } from './whatsapp-turn-telemetry.service';
import type { WhatsappSessionData } from './types/whatsapp-session.types';
import { DEFAULT_PAYMENT_METHODS } from './whatsapp-payment-methods';

const products = JSON.parse(
  readFileSync(join(__dirname, '../../scripts/fixtures/whatsapp-beta-menu.json'), 'utf8'),
);

const andes = [
  { id: 910, code: 910, name: 'Pollo Frito Andino', categoryName: 'Pollos', price: 30000, hasAttributes: true, attributes: [{ attributeName: 'Acompanante', options: ['Arroz', 'Papa'] }], availableNow: true },
  { id: 911, code: 911, name: 'Pollo Broaster Andino', categoryName: 'Pollos', price: 32000, hasAttributes: true, attributes: [{ attributeName: 'Acompanante', options: ['Arroz', 'Papa'] }], availableNow: true },
  { id: 912, code: 912, name: 'Sopa De Lentejas', categoryName: 'Sopas', price: 8000, hasAttributes: false, attributes: [], availableNow: true },
  { id: 913, code: 913, name: 'Sopa De Verduras', categoryName: 'Sopas', price: 8000, hasAttributes: false, attributes: [], availableNow: true },
  { id: 914, code: 914, name: 'Bowl Andino', categoryName: 'Bowls', price: 18000, hasAttributes: true, attributes: [{ attributeName: 'Base', options: ['Quinoa', 'Arroz'] }], availableNow: true },
  { id: 915, code: 915, name: 'Bowl Costeno', categoryName: 'Bowls', price: 19000, hasAttributes: true, attributes: [{ attributeName: 'Base', options: ['Quinoa', 'Arroz'] }], availableNow: true },
];

function harness(menu = products, agentEnabled = false) {
  let count = 0;
  const conv = {
    id: 1,
    waId: 'customer',
    phoneE164: '+573000000001',
    customerName: 'Wilmer',
    state: 'building_cart',
    sessionData: { cart: [], orderType: 'pickup' } as WhatsappSessionData,
  };
  const replies: string[] = [];
  const history: string[] = [];
  const conversations = {
    findOrCreateConversation: async () => conv,
    touchInbound: async () => undefined,
    claimInboundMessage: async ({ body }: { body: string }) => {
      count++;
      history.push(`Cliente: ${body}`);
      return { id: count };
    },
    reloadConversation: async () => structuredClone(conv),
    getSession: () => structuredClone(conv.sessionData),
    saveSession: async (_conv: unknown, session: WhatsappSessionData, state?: string) => {
      conv.sessionData = structuredClone(session);
      if (state) conv.state = state;
    },
    resetOrderSession: async () => {
      conv.sessionData = { cart: [], orderType: 'pickup', ignorePriorOrderHistory: true };
      conv.state = 'building_cart';
    },
    countInboundMessages: async () => count + 1,
    getRecentMessageTexts: async () => history,
    getLastOutboundBody: async () => replies.at(-1) || null,
    updateCustomerName: async (_conv: unknown, name: string) => {
      conv.customerName = name;
    },
  };
  const catalog = new WhatsappCatalogService({} as never);
  jest.spyOn(catalog, 'getMenuProducts').mockResolvedValue(menu);
  const agent = {
    runTurn: jest.fn().mockResolvedValue({ reply: '¿Cuál prefieres?', actions: {}, toolCalls: [] }),
  };
  const cfg = {
    enabled: true,
    agentV1Enabled: agentEnabled,
    ignoreBusinessHours: true,
    brandName: 'PPP',
    localContext: {},
    paymentMethods: DEFAULT_PAYMENT_METHODS,
    menuConceptGroups: [],
    deliveryFeeMode: 'fixed',
    defaultDeliveryFee: 2000,
  };
  const service = new WhatsappOrchestratorService(
    { getEffectiveConfig: async () => cfg } as never,
    {} as never,
    catalog,
    {} as never,
    conversations as never,
    { getStatus: async () => ({ isOpen: true, message: 'Abierto', openTime: '00:00', closeTime: '23:59' }) } as never,
    {} as never,
    {} as never,
    new WhatsappActionGuardService(catalog),
    new WhatsappPointsService({} as never),
    {} as never,
    agent as never,
    new WhatsappTurnTelemetryService(),
  ) as any;
  service.reply = async (_conv: unknown, _waId: string, reply: string) => {
    replies.push(reply);
    history.push(`Bot: ${reply}`);
  };
  const send = async (text: string) => {
    await service.handleIncomingUnlocked({
      waId: 'customer',
      phoneE164: conv.phoneE164,
      messageId: `amb-${count}`,
      messageType: 'text',
      text,
      raw: {},
    });
    return replies[replies.length - 1];
  };
  const cartRows = () =>
    conv.sessionData.cart.map((c) => ({
      id: c.productId,
      qty: c.quantity,
      note: c.note,
      attrs: (c.attributes || []).map((a) => `${a.attributeName}:${a.attributeValue}`),
    }));
  return { conv, send, replies, cartRows, service };
}

describe('Ambiguous short answers stay unresolved — PPP and another menu', () => {
  it('eso with an empty cart does not invent a PPP dish', async () => {
    const h = harness(products);
    const reply = await h.send('Quiero eso');
    expect(h.cartRows()).toEqual([]);
    expect(reply).not.toMatch(/listo ✅/i);
  });

  it('eso with an empty cart does not invent a bowl', async () => {
    const h = harness(andes);
    const reply = await h.send('Quiero eso');
    expect(h.cartRows()).toEqual([]);
    expect(reply).not.toMatch(/listo ✅/i);
  });

  it('dale does not pick the first chicken while soup is still open', async () => {
    const h = harness(products);
    await h.send('Me regalas dos pollos y una sopa');
    const held = structuredClone(h.conv.sessionData.pendingMultiOrder);
    const reply = await h.send('Dale');
    expect(h.cartRows()).toEqual([]);
    expect(h.conv.sessionData.pendingMultiOrder).toEqual(held);
    expect(reply).toMatch(/conservo|elegir|cu[aá]l|falta|frito|broaster|sopa|pendiente/i);
  });

  it('ok does not pick the first family on another menu', async () => {
    const h = harness(andes);
    await h.send('Quiero dos pollos y una sopa');
    const held = structuredClone(h.conv.sessionData.pendingMultiOrder);
    await h.send('Ok');
    expect(h.cartRows()).toEqual([]);
    expect(h.conv.sessionData.pendingMultiOrder).toEqual(held);
  });

  it('no during a chicken style choice does not add a chicken', async () => {
    const h = harness(products);
    await h.send('Quiero un pollo');
    expect(h.cartRows()).toEqual([]);
    const reply = await h.send('No');
    expect(h.cartRows()).toEqual([]);
    expect(reply).not.toMatch(/listo ✅ \*1 pollo/i);
  });

  it('el otro with two chicken lines asks which line', async () => {
    const h = harness(products);
    h.conv.sessionData.cart = [
      { productId: 1, code: 1, name: '1 Pollo Frito', unitPrice: 41000, quantity: 1, attributes: [{ attributeName: 'Arepas', attributeValue: 'Blancas' }] },
      { productId: 4, code: 4, name: '1 Pollo Broaster', unitPrice: 43000, quantity: 1, attributes: [{ attributeName: 'Arepas', attributeValue: 'Blancas' }] },
    ];
    const before = structuredClone(h.cartRows());
    const reply = await h.send('El otro con arepas fritas');
    expect(h.cartRows()).toEqual(before);
    expect(reply).toMatch(/cu[aá]l|qu[eé] (?:pollo|producto|plato)/i);
  });

  it('el otro with two bowls asks which line', async () => {
    const h = harness(andes);
    h.conv.sessionData.cart = [
      { productId: 914, code: 914, name: 'Bowl Andino', unitPrice: 18000, quantity: 1, attributes: [{ attributeName: 'Base', attributeValue: 'Arroz' }] },
      { productId: 915, code: 915, name: 'Bowl Costeno', unitPrice: 19000, quantity: 1, attributes: [{ attributeName: 'Base', attributeValue: 'Arroz' }] },
    ];
    const before = structuredClone(h.cartRows());
    const reply = await h.send('El otro con quinoa');
    expect(h.cartRows()).toEqual(before);
    expect(reply).toMatch(/cu[aá]l|qu[eé] (?:bowl|producto|plato)/i);
  });

  it('quita eso with two PPP lines asks which one', async () => {
    const h = harness(products);
    h.conv.sessionData.cart = [
      { productId: 17, code: 17, name: 'Churrasco', unitPrice: 28000, quantity: 1, attributes: [] },
      { productId: 38, code: 38, name: 'Sopa De Ajiaco', unitPrice: 10500, quantity: 1, attributes: [] },
    ];
    const before = structuredClone(h.cartRows());
    const reply = await h.send('Quita eso');
    expect(h.cartRows()).toEqual(before);
    expect(reply).toMatch(/cu[aá]l|qu[eé]|cu[aá]l de/i);
  });

  it('quita eso with two bowls asks which one', async () => {
    const h = harness(andes);
    h.conv.sessionData.cart = [
      { productId: 914, code: 914, name: 'Bowl Andino', unitPrice: 18000, quantity: 1, attributes: [] },
      { productId: 915, code: 915, name: 'Bowl Costeno', unitPrice: 19000, quantity: 1, attributes: [] },
    ];
    const before = structuredClone(h.cartRows());
    const reply = await h.send('Quita eso');
    expect(h.cartRows()).toEqual(before);
    expect(reply).toMatch(/cu[aá]l|qu[eé]/i);
  });

  it('sin alone does not add or wipe a PPP dish', async () => {
    const h = harness(products);
    await h.send('Quiero un churrasco');
    const before = structuredClone(h.cartRows());
    await h.send('Sin');
    expect(h.cartRows()).toEqual(before);
  });

  it('cambia alone does not replace a bowl', async () => {
    const h = harness(andes);
    await h.send('Quiero un Bowl Andino');
    const before = structuredClone(h.cartRows());
    await h.send('Cambia');
    expect(h.cartRows()).toEqual(before);
  });

  it('espera does not empty the PPP cart', async () => {
    const h = harness(products);
    await h.send('Quiero un churrasco');
    const before = structuredClone(h.cartRows());
    await h.send('Espera');
    expect(h.cartRows()).toEqual(before);
    expect(h.conv.state).not.toBe('completed');
  });

  it('como siempre does not invent a second bowl', async () => {
    const h = harness(andes);
    await h.send('Quiero un Bowl Andino');
    const before = structuredClone(h.cartRows());
    await h.send('Como siempre');
    expect(h.cartRows()).toHaveLength(1);
    expect(h.cartRows()[0].id).toBe(before[0].id);
  });

  it('cuánto with a PPP cart answers the total and does not add', async () => {
    const h = harness(products);
    await h.send('Quiero dos churrascos');
    const before = structuredClone(h.cartRows());
    const reply = await h.send('Cuánto?');
    expect(h.cartRows()).toEqual(before);
    expect(reply).toMatch(/\$|total|56|28/i);
  });

  it('cuánto with another menu cart does not add a second bowl', async () => {
    const h = harness(andes);
    await h.send('Quiero un Bowl Andino');
    const before = structuredClone(h.cartRows());
    await h.send('Cuánto vale?');
    expect(h.cartRows()).toEqual(before);
  });

  it('a person name during a PPP cart is not a dish', async () => {
    const h = harness(products);
    await h.send('Quiero un churrasco');
    const before = structuredClone(h.cartRows());
    await h.send('Sandra');
    expect(h.cartRows()).toEqual(before);
  });

  it('sopa after an ejecutivo does not add a standalone soup', async () => {
    const h = harness(products);
    await h.send('Un ejecutivo con pollo frito');
    const beforeIds = h.cartRows().map(row => row.id);
    expect(beforeIds.some(id => id === 22 || id === 18)).toBe(true);
    await h.send('Sopa');
    expect(h.cartRows().some(row => row.id === 38 || row.id === 20 || row.id === 45)).toBe(false);
    expect(h.cartRows().map(row => row.id)).toEqual(beforeIds);
  });

  it('frito with two already-chosen chickens asks which line', async () => {
    const h = harness(products);
    h.conv.sessionData.cart = [
      { productId: 1, code: 1, name: '1 Pollo Frito', unitPrice: 41000, quantity: 1, attributes: [{ attributeName: 'Arepas', attributeValue: 'Blancas' }] },
      { productId: 4, code: 4, name: '1 Pollo Broaster', unitPrice: 43000, quantity: 1, attributes: [{ attributeName: 'Arepas', attributeValue: 'Blancas' }] },
    ];
    const before = structuredClone(h.cartRows());
    await h.send('Frito');
    expect(h.cartRows()).toEqual(before);
  });

  it('medio while paying does not replace a steak with half chicken', async () => {
    const h = harness(products);
    await h.send('Quiero un churrasco');
    h.conv.state = 'awaiting_payment';
    h.conv.sessionData.paymentMethod = undefined;
    const before = structuredClone(h.cartRows());
    await h.send('Medio');
    expect(h.cartRows()).toEqual(before);
    expect(h.cartRows().some(row => row.id === 2 || row.id === 5)).toBe(false);
  });

  it('uno de cada keeps both open PPP quantities', async () => {
    const h = harness(products);
    await h.send('Me regalas dos pollos y una sopa');
    const held = structuredClone(h.conv.sessionData.pendingMultiOrder);
    await h.send('Uno de cada');
    expect(h.cartRows()).toEqual([]);
    expect(h.conv.sessionData.pendingMultiOrder?.ambiguous.length).toBe(held?.ambiguous.length);
  });

  it('pickup and delivery in the same line does not create two carts', async () => {
    const h = harness(products);
    await h.send('Quiero un churrasco para recoger y también domicilio');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 17, qty: 1 })]);
    expect(['pickup', 'delivery']).toContain(h.conv.sessionData.orderType);
  });

  it('más after one bowl adds the same bowl or asks, never a second family', async () => {
    const h = harness(andes);
    await h.send('Quiero un Bowl Andino');
    await h.send('Más');
    expect(h.cartRows().every(row => row.id === 914)).toBe(true);
    expect(h.cartRows().some(row => row.id === 915)).toBe(false);
  });
});

describe('Short follow-ups must not invent a dish', () => {
  it.each([
    [products, 'Quiero un churrasco', 17],
    [andes, 'Quiero un Bowl Andino', 914],
  ])('no gracias leaves the current dish', async (menu, order, id) => {
    const h = harness(menu as never);
    await h.send(order);
    const before = structuredClone(h.cartRows());
    await h.send('No gracias');
    expect(h.cartRows()).toEqual(before);
    expect(h.cartRows()[0].id).toBe(id);
    expect(h.conv.state).not.toBe('completed');
  });

  it.each([['ppp', products], ['andes', andes]] as const)('listo does not close an order while two choices are open (%s)', async (label, menu) => {
    const h = harness(menu as never);
    await h.send(label === 'ppp' ? 'Me regalas dos pollos y una sopa' : 'Quiero dos pollos y una sopa');
    const held = structuredClone(h.conv.sessionData.pendingMultiOrder);
    expect(held?.ambiguous.length).toBeGreaterThanOrEqual(2);
    await h.send('Listo');
    expect(h.cartRows()).toEqual([]);
    expect(h.conv.state).not.toBe('completed');
    expect(h.conv.sessionData.pendingMultiOrder).toEqual(held);
  });

  it.each([['ppp', products], ['andes', andes]] as const)('el primero with nothing pending adds nothing (%s)', async (_label, menu) => {
    const h = harness(menu as never);
    const reply = await h.send('El primero');
    expect(h.cartRows()).toEqual([]);
    expect(reply).not.toMatch(/listo ✅/i);
  });

  it.each([
    [products, 'Quiero un churrasco', 17],
    [andes, 'Quiero un Bowl Andino', 914],
  ])('lo mismo does not duplicate the dish', async (menu, order, id) => {
    const h = harness(menu as never);
    await h.send(order);
    await h.send('Lo mismo');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id, qty: 1 })]);
  });

  it.each([
    [products, 'Quiero un churrasco', 17],
    [andes, 'Quiero un Bowl Andino', 914],
  ])('otro igual adds one more of the same dish', async (menu, order, id) => {
    const h = harness(menu as never);
    await h.send(order);
    await h.send('Otro igual');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id, qty: 2 })]);
  });

  it.each([['ppp', products, 'Quiero un churrasco'], ['andes', andes, 'Quiero un Bowl Andino']] as const)('mañana is not a dish and not a completed order (%s)', async (_label, menu, order) => {
    const h = harness(menu as never);
    await h.send(order);
    const before = structuredClone(h.cartRows());
    await h.send('Mañana');
    expect(h.cartRows()).toEqual(before);
    expect(h.conv.state).not.toBe('completed');
  });

  it('y de tomar does not add a drink on PPP', async () => {
    const h = harness(products);
    await h.send('Quiero un churrasco');
    const before = structuredClone(h.cartRows());
    await h.send('Y de tomar?');
    expect(h.cartRows()).toEqual(before);
  });

  it('y de tomar does not add a drink on another menu', async () => {
    const h = harness(andes);
    await h.send('Quiero un Bowl Andino');
    const before = structuredClone(h.cartRows());
    await h.send('Y de tomar?');
    expect(h.cartRows()).toEqual(before);
  });

  it.each([['ppp', products], ['andes', andes]] as const)('código without a number adds nothing (%s)', async (_label, menu) => {
    const h = harness(menu as never);
    await h.send('Código');
    expect(h.cartRows()).toEqual([]);
  });

  it.each([
    [products, 'Quiero un churrasco'],
    [andes, 'Quiero un Bowl Andino'],
  ])('está bien así keeps the cart', async (menu, order) => {
    const h = harness(menu as never);
    await h.send(order);
    const before = structuredClone(h.cartRows());
    await h.send('Está bien así');
    expect(h.cartRows()).toEqual(before);
    expect(h.conv.state).not.toBe('completed');
  });

  it.each([
    [products, 'Quiero un churrasco'],
    [andes, 'Quiero un Bowl Andino'],
  ])('sin nada does not wipe the dish', async (menu, order) => {
    const h = harness(menu as never);
    await h.send(order);
    const before = structuredClone(h.cartRows());
    await h.send('Sin nada');
    expect(h.cartRows()).toHaveLength(1);
    expect(h.cartRows()[0].id).toBe(before[0].id);
    expect(h.cartRows()[0].qty).toBe(before[0].qty);
  });

  it.each([
    [products, 'Quiero un churrasco'],
    [andes, 'Quiero un Bowl Andino'],
  ])('hoy no does not wipe the cart', async (menu, order) => {
    const h = harness(menu as never);
    await h.send(order);
    const before = structuredClone(h.cartRows());
    await h.send('Hoy no');
    expect(h.cartRows()).toEqual(before);
  });

  it('para la mesa is not a delivery address', async () => {
    const h = harness(products);
    await h.send('Quiero un churrasco');
    await h.send('Para la mesa 4');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 17, qty: 1 })]);
    expect(h.conv.sessionData.address || '').not.toMatch(/mesa\s*4/i);
    expect(h.conv.sessionData.orderType).not.toBe('delivery');
  });

  it('para la mesa is not a delivery address on another menu', async () => {
    const h = harness(andes);
    await h.send('Quiero un Bowl Andino');
    await h.send('Para la mesa 4');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 914, qty: 1 })]);
    expect(h.conv.sessionData.address || '').not.toMatch(/mesa\s*4/i);
  });

  it.each([['ppp', products], ['andes', andes]] as const)('dos de esos keeps the open choice and does not add a random dish (%s)', async (_label, menu) => {
    const h = harness(menu as never);
    await h.send('Quiero un pollo');
    expect(h.cartRows()).toEqual([]);
    const held = structuredClone(h.conv.sessionData.pendingMatch || h.conv.sessionData.pendingMultiOrder || null);
    const reply = await h.send('Dos de esos');
    expect(h.cartRows()).toEqual([]);
    expect(reply).not.toMatch(/listo ✅ \*/i);
    if (held) {
      const pending = h.conv.sessionData.pendingMatch || h.conv.sessionData.pendingMultiOrder;
      expect(pending).toBeTruthy();
      if (h.conv.sessionData.pendingMatch) {
        expect(h.conv.sessionData.pendingMatch.quantity).toBe(2);
      }
    }
  });

  it('el más barato does not add every soup', async () => {
    const h = harness(products);
    await h.send('Quiero una sopa');
    expect(h.cartRows()).toEqual([]);
    await h.send('El más barato');
    expect(h.cartRows().length).toBeLessThanOrEqual(1);
  });

  it('el más barato does not add every soup on another menu', async () => {
    const h = harness(andes);
    await h.send('Quiero una sopa');
    expect(h.cartRows()).toEqual([]);
    await h.send('El más barato');
    expect(h.cartRows().length).toBeLessThanOrEqual(1);
  });

  it('mitad frito mitad broaster is two half chickens on PPP', async () => {
    const h = harness(products);
    await h.send('Mitad frito mitad broaster');
    const rows = h.cartRows().map(row => `${row.id}:${row.qty}`).sort();
    expect(rows).toEqual(['2:1', '5:1']);
  });

  it('mitad frito mitad broaster is two halves on another menu', async () => {
    const menu = [
      { id: 920, code: 920, name: '1 Pollo Frito Andino', categoryName: 'Pollos', price: 30000, hasAttributes: false, attributes: [], availableNow: true },
      { id: 921, code: 921, name: '1 Pollo Broaster Andino', categoryName: 'Pollos', price: 32000, hasAttributes: false, attributes: [], availableNow: true },
      { id: 922, code: 922, name: '1/2 Pollo Frito Andino', categoryName: 'Pollos', price: 16000, hasAttributes: false, attributes: [], availableNow: true },
      { id: 923, code: 923, name: '1/2 Pollo Broaster Andino', categoryName: 'Pollos', price: 17000, hasAttributes: false, attributes: [], availableNow: true },
    ];
    const h = harness(menu);
    await h.send('Mitad frito mitad broaster');
    const rows = h.cartRows().map(row => `${row.id}:${row.qty}`).sort();
    expect(rows).toEqual(['922:1', '923:1']);
  });

  it('para dos after one steak becomes quantity 2', async () => {
    const h = harness(products);
    await h.send('Quiero un churrasco');
    await h.send('Para dos');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 17, qty: 2 })]);
  });

  it('para dos after one bowl becomes quantity 2', async () => {
    const h = harness(andes);
    await h.send('Quiero un Bowl Andino');
    await h.send('Para dos');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 914, qty: 2 })]);
  });
});
