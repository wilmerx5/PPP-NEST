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

function harness() {
  let count = 0;
  const conv = {
    id: 1, waId: 'customer', phoneE164: '+573000000001', customerName: 'Wilmer', state: 'awaiting_payment',
    sessionData: {
      cart: [{ productId: 17, name: 'Churrasco', code: 17, unitPrice: 38000, quantity: 2, attributes: [], note: 'sin ensalada' }],
      orderType: 'delivery', fulfillmentChosen: true, addressConfirmed: true,
      address: 'Dg 6 b #78 b 20, Castilla, Bogotá', deliveryFeeCalculated: 4000,
    } as WhatsappSessionData,
  };
  const replies: string[] = [];
  const conversations = {
    findOrCreateConversation: async () => conv,
    touchInbound: async () => undefined,
    claimInboundMessage: async () => ({ id: ++count }),
    reloadConversation: async () => structuredClone(conv),
    getSession: () => structuredClone(conv.sessionData),
    saveSession: async (_conv: unknown, session: WhatsappSessionData, state?: string) => {
      conv.sessionData = structuredClone(session); if (state) conv.state = state;
    },
    countInboundMessages: async () => count + 1,
    getRecentMessageTexts: async () => [],
    getLastOutboundBody: async () => replies.at(-1) || null,
    updateCustomerName: async () => undefined,
  };
  const catalog = new WhatsappCatalogService({} as never);
  jest.spyOn(catalog, 'getMenuProducts').mockResolvedValue(products);
  const agent = { runTurn: jest.fn().mockResolvedValue({ reply: '¿Cuál prefieres?', actions: {}, toolCalls: [] }) };
  const deliveryRouting = { quoteDeliveryFee: jest.fn().mockResolvedValue({
    ok: true, fee: 4500, distanceKm: 2.2, source: 'google_directions', customer: { lat: 4.65, lng: -74.1 },
  }) };
  const cfg = { enabled: true, agentV1Enabled: true, ignoreBusinessHours: true, brandName: 'PPP',
    localContext: {}, paymentMethods: DEFAULT_PAYMENT_METHODS, menuConceptGroups: [], defaultDeliveryFee: 4000,
    deliveryFeeMode: 'distance', deliveryFeeTiers: [], restaurantLat: 4.6, restaurantLng: -74.08 };
  const service = new WhatsappOrchestratorService(
    { getEffectiveConfig: async () => cfg } as never, {} as never, catalog, {} as never,
    conversations as never, { getStatus: async () => ({ isOpen: true, message: 'Abierto', openTime: '00:00', closeTime: '23:59' }) } as never,
    {} as never, {} as never, new WhatsappActionGuardService(catalog), new WhatsappPointsService({} as never),
    deliveryRouting as never, agent as never, new WhatsappTurnTelemetryService(),
  ) as any;
  service.reply = async (_conv: unknown, _waId: string, reply: string) => { replies.push(reply); };
  const send = (text: string) => service.handleIncomingUnlocked({
    waId: 'customer', phoneE164: conv.phoneE164, messageId: `test-${count}`, messageType: 'text', text, raw: {},
  });
  return { conv, send, agent, replies, deliveryRouting, cfg };
}

describe('Address changes during checkout', () => {
  it('requotes a new street while payment is being chosen and keeps the cart', async () => {
    const h = harness();
    await h.send('Cambia la direccion a cll 6 b 81 b 51, Castilla, Bogotá');
    expect(h.agent.runTurn).not.toHaveBeenCalled();
    expect(h.conv.sessionData.address?.toLowerCase()).toContain('81');
    expect(h.conv.sessionData.deliveryFeeCalculated).toBe(4500);
    expect(h.conv.sessionData.cart).toEqual([
      expect.objectContaining({ productId: 17, quantity: 2, note: 'sin ensalada' }),
    ]);
    expect(h.conv.sessionData.paymentMethod).toBeUndefined();
    expect(h.conv.state).not.toBe('completed');
    expect(h.replies.at(-1)).toMatch(/direcci[oó]n actualizada/i);
  });

  it('still accepts a cash choice after the address was quoted', async () => {
    const h = harness();
    await h.send('1');
    expect(h.conv.sessionData.address).toContain('78');
    expect(h.conv.sessionData.paymentMethod).toBeTruthy();
    expect(h.conv.state).not.toBe('completed');
  });
});


