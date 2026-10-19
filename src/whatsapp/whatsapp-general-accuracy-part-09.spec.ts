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

  it('turns a readable menu into every product, never just the first', () => {
    const h = harness();
    expect(h.service.resolveImageOrderText({
      kind: 'unclear', textForBot: '', visibleText: '1 Pollo Frito\nChurrasco\nArroz Con Pollo',
      reply: '¿Cuál de los platos de la carta quieres?',
    }, 'Esto', products)).toBe('1 x 1 Pollo Frito (código 1)\n1 x Churrasco (código 17)\n1 x Arroz Con Pollo (código 23)');
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


describe('Cercanía no convierte consultas o negaciones en compra', () => {
  it.each(['No quiero sopa de menudencias aquí para la vuelta', 'Tienen sopa de menudencias aquí para la vuelta'])('no agrega: %s', async text => {
    const h = harness(products,false);
    await h.send(text);
    expect(h.cartRows()).toEqual([]);
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

describe('Disculpa por chat equivocado', () => {
  const apology = 'ay perdon me confunci pense que hablaba con el supermercado';
  const grocery = 'hola buenas noches\nme envias por favor una libra de arroz, dos aceites y un kilo de azucar';
  it('no repite el pedido ni anota la disculpa como dirección', async () => {
    const h = harness(products, false);
    await h.send(grocery);
    expect(h.conv.sessionData.pendingMultiOrder?.unresolved?.length).toBeGreaterThan(0);
    h.replies.length = 0;
    const reply = await h.send(apology);
    expect(h.conv.sessionData.pendingMultiOrder).toBeFalsy();
    expect(h.conv.sessionData.address).toBeFalsy();
    expect(h.cartRows()).toEqual([]);
    expect(reply).toMatch(/no es un pedido ni una direcci[oó]n/i);
    expect(reply).not.toMatch(/buenas noches|libra de arroz|anot[eé] esa direcci[oó]n/i);
    h.replies.length = 0;
    const again = await h.send(apology);
    expect(h.conv.sessionData.address).toBeFalsy();
    expect(again).not.toMatch(/anot[eé] esa direcci[oó]n/i);
    expect(h.agent.runTurn).not.toHaveBeenCalled();
  });
  it('con el agente prendido tampoco guarda el supermercado como domicilio', async () => {
    const h = harness(products, true);
    h.conv.sessionData.pendingMultiOrder = {
      confident: [],
      ambiguous: [],
      unresolved: ['libra de arroz'],
      needsAttributes: [],
    };
    const reply = await h.send(apology);
    expect(h.agent.runTurn).not.toHaveBeenCalled();
    expect(h.conv.sessionData.address).toBeFalsy();
    expect(h.conv.sessionData.pendingMultiOrder).toBeFalsy();
    expect(reply).not.toMatch(/anot[eé] esa direcci[oó]n|libra de arroz/i);
  });
  it('en otra carta la disculpa deja el pedido que sí era de ese local', async () => {
    const menu = [{ id: 9621, code: 9621, name: 'Taco Al Pastor', price: 12000, availableNow: true, hasAttributes: false, attributes: [] }];
    const h = harness(menu, false);
    await h.send('un taco al pastor');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 9621, qty: 1 })]);
    const reply = await h.send(apology);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 9621, qty: 1 })]);
    expect(h.conv.sessionData.address).toBeFalsy();
    expect(reply).toMatch(/Taco Al Pastor/i);
    expect(reply).not.toMatch(/anot[eé] esa direcci[oó]n/i);
  });
  it('un supermercado con calle sigue siendo dirección, y perdón de mango no es disculpa de chat', () => {
    expect(isWrongChatApology(apology)).toBe(true);
    expect(isWrongChatApology('perdon de mango en agua bajito de azucar')).toBe(false);
    expect(looksLikeAddressOnlyMessage(apology)).toBe(false);
    expect(looksLikeAddressOnlyMessage('para el supermercado exito calle 80 20')).toBe(true);
  });
});

describe('Imagen de carta — selección explícita frente a OCR ambiguo',()=>{
  const analysis={kind:'unclear',textForBot:'',visibleText:'Churrasco\nArroz Con Pollo'};
  it('incluye todos los platos de una carta sin selección aunque no haya reply',()=>{
    const h=harness(products,false);expect(h.service.resolveImageOrderText(analysis,'Esto',products)).toBe('1 x Churrasco (código 17)\n1 x Arroz Con Pollo (código 23)');expect(h.cartRows()).toEqual([]);
  });
  it('respeta la selección y cantidad del pie en una carta con varios platos',async()=>{
    const h=harness(products,false);const text=h.service.resolveImageOrderText(analysis,'Dos churrascos',products);
    expect(text).toBe('Dos churrascos');await h.sendQueued(text);expect(h.cartRows()).toEqual([expect.objectContaining({id:17,qty:2})]);
  });
  it('selección por código del pie no se sustituye por el primer plato del OCR',async()=>{
    const h=harness(products,false);const text=h.service.resolveImageOrderText(analysis,'código 23',products);
    expect(text).toBe('código 23');await h.sendQueued(text);expect(h.cartRows()).toEqual([expect.objectContaining({id:23,qty:1})]);
  });

  it('si el cliente escribió el plato, usa ese texto aunque la imagen sea ilegible',async()=>{
    const h=harness(products,false);const text=h.service.resolveImageOrderText({kind:'unclear',textForBot:'',reply:'No pude leer la foto'},'Tres churrascos',products);
    expect(text).toBe('Tres churrascos');await h.sendQueued(text);expect(h.cartRows()).toEqual([expect.objectContaining({id:17,qty:3})]);
  });

});


describe('Medios — OCR incierto no equivale a compra',()=>{
  const alternate=[{id:9855,code:7,name:'Bowl Mediterraneo',price:18000,availableNow:true,attributes:[]}];
  for(const fixture of [{menu:products,name:'Churrasco'},{menu:alternate,name:'Bowl Mediterraneo'}]) {
    it.each(['','Esto'])('no compra el único nombre visible sin selección: '+fixture.name+' %s',caption=>{
      const h=harness(fixture.menu,false);
      expect(h.service.resolveImageOrderText({kind:'unclear',textForBot:'',visibleText:fixture.name},caption,fixture.menu)).toBeNull();
      expect(h.cartRows()).toEqual([]);
    });
    it('conserva texto explícito de selección para '+fixture.name,()=>{
      const h=harness(fixture.menu,false);const caption='Quiero dos '+fixture.name;
      expect(h.service.resolveImageOrderText({kind:'unclear',textForBot:'',visibleText:fixture.name},caption,fixture.menu)).toBe(caption);
    });
    it('audio fallido seguido de texto recupera cantidad en '+fixture.name,async()=>{
      const h=harness(fixture.menu,false);h.service.resolveAudioToText=jest.fn().mockResolvedValue(null);
      await h.sendQueued('',{messageType:'audio',mediaId:'mock-failed'});expect(h.cartRows()).toEqual([]);
      await h.sendQueued('Quiero dos '+fixture.name);
      expect(h.cartRows()).toEqual([expect.objectContaining({id:fixture.menu===products?17:9855,qty:2})]);
      expect(h.replies.at(-1)).not.toMatch(/no pude escuchar|no entend[ií]/i);
    });
  }
});

describe('Chats 11/10 — combo seguido de estilo, bebida y arepa', () => {
  const casa = [
    {
      id: 9501,
      code: 9501,
      name: 'Combo De La Casa',
      price: 32000,
      hasAttributes: true,
      attributes: [
        { attributeName: 'Bebida', options: ['Agua', 'Cola'] },
        { attributeName: 'Acompanante', options: ['Arroz', 'Papas'] },
      ],
      availableNow: true,
    },
    {
      id: 9502,
      code: 9502,
      name: 'Carne Al Horno',
      price: 28000,
      hasAttributes: false,
      attributes: [],
      availableNow: true,
    },
  ];

  it('combo, broster, coca cola y arepas fritas arman el combo, no el pollo suelto', async () => {
    const h = harness(products, false);
    await h.sendQueued('Me regalas un combo');
    await h.sendQueued('De broster');
    await h.sendQueued('Coca. Cola');
    await h.sendQueued('Y arepas fritas');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 99,
        qty: 1,
        attrs: expect.arrayContaining(['Bebida:Coca Cola', 'Arepas:Fritas']),
      }),
    ]);
  });

  it('dos ejecutivos se reparten presa, sopa y el cambio de papa', async () => {
    const h = harness(products, false);
    await h.sendQueued('Dos menu ejecutivo por favor');
    await h.sendQueued('Uno con presa pierna pernil y en vez de papa a la francesa papa salada y de sopa ajiaco por fa');
    await h.sendQueued('Y el otro con presa pechuga ese si con papa a la francesa y de sopa mondongo');
    await h.sendQueued('Pollo frito');
    expect(h.cartRows()).toHaveLength(2);
    expect(h.cartRows().every((row) => row.id === 22 && row.qty === 1)).toBe(true);
    const joined = h.cartRows().map((row) => `${row.attrs.join('|')} ${row.note || ''}`).join(' || ');
    expect(joined).toMatch(/Pierna Pernil/);
    expect(joined).toMatch(/pechuga/i);
    expect(joined).toMatch(/Ajiaco/);
    expect(joined).toMatch(/Mondongo/);
    expect(joined).toMatch(/papa salada/i);
    expect(h.cartRows().some((row) => row.id === 8)).toBe(false);
  });

  it('en otra carta dos almuerzos se reparten sopa y el cambio de guarnición', async () => {
    const lunch = {
      id: 9601,
      code: 9601,
      name: 'Almuerzo De La Casa',
      description: 'Incluye arroz y ensalada',
      price: 18000,
      hasAttributes: true,
      attributes: [
        { attributeName: 'Proteina', options: ['Pollo', 'Carne'] },
        { attributeName: 'Sopa', options: ['Verduras', 'Lentejas'] },
      ],
      availableNow: true,
    };
    const side = {
      id: 9602,
      code: 9602,
      name: 'Papa Salada',
      price: 4000,
      hasAttributes: false,
      attributes: [],
      availableNow: true,
    };
    const h = harness([lunch, side], false);
    await h.sendQueued('Dos almuerzos de la casa por favor');
    await h.sendQueued('Uno con proteina pollo y en vez de ensalada papa salada y de sopa verduras');
    await h.sendQueued('Y el otro con proteina carne ese si con ensalada y de sopa lentejas');
    expect(h.cartRows()).toHaveLength(2);
    expect(h.cartRows().every((row) => row.id === 9601 && row.qty === 1)).toBe(true);
    const joined = h.cartRows().map((row) => `${row.attrs.join('|')} ${row.note || ''}`).join(' || ');
    expect(joined).toMatch(/Pollo/);
    expect(joined).toMatch(/Carne/);
    expect(joined).toMatch(/Verduras/);
    expect(joined).toMatch(/Lentejas/);
    expect(joined).toMatch(/papa salada/i);
    expect(h.cartRows().some((row) => row.id === 9602)).toBe(false);
  });

  it('en otra carta el combo recibe bebida y acompañante, no la carne suelta', async () => {
    const h = harness(casa, false);
    await h.sendQueued('Me regalas un combo');
    await h.sendQueued('De horno');
    await h.sendQueued('Cola');
    await h.sendQueued('Y papas');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({
        id: 9501,
        qty: 1,
        attrs: expect.arrayContaining(['Bebida:Cola', 'Acompanante:Papas']),
      }),
    ]);
    expect(h.cartRows().some((row) => row.id === 9502)).toBe(false);
  });
});

describe('Qué incluye el combo — la descripción de la carta, no solo un atributo', () => {
  it('el combo de broaster dice papa y yuca, y no cambia el pollo del carrito', async () => {
    const h = harness(products, true);
    h.conv.sessionData.cart = [{
      productId: 4,
      code: 4,
      name: '1 Pollo Broaster',
      unitPrice: 43000,
      quantity: 1,
      attributes: [{ attributeName: 'Arepas', attributeValue: 'Blancas' }],
    }];
    const reply = await h.sendQueued('El combo solo lleva la gaseosa adicional o algo más');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 4, qty: 1 })]);
    expect(reply).toMatch(/yuca/i);
    expect(reply).toMatch(/papa/i);
    expect(reply).toMatch(/arepa/i);
    expect(reply).not.toMatch(/¿Cuál prefieres\?/);
  });

  it('en otra carta el combo dice todo lo que trae, no solo la bebida', async () => {
    const menu = [
      { id: 9801, code: 9801, name: 'Carne Al Horno', price: 28000, availableNow: true, hasAttributes: false, attributes: [], description: 'Con arroz' },
      { id: 9802, code: 9802, name: 'Combo De Carne', price: 34000, availableNow: true, hasAttributes: true, description: 'Incluye arroz, ensalada y bebida', attributes: [{ attributeName: 'Bebida', options: ['Agua', 'Cola'] }] },
    ];
    const h = harness(menu, true);
    h.conv.sessionData.cart = [{
      productId: 9801,
      code: 9801,
      name: 'Carne Al Horno',
      unitPrice: 28000,
      quantity: 1,
      attributes: [],
    }];
    const reply = await h.sendQueued('El combo solo lleva la bebida o algo más');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 9801, qty: 1 })]);
    expect(reply).toMatch(/arroz/i);
    expect(reply).toMatch(/ensalada/i);
    expect(reply).toMatch(/bebida/i);
  });
});

