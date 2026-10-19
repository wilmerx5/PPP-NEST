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

describe('Corrección con cortesía — límites',()=>{
  it.each(['Perdón, quiero tres churrascos más','Disculpa, quiero tres churrascos y una sopa'])('no interpreta como cantidad absoluta %s',text=>{
    expect(require('./whatsapp-quantity-correction').parseCartQuantityCorrection(text)).toBeNull();
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


describe('Narración de comensales — aclaración en cartas ficticias',()=>{
 it.each([['Pizza Rustica','Pasta De Setas'],['Sandwich De Tofu','Ensalada De Quinoa']].flatMap(names=>[false,true].map(agent=>({names,agent}))))('no inventa menú ni cantidades agent=$agent',async({names,agent})=>{
  const menu=names.map((name,index)=>({id:21801+index,code:2501+index,name,price:18000,availableNow:true,hasAttributes:false,attributes:[]}));
  const h=harness(menu as typeof products,agent);h.service.ordersService.create=jest.fn();
  await h.sendQueued(`Para el almuerzo: somos tres, solo dos van a comer ${names[0]}, el otro quiere ${names[1]}.`);
  expect(h.cartRows()).toEqual([]);expect(h.replies.at(-1)||'').toMatch(/cuántas|cuantas|cuál|cual/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
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

describe('Pregunta descriptiva del plato nombrado — responde desde la descripción',()=>{
 const falafel={id:8921,code:8921,name:'Combo De Falafel',price:29000,description:'Seis falafel con pan pita, papas y bebida incluida de 400ml',availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Limonada','Te Frio']}]};
 const cases=[
  {kind:'carta',menu:[falafel,{id:8922,code:8922,name:'Falafel Solo',price:12000,description:'Seis falafel',availableNow:true,hasAttributes:false,attributes:[]}],id:8921,text:'Qué incluye Combo De Falafel, trae papas o se cobran aparte?'},
  {kind:'ppp',menu:products,id:94,text:'El combo de arroz paisa trae papas o se cobran aparte?'},
 ];
 it.each(cases)('$kind sin agente no niega el plato ni agrega',async({menu,text})=>{
  const h=harness(menu as typeof products,false);
  const reply=await h.sendQueued(text)||'';
  expect(reply).not.toMatch(/no te ofrecemos|no lo ofrecemos|no tenemos/i);
  expect(h.cartRows()).toEqual([]);
 });
 it.each(cases)('$kind con agente: search_menu entrega el plato, no similar_offer',async({menu,id,text})=>{
  const h=harness(menu as typeof products,true);
  const agent=new WhatsappAgentService({getEffectiveConfig:async()=>({openaiApiKey:'offline-key',openaiModel:'gpt-4.1-2025-04-14',systemPrompt:'',localContext:{}})} as never,h.service.catalogService);
  h.service.agentService=agent;
  const response=(message:unknown)=>({ok:true,json:async()=>({choices:[{message}]})});
  const original=globalThis.fetch;
  const fetchMock=jest.fn()
   .mockResolvedValueOnce(response({content:null,tool_calls:[{id:'desc-0',type:'function',function:{name:'search_menu',arguments:JSON.stringify({query:text})}}]}))
   .mockResolvedValueOnce(response({content:'Sí, el combo trae papas incluidas.'}));
  globalThis.fetch=fetchMock;
  const telemetry=jest.spyOn(h.service.turnTelemetry,'record');
  try{
   await h.service.tryHandleAgentV1({conv:h.conv,msg:{waId:'customer',phoneE164:h.conv.phoneE164,messageId:'desc-q',messageType:'text',text,raw:{}},session:h.conv.sessionData,text,originalText:text,products:menu,cfg:h.cfg,status:{isOpen:true,message:'Abierto'},businessOpenForBot:true});
   const body=JSON.parse(fetchMock.mock.calls[1][1].body);
   const tool=JSON.parse(body.messages.find((m:any)=>m.role==='tool').content);
   expect(tool.mode).not.toBe('similar_offer');
   expect(JSON.stringify(tool)).toContain(String(id));
   expect(h.cartRows()).toEqual([]);
   expect(telemetry.mock.calls.flatMap(([entry]:any)=>entry.warnings||[])).not.toContain('off_menu_question');
   expect(h.replies.at(-1)).toMatch(/papas incluidas/);
  }finally{globalThis.fetch=original;}
 });
});

describe('Pago en efectivo con billete no es nota de cocina', () => {
 const pizzas=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-pizza-menu-1510.json'),'utf8'));
 const cases=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-pizza-cases-1510.json'),'utf8'));
 it('pizzería: el caso congelado llega a 50.000 sin notas inventadas ni líneas repetidas', async () => {
  const h = harness(pizzas, false);
  h.conv.sessionData.orderType = 'delivery';
  const replies: string[] = [];
  for (const m of cases[0].messages.slice(0, 6)) replies.push(await h.sendQueued(m.text) || '');
  expect(h.cartRows()).toEqual([
   expect.objectContaining({id:9301, qty:1, note:undefined}), expect.objectContaining({id:9302, qty:1, note:undefined}),
   expect.objectContaining({id:9303, qty:2, note:undefined}), expect.objectContaining({id:9304, qty:1, note:undefined, attrs:['Sabor:Sprite']}),
  ]);
  expect((h.conv.sessionData as any).paymentMethod).toBe('cash');
  expect((h.conv.sessionData as any).cashChangeFor).toMatch(/100/);
  expect(replies[2]).not.toMatch(/\n_Sprite_/);
  expect(replies[5]).not.toMatch(/📝/);
 });
 it('PPP: "pago en efectivo, llevo billete de 50" en el pedido tampoco deja nota', async () => {
  const h = harness(products, false);
  await h.sendQueued('quiero un arroz con pollo');
  await h.sendQueued('pago en efectivo, llevo billete de 50');
  expect(h.cartRows()).toEqual([expect.objectContaining({id:23, note:undefined})]);
 });
});

describe('Reemplazo atómico durante checkout — conserva el dato pendiente', () => {
  for (const f of [
    { id: 20701, old: 'Pizza De Setas', next: 'Pizza Margarita', side: 'Agua Mineral' },
    { id: 20711, old: 'Ramen De Miso', next: 'Ramen De Shoyu', side: 'Te Verde' },
  ]) for (const agent of [false, true]) for (const state of ['awaiting_name', 'awaiting_phone', 'awaiting_payment', 'awaiting_final_confirm']) {
    for (const kind of ['cambia', 'no quiero', 'desconocido', 'agotado']) {
      it(`${f.old}, agente ${agent}, ${state}, ${kind}`, async () => {
        const menu = [f.old, f.next, f.side].map((name, index) => ({ id: f.id + index, code: f.id + index, name,
          price: index === 0 ? 24000 : index === 1 ? 22000 : 5000, availableNow: !(kind === 'agotado' && index === 1), hasAttributes: false, attributes: [] }));
        const h = harness(menu, agent);
        h.conv.state = state;
        h.conv.customerName = state === 'awaiting_name' ? '' : 'Ana';
        h.service.ordersService.create = jest.fn();
        Object.assign(h.conv.sessionData, { orderType: 'delivery', address: 'Calle 12 30 45', addressConfirmed: true,
          deliveryFeeCalculated: 3000, phoneConfirmed: state !== 'awaiting_phone', contactPhone: h.conv.phoneE164,
          paymentMethod: state === 'awaiting_final_confirm' ? 'cash' : undefined,
          cart: [menu[0], menu[2]].map((p, index) => ({ productId: p.id, code: p.code, name: p.name,
            unitPrice: p.price, quantity: index ? 1 : 3, note: index ? 'sin hielo' : 'sin cebolla', attributes: [] })) });
        const before = structuredClone(h.conv.sessionData);
        await h.sendQueued(kind === 'no quiero' ? `No quiero ${f.old}, quiero dos ${f.next}`
          : `Cambia ${f.old} por dos ${kind === 'desconocido' ? 'Platillo Inventado' : f.next}`);
        if (kind === 'desconocido' || kind === 'agotado') expect(h.conv.sessionData.cart).toEqual(before.cart);
        else expect(h.conv.sessionData.cart).toEqual([
          expect.objectContaining({ productId: f.id + 1, quantity: 2, unitPrice: 22000, note: 'sin cebolla' }), before.cart[1],
        ]);
        expect(h.conv.state).toBe(state);
        expect(h.conv.customerName).toBe(state === 'awaiting_name' ? '' : 'Ana');
        expect(h.conv.sessionData.address).toBe(before.address);
        expect(h.conv.sessionData.addressConfirmed).toBe(true);
        expect(h.conv.sessionData.deliveryFeeCalculated).toBe(3000);
        expect(h.conv.sessionData.phoneConfirmed).toBe(before.phoneConfirmed);
        expect(h.conv.sessionData.paymentMethod).toBe(before.paymentMethod);
        expect(h.replies.at(-1)).toMatch(state === 'awaiting_name' ? /nombre/i : state === 'awaiting_phone' ? /teléfono/i : state === 'awaiting_payment' ? /pagas|pago/i : /confirmar/i);
        expect(h.replies.at(-1)).not.toMatch(/algo más/i);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
        if (kind === 'cambia' || kind === 'no quiero') {
          const changedCart = structuredClone(h.conv.sessionData.cart);
          if (state === 'awaiting_name') {
            await h.sendQueued('Laura Gomez');
            expect(h.conv.customerName).toBe('Laura Gomez');
            expect(h.conv.state).toBe('awaiting_payment');
          } else if (state === 'awaiting_payment') {
            await h.sendQueued('1');
            expect(h.conv.state).toBe('awaiting_final_confirm');
            expect(h.replies.at(-1)).toMatch(/confirmar/i);
          }
          expect(h.conv.sessionData.cart).toEqual(changedCart);
          expect(h.service.ordersService.create).not.toHaveBeenCalled();
        }
      });
    }
  }
});

describe('included side preferences stay on the dish', () => {
  const fictional = [
    { id: 31101, code: 31101, name: 'Pargo', price: 38000, availableNow: true, hasAttributes: true, description: 'Acompañado con arroz, patacon y ensalada',
      attributes: [{ attributeName: 'Preparacion', options: ['Frito', 'Al Ajillo'] }] },
    { id: 31102, code: 31102, name: 'Porcion De Ensalada', price: 6000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 31103, code: 31103, name: 'Limonada', price: 5000, availableNow: true, hasAttributes: false, attributes: [] },
  ];
  for (const enabled of [true, false]) {
    it(`PPP original conversation, agent ${enabled}`, async () => {
      const h = harness(products, enabled);
      await h.sendQueued('Dame Un bagre en salsa con ensalada De cebolla y to ate y con arto limon');
      expect(h.cartRows()).toEqual([expect.objectContaining({ id: 19, qty: 1, attrs: ['Seleccion:En Salsa'] })]);
      expect(h.conv.sessionData.cart[0].note).toMatch(/ensalada de cebolla y to ?m?ate.*limon/i);
      expect(h.replies.join(' ')).not.toMatch(/no manejamos|no tenemos/i);
    });
    it(`PPP "no quiero X quiero Y" replaces the side line, agent ${enabled}`, async () => {
      const h = harness(products, enabled);
      h.conv.sessionData.cart = [{ productId: 46, code: 46, name: 'Porcion de ensalada', unitPrice: 7000, quantity: 1, attributes: [], note: 'con ensalada De cebolla' }] as any;
      await h.sendQueued('No quiero una porcion De ensalada quiero Un bagre en salsa');
      expect(h.cartRows()).toEqual([expect.objectContaining({ id: 19, qty: 1, attrs: ['Seleccion:En Salsa'] })]);
    });
    it(`PPP dish with a request verb keeps its note, agent ${enabled}`, async () => {
      const h = harness(products, enabled);
      await h.sendQueued('Dame un bagre en salsa con harto limon');
      expect(h.cartRows()).toEqual([expect.objectContaining({ id: 19, qty: 1, note: 'con harto limon', attrs: ['Seleccion:En Salsa'] })]);
    });
    it(`fictional included side preference and swap, agent ${enabled}`, async () => {
      const h = harness(fictional as any, enabled);
      await h.sendQueued('Dame un pargo al ajillo con ensalada de pepino y tomate y con bastante limon');
      expect(h.cartRows()).toEqual([expect.objectContaining({ id: 31101, qty: 1, attrs: ['Preparacion:Al Ajillo'] })]);
      expect(h.conv.sessionData.cart[0].note).toMatch(/pepino y tomate.*limon/i);
      const g = harness(fictional as any, enabled);
      g.conv.sessionData.cart = [{ productId: 31102, code: 31102, name: 'Porcion De Ensalada', unitPrice: 6000, quantity: 1, attributes: [] }] as any;
      await g.sendQueued('No quiero la porcion de ensalada quiero un pargo frito');
      expect(g.cartRows()).toEqual([expect.objectContaining({ id: 31101, qty: 1, attrs: ['Preparacion:Frito'] })]);
    });
    it(`a coordinated drink is still its own line, agent ${enabled}`, async () => {
      const h = harness(fictional as any, enabled);
      await h.sendQueued('un pargo frito con patacon y una limonada');
      expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({ id: 31101 }), expect.objectContaining({ id: 31103, qty: 1 })]));
    });
  }
});

/** Seed an existing checkout, then exercise the ambiguity and its complete continuation. */
describe('same SKU removal survives checkout inquiries',()=>{
  for(const f of [{dish:'Crepe De Espinaca',side:'Porcion De Pan'},{dish:'Bowl De Garbanzos',side:'Porcion De Totopos'}])
  for(const enabled of [true,false])for(const state of ['awaiting_payment','awaiting_final_confirm'])for(const selection of ['2','la con cilantro'])for(const affirmation of ['Si','confirmar','listo']){
    it(`${f.dish}, agent ${enabled}, ${state}, select ${selection}, ${affirmation}`,async()=>{
      const menu=[{id:41101,code:41101,name:f.dish,price:19000,description:'Plato con acompañamiento',availableNow:true,attributes:[]},
        {id:41102,code:41102,name:f.side,price:6000,availableNow:true,attributes:[]}];
      const h=harness(menu,enabled);h.cfg.menuUrl='https://restaurant.example/menu';h.conv.state=state;
      Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,address:'Calle 12 34 56',addressConfirmed:true,deliveryFeeCalculated:2000,
        phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,...(state==='awaiting_final_confirm'?{paymentMethod:'contraentrega'}:{}),
        cart:[...['sin cilantro','con cilantro'].map((note,i)=>({productId:41101,code:41101,name:f.dish,unitPrice:19000,quantity:i?1:2,attributes:[],note})),
          {productId:41102,code:41102,name:f.side,unitPrice:6000,quantity:1,attributes:[],note:'Sin sal'}]});
      h.service.ordersService.create=jest.fn().mockResolvedValue({id:1002,dailyOrderNumber:2});
      const before=structuredClone(h.conv.sessionData.cart);
      await h.sendQueued(`Quita el ${f.dish}`);
      expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.state).toBe(state);
      expect(h.conv.sessionData.pendingCartRemoval?.options).toHaveLength(2);
      const pending=structuredClone(h.conv.sessionData.pendingCartRemoval);
      await h.sendQueued('Antes de seguir, cuanto vale todo?');
      expect(h.replies.at(-1)).toMatch(/65[.,]000/);
      expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.state).toBe(state);
      expect(h.conv.sessionData.pendingCartRemoval).toEqual(pending);
      await h.sendQueued('Hola, tienes la carta por favor?');
      expect(h.replies.at(-1)).toContain(h.cfg.menuUrl);
      expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.state).toBe(state);
      expect(h.conv.sessionData.pendingCartRemoval).toEqual(pending);
      expect(h.replies.at(-1)).toMatch(/cu[aá]l l[ií]nea quitamos/i);
      expect(h.replies.at(-1)).not.toMatch(/m[eé]todo de pago|confirmar para enviarlo/i);
      await h.sendQueued(affirmation);
      expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.state).toBe(state);
      expect(h.conv.sessionData.pendingCartRemoval).toEqual(pending);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      expect(h.replies.at(-1)).toMatch(/cu[aá]l l[ií]nea|elige|n[uú]mero/i);
      await h.sendQueued(selection);
      expect(h.cartRows()).toEqual([expect.objectContaining({id:41101,qty:2,note:'sin cilantro'}),expect.objectContaining({id:41102,qty:1,note:'Sin sal'})]);
      expect(h.conv.sessionData.pendingCartRemoval).toBeUndefined();expect(h.conv.state).toBe(state);
      expect(h.conv.customerName).toBe('Wilmer');expect(h.service.ordersService.create).not.toHaveBeenCalled();
      expect(h.replies.at(-1)).toMatch(/46[.,]000/);
      if(state==='awaiting_payment')await h.sendQueued('Pago contraentrega');
      expect(h.conv.state).toBe('awaiting_final_confirm');
      await h.sendQueued('Si');expect(h.conv.state).toBe('completed');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const order=h.service.ordersService.create.mock.calls[0][0];
      expect(order.items).toHaveLength(3);
      expect(order.items.filter((line:any)=>line.productId===41101)).toEqual([expect.objectContaining({note:'sin cilantro'}),expect.objectContaining({note:'sin cilantro'})]);
      expect(order.items.find((line:any)=>line.productId===41102)).toMatchObject({note:'Sin sal'});
    });
  }
});


describe('Whole order cancellation inquiries preserve checkout', () => {
 for (const dish of [
 {id:59001,code:991,name:'Bowl De Lentejas',price:18000,availableNow:true,hasAttributes:false,attributes:[]},
 {id:59002,code:992,name:'Crepe De Setas',price:23000,availableNow:true,hasAttributes:false,attributes:[]}
 ]) {
 for (const agent of [true,false]) for (const state of ['building_cart','awaiting_payment','awaiting_final_confirm','completed'] as const)
 it.each(['¿Puedo cancelar el pedido?','¿Cómo puedo cancelar el pedido?','Si llega tarde, quiero cancelar el pedido','No canceles el pedido'])('%s '+state+' agent='+agent, async text => {
  const h=harness([dish],agent);
  h.conv.state=state;
  h.conv.sessionData.cart=[{productId:dish.id,name:dish.name,code:dish.code,unitPrice:dish.price,quantity:2,attributes:[],note:'sin sal'}];
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  h.service.ordersService.cancel=jest.fn();
  const before=structuredClone(h.cartRows());
  const reply=await h.sendQueued(text);
  expect(h.cartRows()).toEqual(before);
  expect(h.conv.state).toBe(state);
  expect(h.service.ordersService.cancel).not.toHaveBeenCalled();
  expect(reply||'').not.toMatch(/qued[oó] cancelado|armamos otro/i);
  expect(reply||'').toMatch(/cancel|conserv|mantengo/i);
 });
 }
 it.each([true,false].flatMap(agent=>['Cancela el pedido','Quiero cancelar el pedido'].map(text=>({agent,text}))))('explicit draft cancellation $text agent=$agent',async ({agent,text})=>{
  const dish={id:59003,code:993,name:'Ensalada De Quinoa',price:19000,availableNow:true,hasAttributes:false,attributes:[]};
  const h=harness([dish],agent);
  h.conv.sessionData.cart=[{productId:dish.id,name:dish.name,code:dish.code,unitPrice:dish.price,quantity:1,attributes:[]}];
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  const reply=await h.sendQueued(text);
  expect(h.cartRows()).toEqual([]);
  expect(reply||'').toMatch(/qued[oó] cancelado/i);
 });

});


describe('Cancellation aside with independent purchase',()=>{
 const menus=[
  [{id:59101,code:981,name:'Bowl De Garbanzos',price:19000,availableNow:true,hasAttributes:false,attributes:[]},{id:59102,code:982,name:'Agua De Jamaica',price:5000,availableNow:true,hasAttributes:false,attributes:[]}],
  [{id:59111,code:983,name:'Crepe De Espinaca',price:22000,availableNow:true,hasAttributes:false,attributes:[]},{id:59112,code:984,name:'Te De Jazmin',price:6000,availableNow:true,hasAttributes:false,attributes:[]}]
 ];
 for(const menu of menus)for(const agent of [true,false])for(const state of ['building_cart','awaiting_payment'] as const)
 it.each([
  '¿Puedo cancelar el pedido? Además agrega dos PRODUCT.',
  '¿Cómo puedo cancelar el pedido? Y agrega dos PRODUCT.',
  'No canceles el pedido; agrega dos PRODUCT.',
  'Si llega tarde, quiero cancelar el pedido; aparte agrega dos PRODUCT.',
  'Agrega dos PRODUCT; ¿puedo cancelar el pedido?',
  'Puedo cancelar el pedido y agrega dos PRODUCT',
  'No canceles el pedido y agrega dos PRODUCT'
 ])('%s '+menu[0].name+' '+state+' agent='+agent,async template=>{
  const h=harness(menu,agent);h.conv.state=state;
  h.conv.sessionData.cart=[{productId:menu[0].id,code:menu[0].code,name:menu[0].name,unitPrice:menu[0].price,quantity:1,attributes:[],note:'sin sal'}];
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);h.service.ordersService.cancel=jest.fn();h.service.ordersService.create=jest.fn();
  Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,address:'Calle 12 34 56',addressConfirmed:true,deliveryFeeCalculated:2000,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
  h.service.ordersService.create.mockResolvedValue({id:5900,dailyOrderNumber:59});
  const start=h.replies.length;
  await h.sendQueued(template.replace('PRODUCT',menu[1].name));
  expect(h.cartRows()).toEqual([expect.objectContaining({id:menu[0].id,qty:1,note:'sin sal'}),expect.objectContaining({id:menu[1].id,qty:2})]);
  const response=h.replies.slice(start).join('\n');
  expect(response).toMatch(/cancel|conservo/i);expect(response).toContain(menu[1].name);
  expect(response).not.toMatch(/qued[oó] cancelado|no manejamos/i);
  expect(h.service.ordersService.cancel).not.toHaveBeenCalled();expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(h.conv.state==='building_cart')await h.sendQueued('Nada mas');
  await h.sendQueued('Pago contraentrega');
  expect(h.conv.state).toBe('awaiting_final_confirm');
  await h.sendQueued('Si');
  expect(h.conv.state).toBe('completed');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const order=h.service.ordersService.create.mock.calls[0][0];expect(order.items).toHaveLength(3);
  expect(order.items.filter((line:any)=>line.productId===menu[0].id)).toEqual([expect.objectContaining({note:'sin sal'})]);
  expect(order.items.filter((line:any)=>line.productId===menu[1].id)).toHaveLength(2);
 });
});