describe('Checkout interruptions preserve the order', () => {
  it.each(['awaiting_payment', 'awaiting_final_confirm', 'confirming'])('corrects a typo address in %s and resumes checkout', async state => {
    const h = harness();
    h.conv.state = state;
    if (state !== 'awaiting_payment') h.conv.sessionData.paymentMethod = 'cash';
    const before = structuredClone(h.conv.sessionData.cart);
    await h.send('Cambiar la direction a d2 b 79 a. 86');
    expect(h.agent.runTurn).not.toHaveBeenCalled();
    expect(h.conv.sessionData.address).toContain('79');
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.conv.sessionData.deliveryFeeCalculated).toBe(4500);
    expect(h.conv.state).toBe(state === 'awaiting_payment' ? 'awaiting_payment' : 'awaiting_final_confirm');
    expect(h.replies.at(-1)).toMatch(/direcci[oó]n actualizada/i);
  });

  it.each(['Para el hotel santandereano', 'Para ek hotel santandereano', 'Calle 48 sur 87 86'])('address after products advances to payment: %s', async address => {
    const h = harness();
    h.conv.state = 'building_cart';
    h.conv.sessionData.address = undefined;
    h.conv.sessionData.addressConfirmed = false;
    const before = structuredClone(h.conv.sessionData.cart);
    await h.send(address);
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.conv.sessionData.address).toBeTruthy();
    expect(h.conv.state).toBe('awaiting_payment');
    expect(h.replies.at(-1)).toMatch(/cómo pagas/i);
    expect(h.agent.runTurn).not.toHaveBeenCalled();
  });
});


describe('Address checkout boundaries', () => {
  it.each(['Cambia la direcion a Calle 12 34 56', 'Actualiza domicilio a Carrera 7 20 30', 'La direction es Calle 8 10 20'])('handles alternate correction phrasing: %s', async message => {
    const h = harness();
    await h.send(message);
    expect(h.conv.sessionData.address).not.toContain('78');
    expect(h.conv.state).toBe('awaiting_payment');
    expect(h.conv.sessionData.cart[0].quantity).toBe(2);
  });

  it('allows adding another product after the address shortcut', async () => {
    const h = harness();
    h.conv.state = 'building_cart';
    h.conv.sessionData.address = undefined;
    h.conv.sessionData.addressConfirmed = false;
    await h.send('Calle 48 sur 87 86');
    await h.send('Una sopa de ajiaco');
    expect(h.conv.sessionData.cart.find(item => item.productId === 17)?.quantity).toBe(2);
    expect(h.conv.sessionData.cart.find(item => item.productId === 38)?.quantity).toBe(1);
    expect(h.conv.sessionData.address).toContain('87');
  });

  it('asks for the missing customer name after an address, preserving the cart', async () => {
    const h = harness();
    h.conv.state = 'building_cart';
    h.conv.customerName = '';
    h.conv.sessionData.address = undefined;
    h.conv.sessionData.addressConfirmed = false;
    await h.send('Calle 48 sur 87 86');
    expect(h.conv.state).toBe('awaiting_name');
    expect(h.conv.sessionData.cart[0].quantity).toBe(2);
  });

  it('an address without products does not start payment', async () => {
    const h = harness();
    h.conv.state = 'building_cart';
    h.conv.sessionData.cart = [];
    h.conv.sessionData.address = undefined;
    h.conv.sessionData.addressConfirmed = false;
    await h.send('Calle 48 sur 87 86');
    expect(h.conv.state).not.toBe('awaiting_payment');
    expect(h.conv.sessionData.cart).toEqual([]);
  });

  it('a correction without its replacement asks for the new address', async () => {
    const h = harness();
    await h.send('Cambiar la direction');
    expect(h.conv.state).toBe('awaiting_address');
    expect(h.replies.at(-1)).toMatch(/nueva dirección/i);
    expect(h.conv.sessionData.cart[0].quantity).toBe(2);
  });
});


describe('Address does not discard unfinished product choices', () => {
  it('keeps the requested soup quantity through address and variant selection', async () => {
    const h = harness();
    h.conv.state = 'building_cart';
    h.conv.sessionData.address = undefined;
    h.conv.sessionData.addressConfirmed = false;
    await h.send('Dos sopas');
    expect(h.conv.sessionData.pendingMatch?.quantity).toBe(2);
    await h.send('Calle 48 sur 87 86');
    expect(h.conv.sessionData.pendingMatch?.quantity).toBe(2);
    expect(h.conv.state).not.toBe('awaiting_payment');
    await h.send('Ajiaco');
    expect(h.conv.sessionData.cart.find(item => item.productId === 38)?.quantity).toBe(2);
    expect(h.conv.sessionData.cart.find(item => item.productId === 17)?.quantity).toBe(2);
    expect(h.conv.sessionData.address).toContain('87');
  });
});


