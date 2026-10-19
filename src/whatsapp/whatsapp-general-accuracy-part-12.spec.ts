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


describe('Pedido mixto — dos dudas independientes',()=>{
 it.each([false,true].flatMap(agent=>['Pizza','Ramen'].map(family=>({agent,family}))))('elegir $family añade esa línea sin esperar la otra (agente $agent)',async({agent,family})=>{
 const menu=[{id:15931,code:15931,name:family+' Vegetal',price:18000,availableNow:true,hasAttributes:false,attributes:[]},
 {id:15932,code:15932,name:family+' De Queso',price:19000,availableNow:true,hasAttributes:false,attributes:[]},
 {id:15933,code:15933,name:'Pasta De Setas',price:20000,availableNow:true,hasAttributes:false,attributes:[]},
 {id:15934,code:15934,name:'Pasta De Espinaca',price:21000,availableNow:true,hasAttributes:false,attributes:[]}];
 const h=harness(menu,agent);h.service.ordersService.create=jest.fn();
 h.conv.sessionData.pendingMultiOrder={confident:[],needsAttributes:[],unresolved:['zapato comestible'],ambiguous:[{segment:`Dos ${family}`,candidates:menu.slice(0,2)},{segment:'Tres pastas',candidates:menu.slice(2)}]};
 await h.sendQueued('1');
 expect(h.cartRows()).toEqual([expect.objectContaining({id:15931,qty:2})]);
 expect(h.conv.sessionData.pendingMultiOrder?.ambiguous).toHaveLength(1);
 await h.sendQueued('1');
 expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:15931,qty:2}),expect.objectContaining({id:15933,qty:3})]));
 expect(h.cartRows()).toHaveLength(2);
 expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});

