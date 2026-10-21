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


describe('Decremento completo — números dentro del nombre son parte del producto',()=>{
 it.each(['1 Pollo Frito','Dos Empanadas'].flatMap(name=>[false,true].map(agent=>({name,agent}))))('$name agent=$agent',async({name,agent})=>{
  const dish={id:23301,code:4001,name,price:15000,availableNow:true,hasAttributes:false,attributes:[]};
  const water={id:23302,code:4002,name:'Agua Mineral',price:3000,availableNow:true,hasAttributes:false,attributes:[]};
  const h=harness([dish,water] as typeof products,agent);h.service.ordersService.create=jest.fn();
  h.conv.sessionData.cart=[{productId:dish.id,name,code:dish.code,unitPrice:dish.price,quantity:4,attributes:[]},{productId:water.id,name:water.name,code:water.code,unitPrice:water.price,quantity:2,attributes:[]}];
  await h.sendQueued(`4 menos de ${name}`);expect(h.cartRows()).toEqual([expect.objectContaining({id:water.id,qty:2})]);expect(h.service.ordersService.create).not.toHaveBeenCalled();
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

describe('Consulta de checkout — no publicar respuestas sin evidencia o con cambios',()=>{
 const menu=[{id:8941,code:8941,name:'Caja De Dumplings',description:'Dumplings con ensalada',price:22000,availableNow:true,hasAttributes:false,attributes:[]}];
 it.each([
  {toolCalls:[],actions:{}},
  {toolCalls:['add_item'],actions:{}},
  {toolCalls:['search_menu'],actions:{addItems:[{productId:8941,quantity:1}]}},
  {toolCalls:['search_menu'],actions:{},error:'openai_timeout'},
 ])('no acredita una respuesta con %j',async result=>{
  const h=harness(menu,true);h.conv.state='awaiting_payment';h.conv.customerName='Ana';
  h.conv.sessionData={cart:[{productId:8941,name:menu[0].name,code:8941,unitPrice:22000,quantity:1,attributes:[]}],orderType:'delivery',address:'Calle 18 sur 70 25',addressConfirmed:true,phoneConfirmed:true};
  const before=structuredClone(h.conv.sessionData.cart);
  h.agent.runTurn.mockResolvedValue({reply:'RESPUESTA NO ACREDITADA',...result});
  const reply=await h.send('Antes de pagar, ese plato trae acompañamiento o se cobra aparte?');
  expect(reply).not.toContain('RESPUESTA NO ACREDITADA');expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.state).toBe('awaiting_payment');
 });
});

describe('Quitar con muletilla, verbo con tilde o cantidad final nunca agrega', () => {
 const pizzas=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-pizza-menu-1510.json'),'utf8'));
 const menus: Array<[string, any[], string, number]> = [
  ['pizzería', pizzas, 'empanada de carne', 9303],
  ['PPP', products, 'arroz con pollo', 23],
 ];
 const phrasings = (dish: string) => [
  [`mejor quita una ${dish}`, 2], [`quítame una ${dish}`, 2], [`sácame una ${dish}`, 2], [`bueno, quita una ${dish}`, 2],
  [`mejor quita una ${dish}, que sean 2`, 2], [`quita una ${dish} que sean dos`, 2], [`mejor que sean 2 ${dish}`, 2],
 ] as Array<[string, number]>;
 for (const [label, menu, dish, id] of menus) {
  for (const agent of [false, true]) {
   it.each(phrasings(dish))(`${label} agente ${agent ? 'on' : 'off'}: %s`, async (text, qty) => {
    const h = harness(menu, agent);
    await h.sendQueued(`quiero 3 ${dish}`);
    expect(h.cartRows()).toEqual([expect.objectContaining({id, qty:3})]);
    await h.sendQueued(text);
    expect(h.cartRows()).toEqual([expect.objectContaining({id, qty})]);
   });
  }
  it(`${label}: cantidad final que no cuadra pregunta y no cambia`, async () => {
   const h = harness(menu, false);
   await h.sendQueued(`quiero 3 ${dish}`);
   const reply = await h.sendQueued(`quita una ${dish}, que sean 3`);
   expect(h.cartRows()).toEqual([expect.objectContaining({id, qty:3})]);
   expect(reply).toMatch(/Cuántas dejamos/);
  });
 }
});

describe('Cambios condicionados por costo — no asumir autorización incondicional', () => {
  const fixtures = [
    { id: 19201, name: 'Bowl De Frijoles', attr: 'Base', first: 'Arroz', next: 'Quinoa' },
    { id: 19202, name: 'Raviolis Del Huerto', attr: 'Salsa', first: 'Tomate', next: 'Pesto' },
  ];
  for (const f of fixtures) {
    const menu = [{ id: f.id, code: f.id, name: f.name, price: 24000, availableNow: true,
      hasAttributes: true, attributes: [{ attributeName: f.attr, options: [f.first, f.next] }] }];
    const seed = (agent: boolean, state: string) => {
      const h = harness(menu, agent);
      h.service.ordersService.create = jest.fn();
      h.conv.state = state;
      Object.assign(h.conv.sessionData, {
        orderType: 'delivery', address: 'Calle 12 30 45', addressConfirmed: true,
        phoneConfirmed: true, contactPhone: h.conv.phoneE164, deliveryFeeCalculated: 2000,
        cart: [{ productId: f.id, code: f.id, name: f.name, quantity: 2, unitPrice: 24000,
          note: 'sin cebolla', attributes: [{ attributeName: f.attr, attributeValue: f.first }] }],
      });
      return h;
    };
    for (const agent of [false, true]) for (const state of ['building_cart', 'awaiting_payment']) {
      for (const text of [
        `Si no cuesta más, cambia ${f.attr} a ${f.next}`,
        `Cambia ${f.attr} a ${f.next} solo si no tiene recargo`,
        `Si cobran menos de 3000 por el cambio, pon ${f.next}`,
        `Si no cobran extra, lo quiero con ${f.next}`,
        `Si es gratis, cambia ${f.attr} a ${f.next}`,
        `Pon ${f.next} solo si queda al mismo precio`,
        `Si el cambio no tiene recargo, cambia ${f.attr} a ${f.next}`,
      ]) {
        it(`${f.name}, ${state}, agente ${agent}: ${text}`, async () => {
          const h = seed(agent, state);
          const before = structuredClone(h.conv.sessionData);
          const reply = await h.sendQueued(text);
          expect(h.conv.sessionData).toEqual(before);
          expect(h.conv.state).toBe(state);
          expect(reply).toMatch(/no tengo.*(?:costo|recargo).*confirmado/i);
          expect(reply).toMatch(/pedido sigue igual/i);
          expect(reply).not.toMatch(/Listo|agregué|queda con/i);
          if (state === 'awaiting_payment') expect(reply).toMatch(/pagas|método de pago/i);
          expect(h.service.ordersService.create).not.toHaveBeenCalled();
        });
      }
    }
    it.each([false, true])(`${f.name}: puede autorizar el cambio después de consultar (agente %s)`, async agent => {
      const h = seed(agent, 'building_cart');
      await h.sendQueued(`Si no cuesta más, cambia ${f.attr} a ${f.next}`);
      await h.sendQueued(`Mejor con ${f.next}`);
      expect(h.cartRows()).toEqual([expect.objectContaining({ id: f.id, qty: 2,
        note: expect.stringMatching(/sin cebolla/i), attrs: [`${f.attr}:${f.next}`] })]);
      expect(h.replies.at(-1)).toMatch(new RegExp(f.next, 'i'));
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
  }
});


describe('product names that contain "y" stay one product', () => {
  const fictional = [
    { id: 31201, code: 31201, name: 'Pan Y Queso 200g', price: 4500, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 31202, code: 31202, name: 'Arepa', price: 3000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 31203, code: 31203, name: 'Jugo Natural', price: 5000, availableNow: true, hasAttributes: true,
      attributes: [{ attributeName: 'Sabor', options: ['Mora', 'Lulo'] }] },
  ];
  const cokeCart = () => [{ productId: 44, code: 44, name: 'Gaseosa 250ml', unitPrice: 2500, quantity: 2,
    attributes: [{ attributeName: 'Sabor', attributeValue: 'Coca Cola' }] }];
  for (const enabled of [true, false]) {
    it(`PPP "dos cola y pola" is one drink, agent ${enabled}`, async () => {
      const h = harness(products, enabled);
      await h.sendQueued('Dame dos cola y pola');
      expect(h.cartRows()).toEqual([expect.objectContaining({ id: 30, qty: 2, attrs: [] })]);
    });
    for (const text of ['No coca cola no cola y pola', 'no era coca cola sino cola y pola']) {
      it(`PPP "${text}" swaps the drink and keeps the quantity, agent ${enabled}`, async () => {
        const h = harness(products, enabled);
        h.conv.sessionData.cart = cokeCart() as any;
        await h.sendQueued(text);
        expect(h.cartRows()).toEqual([expect.objectContaining({ id: 30, qty: 2, attrs: [] })]);
      });
    }
    it(`PPP correction already applied only acknowledges, agent ${enabled}`, async () => {
      const h = harness(products, enabled);
      h.conv.sessionData.cart = [{ productId: 30, code: 30, name: 'Cola Y Pola 330Cm', unitPrice: 4000, quantity: 2, attributes: [] }] as any;
      await h.sendQueued('No coca cola no cola y pola');
      expect(h.cartRows()).toEqual([expect.objectContaining({ id: 30, qty: 2 })]);
      expect(h.replies.join(' ')).toMatch(/queda \*Cola Y Pola 330Cm\*/);
    });
    it(`fictional "dos pan y queso" and its correction, agent ${enabled}`, async () => {
      const h = harness(fictional as any, enabled);
      await h.sendQueued('Dame dos pan y queso');
      expect(h.cartRows()).toEqual([expect.objectContaining({ id: 31201, qty: 2, attrs: [] })]);
      const g = harness(fictional as any, enabled);
      g.conv.sessionData.cart = [{ productId: 31203, code: 31203, name: 'Jugo Natural', unitPrice: 5000, quantity: 2,
        attributes: [{ attributeName: 'Sabor', attributeValue: 'Mora' }] }] as any;
      await g.sendQueued('No jugo de mora no pan y queso');
      expect(g.cartRows()).toEqual([expect.objectContaining({ id: 31201, qty: 2, attrs: [] })]);
    });
    it(`fictional coordinated products are still two lines, agent ${enabled}`, async () => {
      const h = harness(fictional as any, enabled);
      await h.sendQueued('una arepa y un jugo natural de lulo');
      expect(h.cartRows()).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 31202, qty: 1 }),
        expect.objectContaining({ id: 31203, qty: 1, attrs: ['Sabor:Lulo'] }),
      ]));
    });
  }
});

