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


describe('Incremento pendiente — límites sin mutación',()=>{
 it.each(['Jugo Natural','Gaseosa Artesanal'].flatMap(name=>[false,true].flatMap(agent=>['Añade 28 más','Añade 0 más'].map(text=>({name,agent,text})))))('$name $text agent=$agent',async({name,agent,text})=>{
  const drink={id:21501,code:2201,name,price:8000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mango','Lulo']}]};
  const h=harness([drink] as typeof products,agent);h.service.ordersService.create=jest.fn();await h.sendQueued(`Quiero tres ${name} sin hielo`);
  const before=structuredClone(h.conv.sessionData);const reply=await h.sendQueued(text);
  expect(h.conv.sessionData).toEqual(before);expect(reply||'').toMatch(/entre 1 y 30|pedido sigue igual/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
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


describe('Nombres hermanos — la palabra distintiva dicha decide el plato',()=>{
 const pizzas=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-pizza-menu-1510.json'),'utf8'));
 const crepes=[
  {id:9401,code:9401,name:'Crepe Dulce Nutella',price:14000,description:'Crepe con nutella y helado de vainilla',availableNow:true,hasAttributes:true,attributes:[{attributeName:'Topping',options:['Fresas','Banano']}]},
  {id:9402,code:9402,name:'Crepe Dulce Arequipe',price:13000,description:'Crepe con arequipe y helado de vainilla',availableNow:true,hasAttributes:true,attributes:[{attributeName:'Topping',options:['Fresas','Banano']}]},
 ];
 const cases=[
  {kind:'pizzería',menu:pizzas,text:'hola buenas, quiero una pizza hawaiana con borde relleno de queso y una pizza de pepperoni con borde tradicional, y 3 empanadas de carne',
   rows:[{id:9301,qty:1,attrs:['Borde:Relleno De Queso']},{id:9302,qty:1,attrs:['Borde:Tradicional']},{id:9303,qty:3}]},
  {kind:'crepería',menu:crepes,text:'quiero una crepe de nutella con fresas y una crepe de arequipe con banano',
   rows:[{id:9401,qty:1,attrs:['Topping:Fresas']},{id:9402,qty:1,attrs:['Topping:Banano']}]},
 ];
 it.each(cases.flatMap(c=>[{...c,agent:false},{...c,agent:true}]))('$kind agente=$agent',async({menu,text,rows,agent})=>{
  const h=harness(menu as typeof products,agent);
  const reply=await h.sendQueued(text)||'';
  expect(h.cartRows().map(r=>({id:r.id,qty:r.qty,...(r.attrs?.length?{attrs:r.attrs}:{})})).sort((a,b)=>a.id-b.id)).toEqual(rows);
  expect(reply).not.toMatch(/cuál te gusta/i);
  expect(h.cartRows().every(r=>!r.note)).toBe(true);
 });
 it.each([
  {kind:'pizzería',menu:pizzas,order:'quiero 3 empanadas de carne',ask:'una pregunta, la lasagna trae pan o es aparte?',want:/Lasagna Bolognesa/,forbid:/Empanada De Carne/},
  {kind:'ppp',menu:products,order:'quiero una sopa de ajiaco',ask:'una pregunta, la sobrebarriga trae arroz o es aparte?',want:/Sobrebarriga/,forbid:/Sopa De Ajiaco/},
 ].flatMap(c=>[{...c,agent:false},{...c,agent:true}]))('$kind: preguntar por otro plato no responde con el último conversado (agente=$agent)',async({menu,order,ask,want,forbid,agent})=>{
  const h=harness(menu as typeof products,agent);
  await h.sendQueued(order);
  const before=h.cartRows();
  const reply=await h.sendQueued(ask)||'';
  expect(reply).toMatch(want);
  expect(reply).not.toMatch(forbid);
  expect(h.cartRows()).toEqual(before);
 });
 it.each([
  {kind:'pizzería',menu:pizzas,text:'agrégame una gaseosa sprite',id:9304,attr:'Sabor:Sprite'},
  {kind:'pizzería solo sabor',menu:pizzas,text:'agrégame una sprite',id:9304,attr:'Sabor:Sprite'},
  {kind:'ppp',menu:products,text:'agrégame una quatro',id:34,attr:'Sabor:Quatro'},
 ].flatMap(c=>[{...c,agent:false},{...c,agent:true}]))('$kind: “agrégame” con sabor de bebida sí agrega (agente=$agent)',async({menu,text,id,attr,agent})=>{
  const h=harness(menu as typeof products,agent);
  const reply=await h.sendQueued(text)||'';
  expect(reply).not.toMatch(/No encontré ese producto/);
  if(agent && !h.cartRows().length) expect(h.service.agentService.runTurn).toHaveBeenCalled();
  else expect(h.cartRows()).toEqual([expect.objectContaining({id,qty:1,attrs:[attr]})]);
 });
 it('PPP: nombres idénticos siguen preguntando',()=>{
  const multi=new WhatsappCatalogService({} as never).resolveMultiProductOrder('quiero un trio de tacos y una sopa de ajiaco',products);
  expect(multi?.ambiguous.map(a=>a.candidates.map(p=>p.id).sort())).toEqual([[72,73]]);
 });
});

describe('Edición seguida de total — cotiza el carrito corregido', () => {
  const fixtures = [
    { id: 19401, name: 'Enchiladas De Frijol', price: 19000, other: 'Guacamole', otherPrice: 8000 },
    { id: 19411, name: 'Udon De Verduras', price: 22000, other: 'Onigiri De Setas', otherPrice: 7000 },
  ];
  for (const f of fixtures) for (const state of ['building_cart', 'awaiting_name', 'awaiting_payment']) for (const agent of [false, true]) {
    for (const edit of ['quitar una', 'dejar dos', 'quitar línea']) {
      it(`${f.name}, ${state}, agente ${agent}, ${edit}`, async () => {
        const menu = [
          { id: f.id, code: f.id, name: f.name, price: f.price, hasAttributes: false, attributes: [], availableNow: true },
          { id: f.id + 1, code: f.id + 1, name: f.other, price: f.otherPrice, hasAttributes: false, attributes: [], availableNow: true },
        ];
        const h = harness(menu, agent);
        h.service.ordersService.create = jest.fn();
        h.conv.state = state;
        h.conv.customerName = state === 'awaiting_name' ? '' : 'Ana';
        Object.assign(h.conv.sessionData, {
          orderType: 'delivery', address: 'Calle 12 30 45', addressConfirmed: true,
          contactPhone: h.conv.phoneE164, phoneConfirmed: true, deliveryFeeCalculated: 3000,
          cart: menu.map((p, index) => ({ productId: p.id, code: p.code, name: p.name, unitPrice: p.price,
            quantity: index ? 1 : 3, note: index ? 'aparte' : 'sin cebolla', attributes: [] })),
        });
        const beforeOther = structuredClone(h.conv.sessionData.cart[1]);
        const remaining = edit === 'quitar línea' ? 0 : 2;
        const request = edit === 'quitar una' ? `Quita una de las ${f.name} y dime cuánto queda`
          : edit === 'dejar dos' ? `Deja solo dos ${f.name} y cuánto vale todo?`
          : `Quita las ${f.name}; dime el total por favor`;
        await h.sendQueued(request);
        const changed = h.cartRows().find(row => row.id === f.id);
        if (remaining) expect(changed).toMatchObject({ qty: remaining, note: 'sin cebolla' });
        else expect(changed).toBeUndefined();
        expect(h.conv.sessionData.cart.find(line => line.productId === f.id + 1)).toEqual(beforeOther);
        expect(h.conv.state).toBe(state === 'building_cart' ? 'awaiting_payment' : state);
        expect(h.conv.customerName).toBe(state === 'awaiting_name' ? '' : 'Ana');
        expect(h.conv.sessionData.address).toBe('Calle 12 30 45');
        const reply = h.replies.join('\n');
        const total = remaining * f.price + f.otherPrice + 3000;
        expect(reply).toMatch(new RegExp('Total[^\\n]*'+total.toLocaleString('es-CO').replace(/\./g, '[.,]'), 'i'));
        expect(reply).not.toContain((3 * f.price + f.otherPrice + 3000).toLocaleString('es-CO'));
        expect(reply).toMatch(state === 'awaiting_name' ? /nombre/i : /pagas|método de pago/i);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
      });
    }
  }
});


describe('draft arrival time interrupts price clarification', () => {
  for (const enabled of [true, false]) {
    for (const pending of [false, true]) {
      for (const state of ['awaiting_payment', 'awaiting_final_confirm']) {
        it(`time question ${state}, pending price ${pending}, agent ${enabled}`, async () => {
          const h = harness(products, enabled);h.conv.state = state;
          h.cfg.localContext = { deliveryTimeNote: '45–60 minutos' };
          Object.assign(h.conv.sessionData, { orderType: 'delivery', address: 'Calle 12 30 45', addressConfirmed: true,
            phoneConfirmed: true, contactPhone: h.conv.phoneE164, deliveryFeeCalculated: 2000,
            cart: [22,18].map(id => ({ productId: id, code: id, name: products.find(p => p.id===id).name, unitPrice: 24000, quantity: 1, attributes: [] })) });
          if (pending) h.conv.sessionData.pendingPriceInquiry = { cartSignature: JSON.stringify(h.conv.sessionData.cart), state, productIds: [22,18] };
          h.service.ordersService.create = jest.fn();
          const before = structuredClone(h.conv.sessionData.cart);
          await h.sendQueued('¿Y cuánto tiempo se demora en llegar mi pedido?');
          expect(h.replies.join(' ')).toContain('45–60');
          expect(h.replies.join(' ')).not.toMatch(/de cu[aá]l producto|n[uú]mero de orden/i);
          expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.state).toBe(state);
          expect(h.service.ordersService.create).not.toHaveBeenCalled();
        });
      }
    }
    it(`confirmation plus ETA asks missing payment, agent ${enabled}`, async () => {
      const h = harness(products, enabled);h.conv.state='awaiting_payment';h.cfg.localContext={ deliveryTimeNote:'45–60 minutos' };
      Object.assign(h.conv.sessionData,{orderType:'delivery',address:'Calle 12 30 45',addressConfirmed:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,deliveryFeeCalculated:2000,
        cart:[{productId:22,code:22,name:'Ejecutivo Con Pollo Frito',unitPrice:24000,quantity:1,attributes:[]}]});
      h.service.ordersService.create=jest.fn();
      await h.sendQueued('Sí, el pedido que estoy haciendo lo confirmo ya para que me lo envíen. ¿Y cuánto tiempo se demora?');
      expect(h.replies.join(' ')).toContain('45–60');expect(h.replies.join(' ')).toMatch(/c[oó]mo pagas|m[eé]todo de pago/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();expect(h.conv.state).toBe('awaiting_payment');
    });
  }
});


describe('a whole yes answers the final order summary', () => {
  const fictional = [
    { id: 31401, code: 31401, name: 'Arepa Rellena', price: 9000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 31402, code: 31402, name: 'Jugo Natural', price: 5000, availableNow: true, hasAttributes: true,
      attributes: [{ attributeName: 'Sabor', options: ['Mora', 'Lulo'] }] },
  ];
  const atSummary = (menu: any[], productId: number, enabled: boolean) => {
    const h = harness(menu as any, enabled);
    h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 999, orderNumber: 'X1' });
    const product = menu.find((p: any) => p.id === productId);
    h.conv.sessionData.cart = [{ productId, code: productId, name: product.name, unitPrice: product.price, quantity: 1, attributes: [] }] as any;
    Object.assign(h.conv.sessionData, { orderType: 'delivery', fulfillmentChosen: true, address: 'Calle 9 20 30', addressConfirmed: true,
      phoneConfirmed: true, contactPhone: h.conv.phoneE164, paymentMethod: 'contraentrega', notesCollected: true, deliveryFeeCalculated: 2000 });
    h.conv.customerName = 'Yordan silva';
    h.conv.state = 'awaiting_final_confirm';
    return h;
  };
  for (const enabled of [true, false]) {
    for (const [label, menu, id] of [['PPP', products, 35], ['fictional', fictional, 31401]] as const) {
      for (const text of ['Si Señor', 'Si', 'sí, así está bien', 'claro que sí', 'si confirmo']) {
        it(`${label} "${text}" confirms the order, agent ${enabled}`, async () => {
          const h = atSummary(menu as any, id, enabled);
          await h.sendQueued(text);
          expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
          expect(h.replies.join(' ')).toMatch(/pedido qued[oó] registrado/i);
        });
      }
      for (const text of ['no', 'Señor', 'si pero cambia la direccion']) {
        it(`${label} "${text}" does not confirm, agent ${enabled}`, async () => {
          const h = atSummary(menu as any, id, enabled);
          await h.sendQueued(text);
          expect(h.service.ordersService.create).not.toHaveBeenCalled();
        });
      }
    }
    it(`fictional "si, agrégame un jugo natural" adds the drink, agent ${enabled}`, async () => {
      const h = atSummary(fictional, 31401, enabled);
      await h.sendQueued('si, agrégame un jugo natural');
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      expect(h.replies.join(' ')).not.toMatch(/No tenemos/i);
      expect(h.conv.sessionData.pendingAttribute?.productId).toBe(31402);
    });
  }
});

/** Central boundary guard, not an end-to-end natural-language test for each edit kind. */
describe('confirmation boundary retains unresolved cart edits',()=>{
  for(const key of ['pendingCartRemoval','pendingCartQuantity','pendingCartReplacement','pendingCartAttributeEdit'] as const)
  for(const stale of [true,false])for(const enabled of [true,false]){
    it(`${key}, stale ${stale}, agent ${enabled}`,async()=>{
      const dish={id:41201,code:41201,name:'Gyoza De Hongos',price:19000,availableNow:true,attributes:[]};
      const h=harness([dish],enabled);h.conv.state='awaiting_final_confirm';
      Object.assign(h.conv.sessionData,{orderType:'pickup',fulfillmentChosen:true,address:'Recoge en el local',addressConfirmed:true,
        phoneConfirmed:true,contactPhone:h.conv.phoneE164,paymentMethod:'contraentrega',notesCollected:true,
        cart:[{productId:dish.id,code:dish.code,name:dish.name,unitPrice:19000,quantity:2,attributes:[],note:'Sin cilantro'}]});
      const signature=stale?'old-cart':JSON.stringify(h.conv.sessionData.cart);
      const options=[{cartIndex:0,label:'Gyoza De Hongos · Sin cilantro'}];
      (h.conv.sessionData as any)[key]=key==='pendingCartAttributeEdit'?{cartSignature:signature,sourceText:'cambia salsa',candidates:[{cartIndex:0,name:options[0].label}]}:
        {cartSignature:signature,options,...(key==='pendingCartQuantity'?{quantity:1}:{}),...(key==='pendingCartReplacement'?{addQuery:'Croqueta De Setas'}:{})};
      h.service.ordersService.create=jest.fn();
      const before=structuredClone(h.conv.sessionData);
      await h.service.tryConfirmOrder(h.conv,'customer',structuredClone(before),{skipFinalConfirm:true});
      expect(h.conv.sessionData).toEqual(before);expect(h.conv.state).toBe('awaiting_final_confirm');
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      expect(h.replies.at(-1)).toMatch(stale?/carrito cambi[oó]/i:/elige|cu[aá]l l[ií]nea/i);
      expect(h.replies.at(-1)).not.toMatch(/pedido registrado|confirmar para enviarlo/i);
    });
  }
});

describe('Partial unit preparation respects selection ownership and variants',()=>{
 for(const name of ['Sopa De Ajiaco','Bao De Hongos'])for(const agent of [false,true])for(const state of ['awaiting_payment','awaiting_final_confirm'])for(const mode of ['variants','invalid total','pending attribute','pending subset']){
  it(name+' '+state+' '+mode+' agent='+agent,async()=>{
   const menu=[{id:62101,code:62101,name,price:18000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Salsa',options:['Suave','Picante']}]}];
   const h=harness(menu,agent);h.conv.state=state;h.service.ordersService.create=jest.fn();
   const line={productId:62101,code:62101,name,unitPrice:18000,quantity:3,attributes:[{attributeName:'Salsa',attributeValue:'Suave'}],note:'bien empacado'};
   Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,address:'Calle 12 34 56',addressConfirmed:true,deliveryFeeCalculated:2000,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,cart:[line]});
   if(mode==='variants')h.conv.sessionData.cart.push({...line,quantity:2,attributes:[{attributeName:'Salsa',attributeValue:'Picante'}]});
   if(mode==='pending attribute')h.conv.sessionData.pendingAttribute={productId:62101,code:62101,name,price:18000,quantity:1,attributes:menu[0].attributes,selected:[]};
   if(mode==='pending subset')h.conv.sessionData.pendingSubsetKitchenNote={quantity:1,note:'sin sal',productIds:[62101]};
   const before=structuredClone(h.conv.sessionData);
   await h.sendQueued('dos de los '+(mode==='invalid total'?'cuatro':'tres')+' '+name+' sin cilantro y los demás normales');
   expect(h.conv.sessionData).toEqual(before);expect(h.service.ordersService.create).not.toHaveBeenCalled();
   expect(h.replies.at(-1)).toMatch(/cu[aá]l|selecci[oó]n|unidades|platos/i);expect(h.replies.at(-1)).not.toMatch(/no manejamos|no tenemos/i);
  });
 }
});

describe('Accepted normal portions do not ask the same quantity again',()=>{
 for(const name of ['Porcion de ensalada','Porcion De Verduras'])for(const agent of [false,true])for(const state of ['building_cart','awaiting_payment']){
  it(name+' '+state+' agent='+agent,async()=>{
   const product={id:63101,code:63101,name,price:7000,availableNow:true,hasAttributes:false,attributes:[]};
   const h=harness([product],agent);h.conv.state=state;
   h.conv.sessionData.pendingAddOffer={productId:product.id,name,code:product.code,price:product.price,quantity:3};
   h.replies.push(`¿Te agrego las 3 porciones normales a $7.000 cada una?`);
   h.agent.runTurn.mockResolvedValue({reply:'Necesito aclarar.',actions:{},toolCalls:['add_item'],purchaseAttempts:[{productId:product.id,accepted:false,reason:'dish_not_on_menu'}]});
   const query=name.replace(/^Porcion de /i,'');const reply=await h.sendQueued(`Sí, dame las 3 ${query.endsWith('s')?query:query+'s'} normales por favor`);
   expect(h.cartRows()).toEqual([expect.objectContaining({id:product.id,qty:3})]);expect(reply).not.toMatch(/necesito aclarar|te agrego|no pude|indicas la cantidad/i);expect(h.conv.sessionData.pendingAddOffer).toBeFalsy();
  });
 }
});

describe('Readable shared locations preserve the exact destination and checkout',()=>{
 for(const name of ['Bao De Hongos','Ensalada De Quinoa'])for(const agent of [false,true])for(const state of ['awaiting_payment','awaiting_final_confirm'])for(const kind of ['pin','named_pin','maps_url']){
  it(name+' '+kind+' '+state+' agent='+agent,async()=>{
   const menu=[{id:63401,code:63401,name,price:18000,availableNow:true,hasAttributes:false,attributes:[]}];
   const h=harness(menu,agent);h.service.reply=(WhatsappOrchestratorService.prototype as any).reply.bind(h.service);
   h.conv.state=state;Object.assign(h.conv.sessionData,{cart:[{productId:63401,code:63401,name,unitPrice:18000,quantity:2,attributes:[],note:'sin cebolla'}],orderType:'delivery',fulfillmentChosen:true,address:'Calle 1 2 3',addressConfirmed:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,...(state==='awaiting_final_confirm'?{paymentMethod:'contraentrega'}:{})});
   h.service.ordersService.create=jest.fn().mockResolvedValue({id:6340,dailyOrderNumber:70});
   h.service.recalculateDeliveryFee=jest.fn(async(session:WhatsappSessionData)=>({session:{...session,deliveryFeeCalculated:6000,deliveryDistanceKm:4.7,deliveryOutOfCoverage:false},notice:'🚚 Domicilio: $6.000 · ruta ~4.7 km'}));
   const cart=structuredClone(h.conv.sessionData.cart),lat=4.630504131317139,lng=-74.17561340332031;
   const url='https://maps.google.com/maps?q=4.630504131317139%2C-74.17561340332031&z=17&hl=en';
   await h.sendQueued(kind==='maps_url'?url:'📍 pin',kind==='maps_url'?{}:{messageType:'location',latitude:lat,longitude:lng,...(kind==='named_pin'?{locationName:'Edificio Del Parque',locationAddress:'Calle 12 34 56'}:{})});
   expect(h.conv.sessionData.cart).toEqual(cart);expect(h.conv.sessionData.deliveryLat).toBe(lat);expect(h.conv.sessionData.deliveryLng).toBe(lng);
   expect(h.service.recalculateDeliveryFee).toHaveBeenCalledWith(expect.anything(),expect.anything(),{lat,lng});
   expect(h.replies.join(' ')).toContain(kind==='named_pin'?'Edificio Del Parque':'Ubicación compartida');expect(h.replies.join(' ')).not.toMatch(/4\.630504|-74\.175613|maps\.google\.com\/\?q=/);
   expect(h.conv.state).toBe(state);expect(h.service.ordersService.create).not.toHaveBeenCalled();
   const address=h.conv.sessionData.address;expect(address).toContain('4.630504');expect(address).toContain('-74.175613');
   if(state==='awaiting_payment')await h.sendQueued('1');await h.sendQueued('Confirmar');
   expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(2);
   expect(h.service.ordersService.create.mock.calls[0][0].address).toContain(address);
   expect(h.replies.at(-1)).not.toMatch(/4\.630504|-74\.175613/);
  });
 }
 for(const coords of [[91,-74],[4,-181],[NaN,-74],[4,Infinity]])it('rejects invalid pin '+coords,async()=>{
  const h=harness([],false);h.service.recalculateDeliveryFee=jest.fn();const before=structuredClone(h.conv.sessionData);
  const reply=await h.sendQueued('pin',{messageType:'location',latitude:coords[0],longitude:coords[1]});expect(reply).toMatch(/no pude leer/i);expect(h.conv.sessionData).toEqual(before);expect(h.service.recalculateDeliveryFee).not.toHaveBeenCalled();
 });
});

describe('Checkout purchases preserve complete distributed variants',()=>{
 for(const f of [{name:'Duo De Bao',attr:'Relleno',a:'Tofu',b:'Cerdo'},{name:'Trio De Tostadas',attr:'Salsa',a:'Suave',b:'Picante'},{name:'Bento Vegetal',attr:'Arroz',a:'Blanco',b:'Integral'}])for(const state of ['awaiting_name','awaiting_phone','awaiting_address','awaiting_payment','awaiting_final_confirm'])for(const counts of [[1,3],[2,2],[3,1]])it(`${f.name} ${state} ${counts.join("+")}`,async()=>{
  const product={id:64811,code:64811,name:f.name,price:27000,availableNow:true,hasAttributes:true,attributes:[{attributeName:f.attr,options:[f.a,f.b]}]};
  const h=harness([product],true);h.conv.state=state;
  Object.assign(h.conv.sessionData,{cart:[{productId:product.id,code:product.code,name:product.name,unitPrice:product.price,quantity:1,note:'pedido previo',attributes:[{attributeName:f.attr,attributeValue:f.a}]}],orderType:'delivery',fulfillmentChosen:true,address:'Calle 12 34 56',addressConfirmed:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,deliveryFeeCalculated:2000,...(state==='awaiting_final_confirm'?{paymentMethod:'contraentrega'}:{})});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:6481,dailyOrderNumber:80});
  h.agent.runTurn.mockImplementationOnce(async input=>{
   const service=new WhatsappAgentService({} as never,h.service.catalogService) as any;const actions:any={};
   const ctx={actions,cart:input.cart,products:[product],byId:new Map([[product.id,product]]),userMessage:input.userMessage,setNeedsAttr:()=>{}};
   for(const [index,value] of [f.a,f.b].entries())expect(JSON.parse(service.executeTool('add_item',{productId:product.id,quantity:counts[index],attributes:[{attributeName:f.attr,attributeValue:value}],note:index===1?'sin sal':undefined},ctx)).ok).toBe(true);
   return {reply:'Listo',actions,toolCalls:['add_item','add_item'],purchaseAttempts:[{productId:product.id,accepted:true},{productId:product.id,accepted:true}]};
  });
  const initial=await h.sendQueued(`Quiero cuatro ${f.name}, ${counts[0]} con ${f.a} y ${counts[1]} con ${f.b}; los de ${f.b} sin sal. Para Calle 12 34 56`);
  expect(h.agent.runTurn).toHaveBeenCalledTimes(1);expect(initial).toContain(f.a);expect(initial).toContain(f.b);expect(h.conv.state).toBe(state);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  expect(h.conv.sessionData.cart.map(item=>[item.quantity,item.attributes?.[0].attributeValue])).toEqual([[1,f.a],[counts[0],f.a],[counts[1],f.b]]);
  expect(h.conv.sessionData.cart.reduce((sum,item)=>sum+item.quantity*item.unitPrice,0)).toBe(135000);expect(h.conv.sessionData.cart[0].note).toBe('pedido previo');expect(h.conv.sessionData.cart[1].note).toBeFalsy();expect(h.conv.sessionData.cart[2].note).toBe('sin sal');
  const cart=structuredClone(h.conv.sessionData.cart);const reply=await h.sendQueued('Déjame ver el carrito');
  expect(reply).toContain(f.name);expect(reply).toContain(f.a);expect(reply).toContain(f.b);expect(h.conv.sessionData.cart).toEqual(cart);
  const price=await h.sendQueued(`Cuánto cuesta ${f.name}`);expect(price).toContain('27.000');expect(h.conv.sessionData.cart).toEqual(cart);expect(h.conv.state).toBe(state);
  if(h.conv.state==='awaiting_name')await h.sendQueued('Wilmer Perez');
  if(h.conv.state==='awaiting_phone')await h.sendQueued('3000000001');
  if(h.conv.state==='awaiting_address')await h.sendQueued('Calle 12 34 56');
  if(h.conv.state==='building_cart')await h.sendQueued('Nada más');
  if(h.conv.state==='awaiting_payment')await h.sendQueued('1');
  await h.sendQueued('Confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items=h.service.ordersService.create.mock.calls[0][0].items;expect(items).toHaveLength(5);
  expect(items.filter((item:any)=>item.attributes.some((a:any)=>a.attributeValue===f.b)&&item.note==='sin sal')).toHaveLength(counts[1]);
 });
});

describe('Counted variant inquiries preserve cart and pending checkout fields',()=>{
 for(const name of ['Duo De Bao','Caja De Desayuno','Bento De Setas'])for(const state of ['building_cart','awaiting_name','awaiting_phone','awaiting_address','awaiting_payment','awaiting_final_confirm'])for(const kind of ['price','description','availability'])it(`${name} ${state} ${kind}`,async()=>{
  const product={id:65201,code:65201,name,price:27000,description:'Incluye una guarnición de vegetales.',availableNow:true,hasAttributes:true,attributes:[{attributeName:'Salsa',options:['Suave','Picante']}]};
  const h=harness([product],true);h.conv.state=state;
  Object.assign(h.conv.sessionData,{cart:[{productId:product.id,code:product.code,name,unitPrice:27000,quantity:1,note:'previo',attributes:[{attributeName:'Salsa',attributeValue:'Suave'}]}],orderType:'delivery',fulfillmentChosen:true,address:'Calle 12 34 56',addressConfirmed:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,deliveryFeeCalculated:2000,...(state==='awaiting_final_confirm'?{paymentMethod:'contraentrega'}:{})});
  h.service.ordersService.create=jest.fn();const before=structuredClone(h.conv.sessionData);const customer=h.conv.customerName;
  const query=kind==='price'?`Cuánto cuestan cuatro ${name}, 2 con Suave y 2 con Picante?`:kind==='description'?`Qué trae ${name}, cuatro, 2 con Suave y 2 con Picante?`:`Tienen disponibles cuatro ${name}, 2 con Suave y 2 con Picante?`;
  const reply=await h.sendQueued(query);
  expect(reply).toContain(name);expect(reply).not.toMatch(/aclaremos.*reparto|reparto.*seguridad|cuantas unidades/i);
  if(kind==='price'){expect(reply).toContain('27.000');expect(reply).toContain('108.000');}
  if(kind==='description')expect(reply).toContain('vegetales');
  expect(h.agent.runTurn).not.toHaveBeenCalled();expect(h.conv.customerName).toBe(customer);expect(h.conv.sessionData.pendingAddOffer).toEqual(before.pendingAddOffer);expect(h.conv.sessionData.cart).toEqual(before.cart);expect(h.conv.sessionData.address).toBe(before.address);expect(h.conv.sessionData.paymentMethod).toBe(before.paymentMethod);expect(h.conv.state).toBe(state);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});

describe('Mixed distributed purchases execute while preserving checkout and final DTO',()=>{
 for(const f of [{name:'Duo De Bao',attr:'Relleno',a:'Tofu',b:'Cerdo'},{name:'Trio De Tostadas',attr:'Salsa',a:'Suave',b:'Picante'},{name:'Bento Vegetal',attr:'Arroz',a:'Blanco',b:'Integral'}])for(const state of ['building_cart','awaiting_payment','awaiting_final_confirm'])for(const counts of [[2,2]])for(const aside of ['y dime cuánto cuestan','¿qué precio tienen?'])it(`${f.name} ${state} ${counts.join("+")} ${aside}`,async()=>{
  const product={id:64811,code:64811,name:f.name,price:27000,availableNow:true,hasAttributes:true,attributes:[{attributeName:f.attr,options:[f.a,f.b]}]};
  const h=harness([product],true);h.conv.state=state;
  Object.assign(h.conv.sessionData,{cart:[{productId:product.id,code:product.code,name:product.name,unitPrice:product.price,quantity:1,note:'pedido previo',attributes:[{attributeName:f.attr,attributeValue:f.a}]}],orderType:'delivery',fulfillmentChosen:true,address:'Calle 12 34 56',addressConfirmed:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,deliveryFeeCalculated:2000,...(state==='awaiting_final_confirm'?{paymentMethod:'contraentrega'}:{})});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:6481,dailyOrderNumber:80});
  h.agent.runTurn.mockImplementationOnce(async input=>{
   const service=new WhatsappAgentService({} as never,h.service.catalogService) as any;const actions:any={};
   const ctx={actions,cart:input.cart,products:[product],byId:new Map([[product.id,product]]),userMessage:input.userMessage,verifiedDistributedProductId:input.verifiedDistributedProductId,setNeedsAttr:()=>{}};
   for(const [index,value] of [f.a,f.b].entries())expect(JSON.parse(service.executeTool('add_item',{productId:product.id,quantity:counts[index],attributes:[{attributeName:f.attr,attributeValue:value}],note:index===1?'sin sal':undefined},ctx)).ok).toBe(true);
   return {reply:'Listo',actions,toolCalls:['add_item','add_item'],purchaseAttempts:[{productId:product.id,accepted:true},{productId:product.id,accepted:true}]};
  });
  const initial=await h.sendQueued(`Quiero cuatro ${f.name}, ${counts[0]} con ${f.a} y ${counts[1]} con ${f.b}; los de ${f.b} sin sal; ${aside}. Para Calle 12 34 56`);
  expect(h.agent.runTurn).toHaveBeenCalledTimes(1);expect(initial).toContain(f.a);expect(initial).toContain(f.b);if(state!=='building_cart')expect(h.conv.state).toBe(state);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  expect(h.conv.sessionData.cart.map(item=>[item.quantity,item.attributes?.[0].attributeValue])).toEqual([[1,f.a],[counts[0],f.a],[counts[1],f.b]]);
  expect(h.conv.sessionData.cart.reduce((sum,item)=>sum+item.quantity*item.unitPrice,0)).toBe(135000);expect(h.conv.sessionData.cart[0].note).toBe('pedido previo');expect(h.conv.sessionData.cart[1].note).toBeFalsy();expect(h.conv.sessionData.cart[2].note).toBe('sin sal');
  const cart=structuredClone(h.conv.sessionData.cart);const reply=await h.sendQueued('Déjame ver el carrito');
  expect(reply).toContain(f.name);expect(reply).toContain(f.a);expect(reply).toContain(f.b);expect(h.conv.sessionData.cart).toEqual(cart);
  const price=await h.sendQueued(`Cuánto cuesta ${f.name}`);expect(price).toContain('27.000');expect(h.conv.sessionData.cart).toEqual(cart);if(state!=='building_cart')expect(h.conv.state).toBe(state);
  if(h.conv.state==='awaiting_name')await h.sendQueued('Wilmer Perez');
  if(h.conv.state==='awaiting_phone')await h.sendQueued('3000000001');
  if(h.conv.state==='awaiting_address')await h.sendQueued('Calle 12 34 56');
  if(h.conv.state==='building_cart')await h.sendQueued('Nada más');
  if(h.conv.state==='awaiting_payment')await h.sendQueued('1');
  await h.sendQueued('Confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items=h.service.ordersService.create.mock.calls[0][0].items;expect(items).toHaveLength(5);
  expect(items.filter((item:any)=>item.attributes.some((a:any)=>a.attributeValue===f.b)&&item.note==='sin sal')).toHaveLength(counts[1]);
 });
});

describe('Intensity words inside complete catalogue names keep SKU ownership',()=>{
 for(const suffix of ['Dulce','Picante','Salado','Ácido','Grasoso'])for(const enabled of [false,true])it(`${suffix} agent=${enabled}`,async()=>{
  const menu=[{id:65511,code:65511,name:'Especial',price:9000,availableNow:true,hasAttributes:false,attributes:[]},{id:65512,code:65512,name:`Especial ${suffix}`,price:14000,availableNow:true,hasAttributes:false,attributes:[]}];
  const h=harness(menu,enabled);const reply=await h.sendQueued(`Quiero un Especial ${suffix}`);
  expect(reply).not.toMatch(/no (?:manejamos|tenemos)/i);expect(h.conv.sessionData.cart).toHaveLength(1);expect(h.conv.sessionData.cart[0]).toMatchObject({productId:65512,quantity:1,unitPrice:14000});
 });
});

describe('Complete multiline order supersedes stored checkout contact details',()=>{
 for(const name of ['Combo De Arroz Paisa','Bowl Mediterraneo'])for(const enabled of [false,true])it(`${name} agent=${enabled}`,async()=>{
  const product={id:65821,code:65821,name,price:24000,availableNow:true,hasAttributes:false,attributes:[]};const h=harness([product],enabled);h.cfg.paymentMethods=DEFAULT_PAYMENT_METHODS.map(m=>({...m,enabled:m.flow!=='mercadopago'}));Object.assign(h.conv.sessionData,{lastDeliveryAddress:'Calle 90 11 22',lastContactPhone:h.conv.phoneE164});h.service.ordersService.create=jest.fn().mockResolvedValue({id:6582,dailyOrderNumber:90});
  const reply=await h.sendQueued(`Buenas tardes me das un ${name}\nMaribel Capera\nTorres de Castelló\nDiagonal 3 #83-02\nTorre 3 apto 102\n3000000003`);
  expect(h.conv.sessionData.cart).toHaveLength(1);expect(h.conv.sessionData.cart[0].productId).toBe(product.id);expect(h.conv.customerName).toBe('Maribel Capera');expect(h.conv.sessionData.contactPhone).toMatch(/3000000003/);expect(h.conv.sessionData.address).toMatch(/Diagonal 3.*83-02/i);expect(h.conv.sessionData.address).toMatch(/Torre 3 apto 102/i);expect(h.conv.state).toBe('awaiting_payment');expect(reply).not.toMatch(/algo m[aá]s|misma direcci[oó]n|mercado pago/i);
  await h.sendQueued('1');expect(h.conv.state).toBe('awaiting_final_confirm');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.customerName).toBe('Maribel Capera');expect(dto.phone).toMatch(/3000000003/);expect(dto.address).toMatch(/Diagonal 3.*83-02/i);expect(dto.items).toHaveLength(1);
 });
});

describe('Combo conversion explicitly shows retained separate bottles before checkout',()=>{
 const fixtures=[{food:'Sandwich Serrano',drink:'Coca Cola 1.5L',flavours:['Original','Zero'],included:['Coca Cola','Coca Cola Zero']},{food:'Bowl De Lentejas',drink:'Te De Durazno 1.5L',flavours:['Clasico','Sin Azucar'],included:['Te De Durazno','Te De Durazno Sin Azucar']}];
 for(const f of fixtures)for(const enabled of [false,true])for(const kind of ['different_flavour','extra_quantity','individual_note','another_bottle'])it(`${f.food} agent=${enabled} ${kind}`,async()=>{
  const main={id:66101,code:66101,name:f.food,price:18000,availableNow:true,attributes:[]};const drink={id:66102,code:66102,name:f.drink,categoryName:'Bebidas',price:6000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:f.flavours}]};const combo={id:66103,code:66103,name:'Combo De '+f.food,description:'Incluye bebida de 1.5L',price:24000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:f.included}]};const h=harness([main,drink,combo],enabled);
  const bottle=(flavour:string,quantity=1,note?:string)=>({productId:drink.id,code:drink.code,name:drink.name,unitPrice:drink.price,quantity,attributes:[{attributeName:'Sabor',attributeValue:flavour}],...(note?{note}: {})});const separate=kind==='another_bottle'?[bottle(f.flavours[0]),bottle(f.flavours[1])]:[bottle(kind==='different_flavour'?f.flavours[1]:f.flavours[0],kind==='extra_quantity'?2:1,kind==='individual_note'?'Para Ana':undefined)];
  Object.assign(h.conv.sessionData,{cart:[{productId:main.id,code:main.code,name:main.name,unitPrice:main.price,quantity:1},...separate],orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});h.service.ordersService.create=jest.fn().mockResolvedValue({id:6610,dailyOrderNumber:100});
  const reply=await h.sendQueued(`el ${f.food} damelo en combo con ${f.included[0]}`);const remaining=h.conv.sessionData.cart.filter((line:any)=>line.productId===drink.id);expect(remaining).toEqual(kind==='another_bottle'?[separate[1]]:separate);expect(reply).toMatch(/siguen aparte en tu pedido/i);expect(reply).toContain(f.drink);expect(reply).toContain(kind==='another_bottle'||kind==='different_flavour'?f.flavours[1]:f.flavours[0]);if(kind==='extra_quantity')expect(reply).toMatch(/×2/);expect(h.conv.state).toBe('building_cart');expect(h.service.ordersService.create).not.toHaveBeenCalled();
  const cart=structuredClone(h.conv.sessionData.cart);const total=await h.sendQueued('cuánto suma mi pedido');expect(total).toMatch(kind==='extra_quantity'?/36[.,]000/:/30[.,]000/);expect(h.conv.sessionData.cart).toEqual(cart);expect(h.conv.state).toBe('building_cart');
  await h.sendQueued(`quita ${f.drink}`);expect(h.conv.sessionData.cart).toHaveLength(1);expect(h.conv.sessionData.cart[0]).toMatchObject({productId:combo.id,quantity:1,attributes:[{attributeName:'Bebida',attributeValue:f.included[0]}]});await h.sendQueued('nada más');await h.sendQueued('1');expect(h.service.ordersService.create).not.toHaveBeenCalled();await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(1);
 });
});

