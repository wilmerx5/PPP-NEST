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
    const hold = service.outboundHoldByWaId.get(waId);
    if (hold) hold.push(body); else await recordReply(_conv,waId,body);
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