describe('reusing the saved address after "¿misma dirección o nueva?"', () => {
  const fictional = [
    { id: 31801, code: 31801, name: 'Lasagna De Carne', price: 23000, availableNow: true, hasAttributes: false, attributes: [] },
  ];
  const asked = (menu: any[], id: number, enabled: boolean) => {
    const h = harness(menu as any, enabled);
    const product = menu.find((p: any) => p.id === id);
    h.conv.sessionData.cart = [{ productId: id, code: id, name: product.name, unitPrice: product.price, quantity: 1, attributes: [] }] as any;
    Object.assign(h.conv.sessionData, { orderType: 'delivery', fulfillmentChosen: true, lastDeliveryAddress: 'Altavista' });
    h.conv.customerName = 'Wil';
    h.conv.state = 'awaiting_address';
    return h;
  };
  for (const enabled of [false, true]) {
    for (const [label, menu, id] of [['PPP', products, 94], ['fictional', fictional, 31801]] as const) {
      for (const text of ['Si a la misma direction', 'la misma direcion', 'sí, a esa misma', 'misma', 'en la misma']) {
        it(`${label} "${text}" keeps the saved address, agent ${enabled}`, async () => {
          const h = asked(menu as any, id, enabled);
          await h.sendQueued(text);
          expect(h.conv.sessionData.address).toBe('Altavista');
          expect(h.conv.sessionData.addressConfirmed).toBe(true);
          expect(h.conv.state).not.toBe('awaiting_address');
        });
      }
      it(`${label} "a una nueva" asks for the new address, agent ${enabled}`, async () => {
        const h = asked(menu as any, id, enabled);
        await h.sendQueued('a una nueva');
        expect(h.conv.sessionData.addressConfirmed).not.toBe(true);
      });
    }
  }
});

