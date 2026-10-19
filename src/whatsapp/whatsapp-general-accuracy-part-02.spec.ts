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

describe('Narración de comensales — el almuerzo no inventa un ejecutivo',()=>{
 it.each([false,true])('platos separados conservan identidad agent=$agent',async(agent)=>{
  const h=harness(products,agent);h.service.ordersService.create=jest.fn();
  await h.sendQueued('Veci, me colaboras con el almuerzo: somos tres, pero solo dos van a comer churrasco, el otro quiere arroz con pollo. Para cada uno una limonada natural. Los churrascos tres cuartos y sin ensalada; al arroz, bastante ají.');
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

describe('Respuesta de consulta respaldada por herramienta durante checkout',()=>{
 const menus=[
  [{id:8921,code:8921,name:'Combo De Falafel',description:'Falafel con pan pita, papas y bebida incluida',price:29000,availableNow:true,hasAttributes:false,attributes:[]}],
  [{id:8931,code:8931,name:'Caja De Onigiris',description:'Tres onigiris acompañados con ensalada y té',price:24000,availableNow:true,hasAttributes:false,attributes:[]}],
 ];
 for(const menu of menus)for(const state of ['awaiting_payment','awaiting_name','awaiting_phone','awaiting_final_confirm']){
  it(menu[0].name+' conserva respuesta y paso '+state,async()=>{
   const h=harness(menu,true);h.conv.state=state;h.conv.customerName=state==='awaiting_name'?'':'Ana';
   h.conv.sessionData={cart:[{productId:menu[0].id,name:menu[0].name,code:menu[0].code,unitPrice:menu[0].price,quantity:2,note:'sin cebolla',attributes:[]}],orderType:'delivery',address:'Calle 18 sur 70 25',addressConfirmed:true,phoneConfirmed:true};
   const before=structuredClone(h.conv.sessionData);
   const answer='Sí, el acompañamiento está incluido en el precio. '+menu[0].description;
   h.agent.runTurn.mockResolvedValue({reply:answer,actions:{},toolCalls:['search_menu']});
   const reply=await h.send('Antes de pagar, ese plato trae acompañamiento o se cobra aparte?');
   expect(h.agent.runTurn).toHaveBeenCalled();expect(reply).toContain(answer);expect(reply).toMatch(state==='awaiting_final_confirm'?/escribe confirmar/i:/Para seguir/i);
   expect(h.conv.state).toBe(state);expect(h.conv.sessionData.cart).toEqual(before.cart);expect(h.conv.sessionData.address).toBe(before.address);expect(h.conv.customerName).toBe(state==='awaiting_name'?'':'Ana');expect(h.conv.sessionData.paymentMethod).toBeUndefined();
  });
 }
});

describe('Pregunta descriptiva con el nombre completo — responde desde la descripción',()=>{
 const falafel=[{id:8921,code:8921,name:'Combo De Falafel',price:29000,description:'Seis falafel con pan pita, papas y bebida incluida de 400ml',availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Limonada','Te Frio']}]}];
 const cases=[
  {kind:'carta',menu:falafel,id:8921,text:'Qué incluye Combo De Falafel, trae papas o se cobran aparte?'},
  {kind:'ppp',menu:products,id:94,text:'El combo de arroz paisa trae papas o se cobran aparte?'},
 ];
 it.each(cases)('$kind agente apagado no dice que no lo ofrecemos',async({menu,text})=>{
  const h=harness(menu as typeof products,false);
  const reply=await h.sendQueued(text)||'';
  expect(reply).not.toMatch(/no te ofrecemos|no lo ofrecemos|no tenemos/i);
  expect(h.cartRows()).toEqual([]);
 });
 it.each(cases)('$kind agente encendido recibe el plato nombrado, no similar_offer',async({menu,id,text})=>{
  const h=harness(menu as typeof products,true);
  const agent=new WhatsappAgentService({getEffectiveConfig:async()=>({openaiApiKey:'offline-key',openaiModel:'gpt-4.1-2025-04-14',systemPrompt:'',localContext:{}})} as never,h.service.catalogService) as any;
  const results:string[]=[];const exec=agent.executeTool.bind(agent);
  agent.executeTool=(...a:unknown[])=>{const r=exec(...a);if(a[0]==='search_menu')results.push(r);return r;};
  h.service.agentService=agent;
  const response=(message:unknown)=>({ok:true,json:async()=>({choices:[{message}]})});
  const original=globalThis.fetch;
  globalThis.fetch=jest.fn()
   .mockResolvedValueOnce(response({content:null,tool_calls:[{id:'desc-0',type:'function',function:{name:'search_menu',arguments:JSON.stringify({query:text})}}]}))
   .mockResolvedValueOnce(response({content:'Sí, trae papas incluidas.'})) as never;
  try{
   const handled=await h.service.tryHandleAgentV1({conv:h.conv,msg:{waId:'customer',phoneE164:h.conv.phoneE164,messageId:'desc-question',messageType:'text',text,raw:{}},session:h.conv.sessionData,text,originalText:text,products:menu,cfg:h.cfg,status:{isOpen:true,message:'Abierto'},businessOpenForBot:true});
   expect(handled).toBe(true);
   expect(results.length).toBe(1);
   const result=JSON.parse(results[0]);
   expect(result.mode).not.toBe('similar_offer');
   expect(results[0]).toContain(String(id));
   expect(h.cartRows()).toEqual([]);
  }finally{globalThis.fetch=original;}
 });
});

describe('Combo nombrado entero — gana el combo cuyas palabras dijo el cliente', () => {
 const burgers = [
  {id:9601,code:9601,name:'Hamburguesa Doble',description:'',price:20000,availableNow:true,hasAttributes:false,attributes:[]},
  {id:9602,code:9602,name:'Combo Hamburguesa Doble Con Papas',description:'Con gaseosa',price:26000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Cola','Naranja']}]},
  {id:9603,code:9603,name:'Combo Hamburguesa Doble Con Aros De Cebolla Gratinados',description:'Con gaseosa',price:29000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Cola','Naranja']}]},
 ];
 const cases: Array<[string, any[], string, number]> = [
  ['PPP', products, 'quiero un combo arroz chino medio pollo', 97],
  ['PPP', products, 'quiero un combo arroz chino con costillas', 85],
  ['ficticio', burgers, 'quiero un combo hamburguesa doble papas', 9602],
  ['ficticio', burgers, 'quiero un combo hamburguesa doble aros de cebolla', 9603],
 ];
 for (const agent of [false, true]) {
  it.each(cases.map(([label, menu, text, id]) => [`${label}: ${text}`, menu, text, id] as const))(`agente ${agent ? 'on' : 'off'} %s`, async (_title, menu, text, id) => {
   const h = harness(menu, agent);
   await h.sendQueued(text);
   const session = h.conv.sessionData as any;
   const chosen = session.pendingAttribute?.productId ?? h.cartRows()[0]?.id;
   if (agent && chosen === undefined) expect(h.agent.runTurn).toHaveBeenCalled();
   else expect(chosen).toBe(id);
  });
 }
});

describe('courier knows destination does not ask restaurant location', () => {
  for (const phrase of ['Los domiciliarios ya sabe donde es', 'Los repartidores ya conocen la casa', 'Ustedes ya saben donde es', 'Los muchachos ya han venido', 'No, el mensajero ya conoce donde queda']) {
    for (const enabled of [true, false]) {
      it(`${phrase}, agent ${enabled}`, async () => {
        const h = harness(products, enabled);
        h.conv.state = 'awaiting_address';
        Object.assign(h.conv.sessionData, { orderType: 'delivery', address: 'Donde doña Matilde', addressConfirmed: false,
          cart: [{ productId: 1, code: 1, name: '1 Pollo Frito', unitPrice: 41000, quantity: 1, attributes: [] }] });
        const before = structuredClone(h.conv.sessionData);
        await h.sendQueued(phrase);
        expect(h.conv.sessionData).toEqual(before);
        expect(h.conv.state).toBe('awaiting_address');
        expect(h.replies.join(' ')).toMatch(/direcci[oó]n.*ubicaci[oó]n|ubicaci[oó]n.*direcci[oó]n/is);
        expect(h.replies.join(' ')).toMatch(/no tengo|no conozco/i);
        expect(h.replies.join(' ')).not.toMatch(/recoges|google.com\/maps|Dg\. 6b/i);
      });
    }
  }
});

describe('saved address affirmative paraphrases keep delivery', () => {
  for (const phrase of ['Si a la misma direction', 'Sí a la misma dirección', 'si a la misma direcion', 'a la misma', 'si, a la misma por favor', 'sí para la misma dirección']) {
    for (const enabled of [true, false]) {
      it(`${phrase}, agent ${enabled}`, async () => {
        const h = harness(products, enabled);
        h.conv.state = 'awaiting_address';
        Object.assign(h.conv.sessionData, { orderType: 'delivery', lastDeliveryAddress: 'Altavista', addressConfirmed: false,
          contactPhone: h.conv.phoneE164, phoneConfirmed: true, deliveryFeeCalculated: 2000,
          cart: [{ productId: 1, code: 1, name: '1 Pollo Frito', unitPrice: 41000, quantity: 1, attributes: [] }] });
        h.service.ensureDeliveryFeeQuoted = jest.fn(async (session: WhatsappSessionData) => ({ session: { ...session, addressConfirmed: true, deliveryFeeCalculated: 2000 } }));
        await h.sendQueued(phrase);
        expect(h.conv.sessionData.address).toBe('Altavista');
        expect(h.conv.sessionData.orderType).toBe('delivery');
        expect(h.conv.state).toBe('awaiting_payment');
        expect(h.replies.join(' ')).not.toMatch(/no me qued[oó] clara/i);
      });
    }
  }
});


describe('included option change with independent side purchase', () => {
  for (const enabled of [true,false]) {
    for (const [dish,attribute,initial,choice,side] of [
      ['Hamburguesa Clasica','Bebida','Colombiana','Coca Cola','Porcion De Papa Francesa'],
      ['Bowl Vegetal','Salsa','Suave','Picante','Porcion De Garbanzos'],
    ]) {
      it(`${dish}, agent ${enabled}`, async () => {
        const menu=[{id:29101,code:29101,name:dish,price:20000,availableNow:true,hasAttributes:true,attributes:[{attributeName:attribute,options:[initial,choice]}]},
          {id:29102,code:29102,name:side,price:7500,availableNow:true,hasAttributes:false,attributes:[]},
          {id:29103,code:29103,name:choice,price:4500,availableNow:true,hasAttributes:false,attributes:[]}];
        const h=harness(menu,enabled);
        h.conv.sessionData.cart=[{productId:29101,code:29101,name:dish,unitPrice:20000,quantity:1,attributes:[{attributeName:attribute,attributeValue:initial}],note:'Sin cebolla'}];
        await h.sendQueued(`Con ${attribute==='Bebida'?'gaseosa ':''}${choice} y una adicionales de ${side.replace(/^Porcion De /,'')}`);
        expect(h.conv.sessionData.cart).toHaveLength(2);
        expect(h.conv.sessionData.cart[0]).toEqual(expect.objectContaining({productId:29101,quantity:1,note:'Sin cebolla',attributes:[{attributeName:attribute,attributeValue:choice}]}));
        expect(h.conv.sessionData.cart[1]).toEqual(expect.objectContaining({productId:29102,quantity:1}));
        expect(h.replies.join(' ')).not.toMatch(/no manejamos|no tenemos/i);
        expect(h.replies.join(' ').match(/algo m[aá]s/gi)?.length || 0).toBeLessThanOrEqual(1);
      });
      it(`${dish}, two possible owners, agent ${enabled}`, async () => {
        const menu=[{id:29101,code:29101,name:dish,price:20000,availableNow:true,hasAttributes:true,attributes:[{attributeName:attribute,options:[initial,choice]}]},
          {id:29104,code:29104,name:`${dish} Doble`,price:26000,availableNow:true,hasAttributes:true,attributes:[{attributeName:attribute,options:[initial,choice]}]},
          {id:29102,code:29102,name:side,price:7500,availableNow:true,hasAttributes:false,attributes:[]},
          {id:29103,code:29103,name:choice,price:4500,availableNow:true,hasAttributes:false,attributes:[]}];
        const h=harness(menu,enabled);
        h.conv.sessionData.cart=[
          {productId:29101,code:29101,name:dish,unitPrice:20000,quantity:1,attributes:[{attributeName:attribute,attributeValue:initial}]},
          {productId:29104,code:29104,name:`${dish} Doble`,unitPrice:26000,quantity:1,attributes:[{attributeName:attribute,attributeValue:initial}]}];
        await h.sendQueued(`Con ${attribute==='Bebida'?'gaseosa ':''}${choice} y una adicionales de ${side.replace(/^Porcion De /,'')}`);
        const changed=h.conv.sessionData.cart.filter(line=>line.attributes?.some(a=>a.attributeValue===choice));
        expect(changed.length).not.toBe(1);
        expect(h.conv.sessionData.cart.some(line=>line.productId===29103)).toBe(false);
      });
      it(`${dish}, additional with required options, agent ${enabled}`, async () => {
        const menu=[{id:29101,code:29101,name:dish,price:20000,availableNow:true,hasAttributes:true,attributes:[{attributeName:attribute,options:[initial,choice]}]},
          {id:29102,code:29102,name:side,price:7500,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Tamano',options:['Pequena','Grande']}]},
          {id:29103,code:29103,name:choice,price:4500,availableNow:true,hasAttributes:false,attributes:[]}];
        const h=harness(menu,enabled);
        h.conv.sessionData.cart=[{productId:29101,code:29101,name:dish,unitPrice:20000,quantity:1,attributes:[{attributeName:attribute,attributeValue:initial}]}];
        await h.sendQueued(`Con ${attribute==='Bebida'?'gaseosa ':''}${choice} y una adicionales de ${side.replace(/^Porcion De /,'')}`);
        expect(h.conv.sessionData.cart.some(line=>line.productId===29103)).toBe(false);
        expect(h.conv.sessionData.cart.filter(line=>line.productId===29102).every(line=>line.attributes?.length)).toBe(true);
      });
    }
  }
});


describe('Beverage category preserves explicit flavor choice',()=>{
 const catalog=new WhatsappCatalogService({} as never);
 it.each(['Bebidas','Bebidas calientes','Jugos','Refrescos'])('catalog category %s requires flavor even for unfamiliar name',categoryName=>{
  const product={id:60201,code:951,name:'Especial Del Dia',price:5000,categoryName,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Flor De Jamaica','Tamarindo']}]};
  expect(catalog.isLikelyDrinkProduct(product)).toBe(true);
  expect(catalog.fillDefaultAttributes(product,[])).toEqual([]);
 });
 it.each(['Platos','Combos con bebidas'])('food category %s is not a beverage category',categoryName=>{
  const product={id:60202,code:952,name:'Especial Del Dia',price:20000,categoryName,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Suave','Picante']}]};
  expect(catalog.isLikelyDrinkProduct(product)).toBe(false);
 });
});

describe('Partial unit preparation interrupts checkout without changing totals',()=>{
 const families=[{name:'Sopa De Ajiaco',plural:'sopas de ajiaco',other:'Sopa De Mondongo',note:'sin arroz',attr:'Tamaño',value:'Grande'},
 {name:'Bao De Hongos',plural:'baos de hongos',other:'Bao De Tofu',note:'sin cilantro',attr:'Salsa',value:'Teriyaki'}];
 for(const f of families)for(const agent of [false,true])for(const state of ['building_cart','awaiting_payment','awaiting_final_confirm'])for(const format of ['quantity first','product first']){
  it(f.name+' '+state+' '+format+' agent='+agent,async()=>{
   const menu=[{id:62001,code:62001,name:f.name,price:18000,availableNow:true,hasAttributes:true,attributes:[{attributeName:f.attr,options:[f.value]}]},
    {id:62002,code:62002,name:f.other,price:12000,availableNow:true,hasAttributes:false,attributes:[]}];
   const h=harness(menu,agent);h.conv.state=state;
   Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,address:'Calle 12 34 56',addressConfirmed:true,deliveryFeeCalculated:2000,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,
    ...(state==='awaiting_final_confirm'?{paymentMethod:'contraentrega'}:{}),cart:menu.map((p,i)=>({productId:p.id,code:p.code,name:p.name,unitPrice:p.price,quantity:i?1:3,attributes:i?[]:[{attributeName:f.attr,attributeValue:f.value}],note:i?'para Ana':'bien empacado'}))});
   h.service.ordersService.create=jest.fn().mockResolvedValue({id:6200,dailyOrderNumber:63});
   const request=format==='quantity first'?'dos de los tres '+f.plural+' '+f.note+' y los demás normales':'de los tres '+f.plural+', dos '+f.note+' y el otro normal';
   await h.sendQueued(request);
   expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:62001,qty:1,note:'bien empacado',attrs:[f.attr+':'+f.value]}),expect.objectContaining({id:62001,qty:2,note:expect.stringContaining(f.note),attrs:[f.attr+':'+f.value]}),expect.objectContaining({id:62002,qty:1,note:'para Ana'})]));
   expect(h.cartRows()).toHaveLength(3);expect(h.cartRows().find(r=>r.qty===2)?.note).toContain('bien empacado');
   expect(h.service.ordersService.create).not.toHaveBeenCalled();expect(h.replies.at(-1)).not.toMatch(/no manejamos|no tenemos|no entend/i);
   const before=structuredClone(h.cartRows());await h.sendQueued(request);expect(h.cartRows()).toEqual(before);
   await h.sendQueued('Pago contraentrega');await h.sendQueued('Si');
   expect(h.conv.state).toBe('completed');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
   const items=h.service.ordersService.create.mock.calls[0][0].items;expect(items).toHaveLength(4);expect(items.filter((item:any)=>item.productId===62001)).toHaveLength(3);expect(items.filter((item:any)=>item.productId===62001&&item.note?.includes(f.note))).toHaveLength(2);expect(items.filter((item:any)=>item.productId===62001&&!item.note?.includes(f.note))).toHaveLength(1);
  });
 }
});

describe('Standard portion preference retains catalog boundaries',()=>{
 for(const scenario of ['sized_sibling','size_attribute','unavailable','unknown_modifier','conditional','question','pending_note']){
  it(scenario,async()=>{
   const p={id:63301,code:63301,name:'Porcion De Verduras',price:7000,availableNow:scenario!=='unavailable',hasAttributes:scenario==='size_attribute',attributes:scenario==='size_attribute'?[{attributeName:'Tamaño',options:['Normal','Grande']}]:[]};
   const menu=[p,...(scenario==='sized_sibling'?[{...p,id:63302,code:63302,name:'Porcion De Verduras Grande',price:12000}]:[])];
   const h=harness(menu,false);if(scenario==='pending_note')h.conv.sessionData.pendingSubsetKitchenNote={productIds:[63301],quantity:1,note:'sin salsa'};
   const before=structuredClone(h.conv.sessionData);const text=scenario==='conditional'?'Si tienes verduras, quiero tres grandes':scenario==='question'?'¿Me vendes tres porciones de verduras grandes?':scenario==='unknown_modifier'?'Quiero tres porciones de verduras grandes con caviar':'Quiero tres porciones de verduras grandes';
   const handled=await h.service.tryHandleStandardPortionPreference(h.conv,'customer',structuredClone(before),text,h.cfg,{});expect(handled).toBe(false);expect(h.conv.sessionData).toEqual(before);
  });
 }
});


describe('Grouped model unit edits — real router to final mocked order', () => {
 const families = ['Caja De Falafel', 'Bento Vegetal', 'Combo De Arepas'];
 for (const name of families) for (const state of ['building_cart', 'awaiting_payment', 'awaiting_final_confirm']) {
  for (const affectedQuantity of [1, 2, 4]) it(name+' '+state+' units='+affectedQuantity, async () => {
   const product = {id:64501,code:64501,name,price:27000,availableNow:true,hasAttributes:true,attributes:[
    {attributeName:'Bebida',options:['Te Frio','Limonada']},{attributeName:'Salsa',options:['Suave','Picante']}]};
   const extra = {id:64502,code:64502,name:'Postre De Coco',price:7000,availableNow:true,hasAttributes:false,attributes:[]};
   const h=harness([product,extra],true);h.conv.state=state;
   Object.assign(h.conv.sessionData,{cart:[{productId:product.id,code:product.code,name,unitPrice:25000,quantity:4,
    note:'sin cebolla',attributes:[{attributeName:'Bebida',attributeValue:'Te Frio'},{attributeName:'Salsa',attributeValue:'Suave'}]},
    {productId:extra.id,code:extra.code,name:extra.name,unitPrice:extra.price,quantity:1,note:'bien empacado',attributes:[]}],
    orderType:'delivery',fulfillmentChosen:true,address:'Calle 12 34 56',addressConfirmed:true,phoneConfirmed:true,
    contactPhone:h.conv.phoneE164,notesCollected:true,deliveryFeeCalculated:2000,...(state==='awaiting_final_confirm'?{paymentMethod:'contraentrega'}:{})});
   h.service.ordersService.create=jest.fn().mockResolvedValue({id:6450,dailyOrderNumber:75});
   const snapshot=structuredClone(h.conv.sessionData);let toolResults:any[]=[];
   h.agent.runTurn.mockImplementationOnce(async input=>{
    const service=new WhatsappAgentService({} as never,h.service.catalogService) as any;
    const actions:any={};const ctx={actions,cart:input.cart,products:[product,extra],byId:new Map([[product.id,product],[extra.id,extra]]),userMessage:input.userMessage,setNeedsAttr:()=>{}};
    toolResults.push(JSON.parse(service.executeTool('get_cart',{},ctx)));
    toolResults.push(JSON.parse(service.executeTool('set_unit_attributes',{productId:product.id,cartLineIndex:0,affectedQuantity,
     attributes:[{attributeName:'Bebida',attributeValue:'Limonada'},{attributeName:'Salsa',attributeValue:'Picante'}]},ctx)));
    toolResults.push(JSON.parse(service.executeTool('get_cart',{},ctx)));
    return {reply:'CAMBIÉ TODAS POR ERROR',actions,toolCalls:['get_cart','set_unit_attributes','get_cart']};
   });
   const reply=await h.sendQueued(`En ${affectedQuantity} unidades prefiero bebida Limonada y salsa Picante; las demás conservan las opciones que tenían`);
   expect(h.agent.runTurn).toHaveBeenCalledTimes(1);expect(toolResults[1].ok).toBe(true);
   expect(h.conv.state).toBe(state==='building_cart'?'awaiting_payment':state);expect(h.service.ordersService.create).not.toHaveBeenCalled();
   const rows=h.conv.sessionData.cart.filter(item=>item.productId===product.id);
   expect(rows.reduce((sum,item)=>sum+item.quantity,0)).toBe(4);
   expect(rows.find(item=>item.attributes?.some(a=>a.attributeValue==='Limonada'))?.quantity).toBe(affectedQuantity);
   if(affectedQuantity<4)expect(rows.find(item=>item.attributes?.some(a=>a.attributeValue==='Te Frio'))?.quantity).toBe(4-affectedQuantity);
   else expect(rows).toHaveLength(1);
   expect(rows.every(item=>item.note==='sin cebolla'&&item.unitPrice===25000)).toBe(true);
   expect(h.conv.sessionData.cart.at(-1)).toEqual(snapshot.cart[1]);expect(h.conv.sessionData.address).toBe(snapshot.address);
   expect(reply).toContain('Limonada');expect(reply).toContain('Picante');expect(reply).not.toContain('CAMBIÉ TODAS');
   if(affectedQuantity<4){expect(reply).toContain('Te Frio');expect(reply).toContain('Suave');}
   if(h.conv.state==='building_cart')await h.sendQueued('Nada más');
   if(h.conv.state==='awaiting_payment')await h.sendQueued('1');
   await h.sendQueued('Confirmar');expect(h.service.ordersService.create).not.toHaveBeenCalled();
   expect(h.replies.at(-1)).toMatch(/precio del men[uú] cambi[oó]/i);
   expect(h.conv.sessionData.cart.filter(item=>item.productId===product.id).reduce((sum,item)=>sum+item.quantity,0)).toBe(4);
   await h.sendQueued('Confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
   const order=h.service.ordersService.create.mock.calls[0][0];expect(order.items).toHaveLength(5);
   const edited=order.items.filter((item:any)=>item.productId===product.id&&item.attributes.some((a:any)=>a.attributeValue==='Limonada'));
   expect(edited).toHaveLength(affectedQuantity);expect(edited.every((item:any)=>item.attributes.some((a:any)=>a.attributeValue==='Picante')&&item.note==='sin cebolla')).toBe(true);
   expect(order.items.filter((item:any)=>item.productId===product.id)).toHaveLength(4);
  });
 }
 for(const state of ['building_cart','awaiting_payment','awaiting_final_confirm']) for(const scenario of ['over_count','unknown_option','overlap','mixed_purchase','mixed_confirm','wrong_index']) {
  it('rejects '+scenario+' without accepting a fragment '+state,async()=>{
   const product={id:64511,code:64511,name:'Caja De Falafel',price:27000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Te Frio','Limonada']}]};
   const h=harness([product],true);h.conv.state=state;
   Object.assign(h.conv.sessionData,{cart:[{productId:product.id,code:product.code,name:product.name,unitPrice:product.price,quantity:4,note:'sin cebolla',attributes:[{attributeName:'Bebida',attributeValue:'Te Frio'}]}],orderType:'delivery',fulfillmentChosen:true,address:'Calle 12 34 56',addressConfirmed:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,deliveryFeeCalculated:2000,...(state==='awaiting_final_confirm'?{paymentMethod:'contraentrega'}:{})});
   h.service.ordersService.create=jest.fn();const before=structuredClone(h.conv.sessionData);
   const edit={productId:product.id,cartLineIndex:scenario==='wrong_index'?2:0,affectedQuantity:scenario==='over_count'?5:2,attributes:[{attributeName:'Bebida',attributeValue:scenario==='unknown_option'?'Chocolate':'Limonada'}]};
   const actions:any={updateUnitOptions:[edit]};if(scenario==='overlap')actions.updateUnitOptions.push({...edit,affectedQuantity:1});
   if(scenario==='mixed_purchase')actions.addItems=[{productId:product.id,quantity:1}];if(scenario==='mixed_confirm')actions.requestConfirm=true;
   h.agent.runTurn.mockResolvedValueOnce({reply:'YA CAMBIÉ Y CONFIRMÉ TODO',actions,toolCalls:['set_unit_attributes']});
   const reply=await h.sendQueued(scenario==='mixed_confirm'?'En dos unidades prefiero bebida Limonada y confirma el pedido':'En dos unidades prefiero bebida Limonada; las demás conservan la bebida anterior');
   expect(h.agent.runTurn).toHaveBeenCalledTimes(1);expect(h.conv.sessionData).toEqual(before);expect(h.conv.state).toBe(state);
   expect(reply).toMatch(/no pude aplicar.*seguridad/i);expect(reply).toMatch(/pedido sigue igual/i);expect(reply).not.toContain('YA CAMBIÉ');
   expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
 }
});

describe('New purchases distribute variants without multiplying named packs',()=>{
 for(const f of [{name:'Duo De Bao',attr:'Relleno',a:'Tofu',b:'Cerdo'},{name:'Trio De Tostadas',attr:'Salsa',a:'Suave',b:'Picante'},{name:'Bento Vegetal',attr:'Arroz',a:'Blanco',b:'Integral'}])for(const counts of [[1,3],[2,2],[3,1]])it(`${f.name} ${counts.join('+')}`,async()=>{
  const product={id:64811,code:64811,name:f.name,price:27000,availableNow:true,hasAttributes:true,attributes:[{attributeName:f.attr,options:[f.a,f.b]}]};
  const h=harness([product],true);
  Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,address:'Calle 12 34 56',addressConfirmed:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,deliveryFeeCalculated:2000});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:6481,dailyOrderNumber:80});
  h.agent.runTurn.mockImplementationOnce(async input=>{
   const service=new WhatsappAgentService({} as never,h.service.catalogService) as any;const actions:any={};
   const ctx={actions,cart:input.cart,products:[product],byId:new Map([[product.id,product]]),userMessage:input.userMessage,setNeedsAttr:()=>{}};
   for(const [index,value] of [f.a,f.b].entries())expect(JSON.parse(service.executeTool('add_item',{productId:product.id,quantity:counts[index],attributes:[{attributeName:f.attr,attributeValue:value}],note:index===1?'sin sal':undefined},ctx)).ok).toBe(true);
   return {reply:'Listo',actions,toolCalls:['add_item','add_item'],purchaseAttempts:[{productId:product.id,accepted:true},{productId:product.id,accepted:true}]};
  });
  const initial=await h.sendQueued(`Quiero cuatro ${f.name}, ${counts[0]} con ${f.a} y ${counts[1]} con ${f.b}; los de ${f.b} sin sal. Para Calle 12 34 56`);
  expect(h.agent.runTurn).toHaveBeenCalledTimes(1);expect(initial).toBeTruthy();
  expect(h.conv.sessionData.cart.map(item=>[item.quantity,item.attributes?.[0].attributeValue])).toEqual([[counts[0],f.a],[counts[1],f.b]]);
  expect(h.conv.sessionData.cart.reduce((sum,item)=>sum+item.quantity*item.unitPrice,0)).toBe(108000);expect(h.conv.sessionData.cart[0].note).toBeFalsy();expect(h.conv.sessionData.cart[1].note).toBe('sin sal');
  const cart=structuredClone(h.conv.sessionData.cart);const reply=await h.sendQueued('Déjame ver el carrito');
  expect(reply).toContain(f.name);expect(reply).toContain(f.a);expect(reply).toContain(f.b);expect(h.conv.sessionData.cart).toEqual(cart);
  if(h.conv.state==='building_cart')await h.sendQueued('Nada más');
  if(h.conv.state==='awaiting_payment')await h.sendQueued('1');
  await h.sendQueued('Confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items=h.service.ordersService.create.mock.calls[0][0].items;expect(items).toHaveLength(4);
  expect(items.filter((item:any)=>item.attributes.some((a:any)=>a.attributeValue===f.b)&&item.note==='sin sal')).toHaveLength(counts[1]);
 });
});

describe('Distributed option requests cannot fall back to partial purchases',()=>{
 for(const name of ['Duo De Bao','Bento Vegetal'])for(const mode of ['disabled','failed','pending'])it(`${name} ${mode}`,async()=>{
  const product={id:64821,code:64821,name,price:27000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Relleno',options:['Tofu','Cerdo']}]};
  const h=harness([product],mode!=='disabled');h.service.ordersService.create=jest.fn();
  if(mode==='failed')h.agent.runTurn.mockResolvedValue({reply:'',actions:{},toolCalls:[],error:'max_iterations'});
  if(mode==='pending')h.conv.sessionData.pendingAttribute={productId:product.id,code:product.code,name,price:product.price,quantity:1,attributes:product.attributes,selected:[]};
  const before=structuredClone(h.conv.sessionData);const state=h.conv.state;
  const reply=await h.sendQueued(`Quiero cuatro ${name}, 2 con Tofu y 2 con Cerdo; los de Cerdo sin sal`);
  expect(reply).toMatch(/aclaremos.*reparto|reparto completo.*aclaremos/i);expect(h.conv.sessionData.cart).toEqual(before.cart);
  expect(h.conv.state).toBe(state);expect(h.conv.sessionData.pendingAttribute).toEqual(before.pendingAttribute);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();if(mode==='pending')expect(h.agent.runTurn).not.toHaveBeenCalled();
 });
});

describe('Cooking reassurance notes survive a pending product-family selection',()=>{
 for(const family of [{query:'pollos',a:'1 Pollo Frito',b:'1 Pollo Broaster',note:'bien cocinados, que no me vayan a salir crudos'},{query:'arepas',a:'Arepa Asada',b:'Arepa Frita',note:'bien cocinadas, que no me vayan a salir crudas'}])for(const enabled of [false,true])it(`${family.query} agent=${enabled}`,async()=>{
  const menu=[{id:65411,code:65411,name:family.a,price:24000,availableNow:true,hasAttributes:family.query==='pollos',attributes:family.query==='pollos'?[{attributeName:'Arepas',options:['Blancas','Fritas']}]:[]},{id:65412,code:65412,name:family.b,price:25000,availableNow:true,hasAttributes:family.query==='pollos',attributes:family.query==='pollos'?[{attributeName:'Arepas',options:['Blancas','Fritas']}]:[]}];const h=harness(menu,enabled);
  Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,address:'Calle 12 34 56',addressConfirmed:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,deliveryFeeCalculated:2000});h.service.ordersService.create=jest.fn().mockResolvedValue({id:6541,dailyOrderNumber:84});
  const reply=await h.sendQueued(`Quiero dos ${family.query} pero ${family.note}`);
  expect(reply).toContain(family.a);expect(reply).toContain(family.b);expect(reply).not.toMatch(/no (?:manejamos|tenemos)/i);expect(h.conv.sessionData.cart).toHaveLength(0);
  const selected=await h.sendQueued('1');expect(selected).not.toMatch(/no (?:manejamos|tenemos)/i);expect(h.conv.sessionData.cart).toHaveLength(1);expect(h.conv.sessionData.cart[0].quantity).toBe(2);expect(h.conv.sessionData.cart[0].note).toMatch(/cocinad[oa]s.*crud[oa]s/i);
  const note=h.conv.sessionData.cart[0].note;if(h.conv.state==='building_cart')await h.sendQueued('Nada más');if(h.conv.state==='awaiting_payment')await h.sendQueued('1');await h.sendQueued('Confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);const items=h.service.ordersService.create.mock.calls[0][0].items;expect(items).toHaveLength(2);expect(items.every((item:any)=>item.note===note)).toBe(true);
 });
});

describe('Explicit recipient and payment in one checkout message',()=>{
 for(const name of ['Combo De Pollo Frito','Caja Vegetariana'])for(const enabled of [false,true])for(const text of ['a nombre Cristina, contraentrega','contraentrega, a nombre de Cristina','Nombre: Cristina; contraentrega'])it(`${name} agent=${enabled} ${text}`,async()=>{
  const product={id:65811,code:65811,name,price:24000,availableNow:true,hasAttributes:false,attributes:[]};const h=harness([product],enabled);h.cfg.paymentMethods=DEFAULT_PAYMENT_METHODS.map(m=>({...m,enabled:m.flow!=='mercadopago'}));h.conv.state='awaiting_payment';h.conv.sessionData={cart:[{productId:product.id,code:product.code,name,unitPrice:24000,quantity:1,note:'Empacar una parte en caja diferente.'}],orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,pickupEtaMinutes:15} as any;h.service.ordersService.create=jest.fn().mockResolvedValue({id:6581,dailyOrderNumber:89});
  const cart=JSON.parse(JSON.stringify(h.conv.sessionData.cart));const reply=await h.sendQueued(text);expect(h.conv.customerName).toBe('Cristina');expect(h.conv.sessionData.cart).toEqual(cart);expect(h.conv.state).toBe('awaiting_final_confirm');expect(h.conv.sessionData.paymentMethod).toBe('cash');expect(reply).toContain('Cristina');expect(reply).not.toMatch(/wilmer|mercado pago|algo m[aá]s/i);
  await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.customerName).toBe('Cristina');expect(dto.items).toHaveLength(1);expect(dto.items[0].note).toBe(cart[0].note);
 });
});

describe('A phone correction acknowledges the new contact and never confirms on payment selection',()=>{
 for(const enabled of [false,true])it(`agent=${enabled}`,async()=>{
  const h=harness(products,enabled);h.cfg.paymentMethods=DEFAULT_PAYMENT_METHODS.map(m=>({...m,enabled:m.flow!=='mercadopago'}));h.conv.state='awaiting_payment';h.conv.sessionData={cart:[{productId:23,code:23,name:'Arroz Con Pollo',unitPrice:29500,quantity:2,note:'con salsa de tomate'}],orderType:'delivery',fulfillmentChosen:true,address:'Calle 10 81A 20',addressConfirmed:true,deliveryFeeCalculated:2000,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true} as any;h.service.ordersService.create=jest.fn().mockResolvedValue({id:6583,dailyOrderNumber:91});const cart=JSON.parse(JSON.stringify(h.conv.sessionData.cart));
  const reply=await h.sendQueued('300 000 0004');expect(reply).toMatch(/tel[eé]fono.*actualizad/i);expect(String(reply).replace(/\D/g,'')).toContain('3000000004');expect(h.conv.sessionData.cart).toEqual(cart);expect(h.conv.state).toBe('awaiting_payment');expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('1');expect(h.conv.state).toBe('awaiting_final_confirm');expect(h.service.ordersService.create).not.toHaveBeenCalled();await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.service.ordersService.create.mock.calls[0][0].phone).toMatch(/3000000004/);
 });
});

describe('Fresh abbreviated address after separate purchase replies continues checkout',()=>{
 for(const enabled of [false,true])for(const street of ['Tv. 78C #6D-48','Kr 78C #6D-48'])it(`agent=${enabled} ${street}`,async()=>{
  const h=harness(products,enabled);Object.assign(h.conv.sessionData,{lastDeliveryAddress:'Calle 6a #75-56 ap 302 interior 1',phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});h.service.ordersService.create=jest.fn().mockResolvedValue({id:6598,dailyOrderNumber:98});
  await h.sendQueued('Veci me vendes un pollo frito y una sopa de mondongo');await h.sendQueued('por fa');const cart=structuredClone(h.conv.sessionData.cart);const reply=await h.sendQueued(street);
  expect(h.conv.sessionData.cart).toEqual(cart);expect(h.conv.sessionData.address).toMatch(/78\s*C.*6\s*D.*48/i);expect(h.conv.state).toBe('awaiting_payment');expect(reply).not.toMatch(/75.?56|misma direcci[oó]n|algo m[aá]s|en qu[eé] barrio/i);expect(reply).toMatch(/c[oó]mo pagas|m[eé]todo de pago/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});

describe("Paired meal attribute replay",()=>{for(const enabled of [false,true])for(const joined of [false,true]){
      it(`two executive meals agent=${enabled} joined=${joined}`, async () => {
        const h = harness(products, enabled);
        const first = 'Por favor me colaboras con dos ejecutivos pierna pernil uno Broaster y otro frito, con limonadas';
        const second = 'Sopas. 1ajiaco y otra mondongo';
        if (joined) await h.sendQueued(first + '\n' + second);
        else { await h.sendQueued(first); await h.sendQueued(second); }
        expect(h.cartRows()).toHaveLength(2);
        expect(h.cartRows().map(line => [line.id, line.qty]).sort((a,b)=>Number(a[0])-Number(b[0]))).toEqual([[18,1],[22,1]]);
        for (const row of h.cartRows()) expect(row.attrs).toEqual(expect.arrayContaining(['Presa:Pierna Pernil','Bebida:Limonada']));
        expect(h.cartRows().map(row=>row.attrs.join(' ')).join(' ')).toMatch(/Ajiaco/);
        expect(h.cartRows().map(row=>row.attrs.join(' ')).join(' ')).toMatch(/Mondongo/);
      });
}});