describe('Partial combo conversion must not silently replace the whole cart line',()=>{
 const fixtures=[{food:'Sandwich Serrano',drink:'Coca Cola 1.5L',option:'Coca Cola'},{food:'Bowl De Lentejas',drink:'Te De Durazno 1.5L',option:'Te De Durazno'}];
 for(const f of fixtures)for(const enabled of [false,true])for(const initialState of ['building_cart','awaiting_payment'])for(const prefix of [true,false])it(`${f.food} agent=${enabled} ${initialState} prefix=${prefix}`,async()=>{
  const main={id:66201,code:66201,name:f.food,price:18000,availableNow:true,attributes:[]};const drink={id:66202,code:66202,name:f.drink,categoryName:'Bebidas',price:6000,availableNow:true,attributes:[]};const combo={id:66203,code:66203,name:'Combo De '+f.food,description:'Incluye bebida de 1.5L',price:24000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:[f.option]}]};const h=harness([main,drink,combo],enabled);h.conv.state=initialState;Object.assign(h.conv.sessionData,{cart:[{productId:main.id,code:main.code,name:main.name,unitPrice:main.price,quantity:4,note:'Sin cebolla'},{productId:drink.id,code:drink.code,name:drink.name,unitPrice:drink.price,quantity:4}],orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});h.service.ordersService.create=jest.fn().mockResolvedValue({id:6620,dailyOrderNumber:101});
  const before=structuredClone(h.conv.sessionData);const text=prefix?`el ${f.food} damelo solo 2 en combo con ${f.option}`:`el ${f.food} damelo en combo con ${f.option}, pero solo dos`;const reply=await h.sendQueued(text);expect(h.conv.sessionData.cart).toEqual(before.cart);expect(h.conv.state).toBe(initialState);expect(reply).toMatch(/2.*4/);expect(reply).toMatch(/pedido sigue igual/i);expect(reply).not.toMatch(/listo.*cambi[eé]|listo ✅/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  const total=await h.sendQueued('cuánto suma mi pedido');expect(total).toMatch(/96[.,]000/);expect(h.conv.sessionData.cart).toEqual(before.cart);expect(h.conv.state).toBe(initialState);
  if(!prefix){await h.sendQueued(`el ${f.food} damelo en combo con ${f.option}`);expect(h.conv.sessionData.cart).toHaveLength(1);expect(h.conv.sessionData.cart[0]).toMatchObject({productId:combo.id,quantity:4,note:'Sin cebolla'});}
  await h.sendQueued('nada más');await h.sendQueued('1');expect(h.service.ordersService.create).not.toHaveBeenCalled();await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toHaveLength(prefix?8:4);expect(dto.items.filter((line:any)=>line.productId===(prefix?main.id:combo.id))).toHaveLength(4);expect(dto.items.filter((line:any)=>line.productId===(prefix?main.id:combo.id)).every((line:any)=>/sin cebolla/i.test(line.note))).toBe(true);
 });
});