describe('real staging chats: two dishes, handling notes, address lead-ins, lunch', () => {
  const fictional = [
    { id: 32001, code: 32001, name: 'Plato Con Res Asada', price: 21000, availableNow: true, hasAttributes: true,
      attributes: [{ attributeName: 'Corte', options: ['Costilla', 'Lomo'] }] },
    { id: 32002, code: 32002, name: 'Menu Del Dia Con Res', price: 19000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 32003, code: 32003, name: 'Trucha', price: 28000, availableNow: true, hasAttributes: true,
      attributes: [{ attributeName: 'Preparacion', options: ['Frita', 'Al Ajillo'] }] },
    { id: 32004, code: 32004, name: 'Jugo De Maracuya', price: 6000, availableNow: true, hasAttributes: false, attributes: [] },
  ];
  const menus = [
    { label: 'PPP', menu: products, first: 'Bandeja con pollo frito pierna pernil', firstId: 15, second: 'un ejecutivo con pollo frito', secondId: 22,
      fish: 'una mojarra frita', fishId: 14, handled: 'bagre frito', handledId: 19, lunchIds: [18, 22], drink: 'una limonada', drinkId: 37 },
    { label: 'fictional', menu: fictional, first: 'Plato con res asada costilla', firstId: 32001, second: 'un menu del dia con res', secondId: 32002,
      fish: 'una trucha frita', fishId: 32003, handled: 'trucha frita', handledId: 32003, lunchIds: [32002], drink: 'un jugo de maracuya', drinkId: 32004 },
  ];
  for (const enabled of [false, true]) for (const m of menus) {
    for (const join of ['y a parte', 'y aparte']) {
      it(`${m.label} "${join}" adds both dishes, agent ${enabled}`, async () => {
        const h = harness(m.menu as any, enabled);
        await h.sendQueued(`${m.first} ${join} ${m.second}`);
        expect(h.cartRows().map((r: any) => r.id).sort()).toEqual([m.firstId, m.secondId].sort());
      });
    }
    it(`${m.label} "X y una <fish>" adds both, agent ${enabled}`, async () => {
      const h = harness(m.menu as any, enabled);
      await h.sendQueued(`${m.first} y ${m.fish}`);
      expect(h.cartRows().map((r: any) => r.id).sort()).toEqual([m.firstId, m.fishId].sort());
    });
    for (const [note, qty] of [['dividido', 1], ['partido en dos', 1], ['empacado por separado', 1], ['bien tostado', 1], ['en dos cajas', 1]] as const) {
      it(`${m.label} "${m.handled} ${note}" keeps the note and qty ${qty}, agent ${enabled}`, async () => {
        const h = harness(m.menu as any, enabled);
        await h.sendQueued(`${m.handled} ${note}`);
        const rows = h.cartRows();
        expect(rows).toEqual([expect.objectContaining({ id: m.handledId, qty })]);
        expect(rows[0].note).toMatch(new RegExp(note.split(' ')[0], 'i'));
      });
    }
    it(`${m.label} "tres ... en dos cajas" keeps qty 3, agent ${enabled}`, async () => {
      const h = harness(m.menu as any, enabled);
      await h.sendQueued(`tres ${m.handled} en dos cajas`);
      expect(h.cartRows()).toEqual([expect.objectContaining({ id: m.handledId, qty: 3, note: expect.stringMatching(/dos cajas/i) })]);
    });
    for (const text of ['Hola veci que tiene De almuerzo Para hoy', 'que hay de almuerzo?']) {
      it(`${m.label} "${text}" lists the lunch dishes, agent ${enabled}`, async () => {
        const h = harness(m.menu as any, enabled);
        const reply = await h.sendQueued(text);
        expect(reply).not.toMatch(/No tenemos/i);
        for (const id of m.lunchIds) expect(reply).toContain(String((m.menu as any[]).find((p) => p.id === id).name));
        expect(h.conv.sessionData.pendingMatch?.candidates.map((c: any) => c.id)).toEqual(m.lunchIds);
      });
    }
    for (const verb of ['Y agregale', 'y ponle']) {
      it(`${m.label} "${verb} ${m.drink}" adds it without a not-on-menu line, agent ${enabled}`, async () => {
        const h = harness(m.menu as any, enabled);
        await h.sendQueued(m.first);
        const reply = await h.sendQueued(`${verb} ${m.drink}`);
        expect(h.cartRows().map((r: any) => r.id)).toContain(m.drinkId);
        expect(reply).not.toMatch(/no manejamos|en la nota/i);
      });
    }
    if (m.label === 'fictional') it(`the "con" inside a dish name is not a kitchen note, agent ${enabled}`, async () => {
      const plain = harness(m.menu as any, enabled);
      await plain.sendQueued('Plato con res asada');
      expect(plain.cartRows()).toEqual([expect.objectContaining({ id: 32001, note: undefined })]);
      const noted = harness(m.menu as any, enabled);
      await noted.sendQueued('un plato con res asada lomo sin cebolla');
      expect(noted.cartRows()).toEqual([expect.objectContaining({ id: 32001, note: 'sin cebolla', attrs: ['Corte:Lomo'] })]);
    });
    it(`${m.label} "ningun plato con granos" names only the asked item, agent ${enabled}`, async () => {
      const h = harness(m.menu as any, enabled);
      const reply = await h.sendQueued('No tienes ningun Plato con granos');
      expect(reply).not.toMatch(/ningun/i);
      expect(reply).toMatch(/grano/i);
    });
    const atAddress = () => {
      const h = harness(m.menu as any, enabled);
      const product = (m.menu as any[]).find((p) => p.id === m.secondId);
      h.conv.sessionData.cart = [{ productId: product.id, code: product.id, name: product.name, unitPrice: product.price, quantity: 1, attributes: [] }] as any;
      Object.assign(h.conv.sessionData, { orderType: 'delivery', fulfillmentChosen: true });
      h.conv.customerName = 'Yordan';
      h.conv.state = 'awaiting_address';
      return h;
    };
    for (const [text, stored] of [['Envialo Al conjunto aralia De castilla', /^conjunto aralia De castilla$/i], ['mandalo a la Cll 6 b 79 b 17', /^Cll 6 b 79 b 17$/i]] as const) {
      it(`${m.label} "${text}" stores the address without the lead-in, agent ${enabled}`, async () => {
        const h = atAddress();
        await h.sendQueued(text);
        expect(h.conv.sessionData.address).toMatch(stored);
      });
    }
    it(`${m.label} a bare place name is kept as a reference and asks for the street, agent ${enabled}`, async () => {
      const h = atAddress();
      const reply = await h.sendQueued('Seria Para castaño motos');
      expect(h.conv.sessionData.address).toMatch(/^casta[ñn]o motos$/i);
      expect(h.conv.sessionData.addressConfirmed).not.toBe(true);
      expect(reply).toMatch(/calle|carrera|ubicaci[oó]n/i);
    });
  }
});