describe('Confirmation questions are not final approval',()=>{
 const menu=[{id:62301,code:62301,name:'Tostada De Hongos',price:14000,availableNow:true,hasAttributes:false,attributes:[]}];
 for(const agent of [false,true])for(const text of ['Confirmo?','Confirmar el pedido?','Asi esta bien?','¿Con esto queda confirmado?','Si confirmo cuanto tarda?']){
  it(text+' agent='+agent,async()=>{
   const h=harness(menu,agent);h.conv.state='awaiting_final_confirm';h.service.ordersService.create=jest.fn();
   Object.assign(h.conv.sessionData,{cart:[{productId:62301,code:62301,name:menu[0].name,unitPrice:14000,quantity:1,attributes:[]}],orderType:'delivery',fulfillmentChosen:true,address:'Calle 12 34 56',addressConfirmed:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,paymentMethod:'contraentrega',notesCollected:true,deliveryFeeCalculated:2000});
   const before=structuredClone(h.conv.sessionData);await h.sendQueued(text);expect(h.conv.sessionData).toEqual(before);expect(h.conv.state).toBe('awaiting_final_confirm');expect(h.service.ordersService.create).not.toHaveBeenCalled();
   expect(h.replies.join(' ')).not.toMatch(/pedido registrado|no manejamos|no tenemos/i);
   h.service.ordersService.create.mockResolvedValue({id:6230,dailyOrderNumber:64});
   await h.sendQueued('Confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.conv.state).toBe('completed');
   await h.sendQueued('Gracias señor');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.conv.state).toBe('completed');
  });
 }
});

