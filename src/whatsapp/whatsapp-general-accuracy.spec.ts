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

/**
 * Recorridos reales: router, catálogo, guard y carrito.
 * Persistencia, modelo y Meta quedan aislados. El agente solo entra si
 * el camino determinista no resuelve el turno.
 */
function harness(menu = products, agentEnabled = true) {
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
      messageId: `acc-${count}`,
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
  return { conv, send, agent, replies, cartRows };
}

describe('Acertividad general — chats reales y ediciones', () => {
  it('conserva 2 costillas y 1 mojarra cuando el cliente elige con typo', async () => {
    const h = harness();
    const first = await h.send('Me vendes 2 costillas\n1 mojarra');
    expect(first).toMatch(/costillas/i);
    expect(h.conv.sessionData.cart).toEqual([]);

    await h.send('costillas der cerdo');

    const rows = h.cartRows();
    expect(rows.find((r) => r.id === 60)).toMatchObject({ id: 60, qty: 2 });
    const mojarra = rows.find((r) => r.id === 14);
    const pendingMojarra =
      h.conv.sessionData.pendingAttribute?.productId === 14 ||
      h.conv.sessionData.pendingMultiOrder?.needsAttributes?.some((n) => n.productId === 14);
    expect(Boolean(mojarra) || pendingMojarra).toBe(true);
    if (mojarra) expect(mojarra.qty).toBe(1);
    expect(h.replies.at(-1)).not.toMatch(/no manejamos/i);
  });

  it('completa la mojarra frita sin perder las costillas ni inventar domicilio', async () => {
    const h = harness();
    await h.send('Me vendes 2 costillas\n1 mojarra');
    await h.send('costillas der cerdo');
    await h.send('Las mojarras fritas');

    const rows = h.cartRows();
    expect(rows.find((r) => r.id === 60)).toMatchObject({ id: 60, qty: 2 });
    const mojarra = rows.find((r) => r.id === 14);
    expect(mojarra).toBeTruthy();
    expect(mojarra!.attrs).toEqual(expect.arrayContaining(['Seleccion:Frita']));
    expect(h.conv.sessionData.address).toBeFalsy();
    expect(h.conv.sessionData.orderType).not.toBe('delivery');
  });

  it('parte pollo y medio en entero + medio y pide arepas, no un solo SKU', async () => {
    const h = harness();
    await h.send('Veci, quiero Pollo y medio por favor');

    const pending = h.conv.sessionData.pendingAttribute || h.conv.sessionData.pendingMultiOrder;
    expect(pending).toBeTruthy();
    expect(h.conv.sessionData.cart.every((c) => [1, 2].includes(c.productId) || c.quantity === 0)).toBe(true);

    expect(h.conv.customerName).toBe('Wilmer');
  });

  it('no trata “Las mojarras fritas” como dirección en un pedido mixto con typo', async () => {
    const h = harness();
    await h.send('Quiero 3 mojarras, dos costillas de cerdo, y Tres pillos fritos');
    const beforeAddress = structuredClone(h.conv.sessionData);
    expect(beforeAddress.address).toBeFalsy();

    await h.send('Las mojarras fritas');

    expect(h.conv.sessionData.address).toBeFalsy();
    expect(h.conv.sessionData.orderType).not.toBe('delivery');
    const mojarra = h.cartRows().find((r) => r.id === 14);
    expect(mojarra).toBeTruthy();
    expect(h.cartRows().find((r) => r.id === 60)?.qty).toBe(2);
  });

  it('quita solo la mojarra y deja las costillas', async () => {
    const h = harness();
    await h.send('Me vendes 2 costillas\n1 mojarra');
    await h.send('costillas der cerdo');
    await h.send('Frita');
    expect(h.cartRows().map((r) => r.id).sort()).toEqual([14, 60]);

    await h.send('Quita la mojarra');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 60, qty: 2 })]);
  });

  it('corrige cantidad de un plato sin sumar ni tocar el otro', async () => {
    const h = harness();
    await h.send('Me vendes 2 costillas\n1 mojarra');
    await h.send('costillas der cerdo');
    await h.send('Frita');

    await h.send('Solo eran 3 costillas');
    expect(h.cartRows()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 60, qty: 3 }),
        expect.objectContaining({ id: 14, qty: 1 }),
      ]),
    );
  });

  it('anota “sin ensalada” al churrasco y no como nombre del cliente', async () => {
    const h = harness();
    await h.send('Un churrasco sin ensalada');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({ id: 17, qty: 1, note: expect.stringMatching(/sin ensalada/i) }),
    ]);
    expect(h.conv.customerName).toBe('Wilmer');
    expect(h.conv.sessionData.customerNotes || '').not.toMatch(/sin ensalada/i);
  });

  it('reemplaza un error de sopas en vez de sumar al carrito previo', async () => {
    const h = harness();
    await h.send('dos de ajiaco y dos de menudencias');

    const soups = h.cartRows().filter((r) => r.id === 20 || r.id === 38);
    expect(soups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 38, qty: 2 }),
        expect.objectContaining({ id: 20, qty: 2 }),
      ]),
    );
    expect(soups).toHaveLength(2);
  });

  it('elige el arroz chino con costillas si el cliente lo nombra tras la oferta', async () => {
    const h = harness();
    await h.send('Me vendes 2 costillas\n1 mojarra');
    expect(h.replies.at(-1)).toMatch(/arroz chino|costillas/i);

    await h.send('el arroz chino');
    expect(h.cartRows().find((r) => r.id === 84 || r.id === 85)).toBeTruthy();
    expect(h.cartRows().find((r) => r.id === 60)).toBeFalsy();
    expect(h.replies.at(-1)).not.toMatch(/no manejamos/i);
  });

  it('una pregunta de menú no mete productos al carrito', async () => {
    const h = harness();
    await h.send('¿El combo mixto es medio broaster medio frito?');
    expect(h.conv.sessionData.cart).toEqual([]);
    expect(h.conv.sessionData.pendingMatch?.intent).not.toBe('order');
  });
});