describe('Menús completos — consultas, extras y reinicio básicos', () => {
  const lunch={id:11101,code:11101,name:'Menu Vegetariano',description:'Incluye sopa y bebida',price:18000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sopa',options:['Calabaza','Lentejas']},{attributeName:'Bebida',options:['Agua','Te']}]};
  const tea={id:11102,code:11102,name:'Te Helado',price:4000,availableNow:true,hasAttributes:false,attributes:[]};
  for (const f of [
    {menu:products,id:22,drink:37,name:'Ejecutivo Con Pollo Frito',turns:['Quiero dos almuerzos ejecutivos','Mondongo pollo frito pierna pernil papa salada','La bebida limonada'],extra:'Y una limonada natural adicional aparte'},
    {menu:[lunch,tea],id:11101,drink:11102,name:'Menu Vegetariano',turns:['Quiero dos menu vegetariano','Sopa de lentejas sin ensalada','La bebida te'],extra:'Y un te helado adicional aparte'},
  ]) {
    async function setup() {
      const h=harness(f.menu,false);
      for(const text of f.turns) await h.sendQueued(text);
      expect(h.cartRows()).toEqual([expect.objectContaining({id:f.id,qty:2})]);
      return h;
    }
    it('preguntar precio conserva las dos unidades y todas sus opciones: '+f.id, async()=>{
      const h=await setup(); const before=structuredClone(h.conv.sessionData.cart);
      const reply=await h.sendQueued('Cuánto cuesta '+f.name+'?');
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(reply).toMatch(/\$/);
      expect(reply).not.toMatch(/agregué|Listo ✅/i);
    });
    it('bebida adicional agrega solo una y conserva las incluidas: '+f.id, async()=>{
      const h=await setup(); const before=structuredClone(h.cartRows()[0]);
      await h.sendQueued(f.extra);
      expect(h.cartRows()).toHaveLength(2);
      expect(h.cartRows()).toEqual(expect.arrayContaining([before,expect.objectContaining({id:f.drink,qty:1})]));
    });
    it('cambiar cantidad del menú conserva extra independiente: '+f.id, async()=>{
      const h=await setup(); await h.sendQueued(f.extra);
      const before=structuredClone(h.cartRows().find(row=>row.id===f.drink));
      await h.sendQueued('Perdón, quiero tres '+f.name);
      expect(h.cartRows()).toHaveLength(2);
      expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:f.id,qty:3}),before]));
    });
    it('reinicio vacía menús, extras y elecciones pendientes: '+f.id, async()=>{
      const h=await setup(); await h.sendQueued(f.extra);
      await h.sendQueued('Reiniciar');
      expect(h.cartRows()).toEqual([]);
      expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
      expect(h.conv.sessionData.pendingMatch).toBeFalsy();
      expect(h.conv.sessionData.pendingMultiOrder).toBeFalsy();
      expect(h.replies.at(-1)).toMatch(/vaci|reinici|nuevo pedido/i);
    });
  }
});

describe('Después de registrar el pedido', () => {
  const pasta = [{
    id: 12031, code: 12031, name: 'Pasta Carbonara', price: 26000,
    availableNow: true, hasAttributes: false, attributes: [],
  }];

  function registered(menu: typeof products, agent: boolean) {
    const h = harness(menu, agent);
    h.conv.state = 'completed';
    const cancel = jest.fn();
    const create = jest.fn();
    h.service.ordersService.findTodayOrdersByPhone = async () => [
      { dailyOrderNumber: 18, orderStatus: 'cooking' },
    ];
    h.service.ordersService.cancel = cancel;
    h.service.ordersService.create = create;
    return { h, cancel, create };
  }

  it.each([
    { menu: products, agent: true },
    { menu: products, agent: false },
    { menu: pasta, agent: true },
    { menu: pasta, agent: false },
  ])('cancela ese pedido no abre otro (agent $agent)', async ({ menu, agent }) => {
    const { h, cancel, create } = registered(menu as typeof products, agent);
    const reply = await h.sendQueued('Cancela ese pedido');
    expect(cancel).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(h.cartRows()).toHaveLength(0);
    expect(h.conv.state).toBe('completed');
    expect(reply || '').toMatch(/#18/);
    expect(reply || '').toMatch(/preparaci[oó]n/i);
    expect(reply || '').toMatch(/no lo cancelo/i);
    expect(reply || '').not.toMatch(/cu[aá]l prefieres|qu[eé] se te antoja|armamos otro|qued[oó] cancelado/i);
  });

  it.each([
    { menu: products, agent: true },
    { menu: products, agent: false },
    { menu: pasta, agent: true },
    { menu: pasta, agent: false },
  ])('en cuánto llega usa el pedido de hoy (agent $agent)', async ({ menu, agent }) => {
    const { h, create } = registered(menu as typeof products, agent);
    const reply = await h.sendQueued('En cuánto llega');
    expect(create).not.toHaveBeenCalled();
    expect(h.cartRows()).toHaveLength(0);
    expect(h.conv.state).toBe('completed');
    expect(reply || '').toMatch(/#18/);
    expect(reply || '').toMatch(/preparaci[oó]n/i);
    expect(reply || '').not.toMatch(/cu[aá]l prefieres|qu[eé] se te antoja|armamos otro/i);
  });
});

describe('Pedido grande — conserva unidades y nota al corregir al cerrar',()=>{
  const other=[
    {id:12401,code:12401,name:'Taco Al Pastor',price:14000,availableNow:true,hasAttributes:false,attributes:[]},
    {id:12402,code:12402,name:'Sopa De La Casa',price:9000,availableNow:true,hasAttributes:false,attributes:[]},
  ];
  for(const f of [
    {menu:products,main:'churrascos',side:'sopas de mondongo',mainId:17,sideId:45,note:'sin ensalada'},
    {menu:other,main:'tacos al pastor',side:'sopas de la casa',mainId:12401,sideId:12402,note:'sin cebolla'},
  ]) for(const agent of [false,true]) for(const separator of [', ',' y ','\n']) {
    it(f.mainId+' separador='+JSON.stringify(separator)+' agent='+agent,async()=>{
      const h=harness(f.menu,agent);
      Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164});
      const reply=await h.sendQueued('Hola buenas tardes, me envías por favor 8 '+f.main+' '+f.note+separator+'6 '+f.side+' para la calle 48 sur 87 86');
      expect(h.cartRows()).toHaveLength(2);
      expect(h.cartRows()).toEqual(expect.arrayContaining([
        expect.objectContaining({id:f.mainId,qty:8,note:expect.stringContaining(f.note)}),
        expect.objectContaining({id:f.sideId,qty:6}),
      ]));
      expect(h.conv.sessionData.address).toMatch(/48 sur 87 86/i);
      expect(reply).not.toMatch(/¿.*Algo más|buenas tardes|me envías/i);
      const before=structuredClone(h.cartRows());
      await h.sendQueued('Cambia la dirección a calle 12 30 40 apartamento 201');
      expect(h.cartRows()).toEqual(before);
      expect(h.conv.sessionData.address).toMatch(/12.*30.*40.*201/i);
    });
  }
});

describe('Consulta de precio — respuesta abreviada no compra ni consume el campo',()=>{
  for(const names of [['Sushi Vegetal','Gyozas De Hongos'],['Pasta De Lentejas','Crema De Calabaza']])for(const agent of [false,true])for(const state of ['awaiting_name','awaiting_phone','awaiting_address','awaiting_payment'])for(const answer of [names[1],'el segundo','2','No importa, olvida la pregunta']){
    it(names[0]+' '+state+' agent='+agent+' '+answer,async()=>{
      const menu=names.map((name,i)=>({id:13701+i,code:13701+i,name,price:18000+i*3000,availableNow:true,hasAttributes:false,attributes:[]}));
      const h=harness(menu,false);for(const name of names)await h.sendQueued('2 '+name);h.cfg.agentV1Enabled=agent;h.conv.customerName=state==='awaiting_name'?'':'Carolina';
      Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,phoneConfirmed:state!=='awaiting_phone',contactPhone:state==='awaiting_phone'?undefined:h.conv.phoneE164,address:state==='awaiting_address'?undefined:'Calle 9 20 30',addressConfirmed:state!=='awaiting_address',paymentMethod:undefined});h.conv.state=state;
      const before=structuredClone(h.conv.sessionData),customer=h.conv.customerName;h.service.ordersService.create=jest.fn();
      await h.sendQueued('Que precio tiene');const reply=await h.sendQueued(answer);
      expect(h.conv.sessionData.cart).toEqual(before.cart);expect(h.conv.customerName).toBe(customer);expect(h.conv.state).toBe(state);expect(h.conv.sessionData.paymentMethod).toBeUndefined();
      expect(h.conv.sessionData.contactPhone).toBe(before.contactPhone);expect(h.conv.sessionData.address).toBe(before.address);
      if(answer.startsWith('No importa'))expect(reply).toMatch(/pedido sigue igual/i);else expect(reply).toMatch(/21[.,]000/);
      await h.sendQueued(state==='awaiting_name'?'Carolina':state==='awaiting_phone'?'3001234567':state==='awaiting_address'?'Calle 15 25 35 apartamento 202':'Efectivo');
      expect(h.conv.state).not.toBe(state);expect(h.conv.sessionData.cart).toEqual(before.cart);expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
  }
});

describe('Consulta de precio — contexto temporal y respuestas inválidas',()=>{
  for(const agent of [false,true])for(const answer of ['9','el tercero','otra consulta','repetir','desistir','acción']){
    it('agent='+agent+' '+answer,async()=>{
      const menu=[{id:13801,code:13801,name:'Cuscus Vegetal',price:15000,availableNow:true,hasAttributes:false,attributes:[]},{id:13802,code:13802,name:'Tabule Casero',price:19000,availableNow:true,hasAttributes:false,attributes:[]}];
      const h=harness(menu,false);await h.sendQueued('2 Cuscus Vegetal');await h.sendQueued('2 Tabule Casero');h.cfg.agentV1Enabled=agent;
      Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,address:'Calle 9 20 30',addressConfirmed:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,paymentMethod:undefined});h.conv.state='awaiting_payment';
      const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued('Que precio tiene');
      if(answer==='acción'){
        await h.sendQueued('Mejor quiero tres Tabule Casero');expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:13802,qty:3})]));
        await h.sendQueued('Efectivo');expect(h.conv.sessionData.paymentMethod).toBeTruthy();expect(h.conv.sessionData.pendingPriceInquiry).toBeUndefined();return;
      }
      await h.sendQueued(answer==='otra consulta'?'¿Cuánto suma mi pedido?':answer==='repetir'?'Que precio tiene':answer==='desistir'?'No gracias':answer);
      expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.state).toBe('awaiting_payment');expect(h.conv.sessionData.paymentMethod).toBeUndefined();
      if(answer==='desistir'){
        expect(h.conv.sessionData.pendingPriceInquiry).toBeUndefined();await h.sendQueued('2');expect(h.conv.sessionData.paymentMethod).toBeTruthy();
      }else{
        expect(h.conv.sessionData.pendingPriceInquiry).toBeTruthy();const reply=await h.sendQueued('2');expect(reply).toMatch(/19[.,]000/);expect(h.conv.sessionData.paymentMethod).toBeUndefined();expect(h.conv.sessionData.pendingPriceInquiry).toBeUndefined();
      }
      expect(h.conv.sessionData.cart).toEqual(before);
    });
  }
});