describe('Counted option edits retain other attributes and unrelated products',()=>{
 for(const agent of [false,true])for(const state of ['building_cart','awaiting_address']){
  it(state+' agent='+agent,async()=>{
   const menu=[{id:63201,code:63201,name:'Bao De Hongos',price:18000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Salsa',options:['Teriyaki','Ponzu']},{attributeName:'Masa',options:['Blanca','Integral']}]},{id:63202,code:63202,name:'Agua Mineral',price:4000,availableNow:true,hasAttributes:false,attributes:[]}];
   const h=harness(menu,agent);h.conv.state=state;h.conv.sessionData.cart=[{productId:63201,code:63201,name:menu[0].name,quantity:4,unitPrice:18000,note:'sin cebolla',attributes:[{attributeName:'Salsa',attributeValue:'Teriyaki'},{attributeName:'Masa',attributeValue:'Integral'}]},{productId:63202,code:63202,name:menu[1].name,quantity:1,unitPrice:4000,note:'fria',attributes:[]}];
   const water=structuredClone(h.conv.sessionData.cart[1]);await h.sendQueued('Cambia la salsa de dos Bao De Hongos a Ponzu');
   expect(h.conv.state).toBe(state);expect(h.conv.sessionData.cart).toHaveLength(3);expect(h.conv.sessionData.cart[2]).toEqual(water);
   expect(h.conv.sessionData.cart.reduce((sum,line)=>sum+line.quantity*line.unitPrice,0)).toBe(76000);
   for(const line of h.conv.sessionData.cart.slice(0,2)){expect(line.quantity).toBe(2);expect(line.note).toBe('sin cebolla');expect(line.attributes).toContainEqual({attributeName:'Masa',attributeValue:'Integral'});}
  });
 }
});

describe('Missing purchases with no alternatives or restaurant configured families',()=>{
 for(const agent of [false,true])it('does not invent an alternative agent='+agent,async()=>{
  const h=harness([{id:63601,code:63601,name:'Bao De Hongos',price:18000,availableNow:true,attributes:[]}],agent);h.conv.state='awaiting_payment';h.conv.sessionData.cart=[{productId:63601,code:63601,name:'Bao De Hongos',unitPrice:18000,quantity:1,attributes:[]}];const before=structuredClone(h.conv.sessionData);const reply=await h.sendQueued('Quiero tres carnes a la plancha');expect(h.conv.sessionData).toEqual(before);expect(reply).toMatch(/no tengo alternativas/i);expect(reply).not.toMatch(/Churrasco|Sobrebarriga/);
 });
 for(const agent of [false,true])it('uses restaurant configured family agent='+agent,async()=>{
  const h=harness([{id:63611,code:63611,name:'Roll De Pepino',price:15000,availableNow:true,attributes:[]},{id:63612,code:63612,name:'Roll De Aguacate',price:16000,availableNow:true,attributes:[]}],agent);(h.cfg as any).menuConceptGroups=[{id:'rolls',label:'Rolls',triggers:['roll','rolls'],productKeywords:['roll']}];const reply=await h.sendQueued('Quiero tres rolls de tocino');expect(reply).toMatch(/No encontré/);expect(reply).toMatch(/Roll De Pepino/);expect(h.conv.sessionData.cart).toEqual([]);await h.sendQueued('Roll De Pepino');expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:63611,quantity:3})]);
 });
});