describe('Recipient phone and payment together preserve checkout across menus',()=>{
 for(const name of ['Ravioles De Ricota','Bowl De Garbanzos','Sandwich De Pavo'])for(const enabled of [false,true])for(const text of ['a nombre Cristina, celular 3000000004, contraentrega','contraentrega, teléfono 300 000 0004, nombre: Cristina'])it(`${name} agent=${enabled} ${text}`,async()=>{
  const product={id:67101,code:67101,name,price:21000,availableNow:true,attributes:[]};const h=harness([product],enabled);h.cfg.paymentMethods=DEFAULT_PAYMENT_METHODS.map(method=>({...method,enabled:method.flow!=='mercadopago'}));h.conv.state='awaiting_payment';h.conv.sessionData={cart:[{productId:product.id,code:product.code,name,unitPrice:product.price,quantity:2,note:'Empacar por separado'}],orderType:'delivery',fulfillmentChosen:true,address:'Calle 10 #81A-20 torre B apartamento 304B',addressConfirmed:true,deliveryFeeCalculated:2000,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true} as any;
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:6710,dailyOrderNumber:112});const before=structuredClone(h.conv.sessionData.cart),address=h.conv.sessionData.address;
  const reply=await h.sendQueued(text);expect(h.conv.customerName).toBe('Cristina');expect(h.conv.sessionData.contactPhone).toMatch(/3000000004/);expect(h.conv.sessionData.paymentMethod).toBe('cash');expect(h.conv.state).toBe('awaiting_final_confirm');expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.address).toBe(address);
  expect(reply).toContain('Cristina');expect(String(reply).replace(/\D/g,'')).toContain('3000000004');expect(reply).not.toMatch(/c[oó]mo pagas|algo m[aá]s/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  const total=await h.sendQueued('cuánto suma mi pedido');expect(total).toMatch(/44[.,]000/);expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.contactPhone).toMatch(/3000000004/);
  await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.customerName).toBe('Cristina');expect(dto.phone).toMatch(/3000000004/);expect(dto.address).toContain(address);expect(dto.deliveryFee).toBe(2000);expect(dto.items).toEqual([{productId:67101,attributes:undefined,note:'Empacar por separado'},{productId:67101,attributes:undefined,note:'Empacar por separado'}]);
 });
});