describe('Cross-stage correction matrix', () => {
  const cases = ['building_cart', 'awaiting_address', 'awaiting_payment', 'awaiting_name', 'awaiting_phone', 'awaiting_final_confirm']
    .flatMap(state => [undefined, 'cash', 'transfer'].map(payment => ({state, payment})));
  it.each(cases)('resumes $state with payment=$payment without changing items or notes', async ({state, payment}) => {
    const h = harness();
    h.conv.state = state;
    h.conv.sessionData.paymentMethod = payment;
    h.conv.sessionData.customerNotes = 'Llamar al llegar';
    h.conv.sessionData.cashChangeFor = payment === 'cash' ? 'cambio de 100000' : undefined;
    const cart = structuredClone(h.conv.sessionData.cart);
    await h.send('Actualiza la direction a Carrera 12 34 56');
    expect(h.conv.sessionData.address).toContain('34');
    expect(h.conv.sessionData.cart).toEqual(cart);
    expect(h.conv.sessionData.customerNotes).toBe('Llamar al llegar');
    expect(h.conv.sessionData.paymentMethod).toBe(payment);
    expect(h.conv.sessionData.cashChangeFor).toBe(payment === 'cash' ? 'cambio de 100000' : undefined);
    expect(h.conv.state).toBe(payment ? 'awaiting_final_confirm' : 'awaiting_payment');
  });
});


describe('Combined address and payment', () => {
  it.each(['Calle 48 sur 87 86, pago en efectivo', 'Calle 48 sur 87 86, pago por transferencia'])('retains payment already supplied with address: %s', async message => {
    const h = harness();
    h.conv.state = 'building_cart';
    h.conv.sessionData.address = undefined;
    h.conv.sessionData.addressConfirmed = false;
    await h.send(message);
    expect(h.conv.sessionData.address).toContain('87');
    expect(h.conv.sessionData.paymentMethod).toBeTruthy();
    expect(h.conv.state).toBe('awaiting_final_confirm');
    expect(h.conv.sessionData.cart[0].quantity).toBe(2);
  });
});


describe('Cash amount can answer the payment question', () => {
  it.each(['Pago con 100 mil', 'Efectivo, pago con 100000', 'Pagaré con 100.000', 'Pago con un billete de 100 mil'])('records cash and change in one turn: %s', async message => {
    const h = harness();
    await h.send(message);
    expect(h.conv.sessionData.paymentMethod).toBe('cash');
    expect(h.conv.sessionData.cashChangeFor).toMatch(/100/);
    expect(h.conv.state).toBe('awaiting_final_confirm');
    expect(h.conv.sessionData.cart[0].quantity).toBe(2);
  });
  it('a numbered payment option is not a cash amount', async () => {
    const h = harness();
    await h.send('1');
    expect(h.conv.sessionData.cashChangeFor).toBeUndefined();
  });
});


describe('Payment shortcut respects configured methods and questions', () => {
  it('does not select disabled cash', async () => {
    const h = harness();
    h.cfg.paymentMethods = DEFAULT_PAYMENT_METHODS.filter(method => method.id !== 'cash');
    await h.send('Pago con 100 mil');
    expect(h.conv.sessionData.paymentMethod).toBeUndefined();
    expect(h.conv.state).not.toBe('awaiting_final_confirm');
  });
  it('a question about cash is not a payment selection', async () => {
    const h = harness();
    await h.send('¿Puedo pagar con un billete de 100 mil?');
    expect(h.conv.sessionData.paymentMethod).toBeUndefined();
    expect(h.conv.state).not.toBe('awaiting_final_confirm');
  });
});


describe('Explicit option changes while choosing payment',()=>{
  it.each(['awaiting_payment','awaiting_final_confirm'])('changes a preparation in %s without losing checkout',async state=>{
    const h=harness();h.conv.state=state;
    if(state==='awaiting_final_confirm')h.conv.sessionData.paymentMethod='cash';
    h.conv.sessionData.cart=[{productId:13,name:'Sobrebarriga',code:13,unitPrice:33000,quantity:2,note:'sin ensalada',attributes:[{attributeName:'Seleccion',attributeValue:'Asada'}]}];
    await h.send('En salsa');
    expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:13,quantity:2,note:'sin ensalada',attributes:[{attributeName:'Seleccion',attributeValue:'En Salsa'}]})]);
    expect(h.conv.state).toBe(state);
  });
});
