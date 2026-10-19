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

describe('Foto de combo — catálogo alternativo',()=>{
  it.each(['código 7','#7'])('selección %s usa defaults de otro negocio',async text=>{
    const menu=[{id:9870,code:7,name:'Bowl Mediterraneo',price:18000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Agua','Limonada']}]}];
    const h=harness(menu,false);const resolved=h.service.resolveImageOrderText({kind:'order',textForBot:text},undefined,menu);
    await h.sendQueued(resolved);
    expect(h.cartRows()).toEqual([expect.objectContaining({id:9870,qty:1,attrs:['Bebida:Agua']})]);
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

/** Sequential contracts: real router/tools/guard, provider and side effects mocked. */
describe('Tanda de continuidad — paquete condicional, consulta y cambio en checkout',()=>{
 const fictional=[{id:97601,code:97601,name:'Pack De Gyozas',description:'Seis gyozas vegetales',price:23000,attributes:[],hasAttributes:false,availableNow:true}];
 const taco=products.find((p:any)=>p.code===71);
 for(const fixture of [{kind:'PPP',menu:products,product:taco},{kind:'japonés',menu:fictional,product:fictional[0]}]){
  it.each(['awaiting_name','awaiting_address','awaiting_payment'])('$state conserva consulta y edición: '+fixture.kind,async state=>{
   const h=harness(fixture.menu,true);h.service.ordersService.create=jest.fn();
   h.service.agentService=new WhatsappAgentService({getEffectiveConfig:async()=>({openaiApiKey:'offline-key',openaiModel:'gpt-4.1-2025-04-14',systemPrompt:'',localContext:{}})} as never,h.service.catalogService);
   const response=(message:unknown)=>({ok:true,json:async()=>({choices:[{message}]})});
   const beforeFetch=globalThis.fetch;const fetchMock=jest.fn().mockRejectedValue(new Error('Unexpected provider call in isolated sequential test'))
    .mockResolvedValueOnce(response({content:null,tool_calls:[{id:'one-package',type:'function',function:{name:'add_item',arguments:JSON.stringify({productId:fixture.product.id,quantity:1})}}]}))
    .mockResolvedValueOnce(response({content:'No tenemos flan. Agregué un '+fixture.product.name+'.'}));globalThis.fetch=fetchMock;
   try{
    await h.sendQueued(`Buenas noches, por favor me envías un ${fixture.product.name}. Si no venden flan, no incluyas postre ni lo reemplaces.`);
    expect(h.cartRows()).toEqual([expect.objectContaining({id:fixture.product.id,qty:1})]);expect(h.replies.at(-1)).toMatch(/no tenemos flan/i);
    h.conv.state=state;if(state==='awaiting_name')h.conv.customerName='';
    const oldName=h.conv.customerName;const before=structuredClone(h.conv.sessionData.cart);
    const total=await h.sendQueued('Antes de seguir, cuánto vale todo eso?');
    expect(total||'').toContain(fixture.product.price.toLocaleString('es-CO'));
    expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.customerName).toBe(oldName);expect(h.conv.state).toBe(state);
    await h.sendQueued('Deja solo dos '+fixture.product.name);
    expect(h.cartRows()).toEqual([expect.objectContaining({id:fixture.product.id,qty:2})]);expect(h.conv.customerName).toBe(oldName);
    expect(h.conv.state).toBe(state);
    const revised=await h.sendQueued('Una pregunta, cuánto cuesta todo esto?');
    expect(revised||'').toContain((2*fixture.product.price).toLocaleString('es-CO'));
    expect(h.cartRows()).toEqual([expect.objectContaining({id:fixture.product.id,qty:2})]);
    expect(fetchMock).toHaveBeenCalledTimes(2);expect(h.service.ordersService.create).not.toHaveBeenCalled();
   }finally{globalThis.fetch=beforeFetch;}
  });
 }
});

describe('Foto seguida de consulta, eliminación y cantidad durante pago — dos menús',()=>{
 const alternate=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-sol-office-menu-1510.json'),'utf8'));
 const examples=[{name:'PPP',menu:products,ids:[17,23,38]},{name:'japonés',menu:alternate,ids:[8813,8814,8815]}];
 for(const f of examples)it.each([false,true])('conserva notas y retoma el pago, agente=%s: '+f.name,async enabled=>{
  const h=harness(f.menu,enabled);const selected=f.ids.map(id=>f.menu.find((p:any)=>p.id===id));
  h.service.metaService.downloadMedia=jest.fn().mockResolvedValue({buffer:Buffer.from('synthetic-photo'),mimeType:'image/png'});
  h.service.catalogService.getMenuDetailedText=jest.fn().mockResolvedValue('fixture-menu');
  h.service.aiService.analyzeOrderImage=jest.fn().mockResolvedValue({kind:'order',textForBot:selected.map((p:any,i:number)=>`${[2,1,3][i]} x ${p.name} (código ${p.code})${i===0?', salsa aparte':''}`).join('\n')});
  h.service.conversationService.updateMessageBody=jest.fn().mockResolvedValue(undefined);h.service.ordersService.create=jest.fn();
  await h.sendQueued('',{messageType:'image',mediaId:'fixture-photo'});
  expect(h.cartRows().map(row=>({id:row.id,qty:row.qty}))).toEqual(f.ids.map((id,i)=>({id,qty:[2,1,3][i]})));
  h.conv.state='awaiting_payment';h.conv.sessionData.phoneConfirmed=true;
  const before=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('Antes de pagar, cuánto cuesta '+selected[0].name+'?');
  expect(h.conv.sessionData.cart).toEqual(before);expect(h.replies.at(-1)).toContain(selected[0].price.toLocaleString('es-CO'));expect(h.conv.state).toBe('awaiting_payment');
  await h.sendQueued('Quita '+selected[1].name);expect(h.cartRows().map(row=>row.id)).toEqual([f.ids[0],f.ids[2]]);
  await h.sendQueued('Deja solo tres '+selected[0].name);
  expect(h.cartRows()).toEqual([expect.objectContaining({id:f.ids[0],qty:3,note:expect.stringMatching(/salsa aparte/i)}),expect.objectContaining({id:f.ids[2],qty:3})]);
  await h.sendQueued('Antes de seguir, cuánto vale todo eso?');expect(h.replies.at(-1)).toContain((3*selected[0].price+3*selected[2].price).toLocaleString('es-CO'));
  expect(h.conv.state).toBe('awaiting_payment');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});

describe('Edición de checkout — identidad y opciones inválidas no permiten otra compra',()=>{
 it.each([
  {updateAttributes:[{productId:8961,cartLineIndex:3,attributeName:'Bebida',attributeValue:'Limonada'}]},
  {updateAttributes:[{productId:8961,cartLineIndex:0,attributeName:'Bebida',attributeValue:'Chocolate'}]},
  {updateCartLines:[{productId:8961,cartLineIndex:3,quantity:1}]},
  {updateCartLines:[{productId:8961,cartLineIndex:0,quantity:0}]},
 ])('conserva carrito ante %j',async actions=>{
  const menu=[{id:8961,code:8961,name:'Combo De Falafel',price:29000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Te Frio','Limonada']}]},{id:8962,code:8962,name:'Limonada Natural',price:6000,availableNow:true,hasAttributes:false,attributes:[]}];
  const h=harness(menu,true);h.conv.state='awaiting_payment';h.conv.customerName='Ana';h.conv.sessionData={cart:[{productId:8961,name:menu[0].name,code:8961,unitPrice:29000,quantity:2,attributes:[{attributeName:'Bebida',attributeValue:'Te Frio'}]}],orderType:'delivery',address:'Calle 18 sur 70 25',addressConfirmed:true};
  const before=structuredClone(h.conv.sessionData.cart);
  h.agent.runTurn.mockResolvedValue({reply:'Ya lo cambié.',actions,toolCalls:['get_cart',actions.updateAttributes?'set_attribute':'update_item']});
  const reply=await h.send('Cámbiame la bebida de los dos combos por limonada, no agregues otra bebida');
  expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.state).toBe('awaiting_payment');expect(reply).toMatch(/no pude aplicar/i);expect(reply).not.toContain('Ya lo cambié');
 });
});

describe('Edición seguida de total — aclara la línea antes de cotizar', () => {
  for (const f of [{ id: 19501, name: 'Arepa De Setas', price: 15000 }, { id: 19511, name: 'Tortilla De Espinaca', price: 17000 }]) {
    it.each([false, true])(`${f.name}, agente %s`, async agent => {
      const menu = [{ id: f.id, code: f.id, name: f.name, price: f.price, availableNow: true, hasAttributes: false, attributes: [] }];
      const h = harness(menu, agent);
      h.service.ordersService.create = jest.fn();
      h.conv.state = 'awaiting_payment';
      Object.assign(h.conv.sessionData, {
        orderType: 'delivery', address: 'Calle 12 30 45', addressConfirmed: true,
        phoneConfirmed: true, contactPhone: h.conv.phoneE164, deliveryFeeCalculated: 3000,
        cart: ['sin cebolla', 'sin tomate'].map((note, index) => ({ productId: f.id, code: f.id, name: f.name,
          unitPrice: f.price, quantity: index ? 2 : 3, note, attributes: [] })),
      });
      const before = structuredClone(h.conv.sessionData.cart);
      await h.sendQueued(`Quita las ${f.name} y dime cuánto queda`);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.pendingCartRemoval?.options).toHaveLength(2);
      expect(h.replies.at(-1)).toMatch(/cuál línea/i);
      expect(h.replies.at(-1)).not.toMatch(/total/i);
      await h.sendQueued('2');
      expect(h.cartRows()).toEqual([expect.objectContaining({ id: f.id, qty: 3, note: 'sin cebolla' })]);
      expect(h.conv.sessionData.paymentMethod).toBeUndefined();
      expect(h.conv.state).toBe('awaiting_payment');
      const total = 3 * f.price + 3000;
      expect(h.replies.at(-1)).toMatch(new RegExp('Total[^\\n]*'+total.toLocaleString('es-CO').replace(/\./g, '[.,]'), 'i'));
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
  }
});

describe('Condición más eliminación ambigua — elegir línea no autoriza cambio condicionado', () => {
  for (const f of [
    { id: 19901, name: 'Combo De Wraps', attr: 'Bebida', first: 'Te', next: 'Agua', side: 'Sopa De Hongos' },
    { id: 19911, name: 'Combo De Bao', attr: 'Salsa', first: 'Soja', next: 'Teriyaki', side: 'Edamame' },
  ]) {
    it.each([false, true])(`${f.name}, agente %s`, async agent => {
      const menu = [
        { id: f.id, code: f.id, name: f.name, price: 21000, availableNow: true, hasAttributes: true,
          attributes: [{ attributeName: f.attr, options: [f.first, f.next] }] },
        { id: f.id + 1, code: f.id + 1, name: f.side, price: 6000, availableNow: true, hasAttributes: false, attributes: [] },
      ];
      const h = harness(menu, agent);
      h.service.ordersService.create = jest.fn();
      h.conv.state = 'awaiting_payment';
      Object.assign(h.conv.sessionData, {
        orderType: 'delivery', address: 'Calle 12 30 45', addressConfirmed: true,
        phoneConfirmed: true, contactPhone: h.conv.phoneE164, deliveryFeeCalculated: 3000,
        cart: [{ productId: f.id, code: f.id, name: f.name, unitPrice: 21000, quantity: 2, note: 'sin cebolla',
          attributes: [{ attributeName: f.attr, attributeValue: f.first }] },
          ...['sin sal', 'sin limón'].map((note, index) => ({ productId: f.id + 1, code: f.id + 1, name: f.side,
            unitPrice: 6000, quantity: index ? 2 : 3, note, attributes: [] }))],
      });
      const before = structuredClone(h.conv.sessionData.cart);
      await h.sendQueued(`Si es gratis cambia ${f.attr} a ${f.next}; aparte quita las ${f.side}`);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.pendingCartRemoval?.options).toHaveLength(2);
      expect(h.replies.at(-1)).toMatch(/cuál línea/i);
      expect(h.replies.join('\n')).toMatch(/no tengo.*(?:costo|recargo).*confirmado/i);
      await h.sendQueued('2');
      expect(h.conv.sessionData.cart).toEqual(before.slice(0, 2));
      expect(h.conv.sessionData.paymentMethod).toBeUndefined();
      expect(h.conv.state).toBe('awaiting_payment');
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
  }
});

describe('Atributos mientras espera dirección — retoma el domicilio pendiente', () => {
  for (const f of [
    { id: 20201, name: 'Combo De Falafel', attr: 'Bebida', before: 'Te Verde', after: 'Agua Mineral' },
    { id: 20211, name: 'Bowl De Tofu', attr: 'Salsa', before: 'Soja', after: 'Teriyaki' },
  ]) for (const agent of [false, true]) for (const addressKind of ['sin dirección', 'lugar no confirmado', 'dirección anterior']) {
    for (const wording of ['explícito', 'referencia']) {
      it(`${f.name}, agente ${agent}, ${addressKind}, ${wording}`, async () => {
        const menu = [
          { id: f.id, code: f.id, name: f.name, price: 21000, availableNow: true, hasAttributes: true,
            attributes: [{ attributeName: f.attr, options: [f.before, f.after] }] },
          { id: f.id + 1, code: f.id + 1, name: f.after, price: 5000, availableNow: true, hasAttributes: false, attributes: [] },
        ];
        const h = harness(menu, agent);
        h.conv.state = 'awaiting_address';
        h.service.ordersService.create = jest.fn();
        Object.assign(h.conv.sessionData, {
          orderType: 'delivery', address: addressKind === 'lugar no confirmado' ? 'Conjunto Los Pinos' : undefined,
          lastDeliveryAddress: addressKind === 'dirección anterior' ? 'Calle 12 30 45' : undefined,
          addressConfirmed: false, deliveryFeeCalculated: null,
          phoneConfirmed: true, contactPhone: h.conv.phoneE164,
          cart: [{ productId: f.id, code: f.id, name: f.name, unitPrice: 21000, quantity: 2, note: 'sin cebolla',
            attributes: [{ attributeName: f.attr, attributeValue: f.before }] }],
        });
        const before = structuredClone(h.conv.sessionData);
        await h.sendQueued(wording === 'explícito' ? `Cambia ${f.attr} de ${f.name} a ${f.after}` : `Lo quiero con ${f.after} por favor`);
        expect(h.cartRows()).toEqual([{ id: f.id, qty: 2, note: 'sin cebolla', attrs: [`${f.attr}:${f.after}`] }]);
        expect(h.conv.sessionData.cart).toEqual([{ ...before.cart[0], attributes: [{ attributeName: f.attr, attributeValue: f.after }] }]);
        expect(h.conv.state).toBe('awaiting_address');
        expect(h.conv.sessionData.address).toBe(before.address);
        expect(h.conv.sessionData.lastDeliveryAddress).toBe(before.lastDeliveryAddress);
        expect(h.conv.sessionData.addressConfirmed).toBe(false);
        expect(h.conv.sessionData.deliveryFeeCalculated).toBeNull();
        const reply = h.replies.at(-1) || '';
        expect(reply).toContain(f.after);
        expect(reply).toMatch(/dirección/i);
        expect(reply).not.toMatch(/algo más|cómo pagas|confirmar\./i);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
        // Geography is simulated; the real router must accept the next street
        // rather than keep treating subsequent turns as product options.
        h.service.ensureDeliveryFeeQuoted = jest.fn(async (session: WhatsappSessionData) => ({
          session: { ...session, addressConfirmed: true, deliveryFeeCalculated: 2000 },
        }));
        await h.sendQueued('Calle 23 45 67');
        expect(h.conv.sessionData.address).toMatch(/calle 23 45 67/i);
        expect(h.conv.sessionData.addressConfirmed).toBe(true);
        expect(h.cartRows()[0].attrs).toEqual([`${f.attr}:${f.after}`]);
        expect(h.conv.state).toBe('awaiting_payment');
        expect(h.replies.at(-1)).toMatch(/pagas|pago/i);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
      });
    }
  }
});


describe('cart inspection interrupts pending checkout field', () => {
  for (const state of ['awaiting_address', 'awaiting_name', 'awaiting_phone', 'awaiting_payment', 'awaiting_final_confirm']) {
    for (const enabled of [true, false]) {
      for (const question of ['Me dejas ver cuales son los tres items', 'Muestrame el pedido', 'ver carrito']) {
        it(`${state} answers ${question}, agent ${enabled}`, async () => {
          const h = harness(products, enabled);
          h.conv.state = state;
          Object.assign(h.conv.sessionData, { orderType: 'delivery', address: 'Altavista', lastDeliveryAddress: 'Altavista',
            addressConfirmed: false, contactPhone: h.conv.phoneE164, phoneConfirmed: state !== 'awaiting_phone', deliveryFeeCalculated: 2000,
            cart: [{ productId: 22, code: 22, name: 'Ejecutivo Con Pollo Frito', unitPrice: 24000, quantity: 2, note: 'sin sal', attributes: [{ attributeName: 'Bebida', attributeValue: 'Limonada' }] }] });
          if (state === 'awaiting_name') h.conv.customerName = '';
          const before = structuredClone(h.conv.sessionData);
          await h.sendQueued(question);
          expect(h.conv.sessionData).toEqual(before);
          expect(h.conv.state).toBe(state);
          expect(h.replies.join(' ')).toContain('Ejecutivo Con Pollo Frito');
          expect(h.replies.join(' ')).toMatch(/48[.,]000/);
          expect(h.replies.join(' ')).not.toMatch(/no me qued[oó] clara la direcci[oó]n/i);
        });
      }
    }
  }
  for (const enabled of [true, false]) {
    for (const confirmation of ['Si Para Altavista', 'Sí para Altavista']) {
      it(`saved place confirmation ${confirmation}, agent ${enabled}`, async () => {
        const h = harness(products, enabled);
        h.conv.state = 'awaiting_address';
        Object.assign(h.conv.sessionData, { orderType: 'delivery', address: 'Altavista', lastDeliveryAddress: 'Altavista', addressConfirmed: false,
          phoneConfirmed: true, contactPhone: h.conv.phoneE164, deliveryFeeCalculated: 2000,
          cart: [{ productId: 22, code: 22, name: 'Ejecutivo Con Pollo Frito', unitPrice: 24000, quantity: 1, attributes: [] }] });
        h.service.ensureDeliveryFeeQuoted = jest.fn(async (session: WhatsappSessionData) => ({ session: { ...session, addressConfirmed: true, deliveryFeeCalculated: 2000 } }));
        await h.sendQueued(confirmation);
        expect(h.conv.sessionData.address).toBe('Altavista');
        expect(h.cartRows()).toEqual([expect.objectContaining({ id: 22, qty: 1 })]);
      });
    }
  }
});

describe('cart row removal names where, not what', () => {
  const fictional = [
    { id: 30101, code: 30101, name: 'Ramen De Cerdo', price: 28000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 30102, code: 30102, name: 'Gyoza', price: 12000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 30103, code: 30103, name: 'Te Verde', price: 6000, availableNow: true, hasAttributes: false, attributes: [] },
  ];
  const pppCart = [
    { productId: 33, code: 33, name: 'Bandeja Pronto', unitPrice: 16500, quantity: 1, attributes: [{ attributeName: 'Presa', attributeValue: 'Pierna Pernil' }] },
    { productId: 26, code: 26, name: 'Arroz Chino', unitPrice: 34000, quantity: 1, attributes: [] },
    { productId: 36, code: 36, name: 'Arroz Chino Con Medio Pollo', unitPrice: 45000, quantity: 1, attributes: [{ attributeName: 'Pollo', attributeValue: 'Broaster' }], note: 'con medio pollo' },
  ];
  const fictionalCart = fictional.map(p => ({ productId: p.id, code: p.code, name: p.name, unitPrice: p.price, quantity: 1, attributes: [] }));
  for (const enabled of [true, false]) {
    for (const state of ['awaiting_payment', 'building_cart'] as const) {
      for (const [label, menu, cart] of [['PPP', products, pppCart], ['fictional', fictional, fictionalCart]] as const) {
        for (const [phrase, removed] of [
          ['Quita del carrito El item dos', 1], ['saca del pedido el segundo', 1], ['elimina la linea 3', 2], ['quita el producto numero uno', 0], ['quita el 2', 1],
        ] as const) {
          it(`${label} "${phrase}" in ${state}, agent ${enabled}`, async () => {
            const h = harness(menu as any, enabled);
            h.conv.state = state;
            Object.assign(h.conv.sessionData, { orderType: 'delivery', address: 'Altavista', addressConfirmed: true, customerName: 'Cliente Sintético',
              contactPhone: h.conv.phoneE164, phoneConfirmed: true, deliveryFeeCalculated: 2000, cart: structuredClone(cart) });
            await h.sendQueued(phrase);
            expect(h.conv.sessionData.cart.map(line => line.productId)).toEqual(cart.filter((_, i) => i !== removed).map(line => line.productId));
            expect(h.replies.join(' ')).not.toMatch(/vaciamos/i);
          });
        }
        it(`${label} "quita todo del carrito" still clears in ${state}, agent ${enabled}`, async () => {
          const h = harness(menu as any, enabled);
          h.conv.state = state;
          h.conv.sessionData.cart = structuredClone(cart) as any;
          await h.sendQueued('quita todo del carrito');
          expect(h.conv.sessionData.cart).toEqual([]);
        });
      }
    }
  }
});

describe('pilot menu interruptions and fragmented confirmation', () => {
  const menu = [{id:35101,code:35101,name:'Bowl De Lentejas',price:19000,availableNow:true,hasAttributes:false,attributes:[]}];
  for (const enabled of [true,false]) {
    for (const text of ['Hola, ¿tienes la carta por favor?', 'Buenas tardes, ¿me compartes el menú, gracias?', '¿Tienen carta porfa?']) {
      for (const state of ['building_cart','awaiting_name','awaiting_address','awaiting_attribute','awaiting_payment','awaiting_final_confirm']) {
        it(`menu request ${text}, ${state}, agent ${enabled}`,async()=>{
          const h=harness(menu,enabled);
          (h.cfg as any).menuLinkMessage='Menú: https://example.test/menu';
          h.conv.state=state;
          h.conv.sessionData.cart=[{productId:35101,code:35101,name:'Bowl De Lentejas',unitPrice:19000,quantity:1,attributes:[],note:'Sin cebolla'}];
          const before=structuredClone(h.conv.sessionData);
          await h.sendQueued(text);
          expect(h.replies.join(' ')).toContain('https://example.test/menu');
          expect(h.replies.join(' ')).not.toMatch(/no tenemos|no manejamos|productos de carta/i);
          expect(h.conv.sessionData).toEqual(before);
          expect(h.conv.state).toBe(state);
        });
      }
    }
    it(`Si then Señor confirms exactly once, agent ${enabled}`,async()=>{
      const h=harness(menu,enabled);
      h.service.ordersService.create=jest.fn().mockResolvedValue({id:999,orderNumber:'X1'});
      h.conv.state='awaiting_final_confirm';
      Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,address:'Calle 9 20 30',addressConfirmed:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,paymentMethod:'contraentrega',notesCollected:true,deliveryFeeCalculated:2000,
        cart:[{productId:35101,code:35101,name:'Bowl De Lentejas',unitPrice:19000,quantity:1,attributes:[]}]});
      await h.sendQueued('Si');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      expect(h.conv.state).toBe('completed');
      const count=h.replies.length;
      await h.sendQueued('Señor');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      expect(h.replies.slice(count).join(' ')).not.toMatch(/algo m[aá]s|carrito/i);
      expect(h.replies.slice(count).join(' ')).toMatch(/con gusto/i);
      expect(h.conv.state).toBe('completed');
    });
  }
});

describe('payment interruption burst combines inquiry and cart change',()=>{
  for(const f of [{dish:'Crepe De Espinaca',side:'Porcion De Pan'},{dish:'Bowl De Garbanzos',side:'Porcion De Totopos'}])for(const enabled of [true,false])for(const reverse of [true,false])for(const inquiry of ['Antes de pagar cuanto vale todo?','Cuanto cuesta todo;','Cuanto vale todo']){
    it(`${f.dish}, agent ${enabled}, reverse ${reverse}, ${inquiry}`,async()=>{
      jest.useFakeTimers();try{
        const menu=[{id:40201,code:40201,name:f.dish,price:19000,availableNow:true,attributes:[]},{id:40202,code:40202,name:f.side,price:6000,availableNow:true,attributes:[]}];
        const h=harness(menu,enabled);
        Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164});
        await h.sendQueued(`Quiero un ${f.dish} y una ${f.side}`);
        expect(h.cartRows()).toHaveLength(2);
        await h.sendQueued('Para domicilio Calle 12 34 56');expect(h.conv.state).toBe('awaiting_payment');
        const texts=[inquiry,'Quita el item dos'];if(reverse)texts.reverse();
        const jobs=texts.map((text,i)=>h.service.handleIncoming({waId:'customer',phoneE164:h.conv.phoneE164,messageId:`price-remove-${i}`,messageType:'text',text,timestamp:Math.floor(Date.now()/1000),raw:{}}));
        await jest.advanceTimersByTimeAsync(10000);await Promise.all(jobs);
        expect(h.cartRows()).toEqual([expect.objectContaining({id:40201,qty:1})]);
        expect(h.conv.state).toBe('awaiting_payment');expect(h.conv.customerName).toBe('Wilmer');
        expect(h.replies.at(-1)).toMatch(/21[.,]000/);
        expect(h.replies.at(-1)).not.toMatch(/no manejamos|no entend[ií]/i);
      }finally{jest.useRealTimers();}
    });
  }
});


describe('Cart edit and purchase selection withdrawal ownership',()=>{
 const fixtures=[{dish:'Taco De Setas',drink:'Jugo Tropical',flavors:['Mango','Lulo'],variants:['Infusion De Menta','Infusion De Hibisco']},{dish:'Crepe De Espinaca',drink:'Infusion Helada',flavors:['Limon','Hibisco'],variants:['Batido De Fresa','Batido De Banano']}];
 for(const f of fixtures)for(const agent of [true,false])for(const selection of ['attribute','match'] as const){
  function setup(){
   const menu=[{id:60101,code:961,name:f.dish,price:18000,availableNow:true,hasAttributes:false,attributes:[]},{id:60102,code:962,name:f.drink,price:6000,categoryName:'Bebidas',availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:f.flavors}]},...f.variants.map((name,i)=>({id:60103+i,code:963+i,name,price:6500,availableNow:true,hasAttributes:false,attributes:[]}))];
   const h=harness(menu,agent);h.conv.state=selection==='attribute'?'awaiting_attribute':'building_cart';
   Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,address:'Calle 12 34 56',addressConfirmed:true,deliveryFeeCalculated:2000,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,pendingCheckoutResume:'awaiting_payment',cart:['sin cilantro','con cilantro'].map(note=>({productId:60101,code:961,name:f.dish,unitPrice:18000,quantity:1,attributes:[],note}))});
   h.conv.sessionData.pendingCartRemoval={cartSignature:JSON.stringify(h.conv.sessionData.cart),options:h.conv.sessionData.cart.map((line,i)=>({cartIndex:i,label:`${f.dish} · ${line.note}`}))};
   if(selection==='attribute')h.conv.sessionData.pendingAttribute={productId:60102,code:962,name:f.drink,price:6000,quantity:2,attributes:menu[1].attributes,selected:[],sourceText:'dos '+f.drink+' sin hielo'};
   else h.conv.sessionData.pendingMatch={query:'dos bebidas',candidates:menu.slice(2),intent:'order',quantity:2,note:'sin hielo'};
   h.service.ordersService.create=jest.fn().mockResolvedValue({id:6010,dailyOrderNumber:60});
   h.service.ordersService.cancel=jest.fn();
   return {h,key:selection==='attribute'?'pendingAttribute':'pendingMatch',choice:selection==='attribute'?f.flavors[1]:f.variants[1],chosenId:selection==='attribute'?60102:60104};
  }
  if(selection==='attribute')it('opens both selections through router '+f.dish+' agent='+agent,async()=>{
   const {h,choice,chosenId}=setup();h.conv.state='awaiting_payment';
   h.conv.sessionData.pendingCartRemoval=undefined;h.conv.sessionData.pendingAttribute=undefined;h.conv.sessionData.pendingCheckoutResume=undefined;
   const cart=structuredClone(h.conv.sessionData.cart);
   await h.sendQueued('Quita el '+f.dish);
   expect(h.conv.sessionData.pendingCartRemoval).toBeDefined();
   await h.sendQueued('Agrega dos '+f.drink+' sin hielo');
   expect(h.conv.sessionData.pendingCartRemoval).toBeDefined();expect(h.conv.sessionData.pendingAttribute).toMatchObject({productId:60102,quantity:2});
   const before=structuredClone(h.conv.sessionData);
   await h.sendQueued('Olvida ese cambio');expect(h.conv.sessionData).toEqual(before);
   await h.sendQueued('Cancela el cambio del carrito');expect(h.conv.sessionData.cart).toEqual(cart);
   await h.sendQueued(choice);
   expect(h.cartRows().find(row=>row.id===chosenId)).toMatchObject({qty:2,note:expect.stringMatching(/sin hielo/i)});
   await h.sendQueued('Pago contraentrega');await h.sendQueued('Si');
   expect(h.conv.state).toBe('completed');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(4);
  });
  it.each(['Olvida ese cambio','Déjalo como estaba','Cancela ese cambio','Cancela esa selección','¿Puedo cancelar ese cambio?'])('%s '+f.dish+' '+selection+' agent='+agent,async phrase=>{
   const {h,choice,chosenId}=setup();const before=structuredClone(h.conv.sessionData);const state=h.conv.state;
   const response=await h.sendQueued(phrase);
   expect(h.conv.sessionData).toEqual(before);expect(h.conv.state).toBe(state);
   expect(response||'').toMatch(/varias|varios|cu[aá]l/i);expect(response||'').toMatch(/compra|producto|selecci[oó]n/i);
   expect(response||'').toMatch(/carrito/i);
   expect(h.service.ordersService.create).not.toHaveBeenCalled();expect(h.service.ordersService.cancel).not.toHaveBeenCalled();
   await h.sendQueued('Cancela el cambio del carrito');
   expect(h.conv.sessionData.pendingCartRemoval).toBeUndefined();expect(h.conv.sessionData.cart).toEqual(before.cart);
   await h.sendQueued(choice);
   expect(h.cartRows()).toEqual([expect.objectContaining({id:60101,qty:1,note:'sin cilantro'}),expect.objectContaining({id:60101,qty:1,note:'con cilantro'}),expect.objectContaining({id:chosenId,qty:2,note:expect.stringMatching(/sin hielo/i)})]);
   await h.sendQueued('Pago contraentrega');await h.sendQueued('Si');
   expect(h.conv.state).toBe('completed');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(4);
  });
  it.each(['No quites nada','Cancela el cambio del carrito'])('explicit edit withdrawal %s keeps purchase '+f.dish+' '+selection+' agent='+agent,async phrase=>{
   const {h,key,choice,chosenId}=setup();const pending=structuredClone((h.conv.sessionData as any)[key]);const cart=structuredClone(h.conv.sessionData.cart);
   await h.sendQueued(phrase);
   expect(h.conv.sessionData.cart).toEqual(cart);expect(h.conv.sessionData.pendingCartRemoval).toBeUndefined();expect((h.conv.sessionData as any)[key]).toEqual(pending);
   await h.sendQueued(choice);
   expect(h.cartRows()).toEqual([expect.objectContaining({id:60101,qty:1,note:'sin cilantro'}),expect.objectContaining({id:60101,qty:1,note:'con cilantro'}),expect.objectContaining({id:chosenId,qty:2,note:expect.stringMatching(/sin hielo/i)})]);
   await h.sendQueued('Pago contraentrega');await h.sendQueued('Si');
   expect(h.conv.state).toBe('completed');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(4);
  });
  it('explicit purchase withdrawal keeps removal '+f.dish+' '+selection+' agent='+agent,async()=>{
   const {h,key}=setup();const removal=structuredClone(h.conv.sessionData.pendingCartRemoval);const cart=structuredClone(h.conv.sessionData.cart);
   await h.sendQueued('Cancela la compra pendiente');
   expect((h.conv.sessionData as any)[key]).toBeUndefined();expect(h.conv.sessionData.pendingCartRemoval).toEqual(removal);expect(h.conv.sessionData.cart).toEqual(cart);
   expect(h.replies.at(-1)).toMatch(/cu[aá]l l[ií]nea quitamos/i);
   await h.sendQueued('la con cilantro');
   expect(h.cartRows()).toEqual([expect.objectContaining({id:60101,qty:1,note:'sin cilantro'})]);
   await h.sendQueued('Pago contraentrega');await h.sendQueued('Si');
   expect(h.conv.state).toBe('completed');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(1);
  });
 }
});


describe('Enumerated category purchases and plural row choices',()=>{
 const families=[
  {category:'Sopas',names:['Sopa De Ajiaco','Sopa De Menudencias','Sopa De Mondongo'],text:'un ajiaco, menudencia y un mondongo'},
  {category:'Rolls',names:['Roll De Pepino','Roll De Aguacate','Roll De Zanahoria'],text:'un roll de pepino, aguacate y un roll de zanahoria'},
  {category:'Flanes',names:['Flan De Vainilla','Flan De Coco','Flan De Cafe'],text:'un flan de vainilla, coco y un flan de cafe'},
 ];
 for(const f of families)for(const agent of [true,false]){
  const menu=f.names.map((name,i)=>({id:61101+i,code:941+i,name,categoryName:f.category,price:10000+i*1000,availableNow:true,hasAttributes:false,attributes:[]}));
  it('bare middle item '+f.category+' agent='+agent,async()=>{
   const h=harness(menu,agent);h.service.ordersService.create=jest.fn();
   await h.sendQueued(f.text);
   expect(h.cartRows()).toEqual(menu.map(p=>expect.objectContaining({id:p.id,qty:1})));
   expect(h.conv.sessionData.pendingMultiOrder).toBeUndefined();expect(h.conv.sessionData.pendingMatch).toBeUndefined();
   expect(h.replies.join('\n')).not.toMatch(/cu[aá]l te gusta|cu[aá]l prefieres|no manejamos/i);
   expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
  it('one of each complete category '+f.category+' agent='+agent,async()=>{
   const other={id:61109,code:949,name:'Agua Mineral',categoryName:'Bebidas',price:4000,availableNow:true,hasAttributes:false,attributes:[]};
   const h=harness([...menu,other],agent);
   await h.sendQueued('Quiero tres '+f.category.toLowerCase()+', una de cada una');
   expect(h.cartRows()).toEqual(menu.map(p=>expect.objectContaining({id:p.id,qty:1})));
   expect(h.replies.at(-1)).not.toMatch(/cu[aá]les platos.*cu[aá]ntos/i);
  });
  it('both rows from one unresolved group '+f.category+' agent='+agent,async()=>{
   const h=harness(menu,agent);h.service.ordersService.create=jest.fn();
   h.conv.sessionData.cart=[{productId:menu[2].id,code:menu[2].code,name:menu[2].name,unitPrice:menu[2].price,quantity:1,attributes:[],note:'para Ana'}];
   h.conv.sessionData.pendingMultiOrder={confident:[],needsAttributes:[],unresolved:[],ambiguous:[{segment:menu[0].name+', '+menu[1].name,candidates:menu.slice(0,2)}]};
   await h.sendQueued('1 y 2');
   expect(h.cartRows()).toEqual([expect.objectContaining({id:menu[2].id,qty:1,note:'para Ana'}),expect.objectContaining({id:menu[0].id,qty:1}),expect.objectContaining({id:menu[1].id,qty:1})]);
   expect(h.conv.sessionData.pendingMultiOrder).toBeUndefined();expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
 }
});


describe('Subset kitchen note after category clarification',()=>{
 const families=[
  {category:'Sopas',names:['Sopa De Ajiaco','Sopa De Menudencias','Sopa De Mondongo'],extra:'Sopa De Lentejas',enumeration:'un ajiaco, menudencia y un mondongo',note:'sin arroz papa salada'},
  {category:'Rolls',names:['Roll De Pepino','Roll De Aguacate','Roll De Zanahoria'],extra:'Roll De Remolacha',enumeration:'un roll de pepino, aguacate y un roll de zanahoria',note:'sin salsa de soya'},
  {category:'Flanes',names:['Flan De Vainilla','Flan De Coco','Flan De Cafe'],extra:'Flan De Chocolate',enumeration:'un flan de vainilla, coco y un flan de cafe',note:'sin caramelo'},
 ];
 for(const f of families)for(const agent of [true,false])for(const size of [3,4])for(const byName of [true,false])it(f.category+' options='+size+' names='+byName+' agent='+agent,async()=>{
  const menu=[...f.names,f.extra].slice(0,size).map((name,i)=>({id:61201+i,code:931+i,name,categoryName:f.category,price:10000+i*1000,availableNow:true,hasAttributes:false,attributes:[]}));
  const h=harness(menu,agent);h.service.ordersService.create=jest.fn().mockResolvedValue({id:6120,dailyOrderNumber:61});
  Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,address:'Calle 12 34 56',addressConfirmed:true,deliveryFeeCalculated:2000,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
  await h.sendQueued('Buenas tardes me das tres '+f.category.toLowerCase()+' una de cada una por favor dos '+f.note);
  expect((h.conv.sessionData as any).pendingSubsetKitchenNote).toMatchObject({quantity:2,note:f.note});
  expect(h.conv.sessionData.cart).toHaveLength(size===3?3:0);
  await h.sendQueued('Quiero tres '+f.category.toLowerCase()+' una de cada una');
  expect(h.conv.sessionData.cart).toHaveLength(size===3?3:0);
  await h.sendQueued(f.enumeration);
  expect(h.cartRows()).toHaveLength(3);expect(h.cartRows()).toEqual(expect.arrayContaining(menu.slice(0,3).map(p=>expect.objectContaining({id:p.id,qty:1}))));
  expect(h.conv.sessionData.cart.every(line=>!line.note)).toBe(true);
  expect(h.replies.at(-1)).toMatch(/cu[aá]les.*(?:dos|2)/i);
  await h.sendQueued('Nada mas');expect(h.service.ordersService.create).not.toHaveBeenCalled();expect(h.replies.at(-1)).toMatch(/cu[aá]les.*(?:dos|2)/i);
  await h.sendQueued(byName?'Al '+f.names[0]+' y al '+f.names[1]:'1 y 2');
  expect((h.conv.sessionData as any).pendingSubsetKitchenNote).toBeUndefined();
  expect(h.cartRows()).toEqual([expect.objectContaining({id:61201,qty:1,note:f.note}),expect.objectContaining({id:61202,qty:1,note:f.note}),expect.objectContaining({id:61203,qty:1,note:undefined})]);
  await h.sendQueued('Pago contraentrega');await h.sendQueued('Si');
  expect(h.conv.state).toBe('completed');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items=h.service.ordersService.create.mock.calls[0][0].items;expect(items).toHaveLength(3);expect(items.filter((item:any)=>item.note===f.note)).toHaveLength(2);
 });
});


describe('Named shared kitchen note interrupts stale proposal',()=>{
 const families=[{names:['Sopa De Ajiaco','Sopa De Mondongo','Sopa De Menudencias'],note:'sin arroz papa salada a cambio'},{names:['Roll De Pepino','Roll De Zanahoria','Roll De Aguacate'],note:'sin salsa de soya'},{names:['Flan De Vainilla','Flan De Cafe','Flan De Coco'],note:'sin caramelo'}];
 for(const f of families)for(const agent of [true,false])for(const stale of [true,false])for(const contextual of [true,false])it(f.names[0]+' stale='+stale+' contextual='+contextual+' agent='+agent,async()=>{
  const menu=f.names.map((name,i)=>({id:61301+i,code:921+i,name,price:10000+i*1000,availableNow:true,hasAttributes:false,attributes:[]}));
  const h=harness(menu,agent);h.conv.state='awaiting_address';h.conv.sessionData.orderType='delivery';h.conv.sessionData.fulfillmentChosen=true;
  h.conv.sessionData.cart=menu.map((p,i)=>({productId:p.id,code:p.code,name:p.name,unitPrice:p.price,quantity:1,attributes:[],...(i===2?{note:'para Ana'}:{})}));
  if(stale)h.conv.sessionData.pendingMultiOrder={confident:[],needsAttributes:[],ambiguous:[],unresolved:[f.names[1]+' '+f.note]};
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:6130,dailyOrderNumber:62});
  const reply=await h.sendQueued(contextual ? (f.names[0].startsWith('Sopa')?'Quiero la sopa de ajiaco y el mondongo ': 'Quiero el '+f.names[0]+' y el '+f.names[1]+' ')+f.note : 'Por favor pon como nota para '+f.names[0]+' y '+f.names[1]+' que vayan '+f.note);
  expect(h.cartRows()).toEqual([expect.objectContaining({id:61301,qty:1,note:f.note}),expect.objectContaining({id:61302,qty:1,note:f.note}),expect.objectContaining({id:61303,qty:1,note:'para Ana'})]);
  expect(h.conv.state).toBe('awaiting_address');expect(h.conv.sessionData.pendingMultiOrder).toBeUndefined();expect(reply||'').not.toMatch(/no manejamos|no tenemos/i);
  await h.sendQueued('Dejame ver que tengo en el carrito');expect(h.replies.at(-1)).toContain(f.names[1]);expect(h.replies.at(-1)).not.toMatch(/no tenemos/i);
  await h.sendQueued('Es para la calle 12 34 56');await h.sendQueued('Pago contraentrega');await h.sendQueued('Si');
  expect(h.conv.state).toBe('completed');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(3);
 });
});


describe('Kitchen note identity and withdrawal ownership',()=>{
 for(const agent of [true,false]){
  it('numeric product label is not a separate quantity agent='+agent,async()=>{
   const product={id:61601,code:891,name:'1 Pack De Gyozas',price:18000,availableNow:true,hasAttributes:false,attributes:[]};
   const h=harness([product],agent);h.conv.sessionData.cart=[{productId:product.id,code:product.code,name:product.name,unitPrice:product.price,quantity:1,attributes:[]}];
   h.conv.sessionData.pendingMultiOrder={confident:[],needsAttributes:[],ambiguous:[],unresolved:['1 Pack De Gyozas sin salsa']};
   await h.sendQueued('Pon como nota para 1 Pack De Gyozas que vaya sin salsa');
   expect(h.conv.sessionData.pendingMultiOrder).toBeUndefined();expect(h.cartRows()).toEqual([expect.objectContaining({id:61601,qty:1,note:'sin salsa'})]);
  });
  it.each(['Olvida ese cambio','¿Puedo cancelar ese cambio?'])('%s note and removal agent='+agent,async text=>{
   const product={id:61602,code:892,name:'Taco De Calabaza',price:17000,availableNow:true,hasAttributes:false,attributes:[]};
   const h=harness([product],agent);h.conv.state='awaiting_payment';
   h.conv.sessionData.cart=['sin cilantro','con cilantro'].map(note=>({productId:product.id,code:product.code,name:product.name,unitPrice:product.price,quantity:1,attributes:[],note}));
   h.conv.sessionData.pendingCartRemoval={cartSignature:JSON.stringify(h.conv.sessionData.cart),options:h.conv.sessionData.cart.map((line,i)=>({cartIndex:i,label:product.name+' '+line.note}))};
   h.conv.sessionData.pendingSubsetKitchenNote={quantity:1,note:'sin sal',productIds:[product.id]};
   const before=structuredClone(h.conv.sessionData);const response=await h.sendQueued(text);
   expect(h.conv.sessionData).toEqual(before);expect(response||'').toMatch(/carrito/i);expect(response||'').toMatch(/nota|preparaci[oó]n/i);
   await h.sendQueued('No apliques esa nota');expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeUndefined();expect(h.conv.sessionData.pendingCartRemoval).toEqual(before.pendingCartRemoval);
   await h.sendQueued('la con cilantro');expect(h.cartRows()).toEqual([expect.objectContaining({id:61602,qty:1,note:'sin cilantro'})]);
  });
 }
});

describe('Partial unit option changes preserve the other units',()=>{
 const families=[
  {name:'Hamburguesa Clasica',attr:'Bebida',before:'Coca Cola',after:'Colmbiana',spoken:'Colombiana',scope:'gaseosas',base:products.find((p:any)=>p.id===76)},
  {name:'Bao De Hongos',attr:'Salsa',before:'Teriyaki',after:'Ponzu',spoken:'Ponzu',scope:'salsas'},
  {name:'Pizza Del Huerto',attr:'Masa',before:'Fina',after:'Gruesa',spoken:'Gruesa',scope:'masas'},
 ];
 for(const f of families)for(const state of ['building_cart','awaiting_payment','awaiting_final_confirm'])for(const agent of [false,true])for(const wording of [0,1]){
  it(f.name+' '+state+' wording='+wording+' agent='+agent,async()=>{
   const product=f.base||{id:62901,code:62901,name:f.name,price:18000,availableNow:true,hasAttributes:true,attributes:[{attributeName:f.attr,options:[f.before,f.after]}]};
   const h=harness([product],agent);h.conv.state=state;h.service.ordersService.create=jest.fn().mockResolvedValue({id:6290,dailyOrderNumber:69});
   Object.assign(h.conv.sessionData,{cart:[{productId:product.id,code:product.code,name:product.name,unitPrice:product.price,quantity:4,attributes:[{attributeName:f.attr,attributeValue:f.before}],note:'sin cebolla'}],orderType:'delivery',fulfillmentChosen:true,address:'Calle 12 34 56',addressConfirmed:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,deliveryFeeCalculated:2000,...(state==='awaiting_final_confirm'?{paymentMethod:'contraentrega'}:{})});
   const text=wording?`Cambia la ${f.attr} de dos ${f.name} a ${f.spoken} por favor`:`Cámbiame dos de las ${f.scope} por ${f.spoken}`;
   const reply=await h.sendQueued(text);
   expect(h.cartRows()).toEqual([{id:product.id,qty:2,note:'sin cebolla',attrs:[`${f.attr}:${f.before}`]},{id:product.id,qty:2,note:'sin cebolla',attrs:[`${f.attr}:${f.after}`]}]);
   expect(reply).toContain(f.before);expect(reply).toContain(f.after);expect(reply).toMatch(/×2/);expect(h.service.ordersService.create).not.toHaveBeenCalled();expect(h.conv.state).toBe(state==='building_cart'?'awaiting_payment':state);
   if(state!=='building_cart')expect(reply).not.toMatch(/algo más/i);
   const after=structuredClone(h.conv.sessionData.cart);await h.sendQueued(text);expect(h.conv.sessionData.cart).toEqual(after);expect(h.service.ordersService.create).not.toHaveBeenCalled();
   if(h.conv.state==='building_cart')await h.sendQueued('Nada más');
   if(h.conv.state==='awaiting_payment')await h.sendQueued('1');
   await h.sendQueued('Confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
   const items=h.service.ordersService.create.mock.calls[0][0].items;expect(items).toHaveLength(4);
   for(const value of [f.before,f.after])expect(items.filter((item:any)=>item.attributes.some((a:any)=>a.attributeName===f.attr&&a.attributeValue===value))).toHaveLength(2);
  });
 }
 for(const agent of [false,true])for(const scenario of ['too_many','zero','unknown','two_targets','pending','already_split']){
  it('partial option refuses unsafe scope '+scenario+' agent='+agent,async()=>{
   const p={id:62911,code:62911,name:'Bao De Hongos',price:18000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Salsa',options:['Teriyaki','Ponzu']}]};
   const h=harness([p],agent);h.conv.state='awaiting_payment';
   const line={productId:p.id,code:p.code,name:p.name,unitPrice:p.price,quantity:4,attributes:[{attributeName:'Salsa',attributeValue:'Teriyaki'}],note:'bien empacado'};
   Object.assign(h.conv.sessionData,{cart:[line],orderType:'delivery',fulfillmentChosen:true,address:'Calle 12 34 56',addressConfirmed:true,notesCollected:true});
   if(scenario==='two_targets')h.conv.sessionData.cart.push({...line,note:'sin cebolla'});
   if(scenario==='already_split')h.conv.sessionData.cart=[{...line,quantity:2},{...line,quantity:2,attributes:[{attributeName:'Salsa',attributeValue:'Ponzu'}]}];
   if(scenario==='pending')h.conv.sessionData.pendingAttribute={productId:p.id,name:p.name,code:p.code,price:p.price,attributes:p.attributes,selected:[]};
   const before=structuredClone(h.conv.sessionData);const text=`Cambia ${scenario==='too_many'?'cinco':scenario==='zero'?'0':'dos'} de las salsas por ${scenario==='unknown'?'Mostaza':'Ponzu'}`;
   const reply=await h.sendQueued(text);
   expect(h.conv.state).toBe('awaiting_payment');expect(reply).toMatch(/cu[aá]l|cu[aá]ntas|aclar/i);
   if(['two_targets','already_split'].includes(scenario)) {
    const {pendingCartAttributeEdit,...unchanged}=h.conv.sessionData;
    expect(unchanged).toEqual(before);expect(pendingCartAttributeEdit?.unitChanges).toHaveLength(2);
    await h.sendQueued('1');
    expect(h.conv.sessionData.pendingCartAttributeEdit).toBeUndefined();
    expect(h.conv.sessionData.cart.reduce((n,item)=>n+item.quantity,0)).toBe(before.cart.reduce((n,item)=>n+item.quantity,0));
    expect(h.conv.sessionData.cart.filter(item=>item.attributes?.some(a=>a.attributeValue==='Ponzu')).reduce((n,item)=>n+item.quantity,0)).toBe(scenario==='already_split'?4:2);
    if(scenario==='two_targets')expect(h.conv.sessionData.cart).toContainEqual(before.cart[1]);
    expect(h.conv.state).toBe('awaiting_payment');
   } else expect(h.conv.sessionData).toEqual(before);
  });
 }
});

describe('Repeated partial edit needs an explicit source after the cart splits',()=>{
 for(const f of [{name:'Jugo Del Huerto',attr:'Sabor',before:'Mango',after:'Lulo'},{name:'Caja De Bao',attr:'Salsa',before:'Suave',after:'Picante'}])for(const state of ['building_cart','awaiting_payment','awaiting_final_confirm'])it(f.name+' '+state,async()=>{
  const product={id:64711,code:64711,name:f.name,price:27000,availableNow:true,hasAttributes:true,attributes:[{attributeName:f.attr,options:[f.before,f.after]}]};
  const h=harness([product],true);h.conv.state=state;
  Object.assign(h.conv.sessionData,{cart:[{productId:product.id,code:product.code,name:product.name,unitPrice:product.price,quantity:4,note:'bien empacado',attributes:[{attributeName:f.attr,attributeValue:f.before}]}],orderType:'delivery',fulfillmentChosen:true,address:'Calle 12 34 56',addressConfirmed:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,deliveryFeeCalculated:2000,...(state==='awaiting_final_confirm'?{paymentMethod:'contraentrega'}:{})});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:6471,dailyOrderNumber:78});let affectedQuantity=2;
  h.agent.runTurn.mockImplementation(async input=>{
   const service=new WhatsappAgentService({} as never,h.service.catalogService) as any;const actions:any={};
   const ctx={actions,cart:input.cart,products:[product],byId:new Map([[product.id,product]]),userMessage:input.userMessage,setNeedsAttr:()=>{}};
   service.executeTool('set_unit_attributes',{productId:product.id,cartLineIndex:0,affectedQuantity,attributes:[{attributeName:f.attr,attributeValue:f.after}]},ctx);
   return {reply:'CAMBIÉ TODO',actions,toolCalls:['get_cart','set_unit_attributes']};
  });
  const text=`En dos unidades prefiero ${f.after}; las demás conservan sus opciones`;
  await h.sendQueued(text);expect(h.agent.runTurn).toHaveBeenCalledTimes(1);
  const split=structuredClone(h.conv.sessionData.cart);expect(split.map(item=>item.quantity)).toEqual([2,2]);
  const repeated=await h.sendQueued(text);
  expect(h.conv.sessionData.cart).toEqual(split);expect(repeated).toMatch(/no pude aplicar.*seguridad/i);expect(repeated).not.toContain('CAMBIÉ TODO');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  affectedQuantity=1;const explicit=await h.sendQueued(`De la línea 1, en una unidad prefiero ${f.after}; las demás igual`);
  expect(h.conv.sessionData.cart.map(item=>[item.quantity,item.attributes?.[0].attributeValue])).toEqual([[1,f.before],[3,f.after]]);
  expect(explicit).toContain(f.before);expect(explicit).toContain(f.after);
  if(h.conv.state==='awaiting_payment')await h.sendQueued('1');
  await h.sendQueued('Confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items=h.service.ordersService.create.mock.calls[0][0].items;expect(items).toHaveLength(4);
  expect(items.filter((item:any)=>item.attributes.some((a:any)=>a.attributeValue===f.after))).toHaveLength(3);
 });
});

describe('Same units receive both options and kitchen note across menus',()=>{
 for(const f of [{name:'Caja De Falafel',attr:'Salsa',before:'Suave',after:'Picante'},{name:'Bento De Tofu',attr:'Arroz',before:'Blanco',after:'Integral'},{name:'Kit De Arepas',attr:'Bebida',before:'Te Frio',after:'Limonada'}])for(const state of ['building_cart','awaiting_payment','awaiting_final_confirm'])for(const onlyNote of [false,true])it(`${f.name} ${state} noteOnly=${onlyNote}`,async()=>{
  const product={id:64801,code:64801,name:f.name,price:27000,availableNow:true,hasAttributes:true,attributes:[{attributeName:f.attr,options:[f.before,f.after]}]};
  const h=harness([product],true);h.conv.state=state;
  Object.assign(h.conv.sessionData,{cart:[{productId:product.id,code:product.code,name:product.name,unitPrice:product.price,quantity:4,note:'bien empacado',attributes:[{attributeName:f.attr,attributeValue:f.before}]}],orderType:'delivery',fulfillmentChosen:true,address:'Calle 12 34 56',addressConfirmed:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,deliveryFeeCalculated:2000,...(state==='awaiting_final_confirm'?{paymentMethod:'contraentrega'}:{})});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:6480,dailyOrderNumber:79});
  h.agent.runTurn.mockImplementationOnce(async input=>{
   const service=new WhatsappAgentService({} as never,h.service.catalogService) as any;const actions:any={};
   const ctx={actions,cart:input.cart,products:[product],byId:new Map([[product.id,product]]),userMessage:input.userMessage,setNeedsAttr:()=>{}};
   const result=JSON.parse(service.executeTool('set_unit_attributes',{productId:product.id,cartLineIndex:0,affectedQuantity:2,attributes:[{attributeName:f.attr,attributeValue:onlyNote?f.before:f.after}],note:'sin sal'},ctx));expect(result.ok).toBe(true);
   return {reply:'Listo todas sin sal',actions,toolCalls:['get_cart','set_unit_attributes']};
  });
  const reply=await h.sendQueued(`De las cuatro ${f.name}, dos con ${onlyNote?f.before:f.after} y sin sal; el resto igual`);
  expect(h.agent.runTurn).toHaveBeenCalledTimes(1);expect(reply).toContain('sin sal');expect(reply).not.toContain('todas sin sal');
  const cart=h.conv.sessionData.cart;expect(cart.map(item=>[item.quantity,item.note,item.attributes?.[0].attributeValue])).toEqual([[2,'bien empacado',f.before],[2,'bien empacado, sin sal',onlyNote?f.before:f.after]]);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(h.conv.state==='building_cart')await h.sendQueued('Nada más');
  if(h.conv.state==='awaiting_payment')await h.sendQueued('1');
  await h.sendQueued('Confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items=h.service.ordersService.create.mock.calls[0][0].items;expect(items).toHaveLength(4);
  expect(items.filter((item:any)=>item.note==='bien empacado, sin sal')).toHaveLength(2);
  expect(items.filter((item:any)=>item.note==='bien empacado')).toHaveLength(2);
 });
});

describe('Extra replacement preserves combo through checkout and rejects unknown alternatives',()=>{
 for(const f of [{meal:'Combo De Sushi',old:'Porcion De Gyozas',next:'Porcion De Edamame'},{meal:'Combo Vegetal',old:'Porcion De Falafel',next:'Porcion De Hummus'}])for(const enabled of [false,true])for(const final of [false,true])for(const wording of ['cambia','no quiero']){
  it(`${f.meal} final=${final} agent=${enabled} wording=${wording}`,async()=>{
   const menu=[{id:79981,code:79981,name:f.meal,price:30000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Manzana','Colombiana']}]},...([f.old,f.next].map((name,i)=>({id:79982+i,code:79982+i,name,price:i?9000:8000,availableNow:true,attributes:[]})))];
   const h=harness(menu,enabled);Object.assign(h.conv.sessionData,{fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
   h.service.ordersService.create=jest.fn().mockResolvedValue({id:7998,dailyOrderNumber:85});
   await h.sendQueued(`Un ${f.meal} con manzana y dos ${f.old}`);
   expect(h.cartRows().map(r=>[r.id,r.qty])).toEqual(expect.arrayContaining([[79981,1],[79982,2]]));
   h.conv.sessionData.cart.find(r=>r.productId===79981)!.note='Salsa aparte';
   await h.sendQueued('no más, recojo en el local');if(final)await h.sendQueued('contraentrega');
   const state=h.conv.state;expect(state).toBe(final?'awaiting_final_confirm':'awaiting_payment');
   const before=structuredClone(h.conv.sessionData.cart);
   const rejected=await h.sendQueued(`Cambia la ${f.old} por Porcion De Trufas`);
   expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.state).toBe(state);
   expect(rejected).toMatch(/no encontr|no tenemos|no manejamos/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
   const reply=await h.sendQueued(wording==='cambia'?`Cambia la ${f.old} por ${f.next}`:`No quiero ${f.old}, quiero ${f.next}`);
   expect(reply).not.toMatch(/algo m[aá]s|no encontr|no tenemos|no manejamos/i);
   expect(h.conv.state).toBe(state);expect(h.conv.sessionData.cart.find(r=>r.productId===79981)).toEqual(before.find(r=>r.productId===79981));
   expect(h.cartRows().some(r=>r.id===79982)).toBe(false);
   expect(h.cartRows().filter(r=>r.id===79983).reduce((n,r)=>n+r.qty,0)).toBe(2);expect(h.cartRows()).toHaveLength(2);
   const updated=structuredClone(h.conv.sessionData.cart);const total=await h.sendQueued('cuánto es el total');expect(total).toMatch(/48[.,]000/);expect(h.conv.sessionData.cart).toEqual(updated);expect(h.service.ordersService.create).not.toHaveBeenCalled();
   if(!final)await h.sendQueued('contraentrega');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
   const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toHaveLength(3);expect(dto.items.filter((r:any)=>r.productId===79983)).toHaveLength(2);
   expect(dto.items.find((r:any)=>r.productId===79981)).toEqual({productId:79981,attributes:[{attributeName:'Bebida',attributeValue:'Manzana'}],note:'Salsa aparte'});expect(dto.orderType).toBe('pickup');expect(dto.phone).toMatch(/3000000001/);
  });
 }
});

describe('Delivery data together or sequentially reaches checkout and accepts a new street',()=>{
 for(const name of ['Ravioles De Ricota','Bowl De Garbanzos'])for(const enabled of [false,true])for(const together of [false,true])it(`${name} together=${together} agent=${enabled}`,async()=>{
  const product={id:79991,code:79991,name,price:21000,availableNow:true,attributes:[]};const h=harness([product],enabled);
  h.cfg.paymentMethods=DEFAULT_PAYMENT_METHODS.map(method=>({...method,enabled:method.flow!=='mercadopago'}));
  Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,notesCollected:true,lastDeliveryAddress:'Calle 2 #3-40'});
  h.service.deliveryRouting={quoteDeliveryFee:jest.fn().mockResolvedValue({ok:true,fee:2000,distanceKm:1,source:'google_directions',customer:{lat:4.62,lng:-74.15}})};
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:7999,dailyOrderNumber:86});
  const destination='Calle 10 #81A-20 conjunto Los Cedros torre B apartamento 304B';
  const contact='a nombre Cristina, celular 3000000004';
  if(together)await h.sendQueued(`Quiero dos ${name}\nDirección: ${destination}\n${contact}`);
  else {await h.sendQueued(`Quiero dos ${name}`);await h.sendQueued(`Dirección: ${destination}`);await h.sendQueued(contact);}
  expect(h.cartRows()).toEqual([expect.objectContaining({id:79991,qty:2})]);
  expect(h.conv.customerName).toBe('Cristina');expect(h.conv.sessionData.contactPhone).toMatch(/3000000004/);
  expect(h.conv.sessionData.address).toMatch(/81A-20.*Los Cedros.*torre B.*304B/i);expect(h.conv.sessionData.address).not.toContain('3-40');
  expect(h.conv.state).toBe('awaiting_payment');
  const cart=structuredClone(h.conv.sessionData.cart);const shown=await h.sendQueued('déjame ver el carrito');expect(shown).toContain(name);expect(h.conv.sessionData.cart).toEqual(cart);
  await h.sendQueued('contraentrega');expect(h.conv.state).toBe('awaiting_final_confirm');
  const change=await h.sendQueued('Cambiar dirección a Carrera 22 #45-60 conjunto Los Robles torre C apartamento 205');
  expect(h.conv.sessionData.address).toMatch(/22.*45-60.*Los Robles.*torre C.*205/i);expect(h.conv.sessionData.address).not.toMatch(/Cedros|304B/);
  expect(change).not.toMatch(/algo m[aá]s/i);expect(h.conv.sessionData.cart).toEqual(cart);expect(h.conv.sessionData.paymentMethod).toBe('cash');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toHaveLength(2);expect(dto.items.every((r:any)=>r.productId===79991)).toBe(true);expect(dto.address).toMatch(/45-60.*Los Robles.*205/i);expect(dto.deliveryFee).toBe(2000);expect(dto.customerName).toBe('Cristina');expect(dto.phone).toMatch(/3000000004/);
 });
});

describe('Alphanumeric building details have a bounded grammar',()=>{
 it.each(['Torre B','Bloque A2','Torre 12B','Torre C apartamento 205','Bloque A2 apto 304B','Torre 12B interior 7','Torre 3 apto 101'])('accepts %s as a unit fragment',text=>{
  expect(harness([],false).service.looksLikeUnitOrTowerDetailOnly(text)).toBe(true);
 });
 it.each(['Torre B calle 10 #81A-20','Torre B y quiero dos sopas','Conjunto Los Cedros torre B','Quiero un bowl para torre B','Bloque central','Cambiar dirección a Carrera 22 #45-60'])('does not swallow unrelated text: %s',text=>{
  expect(harness([],false).service.looksLikeUnitOrTowerDetailOnly(text)).toBe(false);
 });
});
