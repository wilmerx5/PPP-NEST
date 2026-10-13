import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { WhatsappOrchestratorService } from './whatsapp-orchestrator.service';
import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { WhatsappActionGuardService } from './whatsapp-action-guard.service';
import { WhatsappPointsService } from './whatsapp-points.service';
import { WhatsappTurnTelemetryService } from './whatsapp-turn-telemetry.service';
import type { WhatsappSessionData } from './types/whatsapp-session.types';
import { DEFAULT_PAYMENT_METHODS } from './whatsapp-payment-methods';
import { looksLikeAddressOnlyMessage } from './whatsapp-intent';
import { isWrongChatApology } from './whatsapp-session-intents';

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
    expect(h.conv.sessionData.pendingMultiOrder?.confident).toContainEqual(expect.objectContaining({productId:1}));
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

  it('does not turn a menu with no selection into the first product', () => {
    const h = harness();
    expect(h.service.resolveImageOrderText({
      kind: 'unclear', textForBot: '', visibleText: '1 Pollo Frito\nChurrasco\nArroz Con Pollo',
      reply: '¿Cuál de los platos de la carta quieres?',
    }, 'Esto', products)).toBeNull();
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
    const known = [...(pending?.confident || []), ...(pending?.needsAttributes || [])].map((row) => row.productId);
    expect(known).toEqual(expect.arrayContaining([17, 45]));
    expect(pending?.unresolved.join(' ') || reply || '').toMatch(/malteada/i);
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
    const known = [...(pending?.confident || []), ...(pending?.needsAttributes || [])].map((row) => row.productId);
    expect(known).toEqual(expect.arrayContaining([9701, 9702]));
    expect(pending?.unresolved.join(' ') || reply || '').toMatch(/helado/i);
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
    expect(h.replies[0]).toMatch(/Vi tu foto.*plato.*código/s);expect(h.replies[0]).toMatch(/llámanos/i);
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
  it('no compra el primer plato de una carta sin selección aunque no haya reply',()=>{
    const h=harness(products,false);expect(h.service.resolveImageOrderText(analysis,'Esto',products)).toBeNull();expect(h.cartRows()).toEqual([]);
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
      expect(h.replies.at(-1)).toMatch(/c[oó]mo pagas/i);
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
    expect(h.cartRows()).toEqual([]);
    expect(h.conv.sessionData.pendingMultiOrder?.confident?.length || h.conv.sessionData.pendingMultiOrder?.needsAttributes?.length).toBeGreaterThan(0);
    await h.sendQueued(yes);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id, qty })]);
    expect(h.conv.sessionData.pendingMultiOrder).toBeFalsy();
    expect(h.cartRows().some((row) => /malteada|helado/i.test(String(row.id)))).toBe(false);
  });
  it.each([
    { menu: products, order: 'Un churrasco y una malteada', id: 17 },
    { menu: [taco], order: 'Un taco al pastor y un helado', id: 11411 },
  ])('pedir el faltante por su nombre no lo inventa', async ({ menu, order, id }) => {
    const h = harness(menu as typeof products, false);
    await h.sendQueued(order);
    const reply = await h.sendQueued(menu === products ? 'sí la malteada' : 'sí el helado');
    expect(h.cartRows().map((row) => row.id)).not.toContain(id);
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
    expect(reply || '').not.toMatch(/coca-cola|coca cola/i);
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
