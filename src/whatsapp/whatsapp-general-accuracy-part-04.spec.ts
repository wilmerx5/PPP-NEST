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
import { products, harness } from './whatsapp-accuracy.test-support';



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
      burgerDrink: 'coca cola',
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
      burgerDrink: undefined,
      address: 'No, al conjunto Mirador cada 12',
      place: /mirador/i,
      street: /carrera\s+12/,
      agent: true,
    },
  ])('elige una variante y deja solo esa al corregir (agent $agent)', async ({ menu, order, familyIds, keep, kept, sideIds, burgerAsk, burgerPick, burgerId, burgerDrink, address, place, street, agent }) => {
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
    const picked = await h.sendQueued(burgerPick);
    if (burgerDrink) {
      expect(picked || '').toMatch(/Bebida/);
      await h.sendQueued(burgerDrink);
    }
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

describe('Falafel — continuación aislada del ensayo real, sin más inferencia',()=>{
 it('consulta, cambia bebida, reduce cantidad, corrige dirección y elige transferencia',async()=>{
  const menu=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-falafel-menu-1510.json'),'utf8'));
  const h=harness(menu,true);h.conv.state='awaiting_payment';h.conv.customerName='Ana';
  h.service.deliveryRouting.quoteDeliveryFee=jest.fn().mockResolvedValue({ok:false,reason:'no_api_key',message:'Tarifa fija sintética'});h.service.ordersService.create=jest.fn();
  h.conv.sessionData={cart:[{productId:8921,name:'Combo De Falafel',code:8921,unitPrice:29000,quantity:2,note:'sin tomate',attributes:[{attributeName:'Bebida',attributeValue:'Te Frio'}]},{productId:8922,name:'Hummus Clasico',code:8922,unitPrice:9000,quantity:1,attributes:[]}],orderType:'delivery',address:'calle 18 sur 70 25',addressConfirmed:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,deliveryFeeCalculated:2000};
  h.agent.runTurn.mockImplementation(async input=>input.userMessage.includes('cobran aparte')?{reply:'Sí, las papas están incluidas en el combo.',actions:{},toolCalls:['search_menu']}:input.userMessage.toLowerCase().includes('cámbiame')?{reply:'Listo.',actions:{updateAttributes:[{productId:8921,cartLineIndex:0,attributeName:'Bebida',attributeValue:'Limonada'}]},toolCalls:['get_cart','set_attribute']}:input.userMessage.toLowerCase().includes('deja solo')?{reply:'Listo.',actions:{updateCartLines:[{productId:8921,cartLineIndex:0,quantity:1}]},toolCalls:['get_cart','update_item']}:{reply:'',actions:{},toolCalls:[]});
  expect(await h.send('Antes de pagar, el combo trae papas o se cobran aparte?')).toMatch(/incluidas/);
  await h.send('Cámbiame la bebida de los dos combos por limonada, no agregues otra bebida');
  expect(h.cartRows()).toHaveLength(2);expect(h.cartRows()[0].attrs).toContain('Bebida:Limonada');
  await h.send('Deja solo un Combo De Falafel, el hummus queda igual');
  expect(h.cartRows().map(row=>row.qty)).toEqual([1,1]);expect(h.cartRows()[0].note).toBe('sin tomate');
  expect(await h.send('Cuál es el total con domicilio?')).toContain('40.000');
  await h.send('Dirección: calle 19 sur 70 28');expect(h.conv.sessionData.address).toContain('19 sur 70 28');
  await h.send('Pago por transferencia');expect(h.conv.sessionData.paymentMethod).toBe('transfer');expect(h.cartRows()).toHaveLength(2);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});

describe('Reemplazo con sabor pendiente — conserva original hasta resolver', () => {
  for (const f of [
    { id: 20601, old: 'Batido De Banano', next: 'Jugo Natural', flavor: 'Mango', other: 'Lulo' },
    { id: 20611, old: 'Te Helado', next: 'Limonada Frutal', flavor: 'Fresa', other: 'Maracuya' },
  ]) for (const agent of [false, true]) for (const cancel of [false, true]) {
    it(`${f.old}, agente ${agent}, cancelar ${cancel}`, async () => {
      const menu = [
        { id: f.id, code: f.id, name: f.old, price: 6000, availableNow: true, hasAttributes: false, attributes: [] },
        { id: f.id + 1, code: f.id + 1, name: f.next, price: 9000, availableNow: true, hasAttributes: true,
          attributes: [{ attributeName: 'Sabor', options: [f.flavor, f.other] }] },
      ];
      const h = harness(menu, agent);
      h.conv.state = 'awaiting_address';
      h.service.ordersService.create = jest.fn();
      Object.assign(h.conv.sessionData, { orderType: 'delivery', address: undefined, addressConfirmed: false,
        cart: [{ productId: f.id, code: f.id, name: f.old, unitPrice: 6000, quantity: 3, note: 'sin hielo', attributes: [] }] });
      const before = structuredClone(h.conv.sessionData.cart);
      await h.sendQueued(`Cambia ${f.old} por dos ${f.next}`);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.pendingAttribute?.replacement?.originalLine).toEqual(before[0]);
      expect(h.conv.sessionData.pendingAttribute?.quantity).toBe(2);
      expect(h.replies.at(-1)).toMatch(/sabor|elige|opción/i);
      await h.sendQueued(cancel ? 'Cancela ese cambio' : f.flavor);
      if (cancel) expect(h.conv.sessionData.cart).toEqual(before);
      else expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({ productId: f.id + 1, quantity: 2,
        unitPrice: 9000, note: 'sin hielo', attributes: [{ attributeName: 'Sabor', attributeValue: f.flavor }] })]);
      expect(h.conv.sessionData.pendingAttribute).toBeUndefined();
      expect(h.conv.sessionData.pendingCheckoutResume).toBeUndefined();
      expect(h.conv.state).toBe('awaiting_address');
      expect(h.conv.sessionData.address).toBeUndefined();
      expect(h.replies.at(-1)).toMatch(/dirección/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
  }
});

describe('Catálogo intercalado — número no pertenece al reemplazo anterior', () => {
  for (const f of [
    { id: 21201, old: 'Sopa De Calabaza', next: 'Sopa De Hongos', combo: 'Combo De Pizza', a: 'Pizza Personal', b: 'Pizza Mediana' },
    { id: 21211, old: 'Sopa De Lentejas', next: 'Sopa De Tomate', combo: 'Combo De Bowl', a: 'Bowl Personal', b: 'Bowl Grande' },
  ]) for (const agent of [false, true]) for (const state of ['awaiting_address', 'awaiting_payment']) for (const mode of ['precio', 'variante']) for (const selection of ['2', 'la segunda', 'dos']) {
    it(`${f.combo}, agente ${agent}, ${state}, lista ${mode}, respuesta ${selection}`, async () => {
      const menu = [f.old, f.next, f.a, f.b, f.combo].map((name, index) => ({ id: f.id + index, code: f.id + index, name,
        price: 10000 + index * 3000, availableNow: true, hasAttributes: false, attributes: [] }));
      const h = harness(menu, agent);
      h.conv.state = state;
      h.service.ordersService.create = jest.fn();
      Object.assign(h.conv.sessionData, { orderType: 'delivery', address: state === 'awaiting_payment' ? 'Calle 12 30 45' : undefined,
        addressConfirmed: state === 'awaiting_payment', deliveryFeeCalculated: state === 'awaiting_payment' ? 3000 : null,
        phoneConfirmed: true, contactPhone: h.conv.phoneE164,
        cart: [menu[0], menu[0], menu[4]].map((p, index) => ({ productId: p.id, code: p.code, name: p.name, unitPrice: p.price,
          quantity: index ? 1 : 3, note: index ? 'sin sal' : 'sin cebolla', attributes: [] })) });
      const before = structuredClone(h.conv.sessionData.cart);
      await h.sendQueued(`Cambia ${f.old} por ${f.next}`);
      expect(h.conv.sessionData.pendingCartReplacement?.options).toHaveLength(2);
      await h.sendQueued(mode === 'precio' ? 'Qué precio tiene?' : 'Lo quiero solo');
      expect(h.conv.sessionData.cart).toEqual(before);
      if (mode === 'precio') expect(h.conv.sessionData.pendingPriceInquiry?.productIds).toHaveLength(2);
      else expect(h.conv.sessionData.pendingMatch?.replacement?.originalLine).toEqual(before[2]);
      const pending = structuredClone(h.conv.sessionData);
      await h.sendQueued(selection);
      expect(h.conv.sessionData).toEqual(pending);
      expect(h.replies.at(-1)).toMatch(/listas|selecciones|nombre.*opción|nombre.*producto/i);
      expect(h.conv.sessionData.paymentMethod).toBeUndefined();
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      await h.sendQueued(mode === 'precio' ? f.combo : f.b);
      expect(h.conv.sessionData.cart.slice(0, 2)).toEqual(before.slice(0, 2));
      if (mode === 'precio') {
        expect(h.conv.sessionData.cart).toEqual(before);
        expect(h.conv.sessionData.pendingPriceInquiry).toBeUndefined();
        expect(h.conv.sessionData.pendingCartReplacement).toEqual(pending.pendingCartReplacement);
        expect(h.replies.at(-1)).toMatch(/22[.,]000/);
      } else {
        expect(h.conv.sessionData.cart).toHaveLength(3);
        expect(h.conv.sessionData.cart[2]).toMatchObject({ productId: f.id + 3, quantity: 1, unitPrice: 19000, note: 'sin sal' });
        expect(h.conv.sessionData.pendingCartReplacement).toBeUndefined();
        expect(h.conv.sessionData.pendingMatch?.replacement).toBeUndefined();
      }
      expect(h.conv.sessionData.pendingCheckoutResume).toBeUndefined();
      expect(h.conv.state).toBe(state);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
  }
});


describe('offered product purchase split across attribute options', () => {
  for (const [name, attribute, options] of [
    ['Coca Cola 1.5L', 'Sabor', ['Original', 'Zero']],
    ['Helado Artesanal', 'Sabor', ['Vainilla', 'Chocolate']],
    ['Te Artesanal', 'Temperatura', ['Caliente', 'Frio']],
    ['Arepa Rellena', 'Relleno', ['Queso', 'Hongos']],
  ] as const) {
    for (const enabled of [true, false]) {
      for (const mode of ['unknown', 'checkout', 'numeric', 'staleFocus']) {
        it(`${name} split boundary ${mode}, agent ${enabled}`, async () => {
          const menu = [
            { id: 25101, code: 25101, name, price: 8000, availableNow: true, hasAttributes: true,
              attributes: [{ attributeName: attribute, options: [...options] }] },
            { id: 25102, code: 25102, name: 'Sopa De Lentejas', price: 12000, availableNow: true, hasAttributes: false, attributes: [] },
          ];
          const h = harness(menu, enabled);
          await h.sendQueued(`Tienes ${name}?`);
          h.conv.sessionData.cart = [{ productId: 25102, code: 25102, name: menu[1].name, unitPrice: 12000, quantity: 1, note: 'sin sal', attributes: [] }];
          const before = structuredClone(h.conv.sessionData.cart);
          if (mode === 'staleFocus') {
            delete h.conv.sessionData.pendingAddOffer;
            delete h.conv.sessionData.pendingAttribute;
            h.conv.sessionData.productFocus = { productId: 25101, name };
          }
          if (mode === 'checkout') {
            h.conv.state = 'awaiting_payment';
            Object.assign(h.conv.sessionData, { orderType: 'delivery', address: 'Calle 12 30 45', addressConfirmed: true,
              phoneConfirmed: true, contactPhone: h.conv.phoneE164, deliveryFeeCalculated: 3000 });
          }
          await h.sendQueued(mode === 'unknown' ? `Dame dos ${options[0]} y dos Misterioso` :
            mode === 'numeric' ? `Dame 1 ${options[0]} y 3 ${options[1]}` : `Dame dos ${options[0]} y dos ${options[1]}`);
          if (mode === 'staleFocus') {
            expect(h.conv.sessionData.cart).toEqual(before);
            expect(h.replies.at(-1)).toMatch(/de qu[eé] producto/i);
          } else if (mode === 'unknown') {
            expect(h.conv.sessionData.cart).toEqual(before);
            expect(h.replies.at(-1)).toMatch(/aclara todas las opciones/i);
          } else {
            expect(h.conv.sessionData.cart[0]).toEqual(before[0]);
            expect(h.cartRows().slice(1)).toEqual([
              expect.objectContaining({ id: 25101, qty: mode === 'numeric' ? 1 : 2, attrs: [`${attribute}:${options[0]}`] }),
              expect.objectContaining({ id: 25101, qty: mode === 'numeric' ? 3 : 2, attrs: [`${attribute}:${options[1]}`] }),
            ]);
            if (mode === 'checkout') expect(h.conv.state).toBe('awaiting_payment');
          }
          expect(h.conv.sessionData.paymentMethod).toBeUndefined();
        });
      }
      for (const withCon of [true, false]) {
        it(`${name} buys two of each offered option, con ${withCon}, agent ${enabled}`, async () => {
          const menu = [{ id: 25101, code: 25101, name, price: 8000, availableNow: true,
            hasAttributes: true, attributes: [{ attributeName: attribute, options: [...options] }] }];
          const h = harness(menu, enabled);
          await h.sendQueued(`Tienes ${name}?`);
          expect(h.conv.sessionData.cart).toEqual([]);
          const replyOffset = h.replies.length;
          await h.sendQueued(`Dame dos ${withCon ? 'con ' : ''}${options[0]} y dos ${withCon ? 'con ' : ''}${options[1]}`);
          expect(h.cartRows()).toEqual([
            expect.objectContaining({ id: 25101, qty: 2, attrs: [`${attribute}:${options[0]}`] }),
            expect.objectContaining({ id: 25101, qty: 2, attrs: [`${attribute}:${options[1]}`] }),
          ]);
          expect(h.conv.sessionData.cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0)).toBe(32000);
          expect(h.replies.at(-1)).toMatch(/32[.,]000/);
          expect(h.replies.at(-1)).toContain(options[0]);
          expect(h.replies.at(-1)).toContain(options[1]);
          expect(h.replies.slice(replyOffset).join(' ')).not.toMatch(/no manejamos|no tenemos|escribe s[ií]/i);
          const confirmedCart = structuredClone(h.conv.sessionData.cart);
          await h.sendQueued('ver carrito');
          expect(h.conv.sessionData.cart).toEqual(confirmedCart);
          expect(h.replies.slice(replyOffset).join(' ')).not.toMatch(/no manejamos|no tenemos/i);
          expect(h.conv.sessionData.pendingMultiOrder).toBeUndefined();
        });
      }
    }
  }
});

describe('the included drink is asked after a pick from a list', () => {
  const fictional = [
    { id: 31701, code: 31701, name: 'Combo Burger Sencillo', price: 15000, availableNow: true, hasAttributes: true,
      attributes: [{ attributeName: 'Bebida', options: ['Limonada', 'Naranjada'] }] },
    { id: 31702, code: 31702, name: 'Combo Burger Doble', price: 21000, availableNow: true, hasAttributes: true,
      attributes: [{ attributeName: 'Bebida', options: ['Limonada', 'Naranjada'] }] },
  ];
  const withList = (menu: any[], ids: number[], query: string, enabled: boolean) => {
    const h = harness(menu as any, enabled);
    h.conv.sessionData.pendingMatch = { query, intent: 'order', candidates: menu.filter((p: any) => ids.includes(p.id)) } as any;
    h.conv.state = 'building_cart';
    return h;
  };
  const cases = [
    { label: 'PPP', menu: products, ids: [76, 77, 78], query: 'hamburguesa', first: 76, other: 'coca cola', otherValue: 'Coca Cola', named: 'hamburguesa con pepsi', namedValue: 'Pepsi' },
    { label: 'fictional', menu: fictional, ids: [31701, 31702], query: 'combo burger', first: 31701, other: 'naranjada', otherValue: 'Naranjada', named: 'combo burger con naranjada', namedValue: 'Naranjada' },
  ];
  for (const enabled of [false, true]) {
    for (const c of cases) {
      it(`${c.label}: picking "1" asks the drink, then keeps the answer, agent ${enabled}`, async () => {
        const h = withList(c.menu as any, c.ids, c.query, enabled);
        await h.sendQueued('1');
        expect(h.cartRows()).toEqual([]);
        expect(h.conv.sessionData.pendingAttribute?.productId).toBe(c.first);
        expect(h.replies.at(-1)).toMatch(/Bebida/);
        await h.sendQueued(c.other);
        expect(h.cartRows()).toEqual([expect.objectContaining({ id: c.first, attrs: expect.arrayContaining([`Bebida:${c.otherValue}`]) })]);
      });
      it(`${c.label}: a drink named with the dish is kept without asking, agent ${enabled}`, async () => {
        const h = withList(c.menu as any, c.ids, c.named, enabled);
        await h.sendQueued('1');
        expect(h.cartRows()).toEqual([expect.objectContaining({ id: c.first, attrs: expect.arrayContaining([`Bebida:${c.namedValue}`]) })]);
      });
    }
    it(`fictional: a dish asked by name keeps the first drink, agent false`, async () => {
      const h = harness(fictional as any, false);
      await h.sendQueued('un combo burger doble');
      expect(h.cartRows()).toEqual([expect.objectContaining({ id: 31702, attrs: ['Bebida:Limonada'] })]);
    });
  }
});

describe('withdrawal scope with multiple pending cart edits',()=>{
  for(const enabled of [true,false])for(const state of ['awaiting_payment','awaiting_final_confirm'])for(const phrase of ['Olvida ese cambio','Déjalo como estaba','No quites nada']){
    it(`${phrase}, ${state}, agent ${enabled}`,async()=>{
      const dish={id:42201,code:42201,name:'Ramen De Setas',price:18000,availableNow:true,attributes:[]};
      const h=harness([dish],enabled);h.conv.state=state;
      Object.assign(h.conv.sessionData,{orderType:'pickup',fulfillmentChosen:true,address:'Recoge en el local',addressConfirmed:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,
        ...(state==='awaiting_final_confirm'?{paymentMethod:'contraentrega'}:{}),cart:[...['sin cilantro','con cilantro'].map((note,i)=>({productId:dish.id,code:dish.code,name:dish.name,unitPrice:18000,quantity:i?1:2,attributes:[],note}))]});
      const cartSignature=JSON.stringify(h.conv.sessionData.cart);
      const options=h.conv.sessionData.cart.map((line,index)=>({cartIndex:index,label:`Ramen De Setas · ${line.note}`}));
      h.conv.sessionData.pendingCartRemoval={cartSignature,options};
      h.conv.sessionData.pendingCartQuantity={cartSignature,options,quantity:1};
      h.service.ordersService.create=jest.fn();
      const before=structuredClone(h.conv.sessionData);
      await h.sendQueued(phrase);
      expect(h.conv.sessionData.cart).toEqual(before.cart);expect(h.conv.state).toBe(state);expect(h.service.ordersService.create).not.toHaveBeenCalled();
      expect(h.conv.sessionData.pendingCartQuantity).toEqual(before.pendingCartQuantity);
      if(phrase==='No quites nada'){
        expect(h.conv.sessionData.pendingCartRemoval).toBeUndefined();
        expect(h.replies.at(-1)).toMatch(/cambio de cantidad/i);
        await h.sendQueued('1');
        expect(h.cartRows()).toEqual([expect.objectContaining({qty:1,note:'sin cilantro'}),expect.objectContaining({qty:1,note:'con cilantro'})]);
        expect(h.conv.sessionData.pendingCartQuantity).toBeUndefined();
      }else{
        expect(h.conv.sessionData).toEqual(before);expect(h.replies.at(-1)).toMatch(/varios cambios.*cu[aá]l cancelamos/is);
      }
      expect(h.conv.sessionData.paymentMethod).toBe(before.paymentMethod);expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
  }
});


describe('Catalog based quantity during payment',()=>{
 it.each([true,false].flatMap(agent=>['Te De Jazmin','Infusion De Hibisco'].map(name=>({agent,name}))))('two $name agent=$agent',async({agent,name})=>{
  const menu=[{id:59301,code:971,name:'Tarta De Setas',price:23000,availableNow:true,hasAttributes:false,attributes:[]},{id:59302,code:972,name,price:4500,availableNow:true,hasAttributes:false,attributes:[]}];
  const h=harness(menu,agent);h.conv.state='awaiting_payment';h.conv.sessionData.cart=[{productId:59301,code:971,name:menu[0].name,unitPrice:23000,quantity:1,attributes:[]}];
  await h.sendQueued('Quiero dos '+name);
  expect(h.cartRows()).toEqual([expect.objectContaining({id:59301,qty:1}),expect.objectContaining({id:59302,qty:2})]);
 });
});

describe('Unit option no-op retains intent ownership across repeated turns',()=>{
 for(const name of ['Caja De Falafel','Bento Vegetal','Combo De Arepas'])for(const state of ['building_cart','awaiting_payment','awaiting_final_confirm'])it(name+' '+state,async()=>{
  const product={id:64701,code:64701,name,price:27000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Te Frio','Limonada']},{attributeName:'Salsa',options:['Suave','Picante']}]};
  const h=harness([product],true);h.conv.state=state;
  Object.assign(h.conv.sessionData,{cart:[{productId:product.id,code:product.code,name,unitPrice:product.price,quantity:4,note:'sin cebolla',attributes:[{attributeName:'Bebida',attributeValue:'Limonada'},{attributeName:'Salsa',attributeValue:'Picante'}]}],orderType:'delivery',fulfillmentChosen:true,address:'Calle 12 34 56',addressConfirmed:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,deliveryFeeCalculated:2000,...(state==='awaiting_final_confirm'?{paymentMethod:'contraentrega'}:{})});
  const before=structuredClone(h.conv.sessionData.cart);h.service.ordersService.create=jest.fn().mockResolvedValue({id:6470,dailyOrderNumber:77});
  h.agent.runTurn.mockImplementation(async input=>{
   const service=new WhatsappAgentService({} as never,h.service.catalogService) as any;const actions:any={};
   const ctx={actions,cart:input.cart,products:[product],byId:new Map([[product.id,product]]),setNeedsAttr:()=>{}};
   const result=JSON.parse(service.executeTool('set_unit_attributes',{productId:product.id,cartLineIndex:0,affectedQuantity:2,attributes:[{attributeName:'Bebida',attributeValue:'Limonada'},{attributeName:'Salsa',attributeValue:'Picante'}]},ctx));
   expect(result).toMatchObject({ok:true,unchanged:true});
   return {reply:'YA CAMBIÉ TODAS',actions,toolCalls:['get_cart','set_unit_attributes']};
  });
  for(let repeat=0;repeat<2;repeat++){
   const reply=await h.sendQueued('En dos unidades prefiero bebida Limonada y salsa Picante; las demás conservan sus opciones');
   expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.state).toBe(state);
   expect(reply).toMatch(/ya tienen las opciones/i);expect(reply).not.toContain('YA CAMBIÉ TODAS');
   expect(h.conv.sessionData.pendingMatch).toBeUndefined();expect(h.conv.sessionData.pendingMultiOrder).toBeUndefined();
   expect(h.service.ordersService.create).not.toHaveBeenCalled();
  }
  if(h.conv.state==='building_cart')await h.sendQueued('Nada más');
  if(h.conv.state==='awaiting_payment')await h.sendQueued('1');
  await h.sendQueued('Confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(4);
 });
});

describe('Invalid explicit distribution is clarified before inference or clamping',()=>{
 for(const [total,a,b] of [[4,0,4],[12,11,1],[4,2,3]])it(`${total}=${a}+${b}`,async()=>{
  const product={id:65011,code:65011,name:'Caja De Desayuno',price:19000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Te','Cafe']}]};
  const h=harness([product],true);h.service.ordersService.create=jest.fn();const before=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued(`Quiero ${total} Caja De Desayuno, ${a} con Te y ${b} con Cafe`);
  expect(h.agent.runTurn).not.toHaveBeenCalled();expect(h.conv.sessionData.cart).toEqual(before);expect(reply).toMatch(/reparto completo.*aclaremos/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});

describe('An additional half remains a purchase rather than the earlier packing note',()=>{
 for(const enabled of [false,true])it(`agent=${enabled}`,async()=>{
  const menu=[{id:65841,code:65841,name:'Combo Vegetal',price:30000,availableNow:true,hasAttributes:false,attributes:[]},{id:65842,code:65842,name:'Medio Pollo Frito',price:15000,availableNow:true,hasAttributes:false,attributes:[]}];const h=harness(menu,enabled);
  await h.sendQueued('Agradezco si me alistan un Combo Vegetal pero la mitad en caja diferente');const note=h.conv.sessionData.cart[0].note;await h.sendQueued('Además un Medio Pollo Frito');expect(h.conv.sessionData.cart).toHaveLength(2);expect(h.conv.sessionData.cart.find((line:any)=>line.productId===65841)).toMatchObject({quantity:1,note});expect(h.conv.sessionData.cart.find((line:any)=>line.productId===65842)).toMatchObject({quantity:1});
 });
});

describe('Repeating a named destination with internal units must not bypass a coverage rejection',()=>{
 for(const place of ['Villa Galante','Conjunto Los Pinos'])for(const enabled of [false,true])it(`${place} agent=${enabled}`,async()=>{
  const h=harness(products,enabled);Object.assign(h.cfg,{deliveryFeeMode:'route',restaurantLat:4.62,restaurantLng:-74.15,deliveryMaxKm:8.5});h.conv.state='awaiting_address';h.conv.sessionData={cart:[{productId:23,code:23,name:'Arroz Con Pollo',unitPrice:29500,quantity:1}],orderType:'delivery',fulfillmentChosen:true,lastDeliveryAddress:'Calle 7 90 76 casa 175',address:'Calle 7 90 76 casa 175',addressConfirmed:false,phoneConfirmed:false} as any;
  h.service.deliveryRouting.quoteDeliveryFee=jest.fn().mockResolvedValue({ok:false,reason:'out_of_coverage',distanceKm:11.2,message:'Fuera de cobertura. Comparte otra dirección o ubicación.'});
  await h.sendQueued(`A ${place} entrada 43 apartamento 48`);const reply=await h.sendQueued(`${place} entrada 43 apartamento 48`);
  expect(reply).toMatch(/cobertura|ubicaci[oó]n/i);expect(reply).not.toMatch(/n[uú]mero de contacto|c[oó]mo pagas/i);expect(h.conv.sessionData.address?.toLowerCase().split(place.toLowerCase()).length).toBe(2);expect(h.conv.sessionData.deliveryOutOfCoverage).toBe(true);expect(h.conv.sessionData.cart).toHaveLength(1);
 });
});

describe('A fresh abbreviated street in a purchase burst overrides saved delivery data',()=>{
 const fixtures=[{menu:products,order:'Veci me vendes un pollo frito y una sopa de mondongo',ids:[1,45]},{menu:[{id:65971,code:65971,name:'Ravioles De Espinaca',price:23000,availableNow:true,attributes:[]},{id:65972,code:65972,name:'Crema De Tomate',price:9000,availableNow:true,attributes:[]}],order:'Me vendes un Ravioles De Espinaca y una Crema De Tomate',ids:[65971,65972]}];
 for(const f of fixtures)for(const enabled of [false,true])for(const street of ['Tv 78C #6D-48','Tv. 78C #6D-48','Transversal 78C #6D-48','Kr 78C #6D-48'])it(`${f.ids[0]} agent=${enabled} ${street}`,async()=>{
  jest.useFakeTimers();try{
   const h=harness(f.menu,enabled);h.cfg.paymentMethods=DEFAULT_PAYMENT_METHODS.map(method=>({...method,enabled:method.flow!=='mercadopago'}));Object.assign(h.conv.sessionData,{lastDeliveryAddress:'Calle 6a #75-56 ap 302 interior 1',phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});h.service.ordersService.create=jest.fn().mockResolvedValue({id:6597,dailyOrderNumber:97});
   h.service.ensureDeliveryFeeQuoted=jest.fn(async(session:WhatsappSessionData)=>({session:{...session,addressConfirmed:true,deliveryFeeCalculated:2000}}));
   const messages=[f.order,'por fa',street];const jobs=messages.map((text,index)=>h.service.handleIncoming({waId:'customer',phoneE164:h.conv.phoneE164,messageId:`fresh-address-${index}`,messageType:'text',text,timestamp:Math.floor(Date.now()/1000),raw:{}}));await jest.advanceTimersByTimeAsync(10000);await Promise.all(jobs);
   expect(h.conv.sessionData.cart.map((line:any)=>line.productId).sort()).toEqual([...f.ids].sort());expect(h.conv.sessionData.address).toMatch(/78\s*C.*6\s*D.*48/i);expect(h.conv.state).toBe('awaiting_payment');expect(h.replies.join('\n')).not.toMatch(/75.?56|misma direcci[oó]n|algo m[aá]s|en qu[eé] barrio/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
   await h.sendQueued('1');expect(h.conv.state).toBe('awaiting_final_confirm');expect(h.service.ordersService.create).not.toHaveBeenCalled();await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.address).toMatch(/78\s*C.*6\s*D.*48/i);expect(dto.phone).toMatch(/3000000001/);expect(dto.items).toHaveLength(2);
  }finally{jest.useRealTimers();}
 });
});

describe('Combo upgrade preserves the exact flavour of a previously selected bottle',()=>{
 const fixtures=[{food:'Sandwich Serrano',drink:'Coca Cola 1.5L',options:['Original','Zero'],included:['Coca Cola','Coca Cola Zero'],requested:['Coca Cola','Coca Cola Zero']},{food:'Bowl De Lentejas',drink:'Te De Durazno 1.5L',options:['Clasico','Sin Azucar'],included:['Te De Durazno','Te De Durazno Sin Azucar'],requested:['Te De Durazno','Te De Durazno Sin Azucar']}];
 for(const f of fixtures)for(const enabled of [false,true])for(const target of [0,1])it(`${f.food} bottle=${f.options[1]} target=${f.requested[target]} agent=${enabled}`,async()=>{
  const main={id:66001,code:66001,name:f.food,price:18000,availableNow:true,attributes:[]};const drink={id:66002,code:66002,name:f.drink,categoryName:'Bebidas',price:6000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:f.options}]};const combo={id:66003,code:66003,name:'Combo De '+f.food,description:'Incluye bebida de 1.5L',price:24000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:f.included}]};const h=harness([main,drink,combo],enabled);
  Object.assign(h.conv.sessionData,{cart:[{productId:main.id,code:main.code,name:main.name,unitPrice:main.price,quantity:1},{productId:drink.id,code:drink.code,name:drink.name,unitPrice:drink.price,quantity:1,attributes:[{attributeName:'Sabor',attributeValue:f.options[1]}]}],orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});h.service.ordersService.create=jest.fn().mockResolvedValue({id:6600,dailyOrderNumber:99});
  const reply=await h.sendQueued(`el ${f.food} damelo en combo con ${f.requested[target]}`);const expectedIds=target===1?[combo.id]:[drink.id,combo.id];expect(h.conv.sessionData.cart.map((line:any)=>line.productId).sort()).toEqual(expectedIds.sort());expect(h.conv.sessionData.cart.find((line:any)=>line.productId===combo.id)?.attributes).toContainEqual({attributeName:'Bebida',attributeValue:f.included[target]});expect(reply).toContain(f.included[target]);if(target===1)expect(reply).not.toMatch(/siguen aparte en tu pedido/i);else {expect(reply).toMatch(/siguen aparte en tu pedido/i);expect(reply).toContain(f.options[1]);}expect(h.conv.state).toBe('building_cart');
  const before=structuredClone(h.conv.sessionData.cart);const price=await h.sendQueued('Cuánto suma mi pedido');expect(price).toMatch(target===1?/24[.,]000/:/30[.,]000/);expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.state).toBe('building_cart');await h.sendQueued('nada más');await h.sendQueued('1');expect(h.service.ordersService.create).not.toHaveBeenCalled();await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toHaveLength(expectedIds.length);expect(dto.items.find((line:any)=>line.productId===combo.id)?.attributes).toContainEqual({attributeName:'Bebida',attributeValue:f.included[target]});
 });
});


describe('October 18 empty order boundaries', () => {
  for (const enabled of [false,true]) for (const state of ['building_cart','awaiting_payment','awaiting_final_confirm']) {
    it(`empty cart cannot create an order agent=${enabled} state=${state}`, async () => {
      const h=harness(products,enabled);h.conv.state=state;
      Object.assign(h.conv.sessionData,{cart:[],orderType:'pickup',fulfillmentChosen:true,paymentMethod:'cash',phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
      h.service.ordersService.create=jest.fn();
      for(const text of ['confirmar','sí','1']) {
        await h.sendQueued(text);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
        expect(h.replies.at(-1)).not.toMatch(/pedido qued[oó] registrado|orden #/i);
      }
    });
  }
});

describe('Lettered internal units survive checkout interruptions across menus',()=>{
 const fixtures=[
  {name:'Ravioles De Ricota',place:'Conjunto Los Olivos',details:'torre B apartamento 304B'},
  {name:'Bowl De Garbanzos',place:'Edificio Las Acacias',details:'interior 2A oficina 405'},
  {name:'Sandwich De Pavo',place:'Residencial Los Cedros',details:'bloque C casa 12A'},
 ];
 for(const f of fixtures)for(const enabled of [false,true])for(const placeFirst of [false,true])it(`${f.name} agent=${enabled} placeFirst=${placeFirst}`,async()=>{
  const product={id:66801,code:66801,name:f.name,price:21000,availableNow:true,attributes:[]};
  const h=harness([product],enabled);
  h.cfg.paymentMethods=DEFAULT_PAYMENT_METHODS.map(method=>({...method,enabled:method.flow!=='mercadopago'}));
  Object.assign(h.conv.sessionData,{lastDeliveryAddress:'Calle 90 11 22',phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:6680,dailyOrderNumber:109});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  h.service.ensureDeliveryFeeQuoted=jest.fn(async(session:WhatsappSessionData)=>({session:{...session,addressConfirmed:!!session.address,deliveryFeeCalculated:session.address?2000:0}}));
  const street='Calle 10 #81A-20';
  const destination=placeFirst?`${f.place}, ${street}, ${f.details}`:`${street}, ${f.place}, ${f.details}`;
  await h.sendQueued(`Me regalas un ${f.name} para ${destination}`);
  expect(h.cartRows()).toEqual([expect.objectContaining({id:product.id,qty:1})]);
  expect(h.conv.sessionData.address).toContain(f.place);expect(h.conv.sessionData.address).toContain(f.details);
  expect(h.conv.sessionData.address).toContain('81A-20');expect(h.conv.state).toBe('awaiting_payment');
  expect(h.replies.at(-1)).not.toMatch(/algo m[aá]s|misma direcci[oó]n/i);
  const cart=structuredClone(h.conv.sessionData.cart),address=h.conv.sessionData.address;
  await h.sendQueued('cuánto suma mi pedido');expect(h.conv.sessionData.cart).toEqual(cart);expect(h.conv.sessionData.address).toBe(address);expect(h.conv.state).toBe('awaiting_payment');
  const phoneReply=await h.sendQueued('300 000 0004');expect(phoneReply).toMatch(/tel[eé]fono.*actualizad/i);expect(h.conv.sessionData.address).toBe(address);expect(h.conv.sessionData.cart).toEqual(cart);
  await h.sendQueued('a nombre Cristina, contraentrega');expect(h.conv.customerName).toBe('Cristina');expect(h.conv.state).toBe('awaiting_final_confirm');expect(h.replies.at(-1)).toContain(f.details);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.address).toBe(address+' / Contraentrega');expect(dto.customerName).toBe('Cristina');expect(dto.phone).toMatch(/3000000004/);expect(dto.items).toHaveLength(1);expect(dto.items[0].productId).toBe(product.id);
 });
});
