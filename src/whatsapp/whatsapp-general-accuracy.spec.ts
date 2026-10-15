import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { WhatsappOrchestratorService } from './whatsapp-orchestrator.service';
import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { WhatsappAgentService } from './whatsapp-agent.service';
import { WhatsappActionGuardService } from './whatsapp-action-guard.service';
import { WhatsappPointsService } from './whatsapp-points.service';
import { WhatsappTurnTelemetryService } from './whatsapp-turn-telemetry.service';
import type { WhatsappSessionData } from './types/whatsapp-session.types';
import { DEFAULT_PAYMENT_METHODS } from './whatsapp-payment-methods';
import { isHypotheticalOrderQuestion, looksLikeAddressOnlyMessage, orderBeforeCheckoutClose } from './whatsapp-intent';
import { isWrongChatApology, isCartChargeQuestion } from './whatsapp-session-intents';

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
    setInboundProcessingOutcome: async () => undefined,
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
    menuUrl: '' as string,
    welcomeMessage: '' as string,
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
  const recordReply = async (_conv: unknown, _waId: string, reply: string) => {
    replies.push(reply);
    history.push(`Bot: ${reply}`);
  };
  service.sendReplyNow = recordReply;
  service.reply = async (_conv: unknown, waId: string, body: string) => {
    const formatted = service.absorbCoverageNotice((body || '').trim(),waId);
    const hold = service.outboundHoldByWaId.get(waId);
    if (hold) hold.push(formatted); else await recordReply(_conv,waId,formatted);
  };
  const sendQueued = async (text: string, extra: Record<string,unknown> = {}) => {
    await service.runInboundUnlockedWithOutboundHold('customer',{waId:'customer',phoneE164:conv.phoneE164,
      messageId:`queued-${count}`,messageType:'text',text,raw:{},...extra});
    return replies.at(-1);
  };
  const send = async (text: string, raw: Record<string, unknown> = {}) => {
    await service.handleIncomingUnlocked({
      waId: 'customer',
      phoneE164: conv.phoneE164,
      messageId: `acc-${count}`,
      messageType: 'text',
      text,
      raw,
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
  return { conv, send, sendQueued, agent, replies, cartRows, service, cfg };
}

describe('Acertividad general — chats reales y ediciones', () => {
  it('conserva 2 costillas y 1 mojarra cuando el cliente elige con typo', async () => {
    const h = harness();
    const first = await h.send('Me vendes 2 costillas\n1 mojarra');
    expect(first).toMatch(/costillas/i);
    expect(h.cartRows()).toContainEqual(expect.objectContaining({id:14,qty:1}));

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
    const drinks = await h.send('¿Qué bebidas tienes?');
    expect(drinks).not.toMatch(/[1-9]️⃣|Escribe el número/i);
    expect(drinks).toMatch(/pedido pendiente|cuál prefieres/i);
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
    expect(reply).not.toMatch(/te lo agrego/i);
    expect(h.conv.sessionData.pendingMatch).toEqual(pending);
    expect(h.cartRows()).toEqual([]);
    await h.send('Broaster');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:4, qty:3})]);
    expect(h.agent.runTurn).not.toHaveBeenCalled();
  });

  it.each([true, false])('keeps one purchase through repeated category and price interruptions (agent enabled: %s)', async enabled => {
    const h = harness(products, enabled);
    await h.send('Quiero dos sopas');
    const pending = structuredClone(h.conv.sessionData.pendingMatch);
    for (const question of ['¿Qué bebidas hay?', '¿Cuánto cuesta el churrasco?', '¿Qué jugos naturales hay?']) {
      await h.send(question);
      expect(h.conv.sessionData.pendingMatch).toEqual(pending);
      expect(h.cartRows()).toEqual([]);
    }
    await h.send('Ajiaco');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:38, qty:2})]);
  });

  it.each([true, false])('applies a corrected quantity before a pending beverage flavor is chosen (agent enabled: %s)', async enabled => {
    const h = harness(products, enabled);
    await h.send('Tres jugos naturales en agua');
    await h.send('Mejor dos');
    await h.send('Lulo');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:50, qty:2, attrs:expect.arrayContaining(['Sabor:Lulo'])})]);
  });

  it.each([1, 2])('replaces the original quantity before a chicken variant is selected: %s', async quantity => {
    const h = harness(products, false);
    await h.send('Quiero tres pollos');
    await h.send(`Mejor ${quantity}`);
    await h.send('Broaster');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:4, qty:quantity})]);
  });

  it.each([true, false])('does not buy a quoted dish on yes while another purchase is unresolved (agent enabled: %s)', async enabled => {
    const h = harness(products, enabled);
    await h.send('Quiero tres pollos');
    await h.send('¿Cuánto cuesta el churrasco?');
    await h.send('Sí');
    expect(h.cartRows()).toEqual([]);
    await h.send('Broaster');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:4, qty:3})]);
  });

  it.each([true, false])('applies arepa choice and qualified kitchen note together (agent enabled: %s)', async enabled => {
    const h = harness(products, enabled);
    // Start from the already accepted line shown in the customer's transcript.
    h.conv.sessionData.cart = [{productId:1,code:1,name:'1 Pollo Frito',unitPrice:41000,quantity:1,attributes:[{attributeName:'Arepas',attributeValue:'Blancas'}]}];
    await h.send('Lo quiero con arepas fritas y arto Aji por favor');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:1, qty:1,
      attrs:expect.arrayContaining(['Arepas:Fritas']), note:expect.stringMatching(/harto ají/i)})]);
    expect(h.replies.at(-1)).toMatch(/harto ají/i);
  });

  it('applies a compound option and note edit in another catalog without touching another dish', async () => {
    const menu = [{id:903,code:903,name:'Bowl Andino',price:18700,categoryName:'Bowls',hasAttributes:true,
      attributes:[{attributeName:'Base',options:['Arroz','Quinoa']}],availableNow:true},
      {id:904,code:904,name:'Bowl Mediterraneo',price:21900,categoryName:'Bowls',hasAttributes:false,attributes:[],availableNow:true}];
    const h = harness(menu, false);
    h.conv.sessionData.cart = [{productId:903,code:903,name:'Bowl Andino',unitPrice:18700,quantity:2,note:'sin cebolla',attributes:[{attributeName:'Base',attributeValue:'Arroz'}]},
      {productId:904,code:904,name:'Bowl Mediterraneo',unitPrice:21900,quantity:1}];
    await h.send('El Bowl Andino con quinoa y bastante tahini por favor');
    expect(h.cartRows()[0]).toMatchObject({qty:2,attrs:['Base:Quinoa'],note:expect.stringMatching(/sin cebolla.*bastante tahini/i)});
    expect(h.cartRows()[1]).toMatchObject({id:904,qty:1});
    expect(h.cartRows()[1].note).toBeUndefined();
  });

  it.each([true, false])('scoped compound edit changes only the named chicken when both share arepa options (agent enabled: %s)', async enabled => {
    const h = harness(products, enabled);
    h.conv.sessionData.cart = [
      {productId:1,code:1,name:'1 Pollo Frito',unitPrice:41000,quantity:2,attributes:[{attributeName:'Arepas',attributeValue:'Blancas'}]},
      {productId:4,code:4,name:'1 Pollo Broaster',unitPrice:43000,quantity:1,attributes:[{attributeName:'Arepas',attributeValue:'Blancas'}]},
    ];
    await h.send('El pollo frito con arepas fritas y bastante ají');
    expect(h.cartRows()[0]).toMatchObject({qty:2,attrs:['Arepas:Fritas'],note:expect.stringMatching(/bastante ají/i)});
    expect(h.cartRows()[1]).toMatchObject({qty:1,attrs:['Arepas:Blancas']});
    expect(h.cartRows()[1].note).toBeUndefined();
  });

  it.each([[true,'El pollo frito'],[false,'El pollo frito'],[true,'Frito'],[false,'Frito']] as const)('ambiguous compound edit leaves two possible dishes unchanged (agent enabled: %s, answer: %s)', async (enabled, answer) => {
    const h = harness(products, enabled);
    h.conv.sessionData.cart = [
      {productId:1,code:1,name:'1 Pollo Frito',unitPrice:41000,quantity:1,attributes:[{attributeName:'Arepas',attributeValue:'Blancas'}]},
      {productId:4,code:4,name:'1 Pollo Broaster',unitPrice:43000,quantity:1,attributes:[{attributeName:'Arepas',attributeValue:'Blancas'}]},
    ];
    const before = structuredClone(h.cartRows());
    const reply = await h.send('Lo quiero con arepas fritas y bastante ají');
    expect(h.cartRows()).toEqual(before);
    expect(reply).toMatch(/cu[aá]l|qu[eé] (?:pollo|producto|plato)/i);
    await h.send(answer);
    expect(h.cartRows()[0]).toMatchObject({attrs:['Arepas:Fritas'],note:expect.stringMatching(/bastante ají/i)});
    expect(h.cartRows()[1]).toEqual(before[1]);
    expect(h.conv.sessionData.pendingCartAttributeEdit).toBeUndefined();
  });

  it.each(['3/4','tres cuartos','término medio','bien asado'])('keeps three steaks and their requested cooking term: %s', async term => {
    const h = harness(products, false);
    await h.send(`quiero tres churrascos ${term} por favor`);
    expect(h.cartRows()).toEqual([expect.objectContaining({id:17,qty:3,note:expect.stringMatching(/término|asado/i)})]);
    expect(h.replies.at(-1)).toMatch(/término|asado/i);
  });

  it.each([true,false])('updates cooking term from a typo follow-up without changing copies (agent enabled: %s)', async enabled => {
    const h = harness(products, enabled);
    h.conv.sessionData.cart = [{productId:17,code:17,name:'Churrasco',unitPrice:38000,quantity:3,note:'sin ensalada'}];
    await h.send('los quieor 3/4');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:17,qty:3,note:expect.stringMatching(/sin ensalada.*término tres cuartos/i)})]);
    expect(h.replies.at(-1)).toMatch(/tres cuartos/i);
  });

  it('asks which meat without changing either line when cooking scope is ambiguous', async () => {
    const menu = [
      {id:903,code:903,name:'Filete Andino',categoryName:'Carnes',price:26000,hasAttributes:false,attributes:[],availableNow:true},
      {id:904,code:904,name:'Lomo Serrano',categoryName:'Carnes',price:27000,hasAttributes:false,attributes:[],availableNow:true},
    ];
    const h = harness(menu, false);
    h.conv.sessionData.cart = menu.map(p => ({productId:p.id,code:p.code,name:p.name,unitPrice:p.price,quantity:1}));
    const before = structuredClone(h.cartRows());
    await h.send('lo quiero 3/4');
    expect(h.cartRows()).toEqual(before);
    expect(h.replies.at(-1)).toMatch(/cuál plato/i);
    await h.send('el Filete Andino lo quiero al punto');
    expect(h.cartRows()[0].note).toBe('al punto');
    expect(h.cartRows()[1]).toEqual(before[1]);
  });

  it('keeps cooking preferences in another restaurant catalog', async () => {
    const menu = [{id:903,code:903,name:'Filete Andino',categoryName:'Carnes',price:26000,hasAttributes:false,attributes:[],availableNow:true}];
    const h = harness(menu,false);
    h.conv.sessionData.cart = [{productId:903,code:903,name:'Filete Andino',unitPrice:26000,quantity:2}];
    await h.send('los quiero término medio');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:903,qty:2,note:'término medio'})]);
    await h.send('los quiero 3/4');
    expect(h.cartRows()[0].note).toBe('término tres cuartos');
  });

  it.each([true,false])('keeps a described dish while delivery details arrive in separate messages (agent enabled: %s)', async enabled => {
    const h = harness(products, enabled);
    await h.send('por favor apra un domicilio');
    const dishReply = await h.send('1-sobre barriga dorada delgada');
    expect(dishReply).not.toMatch(/no (?:manejamos|tenemos)/i);
    if (!h.cartRows().length) await h.send('Asada');
    const product = products.find(p => p.name === 'Sobrebarriga');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:product.id,qty:1,note:expect.stringMatching(/dorada.*delgada/i)})]);
    await h.send('Para la calle 10 B Bis #80-20 casa 101');
    await h.send('barrio Prueba');
    await h.send('barrio Prueba');
    expect(h.cartRows()).toHaveLength(1);
    expect(h.conv.sessionData.address).toMatch(/80-20/);
    expect(h.conv.sessionData.address).toMatch(/101/);
    expect(h.conv.sessionData.address?.match(/barrio Prueba/gi)).toHaveLength(1);
    expect(h.conv.sessionData.orderType).toBe('delivery');
  });

  it.each([true, false])('keeps the preparation note when a later exclusion arrives after the neighborhood (agent enabled: %s)', async enabled => {
    const h = harness(products, enabled);
    await h.send('Por favor para un domicilio');
    await h.send('1-sobre barriga dorada delgada');
    expect(h.cartRows().length).toBeGreaterThan(0);
    await h.send('Para la calle 10 B Bis #80-20 casa 101');
    await h.send('Barrio Prueba');
    const before = structuredClone(h.cartRows());
    await h.send('Sin ensalada x favor');
    const product = products.find(p => p.name === 'Sobrebarriga');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: product.id,
        qty: before[0]?.qty || 1,
        note: expect.stringMatching(/dorada.*delgada/i),
      }),
    ]);
    expect(h.cartRows()[0].note).toMatch(/sin ensalada/i);
    expect(h.conv.sessionData.address).toMatch(/80-20/);
    expect(h.conv.sessionData.address).toMatch(/casa 101|101/);
    expect(h.conv.sessionData.address).toMatch(/barrio Prueba/i);
    expect(h.conv.sessionData.orderType).toBe('delivery');
    expect(h.conv.state).not.toBe('completed');
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


describe('Selected anonymized historical chat patterns — offline router', () => {
  const corpus = JSON.parse(readFileSync(join(__dirname, '../../scripts/fixtures/whatsapp-real-chat-patterns.json'), 'utf8'));
  it.each(corpus.cases.filter(c => c.automated))('$id', async scenario => {
    const h = harness(products, false);
    for (const message of scenario.messages) {
      await h.send(message);
      if (scenario.expect.emptyCart) expect(h.cartRows()).toEqual([]);
    }
    if (scenario.expect.items) {
      expect(Object.fromEntries(h.cartRows().map(row => [String(row.id), row.qty]))).toEqual(scenario.expect.items);
    }
    for (const [productId, notes] of Object.entries(scenario.expect.notesByProduct || {}) as Array<[string,string[]]>) {
      const row = h.cartRows().find(item => String(item.id) === productId);
      for (const note of notes) expect(row?.note).toEqual(expect.stringContaining(note));
    }
    for (const component of scenario.expect.addressAll || []) expect(h.conv.sessionData.address?.toLowerCase()).toEqual(expect.stringContaining(component.toLowerCase()));
    for (const [productId, attrs] of Object.entries(scenario.expect.attributesByProduct || {}) as Array<[string,string[]]>) {
      expect(h.cartRows().find(row => String(row.id) === productId)?.attrs).toEqual(expect.arrayContaining(attrs));
    }
    if (scenario.expect.orderType) expect(h.conv.sessionData.orderType).toBe(scenario.expect.orderType);
    expect(h.replies.at(-1)).toBeTruthy();
    if (scenario.expect.replyPattern) expect(h.replies.at(-1)).toMatch(new RegExp(scenario.expect.replyPattern, 'i'));
    expect(h.conv.state).not.toBe('completed');
  });
});


describe('Historical chat continuation: address components and late notes', () => {
  it.each([true, false])('keeps street, complex and unit through checkout (agent: %s)', async enabled => {
    const h = harness(products, enabled);
    await h.send('Quiero un churrasco');
    await h.send('Para la calle 10B #80C-20');
    const state = h.conv.state;
    await h.send('Conjunto residencial Prueba');
    await h.send('Torre 2 apto 301');
    expect(h.conv.sessionData.address).toMatch(/80C-20/i);
    expect(h.conv.sessionData.address).toMatch(/Conjunto residencial Prueba/i);
    expect(h.conv.sessionData.address).toMatch(/Torre 2.*301/i);
    expect(h.cartRows()).toEqual([expect.objectContaining({id:17,qty:1})]);
    expect(h.conv.state).toBe(state);
    await h.send('Cambiar la dirección a calle 20 #30-40');
    expect(h.conv.sessionData.address).toMatch(/30-40/);
    expect(h.conv.sessionData.address).not.toMatch(/80C-20/);
  });

  it.each([true, false])('keeps a late dish exclusion while awaiting payment (agent: %s)', async enabled => {
    const h = harness(products, enabled);
    await h.send('Quiero un churrasco');
    await h.send('Para la calle 10B #80C-20');
    const state = h.conv.state;
    await h.send('Sin ensalada x favor');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:17,qty:1,note:expect.stringMatching(/sin ensalada/i)})]);
    expect(h.conv.state).toBe(state);
    expect(h.replies.at(-1)).toMatch(/sin ensalada/i);
  });
});


describe('Historical chat batch: compound preferences and interrupted choices', () => {
  it.each([true,false])('keeps both sauce instructions on the purchased half chicken (agent: %s)', async enabled => {
    const h = harness(products,enabled);
    await h.send('Medio pollo broaster, sin salsas, en vez de salsas más miel por favor');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:5,qty:1,note:expect.stringMatching(/sin salsas.*miel/i)})]);
    expect(h.replies.at(-1)).toMatch(/sin salsas/i);
    expect(h.replies.at(-1)).toMatch(/miel/i);
  });
  it.each([true,false])('keeps chicken while a soup question interrupts the purchase (agent: %s)', async enabled => {
    const h = harness(products,enabled);
    await h.send('Me regalas un pollo frito por favor y una sopita');
    expect(h.cartRows()).toContainEqual(expect.objectContaining({id:1,qty:1}));
    const pending = structuredClone(h.conv.sessionData.pendingMultiOrder);
    await h.send('Que sopita tienes?');
    expect(h.conv.sessionData.pendingMultiOrder).toEqual(pending);
    expect(h.replies.at(-1)).toMatch(/ajiaco/i);
    await h.send('Un ajiaco sin tanto recado por favor');
    expect(h.cartRows()).toHaveLength(2);
    expect(h.cartRows()).toContainEqual(expect.objectContaining({id:1,qty:1}));
    expect(h.cartRows()).toContainEqual(expect.objectContaining({id:38,qty:1,note:expect.stringMatching(/sin tanto recado/i)}));
    expect(h.replies.at(-1)).toMatch(/sin tanto recado/i);
  });
});


describe('Chicken without a cooking style plus soup', () => {
  it.each([true, false])('keeps both quantities through an interrupting soup question (agent: %s)', async enabled => {
    const h = harness(products, enabled);
    await h.send('Me regalas dos pollos y una sopa');
    expect(h.cartRows()).toEqual([]);
    expect(h.replies.at(-1)).toMatch(/frito/i);
    expect(h.replies.at(-1)).toMatch(/broaster/i);
    expect(h.replies.at(-1)).toMatch(/sopa/i);
    const held = structuredClone(h.conv.sessionData.pendingMultiOrder);
    expect(held?.ambiguous.length).toBeGreaterThanOrEqual(2);
    await h.send('Que sopas tienes?');
    expect(h.cartRows()).toEqual([]);
    expect(h.conv.sessionData.pendingMultiOrder).toEqual(held);
    expect(h.replies.at(-1)).toMatch(/ajiaco/i);
    await h.send('Broaster');
    await h.send('Ajiaco');
    expect(h.cartRows()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 4, qty: 2 }),
      expect.objectContaining({ id: 38, qty: 1 }),
    ]));
    expect(h.cartRows()).toHaveLength(2);
  });

  it('keeps both quantities when another catalog also has unnamed chicken and soup', async () => {
    const menu = [
      { id: 801, code: 801, name: 'Pollo Frito', categoryName: 'Pollos', price: 30000, hasAttributes: false, attributes: [], availableNow: true },
      { id: 802, code: 802, name: 'Pollo Broaster', categoryName: 'Pollos', price: 32000, hasAttributes: false, attributes: [], availableNow: true },
      { id: 803, code: 803, name: 'Sopa De Verduras', categoryName: 'Sopas', price: 8000, hasAttributes: false, attributes: [], availableNow: true },
      { id: 804, code: 804, name: 'Sopa De Lentejas', categoryName: 'Sopas', price: 8000, hasAttributes: false, attributes: [], availableNow: true },
    ];
    const h = harness(menu, false);
    await h.send('Quiero tres pollos y dos sopas');
    expect(h.cartRows()).toEqual([]);
    const held = structuredClone(h.conv.sessionData.pendingMultiOrder);
    expect(held?.ambiguous.length).toBeGreaterThanOrEqual(2);
    await h.send('Que sopas tienes?');
    expect(h.cartRows()).toEqual([]);
    expect(h.conv.sessionData.pendingMultiOrder).toEqual(held);
    expect(h.replies.at(-1)).toMatch(/lentejas/i);
    await h.send('Frito');
    await h.send('Lentejas');
    expect(h.cartRows()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 801, qty: 3 }),
      expect.objectContaining({ id: 804, qty: 2 }),
    ]));
    expect(h.cartRows()).toHaveLength(2);
  });
});


describe('Unavailable dish feedback', () => {
  it.each([true,false])('explains unavailability before offering the menu (agent: %s)', async enabled => {
    for (const message of ['Quiero una mazorca da', 'Quiero una mazorcada']) {
      const h = harness(products,enabled);
      await h.send(message);
      expect(h.cartRows()).toEqual([]);
      expect(h.replies.at(-1)).toMatch(/no (?:tenemos|manejamos|está)|no aparece/i);
    }
  });
});


describe('Cross-catalog preparation and unavailable requests', () => {
  it('preserves two portions and both preferences in another restaurant', async () => {
    const menu = [{id:903,code:903,name:'Bowl Andino',categoryName:'Bowls',price:18700,hasAttributes:false,attributes:[],availableNow:true}];
    const h = harness(menu,false);
    await h.send('Quiero dos Bowl Andino sin cebolla, más tahini por favor');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:903,qty:2,note:expect.stringMatching(/sin cebolla.*tahini/i)})]);
    expect(h.replies.at(-1)).toMatch(/sin cebolla/i);
    expect(h.replies.at(-1)).toMatch(/tahini/i);
  });
  it('uses the catalog when another restaurant does sell the requested dish', async () => {
    const menu = [{id:903,code:903,name:'Mazorcada',categoryName:'Especiales',price:19000,hasAttributes:false,attributes:[],availableNow:true}];
    const h = harness(menu,false);
    await h.send('Quiero una mazorcada');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:903,qty:1})]);
    expect(h.replies.at(-1)).not.toMatch(/no (?:tenemos|manejamos)/i);
  });
  it('leaves an existing cart unchanged when declining an unavailable dish', async () => {
    const h = harness(products,false);
    await h.send('Quiero un churrasco');
    const before = structuredClone(h.cartRows());
    await h.send('Quiero una mazorca da');
    expect(h.cartRows()).toEqual(before);
    expect(h.replies.at(-1)).toMatch(/no (?:tenemos|manejamos)/i);
  });
});


describe('Preparation questions remain informational', () => {
  it.each([true,false])('does not purchase a dish from a preparation question (agent: %s)', async enabled => {
    const h = harness(products,enabled);
    for (const text of ['Tienes medio pollo broaster sin salsas','Cuánto cuesta un pollo frito sin ensalada']) {
      await h.send(text);
      expect(h.cartRows()).toEqual([]);
    }
  });
});

describe('Image order transcription keeps complete selected cart — offline', () => {
  it.each([true, false])('routes all three image products with quantities (agent=%s)', async enabled => {
    const h = harness(products, enabled);
    const text = h.service.resolveImageOrderText({
      kind: 'order',
      textForBot: 'Un pollo frito\nDos churrascos\nUn arroz con pollo',
      visibleText: 'Carrito: 3 productos',
    }, 'Esto por favor', products);
    expect(text).toBe('Un pollo frito\nDos churrascos\nUn arroz con pollo');
    await h.send(text);
    expect(h.cartRows()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 1, qty: 1 }),
      expect.objectContaining({ id: 17, qty: 2 }),
    ]));
    expect(h.cartRows()).toHaveLength(3);
    expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({ id: 23, qty: 1 })]));
    expect(h.replies.at(-1)).toMatch(/churrasco/i);
    expect(h.replies.at(-1)).toMatch(/arroz/i);
  });

  it('keeps quantities and preparation notes for a single image product', () => {
    const h = harness();
    expect(h.service.resolveImageOrderText({ kind: 'order', textForBot: 'Tres churrascos 3/4 sin ensalada' }, undefined, products))
      .toBe('Tres churrascos 3/4 sin ensalada');
  });

  it('turns a readable menu into every product, never just the first', () => {
    const h = harness();
    expect(h.service.resolveImageOrderText({
      kind: 'unclear', textForBot: '', visibleText: '1 Pollo Frito\nChurrasco\nArroz Con Pollo',
      reply: '¿Cuál de los platos de la carta quieres?',
    }, 'Esto', products)).toBe('1 x 1 Pollo Frito (código 1)\n1 x Churrasco (código 17)\n1 x Arroz Con Pollo (código 23)');
  });

  it.each([true, false])('adds missing products without repeating the existing chicken (agent=%s)', async enabled => {
    const h = harness(products, enabled);
    // Snapshot after the photo's first chicken was already accepted.
    h.conv.sessionData.cart = [{ productId: 1, code: 1, name: '1 Pollo Frito', quantity: 1, unitPrice: 41000 }];
    await h.send('Faltó el churrasco y el arroz con pollo');
    expect(h.cartRows()).toHaveLength(3);
    expect(h.cartRows()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 1, qty: 1 }),
      expect.objectContaining({ id: 17, qty: 1 }),
      expect.objectContaining({ id: 23, qty: 1 }),
    ]));
  });

  it.each([true, false])('keeps photo arepas on the chicken, not as a portion (agent=%s)', async enabled => {
    const h = harness(products, enabled);
    const text = h.service.resolveImageOrderText({
      kind: 'order',
      textForBot: '1 churrasco 1 arroz con pollo 1 pollo frito, arepas blancas',
    }, 'Quiero eso', products);
    expect(text).toBe('1 churrasco 1 arroz con pollo 1 pollo frito, arepas blancas');
    await h.send(text);
    expect(h.cartRows().map(row => row.id).sort((a, b) => a - b)).toEqual([1, 17, 23]);
    expect(h.cartRows().find(row => row.id === 1)?.attrs).toEqual(expect.arrayContaining(['Arepas:Blancas']));
    expect(h.cartRows().some(row => row.id === 11)).toBe(false);
  });

  it('uses fried arepas as the chicken option when the photo names them after a comma', async () => {
    const h = harness(products, false);
    await h.send('1 churrasco 1 pollo frito, arepas fritas');
    expect(h.cartRows().find(row => row.id === 1)?.attrs).toEqual(expect.arrayContaining(['Arepas:Fritas']));
    expect(h.cartRows().some(row => row.id === 11)).toBe(false);
    expect(h.cartRows().some(row => row.id === 17)).toBe(true);
  });

  it.each([true, false])('does not reread the photo when the customer says quiero eso (agent=%s)', async enabled => {
    const h = harness(products, enabled);
    await h.send('1 churrasco 1 arroz con pollo 1 pollo frito, arepas blancas');
    const before = h.cartRows();
    const reply = await h.send('Quiero eso');
    expect(h.cartRows()).toEqual(before);
    expect(reply).toMatch(/ya quedó/i);
    expect(reply).not.toMatch(/porci[oó]n de arepas/i);
  });

  it('preserves a multi-product transcription for another restaurant catalog', () => {
    const menu = [
      { ...products[0], id: 901, code: 901, name: 'Bowl Andino' },
      { ...products[0], id: 902, code: 902, name: 'Filete Andino' },
    ];
    const h = harness(menu);
    const order = 'Dos Bowl Andino\nUn Filete Andino';
    expect(h.service.resolveImageOrderText({ kind: 'order', textForBot: order }, 'Esto', menu)).toBe(order);
  });
});

describe('Multiline orders and quoted attribute answers — offline', () => {
  it.each([true, false])('keeps soup quantity and composed delivery address (agent=%s)', async enabled => {
    const h = harness(products, enabled);
    await h.send('Buena tarde\nPara un domicilio por favor\nDos sopas de ajiaco\nConjunto Prueba\nTorre 2\nApto 301');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 38, qty: 2 })]);
    expect(h.conv.sessionData.orderType).toBe('delivery');
    expect(h.conv.sessionData.address).toMatch(/Conjunto Prueba.*Torre 2.*Apto 301/is);
    const before = structuredClone(h.cartRows());
    const reply = await h.send('Me confirma tiempo y valor por favor?');
    expect(h.cartRows()).toEqual(before);
    expect(reply).toMatch(/21[.,]000|23[.,]000/);
    expect(reply).toMatch(/confirmar el tiempo/i);
    expect(h.conv.state).not.toBe('completed');
  });

  it.each([true, false])('selects the answer after quoted options, not both options (agent=%s)', async enabled => {
    const h = harness(products, enabled);
    await h.send('Un cuarto de pollo frito');
    await h.send('pierna o pechuga\nPierna porfa');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 3, qty: 1, attrs: expect.arrayContaining(['Presa:Pierna Pernil']) })]);
    expect(h.replies.at(-1)).toMatch(/pierna/i);
    expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
  });
});

describe('Multiline orders and quoted — expanded coverage', () => {
  it.each([true, false])('selects the other quoted choice and keeps the same quantity (agent=%s)', async enabled => {
    const h = harness(products, enabled);
    await h.send('Un cuarto de pollo frito');
    await h.send('Pierna Pernil o Ala pechuga\nAla pechuga por favor');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 3, qty: 1, attrs: expect.arrayContaining(['Presa:Ala pechuga']) })]);
    expect(h.replies.at(-1)).toMatch(/Ala pechuga/i);
    expect(h.conv.sessionData.pendingMatch).toBeFalsy();
  });

  it.each([true, false])('keeps two dishes, preparation and street details in one message (agent=%s)', async enabled => {
    const h = harness(products, enabled);
    await h.send('Buenas tardes\nPara un domicilio por favor\nDos churrascos 3/4\nUna sopa de ajiaco\nCalle 10 B #80-20\nConjunto Prueba\nTorre 2\nApto 301');
    expect(h.cartRows()).toHaveLength(2);
    expect(h.cartRows()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 17, qty: 2, note: expect.stringMatching(/tres cuartos/) }),
      expect.objectContaining({ id: 38, qty: 1 }),
    ]));
    expect(h.conv.sessionData.address).toMatch(/80-20.*Conjunto Prueba.*Torre 2.*301/is);
    expect(h.conv.sessionData.orderType).toBe('delivery');
    expect(h.replies.at(-1)).toMatch(/churrasco/i);
    expect(h.replies.at(-1)).toMatch(/tres cuartos/);
  });

  it('uses quoted options from another tenant catalog', async () => {
    const menu = [{ id: 903, code: 903, name: 'Bowl Andino', categoryName: 'Bowls', price: 18700, availableNow: true,
      hasAttributes: true, attributes: [{ attributeName: 'Base', options: ['Quinoa', 'Arroz integral'] }] }];
    const h = harness(menu, false);
    h.conv.sessionData.cart = [{ productId: 903, name: 'Bowl Andino', code: 903, quantity: 2, unitPrice: 18700,
      note: 'sin cebolla', attributes: [{ attributeName: 'Base', attributeValue: 'Quinoa' }] }];
    await h.send('Quinoa o Arroz integral\nArroz integral porfa');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 903, qty: 2, note: 'sin cebolla', attrs: ['Base:Arroz integral'] })]);
    expect(h.replies.at(-1)).toMatch(/Arroz integral/i);
  });
});

describe('A later drink name replaces the default option', () => {
  it.each([true, false])('keeps the first drink until the customer names another (agent=%s)', async enabled => {
    const h = harness(products, enabled);
    await h.send('Un combo de arroz paisa');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({ id: 94, qty: 1, attrs: expect.arrayContaining(['Bebida:Colombiana']) }),
    ]);
    expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
    await h.send('Giger');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({ id: 94, qty: 1, attrs: expect.arrayContaining(['Bebida:Ginger']) }),
    ]);
    expect(h.replies.at(-1)).toMatch(/ginger/i);
  });

  it.each([true, false])('leaves the default drink when the word is not an option (agent=%s)', async enabled => {
    const h = harness(products, enabled);
    await h.send('Un combo de arroz paisa');
    await h.send('Fanta');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({ id: 94, qty: 1, attrs: expect.arrayContaining(['Bebida:Colombiana']) }),
    ]);
  });

  it('replaces the default when another catalog has one close option', async () => {
    const menu = [{
      id: 880, code: 880, name: 'Bowl Andino', categoryName: 'Bowls', price: 25000, availableNow: true,
      hasAttributes: true,
      attributes: [{ attributeName: 'Bebida', options: ['Horchata', 'Maracuyá', 'Avena'] }],
    }];
    const h = harness(menu, false);
    await h.send('Quiero un Bowl Andino');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({ id: 880, qty: 1, attrs: ['Bebida:Horchata'] }),
    ]);
    await h.send('Avenna');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({ id: 880, qty: 1, attrs: ['Bebida:Avena'] }),
    ]);
  });

  it('keeps the default when two options are equally close', async () => {
    const menu = [{
      id: 881, code: 881, name: 'Bowl Norteño', categoryName: 'Bowls', price: 25000, availableNow: true,
      hasAttributes: true,
      attributes: [{ attributeName: 'Bebida', options: ['Limonada', 'Jengibre', 'Jengibra'] }],
    }];
    const h = harness(menu, false);
    await h.send('Quiero un Bowl Norteño');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({ id: 881, qty: 1, attrs: ['Bebida:Limonada'] }),
    ]);
    await h.send('Jengibr');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({ id: 881, qty: 1, attrs: ['Bebida:Limonada'] }),
    ]);
  });
});

describe('Side substitution stays a note, not a second dish', () => {
  it.each([true, false])('keeps the ejecutivo and both preferences (agent=%s)', async enabled => {
    const h = harness(products, enabled);
    await h.send('Un ejecutivo con pierna pernil de pollo frito y sopa de menudencias');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 22,
        qty: 1,
        attrs: expect.arrayContaining(['Presa:Pierna Pernil', 'Sopa:Menudencias']),
      }),
    ]);
    const before = h.cartRows().length;
    const swapReply = await h.send('Es posible que me cambien el arroz por papa salada?');
    expect(h.cartRows()).toHaveLength(before);
    expect(h.cartRows()[0].id).toBe(22);
    expect(h.cartRows()[0].note || swapReply).toMatch(/papa salada/i);
    expect(swapReply).not.toMatch(/agregu[eé].*papa|porci[oó]n de papa/i);
    await h.send('Te recomiendo que el pollo esté muy muy bien frito');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 22,
        qty: 1,
        note: expect.stringMatching(/papa salada/i),
      }),
    ]);
    expect(h.cartRows()[0].note).toMatch(/bien frito/i);
    expect(h.conv.state).not.toBe('completed');
  });

  it('keeps a named soup as an attribute in another catalog', async () => {
    const menu = [
      {
        id: 910, code: 910, name: 'Almuerzo Andino', categoryName: 'Almuerzos', price: 22000,
        availableNow: true, hasAttributes: true,
        attributes: [
          { attributeName: 'Proteina', options: ['Cerdo', 'Res'] },
          { attributeName: 'Sopa', options: ['Verduras', 'Lentejas'] },
        ],
      },
      {
        id: 911, code: 911, name: 'Sopa De Lentejas', categoryName: 'Sopas', price: 12000,
        availableNow: true, hasAttributes: false, attributes: [],
      },
    ];
    const h = harness(menu, false);
    await h.send('Un almuerzo andino con res y sopa de lentejas');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 910,
        qty: 1,
        attrs: expect.arrayContaining(['Proteina:Res', 'Sopa:Lentejas']),
      }),
    ]);
    const swapReply = await h.send('Es posible que me cambien el arroz por papa salada?');
    expect(h.cartRows()).toHaveLength(1);
    expect(h.cartRows()[0].id).toBe(910);
    expect(h.cartRows()[0].note || swapReply).toMatch(/papa salada/i);
    expect(swapReply).not.toMatch(/agregu[eé].*papa|porci[oó]n de papa/i);
    await h.send('Te recomiendo que la carne esté bien asada');
    expect(h.cartRows()[0].note).toMatch(/papa salada/i);
    expect(h.cartRows()[0].note).toMatch(/bien asada/i);
    expect(h.conv.state).not.toBe('completed');
  });
});

describe('Multiline orders and quoted — informational controls', () => {
  it('uses the configured delivery estimate without changing the cart', async () => {
    const h = harness(products, false);
    Object.assign(h.cfg.localContext, { deliveryTimeNote: 'entre 50 y 60 minutos' });
    h.conv.sessionData.cart = [{ productId: 38, name: 'Sopa De Ajiaco', code: 38, quantity: 2, unitPrice: 10500 }];
    h.conv.sessionData.orderType = 'delivery';
    const reply = await h.send('Me confirma tiempo y valor por favor?');
    expect(reply).toMatch(/50 y 60 minutos/);
    expect(reply).toMatch(/21[.,]000|23[.,]000/);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 38, qty: 2 })]);
    expect(h.conv.state).toBe('building_cart');
  });
  it('does not purchase from a multiline price inquiry', async () => {
    const h = harness(products, false);
    await h.send('Buenas tardes\nCuánto cuestan dos sopas de ajiaco?\nCalle 10 B #80-20\nTorre 2 apto 301');
    expect(h.cartRows()).toEqual([]);
    expect(h.replies.at(-1)).toMatch(/precio|21[.,]000|10[.,]500/i);
  });
});

describe('Reserved turns stay on the open choice — PPP and another menu', () => {
  const andes = [
    { id: 910, code: 910, name: 'Pollo Frito Andino', categoryName: 'Pollos', price: 30000, hasAttributes: true, attributes: [{ attributeName: 'Acompanante', options: ['Arroz', 'Papa'] }], availableNow: true },
    { id: 911, code: 911, name: 'Pollo Broaster Andino', categoryName: 'Pollos', price: 32000, hasAttributes: true, attributes: [{ attributeName: 'Acompanante', options: ['Arroz', 'Papa'] }], availableNow: true },
    { id: 912, code: 912, name: 'Sopa De Lentejas', categoryName: 'Sopas', price: 8000, hasAttributes: false, attributes: [], availableNow: true },
    { id: 913, code: 913, name: 'Sopa De Verduras', categoryName: 'Sopas', price: 8000, hasAttributes: false, attributes: [], availableNow: true },
    { id: 914, code: 914, name: 'Bowl Andino', categoryName: 'Bowls', price: 18000, hasAttributes: true, attributes: [{ attributeName: 'Base', options: ['Quinoa', 'Arroz'] }], availableNow: true },
    { id: 915, code: 915, name: 'Bowl Costeno', categoryName: 'Bowls', price: 19000, hasAttributes: true, attributes: [{ attributeName: 'Base', options: ['Quinoa', 'Arroz'] }], availableNow: true },
  ];

  it.each([true, false])('an ambiguous yes does not buy while chicken and soup are still open (agent: %s)', async enabled => {
    const h = harness(products, enabled);
    await h.send('Me regalas dos pollos y una sopa');
    const held = structuredClone(h.conv.sessionData.pendingMultiOrder);
    expect(held?.ambiguous.length).toBeGreaterThanOrEqual(2);
    const reply = await h.send('Sí');
    expect(h.cartRows()).toEqual([]);
    expect(h.conv.sessionData.pendingMultiOrder).toEqual(held);
    expect(reply).toMatch(/elegir|cu[aá]l|falta/i);
    await h.send('Broaster');
    await h.send('Ajiaco');
    expect(h.cartRows()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 4, qty: 2 }),
      expect.objectContaining({ id: 38, qty: 1 }),
    ]));
    expect(h.cartRows()).toHaveLength(2);
  });

  it.each([true, false])('an ambiguous yes does not buy while another menu still has two open families (agent: %s)', async enabled => {
    const h = harness(andes, enabled);
    await h.send('Quiero dos pollos y una sopa');
    const held = structuredClone(h.conv.sessionData.pendingMultiOrder);
    expect(held?.ambiguous.length).toBeGreaterThanOrEqual(2);
    const reply = await h.send('Sí');
    expect(h.cartRows()).toEqual([]);
    expect(h.conv.sessionData.pendingMultiOrder).toEqual(held);
    expect(reply).toMatch(/elegir|cu[aá]l|falta/i);
    await h.send('Broaster');
    await h.send('Lentejas');
    expect(h.cartRows()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 911, qty: 2 }),
      expect.objectContaining({ id: 912, qty: 1 }),
    ]));
    expect(h.cartRows()).toHaveLength(2);
  });

  it.each([true, false])('a quoted option without an answer does not pick both presas (agent: %s)', async enabled => {
    const h = harness(products, enabled);
    await h.send('Un cuarto de pollo frito');
    const before = structuredClone(h.cartRows());
    const reply = await h.send('pierna o pechuga');
    expect(h.cartRows().filter(row => row.id === 3)).toHaveLength(Math.min(1, before.filter(row => row.id === 3).length || 1));
    expect(h.cartRows()).toHaveLength(1);
    const presas = h.cartRows().flatMap(row => row.attrs).filter(attr => /^Presa:/i.test(attr));
    expect(presas.length).toBeLessThanOrEqual(1);
    expect(reply).not.toMatch(/pierna.*pechuga|pechuga.*pierna/i);
  });

  it('a quoted option without an answer does not pick both bases in another menu', async () => {
    const h = harness(andes, false);
    await h.send('Quiero un Bowl Andino');
    const before = structuredClone(h.cartRows());
    const reply = await h.send('Quinoa o Arroz');
    expect(h.cartRows()).toHaveLength(1);
    expect(h.cartRows()[0].id).toBe(914);
    expect(h.cartRows()[0].qty).toBe(before[0]?.qty || 1);
    const bases = h.cartRows()[0].attrs.filter(attr => /^Base:/i.test(attr));
    expect(bases).toHaveLength(1);
    expect(reply).not.toMatch(/quinoa.*arroz|arroz.*quinoa/i);
  });

  it.each([true, false])('one change that fits two lines asks which line on PPP (agent: %s)', async enabled => {
    const h = harness(products, enabled);
    h.conv.sessionData.cart = [
      { productId: 1, code: 1, name: '1 Pollo Frito', unitPrice: 41000, quantity: 2, attributes: [{ attributeName: 'Arepas', attributeValue: 'Blancas' }] },
      { productId: 4, code: 4, name: '1 Pollo Broaster', unitPrice: 43000, quantity: 1, attributes: [{ attributeName: 'Arepas', attributeValue: 'Blancas' }] },
    ];
    const before = structuredClone(h.cartRows());
    const reply = await h.send('Lo quiero con arepas fritas');
    expect(h.cartRows()).toEqual(before);
    expect(reply).toMatch(/cu[aá]l|qu[eé] (?:pollo|producto|plato)/i);
    await h.send('El pollo frito');
    expect(h.cartRows()[0].attrs).toEqual(['Arepas:Fritas']);
    expect(h.cartRows()[1]).toEqual(before[1]);
  });

  it('one change that fits two lines asks which line on another menu', async () => {
    const h = harness(andes, false);
    h.conv.sessionData.cart = [
      { productId: 914, code: 914, name: 'Bowl Andino', unitPrice: 18000, quantity: 2, attributes: [{ attributeName: 'Base', attributeValue: 'Arroz' }] },
      { productId: 915, code: 915, name: 'Bowl Costeno', unitPrice: 19000, quantity: 1, attributes: [{ attributeName: 'Base', attributeValue: 'Arroz' }] },
    ];
    const before = structuredClone(h.cartRows());
    const reply = await h.send('Lo quiero con quinoa');
    expect(h.cartRows()).toEqual(before);
    expect(reply).toMatch(/cu[aá]l|qu[eé] (?:bowl|producto|plato)/i);
    await h.send('El Bowl Andino');
    expect(h.cartRows()[0]).toMatchObject({ id: 914, qty: 2, attrs: ['Base:Quinoa'] });
    expect(h.cartRows()[1]).toEqual(before[1]);
  });

  it.each([true, false])('a later payment replaces the previous one and keeps the PPP cart (agent: %s)', async enabled => {
    const h = harness(products, enabled);
    await h.send('Quiero un churrasco');
    await h.send('Para la calle 10 #20-30');
    await h.send('Pago en efectivo');
    expect(h.conv.sessionData.paymentMethod).toMatch(/cash|efectivo/i);
    const cart = structuredClone(h.cartRows());
    const reply = await h.send('Mejor por transferencia');
    expect(h.conv.sessionData.paymentMethod).toMatch(/transfer/i);
    expect(h.cartRows()).toEqual(cart);
    expect(reply).toMatch(/transfer/i);
  });

  it('a later payment replaces the previous one and keeps another menu cart', async () => {
    const h = harness(andes, false);
    await h.send('Quiero un Bowl Andino');
    await h.send('Para la calle 10 #20-30');
    await h.send('Pago en efectivo');
    expect(h.conv.sessionData.paymentMethod).toMatch(/cash|efectivo/i);
    const cart = structuredClone(h.cartRows());
    const reply = await h.send('Mejor por transferencia');
    expect(h.conv.sessionData.paymentMethod).toMatch(/transfer/i);
    expect(h.cartRows()).toEqual(cart);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 914, qty: 1 })]);
    expect(reply).toMatch(/transfer/i);
  });

  it.each([true, false])('restart drops a pending PPP choice so the next order starts clean (agent: %s)', async enabled => {
    const h = harness(products, enabled);
    await h.send('Quiero dos sopas');
    expect(h.conv.sessionData.pendingMatch || h.conv.sessionData.pendingMultiOrder).toBeTruthy();
    await h.send('Reiniciar');
    expect(h.cartRows()).toEqual([]);
    expect(h.conv.sessionData.pendingMatch).toBeUndefined();
    expect(h.conv.sessionData.pendingMultiOrder).toBeUndefined();
    expect(h.conv.sessionData.pendingQuantityHint).toBeUndefined();
    await h.send('Quiero un ajiaco');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 38, qty: 1 })]);
  });

  it('restart drops a pending choice on another menu so the next quantity is not inherited', async () => {
    const h = harness(andes, false);
    await h.send('Quiero dos bowls');
    expect(h.conv.sessionData.pendingMatch?.quantity).toBe(2);
    await h.send('Reiniciar');
    expect(h.cartRows()).toEqual([]);
    expect(h.conv.sessionData.pendingMatch).toBeUndefined();
    expect(h.conv.sessionData.pendingQuantityHint).toBeUndefined();
    await h.send('Quiero un Bowl Costeno');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 915, qty: 1 })]);
  });

  it.each([true, false])('a contradictory salad note does not add a second PPP dish (agent: %s)', async enabled => {
    const h = harness(products, enabled);
    await h.send('Quiero un churrasco');
    const reply = await h.send('Sin ensalada y con ensalada');
    expect(h.cartRows()).toHaveLength(1);
    expect(h.cartRows()[0].id).toBe(17);
    const note = h.cartRows()[0].note || '';
    expect(/sin ensalada/i.test(note) && /con ensalada/i.test(note)).toBe(false);
    expect(reply).toMatch(/ensalada|aclar|cu[aá]l/i);
  });

  it('a contradictory note does not add a second dish on another menu', async () => {
    const h = harness(andes, false);
    await h.send('Quiero un Bowl Andino');
    const reply = await h.send('Sin cebolla y con cebolla');
    expect(h.cartRows()).toHaveLength(1);
    expect(h.cartRows()[0].id).toBe(914);
    const note = h.cartRows()[0].note || '';
    expect(/sin cebolla/i.test(note) && /con cebolla/i.test(note)).toBe(false);
    expect(reply).toMatch(/cebolla|aclar|cu[aá]l/i);
  });

  it('a quantity correction before the choice stays on another menu', async () => {
    const h = harness(andes, false);
    await h.send('Quiero tres bowls');
    await h.send('Mejor dos');
    await h.send('Costeno');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 915, qty: 2 })]);
  });
});

describe('Redemption and a registered order stay uninvented', () => {
  const andes = [
    { id: 914, code: 914, name: 'Bowl Andino', categoryName: 'Bowls', price: 18000, hasAttributes: false, attributes: [], availableNow: true },
    { id: 915, code: 915, name: 'Bowl Costeno', categoryName: 'Bowls', price: 19000, hasAttributes: false, attributes: [], availableNow: true },
  ];

  it.each([
    ['Más otro medio pollo', 'No. Es medio pollo redimido más el medio pollo adicional.', products],
    ['Más otro bowl', 'No. Es un bowl redimido más el bowl adicional.', andes],
  ])('does not discount %s without a validated code', async (_first, correction, menu) => {
    const h = harness(menu as never, false);
    await h.send(_first);
    const before = structuredClone(h.cartRows());
    const reply = await h.send(correction);
    expect(h.conv.sessionData.pendingRedemptionCode).toBeFalsy();
    expect(h.cartRows().length).toBeLessThanOrEqual(Math.max(before.length, 1));
    expect(h.cartRows()).toEqual(before);
    expect(reply).toMatch(/no lo descuento|c[oó]digo/i);
    expect(reply).not.toMatch(/gratis|\$\s*0|premio se aplicar/i);
  });

  it('reports a real order and does not cancel it from the chat', async () => {
    const h = harness(products, false);
    h.conv.state = 'completed';
    const cancel = jest.fn();
    h.service.ordersService = {
      findTodayOrdersByPhone: async () => [{ dailyOrderNumber: 15, orderStatus: 'inDelivery' }],
      cancel,
    };
    const delay = await h.send('Veci será que se demora');
    expect(delay).toMatch(/#15/);
    expect(delay).toMatch(/en camino/i);
    expect(delay).not.toMatch(/qued[oó] cancelado/i);
    const reply = await h.send('Me va tocar cancelarlo, me tengo que ir');
    expect(cancel).not.toHaveBeenCalled();
    expect(h.conv.state).toBe('completed');
    expect(reply).toMatch(/no lo cancelo/i);
    expect(reply).toMatch(/3118866823/);
    expect(reply).toMatch(/#15/);
  });

  it.each(['empty', 'error'])('no afirma una orden activa al cancelar sin evidencia: %s', async (scenario) => {
    const h = harness(products, false);
    h.conv.state = 'completed';
    h.service.ordersService = { findTodayOrdersByPhone: async () => {
      if (scenario === 'error') throw new Error('lookup unavailable');
      return [];
    } };
    const reply = await h.send('Quiero cancelar mi pedido');
    expect(reply).toMatch(/no pude confirmar una orden activa/i);
    expect(reply).not.toMatch(/sigue activo|qued[oó] cancelado/i);
    expect(h.conv.state).toBe('completed');
  });

  it.each([
    '¿Ya puedo redimir mis puntos?', 'Puedo redimir?', '¿Podría canjear mis puntos?',
    '¿Me alcanza para canjear mis puntos?', '¿Es posible redimir?',
    '¿Qué pasa si quiero redimir?', 'No quiero redimir todavía',
    'Cuánto cuesta redimir?', 'Cuándo puedo redimir mis puntos?',
  ])('consulta de canje no gasta puntos: %s', async text => {
    const h = harness(products, false);
    h.conv.sessionData.linkedUserId = 'test-account';
    const redeem = jest.fn(async () => ({ code: 'ABCD2345EFGH', expiresAt: null }));
    h.service.pointsHandler = new WhatsappPointsService({
      getAvailablePoints: async () => 9, redeemPointsForVoucher: redeem,
    } as never);
    const before = structuredClone(h.conv.sessionData);
    const reply = await h.send(text);
    expect(redeem).not.toHaveBeenCalled();
    expect(h.conv.sessionData).toEqual(before);
    expect(reply).toMatch(/9|puntos|redimir/i);
    expect(reply).not.toMatch(/premio generado/i);
  });

  it.each(['redimir', 'Quiero redimir mis puntos', 'Quisiera canjear mis puntos',
    'Por favor redimir', 'Sí, quiero redimir', 'Generar premio', 'Quiero generar un premio',
    'Puedes redimir mis puntos por favor', 'Redime mis puntos'])('petición explícita genera un solo premio: %s', async text => {
    const h = harness(products, false);
    h.conv.sessionData.linkedUserId = 'test-account';
    let balance = 9;
    const redeem = jest.fn(async () => {
      balance -= 9; return { code: 'ABCD2345EFGH', expiresAt: null };
    });
    h.service.pointsHandler = new WhatsappPointsService({
      getAvailablePoints: async () => balance, redeemPointsForVoucher: redeem,
    } as never);
    const reply = await h.send(text);
    expect(redeem).toHaveBeenCalledTimes(1);
    expect(balance).toBe(0);
    expect(reply).toMatch(/premio generado/i);
    expect(h.cartRows()).toEqual([]);
  });

  it.each(['explicit', 'bare'])('registra factura %s sin anotarla como premio', async mode => {
    const h = harness(products, false);
    h.conv.sessionData.linkedUserId = 'test-account';
    const validate = jest.fn(async () => { throw new NotFoundException('Código de premio no encontrado'); });
    const register = jest.fn(async () => undefined);
    h.service.pointsHandler = new WhatsappPointsService({
      getAvailablePoints: async () => 1, validateRedemptionCode: validate, registerPointByCode: register,
    } as never);
    const reply = await h.send(mode === 'explicit' ? 'Registrar ABCD2345EFGH' : 'ABCD2345EFGH');
    expect(register).toHaveBeenCalledTimes(1);
    expect(validate).toHaveBeenCalledTimes(mode === 'explicit' ? 0 : 1);
    expect(reply).toMatch(/punto registrado/i);
    expect(h.conv.sessionData.pendingRedemptionCode).toBeFalsy();
  });

  it('reconoce un código de premio suelto con carrito vacío sin registrarlo como factura', async () => {
    const h = harness(products, false);
    h.conv.sessionData.linkedUserId = 'test-account';
    const register = jest.fn();
    h.service.pointsHandler = new WhatsappPointsService({
      getAvailablePoints: async () => 0, registerPointByCode: register,
      validateRedemptionCode: async () => ({ code: 'ABCD2345EFGH', userId: 'test-account', expiresAt: null }),
    } as never);
    const reply = await h.send('abcd2345efgh');
    expect(register).not.toHaveBeenCalled();
    expect(h.conv.sessionData.pendingRedemptionCode).toBe('ABCD2345EFGH');
    expect(h.conv.sessionData.cart).toEqual([]);
    expect(reply).toMatch(/medio pollo/i);
  });

  it.each(['expired', 'used', 'owner'])('un código suelto %s no intenta registrarse como factura', async scenario => {
    const h = harness(products, false);
    h.conv.sessionData.linkedUserId = 'test-account';
    const register = jest.fn();
    h.service.pointsHandler = new WhatsappPointsService({
      getAvailablePoints: async () => 0, registerPointByCode: register,
      validateRedemptionCode: async () => {
        if (scenario === 'expired') throw new BadRequestException('expired');
        if (scenario === 'used') throw new ConflictException('already been used');
        return { code: 'ABCD2345EFGH', userId: 'another-account' };
      },
    } as never);
    const reply = await h.send('ABCD2345EFGH');
    expect(register).not.toHaveBeenCalled();
    expect(h.conv.sessionData.pendingRedemptionCode).toBeFalsy();
    expect(reply).toMatch(/venci[oó]|usado|otra cuenta/i);
  });

  it('consulta, genera el premio, lo aplica y conserva el medio adicional sin gastar dos veces', async () => {
    const h = harness(products, false);
    h.conv.sessionData.linkedUserId = 'test-account';
    let available = 9;
    const redeem = jest.fn(async () => {
      if (available < 9) throw new BadRequestException('You need at least 9 points');
      available -= 9;
      return { code: 'ABCD2345EFGH', userId: 'test-account', expiresAt: new Date(Date.now() + 86400000) };
    });
    h.service.pointsHandler = new WhatsappPointsService({
      getAvailablePoints: async () => available,
      redeemPointsForVoucher: redeem,
      validateRedemptionCode: async () => ({ code: 'ABCD2345EFGH', userId: 'test-account', expiresAt: null }),
    } as never);
    const help = await h.send('Como puedo redimir mis puntos?');
    expect(help).toMatch(/9|redimir/i);
    expect(redeem).not.toHaveBeenCalled();
    expect(await h.send('redimir')).toMatch(/ABCD2345EFGH/);
    expect(available).toBe(0);
    expect(h.conv.sessionData.pendingRedemptionCode).toBeFalsy();
    await h.send('Un medio pollo broaster');
    expect(await h.send('Aplicar premio ABCD2345EFGH')).toMatch(/premio/i);
    expect(h.conv.sessionData.pendingRedemptionCode).toBe('ABCD2345EFGH');
    await h.send('Y otro medio pollo broaster adicional');
    expect(h.cartRows().reduce((n, row) => n + row.qty, 0)).toBe(2);
    expect(await h.send('redimir')).toMatch(/al menos 9/i);
    expect(available).toBe(0);
    await h.send('quitar el premio');
    expect(h.conv.sessionData.pendingRedemptionCode).toBeFalsy();
    expect(h.cartRows().reduce((n, row) => n + row.qty, 0)).toBe(2);
    expect(available).toBe(0);
  });

  it.each(['missing', 'expired', 'used', 'owner'])('rechaza premio %s sin modificar el carrito', async scenario => {
    const h = harness(products, false);
    await h.send('Un medio pollo broaster');
    const before = structuredClone(h.cartRows());
    h.conv.sessionData.linkedUserId = 'test-account';
    h.service.pointsHandler = new WhatsappPointsService({
      getAvailablePoints: async () => 0,
      validateRedemptionCode: async () => {
        if (scenario === 'missing') throw new NotFoundException('Código de premio no encontrado');
        if (scenario === 'expired') throw new BadRequestException('This redemption code has expired');
        if (scenario === 'used') throw new ConflictException('This redemption code has already been used');
        return { code: 'ABCD2345EFGH', userId: 'another-account' };
      },
    } as never);
    const reply = await h.send('Aplicar premio ABCD2345EFGH');
    expect(reply).toMatch(/no encontrado|venci[oó]|ya fue usado|otra cuenta/i);
    expect(h.cartRows()).toEqual(before);
    expect(h.conv.sessionData.pendingRedemptionCode).toBeFalsy();
  });

  it('keeps a validated prize on two paid half chickens without inventing a third', async () => {
    const h = harness(products, false);
    h.conv.sessionData.pendingRedemptionCode = 'ABCD2345EFGH';
    await h.send('Un medio pollo broaster');
    await h.send('Y otro medio pollo broaster adicional');
    const halves = h.cartRows().filter(row => row.id === 5);
    expect(halves.reduce((sum, row) => sum + row.qty, 0)).toBe(2);
    expect(h.conv.sessionData.pendingRedemptionCode).toBe('ABCD2345EFGH');
    expect(h.cartRows().some(row => row.id !== 5)).toBe(false);
    const cartReply = await h.send('ver carrito');
    expect(cartReply).toMatch(/Premio.*25\.000/);
    expect(cartReply).toMatch(/Total.*25\.000/);
    const success = h.service.formatOrderSuccessMessage(h.conv, h.conv.sessionData, { dailyOrderNumber: 1 }, 0);
    expect(success).toMatch(/Total:.*25\.000/);
    expect(h.service.formatCartTiny(h.conv.sessionData, 0)).toMatch(/25\.000/);
    expect(h.service.buildSessionSummary(h.conv, h.conv.sessionData, 0)).toMatch(/Total sistema:.*25\.000/);
    expect(h.cartRows().reduce((sum, row) => sum + row.qty, 0)).toBe(2);
  });

  it('does not zero a bowl from another menu when a prize code is only annotated', async () => {
    const h = harness(andes, false);
    h.conv.sessionData.pendingRedemptionCode = 'ABCD2345EFGH';
    await h.send('Quiero un Bowl Andino');
    await h.send('Y otro Bowl Andino adicional');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 914, qty: 2 })]);
    expect(h.conv.sessionData.pendingRedemptionCode).toBe('ABCD2345EFGH');
  });

  it('asks for the order number instead of inventing an ETA when none exists', async () => {
    const h = harness(products, false);
    h.conv.state = 'completed';
    h.service.ordersService = { findTodayOrdersByPhone: async () => [] };
    const reply = await h.send('Veci será que se demora');
    expect(reply).toMatch(/n[uú]mero de orden/i);
    expect(reply).not.toMatch(/35|en camino|ya qued[oó] registrado|ya sali[oó]/i);
    expect(h.conv.state).toBe('completed');
  });
});

// Original Spanish scenarios for multi-intent/nested preference patterns.
// No external dataset transcript is copied or translated here.
describe('Pedidos compuestos en dos catálogos — patrones de evaluación pública', () => {
  const andes = [
    { id: 912, code: 912, name: 'Sopa De Lentejas', categoryName: 'Sopas', price: 8000, hasAttributes: false, attributes: [], availableNow: true },
    { id: 914, code: 914, name: 'Bowl Andino', categoryName: 'Bowls', price: 18000, hasAttributes: true, attributes: [{ attributeName: 'Base', options: ['Quinoa', 'Arroz'] }], availableNow: true },
    { id: 915, code: 915, name: 'Bowl Costeno', categoryName: 'Bowls', price: 19000, hasAttributes: true, attributes: [{ attributeName: 'Base', options: ['Quinoa', 'Arroz'] }], availableNow: true },
  ];
  it.each([
    { menu: products, text: 'Dos pollos fritos con arepas fritas, sin ensalada y harto ají', id: 1, attr: 'Arepas:Fritas' },
    { menu: andes, text: 'Dos Bowls Andinos con quinoa, sin ensalada y harto ají', id: 914, attr: 'Base:Quinoa' },
  ])('cantidad, atributo y notas en $id', async ({ menu, text, id, attr }) => {
    const h = harness(menu, false);
    await h.send(text);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id, qty: 2, attrs: expect.arrayContaining([attr]) })]);
    expect(h.cartRows()[0].note).toMatch(/sin ensalada/i);
    expect(h.cartRows()[0].note).toMatch(/(?:harto|arto).*aj[ií]/i);
  });
  it.each([
    { menu: products, text: 'Un pollo frito con arepas fritas y un pollo broaster con arepas blancas', ids: [1, 4], attrs: ['Arepas:Fritas', 'Arepas:Blancas'] },
    { menu: andes, text: 'Un Bowl Andino con quinoa y un Bowl Costeno con arroz', ids: [914, 915], attrs: ['Base:Quinoa', 'Base:Arroz'] },
  ])('separa variantes entre líneas $ids', async ({ menu, text, ids, attrs }) => {
    const h = harness(menu, false);
    await h.send(text);
    expect(h.cartRows()).toHaveLength(2);
    ids.forEach((id, i) => expect(h.cartRows().find(row => row.id === id)).toEqual(expect.objectContaining({ qty: 1, attrs: expect.arrayContaining([attrs[i]]) })));
  });
  it.each([
    { menu: products, text: 'Dos ajiacos y un churrasco sin ensalada', soup: 38, dish: 17 },
    { menu: andes, text: 'Dos sopas de lentejas y un Bowl Andino sin ensalada', soup: 912, dish: 914 },
  ])('no propaga la nota del plato a las sopas $soup', async ({ menu, text, soup, dish }) => {
    const h = harness(menu, false);
    await h.send(text);
    expect(h.cartRows()).toHaveLength(2);
    expect(h.cartRows().find(row => row.id === soup)).toEqual(expect.objectContaining({ qty: 2 }));
    expect(h.cartRows().find(row => row.id === soup)?.note || '').not.toMatch(/sin ensalada/i);
    expect(h.cartRows().find(row => row.id === dish)?.note).toMatch(/sin ensalada/i);
  });
});

describe('Tanda de correcciones y referencias con contexto', () => {
  it.each(['El pollo con arepas fritas', 'Cambia las arepas del pollo a fritas'])('corrige variante sin tocar sopa: %s', async text => {
    const h = harness(products, false);
    await h.send('Un pollo frito');
    await h.send('Dos ajiacos');
    const soup = structuredClone(h.cartRows().find(r => r.id === 38));
    const reply = await h.send(text);
    expect(h.cartRows()).toHaveLength(2);
    expect(h.cartRows().find(r => r.id === 1)).toEqual(expect.objectContaining({qty: 1, attrs: expect.arrayContaining(['Arepas:Fritas'])}));
    expect(h.cartRows().find(r => r.id === 38)).toEqual(soup);
    expect(reply).toMatch(/fritas/i);
  });
  it.each(['Los dos a tres cuartos', 'Ambos churrascos 3/4'])('cocción conserva bebida: %s', async text => {
    const h = harness(products, false);
    await h.send('Dos churrascos');
    await h.send('Una limonada natural');
    const drink = structuredClone(h.cartRows().find(r => r.id !== 17));
    expect(drink).toBeTruthy();
    const reply = await h.send(text);
    expect(h.cartRows().find(r => r.id === 17)).toEqual(expect.objectContaining({qty:2, note: expect.stringMatching(/3\/4|tres cuartos/i)}));
    expect(h.cartRows().find(r => r.id !== 17)).toEqual(drink);
    expect(reply).toMatch(/3\/4|tres cuartos/i);
  });
  it.each(['Ese mismo', 'El segundo', 'Lo quiero sin eso', 'Igual que antes'])('pide referente cuando el carrito está vacío: %s', async text => {
    const h = harness(products, false);
    const reply = await h.send(text);
    expect(h.cartRows()).toEqual([]);
    expect(reply).toMatch(/cu[aá]l|qu[eé]|plato|producto|pedido/i);
    expect(reply).not.toMatch(/Listo ✅|agregu[eé]|anotado/i);
  });
  it.each(['Cuánto cuesta el churrasco?', 'Tienen ajiaco?'])('consultar otro plato no cambia el carrito: %s', async text => {
    const h = harness(products, false);
    await h.send('Dos pollos fritos');
    const before = structuredClone(h.cartRows());
    const reply = await h.send(text);
    expect(h.cartRows()).toEqual(before);
    expect(reply).toMatch(/churrasco|ajiaco/i);
  });
});


describe('Correcciones generales en catálogo alternativo', () => {
  const menu = [
    {id: 921, code:921, name:'Bowl Verde', categoryName:'Bowls', price:18000, availableNow:true, hasAttributes:true, attributes:[{attributeName:'Base',options:['Arroz','Quinoa']}]},
    {id:922, code:922, name:'Sopa De Lentejas', categoryName:'Sopas', price:8000, availableNow:true, hasAttributes:false, attributes:[]},
    {id:923, code:923, name:'Bife', categoryName:'Carnes', price:22000, availableNow:true, hasAttributes:false, attributes:[]},
  ];
  it.each(['El bowl con quinoa', 'Cambia la base del bowl a quinoa'])('abrevia plato sin cambiar sopa: %s', async text => {
    const h = harness(menu, false);
    // Select by catalog code to isolate the subsequent abbreviated correction.
    await h.send('codigo 921');
    await h.send('Arroz');
    expect(h.cartRows().find(r => r.id === 921)?.qty).toBe(1);
    await h.send('Dos sopas de lentejas');
    const soup = structuredClone(h.cartRows().find(r => r.id === 922));
    expect(await h.send(text)).toMatch(/quinoa/i);
    expect(h.cartRows()).toHaveLength(2);
    expect(h.cartRows().find(r => r.id === 921)).toEqual(expect.objectContaining({qty:1,attrs:expect.arrayContaining(['Base:Quinoa'])}));
    expect(h.cartRows().find(r => r.id === 922)).toEqual(soup);
  });
  it('corrige cocción anterior y conserva notas independientes', async () => {
    const h = harness(menu, false);
    await h.send('Dos bifes bien cocidos sin ensalada');
    expect(h.cartRows().find(r => r.id === 923)?.qty).toBe(2);
    expect(h.cartRows().find(r => r.id === 923)?.note).toMatch(/bien cocidos/i);
    await h.send('Una sopa de lentejas');
    const soup = structuredClone(h.cartRows().find(r => r.id === 922));
    await h.send('Ambos bifes 3/4');
    const line = h.cartRows().find(r => r.id === 923);
    expect(line).toEqual(expect.objectContaining({qty:2,note:expect.stringMatching(/tres cuartos/i)}));
    expect(line?.note).toMatch(/sin ensalada/i);
    expect(line?.note).not.toMatch(/bien cocido/i);
    expect(h.cartRows().find(r => r.id === 922)).toEqual(soup);
  });
  it('no interpreta los dos cuando solamente existe una unidad', async () => {
    const h = harness(menu, false);
    await h.send('Un bife');
    const before = structuredClone(h.cartRows());
    const reply = await h.send('Los dos 3/4');
    expect(h.cartRows()).toEqual(before);
    expect(reply).toMatch(/cu[aá]les|dos platos/i);
  });
});

describe('Pedido coloquial con referencia de cercanía', () => {
  it.each(['Quiero una sopita de menudencias aquí para la vuelta', 'Una sopa de menudencias por aquí a la vuelta'])('separa cercanía del producto: %s', async text => {
    const h = harness(products, false);
    const reply = await h.send(text);
    const product = products.find((p: {name:string}) => /^Sopa De Menudencias$/i.test(p.name));
    expect(h.cartRows()).toEqual([expect.objectContaining({id:product.id,qty:1})]);
    expect(reply).not.toMatch(/no manejamos|no tenemos/i);
    expect(h.conv.sessionData.address).toBeFalsy();
  });
});

describe('Horario y consulta para grupos no son productos', () => {
  it.each(['Los quiero para el medio día', 'Los quiero para el mediodía', 'Sería para el miércoles al mediodía'])('no confunde horario con medio pollo: %s', async text => {
    const h = harness(products, false);
    await h.send('Dos ajiacos');
    const before = structuredClone(h.cartRows());
    const reply = await h.send(text);
    expect(h.cartRows()).toEqual(before);
    expect(h.conv.sessionData.pendingMatch?.candidates?.some(p => [2,5].includes(p.id))).not.toBe(true);
    expect(reply).not.toMatch(/Para Medio Pollo|Listo ✅.*Pollo/i);
  });
});

describe('Cercanía en otro menú sin nombres de PPP', () => {
  const menu = [
    {id:931,code:931,name:'Pasta Al Pesto',categoryName:'Pastas',price:17000,availableNow:true,hasAttributes:false,attributes:[]},
    {id:932,code:932,name:'Sopa De Lentejas',categoryName:'Sopas',price:8000,availableNow:true,hasAttributes:false,attributes:[]},
  ];
  it.each([
    {text:'Una Pasta Al Pesto aquí para la vuelta',id:931},
    {text:'Una sopa de lentejas por aquí a la vuelta',id:932},
  ])('conserva producto $id y no inventa dirección', async ({text,id}) => {
    const h = harness(menu,false);
    const reply = await h.send(text);
    expect(h.cartRows()).toEqual([expect.objectContaining({id,qty:1})]);
    expect(h.conv.sessionData.address).toBeFalsy();
    expect(h.conv.sessionData.customerNotes).toMatch(/Referencia de entrega/);
    expect(reply).not.toMatch(/no manejamos|no tenemos/i);
  });
});


describe('Cercanía no convierte consultas o negaciones en compra', () => {
  it.each(['No quiero sopa de menudencias aquí para la vuelta', 'Tienen sopa de menudencias aquí para la vuelta'])('no agrega: %s', async text => {
    const h = harness(products,false);
    await h.send(text);
    expect(h.cartRows()).toEqual([]);
  });
});


describe('Respuestas nativas de WhatsApp — vínculo y alcance', () => {
  it('usa la respuesta citada para elegir entre dos líneas con las mismas opciones', async () => {
    const h = harness(products,false);
    await h.send('Un pollo frito');
    await h.send('Un pollo broaster');
    const other = structuredClone(h.cartRows().find(r => r.id === 4));
    h.service.conversationService.findByWaMessageId = jest.fn().mockResolvedValue({conversationId:1,direction:'out',body:'Listo ✅ 1 Pollo Frito. Arepas blancas o fritas?',waMessageId:'wamid.quote'});
    const reply = await h.send('Fritas',{context:{id:'wamid.quote'}});
    expect(h.cartRows().find(r => r.id === 1)).toEqual(expect.objectContaining({qty:1,attrs:expect.arrayContaining(['Arepas:Fritas'])}));
    expect(h.cartRows().find(r => r.id === 4)).toEqual(other);
    expect(reply).toMatch(/fritas/i);
  });
  it.each(['missing','foreign','inbound','stale'])('no aplica una referencia %s al último plato', async scenario => {
    const h = harness(products,false);
    await h.send('Un pollo frito');
    await h.send('Un pollo broaster');
    const before = structuredClone(h.cartRows());
    h.service.conversationService.findByWaMessageId = jest.fn().mockResolvedValue(scenario === 'missing' ? null : {
      conversationId:scenario === 'foreign' ? 99 : 1,direction:scenario === 'inbound' ? 'in':'out',
      body:scenario === 'stale' ? 'Listo ✅ Sopa De Ajiaco':'Listo ✅ 1 Pollo Frito',waMessageId:'wamid.quote',
    });
    const reply = await h.send('Fritas',{context:{id:'wamid.quote'}});
    expect(h.cartRows()).toEqual(before);
    expect(reply).toMatch(/cu[aá]l|identificar|plato|producto/i);
  });
  it('otro catálogo conserva cantidad y cambia solo la base del plato citado', async () => {
    const menu = ['Mediterraneo','Oriental'].map((suffix,index) => ({id:951+index,code:951+index,name:`Bowl ${suffix}`,categoryName:'Bowls',price:18000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Base',options:['Arroz','Quinoa']}]}));
    const h = harness(menu,false);
    await h.send('Tres Bowls Mediterraneos');
    await h.send('Dos Bowls Orientales');
    h.service.conversationService.findByWaMessageId = jest.fn().mockResolvedValue({conversationId:1,direction:'out',body:'Bowl Mediterraneo ×9. Base: Arroz',waMessageId:'wamid.quote'});
    await h.send('Quinoa',{context:{id:'wamid.quote'}});
    expect(h.cartRows()).toEqual([
      expect.objectContaining({id:951,qty:3,attrs:['Base:Quinoa']}),
      expect.objectContaining({id:952,qty:2,attrs:['Base:Arroz']}),
    ]);
  });
  it.each(['lookup-error','ambiguous'])('una cita %s pide aclaración y conserva el carrito', async scenario => {
    const h = harness(products,false);
    await h.send('Un pollo frito');
    await h.send('Un pollo broaster');
    const before = structuredClone(h.cartRows());
    h.service.conversationService.findByWaMessageId = scenario === 'lookup-error'
      ? jest.fn().mockRejectedValue(new Error('Simulated lookup failure'))
      : jest.fn().mockResolvedValue({conversationId:1,direction:'out',body:'1 Pollo Frito y 1 Pollo Broaster',waMessageId:'wamid.quote'});
    const reply = await h.send('Fritas',{context:{id:'wamid.quote'}});
    expect(h.cartRows()).toEqual(before);
    expect(reply).toMatch(/cu[aá]l|identificar|plato|producto/i);
  });
  it('una respuesta citada de horario conserva el carrito y registra el horario', async () => {
    const h = harness(products,false);
    await h.send('Un pollo frito');
    const before = structuredClone(h.cartRows());
    const reply = await h.send('Mediodía',{context:{id:'wamid.schedule'}});
    expect(h.cartRows()).toEqual(before);
    expect(h.conv.sessionData.customerNotes).toMatch(/Horario solicitado/);
    expect(reply).toMatch(/todavía no está reservada/);
  });
  it('guardar respuesta enviada conserva el ID de Meta para futuras citas', async () => {
    const h = harness(products,false);
    h.service.metaService = {sendText:jest.fn().mockResolvedValue('wamid.sent')};
    h.service.conversationService.logMessage = jest.fn().mockResolvedValue({id:'sent'});
    h.service.conversationService.touchOutbound = jest.fn();
    await (WhatsappOrchestratorService.prototype as any).sendReplyNow.call(h.service,h.conv,'customer','Respuesta de prueba');
    expect(h.service.conversationService.logMessage).toHaveBeenCalledWith(expect.objectContaining({direction:'out',waMessageId:'wamid.sent',conversationId:1}));
  });
});

describe('Distribución de preparaciones conserva el producto y la cantidad', () => {
  const menu = [{id:941,code:941,name:'Bowl Mediterraneo',categoryName:'Bowls',price:18000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Base',options:['Arroz','Quinoa']}]}];
  it.each([
    {menu:products,order:'Diez arroces chinos con medio pollo',split:'Los quiero 5 con pollo frito y 5 con pollo broaster',id:36,attr:'Pollo',values:['Frito','Broaster']},
    {menu:products,order:'Quiero solo diez arroces chinos con medio pollo',split:'Los quiero 5 con pollo frito y 5 con pollo broaster',id:36,attr:'Pollo',values:['Frito','Broaster']},
    {menu,order:'Diez Bowls Mediterraneos',split:'Los quiero 5 con arroz y 5 con quinoa',id:941,attr:'Base',values:['Arroz','Quinoa']},
  ])('resuelve diez unidades pendientes como dos líneas del producto $id', async ({menu,order,split,id,attr,values}) => {
    const h = harness(menu,false);
    await h.send(order);
    expect(h.cartRows().some(r => r.id === id && r.qty === 10) || h.conv.sessionData.pendingAttribute?.productId === id).toBe(true);
    const reply = await h.send(split);
    expect(h.cartRows()).toHaveLength(2);
    for (const value of values) expect(h.cartRows()).toContainEqual(expect.objectContaining({id,qty:5,attrs:expect.arrayContaining([`${attr}:${value}`])}));
    expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
    expect(reply).toMatch(/5/);
  });
  it('un reparto incompleto conserva las diez unidades y pide aclaración', async () => {
    const h = harness(menu,false);
    await h.send('Diez Bowls Mediterraneos');
    const before = h.cartRows();
    const reply = await h.send('Los quiero 4 con arroz y 5 con quinoa');
    expect(h.cartRows()).toEqual(before);
    expect(reply).toMatch(/10.*unidades/);
    expect(reply).toMatch(/repartimos/);
  });
  it('dos platos con las mismas opciones requieren identificar el referente', async () => {
    const h = harness([...menu,{...menu[0],id:942,code:942,name:'Bowl Oriental'}],false);
    await h.send('Diez Bowls Mediterraneos');
    await h.send('Diez Bowls Orientales');
    const before = h.cartRows();
    expect(before).toHaveLength(2);
    const reply = await h.send('Los quiero 5 con arroz y 5 con quinoa');
    expect(h.cartRows()).toEqual(before);
    expect(reply).toMatch(/cuál plato/i);
  });
  it('repartir conserva la nota y permite continuar comprando', async () => {
    const h = harness(products,false);
    await h.send('Quiero solo diez arroces chinos con medio pollo sin papa francesa');
    expect(h.cartRows().some(row => row.id === 36 && row.qty === 10) || h.conv.sessionData.pendingAttribute?.quantity === 10).toBe(true);
    await h.send('Los quiero 5 con pollo frito y 5 con pollo broaster');
    expect(h.cartRows()).toHaveLength(2);
    expect(h.conv.state).toBe('building_cart');
    for (const line of h.conv.sessionData.cart) expect(line.note).toMatch(/sin papa francesa/i);
    await h.send('Una limonada natural');
    expect(h.cartRows().filter(row => row.id === 36).reduce((sum,row) => sum + row.qty,0)).toBe(10);
    expect(h.cartRows().some(row => row.id === 37)).toBe(true);
  });
  it('la cantidad pendiente sobrevive una consulta antes de elegir la preparación', async () => {
    const h = harness(products,false);
    await h.send('Quiero solo diez arroces chinos con medio pollo');
    expect(h.conv.sessionData.pendingAttribute?.productId).toBe(36);
    expect(h.conv.sessionData.pendingAttribute?.quantity).toBe(10);
    await h.send('Cuánto cuesta?');
    expect(h.conv.sessionData.pendingAttribute?.quantity).toBe(10);
    expect(h.cartRows()).toEqual([]);
    await h.send('Frito');
    expect(h.cartRows()).toContainEqual(expect.objectContaining({id:36,qty:10,attrs:expect.arrayContaining(['Pollo:Frito'])}));
    expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
  });
  it('personas es contexto de rendimiento y no veinte productos', async () => {
    const h = harness(products,false);
    await h.send('Hola buenos días quiero pedir arroz chino para unas veinte personas');
    expect(h.cartRows().reduce((n,row) => n + row.qty,0)).toBeLessThanOrEqual(1);
    expect(h.conv.sessionData.pendingQuantityHint?.quantity || 1).toBeLessThanOrEqual(1);
  });
});

describe('Un color del nombre no se trata como estilo ni como categoría', () => {
  const bowls = [
    {id:921,code:921,name:'Bowl Verde',categoryName:'Bowls',price:18000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Base',options:['Arroz','Quinoa']}]},
    {id:922,code:922,name:'Bowl Rojo',categoryName:'Bowls',price:18000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Base',options:['Arroz','Quinoa']}]},
  ];
  it('compra el bowl nombrado y aplica la base pedida', async () => {
    const h = harness(bowls, false);
    const reply = await h.send('Un Bowl Verde con arroz');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:921,qty:1,attrs:expect.arrayContaining(['Base:Arroz'])})]);
    expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
    expect(reply).not.toMatch(/no manejamos|no tenemos/i);
  });
  it('no elige el otro color cuando el cliente nombra uno', async () => {
    const h = harness(bowls, false);
    await h.send('Un Bowl Rojo con quinoa');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:922,qty:1,attrs:expect.arrayContaining(['Base:Quinoa'])})]);
  });
});


describe('Rendimiento y abonos requieren información respaldada', () => {
  const bowl = {id:971,code:971,name:'Bowl Mediterraneo',categoryName:'Bowls',price:18000,description:'Arroz, vegetales y proteína',availableNow:true,hasAttributes:false,attributes:[]};
  it.each([
    {menu:products,order:'Quiero solo diez arroces chinos con medio pollo',question:'Para cuántas personas alcanza cada porción?',id:36},
    {menu:[bowl],order:'Diez bowls mediterraneos',question:'Para cuántas personas alcanza cada bowl?',id:971},
  ])('no inventa rendimiento ni altera unidades del producto $id', async ({menu,order,question}) => {
    const h = harness(menu,false);
    h.service.aiService = {generateTurn:jest.fn().mockResolvedValue({reply:'Alcanza para 2 personas con buen apetito.',actions:{addItems:[{productId:1,quantity:1}]}})};
    await h.send(order);
    const before = structuredClone(h.conv.sessionData);
    const reply = await h.send(question);
    expect(h.conv.sessionData.cart).toEqual(before.cart);
    expect(h.conv.sessionData.pendingAttribute).toEqual(before.pendingAttribute);
    expect(reply).toMatch(/no.*(?:registrad|confirmad|especificad)|confirm.*local|consult.*local/i);
    expect(reply).not.toMatch(/(?:para|alcanza.*)\s*2\s*personas/i);
    expect(h.service.aiService.generateTurn).not.toHaveBeenCalled();
  });
  it('usa el rendimiento escrito y permite comprar una cantidad referida en otro menú', async () => {
    const h = harness([{...bowl,description:'Porción para 3 personas. Arroz, vegetales y proteína'}],false);
    const reply = await h.send('Para cuántas personas alcanza el Bowl Mediterraneo?');
    expect(h.cartRows()).toEqual([]);
    expect(reply).toMatch(/3 personas/);
    await h.send('De acuerdo quiero pedir esas diez unidades serían para el día miércoles');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:971,qty:10})]);
    expect(h.conv.sessionData.address).toBeFalsy();
    expect(h.conv.sessionData.customerNotes).toMatch(/Fecha solicitada: miércoles/);
    expect(h.replies.at(-1)).toMatch(/todavía no está reservada/);
  });
  it('una cantidad referida sin producto previo pregunta y no compra', async () => {
    const h = harness([bowl],false);
    const reply = await h.send('Quiero pedir esas diez cajas serían para el día miércoles');
    expect(h.cartRows()).toEqual([]);
    expect(h.conv.sessionData.address).toBeFalsy();
    expect(reply).toMatch(/cuál producto/i);
  });
  it('repetir una cantidad referida con carrito existente no duplica unidades', async () => {
    const h = harness([bowl],false);
    await h.send('Diez bowls mediterraneos');
    const before = structuredClone(h.conv.sessionData);
    const reply = await h.send('Quiero pedir esas diez cajas');
    expect(h.conv.sessionData).toEqual(before);
    expect(reply).toMatch(/cambiar la cantidad|agregar otro/i);
  });
  it('consultar otro plato no permite borrar la preparación pendiente anterior', async () => {
    const h = harness([...products,bowl],false);
    await h.send('Quiero solo diez arroces chinos con medio pollo');
    const pending = structuredClone(h.conv.sessionData.pendingAttribute);
    await h.send('Para cuántas personas alcanza el Bowl Mediterraneo?');
    const reply = await h.send('Quiero pedir esas diez cajas');
    expect(h.conv.sessionData.pendingAttribute).toEqual(pending);
    expect(h.cartRows()).toEqual([]);
    expect(reply).toMatch(/producto|plato pendiente/i);
  });
  it.each(['Puedo abonar la mitad o cómo manejaríamos el pago?', 'Puedo separar con un anticipo?'])('no acepta condiciones de abono no definidas: %s', async question => {
    const h = harness([bowl],false);
    h.service.aiService = {generateTurn:jest.fn().mockResolvedValue({reply:'Sí, puedes abonar la mitad y queda reservado.',actions:{setPaymentMethod:'transferencia'}})};
    await h.send('Diez bowls mediterraneos');
    const before = structuredClone(h.conv.sessionData);
    const reply = await h.send(question);
    expect(h.conv.sessionData).toEqual(before);
    expect(reply).toMatch(/confirm.*local|coordina.*local|consult.*local/i);
    expect(reply).not.toMatch(/queda reservado|puedes abonar la mitad/i);
    expect(h.service.aiService.generateTurn).not.toHaveBeenCalled();
  });
});


describe('Pedido grande conserva el plato a través de consultas y horario', () => {
  it('veinte comensales no son veinte platos, y diez cajas se reparten sin cambiar producto', async () => {
    const h = harness(products,false);
    h.service.aiService = {generateTurn:jest.fn().mockResolvedValue({reply:'Confirma con el local.',actions:{}})};
    await h.send('Hola buenos días quiero pedir arroz chino para unas veinte personas');
    const yieldReply = await h.send('Quiero solo el arroz chino con medio pollo para cuantas personas alcanza cada porción');
    expect(yieldReply).toMatch(/confirm.*local/i);
    expect(h.cartRows()).toEqual([]);
    await h.send('De acuerdo quiero pedir esas diez cajas serían para el día miércoles');
    expect(h.cartRows().some(row => row.id === 36 && row.qty === 10) || h.conv.sessionData.pendingAttribute?.productId === 36 && h.conv.sessionData.pendingAttribute?.quantity === 10).toBe(true);
    const beforeDeposit = structuredClone(h.conv.sessionData);
    await h.send('Puedo abonar la mitad o cómo manejaríamos el pago');
    expect(h.conv.sessionData).toEqual(beforeDeposit);
    await h.send('Los quiero para el medio día',{context:{id:'wamid.schedule'}});
    expect(h.conv.sessionData.customerNotes).toMatch(/miércoles|miercoles/i);
    expect(h.conv.sessionData.customerNotes).toMatch(/medio día/i);
    await h.send('Los quiero 5 con pollo frito y 5 con pollo broaster');
    expect(h.cartRows()).toHaveLength(2);
    expect(h.cartRows()).toEqual(expect.arrayContaining([
      expect.objectContaining({id:36,qty:5,attrs:expect.arrayContaining(['Pollo:Frito'])}),
      expect.objectContaining({id:36,qty:5,attrs:expect.arrayContaining(['Pollo:Broaster'])}),
    ]));
    expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
    expect(h.conv.sessionData.address).toBeFalsy();
    expect(h.conv.sessionData.paymentMethod).toBeFalsy();
  });
});


describe('Horario con una respuesta copiada no vuelve a comprar su contenido', () => {
  it.each([true,false])('cita con fuente reciente %s mantiene cantidad y preparación pendiente', async trusted => {
    const h = harness(products,false);
    await h.send('Quiero solo diez arroces chinos con medio pollo');
    const before = structuredClone(h.conv.sessionData);
    const source = trusted ? h.replies.at(-1)! : 'Perfecto, te ayudo con las 10 porciones de Arroz Chino Con Medio Pollo. ¿A qué hora las quieres?';
    const reply = await h.send(`${source}\nLos quiero para el medio día`);
    expect(h.conv.sessionData.cart).toEqual(before.cart);
    expect(h.conv.sessionData.pendingAttribute).toEqual(before.pendingAttribute);
    expect(h.conv.sessionData.address).toBeFalsy();
    if (trusted) {
      expect(h.conv.sessionData.customerNotes).toMatch(/Horario solicitado/);
      expect(reply).toMatch(/todavía no está reservada/);
    } else {
      expect(h.conv.sessionData.customerNotes).toEqual(before.customerNotes);
      expect(reply).toMatch(/solo el horario/);
    }
  });
});

describe('Tanda portable — fechas, horas y correcciones sin tocar el pedido', () => {
  const bowl = {id:981,code:981,name:'Bowl Mediterraneo',categoryName:'Bowls',price:18000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Base',options:['Arroz','Quinoa']}]};
  const menus = [{menu:products,order:'Tres churrascos',tag:'PPP'},{menu:[bowl],order:'Tres bowls mediterraneos',tag:'alternativo'}];
  const times = [
    {text:'Para mañana a las 12:30',tokens:/mañana.*12:30/i},
    {text:'Para el viernes a las 7 pm',tokens:/viernes.*(?:7 pm|19:00)/i},
    {text:'Los quiero para el domingo a las 13:15',tokens:/domingo.*13:15/i},
    {text:'Para el 15/10 a las 14:00',tokens:/15\/10.*14:00/i},
    {text:'Para el 3/4 a las 14:00',tokens:/3\/4.*14:00/i},
  ];
  it('cambiar solo la hora conserva la fecha solicitada y las notas de entrega', async () => {
    const h = harness([bowl],false);
    await h.send('Tres bowls mediterraneos');
    h.conv.sessionData.customerNotes = 'No tocar el timbre';
    await h.send('Para el viernes a las 7 pm');
    const before = structuredClone(h.conv.sessionData.cart);
    await h.send('Mejor a las 2 pm');
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.conv.sessionData.customerNotes).toMatch(/Fecha solicitada: viernes/);
    expect(h.conv.sessionData.customerNotes).toMatch(/Horario solicitado: 2 pm/);
    expect(h.conv.sessionData.customerNotes).not.toMatch(/7 pm/);
    expect(h.conv.sessionData.customerNotes).toMatch(/No tocar el timbre/);
  });
  it('cambiar solo la fecha conserva el horario elegido y elimina la fecha vieja', async () => {
    const h = harness([bowl],false);
    await h.send('Tres bowls mediterraneos');
    await h.send('Para el miércoles al mediodía');
    const before = structuredClone(h.conv.sessionData.cart);
    await h.send('Mejor para el viernes');
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.conv.sessionData.customerNotes).toMatch(/Fecha solicitada: viernes/);
    expect(h.conv.sessionData.customerNotes).toMatch(/Horario solicitado: medio día/);
    expect(h.conv.sessionData.customerNotes).not.toMatch(/miércoles/);
  });
  it('no corta silenciosamente notas existentes para guardar una fecha', async () => {
    const h = harness([bowl],false);
    await h.send('Tres bowls mediterraneos');
    h.conv.sessionData.customerNotes = 'a'.repeat(399);
    const before = structuredClone(h.conv.sessionData);
    const reply = await h.send('Para el viernes a las 2 pm');
    expect(h.conv.sessionData).toEqual(before);
    expect(reply).toMatch(/resumir/);
  });
  for (const {menu,order,tag} of menus) {
    it.each(times)(`${tag}: registra $text como solicitud, conserva dirección y pago`, async ({text,tokens}) => {
      const h = harness(menu,false);
      await h.send(order);
      expect(h.cartRows().reduce((sum,row) => sum + row.qty,0)).toBe(3);
      h.conv.sessionData = {...h.conv.sessionData,address:'Calle 48 sur 86 87',paymentMethod:'transferencia',customerNotes:'No tocar el timbre'};
      const before = structuredClone(h.conv.sessionData);
      const reply = await h.send(text);
      expect(h.cartRows().reduce((sum,row) => sum + row.qty,0)).toBe(3);
      expect(h.conv.sessionData.cart).toEqual(before.cart);
      expect(h.conv.sessionData.address).toEqual(before.address);
      expect(h.conv.sessionData.paymentMethod).toEqual(before.paymentMethod);
      expect(h.conv.sessionData.customerNotes).toMatch(tokens);
      expect(h.conv.sessionData.customerNotes).toMatch(/No tocar el timbre/);
      expect(reply).toMatch(/confirm.*local|no está reservad/i);
    });
    it(`${tag}: corregir fecha y hora reemplaza la solicitud anterior, conserva otras notas`, async () => {
      const h = harness(menu,false);
      await h.send(order);
      h.conv.sessionData.customerNotes = 'No tocar el timbre';
      await h.send('Para el miércoles al mediodía');
      const before = structuredClone(h.conv.sessionData.cart);
      const reply = await h.send('Mejor para el viernes a las 2 pm');
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.customerNotes).toMatch(/viernes.*(?:2 pm|14:00)/i);
      expect(h.conv.sessionData.customerNotes).not.toMatch(/miércoles|mediodía/i);
      expect(h.conv.sessionData.customerNotes).toMatch(/No tocar el timbre/);
      expect(reply).toMatch(/confirm.*local|no está reservad/i);
    });
    it.each(['A las 7','A las 25:90','Para el 31/02 a las 14:00'])(`${tag}: pregunta sin registrar horario ambiguo o inválido %s`, async text => {
      const h = harness(menu,false);
      await h.send(order);
      const before = structuredClone(h.conv.sessionData);
      const reply = await h.send(text);
      expect(h.conv.sessionData).toEqual(before);
      expect(reply).toMatch(/hora|fecha|mañana|tarde/i);
      expect(reply).not.toMatch(/Listo.*(?:pedido|agregué)|No manejamos/i);
    });
  }
});

describe('Tanda portable — reparto con opciones desconocidas y atributos múltiples', () => {
  const bowl = {id:982,code:982,name:'Bowl Mediterraneo',categoryName:'Bowls',price:18000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Base',options:['Arroz','Quinoa']},{attributeName:'Proteina',options:['Pollo','Tofu']}]};
  it('reparte un atributo conservando proteína y nota en todas las unidades', async () => {
    const h = harness([bowl],false);
    await h.send('Diez bowls mediterraneos con arroz y tofu sin cebolla');
    expect(h.cartRows().reduce((sum,row) => sum + row.qty,0)).toBe(10);
    const reply = await h.send('Los quiero 5 con arroz y 5 con quinoa');
    expect(h.cartRows()).toHaveLength(2);
    for (const row of h.cartRows()) {
      expect(row).toMatchObject({id:982,qty:5});
      expect(row.attrs).toContain('Proteina:Tofu');
      expect(row.note).toMatch(/sin cebolla/i);
    }
    expect(h.cartRows().map(row => row.attrs)).toEqual(expect.arrayContaining([
      expect.arrayContaining(['Base:Arroz']),expect.arrayContaining(['Base:Quinoa']),
    ]));
    expect(reply).toMatch(/5/);
  });
  it.each([
    {menu:products,order:'Quiero solo diez arroces chinos con medio pollo',split:'Los quiero 5 con pollo frito y 5 con pollo ahumado'},
    {menu:[bowl],order:'Diez bowls mediterraneos con arroz y tofu',split:'Los quiero 5 con arroz y 5 con cuscús'},
  ])('una opción fuera del catálogo no modifica parcialmente el pedido: $split', async ({menu,order,split}) => {
    const h = harness(menu,false);
    await h.send(order);
    const before = structuredClone(h.conv.sessionData);
    const reply = await h.send(split);
    expect(h.conv.sessionData.cart).toEqual(before.cart);
    expect(h.conv.sessionData.pendingAttribute).toEqual(before.pendingAttribute);
    expect(reply).toMatch(/opci[oó]n|preparaci[oó]n|aclar|catálogo|carta/i);
  });
});

describe('Tanda portable — el rendimiento conserva negaciones y límites', () => {
  it.each([
    {description:'No alcanza para 3 personas. Porción individual.',positive:false},
    {description:'No recomendamos esta porción para 4 personas.',positive:false},
    {description:'Rinde para 2 a 3 personas.',positive:true},
  ])('no convierte la descripción en otra promesa: $description', async ({description,positive}) => {
    const menu = [{id:983,code:983,name:'Bowl Mediterraneo',categoryName:'Bowls',price:18000,description,availableNow:true,hasAttributes:false,attributes:[]}];
    const h = harness(menu,false);
    const reply = await h.send('Para cuántas personas alcanza el Bowl Mediterraneo?');
    expect(h.cartRows()).toEqual([]);
    if (positive) expect(reply).toMatch(/2 a 3 personas/);
    else expect(reply).toMatch(/no.*(?:alcanza|recomend|confirmado)|confirm.*local/i);
  });
});

// Reserved inputs stay out of prompts. After this first execution they are regression cases.
describe('Evaluación reservada — primera ejecución de ocho patrones', () => {
  const reserved = JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-reserved-patterns.json'),'utf8'));
  it.each(reserved.cases)('$id', async (scenario: {id:string;messages:string[]}) => {
    const pack = {id:984,code:984,name:'Tres Arepas Doradas',price:9000,categoryName:'Porciones',availableNow:true,attributes:[]};
    const h = harness(scenario.id === 'reserved-package-and-beverage' ? [...products,pack] : products,false);
    const redeem = jest.spyOn(h.service.pointsHandler,'redeemNinePoints').mockRejectedValue(new Error('Unexpected redemption'));
    const register = jest.spyOn(h.service.pointsHandler,'registerPointForUser').mockRejectedValue(new Error('Unexpected points mutation'));
    for (let i=0;i<scenario.messages.length;i++) {
      await h.send(scenario.messages[i]);
      const rows = h.cartRows();
      const reply = h.replies.at(-1) || '';
      if (scenario.id === 'reserved-price-before-purchase') {
        if (i===0) { expect(rows).toEqual([]); expect(reply).toMatch(/10[.,]500/); }
        else expect(rows).toEqual([expect.objectContaining({id:38,qty:2})]);
      }
      if (scenario.id === 'reserved-change-one-preserve-other') {
        expect(rows).toHaveLength(2);
        expect(rows.find(row=>row.id===37)).toMatchObject({qty:1,attrs:[]});
        expect(rows.find(row=>row.id===1)).toMatchObject({qty:1,attrs:expect.arrayContaining([i===0?'Arepas:Blancas':'Arepas:Fritas'])});
      }
      if (scenario.id === 'reserved-soup-clarification-return') {
        if(i<2) expect(rows).toEqual([]);
        else expect(rows).toEqual([expect.objectContaining({id:38,qty:2})]);
      }
      if (scenario.id === 'reserved-package-and-beverage') {
        expect(rows.find(row=>row.id===984)?.qty).toBe(i<2?2:1);
        if(i>0) expect(rows.find(row=>row.id===37)).toMatchObject({qty:1});
        expect(rows).toHaveLength(i===0?1:2);
      }
      if (scenario.id === 'reserved-cooking-reversal') {
        expect(rows).toEqual([expect.objectContaining({id:17,qty:2})]);
        if(i===1) { expect(rows[0].note).toMatch(/tres cuartos/i); expect(rows[0].note).not.toMatch(/bien asad/i); }
      }
      if (scenario.id === 'reserved-points-condition') {
        expect(rows).toEqual([]); expect(redeem).not.toHaveBeenCalled(); expect(register).not.toHaveBeenCalled();
        expect(h.conv.sessionData.pendingRedemptionCode).toBeFalsy(); expect(reply).toMatch(/puntos|canj|redim/i);
      }
      if (scenario.id === 'reserved-allergy-consultation') {
        expect(rows).toEqual([]); expect(reply).not.toMatch(/(?:sí|si),?\s+(?:es seguro|puedes comer)|sin (?:riesgo|maní)|garantiz/i);
        expect(reply).toMatch(/confirm|local|al[eé]rg|segur|ingrediente/i);
      }
      if (scenario.id === 'reserved-unclear-reference') {
        expect(rows).toEqual([]); expect(reply).toMatch(/cu[aá]l|qu[eé].*(?:plato|producto)|nombre|aclar/i);
      }
      expect(reply).toBeTruthy();
    }
  });
});

describe('Recuperación general — preguntas comparativas y quitar una unidad', () => {
  it.each([1,2])('quita una sopa de una línea de %s unidades y conserva la bebida', async quantity => {
    const h = harness(products,false);
    h.conv.sessionData.cart = [
      {productId:38,code:38,name:'Sopa De Ajiaco',quantity,unitPrice:10500,note:'sin cilantro'},
      {productId:37,code:37,name:'Limonada Natural',quantity:2,unitPrice:4500},
    ];
    await h.send('Quita una de las sopas de ajiaco, la limonada sí la dejo');
    expect(h.cartRows().find(row=>row.id===37)).toMatchObject({qty:2});
    if(quantity===1) expect(h.cartRows()).toHaveLength(1);
    else expect(h.cartRows().find(row=>row.id===38)).toMatchObject({qty:1,note:'sin cilantro'});
  });
  it('no elige entre varios paquetes ni cambia cantidades', async () => {
    const h = harness(products,false);
    h.conv.sessionData.cart = [
      {productId:985,code:985,name:'Tres Arepas Doradas',quantity:2,unitPrice:9000},
      {productId:986,code:986,name:'Dos Empanadas',quantity:2,unitPrice:7000},
    ];
    const before = structuredClone(h.conv.sessionData);
    await h.send('Quita uno de los paquetes');
    expect(h.conv.sessionData).toEqual(before);
    expect(h.replies.at(-1)).toMatch(/cu[aá]l plato|nombre/i);
  });
  it('pide aclaración al quitar y conservar la misma sopa', async () => {
    const h = harness(products,false);
    h.conv.sessionData.cart = [{productId:38,code:38,name:'Sopa De Ajiaco',quantity:2,unitPrice:10500}];
    const before = structuredClone(h.conv.sessionData);
    await h.send('Quita una de las sopas de ajiaco, la sopa de ajiaco sí la dejo');
    expect(h.conv.sessionData).toEqual(before);
    expect(h.replies.at(-1)).toMatch(/quitar y conservar/i);
  });
  const bowls = [
    {id:987,code:987,name:'Bowl Mini',price:12000,categoryName:'Bowls',availableNow:true,attributes:[]},
    {id:988,code:988,name:'Bowl Familiar',price:28000,categoryName:'Bowls',availableNow:true,attributes:[]},
  ];
  it.each(['Cuál es la más pequeña?','Cuál es la más barata?'])('responde una comparación en otro catálogo y conserva la selección: %s', async question => {
    const h = harness(bowls,false);
    h.conv.sessionData.pendingMatch = {query:'Tres bowls',quantity:3,intent:'order',candidates:bowls};
    const before = structuredClone(h.conv.sessionData);
    await h.send(question);
    expect(h.conv.sessionData).toEqual(before);
    expect(h.replies.at(-1)).toMatch(/Bowl Mini/);
    await h.send('Bowl Familiar');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:988,qty:3})]);
  });
});

describe('Comparación de platos — solo hechos del catálogo', () => {
  it.each([true,false])('no inventa textura ni compra al recomendar pescados (agent: %s)', async enabled => {
    const h = harness(products,enabled);
    await h.send('Estoy entre mojarra y trucha, ¿qué me recomiendas?');
    expect(h.cartRows()).toEqual([]);
    expect(h.agent.runTurn).not.toHaveBeenCalled();
    expect(h.replies.at(-1)).toMatch(/Mojarra/);
    expect(h.replies.at(-1)).toMatch(/Trucha/);
    expect(h.replies.at(-1)).not.toMatch(/m[aá]s suave|m[aá]s tradicional/);
  });
  it('compara otro catálogo y conserva el pedido pendiente', async () => {
    const menu = [
      {id:989,code:989,name:'Bowl Andino',description:'Con quinoa',price:17000,availableNow:true,attributes:[]},
      {id:990,code:990,name:'Wrap Oriental',description:'Con arroz',price:14000,availableNow:true,attributes:[]},
    ];
    const h = harness(menu,false);
    h.conv.sessionData.pendingMatch = {query:'Dos platos',quantity:2,intent:'order',candidates:menu};
    const before = structuredClone(h.conv.sessionData);
    await h.send('Estoy entre Bowl Andino y Wrap Oriental, ¿qué me recomiendas?');
    expect(h.conv.sessionData).toEqual(before);
    expect(h.replies.at(-1)).toMatch(/quinoa/);
    expect(h.replies.at(-1)).toMatch(/arroz/);
    expect(h.replies.at(-1)).not.toMatch(/m[aá]s saludable|m[aá]s suave/);
  });
});

describe('Checkout breve — productos y dirección en el mismo turno', () => {
  const bowl = {id:991,code:991,name:'Bowl Mediterraneo',price:17000,availableNow:true,attributes:[]};
  it.each([
    {text:'Quiero una sopa de menudencias para la calle 48 sur 87 86',id:20,menu:products},
    {text:'Quiero un pollo frito para la calle 48 sur 87 86',id:1,menu:products},
    {text:'Quiero un Bowl Mediterraneo para la calle 48 sur 87 86',id:991,menu:[bowl]},
    {text:'Dos churrascos y una limonada natural para la calle 48 sur 87 86',id:17,menu:products},
  ])('pasa al pago sin preguntar algo más: $text', async ({text,id,menu}) => {
    const h = harness(menu,false);
    h.cfg.paymentMethods = DEFAULT_PAYMENT_METHODS.map(method=>({...method,enabled:method.flow!=='mercadopago'}));
    Object.assign(h.cfg,{paymentInstructions:'Puedes pagar contraentrega, transferencia o con el link de Mercado Pago.'});
    Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164});
    await h.sendQueued(text);
    expect(h.cartRows().find(row=>row.id===id)).toBeTruthy();
    expect(h.conv.state).toBe('awaiting_payment');
    expect(h.conv.sessionData.address).toMatch(/48 sur 87 86/i);
    expect(h.replies).toHaveLength(1);
    expect(h.replies[0]).toMatch(/c[oó]mo pagas/i);
    expect(h.replies[0]).not.toMatch(/algo m[aá]s|mercado pago/i);
  });
  it('si ya indicó transferencia pasa a confirmar sin crear la orden', async () => {
    const h = harness(products,false);
    Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164});
    await h.sendQueued('Una sopa de menudencias para la calle 48 sur 87 86, pago por transferencia');
    expect(h.conv.state).toBe('awaiting_final_confirm');
    expect(h.replies.join(' ')).toMatch(/confirmar/i);
    expect(h.replies.join(' ')).not.toMatch(/algo m[aá]s/i);
    expect(h.cartRows()).toEqual([expect.objectContaining({id:20,qty:1})]);
  });
  it('resuelve la sopa pendiente antes de pasar al pago y conserva dos unidades', async () => {
    const h = harness(products,false);
    Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164});
    await h.sendQueued('Dos sopas para la calle 48 sur 87 86');
    expect(h.cartRows()).toEqual([]);
    expect(h.conv.state).not.toBe('awaiting_payment');
    expect(h.replies.at(-1)).toMatch(/prefieres|cu[aá]l/i);
    h.replies.length=0;
    await h.sendQueued('Ajiaco');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:38,qty:2})]);
    expect(h.conv.state).toBe('awaiting_payment');
    expect(h.replies).toHaveLength(1);
    expect(h.replies[0]).not.toMatch(/algo m[aá]s/i);
  });
  it('una consulta de precio con dirección no compra ni inicia pago', async () => {
    const h = harness(products,false);
    await h.sendQueued('Cuánto cuesta una sopa de menudencias para la calle 48 sur 87 86?');
    expect(h.cartRows()).toEqual([]);
    expect(h.conv.state).not.toBe('awaiting_payment');
    expect(h.replies.join(' ')).not.toMatch(/c[oó]mo pagas/i);
  });
});

describe('Pedido y conjunto fuera de cobertura', () => {
  it('una coincidencia dudosa conserva la sopa y pide ubicación sin afirmar falta de cobertura', async () => {
    const h = harness(products, false);
    h.cfg.deliveryFeeMode = 'route';
    h.service.deliveryRouting = {quoteDeliveryFee: jest.fn().mockResolvedValue({
      ok:false,reason:'address_ambiguous',message:'No pude identificar con seguridad ese conjunto. ¿Me compartes la ubicación o calle y número?',
    })};
    const reply = await h.send('hola vecino buenos dias me gustaria ordenar una sopa de menudencias para plazuelas de san esteban');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:20,qty:1})]);
    expect(reply).toMatch(/menudencias/i);
    expect(reply).toMatch(/ubicaci[oó]n/i);
    expect(reply).not.toMatch(/fuera de cobertura|c[oó]mo pagas|Algo m[aá]s/i);
    expect(h.conv.sessionData.deliveryOutOfCoverage).toBe(false);
    expect(h.conv.sessionData.deliveryFeeCalculated).toBeNull();
    expect(h.conv.state).not.toBe('awaiting_payment');
  });

  const coverage = 'Esa dirección queda a *~6.7 km* por ruta y está *fuera de cobertura* (máx. 5.5 km). ¿Me das otra dirección más cerca o prefieres *recojo* en el local?';
  function outOfRange(h: ReturnType<typeof harness>) {
    h.cfg.deliveryFeeMode = 'route';
    h.service.deliveryRouting = {
      quoteDeliveryFee: jest.fn().mockResolvedValue({
        ok: false,
        reason: 'out_of_coverage',
        distanceKm: 6.7,
        message: coverage,
      }),
    };
  }
  it.each([false, true])('anota la sopa y dice la cobertura (agent %s)', async (agent) => {
    const h = harness(products, agent);
    outOfRange(h);
    const reply = await h.send('hola vecino buenos dias me gustaria ordenar una sopa de menudencias para plazuelas de san esteban');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 20, qty: 1 })]);
    expect(h.conv.sessionData.address).toMatch(/plazuelas de san esteban/i);
    expect(reply).toMatch(/menudencias/i);
    expect(reply).toMatch(/fuera de cobertura/i);
    expect(reply).toMatch(/6\.7 km/);
    expect(h.conv.state).not.toBe('awaiting_payment');
    expect(h.replies.filter((line) => /fuera de cobertura/i.test(line))).toHaveLength(1);
  });
  it('otro menú conserva el plato cuando el conjunto queda lejos', async () => {
    const menu = [{ id: 9601, code: 9601, name: 'Sopa De La Casa', price: 9000, availableNow: true, hasAttributes: false, attributes: [] }];
    const h = harness(menu, false);
    outOfRange(h);
    const reply = await h.send('hola buenos dias me gustaria ordenar una sopa de la casa para el conjunto de la colina');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 9601, qty: 1 })]);
    expect(h.conv.sessionData.address).toMatch(/conjunto de la colina/i);
    expect(reply).toMatch(/Sopa De La Casa/i);
    expect(reply).toMatch(/fuera de cobertura/i);
    expect(h.conv.state).not.toBe('awaiting_payment');
  });
});

describe('Saludo no es un plato', () => {
  const grocery = 'ola buenas noches\nme envias por favor una libra de arroz, dos aceites y un kilo de azucar';
  it('lista lo que no está y deja fuera el saludo', async () => {
    const h = harness(products, false);
    const reply = await h.send(grocery);
    expect(h.cartRows()).toEqual([]);
    expect(reply).toMatch(/libra de arroz/i);
    expect(reply).toMatch(/aceite/i);
    expect(reply).toMatch(/azucar|azúcar/i);
    expect(reply).not.toMatch(/buenas noches|me envias|envías/i);
    expect(h.agent.runTurn).not.toHaveBeenCalled();
  });
  it('el mismo saludo sí pide un plato de la carta', async () => {
    const h = harness(products, false);
    const reply = await h.send('ola buenas noches\nme envias por favor un churrasco');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 17, qty: 1 })]);
    expect(reply).toMatch(/Churrasco/i);
    expect(reply).not.toMatch(/buenas noches|me envias|envías/i);
  });
  it('en otra carta el saludo tampoco entra en la lista', async () => {
    const menu = [{ id: 9611, code: 9611, name: 'Taco Al Pastor', price: 12000, availableNow: true, hasAttributes: false, attributes: [] }];
    const h = harness(menu, false);
    const reply = await h.send(grocery);
    expect(h.cartRows()).toEqual([]);
    expect(reply).toMatch(/libra de arroz/i);
    expect(reply).toMatch(/aceite/i);
    expect(reply).toMatch(/azucar|azúcar/i);
    expect(reply).not.toMatch(/buenas noches|me envias|envías|Taco Al Pastor/i);
  });
});

describe('Disculpa por chat equivocado', () => {
  const apology = 'ay perdon me confunci pense que hablaba con el supermercado';
  const grocery = 'hola buenas noches\nme envias por favor una libra de arroz, dos aceites y un kilo de azucar';
  it('no repite el pedido ni anota la disculpa como dirección', async () => {
    const h = harness(products, false);
    await h.send(grocery);
    expect(h.conv.sessionData.pendingMultiOrder?.unresolved?.length).toBeGreaterThan(0);
    h.replies.length = 0;
    const reply = await h.send(apology);
    expect(h.conv.sessionData.pendingMultiOrder).toBeFalsy();
    expect(h.conv.sessionData.address).toBeFalsy();
    expect(h.cartRows()).toEqual([]);
    expect(reply).toMatch(/no es un pedido ni una direcci[oó]n/i);
    expect(reply).not.toMatch(/buenas noches|libra de arroz|anot[eé] esa direcci[oó]n/i);
    h.replies.length = 0;
    const again = await h.send(apology);
    expect(h.conv.sessionData.address).toBeFalsy();
    expect(again).not.toMatch(/anot[eé] esa direcci[oó]n/i);
    expect(h.agent.runTurn).not.toHaveBeenCalled();
  });
  it('con el agente prendido tampoco guarda el supermercado como domicilio', async () => {
    const h = harness(products, true);
    h.conv.sessionData.pendingMultiOrder = {
      confident: [],
      ambiguous: [],
      unresolved: ['libra de arroz'],
      needsAttributes: [],
    };
    const reply = await h.send(apology);
    expect(h.agent.runTurn).not.toHaveBeenCalled();
    expect(h.conv.sessionData.address).toBeFalsy();
    expect(h.conv.sessionData.pendingMultiOrder).toBeFalsy();
    expect(reply).not.toMatch(/anot[eé] esa direcci[oó]n|libra de arroz/i);
  });
  it('en otra carta la disculpa deja el pedido que sí era de ese local', async () => {
    const menu = [{ id: 9621, code: 9621, name: 'Taco Al Pastor', price: 12000, availableNow: true, hasAttributes: false, attributes: [] }];
    const h = harness(menu, false);
    await h.send('un taco al pastor');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 9621, qty: 1 })]);
    const reply = await h.send(apology);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 9621, qty: 1 })]);
    expect(h.conv.sessionData.address).toBeFalsy();
    expect(reply).toMatch(/Taco Al Pastor/i);
    expect(reply).not.toMatch(/anot[eé] esa direcci[oó]n/i);
  });
  it('un supermercado con calle sigue siendo dirección, y perdón de mango no es disculpa de chat', () => {
    expect(isWrongChatApology(apology)).toBe(true);
    expect(isWrongChatApology('perdon de mango en agua bajito de azucar')).toBe(false);
    expect(looksLikeAddressOnlyMessage(apology)).toBe(false);
    expect(looksLikeAddressOnlyMessage('para el supermercado exito calle 80 20')).toBe(true);
  });
});

describe('Charla en inglés no es un pedido', () => {
  const thanksBeans = 'thank you so much\nbut do you have some beans or something like that?';
  it.each([false, true])('no lista thank you ni beans como platos (agent %s)', async (agent) => {
    const h = harness(products, agent);
    const reply = await h.send(thanksBeans);
    expect(h.cartRows()).toEqual([]);
    expect(h.conv.sessionData.pendingMultiOrder).toBeFalsy();
    expect(reply || '').not.toMatch(/Entendí varios platos|escribe \*?sí\*?/i);
    expect(reply || '').not.toMatch(/no manejamos:\s*_?thank you/i);
    expect(reply || '').toMatch(/beans|no tenemos|no manejamos/i);
  });
  it('thank you so much suelto es cortesía', async () => {
    const h = harness(products, false);
    const reply = await h.send('thank you so much');
    expect(h.cartRows()).toEqual([]);
    expect(h.conv.sessionData.pendingMultiOrder).toBeFalsy();
    expect(reply || '').toMatch(/con gusto|cuando quieras/i);
    expect(reply || '').not.toMatch(/Entendí varios platos|thank you so much/i);
  });
  it('en otra carta la misma pregunta tampoco arma un multi vacío', async () => {
    const menu = [
      { id: 9801, code: 9801, name: 'Taco Al Pastor', price: 12000, availableNow: true, hasAttributes: false, attributes: [] },
    ];
    const h = harness(menu, false);
    const reply = await h.send(thanksBeans);
    expect(h.cartRows()).toEqual([]);
    expect(h.conv.sessionData.pendingMultiOrder).toBeFalsy();
    expect(reply || '').not.toMatch(/Entendí varios platos|escribe \*?sí\*?/i);
    expect(reply || '').toMatch(/beans|no tenemos|no manejamos/i);
  });
  it('sí sigue listando un mercado que no está en la carta', async () => {
    const h = harness(products, false);
    const reply = await h.send('ola buenas noches\nme envias por favor una libra de arroz, dos aceites y un kilo de azucar');
    expect(reply || '').toMatch(/libra de arroz/i);
    expect(reply || '').toMatch(/aceite/i);
  });
});

describe('Mensaje largo — varios platos y dirección juntos', () => {
  const ready = (h: ReturnType<typeof harness>) => {
    Object.assign(h.conv.sessionData, { phoneConfirmed: true, contactPhone: h.conv.phoneE164 });
  };
  const fiction = [
    { id: 9701, code: 9701, name: 'Taco Al Pastor', price: 14000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 9702, code: 9702, name: 'Sopa De La Casa', price: 9000, availableNow: true, hasAttributes: false, attributes: [] },
  ];

  it.each([false, true])('saludo, dos platos, nota y calle (agent %s)', async (agent) => {
    const h = harness(products, agent);
    ready(h);
    const reply = await h.sendQueued('hola buenas noches me envias por favor dos churrascos sin ensalada y una sopa de mondongo para la calle 48 sur 87 86');
    expect(h.cartRows().find((row) => row.id === 17)).toEqual(expect.objectContaining({ qty: 2, note: expect.stringMatching(/sin ensalada/i) }));
    expect(h.cartRows().find((row) => row.id === 45)).toEqual(expect.objectContaining({ qty: 1 }));
    expect(h.conv.sessionData.address).toMatch(/48 sur 87 86/i);
    expect(reply || '').not.toMatch(/buenas noches|me envias/i);
  });

  it.each([false, true])('en otra carta el mismo mensaje largo (agent %s)', async (agent) => {
    const h = harness(fiction, agent);
    ready(h);
    const reply = await h.sendQueued('hola buenas noches me envias por favor dos tacos al pastor sin cebolla y una sopa de la casa para la calle 48 sur 87 86');
    expect(h.cartRows().find((row) => row.id === 9701)).toEqual(expect.objectContaining({ qty: 2, note: expect.stringMatching(/sin cebolla/i) }));
    expect(h.cartRows().find((row) => row.id === 9702)).toEqual(expect.objectContaining({ qty: 1 }));
    expect(h.conv.sessionData.address).toMatch(/48 sur 87 86/i);
    expect(reply || '').not.toMatch(/buenas noches|me envias/i);
  });

  it.each([false, true])('tres líneas con cantidades, torre y apto (agent %s)', async (agent) => {
    const h = harness(products, agent);
    const reply = await h.send('ola buenas noches\ndos ajiacos y un churrasco\nes para la carrera 7 #20-30 torre 2 apto 5');
    expect(h.cartRows().find((row) => row.id === 38)).toEqual(expect.objectContaining({ qty: 2 }));
    expect(h.cartRows().find((row) => row.id === 17)).toEqual(expect.objectContaining({ qty: 1 }));
    expect(h.conv.sessionData.address).toMatch(/carrera 7/i);
    expect(h.conv.sessionData.address).toMatch(/torre 2/i);
    expect(h.conv.sessionData.address).toMatch(/apto 5/i);
    expect(reply || '').not.toMatch(/buenas noches/i);
  });

  it('en otra carta tres líneas conservan cantidad y apto', async () => {
    const h = harness(fiction, false);
    await h.send('hola\ndos tacos al pastor y una sopa de la casa\nes para la calle 10 #20-30 torre 3 apto 8');
    expect(h.cartRows().find((row) => row.id === 9701)).toEqual(expect.objectContaining({ qty: 2 }));
    expect(h.cartRows().find((row) => row.id === 9702)).toEqual(expect.objectContaining({ qty: 1 }));
    expect(h.conv.sessionData.address).toMatch(/calle 10/i);
    expect(h.conv.sessionData.address).toMatch(/torre 3/i);
    expect(h.conv.sessionData.address).toMatch(/apto 8/i);
  });

  it.each([false, true])('dos platos, plazuelas completas y transferencia (agent %s)', async (agent) => {
    const h = harness(products, agent);
    ready(h);
    await h.sendQueued('me envias un pollo frito y una limonada natural para plazuelas de san esteban, pago por transferencia');
    expect(h.cartRows().find((row) => row.id === 1)).toEqual(expect.objectContaining({ qty: 1 }));
    expect(h.cartRows().find((row) => row.id === 37)).toEqual(expect.objectContaining({ qty: 1 }));
    expect(h.conv.sessionData.address).toMatch(/plazuelas de san esteban/i);
    expect(h.conv.sessionData.paymentMethod).toBe('transfer');
  });

  it.each([false, true])('un plato que no está no se come a los otros ni a la calle (agent %s)', async (agent) => {
    const h = harness(products, agent);
    const reply = await h.send('hola me envias por favor un churrasco, una malteada y una sopa de mondongo para la calle 7 #20-30');
    const pending = h.conv.sessionData.pendingMultiOrder;
    const known = h.cartRows().map(row=>row.id);
    expect(known).toEqual(expect.arrayContaining([17, 45]));
    expect(h.replies.join(' ')).toMatch(/malteada/i);
    expect(reply || '').not.toMatch(/me envias|buenas noches/i);
    expect(h.conv.sessionData.address).toMatch(/calle 7/i);
    await h.send('sí');
    expect(h.cartRows().find((row) => row.id === 17)).toEqual(expect.objectContaining({ qty: 1 }));
    expect(h.cartRows().find((row) => row.id === 45)).toEqual(expect.objectContaining({ qty: 1 }));
    expect(h.conv.sessionData.address).toMatch(/calle 7/i);
    expect(h.conv.sessionData.pendingMultiOrder).toBeFalsy();
  });

  it.each([false, true])('en otra carta el helado que no está deja los dos platos y la calle (agent %s)', async (agent) => {
    const h = harness(fiction, agent);
    const reply = await h.send('hola me envias por favor un taco al pastor, un helado y una sopa de la casa para la calle 7 #20-30');
    const pending = h.conv.sessionData.pendingMultiOrder;
    const known = h.cartRows().map(row=>row.id);
    expect(known).toEqual(expect.arrayContaining([9701, 9702]));
    expect(h.replies.join(' ')).toMatch(/helado/i);
    expect(reply || '').not.toMatch(/me envias/i);
    expect(h.conv.sessionData.address).toMatch(/calle 7/i);
    await h.send('sí');
    expect(h.cartRows().find((row) => row.id === 9701)).toEqual(expect.objectContaining({ qty: 1 }));
    expect(h.cartRows().find((row) => row.id === 9702)).toEqual(expect.objectContaining({ qty: 1 }));
    expect(h.conv.sessionData.address).toMatch(/calle 7/i);
  });

  it.each([false, true])('nota, dos platos y calle en la misma frase (agent %s)', async (agent) => {
    const h = harness(products, agent);
    await h.sendQueued('Dos churrascos y una sopa de mondongo sin arroz para la calle 48 sur 87 86');
    expect(h.cartRows().find((row) => row.id === 17)).toEqual(expect.objectContaining({ qty: 2 }));
    expect(h.cartRows().find((row) => row.id === 45)).toEqual(expect.objectContaining({ qty: 1 }));
    expect(h.cartRows().find((row) => row.id === 45)?.note || '').toMatch(/sin arroz/i);
    expect(h.cartRows().find((row) => row.id === 17)?.note || '').not.toMatch(/sin arroz/i);
    expect(h.conv.sessionData.address).toMatch(/48 sur 87 86/i);
  });

  it('en otra carta la nota queda en la sopa y la calle también', async () => {
    const h = harness(fiction, false);
    await h.sendQueued('Dos tacos al pastor y una sopa de la casa sin cilantro para la calle 48 sur 87 86');
    expect(h.cartRows().find((row) => row.id === 9701)).toEqual(expect.objectContaining({ qty: 2 }));
    expect(h.cartRows().find((row) => row.id === 9702)?.note || '').toMatch(/sin cilantro/i);
    expect(h.cartRows().find((row) => row.id === 9701)?.note || '').not.toMatch(/sin cilantro/i);
    expect(h.conv.sessionData.address).toMatch(/48 sur 87 86/i);
  });

  it.each([false, true])('cantidad, calle y billete en el mismo mensaje (agent %s)', async (agent) => {
    const h = harness(products, agent);
    ready(h);
    await h.sendQueued('Dos ajiacos para la calle 48 sur 87 86, pago en efectivo con un billete de 50 mil');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 38, qty: 2 })]);
    expect(h.conv.sessionData.address).toMatch(/48 sur 87 86/i);
    expect(String(h.conv.sessionData.cashChangeFor || '')).toMatch(/50/);
    expect(h.conv.sessionData.paymentMethod).toBeTruthy();
  });

  it.each([false, true])('dos platos fuera de cobertura siguen en el carrito (agent %s)', async (agent) => {
    const h = harness(products, agent);
    h.cfg.deliveryFeeMode = 'route';
    h.service.deliveryRouting = {
      quoteDeliveryFee: jest.fn().mockResolvedValue({
        ok: false,
        reason: 'out_of_coverage',
        distanceKm: 6.7,
        message: 'Esa dirección queda a *~6.7 km* por ruta y está *fuera de cobertura* (máx. 5.5 km). ¿Me das otra dirección más cerca o prefieres *recojo* en el local?',
      }),
    };
    const reply = await h.send('hola buenas noches me envias dos churrascos y una sopa de mondongo para plazuelas de san esteban');
    expect(h.cartRows().find((row) => row.id === 17)).toEqual(expect.objectContaining({ qty: 2 }));
    expect(h.cartRows().find((row) => row.id === 45)).toEqual(expect.objectContaining({ qty: 1 }));
    expect(h.conv.sessionData.address).toMatch(/plazuelas de san esteban/i);
    expect(reply || '').toMatch(/fuera de cobertura/i);
    expect(reply || '').not.toMatch(/buenas noches|me envias/i);
    expect(h.conv.state).not.toBe('awaiting_payment');
  });

  it('en otra carta dos platos lejos también se quedan', async () => {
    const h = harness(fiction, false);
    h.cfg.deliveryFeeMode = 'route';
    h.service.deliveryRouting = {
      quoteDeliveryFee: jest.fn().mockResolvedValue({
        ok: false,
        reason: 'out_of_coverage',
        distanceKm: 6.7,
        message: 'Esa dirección queda a *~6.7 km* por ruta y está *fuera de cobertura* (máx. 5.5 km). ¿Me das otra dirección más cerca o prefieres *recojo* en el local?',
      }),
    };
    const reply = await h.send('hola me envias dos tacos al pastor y una sopa de la casa para el conjunto de la colina');
    expect(h.cartRows().find((row) => row.id === 9701)).toEqual(expect.objectContaining({ qty: 2 }));
    expect(h.cartRows().find((row) => row.id === 9702)).toEqual(expect.objectContaining({ qty: 1 }));
    expect(h.conv.sessionData.address).toMatch(/conjunto de la colina/i);
    expect(reply || '').toMatch(/fuera de cobertura/i);
  });

  it.each([false, true])('la dirección va primero y los platos después (agent %s)', async (agent) => {
    const h = harness(products, agent);
    await h.send('para la carrera 15 #45-20 torre 4 apto 12 quiero dos churrascos y una limonada natural');
    expect(h.cartRows().find((row) => row.id === 17)).toEqual(expect.objectContaining({ qty: 2 }));
    expect(h.cartRows().find((row) => row.id === 37)).toEqual(expect.objectContaining({ qty: 1 }));
    expect(h.conv.sessionData.address).toMatch(/carrera 15/i);
    expect(h.conv.sessionData.address).toMatch(/45-20|45 20/i);
    expect(h.conv.sessionData.address).toMatch(/torre 4/i);
    expect(h.conv.sessionData.address).toMatch(/apto 12/i);
  });

  it('en otra carta la calle también va primero', async () => {
    const h = harness(fiction, false);
    await h.send('para la calle 10 #20-30 torre 3 apto 8 quiero dos tacos al pastor y una sopa de la casa');
    expect(h.cartRows().find((row) => row.id === 9701)).toEqual(expect.objectContaining({ qty: 2 }));
    expect(h.cartRows().find((row) => row.id === 9702)).toEqual(expect.objectContaining({ qty: 1 }));
    expect(h.conv.sessionData.address).toMatch(/calle 10/i);
    expect(h.conv.sessionData.address).toMatch(/torre 3/i);
    expect(h.conv.sessionData.address).toMatch(/apto 8/i);
  });

  it.each([false, true])('recojo con dos platos no guarda una calle (agent %s)', async (agent) => {
    const h = harness(products, agent);
    await h.send('quiero dos churrascos y una sopa de mondongo para recoger en el local');
    expect(h.cartRows().find((row) => row.id === 17)).toEqual(expect.objectContaining({ qty: 2 }));
    expect(h.cartRows().find((row) => row.id === 45)).toEqual(expect.objectContaining({ qty: 1 }));
    expect(h.conv.sessionData.orderType).toBe('pickup');
    expect(h.conv.sessionData.address || '').toMatch(/recoge en el local/i);
    expect(h.conv.sessionData.address || '').not.toMatch(/calle|carrera/i);
  });

  it('en otra carta recoger en el local tampoco es una calle', async () => {
    const h = harness(fiction, false);
    await h.send('quiero dos tacos al pastor y una sopa de la casa para recoger en el local');
    expect(h.cartRows().find((row) => row.id === 9701)).toEqual(expect.objectContaining({ qty: 2 }));
    expect(h.cartRows().find((row) => row.id === 9702)).toEqual(expect.objectContaining({ qty: 1 }));
    expect(h.conv.sessionData.orderType).toBe('pickup');
    expect(h.conv.sessionData.address || '').not.toMatch(/calle|carrera/i);
  });
});

describe('Álbum — sobre no soportado seguido de foto válida', () => {
  it('envía solo el carrito y conserva los productos de la foto', async () => {
    jest.useFakeTimers();
    try {
      const h = harness(products,false);
      const envelopeMessage = {waId:'customer',phoneE164:h.conv.phoneE164,messageId:'envelope',messageType:'other',raw:{}};
      const photoMessage = {waId:'customer',phoneE164:h.conv.phoneE164,messageId:'photo',messageType:'image',mediaId:'synthetic-photo',raw:{}};
      h.service.registerIncomingBatch([envelopeMessage,photoMessage]);
      h.service.resolveImageMessage = jest.fn().mockResolvedValue({done:false,text:'Un churrasco y una sopa de ajiaco'});
      const envelope = h.service.handleIncoming(envelopeMessage);
      await jest.advanceTimersByTimeAsync(2100);
      await envelope;
      expect(h.replies).toEqual([]);
      const photo = h.service.handleIncoming(photoMessage);
      await jest.advanceTimersByTimeAsync(2100);
      await photo;
      expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:17,qty:1}),expect.objectContaining({id:38,qty:1})]));
      expect(h.cartRows()).toHaveLength(2);
      expect(h.replies).toHaveLength(1);
      expect(h.replies[0]).toMatch(/carrito/i);
      expect(h.replies[0]).not.toMatch(/no entend[ií]|mejor por.*texto/i);
    } finally { jest.useRealTimers(); }
  });
});

describe('Tanda siguiente — intenciones combinadas y recuperación', () => {
  it('consulta dos pescados y compra solo la bebida independiente', async () => {
    const h = harness(products,false);
    await h.send('Me recomiendas mojarra o trucha? Y agrega una limonada natural');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:37,qty:1})]);
    expect(h.replies.join(' ')).toMatch(/Mojarra/i);
    expect(h.replies.join(' ')).toMatch(/Trucha/i);
    expect(h.replies.join(' ')).not.toMatch(/más suave|más tradicional/);
  });
  it('anota los dos restantes después de retirar una unidad', async () => {
    const h = harness(products,false);
    await h.send('Tres churrascos');
    await h.send('Quita uno de los churrascos');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:17,qty:2})]);
    await h.send('Los dos restantes sin ensalada');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:17,qty:2,note:expect.stringMatching(/sin ensalada/i)})]);
  });
  it('conserva cantidad nota dirección y transferencia en un turno', async () => {
    const h = harness(products,false);
    Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164});
    await h.sendQueued('Dos arroces con pollo sin ensalada para la carrera 7 20 30, pago por transferencia');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:23,qty:2,note:expect.stringMatching(/sin ensalada/i)})]);
    expect(h.conv.sessionData.address).toMatch(/7 20 30/);
    expect(h.conv.sessionData.paymentMethod).toBe('transfer');
    expect(h.conv.state).toBe('awaiting_final_confirm');
    expect(h.replies.join(' ')).not.toMatch(/algo más/i);
  });
  it('consulta el precio mínimo y vuelve a elegir tres broaster', async () => {
    const h = harness(products,false);
    await h.send('Tres pollos');
    const before = structuredClone(h.conv.sessionData);
    await h.send('Cuál es el más barato?');
    expect(h.conv.sessionData).toEqual(before);
    await h.send('Los tres broaster');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:4,qty:3})]);
  });
  it('corrige a dos sopas durante pago sin perder la dirección', async () => {
    const h = harness(products,false);
    Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164});
    await h.sendQueued('Una sopa de menudencias para la calle 48 sur 87 86');
    expect(h.conv.state).toBe('awaiting_payment');
    await h.sendQueued('Perdón, dos sopas, en esa misma dirección');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:20,qty:2})]);
    expect(h.conv.sessionData.address).toMatch(/48 sur 87 86/);
    expect(h.conv.state).toBe('awaiting_payment');
  });
  it('compra referida conserva fecha y hora explícitas', async () => {
    const bowl = {id:991,code:991,name:'Bowl Mediterraneo',price:17000,availableNow:true,attributes:[]};
    const h = harness([bowl],false);
    await h.send('Cuánto cuesta el Bowl Mediterraneo?');
    expect(h.cartRows()).toEqual([]);
    await h.send('Quiero esas diez cajas para el 15/10 a las 14:00');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:991,qty:10})]);
    expect(h.conv.sessionData.address).toBeFalsy();
    expect(h.conv.sessionData.customerNotes).toMatch(/15\/10/);
    expect(h.conv.sessionData.customerNotes).toMatch(/14:00/);
    expect(h.replies.at(-1)).toMatch(/no está reservada/);
  });
  it('retira una unidad de una preparación y conserva la otra', async () => {
    const h = harness(products,false);
    h.conv.sessionData.cart = [
      {productId:14,code:14,name:'Mojarra',quantity:2,unitPrice:32000,attributes:[{attributeName:'Seleccion',attributeValue:'Frita'}]},
      {productId:14,code:14,name:'Mojarra',quantity:3,unitPrice:32000,attributes:[{attributeName:'Seleccion',attributeValue:'Asada'}]},
    ];
    await h.send('Quita una de las fritas, las asadas sí las dejo');
    expect(h.cartRows().find(r=>r.attrs.includes('Seleccion:Frita'))?.qty).toBe(1);
    expect(h.cartRows().find(r=>r.attrs.includes('Seleccion:Asada'))?.qty).toBe(3);
    expect(h.cartRows()).toHaveLength(2);
  });
  it('conserva la primera foto y muestra el fallo de la segunda', async () => {
    const h = harness(products,false);
    h.service.resolveImageMessage = jest.fn()
      .mockResolvedValueOnce({done:false,text:'Un churrasco'})
      .mockImplementationOnce(async () => {await h.service.reply(h.conv,'customer','No pude leer tu foto');return {done:true};});
    await h.sendQueued('',{messageType:'image',mediaId:'valid-photo'});
    expect(h.cartRows()).toEqual([expect.objectContaining({id:17,qty:1})]);
    await h.sendQueued('',{messageType:'image',mediaId:'unreadable-photo'});
    expect(h.cartRows()).toEqual([expect.objectContaining({id:17,qty:1})]);
    expect(h.replies.at(-1)).toMatch(/No pude leer tu foto/);
  });
});

describe('Tanda siguiente portable — límites y otro menú', () => {
  const bowl = {id:991,code:991,name:'Bowl Mediterraneo',price:17000,availableNow:true,attributes:[]};
  const wrap = {id:992,code:992,name:'Wrap Oriental',price:14000,availableNow:true,attributes:[]};
  const tea = {id:993,code:993,name:'Te Helado',price:5000,availableNow:true,attributes:[]};
  it('consulta dos platos de otro menú y compra la bebida explícita', async () => {
    const h = harness([bowl,wrap,tea],false);
    await h.send('Me recomiendas Bowl Mediterraneo o Wrap Oriental? Y agrega dos Te Helado');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:993,qty:2})]);
    expect(h.replies.join(' ')).toMatch(/Bowl Mediterraneo/);
    expect(h.replies.join(' ')).toMatch(/Wrap Oriental/);
  });
  it('compra otro plato con nota dirección y pago sin perder unidades', async () => {
    const h = harness([bowl],false);
    Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164});
    await h.sendQueued('Dos bowls mediterraneos sin cebolla para la carrera 7 20 30, pago por transferencia');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:991,qty:2,note:expect.stringMatching(/sin cebolla/i)})]);
    expect(h.conv.state).toBe('awaiting_final_confirm');
    expect(h.conv.sessionData.address).toMatch(/7 20 30/);
  });
  it('corrige cantidad de otro plato sin modificar dirección ni bebida', async () => {
    const h = harness([bowl,tea],false);
    await h.send('Un Bowl Mediterraneo y un Te Helado');
    await h.send('Perdón, dos bowls mediterraneos');
    expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:991,qty:2}),expect.objectContaining({id:993,qty:1})]));
    expect(h.cartRows()).toHaveLength(2);
  });
  it.each(['Quiero esas diez cajas para el 31/02 a las 14:00','Quiero esas diez cajas para el 15/10 a las 25:00'])('fecha u hora inválida no compra: %s', async text => {
    const h = harness([bowl],false);
    await h.send('Cuánto cuesta el Bowl Mediterraneo?');
    const before = structuredClone(h.conv.sessionData);
    await h.send(text);
    expect(h.conv.sessionData.cart).toEqual(before.cart);
    expect(h.conv.sessionData.customerNotes).toEqual(before.customerNotes);
    expect(h.replies.at(-1)).toMatch(/no es válida/);
  });
  it('perdón sin cantidad no corrige ni duplica el pedido', async () => {
    const h = harness([bowl],false);
    await h.send('Un Bowl Mediterraneo');
    const before = structuredClone(h.conv.sessionData.cart);
    await h.send('Perdón, cuánto cuesta el Bowl Mediterraneo?');
    expect(h.conv.sessionData.cart).toEqual(before);
  });
  it('preguntar si agrega bebida no la compra', async () => {
    const h = harness(products,false);
    await h.send('Me recomiendas mojarra o trucha? Y puedo agregar una limonada natural?');
    expect(h.cartRows()).toEqual([]);
  });
});

describe('Audio hablado — cortesía y pausas no son productos', () => {
  const spoken = 'Me hace. Favor. Me envía un combo de pollo frito, a cambio de las papas un madurito con bocadillo y queso. Y una gaseosa 400ml. Muchas gracias.';
  it.each(['text','audio'])('conserva combo y bebida sin rechazar fragmentos de cortesía (%s)', async type => {
    const h = harness(products,false);
    h.service.resolveAudioToText = jest.fn().mockResolvedValue(spoken);
    await h.sendQueued(type === 'audio' ? '' : spoken,type === 'audio' ? {messageType:'audio',mediaId:'synthetic-audio'} : {});
    const pending = h.conv.sessionData.pendingMultiOrder;
    const ids = [...h.cartRows().map(r=>r.id),...(pending?.confident||[]).map(r=>r.productId),...(pending?.needsAttributes||[]).map(r=>r.productId),...(h.conv.sessionData.pendingAttribute?[h.conv.sessionData.pendingAttribute.productId]:[])];
    expect(ids).toContain(99);
    expect(ids).toContain(28);
    expect(h.replies.join(' ')).not.toMatch(/no manejamos:\s*_?(?:me hace|favor|me envía|muchas)/i);
    expect(h.cartRows().some(r=>/madur/i.test(r.note||'')) || /madur|acompañamiento|cambio/i.test(h.replies.join(' '))).toBe(true);
  });
  it.each([
    'Me hace el favor, me envía dos churrascos. Muchas gracias.',
    'Me hace\nfavor\nme envía\ndos churrascos\nMuchas gracias',
    'Buenas tardes. Por favor. Me manda dos sopas de menudencias. Gracias.',
  ])('no interpreta muletillas como productos: %s', async text => {
    const h = harness(products,false);
    await h.sendQueued(text);
    const id = /churrascos/.test(text)?17:20;
    expect(h.cartRows()).toEqual([expect.objectContaining({id,qty:2})]);
    expect(h.replies.join(' ')).not.toMatch(/no manejamos|Entendí varios platos/i);
  });
  it('cortesía no oculta un producto realmente fuera del catálogo', async () => {
    const h = harness(products,false);
    await h.sendQueued('Me hace el favor, me envía una mazorcada. Muchas gracias.');
    expect(h.cartRows()).toEqual([]);
    expect(h.replies.join(' ')).toMatch(/mazorcada/i);
    expect(h.replies.join(' ')).toMatch(/no.*(?:manejamos|tenemos|carta)/i);
  });
  it('otro menú conserva cantidades en un pedido hablado', async () => {
    const menu = [{id:991,code:991,name:'Bowl Mediterraneo',price:17000,availableNow:true,attributes:[]}];
    const h = harness(menu,false);
    await h.sendQueued('Me hace el favor. Me envía dos bowls mediterraneos. Muchas gracias.');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:991,qty:2})]);
    expect(h.replies.join(' ')).not.toMatch(/no manejamos/i);
  });
});

describe('Audio hablado — sustitución exacta reportada', () => {
  it.each(['text','audio'])('combo frito cambia su bebida sin comprar la gaseosa (%s)', async type => {
    const h = harness(products,false);
    const text = 'me hace el favor me envia un combo frito a cambio de la gaseosa un madurito con bocadillo y queso, muchas gracias';
    h.service.resolveAudioToText = jest.fn().mockResolvedValue(text);
    await h.sendQueued(type==='audio'?'':text,type==='audio'?{messageType:'audio',mediaId:'exact-spoken'}:{});
    const session = h.conv.sessionData;
    const rows = [...session.cart,...(session.pendingMultiOrder?.confident||[]),...(session.pendingMultiOrder?.needsAttributes||[])];
    expect(rows.some(row=>row.productId===99) || session.pendingAttribute?.productId===99).toBe(true);
    expect(rows.every(row=>row.productId===99)).toBe(true);
    expect(h.replies.join(' ')).not.toMatch(/no manejamos:\s*_?(?:me hace|favor|me envía|combo frito a cambio)/i);
    const notes = [...rows.map(row=>row.note||''),session.pendingAttribute?.sourceText||'',h.replies.join(' ')].join(' ');
    expect(notes).toMatch(/gaseosa/i);
    expect(notes).toMatch(/madurito con bocadillo y queso/i);
  });
});

describe('PDF 11/10 — primeros tres chats y equivalentes portables', () => {
  const weekend = products.map(p=>[41,45].includes(p.id)?{...p,name:p.name+' (Fines de semana)'}:p);
  const pendingIds = (h: ReturnType<typeof harness>) => {
    const s = h.conv.sessionData;
    return [...s.cart.map(row=>row.productId),...(s.pendingMultiOrder?.confident||[]).map(row=>row.productId),...(s.pendingMultiOrder?.needsAttributes||[]).map(row=>row.productId),...(s.pendingAttribute?[s.pendingAttribute.productId]:[])];
  };
  it('chat 1: mondongo no ofrece ajiaco ni sopas con otra preparación', async () => {
    const h = harness(weekend,false);
    await h.sendQueued('1 sopa de mondongo, medio pollo frito y un platano maduro con bocdillo y queso');
    const s = h.conv.sessionData;
    const candidates = [...(s.pendingMatch?.candidates||[]),...(s.pendingMultiOrder?.ambiguous||[]).flatMap(row=>row.candidates)];
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every(p=>/mondongo/i.test(p.name))).toBe(true);
    expect(pendingIds(h)).toEqual(expect.arrayContaining([2,53]));
    expect(h.replies.join(' ')).not.toMatch(/Sopa De Ajiaco/);
  });
  it('chat 2: ejecutivo conserva menudencias nota y dirección sin bebida adicional', async () => {
    const h = harness(products,false);
    Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164});
    await h.sendQueued('Es para pedir el menú ejecutivo con pollo BROASTER, con papas a la francesa, pierna pernil el arroz, sopa de menudencias y la gaseosa, me puedes dar porfa el menú sin ensalada.\nEs para la calle 7 #20-30 torre 5 int 2 apto 402');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:18,qty:1,note:expect.stringMatching(/sin ensalada/i),attrs:expect.arrayContaining(['Presa:Pierna Pernil','Sopa:Menudencias'])})]);
    expect(h.conv.sessionData.address).toMatch(/20-30/);
    expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
    expect(h.conv.state).toBe('awaiting_payment');
  });
  it('chat 2 en un solo párrafo: la dirección no se lleva el pedido', async () => {
    const h = harness(products, false);
    Object.assign(h.conv.sessionData, { phoneConfirmed: true, contactPhone: h.conv.phoneE164 });
    await h.sendQueued('Es para pedir el menú ejecutivo con pollo BROASTER, con papas a la francesa, pierna pernil el arroz, sopa de menudencias y la gaseosa, me puedes dar porfa el menú sin ensalada. Es para parques de Castilla calle 6D #80B - 89 torre 5 int 2 apto 402');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 18, qty: 1, note: expect.stringMatching(/sin ensalada/i), attrs: expect.arrayContaining(['Presa:Pierna Pernil', 'Sopa:Menudencias']) })]);
    expect(h.conv.sessionData.address).toMatch(/parques de Castilla/i);
    expect(h.conv.sessionData.address).toMatch(/402/);
    expect(h.conv.sessionData.address).not.toMatch(/ejecutivo|menudencias|ensalada/i);
    expect(h.conv.state).toBe('awaiting_payment');
  });
  it('otro menú en un solo párrafo: la dirección no se lleva el pedido', async () => {
    const bowl = { id: 914, code: 914, name: 'Bowl Andino', price: 18000, availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Base', options: ['Quinoa', 'Arroz'] }] };
    const h = harness([bowl], false);
    Object.assign(h.conv.sessionData, { phoneConfirmed: true, contactPhone: h.conv.phoneE164 });
    await h.sendQueued('Quiero un Bowl Andino con quinoa, sin cebolla. Es para parques de Castilla calle 6D #80B - 89 torre 5 int 2 apto 402');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 914, qty: 1 })]);
    expect(h.conv.sessionData.address).toMatch(/parques de Castilla/i);
    expect(h.conv.sessionData.address).toMatch(/402/);
    expect(h.conv.sessionData.address).not.toMatch(/bowl|quinoa|cebolla/i);
  });
  it('chat 3: respuesta de ejecutivo no compra un pollo entero', async () => {
    const h = harness(products,false);
    await h.sendQueued('Quiero pedir un almuerzo ejecutivo por favor');
    expect(h.cartRows()).toEqual([]);
    await h.sendQueued('Mondongo pollo frito pierna pernil papa salada');
    expect(pendingIds(h)).toContain(22);
    expect(pendingIds(h)).not.toContain(1);
    await h.sendQueued('Y de tomar me puedes enviar limonada?');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:22,qty:1,attrs:expect.arrayContaining(['Presa:Pierna Pernil','Sopa:Mondongo','Bebida:Limonada'])})]);
    expect(h.cartRows()[0].note).toMatch(/papa salada/i);
  });
  const lunch = {id:8701,code:8701,name:'Menu Vegetariano',description:'Incluye sopa, arroz, ensalada y bebida',price:18000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sopa',options:['Calabaza','Lentejas']},{attributeName:'Bebida',options:['Agua','Te']}]};
  const alt = [lunch,{id:8702,code:8702,name:'Sopa De Lentejas',price:6000,availableNow:true,attributes:[]},{id:8703,code:8703,name:'Te Helado',price:4000,availableNow:true,attributes:[]}];
  it('otro menú: sopa y bebida incluidas no crean líneas adicionales', async () => {
    const h = harness(alt,false);
    await h.sendQueued('Un menu vegetariano con sopa de lentejas y la bebida te, sin ensalada');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:8701,qty:1,attrs:expect.arrayContaining(['Sopa:Lentejas','Bebida:Te']),note:expect.stringMatching(/sin ensalada/i)})]);
  });
  it('otro menú: una sopa extra explícita se agrega por separado', async () => {
    const h = harness(alt,false);
    await h.sendQueued('Un menu vegetariano con sopa de lentejas y bebida te, y una sopa de lentejas adicional aparte');
    expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:8701,qty:1}),expect.objectContaining({id:8702,qty:1})]));
    expect(h.cartRows()).toHaveLength(2);
  });

  async function sendBurst(h: ReturnType<typeof harness>, texts: string[]) {
    const pending = texts.map((text, index) => h.service.handleIncoming({
      waId: 'customer',
      phoneE164: h.conv.phoneE164,
      messageId: `burst-${index}`,
      messageType: 'text',
      text,
      timestamp: index + 1,
      raw: {},
    }));
    await jest.advanceTimersByTimeAsync(3000);
    await Promise.all(pending);
  }

  it('tres burbujas seguidas del mismo ejecutivo se leen como un solo plato', async () => {
    jest.useFakeTimers();
    try {
      const h = harness(products, false);
      await sendBurst(h, [
        'Quiero pedir un almuerzo ejecutivo por favor',
        'Mondongo pollo frito pierna pernil papa salada',
        'Y de tomar me puedes enviar limonada?',
      ]);
      expect(h.replies).toHaveLength(1);
      expect(h.cartRows()).toEqual([expect.objectContaining({
        id: 22,
        qty: 1,
        attrs: expect.arrayContaining(['Presa:Pierna Pernil', 'Sopa:Mondongo', 'Bebida:Limonada']),
      })]);
      expect(h.cartRows()[0].note).toMatch(/papa salada/i);
      expect(h.cartRows()).toHaveLength(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('otro menú: tres burbujas seguidas no parten el plato en sopa y bebida', async () => {
    jest.useFakeTimers();
    try {
      const h = harness(alt, false);
      await sendBurst(h, [
        'Quiero pedir un menu vegetariano por favor',
        'Sopa de lentejas sin ensalada',
        'Y de tomar la bebida te',
      ]);
      expect(h.replies).toHaveLength(1);
      expect(h.cartRows()).toEqual([expect.objectContaining({
        id: 8701,
        qty: 1,
        attrs: expect.arrayContaining(['Sopa:Lentejas', 'Bebida:Te']),
        note: expect.stringMatching(/sin ensalada/i),
      })]);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('Ejecutivo mal escrito sigue siendo un solo almuerzo', () => {
  const dayMenu = (style: string, id: number) => ({
    id,
    code: id,
    name: `Menu Del Dia Con Pollo ${style}`,
    price: 18000,
    availableNow: true,
    hasAttributes: true,
    attributes: [
      { attributeName: 'Corte', options: ['Pierna', 'Pechuga'] },
      { attributeName: 'Sopa', options: ['Lentejas', 'Verduras'] },
      { attributeName: 'Bebida', options: ['Agua', 'Te'] },
    ],
  });
  const fiction = [
    dayMenu('Frito', 8811),
    dayMenu('Broaster', 8812),
    {
      id: 8813,
      code: 8813,
      name: '1 Pollo Frito',
      price: 30000,
      availableNow: true,
      hasAttributes: true,
      attributes: [{ attributeName: 'Pan', options: ['Blanco', 'Integral'] }],
    },
    { id: 8814, code: 8814, name: 'Sopa De Verduras', price: 8000, availableNow: true, attributes: [] },
  ];

  function ready(h: ReturnType<typeof harness>) {
    Object.assign(h.conv.sessionData, {
      phoneConfirmed: true,
      contactPhone: h.conv.phoneE164,
    });
  }

  it('chat 10:33: eejcutivo frito no compra el pollo ni la sopa sueltos', async () => {
    const h = harness(products, false);
    ready(h);
    await h.sendQueued(
      'es para pedir un eejcutivo con pollo frito, con papa salada, ala pechuga, sopa de mondongo , me puede dar le menu sin enslada por favor, es para plazuela de san esteban',
    );
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 22,
        qty: 1,
        attrs: expect.arrayContaining([
          'Presa:Ala, pechuga',
          'Sopa:Mondongo',
          'Bebida:Colombiana',
        ]),
        note: expect.stringMatching(/sin ensalada/i),
      }),
    ]);
    expect(h.cartRows()[0].note).toMatch(/papa salada/i);
    expect(h.conv.sessionData.address).toMatch(/plazuela de san esteban/i);
    expect(h.conv.sessionData.address).not.toMatch(/ejecutivo|mondongo|ensalada|pollo/i);
    expect(h.conv.state).toBe('awaiting_payment');
  });

  it.each([
    ['ejecutibo con pollo broaster, ala pechuga, sopa de ajiaco, sin ensalada, es para el conjunto los robles', 18, 'Presa:Ala, pechuga', 'Sopa:Ajiaco'],
    ['ejecutio con pollo frito, pierna pernil, sopa de menudencias, papa salada, es para plazuela de san esteban', 22, 'Presa:Pierna Pernil', 'Sopa:Menudencias'],
  ])('typo parecido sigue siendo un ejecutivo: %s', async (tail, id, presa, sopa) => {
    const h = harness(products, false);
    ready(h);
    await h.sendQueued(`quiero un ${tail}`);
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id,
        qty: 1,
        attrs: expect.arrayContaining([presa, sopa, 'Bebida:Colombiana']),
      }),
    ]);
    expect(h.conv.sessionData.address).not.toMatch(/pollo|sopa|ensalada|papa/i);
  });

  it('y un pollo frito sí se suma; la sopa dicha adentro no', async () => {
    const h = harness(products, false);
    await h.sendQueued(
      'un ejecutivo con pollo frito, ala pechuga, sopa de mondongo y un pollo frito',
    );
    const rows = h.cartRows();
    expect(rows.map((row) => row.id).sort()).toEqual([1, 22]);
    expect(rows.find((row) => row.id === 22)?.attrs).toEqual(
      expect.arrayContaining(['Presa:Ala, pechuga', 'Sopa:Mondongo']),
    );
    expect(rows.some((row) => row.id === 45)).toBe(false);
  });

  it('y una sopa de mondongo aparte sí se cobra sola', async () => {
    const h = harness(products, false);
    await h.sendQueued(
      'un ejecutivo con pollo frito, ala pechuga y una sopa de mondongo aparte',
    );
    expect(h.cartRows().map((row) => row.id).sort()).toEqual([22, 45]);
  });

  it('otro menú: pechuga y sopa de verduras no compran el pollo ni la sopa sueltos', async () => {
    const h = harness(fiction, false);
    ready(h);
    await h.sendQueued(
      'es para pedir un menu del dia con pollo frito, con papa salada, pechuga, sopa de verduras, me puede dar le menu sin ensalada por favor, es para plazuela de san esteban',
    );
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 8811,
        qty: 1,
        attrs: expect.arrayContaining(['Corte:Pechuga', 'Sopa:Verduras', 'Bebida:Agua']),
        note: expect.stringMatching(/sin ensalada/i),
      }),
    ]);
    expect(h.cartRows()[0].note).toMatch(/papa salada/i);
    expect(h.conv.sessionData.address).toMatch(/plazuela de san esteban/i);
  });
});

describe('Ejecutivo — bebidas, cantidades y extras parecidos', () => {
  const day = (style: string, id: number) => ({
    id,
    code: id,
    name: `Menu Del Dia Con Pollo ${style}`,
    price: 18000,
    availableNow: true,
    hasAttributes: true,
    attributes: [
      { attributeName: 'Corte', options: ['Pierna', 'Pechuga'] },
      { attributeName: 'Sopa', options: ['Lentejas', 'Verduras'] },
      { attributeName: 'Bebida', options: ['Agua', 'Te'] },
    ],
  });
  const fiction = [
    day('Frito', 8811),
    day('Broaster', 8812),
    {
      id: 8813,
      code: 8813,
      name: '1 Pollo Frito',
      price: 30000,
      availableNow: true,
      hasAttributes: true,
      attributes: [{ attributeName: 'Pan', options: ['Blanco', 'Integral'] }],
    },
    { id: 8814, code: 8814, name: 'Sopa De Verduras', price: 8000, availableNow: true, attributes: [] },
    { id: 8815, code: 8815, name: 'Te Helado', price: 4000, availableNow: true, attributes: [] },
    { id: 8816, code: 8816, name: 'Sopa De Lentejas', price: 7000, availableNow: true, attributes: [] },
  ];

  it.each([
    {
      text: 'un ejecutivo con pollo frito, ala pechuga, sopa de mondongo y de tomar limonada, sin ensalada',
      id: 22,
      attrs: ['Presa:Ala, pechuga', 'Sopa:Mondongo', 'Bebida:Limonada'],
      banned: [1, 37, 45, 41],
    },
    {
      text: 'un eejcutivo con pollo broaster, pierna pernil, sopa de ajiaco y coca cola, sin ensalada',
      id: 18,
      attrs: ['Presa:Pierna Pernil', 'Sopa:Ajiaco', 'Bebida:Coca Cola'],
      banned: [4, 38, 95],
    },
    {
      text: 'quiero el menu ejecutivo con pollo frito, pechuga, menudencias y pepsi, papa salada',
      id: 22,
      attrs: ['Presa:Ala, pechuga', 'Sopa:Menudencias', 'Bebida:Pepsi'],
      banned: [1, 20, 8],
    },
    {
      text: 'un ejecutibo con pollo broaster, ala pechuga, sopa de mondongo y quatro, con yuca frita',
      id: 18,
      attrs: ['Presa:Ala, pechuga', 'Sopa:Mondongo', 'Bebida:Quatro'],
      banned: [4, 45, 41],
    },
    {
      text: 'es para pedir un almuerzo ejecutivo con pollo frito, pierna pernil, sopa de menudencias y la gaseosa, sin ensalda, es para la plazuela de san esteban',
      id: 22,
      attrs: ['Presa:Pierna Pernil', 'Sopa:Menudencias', 'Bebida:Colombiana'],
      banned: [1, 20, 27],
      address: /plazuela de san esteban/i,
      note: /sin ensalada/i,
    },
  ])('un solo almuerzo: $text', async ({ text, id, attrs, banned, address, note }) => {
    const h = harness(products, false);
    Object.assign(h.conv.sessionData, { phoneConfirmed: true, contactPhone: h.conv.phoneE164 });
    await h.sendQueued(text);
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id,
        qty: 1,
        attrs: expect.arrayContaining(attrs),
      }),
    ]);
    expect(banned.every((sku) => !h.cartRows().some((row) => row.id === sku))).toBe(true);
    if (note) expect(h.cartRows()[0].note).toMatch(note);
    if (address) {
      expect(h.conv.sessionData.address).toMatch(address);
      expect(h.conv.sessionData.address).not.toMatch(/ejecutivo|pollo|sopa|ensalada/i);
    }
  });

  it('dos eejcutivos son cantidad 2, no dos platos sueltos', async () => {
    const h = harness(products, false);
    await h.sendQueued(
      'dos eejcutivos con pollo frito, ala pechuga, sopa de mondongo, sin ensalada',
    );
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 22,
        qty: 2,
        attrs: expect.arrayContaining(['Presa:Ala, pechuga', 'Sopa:Mondongo', 'Bebida:Colombiana']),
        note: expect.stringMatching(/sin ensalada/i),
      }),
    ]);
  });

  it('otro menú: dos menús del día no compran pollo ni sopa sueltos', async () => {
    const h = harness(fiction, false);
    await h.sendQueued(
      'dos menus del dia con pollo frito, pechuga, sopa de verduras, sin ensalada',
    );
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 8811,
        qty: 2,
        attrs: expect.arrayContaining(['Corte:Pechuga', 'Sopa:Verduras', 'Bebida:Agua']),
        note: expect.stringMatching(/sin ensalada/i),
      }),
    ]);
  });

  it('y un pollo broaster sí se suma; ajiaco y gaseosa no', async () => {
    const h = harness(products, false);
    await h.sendQueued(
      'un ejecutivo con pollo broaster, pierna pernil, sopa de ajiaco, gaseosa y un pollo broaster',
    );
    const ids = h.cartRows().map((row) => row.id).sort((a, b) => a - b);
    expect(ids).toEqual([4, 18]);
    expect(h.cartRows().find((row) => row.id === 18)?.attrs).toEqual(
      expect.arrayContaining(['Presa:Pierna Pernil', 'Sopa:Ajiaco', 'Bebida:Colombiana']),
    );
  });

  it('y una limonada natural aparte sí se cobra sola', async () => {
    const h = harness(products, false);
    await h.sendQueued(
      'un ejecutivo con pollo frito, ala pechuga, sopa de mondongo y una limonada natural aparte',
    );
    expect(h.cartRows().map((row) => row.id).sort()).toEqual([22, 37]);
  });

  it.each([
    {
      text: 'un menu del dia con pollo broaster, pechuga, sopa de lentejas y la bebida te, sin ensalada',
      id: 8812,
      attrs: ['Corte:Pechuga', 'Sopa:Lentejas', 'Bebida:Te'],
      banned: [8813, 8816, 8815],
    },
    {
      text: 'quiero un menu del dia con pollo frito, pierna, sopa de verduras y agua, con papa salada',
      id: 8811,
      attrs: ['Corte:Pierna', 'Sopa:Verduras', 'Bebida:Agua'],
      banned: [8813, 8814],
      note: /papa salada/i,
    },
  ])('otro menú, un solo plato: $text', async ({ text, id, attrs, banned, note }) => {
    const h = harness(fiction, false);
    await h.sendQueued(text);
    expect(h.cartRows()).toEqual([
      expect.objectContaining({ id, qty: 1, attrs: expect.arrayContaining(attrs) }),
    ]);
    expect(banned.every((sku) => !h.cartRows().some((row) => row.id === sku))).toBe(true);
    if (note) expect(h.cartRows()[0].note).toMatch(note);
  });

  it('otro menú: y un pollo frito sí; la sopa y el té dichos adentro no', async () => {
    const h = harness(fiction, false);
    await h.sendQueued(
      'un menu del dia con pollo frito, pechuga, sopa de verduras, bebida te y un pollo frito',
    );
    expect(h.cartRows().map((row) => row.id).sort()).toEqual([8811, 8813]);
    expect(h.cartRows().find((row) => row.id === 8811)?.attrs).toEqual(
      expect.arrayContaining(['Corte:Pechuga', 'Sopa:Verduras', 'Bebida:Te']),
    );
  });

  it('otro menú: y un té helado aparte sí se cobra solo', async () => {
    const h = harness(fiction, false);
    await h.sendQueued(
      'un menu del dia con pollo frito, pechuga, sopa de lentejas y un te helado aparte',
    );
    expect(h.cartRows().map((row) => row.id).sort()).toEqual([8811, 8815]);
  });
});

describe('Ejecutivo — arroz, papas, ají y cantidad tres', () => {
  const day = {
    id: 8821,
    code: 8821,
    name: 'Menu Del Dia Con Pollo Frito',
    price: 18000,
    availableNow: true,
    hasAttributes: true,
    attributes: [
      { attributeName: 'Corte', options: ['Pierna', 'Pechuga'] },
      { attributeName: 'Sopa', options: ['Lentejas', 'Verduras'] },
      { attributeName: 'Bebida', options: ['Agua', 'Te'] },
    ],
  };
  const fiction = [
    day,
    { id: 8822, code: 8822, name: '1 Pollo Frito', price: 30000, availableNow: true, attributes: [] },
    { id: 8823, code: 8823, name: 'Sopa De Verduras', price: 8000, availableNow: true, attributes: [] },
    { id: 8826, code: 8826, name: 'Sopa De Lentejas', price: 7000, availableNow: true, attributes: [] },
    { id: 8824, code: 8824, name: 'Porcion De Arroz', price: 4000, availableNow: true, attributes: [] },
    { id: 8825, code: 8825, name: 'Porcion De Papa Francesa', price: 4000, availableNow: true, attributes: [] },
  ];

  it.each([
    {
      text: 'el menu ejecutivo con pollo broaster, papas a la francesa, pierna pernil, el arroz, sopa de menudencias y la gaseosa, sin ensalada',
      id: 18,
      attrs: ['Presa:Pierna Pernil', 'Sopa:Menudencias', 'Bebida:Colombiana'],
      banned: [4, 9, 10, 20, 23],
      note: /sin ensalada/i,
    },
    {
      text: 'un eejcutivo con pollo frito, ala, sopa de ajico, manzana, no quiero ensalada y con aji',
      id: 22,
      attrs: ['Presa:Ala, pechuga', 'Sopa:Ajiaco', 'Bebida:Manzana'],
      banned: [1, 25, 38],
      note: /aj[ií].*no quiero ensalada|no quiero ensalada.*aj[ií]/i,
    },
    {
      text: 'un ejecutivo con pollo frito, pechuga, sopa de menundencias, limonada, me lo das sin la ensalada',
      id: 22,
      attrs: ['Presa:Ala, pechuga', 'Sopa:Menudencias', 'Bebida:Limonada'],
      banned: [1, 20, 37],
      note: /sin (?:la )?ensalada/i,
    },
  ])('lo que ya trae el almuerzo no se cobra aparte: $text', async ({ text, id, attrs, banned, note }) => {
    const h = harness(products, false);
    await h.sendQueued(text);
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id,
        qty: 1,
        attrs: expect.arrayContaining(attrs),
        note: expect.stringMatching(note),
      }),
    ]);
    expect(banned.every((sku) => !h.cartRows().some((row) => row.id === sku))).toBe(true);
  });

  it('tres eejcutivos son cantidad 3', async () => {
    const h = harness(products, false);
    await h.sendQueued(
      'tres eejcutivos con pollo broaster, pierna pernil, sopa de mondongos, sin ensalada',
    );
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 18,
        qty: 3,
        attrs: expect.arrayContaining(['Presa:Pierna Pernil', 'Sopa:Mondongo', 'Bebida:Colombiana']),
        note: expect.stringMatching(/sin ensalada/i),
      }),
    ]);
  });

  it('y una sopa de ajiaco adicional sí se cobra sola', async () => {
    const h = harness(products, false);
    await h.sendQueued(
      'un ejecutivo con pollo frito, ala pechuga y una sopa de ajiaco adicional',
    );
    expect(h.cartRows().map((row) => row.id).sort((a, b) => a - b)).toEqual([22, 38]);
  });

  it('otro menú: arroz y papa francesa dichos adentro no se compran', async () => {
    const h = harness(fiction, false);
    await h.sendQueued(
      'un menu del dia con pollo frito, pechuga, sopa de verduras, con arroz y papa francesa, sin ensalada y con aji',
    );
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 8821,
        qty: 1,
        attrs: expect.arrayContaining(['Corte:Pechuga', 'Sopa:Verduras', 'Bebida:Agua']),
        note: expect.stringMatching(/sin ensalada/i),
      }),
    ]);
    expect(h.cartRows()[0].note).toMatch(/aj[ií]/i);
    expect([8822, 8823, 8824, 8825].every((sku) => !h.cartRows().some((row) => row.id === sku))).toBe(true);
  });

  it('otro menú: tres menús del día son cantidad 3', async () => {
    const h = harness(fiction, false);
    await h.sendQueued(
      'tres menus del dia con pollo frito, pierna, sopa de lentejas, sin ensalada',
    );
    expect([8822, 8823, 8826].every((sku) => !h.cartRows().some((row) => row.id === sku))).toBe(true);
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 8821,
        qty: 3,
        attrs: expect.arrayContaining(['Corte:Pierna', 'Sopa:Lentejas', 'Bebida:Agua']),
        note: expect.stringMatching(/sin ensalada/i),
      }),
    ]);
  });
});

describe('Ejecutivo — cantidad cuatro, presa en plural y porción pedida aparte', () => {
  const day = (style: string, id: number) => ({
    id,
    code: id,
    name: `Menu Del Dia Con Pollo ${style}`,
    price: 18000,
    availableNow: true,
    hasAttributes: true,
    attributes: [
      { attributeName: 'Corte', options: ['Pierna', 'Ala'] },
      { attributeName: 'Sopa', options: ['Verduras', 'Lentejas'] },
      { attributeName: 'Bebida', options: ['Agua', 'Te'] },
    ],
  });
  const fiction = [
    day('Frito', 8831),
    day('Broaster', 8832),
    { id: 8833, code: 8833, name: '1 Pollo Frito', price: 30000, availableNow: true, attributes: [] },
    { id: 8834, code: 8834, name: 'Sopa De Lentejas', price: 7000, availableNow: true, attributes: [] },
    { id: 8835, code: 8835, name: 'Porcion De Papa Francesa', price: 4000, availableNow: true, attributes: [] },
  ];

  it('cuatro eejcutivos son un solo almuerzo con cantidad 4', async () => {
    const h = harness(products, false);
    await h.sendQueued(
      'cuatro eejcutivos con pollo frito, pechugas, sopa de menudensias, sin ensalada',
    );
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 22,
        qty: 4,
        attrs: expect.arrayContaining(['Presa:Ala, pechuga', 'Sopa:Menudencias', 'Bebida:Colombiana']),
        note: expect.stringMatching(/sin ensalada/i),
      }),
    ]);
  });

  it('otro menú: cuatro menús no convierten lentejas en té', async () => {
    const h = harness(fiction, false);
    await h.sendQueued(
      'cuatro menus del dia con pollo frito, alas, sopa de lentejas, sin ensalada',
    );
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 8831,
        qty: 4,
        attrs: expect.arrayContaining(['Corte:Ala', 'Sopa:Lentejas', 'Bebida:Agua']),
        note: expect.stringMatching(/sin ensalada/i),
      }),
    ]);
    expect([8833, 8834].every((sku) => !h.cartRows().some((row) => row.id === sku))).toBe(true);
  });

  it('una porción pedida con “y una” sí se cobra aparte del ejecutivo', async () => {
    const h = harness(products, false);
    await h.sendQueued(
      'un ejecutivo con pollo frito, ala, sopa de mondongo y una porcion de papa salada',
    );
    expect(h.cartRows().map((row) => row.id).sort((a, b) => a - b)).toEqual([8, 22]);
    expect(h.cartRows().find((row) => row.id === 22)?.attrs).toEqual(
      expect.arrayContaining(['Presa:Ala, pechuga', 'Sopa:Mondongo', 'Bebida:Colombiana']),
    );
  });

  it('otro menú: una porción dicha aparte no reemplaza el menú', async () => {
    const h = harness(fiction, false);
    await h.sendQueued(
      'un menu del dia con pollo frito, ala, sopa de lentejas y una porcion de papa francesa',
    );
    expect(h.cartRows().map((row) => row.id).sort((a, b) => a - b)).toEqual([8831, 8835]);
    expect(h.cartRows().find((row) => row.id === 8831)?.attrs).toEqual(
      expect.arrayContaining(['Corte:Ala', 'Sopa:Lentejas', 'Bebida:Agua']),
    );
  });

  it('dos estilos de ejecutivo quedan en dos líneas', async () => {
    const h = harness(products, false);
    await h.sendQueued('un ejecutivo con pollo broaster y un ejecutivo con pollo frito');
    expect(h.cartRows().map((row) => row.id).sort((a, b) => a - b)).toEqual([18, 22]);
    expect(h.cartRows().every((row) => row.qty === 1)).toBe(true);
    expect([1, 4].every((sku) => !h.cartRows().some((row) => row.id === sku))).toBe(true);
  });

  it('otro menú: dos estilos quedan en dos líneas y lentejas no eligen té', async () => {
    const h = harness(fiction, false);
    await h.sendQueued(
      'un menu del dia con pollo broaster, sopa de lentejas y un menu del dia con pollo frito, ala',
    );
    expect(h.cartRows().map((row) => row.id).sort((a, b) => a - b)).toEqual([8831, 8832]);
    const broaster = h.cartRows().find((row) => row.id === 8832);
    const frito = h.cartRows().find((row) => row.id === 8831);
    expect(broaster?.attrs).toEqual(expect.arrayContaining(['Sopa:Lentejas', 'Bebida:Agua']));
    expect(frito?.attrs).toEqual(expect.arrayContaining(['Corte:Ala', 'Bebida:Agua']));
    expect(broaster?.attrs.join(' ')).not.toMatch(/Te/);
  });
});

describe('Ejecutivo — estilo mal escrito, cantidad cinco y cambio de sopa', () => {
  const day = (style: string, id: number) => ({
    id,
    code: id,
    name: `Menu Del Dia Con Pollo ${style}`,
    price: 18000,
    availableNow: true,
    hasAttributes: true,
    attributes: [
      { attributeName: 'Corte', options: ['Pierna', 'Pechuga'] },
      { attributeName: 'Sopa', options: ['Verduras', 'Lentejas'] },
      { attributeName: 'Bebida', options: ['Agua', 'Te'] },
    ],
  });
  const fiction = [
    day('Frito', 8841),
    day('Broaster', 8842),
    { id: 8843, code: 8843, name: '1 Pollo Frito', price: 30000, availableNow: true, attributes: [] },
    { id: 8844, code: 8844, name: '1 Pollo Broaster', price: 32000, availableNow: true, attributes: [] },
    { id: 8845, code: 8845, name: 'Sopa De Lentejas', price: 7000, availableNow: true, attributes: [] },
    { id: 8846, code: 8846, name: 'Porcion De Papa Francesa', price: 4000, availableNow: true, attributes: [] },
  ];
  const steak = {
    id: 8847,
    code: 8847,
    name: 'Menu Del Dia Con Ternera',
    price: 19000,
    availableNow: true,
    hasAttributes: true,
    attributes: [
      { attributeName: 'Sopa', options: ['Tomate', 'Verduras'] },
      { attributeName: 'Bebida', options: ['Agua', 'Te'] },
    ],
  };

  it('broster sigue siendo el ejecutivo broaster, no el pollo suelto', async () => {
    const h = harness(products, false);
    await h.sendQueued(
      'un eejcutivo con pollo broster, pierna pernil, sopa de mondongo, sin ensalada',
    );
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 18,
        qty: 1,
        attrs: expect.arrayContaining(['Presa:Pierna Pernil', 'Sopa:Mondongo', 'Bebida:Colombiana']),
        note: expect.stringMatching(/sin ensalada/i),
      }),
    ]);
  });

  it('fritto sigue siendo el ejecutivo frito', async () => {
    const h = harness(products, false);
    await h.sendQueued(
      'un ejecutivo con pollo fritto, pechuga, sopa de ajiaco, sin ensalada',
    );
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 22,
        qty: 1,
        attrs: expect.arrayContaining(['Presa:Ala, pechuga', 'Sopa:Ajiaco', 'Bebida:Colombiana']),
        note: expect.stringMatching(/sin ensalada/i),
      }),
    ]);
  });

  it('otro menú: broster y fritto eligen el estilo y lentejas no eligen té', async () => {
    const broaster = harness(fiction, false);
    await broaster.sendQueued(
      'un menu del dia con pollo broster, sopa de lentejas, sin ensalada',
    );
    expect(broaster.cartRows()).toEqual([
      expect.objectContaining({
        id: 8842,
        qty: 1,
        attrs: expect.arrayContaining(['Sopa:Lentejas', 'Bebida:Agua']),
        note: expect.stringMatching(/sin ensalada/i),
      }),
    ]);
    const fried = harness(fiction, false);
    await fried.sendQueued('un menu del dia con pollo fritto, pechuga, sopa de verduras');
    expect(fried.cartRows()).toEqual([
      expect.objectContaining({
        id: 8841,
        qty: 1,
        attrs: expect.arrayContaining(['Corte:Pechuga', 'Sopa:Verduras', 'Bebida:Agua']),
      }),
    ]);
  });

  it('un broaster y dos fritos quedan en dos líneas', async () => {
    const h = harness(products, false);
    await h.sendQueued('un ejecutivo con pollo broaster y dos ejecutivos con pollo frito');
    expect(h.cartRows()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 18, qty: 1 }),
        expect.objectContaining({ id: 22, qty: 2 }),
      ]),
    );
    expect(h.cartRows()).toHaveLength(2);
    expect([1, 4].every((sku) => !h.cartRows().some((row) => row.id === sku))).toBe(true);
  });

  it('otro menú: un broaster y dos fritos no compran el pollo suelto', async () => {
    const h = harness(fiction, false);
    await h.sendQueued('un menu del dia con pollo broaster y dos menus del dia con pollo frito');
    expect(h.cartRows()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 8842, qty: 1 }),
        expect.objectContaining({ id: 8841, qty: 2 }),
      ]),
    );
    expect(h.cartRows()).toHaveLength(2);
    expect([8843, 8844].every((sku) => !h.cartRows().some((row) => row.id === sku))).toBe(true);
  });

  it('cambiar la sopa no agrega la sopa suelta', async () => {
    const h = harness(products, false);
    await h.sendQueued('un ejecutivo con pollo frito, ala, sopa de ajiaco');
    await h.sendQueued('la sopa que sea mondongo');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 22,
        qty: 1,
        attrs: expect.arrayContaining(['Presa:Ala, pechuga', 'Sopa:Mondongo', 'Bebida:Colombiana']),
      }),
    ]);
  });

  it('otro menú: cambiar a lentejas no elige el té', async () => {
    const h = harness(fiction, false);
    await h.sendQueued('un menu del dia con pollo frito, pechuga, sopa de verduras');
    await h.sendQueued('la sopa que sea lentejas');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 8841,
        qty: 1,
        attrs: expect.arrayContaining(['Corte:Pechuga', 'Sopa:Lentejas', 'Bebida:Agua']),
      }),
    ]);
    expect(h.cartRows().some((row) => row.id === 8845)).toBe(false);
  });

  it('sin cebolla y sin ensalada quedan las dos notas', async () => {
    const h = harness(products, false);
    await h.sendQueued(
      'un ejecutivo con pollo frito, pierna pernil, sopa de ajiaco, sin cebolla y sin ensalada',
    );
    const note = h.cartRows()[0]?.note || '';
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 22,
        qty: 1,
        attrs: expect.arrayContaining(['Presa:Pierna Pernil', 'Sopa:Ajiaco']),
      }),
    ]);
    expect(note).toMatch(/sin cebolla/i);
    expect(note).toMatch(/sin ensalada/i);
  });

  it('otro menú: sin cebolla y sin ensalada no compran sopa ni té', async () => {
    const h = harness(fiction, false);
    await h.sendQueued(
      'un menu del dia con pollo frito, pechuga, sopa de lentejas, sin cebolla y sin ensalada',
    );
    const note = h.cartRows()[0]?.note || '';
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 8841,
        qty: 1,
        attrs: expect.arrayContaining(['Corte:Pechuga', 'Sopa:Lentejas', 'Bebida:Agua']),
      }),
    ]);
    expect(note).toMatch(/sin cebolla/i);
    expect(note).toMatch(/sin ensalada/i);
  });

  it('cinco ejecutivos conservan la cantidad y la plazuela', async () => {
    const h = harness(products, false);
    Object.assign(h.conv.sessionData, { phoneConfirmed: true, contactPhone: h.conv.phoneE164 });
    await h.sendQueued(
      'cinco eejcutivos con pollo frito, ala, sopa de mondongo, sin ensalada, es para plazuela de san esteban',
    );
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 22,
        qty: 5,
        attrs: expect.arrayContaining(['Presa:Ala, pechuga', 'Sopa:Mondongo', 'Bebida:Colombiana']),
        note: expect.stringMatching(/sin ensalada/i),
      }),
    ]);
    expect(h.conv.sessionData.address).toMatch(/plazuela de san esteban/i);
    expect(h.conv.sessionData.address).not.toMatch(/ejecutivo|mondongo|ensalada|pollo/i);
  });

  it('coca cola del almuerzo no compra la botella; la de litro y medio aparte sí', async () => {
    const included = harness(products, false);
    await included.sendQueued(
      'un ejecutivo con pollo frito, ala, sopa de mondongo y de tomar coca cola',
    );
    expect(included.cartRows()).toEqual([
      expect.objectContaining({
        id: 22,
        attrs: expect.arrayContaining(['Bebida:Coca Cola']),
      }),
    ]);
    const bottle = harness(products, false);
    await bottle.sendQueued(
      'un ejecutivo con pollo frito, ala, sopa de mondongo y una coca cola de litro y medio aparte',
    );
    expect(bottle.cartRows().map((row) => row.id)).toEqual([22]);
    expect(bottle.conv.sessionData.pendingAttribute?.productId).toBe(95);
    await bottle.sendQueued('original');
    expect(bottle.cartRows().map((row) => row.id).sort((a, b) => a - b)).toEqual([22, 95]);
    expect(bottle.cartRows().find((row) => row.id === 95)?.attrs).toEqual(
      expect.arrayContaining(['sabor:Original']),
    );
  });

  it('yuca frita dicha adentro es nota; la porción pedida aparte sí se cobra', async () => {
    const note = harness(products, false);
    await note.sendQueued(
      'un ejecutivo con pollo broaster, pierna pernil, sopa de ajiaco, con yuca frita',
    );
    expect(note.cartRows()).toEqual([
      expect.objectContaining({
        id: 18,
        qty: 1,
        note: expect.stringMatching(/yuca frita/i),
      }),
    ]);
    const side = harness(products, false);
    await side.sendQueued(
      'un ejecutivo con pollo broaster, pierna pernil y una porcion de yuca frita',
    );
    expect(side.cartRows().map((row) => row.id).sort((a, b) => a - b)).toEqual([7, 18]);
  });

  it('otro menú: tomate y ternera no eligen el té', async () => {
    const h = harness([steak, { id: 8848, code: 8848, name: 'Sopa De Tomate', price: 6000, availableNow: true, attributes: [] }], false);
    await h.sendQueued('un menu del dia con ternera, sopa de tomate, sin ensalada');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 8847,
        qty: 1,
        attrs: expect.arrayContaining(['Sopa:Tomate', 'Bebida:Agua']),
        note: expect.stringMatching(/sin ensalada/i),
      }),
    ]);
  });

  it('eran tres corrige la cantidad sin perder la sopa', async () => {
    const h = harness(products, false);
    await h.sendQueued('un ejecutivo con pollo frito, ala, sopa de mondongo, sin ensalada');
    await h.sendQueued('eran tres ejecutivos');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 22,
        qty: 3,
        attrs: expect.arrayContaining(['Presa:Ala, pechuga', 'Sopa:Mondongo']),
        note: expect.stringMatching(/sin ensalada/i),
      }),
    ]);
  });

  it('otro menú: eran tres corrige la cantidad y deja el agua', async () => {
    const h = harness(fiction, false);
    await h.sendQueued('un menu del dia con pollo frito, pechuga, sopa de lentejas, sin ensalada');
    await h.sendQueued('eran tres menus');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 8841,
        qty: 3,
        attrs: expect.arrayContaining(['Corte:Pechuga', 'Sopa:Lentejas', 'Bebida:Agua']),
        note: expect.stringMatching(/sin ensalada/i),
      }),
    ]);
  });
});

describe('Ejecutivo — porción aparte, cambio de presa y bebida', () => {
  const day = (style: string, id: number) => ({
    id,
    code: id,
    name: `Menu Del Dia Con Pollo ${style}`,
    price: 18000,
    availableNow: true,
    hasAttributes: true,
    attributes: [
      { attributeName: 'Corte', options: ['Pierna', 'Pechuga'] },
      { attributeName: 'Sopa', options: ['Verduras', 'Lentejas'] },
      { attributeName: 'Bebida', options: ['Agua', 'Te'] },
    ],
  });
  const fiction = [
    day('Frito', 8851),
    day('Broaster', 8852),
    { id: 8853, code: 8853, name: '1 Pollo Frito', price: 30000, availableNow: true, attributes: [] },
    { id: 8854, code: 8854, name: 'Sopa De Lentejas', price: 7000, availableNow: true, attributes: [] },
    { id: 8855, code: 8855, name: 'Porcion De Papa Francesa', price: 4000, availableNow: true, attributes: [] },
    { id: 8856, code: 8856, name: 'Limonada Natural', price: 5000, availableNow: true, attributes: [] },
  ];

  it('el almuerzo con limonada y una porción aparte no compra pollo ni sopa ni limonada suelta', async () => {
    const h = harness(products, false);
    await h.sendQueued(
      'un ejecutivo con pollo frito, ala, sopa de mondongo, de tomar limonada, sin ensalada y una porcion de papa salada',
    );
    expect(h.cartRows().map((row) => row.id).sort((a, b) => a - b)).toEqual([8, 22]);
    expect(h.cartRows().find((row) => row.id === 22)).toEqual(
      expect.objectContaining({
        qty: 1,
        attrs: expect.arrayContaining(['Presa:Ala, pechuga', 'Sopa:Mondongo', 'Bebida:Limonada']),
        note: expect.stringMatching(/sin ensalada/i),
      }),
    );
    expect([1, 37, 45].every((sku) => !h.cartRows().some((row) => row.id === sku))).toBe(true);
  });

  it('otro menú: la porción aparte no elige té ni compra el pollo', async () => {
    const h = harness(fiction, false);
    await h.sendQueued(
      'un menu del dia con pollo frito, pechuga, sopa de lentejas y una porcion de papa francesa',
    );
    expect(h.cartRows().map((row) => row.id).sort((a, b) => a - b)).toEqual([8851, 8855]);
    expect(h.cartRows().find((row) => row.id === 8851)).toEqual(
      expect.objectContaining({
        qty: 1,
        attrs: expect.arrayContaining(['Corte:Pechuga', 'Sopa:Lentejas', 'Bebida:Agua']),
      }),
    );
  });

  it('cambiar la presa y la bebida no compra otro producto', async () => {
    const h = harness(products, false);
    await h.sendQueued('un ejecutivo con pollo frito, pierna pernil, sopa de mondongo');
    await h.sendQueued('la presa que sea ala');
    await h.sendQueued('la bebida que sea limonada');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 22,
        qty: 1,
        attrs: expect.arrayContaining(['Presa:Ala, pechuga', 'Sopa:Mondongo', 'Bebida:Limonada']),
      }),
    ]);
  });

  it('otro menú: cambiar el corte y pedir té deja una sola línea', async () => {
    const h = harness(fiction, false);
    await h.sendQueued('un menu del dia con pollo frito, pierna, sopa de verduras');
    await h.sendQueued('el corte que sea pechuga');
    await h.sendQueued('la bebida que sea te');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 8851,
        qty: 1,
        attrs: expect.arrayContaining(['Corte:Pechuga', 'Sopa:Verduras', 'Bebida:Te']),
      }),
    ]);
  });

  it('sin ensalada y con ensalada en el mismo pedido no guarda las dos', async () => {
    const h = harness(products, false);
    const reply = await h.sendQueued(
      'un ejecutivo con pollo frito, ala, sopa de mondongo, sin ensalada y con ensalada',
    );
    const note = h.cartRows()[0]?.note || '';
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 22,
        qty: 1,
        attrs: expect.arrayContaining(['Presa:Ala, pechuga', 'Sopa:Mondongo']),
      }),
    ]);
    expect(/sin ensalada/i.test(note) && /con ensalada/i.test(note)).toBe(false);
    expect(reply).toMatch(/ensalada|aclar|cu[aá]l/i);
  });

  it('dos eejcutivos fritto quedan en una línea con la pechuga', async () => {
    const h = harness(products, false);
    await h.sendQueued('dos eejcutivos con pollo fritto, pechuga, sin ensalada');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 22,
        qty: 2,
        attrs: expect.arrayContaining(['Presa:Ala, pechuga', 'Bebida:Colombiana']),
        note: expect.stringMatching(/sin ensalada/i),
      }),
    ]);
  });

  it('otro menú: dos menus fritto quedan en una línea y el agua sigue', async () => {
    const h = harness(fiction, false);
    await h.sendQueued('dos menus del dia con pollo fritto, pechuga, sin ensalada');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 8851,
        qty: 2,
        attrs: expect.arrayContaining(['Corte:Pechuga', 'Bebida:Agua']),
        note: expect.stringMatching(/sin ensalada/i),
      }),
    ]);
  });
});


describe('PDF 11/10 — patrones adicionales y menús ficticios', () => {
  const bowl = {id:8801,code:8801,name:'Bowl Mediterraneo',price:17000,availableNow:true,attributes:[]};
  it.each([
    {menu:products,text:'1 arroz con pollo y 2 ajiacos',rows:[{id:23,qty:1},{id:38,qty:2}]},
    {menu:[bowl,{...bowl,id:8802,code:8802,name:'Wrap Oriental'}],text:'1 bowl mediterraneo y 2 wraps orientales',rows:[{id:8801,qty:1},{id:8802,qty:2}]},
  ])('cantidades independientes por plato: $text', async ({menu,text,rows}) => {
    const h = harness(menu,false);await h.sendQueued(text);
    expect(h.cartRows()).toHaveLength(2);
    for(const row of rows)expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining(row)]));
  });
  it.each([
    {menu:products,order:'Dos arroces con pollo',id:23},
    {menu:[bowl],order:'Dos bowls mediterraneos',id:8801},
  ])('dirección por partes no cambia cantidad de $id', async ({menu,order,id}) => {
    const h = harness(menu,false);Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164});
    await h.sendQueued(order);await h.sendQueued('Para la calle 7 #20-30');await h.sendQueued('Torre 3 apto 607');
    expect(h.cartRows()).toEqual([expect.objectContaining({id,qty:2})]);
    expect(h.conv.sessionData.address).toMatch(/20-30/);
    expect(h.conv.sessionData.address).toMatch(/torre 3 apto 607/i);
  });
  it.each(['Gracias','Porfa','Mil gracias veci'])('cortesía aislada conserva el pedido: %s', async text=>{
    const h=harness([bowl],false);await h.sendQueued('Dos bowls mediterraneos');
    const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued(text);
    expect(h.conv.sessionData.cart).toEqual(before);expect(h.replies.at(-1)).not.toMatch(/no manejamos/i);
  });
  it.each(['Cuánto suma?','Y cuánto es el total?'])('consultar total no cambia platos: %s', async text=>{
    const h=harness(products,false);await h.sendQueued('Un arroz con pollo y dos ajiacos');
    const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued(text);
    expect(h.conv.sessionData.cart).toEqual(before);expect(h.replies.at(-1)).toMatch(/50[.,]500/);
  });
  it.each(['Qué vale el Bowl Mediterraneo?','El Bowl Mediterraneo alcanza para cuatro personas?'])('consulta de precio/rendimiento no compra: %s', async text=>{
    const h=harness([bowl],false);await h.sendQueued(text);expect(h.cartRows()).toEqual([]);
    expect(h.replies.join(' ')).not.toMatch(/alcanza para 4|para cuatro personas/i);
  });
  it.each(['No gracias','No señor así está bien muchas gracias'])('terminar compra conserva dos unidades: %s', async text=>{
    const h=harness([bowl],false);await h.sendQueued('Dos bowls mediterraneos');await h.sendQueued(text);
    expect(h.cartRows()).toEqual([expect.objectContaining({id:8801,qty:2})]);
  });
  it('nota posterior de cubiertos no compra otro producto', async()=>{
    const h=harness([bowl],false);await h.sendQueued('Un Bowl Mediterraneo');await h.sendQueued('Con los cubiertos por favor');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:8801,qty:1})]);
    expect([h.conv.sessionData.customerNotes,...h.cartRows().map(r=>r.note),h.replies.at(-1)].join(' ')).toMatch(/cubiertos/i);
  });
  it('cantidad y billete durante pago no agregan sopas', async()=>{
    const h=harness(products,false);Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164});
    await h.sendQueued('Dos ajiacos para la calle 7 #20-30');await h.sendQueued('Pago con un billete de 100mil');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:38,qty:2})]);expect(h.conv.sessionData.cashChangeFor).toBeTruthy();
  });
  it.each(['Tomate','Lentejas'])('otro menú limita las opciones al tipo de sopa %s', async type=>{
    const menu=[{id:8803,code:8803,name:'Sopa De Tomate',price:5000,availableNow:true,attributes:[]},{id:8804,code:8804,name:'Sopa De Tomate Pequeña',price:3000,availableNow:true,attributes:[]},{id:8805,code:8805,name:'Sopa De Lentejas',price:6000,availableNow:true,attributes:[]},{id:8806,code:8806,name:'Sopa De Lentejas Pequeña',price:4000,availableNow:true,attributes:[]},bowl];
    const h=harness(menu,false);await h.sendQueued(`Una sopa de ${type} y un Bowl Mediterraneo`);
    const choices=[...(h.conv.sessionData.pendingMatch?.candidates||[]),...(h.conv.sessionData.pendingMultiOrder?.ambiguous||[]).flatMap(x=>x.candidates)];
    expect(choices.every(p=>p.name.includes(type))).toBe(true);
    // Un nombre exacto selecciona la presentación regular; no exige una ambigüedad artificial.
    expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:type==='Tomate'?8803:8805,qty:1}),expect.objectContaining({id:8801,qty:1})]));
    expect(h.cartRows()).toHaveLength(2);
  });
  it.each(['text','audio'])('otro menú interpreta cortesía y sustitución (%s)', async type=>{
    const meal={id:8807,code:8807,name:'Combo Vegetariano',description:'Incluye bebida y ensalada',price:20000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Te','Agua']}]};
    const h=harness([meal],false);const text='Me hace el favor me envía un combo vegetariano a cambio de la bebida una ensalada con tomate y queso, muchas gracias';
    h.service.resolveAudioToText=jest.fn().mockResolvedValue(text);await h.sendQueued(type==='audio'?'':text,type==='audio'?{messageType:'audio',mediaId:'synthetic-alt'}:{});
    expect(h.cartRows()).toEqual([expect.objectContaining({id:8807,qty:1,note:expect.stringMatching(/ensalada con tomate y queso/i)})]);
    expect(h.cartRows()[0].attrs).not.toContain('Bebida:Te');
  });
  it('transcripción fallida conserva el carrito y pide texto', async()=>{
    const h=harness([bowl],false);await h.sendQueued('Un Bowl Mediterraneo');const before=structuredClone(h.conv.sessionData.cart);
    h.service.resolveAudioToText=jest.fn().mockResolvedValue(null);await h.sendQueued('',{messageType:'audio',mediaId:'failed-audio'});
    expect(h.conv.sessionData.cart).toEqual(before);expect(h.replies.at(-1)).toMatch(/No pude escuchar/);
  });
});


describe('PDF — límites de cambios de bebida y consultas', () => {
  it('con dos ejecutivos pregunta a cuál cambiar la bebida sin alterar ninguno', async () => {
    const h=harness(products,false);await h.sendQueued('Un ejecutivo broaster');await h.sendQueued('Un ejecutivo frito');
    const before=structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('Y de tomar me puedes enviar limonada?');
    expect(h.conv.sessionData.cart).toEqual(before);expect(h.replies.at(-1)).toMatch(/cuál plato/i);
  });
  it('preguntar el precio de otro plato no responde el total del carrito', async()=>{
    const h=harness(products,false);await h.sendQueued('Un arroz con pollo');
    const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued('Cuánto vale el churrasco?');
    expect(h.conv.sessionData.cart).toEqual(before);expect(h.replies.join(' ')).toMatch(/38[.,]000/);
  });
});

describe('PDF segunda tanda — dinero, disponibilidad y referencias', () => {
  const bowl={id:9101,code:9101,name:'Bowl Mediterraneo',price:17000,availableNow:true,attributes:[]};
  it.each([
    {menu:products,order:'Un arroz con pollo',price:29500},
    {menu:[bowl],order:'Un bowl mediterraneo',price:17000},
  ])('precio histórico no modifica el valor ni la cantidad: $order', async ({menu,order,price})=>{
    const h=harness(menu,false);await h.sendQueued(order);const before=structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('Antes me costaba 22000, cuánto vale ahora?');
    expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.cart[0].unitPrice).toBe(price);
    expect(h.replies.at(-1)).toMatch(new RegExp(price===29500?'29[.,]500':'17[.,]000'));
  });
  it.each(['Cancelo con 100mil','Pago con un billete de 100mil','Pagamos con un billete de 100mil'])('pago conserva el carrito: %s',async text=>{
    const h=harness([bowl],false);Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164});
    await h.sendQueued('Un bowl mediterraneo');await h.sendQueued('Para la calle 7 #20-30');
    expect(h.cartRows()).toHaveLength(1);await h.sendQueued(text);
    expect(h.cartRows()).toEqual([expect.objectContaining({id:9101,qty:1})]);
    expect(String(h.conv.sessionData.cashChangeFor)).toMatch(/100/);
  });
  it.each(['Cancela el pedido','Ya no quiero nada cancélalo'])('cancelación no se confunde con pago: %s',async text=>{
    const h=harness([bowl],false);h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);await h.sendQueued('Un bowl mediterraneo');await h.sendQueued(text);
    expect(h.cartRows()).toEqual([]);
  });
  it.each(['Esas cuatro','Esos cuatro por favor'])('referencia sin producto no compra cuatro platos: %s',async text=>{
    const h=harness([bowl,{...bowl,id:9102,code:9102,name:'Wrap Oriental'}],false);
    await h.sendQueued('Un bowl mediterraneo y un wrap oriental');const before=structuredClone(h.conv.sessionData.cart);
    await h.sendQueued(text);expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.replies.at(-1)).toMatch(/cu[aá]l|aclara|producto/i);
  });
  it.each(['Tienen hamburguesas?','Hay postres?','Tienen sopita hoy?','Qué jugos naturales hay?'])('consulta con otro catálogo no compra: %s',async text=>{
    const h=harness([bowl],false);await h.sendQueued(text);expect(h.cartRows()).toEqual([]);
    expect(h.replies.join(' ')).not.toMatch(/Listo ✅|agregué/i);
  });
  it.each(['Disculpa se demora','Está muy demorado','Un favor mi pedido se demora'])('consulta de demora no inventa estado: %s',async text=>{
    const h=harness([bowl],false);h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);h.cfg.localContext={deliveryTimeNote:'Tiempo por confirmar con el local'};await h.sendQueued('Un bowl mediterraneo');const before=structuredClone(h.conv.sessionData.cart);
    await h.sendQueued(text);expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.replies.at(-1)).not.toMatch(/ya.*(?:sali[oó]|llegando)|en camino|\b\d+\s*minutos/i);
  });
});


describe('PDF segunda tanda — compra y dirección en catálogo alternativo',()=>{
  it.each(['Un bowl mediterraneo','Dos bowls mediterraneos'])('conserva plato con dirección en un turno: %s',async order=>{
    const menu=[{id:9101,code:9101,name:'Bowl Mediterraneo',price:17000,availableNow:true,attributes:[]}];
    const h=harness(menu,false);Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164});
    await h.sendQueued(`${order} para la calle 7 #20-30`);
    expect(h.cartRows()).toEqual([expect.objectContaining({id:9101,qty:order.startsWith('Dos')?2:1})]);
    expect(h.conv.sessionData.address).toMatch(/20-30/);
  });
});

describe('PDF segunda tanda — sabor condicionado y seguimiento',()=>{
  it.each([
    {options:['Agua','Te'],expected:'Te'},
    {options:['Agua'],expected:'Agua'},
  ])('bebida condicional usa solo una opción existente: $expected',async ({options,expected})=>{
    const meal={id:9201,code:9201,name:'Menu Vegetariano',price:18000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options}]};
    const h=harness([meal],false);await h.sendQueued('Un menu vegetariano');
    await h.sendQueued('Si tienes por favor con bebida Te, si no con Agua');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:9201,qty:1,attrs:[`Bebida:${expected}`]})]);
  });
  it.each(['Disculpa se demora','Está muy demorado','Un favor mi pedido se demora'])('reclamo posterior sin orden comprobada no inventa despacho: %s',async text=>{
    const h=harness(products,false);h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
    h.conv.state='completed';await h.sendQueued(text);
    expect(h.cartRows()).toEqual([]);expect(h.replies.at(-1)).not.toMatch(/ya.*(?:sali[oó]|llegando)|en camino|\b\d+\s*minutos/i);
  });
});

describe('PDF segunda tanda — domicilio portable conserva cantidades y precio',()=>{
  it.each([
    {name:'Wrap Oriental',order:'Un wrap oriental',quantity:1},
    {name:'Pizza Vegetariana',order:'Tres pizzas vegetarianas',quantity:3},
    {name:'Bowl Mediterraneo',order:'Un bowl mediterraneo',quantity:1},
  ])('no incluye $name en la dirección',async({name,order,quantity})=>{
    const h=harness([{id:9301,code:9301,name,price:17000,availableNow:true,attributes:[]}],false);
    Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164});
    await h.sendQueued(`${order} para la carrera 12 #34-56 torre 8 apartamento 903`);
    expect(h.cartRows()).toEqual([expect.objectContaining({id:9301,qty:quantity})]);
    expect(h.conv.sessionData.address).toMatch(/^carrera 12/i);
    expect(h.conv.sessionData.address).not.toMatch(/wrap|pizza|bowl/i);
    expect(h.conv.state).toBe('awaiting_payment');
  });
});

describe('PDF segunda tanda — límites de bebida condicional',()=>{
  const meal={id:9401,code:9401,name:'Menu Vegetariano',price:18000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Agua','Te']}]};
  it('dos platos compatibles requieren elegir destino',async()=>{
    const h=harness([meal,{...meal,id:9402,code:9402,name:'Menu Infantil'}],false);
    await h.sendQueued('Un menu vegetariano');await h.sendQueued('Un menu infantil');
    const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued('Si tienes con bebida Te, si no con Agua');
    expect(h.conv.sessionData.cart).toEqual(before);expect(h.replies.at(-1)).toMatch(/cuál plato/i);
  });
  it('ninguna opción disponible no inventa una bebida',async()=>{
    const h=harness([meal],false);await h.sendQueued('Un menu vegetariano');const before=structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('Si tienes con bebida Chocolate, si no con Cafe');
    expect(h.conv.sessionData.cart).toEqual(before);expect(h.replies.at(-1)).toMatch(/No pude confirmar/i);
  });
});

describe('PDF segunda tanda — límites del precio histórico',()=>{
  it('precio vigente del catálogo no reescribe el precio del carrito',async()=>{
    const menu=[{id:9501,code:9501,name:'Bowl Mediterraneo',price:17000,availableNow:true,attributes:[]}];
    const h=harness(menu,false);await h.sendQueued('Un bowl mediterraneo');const before=structuredClone(h.conv.sessionData.cart);
    menu[0].price=19000;await h.sendQueued('Antes me costaba 15000, cuánto vale ahora?');
    expect(h.conv.sessionData.cart).toEqual(before);expect(h.replies.at(-1)).toMatch(/19[.,]000/);
  });
  it('con varios platos consulta el producto antes de atribuir el precio',async()=>{
    const menu=[{id:9501,code:9501,name:'Bowl Mediterraneo',price:17000,availableNow:true,attributes:[]},{id:9502,code:9502,name:'Wrap Oriental',price:21000,availableNow:true,attributes:[]}];
    const h=harness(menu,false);await h.sendQueued('Un bowl mediterraneo y un wrap oriental');const before=structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('Antes me costaba 15000, cuánto vale ahora?');
    expect(h.conv.sessionData.cart).toEqual(before);expect(h.replies.at(-1)).toMatch(/cuál producto/i);
  });
});


describe('PDF segunda tanda — aclaración conserva el cambio pendiente',()=>{
  it.each(['Si tienes con bebida Te, si no con Agua','Y de tomar me puedes enviar Te?'])('retoma la bebida después de elegir el plato: %s',async text=>{
    const meal={id:9601,code:9601,name:'Menu Vegetariano',price:18000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Agua','Te']}]};
    const h=harness([meal,{...meal,id:9602,code:9602,name:'Menu Infantil'}],false);
    await h.sendQueued('Un menu vegetariano');await h.sendQueued('Un menu infantil');
    await h.sendQueued(text);await h.sendQueued('Menu Vegetariano');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:9601,qty:1,attrs:['Bebida:Te']}),expect.objectContaining({id:9602,qty:1,attrs:['Bebida:Agua']})]);
    expect(h.conv.sessionData.pendingCartAttributeEdit).toBeFalsy();
  });
});

describe('PDF tercera tanda — citas antiguas, recogida y mensajes consecutivos',()=>{
  const bowl={id:9701,code:9701,name:'Bowl Mediterraneo',price:17000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Base',options:['Arroz','Quinoa']}]};
  it.each(['missing','foreign','removed'])('cita %s no reincorpora el plato retirado',async scenario=>{
    const h=harness([bowl,{...bowl,id:9702,code:9702,name:'Bowl Oriental'}],false);
    await h.sendQueued('Un bowl mediterraneo');await h.sendQueued('Un bowl oriental');await h.sendQueued('Quita el bowl mediterraneo');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:9702,qty:1})]);const before=structuredClone(h.conv.sessionData.cart);
    h.service.conversationService.findByWaMessageId=jest.fn().mockResolvedValue(scenario==='missing'?null:{conversationId:scenario==='foreign'?99:1,direction:'out',body:'Bowl Mediterraneo. Base: Arroz o Quinoa',waMessageId:'old-quote'});
    await h.send('Quinoa',{context:{id:'old-quote'}});
    expect(h.conv.sessionData.cart).toEqual(before);expect(h.replies.at(-1)).toMatch(/cuál|identificar|plato|producto/i);
  });
  it.each(['Lo recoge otra persona','Lo recoge mi hermano','Paso a recogerlo'])('cambio a recogida conserva productos: %s',async text=>{
    const h=harness([bowl],false);await h.sendQueued('Dos bowls mediterraneos');await h.sendQueued('Para la calle 7 #20-30');
    const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued(text);
    expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.orderType).toBe('pickup');
  });
  it.each([
    {menu:products,order:'Dos arroces con pollo',id:23},
    {menu:[bowl],order:'Dos bowls mediterraneos',id:9701},
  ])('turnos consecutivos complementan el domicilio sin duplicar $id',async({menu,order,id})=>{
    const h=harness(menu,false);Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164});
    for(const text of [order,'Para la calle 7 #20-30','Torre 3 apartamento 607','Barrio Tintal'])await h.sendQueued(text);
    expect(h.cartRows()).toEqual([expect.objectContaining({id,qty:2})]);
    expect(h.conv.sessionData.address).toMatch(/20-30/);expect(h.conv.sessionData.address).toMatch(/607/);
  });
  it.each(['Los quiero 1 con arroz y tofu y 1 con quinoa y pollo','Los quiero 1 con arroz y pollo y 1 con quinoa y tofu'])('reparto de varios atributos aplica cada combinación completa: %s',async text=>{
    const meal={...bowl,attributes:[...bowl.attributes,{attributeName:'Proteina',options:['Pollo','Tofu']}]};
    const h=harness([meal],false);await h.sendQueued('Dos bowls mediterraneos con arroz y tofu');const before=structuredClone(h.conv.sessionData.cart);
    await h.sendQueued(text);
    expect(before[0].quantity).toBe(2);
    expect(h.cartRows()).toHaveLength(2);
    for(const row of h.cartRows())expect(row).toMatchObject({id:9701,qty:1});
    expect(h.cartRows()[0].attrs).toEqual(expect.arrayContaining(['Base:Arroz',text.includes('arroz y tofu')?'Proteina:Tofu':'Proteina:Pollo']));
    expect(h.cartRows()[1].attrs).toEqual(expect.arrayContaining(['Base:Quinoa',text.includes('quinoa y pollo')?'Proteina:Pollo':'Proteina:Tofu']));
    expect(h.replies.at(-1)).toMatch(/Repartí/i);
  });
});

describe('PDF tercera tanda — límites del reparto y recogida',()=>{
  const meal={id:9801,code:9801,name:'Bowl Mediterraneo',price:18000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Base',options:['Arroz','Quinoa']},{attributeName:'Proteina',options:['Pollo','Tofu']}]};
  it.each(['Los quiero 1 con arroz y tofu y 1 con quinoa y cerdo','Los quiero 1 con arroz y 1 con quinoa y tofu','Los quiero 2 con arroz y tofu y 2 con quinoa y pollo'])('reparto inválido no modifica parcialmente: %s',async text=>{
    const h=harness([meal],false);await h.sendQueued('Dos bowls mediterraneos con arroz y tofu sin cebolla');const before=structuredClone(h.conv.sessionData.cart);
    await h.sendQueued(text);expect(h.conv.sessionData.cart).toEqual(before);expect(h.replies.at(-1)).toMatch(/opciones|cantidad|cuál|unidades/i);
    expect(h.replies.at(-1)).not.toMatch(/no manejamos:.*tofu/i);
  });
  it('cada combinación conserva nota en ambas líneas',async()=>{
    const h=harness([meal],false);await h.sendQueued('Dos bowls mediterraneos con arroz y tofu sin cebolla');
    await h.sendQueued('Los quiero 1 con arroz y tofu y 1 con quinoa y pollo');
    expect(h.cartRows()).toHaveLength(2);for(const row of h.cartRows())expect(row.note).toMatch(/sin cebolla/i);
  });
  it.each(['Lo recoge el domiciliario','Lo recoge el repartidor'])('recogida del repartidor no cambia domicilio a pickup: %s',async text=>{
    const h=harness([meal],false);await h.sendQueued('Un bowl mediterraneo');await h.sendQueued('Para la calle 7 #20-30');
    const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued(text);
    expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.orderType).toBe('delivery');
  });
  it('cita de cantidad antigua cambia la opción sin restaurar diez unidades',async()=>{
    const h=harness([meal],false);await h.sendQueued('Dos bowls mediterraneos con arroz y tofu');
    h.service.conversationService.findByWaMessageId=jest.fn().mockResolvedValue({conversationId:1,direction:'out',body:'Bowl Mediterraneo ×10. Base: Arroz o Quinoa',waMessageId:'old-quantity'});
    await h.send('Quinoa',{context:{id:'old-quantity'}});
    expect(h.cartRows()).toEqual([expect.objectContaining({id:9801,qty:2,attrs:expect.arrayContaining(['Base:Quinoa','Proteina:Tofu'])})]);
  });
});

describe('PDF cuarta tanda — contexto de fotos y recogida portable', () => {
  const bowl = {id:9851,code:9851,name:'Bowl Mediterraneo',price:18000,availableNow:true,attributes:[]};
  it.each([
    {menu:products,order:'Un churrasco',id:17},
    {menu:[bowl],order:'Un bowl mediterraneo',id:9851},
  ])('tercero pasa en diez minutos sin cambiar productos: $id', async ({menu,order,id}) => {
    const h=harness(menu,false);await h.sendQueued(order);await h.sendQueued('Para la calle 7 #20-30');
    const before=structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('Es para mi hermano, el mismo pasa en 10 mn por el pedido');
    expect(h.conv.sessionData.orderType).toBe('pickup');expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.cartRows()[0].id).toBe(id);expect(h.conv.sessionData.address).toMatch(/10 mn/);expect(h.replies.at(-1)).not.toMatch(/no manejamos|no entendí/i);
  });
  it.each(['No lo recoge mi hermano, es para domicilio','Lo recoge el mensajero','El domiciliario pasa en 10 mn por el pedido','Mi hermano no pasa en 10 mn por el pedido'])('no cambia domicilio con %s',async text=>{
    const h=harness([bowl],false);await h.sendQueued('Un bowl mediterraneo');await h.sendQueued('Para la calle 7 #20-30');
    h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
    const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued(text);
    expect(h.conv.sessionData.orderType).toBe('delivery');expect(h.conv.sessionData.cart).toEqual(before);
  });
  it.each(['completed','closed','building_cart','awaiting_payment_method'])('producto legible no se convierte en comprobante por estado %s',async state=>{
    const h=harness([bowl],false);h.conv.state=state;if(state==='awaiting_payment_method')h.conv.sessionData.paymentMethod='nequi';
    h.service.metaService.downloadMedia=jest.fn().mockResolvedValue({buffer:Buffer.from('mock'),mimeType:'image/jpeg'});
    h.service.catalogService.getMenuDetailedText=jest.fn().mockResolvedValue('Bowl Mediterraneo #9851');
    h.service.aiService.analyzeOrderImage=jest.fn().mockResolvedValue({kind:'order',textForBot:'Dos bowls mediterraneos'});
    h.service.conversationService.updateMessageBody=jest.fn().mockResolvedValue(undefined);
    const result=await h.service.resolveImageMessage({waId:'customer',messageType:'image',mediaId:'mock-photo'},'1',h.conv,h.cfg);
    expect(result).toEqual({done:false,text:'Dos bowls mediterraneos'});expect(h.replies.join(' ')).not.toMatch(/comprobante/i);
  });
  it.each(['contraentrega','transferencia','nequi'])('menú ambiguo pide selección sin comprar ni acreditar pago: %s',async paymentMethod=>{
    const h=harness([bowl],false);await h.sendQueued('Un bowl mediterraneo');h.conv.sessionData.paymentMethod=paymentMethod;
    const before=structuredClone(h.conv.sessionData.cart);
    h.service.metaService.downloadMedia=jest.fn().mockResolvedValue({buffer:Buffer.from('mock'),mimeType:'image/jpeg'});
    h.service.catalogService.getMenuDetailedText=jest.fn().mockResolvedValue('Bowl Mediterraneo #9851');
    h.service.aiService.analyzeOrderImage=jest.fn().mockResolvedValue({kind:'unclear',textForBot:'',visibleText:'Bowl Mediterraneo y Wrap Oriental',reply:'¿Cuál plato de la carta quieres?'});
    h.service.conversationService.updateMessageBody=jest.fn().mockResolvedValue(undefined);
    await h.service.resolveImageMessage({waId:'customer',messageType:'image',mediaId:'mock-menu',text:'Quiero pedir de este menú'},'1',h.conv,h.cfg);
    expect(h.conv.sessionData.cart).toEqual(before);expect(h.replies.at(-1)).toMatch(/cuál.*plato/i);expect(h.replies.at(-1)).not.toMatch(/comprobante/i);
  });
  it('foto ilegible sin selección conserva carrito y máximo dos análisis',async()=>{
    const h=harness([bowl],false);await h.sendQueued('Dos bowls mediterraneos');const before=structuredClone(h.conv.sessionData.cart);
    h.service.metaService.downloadMedia=jest.fn().mockResolvedValue({buffer:Buffer.from('mock'),mimeType:'image/jpeg'});
    h.service.catalogService.getMenuDetailedText=jest.fn().mockResolvedValue('Bowl Mediterraneo #9851');
    h.service.aiService.analyzeOrderImage=jest.fn().mockResolvedValue({kind:'unclear',textForBot:'',reply:'No pude leer el plato'});
    h.service.conversationService.updateMessageBody=jest.fn().mockResolvedValue(undefined);
    await h.service.resolveImageMessage({waId:'customer',messageType:'image',mediaId:'mock-unreadable'},'1',h.conv,h.cfg);
    expect(h.conv.sessionData.cart).toEqual(before);expect(h.service.aiService.analyzeOrderImage).toHaveBeenCalledTimes(2);
    expect(h.replies.at(-1)).toMatch(/foto|plato|código/i);
  });
  it('reintento OCR recupera plato completo conservando cantidad',async()=>{
    const h=harness([bowl],false);
    h.service.metaService.downloadMedia=jest.fn().mockResolvedValue({buffer:Buffer.from('mock'),mimeType:'image/jpeg'});
    h.service.catalogService.getMenuDetailedText=jest.fn().mockResolvedValue('Bowl Mediterraneo #9851');
    h.service.aiService.analyzeOrderImage=jest.fn().mockResolvedValueOnce({kind:'unclear',textForBot:''}).mockResolvedValueOnce({kind:'order',textForBot:'Tres bowls mediterraneos'});
    h.service.conversationService.updateMessageBody=jest.fn().mockResolvedValue(undefined);
    const result=await h.service.resolveImageMessage({waId:'customer',messageType:'image',mediaId:'mock-retry'},'1',h.conv,h.cfg);
    expect(result).toEqual({done:false,text:'Tres bowls mediterraneos'});expect(h.service.aiService.analyzeOrderImage).toHaveBeenLastCalledWith(expect.objectContaining({ocrRetry:true}));
    await h.send(result.text);expect(h.cartRows()).toEqual([expect.objectContaining({id:9851,qty:3})]);
  });
  it.each(['completed','building_cart'])('comprobante explícito no compra aunque texto contenga un plato: %s',async state=>{
    const h=harness([bowl],false);await h.sendQueued('Un bowl mediterraneo');h.conv.state=state;const before=structuredClone(h.conv.sessionData.cart);
    h.service.metaService.downloadMedia=jest.fn().mockResolvedValue({buffer:Buffer.from('mock'),mimeType:'image/jpeg'});
    h.service.catalogService.getMenuDetailedText=jest.fn().mockResolvedValue('Bowl Mediterraneo #9851');
    h.service.aiService.analyzeOrderImage=jest.fn().mockResolvedValue({kind:'payment_proof',textForBot:'Un bowl mediterraneo'});
    h.service.conversationService.updateMessageBody=jest.fn().mockResolvedValue(undefined);
    expect(await h.service.resolveImageMessage({waId:'customer',messageType:'image',mediaId:'mock-proof'},'1',h.conv,h.cfg)).toEqual({done:true});
    expect(h.conv.sessionData.cart).toEqual(before);expect(h.replies.at(-1)).toMatch(/no confirma el pago/i);
  });
});

describe('Aclaración de medios — sin repetir el fallback genérico',()=>{
  it.each(['','Esta'])('foto ilegible pide plato una vez y conserva carrito: %s',async caption=>{
    const h=harness(products,false);await h.sendQueued('Un churrasco');const before=structuredClone(h.conv.sessionData.cart);h.replies.length=0;
    h.service.metaService.downloadMedia=jest.fn().mockResolvedValue({buffer:Buffer.from('mock'),mimeType:'image/jpeg'});
    h.service.catalogService.getMenuDetailedText=jest.fn().mockResolvedValue('Churrasco #17');
    h.service.aiService.analyzeOrderImage=jest.fn().mockResolvedValue({kind:'unclear',textForBot:'',reply:'No pude leer la foto'});
    h.service.conversationService.updateMessageBody=jest.fn().mockResolvedValue(undefined);
    await h.sendQueued(caption,{messageType:'image',mediaId:'mock-unreadable'});
    expect(h.conv.sessionData.cart).toEqual(before);expect(h.replies).toHaveLength(1);
    expect(h.replies[0]).toMatch(/foto.*plato/s);expect(h.replies[0]).not.toMatch(/llámanos|3118866823|asesor/i);
    expect(h.replies[0]).not.toMatch(/no entend[ií]|me lo aclaras/i);
  });
  it('descarga de foto fallida usa una aclaración específica sin compra',async()=>{
    const h=harness(products,false);h.service.metaService.downloadMedia=jest.fn().mockRejectedValue(new Error('fixture expired'));
    await h.sendQueued('',{messageType:'image',mediaId:'mock-expired'});
    expect(h.cartRows()).toEqual([]);expect(h.replies).toHaveLength(1);expect(h.replies[0]).toMatch(/No pude leer la imagen/i);
    expect(h.replies[0]).not.toMatch(/no entend[ií]|me lo aclaras/i);
  });
  it('audio ilegible pide texto sin duplicar no-entendí',async()=>{
    const h=harness(products,false);h.service.resolveAudioToText=jest.fn().mockResolvedValue(null);
    await h.sendQueued('',{messageType:'audio',mediaId:'mock-audio'});
    expect(h.cartRows()).toEqual([]);expect(h.replies).toHaveLength(1);expect(h.replies[0]).toMatch(/No pude escuchar.*texto/s);
    expect(h.replies[0]).not.toMatch(/no entend[ií]|me lo aclaras/i);
  });
  it('comprobante recibido informa verificación sin decir que no entendió',async()=>{
    const h=harness(products,false);
    h.service.metaService.downloadMedia=jest.fn().mockResolvedValue({buffer:Buffer.from('mock'),mimeType:'image/jpeg'});
    h.service.catalogService.getMenuDetailedText=jest.fn().mockResolvedValue('Churrasco #17');
    h.service.aiService.analyzeOrderImage=jest.fn().mockResolvedValue({kind:'payment_proof',textForBot:''});
    h.service.conversationService.updateMessageBody=jest.fn().mockResolvedValue(undefined);
    await h.sendQueued('',{messageType:'image',mediaId:'mock-proof'});
    expect(h.cartRows()).toEqual([]);expect(h.replies).toHaveLength(1);expect(h.replies[0]).toMatch(/no confirma el pago/i);
    expect(h.replies[0]).not.toMatch(/no entend[ií]|me lo aclaras/i);
  });
  it('comprobante que no abre solicita reenvío sin aclaración genérica',async()=>{
    const h=harness(products,false);h.conv.sessionData.paymentMethod='nequi';
    h.service.metaService.downloadMedia=jest.fn().mockRejectedValue(new Error('fixture expired'));
    await h.sendQueued('',{messageType:'image',mediaId:'mock-proof-expired'});
    expect(h.cartRows()).toEqual([]);expect(h.replies).toHaveLength(1);expect(h.replies[0]).toMatch(/comprobante.*[Mm]ándala/s);
    expect(h.replies[0]).not.toMatch(/no entend[ií]|me lo aclaras/i);
  });

});

describe('Imagen de carta — selección explícita frente a OCR ambiguo',()=>{
  const analysis={kind:'unclear',textForBot:'',visibleText:'Churrasco\nArroz Con Pollo'};
  it('incluye todos los platos de una carta sin selección aunque no haya reply',()=>{
    const h=harness(products,false);expect(h.service.resolveImageOrderText(analysis,'Esto',products)).toBe('1 x Churrasco (código 17)\n1 x Arroz Con Pollo (código 23)');expect(h.cartRows()).toEqual([]);
  });
  it('respeta la selección y cantidad del pie en una carta con varios platos',async()=>{
    const h=harness(products,false);const text=h.service.resolveImageOrderText(analysis,'Dos churrascos',products);
    expect(text).toBe('Dos churrascos');await h.sendQueued(text);expect(h.cartRows()).toEqual([expect.objectContaining({id:17,qty:2})]);
  });
  it('selección por código del pie no se sustituye por el primer plato del OCR',async()=>{
    const h=harness(products,false);const text=h.service.resolveImageOrderText(analysis,'código 23',products);
    expect(text).toBe('código 23');await h.sendQueued(text);expect(h.cartRows()).toEqual([expect.objectContaining({id:23,qty:1})]);
  });

  it('si el cliente escribió el plato, usa ese texto aunque la imagen sea ilegible',async()=>{
    const h=harness(products,false);const text=h.service.resolveImageOrderText({kind:'unclear',textForBot:'',reply:'No pude leer la foto'},'Tres churrascos',products);
    expect(text).toBe('Tres churrascos');await h.sendQueued(text);expect(h.cartRows()).toEqual([expect.objectContaining({id:17,qty:3})]);
  });

});


describe('Código de producto no es cantidad — dos catálogos',()=>{
  const bowl={id:9855,code:7,name:'Bowl Mediterraneo',price:18000,availableNow:true,attributes:[]};
  for(const fixture of [{menu:products,id:23,code:23},{menu:[bowl],id:9855,code:7}]){
    it.each([['código CODE',1],['#CODE',1],['dos del código CODE',2],['código CODE x3',3]])('conserva cantidad de %s para '+fixture.code,async(template,qty)=>{
      const h=harness(fixture.menu,false);await h.sendQueued(String(template).replace('CODE',String(fixture.code)));
      expect(h.cartRows()).toEqual([expect.objectContaining({id:fixture.id,qty})]);
    });
  }
});


describe('Medios — OCR incierto no equivale a compra',()=>{
  const alternate=[{id:9855,code:7,name:'Bowl Mediterraneo',price:18000,availableNow:true,attributes:[]}];
  for(const fixture of [{menu:products,name:'Churrasco'},{menu:alternate,name:'Bowl Mediterraneo'}]) {
    it.each(['','Esto'])('no compra el único nombre visible sin selección: '+fixture.name+' %s',caption=>{
      const h=harness(fixture.menu,false);
      expect(h.service.resolveImageOrderText({kind:'unclear',textForBot:'',visibleText:fixture.name},caption,fixture.menu)).toBeNull();
      expect(h.cartRows()).toEqual([]);
    });
    it('conserva texto explícito de selección para '+fixture.name,()=>{
      const h=harness(fixture.menu,false);const caption='Quiero dos '+fixture.name;
      expect(h.service.resolveImageOrderText({kind:'unclear',textForBot:'',visibleText:fixture.name},caption,fixture.menu)).toBe(caption);
    });
    it('audio fallido seguido de texto recupera cantidad en '+fixture.name,async()=>{
      const h=harness(fixture.menu,false);h.service.resolveAudioToText=jest.fn().mockResolvedValue(null);
      await h.sendQueued('',{messageType:'audio',mediaId:'mock-failed'});expect(h.cartRows()).toEqual([]);
      await h.sendQueued('Quiero dos '+fixture.name);
      expect(h.cartRows()).toEqual([expect.objectContaining({id:fixture.menu===products?17:9855,qty:2})]);
      expect(h.replies.at(-1)).not.toMatch(/no pude escuchar|no entend[ií]/i);
    });
  }
});


describe('Medios secuenciales — edición y recuperación en dos menús',()=>{
  const bowl={id:9860,code:8,name:'Bowl Mediterraneo',price:18000,availableNow:true,attributes:[]};
  for(const fixture of [{menu:products,name:'Churrasco',id:17},{menu:[bowl],name:'Bowl Mediterraneo',id:9860}]) {
    const setup=()=>{
      const h=harness(fixture.menu,false);
      h.service.metaService.downloadMedia=jest.fn().mockResolvedValue({buffer:Buffer.from('mock'),mimeType:'image/jpeg'});
      h.service.catalogService.getMenuDetailedText=jest.fn().mockResolvedValue(fixture.name);
      h.service.conversationService.updateMessageBody=jest.fn().mockResolvedValue(undefined);
      h.service.aiService.analyzeOrderImage=jest.fn().mockResolvedValue({kind:'order',textForBot:'Quiero dos '+fixture.name});
      return h;
    };
    it('foto y corrección de cantidad no duplican '+fixture.name,async()=>{
      const h=setup();await h.sendQueued('Esto',{messageType:'image',mediaId:'mock-selection'});
      expect(h.cartRows()).toEqual([expect.objectContaining({id:fixture.id,qty:2})]);
      await h.sendQueued('Perdón, quiero tres '+fixture.name);
      expect(h.cartRows()).toEqual([expect.objectContaining({id:fixture.id,qty:3})]);
      expect(h.replies.at(-1)).not.toMatch(/no entend[ií]|no manejamos/i);
    });
    it('foto ilegible posterior conserva la edición de '+fixture.name,async()=>{
      const h=setup();await h.sendQueued('Esto',{messageType:'image',mediaId:'mock-selection'});
      await h.sendQueued('Perdón, quiero tres '+fixture.name);const before=structuredClone(h.conv.sessionData.cart);
      h.service.aiService.analyzeOrderImage.mockResolvedValue({kind:'unclear',textForBot:'',reply:'No pude leer la foto'});
      h.replies.length=0;await h.sendQueued('',{messageType:'image',mediaId:'mock-unreadable'});
      expect(h.conv.sessionData.cart).toEqual(before);expect(h.replies).toHaveLength(1);expect(h.replies[0]).toMatch(/plato.*código/s);
    });
    it('consulta escrita con foto incierta no compra '+fixture.name,async()=>{
      const h=setup();h.service.aiService.analyzeOrderImage.mockResolvedValue({kind:'unclear',textForBot:'',visibleText:fixture.name});
      await h.sendQueued('Cuánto cuesta '+fixture.name+'?',{messageType:'image',mediaId:'mock-price'});
      expect(h.cartRows()).toEqual([]);expect(h.replies.at(-1)).toMatch(/\$/);
    });
    it('audio transcrito corrige selección previa por imagen de '+fixture.name,async()=>{
      const h=setup();await h.sendQueued('Esto',{messageType:'image',mediaId:'mock-selection'});
      h.service.resolveAudioToText=jest.fn().mockResolvedValue('Perdón, quiero tres '+fixture.name);
      await h.sendQueued('',{messageType:'audio',mediaId:'mock-correction'});
      expect(h.cartRows()).toEqual([expect.objectContaining({id:fixture.id,qty:3})]);
    });
  }
});

describe('Corrección con cortesía — límites',()=>{
  it.each(['Perdón, quiero tres churrascos más','Disculpa, quiero tres churrascos y una sopa'])('no interpreta como cantidad absoluta %s',text=>{
    expect(require('./whatsapp-quantity-correction').parseCartQuantityCorrection(text)).toBeNull();
  });
});


describe('Foto de combo — defaults sin interrogatorio',()=>{
  it.each(['código 98','Combo De Pollo Broaster'])('agrega selección reconocida %s',async text=>{
    const h=harness(products,true);
    h.service.metaService.downloadMedia=jest.fn().mockResolvedValue({buffer:Buffer.from('mock'),mimeType:'image/jpeg'});
    h.service.catalogService.getMenuDetailedText=jest.fn().mockResolvedValue('Combo De Pollo Broaster #98');
    h.service.conversationService.updateMessageBody=jest.fn().mockResolvedValue(undefined);
    h.service.aiService.analyzeOrderImage=jest.fn().mockResolvedValue({kind:'order',textForBot:text});
    await h.sendQueued('',{messageType:'image',mediaId:'mock-combo'});
    expect(h.cartRows()).toEqual([expect.objectContaining({id:98,qty:1,attrs:expect.arrayContaining(['Arepas:Blancas','Bebida:Colombiana'])})]);
    expect(h.replies.at(-1)).not.toMatch(/cu[aá]l.*(?:bebida|arepa)|qu[eé] bebida prefieres/i);
  });
});

describe('Foto de combo — catálogo alternativo',()=>{
  it.each(['código 7','#7'])('selección %s usa defaults de otro negocio',async text=>{
    const menu=[{id:9870,code:7,name:'Bowl Mediterraneo',price:18000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Agua','Limonada']}]}];
    const h=harness(menu,false);const resolved=h.service.resolveImageOrderText({kind:'order',textForBot:text},undefined,menu);
    await h.sendQueued(resolved);
    expect(h.cartRows()).toEqual([expect.objectContaining({id:9870,qty:1,attrs:['Bebida:Agua']})]);
  });
});

describe('PDF 11/10 — cómo escribe la gente', () => {
  const bowl = { id: 9910, code: 9910, name: 'Bowl Andino', price: 18000, availableNow: true, attributes: [] };
  const soup = { id: 9911, code: 9911, name: 'Sopa De Lentejas', price: 8000, availableNow: true, attributes: [] };
  const ready = (h: ReturnType<typeof harness>) => {
    Object.assign(h.conv.sessionData, { phoneConfirmed: true, contactPhone: h.conv.phoneE164 });
  };

  it.each([
    { menu: products, text: 'Un arroz con pollo Cll6b74-21 torre 1 apto 402', id: 23 },
    { menu: [bowl], text: 'Un bowl andino Cll6b74-21 torre 1 apto 402', id: 9910 },
  ])('calle compacta no se mezcla con el plato: $id', async ({ menu, text, id }) => {
    const h = harness(menu, false);
    ready(h);
    await h.sendQueued(text);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id, qty: 1 })]);
    expect(h.conv.sessionData.address).toMatch(/6b/i);
    expect(h.conv.sessionData.address).toMatch(/402/);
    expect(h.conv.sessionData.address).not.toMatch(/arroz|bowl/i);
  });

  it.each([
    { menu: products, order: 'Me regalas un arroz con pollo', id: 23 },
    { menu: [bowl], order: 'Me regalas un bowl andino', id: 9910 },
  ])('conjunto, apto y entrada llegan en burbujas: $id', async ({ menu, order, id }) => {
    const h = harness(menu, false);
    ready(h);
    await h.sendQueued(order);
    await h.sendQueued('Para Villa galante');
    await h.sendQueued('Apartamento 239');
    await h.sendQueued('Entrada 20');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id, qty: 1 })]);
    const addr = h.conv.sessionData.address || '';
    expect(addr).toMatch(/villa galante/i);
    expect(addr).toMatch(/239/);
    expect(addr).toMatch(/entrada 20/i);
  });

  it.each([
    { menu: products, text: 'Me regalas 2 Aroz Paisa', id: 35 },
    { menu: [soup], text: 'Me regalas 2 sopas de lenteja', id: 9911 },
  ])('typo de nombre conserva la cantidad: $text', async ({ menu, text, id }) => {
    const h = harness(menu, false);
    await h.sendQueued(text);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id, qty: 2 })]);
  });

  it.each([
    { menu: products, first: 'Dos arroces chino porfavor', keep: 'No sólo el arroz', id: 26 },
    { menu: [bowl], first: 'Dos bowls andinos porfavor', keep: 'No sólo el bowl', id: 9910 },
  ])('negar el combo deja el plato suelto: $keep', async ({ menu, first, keep, id }) => {
    const h = harness(menu, false);
    await h.sendQueued(first);
    await h.sendQueued(keep);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id, qty: 2 })]);
  });

  it.each([
    {
      menu: products,
      text: 'Por favor\nMedio pollo frito\nUna sopa de ajiaco\nPara\nAdriana García\nCalle 6d 79a 56\nApto 470 interior 8\nCastilla reservado\nPagamos con un billete de 100mil',
      ids: [2, 38],
    },
    {
      menu: [bowl, soup],
      text: 'Por favor\nUn bowl andino\nUna sopa de lentejas\nPara\nAdriana García\nCalle 6d 79a 56\nApto 470 interior 8\nCastilla reservado\nPagamos con un billete de 100mil',
      ids: [9910, 9911],
    },
  ])('varias líneas separan platos, calle y billete', async ({ menu, text, ids }) => {
    const h = harness(menu, false);
    ready(h);
    await h.sendQueued(text);
    expect(h.cartRows()).toHaveLength(2);
    for (const id of ids) expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({ id, qty: 1 })]));
    expect(h.conv.sessionData.address).toMatch(/6d/i);
    expect(h.conv.sessionData.address).toMatch(/470/);
    expect(h.conv.sessionData.address).toMatch(/castilla/i);
    expect(h.conv.sessionData.address).not.toMatch(/ajiaco|lentejas|adriana|billete|bowl/i);
    expect(String(h.conv.sessionData.cashChangeFor)).toMatch(/100/);
  });

  it.each([
    { menu: products, order: 'Un arroz con pollo', id: 23 },
    { menu: [bowl], order: 'Un bowl andino', id: 9910 },
  ])('acá pagamos es efectivo y no agrega platos: $id', async ({ menu, order, id }) => {
    const h = harness(menu, false);
    ready(h);
    await h.sendQueued(order);
    await h.sendQueued('Calle 7f# 79c16 casa');
    await h.sendQueued('Acá pagamos gracias');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id, qty: 1 })]);
    expect(h.conv.sessionData.address).toMatch(/7f/i);
    expect(h.conv.sessionData.address).not.toMatch(/arroz|bowl|pagamos/i);
    expect(String(h.conv.sessionData.paymentMethod || '')).toMatch(/contraentrega|efectivo|cash/i);
  });

  it('medio pollo con ají y sin arepa no compra arepas aparte', async () => {
    const h = harness(products, false);
    await h.sendQueued('Para medio pollo frito con ají y sin arepa');
    expect(h.cartRows()).toEqual([expect.objectContaining({
      id: 2,
      qty: 1,
      attrs: expect.arrayContaining(['Arepas:sin arepas']),
      note: expect.stringMatching(/aj[ií]/i),
    })]);
    expect(h.cartRows()).toHaveLength(1);
  });

  it('otro menú guarda el ají y quita el pan sin una línea extra', async () => {
    const meal = { id: 9912, code: 9912, name: 'Wrap Andino', price: 16000, availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Pan', options: ['Integral', 'sin pan'] }] };
    const h = harness([meal], false);
    await h.sendQueued('Para un wrap andino con ají y sin pan');
    expect(h.cartRows()).toEqual([expect.objectContaining({
      id: 9912,
      qty: 1,
      attrs: expect.arrayContaining(['Pan:sin pan']),
      note: expect.stringMatching(/aj[ií]/i),
    })]);
  });

  it.each([
    { menu: products, ask: 'En combo a cuánto sale y sólo' },
    { menu: [bowl], ask: 'En combo a cuánto sale y sólo' },
  ])('preguntar combo o suelto no compra: $ask', async ({ menu, ask }) => {
    const h = harness(menu, false);
    await h.sendQueued(ask);
    expect(h.cartRows()).toEqual([]);
    expect(h.replies.at(-1)).not.toMatch(/no manejamos:\s*_?en combo/i);
  });

  it('qué sopa es no agrega otra sopa al ejecutivo', async () => {
    const h = harness(products, false);
    await h.sendQueued('Veci me regalas por favor un ejecutivo con pollo frito');
    const ids = h.cartRows().map((row) => row.id);
    await h.sendQueued('Que sopa es Veci?');
    expect(h.cartRows().map((row) => row.id)).toEqual(ids);
    expect(h.replies.at(-1)).toMatch(/ajiaco|menudencias|mondongo/i);
  });

  it('la lista copiada más el sabor no compra seis gaseosas', async () => {
    const h = harness(products, false);
    await h.sendQueued('Un combo de pollo frito');
    await h.sendQueued('Te ofrecemos colombiana, Manzana, ginger, uva, pepsi, 7up y coca cola\nGinger');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 99, qty: 1, attrs: expect.arrayContaining(['Bebida:Ginger']) })]);
  });

  it('repetir la cantidad no duplica el pedido', async () => {
    const h = harness(products, false);
    ready(h);
    await h.sendQueued('pedido porfa DoS Arroz con pollo');
    await h.sendQueued('CALle 6b#78c37');
    await h.sendQueued('2 arroces');
    await h.sendQueued('Con pollo');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 23, qty: 2 })]);
    expect(h.conv.sessionData.address).toMatch(/6b/i);
    expect(h.conv.sessionData.address).not.toMatch(/arroz|pollo/i);
  });

  it('dos ejecutivos se reparten presa y sopa', async () => {
    const h = harness(products, false);
    await h.sendQueued('Dos menu ejecutivo por favor');
    await h.sendQueued('Pollo frito');
    await h.sendQueued('Uno con presa pierna pernil y de sopa ajiaco y el otro con presa pechuga y de sopa mondongo');
    expect(h.cartRows()).toHaveLength(2);
    expect(h.cartRows().every((row) => row.id === 22 && row.qty === 1)).toBe(true);
    const attrs = h.cartRows().map((row) => row.attrs.join('|')).join(' || ');
    expect(attrs).toMatch(/Pierna Pernil/);
    expect(attrs).toMatch(/pechuga/i);
    expect(attrs).toMatch(/Ajiaco/);
    expect(attrs).toMatch(/Mondongo/);
  });
});


describe('Ejecutivo en tres mensajes — caso humano reportado',()=>{
  const turns=['Quiero pedir un almuerzo ejecutivo por favor','Mondongo pollo frito pierna pernil papa salada','Y de tomar me puedes enviar limonada?'];
  it.each(['separados','texto agrupado'])('conserva un almuerzo con sus opciones: %s',async mode=>{
    const h=harness(products,false);
    if(mode==='separados')for(const text of turns)await h.sendQueued(text);
    else await h.sendQueued(turns.join('\n'));
    expect(h.cartRows()).toEqual([expect.objectContaining({id:22,qty:1,attrs:expect.arrayContaining(['Sopa:Mondongo','Presa:Pierna Pernil','Bebida:Limonada'])})]);
    expect(h.cartRows()[0].note).toMatch(/papa salada/i);
    expect(h.replies.at(-1)).not.toMatch(/no manejamos|no entend[ií]/i);
  });
});


describe('Ráfagas complejas — cantidad, opciones y reintentos',()=>{
  const lunch={id:9981,code:9981,name:'Menu Vegetariano',description:'Incluye sopa y bebida',price:18000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sopa',options:['Calabaza','Lentejas']},{attributeName:'Bebida',options:['Agua','Te']}]};
  for(const fixture of [
    {menu:products,id:22,dish:'almuerzo ejecutivo',options:'Mondongo pollo frito pierna pernil papa salada',drink:'Y de tomar me puedes enviar limonada?',attrs:['Sopa:Mondongo','Presa:Pierna Pernil','Bebida:Limonada'],note:/papa salada/i},
    {menu:[lunch],id:9981,dish:'menu vegetariano',options:'Sopa de lentejas sin ensalada',drink:'Y de tomar la bebida te',attrs:['Sopa:Lentejas','Bebida:Te'],note:/sin ensalada/i},
  ])for(const qty of [1,2])for(const replay of [false,true]) {
    it('unifica '+fixture.dish+' qty='+qty+' replay='+replay,async()=>{
      jest.useFakeTimers();
      try {
        const h=harness(fixture.menu,false);
        const texts=['Quiero pedir '+(qty===1?'un':'dos')+' '+fixture.dish+' por favor',fixture.options,fixture.drink];
        const messages=texts.map((text,index)=>({waId:'customer',phoneE164:h.conv.phoneE164,messageId:'complex-'+index,messageType:'text',text,timestamp:index+1,raw:{}}));
        if(replay)messages.push({...messages[1]});
        const pending=messages.map(message=>h.service.handleIncoming(message));
        await jest.advanceTimersByTimeAsync(3000);await Promise.all(pending);
        expect(h.replies).toHaveLength(1);
        expect(h.cartRows()).toEqual([expect.objectContaining({id:fixture.id,qty,attrs:expect.arrayContaining(fixture.attrs),note:expect.stringMatching(fixture.note)})]);
        expect(h.replies[0]).not.toMatch(/no manejamos|no entend[ií]/i);
      }finally{jest.useRealTimers();}
    });
  }
});


describe('Ráfagas — bebida incluida y sopa adicional independiente',()=>{
  const lunch={id:9991,code:9991,name:'Menu Vegetariano',description:'Incluye sopa y bebida',price:18000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sopa',options:['Calabaza','Lentejas']},{attributeName:'Bebida',options:['Agua','Te']}]};
  const soup={id:9992,code:9992,name:'Sopa De Lentejas',price:7000,availableNow:true,attributes:[]};
  for(const fixture of [
    {menu:products,id:22,extra:38,dish:'almuerzo ejecutivo',options:'Mondongo pollo frito pierna pernil papa salada',drink:'Y de tomar me puedes enviar limonada?',extraText:'Y una sopa de ajiaco adicional aparte',attrs:['Sopa:Mondongo','Presa:Pierna Pernil','Bebida:Limonada']},
    {menu:[lunch,soup],id:9991,extra:9992,dish:'menu vegetariano',options:'Sopa de lentejas sin ensalada',drink:'Y de tomar la bebida te',extraText:'Y una sopa de lentejas adicional aparte',attrs:['Sopa:Lentejas','Bebida:Te']},
  ])for(const qty of [1,2])for(const mode of ['ráfaga','separados']) {
    it(fixture.dish+' qty='+qty+' '+mode,async()=>{
      const h=harness(fixture.menu,false);
      const texts=['Quiero pedir '+(qty===1?'un':'dos')+' '+fixture.dish+' por favor',fixture.options,fixture.drink,fixture.extraText];
      if(mode==='ráfaga'){
        jest.useFakeTimers();try{
          const pending=texts.map((text,index)=>h.service.handleIncoming({waId:'customer',phoneE164:h.conv.phoneE164,messageId:'extra-'+index,messageType:'text',text,timestamp:index+1,raw:{}}));
          await jest.advanceTimersByTimeAsync(3000);await Promise.all(pending);
          expect(h.replies).toHaveLength(1);
        }finally{jest.useRealTimers();}
      }else for(const text of texts)await h.sendQueued(text);
      expect(h.cartRows()).toHaveLength(2);
      expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:fixture.id,qty,attrs:expect.arrayContaining(fixture.attrs)}),expect.objectContaining({id:fixture.extra,qty:1})]));
      expect(h.replies.at(-1)).not.toMatch(/no manejamos|no entend[ií]/i);
    });
  }
});


describe('Pausas entre mensajes — contexto del menú y adicionales',()=>{
  const lunch={id:9994,code:9994,name:'Menu Vegetariano',description:'Incluye sopa y bebida',price:18000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sopa',options:['Calabaza','Lentejas']},{attributeName:'Bebida',options:['Agua','Te']}]};
  const soup={id:9995,code:9995,name:'Sopa De Lentejas',price:7000,availableNow:true,attributes:[]};
  for(const fixture of [
    {menu:products,id:22,extra:38,dish:'almuerzo ejecutivo',named:'Ejecutivo Con Pollo Frito',options:'Mondongo pollo frito pierna pernil papa salada',drink:'Y de tomar me puedes enviar limonada?',extraText:'Y una sopa de ajiaco adicional aparte',attrs:['Sopa:Mondongo','Presa:Pierna Pernil','Bebida:Limonada']},
    {menu:[lunch,soup],id:9994,extra:9995,dish:'menu vegetariano',named:'Menu Vegetariano',options:'Sopa de lentejas sin ensalada',drink:'Y de tomar la bebida te',extraText:'Y una sopa de lentejas adicional aparte',attrs:['Sopa:Lentejas','Bebida:Te']},
  ]){
    it.each([5000,60000])('pausa %d conserva opciones y separa extra en '+fixture.dish,async delay=>{
      jest.useFakeTimers();try{
        const h=harness(fixture.menu,false);let seq=0;
        const turn=async(text:string)=>{const pending=h.service.handleIncoming({waId:'customer',phoneE164:h.conv.phoneE164,messageId:'pause-'+seq++,messageType:'text',text,timestamp:Date.now()/1000,raw:{}});await jest.advanceTimersByTimeAsync(3000);await pending;await jest.advanceTimersByTimeAsync(delay);};
        await turn('Quiero pedir dos '+fixture.dish+' por favor');await turn(fixture.options);await turn(fixture.drink);
        expect(h.cartRows()).toEqual([expect.objectContaining({id:fixture.id,qty:2,attrs:expect.arrayContaining(fixture.attrs)})]);
        await turn(fixture.extraText);
        expect(h.cartRows()).toHaveLength(2);expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:fixture.id,qty:2,attrs:expect.arrayContaining(fixture.attrs)}),expect.objectContaining({id:fixture.extra,qty:1,note:undefined})]));
      }finally{jest.useRealTimers();}
    });
    it('consulta y corrección posterior conservan extra en '+fixture.dish,async()=>{
      const h=harness(fixture.menu,false);
      await h.sendQueued('Quiero pedir dos '+fixture.dish+' por favor');await h.sendQueued(fixture.options);await h.sendQueued(fixture.drink);await h.sendQueued(fixture.extraText);
      const before=structuredClone(h.conv.sessionData.cart);
      await h.sendQueued('Cuánto cuesta '+fixture.named+'?');expect(h.conv.sessionData.cart).toEqual(before);
      await h.sendQueued('Perdón, quiero tres '+fixture.named);
      expect(h.cartRows()).toHaveLength(2);expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:fixture.id,qty:3,attrs:expect.arrayContaining(fixture.attrs)}),expect.objectContaining({id:fixture.extra,qty:1})]));
      expect(h.replies.at(-1)).not.toMatch(/no entend[ií]|no manejamos/i);
    });
  }
});


describe('Aclaración de cambio — referencia por posición',()=>{
  const alt=[{id:9971,code:71,name:'Bowl Mediterraneo',price:18000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Base',options:['Arroz','Quinoa']}]},{id:9972,code:72,name:'Bowl Andino',price:19000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Base',options:['Arroz','Quinoa']}]}];
  for(const f of [{menu:products,ids:[1,4],names:['1 Pollo Frito','1 Pollo Broaster'],attr:'Arepas',before:'Blancas',after:'Fritas',request:'Lo quiero con arepas fritas y bastante ají'},{menu:alt,ids:[9971,9972],names:['Bowl Mediterraneo','Bowl Andino'],attr:'Base',before:'Arroz',after:'Quinoa',request:'Lo quiero con quinoa y bastante ají'}]){
    const setup=()=>{const h=harness(f.menu,false);h.conv.sessionData.cart=f.ids.map((productId,index)=>({productId,code:productId,name:f.names[index],unitPrice:18000,quantity:index===0?2:1,attributes:[{attributeName:f.attr,attributeValue:f.before}]}));return h;};
    it.each([['el primero',0],['el segundo',1],['2',1]])('elige %s sin comprar otro producto en '+f.names[0],async(answer,index)=>{
      const h=setup();const before=structuredClone(h.cartRows());await h.sendQueued(f.request);expect(h.cartRows()).toEqual(before);
      await h.sendQueued(String(answer));
      expect(h.cartRows()).toHaveLength(2);expect(h.cartRows()[Number(index)]).toMatchObject({qty:before[Number(index)].qty,attrs:[f.attr+':'+f.after],note:expect.stringMatching(/bastante ají/i)});
      expect(h.cartRows()[1-Number(index)]).toEqual(before[1-Number(index)]);
      expect(h.conv.sessionData.pendingCartAttributeEdit).toBeUndefined();
    });
    it('posición inexistente conserva aclaración en '+f.names[0],async()=>{
      const h=setup();await h.sendQueued(f.request);const before=structuredClone(h.cartRows());await h.sendQueued('el tercero');
      expect(h.cartRows()).toEqual(before);expect(h.conv.sessionData.pendingCartAttributeEdit).toBeDefined();
    });
  }
});


describe('PDF pendiente — reparto con notas por línea',()=>{
  it('dos ejecutivos conservan opciones y papa solicitada por separado',async()=>{
    const h=harness(products,false);await h.sendQueued('Dos menu ejecutivo por favor');await h.sendQueued('Pollo frito');
    await h.sendQueued('Los quiero 1 con presa pierna pernil sopa ajiaco y papa salada y 1 con presa pechuga sopa mondongo y sin ensalada');
    expect(h.cartRows()).toHaveLength(2);expect(h.cartRows().every(row=>row.id===22&&row.qty===1)).toBe(true);
    const first=h.cartRows().find(row=>row.attrs.includes('Sopa:Ajiaco'))!;const second=h.cartRows().find(row=>row.attrs.includes('Sopa:Mondongo'))!;
    expect(first.attrs).toContain('Presa:Pierna Pernil');expect(first.note).toMatch(/papa salada/i);expect(first.note).not.toMatch(/sin ensalada/i);
    expect(second.attrs.join(' ')).toMatch(/pechuga/i);expect(second.note).toMatch(/sin ensalada/i);expect(second.note).not.toMatch(/papa salada/i);
  });
});

describe('PDF pendiente — pedido dirección barrio en ráfaga',()=>{
  const bowl={id:9961,code:9961,name:'Bowl Mediterraneo',price:18000,availableNow:true,attributes:[]};
  for(const f of [{menu:products,id:23,dish:'arroz con pollo'},{menu:[bowl],id:9961,dish:'bowl mediterraneo'}]){
    it('conserva dos '+f.dish+' y dirección completa con una respuesta',async()=>{
      jest.useFakeTimers();try{
        const h=harness(f.menu,false);Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164});
        const texts=['Quiero dos '+f.dish,'Para la calle 12 #34-56 casa 8','Barrio Castilla'];
        const pending=texts.map((text,index)=>h.service.handleIncoming({waId:'customer',phoneE164:h.conv.phoneE164,messageId:'address-burst-'+index,messageType:'text',text,timestamp:index+1,raw:{}}));
        await jest.advanceTimersByTimeAsync(3000);await Promise.all(pending);
        expect(h.cartRows()).toEqual([expect.objectContaining({id:f.id,qty:2})]);
        expect(h.conv.sessionData.address).toMatch(/12.*34-56.*casa 8.*Castilla/is);expect(h.conv.sessionData.address).not.toMatch(/arroz|bowl/i);
        expect(h.replies).toHaveLength(1);expect(h.replies[0]).not.toMatch(/no entend[ií]|no manejamos/i);
      }finally{jest.useRealTimers();}
    });
  }
});


describe('Reparto de menú alternativo — notas y cantidad',()=>{
  const menu=[{id:9951,code:9951,name:'Menu Vegetariano',price:18000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Base',options:['Arroz','Quinoa']},{attributeName:'Sopa',options:['Lentejas','Calabaza']}]}];
  it('mantiene notas de cada unidad sin propagarlas',async()=>{
    const h=harness(menu,false);await h.sendQueued('Quiero dos menu vegetariano');
    await h.sendQueued('Los quiero 1 con arroz sopa lentejas y sin cebolla y 1 con quinoa sopa calabaza y sin ensalada');
    expect(h.cartRows()).toHaveLength(2);
    const a=h.cartRows().find(row=>row.attrs.includes('Base:Arroz'))!;const b=h.cartRows().find(row=>row.attrs.includes('Base:Quinoa'))!;
    expect(a).toMatchObject({qty:1,note:expect.stringMatching(/sin cebolla/i)});expect(a.note).not.toMatch(/sin ensalada/i);
    expect(b).toMatchObject({qty:1,note:expect.stringMatching(/sin ensalada/i)});expect(b.note).not.toMatch(/sin cebolla/i);
  });
  it('no aplica reparto que excede cantidad existente',async()=>{
    const h=harness(menu,false);await h.sendQueued('Quiero dos menu vegetariano');const before=structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('Los quiero 2 con arroz sopa lentejas y sin cebolla y 1 con quinoa sopa calabaza y sin ensalada');
    expect(h.conv.sessionData.cart).toEqual(before);expect(h.replies.at(-1)).toMatch(/cantidad|repartimos/i);
  });
});


describe('Reservados de seguimiento — variante y aclaración antes de editar',()=>{
  it('compra dos mojarras con nota dirección y transferencia sin usar la placa como cantidad',async()=>{
    const h=harness(products,false);Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164});
    await h.sendQueued('Dos mojarras fritas sin ensalada para la carrera 7 20 30, pago por transferencia');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:14,qty:2,note:expect.stringMatching(/sin ensalada/i),attrs:expect.arrayContaining(['Seleccion:Frita'])})]);
    expect(h.conv.sessionData.address).toMatch(/7.*20.*30/);expect(h.conv.sessionData.paymentMethod).toBe('transfer');
    expect(h.replies.at(-1)).not.toMatch(/no entend[ií]|no manejamos/i);
  });
  const fish={id:9941,code:9941,name:'Pescado Andino',price:20000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Preparacion',options:['Frita','Asada']}]};
  for(const f of [{menu:products,id:14,name:'Mojarra',attr:'Seleccion',drink:37},{menu:[fish],id:9941,name:'Pescado Andino',attr:'Preparacion',drink:9942}]){
    it('corrección sin preparación no modifica dos variantes de '+f.name,async()=>{
      const h=harness(f.menu,false);h.conv.sessionData.cart=[
        {productId:f.id,code:f.id,name:f.name,unitPrice:20000,quantity:1,note:'sin ensalada',attributes:[{attributeName:f.attr,attributeValue:'Frita'}]},
        {productId:f.id,code:f.id,name:f.name,unitPrice:20000,quantity:3,note:'bien asado',attributes:[{attributeName:f.attr,attributeValue:'Asada'}]},
        {productId:f.drink,code:f.drink,name:'Bebida de prueba',unitPrice:4000,quantity:1,attributes:[]},
      ];const before=structuredClone(h.conv.sessionData.cart);
      await h.sendQueued('Perdón, dos '+f.name);
      expect(h.conv.sessionData.cart).toEqual(before);expect(h.replies.at(-1)).toMatch(/cu[aá]l|preparaci[oó]n/i);
    });
    it('foto ilegible después de nota conserva selección de '+f.name,async()=>{
      const h=harness(f.menu,false);h.conv.sessionData.cart=[{productId:f.id,code:f.id,name:f.name,unitPrice:20000,quantity:2,note:'sin ensalada',attributes:[{attributeName:f.attr,attributeValue:'Frita'}]}];
      const before=structuredClone(h.conv.sessionData.cart);h.service.metaService.downloadMedia=jest.fn().mockResolvedValue({buffer:Buffer.from('mock'),mimeType:'image/jpeg'});
      h.service.catalogService.getMenuDetailedText=jest.fn().mockResolvedValue(f.name);h.service.aiService.analyzeOrderImage=jest.fn().mockResolvedValue({kind:'unclear',textForBot:'',reply:'No pude leer la foto'});
      h.service.conversationService.updateMessageBody=jest.fn().mockResolvedValue(undefined);
      await h.sendQueued('',{messageType:'image',mediaId:'late-unreadable'});
      expect(h.conv.sessionData.cart).toEqual(before);expect(h.replies).toHaveLength(1);expect(h.replies[0]).toMatch(/plato.*código/s);
    });
  }
});


describe('Pedido completo largo — alcance de cada plato',()=>{
  it.each(['; ','\n',' y '])('tres productos conservan cantidades notas dirección y pago con separador %j',async sep=>{
    const h=harness(products,false);Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164});
    const text=['Buenas tardes, por favor quiero dos churrascos 3/4 sin ensalada','un arroz con pollo con harto ají','dos limonadas naturales'].join(sep)+'. Para la calle 12 #34-56 casa 8, pago por transferencia. Muchas gracias';
    await h.sendQueued(text);
    expect(h.cartRows()).toHaveLength(3);expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:17,qty:2,note:expect.stringMatching(/sin ensalada/i)}),expect.objectContaining({id:23,qty:1,note:expect.stringMatching(/harto ají/i)}),expect.objectContaining({id:37,qty:2})]));
    const rice=h.cartRows().find(row=>row.id===23)!;expect(rice.note).not.toMatch(/sin ensalada/i);
    expect(h.conv.sessionData.address).toMatch(/12.*34-56.*casa 8/i);expect(h.conv.sessionData.paymentMethod).toBe('transfer');expect(h.conv.state).not.toBe('building_cart');
    expect(h.replies.at(-1)).not.toMatch(/no entend[ií]|no manejamos/i);
  });
  const menu=[{id:9931,code:9931,name:'Bowl Mediterraneo',price:18000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Base',options:['Arroz','Quinoa']}]},{id:9932,code:9932,name:'Wrap Oriental',price:16000,availableNow:true,attributes:[]},{id:9933,code:9933,name:'Te Helado',price:4000,availableNow:true,attributes:[]}];
  it.each(['; ','\n'])('otro catálogo conserva seis unidades en mensaje completo %j',async sep=>{
    const h=harness(menu,false);Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164});
    await h.sendQueued(['Por favor quiero dos bowls mediterraneos con quinoa sin cebolla','dos wrap oriental sin salsa','dos te helado'].join(sep)+'. Para la carrera 9 #20-30 casa 4, pago por transferencia');
    expect(h.cartRows()).toHaveLength(3);expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:9931,qty:2,attrs:['Base:Quinoa'],note:expect.stringMatching(/sin cebolla/i)}),expect.objectContaining({id:9932,qty:2,note:expect.stringMatching(/sin salsa/i)}),expect.objectContaining({id:9933,qty:2})]));
    expect(h.conv.sessionData.paymentMethod).toBe('transfer');expect(h.conv.sessionData.address).toMatch(/9.*20-30.*casa 4/i);
  });
});


describe('Ejecutivo reportado — Plazuela y typos exactos',()=>{
  it('ala pechuga y mondongo son opciones de un solo ejecutivo',async()=>{
    const h=harness(products,false);Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164});
    await h.sendQueued('es para pedir un eejcutivo con pollo  frito, con papa salada, ala pechuga, sopa de mondongo , me puede dar le menu sin enslada por favor, es para plazuela de san esteban');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:22,qty:1,attrs:expect.arrayContaining(['Presa:Ala, pechuga','Sopa:Mondongo']),note:expect.stringMatching(/sin ensalada/i)})]);
    expect(h.cartRows()[0].note).toMatch(/papa salada/i);
    expect(h.conv.sessionData.address).toMatch(/plazuela.*san esteban/i);
    expect(h.replies.at(-1)).not.toMatch(/no entend[ií]|no manejamos/i);
  });
});

// Catálogos aislados: los nombres/IDs cambian, el comportamiento esperado no.
describe('Generalización por catálogo — opciones incluidas y extras', () => {
  const cases = [
    { host: 'Menu Vegetariano', attr: 'Base', option: 'Quinoa', component: 'Quinoa', other: 'Arroz', soup: 'Calabaza' },
    { host: 'Menu Marino', attr: 'Preparacion', option: 'Plancha', component: 'Pescado Plancha', other: 'Frita', soup: 'Tomate' },
    { host: 'Menu Oriental', attr: 'Proteina', option: 'Tofu', component: 'Tofu', other: 'Ternera', soup: 'Lentejas' },
  ];
  for (const [index, fixture] of cases.entries()) {
    const id = 11000 + index * 10;
    const menu = [
      { id, code:id, name:fixture.host, price:19000, availableNow:true, hasAttributes:true, attributes:[
        {attributeName:fixture.attr, options:[fixture.other,fixture.option]},
        {attributeName:'Sopa', options:['Verduras',fixture.soup]},
      ] },
      {id:id+1,code:id+1,name:fixture.component,price:9000,availableNow:true,attributes:[]},
      {id:id+2,code:id+2,name:'Sopa De '+fixture.soup,price:5000,availableNow:true,attributes:[]},
    ];
    it(fixture.host+' mantiene componentes dentro del menú con dirección', async()=>{
      const h=harness(menu,false);
      Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164});
      await h.sendQueued(`Por favor quiero dos ${fixture.host} con ${fixture.option}, sopa de ${fixture.soup}, sin ensalada para la calle 10 #20-30`);
      expect(h.cartRows()).toEqual([expect.objectContaining({id,qty:2,attrs:expect.arrayContaining([fixture.attr+':'+fixture.option,'Sopa:'+fixture.soup]),note:expect.stringMatching(/sin ensalada/i)})]);
      expect(h.conv.sessionData.address).toMatch(/10.*20-30/);
      expect(h.replies.at(-1)).not.toMatch(/no entend[ií]|no manejamos/i);
    });
    it(fixture.host+' una opción compartida pide aclaración y no modifica el carrito', async()=>{
      const second={...menu[0],id:id+3,code:id+3,name:fixture.host+' Especial'};
      const h=harness([...menu,second],false);
      h.conv.sessionData.cart=[menu[0],second].map(product=>({productId:product.id,code:product.code,name:product.name,unitPrice:product.price,quantity:2,note:'sin ensalada',attributes:[{attributeName:fixture.attr,attributeValue:fixture.option},{attributeName:'Sopa',attributeValue:fixture.soup}]}));
      const before=structuredClone(h.conv.sessionData.cart);
      await h.sendQueued(`Mejor con ${fixture.other}`);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.replies.at(-1)).toMatch(/a cu[aá]l plato/i);
      expect(h.conv.sessionData.pendingCartAttributeEdit?.candidates).toHaveLength(2);
    });
    it(fixture.host+' consultar precio no compra el menú', async()=>{
      const h=harness(menu,false);
      await h.sendQueued(`Cuánto cuesta el ${fixture.host}?`);
      expect(h.cartRows()).toEqual([]);
      expect(h.replies.at(-1)).toMatch(/19[.,]?000/);
    });
    it(fixture.host+' corrige una opción sin duplicar ni perder la nota', async()=>{
      const h=harness(menu,false);
      await h.sendQueued(`Quiero dos ${fixture.host} con ${fixture.option} y sopa de ${fixture.soup}, sin ensalada`);
      await h.sendQueued(`Mejor con ${fixture.other}`);
      expect(h.cartRows()).toEqual([expect.objectContaining({id,qty:2,attrs:expect.arrayContaining([fixture.attr+':'+fixture.other,'Sopa:'+fixture.soup]),note:expect.stringMatching(/sin ensalada/i)})]);
      expect(h.replies.at(-1)).not.toMatch(/no entend[ií]|no manejamos/i);
    });
    it(fixture.host+' distingue sopa incluida de otra pedida aparte', async()=>{
      const h=harness(menu,false);
      await h.sendQueued(`Quiero dos ${fixture.host} con ${fixture.option} y sopa de ${fixture.soup}; aparte una sopa de ${fixture.soup}`);
      expect(h.cartRows()).toHaveLength(2);
      expect(h.cartRows()).toEqual(expect.arrayContaining([
        expect.objectContaining({id,qty:2,attrs:expect.arrayContaining([fixture.attr+':'+fixture.option,'Sopa:'+fixture.soup])}),
        expect.objectContaining({id:id+2,qty:1}),
      ]));
      expect(h.replies.at(-1)).not.toMatch(/no entend[ií]|no manejamos/i);
    });
  }
});

describe('Compuestos sin envoltorio — otros restaurantes',()=>{
  for(const [index,f] of [
    {name:'Hamburguesa Artesanal',attr:'Queso',option:'Cheddar',other:'Mozzarella',side:'Cheddar'},
    {name:'Pizza Campestre',attr:'Masa',option:'Delgada',other:'Gruesa',side:'Pan Delgada'},
    {name:'Bowl Tropical',attr:'Base',option:'Quinoa',other:'Arroz',side:'Quinoa'},
  ].entries()){
    const id=12000+index*10;
    const menu=[{id,code:id,name:f.name,price:21000,availableNow:true,hasAttributes:true,attributes:[{attributeName:f.attr,options:[f.other,f.option]}]},
      {id:id+1,code:id+1,name:f.side,price:4000,availableNow:true,attributes:[]}];
    it(f.name+' opción incluida no agrega SKU del componente',async()=>{
      const h=harness(menu,false);await h.sendQueued(`Quiero dos ${f.name} con ${f.option}, sin cebolla`);
      expect(h.cartRows()).toEqual([expect.objectContaining({id,qty:2,attrs:[f.attr+':'+f.option],note:expect.stringMatching(/sin cebolla/i)})]);
      expect(h.replies.at(-1)).not.toMatch(/no entend[ií]|no manejamos/i);
    });
    it.each(['; ','\n',' y '])(f.name+' pedido completo con adicional y dirección %j',async sep=>{
      const h=harness(menu,false);Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164});
      await h.sendQueued([`Por favor quiero dos ${f.name} con ${f.option} sin cebolla`,`un ${f.side} aparte`].join(sep)+'. Para la carrera 8 #15-20, pago por transferencia');
      expect(h.cartRows()).toHaveLength(2);
      expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id,qty:2,attrs:[f.attr+':'+f.option],note:expect.stringMatching(/sin cebolla/i)}),expect.objectContaining({id:id+1,qty:1})]));
      expect(h.conv.sessionData.address).toMatch(/8.*15-20/);expect(h.conv.sessionData.paymentMethod).toBe('transfer');
      expect(h.replies.at(-1)).not.toMatch(/no entend[ií]|no manejamos/i);
    });
    it(f.name+' aclara cambio compartido y respeta elección del segundo',async()=>{
      const second={...menu[0],id:id+2,code:id+2,name:f.name+' Premium'};
      const h=harness([...menu,second],false);
      h.conv.sessionData.cart=[menu[0],second].map(product=>({productId:product.id,code:product.code,name:product.name,unitPrice:product.price,quantity:2,note:'sin cebolla',attributes:[{attributeName:f.attr,attributeValue:f.option}]}));
      const before=structuredClone(h.conv.sessionData.cart);
      await h.sendQueued(`Mejor con ${f.other}`);
      expect(h.conv.sessionData.cart).toEqual(before);expect(h.replies.at(-1)).toMatch(/a cu[aá]l plato/i);
      await h.sendQueued('el segundo');
      expect(h.cartRows()).toEqual([
        expect.objectContaining({id,qty:2,attrs:[f.attr+':'+f.option],note:'sin cebolla'}),
        expect.objectContaining({id:id+2,qty:2,attrs:[f.attr+':'+f.other],note:'sin cebolla'}),
      ]);
      expect(h.replies.at(-1)).not.toMatch(/no entend[ií]|no manejamos/i);
    });
    it(f.name+' mencionar dos identidades explícitas conserva aclaración',async()=>{
      const second={...menu[0],id:id+2,code:id+2,name:f.name+' Premium'};
      const h=harness([...menu,second],false);
      h.conv.sessionData.cart=[menu[0],second].map(product=>({productId:product.id,code:product.code,name:product.name,unitPrice:product.price,quantity:2,attributes:[{attributeName:f.attr,attributeValue:f.option}]}));
      const before=structuredClone(h.conv.sessionData.cart);
      await h.sendQueued(`Mejor con ${f.other} para ${f.name} y ${second.name}`);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.replies.at(-1)).toMatch(/a cu[aá]l plato/i);
    });
    it(f.name+' adicional explícito conserva ambos productos',async()=>{
      const h=harness(menu,false);await h.sendQueued(`Quiero dos ${f.name} con ${f.option}; aparte un ${f.side}`);
      expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id,qty:2,attrs:[f.attr+':'+f.option]}),expect.objectContaining({id:id+1,qty:1})]));expect(h.cartRows()).toHaveLength(2);
    });
    it(f.name+' corrección y consulta conservan cantidad y nota',async()=>{
      const h=harness(menu,false);await h.sendQueued(`Quiero dos ${f.name} con ${f.option}, sin cebolla`);
      await h.sendQueued(`Mejor con ${f.other}`);
      const before=structuredClone(h.conv.sessionData.cart);
      await h.sendQueued(`Cuánto cuesta la ${f.name}?`);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.cartRows()).toEqual([expect.objectContaining({id,qty:2,attrs:[f.attr+':'+f.other],note:expect.stringMatching(/sin cebolla/i)})]);
      expect(h.replies.at(-1)).toMatch(/21[.,]?000/);
    });
  }
});

describe('Puerta de piloto — consultas opciones y cierre',()=>{
  for(const [index,f] of [
    {name:'Hamburguesa Artesanal',attr:'Queso',first:'Cheddar',next:'Mozzarella',missing:'Roquefort'},
    {name:'Pizza Campestre',attr:'Masa',first:'Delgada',next:'Gruesa',missing:'Integral'},
    {name:'Bowl Tropical',attr:'Base',first:'Quinoa',next:'Arroz',missing:'Cuscus'},
  ].entries()){
    const id=13000+index*10;
    const menu=[{id,code:id,name:f.name,price:21000,availableNow:true,hasAttributes:true,attributes:[{attributeName:f.attr,options:[f.first,f.next]}]}];
    const seed=async(checkout=false)=>{
      const h=harness(menu,false);Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164});
      await h.sendQueued(`Quiero dos ${f.name} con ${f.first} sin cebolla`+(checkout?' para la calle 10 #20-30, pago por transferencia':''));
      return h;
    };
    it(f.name+' pregunta sobre cambio no modifica',async()=>{
      const h=await seed();const before=structuredClone(h.conv.sessionData.cart);
      await h.sendQueued(`¿Se puede con ${f.next}?`);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.replies.at(-1)).not.toMatch(/listo.*queda|ya.*cambi|agregu[eé]/i);
    });
    it(f.name+' precio de cambio no modifica ni inventa recargo',async()=>{
      const h=await seed();const before=structuredClone(h.conv.sessionData.cart);
      await h.sendQueued(`¿Cuánto cuesta cambiar ${f.attr} a ${f.next}?`);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.replies.at(-1)).not.toMatch(/gratis|sin (?:costo|recargo)|recargo.*\$\s*\d/i);
    });
    it(f.name+' opción inexistente no se aplica ni se registra como cambio aceptado',async()=>{
      const h=await seed();const before=structuredClone(h.conv.sessionData.cart);
      await h.sendQueued(`Cambia ${f.attr} a ${f.missing}`);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.replies.at(-1)).toMatch(/opci[oó]n|prefieres|cu[aá]l|no.*(?:carta|disponible|confirmar|maneja)/i);
      expect(h.replies.at(-1)).not.toMatch(/listo.*queda|ya.*cambi|agregu[eé]/i);
      expect(h.replies.at(-1)).toContain(f.first);expect(h.replies.at(-1)).toContain(f.next);
    });
    it.each([1,2,3])(f.name+' compra %i unidades sin tomar números de la dirección',async qty=>{
      const h=harness(menu,false);Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164});
      await h.sendQueued(`Quiero ${qty} ${f.name} con ${f.first} para la calle 10 #20-30 apartamento 302, pago por transferencia`);
      expect(h.cartRows()).toEqual([expect.objectContaining({id,qty,attrs:[f.attr+':'+f.first]})]);
      expect(h.conv.sessionData.address).toMatch(/10.*20-30.*302/);expect(h.conv.state).toBe('awaiting_final_confirm');
    });
    it(f.name+' consulta condicional durante cierre no autoriza cambio',async()=>{
      const h=await seed(true);const before=structuredClone(h.conv.sessionData.cart);
      await h.sendQueued(`Si lo cambio a ${f.next}, cuánto cuesta?`);
      expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.state).toBe('awaiting_final_confirm');
      expect(h.replies.at(-1)).toMatch(/confirm.*restaurante|restaurante.*confirm/i);
    });
    it(f.name+' cambia opción durante confirmación conservando dirección pago y nota',async()=>{
      const h=await seed(true);expect(h.conv.state).toBe('awaiting_final_confirm');
      await h.sendQueued(`Mejor con ${f.next}`);
      expect(h.cartRows()).toEqual([expect.objectContaining({id,qty:2,attrs:[f.attr+':'+f.next],note:expect.stringMatching(/sin cebolla/i)})]);
      expect(h.conv.sessionData.address).toMatch(/10.*20-30/);expect(h.conv.sessionData.paymentMethod).toBe('transfer');
      expect(h.conv.state).toBe('awaiting_final_confirm');expect(h.replies.at(-1)).toMatch(/confirmar/i);
    });
    it(f.name+' cambia dirección durante pago y mantiene producto y notas',async()=>{
      const h=await seed(true);h.conv.sessionData.paymentMethod=undefined;h.conv.state='awaiting_payment';const before=structuredClone(h.conv.sessionData.cart);
      await h.sendQueued('Cambia la dirección a la carrera 8 #15-20 apartamento 302');
      expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.address).toMatch(/8.*15-20.*302/);
      expect(h.replies.at(-1)).toMatch(/c[oó]mo pagas|m[eé]todo de pago/i);
      expect(h.conv.state).toBe('awaiting_payment');
    });
    it(f.name+' corrige cantidad antes de confirmar sin perder selección',async()=>{
      const h=await seed(true);await h.sendQueued(`Deja solo un ${f.name}`);
      expect(h.cartRows()).toEqual([expect.objectContaining({id,qty:1,attrs:[f.attr+':'+f.first],note:expect.stringMatching(/sin cebolla/i)})]);
      expect(h.conv.sessionData.address).toMatch(/10.*20-30/);expect(h.conv.sessionData.paymentMethod).toBe('transfer');expect(h.conv.state).toBe('awaiting_final_confirm');
      expect(h.replies.at(-1)).toMatch(/confirmar/i);
    });
  }
});

describe('Chat Banderas — intención precio corrección y referencia',()=>{
  const fixtures=[
    {menu:products,id:6,name:'1/4 Pollo Broaster',order:'un cuarto de broster',larger:'medio',price:15000,place:'Almacén Metro Bandera'},
    {menu:[{id:14001,code:14001,name:'Bowl Pequeño',price:18000,availableNow:true,attributes:[]},{id:14002,code:14002,name:'Bowl Mediano',price:23000,availableNow:true,attributes:[]}],id:14001,name:'Bowl Pequeño',order:'un bowl pequeño',larger:'bowl mediano',price:18000,place:'Boutique Sol'},
    {menu:[{id:14101,code:14101,name:'Pizza Individual',price:20000,availableNow:true,attributes:[]},{id:14102,code:14102,name:'Pizza Mediana',price:28000,availableNow:true,attributes:[]}],id:14101,name:'Pizza Individual',order:'una pizza individual',larger:'pizza mediana',price:20000,place:'Oficina Aurora'},
  ];
  for(const f of fixtures){
    const seed=async()=>{const h=harness(f.menu,false);await h.sendQueued('Quiero '+f.order);expect(h.cartRows()).toEqual([expect.objectContaining({id:f.id,qty:1})]);return h;};
    it(f.name+' cortesía de aceptación no es otro producto',async()=>{
      const h=harness(f.menu,false);await h.sendQueued('Si regálame '+f.order);
      expect(h.cartRows()).toEqual([expect.objectContaining({id:f.id,qty:1})]);
      expect(h.replies.at(-1)).not.toMatch(/no manejamos.*reg[aá]lame|varios platos/s);
    });
    it(f.name+' precio de otro tamaño no inicia compra',async()=>{
      const h=await seed();const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued('Y el '+f.larger+' vale cuanto');
      expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingMatch?.intent).not.toBe('order');
      expect(h.replies.at(-1)).toMatch(/\$[\d.,]+/);expect(h.replies.at(-1)).not.toMatch(/c[oó]mo lo quieres|escribe el n[uú]mero/i);
    });
    it.each(['building_cart','awaiting_payment','awaiting_final_confirm'])(f.name+' disputa de precio no duplica en %s',async state=>{
      const h=await seed();h.conv.state=state;Object.assign(h.conv.sessionData,{orderType:'delivery',address:f.place,addressConfirmed:true});
      const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued(`Cómo así y no cuesta 13mil el ${f.name}`);
      expect(h.conv.sessionData.cart).toEqual(before);expect(h.replies.at(-1)).toMatch(new RegExp(String(f.price/1000)+'[.,]?000'));
      expect(h.replies.at(-1)).not.toMatch(/agregu[eé]|agregado/i);
    });
    it.each(['Quiero saber cuanto cuesta','Y ese poco de plata'])(f.name+' atiende reclamo durante pago: %s',async text=>{
      const h=await seed();h.conv.state='awaiting_payment';const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued(text);
      expect(h.conv.sessionData.cart).toEqual(before);expect(h.replies.at(-1)).toMatch(new RegExp(String(f.price/1000)+'[.,]?000'));
    });
    it(f.name+' corrección durante nombre no captura comando como persona',async()=>{
      const h=await seed();h.conv.state='awaiting_name';const name=h.conv.customerName;await h.sendQueued('No dame '+f.order);
      expect(h.conv.customerName).toBe(name);expect(h.cartRows()).toEqual([expect.objectContaining({id:f.id,qty:1})]);
    });
    it(f.name+' corrección cambia cantidad absoluta y no suma',async()=>{
      const h=await seed();h.conv.state='awaiting_name';const name=h.conv.customerName;
      await h.sendQueued('No dame dos '+f.name);
      expect(h.conv.customerName).toBe(name);expect(h.cartRows()).toEqual([expect.objectContaining({id:f.id,qty:2})]);
    });
    it(f.name+' referencia explícita corrige destino pendiente',async()=>{
      const h=await seed();h.conv.state='awaiting_address';Object.assign(h.conv.sessionData,{orderType:'delivery',address:'Referencia anterior',addressConfirmed:false});
      const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued('La dirección en '+f.place);
      expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.address).toContain(f.place);
      expect(h.replies.at(-1)).not.toMatch(/Referencia anterior/);
    });
  }
  it('recorrido original de consultas compra cambio de opinión dirección y reclamo',async()=>{
    const h=harness(products,false);
    for(const text of ['Hola buenos días','Cuanto cuesta una bandeja con pollo','Esa es para cuántas personas','Ese el más barato','Si','Que trae']) await h.sendQueued(text);
    expect(h.cartRows()).toEqual([]);
    await h.sendQueued('Si regálame un cuarto de broster');expect(h.cartRows()).toEqual([expect.objectContaining({id:6,qty:1})]);
    await h.sendQueued('Y el medio vale cuanto');expect(h.conv.sessionData.pendingMatch?.intent).not.toBe('order');
    await h.sendQueued('Dame el medio por favor para el almacén bandera');
    await h.sendQueued('No dame un cuarto');await h.sendQueued('De pollo broster por favor');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:6,qty:1})]);expect(h.conv.customerName).not.toBe('No dame un cuarto');
    for(const text of ['Almacén metro bandera','La dirección en almacén metro bandera']) await h.sendQueued(text);
    expect(h.conv.sessionData.address).toMatch(/metro.*bandera/i);
    await h.sendQueued('Es al frente de la estación bandera');
    const before=structuredClone(h.conv.sessionData.cart);
    for(const text of ['Si','Cómo así y no cuesta 13mil el cuarto de broster','No','Quiero saber cuanto cuesta','Y ese poco de plata']) {await h.sendQueued(text);expect(h.conv.sessionData.cart).toEqual(before);}
    expect(h.replies.at(-1)).toMatch(/15[.,]?000/);
  });
});

describe('Jugo — sabor y base sin decir la palabra jugo', () => {
  const fiction = [
    {
      id: 8861,
      code: 8861,
      name: 'Jugo De La Casa En Leche',
      price: 7000,
      hasAttributes: true,
      attributes: [{ attributeName: 'Sabor', options: ['Mora', 'Fresa'] }],
      availableNow: true,
    },
    {
      id: 8862,
      code: 8862,
      name: 'Jugo De La Casa En Agua',
      price: 5500,
      hasAttributes: true,
      attributes: [{ attributeName: 'Sabor', options: ['Mora', 'Fresa'] }],
      availableNow: true,
    },
    {
      id: 8863,
      code: 8863,
      name: 'Gaseosa De La Casa',
      price: 4000,
      hasAttributes: false,
      attributes: [],
      availableNow: true,
    },
  ];

  it('lulo en leche se suma al combo y no deja la nota cortada de las arepas', async () => {
    const h = harness(products, false);
    await h.sendQueued('quiero un combo de pollo frito, con las arepas fritas por favor');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 99,
        qty: 1,
        attrs: expect.arrayContaining(['Arepas:Fritas', 'Bebida:Colombiana']),
      }),
    ]);
    expect(h.cartRows()[0]?.note || '').not.toMatch(/arepas/i);

    await h.sendQueued('quieor uno de lulo en leche');
    expect(h.replies.at(-1) || '').not.toMatch(/no tenemos/i);
    expect(h.cartRows()).toEqual([
      expect.objectContaining({ id: 99, qty: 1, attrs: expect.arrayContaining(['Arepas:Fritas']) }),
      expect.objectContaining({ id: 51, qty: 1, attrs: expect.arrayContaining(['Sabor:Lulo']) }),
    ]);
  });

  it('otro menú: mora en leche elige el jugo y no el de agua', async () => {
    const h = harness(fiction, false);
    await h.sendQueued('quieor uno de mora en leche');
    expect(h.replies.at(-1) || '').not.toMatch(/no tenemos/i);
    expect(h.cartRows()).toEqual([
      expect.objectContaining({ id: 8861, qty: 1, attrs: expect.arrayContaining(['Sabor:Mora']) }),
    ]);
  });

  it('decir solo leche no compra el jugo', async () => {
    const h = harness(products, false);
    await h.sendQueued('Quiero una Leche por favor');
    expect(h.cartRows().map((row) => row.id)).not.toContain(51);
  });

  it('jugo de lulo sin base pregunta agua o leche y conserva el sabor', async () => {
    const h = harness(products, false);
    await h.sendQueued('quiero un jugo de lulo');
    const ask = h.replies.at(-1) || '';
    expect(ask).not.toMatch(/no tenemos/i);
    expect(ask).not.toMatch(/gaseosa 2\.5/i);
    expect(ask).toMatch(/agua/i);
    expect(ask).toMatch(/leche/i);
    expect(h.cartRows()).toEqual([]);

    await h.sendQueued('en leche');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({ id: 51, qty: 1, attrs: expect.arrayContaining(['Sabor:Lulo']) }),
    ]);
  });

  it('dos jugos de lulo y luego el número conservan cantidad y sabor', async () => {
    const h = harness(products, false);
    await h.sendQueued('dos jugos de lulo');
    expect(h.cartRows()).toEqual([]);
    await h.sendQueued('2');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({ id: 51, qty: 2, attrs: expect.arrayContaining(['Sabor:Lulo']) }),
    ]);
  });

  it('mango en agua y guanábana en leche eligen base y cantidad', async () => {
    const h = harness(products, false);
    await h.sendQueued('uno de mango en agua');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({ id: 50, qty: 1, attrs: expect.arrayContaining(['Sabor:Mango']) }),
    ]);
    await h.sendQueued('dos de guanabana en leche');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({ id: 50, qty: 1, attrs: expect.arrayContaining(['Sabor:Mango']) }),
      expect.objectContaining({ id: 51, qty: 2, attrs: expect.arrayContaining(['Sabor:Guanabana']) }),
    ]);
  });

  it('otro menú: jugo de mora pregunta y en agua no compra el de leche', async () => {
    const h = harness(fiction, false);
    await h.sendQueued('quiero un jugo de mora');
    const ask = h.replies.at(-1) || '';
    expect(ask).not.toMatch(/no tenemos/i);
    expect(ask).toMatch(/agua/i);
    expect(ask).toMatch(/leche/i);
    expect(h.cartRows()).toEqual([]);
    await h.sendQueued('en agua');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({ id: 8862, qty: 1, attrs: expect.arrayContaining(['Sabor:Mora']) }),
    ]);
  });

  it('otro menú: dos de fresa en leche no eligen el de agua', async () => {
    const h = harness(fiction, false);
    await h.sendQueued('dos de fresa en leche');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({ id: 8861, qty: 2, attrs: expect.arrayContaining(['Sabor:Fresa']) }),
    ]);
  });

  it('la bebida nombrada del combo no queda como nota cortada', async () => {
    const h = harness(products, false);
    await h.sendQueued('quiero un combo de pollo frito, con la bebida manzana por favor');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 99,
        qty: 1,
        attrs: expect.arrayContaining(['Bebida:Manzana']),
      }),
    ]);
    expect(h.cartRows()[0]?.note || '').not.toMatch(/manzana|por/i);
  });
});

describe('Chats 11/10 — sopa, arepa, ají y notas sueltas', () => {
  const fiction = [
    {
      id: 8871,
      code: 8871,
      name: 'Sopa De Lentejas',
      price: 11000,
      hasAttributes: false,
      attributes: [],
      availableNow: true,
    },
    {
      id: 8872,
      code: 8872,
      name: 'Sopa De Lentejas Pequena',
      price: 8000,
      hasAttributes: false,
      attributes: [],
      availableNow: true,
    },
    {
      id: 8873,
      code: 8873,
      name: '1/2 Pollo Al Horno',
      price: 22000,
      hasAttributes: true,
      attributes: [{ attributeName: 'Arepas', options: ['Blancas', 'sin arepas'] }],
      availableNow: true,
    },
    {
      id: 8874,
      code: 8874,
      name: 'Arroz De La Casa',
      price: 18000,
      hasAttributes: false,
      attributes: [],
      availableNow: true,
    },
  ];

  it('sopita de ajiaco GR es la grande y la portería no es un plato', async () => {
    const h = harness(products, false);
    await h.sendQueued('Sopita de ajiaco veci GR para la portería de la Alameda');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 38, qty: 1 })]);
    expect(h.cartRows().some((row) => row.id === 40)).toBe(false);
    expect(h.conv.sessionData.address || '').toMatch(/porter/i);
  });

  it('ajiaco pequeño es la sopa chica con sabor ajiaco', async () => {
    const h = harness(products, false);
    await h.sendQueued('Un ajiaco pequeño por favor');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({ id: 40, qty: 1, attrs: expect.arrayContaining(['Sopa:Ajiaco']) }),
    ]);
  });

  it('medio pollo frito con ají y sin arepa no compra la arepa', async () => {
    const h = harness(products, false);
    await h.sendQueued('Para medio pollo frito con ají y sin arepa');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 2,
        qty: 1,
        attrs: expect.arrayContaining(['Arepas:sin arepas']),
        note: expect.stringMatching(/aj[ií]/i),
      }),
    ]);
  });

  it('bastante ai y luego Aji* quedan como ají del arroz, no como otro plato', async () => {
    const h = harness(products, false);
    await h.sendQueued('Dame porfa un arroz chino con medio pollo frito porfa');
    const before = h.cartRows().map((row) => row.id);
    expect(before.length).toBeGreaterThan(0);
    await h.sendQueued('Veci bastante ai porfa');
    await h.sendQueued('Aji*');
    expect(h.cartRows().map((row) => row.id)).toEqual(before);
    expect([h.cartRows()[0]?.note, h.conv.sessionData.customerNotes].join(' ')).toMatch(/aj[ií]/i);
  });

  it('platos y cubiertos no compran otro producto', async () => {
    const h = harness(products, false);
    await h.sendQueued('Me regalas por favor un arroz con pollo');
    await h.sendQueued('Me envías por favor platos y cubiertos');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 23, qty: 1 })]);
    expect([h.cartRows()[0]?.note, h.conv.sessionData.customerNotes, h.replies.at(-1)].join(' ')).toMatch(/cubiertos/i);
  });

  it('ya me lo tomaron y que llegue caliente no agregan platos', async () => {
    const h = harness(products, false);
    await h.sendQueued('Hola, quiero hacer un pedido de arroz con pollo');
    const before = structuredClone(h.cartRows());
    await h.sendQueued('Ya me lo tomaron');
    await h.sendQueued('Que llegue caliente por favor');
    expect(h.cartRows()).toEqual(before);
  });

  it('bandeja broaster cambia la papa por salada y no compra la papa suelta', async () => {
    const h = harness(products, false);
    await h.sendQueued(
      'una bandeja con pollo broaster pierna pernil, sin ensalada con papa salada en vez de francesa',
    );
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 16,
        qty: 1,
        attrs: expect.arrayContaining(['Presa:Pierna Pernil']),
      }),
    ]);
    const note = h.cartRows()[0]?.note || '';
    expect(note).toMatch(/sin ensalada/i);
    expect(note).toMatch(/papa salada/i);
    expect(h.cartRows().some((row) => row.id === 8)).toBe(false);
  });

  it('otro menú: sopita GR es la grande y la pequeña se pide aparte', async () => {
    const h = harness(fiction, false);
    await h.sendQueued('Sopita de lentejas veci GR');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 8871, qty: 1 })]);
    await h.sendQueued('una sopita de lentejas pequeña');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({ id: 8871, qty: 1 }),
      expect.objectContaining({ id: 8872, qty: 1 }),
    ]);
  });

  it('otro menú: sin arepa y bastante ai no compran otro plato', async () => {
    const h = harness(fiction, false);
    await h.sendQueued('medio pollo al horno con aji y sin arepa');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 8873,
        qty: 1,
        attrs: expect.arrayContaining(['Arepas:sin arepas']),
        note: expect.stringMatching(/aj[ií]/i),
      }),
    ]);
    await h.sendQueued('Un arroz de la casa');
    await h.sendQueued('bastante ai porfa');
    expect(h.cartRows().map((row) => row.id).sort((a, b) => a - b)).toEqual([8873, 8874]);
    const rice = h.cartRows().find((row) => row.id === 8874);
    expect([rice?.note, h.conv.sessionData.customerNotes].join(' ')).toMatch(/aj[ií]/i);
  });
});

describe('Chats 11/10 — domicilio, combo y guarnición tardía', () => {
  const fiction = [
    {
      id: 8881,
      code: 8881,
      name: 'Arroz De La Casa',
      price: 18000,
      hasAttributes: false,
      attributes: [],
      availableNow: true,
    },
    {
      id: 8882,
      code: 8882,
      name: 'Arroz De La Casa Con Pollo',
      price: 28000,
      hasAttributes: true,
      attributes: [{ attributeName: 'Pollo', options: ['Horno', 'Plancha'] }],
      availableNow: true,
    },
    {
      id: 8883,
      code: 8883,
      name: 'Combo De La Casa',
      price: 32000,
      hasAttributes: true,
      attributes: [
        { attributeName: 'Estilo', options: ['Horno', 'Plancha'] },
        { attributeName: 'Bebida', options: ['Agua', 'Manzana'] },
      ],
      availableNow: true,
    },
    {
      id: 8884,
      code: 8884,
      name: '1/2 Pollo Al Horno',
      price: 22000,
      hasAttributes: true,
      attributes: [{ attributeName: 'Arepas', options: ['Blancas', 'sin arepas'] }],
      availableNow: true,
    },
    {
      id: 8885,
      code: 8885,
      name: 'Papa Salada',
      price: 6000,
      hasAttributes: false,
      attributes: [],
      availableNow: true,
    },
  ];

  it('Domicio no es un plato y el arroz chino con pollo no compra el arroz suelto', async () => {
    const h = harness(products, false);
    await h.sendQueued('Me ayudas con un Domicio');
    expect(h.cartRows()).toEqual([]);
    expect((h.replies.at(-1) || '')).not.toMatch(/no tenemos/i);
    await h.sendQueued('1 arroz chino con pollo porfa');
    await h.sendQueued('Broster porfa');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 36,
        qty: 1,
        attrs: expect.arrayContaining(['Pollo:Broaster']),
      }),
    ]);
    expect(h.cartRows().some((row) => row.id === 26 || row.id === 1 || row.id === 4)).toBe(false);
  });

  it('me condes un combo de pollo frito queda con la gaseosa dicha', async () => {
    const h = harness(products, false);
    await h.sendQueued('Por favor me condes un combo de pollo');
    await h.sendQueued('Frito');
    await h.sendQueued('Manzana');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 99,
        qty: 1,
        attrs: expect.arrayContaining(['Bebida:Manzana']),
      }),
    ]);
    expect(h.cartRows().some((row) => row.id === 1)).toBe(false);
  });

  it('papa salada después del medio pollo es nota, no la porción suelta', async () => {
    const h = harness(products, false);
    await h.sendQueued('Buenas hágame un favor para medio pollo frito');
    await h.sendQueued('Con ají por favor');
    await h.sendQueued('Y papa salada');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 2,
        qty: 1,
        note: expect.stringMatching(/aj[ií]/i),
      }),
    ]);
    expect(h.cartRows()[0]?.note || '').toMatch(/papa salada/i);
    expect(h.cartRows().some((row) => row.id === 8)).toBe(false);
  });

  it('preguntar si hay menú o cuánto vale no arma el pedido', async () => {
    const h = harness(products, false);
    await h.sendQueued('Tienes menú del día?');
    await h.sendQueued('Que vale la bandeja con pollo?');
    expect(h.cartRows()).toEqual([]);
    expect((h.replies.at(-1) || '')).toMatch(/20\.?000|21\.?000|22\.?000|precio|\$/i);
  });

  it('DoS arroz con pollo queda en dos y repetirlo no lo duplica', async () => {
    const h = harness(products, false);
    await h.sendQueued('pedido porfa DoS Arroz con pollo');
    await h.sendQueued('2 arroces');
    await h.sendQueued('Con pollo');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 23, qty: 2 })]);
  });

  it('otro menú: domicilio mal escrito y el arroz con pollo no compra el arroz suelto', async () => {
    const h = harness(fiction, false);
    await h.sendQueued('Me ayudas con un Domicio');
    expect(h.cartRows()).toEqual([]);
    await h.sendQueued('1 arroz de la casa con pollo porfa');
    await h.sendQueued('Plancha');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 8882,
        qty: 1,
        attrs: expect.arrayContaining(['Pollo:Plancha']),
      }),
    ]);
    expect(h.cartRows().some((row) => row.id === 8881)).toBe(false);
  });

  it('otro menú: me condes el combo y la papa tardía no es otro plato', async () => {
    const h = harness(fiction, false);
    await h.sendQueued('Por favor me condes un combo de la casa');
    await h.sendQueued('Plancha');
    await h.sendQueued('Manzana');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 8883,
        qty: 1,
        attrs: expect.arrayContaining(['Estilo:Plancha', 'Bebida:Manzana']),
      }),
    ]);
    const before = h.cartRows().map((row) => row.id);
    await h.sendQueued('Porfa me puedes enviar bastante ají por favor');
    await h.sendQueued('Y papa salada');
    expect(h.cartRows().map((row) => row.id)).toEqual(before);
    expect([h.cartRows()[0]?.note, h.conv.sessionData.customerNotes].join(' ')).toMatch(/aj[ií]/i);
    expect([h.cartRows()[0]?.note, h.conv.sessionData.customerNotes].join(' ')).toMatch(/papa salada/i);
  });
});

describe('Menú de otro país — el plato sale de la carta cargada', () => {
  const mexico = [
    {
      id: 9101,
      code: 9101,
      name: 'Tacos Al Pastor',
      price: 18000,
      hasAttributes: true,
      attributes: [{ attributeName: 'Salsa', options: ['Roja', 'Verde'] }],
      availableNow: true,
    },
    {
      id: 9102,
      code: 9102,
      name: 'Burrito De Carne',
      price: 22000,
      hasAttributes: false,
      attributes: [],
      availableNow: true,
    },
    {
      id: 9103,
      code: 9103,
      name: 'Agua De Horchata',
      price: 5000,
      hasAttributes: false,
      attributes: [],
      availableNow: true,
    },
  ];
  const japan = [
    {
      id: 9201,
      code: 9201,
      name: 'Ramen De Cerdo',
      price: 24000,
      hasAttributes: true,
      attributes: [{ attributeName: 'Caldo', options: ['Miso', 'Shoyu'] }],
      availableNow: true,
    },
    {
      id: 9202,
      code: 9202,
      name: 'Gyoza',
      price: 12000,
      hasAttributes: false,
      attributes: [],
      availableNow: true,
    },
  ];
  const italy = [
    {
      id: 9301,
      code: 9301,
      name: 'Pizza Margarita',
      price: 26000,
      hasAttributes: true,
      attributes: [{ attributeName: 'Masa', options: ['Delgada', 'Gruesa'] }],
      availableNow: true,
    },
    {
      id: 9302,
      code: 9302,
      name: 'Pasta Carbonara',
      price: 23000,
      hasAttributes: false,
      attributes: [],
      availableNow: true,
    },
  ];
  const peru = [
    {
      id: 9401,
      code: 9401,
      name: 'Ceviche De Pescado',
      price: 28000,
      hasAttributes: false,
      attributes: [],
      availableNow: true,
    },
    {
      id: 9402,
      code: 9402,
      name: 'Lomo Saltado',
      price: 30000,
      hasAttributes: false,
      attributes: [],
      availableNow: true,
    },
  ];

  it('dos tacos al pastor con salsa verde no compran el burrito', async () => {
    const h = harness(mexico, false);
    await h.sendQueued('quiero dos tacos al pastor con salsa verde');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 9101,
        qty: 2,
        attrs: expect.arrayContaining(['Salsa:Verde']),
      }),
    ]);
    expect((h.replies.at(-1) || '')).not.toMatch(/no tenemos/i);
  });

  it('qué hay de comer lista la carta de ese local, no la de pollo', async () => {
    const h = harness(mexico, false);
    const reply = await h.sendQueued('qué hay de comer');
    expect(h.cartRows()).toEqual([]);
    expect(reply).toMatch(/tacos al pastor/i);
    expect(reply).toMatch(/burrito/i);
    expect(reply).not.toMatch(/ajiaco|bandeja|broaster/i);
  });

  it('ramen de cerdo y luego el caldo no compran la gyoza', async () => {
    const h = harness(japan, false);
    await h.sendQueued('un ramen de cerdo porfa');
    await h.sendQueued('miso');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 9201,
        qty: 1,
        attrs: expect.arrayContaining(['Caldo:Miso']),
      }),
    ]);
    expect(h.cartRows().some((row) => row.id === 9202)).toBe(false);
  });

  it('pizza margarita con masa delgada no compra la pasta', async () => {
    const h = harness(italy, false);
    await h.sendQueued('una pizza margarita masa delgada');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 9301,
        qty: 1,
        attrs: expect.arrayContaining(['Masa:Delgada']),
      }),
    ]);
    expect(h.cartRows().some((row) => row.id === 9302)).toBe(false);
  });

  it('ceviche y lomo saltado son dos platos de esa carta', async () => {
    const h = harness(peru, false);
    await h.sendQueued('un ceviche y un lomo saltado');
    expect(h.cartRows().map((row) => row.id).sort((a, b) => a - b)).toEqual([9401, 9402]);
    expect(h.cartRows().every((row) => row.qty === 1)).toBe(true);
  });

  it('en PPP un ajiaco sigue siendo la sopa grande', async () => {
    const h = harness(products, false);
    await h.sendQueued('quiero un ajiaco');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 38, qty: 1 })]);
  });

  it('decir solo horchata compra el agua de esa carta', async () => {
    const h = harness(mexico, false);
    await h.sendQueued('quiero una horchata');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 9103, qty: 1 })]);
    expect(h.cartRows().some((row) => row.id === 9101 || row.id === 9102)).toBe(false);
  });

  it('qué tacos tienen lista los tacos y no arma el pedido', async () => {
    const h = harness(mexico, false);
    const reply = await h.sendQueued('qué tacos tienen');
    expect(h.cartRows()).toEqual([]);
    expect(reply).toMatch(/tacos al pastor/i);
    expect(reply).not.toMatch(/no tenemos/i);
  });

  it('tienen ramen lista el ramen de esa carta', async () => {
    const h = harness(japan, false);
    const reply = await h.sendQueued('tienen ramen?');
    expect(h.cartRows()).toEqual([]);
    expect(reply).toMatch(/ramen de cerdo/i);
    expect(reply).not.toMatch(/ajiaco|bandeja|no tenemos/i);
  });

  it('dos gyozas son cantidad dos', async () => {
    const h = harness(japan, false);
    await h.sendQueued('dos gyozas');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 9202, qty: 2 })]);
  });

  it('en PPP qué sopas tienen sigue siendo sopa, no tacos', async () => {
    const h = harness(products, false);
    const reply = await h.sendQueued('qué sopas tienen');
    expect(h.cartRows()).toEqual([]);
    expect(reply).toMatch(/ajiaco|sopa/i);
    expect(reply).not.toMatch(/taco/i);
  });
});

describe('Chats 11/10 — combo seguido de estilo, bebida y arepa', () => {
  const casa = [
    {
      id: 9501,
      code: 9501,
      name: 'Combo De La Casa',
      price: 32000,
      hasAttributes: true,
      attributes: [
        { attributeName: 'Bebida', options: ['Agua', 'Cola'] },
        { attributeName: 'Acompanante', options: ['Arroz', 'Papas'] },
      ],
      availableNow: true,
    },
    {
      id: 9502,
      code: 9502,
      name: 'Carne Al Horno',
      price: 28000,
      hasAttributes: false,
      attributes: [],
      availableNow: true,
    },
  ];

  it('combo, broster, coca cola y arepas fritas arman el combo, no el pollo suelto', async () => {
    const h = harness(products, false);
    await h.sendQueued('Me regalas un combo');
    await h.sendQueued('De broster');
    await h.sendQueued('Coca. Cola');
    await h.sendQueued('Y arepas fritas');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 99,
        qty: 1,
        attrs: expect.arrayContaining(['Bebida:Coca Cola', 'Arepas:Fritas']),
      }),
    ]);
  });

  it('dos ejecutivos se reparten presa, sopa y el cambio de papa', async () => {
    const h = harness(products, false);
    await h.sendQueued('Dos menu ejecutivo por favor');
    await h.sendQueued('Uno con presa pierna pernil y en vez de papa a la francesa papa salada y de sopa ajiaco por fa');
    await h.sendQueued('Y el otro con presa pechuga ese si con papa a la francesa y de sopa mondongo');
    await h.sendQueued('Pollo frito');
    expect(h.cartRows()).toHaveLength(2);
    expect(h.cartRows().every((row) => row.id === 22 && row.qty === 1)).toBe(true);
    const joined = h.cartRows().map((row) => `${row.attrs.join('|')} ${row.note || ''}`).join(' || ');
    expect(joined).toMatch(/Pierna Pernil/);
    expect(joined).toMatch(/pechuga/i);
    expect(joined).toMatch(/Ajiaco/);
    expect(joined).toMatch(/Mondongo/);
    expect(joined).toMatch(/papa salada/i);
    expect(h.cartRows().some((row) => row.id === 8)).toBe(false);
  });

  it('en otra carta dos almuerzos se reparten sopa y el cambio de guarnición', async () => {
    const lunch = {
      id: 9601,
      code: 9601,
      name: 'Almuerzo De La Casa',
      description: 'Incluye arroz y ensalada',
      price: 18000,
      hasAttributes: true,
      attributes: [
        { attributeName: 'Proteina', options: ['Pollo', 'Carne'] },
        { attributeName: 'Sopa', options: ['Verduras', 'Lentejas'] },
      ],
      availableNow: true,
    };
    const side = {
      id: 9602,
      code: 9602,
      name: 'Papa Salada',
      price: 4000,
      hasAttributes: false,
      attributes: [],
      availableNow: true,
    };
    const h = harness([lunch, side], false);
    await h.sendQueued('Dos almuerzos de la casa por favor');
    await h.sendQueued('Uno con proteina pollo y en vez de ensalada papa salada y de sopa verduras');
    await h.sendQueued('Y el otro con proteina carne ese si con ensalada y de sopa lentejas');
    expect(h.cartRows()).toHaveLength(2);
    expect(h.cartRows().every((row) => row.id === 9601 && row.qty === 1)).toBe(true);
    const joined = h.cartRows().map((row) => `${row.attrs.join('|')} ${row.note || ''}`).join(' || ');
    expect(joined).toMatch(/Pollo/);
    expect(joined).toMatch(/Carne/);
    expect(joined).toMatch(/Verduras/);
    expect(joined).toMatch(/Lentejas/);
    expect(joined).toMatch(/papa salada/i);
    expect(h.cartRows().some((row) => row.id === 9602)).toBe(false);
  });

  it('en otra carta el combo recibe bebida y acompañante, no la carne suelta', async () => {
    const h = harness(casa, false);
    await h.sendQueued('Me regalas un combo');
    await h.sendQueued('De horno');
    await h.sendQueued('Cola');
    await h.sendQueued('Y papas');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 9501,
        qty: 1,
        attrs: expect.arrayContaining(['Bebida:Cola', 'Acompanante:Papas']),
      }),
    ]);
    expect(h.cartRows().some((row) => row.id === 9502)).toBe(false);
  });
});

describe('Producto que no está — malteada y un no que no se queda pegado', () => {
  it('una malteada no se llama y dame, y un no suelta ese aviso', async () => {
    const h = harness(products, false);
    h.conv.sessionData.cart = [{
      productId: 98,
      code: 98,
      name: 'Combo De Pollo Broaster',
      unitPrice: 50000,
      quantity: 1,
      attributes: [{ attributeName: 'Bebida', attributeValue: 'Coca Cola' }],
    }];
    const asked = await h.sendQueued('y dame por favor una malteada');
    expect(asked).toMatch(/malteada/i);
    expect(asked).not.toMatch(/no manejamos:\s*_?y dame/i);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 98, qty: 1 })]);
    const refused = await h.sendQueued('no');
    expect(refused).not.toMatch(/y dame|malteada/i);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 98, qty: 1 })]);
  });

  it('en otra carta un helado que no existe tampoco se llama y dame', async () => {
    const menu = [
      { id: 9811, code: 9811, name: 'Combo De Carne', price: 34000, availableNow: true, hasAttributes: false, attributes: [], description: 'Incluye arroz y bebida' },
    ];
    const h = harness(menu, false);
    h.conv.sessionData.cart = [{
      productId: 9811,
      code: 9811,
      name: 'Combo De Carne',
      unitPrice: 34000,
      quantity: 1,
      attributes: [],
    }];
    const asked = await h.sendQueued('y dame por favor un helado');
    expect(asked).toMatch(/helado/i);
    expect(asked).not.toMatch(/no manejamos:\s*_?y dame/i);
    const refused = await h.sendQueued('no');
    expect(refused).not.toMatch(/y dame|helado/i);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 9811, qty: 1 })]);
  });

  it('un no suelta el aviso aunque ya hubiera quedado pegado', async () => {
    const h = harness(products, false);
    h.conv.sessionData.cart = [{
      productId: 98,
      code: 98,
      name: 'Combo De Pollo Broaster',
      unitPrice: 50000,
      quantity: 1,
      attributes: [{ attributeName: 'Bebida', attributeValue: 'Coca Cola' }],
    }];
    h.conv.sessionData.pendingMultiOrder = {
      confident: [],
      ambiguous: [],
      needsAttributes: [],
      unresolved: ['y dame'],
    };
    const refused = await h.sendQueued('no');
    expect(refused).not.toMatch(/y dame|Entendí varios platos/i);
    expect(h.conv.sessionData.pendingMultiOrder).toBeUndefined();
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 98, qty: 1 })]);
  });

  it('en otra carta un no también suelta el aviso pegado', async () => {
    const menu = [
      { id: 9811, code: 9811, name: 'Combo De Carne', price: 34000, availableNow: true, hasAttributes: false, attributes: [], description: 'Incluye arroz y bebida' },
    ];
    const h = harness(menu, false);
    h.conv.sessionData.cart = [{
      productId: 9811,
      code: 9811,
      name: 'Combo De Carne',
      unitPrice: 34000,
      quantity: 1,
      attributes: [],
    }];
    h.conv.sessionData.pendingMultiOrder = {
      confident: [],
      ambiguous: [],
      needsAttributes: [],
      unresolved: ['y dame'],
    };
    const refused = await h.sendQueued('no');
    expect(refused).not.toMatch(/y dame|Entendí varios platos/i);
    expect(h.conv.sessionData.pendingMultiOrder).toBeUndefined();
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 9811, qty: 1 })]);
  });
});

describe('Perdón, era mango en agua', () => {
  it('perdon de mango en agua pide el jugo y guarda el azúcar', async () => {
    const h = harness(products, true);
    h.conv.sessionData.cart = [{
      productId: 51,
      code: 51,
      name: 'Jugo Natural En Leche',
      unitPrice: 6500,
      quantity: 1,
      attributes: [{ attributeName: 'Sabor', attributeValue: 'Guanabana' }],
    }];
    const reply = await h.sendQueued('perdon de mango en agua bajito de azucar');
    expect(reply).not.toMatch(/no tenemos \*perdon/i);
    expect(h.agent.runTurn).not.toHaveBeenCalled();
    expect(h.cartRows()).toEqual([
      expect.objectContaining({ id: 51, attrs: ['Sabor:Guanabana'] }),
      expect.objectContaining({
        id: 50,
        qty: 1,
        attrs: ['Sabor:Mango'],
        note: expect.stringMatching(/azucar/i),
      }),
    ]);
  });

  it('un jugo que no está ofrece los jugos, no solo las gaseosas', async () => {
    const h = harness(products, false);
    const reply = await h.sendQueued('dame un jugo de maracuya en agua');
    expect(reply).toMatch(/Jugo Natural En Agua/);
    expect(reply).toMatch(/Jugo Natural En Leche/);
    expect(h.cartRows()).toEqual([]);
  });

  it('en otra carta perdón de mango en agua también es el jugo de agua', async () => {
    const menu = [
      { id: 9401, code: 9401, name: 'Jugo De La Casa En Agua', price: 4000, availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Sabor', options: ['Mango', 'Pina'] }], description: '' },
      { id: 9402, code: 9402, name: 'Jugo De La Casa En Leche', price: 5000, availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Sabor', options: ['Mango', 'Pina'] }], description: '' },
    ];
    const h = harness(menu, true);
    const reply = await h.sendQueued('perdon de mango en agua bajito de azucar');
    expect(reply).not.toMatch(/perdon de mango/i);
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 9401,
        qty: 1,
        attrs: ['Sabor:Mango'],
        note: expect.stringMatching(/azucar/i),
      }),
    ]);
  });
});

describe('Cambio de acompañamiento que el plato no trae', () => {
  const seed = (h: ReturnType<typeof harness>) => {
    h.conv.sessionData.cart = [
      {
        productId: 17,
        code: 17,
        name: 'Churrasco',
        unitPrice: 38000,
        quantity: 1,
        note: 'con papa salada y ensalada',
        attributes: [],
      },
      {
        productId: 45,
        code: 45,
        name: 'Sopa De Mondongo',
        unitPrice: 12500,
        quantity: 1,
        attributes: [],
      },
    ];
  };

  it('cambiar el arroz de la sopa por yuca pregunta una sola vez y no la anota en la sopa', async () => {
    const h = harness(products, true);
    seed(h);
    const asked = await h.sendQueued('quiero cambiar el arroz que viene con la sopa por yuca');
    expect(asked).toMatch(/Acompañada con arroz/);
    expect(asked).toMatch(/no hace parte/i);
    expect(asked).toMatch(/Porcion De Yuca Frita/);
    expect((asked || '').match(/¿/g) || []).toHaveLength(1);
    expect(asked).not.toMatch(/pero sí con yuca|solo yuca y nada/i);
    expect(h.agent.runTurn).not.toHaveBeenCalled();
    expect(h.cartRows()).toEqual([
      expect.objectContaining({ id: 17, note: 'con papa salada y ensalada' }),
      expect.objectContaining({ id: 45, note: undefined }),
    ]);
    const done = await h.sendQueued('sí');
    expect((done || '').match(/¿/g) || []).toHaveLength(0);
    expect(h.cartRows()).toEqual([
      expect.objectContaining({ id: 17, note: 'con papa salada y ensalada' }),
      expect.objectContaining({ id: 45, qty: 1, note: 'Sin arroz' }),
      expect.objectContaining({ id: 7, qty: 1 }),
    ]);
  });

  it('sin arroz yuca y nada de arroz solo yuca tampoco dicen que la sopa trae yuca', async () => {
    const h = harness(products, true);
    seed(h);
    const bare = await h.sendQueued('por favor me das la sopa sin arroz yuca');
    expect(bare).toMatch(/no hace parte/i);
    expect(bare).not.toMatch(/ni yuca/i);
    expect((bare || '').match(/¿/g) || []).toHaveLength(1);
    const again = await h.sendQueued('nada dearroz solo yuca');
    expect(again).toMatch(/no hace parte/i);
    expect((again || '').match(/¿/g) || []).toHaveLength(1);
    expect(h.cartRows().some((row) => row.id === 7)).toBe(false);
    expect(h.cartRows().find((row) => row.id === 45)?.note || '').not.toMatch(/yuca/i);
  });

  it('en otra carta la yuca tampoco se anota dentro de la sopa', async () => {
    const menu = [
      { id: 9701, code: 9701, name: 'Caldo De La Casa', price: 9000, availableNow: true, hasAttributes: false, attributes: [], description: 'Acompañado con arroz' },
      { id: 9702, code: 9702, name: 'Porcion De Yuca', price: 4000, availableNow: true, hasAttributes: false, attributes: [], description: '' },
    ];
    const h = harness(menu, true);
    h.conv.sessionData.cart = [{
      productId: 9701,
      code: 9701,
      name: 'Caldo De La Casa',
      unitPrice: 9000,
      quantity: 1,
      attributes: [],
    }];
    const asked = await h.sendQueued('quiero cambiar el arroz que viene con la sopa por yuca');
    expect(asked).toMatch(/Acompañado con arroz/);
    expect(asked).toMatch(/no hace parte/i);
    expect(asked).toMatch(/Porcion De Yuca/);
    expect((asked || '').match(/¿/g) || []).toHaveLength(1);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 9701, note: undefined })]);
    await h.sendQueued('sí');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({ id: 9701, note: 'Sin arroz' }),
      expect.objectContaining({ id: 9702, qty: 1 }),
    ]);
  });
});

describe('Qué incluye el combo — la descripción de la carta, no solo un atributo', () => {
  it('el combo de broaster dice papa y yuca, y no cambia el pollo del carrito', async () => {
    const h = harness(products, true);
    h.conv.sessionData.cart = [{
      productId: 4,
      code: 4,
      name: '1 Pollo Broaster',
      unitPrice: 43000,
      quantity: 1,
      attributes: [{ attributeName: 'Arepas', attributeValue: 'Blancas' }],
    }];
    const reply = await h.sendQueued('El combo solo lleva la gaseosa adicional o algo más');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 4, qty: 1 })]);
    expect(reply).toMatch(/yuca/i);
    expect(reply).toMatch(/papa/i);
    expect(reply).toMatch(/arepa/i);
    expect(reply).not.toMatch(/¿Cuál prefieres\?/);
  });

  it('en otra carta el combo dice todo lo que trae, no solo la bebida', async () => {
    const menu = [
      { id: 9801, code: 9801, name: 'Carne Al Horno', price: 28000, availableNow: true, hasAttributes: false, attributes: [], description: 'Con arroz' },
      { id: 9802, code: 9802, name: 'Combo De Carne', price: 34000, availableNow: true, hasAttributes: true, description: 'Incluye arroz, ensalada y bebida', attributes: [{ attributeName: 'Bebida', options: ['Agua', 'Cola'] }] },
    ];
    const h = harness(menu, true);
    h.conv.sessionData.cart = [{
      productId: 9801,
      code: 9801,
      name: 'Carne Al Horno',
      unitPrice: 28000,
      quantity: 1,
      attributes: [],
    }];
    const reply = await h.sendQueued('El combo solo lleva la bebida o algo más');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 9801, qty: 1 })]);
    expect(reply).toMatch(/arroz/i);
    expect(reply).toMatch(/ensalada/i);
    expect(reply).toMatch(/bebida/i);
  });
});

describe('Reservados aún no corridos — comparación, bebida y cita', () => {
  it('dos sopas siguen en dos cuando recomienda pescado y pide limonadas', async () => {
    const h = harness(products, false);
    await h.sendQueued('Dos sopas');
    await h.sendQueued('Me recomiendas mojarra o trucha? Y agrega dos limonadas naturales');
    await h.sendQueued('Menudencias');
    expect(h.cartRows().find((row) => row.id === 20)).toEqual(expect.objectContaining({ qty: 2 }));
    expect(h.cartRows().some((row) => row.id === 12 || row.id === 14)).toBe(false);
    const drink = h.cartRows().find((row) => row.id === 37);
    const reply = h.replies.join('\n');
    expect(drink?.qty === 2 || /limonada/i.test(reply)).toBe(true);
    if (!drink) expect(reply).toMatch(/limonada/i);
  });

  it('en otra carta la recomendación no compra los platos y sí las dos bebidas', async () => {
    const menu = [
      { id: 9701, code: 9701, name: 'Bowl Mediterraneo', price: 17000, availableNow: true, attributes: [] },
      { id: 9702, code: 9702, name: 'Wrap Oriental', price: 14000, availableNow: true, attributes: [] },
      { id: 9703, code: 9703, name: 'Te Helado', price: 5000, availableNow: true, attributes: [] },
    ];
    const h = harness(menu, false);
    const reply = await h.sendQueued('Estoy entre Bowl Mediterraneo y Wrap Oriental, qué me recomiendas\nAgrega dos Te Helado');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 9703, qty: 2 })]);
    expect(reply).toMatch(/Bowl Mediterraneo/i);
    expect(reply).toMatch(/Wrap Oriental/i);
  });

  it('diez cajas referidas conservan nota, hora y dirección', async () => {
    const bowl = { id: 9711, code: 9711, name: 'Bowl Mediterraneo', price: 17000, availableNow: true, attributes: [] };
    const h = harness([bowl], false);
    await h.sendQueued('Cuánto cuesta Bowl Mediterraneo?');
    expect(h.cartRows()).toEqual([]);
    const reply = await h.sendQueued('Quiero esas diez cajas para el 15/10 a las 14:00, sin cebolla, para la carrera 7 20 30');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({ id: 9711, qty: 10, note: expect.stringMatching(/sin cebolla/i) }),
    ]);
    expect(h.conv.sessionData.address).toMatch(/7/);
    expect(h.conv.sessionData.customerNotes || '').toMatch(/15\/10/);
    expect(h.conv.sessionData.customerNotes || '').toMatch(/14:00/);
    expect(reply).toMatch(/no está reservada/i);
  });

  it('en otra carta diez porciones referidas conservan nota, hora y dirección', async () => {
    const ramen = { id: 9721, code: 9721, name: 'Ramen De Cerdo', price: 24000, availableNow: true, attributes: [] };
    const h = harness([ramen], false);
    await h.sendQueued('Cuánto cuesta el ramen de cerdo?');
    expect(h.cartRows()).toEqual([]);
    const reply = await h.sendQueued('Quiero esas diez cajas para el 15/10 a las 14:00, sin cebolla, para la carrera 7 20 30');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({ id: 9721, qty: 10, note: expect.stringMatching(/sin cebolla/i) }),
    ]);
    expect(h.conv.sessionData.address).toMatch(/7/);
    expect(`${h.conv.sessionData.customerNotes || ''} ${reply}`).toMatch(/15\/10/);
    expect(`${h.conv.sessionData.customerNotes || ''} ${reply}`).toMatch(/14:00/);
    expect(reply).not.toMatch(/queda reservad/i);
  });
});

describe('Acompañamiento adicional — conservación y validación',()=>{
  const menu=[{id:15001,code:15001,name:'Caldo De La Casa',price:9000,availableNow:true,attributes:[],description:'Acompañado con arroz'},
    {id:15002,code:15002,name:'Porcion De Yuca',price:4000,availableNow:true,attributes:[]}];
  const seed=()=>{const h=harness(structuredClone(menu),false);h.conv.sessionData.cart=[{productId:15001,code:15001,name:'Caldo De La Casa',unitPrice:9000,quantity:2,note:'sin sal',attributes:[]}];return h;};
  it('confirmar extra conserva nota previa y cantidades',async()=>{
    const h=seed();await h.sendQueued('quiero cambiar el arroz que viene con la sopa por yuca');await h.sendQueued('sí');
    expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:15001,qty:2,note:expect.stringMatching(/sin sal/i)}),expect.objectContaining({id:15002,qty:1})]));
    expect(h.cartRows()[0].note).toMatch(/sin arroz/i);
  });
  it('carrito cambiado invalida confirmación antigua',async()=>{
    const h=seed();await h.sendQueued('quiero cambiar el arroz que viene con la sopa por yuca');h.conv.sessionData.cart[0].quantity=3;
    const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued('sí');expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.replies.at(-1)).toMatch(/cambi[oó]|otra vez|confirmar/i);
  });
  it('extra deja de estar disponible: no cambia ni cobra',async()=>{
    const local=structuredClone(menu);const h=harness(local,false);h.conv.sessionData.cart=[{productId:15001,code:15001,name:'Caldo De La Casa',unitPrice:9000,quantity:1,note:'sin sal',attributes:[]}];
    await h.sendQueued('quiero cambiar el arroz que viene con la sopa por yuca');local[1].availableNow=false;const before=structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('sí');expect(h.conv.sessionData.cart).toEqual(before);expect(h.replies.at(-1)).toMatch(/disponible/i);
  });
  it('extra ya existente se incrementa una unidad confirmada',async()=>{
    const h=seed();h.conv.sessionData.cart.push({productId:15002,code:15002,name:'Porcion De Yuca',unitPrice:4000,quantity:1,attributes:[]});
    await h.sendQueued('quiero cambiar el arroz que viene con la sopa por yuca');await h.sendQueued('sí');
    expect(h.cartRows().find(row=>row.id===15002)?.qty).toBe(2);
  });
});

describe('Audio de alitas — plato principal bebida y dirección',()=>{
  for(const type of ['text','audio']){
    it.each(['Pepsi','Coca Cola'])(`combo de alitas con %s conserva principal (${type})`,async drink=>{
      const h=harness(products,false);Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164});
      const text=`Me hace el favor me envía un combo de alitas con gaseosa ${drink} para el conjunto residencial Pío 12`;
      h.service.resolveAudioToText=jest.fn().mockResolvedValue(text);
      await h.sendQueued(type==='audio'?'':text,type==='audio'?{messageType:'audio',mediaId:'synthetic-wings'}:{});
      expect(h.cartRows()).toEqual([expect.objectContaining({id:75,qty:1,attrs:expect.arrayContaining(['Bebida:'+drink])})]);
      expect(h.conv.sessionData.address).toMatch(/Pío 12/i);expect(h.replies.at(-1)).not.toMatch(/no manejamos|no entend[ií]/i);
    });
    it(`bebida 1.5L no hace desaparecer las alitas (${type})`,async()=>{
      const h=harness(products,false);const text='Quiero un combo de alitas con una gaseosa Pepsi 1.5L para el conjunto residencial Pío 12';
      h.service.resolveAudioToText=jest.fn().mockResolvedValue(text);
      await h.sendQueued(type==='audio'?'':text,type==='audio'?{messageType:'audio',mediaId:'synthetic-wings-large-drink'}:{});
      const pending=h.conv.sessionData.pendingMultiOrder;
      const ids=[...h.cartRows().map(row=>row.id),...(pending?.confident||[]).map(item=>item.productId),...(pending?.needsAttributes||[]).map(item=>item.productId),...(h.conv.sessionData.pendingAttribute?[h.conv.sessionData.pendingAttribute.productId]:[]),...(h.conv.sessionData.pendingMatch?.candidates||[]).map(item=>item.id)];
      expect(ids).toContain(75);expect(h.conv.sessionData.address).toMatch(/Pío 12/i);
      if(!h.cartRows().some(row=>row.id===75)) expect(h.conv.state).not.toBe('awaiting_payment');
    });
  }
});

describe('Cobertura — avisos aislados entre conversaciones',()=>{
  it('dos clientes reciben solo su aviso y se consume una vez',()=>{
    const h=harness([],false);h.service.orderCoverageNoticesByWaId.set('A','Fuera de cobertura A');h.service.orderCoverageNoticesByWaId.set('B','Fuera de cobertura B');
    const a=h.service.absorbCoverageNotice('Listo A','A');const b=h.service.absorbCoverageNotice('Listo B','B');
    expect(a).toContain('Fuera de cobertura A');expect(a).not.toContain('cobertura B');expect(b).toContain('Fuera de cobertura B');expect(b).not.toContain('cobertura A');
    expect(h.service.absorbCoverageNotice('Otra respuesta A','A')).toBe('Otra respuesta A');
  });
  it('respuesta de otro cliente no roba el aviso pendiente',()=>{
    const h=harness([],false);h.service.orderCoverageNoticesByWaId.set('A','Fuera de cobertura A');
    expect(h.service.absorbCoverageNotice('Hola B','B')).toBe('Hola B');expect(h.service.absorbCoverageNotice('Pedido A','A')).toContain('Fuera de cobertura A');
  });
});

describe('Pedido grande — cinco platos atributos y cambios',()=>{
  const menu=[
    {id:16001,code:16001,name:'Bowl Andino',price:18000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Base',options:['Arroz','Quinoa']}]},
    {id:16002,code:16002,name:'Wrap Oriental',price:16000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Salsa',options:['Suave','Picante']}]},
    {id:16003,code:16003,name:'Pizza Vegetariana',price:24000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Masa',options:['Delgada','Gruesa']}]},
    {id:16004,code:16004,name:'Hamburguesa Artesanal',price:21000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Queso',options:['Cheddar','Mozzarella']}]},
    {id:16005,code:16005,name:'Te Helado',price:4000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Limon','Durazno']}]},
  ];
  for(const type of ['text','audio']){
    it.each(['; ','\n',' y '])(`quince unidades conservan alcance y datos (${type}) %j`,async sep=>{
      const h=harness(menu,false);Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164});
      const text=['Buenas tardes por favor quiero dos bowls andinos con quinoa y harto ají','tres wraps orientales con salsa suave','una pizza vegetariana con masa delgada sin aceitunas','cuatro hamburguesas artesanales con queso cheddar sin cebolla','cinco te helado sabor limon'].join(sep)+'. Para la carrera 112 #200-30 apartamento 808, pago por transferencia. Muchas gracias';
      h.service.resolveAudioToText=jest.fn().mockResolvedValue(text);
      await h.sendQueued(type==='audio'?'':text,type==='audio'?{messageType:'audio',mediaId:'mock-bulk'}:{});
      expect(h.cartRows()).toHaveLength(5);
      expect(h.cartRows()).toEqual(expect.arrayContaining([
        expect.objectContaining({id:16001,qty:2,attrs:['Base:Quinoa'],note:expect.stringMatching(/harto ají/i)}),
        expect.objectContaining({id:16002,qty:3,attrs:['Salsa:Suave']}),
        expect.objectContaining({id:16003,qty:1,attrs:['Masa:Delgada'],note:expect.stringMatching(/sin aceitunas/i)}),
        expect.objectContaining({id:16004,qty:4,attrs:['Queso:Cheddar'],note:expect.stringMatching(/sin cebolla/i)}),
        expect.objectContaining({id:16005,qty:5,attrs:['Sabor:Limon']}),
      ]));
      expect(h.conv.sessionData.address).toMatch(/112.*200-30.*808/);expect(h.conv.sessionData.paymentMethod).toBe('transfer');
      expect(h.replies.at(-1)).not.toMatch(/no manejamos|no entend[ií]/i);
      await h.sendQueued('Deja solo dos Wrap Oriental');await h.sendQueued('Pizza Vegetariana mejor con masa gruesa');
      expect(h.cartRows().find(row=>row.id===16002)?.qty).toBe(2);expect(h.cartRows().find(row=>row.id===16003)?.attrs).toEqual(['Masa:Gruesa']);
      expect(h.cartRows().find(row=>row.id===16001)?.qty).toBe(2);expect(h.cartRows().find(row=>row.id===16004)?.qty).toBe(4);expect(h.cartRows().find(row=>row.id===16005)?.qty).toBe(5);
    });
  }
});

describe('Voz — recorrido de descarga transcripción y pedido',()=>{
  it('usa vocabulario del catálogo y conserva combo alitas en una respuesta',async()=>{
    const h=harness(products,false);Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164});
    h.service.metaService.downloadMedia=jest.fn().mockResolvedValue({buffer:Buffer.from('mock-voice'),mimeType:'audio/ogg'});
    h.service.aiService.transcribeAudio=jest.fn().mockResolvedValue('Un combo de alitas con Pepsi para la calle 7 #20-30');
    h.service.conversationService.updateMessageBody=jest.fn().mockResolvedValue(undefined);
    await h.sendQueued('',{messageType:'audio',mediaId:'mock-download'});
    expect(h.service.aiService.transcribeAudio).toHaveBeenCalledWith(expect.any(Buffer),'audio/ogg',expect.arrayContaining(['Alitas Broaster']));
    expect(h.cartRows()).toEqual([expect.objectContaining({id:75,qty:1,attrs:['Bebida:Pepsi']})]);
    expect(h.conv.sessionData.address).toMatch(/7.*20-30/);expect(h.replies).toHaveLength(1);
  });
});

describe('Equivalencia por catálogo — sin porción inventada',()=>{
  const meal={id:16101,code:16101,name:'Arroz Chino Con Pollo Entero',price:30000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Pollo',options:['Frito','Broaster']}]};
  it('pedido sin tamaño usa la única presentación del catálogo y no añade medio',async()=>{
    const h=harness([meal],false);await h.sendQueued('Un arroz chino con pollo');await h.sendQueued('Broaster');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:16101,qty:1,attrs:['Pollo:Broaster']})]);
    expect(h.replies.at(-1)).not.toMatch(/medio pollo/i);
  });
  it('dos presentaciones no se convierten globalmente en medio pollo',async()=>{
    const h=harness([{...meal,name:'Arroz Chino Con Medio Pollo'},{...meal,id:16102,code:16102,name:'Arroz Chino Con Pollo Entero'}],false);
    await h.sendQueued('Un arroz chino con pollo');expect(h.cartRows()).toEqual([]);expect(h.replies.at(-1)).toMatch(/cu[aá]l|opci[oó]n|presentaci[oó]n|prefieres|escribe el n[uú]mero/i);
    expect(h.replies.at(-1)).toContain('Arroz Chino Con Medio Pollo');expect(h.replies.at(-1)).toContain('Arroz Chino Con Pollo Entero');
  });
});

describe('Ráfagas mixtas — pedido compuesto y duplicado tardío', () => {
  const lunch = {id:11001,code:11001,name:'Menu Vegetariano',description:'Incluye sopa y bebida',price:18000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sopa',options:['Calabaza','Lentejas']},{attributeName:'Bebida',options:['Agua','Te']}]};
  const fixtures = [
    {menu:products,id:22,turns:['Quiero pedir un almuerzo ejecutivo por favor','Mondongo pollo frito pierna pernil papa salada','Y de tomar me puedes enviar limonada?'],attrs:['Sopa:Mondongo','Presa:Pierna Pernil','Bebida:Limonada'],note:/papa salada/i},
    {menu:[lunch],id:11001,turns:['Quiero un menu vegetariano','Lentejas sin ensalada','Y la bebida te por favor'],attrs:['Sopa:Lentejas','Bebida:Te'],note:/sin ensalada/i},
  ];
  for (const fixture of fixtures) {
    it.each([0,900,4000,60000])('pausa de %d ms entre pedido y opciones: '+fixture.id,async gap=>{
      jest.useFakeTimers();
      try {
        const h=harness(fixture.menu,false);
        // Simulate the persistent UNIQUE claim contract, including late replays.
        const claimed = new Set<string>();
        const claim = h.service.conversationService.claimInboundMessage;
        h.service.conversationService.claimInboundMessage = async (params: {waMessageId?:string;body:string}) => {
          if (params.waMessageId && claimed.has(params.waMessageId)) return null;
          if (params.waMessageId) claimed.add(params.waMessageId);
          return claim(params);
        };
        const messages=fixture.turns.map((text,index)=>({waId:'customer',phoneE164:h.conv.phoneE164,messageId:'mixed-'+index,messageType:'text',text,timestamp:Date.now()/1000,raw:{}}));
        const first=h.service.handleIncoming(messages[0]);
        await jest.advanceTimersByTimeAsync(gap);
        const rest=[h.service.handleIncoming(messages[1]),h.service.handleIncoming(messages[2])];
        await jest.advanceTimersByTimeAsync(4000);
        await Promise.all([first,...rest]);
        expect(h.cartRows()).toEqual([expect.objectContaining({id:fixture.id,qty:1,attrs:expect.arrayContaining(fixture.attrs),note:expect.stringMatching(fixture.note)})]);
        expect(h.replies.at(-1)).not.toMatch(/no manejamos|no entend[ií]/i);
        const before=structuredClone(h.conv.sessionData.cart);
        const outbound=h.replies.length;
        const replay=h.service.handleIncoming(messages[1]);
        await jest.advanceTimersByTimeAsync(4000);await replay;
        expect(h.conv.sessionData.cart).toEqual(before);
        expect(h.replies).toHaveLength(outbound);
      } finally {jest.useRealTimers();}
    });
  }
});

describe('Menús completos — consultas, extras y reinicio básicos', () => {
  const lunch={id:11101,code:11101,name:'Menu Vegetariano',description:'Incluye sopa y bebida',price:18000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sopa',options:['Calabaza','Lentejas']},{attributeName:'Bebida',options:['Agua','Te']}]};
  const tea={id:11102,code:11102,name:'Te Helado',price:4000,availableNow:true,hasAttributes:false,attributes:[]};
  for (const f of [
    {menu:products,id:22,drink:37,name:'Ejecutivo Con Pollo Frito',turns:['Quiero dos almuerzos ejecutivos','Mondongo pollo frito pierna pernil papa salada','La bebida limonada'],extra:'Y una limonada natural adicional aparte'},
    {menu:[lunch,tea],id:11101,drink:11102,name:'Menu Vegetariano',turns:['Quiero dos menu vegetariano','Sopa de lentejas sin ensalada','La bebida te'],extra:'Y un te helado adicional aparte'},
  ]) {
    async function setup() {
      const h=harness(f.menu,false);
      for(const text of f.turns) await h.sendQueued(text);
      expect(h.cartRows()).toEqual([expect.objectContaining({id:f.id,qty:2})]);
      return h;
    }
    it('preguntar precio conserva las dos unidades y todas sus opciones: '+f.id, async()=>{
      const h=await setup(); const before=structuredClone(h.conv.sessionData.cart);
      const reply=await h.sendQueued('Cuánto cuesta '+f.name+'?');
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(reply).toMatch(/\$/);
      expect(reply).not.toMatch(/agregué|Listo ✅/i);
    });
    it('bebida adicional agrega solo una y conserva las incluidas: '+f.id, async()=>{
      const h=await setup(); const before=structuredClone(h.cartRows()[0]);
      await h.sendQueued(f.extra);
      expect(h.cartRows()).toHaveLength(2);
      expect(h.cartRows()).toEqual(expect.arrayContaining([before,expect.objectContaining({id:f.drink,qty:1})]));
    });
    it('cambiar cantidad del menú conserva extra independiente: '+f.id, async()=>{
      const h=await setup(); await h.sendQueued(f.extra);
      const before=structuredClone(h.cartRows().find(row=>row.id===f.drink));
      await h.sendQueued('Perdón, quiero tres '+f.name);
      expect(h.cartRows()).toHaveLength(2);
      expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:f.id,qty:3}),before]));
    });
    it('reinicio vacía menús, extras y elecciones pendientes: '+f.id, async()=>{
      const h=await setup(); await h.sendQueued(f.extra);
      await h.sendQueued('Reiniciar');
      expect(h.cartRows()).toEqual([]);
      expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
      expect(h.conv.sessionData.pendingMatch).toBeFalsy();
      expect(h.conv.sessionData.pendingMultiOrder).toBeFalsy();
      expect(h.replies.at(-1)).toMatch(/vaci|reinici|nuevo pedido/i);
    });
  }
});

describe('Ejecutivos plurales — cantidad y contexto de opciones',()=>{
  for(const [request,qty] of [
    ['Porfa dos almuerzos ejecutivos',2],
    ['Tres almuerzos ejecutivo por favor',3],
    ['Quiero 2 almuerzo ejecutivos',2],
    ['Me envias 3 ALMUERZOS EJECUTIVOS por favor',3],
  ] as const) for(const agent of [false,true]) {
    it(request+' agent='+agent,async()=>{
      const h=harness(products,agent);
      await h.sendQueued(request);
      expect(h.cartRows()).toEqual([]);
      await h.sendQueued('Mondongo pollo frito pierna pernil papa salada');
      await h.sendQueued('La bebida limonada');
      expect(h.cartRows()).toEqual([expect.objectContaining({id:22,qty,
        attrs:expect.arrayContaining(['Sopa:Mondongo','Presa:Pierna Pernil','Bebida:Limonada']),
        note:expect.stringMatching(/papa salada/i)})]);
      expect(h.replies.at(-1)).not.toMatch(/no manejamos|no entend[ií]/i);
    });
  }
});

describe('Cortesía y chat equivocado — familia ampliada',()=>{
  const alt=[{id:11201,code:11201,name:'Taco Al Pastor',price:12000,availableNow:true,hasAttributes:false,attributes:[]}];
  const apologies=[
    'Ay perdón me confundí pensé que hablaba con el supermercado',
    'Disculpa, me equivoqué de chat',
    'Perdón, número equivocado',
    'Me equivoqué de número',
    'Ese mensaje era para otra tienda, disculpa',
    'Perdón, no era para ustedes',
    'Sorry, wrong chat',
    'Perdon me confunci de chat',
  ];
  for(const menu of [products,alt]) {
    for(const apology of apologies) it('abandona selección pendiente: '+apology+' menu='+menu[0].id,async()=>{
      const h=harness(menu,false);
      await h.sendQueued('hola buenas noches\nme envias por favor una libra de arroz, dos aceites y un kilo de azucar');
      expect(h.conv.sessionData.pendingMultiOrder?.unresolved?.length).toBeGreaterThan(0);
      const reply=await h.sendQueued(apology);
      expect(h.cartRows()).toEqual([]);
      expect(h.conv.sessionData.pendingMultiOrder).toBeFalsy();
      expect(h.conv.sessionData.pendingMatch).toBeFalsy();
      expect(h.conv.sessionData.address).toBeFalsy();
      expect(reply).not.toMatch(/libra de arroz|aceites|az[uú]car|Entendí varios platos|escribe.*s[ií]/i);
    });
    for(const greeting of [
      'Hola, buenas noches! Me envías por favor',
      'Buenas tardes vecino, me hace el favor me manda',
      'ola buenas nochs, porfa me envias',
      'Buen día, por favor me regalas',
      'Buenas noches\nme puedes enviar por favor',
      'Hola 👋 por favor quisiera',
    ]) it('la cortesía no es producto: '+greeting+' menu='+menu[0].id,async()=>{
      const h=harness(menu,false);
      const reply=await h.sendQueued(greeting+' una libra de arroz, dos aceites y un kilo de azúcar');
      expect(h.cartRows()).toEqual([]);
      expect(reply).toMatch(/arroz|aceite|az[uú]car/i);
      const unknownLines=(reply||'').split('\n').filter(line=>/no manejamos|no tenemos|⚠️/i.test(line));
      expect(unknownLines.join(' ')).not.toMatch(/buenas|buen|d[ií]a|hola|vecino|me hace|favor|manda|envias|regalas|quisiera|noch/i);
    });
  }
  it.each([
    ['Hola, buenas noches! Me envías por favor un churrasco', products, 17],
    ['Buenas tardes vecino, me hace el favor me manda un churrasco', products, 17],
    ['ola buenas nochs, porfa me envias dos churrascos', products, 17],
    ['Buen día, por favor me regalas una sopa de mondongo', products, 45],
    ['Hola 👋 por favor quisiera un churrasco', products, 17],
    ['Buenas tardes vecino, me hace el favor me manda dos tacos al pastor', alt, 11201],
  ] as const)('la misma cortesía sí pide un plato de la carta: %s', async (text, menu, id) => {
    const h = harness(menu as typeof products, false);
    const reply = await h.sendQueued(text);
    const qty = /dos /i.test(text) ? 2 : 1;
    expect(h.cartRows()).toEqual([expect.objectContaining({ id, qty })]);
    expect(reply || '').not.toMatch(/buenas|hola|vecino|me hace|favor|manda|envias|regalas|quisiera|noch/i);
  });

  it.each([
    'Pensé que era pollo broaster, cámbialo por favor',
    'Creí que era una limonada grande, quiero la pequeña',
    'Perdón, me equivoqué: eran tres churrascos',
    'Disculpa, la dirección era calle 12 #30-40',
    'Perdón de mango en agua bajito de azúcar',
    'Es para el supermercado Éxito calle 80 #20-30',
    'Perdón, la tienda se llama Otro Chat, carrera 10 #20-30',
    'Pensaba que era más barato, cuánto vale?',
    'Perdón, número equivocado, el correcto es 300 000 0001',
    'Me equivoqué de número, mi teléfono correcto es 3000000001',
  ])('no abandona una corrección o consulta válida: %s',text=>{
    expect(isWrongChatApology(text)).toBe(false);
  });
});

describe('Interrupciones y cancelación — opción pendiente del menú',()=>{
  const lunch={id:11301,code:11301,name:'Menu Oriental',description:'Incluye sopa y bebida',price:18000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Pollo',options:['Horno','Plancha']},{attributeName:'Sopa',options:['Calabaza','Lentejas']},{attributeName:'Bebida',options:['Agua','Te']}]};
  const tea={id:11302,code:11302,name:'Te Helado',price:4000,availableNow:true,hasAttributes:false,attributes:[]};
  for(const f of [
    {menu:products,request:'Quiero dos almuerzos ejecutivos',name:'Ejecutivo Con Pollo Frito',options:'Mondongo pollo frito pierna pernil papa salada',drink:'Limonada',id:22,newRequest:'Un churrasco por favor',newId:17},
    {menu:[lunch,tea],request:'Quiero dos menu oriental',name:'Menu Oriental',options:'Horno sopa de lentejas sin ensalada',drink:'Te',id:11301,newRequest:'Un te helado por favor',newId:11302},
  ].flatMap(f=>[false,true].map(agentEnabled=>({...f,agentEnabled})))) {
    it.each(['precio','descripcion','horario'])('consulta %s no pierde selección ni cantidad: '+f.id+' agent='+f.agentEnabled,async kind=>{
      const h=harness(f.menu,f.agentEnabled);await h.sendQueued(f.request);
      const before=structuredClone(h.conv.sessionData);
      expect(h.cartRows()).toEqual([]);
      const query=kind==='precio'?'Cuánto cuesta '+f.name+'?':kind==='descripcion'?'Qué trae '+f.name+'?':'A qué hora cierran?';
      await h.sendQueued(query);
      expect(h.cartRows()).toEqual([]);
      expect(h.conv.sessionData.pendingMatch).toEqual(before.pendingMatch);
      expect(h.conv.sessionData.pendingAttribute).toEqual(before.pendingAttribute);
      await h.sendQueued(f.options);await h.sendQueued(f.drink);
      expect(h.cartRows()).toEqual([expect.objectContaining({id:f.id,qty:2})]);
    });
    it('cancelar y pedir otro plato no recupera el menú abandonado: '+f.id+' agent='+f.agentEnabled,async()=>{
      const h=harness(f.menu,f.agentEnabled);await h.sendQueued(f.request);
      await h.sendQueued('Cancela ese pedido');
      expect(h.cartRows()).toEqual([]);
      expect(h.conv.sessionData.pendingMatch).toBeFalsy();
      expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
      await h.sendQueued(f.newRequest);
      expect(h.cartRows()).toEqual([expect.objectContaining({id:f.newId,qty:1})]);
    });
    it('después de cancelar, las opciones viejas no reviven el menú: '+f.id+' agent='+f.agentEnabled,async()=>{
      const h=harness(f.menu,f.agentEnabled);await h.sendQueued(f.request);
      await h.sendQueued('Cancela ese pedido');
      await h.sendQueued(f.options);
      expect(h.cartRows().find(row=>row.id===f.id)).toBeFalsy();
      expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
      expect(h.conv.sessionData.pendingMatch).toBeFalsy();
    });
  }
});

describe('Recogida de un tercero — nombre propio sin el verbo recoge', () => {
  const taco = { id: 11401, code: 11401, name: 'Taco Al Pastor', price: 12000, availableNow: true, hasAttributes: false, attributes: [] };
  const ready = (menu: typeof products) => {
    const h = harness(menu, false);
    h.conv.sessionData.phoneConfirmed = true;
    h.conv.sessionData.contactPhone = h.conv.phoneE164;
    return h;
  };
  it.each([
    ['Lo busca mi mamá en el local', products, 'Un churrasco', 17],
    ['Lo retira mi hermana Andrea en el restaurante', products, 'Un churrasco', 17],
    ['Pasa Camila por el pedido', products, 'Un churrasco', 17],
    ['Mi esposa pasa por el restaurante', products, 'Un churrasco', 17],
    ['Lo busca mi mamá en el local', [taco], 'Un taco al pastor', 11401],
    ['Pasa Camila por el pedido', [taco], 'Dos tacos al pastor', 11401],
  ] as const)('%s conserva el plato y pasa a recoger', async (phrase, menu, order, id) => {
    const h = ready(menu as typeof products);
    await h.sendQueued(order);
    await h.sendQueued('Para la calle 10 #20-30');
    expect(h.conv.sessionData.orderType).toBe('delivery');
    const before = h.cartRows();
    const reply = await h.sendQueued(phrase);
    expect(h.cartRows()).toEqual(before);
    expect(h.cartRows()[0]).toEqual(expect.objectContaining({ id, qty: /dos /i.test(order) ? 2 : 1 }));
    expect(h.conv.sessionData.orderType).toBe('pickup');
    expect(h.conv.sessionData.address || '').toMatch(/recoge en el local/i);
    expect(reply || '').not.toMatch(/no manejamos|no tenemos/i);
    expect(h.conv.customerName).toBe('Wilmer');
  });
  it.each([
    [products, 'Mi mamá quiere dos churrascos para la calle 10 #20-30', 17, 2],
    [[taco], 'Mi mamá quiere dos tacos al pastor para la calle 10 #20-30', 11401, 2],
  ] as const)('un familiar que pide domicilio no es recogida', async (menu, text, id, qty) => {
    const h = ready(menu as typeof products);
    await h.sendQueued(text);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id, qty })]);
    expect(h.conv.sessionData.orderType).toBe('delivery');
    expect(h.conv.sessionData.address || '').toMatch(/calle 10/i);
  });
  it.each([
    { menu: products, order: 'Un churrasco' },
    { menu: [taco], order: 'Un taco al pastor' },
  ])('negar que lo busque un familiar mantiene el domicilio', async ({ menu, order }) => {
    const h = ready(menu as typeof products);
    await h.sendQueued(order);
    await h.sendQueued('Para la calle 12 #30-40');
    const before = h.cartRows();
    await h.sendQueued('No lo busca mi mamá, mándalo a la calle 12 #30-40');
    expect(h.conv.sessionData.orderType).toBe('delivery');
    expect(h.cartRows()).toEqual(before);
    expect(h.conv.sessionData.address || '').toMatch(/12/);
  });
  it.each(['El mensajero lo busca en el local', 'Lo retira el domiciliario en el restaurante'])('el repartidor no convierte el domicilio en recogida: %s', async (phrase) => {
    const h = ready(products);
    await h.sendQueued('Un churrasco');
    await h.sendQueued('Para la calle 10 #20-30');
    await h.sendQueued(phrase);
    expect(h.conv.sessionData.orderType).toBe('delivery');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 17, qty: 1 })]);
  });
});

describe('El resto sí — confirmación coloquial de lo que sí hay', () => {
  const taco = { id: 11411, code: 11411, name: 'Taco Al Pastor', price: 12000, availableNow: true, hasAttributes: false, attributes: [] };
  it.each([
    ['el resto sí', products, 'Dos churrascos y una malteada', 17, 2],
    ['sí el resto', products, 'Dos churrascos y una malteada', 17, 2],
    ['con eso está bien', products, 'Un churrasco y una malteada', 17, 1],
    ['de una', products, 'Un churrasco y una malteada', 17, 1],
    ['lo que sí tienen', products, 'Un churrasco y una malteada', 17, 1],
    ['el resto sí', [taco], 'Dos tacos al pastor y un helado', 11411, 2],
    ['de una', [taco], 'Un taco al pastor y un helado', 11411, 1],
  ] as const)('%s agrega solo lo conocido', async (yes, menu, order, id, qty) => {
    const h = harness(menu as typeof products, false);
    await h.sendQueued(order);
    expect(h.cartRows()).toEqual([expect.objectContaining({id,qty})]);
    const before = h.cartRows();
    await h.sendQueued(yes);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id, qty })]);
    expect(h.conv.sessionData.pendingMultiOrder).toBeFalsy();
    expect(h.cartRows()).toEqual(before);
  });
  it.each([
    { menu: products, order: 'Un churrasco y una malteada', id: 17 },
    { menu: [taco], order: 'Un taco al pastor y un helado', id: 11411 },
  ])('pedir el faltante por su nombre no lo inventa', async ({ menu, order, id }) => {
    const h = harness(menu as typeof products, false);
    await h.sendQueued(order);
    const before = h.cartRows();
    const reply = await h.sendQueued(menu === products ? 'sí la malteada' : 'sí el helado');
    expect(h.cartRows()).toEqual(before);
    expect(h.cartRows().map(row=>row.id)).toEqual([id]);
    expect(reply || '').toMatch(/no tenemos|no manejamos|malteada|helado/i);
  });
});

describe('Para N personas no es la cantidad del plato', () => {
  const taco = { id: 11421, code: 11421, name: 'Taco Al Pastor', price: 12000, availableNow: true, hasAttributes: false, attributes: [] };
  it.each([
    ['Un churrasco para dos personas', products, 17, 1],
    ['Un churrasco para 4 personas', products, 17, 1],
    ['Somos tres personas, un churrasco', products, 17, 1],
    ['Dos churrascos para cuatro personas', products, 17, 2],
    ['Un taco al pastor para tres personas', [taco], 11421, 1],
    ['Dos tacos al pastor para cuatro personas', [taco], 11421, 2],
    ['Somos cuatro personas, un taco al pastor', [taco], 11421, 1],
  ] as const)('%s', async (text, menu, id, qty) => {
    const h = harness(menu as typeof products, false);
    await h.sendQueued(text);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id, qty })]);
  });
  it.each([
    [products, 'Un churrasco para dos personas y dos sopas de mondongo', 17, 45],
    [[taco, { id: 11422, code: 11422, name: 'Sopa De Lentejas', price: 8000, availableNow: true, hasAttributes: false, attributes: [] }], 'Un taco al pastor para dos personas y dos sopas de lentejas', 11421, 11422],
  ] as const)('cada plato conserva su cantidad junto a los comensales', async (menu, text, mainId, sideId) => {
    const h = harness(menu as typeof products, false);
    await h.sendQueued(text);
    expect(h.cartRows()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: mainId, qty: 1 }),
      expect.objectContaining({ id: sideId, qty: 2 }),
    ]));
    expect(h.cartRows()).toHaveLength(2);
  });
});

describe('Cierre, precio y combo no se tragan el checkout', () => {
  const taco = { id: 11431, code: 11431, name: 'Taco Al Pastor', price: 12000, availableNow: true, hasAttributes: false, attributes: [] };
  const tacoCombo = { id: 11432, code: 11432, name: 'Combo De Taco Al Pastor', price: 18000, availableNow: true, hasAttributes: false, attributes: [] };

  it.each([
    { menu: products, order: 'Un churrasco', agent: false },
    { menu: products, order: 'Un churrasco', agent: true },
    { menu: [taco], order: 'Un taco al pastor', agent: false },
    { menu: [taco], order: 'Un taco al pastor', agent: true },
  ])('así está bien no queda como nombre ($order, agente $agent)', async ({ menu, order, agent }) => {
    const h = harness(menu as typeof products, agent);
    await h.sendQueued(order);
    const before = h.cartRows();
    expect(before).toHaveLength(1);
    h.conv.customerName = '';
    const reply = await h.sendQueued('Así está bien');
    expect(h.cartRows()).toEqual(before);
    expect(h.conv.customerName || '').not.toMatch(/as[ií] est[aá] bien/i);
    expect(reply || '').toMatch(/nombre/i);
    expect(reply || '').not.toMatch(/Con gusto, \*As[ií] est[aá] bien\*/i);
  });

  it.each([
    { menu: products, order: 'Un churrasco', money: /38[,.]?000/, agent: false },
    { menu: products, order: 'Un churrasco', money: /38[,.]?000/, agent: true },
    { menu: [taco], order: 'Un taco al pastor', money: /12[,.]?000/, agent: false },
    { menu: [taco], order: 'Un taco al pastor', money: /12[,.]?000/, agent: true },
  ])('que precio tiene en el paso del nombre no cambia la identidad', async ({ menu, order, money, agent }) => {
    const h = harness(menu as typeof products, agent);
    await h.sendQueued(order);
    const before = h.cartRows();
    h.conv.customerName = '';
    h.conv.state = 'awaiting_name';
    const reply = await h.sendQueued('Que precio tiene');
    expect(h.cartRows()).toEqual(before);
    expect(h.conv.customerName || '').not.toMatch(/precio/i);
    expect(reply || '').toMatch(money);
    expect(reply || '').toMatch(/sigue igual/i);
    expect(h.conv.state).not.toBe('awaiting_payment');
  });

  it.each([
    { menu: products, order: 'Un arroz paisa', agent: true },
    { menu: products, order: 'Un arroz paisa', agent: false },
    { menu: [taco, tacoCombo], order: 'Un taco al pastor', agent: true },
    { menu: [taco, tacoCombo], order: 'Un taco al pastor', agent: false },
  ])('viene en combo o solo durante el pago no repite solo cómo pagas', async ({ menu, order, agent }) => {
    const h = harness(menu as typeof products, agent);
    await h.sendQueued(order);
    const before = h.cartRows();
    expect(before).toHaveLength(1);
    h.conv.state = 'awaiting_payment';
    const reply = await h.sendQueued('Pero ese viene en combo o solo?');
    expect(h.cartRows()).toEqual(before);
    expect(reply || '').toMatch(/combo/i);
    expect(reply || '').not.toMatch(/c[oó]mo pagas/i);
    expect(reply || '').not.toMatch(/no entend[ií]/i);
  });

  it.each([
    { menu: products },
    { menu: [taco] },
  ])('en cuanto llega mi pedido no dice que no entendió', async ({ menu }) => {
    const h = harness(menu as typeof products, false);
    h.service.ordersService = {
      findTodayOrdersByPhone: async () => [{ dailyOrderNumber: 12, orderStatus: 'cooking' }],
    };
    const reply = await h.sendQueued('En cuanto llega mi pedido?');
    expect(reply || '').toMatch(/#12/);
    expect(reply || '').toMatch(/preparaci[oó]n/i);
    expect(reply || '').not.toMatch(/no entend[ií]/i);
  });

  it.each([
    { menu: products, text: 'Para cuántas porciones es el arroz chino' },
    { menu: [taco], text: 'Para cuántas porciones es el taco al pastor' },
  ])('porciones no inventa un rendimiento', async ({ menu, text }) => {
    const h = harness(menu as typeof products, true);
    const reply = await h.sendQueued(text);
    expect(h.cartRows()).toHaveLength(0);
    expect(reply || '').toMatch(/rendimiento|carta/i);
    expect(reply || '').not.toMatch(/ideal para|dos personas|\b2 personas\b/i);
  });
});

describe('Referencia ese, foto y nota de preparación', () => {
  const taco = { id: 11441, code: 11441, name: 'Taco Al Pastor', price: 12000, availableNow: true, hasAttributes: false, attributes: [] };
  const tacoCombo = { id: 11442, code: 11442, name: 'Combo De Taco Al Pastor', price: 18000, availableNow: true, hasAttributes: false, attributes: [] };

  it.each([
    { menu: products, id: 17, name: 'Churrasco', code: 17, price: 38000, agent: true },
    { menu: products, id: 17, name: 'Churrasco', code: 17, price: 38000, agent: false },
    { menu: [taco], id: 11441, name: 'Taco Al Pastor', code: 11441, price: 12000, agent: true },
    { menu: [taco], id: 11441, name: 'Taco Al Pastor', code: 11441, price: 12000, agent: false },
  ])('si quiero ese agrega la oferta pendiente', async ({ menu, id, name, code, price, agent }) => {
    const h = harness(menu as typeof products, agent);
    h.conv.sessionData.pendingAddOffer = { productId: id, name, code, price, quantity: 1, sourceText: name };
    const reply = await h.sendQueued('Si quiero ese');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id, qty: 1 })]);
    expect(reply || '').not.toMatch(/qu[eé] se te antoja/i);
    expect(h.conv.sessionData.pendingAddOffer).toBeFalsy();
  });

  it.each([
    { menu: products, order: 'Un arroz paisa', agent: true },
    { menu: [taco, tacoCombo], order: 'Un taco al pastor', agent: true },
  ])('si quiero ese con dos platos en el mensaje anterior pregunta cuál', async ({ menu, order, agent }) => {
    const h = harness(menu as typeof products, agent);
    await h.sendQueued(order);
    const before = h.cartRows();
    expect(before).toHaveLength(1);
    await h.sendQueued('Pero ese viene en combo o solo?');
    const reply = await h.sendQueued('Si quiero ese');
    expect(h.cartRows()).toEqual(before);
    expect(reply || '').toMatch(/cu[aá]l|ya est[aá]/i);
    expect(reply || '').not.toMatch(/qu[eé] se te antoja/i);
  });

  it.each([
    { menu: products, order: 'Un churrasco', note: 'Puedes gritarme las arepas', expectNote: /fritar/i, agent: true },
    { menu: products, order: 'Un churrasco', note: 'Y darme miel', expectNote: /miel/i, agent: false },
    { menu: [taco], order: 'Un taco al pastor', note: 'Puedes gritarme las arepas', expectNote: /fritar/i, agent: true },
    { menu: [taco], order: 'Un taco al pastor', note: 'Y darme miel', expectNote: /miel/i, agent: false },
  ])('la preparación no compra otro plato', async ({ menu, order, note, expectNote, agent }) => {
    const h = harness(menu as typeof products, agent);
    await h.sendQueued(order);
    const reply = await h.sendQueued(note);
    expect(h.cartRows()).toHaveLength(1);
    expect(h.cartRows()[0].note || reply || '').toMatch(expectNote);
  });

  it.each([
    { menu: products, order: 'Un churrasco', agent: true },
    { menu: [taco], order: 'Un taco al pastor', agent: false },
  ])('qieceste jugosito es que el plato quede jugoso', async ({ menu, order, agent }) => {
    const h = harness(menu as typeof products, agent);
    await h.sendQueued(order);
    const before = h.cartRows();
    const reply = await h.sendQueued('Qieceste jugosito');
    expect(h.cartRows().map((row) => ({ id: row.id, qty: row.qty }))).toEqual(
      before.map((row) => ({ id: row.id, qty: row.qty })),
    );
    expect(h.cartRows()[0].note || '').toMatch(/jugoso/i);
    expect(reply || '').toMatch(/jugoso/i);
    expect(reply || '').not.toMatch(/cu[aá]l jugo/i);
  });

  it.each([
    { menu: products },
    { menu: [taco, tacoCombo] },
  ])('ese combo de la foto no elige un combo al azar', async ({ menu }) => {
    const h = harness(menu as typeof products, true);
    const reply = await h.sendQueued('Me gustaría ese combo de la foto');
    expect(h.cartRows()).toHaveLength(0);
    expect(reply || '').toMatch(/nombre[^a-z]*del combo/i);
    expect(reply || '').not.toMatch(/agregu[eé]/i);
  });
});

describe('Recargo de barrio, dos combos y el pago', () => {
  const plate = (id: number, name: string, extra: Record<string, unknown> = {}) => ({
    id, code: id, name, price: 18000, availableNow: true, hasAttributes: false, attributes: [], ...extra,
  });
  const pizza = [plate(11601, 'Combo De Pizza Margarita', {
    price: 28000, hasAttributes: true,
    attributes: [{ attributeName: 'Bebida', options: ['Cola', 'Limonada', 'Agua'] }],
  })];
  const sushi = [plate(11621, 'Roll De Salmon')];
  const ramen = [
    plate(11611, 'Ramen De Miso', { price: 22000 }),
    plate(11612, 'Gyoza', { price: 9000 }),
  ];

  const stubPayment = (h: ReturnType<typeof harness>) => {
    h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 9001, dailyOrderNumber: 21 });
    h.service.paymentsService.createPreference = jest.fn().mockResolvedValue({
      preferenceId: 'pref-test', initPoint: 'https://pay.test/pref-test',
    });
  };

  it.each([
    { menu: products, ask: 'La vez pasada en el barrio me cobraron un recargo de 4 mil, aún tienen el servicio?' },
    { menu: sushi, ask: 'Antes me cobraron recargo por el barrio, todavía lo cobran?' },
  ])('el recargo histórico no arma pedido ni inventa el valor', async ({ menu, ask }) => {
    const h = harness(menu as typeof products, true);
    const reply = await h.sendQueued(ask);
    expect(h.cartRows()).toHaveLength(0);
    expect(h.conv.sessionData.address || '').toBe('');
    expect(h.conv.sessionData.orderType).not.toBe('delivery');
    expect(reply || '').toMatch(/recargo/i);
    expect(reply || '').toMatch(/restaurante/i);
    expect(reply || '').not.toMatch(/\$\s*4[.\s]?000|4\s*mil/i);
    expect(reply || '').not.toMatch(/no manejamos/i);
  });

  it('con un plato ya pedido, el recargo no lo toca', async () => {
    const h = harness(products, false);
    await h.sendQueued('Un churrasco');
    const reply = await h.sendQueued('La vez pasada el recargo del barrio eran 4 mil, aún tienen el servicio?');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 17, qty: 1 })]);
    expect(reply || '').toMatch(/sigue igual/i);
    expect(reply || '').not.toMatch(/\$\s*4[.\s]?000/i);
  });

  it.each([
    {
      menu: products, agent: true,
      order: 'Dos combos de arroz paisa, uno con Colombia y el otro con Coca-Cola',
      id: 94, left: /Colombiana/i, right: /Coca Cola/i,
    },
    {
      menu: pizza, agent: false,
      order: 'Dos combos de pizza margarita, uno con cola y el otro con limonada',
      id: 11601, left: /Cola/i, right: /Limonada/i,
    },
  ])('dos combos del mismo plato quedan con bebidas distintas', async ({ menu, agent, order, id, left, right }) => {
    const h = harness(menu as typeof products, agent);
    await h.sendQueued(order);
    const rows = h.cartRows().filter((row) => row.id === id);
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.qty === 1)).toBe(true);
    const drinks = rows.map((row) => row.attrs.join('|')).join(' || ');
    expect(drinks).toMatch(left);
    expect(drinks).toMatch(right);
    expect(h.cartRows().filter((row) => row.id !== id)).toHaveLength(0);
  });

  it('dos combos, domicilio y nequi crean el pedido simulado', async () => {
    const h = harness(products, true);
    stubPayment(h);
    await h.sendQueued('Dos combos de arroz paisa, uno con Colombia y el otro con Coca-Cola');
    await h.sendQueued('Calle 48 sur 87 86');
    await h.sendQueued('Pago por nequi');
    if (h.conv.state === 'awaiting_final_confirm') await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const dto = h.service.ordersService.create.mock.calls[0][0];
    expect(dto.items).toHaveLength(2);
    expect(dto.items.every((item: { productId: number }) => item.productId === 94)).toBe(true);
    expect(dto.address || '').toMatch(/transferencia|nequi/i);
    expect(h.service.paymentsService.createPreference).not.toHaveBeenCalled();
    expect(h.replies.at(-1) || '').toMatch(/pedido|listo|#\s*21/i);
  });

  it('el link de mercado pago se pide al servicio de pagos y no crea la orden', async () => {
    const h = harness(pizza as typeof products, false);
    stubPayment(h);
    await h.sendQueued('Dos combos de pizza margarita, uno con cola y el otro con limonada');
    await h.sendQueued('Calle 48 sur 87 86');
    const reply = await h.sendQueued('Link de mercado pago');
    expect(h.service.paymentsService.createPreference).toHaveBeenCalledTimes(1);
    const items = h.service.paymentsService.createPreference.mock.calls[0][1];
    expect(items).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: expect.stringMatching(/pizza/i), quantity: 1 }),
    ]));
    expect(items).toHaveLength(2);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    expect(reply || '').toMatch(/pay\.test\/pref-test/);
    expect(h.conv.state).toBe('awaiting_mp_payment');
  });

  it('churrasco, mondongo y yuca se pagan en efectivo con el billete', async () => {
    const h = harness(products, false);
    stubPayment(h);
    await h.sendQueued('Un churrasco, una sopa de mondongo y una porcion de yuca frita');
    await h.sendQueued('Carrera 15 45 20');
    await h.sendQueued('Pago en efectivo con un billete de 50 mil');
    expect(h.conv.sessionData.paymentMethod).toBe('cash');
    expect(String(h.conv.sessionData.cashChangeFor || '')).toMatch(/50/);
    if (h.conv.state === 'awaiting_final_confirm') await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const dto = h.service.ordersService.create.mock.calls[0][0];
    expect(dto.items.map((item: { productId: number }) => item.productId).sort((a: number, b: number) => a - b)).toEqual([7, 17, 45]);
    expect(String(dto.address || '')).toMatch(/efectivo|contraentrega|50/);
  });

  it('ramen y gyoza se pagan por daviplata sin mezclar los platos', async () => {
    const h = harness(ramen as typeof products, true);
    stubPayment(h);
    await h.sendQueued('Un ramen de miso y una gyoza');
    await h.sendQueued('Avenida 68 20 15');
    await h.sendQueued('Pago por daviplata');
    if (h.conv.state === 'awaiting_final_confirm') await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const dto = h.service.ordersService.create.mock.calls[0][0];
    expect(dto.items.map((item: { productId: number }) => item.productId).sort()).toEqual([11611, 11612]);
    expect(dto.address || '').toMatch(/transferencia|daviplata/i);
    expect(h.replies.at(-1) || '').toMatch(/pedido|listo|#\s*21/i);
  });
});

describe('Textura del plato en cartas distintas', () => {
  const plate = (id: number, name: string) => ({
    id, code: id, name, price: 15000, availableNow: true, hasAttributes: false, attributes: [],
  });
  const pasta = [plate(11501, 'Pasta Alfredo')];
  const bowl = [plate(11511, 'Bowl De Quinoa')];
  const burger = [plate(11521, 'Hamburguesa Clasica')];
  const taco = [plate(11531, 'Taco Al Pastor')];

  it.each([
    { menu: products, order: 'Un churrasco', note: 'que esté jugoso el platillo', expectNote: /jugoso/i, agent: true },
    { menu: taco, order: 'Un taco al pastor', note: 'bien jugoso', expectNote: /jugoso/i, agent: false },
    { menu: pasta, order: 'Una pasta alfredo', note: 'que quede bien doradito', expectNote: /doradito/i, agent: true },
    { menu: bowl, order: 'Un bowl de quinoa', note: 'que no quede seco', expectNote: /seco/i, agent: false },
    { menu: burger, order: 'Una hamburguesa clasica', note: 'Qieceste jugosito', expectNote: /jugoso/i, agent: true },
  ])('$note queda en el plato y no compra otra cosa', async ({ menu, order, note, expectNote, agent }) => {
    const h = harness(menu as typeof products, agent);
    await h.sendQueued(order);
    const before = h.cartRows();
    expect(before).toHaveLength(1);
    const reply = await h.sendQueued(note);
    expect(h.cartRows()).toHaveLength(1);
    expect(h.cartRows()[0].id).toBe(before[0].id);
    expect(h.cartRows()[0].qty).toBe(1);
    expect(h.cartRows()[0].note || '').toMatch(expectNote);
    expect(reply || '').toMatch(expectNote);
    expect(reply || '').not.toMatch(/cu[aá]l jugo/i);
  });

  it.each([
    { menu: products, note: 'Qieceste jugosito' },
    { menu: pasta, note: 'que quede bien doradito' },
    { menu: burger, note: 'bien jugoso el platillo' },
  ])('sin plato, la textura no se vuelve un producto', async ({ menu, note }) => {
    const h = harness(menu as typeof products, true);
    const reply = await h.sendQueued(note);
    expect(h.cartRows()).toHaveLength(0);
    expect(reply || '').toMatch(/nota de preparaci[oó]n|primero el/i);
    expect(reply || '').not.toMatch(/cu[aá]l jugo/i);
  });

  it('un jugo de mango sigue siendo bebida, no textura del plato', async () => {
    const h = harness(products, false);
    await h.sendQueued('Un churrasco');
    const reply = await h.sendQueued('Quiero un jugo de mango');
    const churrasco = h.cartRows().find((row) => row.id === 17);
    expect(churrasco).toBeTruthy();
    expect(churrasco?.note || '').not.toMatch(/jugoso/i);
    expect(h.cartRows().some((row) => row.id === 50 || row.id === 51) || /jugo|mango|agua|leche/i.test(reply || '')).toBe(true);
  });
});

describe('Corrección de precio, horario con pedido y cambio de pago', () => {
  const plate = (id: number, name: string, price: number) => ({
    id, code: id, name, price, availableNow: true, hasAttributes: false, attributes: [],
  });
  const pizzas = [plate(11701, 'Pizza Familiar', 32000), plate(11702, 'Pizza Personal', 16000)];
  const ramen = [plate(11611, 'Ramen De Miso', 22000)];
  const stubPayment = (h: ReturnType<typeof harness>) => {
    h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 9002, dailyOrderNumber: 22 });
    h.service.paymentsService.createPreference = jest.fn().mockResolvedValue({
      preferenceId: 'pref-test', initPoint: 'https://pay.test/pref-test',
    });
  };

  it.each([
    { menu: products, ask: 'Discúlpame cuánto sería con medio pollo frito, perdón un cuarto', price: /14[.\s]000/, other: /24[.\s]000/, agent: true },
    { menu: products, ask: 'Discúlpame cuánto sería con medio pollo frito, perdón un cuarto', price: /14[.\s]000/, other: /24[.\s]000/, agent: false },
    { menu: pizzas, ask: 'Discúlpame cuánto sería la pizza familiar, perdón la personal', price: /16[.\s]000/, other: /32[.\s]000/, agent: false },
  ])('la corrección se queda con el último precio: $ask', async ({ menu, ask, price, other, agent }) => {
    const h = harness(menu as typeof products, agent);
    const reply = await h.sendQueued(ask);
    expect(h.cartRows()).toHaveLength(0);
    expect(reply || '').toMatch(price);
    expect(reply || '').not.toMatch(other);
  });

  it.each([
    { menu: products, order: 'Un churrasco', id: 17, ask: 'A qué hora cierran?', agent: true },
    { menu: ramen, order: 'Un ramen de miso', id: 11611, ask: 'Están abiertos?', agent: false },
  ])('el horario no suelta el plato que ya está pedido', async ({ menu, order, id, ask, agent }) => {
    const h = harness(menu as typeof products, agent);
    await h.sendQueued(order);
    const reply = await h.sendQueued(ask);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id, qty: 1 })]);
    expect(reply || '').toMatch(/atendiendo|horario|00:00/i);
    expect(reply || '').toMatch(/sigue igual/i);
    expect(reply || '').not.toMatch(/no manejamos/i);
  });

  it('después de nequi, mejor en efectivo no crea el pedido hasta confirmar', async () => {
    const h = harness(products, true);
    stubPayment(h);
    await h.sendQueued('Un churrasco');
    await h.sendQueued('Calle 48 sur 87 86');
    await h.sendQueued('Pago por nequi');
    expect(h.conv.state).toBe('awaiting_final_confirm');
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    const reply = await h.sendQueued('Mejor en efectivo');
    expect(h.conv.sessionData.paymentMethod).toBe('cash');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 17, qty: 1 })]);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    expect(reply || '').toMatch(/contraentrega|efectivo/i);
    await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    expect(String(h.service.ordersService.create.mock.calls[0][0].address || '')).toMatch(/efectivo|contraentrega/i);
  });

  it('después de efectivo, la pizza pasa a daviplata sin cobrar antes de confirmar', async () => {
    const h = harness(pizzas as typeof products, false);
    stubPayment(h);
    await h.sendQueued('Una pizza personal');
    await h.sendQueued('Calle 48 sur 87 86');
    await h.sendQueued('Pago en efectivo');
    expect(h.conv.sessionData.paymentMethod).toBe('cash');
    const reply = await h.sendQueued('Mejor por daviplata');
    expect(h.conv.sessionData.paymentMethod).toBe('transfer');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 11702, qty: 1 })]);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    expect(reply || '').toMatch(/transferencia|daviplata/i);
    await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    expect(String(h.service.ordersService.create.mock.calls[0][0].address || '')).toMatch(/transferencia|daviplata/i);
  });
});

describe('Corrección de una sola línea: estilo y bebida', () => {
  const plate = (id: number, name: string, extra: Record<string, unknown> = {}) => ({
    id, code: id, name, price: 18000, availableNow: true, hasAttributes: false, attributes: [], ...extra,
  });
  const burgers = [
    plate(11801, 'Hamburguesa Clasica Frita', {
      price: 22000, hasAttributes: true,
      attributes: [{ attributeName: 'Queso', options: ['Cheddar', 'Suizo'] }],
    }),
    plate(11802, 'Hamburguesa Clasica Plancha', {
      price: 23000, hasAttributes: true,
      attributes: [{ attributeName: 'Queso', options: ['Cheddar', 'Suizo'] }],
    }),
    plate(11803, 'Bowl De Quinoa', { price: 16000 }),
  ];
  const pizza = [plate(11601, 'Combo De Pizza Margarita', {
    price: 28000, hasAttributes: true,
    attributes: [{ attributeName: 'Bebida', options: ['Cola', 'Limonada', 'Agua'] }],
  })];
  const pay = (h: ReturnType<typeof harness>) => {
    h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 9003, dailyOrderNumber: 23 });
    h.service.paymentsService.createPreference = jest.fn().mockResolvedValue({
      preferenceId: 'pref-style', initPoint: 'https://pay.test/pref-style',
    });
  };

  it('no era broaster, era frito conserva presa, sopa, bebida y el otro plato', async () => {
    const h = harness(products, true);
    pay(h);
    await h.sendQueued('Un ejecutivo con pollo broaster presa pechuga sopa mondongo bebida pepsi');
    await h.sendQueued('Un churrasco');
    await h.sendQueued('Calle 48 sur 87 86');
    const address = h.conv.sessionData.address || '';
    expect(address).toMatch(/48/);
    expect(h.cartRows().some((row) => row.id === 18)).toBe(true);
    const reply = await h.sendQueued('No era broaster, era frito');
    const rows = h.cartRows();
    expect(rows.map((row) => row.id).sort((a, b) => a - b)).toEqual([17, 22]);
    const ejecutivo = rows.find((row) => row.id === 22);
    expect(ejecutivo?.qty).toBe(1);
    expect(ejecutivo?.attrs.join(' ')).toMatch(/pechuga/i);
    expect(ejecutivo?.attrs.join(' ')).toMatch(/mondongo/i);
    expect(ejecutivo?.attrs.join(' ')).toMatch(/pepsi/i);
    expect(h.conv.sessionData.address || '').toBe(address);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    expect(reply || '').toMatch(/frito/i);
    expect(reply || '').toMatch(/sigue igual/i);
  });

  it('en otra carta, no era frita era plancha conserva el queso y el bowl', async () => {
    const h = harness(burgers as typeof products, false);
    pay(h);
    await h.sendQueued('Un bowl de quinoa');
    await h.sendQueued('Una hamburguesa clasica frita con cheddar');
    expect(h.cartRows().map((row) => row.id).sort((a, b) => a - b)).toEqual([11801, 11803]);
    await h.sendQueued('Calle 48 sur 87 86');
    const address = h.conv.sessionData.address || '';
    const reply = await h.sendQueued('No era frita, era a la plancha');
    const rows = h.cartRows();
    expect(rows.map((row) => row.id).sort((a, b) => a - b)).toEqual([11802, 11803]);
    const burger = rows.find((row) => row.id === 11802);
    expect(burger?.qty).toBe(1);
    expect(burger?.attrs.join(' ')).toMatch(/cheddar/i);
    expect(h.conv.sessionData.address || '').toBe(address);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    expect(reply || '').toMatch(/plancha/i);
  });

  it('dos estilos broaster no cambia ninguno hasta decir cuál', async () => {
    const h = harness(products, true);
    await h.sendQueued('Un combo de pollo broaster');
    await h.sendQueued('Un ejecutivo con pollo broaster');
    const before = h.cartRows().map((row) => row.id).sort((a, b) => a - b);
    expect(before).toEqual([18, 98]);
    const reply = await h.sendQueued('No era broaster, era frito');
    expect(h.cartRows().map((row) => row.id).sort((a, b) => a - b)).toEqual(before);
    expect(reply || '').toMatch(/cu[aá]l plato/i);
    expect(reply || '').toMatch(/sigue igual/i);
  });

  it('quita la coca y deja la colombiana en los dos combos', async () => {
    const h = harness(products, true);
    pay(h);
    await h.sendQueued('Dos combos de arroz paisa, uno con Colombia y el otro con Coca-Cola');
    await h.sendQueued('Calle 48 sur 87 86');
    const address = h.conv.sessionData.address || '';
    expect(h.cartRows().filter((row) => row.id === 94)).toHaveLength(2);
    const reply = await h.sendQueued('Quita la coca y deja la colombiana');
    const rows = h.cartRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 94, qty: 1 });
    expect(rows[0].attrs.join(' ')).toMatch(/colombiana/i);
    expect(rows[0].attrs.join(' ')).not.toMatch(/coca/i);
    expect(h.conv.sessionData.address || '').toBe(address);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    expect(reply || '').toMatch(/colombiana/i);
    expect(reply || '').toMatch(/Carrito/i);
    expect((reply || '').split('🛒').slice(1).join('🛒')).not.toMatch(/coca-cola|coca cola/i);
  });

  it('en la pizzería quita la cola y deja la limonada', async () => {
    const h = harness(pizza as typeof products, false);
    pay(h);
    await h.sendQueued('Dos combos de pizza, uno con cola y el otro con limonada');
    await h.sendQueued('Avenida 68 20 15');
    const address = h.conv.sessionData.address || '';
    expect(h.cartRows().filter((row) => row.id === 11601)).toHaveLength(2);
    const reply = await h.sendQueued('Quita la cola y deja la limonada');
    const rows = h.cartRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 11601, qty: 1 });
    expect(rows[0].attrs.join(' ')).toMatch(/limonada/i);
    expect(rows[0].attrs.join(' ')).not.toMatch(/cola/i);
    expect(h.conv.sessionData.address || '').toBe(address);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    expect(reply || '').toMatch(/limonada/i);
    expect(reply || '').not.toMatch(/bebida: cola/i);
  });
});

describe('Pregunta de servicio con el pedido abierto', () => {
  const plate = (id: number, name: string, price: number) => ({
    id, code: id, name, price, availableNow: true, hasAttributes: false, attributes: [],
  });
  const ramen = [plate(11611, 'Ramen De Miso', 22000)];

  it.each([
    { menu: products, order: 'Un churrasco', id: 17, agent: true, ask: 'Cuánto sale el domicilio?' },
    { menu: ramen, order: 'Un ramen de miso', id: 11611, agent: false, ask: 'Cuánto cuesta el envío?' },
  ])('cotiza el domicilio guardado: $ask', async ({ menu, order, id, agent, ask }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    await h.sendQueued(order);
    await h.sendQueued('Calle 48 sur 87 86');
    const address = h.conv.sessionData.address || '';
    expect(address).toMatch(/48/);
    const reply = await h.sendQueued(ask);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id, qty: 1 })]);
    expect(h.conv.sessionData.address || '').toBe(address);
    expect(h.conv.sessionData.orderType).not.toBe('pickup');
    expect(reply || '').toMatch(/2[.\s]000/);
    expect(reply || '').toMatch(/domicilio|env[ií]o/i);
    expect(reply || '').toMatch(/sigue igual/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each([
    { menu: products, order: 'Un churrasco', id: 17, agent: true, tip: 'Le dejo 2 mil de propina', amount: /2 mil/ },
    { menu: ramen, order: 'Un ramen de miso', id: 11611, agent: false, tip: 'Te dejo 3 mil de propina', amount: /3 mil/ },
  ])('la propina queda anotada y no es otro plato: $tip', async ({ menu, order, id, agent, tip, amount }) => {
    const h = harness(menu as typeof products, agent);
    await h.sendQueued(order);
    await h.sendQueued('Calle 48 sur 87 86');
    const address = h.conv.sessionData.address || '';
    const reply = await h.sendQueued(tip);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id, qty: 1 })]);
    expect(h.conv.sessionData.customerNotes || '').toMatch(/propina/i);
    expect(h.conv.sessionData.customerNotes || '').toMatch(amount);
    expect(h.conv.sessionData.address || '').toBe(address);
    expect(reply || '').toMatch(/propina/i);
    expect(reply || '').toMatch(/sigue igual/i);
    expect(reply || '').not.toMatch(/no manejamos/i);
  });

  it.each([
    { menu: products, order: 'Un churrasco', id: 17, agent: true, ask: 'Es para llevar' },
    { menu: ramen, order: 'Un ramen de miso', id: 11611, agent: false, ask: 'Mejor para llevar' },
  ])('pasa a recoger sin borrar el plato: $ask', async ({ menu, order, id, agent, ask }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    await h.sendQueued(order);
    await h.sendQueued('Calle 48 sur 87 86');
    const reply = await h.sendQueued(ask);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id, qty: 1 })]);
    expect(h.conv.sessionData.orderType).toBe('pickup');
    expect(h.conv.sessionData.address || '').toMatch(/recoge|local/i);
    expect(h.conv.sessionData.deliveryFeeCalculated).toBe(0);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    expect(reply || '').toMatch(/recoger|local/i);
    expect(reply || '').toMatch(/sigue igual/i);
  });
});

describe('La cita del bot no se compra como plato', () => {
  const plate = (id: number, name: string, extra: Record<string, unknown> = {}) => ({
    id, code: id, name, price: 28000, availableNow: true, hasAttributes: false, attributes: [], ...extra,
  });
  const pizza = [plate(11601, 'Combo De Pizza Margarita', {
    hasAttributes: true,
    attributes: [{ attributeName: 'Bebida', options: ['Cola', 'Limonada', 'Agua'] }],
  })];

  it.each([true, false])('uva responde la pregunta citada y no agrega otra gaseosa (agent %s)', async (agent) => {
    const h = harness(products, agent);
    await h.sendQueued('Un combo de arroz paisa');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 94, qty: 1 })]);
    const reply = await h.sendQueued('Con gusto, ¿qué sabor de gaseosa deseas? Uva');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({ id: 94, qty: 1, attrs: expect.arrayContaining(['Bebida:Uva']) }),
    ]);
    expect(h.cartRows().some((row) => row.id === 34)).toBe(false);
    expect(reply || '').toMatch(/uva/i);
    expect(reply || '').not.toMatch(/no manejamos/i);
  });

  it('en la pizzería la cita se queda con la limonada', async () => {
    const h = harness(pizza as typeof products, false);
    await h.sendQueued('Un combo de pizza');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 11601, qty: 1, attrs: ['Bebida:Cola'] })]);
    const reply = await h.sendQueued('¿Qué bebida prefieres? Limonada');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({ id: 11601, qty: 1, attrs: ['Bebida:Limonada'] }),
    ]);
    expect(reply || '').toMatch(/limonada/i);
  });

  it('la pregunta citada sola no compra la gaseosa', async () => {
    const h = harness(products, true);
    await h.sendQueued('Un combo de arroz paisa');
    const before = h.cartRows();
    const reply = await h.sendQueued('Con gusto, ¿qué sabor de gaseosa deseas?');
    expect(h.cartRows()).toEqual(before);
    expect(reply || '').toMatch(/opci[oó]n/i);
    expect(reply || '').toMatch(/sigue igual/i);
  });

  it('una pregunta seguida de un pedido no cambia la bebida del combo', async () => {
    const h = harness(products, false);
    await h.sendQueued('Un combo de arroz paisa');
    await h.sendQueued('¿Tienen pollo? Quiero un churrasco');
    const combo = h.cartRows().find((row) => row.id === 94);
    expect(combo).toMatchObject({ id: 94, qty: 1 });
    expect(combo?.attrs.join(' ')).toMatch(/colombiana/i);
    expect(h.cartRows()).toHaveLength(1);
    expect(h.cartRows().some((row) => row.id === 34)).toBe(false);
  });
});

describe('Cartas que no son de pollo', () => {
  const plate = (id: number, name: string, extra: Record<string, unknown> = {}) => ({
    id, code: id, name, price: 20000, availableNow: true, hasAttributes: false, attributes: [], ...extra,
  });
  const sushi = [
    plate(11901, 'Roll De Salmon', { price: 24000 }),
    plate(11902, 'Set De Sushi', {
      price: 42000, hasAttributes: true,
      attributes: [{ attributeName: 'Piezas', options: ['12 piezas', '24 piezas'] }],
    }),
  ];
  const pizzas = [
    plate(11701, 'Pizza Familiar', { price: 32000 }),
    plate(11702, 'Pizza Personal', { price: 16000 }),
  ];
  const bowls = [plate(11911, 'Bowl De Quinoa', {
    price: 18000, hasAttributes: true,
    attributes: [{ attributeName: 'Aderezo', options: ['Cilantro', 'Ranch'] }],
  })];
  const burgers = [plate(11921, 'Hamburguesa Clasica', {
    price: 22000, hasAttributes: true,
    attributes: [{ attributeName: 'Termino', options: ['Bien cocido', 'Medio', 'Tres Cuartos'] }],
  })];
  const forbidden = /presa|sopa|colombiana|broaster|frito o broaster/i;

  it('el roll de salmón no hereda opciones de pollo', async () => {
    const h = harness(sushi as typeof products, true);
    const reply = await h.sendQueued('Un roll de salmon');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 11901, qty: 1, attrs: [] })]);
    expect(reply || '').not.toMatch(forbidden);
  });

  it('el set de sushi usa las piezas pedidas', async () => {
    const h = harness(sushi as typeof products, false);
    const reply = await h.sendQueued('Un set de sushi de 24 piezas');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({ id: 11902, qty: 1, attrs: ['Piezas:24 piezas'] }),
    ]);
    expect(reply || '').not.toMatch(forbidden);
  });

  it.each([
    { ask: 'Una pizza familiar', id: 11701 },
    { ask: 'Una pizza personal', id: 11702 },
  ])('el tamaño de la pizza sale de la carta: $ask', async ({ ask, id }) => {
    const h = harness(pizzas as typeof products, true);
    const reply = await h.sendQueued(ask);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id, qty: 1 })]);
    expect(h.cartRows().some((row) => row.id !== id)).toBe(false);
    expect(reply || '').not.toMatch(forbidden);
  });

  it('una pizza sin tamaño pregunta cuál y no asume pollo', async () => {
    const h = harness(pizzas as typeof products, false);
    const reply = await h.sendQueued('Una pizza');
    expect(h.cartRows()).toHaveLength(0);
    expect(reply || '').toMatch(/familiar|personal/i);
    expect(reply || '').not.toMatch(forbidden);
  });

  it('el bowl queda con el aderezo nombrado', async () => {
    const h = harness(bowls as typeof products, true);
    const reply = await h.sendQueued('Un bowl de quinoa con ranch');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({ id: 11911, qty: 1, attrs: ['Aderezo:Ranch'] }),
    ]);
    expect(reply || '').not.toMatch(forbidden);
  });

  it('sin aderezo usa la primera opción de esa carta', async () => {
    const h = harness(bowls as typeof products, false);
    const reply = await h.sendQueued('Un bowl de quinoa');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({ id: 11911, qty: 1, attrs: ['Aderezo:Cilantro'] }),
    ]);
    expect(reply || '').not.toMatch(forbidden);
  });

  it('el término de la hamburguesa no cae en la primera opción', async () => {
    const h = harness(burgers as typeof products, true);
    const reply = await h.sendQueued('Una hamburguesa clasica término medio');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({ id: 11921, qty: 1, attrs: ['Termino:Medio'] }),
    ]);
    expect(reply || '').not.toMatch(forbidden);
  });

  it('en PPP el churrasco no gana presa ni sopa', async () => {
    const h = harness(products, false);
    const reply = await h.sendQueued('Un churrasco');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 17, qty: 1, attrs: [] })]);
    expect(reply || '').not.toMatch(/presa|sopa|colombiana/i);
  });
});

describe('Después de registrar el pedido', () => {
  const pasta = [{
    id: 12031, code: 12031, name: 'Pasta Carbonara', price: 26000,
    availableNow: true, hasAttributes: false, attributes: [],
  }];

  function registered(menu: typeof products, agent: boolean) {
    const h = harness(menu, agent);
    h.conv.state = 'completed';
    const cancel = jest.fn();
    const create = jest.fn();
    h.service.ordersService.findTodayOrdersByPhone = async () => [
      { dailyOrderNumber: 18, orderStatus: 'cooking' },
    ];
    h.service.ordersService.cancel = cancel;
    h.service.ordersService.create = create;
    return { h, cancel, create };
  }

  it.each([
    { menu: products, agent: true },
    { menu: products, agent: false },
    { menu: pasta, agent: true },
    { menu: pasta, agent: false },
  ])('cancela ese pedido no abre otro (agent $agent)', async ({ menu, agent }) => {
    const { h, cancel, create } = registered(menu as typeof products, agent);
    const reply = await h.sendQueued('Cancela ese pedido');
    expect(cancel).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(h.cartRows()).toHaveLength(0);
    expect(h.conv.state).toBe('completed');
    expect(reply || '').toMatch(/#18/);
    expect(reply || '').toMatch(/preparaci[oó]n/i);
    expect(reply || '').toMatch(/no lo cancelo/i);
    expect(reply || '').not.toMatch(/cu[aá]l prefieres|qu[eé] se te antoja|armamos otro|qued[oó] cancelado/i);
  });

  it.each([
    { menu: products, agent: true },
    { menu: products, agent: false },
    { menu: pasta, agent: true },
    { menu: pasta, agent: false },
  ])('en cuánto llega usa el pedido de hoy (agent $agent)', async ({ menu, agent }) => {
    const { h, create } = registered(menu as typeof products, agent);
    const reply = await h.sendQueued('En cuánto llega');
    expect(create).not.toHaveBeenCalled();
    expect(h.cartRows()).toHaveLength(0);
    expect(h.conv.state).toBe('completed');
    expect(reply || '').toMatch(/#18/);
    expect(reply || '').toMatch(/preparaci[oó]n/i);
    expect(reply || '').not.toMatch(/cu[aá]l prefieres|qu[eé] se te antoja|armamos otro/i);
  });
});

describe('Cambio a recogida — conserva pendientes y exige confirmación',()=>{
  function setup() {
    const h=harness(products,true);
    h.conv.sessionData.cart=[{productId:17,name:'Churrasco',code:17,unitPrice:38000,quantity:1}];
    Object.assign(h.conv.sessionData,{orderType:'delivery',address:'Calle 12 #30-40',addressConfirmed:true,fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,paymentMethod:'cash',notesCollected:true});
    h.service.ordersService.create=jest.fn();
    h.service.paymentsService.createPreference=jest.fn();
    return h;
  }
  it('cambiar entrega desde confirmación final no registra la orden',async()=>{
    const h=setup();h.conv.state='awaiting_final_confirm';
    await h.sendQueued('Paso a recoger');
    expect(h.conv.sessionData.orderType).toBe('pickup');
    expect(h.conv.state).toBe('awaiting_final_confirm');
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    expect(h.replies.at(-1)).toMatch(/confirmar/i);
  });
  it('la selección de otro plato pendiente sigue después de cambiar entrega',async()=>{
    const h=setup();h.conv.state='building_cart';
    h.conv.sessionData.pendingMatch={query:'Dos ejecutivos',intent:'order',quantity:2,candidates:products.filter(p=>[18,22].includes(p.id))};
    const pending=structuredClone(h.conv.sessionData.pendingMatch);
    const cart=structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('Paso a recoger');
    expect(h.conv.sessionData.orderType).toBe('pickup');
    expect(h.conv.sessionData.pendingMatch).toEqual(pending);
    expect(h.conv.sessionData.cart).toEqual(cart);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
  it('un link activo no se reemite ni cambia la entrega silenciosamente',async()=>{
    const h=setup();h.conv.state='awaiting_mp_payment';h.conv.sessionData.mpPreferenceId='test-preference';
    const before=structuredClone(h.conv.sessionData);
    await h.sendQueued('Paso a recoger');
    expect(h.conv.sessionData).toEqual(before);
    expect(h.conv.state).toBe('awaiting_mp_payment');
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    expect(h.service.paymentsService.createPreference).not.toHaveBeenCalled();
    expect(h.replies.at(-1)).toMatch(/link.*activo/i);
  });
});

describe('Sin coincidencias — no hay un resto para confirmar',()=>{
  const alt=[{id:12101,code:12101,name:'Taco Al Pastor',price:12000,availableNow:true,hasAttributes:false,attributes:[]}];
  it.each([{menu:products},{menu:alt}])('productos ajenos no piden confirmar un pedido vacío',async ({menu})=>{
    const h=harness(menu,false);
    const reply=await h.sendQueued('hola buenas noches me envias por favor una libra de arroz, dos aceites y un kilo de azúcar');
    expect(h.cartRows()).toEqual([]);
    expect(reply).toMatch(/arroz|aceite|az[uú]car/i);
    expect(reply).toMatch(/men[uú]/i);
    expect(reply).not.toMatch(/Entendí varios platos|El resto|escribe.*s[ií]|buenas noches|me envias/i);
  });
  it('la propuesta parcialmente reconocida conserva la confirmación útil',()=>{
    const h=harness(products,false);
    const reply=h.service.formatMultiOrderProposal({segments:['Un churrasco','un jabón'],confident:[{product:products.find(p=>p.id===17),segment:'Un churrasco',score:100}],ambiguous:[],needsAttributes:[],unresolved:['un jabón'],possibleCustomerNames:[]});
    expect(reply).toMatch(/Churrasco/);
    expect(reply).toMatch(/El resto.*s[ií]/i);
    expect(reply).toMatch(/jab[oó]n/);
  });
  it('pedir productos ajenos no borra un carrito existente',async()=>{
    const h=harness(alt,false);await h.sendQueued('Un taco al pastor');
    const before=structuredClone(h.conv.sessionData.cart);
    const reply=await h.sendQueued('Una libra de arroz, dos aceites y un kilo de azúcar');
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(reply).not.toMatch(/El resto|escribe.*s[ií]/i);
  });
});

describe('Desistimiento y compra nueva — mensaje compuesto o ráfaga',()=>{
  const alt=[
    {id:12201,code:12201,name:'Bowl Mediterraneo',price:18000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Base',options:['Arroz','Quinoa']}]},
    {id:12202,code:12202,name:'Taco Al Pastor',price:12000,availableNow:true,hasAttributes:false,attributes:[]},
  ];
  for(const f of [
    {menu:products,newText:'dos churrascos sin ensalada',newId:17,oldText:'Un pollo frito',oldId:1,note:/sin ensalada/i},
    {menu:alt,newText:'dos bowls mediterraneos con quinoa sin cebolla',newId:12201,oldText:'Un taco al pastor',oldId:12202,note:/sin cebolla/i},
  ].flatMap(f=>[false,true].map(agentEnabled=>({...f,agentEnabled})))) for(const phrase of [
    {apology:'Disculpa, me equivoqué de chat.',lead:'Ahora sí quiero '},
    {apology:'Perdón, ese mensaje era para otra tienda.',lead:'Pero dame '},
    {apology:'Me equivoqué de número.',lead:'Aquí quiero '},
  ]) for(const oldCart of [false,true]) for(const mode of ['mensaje','rafaga','rafagaCompleta']) {
    it(f.newId+' '+phrase.lead+' previo='+oldCart+' '+mode+' agent='+f.agentEnabled,async()=>{
      const h=harness(f.menu,f.agentEnabled);
      if(oldCart) await h.sendQueued(f.oldText);
      const before=structuredClone(h.cartRows());
      await h.sendQueued('Una libra de arroz, dos aceites y un kilo de azúcar');
      if(!f.agentEnabled) expect(h.conv.sessionData.pendingMultiOrder).toBeTruthy();
      const replyStart=h.replies.length;
      if(mode==='mensaje')await h.sendQueued(phrase.apology+' '+phrase.lead+f.newText);
      else{
        jest.useFakeTimers();try{
          const texts=mode==='rafagaCompleta'?['Hola buenas noches, me envías por favor una libra de arroz, dos aceites y un kilo de azúcar',phrase.apology,phrase.lead+f.newText]:[phrase.apology,phrase.lead+f.newText];
          const messages=texts.map((text,i)=>h.service.handleIncoming({waId:'customer',phoneE164:h.conv.phoneE164,messageId:'apology-burst-'+i,messageType:'text',text,timestamp:Date.now()/1000,raw:{}}));
          await jest.advanceTimersByTimeAsync(4000);await Promise.all(messages);
        }finally{jest.useRealTimers();}
      }
      expect(h.cartRows()).toHaveLength(before.length+1);
      expect(h.cartRows()).toEqual(expect.arrayContaining([...before,expect.objectContaining({id:f.newId,qty:2,note:expect.stringMatching(f.note)})]));
      if(f.newId===12201) expect(h.cartRows().find(row=>row.id===f.newId)?.attrs).toContain('Base:Quinoa');
      expect(h.conv.sessionData.pendingMultiOrder).toBeFalsy();
      const output=h.replies.slice(replyStart).join(' ');
      expect(output).not.toMatch(/libra de arroz|aceites|az[uú]car|no es un pedido ni una direcci[oó]n/i);
    });
  }
  for(const f of [
    {menu:products,name:'Churrasco',oldText:'Un pollo frito'},
    {menu:alt,name:'Bowl Mediterraneo',oldText:'Un taco al pastor'},
  ]) for(const oldCart of [false,true]) for(const kind of ['precio','descripcion']) {
    it('después del desistimiento consulta '+kind+' de '+f.name+' previo='+oldCart,async()=>{
      const h=harness(f.menu,false);
      if(oldCart) await h.sendQueued(f.oldText);
      const before=structuredClone(h.conv.sessionData.cart);
      await h.sendQueued('Una libra de arroz, dos aceites y un kilo de azúcar');
      const ask=kind==='precio'?'cuánto cuesta '+f.name:'qué trae '+f.name;
      const reply=await h.sendQueued('Disculpa, me equivoqué de chat. Ahora sí quiero saber '+ask+'?');
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.pendingMultiOrder).toBeFalsy();
      expect(reply).toContain(f.name);
      expect(reply).not.toMatch(/aceites|libra de arroz|az[uú]car|no es un pedido ni una direcci[oó]n/i);
    });
  }

});

describe('Cambio de intención — descarta propuesta y procesa pedido nuevo',()=>{
  const other=[
    {id:12301,code:12301,name:'Taco Al Pastor',price:12000,availableNow:true,hasAttributes:false,attributes:[]},
    {id:12302,code:12302,name:'Bowl Mediterraneo',price:18000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Base',options:['Arroz','Quinoa']}]},
  ];
  for(const f of [
    {menu:products,old:'Un pollo frito',oldId:1,fresh:'dos churrascos sin ensalada',freshId:17,note:/sin ensalada/i},
    {menu:other,old:'Un taco al pastor',oldId:12301,fresh:'dos bowls mediterraneos con quinoa sin cebolla',freshId:12302,note:/sin cebolla/i},
  ]) for(const lead of ['Olvida lo anterior, mejor quiero ','Eso no, dame ','Déjalo, ahora quiero ']) for(const existing of [false,true]) for(const burst of [false,true]) {
    it(f.freshId+' '+lead+' previo='+existing+' ráfaga='+burst,async()=>{
      const h=harness(f.menu,false);
      if(existing)await h.sendQueued(f.old);
      const before=structuredClone(h.cartRows());
      if(existing)expect(before).toEqual([expect.objectContaining({id:f.oldId,qty:1})]);
      await h.sendQueued('Un kilo de azúcar y dos aceites');
      expect(h.conv.sessionData.pendingMultiOrder).toBeTruthy();
      const outputStart=h.replies.length;
      if(!burst)await h.sendQueued(lead+f.fresh);
      else{
        jest.useFakeTimers();try{
          const texts=[lead.replace(/(?:mejor quiero|dame|ahora quiero)\s*$/,''),'Quiero '+f.fresh];
          const jobs=texts.map((text,i)=>h.service.handleIncoming({waId:'customer',phoneE164:h.conv.phoneE164,messageId:'switch-burst-'+i,messageType:'text',text,timestamp:Date.now()/1000,raw:{}}));
          await jest.advanceTimersByTimeAsync(4000);await Promise.all(jobs);
        }finally{jest.useRealTimers();}
      }
      expect(h.cartRows()).toHaveLength(before.length+1);
      expect(h.cartRows()).toEqual(expect.arrayContaining([...before,expect.objectContaining({id:f.freshId,qty:2,note:expect.stringMatching(f.note)})]));
      if(f.freshId===12302)expect(h.cartRows().find(r=>r.id===f.freshId)?.attrs).toContain('Base:Quinoa');
      expect(h.conv.sessionData.pendingMultiOrder).toBeFalsy();
      expect(h.replies.slice(outputStart).join(' ')).not.toMatch(/aceites|az[uú]car|escribe.*s[ií]/i);
    });
  }
});

describe('Pedido grande — conserva unidades y nota al corregir al cerrar',()=>{
  const other=[
    {id:12401,code:12401,name:'Taco Al Pastor',price:14000,availableNow:true,hasAttributes:false,attributes:[]},
    {id:12402,code:12402,name:'Sopa De La Casa',price:9000,availableNow:true,hasAttributes:false,attributes:[]},
  ];
  for(const f of [
    {menu:products,main:'churrascos',side:'sopas de mondongo',mainId:17,sideId:45,note:'sin ensalada'},
    {menu:other,main:'tacos al pastor',side:'sopas de la casa',mainId:12401,sideId:12402,note:'sin cebolla'},
  ]) for(const agent of [false,true]) for(const separator of [', ',' y ','\n']) {
    it(f.mainId+' separador='+JSON.stringify(separator)+' agent='+agent,async()=>{
      const h=harness(f.menu,agent);
      Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164});
      const reply=await h.sendQueued('Hola buenas tardes, me envías por favor 8 '+f.main+' '+f.note+separator+'6 '+f.side+' para la calle 48 sur 87 86');
      expect(h.cartRows()).toHaveLength(2);
      expect(h.cartRows()).toEqual(expect.arrayContaining([
        expect.objectContaining({id:f.mainId,qty:8,note:expect.stringContaining(f.note)}),
        expect.objectContaining({id:f.sideId,qty:6}),
      ]));
      expect(h.conv.sessionData.address).toMatch(/48 sur 87 86/i);
      expect(reply).not.toMatch(/¿.*Algo más|buenas tardes|me envías/i);
      const before=structuredClone(h.cartRows());
      await h.sendQueued('Cambia la dirección a calle 12 30 40 apartamento 201');
      expect(h.cartRows()).toEqual(before);
      expect(h.conv.sessionData.address).toMatch(/12.*30.*40.*201/i);
    });
  }
});

describe('Pedido grande — edición focal conserva las otras líneas',()=>{
  const other=[
    {id:12501,code:12501,name:'Bowl Andino',price:18000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Base',options:['Arroz','Quinoa']}]},
    {id:12502,code:12502,name:'Wrap Oriental',price:16000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Salsa',options:['Suave','Picante']}]},
    {id:12503,code:12503,name:'Te Helado',price:4000,availableNow:true,hasAttributes:false,attributes:[]},
  ];
  const fixtures=[
    {menu:products,order:'8 churrascos y 6 sopas de mondongo y 4 pollos fritos',target:17,quantity:'Deja solo cinco churrascos',note:'Los churrascos sin ensalada por favor',attr:'Los pollos fritos con arepas fritas',attrId:1,attrValue:'Arepas:Fritas',noteValue:/sin ensalada/i},
    {menu:other,order:'8 bowls andinos con quinoa y 6 wraps orientales con salsa suave y 4 te helado',target:12501,quantity:'Deja solo cinco Bowl Andino',note:'Los bowls andinos sin cebolla por favor',attr:'Los wraps orientales con salsa picante',attrId:12502,attrValue:'Salsa:Picante',noteValue:/sin cebolla/i},
  ];
  for(const f of fixtures)for(const agent of [false,true])for(const operation of ['cantidad','nota','atributo']) {
    it(f.target+' '+operation+' agent='+agent,async()=>{
      const h=harness(f.menu,false);
      await h.sendQueued(f.order);
      expect(h.cartRows()).toHaveLength(3);
      expect(h.cartRows().reduce((n,r)=>n+r.qty,0)).toBe(18);
      const before=structuredClone(h.cartRows());
      h.cfg.agentV1Enabled=agent;
      await h.sendQueued(operation==='cantidad'?f.quantity:operation==='nota'?f.note:f.attr);
      expect(h.cartRows()).toHaveLength(before.length);
      const editedId=operation==='atributo'?f.attrId:f.target;
      expect(h.cartRows().filter(r=>r.id!==editedId)).toEqual(before.filter(r=>r.id!==editedId));
      const edited=h.cartRows().find(r=>r.id===editedId)!;
      if(operation==='cantidad')expect(edited).toEqual({...before.find(r=>r.id===editedId),qty:5});
      if(operation==='nota')expect(edited).toEqual({...before.find(r=>r.id===editedId),note:expect.stringMatching(f.noteValue)});
      if(operation==='atributo'){
        expect(edited.qty).toBe(before.find(r=>r.id===editedId)!.qty);
        expect(edited.attrs).toContain(f.attrValue);
      }
      expect(h.replies.at(-1)).not.toMatch(/no manejamos|no entend[ií]/i);
    });
  }
  for(const f of fixtures)for(const agent of [false,true])for(const subset of ['dos sin cebolla y los demás normales','tres sin ensalada y los otros cinco normales']) {
    it('subconjunto sin producto exige aclaración '+f.target+' agent='+agent+' '+subset,async()=>{
      const h=harness(f.menu,false);await h.sendQueued(f.order);
      expect(h.cartRows()).toHaveLength(3);
      const before=structuredClone(h.cartRows());h.cfg.agentV1Enabled=agent;
      await h.sendQueued(subset);
      expect(h.cartRows()).toEqual(before);
      expect(h.replies.at(-1)).toMatch(/cu[aá]l producto/i);
    });
  }
});

describe('Cocinas variadas — exclusión en algunas unidades conserva el pedido',()=>{
  const cuisines=[
    {label:'japonesa',name:'Nigiri De Salmon',other:'Nigiri De Atun',plural:'nigiris de salmon',attr:'Salsa',options:['Soya','Ponzu'],selected:'Ponzu',note:'sin wasabi'},
    {label:'italiana',name:'Pizza Caprese',other:'Pizza Marinara',plural:'pizzas caprese',attr:'Masa',options:['Delgada','Gruesa'],selected:'Gruesa',note:'sin albahaca'},
    {label:'árabe',name:'Shawarma De Cordero',other:'Shawarma De Falafel',plural:'shawarmas de cordero',attr:'Pan',options:['Pita','Lavash'],selected:'Lavash',note:'sin cebolla'},
    {label:'india',name:'Curry De Garbanzos',other:'Curry De Lentejas',plural:'currys de garbanzos',attr:'Picante',options:['Suave','Medio'],selected:'Medio',note:'sin cilantro'},
    {label:'marina',name:'Ceviche De Camaron',other:'Ceviche De Pescado',plural:'ceviches de camaron',attr:'Acompañamiento',options:['Tostadas','Patacones'],selected:'Patacones',note:'sin tomate'},
  ];
  for(const [index,f] of cuisines.entries())for(const agent of [false,true])for(const previousNote of [false,true])for(const format of ['cantidad primero','plato primero']) {
    it(f.label+' '+format+' nota previa='+previousNote+' agent='+agent,async()=>{
      const id=12600+index*10;
      const menu=[
        {id,code:id,name:f.name,price:19000,availableNow:true,hasAttributes:true,attributes:[{attributeName:f.attr,options:f.options}]},
        {id:id+1,code:id+1,name:f.other,price:15000,availableNow:true,hasAttributes:false,attributes:[]},
      ];
      const h=harness(menu,false);
      await h.sendQueued('8 '+f.name+' con '+f.selected);
      await h.sendQueued('3 '+f.other);
      expect(h.cartRows()).toHaveLength(2);
      expect(h.cartRows().find(r=>r.id===id)?.qty).toBe(8);
      // Add a stored kitchen instruction independently of the subset request.
      if(previousNote)h.conv.sessionData.cart.find(r=>r.productId===id)!.note='bien empacado';
      const before=structuredClone(h.cartRows());h.cfg.agentV1Enabled=agent;
      const message=format==='cantidad primero'?'dos de los ocho '+f.plural+' '+f.note+' y los demás normales':'de los ocho '+f.plural+', dos '+f.note+' y los otros seis normales';
      await h.sendQueued(message);
      expect(h.cartRows().filter(r=>r.id!==id)).toEqual(before.filter(r=>r.id!==id));
      const rows=h.cartRows().filter(r=>r.id===id);
      expect(rows).toHaveLength(2);
      expect(rows.reduce((n,r)=>n+r.qty,0)).toBe(8);
      expect(rows).toEqual(expect.arrayContaining([
        expect.objectContaining({qty:2,note:expect.stringContaining(f.note),attrs:[f.attr+':'+f.selected]}),
        expect.objectContaining({qty:6,note:previousNote?'bien empacado':undefined,attrs:[f.attr+':'+f.selected]}),
      ]));
      if(previousNote)expect(rows.find(r=>r.qty===2)?.note).toContain('bien empacado');
      expect(h.replies.at(-1)).not.toMatch(/no manejamos|no entend[ií]/i);
      const split=structuredClone(h.cartRows());await h.sendQueued(message);
      expect(h.cartRows()).toEqual(split);
    });
  }
});

describe('Otras cocinas — subconjunto incoherente no modifica carrito',()=>{
  for(const [index,name] of ['Crepe De Champiñones','Pad Thai De Tofu','Lomo Saltado'].entries())for(const agent of [false,true])for(const request of [
    'nueve de los ocho PLATO sin cilantro y los demás normales',
    'dos de los siete PLATO sin cilantro y los demás normales',
    'dos de los ocho PLATO sin cilantro y los otros cinco normales',
    'dos de los ocho plato inexistente sin cilantro y los demás normales',
  ]){
    it(name+' agent='+agent+' '+request,async()=>{
      const id=12700+index;
      const h=harness([{id,code:id,name,price:22000,availableNow:true,hasAttributes:false,attributes:[]}],false);
      await h.sendQueued('8 '+name);expect(h.cartRows()).toHaveLength(1);expect(h.cartRows()[0].qty).toBe(8);
      const before=structuredClone(h.cartRows());h.cfg.agentV1Enabled=agent;
      await h.sendQueued(request.replace('PLATO',name));
      expect(h.cartRows()).toEqual(before);
      expect(h.replies.at(-1)).toMatch(/cu[aá]ntas unidades|cu[aá]l producto/i);
    });
  }
});

describe('Cocinas nuevas — plato opción y empaque conservan la compra',()=>{
  const fixtures=[
    {name:'Moussaka',attr:'Acompañamiento',options:['Patatas','Ensalada'],choice:'Patatas'},
    {name:'Schnitzel De Cerdo',attr:'Salsa',options:['Champiñones','Mostaza'],choice:'Mostaza'},
    {name:'Bibimbap',attr:'Arroz',options:['Blanco','Integral'],choice:'Integral'},
    {name:'Quesadilla De Hongos',attr:'Tortilla',options:['Maiz','Harina'],choice:'Harina'},
    {name:'Pho De Ternera',attr:'Fideos',options:['Arroz','Huevo'],choice:'Huevo'},
    {name:'Empanada De Carne',attr:'Cocción',options:['Horno','Frita'],choice:'Horno'},
  ];
  for(const [index,f] of fixtures.entries())for(const agent of [false,true])for(const packaging of ['bien empacado','bien empacados','en cajas separadas','']) {
    it(f.name+' agent='+agent+' '+(packaging||'control sin nota'),async()=>{
      const id=12800+index;
      const menu=[{id,code:id,name:f.name,price:23000,availableNow:true,hasAttributes:true,attributes:[{attributeName:f.attr,options:f.options}]}];
      const h=harness(menu,agent);
      const reply=await h.sendQueued('8 '+f.name+' con '+f.choice+(packaging?' '+packaging:'')+' por favor');
      expect(h.cartRows()).toEqual([expect.objectContaining({id,qty:8,attrs:[f.attr+':'+f.choice]})]);
      if(packaging)expect(h.cartRows()[0].note).toContain(packaging);
      expect(reply).toContain(f.name);
      expect(reply).not.toMatch(/no manejamos|no entend[ií]|cu[aá]l prefieres/i);
    });
  }
});

describe('Consulta de cobertura — no es dirección ni cierre del pedido',()=>{
  for(const name of ['Tamales De Elote','Risotto De Setas'])for(const agent of [false,true])for(const state of ['building_cart','awaiting_payment','awaiting_final_confirm'])for(const ask of [
    'Me traen Un pedido hasta El tintal?',
    'Hacen entregas hasta barrio La Floresta?',
    'Quiero saber si llegan a Altavista',
    'Nos llevan un pedido al conjunto Mirador?',
  ]){
    it(name+' '+state+' agent='+agent+' '+ask,async()=>{
      const h=harness([{id:12901,code:12901,name,price:16000,availableNow:true,hasAttributes:false,attributes:[]}],false);
      await h.sendQueued('n Donde estan ubicados');
      if(state!=='building_cart'){
        await h.sendQueued('2 '+name);
        expect(h.cartRows()).toHaveLength(1);
        Object.assign(h.conv.sessionData,{address:'Calle 12 30 40',addressConfirmed:true,orderType:'delivery',phoneConfirmed:true,paymentMethod:state==='awaiting_final_confirm'?'cash':undefined});
      }
      h.conv.state=state;h.cfg.agentV1Enabled=agent;
      const before=structuredClone(h.conv.sessionData);
      const reply=await h.sendQueued(ask);
      expect(h.conv.sessionData).toEqual(before);
      expect(h.conv.state).toBe(state);
      expect(reply).toMatch(/direcci[oó]n|calle|carrera/i);
      expect(reply).toMatch(/cobertura|confirm|revis|llegamos/i);
      expect(reply).not.toMatch(/anot[eé]|direcci[oó]n lista|qu[eé] m[aá]s necesitas|s[ií], llegamos|\$2[.,]000|c[oó]mo pagas/i);
    });
  }
});

describe('Básicos cotidianos — pregunta de servicio conserva pedido y paso',()=>{
  const questions=[
    {text:'¿Están atendiendo?',answer:/atendiendo|abiertos|horario/i},
    {text:'¿A qué hora cierran?',answer:/horario|23:59/i},
    {text:'¿Dónde queda el local?',answer:/Calle 20 30 40/i},
    {text:'¿Puedo recoger en el local?',answer:/recoger|recogida|local/i},
    {text:'¿Tienen domicilio?',answer:/domicilio/i},
  ];
  for(const name of ['Estofado Irlandes','Baguette De Jamon'])for(const agent of [false,true])for(const state of ['building_cart','awaiting_payment','awaiting_final_confirm'])for(const q of questions){
    it(name+' '+state+' agent='+agent+' '+q.text,async()=>{
      const h=harness([{id:13001,code:13001,name,price:14700,availableNow:true,hasAttributes:false,attributes:[]}],false);
      await h.sendQueued('2 '+name);expect(h.cartRows()).toEqual([expect.objectContaining({id:13001,qty:2})]);
      h.cfg.brandName='Local Ficticio';h.cfg.localContext={restaurantAddress:'Calle 20 30 40',restaurantCity:'Ciudad Ejemplo'};
      Object.assign(h.conv.sessionData,{orderType:'delivery',address:'Carrera 8 12 10',addressConfirmed:true,deliveryFeeCalculated:3500,paymentMethod:state==='awaiting_final_confirm'?'cash':undefined});
      h.cfg.agentV1Enabled=agent;h.conv.state=state;
      const before=structuredClone(h.conv.sessionData);
      const reply=await h.sendQueued(q.text);
      expect(h.conv.sessionData.cart).toEqual(before.cart);
      expect(h.conv.sessionData.address).toBe(before.address);
      expect(h.conv.sessionData.orderType).toBe(before.orderType);
      expect(h.conv.sessionData.paymentMethod).toBe(before.paymentMethod);
      expect(h.conv.state).toBe(state);
      expect(reply).toMatch(q.answer);
      expect(reply).not.toMatch(/no manejamos|no entend[ií]|direcci[oó]n actualizada|c[oó]mo pagas/i);
    });
  }
});

describe('Básicos cotidianos — precio consultado y recogida elegida',()=>{
  for(const name of ['Estofado Irlandes','Baguette De Jamon'])for(const agent of [false,true]){
    async function setup(){
      const h=harness([{id:13002,code:13002,name,price:14700,availableNow:true,hasAttributes:false,attributes:[]}],false);
      await h.sendQueued('2 '+name);expect(h.cartRows()).toEqual([expect.objectContaining({id:13002,qty:2})]);
      h.cfg.agentV1Enabled=agent;h.service.ordersService.create=jest.fn();return h;
    }
    for(const question of ['Cuánto cuesta PLATO?','Eso cuánto vale?','Me dices el precio?']){
      it(name+' precio agent='+agent+' '+question,async()=>{
        const h=await setup();const before=structuredClone(h.cartRows());
        const reply=await h.sendQueued(question.replace('PLATO',name));
        expect(h.cartRows()).toEqual(before);
        expect(reply).toMatch(/14[.,]700|29[.,]400/);
        expect(reply).not.toMatch(/agregu[eé]|no manejamos|no entend[ií]/i);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
      });
    }
    it(name+' consultar recogida y elegirla después agent='+agent,async()=>{
      const h=await setup();Object.assign(h.conv.sessionData,{orderType:'delivery',address:'Carrera 8 12 10',addressConfirmed:true,deliveryFeeCalculated:3500});
      const before=structuredClone(h.cartRows());
      await h.sendQueued('¿Puedo recoger en el local?');
      expect(h.conv.sessionData.orderType).toBe('delivery');
      await h.sendQueued('Paso a recoger');
      expect(h.cartRows()).toEqual(before);
      expect(h.conv.sessionData.orderType).toBe('pickup');
      expect(h.conv.sessionData.deliveryFeeCalculated).toBe(0);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
  }
});

describe('Básicos cotidianos — pregunta y compra explícita juntas',()=>{
  for(const name of ['Estofado Irlandes','Baguette De Jamon'])for(const first of ['¿Están abiertos?','¿Dónde queda el local?'])for(const agent of [false,true]){
    it(first+' Quiero dos '+name+' agent='+agent,async()=>{
      const h=harness([{id:13003,code:13003,name,price:14700,availableNow:true,hasAttributes:false,attributes:[]}],agent);
      h.cfg.localContext={restaurantAddress:'Calle 20 30 40'};
      await h.sendQueued(first+' Quiero dos '+name);
      expect(h.cartRows()).toEqual([expect.objectContaining({id:13003,qty:2})]);
      expect(h.replies.join(' ')).toMatch(first.includes('abiertos')?/atendiendo|abiertos|horario/i:/Calle 20 30 40/i);
    });
  }
});

describe('Cobertura: la calle responde si llegamos', () => {
  const pasta = [{
    id: 12041, code: 12041, name: 'Pasta Carbonara', price: 26000,
    availableNow: true, hasAttributes: false, attributes: [],
  }];

  it.each([
    { menu: products, agent: true, zone: 'hola veci, me traen un pedido hasta el tintal?', street: 'cll 8 92 c 81', follow: 'si llegas alla?' },
    { menu: products, agent: false, zone: 'hola veci, me traen un pedido hasta el tintal?', street: 'cll 8 92 c 81', follow: 'si llegas alla?' },
    { menu: pasta, agent: true, zone: 'Hacen entregas hasta barrio La Floresta?', street: 'Carrera 15 45 20', follow: 'si llegan allá?' },
    { menu: pasta, agent: false, zone: 'Hacen entregas hasta barrio La Floresta?', street: 'Carrera 15 45 20', follow: 'si llegan allá?' },
  ])('la calle y el sí llegas cotizan el domicilio (agent $agent)', async ({ menu, agent, zone, street, follow }) => {
    const h = harness(menu as typeof products, agent);
    const asked = await h.sendQueued(zone);
    expect(h.conv.sessionData.address || '').toBe('');
    expect(asked || '').toMatch(/calle y n[uú]mero|direcci[oó]n/i);
    expect(asked || '').not.toMatch(/\$2[.,]000/);

    const noted = await h.sendQueued(street);
    expect(h.cartRows()).toHaveLength(0);
    expect(h.conv.sessionData.address || '').toMatch(/92|15/);
    expect(noted || '').toMatch(/llegamos/i);
    expect(noted || '').toMatch(/2[.,]000/);
    expect(noted || '').not.toMatch(/qu[eé] m[aá]s necesitas/i);

    const again = await h.sendQueued(follow);
    expect(h.cartRows()).toHaveLength(0);
    expect(again || '').toMatch(/llegamos/i);
    expect(again || '').toMatch(/2[.,]000/);
    expect(again || '').not.toMatch(/^¿Qué se te antoja/);
  });
});

describe('Básicos de mostrador — repetir, total, efectivo y local', () => {
  const ramen = [{
    id: 13111, code: 13111, name: 'Ramen De Miso', price: 22000,
    availableNow: true, hasAttributes: false, attributes: [],
  }];
  const cases = [
    { menu: products, order: 'Un churrasco', dish: /churrasco/i, money: /38[.\s]000/, agent: true },
    { menu: products, order: 'Un churrasco', dish: /churrasco/i, money: /38[.\s]000/, agent: false },
    { menu: ramen, order: 'Un ramen de miso', dish: /ramen/i, money: /22[.\s]000/, agent: true },
    { menu: ramen, order: 'Un ramen de miso', dish: /ramen/i, money: /22[.\s]000/, agent: false },
  ];

  it.each(cases)('qué llevo no agrega otro plato (agent $agent)', async ({ menu, order, dish, agent }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    await h.sendQueued(order);
    const before = h.cartRows();
    expect(before).toHaveLength(1);
    const reply = await h.sendQueued('Qué llevo?');
    expect(h.cartRows()).toEqual(before);
    expect(h.conv.sessionData.paymentMethod).toBeFalsy();
    expect(reply || '').toMatch(dish);
    expect(reply || '').toMatch(/llevas|pedido/i);
    expect(reply || '').not.toMatch(/no manejamos|cu[aá]l prefieres/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each(cases)('el total sale del carrito (agent $agent)', async ({ menu, order, money, agent }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    await h.sendQueued(order);
    const before = h.cartRows();
    const reply = await h.sendQueued('Cuánto va el total?');
    expect(h.cartRows()).toEqual(before);
    expect(reply || '').toMatch(money);
    expect(reply || '').toMatch(/total/i);
    expect(reply || '').toMatch(/sigue igual/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each(cases)('preguntar por efectivo no lo elige (agent $agent)', async ({ menu, order, agent }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    await h.sendQueued(order);
    const before = h.cartRows();
    const reply = await h.sendQueued('Aceptan efectivo?');
    expect(h.cartRows()).toEqual(before);
    expect(h.conv.sessionData.paymentMethod).toBeFalsy();
    expect(h.conv.state).toBe('building_cart');
    expect(reply || '').toMatch(/efectivo|contraentrega/i);
    expect(reply || '').toMatch(/no lo dejo elegido/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each(cases)('el parqueadero no es un plato (agent $agent)', async ({ menu, order, dish, agent }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    await h.sendQueued(order);
    const before = h.cartRows();
    const reply = await h.sendQueued('Tienen parqueadero?');
    expect(h.cartRows()).toEqual(before);
    expect(reply || '').toMatch(/local/i);
    expect(reply || '').toMatch(dish);
    expect(reply || '').not.toMatch(/no manejamos|cu[aá]l prefieres|s[ií], hay parqueadero/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each(cases)('me repites el pedido (agent $agent)', async ({ menu, order, dish, agent }) => {
    const h = harness(menu as typeof products, agent);
    await h.sendQueued(order);
    const before = h.cartRows();
    const reply = await h.sendQueued('Me repites el pedido');
    expect(h.cartRows()).toEqual(before);
    expect(reply || '').toMatch(dish);
    expect(reply || '').toMatch(/llevas/i);
    expect(reply || '').not.toMatch(/cu[aá]l prefieres/i);
  });

  it.each(cases)('el wifi no se inventa ni se pide (agent $agent)', async ({ menu, order, agent }) => {
    const h = harness(menu as typeof products, agent);
    await h.sendQueued(order);
    const before = h.cartRows();
    const reply = await h.sendQueued('Hay wifi?');
    expect(h.cartRows()).toEqual(before);
    expect(reply || '').toMatch(/local/i);
    expect(reply || '').not.toMatch(/s[ií], hay wifi|no manejamos|cu[aá]l prefieres/i);
  });

  it.each(cases)('cuánto suma usa el carrito (agent $agent)', async ({ menu, order, money, agent }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    await h.sendQueued(order);
    const before = h.cartRows();
    const reply = await h.sendQueued('Cuánto suma?');
    expect(h.cartRows()).toEqual(before);
    expect(reply || '').toMatch(money);
    expect(reply || '').toMatch(/total/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('Datos del cliente — consulta conserva el campo y permite continuarlo',()=>{
  for(const name of ['Jollof De Verduras','Pastel De Choclo'])for(const agent of [false,true])for(const state of ['awaiting_name','awaiting_phone','awaiting_address'])for(const question of ['¿A qué hora cierran?','¿Dónde queda el local?','¿Aceptan efectivo?']){
    it(name+' '+state+' agent='+agent+' '+question,async()=>{
      const h=harness([{id:13201,code:13201,name,price:18000,availableNow:true,hasAttributes:false,attributes:[]}],false);
      await h.sendQueued('2 '+name);expect(h.cartRows()).toHaveLength(1);
      h.cfg.localContext={restaurantAddress:'Calle 30 40 50'};h.cfg.agentV1Enabled=agent;
      h.conv.customerName=state==='awaiting_name'?'':'Carolina';
      Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,phoneConfirmed:state!=='awaiting_phone',contactPhone:state==='awaiting_phone'?undefined:h.conv.phoneE164,address:state==='awaiting_address'?undefined:'Calle 9 20 30',addressConfirmed:state!=='awaiting_address',paymentMethod:undefined});
      h.conv.state=state;h.service.ordersService.create=jest.fn();
      const before=structuredClone(h.conv.sessionData);const customerBefore=h.conv.customerName;
      const reply=await h.sendQueued(question);
      expect(h.conv.state).toBe(state);
      expect(h.conv.customerName).toBe(customerBefore);
      expect(h.conv.sessionData.cart).toEqual(before.cart);
      expect(h.conv.sessionData.address).toBe(before.address);
      expect(h.conv.sessionData.contactPhone).toBe(before.contactPhone);
      expect(h.conv.sessionData.paymentMethod).toBeUndefined();
      expect(reply).toMatch(question.includes('hora')?/horario|23:59/i:question.includes('Dónde')?/Calle 30 40 50/i:/efectivo|contraentrega/i);
      await h.sendQueued(state==='awaiting_name'?'Carolina':state==='awaiting_phone'?'3001234567':'Calle 15 25 35 apartamento 202');
      expect(h.conv.sessionData.cart).toEqual(before.cart);
      if(state==='awaiting_name')expect(h.conv.customerName).toBe('Carolina');
      if(state==='awaiting_phone')expect(h.conv.sessionData.contactPhone).toMatch(/3001234567/);
      if(state==='awaiting_address')expect(h.conv.sessionData.address).toMatch(/15.*25.*35.*202/);
      expect(h.conv.state).not.toBe(state);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
  }
});

describe('Negocio cerrado — FAQ usa estado efectivo y conserva carrito',()=>{
  for(const name of ['Arepa De Reina Pepiada','Samosa De Verduras'])for(const agent of [false,true])for(const question of ['¿Están atendiendo?','¿A qué hora abren?']){
    it(name+' agent='+agent+' '+question,async()=>{
      const h=harness([{id:13202,code:13202,name,price:12000,availableNow:true,hasAttributes:false,attributes:[]}],false);
      await h.sendQueued('2 '+name);expect(h.cartRows()).toHaveLength(1);
      const before=structuredClone(h.conv.sessionData);h.cfg.agentV1Enabled=agent;
      h.service.businessService.getStatus=jest.fn().mockResolvedValue({isOpen:false,openTime:'09:00',closeTime:'18:00',message:'Cerrado'});
      const reply=await h.sendQueued(question);
      expect(h.conv.sessionData).toEqual(before);
      expect(reply).toMatch(/cerrad/i);expect(reply).toMatch(/09:00.*18:00/);
      expect(reply).not.toMatch(/estamos atendiendo|estamos abiertos/i);
    });
  }
});

describe('Respuesta corta — sin elección pendiente no inventa otra compra',()=>{
  for(const name of ['Gyros De Cordero','Croissant De Almendras'])for(const existing of [false,true])for(const text of ['Sí','No','Ok','Gracias']){
    it(name+' carrito='+existing+' '+text,async()=>{
      const h=harness([{id:13203,code:13203,name,price:19000,availableNow:true,hasAttributes:false,attributes:[]}],false);
      if(existing)await h.sendQueued('2 '+name);
      expect(h.cartRows()).toHaveLength(existing?1:0);
      const before=structuredClone(h.cartRows());h.service.ordersService.create=jest.fn();
      await h.sendQueued(text);
      expect(h.cartRows()).toEqual(before);
      expect(h.conv.sessionData.paymentMethod).toBeFalsy();
      expect(h.conv.state).not.toBe('completed');
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
  }
});

describe('Respuesta corta — lista ambigua necesita elección concreta',()=>{
  for(const names of [['Bao De Cerdo','Bao De Hongos'],['Crepe Dulce','Crepe Salada']])for(const agent of [false,true])for(const text of ['Sí','Ok']){
    it(names.join('/')+' agent='+agent+' '+text,async()=>{
      const menu=names.map((name,index)=>({id:13210+index,code:13210+index,name,price:15000,availableNow:true,hasAttributes:false,attributes:[]}));
      const h=harness(menu,agent);
      h.conv.sessionData.pendingMatch={query:'Quiero dos '+names[0].split(' ')[0],intent:'order',quantity:2,candidates:menu};
      const pending=structuredClone(h.conv.sessionData.pendingMatch);h.service.ordersService.create=jest.fn();
      await h.sendQueued(text);
      expect(h.cartRows()).toEqual([]);
      expect(h.conv.sessionData.pendingMatch).toEqual(pending);
      expect(h.replies.at(-1)).toMatch(/cu[aá]l|elige|n[uú]mero|opci[oó]n/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
  }
});

describe('Interrupciones del checkout — atiende consulta y retoma dato pendiente',()=>{
  for(const name of ['Curry De Garbanzos','Empanada De Espinaca'])for(const agent of [false,true])for(const state of ['awaiting_name','awaiting_phone','awaiting_address','awaiting_payment'])for(const question of ['¿Cuánto cuesta '+name+'?','¿Cuánto suma mi pedido?','¿Qué tengo en el carrito?','¿Qué hay en mi carrito?','¿Qué tengo pedido?']){
    it(name+' '+state+' agent='+agent+' '+question,async()=>{
      const h=harness([{id:13301,code:13301,name,price:18000,availableNow:true,hasAttributes:false,attributes:[]}],false);
      await h.sendQueued('2 '+name);expect(h.cartRows()).toEqual([expect.objectContaining({id:13301,qty:2})]);
      h.cfg.agentV1Enabled=agent;h.conv.customerName=state==='awaiting_name'?'':'Carolina';
      Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,phoneConfirmed:state!=='awaiting_phone',contactPhone:state==='awaiting_phone'?undefined:h.conv.phoneE164,address:state==='awaiting_address'?undefined:'Calle 9 20 30',addressConfirmed:state!=='awaiting_address',deliveryFeeCalculated:2000,paymentMethod:undefined});
      h.conv.state=state;h.service.ordersService.create=jest.fn();const before=structuredClone(h.conv.sessionData);const customer=h.conv.customerName;
      const reply=await h.sendQueued(question);
      expect(h.conv.sessionData.cart).toEqual(before.cart);expect(h.conv.customerName).toBe(customer);
      expect(h.conv.sessionData.address).toBe(before.address);expect(h.conv.sessionData.contactPhone).toBe(before.contactPhone);expect(h.conv.sessionData.paymentMethod).toBeUndefined();expect(h.conv.state).toBe(state);
      expect(reply).toMatch(question.includes('cuesta')?/18[.,]000/:question.includes('suma')?/36[.,]000|38[.,]000/:new RegExp(name,'i'));
      expect(reply).not.toMatch(/no entend[ií]|no me qued[oó] clar|no manejamos/i);
      await h.sendQueued(state==='awaiting_name'?'Carolina':state==='awaiting_phone'?'3001234567':state==='awaiting_address'?'Calle 15 25 35 apartamento 202':'Efectivo');
      expect(h.conv.state).not.toBe(state);expect(h.conv.sessionData.cart).toEqual(before.cart);
      if(state==='awaiting_payment')expect(h.conv.sessionData.paymentMethod).toBeTruthy();
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
  }
  for(const name of ['Curry De Garbanzos','Empanada De Espinaca'])for(const agent of [false,true])for(const state of ['awaiting_name','awaiting_phone','awaiting_address','awaiting_payment']){
    it(name+' cambia cantidad durante '+state+' agent='+agent,async()=>{
      const h=harness([{id:13302,code:13302,name,price:18000,availableNow:true,hasAttributes:false,attributes:[]}],false);
      await h.sendQueued('2 '+name);h.cfg.agentV1Enabled=agent;h.conv.customerName=state==='awaiting_name'?'':'Carolina';
      Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,phoneConfirmed:state!=='awaiting_phone',contactPhone:state==='awaiting_phone'?undefined:h.conv.phoneE164,address:state==='awaiting_address'?undefined:'Calle 9 20 30',addressConfirmed:state!=='awaiting_address',paymentMethod:undefined});
      h.conv.state=state;h.service.ordersService.create=jest.fn();const before=structuredClone(h.conv.sessionData);const customer=h.conv.customerName;
      const reply=await h.sendQueued('Mejor quiero tres '+name);
      expect(h.cartRows()).toEqual([expect.objectContaining({id:13302,qty:3})]);expect(h.conv.customerName).toBe(customer);expect(h.conv.sessionData.address).toBe(before.address);expect(h.conv.sessionData.contactPhone).toBe(before.contactPhone);expect(h.conv.sessionData.paymentMethod).toBeUndefined();
      expect(reply).not.toMatch(/no entend[ií]|no me qued[oó] clar|no manejamos/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
      expect(h.conv.state).toBe(state);
      await h.sendQueued(state==='awaiting_name'?'Carolina':state==='awaiting_phone'?'3001234567':state==='awaiting_address'?'Calle 15 25 35 apartamento 202':'Efectivo');
      expect(h.conv.state).not.toBe(state);expect(h.cartRows()).toEqual([expect.objectContaining({id:13302,qty:3})]);
      if(state==='awaiting_name')expect(h.conv.customerName).toBe('Carolina');
      if(state==='awaiting_phone')expect(h.conv.sessionData.contactPhone).toMatch(/3001234567/);
      if(state==='awaiting_address')expect(h.conv.sessionData.address).toMatch(/15.*25.*35.*202/);
      if(state==='awaiting_payment')expect(h.conv.sessionData.paymentMethod).toBeTruthy();
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
  }
});

describe('Interrupciones con opciones y varios platos — respuesta más recordatorio',()=>{
  const menus=[{dish:'Kebab Vegetal',drink:'Te Helado',flavors:['Durazno','Limon']},{dish:'Gofre Salado',drink:'Batido De Avena',flavors:['Cacao','Vainilla']}];
  for(const f of menus)for(const agent of [false,true]){
    const menu=[{id:13401,code:13401,name:f.dish,price:16000,availableNow:true,hasAttributes:false,attributes:[]},{id:13402,code:13402,name:f.drink,price:7000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:f.flavors}]}];
    for(const question of ['¿Cuánto suma mi pedido?','¿Qué tengo en el carrito?','¿Aceptan efectivo?','¿Cuánto cuesta '+f.dish+'?']){
      it(f.drink+' sabor pendiente agent='+agent+' '+question,async()=>{
        const h=harness(menu,false);await h.sendQueued('2 '+f.dish);
        h.conv.sessionData.pendingAttribute={productId:13402,name:f.drink,code:13402,price:7000,attributes:menu[1].attributes,selected:[],sourceText:'3 '+f.drink,quantity:3};
        h.cfg.agentV1Enabled=agent;const before=structuredClone(h.conv.sessionData);
        const reply=await h.sendQueued(question);
        expect(h.conv.sessionData.cart).toEqual(before.cart);expect(h.conv.sessionData.pendingAttribute).toEqual(before.pendingAttribute);
        expect(reply).toMatch(question.includes('cuesta')?/16[.,]000/:question.includes('suma')?/32[.,]000/:question.includes('carrito')?/Kebab|Gofre/:/efectivo|contraentrega/i);
        expect(reply).toMatch(/Sabor|Durazno|Cacao/i);
        await h.sendQueued(f.flavors[0]);
        expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:13401,qty:2}),expect.objectContaining({id:13402,qty:3,attrs:expect.arrayContaining(['Sabor:'+f.flavors[0]])})]));
      });
      it(f.dish+' selección pendiente agent='+agent+' '+question,async()=>{
        const candidates=[menu[0],{...menu[0],id:13403,code:13403,name:f.dish+' Especial',price:19000}];
        const h=harness(candidates,false);h.cfg.agentV1Enabled=agent;
        h.conv.sessionData.pendingMatch={query:'Quiero dos '+f.dish,intent:'order',quantity:2,candidates};
        const before=structuredClone(h.conv.sessionData.pendingMatch);const reply=await h.sendQueued(question);
        expect(h.cartRows()).toEqual([]);expect(h.conv.sessionData.pendingMatch).toEqual(before);
        expect(reply).toMatch(question.includes('cuesta')?/16[.,]000/:question.includes('suma')?/total|platos/i:question.includes('carrito')?/platos|pedido/i:/efectivo|contraentrega/i);
        expect(reply).toMatch(/Especial|elige|prefieres/i);
        await h.sendQueued('2');expect(h.cartRows()).toEqual([expect.objectContaining({id:13403,qty:2})]);
      });
    }
    for(const state of ['awaiting_name','awaiting_phone','awaiting_address','awaiting_payment'])for(const question of ['¿Cuánto suma mi pedido?','¿Qué tengo en el carrito?','¿Aceptan efectivo?','¿Cuánto cuesta '+f.dish+'?']){
      it(f.dish+' carrito múltiple '+state+' agent='+agent+' '+question,async()=>{
        const h=harness(menu,false);await h.sendQueued('2 '+f.dish);await h.sendQueued('3 '+f.drink+' '+f.flavors[0]);expect(h.cartRows()).toHaveLength(2);
        h.cfg.agentV1Enabled=agent;h.conv.customerName=state==='awaiting_name'?'':'Carolina';
        Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,phoneConfirmed:state!=='awaiting_phone',contactPhone:state==='awaiting_phone'?undefined:h.conv.phoneE164,address:state==='awaiting_address'?undefined:'Calle 9 20 30',addressConfirmed:state!=='awaiting_address',deliveryFeeCalculated:2000,paymentMethod:undefined});
        h.conv.state=state;h.service.ordersService.create=jest.fn();const before=structuredClone(h.conv.sessionData);
        const reply=await h.sendQueued(question);
        expect(h.conv.state).toBe(state);expect(h.conv.sessionData).toEqual(before);
        expect(reply).toMatch(question.includes('cuesta')?/16[.,]000/:question.includes('suma')?/53[.,]000|55[.,]000/:question.includes('carrito')?/Kebab|Gofre/:/efectivo|contraentrega/i);
        expect(reply).toMatch(state==='awaiting_name'?/nombre/i:state==='awaiting_phone'?/tel[eé]fono|n[uú]mero/i:state==='awaiting_address'?/direcci[oó]n/i:/m[eé]todo.*pago|c[oó]mo pagas/i);
        await h.sendQueued(state==='awaiting_name'?'Carolina':state==='awaiting_phone'?'3001234567':state==='awaiting_address'?'Calle 15 25 35 apartamento 202':'Efectivo');
        expect(h.conv.state).not.toBe(state);expect(h.conv.sessionData.cart).toEqual(before.cart);expect(h.service.ordersService.create).not.toHaveBeenCalled();
      });
    }
  }
});

describe('Chat arroz paisa — consultas durante nombre y pago sin capturar preguntas como persona',()=>{
  const fixtures=[{label:'PPP',menu:products,name:'Arroz Paisa'},
    {label:'Poke',name:'Poke De Tofu',menu:[{id:13501,code:13501,name:'Poke De Tofu',price:21000,availableNow:true,hasAttributes:false,attributes:[]},{id:13502,code:13502,name:'Combo De Poke De Tofu',price:27000,availableNow:true,hasAttributes:false,attributes:[]}]},
    {label:'Falafel',name:'Falafel Artesanal',menu:[{id:13503,code:13503,name:'Falafel Artesanal',price:17000,availableNow:true,hasAttributes:false,attributes:[]},{id:13504,code:13504,name:'Combo De Falafel Artesanal',price:24000,availableNow:true,hasAttributes:false,attributes:[]}]}];
  for(const f of fixtures)for(const agent of [false,true])for(const question of ['Que precio tiene','Y eso qué precio tiene?','Me dices cuánto vale?']){
    it(f.label+' secuencia completa agent='+agent+' '+question,async()=>{
      const h=harness(f.menu,false);h.conv.customerName='';await h.sendQueued('Buenas noches');await h.sendQueued('Me regala porfavor un '+f.name);
      expect(h.cartRows()).toHaveLength(1);const before=structuredClone(h.conv.sessionData.cart);h.cfg.agentV1Enabled=agent;
      await h.sendQueued('Calle 40f sur #80D - 59');expect(h.conv.state).toBe('awaiting_name');
      const price=await h.sendQueued(question);
      expect(h.conv.customerName).toBe('');expect(h.conv.state).toBe('awaiting_name');expect(h.conv.sessionData.cart).toEqual(before);
      expect(price).toContain(h.service.catalogService.formatMoney(before[0].unitPrice));expect(price).toMatch(/nombre/i);
      const combo=await h.sendQueued('Pero ese viene en combo o solo ?');
      expect(combo).toMatch(/combo/i);expect(combo).not.toMatch(/no entend[ií]/i);expect(h.conv.customerName).toBe('');expect(h.conv.sessionData.cart).toEqual(before);
      await h.sendQueued('Carolina Ramirez');expect(h.conv.customerName).toBe('Carolina Ramirez');expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.state).toBe('awaiting_payment');
      const again=await h.sendQueued('Que precio tiene');expect(again).toContain(h.service.catalogService.formatMoney(before[0].unitPrice));expect(h.conv.state).toBe('awaiting_payment');expect(h.conv.customerName).toBe('Carolina Ramirez');expect(h.conv.sessionData.cart).toEqual(before);
    });
  }
});

describe('Consulta de precio ambigua — aclaración explícita conserva checkout',()=>{
  for(const names of [['Sushi Vegetal','Gyozas De Hongos'],['Pasta De Lentejas','Crema De Calabaza']])for(const agent of [false,true])for(const state of ['awaiting_name','awaiting_phone','awaiting_address','awaiting_payment']){
    it(names[0]+' '+state+' agent='+agent,async()=>{
      const menu=names.map((name,i)=>({id:13601+i,code:13601+i,name,price:18000+i*3000,availableNow:true,hasAttributes:false,attributes:[]}));
      const h=harness(menu,false);for(const name of names)await h.sendQueued('2 '+name);expect(h.cartRows()).toHaveLength(2);
      h.cfg.agentV1Enabled=agent;h.conv.customerName=state==='awaiting_name'?'':'Carolina';
      Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,phoneConfirmed:state!=='awaiting_phone',contactPhone:state==='awaiting_phone'?undefined:h.conv.phoneE164,address:state==='awaiting_address'?undefined:'Calle 9 20 30',addressConfirmed:state!=='awaiting_address',paymentMethod:undefined});h.conv.state=state;
      const before=structuredClone(h.conv.sessionData),customer=h.conv.customerName;
      const question=await h.sendQueued('Que precio tiene');
      expect(question).toMatch(/cu[aá]l producto/i);expect(question).not.toMatch(/Para seguir/i);expect({...h.conv.sessionData,pendingPriceInquiry:undefined}).toEqual(before);expect(h.conv.customerName).toBe(customer);
      const price=await h.sendQueued('Quiero saber el precio de '+names[1]);
      expect(price).toMatch(/21[.,]000/);expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBe(customer);
      await h.sendQueued(state==='awaiting_name'?'Carolina':state==='awaiting_phone'?'3001234567':state==='awaiting_address'?'Calle 15 25 35 apartamento 202':'Efectivo');
      expect(h.conv.state).not.toBe(state);expect(h.conv.sessionData.cart).toEqual(before.cart);
    });
  }
});

describe('Consulta de precio — respuesta abreviada no compra ni consume el campo',()=>{
  for(const names of [['Sushi Vegetal','Gyozas De Hongos'],['Pasta De Lentejas','Crema De Calabaza']])for(const agent of [false,true])for(const state of ['awaiting_name','awaiting_phone','awaiting_address','awaiting_payment'])for(const answer of [names[1],'el segundo','2','No importa, olvida la pregunta']){
    it(names[0]+' '+state+' agent='+agent+' '+answer,async()=>{
      const menu=names.map((name,i)=>({id:13701+i,code:13701+i,name,price:18000+i*3000,availableNow:true,hasAttributes:false,attributes:[]}));
      const h=harness(menu,false);for(const name of names)await h.sendQueued('2 '+name);h.cfg.agentV1Enabled=agent;h.conv.customerName=state==='awaiting_name'?'':'Carolina';
      Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,phoneConfirmed:state!=='awaiting_phone',contactPhone:state==='awaiting_phone'?undefined:h.conv.phoneE164,address:state==='awaiting_address'?undefined:'Calle 9 20 30',addressConfirmed:state!=='awaiting_address',paymentMethod:undefined});h.conv.state=state;
      const before=structuredClone(h.conv.sessionData),customer=h.conv.customerName;h.service.ordersService.create=jest.fn();
      await h.sendQueued('Que precio tiene');const reply=await h.sendQueued(answer);
      expect(h.conv.sessionData.cart).toEqual(before.cart);expect(h.conv.customerName).toBe(customer);expect(h.conv.state).toBe(state);expect(h.conv.sessionData.paymentMethod).toBeUndefined();
      expect(h.conv.sessionData.contactPhone).toBe(before.contactPhone);expect(h.conv.sessionData.address).toBe(before.address);
      if(answer.startsWith('No importa'))expect(reply).toMatch(/pedido sigue igual/i);else expect(reply).toMatch(/21[.,]000/);
      await h.sendQueued(state==='awaiting_name'?'Carolina':state==='awaiting_phone'?'3001234567':state==='awaiting_address'?'Calle 15 25 35 apartamento 202':'Efectivo');
      expect(h.conv.state).not.toBe(state);expect(h.conv.sessionData.cart).toEqual(before.cart);expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
  }
});

describe('Consulta de precio — contexto temporal y respuestas inválidas',()=>{
  for(const agent of [false,true])for(const answer of ['9','el tercero','otra consulta','repetir','desistir','acción']){
    it('agent='+agent+' '+answer,async()=>{
      const menu=[{id:13801,code:13801,name:'Cuscus Vegetal',price:15000,availableNow:true,hasAttributes:false,attributes:[]},{id:13802,code:13802,name:'Tabule Casero',price:19000,availableNow:true,hasAttributes:false,attributes:[]}];
      const h=harness(menu,false);await h.sendQueued('2 Cuscus Vegetal');await h.sendQueued('2 Tabule Casero');h.cfg.agentV1Enabled=agent;
      Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,address:'Calle 9 20 30',addressConfirmed:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,paymentMethod:undefined});h.conv.state='awaiting_payment';
      const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued('Que precio tiene');
      if(answer==='acción'){
        await h.sendQueued('Mejor quiero tres Tabule Casero');expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:13802,qty:3})]));
        await h.sendQueued('Efectivo');expect(h.conv.sessionData.paymentMethod).toBeTruthy();expect(h.conv.sessionData.pendingPriceInquiry).toBeUndefined();return;
      }
      await h.sendQueued(answer==='otra consulta'?'¿Cuánto suma mi pedido?':answer==='repetir'?'Que precio tiene':answer==='desistir'?'No gracias':answer);
      expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.state).toBe('awaiting_payment');expect(h.conv.sessionData.paymentMethod).toBeUndefined();
      if(answer==='desistir'){
        expect(h.conv.sessionData.pendingPriceInquiry).toBeUndefined();await h.sendQueued('2');expect(h.conv.sessionData.paymentMethod).toBeTruthy();
      }else{
        expect(h.conv.sessionData.pendingPriceInquiry).toBeTruthy();const reply=await h.sendQueued('2');expect(reply).toMatch(/19[.,]000/);expect(h.conv.sessionData.paymentMethod).toBeUndefined();expect(h.conv.sessionData.pendingPriceInquiry).toBeUndefined();
      }
      expect(h.conv.sessionData.cart).toEqual(before);
    });
  }
});

describe('Consulta de precio — nuevo dato válido termina aclaración',()=>{
  for(const agent of [false,true])for(const state of ['awaiting_name','awaiting_phone','awaiting_address','awaiting_payment']){
    it(state+' agent='+agent,async()=>{
      const menu=['Burrito Vegetal','Nachos Caseros'].map((name,i)=>({id:13901+i,code:13901+i,name,price:15000+i*3000,availableNow:true,hasAttributes:false,attributes:[]}));
      const h=harness(menu,false);for(const p of menu)await h.sendQueued('2 '+p.name);h.cfg.agentV1Enabled=agent;h.conv.customerName=state==='awaiting_name'?'':'Carolina';
      Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,phoneConfirmed:state!=='awaiting_phone',contactPhone:state==='awaiting_phone'?undefined:h.conv.phoneE164,address:state==='awaiting_address'?undefined:'Calle 9 20 30',addressConfirmed:state!=='awaiting_address',paymentMethod:undefined});h.conv.state=state;const before=structuredClone(h.conv.sessionData.cart);
      await h.sendQueued('Que precio tiene');expect(h.conv.sessionData.pendingPriceInquiry).toBeTruthy();
      await h.sendQueued(state==='awaiting_name'?'Carolina':state==='awaiting_phone'?'3001234567':state==='awaiting_address'?'Calle 15 25 35 apartamento 202':'Efectivo');
      expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingPriceInquiry).toBeUndefined();expect(h.conv.state).not.toBe(state);
      if(state==='awaiting_phone')expect(h.conv.sessionData.contactPhone).toMatch(/3001234567/);
    });
  }
});

describe('Resumen de pedido — dirección una sola vez sin perder detalles',()=>{
  for(const name of ['Pollo Broaster Ficticio','Bowl De Quinoa']){
    async function setup(){
      const h=harness([{id:14001,code:14001,name,price:18000,availableNow:true,hasAttributes:false,attributes:[]}],false);await h.sendQueued('2 '+name);
      Object.assign(h.conv.sessionData.cart[0],{note:'sin ensalada',attributes:[{attributeName:'Preparacion',attributeValue:'Suave'}]});
      Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,address:'Calle 48 sur 87 86',addressConfirmed:true,deliveryFeeCalculated:6000,deliveryDistanceKm:4.6,phoneConfirmed:true,contactPhone:h.conv.phoneE164});return h;
    }
    for(const type of ['delivery','pickup'])for(const payment of [undefined,'cash']){
      it(name+' resumen '+type+' pago='+payment,async()=>{
        const h=await setup();h.conv.sessionData.orderType=type as any;h.conv.sessionData.paymentMethod=payment;
        if(type==='pickup')h.conv.sessionData.address='Recoge en el local';
        const before=structuredClone(h.conv.sessionData);const reply=h.service.formatOrderSummary(h.conv,h.conv.sessionData,6000,h.cfg.paymentMethods);
        expect(reply.split(h.conv.sessionData.address).length-1).toBe(1);
        expect(reply).toContain(name);expect(reply).toMatch(/sin ensalada/);expect(reply).toMatch(/Preparacion: Suave/);expect(reply).toMatch(/36[.,]000/);
        expect(reply).toMatch(type==='delivery'?/42[.,]000/:/36[.,]000/);expect(reply).toMatch(/Nombre:|Tel[eé]fono:|Pago:/);expect(h.conv.sessionData).toEqual(before);
      });
    }
    it(name+' carrito independiente conserva dirección',async()=>{
      const h=await setup();const reply=h.service.formatCartOnly(h.conv.sessionData,6000);expect((reply || '').split('Calle 48 sur 87 86').length-1).toBe(1);
    });
    it(name+' dirección seguida de pago no repite dirección en prefacio',async()=>{
      const h=await setup();h.conv.sessionData.address=undefined;h.conv.sessionData.addressConfirmed=false;h.conv.sessionData.paymentMethod=undefined;h.conv.state='awaiting_address';
      const before=structuredClone(h.conv.sessionData.cart);const reply=await h.sendQueued('Calle 48 sur 87 86');
      expect((reply || '').split('Calle 48 sur 87 86').length-1).toBe(1);expect(reply).toMatch(/c[oó]mo pagas/i);expect(reply).toMatch(/sin ensalada|Preparacion: Suave/);expect(h.conv.sessionData.cart).toEqual(before);
    });
  }
});

describe('Cancelar selección pendiente — distingue bebida de pedido completo',()=>{
  for(const f of [{food:'Arepa De Frijoles',drink:'Infusion Fria',flavors:['Durazno','Limon']},{food:'Tarta De Espinaca',drink:'Smoothie Vegetal',flavors:['Cacao','Vainilla']}])for(const agent of [false,true])for(const pending of ['sabor','producto'])for(const text of ['Olvida eso','No quiero esa bebida','Cancela esa selección','Vacía todo el pedido']){
    it(f.food+' '+pending+' agent='+agent+' '+text,async()=>{
      const menu=[{id:14101,code:14101,name:f.food,price:17000,availableNow:true,hasAttributes:false,attributes:[]},{id:14102,code:14102,name:f.drink,price:7000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:f.flavors}]},{id:14103,code:14103,name:f.drink+' Especial',price:9000,availableNow:true,hasAttributes:false,attributes:[]}];
      const h=harness(menu,false);await h.sendQueued('2 '+f.food);h.conv.sessionData.cart[0].note='sin ensalada';
      if(pending==='sabor')h.conv.sessionData.pendingAttribute={productId:14102,name:f.drink,code:14102,price:7000,attributes:menu[1].attributes,selected:[],quantity:3,sourceText:'3 '+f.drink};
      else h.conv.sessionData.pendingMatch={query:'3 '+f.drink,intent:'order',quantity:3,candidates:menu.slice(1)};
      h.cfg.agentV1Enabled=agent;h.service.ordersService.create=jest.fn();const before=structuredClone(h.conv.sessionData.cart);const name=h.conv.customerName;
      const reply=await h.sendQueued(text);
      expect(h.conv.sessionData.pendingAttribute).toBeFalsy();expect(h.conv.sessionData.pendingMatch).toBeFalsy();
      expect(h.conv.customerName).toBe(name);expect(h.conv.sessionData.paymentMethod).toBeFalsy();
      if(text.startsWith('Vacía'))expect(h.cartRows()).toEqual([]);
      else{
        expect(h.conv.sessionData.cart).toEqual(before);expect(reply).toMatch(/pendiente|selecci[oó]n|bebida/i);
        await h.sendQueued(f.flavors[0]);expect(h.cartRows().some(row=>[14102,14103].includes(row.id))).toBe(false);
        expect(h.conv.sessionData.cart).toEqual(before);
      }
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
  }
});

describe('Cancelar selección pendiente — bebida de un plato compuesto necesita aclaración',()=>{
  for(const agent of [false,true])for(const name of ['Menu De Legumbres','Combo De Falafel']){
    it(name+' agent='+agent,async()=>{
      const base={id:14201,code:14201,name:'Ensalada De Quinoa',price:14000,availableNow:true,hasAttributes:false,attributes:[]};
      const compound={id:14202,code:14202,name,price:23000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sopa',options:['Calabaza','Lentejas']},{attributeName:'Bebida',options:['Agua','Te']} ]};
      const h=harness([base,compound],false);await h.sendQueued('2 Ensalada De Quinoa');h.cfg.agentV1Enabled=agent;
      h.conv.sessionData.pendingAttribute={productId:14202,name,code:14202,price:23000,attributes:compound.attributes,selected:[{attributeName:'Sopa',attributeValue:'Lentejas'}],quantity:3,sourceText:'3 '+name};
      const before=structuredClone(h.conv.sessionData);const reply=await h.sendQueued('No quiero esa bebida');
      expect(h.conv.sessionData).toEqual(before);expect(reply).toMatch(/cambiar la bebida.*cancelar el plato/i);
      await h.sendQueued('Cancela esa selección');expect(h.conv.sessionData.pendingAttribute).toBeUndefined();expect(h.conv.sessionData.cart).toEqual(before.cart);
      await h.sendQueued('Agua');expect(h.conv.sessionData.cart).toEqual(before.cart);expect(h.conv.sessionData.pendingAttribute).toBeUndefined();
    });
  }
});

describe('Cancelación con cortesía y typos — selección sin borrar carrito',()=>{
  for(const drink of ['Bebida De Citricos','Granizado De Frutas'])for(const agent of [false,true])for(const text of ['Por favor, olvida eso','Olvida eso porfa','No quiero esa bebida muchas gracias','Cancela esa selección por favor','Cansela esa seleccion','Cancela esa selecsion']){
    it(drink+' agent='+agent+' '+text,async()=>{
      const menu=[{id:14301,code:14301,name:'Sandwich De Verduras',price:14000,availableNow:true,hasAttributes:false,attributes:[]},{id:14302,code:14302,name:drink,price:7000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mango','Limon']}]}];
      const h=harness(menu,false);await h.sendQueued('2 Sandwich De Verduras');h.cfg.agentV1Enabled=agent;
      h.conv.sessionData.pendingAttribute={productId:14302,name:drink,code:14302,price:7000,attributes:menu[1].attributes,selected:[],quantity:3,sourceText:'3 '+drink};
      const before=structuredClone(h.conv.sessionData.cart);const reply=await h.sendQueued(text);
      expect(h.conv.sessionData.pendingAttribute).toBeUndefined();expect(h.conv.sessionData.cart).toEqual(before);expect(reply).toMatch(/cancel[eé].*selecci[oó]n/i);
    });
  }
});

describe('Cancelar edición de sabor — conserva opciones originales',()=>{
  for(const names of [['Refresco De Frutas','Batido De Avena'],['Yogur Artesanal','Helado Casero']])for(const agent of [false,true])for(const text of ['Olvida ese cambio','Cancela ese cambio por favor','No cambies el sabor']){
    it(names[0]+' agent='+agent+' '+text,async()=>{
      const menu=names.map((name,i)=>({id:14401+i,code:14401+i,name,price:7000+i*3000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mango','Limon']}]}));
      const h=harness(menu,false);await h.sendQueued('2 '+names[0]+' Mango');await h.sendQueued('3 '+names[1]+' Mango');expect(h.cartRows()).toHaveLength(2);h.cfg.agentV1Enabled=agent;
      const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued('Cambia el sabor a Limon');expect(h.conv.sessionData.pendingCartAttributeEdit).toBeTruthy();expect(h.conv.sessionData.cart).toEqual(before);
      const reply=await h.sendQueued(text);expect(h.conv.sessionData.pendingCartAttributeEdit).toBeUndefined();expect(h.conv.sessionData.cart).toEqual(before);expect(reply).toMatch(/cambio|original/i);
      await h.sendQueued('2');expect(h.conv.sessionData.cart).toEqual(before);
      await h.sendQueued(names[0]+' Limon');expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:14401,qty:2,attrs:expect.arrayContaining(['Sabor:Limon'])}),expect.objectContaining({id:14402,qty:3,attrs:expect.arrayContaining(['Sabor:Mango'])})]));
    });
  }
});

describe('Edición pendiente — otros atributos, consulta y negación',()=>{
  for(const attribute of ['Preparacion','Coccion'])for(const agent of [false,true])for(const kind of ['cancelar','consulta','no cancelar']){
    it(attribute+' agent='+agent+' '+kind,async()=>{
      const menu=['Bowl De Lentejas','Pisto De Verduras'].map((name,i)=>({id:14501+i,code:14501+i,name,price:13000+i*2000,availableNow:true,hasAttributes:true,attributes:[{attributeName:attribute,options:['Suave','Intenso']}]}));
      const h=harness(menu,false);for(const p of menu)await h.sendQueued('2 '+p.name+' Suave');expect(h.cartRows()).toHaveLength(2);h.cfg.agentV1Enabled=agent;
      const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued('Cambia la '+attribute+' a Intenso');expect(h.conv.sessionData.pendingCartAttributeEdit).toBeTruthy();const pending=structuredClone(h.conv.sessionData.pendingCartAttributeEdit);
      const reply=await h.sendQueued(kind==='cancelar'?'No cambies la '+attribute:kind==='consulta'?'¿Cuánto suma mi pedido?':'No canceles ese cambio');
      expect(h.conv.sessionData.cart).toEqual(before);
      if(kind==='cancelar')expect(h.conv.sessionData.pendingCartAttributeEdit).toBeUndefined();
      else{
        expect(h.conv.sessionData.pendingCartAttributeEdit).toEqual(pending);
        if(kind==='consulta'){expect(reply).toMatch(/56[.,]000/);expect(reply).toMatch(/continuar el cambio|elige el plato/i);}
        await h.sendQueued('2');expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:14501,qty:2,attrs:expect.arrayContaining([attribute+':Suave'])}),expect.objectContaining({id:14502,qty:2,attrs:expect.arrayContaining([attribute+':Intenso'])})]));
      }
    });
  }
});

describe('Edición por número — nombre del plato no cambia opción solicitada',()=>{
  for(const names of [['Yogur De Mango','Batido De Mango'],['Tarta De Mango','Helado De Mango']])for(const agent of [false,true]){
    it(names[0]+' agent='+agent,async()=>{
      const menu=names.map((name,i)=>({id:14601+i,code:14601+i,name,price:9000+i*3000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mango','Limon']}]}));
      const h=harness(menu,false);for(const p of menu)await h.sendQueued('2 '+p.name+' Mango');h.cfg.agentV1Enabled=agent;const before=structuredClone(h.conv.sessionData.cart);
      await h.sendQueued('Cambia el sabor a Limon');expect(h.conv.sessionData.pendingCartAttributeEdit).toBeTruthy();expect(h.conv.sessionData.cart).toEqual(before);
      await h.sendQueued('2');expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:14601,qty:2,attrs:expect.arrayContaining(['Sabor:Mango'])}),expect.objectContaining({id:14602,qty:2,attrs:expect.arrayContaining(['Sabor:Limon'])})]));
    });
  }
});

describe('Sustitución pendiente — cancelar restaura y completar conserva cantidad y notas',()=>{
  for(const name of ['Wrap Mediterraneo','Sandwich De Setas'])for(const agent of [false,true])for(const finish of ['cancelar','completar']){
    it(name+' agent='+agent+' '+finish,async()=>{
      const base={id:14701,code:14701,name,price:18000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Salsa',options:['Picante','Dulce']}]};
      const combo={id:14702,code:14702,name:'Combo De '+name,price:25000,availableNow:true,hasAttributes:true,attributes:[...base.attributes,{attributeName:'Empaque',options:['Caja','Bolsa']}]};
      const extra={id:14703,code:14703,name:'Porcion De Patatas',price:4000,availableNow:true,hasAttributes:false,attributes:[]};
      const h=harness([base,combo,extra],false);await h.sendQueued('2 Porcion De Patatas');await h.sendQueued('3 '+name+' Picante');expect(h.cartRows()).toHaveLength(2);
      h.conv.sessionData.cart.find(line=>line.productId===14701)!.note='sin cebolla';h.cfg.agentV1Enabled=agent;const before=structuredClone(h.conv.sessionData.cart);
      await h.sendQueued('Lo quiero en combo');expect(h.conv.sessionData.pendingAttribute?.productId).toBe(14702);
      await h.sendQueued('¿Cuánto cuesta '+combo.name+'?');
      if(finish==='cancelar'){
        const reply=await h.sendQueued('Olvida ese cambio');expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingAttribute).toBeUndefined();expect(reply).toMatch(/original|restaur|cambio/i);
      }else{
        await h.sendQueued('Picante Caja');expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:14703,qty:2}),expect.objectContaining({id:14702,qty:3,note:'sin cebolla',attrs:expect.arrayContaining(['Salsa:Picante','Empaque:Caja'])})]));
        expect(h.cartRows().some(row=>row.id===14701)).toBe(false);expect(h.cartRows()).toHaveLength(2);
      }
    });
  }
});

describe('Sustitución a combo — varias líneas, solo y carta real', () => {
  const tacos = [
    { id: 14811, code: 14811, name: 'Taco Al Pastor', price: 16000, availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Salsa', options: ['Roja', 'Verde'] }] },
    { id: 14812, code: 14812, name: 'Combo De Taco Al Pastor', price: 23000, availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Salsa', options: ['Roja', 'Verde'] }, { attributeName: 'Empaque', options: ['Caja', 'Bolsa'] }] },
    { id: 14813, code: 14813, name: 'Agua De Horchata', price: 5000, availableNow: true, hasAttributes: false, attributes: [] },
  ];

  it.each([false, true])('dos líneas del mismo plato no se cambian juntas (agent %s)', async (agent) => {
    const h = harness(tacos, agent);
    await h.sendQueued('2 Taco Al Pastor Roja');
    const line = h.conv.sessionData.cart.find((row) => row.productId === 14811)!;
    h.conv.sessionData.cart.push({ ...structuredClone(line), quantity: 1, note: 'sin cebolla' });
    const before = structuredClone(h.conv.sessionData.cart);
    const reply = await h.sendQueued('Lo quiero en combo');
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.conv.sessionData.pendingAttribute).toBeUndefined();
    expect(reply || '').toMatch(/varias líneas/i);
    expect(reply || '').toMatch(/sigue igual/i);
  });

  it.each([false, true])('cancela ese cambio deja el taco original (agent %s)', async (agent) => {
    const h = harness(tacos, false);
    await h.sendQueued('3 Taco Al Pastor Roja');
    h.conv.sessionData.cart[0].note = 'sin cebolla';
    h.cfg.agentV1Enabled = agent;
    const before = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('Lo quiero en combo');
    expect(h.conv.sessionData.pendingAttribute?.productId).toBe(14812);
    const reply = await h.sendQueued('Cancela ese cambio');
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.conv.sessionData.pendingAttribute).toBeUndefined();
    expect(reply || '').toMatch(/original|cambio/i);
  });

  it.each([false, true])('el precio del combo no suelta el cambio pendiente (agent %s)', async (agent) => {
    const h = harness(tacos, false);
    await h.sendQueued('3 Taco Al Pastor Roja');
    h.cfg.agentV1Enabled = agent;
    const before = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('Lo quiero en combo');
    const reply = await h.sendQueued('¿Cuánto cuesta Combo De Taco Al Pastor?');
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.conv.sessionData.pendingAttribute?.productId).toBe(14812);
    expect(reply || '').toMatch(/23[.,]000/);
  });

  it.each([
    { menu: products, order: 'Un arroz paisa', fromId: 35, toId: 94, agent: false },
    { menu: products, order: 'Un arroz paisa', fromId: 35, toId: 94, agent: true },
    { menu: tacos, order: '2 Taco Al Pastor Roja', fromId: 14811, toId: 14812, agent: false },
    { menu: tacos, order: '2 Taco Al Pastor Roja', fromId: 14811, toId: 14812, agent: true },
  ])('pasar a combo reemplaza la línea (agent $agent)', async ({ menu, order, fromId, toId, agent }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    await h.sendQueued(order);
    const qty = h.cartRows().find((row) => row.id === fromId)?.qty;
    expect(qty).toBeGreaterThan(0);
    await h.sendQueued('Lo quiero en combo');
    if (h.conv.sessionData.pendingAttribute?.productId === toId) {
      expect(h.cartRows().some((row) => row.id === toId)).toBe(false);
      await h.sendQueued(toId === 94 ? 'Uva' : 'Roja Caja');
    }
    expect(h.cartRows().filter((row) => row.id === fromId)).toEqual([]);
    expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({ id: toId, qty })]));
    expect(h.cartRows()).toHaveLength(1);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each([
    { menu: products, combo: 'Un combo de arroz paisa', drink: 'Uva', fromId: 94, toId: 35, agent: false },
    { menu: products, combo: 'Un combo de arroz paisa', drink: 'Uva', fromId: 94, toId: 35, agent: true },
    { menu: tacos, combo: '2 Combo De Taco Al Pastor', drink: 'Roja Caja', fromId: 14812, toId: 14811, agent: false },
    { menu: tacos, combo: '2 Combo De Taco Al Pastor', drink: 'Roja Caja', fromId: 14812, toId: 14811, agent: true },
  ])('volver a solo no deja las dos presentaciones (agent $agent)', async ({ menu, combo, drink, fromId, toId, agent }) => {
    const h = harness(menu as typeof products, agent);
    await h.sendQueued(combo);
    if (h.conv.sessionData.pendingAttribute) await h.sendQueued(drink);
    const qty = h.cartRows().find((row) => row.id === fromId)?.qty;
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: fromId, qty })]);
    h.conv.sessionData.cart[0].note = 'sin cebolla';
    await h.sendQueued('Lo quiero solo');
    if (h.conv.sessionData.pendingAttribute?.productId === toId) await h.sendQueued(toId === 35 ? 'Listo' : 'Roja');
    expect(h.cartRows().some((row) => row.id === fromId)).toBe(false);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: toId, qty, note: 'sin cebolla' })]);
  });

  it.each([false, true])('sin variante combo el churrasco sigue igual (agent %s)', async (agent) => {
    const h = harness(products, agent);
    await h.sendQueued('Un churrasco');
    const before = h.cartRows();
    const reply = await h.sendQueued('Lo quiero en combo');
    expect(h.cartRows()).toEqual(before);
    expect(h.conv.sessionData.pendingAttribute).toBeUndefined();
    expect(reply || '').toMatch(/no veo una variante/i);
  });

  it.each([false, true])('sin variante combo el estofado sigue igual (agent %s)', async (agent) => {
    const stew = [{ id: 14821, code: 14821, name: 'Estofado De Lentejas', price: 19000, availableNow: true, hasAttributes: false, attributes: [] }];
    const h = harness(stew, agent);
    await h.sendQueued('Un estofado de lentejas');
    const before = h.cartRows();
    const reply = await h.sendQueued('Lo quiero en combo');
    expect(h.cartRows()).toEqual(before);
    expect(reply || '').toMatch(/no veo una variante/i);
    expect(reply || '').not.toMatch(/pollo mixto|cuál prefieres/i);
  });
});

describe('Sustitución a combo — el resto del pedido y el paso de pago', () => {
  const ramen = [
    { id: 14901, code: 14901, name: 'Ramen De Miso', price: 22000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 14902, code: 14902, name: 'Combo De Ramen De Miso', price: 28000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 14903, code: 14903, name: 'Gyozas', price: 8000, availableNow: true, hasAttributes: false, attributes: [] },
  ];

  it.each([
    { menu: products, side: 'Una porcion de yuca frita', sideId: 7, main: 'Un arroz paisa', fromId: 35, toId: 94, drink: 'Uva', agent: false },
    { menu: products, side: 'Una porcion de yuca frita', sideId: 7, main: 'Un arroz paisa', fromId: 35, toId: 94, drink: 'Uva', agent: true },
    { menu: ramen, side: '2 Gyozas', sideId: 14903, main: 'Un ramen de miso', fromId: 14901, toId: 14902, drink: '', agent: false },
    { menu: ramen, side: '2 Gyozas', sideId: 14903, main: 'Un ramen de miso', fromId: 14901, toId: 14902, drink: '', agent: true },
  ])('el acompañamiento sigue al pasar a combo (agent $agent)', async ({ menu, side, sideId, main, fromId, toId, drink, agent }) => {
    const h = harness(menu as typeof products, agent);
    await h.sendQueued(side);
    await h.sendQueued(main);
    const sideQty = h.cartRows().find((row) => row.id === sideId)?.qty;
    const mainQty = h.cartRows().find((row) => row.id === fromId)?.qty;
    expect(sideQty).toBeGreaterThan(0);
    expect(mainQty).toBeGreaterThan(0);
    await h.sendQueued('Lo quiero en combo');
    if (drink && h.conv.sessionData.pendingAttribute?.productId === toId) await h.sendQueued(drink);
    expect(h.cartRows().some((row) => row.id === fromId)).toBe(false);
    expect(h.cartRows()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: sideId, qty: sideQty }),
      expect.objectContaining({ id: toId, qty: mainQty }),
    ]));
    expect(h.cartRows()).toHaveLength(2);
  });

  it.each([false, true])('el pollo frito pasa a su combo y no queda doble (agent %s)', async (agent) => {
    const h = harness(products, agent);
    await h.sendQueued('Un pollo frito');
    if (!h.cartRows().some((row) => row.id === 1)) await h.sendQueued('1 Pollo Frito');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 1, qty: 1 })]);
    await h.sendQueued('Lo quiero en combo');
    if (h.conv.sessionData.pendingAttribute) await h.sendQueued('Uva');
    expect(h.cartRows().some((row) => row.id === 1 || row.id === 89)).toBe(false);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 99, qty: 1 })]);
  });

  it.each([false, true])('solo en un pollo con varios tamaños pregunta y no elige (agent %s)', async (agent) => {
    const h = harness(products, agent);
    await h.sendQueued('Un combo de pollo frito');
    if (h.conv.sessionData.pendingAttribute) await h.sendQueued('Uva');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 99, qty: 1 })]);
    const before = structuredClone(h.conv.sessionData.cart);
    const reply = await h.sendQueued('Lo quiero solo');
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(reply || '').toMatch(/1 Pollo Frito|1\/2 Pollo/i);
    expect(reply || '').toMatch(/sigue igual/i);
    expect(reply || '').not.toMatch(/^¿Cuál prefieres/);
  });

  it.each([
    { menu: products, order: 'Un arroz paisa', fromId: 35, toId: 94, drink: 'Uva', agent: false },
    { menu: ramen, order: '2 Ramen De Miso', fromId: 14901, toId: 14902, drink: '', agent: true },
  ])('en el pago el combo no crea el pedido ni pierde el método (agent $agent)', async ({ menu, order, fromId, toId, drink, agent }) => {
    const h = harness(menu as typeof products, false);
    h.service.ordersService.create = jest.fn();
    await h.sendQueued(order);
    const qty = h.cartRows().find((row) => row.id === fromId)?.qty;
    Object.assign(h.conv.sessionData, {
      orderType: 'delivery', fulfillmentChosen: true, address: 'Calle 9 20 30', addressConfirmed: true,
      phoneConfirmed: true, contactPhone: h.conv.phoneE164, paymentMethod: undefined,
    });
    h.conv.customerName = 'Carolina';
    h.conv.state = 'awaiting_payment';
    h.cfg.agentV1Enabled = agent;
    const reply = await h.sendQueued('Lo quiero en combo');
    if (drink && h.conv.sessionData.pendingAttribute?.productId === toId) {
      const next = await h.sendQueued(drink);
      expect(next || reply || '').toMatch(/m[eé]todo de pago|c[oó]mo pagas/i);
    } else {
      expect(reply || '').toMatch(/m[eé]todo de pago|c[oó]mo pagas/i);
    }
    expect(h.cartRows().some((row) => row.id === fromId)).toBe(false);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: toId, qty })]);
    expect(h.conv.state).toBe('awaiting_payment');
    expect(h.conv.sessionData.paymentMethod).toBeFalsy();
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('Sustitución a solo — el tamaño elegido reemplaza y un plato sin cantidad no es dirección', () => {
  const pizzas = [
    { id: 15001, code: 15001, name: 'Pizza Personal', price: 18000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 15002, code: 15002, name: 'Pizza Mediana', price: 26000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 15003, code: 15003, name: 'Combo De Pizza', price: 32000, availableNow: true, hasAttributes: false, attributes: [] },
  ];
  const ramen = [
    { id: 14901, code: 14901, name: 'Ramen De Miso', price: 22000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 14903, code: 14903, name: 'Gyozas', price: 8000, availableNow: true, hasAttributes: false, attributes: [] },
  ];

  it.each([
    { menu: products, order: '2 combo de pollo frito', drink: 'Uva', fromId: 99, toId: 1, choice: '1 Pollo Frito', agent: false },
    { menu: products, order: '2 combo de pollo frito', drink: 'Uva', fromId: 99, toId: 1, choice: '1 Pollo Frito', agent: true },
    { menu: pizzas, order: '3 Combo De Pizza', drink: '', fromId: 15003, toId: 15001, choice: 'Pizza Personal', agent: false },
    { menu: pizzas, order: '3 Combo De Pizza', drink: '', fromId: 15003, toId: 15001, choice: 'Pizza Personal', agent: true },
  ])('elegir el tamaño reemplaza el combo (agent $agent)', async ({ menu, order, drink, fromId, toId, choice, agent }) => {
    const h = harness(menu as typeof products, agent);
    await h.sendQueued(order);
    if (drink && h.conv.sessionData.pendingAttribute) await h.sendQueued(drink);
    const line = h.conv.sessionData.cart.find((row) => row.productId === fromId);
    expect(line?.quantity).toBeGreaterThan(1);
    line!.note = 'sin cebolla';
    const qty = line!.quantity;
    await h.sendQueued('Lo quiero solo');
    const reply = await h.sendQueued(choice);
    expect(h.cartRows().some((row) => row.id === fromId)).toBe(false);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: toId, qty, note: 'sin cebolla' })]);
    expect(reply || '').not.toMatch(/cu[aá]l prefieres/i);
  });

  it.each([
    { menu: products, first: 'Una porcion de yuca frita', firstId: 7, second: 'Arroz paisa', secondId: 35, agent: false },
    { menu: products, first: 'Una porcion de yuca frita', firstId: 7, second: 'Arroz paisa', secondId: 35, agent: true },
    { menu: ramen, first: '2 Gyozas', firstId: 14903, second: 'Ramen de miso', secondId: 14901, agent: false },
    { menu: ramen, first: '2 Gyozas', firstId: 14903, second: 'Ramen de miso', secondId: 14901, agent: true },
  ])('el plato sin cantidad no se guarda como dirección (agent $agent)', async ({ menu, first, firstId, second, secondId, agent }) => {
    const h = harness(menu as typeof products, agent);
    await h.sendQueued(first);
    await h.sendQueued(second);
    expect(h.cartRows()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: firstId }),
      expect.objectContaining({ id: secondId }),
    ]));
    expect(h.cartRows()).toHaveLength(2);
    expect(h.conv.sessionData.address || '').not.toMatch(/arroz|ramen/i);
    expect(h.conv.state).toBe('building_cart');
  });
});

describe('Lista del tamaño — número, cancelar, acompañamiento y precio', () => {
  const pizzas = [
    { id: 15001, code: 15001, name: 'Pizza Personal', price: 18000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 15002, code: 15002, name: 'Pizza Mediana', price: 26000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 15003, code: 15003, name: 'Combo De Pizza', price: 32000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 15004, code: 15004, name: 'Ensalada Verde', price: 7000, availableNow: true, hasAttributes: false, attributes: [] },
  ];

  function firstListed(menu: Array<{ id: number; name: string }>, reply: string) {
    const name = reply.match(/1\. \*([^*]+)\*/)?.[1];
    return menu.find((product) => product.name === name);
  }

  it.each([
    { menu: products, order: '2 combo de pollo frito', drink: 'Uva', fromId: 99, agent: false },
    { menu: products, order: '2 combo de pollo frito', drink: 'Uva', fromId: 99, agent: true },
    { menu: pizzas, order: '3 Combo De Pizza', drink: '', fromId: 15003, agent: false },
    { menu: pizzas, order: '3 Combo De Pizza', drink: '', fromId: 15003, agent: true },
  ])('el número 1 reemplaza el combo (agent $agent)', async ({ menu, order, drink, fromId, agent }) => {
    const h = harness(menu as typeof products, agent);
    await h.sendQueued(order);
    if (drink && h.conv.sessionData.pendingAttribute) await h.sendQueued(drink);
    const line = h.conv.sessionData.cart.find((row) => row.productId === fromId)!;
    line.note = 'sin cebolla';
    const qty = line.quantity;
    const ask = await h.sendQueued('Lo quiero solo');
    const chosen = firstListed(menu, ask || '');
    expect(chosen?.id).toBeTruthy();
    await h.sendQueued('1');
    expect(h.conv.sessionData.pendingMatch).toBeUndefined();
    expect(h.cartRows().some((row) => row.id === fromId)).toBe(false);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: chosen!.id, qty, note: 'sin cebolla' })]);
  });

  it.each([
    { menu: products, order: '2 combo de pollo frito', drink: 'Uva', fromId: 99, agent: false },
    { menu: pizzas, order: '3 Combo De Pizza', drink: '', fromId: 15003, agent: true },
  ])('olvidar el cambio deja el combo (agent $agent)', async ({ menu, order, drink, fromId, agent }) => {
    const h = harness(menu as typeof products, false);
    await h.sendQueued(order);
    if (drink && h.conv.sessionData.pendingAttribute) await h.sendQueued(drink);
    h.conv.sessionData.cart.find((row) => row.productId === fromId)!.note = 'sin cebolla';
    const before = structuredClone(h.conv.sessionData.cart);
    h.cfg.agentV1Enabled = agent;
    await h.sendQueued('Lo quiero solo');
    expect(h.conv.sessionData.pendingMatch?.replacement).toBeTruthy();
    const reply = await h.sendQueued('Olvida ese cambio');
    expect(h.conv.sessionData.pendingMatch).toBeUndefined();
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(reply || '').toMatch(/original|cambio/i);
    await h.sendQueued('1');
    expect(h.conv.sessionData.cart).toEqual(before);
  });

  it.each([
    { menu: products, side: 'Una porcion de yuca frita', sideId: 7, order: '2 combo de pollo frito', drink: 'Uva', fromId: 99, agent: false },
    { menu: pizzas, side: 'Una ensalada verde', sideId: 15004, order: '3 Combo De Pizza', drink: '', fromId: 15003, agent: true },
  ])('el acompañamiento sigue al elegir el número (agent $agent)', async ({ menu, side, sideId, order, drink, fromId, agent }) => {
    const h = harness(menu as typeof products, agent);
    await h.sendQueued(side);
    await h.sendQueued(order);
    if (drink && h.conv.sessionData.pendingAttribute) await h.sendQueued(drink);
    const line = h.conv.sessionData.cart.find((row) => row.productId === fromId)!;
    const qty = line.quantity;
    line.note = 'sin cebolla';
    const ask = await h.sendQueued('Lo quiero solo');
    const chosen = firstListed(menu, ask || '');
    await h.sendQueued('1');
    expect(h.cartRows().some((row) => row.id === fromId)).toBe(false);
    expect(h.cartRows()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: sideId, qty: 1 }),
      expect.objectContaining({ id: chosen!.id, qty, note: 'sin cebolla' }),
    ]));
    expect(h.cartRows()).toHaveLength(2);
  });

  it.each([false, true])('el precio no elige el tamaño ni suelta la lista (agent %s)', async (agent) => {
    const h = harness(pizzas, false);
    await h.sendQueued('2 Combo De Pizza');
    h.cfg.agentV1Enabled = agent;
    await h.sendQueued('Lo quiero solo');
    const before = structuredClone(h.conv.sessionData.cart);
    const pending = structuredClone(h.conv.sessionData.pendingMatch);
    const reply = await h.sendQueued('¿Cuánto cuesta Pizza Personal?');
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.conv.sessionData.pendingMatch?.candidates?.map((item) => item.id)).toEqual(pending?.candidates?.map((item) => item.id));
    expect(reply || '').toMatch(/18[.,]000/);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 15003, qty: 2 })]);
  });
});

describe('Lista del tamaño — dos combos, pago y la opción por nombre', () => {
  const bowls = [
    { id: 15101, code: 15101, name: 'Bowl Personal', price: 16000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 15102, code: 15102, name: 'Bowl Grande', price: 22000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 15103, code: 15103, name: 'Combo De Bowl', price: 28000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 15111, code: 15111, name: 'Sopa De Miso', price: 9000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 15112, code: 15112, name: 'Combo De Sopa De Miso', price: 14000, availableNow: true, hasAttributes: false, attributes: [] },
  ];

  it.each([
    { menu: products, first: 'Un combo de arroz paisa', firstDrink: 'Uva', firstId: 94, second: 'Un combo de pollo frito', secondDrink: 'Manzana', secondId: 99, agent: false },
    { menu: bowls, first: '2 Combo De Bowl', firstDrink: '', firstId: 15103, second: 'Un combo de sopa de miso', secondDrink: '', secondId: 15112, agent: true },
  ])('dos combos preguntan cuál y no cambian los dos (agent $agent)', async ({ menu, first, firstDrink, firstId, second, secondDrink, secondId, agent }) => {
    const h = harness(menu as typeof products, agent);
    await h.sendQueued(first);
    if (firstDrink && h.conv.sessionData.pendingAttribute) await h.sendQueued(firstDrink);
    await h.sendQueued(second);
    if (secondDrink && h.conv.sessionData.pendingAttribute) await h.sendQueued(secondDrink);
    const before = h.cartRows();
    expect(before.map((row) => row.id).sort((a, b) => a - b)).toEqual([firstId, secondId].sort((a, b) => a - b));
    const reply = await h.sendQueued('Lo quiero solo');
    expect(h.cartRows()).toEqual(before);
    expect(h.conv.sessionData.pendingMatch?.replacement).toBeUndefined();
    expect(h.conv.sessionData.pendingMatch?.candidates.map((item) => item.id).sort((a, b) => a - b))
      .toEqual([firstId, secondId].sort((a, b) => a - b));
    expect(reply || '').toMatch(/cu[aá]l/i);
    expect(reply || '').toMatch(/sigue igual/i);
  });

  it.each([
    { menu: products, keep: 'Un combo de pollo frito', keepDrink: 'Manzana', keepId: 99, change: 'Un combo de arroz paisa', changeDrink: 'Uva', fromId: 94, toId: 35, follow: 'combo de arroz paisa', agent: false },
    { menu: bowls, keep: 'Un combo de sopa de miso', keepDrink: '', keepId: 15112, change: '2 Combo De Bowl', changeDrink: '', fromId: 15103, toId: 0, follow: 'combo de bowl', agent: true },
  ])('nombrar un combo solo cambia ese (agent $agent)', async ({ menu, keep, keepDrink, keepId, change, changeDrink, fromId, toId, follow, agent }) => {
    const h = harness(menu as typeof products, agent);
    await h.sendQueued(keep);
    if (keepDrink && h.conv.sessionData.pendingAttribute) await h.sendQueued(keepDrink);
    await h.sendQueued(change);
    if (changeDrink && h.conv.sessionData.pendingAttribute) await h.sendQueued(changeDrink);
    await h.sendQueued('Lo quiero solo');
    const reply = await h.sendQueued(follow);
    expect(h.cartRows().some((row) => row.id === keepId)).toBe(true);
    if (toId) {
      expect(h.cartRows().some((row) => row.id === fromId)).toBe(false);
      expect(h.cartRows()).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: keepId }),
        expect.objectContaining({ id: toId }),
      ]));
    } else {
      expect(h.cartRows().some((row) => row.id === fromId)).toBe(true);
      expect(h.conv.sessionData.pendingMatch?.replacement?.originalLine.productId).toBe(fromId);
      expect(reply || '').toMatch(/Bowl Personal|Bowl Grande/i);
    }
  });

  it.each([false, true])('el segundo y la mediana eligen sin dejar el combo (agent %s)', async (agent) => {
    const pizzas = [
      { id: 15001, code: 15001, name: 'Pizza Personal', price: 18000, availableNow: true, hasAttributes: false, attributes: [] },
      { id: 15002, code: 15002, name: 'Pizza Mediana', price: 26000, availableNow: true, hasAttributes: false, attributes: [] },
      { id: 15003, code: 15003, name: 'Combo De Pizza', price: 32000, availableNow: true, hasAttributes: false, attributes: [] },
    ];
    const h = harness(bowls, agent);
    await h.sendQueued('2 Combo De Bowl');
    h.conv.sessionData.cart[0].note = 'sin cebolla';
    const ask = await h.sendQueued('Lo quiero solo');
    const secondName = ask?.match(/2\. \*([^*]+)\*/)?.[1];
    await h.sendQueued('el segundo');
    const second = bowls.find((item) => item.name === secondName);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: second!.id, qty: 2, note: 'sin cebolla' })]);
    expect(h.cartRows().some((row) => row.id === 15103)).toBe(false);
    const again = harness(pizzas, agent);
    await again.sendQueued('2 Combo De Pizza');
    await again.sendQueued('Lo quiero solo');
    await again.sendQueued('la mediana');
    expect(again.cartRows()).toEqual([expect.objectContaining({ id: 15002, qty: 2 })]);
    expect(again.cartRows().some((row) => row.id === 15003)).toBe(false);
  });

  it.each([
    { menu: products, order: '2 combo de pollo frito', drink: 'Uva', fromId: 99, choice: '1', agent: false },
    { menu: bowls, order: '2 Combo De Bowl', drink: '', fromId: 15103, choice: 'el segundo', agent: true },
  ])('en el pago elegir el tamaño no crea el pedido (agent $agent)', async ({ menu, order, drink, fromId, choice, agent }) => {
    const h = harness(menu as typeof products, false);
    h.service.ordersService.create = jest.fn();
    await h.sendQueued(order);
    if (drink && h.conv.sessionData.pendingAttribute) await h.sendQueued(drink);
    const qty = h.cartRows().find((row) => row.id === fromId)?.qty;
    Object.assign(h.conv.sessionData, {
      orderType: 'delivery', fulfillmentChosen: true, address: 'Calle 9 20 30', addressConfirmed: true,
      phoneConfirmed: true, contactPhone: h.conv.phoneE164, paymentMethod: undefined,
    });
    h.conv.customerName = 'Carolina';
    h.conv.state = 'awaiting_payment';
    h.cfg.agentV1Enabled = agent;
    await h.sendQueued('Lo quiero solo');
    const reply = await h.sendQueued(choice);
    expect(h.cartRows().some((row) => row.id === fromId)).toBe(false);
    expect(h.cartRows()[0]?.qty).toBe(qty);
    expect(h.conv.state).toBe('awaiting_payment');
    expect(reply || '').toMatch(/m[eé]todo de pago/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('Dirección nueva al rechazar la guardada', () => {
  const bowls = [
    { id: 15211, code: 15211, name: 'Bowl Grande', price: 22000, availableNow: true, hasAttributes: false, attributes: [] },
  ];

  it.each([false, true])('ada mas pregunta si se usa la dirección anterior (agent %s)', async (agent) => {
    const h = harness(products, agent);
    await h.sendQueued('Un churrasco');
    h.conv.sessionData.orderType = 'delivery';
    h.conv.sessionData.fulfillmentChosen = true;
    h.conv.sessionData.address = undefined;
    h.conv.sessionData.addressConfirmed = false;
    h.conv.sessionData.lastDeliveryAddress = 'Calle 48 sur 87 86';
    h.conv.state = 'building_cart';
    const reply = await h.sendQueued('ada mas');
    expect(reply || '').toMatch(/misma dirección|una nueva/i);
    expect(reply || '').toMatch(/48 sur/);
    expect(h.conv.state).toBe('awaiting_address');
    expect(h.cartRows().some((row) => row.id === 17)).toBe(true);
  });

  it.each([
    { menu: products, order: 'Un churrasco', place: 'No, a esta conjunto Residencial bosques De Castilla cada 54', keep: /bosques/i, street: /carrera\s+54/i, agent: false },
    { menu: bowls, order: 'Un bowl grande', place: 'No, al conjunto Mirador cada 12', keep: /mirador/i, street: /carrera\s+12/i, agent: true },
  ])('el no trae el conjunto nuevo y no deja la calle vieja (agent $agent)', async ({ menu, order, place, keep, street, agent }) => {
    const h = harness(menu as typeof products, agent);
    await h.sendQueued(order);
    h.conv.sessionData.lastDeliveryAddress = 'Calle 48 sur 87 86';
    h.conv.sessionData.address = undefined;
    h.conv.sessionData.addressConfirmed = false;
    h.conv.state = 'awaiting_address';
    const reply = await h.sendQueued(place);
    const address = h.conv.sessionData.address || '';
    expect(reply || '').toMatch(/\S/);
    expect(reply || '').not.toMatch(/cu[aá]l prefieres/i);
    expect(address).toMatch(keep);
    expect(address).toMatch(street);
    expect(address).not.toMatch(/48 sur/);
    expect(address).not.toMatch(/^no\b/i);
  });
});

describe('Dúo ofrecido — el sabor no compra la botella', () => {
  const ramen = [
    { id: 15301, code: 15301, name: 'Duo De Ramen', price: 38000, availableNow: true, hasAttributes: true, description: 'Dos ramen con gyozas y bebida de 400ml', attributes: [{ attributeName: 'Bebida', options: ['Te Verde', 'Coca Cola', 'Coca Cola Zero'] }] },
    { id: 15302, code: 15302, name: 'Cola Grande 1.5L', price: 8000, availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'sabor', options: ['Original', 'Zero'] }] },
  ];

  it.each([
    { menu: products, ask: 'Dame Un duo De tacos con que viene acompañado?', yes: 'Si por favor pero que sabor es De gaseosa tiene', pick: 'Dame lo con coca cola zero por favor', dish: 71, drink: 'Bebida:Coca Cola Zero', bottle: 95, agent: false },
    { menu: ramen, ask: 'Dame un duo de ramen con que viene acompañado?', yes: 'Si por favor pero que sabor de bebida tiene', pick: 'Damelo con coca cola zero por favor', dish: 15301, drink: 'Bebida:Coca Cola Zero', bottle: 15302, agent: true },
  ])('el lo con zero deja el plato ofrecido (agent $agent)', async ({ menu, ask, yes, pick, dish, drink, bottle, agent }) => {
    const h = harness(menu as typeof products, agent);
    const about = await h.sendQueued(ask);
    expect(about || '').toMatch(/agrego/i);
    expect(h.cartRows()).toEqual([]);
    const flavors = await h.sendQueued(yes);
    expect(flavors || '').toMatch(/Coca Cola Zero/);
    expect(h.cartRows()).toEqual([]);
    await h.sendQueued(pick);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: dish, qty: 1, attrs: expect.arrayContaining([drink]) })]);
    expect(h.cartRows().some((row) => row.id === bottle)).toBe(false);
  });

  it.each([
    { menu: products, wrong: 95, right: 71, drink: 'Bebida:Coca Cola', text: 'No pero no la coca 1.5 Si no El duo De tacos con coca cola', agent: false },
    { menu: ramen, wrong: 15302, right: 15301, drink: 'Bebida:Coca Cola', text: 'No pero no la cola grande 1.5 si no el duo de ramen con coca cola', agent: true },
  ])('en el pago el no sino cambia la botella por el plato (agent $agent)', async ({ menu, wrong, right, drink, text, agent }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    const bottle = (menu as typeof products).find((item) => item.id === wrong)!;
    h.conv.sessionData.cart = [{ productId: bottle.id, name: bottle.name, code: bottle.code, quantity: 1, unitPrice: bottle.price, attributes: [{ attributeName: 'sabor', attributeValue: 'Zero' }] }];
    h.conv.sessionData.orderType = 'delivery';
    h.conv.sessionData.fulfillmentChosen = true;
    h.conv.sessionData.address = 'conjunto Banderas';
    h.conv.sessionData.addressConfirmed = true;
    h.conv.state = 'awaiting_payment';
    const reply = await h.sendQueued(text);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: right, attrs: expect.arrayContaining([drink]) })]);
    expect(h.cartRows().some((row) => row.id === wrong)).toBe(false);
    expect(h.conv.state).toBe('awaiting_payment');
    expect(h.conv.sessionData.paymentMethod).toBeUndefined();
    expect(reply || '').toMatch(/m[eé]todo de pago/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('Dirección nueva en vez de repetir la guardada', () => {
  const bowls = [
    { id: 15411, code: 15411, name: 'Bowl Grande', price: 22000, availableNow: true, hasAttributes: false, attributes: [] },
  ];

  async function closeForDelivery(menu: typeof products, order: string, agent: boolean) {
    const h = harness(menu, agent);
    await h.sendQueued(order);
    h.conv.sessionData.orderType = 'delivery';
    h.conv.sessionData.fulfillmentChosen = true;
    h.conv.sessionData.address = undefined;
    h.conv.sessionData.addressConfirmed = false;
    h.conv.sessionData.lastDeliveryAddress = 'Calle 48 sur 87 86';
    h.conv.state = 'building_cart';
    const closing = await h.sendQueued('Nada mas');
    expect(closing || '').toMatch(/misma dirección|una nueva/i);
    expect(h.conv.state).toBe('awaiting_address');
    return h;
  }

  it.each([
    { menu: products, order: 'Un churrasco', id: 17, phrase: 'A una Nueva', agent: false },
    { menu: products, order: 'Un churrasco', id: 17, phrase: 'A una Nueva', agent: true },
    { menu: bowls, order: 'Un bowl grande', id: 15411, phrase: 'una nueva dirección', agent: true },
    { menu: bowls, order: 'Un bowl grande', id: 15411, phrase: 'otra dirección', agent: false },
    { menu: products, order: 'Un churrasco', id: 17, phrase: 'no, a otra', agent: true },
    { menu: bowls, order: 'Un bowl grande', id: 15411, phrase: 'dirección nueva', agent: false },
    { menu: products, order: 'Un churrasco', id: 17, phrase: 'quiero otra dirección', agent: false },
    { menu: bowls, order: 'Un bowl grande', id: 15411, phrase: 'nueva dirección', agent: true },
  ])('$phrase pide la calle nueva y no repite la guardada (agent $agent)', async ({ menu, order, id, phrase, agent }) => {
    const h = await closeForDelivery(menu as typeof products, order, agent);
    const reply = await h.sendQueued(phrase);
    expect(reply || '').toMatch(/direcci[oó]n nueva/i);
    expect(reply || '').not.toMatch(/48 sur/);
    expect(reply || '').not.toMatch(/esta misma direcci[oó]n/i);
    expect(reply || '').not.toMatch(/no me qued[oó] clara/i);
    expect(h.conv.state).toBe('awaiting_address');
    expect(h.conv.sessionData.address || '').not.toMatch(/nueva/i);
    expect(h.cartRows().some((row) => row.id === id)).toBe(true);
  });

  it.each([
    { menu: products, order: 'Un churrasco', id: 17, phrase: 'A una Nueva', agent: false },
    { menu: bowls, order: 'Un bowl grande', id: 15411, phrase: 'otra dirección', agent: true },
  ])('después de $phrase la calle escrita reemplaza la anterior (agent $agent)', async ({ menu, order, id, phrase, agent }) => {
    const h = await closeForDelivery(menu as typeof products, order, agent);
    await h.sendQueued(phrase);
    const reply = await h.sendQueued('Carrera 15 45 20');
    const address = h.conv.sessionData.address || '';
    expect(address).toMatch(/15/);
    expect(address).toMatch(/45/);
    expect(address).not.toMatch(/48 sur/);
    expect(reply || '').toMatch(/15/);
    expect(h.cartRows().some((row) => row.id === id)).toBe(true);
  });

  it.each([
    { menu: products, order: 'Un churrasco', id: 17, choice: 'la misma', agent: true },
    { menu: bowls, order: 'Un bowl grande', id: 15411, choice: 'la misma dirección', agent: false },
  ])('$choice sigue usando la dirección guardada (agent $agent)', async ({ menu, order, id, choice, agent }) => {
    const h = await closeForDelivery(menu as typeof products, order, agent);
    const reply = await h.sendQueued(choice);
    expect(h.conv.sessionData.address || '').toMatch(/48 sur/);
    expect(reply || '').toMatch(/48/);
    expect(h.cartRows().some((row) => row.id === id)).toBe(true);
  });
});

describe('Bandeja — el número elige una y “solo la broaster” quita el resto', () => {
  const ramen = [
    { id: 15531, code: 15531, name: 'Ramen Horno', price: 18000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 15532, code: 15532, name: 'Ramen Frito', price: 17000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 15533, code: 15533, name: 'Sopa De Miso', price: 9000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 15534, code: 15534, name: 'Caldo', price: 8000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 15535, code: 15535, name: 'Hamburguesa Sencilla', price: 15000, availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Bebida', options: ['Te', 'Cola'] }] },
  ];

  it.each([
    {
      menu: products,
      order: 'Una bandeja con pollo, una sopa de mondongo y una sopa de ajiaco',
      familyIds: [15, 16],
      keep: 'Seria solo una Bandeja la De Pollo roaster',
      kept: 16,
      sideIds: [45, 38],
      burgerAsk: 'La hamburguesa',
      burgerPick: '76',
      burgerId: 76,
      address: 'No, a esta conjunto Residencial bosques De Castilla cada 54',
      place: /bosques/i,
      street: /carrera\s+54/,
      agent: false,
    },
    {
      menu: ramen,
      order: 'Un ramen, una sopa de miso y un caldo',
      familyIds: [15531, 15532],
      keep: 'Seria solo un ramen el de horno',
      kept: 15531,
      sideIds: [15533, 15534],
      burgerAsk: 'Una hamburguesa sencilla',
      burgerPick: '1',
      burgerId: 15535,
      address: 'No, al conjunto Mirador cada 12',
      place: /mirador/i,
      street: /carrera\s+12/,
      agent: true,
    },
  ])('elige una variante y deja solo esa al corregir (agent $agent)', async ({ menu, order, familyIds, keep, kept, sideIds, burgerAsk, burgerPick, burgerId, address, place, street, agent }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    const asked = await h.sendQueued(order);
    expect(asked || '').toMatch(/c[oó]mo lo quieres/i);
    expect(h.cartRows().filter((row) => familyIds.includes(row.id))).toEqual([]);
    await h.sendQueued('2');
    const familyRows = h.cartRows().filter((row) => familyIds.includes(row.id));
    expect(familyRows).toHaveLength(1);
    expect(sideIds.every((id) => h.cartRows().some((row) => row.id === id))).toBe(true);
    const only = await h.sendQueued(keep);
    expect(h.cartRows().map((row) => row.id)).toEqual([kept]);
    expect(only || '').toMatch(/solo/i);
    expect(h.conv.sessionData.pendingMultiOrder).toBeUndefined();
    expect(h.conv.sessionData.pendingMatch).toBeUndefined();
    await h.sendQueued(burgerAsk);
    await h.sendQueued(burgerPick);
    expect(h.cartRows().map((row) => row.id).sort((a, b) => a - b)).toEqual([kept, burgerId].sort((a, b) => a - b));
    h.conv.sessionData.orderType = 'delivery';
    h.conv.sessionData.fulfillmentChosen = true;
    h.conv.sessionData.address = undefined;
    h.conv.sessionData.addressConfirmed = false;
    h.conv.sessionData.lastDeliveryAddress = 'Calle 48 sur 87 86';
    h.conv.state = 'building_cart';
    await h.sendQueued('Nada mas');
    const saved = await h.sendQueued(address);
    const written = h.conv.sessionData.address || '';
    expect(written).toMatch(place);
    expect(written).toMatch(street);
    expect(written).not.toMatch(/^no\b/i);
    expect(written).not.toMatch(/\bcada\s+\d/);
    expect(saved || '').not.toMatch(/\bcada\s+\d/);
    expect(h.cartRows().map((row) => row.id).sort((a, b) => a - b)).toEqual([kept, burgerId].sort((a, b) => a - b));
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('Calle nueva durante el pago', () => {
  const bowls = [
    { id: 15601, code: 15601, name: 'Bowl Grande', price: 22000, availableNow: true, hasAttributes: false, attributes: [] },
  ];

  function ready(menu: typeof products, agent: boolean, productId: number) {
    const h = harness(menu, agent);
    h.service.ordersService.create = jest.fn();
    const dish = menu.find((item) => item.id === productId)!;
    h.conv.sessionData.cart = [{ productId: dish.id, name: dish.name, code: dish.code, quantity: 1, unitPrice: dish.price, attributes: [] }];
    h.conv.sessionData.orderType = 'delivery';
    h.conv.sessionData.fulfillmentChosen = true;
    h.conv.sessionData.address = 'No, a esta conjunto Residencial bosques De Castilla cada 54';
    h.conv.sessionData.addressConfirmed = true;
    h.conv.sessionData.phoneConfirmed = true;
    h.conv.customerName = 'Cliente Prueba';
    h.conv.state = 'awaiting_payment';
    return h;
  }

  it.each([
    { menu: products, id: 17, text: 'Direction: cl 6 bis 69 109', agent: false, bits: [/calle/i, /\b6\b/, /bis/i, /109/] },
    { menu: products, id: 17, text: 'cl 6 bis 69 109', agent: true, bits: [/calle/i, /\b6\b/, /bis/i, /109/] },
    { menu: bowls, id: 15601, text: 'Dirección: cra 8 bis 12 40', agent: true, bits: [/carrera/i, /\b8\b/, /bis/i, /40/] },
    { menu: bowls, id: 15601, text: 'Direction: cl 10 bis 20 30', agent: false, bits: [/calle/i, /\b10\b/, /20/, /30/] },
  ])('$text reemplaza la dirección y no elige el pago (agent $agent)', async ({ menu, id, text, agent, bits }) => {
    const h = ready(menu as typeof products, agent, id);
    const reply = await h.sendQueued(text);
    const address = h.conv.sessionData.address || '';
    for (const bit of bits) expect(address).toMatch(bit);
    expect(address).not.toMatch(/bosques|cada\s+54|^direction|^direcci[oó]n/i);
    expect(reply || '').toMatch(/c[oó]mo pagas|m[eé]todo de pago/i);
    expect(reply || '').toMatch(bits[0]);
    expect(h.conv.state).toBe('awaiting_payment');
    expect(h.conv.sessionData.paymentMethod).toBeUndefined();
    expect(h.cartRows().map((row) => row.id)).toEqual([id]);
    const confirmed = await h.sendQueued('1');
    expect(h.conv.sessionData.paymentMethod).toBe('cash');
    expect(h.conv.sessionData.address || '').toMatch(bits[0]);
    expect(h.conv.sessionData.address || '').not.toMatch(/bosques/i);
    expect(confirmed || '').toMatch(/confirmar/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('Dale, eso está bien — no es un plato', () => {
  const proposal =
    'Listo, te armo el combo de pollo frito, combo de pollo broaster, sopa de ajiaco y menudencias. Las sopas van sin arroz, pero solo tenemos yuca frita normal. Las bebidas de los combos son gaseosas, no tenemos jugo Hit para cambiar. ¿Te confirmo con gaseosa?';
  const ramen = [
    { id: 15701, code: 15701, name: 'Ramen De Miso', price: 28000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 15702, code: 15702, name: 'Sopa De Miso', price: 12000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 15703, code: 15703, name: 'Porcion De Edamame', price: 8000, availableNow: true, hasAttributes: false, attributes: [] },
  ];

  it.each([false, true])('con el pedido abierto acepta la yuca y no la compra otra vez (agent %s)', async (agent) => {
    const h = harness(products, agent);
    h.service.ordersService.create = jest.fn();
    h.conv.sessionData.cart = [
      { productId: 99, code: 99, name: 'Combo De Pollo Frito', unitPrice: 49000, quantity: 1 },
      { productId: 98, code: 98, name: 'Combo De Pollo Broaster', unitPrice: 50000, quantity: 1 },
      { productId: 38, code: 38, name: 'Sopa De Ajiaco', unitPrice: 10500, quantity: 1 },
      { productId: 20, code: 20, name: 'Sopa De Menudencias', unitPrice: 10500, quantity: 1 },
    ];
    h.replies.push(proposal);
    const reply = await h.sendQueued('Dale la yuca frita esta Bien');
    expect(reply || '').toMatch(/yuca frita/i);
    expect(reply || '').toMatch(/bebida/i);
    expect(reply || '').not.toMatch(/no manejamos/i);
    expect(h.cartRows().map((row) => row.id).sort((a, b) => a - b)).toEqual([20, 38, 98, 99]);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each([false, true])('sin carrito no inventa cantidades desde el texto del bot (agent %s)', async (agent) => {
    const h = harness(products, agent);
    h.service.ordersService.create = jest.fn();
    h.replies.push(proposal);
    const reply = await h.sendQueued('Dale la yuca frita esta Bien');
    expect(reply || '').not.toMatch(/no manejamos/i);
    expect(h.cartRows().map((row) => row.id).sort((a, b) => a - b)).toEqual([]);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each([
    { agent: true, cart: true },
    { agent: false, cart: false },
  ])('en otro menú “el edamame está bien” no es un plato faltante (agent $agent, cart $cart)', async ({ agent, cart }) => {
    const h = harness(ramen as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    if (cart) {
      h.conv.sessionData.cart = [
        { productId: 15701, code: 15701, name: 'Ramen De Miso', unitPrice: 28000, quantity: 1 },
        { productId: 15702, code: 15702, name: 'Sopa De Miso', unitPrice: 12000, quantity: 1 },
      ];
    }
    h.replies.push(
      'Listo, te armo el ramen de miso y la sopa de miso. Solo tenemos porcion de edamame, no tenemos te matcha. ¿Te confirmo con te?',
    );
    const reply = await h.sendQueued('Dale el edamame esta bien');
    expect(reply || '').toMatch(/edamame/i);
    expect(reply || '').not.toMatch(/no manejamos/i);
    expect(h.cartRows().map((row) => row.id).sort((a, b) => a - b)).toEqual(cart ? [15701, 15702] : []);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});


describe('Regresión dirección — correcciones completas y demostrativos', () => {
  const menu = [{id:15801,code:15801,name:'Ravioli De Espinaca',price:19000,availableNow:true,hasAttributes:false,attributes:[]}];
  function ready(agent:boolean) {
    const h=harness(menu,agent);
    h.service.ordersService.create=jest.fn();
    h.conv.sessionData.cart=[{productId:15801,code:15801,name:menu[0].name,quantity:3,unitPrice:19000,attributes:[],note:'sin queso'}];
    h.conv.sessionData.orderType='delivery';
    h.conv.sessionData.fulfillmentChosen=true;
    h.conv.sessionData.address='No, a esta conjunto Residencial bosques De Castilla cada 54';
    h.conv.sessionData.addressConfirmed=true;
    h.conv.sessionData.phoneConfirmed=true;
    h.conv.state='awaiting_payment';
    return h;
  }
  it.each([false,true])('reproduce calle, pago y pregunta copiada (agente %s)',async agent=>{
    const h=ready(agent); const cart=h.cartRows();
    await h.sendQueued('Direction: cl 6 bis 69 109');
    expect(h.conv.sessionData.address).toMatch(/109/);
    await h.sendQueued('1');
    expect(h.conv.sessionData.paymentMethod).toBe('cash');
    await h.sendQueued('Quiero cambiar la direction.');
    const reply=await h.sendQueued('Claro, ¿cuál es la nueva dirección del domicilio?\ncl 8 bis 70 111');
    expect(h.conv.sessionData.address).toMatch(/111/);
    expect(h.conv.sessionData.address).not.toMatch(/109|bosques|cuál|Claro/);
    expect(reply).toMatch(/111/);
    expect(h.conv.sessionData.paymentMethod).toBe('cash');
    expect(h.cartRows()).toEqual(cart);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
  it.each([false,true].flatMap(agent=>['A una Nueva','No Esa no es la direction es esta','No esa no, es otra','Mejor otra dirección por favor'].map(text=>({agent,text}))))('$text pide calle real (agente $agent)',async({agent,text})=>{
    const h=ready(agent); h.conv.state='awaiting_address';
    h.conv.sessionData.lastDeliveryAddress=h.conv.sessionData.address;
    const cart=h.cartRows();
    const reply=await h.sendQueued(text);
    expect(h.conv.sessionData.address).not.toBe('esta');
    expect(reply).toMatch(/escribe|cu[aá]l|nueva|correcta/i);
    expect(reply).not.toMatch(/direcci[oó]n actualizada|no me qued[oó] clara/i);
    const updated=await h.sendQueued('Carrera 81 h 30 25');
    expect(h.conv.sessionData.address).toMatch(/81.*30.*25/);
    expect(updated).toMatch(/81/);
    expect(h.cartRows()).toEqual(cart);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('Pedido mixto — compra clara inmediata',()=>{
 const menu=[
 {id:15811,code:15811,name:'Hamburguesa Clasica',price:20000,availableNow:true,hasAttributes:false,attributes:[]},
 {id:15812,code:15812,name:'Trio De Tacos Al Pastor',price:39000,availableNow:true,hasAttributes:false,attributes:[]},
 {id:15813,code:15813,name:'Duo De Tacos Al Pastor',price:29000,availableNow:true,hasAttributes:false,attributes:[]}];
 it.each([false,true])('añade claro sin sí y conserva selección sin duplicar (agente %s)',async agent=>{
 const h=harness(menu,agent);
 const reply=await h.sendQueued('Quiero un pero caliente, una hamburguesa y un combo de tres tacos');
 expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:15811,qty:1})]));
 expect(reply).not.toMatch(/escribe.*s[ií].*✅|queda listo cuando/i);
 if(h.conv.sessionData.pendingMultiOrder?.ambiguous.length) await h.sendQueued('Trio De Tacos Al Pastor');
 expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:15812,qty:1})]));
 expect(h.cartRows().filter(r=>r.id===15811)).toHaveLength(1);
 });
});


describe('Pedido mixto — menús y cantidades de paquetes',()=>{
 const families=[
 {name:'Tacos',single:'Hamburguesa Clasica',pack:'Trio De Tacos Al Pastor',request:'combo de tres tacos'},
 {name:'Gyozas',single:'Ramen Miso',pack:'Trio De Gyozas Vegetales',request:'paquete de tres gyozas'},
 ];
 it.each(families.flatMap(family=>[false,true].flatMap(agent=>[1,2,5].map(qty=>({family,agent,qty})))))('$family.name: $qty paquetes y producto claro (agente $agent)',async({family,agent,qty})=>{
 const menu=[{id:15901,code:15901,name:family.single,price:18000,availableNow:true,hasAttributes:false,attributes:[]},
 {id:15902,code:15902,name:family.pack,price:35000,availableNow:true,hasAttributes:false,attributes:[]},
 {id:15903,code:15903,name:family.pack.replace('Trio','Duo'),price:25000,availableNow:true,hasAttributes:false,attributes:[]}];
 const h=harness(menu,agent);h.service.ordersService.create=jest.fn();
 await h.sendQueued(`Quiero dos ${family.single}, ${qty} ${family.request} y un zapato comestible`);
 expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:15901,qty:2})]));
 if(h.conv.sessionData.pendingMultiOrder?.ambiguous.length) await h.sendQueued(family.pack);
 expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:15902,qty})]));
 const cart=h.cartRows();
 await h.sendQueued('sí');
 expect(h.cartRows()).toEqual(cart);
 expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});


describe('Dirección nueva — tarifa y coordenadas se recalculan',()=>{
 it.each([false,true])('con pago conserva carrito y reemplaza tarifa vieja (agente %s)',async agent=>{
 const menu=[{id:15921,code:15921,name:'Curry De Lentejas',price:18000,availableNow:true,hasAttributes:false,attributes:[]}];
 const h=harness(menu,agent);h.service.ordersService.create=jest.fn();
 Object.assign(h.cfg,{deliveryFeeMode:'distance',restaurantLat:4.6,restaurantLng:-74.1});
 h.service.deliveryRouting={quoteDeliveryFee:jest.fn().mockResolvedValue({ok:true,fee:6000,distanceKm:4.6,source:'google_directions',customer:{lat:4.61,lng:-74.12}})};
 h.conv.sessionData={cart:[{productId:15921,name:menu[0].name,code:15921,quantity:2,unitPrice:18000,attributes:[],note:'sin picante'}],orderType:'delivery',fulfillmentChosen:true,address:'Calle 1 2 3',addressConfirmed:true,phoneConfirmed:true,paymentMethod:'cash',deliveryFeeCalculated:2000,deliveryDistanceKm:1.4,deliveryLat:4.5,deliveryLng:-74.2};
 h.conv.state='awaiting_final_confirm'; const before=h.cartRows();
 const reply=await h.sendQueued('Direction: cl 6 bis 69 109');
 expect(h.service.deliveryRouting.quoteDeliveryFee).toHaveBeenCalledWith(expect.objectContaining({customerAddress:expect.stringMatching(/109/),customerCoords:null}));
 expect(h.conv.sessionData.deliveryFeeCalculated).toBe(6000);
 expect(h.conv.sessionData.deliveryDistanceKm).toBe(4.6);
 expect(h.conv.sessionData.deliveryLat).toBe(4.61);
 expect(h.conv.sessionData.paymentMethod).toBe('cash');
 expect(reply).toMatch(/6.000/);expect(reply).toMatch(/109/);
 expect(h.cartRows()).toEqual(before);
 expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});


describe('Pedido mixto — dos dudas independientes',()=>{
 it.each([false,true].flatMap(agent=>['Pizza','Ramen'].map(family=>({agent,family}))))('elegir $family añade esa línea sin esperar la otra (agente $agent)',async({agent,family})=>{
 const menu=[{id:15931,code:15931,name:family+' Vegetal',price:18000,availableNow:true,hasAttributes:false,attributes:[]},
 {id:15932,code:15932,name:family+' De Queso',price:19000,availableNow:true,hasAttributes:false,attributes:[]},
 {id:15933,code:15933,name:'Pasta De Setas',price:20000,availableNow:true,hasAttributes:false,attributes:[]},
 {id:15934,code:15934,name:'Pasta De Espinaca',price:21000,availableNow:true,hasAttributes:false,attributes:[]}];
 const h=harness(menu,agent);h.service.ordersService.create=jest.fn();
 h.conv.sessionData.pendingMultiOrder={confident:[],needsAttributes:[],unresolved:['zapato comestible'],ambiguous:[{segment:`Dos ${family}`,candidates:menu.slice(0,2)},{segment:'Tres pastas',candidates:menu.slice(2)}]};
 await h.sendQueued('1');
 expect(h.cartRows()).toEqual([expect.objectContaining({id:15931,qty:2})]);
 expect(h.conv.sessionData.pendingMultiOrder?.ambiguous).toHaveLength(1);
 await h.sendQueued('1');
 expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:15931,qty:2}),expect.objectContaining({id:15933,qty:3})]));
 expect(h.cartRows()).toHaveLength(2);
 expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});


describe('Aceptación de acompañamiento — bebida sigue pendiente',()=>{
 it.each([false,true].flatMap(agent=>[{dish:'Combo Vegetal',side:'yuca frita'},{dish:'Menu De Ramen',side:'edamame'}].map(family=>({agent,...family}))))('$side no pierde cantidad ni escoge bebida (agente $agent)',async({agent,dish,side})=>{
 const menu=[{id:15941,code:15941,name:dish,price:28000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Te Verde','Cola']}]},
 {id:15942,code:15942,name:'Porcion De '+side,price:5000,availableNow:true,hasAttributes:false,attributes:[]}];
 const h=harness(menu,agent);h.service.ordersService.create=jest.fn();
 h.conv.sessionData.pendingAttribute={productId:15941,name:dish,code:15941,price:28000,attributes:menu[0].attributes!,selected:[],quantity:3,sourceText:`3 ${dish} sin arroz`};
 h.conv.state='awaiting_attribute';
 h.replies.push(`Solo tenemos ${side} normal. Falta elegir bebida: Te Verde o Cola. ¿Cuál prefieres?`);
 const pending=structuredClone(h.conv.sessionData.pendingAttribute);
 const reply=await h.sendQueued(`Dale la ${side} está bien`);
 expect(reply).not.toMatch(/no manejamos|no tenemos/i);
 expect(reply).toMatch(/Te Verde|Cola/);
 expect(h.conv.sessionData.pendingAttribute).toEqual(pending);
 expect(h.cartRows()).toEqual([]);
 await h.sendQueued('Cola');
 expect(h.cartRows()).toEqual([expect.objectContaining({id:15941,qty:3,attrs:expect.arrayContaining(['Bebida:Cola'])})]);
 expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});


describe('Opciones obligatorias — pedido mixto con consultas intercaladas',()=>{
 const families=[
 {dish:'Brownie De Cacao',drink:'Jugo Natural',order:'Quiero dos brownies de cacao sin maní y tres jugos naturales sin azúcar',flavors:['Mango','Lulo']},
 {dish:'Empanada De Setas',drink:'Gaseosa Artesanal',order:'Quiero dos empanadas de setas sin salsa y tres gaseosas artesanales sin hielo',flavors:['Mora','Durazno']},
 ];
 it.each(families.flatMap(family=>[false,true].flatMap(agent=>['Cuánto va en total?','Cuánto cuesta el '+family.drink+'?','Qué sabores hay?','Qué sabores tienen?','Cuáles opciones hay?','De qué sabores es?','Me recuerdas los sabores?'].map(query=>({family,agent,query})))))('$family.drink: $query conserva selección y cantidades (agente $agent)',async({family,agent,query})=>{
 const menu=[{id:16001,code:16001,name:family.dish,price:6000,availableNow:true,hasAttributes:false,attributes:[]},
 {id:16002,code:16002,name:family.drink,price:8000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:family.flavors}]}];
 const h=harness(menu,agent);h.service.ordersService.create=jest.fn();
 const first=await h.sendQueued(family.order);
 expect(h.cartRows()).toEqual([expect.objectContaining({id:16001,qty:2})]);
 expect(first).toMatch(new RegExp(family.flavors.join('|'),'i'));
 expect(h.conv.sessionData.pendingAttribute?.productId).toBe(16002);
 const pending=structuredClone(h.conv.sessionData.pendingAttribute);const cart=h.cartRows();
 const reply=await h.sendQueued(query);
 expect(reply).toMatch(/total|8.000|Mango|Lulo|Mora|Durazno/i);
 expect(h.conv.sessionData.pendingAttribute).toEqual(pending);
 expect(h.cartRows()).toEqual(cart);
 await h.sendQueued(family.flavors[1]);
 expect(h.cartRows()).toContainEqual(expect.objectContaining({id:16002,qty:3,attrs:[`Sabor:${family.flavors[1]}`]}));
 expect(h.cartRows().find(r=>r.id===16001)).toEqual(cart[0]);
 expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
 expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});


describe('Opciones obligatorias — dos bebidas seguidas',()=>{
 it.each([false,true].flatMap(agent=>[{juice:'Jugo Natural',soda:'Gaseosa Artesanal'},{juice:'Jugo Del Dia',soda:'Gaseosa Frutal'}].flatMap(menuNames=>[{q1:3,q2:2},{q1:2,q2:4}].flatMap(q=>[false,true].map(change=>({agent,...menuNames,...q,change}))))))('$juice y $soda cantidades $q1/$q2 (agente $agent, corrección $change)',async({agent,juice,soda,q1,q2,change})=>{
 const menu=[{id:16011,code:16011,name:'Bowl Vegetal',price:16000,availableNow:true,hasAttributes:false,attributes:[]},
 {id:16012,code:16012,name:juice,price:8000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mango','Lulo']}]},
 {id:16013,code:16013,name:soda,price:7000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mora','Durazno']}]}];
 const h=harness(menu,agent);h.service.ordersService.create=jest.fn();
 await h.sendQueued(`Quiero dos bowl vegetal, ${q1} ${juice} y ${q2} ${soda}`);
 expect(h.cartRows()).toEqual([expect.objectContaining({id:16011,qty:2})]);
 expect(h.conv.sessionData.pendingAttribute?.productId).toBe(16012);
 if(change){ await h.sendQueued(`Mejor que sean ${q1+1} ${juice}`);q1++;expect(h.conv.sessionData.pendingAttribute?.quantity).toBe(q1); }
 await h.sendQueued('Mango');
 expect(h.cartRows()).toContainEqual(expect.objectContaining({id:16012,qty:q1,attrs:['Sabor:Mango']}));
 expect(h.conv.sessionData.pendingAttribute?.productId).toBe(16013);
 const pending=structuredClone(h.conv.sessionData.pendingAttribute);const cart=h.cartRows();
 const reply=await h.sendQueued('Qué sabores hay?');
 expect(reply).toMatch(/Mora/);expect(reply).toMatch(/Durazno/);
 expect(reply).not.toMatch(/Mango|Lulo/);
 expect(h.conv.sessionData.pendingAttribute).toEqual(pending);
 expect(h.cartRows()).toEqual(cart);
 await h.sendQueued('Durazno');
 expect(h.cartRows()).toContainEqual(expect.objectContaining({id:16013,qty:q2,attrs:['Sabor:Durazno']}));
 expect(h.cartRows()).toHaveLength(3);
 expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
 expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});


describe('Opciones obligatorias — cantidad y cancelación durante selección',()=>{
 const families=[{drink:'Jugo Natural',flavors:['Mango','Lulo']},{drink:'Gaseosa Artesanal',flavors:['Mora','Durazno']}];
 function setup(drink:string,flavors:string[],agent:boolean){
 const menu=[{id:16021,code:16021,name:'Bowl Vegetal',price:16000,availableNow:true,hasAttributes:false,attributes:[]},
 {id:16022,code:16022,name:drink,price:8000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:flavors}]}];
 const h=harness(menu,agent);h.service.ordersService.create=jest.fn();return h;
 }
 it.each(families.flatMap(family=>[false,true].map(agent=>({...family,agent}))))('$drink cambia tres a cinco sin perder sabor pendiente (agente $agent)',async({drink,flavors,agent})=>{
 const h=setup(drink,flavors,agent);
 await h.sendQueued(`Quiero dos bowl vegetal y tres ${drink}`);
 const cart=h.cartRows();
 await h.sendQueued(`Mejor que sean cinco ${drink}`);
 expect(h.conv.sessionData.pendingAttribute?.quantity).toBe(5);
 const pending=structuredClone(h.conv.sessionData.pendingAttribute);
 const reply=await h.sendQueued('Me recuerdas los sabores?');
 expect(reply).toMatch(new RegExp(flavors.join('|'),'i'));
 expect(h.cartRows()).toEqual(cart);
 expect(h.conv.sessionData.pendingAttribute).toEqual(pending);
 await h.sendQueued(flavors[1]);
 expect(h.cartRows()).toContainEqual(expect.objectContaining({id:16022,qty:5,attrs:[`Sabor:${flavors[1]}`]}));
 expect(h.cartRows()).toHaveLength(2);
 expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it.each(families.flatMap(family=>[false,true].map(agent=>({...family,agent}))))('$drink se cancela conservando el plato (agente $agent)',async({drink,flavors,agent})=>{
 const h=setup(drink,flavors,agent);
 await h.sendQueued(`Quiero dos bowl vegetal y tres ${drink}`);
 const cart=h.cartRows();
 await h.sendQueued('Qué sabores hay?');
 await h.sendQueued('Olvida esa bebida');
 expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
 expect(h.conv.sessionData.pendingMultiOrder).toBeFalsy();
 expect(h.cartRows()).toEqual(cart);
 await h.sendQueued(flavors[0]);
 expect(h.cartRows()).toEqual(cart);
 expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});


describe('Cancelación selectiva — quedan otras bebidas pendientes',()=>{
 it.each([false,true].flatMap(agent=>[{juice:'Jugo Natural',soda:'Gaseosa Artesanal'},{juice:'Jugo Del Dia',soda:'Gaseosa Frutal'}].flatMap(family=>['Olvida esa bebida','No quiero esa bebida'].map(cancel=>({agent,...family,cancel})))))('$cancel conserva segunda bebida $soda (agente $agent)',async({agent,juice,soda,cancel})=>{
 const menu=[{id:16101,code:16101,name:'Bowl Vegetal',price:16000,availableNow:true,hasAttributes:false,attributes:[]},
 {id:16102,code:16102,name:juice,price:8000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mango','Lulo']}]},
 {id:16103,code:16103,name:soda,price:7000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mora','Durazno']}]}];
 const h=harness(menu,agent);h.service.ordersService.create=jest.fn();
 await h.sendQueued(`Quiero dos bowl vegetal, tres ${juice} y dos ${soda}`);
 const cart=h.cartRows();
 const reply=await h.sendQueued(cancel);
 expect(h.cartRows()).toEqual(cart);
 expect(h.conv.sessionData.pendingAttribute?.productId).toBe(16103);
 expect(reply).toMatch(/cancel|dejamos/i);
 expect(reply).toMatch(/Mora|Durazno/);
 await h.sendQueued('Durazno');
 expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:16101,qty:2}),expect.objectContaining({id:16103,qty:2,attrs:['Sabor:Durazno']})]));
 expect(h.cartRows()).toHaveLength(2);
 expect(h.cartRows().some(r=>r.id===16102)).toBe(false);
 expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
 expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});


describe('Notas por producto — bebidas con selecciones pendientes',()=>{
 it.each([false,true].flatMap(agent=>[{juice:'Jugo Natural',soda:'Gaseosa Artesanal'},{juice:'Jugo Del Dia',soda:'Gaseosa Frutal'}].flatMap(family=>[false,true].map(cancel=>({agent,...family,cancel})))))('$juice y $soda conservan notas independientes (agente $agent, cancelar $cancel)',async({agent,juice,soda,cancel})=>{
 const menu=[{id:16111,code:16111,name:'Bowl Vegetal',price:16000,availableNow:true,hasAttributes:false,attributes:[]},
 {id:16112,code:16112,name:juice,price:8000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mango','Lulo']}]},
 {id:16113,code:16113,name:soda,price:7000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mora','Durazno']}]}];
 const h=harness(menu,agent);h.service.ordersService.create=jest.fn();
 await h.sendQueued(`Quiero dos bowl vegetal sin tomate, tres ${juice} sin azúcar y dos ${soda} sin hielo`);
 if(cancel) await h.sendQueued('Olvida esa bebida');else await h.sendQueued('Mango');
 await h.sendQueued('Qué sabores hay?');
 await h.sendQueued('Durazno');
 const rows=h.cartRows();
 const clean=(text:string|undefined)=>(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 expect(clean(rows.find(r=>r.id===16111)?.note)).toMatch(/sin tomate/);
 expect(clean(rows.find(r=>r.id===16111)?.note)).not.toMatch(/azucar|hielo/);
 expect(clean(rows.find(r=>r.id===16113)?.note)).toMatch(/sin hielo/);
 expect(clean(rows.find(r=>r.id===16113)?.note)).not.toMatch(/azucar|tomate/);
 if(!cancel){ expect(clean(rows.find(r=>r.id===16112)?.note)).toMatch(/sin azucar/);expect(clean(rows.find(r=>r.id===16112)?.note)).not.toMatch(/hielo|tomate/); }
 else expect(rows.some(r=>r.id===16112)).toBe(false);
 expect(rows.find(r=>r.id===16113)?.qty).toBe(2);
 expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});

describe('Cancelación selectiva — mismo SKU en carrito y cola',()=>{
 it.each([false,true].flatMap(agent=>['Olvida esa bebida','No quiero esa bebida'].map(cancel=>({agent,cancel}))))('$cancel elimina una sola solicitud pendiente (agente $agent)',async({agent,cancel})=>{
 const product={id:16121,code:16121,name:'Jugo Natural',price:8000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mango','Lulo']}]};
 const h=harness([product],agent);h.service.ordersService.create=jest.fn();
 h.conv.sessionData.cart=[{productId:16121,code:16121,name:product.name,unitPrice:8000,quantity:1,attributes:[{attributeName:'Sabor',attributeValue:'Mango'}],note:'sin azúcar'}];
 h.conv.sessionData.pendingAttribute={productId:16121,code:16121,name:product.name,price:8000,attributes:product.attributes,selected:[],quantity:3,sourceText:'Tres Jugo Natural'};
 h.conv.sessionData.pendingMultiOrder={confident:[],ambiguous:[],unresolved:[],needsAttributes:[{productId:16121,code:16121,name:product.name,price:8000,segment:'Tres Jugo Natural'},{productId:16121,code:16121,name:product.name,price:8000,segment:'Dos Jugo Natural sin hielo'}]};
 h.conv.state='awaiting_attribute';const before=h.cartRows();
 await h.sendQueued(cancel);
 expect(h.cartRows()).toEqual(before);
 expect(h.conv.sessionData.pendingAttribute?.quantity).toBe(2);
 await h.sendQueued('Lulo');
 expect(h.cartRows()).toContainEqual(before[0]);
 expect(h.cartRows()).toContainEqual(expect.objectContaining({id:16121,qty:2,attrs:['Sabor:Lulo']}));
 expect(h.cartRows()).toHaveLength(2);
 expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
 expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});


describe('Compra con puntos — intención concreta y carrito conservado',()=>{
 const bowl=[{id:16201,code:2,name:'Bowl Del Premio',price:18000,availableNow:true,hasAttributes:false,attributes:[]},
 {id:16202,code:16202,name:'Tarta De Setas',price:12000,availableNow:true,hasAttributes:false,attributes:[]}];
 const cases=[{menu:products,text:'Quiero pedir medio Pollo Mas pero Para pagar Con Puntos',code:null},
 {menu:products,text:'Quiero medio pollo frito para pagar con puntos',code:2},
 {menu:products,text:'Me envías un medio pollo broaster con mis puntos',code:5},
 {menu:bowl,text:'Quiero un Bowl Del Premio para pagarlo con puntos',code:2}];
 it.each(cases.flatMap(c=>[false,true].flatMap(agent=>[null,5,9].map(balance=>({...c,agent,balance})))))('$text, saldo $balance, agente $agent',async({menu,text,code,agent,balance})=>{
 const h=harness(menu,agent);h.service.ordersService.create=jest.fn();
 const redeem=jest.fn();h.service.pointsHandler=new WhatsappPointsService({getAvailablePoints:async()=>balance,redeemPointsForVoucher:redeem} as never);
 if(balance!==null)h.conv.sessionData.linkedUserId='test-account';
 const existing=menu===products?menu.find(p=>p.id===17):menu[1];
 h.conv.sessionData.cart=[{productId:existing.id,code:existing.code,name:existing.name,quantity:2,unitPrice:existing.price,attributes:[],note:'sin ensalada'}];
 const previous=h.cartRows()[0];
 const reply=await h.sendQueued(text);
 expect(h.cartRows()).toContainEqual(previous);
 expect(h.replies.join(' ')).not.toMatch(/Programa de puntos y premios|Qué platos suman|Cómo acumulas/i);
 expect(h.replies.join(' ')).toMatch(/premio|puntos/i);
 if(code!==null){const product=menu.find(p=>p.code===code)!;expect(h.cartRows()).toContainEqual(expect.objectContaining({id:product.id,qty:1}));}
 else {expect(h.conv.sessionData.pendingMatch?.candidates?.some(p=>[2,5].includes(p.code))).toBe(true);expect(reply).toMatch(/frito|broaster/i);}
 expect(h.conv.sessionData.pendingRedemptionCode).toBeFalsy();
 expect(redeem).not.toHaveBeenCalled();
 expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});


describe('Puntos — respuestas específicas sin consumir saldo',()=>{
 it.each([false,true].flatMap(agent=>[null,5,9].flatMap(balance=>['¿Puedo pagar con mis puntos?','¿Todo el pedido queda gratis con puntos?','Tengo un premio','Quiero ver mis puntos'].map(text=>({agent,balance,text})))))('$text con saldo $balance (agente $agent)',async({agent,balance,text})=>{
 const h=harness(products,agent);h.service.ordersService.create=jest.fn();
 const redeem=jest.fn();h.service.pointsHandler=new WhatsappPointsService({getAvailablePoints:async()=>balance,redeemPointsForVoucher:redeem} as never);
 if(balance!==null)h.conv.sessionData.linkedUserId='test-account';
 const before=structuredClone(h.conv.sessionData);
 const reply=await h.sendQueued(text);
 expect(reply).not.toMatch(/Programa de puntos y premios|Qué platos suman|Cómo acumulas/i);
 expect(reply!.length).toBeLessThan(650);
 expect(reply).toMatch(/puntos|premio|cuenta|c[oó]digo/i);
 expect(h.conv.sessionData).toEqual(before);
 expect(redeem).not.toHaveBeenCalled();
 expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it.each([false,true].flatMap(agent=>['premio ABCD2345EFGO','aplicar premio','Quiero redimir mis puntos'].map(text=>({agent,text}))))('$text sin cuenta responde siguiente paso (agente $agent)',async({agent,text})=>{
 const h=harness(products,agent);h.service.ordersService.create=jest.fn();
 const validate=jest.fn();const redeem=jest.fn();h.service.pointsHandler=new WhatsappPointsService({validateRedemptionCode:validate,redeemPointsForVoucher:redeem} as never);
 const before=structuredClone(h.conv.sessionData);
 const reply=await h.sendQueued(text);
 expect(reply).not.toMatch(/Programa de puntos y premios|Qué platos suman/i);
 expect(reply!.length).toBeLessThan(450);
 expect(h.conv.sessionData).toEqual(before);
 expect(validate).not.toHaveBeenCalled();expect(redeem).not.toHaveBeenCalled();
 expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});


describe('Nombre de plato — premio no es siempre una intención de puntos',()=>{
 it.each([false,true].flatMap(agent=>['Bowl Del Premio','Brownie Con Premio'].map(name=>({agent,name}))))('compra $name como producto (agente $agent)',async({agent,name})=>{
 const menu=[{id:16221,code:16221,name,price:18000,availableNow:true,hasAttributes:false,attributes:[]}];
 const h=harness(menu,agent);h.service.ordersService.create=jest.fn();
 const reply=await h.sendQueued(`Quiero un ${name}`);
 expect(h.cartRows()).toEqual([expect.objectContaining({id:16221,qty:1})]);
 expect(reply).not.toMatch(/Programa de puntos|redimir|código de premio|puntos disponible/i);
 expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});

describe('Número tardío — dos listas abiertas no comparten el 2', () => {
  const juice = { id: 16301, code: 16301, name: 'Jugo De Mango', price: 7000, availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Sabor', options: ['Maracuya', 'Lulo', 'Mora'] }] };
  const taco = { id: 16302, code: 16302, name: 'Taco Suave', price: 14000, availableNow: true, hasAttributes: false, attributes: [] };
  const nachos = { id: 16303, code: 16303, name: 'Nachos Grandes', price: 16000, availableNow: true, hasAttributes: false, attributes: [] };

  it.each([
    { agent: false, menu: products, sides: ['Quiero un churrasco', 'Quiero una porcion de yuca frita'], drink: 'Quiero un jugo natural en agua', flavor: 'Guanabana', sideIds: [17, 7] },
    { agent: true, menu: [juice, taco, nachos], sides: ['Quiero un taco suave', 'Quiero unos nachos grandes'], drink: 'Quiero un jugo de mango', flavor: 'Lulo', sideIds: [16302, 16303] },
  ])('el 2 no elige solo y el sabor nombrado sí cierra el jugo (agent $agent)', async ({ agent, menu, sides, drink, flavor, sideIds }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    for (const side of sides) await h.sendQueued(side);
    await h.sendQueued(drink);
    expect(h.conv.sessionData.pendingAttribute).toBeTruthy();
    expect(h.cartRows().map((row) => row.id).sort((a, b) => a - b)).toEqual([...sideIds].sort((a, b) => a - b));
    const before = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('Que precio tiene');
    expect(h.conv.sessionData.pendingPriceInquiry).toBeTruthy();
    expect(h.conv.sessionData.pendingAttribute).toBeTruthy();
    const ambiguous = await h.sendQueued('2');
    expect(ambiguous || '').toMatch(/precio/i);
    expect(ambiguous || '').toMatch(/opci[oó]n/i);
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.conv.sessionData.pendingPriceInquiry).toBeTruthy();
    expect(h.conv.sessionData.pendingAttribute).toBeTruthy();
    const chosen = await h.sendQueued(flavor);
    expect(h.cartRows().some((row) => (row.attrs || []).some((attr) => attr.includes(flavor)))).toBe(true);
    expect(h.cartRows().map((row) => row.id).sort((a, b) => a - b)).toEqual([...sideIds, h.cartRows().find((row) => (row.attrs || []).some((attr) => attr.includes(flavor)))!.id].sort((a, b) => a - b));
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    expect(chosen || '').not.toMatch(/no manejamos/i);
  });

  it.each([
    { agent: true, menu: products, drink: 'Quiero un jugo natural en agua', price: 'Cuánto cuesta el churrasco?', flavor: 'Guanabana', drinkId: 50 },
    { agent: false, menu: [juice, taco], drink: 'Quiero un jugo de mango', price: 'Cuánto cuesta el taco suave?', flavor: 'Lulo', drinkId: 16301 },
  ])('una sola lista sigue aceptando el 2 después del precio (agent $agent)', async ({ agent, menu, drink, price, flavor, drinkId }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    await h.sendQueued(drink);
    expect(h.cartRows()).toEqual([]);
    const asked = await h.sendQueued(price);
    expect(asked || '').toMatch(/\$|precio/i);
    expect(h.cartRows()).toEqual([]);
    expect(h.conv.sessionData.pendingAttribute).toBeTruthy();
    await h.sendQueued('2');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: drinkId, qty: 1 })]);
    expect(h.cartRows()[0].attrs?.some((attr) => attr.includes(flavor))).toBe(true);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('Autocorrección en el mismo mensaje', () => {
  const lentil = { id: 16311, code: 16311, name: 'Hamburguesa De Lentejas', price: 18000, availableNow: true, hasAttributes: false, attributes: [] };

  it.each([
    { agent: false, menu: products, text: 'dos hamburguesas, no, mejor tres; una sin queso', id: 76, note: /una sin queso/i },
    { agent: true, menu: [lentil], text: 'dos hamburguesas de lentejas, no, mejor tres; una sin cebolla', id: 16311, note: /una sin cebolla/i },
  ])('la cantidad final es tres y la nota es de una unidad (agent $agent)', async ({ agent, menu, text, id, note }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    const reply = await h.sendQueued(text);
    expect(reply || '').toMatch(note);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id, qty: 3, note: expect.stringMatching(note) })]);
    expect(h.cartRows()).toHaveLength(1);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('Corrección negativa — no dije ese plato', () => {
  const pastaMenu = [
    { id: 16401, code: 16401, name: 'Combo De Pasta', price: 28000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 16402, code: 16402, name: 'Ensalada Verde', price: 9000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 16403, code: 16403, name: 'Pasta Al Pesto', price: 22000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 16404, code: 16404, name: 'Duo De Pastas', price: 40000, availableNow: true, hasAttributes: false, attributes: [] },
  ];
  const ramenMenu = [
    { id: 16411, code: 16411, name: 'Combo De Miso', price: 26000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 16412, code: 16412, name: 'Combo De Shoyu', price: 27000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 16413, code: 16413, name: 'Gyoza', price: 8000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 16414, code: 16414, name: 'Ramen De Miso', price: 24000, availableNow: true, hasAttributes: false, attributes: [] },
  ];
  const line = (id: number, name: string, price: number, qty: number) => ({
    productId: id, code: id, name, unitPrice: price, quantity: qty, attributes: [],
  });

  it.each([false, true])('cambia los dos combos por dos tacos y deja la yuca (agent %s)', async (agent) => {
    const h = harness(products, agent);
    h.service.ordersService.create = jest.fn();
    h.conv.sessionData.cart = [
      line(99, 'Combo De Pollo Frito', 49000, 2),
      line(7, 'Porcion De Yuca Frita', 7000, 1),
    ];
    const reply = await h.sendQueued('no dije dos combos, dije dos tacos');
    expect(h.cartRows().find((row) => row.id === 7)).toMatchObject({ qty: 1 });
    expect(h.cartRows().find((row) => row.id === 70)).toMatchObject({ qty: 2 });
    expect(h.cartRows().some((row) => [71, 72, 73, 99].includes(row.id))).toBe(false);
    expect(h.cartRows()).toHaveLength(2);
    expect(reply || '').toMatch(/Taco Al Pastor/i);
    expect(reply || '').not.toMatch(/no manejamos/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each([false, true])('cambia el combo de pasta por dos pastas y deja la ensalada (agent %s)', async (agent) => {
    const h = harness(pastaMenu, agent);
    h.service.ordersService.create = jest.fn();
    h.conv.sessionData.cart = [
      line(16401, 'Combo De Pasta', 28000, 2),
      line(16402, 'Ensalada Verde', 9000, 1),
    ];
    const reply = await h.sendQueued('no dije dos combos, dije dos pastas');
    expect(h.cartRows().find((row) => row.id === 16402)).toMatchObject({ qty: 1 });
    expect(h.cartRows().find((row) => row.id === 16403)).toMatchObject({ qty: 2 });
    expect(h.cartRows().some((row) => row.id === 16401 || row.id === 16404)).toBe(false);
    expect(h.cartRows()).toHaveLength(2);
    expect(reply || '').toMatch(/Pasta Al Pesto/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each([
    { agent: true, menu: products, text: 'no dije dos combos, dije dos tacos', extra: line(98, 'Combo De Pollo Broaster', 48000, 2), keep: 7 },
    { agent: false, menu: ramenMenu, text: 'no dije dos combos, dije dos ramen', extra: line(16412, 'Combo De Shoyu', 27000, 2), keep: 16413 },
  ])('pregunta cuál combo cuando hay dos y no toca el resto (agent $agent)', async ({ agent, menu, text, extra, keep }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    const side = menu === products ? line(7, 'Porcion De Yuca Frita', 7000, 1) : line(16413, 'Gyoza', 8000, 1);
    const first = menu === products ? line(99, 'Combo De Pollo Frito', 49000, 2) : line(16411, 'Combo De Miso', 26000, 2);
    h.conv.sessionData.cart = [first, extra, side];
    const before = structuredClone(h.cartRows());
    const reply = await h.sendQueued(text);
    expect(h.cartRows()).toEqual(before);
    expect(h.cartRows().find((row) => row.id === keep)?.qty).toBe(1);
    expect(reply || '').toMatch(/cuál cambio/i);
    expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('Números con funciones distintas', () => {
  const ramen = [
    { id: 16501, code: 16501, name: 'Combo De Tres Ramen', price: 32000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 16502, code: 16502, name: 'Ramen Suelto', price: 18000, availableNow: true, hasAttributes: false, attributes: [] },
  ];

  it.each([
    { agent: false, menu: products, text: 'combo de tres tacos, dos unidades, casa 3, pago con 50 mil', ids: [72, 73] },
    { agent: true, menu: products, text: 'combo de tres tacos, dos unidades, casa 3, pago con 50 mil', ids: [72, 73] },
    { agent: false, menu: ramen, text: 'combo de tres ramen, dos unidades, casa 3, pago con 50 mil', ids: [16501] },
    { agent: true, menu: ramen, text: 'combo de tres ramen, dos unidades, casa 3, pago con 50 mil', ids: [16501] },
  ])('la cantidad es dos y el 3 y el billete no son platos (agent $agent)', async ({ agent, menu, text, ids }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    const reply = await h.sendQueued(text);
    const rows = h.cartRows();
    if (ids.length > 1) {
      expect(rows).toEqual([]);
      expect(h.conv.sessionData.pendingMatch?.quantity).toBe(2);
      expect(h.conv.sessionData.pendingMatch?.candidates.map((item) => item.id).sort((a, b) => a - b)).toEqual([...ids].sort((a, b) => a - b));
    } else {
      expect(rows).toEqual([expect.objectContaining({ id: ids[0], qty: 2 })]);
    }
    expect(reply || '').not.toMatch(/no manejamos|Bandeja/i);
    expect(String(h.conv.sessionData.cashChangeFor || '')).toMatch(/50/);
    expect(h.conv.sessionData.paymentMethod).toBe('cash');
    expect(h.conv.sessionData.address || '').toMatch(/casa\s*3/i);
    expect(h.conv.sessionData.address || '').not.toMatch(/50|pago|unidad|taco|ramen/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('Referencia ambigua — esa sin cebolla', () => {
  const burgers = [
    { id: 16601, code: 16601, name: 'Hamburguesa De Lentejas', price: 18000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 16602, code: 16602, name: 'Hamburguesa De Garbanzo', price: 17000, availableNow: true, hasAttributes: false, attributes: [] },
  ];
  const line = (id: number, name: string, price: number) => ({
    productId: id, code: id, name, unitPrice: price, quantity: 1, attributes: [] as { attributeName: string; attributeValue: string }[],
  });

  it.each([
    { agent: false, menu: products, first: line(76, 'Hamburguesa Clasica', 20000), second: line(17, 'Churrasco', 38000) },
    { agent: true, menu: products, first: line(76, 'Hamburguesa Clasica', 20000), second: line(17, 'Churrasco', 38000) },
    { agent: false, menu: burgers, first: line(16601, 'Hamburguesa De Lentejas', 18000), second: line(16602, 'Hamburguesa De Garbanzo', 17000) },
    { agent: true, menu: burgers, first: line(16601, 'Hamburguesa De Lentejas', 18000), second: line(16602, 'Hamburguesa De Garbanzo', 17000) },
  ])('pregunta cuál plato y no anota al azar (agent $agent)', async ({ agent, menu, first, second }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    h.conv.sessionData.cart = [first, second];
    const before = structuredClone(h.cartRows());
    const reply = await h.sendQueued('esa sin cebolla');
    expect(h.cartRows()).toEqual(before);
    expect(reply || '').toMatch(/cuál/i);
    expect(reply || '').toMatch(new RegExp(first.name, 'i'));
    expect(reply || '').toMatch(new RegExp(second.name, 'i'));
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each([
    { agent: false, menu: products, item: line(76, 'Hamburguesa Clasica', 20000) },
    { agent: true, menu: products, item: line(76, 'Hamburguesa Clasica', 20000) },
    { agent: false, menu: burgers, item: line(16601, 'Hamburguesa De Lentejas', 18000) },
    { agent: true, menu: burgers, item: line(16601, 'Hamburguesa De Lentejas', 18000) },
  ])('con un solo plato la nota sí queda (agent $agent)', async ({ agent, menu, item }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    h.conv.sessionData.cart = [item];
    const reply = await h.sendQueued('esa sin cebolla');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: item.productId, qty: 1, note: 'sin cebolla' })]);
    expect(reply || '').toMatch(/sin cebolla/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('Consulta frente a compra — si cambio la bebida', () => {
  const pizza = [
    { id: 16701, code: 16701, name: 'Pizza Margarita', price: 28000, availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Bebida', options: ['Limonada', 'Agua'] }] },
    { id: 16702, code: 16702, name: 'Ensalada Verde', price: 9000, availableNow: true, hasAttributes: false, attributes: [] },
  ];
  const drink = (value: string) => [{ attributeName: 'Bebida', attributeValue: value }];

  it.each([false, true])('pregunta el precio y deja la bebida del combo (agent %s)', async (agent) => {
    const h = harness(products, agent);
    h.service.ordersService.create = jest.fn();
    h.conv.sessionData.cart = [{
      productId: 99, code: 99, name: 'Combo De Pollo Frito', unitPrice: 49000, quantity: 1,
      attributes: [...drink('Colombiana'), { attributeName: 'Arepas', attributeValue: 'Blancas' }],
    }, {
      productId: 7, code: 7, name: 'Porcion De Yuca Frita', unitPrice: 7000, quantity: 1, attributes: [],
    }];
    const before = structuredClone(h.cartRows());
    const reply = await h.sendQueued('si cambio la bebida cuánto vale');
    expect(h.cartRows()).toEqual(before);
    expect(reply || '').toMatch(/recargo de cambio confirmado/i);
    expect(reply || '').toMatch(/pedido sigue igual/i);
    expect(reply || '').not.toMatch(/Listo|agregu[eé]/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each([false, true])('pregunta el precio y deja la bebida de la pizza (agent %s)', async (agent) => {
    const h = harness(pizza, agent);
    h.service.ordersService.create = jest.fn();
    h.conv.sessionData.cart = [{
      productId: 16701, code: 16701, name: 'Pizza Margarita', unitPrice: 28000, quantity: 1, attributes: drink('Limonada'),
    }, {
      productId: 16702, code: 16702, name: 'Ensalada Verde', unitPrice: 9000, quantity: 1, attributes: [],
    }];
    const before = structuredClone(h.cartRows());
    const reply = await h.sendQueued('si cambio la bebida cuánto vale');
    expect(h.cartRows()).toEqual(before);
    expect(reply || '').toMatch(/recargo de cambio confirmado/i);
    expect(reply || '').toMatch(/pedido sigue igual/i);
    expect(h.cartRows().find((row) => row.id === 16702)?.note).toBeUndefined();
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('Pedido más código de premio', () => {
  const ramen = [{ id: 16801, code: 16801, name: 'Ramen De Miso', price: 24000, availableNow: true, hasAttributes: false, attributes: [] }];
  const prizeService = () => {
    const validate = jest.fn(async () => ({ code: 'ABCD2345EFGH', userId: 'test-account', expiresAt: null }));
    const redeem = jest.fn();
    return {
      validate,
      redeem,
      service: new WhatsappPointsService({
        getAvailablePoints: async () => 0,
        validateRedemptionCode: validate,
        redeemPointsForVoucher: redeem,
      } as never),
    };
  };

  it.each([
    { agent: false, menu: products, text: 'agrega un medio pollo broaster y aplica este premio ABCD2345EFGH', id: 5 },
    { agent: true, menu: products, text: 'agrega un medio pollo broaster y aplica este premio ABCD2345EFGH', id: 5 },
    { agent: false, menu: ramen, text: 'agrega un ramen de miso y aplica este premio ABCD2345EFGH', id: 16801 },
    { agent: true, menu: ramen, text: 'agrega un ramen de miso y aplica este premio ABCD2345EFGH', id: 16801 },
  ])('conserva la compra y valida el código una vez (agent $agent)', async ({ agent, menu, text, id }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    const points = prizeService();
    h.service.pointsHandler = points.service;
    h.conv.sessionData.linkedUserId = 'test-account';
    await h.sendQueued(text);
    expect(h.cartRows().find((row) => row.id === id)).toMatchObject({ qty: 1 });
    expect(h.conv.sessionData.pendingRedemptionCode).toBe('ABCD2345EFGH');
    expect(points.validate).toHaveBeenCalledTimes(1);
    expect(points.redeem).not.toHaveBeenCalled();
    expect(h.replies.join(' ')).toMatch(/ABCD2345EFGH/);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each([
    { agent: false, menu: products, item: { productId: 17, code: 17, name: 'Churrasco', unitPrice: 38000, quantity: 1, attributes: [] } },
    { agent: true, menu: products, item: { productId: 17, code: 17, name: 'Churrasco', unitPrice: 38000, quantity: 1, attributes: [] } },
    { agent: false, menu: ramen, item: { productId: 16801, code: 16801, name: 'Ramen De Miso', unitPrice: 24000, quantity: 1, attributes: [] } },
    { agent: true, menu: ramen, item: { productId: 16801, code: 16801, name: 'Ramen De Miso', unitPrice: 24000, quantity: 1, attributes: [] } },
  ])('una consulta no canjea ni cambia el pedido (agent $agent)', async ({ agent, menu, item }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    const points = prizeService();
    h.service.pointsHandler = points.service;
    h.conv.sessionData.linkedUserId = 'test-account';
    h.conv.sessionData.cart = [item];
    const before = structuredClone(h.cartRows());
    const reply = await h.sendQueued('¿aplica este premio ABCD2345EFGH?');
    expect(h.cartRows()).toEqual(before);
    expect(h.conv.sessionData.pendingRedemptionCode).toBeFalsy();
    expect(points.validate).not.toHaveBeenCalled();
    expect(points.redeem).not.toHaveBeenCalled();
    expect(reply || '').toMatch(/consulta/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('Retransmisión — mismo evento y otro mensaje igual', () => {
  const ramen = [{ id: 16901, code: 16901, name: 'Ramen De Miso', price: 24000, availableNow: true, hasAttributes: false, attributes: [] }];

  async function turn(h: ReturnType<typeof harness>, messageId: string, text: string) {
    const pending = h.service.handleIncoming({
      waId: 'customer',
      phoneE164: h.conv.phoneE164,
      messageId,
      messageType: 'text',
      text,
      timestamp: Date.now() / 1000,
      raw: {},
    });
    await jest.advanceTimersByTimeAsync(3000);
    await pending;
  }

  it.each([
    { agent: false, menu: products, text: 'Quiero un churrasco', id: 17 },
    { agent: true, menu: products, text: 'Quiero un churrasco', id: 17 },
    { agent: false, menu: ramen, text: 'Quiero un ramen de miso', id: 16901 },
    { agent: true, menu: ramen, text: 'Quiero un ramen de miso', id: 16901 },
  ])('el mismo evento no duplica y otro id no borra el plato (agent $agent)', async ({ agent, menu, text, id }) => {
    jest.useFakeTimers();
    try {
      const h = harness(menu as typeof products, agent);
      h.service.ordersService.create = jest.fn();
      const claimed = new Set<string>();
      let n = 0;
      h.service.conversationService.claimInboundMessage = async (params: { waMessageId?: string }) => {
        if (params.waMessageId && claimed.has(params.waMessageId)) return null;
        if (params.waMessageId) claimed.add(params.waMessageId);
        n += 1;
        return { id: n };
      };
      await turn(h, 'wamid.same', text);
      expect(h.cartRows()).toEqual([expect.objectContaining({ id, qty: 1 })]);
      const replies = h.replies.length;
      await turn(h, 'wamid.same', text);
      expect(h.cartRows()).toEqual([expect.objectContaining({ id, qty: 1 })]);
      expect(h.replies).toHaveLength(replies);
      await turn(h, 'wamid.other', text);
      expect(h.cartRows().find((row) => row.id === id)?.qty).toBeGreaterThanOrEqual(1);
      expect(h.cartRows().some((row) => row.id === id)).toBe(true);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('Foto — solo el segundo y dos del tercero', () => {
  const bowls = [
    { id: 17001, code: 17001, name: 'Bowl De Miso', price: 18000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 17002, code: 17002, name: 'Gyoza', price: 8000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 17003, code: 17003, name: 'Ramen De Miso', price: 24000, availableNow: true, hasAttributes: false, attributes: [] },
  ];
  const line = (id: number, name: string, price: number) => ({
    productId: id, code: id, name, unitPrice: price, quantity: 1, attributes: [] as { attributeName: string; attributeValue: string }[],
  });

  it.each([
    {
      agent: false,
      menu: products,
      remembered: [
        { productId: 17, name: 'Churrasco' },
        { productId: 7, name: 'Porcion De Yuca Frita' },
        { productId: 38, name: 'Sopa De Ajiaco' },
      ],
      cart: [line(17, 'Churrasco', 38000), line(7, 'Porcion De Yuca Frita', 7000), line(38, 'Sopa De Ajiaco', 10500)],
      keep: [7, 38],
      qty: 2,
    },
    {
      agent: true,
      menu: products,
      remembered: [
        { productId: 17, name: 'Churrasco' },
        { productId: 7, name: 'Porcion De Yuca Frita' },
        { productId: 38, name: 'Sopa De Ajiaco' },
      ],
      cart: [line(17, 'Churrasco', 38000), line(7, 'Porcion De Yuca Frita', 7000), line(38, 'Sopa De Ajiaco', 10500)],
      keep: [7, 38],
      qty: 2,
    },
    {
      agent: false,
      menu: bowls,
      remembered: [
        { productId: 17001, name: 'Bowl De Miso' },
        { productId: 17002, name: 'Gyoza' },
        { productId: 17003, name: 'Ramen De Miso' },
      ],
      cart: [line(17001, 'Bowl De Miso', 18000), line(17002, 'Gyoza', 8000), line(17003, 'Ramen De Miso', 24000)],
      keep: [17002, 17003],
      qty: 2,
    },
    {
      agent: true,
      menu: bowls,
      remembered: [
        { productId: 17001, name: 'Bowl De Miso' },
        { productId: 17002, name: 'Gyoza' },
        { productId: 17003, name: 'Ramen De Miso' },
      ],
      cart: [line(17001, 'Bowl De Miso', 18000), line(17002, 'Gyoza', 8000), line(17003, 'Ramen De Miso', 24000)],
      keep: [17002, 17003],
      qty: 2,
    },
  ])('deja el segundo y dos del tercero (agent $agent)', async ({ agent, menu, remembered, cart, keep, qty }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    h.conv.sessionData.cart = cart;
    h.conv.sessionData.recentImageOrder = remembered;
    const reply = await h.sendQueued('de la foto solo el segundo y dos del tercero');
    expect(h.cartRows().map((row) => row.id)).toEqual(keep);
    expect(h.cartRows()[0].qty).toBe(1);
    expect(h.cartRows()[1].qty).toBe(qty);
    expect(reply || '').toMatch(/de la foto/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each([false, true])('sin lista de la foto no agrega los platos otra vez (agent %s)', async (agent) => {
    const h = harness(products, agent);
    h.service.ordersService.create = jest.fn();
    h.conv.sessionData.cart = [line(17, 'Churrasco', 38000)];
    const before = structuredClone(h.cartRows());
    const reply = await h.sendQueued('de la foto solo el segundo y dos del tercero');
    expect(h.cartRows()).toEqual(before);
    expect(reply || '').toMatch(/no tengo la lista/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('Consulta sin pedido — no guarda una dirección falsa', () => {
  const bowls = [
    { id: 17401, code: 17401, name: 'Ramen De Miso', price: 24000, availableNow: true, hasAttributes: false, attributes: [] },
  ];
  it.each([
    { agent: false, menu: products },
    { agent: true, menu: products },
    { agent: false, menu: bowls },
    { agent: true, menu: bowls },
  ])('preguntar por una celebración no arma pedido ni dirección (agent $agent)', async ({ agent, menu }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    const reply = await h.sendQueued('Mi tía cumple años y quiero saber si arman algo especial para celebrar en la mesa, sin pedir todavía');
    expect(h.cartRows()).toEqual([]);
    expect(h.conv.sessionData.address).toBeUndefined();
    expect(reply || '').toMatch(/pedido sigue igual/i);
    expect(reply || '').not.toMatch(/no manejamos \*mi tía/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('Nota con negación — sin picante y ají aparte', () => {
  const bowls = [
    { id: 17101, code: 17101, name: 'Ramen De Miso', price: 24000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 17102, code: 17102, name: 'Salsa De Aji', price: 2000, availableNow: true, hasAttributes: false, attributes: [] },
  ];
  const line = (id: number, name: string, price: number) => ({
    productId: id, code: id, name, unitPrice: price, quantity: 1, attributes: [] as { attributeName: string; attributeValue: string }[],
  });

  it.each([
    { agent: false, menu: products, text: 'un churrasco sin picante; el ají aparte', id: 17, banned: 38 },
    { agent: true, menu: products, text: 'un churrasco sin picante; el ají aparte', id: 17, banned: 38 },
    { agent: false, menu: bowls, text: 'un ramen de miso sin picante; el ají aparte', id: 17101, banned: 17102 },
    { agent: true, menu: bowls, text: 'un ramen de miso sin picante; el ají aparte', id: 17101, banned: 17102 },
  ])('guarda las dos notas y no compra el ají (agent $agent)', async ({ agent, menu, text, id, banned }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    const reply = await h.sendQueued(text);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id, qty: 1, note: expect.stringMatching(/sin picante/i) })]);
    expect(h.cartRows()[0].note || '').toMatch(/aj[ií] aparte/i);
    expect(h.cartRows().some((row) => row.id === banned)).toBe(false);
    expect(reply || '').toMatch(/sin picante/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each([
    { agent: false, menu: products, cart: [line(17, 'Churrasco', 38000)], banned: 38 },
    { agent: true, menu: products, cart: [line(17, 'Churrasco', 38000)], banned: 38 },
    { agent: false, menu: bowls, cart: [line(17101, 'Ramen De Miso', 24000)], banned: 17102 },
    { agent: true, menu: bowls, cart: [line(17101, 'Ramen De Miso', 24000)], banned: 17102 },
  ])('en un pedido ya armado no agrega el ají (agent $agent)', async ({ agent, menu, cart, banned }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    h.conv.sessionData.cart = cart;
    const reply = await h.sendQueued('sin picante; el ají aparte');
    expect(h.cartRows()).toHaveLength(1);
    expect(h.cartRows()[0].note || '').toMatch(/sin picante/i);
    expect(h.cartRows()[0].note || '').toMatch(/aj[ií] aparte/i);
    expect(h.cartRows().some((row) => row.id === banned)).toBe(false);
    expect(reply || '').toMatch(/nota/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each([
    { agent: false, menu: products, cart: [line(17, 'Churrasco', 38000)], text: 'Quítale lo picante al churrasco, pero el ají mándamelo en un tarrito aparte', id: 17, banned: 38 },
    { agent: true, menu: products, cart: [line(17, 'Churrasco', 38000)], text: 'Quítale lo picante al churrasco, pero el ají mándamelo en un tarrito aparte', id: 17, banned: 38 },
    { agent: false, menu: bowls, cart: [line(17101, 'Ramen De Miso', 24000)], text: 'Quítale lo picante al ramen de miso, pero el ají mándamelo en un tarrito aparte', id: 17101, banned: 17102 },
    { agent: true, menu: bowls, cart: [line(17101, 'Ramen De Miso', 24000)], text: 'Quítale lo picante al ramen de miso, pero el ají mándamelo en un tarrito aparte', id: 17101, banned: 17102 },
  ])('una frase distinta conserva las dos notas (agent $agent)', async ({ agent, menu, cart, text, id, banned }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    h.conv.sessionData.cart = cart;
    const reply = await h.sendQueued(text);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id, qty: 1 })]);
    expect(h.cartRows()[0].note || '').toMatch(/sin picante/i);
    expect(h.cartRows()[0].note || '').toMatch(/aj[ií] aparte/i);
    expect(h.cartRows().some((row) => row.id === banned)).toBe(false);
    expect(reply || '').toMatch(/sin picante/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('Cambio de destino — mejor recojo', () => {
  const bowls = [
    { id: 17201, code: 17201, name: 'Ramen De Miso', price: 24000, availableNow: true, hasAttributes: false, attributes: [] },
  ];
  const line = (id: number, name: string, price: number) => ({
    productId: id, code: id, name, unitPrice: price, quantity: 1, attributes: [] as { attributeName: string; attributeValue: string }[],
  });

  it.each([
    { agent: false, menu: products, item: line(17, 'Churrasco', 38000) },
    { agent: true, menu: products, item: line(17, 'Churrasco', 38000) },
    { agent: false, menu: bowls, item: line(17201, 'Ramen De Miso', 24000) },
    { agent: true, menu: bowls, item: line(17201, 'Ramen De Miso', 24000) },
  ])('quita el domicilio y conserva comida y pago (agent $agent)', async ({ agent, menu, item }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    h.conv.state = 'awaiting_address';
    h.conv.sessionData = {
      cart: [item],
      orderType: 'delivery',
      fulfillmentChosen: true,
      paymentMethod: 'cash',
      address: 'Calle 12 34 56',
      addressConfirmed: false,
    };
    const reply = await h.sendQueued('mejor recojo');
    expect(h.conv.sessionData.orderType).toBe('pickup');
    expect(h.conv.sessionData.paymentMethod).toBe('cash');
    expect(h.conv.sessionData.address || '').toMatch(/recoge en el local/i);
    expect(h.conv.sessionData.address || '').not.toMatch(/calle 12/i);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: item.productId, qty: 1 })]);
    expect(h.conv.state).not.toBe('awaiting_address');
    expect(reply || '').toMatch(/pasas tú|recoge/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('Carta que cambia — opción retirada', () => {
  const flavor = (id: number, name: string, options: string[]) => ({
    id, code: id, name, price: 18000, availableNow: true, hasAttributes: true,
    attributes: [{ attributeName: 'Sabor', options }],
  });
  const side = (id: number, name: string) => ({
    id, code: id, name, price: 7000, availableNow: true, hasAttributes: false, attributes: [] as [],
  });
  const line = (id: number, name: string, price: number) => ({
    productId: id, code: id, name, unitPrice: price, quantity: 1, attributes: [] as { attributeName: string; attributeValue: string }[],
  });
  const pending = (id: number, name: string, options: string[]) => ({
    productId: id, name, code: id, price: 18000,
    attributes: [{ attributeName: 'Sabor', options: [...options] }],
    selected: [] as { attributeName: string; attributeValue: string }[],
  });

  it.each([
    { agent: false, drink: flavor(50, 'Jugo Natural En Agua', ['Mango', 'Lulo']), sideItem: side(7, 'Porcion De Yuca Frita'), shown: ['Mango', 'Guanabana', 'Lulo'], gone: 'Guanabana', kept: 'Lulo' },
    { agent: true, drink: flavor(50, 'Jugo Natural En Agua', ['Mango', 'Lulo']), sideItem: side(7, 'Porcion De Yuca Frita'), shown: ['Mango', 'Guanabana', 'Lulo'], gone: 'Guanabana', kept: 'Lulo' },
    { agent: false, drink: flavor(17301, 'Ramen De Miso', ['Miso', 'Tonkotsu']), sideItem: side(17302, 'Edamame'), shown: ['Miso', 'Shoyu', 'Tonkotsu'], gone: 'Shoyu', kept: 'Tonkotsu' },
    { agent: true, drink: flavor(17301, 'Ramen De Miso', ['Miso', 'Tonkotsu']), sideItem: side(17302, 'Edamame'), shown: ['Miso', 'Shoyu', 'Tonkotsu'], gone: 'Shoyu', kept: 'Tonkotsu' },
  ])('el número de la opción retirada no cambia el resto (agent $agent)', async ({ agent, drink, sideItem, shown, gone, kept }) => {
    const h = harness([drink, sideItem] as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    h.conv.state = 'awaiting_attribute';
    h.conv.sessionData.cart = [line(sideItem.id, sideItem.name, sideItem.price)];
    h.conv.sessionData.pendingAttribute = pending(drink.id, drink.name, shown);
    const reply = await h.sendQueued('2');
    expect(reply || '').toMatch(new RegExp(gone, 'i'));
    expect(reply || '').toMatch(/no la apliqu/i);
    expect(h.cartRows().map((row) => row.id)).toEqual([sideItem.id]);
    expect(h.conv.sessionData.pendingAttribute?.attributes?.[0].options).not.toContain(gone);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    const follow = await h.sendQueued('2');
    expect(h.cartRows().find((row) => row.id === drink.id)?.attrs).toContain(`Sabor:${kept}`);
    expect(h.cartRows().some((row) => row.id === sideItem.id)).toBe(true);
    expect(follow || '').not.toMatch(new RegExp(gone, 'i'));
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each([false, true])('un plato retirado no se agrega y el acompañamiento queda (agent %s)', async (agent) => {
    const yuca = side(7, 'Porcion De Yuca Frita');
    const h = harness([yuca] as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    h.conv.state = 'awaiting_attribute';
    h.conv.sessionData.cart = [line(7, 'Porcion De Yuca Frita', 7000)];
    h.conv.sessionData.pendingAttribute = pending(50, 'Jugo Natural En Agua', ['Mango', 'Guanabana', 'Lulo']);
    const reply = await h.sendQueued('2');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 7, qty: 1 })]);
    expect(h.conv.sessionData.pendingAttribute).toBeUndefined();
    expect(reply || '').toMatch(/ya no está en la carta/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('Pedido y redimir en el mismo mensaje', () => {
  const ramen = [{ id: 17501, code: 17501, name: 'Ramen De Miso', price: 24000, availableNow: true, hasAttributes: false, attributes: [] }];
  const pointsFor = () => {
    let balance = 9;
    const redeem = jest.fn(async () => {
      balance -= 9;
      return { code: 'ABCD2345EFGH', expiresAt: null };
    });
    return {
      redeem,
      service: new WhatsappPointsService({
        getAvailablePoints: async () => balance,
        redeemPointsForVoucher: redeem,
      } as never),
    };
  };

  it.each([
    { agent: false, menu: products, text: 'agrega un medio pollo broaster y quiero redimir mis puntos', id: 5 },
    { agent: true, menu: products, text: 'agrega un medio pollo broaster y quiero redimir mis puntos', id: 5 },
    { agent: false, menu: ramen, text: 'agrega un ramen de miso y quiero generar un premio', id: 17501 },
    { agent: true, menu: ramen, text: 'agrega un ramen de miso y quiero generar un premio', id: 17501 },
  ])('genera el premio una vez y no lo aplica al plato (agent $agent)', async ({ agent, menu, text, id }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    const points = pointsFor();
    h.service.pointsHandler = points.service;
    h.conv.sessionData.linkedUserId = 'test-account';
    await h.sendQueued(text);
    expect(h.cartRows().find((row) => row.id === id)).toMatchObject({ qty: 1 });
    expect(h.cartRows()).toHaveLength(1);
    expect(h.conv.sessionData.pendingRedemptionCode).toBeFalsy();
    expect(points.redeem).toHaveBeenCalledTimes(1);
    expect(h.replies.join(' ')).toMatch(/premio generado/i);
    expect(h.replies.join(' ')).toMatch(/no lo apliqué/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each([false, true])('sin cuenta anota el plato y no genera el premio (agent %s)', async (agent) => {
    const h = harness(products, agent);
    h.service.ordersService.create = jest.fn();
    const points = pointsFor();
    h.service.pointsHandler = points.service;
    const reply = await h.sendQueued('agrega un medio pollo broaster y quiero redimir mis puntos');
    expect(h.cartRows().find((row) => row.id === 5)).toMatchObject({ qty: 1 });
    expect(h.conv.sessionData.pendingRedemptionCode).toBeFalsy();
    expect(points.redeem).not.toHaveBeenCalled();
    expect(h.replies.join(' ')).toMatch(/no lo generé/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each([
    { agent: false, menu: products, item: { productId: 17, code: 17, name: 'Churrasco', unitPrice: 38000, quantity: 1, attributes: [] as [] } },
    { agent: true, menu: ramen, item: { productId: 17501, code: 17501, name: 'Ramen De Miso', unitPrice: 24000, quantity: 1, attributes: [] as [] } },
  ])('una consulta no genera el premio ni cambia el pedido (agent $agent)', async ({ agent, menu, item }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    const points = pointsFor();
    h.service.pointsHandler = points.service;
    h.conv.sessionData.linkedUserId = 'test-account';
    h.conv.sessionData.cart = [item];
    const before = structuredClone(h.cartRows());
    const reply = await h.sendQueued('¿agrego otro plato y quiero redimir mis puntos?');
    expect(h.cartRows()).toEqual(before);
    expect(h.conv.sessionData.pendingRedemptionCode).toBeFalsy();
    expect(points.redeem).not.toHaveBeenCalled();
    expect(reply || '').toMatch(/no generé el premio/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each([
    { agent: false, menu: products, text: 'agrega un medio pollo broaster, quiero redimir y aplicalo a este pedido', id: 5 },
    { agent: true, menu: products, text: 'agrega un medio pollo broaster, quiero redimir y aplicalo a este pedido', id: 5 },
    { agent: false, menu: ramen, text: 'agrega un ramen de miso, quiero generar un premio y aplicalo a este pedido', id: 17501 },
    { agent: true, menu: ramen, text: 'agrega un ramen de miso, quiero generar un premio y aplicalo a este pedido', id: 17501 },
  ])('solo lo anota si el mismo mensaje lo pide (agent $agent)', async ({ agent, menu, text, id }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    const points = pointsFor();
    h.service.pointsHandler = points.service;
    h.conv.sessionData.linkedUserId = 'test-account';
    await h.sendQueued(text);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id, qty: 1 })]);
    expect(h.conv.sessionData.pendingRedemptionCode).toBe('ABCD2345EFGH');
    expect(points.redeem).toHaveBeenCalledTimes(1);
    expect(h.replies.join(' ')).toMatch(/lo dejé anotado/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each([
    { agent: false, menu: products, first: 'agrega un medio pollo broaster y quiero redimir mis puntos', id: 5 },
    { agent: true, menu: ramen, first: 'agrega un ramen de miso y quiero generar un premio', id: 17501 },
  ])('un sí después no recupera el código de la respuesta anterior (agent $agent)', async ({ agent, menu, first, id }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    const points = pointsFor();
    h.service.pointsHandler = points.service;
    h.conv.sessionData.linkedUserId = 'test-account';
    await h.sendQueued(first);
    expect(h.conv.sessionData.pendingRedemptionCode).toBeFalsy();
    const reply = await h.sendQueued('sí, aplícalo');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id, qty: 1 })]);
    expect(h.conv.sessionData.pendingRedemptionCode).toBeFalsy();
    expect(points.redeem).toHaveBeenCalledTimes(1);
    expect(reply || '').toMatch(/no apliqué el premio/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('Nombre de 12 letras — no es un código', () => {
  const burgers = [{ id: 17601, code: 17601, name: 'Greenteaburg', price: 22000, availableNow: true, hasAttributes: false, attributes: [] }];
  const ramen = [{ id: 17602, code: 17602, name: 'Cheddarbugrx', price: 24000, availableNow: true, hasAttributes: false, attributes: [] }];

  it.each([
    { agent: false, menu: burgers, text: 'Greenteaburg', id: 17601 },
    { agent: true, menu: burgers, text: 'Greenteaburg', id: 17601 },
    { agent: false, menu: ramen, text: 'Cheddarbugrx', id: 17602 },
    { agent: true, menu: ramen, text: 'Cheddarbugrx', id: 17602 },
  ])('el nombre del plato no se registra como factura (agent $agent)', async ({ agent, menu, text, id }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    const validate = jest.fn(async () => { throw new Error('no debe validar el nombre'); });
    const register = jest.fn();
    h.service.pointsHandler = new WhatsappPointsService({
      getAvailablePoints: async () => 0,
      validateRedemptionCode: validate,
      registerPointByCode: register,
    } as never);
    h.conv.sessionData.linkedUserId = 'test-account';
    await h.sendQueued(text);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id, qty: 1 })]);
    expect(h.conv.sessionData.pendingRedemptionCode).toBeFalsy();
    expect(validate).not.toHaveBeenCalled();
    expect(register).not.toHaveBeenCalled();
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each([false, true])('un código real sigue siendo código y la sobrebarriga sigue siendo plato (agent %s)', async (agent) => {
    const h = harness(products, agent);
    h.service.ordersService.create = jest.fn();
    const validate = jest.fn(async () => ({ code: 'ABCD2345EFGH', userId: 'test-account', expiresAt: null }));
    const register = jest.fn();
    h.service.pointsHandler = new WhatsappPointsService({
      getAvailablePoints: async () => 0,
      validateRedemptionCode: validate,
      registerPointByCode: register,
    } as never);
    h.conv.sessionData.linkedUserId = 'test-account';
    await h.sendQueued('ABCD2345EFGH');
    expect(h.cartRows()).toEqual([]);
    expect(h.conv.sessionData.pendingRedemptionCode).toBe('ABCD2345EFGH');
    expect(validate).toHaveBeenCalledTimes(1);
    expect(register).not.toHaveBeenCalled();
    await h.sendQueued('Sobrebarriga');
    const dish = h.cartRows().some((row) => row.id === 13) || h.conv.sessionData.pendingAttribute?.productId === 13;
    expect(dish).toBe(true);
    expect(h.conv.sessionData.pendingRedemptionCode).toBe('ABCD2345EFGH');
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('Saldo parcial — la opción pendiente no se pierde', () => {
  const ramen = [
    { id: 17701, code: 17701, name: 'Ramen De Miso', price: 24000, availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Sabor', options: ['Miso', 'Shoyu'] }] },
    { id: 17702, code: 17702, name: 'Edamame', price: 8000, availableNow: true, hasAttributes: false, attributes: [] },
  ];
  const line = (id: number, name: string, price: number) => ({
    productId: id, code: id, name, unitPrice: price, quantity: 1, attributes: [] as [],
  });
  const pending = (id: number, name: string, options: string[]) => ({
    productId: id, name, code: id, price: 5000,
    attributes: [{ attributeName: 'Sabor', options }],
    selected: [] as { attributeName: string; attributeValue: string }[],
  });

  it.each([
    { agent: false, menu: products, side: line(7, 'Porcion De Yuca Frita', 7000), open: pending(50, 'Jugo Natural En Agua', ['Mango', 'Guanabana', 'Lulo']) },
    { agent: true, menu: products, side: line(7, 'Porcion De Yuca Frita', 7000), open: pending(50, 'Jugo Natural En Agua', ['Mango', 'Guanabana', 'Lulo']) },
    { agent: false, menu: ramen, side: line(17702, 'Edamame', 8000), open: pending(17701, 'Ramen De Miso', ['Miso', 'Shoyu']) },
    { agent: true, menu: ramen, side: line(17702, 'Edamame', 8000), open: pending(17701, 'Ramen De Miso', ['Miso', 'Shoyu']) },
  ])('con 4 puntos no gasta y deja la lista abierta (agent $agent)', async ({ agent, menu, side, open }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    const redeem = jest.fn();
    h.service.pointsHandler = new WhatsappPointsService({
      getAvailablePoints: async () => 4,
      redeemPointsForVoucher: redeem,
    } as never);
    h.conv.sessionData.linkedUserId = 'test-account';
    h.conv.state = 'awaiting_attribute';
    h.conv.sessionData.cart = [side];
    h.conv.sessionData.pendingAttribute = open;
    const reply = await h.sendQueued('quiero redimir mis puntos');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: side.productId, qty: 1 })]);
    expect(h.conv.sessionData.pendingAttribute?.productId).toBe(open.productId);
    expect(redeem).not.toHaveBeenCalled();
    expect(reply || '').toMatch(/4/);
    expect(reply || '').toMatch(/9/);
    expect(reply || '').toMatch(/pedido sigue igual/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('Corrección después del premio', () => {
  const bowls = [
    { id: 17801, code: 17801, name: 'Ramen De Miso', price: 24000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 17802, code: 17802, name: 'Ramen De Shoyu', price: 25000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 17803, code: 17803, name: 'Edamame', price: 8000, availableNow: true, hasAttributes: false, attributes: [] },
  ];
  const line = (id: number, name: string, price: number) => ({
    productId: id, code: id, name, unitPrice: price, quantity: 1, attributes: [] as { attributeName: string; attributeValue: string }[],
  });

  it.each([
    {
      agent: false,
      menu: products,
      cart: [line(5, '1/2 Pollo Broaster', 25000), line(7, 'Porcion De Yuca Frita', 7000)],
      text: 'cambia el medio broaster por el medio frito',
      gone: 5,
      next: 2,
      keep: 7,
    },
    {
      agent: true,
      menu: products,
      cart: [line(5, '1/2 Pollo Broaster', 25000), line(7, 'Porcion De Yuca Frita', 7000)],
      text: 'cambia el medio broaster por el medio frito',
      gone: 5,
      next: 2,
      keep: 7,
    },
    {
      agent: false,
      menu: bowls,
      cart: [line(17801, 'Ramen De Miso', 24000), line(17803, 'Edamame', 8000)],
      text: 'cambia el ramen de miso por el ramen de shoyu',
      gone: 17801,
      next: 17802,
      keep: 17803,
    },
    {
      agent: true,
      menu: bowls,
      cart: [line(17801, 'Ramen De Miso', 24000), line(17803, 'Edamame', 8000)],
      text: 'cambia el ramen de miso por el ramen de shoyu',
      gone: 17801,
      next: 17802,
      keep: 17803,
    },
  ])('cambia el plato y conserva el premio y el acompañamiento (agent $agent)', async ({ agent, menu, cart, text, gone, next, keep }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    const redeem = jest.fn();
    h.service.pointsHandler = new WhatsappPointsService({ redeemPointsForVoucher: redeem } as never);
    h.conv.sessionData.cart = cart;
    h.conv.sessionData.pendingRedemptionCode = 'ABCD2345EFGH';
    await h.sendQueued(text);
    expect(h.cartRows().some((row) => row.id === gone)).toBe(false);
    expect(h.cartRows().find((row) => row.id === next)?.qty).toBe(1);
    expect(h.cartRows().find((row) => row.id === keep)?.qty).toBe(1);
    expect(h.cartRows()).toHaveLength(2);
    expect(h.conv.sessionData.pendingRedemptionCode).toBe('ABCD2345EFGH');
    expect(redeem).not.toHaveBeenCalled();
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('Cancelación ambigua — dos platos coinciden', () => {
  const bowls = [
    { id: 17901, code: 17901, name: 'Combo De Pasta', price: 28000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 17902, code: 17902, name: 'Combo De Ramen', price: 26000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 17903, code: 17903, name: 'Edamame', price: 8000, availableNow: true, hasAttributes: false, attributes: [] },
  ];
  const row = (id: number, name: string, price: number, quantity = 1) => ({
    productId: id, code: id, name, unitPrice: price, quantity, attributes: [] as { attributeName: string; attributeValue: string }[],
  });

  it.each([
    { agent: false, menu: products, cart: [row(99, 'Combo De Pollo Frito', 49000, 2), row(98, 'Combo De Pollo Broaster', 47000), row(7, 'Porcion De Yuca Frita', 7000)] },
    { agent: true, menu: products, cart: [row(99, 'Combo De Pollo Frito', 49000, 2), row(98, 'Combo De Pollo Broaster', 47000), row(7, 'Porcion De Yuca Frita', 7000)] },
    { agent: false, menu: bowls, cart: [row(17901, 'Combo De Pasta', 28000, 2), row(17902, 'Combo De Ramen', 26000), row(17903, 'Edamame', 8000)] },
    { agent: true, menu: bowls, cart: [row(17901, 'Combo De Pasta', 28000, 2), row(17902, 'Combo De Ramen', 26000), row(17903, 'Edamame', 8000)] },
  ])('cancela el combo pregunta cuál y no toca el premio (agent $agent)', async ({ agent, menu, cart }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    h.conv.sessionData.cart = cart;
    h.conv.sessionData.pendingRedemptionCode = 'ABCD2345EFGH';
    const before = h.cartRows();
    const reply = await h.sendQueued('cancela el combo');
    expect(h.cartRows()).toEqual(before);
    expect(h.conv.sessionData.pendingRedemptionCode).toBe('ABCD2345EFGH');
    expect(reply || '').toMatch(/cuál quitamos/i);
    expect(h.conv.state).not.toBe('closed');
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('Bebida de 400 — no va aparte', () => {
  const bowls = [
    { id: 18001, code: 18001, name: 'Combo De Ramen', price: 32000, availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Bebida', options: ['Te Verde', 'Limonada'] }] },
    { id: 18002, code: 18002, name: 'Te Helado 400ml', price: 6000, availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Sabor', options: ['Te Verde', 'Matcha'] }] },
    { id: 18003, code: 18003, name: 'Edamame', price: 8000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 18004, code: 18004, name: 'Combo De Pasta', price: 30000, availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Bebida', options: ['Te Verde', 'Limonada'] }] },
  ];
  const drink = (id: number, name: string, price: number, flavor: string, flavorName = 'Sabor') => ({
    productId: id, code: id, name, unitPrice: price, quantity: 1,
    attributes: [{ attributeName: flavorName, attributeValue: flavor }],
  });
  const side = (id: number, name: string, price: number) => ({
    productId: id, code: id, name, unitPrice: price, quantity: 1, attributes: [] as { attributeName: string; attributeValue: string }[],
  });

  it.each([
    {
      agent: false,
      menu: products,
      cart: [drink(99, 'Combo De Pollo Frito', 49000, 'Colombiana', 'Bebida'), drink(28, 'Gaseosa 400ml', 4000, 'Pepsi'), side(7, 'Porcion De Yuca Frita', 7000)],
      text: 'la gaseosa de 400 no va aparte, es la del combo',
      host: 99,
      gone: 28,
      keep: 7,
      flavor: 'Bebida:Pepsi',
    },
    {
      agent: true,
      menu: products,
      cart: [drink(99, 'Combo De Pollo Frito', 49000, 'Colombiana', 'Bebida'), drink(28, 'Gaseosa 400ml', 4000, 'Pepsi'), side(7, 'Porcion De Yuca Frita', 7000)],
      text: 'la gaseosa de 400 no va aparte, es la del combo',
      host: 99,
      gone: 28,
      keep: 7,
      flavor: 'Bebida:Pepsi',
    },
    {
      agent: false,
      menu: bowls,
      cart: [drink(18001, 'Combo De Ramen', 32000, 'Limonada', 'Bebida'), drink(18002, 'Te Helado 400ml', 6000, 'Te Verde'), side(18003, 'Edamame', 8000)],
      text: 'el te helado de 400 no va aparte, es la bebida del combo',
      host: 18001,
      gone: 18002,
      keep: 18003,
      flavor: 'Bebida:Te Verde',
    },
    {
      agent: true,
      menu: bowls,
      cart: [drink(18001, 'Combo De Ramen', 32000, 'Limonada', 'Bebida'), drink(18002, 'Te Helado 400ml', 6000, 'Te Verde'), side(18003, 'Edamame', 8000)],
      text: 'el te helado de 400 no va aparte, es la bebida del combo',
      host: 18001,
      gone: 18002,
      keep: 18003,
      flavor: 'Bebida:Te Verde',
    },
  ])('pasa el sabor al combo y quita la botella (agent $agent)', async ({ agent, menu, cart, text, host, gone, keep, flavor }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    const hostLine = cart[0];
    hostLine.attributes = [...hostLine.attributes, { attributeName: 'Arepas', attributeValue: 'Blancas' }];
    h.conv.sessionData.cart = cart;
    const reply = await h.sendQueued(text);
    expect(h.cartRows().some((row) => row.id === gone)).toBe(false);
    expect(h.cartRows().find((row) => row.id === host)?.qty).toBe(1);
    expect(h.cartRows().find((row) => row.id === host)?.attrs).toEqual(expect.arrayContaining([flavor, 'Arepas:Blancas']));
    expect(h.cartRows().find((row) => row.id === keep)?.qty).toBe(1);
    expect(h.cartRows()).toHaveLength(2);
    expect(reply || '').toMatch(/pedido sigue igual/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each([
    {
      agent: false,
      menu: products,
      cart: [
        drink(99, 'Combo De Pollo Frito', 49000, 'Colombiana', 'Bebida'),
        drink(98, 'Combo De Pollo Broaster', 50000, 'Manzana', 'Bebida'),
        drink(28, 'Gaseosa 400ml', 4000, 'Pepsi'),
        side(7, 'Porcion De Yuca Frita', 7000),
      ],
      text: 'la gaseosa de 400 no va aparte, es la del combo',
    },
    {
      agent: true,
      menu: products,
      cart: [
        drink(99, 'Combo De Pollo Frito', 49000, 'Colombiana', 'Bebida'),
        drink(98, 'Combo De Pollo Broaster', 50000, 'Manzana', 'Bebida'),
        drink(28, 'Gaseosa 400ml', 4000, 'Pepsi'),
        side(7, 'Porcion De Yuca Frita', 7000),
      ],
      text: 'la gaseosa de 400 no va aparte, es la del combo',
    },
    {
      agent: false,
      menu: bowls,
      cart: [
        drink(18001, 'Combo De Ramen', 32000, 'Limonada', 'Bebida'),
        drink(18004, 'Combo De Pasta', 30000, 'Limonada', 'Bebida'),
        drink(18002, 'Te Helado 400ml', 6000, 'Te Verde'),
        side(18003, 'Edamame', 8000),
      ],
      text: 'el te helado de 400 no va aparte, es la bebida del combo',
    },
    {
      agent: true,
      menu: bowls,
      cart: [
        drink(18001, 'Combo De Ramen', 32000, 'Limonada', 'Bebida'),
        drink(18004, 'Combo De Pasta', 30000, 'Limonada', 'Bebida'),
        drink(18002, 'Te Helado 400ml', 6000, 'Te Verde'),
        side(18003, 'Edamame', 8000),
      ],
      text: 'el te helado de 400 no va aparte, es la bebida del combo',
    },
  ])('con dos platos pregunta cuál y no borra la botella (agent $agent)', async ({ agent, menu, cart, text }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    h.conv.sessionData.cart = cart;
    const before = h.cartRows();
    const reply = await h.sendQueued(text);
    expect(h.cartRows()).toEqual(before);
    expect(reply || '').toMatch(/más de un plato con bebida/i);
    expect(reply || '').toMatch(/pedido sigue igual/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each([false, true])('un sabor que el combo no tiene no quita la botella (agent %s)', async (agent) => {
    const h = harness(bowls as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    h.conv.sessionData.cart = [
      drink(18001, 'Combo De Ramen', 32000, 'Limonada', 'Bebida'),
      drink(18002, 'Te Helado 400ml', 6000, 'Matcha'),
      side(18003, 'Edamame', 8000),
    ];
    const before = h.cartRows();
    const reply = await h.sendQueued('el te helado de 400 no va aparte, es la bebida del combo');
    expect(h.cartRows()).toEqual(before);
    expect(reply || '').toMatch(/no está entre las bebidas/i);
    expect(reply || '').toMatch(/pedido sigue igual/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each([
    { agent: false, menu: products, cart: [drink(99, 'Combo De Pollo Frito', 49000, 'Colombiana', 'Bebida'), drink(28, 'Gaseosa 400ml', 4000, 'Pepsi'), side(7, 'Porcion De Yuca Frita', 7000)], text: 'la gaseosa de 400 va aparte' },
    { agent: true, menu: products, cart: [drink(99, 'Combo De Pollo Frito', 49000, 'Colombiana', 'Bebida'), drink(28, 'Gaseosa 400ml', 4000, 'Pepsi'), side(7, 'Porcion De Yuca Frita', 7000)], text: 'la gaseosa de 400 va aparte' },
    { agent: false, menu: bowls, cart: [drink(18001, 'Combo De Ramen', 32000, 'Limonada', 'Bebida'), drink(18002, 'Te Helado 400ml', 6000, 'Te Verde'), side(18003, 'Edamame', 8000)], text: 'el te helado de 400 va aparte' },
    { agent: true, menu: bowls, cart: [drink(18001, 'Combo De Ramen', 32000, 'Limonada', 'Bebida'), drink(18002, 'Te Helado 400ml', 6000, 'Te Verde'), side(18003, 'Edamame', 8000)], text: 'el te helado de 400 va aparte' },
  ])('si ya está suelta, va aparte no suma otra (agent $agent)', async ({ agent, menu, cart, text }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    h.conv.sessionData.cart = cart;
    const before = h.cartRows();
    const reply = await h.sendQueued(text);
    expect(h.cartRows()).toEqual(before);
    expect(reply || '').toMatch(/ya está aparte/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('Después del premio — dirección, pago y cantidad', () => {
  const bowls = [
    { id: 18101, code: 18101, name: 'Ramen De Miso', price: 24000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 18102, code: 18102, name: 'Edamame', price: 8000, availableNow: true, hasAttributes: false, attributes: [] },
  ];
  const line = (id: number, name: string, price: number, quantity = 1) => ({
    productId: id, code: id, name, unitPrice: price, quantity, attributes: [] as { attributeName: string; attributeValue: string }[],
  });
  const seed = (agent: boolean, menu: typeof products, cart: ReturnType<typeof line>[]) => {
    const h = harness(menu, agent);
    h.service.ordersService.create = jest.fn();
    const redeem = jest.fn();
    h.service.pointsHandler = new WhatsappPointsService({ redeemPointsForVoucher: redeem } as never);
    h.conv.sessionData.cart = cart;
    h.conv.sessionData.pendingRedemptionCode = 'ABCD2345EFGH';
    return { h, redeem };
  };

  it.each([
    { agent: false, menu: products, cart: [line(5, '1/2 Pollo Broaster', 25000), line(7, 'Porcion De Yuca Frita', 7000)] },
    { agent: true, menu: products, cart: [line(5, '1/2 Pollo Broaster', 25000), line(7, 'Porcion De Yuca Frita', 7000)] },
    { agent: false, menu: bowls, cart: [line(18101, 'Ramen De Miso', 24000), line(18102, 'Edamame', 8000)] },
    { agent: true, menu: bowls, cart: [line(18101, 'Ramen De Miso', 24000), line(18102, 'Edamame', 8000)] },
  ])('la calle no borra el premio ni el pedido (agent $agent)', async ({ agent, menu, cart }) => {
    const { h, redeem } = seed(agent, menu as typeof products, cart);
    h.conv.state = 'awaiting_address';
    Object.assign(h.conv.sessionData, { orderType: 'delivery', fulfillmentChosen: true, addressConfirmed: false });
    const before = h.cartRows();
    await h.sendQueued('Calle 15 25 35');
    expect(h.cartRows()).toEqual(before);
    expect(h.conv.sessionData.address || '').toMatch(/15/);
    expect(h.conv.sessionData.address || '').toMatch(/25/);
    expect(h.conv.sessionData.pendingRedemptionCode).toBe('ABCD2345EFGH');
    expect(redeem).not.toHaveBeenCalled();
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each([
    { agent: false, menu: products, cart: [line(5, '1/2 Pollo Broaster', 25000), line(7, 'Porcion De Yuca Frita', 7000)] },
    { agent: true, menu: products, cart: [line(5, '1/2 Pollo Broaster', 25000), line(7, 'Porcion De Yuca Frita', 7000)] },
    { agent: false, menu: bowls, cart: [line(18101, 'Ramen De Miso', 24000), line(18102, 'Edamame', 8000)] },
    { agent: true, menu: bowls, cart: [line(18101, 'Ramen De Miso', 24000), line(18102, 'Edamame', 8000)] },
  ])('el efectivo no cobra ni pierde el premio (agent $agent)', async ({ agent, menu, cart }) => {
    const { h, redeem } = seed(agent, menu as typeof products, cart);
    h.conv.state = 'awaiting_payment';
    Object.assign(h.conv.sessionData, {
      orderType: 'delivery', fulfillmentChosen: true, address: 'Calle 15 25 35', addressConfirmed: true,
    });
    const before = h.cartRows();
    await h.sendQueued('efectivo');
    expect(h.cartRows()).toEqual(before);
    expect(h.conv.sessionData.paymentMethod).toBe('cash');
    expect(h.conv.sessionData.pendingRedemptionCode).toBe('ABCD2345EFGH');
    expect(redeem).not.toHaveBeenCalled();
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each([
    { agent: false, menu: products, cart: [line(5, '1/2 Pollo Broaster', 25000), line(7, 'Porcion De Yuca Frita', 7000)], text: 'deja dos broaster', id: 5, side: 7 },
    { agent: true, menu: products, cart: [line(5, '1/2 Pollo Broaster', 25000), line(7, 'Porcion De Yuca Frita', 7000)], text: 'deja dos broaster', id: 5, side: 7 },
    { agent: false, menu: bowls, cart: [line(18101, 'Ramen De Miso', 24000), line(18102, 'Edamame', 8000)], text: 'deja dos ramen', id: 18101, side: 18102 },
    { agent: true, menu: bowls, cart: [line(18101, 'Ramen De Miso', 24000), line(18102, 'Edamame', 8000)], text: 'deja dos ramen', id: 18101, side: 18102 },
  ])('la cantidad cambia y el premio sigue (agent $agent)', async ({ agent, menu, cart, text, id, side }) => {
    const { h, redeem } = seed(agent, menu as typeof products, cart);
    await h.sendQueued(text);
    expect(h.cartRows().find((row) => row.id === id)?.qty).toBe(2);
    expect(h.cartRows().find((row) => row.id === side)?.qty).toBe(1);
    expect(h.cartRows()).toHaveLength(2);
    expect(h.conv.sessionData.pendingRedemptionCode).toBe('ABCD2345EFGH');
    expect(redeem).not.toHaveBeenCalled();
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('Quitar el premio — la comida se queda', () => {
  const bowls = [
    { id: 18201, code: 18201, name: 'Ramen De Miso', price: 24000, availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Sabor', options: ['Miso', 'Shoyu'] }] },
    { id: 18202, code: 18202, name: 'Edamame', price: 8000, availableNow: true, hasAttributes: false, attributes: [] },
  ];
  const line = (id: number, name: string, price: number) => ({
    productId: id, code: id, name, unitPrice: price, quantity: 1, attributes: [] as { attributeName: string; attributeValue: string }[],
  });

  it.each([
    { agent: false, menu: products, cart: [line(5, '1/2 Pollo Broaster', 25000), line(7, 'Porcion De Yuca Frita', 7000)], text: 'quita el premio' },
    { agent: true, menu: products, cart: [line(5, '1/2 Pollo Broaster', 25000), line(7, 'Porcion De Yuca Frita', 7000)], text: 'quita el premio' },
    { agent: false, menu: bowls, cart: [line(18201, 'Ramen De Miso', 24000), line(18202, 'Edamame', 8000)], text: 'no uses el premio' },
    { agent: true, menu: bowls, cart: [line(18201, 'Ramen De Miso', 24000), line(18202, 'Edamame', 8000)], text: 'deja el pedido sin premio' },
  ])('saca el código y conserva los platos (agent $agent)', async ({ agent, menu, cart, text }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    const redeem = jest.fn();
    h.service.pointsHandler = new WhatsappPointsService({ redeemPointsForVoucher: redeem } as never);
    h.conv.sessionData.cart = cart;
    h.conv.sessionData.pendingRedemptionCode = 'ABCD2345EFGH';
    const before = h.cartRows();
    const reply = await h.sendQueued(text);
    expect(h.cartRows()).toEqual(before);
    expect(h.conv.sessionData.pendingRedemptionCode).toBeFalsy();
    expect(reply || '').toMatch(/quité el premio/i);
    expect(redeem).not.toHaveBeenCalled();
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each([false, true])('una pregunta no lo quita (agent %s)', async (agent) => {
    const h = harness(products, agent);
    h.service.ordersService.create = jest.fn();
    h.conv.sessionData.cart = [line(17, 'Churrasco', 38000)];
    h.conv.sessionData.pendingRedemptionCode = 'ABCD2345EFGH';
    const before = h.cartRows();
    const reply = await h.sendQueued('¿quito el premio?');
    expect(h.cartRows()).toEqual(before);
    expect(h.conv.sessionData.pendingRedemptionCode).toBe('ABCD2345EFGH');
    expect(reply || '').toMatch(/sigue anotado/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each([false, true])('sin premio anotado no toca el pedido (agent %s)', async (agent) => {
    const h = harness(products, agent);
    h.service.ordersService.create = jest.fn();
    h.conv.sessionData.cart = [line(17, 'Churrasco', 38000), line(7, 'Porcion De Yuca Frita', 7000)];
    const before = h.cartRows();
    const reply = await h.sendQueued('quita el premio');
    expect(h.cartRows()).toEqual(before);
    expect(h.conv.sessionData.pendingRedemptionCode).toBeFalsy();
    expect(reply || '').toMatch(/no hay un premio/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each([
    { agent: false, menu: products, cart: [line(7, 'Porcion De Yuca Frita', 7000)], pendingId: 50, pendingName: 'Jugo Natural En Agua' },
    { agent: true, menu: bowls, cart: [line(18202, 'Edamame', 8000)], pendingId: 18201, pendingName: 'Ramen De Miso' },
  ])('la lista abierta sigue después de quitar el premio (agent $agent)', async ({ agent, menu, cart, pendingId, pendingName }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    h.conv.state = 'awaiting_attribute';
    h.conv.sessionData.cart = cart;
    h.conv.sessionData.pendingRedemptionCode = 'ABCD2345EFGH';
    h.conv.sessionData.pendingAttribute = {
      productId: pendingId, code: pendingId, name: pendingName, price: 5000,
      attributes: [{ attributeName: 'Sabor', options: ['Mango', 'Lulo'] }], selected: [], quantity: 1,
    };
    const reply = await h.sendQueued('quita el premio');
    expect(h.cartRows()).toEqual(cart.map((item) => ({ id: item.productId, qty: 1, note: undefined, attrs: [] })));
    expect(h.conv.sessionData.pendingAttribute?.productId).toBe(pendingId);
    expect(h.conv.sessionData.pendingRedemptionCode).toBeFalsy();
    expect(h.conv.state).toBe('awaiting_attribute');
    expect(reply || '').toMatch(/quité el premio/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('Uno sin cebolla y el otro normal', () => {
  const bowls = [
    { id: 18301, code: 18301, name: 'Ramen De Miso', price: 24000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 18302, code: 18302, name: 'Edamame', price: 8000, availableNow: true, hasAttributes: false, attributes: [] },
  ];
  const line = (id: number, name: string, price: number, quantity: number) => ({
    productId: id, code: id, name, unitPrice: price, quantity, attributes: [] as { attributeName: string; attributeValue: string }[],
  });

  it.each([
    { agent: false, menu: products, item: line(17, 'Churrasco', 38000, 2) },
    { agent: true, menu: products, item: line(17, 'Churrasco', 38000, 2) },
    { agent: false, menu: bowls, item: line(18301, 'Ramen De Miso', 24000, 2) },
    { agent: true, menu: bowls, item: line(18301, 'Ramen De Miso', 24000, 2) },
  ])('parte la línea en una con nota y otra normal (agent $agent)', async ({ agent, menu, item }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    h.conv.sessionData.cart = [item];
    await h.sendQueued('uno sin cebolla y el otro normal');
    const rows = h.cartRows().filter((row) => row.id === item.productId);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.qty).sort()).toEqual([1, 1]);
    expect(rows.filter((row) => /sin cebolla/i.test(row.note || ''))).toHaveLength(1);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each([
    { agent: false, menu: products, cart: [line(17, 'Churrasco', 38000, 2), line(7, 'Porcion De Yuca Frita', 7000, 1)] },
    { agent: true, menu: products, cart: [line(17, 'Churrasco', 38000, 2), line(7, 'Porcion De Yuca Frita', 7000, 1)] },
    { agent: false, menu: bowls, cart: [line(18301, 'Ramen De Miso', 24000, 2), line(18302, 'Edamame', 8000, 1)] },
    { agent: true, menu: bowls, cart: [line(18301, 'Ramen De Miso', 24000, 2), line(18302, 'Edamame', 8000, 1)] },
  ])('con dos platos pregunta cuál y no parte ninguno (agent $agent)', async ({ agent, menu, cart }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    h.conv.sessionData.cart = cart;
    const before = h.cartRows();
    const reply = await h.sendQueued('uno sin cebolla y el otro normal');
    expect(h.cartRows()).toEqual(before);
    expect(reply || '').toMatch(/cuál producto/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('La cuenta — varios restaurantes', () => {
  const dish = (id: number, name: string, price: number, quantity = 1) => ({
    id, code: id, name, price, availableNow: true, hasAttributes: false, attributes: [] as { attributeName: string; options: string[] }[],
    cart: { productId: id, code: id, name, unitPrice: price, quantity, attributes: [] as { attributeName: string; attributeValue: string }[] },
  });
  const restaurants = [
    { kind: 'ppp', menu: products, lines: [dish(17, 'Churrasco', 38000), dish(7, 'Porcion De Yuca Frita', 7000)], text: 'cuánto te debo' },
    { kind: 'pizza', menu: [dish(18401, 'Pizza Margarita', 28000), dish(18402, 'Ensalada Verde', 8000)], lines: [dish(18401, 'Pizza Margarita', 28000), dish(18402, 'Ensalada Verde', 8000)], text: 'pásame la cuenta' },
    { kind: 'sushi', menu: [dish(18411, 'Roll De Salmon', 22000), dish(18412, 'Sopa Miso', 7000)], lines: [dish(18411, 'Roll De Salmon', 22000, 2)], text: 'la cuenta por favor' },
    { kind: 'tacos', menu: [dish(18421, 'Taco Al Pastor', 16000), dish(18422, 'Guacamole', 5000)], lines: [dish(18421, 'Taco Al Pastor', 16000, 3)], text: 'cuánto les debo' },
    { kind: 'burger', menu: [dish(18431, 'Hamburguesa De Lentejas', 18000), dish(18432, 'Papas Gajo', 6000)], lines: [dish(18431, 'Hamburguesa De Lentejas', 18000), dish(18432, 'Papas Gajo', 6000)], text: 'me dices la cuenta' },
    { kind: 'pasta', menu: [dish(18441, 'Pasta Al Pesto', 26000), dish(18442, 'Pan De Ajo', 4000)], lines: [dish(18441, 'Pasta Al Pesto', 26000)], text: 'cuánto va el pedido' },
    { kind: 'bowl', menu: [dish(18451, 'Bowl De Quinoa', 19000), dish(18452, 'Agua De Coco', 5000)], lines: [dish(18451, 'Bowl De Quinoa', 19000, 2)], text: 'cuánto te debo' },
    { kind: 'ramen', menu: [dish(18461, 'Ramen De Miso', 24000), dish(18462, 'Gyoza', 9000)], lines: [dish(18461, 'Ramen De Miso', 24000), dish(18462, 'Gyoza', 9000)], text: 'pásame la cuenta' },
  ];

  it.each(restaurants.flatMap((place) => [false, true].map((agent) => ({ ...place, agent }))))(
    '$kind dice el total y no cambia el pedido (agent $agent)',
    async ({ menu, lines, text, agent }) => {
      const h = harness(menu as typeof products, agent);
      h.service.ordersService.create = jest.fn();
      h.conv.sessionData.cart = lines.map((item) => item.cart);
      const before = h.cartRows();
      const total = lines.reduce((sum, item) => sum + item.price * item.cart.quantity, 0);
      const reply = await h.sendQueued(text);
      expect(h.cartRows()).toEqual(before);
      expect(reply || '').toMatch(new RegExp(total.toLocaleString('es-CO').replace(/\./g, '\\.')));
      expect(reply || '').toMatch(/pedido sigue igual/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    },
  );

  it.each(['pizza', 'sushi', 'tacos', 'pasta', 'bowl', 'ramen', 'burger'].flatMap((kind) => [false, true].map((agent) => ({ kind, agent }))))(
    '$kind sin platos no inventa un total (agent $agent)',
    async ({ kind, agent }) => {
      const place = restaurants.find((item) => item.kind === kind)!;
      const h = harness(place.menu as typeof products, agent);
      h.service.ordersService.create = jest.fn();
      const reply = await h.sendQueued(place.text);
      expect(h.cartRows()).toEqual([]);
      expect(reply || '').toMatch(/no hay total/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    },
  );
});

describe('Alergia — el ingrediente no se compra', () => {
  const place = (id: number, name: string, price: number) => ({
    id, code: id, name, price, availableNow: true, hasAttributes: false, attributes: [] as { attributeName: string; options: string[] }[],
  });
  const cases = [
    { kind: 'ppp', menu: products, text: 'Soy alérgico a la yuca. Un churrasco', host: 17, banned: 7, qty: 1, label: /yuca/i },
    { kind: 'pizza', menu: [place(18501, 'Pizza Margarita', 28000), place(18502, 'Aceitunas', 4000)], text: 'Soy alérgico a las aceitunas. Una pizza margarita', host: 18501, banned: 18502, qty: 1, label: /aceitunas/i },
    { kind: 'sushi', menu: [place(18511, 'Roll De Salmon', 22000), place(18512, 'Jengibre', 3000)], text: 'Soy alérgico al jengibre. Un roll de salmón', host: 18511, banned: 18512, qty: 1, label: /jengibre/i },
    { kind: 'tacos', menu: [place(18521, 'Taco Al Pastor', 16000), place(18522, 'Cilantro', 2000)], text: 'Mi hijo tiene alergia al cilantro. Dos tacos al pastor', host: 18521, banned: 18522, qty: 2, label: /cilantro/i },
    { kind: 'burger', menu: [place(18531, 'Hamburguesa De Lentejas', 18000), place(18532, 'Queso', 3000)], text: 'Soy alérgico al queso. Una hamburguesa de lentejas', host: 18531, banned: 18532, qty: 1, label: /queso/i },
    { kind: 'pasta', menu: [place(18541, 'Pasta Al Pesto', 26000), place(18542, 'Pan De Trigo', 4000)], text: 'Soy celíaco. Una pasta al pesto', host: 18541, banned: 18542, qty: 1, label: /gluten/i },
    { kind: 'bowl', menu: [place(18551, 'Bowl De Quinoa', 19000), place(18552, 'Mani', 3000)], text: 'Soy alérgico al maní. Un bowl de quinoa', host: 18551, banned: 18552, qty: 1, label: /mani/i },
    { kind: 'ramen', menu: [place(18561, 'Ramen De Miso', 24000), place(18562, 'Huevo', 2000)], text: 'Soy alérgico al huevo. Un ramen de miso', host: 18561, banned: 18562, qty: 1, label: /huevo/i },
  ];

  it.each(cases.flatMap((item) => [false, true].map((agent) => ({ ...item, agent }))))(
    '$kind anota el plato y no compra el alérgeno (agent $agent)',
    async ({ menu, text, host, banned, qty, label, agent }) => {
      const h = harness(menu as typeof products, agent);
      h.service.ordersService.create = jest.fn();
      const reply = await h.sendQueued(text);
      expect(h.cartRows().find((row) => row.id === host)?.qty).toBe(qty);
      expect(h.cartRows().some((row) => row.id === banned)).toBe(false);
      expect(h.cartRows()).toHaveLength(1);
      expect(h.cartRows()[0].note || '').toMatch(/alergia/i);
      expect(reply || '').toMatch(label);
      expect(reply || '').toMatch(/no puedo garantizar/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    },
  );

  it.each(cases.flatMap((item) => [false, true].map((agent) => ({ ...item, agent }))))(
    '$kind sin alergia real sí deja el plato (agent $agent)',
    async ({ menu, host, banned, qty, agent, kind }) => {
      const order = kind === 'tacos' ? 'Dos tacos al pastor' : kind === 'ppp' ? 'Un churrasco' : kind === 'pizza' ? 'Una pizza margarita' : kind === 'sushi' ? 'Un roll de salmón' : kind === 'burger' ? 'Una hamburguesa de lentejas' : kind === 'pasta' ? 'Una pasta al pesto' : kind === 'bowl' ? 'Un bowl de quinoa' : 'Un ramen de miso';
      const text = kind === 'pasta' ? `No soy celíaco. ${order}` : `No soy alérgico. ${order}`;
      const h = harness(menu as typeof products, agent);
      h.service.ordersService.create = jest.fn();
      await h.sendQueued(text);
      expect(h.cartRows().find((row) => row.id === host)?.qty).toBe(qty);
      expect(h.cartRows().some((row) => row.id === banned)).toBe(false);
      expect(h.cartRows()[0]?.note || '').not.toMatch(/alergia/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    },
  );
});

describe('Quita el más caro — varios restaurantes', () => {
  const place = (id: number, name: string, price: number) => ({
    id, code: id, name, price, availableNow: true, hasAttributes: false, attributes: [] as { attributeName: string; options: string[] }[],
  });
  const line = (id: number, name: string, price: number, quantity = 1) => ({
    productId: id, code: id, name, unitPrice: price, quantity, attributes: [] as { attributeName: string; attributeValue: string }[],
  });
  const cases = [
    { kind: 'ppp', menu: products, cart: [line(17, 'Churrasco', 38000), line(38, 'Sopa De Ajiaco', 10500), line(7, 'Porcion De Yuca Frita', 7000)], gone: 17, text: 'quita el más caro' },
    { kind: 'pizza', menu: [place(18601, 'Pizza Margarita', 28000), place(18602, 'Ensalada Verde', 8000)], cart: [line(18601, 'Pizza Margarita', 28000), line(18602, 'Ensalada Verde', 8000)], gone: 18601, text: 'saca el más caro' },
    { kind: 'sushi', menu: [place(18611, 'Roll De Salmon', 22000), place(18612, 'Gyoza', 9000)], cart: [line(18611, 'Roll De Salmon', 22000, 2), line(18612, 'Gyoza', 9000)], gone: 18611, text: 'quita el más caro' },
    { kind: 'tacos', menu: [place(18621, 'Taco Al Pastor', 16000), place(18622, 'Guacamole', 5000)], cart: [line(18621, 'Taco Al Pastor', 16000, 3), line(18622, 'Guacamole', 5000)], gone: 18621, text: 'elimina el más caro' },
    { kind: 'burger', menu: [place(18631, 'Hamburguesa De Lentejas', 18000), place(18632, 'Papas Gajo', 6000)], cart: [line(18631, 'Hamburguesa De Lentejas', 18000), line(18632, 'Papas Gajo', 6000)], gone: 18631, text: 'quita el más caro' },
    { kind: 'pasta', menu: [place(18641, 'Pasta Al Pesto', 26000), place(18642, 'Pan De Ajo', 4000)], cart: [line(18641, 'Pasta Al Pesto', 26000), line(18642, 'Pan De Ajo', 4000)], gone: 18641, text: 'saca el más caro' },
    { kind: 'bowl', menu: [place(18651, 'Bowl De Quinoa', 19000), place(18652, 'Agua De Coco', 5000)], cart: [line(18651, 'Bowl De Quinoa', 19000, 2), line(18652, 'Agua De Coco', 5000)], gone: 18651, text: 'quita el más caro' },
    { kind: 'ramen', menu: [place(18661, 'Ramen De Miso', 24000), place(18662, 'Edamame', 8000)], cart: [line(18661, 'Ramen De Miso', 24000), line(18662, 'Edamame', 8000)], gone: 18661, text: 'elimina el más caro' },
  ];

  it.each(cases.flatMap((item) => [false, true].map((agent) => ({ ...item, agent }))))(
    '$kind quita solo el de mayor valor (agent $agent)',
    async ({ menu, cart, gone, text, agent }) => {
      const h = harness(menu as typeof products, agent);
      h.service.ordersService.create = jest.fn();
      h.conv.sessionData.cart = cart;
      const reply = await h.sendQueued(text);
      expect(h.cartRows().some((row) => row.id === gone)).toBe(false);
      expect(h.cartRows()).toHaveLength(cart.length - 1);
      expect(reply || '').toMatch(/quité/i);
      expect(reply || '').toMatch(/pedido sigue igual/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    },
  );

  it.each([
    { kind: 'pizza', menu: [place(18601, 'Pizza Margarita', 20000), place(18603, 'Calzone', 20000), place(18602, 'Ensalada Verde', 5000)], cart: [line(18601, 'Pizza Margarita', 20000), line(18603, 'Calzone', 20000), line(18602, 'Ensalada Verde', 5000)] },
    { kind: 'ramen', menu: [place(18661, 'Ramen De Miso', 24000), place(18663, 'Ramen De Shoyu', 24000), place(18662, 'Edamame', 8000)], cart: [line(18661, 'Ramen De Miso', 24000), line(18663, 'Ramen De Shoyu', 24000), line(18662, 'Edamame', 8000)] },
  ].flatMap((item) => [false, true].map((agent) => ({ ...item, agent }))))(
    '$kind empate pregunta cuál y no borra (agent $agent)',
    async ({ menu, cart, agent }) => {
      const h = harness(menu as typeof products, agent);
      h.service.ordersService.create = jest.fn();
      h.conv.sessionData.cart = cart;
      const before = h.cartRows();
      const reply = await h.sendQueued('quita el más caro');
      expect(h.cartRows()).toEqual(before);
      expect(reply || '').toMatch(/precio más alto/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    },
  );

  it.each(['sushi', 'tacos', 'pasta', 'bowl'].flatMap((kind) => [false, true].map((agent) => ({ kind, agent }))))(
    '$kind sin platos no inventa uno (agent $agent)',
    async ({ kind, agent }) => {
      const item = cases.find((row) => row.kind === kind)!;
      const h = harness(item.menu as typeof products, agent);
      h.service.ordersService.create = jest.fn();
      const reply = await h.sendQueued('quita el más caro');
      expect(h.cartRows()).toEqual([]);
      expect(reply || '').toMatch(/no hay platos/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    },
  );
});


describe('Foto — selección conserva pedidos ajenos y evita líneas ambiguas', () => {
  const make = (id: number, name: string) => ({id,code:id,name,price:12000,availableNow:true,hasAttributes:false,attributes:[]});
  const menus = [
    ['Pizza De Setas','Pan De Ajo','Ensalada Verde','Agua Mineral'],
    ['Roll De Aguacate','Gyoza Vegetal','Ramen De Miso','Te Helado'],
  ].map((names,index)=>names.map((name,offset)=>make(19001+index*10+offset,name)));
  const row = (product: ReturnType<typeof make>,quantity=1,note?:string) => ({productId:product.id,code:product.code,name:product.name,unitPrice:product.price,quantity,attributes:[],...(note?{note}:{})});
  it.each(menus.flatMap((menu)=>[false,true].map(agent=>({menu,agent}))))('conserva producto ajeno a la foto (agent $agent)',async({menu,agent})=>{
    const h=harness(menu as typeof products,agent);h.service.ordersService.create=jest.fn();
    const extra=row(menu[3],2,'sin azúcar');
    h.conv.sessionData.cart=[extra,...menu.slice(0,3).map(product=>row(product))];
    h.conv.sessionData.recentImageOrder=menu.slice(0,3).map(product=>({productId:product.id,name:product.name}));
    await h.sendQueued('de la foto solo el segundo y dos del tercero');
    expect(h.conv.sessionData.cart.find(item=>item.productId===menu[3].id)).toEqual(extra);
    expect(h.cartRows()).toEqual([expect.objectContaining({id:menu[3].id,qty:2,note:'sin azúcar'}),expect.objectContaining({id:menu[1].id,qty:1}),expect.objectContaining({id:menu[2].id,qty:2})]);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
  it.each(menus.flatMap((menu)=>[false,true].map(agent=>({menu,agent}))))('dos líneas del mismo producto piden aclaración (agent $agent)',async({menu,agent})=>{
    const h=harness(menu as typeof products,agent);h.service.ordersService.create=jest.fn();
    h.conv.sessionData.cart=[row(menu[0]),row(menu[1],1,'sin ajo'),row(menu[1],2,'con salsa'),row(menu[2]),row(menu[3])];
    h.conv.sessionData.recentImageOrder=menu.slice(0,3).map(product=>({productId:product.id,name:product.name}));
    const before=structuredClone(h.conv.sessionData.cart);
    const reply=await h.sendQueued('de la foto solo el segundo y dos del tercero');
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(reply||'').toMatch(/varias líneas|cuál|aclar/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('Foto — conserva atributos y notas de la línea elegida', () => {
  it.each(['Pizza Vegetal','Bowl De Quinoa'].flatMap((name,index)=>[false,true].map(agent=>({name,index,agent}))))('conserva opciones de $name (agent $agent)',async({name,index,agent})=>{
    const id=19101+index;
    const product={id,code:id,name,price:18000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Salsa',options:['Suave','Picante']}]};
    const h=harness([product] as typeof products,agent);h.service.ordersService.create=jest.fn();
    h.conv.sessionData.cart=[{productId:id,code:id,name,unitPrice:18000,quantity:3,attributes:[{attributeName:'Salsa',attributeValue:'Picante'}],note:'sin cebolla'}];
    h.conv.sessionData.recentImageOrder=[{productId:id,name}];
    h.conv.state=agent?'awaiting_payment':'awaiting_address';
    h.conv.sessionData.address='Calle 12 #34-56';
    h.conv.sessionData.paymentMethod='cash';
    await h.sendQueued('de la foto solo el primero');
    expect(h.cartRows()).toEqual([expect.objectContaining({id,qty:3,note:'sin cebolla',attrs:['Salsa:Picante']})]);
    expect(h.conv.sessionData.address).toBe('Calle 12 #34-56');
    expect(h.conv.sessionData.paymentMethod).toBe('cash');
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
  it.each([false,true])('una opción retirada no se cambia silenciosamente (agent %s)',async(agent)=>{
    const product={id:19111,code:19111,name:'Wrap De Verduras',price:15000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Salsa',options:['Suave']}]};
    const h=harness([product] as typeof products,agent);h.service.ordersService.create=jest.fn();
    h.conv.sessionData.cart=[{productId:product.id,code:product.code,name:product.name,unitPrice:15000,quantity:2,attributes:[{attributeName:'Salsa',attributeValue:'Picante'}],note:'sin cebolla'}];
    h.conv.sessionData.recentImageOrder=[{productId:product.id,name:product.name}];
    const before=structuredClone(h.conv.sessionData.cart);
    const reply=await h.sendQueued('de la foto solo el primero');
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(reply||'').toMatch(/no pude|opción|opciones|aclar/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

});

describe('Foto — procedencia de cantidades fusionadas',()=>{
 const menus=[['Pizza De Setas','Pan De Ajo','Agua Mineral'],['Bowl De Quinoa','Edamame','Te Helado']].map((names,index)=>names.map((name,offset)=>({id:19201+index*10+offset,code:19201+index*10+offset,name,price:10000,availableNow:true,hasAttributes:false,attributes:[]})));
 const row=(p:typeof menus[number][number],quantity=1)=>({productId:p.id,code:p.code,name:p.name,unitPrice:p.price,quantity,attributes:[]});
 it.each(menus.flatMap(menu=>[false,true].flatMap(agent=>['antes','después','ajeno'].map(kind=>({menu,agent,kind})))) )('$kind no pierde unidades independientes (agent $agent)',async({menu,agent,kind})=>{
  const h=harness(menu as typeof products,agent);h.service.ordersService.create=jest.fn();
  h.conv.sessionData.cart=[row(menu[0],kind==='ajeno'?1:3),row(menu[1])];
  h.conv.sessionData.recentImageOrder=menu.slice(0,2).map(p=>({productId:p.id,name:p.name}));
  h.conv.sessionData.recentImageCartBefore=kind==='antes'?[row(menu[0],2)]:[];
  h.conv.sessionData.recentImageCartSignature=JSON.stringify([row(menu[0],kind==='después'?1:kind==='antes'?3:1),row(menu[1])]);
  if(kind==='ajeno')h.conv.sessionData.cart.push(row(menu[2],2));
  const before=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued('de la foto solo el segundo');
  if(kind==='ajeno')expect(h.cartRows()).toEqual([expect.objectContaining({id:menu[2].id,qty:2}),expect.objectContaining({id:menu[1].id,qty:1})]);
  else {expect(h.conv.sessionData.cart).toEqual(before);expect(reply||'').toMatch(/antes|después|cambió|aclar/i);}
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it.each(menus.flatMap(menu=>[false,true].flatMap(agent=>['antes','después','sin productos','ilegible'].map(kind=>({menu,agent,kind})))))('captura procedencia en imagen real del router: $kind (agent $agent)',async({menu,agent,kind})=>{
  const h=harness(menu as typeof products,agent);h.service.ordersService.create=jest.fn();
  if(kind==='antes')h.conv.sessionData.cart=[row(menu[0],2)];
  if(kind==='sin productos'||kind==='ilegible'){
   h.conv.sessionData.cart=[row(menu[0])];
   h.conv.sessionData.recentImageOrder=[{productId:menu[0].id,name:menu[0].name}];
  }
  h.service.resolveImageMessage=jest.fn().mockResolvedValue({done:kind==='ilegible',text:kind==='sin productos'?'No entendí la foto':`Quiero un ${menu[0].name}`});
  await h.service.handleIncomingUnlocked({waId:'customer',phoneE164:h.conv.phoneE164,messageId:'synthetic-photo',messageType:'image',mediaId:'mock-photo',raw:{}});
  if(kind==='sin productos'||kind==='ilegible'){
   expect(h.conv.sessionData.recentImageOrder).toBeUndefined();
   expect(h.conv.sessionData.recentImageCartBefore).toBeUndefined();
   expect(h.conv.sessionData.recentImageCartSignature).toBeUndefined();
  }else{
   expect(h.conv.sessionData.recentImageCartBefore).toEqual(kind==='antes'?[row(menu[0],2)]:[]);
   expect(h.conv.sessionData.recentImageCartSignature).toBe(JSON.stringify(h.conv.sessionData.cart.filter(line=>line.productId===menu[0].id)));
   if(kind==='después'){
    await h.sendQueued(`Quiero otro ${menu[0].name}`);
    expect(h.cartRows().find(line=>line.id===menu[0].id)?.qty).toBe(2);
   }
   const before=structuredClone(h.conv.sessionData.cart);
   const reply=await h.sendQueued('de la foto solo el primero');
   expect(h.conv.sessionData.cart).toEqual(before);
   expect(reply||'').toMatch(kind==='antes'?/antes de la foto/i:/después de esa foto/i);
  }
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });

});

describe('Agregar productos — no capturar como dirección',()=>{
 const menus=[['Pizza De Setas','Agua Mineral'],['Bowl De Quinoa','Te Helado']].map((names,index)=>names.map((name,offset)=>({id:19301+index*10+offset,code:19301+index*10+offset,name,price:12000,availableNow:true,hasAttributes:false,attributes:[]})));
 it.each(menus.flatMap(menu=>[false,true].flatMap(agent=>['building_cart','awaiting_address','awaiting_payment'].flatMap(state=>['Agrega un','Añade un','Ponme un','Agrega dos','Agrega otro','Ponme otro'].map(prefix=>({menu,agent,state,prefix}))))))('$prefix en $state (agent $agent)',async({menu,agent,state,prefix})=>{
  const h=harness(menu as typeof products,agent);h.service.ordersService.create=jest.fn();
  h.conv.state=state;h.conv.sessionData.address='Calle 12 #34-56';h.conv.sessionData.addressConfirmed=true;
  h.conv.sessionData.cart=[{productId:menu[1].id,code:menu[1].code,name:menu[1].name,unitPrice:12000,quantity:2,attributes:[],note:'sin hielo'}];
  await h.sendQueued(`${prefix} ${menu[0].name} por favor`);
  expect(h.conv.sessionData.address).toBe('Calle 12 #34-56');
  expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:menu[1].id,qty:2,note:'sin hielo'}),expect.objectContaining({id:menu[0].id,qty:prefix==='Agrega dos'?2:1})]));
  expect(h.cartRows()).toHaveLength(2);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});

describe('Agregar durante dirección — opción pendiente y regreso',()=>{
 it.each(['Jugo Natural','Gaseosa Artesanal'].flatMap((name,index)=>[false,true].map(agent=>({name,index,agent}))))('conserva qty y vuelve a dirección: $name (agent $agent)',async({name,index,agent})=>{
  const product={id:19401+index,code:19401+index,name,price:6000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mango','Lulo']}]};
  const base={id:19411,code:19411,name:'Pan De Ajo',price:5000,availableNow:true,hasAttributes:false,attributes:[]};
  const h=harness([product,base] as typeof products,agent);h.service.ordersService.create=jest.fn();
  h.conv.state='awaiting_address';h.conv.sessionData.address=undefined;
  h.conv.sessionData.cart=[{productId:base.id,name:base.name,code:base.code,unitPrice:5000,quantity:2,attributes:[],note:'sin queso'}];
  await h.sendQueued(`Añade dos ${name} por favor`);
  expect(h.cartRows()).toHaveLength(1);expect(h.conv.sessionData.pendingAttribute?.quantity).toBe(2);
  const reply=await h.sendQueued('Mango');
  expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:base.id,qty:2,note:'sin queso'}),expect.objectContaining({id:product.id,qty:2,attrs:['Sabor:Mango']})]));
  expect(h.conv.state).toBe('awaiting_address');expect(reply||'').toMatch(/dirección/i);
  expect(h.conv.sessionData.address).toBeUndefined();expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});

describe('Consultar una adición — no efectuar la compra',()=>{
 it.each(['Pizza De Setas','Bowl De Quinoa'].flatMap((name,index)=>[false,true].flatMap(agent=>['awaiting_address','awaiting_payment'].map(state=>({name,index,agent,state})))))('$name en $state (agent $agent)',async({name,index,agent,state})=>{
  const p={id:19501+index,code:19501+index,name,price:17000,availableNow:true,hasAttributes:false,attributes:[]};
  const base={id:19511,code:19511,name:'Agua Mineral',price:4000,availableNow:true,hasAttributes:false,attributes:[]};
  const h=harness([p,base] as typeof products,agent);h.service.ordersService.create=jest.fn();
  h.conv.state=state;h.conv.sessionData.address='Calle 12 #34-56';
  h.conv.sessionData.cart=[{productId:base.id,name:base.name,code:base.code,unitPrice:4000,quantity:2,attributes:[]}];
  const before=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued(`Cuánto cuesta añadir otro ${name}?`);
  expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.address).toBe('Calle 12 #34-56');
  expect(reply||'').toMatch(/17\.000/);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});

describe('Adiciones — códigos y productos desconocidos',()=>{
 const menus=[['Pizza De Setas','Agua Mineral'],['Bowl De Quinoa','Te Helado']].map((names,index)=>names.map((name,offset)=>({id:19601+index*10+offset,code:601+index*10+offset,name,price:13000,availableNow:true,hasAttributes:false,attributes:[]})));
 it.each(menus.flatMap(menu=>[false,true].flatMap(agent=>['building_cart','awaiting_address','awaiting_payment'].flatMap(state=>['codigo2','codigo1','codigoSolo','codigoNombre','desconocido1','desconocido2'].map(kind=>({menu,agent,state,kind}))))))('$kind en $state (agent $agent)',async({menu,agent,state,kind})=>{
  const h=harness(menu as typeof products,agent);h.service.ordersService.create=jest.fn();h.conv.state=state;
  h.conv.sessionData.address='Calle 12 #34-56';h.conv.sessionData.addressConfirmed=true;
  h.conv.sessionData.cart=[{productId:menu[1].id,code:menu[1].code,name:menu[1].name,unitPrice:13000,quantity:2,attributes:[],note:'sin hielo'}];
  const before=structuredClone(h.conv.sessionData.cart);
  const text=kind==='codigo2'?`Agrega dos del código ${menu[0].code}`:kind==='codigo1'?`Añade un #${menu[0].code}`:kind==='codigoSolo'?`Agrega #${menu[0].code}`:kind==='codigoNombre'?`Ponme código ${menu[0].code}`:kind==='desconocido1'?'Agrega un pastel lunar':'Añade dos croquetas estelares';
  const reply=await h.sendQueued(text);
  expect(h.conv.sessionData.address).toBe('Calle 12 #34-56');
  if(kind.startsWith('codigo'))expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:menu[1].id,qty:2,note:'sin hielo'}),expect.objectContaining({id:menu[0].id,qty:kind==='codigo2'?2:1})]));
  else {expect(h.conv.sessionData.cart).toEqual(before);expect(reply||'').toMatch(/no (?:tenemos|manejamos|encontré|encontre)|no está|no aparece/i);}
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});

describe('Adiciones — código inexistente y referencia de domicilio',()=>{
 const menus=[['Pizza De Setas','Agua Mineral'],['Bowl De Quinoa','Te Helado']].map((names,index)=>names.map((name,offset)=>({id:19701+index*10+offset,code:701+index*10+offset,name,price:13000,availableNow:true,hasAttributes:false,attributes:[]})));
 it.each(menus.flatMap(menu=>[false,true].flatMap(agent=>['building_cart','awaiting_address','awaiting_payment'].map(state=>({menu,agent,state})))))('código desconocido no cambia $state (agent $agent)',async({menu,agent,state})=>{
  const h=harness(menu as typeof products,agent);h.service.ordersService.create=jest.fn();h.conv.state=state;h.conv.sessionData.address='Calle 12 #34-56';
  h.conv.sessionData.cart=[{productId:menu[1].id,name:menu[1].name,code:menu[1].code,unitPrice:13000,quantity:2,attributes:[]}];
  const before=structuredClone(h.conv.sessionData.cart);const reply=await h.sendQueued('Agrega dos #9999');
  expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.address).toBe('Calle 12 #34-56');expect(h.conv.state).toBe(state);
  expect(reply||'').toMatch(/no encontré/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it.each(menus.flatMap(menu=>[false,true].flatMap(agent=>['apartamento','torre'].map(place=>({menu,agent,place})))))('$place no se compra como producto (agent $agent)',async({menu,agent,place})=>{
  const h=harness(menu as typeof products,agent);h.service.ordersService.create=jest.fn();h.conv.state='awaiting_address';h.conv.sessionData.address='Calle 12 #34-56';
  h.conv.sessionData.cart=[{productId:menu[1].id,name:menu[1].name,code:menu[1].code,unitPrice:13000,quantity:2,attributes:[]}];
  const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued(`Añade un ${place} #${menu[0].code}`);
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(h.conv.sessionData.address).toContain(place);expect(h.conv.sessionData.address).toContain(String(menu[0].code));
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});

describe('Adición con dirección — completar sin repetirla',()=>{
 it.each(['Pizza De Setas','Bowl De Quinoa'].flatMap((name,index)=>[false,true].map(agent=>({name,index,agent}))))('$name (agent $agent)',async({name,index,agent})=>{
  const p={id:19801+index,code:801+index,name,price:17000,availableNow:true,hasAttributes:false,attributes:[]};
  const base={id:19811,code:811,name:'Agua Mineral',price:4000,availableNow:true,hasAttributes:false,attributes:[]};
  const h=harness([p,base] as typeof products,agent);h.service.ordersService.create=jest.fn();h.conv.state='awaiting_address';h.conv.sessionData.address=undefined;
  h.conv.sessionData.cart=[{productId:base.id,name:base.name,code:base.code,unitPrice:4000,quantity:2,attributes:[]}];
  const reply=await h.sendQueued(`Añade dos ${name} para la calle 9 #18-27`);
  expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:base.id,qty:2}),expect.objectContaining({id:p.id,qty:2})]));
  expect(h.conv.sessionData.address).toMatch(/calle 9.*18-27/i);
  expect(reply||'').not.toMatch(/escribe.*dirección|dirección correcta|misma dirección|otra dirección/i);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});

describe('Adición de varios códigos — cantidades independientes',()=>{
 const menus=[['Pizza De Setas','Pan De Ajo','Agua Mineral'],['Bowl De Quinoa','Edamame','Te Helado']].map((names,index)=>names.map((name,offset)=>({id:19901+index*10+offset,code:901+index*10+offset,name,price:10000+offset*2000,availableNow:true,hasAttributes:false,attributes:[]})));
 it.each(menus.flatMap(menu=>[false,true].flatMap(agent=>['building_cart','awaiting_address','awaiting_payment'].flatMap(state=>[false,true].map(explicit=>({menu,agent,state,explicit}))))))('dos códigos en $state explicit=$explicit agent=$agent',async({menu,agent,state,explicit})=>{
  const h=harness(menu as typeof products,agent);h.service.ordersService.create=jest.fn();h.conv.state=state;h.conv.sessionData.address='Calle 12 #34-56';
  h.conv.sessionData.cart=[{productId:menu[2].id,name:menu[2].name,code:menu[2].code,unitPrice:menu[2].price,quantity:1,attributes:[],note:'sin hielo'}];
  await h.sendQueued(explicit?`Agrega dos #${menu[0].code} y tres #${menu[1].code}`:`Ponme código ${menu[0].code} y código ${menu[1].code}`);
  expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:menu[0].id,qty:explicit?2:1}),expect.objectContaining({id:menu[1].id,qty:explicit?3:1}),expect.objectContaining({id:menu[2].id,qty:1,note:'sin hielo'})]));
  expect(h.cartRows()).toHaveLength(3);expect(h.conv.sessionData.address).toBe('Calle 12 #34-56');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it.each(menus.flatMap(menu=>[false,true].map(agent=>({menu,agent}))))('dos códigos con placa de dirección (agent $agent)',async({menu,agent})=>{
  const h=harness(menu as typeof products,agent);h.service.ordersService.create=jest.fn();h.conv.state='awaiting_address';h.conv.sessionData.address=undefined;
  h.conv.sessionData.cart=[{productId:menu[2].id,name:menu[2].name,code:menu[2].code,unitPrice:menu[2].price,quantity:1,attributes:[]}];
  const reply=await h.sendQueued(`Agrega dos #${menu[0].code} y tres #${menu[1].code} para la calle   9 #18-27`);
  expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:menu[0].id,qty:2}),expect.objectContaining({id:menu[1].id,qty:3}),expect.objectContaining({id:menu[2].id,qty:1})]));
  expect(h.conv.sessionData.address).toMatch(/calle\s+9.*18-27/i);
  expect(reply||'').not.toMatch(/no encontré|escribe.*dirección/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });

});

describe('Compra explícita y consulta de precio — mismo mensaje',()=>{
 it.each(['Pizza De Setas','Bowl De Quinoa'].flatMap((name,index)=>[false,true].flatMap(agent=>['building_cart','awaiting_payment'].map(state=>({name,index,agent,state})))))('$name en $state agent=$agent',async({name,index,agent,state})=>{
  const p={id:20001+index,code:951+index,name,price:17000,availableNow:true,hasAttributes:false,attributes:[]};
  const h=harness([p] as typeof products,agent);h.service.ordersService.create=jest.fn();h.conv.state=state;h.conv.sessionData.address='Calle 12 #34-56';
  const reply=await h.sendQueued(`Añade dos ${name}; ¿cuánto vale cada uno?`);
  expect(h.cartRows()).toEqual([expect.objectContaining({id:p.id,qty:2})]);expect(reply||'').toMatch(/17\.000/);
  expect(h.conv.sessionData.address).toBe('Calle 12 #34-56');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});

describe('Negación de atributo — no añade otro producto',()=>{
 it.each(['Pizza De Setas','Bowl De Quinoa'].flatMap((name,index)=>[false,true].flatMap(agent=>[false,true].map(query=>({name,index,agent,query})))))('$name query=$query agent=$agent',async({name,index,agent,query})=>{
  const p={id:20101+index,code:971+index,name,price:17000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Salsa',options:['Suave','Picante']}]};
  const h=harness([p] as typeof products,agent);h.service.ordersService.create=jest.fn();h.conv.state='awaiting_payment';h.conv.sessionData.address='Calle 12 #34-56';
  h.conv.sessionData.cart=[{productId:p.id,name:p.name,code:p.code,unitPrice:17000,quantity:2,attributes:[{attributeName:'Salsa',attributeValue:'Picante'}],note:'sin cebolla'}];
  const reply=await h.sendQueued(query?'¿Si cambio la salsa picante por suave cuánto cuesta?':'No con salsa picante, mejor con salsa suave');
  if(query)expect(reply||'').toMatch(/17\.000|precio|costo|carta/i);
  expect(h.cartRows()).toEqual([expect.objectContaining({id:p.id,qty:2,note:'sin cebolla',attrs:[`Salsa:${query?'Picante':'Suave'}`]})]);
  expect(h.conv.sessionData.address).toBe('Calle 12 #34-56');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});

describe('Negación de atributo — dos platos y selección posterior',()=>{
 it.each([['Pizza De Setas','Pizza De Espinaca'],['Bowl De Quinoa','Bowl De Tofu']].flatMap((names,index)=>[false,true].map(agent=>({names,index,agent}))))('elige solo una línea (agent $agent)',async({names,index,agent})=>{
  const menu=names.map((name,offset)=>({id:20201+index*10+offset,code:981+index*10+offset,name,price:17000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Salsa',options:['Suave','Picante']}]}));
  const h=harness(menu as typeof products,agent);h.service.ordersService.create=jest.fn();h.conv.state='awaiting_payment';h.conv.sessionData.address='Calle 12 #34-56';
  h.conv.sessionData.cart=menu.map((p,index)=>({productId:p.id,name:p.name,code:p.code,unitPrice:17000,quantity:index+1,attributes:[{attributeName:'Salsa',attributeValue:'Picante'}],note:'sin cebolla'}));
  const before=structuredClone(h.conv.sessionData.cart);const reply=await h.sendQueued('No con salsa picante, mejor con salsa suave');
  expect(h.conv.sessionData.cart).toEqual(before);expect(reply||'').toMatch(/cuál|cual/i);
  await h.sendQueued('1');
  expect(h.cartRows()).toEqual([expect.objectContaining({id:menu[0].id,qty:1,attrs:['Salsa:Suave'],note:'sin cebolla'}),expect.objectContaining({id:menu[1].id,qty:2,attrs:['Salsa:Picante'],note:'sin cebolla'})]);
  expect(h.conv.sessionData.paymentMethod).toBeUndefined();expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});


describe('Códigos explícitos — identidad y reconocimiento parcial',()=>{
 const menus=['Trio De Tacos','Bowl Especial'].map((name,index)=>[
  {id:20301+index*10,code:1011+index*10,name,price:39000,availableNow:true,hasAttributes:false,attributes:[]},
  {id:20302+index*10,code:1012+index*10,name,price:34000,availableNow:true,hasAttributes:false,attributes:[]},
 ]);
 it.each(menus.flatMap(menu=>[false,true].flatMap(agent=>['building_cart','awaiting_address','awaiting_payment'].map(state=>({menu,agent,state})))))('conserva dos SKU homónimos en $state agent=$agent',async({menu,agent,state})=>{
  const h=harness(menu as typeof products,agent);h.service.ordersService.create=jest.fn();h.conv.state=state;h.conv.sessionData.address='Calle 12 #34-56';
  await h.sendQueued(`Agrega dos #${menu[0].code} y tres #${menu[1].code}`);
  expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:menu[0].id,qty:2}),expect.objectContaining({id:menu[1].id,qty:3})]));
  expect(h.cartRows()).toHaveLength(2);expect(h.conv.sessionData.cart.map(line=>line.unitPrice).sort()).toEqual([34000,39000]);
  expect(h.conv.sessionData.address).toBe('Calle 12 #34-56');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it.each(menus.flatMap(menu=>[false,true].map(agent=>({menu,agent}))))('añade el código conocido y explica el desconocido agent=$agent',async({menu,agent})=>{
  const h=harness(menu as typeof products,agent);h.service.ordersService.create=jest.fn();h.conv.state='awaiting_payment';h.conv.sessionData.address='Calle 12 #34-56';
  const reply=await h.sendQueued(`Agrega dos #${menu[0].code} y un #9999`);
  expect(h.cartRows()).toEqual([expect.objectContaining({id:menu[0].id,qty:2})]);
  expect(reply||'').toMatch(/9999/);expect(reply||'').not.toMatch(/carrito sigue igual/i);
  expect(h.conv.sessionData.address).toBe('Calle 12 #34-56');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it.each(menus.flatMap(menu=>[false,true].map(agent=>({menu,agent}))))('consulta de códigos no compra agent=$agent',async({menu,agent})=>{
  const h=harness(menu as typeof products,agent);h.service.ordersService.create=jest.fn();h.conv.state='awaiting_payment';h.conv.sessionData.address='Calle 12 #34-56';
  const before=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued(`¿Cuánto cuestan código ${menu[0].code} y código ${menu[1].code}?`);
  expect(h.conv.sessionData.cart).toEqual(before);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it.each(menus.flatMap(menu=>[false,true].map(agent=>({menu,agent}))))('códigos sin cantidad son una copia agent=$agent',async({menu,agent})=>{
  const h=harness(menu as typeof products,agent);h.service.ordersService.create=jest.fn();h.conv.state='awaiting_payment';
  await h.sendQueued(`Ponme código ${menu[0].code} y código ${menu[1].code}`);
  expect(h.cartRows()).toEqual(expect.arrayContaining(menu.map(p=>expect.objectContaining({id:p.id,qty:1}))));
  expect(h.cartRows()).toHaveLength(2);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});

describe('Fronteras de códigos y negaciones — identidad por catálogo',()=>{
 const menus=['Trio De Tacos','Bowl Especial'].map((name,index)=>[
  {id:20401+index*10,code:1111+index*10,name,price:39000,availableNow:true,hasAttributes:false,attributes:[]},
  {id:20402+index*10,code:1112+index*10,name,price:34000,availableNow:true,hasAttributes:false,attributes:[]},
 ]);
 it.each(menus.flatMap(menu=>[false,true].flatMap(agent=>['building_cart','awaiting_address','awaiting_payment'].flatMap(state=>[0,1].map(pick=>({menu,agent,state,pick}))))))('un código homónimo en $state pick=$pick agent=$agent',async({menu,agent,state,pick})=>{
  const h=harness(menu as typeof products,agent);h.service.ordersService.create=jest.fn();h.conv.state=state;h.conv.sessionData.address='Calle 12 #34-56';
  const reply=await h.sendQueued(`Añade dos #${menu[pick].code}`);
  expect(h.cartRows()).toEqual([expect.objectContaining({id:menu[pick].id,qty:2})]);
  expect(h.conv.sessionData.cart[0].unitPrice).toBe(menu[pick].price);
  expect(reply||'').not.toMatch(/cuál prefieres|cual prefieres/i);
  expect(h.conv.sessionData.address).toBe('Calle 12 #34-56');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it.each(menus.flatMap(menu=>[false,true].map(agent=>({menu,agent}))))('dos códigos con nota propia agent=$agent',async({menu,agent})=>{
  const h=harness(menu as typeof products,agent);h.service.ordersService.create=jest.fn();h.conv.state='awaiting_payment';h.conv.sessionData.address='Calle 12 #34-56';
  await h.sendQueued(`Agrega dos #${menu[0].code} sin cebolla y tres #${menu[1].code} sin ensalada`);
  expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:menu[0].id,qty:2,note:expect.stringMatching(/sin cebolla/i)}),expect.objectContaining({id:menu[1].id,qty:3,note:expect.stringMatching(/sin ensalada/i)})]));
  expect(h.cartRows()).toHaveLength(2);expect(h.conv.sessionData.address).toBe('Calle 12 #34-56');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it.each(menus.flatMap(menu=>[false,true].map(agent=>({menu,agent}))))('dos códigos y placa de dirección agent=$agent',async({menu,agent})=>{
  const h=harness(menu as typeof products,agent);h.service.ordersService.create=jest.fn();h.conv.state='awaiting_address';h.conv.sessionData.address=undefined;
  const reply=await h.sendQueued(`Agrega dos #${menu[0].code} y tres #${menu[1].code} para la calle 9 #18-27`);
  expect(h.cartRows()).toEqual(expect.arrayContaining(menu.map((p,index)=>expect.objectContaining({id:p.id,qty:index+2}))));
  expect(h.cartRows()).toHaveLength(2);expect(h.conv.sessionData.address).toMatch(/calle\s+9.*18-27/i);
  expect(reply||'').not.toMatch(/escribe.*dirección|no encontré/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it.each(['Pizza De Setas','Bowl De Quinoa'].flatMap((name,index)=>[false,true].map(agent=>({name,index,agent}))))('negación sin alternativa no confirma la opción rechazada agent=$agent',async({name,index,agent})=>{
  const p={id:20501+index,code:1201+index,name,price:17000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Salsa',options:['Suave','Picante']}]};
  const h=harness([p] as typeof products,agent);h.service.ordersService.create=jest.fn();h.conv.state='awaiting_payment';h.conv.sessionData.address='Calle 12 #34-56';
  h.conv.sessionData.cart=[{productId:p.id,name:p.name,code:p.code,unitPrice:17000,quantity:2,attributes:[{attributeName:'Salsa',attributeValue:'Picante'}],note:'sin cebolla'}];
  const before=structuredClone(h.conv.sessionData.cart);const reply=await h.sendQueued('No con salsa picante');
  expect(h.conv.sessionData.cart).toEqual(before);expect(reply||'').toMatch(/suave|opciones|cuál|cual/i);
  expect(reply||'').not.toMatch(/listo|queda con.*picante/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});

describe('Negación de opción — sin frente a alternativa configurada',()=>{
 it.each(['Pizza De Setas','Bowl De Quinoa'].flatMap((name,index)=>[false,true].flatMap(agent=>[false,true].map(configured=>({name,index,agent,configured})))))('opción sin configurada=$configured agent=$agent',async({name,index,agent,configured})=>{
  const p={id:20601+index,code:1301+index,name,price:17000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Salsa',options:configured?['Suave','Picante','Sin Picante']:['Suave','Picante']}]};
  const h=harness([p] as typeof products,agent);h.service.ordersService.create=jest.fn();h.conv.state='awaiting_payment';h.conv.sessionData.address='Calle 12 #34-56';
  h.conv.sessionData.cart=[{productId:p.id,name:p.name,code:p.code,unitPrice:17000,quantity:2,attributes:[{attributeName:'Salsa',attributeValue:'Picante'}],note:'sin cebolla'}];
  const reply=await h.sendQueued('No con salsa picante, mejor sin picante');
  expect(h.cartRows()).toEqual([expect.objectContaining({id:p.id,qty:2,note:'sin cebolla',attrs:[`Salsa:${configured?'Sin Picante':'Picante'}`]})]);
  if(!configured){expect(reply||'').toMatch(/cuál|cual|opción|opciones|suave/i);expect(reply||'').not.toMatch(/listo|queda con.*picante/i);}
  expect(h.conv.sessionData.address).toBe('Calle 12 #34-56');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});

describe('Código homónimo — atributos y disponibilidad',()=>{
 it.each(['Pizza Especial','Bowl Especial'].flatMap((name,index)=>[false,true].flatMap(agent=>[false,true].map(available=>({name,index,agent,available})))))('SKU elegido available=$available agent=$agent',async({name,index,agent,available})=>{
  const menu=[0,1].map(offset=>({id:20701+index*10+offset,code:1401+index*10+offset,name,price:17000+offset*2000,availableNow:offset===0||available,hasAttributes:true,attributes:[{attributeName:'Salsa',options:['Suave','Picante']}]}));
  const h=harness(menu as typeof products,agent);h.service.ordersService.create=jest.fn();h.conv.state='awaiting_payment';h.conv.sessionData.address='Calle 12 #34-56';
  const reply=await h.sendQueued(`Añade dos #${menu[1].code} con salsa suave`);
  if(available){expect(h.cartRows()).toEqual([expect.objectContaining({id:menu[1].id,qty:2,attrs:['Salsa:Suave']})]);expect(h.conv.sessionData.cart[0].unitPrice).toBe(19000);}
  else {expect(h.cartRows()).toEqual([]);expect(reply||'').toMatch(/no manejamos|no disponible|no encontré/i);}
  expect(h.conv.sessionData.address).toBe('Calle 12 #34-56');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it.each(['Pizza De Setas','Bowl De Quinoa'].flatMap((name,index)=>[false,true].map(agent=>({name,index,agent}))))('la aclaración posterior actualiza sin perder nota agent=$agent',async({name,index,agent})=>{
  const p={id:20801+index,code:1501+index,name,price:17000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Salsa',options:['Suave','Picante']}]};
  const h=harness([p] as typeof products,agent);h.service.ordersService.create=jest.fn();h.conv.state='awaiting_payment';h.conv.sessionData.address='Calle 12 #34-56';
  h.conv.sessionData.cart=[{productId:p.id,name:p.name,code:p.code,unitPrice:17000,quantity:2,attributes:[{attributeName:'Salsa',attributeValue:'Picante'}],note:'sin cebolla'}];
  await h.sendQueued('No con salsa picante');await h.sendQueued('Salsa suave');
  expect(h.cartRows()).toEqual([expect.objectContaining({id:p.id,qty:2,attrs:['Salsa:Suave'],note:'sin cebolla'})]);
  expect(h.conv.sessionData.paymentMethod).toBeUndefined();expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});


describe('Código con nota y producto por nombre — no consumir la otra compra',()=>{
 it.each([['Pizza De Setas','Agua Mineral'],['Bowl De Quinoa','Te Helado']].flatMap((names,index)=>[false,true].map(agent=>({names,index,agent}))))('segunda compra reconocida agent=$agent',async({names,index,agent})=>{
  const menu=names.map((name,offset)=>({id:20901+index*10+offset,code:1601+index*10+offset,name,price:17000,availableNow:true,hasAttributes:false,attributes:[]}));
  const h=harness(menu as typeof products,agent);h.service.ordersService.create=jest.fn();h.conv.state='awaiting_payment';
  await h.sendQueued(`Agrega dos #${menu[0].code} sin cebolla y un ${menu[1].name}`);
  expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:menu[0].id,qty:2,note:expect.stringMatching(/sin cebolla/i)}),expect.objectContaining({id:menu[1].id,qty:1})]));
  expect(h.cartRows()).toHaveLength(2);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});

describe('Opciones pendientes — precio y cantidad sin repetir el producto',()=>{
 const families=[{name:'Jugo Natural',flavors:['Mango','Lulo']},{name:'Gaseosa Artesanal',flavors:['Mora','Durazno']}];
 it.each(families.flatMap(family=>[false,true].flatMap(agent=>[false,true].flatMap(code=>['Mejor solo dos','Que sean dos por favor','En vez de tres quiero dos'].map(change=>({...family,agent,code,change}))))))('$name code=$code cambio=$change agent=$agent',async({name,flavors,agent,code,change})=>{
  const base={id:21001,code:1701,name:'Bowl Vegetal',price:16000,availableNow:true,hasAttributes:false,attributes:[]};
  const drink={id:21002,code:1702,name,price:8000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:flavors}]};
  const h=harness([base,drink] as typeof products,agent);h.service.ordersService.create=jest.fn();
  await h.sendQueued('Quiero dos Bowl Vegetal');
  await h.sendQueued(code?'Agrega tres #1702 sin hielo':`Quiero tres ${name} sin hielo`);
  expect(h.conv.sessionData.pendingAttribute?.productId).toBe(drink.id);expect(h.conv.sessionData.pendingAttribute?.quantity).toBe(3);
  const pending=structuredClone(h.conv.sessionData.pendingAttribute);const before=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued('¿Cuánto cuesta cada uno?');
  expect(reply||'').toMatch(/8\.000/);expect(h.conv.sessionData.pendingAttribute).toEqual(pending);expect(h.conv.sessionData.cart).toEqual(before);
  await h.sendQueued(change);
  expect(h.conv.sessionData.pendingAttribute?.quantity).toBe(2);expect(h.conv.sessionData.cart).toEqual(before);
  const optionsReply=await h.sendQueued('¿Qué sabores hay?');expect(optionsReply||'').toMatch(new RegExp(flavors.join('|'),'i'));
  await h.sendQueued(flavors[1]);
  expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:base.id,qty:2}),expect.objectContaining({id:drink.id,qty:2,attrs:[`Sabor:${flavors[1]}`],note:expect.stringMatching(/sin hielo/i)})]));
  expect(h.cartRows()).toHaveLength(2);expect(h.conv.sessionData.pendingAttribute).toBeFalsy();expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});

describe('Cantidad pendiente — preguntas, índices y cancelación',()=>{
 const families=[{name:'Jugo Natural',flavors:['Mango','Lulo']},{name:'Gaseosa Artesanal',flavors:['Mora','Durazno']}];
 it.each(families.flatMap(family=>[false,true].map(agent=>({...family,agent}))))('consulta hipotética y opción 2 no cambian cantidad $name agent=$agent',async({name,flavors,agent})=>{
  const drink={id:21101,code:1801,name,price:8000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:flavors}]};
  const h=harness([drink] as typeof products,agent);h.service.ordersService.create=jest.fn();await h.sendQueued(`Quiero tres ${name} sin hielo`);
  const pending=structuredClone(h.conv.sessionData.pendingAttribute);const before=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued('¿Si mejor solo pido dos cuánto cuestan?');
  expect(reply||'').toMatch(/16\.000/);expect(reply||'').toMatch(/pedido sigue igual/i);
  expect(h.conv.sessionData.pendingAttribute).toEqual(pending);expect(h.conv.sessionData.cart).toEqual(before);
  await h.sendQueued('2');
  expect(h.cartRows()).toEqual([expect.objectContaining({id:drink.id,qty:3,attrs:[`Sabor:${flavors[1]}`],note:expect.stringMatching(/sin hielo/i)})]);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it.each(families.flatMap(family=>[false,true].map(agent=>({...family,agent}))))('cancelar tras cantidad corregida no reactiva $name agent=$agent',async({name,flavors,agent})=>{
  const base={id:21201,code:1901,name:'Bowl Vegetal',price:16000,availableNow:true,hasAttributes:false,attributes:[]};
  const drink={id:21202,code:1902,name,price:8000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:flavors}]};
  const h=harness([base,drink] as typeof products,agent);h.service.ordersService.create=jest.fn();await h.sendQueued('Quiero dos Bowl Vegetal');
  const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued(`Quiero tres ${name}`);await h.sendQueued('Mejor solo dos');
  expect(h.conv.sessionData.pendingAttribute?.quantity).toBe(2);await h.sendQueued('Cancela esa selección');await h.sendQueued(flavors[0]);
  expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingAttribute).toBeFalsy();expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});

describe('Cantidad pendiente — reemplazar, incrementar y elegir sabor',()=>{
 const families=[{name:'Jugo Natural',flavors:['Mango','Lulo']},{name:'Gaseosa Artesanal',flavors:['Mora','Durazno']}];
 const operations=[{text:'Que sean dos',qty:2},{text:'Añade dos más',qty:5},{text:'Una más por favor',qty:4},{text:'Mejor dos con {flavor}',qty:2},{text:'Añade dos más con {flavor}',qty:5}];
 it.each(families.flatMap(family=>[false,true].flatMap(agent=>operations.map(operation=>({...family,agent,...operation})))))('$name: $text agent=$agent',async({name,flavors,agent,text,qty})=>{
  const base={id:21301,code:2001,name:'Bowl Vegetal',price:16000,availableNow:true,hasAttributes:false,attributes:[]};
  const drink={id:21302,code:2002,name,price:8000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:flavors}]};
  const h=harness([base,drink] as typeof products,agent);h.service.ordersService.create=jest.fn();await h.sendQueued('Quiero dos Bowl Vegetal');await h.sendQueued(`Quiero tres ${name} sin hielo`);
  const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued(text.replace('{flavor}',flavors[1]));
  if(!text.includes('{flavor}')){expect(h.conv.sessionData.pendingAttribute?.quantity).toBe(qty);expect(h.conv.sessionData.cart).toEqual(before);await h.sendQueued(flavors[1]);}
  expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:base.id,qty:2}),expect.objectContaining({id:drink.id,qty,attrs:[`Sabor:${flavors[1]}`],note:expect.stringMatching(/sin hielo/i)})]));
  expect(h.cartRows()).toHaveLength(2);expect(h.conv.sessionData.pendingAttribute).toBeFalsy();expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it.each(families.flatMap(family=>[false,true].map(agent=>({...family,agent}))))('consulta de incremento no agrega $name agent=$agent',async({name,flavors,agent})=>{
  const drink={id:21401,code:2101,name,price:8000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:flavors}]};
  const h=harness([drink] as typeof products,agent);h.service.ordersService.create=jest.fn();await h.sendQueued(`Quiero tres ${name}`);
  const before=structuredClone(h.conv.sessionData);const reply=await h.sendQueued('¿Si añado dos más cuánto cuestan?');
  expect(reply||'').toMatch(/16\.000/);expect(reply||'').toMatch(/40\.000/);
  expect(h.conv.sessionData).toEqual(before);expect(h.cartRows()).toEqual([]);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});


describe('Incremento pendiente — límites sin mutación',()=>{
 it.each(['Jugo Natural','Gaseosa Artesanal'].flatMap(name=>[false,true].flatMap(agent=>['Añade 28 más','Añade 0 más'].map(text=>({name,agent,text})))))('$name $text agent=$agent',async({name,agent,text})=>{
  const drink={id:21501,code:2201,name,price:8000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mango','Lulo']}]};
  const h=harness([drink] as typeof products,agent);h.service.ordersService.create=jest.fn();await h.sendQueued(`Quiero tres ${name} sin hielo`);
  const before=structuredClone(h.conv.sessionData);const reply=await h.sendQueued(text);
  expect(h.conv.sessionData).toEqual(before);expect(reply||'').toMatch(/entre 1 y 30|pedido sigue igual/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});

describe('Cantidad y varios atributos — selección en un turno',()=>{
 it.each(['Jugo De Avena','Bebida De Citricos'].flatMap(name=>[false,true].flatMap(agent=>[false,true].map(increment=>({name,agent,increment})))))('$name incremento=$increment agent=$agent',async({name,agent,increment})=>{
  const dish={id:21601,code:2301,name,price:28000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mango','Lulo']},{attributeName:'Endulzante',options:['Azucar','Stevia']}]};
  const h=harness([dish] as typeof products,agent);h.service.ordersService.create=jest.fn();await h.sendQueued('Agrega tres #2301 sin hielo');
  expect(h.conv.sessionData.pendingAttribute?.productId).toBe(dish.id);expect(h.conv.sessionData.pendingAttribute?.quantity).toBe(3);
  await h.sendQueued(increment?'Añade dos más con sabor lulo y endulzante stevia':'Mejor dos con sabor lulo y endulzante stevia');
  expect(h.cartRows()).toEqual([expect.objectContaining({id:dish.id,qty:increment?5:2,attrs:expect.arrayContaining(['Sabor:Lulo','Endulzante:Stevia']),note:expect.stringMatching(/sin hielo/i)})]);
  expect(h.conv.sessionData.pendingAttribute).toBeFalsy();expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});

describe('Recorridos reservados — consulta, opciones, cambios y checkout',()=>{
 const menus=[{dish:'Hamburguesa De Garbanzo',drink:'Jugo Tropical',flavors:['Mango','Lulo']},{dish:'Pizza Rustica',drink:'Gaseosa Artesanal',flavors:['Mora','Durazno']},{dish:'Sandwich De Tofu',drink:'Bebida De Citricos',flavors:['Limon','Maracuya']}];
 it.each(menus.flatMap(menu=>[false,true].map(agent=>({...menu,agent}))))('$dish / $drink agent=$agent',async({dish,drink,flavors,agent})=>{
  const food={id:21701,code:2401,name:dish,price:22000,availableNow:true,hasAttributes:false,attributes:[]};
  const beverage={id:21702,code:2402,name:drink,price:6500,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:flavors}]};
  const h=harness([food,beverage] as typeof products,agent);h.service.ordersService.create=jest.fn();
  await h.sendQueued(`Quiero dos ${dish} sin ensalada`);expect(h.cartRows()).toEqual([expect.objectContaining({id:food.id,qty:2,note:expect.stringMatching(/sin ensalada/i)})]);
  const price=await h.sendQueued(`¿Cuánto cuesta ${dish}?`);expect(price||'').toMatch(/22\.000/);expect(h.cartRows()).toHaveLength(1);
  await h.sendQueued('Agrega tres #2402 sin hielo');expect(h.conv.sessionData.pendingAttribute?.quantity).toBe(3);
  const quote=await h.sendQueued('¿Si añado dos más cuánto cuestan?');expect(quote||'').toMatch(/13\.000/);expect(quote||'').toMatch(/32\.500/);expect(h.conv.sessionData.pendingAttribute?.quantity).toBe(3);
  await h.sendQueued(`Añade dos más con ${flavors[1]}`);
  expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:food.id,qty:2,note:expect.stringMatching(/sin ensalada/i)}),expect.objectContaining({id:beverage.id,qty:5,attrs:[`Sabor:${flavors[1]}`],note:expect.stringMatching(/sin hielo/i)})]));expect(h.cartRows()).toHaveLength(2);
  const addressReply=await h.sendQueued('Es para la calle 21 #34-56');expect({state:h.conv.state,address:h.conv.sessionData.address,reply:addressReply,pending:h.conv.sessionData.pendingMultiOrder}).toMatchObject({state:'awaiting_payment',address:expect.stringMatching(/calle 21.*34-56/i),reply:expect.stringMatching(/cómo pagas/i),pending:undefined});
  const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued('Dirección: cl 9 #18-27');expect(h.conv.sessionData.address).toMatch(/9.*18-27/i);expect(h.conv.sessionData.cart).toEqual(before);
  const total=await h.sendQueued('¿Cuánto suma todo?');expect(total||'').toMatch(/78\.500/);expect(h.conv.state).toBe('awaiting_payment');expect(h.conv.sessionData.cart).toEqual(before);
  await h.sendQueued('Pago en efectivo');expect(h.conv.state).toBe('awaiting_final_confirm');expect(h.conv.sessionData.paymentMethod).toBe('cash');expect(h.conv.sessionData.cart).toEqual(before);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});

describe('Narración de comensales — el almuerzo no inventa un ejecutivo',()=>{
 it.each([false,true])('platos separados conservan identidad agent=$agent',async(agent)=>{
  const h=harness(products,agent);h.service.ordersService.create=jest.fn();
  await h.sendQueued('Veci, me colaboras con el almuerzo: somos tres, pero solo dos van a comer churrasco, el otro quiere arroz con pollo. Para cada uno una limonada natural. Los churrascos tres cuartos y sin ensalada; al arroz, bastante ají.');
  expect(h.cartRows()).toEqual([]);expect(h.replies.at(-1)||'').toMatch(/cuántas|cuantas|cuál|cual/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});


describe('Narración de comensales — aclaración en cartas ficticias',()=>{
 it.each([['Pizza Rustica','Pasta De Setas'],['Sandwich De Tofu','Ensalada De Quinoa']].flatMap(names=>[false,true].map(agent=>({names,agent}))))('no inventa menú ni cantidades agent=$agent',async({names,agent})=>{
  const menu=names.map((name,index)=>({id:21801+index,code:2501+index,name,price:18000,availableNow:true,hasAttributes:false,attributes:[]}));
  const h=harness(menu as typeof products,agent);h.service.ordersService.create=jest.fn();
  await h.sendQueued(`Para el almuerzo: somos tres, solo dos van a comer ${names[0]}, el otro quiere ${names[1]}.`);
  expect(h.cartRows()).toEqual([]);expect(h.replies.at(-1)||'').toMatch(/cuántas|cuantas|cuál|cual/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});


describe('Salida real del modelo — cantidades de comensales aplicadas',()=>{
 it('reproduce la salida capturada sin pagar otra inferencia',async()=>{
  const h=harness(products,true);h.service.ordersService.create=jest.fn();
  const recorded=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-recorded-narrative-output.json'),'utf8'));
  h.agent.runTurn.mockResolvedValue(recorded.agentResult);
  await h.sendQueued(recorded.userMessage);
  expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:17,qty:2,note:expect.stringMatching(/tres cuartos.*sin ensalada/i)}),expect.objectContaining({id:23,qty:1,note:expect.stringMatching(/ají/i)}),expect.objectContaining({id:37,qty:3})]));
  expect(h.cartRows()).toHaveLength(3);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it.each([['Curry Vegetal','Torta De Maiz','Agua Mineral'],['Pasta De Setas','Pizza Rustica','Limonada Natural']])('reparto en otra carta %s',async(first,second,drink)=>{
  const menu=[first,second,drink].map((name,index)=>({id:21901+index,code:2601+index,name,price:18000,availableNow:true,hasAttributes:false,attributes:[]}));
  const h=harness(menu as typeof products,true);h.service.ordersService.create=jest.fn();
  h.agent.runTurn.mockResolvedValue({reply:'Listo.',actions:{addItems:[{productId:21901,quantity:3},{productId:21902,quantity:1},{productId:21903,quantity:4}]},toolCalls:['add_item']});
  await h.sendQueued(`Para el almuerzo: somos cuatro, solo tres van a comer ${first}, el otro quiere ${second}. Para cada uno una ${drink}.`);
  expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:21901,qty:3}),expect.objectContaining({id:21902,qty:1}),expect.objectContaining({id:21903,qty:4})]));expect(h.cartRows()).toHaveLength(3);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});

describe('Deja solo el más barato — varios restaurantes', () => {
  const place = (id: number, name: string, price: number) => ({
    id, code: id, name, price, availableNow: true, hasAttributes: false, attributes: [] as { attributeName: string; options: string[] }[],
  });
  const line = (id: number, name: string, price: number, quantity = 1) => ({
    productId: id, code: id, name, unitPrice: price, quantity, attributes: [] as { attributeName: string; attributeValue: string }[],
  });
  const cases = [
    { kind: 'ppp', menu: products, cart: [line(17, 'Churrasco', 38000), line(38, 'Sopa De Ajiaco', 10500), line(7, 'Porcion De Yuca Frita', 7000)], keep: 7, drop: [17, 38] },
    { kind: 'pizza', menu: [place(18701, 'Pizza Margarita', 28000), place(18702, 'Ensalada Verde', 8000)], cart: [line(18701, 'Pizza Margarita', 28000), line(18702, 'Ensalada Verde', 8000)], keep: 18702, drop: [18701] },
    { kind: 'sushi', menu: [place(18711, 'Roll De Salmon', 22000), place(18712, 'Gyoza', 9000)], cart: [line(18711, 'Roll De Salmon', 22000, 2), line(18712, 'Gyoza', 9000)], keep: 18712, drop: [18711] },
    { kind: 'tacos', menu: [place(18721, 'Taco Al Pastor', 16000), place(18722, 'Guacamole', 5000)], cart: [line(18721, 'Taco Al Pastor', 16000, 3), line(18722, 'Guacamole', 5000)], keep: 18722, drop: [18721] },
    { kind: 'burger', menu: [place(18731, 'Hamburguesa De Lentejas', 18000), place(18732, 'Papas Gajo', 6000)], cart: [line(18731, 'Hamburguesa De Lentejas', 18000), line(18732, 'Papas Gajo', 6000)], keep: 18732, drop: [18731] },
    { kind: 'pasta', menu: [place(18741, 'Pasta Al Pesto', 26000), place(18742, 'Pan De Ajo', 4000)], cart: [line(18741, 'Pasta Al Pesto', 26000), line(18742, 'Pan De Ajo', 4000)], keep: 18742, drop: [18741] },
    { kind: 'bowl', menu: [place(18751, 'Bowl De Quinoa', 19000), place(18752, 'Agua De Coco', 5000)], cart: [line(18751, 'Bowl De Quinoa', 19000, 2), line(18752, 'Agua De Coco', 5000)], keep: 18752, drop: [18751] },
    { kind: 'ramen', menu: [place(18761, 'Ramen De Miso', 24000), place(18762, 'Edamame', 8000)], cart: [line(18761, 'Ramen De Miso', 24000), line(18762, 'Edamame', 8000)], keep: 18762, drop: [18761] },
  ];

  it.each(cases.flatMap((item) => [false, true].map((agent) => ({ ...item, agent }))))(
    '$kind deja el más barato y quita el resto (agent $agent)',
    async ({ menu, cart, keep, drop, agent }) => {
      const h = harness(menu as typeof products, agent);
      h.service.ordersService.create = jest.fn();
      h.conv.sessionData.cart = cart;
      const reply = await h.sendQueued('deja solo el más barato');
      expect(h.cartRows().map((row) => row.id)).toEqual([keep]);
      expect(drop.every((id) => !h.cartRows().some((row) => row.id === id))).toBe(true);
      expect(reply || '').toMatch(/dejé solo/i);
      expect(reply || '').toMatch(/pedido sigue igual/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    },
  );

  it.each(cases.flatMap((item) => [false, true].map((agent) => ({ ...item, agent }))))(
    '$kind deja el más caro y quita el resto (agent $agent)',
    async ({ menu, cart, agent }) => {
      const h = harness(menu as typeof products, agent);
      h.service.ordersService.create = jest.fn();
      h.conv.sessionData.cart = cart;
      const expensive = cart.slice().sort((a, b) => b.unitPrice * b.quantity - a.unitPrice * a.quantity)[0].productId;
      const reply = await h.sendQueued('deja solo el más caro');
      expect(h.cartRows().map((row) => row.id)).toEqual([expensive]);
      expect(reply || '').toMatch(/dejé solo/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    },
  );

  it.each([
    { kind: 'pizza', menu: [place(18701, 'Pizza Margarita', 28000), place(18703, 'Focaccia', 8000), place(18702, 'Ensalada Verde', 8000)], cart: [line(18701, 'Pizza Margarita', 28000), line(18703, 'Focaccia', 8000), line(18702, 'Ensalada Verde', 8000)] },
    { kind: 'ramen', menu: [place(18761, 'Ramen De Miso', 24000), place(18763, 'Gyoza', 8000), place(18762, 'Edamame', 8000)], cart: [line(18761, 'Ramen De Miso', 24000), line(18763, 'Gyoza', 8000), line(18762, 'Edamame', 8000)] },
  ].flatMap((item) => [false, true].map((agent) => ({ ...item, agent }))))(
    '$kind empate del barato pregunta y no borra (agent $agent)',
    async ({ menu, cart, agent }) => {
      const h = harness(menu as typeof products, agent);
      h.service.ordersService.create = jest.fn();
      h.conv.sessionData.cart = cart;
      const before = h.cartRows();
      const reply = await h.sendQueued('deja solo el más barato');
      expect(h.cartRows()).toEqual(before);
      expect(reply || '').toMatch(/ese precio/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    },
  );
});

describe('Reparto con pedido ya empezado — varios restaurantes', () => {
  const place = (id: number, name: string, price: number) => ({
    id, code: id, name, price, availableNow: true, hasAttributes: false, attributes: [] as { attributeName: string; options: string[] }[],
  });
  const line = (id: number, name: string, price: number) => ({
    productId: id, code: id, name, unitPrice: price, quantity: 1, attributes: [] as { attributeName: string; attributeValue: string }[],
  });
  const story = (first: string, second: string) =>
    `Para el almuerzo: somos tres, solo dos van a comer ${first}, el otro quiere ${second}. Para cada uno una bebida.`;
  const cases = [
    { kind: 'ppp', menu: products, cart: [line(7, 'Porcion De Yuca Frita', 7000)], text: 'Veci, somos tres, solo dos van a comer churrasco, el otro quiere arroz con pollo. Para cada uno una limonada natural.' },
    { kind: 'pizza', menu: [place(18801, 'Pizza Rustica', 28000), place(18802, 'Pasta De Setas', 24000), place(18803, 'Ensalada Verde', 8000)], cart: [line(18803, 'Ensalada Verde', 8000)], text: story('pizza rustica', 'pasta de setas') },
    { kind: 'sandwich', menu: [place(18811, 'Sandwich De Tofu', 18000), place(18812, 'Ensalada De Quinoa', 16000), place(18813, 'Agua Mineral', 4000)], cart: [line(18813, 'Agua Mineral', 4000)], text: story('sandwich de tofu', 'ensalada de quinoa') },
    { kind: 'curry', menu: [place(18821, 'Curry Vegetal', 22000), place(18822, 'Torta De Maiz', 14000), place(18823, 'Pan Naan', 5000)], cart: [line(18823, 'Pan Naan', 5000)], text: story('curry vegetal', 'torta de maiz') },
    { kind: 'ramen', menu: [place(18831, 'Ramen De Miso', 24000), place(18832, 'Gyoza', 9000), place(18833, 'Edamame', 8000)], cart: [line(18833, 'Edamame', 8000)], text: story('ramen de miso', 'gyoza') },
    { kind: 'tacos', menu: [place(18841, 'Taco Al Pastor', 16000), place(18842, 'Quesadilla', 14000), place(18843, 'Guacamole', 5000)], cart: [line(18843, 'Guacamole', 5000)], text: story('taco al pastor', 'quesadilla') },
    { kind: 'burger', menu: [place(18851, 'Hamburguesa De Lentejas', 18000), place(18852, 'Papas Gajo', 6000)], cart: [line(18852, 'Papas Gajo', 6000)], text: story('hamburguesa de lentejas', 'papas gajo') },
    { kind: 'sushi', menu: [place(18861, 'Roll De Salmon', 22000), place(18862, 'Sopa Miso', 7000)], cart: [line(18862, 'Sopa Miso', 7000)], text: story('roll de salmon', 'sopa miso') },
  ];

  it.each(cases.flatMap((item) => [false, true].map((agent) => ({ ...item, agent }))))(
    '$kind no mezcla el relato con lo ya pedido (agent $agent)',
    async ({ menu, cart, text, agent }) => {
      const h = harness(menu as typeof products, agent);
      h.service.ordersService.create = jest.fn();
      h.conv.sessionData.cart = cart;
      const before = h.cartRows();
      const reply = await h.sendQueued(text);
      expect(h.cartRows()).toEqual(before);
      expect(reply || '').toMatch(/pedido sigue igual/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    },
  );

  it.each([
    { kind: 'ppp', menu: products, cart: [line(17, 'Churrasco', 38000)], address: 'Calle 21 34 56' },
    { kind: 'pizza', menu: [place(18801, 'Pizza Rustica', 28000), place(18802, 'Pasta De Setas', 24000)], cart: [line(18801, 'Pizza Rustica', 28000)], address: 'Carrera 10 20 30' },
    { kind: 'ramen', menu: [place(18831, 'Ramen De Miso', 24000), place(18832, 'Gyoza', 9000)], cart: [line(18831, 'Ramen De Miso', 24000)], address: 'Calle 8 12 40' },
    { kind: 'tacos', menu: [place(18841, 'Taco Al Pastor', 16000), place(18842, 'Quesadilla', 14000)], cart: [line(18841, 'Taco Al Pastor', 16000)], address: 'Calle 4 15 20' },
  ].flatMap((item) => [false, true].map((agent) => ({ ...item, agent }))))(
    '$kind durante el pago no cambia calle ni platos (agent $agent)',
    async ({ menu, cart, address, agent, kind }) => {
      const h = harness(menu as typeof products, agent);
      h.service.ordersService.create = jest.fn();
      h.conv.state = 'awaiting_payment';
      h.conv.sessionData.cart = cart;
      Object.assign(h.conv.sessionData, { orderType: 'delivery', address, addressConfirmed: true, fulfillmentChosen: true });
      const before = h.cartRows();
      const text = kind === 'ppp'
        ? 'Somos tres, dos van a comer churrasco y el otro quiere arroz con pollo.'
        : story(cart[0].name, 'otro plato');
      await h.sendQueued(text);
      expect(h.cartRows()).toEqual(before);
      expect(h.conv.sessionData.address).toBe(address);
      expect(h.conv.state).toBe('awaiting_payment');
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    },
  );

  it.each([
    { kind: 'ppp', menu: products, text: 'Somos tres y para todos una limonada natural' },
    { kind: 'pizza', menu: [place(18801, 'Pizza Rustica', 28000), place(18804, 'Gaseosa Artesanal', 5000)], text: 'Somos cuatro y para todos una gaseosa artesanal' },
    { kind: 'ramen', menu: [place(18831, 'Ramen De Miso', 24000), place(18834, 'Te Verde', 4000)], text: 'Somos dos y cada quien un te verde' },
    { kind: 'bowl', menu: [place(18871, 'Bowl De Quinoa', 19000), place(18872, 'Agua De Coco', 5000)], text: 'Somos tres y para todos un agua de coco' },
  ].flatMap((item) => [false, true].map((agent) => ({ ...item, agent }))))(
    '$kind para todos no inventa la cantidad (agent $agent)',
    async ({ menu, text, agent }) => {
      const h = harness(menu as typeof products, agent);
      h.service.ordersService.create = jest.fn();
      const reply = await h.sendQueued(text);
      expect(h.cartRows()).toEqual([]);
      expect(reply || '').toMatch(/cuántas|cuantas|cuál|cual/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    },
  );
});

describe('Reparto que no cuadra — varios restaurantes', () => {
  const place = (id: number, name: string, price: number) => ({
    id, code: id, name, price, availableNow: true, hasAttributes: false, attributes: [] as { attributeName: string; options: string[] }[],
  });
  const cases = [
    { kind: 'ppp', menu: products, text: 'Somos cuatro, solo dos van a comer churrasco, el otro quiere arroz con pollo.', adds: [{ productId: 17, quantity: 2 }, { productId: 23, quantity: 1 }] },
    { kind: 'pizza', menu: [place(18901, 'Pizza Rustica', 28000), place(18902, 'Pasta De Setas', 24000)], text: 'Somos cinco, solo dos van a comer pizza rustica, el otro quiere pasta de setas.', adds: [{ productId: 18901, quantity: 2 }, { productId: 18902, quantity: 1 }] },
    { kind: 'ramen', menu: [place(18911, 'Ramen De Miso', 24000), place(18912, 'Gyoza', 9000)], text: 'Somos cuatro, solo dos van a comer ramen de miso, el otro quiere gyoza.', adds: [{ productId: 18911, quantity: 2 }, { productId: 18912, quantity: 1 }] },
    { kind: 'tacos', menu: [place(18921, 'Taco Al Pastor', 16000), place(18922, 'Quesadilla', 14000)], text: 'Somos cinco, dos quieren tacos al pastor, el otro quiere quesadilla.', adds: [{ productId: 18921, quantity: 2 }, { productId: 18922, quantity: 1 }] },
    { kind: 'burger', menu: [place(18931, 'Hamburguesa De Lentejas', 18000), place(18932, 'Papas Gajo', 6000)], text: 'Somos cuatro, solo dos van a comer hamburguesa de lentejas, el otro quiere papas gajo.', adds: [{ productId: 18931, quantity: 2 }, { productId: 18932, quantity: 1 }] },
    { kind: 'sushi', menu: [place(18941, 'Roll De Salmon', 22000), place(18942, 'Sopa Miso', 7000)], text: 'Somos seis, solo tres van a comer roll de salmon, el otro quiere sopa miso.', adds: [{ productId: 18941, quantity: 3 }, { productId: 18942, quantity: 1 }] },
    { kind: 'pasta', menu: [place(18951, 'Pasta Al Pesto', 26000), place(18952, 'Pan De Ajo', 4000)], text: 'Somos cuatro, solo dos van a comer pasta al pesto, el otro quiere pan de ajo. Para cada uno una bebida.', adds: [{ productId: 18951, quantity: 2 }, { productId: 18952, quantity: 1 }] },
    { kind: 'bowl', menu: [place(18961, 'Bowl De Quinoa', 19000), place(18962, 'Agua De Coco', 5000)], text: 'Somos cuatro, cinco van a comer bowl de quinoa, el resto quiere agua de coco.', adds: [{ productId: 18961, quantity: 5 }, { productId: 18962, quantity: 1 }] },
  ];

  it.each(cases.flatMap((item) => [false, true].map((agent) => ({ ...item, agent }))))(
    '$kind no arma el pedido si el grupo no cuadra (agent $agent)',
    async ({ menu, text, adds, agent }) => {
      const h = harness(menu as typeof products, agent);
      h.service.ordersService.create = jest.fn();
      if (agent) {
        h.agent.runTurn.mockResolvedValue({ reply: 'Listo.', actions: { addItems: adds }, toolCalls: ['add_item'] });
      }
      const reply = await h.sendQueued(text);
      expect(h.cartRows()).toEqual([]);
      expect(reply || '').toMatch(/no suman/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])('el resto sí cuadra y no se rechaza (agent %s)', async (agent) => {
    const menu = [place(18901, 'Pizza Rustica', 28000), place(18902, 'Pasta De Setas', 24000)];
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    if (agent) {
      h.agent.runTurn.mockResolvedValue({
        reply: 'Listo.',
        actions: { addItems: [{ productId: 18901, quantity: 2 }, { productId: 18902, quantity: 2 }] },
        toolCalls: ['add_item'],
      });
    }
    const reply = await h.sendQueued('Somos cuatro, dos van a comer pizza rustica, el resto quiere pasta de setas.');
    expect(reply || '').not.toMatch(/no suman/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    if (agent) {
      expect(h.cartRows()).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 18901, qty: 2 }),
        expect.objectContaining({ id: 18902, qty: 2 }),
      ]));
    } else {
      expect(h.cartRows()).toEqual([]);
    }
  });

  it.each([
    { kind: 'ppp', menu: products, text: 'Somos tres y una limonada natural por persona' },
    { kind: 'pizza', menu: [place(18901, 'Pizza Rustica', 28000), place(18903, 'Gaseosa Artesanal', 5000)], text: 'Somos cuatro y una gaseosa artesanal por persona' },
    { kind: 'ramen', menu: [place(18911, 'Ramen De Miso', 24000), place(18913, 'Te Verde', 4000)], text: 'Somos dos y un te verde por comensal' },
    { kind: 'bowl', menu: [place(18961, 'Bowl De Quinoa', 19000), place(18962, 'Agua De Coco', 5000)], text: 'Somos tres y un agua de coco por persona' },
  ].flatMap((item) => [false, true].map((agent) => ({ ...item, agent }))))(
    '$kind por persona no inventa la cantidad (agent $agent)',
    async ({ menu, text, agent }) => {
      const h = harness(menu as typeof products, agent);
      h.service.ordersService.create = jest.fn();
      const reply = await h.sendQueued(text);
      expect(h.cartRows()).toEqual([]);
      expect(reply || '').toMatch(/cuántas|cuantas|cuál|cual/i);
      expect(reply || '').not.toMatch(/no suman/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    },
  );
});

describe('Una para cada uno — varios restaurantes', () => {
  const place = (id: number, name: string, price: number) => ({
    id, code: id, name, price, availableNow: true, hasAttributes: false, attributes: [] as { attributeName: string; options: string[] }[],
  });
  const line = (id: number, name: string, price: number) => ({
    productId: id, code: id, name, unitPrice: price, quantity: 1, attributes: [] as { attributeName: string; attributeValue: string }[],
  });
  const cases = [
    { kind: 'ppp', menu: products, id: 37, text: 'Somos 3 y cada uno quiere una Limonada Natural', qty: 3 },
    { kind: 'pizza', menu: [place(19001, 'Pizza Rustica', 28000), place(19002, 'Gaseosa Artesanal', 5000)], id: 19002, text: 'Somos cuatro y cada uno quiere una Gaseosa Artesanal', qty: 4 },
    { kind: 'ramen', menu: [place(19011, 'Ramen De Miso', 24000), place(19012, 'Te Verde', 4000)], id: 19012, text: 'Somos dos y cada uno quiere un Te Verde', qty: 2 },
    { kind: 'tacos', menu: [place(19021, 'Taco Al Pastor', 16000), place(19022, 'Agua De Horchata', 4000)], id: 19022, text: 'Somos tres, una Agua De Horchata para cada uno', qty: 3 },
    { kind: 'burger', menu: [place(19031, 'Hamburguesa De Lentejas', 18000), place(19032, 'Malteada De Chocolate', 7000)], id: 19032, text: 'Somos cinco, para cada uno de nosotros una Malteada De Chocolate', qty: 5 },
    { kind: 'sushi', menu: [place(19041, 'Roll De Salmon', 22000), place(19042, 'Te Matcha', 5000)], id: 19042, text: 'Somos tres y cada una quiere un Te Matcha', qty: 3 },
    { kind: 'pasta', menu: [place(19051, 'Pasta Al Pesto', 26000), place(19052, 'Limonada Natural', 4500)], id: 19052, text: 'Somos cuatro, para cada uno dos Limonada Natural', qty: 8 },
    { kind: 'bowl', menu: [place(19061, 'Bowl De Quinoa', 19000), place(19062, 'Agua De Coco', 5000)], id: 19062, text: 'Somos tres y cada uno quiere un Agua De Coco', qty: 3 },
  ];

  it.each(cases.flatMap((item) => [false, true].map((agent) => ({ ...item, agent }))))(
    '$kind reparte la bebida por persona (agent $agent)',
    async ({ menu, id, text, qty, agent }) => {
      const h = harness(menu as typeof products, agent);
      h.service.ordersService.create = jest.fn();
      if (agent) {
        h.agent.runTurn.mockResolvedValue({
          reply: 'Listo.',
          actions: { addItems: [{ productId: id, quantity: 1 }] },
          toolCalls: ['add_item'],
        });
      }
      const reply = await h.sendQueued(text);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      if (agent) {
        expect(h.cartRows()).toEqual([expect.objectContaining({ id, qty })]);
        expect(reply || '').not.toMatch(/No tenemos|no manejamos/i);
      } else {
        expect(h.cartRows()).toEqual([]);
        expect(reply || '').toMatch(/cuántas|cuantas|cuál|cual/i);
      }
    },
  );

  it.each([
    { kind: 'ppp', menu: products, cart: [line(7, 'Porcion De Yuca Frita', 7000)], pendingId: 50, pendingName: 'Jugo Natural En Agua', text: 'Somos tres y cada uno quiere una Limonada Natural' },
    { kind: 'pizza', menu: [place(19001, 'Pizza Rustica', 28000), place(19002, 'Gaseosa Artesanal', 5000)], cart: [line(19001, 'Pizza Rustica', 28000)], pendingId: 19002, pendingName: 'Gaseosa Artesanal', text: 'Somos cuatro, una Gaseosa Artesanal para cada uno' },
    { kind: 'ramen', menu: [place(19011, 'Ramen De Miso', 24000), place(19012, 'Te Verde', 4000)], cart: [line(19011, 'Ramen De Miso', 24000)], pendingId: 19012, pendingName: 'Te Verde', text: 'Somos dos y cada uno quiere un Te Verde' },
    { kind: 'tacos', menu: [place(19021, 'Taco Al Pastor', 16000), place(19022, 'Agua De Horchata', 4000)], cart: [line(19021, 'Taco Al Pastor', 16000)], pendingId: 19022, pendingName: 'Agua De Horchata', text: 'Somos tres, para cada uno de nosotros una Agua De Horchata' },
  ].flatMap((item) => [false, true].map((agent) => ({ ...item, agent }))))(
    '$kind no cierra la lista de sabor (agent $agent)',
    async ({ menu, cart, pendingId, pendingName, text, agent }) => {
      const h = harness(menu as typeof products, agent);
      h.service.ordersService.create = jest.fn();
      h.conv.state = 'awaiting_attribute';
      h.conv.sessionData.cart = cart;
      h.conv.sessionData.pendingAttribute = {
        productId: pendingId, code: pendingId, name: pendingName, price: 5000,
        attributes: [{ attributeName: 'Sabor', options: ['Mango', 'Lulo'] }], selected: [], quantity: 1,
      };
      const before = h.cartRows();
      const reply = await h.sendQueued(text);
      expect(h.cartRows()).toEqual(before);
      expect(h.conv.sessionData.pendingAttribute?.productId).toBe(pendingId);
      expect(h.conv.state).toBe('awaiting_attribute');
      expect(reply || '').toMatch(/pedido sigue igual/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    },
  );
});

describe('Saludo — veci y hora del día', () => {
  const place = (id: number, name: string) => ({
    id, code: id, name, price: 18000, availableNow: true, hasAttributes: false, attributes: [] as { attributeName: string; options: string[] }[],
  });
  const line = (id: number, name: string, price: number) => ({
    productId: id, code: id, name, unitPrice: price, quantity: 1, attributes: [] as { attributeName: string; attributeValue: string }[],
  });

  it.each([
    { kind: 'ppp', menu: products, brand: 'Pronto Pollo Portal', menuUrl: 'https://www.prontopolloportal.com/menu', text: 'Hola veci', lead: /¡Hola, veci!/ },
    { kind: 'pizza', menu: [place(19101, 'Pizza Rustica')], brand: 'Horno Vecino', menuUrl: 'https://horno.example/menu', text: 'Hola veci', lead: /¡Hola, veci!/ },
    { kind: 'ramen', menu: [place(19111, 'Ramen De Miso')], brand: 'Casa Ramen', menuUrl: 'https://ramen.example/menu', text: 'Buenas tardes veci', lead: /¡Buenas tardes, veci!/ },
    { kind: 'tacos', menu: [place(19121, 'Taco Al Pastor')], brand: 'Tacos Del Parque', menuUrl: 'https://tacos.example/menu', text: 'Hola', lead: /¡Hola!/ },
    { kind: 'burger', menu: [place(19131, 'Hamburguesa De Lentejas')], brand: 'Burger Lento', menuUrl: 'https://burger.example/menu', text: 'Buenos días', lead: /¡Buenos días!/ },
    { kind: 'sushi', menu: [place(19141, 'Roll De Salmon')], brand: 'Barra Norte', menuUrl: 'https://sushi.example/menu', text: 'Hola vecina', lead: /¡Hola, vecina!/ },
    { kind: 'pasta', menu: [place(19151, 'Pasta Al Pesto')], brand: 'Pasta Clara', menuUrl: 'https://pasta.example/menu', text: 'Buenas noches vecino', lead: /¡Buenas noches, vecino!/ },
    { kind: 'bowl', menu: [place(19161, 'Bowl De Quinoa')], brand: 'Bowl Local', menuUrl: 'https://bowl.example/menu', text: 'Buenas', lead: /¡Buenas!/ },
  ].flatMap((item) => [false, true].map((agent) => ({ ...item, agent }))))(
    '$kind responde el saludo y no arma pedido (agent $agent)',
    async ({ menu, brand, menuUrl, text, lead, agent }) => {
      const h = harness(menu as typeof products, agent);
      h.service.ordersService.create = jest.fn();
      h.cfg.brandName = brand;
      h.cfg.menuUrl = menuUrl;
      const reply = await h.sendQueued(text);
      expect(h.cartRows()).toEqual([]);
      expect(reply || '').toMatch(lead);
      expect(reply || '').toMatch(new RegExp(brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      expect(reply || '').toContain(menuUrl);
      expect(reply || '').toMatch(/plato o el código/i);
      if (!/veci/i.test(text)) expect(reply || '').not.toMatch(/veci/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])('el saludo viejo de marca también usa el tono (agent %s)', async (agent) => {
    const h = harness(products, agent);
    h.service.ordersService.create = jest.fn();
    h.cfg.brandName = 'Pronto Pollo Portal';
    h.cfg.menuUrl = 'https://www.prontopolloportal.com/menu';
    h.cfg.welcomeMessage = '¡Hola! 👋 *Pronto Pollo Portal*. ¿Qué se te antoja?\nMenú: https://www.prontopolloportal.com/menu';
    const reply = await h.sendQueued('Hola veci');
    expect(reply || '').toMatch(/¡Hola, veci!/);
    expect(reply || '').toMatch(/plato o el código/i);
    expect(h.cartRows()).toEqual([]);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each([
    { kind: 'ppp', menu: products, cart: [line(7, 'Porcion De Yuca Frita', 7000)], text: 'Hola veci' },
    { kind: 'ramen', menu: [place(19111, 'Ramen De Miso')], cart: [line(19111, 'Ramen De Miso', 18000)], text: 'Buenas tardes' },
  ].flatMap((item) => [false, true].map((agent) => ({ ...item, agent }))))(
    '$kind con pedido no lo borra (agent $agent)',
    async ({ menu, cart, text, agent }) => {
      const h = harness(menu as typeof products, agent);
      h.service.ordersService.create = jest.fn();
      h.cfg.brandName = 'Casa';
      h.cfg.menuUrl = 'https://casa.example/menu';
      h.conv.sessionData.cart = cart;
      const before = h.cartRows();
      const reply = await h.sendQueued(text);
      expect(h.cartRows()).toEqual(before);
      expect(reply || '').toMatch(/sigues con tu pedido/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    },
  );
});

describe('Compra por fuera de la carta — varios restaurantes', () => {
  const place = (id: number, name: string, price: number) => ({
    id, code: id, name, price, availableNow: true, hasAttributes: false, attributes: [] as { attributeName: string; options: string[] }[],
  });
  const line = (id: number, name: string, price: number, quantity = 1) => ({
    productId: id, code: id, name, unitPrice: price, quantity, attributes: [] as { attributeName: string; attributeValue: string }[],
  });
  const cases = [
    { kind: 'ppp', menu: products, cart: [line(38, 'Sopa De Ajiaco', 10500, 4)], text: 'Me pueden comorar unas alcaparras?', item: /alcaparras/i },
    { kind: 'pizza', menu: [place(19201, 'Pizza Rustica', 28000)], cart: [line(19201, 'Pizza Rustica', 28000)], text: 'Me pueden comprar unas aceitunas?', item: /aceitunas/i },
    { kind: 'ramen', menu: [place(19211, 'Ramen De Miso', 24000)], cart: [line(19211, 'Ramen De Miso', 24000)], text: 'Pueden comprarme wasabi?', item: /wasabi/i },
    { kind: 'tacos', menu: [place(19221, 'Taco Al Pastor', 16000)], cart: [line(19221, 'Taco Al Pastor', 16000)], text: 'Me pueden conseguir unas salsas de mango?', item: /salsas de mango/i },
    { kind: 'burger', menu: [place(19231, 'Hamburguesa De Lentejas', 18000)], cart: [line(19231, 'Hamburguesa De Lentejas', 18000)], text: 'Me puedes comprar unos aros de cebolla?', item: /aros de cebolla/i },
    { kind: 'sushi', menu: [place(19241, 'Roll De Salmon', 22000)], cart: [line(19241, 'Roll De Salmon', 22000)], text: 'Me podrían comprar uni?', item: /uni/i },
    { kind: 'pasta', menu: [place(19251, 'Pasta Al Pesto', 26000)], cart: [line(19251, 'Pasta Al Pesto', 26000)], text: 'Me puede comprar trufa?', item: /trufa/i },
    { kind: 'bowl', menu: [place(19261, 'Bowl De Quinoa', 19000)], cart: [line(19261, 'Bowl De Quinoa', 19000)], text: 'Me puedes conseguir kombucha?', item: /kombucha/i },
  ];

  it.each(cases.flatMap((item) => [false, true].map((agent) => ({ ...item, agent }))))(
    '$kind no compra por fuera y deja el pedido (agent $agent)',
    async ({ menu, cart, text, item, agent }) => {
      const h = harness(menu as typeof products, agent);
      h.service.ordersService.create = jest.fn();
      h.conv.sessionData.cart = cart;
      const before = h.cartRows();
      if (agent) {
        h.agent.runTurn.mockResolvedValue({
          reply: `Por ahora no manejamos ${item.source}. Solo lo del menú. El pedido sigue igual.`,
          actions: { addItems: [{ productId: cart[0].productId, quantity: 2 }] },
          toolCalls: ['add_item'],
        });
      }
      const reply = await h.sendQueued(text);
      expect(h.cartRows()).toEqual(before);
      expect(reply || '').toMatch(item);
      expect(reply || '').toMatch(/menú/i);
      expect(reply || '').not.toMatch(/🛒|Carrito/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      if (agent) expect(h.agent.runTurn).toHaveBeenCalled();
      else expect(h.agent.runTurn).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])('sin carrito tampoco inventa el encargo (agent %s)', async (agent) => {
    const h = harness([place(19201, 'Pizza Rustica', 28000)] as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    if (agent) {
      h.agent.runTurn.mockResolvedValue({
        reply: 'No vendemos aceitunas. Solo lo del menú.',
        actions: { addItems: [{ productId: 19201, quantity: 1 }] },
        toolCalls: ['add_item'],
      });
    }
    const reply = await h.sendQueued('Me pueden comprar unas aceitunas?');
    expect(h.cartRows()).toEqual([]);
    expect(reply || '').toMatch(/aceitunas/i);
    expect(reply || '').toMatch(/menú/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    if (agent) expect(h.agent.runTurn).toHaveBeenCalled();
    else expect(reply || '').toMatch(/autorización/i);
  });

  it.each([false, true])('si el producto sí está en la carta no lo rechaza (agent %s)', async (agent) => {
    const h = harness(products, agent);
    h.service.ordersService.create = jest.fn();
    h.conv.sessionData.cart = [line(38, 'Sopa De Ajiaco', 10500, 4)];
    const reply = await h.sendQueued('Me pueden comprar una sopa de ajiaco?');
    expect(reply || '').not.toMatch(/por fuera de la carta/i);
    expect(h.cartRows().some((row) => row.id === 38)).toBe(true);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('Preguntas random — no bloquean al agente', () => {
  const place = (id: number, name: string, price: number) => ({
    id, code: id, name, price, availableNow: true, hasAttributes: false, attributes: [] as { attributeName: string; options: string[] }[],
  });
  const line = (id: number, name: string, price: number, quantity = 1) => ({
    productId: id, code: id, name, unitPrice: price, quantity, attributes: [] as { attributeName: string; attributeValue: string }[],
  });
  const cases = [
    { kind: 'ppp', menu: products, cart: [line(38, 'Sopa De Ajiaco', 10500, 4)], text: 'Venden cigarrillos?' },
    { kind: 'pizza', menu: [place(19301, 'Pizza Rustica', 28000)], cart: [line(19301, 'Pizza Rustica', 28000)], text: 'Aceptan mascotas?' },
    { kind: 'ramen', menu: [place(19311, 'Ramen De Miso', 24000)], cart: [line(19311, 'Ramen De Miso', 24000)], text: 'Tienen cajero?' },
    { kind: 'tacos', menu: [place(19321, 'Taco Al Pastor', 16000)], cart: [line(19321, 'Taco Al Pastor', 16000)], text: 'Hay música en vivo?' },
    { kind: 'burger', menu: [place(19331, 'Hamburguesa De Lentejas', 18000)], cart: [line(19331, 'Hamburguesa De Lentejas', 18000)], text: 'Me puedes cambiar un billete?' },
    { kind: 'sushi', menu: [place(19341, 'Roll De Salmon', 22000)], cart: [line(19341, 'Roll De Salmon', 22000)], text: 'Puedo llevar el perro?' },
    { kind: 'pasta', menu: [place(19351, 'Pasta Al Pesto', 26000)], cart: [line(19351, 'Pasta Al Pesto', 26000)], text: 'Hacen eventos?' },
    { kind: 'bowl', menu: [place(19361, 'Bowl De Quinoa', 19000)], cart: [line(19361, 'Bowl De Quinoa', 19000)], text: 'Tienen promociones hoy?' },
  ];

  it.each(cases.flatMap((item) => [false, true].map((agent) => ({ ...item, agent }))))(
    '$kind deja el pedido y no reimprime el carrito (agent $agent)',
    async ({ menu, cart, text, agent }) => {
      const h = harness(menu as typeof products, agent);
      h.service.ordersService.create = jest.fn();
      h.conv.sessionData.cart = cart;
      const before = h.cartRows();
      if (agent) {
        h.agent.runTurn.mockResolvedValue({
          reply: 'Eso lo confirma el local. No lo sumo al pedido.',
          actions: { addItems: [{ productId: cart[0].productId, quantity: 3 }] },
          toolCalls: ['add_item'],
        });
      }
      const reply = await h.sendQueued(text);
      expect(h.cartRows()).toEqual(before);
      expect(reply || '').not.toMatch(/🛒|Carrito/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      if (agent) {
        expect(h.agent.runTurn).toHaveBeenCalled();
        expect(reply || '').toMatch(/lo confirma el local/i);
      } else {
        expect(h.agent.runTurn).not.toHaveBeenCalled();
        expect(reply || '').toMatch(/no lo resuelvo por este chat/i);
        expect(reply || '').toMatch(/pedido sigue igual/i);
      }
    },
  );

  it.each([false, true])('vender un plato de la carta no es pregunta random (agent %s)', async (agent) => {
    const h = harness(products, agent);
    h.service.ordersService.create = jest.fn();
    h.conv.sessionData.cart = [line(38, 'Sopa De Ajiaco', 10500, 4)];
    const reply = await h.sendQueued('Venden sopa de ajiaco?');
    expect(reply || '').not.toMatch(/no lo resuelvo por este chat/i);
    expect(h.cartRows().some((row) => row.id === 38)).toBe(true);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('Consultas inesperadas — interrumpir sin capturar datos ni perder opciones',()=>{
 const cases=[{text:'Me pueden comorar unas alcaparras?',subject:/alcaparras/i},{text:'Aceptan mascotas?',subject:/mascotas|local|chat/i},{text:'Tienen cajero?',subject:/cajero|local|chat/i}];
 it.each(cases.flatMap(item=>[false,true].flatMap(agent=>['awaiting_name','awaiting_phone','awaiting_address','awaiting_payment','awaiting_final_confirm','awaiting_attribute'].map(state=>({...item,agent,state})))))('$text en $state agent=$agent',async({text,subject,agent,state})=>{
  const dish={id:22001,code:2701,name:'Sopa De Calabaza',price:11000,availableNow:true,hasAttributes:false,attributes:[]};
  const drink={id:22002,code:2702,name:'Jugo Tropical',price:6500,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mango','Lulo']}]};
  const h=harness([dish,drink] as typeof products,agent);h.service.ordersService.create=jest.fn();h.conv.state=state;
  h.conv.sessionData.cart=[{productId:dish.id,name:dish.name,code:dish.code,unitPrice:11000,quantity:4,attributes:[],note:'sin arroz'}];
  h.conv.sessionData.orderType='delivery';h.conv.sessionData.address='Calle 21 #34-56';h.conv.sessionData.addressConfirmed=true;
  if(state==='awaiting_final_confirm')h.conv.sessionData.paymentMethod='cash';
  if(state==='awaiting_name')h.conv.customerName='';
  if(state==='awaiting_attribute')h.conv.sessionData.pendingAttribute={productId:drink.id,name:drink.name,code:drink.code,price:drink.price,attributes:drink.attributes,selected:[],quantity:3,sourceText:'3 Jugo Tropical sin hielo'};
  if(agent)h.agent.runTurn.mockResolvedValue({reply:'Eso lo confirma el local; alcaparras, mascotas o cajero. El pedido sigue igual.',actions:{addItems:[{productId:dish.id,quantity:1}],setCustomerNotes:'consulta',setAddress:'otra'},toolCalls:['add_item']});
  const before=structuredClone(h.conv.sessionData);const name=h.conv.customerName;const reply=await h.sendQueued(text);
  expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBe(name);expect(h.conv.state).toBe(state);
  expect(reply||'').toMatch(subject);expect(reply||'').not.toMatch(/🛒|Carrito/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(state==='awaiting_attribute'){expect(reply||'').toMatch(/sabor|mango|lulo/i);h.agent.runTurn.mockResolvedValue({reply:'¿Cuál prefieres?',actions:{},toolCalls:[]});await h.sendQueued('Lulo');expect(h.cartRows()).toContainEqual(expect.objectContaining({id:drink.id,qty:3,attrs:['Sabor:Lulo']}));}
  if(state==='awaiting_payment')expect(reply||'').toMatch(/cómo pagas|como pagas|pago/i);
 });
});

describe('Favores fuera del menú — cortesía y variantes conservan el pedido',()=>{
 const cases=[{text:'Hola veci, me haces el favor de comprar unas alcaparras?',subject:/alcaparras/i},{text:'Me ayudas a conseguir unas alcaparras porfa?',subject:/alcaparras/i},{text:'Me haces el favor y me consigues unas alcaparras?',subject:/alcaparras/i},{text:'Puedes traerme unas pilas de la tienda?',subject:/pilas/i}];
 it.each(cases.flatMap(item=>[false,true].flatMap(agent=>['building_cart','awaiting_payment'].map(state=>({...item,agent,state})))))('$text state=$state agent=$agent',async({text,subject,agent,state})=>{
  const food={id:22101,code:2801,name:'Pizza Rustica',price:28000,availableNow:true,hasAttributes:false,attributes:[]};
  const h=harness([food] as typeof products,agent);h.service.ordersService.create=jest.fn();h.conv.state=state;h.conv.sessionData.cart=[{productId:food.id,name:food.name,code:food.code,unitPrice:28000,quantity:2,attributes:[],note:'sin cebolla'}];
  if(agent)h.agent.runTurn.mockResolvedValue({reply:'Alcaparras y pilas no están en la carta; consulta con el local. El pedido sigue igual.',actions:{addItems:[{productId:food.id,quantity:1}],clearCart:true},toolCalls:['add_item']});
  const before=structuredClone(h.conv.sessionData);const reply=await h.sendQueued(text);
  expect(h.conv.sessionData).toEqual(before);expect(h.conv.state).toBe(state);expect(reply||'').toMatch(subject);expect(reply||'').not.toMatch(/🛒|Carrito/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});

describe('Cobertura con carrito — recuerda el pedido y conserva el paso',()=>{
 it.each(['Sopa De Calabaza','Pizza Rustica'].flatMap(name=>[false,true].flatMap(agent=>['building_cart','awaiting_payment'].map(state=>({name,agent,state})))))('$name $state agent=$agent',async({name,agent,state})=>{
  const dish={id:22201,code:2901,name,price:10500,availableNow:true,hasAttributes:false,attributes:[]};
  const h=harness([dish] as typeof products,agent);h.service.ordersService.create=jest.fn();h.cfg.defaultDeliveryFee=6000;h.conv.state=state;
  h.conv.sessionData.cart=[{productId:dish.id,name:dish.name,code:dish.code,unitPrice:10500,quantity:4,attributes:[],note:'sin arroz'}];
  if(state==='awaiting_payment'){h.conv.sessionData.orderType='delivery';h.conv.sessionData.address='Calle 21 #34-56';h.conv.sessionData.addressConfirmed=true;}
  const before=structuredClone(h.conv.sessionData);const reply=await h.sendQueued('Tiene domicilios a la Calle 56 sur 78 h 16');
  expect(h.conv.sessionData).toEqual(before);expect(h.conv.state).toBe(state);expect(reply||'').toMatch(new RegExp(name,'i'));expect(reply||'').toMatch(/×4|4 unidades|4 ítems/i);
  expect(reply||'').toMatch(/6\.000/);expect(reply||'').not.toMatch(/qué se te antoja|escribe el.*plato/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(state==='awaiting_payment')expect(reply||'').toMatch(/pago|pagas/i);
 });
 it.each([false,true])('carrito vacío aún invita a pedir agent=%s',async(agent)=>{
  const h=harness([],agent);const reply=await h.sendQueued('Tiene domicilios a la Calle 56 sur 78 h 16');expect(reply||'').toMatch(/plato|se te antoja/i);expect(h.cartRows()).toEqual([]);
 });
 it.each([false,true])('la consulta no borra el sabor pendiente agent=%s',async(agent)=>{
  const dish={id:22301,code:3001,name:'Sopa De Calabaza',price:10500,availableNow:true,hasAttributes:false,attributes:[]};
  const drink={id:22302,code:3002,name:'Jugo Tropical',price:6500,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mango','Lulo']}]};
  const h=harness([dish,drink] as typeof products,agent);h.conv.state='awaiting_attribute';h.conv.sessionData.cart=[{productId:dish.id,name:dish.name,code:dish.code,unitPrice:10500,quantity:4,attributes:[]}];
  h.conv.sessionData.pendingAttribute={productId:drink.id,name:drink.name,code:drink.code,price:drink.price,attributes:drink.attributes,selected:[],quantity:3,sourceText:'3 Jugo Tropical'};
  const before=structuredClone(h.conv.sessionData);const reply=await h.sendQueued('Tiene domicilios a la Calle 56 sur 78 h 16');expect(h.conv.sessionData).toEqual(before);expect(h.conv.state).toBe('awaiting_attribute');expect(reply||'').toMatch(/sabor|mango|lulo/i);
 });
});

describe('Consultas no previstas — respuesta del agente sin acciones sobre pedido',()=>{
 const texts=['Tienen wifi?','Hay parqueadero?','Puedo usar el baño?','Cobran descorche?','¿Qué aceite usan?','¿Cuántos planetas hay?'];
 it.each(texts.flatMap(text=>[false,true].flatMap(agent=>['building_cart','awaiting_payment'].map(state=>({text,agent,state})))))('$text $state agent=$agent',async({text,agent,state})=>{
  const food={id:22401,code:3101,name:'Ramen De Miso',price:24000,availableNow:true,hasAttributes:false,attributes:[]};
  const h=harness([food] as typeof products,agent);h.service.ordersService.create=jest.fn();h.conv.state=state;h.conv.sessionData.cart=[{productId:food.id,name:food.name,code:food.code,unitPrice:24000,quantity:2,attributes:[]}];
  if(agent)h.agent.runTurn.mockResolvedValue({reply:'Esa consulta no cambia el pedido; puedo ayudarte con la carta y para datos del restaurante lo confirma el local.',actions:{clearCart:true,setCustomerNotes:'cambiar',addItems:[{productId:food.id,quantity:7}]},lookupPlacedOrder:{orderNumber:99},toolCalls:['add_item']});
  const before=structuredClone(h.conv.sessionData);const reply=await h.sendQueued(text);
  expect(h.conv.sessionData).toEqual(before);expect(h.conv.state).toBe(state);expect(reply||'').not.toMatch(/🛒|Carrito/i);expect(reply||'').toMatch(/consulta|local|chat/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(agent && !/wifi|parqueadero/i.test(text))expect(h.agent.runTurn).toHaveBeenCalled();
  if(/wifi|parqueadero/i.test(text))expect(h.agent.runTurn).not.toHaveBeenCalled();
 });
});


describe('Después de cobertura — cantidades y consultas sin perder el pedido', () => {
  const menus = ['Sopa De Calabaza', 'Pizza Rustica', 'Ramen De Miso'];
  const cases = [
    { kind: 'añadir', message: (name: string) => `Agrega una ${name} más por favor`, quantity: 5 },
    { kind: 'reemplazar', message: (name: string) => `Deja solo una ${name}`, quantity: 1 },
    { kind: 'reconsiderar', message: (name: string) => `Mejor dame dos ${name} en total`, quantity: 2 },
    { kind: 'quitar', message: (name: string) => `Quita una ${name}`, quantity: 3 },
    { kind: 'cotizar', message: (name: string) => `¿Cuánto cuesta una ${name}?`, quantity: 4 },
    { kind: 'hipotético', message: (name: string) => `¿Si agrego una ${name} más cuánto cuesta?`, quantity: 4 },
  ];
  it.each(menus.flatMap(name => [false, true].flatMap(agent => cases.map(test => ({name,agent,...test})))))('$name $kind agent=$agent', async ({name,agent,message,quantity,kind}) => {
    const dish = {id:22501,code:3201,name,price:10500,availableNow:true,hasAttributes:false,attributes:[]};
    const extra = {id:22502,code:3202,name:'Agua Mineral',price:3000,availableNow:true,hasAttributes:false,attributes:[]};
    const h = harness([dish,extra] as typeof products,agent);
    h.service.ordersService.create = jest.fn();
    h.conv.sessionData.cart = [
      {productId:dish.id,name,code:dish.code,unitPrice:dish.price,quantity:4,attributes:[],note:'bien caliente'},
      {productId:extra.id,name:extra.name,code:extra.code,unitPrice:extra.price,quantity:2,attributes:[]},
    ];
    const before = structuredClone(h.conv.sessionData);
    await h.sendQueued('Tiene domicilios a la Calle 56 sur 78 h 16');
    expect(h.conv.sessionData).toEqual(before);
    const reply = await h.sendQueued(message(name));
    expect(h.cartRows()).toEqual([
      expect.objectContaining({id:dish.id,qty:quantity,note:'bien caliente'}),
      expect.objectContaining({id:extra.id,qty:2}),
    ]);
    expect(h.conv.sessionData.address).toBe(before.address);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    expect(reply || '').not.toMatch(/no tenemos|no manejamos/i);
    if (kind==='cotizar' || kind==='hipotético') expect(reply || '').toMatch(/10\.500/);
  });
});


describe('Incrementos del carrito — límites y líneas con notas distintas', () => {
  it.each(['Sopa De Calabaza','Pizza Rustica','Ramen De Miso'].flatMap(name => [false,true].flatMap(agent => ['0','27','ambigua'].map(kind => ({name,agent,kind})))))('$name $kind agent=$agent', async ({name,agent,kind}) => {
    const dish={id:22601,code:3301,name,price:10500,availableNow:true,hasAttributes:false,attributes:[]};
    const h=harness([dish] as typeof products,agent);
    h.service.ordersService.create=jest.fn();
    h.conv.sessionData.cart=[{productId:dish.id,name,code:dish.code,unitPrice:dish.price,quantity:4,attributes:[],note:'sin cilantro'}];
    if(kind==='ambigua')h.conv.sessionData.cart.push({productId:dish.id,name,code:dish.code,unitPrice:dish.price,quantity:2,attributes:[],note:'con cilantro'});
    const before=structuredClone(h.conv.sessionData);
    const reply=await h.sendQueued(`Agrega ${kind==='ambigua'?'una':kind} ${name} más por favor`);
    expect(h.conv.sessionData).toEqual(before);
    expect(reply || '').toMatch(kind==='ambigua'?/cu[aá]l.*l[ií]nea|cu[aá]l.*plato/i:/1.*30|l[ií]mite/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});


describe('Referencia corta de cantidad — solo cuando hay una línea inequívoca', () => {
  it.each(['Sopa De Calabaza','Pizza Rustica','Ramen De Miso'].flatMap(name=>[false,true].flatMap(agent=>['reemplazar','añadir','ambigua'].map(kind=>({name,agent,kind})))))('$name $kind agent=$agent',async({name,agent,kind})=>{
    const dish={id:22701,code:3401,name,price:10500,availableNow:true,hasAttributes:false,attributes:[]};
    const h=harness([dish] as typeof products,agent);h.service.ordersService.create=jest.fn();
    h.conv.sessionData.cart=[{productId:dish.id,name,code:dish.code,unitPrice:dish.price,quantity:4,attributes:[],note:'sin cilantro'}];
    if(kind==='ambigua')h.conv.sessionData.cart.push({productId:dish.id,name,code:dish.code,unitPrice:dish.price,quantity:2,attributes:[],note:'con cilantro'});
    const before=structuredClone(h.conv.sessionData);
    const reply=await h.sendQueued(kind==='añadir'?'Una más por favor':'Mejor solo una');
    if(kind==='ambigua'){expect(h.conv.sessionData).toEqual(before);expect(reply||'').toMatch(/cu[aá]l|plato|l[ií]nea/i);}
    else expect(h.cartRows()).toEqual([expect.objectContaining({id:dish.id,qty:kind==='añadir'?5:1,note:'sin cilantro'})]);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});


describe('Decrementos y compra pendiente — edición de una línea sin perder otra', () => {
  const names=['Sopa De Calabaza','Pizza Rustica','Ramen De Miso'];
  it.each(names.flatMap(name=>[false,true].flatMap(agent=>['absoluta','quitar'].map(kind=>({name,agent,kind})))))('$name conserva sabor pendiente $kind agent=$agent',async({name,agent,kind})=>{
    const dish={id:22801,code:3501,name,price:10500,availableNow:true,hasAttributes:false,attributes:[]};
    const drink={id:22802,code:3502,name:'Jugo Tropical',price:6500,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mango','Lulo']}]};
    const h=harness([dish,drink] as typeof products,agent);h.service.ordersService.create=jest.fn();
    h.conv.state='awaiting_attribute';h.conv.sessionData.cart=[{productId:dish.id,name,code:dish.code,unitPrice:dish.price,quantity:4,attributes:[],note:'bien caliente'}];
    h.conv.sessionData.pendingAttribute={productId:drink.id,name:drink.name,code:drink.code,price:drink.price,attributes:drink.attributes,selected:[],quantity:3,sourceText:'3 Jugo Tropical sin hielo'};
    const pending=structuredClone(h.conv.sessionData.pendingAttribute);
    const reply=await h.sendQueued(kind==='absoluta'?`Deja solo dos ${name}`:`Quita una ${name}`);
    expect(h.cartRows()).toEqual([expect.objectContaining({id:dish.id,qty:kind==='absoluta'?2:3,note:'bien caliente'})]);
    expect(h.conv.sessionData.pendingAttribute).toEqual(pending);expect(h.conv.state).toBe('awaiting_attribute');
    expect(reply||'').toMatch(/sabor|mango|lulo/i);
    await h.sendQueued('Lulo');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:dish.id,qty:kind==='absoluta'?2:3}),expect.objectContaining({id:drink.id,qty:3,attrs:['Sabor:Lulo'],note:'sin hielo'})]);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
  it.each(names.flatMap(name=>[false,true].flatMap(agent=>['Dos menos de','Quita dos unidades de'].map(lead=>({name,agent,lead})))))('$lead $name agent=$agent',async({name,agent,lead})=>{
    const dish={id:22901,code:3601,name,price:10500,availableNow:true,hasAttributes:false,attributes:[]};
    const h=harness([dish] as typeof products,agent);h.service.ordersService.create=jest.fn();
    h.conv.sessionData.cart=[{productId:dish.id,name,code:dish.code,unitPrice:dish.price,quantity:4,attributes:[],note:'sin cilantro'}];
    const reply=await h.sendQueued(`${lead} ${name} por favor`);
    expect(h.cartRows()).toEqual([expect.objectContaining({id:dish.id,qty:2,note:'sin cilantro'})]);
    expect(reply||'').not.toMatch(/no tenemos|no manejamos/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});


describe('Cantidad sabor y nota en un turno — completar la compra pendiente',()=>{
 it.each(['Jugo Tropical','Gaseosa Artesanal'].flatMap(name=>[false,true].flatMap(agent=>['reemplazar','añadir'].map(kind=>({name,agent,kind})))))('$name $kind agent=$agent',async({name,agent,kind})=>{
  const drink={id:23001,code:3701,name,price:6500,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mango','Lulo']}]};
  const h=harness([drink] as typeof products,agent);h.service.ordersService.create=jest.fn();h.conv.state='awaiting_attribute';
  h.conv.sessionData.pendingAttribute={productId:drink.id,name,code:drink.code,price:drink.price,attributes:drink.attributes,selected:[],quantity:3,sourceText:`3 ${name} sin azúcar`};
  const reply=await h.sendQueued(kind==='reemplazar'?'Mejor solo dos con Lulo y sin hielo':'Una más con Lulo y sin hielo');
  expect(h.cartRows()).toEqual([expect.objectContaining({id:drink.id,qty:kind==='reemplazar'?2:4,attrs:['Sabor:Lulo'],note:expect.stringMatching(/sin hielo/i)})]);
  expect(h.cartRows()[0].note).toMatch(/sin az[uú]car/i);expect(reply||'').toMatch(/sin hielo/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});


describe('Decrementos — límites, línea completa y ambigüedad',()=>{
 it.each(['Sopa De Calabaza','Pizza Rustica','Ramen De Miso'].flatMap(name=>[false,true].flatMap(agent=>['cero','exceso','completa','ambigua'].map(kind=>({name,agent,kind})))))('$name $kind agent=$agent',async({name,agent,kind})=>{
  const dish={id:23101,code:3801,name,price:10500,availableNow:true,hasAttributes:false,attributes:[]};
  const water={id:23102,code:3802,name:'Agua Mineral',price:3000,availableNow:true,hasAttributes:false,attributes:[]};
  const h=harness([dish,water] as typeof products,agent);h.service.ordersService.create=jest.fn();
  h.conv.sessionData.cart=[{productId:dish.id,name,code:dish.code,unitPrice:dish.price,quantity:4,attributes:[],note:'sin cilantro'},
    {productId:water.id,name:water.name,code:water.code,unitPrice:water.price,quantity:2,attributes:[]}];
  if(kind==='ambigua')h.conv.sessionData.cart.push({productId:dish.id,name,code:dish.code,unitPrice:dish.price,quantity:3,attributes:[],note:'con cilantro'});
  const before=structuredClone(h.conv.sessionData);
  const reply=await h.sendQueued(`${kind==='cero'?0:kind==='exceso'?5:kind==='completa'?4:2} menos de ${name}`);
  if(kind==='completa')expect(h.cartRows()).toEqual([expect.objectContaining({id:water.id,qty:2})]);
  else {expect(h.conv.sessionData).toEqual(before);expect(reply||'').toMatch(kind==='ambigua'?/cu[aá]l.*plato|cu[aá]l.*l[ií]nea/i:/no.*quitar|cantidad/i);}
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it.each(['Jugo Tropical','Gaseosa Artesanal'].flatMap(name=>[false,true].map(agent=>({name,agent}))))('nota inicial válida $name agent=$agent',async({name,agent})=>{
  const drink={id:23201,code:3901,name,price:6500,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mango','Lulo']}]};
  const h=harness([drink] as typeof products,agent);h.conv.state='awaiting_attribute';h.conv.sessionData.pendingAttribute={productId:drink.id,name,code:drink.code,price:drink.price,attributes:drink.attributes,selected:[],quantity:3,sourceText:`3 ${name} sin azúcar`};
  await h.sendQueued('Lulo');expect(h.cartRows()).toEqual([expect.objectContaining({id:drink.id,qty:3,attrs:['Sabor:Lulo'],note:expect.stringMatching(/sin az[uú]car/i)})]);
 });
});


describe('Decremento completo — números dentro del nombre son parte del producto',()=>{
 it.each(['1 Pollo Frito','Dos Empanadas'].flatMap(name=>[false,true].map(agent=>({name,agent}))))('$name agent=$agent',async({name,agent})=>{
  const dish={id:23301,code:4001,name,price:15000,availableNow:true,hasAttributes:false,attributes:[]};
  const water={id:23302,code:4002,name:'Agua Mineral',price:3000,availableNow:true,hasAttributes:false,attributes:[]};
  const h=harness([dish,water] as typeof products,agent);h.service.ordersService.create=jest.fn();
  h.conv.sessionData.cart=[{productId:dish.id,name,code:dish.code,unitPrice:dish.price,quantity:4,attributes:[]},{productId:water.id,name:water.name,code:water.code,unitPrice:water.price,quantity:2,attributes:[]}];
  await h.sendQueued(`4 menos de ${name}`);expect(h.cartRows()).toEqual([expect.objectContaining({id:water.id,qty:2})]);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});


describe('Mismo producto agregado y pendiente — no confundir el referente',()=>{
 const names=['Jugo Tropical','Gaseosa Artesanal','Bebida De Citricos'];
 it.each(names.flatMap(name=>[false,true].flatMap(agent=>['absoluta','quitar','añadir','opcion'].map(kind=>({name,agent,kind})))))('$name $kind agent=$agent',async({name,agent,kind})=>{
  const drink={id:23401,code:4101,name,price:6500,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mango','Lulo']}]};
  const h=harness([drink] as typeof products,agent);h.service.ordersService.create=jest.fn();h.conv.state='awaiting_attribute';
  h.conv.sessionData.cart=[{productId:drink.id,name,code:drink.code,unitPrice:drink.price,quantity:4,attributes:[{attributeName:'Sabor',attributeValue:'Mango'}],note:'sin hielo'}];
  h.conv.sessionData.pendingAttribute={productId:drink.id,name,code:drink.code,price:drink.price,attributes:drink.attributes,selected:[],quantity:3,sourceText:`3 ${name} sin azúcar`};
  const before=structuredClone(h.conv.sessionData);
  const text=kind==='absoluta'?`Deja solo dos ${name}`:kind==='quitar'?`Quita una ${name}`:kind==='añadir'?`Agrega una ${name} más`:`Deja solo dos ${name} con Mango`;
  const reply=await h.sendQueued(text);
  if(kind==='opcion'){
   expect(h.cartRows()).toEqual([expect.objectContaining({id:drink.id,qty:2,attrs:['Sabor:Mango'],note:'sin hielo'})]);
   expect(h.conv.sessionData.pendingAttribute).toEqual(before.pendingAttribute);expect(h.conv.state).toBe('awaiting_attribute');expect(reply||'').toMatch(/sabor|lulo/i);
   await h.sendQueued('Lulo');expect(h.cartRows()).toEqual([expect.objectContaining({id:drink.id,qty:2,attrs:['Sabor:Mango']}),expect.objectContaining({id:drink.id,qty:3,attrs:['Sabor:Lulo'],note:expect.stringMatching(/sin az[uú]car/i)})]);
  }else{
   expect(h.conv.sessionData).toEqual(before);expect(h.conv.state).toBe('awaiting_attribute');expect(reply||'').toMatch(/carrito.*pendiente|pendiente.*carrito|ya.*agregad|est[aá]s.*eligiendo/i);
  }
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it.each(names.flatMap(name=>[false,true].map(agent=>({name,agent}))))('$name cambia solo lo pendiente con opción explícita agent=$agent',async({name,agent})=>{
  const drink={id:23501,code:4201,name,price:6500,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mango','Lulo']}]};
  const h=harness([drink] as typeof products,agent);h.service.ordersService.create=jest.fn();h.conv.state='awaiting_attribute';
  h.conv.sessionData.cart=[{productId:drink.id,name,code:drink.code,unitPrice:drink.price,quantity:4,attributes:[{attributeName:'Sabor',attributeValue:'Mango'}],note:'sin hielo'}];
  h.conv.sessionData.pendingAttribute={productId:drink.id,name,code:drink.code,price:drink.price,attributes:drink.attributes,selected:[],quantity:3,sourceText:`3 ${name} sin azúcar`};
  await h.sendQueued('Mejor solo dos con Lulo');expect(h.cartRows()).toEqual([expect.objectContaining({id:drink.id,qty:4,attrs:['Sabor:Mango'],note:'sin hielo'}),expect.objectContaining({id:drink.id,qty:2,attrs:['Sabor:Lulo'],note:expect.stringMatching(/sin az[uú]car/i)})]);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});


describe('Listas simultáneas — precio, cantidad y sabor no comparten números',()=>{
 it.each(['Sopa De Calabaza','Pizza Rustica'].flatMap(name=>[false,true].flatMap(agent=>[false,true].map(flavor=>({name,agent,flavor})))))('$name agent=$agent sabor=$flavor',async({name,agent,flavor})=>{
  const dish={id:23601,code:4301,name,price:10500,availableNow:true,hasAttributes:false,attributes:[]};
  const water={id:23602,code:4302,name:'Agua Mineral',price:3000,availableNow:true,hasAttributes:false,attributes:[]};
  const drink={id:23603,code:4303,name:'Jugo Tropical',price:6500,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mango','Lulo']}]};
  const h=harness([dish,water,drink] as typeof products,agent);h.service.ordersService.create=jest.fn();
  h.conv.sessionData.cart=[{productId:dish.id,name,code:dish.code,unitPrice:dish.price,quantity:4,attributes:[],note:'sin cilantro'},
   {productId:dish.id,name,code:dish.code,unitPrice:dish.price,quantity:3,attributes:[],note:'con cilantro'},
   {productId:water.id,name:water.name,code:water.code,unitPrice:water.price,quantity:1,attributes:[]}];
  if(flavor){h.conv.state='awaiting_attribute';h.conv.sessionData.pendingAttribute={productId:drink.id,name:drink.name,code:drink.code,price:drink.price,attributes:drink.attributes,selected:[],quantity:3,sourceText:'3 Jugo Tropical sin azúcar'};}
  await h.sendQueued(`Deja solo dos ${name}`);expect(h.conv.sessionData.pendingCartQuantity?.options).toHaveLength(2);
  await h.sendQueued('Que precio tiene');expect(h.conv.sessionData.pendingPriceInquiry?.productIds).toHaveLength(2);
  const before=structuredClone(h.conv.sessionData);const state=h.conv.state;
  const reply=await h.sendQueued('2');expect(h.conv.sessionData).toEqual(before);expect(h.conv.state).toBe(state);expect(reply||'').toMatch(/listas|precio.*opci[oó]n|aclar/i);
  await h.sendQueued('Agua Mineral');expect(h.conv.sessionData.pendingCartQuantity).toEqual(before.pendingCartQuantity);expect(h.cartRows()).toEqual(before.cart.map(line=>({id:line.productId,qty:line.quantity,note:line.note,attrs:(line.attributes || []).map(a=>`${a.attributeName}:${a.attributeValue}`)})));
  if(flavor){const clarified=structuredClone(h.conv.sessionData);const answer=await h.sendQueued('2');expect(h.conv.sessionData).toEqual(clarified);expect(answer||'').toMatch(/listas|cantidad.*opci[oó]n/i);}
  else {await h.sendQueued('2');expect(h.cartRows()).toEqual([expect.objectContaining({id:dish.id,qty:4,note:'sin cilantro'}),expect.objectContaining({id:dish.id,qty:2,note:'con cilantro'}),expect.objectContaining({id:water.id,qty:1})]);}
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});


describe('Referente de cantidad — varios agregados o solo compra pendiente',()=>{
 it.each(['Jugo Tropical','Gaseosa Artesanal','Bebida De Citricos'].flatMap(name=>[false,true].flatMap(agent=>['varias','soloPendiente'].map(kind=>({name,agent,kind})))))('$name $kind agent=$agent',async({name,agent,kind})=>{
  const drink={id:23701,code:4401,name,price:6500,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mango','Lulo']}]};
  const water={id:23702,code:4402,name:'Agua Mineral',price:3000,availableNow:true,hasAttributes:false,attributes:[]};
  const h=harness([drink,water] as typeof products,agent);h.service.ordersService.create=jest.fn();h.conv.state='awaiting_attribute';
  h.conv.sessionData.cart=kind==='varias'?[{productId:drink.id,name,code:drink.code,unitPrice:drink.price,quantity:4,attributes:[{attributeName:'Sabor',attributeValue:'Mango'}],note:'sin hielo'},
   {productId:drink.id,name,code:drink.code,unitPrice:drink.price,quantity:2,attributes:[{attributeName:'Sabor',attributeValue:'Lulo'}],note:'con hielo'}]:[{productId:water.id,name:water.name,code:water.code,unitPrice:water.price,quantity:1,attributes:[]}];
  h.conv.sessionData.pendingAttribute={productId:drink.id,name,code:drink.code,price:drink.price,attributes:drink.attributes,selected:[],quantity:3,sourceText:`3 ${name} sin azúcar`};
  const before=structuredClone(h.conv.sessionData);const reply=await h.sendQueued(`Que sean dos ${name}`);
  if(kind==='varias'){expect(h.conv.sessionData).toEqual(before);expect(reply||'').toMatch(/carrito.*pendiente|pendiente.*carrito/i);}
  else {expect(h.conv.sessionData.cart).toEqual(before.cart);expect(h.conv.sessionData.pendingAttribute).toEqual({...before.pendingAttribute,quantity:2});expect(reply||'').toMatch(/sabor|mango|lulo/i);await h.sendQueued('Lulo');expect(h.cartRows()).toEqual([expect.objectContaining({id:water.id,qty:1}),expect.objectContaining({id:drink.id,qty:2,attrs:['Sabor:Lulo'],note:expect.stringMatching(/sin az[uú]car/i)})]);}
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});


describe('Notas como referente — corregir solo la línea indicada',()=>{
 it.each(['Sopa De Calabaza','Pizza Rustica','Ramen De Miso'].flatMap(name=>[false,true].flatMap(agent=>['sin','con'].map(modifier=>({name,agent,modifier})))))('$name $modifier cilantro agent=$agent',async({name,agent,modifier})=>{
  const dish={id:23801,code:4501,name,price:10500,availableNow:true,hasAttributes:false,attributes:[]};
  const water={id:23802,code:4502,name:'Agua Mineral',price:3000,availableNow:true,hasAttributes:false,attributes:[]};
  const h=harness([dish,water] as typeof products,agent);h.service.ordersService.create=jest.fn();
  h.conv.sessionData.cart=[{productId:dish.id,name,code:dish.code,unitPrice:dish.price,quantity:4,attributes:[],note:'sin cilantro'},
   {productId:dish.id,name,code:dish.code,unitPrice:dish.price,quantity:3,attributes:[],note:'con cilantro'},
   {productId:water.id,name:water.name,code:water.code,unitPrice:water.price,quantity:1,attributes:[]}];
  const reply=await h.sendQueued(`Deja solo dos ${name} ${modifier} cilantro`);
  expect(h.cartRows()).toEqual([expect.objectContaining({id:dish.id,qty:modifier==='sin'?2:4,note:'sin cilantro'}),expect.objectContaining({id:dish.id,qty:modifier==='con'?2:3,note:'con cilantro'}),expect.objectContaining({id:water.id,qty:1})]);
  expect(reply||'').not.toMatch(/no est[aá].*carrito|cu[aá]l.*l[ií]nea/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});


describe('Referencias por notas — identidad y ambigüedad se conservan',()=>{
 it.each(['Sopa De Calabaza','Pizza Rustica'].flatMap(name=>[false,true].flatMap(agent=>['identidad','iguales','pendiente'].map(kind=>({name,agent,kind})))))('$name $kind agent=$agent',async({name,agent,kind})=>{
  const dish={id:23901,code:4601,name,price:10500,availableNow:true,hasAttributes:false,attributes:[]};
  const water={id:23902,code:4602,name:'Agua Mineral',price:3000,availableNow:true,hasAttributes:false,attributes:[]};
  const h=harness([dish,water] as typeof products,agent);h.service.ordersService.create=jest.fn();
  h.conv.sessionData.cart=[{productId:dish.id,name,code:dish.code,unitPrice:dish.price,quantity:4,attributes:[],note:'sin cilantro'}];
  if(kind==='identidad')h.conv.sessionData.cart.push({productId:water.id,name:water.name,code:water.code,unitPrice:water.price,quantity:1,attributes:[],note:`para ${name}`});
  if(kind==='iguales')h.conv.sessionData.cart.push({productId:dish.id,name,code:dish.code,unitPrice:dish.price,quantity:3,attributes:[],note:'sin cilantro'});
  if(kind==='pendiente'){h.conv.state='awaiting_attribute';h.conv.sessionData.pendingAttribute={productId:dish.id,name,code:dish.code,price:dish.price,attributes:[{attributeName:'Salsa',options:['Roja','Verde']}],selected:[],quantity:3,sourceText:`3 ${name} sin cilantro`};}
  const before=structuredClone(h.conv.sessionData);const reply=await h.sendQueued(`Deja solo dos ${name}${kind==='identidad'?'':' sin cilantro'}`);
  if(kind==='identidad')expect(h.cartRows()).toEqual([expect.objectContaining({id:dish.id,qty:2,note:'sin cilantro'}),expect.objectContaining({id:water.id,qty:1,note:`para ${name}`})]);
  else {expect(h.conv.sessionData.cart).toEqual(before.cart);if(kind==='iguales')expect(h.conv.sessionData.pendingCartQuantity?.options).toHaveLength(2);else {expect(h.conv.sessionData).toEqual(before);expect(reply||'').toMatch(/carrito.*pendiente|pendiente.*carrito/i);}}
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});


describe('Listas de productos — nombres completos y elección estable',()=>{
 const synthetic=(base:string,id:number)=>[
  {id,code:id-24000+500,name:`${base} Solo`,price:22000,availableNow:true,hasAttributes:false,attributes:[],description:'Porción individual'},
  {id:id+1,code:id-24000+501,name:`Combo ${base} Con Pollo`,price:29000,availableNow:true,hasAttributes:false,attributes:[],description:'Incluye pollo y bebida'},
  {id:id+2,code:id-24000+502,name:`Combo ${base} Con Costillas De Cerdo`,price:31000,availableNow:true,hasAttributes:false,attributes:[],description:'Incluye costillas y bebida'},
 ];
 const cases=[{kind:'ppp',menu:products,text:'que arroces maneja'},
  {kind:'pizza',menu:synthetic('Pizza Rustica',24001),text:'tienen pizza rustica'},
  {kind:'ramen',menu:synthetic('Ramen De Miso',24011),text:'tienen ramen de miso'}];
 it.each(cases.flatMap(c=>[false,true].flatMap(agent=>['numero','codigo'].map(choice=>({...c,agent,choice})))))('$kind $choice agent=$agent',async({menu,text,agent,choice})=>{
  const h=harness(menu as typeof products,agent);h.service.ordersService.create=jest.fn();
  const reply=await h.sendQueued(text);const candidates=h.conv.sessionData.pendingMatch?.candidates || [];
  expect(candidates.length).toBeGreaterThanOrEqual(3);expect(h.cartRows()).toEqual([]);
  for(const product of candidates){expect(reply||'').toContain(product.name);expect(reply||'').toContain(`#${product.code}`);}
  expect(reply||'').not.toMatch(/\*Combo \(con bebida\)\*|\*Porcion De\*/i);
  const chosen=candidates[1];await h.sendQueued(choice==='numero'?'2':`Quiero el código ${chosen.code}`);
  for(let step=0;h.conv.sessionData.pendingAttribute && step<3;step++){
   const pending=h.conv.sessionData.pendingAttribute;expect(pending.productId).toBe(chosen.id);
   const remaining=h.service.catalogService.getRemainingAttributes(chosen,pending.selected);expect(remaining.length).toBeGreaterThan(0);await h.sendQueued(remaining[0].options[0]);
  }
  expect(h.cartRows()).toEqual([expect.objectContaining({id:chosen.id,qty:1})]);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it.each(cases.flatMap(c=>[false,true].flatMap(agent=>['¿Qué trae la opción 2?','¿Qué incluye la segunda?','¿Cómo es la opción 2?'].map(question=>({...c,agent,question})))))('$kind $question pregunta por opción sin comprar agent=$agent',async({menu,text,agent,question})=>{
  const h=harness(menu as typeof products,agent);h.service.ordersService.create=jest.fn();await h.sendQueued(text);
  const options=structuredClone(h.conv.sessionData.pendingMatch);const chosen=options!.candidates[1];const reply=await h.sendQueued(question);
  expect(reply||'').toContain(chosen.name);expect(reply||'').toContain(chosen.description!);expect(h.cartRows()).toEqual([]);expect(h.conv.sessionData.pendingMatch).toEqual(options);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});


describe('Aclaración de precio — resolver la lista sin perder otra opción',()=>{
 it.each(['Sopa De Calabaza','Pizza Rustica'].flatMap(name=>[false,true].flatMap(agent=>['El precio del segundo','Precio 2','El precio de la segunda','El precio de Agua Mineral'].map(text=>({name,agent,text})))))('$name $text agent=$agent',async({name,agent,text})=>{
  const dish={id:24101,code:4701,name,price:10500,availableNow:true,hasAttributes:false,attributes:[]};
  const water={id:24102,code:4702,name:'Agua Mineral',price:3000,availableNow:true,hasAttributes:false,attributes:[]};
  const drink={id:24103,code:4703,name:'Jugo Tropical',price:6500,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mango','Lulo']}]};
  const h=harness([dish,water,drink] as typeof products,agent);h.service.ordersService.create=jest.fn();h.conv.state='awaiting_attribute';
  h.conv.sessionData.cart=[{productId:dish.id,name,code:dish.code,unitPrice:dish.price,quantity:4,attributes:[],note:'sin cilantro'},
   {productId:water.id,name:water.name,code:water.code,unitPrice:water.price,quantity:1,attributes:[]}];
  h.conv.sessionData.pendingAttribute={productId:drink.id,name:drink.name,code:drink.code,price:drink.price,attributes:drink.attributes,selected:[],quantity:3,sourceText:'3 Jugo Tropical sin azúcar'};
  await h.sendQueued('Que precio tiene');expect(h.conv.sessionData.pendingPriceInquiry?.productIds).toEqual([dish.id,water.id]);
  const before=structuredClone(h.conv.sessionData);const reply=await h.sendQueued(text);
  expect(reply||'').toMatch(/Agua Mineral.*3\.000/i);expect(reply||'').toMatch(/sabor|lulo|mango/i);
  expect(h.conv.sessionData.cart).toEqual(before.cart);expect(h.conv.sessionData.pendingAttribute).toEqual(before.pendingAttribute);expect(h.conv.sessionData.pendingPriceInquiry).toBeUndefined();
  await h.sendQueued('Lulo');expect(h.cartRows()).toEqual([expect.objectContaining({id:dish.id,qty:4}),expect.objectContaining({id:water.id,qty:1}),expect.objectContaining({id:drink.id,qty:3,attrs:['Sabor:Lulo'],note:expect.stringMatching(/sin az[uú]car/i)})]);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});


describe('Aclaraciones de listas — fuera de rango y otra selección activa',()=>{
 it.each(['Pizza Rustica','Ramen De Miso'].flatMap(base=>[false,true].flatMap(agent=>['rango','sabor','precio','precioDescripcion'].map(kind=>({base,agent,kind})))))('$base $kind agent=$agent',async({base,agent,kind})=>{
  const first={id:24201,code:4801,name:`${base} Solo`,price:22000,availableNow:true,hasAttributes:false,attributes:[],description:'Porción individual'};
  const second={id:24202,code:4802,name:`Combo ${base} Con Pollo`,price:29000,availableNow:true,hasAttributes:false,attributes:[],description:'Incluye pollo y bebida'};
  const drink={id:24203,code:4803,name:'Jugo Tropical',price:6500,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mango','Lulo']}]};
  const h=harness([first,second,drink] as typeof products,agent);h.service.ordersService.create=jest.fn();
  h.conv.sessionData.pendingMatch={query:base,candidates:[first,second],intent:'info'};
  if(kind==='sabor'){h.conv.state='awaiting_attribute';h.conv.sessionData.pendingAttribute={productId:drink.id,name:drink.name,code:drink.code,price:drink.price,attributes:drink.attributes,selected:[],quantity:3,sourceText:'3 Jugo Tropical'};}
  if(kind==='precio' || kind==='precioDescripcion'){h.conv.sessionData.cart=[{productId:first.id,name:first.name,code:first.code,unitPrice:first.price,quantity:1,attributes:[]},{productId:second.id,name:second.name,code:second.code,unitPrice:second.price,quantity:1,attributes:[]}];h.conv.sessionData.pendingPriceInquiry={productIds:[first.id,second.id],cartSignature:JSON.stringify(h.conv.sessionData.cart),state:h.conv.state};}
  const before=structuredClone(h.conv.sessionData);const state=h.conv.state;
  const reply=await h.sendQueued(kind==='precio'?'Precio 99':kind==='rango'?'¿Qué trae la opción 99?':'¿Qué trae la opción 2?');
  expect(h.conv.sessionData).toEqual(before);expect(h.conv.state).toBe(state);expect(reply||'').toMatch((kind==='sabor' || kind==='precioDescripcion')?/listas|opci[oó]n pendiente/i:/elige|entre 1 y/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});

describe('Sí, ese — después de describir la opción', () => {
  const synthetic = (base: string, id: number) => [
    { id, code: id - 25000 + 600, name: `${base} Solo`, price: 22000, availableNow: true, hasAttributes: false, attributes: [] as { attributeName: string; options: string[] }[], description: 'Porción individual' },
    { id: id + 1, code: id - 25000 + 601, name: `Combo ${base} Con Pollo`, price: 29000, availableNow: true, hasAttributes: false, attributes: [] as { attributeName: string; options: string[] }[], description: 'Incluye pollo y bebida' },
    { id: id + 2, code: id - 25000 + 602, name: `Combo ${base} Con Costillas`, price: 31000, availableNow: true, hasAttributes: false, attributes: [] as { attributeName: string; options: string[] }[], description: 'Incluye costillas y bebida' },
  ];
  const cases = [
    { kind: 'ppp', menu: products, text: 'que arroces maneja' },
    { kind: 'pizza', menu: synthetic('Pizza Rustica', 25001), text: 'tienen pizza rustica' },
    { kind: 'ramen', menu: synthetic('Ramen De Miso', 25011), text: 'tienen ramen de miso' },
    { kind: 'tacos', menu: synthetic('Taco Al Pastor', 25021), text: 'tienen taco al pastor' },
    { kind: 'burger', menu: synthetic('Hamburguesa De Lentejas', 25031), text: 'tienen hamburguesa de lentejas' },
    { kind: 'sushi', menu: synthetic('Roll De Salmon', 25041), text: 'tienen roll de salmon' },
    { kind: 'pasta', menu: synthetic('Pasta Al Pesto', 25051), text: 'tienen pasta al pesto' },
    { kind: 'bowl', menu: synthetic('Bowl De Quinoa', 25061), text: 'tienen bowl de quinoa' },
  ];
  const phrases = ['sí, ese', 'ese mismo', 'dale esa', 'sí', 'sí por favor'];

  it.each(cases.flatMap((item) => phrases.flatMap((phrase) => [false, true].map((agent) => ({ ...item, phrase, agent })))))(
    '$kind $phrase compra la opción descrita (agent $agent)',
    async ({ menu, text, phrase, agent }) => {
      const h = harness(menu as typeof products, agent);
      h.service.ordersService.create = jest.fn();
      await h.sendQueued(text);
      const candidates = h.conv.sessionData.pendingMatch?.candidates || [];
      expect(candidates.length).toBeGreaterThanOrEqual(2);
      const described = candidates[1];
      const info = await h.sendQueued('¿Qué trae la opción 2?');
      expect(info || '').toContain(described.name);
      expect(h.cartRows()).toEqual([]);
      expect(h.conv.sessionData.productFocus?.productId).toBe(described.id);
      await h.sendQueued(phrase);
      for (let step = 0; h.conv.sessionData.pendingAttribute && step < 3; step++) {
        const pending = h.conv.sessionData.pendingAttribute;
        expect(pending.productId).toBe(described.id);
        const remaining = h.service.catalogService.getRemainingAttributes(described, pending.selected);
        expect(remaining.length).toBeGreaterThan(0);
        await h.sendQueued(remaining[0].options[0]);
      }
      expect(h.cartRows()).toEqual([expect.objectContaining({ id: described.id, qty: 1 })]);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])('sin descripción no adivina el ese (agent %s)', async (agent) => {
    const menu = synthetic('Pizza Rustica', 25001);
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    await h.sendQueued('tienen pizza rustica');
    expect(h.conv.sessionData.pendingMatch?.candidates?.length).toBeGreaterThanOrEqual(2);
    await h.sendQueued('sí, ese');
    expect(h.cartRows()).toEqual([]);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each([false, true])('sí sin descripción no compra (agent %s)', async (agent) => {
    const menu = synthetic('Pizza Rustica', 25001);
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    await h.sendQueued('tienen pizza rustica');
    await h.sendQueued('sí');
    expect(h.cartRows()).toEqual([]);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each([false, true])('sí de la dirección no compra la opción descrita (agent %s)', async (agent) => {
    const menu = synthetic('Pizza Rustica', 25001);
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    await h.sendQueued('tienen pizza rustica');
    await h.sendQueued('¿Qué trae la opción 2?');
    h.conv.state = 'awaiting_address';
    h.conv.sessionData.address = 'Calle 10 20 30';
    h.conv.sessionData.addressConfirmed = false;
    await h.sendQueued('sí');
    expect(h.cartRows()).toEqual([]);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('Cierre de aclaración — nombre o nota elige la línea', () => {
  const line = (dish: { id: number; code: number; name: string; price: number }, quantity: number, note: string) => ({
    productId: dish.id, name: dish.name, code: dish.code, unitPrice: dish.price, quantity, attributes: [] as { attributeName: string; attributeValue: string }[], note,
  });
  const menus = () => {
    const arroz = products.find((item) => /^arroz paisa$/i.test(item.name));
    const side = products.find((item) => /limonada natural/i.test(item.name));
    const synthetic = (name: string, id: number) => ({
      dish: { id, code: id - 26000 + 700, name, price: 18000 },
      side: { id: id + 9, code: id - 26000 + 709, name: 'Agua Mineral', price: 3000 },
      menu: [
        { id, code: id - 26000 + 700, name, price: 18000, availableNow: true, hasAttributes: false, attributes: [], description: '' },
        { id: id + 9, code: id - 26000 + 709, name: 'Agua Mineral', price: 3000, availableNow: true, hasAttributes: false, attributes: [], description: '' },
      ],
    });
    return [
      { kind: 'ppp', dish: arroz!, side: side!, menu: products },
      { kind: 'pizza', ...synthetic('Pizza Rustica', 26001) },
      { kind: 'ramen', ...synthetic('Ramen De Miso', 26011) },
      { kind: 'tacos', ...synthetic('Taco Al Pastor', 26021) },
      { kind: 'burger', ...synthetic('Hamburguesa De Lentejas', 26031) },
      { kind: 'sushi', ...synthetic('Roll De Salmon', 26041) },
      { kind: 'pasta', ...synthetic('Pasta Al Pesto', 26051) },
      { kind: 'bowl', ...synthetic('Bowl De Quinoa', 26061) },
    ];
  };

  it.each(menus().flatMap((item) => ['la sin cilantro', 'con cilantro', 'la segunda'].flatMap((phrase) => [false, true].map((agent) => ({ ...item, phrase, agent })))))(
    '$kind $phrase deja dos solo en esa línea (agent $agent)',
    async ({ dish, side, menu, phrase, agent }) => {
      const h = harness(menu as typeof products, agent);
      h.service.ordersService.create = jest.fn();
      h.conv.sessionData.cart = [line(dish, 4, 'sin cilantro'), line(dish, 3, 'con cilantro'), line(side, 1, '')];
      await h.sendQueued(`Deja solo dos ${dish.name}`);
      expect(h.conv.sessionData.pendingCartQuantity?.options).toHaveLength(2);
      await h.sendQueued(phrase);
      const sinQty = phrase === 'la sin cilantro' ? 2 : 4;
      const conQty = phrase === 'la sin cilantro' ? 3 : 2;
      expect(h.cartRows()).toEqual([
        expect.objectContaining({ id: dish.id, qty: sinQty, note: 'sin cilantro' }),
        expect.objectContaining({ id: dish.id, qty: conQty, note: 'con cilantro' }),
        expect.objectContaining({ id: side.id, qty: 1 }),
      ]);
      expect(h.conv.sessionData.pendingCartQuantity).toBeUndefined();
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    },
  );

  it.each(menus().flatMap((item) => ['sin cilantro', 'sin cebolla'].flatMap((phrase) => [false, true].map((agent) => ({ ...item, phrase, agent })))))(
    '$kind $phrase no elige si la nota no es única (agent $agent)',
    async ({ dish, side, menu, phrase, agent }) => {
      const h = harness(menu as typeof products, agent);
      h.service.ordersService.create = jest.fn();
      h.conv.sessionData.cart = [line(dish, 4, 'sin cilantro'), line(dish, 3, 'sin cilantro'), line(side, 1, '')];
      await h.sendQueued(`Deja solo dos ${dish.name}`);
      const before = structuredClone(h.conv.sessionData.cart);
      expect(h.conv.sessionData.pendingCartQuantity?.options).toHaveLength(2);
      const reply = await h.sendQueued(phrase);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.pendingCartQuantity?.options).toHaveLength(2);
      expect(reply || '').toMatch(/n[uú]mero|a cu[aá]l plato|sigue igual/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    },
  );

  it.each(menus().flatMap((item) => [false, true].map((agent) => ({ ...item, agent }))))(
    '$kind quita solo la línea nombrada por la nota (agent $agent)',
    async ({ dish, side, menu, agent }) => {
      const h = harness(menu as typeof products, agent);
      h.service.ordersService.create = jest.fn();
      h.conv.sessionData.cart = [line(dish, 4, 'sin cilantro'), line(dish, 3, 'con cilantro'), line(side, 1, '')];
      await h.sendQueued(`Quita la ${dish.name}`);
      expect(h.conv.sessionData.pendingCartRemoval?.options).toHaveLength(2);
      await h.sendQueued('la con cilantro');
      expect(h.cartRows()).toEqual([
        expect.objectContaining({ id: dish.id, qty: 4, note: 'sin cilantro' }),
        expect.objectContaining({ id: side.id, qty: 1 }),
      ]);
      expect(h.conv.sessionData.pendingCartRemoval).toBeUndefined();
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    },
  );
});

describe('Multiórden — varias elecciones en un turno', () => {
  const families = [
    { kind: 'pizza', a: 'Pizza Vegetal', b: 'Pizza De Queso', c: 'Pasta De Setas', d: 'Pasta De Espinaca' },
    { kind: 'ramen', a: 'Ramen Vegetal', b: 'Ramen De Miso', c: 'Gyoza De Setas', d: 'Gyoza De Cerdo' },
    { kind: 'tacos', a: 'Taco Vegetal', b: 'Taco Al Pastor', c: 'Quesadilla De Setas', d: 'Quesadilla De Pollo' },
    { kind: 'burger', a: 'Hamburguesa Vegetal', b: 'Hamburguesa De Lentejas', c: 'Papas De Setas', d: 'Papas De Queso' },
    { kind: 'sushi', a: 'Roll Vegetal', b: 'Roll De Salmon', c: 'Nigiri De Setas', d: 'Nigiri De Atun' },
    { kind: 'pasta', a: 'Pasta Vegetal', b: 'Pasta Al Pesto', c: 'Lasana De Setas', d: 'Lasana De Carne' },
    { kind: 'bowl', a: 'Bowl Vegetal', b: 'Bowl De Quinoa', c: 'Wrap De Setas', d: 'Wrap De Pollo' },
  ];
  const menuOf = (family: typeof families[number]) => [family.a, family.b, family.c, family.d].map((name, index) => ({
    id: 27001 + families.indexOf(family) * 10 + index,
    code: 800 + families.indexOf(family) * 10 + index,
    name, price: 18000 + index * 1000, availableNow: true, hasAttributes: false, attributes: [] as { attributeName: string; options: string[] }[],
  }));

  it.each(families.flatMap((family) => ['numeros', 'nombres'].flatMap((kind) => [false, true].map((agent) => ({ family, kind, agent })))))(
    '$family.kind $kind cierra las dos listas (agent $agent)',
    async ({ family, kind, agent }) => {
      const menu = menuOf(family);
      const h = harness(menu as typeof products, agent);
      h.service.ordersService.create = jest.fn();
      h.conv.sessionData.pendingMultiOrder = {
        confident: [], needsAttributes: [], unresolved: ['zapato comestible'],
        ambiguous: [
          { segment: `Dos ${family.a.split(' ')[0]}`, candidates: menu.slice(0, 2) },
          { segment: 'Tres acompanantes', candidates: menu.slice(2) },
        ],
      };
      await h.sendQueued(kind === 'numeros' ? '1 y 2' : `${menu[0].name} y ${menu[3].name}`);
      expect(h.cartRows()).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: menu[0].id, qty: 2 }),
        expect.objectContaining({ id: menu[3].id, qty: 3 }),
      ]));
      expect(h.cartRows()).toHaveLength(2);
      expect(h.conv.sessionData.pendingMultiOrder?.ambiguous?.length || 0).toBe(0);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])('ppp elige las dos listas por nombre (agent %s)', async (agent) => {
    const broaster = products.filter((item) => /broaster/i.test(item.name)).slice(0, 2);
    const frito = products.filter((item) => /frito/i.test(item.name) && !/broaster/i.test(item.name)).slice(0, 2);
    expect(broaster).toHaveLength(2);
    expect(frito).toHaveLength(2);
    const h = harness(products, agent);
    h.service.ordersService.create = jest.fn();
    h.conv.sessionData.pendingMultiOrder = {
      confident: [], needsAttributes: [], unresolved: ['zapato comestible'],
      ambiguous: [
        { segment: 'Dos pollos', candidates: broaster },
        { segment: 'Tres pollos', candidates: frito },
      ],
    };
    await h.sendQueued(`${broaster[0].name} y ${frito[1].name}`);
    expect(h.cartRows()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: broaster[0].id, qty: 2 }),
      expect.objectContaining({ id: frito[1].id, qty: 3 }),
    ]));
    expect(h.cartRows()).toHaveLength(2);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each(families.slice(0, 4).flatMap((family) => ['Mango y Durazno', 'jugos'].flatMap((phrase) => [false, true].map((agent) => ({ family, phrase, agent })))))(
    '$family.kind $phrase reparte el sabor (agent $agent)',
    async ({ family, phrase, agent }) => {
      const bowl = { id: 27101 + families.indexOf(family), code: 900 + families.indexOf(family), name: family.a, price: 16000, availableNow: true, hasAttributes: false, attributes: [] as { attributeName: string; options: string[] }[] };
      const juice = { id: bowl.id + 1, code: bowl.code + 1, name: 'Jugo Natural', price: 8000, availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Sabor', options: ['Mango', 'Lulo'] }] };
      const soda = { id: bowl.id + 2, code: bowl.code + 2, name: 'Gaseosa Artesanal', price: 7000, availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Sabor', options: ['Mora', 'Durazno'] }] };
      const h = harness([bowl, juice, soda] as typeof products, agent);
      h.service.ordersService.create = jest.fn();
      await h.sendQueued(`Quiero dos ${bowl.name}, tres ${juice.name} y dos ${soda.name}`);
      expect(h.cartRows()).toEqual([expect.objectContaining({ id: bowl.id, qty: 2 })]);
      expect(h.conv.sessionData.pendingAttribute?.productId).toBe(juice.id);
      const answer = phrase === 'jugos' ? `el ${juice.name} Mango y la ${soda.name} Durazno` : phrase;
      await h.sendQueued(answer);
      expect(h.cartRows()).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: bowl.id, qty: 2 }),
        expect.objectContaining({ id: juice.id, qty: 3, attrs: ['Sabor:Mango'] }),
        expect.objectContaining({ id: soda.id, qty: 2, attrs: ['Sabor:Durazno'] }),
      ]));
      expect(h.cartRows()).toHaveLength(3);
      expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    },
  );
});

describe('Paráfrasis de lista — qué trae y cuánto vale', () => {
  const synthetic = (base: string, id: number) => [
    { id, code: id - 28000 + 810, name: `${base} Solo`, price: 22000, availableNow: true, hasAttributes: false, attributes: [] as { attributeName: string; options: string[] }[], description: 'Porción individual' },
    { id: id + 1, code: id - 28000 + 811, name: `Combo ${base} Con Pollo`, price: 29000, availableNow: true, hasAttributes: false, attributes: [] as { attributeName: string; options: string[] }[], description: 'Incluye pollo y bebida' },
    { id: id + 2, code: id - 28000 + 812, name: `Combo ${base} Con Costillas`, price: 31000, availableNow: true, hasAttributes: false, attributes: [] as { attributeName: string; options: string[] }[], description: 'Incluye costillas y bebida' },
  ];
  const lists = [
    { kind: 'ppp', menu: products, text: 'que arroces maneja' },
    { kind: 'pizza', menu: synthetic('Pizza Rustica', 28001), text: 'tienen pizza rustica' },
    { kind: 'ramen', menu: synthetic('Ramen De Miso', 28011), text: 'tienen ramen de miso' },
    { kind: 'tacos', menu: synthetic('Taco Al Pastor', 28021), text: 'tienen taco al pastor' },
    { kind: 'burger', menu: synthetic('Hamburguesa De Lentejas', 28031), text: 'tienen hamburguesa de lentejas' },
    { kind: 'sushi', menu: synthetic('Roll De Salmon', 28041), text: 'tienen roll de salmon' },
    { kind: 'pasta', menu: synthetic('Pasta Al Pesto', 28051), text: 'tienen pasta al pesto' },
    { kind: 'bowl', menu: synthetic('Bowl De Quinoa', 28061), text: 'tienen bowl de quinoa' },
  ];
  const questions = ['¿Qué trae la 2?', '¿Qué incluye el 2?', '¿Cómo es 2?'];

  it.each(lists.flatMap((item) => questions.flatMap((question) => [false, true].map((agent) => ({ ...item, question, agent })))))(
    '$kind $question describe sin comprar (agent $agent)',
    async ({ menu, text, question, agent }) => {
      const h = harness(menu as typeof products, agent);
      h.service.ordersService.create = jest.fn();
      await h.sendQueued(text);
      const options = structuredClone(h.conv.sessionData.pendingMatch);
      const chosen = options!.candidates[1];
      const reply = await h.sendQueued(question);
      expect(reply || '').toContain(chosen.name);
      expect(reply || '').toContain(chosen.description!);
      expect(h.cartRows()).toEqual([]);
      expect(h.conv.sessionData.pendingMatch).toEqual(options);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    },
  );

  it.each(['Cuánto vale el segundo', 'Cuánto cuesta la 2', 'A cómo está la segunda'].flatMap((phrase) => [false, true].map((agent) => ({ phrase, agent }))))(
    'ppp $phrase conserva el sabor pendiente (agent $agent)',
    async ({ phrase, agent }) => {
      const dish = products.find((item) => /^arroz paisa$/i.test(item.name))!;
      const side = products.find((item) => /limonada natural/i.test(item.name))!;
      const drink = products.find((item) => /jugo natural en agua/i.test(item.name))!;
      const h = harness(products, agent);
      h.service.ordersService.create = jest.fn();
      h.conv.state = 'awaiting_attribute';
      h.conv.sessionData.cart = [
        { productId: dish.id, name: dish.name, code: dish.code, unitPrice: dish.price, quantity: 4, attributes: [], note: 'sin cilantro' },
        { productId: side.id, name: side.name, code: side.code, unitPrice: side.price, quantity: 1, attributes: [] },
      ];
      h.conv.sessionData.pendingAttribute = {
        productId: drink.id, name: drink.name, code: drink.code, price: drink.price,
        attributes: drink.attributes, selected: [], quantity: 3, sourceText: `3 ${drink.name} sin azúcar`,
      };
      h.conv.sessionData.pendingPriceInquiry = {
        productIds: [dish.id, side.id], cartSignature: JSON.stringify(h.conv.sessionData.cart), state: h.conv.state,
      };
      const before = structuredClone(h.conv.sessionData);
      const reply = await h.sendQueued(phrase);
      expect(reply || '').toContain(side.name);
      expect(reply || '').toContain(h.service.catalogService.formatMoney(side.price));
      expect(h.conv.sessionData.cart).toEqual(before.cart);
      expect(h.conv.sessionData.pendingAttribute).toEqual(before.pendingAttribute);
      expect(h.conv.sessionData.pendingPriceInquiry).toBeUndefined();
      const flavor = drink.attributes[0].options[1];
      await h.sendQueued(flavor);
      expect(h.cartRows()).toEqual([
        expect.objectContaining({ id: dish.id, qty: 4 }),
        expect.objectContaining({ id: side.id, qty: 1 }),
        expect.objectContaining({ id: drink.id, qty: 3, attrs: [`${drink.attributes[0].attributeName}:${flavor}`] }),
      ]);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    },
  );

  it.each(['Pizza Rustica', 'Ramen De Miso', 'Taco Al Pastor'].flatMap((name) => [false, true].map((agent) => ({ name, agent }))))(
    '$name cuánto vale el 99 no cambia el pedido (agent $agent)',
    async ({ name, agent }) => {
      const dish = { id: 28101, code: 9101, name, price: 10500, availableNow: true, hasAttributes: false, attributes: [] as { attributeName: string; options: string[] }[] };
      const water = { id: 28102, code: 9102, name: 'Agua Mineral', price: 3000, availableNow: true, hasAttributes: false, attributes: [] as { attributeName: string; options: string[] }[] };
      const drink = { id: 28103, code: 9103, name: 'Jugo Tropical', price: 6500, availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Sabor', options: ['Mango', 'Lulo'] }] };
      const h = harness([dish, water, drink] as typeof products, agent);
      h.service.ordersService.create = jest.fn();
      h.conv.state = 'awaiting_attribute';
      h.conv.sessionData.cart = [
        { productId: dish.id, name, code: dish.code, unitPrice: dish.price, quantity: 1, attributes: [] },
        { productId: water.id, name: water.name, code: water.code, unitPrice: water.price, quantity: 1, attributes: [] },
      ];
      h.conv.sessionData.pendingAttribute = {
        productId: drink.id, name: drink.name, code: drink.code, price: drink.price,
        attributes: drink.attributes, selected: [], quantity: 3, sourceText: '3 Jugo Tropical',
      };
      h.conv.sessionData.pendingPriceInquiry = {
        productIds: [dish.id, water.id], cartSignature: JSON.stringify(h.conv.sessionData.cart), state: h.conv.state,
      };
      const before = structuredClone(h.conv.sessionData);
      const reply = await h.sendQueued('Cuánto vale el 99');
      expect(h.conv.sessionData).toEqual(before);
      expect(reply || '').toMatch(/n[uú]mero|elige/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    },
  );
});

describe('Reparto — varios atributos en cada parte', () => {
  const families = [
    { kind: 'pizza', name: 'Pizza Campestre', a: 'Masa', a1: 'Delgada', a2: 'Gruesa', b: 'Queso', b1: 'Mozzarella', b2: 'Vegano' },
    { kind: 'ramen', name: 'Ramen De La Casa', a: 'Caldo', a1: 'Miso', a2: 'Shoyu', b: 'Proteina', b1: 'Cerdo', b2: 'Tofu' },
    { kind: 'tacos', name: 'Taco De La Casa', a: 'Tortilla', a1: 'Maiz', a2: 'Harina', b: 'Proteina', b1: 'Pastor', b2: 'Setas' },
    { kind: 'burger', name: 'Hamburguesa De La Casa', a: 'Pan', a1: 'Brioche', a2: 'Integral', b: 'Proteina', b1: 'Res', b2: 'Lentejas' },
    { kind: 'sushi', name: 'Roll De La Casa', a: 'Base', a1: 'Arroz', a2: 'Quinoa', b: 'Proteina', b1: 'Salmon', b2: 'Tofu' },
    { kind: 'pasta', name: 'Pasta De La Casa', a: 'Pasta', a1: 'Spaghetti', a2: 'Penne', b: 'Salsa', b1: 'Pesto', b2: 'Bolognesa' },
    { kind: 'bowl', name: 'Bowl De La Casa', a: 'Base', a1: 'Arroz', a2: 'Quinoa', b: 'Proteina', b1: 'Pollo', b2: 'Tofu' },
  ];
  it.each(families.flatMap((family) => [false, true].map((agent) => ({ family, agent }))))(
    '$family.kind reparte los dos atributos (agent $agent)',
    async ({ family, agent }) => {
      const dish = {
        id: 29001 + families.indexOf(family), code: 1000 + families.indexOf(family), name: family.name, price: 22000,
        availableNow: true, hasAttributes: true,
        attributes: [
          { attributeName: family.a, options: [family.a1, family.a2] },
          { attributeName: family.b, options: [family.b1, family.b2] },
        ],
      };
      const h = harness([dish] as typeof products, agent);
      h.service.ordersService.create = jest.fn();
      h.conv.sessionData.cart = [{
        productId: dish.id, name: dish.name, code: dish.code, unitPrice: dish.price, quantity: 2,
        attributes: [
          { attributeName: family.a, attributeValue: family.a1 },
          { attributeName: family.b, attributeValue: family.b1 },
        ],
        note: 'sin cebolla',
      }];
      await h.sendQueued(`Los quiero 1 con ${family.a2} y ${family.b2} y 1 con ${family.a1} y ${family.b1}`);
      expect(h.cartRows()).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: dish.id, qty: 1, attrs: expect.arrayContaining([`${family.a}:${family.a2}`, `${family.b}:${family.b2}`]), note: expect.stringMatching(/sin cebolla/i) }),
        expect.objectContaining({ id: dish.id, qty: 1, attrs: expect.arrayContaining([`${family.a}:${family.a1}`, `${family.b}:${family.b1}`]), note: expect.stringMatching(/sin cebolla/i) }),
      ]));
      expect(h.cartRows()).toHaveLength(2);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])('ppp reparte presa y sopa (agent %s)', async (agent) => {
    const dish = products.find((item) => /ejecutivo con pollo frito/i.test(item.name))!;
    const presa = dish.attributes.find((attr) => /presa/i.test(attr.attributeName))!;
    const sopa = dish.attributes.find((attr) => /sopa/i.test(attr.attributeName))!;
    const leftPresa = presa.options.find((option) => /pechuga/i.test(option))!;
    const rightPresa = presa.options.find((option) => /pierna/i.test(option))!;
    const leftSopa = sopa.options.find((option) => /mondongo/i.test(option))!;
    const rightSopa = sopa.options.find((option) => /ajiaco/i.test(option))!;
    const h = harness(products, agent);
    h.service.ordersService.create = jest.fn();
    h.conv.sessionData.cart = [{
      productId: dish.id, name: dish.name, code: dish.code, unitPrice: dish.price, quantity: 2,
      attributes: dish.attributes.map((attr) => ({ attributeName: attr.attributeName, attributeValue: attr.options[0] })),
      note: 'sin cebolla',
    }];
    await h.sendQueued(`Los quiero 1 con ${leftPresa} y ${leftSopa} y 1 con ${rightPresa} y ${rightSopa}`);
    expect(h.cartRows()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: dish.id, qty: 1, attrs: expect.arrayContaining([`${presa.attributeName}:${leftPresa}`, `${sopa.attributeName}:${leftSopa}`]) }),
      expect.objectContaining({ id: dish.id, qty: 1, attrs: expect.arrayContaining([`${presa.attributeName}:${rightPresa}`, `${sopa.attributeName}:${rightSopa}`]) }),
    ]));
    expect(h.cartRows()).toHaveLength(2);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('Cambio de opción — la nota elige la línea', () => {
  const families = [
    { kind: 'pizza', name: 'Pizza Campestre', attr: 'Masa', from: 'Delgada', to: 'Gruesa' },
    { kind: 'ramen', name: 'Ramen De La Casa', attr: 'Caldo', from: 'Miso', to: 'Shoyu' },
    { kind: 'tacos', name: 'Taco De La Casa', attr: 'Tortilla', from: 'Maiz', to: 'Harina' },
    { kind: 'burger', name: 'Hamburguesa De La Casa', attr: 'Pan', from: 'Brioche', to: 'Integral' },
    { kind: 'sushi', name: 'Roll De La Casa', attr: 'Base', from: 'Arroz', to: 'Quinoa' },
    { kind: 'pasta', name: 'Pasta De La Casa', attr: 'Pasta', from: 'Spaghetti', to: 'Penne' },
    { kind: 'bowl', name: 'Bowl De La Casa', attr: 'Base', from: 'Arroz', to: 'Quinoa' },
  ];

  it.each(families.flatMap((family) => [false, true].map((agent) => ({ family, agent }))))(
    '$family.kind la nota elige cuál cambia (agent $agent)',
    async ({ family, agent }) => {
      const dish = {
        id: 29101 + families.indexOf(family), code: 1100 + families.indexOf(family), name: family.name, price: 22000,
        availableNow: true, hasAttributes: true, attributes: [{ attributeName: family.attr, options: [family.from, family.to] }],
      };
      const h = harness([dish] as typeof products, agent);
      h.service.ordersService.create = jest.fn();
      h.conv.sessionData.cart = [
        { productId: dish.id, name: dish.name, code: dish.code, unitPrice: dish.price, quantity: 1, attributes: [{ attributeName: family.attr, attributeValue: family.from }], note: 'sin cilantro' },
        { productId: dish.id, name: dish.name, code: dish.code, unitPrice: dish.price, quantity: 1, attributes: [{ attributeName: family.attr, attributeValue: family.from }], note: 'con cilantro' },
      ];
      const asked = await h.sendQueued(`cambia ${family.attr} a ${family.to}`);
      expect(asked || '').toMatch(/cu[aá]l plato/i);
      expect(h.conv.sessionData.pendingCartAttributeEdit?.candidates).toHaveLength(2);
      await h.sendQueued('la sin cilantro');
      expect(h.cartRows()).toEqual([
        expect.objectContaining({ id: dish.id, qty: 1, attrs: [`${family.attr}:${family.to}`], note: 'sin cilantro' }),
        expect.objectContaining({ id: dish.id, qty: 1, attrs: [`${family.attr}:${family.from}`], note: 'con cilantro' }),
      ]);
      expect(h.conv.sessionData.pendingCartAttributeEdit).toBeUndefined();
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])('ppp la nota elige el ejecutivo (agent %s)', async (agent) => {
    const dish = products.find((item) => /ejecutivo con pollo frito/i.test(item.name))!;
    const drink = dish.attributes.find((attr) => /bebida/i.test(attr.attributeName))!;
    const from = drink.options[0];
    const to = drink.options.find((option) => /pepsi/i.test(option)) || drink.options[1];
    const h = harness(products, agent);
    h.service.ordersService.create = jest.fn();
    const baseAttrs = dish.attributes.map((attr) => ({ attributeName: attr.attributeName, attributeValue: attr.options[0] }));
    h.conv.sessionData.cart = [0, 1].map(() => ({
      productId: dish.id, name: dish.name, code: dish.code, unitPrice: dish.price, quantity: 1,
      attributes: baseAttrs.map((attr) => ({ ...attr })), note: '',
    }));
    h.conv.sessionData.cart[0].note = 'sin cilantro';
    h.conv.sessionData.cart[1].note = 'con cilantro';
    await h.sendQueued(`cambia la bebida a ${to}`);
    expect(h.conv.sessionData.pendingCartAttributeEdit?.candidates).toHaveLength(2);
    await h.sendQueued('la sin cilantro');
    const rows = h.cartRows();
    expect(rows.find((row) => row.note === 'sin cilantro')?.attrs).toContain(`${drink.attributeName}:${to}`);
    expect(rows.find((row) => row.note === 'con cilantro')?.attrs).toContain(`${drink.attributeName}:${from}`);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('Nota libre — cierra la aclaración sin con/sin', () => {
  const families = [
    { kind: 'pizza', name: 'Pizza Campestre' },
    { kind: 'ramen', name: 'Ramen De La Casa' },
    { kind: 'tacos', name: 'Taco De La Casa' },
    { kind: 'burger', name: 'Hamburguesa De La Casa' },
    { kind: 'sushi', name: 'Roll De La Casa' },
    { kind: 'pasta', name: 'Pasta De La Casa' },
    { kind: 'bowl', name: 'Bowl De La Casa' },
  ];

  it.each(families.flatMap((family) => [false, true].map((agent) => ({ family, agent }))))(
    '$family.kind la picante deja dos (agent $agent)',
    async ({ family, agent }) => {
      const dish = { id: 29201 + families.indexOf(family), code: 1200 + families.indexOf(family), name: family.name, price: 18000, availableNow: true, hasAttributes: false, attributes: [] as { attributeName: string; options: string[] }[] };
      const side = { id: dish.id + 50, code: dish.code + 50, name: 'Agua Mineral', price: 3000, availableNow: true, hasAttributes: false, attributes: [] as { attributeName: string; options: string[] }[] };
      const h = harness([dish, side] as typeof products, agent);
      h.service.ordersService.create = jest.fn();
      h.conv.sessionData.cart = [
        { productId: dish.id, name: dish.name, code: dish.code, unitPrice: dish.price, quantity: 4, attributes: [], note: 'picante' },
        { productId: dish.id, name: dish.name, code: dish.code, unitPrice: dish.price, quantity: 3, attributes: [], note: 'suave' },
        { productId: side.id, name: side.name, code: side.code, unitPrice: side.price, quantity: 1, attributes: [], note: '' },
      ];
      await h.sendQueued(`Deja solo dos ${dish.name}`);
      expect(h.conv.sessionData.pendingCartQuantity?.options).toHaveLength(2);
      await h.sendQueued('la picante');
      expect(h.cartRows()).toEqual([
        expect.objectContaining({ id: dish.id, qty: 2, note: 'picante' }),
        expect.objectContaining({ id: dish.id, qty: 3, note: 'suave' }),
        expect.objectContaining({ id: side.id, qty: 1 }),
      ]);
      expect(h.conv.sessionData.pendingCartQuantity).toBeUndefined();
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])('ppp la picante deja dos arroces (agent %s)', async (agent) => {
    const dish = products.find((item) => /^arroz paisa$/i.test(item.name))!;
    const side = products.find((item) => /limonada natural/i.test(item.name))!;
    const h = harness(products, agent);
    h.service.ordersService.create = jest.fn();
    h.conv.sessionData.cart = [
      { productId: dish.id, name: dish.name, code: dish.code, unitPrice: dish.price, quantity: 4, attributes: [], note: 'picante' },
      { productId: dish.id, name: dish.name, code: dish.code, unitPrice: dish.price, quantity: 3, attributes: [], note: 'suave' },
      { productId: side.id, name: side.name, code: side.code, unitPrice: side.price, quantity: 1, attributes: [], note: '' },
    ];
    await h.sendQueued(`Deja solo dos ${dish.name}`);
    await h.sendQueued('la picante');
    expect(h.cartRows()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: dish.id, qty: 2, note: 'picante' }),
      expect.objectContaining({ id: dish.id, qty: 3, note: 'suave' }),
      expect.objectContaining({ id: side.id, qty: 1 }),
    ]));
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each([false, true])('dos notas iguales no eligen (agent %s)', async (agent) => {
    const dish = { id: 29301, code: 1301, name: 'Pizza Campestre', price: 18000, availableNow: true, hasAttributes: false, attributes: [] as { attributeName: string; options: string[] }[] };
    const h = harness([dish] as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    h.conv.sessionData.cart = [4, 3].map((quantity) => ({
      productId: dish.id, name: dish.name, code: dish.code, unitPrice: dish.price, quantity, attributes: [], note: 'picante',
    }));
    await h.sendQueued(`Deja solo dos ${dish.name}`);
    const before = structuredClone(h.conv.sessionData.cart);
    const reply = await h.sendQueued('la picante');
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.conv.sessionData.pendingCartQuantity?.options).toHaveLength(2);
    expect(reply || '').toMatch(/n[uú]mero|una sola/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('Reparto en tres partes', () => {
  const families = [
    { kind: 'pizza', name: 'Pizza Campestre', a: 'Masa', options: ['Delgada', 'Gruesa', 'Integral'], b: 'Queso', choices: ['Mozzarella', 'Vegano', 'Azul'] },
    { kind: 'ramen', name: 'Ramen De La Casa', a: 'Caldo', options: ['Miso', 'Shoyu', 'Tonkotsu'], b: 'Proteina', choices: ['Cerdo', 'Tofu', 'Pollo'] },
    { kind: 'bowl', name: 'Bowl De La Casa', a: 'Base', options: ['Arroz', 'Quinoa', 'Fideos'], b: 'Proteina', choices: ['Pollo', 'Tofu', 'Res'] },
  ];

  it.each(families.flatMap((family) => [false, true].map((agent) => ({ family, agent }))))(
    '$family.kind reparte tres combinaciones (agent $agent)',
    async ({ family, agent }) => {
      const dish = {
        id: 29401 + families.indexOf(family), code: 1400 + families.indexOf(family), name: family.name, price: 22000,
        availableNow: true, hasAttributes: true,
        attributes: [
          { attributeName: family.a, options: family.options },
          { attributeName: family.b, options: family.choices },
        ],
      };
      const h = harness([dish] as typeof products, agent);
      h.service.ordersService.create = jest.fn();
      h.conv.sessionData.cart = [{
        productId: dish.id, name: dish.name, code: dish.code, unitPrice: dish.price, quantity: 3,
        attributes: [
          { attributeName: family.a, attributeValue: family.options[0] },
          { attributeName: family.b, attributeValue: family.choices[0] },
        ],
        note: 'sin cebolla',
      }];
      await h.sendQueued(`Los quiero 1 con ${family.options[1]} y ${family.choices[1]} y 1 con ${family.options[2]} y ${family.choices[2]} y 1 con ${family.options[0]} y ${family.choices[0]}`);
      expect(h.cartRows()).toEqual(expect.arrayContaining([
        expect.objectContaining({ qty: 1, attrs: expect.arrayContaining([`${family.a}:${family.options[1]}`, `${family.b}:${family.choices[1]}`]) }),
        expect.objectContaining({ qty: 1, attrs: expect.arrayContaining([`${family.a}:${family.options[2]}`, `${family.b}:${family.choices[2]}`]) }),
        expect.objectContaining({ qty: 1, attrs: expect.arrayContaining([`${family.a}:${family.options[0]}`, `${family.b}:${family.choices[0]}`]) }),
      ]));
      expect(h.cartRows()).toHaveLength(3);
      expect(h.cartRows().every((row) => /sin cebolla/i.test(row.note || ''))).toBe(true);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])('ppp reparte tres ejecutivos (agent %s)', async (agent) => {
    const dish = products.find((item) => /ejecutivo con pollo frito/i.test(item.name))!;
    const presa = dish.attributes.find((attr) => /presa/i.test(attr.attributeName))!;
    const sopa = dish.attributes.find((attr) => /sopa/i.test(attr.attributeName))!;
    const pairs = [
      { presa: presa.options[0], sopa: sopa.options[0] },
      { presa: presa.options[1], sopa: sopa.options[2] },
      { presa: presa.options[0], sopa: sopa.options[1] },
    ];
    const h = harness(products, agent);
    h.service.ordersService.create = jest.fn();
    h.conv.sessionData.cart = [{
      productId: dish.id, name: dish.name, code: dish.code, unitPrice: dish.price, quantity: 3,
      attributes: dish.attributes.map((attr) => ({ attributeName: attr.attributeName, attributeValue: attr.options[0] })),
      note: 'sin cebolla',
    }];
    await h.sendQueued(`Los quiero 1 con ${pairs[1].presa} y ${pairs[1].sopa} y 1 con ${pairs[2].presa} y ${pairs[2].sopa} y 1 con ${pairs[0].presa} y ${pairs[0].sopa}`);
    for (const pair of pairs) {
      expect(h.cartRows()).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: dish.id, qty: 1, attrs: expect.arrayContaining([`${presa.attributeName}:${pair.presa}`, `${sopa.attributeName}:${pair.sopa}`]) }),
      ]));
    }
    expect(h.cartRows()).toHaveLength(3);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('Somos tres no es un plato', () => {
  const place = (id: number, name: string, price: number) => ({
    id, code: id, name, price, availableNow: true, hasAttributes: false, attributes: [] as { attributeName: string; options: string[] }[],
  });
  const drinkOf = (menu: typeof products, name: RegExp) => menu.find((item) => name.test(item.name))!;
  const packOf = (menu: typeof products, name: RegExp) => menu.find((item) => name.test(item.name))!;

  it.each([false, true])('ppp: somos tres no pide el paquete de hamburguesas (agent %s)', async (agent) => {
    const pack = packOf(products, /tres\s+hamburguesas/i);
    const h = harness(products, agent);
    h.service.ordersService.create = jest.fn();
    await h.sendQueued('Somos tres');
    expect(h.cartRows().some((row) => row.id === pack.id)).toBe(false);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each([false, true])('ppp: somos tres y la bebida no arrastra el paquete (agent %s)', async (agent) => {
    const drink = drinkOf(products, /^limonada natural$/i);
    const pack = packOf(products, /tres\s+hamburguesas/i);
    const h = harness(products, agent);
    h.service.ordersService.create = jest.fn();
    if (agent) {
      h.agent.runTurn.mockResolvedValue({
        reply: 'Listo.',
        actions: { addItems: [{ productId: drink.id, quantity: 1 }] },
        toolCalls: ['add_item'],
      });
    }
    const reply = await h.sendQueued('Somos tres y cada uno quiere una Limonada Natural');
    expect(h.cartRows().some((row) => row.id === pack.id)).toBe(false);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    if (agent) {
      expect(h.cartRows()).toEqual([expect.objectContaining({ id: drink.id, qty: 3 })]);
    } else {
      expect(h.cartRows()).toEqual([]);
      expect(reply || '').toMatch(/cuántas|cuantas|cuál|cual/i);
    }
  });

  it('ppp: tres hamburguesas clasicas sigue siendo el paquete', async () => {
    const pack = packOf(products, /tres\s+hamburguesas/i);
    const h = harness(products, false);
    h.service.ordersService.create = jest.fn();
    await h.sendQueued('Quiero tres hamburguesas clasicas');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: pack.id, qty: 1 })]);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  const fictional = [
    { kind: 'tacos', pack: place(19101, 'Tres Empanadas De Queso', 18000), drink: place(19102, 'Agua De Coco', 5000), diners: 'Somos tres y cada uno quiere un Agua De Coco', order: 'Quiero tres empanadas de queso', qty: 3 },
    { kind: 'sushi', pack: place(19111, 'Cuatro Rolls De Atun', 32000), drink: place(19112, 'Te Matcha', 5000), diners: 'Somos cuatro y cada uno quiere un Te Matcha', order: 'Quiero cuatro rolls de atun', qty: 4 },
    { kind: 'ramen', pack: place(19121, 'Dos Caldos De Miso', 22000), drink: place(19122, 'Te Verde', 4000), diners: 'Somos dos y cada uno quiere un Te Verde', order: 'Quiero dos caldos de miso', qty: 2 },
    { kind: 'pizza', pack: place(19131, 'Tres Pizzas Rusticas', 36000), drink: place(19132, 'Gaseosa Artesanal', 5000), diners: 'Somos tres y cada uno quiere una Gaseosa Artesanal', order: 'Quiero tres pizzas rusticas', qty: 3 },
    { kind: 'burger', pack: place(19141, 'Tres Hamburguesas De Lentejas', 30000), drink: place(19142, 'Malteada De Chocolate', 7000), diners: 'Somos tres y cada uno quiere una Malteada De Chocolate', order: 'Quiero tres hamburguesas de lentejas', qty: 3 },
    { kind: 'pasta', pack: place(19151, 'Tres Pastas Al Pesto', 28000), drink: place(19152, 'Limonada Natural', 4500), diners: 'Somos tres y cada uno quiere una Limonada Natural', order: 'Quiero tres pastas al pesto', qty: 3 },
    { kind: 'bowl', pack: place(19161, 'Tres Bowls De Quinoa', 27000), drink: place(19162, 'Agua Mineral', 3000), diners: 'Somos tres y cada uno quiere un Agua Mineral', order: 'Quiero tres bowls de quinoa', qty: 3 },
  ];

  it.each(fictional.flatMap((item) => [false, true].map((agent) => ({ ...item, agent }))))(
    '$kind: el conteo no pide el pack (agent $agent)',
    async ({ pack, drink, diners, qty, agent }) => {
      const menu = [pack, drink];
      const h = harness(menu as typeof products, agent);
      h.service.ordersService.create = jest.fn();
      if (agent) {
        h.agent.runTurn.mockResolvedValue({
          reply: 'Listo.',
          actions: { addItems: [{ productId: drink.id, quantity: 1 }] },
          toolCalls: ['add_item'],
        });
      }
      const reply = await h.sendQueued(diners);
      expect(h.cartRows().some((row) => row.id === pack.id)).toBe(false);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      if (agent) {
        expect(h.cartRows()).toEqual([expect.objectContaining({ id: drink.id, qty })]);
      } else {
        expect(h.cartRows()).toEqual([]);
        expect(reply || '').toMatch(/cuántas|cuantas|cuál|cual/i);
      }
    },
  );

  it.each(fictional.flatMap((item) => [false, true].map((agent) => ({ ...item, agent }))))(
    '$kind: somos a secas no pide el pack (agent $agent)',
    async ({ pack, drink, agent }) => {
      const h = harness([pack, drink] as typeof products, agent);
      h.service.ordersService.create = jest.fn();
      await h.sendQueued(`Somos ${pack.name.split(/\s+/)[0].toLowerCase()}`);
      expect(h.cartRows().some((row) => row.id === pack.id)).toBe(false);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    },
  );

  it.each(fictional)('$kind: nombrar el pack sí lo pide', async ({ pack, drink, order }) => {
    const h = harness([pack, drink] as typeof products, false);
    h.service.ordersService.create = jest.fn();
    await h.sendQueued(order);
    expect(h.cartRows().map((row) => row.id)).toEqual([pack.id]);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});


describe('Aclaración por nota — no invertir con y sin',()=>{
 it.each(['Sopa De Calabaza','Pizza Rustica'].flatMap(name=>[false,true].flatMap(agent=>['cantidad','quitar'].map(kind=>({name,agent,kind})))))('$name $kind agent=$agent',async({name,agent,kind})=>{
  const dish={id:26001,code:1701,name,price:10500,availableNow:true,hasAttributes:false,attributes:[]};
  const h=harness([dish] as typeof products,agent);h.service.ordersService.create=jest.fn();
  h.conv.sessionData.cart=[{productId:dish.id,name,code:dish.code,unitPrice:dish.price,quantity:4,attributes:[],note:'sin cilantro'},
   {productId:dish.id,name,code:dish.code,unitPrice:dish.price,quantity:3,attributes:[],note:'sin cebolla'}];
  await h.sendQueued(kind==='cantidad'?`Deja solo dos ${name}`:`Quita ${name}`);
  const before=structuredClone(h.conv.sessionData);const state=h.conv.state;
  const reply=await h.sendQueued('El que va con cilantro');expect(h.conv.sessionData).toEqual(before);expect(h.conv.state).toBe(state);expect(reply||'').toMatch(/n[uú]mero|no.*sola.*l[ií]nea|cu[aá]l/i);await h.sendQueued('El que va sin cilantro');
  expect(h.cartRows()).toEqual(kind==='cantidad'?[expect.objectContaining({id:dish.id,qty:2,note:'sin cilantro'}),expect.objectContaining({id:dish.id,qty:3,note:'sin cebolla'})]:[expect.objectContaining({id:dish.id,qty:3,note:'sin cebolla'})]);
  expect(h.conv.sessionData.pendingCartQuantity).toBeUndefined();expect(h.conv.sessionData.pendingCartRemoval).toBeUndefined();expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});


describe('Cortesía con porción y nota — cuarto de pollo real', () => {
  it.each([true, false])('conserva plato y ají tras saludo agent=%s', async enabled => {
    const h = harness(products, enabled);
    await h.send('Hola');
    const reply = await h.send('Por favor me envias Un cuarto De Pollo frito con arto aji');
    expect(reply).not.toMatch(/no manejamos|no tenemos/i);
    if (h.conv.sessionData.pendingAttribute) await h.send('Pierna pernil');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:3,qty:1,note:expect.stringMatching(/harto ají/i)})]);
    expect(h.conv.state).not.toBe('completed');
  });
});


describe('Cortesía y nota — cartas distintas', () => {
  const menus = ['Pizza Rustica', 'Ramen De Miso', 'Bowl Andino', 'Tacos Vegetarianos'];
  for (const [i, name] of menus.entries()) {
    for (const prefix of ['Por favor me envias', 'Porfa me envías', 'Por favor mándame']) {
      it.each([true, false])(`${name} ${prefix} agent=%s`, async enabled => {
        const menu = [{...products[0],id:30000+i,code:900+i,name,attributes:[],price:17000+i*1000}];
        const h = harness(menu, enabled);
        await h.send('Hola');
        const reply = await h.send(`${prefix} un ${name} con arto aji`);
        expect(reply).not.toMatch(/no manejamos|no tenemos/i);
        expect(h.cartRows()).toEqual([expect.objectContaining({id:30000+i,qty:1,note:expect.stringMatching(/harto ají/i)})]);
        expect(h.conv.state).not.toBe('completed');
      });
    }
  }
});


describe('Maduro y compra después de rendimiento — chat real', () => {
  it.each([true,false])('disponibilidad alias sin compra agent=%s', async enabled => {
    const h = harness(products,enabled);
    const reply = await h.send('Hola buenas tardes tienes maduro con queso y bocadillo');
    expect(reply).not.toMatch(/no tenemos|no manejamos/i);
    expect(reply).toMatch(/pl[aá]tano|maduro/i);
    expect(h.cartRows()).toEqual([]);
  });
  it.each([true,false])('oferta rendimiento y compra dos agent=%s', async enabled => {
    const h = harness(products,enabled);
    await h.send('Un platano maduro con queso y bocadillo');
    await h.send("Si por favor, Para cuantas persona's alcanza?");
    const reply = await h.send('De acuerdo entonces Dame dos');
    expect(reply).not.toMatch(/no est[aá] en tu carrito|no manejamos/i);
    expect(h.cartRows()).toEqual([expect.objectContaining({id:53,qty:2})]);
  });
});


describe('Combo pendiente — aclaración larga y extra de acompañamiento', () => {
  it('no convierte la respuesta al combo en un plato desconocido', async () => {
    const h = harness(products,true);
    h.agent.runTurn.mockResolvedValueOnce({reply:'El Combo De Pollo Broaster viene con papa francesa. ¿Te lo agrego con papa salada en vez de papa francesa? ¿Qué bebida prefieres?',actions:{},toolCalls:[]});
    await h.send('Hola Buenos dias me envias Un combo De Pollo broaster con papas saladas es Para los gemelos');
    const reply = await h.send('Lo quiero normal con papa Francesa pero que Le agreguen unas Tres papitas saladas asi como siemore me envian');
    expect(reply).not.toMatch(/no manejamos.*Lo quiero normal/is);
    const session=h.conv.sessionData;
    expect(session.cart.some(line=>/combo.*broaster/i.test(line.name)) || /combo.*broaster/i.test(session.pendingAttribute?.name || session.pendingAddOffer?.name || '')).toBe(true);
    expect(session.cart.filter(line=>/papa salada/i.test(line.name))).toEqual([]);
    expect(h.conv.state).not.toBe('completed');
    expect(session.customerNotes).toMatch(/revisar con el local.*Tres papitas/i);
    expect(h.replies.join('\n')).toMatch(/confirmar si se puede y si tiene costo/i);
    if (session.pendingAttribute) await h.send('Colombiana');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:98,qty:1})]);
  });
});


describe('Oferta estructurada — continuidad portable y controles', () => {
  for (const [i,name] of ['Pizza Rustica','Ramen De Miso','Bowl Andino','Tacos Vegetarianos'].entries()) {
    const product={...products[0],id:31000+i,code:910+i,name,price:19000+i*1000,hasAttributes:false,attributes:[]};
    it.each([true,false])(`${name} pregunta de rendimiento conserva oferta y cantidad agent=%s`, async enabled => {
      const h=harness([product],enabled);
      h.conv.sessionData.pendingAddOffer={productId:product.id,name,code:product.code,price:product.price,quantity:1,sourceText:name};
      h.conv.sessionData.productFocus={productId:product.id,name};
      const before=structuredClone(h.cartRows());
      await h.send('Para cuantas personas alcanza?');
      expect(h.cartRows()).toEqual(before);
      expect(h.conv.sessionData.pendingAddOffer?.productId).toBe(product.id);
      const reply=await h.send('De acuerdo entonces dame dos');
      expect(h.cartRows()).toEqual([expect.objectContaining({id:product.id,qty:2})]);
      expect(reply).not.toMatch(/no est[aá] en tu carrito|no manejamos/i);
      expect(h.conv.sessionData.pendingAddOffer).toBeUndefined();
    });
    it.each([true,false])(`${name} extra no multiplica plato ni agrega SKU agent=%s`,async enabled=>{
      const side={...product,id:32000+i,code:920+i,name:'Porcion De Ensalada',price:7000};
      const h=harness([product,side],enabled);
      h.conv.sessionData.pendingAddOffer={productId:product.id,name,code:product.code,price:product.price,quantity:2,sourceText:`Dos ${name} sin ensalada`};
      h.conv.sessionData.productFocus={productId:product.id,name};
      h.conv.sessionData.address='Calle 10 #20-30';
      const reply=await h.send('Lo quiero normal pero que le agreguen tres hojitas de ensalada como siempre');
      expect(h.cartRows()).toEqual([expect.objectContaining({id:product.id,qty:2})]);
      expect(h.conv.sessionData.customerNotes).toMatch(/revisar con el local.*tres hojitas/i);
      expect(h.conv.sessionData.address).toBe('Calle 10 #20-30');
      expect(reply).not.toMatch(/no manejamos|gratis/i);
    });
    it.each([true,false])(`${name} cantidad cambia línea enfocada conservando otra agent=%s`,async enabled=>{
      const h=harness([product],enabled);
      h.conv.sessionData.cart=[{productId:product.id,code:product.code,name,quantity:1,unitPrice:product.price,note:'sin cilantro',attributes:[]}];
      h.conv.sessionData.productFocus={productId:product.id,name};
      await h.send('Para cuantas personas alcanza?');
      await h.send('De acuerdo entonces dame dos');
      expect(h.cartRows()).toEqual([expect.objectContaining({id:product.id,qty:2,note:'sin cilantro'})]);
    });
  }
  it.each([true,false])('sin foco no inventa compra referencial agent=%s',async enabled=>{
    const h=harness(products,enabled);
    await h.send('De acuerdo entonces dame dos');
    expect(h.cartRows()).toEqual([]);
    expect(h.conv.state).not.toBe('completed');
  });
  it.each([true,false])('oferta múltiple no elige un producto por su cuenta agent=%s',async enabled=>{
    const h=harness(products,enabled);
    h.conv.sessionData.pendingAddOffer={productId:17,name:'Churrasco',code:17,price:38000,quantity:1,productIds:[17,23]};
    await h.send('De acuerdo entonces dame dos');
    expect(h.cartRows()).toEqual([]);
  });
  it('no reescribe un maduro que sí existe en otra carta',()=>{
    const catalog=new WhatsappCatalogService({} as never);
    const menu=[{...products[0],name:'Maduro Con Queso'}, {...products[0],id:33001,name:'Platano Con Queso'}];
    expect(catalog.resolveCatalogAliasText('Tienes maduro con queso',menu)).toBe('Tienes maduro con queso');
    expect(catalog.resolveCatalogAliasText('Tienes maduro con chocolate',products)).toBe('Tienes maduro con chocolate');
  });
});


describe('Contrato de continuidad — conversación completa y atributo pendiente',()=>{
 const menus=[{name:'Jugo De La Selva',desc:'Preparado con agua y fruta',attr:'Sabor',values:['Lulo','Mango']},{name:'Jugo De La Huerta',desc:'Preparado con agua y fruta',attr:'Sabor',values:['Fresa','Maracuya']}];
 for(const [i,m] of menus.entries()) {
  const dish={id:34000+i,code:930+i,name:m.name,description:m.desc,price:22000,availableNow:true,hasAttributes:true,attributes:[{attributeName:m.attr,options:m.values}]};
  it.each([true,false])(`${m.name} consulta aclaración nota y respuesta agent=%s`,async enabled=>{
   const h=harness([dish],enabled);h.service.ordersService.create=jest.fn();h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
   h.conv.customerName='';
   await h.sendQueued('Hola');
   await h.sendQueued(`Quiero dos #${dish.code}`);
   expect(h.cartRows()).toEqual([]);
   expect(h.conv.sessionData.pendingAttribute).toMatchObject({productId:dish.id,quantity:2});
   const before=structuredClone(h.conv.sessionData.pendingAttribute);
   const price=await h.sendQueued('¿Cuánto vale cada uno?');
   expect(price||'').toMatch(/22[.,]000/);
   expect(h.cartRows()).toEqual([]);
   expect(h.conv.sessionData.pendingAttribute).toEqual(before);
   const reply=await h.sendQueued('Lo quiero normal pero sin azúcar por favor');
   expect(reply||'').not.toMatch(/no manejamos|no tenemos/i);
   expect(h.conv.sessionData.pendingAttribute).toMatchObject({productId:dish.id,quantity:2});
   expect(h.cartRows()).toEqual([]);
   await h.sendQueued(m.values[1]);
   expect(h.cartRows()).toEqual([expect.objectContaining({id:dish.id,qty:2,attrs:[`${m.attr}:${m.values[1]}`],note:expect.stringMatching(/sin azúcar/i)})]);
   const address=await h.sendQueued('Es para la calle 21 #34-56');
   expect(address||'').toMatch(/nombre/i);
   expect(h.conv.state).toBe('awaiting_name');
   const nameQuestion=await h.sendQueued('¿Cuánto cuesta el pedido?');
   expect(nameQuestion||'').toMatch(/46[.,]000/);
   expect(h.conv.customerName).toBe('');
   expect(h.conv.state).toBe('awaiting_name');
   await h.sendQueued('Ana Maria Perez');
   expect(h.conv.customerName).toBe('Ana Maria Perez');
   expect(h.conv.state).toBe('awaiting_payment');
   const cart=structuredClone(h.cartRows());
   const total=await h.sendQueued('¿Cuánto suma todo?');
   expect(total||'').toMatch(/46[.,]000/);
   expect(h.cartRows()).toEqual(cart);
   await h.sendQueued('Pago en efectivo');
   expect(h.conv.state).toBe('awaiting_final_confirm');
   expect(h.conv.sessionData.paymentMethod).toBe('cash');
   expect(h.cartRows()).toEqual(cart);
   expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
 }
});


describe('Código de producto y número de pedido — intenciones distintas',()=>{
 const dish={id:35001,code:941,name:'Pizza Rustica',price:22000,availableNow:true,hasAttributes:false,attributes:[]};
 it.each([true,false].flatMap(agent=>['Quiero dos #941','Dame un #941','Quiero dos #942'].map(text=>({agent,text}))))('$text agent=$agent',async({agent,text})=>{
  const h=harness([dish],agent);h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);h.service.ordersService.create=jest.fn();
  const reply=await h.sendQueued(text);
  expect(h.service.ordersService.findTodayOrdersByPhone).not.toHaveBeenCalled();
  if(text.endsWith('942')){expect(h.cartRows()).toEqual([]);expect(reply||'').not.toMatch(/pedido de hoy|estado de tu pedido/i);}
  else expect(h.cartRows()).toEqual([expect.objectContaining({id:dish.id,qty:text.includes('dos')?2:1})]);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it.each([true,false])('pregunta de estado con el mismo número sigue siendo consulta agent=%s',async agent=>{
  const h=harness([dish],agent);h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  const reply=await h.sendQueued('¿Cómo va mi pedido #941?');
  expect(h.cartRows()).toEqual([]);
  expect(h.service.ordersService.findTodayOrdersByPhone).toHaveBeenCalled();
  expect(reply||'').toMatch(/pedido|n[uú]mero/i);
 });
});


describe('Corrección referencial — la bebida era del combo',()=>{
 const menus=[{label:'ppp',combo:products.find(p=>p.id===97),drink:products.find(p=>p.id===34),choice:'Coca Cola'},{label:'vegetal',combo:{id:36001,code:951,name:'Combo Vegetal',price:25000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Lulo','Mango']}]},drink:{id:36002,code:952,name:'Jugo Tropical',price:6000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Lulo','Mango']}]},choice:'Mango'}];
 for(const m of menus) it.each([true,false].flatMap(agent=>[0,2].map(existing=>({agent,existing}))))(`${m.label} conserva bebida anterior=$existing agent=$agent`,async({agent,existing})=>{
  const menu=m.label==='ppp'?products:[m.combo,m.drink];const h=harness(menu,agent);h.service.ordersService.create=jest.fn();
  h.conv.sessionData.cart=[{productId:m.combo.id,name:m.combo.name,code:m.combo.code,unitPrice:m.combo.price,quantity:1,attributes:[{attributeName:'Bebida',attributeValue:m.label==='ppp'?'Colombiana':'Lulo'}],note:'sin cebolla'}];
  if(existing)h.conv.sessionData.cart.push({productId:m.drink.id,name:m.drink.name,code:m.drink.code,unitPrice:m.drink.price,quantity:existing,attributes:[{attributeName:'Sabor',attributeValue:m.choice}]});
  const before=structuredClone(h.cartRows());
  await h.sendQueued(`Agrega una #${m.drink.code} con ${m.choice}`);
  const reply=await h.sendQueued('Pero me refiero a la gaseosa del combo');
  expect(reply||'').not.toMatch(/si es as[ií]|quieres cambiar|dime y lo ajusto/i);
  expect(h.cartRows().find(r=>r.id===m.combo.id)).toMatchObject({qty:1,attrs:expect.arrayContaining([`Bebida:${m.choice}`]),note:'sin cebolla'});
  const drinks=h.cartRows().filter(r=>r.id===m.drink.id);expect(drinks).toHaveLength(existing?1:0);
  if(existing)expect(drinks[0]).toEqual(before[1]);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});


describe('Corrección de bebida — no deshacer sin evidencia única',()=>{
 it.each([true,false].flatMap(agent=>['sin historial','carrito cambiado','dos combos'].map(kind=>({agent,kind}))))('$kind agent=$agent',async({agent,kind})=>{
  const h=harness(products,agent);
  const combo={productId:97,name:'Combo Arroz Chino Con Medio Pollo',code:97,unitPrice:50000,quantity:1,attributes:[{attributeName:'Bebida',attributeValue:'Colombiana'},{attributeName:'Pollo',attributeValue:'Broaster'}]};
  const before=[combo];
  if(kind==='dos combos')before.push({...combo,productId:98,name:'Combo De Pollo Broaster',code:98});
  h.conv.sessionData.cart=[...before,{productId:34,name:'Gaseosa Coca Cola 400ml',code:34,unitPrice:4500,quantity:1,attributes:[{attributeName:'Sabor',attributeValue:'Coca Cola'}]}];
  if(kind!=='sin historial')h.conv.sessionData.lastDrinkAddition={productId:34,beforeCart:structuredClone(before),cartSignature:kind==='carrito cambiado'?'old signature':JSON.stringify(h.conv.sessionData.cart)};
  const original=structuredClone(h.conv.sessionData);
  const reply=await h.sendQueued('Pero me refiero a la gaseosa del combo');
  expect(h.conv.sessionData).toEqual(original);
  expect(reply||'').toMatch(/aclar|qué sabor|cu[aá]l combo/i);
 });
});


describe('Eliminación por fila — interrumpe captura sin consumir dirección',()=>{
 const cases=['Quita la 2','Elimina el item 2','Borra el segundo'];
 for(const state of ['awaiting_address','awaiting_name','awaiting_phone','awaiting_payment','awaiting_final_confirm'])for(const text of cases)it.each([true,false])(`${state} ${text} agent=%s`,async agent=>{
  const menu=[{id:37001,code:961,name:'Pizza Rustica',price:22000,availableNow:true,hasAttributes:false,attributes:[]},{id:37002,code:962,name:'Jugo De Mango',price:6500,availableNow:true,hasAttributes:false,attributes:[]}];
  const h=harness(menu,agent);h.conv.state=state;h.service.ordersService.create=jest.fn();
  h.conv.sessionData.cart=menu.map(p=>({productId:p.id,name:p.name,code:p.code,unitPrice:p.price,quantity:1,attributes:[],note:p.id===37001?'sin cebolla':undefined}));
  h.conv.sessionData.orderType='delivery';h.conv.sessionData.address=state==='awaiting_address'?'Conjunto Residencial Bandera':'Calle 21 #34-56';h.conv.sessionData.addressConfirmed=state!=='awaiting_address';
  if(state==='awaiting_name')h.conv.customerName='';
  if(state==='awaiting_final_confirm')h.conv.sessionData.paymentMethod='cash';
  const originalAddress=h.conv.sessionData.address;
  const reply=await h.sendQueued(text);
  expect(h.cartRows()).toEqual([expect.objectContaining({id:37001,qty:1,note:'sin cebolla'})]);
  expect(h.conv.sessionData.address).toBe(originalAddress);
  expect(h.conv.state).toBe(state);
  expect(reply||'').toMatch(/quit[eé]|elimin|retir/i);
  expect(reply||'').toMatch(state==='awaiting_address'?/direcci[oó]n|ubicaci[oó]n/i:state==='awaiting_name'?/nombre/i:state==='awaiting_phone'?/tel[eé]fono/i:state==='awaiting_final_confirm'?/confirmar/i:/pago|pagas/i);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});


describe('Fila inválida u otra lista — no consume dirección ni quita plato',()=>{
 it.each([true,false].flatMap(agent=>['Quita la 0','Quita la 99','otra lista'].map(text=>({agent,text}))))('$text agent=$agent',async({agent,text})=>{
  const h=harness(products,agent);h.conv.state='awaiting_address';h.conv.sessionData.address='Conjunto Prueba';
  h.conv.sessionData.cart=[{productId:97,name:'Combo Arroz Chino Con Medio Pollo',code:97,unitPrice:50000,quantity:1,attributes:[]}];
  if(text==='otra lista')h.conv.sessionData.pendingAttribute={productId:28,name:'Gaseosa 400ml',code:28,price:4000,attributes:[{attributeName:'Sabor',options:['Colombiana','Pepsi']}],selected:[],quantity:2};
  const before=structuredClone(h.conv.sessionData);
  const reply=await h.sendQueued(text==='otra lista'?'Quita la 1':text);
  expect(h.conv.sessionData).toEqual(before);expect(h.conv.state).toBe('awaiting_address');
  expect(reply||'').toMatch(/no existe|otra lista/i);
 });
});


describe('Teléfono pendiente — resolver consulta y completar checkout',()=>{
 const menus=[{id:38001,code:971,name:'Pizza De Setas',description:'Incluye setas y queso',price:17000,availableNow:true,hasAttributes:false,attributes:[]},{id:38002,code:972,name:'Bowl De Quinoa',description:'Incluye quinoa y verduras',price:17000,availableNow:true,hasAttributes:false,attributes:[]}];
 for(const dish of menus)for(const question of ['¿Cuánto suma todo?','¿Qué trae ese plato?','Me pueden comprar unas pilas?'])it.each([false,true])(`${dish.name} ${question} agent=%s`,async agent=>{
  const h=harness([dish],agent);h.service.ordersService.create=jest.fn();h.conv.state='awaiting_phone';
  h.conv.sessionData.cart=[{productId:dish.id,name:dish.name,code:dish.code,unitPrice:dish.price,quantity:3,attributes:[],note:'sin cebolla'}];
  h.conv.sessionData.orderType='delivery';h.conv.sessionData.address='Calle 21 #34-56';h.conv.sessionData.addressConfirmed=true;h.conv.sessionData.deliveryFeeCalculated=2000;
  const before=structuredClone(h.conv.sessionData);
  const reply=await h.sendQueued(question);
  expect(h.conv.sessionData).toEqual(before);expect(h.conv.state).toBe('awaiting_phone');
  expect(reply||'').toMatch(/tel[eé]fono|n[uú]mero|contacto/i);
  if(question.includes('suma'))expect(reply||'').toMatch(/53[.,]000/);
  if(question.includes('trae'))expect(reply||'').toMatch(dish.id===38001?/setas.*queso/i:/quinoa.*verduras/i);
  if(question.includes('pilas'))expect(reply||'').toMatch(/pilas/i);
  await h.sendQueued('310 555 0199');
  expect(h.conv.sessionData.phoneConfirmed).toBe(true);expect(h.conv.sessionData.contactPhone).toBe('+573105550199');
  expect(h.conv.state).toBe('awaiting_payment');expect(h.conv.sessionData.cart).toEqual(before.cart);
  await h.sendQueued('Pago por Nequi');
  expect(h.conv.state).toBe('awaiting_final_confirm');expect(h.conv.sessionData.paymentMethod).toBe('transfer');
  expect(h.conv.sessionData.cart).toEqual(before.cart);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});


describe('Consulta referencial — aclarar sin comprar y volver al teléfono',()=>{
 const menu=[{id:39001,code:981,name:'Pizza De Setas',description:'Incluye setas y queso',price:17000,availableNow:true,hasAttributes:false,attributes:[]},{id:39002,code:982,name:'Bowl De Quinoa',description:'Incluye quinoa y verduras',price:17000,availableNow:true,hasAttributes:false,attributes:[]}];
 for(const answer of ['Bowl De Quinoa','2','el segundo','¿Cuánto suma todo?','3105550199'])it.each([false,true])(`${answer} agent=%s`,async agent=>{
  const h=harness(menu,agent);h.service.ordersService.create=jest.fn();h.conv.state='awaiting_phone';
  h.conv.sessionData.cart=menu.map(p=>({productId:p.id,name:p.name,code:p.code,unitPrice:p.price,quantity:1,attributes:[]}));
  h.conv.sessionData.address='Calle 21 #34-56';h.conv.sessionData.addressConfirmed=true;h.conv.sessionData.deliveryFeeCalculated=2000;h.conv.sessionData.orderType='delivery';
  const cart=structuredClone(h.cartRows());
  const ask=await h.sendQueued('¿Qué trae ese plato?');
  expect(ask||'').toMatch(/de qué plato/i);expect(h.conv.sessionData.pendingCompositionAsk).toMatchObject({resumeState:'awaiting_phone',productIds:menu.map(p=>p.id)});expect(h.cartRows()).toEqual(cart);
  if(answer==='2')h.service.catalogService.getMenuProducts.mockResolvedValue([...menu].reverse());
  const reply=await h.sendQueued(answer);
  expect(h.cartRows()).toEqual(cart);expect(h.conv.sessionData.pendingCompositionAsk).toBeUndefined();
  if(answer==='3105550199'){expect(h.conv.state).toBe('awaiting_payment');expect(h.conv.sessionData.contactPhone).toBe('+573105550199');}
  else {
   expect(h.conv.state).toBe('awaiting_phone');expect(reply||'').toMatch(/tel[eé]fono|n[uú]mero/i);
   if(answer.includes('suma'))expect(reply||'').toMatch(/36[.,]000/);else expect(reply||'').toMatch(/quinoa.*verduras/i);
   expect(reply||'').not.toMatch(/te lo agrego/i);
   await h.sendQueued('3105550199');expect(h.conv.state).toBe('awaiting_payment');
  }
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});


describe('Referencia activa — la compra pendiente manda sobre un foco viejo',()=>{
 it.each([false,true])('consulta no cambia compra ni selecciona el foco anterior agent=%s',async agent=>{
  const food={id:40001,code:991,name:'Pizza De Setas',description:'Con setas y queso',price:17000,availableNow:true,hasAttributes:false,attributes:[]};
  const drink={id:40002,code:992,name:'Jugo Tropical',description:'Con agua y fruta',price:6000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mango','Lulo']}]};
  const h=harness([food,drink],agent);h.conv.state='awaiting_attribute';
  h.conv.sessionData.productFocus={productId:food.id,name:food.name};
  h.conv.sessionData.pendingAttribute={productId:drink.id,name:drink.name,code:drink.code,price:drink.price,quantity:3,attributes:drink.attributes,selected:[],sourceText:'Tres jugos tropicales sin hielo'};
  const before=structuredClone(h.conv.sessionData);
  const reply=await h.sendQueued('¿Qué incluye eso?');
  expect(reply||'').toMatch(/agua.*fruta/i);expect(reply||'').not.toMatch(/setas|queso/i);expect(h.conv.sessionData).toEqual(before);
  await h.sendQueued('Lulo');expect(h.cartRows()).toEqual([expect.objectContaining({id:drink.id,qty:3,attrs:['Sabor:Lulo'],note:expect.stringMatching(/sin hielo/i)})]);
 });
});


describe('Consulta intercalada — una corrección explícita reemplaza la aclaración',()=>{
 it.each([false,true])('quitar por nombre retoma teléfono sin resolver la consulta vieja agent=%s',async agent=>{
  const menu=[{id:41001,code:993,name:'Pizza De Setas',description:'Con setas y queso',price:17000,availableNow:true,hasAttributes:false,attributes:[]},{id:41002,code:994,name:'Bowl De Quinoa',description:'Con quinoa y verduras',price:19000,availableNow:true,hasAttributes:false,attributes:[]}];
  const h=harness(menu,agent);h.conv.state='awaiting_phone';h.service.ordersService.create=jest.fn();
  h.conv.sessionData.cart=menu.map(p=>({productId:p.id,name:p.name,code:p.code,unitPrice:p.price,quantity:1,attributes:[]}));
  h.conv.sessionData.address='Calle 21 #34-56';h.conv.sessionData.addressConfirmed=true;h.conv.sessionData.deliveryFeeCalculated=2000;h.conv.sessionData.orderType='delivery';
  await h.sendQueued('¿Qué trae ese plato?');expect(h.conv.sessionData.pendingCompositionAsk).toBeDefined();
  const reply=await h.sendQueued('Quita el bowl de quinoa');
  expect(h.cartRows()).toEqual([expect.objectContaining({id:41001,qty:1})]);expect(h.conv.state).toBe('awaiting_phone');expect(h.conv.sessionData.pendingCompositionAsk).toBeUndefined();
  expect(reply||'').toMatch(/quit[eé].*bowl/i);expect(reply||'').toMatch(/tel[eé]fono|n[uú]mero/i);
  await h.sendQueued('3105550199');expect(h.conv.state).toBe('awaiting_payment');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});


describe('Evaluación real oficina — referencias de precio y contexto narrativo',()=>{
 const menu=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-alternate-menu.json'),'utf8'));
 const recorded=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-recorded-office-output.json'),'utf8'));
 it.each(['Hola! somos varios en la oficina:','Buenas, somos varias en el taller:','Somos seis en la reunión:'])('no ofrece el contexto como platos: %s',async(prefix)=>{
  const h=harness(menu,true);h.service.ordersService.create=jest.fn();h.agent.runTurn.mockResolvedValue(recorded.agentResult);
  const reply=await h.sendQueued(prefix+' para Lina van 2 bowls andinos, para Oscar un trio de wraps y para la reunion tres limonadas de hierbabuena. Eso es todo por ahora, gracias.');
  expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:501,qty:2}),expect.objectContaining({id:504,qty:1}),expect.objectContaining({id:503,qty:3})]));expect(h.cartRows()).toHaveLength(3);
  expect(reply||'').not.toMatch(/no tenemos|no manejamos/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 for(const agent of [false,true])for(const family of ['Bowl','Wrap'])for(const query of ['Cuánto cuesta cada','Qué precio tiene el']){
  it('consulta '+family+' '+query+' agente='+agent,async()=>{
   const fixture=[{id:27901,code:27901,name:family+' De Setas',price:18700,availableNow:true,hasAttributes:false,attributes:[]},{id:27902,code:27902,name:'Agua Mineral',price:6000,availableNow:true,hasAttributes:false,attributes:[]}];
   const h=harness(fixture as typeof products,agent);h.service.ordersService.create=jest.fn();h.conv.state='awaiting_payment';
   h.conv.sessionData={cart:fixture.map(p=>({productId:p.id,name:p.name,code:p.code,unitPrice:p.price,quantity:2,attributes:[]})),orderType:'delivery',address:'Calle 12 34 56',addressConfirmed:true};const before=structuredClone(h.conv.sessionData);
   const reply=await h.sendQueued(query+' '+family.toLowerCase()+'?');
   expect(reply||'').toContain('18.700');expect(reply||'').toMatch(/cómo pagas|como pagas|método de pago/i);expect(h.conv.sessionData).toEqual(before);expect(h.conv.state).toBe('awaiting_payment');expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
 }
 it.each([false,true])('dos bowls no elige primero, cotiza ambos sin mutar agente=%s',async(agent)=>{
  const fixture=['Bowl De Setas','Bowl De Quinoa','Agua Mineral'].map((name,i)=>({id:27911+i,code:27911+i,name,price:18000+i*1000,availableNow:true,hasAttributes:false,attributes:[]}));
  const h=harness(fixture as typeof products,agent);h.conv.sessionData.cart=fixture.map(p=>({productId:p.id,name:p.name,code:p.code,unitPrice:p.price,quantity:1,attributes:[]}));const before=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued('Cuánto cuesta cada bowl?');expect(reply||'').toMatch(/Bowl De Setas:.*18.000/);expect(reply||'').toMatch(/Bowl De Quinoa:.*19.000/);expect(h.conv.sessionData.cart).toEqual(before);
 });
 it('un producto ajeno después del contexto conserva el aviso y no lo compra',async()=>{
  const h=harness(menu,true);h.agent.runTurn.mockResolvedValue(recorded.agentResult);
  const reply=await h.sendQueued('Hola! somos varios en la oficina: para Lina van 2 bowls andinos, para Oscar un trio de wraps y para la reunion tres limonadas de hierbabuena y un detergente.');
  expect(reply||'').toMatch(/detergente/i);expect(h.cartRows().map(r=>r.id).sort()).toEqual([501,503,504]);
 });
});


describe('Disculpa de otro negocio — nueva compra explícita en el mismo mensaje',()=>{
 it.each(['Uy perdon era otro negocio.','Disculpa, era para otra tienda.'])('reconoce destinatario equivocado: %s',text=>expect(isWrongChatApology(text)).toBe(true));
 it.each(['Perdón era otro combo, quiero cambiar la bebida','Disculpa, la sopa era para otra persona'])('no cancela una corrección del pedido: %s',text=>expect(isWrongChatApology(text)).toBe(false));
 for(const agent of [false,true])for(const dish of ['Sopa De Zapallo','Pasta De Setas'])for(const prefix of ['Uy perdon era otro negocio. Ahora sí quisiera','Disculpa, era para otra tienda. Pero quiero']){
  it('abandona propuesta y compra '+dish+' agente='+agent+' '+prefix,async()=>{
   const fixture=[{id:28001,code:28001,name:dish,price:17000,availableNow:true,hasAttributes:false,attributes:[]}];
   const h=harness(fixture as typeof products,agent);h.service.ordersService.create=jest.fn();
   h.conv.sessionData.pendingMultiOrder={confident:[],ambiguous:[],needsAttributes:[],unresolved:['detergente','bolsas de hielo']};
   h.agent.runTurn.mockResolvedValue({reply:'Listo.',actions:{addItems:[{productId:28001,quantity:1}]},toolCalls:['add_item']});
   const reply=await h.sendQueued(prefix+' una '+dish.toLowerCase());
   expect(h.cartRows()).toEqual([expect.objectContaining({id:28001,qty:1})]);expect(h.conv.sessionData.pendingMultiOrder).toBeUndefined();expect(reply||'').toMatch(new RegExp(dish,'i'));expect(reply||'').not.toMatch(/detergente|bolsas de hielo/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
 }
});

describe('Cierre de compra dentro de un mensaje largo', () => {
  const place = (id: number, name: string, price: number) => ({
    id, code: id, name, price, availableNow: true, hasAttributes: false, attributes: [] as { attributeName: string; options: string[] }[],
  });
  const delivery = (h: ReturnType<typeof harness>) => {
    h.conv.sessionData.orderType = 'delivery';
    h.conv.sessionData.fulfillmentChosen = false;
    h.service.ordersService.create = jest.fn();
  };

  it('separa el pedido del cierre', () => {
    expect(orderBeforeCheckoutClose('Quiero dos limonadas. Eso es todo por ahora, gracias')).toBe('Quiero dos limonadas');
    expect(orderBeforeCheckoutClose('Calle 80 nada mas')).toBeNull();
    expect(isHypotheticalOrderQuestion('Si pido dos limonadas, eso es todo')).toBe(true);
  });

  it.each([false, true])('ppp pide la dirección al cerrar el pedido (agent %s)', async (agent) => {
    const drink = products.find((item: { name: string }) => /^limonada natural$/i.test(item.name));
    const soup = products.find((item: { name: string }) => /^sopa de ajiaco$/i.test(item.name));
    const h = harness(products, agent);
    delivery(h);
    const reply = await h.sendQueued('Quiero dos limonadas naturales y una sopa de ajiaco. Eso es todo por ahora, gracias');
    expect(h.cartRows()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: drink.id, qty: 2 }),
      expect.objectContaining({ id: soup.id, qty: 1 }),
    ]));
    expect(h.conv.state).toBe('awaiting_address');
    expect(reply || '').toMatch(/direcci[oó]n/i);
    expect(reply || '').not.toMatch(/algo más/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each(['solo eso', 'nada más'])('ppp cierra con «%s»', async (close) => {
    const drink = products.find((item: { name: string }) => /^limonada natural$/i.test(item.name));
    const soup = products.find((item: { name: string }) => /^sopa de ajiaco$/i.test(item.name));
    const h = harness(products, false);
    delivery(h);
    const reply = await h.sendQueued(`Quiero dos limonadas naturales y una sopa de ajiaco, ${close}`);
    expect(h.cartRows()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: drink.id, qty: 2 }),
      expect.objectContaining({ id: soup.id, qty: 1 }),
    ]));
    expect(h.conv.state).toBe('awaiting_address');
    expect(reply || '').toMatch(/direcci[oó]n/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  const fictional = [
    { kind: 'pizza', a: place(30101, 'Pizza Rustica', 28000), b: place(30102, 'Gaseosa Artesanal', 5000), text: 'Quiero dos pizzas rusticas y una gaseosa artesanal. Eso es todo por ahora, gracias', qtyA: 2, qtyB: 1 },
    { kind: 'ramen', a: place(30111, 'Ramen De Miso', 24000), b: place(30112, 'Te Verde', 4000), text: 'Quiero tres ramen de miso y dos te verde, solo eso', qtyA: 3, qtyB: 2 },
    { kind: 'bowl', a: place(30121, 'Bowl De Quinoa', 19000), b: place(30122, 'Agua Mineral', 3000), text: 'Quiero un bowl de quinoa y dos aguas minerales, nada más', qtyA: 1, qtyB: 2 },
  ];

  it.each(fictional.flatMap((item) => [false, true].map((agent) => ({ ...item, agent }))))(
    '$kind cierra el pedido largo (agent $agent)',
    async ({ a, b, text, qtyA, qtyB, agent }) => {
      const h = harness([a, b] as typeof products, agent);
      delivery(h);
      const reply = await h.sendQueued(text);
      expect(h.cartRows()).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: a.id, qty: qtyA }),
        expect.objectContaining({ id: b.id, qty: qtyB }),
      ]));
      expect(h.conv.state).toBe('awaiting_address');
      expect(reply || '').toMatch(/direcci[oó]n/i);
      expect(reply || '').not.toMatch(/algo más/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    },
  );

  it('la opción pendiente se resuelve antes del cierre', async () => {
    const juice = products.find((item: { name: string }) => /jugo natural en agua/i.test(item.name));
    const h = harness(products, false);
    delivery(h);
    const reply = await h.sendQueued('Quiero un jugo natural en agua y una limonada natural. Eso es todo');
    expect(h.conv.state).not.toBe('awaiting_address');
    expect(h.conv.state).not.toBe('awaiting_payment');
    expect(reply || '').toMatch(/sabor|cu[aá]l/i);
    expect(h.cartRows().some((row) => row.id === juice.id && !(row.attrs || []).some((attr) => /sabor/i.test(attr)))).toBe(false);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each([false, true])('si pido no compra ni cierra (agent %s)', async (agent) => {
    const h = harness(products, agent);
    delivery(h);
    const reply = await h.sendQueued('Si pido dos limonadas naturales y una sopa de ajiaco, eso es todo');
    expect(h.cartRows()).toEqual([]);
    expect(h.conv.state).toBe('building_cart');
    expect(reply || '').toMatch(/consulta|no anot/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it('nada más en medio del pedido no cierra la compra', async () => {
    const soup = products.find((item: { name: string }) => /^sopa de ajiaco$/i.test(item.name));
    const drink = products.find((item: { name: string }) => /^limonada natural$/i.test(item.name));
    const h = harness(products, false);
    delivery(h);
    await h.sendQueued('Quiero una sopa de ajiaco nada más de cilantro y una limonada natural');
    expect(h.cartRows()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: soup.id, qty: 1 }),
      expect.objectContaining({ id: drink.id, qty: 1 }),
    ]));
    expect(h.conv.state).toBe('building_cart');
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it('calle 80 nada más no pide la dirección de cierre', async () => {
    const h = harness(products, false);
    delivery(h);
    await h.sendQueued('Calle 80 nada mas');
    expect(h.cartRows()).toEqual([]);
    expect(h.conv.state).not.toBe('awaiting_payment');
    expect(h.conv.state).not.toBe('awaiting_final_confirm');
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it('con dirección y pago sigue a la confirmación sin crear la orden', async () => {
    const drink = products.find((item: { name: string }) => /^limonada natural$/i.test(item.name));
    const h = harness(products, false);
    h.service.ordersService.create = jest.fn();
    Object.assign(h.conv.sessionData, {
      orderType: 'delivery',
      fulfillmentChosen: true,
      address: 'Calle 10 20 30',
      addressConfirmed: true,
      deliveryFeeCalculated: 2000,
      phoneConfirmed: true,
      contactPhone: h.conv.phoneE164,
      paymentMethod: 'cash',
    });
    const reply = await h.sendQueued('Quiero dos limonadas naturales. Eso es todo por ahora, gracias');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: drink.id, qty: 2 })]);
    expect(h.conv.state).toBe('awaiting_final_confirm');
    expect(reply || '').toMatch(/confirmar/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('Pedido de pollo con nota de cocina', () => {
  const phrase = 'quiero dos pollos bien fritos,  con las arepas fritas y arto aji por favor';

  it.each([false, true])('dos pollos bien fritos con arepas y arto ají (agent %s)', async (agent) => {
    const h = harness(products, agent);
    h.service.ordersService.create = jest.fn();
    const reply = await h.sendQueued(phrase);
    expect(reply || '').not.toMatch(/no manejamos/i);
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 1,
        qty: 2,
        attrs: expect.arrayContaining(['Arepas:Fritas']),
        note: expect.stringMatching(/bien frito/i),
      }),
    ]);
    expect(h.cartRows()[0].note).toMatch(/(?:harto|arto).*aj[ií]/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each([false, true])('la misma frase en otra carta deja el pollo y el ají (agent %s)', async (agent) => {
    const chicken = {
      id: 501, code: 501, name: 'Pollo Frito', categoryName: 'Pollos', price: 36000,
      availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Arepas', options: ['Blancas', 'Fritas'] }],
    };
    const soup = {
      id: 502, code: 502, name: 'Sopa De Tomate', categoryName: 'Sopas', price: 9000,
      availableNow: true, hasAttributes: false, attributes: [],
    };
    const h = harness([chicken, soup] as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    const reply = await h.sendQueued(phrase);
    expect(reply || '').not.toMatch(/no manejamos|no tenemos/i);
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 501,
        qty: 2,
        attrs: expect.arrayContaining(['Arepas:Fritas']),
        note: expect.stringMatching(/bien frito/i),
      }),
    ]);
    expect(h.cartRows()[0].note).toMatch(/(?:harto|arto).*aj[ií]/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('Consulta abierta y carrito en otro orden', () => {
  const fictional = [
    { id: 42001, code: 42001, name: 'Pizza De Setas', description: 'Incluye setas y queso', price: 17000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 42002, code: 42002, name: 'Bowl De Quinoa', description: 'Incluye quinoa y verduras', price: 19000, availableNow: true, hasAttributes: false, attributes: [] },
  ];
  const cases = () => {
    const drink = products.find((item: { name: string }) => /^limonada natural$/i.test(item.name));
    const soup = products.find((item: { name: string }) => /^sopa de ajiaco$/i.test(item.name));
    return [
      { kind: 'carta', menu: fictional, lines: fictional },
      { kind: 'ppp', menu: products, lines: [drink, soup] },
    ];
  };

  it.each(cases().flatMap((item) => [false, true].flatMap((agent) => ['awaiting_phone', 'awaiting_payment'].flatMap((state) =>
    ['Quita la 2', 'Quita la segunda', 'esa no'].map((text) => ({ ...item, agent, state, text }))))))(
    '$kind $state $text no mueve el carrito (agent $agent)',
    async ({ menu, lines, agent, state, text }) => {
      const h = harness(menu as typeof products, agent);
      h.service.ordersService.create = jest.fn();
      h.conv.state = state;
      h.conv.sessionData.orderType = 'delivery';
      h.conv.sessionData.address = 'Calle 21 #34-56';
      h.conv.sessionData.addressConfirmed = true;
      h.conv.sessionData.deliveryFeeCalculated = 2000;
      h.conv.sessionData.phoneConfirmed = state === 'awaiting_payment';
      h.conv.sessionData.paymentMethod = state === 'awaiting_payment' ? 'cash' : undefined;
      h.conv.sessionData.cart = lines.map((line) => ({
        productId: line.id, name: line.name, code: line.code, unitPrice: line.price, quantity: 1, attributes: [],
      }));
      h.conv.sessionData.pendingCompositionAsk = {
        originalText: '¿Qué trae ese plato?',
        resumeState: state,
        productIds: [lines[1].id, lines[0].id],
      };
      const before = structuredClone(h.conv.sessionData);
      const reply = await h.sendQueued(text);
      expect(h.cartRows()).toEqual(before.cart.map((line) => expect.objectContaining({ id: line.productId, qty: line.quantity })));
      expect(h.conv.state).toBe(state);
      expect(h.conv.sessionData.pendingCompositionAsk).toBeDefined();
      expect(reply || '').toMatch(/nombre|otra lista|no est[aá]|cu[aá]l/i);
      expect(reply || '').not.toMatch(/quit[eé]|agregu[eé]|listo ✅/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    },
  );

  it.each(cases().flatMap((item) => [false, true].map((agent) => ({ ...item, agent }))))(
    '$kind la segunda consulta el plato de la lista, no la fila del carrito (agent $agent)',
    async ({ menu, lines, agent }) => {
      const h = harness(menu as typeof products, agent);
      h.service.ordersService.create = jest.fn();
      h.conv.state = 'awaiting_phone';
      h.conv.sessionData.orderType = 'delivery';
      h.conv.sessionData.address = 'Calle 21 #34-56';
      h.conv.sessionData.addressConfirmed = true;
      h.conv.sessionData.deliveryFeeCalculated = 2000;
      h.conv.sessionData.cart = lines.map((line) => ({
        productId: line.id, name: line.name, code: line.code, unitPrice: line.price, quantity: 1, attributes: [],
      }));
      h.conv.sessionData.pendingCompositionAsk = {
        originalText: '¿Qué trae ese plato?',
        resumeState: 'awaiting_phone',
        productIds: [lines[1].id, lines[0].id],
      };
      const reply = await h.sendQueued('la segunda');
      expect(h.cartRows().map((row) => row.id)).toEqual(lines.map((line) => line.id));
      expect(h.conv.state).toBe('awaiting_phone');
      expect(h.conv.sessionData.pendingCompositionAsk).toBeUndefined();
      expect(reply || '').toMatch(new RegExp(lines[0].name.split(/\s+/)[0], 'i'));
      expect(reply || '').toMatch(/tel[eé]fono|n[uú]mero/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])('la opción retirada no salta a otra fila (agent %s)', async (agent) => {
    const h = harness(fictional as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    h.conv.state = 'awaiting_payment';
    h.conv.sessionData.orderType = 'delivery';
    h.conv.sessionData.address = 'Calle 21 #34-56';
    h.conv.sessionData.addressConfirmed = true;
    h.conv.sessionData.deliveryFeeCalculated = 2000;
    h.conv.sessionData.phoneConfirmed = true;
    h.conv.sessionData.paymentMethod = 'transfer';
    h.conv.sessionData.cart = fictional.map((line) => ({
      productId: line.id, name: line.name, code: line.code, unitPrice: line.price, quantity: 1, attributes: [],
    }));
    h.conv.sessionData.pendingCompositionAsk = {
      originalText: '¿Qué trae ese plato?',
      resumeState: 'awaiting_payment',
      productIds: [fictional[0].id, 99999],
    };
    const reply = await h.sendQueued('2');
    expect(h.cartRows().map((row) => row.id)).toEqual([42001, 42002]);
    expect(h.conv.state).toBe('awaiting_payment');
    expect(h.conv.sessionData.paymentMethod).toBe('transfer');
    expect(h.conv.sessionData.pendingCompositionAsk).toBeDefined();
    expect(reply || '').toMatch(/no est[aá] en la consulta/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each([false, true])('una pregunta de precio no quita ni cobra (agent %s)', async (agent) => {
    const h = harness(fictional as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    h.conv.state = 'awaiting_payment';
    h.conv.sessionData.orderType = 'delivery';
    h.conv.sessionData.address = 'Calle 21 #34-56';
    h.conv.sessionData.addressConfirmed = true;
    h.conv.sessionData.deliveryFeeCalculated = 2000;
    h.conv.sessionData.phoneConfirmed = true;
    h.conv.sessionData.cart = fictional.map((line) => ({
      productId: line.id, name: line.name, code: line.code, unitPrice: line.price, quantity: 1, attributes: [],
    }));
    h.conv.sessionData.pendingCompositionAsk = {
      originalText: '¿Qué trae ese plato?',
      resumeState: 'awaiting_payment',
      productIds: [fictional[1].id, fictional[0].id],
    };
    const reply = await h.sendQueued('¿Cuánto suma todo?');
    expect(h.cartRows().map((row) => row.id)).toEqual([42001, 42002]);
    expect(h.conv.state).toBe('awaiting_payment');
    expect(reply || '').toMatch(/36[.,]000|c[oó]mo pagas|m[eé]todo de pago/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});


describe('Preferencias de pollo — variantes y consultas no compran',()=>{
 for(const agent of [false,true])for(const phrase of [
  'Quiero dos pollos muy bien fritos con arepas fritas y arto aji',
  'Me regalas dos pollos bien fritos con las arepas fritas y mucho aji por favor',
  'Dos pollos fritos con arepas fritas, sin ensalada y bastante aji',
 ])it(phrase+' agente='+agent,async()=>{
  const h=harness(products,agent);h.service.ordersService.create=jest.fn();
  const reply=await h.sendQueued(phrase);
  expect(h.cartRows()).toEqual([expect.objectContaining({id:1,qty:2,attrs:expect.arrayContaining(['Arepas:Fritas']),note:expect.stringMatching(/aj[ií]/i)})]);
  if(/bien fritos/i.test(phrase))expect(h.cartRows()[0].note).toMatch(/bien frit/i);
  if(/sin ensalada/i.test(phrase))expect(h.cartRows()[0].note).toMatch(/sin ensalada/i);
  expect(reply||'').not.toMatch(/no manejamos|no tenemos/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it.each([false,true])('hipótesis de precio se responde sin compra agente=%s',async(agent)=>{
  const fixture=[{id:43101,code:43101,name:'Limonada De Hierbabuena',description:'Agua, limón y hierbabuena',price:6800,availableNow:true,hasAttributes:false,attributes:[]}];
  const h=harness(fixture as typeof products,agent);h.service.ordersService.create=jest.fn();
  const reply=await h.sendQueued('Si pido una limonada de hierbabuena, cuánto cuesta?');
  expect(reply||'').toContain('6.800');expect(h.cartRows()).toEqual([]);expect(h.conv.state).toBe('building_cart');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});


describe('Contrato de turno — replays capturados y consulta intercalada',()=>{
 it.each(['office','narrative'])('conserva propuesta, etapas y resultado del replay %s',async(kind)=>{
  const filename=kind==='office'?'whatsapp-recorded-office-output.json':'whatsapp-recorded-narrative-output.json';
  const recorded=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/'+filename),'utf8'));
  const menu=kind==='office'?JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-alternate-menu.json'),'utf8')):products;
  const h=harness(menu,true);h.service.ordersService.create=jest.fn();
  h.agent.runTurn.mockResolvedValue(recorded.agentResult);
  await h.sendQueued(recorded.userMessage);
  const decisions=h.service.turnTelemetry.getRecentDecisions(1);expect(decisions).toHaveLength(1);
  const decision=decisions[0];expect(decision.failed).toBe(false);
  expect(decision.stages.map(stage=>stage.stage)).toEqual(['proposed','catalog_validated','reconciled','prepared']);
  const wanted=recorded.agentResult.actions.addItems.map(item=>({productId:item.productId,quantity:item.quantity})).sort((a,b)=>a.productId-b.productId);
  expect(decision.observedUnitDelta).toEqual(wanted);
  expect(decision.unitComparison.status).toBe('matches');
  expect(h.cartRows().map(row=>({productId:row.id,quantity:row.qty})).sort((a,b)=>a.productId-b.productId)).toEqual(wanted);
  const previous=structuredClone(h.conv.sessionData.cart);const modelCalls=h.agent.runTurn.mock.calls.length;
  const reply=await h.sendQueued(kind==='office'?'Cuánto cuesta cada bowl?':'Cuánto cuesta el churrasco?');
  const inquiry=h.service.turnTelemetry.getRecentDecisions(1)[0];
  expect(inquiry.before.cart).toEqual(inquiry.after.cart);expect(inquiry.observedUnitDelta).toEqual([]);
  expect(inquiry.stages).toEqual([]);expect(h.conv.sessionData.cart).toEqual(previous);
  expect(inquiry.inquiries).toEqual([{kind:'price',productIds:[kind==='office'?501:17]}]);
  expect(h.agent.runTurn.mock.calls.length).toBe(modelCalls);expect(reply||'').toMatch(/18.700|38.000/);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it('un diagnóstico roto no rompe una respuesta válida',async()=>{
  const h=harness(products,false);h.service.turnTelemetry.recordDecision=()=>{throw Error('diagnostic failed');};
  const reply=await h.sendQueued('Quiero una limonada natural');
  expect(h.cartRows()).toHaveLength(1);expect(reply||'').toMatch(/Limonada Natural/i);
 });
 it('registra el error del turno sin sustituirlo',async()=>{
  const h=harness(products,false);const error=new Error('original turn failure');
  h.service.handleIncomingTurn=async(_msg,turn)=>{turn.conv=h.conv;const {beginTurnDecision}=require('./whatsapp-turn-decision');turn.decision=beginTurnDecision(h.conv.state,h.conv.sessionData);throw error;};
  await expect(h.sendQueued('mensaje')).rejects.toBe(error);
  expect(h.service.turnTelemetry.getRecentDecisions(1)[0].failed).toBe(true);
 });
});


describe('Referencia de precio por clase de catálogo',()=>{
 const menu=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-alternate-menu.json'),'utf8'));
 for(const agent of [false,true])for(const question of ['La bebida, cuánto cuesta?','Cuánto vale el refresco?','Qué precio tienen las bebidas?'])it(question+' agent='+agent,async()=>{
  const h=harness(menu,agent);h.service.ordersService.create=jest.fn();
  h.conv.sessionData.cart=menu.filter(p=>[502,503].includes(p.id)).map(p=>({productId:p.id,name:p.name,code:p.code,unitPrice:p.price,quantity:p.id===502?2:1,attributes:[]}));
  const before=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued(question);
  expect(reply||'').toContain('6.800');expect(reply||'').not.toMatch(/cu[aá]l producto/i);
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(h.service.turnTelemetry.getRecentDecisions(1)[0].inquiries).toEqual([{kind:'price',productIds:[503]}]);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it.each([false,true])('dos bebidas cotizan ambas sin incluir el combo ni elegir la última agent=%s',async(agent)=>{
  const mixed=[...menu,{id:610,code:610,name:'Agua Mineral',price:4100,description:'Botella',attributes:[],hasAttributes:false,availableNow:true},
   {id:611,code:611,name:'Combo Vegetariano',price:25000,description:'Incluye bebida',attributes:[{attributeName:'Bebida',options:['Agua','Limonada']}],hasAttributes:true,availableNow:true}];
  const h=harness(mixed,agent);h.service.ordersService.create=jest.fn();
  h.conv.sessionData.cart=mixed.filter(p=>[503,610,611].includes(p.id)).map(p=>({productId:p.id,name:p.name,code:p.code,unitPrice:p.price,quantity:1,attributes:[]}));
  const before=structuredClone(h.conv.sessionData.cart);const reply=await h.sendQueued('Cuánto valen las bebidas?');
  expect(reply||'').toContain('6.800');expect(reply||'').toContain('4.100');
  expect(h.service.turnTelemetry.getRecentDecisions(1)[0].inquiries).toEqual([{kind:'price',productIds:[503,610]}]);
  expect(h.conv.sessionData.cart).toEqual(before);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it.each([false,true])('una consulta sin clase sigue siendo ambigua agent=%s',async(agent)=>{
  const h=harness(menu,agent);
  h.conv.sessionData.cart=menu.filter(p=>[502,503].includes(p.id)).map(p=>({productId:p.id,name:p.name,code:p.code,unitPrice:p.price,quantity:1,attributes:[]}));
  const before=structuredClone(h.conv.sessionData.cart);const reply=await h.sendQueued('Cuánto cuesta cada uno?');
  expect(reply||'').toMatch(/cu[aá]l producto/i);expect(h.conv.sessionData.cart).toEqual(before);
 });
});


describe('Herramientas de compra rechazadas — no reconstruir un pedido distinto',()=>{
 const menu=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-alternate-menu.json'),'utf8'));
 const scenario=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-contract-independent-office-1410.json'),'utf8'))[0];
 for(const preexisting of [false,true])for(const error of [undefined,'exception','max_iterations'])it('rechazo total conserva carrito previo='+preexisting+' error='+error,async()=>{
  const h=harness(menu,true);h.service.ordersService.create=jest.fn();
  if(preexisting)h.conv.sessionData.cart=[{productId:503,code:503,name:menu.find(p=>p.id===503).name,unitPrice:6800,quantity:2,attributes:[],note:'sin azúcar'}];
  const before=structuredClone(h.conv.sessionData.cart);
  h.agent.runTurn.mockResolvedValue({reply:'Por ahora no manejamos cada ni pero',actions:{},toolCalls:['add_item','add_item','add_item'],error,
   purchaseAttempts:[{productId:501,accepted:false,reason:'dish_not_on_menu'},{productId:502,accepted:false,reason:'dish_not_on_menu'},{productId:502,accepted:false,reason:'dish_not_on_menu'}]});
  const reply=await h.sendQueued(scenario.messages[0].text);
  expect(h.agent.runTurn).toHaveBeenCalledTimes(1);expect(h.conv.sessionData.cart).toEqual(before);
  expect(h.conv.state).toBe('building_cart');expect(reply||'').toMatch(/necesito aclarar/i);expect(reply||'').toMatch(/Bowl Andino/);expect(reply||'').toMatch(/Wrap Vegetariano/);
  expect(reply||'').not.toMatch(/no manejamos|cada ni pero|Listo|agregu[eé]/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  expect(h.service.turnTelemetry.getRecentDecisions(1)[0].observedUnitDelta).toEqual([]);
 });
});


describe('Herramientas de compra — un rechazo seguido de éxito',()=>{
 it('conserva la compra exitosa sin bloquearla por un intento anterior',async()=>{
  const menu=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-alternate-menu.json'),'utf8'));
  const recorded=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-recorded-office-output.json'),'utf8'));
  const h=harness(menu,true);h.service.ordersService.create=jest.fn();
  h.agent.runTurn.mockResolvedValue({...recorded.agentResult,purchaseAttempts:[{productId:999999,accepted:false,reason:'purchase_rejected'},...recorded.agentResult.actions.addItems.map(item=>({productId:item.productId,accepted:true}))]});
  const reply=await h.sendQueued(recorded.userMessage);
  expect(h.cartRows().map(row=>[row.id,row.qty]).sort()).toEqual([[501,2],[503,3],[504,1]]);
  expect(reply||'').not.toMatch(/necesito aclarar/i);expect(reply||'').toContain('96.800');
  expect(h.conv.state).toBe('awaiting_payment');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});


describe('Herramientas de compra — proveedor simulado y router real',()=>{
 it('el rechazo real del catálogo no llega al fallback que perdía cantidades',async()=>{
  const menu=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-alternate-menu.json'),'utf8'));
  const source=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-contract-independent-office-1410.json'),'utf8'))[0].messages[0].text.replace('bowl andino','bowl andino con camarones').replaceAll('wrap vegetariano','wrap vegetariano con camarones');
  const h=harness(menu,true);h.service.ordersService.create=jest.fn();
  h.service.agentService=new WhatsappAgentService({getEffectiveConfig:async()=>({openaiApiKey:'offline-key',openaiModel:'gpt-4.1-2025-04-14',systemPrompt:'',localContext:{}})} as never,h.service.catalogService);
  const originalFetch=globalThis.fetch;
  const response=(message:unknown)=>({ok:true,json:async()=>({choices:[{message}]})});
  const args=[{productId:501,quantity:2},{productId:502,quantity:1,attributes:[{attributeName:'Salsa',attributeValue:'Tahini'}]},{productId:502,quantity:1,attributes:[{attributeName:'Salsa',attributeValue:'Yogur'}]}];
  const fetchMock=jest.fn().mockResolvedValueOnce(response({content:null,tool_calls:args.map((arg,index)=>({id:'offline-tool-'+index,type:'function',function:{name:'add_item',arguments:JSON.stringify(arg)}}))}))
   .mockResolvedValueOnce(response({content:'Por ahora no manejamos cada ni pero.'}));
  globalThis.fetch=fetchMock;
  try{
   const reply=await h.sendQueued(source);
   expect(fetchMock).toHaveBeenCalledTimes(2);expect(h.cartRows()).toEqual([]);
   expect(h.conv.state).toBe('building_cart');expect(reply||'').toMatch(/necesito aclarar/i);
   expect(reply||'').not.toMatch(/no manejamos|Listo/);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  }finally{globalThis.fetch=originalFetch;}
 });
});

describe('Herramientas rechazadas — prioridades de atención y consulta',()=>{
 const menu=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-alternate-menu.json'),'utf8'));
 const source=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-contract-independent-office-1410.json'),'utf8'))[0].messages[0].text;
 it.each(['human','delivery','placed'])('el rechazo no oculta la solicitud %s',async(kind)=>{
  const h=harness(menu,true);h.service.ordersService.create=jest.fn();
  h.conv.sessionData.cart=[{productId:503,code:503,name:'Limonada De Hierbabuena',unitPrice:6800,quantity:2,attributes:[],note:'sin azúcar'}];
  const before=structuredClone(h.conv.sessionData.cart);
  h.service.humanContactMessage=jest.fn().mockReturnValue('Un asesor puede ayudarte por teléfono.');
  h.service.tryHandleDeliveryEtaInquiry=jest.fn().mockResolvedValue(true);
  h.service.replyOrderProgressOrAskNumber=jest.fn().mockResolvedValue(true);
  h.agent.runTurn.mockResolvedValue({reply:'Consulta',actions:kind==='human'?{requestHuman:true}:{},
   ...(kind==='delivery'?{lookupDeliveryTime:true}:kind==='placed'?{lookupPlacedOrder:{orderNumber:17}}:{}),
   toolCalls:['add_item'],purchaseAttempts:[{productId:501,accepted:false,reason:'dish_not_on_menu'}]});
  const reply=await h.sendQueued(source);
  expect(h.agent.runTurn).toHaveBeenCalledTimes(1);expect(h.conv.sessionData.cart).toEqual(before);
  expect(reply||'').not.toMatch(/necesito aclarar/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(kind==='human')expect(h.service.humanContactMessage).toHaveBeenCalledTimes(1);
  if(kind==='delivery')expect(h.service.tryHandleDeliveryEtaInquiry).toHaveBeenCalledTimes(1);
  if(kind==='placed')expect(h.service.replyOrderProgressOrAskNumber).toHaveBeenCalledTimes(1);
 });
});


describe('Compra validada por herramientas — cantidades y opciones no se reinterpretan',()=>{
 const original=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-alternate-menu.json'),'utf8'));
 const vegetable=original;
 const pasta=original.map(p=>p.id===501?{...p,id:98001,code:98001,name:'Ensalada Campestre'}:p.id===502?{...p,id:98002,code:98002,name:'Pasta De Vegetales',attributes:[{attributeName:'Salsa',options:['Pesto','Tomate','Sin salsa']}]}:p);
 for(const [caseIndex,fixture] of [vegetable,pasta,vegetable].entries())it('reparto y dos variantes, carta '+fixture[0].name+' kitchen='+caseIndex,async()=>{
  const first=fixture[0],second=fixture[1],options=second.attributes[0].options;
  let source=fixture===vegetable?JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-contract-independent-office-1410.json'),'utf8'))[0].messages[0].text:
   `Somos cuatro en la oficina. A Elena y a Luis mándales una ${first.name} a cada uno; para mí una ${second.name} con ${options[0]} y para Marina otra ${second.name} pero con ${options[1]}. No agregues bebidas todavía.`;
  if(caseIndex===2)source=source.replace('con tahini y','con tahini sin cebolla y').replace('con yogur.','con yogur sin ensalada.');
  const h=harness(fixture,true);h.service.ordersService.create=jest.fn();
  h.service.agentService=new WhatsappAgentService({getEffectiveConfig:async()=>({openaiApiKey:'offline-key',openaiModel:'gpt-4.1-2025-04-14',systemPrompt:'',localContext:{}})} as never,h.service.catalogService);
  const response=(message:unknown)=>({ok:true,json:async()=>({choices:[{message}]})});
  const args=[{productId:first.id,quantity:2},...options.slice(0,2).map(value=>({productId:second.id,quantity:1,attributes:[{attributeName:'Salsa',attributeValue:value}]}))];
  const previousFetch=globalThis.fetch;const fetchMock=jest.fn().mockResolvedValueOnce(response({content:null,tool_calls:args.map((arg,index)=>({id:'accepted-'+index,type:'function',function:{name:'add_item',arguments:JSON.stringify(arg)}}))}))
   .mockResolvedValueOnce(response({content:'Listo, agregué tu pedido.'}));globalThis.fetch=fetchMock;
  try{
   const reply=await h.sendQueued(source);expect(fetchMock).toHaveBeenCalledTimes(2);
   expect(h.cartRows()).toEqual([
    expect.objectContaining({id:first.id,qty:2}),
    expect.objectContaining({id:second.id,qty:1,attrs:['Salsa:'+options[0]]}),
    expect.objectContaining({id:second.id,qty:1,attrs:['Salsa:'+options[1]]})]);
   expect(h.cartRows()[1].note||'').not.toContain(options[1].toLowerCase());
   expect(h.cartRows()[2].note||'').not.toContain(options[0].toLowerCase());
   if(caseIndex===2){expect(h.cartRows()[1].note||'').toMatch(/sin cebolla/i);expect(h.cartRows()[1].note||'').not.toMatch(/sin ensalada/i);expect(h.cartRows()[2].note||'').toMatch(/sin ensalada/i);expect(h.cartRows()[2].note||'').not.toMatch(/sin cebolla/i);}
   expect(reply||'').toContain(options[0]);expect(reply||'').toContain(options[1]);
   if(caseIndex===2){expect((reply||'').match(/sin cebolla/gi)).toHaveLength(1);expect((reply||'').match(/sin ensalada/gi)).toHaveLength(1);}
   expect(reply||'').not.toMatch(/no manejamos|no tenemos|necesito aclarar/i);expect(h.conv.state).toBe('building_cart');
   const decision=h.service.turnTelemetry.getRecentDecisions(1)[0];expect(decision.unitComparison.status).toBe('matches');
   expect(decision.stages.find(stage=>stage.stage==='prepared').diagnostics.every(d=>d.code==='validated_tool_purchase_preserved')).toBe(true);
   const before=structuredClone(h.conv.sessionData.cart);const total=await h.sendQueued('Cuánto vale todo?');
   expect(total||'').toContain('67.200');expect(h.conv.sessionData.cart).toEqual(before);expect(fetchMock).toHaveBeenCalledTimes(2);
   expect(h.service.ordersService.create).not.toHaveBeenCalled();
  }finally{globalThis.fetch=previousFetch;}
 });
});


describe('Consulta agregada de carrito — preámbulo y referencia',()=>{
 it.each(['¿Cuánto vale todo eso?','Antes de seguir, cuánto vale todo eso?','Una pregunta, cuánto cuesta todo esto?','Porfa, antes de confirmar, cuánto suma el pedido completo?','Disculpa, cuánto sería todo el pedido por favor?'])('reconoce total sin depender del catálogo: %s',text=>expect(isCartChargeQuestion(text)).toBe(true));
 it.each(['Si agrego un wrap cuánto cuesta todo?','Agrega una limonada y cuánto cuesta todo?','Cuánto cuesta el combo?','Antes de seguir, cuánto cuesta cada wrap?','Cuánto vale la bebida?','Un bowl y dos wraps para todos'])('no consume otra intención como total: %s',text=>expect(isCartChargeQuestion(text)).toBe(false));
 for(const state of ['building_cart','awaiting_payment'])for(const text of ['Antes de seguir, cuánto vale todo eso?','Una pregunta, cuánto cuesta todo esto?'])it(state+' '+text,async()=>{
  const menu=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-alternate-menu.json'),'utf8'));const h=harness(menu,true);h.service.ordersService.create=jest.fn();
  h.conv.state=state;h.conv.sessionData.cart=[{productId:501,code:501,name:menu[0].name,unitPrice:18700,quantity:2,attributes:[]},{productId:502,code:502,name:menu[1].name,unitPrice:14900,quantity:2,attributes:[{attributeName:'Salsa',attributeValue:'Tahini'}]}];
  const before=structuredClone(h.conv.sessionData.cart);const reply=await h.sendQueued(text);
  expect(reply||'').toContain('67.200');expect(reply||'').not.toMatch(/cu[aá]l producto/i);
  expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.state).toBe(state);  expect(h.agent.runTurn).not.toHaveBeenCalled();expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});

describe('Corrección durante el dato pendiente — guarda el cambio y sigue', () => {
  const fictional = [
    { id: 43001, code: 43001, name: 'Bowl De Quinoa', price: 19000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 43002, code: 43002, name: 'Limonada De Menta', price: 6000, availableNow: true, hasAttributes: false, attributes: [] },
  ];
  const cases = () => {
    const drink = products.find((item: { name: string }) => /^limonada natural$/i.test(item.name));
    const soup = products.find((item: { name: string }) => /^sopa de ajiaco$/i.test(item.name));
    return [
      { kind: 'carta', menu: fictional, keep: fictional[0], drop: fictional[1] },
      { kind: 'ppp', menu: products, keep: soup, drop: drink },
    ];
  };

  it.each(cases().flatMap((item) => [false, true].flatMap((agent) => ['awaiting_phone', 'awaiting_payment'].map((state) => ({ ...item, agent, state })))))(
    '$kind $state cambia la dirección y no salta el dato (agent $agent)',
    async ({ menu, keep, drop, agent, state }) => {
      const h = harness(menu as typeof products, agent);
      h.service.ordersService.create = jest.fn();
      h.conv.customerName = 'Carolina';
      h.conv.state = state;
      h.conv.sessionData.orderType = 'delivery';
      h.conv.sessionData.fulfillmentChosen = true;
      h.conv.sessionData.address = 'Calle 9 20 30';
      h.conv.sessionData.addressConfirmed = true;
      h.conv.sessionData.deliveryFeeCalculated = 2000;
      h.conv.sessionData.phoneConfirmed = state !== 'awaiting_phone';
      h.conv.sessionData.contactPhone = state === 'awaiting_phone' ? undefined : h.conv.phoneE164;
      h.conv.sessionData.cart = [keep, drop].map((line) => ({
        productId: line.id, name: line.name, code: line.code, unitPrice: line.price, quantity: 1, attributes: [],
      }));
      const reply = await h.sendQueued('Cambia la dirección a Calle 80 #12-34');
      expect(h.cartRows().map((row) => row.id)).toEqual([keep.id, drop.id]);
      expect(h.conv.sessionData.address || '').toMatch(/80/);
      expect(h.conv.sessionData.address || '').toMatch(/12/);
      expect(h.conv.state).toBe(state);
      expect(h.conv.sessionData.phoneConfirmed).toBe(state !== 'awaiting_phone');
      expect(h.conv.sessionData.paymentMethod).toBeUndefined();
      expect(reply || '').toMatch(/80/);
      expect(reply || '').toMatch(state === 'awaiting_phone' ? /tel[eé]fono|n[uú]mero/i : /m[eé]todo de pago|c[oó]mo pagas/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      await h.sendQueued(state === 'awaiting_phone' ? '3001234567' : 'Efectivo');
      expect(h.conv.state).not.toBe(state);
      expect(h.cartRows().map((row) => row.id)).toEqual([keep.id, drop.id]);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    },
  );

  it.each(cases().flatMap((item) => [false, true].flatMap((agent) => ['awaiting_phone', 'awaiting_payment'].map((state) => ({ ...item, agent, state })))))(
    '$kind $state quita un plato y sigue en el mismo dato (agent $agent)',
    async ({ menu, keep, drop, agent, state }) => {
      const h = harness(menu as typeof products, agent);
      h.service.ordersService.create = jest.fn();
      h.conv.customerName = 'Carolina';
      h.conv.state = state;
      h.conv.sessionData.orderType = 'delivery';
      h.conv.sessionData.fulfillmentChosen = true;
      h.conv.sessionData.address = 'Calle 9 20 30';
      h.conv.sessionData.addressConfirmed = true;
      h.conv.sessionData.deliveryFeeCalculated = 2000;
      h.conv.sessionData.phoneConfirmed = state !== 'awaiting_phone';
      h.conv.sessionData.contactPhone = state === 'awaiting_phone' ? undefined : h.conv.phoneE164;
      h.conv.sessionData.cart = [keep, drop].map((line) => ({
        productId: line.id, name: line.name, code: line.code, unitPrice: line.price, quantity: 1, attributes: [],
      }));
      const reply = await h.sendQueued(`Quita ${drop.name}`);
      expect(h.cartRows().map((row) => row.id)).toEqual([keep.id]);
      expect(h.conv.state).toBe(state);
      expect(h.conv.sessionData.address).toBe('Calle 9 20 30');
      expect(h.conv.sessionData.phoneConfirmed).toBe(state !== 'awaiting_phone');
      expect(reply || '').toMatch(new RegExp(keep.name.split(/\s+/)[0], 'i'));
      expect(reply || '').toMatch(state === 'awaiting_phone' ? /tel[eé]fono|n[uú]mero/i : /m[eé]todo de pago|c[oó]mo pagas/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    },
  );
});

describe('Mismo plato con notas distintas', () => {
  const fictional = [{ id: 44001, code: 44001, name: 'Sopa De Tomate', price: 9000, availableNow: true, hasAttributes: false, attributes: [] }];
  const menus = () => {
    const soup = products.find((item: { name: string }) => /^sopa de ajiaco$/i.test(item.name));
    return [
      { kind: 'ppp', menu: products, id: soup.id, text: 'Quiero dos sopas de ajiaco, una sin cebolla y la otra sin ensalada' },
      { kind: 'carta', menu: fictional, id: 44001, text: 'Quiero dos sopas de tomate, una sin cebolla y la otra sin ensalada' },
    ];
  };

  it.each(menus().flatMap((item) => [false, true].map((agent) => ({ ...item, agent }))))(
    '$kind deja dos líneas con notas separadas (agent $agent)',
    async ({ menu, id, text, agent }) => {
      const h = harness(menu as typeof products, agent);
      h.service.ordersService.create = jest.fn();
      const reply = await h.sendQueued(text);
      const rows = h.cartRows().filter((row) => row.id === id);
      expect(rows).toHaveLength(2);
      expect(rows.map((row) => row.qty).sort()).toEqual([1, 1]);
      const notes = rows.map((row) => row.note || '').join('\n');
      expect(notes).toMatch(/sin cebolla/i);
      expect(notes).toMatch(/sin ensalada/i);
      expect(rows.filter((row) => /sin cebolla/i.test(row.note || '') && /sin ensalada/i.test(row.note || ''))).toHaveLength(0);
      expect(reply || '').toMatch(/sin cebolla/i);
      expect(reply || '').toMatch(/sin ensalada/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    },
  );

  it.each(menus())('el lote aceptado conserva las dos notas aunque la opción sea la misma: $kind', async ({ menu, id }) => {
    const h = harness(menu as typeof products, true);
    h.service.ordersService.create = jest.fn();
    h.agent.runTurn.mockResolvedValue({
      reply: 'Listo',
      actions: { addItems: [
        { productId: id, quantity: 1, note: 'sin cebolla' },
        { productId: id, quantity: 1, note: 'sin ensalada' },
      ] },
      toolCalls: ['add_item', 'add_item'],
      purchaseAttempts: [{ productId: id, accepted: true }, { productId: id, accepted: true }],
    });
    const reply = await h.sendQueued('Hola! somos varios en la oficina: para Lina van 2 bowls andinos, para Oscar un trio de wraps y para la reunion tres limonadas de hierbabuena. Eso es todo por ahora, gracias.');
    const rows = h.cartRows().filter((row) => row.id === id);
    expect(rows).toEqual([
      expect.objectContaining({ qty: 1, note: expect.stringMatching(/sin cebolla/i) }),
      expect.objectContaining({ qty: 1, note: expect.stringMatching(/sin ensalada/i) }),
    ]);
    expect(rows[0].note || '').not.toMatch(/sin ensalada/i);
    expect(rows[1].note || '').not.toMatch(/sin cebolla/i);
    expect(reply || '').not.toMatch(/necesito aclarar|no manejamos/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});


describe('Pedido mixto — condición de disponibilidad no bloquea la compra',()=>{
 it('conserva platos reconocidos, informa el ausente y aplica una nota solo al wrap',async()=>{
  const menu=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-alternate-menu.json'),'utf8'));
  const scenario=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-next-mixed-orders-1510.json'),'utf8'))[0];
  const h=harness(menu,true);h.service.ordersService.create=jest.fn();
  h.service.agentService=new WhatsappAgentService({getEffectiveConfig:async()=>({openaiApiKey:'offline-key',openaiModel:'gpt-4.1-2025-04-14',systemPrompt:'',localContext:{}})} as never,h.service.catalogService);
  const response=(message:unknown)=>({ok:true,json:async()=>({choices:[{message}]})});
  const args=[{productId:501,quantity:2},{productId:502,quantity:1,attributes:[{attributeName:'Salsa',attributeValue:'Yogur'}]}];
  const original=globalThis.fetch;const fetchMock=jest.fn().mockResolvedValueOnce(response({content:null,tool_calls:args.map((arg,index)=>({id:'mixed-'+index,type:'function',function:{name:'add_item',arguments:JSON.stringify(arg)}}))}))
   .mockResolvedValueOnce(response({content:'No tenemos brownie. Agregué los platos disponibles.'}))
   .mockResolvedValueOnce(response({content:null,tool_calls:[{id:'scoped-note',type:'function',function:{name:'update_item',arguments:JSON.stringify({productId:502,cartLineIndex:1,note:'sin cebolla'})}}]}))
   .mockResolvedValueOnce(response({content:'Listo, el wrap sin cebolla; los bowls siguen normales.'}));globalThis.fetch=fetchMock;
  try{
   const reply=await h.sendQueued(scenario.messages[0].text);expect(fetchMock).toHaveBeenCalledTimes(2);
   expect(h.cartRows()).toEqual([expect.objectContaining({id:501,qty:2}),expect.objectContaining({id:502,qty:1,attrs:['Salsa:Yogur']})]);
   expect(reply||'').toMatch(/no tenemos brownie/i);expect(h.conv.state).toBe('building_cart');
   await h.sendQueued(scenario.messages[1].text);expect(fetchMock).toHaveBeenCalledTimes(4);
   expect(h.cartRows().find(row=>row.id===501)).toEqual(expect.objectContaining({qty:2}));
   expect(h.cartRows().find(row=>row.id===501)?.note||'').not.toMatch(/cebolla/i);
   expect(h.cartRows().find(row=>row.id===502)).toEqual(expect.objectContaining({qty:1,attrs:['Salsa:Yogur'],note:expect.stringMatching(/sin cebolla/i)}));
   expect(h.service.ordersService.create).not.toHaveBeenCalled();
  }finally{globalThis.fetch=original;}
 });
});


describe('Reparto entre destinatarios conserva el pedido completo',()=>{
 it.each([
  {kind:'vegetal',menu:JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-alternate-menu.json'),'utf8')),soup:505,other:501,text:'Para Camila y Diego, una sopa de zapallo para cada uno. A la de Diego no le pongan cilantro; la de Camila normal. Además un bowl andino.'},
  {kind:'otra carta',menu:[{id:88001,code:88001,name:'Crema De Calabaza',price:8000,availableNow:true,hasAttributes:false,attributes:[]},{id:88002,code:88002,name:'Ensalada Campestre',price:13000,availableNow:true,hasAttributes:false,attributes:[]}],soup:88001,other:88002,text:'Para Laura y Pablo, una crema de calabaza para cada uno. A la de Pablo no le pongan cilantro; la de Laura normal. Además una ensalada campestre.'}
 ])('$kind no inventa dirección ni rechaza el último plato',async({menu,soup,other,text})=>{
  const h=harness(menu,true);h.conv.sessionData.orderType='delivery';h.service.ordersService.create=jest.fn();
  h.service.agentService=new WhatsappAgentService({getEffectiveConfig:async()=>({openaiApiKey:'offline-key',openaiModel:'gpt-4.1-2025-04-14',systemPrompt:'',localContext:{}})} as never,h.service.catalogService);
  const response=(message:unknown)=>({ok:true,json:async()=>({choices:[{message}]})});
  const args=[{productId:soup,quantity:1},{productId:soup,quantity:1,note:'sin cilantro'},{productId:other,quantity:1}];
  const original=globalThis.fetch;const fetchMock=jest.fn().mockResolvedValueOnce(response({content:null,tool_calls:args.map((arg,index)=>({id:'recipient-'+index,type:'function',function:{name:'add_item',arguments:JSON.stringify(arg)}}))})).mockResolvedValueOnce(response({content:'Listo, una normal y otra sin cilantro, más el otro plato.'}));globalThis.fetch=fetchMock;
  try{
   const reply=await h.sendQueued(text);
   expect(h.conv.sessionData.address).toBeUndefined();
   expect(h.conv.customerName).toBe('Wilmer');
   const rows=h.cartRows();expect(rows).toHaveLength(3);
   expect(rows.filter(row=>row.id===soup).map(row=>row.qty)).toEqual([1,1]);
   expect(rows.filter(row=>row.id===soup&&/cilantro/i.test(row.note||''))).toHaveLength(1);
   expect(rows.find(row=>row.id===other)).toEqual(expect.objectContaining({qty:1}));
   expect(rows.find(row=>row.id===other)?.note||'').not.toMatch(/cilantro/i);
   expect(reply||'').not.toMatch(/no tenemos|no manejamos|Camila|Diego|Laura|Pablo/i);
   expect(h.service.ordersService.create).not.toHaveBeenCalled();
  }finally{globalThis.fetch=original;}
 });
});


describe('Destino frente a reparto de comensales',()=>{
 it.each([
  'Una sopa para cada uno',
  'Dos bowls para cada una. Además un wrap vegetariano',
  'Una crema por persona',
  'Un almuerzo para cada quien',
  'Una sopa de zapallo para cada uno. A la de Ana no le pongan cilantro',
  'Una limonada por comensal',
  'Una sopa para cada uno. A la  de Ana no le pongan cilantro',
  'Una sopa para cada uno. En la de Luis sin cebolla',
 ])('no trata el reparto como domicilio: %s',text=>{
  const h=harness();expect(h.service.extractDeliveryTail(text)).toBeNull();
 });
 it.each([
  ['Una sopa para cada uno, para la calle 8 20 30','calle 8 20 30'],
  ['Una sopa de ajiaco para el hospital de Kennedy','hospital de Kennedy'],
  ['Dos bowls para la carrera 15 45 20','carrera 15 45 20'],
 ])('conserva destino explícito: %s',(text,address)=>{
  const h=harness();expect(h.service.extractDeliveryTail(text)?.toLowerCase()).toContain(address.toLowerCase());
 });
});


describe('Paquetes y cantidades absolutas con notas conservadas',()=>{
 const fictional=[{id:89001,code:89001,name:'Duo De Onigiris',price:21000,availableNow:true,hasAttributes:false,attributes:[]},{id:89002,code:89002,name:'Te De Jazmin',price:5000,availableNow:true,hasAttributes:false,attributes:[]}];
 const menus=[
  {kind:'vegetal',menu:JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-alternate-menu.json'),'utf8')),pack:504,drink:503,order:'Para compartir, un trío de wraps y dos limonadas de hierbabuena, ambas sin azúcar.',query:'limonadas'},
  {kind:'japonesa',menu:fictional,pack:89001,drink:89002,order:'Un duo de onigiris y dos te de jazmin, ambos sin azúcar.',query:'te de jazmin'},
  {kind:'ppp',menu:products,pack:71,drink:37,order:'Un duo de tacos con colombiana y dos limonadas naturales, ambas sin azúcar.',query:'limonadas'}
 ];
 it.each(menus.flatMap(menu=>['Mejor tres {drink} en total, no tres más; el paquete déjalo.','Que sean 3 {drink} en total; conserva lo demás.'].map(change=>({...menu,change:change.replace('{drink}',menu.query)}))))('$kind: $change',async({kind,menu,pack,drink,order,change})=>{
  const h=harness(menu,true);h.service.ordersService.create=jest.fn();
  h.service.agentService=new WhatsappAgentService({getEffectiveConfig:async()=>({openaiApiKey:'offline-key',openaiModel:'gpt-4.1-2025-04-14',systemPrompt:'',localContext:{}})} as never,h.service.catalogService);
  const response=(message:unknown)=>({ok:true,json:async()=>({choices:[{message}]})});
  const args=[{productId:pack,quantity:1},{productId:drink,quantity:2,note:'sin azúcar'}];
  const original=globalThis.fetch;const fetchMock=jest.fn().mockResolvedValueOnce(response({content:null,tool_calls:args.map((arg,index)=>({id:'pack-'+index,type:'function',function:{name:'add_item',arguments:JSON.stringify(arg)}}))})).mockResolvedValueOnce(response({content:'Listo, un paquete y dos bebidas sin azúcar.'}));globalThis.fetch=fetchMock;
  try{
   await h.sendQueued(order);expect(h.cartRows().map(row=>[row.id,row.qty]).sort((a,b)=>a[0]-b[0])).toEqual([[pack,1],[drink,2]].sort((a,b)=>a[0]-b[0]));
   expect(h.cartRows().find(row=>row.id===drink)?.note||'').toMatch(/sin az[uú]car/i);
   fetchMock.mockResolvedValueOnce(response({content:null,tool_calls:[{id:'absolute',type:'function',function:{name:'update_item',arguments:JSON.stringify({productId:drink,cartLineIndex:h.cartRows().findIndex(row=>row.id===drink),quantity:3})}}]})).mockResolvedValueOnce(response({content:'Listo, tres bebidas en total; el paquete sigue igual.'}));
   const reply=await h.sendQueued(change);
   expect(h.cartRows().map(row=>[row.id,row.qty]).sort((a,b)=>a[0]-b[0])).toEqual([[pack,1],[drink,3]].sort((a,b)=>a[0]-b[0]));
   expect(h.cartRows().find(row=>row.id===drink)?.note||'').toMatch(/sin az[uú]car/i);
   expect(h.cartRows().find(row=>row.id===pack)?.note||'').not.toMatch(/az[uú]car/i);
   expect(reply||'').not.toMatch(/no manejamos|no tenemos|no pude/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  }finally{globalThis.fetch=original;}
 });
});


describe('Tamaño de paquete conserva ambigüedades reales',()=>{
 it.each([
  {name:'Trio De Tacos Al Pastor',query:'Un trio de tacos',other:'Duo De Tacos Al Pastor'},
  {name:'Duo De Onigiris De Salmon',query:'Un duo de onigiris',other:'Trio De Onigiris De Salmon'},
 ])('$query aclara solo si hay dos SKUs del mismo tamaño',({name,query,other})=>{
  const item=(id:number,name:string)=>({id,code:id,name,price:20000,hasAttributes:false,attributes:[],availableNow:true});
  const menu=[item(91001,name),item(91002,name),item(91003,other),item(91004,'Agua Mineral')];
  const h=harness(menu,true);const result=h.service.catalogService.resolveMultiProductOrder(query+' y un agua mineral',menu);
  expect(result.ambiguous).toHaveLength(1);expect(result.ambiguous[0].candidates.map(p=>p.id)).toEqual([91001,91002]);
  expect(result.confident.map(p=>p.product.id)).toEqual([91004]);
 });
 it.each([
  {name:'Duo De Tacos Al Pastor',query:'Un duo de tacos',other:'Trio De Tacos Al Pastor'},
  {name:'Trio De Onigiris De Salmon',query:'Un trio de onigiris',other:'Duo De Onigiris De Salmon'},
 ])('$query resuelve un único tamaño de paquete',({name,query,other})=>{
  const item=(id:number,name:string)=>({id,code:id,name,price:20000,hasAttributes:false,attributes:[],availableNow:true});
  const menu=[item(91001,name),item(91002,other),item(91004,'Agua Mineral')];const h=harness(menu,true);
  const result=h.service.catalogService.resolveMultiProductOrder(query+' y un agua mineral',menu);expect(result.ambiguous).toHaveLength(0);expect(result.confident.map(p=>p.product.id)).toEqual([91001,91004]);
 });
});


describe('Fallo técnico después de editar una línea aceptada',()=>{
 const menus=[
  {kind:'vegetal',menu:JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-alternate-menu.json'),'utf8')),edit:502,keep:501,text:'Al wrap sin cebolla; los bowls normales.'},
  {kind:'otra carta',menu:[{id:99001,code:99001,name:'Roll Vegetariano',price:18000,availableNow:true,attributes:[],hasAttributes:false},{id:99002,code:99002,name:'Bowl De Arroz',price:15000,availableNow:true,attributes:[],hasAttributes:false}],edit:99001,keep:99002,text:'Al roll sin cebolla; los bowls normales.'},
 ];
 it.each(menus.flatMap(menu=>['timeout','http500','empty','blank'].map(failure=>({...menu,failure}))))('$kind conserva el cambio y muestra el carrito ante $failure',async({menu,edit,keep,text,failure})=>{
  const h=harness(menu,true);h.service.ordersService.create=jest.fn();
  h.conv.sessionData.cart=[keep,edit].map(id=>{const p=menu.find(p=>p.id===id);return {productId:id,name:p.name,code:p.code,unitPrice:p.price,quantity:id===keep?2:1,attributes:id===502?[{attributeName:'Salsa',attributeValue:'Yogur'}]:[]};});
  h.service.agentService=new WhatsappAgentService({getEffectiveConfig:async()=>({openaiApiKey:'offline-key',openaiModel:'gpt-4.1-2025-04-14',systemPrompt:'',localContext:{}})} as never,h.service.catalogService);
  const response=(message:unknown)=>({ok:true,json:async()=>({choices:[{message}]})});
  const original=globalThis.fetch;const fetchMock=jest.fn().mockResolvedValueOnce(response({content:null,tool_calls:[{id:'accepted-edit',type:'function',function:{name:'update_item',arguments:JSON.stringify({productId:edit,cartLineIndex:1,note:'sin cebolla'})}}]}));
  if(failure==='timeout')fetchMock.mockRejectedValue(Object.assign(new Error('synthetic timeout'),{name:'TimeoutError'}));
  else if(failure==='http500')fetchMock.mockResolvedValueOnce({ok:false,status:500,json:async()=>({error:{code:'server_error'}})});
  else if(failure==='blank')fetchMock.mockResolvedValueOnce(response({content:''}));
  else fetchMock.mockResolvedValueOnce({ok:true,json:async()=>({choices:[]})});
  globalThis.fetch=fetchMock;
  try{
   const reply=await h.sendQueued(text);expect(fetchMock).toHaveBeenCalledTimes(failure==='timeout'?4:2);
   expect(h.cartRows()).toEqual([expect.objectContaining({id:keep,qty:2}),expect.objectContaining({id:edit,qty:1,note:'sin cebolla'})]);
   expect(h.cartRows()[0].note||'').not.toMatch(/cebolla/i);
   expect(reply||'').toMatch(/se guardaron|guardados/i);expect(reply||'').toMatch(/carrito/i);expect(reply||'').toMatch(/sin cebolla/i);
   expect(reply||'').not.toMatch(/no pude procesar|me lo repites|confirmado|pedido enviado/i);
   expect(h.conv.state).toBe('building_cart');expect(h.service.ordersService.create).not.toHaveBeenCalled();
  }finally{globalThis.fetch=original;}
 });
});


describe('Pedido parcialmente válido — rechazo de una línea conserva las demás',()=>{
 const vegetal=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-alternate-menu.json'),'utf8'));
 const japonesa=[{id:99101,code:99101,name:'Bowl De Arroz',price:17000,description:'Arroz y vegetales',hasAttributes:false,attributes:[],availableNow:true},{id:99102,code:99102,name:'Roll Vegetariano',price:18000,description:'Vegetales y aguacate',hasAttributes:false,attributes:[],availableNow:true},{id:99103,code:99103,name:'Te De Jazmin',price:5000,description:'Agua y té',hasAttributes:false,attributes:[],availableNow:true}];
 const cases=[
  {kind:'vegetal',menu:vegetal,keep:501,reject:502,drink:503,text:'Quiero dos bowls andinos, un wrap vegetariano con camarones y dos limonadas de hierbabuena sin azúcar.',missing:'wrap vegetariano con camarones'},
  {kind:'japonesa',menu:japonesa,keep:99101,reject:99102,drink:99103,text:'Quiero dos bowls de arroz, un roll vegetariano con camarones y dos te de jazmin sin azúcar.',missing:'roll vegetariano con camarones'},
 ];
 it.each(cases)('$kind sí permite ingredientes confirmados en la receta',async({kind,menu,keep,reject,drink,text})=>{
  const h=harness(menu,true);h.service.ordersService.create=jest.fn();
  const reply=await h.sendQueued(text.replace('camarones',kind==='vegetal'?'hummus':'aguacate'));
  expect(h.cartRows().map(row=>[row.id,row.qty]).sort()).toEqual([[keep,2],[reject,1],[drink,2]].sort());
  expect(reply||'').not.toMatch(/no tenemos|no manejamos|no pude añadir/i);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it.each(cases)('$kind entrada completa conserva productos válidos e informa el rechazado',async({menu,keep,reject,drink,text})=>{
  const h=harness(menu,true);h.service.ordersService.create=jest.fn();
  const reply=await h.sendQueued(text);
  expect(h.cartRows().map(row=>[row.id,row.qty]).sort()).toEqual([[keep,2],[drink,2]].sort());
  expect(h.cartRows().some(row=>row.id===reject)).toBe(false);
  expect(h.cartRows().find(row=>row.id===drink)?.note||'').toMatch(/sin az[uú]car/i);
  expect(reply||'').toMatch(/camarones/i);expect(h.conv.sessionData.address).toBeUndefined();
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it.each(cases.flatMap(item=>[false,true].map(failsAfterTools=>({...item,failsAfterTools}))))('$kind conserva cantidades y notas; falla final=$failsAfterTools',async({menu,keep,reject,drink,text,missing,failsAfterTools})=>{
  const h=harness(menu,true);h.service.ordersService.create=jest.fn();
  const agent=new WhatsappAgentService({getEffectiveConfig:async()=>({openaiApiKey:'offline-key',openaiModel:'gpt-4.1-2025-04-14',systemPrompt:'',localContext:{}})} as never,h.service.catalogService);h.service.agentService=agent;
  const run=jest.spyOn(agent,'runTurn');
  const response=(message:unknown)=>({ok:true,json:async()=>({choices:[{message}]})});
  const args=[{productId:keep,quantity:2},{productId:reject,quantity:1},{productId:drink,quantity:2,note:'sin azúcar'}];
  const original=globalThis.fetch;const fetchMock=jest.fn().mockResolvedValueOnce(response({content:null,tool_calls:args.map((arg,index)=>({id:'partial-'+index,type:'function',function:{name:'add_item',arguments:JSON.stringify(arg)}}))}));
  if(failsAfterTools)fetchMock.mockRejectedValue(Object.assign(new Error('synthetic timeout'),{name:'TimeoutError'}));
  else fetchMock.mockResolvedValueOnce(response({content:'No manejamos '+missing+'. Agregué los demás productos.'}));
  globalThis.fetch=fetchMock;
  try{
   const handled=await h.service.tryHandleAgentV1({conv:h.conv,msg:{waId:'customer',phoneE164:h.conv.phoneE164,messageId:'partial-boundary',messageType:'text',text,raw:{}},session:h.conv.sessionData,text,originalText:text,products:menu,cfg:h.cfg,status:{isOpen:true,message:'Abierto'},businessOpenForBot:true});
   expect(handled).toBe(true);const reply=h.replies.at(-1);expect(fetchMock).toHaveBeenCalledTimes(failsAfterTools?4:2);
   expect((await run.mock.results[0].value).purchaseAttempts).toEqual([{productId:keep,accepted:true},{productId:reject,accepted:false,reason:'dish_not_on_menu',uncoveredWords:['camarones']},{productId:drink,accepted:true}]);
   expect(h.cartRows().map(row=>[row.id,row.qty]).sort()).toEqual([[keep,2],[drink,2]].sort());
   expect(h.cartRows().find(row=>row.id===drink)?.note||'').toMatch(/sin az[uú]car/i);
   expect(h.cartRows().find(row=>row.id===keep)?.note||'').not.toMatch(/az[uú]car|camarones/i);
   expect(h.conv.sessionData.address).toBeUndefined();expect(h.conv.state).toBe('building_cart');
   expect(reply||'').not.toMatch(/no pude procesar|me lo repites|pedido confirmado|pedido enviado/i);
   if(failsAfterTools)expect(reply||'').toMatch(/guardados[\s\S]*carrito/i);
   else expect(reply||'').toContain(missing);
   expect(h.service.ordersService.create).not.toHaveBeenCalled();
  }finally{globalThis.fetch=original;}
 });
});


describe('Condición de inventario se interpreta antes del parser parcial',()=>{
 it('conserva ambos platos y la respuesta de ausencia sin convertir instrucciones en productos',async()=>{
  const menu=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-alternate-menu.json'),'utf8'));
  const source=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-mixed-followup-1510.json'),'utf8'))[0].messages[0].text;
  const h=harness(menu,true);h.service.ordersService.create=jest.fn();
  h.agent.runTurn.mockResolvedValue({reply:'No tenemos brownie.',actions:{addItems:[{productId:502,quantity:1,attributes:[{attributeName:'Salsa',attributeValue:'Yogur'}]},{productId:501,quantity:1}]},toolCalls:['add_item','add_item'],purchaseAttempts:[{productId:502,accepted:true},{productId:501,accepted:true}]});
  const reply=await h.sendQueued(source);expect(h.agent.runTurn).toHaveBeenCalledTimes(1);
  expect(h.agent.runTurn.mock.calls[0][0].userMessage).toBe(source);
  expect(h.cartRows().map(row=>[row.id,row.qty]).sort()).toEqual([[501,1],[502,1]]);
  expect(reply||'').toMatch(/no tenemos brownie/i);expect(reply||'').not.toMatch(/no manejamos.*om[ií]telo|no manejamos.*postre/i);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});

describe('Rechazo de una variante — el mismo plato aceptado se conserva', () => {
  const cases = [
    { kind: 'ppp', menu: products, id: 12, name: 'Trucha', attribute: 'Seleccion', accepted: 'Frita', text: 'Quiero una trucha frita y otra trucha con camarones' },
    { kind: 'carta', menu: [{ id: 45001, code: 45001, name: 'Arepa De Queso', price: 8000, description: 'Maiz y queso', availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Salsa', options: ['Hogao', 'Sin salsa'] }] }], id: 45001, name: 'Arepa De Queso', attribute: 'Salsa', accepted: 'Hogao', text: 'Quiero una arepa de queso con hogao y otra arepa de queso con camarones' },
  ];
  it.each(cases)('$kind conserva la variante válida y recuerda la que faltó', async ({ menu, id, attribute, accepted, text }) => {
    const h = harness(menu as typeof products, true);
    h.service.ordersService.create = jest.fn();
    const agent = new WhatsappAgentService({ getEffectiveConfig: async () => ({ openaiApiKey: 'offline-key', openaiModel: 'gpt-4.1-2025-04-14', systemPrompt: '', localContext: {} }) } as never, h.service.catalogService);
    h.service.agentService = agent;
    const response = (message: unknown) => ({ ok: true, json: async () => ({ choices: [{ message }] }) });
    const args = [
      { productId: id, quantity: 1, attributes: [{ attributeName: attribute, attributeValue: accepted }] },
      { productId: id, quantity: 1 },
    ];
    const original = globalThis.fetch;
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(response({ content: null, tool_calls: args.map((arg, index) => ({ id: 'variant-' + index, type: 'function', function: { name: 'add_item', arguments: JSON.stringify(arg) } })) }))
      .mockResolvedValueOnce(response({ content: 'Agregué una y la otra no está.' }));
    globalThis.fetch = fetchMock;
    try {
      const handled = await h.service.tryHandleAgentV1({ conv: h.conv, msg: { waId: 'customer', phoneE164: h.conv.phoneE164, messageId: 'variant-boundary', messageType: 'text', text, raw: {} }, session: h.conv.sessionData, text, originalText: text, products: menu, cfg: h.cfg, status: { isOpen: true, message: 'Abierto' }, businessOpenForBot: true });
      expect(handled).toBe(true);
      const rows = h.cartRows().filter((row) => row.id === id);
      expect(rows).toEqual([expect.objectContaining({ qty: 1, attrs: [`${attribute}:${accepted}`] })]);
      expect(rows[0].note || '').not.toMatch(/camarones/i);
      expect(h.replies.at(-1) || '').toMatch(/camarones/i);
      expect(h.replies.at(-1) || '').toMatch(/resto del pedido/i);
      expect(h.conv.sessionData.recentUnavailableOrder?.items.join(' ')).toMatch(/camarones/i);
      const follow = await h.sendQueued('¿Y los camarones sí los tienen?');
      expect(h.cartRows().filter((row) => row.id === id)).toEqual(rows);
      expect(follow || '').toMatch(/camarones/i);
      expect(follow || '').not.toMatch(/agregu[eé]|listo ✅/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    } finally { globalThis.fetch = original; }
  });
});

describe('Interrupción de precio con preámbulo conserva referencia y pedido',()=>{
 for(const prefix of ['Antes de seguir,','Antes de continuar,','Tengo una duda,','Disculpa,']) {
  it.each([
   {kind:'PPP',menu:products,ids:[71,38],family:'sopa',target:38,price:'10.500'},
   {kind:'otra carta',menu:JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-alternate-menu.json'),'utf8')),ids:[505,501],family:'bowl',target:501,price:'18.700'}
  ])(prefix+' $kind responde precio de familia sin volver a preguntar',async({menu,ids,family,price})=>{
   const h=harness(menu,false);
   h.conv.sessionData.cart=ids.map(id=>{const p=menu.find(p=>p.id===id)!;return {productId:p.id,name:p.name,code:p.code,quantity:2,unitPrice:p.price,attributes:[]};});
   const before=JSON.stringify(h.conv.sessionData.cart);
   const reply=await h.sendQueued(`${prefix} cuánto vale cada ${family}?`);
   expect(reply).toContain(price);expect(reply).not.toMatch(/de cu[aá]l producto/i);
   expect(JSON.stringify(h.conv.sessionData.cart)).toBe(before);expect(h.conv.sessionData.pendingPriceInquiry).toBeUndefined();
  });
 }
});

describe('Acuse de compra conserva indisponibilidad con distintos órdenes de palabras',()=>{
 it.each(['No tenemos flan.','El flan no lo manejamos.','Flan no hay por ahora.','Por ahora no contamos con flan.','El flan no está disponible.'])('%s',async explanation=>{
  const menu=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-alternate-menu.json'),'utf8'));
  const h=harness(menu,true);
  h.service.agentService.runTurn.mockResolvedValue({reply:explanation,actions:{addItems:[{productId:501,quantity:1}]},toolCalls:['add_item'],purchaseAttempts:[{productId:501,accepted:true}]});
  const text='Quiero un bowl andino. Si no tienen flan, omítelo.';
  const handled=await h.service.tryHandleAgentV1({conv:h.conv,msg:{waId:'customer',phoneE164:h.conv.phoneE164,messageId:'render-miss',messageType:'text',text,raw:{}},session:h.conv.sessionData,text,originalText:text,products:menu,cfg:h.cfg,status:{isOpen:true,message:'Abierto'},businessOpenForBot:true});
  expect(handled).toBe(true);expect(h.replies.at(-1)).toContain(explanation);
  expect(h.cartRows()).toEqual([expect.objectContaining({id:501,qty:1})]);
 });
});

describe('Medios de modelos nuevos — replay de extracción real sobre fixtures sintéticos',()=>{
 const captures=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-media-model-output-1510.json'),'utf8')).results;
 it.each([
  {kind:'PPP',id:'cart',menu:products,expected:[{id:1,qty:2},{id:17,qty:1},{id:38,qty:2}]},
  {kind:'otra carta',id:'japan',menu:[{id:801,code:801,name:'Ramen De Miso',description:'Caldo de miso y fideos',price:24000,attributes:[],hasAttributes:false,availableNow:true},{id:802,code:802,name:'Maki Vegetal',price:18000,attributes:[],hasAttributes:false,availableNow:true},{id:803,code:803,name:'Té De Jazmín',price:5000,attributes:[],hasAttributes:false,availableNow:true}],expected:[{id:801,qty:2},{id:802,qty:1},{id:803,qty:3}]}
 ])('carrito completo desde visión: $kind',async({id,menu,expected})=>{
  const h=harness(menu,false);h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);const analysis=captures.find(r=>r.kind==='images'&&r.id===id).output;
  const text=h.service.resolveImageOrderText(analysis,'Esto por favor',menu);
  expect(text).toBeTruthy();await h.sendQueued(text);
  if(!h.cartRows().length)throw Error('Vision replay: '+JSON.stringify({text,replies:h.replies,state:h.conv.state}));
  expect(h.cartRows().map(row=>({id:row.id,qty:row.qty})).sort((a,b)=>a.id-b.id)).toEqual(expected);
  if(id==='cart'){
   expect(h.cartRows().find(row=>row.id===1)?.attrs).toContain('Arepas:Fritas');
   expect(h.cartRows().find(row=>row.id===17)?.note).toMatch(/3\/4|tres cuartos/i);
   expect(h.cartRows().find(row=>row.id===38)?.note).toMatch(/sin arroz/i);
  }else{
   expect(h.cartRows().find(row=>row.id===801)?.note).toMatch(/sin cebolla/i);
   expect(h.cartRows().find(row=>row.id===803)?.note).toMatch(/sin az[uú]car/i);
  }
 });
 it('carta sin selección no compra y comprobante no se transforma en pedido',()=>{
  const h=harness(products,false);
  for(const id of ['menu','receipt']){
   const analysis=captures.find(r=>r.kind==='images'&&r.id===id).output;
   if(id==='menu')expect(h.service.resolveImageOrderText(analysis,'¿Cuánto cuestan?',products)).toBeNull();
   else expect(analysis).toMatchObject({kind:'payment_proof',textForBot:''});
  }
  expect(h.cartRows()).toEqual([]);
 });
});

describe('Audio de GPT Transcribe — replay completo de entrada',()=>{
 const captures=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-media-model-output-1510.json'),'utf8')).results;
 it.each([{id:'wings',productId:75},{id:'swap',productId:99}])('$id no pierde el plato principal ni vende la bebida incluida aparte',async({id,productId})=>{
  const h=harness(products,false);
  h.service.metaService.downloadMedia=jest.fn().mockResolvedValue({buffer:Buffer.from('fixture-audio'),mimeType:'audio/ogg'});
  h.service.aiService.transcribeAudio=jest.fn().mockResolvedValue(captures.find(r=>r.kind==='audios'&&r.id===id).output);
  h.service.conversationService.updateMessageBody=jest.fn().mockResolvedValue(undefined);
  h.service.deliveryRouting.quoteDeliveryFee=jest.fn().mockResolvedValue({ok:false,reason:'no_api_key',message:'Synthetic fixed delivery'});
  await h.sendQueued('',{messageType:'audio',mediaId:'synthetic-audio',mimeType:'audio/ogg'});
  expect(h.cartRows()).toEqual([expect.objectContaining({id:productId,qty:1})]);
  if(id==='wings')expect(h.cartRows()[0].attrs).toContain('Bebida:Pepsi');
  else expect(h.cartRows()[0].note).toMatch(/bocadillo.*queso/i);
  expect(h.service.aiService.transcribeAudio).toHaveBeenCalledTimes(1);
 });
 it('silencio conserva carrito y pide repetir sin inventar pedido',async()=>{
  const h=harness(products,false);await h.sendQueued('Dos churrascos');const before=structuredClone(h.conv.sessionData.cart);
  h.service.metaService.downloadMedia=jest.fn().mockResolvedValue({buffer:Buffer.from('fixture-silence'),mimeType:'audio/ogg'});
  h.service.aiService.transcribeAudio=jest.fn().mockResolvedValue(null);
  await h.sendQueued('',{messageType:'audio',mediaId:'synthetic-silence',mimeType:'audio/ogg'});
  expect(h.conv.sessionData.cart).toEqual(before);expect(h.replies.at(-1)).toMatch(/audio|escrib/i);
 });
});


describe('Foto de carta añade todos los productos reconocidos sin pedir selección',()=>{
 it.each([
  ['Churrasco\nArroz Con Pollo', products],
  [Array.from({length:6},(_,i)=>`Plato Solar ${i+1}`).join('\n'), Array.from({length:6},(_,i)=>({id:8901+i,code:8901+i,name:`Plato Solar ${i+1}`,price:15000,attributes:[]}))],
  ['Bowl Solar\nRamen Lunar', [
   {id:8801,code:8801,name:'Bowl Solar',price:15000,attributes:[]},
   {id:8802,code:8802,name:'Ramen Lunar',price:18000,attributes:[]},
  ]],
 ])('añade todas las opciones y conserva el carrito anterior: %s',async(visibleText, menu)=>{
  const h=harness(menu as any,false);
  const selected=(menu as any[])[0];
  h.conv.sessionData.cart=[{productId:selected.id,code:selected.code,name:selected.name,unitPrice:selected.price,quantity:2,note:'salsa aparte',attributes:[]}];
  const before=structuredClone(h.conv.sessionData);
  h.service.metaService.downloadMedia=jest.fn().mockResolvedValue({buffer:Buffer.from('mock'),mimeType:'image/jpeg'});
  h.service.catalogService.getMenuDetailedText=jest.fn().mockResolvedValue('fixture');
  h.service.aiService.analyzeOrderImage=jest.fn().mockResolvedValue({kind:'unclear',textForBot:'',visibleText,reply:'Llama a un asesor'});
  h.service.conversationService.updateMessageBody=jest.fn().mockResolvedValue(undefined);
  const result=await h.service.resolveImageMessage({waId:'customer',messageType:'image',mediaId:'mock-menu'},'1',h.conv,h.cfg);
  expect(result.done).toBe(false);
  expect(h.conv.sessionData).toEqual(before);
  await h.sendQueued(result.text);
  expect(h.service.aiService.analyzeOrderImage).toHaveBeenCalledTimes(1);
  expect(h.replies.at(-1)).toMatch(/algo más/i);
  expect(h.conv.sessionData.cart).toEqual(expect.arrayContaining([expect.objectContaining({note:'salsa aparte',quantity:2})]));
  expect(h.conv.sessionData.cart.reduce((sum,row)=>sum+row.quantity,0)).toBe(2+(visibleText as string).split('\n').length);
  for(const name of (visibleText as string).split('\n'))expect(h.replies.at(-1)).toContain(name);
  expect(h.replies.at(-1)).not.toMatch(/asesor|llama|no entend/i);
 });
});


describe('Foto de carta — cantidades explícitas y excepciones de intención',()=>{
 const menu=[{id:9101,code:9101,name:'Ramen Lunar',price:18000,attributes:[]},{id:9102,code:9102,name:'Bowl Solar',price:15000,attributes:[]}];
 const analysis={kind:'unclear',textForBot:'',visibleText:'3 x Ramen Lunar $18.000 #9101\nBowl Solar $15.000 #9102'};
 it('no usa precios, códigos o nombres como cantidades al añadir todas las tarjetas',async()=>{
  const h=harness(menu,false);const text=h.service.resolveImageOrderText(analysis,undefined,menu);
  await h.sendQueued(text);expect(h.cartRows()).toEqual([expect.objectContaining({id:9101,qty:3}),expect.objectContaining({id:9102,qty:1})]);
 });
 it.each(['¿Cuánto cuestan?','Solo quiero ver','El segundo','Solo el de la derecha','No agregues nada'])('no compra toda la carta cuando el pie restringe o consulta: %s',caption=>{
  const h=harness(menu,false);expect(h.service.resolveImageOrderText(analysis,caption,menu)).toBeNull();expect(h.cartRows()).toEqual([]);
 });
 it('una carta reconocida con pago pendiente no se recibe como comprobante',async()=>{
  const h=harness(menu,false);h.conv.sessionData.paymentMethod='nequi';
  h.service.metaService.downloadMedia=jest.fn().mockResolvedValue({buffer:Buffer.from('fixture'),mimeType:'image/jpeg'});
  h.service.catalogService.getMenuDetailedText=jest.fn().mockResolvedValue('fixture');
  h.service.aiService.analyzeOrderImage=jest.fn().mockResolvedValue(analysis);
  h.service.conversationService.updateMessageBody=jest.fn().mockResolvedValue(undefined);
  const result=await h.service.resolveImageMessage({waId:'customer',messageType:'image',mediaId:'fixture'},'1',h.conv,h.cfg);
  expect(result.done).toBe(false);expect(result.text).toContain('Ramen Lunar');expect(h.replies.join(' ')).not.toMatch(/comprobante/);
 });
});