describe('Combo extras can be edited during payment without losing the meal', () => {
 const menus = [
  {meal:'Combo De Sushi',extra:'Media Porcion De Gyozas'},
  {meal:'Combo De Bowl',extra:'Media Porcion De Falafel'},
 ];
 for (const names of menus) for (const enabled of [false,true]) for (const remove of [false,true]) {
  it(`${names.meal} remove=${remove} agent=${enabled}`, async () => {
   const menu=[
    {id:79961,code:79961,name:names.meal,price:30000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Colombiana','Manzana']}]},
    {id:79962,code:79962,name:names.extra,price:8000,availableNow:true,attributes:[]},
   ];
   const h=harness(menu,enabled);
   Object.assign(h.conv.sessionData,{fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
   h.service.ordersService.create=jest.fn().mockResolvedValue({id:7996,dailyOrderNumber:83});
   await h.sendQueued(`Un ${names.meal} con manzana y ${names.extra}`);
   expect(h.cartRows().map(r=>[r.id,r.qty])).toEqual(expect.arrayContaining([[79961,1],[79962,1]]));
   expect(h.cartRows()).toHaveLength(2);
   // Existing preparation note must survive an unrelated extra edit.
   h.conv.sessionData.cart.find(r=>r.productId===79961)!.note='Salsa aparte';
   const customer=h.conv.customerName;
   const meal=structuredClone(h.conv.sessionData.cart.find(r=>r.productId===79961));
   expect(meal?.attributes).toContainEqual({attributeName:'Bebida',attributeValue:'Manzana'});
   await h.sendQueued('no más, recojo en el local');
   expect(h.conv.state).toBe('awaiting_payment');
   const reply=await h.sendQueued(remove ? `Quita la ${names.extra}` : `Deja dos ${names.extra}`);
   expect(reply).not.toMatch(/no manejamos|no tenemos|no me qued[oó] clar|cu[aá]l prefieres/i);
   expect(h.conv.sessionData.cart.find(r=>r.productId===79961)).toEqual(meal);
   expect(h.cartRows().filter(r=>r.id===79962).reduce((n,r)=>n+r.qty,0)).toBe(remove?0:2);
   expect(h.conv.state).toBe('awaiting_payment');
   expect(h.service.ordersService.create).not.toHaveBeenCalled();
   const before=structuredClone(h.conv.sessionData.cart);
   await h.sendQueued('déjame ver el carrito');expect(h.conv.sessionData.cart).toEqual(before);
   await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
   expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
   const dto=h.service.ordersService.create.mock.calls[0][0];
   expect(dto.items).toHaveLength(remove?1:3);
   expect(dto.items.filter((r:any)=>r.productId===79961)).toHaveLength(1);
   expect(dto.items.filter((r:any)=>r.productId===79962)).toHaveLength(remove?0:2);
   expect(dto.orderType).toBe('pickup');
   expect(dto.customerName).toBe(customer);
   expect(dto.phone).toMatch(/3000000001/);
   const orderedMeal=dto.items.find((r:any)=>r.productId===79961);
   expect(orderedMeal.note).toBe('Salsa aparte');
   expect(orderedMeal.attributes).toContainEqual({attributeName:'Bebida',attributeValue:'Manzana'});
  });
 }
});

describe('Coverage questions preserve destination and checkout until an explicit change',()=>{
 for(const name of ['Ravioles De Ricota','Bowl De Garbanzos'])for(const enabled of [false,true])for(const final of [false,true])it(`${name} final=${final} agent=${enabled}`,async()=>{
  const h=harness([{id:80031,code:80031,name,price:21000,availableNow:true,attributes:[]}],enabled);
  Object.assign(h.cfg,{deliveryFeeMode:'route_tiers',restaurantLat:4.62,restaurantLng:-74.15});
  h.cfg.paymentMethods=DEFAULT_PAYMENT_METHODS.map(method=>({...method,enabled:method.flow!=='mercadopago'}));
  Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,notesCollected:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164});
  h.service.deliveryRouting={quoteDeliveryFee:jest.fn().mockImplementation(async({customerAddress}:any)=>customerAddress.includes('90-99')
   ?{ok:false,reason:'out_of_coverage',message:'Esa dirección está fuera de cobertura.',distanceKm:10}
   :{ok:true,fee:customerAddress.includes('45-60')?6000:2000,distanceKm:customerAddress.includes('45-60')?4:1,source:'google_directions',customer:{lat:4.62,lng:-74.15}})};
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:8003,dailyOrderNumber:90});
  await h.sendQueued(`Quiero dos ${name}`);await h.sendQueued('Calle 10 #81A-20 torre B apto 304B');
  if(final)await h.sendQueued('contraentrega');
  const state=h.conv.state;const cart=structuredClone(h.conv.sessionData.cart);const address=h.conv.sessionData.address;
  for(const [question,expected] of [['¿Llegan a Carrera 22 #45-60?',/6[.,]000/],['¿Tienen domicilio a Calle 90 #90-99?',/fuera de cobertura/i]] as const){
   const reply=await h.sendQueued(question);expect(reply).toMatch(expected);
   expect(reply).toMatch(/81A-20/);expect(reply).toMatch(final?/confirmar/i:/c[oó]mo pagas|c[oó]mo.*pagar|m[eé]todo de pago/i);
   expect(h.conv.sessionData.address).toBe(address);expect(h.conv.sessionData.deliveryFeeCalculated).toBe(2000);
   expect(h.conv.sessionData.deliveryOutOfCoverage).not.toBe(true);expect(h.conv.state).toBe(state);
   expect(h.conv.sessionData.cart).toEqual(cart);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  }
  const total=await h.sendQueued('Cuánto es el total');expect(total).toMatch(/44[.,]000/);
  const changed=await h.sendQueued('Cambiar dirección a Carrera 22 #45-60');expect(changed).toMatch(/45-60/);
  expect(h.conv.sessionData.address).toMatch(/45-60/);expect(h.conv.sessionData.address).not.toMatch(/81A-20|304B|torre B/i);
  expect(h.conv.sessionData.deliveryFeeCalculated).toBe(6000);expect(h.conv.sessionData.cart).toEqual(cart);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(!final)await h.sendQueued('contraentrega');expect(h.conv.state).toBe('awaiting_final_confirm');
  await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.address).toMatch(/45-60/);expect(dto.deliveryFee).toBe(6000);
  expect(dto.items).toHaveLength(2);expect(dto.items.every((r:any)=>r.productId===80031)).toBe(true);
 });
});