/** Negated, conditional and quoted cancellation language is not a withdrawal instruction. */
describe('nonoperative cancellation language preserves pending edit',()=>{
  const cases=[
    {text:'No canceles ese cambio',kind:'retain'},
    {text:'Por favor no anules ese cambio',kind:'retain'},
    {text:'Si cobran extra, olvida ese cambio',kind:'conditional'},
    {text:'Que pasa si digo "olvida ese cambio"?',kind:'quoted'},
    {text:'Que ocurre si escribo «cancela ese cambio»?',kind:'quoted'},
    {text:'Me dijeron "olvida ese cambio", pero no lo canceles',kind:'quoted'},
    {text:'Puedo cancelar ese cambio?',kind:'question'},
    {text:'Se puede cancelar el cambio?',kind:'question'},
    {text:'Si no cuesta nada, dejalo como estaba',kind:'conditional'},
  ];
  for(const f of [{dish:'Taco De Calabaza',side:'Porcion De Totopos'},{dish:'Bao De Setas',side:'Porcion De Pan'}])
  for(const enabled of [true,false])for(const state of ['awaiting_payment','awaiting_final_confirm'])for(const {text,kind} of cases){
    it(`${f.dish}, ${text}, ${state}, agent ${enabled}`,async()=>{
      const menu=[{id:43101,code:43101,name:f.dish,price:19000,availableNow:true,attributes:[]},{id:43102,code:43102,name:f.side,price:6000,availableNow:true,attributes:[]}];
      const h=harness(menu,enabled);h.conv.state=state;
      Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,address:'Calle 12 34 56',addressConfirmed:true,deliveryFeeCalculated:2000,
        phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,...(state==='awaiting_final_confirm'?{paymentMethod:'contraentrega'}:{}),
        cart:[...['sin cilantro','con cilantro'].map((note,i)=>({productId:43101,code:43101,name:f.dish,unitPrice:19000,quantity:i?1:2,attributes:[],note})),
          {productId:43102,code:43102,name:f.side,unitPrice:6000,quantity:1,attributes:[],note:'Sin sal'}]});
      h.service.ordersService.create=jest.fn().mockResolvedValue({id:1004,dailyOrderNumber:4});
      await h.sendQueued(`Quita el ${f.dish}`);
      const before=structuredClone(h.conv.sessionData);expect(before.pendingCartRemoval?.options).toHaveLength(2);
      await h.sendQueued(text);
      expect(h.conv.sessionData.cart).toEqual(before.cart);expect(h.conv.sessionData.pendingCartRemoval).toEqual(before.pendingCartRemoval);
      expect(h.conv.state).toBe(state);expect(h.conv.customerName).toBe('Wilmer');
      expect(h.conv.sessionData.paymentMethod).toBe(before.paymentMethod);expect(h.conv.sessionData.address).toBe(before.address);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      expect(h.replies.at(-1)).not.toMatch(/cancel[eé] ese cambio|qued[oó] cancelado|vaciamos|pedido registrado/i);
      expect(h.replies.at(-1)).toMatch(/cu[aá]l l[ií]nea quitamos/i);
      const response=h.replies.at(-1)||'';
      if(kind==='retain')expect(response).toMatch(/mantengo el cambio pendiente/i);
      if(kind==='question')expect(response).toMatch(/puedes cancelar solo el cambio pendiente sin cancelar el pedido/i);
      if(kind==='quoted')expect(response).toMatch(/frase cancela solo la edici[oó]n pendiente y conserva el pedido/i);
      if(kind==='conditional')expect(response).toMatch(/condici[oó]n.*no est[aá] confirmada/i);
      await h.sendQueued('la con cilantro');
      expect(h.cartRows()).toEqual([expect.objectContaining({id:43101,qty:2,note:'sin cilantro'}),expect.objectContaining({id:43102,qty:1,note:'Sin sal'})]);
      expect(h.conv.sessionData.pendingCartRemoval).toBeUndefined();
      if(state==='awaiting_payment')await h.sendQueued('Pago contraentrega');
      await h.sendQueued('Si');expect(h.conv.state).toBe('completed');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const order=h.service.ordersService.create.mock.calls[0][0];expect(order.items).toHaveLength(3);
      expect(order.items.filter((line:any)=>line.productId===43101)).toEqual([expect.objectContaining({note:'sin cilantro'}),expect.objectContaining({note:'sin cilantro'})]);
    });
  }
});

