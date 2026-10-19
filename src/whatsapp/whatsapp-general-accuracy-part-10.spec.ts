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


describe('Código de producto no es cantidad — dos catálogos',()=>{
  const bowl={id:9855,code:7,name:'Bowl Mediterraneo',price:18000,availableNow:true,attributes:[]};
  for(const fixture of [{menu:products,id:23,code:23},{menu:[bowl],id:9855,code:7}]){
    it.each([['código CODE',1],['#CODE',1],['dos del código CODE',2],['código CODE x3',3]])('conserva cantidad de %s para '+fixture.code,async(template,qty)=>{
      const h=harness(fixture.menu,false);await h.sendQueued(String(template).replace('CODE',String(fixture.code)));
      expect(h.cartRows()).toEqual([expect.objectContaining({id:fixture.id,qty})]);
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
  it.each(cases)('$kind sin agente conserva la variante válida y avisa la que faltó', async ({ menu, id, name, attribute, accepted, text }) => {
    const h = harness(menu as typeof products, false);
    h.service.ordersService.create = jest.fn();
    const reply = await h.sendQueued(text) || '';
    const rows = h.cartRows().filter((row) => row.id === id);
    expect(rows).toEqual([expect.objectContaining({ qty: 1, attrs: [`${attribute}:${accepted}`] })]);
    expect(rows[0].note || '').not.toMatch(/camarones/i);
    expect(reply).toMatch(new RegExp(`no manejamos: _${name.toLowerCase()} con camarones_`, 'i'));
    expect(reply).toMatch(new RegExp(`Listo ✅ \\*${name}\\*`));
    expect(reply).not.toMatch(/no entend/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
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

describe('Información del menú — contrato abierto frente a datos no documentados',()=>{
 it.each(['','Con papas y ensalada'])('no convierte descripción %j en lista exhaustiva',description=>{
  const menu=[{id:9711,code:9711,name:'Combo De Falafel',description,price:29000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Agua','Limonada']}]}];
  const catalog=new WhatsappCatalogService({} as never);const agent=new WhatsappAgentService({} as never,catalog) as any;
  const result=JSON.parse(agent.executeTool('search_menu',{query:'Qué incluye Combo De Falafel?'},{products:menu,userMessage:'Qué incluye Combo De Falafel?',actions:{},cart:[]}));
  expect(result.mode).toBe('product_info');expect(result.informationPolicy).toEqual({unlistedDetails:'unknown',optionsAreAlternatives:true});
  expect(result.hint).not.toContain('lo que no aparece, di que no lo trae');expect(result.hint).toMatch(/no est[aá] confirmado/i);
 });
});

describe('Carta parcial — ingrediente no documentado conserva consulta y cierre',()=>{
 for(const name of ['Bowl De Lentejas','Pasta De Hongos'])for(const agent of [false,true])for(const state of ['building_cart','awaiting_payment']){
  it(name+' '+state+' agent='+agent,async()=>{
   const menu=[{id:9721,code:9721,name,description:'Con arroz y ensalada',price:21000,availableNow:true,hasAttributes:false,attributes:[]}];
   const h=harness(menu,agent);h.conv.state=state;h.conv.customerName='Ana';h.conv.sessionData={cart:[{productId:9721,name,code:9721,unitPrice:21000,quantity:2,note:'bolsa aparte',attributes:[]}],productFocus:{productId:9721,name},orderType:'delivery',address:'Calle 12 30 45',addressConfirmed:true};
   const before=structuredClone(h.conv.sessionData.cart);const reply=await h.send('El '+name+' trae salsa de ajo?');
   expect(reply).toMatch(/no tengo ese detalle confirmado/i);expect(reply).toContain('arroz');expect(reply).not.toMatch(/no lo trae|no tenemos|no manejamos/i);expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.state).toBe(state);
   const known=await h.send('Qué trae '+name+'?');expect(known).toContain('arroz');expect(known).not.toMatch(/no tengo ese detalle confirmado/i);
  });
 }
});

describe('Consulta de presentación numérica — no mezclar tamaños hermanos',()=>{
 it.each([
  {menu:products,text:'Qué trae 1/4 Pollo Frito?',name:'1/4 Pollo Frito',other:'1/2 Pollo Frito'},
  {menu:[{id:9751,code:9751,name:'Caja 6 Dumplings',description:'Con ensalada',price:21000,availableNow:true,hasAttributes:false,attributes:[]},{id:9752,code:9752,name:'Caja 12 Dumplings',description:'Con arroz',price:39000,availableNow:true,hasAttributes:false,attributes:[]}],text:'Qué trae Caja 6 Dumplings?',name:'Caja 6 Dumplings',other:'Caja 12 Dumplings'},
 ])('$name en pago',async({menu,text,name,other})=>{
  const h=harness(menu,true);h.conv.state='awaiting_payment';h.conv.customerName='Ana';
  const p=menu.find(p=>p.name===name)!;h.conv.sessionData={cart:[{productId:p.id,name:p.name,code:p.code,unitPrice:p.price,quantity:1,attributes:[]}],orderType:'delivery',address:'Calle 12 30 45',addressConfirmed:true};
  const reply=await h.send(text);expect(reply).toContain(name);expect(reply).not.toContain(other);expect(h.conv.state).toBe('awaiting_payment');expect(h.cartRows()).toHaveLength(1);
 });
});

describe('Consulta más edición de atributo — conserva ambas intenciones', () => {
  const fixtures = [
    { id: 19601, name: 'Bowl De Tofu', description: 'Tofu con verduras y arroz', attr: 'Salsa', first: 'Soja', next: 'Teriyaki', missing: 'Mostaza' },
    { id: 19611, name: 'Combo De Falafel', description: 'Falafel con ensalada y bebida', attr: 'Bebida', first: 'Te', next: 'Agua', missing: 'Chocolate' },
  ];
  for (const f of fixtures) {
    const menu = [
      { id: f.id, code: f.id, name: f.name, description: f.description, price: 21000, availableNow: true, hasAttributes: true,
        attributes: [{ attributeName: f.attr, options: [f.first, f.next] }] },
      { id: f.id + 1, code: f.id + 1, name: f.next, price: 6000, availableNow: true, hasAttributes: false, attributes: [] },
    ];
    const seed = (agent: boolean, state = 'awaiting_payment') => {
      const h = harness(menu, agent);
      h.service.ordersService.create = jest.fn();
      h.conv.state = state;
      h.conv.customerName = state === 'awaiting_name' ? '' : 'Ana';
      Object.assign(h.conv.sessionData, {
        orderType: 'delivery', address: 'Calle 12 30 45', addressConfirmed: true,
        phoneConfirmed: true, contactPhone: h.conv.phoneE164, deliveryFeeCalculated: 3000,
        cart: [{ productId: f.id, code: f.id, name: f.name, unitPrice: 21000, quantity: 2, note: 'sin cebolla',
          attributes: [{ attributeName: f.attr, attributeValue: f.first }] },
          { productId: f.id + 1, code: f.id + 1, name: f.next, unitPrice: 6000, quantity: 1, note: 'aparte', attributes: [] }],
      });
      return h;
    };
    for (const agent of [false, true]) for (const state of ['building_cart', 'awaiting_name', 'awaiting_payment']) {
      for (const kind of ['composición', 'precio']) for (const form of ['pregunta', 'sin signos']) {
        it(`${f.name}, ${state}, agente ${agent}, ${kind}, ${form}`, async () => {
          const h = seed(agent, state);
          const other = structuredClone(h.conv.sessionData.cart[1]);
          const question = kind === 'composición' ? `¿Qué trae ${f.name}?` : `¿Cuánto cuesta ${f.name}?`;
          const query = form === 'pregunta' ? question : question.replace(/[¿?]/g, '');
          await h.sendQueued(`${query} y cambia ${f.attr} de ${f.name} a ${f.next}`);
          expect(h.cartRows()[0]).toMatchObject({ id: f.id, qty: 2, note: 'sin cebolla', attrs: [`${f.attr}:${f.next}`] });
          expect(h.conv.sessionData.cart[0].unitPrice).toBe(21000);
          expect(h.conv.sessionData.cart[1]).toEqual(other);
          expect(h.cartRows()).toHaveLength(2);
          expect(h.conv.state).toBe(state === 'building_cart' ? 'awaiting_payment' : state);
          expect(h.conv.customerName).toBe(state === 'awaiting_name' ? '' : 'Ana');
          expect(h.conv.sessionData.address).toBe('Calle 12 30 45');
          const reply = h.replies.join('\n');
          expect(reply).toMatch(kind === 'composición' ? new RegExp(f.description, 'i') : /precio de.*21[.,]000.*por unidad/i);
          expect(reply).toMatch(new RegExp(f.next, 'i'));
          expect(reply).toMatch(state === 'awaiting_name' ? /nombre/i : /pagas|método de pago/i);
          expect(reply).not.toMatch(/gratis|sin recargo/i);
          expect(h.service.ordersService.create).not.toHaveBeenCalled();
        });
      }
    }
    it.each([false, true])(`${f.name}: opción inexistente no muta (agente %s)`, async agent => {
      const h = seed(agent);
      const before = structuredClone(h.conv.sessionData.cart);
      await h.sendQueued(`¿Qué trae ${f.name}? Y cambia ${f.attr} de ${f.name} a ${f.missing}`);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.replies.join('\n')).toContain(f.description);
      expect(h.replies.at(-1)).toMatch(/no pude confirmar|no.*opción/i);
      expect(h.conv.state).toBe('awaiting_payment');
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
  }
});

describe('Condición de costo y acción independiente — conserva alcance', () => {
  const fixtures = [
    { id: 19801, name: 'Combo De Arepas', attr: 'Bebida', first: 'Te', next: 'Agua', side: 'Torta De Yuca' },
    { id: 19811, name: 'Combo De Gyozas', attr: 'Salsa', first: 'Soja', next: 'Teriyaki', side: 'Ensalada De Pepino' },
  ];
  for (const f of fixtures) {
    const menu = [
      { id: f.id, code: f.id, name: f.name, price: 21000, availableNow: true, hasAttributes: true,
        attributes: [{ attributeName: f.attr, options: [f.first, f.next] }] },
      { id: f.id + 1, code: f.id + 1, name: f.side, price: 6000, availableNow: true, hasAttributes: false, attributes: [] },
    ];
    const seed = (agent: boolean, state = 'awaiting_payment') => {
      const h = harness(menu, agent);
      h.service.ordersService.create = jest.fn();
      h.conv.state = state;
      h.conv.customerName = state === 'awaiting_name' ? '' : 'Ana';
      Object.assign(h.conv.sessionData, {
        orderType: 'delivery', address: 'Calle 12 30 45', addressConfirmed: true,
        phoneConfirmed: true, contactPhone: h.conv.phoneE164, deliveryFeeCalculated: 3000,
        cart: [{ productId: f.id, code: f.id, name: f.name, unitPrice: 21000, quantity: 2, note: 'sin cebolla',
          attributes: [{ attributeName: f.attr, attributeValue: f.first }] },
          { productId: f.id + 1, code: f.id + 1, name: f.side, unitPrice: 6000, quantity: 3, note: 'aparte', attributes: [] }],
      });
      return h;
    };
    const conditioned = `Si es gratis, cambia ${f.attr} de ${f.name} a ${f.next}`;
    for (const agent of [false, true]) for (const state of ['building_cart', 'awaiting_name', 'awaiting_payment']) {
      for (const order of ['condición primero', 'acción primero']) for (const kind of ['quitar', 'cantidad']) {
        it(`${f.name}, ${state}, agente ${agent}, ${order}, ${kind}`, async () => {
          const h = seed(agent, state);
          const host = structuredClone(h.conv.sessionData.cart[0]);
          const action = kind === 'quitar' ? `Quita una de las ${f.side}` : `Deja solo dos ${f.side}`;
          const constraint = kind === 'quitar' ? conditioned : order === 'condición primero'
            ? `Cambia ${f.attr} de ${f.name} a ${f.next} solo si no cuesta más`
            : `Si cobran menos de 3000 por el cambio, pon ${f.attr} de ${f.name} a ${f.next}`;
          const text = order === 'condición primero'
            ? kind === 'quitar' ? `${constraint} y aparte ${action}` : `${constraint}\nAparte ${action}`
            : kind === 'quitar' ? `${action}; además, ${constraint}` : `${action} y además ${constraint}`;
          await h.sendQueued(text);
          expect(h.conv.sessionData.cart[0]).toEqual(host);
          expect(h.cartRows()[1]).toMatchObject({ id: f.id + 1, qty: 2, note: 'aparte', attrs: [] });
          expect(h.conv.state).toBe(state === 'building_cart' ? 'awaiting_payment' : state);
          expect(h.conv.customerName).toBe(state === 'awaiting_name' ? '' : 'Ana');
          expect(h.conv.sessionData.address).toBe('Calle 12 30 45');
          const reply = h.replies.join('\n');
          expect(reply).toMatch(/no tengo.*(?:costo|recargo).*confirmado/i);
          expect(reply).not.toMatch(/el pedido sigue igual|ya.*cambi|sin recargo/i);
          expect(reply).toMatch(new RegExp(f.side+'[\\s\\S]*×2', 'i'));
          expect(reply).toMatch(state === 'awaiting_name' ? /nombre/i : /pagas|método de pago/i);
          expect(h.service.ordersService.create).not.toHaveBeenCalled();
        });
      }
    }
    for (const agent of [false, true]) for (const tail of [
      ` y quita una de las ${f.side}`,
      `; quita una de las ${f.side}`,
      `; aparte si hay descuento, quita una de las ${f.side}`,
    ]) {
      it(`${f.name}: alcance no autorizado ${tail}, agente ${agent}`, async () => {
        const h = seed(agent);
        const before = structuredClone(h.conv.sessionData.cart);
        await h.sendQueued(conditioned + tail);
        expect(h.conv.sessionData.cart).toEqual(before);
        expect(h.conv.state).toBe('awaiting_payment');
        expect(h.replies.at(-1)).toMatch(/no tengo.*(?:costo|recargo).*confirmado/i);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
      });
    }
  }
});

describe('Reemplazo en checkout — sabor o línea pendientes', () => {
  for (const f of [
    { id: 20801, old: 'Batido De Banano', next: 'Jugo Natural', flavor: 'Mango', other: 'Lulo' },
    { id: 20811, old: 'Te Helado', next: 'Limonada Frutal', flavor: 'Fresa', other: 'Maracuya' },
  ]) for (const agent of [false, true]) for (const state of ['awaiting_name', 'awaiting_phone', 'awaiting_payment', 'awaiting_final_confirm']) {
    for (const scenario of ['sabor completo', 'sabor cancelado', 'línea elegida', 'línea cancelada']) {
      it(`${f.old}, agente ${agent}, ${state}, ${scenario}`, async () => {
        const lineChoice = scenario.startsWith('línea');
        const cancel = scenario.endsWith('cancelado') || scenario.endsWith('cancelada');
        const menu = [
          { id: f.id, code: f.id, name: f.old, price: 6000, availableNow: true, hasAttributes: false, attributes: [] },
          { id: f.id + 1, code: f.id + 1, name: f.next, price: 9000, availableNow: true, hasAttributes: true,
            attributes: [{ attributeName: 'Sabor', options: [f.flavor, f.other] }] },
        ];
        const h = harness(menu, agent);
        h.conv.state = state;
        h.conv.customerName = state === 'awaiting_name' ? '' : 'Ana';
        h.service.ordersService.create = jest.fn();
        Object.assign(h.conv.sessionData, { orderType: 'delivery', address: 'Calle 12 30 45', addressConfirmed: true,
          deliveryFeeCalculated: 3000, phoneConfirmed: state !== 'awaiting_phone', contactPhone: h.conv.phoneE164,
          paymentMethod: state === 'awaiting_final_confirm' ? 'cash' : undefined,
          cart: (lineChoice ? [0, 1] : [0]).map(index => ({ productId: f.id, code: f.id, name: f.old,
            unitPrice: 6000, quantity: index ? 1 : 3, note: index ? 'sin azúcar' : 'sin hielo', attributes: [] })) });
        const before = structuredClone(h.conv.sessionData);
        await h.sendQueued(`Cambia ${f.old} por dos ${f.next}${lineChoice ? ' con ' + f.flavor : ''}`);
        expect(h.conv.sessionData.cart).toEqual(before.cart);
        if (lineChoice) {
          expect(h.conv.sessionData.pendingCartReplacement?.options).toHaveLength(2);
          expect(h.conv.state).toBe(state);
        } else {
          expect(h.conv.sessionData.pendingAttribute?.quantity).toBe(2);
          expect(h.conv.sessionData.pendingCheckoutResume).toBe(state);
        }
        await h.sendQueued(cancel ? 'Cancela ese cambio' : lineChoice ? '2' : f.flavor);
        if (cancel) expect(h.conv.sessionData.cart).toEqual(before.cart);
        else {
          const index = lineChoice ? 1 : 0;
          expect(h.conv.sessionData.cart[index]).toMatchObject({ productId: f.id + 1, quantity: 2,
            unitPrice: 9000, note: before.cart[index].note, attributes: [{ attributeName: 'Sabor', attributeValue: f.flavor }] });
          if (lineChoice) expect(h.conv.sessionData.cart[0]).toEqual(before.cart[0]);
        }
        expect(h.conv.state).toBe(state);
        expect(h.conv.customerName).toBe(state === 'awaiting_name' ? '' : 'Ana');
        expect(h.conv.sessionData.address).toBe(before.address);
        expect(h.conv.sessionData.phoneConfirmed).toBe(before.phoneConfirmed);
        expect(h.conv.sessionData.paymentMethod).toBe(before.paymentMethod);
        expect(h.conv.sessionData.pendingAttribute).toBeUndefined();
        expect(h.conv.sessionData.pendingCartReplacement).toBeUndefined();
        expect(h.conv.sessionData.pendingCheckoutResume).toBeUndefined();
        expect(h.replies.at(-1)).toMatch(state === 'awaiting_name' ? /nombre/i : state === 'awaiting_phone' ? /teléfono/i : state === 'awaiting_payment' ? /pagas|pago/i : /confirmar/i);
        expect(h.replies.at(-1)).not.toMatch(/algo más/i);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
      });
    }
  }
});

describe('Reemplazo atómico — enlace de pago existente protege el carrito', () => {
  for (const name of ['Pizza De Setas', 'Ramen De Miso']) for (const agent of [false, true]) for (const state of ['awaiting_payment', 'awaiting_final_confirm']) {
    it(`${name}, agente ${agent}, ${state}`, async () => {
      const menu = [name, 'Ensalada Del Huerto'].map((productName, index) => ({ id: 20901 + index, code: 20901 + index, name: productName,
        price: 20000, availableNow: true, hasAttributes: false, attributes: [] }));
      const h = harness(menu, agent);
      h.conv.state = state;
      h.service.ordersService.create = jest.fn();
      Object.assign(h.conv.sessionData, { mpPreferenceId: 'test-payment-reference', cart: [{ productId: menu[0].id,
        code: menu[0].code, name, unitPrice: 20000, quantity: 1, attributes: [] }] });
      const before = structuredClone(h.conv.sessionData);
      await h.sendQueued(`Cambia ${name} por Ensalada Del Huerto`);
      expect(h.conv.sessionData).toEqual(before);
      expect(h.conv.state).toBe(state);
      expect(h.replies.at(-1)).toMatch(/enlace de pago.*restaurante.*revisar/is);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
  }
});


describe('two family units with distinct preparations and shared options', () => {
  for (const enabled of [true, false]) {
    for (const mode of ['mismatch', 'unknownShared', 'checkout', 'reverse']) {
      it(`family distribution boundary ${mode}, agent ${enabled}`, async () => {
        const menu = ['Miso', 'Shoyu'].map((variant, index) => ({ id: 26201+index, code: 26201+index, name: `Ramen ${variant}`, price: 20000+index*2000,
          availableNow: true, hasAttributes: true, attributes: [
            { attributeName: 'Tamano', options: ['Grande', 'Chico'] },
            { attributeName: 'Caldo', options: ['Vegetal', 'Cerdo'] },
            { attributeName: 'Bebida', options: ['Te', 'Agua'] },
          ] }));
        const other = { id: 26203, code: 26203, name: 'Ensalada De Pepino', price: 7000, availableNow: true, hasAttributes: false, attributes: [] };
        const h = harness([...menu, other], enabled);
        h.conv.sessionData.cart = [{ productId: other.id, code: other.code, name: other.name, quantity: 1, unitPrice: other.price, note: 'sin sal', attributes: [] }];
        const before = structuredClone(h.conv.sessionData.cart);
        if (mode === 'checkout') {
          h.conv.state = 'awaiting_payment';
          Object.assign(h.conv.sessionData, { orderType: 'delivery', address: 'Calle 12 30 45', addressConfirmed: true,
            phoneConfirmed: true, contactPhone: h.conv.phoneE164, deliveryFeeCalculated: 3000 });
        }
        const message = mode === 'reverse' ? 'Me das dos ramen uno con shoyu chico y otro miso grande ambos con caldo vegetal y te bajita de azucar' :
          `Me das ${mode === 'mismatch' ? 'tres' : 'dos'} ramen uno con miso grande y otro shoyu chico ambos con caldo vegetal y ${mode === 'unknownShared' ? 'kombucha' : 'te'} bajita de azucar`;
        await h.sendQueued(message);
        if (mode === 'mismatch' || mode === 'unknownShared') {
          expect(h.conv.sessionData.cart).toEqual(before);
          expect(h.replies.at(-1)).toMatch(/necesito aclarar/i);
        } else {
          expect(h.conv.sessionData.cart[0]).toEqual(before[0]);
          expect(h.cartRows().slice(1).map(line => [line.id, line.qty])).toEqual(mode === 'reverse' ? [[26202, 1], [26201, 1]] : [[26201, 1], [26202, 1]]);
          if (mode === 'checkout') expect(h.conv.state).toBe('awaiting_payment');
        }
      });
    }
    for (const greeting of ['', 'Hola buenas tardes\n\n']) {
      it(`real executive split, greeting ${!!greeting}, agent ${enabled}`, async () => {
        const h = harness(products, enabled);
        await h.sendQueued(greeting + 'Me das dos almuerzos ejecutivo uno con Pollo frito pierna pernil y Otro pechuga Ala broaster ambos con ajiaco y limonada bajita De azucar');
        expect(h.cartRows()).toEqual([
          expect.objectContaining({ id: 22, qty: 1, attrs: expect.arrayContaining(['Presa:Pierna Pernil', 'Sopa:Ajiaco', 'Bebida:Limonada']) }),
          expect.objectContaining({ id: 18, qty: 1, attrs: expect.arrayContaining(['Presa:Ala, pechuga', 'Sopa:Ajiaco', 'Bebida:Limonada']) }),
        ]);
        for (const line of h.conv.sessionData.cart) expect(line.note).toMatch(/bajita.*az[uú]car/i);
        expect(h.replies.join(' ')).not.toMatch(/no manejamos|no tenemos/i);
        const before = structuredClone(h.conv.sessionData.cart);
        for (const followup of ['Es uno con Pollo frito y Otro con Pollo broaster', 'Si', 'Perfecto seria eso']) {
          await h.sendQueued(followup);
          expect(h.conv.sessionData.cart).toEqual(before);
        }
      });
      it(`fictional ramen split, greeting ${!!greeting}, agent ${enabled}`, async () => {
        const menu = ['Miso', 'Shoyu'].map((variant, index) => ({ id: 26101+index, code: 26101+index, name: `Ramen ${variant}`, price: 20000+index*2000,
          availableNow: true, hasAttributes: true, attributes: [
            { attributeName: 'Tamano', options: ['Grande', 'Chico'] },
            { attributeName: 'Caldo', options: ['Vegetal', 'Cerdo'] },
            { attributeName: 'Bebida', options: ['Te', 'Agua'] },
          ] }));
        const h = harness(menu, enabled);
        await h.sendQueued(greeting + 'Me das dos ramen uno con miso grande y otro shoyu chico ambos con caldo vegetal y te bajita de azucar');
        expect(h.cartRows()).toEqual([
          expect.objectContaining({ id: 26101, qty: 1, attrs: expect.arrayContaining(['Tamano:Grande', 'Caldo:Vegetal', 'Bebida:Te']) }),
          expect.objectContaining({ id: 26102, qty: 1, attrs: expect.arrayContaining(['Tamano:Chico', 'Caldo:Vegetal', 'Bebida:Te']) }),
        ]);
        for (const line of h.conv.sessionData.cart) expect(line.note).toMatch(/bajita.*az[uú]car/i);
      });
    }
  }
});

describe('real staging chats: plural combos, golden preparation, recipients, extras and sibling options', () => {
  const fictional = [
    { id: 33101, code: 33101, name: 'Bandeja De Res', price: 22000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 33102, code: 33102, name: 'Res Asada', price: 18000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 33103, code: 33103, name: 'Trucha', price: 26000, availableNow: true, hasAttributes: true,
      attributes: [{ attributeName: 'Preparacion', options: ['Frita', 'Al Vapor'] }] },
    { id: 33104, code: 33104, name: 'Combo Burger', price: 25000, availableNow: true, hasAttributes: true, description: 'Hamburguesa, papa francesa y bebida',
      attributes: [{ attributeName: 'Bebida', options: ['Cola', 'Naranja'] }] },
    { id: 33105, code: 33105, name: 'Te Frio 1L', price: 6000, availableNow: true, hasAttributes: true,
      attributes: [{ attributeName: 'Sabor', options: ['Limon', 'Durazno'] }] },
  ];
  const menus = [
    { label: 'PPP', menu: products, plural: 'Dame dos combos De Pollo frito', pluralId: 99, golden: 'dame un pollo frito bien dorado', goldenId: 1,
      combo: 'Hola Buenos dias me envias Un combo De Pollo broaster con papas saladas es Para los gemelos', comboId: 98, extraProduct: 'dos limonadas',
      options: 'Dame dos coca cola 1.5 original y dos zero', optionsId: 95, optionValues: ['Original', 'Zero'], ask: 'Tiene coca cola De 5 listros', related: 'Coca Cola 1.5L' },
    { label: 'fictional', menu: fictional, plural: 'Dame dos bandejas de res', pluralId: 33101, golden: 'dame una trucha frita bien dorada', goldenId: 33103,
      combo: 'Hola buenas tardes me envias un combo burger con papas saladas es para los gemelos', comboId: 33104, extraProduct: 'dos te frio 1l',
      options: 'dame dos te frio 1l limon y dos durazno', optionsId: 33105, optionValues: ['Limon', 'Durazno'], ask: 'Tiene te frio de 5 litros', related: 'Te Frio 1L' },
  ];
  const awaitingAddress = (menu: any[], enabled: boolean, productId: number) => {
    const h = harness(menu as any, enabled);
    const product = menu.find((p) => p.id === productId);
    h.conv.sessionData.cart = [{ productId: product.id, code: product.id, name: product.name, unitPrice: product.price, quantity: 1, attributes: [] }] as any;
    Object.assign(h.conv.sessionData, { orderType: 'delivery', fulfillmentChosen: true, lastDeliveryAddress: 'Altavista' });
    h.conv.customerName = 'Yordan'; h.conv.state = 'awaiting_address';
    return h;
  };
  for (const enabled of [false, true]) for (const m of menus) {
    it(`${m.label} a plural head noun keeps the named dish, agent ${enabled}`, async () => {
      const h = harness(m.menu as any, enabled);
      await h.sendQueued(m.plural);
      expect(h.cartRows()).toEqual([expect.objectContaining({ id: m.pluralId, qty: 2 })]);
    });
    it(`${m.label} "bien dorado" is a kitchen note, not a missing dish, agent ${enabled}`, async () => {
      const h = harness(m.menu as any, enabled);
      const reply = await h.sendQueued(m.golden);
      expect(reply).not.toMatch(/no manejamos/i);
      expect(h.cartRows()).toEqual([expect.objectContaining({ id: m.goldenId, qty: 1, note: expect.stringMatching(/bien dorad/i) })]);
    });
    it(`${m.label} a greeting, a side request and "es para los gemelos" keep the dish and both notes, agent ${enabled}`, async () => {
      const h = harness(m.menu as any, enabled);
      await h.sendQueued(m.combo);
      expect(h.conv.sessionData.customerNotes).toMatch(/para los gemelos/i);
      if (!enabled) expect(h.cartRows()).toEqual([expect.objectContaining({ id: m.comboId, qty: 1, note: expect.stringMatching(/papas saladas/i) })]);
    });
    it(`${m.label} "lo quiero normal pero que le agreguen unas papitas" clears the change and leaves the extra for the restaurant; a menu product is not an extra, agent ${enabled}`, async () => {
      const h = harness(m.menu as any, enabled);
      const product = (m.menu as any[]).find((p) => p.id === m.comboId);
      h.conv.sessionData.cart = [{ productId: product.id, code: product.id, name: product.name, unitPrice: product.price, quantity: 1,
        attributes: [], note: 'con papas saladas' }] as any;
      h.conv.state = 'building_cart';
      const reply = await h.sendQueued('Lo quiero normal con papa Francesa pero que Le agreguen unas Tres papitas saladas asi como siemore me envian');
      expect(h.cartRows()).toEqual([expect.objectContaining({ id: m.comboId, qty: 1 })]);
      expect(h.cartRows()[0].note).toBeUndefined();
      expect(h.conv.sessionData.customerNotes).toMatch(/revisar con el local.*Tres papitas saladas/i);
      expect(reply).toMatch(/confirmar si se puede y si tiene costo/i);
      await h.sendQueued(`que le agreguen ${m.extraProduct}`);
      expect(h.conv.sessionData.customerNotes).not.toMatch(new RegExp(m.extraProduct, 'i'));
    });
    it(`${m.label} a bare option after a sibling line uses that product and the reply tells them apart, agent ${enabled}`, async () => {
      const h = harness(m.menu as any, enabled);
      const reply = await h.sendQueued(m.options);
      expect(h.cartRows()).toEqual([
        expect.objectContaining({ id: m.optionsId, qty: 2, attrs: [expect.stringMatching(new RegExp(`:${m.optionValues[0]}$`))] }),
        expect.objectContaining({ id: m.optionsId, qty: 2, attrs: [expect.stringMatching(new RegExp(`:${m.optionValues[1]}$`))] }),
      ]);
      expect(reply).toContain(`(${m.optionValues[0]})`);
      expect(reply).toContain(`(${m.optionValues[1]})`);
    });
    it(`${m.label} an unavailable size question offers the related product, agent ${enabled}`, async () => {
      const h = harness(m.menu as any, enabled);
      const reply = await h.sendQueued(m.ask);
      expect(reply).toContain(m.related);
      expect(h.cartRows()).toEqual([]);
    });
    for (const [text, fresh] of [['A otra direccion', true], ['para otra dirección', true], ['the same', false], ['same address', false]] as const) {
      it(`${m.label} "${text}" at the address prompt, agent ${enabled}`, async () => {
        const h = awaitingAddress(m.menu as any, enabled, m.goldenId);
        const reply = await h.sendQueued(text);
        if (fresh) {
          expect(reply).toMatch(/direcci[oó]n nueva/i);
          expect(h.conv.sessionData.addressConfirmed).not.toBe(true);
        } else {
          expect(h.conv.sessionData.address).toBe('Altavista');
          expect(h.conv.sessionData.addressConfirmed).toBe(true);
        }
      });
    }
  }
});

describe('Plain greeting remains a greeting across catalogs',()=>{
 for(const name of ['Sopa De Mondongo','Ensalada De Quinoa'])for(const agent of [false,true])for(const text of ['Hola buenas tardes','Buenas noches vecino']){
  it(name+' '+text+' agent='+agent,async()=>{
   const h=harness([{id:62401,code:62401,name,price:18000,availableNow:true,hasAttributes:false,attributes:[]}],agent);h.cfg.menuUrl='https://example.test/menu';h.service.ordersService.create=jest.fn();
   await h.sendQueued(text);expect(h.cartRows()).toEqual([]);expect(h.replies.join(' ')).toMatch(/hola|buenas|plato|antoja|pedido/i);expect(h.replies.join(' ')).not.toMatch(/no tenemos|no manejamos|no entend/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
 }
});

describe('Single presentation portion size preferences do not postpone purchases',()=>{
 for(const name of ['Porcion de ensalada','Porcion De Verduras'])for(const agent of [false,true])for(const size of ['bien grandes','grandes']){
  it(name+' '+size+' agent='+agent,async()=>{
   const p={id:63001,code:63001,name,price:7000,availableNow:true,hasAttributes:false,attributes:[]};
   const h=harness([p],agent);const reply=await h.sendQueued(`Me vende por favor también tres ${name} ${size}`);
   expect(h.cartRows()).toEqual([expect.objectContaining({id:p.id,qty:3})]);expect(reply).not.toMatch(/te agrego|no pude|no manejamos/i);
   expect(h.conv.sessionData.pendingMatch).toBeFalsy();expect(h.conv.sessionData.pendingMultiOrder).toBeFalsy();
  });
 }
 it('adds three requested portions alongside other sides',async()=>{
  const names=['Porcion De Papa Francesa','Porcion De Yuca Frita','Porcion de ensalada'];const menu=names.map((name,i)=>({id:63011+i,code:63011+i,name,price:7000,availableNow:true,hasAttributes:false,attributes:[]}));
  const h=harness(menu,true);await h.sendQueued('Me vende tres porciones de papa francesa, dos porciones de yuca frita y también tres porciones de ensalada bien grandes, no olvidar la yuca por favor');
  expect(h.cartRows().map(row=>[row.id,row.qty])).toEqual([[63011,3],[63012,2],[63013,3]]);expect(h.replies.join(' ')).not.toMatch(/te agrego|no pude/i);
 });
});


describe('Checkout distributions reject incomplete or mixed plans without changing the pending step',()=>{
 for(const name of ['Cesta De Panes','Bento De Setas','Trio De Tostadas'])for(const state of ['awaiting_payment','awaiting_final_confirm'])for(const mode of ['missing','failed_after_first','mixed_address','no_evidence'])it(`${name} ${state} ${mode}`,async()=>{
  const product={id:65001,code:65001,name,price:19000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Salsa',options:['Suave','Picante']}]};
  const h=harness([product],true);h.conv.state=state;h.conv.sessionData.cart=[{productId:product.id,code:product.code,name,unitPrice:19000,quantity:1,note:'anterior',attributes:[{attributeName:'Salsa',attributeValue:'Suave'}]}];
  const before=structuredClone(h.conv.sessionData.cart);h.service.ordersService.create=jest.fn();
  h.agent.runTurn.mockImplementationOnce(async input=>{
   const service=new WhatsappAgentService({} as never,h.service.catalogService) as any;const actions:any={};
   const ctx={actions,cart:input.cart,products:[product],byId:new Map([[product.id,product]]),userMessage:input.userMessage,setNeedsAttr:()=>{}};
   const quantities=mode==='missing'||mode==='failed_after_first'?[2]:mode==='wrong_total'?[2,3]:mode==='wrong_groups'?[1,3]:[2,2];
   for(const [index,quantity] of quantities.entries())expect(JSON.parse(service.executeTool('add_item',{productId:product.id,quantity,attributes:[{attributeName:'Salsa',attributeValue:index&&mode!=='wrong_options'?'Picante':'Suave'}],note:index?'sin sal':undefined},ctx)).ok).toBe(true);
   if(mode==='mixed_address')actions.setAddress='Calle 99 88 77';
   return {reply:'Listo todo añadido',actions,toolCalls:quantities.map(()=> 'add_item'),purchaseAttempts:mode==='no_evidence'?[]:quantities.map(()=>({productId:product.id,accepted:true})),...(mode==='failed_after_first'?{error:'max_iterations'}:{})};
  });
  const reply=await h.sendQueued(`Quiero cuatro ${name}, 2 con Suave y 2 con Picante; los de Picante sin sal`);
  expect(h.conv.state).toBe(state);expect(h.conv.sessionData.address).not.toBe('Calle 99 88 77');expect(h.conv.sessionData.cart).toEqual(before);expect(reply).toMatch(/reparto.*completo|cantidades.*coinciden/i);expect(reply).not.toContain('todo añadido');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});

describe('Untrusted mixed purchase tool calls without distribution capability cannot partially execute',()=>{
 for(const name of ['Duo De Bao','Trio De Tostadas','Bento Vegetal'])for(const state of ['building_cart','awaiting_payment'])it(`${name} ${state}`,async()=>{
  const product={id:65231,code:65231,name,price:27000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Salsa',options:['Suave','Picante']}]};
  const h=harness([product],true);h.conv.state=state;h.service.ordersService.create=jest.fn();const before=structuredClone(h.conv.sessionData);
  h.agent.runTurn.mockImplementationOnce(async input=>{
   const service=new WhatsappAgentService({} as never,h.service.catalogService) as any;const actions:any={};
   const ctx={actions,cart:input.cart,products:[product],byId:new Map([[product.id,product]]),userMessage:input.userMessage,setNeedsAttr:()=>{}};
   const result=JSON.parse(service.executeTool('add_item',{productId:product.id,quantity:2,attributes:[{attributeName:'Salsa',attributeValue:'Suave'}]},ctx));
   expect(result).toMatchObject({ok:false,error:'question_not_order'});
   return {reply:'Lo añadí todo',actions,toolCalls:['add_item'],purchaseAttempts:[{productId:product.id,accepted:false}]};
  });
  const reply=await h.sendQueued(`Quiero cuatro ${name}, 2 con Suave y 2 con Picante; y dime cuánto cuestan`);
  expect(h.agent.runTurn).toHaveBeenCalledTimes(1);expect(reply).toMatch(/reparto completo.*seguridad/i);expect(reply).not.toContain('Lo añadí');expect(h.conv.sessionData).toEqual(before);expect(h.conv.state).toBe(state);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});

describe('Named catalogue preparations remain products rather than extracted notes',()=>{
 for(const base of ['Pollo','Filete','Vegetal'])for(const enabled of [false,true])it(`${base} agent=${enabled}`,async()=>{
  const menu=[{id:65431,code:65431,name:base,price:19000,availableNow:true,hasAttributes:false,attributes:[]},{id:65432,code:65432,name:`${base} Bien Cocinado`,price:24000,availableNow:true,hasAttributes:false,attributes:[]}];
  const h=harness(menu,enabled);const reply=await h.sendQueued(`Quiero un ${base} Bien Cocinado`);
  expect(reply).not.toMatch(/no (?:manejamos|tenemos)/i);expect(h.conv.sessionData.cart).toHaveLength(1);expect(h.conv.sessionData.cart[0].productId).toBe(65432);
 });
});

describe('Address photo edge cases do not purchase or acknowledge payment',()=>{
 for(const mode of ['empty cart','transfer','retry','caption unreadable','closed','proof'])it(mode,async()=>{
  const h=harness(products,false);h.conv.state=mode==='closed'?'completed':'awaiting_final_confirm';Object.assign(h.conv.sessionData,{cart:mode==='empty cart'?[]:[{productId:23,name:'Arroz Con Pollo',unitPrice:29500,quantity:1}],orderType:'delivery',fulfillmentChosen:true,address:'Calle 1 #2-3',phoneConfirmed:true,contactPhone:h.conv.phoneE164,paymentMethod:'transfer',notesCollected:true});
  h.service.metaService.downloadMedia=jest.fn().mockResolvedValue({buffer:Buffer.from('fixture'),mimeType:'image/png'});h.service.catalogService.getMenuDetailedText=jest.fn().mockResolvedValue('');h.service.conversationService.updateMessageBody=jest.fn();h.service.ordersService.create=jest.fn();
  const analysis={kind:'address',textForBot:'Calle 10 #81A-20 torre B apartamento 304B'};const vision=jest.fn().mockResolvedValue(mode==='proof'?{kind:'payment_proof',textForBot:'Calle 10 #81A-20'}:mode==='caption unreadable'?{kind:'unclear',textForBot:''}:analysis);
  if(mode==='retry')vision.mockResolvedValueOnce({kind:'unclear',textForBot:''});h.service.aiService.analyzeOrderImage=vision;const before=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued('Esta es mi dirección',{messageType:'image',mediaId:`photo-${mode}`});
  expect(h.conv.sessionData.cart).toEqual(before);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(mode==='proof'){expect(reply).toMatch(/comprobante/i);expect(h.conv.sessionData.address).toBe('Calle 1 #2-3');}
  else if(mode==='closed'){expect(h.conv.sessionData.address).toBe('Calle 1 #2-3');expect(reply).toMatch(/cerrado|registrado/i);}
  else if(mode==='caption unreadable'){expect(reply).toMatch(/direcci[oó]n|ubicaci[oó]n/i);expect(reply).not.toMatch(/comprobante|cu[aá]l plato/i);expect(h.conv.sessionData.address).toBe('Calle 1 #2-3');}
  else {expect(reply).not.toMatch(/comprobante|cu[aá]l plato/i);expect(h.conv.sessionData.address).toMatch(/81A-20.*304B/);if(mode==='empty cart')expect(reply).toMatch(/qu[eé].*pedir/i);}
  if(mode==='retry')expect(vision).toHaveBeenCalledTimes(2);
 });
});