describe('Captured reserved model turn preserves joint subset semantics',()=>{
 it('replays actual model calls for bowls without another inference request',async()=>{
  const menu=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-joint-subset-menu-1810.json'),'utf8'));
  const fixture=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-joint-subset-reserved-1810.json'),'utf8'))[0];
  const captured=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-joint-subset-captured-1810.json'),'utf8'));
  const h=harness(menu,true);h.conv.sessionData.cart=fixture.initialCart.map((line:any)=>({productId:line.id,code:menu[0].code,name:menu[0].name,unitPrice:menu[0].price,quantity:line.quantity,note:line.note,attributes:line.attributes}));
  h.service.ordersService.create=jest.fn();
  h.agent.runTurn.mockImplementationOnce(async input=>{
   const service=new WhatsappAgentService({} as never,h.service.catalogService) as any;const actions:any={};
   const ctx={actions,cart:input.cart,products:menu,byId:new Map(menu.map((product:any)=>[product.id,product])),userMessage:input.userMessage,setNeedsAttr:()=>{}};
   for(const call of captured.calls)expect(JSON.parse(service.executeTool(call.name,call.args,ctx)).ok).toBe(true);
   expect(actions).toEqual(captured.actions);return {reply:'Listo',actions,toolCalls:captured.calls.map((call:any)=>call.name)};
  });
  const reply=await h.sendQueued(captured.message);expect(h.conv.sessionData.cart).toEqual(captured.expectedCart);
  expect(reply).toContain('sin sal');expect(reply).toContain('Quinua');expect(reply).toContain('Arroz');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});

describe('Distributed purchases reject incomplete semantic proposals atomically',()=>{
 for(const name of ['Cesta De Panes','Bento De Setas','Trio De Tostadas'])for(const mode of ['missing','failed_after_first','wrong_total','wrong_groups','wrong_options','mixed_clear'])it(`${name} ${mode}`,async()=>{
  const product={id:65001,code:65001,name,price:19000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Salsa',options:['Suave','Picante']}]};
  const h=harness([product],true);h.conv.sessionData.cart=[{productId:product.id,code:product.code,name,unitPrice:19000,quantity:1,note:'anterior',attributes:[{attributeName:'Salsa',attributeValue:'Suave'}]}];
  const before=structuredClone(h.conv.sessionData.cart);h.service.ordersService.create=jest.fn();
  h.agent.runTurn.mockImplementationOnce(async input=>{
   const service=new WhatsappAgentService({} as never,h.service.catalogService) as any;const actions:any={};
   const ctx={actions,cart:input.cart,products:[product],byId:new Map([[product.id,product]]),userMessage:input.userMessage,setNeedsAttr:()=>{}};
   const quantities=mode==='missing'||mode==='failed_after_first'?[2]:mode==='wrong_total'?[2,3]:mode==='wrong_groups'?[1,3]:[2,2];
   for(const [index,quantity] of quantities.entries())expect(JSON.parse(service.executeTool('add_item',{productId:product.id,quantity,attributes:[{attributeName:'Salsa',attributeValue:index&&mode!=='wrong_options'?'Picante':'Suave'}],note:index?'sin sal':undefined},ctx)).ok).toBe(true);
   if(mode==='mixed_clear')actions.clearCart=true;
   return {reply:'Listo todo añadido',actions,toolCalls:quantities.map(()=> 'add_item'),purchaseAttempts:quantities.map(()=>({productId:product.id,accepted:true})),...(mode==='failed_after_first'?{error:'max_iterations'}:{})};
  });
  const reply=await h.sendQueued(`Quiero cuatro ${name}, 2 con Suave y 2 con Picante; los de Picante sin sal`);
  expect(h.conv.sessionData.cart).toEqual(before);expect(reply).toMatch(/reparto.*completo|cantidades.*coinciden/i);expect(reply).not.toContain('todo añadido');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});

describe('Intensity preferences do not silently choose a named attribute option',()=>{
 const fixtures=[{name:'Curry de Garbanzos',attr:'Salsa',base:'Suave',other:'Picante',note:'no tan picante'},{name:'Ramen Vegetal',attr:'Caldo',base:'Natural',other:'Salado',note:'que no esté tan salado'},{name:'Flan Artesanal',attr:'Cobertura',base:'Tradicional',other:'Dulce',note:'no tan dulce'}];
 for(const f of fixtures)for(const enabled of [false,true])for(const explicit of [false,true])it(`${f.name} agent=${enabled} explicit=${explicit}`,async()=>{
  const product={id:65601,code:65601,name:f.name,price:18000,availableNow:true,hasAttributes:true,attributes:[{attributeName:f.attr,options:[f.base,f.other]}]};const h=harness([product],enabled);
  Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,address:'Calle 12 34 56',addressConfirmed:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,deliveryFeeCalculated:2000});h.service.ordersService.create=jest.fn().mockResolvedValue({id:6560,dailyOrderNumber:86});
  const source=`Quiero dos ${f.name}${explicit?` con ${f.attr} ${f.other}, pero`:''} ${f.note} por favor`;
  const reply=await h.sendQueued(source);expect(reply).not.toMatch(/no (?:manejamos|tenemos)|no pude añadir/i);expect(h.conv.sessionData.cart).toHaveLength(1);const line=h.conv.sessionData.cart[0];expect(line.quantity).toBe(2);expect(line.attributes).toContainEqual({attributeName:f.attr,attributeValue:explicit?f.other:f.base});expect(line.note).toContain(f.note);
  const cart=JSON.parse(JSON.stringify(h.conv.sessionData.cart));const state=h.conv.state;await h.sendQueued(`Cuánto cuesta ${f.name}`);expect(h.conv.sessionData.cart).toEqual(cart);expect(h.conv.state).toBe(state);
  if(h.conv.state==='building_cart')await h.sendQueued('Nada más');if(h.conv.state==='awaiting_payment')await h.sendQueued('1');await h.sendQueued('Confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items=h.service.ordersService.create.mock.calls[0][0].items;expect(items).toHaveLength(2);expect(items.every((item:any)=>item.note===line.note&&item.attributes.some((a:any)=>a.attributeName===f.attr&&a.attributeValue===(explicit?f.other:f.base)))).toBe(true);
 });
});

describe('Partial combo scope boundaries preserve the full order through checkout', () => {
  const menus = [
    {food: 'Arepa De Champinones', drink: 'Agua De Panela'},
    {food: 'Burrito Vegetal', drink: 'Te Verde'},
  ];
  for (const menu of menus) for (const enabled of [false, true]) {
    for (const state of ['building_cart', 'awaiting_payment']) {
      for (const boundary of ['zero', 'excess', 'wrong_total', 'ambiguous']) {
        it(`${menu.food} agent=${enabled} state=${state} ${boundary}`, async () => {
          const main = {id: 66301, code: 66301, name: menu.food, price: 18000, availableNow: true, attributes: []};
          const drink = {id: 66302, code: 66302, name: menu.drink, categoryName: 'Bebidas', price: 6000, availableNow: true, attributes: []};
          const combo = {id: 66303, code: 66303, name: 'Combo De ' + menu.food, description: 'Incluye bebida de 1.5L', price: 24000, availableNow: true, attributes: [{attributeName: 'Bebida', options: [menu.drink]}]};
          const other = {id: 66304, code: 66304, name: 'Croquetas De Garbanzo', price: 10000, availableNow: true, attributes: []};
          const h = harness([main, drink, combo, other], enabled);
          h.conv.state = state;
          const line = (p: any, quantity: number, note: string) => ({productId: p.id, code: p.code, name: p.name, unitPrice: p.price, quantity, note});
          Object.assign(h.conv.sessionData, {cart: [line(main, 4, 'Sin cebolla'), line(drink, 4, 'Sin hielo'), ...(boundary === 'ambiguous' ? [line(other, 1, 'Bien doradas')] : [])], orderType: 'pickup', fulfillmentChosen: true, phoneConfirmed: true, contactPhone: h.conv.phoneE164, notesCollected: true});
          h.service.ordersService.create = jest.fn().mockResolvedValue({id: 6630, dailyOrderNumber: 102});
          const before = structuredClone(h.conv.sessionData.cart);
          const text = boundary === 'ambiguous' ? `damelo solo 2 en combo con ${menu.drink}` : `el ${menu.food} damelo ${boundary === 'wrong_total' ? 'solo dos de los cinco' : boundary === 'zero' ? 'solo 0' : 'solo 9'} en combo con ${menu.drink}`;
          const reply = await h.sendQueued(text);
          expect(reply).toMatch(/pedido sigue igual/i);
          expect(reply).not.toMatch(/listo ✅|lo cambi[eé]/i);
          if (boundary === 'ambiguous') expect(reply).toMatch(/indica el plato/i);
          expect(h.conv.sessionData.cart).toEqual(before);
          expect(h.conv.state).toBe(state);
          expect(h.service.ordersService.create).not.toHaveBeenCalled();
          const total = await h.sendQueued('cuánto suma mi pedido');
          expect(total).toMatch(boundary === 'ambiguous' ? /106[.,]000/ : /96[.,]000/);
          expect(h.conv.sessionData.cart).toEqual(before);
          expect(h.conv.state).toBe(state);
          await h.sendQueued('nada más');
          await h.sendQueued('1');
          expect(h.service.ordersService.create).not.toHaveBeenCalled();
          await h.sendQueued('confirmar');
          expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
          const dto = h.service.ordersService.create.mock.calls[0][0];
          expect(dto.items).toHaveLength(boundary === 'ambiguous' ? 9 : 8);
          expect(dto.items.filter((item: any) => item.productId === main.id)).toHaveLength(4);
          expect(dto.items.filter((item: any) => item.productId === drink.id)).toHaveLength(4);
          expect(dto.items.filter((item: any) => item.productId === main.id).every((item: any) => /sin cebolla/i.test(item.note))).toBe(true);
          expect(dto.items.filter((item: any) => item.productId === drink.id).every((item: any) => /sin hielo/i.test(item.note))).toBe(true);
        });
      }
    }
  }
});

describe('Address photos resume checkout without becoming food or payment proof',()=>{
 for(const name of ['Ravioles De Ricota','Bowl De Garbanzos','Sandwich De Pavo'])for(const state of ['building_cart','awaiting_address','awaiting_payment','awaiting_final_confirm'])it(`${name} ${state}`,async()=>{
  const h=harness([{id:67201,code:67201,name,price:21000,availableNow:true,attributes:[]}],false);h.conv.state=state;
  Object.assign(h.conv.sessionData,{cart:[{productId:67201,name,unitPrice:21000,quantity:2,note:'Salsa aparte'}],orderType:'delivery',fulfillmentChosen:true,address:'Calle 1 #2-3',addressConfirmed:true,deliveryFeeCalculated:9000,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,paymentMethod:state==='awaiting_final_confirm'?'cash':undefined});
  Object.assign(h.cfg,{deliveryFeeMode:'route',restaurantLat:4.62,restaurantLng:-74.15});
  h.service.deliveryRouting.quoteDeliveryFee=jest.fn().mockResolvedValue({ok:true,fee:2000,distanceKm:1,source:'google_directions',customer:{lat:4.62,lng:-74.15}});
  h.service.metaService.downloadMedia=jest.fn().mockResolvedValue({buffer:Buffer.from('mock-image'),mimeType:'image/jpeg'});h.service.catalogService.getMenuDetailedText=jest.fn().mockResolvedValue(name);h.service.conversationService.updateMessageBody=jest.fn();
  h.service.aiService.analyzeOrderImage=jest.fn().mockResolvedValue({kind:'address',textForBot:'Calle 10 #81A-20 torre B apartamento 304B',visibleText:'Calle 10 #81A-20 torre B apartamento 304B'});h.service.ordersService.create=jest.fn().mockResolvedValue({id:6720,dailyOrderNumber:113});
  const before=structuredClone(h.conv.sessionData.cart);const reply=await h.sendQueued('',{messageType:'image',mediaId:'address-photo'});
  expect(reply).toMatch(/81A-20.*torre B.*304B/i);expect(reply).not.toMatch(/cu[aá]l plato|comprobante|no manejamos/i);expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.address).toMatch(/81A-20.*304B/);expect(h.conv.sessionData.deliveryFeeCalculated).toBe(2000);expect(h.service.aiService.analyzeOrderImage).toHaveBeenCalledTimes(1);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(state!=='awaiting_final_confirm')await h.sendQueued('1');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.address).toMatch(/81A-20.*304B/);expect(dto.deliveryFee).toBe(2000);expect(dto.items).toEqual([{productId:67201,attributes:undefined,note:'Salsa aparte'},{productId:67201,attributes:undefined,note:'Salsa aparte'}]);
 });
 for(const text of ['', 'Calle 10 #81A-20\nCarrera 20 #30-40'])it(`uncertain address does not overwrite destination: ${text}`,async()=>{
  const h=harness(products,false);h.conv.state='awaiting_payment';Object.assign(h.conv.sessionData,{address:'Calle 1 #2-3',paymentMethod:'transfer',cart:[{productId:23,name:'Arroz Con Pollo',quantity:1,unitPrice:29500}]});
  h.service.metaService.downloadMedia=jest.fn().mockResolvedValue({buffer:Buffer.from('mock'),mimeType:'image/jpeg'});h.service.catalogService.getMenuDetailedText=jest.fn().mockResolvedValue('');h.service.conversationService.updateMessageBody=jest.fn();h.service.aiService.analyzeOrderImage=jest.fn().mockResolvedValue({kind:'address',textForBot:text,visibleText:text});const before=structuredClone(h.conv.sessionData);
  const reply=await h.sendQueued('Esta es la dirección',{messageType:'image',mediaId:'address-uncertain'});expect(reply).toMatch(/direcci[oó]n|ubicaci[oó]n/i);expect(reply).not.toMatch(/cu[aá]l plato|comprobante/i);expect(h.conv.sessionData.address).toBe(before.address);expect(h.conv.sessionData.cart).toEqual(before.cart);
 });
});

it('Expired address photo asks for destination rather than a dish or payment proof',async()=>{
 const h=harness(products,false);h.conv.state='awaiting_payment';Object.assign(h.conv.sessionData,{paymentMethod:'transfer',address:'Calle 1 #2-3'});h.service.metaService.downloadMedia=jest.fn().mockRejectedValue(new Error('fixture expired'));const before=structuredClone(h.conv.sessionData);
 const reply=await h.sendQueued('Foto de mi dirección',{messageType:'image',mediaId:'expired-address'});expect(reply).toMatch(/calle y n[uú]mero|ubicaci[oó]n/i);expect(reply).not.toMatch(/plato|comprobante/i);expect(h.conv.sessionData.address).toBe(before.address);expect(h.conv.sessionData.cart).toEqual(before.cart);
});

describe('Fresh destination request suspends the old destination and permits cart interruptions',()=>{
 for(const name of ['Ravioles De Ricota','Bowl De Garbanzos'])for(const enabled of [false,true])for(const confirmed of [false,true])it(`${name} confirmed=${confirmed} agent=${enabled}`,async()=>{
  const h=harness([{id:80041,code:80041,name,price:21000,availableNow:true,attributes:[]}],enabled);
  Object.assign(h.cfg,{deliveryFeeMode:'route_tiers',restaurantLat:4.62,restaurantLng:-74.15});
  h.cfg.paymentMethods=DEFAULT_PAYMENT_METHODS.map(method=>({...method,enabled:method.flow!=='mercadopago'}));
  Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,notesCollected:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,lastDeliveryAddress:'Calle 10 #81A-20 torre B apto 304B'});
  h.service.deliveryRouting={quoteDeliveryFee:jest.fn().mockImplementation(async({customerAddress}:any)=>({ok:true,fee:customerAddress.includes('45-60')?6000:2000,distanceKm:customerAddress.includes('45-60')?4:1,source:'google_directions',customer:{lat:4.62,lng:-74.15}}))};
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:8004,dailyOrderNumber:91});
  await h.sendQueued(`Quiero dos ${name}`);
  if(confirmed){await h.sendQueued('Calle 10 #81A-20 torre B apto 304B');await h.sendQueued('contraentrega');}
  else {const prompt=await h.sendQueued('Nada más');expect(prompt).toMatch(/misma.*nueva/i);}
  if(confirmed && name.startsWith('Bowl'))h.conv.sessionData.lastDeliveryAddress=undefined;
  const cart=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued('A una nueva por favor');expect(reply).toMatch(/direcci[oó]n nueva|nueva direcci[oó]n/i);
  expect(h.conv.state).toBe('awaiting_address');expect(h.conv.sessionData.address).toBeFalsy();expect(h.conv.sessionData.addressConfirmed).not.toBe(true);
  expect(h.conv.sessionData.deliveryFeeCalculated == null).toBe(true);expect(h.conv.sessionData.deliveryLat == null).toBe(true);
  expect(h.conv.sessionData.cart).toEqual(cart);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  const summary=await h.sendQueued('Déjame ver el carrito');expect(summary).toContain(name);expect(summary).not.toMatch(/81A-20|304B/);
  await h.sendQueued(`Agrega un ${name}`);expect(h.cartRows()).toEqual([expect.objectContaining({id:80041,qty:3})]);
  const resume=await h.sendQueued('Nada más');expect(resume).not.toMatch(/81A-20|304B|misma.*nueva/i);
  await h.sendQueued('Sí');expect(h.conv.sessionData.address).toBeFalsy();expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('Torre C apto 205');expect(h.conv.sessionData.addressConfirmed).not.toBe(true);
  await h.sendQueued('Carrera 22 #45-60');expect(h.conv.sessionData.address).toMatch(/45-60.*Torre C.*205/i);
  expect(h.conv.sessionData.address).not.toMatch(/81A-20|304B|Torre B/i);expect(h.conv.sessionData.deliveryFeeCalculated).toBe(6000);
  if(h.conv.state==='awaiting_payment')await h.sendQueued('contraentrega');
  expect(h.conv.state).toBe('awaiting_final_confirm');expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.address).toMatch(/45-60.*Torre C.*205/i);
  expect(dto.address).not.toMatch(/81A-20|304B/);expect(dto.deliveryFee).toBe(6000);expect(dto.items).toHaveLength(3);
 });
});