describe('Explicit approval with everyday spelling completes once',()=>{
 for(const name of ['Bao De Hongos','Ensalada De Quinoa'])for(const agent of [false,true])for(const text of ['si confirmo el pedido','Sí confirmo el pedido. ¿Cuánto tarda?']){
  it(name+' '+text+' agent='+agent,async()=>{
   const h=harness([{id:62801,code:62801,name,price:18000,availableNow:true,hasAttributes:false,attributes:[]}],agent);h.conv.state='awaiting_final_confirm';h.service.ordersService.create=jest.fn().mockResolvedValue({id:6280,dailyOrderNumber:68});
   Object.assign(h.conv.sessionData,{cart:[{productId:62801,code:62801,name,unitPrice:18000,quantity:1,attributes:[]}],orderType:'delivery',fulfillmentChosen:true,address:'Calle 12 34 56',addressConfirmed:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,paymentMethod:'contraentrega',notesCollected:true,deliveryFeeCalculated:2000});
   await h.sendQueued(text);expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.conv.state).toBe('completed');
   if(text.includes('?'))expect(h.replies.join(' ')).toMatch(/suele demorar/i);
   await h.sendQueued('Gracias señor');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.conv.state).toBe('completed');
  });
 }
});

describe('Counted availability questions respect unavailable catalogue entries',()=>{
 for(const name of ['Duo De Bao','Caja De Desayuno','Bento De Setas'])it(name,async()=>{
  const product={id:65251,code:65251,name,price:27000,availableNow:false,hasAttributes:true,attributes:[{attributeName:'Salsa',options:['Suave','Picante']}]};
  const h=harness([product],true);h.cfg.ignoreBusinessHours=false;h.conv.state='awaiting_payment';const before=structuredClone(h.conv.sessionData);
  const reply=await h.sendQueued(`Tienen disponibles cuatro ${name}, 2 con Suave y 2 con Picante?`);
  expect(reply).toContain(name);expect(reply).toContain('no figura disponible');expect(h.conv.sessionData).toEqual(before);expect(h.conv.state).toBe('awaiting_payment');expect(h.agent.runTurn).not.toHaveBeenCalled();
 });
});