describe('Consulta frente a compra — si cambio la bebida', () => {
  const pizza = [
    { id: 16701, code: 16701, name: 'Pizza Margarita', price: 28000, availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Bebida', options: ['Limonada', 'Agua'] }] },
    { id: 16702, code: 16702, name: 'Ensalada Verde', price: 9000, availableNow: true, hasAttributes: false, attributes: [] },
  ];
  const drink = (value: string) => [{ attributeName: 'Bebida', attributeValue: value }];

  it.each([false, true])('pregunta el precio y deja la bebida del combo (agent %s)', async (agent) => {
    const h = harness(products, agent);
    h.service.ordersService.create = jest.fn();
    h.conv.sessionData.cart = [{
      productId: 99, code: 99, name: 'Combo De Pollo Frito', unitPrice: 49000, quantity: 1,
      attributes: [...drink('Colombiana'), { attributeName: 'Arepas', attributeValue: 'Blancas' }],
    }, {
      productId: 7, code: 7, name: 'Porcion De Yuca Frita', unitPrice: 7000, quantity: 1, attributes: [],
    }];
    const before = structuredClone(h.cartRows());
    const reply = await h.sendQueued('si cambio la bebida cuánto vale');
    expect(h.cartRows()).toEqual(before);
    expect(reply || '').toMatch(/recargo de cambio confirmado/i);
    expect(reply || '').toMatch(/pedido sigue igual/i);
    expect(reply || '').not.toMatch(/Listo|agregu[eé]/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each([false, true])('pregunta el precio y deja la bebida de la pizza (agent %s)', async (agent) => {
    const h = harness(pizza, agent);
    h.service.ordersService.create = jest.fn();
    h.conv.sessionData.cart = [{
      productId: 16701, code: 16701, name: 'Pizza Margarita', unitPrice: 28000, quantity: 1, attributes: drink('Limonada'),
    }, {
      productId: 16702, code: 16702, name: 'Ensalada Verde', unitPrice: 9000, quantity: 1, attributes: [],
    }];
    const before = structuredClone(h.cartRows());
    const reply = await h.sendQueued('si cambio la bebida cuánto vale');
    expect(h.cartRows()).toEqual(before);
    expect(reply || '').toMatch(/recargo de cambio confirmado/i);
    expect(reply || '').toMatch(/pedido sigue igual/i);
    expect(h.cartRows().find((row) => row.id === 16702)?.note).toBeUndefined();
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('Foto — solo el segundo y dos del tercero', () => {
  const bowls = [
    { id: 17001, code: 17001, name: 'Bowl De Miso', price: 18000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 17002, code: 17002, name: 'Gyoza', price: 8000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 17003, code: 17003, name: 'Ramen De Miso', price: 24000, availableNow: true, hasAttributes: false, attributes: [] },
  ];
  const line = (id: number, name: string, price: number) => ({
    productId: id, code: id, name, unitPrice: price, quantity: 1, attributes: [] as { attributeName: string; attributeValue: string }[],
  });

  it.each([
    {
      agent: false,
      menu: products,
      remembered: [
        { productId: 17, name: 'Churrasco' },
        { productId: 7, name: 'Porcion De Yuca Frita' },
        { productId: 38, name: 'Sopa De Ajiaco' },
      ],
      cart: [line(17, 'Churrasco', 38000), line(7, 'Porcion De Yuca Frita', 7000), line(38, 'Sopa De Ajiaco', 10500)],
      keep: [7, 38],
      qty: 2,
    },
    {
      agent: true,
      menu: products,
      remembered: [
        { productId: 17, name: 'Churrasco' },
        { productId: 7, name: 'Porcion De Yuca Frita' },
        { productId: 38, name: 'Sopa De Ajiaco' },
      ],
      cart: [line(17, 'Churrasco', 38000), line(7, 'Porcion De Yuca Frita', 7000), line(38, 'Sopa De Ajiaco', 10500)],
      keep: [7, 38],
      qty: 2,
    },
    {
      agent: false,
      menu: bowls,
      remembered: [
        { productId: 17001, name: 'Bowl De Miso' },
        { productId: 17002, name: 'Gyoza' },
        { productId: 17003, name: 'Ramen De Miso' },
      ],
      cart: [line(17001, 'Bowl De Miso', 18000), line(17002, 'Gyoza', 8000), line(17003, 'Ramen De Miso', 24000)],
      keep: [17002, 17003],
      qty: 2,
    },
    {
      agent: true,
      menu: bowls,
      remembered: [
        { productId: 17001, name: 'Bowl De Miso' },
        { productId: 17002, name: 'Gyoza' },
        { productId: 17003, name: 'Ramen De Miso' },
      ],
      cart: [line(17001, 'Bowl De Miso', 18000), line(17002, 'Gyoza', 8000), line(17003, 'Ramen De Miso', 24000)],
      keep: [17002, 17003],
      qty: 2,
    },
  ])('deja el segundo y dos del tercero (agent $agent)', async ({ agent, menu, remembered, cart, keep, qty }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    h.conv.sessionData.cart = cart;
    h.conv.sessionData.recentImageOrder = remembered;
    const reply = await h.sendQueued('de la foto solo el segundo y dos del tercero');
    expect(h.cartRows().map((row) => row.id)).toEqual(keep);
    expect(h.cartRows()[0].qty).toBe(1);
    expect(h.cartRows()[1].qty).toBe(qty);
    expect(reply || '').toMatch(/de la foto/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each([false, true])('sin lista de la foto no agrega los platos otra vez (agent %s)', async (agent) => {
    const h = harness(products, agent);
    h.service.ordersService.create = jest.fn();
    h.conv.sessionData.cart = [line(17, 'Churrasco', 38000)];
    const before = structuredClone(h.cartRows());
    const reply = await h.sendQueued('de la foto solo el segundo y dos del tercero');
    expect(h.cartRows()).toEqual(before);
    expect(reply || '').toMatch(/no tengo la lista/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('Carta que cambia — opción retirada', () => {
  const flavor = (id: number, name: string, options: string[]) => ({
    id, code: id, name, price: 18000, availableNow: true, hasAttributes: true,
    attributes: [{ attributeName: 'Sabor', options }],
  });
  const side = (id: number, name: string) => ({
    id, code: id, name, price: 7000, availableNow: true, hasAttributes: false, attributes: [] as [],
  });
  const line = (id: number, name: string, price: number) => ({
    productId: id, code: id, name, unitPrice: price, quantity: 1, attributes: [] as { attributeName: string; attributeValue: string }[],
  });
  const pending = (id: number, name: string, options: string[]) => ({
    productId: id, name, code: id, price: 18000,
    attributes: [{ attributeName: 'Sabor', options: [...options] }],
    selected: [] as { attributeName: string; attributeValue: string }[],
  });

  it.each([
    { agent: false, drink: flavor(50, 'Jugo Natural En Agua', ['Mango', 'Lulo']), sideItem: side(7, 'Porcion De Yuca Frita'), shown: ['Mango', 'Guanabana', 'Lulo'], gone: 'Guanabana', kept: 'Lulo' },
    { agent: true, drink: flavor(50, 'Jugo Natural En Agua', ['Mango', 'Lulo']), sideItem: side(7, 'Porcion De Yuca Frita'), shown: ['Mango', 'Guanabana', 'Lulo'], gone: 'Guanabana', kept: 'Lulo' },
    { agent: false, drink: flavor(17301, 'Ramen De Miso', ['Miso', 'Tonkotsu']), sideItem: side(17302, 'Edamame'), shown: ['Miso', 'Shoyu', 'Tonkotsu'], gone: 'Shoyu', kept: 'Tonkotsu' },
    { agent: true, drink: flavor(17301, 'Ramen De Miso', ['Miso', 'Tonkotsu']), sideItem: side(17302, 'Edamame'), shown: ['Miso', 'Shoyu', 'Tonkotsu'], gone: 'Shoyu', kept: 'Tonkotsu' },
  ])('el número de la opción retirada no cambia el resto (agent $agent)', async ({ agent, drink, sideItem, shown, gone, kept }) => {
    const h = harness([drink, sideItem] as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    h.conv.state = 'awaiting_attribute';
    h.conv.sessionData.cart = [line(sideItem.id, sideItem.name, sideItem.price)];
    h.conv.sessionData.pendingAttribute = pending(drink.id, drink.name, shown);
    const reply = await h.sendQueued('2');
    expect(reply || '').toMatch(new RegExp(gone, 'i'));
    expect(reply || '').toMatch(/no la apliqu/i);
    expect(h.cartRows().map((row) => row.id)).toEqual([sideItem.id]);
    expect(h.conv.sessionData.pendingAttribute?.attributes?.[0].options).not.toContain(gone);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    const follow = await h.sendQueued('2');
    expect(h.cartRows().find((row) => row.id === drink.id)?.attrs).toContain(`Sabor:${kept}`);
    expect(h.cartRows().some((row) => row.id === sideItem.id)).toBe(true);
    expect(follow || '').not.toMatch(new RegExp(gone, 'i'));
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each([false, true])('un plato retirado no se agrega y el acompañamiento queda (agent %s)', async (agent) => {
    const yuca = side(7, 'Porcion De Yuca Frita');
    const h = harness([yuca] as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    h.conv.state = 'awaiting_attribute';
    h.conv.sessionData.cart = [line(7, 'Porcion De Yuca Frita', 7000)];
    h.conv.sessionData.pendingAttribute = pending(50, 'Jugo Natural En Agua', ['Mango', 'Guanabana', 'Lulo']);
    const reply = await h.sendQueued('2');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 7, qty: 1 })]);
    expect(h.conv.sessionData.pendingAttribute).toBeUndefined();
    expect(reply || '').toMatch(/ya no está en la carta/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('Adiciones — códigos y productos desconocidos',()=>{
 const menus=[['Pizza De Setas','Agua Mineral'],['Bowl De Quinoa','Te Helado']].map((names,index)=>names.map((name,offset)=>({id:19601+index*10+offset,code:601+index*10+offset,name,price:13000,availableNow:true,hasAttributes:false,attributes:[]})));
 it.each(menus.flatMap(menu=>[false,true].flatMap(agent=>['building_cart','awaiting_address','awaiting_payment'].flatMap(state=>['codigo2','codigo1','codigoSolo','codigoNombre','desconocido1','desconocido2'].map(kind=>({menu,agent,state,kind}))))))('$kind en $state (agent $agent)',async({menu,agent,state,kind})=>{
  const h=harness(menu as typeof products,agent);h.service.ordersService.create=jest.fn();h.conv.state=state;
  h.conv.sessionData.address='Calle 12 #34-56';h.conv.sessionData.addressConfirmed=true;
  h.conv.sessionData.cart=[{productId:menu[1].id,code:menu[1].code,name:menu[1].name,unitPrice:13000,quantity:2,attributes:[],note:'sin hielo'}];
  const before=structuredClone(h.conv.sessionData.cart);
  const text=kind==='codigo2'?`Agrega dos del código ${menu[0].code}`:kind==='codigo1'?`Añade un #${menu[0].code}`:kind==='codigoSolo'?`Agrega #${menu[0].code}`:kind==='codigoNombre'?`Ponme código ${menu[0].code}`:kind==='desconocido1'?'Agrega un pastel lunar':'Añade dos croquetas estelares';
  const reply=await h.sendQueued(text);
  expect(h.conv.sessionData.address).toBe('Calle 12 #34-56');
  if(kind.startsWith('codigo'))expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:menu[1].id,qty:2,note:'sin hielo'}),expect.objectContaining({id:menu[0].id,qty:kind==='codigo2'?2:1})]));
  else {expect(h.conv.sessionData.cart).toEqual(before);expect(reply||'').toMatch(/no (?:tenemos|manejamos|encontré|encontre)|no está|no aparece/i);}
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});

describe('Adiciones — código inexistente y referencia de domicilio',()=>{
 const menus=[['Pizza De Setas','Agua Mineral'],['Bowl De Quinoa','Te Helado']].map((names,index)=>names.map((name,offset)=>({id:19701+index*10+offset,code:701+index*10+offset,name,price:13000,availableNow:true,hasAttributes:false,attributes:[]})));
 it.each(menus.flatMap(menu=>[false,true].flatMap(agent=>['building_cart','awaiting_address','awaiting_payment'].map(state=>({menu,agent,state})))))('código desconocido no cambia $state (agent $agent)',async({menu,agent,state})=>{
  const h=harness(menu as typeof products,agent);h.service.ordersService.create=jest.fn();h.conv.state=state;h.conv.sessionData.address='Calle 12 #34-56';
  h.conv.sessionData.cart=[{productId:menu[1].id,name:menu[1].name,code:menu[1].code,unitPrice:13000,quantity:2,attributes:[]}];
  const before=structuredClone(h.conv.sessionData.cart);const reply=await h.sendQueued('Agrega dos #9999');
  expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.address).toBe('Calle 12 #34-56');expect(h.conv.state).toBe(state);
  expect(reply||'').toMatch(/no encontré/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it.each(menus.flatMap(menu=>[false,true].flatMap(agent=>['apartamento','torre'].map(place=>({menu,agent,place})))))('$place no se compra como producto (agent $agent)',async({menu,agent,place})=>{
  const h=harness(menu as typeof products,agent);h.service.ordersService.create=jest.fn();h.conv.state='awaiting_address';h.conv.sessionData.address='Calle 12 #34-56';
  h.conv.sessionData.cart=[{productId:menu[1].id,name:menu[1].name,code:menu[1].code,unitPrice:13000,quantity:2,attributes:[]}];
  const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued(`Añade un ${place} #${menu[0].code}`);
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(h.conv.sessionData.address).toContain(place);expect(h.conv.sessionData.address).toContain(String(menu[0].code));
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});

describe('Adición con dirección — completar sin repetirla',()=>{
 it.each(['Pizza De Setas','Bowl De Quinoa'].flatMap((name,index)=>[false,true].map(agent=>({name,index,agent}))))('$name (agent $agent)',async({name,index,agent})=>{
  const p={id:19801+index,code:801+index,name,price:17000,availableNow:true,hasAttributes:false,attributes:[]};
  const base={id:19811,code:811,name:'Agua Mineral',price:4000,availableNow:true,hasAttributes:false,attributes:[]};
  const h=harness([p,base] as typeof products,agent);h.service.ordersService.create=jest.fn();h.conv.state='awaiting_address';h.conv.sessionData.address=undefined;
  h.conv.sessionData.cart=[{productId:base.id,name:base.name,code:base.code,unitPrice:4000,quantity:2,attributes:[]}];
  const reply=await h.sendQueued(`Añade dos ${name} para la calle 9 #18-27`);
  expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:base.id,qty:2}),expect.objectContaining({id:p.id,qty:2})]));
  expect(h.conv.sessionData.address).toMatch(/calle 9.*18-27/i);
  expect(reply||'').not.toMatch(/escribe.*dirección|dirección correcta|misma dirección|otra dirección/i);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});

describe('Adición de varios códigos — cantidades independientes',()=>{
 const menus=[['Pizza De Setas','Pan De Ajo','Agua Mineral'],['Bowl De Quinoa','Edamame','Te Helado']].map((names,index)=>names.map((name,offset)=>({id:19901+index*10+offset,code:901+index*10+offset,name,price:10000+offset*2000,availableNow:true,hasAttributes:false,attributes:[]})));
 it.each(menus.flatMap(menu=>[false,true].flatMap(agent=>['building_cart','awaiting_address','awaiting_payment'].flatMap(state=>[false,true].map(explicit=>({menu,agent,state,explicit}))))))('dos códigos en $state explicit=$explicit agent=$agent',async({menu,agent,state,explicit})=>{
  const h=harness(menu as typeof products,agent);h.service.ordersService.create=jest.fn();h.conv.state=state;h.conv.sessionData.address='Calle 12 #34-56';
  h.conv.sessionData.cart=[{productId:menu[2].id,name:menu[2].name,code:menu[2].code,unitPrice:menu[2].price,quantity:1,attributes:[],note:'sin hielo'}];
  await h.sendQueued(explicit?`Agrega dos #${menu[0].code} y tres #${menu[1].code}`:`Ponme código ${menu[0].code} y código ${menu[1].code}`);
  expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:menu[0].id,qty:explicit?2:1}),expect.objectContaining({id:menu[1].id,qty:explicit?3:1}),expect.objectContaining({id:menu[2].id,qty:1,note:'sin hielo'})]));
  expect(h.cartRows()).toHaveLength(3);expect(h.conv.sessionData.address).toBe('Calle 12 #34-56');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it.each(menus.flatMap(menu=>[false,true].map(agent=>({menu,agent}))))('dos códigos con placa de dirección (agent $agent)',async({menu,agent})=>{
  const h=harness(menu as typeof products,agent);h.service.ordersService.create=jest.fn();h.conv.state='awaiting_address';h.conv.sessionData.address=undefined;
  h.conv.sessionData.cart=[{productId:menu[2].id,name:menu[2].name,code:menu[2].code,unitPrice:menu[2].price,quantity:1,attributes:[]}];
  const reply=await h.sendQueued(`Agrega dos #${menu[0].code} y tres #${menu[1].code} para la calle   9 #18-27`);
  expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:menu[0].id,qty:2}),expect.objectContaining({id:menu[1].id,qty:3}),expect.objectContaining({id:menu[2].id,qty:1})]));
  expect(h.conv.sessionData.address).toMatch(/calle\s+9.*18-27/i);
  expect(reply||'').not.toMatch(/no encontré|escribe.*dirección/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });

});

describe('Compra explícita y consulta de precio — mismo mensaje',()=>{
 it.each(['Pizza De Setas','Bowl De Quinoa'].flatMap((name,index)=>[false,true].flatMap(agent=>['building_cart','awaiting_payment'].map(state=>({name,index,agent,state})))))('$name en $state agent=$agent',async({name,index,agent,state})=>{
  const p={id:20001+index,code:951+index,name,price:17000,availableNow:true,hasAttributes:false,attributes:[]};
  const h=harness([p] as typeof products,agent);h.service.ordersService.create=jest.fn();h.conv.state=state;h.conv.sessionData.address='Calle 12 #34-56';
  const reply=await h.sendQueued(`Añade dos ${name}; ¿cuánto vale cada uno?`);
  expect(h.cartRows()).toEqual([expect.objectContaining({id:p.id,qty:2})]);expect(reply||'').toMatch(/17\.000/);
  expect(h.conv.sessionData.address).toBe('Calle 12 #34-56');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});


describe('Códigos explícitos — identidad y reconocimiento parcial',()=>{
 const menus=['Trio De Tacos','Bowl Especial'].map((name,index)=>[
  {id:20301+index*10,code:1011+index*10,name,price:39000,availableNow:true,hasAttributes:false,attributes:[]},
  {id:20302+index*10,code:1012+index*10,name,price:34000,availableNow:true,hasAttributes:false,attributes:[]},
 ]);
 it.each(menus.flatMap(menu=>[false,true].flatMap(agent=>['building_cart','awaiting_address','awaiting_payment'].map(state=>({menu,agent,state})))))('conserva dos SKU homónimos en $state agent=$agent',async({menu,agent,state})=>{
  const h=harness(menu as typeof products,agent);h.service.ordersService.create=jest.fn();h.conv.state=state;h.conv.sessionData.address='Calle 12 #34-56';
  await h.sendQueued(`Agrega dos #${menu[0].code} y tres #${menu[1].code}`);
  expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:menu[0].id,qty:2}),expect.objectContaining({id:menu[1].id,qty:3})]));
  expect(h.cartRows()).toHaveLength(2);expect(h.conv.sessionData.cart.map(line=>line.unitPrice).sort()).toEqual([34000,39000]);
  expect(h.conv.sessionData.address).toBe('Calle 12 #34-56');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it.each(menus.flatMap(menu=>[false,true].map(agent=>({menu,agent}))))('añade el código conocido y explica el desconocido agent=$agent',async({menu,agent})=>{
  const h=harness(menu as typeof products,agent);h.service.ordersService.create=jest.fn();h.conv.state='awaiting_payment';h.conv.sessionData.address='Calle 12 #34-56';
  const reply=await h.sendQueued(`Agrega dos #${menu[0].code} y un #9999`);
  expect(h.cartRows()).toEqual([expect.objectContaining({id:menu[0].id,qty:2})]);
  expect(reply||'').toMatch(/9999/);expect(reply||'').not.toMatch(/carrito sigue igual/i);
  expect(h.conv.sessionData.address).toBe('Calle 12 #34-56');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it.each(menus.flatMap(menu=>[false,true].map(agent=>({menu,agent}))))('consulta de códigos no compra agent=$agent',async({menu,agent})=>{
  const h=harness(menu as typeof products,agent);h.service.ordersService.create=jest.fn();h.conv.state='awaiting_payment';h.conv.sessionData.address='Calle 12 #34-56';
  const before=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued(`¿Cuánto cuestan código ${menu[0].code} y código ${menu[1].code}?`);
  expect(h.conv.sessionData.cart).toEqual(before);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it.each(menus.flatMap(menu=>[false,true].map(agent=>({menu,agent}))))('códigos sin cantidad son una copia agent=$agent',async({menu,agent})=>{
  const h=harness(menu as typeof products,agent);h.service.ordersService.create=jest.fn();h.conv.state='awaiting_payment';
  await h.sendQueued(`Ponme código ${menu[0].code} y código ${menu[1].code}`);
  expect(h.cartRows()).toEqual(expect.arrayContaining(menu.map(p=>expect.objectContaining({id:p.id,qty:1}))));
  expect(h.cartRows()).toHaveLength(2);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});

describe('Código homónimo — atributos y disponibilidad',()=>{
 it.each(['Pizza Especial','Bowl Especial'].flatMap((name,index)=>[false,true].flatMap(agent=>[false,true].map(available=>({name,index,agent,available})))))('SKU elegido available=$available agent=$agent',async({name,index,agent,available})=>{
  const menu=[0,1].map(offset=>({id:20701+index*10+offset,code:1401+index*10+offset,name,price:17000+offset*2000,availableNow:offset===0||available,hasAttributes:true,attributes:[{attributeName:'Salsa',options:['Suave','Picante']}]}));
  const h=harness(menu as typeof products,agent);h.service.ordersService.create=jest.fn();h.conv.state='awaiting_payment';h.conv.sessionData.address='Calle 12 #34-56';
  const reply=await h.sendQueued(`Añade dos #${menu[1].code} con salsa suave`);
  if(available){expect(h.cartRows()).toEqual([expect.objectContaining({id:menu[1].id,qty:2,attrs:['Salsa:Suave']})]);expect(h.conv.sessionData.cart[0].unitPrice).toBe(19000);}
  else {expect(h.cartRows()).toEqual([]);expect(reply||'').toMatch(/no manejamos|no disponible|no encontré/i);}
  expect(h.conv.sessionData.address).toBe('Calle 12 #34-56');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it.each(['Pizza De Setas','Bowl De Quinoa'].flatMap((name,index)=>[false,true].map(agent=>({name,index,agent}))))('la aclaración posterior actualiza sin perder nota agent=$agent',async({name,index,agent})=>{
  const p={id:20801+index,code:1501+index,name,price:17000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Salsa',options:['Suave','Picante']}]};
  const h=harness([p] as typeof products,agent);h.service.ordersService.create=jest.fn();h.conv.state='awaiting_payment';h.conv.sessionData.address='Calle 12 #34-56';
  h.conv.sessionData.cart=[{productId:p.id,name:p.name,code:p.code,unitPrice:17000,quantity:2,attributes:[{attributeName:'Salsa',attributeValue:'Picante'}],note:'sin cebolla'}];
  await h.sendQueued('No con salsa picante');await h.sendQueued('Salsa suave');
  expect(h.cartRows()).toEqual([expect.objectContaining({id:p.id,qty:2,attrs:['Salsa:Suave'],note:'sin cebolla'})]);
  expect(h.conv.sessionData.paymentMethod).toBeUndefined();expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});

describe('Paráfrasis de lista — qué trae y cuánto vale', () => {
  const synthetic = (base: string, id: number) => [
    { id, code: id - 28000 + 810, name: `${base} Solo`, price: 22000, availableNow: true, hasAttributes: false, attributes: [] as { attributeName: string; options: string[] }[], description: 'Porción individual' },
    { id: id + 1, code: id - 28000 + 811, name: `Combo ${base} Con Pollo`, price: 29000, availableNow: true, hasAttributes: false, attributes: [] as { attributeName: string; options: string[] }[], description: 'Incluye pollo y bebida' },
    { id: id + 2, code: id - 28000 + 812, name: `Combo ${base} Con Costillas`, price: 31000, availableNow: true, hasAttributes: false, attributes: [] as { attributeName: string; options: string[] }[], description: 'Incluye costillas y bebida' },
  ];
  const lists = [
    { kind: 'ppp', menu: products, text: 'que arroces maneja' },
    { kind: 'pizza', menu: synthetic('Pizza Rustica', 28001), text: 'tienen pizza rustica' },
    { kind: 'ramen', menu: synthetic('Ramen De Miso', 28011), text: 'tienen ramen de miso' },
    { kind: 'tacos', menu: synthetic('Taco Al Pastor', 28021), text: 'tienen taco al pastor' },
    { kind: 'burger', menu: synthetic('Hamburguesa De Lentejas', 28031), text: 'tienen hamburguesa de lentejas' },
    { kind: 'sushi', menu: synthetic('Roll De Salmon', 28041), text: 'tienen roll de salmon' },
    { kind: 'pasta', menu: synthetic('Pasta Al Pesto', 28051), text: 'tienen pasta al pesto' },
    { kind: 'bowl', menu: synthetic('Bowl De Quinoa', 28061), text: 'tienen bowl de quinoa' },
  ];
  const questions = ['¿Qué trae la 2?', '¿Qué incluye el 2?', '¿Cómo es 2?'];

  it.each(lists.flatMap((item) => questions.flatMap((question) => [false, true].map((agent) => ({ ...item, question, agent })))))(
    '$kind $question describe sin comprar (agent $agent)',
    async ({ menu, text, question, agent }) => {
      const h = harness(menu as typeof products, agent);
      h.service.ordersService.create = jest.fn();
      await h.sendQueued(text);
      const options = structuredClone(h.conv.sessionData.pendingMatch);
      const chosen = options!.candidates[1];
      const reply = await h.sendQueued(question);
      expect(reply || '').toContain(chosen.name);
      expect(reply || '').toContain(chosen.description!);
      expect(h.cartRows()).toEqual([]);
      expect(h.conv.sessionData.pendingMatch).toEqual(options);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    },
  );

  it.each(['Cuánto vale el segundo', 'Cuánto cuesta la 2', 'A cómo está la segunda'].flatMap((phrase) => [false, true].map((agent) => ({ phrase, agent }))))(
    'ppp $phrase conserva el sabor pendiente (agent $agent)',
    async ({ phrase, agent }) => {
      const dish = products.find((item) => /^arroz paisa$/i.test(item.name))!;
      const side = products.find((item) => /limonada natural/i.test(item.name))!;
      const drink = products.find((item) => /jugo natural en agua/i.test(item.name))!;
      const h = harness(products, agent);
      h.service.ordersService.create = jest.fn();
      h.conv.state = 'awaiting_attribute';
      h.conv.sessionData.cart = [
        { productId: dish.id, name: dish.name, code: dish.code, unitPrice: dish.price, quantity: 4, attributes: [], note: 'sin cilantro' },
        { productId: side.id, name: side.name, code: side.code, unitPrice: side.price, quantity: 1, attributes: [] },
      ];
      h.conv.sessionData.pendingAttribute = {
        productId: drink.id, name: drink.name, code: drink.code, price: drink.price,
        attributes: drink.attributes, selected: [], quantity: 3, sourceText: `3 ${drink.name} sin azúcar`,
      };
      h.conv.sessionData.pendingPriceInquiry = {
        productIds: [dish.id, side.id], cartSignature: JSON.stringify(h.conv.sessionData.cart), state: h.conv.state,
      };
      const before = structuredClone(h.conv.sessionData);
      const reply = await h.sendQueued(phrase);
      expect(reply || '').toContain(side.name);
      expect(reply || '').toContain(h.service.catalogService.formatMoney(side.price));
      expect(h.conv.sessionData.cart).toEqual(before.cart);
      expect(h.conv.sessionData.pendingAttribute).toEqual(before.pendingAttribute);
      expect(h.conv.sessionData.pendingPriceInquiry).toBeUndefined();
      const flavor = drink.attributes[0].options[1];
      await h.sendQueued(flavor);
      expect(h.cartRows()).toEqual([
        expect.objectContaining({ id: dish.id, qty: 4 }),
        expect.objectContaining({ id: side.id, qty: 1 }),
        expect.objectContaining({ id: drink.id, qty: 3, attrs: [`${drink.attributes[0].attributeName}:${flavor}`] }),
      ]);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    },
  );

  it.each(['Pizza Rustica', 'Ramen De Miso', 'Taco Al Pastor'].flatMap((name) => [false, true].map((agent) => ({ name, agent }))))(
    '$name cuánto vale el 99 no cambia el pedido (agent $agent)',
    async ({ name, agent }) => {
      const dish = { id: 28101, code: 9101, name, price: 10500, availableNow: true, hasAttributes: false, attributes: [] as { attributeName: string; options: string[] }[] };
      const water = { id: 28102, code: 9102, name: 'Agua Mineral', price: 3000, availableNow: true, hasAttributes: false, attributes: [] as { attributeName: string; options: string[] }[] };
      const drink = { id: 28103, code: 9103, name: 'Jugo Tropical', price: 6500, availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Sabor', options: ['Mango', 'Lulo'] }] };
      const h = harness([dish, water, drink] as typeof products, agent);
      h.service.ordersService.create = jest.fn();
      h.conv.state = 'awaiting_attribute';
      h.conv.sessionData.cart = [
        { productId: dish.id, name, code: dish.code, unitPrice: dish.price, quantity: 1, attributes: [] },
        { productId: water.id, name: water.name, code: water.code, unitPrice: water.price, quantity: 1, attributes: [] },
      ];
      h.conv.sessionData.pendingAttribute = {
        productId: drink.id, name: drink.name, code: drink.code, price: drink.price,
        attributes: drink.attributes, selected: [], quantity: 3, sourceText: '3 Jugo Tropical',
      };
      h.conv.sessionData.pendingPriceInquiry = {
        productIds: [dish.id, water.id], cartSignature: JSON.stringify(h.conv.sessionData.cart), state: h.conv.state,
      };
      const before = structuredClone(h.conv.sessionData);
      const reply = await h.sendQueued('Cuánto vale el 99');
      expect(h.conv.sessionData).toEqual(before);
      expect(reply || '').toMatch(/n[uú]mero|elige/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    },
  );
});

describe('Cambio de opción — la nota elige la línea', () => {
  const families = [
    { kind: 'pizza', name: 'Pizza Campestre', attr: 'Masa', from: 'Delgada', to: 'Gruesa' },
    { kind: 'ramen', name: 'Ramen De La Casa', attr: 'Caldo', from: 'Miso', to: 'Shoyu' },
    { kind: 'tacos', name: 'Taco De La Casa', attr: 'Tortilla', from: 'Maiz', to: 'Harina' },
    { kind: 'burger', name: 'Hamburguesa De La Casa', attr: 'Pan', from: 'Brioche', to: 'Integral' },
    { kind: 'sushi', name: 'Roll De La Casa', attr: 'Base', from: 'Arroz', to: 'Quinoa' },
    { kind: 'pasta', name: 'Pasta De La Casa', attr: 'Pasta', from: 'Spaghetti', to: 'Penne' },
    { kind: 'bowl', name: 'Bowl De La Casa', attr: 'Base', from: 'Arroz', to: 'Quinoa' },
  ];

  it.each(families.flatMap((family) => [false, true].map((agent) => ({ family, agent }))))(
    '$family.kind la nota elige cuál cambia (agent $agent)',
    async ({ family, agent }) => {
      const dish = {
        id: 29101 + families.indexOf(family), code: 1100 + families.indexOf(family), name: family.name, price: 22000,
        availableNow: true, hasAttributes: true, attributes: [{ attributeName: family.attr, options: [family.from, family.to] }],
      };
      const h = harness([dish] as typeof products, agent);
      h.service.ordersService.create = jest.fn();
      h.conv.sessionData.cart = [
        { productId: dish.id, name: dish.name, code: dish.code, unitPrice: dish.price, quantity: 1, attributes: [{ attributeName: family.attr, attributeValue: family.from }], note: 'sin cilantro' },
        { productId: dish.id, name: dish.name, code: dish.code, unitPrice: dish.price, quantity: 1, attributes: [{ attributeName: family.attr, attributeValue: family.from }], note: 'con cilantro' },
      ];
      const asked = await h.sendQueued(`cambia ${family.attr} a ${family.to}`);
      expect(asked || '').toMatch(/cu[aá]l plato/i);
      expect(h.conv.sessionData.pendingCartAttributeEdit?.candidates).toHaveLength(2);
      await h.sendQueued('la sin cilantro');
      expect(h.cartRows()).toEqual([
        expect.objectContaining({ id: dish.id, qty: 1, attrs: [`${family.attr}:${family.to}`], note: 'sin cilantro' }),
        expect.objectContaining({ id: dish.id, qty: 1, attrs: [`${family.attr}:${family.from}`], note: 'con cilantro' }),
      ]);
      expect(h.conv.sessionData.pendingCartAttributeEdit).toBeUndefined();
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])('ppp la nota elige el ejecutivo (agent %s)', async (agent) => {
    const dish = products.find((item) => /ejecutivo con pollo frito/i.test(item.name))!;
    const drink = dish.attributes.find((attr) => /bebida/i.test(attr.attributeName))!;
    const from = drink.options[0];
    const to = drink.options.find((option) => /pepsi/i.test(option)) || drink.options[1];
    const h = harness(products, agent);
    h.service.ordersService.create = jest.fn();
    const baseAttrs = dish.attributes.map((attr) => ({ attributeName: attr.attributeName, attributeValue: attr.options[0] }));
    h.conv.sessionData.cart = [0, 1].map(() => ({
      productId: dish.id, name: dish.name, code: dish.code, unitPrice: dish.price, quantity: 1,
      attributes: baseAttrs.map((attr) => ({ ...attr })), note: '',
    }));
    h.conv.sessionData.cart[0].note = 'sin cilantro';
    h.conv.sessionData.cart[1].note = 'con cilantro';
    await h.sendQueued(`cambia la bebida a ${to}`);
    expect(h.conv.sessionData.pendingCartAttributeEdit?.candidates).toHaveLength(2);
    await h.sendQueued('la sin cilantro');
    const rows = h.cartRows();
    expect(rows.find((row) => row.note === 'sin cilantro')?.attrs).toContain(`${drink.attributeName}:${to}`);
    expect(rows.find((row) => row.note === 'con cilantro')?.attrs).toContain(`${drink.attributeName}:${from}`);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('“una X y otra X” — cada mención es una unidad',()=>{
 const arepa=[{id:45001,code:45001,name:'Arepa De Queso',price:8000,description:'Maiz y queso',availableNow:true,hasAttributes:true,attributes:[{attributeName:'Salsa',options:['Hogao','Sin salsa']}]}];
 it.each([
  {kind:'ppp idéntica',menu:products,text:'Quiero una trucha frita y otra trucha frita',id:12,lines:[{qty:2,attrs:['Seleccion:Frita']}]},
  {kind:'ppp sin atributo',menu:products,text:'Quiero un churrasco y otro churrasco',id:17,lines:[{qty:2}]},
  {kind:'carta idéntica',menu:arepa,text:'Quiero una arepa de queso con hogao y otra arepa de queso con hogao',id:45001,lines:[{qty:2,attrs:['Salsa:Hogao']}]},
  {kind:'carta variantes',menu:arepa,text:'Quiero una arepa de queso con hogao y otra arepa de queso sin salsa',id:45001,lines:[{qty:1,attrs:['Salsa:Hogao']},{qty:1,attrs:['Salsa:Sin salsa']}]},
 ].flatMap(c=>[{...c,agent:false},{...c,agent:true}]))('$kind agente=$agent',async({menu,text,id,lines,agent})=>{
  const h=harness(menu as typeof products,agent);
  const reply=await h.sendQueued(text)||'';
  const rows=h.cartRows().filter(r=>r.id===id).map(r=>({qty:r.qty,...(r.attrs?.length?{attrs:r.attrs}:{})}));
  expect(rows.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))).toEqual(lines);
  expect(h.cartRows().every(r=>!r.note)).toBe(true);
  expect(reply).toMatch(/Listo/);
 });
});

describe('Referencias — pregunta activa y otros múltiples',()=>{
 it.each([false,true])('otro ambiguo y elección 2 no es pago agent=%s',async agent=>{
  const menu=['Bowl De Lentejas','Pasta De Hongos','Caja De Dumplings'].map((name,i)=>({id:9841+i,code:9841+i,name,description:'Con arroz',price:21000,availableNow:true,hasAttributes:false,attributes:[]}));
  const h=harness(menu,agent);h.conv.state='awaiting_payment';h.conv.customerName='Ana';h.conv.sessionData={cart:menu.map(p=>({productId:p.id,name:p.name,code:p.code,unitPrice:p.price,quantity:1,attributes:[]})),productFocus:{productId:9841,name:menu[0].name},orderType:'delivery',address:'Calle 12 30 45',addressConfirmed:true};
  const before=structuredClone(h.conv.sessionData.cart);const reply=await h.send('El otro trae salsa de ajo?');expect(reply).toMatch(/de qu[eé] plato/i);expect(h.conv.sessionData.pendingCompositionAsk?.productIds).toEqual([9842,9843]);
  const answer=await h.send('2');expect(answer).toContain('Caja De Dumplings');expect(answer).toMatch(/no tengo ese detalle confirmado/i);expect(h.conv.sessionData.paymentMethod).toBeUndefined();expect(h.conv.state).toBe('awaiting_payment');expect(h.conv.sessionData.cart).toEqual(before);
 });
 it.each([false,true])('el plato pendiente prevalece sobre foco anterior agent=%s',async agent=>{
  const menu=[{id:9851,code:9851,name:'Bowl De Lentejas',description:'Con arroz',price:21000,availableNow:true,hasAttributes:false,attributes:[]},{id:9852,code:9852,name:'Caja De Dumplings',description:'Sin salsa de ajo',price:23000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Agua','Limonada']}]}];
  const h=harness(menu,agent);h.conv.state='awaiting_attribute';h.conv.sessionData={cart:[{productId:9851,name:menu[0].name,code:9851,unitPrice:21000,quantity:1,attributes:[]}],productFocus:{productId:9851,name:menu[0].name},pendingAttribute:{productId:9852,name:menu[1].name,code:9852,price:23000,quantity:2,sourceText:'dos cajas',attributes:menu[1].attributes,selected:[]},orderType:'delivery'};
  const before=structuredClone(h.conv.sessionData);const reply=await h.send('Y ese trae salsa de ajo?');expect(reply).toContain('Caja De Dumplings');expect(reply).toContain('Sin salsa de ajo');expect(reply).not.toContain('Bowl De Lentejas');expect(h.conv.sessionData).toEqual(before);expect(h.conv.state).toBe('awaiting_attribute');
 });
});

describe('Consulta de sustitución — retoma el dato pendiente sin editar', () => {
  const fixtures = [
    { id: 19101, name: 'Bowl De Garbanzos', attr: 'Base', options: ['Arroz', 'Quinoa'] },
    { id: 19102, name: 'Pasta Del Huerto', attr: 'Salsa', options: ['Tomate', 'Pesto'] },
  ];
  for (const f of fixtures) {
    for (const state of ['awaiting_name', 'awaiting_phone', 'awaiting_address', 'awaiting_payment', 'awaiting_final_confirm']) {
      for (const questionKind of ['opción', 'recargo', 'cambiar', 'reemplazar']) {
        it(`${f.name}: ${state}, consulta de ${questionKind}`, async () => {
          const menu = [{ ...f, code: f.id, price: 23000, availableNow: true, hasAttributes: true,
            attributes: [{ attributeName: f.attr, options: f.options }] }];
          const h = harness(menu, false);
          h.conv.state = state;
          h.conv.customerName = state === 'awaiting_name' ? '' : 'Ana';
          Object.assign(h.conv.sessionData, {
            orderType: 'delivery', address: 'Calle 12 30 45', addressConfirmed: true,
            contactPhone: h.conv.phoneE164, phoneConfirmed: true, deliveryFeeCalculated: 2000,
            ...(state === 'awaiting_final_confirm' ? { paymentMethod: 'cash' } : {}),
            cart: [{ productId: f.id, code: f.id, name: f.name, quantity: 2, unitPrice: 23000,
              note: 'sin cebolla', attributes: [{ attributeName: f.attr, attributeValue: f.options[0] }] }],
          });
          const before = structuredClone(h.conv.sessionData);
          const question = questionKind === 'recargo' ? `¿Cuánto cuesta cambiar ${f.attr} a ${f.options[1]}?`
            : questionKind === 'cambiar' ? `¿Puedo cambiar ${f.options[0]} por ${f.options[1]}?`
            : questionKind === 'reemplazar' ? `¿Es posible reemplazar ${f.options[0]} por ${f.options[1]}?`
            : `¿Se puede con ${f.options[1]}?`;
          const reply = await h.sendQueued(question);
          expect(h.conv.sessionData).toEqual(before);
          expect(h.conv.state).toBe(state);
          expect(reply).not.toMatch(/gratis|sin recargo|ya.*cambi|agregué/i);
          expect(reply).toMatch(state === 'awaiting_name' ? /nombre/i : state === 'awaiting_phone' ? /teléfono/i : state === 'awaiting_address' ? /dirección/i : state === 'awaiting_payment' ? /pagas|pago|contraentrega|transferencia/i : /confirmar/i);
          if (questionKind === 'recargo') expect(reply).toMatch(/recargo.*confirmado/i);
        });
      }
    }
  }
});

describe('Recargo consultado y edición independiente — no confundir con total', () => {
  for (const f of [
    { id: 20101, name: 'Combo De Wraps', side: 'Sopa De Hongos', attr: 'Bebida', first: 'Te', next: 'Agua' },
    { id: 20111, name: 'Combo De Bao', side: 'Edamame', attr: 'Salsa', first: 'Soja', next: 'Teriyaki' },
  ]) for (const agent of [false, true]) for (const state of ['awaiting_name', 'awaiting_payment']) {
    for (const order of ['primero', 'después']) for (const kind of ['quitar', 'cantidad']) {
      it(`${f.name}, ${agent}, ${state}, consulta ${order}, ${kind}`, async () => {
        const menu = [
          { id: f.id, code: f.id, name: f.name, price: 21000, availableNow: true, hasAttributes: true,
            attributes: [{ attributeName: f.attr, options: [f.first, f.next] }] },
          { id: f.id + 1, code: f.id + 1, name: f.side, price: 6000, availableNow: true, hasAttributes: false, attributes: [] },
        ];
        const h = harness(menu, agent);
        h.conv.state = state;
        h.conv.customerName = state === 'awaiting_name' ? '' : 'Ana';
        h.service.ordersService.create = jest.fn();
        Object.assign(h.conv.sessionData, {
          orderType: 'delivery', address: 'Calle 12 30 45', addressConfirmed: true,
          phoneConfirmed: true, contactPhone: h.conv.phoneE164, deliveryFeeCalculated: 3000,
          cart: [{ productId: f.id, code: f.id, name: f.name, unitPrice: 21000, quantity: 2, note: 'sin cebolla',
            attributes: [{ attributeName: f.attr, attributeValue: f.first }] },
            { productId: f.id + 1, code: f.id + 1, name: f.side, unitPrice: 6000, quantity: 3, note: 'aparte', attributes: [] }],
        });
        const host = structuredClone(h.conv.sessionData.cart[0]);
        const edit = kind === 'quitar' ? `Quita una de las ${f.side}` : `Deja solo dos ${f.side}`;
        const inquiry = `cuánto me cobran por cambiar ${f.attr} a ${f.next}`;
        await h.sendQueued(order === 'primero' ? `¿${inquiry}? ${edit}` : `${edit} y dime ${inquiry}`);
        expect(h.conv.sessionData.cart[0]).toEqual(host);
        expect(h.cartRows()[1]).toMatchObject({ id: f.id + 1, qty: 2, note: 'aparte' });
        expect(h.conv.state).toBe(state);
        expect(h.conv.customerName).toBe(state === 'awaiting_name' ? '' : 'Ana');
        expect(h.replies.join('\n')).toMatch(/no tengo.*recargo.*confirmado/i);
        expect(h.replies.join('\n')).not.toMatch(/el pedido sigue igual/);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
      });
    }
  }
  it.each(['Cuánto me cobran por cambiar la bebida', 'Cuánto me están cobrando por el cambio', 'Qué recargo tiene sustituir la salsa'])('no clasifica recargo como total: %s', text => {
    expect(isCartChargeQuestion(text)).toBe(false);
  });
  it.each(['Cuánto me están cobrando', 'Cuánto me cobran', 'Cuál es el total', 'Cuánto vale todo eso'])('conserva total: %s', text => {
    expect(isCartChargeQuestion(text)).toBe(true);
  });
});

describe('Reemplazo de plato con dirección pendiente — mantiene checkout', () => {
  const fixtures = [
    { id: 20401, old: 'Pizza De Setas', next: 'Pizza Margarita', side: 'Agua Mineral' },
    { id: 20411, old: 'Ramen De Miso', next: 'Ramen De Shoyu', side: 'Te Verde' },
  ];
  for (const f of fixtures) for (const agent of [false, true]) for (const kind of ['sin dirección', 'lugar pendiente', 'dirección anterior']) {
    for (const wording of ['cambia', 'no quiero']) {
      it(`${f.old}, agente ${agent}, ${kind}, ${wording}`, async () => {
        const menu = [f.old, f.next, f.side].map((name, index) => ({ id: f.id + index, code: f.id + index, name,
          price: index === 0 ? 24000 : index === 1 ? 22000 : 5000, availableNow: true, hasAttributes: false, attributes: [] }));
        const h = harness(menu, agent);
        h.conv.state = 'awaiting_address';
        h.service.ordersService.create = jest.fn();
        Object.assign(h.conv.sessionData, { orderType: 'delivery', addressConfirmed: false, deliveryFeeCalculated: null,
          address: kind === 'lugar pendiente' ? 'Conjunto Los Pinos' : undefined,
          lastDeliveryAddress: kind === 'dirección anterior' ? 'Calle 12 30 45' : undefined,
          phoneConfirmed: true, contactPhone: h.conv.phoneE164,
          cart: [menu[0], menu[2]].map((p, index) => ({ productId: p.id, code: p.code, name: p.name,
            unitPrice: p.price, quantity: 1, note: index ? 'sin hielo' : undefined, attributes: [] })) });
        const before = structuredClone(h.conv.sessionData);
        await h.sendQueued(wording === 'cambia' ? `Cambia la ${f.old} por ${f.next}` : `No quiero ${f.old}, quiero ${f.next}`);
        expect(h.conv.sessionData.cart).toHaveLength(2);
        expect(h.conv.sessionData.cart).toContainEqual(before.cart[1]);
        expect(h.conv.sessionData.cart).toContainEqual(expect.objectContaining({ productId: f.id + 1, quantity: 1, unitPrice: 22000 }));
        expect(h.conv.sessionData.cart.some(line => line.productId === f.id)).toBe(false);
        expect(h.conv.state).toBe('awaiting_address');
        expect(h.conv.sessionData.address).toBe(before.address);
        expect(h.conv.sessionData.lastDeliveryAddress).toBe(before.lastDeliveryAddress);
        expect(h.conv.sessionData.addressConfirmed).toBe(false);
        expect(h.replies.at(-1)).toMatch(/dirección/i);
        expect(h.replies.at(-1)).not.toMatch(/algo más|cómo pagas/i);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
        h.service.ensureDeliveryFeeQuoted = jest.fn(async (session: WhatsappSessionData) => ({
          session: { ...session, addressConfirmed: true, deliveryFeeCalculated: 2000 },
        }));
        await h.sendQueued('Calle 23 45 67');
        expect(h.conv.sessionData.address).toMatch(/calle 23 45 67/i);
        expect(h.conv.state).toBe('awaiting_payment');
        expect(h.conv.sessionData.cart.some(line => line.productId === f.id + 1)).toBe(true);
        expect(h.replies.at(-1)).toMatch(/pagas|pago/i);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
      });
    }
  }
});


describe('spoken main dish with cut instructions and separately quantified sides', () => {
  const original = 'Hola, buenas tardes. Me manda un pollo bien dorado con las pechugas partidas en cuatro, arepa frita pero bien dorado. Aparte me da por favor tres porciones de papa francesa, tres porciones de yuca y tres porciones de ensalada también. No se les olvide que el pollo bien dorado.';
  const roastMenu = [
    { id: 27101, code: 27101, name: 'Pato Al Horno', price: 40000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 27102, code: 27102, name: 'Porcion De Vegetales', price: 6000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 27103, code: 27103, name: 'Limonada', price: 5000, availableNow: true, hasAttributes: false, attributes: [] },
  ];
  for (const enabled of [true, false]) {
    for (const explicitStyle of [false, true]) {
      it(`original audio replay, explicit style ${explicitStyle}, agent ${enabled}`, async () => {
        const h = harness(products, enabled);
        const text = explicitStyle ? original.replace('un pollo bien', 'un pollo frito bien') : original;
        h.service.resolveAudioToText = jest.fn().mockResolvedValue(text);
        await h.sendQueued('', { messageType: 'audio', mediaId: 'spoken-main-dish' });
        for (const id of [9, 7, 46]) expect(h.cartRows()).toContainEqual(expect.objectContaining({ id, qty: 3 }));
        if (!explicitStyle) {
          expect(h.conv.sessionData.pendingMatch).toBeDefined();
          expect(h.replies.join(' ')).toMatch(/pollo/i);
          await h.sendQueued('un pollo frito');
        }
        expect(h.cartRows().find(line => line.id === 1)).toMatchObject({ qty: 1, attrs: expect.arrayContaining(['Arepas:Fritas']) });
        expect(h.conv.sessionData.cart.find(line => line.productId === 1)?.note).toMatch(/dorad/i);
        expect(h.conv.sessionData.cart.find(line => line.productId === 1)?.note).toMatch(/pechugas.*partidas.*cuatro/i);
        expect(h.conv.sessionData.cart.reduce((sum, line) => sum + line.quantity, 0)).toBe(10);
      });
    }
    it(`fictional roast with cuts and three side units, agent ${enabled}`, async () => {
      const menu = [
        { id: 27101, code: 27101, name: 'Pato Al Horno', price: 40000, availableNow: true, hasAttributes: false, attributes: [] },
        { id: 27102, code: 27102, name: 'Porcion De Vegetales', price: 6000, availableNow: true, hasAttributes: false, attributes: [] },
      ];
      const h = harness(menu, enabled);
      h.service.resolveAudioToText = jest.fn().mockResolvedValue('Me manda un pato al horno bien dorado y partido en cuatro. Aparte me da tres porciones de vegetales por favor. No olvide que el pato bien dorado.');
      await h.sendQueued('', { messageType: 'audio', mediaId: 'spoken-roast' });
      expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({ id: 27101, qty: 1 }), expect.objectContaining({ id: 27102, qty: 3 })]));
      expect(h.conv.sessionData.cart.find(line => line.productId === 27101)?.note).toMatch(/dorad/i);
      expect(h.conv.sessionData.cart.find(line => line.productId === 27101)?.note).toMatch(/partido.*cuatro/i);
    });
    it(`explicit main quantity, other cut count and a new product, agent ${enabled}`, async () => {
      const h = harness(roastMenu, enabled);
      h.service.resolveAudioToText = jest.fn().mockResolvedValue('Buenas noches. Me manda dos patos al horno partidos en ocho y una limonada. Aparte me da tres porciones de vegetales.');
      await h.sendQueued('', { messageType: 'audio', mediaId: 'spoken-roast-two' });
      expect(h.cartRows()).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 27101, qty: 2 }), expect.objectContaining({ id: 27102, qty: 3 }), expect.objectContaining({ id: 27103, qty: 1 })]));
      expect(h.conv.sessionData.cart.reduce((sum, line) => sum + line.quantity, 0)).toBe(6);
      expect(h.conv.sessionData.cart.find(line => line.productId === 27101)?.note).toMatch(/partidos.*ocho/i);
    });
    it(`repeated preparation reminder is one note, agent ${enabled}`, async () => {
      const h = harness(roastMenu, enabled);
      h.service.resolveAudioToText = jest.fn().mockResolvedValue('Me manda un pato al horno bien dorado. No se le olvide que el pato bien dorado.');
      await h.sendQueued('', { messageType: 'audio', mediaId: 'spoken-roast-reminder' });
      expect(h.cartRows()).toEqual([expect.objectContaining({ id: 27101, qty: 1 })]);
      expect(h.conv.sessionData.cart[0].note?.match(/dorad/gi)).toHaveLength(1);
      expect(h.replies.join(' ').match(/dorad/gi)).toHaveLength(1);
      expect(h.replies.join(' ')).not.toMatch(/no (?:tenemos|manejamos)|no encontr/i);
    });
  }
  for (const enabled of [true, false]) {
    it(`option adjective is not the dish style, agent ${enabled}`, async () => {
      const h = harness(products, enabled);
      await h.sendQueued('quiero un pollo con arepas fritas');
      expect(h.conv.sessionData.cart).toEqual([]);
      expect(h.replies.join(' ')).toContain('1 Pollo Broaster');
      await h.sendQueued('frito');
      expect(h.cartRows()).toEqual([expect.objectContaining({ id: 1, qty: 1, attrs: ['Arepas:Fritas'] })]);
      expect(h.conv.sessionData.cart[0].note || '').not.toMatch(/frito|arepas/i);
    });
  }
  it('frameSpokenOrder peels preparation and reminders on PPP and fictional menus', () => {
    const catalog = harness(products, false).service['catalogService'];
    const ppp = catalog.resolveMultiProductOrder(original, products);
    expect(ppp.unresolved).toEqual([]);
    expect([...ppp.confident, ...ppp.ambiguous].every((line: any) => !/olvid|manda/i.test(line.segment || ''))).toBe(true);
    const roast = catalog.resolveMultiProductOrder('Un pato al horno picado en presas y tres porciones de vegetales', roastMenu);
    expect(roast.confident.find((line: any) => line.product.id === 27101)).toMatchObject({ segment: expect.not.stringMatching(/presas|picado/i), note: 'picado en presas' });
    expect(roast.confident.find((line: any) => line.product.id === 27102)).toMatchObject({ segment: expect.stringMatching(/^tres porciones/i) });
    expect(catalog.dropRedundantReminders('Un pato bien dorado. No se le olvide que bien dorado.')).toBe('Un pato bien dorado.');
    expect(catalog.dropRedundantReminders('Un pato. No se le olvide que bien dorado.')).toBe('Un pato. No se le olvide que bien dorado.');
  });
});

describe('closing an order with vocatives and a "no" that answers ¿Algo más?', () => {
  const fictional = [
    { id: 31501, code: 31501, name: 'Empanada De Carne', price: 3000, availableNow: true, hasAttributes: false, attributes: [] },
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
    for (const [label, menu, id] of [['PPP', products, 35], ['fictional', fictional, 31501]] as const) {
      for (const text of ['No señor asi esta bien', 'no veci, así está bien gracias', 'No señora eso es todo']) {
        it(`${label} "${text}" at the summary confirms, agent ${enabled}`, async () => {
          const h = atSummary(menu as any, id, enabled);
          await h.sendQueued(text);
          expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
        });
      }
      for (const text of ['Señor', 'Gracias señor muy amable']) {
        it(`${label} "${text}" after confirming is a courtesy, agent ${enabled}`, async () => {
          const h = atSummary(menu as any, id, enabled);
          await h.sendQueued('Si');
          await h.sendQueued(text);
          expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
          expect(h.replies.at(-1)).toMatch(/Con gusto/);
        });
      }
      it(`${label} "No señor no quiero" at the summary does not confirm, agent ${enabled}`, async () => {
        const h = atSummary(menu as any, id, enabled);
        await h.sendQueued('No señor no quiero');
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
      });
      it(`${label} "No señor asi esta bien" while building moves to checkout, agent ${enabled}`, async () => {
        const h = harness(menu as any, enabled);
        h.service.ordersService.create = jest.fn();
        const product = (menu as any[]).find((p: any) => p.id === id);
        h.conv.sessionData.cart = [{ productId: id, code: id, name: product.name, unitPrice: product.price, quantity: 1, attributes: [] }] as any;
        await h.sendQueued('No señor asi esta bien');
        expect(h.conv.state).not.toBe('building_cart');
        expect(h.cartRows()).toEqual([expect.objectContaining({ id, qty: 1 })]);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
      });
    }
  }
});


describe('Enumeration and subset instruction boundaries',()=>{
 const menu=['Sopa De Ajiaco','Sopa De Menudencias','Sopa De Mondongo'].map((name,i)=>({id:61401+i,code:911+i,name,categoryName:'Sopas',price:10000+i*1000,availableNow:true,hasAttributes:false,attributes:[]}));
 for(const agent of [true,false]){
  it.each(['1 y 3','0 y 1','1 y 2 con total tres'])('invalid/undistributed selection %s agent='+agent,async text=>{
   const h=harness(menu,agent);h.service.ordersService.create=jest.fn();
   h.conv.sessionData.pendingMultiOrder={confident:[],needsAttributes:[],unresolved:[],ambiguous:[{segment:text.includes('total')?'Tres sopas':'sopas',candidates:menu.slice(0,2)}]};
   const before=structuredClone(h.conv.sessionData);await h.sendQueued(text.includes('total')?'1 y 2':text);
   expect(h.conv.sessionData).toEqual(before);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
  it('category question is not a purchase agent='+agent,async()=>{
   const h=harness(menu,agent);await h.sendQueued('¿Tienen tres sopas una de cada una?');expect(h.cartRows()).toEqual([]);
  });
  it.each(['bad rows','decline','reset'])('pending subset '+agent+' %s',async mode=>{
   const h=harness(menu,agent);await h.sendQueued('Quiero tres sopas una de cada una, dos sin arroz');
   const before=structuredClone(h.conv.sessionData);expect(before.pendingSubsetKitchenNote).toBeDefined();
   await h.sendQueued(mode==='bad rows'?'1 y 4':mode==='decline'?'No apliques esa nota':'Reiniciar');
   if(mode==='bad rows')expect(h.conv.sessionData).toEqual(before);
   else{expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeUndefined();expect(h.conv.sessionData.cart).toEqual(mode==='reset'?[]:before.cart);}
  });
  it('fresh named note retires only its stale instruction agent='+agent,async()=>{
   const h=harness(menu,agent);h.conv.sessionData.cart=menu.map(p=>({productId:p.id,code:p.code,name:p.name,unitPrice:p.price,quantity:1,attributes:[]}));
   h.conv.sessionData.pendingMultiOrder={confident:[],needsAttributes:[],ambiguous:[],unresolved:['Sopa De Mondongo sin arroz con papa salada','Postre Galactico']};
   await h.sendQueued('Pon como nota para Sopa De Ajiaco y Sopa De Mondongo que vayan sin arroz');
   expect(h.conv.sessionData.pendingMultiOrder?.unresolved).toEqual(['Postre Galactico']);expect(h.cartRows()).toHaveLength(3);
   expect(h.cartRows().filter(row=>row.note==='sin arroz').map(row=>row.id).sort()).toEqual([61401,61403]);
  });
  it('independent drink does not receive or erase the pending note agent='+agent,async()=>{
   const drink={id:61409,code:919,name:'Agua Mineral',categoryName:'Bebidas',price:4000,availableNow:true,hasAttributes:false,attributes:[]};
   const h=harness([...menu,drink],agent);await h.sendQueued('Quiero tres sopas una de cada una dos sin arroz');
   await h.sendQueued('Agrega dos Agua Mineral');expect(h.cartRows().find(row=>row.id===61409)).toMatchObject({qty:2,note:undefined});expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeDefined();
   await h.sendQueued('1 y 2');expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeUndefined();expect(h.cartRows().find(row=>row.id===61409)).toMatchObject({qty:2,note:undefined});
  });
  it('named note does not discard a separate quantified purchase agent='+agent,async()=>{
   const h=harness(menu,agent);h.conv.sessionData.cart=menu.map(p=>({productId:p.id,code:p.code,name:p.name,unitPrice:p.price,quantity:1,attributes:[]}));
   h.conv.sessionData.pendingMultiOrder={confident:[],needsAttributes:[],ambiguous:[],unresolved:['dos Sopa De Mondongo sin arroz']};
   await h.sendQueued('Pon como nota para Sopa De Ajiaco y Sopa De Mondongo que vayan sin arroz');
   expect(h.conv.sessionData.pendingMultiOrder?.unresolved).toEqual(['dos Sopa De Mondongo sin arroz']);expect(h.cartRows()).toHaveLength(3);
  });
  it('central confirmation cannot bypass a subset note agent='+agent,async()=>{
   const h=harness(menu,agent);h.conv.state='awaiting_final_confirm';h.service.ordersService.create=jest.fn();
   h.conv.sessionData.cart=menu.map(p=>({productId:p.id,code:p.code,name:p.name,unitPrice:p.price,quantity:1,attributes:[]}));
   h.conv.sessionData.pendingSubsetKitchenNote={quantity:2,note:'sin arroz',productIds:menu.map(p=>p.id)};
   await h.service.tryConfirmOrder(h.conv,'customer',h.conv.sessionData);
   expect(h.service.ordersService.create).not.toHaveBeenCalled();expect(h.replies.at(-1)).toMatch(/cu[aá]les.*2/i);expect(h.conv.state).toBe('awaiting_final_confirm');
  });
 }
});


describe('Named accompaniment change waits for preparation',()=>{
 for(const names of [['Sopa De Ajiaco','Sopa De Mondongo','Sopa De Menudencias'],['Roll De Pepino','Roll De Zanahoria','Roll De Aguacate'],['Flan De Vainilla','Flan De Cafe','Flan De Coco']])for(const agent of [true,false])it(names[0]+' agent='+agent,async()=>{
  const menu=names.map((name,i)=>({id:61501+i,code:901+i,name,price:10000,availableNow:true,hasAttributes:false,attributes:[]}));
  const h=harness(menu,agent);h.conv.state='awaiting_address';h.conv.sessionData.cart=menu.map(p=>({productId:p.id,code:p.code,name:p.name,unitPrice:p.price,quantity:1,attributes:[]}));
  h.conv.sessionData.pendingMultiOrder={confident:[],needsAttributes:[],ambiguous:[],unresolved:[names[1]+' sin arroz con papa salada']};
  const before=structuredClone(h.conv.sessionData.cart);
  const response=await h.sendQueued('Quiero cambiar el acompañante de '+names[0]+' y de '+names[1]);
  expect(h.conv.sessionData.cart).toEqual(before);expect(response||'').toMatch(/qu[eé].*(?:preparaci[oó]n|acompa[nñ]ante|indicaci[oó]n)|por cu[aá]l/i);expect(response||'').not.toMatch(/no tenemos/i);
  await h.sendQueued('Dame el '+names[0]+' son arroz');expect(h.conv.sessionData.cart).toEqual(before);expect(h.replies.at(-1)).not.toMatch(/no tenemos/i);
  await h.sendQueued('Sin arroz papa salada a cambio');
  expect(h.cartRows()).toEqual([expect.objectContaining({id:61501,qty:1,note:'Sin arroz papa salada a cambio'}),expect.objectContaining({id:61502,qty:1,note:'Sin arroz papa salada a cambio'}),expect.objectContaining({id:61503,qty:1,note:undefined})]);
  expect(h.conv.sessionData.pendingMultiOrder).toBeUndefined();expect(h.conv.state).toBe('awaiting_address');
 });
});

describe('Approval reference without delivery question stays pending',()=>{
 for(const name of ['Bao De Hongos','Ensalada De Quinoa'])for(const agent of [false,true])for(const text of ['Me dijiste "confirmar".','¿Puedo confirmar el pedido?','Si digo «confirmar», ¿se envía?','No lo confirmo todavía.']){
  it(name+' '+text+' agent='+agent,async()=>{
   const h=harness([{id:62701,code:62701,name,price:18000,availableNow:true,hasAttributes:false,attributes:[]}],agent);h.conv.state='awaiting_final_confirm';h.service.ordersService.create=jest.fn().mockResolvedValue({id:6270,dailyOrderNumber:67});
   Object.assign(h.conv.sessionData,{cart:[{productId:62701,code:62701,name,unitPrice:18000,quantity:1,attributes:[],note:'bien empacado'}],orderType:'delivery',fulfillmentChosen:true,address:'Calle 12 34 56',addressConfirmed:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,paymentMethod:'contraentrega',notesCollected:true,deliveryFeeCalculated:2000});
   const before=structuredClone(h.conv.sessionData);await h.sendQueued(text);expect(h.conv.sessionData).toEqual(before);expect(h.conv.state).toBe('awaiting_final_confirm');expect(h.service.ordersService.create).not.toHaveBeenCalled();
   expect(h.replies.join(' ')).not.toMatch(/no tenemos|no manejamos|pedido registrado/i);
   await h.sendQueued('Confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.conv.state).toBe('completed');
  });
 }
});

describe('An unavailable new purchase is answered while the existing cart stays intact',()=>{
 for(const family of ['meat','soup'])for(const state of ['building_cart','awaiting_payment','awaiting_final_confirm'])for(const mode of ['rules','vague_agent','cart_agent']){
  it(family+' '+state+' '+mode,async()=>{
   const menu=family==='meat'?products:[{id:63501,code:63501,name:'Bao De Hongos',price:18000,availableNow:true,attributes:[]},{id:63502,code:63502,name:'Sopa De Calabaza',price:9000,availableNow:true,category:'Sopas',attributes:[]},{id:63503,code:63503,name:'Sopa De Tomate',price:8500,availableNow:true,category:'Sopas',attributes:[]}];
   const p=family==='meat'?menu.find((p:any)=>p.id===22):menu[0];const h=harness(menu,mode!=='rules');h.conv.state=state;
   Object.assign(h.conv.sessionData,{cart:[{productId:p.id,code:p.code,name:p.name,unitPrice:p.price,quantity:1,attributes:family==='meat'?[{attributeName:'Presa',attributeValue:'Ala, pechuga'},{attributeName:'Sopa',attributeValue:'Mondongo'},{attributeName:'Bebida',attributeValue:'Colombiana'}]:[],note:'bien empacado'}],orderType:'delivery',fulfillmentChosen:true,address:'Calle 12 34 56',addressConfirmed:true,deliveryFeeCalculated:2000,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,...(state==='awaiting_final_confirm'?{paymentMethod:'contraentrega'}:{})});
   h.service.ordersService.create=jest.fn().mockResolvedValue({id:6350,dailyOrderNumber:71});
   const before=structuredClone(h.conv.sessionData.cart);
   if(mode==='cart_agent')h.agent.runTurn.mockResolvedValue({reply:'🛒 Carrito\n1. '+p.name+'\n¿Algo más?',actions:{},toolCalls:['get_cart']});
   const reply=await h.sendQueued(family==='meat'?'quiero 3 carnes a la plancha':'Quiero tres sopas de langosta por favor');
   expect(h.conv.sessionData.cart).toEqual(before);expect(reply).toMatch(/no tenemos|no manejamos|no encontr|no disponible/i);
   expect(reply).toMatch(family==='meat'?/Churrasco|Sobrebarriga/i:/Sopa De Calabaza|Sopa De Tomate/i);
   expect(reply).not.toMatch(/agregu[eé].*(?:plancha|langosta)/i);
   await h.sendQueued(family==='meat'?'Churrasco':'Sopa De Tomate');
   const selected=menu.find((item:any)=>item.name===(family==='meat'?'Churrasco':'Sopa De Tomate'));
   expect(h.conv.sessionData.cart).toContainEqual(expect.objectContaining({productId:selected.id,quantity:3}));
   expect(h.conv.sessionData.cart).toContainEqual(before[0]);
   expect(h.service.ordersService.create).not.toHaveBeenCalled();
   if(h.conv.state==='awaiting_payment')await h.sendQueued('1');
   await h.sendQueued('Confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
   expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(4);
   expect(h.service.ordersService.create.mock.calls[0][0].items.filter((item:any)=>item.productId===selected.id)).toHaveLength(3);
  });
 }
});

describe('Missing purchase suggestions preserve existing selections and real orders',()=>{
 for(const agent of [false,true])it('keeps note ownership while answering agent='+agent,async()=>{
  const h=harness(products,agent);const p=products.find((p:any)=>p.id===22);h.conv.sessionData.cart=[{productId:p.id,code:p.code,name:p.name,unitPrice:p.price,quantity:1,attributes:[]}];h.conv.sessionData.pendingSubsetKitchenNote={quantity:1,note:'sin arroz',productIds:[p.id]};const before=structuredClone(h.conv.sessionData);
  const reply=await h.sendQueued('Quiero tres carnes a la plancha');expect(h.conv.sessionData).toEqual(before);expect(reply).toMatch(/no encontr/i);expect(reply).toMatch(/Churrasco/);
 });
 for(const text of ['Quiero tres hamburguesas sin cebolla','Quiero tres sopas de ajiaco sin arroz','Quiero tres porciones de ensalada bien grandes','Quiero tres churrascos']){
  it('does not call an existing dish unavailable: '+text,async()=>{
   const h=harness(products,false);const reply=await h.sendQueued(text);expect(reply).not.toMatch(/No encontré .*como producto de la carta/i);expect(h.conv.sessionData.cart.reduce((sum,line)=>sum+line.quantity,0)===3 || h.conv.sessionData.pendingMatch || h.conv.sessionData.pendingAttribute || h.conv.sessionData.pendingMultiOrder).toBeTruthy();
  });
 }
});

describe('Missing purchase quantity variants and repeated requests',()=>{
 for(const [text,quantity] of [['Quisiera dos carnes a la plancha porfa',2],['Dame una carne a la plancha',1],['Me das 4 carnes a la plancha',4]] as [string,number][]){
  it(text,async()=>{const h=harness(products,false);const reply=await h.sendQueued(text);expect(reply).toMatch(/No encontré/);expect(h.conv.sessionData.cart).toEqual([]);await h.sendQueued('Churrasco');expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:products.find((p:any)=>p.name==='Churrasco').id,quantity})]);});
 }
 for(const agent of [false,true])it('repeating a missing request retains offer and quantity agent='+agent,async()=>{
  const h=harness(products,agent);await h.sendQueued('Quiero tres carnes a la plancha');const before=structuredClone(h.conv.sessionData);const reply=await h.sendQueued('Quiero tres carnes a la plancha');expect(h.conv.sessionData).toEqual(before);expect(reply).toMatch(/No encontré/);expect((reply||'').split('Conservo')[0]).not.toMatch(/\n1\./);
 });
});

describe('Subset kitchen note replacement and clearing preserve other units',()=>{
 for(const name of ['Pizza De Huerta','Caja De Desayuno','Bento De Setas'])for(const state of ['building_cart','awaiting_payment','awaiting_final_confirm'])for(const mode of ['replace','clear'])it(`${name} ${state} ${mode}`,async()=>{
  const product={id:65101,code:65101,name,price:21000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Salsa',options:['Suave','Picante']}]};
  const h=harness([product],true);h.conv.state=state;
  Object.assign(h.conv.sessionData,{cart:[{productId:product.id,code:product.code,name,unitPrice:product.price,quantity:4,note:'sin cebolla, sin sal',attributes:[{attributeName:'Salsa',attributeValue:'Suave'}]}],orderType:'delivery',fulfillmentChosen:true,address:'Calle 12 34 56',addressConfirmed:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,deliveryFeeCalculated:2000,...(state==='awaiting_final_confirm'?{paymentMethod:'contraentrega'}:{})});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:6510,dailyOrderNumber:81});
  h.agent.runTurn.mockImplementationOnce(async input=>{
   const service=new WhatsappAgentService({} as never,h.service.catalogService) as any;const actions:any={};
   const ctx={actions,cart:input.cart,products:[product],byId:new Map([[product.id,product]]),userMessage:input.userMessage,setNeedsAttr:()=>{}};
   expect(JSON.parse(service.executeTool('set_unit_attributes',{productId:product.id,cartLineIndex:0,affectedQuantity:2,attributes:[{attributeName:'Salsa',attributeValue:'Suave'}],noteMode:mode,...(mode==='replace'?{note:'sin cebolla, con sal'}:{})},ctx)).ok).toBe(true);
   return {reply:'Todas iguales',actions,toolCalls:['get_cart','set_unit_attributes']};
  });
  const text=`De las cuatro ${name}, dos con Suave; ${mode==='clear'?'borra toda la nota de esas dos':'en esas dos reemplaza sin sal por con sal, conserva sin cebolla'}`;
  const reply=await h.sendQueued(text);expect(h.agent.runTurn).toHaveBeenCalledTimes(1);expect(reply).not.toContain('Todas iguales');
  expect(h.conv.sessionData.cart.map(item=>[item.quantity,item.note||''])).toEqual([[2,'sin cebolla, sin sal'],[2,mode==='clear'?'':'sin cebolla, con sal']]);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(h.conv.state==='building_cart')await h.sendQueued('Nada más');if(h.conv.state==='awaiting_payment')await h.sendQueued('1');
  await h.sendQueued('Confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items=h.service.ordersService.create.mock.calls[0][0].items;expect(items).toHaveLength(4);expect(items.filter((item:any)=>item.note==='sin cebolla, sin sal')).toHaveLength(2);
  expect(items.filter((item:any)=>(item.note||'')===(mode==='clear'?'':'sin cebolla, con sal'))).toHaveLength(2);
 });
});

describe('October 18 order integrity replay', () => {
  for (const enabled of [false, true]) {
    for (const joined of [false, true]) {
      for (const menu of [
        [{id: 66401, code: 66401, name: 'Arroz Con Pollo', price: 32000, availableNow: true, attributes: []}, {id: 66402, code: 66402, name: 'Porcion De Ensalada', price: 7500, availableNow: true, attributes: []}],
        [{id: 66411, code: 66411, name: 'Bowl De Quinoa', price: 21000, availableNow: true, attributes: []}, {id: 66412, code: 66412, name: 'Porcion De Salsa', price: 4000, availableNow: true, attributes: []}],
        [{id: 66421, code: 66421, name: 'Pasta Al Pesto', price: 24000, availableNow: true, attributes: []}, {id: 66422, code: 66422, name: 'Porcion De Salsa', price: 4000, availableNow: true, attributes: []}],
      ]) it(`negated side ${menu[0].name} agent=${enabled} joined=${joined}`, async () => {
        const h = harness(menu, enabled);
        const note = menu[0].id === 66401 ? 'sin ensalada por favor' : 'sin salsa por favor';
        if (joined) await h.sendQueued(`me regalas un ${menu[0].name}\n${note}`);
        else { await h.sendQueued(`me regalas un ${menu[0].name}`); await h.sendQueued(note); }
        expect(h.cartRows()).toEqual([expect.objectContaining({id: menu[0].id, qty: 1, note: expect.stringContaining(note.replace(' por favor',''))})]);
        expect(h.replies.join(' ')).not.toMatch(/no manejamos|no tenemos/i);
        h.service.ordersService.create = jest.fn().mockResolvedValue({id: 6640, dailyOrderNumber: 104});
        Object.assign(h.conv.sessionData, {orderType: 'pickup', fulfillmentChosen: true, phoneConfirmed: true, contactPhone: h.conv.phoneE164, notesCollected: true});
        await h.sendQueued('nada más'); await h.sendQueued('1');
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
        await h.sendQueued('confirmar');
        expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
        expect(h.service.ordersService.create.mock.calls[0][0].items).toEqual([expect.objectContaining({productId: menu[0].id, note: expect.stringContaining(note.replace(' por favor',''))})]);
      });

    }
  }
});

describe('Combo and elliptical extra with delivery replay',()=>{
 const fixtures=[
  {menu:products,food:'pollo frito',drink:'coca-cola',side:'francesa',ids:[99,9],flavor:'Coca Cola'},
  ...[{food:'Sandwich Serrano',drink:'Te Durazno',side:'Papas Rusticas',short:'rusticas'},{food:'Bowl Vegetal',drink:'Agua',side:'Arroz Integral',short:'integral'}].map((f,i)=>({
   menu:[{id:66701+i*10,code:66701+i*10,name:'Combo De '+f.food,price:20000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:[f.drink]}]},{id:66702+i*10,code:66702+i*10,name:'Porcion De '+f.side,price:5000,availableNow:true,attributes:[]}],food:f.food,drink:f.drink,side:f.short,ids:[66701+i*10,66702+i*10],flavor:f.drink,
  })),
 ];
 for(const f of fixtures)for(const enabled of [false,true])for(const address of [false,true])it(`${f.food} agent=${enabled} address=${address}`,async()=>{
  const h=harness(f.menu,enabled);
  Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,fulfillmentChosen:true});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:6670,dailyOrderNumber:108});
  h.service.ensureDeliveryFeeQuoted=jest.fn(async(session:WhatsappSessionData)=>({session:{...session,addressConfirmed:!!session.address,deliveryFeeCalculated:session.address?2000:0}}));
  await h.sendQueued(`Buenas tardes me regalas por favor un ${f.food} en combo con ${f.drink} y una porción de ${f.side}`+(address?'\nCalle 6 b # 78 c 33\nTienda de prueba':''));
  expect(h.cartRows().map(row=>[row.id,row.qty])).toEqual(expect.arrayContaining(f.ids.map(id=>[id,1])));
  expect(h.cartRows()).toHaveLength(2);
  expect(h.cartRows().find(row=>row.id===f.ids[0])?.attrs).toContain('Bebida:'+f.flavor);
  expect(h.replies.join(' ')).not.toMatch(/no manejamos|no tenemos|cu[aá]l prefieres/i);
  if(address){expect(h.conv.sessionData.address).toMatch(/Calle 6 b # 78 c 33.*Tienda de prueba/i);expect(h.conv.state).toBe('awaiting_payment');expect(h.replies.at(-1)).not.toMatch(/algo m[aá]s/i);}
  else await h.sendQueued('nada más');
  await h.sendQueued('1');expect(h.service.ordersService.create).not.toHaveBeenCalled();await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toHaveLength(2);expect(dto.items.map((item:any)=>item.productId).sort()).toEqual([...f.ids].sort());
  if(address)expect(dto.address).toMatch(/78 c 33.*Tienda de prueba/i);
 });
});

describe('PDF 18 Oct colloquial delivery timing preserves checkout',()=>{
 for(const name of ['Bao De Hongos','Ensalada De Quinoa'])for(const state of ['awaiting_payment','awaiting_final_confirm'])for(const text of ['se demoran','cuánto se demoran?','Disculpa, demorará mucho?','¿Cuánto tarda?']){
  it(name+' '+state+' '+text,async()=>{
   const p={id:79901,code:79901,name,price:18000,availableNow:true,hasAttributes:false,attributes:[]};
   const h=harness([p],false);h.conv.state=state;h.service.ordersService.create=jest.fn().mockResolvedValue({id:7990,dailyOrderNumber:79});
   Object.assign(h.conv.sessionData,{cart:[{productId:p.id,code:p.code,name,unitPrice:p.price,quantity:2,attributes:[],note:'bien empacado'}],orderType:'delivery',fulfillmentChosen:true,address:'Calle 12 34 56',addressConfirmed:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,deliveryFeeCalculated:2000,...(state==='awaiting_final_confirm'?{paymentMethod:'contraentrega'}:{})});
   const before=structuredClone(h.conv.sessionData);const customer=h.conv.customerName;
   const reply=await h.sendQueued(text);
   expect(reply).toMatch(/suele demorar/i);expect(reply).not.toMatch(/no manejamos|no tenemos|cuál producto/i);
   expect(h.conv.sessionData).toEqual(before);expect(h.conv.state).toBe(state);expect(h.conv.customerName).toBe(customer);expect(h.service.ordersService.create).not.toHaveBeenCalled();
   if(state==='awaiting_payment')await h.sendQueued('1');
   await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.conv.state).toBe('completed');
   const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toHaveLength(2);
   expect(dto.items).toEqual([expect.objectContaining({productId:p.id,note:'bien empacado'}),expect.objectContaining({productId:p.id,note:'bien empacado'})]);
  });
 }
});

describe('Missing extra recovery during checkout distinguishes an existing line', () => {
 for (const names of [{meal:'Combo De Sushi',extra:'Porcion De Gyozas'},{meal:'Combo Vegetal',extra:'Porcion De Falafel'}]) for(const enabled of [false,true]) for(const present of [false,true]) {
  it(`${names.meal} present=${present} agent=${enabled}`,async()=>{
   const menu=[{id:79971,code:79971,name:names.meal,price:30000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Manzana','Colombiana']}]},{id:79972,code:79972,name:names.extra,price:8000,availableNow:true,attributes:[]}];
   const h=harness(menu,enabled);Object.assign(h.conv.sessionData,{fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
   h.service.ordersService.create=jest.fn().mockResolvedValue({id:7997,dailyOrderNumber:84});
   await h.sendQueued(`Un ${names.meal} con manzana${present?` y una ${names.extra}`:''}`);
   expect(h.cartRows()).toHaveLength(present?2:1);
   h.conv.sessionData.cart.find(r=>r.productId===79971)!.note='Salsa aparte';
   const meal=structuredClone(h.conv.sessionData.cart.find(r=>r.productId===79971));
   await h.sendQueued('no más, recojo en el local');await h.sendQueued('contraentrega');expect(h.conv.state).toBe('awaiting_final_confirm');
   const reply=await h.sendQueued(`Falta la ${names.extra}`);
   expect(reply).not.toMatch(/algo m[aá]s/i);expect(h.conv.state).toBe('awaiting_final_confirm');
   expect(h.cartRows().filter(r=>r.id===79972).reduce((n,r)=>n+r.qty,0)).toBe(1);
   expect(h.conv.sessionData.cart.find(r=>r.productId===79971)).toEqual(meal);
   expect(reply).not.toMatch(/no manejamos|no tenemos|no me qued[oó] clar/i);
   expect(h.service.ordersService.create).not.toHaveBeenCalled();
   await h.sendQueued('déjame ver el carrito');expect(h.cartRows()).toHaveLength(2);
   // Resume review if the recovery reopened cart building; do not lock in that extra turn.
   if(h.conv.state==='building_cart') {
    const review=await h.sendQueued('no más');expect(review).toMatch(/confirmar/i);
   }
   expect(h.conv.state).toBe('awaiting_final_confirm');
   expect(h.service.ordersService.create).not.toHaveBeenCalled();
   await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
   const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toHaveLength(2);
   expect(dto.items.find((r:any)=>r.productId===79971)).toEqual({productId:79971,attributes:meal!.attributes,note:'Salsa aparte'});
   expect(dto.items.filter((r:any)=>r.productId===79972)).toHaveLength(1);expect(dto.orderType).toBe('pickup');
  });
 }
});

describe('Delivery unit before street stays pending until a complete destination',()=>{
 for(const destination of ['street','pin','explicit'])for(const name of ['Ravioles De Ricota','Bowl De Garbanzos'])for(const enabled of [false,true])for(const checkout of [false,true])it(`${name} ${destination} checkout=${checkout} agent=${enabled}`,async()=>{
  const h=harness([{id:80021,code:80021,name,price:21000,availableNow:true,attributes:[]}],enabled);
  Object.assign(h.cfg,{deliveryFeeMode:'route_tiers',restaurantLat:4.62,restaurantLng:-74.15});
  h.cfg.paymentMethods=DEFAULT_PAYMENT_METHODS.map(method=>({...method,enabled:method.flow!=='mercadopago'}));
  Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,notesCollected:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,address:undefined,addressConfirmed:false});
  h.service.deliveryRouting={quoteDeliveryFee:jest.fn().mockResolvedValue({ok:true,fee:2000,distanceKm:1,source:'google_directions',geocodedAddress:'Calle 10 #81A-20',customer:{lat:4.62,lng:-74.15}})};
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:8002,dailyOrderNumber:89});
  await h.sendQueued(`Quiero dos ${name}`);if(checkout)await h.sendQueued('Nada más');
  const cart=structuredClone(h.conv.sessionData.cart);
  for(let repeat=0;repeat<2;repeat++){
   const reply=await h.sendQueued('Torre B apartamento 304B');
   expect(reply).toMatch(/calle|carrera|ubicaci[oó]n/i);expect(reply).not.toMatch(/c[oó]mo pagas|algo m[aá]s|no manejamos/i);
   expect(h.conv.sessionData.addressConfirmed).not.toBe(true);expect(h.conv.state).toBe('awaiting_address');
   expect(h.conv.sessionData.cart).toEqual(cart);expect(h.service.deliveryRouting.quoteDeliveryFee).not.toHaveBeenCalled();
   expect(h.service.ordersService.create).not.toHaveBeenCalled();
  }
  const input=destination==='pin'?'https://maps.google.com/?q=4.62,-74.15':destination==='explicit'?'Calle 10 #81A-20 torre C apartamento 205':'Calle 10 #81A-20';
  const expected=destination==='explicit'?/81A-20.*torre C.*205/i:destination==='pin'?/4\.62.*-74\.15.*Torre B.*304B/i:/81A-20.*Torre B.*304B/i;
  const reply=await h.sendQueued(input);expect(reply).toMatch(destination==='explicit'?/205/:/304B/);
  if(destination==='pin'){expect(reply).not.toMatch(/4\.62|-74\.15/);expect(h.service.deliveryRouting.quoteDeliveryFee).toHaveBeenCalledWith(expect.objectContaining({customerCoords:{lat:4.62,lng:-74.15}}));}
  expect(h.service.deliveryRouting.quoteDeliveryFee).toHaveBeenCalled();
  expect(h.conv.state).toBe('awaiting_payment');expect(h.conv.sessionData.address).toMatch(expected);
  expect(h.conv.sessionData.pendingDeliveryUnit).toBeUndefined();
  if(destination==='explicit')expect(h.conv.sessionData.address).not.toMatch(/304B|Torre B/i);
  else expect(h.conv.sessionData.address!.match(/304B/g)).toHaveLength(1);expect(h.conv.sessionData.cart).toEqual(cart);
  await h.sendQueued('contraentrega');expect(h.conv.state).toBe('awaiting_final_confirm');expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.address).toMatch(expected);
  expect(dto.items).toHaveLength(2);expect(dto.items.every((r:any)=>r.productId===80021)).toBe(true);expect(dto.deliveryFee).toBe(2000);
 });
});
