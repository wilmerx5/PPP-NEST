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


describe('Preparation questions remain informational', () => {
  it.each([true,false])('does not purchase a dish from a preparation question (agent: %s)', async enabled => {
    const h = harness(products,enabled);
    for (const text of ['Tienes medio pollo broaster sin salsas','Cuánto cuesta un pollo frito sin ensalada']) {
      await h.send(text);
      expect(h.cartRows()).toEqual([]);
    }
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

/** Exercise the public webhook entry, queue, persistent dedup contract and Meta send boundary. */
describe('Foto responde sin texto posterior — entrega de salida',()=>{
 const fictitious=Array.from({length:6},(_,i)=>({id:97801+i,code:7801+i,name:['Ramen Huerto','Bowl Estrella','Gyozas Verdes','Sopa Lunar','Tofu Dorado','Te Jazmin'][i],price:17000,attributes:[],hasAttributes:false,availableNow:true}));
 const ppp=products.filter((p:any)=>[17,23,38,61,62,37].includes(p.code));
 for(const f of [{name:'PPP',menu:products,chosen:ppp},{name:'otra carta',menu:fictitious,chosen:fictitious}]){
  it.each(['sola','duplicada en lote','duplicada en otro webhook','duplicada después de responder','dos fotos distintas','sobre posterior'])('foto %s sin necesitar hola: '+f.name,async mode=>{
   jest.useFakeTimers();try{
    const h=harness(f.menu,false);const claimed=new Set<string>();const claim=h.service.conversationService.claimInboundMessage;
    h.service.conversationService.claimInboundMessage=async(params:any)=>{if(claimed.has(params.waMessageId))return null;claimed.add(params.waMessageId);return claim(params);};
    const order=f.chosen.map((p:any)=>`1 x ${p.name} (código ${p.code}), ${(p.attributes||[]).map((attr:any)=>attr.options[0]).join(', ')}`).join('\n');
    h.service.resolveImageMessage=jest.fn().mockResolvedValue({done:false,text:order});
    if(mode==='dos fotos distintas'){const lines=order.split('\n');h.service.resolveImageMessage.mockResolvedValueOnce({done:false,text:lines.slice(0,3).join('\n')}).mockResolvedValueOnce({done:false,text:lines.slice(3).join('\n')});}
    h.service.metaService.sendText=jest.fn().mockImplementation(async(_waId:string,body:string)=>{h.replies.push(body);return 'outbound-fixture';});
    h.service.sendReplyNow=WhatsappOrchestratorService.prototype['sendReplyNow'].bind(h.service);
    h.service.conversationService.logMessage=jest.fn().mockResolvedValue(undefined);
    h.service.conversationService.touchOutbound=jest.fn().mockResolvedValue(undefined);
    const photo={waId:'customer',phoneE164:h.conv.phoneE164,messageId:'photo-alone',messageType:'image',mediaId:'fixture-image',raw:{}};
    const second=mode==='sobre posterior'?{...photo,messageId:'album-envelope',messageType:'other',mediaId:undefined}:{...photo,messageId:mode==='dos fotos distintas'?'second-photo':photo.messageId,mediaId:mode==='dos fotos distintas'?'fixture-second-image':photo.mediaId,raw:{}};
    h.service.registerIncomingBatch(mode==='duplicada en lote'||mode==='sobre posterior'||mode==='dos fotos distintas'?[photo,second]:[photo]);
    const first=h.service.handleIncoming(photo);const jobs=[first];
    if(mode==='duplicada en otro webhook'){await jest.advanceTimersByTimeAsync(100);h.service.registerIncomingBatch([second]);jobs.push(h.service.handleIncoming(second));}
    else if(mode==='duplicada después de responder'){await jest.advanceTimersByTimeAsync(3000);await first;jobs.push(h.service.handleIncoming(second));}
    else if(mode!=='sola')jobs.push(h.service.handleIncoming(second));
    await jest.advanceTimersByTimeAsync(10000);await Promise.all(jobs);
    expect(f.chosen).toHaveLength(6);expect(h.cartRows()).toHaveLength(6);expect(h.cartRows().every(row=>row.qty===1)).toBe(true);
    expect(h.service.resolveImageMessage).toHaveBeenCalledTimes(mode==='dos fotos distintas'?2:1);
    expect(h.service.metaService.sendText).toHaveBeenCalledTimes(1);
    expect(h.replies.some(body=>/carrito/i.test(body)&&/algo más/i.test(body))).toBe(true);
    for(const p of f.chosen)expect(h.replies.join('\n')).toContain(p.name);
    expect(h.service.outboundHoldByWaId.size).toBe(0);expect(h.service.outboundCarryByWaId.size).toBe(0);
   }finally{jest.useRealTimers();}
  });
 }
});

describe('Después de un dato desconocido — precio, cantidad y pago siguen funcionando',()=>{
 for(const name of ['Bowl De Lentejas','Pasta De Hongos'])for(const agent of [false,true]){
  it(name+' agent='+agent,async()=>{
   const menu=[{id:9731,code:9731,name,description:'Con arroz',price:21000,availableNow:true,hasAttributes:false,attributes:[]}];
   const h=harness(menu,agent);h.conv.state='awaiting_payment';h.conv.customerName='Ana';h.service.ordersService.create=jest.fn();
   h.conv.sessionData={cart:[{productId:9731,name,code:9731,unitPrice:21000,quantity:2,note:'bolsa aparte',attributes:[]}],orderType:'delivery',address:'Calle 12 30 45',addressConfirmed:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,deliveryFeeCalculated:2000};
   const reply=await h.send('El '+name+' trae salsa de ajo?');expect(reply).toMatch(/no tengo ese detalle confirmado/i);expect(reply).toMatch(/pago|pagas/i);
   const total=await h.send('Cuánto vale todo?');expect(total).toContain('44.000');expect(h.conv.state).toBe('awaiting_payment');
   await h.send('Deja solo un '+name);expect(h.cartRows()).toEqual([expect.objectContaining({id:9731,qty:1,note:'bolsa aparte'})]);
   const newTotal=await h.send('Cuál es el total con domicilio?');expect(newTotal).toContain('23.000');
   await h.send('Efectivo');expect(h.conv.sessionData.paymentMethod).toBe('cash');expect(h.service.ordersService.create).not.toHaveBeenCalled();expect(h.cartRows()[0].note).toBe('bolsa aparte');
  });
 }
});

describe('Consulta múltiple con carta incompleta — cada plato conserva su evidencia',()=>{
 it.each([false,true])('pago agent=%s',async agent=>{
  const menu=[{id:9741,code:9741,name:'Bowl De Lentejas',description:'Con arroz',price:21000,availableNow:true,hasAttributes:false,attributes:[]},{id:9742,code:9742,name:'Pasta De Hongos',description:'',price:23000,availableNow:true,hasAttributes:false,attributes:[]}];
  const h=harness(menu,agent);h.conv.state='awaiting_payment';h.conv.customerName='Ana';h.conv.sessionData={cart:menu.map(p=>({productId:p.id,name:p.name,code:p.code,unitPrice:p.price,quantity:1,attributes:[]})),orderType:'delivery',address:'Calle 12 30 45',addressConfirmed:true};
  const before=structuredClone(h.conv.sessionData.cart);const reply=await h.send('Qué trae Bowl De Lentejas y Pasta De Hongos?');
  expect(reply).toContain('Bowl De Lentejas');expect(reply).toContain('Pasta De Hongos');expect(reply).toContain('arroz');expect(reply).toMatch(/no tengo el detalle/i);expect(reply).toMatch(/pagas/i);expect(h.conv.state).toBe('awaiting_payment');expect(h.conv.sessionData.cart).toEqual(before);
 });
});

describe('Consulta y edición independientes — ambas intenciones se resuelven', () => {
  const fixtures = [
    { id: 19301, name: 'Sopa De Calabaza', description: 'Calabaza y crema vegetal', other: 'Pan De Semillas' },
    { id: 19311, name: 'Ramen De Hongos y Miso', description: 'Hongos y fideos de trigo', other: 'Gyozas Vegetales' },
  ];
  for (const f of fixtures) for (const agent of [false, true]) for (const state of ['building_cart', 'awaiting_payment']) {
    const menu = [
      { id: f.id, code: f.id, name: f.name, description: f.description, price: 18000, availableNow: true, hasAttributes: false, attributes: [] },
      { id: f.id + 1, code: f.id + 1, name: f.other, price: 6000, availableNow: true, hasAttributes: false, attributes: [] },
    ];
    for (const kind of ['domicilio', 'composición', 'precio']) for (const form of ['pregunta', 'sin signos', 'punto y coma']) {
      it(`${f.name}, ${state}, agente ${agent}, ${kind}, ${form}`, async () => {
        const h = harness(menu, agent);
        h.service.ordersService.create = jest.fn();
        h.conv.state = state;
        Object.assign(h.conv.sessionData, {
          orderType: 'delivery', address: 'Calle 12 30 45', addressConfirmed: true,
          contactPhone: h.conv.phoneE164, phoneConfirmed: true, deliveryFeeCalculated: 2000,
          cart: menu.map((p, index) => ({ productId: p.id, code: p.code, name: p.name, unitPrice: p.price,
            quantity: index ? 1 : 3, note: index ? 'aparte' : 'sin cebolla', attributes: [] })),
        });
        const beforeOther = structuredClone(h.conv.sessionData.cart[1]);
        const question = kind === 'domicilio' ? '¿Cuánto vale el domicilio?'
          : kind === 'composición' ? `¿Qué trae ${f.name}?` : `¿Cuánto cuesta ${f.name}?`;
        const bareQuestion = question.replace(/[¿?]/g, '');
        const compound = form === 'pregunta' ? `${question} Y quita una de las ${f.name}`
          : form === 'sin signos' ? `${bareQuestion} y deja solo dos ${f.name}`
          : `${bareQuestion}; aparte quita una de las ${f.name}`;
        await h.sendQueued(compound);
        expect(h.cartRows()[0]).toEqual(expect.objectContaining({ id: f.id, qty: 2, note: 'sin cebolla' }));
        expect(h.conv.sessionData.cart[1]).toEqual(beforeOther);
        expect(h.conv.state).toBe('awaiting_payment');
        expect(h.conv.sessionData.address).toBe('Calle 12 30 45');
        const reply = h.replies.join('\n');
        expect(reply).toMatch(new RegExp(f.name+'[\\s\\S]*×2', 'i'));
        expect(reply.split('🛒').at(-1)).not.toMatch(/×3/);
        expect(reply).toMatch(kind === 'domicilio' ? /domicilio.*2[.,]000/i : kind === 'composición' ? new RegExp(f.description, 'i') : /precio de.*18[.,]000.*por unidad/i);
        expect(reply).toMatch(/pagas|método de pago/i);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
      });
    }
  }
});

describe('Consulta más atributo — aclara el producto sin elegir pago', () => {
  for (const f of [
    { id: 19701, name: 'Pita De Lentejas', other: 'Pita De Setas', attr: 'Salsa', first: 'Yogur', next: 'Ajo' },
    { id: 19711, name: 'Calzone De Verduras', other: 'Calzone De Setas', attr: 'Queso', first: 'Mozzarella', next: 'Provolone' },
  ]) {
    it.each([false, true])(`${f.name}, agente %s`, async agent => {
      const menu = [f.name, f.other].map((name, index) => ({ id: f.id + index, code: f.id + index, name,
        price: 21000, availableNow: true, hasAttributes: true,
        attributes: [{ attributeName: f.attr, options: [f.first, f.next] }] }));
      const h = harness(menu, agent);
      h.service.ordersService.create = jest.fn();
      h.conv.state = 'awaiting_payment';
      Object.assign(h.conv.sessionData, {
        orderType: 'delivery', address: 'Calle 12 30 45', addressConfirmed: true,
        phoneConfirmed: true, contactPhone: h.conv.phoneE164, deliveryFeeCalculated: 3000,
        cart: menu.map((p, index) => ({ productId: p.id, code: p.code, name: p.name, unitPrice: p.price,
          quantity: index + 1, note: index ? 'sin tomate' : 'sin cebolla',
          attributes: [{ attributeName: f.attr, attributeValue: f.first }] })),
      });
      const before = structuredClone(h.conv.sessionData.cart);
      await h.sendQueued(`¿Cuánto vale el domicilio? Y cambia ${f.attr} a ${f.next}`);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.pendingCartAttributeEdit?.candidates).toHaveLength(2);
      expect(h.replies.join('\n')).toMatch(/domicilio.*3[.,]000/i);
      expect(h.replies.at(-1)).toMatch(/cuál plato/i);
      await h.sendQueued('2');
      expect(h.conv.sessionData.cart[0]).toEqual(before[0]);
      expect(h.cartRows()[1]).toMatchObject({ id: f.id + 1, qty: 2, note: 'sin tomate', attrs: [`${f.attr}:${f.next}`] });
      expect(h.conv.sessionData.paymentMethod).toBeUndefined();
      expect(h.conv.state).toBe('awaiting_payment');
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
  }
});

describe('Atributos y dirección pendiente — opción inválida o plato ambiguo', () => {
  for (const f of [
    { id: 20301, name: 'Pita De Lentejas', other: 'Pita De Setas', attr: 'Salsa', first: 'Yogur', next: 'Ajo' },
    { id: 20311, name: 'Calzone De Verduras', other: 'Calzone De Setas', attr: 'Queso', first: 'Mozzarella', next: 'Provolone' },
  ]) for (const agent of [false, true]) for (const kind of ['inválida', 'ambigua']) {
    it(`${f.name}, agente ${agent}, ${kind}`, async () => {
      const menu = [f.name, f.other].map((name, index) => ({ id: f.id + index, code: f.id + index, name,
        price: 21000, availableNow: true, hasAttributes: true,
        attributes: [{ attributeName: f.attr, options: [f.first, f.next] }] }));
      const h = harness(menu, agent);
      h.conv.state = 'awaiting_address';
      h.service.ordersService.create = jest.fn();
      Object.assign(h.conv.sessionData, { orderType: 'delivery', address: undefined, addressConfirmed: false,
        cart: menu.map(p => ({ productId: p.id, code: p.code, name: p.name, unitPrice: p.price, quantity: 1,
          note: 'sin cebolla', attributes: [{ attributeName: f.attr, attributeValue: f.first }] })) });
      const before = structuredClone(h.conv.sessionData.cart);
      await h.sendQueued(kind === 'inválida' ? `Cambia ${f.attr} de ${f.name} a Inventada` : `Cambia ${f.attr} a ${f.next}`);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.state).toBe('awaiting_address');
      expect(h.conv.sessionData.address).toBeUndefined();
      if (kind === 'ambigua') {
        expect(h.conv.sessionData.pendingCartAttributeEdit?.candidates).toHaveLength(2);
        await h.sendQueued('2');
        expect(h.conv.sessionData.cart[0]).toEqual(before[0]);
        expect(h.cartRows()[1].attrs).toEqual([`${f.attr}:${f.next}`]);
        expect(h.conv.sessionData.paymentMethod).toBeUndefined();
      } else {
        expect(h.replies.at(-1)).toMatch(/no pude confirmar.*opción/i);
        await h.sendQueued(`Cambia ${f.attr} de ${f.name} a ${f.next}`);
        expect(h.conv.sessionData.cart[1]).toEqual(before[1]);
        expect(h.cartRows()[0].attrs).toEqual([`${f.attr}:${f.next}`]);
      }
      expect(h.conv.state).toBe('awaiting_address');
      expect(h.conv.sessionData.address).toBeUndefined();
      expect(h.replies.at(-1)).toMatch(/dirección/i);
      expect(h.replies.at(-1)).not.toMatch(/algo más/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
  }
});


describe('burger included drink and saved address continuation', () => {
  for (const enabled of [true,false]) {
    it(`exact customer wording, agent ${enabled}`,async()=>{
      const h=harness(products,enabled);
      Object.assign(h.conv.sessionData,{orderType:'delivery',lastDeliveryAddress:'Altavista',contactPhone:h.conv.phoneE164,phoneConfirmed:true});
      h.service.ensureDeliveryFeeQuoted=jest.fn(async(session:WhatsappSessionData)=>({session:{...session,addressConfirmed:true,deliveryFeeCalculated:2000}}));
      // The reported turn starts after this burger was already acknowledged.
      const burger=products.find(p=>p.name==='Hamburguesa Clasica');
      const burgerId=burger.id;
      h.conv.sessionData.cart=[{productId:burger.id,code:burger.code,name:burger.name,unitPrice:burger.price,quantity:1,note:'Sin cebolla',attributes:[{attributeName:'Bebida',attributeValue:'Colmbiana'}]}];
      await h.sendQueued('Con gaseosa coca cola y una adicionales De papa a la francesa');
      expect(h.conv.sessionData.cart).toHaveLength(2);
      expect(h.conv.sessionData.cart[0]).toEqual(expect.objectContaining({productId:burgerId,quantity:1,note:expect.stringMatching(/sin cebolla/i),attributes:expect.arrayContaining([{attributeName:'Bebida',attributeValue:'Coca Cola'}])}));
      expect(h.conv.sessionData.cart[1].name).toMatch(/papa francesa/i);
      await h.sendQueued('Nada Mas');
      expect(h.conv.state).toBe('awaiting_address');
      const count=h.replies.length;
      await h.sendQueued('A la misma');
      expect(h.replies.length).toBeGreaterThan(count);
      expect(h.replies.slice(count).join(' ')).toMatch(/c[oó]mo pagas/i);
      expect(h.conv.sessionData.address).toBe('Altavista');
      expect(h.conv.sessionData.cart).toHaveLength(2);
      expect(h.conv.state).toBe('awaiting_payment');
    });
  }
});
describe('real staging chats: asking whether they have the menu', () => {
  const fictional = [
    { id: 34101, code: 34101, name: 'Menu Ejecutivo De Res', price: 21000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 34102, code: 34102, name: 'Trucha Frita', price: 26000, availableNow: true, hasAttributes: false, attributes: [] },
  ];
  for (const enabled of [false, true]) for (const [label, menu] of [['PPP', products], ['fictional', fictional]] as const) {
    for (const text of ['Hola buenas tardes tienes la carta por favor', '¿tienes el menú?', 'me pasas la carta', 'tienes carta por favor']) {
      it(`${label} "${text}" sends the menu link, agent ${enabled}`, async () => {
        const h = harness(menu as any, enabled);
        const cfg = await (h.service as any).settingsService.getEffectiveConfig();
        cfg.menuLinkMessage = 'Menú: https://example.test/menu';
        const reply = await h.sendQueued(text);
        expect(reply).toBe('Menú: https://example.test/menu');
        expect(h.cartRows()).toEqual([]);
      });
    }
    it(`${label} "tienes un menu ejecutivo" is still a dish question, agent ${enabled}`, async () => {
      const h = harness(menu as any, enabled);
      const cfg = await (h.service as any).settingsService.getEffectiveConfig();
      cfg.menuLinkMessage = 'Menú: https://example.test/menu';
      const reply = await h.sendQueued('tienes un menu ejecutivo');
      expect(reply).not.toBe('Menú: https://example.test/menu');
    });
  }
});

describe('post-order courtesy preserves terminal state', () => {
  const menu=[{id:37101,code:37101,name:'Bowl De Lentejas',price:19000,availableNow:true,hasAttributes:false,attributes:[]}];
  for(const enabled of [true,false]) for(const state of ['completed','closed']) {
    for(const text of ['Señor','Gracias','Si señor','Listo','No señor asi esta bien','Nada mas','Eso es todo','No gracias']) {
      it(`${state}: ${text}, agent ${enabled}`,async()=>{
        const h=harness(menu,enabled);h.conv.state=state;
        h.service.conversationService.reopenForNewOrder=jest.fn();
        const before=structuredClone(h.conv.sessionData);
        await h.sendQueued(text);
        expect(h.conv.state).toBe(state);
        expect(h.conv.sessionData).toEqual(before);
        expect(h.service.conversationService.reopenForNewOrder).not.toHaveBeenCalled();
        expect(h.replies.join(' ')).toMatch(/con gusto/i);
        expect(h.replies.join(' ')).not.toMatch(/algo m[aá]s|carrito|pedido registrado/i);
      });
    }
    it(`${state}: explicit new purchase still reopens, agent ${enabled}`,async()=>{
      const h=harness(menu,enabled);h.conv.state=state;
      h.service.conversationService.reopenForNewOrder=jest.fn(async()=>{
        h.conv.state='building_cart';h.conv.sessionData={cart:[],orderType:'pickup',ignorePriorOrderHistory:true};
      });
      await h.sendQueued('Quiero un Bowl De Lentejas');
      expect(h.service.conversationService.reopenForNewOrder).toHaveBeenCalledTimes(1);
      expect(h.conv.state).toBe('building_cart');
      expect(h.cartRows()).toEqual([expect.objectContaining({id:37101,qty:1})]);
    });
  }
});

/** Complete journeys through the public queue; maps, model and order side effects isolated. */
describe('complete basic journeys with fragmented confirmations',()=>{
  const fixtures=[
    {name:'Crepe De Espinaca',attr:'Bebida',values:['Agua','Hibisco']},
    {name:'Bowl De Garbanzos',attr:'Salsa',values:['Suave','Picante']},
  ];
  for(const f of fixtures)for(const enabled of [true,false])for(const gap of [0,400,3400]) {
    it(`${f.name}, agent ${enabled}, confirmation gap ${gap}ms`,async()=>{
      jest.useFakeTimers();
      try{
        const menu=[{id:40101,code:40101,name:f.name,price:19000,description:'Incluye acompañamiento',availableNow:true,hasAttributes:true,attributes:[{attributeName:f.attr,options:f.values}]}];
        const h=harness(menu,enabled);let sequence=0;
        Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164});
        h.service.ordersService.create=jest.fn().mockResolvedValue({id:1001,dailyOrderNumber:1});
        h.service.ensureDeliveryFeeQuoted=jest.fn(async(session:WhatsappSessionData)=>({session:{...session,addressConfirmed:true,deliveryFeeCalculated:2000}}));
        const burst=async(texts:string[],spacing=0)=>{
          const jobs:Promise<unknown>[]=[];
          for(const text of texts){jobs.push(h.service.handleIncoming({waId:'customer',phoneE164:h.conv.phoneE164,messageId:`complete-burst-${sequence++}`,messageType:'text',text,timestamp:Math.floor(Date.now()/1000),raw:{}}));if(spacing)await jest.advanceTimersByTimeAsync(spacing);}
          await jest.advanceTimersByTimeAsync(10000);await Promise.all(jobs);
        };
        await burst(['Hola buenas tardes']);
        await burst([`Quiero un ${f.name}`,`Con ${f.values[1]}`, 'Sin cebolla por favor']);
        expect(h.cartRows()).toEqual([expect.objectContaining({id:40101,qty:1,attrs:[`${f.attr}:${f.values[1]}`],note:expect.stringMatching(/sin cebolla/i)})]);
        await burst(['Para domicilio Calle 12 34 56']);expect(h.conv.state).toBe('awaiting_payment');
        const before=structuredClone(h.conv.sessionData.cart);
        await burst(['Antes de pagar cuanto vale todo?']);
        expect(h.conv.state).toBe('awaiting_payment');expect(h.conv.sessionData.cart).toEqual(before);
        expect(h.replies.at(-1)).toMatch(/21[.,]000/);
        await burst(['Pago contraentrega']);expect(h.conv.state).toBe('awaiting_final_confirm');
        await burst(['Si','Señor'],gap);
        expect(h.conv.state).toBe('completed');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
        const order=h.service.ordersService.create.mock.calls[0][0];
        expect(order.orderType).toBe('delivery');expect(order.items).toHaveLength(1);
        expect(order.items[0]).toMatchObject({productId:40101,note:expect.stringMatching(/sin cebolla/i)});
        expect(order.items[0].attributes).toContainEqual({attributeName:f.attr,attributeValue:f.values[1]});
        await burst(['No señor así está bien','Muchas gracias']);
        expect(h.conv.state).toBe('completed');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
        expect(order.deliveryFee).toBe(2000);expect(order.address).toMatch(/Calle 12 34 56/i);
      }finally{jest.useRealTimers();}
    });
  }
});


describe('Cancellation composition respects scope',()=>{
 const menu=[{id:59201,code:975,name:'Tarta De Verduras',price:21000,availableNow:true,hasAttributes:false,attributes:[]},{id:59202,code:976,name:'Agua De Tamarindo',price:4000,availableNow:true,hasAttributes:false,attributes:[]}];
 for(const agent of [true,false]) {
 it.each([
  'Si llega tarde, quiero cancelar el pedido y agrega dos Agua De Tamarindo',
  'Si llega tarde, quiero cancelar el pedido; agrega dos Agua De Tamarindo',
  '¿Puedo cancelar el pedido? No agregues Agua De Tamarindo',
  '¿Puedo cancelar el pedido y agregar dos Agua De Tamarindo?',
 ])('unclear or negative action stays unexecuted: %s agent='+agent,async text=>{
  const h=harness(menu,agent);h.conv.state='awaiting_payment';
  h.conv.sessionData.cart=[{productId:59201,code:975,name:menu[0].name,unitPrice:21000,quantity:1,attributes:[],note:'sin sal'}];
  const before=structuredClone(h.cartRows());h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  const response=await h.sendQueued(text);
  expect(h.cartRows()).toEqual(before);expect(h.conv.state).toBe('awaiting_payment');
  expect(response||'').toMatch(/cancel|condici[oó]n|aclara/i);expect(response||'').not.toMatch(/qued[oó] cancelado/i);
 });
 it('independent row removal uses existing edit route agent='+agent,async()=>{
  const h=harness(menu,agent);h.conv.state='awaiting_payment';
  h.conv.sessionData.cart=menu.map(p=>({productId:p.id,code:p.code,name:p.name,unitPrice:p.price,quantity:1,attributes:[]}));
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  const start=h.replies.length;
  await h.sendQueued('¿Puedo cancelar el pedido? Aparte quita el Agua De Tamarindo');
  expect(h.cartRows()).toEqual([expect.objectContaining({id:59201,qty:1})]);
  expect(h.replies.slice(start).join('\n')).toMatch(/no he cancelado nada/i);
  expect(h.service.ordersService.findTodayOrdersByPhone).not.toHaveBeenCalled();
 });
 }
});

describe('Grouped price collision — full router and captured actual-model replay', () => {
 for(const state of ['building_cart','awaiting_payment','awaiting_final_confirm'])it('preserves both source prices '+state,async()=>{
  const product={id:64611,code:64611,name:'Kit Del Huerto',price:12000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Salsa',options:['Suave','Picante']}]};
  const h=harness([product],true);h.conv.state=state;
  Object.assign(h.conv.sessionData,{cart:[{productId:product.id,code:product.code,name:product.name,unitPrice:10000,quantity:4,note:'bien empacado',attributes:[{attributeName:'Salsa',attributeValue:'Suave'}]},
   {productId:product.id,code:product.code,name:product.name,unitPrice:12000,quantity:1,note:'bien empacado',attributes:[{attributeName:'Salsa',attributeValue:'Picante'}]}],orderType:'delivery',fulfillmentChosen:true,address:'Calle 12 34 56',addressConfirmed:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,deliveryFeeCalculated:2000,...(state==='awaiting_final_confirm'?{paymentMethod:'contraentrega'}:{})});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:6461,dailyOrderNumber:76});
  h.agent.runTurn.mockResolvedValueOnce({reply:'Listo.',actions:{updateUnitOptions:[{productId:product.id,cartLineIndex:0,affectedQuantity:2,attributes:[{attributeName:'Salsa',attributeValue:'Picante'}]}]},toolCalls:['set_unit_attributes']});
  const reply=await h.sendQueued('En dos unidades prefiero salsa Picante; las demás conservan su salsa');
  expect(h.agent.runTurn).toHaveBeenCalledTimes(1);expect(h.conv.sessionData.cart).toHaveLength(3);
  expect(h.conv.sessionData.cart.reduce((sum,item)=>sum+item.quantity*item.unitPrice,0)).toBe(52000);
  expect(reply).toContain('$52.000');expect(reply).toContain('$54.000');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(h.conv.state==='awaiting_payment')await h.sendQueued('1');
  await h.sendQueued('Confirmar');expect(h.service.ordersService.create).not.toHaveBeenCalled();expect(h.replies.at(-1)).toMatch(/precio del men[uú] cambi[oó]/i);
  await h.sendQueued('Confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items=h.service.ordersService.create.mock.calls[0][0].items;expect(items).toHaveLength(5);
  expect(items.filter((item:any)=>item.attributes.some((a:any)=>a.attributeValue==='Picante'))).toHaveLength(3);
 });
 it('replays the captured real-model tool selection on the final candidate without another API call',async()=>{
  const menu=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-unit-options-menu-1710.json'),'utf8'));
  const capture=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-unit-option-captured-trace-1710.json'),'utf8'));
  expect(capture.calls.map((call:any)=>call.name)).toEqual(['get_cart','set_unit_attributes']);
  const h=harness(menu,true);h.conv.sessionData.cart=[{productId:64601,code:64601,name:menu[0].name,unitPrice:23500,quantity:4,note:'sin pepino',attributes:[{attributeName:'Pan',attributeValue:'Pita'},{attributeName:'Salsa',attributeValue:'Ajo'}]}];
  h.service.ordersService.create=jest.fn();
  h.agent.runTurn.mockImplementationOnce(async input=>{
   const service=new WhatsappAgentService({} as never,h.service.catalogService) as any;const actions:any={};
   const ctx={actions,cart:input.cart,products:menu,byId:new Map(menu.map((product:any)=>[product.id,product])),setNeedsAttr:()=>{}};
   for(const call of capture.calls)expect(JSON.parse(service.executeTool(call.name,call.args,ctx)).ok).toBe(true);
   return {reply:'Listo.',actions,toolCalls:capture.calls.map((call:any)=>call.name)};
  });
  const reply=await h.sendQueued(capture.message);expect(h.agent.runTurn).toHaveBeenCalledTimes(1);
  expect(h.conv.sessionData.cart).toEqual(capture.expectedCart);expect(reply).toContain('Integral');expect(reply).toContain('Pita');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});

describe('Sales closure after a contact phone and multiline street plus place',()=>{
 const menus=[{menu:products,order:'Buenas tardes veci\nMe regalas por favor\n1 arroz con pollo\n1 sopa de menudencias grande\n1 sopa de mondongo pequeña',ids:[23,20,41]},{menu:[{id:65801,code:65801,name:'Quinoa Andina',price:22000,availableNow:true,hasAttributes:false,attributes:[]},{id:65802,code:65802,name:'Crema De Zapallo',price:9000,availableNow:true,hasAttributes:false,attributes:[]},{id:65803,code:65803,name:'Consomé Pequeño',price:7000,availableNow:true,hasAttributes:false,attributes:[]}],order:'Buenas tardes\nMe regalas por favor\n1 Quinoa Andina\n1 Crema De Zapallo\n1 Consomé Pequeño',ids:[65801,65802,65803]}];
 for(const f of menus)for(const enabled of [false,true])for(const address of ['Calle 10 # 81A - 20\nConjunto Santa Catalina Club House','Conjunto Santa Catalina Club House\nCalle 10 # 81A - 20'])it(`${f.ids[0]} agent=${enabled} ${address}`,async()=>{
  const h=harness(f.menu,enabled);h.cfg.paymentMethods=DEFAULT_PAYMENT_METHODS.map(m=>({...m,enabled:m.flow!=='mercadopago'}));h.service.ordersService.create=jest.fn().mockResolvedValue({id:6580,dailyOrderNumber:88});
  await h.sendQueued(f.order);expect(h.conv.sessionData.cart.map((x:any)=>x.productId).sort()).toEqual([...f.ids].sort());const cart=JSON.parse(JSON.stringify(h.conv.sessionData.cart));
  await h.sendQueued('300 000 0002');expect(h.conv.sessionData.contactPhone).toMatch(/3000000002/);
  const reply=await h.sendQueued(address);expect(h.conv.sessionData.cart).toEqual(cart);expect(h.conv.sessionData.address).toMatch(/10.*81A.*20/i);expect(h.conv.state).toBe('awaiting_payment');expect(reply).toMatch(/c[oó]mo pagas|c[oó]mo.*pagar|m[eé]todo de pago/i);expect(reply).not.toMatch(/algo m[aá]s|qu[eé] m[aá]s|mercado pago/i);
  await h.sendQueued('nad mas');expect(h.conv.state).toBe('awaiting_payment');expect(h.conv.sessionData.cart).toEqual(cart);
  const confirm=await h.sendQueued('1');expect(h.conv.state).toBe('awaiting_final_confirm');expect(h.conv.sessionData.paymentMethod).toBeTruthy();expect(confirm).toMatch(/confirmar/i);expect(confirm).not.toMatch(/algo m[aá]s|mercado pago/i);expect(h.conv.sessionData.deliveryFeeCalculated).toBe(2000);
  await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(3);
 });
});

describe('Street and residence references reach the real routing adapter during checkout',()=>{
 it('keeps contact, street, reference, cart and fee through payment and simulated confirmation',async()=>{
  const {WhatsappDeliveryRoutingService}=require('./whatsapp-delivery-routing.service');const h=harness(products,true);h.cfg.paymentMethods=DEFAULT_PAYMENT_METHODS.map(m=>({...m,enabled:m.flow!=='mercadopago'}));Object.assign(h.cfg,{deliveryFeeMode:'route',restaurantLat:4.62,restaurantLng:-74.15,deliveryFeeTiers:[{maxKm:5.5,fee:2000}]});
  const routing=new WhatsappDeliveryRoutingService({get:()=> 'test-key'});const route=jest.spyOn(routing as any,'directionsDistance').mockResolvedValue({distanceKm:1.5,durationMinutes:3});h.service.deliveryRouting=routing;h.service.ordersService.create=jest.fn().mockResolvedValue({id:6585,dailyOrderNumber:93});
  const originalFetch=global.fetch;global.fetch=jest.fn().mockResolvedValue({status:200,json:async()=>({status:'OK',results:[{formatted_address:'Cl. 10 #81a-20, Bogotá, Colombia',partial_match:false,geometry:{location:{lat:4.62,lng:-74.15}},address_components:[{short_name:'CO',types:['country']}]}]})});
  try{
   await h.sendQueued('Quiero un Arroz Con Pollo');await h.sendQueued('3000000005');const reply=await h.sendQueued('Conjunto Santa Catalina Club House\nCalle 10 #81A-20');expect(h.conv.state).toBe('awaiting_payment');expect(reply).not.toMatch(/no pude identificar|algo m[aá]s|mercado pago/i);expect(h.conv.sessionData.address).toMatch(/Santa Catalina/i);expect(h.conv.sessionData.deliveryFeeCalculated).toBe(2000);expect(route).toHaveBeenCalled();
   const cart=JSON.parse(JSON.stringify(h.conv.sessionData.cart));const total=await h.sendQueued('¿Cuánto es el total?');expect(total).toMatch(/31\.500/);expect(h.conv.state).toBe('awaiting_payment');expect(h.conv.sessionData.cart).toEqual(cart);
   await h.sendQueued('1');expect(h.service.ordersService.create).not.toHaveBeenCalled();await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.phone).toMatch(/3000000005/);expect(dto.deliveryFee).toBe(2000);expect(dto.address).toMatch(/Santa Catalina/i);expect(dto.items).toHaveLength(1);
  }finally{global.fetch=originalFetch;}
 });
});


describe('Paired option clarification cannot create extra dishes',()=>{
 for(const enabled of [false,true])for(const quantity of [1,2])for(const invalid of [false,true])it(`agent=${enabled} quantity=${quantity} invalid=${invalid}`,async()=>{
  const menu=['Miso','Shoyu'].map((name,i)=>({id:66601+i,code:66601+i,name:'Ramen '+name,price:20000,availableNow:true,attributes:[{attributeName:'Caldo',options:['Vegetal','Cerdo']}]}));
  const h=harness(menu,enabled);h.conv.state='awaiting_payment';Object.assign(h.conv.sessionData,{cart:menu.map(p=>({productId:p.id,code:p.code,name:p.name,unitPrice:p.price,quantity,note:'Sin cebolla',attributes:[{attributeName:'Caldo',attributeValue:'Vegetal'}]}))});
  const before=structuredClone(h.conv.sessionData.cart);const reply=await h.sendQueued(`Caldos. 1Vegetal y otro ${invalid?'Desconocido':'Cerdo'}`);
  if(invalid||quantity!==1){expect(h.conv.sessionData.cart).toEqual(before);expect(reply).toMatch(/pedido sigue igual/i);}
  else{expect(h.conv.sessionData.cart[1].attributes).toContainEqual({attributeName:'Caldo',attributeValue:'Cerdo'});expect(reply).toMatch(/actualic[eé]/i);}
  expect(h.conv.sessionData.cart.map((line:any)=>line.note)).toEqual(['Sin cebolla','Sin cebolla']);expect(h.conv.state).toBe('awaiting_payment');
 });
});

describe('Uncertain map destination allows cart inspection and correction before checkout',()=>{
 for(const [main,side] of [['Ravioles De Ricota','Pan De Ajo'],['Bowl De Garbanzos','Te De Durazno'],['Sandwich De Pavo','Papas Rusticas']])for(const enabled of [false,true])for(const byName of [false,true])it(`${main} agent=${enabled} byName=${byName}`,async()=>{
  const menu=[{id:67001,code:67001,name:main,price:21000,availableNow:true,attributes:[]},{id:67002,code:67002,name:side,price:5000,availableNow:true,attributes:[]}];const h=harness(menu,enabled);
  Object.assign(h.cfg,{deliveryFeeMode:'route',restaurantLat:4.62,restaurantLng:-74.15});h.cfg.paymentMethods=DEFAULT_PAYMENT_METHODS.map(method=>({...method,enabled:method.flow!=='mercadopago'}));
  h.conv.state='awaiting_address';Object.assign(h.conv.sessionData,{cart:menu.map((p,i)=>({productId:p.id,code:p.code,name:p.name,unitPrice:p.price,quantity:i===0?2:1,note:'Bien empacado'})),orderType:'delivery',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
  const quote=jest.fn().mockResolvedValue({ok:false,reason:'address_ambiguous',message:'No pude identificar con seguridad ese conjunto. Comparte calle y número o ubicación.'});h.service.deliveryRouting={quoteDeliveryFee:quote};h.service.ordersService.create=jest.fn().mockResolvedValue({id:6700,dailyOrderNumber:111});
  await h.sendQueued('Conjunto Los Olivos torre B apartamento 304B');
  expect(h.replies.at(-1)).toMatch(/calle y n[uú]mero|ubicaci[oó]n/i);expect(h.conv.state).not.toBe('awaiting_payment');expect(h.conv.sessionData.deliveryFeeCalculated).toBeNull();
  const before=structuredClone(h.conv.sessionData.cart),destination=h.conv.sessionData.address;
  const shown=await h.sendQueued('déjame ver qué tengo en el carrito');expect(shown).toContain(main);expect(shown).toContain(side);expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.address).toBe(destination);
  const total=await h.sendQueued('cuánto suma mi pedido');expect(total).toMatch(/47[.,]000/);expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.address).toBe(destination);
  await h.sendQueued(byName?`quita ${side}`:'quita la 2');expect(h.cartRows()).toEqual([expect.objectContaining({id:67001,qty:2,note:'Bien empacado'})]);expect(h.conv.sessionData.address).toBe(destination);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  quote.mockResolvedValue({ok:true,fee:2000,distanceKm:1,source:'google_directions',customer:{lat:4.62,lng:-74.15}});
  await h.sendQueued('Dirección: Calle 10 #81A-20 torre B apartamento 304B');expect(h.conv.state).toBe('awaiting_payment');expect(h.conv.sessionData.address).toMatch(/81A-20.*torre B.*304B/i);
  await h.sendQueued('1');expect(h.conv.state).toBe('awaiting_final_confirm');expect(h.service.ordersService.create).not.toHaveBeenCalled();await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toEqual([{productId:67001,attributes:undefined,note:'Bien empacado'},{productId:67001,attributes:undefined,note:'Bien empacado'}]);expect(dto.address).toMatch(/81A-20.*torre B.*304B/i);expect(dto.deliveryFee).toBe(2000);
 });
});