describe('A complete form with several products and payment needs only final confirmation',()=>{
 for(const enabled of [false,true])it(`agent=${enabled}`,async()=>{
  const menu=[{id:65851,code:65851,name:'Bowl Mediterraneo',price:24000,availableNow:true,hasAttributes:false,attributes:[]},{id:65852,code:65852,name:'Crema De Zapallo',price:9000,availableNow:true,hasAttributes:false,attributes:[]}];const h=harness(menu,enabled);h.cfg.paymentMethods=DEFAULT_PAYMENT_METHODS.map(m=>({...m,enabled:m.flow!=='mercadopago'}));Object.assign(h.conv.sessionData,{lastDeliveryAddress:'Calle 90 11 22'});h.service.ordersService.create=jest.fn().mockResolvedValue({id:6586,dailyOrderNumber:94});
  const reply=await h.sendQueued('Me das un Bowl Mediterraneo y 2 Crema De Zapallo\nCarlos Torres\n3000000006\nConjunto Los Pinos\nCalle 10 #81A-20\nTorre 4 apto 505\ncontraentrega');
  expect(h.conv.sessionData.cart).toHaveLength(2);expect(h.conv.sessionData.cart.find((line:any)=>line.productId===65851)?.quantity).toBe(1);expect(h.conv.sessionData.cart.find((line:any)=>line.productId===65852)?.quantity).toBe(2);expect(h.conv.customerName).toBe('Carlos Torres');expect(h.conv.sessionData.paymentMethod).toBe('cash');expect(h.conv.state).toBe('awaiting_final_confirm');expect(reply).toMatch(/confirmar/i);expect(reply).not.toMatch(/algo m[aá]s|misma direcci[oó]n|mercado pago/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.customerName).toBe('Carlos Torres');expect(dto.phone).toMatch(/3000000006/);expect(dto.address).toMatch(/Torre 4 apto 505/i);expect(dto.items).toHaveLength(3);
 });
});

describe('Named address plus internal access reaches checkout without losing driver details',()=>{
 for(const place of ['Villa Galante','Conjunto Los Pinos'])for(const enabled of [false,true])it(`${place} agent=${enabled}`,async()=>{
  const {WhatsappDeliveryRoutingService}=require('./whatsapp-delivery-routing.service');const h=harness(products,enabled);Object.assign(h.cfg,{deliveryFeeMode:'route',restaurantLat:4.62,restaurantLng:-74.15,deliveryFeeTiers:[{maxKm:8.5,fee:2000}],deliveryMaxKm:8.5});h.cfg.paymentMethods=DEFAULT_PAYMENT_METHODS.map(method=>({...method,enabled:method.flow!=='mercadopago'}));h.conv.state='awaiting_address';h.conv.sessionData={cart:[{productId:23,code:23,name:'Arroz Con Pollo',unitPrice:29500,quantity:1}],orderType:'delivery',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true} as any;
  const routing=new WhatsappDeliveryRoutingService({get:()=> 'mock-key'});jest.spyOn(routing as any,'directionsDistance').mockResolvedValue({distanceKm:1.5,durationMinutes:4});h.service.deliveryRouting=routing;h.service.ordersService.create=jest.fn().mockResolvedValue({id:6591,dailyOrderNumber:96});
  const original=global.fetch;const queries:string[]=[];global.fetch=jest.fn().mockImplementation(async(url:string)=>{queries.push(new URL(url).searchParams.get('address')||'');return {status:200,json:async()=>({status:'OK',results:[{formatted_address:`${place}, Kennedy, Bogotá, Colombia`,partial_match:false,geometry:{location:{lat:4.62,lng:-74.15}},address_components:[{short_name:'CO',types:['country']}]}]})};});
  try{
   const reply=await h.sendQueued(`A ${place} entrada 43 apartamento 48`);expect(reply).not.toMatch(/fuera de cobertura|algo m[aá]s|n[uú]mero de contacto/i);expect(h.conv.state).toBe('awaiting_payment');expect(h.conv.sessionData.address).toMatch(/entrada 43.*(?:apartamento|apto) 48/i);expect(queries.length).toBeGreaterThan(0);expect(queries.every(query=>!/entrada|apartamento|\b43\b|\b48\b/i.test(query))).toBe(true);
   await h.sendQueued('1');expect(h.service.ordersService.create).not.toHaveBeenCalled();await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.address).toMatch(/entrada 43.*(?:apartamento|apto) 48/i);expect(dto.deliveryFee).toBe(2000);expect(dto.items).toHaveLength(1);
  }finally{global.fetch=original;}
 });
});