describe('Corrección negativa — no dije ese plato', () => {
  const pastaMenu = [
    { id: 16401, code: 16401, name: 'Combo De Pasta', price: 28000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 16402, code: 16402, name: 'Ensalada Verde', price: 9000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 16403, code: 16403, name: 'Pasta Al Pesto', price: 22000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 16404, code: 16404, name: 'Duo De Pastas', price: 40000, availableNow: true, hasAttributes: false, attributes: [] },
  ];
  const ramenMenu = [
    { id: 16411, code: 16411, name: 'Combo De Miso', price: 26000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 16412, code: 16412, name: 'Combo De Shoyu', price: 27000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 16413, code: 16413, name: 'Gyoza', price: 8000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 16414, code: 16414, name: 'Ramen De Miso', price: 24000, availableNow: true, hasAttributes: false, attributes: [] },
  ];
  const line = (id: number, name: string, price: number, qty: number) => ({
    productId: id, code: id, name, unitPrice: price, quantity: qty, attributes: [],
  });

  it.each([false, true])('cambia los dos combos por dos tacos y deja la yuca (agent %s)', async (agent) => {
    const h = harness(products, agent);
    h.service.ordersService.create = jest.fn();
    h.conv.sessionData.cart = [
      line(99, 'Combo De Pollo Frito', 49000, 2),
      line(7, 'Porcion De Yuca Frita', 7000, 1),
    ];
    const reply = await h.sendQueued('no dije dos combos, dije dos tacos');
    expect(h.cartRows().find((row) => row.id === 7)).toMatchObject({ qty: 1 });
    expect(h.cartRows().find((row) => row.id === 70)).toMatchObject({ qty: 2 });
    expect(h.cartRows().some((row) => [71, 72, 73, 99].includes(row.id))).toBe(false);
    expect(h.cartRows()).toHaveLength(2);
    expect(reply || '').toMatch(/Taco Al Pastor/i);
    expect(reply || '').not.toMatch(/no manejamos/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each([false, true])('cambia el combo de pasta por dos pastas y deja la ensalada (agent %s)', async (agent) => {
    const h = harness(pastaMenu, agent);
    h.service.ordersService.create = jest.fn();
    h.conv.sessionData.cart = [
      line(16401, 'Combo De Pasta', 28000, 2),
      line(16402, 'Ensalada Verde', 9000, 1),
    ];
    const reply = await h.sendQueued('no dije dos combos, dije dos pastas');
    expect(h.cartRows().find((row) => row.id === 16402)).toMatchObject({ qty: 1 });
    expect(h.cartRows().find((row) => row.id === 16403)).toMatchObject({ qty: 2 });
    expect(h.cartRows().some((row) => row.id === 16401 || row.id === 16404)).toBe(false);
    expect(h.cartRows()).toHaveLength(2);
    expect(reply || '').toMatch(/Pasta Al Pesto/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each([
    { agent: true, menu: products, text: 'no dije dos combos, dije dos tacos', extra: line(98, 'Combo De Pollo Broaster', 48000, 2), keep: 7 },
    { agent: false, menu: ramenMenu, text: 'no dije dos combos, dije dos ramen', extra: line(16412, 'Combo De Shoyu', 27000, 2), keep: 16413 },
  ])('pregunta cuál combo cuando hay dos y no toca el resto (agent $agent)', async ({ agent, menu, text, extra, keep }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    const side = menu === products ? line(7, 'Porcion De Yuca Frita', 7000, 1) : line(16413, 'Gyoza', 8000, 1);
    const first = menu === products ? line(99, 'Combo De Pollo Frito', 49000, 2) : line(16411, 'Combo De Miso', 26000, 2);
    h.conv.sessionData.cart = [first, extra, side];
    const before = structuredClone(h.cartRows());
    const reply = await h.sendQueued(text);
    expect(h.cartRows()).toEqual(before);
    expect(h.cartRows().find((row) => row.id === keep)?.qty).toBe(1);
    expect(reply || '').toMatch(/cuál cambio/i);
    expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('Nota con negación — sin picante y ají aparte', () => {
  const bowls = [
    { id: 17101, code: 17101, name: 'Ramen De Miso', price: 24000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 17102, code: 17102, name: 'Salsa De Aji', price: 2000, availableNow: true, hasAttributes: false, attributes: [] },
  ];
  const line = (id: number, name: string, price: number) => ({
    productId: id, code: id, name, unitPrice: price, quantity: 1, attributes: [] as { attributeName: string; attributeValue: string }[],
  });

  it.each([
    { agent: false, menu: products, text: 'un churrasco sin picante; el ají aparte', id: 17, banned: 38 },
    { agent: true, menu: products, text: 'un churrasco sin picante; el ají aparte', id: 17, banned: 38 },
    { agent: false, menu: bowls, text: 'un ramen de miso sin picante; el ají aparte', id: 17101, banned: 17102 },
    { agent: true, menu: bowls, text: 'un ramen de miso sin picante; el ají aparte', id: 17101, banned: 17102 },
  ])('guarda las dos notas y no compra el ají (agent $agent)', async ({ agent, menu, text, id, banned }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    const reply = await h.sendQueued(text);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id, qty: 1, note: expect.stringMatching(/sin picante/i) })]);
    expect(h.cartRows()[0].note || '').toMatch(/aj[ií] aparte/i);
    expect(h.cartRows().some((row) => row.id === banned)).toBe(false);
    expect(reply || '').toMatch(/sin picante/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each([
    { agent: false, menu: products, cart: [line(17, 'Churrasco', 38000)], banned: 38 },
    { agent: true, menu: products, cart: [line(17, 'Churrasco', 38000)], banned: 38 },
    { agent: false, menu: bowls, cart: [line(17101, 'Ramen De Miso', 24000)], banned: 17102 },
    { agent: true, menu: bowls, cart: [line(17101, 'Ramen De Miso', 24000)], banned: 17102 },
  ])('en un pedido ya armado no agrega el ají (agent $agent)', async ({ agent, menu, cart, banned }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    h.conv.sessionData.cart = cart;
    const reply = await h.sendQueued('sin picante; el ají aparte');
    expect(h.cartRows()).toHaveLength(1);
    expect(h.cartRows()[0].note || '').toMatch(/sin picante/i);
    expect(h.cartRows()[0].note || '').toMatch(/aj[ií] aparte/i);
    expect(h.cartRows().some((row) => row.id === banned)).toBe(false);
    expect(reply || '').toMatch(/nota/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each([
    { agent: false, menu: products, cart: [line(17, 'Churrasco', 38000)], text: 'Quítale lo picante al churrasco, pero el ají mándamelo en un tarrito aparte', id: 17, banned: 38 },
    { agent: true, menu: products, cart: [line(17, 'Churrasco', 38000)], text: 'Quítale lo picante al churrasco, pero el ají mándamelo en un tarrito aparte', id: 17, banned: 38 },
    { agent: false, menu: bowls, cart: [line(17101, 'Ramen De Miso', 24000)], text: 'Quítale lo picante al ramen de miso, pero el ají mándamelo en un tarrito aparte', id: 17101, banned: 17102 },
    { agent: true, menu: bowls, cart: [line(17101, 'Ramen De Miso', 24000)], text: 'Quítale lo picante al ramen de miso, pero el ají mándamelo en un tarrito aparte', id: 17101, banned: 17102 },
  ])('una frase distinta conserva las dos notas (agent $agent)', async ({ agent, menu, cart, text, id, banned }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    h.conv.sessionData.cart = cart;
    const reply = await h.sendQueued(text);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id, qty: 1 })]);
    expect(h.cartRows()[0].note || '').toMatch(/sin picante/i);
    expect(h.cartRows()[0].note || '').toMatch(/aj[ií] aparte/i);
    expect(h.cartRows().some((row) => row.id === banned)).toBe(false);
    expect(reply || '').toMatch(/sin picante/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('Cancelación ambigua — dos platos coinciden', () => {
  const bowls = [
    { id: 17901, code: 17901, name: 'Combo De Pasta', price: 28000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 17902, code: 17902, name: 'Combo De Ramen', price: 26000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 17903, code: 17903, name: 'Edamame', price: 8000, availableNow: true, hasAttributes: false, attributes: [] },
  ];
  const row = (id: number, name: string, price: number, quantity = 1) => ({
    productId: id, code: id, name, unitPrice: price, quantity, attributes: [] as { attributeName: string; attributeValue: string }[],
  });

  it.each([
    { agent: false, menu: products, cart: [row(99, 'Combo De Pollo Frito', 49000, 2), row(98, 'Combo De Pollo Broaster', 47000), row(7, 'Porcion De Yuca Frita', 7000)] },
    { agent: true, menu: products, cart: [row(99, 'Combo De Pollo Frito', 49000, 2), row(98, 'Combo De Pollo Broaster', 47000), row(7, 'Porcion De Yuca Frita', 7000)] },
    { agent: false, menu: bowls, cart: [row(17901, 'Combo De Pasta', 28000, 2), row(17902, 'Combo De Ramen', 26000), row(17903, 'Edamame', 8000)] },
    { agent: true, menu: bowls, cart: [row(17901, 'Combo De Pasta', 28000, 2), row(17902, 'Combo De Ramen', 26000), row(17903, 'Edamame', 8000)] },
  ])('cancela el combo pregunta cuál y no toca el premio (agent $agent)', async ({ agent, menu, cart }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    h.conv.sessionData.cart = cart;
    h.conv.sessionData.pendingRedemptionCode = 'ABCD2345EFGH';
    const before = h.cartRows();
    const reply = await h.sendQueued('cancela el combo');
    expect(h.cartRows()).toEqual(before);
    expect(h.conv.sessionData.pendingRedemptionCode).toBe('ABCD2345EFGH');
    expect(reply || '').toMatch(/cuál quitamos/i);
    expect(h.conv.state).not.toBe('closed');
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('Consultar una adición — no efectuar la compra',()=>{
 it.each(['Pizza De Setas','Bowl De Quinoa'].flatMap((name,index)=>[false,true].flatMap(agent=>['awaiting_address','awaiting_payment'].map(state=>({name,index,agent,state})))))('$name en $state (agent $agent)',async({name,index,agent,state})=>{
  const p={id:19501+index,code:19501+index,name,price:17000,availableNow:true,hasAttributes:false,attributes:[]};
  const base={id:19511,code:19511,name:'Agua Mineral',price:4000,availableNow:true,hasAttributes:false,attributes:[]};
  const h=harness([p,base] as typeof products,agent);h.service.ordersService.create=jest.fn();
  h.conv.state=state;h.conv.sessionData.address='Calle 12 #34-56';
  h.conv.sessionData.cart=[{productId:base.id,name:base.name,code:base.code,unitPrice:4000,quantity:2,attributes:[]}];
  const before=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued(`Cuánto cuesta añadir otro ${name}?`);
  expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.address).toBe('Calle 12 #34-56');
  expect(reply||'').toMatch(/17\.000/);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});

describe('Cantidad y varios atributos — selección en un turno',()=>{
 it.each(['Jugo De Avena','Bebida De Citricos'].flatMap(name=>[false,true].flatMap(agent=>[false,true].map(increment=>({name,agent,increment})))))('$name incremento=$increment agent=$agent',async({name,agent,increment})=>{
  const dish={id:21601,code:2301,name,price:28000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mango','Lulo']},{attributeName:'Endulzante',options:['Azucar','Stevia']}]};
  const h=harness([dish] as typeof products,agent);h.service.ordersService.create=jest.fn();await h.sendQueued('Agrega tres #2301 sin hielo');
  expect(h.conv.sessionData.pendingAttribute?.productId).toBe(dish.id);expect(h.conv.sessionData.pendingAttribute?.quantity).toBe(3);
  await h.sendQueued(increment?'Añade dos más con sabor lulo y endulzante stevia':'Mejor dos con sabor lulo y endulzante stevia');
  expect(h.cartRows()).toEqual([expect.objectContaining({id:dish.id,qty:increment?5:2,attrs:expect.arrayContaining(['Sabor:Lulo','Endulzante:Stevia']),note:expect.stringMatching(/sin hielo/i)})]);
  expect(h.conv.sessionData.pendingAttribute).toBeFalsy();expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});

describe('Recorridos reservados — consulta, opciones, cambios y checkout',()=>{
 const menus=[{dish:'Hamburguesa De Garbanzo',drink:'Jugo Tropical',flavors:['Mango','Lulo']},{dish:'Pizza Rustica',drink:'Gaseosa Artesanal',flavors:['Mora','Durazno']},{dish:'Sandwich De Tofu',drink:'Bebida De Citricos',flavors:['Limon','Maracuya']}];
 it.each(menus.flatMap(menu=>[false,true].map(agent=>({...menu,agent}))))('$dish / $drink agent=$agent',async({dish,drink,flavors,agent})=>{
  const food={id:21701,code:2401,name:dish,price:22000,availableNow:true,hasAttributes:false,attributes:[]};
  const beverage={id:21702,code:2402,name:drink,price:6500,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:flavors}]};
  const h=harness([food,beverage] as typeof products,agent);h.service.ordersService.create=jest.fn();
  await h.sendQueued(`Quiero dos ${dish} sin ensalada`);expect(h.cartRows()).toEqual([expect.objectContaining({id:food.id,qty:2,note:expect.stringMatching(/sin ensalada/i)})]);
  const price=await h.sendQueued(`¿Cuánto cuesta ${dish}?`);expect(price||'').toMatch(/22\.000/);expect(h.cartRows()).toHaveLength(1);
  await h.sendQueued('Agrega tres #2402 sin hielo');expect(h.conv.sessionData.pendingAttribute?.quantity).toBe(3);
  const quote=await h.sendQueued('¿Si añado dos más cuánto cuestan?');expect(quote||'').toMatch(/13\.000/);expect(quote||'').toMatch(/32\.500/);expect(h.conv.sessionData.pendingAttribute?.quantity).toBe(3);
  await h.sendQueued(`Añade dos más con ${flavors[1]}`);
  expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:food.id,qty:2,note:expect.stringMatching(/sin ensalada/i)}),expect.objectContaining({id:beverage.id,qty:5,attrs:[`Sabor:${flavors[1]}`],note:expect.stringMatching(/sin hielo/i)})]));expect(h.cartRows()).toHaveLength(2);
  const addressReply=await h.sendQueued('Es para la calle 21 #34-56');expect({state:h.conv.state,address:h.conv.sessionData.address,reply:addressReply,pending:h.conv.sessionData.pendingMultiOrder}).toMatchObject({state:'awaiting_payment',address:expect.stringMatching(/calle 21.*34-56/i),reply:expect.stringMatching(/cómo pagas/i),pending:undefined});
  const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued('Dirección: cl 9 #18-27');expect(h.conv.sessionData.address).toMatch(/9.*18-27/i);expect(h.conv.sessionData.cart).toEqual(before);
  const total=await h.sendQueued('¿Cuánto suma todo?');expect(total||'').toMatch(/78\.500/);expect(h.conv.state).toBe('awaiting_payment');expect(h.conv.sessionData.cart).toEqual(before);
  await h.sendQueued('Pago en efectivo');expect(h.conv.state).toBe('awaiting_final_confirm');expect(h.conv.sessionData.paymentMethod).toBe('cash');expect(h.conv.sessionData.cart).toEqual(before);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});


describe('Referencia corta de cantidad — solo cuando hay una línea inequívoca', () => {
  it.each(['Sopa De Calabaza','Pizza Rustica','Ramen De Miso'].flatMap(name=>[false,true].flatMap(agent=>['reemplazar','añadir','ambigua'].map(kind=>({name,agent,kind})))))('$name $kind agent=$agent',async({name,agent,kind})=>{
    const dish={id:22701,code:3401,name,price:10500,availableNow:true,hasAttributes:false,attributes:[]};
    const h=harness([dish] as typeof products,agent);h.service.ordersService.create=jest.fn();
    h.conv.sessionData.cart=[{productId:dish.id,name,code:dish.code,unitPrice:dish.price,quantity:4,attributes:[],note:'sin cilantro'}];
    if(kind==='ambigua')h.conv.sessionData.cart.push({productId:dish.id,name,code:dish.code,unitPrice:dish.price,quantity:2,attributes:[],note:'con cilantro'});
    const before=structuredClone(h.conv.sessionData);
    const reply=await h.sendQueued(kind==='añadir'?'Una más por favor':'Mejor solo una');
    if(kind==='ambigua'){expect(h.conv.sessionData).toEqual(before);expect(reply||'').toMatch(/cu[aá]l|plato|l[ií]nea/i);}
    else expect(h.cartRows()).toEqual([expect.objectContaining({id:dish.id,qty:kind==='añadir'?5:1,note:'sin cilantro'})]);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('Multiórden — varias elecciones en un turno', () => {
  const families = [
    { kind: 'pizza', a: 'Pizza Vegetal', b: 'Pizza De Queso', c: 'Pasta De Setas', d: 'Pasta De Espinaca' },
    { kind: 'ramen', a: 'Ramen Vegetal', b: 'Ramen De Miso', c: 'Gyoza De Setas', d: 'Gyoza De Cerdo' },
    { kind: 'tacos', a: 'Taco Vegetal', b: 'Taco Al Pastor', c: 'Quesadilla De Setas', d: 'Quesadilla De Pollo' },
    { kind: 'burger', a: 'Hamburguesa Vegetal', b: 'Hamburguesa De Lentejas', c: 'Papas De Setas', d: 'Papas De Queso' },
    { kind: 'sushi', a: 'Roll Vegetal', b: 'Roll De Salmon', c: 'Nigiri De Setas', d: 'Nigiri De Atun' },
    { kind: 'pasta', a: 'Pasta Vegetal', b: 'Pasta Al Pesto', c: 'Lasana De Setas', d: 'Lasana De Carne' },
    { kind: 'bowl', a: 'Bowl Vegetal', b: 'Bowl De Quinoa', c: 'Wrap De Setas', d: 'Wrap De Pollo' },
  ];
  const menuOf = (family: typeof families[number]) => [family.a, family.b, family.c, family.d].map((name, index) => ({
    id: 27001 + families.indexOf(family) * 10 + index,
    code: 800 + families.indexOf(family) * 10 + index,
    name, price: 18000 + index * 1000, availableNow: true, hasAttributes: false, attributes: [] as { attributeName: string; options: string[] }[],
  }));

  it.each(families.flatMap((family) => ['numeros', 'nombres'].flatMap((kind) => [false, true].map((agent) => ({ family, kind, agent })))))(
    '$family.kind $kind cierra las dos listas (agent $agent)',
    async ({ family, kind, agent }) => {
      const menu = menuOf(family);
      const h = harness(menu as typeof products, agent);
      h.service.ordersService.create = jest.fn();
      h.conv.sessionData.pendingMultiOrder = {
        confident: [], needsAttributes: [], unresolved: ['zapato comestible'],
        ambiguous: [
          { segment: `Dos ${family.a.split(' ')[0]}`, candidates: menu.slice(0, 2) },
          { segment: 'Tres acompanantes', candidates: menu.slice(2) },
        ],
      };
      await h.sendQueued(kind === 'numeros' ? '1 y 2' : `${menu[0].name} y ${menu[3].name}`);
      expect(h.cartRows()).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: menu[0].id, qty: 2 }),
        expect.objectContaining({ id: menu[3].id, qty: 3 }),
      ]));
      expect(h.cartRows()).toHaveLength(2);
      expect(h.conv.sessionData.pendingMultiOrder?.ambiguous?.length || 0).toBe(0);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])('ppp elige las dos listas por nombre (agent %s)', async (agent) => {
    const broaster = products.filter((item) => /broaster/i.test(item.name)).slice(0, 2);
    const frito = products.filter((item) => /frito/i.test(item.name) && !/broaster/i.test(item.name)).slice(0, 2);
    expect(broaster).toHaveLength(2);
    expect(frito).toHaveLength(2);
    const h = harness(products, agent);
    h.service.ordersService.create = jest.fn();
    h.conv.sessionData.pendingMultiOrder = {
      confident: [], needsAttributes: [], unresolved: ['zapato comestible'],
      ambiguous: [
        { segment: 'Dos pollos', candidates: broaster },
        { segment: 'Tres pollos', candidates: frito },
      ],
    };
    await h.sendQueued(`${broaster[0].name} y ${frito[1].name}`);
    expect(h.cartRows()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: broaster[0].id, qty: 2 }),
      expect.objectContaining({ id: frito[1].id, qty: 3 }),
    ]));
    expect(h.cartRows()).toHaveLength(2);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each(families.slice(0, 4).flatMap((family) => ['Mango y Durazno', 'jugos'].flatMap((phrase) => [false, true].map((agent) => ({ family, phrase, agent })))))(
    '$family.kind $phrase reparte el sabor (agent $agent)',
    async ({ family, phrase, agent }) => {
      const bowl = { id: 27101 + families.indexOf(family), code: 900 + families.indexOf(family), name: family.a, price: 16000, availableNow: true, hasAttributes: false, attributes: [] as { attributeName: string; options: string[] }[] };
      const juice = { id: bowl.id + 1, code: bowl.code + 1, name: 'Jugo Natural', price: 8000, availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Sabor', options: ['Mango', 'Lulo'] }] };
      const soda = { id: bowl.id + 2, code: bowl.code + 2, name: 'Gaseosa Artesanal', price: 7000, availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Sabor', options: ['Mora', 'Durazno'] }] };
      const h = harness([bowl, juice, soda] as typeof products, agent);
      h.service.ordersService.create = jest.fn();
      await h.sendQueued(`Quiero dos ${bowl.name}, tres ${juice.name} y dos ${soda.name}`);
      expect(h.cartRows()).toEqual([expect.objectContaining({ id: bowl.id, qty: 2 })]);
      expect(h.conv.sessionData.pendingAttribute?.productId).toBe(juice.id);
      const answer = phrase === 'jugos' ? `el ${juice.name} Mango y la ${soda.name} Durazno` : phrase;
      await h.sendQueued(answer);
      expect(h.cartRows()).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: bowl.id, qty: 2 }),
        expect.objectContaining({ id: juice.id, qty: 3, attrs: ['Sabor:Mango'] }),
        expect.objectContaining({ id: soda.id, qty: 2, attrs: ['Sabor:Durazno'] }),
      ]));
      expect(h.cartRows()).toHaveLength(3);
      expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    },
  );
});


describe('Combo pendiente — aclaración larga y extra de acompañamiento', () => {
  it('no convierte la respuesta al combo en un plato desconocido', async () => {
    const h = harness(products,true);
    h.agent.runTurn.mockResolvedValueOnce({reply:'El Combo De Pollo Broaster viene con papa francesa. ¿Te lo agrego con papa salada en vez de papa francesa? ¿Qué bebida prefieres?',actions:{},toolCalls:[]});
    await h.send('Hola Buenos dias me envias Un combo De Pollo broaster con papas saladas es Para los gemelos');
    const reply = await h.send('Lo quiero normal con papa Francesa pero que Le agreguen unas Tres papitas saladas asi como siemore me envian');
    expect(reply).not.toMatch(/no manejamos.*Lo quiero normal/is);
    const session=h.conv.sessionData;
    expect(session.cart.some(line=>/combo.*broaster/i.test(line.name)) || /combo.*broaster/i.test(session.pendingAttribute?.name || session.pendingAddOffer?.name || '')).toBe(true);
    expect(session.cart.filter(line=>/papa salada/i.test(line.name))).toEqual([]);
    expect(h.conv.state).not.toBe('completed');
    expect(session.customerNotes).toMatch(/revisar con el local.*Tres papitas/i);
    expect(h.replies.join('\n')).toMatch(/confirmar si se puede y si tiene costo/i);
    if (session.pendingAttribute) await h.send('Colombiana');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:98,qty:1})]);
  });
});


describe('Teléfono pendiente — resolver consulta y completar checkout',()=>{
 const menus=[{id:38001,code:971,name:'Pizza De Setas',description:'Incluye setas y queso',price:17000,availableNow:true,hasAttributes:false,attributes:[]},{id:38002,code:972,name:'Bowl De Quinoa',description:'Incluye quinoa y verduras',price:17000,availableNow:true,hasAttributes:false,attributes:[]}];
 for(const dish of menus)for(const question of ['¿Cuánto suma todo?','¿Qué trae ese plato?','Me pueden comprar unas pilas?'])it.each([false,true])(`${dish.name} ${question} agent=%s`,async agent=>{
  const h=harness([dish],agent);h.service.ordersService.create=jest.fn();h.conv.state='awaiting_phone';
  h.conv.sessionData.cart=[{productId:dish.id,name:dish.name,code:dish.code,unitPrice:dish.price,quantity:3,attributes:[],note:'sin cebolla'}];
  h.conv.sessionData.orderType='delivery';h.conv.sessionData.address='Calle 21 #34-56';h.conv.sessionData.addressConfirmed=true;h.conv.sessionData.deliveryFeeCalculated=2000;
  const before=structuredClone(h.conv.sessionData);
  const reply=await h.sendQueued(question);
  expect(h.conv.sessionData).toEqual(before);expect(h.conv.state).toBe('awaiting_phone');
  expect(reply||'').toMatch(/tel[eé]fono|n[uú]mero|contacto/i);
  if(question.includes('suma'))expect(reply||'').toMatch(/53[.,]000/);
  if(question.includes('trae'))expect(reply||'').toMatch(dish.id===38001?/setas.*queso/i:/quinoa.*verduras/i);
  if(question.includes('pilas'))expect(reply||'').toMatch(/pilas/i);
  await h.sendQueued('310 555 0199');
  expect(h.conv.sessionData.phoneConfirmed).toBe(true);expect(h.conv.sessionData.contactPhone).toBe('+573105550199');
  expect(h.conv.state).toBe('awaiting_payment');expect(h.conv.sessionData.cart).toEqual(before.cart);
  await h.sendQueued('Pago por Nequi');
  expect(h.conv.state).toBe('awaiting_final_confirm');expect(h.conv.sessionData.paymentMethod).toBe('transfer');
  expect(h.conv.sessionData.cart).toEqual(before.cart);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});


describe('Evaluación real oficina — referencias de precio y contexto narrativo',()=>{
 const menu=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-alternate-menu.json'),'utf8'));
 const recorded=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-recorded-office-output.json'),'utf8'));
 it.each(['Hola! somos varios en la oficina:','Buenas, somos varias en el taller:','Somos seis en la reunión:'])('no ofrece el contexto como platos: %s',async(prefix)=>{
  const h=harness(menu,true);h.service.ordersService.create=jest.fn();h.agent.runTurn.mockResolvedValue(recorded.agentResult);
  const reply=await h.sendQueued(prefix+' para Lina van 2 bowls andinos, para Oscar un trio de wraps y para la reunion tres limonadas de hierbabuena. Eso es todo por ahora, gracias.');
  expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:501,qty:2}),expect.objectContaining({id:504,qty:1}),expect.objectContaining({id:503,qty:3})]));expect(h.cartRows()).toHaveLength(3);
  expect(reply||'').not.toMatch(/no tenemos|no manejamos/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 for(const agent of [false,true])for(const family of ['Bowl','Wrap'])for(const query of ['Cuánto cuesta cada','Qué precio tiene el']){
  it('consulta '+family+' '+query+' agente='+agent,async()=>{
   const fixture=[{id:27901,code:27901,name:family+' De Setas',price:18700,availableNow:true,hasAttributes:false,attributes:[]},{id:27902,code:27902,name:'Agua Mineral',price:6000,availableNow:true,hasAttributes:false,attributes:[]}];
   const h=harness(fixture as typeof products,agent);h.service.ordersService.create=jest.fn();h.conv.state='awaiting_payment';
   h.conv.sessionData={cart:fixture.map(p=>({productId:p.id,name:p.name,code:p.code,unitPrice:p.price,quantity:2,attributes:[]})),orderType:'delivery',address:'Calle 12 34 56',addressConfirmed:true};const before=structuredClone(h.conv.sessionData);
   const reply=await h.sendQueued(query+' '+family.toLowerCase()+'?');
   expect(reply||'').toContain('18.700');expect(reply||'').toMatch(/cómo pagas|como pagas|método de pago/i);expect(h.conv.sessionData).toEqual(before);expect(h.conv.state).toBe('awaiting_payment');expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
 }
 it.each([false,true])('dos bowls no elige primero, cotiza ambos sin mutar agente=%s',async(agent)=>{
  const fixture=['Bowl De Setas','Bowl De Quinoa','Agua Mineral'].map((name,i)=>({id:27911+i,code:27911+i,name,price:18000+i*1000,availableNow:true,hasAttributes:false,attributes:[]}));
  const h=harness(fixture as typeof products,agent);h.conv.sessionData.cart=fixture.map(p=>({productId:p.id,name:p.name,code:p.code,unitPrice:p.price,quantity:1,attributes:[]}));const before=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued('Cuánto cuesta cada bowl?');expect(reply||'').toMatch(/Bowl De Setas:.*18.000/);expect(reply||'').toMatch(/Bowl De Quinoa:.*19.000/);expect(h.conv.sessionData.cart).toEqual(before);
 });
 it('un producto ajeno después del contexto conserva el aviso y no lo compra',async()=>{
  const h=harness(menu,true);h.agent.runTurn.mockResolvedValue(recorded.agentResult);
  const reply=await h.sendQueued('Hola! somos varios en la oficina: para Lina van 2 bowls andinos, para Oscar un trio de wraps y para la reunion tres limonadas de hierbabuena y un detergente.');
  expect(reply||'').toMatch(/detergente/i);expect(h.cartRows().map(r=>r.id).sort()).toEqual([501,503,504]);
 });
});


describe('Contrato de turno — replays capturados y consulta intercalada',()=>{
 it.each(['office','narrative'])('conserva propuesta, etapas y resultado del replay %s',async(kind)=>{
  const filename=kind==='office'?'whatsapp-recorded-office-output.json':'whatsapp-recorded-narrative-output.json';
  const recorded=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/'+filename),'utf8'));
  const menu=kind==='office'?JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-alternate-menu.json'),'utf8')):products;
  const h=harness(menu,true);h.service.ordersService.create=jest.fn();
  h.agent.runTurn.mockResolvedValue(recorded.agentResult);
  await h.sendQueued(recorded.userMessage);
  const decisions=h.service.turnTelemetry.getRecentDecisions(1);expect(decisions).toHaveLength(1);
  const decision=decisions[0];expect(decision.failed).toBe(false);
  expect(decision.stages.map(stage=>stage.stage)).toEqual(['proposed','catalog_validated','reconciled','prepared']);
  const wanted=recorded.agentResult.actions.addItems.map(item=>({productId:item.productId,quantity:item.quantity})).sort((a,b)=>a.productId-b.productId);
  expect(decision.observedUnitDelta).toEqual(wanted);
  expect(decision.unitComparison.status).toBe('matches');
  expect(h.cartRows().map(row=>({productId:row.id,quantity:row.qty})).sort((a,b)=>a.productId-b.productId)).toEqual(wanted);
  const previous=structuredClone(h.conv.sessionData.cart);const modelCalls=h.agent.runTurn.mock.calls.length;
  const reply=await h.sendQueued(kind==='office'?'Cuánto cuesta cada bowl?':'Cuánto cuesta el churrasco?');
  const inquiry=h.service.turnTelemetry.getRecentDecisions(1)[0];
  expect(inquiry.before.cart).toEqual(inquiry.after.cart);expect(inquiry.observedUnitDelta).toEqual([]);
  expect(inquiry.stages).toEqual([]);expect(h.conv.sessionData.cart).toEqual(previous);
  expect(inquiry.inquiries).toEqual([{kind:'price',productIds:[kind==='office'?501:17]}]);
  expect(h.agent.runTurn.mock.calls.length).toBe(modelCalls);expect(reply||'').toMatch(/18.700|38.000/);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it('un diagnóstico roto no rompe una respuesta válida',async()=>{
  const h=harness(products,false);h.service.turnTelemetry.recordDecision=()=>{throw Error('diagnostic failed');};
  const reply=await h.sendQueued('Quiero una limonada natural');
  expect(h.cartRows()).toHaveLength(1);expect(reply||'').toMatch(/Limonada Natural/i);
 });
 it('registra el error del turno sin sustituirlo',async()=>{
  const h=harness(products,false);const error=new Error('original turn failure');
  h.service.handleIncomingTurn=async(_msg,turn)=>{turn.conv=h.conv;const {beginTurnDecision}=require('./whatsapp-turn-decision');turn.decision=beginTurnDecision(h.conv.state,h.conv.sessionData);throw error;};
  await expect(h.sendQueued('mensaje')).rejects.toBe(error);
  expect(h.service.turnTelemetry.getRecentDecisions(1)[0].failed).toBe(true);
 });
});


describe('Herramientas de compra rechazadas — no reconstruir un pedido distinto',()=>{
 const menu=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-alternate-menu.json'),'utf8'));
 const scenario=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-contract-independent-office-1410.json'),'utf8'))[0];
 for(const preexisting of [false,true])for(const error of [undefined,'exception','max_iterations'])it('rechazo total conserva carrito previo='+preexisting+' error='+error,async()=>{
  const h=harness(menu,true);h.service.ordersService.create=jest.fn();
  if(preexisting)h.conv.sessionData.cart=[{productId:503,code:503,name:menu.find(p=>p.id===503).name,unitPrice:6800,quantity:2,attributes:[],note:'sin azúcar'}];
  const before=structuredClone(h.conv.sessionData.cart);
  h.agent.runTurn.mockResolvedValue({reply:'Por ahora no manejamos cada ni pero',actions:{},toolCalls:['add_item','add_item','add_item'],error,
   purchaseAttempts:[{productId:501,accepted:false,reason:'dish_not_on_menu'},{productId:502,accepted:false,reason:'dish_not_on_menu'},{productId:502,accepted:false,reason:'dish_not_on_menu'}]});
  const reply=await h.sendQueued(scenario.messages[0].text);
  expect(h.agent.runTurn).toHaveBeenCalledTimes(1);expect(h.conv.sessionData.cart).toEqual(before);
  expect(h.conv.state).toBe('building_cart');expect(reply||'').toMatch(/necesito aclarar/i);expect(reply||'').toMatch(/Bowl Andino/);expect(reply||'').toMatch(/Wrap Vegetariano/);
  expect(reply||'').not.toMatch(/no manejamos|cada ni pero|Listo|agregu[eé]/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  expect(h.service.turnTelemetry.getRecentDecisions(1)[0].observedUnitDelta).toEqual([]);
 });
});


describe('Pedido mixto — condición de disponibilidad no bloquea la compra',()=>{
 it('conserva platos reconocidos, informa el ausente y aplica una nota solo al wrap',async()=>{
  const menu=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-alternate-menu.json'),'utf8'));
  const scenario=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-next-mixed-orders-1510.json'),'utf8'))[0];
  const h=harness(menu,true);h.service.ordersService.create=jest.fn();
  h.service.agentService=new WhatsappAgentService({getEffectiveConfig:async()=>({openaiApiKey:'offline-key',openaiModel:'gpt-4.1-2025-04-14',systemPrompt:'',localContext:{}})} as never,h.service.catalogService);
  const response=(message:unknown)=>({ok:true,json:async()=>({choices:[{message}]})});
  const args=[{productId:501,quantity:2},{productId:502,quantity:1,attributes:[{attributeName:'Salsa',attributeValue:'Yogur'}]}];
  const original=globalThis.fetch;const fetchMock=jest.fn().mockResolvedValueOnce(response({content:null,tool_calls:args.map((arg,index)=>({id:'mixed-'+index,type:'function',function:{name:'add_item',arguments:JSON.stringify(arg)}}))}))
   .mockResolvedValueOnce(response({content:'No tenemos brownie. Agregué los platos disponibles.'}))
   .mockResolvedValueOnce(response({content:null,tool_calls:[{id:'scoped-note',type:'function',function:{name:'update_item',arguments:JSON.stringify({productId:502,cartLineIndex:1,note:'sin cebolla'})}}]}))
   .mockResolvedValueOnce(response({content:'Listo, el wrap sin cebolla; los bowls siguen normales.'}));globalThis.fetch=fetchMock;
  try{
   const reply=await h.sendQueued(scenario.messages[0].text);expect(fetchMock).toHaveBeenCalledTimes(2);
   expect(h.cartRows()).toEqual([expect.objectContaining({id:501,qty:2}),expect.objectContaining({id:502,qty:1,attrs:['Salsa:Yogur']})]);
   expect(reply||'').toMatch(/no tenemos brownie/i);expect(h.conv.state).toBe('building_cart');
   await h.sendQueued(scenario.messages[1].text);expect(fetchMock).toHaveBeenCalledTimes(4);
   expect(h.cartRows().find(row=>row.id===501)).toEqual(expect.objectContaining({qty:2}));
   expect(h.cartRows().find(row=>row.id===501)?.note||'').not.toMatch(/cebolla/i);
   expect(h.cartRows().find(row=>row.id===502)).toEqual(expect.objectContaining({qty:1,attrs:['Salsa:Yogur'],note:expect.stringMatching(/sin cebolla/i)}));
   expect(h.service.ordersService.create).not.toHaveBeenCalled();
  }finally{globalThis.fetch=original;}
 });
});

describe('Interrupción de precio con preámbulo conserva referencia y pedido',()=>{
 for(const prefix of ['Antes de seguir,','Antes de continuar,','Tengo una duda,','Disculpa,']) {
  it.each([
   {kind:'PPP',menu:products,ids:[71,38],family:'sopa',target:38,price:'10.500'},
   {kind:'otra carta',menu:JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-alternate-menu.json'),'utf8')),ids:[505,501],family:'bowl',target:501,price:'18.700'}
  ])(prefix+' $kind responde precio de familia sin volver a preguntar',async({menu,ids,family,price})=>{
   const h=harness(menu,false);
   h.conv.sessionData.cart=ids.map(id=>{const p=menu.find(p=>p.id===id)!;return {productId:p.id,name:p.name,code:p.code,quantity:2,unitPrice:p.price,attributes:[]};});
   const before=JSON.stringify(h.conv.sessionData.cart);
   const reply=await h.sendQueued(`${prefix} cuánto vale cada ${family}?`);
   expect(reply).toContain(price);expect(reply).not.toMatch(/de cu[aá]l producto/i);
   expect(JSON.stringify(h.conv.sessionData.cart)).toBe(before);expect(h.conv.sessionData.pendingPriceInquiry).toBeUndefined();
  });
 }
});

describe('Sol real — continuación tras el tope del ensayo, sin más inferencia',()=>{
 it('conserva unidades y notas capturadas, responde total y corrige cantidad',async()=>{
  const menu=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-sol-office-menu-1510.json'),'utf8'));
  const scenario=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-sol-office-cases-1510.json'),'utf8'))[0];
  const captured=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-sol-office-conditional-capture-1510.json'),'utf8')).results[0].turns[0];
  const h=harness(menu,true);h.service.ordersService.create=jest.fn();
  h.agent.runTurn.mockResolvedValueOnce({...captured.agentResults[0],error:'exception'}).mockResolvedValueOnce({reply:'Listo, quedan dos tés en total.',actions:{updateCartLines:[{productId:8815,cartLineIndex:2,quantity:2}]},toolCalls:['update_item']});
  await h.sendQueued(scenario.messages[0].text);
  expect(h.cartRows()).toEqual([expect.objectContaining({id:8813,qty:1,note:expect.stringMatching(/sin cebolla/i)}),expect.objectContaining({id:8814,qty:2}),expect.objectContaining({id:8815,qty:3,note:expect.stringMatching(/sin az[uú]car/i)})]);
  expect(h.replies.at(-1)).toMatch(/interrumpi[oó]|guardados/i);
  await h.sendQueued(scenario.messages[1].text);expect(h.replies.at(-1)).toContain('80.000');
  await h.sendQueued(scenario.messages[2].text);expect(h.cartRows().find(row=>row.id===8815)).toMatchObject({qty:2,note:expect.stringMatching(/sin az[uú]car/i)});
  expect(h.cartRows().find(row=>row.id===8813)).toMatchObject({qty:1,note:expect.stringMatching(/sin cebolla/i)});
  await h.sendQueued(scenario.messages[3].text);expect(h.replies.at(-1)).toContain('75.000');
  expect(h.agent.runTurn).toHaveBeenCalledTimes(2);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});

describe('Total con envío — alcance de consulta sin compras hipotéticas',()=>{
 it.each(['Cuál es el total con domicilio?','Cuánto es el total incluyendo el envío?','Cuál es el total por favor','Y cuánto sería el total con el domicilio?'])('reconoce %s',text=>expect(isCartChargeQuestion(text)).toBe(true));
 it.each(['Cuál es el total si agrego un combo?','Cuál es el total con domicilio y agrega dos jugos','Cuánto sale el total de un combo?','El total con papas cuesta más?'])('no consume otra intención: %s',text=>expect(isCartChargeQuestion(text)).toBe(false));
});

describe('Errores de escritura en la carta o del cliente — el plato que sí existe', () => {
 const pizzas=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-pizza-menu-1510.json'),'utf8'));
 const typoMenu = [
  {id:9501,code:9501,name:'Lomo Saltedo',description:'Lomo de res, cebolla, tomate y papas',price:22000,availableNow:true,hasAttributes:false,attributes:[]},
  {id:9502,code:9502,name:'Perro Caliente',description:'Salchicha americana',price:12000,availableNow:true,hasAttributes:false,attributes:[]},
 ];
 const cases: Array<[string, any[], string, number, number]> = [
  ['PPP', products, 'quiero una milanesa', 62, 1],
  ['PPP', products, 'una milanesa de pollo', 62, 1],
  ['PPP', products, '2 milanesas', 62, 2],
  ['pizzería', pizzas, 'una lasagna boloñesa', 9305, 1],
  ['ficticio', typoMenu, 'quiero un lomo saltado', 9501, 1],
 ];
 for (const agent of [false, true]) {
  it.each(cases.map(([label, menu, text, id, qty]) => [`${label}: ${text}`, menu, text, id, qty] as const))(`agente ${agent ? 'on' : 'off'} %s`, async (_title, menu, text, id, qty) => {
   const h = harness(menu, agent);
   await h.sendQueued(text);
   expect(h.cartRows()).toEqual([expect.objectContaining({id, qty})]);
  });
  it(`PPP agente ${agent ? 'on' : 'off'}: milanesa junto a otro plato no se reporta como faltante`, async () => {
   const h = harness(products, agent);
   const reply = await h.sendQueued('dame una milanesa y un arroz chino');
   expect(h.cartRows().map(row => row.id).sort((a, b) => a - b)).toEqual([26, 62]);
   expect(reply).not.toMatch(/no manejamos/i);
  });
 }
 it('solo corrige palabras largas con una única palabra cercana en la carta', () => {
  const catalog = new WhatsappCatalogService({} as never);
  expect(catalog.alignMenuSpelling('cuanto cuesta, gracias por favor', products)).toBe('cuanto cuesta, gracias por favor');
  expect(catalog.alignMenuSpelling('quiero una pizza margarita', pizzas)).toBe('quiero una pizza margarita');
  expect(catalog.alignMenuSpelling('un pollo broster', products)).toBe('un pollo broaster');
  expect(catalog.alignMenuSpelling('bien empacado, a Almacén Metro Bandera', products)).toBe('bien empacado, a Almacén Metro Bandera');
  expect(catalog.alignMenuSpelling('las empanadas bien empacados', pizzas)).toBe('las empanadas bien empacados');
  const twins = [{...typoMenu[0], name:'Costilla Ahumada'}, {...typoMenu[1], name:'Costella Picante'}];
  expect(catalog.alignMenuSpelling('quiero costilla', twins)).toBe('quiero costilla');
  expect(catalog.alignMenuSpelling('quiero costalla', twins)).toBe('quiero costalla');
 });
});

describe('Carta incompleta — descripción desconocida no significa producto inexistente',()=>{
 for(const name of ['Bowl De Lentejas','Pasta De Hongos'])for(const agent of [false,true])for(const state of ['building_cart','awaiting_payment','awaiting_name','awaiting_phone','awaiting_address','awaiting_final_confirm']){
  it(name+' '+state+' agent='+agent,async()=>{
   const menu=[{id:9701,code:9701,name,description:'',price:21000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Agua','Limonada']}] }];
   const h=harness(menu,agent);h.conv.state=state;h.conv.customerName=state==='awaiting_name'?'':'Ana';
   h.conv.sessionData={cart:[{productId:9701,name,code:9701,unitPrice:21000,quantity:2,note:'bolsa aparte',attributes:[{attributeName:'Bebida',attributeValue:'Agua'}]}],productFocus:{productId:9701,name},orderType:'delivery',address:'Calle 12 30 45',addressConfirmed:true};
   const before=structuredClone(h.conv.sessionData.cart);
   const reply=await h.send('Qué trae '+name+'?');
   expect(reply).toMatch(/no.*(?:detalle|detalla|confirmad|registrad)/i);expect(reply).not.toMatch(/no tenemos|no manejamos|no lo trae/i);
   expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.state).toBe(state);expect(h.conv.customerName).toBe(state==='awaiting_name'?'':'Ana');
  });
 }
});

describe('Referencia al plato — ingrediente vendible no cambia el sujeto',()=>{
 it.each([false,true])('salsa vendible agent=%s',async agent=>{
  const menu=[{id:9821,code:9821,name:'Bowl De Lentejas',description:'Con arroz',price:21000,availableNow:true,hasAttributes:false,attributes:[]},{id:9822,code:9822,name:'Salsa De Ajo',description:'Porción adicional',price:3000,availableNow:true,hasAttributes:false,attributes:[]}];
  const h=harness(menu,agent);h.conv.state='awaiting_payment';h.conv.customerName='Ana';h.conv.sessionData={cart:[{productId:9821,name:menu[0].name,code:9821,unitPrice:21000,quantity:1,attributes:[]}],productFocus:{productId:9821,name:menu[0].name},orderType:'delivery',address:'Calle 12 30 45',addressConfirmed:true};
  const reply=await h.send('Y ese trae salsa de ajo?');expect(reply).toContain('Bowl De Lentejas');expect(reply).toMatch(/no tengo ese detalle confirmado/i);expect(reply).not.toMatch(/Porción adicional|\$3\.000/i);expect(h.cartRows()).toHaveLength(1);expect(h.conv.state).toBe('awaiting_payment');
 });
 it.each([false,true])('el otro pasa a ser referencia actual agent=%s',async agent=>{
  const menu=[{id:9831,code:9831,name:'Bowl De Lentejas',description:'Con arroz',price:21000,availableNow:true,hasAttributes:false,attributes:[]},{id:9832,code:9832,name:'Pasta De Hongos',description:'Sin salsa de ajo',price:23000,availableNow:true,hasAttributes:false,attributes:[]}];
  const h=harness(menu,agent);h.conv.state='awaiting_payment';h.conv.customerName='Ana';h.conv.sessionData={cart:menu.map(p=>({productId:p.id,name:p.name,code:p.code,unitPrice:p.price,quantity:1,attributes:[]})),productFocus:{productId:9831,name:menu[0].name},orderType:'delivery',address:'Calle 12 30 45',addressConfirmed:true};
  await h.send('El otro trae salsa de ajo?');const reply=await h.send('Y ese incluye queso?');expect(reply).toContain('Pasta De Hongos');expect(reply).not.toContain('Bowl De Lentejas');expect(reply).toMatch(/no tengo ese detalle confirmado/i);expect(h.cartRows()).toHaveLength(2);expect(h.conv.state).toBe('awaiting_payment');
 });
});

describe('Reemplazo pendiente de dirección — atomicidad y aclaraciones', () => {
  for (const f of [
    { id: 20501, old: 'Pizza De Setas', next: 'Pizza Margarita', side: 'Agua Mineral' },
    { id: 20511, old: 'Ramen De Miso', next: 'Ramen De Shoyu', side: 'Te Verde' },
  ]) for (const agent of [false, true]) {
    const seed = (opts = { unavailable: false, duplicate: false }) => {
      const menu = [f.old, f.next, f.side].map((name, index) => ({ id: f.id + index, code: f.id + index, name,
        price: index === 0 ? 24000 : index === 1 ? 22000 : 5000, availableNow: !(opts.unavailable && index === 1), hasAttributes: false, attributes: [] }));
      const h = harness(menu, agent);
      h.conv.state = 'awaiting_address';
      h.service.ordersService.create = jest.fn();
      Object.assign(h.conv.sessionData, { orderType: 'delivery', address: undefined, addressConfirmed: false,
        cart: [menu[0], ...(opts.duplicate ? [menu[0]] : []), menu[2]].map((p, index) => ({
          productId: p.id, code: p.code, name: p.name, unitPrice: p.price, quantity: index ? 1 : 3,
          note: index ? 'sin sal' : 'sin cebolla', attributes: [] })) });
      return h;
    };
    it.each(['desconocido', 'agotado', 'consulta', 'condicionado'])(`${f.old}, agente ${agent}, %s conserva carrito`, async kind => {
      const h = seed({ unavailable: kind === 'agotado', duplicate: false });
      const before = structuredClone(h.conv.sessionData.cart);
      const text = kind === 'desconocido' ? `Cambia ${f.old} por Platillo Inventado`
        : kind === 'consulta' ? `¿Puedo cambiar ${f.old} por ${f.next}?`
        : kind === 'condicionado' ? `Cambia ${f.old} por ${f.next} solo si no cuesta más`
        : `Cambia ${f.old} por ${f.next}`;
      await h.sendQueued(text);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.state).toBe('awaiting_address');
      expect(h.conv.sessionData.address).toBeUndefined();
      expect(h.replies.at(-1)).toMatch(/dirección/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
    it.each(['implícita', 'dos', 'una'])(`${f.old}, agente ${agent}, cantidad %s`, async kind => {
      const h = seed();
      const side = structuredClone(h.conv.sessionData.cart[1]);
      await h.sendQueued(`Cambia ${f.old} por ${kind === 'dos' ? 'dos ' : kind === 'una' ? 'una ' : ''}${f.next}`);
      expect(h.conv.sessionData.cart[1]).toEqual(side);
      expect(h.conv.sessionData.cart[0]).toMatchObject({ productId: f.id + 1, unitPrice: 22000,
        quantity: kind === 'dos' ? 2 : kind === 'una' ? 1 : 3, note: 'sin cebolla' });
      expect(h.conv.state).toBe('awaiting_address');
      expect(h.replies.at(-1)).toMatch(/dirección/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
    it.each(['elige', 'cancela', 'desactualizada'])(`${f.old}, agente ${agent}, línea ambigua %s`, async kind => {
      const h = seed({ unavailable: false, duplicate: true });
      const before = structuredClone(h.conv.sessionData.cart);
      await h.sendQueued(`Cambia ${f.old} por ${f.next}`);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.pendingCartReplacement?.options).toHaveLength(2);
      expect(h.conv.state).toBe('awaiting_address');
      if (kind === 'desactualizada') h.conv.sessionData.cart[0].quantity = 4;
      await h.sendQueued(kind === 'cancela' ? 'Cancela ese cambio' : '2');
      if (kind === 'elige') {
        expect(h.conv.sessionData.cart[0]).toEqual(before[0]);
        expect(h.conv.sessionData.cart[1]).toMatchObject({ productId: f.id + 1, quantity: 1 });
        expect(h.conv.sessionData.cart[2]).toEqual(before[2]);
      } else if (kind === 'cancela') expect(h.conv.sessionData.cart).toEqual(before);
      else expect(h.conv.sessionData.cart).toEqual([{ ...before[0], quantity: 4 }, ...before.slice(1)]);
      expect(h.conv.sessionData.pendingCartReplacement).toBeUndefined();
      expect(h.conv.sessionData.address).toBeUndefined();
      expect(h.conv.sessionData.paymentMethod).toBeUndefined();
      expect(h.conv.state).toBe('awaiting_address');
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
  }
});

describe('Prioridad de aclaraciones — orden inverso, consultas y sesiones antiguas', () => {
  for (const f of [
    { id: 21101, old: 'Pizza De Setas', next: 'Pizza Margarita', side: 'Bowl De Tofu', attr: 'Salsa', first: 'Soja', last: 'Teriyaki' },
    { id: 21111, old: 'Ramen De Miso', next: 'Ramen De Shoyu', side: 'Combo De Falafel', attr: 'Bebida', first: 'Te', last: 'Agua' },
  ]) for (const agent of [false, true]) for (const state of ['awaiting_address', 'awaiting_payment']) {
    const seed = () => {
      const menu = [f.old, f.next, f.side].map((name, index) => ({ id: f.id + index, code: f.id + index, name,
        price: index === 2 ? 12000 : 22000, availableNow: true, hasAttributes: index === 2,
        attributes: index === 2 ? [{ attributeName: f.attr, options: [f.first, f.last] }] : [] }));
      const h = harness(menu, agent);
      h.conv.state = state;
      h.service.ordersService.create = jest.fn();
      Object.assign(h.conv.sessionData, { orderType: 'delivery', address: state === 'awaiting_payment' ? 'Calle 12 30 45' : undefined,
        addressConfirmed: state === 'awaiting_payment', deliveryFeeCalculated: state === 'awaiting_payment' ? 3000 : null,
        cart: [menu[0], menu[0], menu[2], menu[2]].map((p, index) => ({ productId: p.id, code: p.code, name: p.name,
          unitPrice: p.price, quantity: index % 2 ? 1 : 3, note: index % 2 ? 'sin sal' : 'sin cebolla',
          attributes: p.hasAttributes ? [{ attributeName: f.attr, attributeValue: f.first }] : [] })) });
      return h;
    };
    for (const kind of ['cantidad', 'atributo', 'eliminación']) {
      it(`${f.old}, agente ${agent}, ${state}, primero ${kind} luego reemplazo`, async () => {
        const h = seed();
        const before = structuredClone(h.conv.sessionData.cart);
        await h.sendQueued(kind === 'cantidad' ? `Deja solo dos ${f.side}` : kind === 'atributo' ? `Cambia ${f.attr} a ${f.last}` : `Quita el ${f.side}`);
        const key = kind === 'cantidad' ? 'pendingCartQuantity' : kind === 'atributo' ? 'pendingCartAttributeEdit' : 'pendingCartRemoval';
        expect(h.conv.sessionData[key]).toBeTruthy();
        await h.sendQueued(`Cambia ${f.old} por ${f.next}`);
        expect(h.conv.sessionData.cart).toEqual(before);
        expect(h.conv.sessionData[key]).toBeUndefined();
        expect(h.conv.sessionData.pendingCartReplacement?.options).toHaveLength(2);
        expect(h.replies.at(-1)).toMatch(/selección anterior.*sin aplicar/is);
        await h.sendQueued('2');
        expect(h.conv.sessionData.cart[0]).toEqual(before[0]);
        expect(h.conv.sessionData.cart[1]).toMatchObject({ productId: f.id + 1, quantity: 1, note: 'sin sal' });
        expect(h.conv.sessionData.cart.slice(2)).toEqual(before.slice(2));
        expect(h.conv.sessionData.paymentMethod).toBeUndefined();
        expect(h.conv.state).toBe(state);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
      });
    }
    it(`${f.old}, agente ${agent}, ${state}, consulta no abre lista nueva`, async () => {
      const h = seed();
      const before = structuredClone(h.conv.sessionData.cart);
      await h.sendQueued(`Cambia ${f.old} por ${f.next}`);
      const pending = structuredClone(h.conv.sessionData.pendingCartReplacement);
      await h.sendQueued('¿Cuánto vale el domicilio?');
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.pendingCartReplacement).toEqual(pending);
      expect(h.replies.at(-1)).not.toMatch(/anterior.*sin aplicar/is);
      await h.sendQueued('2');
      expect(h.conv.sessionData.cart[0]).toEqual(before[0]);
      expect(h.conv.sessionData.cart[1]).toMatchObject({ productId: f.id + 1, quantity: 1 });
      expect(h.conv.sessionData.cart.slice(2)).toEqual(before.slice(2));
      expect(h.conv.state).toBe(state);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
    it(`${f.old}, agente ${agent}, ${state}, dos listas guardadas requieren instrucción nueva`, async () => {
      const h = seed();
      const before = structuredClone(h.conv.sessionData.cart);
      await h.sendQueued(`Cambia ${f.old} por ${f.next}`);
      const prior = structuredClone(h.conv.sessionData.pendingCartReplacement);
      await h.sendQueued(`Deja solo dos ${f.side}`);
      h.conv.sessionData.pendingCartReplacement = prior; // persisted legacy overlap, no reliable chronological owner
      const both = structuredClone(h.conv.sessionData);
      await h.sendQueued('2');
      expect(h.conv.sessionData).toEqual(both);
      expect(h.replies.at(-1)).toMatch(/más de una selección pendiente/i);
      await h.sendQueued(`Deja solo dos ${f.side}`);
      expect(h.conv.sessionData.pendingCartReplacement).toBeUndefined();
      expect(h.conv.sessionData.pendingCartQuantity?.options).toHaveLength(2);
      await h.sendQueued('2');
      expect(h.conv.sessionData.cart.slice(0, 3)).toEqual(before.slice(0, 3));
      expect(h.conv.sessionData.cart[3]).toEqual({ ...before[3], quantity: 2 });
      expect(h.conv.state).toBe(state);
      expect(h.conv.sessionData.paymentMethod).toBeUndefined();
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
  }
});


describe('side swap across every dish in the cart', () => {
  const line = (id: number, name: string, qty = 1, attributes: any[] = []) =>
    ({ productId: id, code: id, name, unitPrice: 30000, quantity: qty, attributes });
  const pppCart = () => [line(14, 'Mojarra', 2, [{ attributeName: 'Seleccion', attributeValue: 'Frita' }]), line(17, 'Churrasco'),
    line(35, 'Arroz Paisa'), line(76, 'Hamburguesa Clasica', 1, [{ attributeName: 'Bebida', attributeValue: 'Coca Cola' }])];
  const fictional = [
    { id: 31301, code: 31301, name: 'Trucha', price: 32000, availableNow: true, hasAttributes: false, description: 'Con arroz, ensalada y papa', attributes: [] },
    { id: 31302, code: 31302, name: 'Lomo Fino', price: 36000, availableNow: true, hasAttributes: false, description: 'Con papa y ensalada', attributes: [] },
    { id: 31303, code: 31303, name: 'Perro Caliente', price: 15000, availableNow: true, hasAttributes: false, description: 'Con papas', attributes: [] },
    { id: 31304, code: 31304, name: 'Porcion De Platano', price: 5000, availableNow: true, hasAttributes: false, attributes: [] },
  ];
  const fictionalCart = () => [line(31301, 'Trucha'), line(31302, 'Lomo Fino', 2), line(31303, 'Perro Caliente')];
  for (const enabled of [true, false]) {
    it(`PPP original conversation never adds a dish, agent ${enabled}`, async () => {
      const h = harness(products, enabled);
      h.conv.sessionData.cart = [...pppCart(), line(95, 'Coca Cola 1.5L', 1, [{ attributeName: 'sabor', attributeValue: 'Original' }])] as any;
      await h.sendQueued('Por favor me cambiar la ensalada por yuca en todos los Platos');
      expect(h.cartRows().map((r: any) => r.id)).toEqual([14, 17, 35, 76, 95]);
      expect(h.replies.join(' ')).toMatch(/Mojarra\* ×2 y \*Churrasco/);
      expect(h.replies.join(' ')).toMatch(/3 porciones/);
      await h.sendQueued('si');
      expect(h.cartRows()).toEqual([
        expect.objectContaining({ id: 14, qty: 2, note: 'Sin ensalada' }),
        expect.objectContaining({ id: 17, qty: 1, note: 'Sin ensalada' }),
        expect.objectContaining({ id: 35, note: undefined }),
        expect.objectContaining({ id: 76, note: undefined }),
        expect.objectContaining({ id: 95 }),
        expect.objectContaining({ id: 7, qty: 3 }),
      ]);
    });
    it(`PPP several dishes and no scope asks which one, agent ${enabled}`, async () => {
      const h = harness(products, enabled);
      h.conv.sessionData.cart = pppCart() as any;
      await h.sendQueued('cámbiame la ensalada por yuca');
      expect(h.cartRows().map((r: any) => [r.id, r.note])).toEqual([[14, undefined], [17, undefined], [35, undefined], [76, undefined]]);
      expect(h.replies.join(' ')).toMatch(/¿En cuál plato/);
    });
    it(`PPP naming one dish changes only that line, agent ${enabled}`, async () => {
      const h = harness(products, enabled);
      h.conv.sessionData.cart = pppCart() as any;
      await h.sendQueued('cámbiale la ensalada al churrasco por yuca');
      await h.sendQueued('si');
      expect(h.cartRows().map((r: any) => [r.id, r.qty, r.note])).toEqual(
        [[14, 2, undefined], [17, 1, 'Sin ensalada'], [35, 1, undefined], [76, 1, undefined], [7, 1, undefined]]);
    });
    it(`fictional every dish swap, decline and the suggested wording, agent ${enabled}`, async () => {
      const h = harness(fictional as any, enabled);
      h.conv.sessionData.cart = fictionalCart() as any;
      await h.sendQueued('a todos los platos cambiarles la ensalada por platano');
      expect(h.replies.join(' ')).toMatch(/Trucha\* y \*Lomo Fino\* ×2/);
      await h.sendQueued('no');
      expect(h.cartRows().map((r: any) => [r.id, r.note])).toEqual([[31301, undefined], [31302, undefined], [31303, undefined]]);
      const g = harness(fictional as any, enabled);
      g.conv.sessionData.cart = fictionalCart() as any;
      await g.sendQueued('cámbiale ensalada por platano en todos los platos');
      await g.sendQueued('si');
      expect(g.cartRows().map((r: any) => [r.id, r.qty, r.note])).toEqual(
        [[31301, 1, 'Sin ensalada'], [31302, 2, 'Sin ensalada'], [31303, 1, undefined], [31304, 3, undefined]]);
    });
    it(`PPP new dish with a swap is still an order, agent ${enabled}`, async () => {
      const h = harness(products, enabled);
      h.conv.sessionData.cart = [line(35, 'Arroz Paisa')] as any;
      await h.sendQueued('un churrasco pero cámbiame la ensalada por yuca');
      expect(h.cartRows()).toEqual([expect.objectContaining({ id: 35 }), expect.objectContaining({ id: 17, qty: 1 })]);
    });
  }
});

describe('a drink ordered "aparte" and a handling note sent after the dish', () => {
  const fictional = [
    { id: 32101, code: 32101, name: 'Almuerzo Con Res', price: 22000, availableNow: true, hasAttributes: true,
      attributes: [{ attributeName: 'Bebida', options: ['Agua Panela', 'Jugo De Mora'] }] },
    { id: 32102, code: 32102, name: 'Jugo De Mora', price: 6000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 32103, code: 32103, name: 'Trucha', price: 28000, availableNow: true, hasAttributes: true,
      attributes: [{ attributeName: 'Preparacion', options: ['Frita', 'Al Ajillo'] }] },
  ];
  const menus = [
    { label: 'PPP', menu: products, lunch: 'un ejecutivo con pollo frito', lunchId: 22, drinkAttr: 'Bebida:Colombiana', drink: 'una limonada', drinkId: 37, dish: 'un bagre frito', dishId: 19 },
    { label: 'fictional', menu: fictional, lunch: 'un almuerzo con res', lunchId: 32101, drinkAttr: 'Bebida:Agua Panela', drink: 'un jugo de mora', drinkId: 32102, dish: 'una trucha frita', dishId: 32103 },
  ];
  for (const enabled of [false, true]) for (const m of menus) {
    it(`${m.label} "<lunch> y a parte <drink>" keeps the included drink, agent ${enabled}`, async () => {
      const h = harness(m.menu as any, enabled);
      await h.sendQueued(`${m.lunch} y a parte ${m.drink}`);
      expect(h.cartRows()).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: m.lunchId, attrs: expect.arrayContaining([m.drinkAttr]) }),
        expect.objectContaining({ id: m.drinkId, qty: 1 })]));
    });
    it(`${m.label} a later "y a parte <drink>" adds it separately, agent ${enabled}`, async () => {
      const h = harness(m.menu as any, enabled);
      await h.sendQueued(m.lunch);
      const reply = await h.sendQueued(`y a parte ${m.drink}`);
      expect(h.cartRows()).toEqual([
        expect.objectContaining({ id: m.lunchId, attrs: expect.arrayContaining([m.drinkAttr]) }),
        expect.objectContaining({ id: m.drinkId, qty: 1 })]);
      expect(reply).not.toMatch(/No tenemos/i);
    });
    for (const [text, note] of [['No puedes dividido en dos cajas por favor', 'dividido en dos cajas'], ['¿me lo puedes mandar en dos cajas?', 'en dos cajas'],
      ['que venga bien tostado', 'bien tostado'], ['partirlo en dos porfa', 'partido en dos']] as const) {
      it(`${m.label} "${text}" notes the dish already ordered, agent ${enabled}`, async () => {
        const h = harness(m.menu as any, enabled);
        await h.sendQueued(m.dish);
        await h.sendQueued(text);
        expect(h.cartRows()).toEqual([expect.objectContaining({ id: m.dishId, qty: 1, note })]);
      });
    }
  }
});

describe('real staging chats: new address, only-count notes, related offers, packing remarks', () => {
  const fictional = [
    { id: 32201, code: 32201, name: 'Medio Pollo Asado', price: 24000, availableNow: true, hasAttributes: true,
      attributes: [{ attributeName: 'Arepas', options: ['Blancas', 'sin arepas'] }] },
    { id: 32202, code: 32202, name: 'Tilapia', price: 27000, availableNow: true, hasAttributes: true,
      attributes: [{ attributeName: 'Preparacion', options: ['Frita', 'Al Vapor'] }] },
    { id: 32203, code: 32203, name: 'Yuca Con Hogao', price: 7000, availableNow: true, hasAttributes: false, attributes: [] },
  ];
  const menus = [
    { label: 'PPP', menu: products, half: 'medio Pollo broaster', halfId: 5, fish: 'una mojarra', fishId: 14, missing: 'una pechuga apanada', related: 'Pechuga',
      side: 'platano maduro solo', sideName: 'Platano Con queso y Bocadillo', sideNote: 'platano maduro sin queso ni bicadillo', main: 'un cuarto de pollo frito', mainId: 6, dish: 'un bagre frito', dishId: 19 },
    { label: 'fictional', menu: fictional, half: 'medio pollo asado', halfId: 32201, fish: 'una tilapia', fishId: 32202, missing: 'una tilapia rellena de cangrejo', related: 'Tilapia',
      side: 'yuca sola', sideName: 'Yuca Con Hogao', sideNote: 'yuca sin hogao', main: 'medio pollo asado', mainId: 32201, dish: 'una tilapia frita', dishId: 32202 },
  ];
  for (const enabled of [false, true]) for (const m of menus) {
    it(`${m.label} "Quiero una Nueva" at the address prompt asks for the new address, agent ${enabled}`, async () => {
      const h = harness(m.menu as any, enabled);
      const product = (m.menu as any[]).find((p) => p.id === m.fishId);
      h.conv.sessionData.cart = [{ productId: product.id, code: product.id, name: product.name, unitPrice: product.price, quantity: 1, attributes: [] }] as any;
      Object.assign(h.conv.sessionData, { orderType: 'delivery', fulfillmentChosen: true, lastDeliveryAddress: 'Altavista' });
      h.conv.customerName = 'Yordan'; h.conv.state = 'awaiting_address';
      const reply = await h.sendQueued('Quiero una Nueva');
      expect(reply).not.toMatch(/no manejamos/i);
      expect(h.conv.sessionData.addressConfirmed).not.toBe(true);
      expect(h.conv.sessionData.address).not.toBe('Altavista');
    });
    it(`${m.label} "<half> sin arepas solo dos mieles" adds it with the note, agent ${enabled}`, async () => {
      const h = harness(m.menu as any, enabled);
      await h.sendQueued(`Hola buenas tardes me das ${m.half} sin arepas solo dos mieles`);
      expect(h.cartRows()).toEqual([expect.objectContaining({ id: m.halfId, qty: 1, note: expect.stringMatching(/solo dos mieles/i) })]);
    });
    it(`${m.label} a repeated condiment is noted once and the missing dish gets a related offer, agent ${enabled}`, async () => {
      const h = harness(m.menu as any, enabled);
      const reply = await h.sendQueued(`me das ${m.fish} con arto Limon y ${m.missing}`);
      const rows = h.cartRows();
      expect(rows).toEqual([expect.objectContaining({ id: m.fishId })]);
      expect(rows[0].note?.match(/lim[oó]n/gi)).toHaveLength(1);
      if (!enabled) expect(reply).toMatch(new RegExp(`S[ií] tenemos:.*${m.related}`, 'i'));
    });
    it(`${m.label} a missing side offers the related dish and its follow-up is not a note on another line, agent ${enabled}`, async () => {
      const h = harness(m.menu as any, enabled);
      await h.sendQueued(m.main);
      const before = h.cartRows();
      const offer = await h.sendQueued(`Y Dame Un ${m.side}`);
      if (!enabled) expect(offer).toContain(m.sideName);
      await h.sendQueued(`Me refiero a ${m.sideNote}`);
      expect(h.cartRows().filter((r: any) => r.id === m.mainId)).toEqual(before.filter((r: any) => r.id === m.mainId));
    });
    it(`${m.label} a packing remark with a typo and a payment aside notes the dish, agent ${enabled}`, async () => {
      const h = harness(m.menu as any, enabled);
      await h.sendQueued(m.dish);
      await h.sendQueued('No puedes dividido  en dos cahas Al empacar yo Pago Si hay algun excedente');
      expect(h.cartRows()).toEqual([expect.objectContaining({ id: m.dishId, qty: 1, note: expect.stringMatching(/^dividido en dos cajas al empacar/i) })]);
    });
  }
});

describe('basic complete ordering journeys revisited', () => {
  const menus=[
    {dish:'Crepe Relleno',attribute:'Bebida',options:['Hibisco','Jazmin'],side:'Porcion De Pan',sideRequest:'pan'},
    {dish:'Taco De Setas',attribute:'Salsa',options:['Suave','Picante'],side:'Porcion De Totopos',sideRequest:'totopos'},
  ];
  for(const config of menus) for(const fulfillment of ['pickup','delivery']) for(const enabled of [true,false]) {
    it(`${config.dish}, ${fulfillment}, agent ${enabled}`,async()=>{
      const menu=[{id:38101,code:38101,name:config.dish,price:18000,description:'Plato con acompañamiento incluido',availableNow:true,hasAttributes:true,attributes:[{attributeName:config.attribute,options:config.options}]},
        {id:38102,code:38102,name:config.side,price:6000,availableNow:true,hasAttributes:false,attributes:[]}];
      const h=harness(menu,enabled);
      Object.assign(h.conv.sessionData,{contactPhone:h.conv.phoneE164,phoneConfirmed:true});
      h.service.ordersService.create=jest.fn().mockResolvedValue({id:999,dailyOrderNumber:1});
      h.service.ensureDeliveryFeeQuoted=jest.fn(async(session:WhatsappSessionData)=>({session:{...session,addressConfirmed:true,deliveryFeeCalculated:2000}}));
      await h.sendQueued('Hola buenas tardes');expect(h.cartRows()).toEqual([]);
      await h.sendQueued(`Quiero un ${config.dish} sin cebolla`);
      expect(h.cartRows()).toEqual([expect.objectContaining({id:38101,qty:1,note:expect.stringMatching(/sin cebolla/i)})]);
      await h.sendQueued('Cuanto vale?');expect(h.conv.sessionData.cart).toHaveLength(1);
      expect(h.replies.at(-1)).toMatch(/18[.,]000/);
      await h.sendQueued(`Con ${config.options[1]} y una adicional de ${config.sideRequest}`);
      expect(h.conv.sessionData.cart).toHaveLength(2);
      expect(h.conv.sessionData.cart[0].attributes).toContainEqual({attributeName:config.attribute,attributeValue:config.options[1]});
      await h.sendQueued('Quita el item dos');expect(h.cartRows()).toHaveLength(1);
      expect(h.cartRows()[0].id).toBe(38101);
      await h.sendQueued(fulfillment==='pickup'?'Para recoger en el local':'Para domicilio Calle 12 34 56');
      expect(h.conv.state).toBe('awaiting_payment');
      if(fulfillment==='delivery') {
        expect(h.conv.sessionData.address).toMatch(/Calle 12 34 56/i);
        expect(h.conv.sessionData.address).not.toMatch(/para domicilio/i);
      }
      const before=structuredClone(h.conv.sessionData.cart);
      await h.sendQueued('Antes de pagar, cuanto cuesta el plato?');
      expect(h.conv.state).toBe('awaiting_payment');expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.replies.at(-1)).toMatch(/18[.,]000/);
      await h.sendQueued('Pago contraentrega');expect(h.conv.state).toBe('awaiting_final_confirm');
      await h.sendQueued('Si');expect(h.conv.state).toBe('completed');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const order=h.service.ordersService.create.mock.calls[0][0];
      expect(order.orderType).toBe(fulfillment);
      expect(order.items).toHaveLength(1);
      expect(order.items[0]).toEqual(expect.objectContaining({productId:38101,note:expect.stringMatching(/sin cebolla/i),attributes:expect.arrayContaining([{attributeName:config.attribute,attributeValue:config.options[1]}])}));
      await h.sendQueued('Gracias señor');await h.sendQueued('No señor asi esta bien');
      expect(h.conv.state).toBe('completed');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    });
  }
});

describe('concrete delivery setup after a basic order', () => {
  const menu=[{id:39101,code:39101,name:'Croqueta De Hongos',price:9000,availableNow:true,hasAttributes:false,attributes:[]}];
  for(const text of ['Para domicilio Calle 12 34 56','Es para domicilio Calle 12 34 56','Domicilio para Calle 12 34 56','Quiero un domicilio para Calle 12 34 56']) for(const enabled of [true,false]) {
    it(`${text}, agent ${enabled}`,async()=>{
      const h=harness(menu,enabled);
      Object.assign(h.conv.sessionData,{orderType:'pickup',phoneConfirmed:true,contactPhone:h.conv.phoneE164,cart:[{productId:39101,code:39101,name:'Croqueta De Hongos',unitPrice:9000,quantity:1,attributes:[],note:'Sin sal'}]});
      h.service.ensureDeliveryFeeQuoted=jest.fn(async(session:WhatsappSessionData)=>({session:{...session,addressConfirmed:true,deliveryFeeCalculated:2000}}));
      await h.sendQueued(text);
      expect(h.conv.state).toBe('awaiting_payment');expect(h.conv.sessionData.orderType).toBe('delivery');
      expect(h.conv.sessionData.address).toMatch(/Calle 12 34 56/i);
      expect(h.conv.sessionData.address).not.toMatch(/domicilio|quiero/i);
      expect(h.cartRows()).toEqual([expect.objectContaining({id:39101,qty:1,note:'Sin sal'})]);
      expect(h.replies.join(' ')).not.toMatch(/qu[eé] se te antoja|no manejamos/i);
    });
  }
});

/** Existing checkout -> ambiguous edit -> withdraw edit -> inquiry -> one unchanged order. */
describe('withdraw cart edit and finish existing checkout',()=>{
  const edits=[
    {key:'pendingCartRemoval',request:(name:string)=>`Quita el ${name}`,phrases:['No quites nada por favor','Déjalo como estaba','Olvida ese cambio','Sí, olvida ese cambio','Claro, cancela ese cambio']},
    {key:'pendingCartQuantity',request:(name:string)=>`Deja solo dos ${name}`,phrases:['Déjalo como estaba','Olvida ese cambio']},
    {key:'pendingCartAttributeEdit',request:(_name:string)=>'Cambia Salsa a Picante',phrases:['Déjalo como estaba','Olvida ese cambio']},
    {key:'pendingCartReplacement',request:(name:string,side:string)=>`Cambia el ${name} por una ${side}`,phrases:['Déjalo como estaba','Olvida ese cambio']},
  ];
  for(const f of [{dish:'Taco De Calabaza',side:'Porcion De Totopos'},{dish:'Bao De Setas',side:'Porcion De Pan'}])
  for(const enabled of [true,false])for(const state of ['awaiting_payment','awaiting_final_confirm'])for(const edit of edits)for(const phrase of edit.phrases){
    it(`${f.dish}, ${edit.key}, ${phrase}, ${state}, agent ${enabled}`,async()=>{
      const menu=[{id:42101,code:42101,name:f.dish,price:19000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Salsa',options:['Suave','Picante']}]},
        {id:42102,code:42102,name:f.side,price:6000,availableNow:true,attributes:[]}];
      const h=harness(menu,enabled);h.conv.state=state;
      Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,address:'Calle 12 34 56',addressConfirmed:true,deliveryFeeCalculated:2000,
        phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,...(state==='awaiting_final_confirm'?{paymentMethod:'contraentrega'}:{}),
        cart:[...['sin cilantro','con cilantro'].map((note,i)=>({productId:42101,code:42101,name:f.dish,unitPrice:19000,quantity:i?1:2,attributes:[{attributeName:'Salsa',attributeValue:'Suave'}],note})),
          {productId:42102,code:42102,name:f.side,unitPrice:6000,quantity:1,attributes:[],note:'Sin sal'}]});
      h.service.ordersService.create=jest.fn().mockResolvedValue({id:1003,dailyOrderNumber:3});
      const before=structuredClone(h.conv.sessionData.cart);const payment=h.conv.sessionData.paymentMethod;
      await h.sendQueued(edit.request(f.dish,f.side));
      expect((h.conv.sessionData as any)[edit.key]).toBeTruthy();expect(h.conv.sessionData.cart).toEqual(before);
      await h.sendQueued(phrase);
      expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.state).toBe(state);
      for(const key of edits.map(item=>item.key))expect((h.conv.sessionData as any)[key]).toBeUndefined();
      expect(h.conv.sessionData.paymentMethod).toBe(payment);expect(h.conv.sessionData.address).toBe('Calle 12 34 56');expect(h.conv.customerName).toBe('Wilmer');
      expect(h.replies.at(-1)).toMatch(/no quito|cancel[eé].*cambio|conservo/i);
      expect(h.replies.at(-1)).not.toMatch(/cu[aá]l l[ií]nea|elige el plato|vaciamos|qued[oó] cancelado|pedido registrado/i);
      expect(h.replies.at(-1)).toMatch(state==='awaiting_payment'?/pago|pagas/i:/confirmar/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      await h.sendQueued('Antes de seguir cuanto vale todo?');
      expect(h.replies.at(-1)).toMatch(/65[.,]000/);expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.state).toBe(state);
      if(state==='awaiting_payment')await h.sendQueued('Pago contraentrega');
      await h.sendQueued('Si');expect(h.conv.state).toBe('completed');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const order=h.service.ordersService.create.mock.calls[0][0];expect(order.items).toHaveLength(4);
      expect(order.items.filter((line:any)=>line.productId===42101)).toEqual([
        expect.objectContaining({note:'sin cilantro',attributes:[{attributeName:'Salsa',attributeValue:'Suave'}]}),
        expect.objectContaining({note:'sin cilantro',attributes:[{attributeName:'Salsa',attributeValue:'Suave'}]}),
        expect.objectContaining({note:'con cilantro',attributes:[{attributeName:'Salsa',attributeValue:'Suave'}]})]);
      expect(order.items.find((line:any)=>line.productId===42102)).toMatchObject({note:'Sin sal'});
    });
  }
});

describe('Delivery timing distinguishes hypothetical and explicit approval',()=>{
 const menu=[{id:62501,code:62501,name:'Tostada De Hongos',price:14000,availableNow:true,hasAttributes:false,attributes:[]}];
 for(const agent of [false,true])for(const [text,approval] of [
  ['Cuanto tarda si confirmo el pedido?',false],['Si confirmo el pedido, en cuanto llega?',false],['¿Cuánto tarda si lo confirmo?',false],['En caso de confirmar, cuanto tarda?',false],
  ['Lo confirmo. ¿Cuánto tarda?',true],['Sí, confirmo el pedido. ¿En cuánto llega?',true],
 ] as const){
  it(text+' agent='+agent,async()=>{
   const h=harness(menu,agent);h.conv.state='awaiting_final_confirm';h.service.ordersService.create=jest.fn().mockResolvedValue({id:6250,dailyOrderNumber:65});
   Object.assign(h.conv.sessionData,{cart:[{productId:62501,code:62501,name:menu[0].name,unitPrice:14000,quantity:1,attributes:[]}],orderType:'delivery',fulfillmentChosen:true,address:'Calle 12 34 56',addressConfirmed:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,paymentMethod:'contraentrega',notesCollected:true,deliveryFeeCalculated:2000});
   const before=structuredClone(h.conv.sessionData);await h.sendQueued(text);expect(h.replies.join(' ')).toMatch(/suele demorar/i);
   expect(h.service.ordersService.create).toHaveBeenCalledTimes(approval?1:0);expect(h.conv.state).toBe(approval?'completed':'awaiting_final_confirm');if(!approval)expect(h.conv.sessionData).toEqual(before);
  });
 }
});

describe('Counted quotation then explicit distributed purchase reaches the final DTO',()=>{
 for(const f of [{name:'Duo De Bao',attr:'Relleno',a:'Tofu',b:'Cerdo'},{name:'Trio De Tostadas',attr:'Salsa',a:'Suave',b:'Picante'},{name:'Bento Vegetal',attr:'Arroz',a:'Blanco',b:'Integral'}])for(const state of ['building_cart','awaiting_payment'])for(const counts of [[2,2]])it(`${f.name} ${state} ${counts.join("+")}`,async()=>{
  const product={id:64811,code:64811,name:f.name,price:27000,availableNow:true,hasAttributes:true,attributes:[{attributeName:f.attr,options:[f.a,f.b]}]};
  const h=harness([product],true);h.conv.state=state;
  Object.assign(h.conv.sessionData,{cart:[{productId:product.id,code:product.code,name:product.name,unitPrice:product.price,quantity:1,note:'pedido previo',attributes:[{attributeName:f.attr,attributeValue:f.a}]}],orderType:'delivery',fulfillmentChosen:true,address:'Calle 12 34 56',addressConfirmed:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,deliveryFeeCalculated:2000,...(state==='awaiting_final_confirm'?{paymentMethod:'contraentrega'}:{})});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:6481,dailyOrderNumber:80});
  const beforeQuote=structuredClone(h.conv.sessionData.cart);
  const quote=await h.sendQueued(`Cuánto cuestan cuatro ${f.name}, 2 con ${f.a} y 2 con ${f.b}?`);
  expect(quote).toContain('108.000');expect(h.conv.sessionData.cart).toEqual(beforeQuote);expect(h.conv.state).toBe(state);expect(h.agent.runTurn).not.toHaveBeenCalled();
  h.agent.runTurn.mockImplementationOnce(async input=>{
   const service=new WhatsappAgentService({} as never,h.service.catalogService) as any;const actions:any={};
   const ctx={actions,cart:input.cart,products:[product],byId:new Map([[product.id,product]]),userMessage:input.userMessage,setNeedsAttr:()=>{}};
   for(const [index,value] of [f.a,f.b].entries())expect(JSON.parse(service.executeTool('add_item',{productId:product.id,quantity:counts[index],attributes:[{attributeName:f.attr,attributeValue:value}],note:index===1?'sin sal':undefined},ctx)).ok).toBe(true);
   return {reply:'Listo',actions,toolCalls:['add_item','add_item'],purchaseAttempts:[{productId:product.id,accepted:true},{productId:product.id,accepted:true}]};
  });
  const initial=await h.sendQueued(`Quiero cuatro ${f.name}, ${counts[0]} con ${f.a} y ${counts[1]} con ${f.b}; los de ${f.b} sin sal. Para Calle 12 34 56`);
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



describe('Counted inquiries preserve pending product selections',()=>{
 for(const name of ['Bento De Setas','Caja De Desayuno','Duo De Bao'])for(const pending of ['attribute','match','multi'])it(`${name} ${pending}`,async()=>{
  const product={id:65221,code:65221,name,price:19000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Salsa',options:['Suave','Picante']}]};
  const h=harness([product],true);h.conv.state='awaiting_payment';
  if(pending==='attribute')h.conv.sessionData.pendingAttribute={productId:product.id,code:product.code,name,price:product.price,quantity:1,attributes:product.attributes,selected:[]};
  if(pending==='match')h.conv.sessionData.pendingMatch={query:name,quantity:1,candidates:[product]};
  if(pending==='multi')h.conv.sessionData.pendingMultiOrder={confident:[],ambiguous:[{segment:name,candidates:[product]}],needsAttributes:[],unresolved:[]};
  const before=structuredClone(h.conv.sessionData);h.service.ordersService.create=jest.fn();
  const reply=await h.sendQueued(`Cuánto cuestan cuatro ${name}, 2 con Suave y 2 con Picante?`);
  expect(reply).toContain('76.000');expect(h.conv.sessionData).toEqual(before);expect(h.conv.state).toBe('awaiting_payment');expect(h.agent.runTurn).not.toHaveBeenCalled();expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});

describe('Polite counted quotations stay informational',()=>{
 for(const name of ['Duo De Bao','Caja De Desayuno','Bento De Setas'])for(const prefix of ['Quisiera saber cuánto cuestan','Dame el precio de'])it(`${name} ${prefix}`,async()=>{
  const product={id:65241,code:65241,name,price:27000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Salsa',options:['Suave','Picante']}]};
  const h=harness([product],true);h.conv.state='awaiting_payment';const before=structuredClone(h.conv.sessionData);
  const reply=await h.sendQueued(`${prefix} cuatro ${name}, 2 con Suave y 2 con Picante?`);
  expect(reply).toContain('108.000');expect(h.conv.sessionData).toEqual(before);expect(h.conv.state).toBe('awaiting_payment');expect(h.agent.runTurn).not.toHaveBeenCalled();
 });
});

describe('Kitchen presentation clauses remain notes rather than unavailable dishes',()=>{
 for(const name of ['Sobrebarriga','Filete Vegetal','Berenjena Gratinada'])for(const enabled of [false,true])for(const preference of ['dorada, bien bonita que no esté tan gorda','bien doradita, que no venga tan gruesa','delgadita por favor','dorda, bien bonita que no esté tan torda'])it(`${name} agent=${enabled} ${preference}`,async()=>{
  const product={id:65401,code:65401,name,price:27000,availableNow:true,hasAttributes:name==='Sobrebarriga',attributes:name==='Sobrebarriga'?[{attributeName:'Seleccion',options:['Asada','En Salsa']}]:[]};const h=harness([product],enabled);
  Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,address:'Calle 12 34 56',addressConfirmed:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,deliveryFeeCalculated:2000});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:6540,dailyOrderNumber:83});
  if(enabled)h.agent.runTurn.mockImplementationOnce(async input=>{
   const service=new WhatsappAgentService({} as never,h.service.catalogService) as any;const actions:any={};
   const result=JSON.parse(service.executeTool('add_item',{productId:product.id,quantity:1},{actions,cart:input.cart,products:[product],byId:new Map([[product.id,product]]),userMessage:input.userMessage,setNeedsAttr:()=>{}}));
   expect(result.ok).toBe(true);return {reply:'Listo',actions,toolCalls:['add_item'],purchaseAttempts:[{productId:product.id,accepted:true}]};
  });
  const reply=await h.sendQueued(`Quiero una ${name} ${preference}`);
  expect(reply).not.toMatch(/no (?:manejamos|tenemos)|no pude añadir/i);expect(h.conv.sessionData.cart).toHaveLength(1);expect(h.conv.sessionData.cart[0].quantity).toBe(1);
  const note=h.conv.sessionData.cart[0].note || '';if(!preference.includes('delgadita'))expect(note).toMatch(/dorad|dord/i);expect(note).toMatch(preference.includes('delgadita')?/delgadita/i:preference.includes('torda')?/torda/i:preference.includes('gruesa')?/gruesa/i:/gorda/i);
  if(h.conv.state==='building_cart')await h.sendQueued('Nada más');if(h.conv.state==='awaiting_payment')await h.sendQueued('1');await h.sendQueued('Confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.service.ordersService.create.mock.calls[0][0].items[0].note).toBe(note);
 });
});

describe('Small accompaniment preferences stay attached to a new dish',()=>{
 const cases=[{name:'Churrasco',suffix:'3/4',a:'arroz',b:'ensalada'},{name:'Bowl Vegetal',suffix:'',a:'quinoa',b:'salsa'},{name:'Pasta Del Huerto',suffix:'',a:'queso',b:'crema'}];
 for(const c of cases)for(const state of ['building_cart','awaiting_address'])for(const enabled of [false,true])it(`${c.name} ${state} agent=${enabled}`,async()=>{
  const menu=[{id:79921,code:79921,name:c.name,price:21000,availableNow:true,attributes:[]},...(['a','b'] as const).map((key,i)=>({id:79922+i,code:79922+i,name:'Porcion De '+c[key],price:5000,availableNow:true,attributes:[]}))];const h=harness(menu,enabled);h.conv.state=state;Object.assign(h.conv.sessionData,{fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});h.service.ordersService.create=jest.fn().mockResolvedValue({id:7992,dailyOrderNumber:81});
  if(state==='awaiting_address')Object.assign(h.conv.sessionData,{cart:[{productId:79922,name:menu[1].name,quantity:1,unitPrice:5000,note:'pedido anterior'}],orderType:'delivery',fulfillmentChosen:true,lastDeliveryAddress:'Calle 12 #34-56 torre 1 apto 402',addressConfirmed:false});
  const before=structuredClone(h.conv.sessionData.cart);const reply=await h.sendQueued(`quiero un ${c.name} ${c.suffix}, poquito ${c.a} y poquita ${c.b}`);
  expect(reply).not.toMatch(/no me quedó clara|no manejamos|no tenemos/i);
  const dish=h.conv.sessionData.cart.find((r:any)=>r.productId===79921)!;expect(dish).toBeDefined();expect(dish.quantity).toBe(1);expect(dish.note).toMatch(new RegExp('poquito '+c.a,'i'));expect(dish.note).toMatch(new RegExp('poquita '+c.b,'i'));if(c.suffix)expect(dish.note).toMatch(/tres cuartos/i);
  expect(h.conv.sessionData.cart).toHaveLength(before.length+1);for(const row of before)expect(h.conv.sessionData.cart).toContainEqual(row);
  if(state==='awaiting_address'){expect(h.conv.sessionData.lastDeliveryAddress).toContain('torre 1 apto 402');expect(h.conv.sessionData.addressConfirmed).not.toBe(true);}
  expect(h.service.ordersService.create).not.toHaveBeenCalled();if(state==='awaiting_address')await h.sendQueued('Calle 12 #34-56');
  if(h.conv.state==='building_cart')await h.sendQueued('Nada más');if(h.conv.state==='awaiting_payment')await h.sendQueued('1');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toHaveLength(before.length+1);expect(dto.items.find((r:any)=>r.productId===79921).note).toBe(dish.note);
 });
});

describe('Reduced accompaniment grammar keeps explicit extras distinct',()=>{
 const {splitKitchenPreference}=require('./whatsapp-kitchen-preference');
 it.each(['quiero un bowl, poco arroz y poca salsa','quiero un roll con poquito de salsa','dame una pasta, poquita crema por favor','quiero un churrasco 3/4, poquito arroz y poquita ensalada'])('%s',text=>{
  const result=splitKitchenPreference(text);expect(result).not.toBeNull();expect(result.productText).not.toMatch(/poquit|poco|poca/);expect(result.note).toMatch(/poquit|poco|poca/);
 });
 it.each(['quiero un bowl, poquito arroz y una ensalada adicional','quiero un bowl, poquito arroz y dos sopas','quiero un bowl, poquito arroz para Calle 12 34','quiero un bowl, poquito arroz y dame una bebida'])('does not swallow %s',text=>expect(splitKitchenPreference(text)).toBeNull());
 it('keeps explicitly counted salad as a paid additional item',async()=>{
  const menu=[{id:79931,code:79931,name:'Bowl Vegetal',price:21000,availableNow:true,attributes:[]},{id:79932,code:79932,name:'Porcion De Ensalada',price:5000,availableNow:true,attributes:[]}];const h=harness(menu,false);
  await h.sendQueued('quiero un bowl vegetal y una porcion de ensalada adicional');expect(h.cartRows().map(r=>[r.id,r.qty])).toEqual(expect.arrayContaining([[79931,1],[79932,1]]));expect(h.cartRows()).toHaveLength(2);
 });
});

describe('PDF combo with beverage and separate half product closes intact',()=>{
 const families=[
  {name:'PPP',menu:products,combo:94,extra:5,text:'Un combo de arroz paisa con colombiana y medio pollo broaster'},
  {name:'pizza',menu:[{id:79941,code:79941,name:'Combo De Pizza',price:30000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Colombiana','Manzana']}]},{id:79942,code:79942,name:'Media Pizza Margarita',price:15000,availableNow:true,attributes:[]}],combo:79941,extra:79942,text:'Un combo de pizza con colombiana y media pizza margarita'},
  {name:'vegetal',menu:[{id:79951,code:79951,name:'Combo Vegetal',price:28000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Colombiana','Manzana']}]},{id:79952,code:79952,name:'Media Porcion De Falafel',price:10000,availableNow:true,attributes:[]}],combo:79951,extra:79952,text:'Un combo vegetal con colombiana y media porcion de falafel'},
 ];
 for(const f of families)for(const enabled of [false,true])it(`${f.name} agent=${enabled}`,async()=>{
  const h=harness(f.menu,enabled);Object.assign(h.conv.sessionData,{fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});h.service.ordersService.create=jest.fn().mockResolvedValue({id:7994,dailyOrderNumber:82});
  const reply=await h.sendQueued(f.text);expect(h.cartRows().map(r=>[r.id,r.qty])).toEqual(expect.arrayContaining([[f.combo,1],[f.extra,1]]));expect(h.cartRows()).toHaveLength(2);
  expect(reply).not.toMatch(/no manejamos|no tenemos|aclara|cu[aá]l prefieres/i);expect(h.conv.sessionData.cart.find(r=>r.productId===f.combo)?.attributes).toContainEqual({attributeName:'Bebida',attributeValue:'Colombiana'});
  const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued('cuánto es el total');expect(h.conv.sessionData.cart).toEqual(before);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('no más, recojo en el local');if(h.conv.state==='awaiting_payment')await h.sendQueued('1');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toHaveLength(2);expect(dto.items.map((r:any)=>r.productId).sort()).toEqual([f.combo,f.extra].sort());expect(dto.orderType).toBe('pickup');
 });
});