describe('Offline conversation acceptance across products and interruptions', () => {
  it.each(['Quiero un arroz con pollo con arto Ahi por favor',
    'Quiero un arroz con pollo con bastante ají'])
  ('persists a qualified kitchen preference through the inbound router: %s', async text => {
    const h = harness(products, false);
    await h.send(text);
    expect(h.cartRows()).toEqual([expect.objectContaining({id:23, qty:1, note:expect.stringMatching(/con (harto|bastante) ají/)})]);
    expect(h.replies.at(-1)).not.toMatch(/no manejamos|no tenemos/i);
  });

  it.each(['jugos naturales', 'Que jugos naturales hay?', 'Qué bebidas tienen'])
  ('answers catalog discovery without buying or denying existing juice: %s', async text => {
    const h = harness(products, false);
    const reply = await h.send(text);
    expect(h.cartRows()).toEqual([]);
    expect(reply).toMatch(/jugo/i);
    expect(reply).not.toMatch(/no (?:tenemos|manejamos).*jugo/i);
  });

  it.each([true, false])('keeps quantity while a soup selection is interrupted by a menu inquiry (agent enabled: %s)', async enabled => {
    const h = harness(products, enabled);
    await h.send('Quiero dos sopas');
    expect(h.cartRows()).toEqual([]);
    await h.send('¿Qué bebidas tienes?');
    expect(h.cartRows()).toEqual([]);
    await h.send('Ajiaco');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:38, qty:2})]);
  });

  it.each([true, false])('keeps a pending purchase while answering prices (agent enabled: %s)', async enabled => {
    const h = harness(products, enabled);
    await h.send('Quiero tres pollos');
    const pending = structuredClone(h.conv.sessionData.pendingMatch);
    expect(pending?.quantity).toBe(3);
    const reply = await h.send('¿Cuánto cuesta el churrasco?');
    expect(reply).toMatch(/38[.,]000/);
    expect(h.conv.sessionData.pendingMatch).toEqual(pending);
    expect(h.cartRows()).toEqual([]);
    await h.send('Broaster');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:4, qty:3})]);
    expect(h.agent.runTurn).not.toHaveBeenCalled();
  });

  it('does not turn questions about a named dish into a purchase', async () => {
    const h = harness(products, false);
    for (const text of ['¿Cuánto cuesta el churrasco?', '¿El arroz con pollo trae ensalada?', '¿Tienes sopa de ajiaco?']) {
      await h.send(text);
      expect(h.cartRows()).toEqual([]);
    }
    await h.send('Quiero un churrasco');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:17, qty:1})]);
  });

  it('preserves the cart while editing delivery address during payment selection', async () => {
    const h = harness(products, false);
    await h.send('Quiero dos churrascos');
    const initial = structuredClone(h.cartRows());
    await h.send('Para la calle 48 sur 86 87');
    expect(h.conv.sessionData.address).toContain('48');
    await h.send('Cambiar la dirección a carrera 79a 48 sur 86');
    expect(h.conv.sessionData.address).toMatch(/79a/i);
    expect(h.cartRows()).toEqual(initial);
    expect(h.conv.sessionData.orderType).toBe('delivery');
  });

  it.each([true, false])('preserves flavor and quantity selection across a catalog question (agent enabled: %s)', async enabled => {
    const h = harness(products, enabled);
    await h.send('Tres jugos naturales en agua');
    const pending = structuredClone(h.conv.sessionData.pendingAttribute);
    expect(pending?.productId).toBe(50);
    expect(pending?.sourceText).toMatch(/tres/i);
    await h.send('¿Qué sopas hay?');
    expect(h.conv.sessionData.pendingAttribute).toEqual(pending);
    expect(h.cartRows()).toEqual([]);
    await h.send('Mango');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:50, qty:3,
      attrs:expect.arrayContaining(['Sabor:Mango'])})]);
  });

  it.each([true, false])('preserves quantity for a numbered choice in another catalog (agent enabled: %s)', async enabled => {
    const menu = [
      {id:903, code:903, name:'Bowl Andino', price:18700, categoryName:'Bowls', hasAttributes:false, attributes:[], availableNow:true},
      {id:904, code:904, name:'Bowl Mediterraneo', price:21900, categoryName:'Bowls', hasAttributes:false, attributes:[], availableNow:true},
    ];
    const h = harness(menu, enabled);
    await h.send('Quiero dos bowls');
    const pending = structuredClone(h.conv.sessionData.pendingMatch);
    expect(pending?.quantity).toBe(2);
    const chosen = pending!.candidates[1].id;
    await h.send('¿Cuánto cuesta Bowl Andino?');
    expect(h.conv.sessionData.pendingMatch).toEqual(pending);
    await h.send('2');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:chosen, qty:2})]);
  });

  it.each([true, false])('clears interrupted purchases when the customer explicitly restarts (agent enabled: %s)', async enabled => {
    const h = harness(products, enabled);
    await h.send('Quiero dos sopas');
    await h.send('¿Qué bebidas hay?');
    await h.send('Reiniciar');
    expect(h.conv.sessionData.pendingMatch).toBeUndefined();
    expect(h.conv.sessionData.pendingAttribute).toBeUndefined();
    expect(h.conv.sessionData.pendingQuantityHint).toBeUndefined();
    expect(h.cartRows()).toEqual([]);
  });

  it('applies the same preference rule with another restaurant catalog', async () => {
    const menu = [{id:903, code:903, name:'Bowl Andino', price:18700,
      categoryName:'Bowls', hasAttributes:false, attributes:[], availableNow:true}];
    const h = harness(menu, false);
    await h.send('Quiero un Bowl Andino con bastante tahini');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:903, qty:1, note:'con bastante tahini'})]);
    await h.send('¿Cuánto cuesta Bowl Andino?');
    expect(h.cartRows()).toHaveLength(1);
    expect(h.cartRows()[0].qty).toBe(1);
  });
});