describe('Lettered access is excluded from map queries and retained in final order',()=>{
 for(const place of ['Conjunto Los Olivos','Edificio Las Acacias','Residencial Los Cedros'])for(const enabled of [false,true])it(`${place} agent=${enabled}`,async()=>{
  const {WhatsappDeliveryRoutingService}=require('./whatsapp-delivery-routing.service');const name=place.startsWith('Conjunto')?'Ravioles De Ricota':place.startsWith('Edificio')?'Bowl De Garbanzos':'Sandwich De Pavo';const h=harness([{id:66901,code:66901,name,price:21000,availableNow:true,attributes:[]}],enabled);Object.assign(h.cfg,{deliveryFeeMode:'route',restaurantLat:4.62,restaurantLng:-74.15,deliveryFeeTiers:[{maxKm:8.5,fee:2000}],deliveryMaxKm:8.5});h.cfg.paymentMethods=DEFAULT_PAYMENT_METHODS.map(method=>({...method,enabled:method.flow!=='mercadopago'}));h.conv.state='awaiting_address';h.conv.sessionData={cart:[{productId:66901,code:66901,name,unitPrice:21000,quantity:1}],orderType:'delivery',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true} as any;
  const routing=new WhatsappDeliveryRoutingService({get:()=> 'mock-key'});jest.spyOn(routing as any,'directionsDistance').mockResolvedValue({distanceKm:1.5,durationMinutes:4});h.service.deliveryRouting=routing;h.service.ordersService.create=jest.fn().mockResolvedValue({id:6591,dailyOrderNumber:96});
  const original=global.fetch;const queries:string[]=[];global.fetch=jest.fn().mockImplementation(async(url:string)=>{queries.push(new URL(url).searchParams.get('address')||'');return {status:200,json:async()=>({status:'OK',results:[{formatted_address:`${place}, Kennedy, Bogotá, Colombia`,partial_match:false,geometry:{location:{lat:4.62,lng:-74.15}},address_components:[{short_name:'CO',types:['country']}]}]})};});
  try{
   const reply=await h.sendQueued(`A ${place} torre B apartamento 304B`);expect(reply).not.toMatch(/fuera de cobertura|algo m[aá]s|n[uú]mero de contacto/i);expect(h.conv.state).toBe('awaiting_payment');expect(h.conv.sessionData.address).toMatch(/torre B.*(?:apartamento|apto) 304B/i);expect(queries.length).toBeGreaterThan(0);expect(queries.every(query=>!/torre|apartamento|\b304B\b/i.test(query))).toBe(true);
   await h.sendQueued('1');expect(h.service.ordersService.create).not.toHaveBeenCalled();await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.address).toMatch(/torre B.*(?:apartamento|apto) 304B/i);expect(dto.deliveryFee).toBe(2000);expect(dto.items).toHaveLength(1);expect(dto.items[0].productId).toBe(66901);
  }finally{global.fetch=original;}
 });
});

describe('PDF merchant payment questions never overwrite customer identity',()=>{
 for(const enabled of [false,true])for(const name of ['Pizza Del Huerto','Bowl De Garbanzos'])for(const state of ['awaiting_payment','awaiting_final_confirm'])for(const text of ['¿El Nequi es 3000000009?','3000000009 este es para Nequi cierto','¿A nombre de quién sale el pago?','Me pasas los datos para transferir por favor']){
  it(name+' '+state+' '+text+' agent='+enabled,async()=>{
   const p={id:79911,code:79911,name,price:21000,availableNow:true,attributes:[]};const h=harness([p],enabled);
   h.cfg.localContext={transferInfoNote:'Cuenta de prueba del comercio: 3000000008. Titular: Restaurante Ejemplo.'};
   h.conv.state=state;h.service.ordersService.create=jest.fn().mockResolvedValue({id:7991,dailyOrderNumber:80});
   Object.assign(h.conv.sessionData,{cart:[{productId:p.id,code:p.code,name,unitPrice:p.price,quantity:2,note:'Salsa aparte'}],orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,...(state==='awaiting_final_confirm'?{paymentMethod:'cash'}:{})});
   const before=structuredClone(h.conv.sessionData);const customer=h.conv.customerName;
   const reply=await h.sendQueued(text);expect(reply).toContain('3000000008');expect(reply).toContain('Restaurante Ejemplo');
   expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBe(customer);expect(h.conv.state).toBe(state);expect(h.service.ordersService.create).not.toHaveBeenCalled();
   if(state==='awaiting_payment')await h.sendQueued('1');await h.sendQueued('confirmar');
   expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toHaveLength(2);expect(dto.customerName).toBe(customer);expect(dto.phone).toMatch(/3000000001/);
   expect(dto.items.every((item:any)=>item.productId===p.id&&item.note==='Salsa aparte')).toBe(true);
  });
 }
});

describe('Fragmented destination survives checkout and replacement without stale units', () => {
 for(const name of ['Ravioles De Ricota','Bowl De Garbanzos'])for(const enabled of [false,true])for(const replace of [false,true]) {
  it(`${name} replace=${replace} agent=${enabled}`,async()=>{
   const h=harness([{id:80001,code:80001,name,price:21000,availableNow:true,attributes:[]}],enabled);
   h.cfg.paymentMethods=DEFAULT_PAYMENT_METHODS.map(method=>({...method,enabled:method.flow!=='mercadopago'}));
   Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,notesCollected:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164});
   h.service.deliveryRouting={quoteDeliveryFee:jest.fn().mockResolvedValue({ok:true,fee:2000,distanceKm:1,source:'google_directions',customer:{lat:4.62,lng:-74.15}})};
   h.service.ordersService.create=jest.fn().mockResolvedValue({id:8000,dailyOrderNumber:87});
   await h.sendQueued(`Quiero dos ${name}`);
   await h.sendQueued('Para la Calle 10 #81A-20');
   await h.sendQueued('Conjunto residencial Los Cedros');
   const unitReply=await h.sendQueued('Torre B apartamento 304B');
   expect(unitReply).not.toMatch(/no manejamos|no tenemos|no me qued[oó] clar/i);
   expect(unitReply).toMatch(/304B/i);
   expect(h.conv.state).toBe('awaiting_payment');
   expect(h.conv.sessionData.address).toMatch(/81A-20.*Los Cedros.*Torre B.*304B/i);
   expect(h.cartRows()).toEqual([expect.objectContaining({id:80001,qty:2})]);
   const cart=structuredClone(h.conv.sessionData.cart);
   const total=await h.sendQueued('Cuánto es el total');expect(total).toMatch(/44[.,]000/);
   expect(h.conv.sessionData.cart).toEqual(cart);expect(h.service.ordersService.create).not.toHaveBeenCalled();
   await h.sendQueued('contraentrega');expect(h.conv.state).toBe('awaiting_final_confirm');
   if(replace){
    await h.sendQueued('Cambiar dirección a Carrera 22 #45-60');
    await h.sendQueued('Conjunto residencial Los Robles');
    const newUnit=name.startsWith('Bowl')?'Torre 3 apartamento 205':'Torre C apartamento 205';
    const changed=await h.sendQueued(newUnit);
    await h.sendQueued(newUnit);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    expect(changed).toMatch(/confirmar/i);
    expect(changed).not.toMatch(/algo m[aá]s|no me qued[oó] clar/i);
    expect(h.conv.sessionData.address).toMatch(/45-60.*Los Robles.*Torre [C3].*205/i);
    expect(h.conv.sessionData.address).not.toMatch(/81A-20|Cedros|304B|Torre B/i);
    expect(h.conv.sessionData.paymentMethod).toBe('cash');
    expect(h.conv.state).toBe('awaiting_final_confirm');
   }
   expect(h.conv.sessionData.cart).toEqual(cart);expect(h.service.ordersService.create).not.toHaveBeenCalled();
   await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
   const dto=h.service.ordersService.create.mock.calls[0][0];
   expect(dto.items).toHaveLength(2);expect(dto.items.every((r:any)=>r.productId===80001)).toBe(true);
   expect(dto.address).toMatch(replace?/45-60.*Los Robles.*Torre [C3].*205/i:/81A-20.*Los Cedros.*Torre B.*304B/i);
   expect(dto.address.match(new RegExp(replace?'Los Robles':'Los Cedros','gi'))).toHaveLength(1);
   expect(dto.deliveryFee).toBe(2000);expect(dto.phone).toMatch(/3000000001/);expect(dto.customerName).toBe('Wilmer');
  });
 }
});

describe('Delivery access references resume checkout without asking for more products',()=>{
 for(const name of ['Ravioles De Ricota','Bowl De Garbanzos'])for(const enabled of [false,true])for(const final of [false,true])it(`${name} final=${final} agent=${enabled}`,async()=>{
  const h=harness([{id:80011,code:80011,name,price:21000,availableNow:true,attributes:[]}],enabled);
  h.cfg.paymentMethods=DEFAULT_PAYMENT_METHODS.map(method=>({...method,enabled:method.flow!=='mercadopago'}));
  Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,notesCollected:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164});
  h.service.deliveryRouting={quoteDeliveryFee:jest.fn().mockResolvedValue({ok:true,fee:2000,distanceKm:1,source:'google_directions',customer:{lat:4.62,lng:-74.15}})};
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:8001,dailyOrderNumber:88});
  await h.sendQueued(`Quiero dos ${name}`);await h.sendQueued('Calle 10 #81A-20 torre B apartamento 304B');
  expect(h.conv.state).toBe('awaiting_payment');if(final)await h.sendQueued('contraentrega');
  const state=h.conv.state;const cart=structuredClone(h.conv.sessionData.cart);
  const reference=name.startsWith('Bowl')?'Timbre 304B':'Portón verde a mitad de cuadra';
  for(let repeat=0;repeat<2;repeat++){
   const reply=await h.sendQueued(reference);
   expect(reply).toContain(reference);expect(reply).not.toMatch(/algo m[aá]s|qu[eé] se te antoja/i);
   expect(h.conv.state).toBe(state);expect(h.conv.sessionData.cart).toEqual(cart);
   expect(h.conv.sessionData.address).toMatch(/81A-20.*torre B.*304B/i);
   expect(h.conv.sessionData.address).toContain(reference);
   expect(h.conv.sessionData.address!.split(reference)).toHaveLength(2);
   expect(h.service.ordersService.create).not.toHaveBeenCalled();
  }
  const total=await h.sendQueued('Cuánto es el total');expect(total).toMatch(/44[.,]000/);
  if(!final)await h.sendQueued('contraentrega');
  expect(h.conv.state).toBe('awaiting_final_confirm');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toHaveLength(2);expect(dto.items.every((r:any)=>r.productId===80011)).toBe(true);
  expect(dto.address).toContain(reference);expect(dto.address).toMatch(/81A-20.*torre B.*304B/i);expect(dto.deliveryFee).toBe(2000);
  expect(dto.phone).toMatch(/3000000001/);expect(dto.customerName).toBe('Wilmer');
 });
});
