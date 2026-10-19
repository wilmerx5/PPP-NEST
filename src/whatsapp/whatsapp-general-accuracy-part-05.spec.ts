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


describe('Tanda portable — fechas, horas y correcciones sin tocar el pedido', () => {
  const bowl = {id:981,code:981,name:'Bowl Mediterraneo',categoryName:'Bowls',price:18000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Base',options:['Arroz','Quinoa']}]};
  const menus = [{menu:products,order:'Tres churrascos',tag:'PPP'},{menu:[bowl],order:'Tres bowls mediterraneos',tag:'alternativo'}];
  const times = [
    {text:'Para mañana a las 12:30',tokens:/mañana.*12:30/i},
    {text:'Para el viernes a las 7 pm',tokens:/viernes.*(?:7 pm|19:00)/i},
    {text:'Los quiero para el domingo a las 13:15',tokens:/domingo.*13:15/i},
    {text:'Para el 15/10 a las 14:00',tokens:/15\/10.*14:00/i},
    {text:'Para el 3/4 a las 14:00',tokens:/3\/4.*14:00/i},
  ];
  it('cambiar solo la hora conserva la fecha solicitada y las notas de entrega', async () => {
    const h = harness([bowl],false);
    await h.send('Tres bowls mediterraneos');
    h.conv.sessionData.customerNotes = 'No tocar el timbre';
    await h.send('Para el viernes a las 7 pm');
    const before = structuredClone(h.conv.sessionData.cart);
    await h.send('Mejor a las 2 pm');
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.conv.sessionData.customerNotes).toMatch(/Fecha solicitada: viernes/);
    expect(h.conv.sessionData.customerNotes).toMatch(/Horario solicitado: 2 pm/);
    expect(h.conv.sessionData.customerNotes).not.toMatch(/7 pm/);
    expect(h.conv.sessionData.customerNotes).toMatch(/No tocar el timbre/);
  });
  it('cambiar solo la fecha conserva el horario elegido y elimina la fecha vieja', async () => {
    const h = harness([bowl],false);
    await h.send('Tres bowls mediterraneos');
    await h.send('Para el miércoles al mediodía');
    const before = structuredClone(h.conv.sessionData.cart);
    await h.send('Mejor para el viernes');
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.conv.sessionData.customerNotes).toMatch(/Fecha solicitada: viernes/);
    expect(h.conv.sessionData.customerNotes).toMatch(/Horario solicitado: medio día/);
    expect(h.conv.sessionData.customerNotes).not.toMatch(/miércoles/);
  });
  it('no corta silenciosamente notas existentes para guardar una fecha', async () => {
    const h = harness([bowl],false);
    await h.send('Tres bowls mediterraneos');
    h.conv.sessionData.customerNotes = 'a'.repeat(399);
    const before = structuredClone(h.conv.sessionData);
    const reply = await h.send('Para el viernes a las 2 pm');
    expect(h.conv.sessionData).toEqual(before);
    expect(reply).toMatch(/resumir/);
  });
  for (const {menu,order,tag} of menus) {
    it.each(times)(`${tag}: registra $text como solicitud, conserva dirección y pago`, async ({text,tokens}) => {
      const h = harness(menu,false);
      await h.send(order);
      expect(h.cartRows().reduce((sum,row) => sum + row.qty,0)).toBe(3);
      h.conv.sessionData = {...h.conv.sessionData,address:'Calle 48 sur 86 87',paymentMethod:'transferencia',customerNotes:'No tocar el timbre'};
      const before = structuredClone(h.conv.sessionData);
      const reply = await h.send(text);
      expect(h.cartRows().reduce((sum,row) => sum + row.qty,0)).toBe(3);
      expect(h.conv.sessionData.cart).toEqual(before.cart);
      expect(h.conv.sessionData.address).toEqual(before.address);
      expect(h.conv.sessionData.paymentMethod).toEqual(before.paymentMethod);
      expect(h.conv.sessionData.customerNotes).toMatch(tokens);
      expect(h.conv.sessionData.customerNotes).toMatch(/No tocar el timbre/);
      expect(reply).toMatch(/confirm.*local|no está reservad/i);
    });
    it(`${tag}: corregir fecha y hora reemplaza la solicitud anterior, conserva otras notas`, async () => {
      const h = harness(menu,false);
      await h.send(order);
      h.conv.sessionData.customerNotes = 'No tocar el timbre';
      await h.send('Para el miércoles al mediodía');
      const before = structuredClone(h.conv.sessionData.cart);
      const reply = await h.send('Mejor para el viernes a las 2 pm');
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.customerNotes).toMatch(/viernes.*(?:2 pm|14:00)/i);
      expect(h.conv.sessionData.customerNotes).not.toMatch(/miércoles|mediodía/i);
      expect(h.conv.sessionData.customerNotes).toMatch(/No tocar el timbre/);
      expect(reply).toMatch(/confirm.*local|no está reservad/i);
    });
    it.each(['A las 7','A las 25:90','Para el 31/02 a las 14:00'])(`${tag}: pregunta sin registrar horario ambiguo o inválido %s`, async text => {
      const h = harness(menu,false);
      await h.send(order);
      const before = structuredClone(h.conv.sessionData);
      const reply = await h.send(text);
      expect(h.conv.sessionData).toEqual(before);
      expect(reply).toMatch(/hora|fecha|mañana|tarde/i);
      expect(reply).not.toMatch(/Listo.*(?:pedido|agregué)|No manejamos/i);
    });
  }
});

describe('Mensaje largo — varios platos y dirección juntos', () => {
  const ready = (h: ReturnType<typeof harness>) => {
    Object.assign(h.conv.sessionData, { phoneConfirmed: true, contactPhone: h.conv.phoneE164 });
  };
  const fiction = [
    { id: 9701, code: 9701, name: 'Taco Al Pastor', price: 14000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 9702, code: 9702, name: 'Sopa De La Casa', price: 9000, availableNow: true, hasAttributes: false, attributes: [] },
  ];

  it.each([false, true])('saludo, dos platos, nota y calle (agent %s)', async (agent) => {
    const h = harness(products, agent);
    ready(h);
    const reply = await h.sendQueued('hola buenas noches me envias por favor dos churrascos sin ensalada y una sopa de mondongo para la calle 48 sur 87 86');
    expect(h.cartRows().find((row) => row.id === 17)).toEqual(expect.objectContaining({ qty: 2, note: expect.stringMatching(/sin ensalada/i) }));
    expect(h.cartRows().find((row) => row.id === 45)).toEqual(expect.objectContaining({ qty: 1 }));
    expect(h.conv.sessionData.address).toMatch(/48 sur 87 86/i);
    expect(reply || '').not.toMatch(/buenas noches|me envias/i);
  });

  it.each([false, true])('en otra carta el mismo mensaje largo (agent %s)', async (agent) => {
    const h = harness(fiction, agent);
    ready(h);
    const reply = await h.sendQueued('hola buenas noches me envias por favor dos tacos al pastor sin cebolla y una sopa de la casa para la calle 48 sur 87 86');
    expect(h.cartRows().find((row) => row.id === 9701)).toEqual(expect.objectContaining({ qty: 2, note: expect.stringMatching(/sin cebolla/i) }));
    expect(h.cartRows().find((row) => row.id === 9702)).toEqual(expect.objectContaining({ qty: 1 }));
    expect(h.conv.sessionData.address).toMatch(/48 sur 87 86/i);
    expect(reply || '').not.toMatch(/buenas noches|me envias/i);
  });

  it.each([false, true])('tres líneas con cantidades, torre y apto (agent %s)', async (agent) => {
    const h = harness(products, agent);
    const reply = await h.send('ola buenas noches\ndos ajiacos y un churrasco\nes para la carrera 7 #20-30 torre 2 apto 5');
    expect(h.cartRows().find((row) => row.id === 38)).toEqual(expect.objectContaining({ qty: 2 }));
    expect(h.cartRows().find((row) => row.id === 17)).toEqual(expect.objectContaining({ qty: 1 }));
    expect(h.conv.sessionData.address).toMatch(/carrera 7/i);
    expect(h.conv.sessionData.address).toMatch(/torre 2/i);
    expect(h.conv.sessionData.address).toMatch(/apto 5/i);
    expect(reply || '').not.toMatch(/buenas noches/i);
  });

  it('en otra carta tres líneas conservan cantidad y apto', async () => {
    const h = harness(fiction, false);
    await h.send('hola\ndos tacos al pastor y una sopa de la casa\nes para la calle 10 #20-30 torre 3 apto 8');
    expect(h.cartRows().find((row) => row.id === 9701)).toEqual(expect.objectContaining({ qty: 2 }));
    expect(h.cartRows().find((row) => row.id === 9702)).toEqual(expect.objectContaining({ qty: 1 }));
    expect(h.conv.sessionData.address).toMatch(/calle 10/i);
    expect(h.conv.sessionData.address).toMatch(/torre 3/i);
    expect(h.conv.sessionData.address).toMatch(/apto 8/i);
  });

  it.each([false, true])('dos platos, plazuelas completas y transferencia (agent %s)', async (agent) => {
    const h = harness(products, agent);
    ready(h);
    await h.sendQueued('me envias un pollo frito y una limonada natural para plazuelas de san esteban, pago por transferencia');
    expect(h.cartRows().find((row) => row.id === 1)).toEqual(expect.objectContaining({ qty: 1 }));
    expect(h.cartRows().find((row) => row.id === 37)).toEqual(expect.objectContaining({ qty: 1 }));
    expect(h.conv.sessionData.address).toMatch(/plazuelas de san esteban/i);
    expect(h.conv.sessionData.paymentMethod).toBe('transfer');
  });

  it.each([false, true])('un plato que no está no se come a los otros ni a la calle (agent %s)', async (agent) => {
    const h = harness(products, agent);
    const reply = await h.send('hola me envias por favor un churrasco, una malteada y una sopa de mondongo para la calle 7 #20-30');
    const pending = h.conv.sessionData.pendingMultiOrder;
    const known = h.cartRows().map(row=>row.id);
    expect(known).toEqual(expect.arrayContaining([17, 45]));
    expect(h.replies.join(' ')).toMatch(/malteada/i);
    expect(reply || '').not.toMatch(/me envias|buenas noches/i);
    expect(h.conv.sessionData.address).toMatch(/calle 7/i);
    await h.send('sí');
    expect(h.cartRows().find((row) => row.id === 17)).toEqual(expect.objectContaining({ qty: 1 }));
    expect(h.cartRows().find((row) => row.id === 45)).toEqual(expect.objectContaining({ qty: 1 }));
    expect(h.conv.sessionData.address).toMatch(/calle 7/i);
    expect(h.conv.sessionData.pendingMultiOrder).toBeFalsy();
  });

  it.each([false, true])('en otra carta el helado que no está deja los dos platos y la calle (agent %s)', async (agent) => {
    const h = harness(fiction, agent);
    const reply = await h.send('hola me envias por favor un taco al pastor, un helado y una sopa de la casa para la calle 7 #20-30');
    const pending = h.conv.sessionData.pendingMultiOrder;
    const known = h.cartRows().map(row=>row.id);
    expect(known).toEqual(expect.arrayContaining([9701, 9702]));
    expect(h.replies.join(' ')).toMatch(/helado/i);
    expect(reply || '').not.toMatch(/me envias/i);
    expect(h.conv.sessionData.address).toMatch(/calle 7/i);
    await h.send('sí');
    expect(h.cartRows().find((row) => row.id === 9701)).toEqual(expect.objectContaining({ qty: 1 }));
    expect(h.cartRows().find((row) => row.id === 9702)).toEqual(expect.objectContaining({ qty: 1 }));
    expect(h.conv.sessionData.address).toMatch(/calle 7/i);
  });

  it.each([false, true])('nota, dos platos y calle en la misma frase (agent %s)', async (agent) => {
    const h = harness(products, agent);
    await h.sendQueued('Dos churrascos y una sopa de mondongo sin arroz para la calle 48 sur 87 86');
    expect(h.cartRows().find((row) => row.id === 17)).toEqual(expect.objectContaining({ qty: 2 }));
    expect(h.cartRows().find((row) => row.id === 45)).toEqual(expect.objectContaining({ qty: 1 }));
    expect(h.cartRows().find((row) => row.id === 45)?.note || '').toMatch(/sin arroz/i);
    expect(h.cartRows().find((row) => row.id === 17)?.note || '').not.toMatch(/sin arroz/i);
    expect(h.conv.sessionData.address).toMatch(/48 sur 87 86/i);
  });

  it('en otra carta la nota queda en la sopa y la calle también', async () => {
    const h = harness(fiction, false);
    await h.sendQueued('Dos tacos al pastor y una sopa de la casa sin cilantro para la calle 48 sur 87 86');
    expect(h.cartRows().find((row) => row.id === 9701)).toEqual(expect.objectContaining({ qty: 2 }));
    expect(h.cartRows().find((row) => row.id === 9702)?.note || '').toMatch(/sin cilantro/i);
    expect(h.cartRows().find((row) => row.id === 9701)?.note || '').not.toMatch(/sin cilantro/i);
    expect(h.conv.sessionData.address).toMatch(/48 sur 87 86/i);
  });

  it.each([false, true])('cantidad, calle y billete en el mismo mensaje (agent %s)', async (agent) => {
    const h = harness(products, agent);
    ready(h);
    await h.sendQueued('Dos ajiacos para la calle 48 sur 87 86, pago en efectivo con un billete de 50 mil');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 38, qty: 2 })]);
    expect(h.conv.sessionData.address).toMatch(/48 sur 87 86/i);
    expect(String(h.conv.sessionData.cashChangeFor || '')).toMatch(/50/);
    expect(h.conv.sessionData.paymentMethod).toBeTruthy();
  });

  it.each([false, true])('dos platos fuera de cobertura siguen en el carrito (agent %s)', async (agent) => {
    const h = harness(products, agent);
    h.cfg.deliveryFeeMode = 'route';
    h.service.deliveryRouting = {
      quoteDeliveryFee: jest.fn().mockResolvedValue({
        ok: false,
        reason: 'out_of_coverage',
        distanceKm: 6.7,
        message: 'Esa dirección queda a *~6.7 km* por ruta y está *fuera de cobertura* (máx. 5.5 km). ¿Me das otra dirección más cerca o prefieres *recojo* en el local?',
      }),
    };
    const reply = await h.send('hola buenas noches me envias dos churrascos y una sopa de mondongo para plazuelas de san esteban');
    expect(h.cartRows().find((row) => row.id === 17)).toEqual(expect.objectContaining({ qty: 2 }));
    expect(h.cartRows().find((row) => row.id === 45)).toEqual(expect.objectContaining({ qty: 1 }));
    expect(h.conv.sessionData.address).toMatch(/plazuelas de san esteban/i);
    expect(reply || '').toMatch(/fuera de cobertura/i);
    expect(reply || '').not.toMatch(/buenas noches|me envias/i);
    expect(h.conv.state).not.toBe('awaiting_payment');
  });

  it('en otra carta dos platos lejos también se quedan', async () => {
    const h = harness(fiction, false);
    h.cfg.deliveryFeeMode = 'route';
    h.service.deliveryRouting = {
      quoteDeliveryFee: jest.fn().mockResolvedValue({
        ok: false,
        reason: 'out_of_coverage',
        distanceKm: 6.7,
        message: 'Esa dirección queda a *~6.7 km* por ruta y está *fuera de cobertura* (máx. 5.5 km). ¿Me das otra dirección más cerca o prefieres *recojo* en el local?',
      }),
    };
    const reply = await h.send('hola me envias dos tacos al pastor y una sopa de la casa para el conjunto de la colina');
    expect(h.cartRows().find((row) => row.id === 9701)).toEqual(expect.objectContaining({ qty: 2 }));
    expect(h.cartRows().find((row) => row.id === 9702)).toEqual(expect.objectContaining({ qty: 1 }));
    expect(h.conv.sessionData.address).toMatch(/conjunto de la colina/i);
    expect(reply || '').toMatch(/fuera de cobertura/i);
  });

  it.each([false, true])('la dirección va primero y los platos después (agent %s)', async (agent) => {
    const h = harness(products, agent);
    await h.send('para la carrera 15 #45-20 torre 4 apto 12 quiero dos churrascos y una limonada natural');
    expect(h.cartRows().find((row) => row.id === 17)).toEqual(expect.objectContaining({ qty: 2 }));
    expect(h.cartRows().find((row) => row.id === 37)).toEqual(expect.objectContaining({ qty: 1 }));
    expect(h.conv.sessionData.address).toMatch(/carrera 15/i);
    expect(h.conv.sessionData.address).toMatch(/45-20|45 20/i);
    expect(h.conv.sessionData.address).toMatch(/torre 4/i);
    expect(h.conv.sessionData.address).toMatch(/apto 12/i);
  });

  it('en otra carta la calle también va primero', async () => {
    const h = harness(fiction, false);
    await h.send('para la calle 10 #20-30 torre 3 apto 8 quiero dos tacos al pastor y una sopa de la casa');
    expect(h.cartRows().find((row) => row.id === 9701)).toEqual(expect.objectContaining({ qty: 2 }));
    expect(h.cartRows().find((row) => row.id === 9702)).toEqual(expect.objectContaining({ qty: 1 }));
    expect(h.conv.sessionData.address).toMatch(/calle 10/i);
    expect(h.conv.sessionData.address).toMatch(/torre 3/i);
    expect(h.conv.sessionData.address).toMatch(/apto 8/i);
  });

  it.each([false, true])('recojo con dos platos no guarda una calle (agent %s)', async (agent) => {
    const h = harness(products, agent);
    await h.send('quiero dos churrascos y una sopa de mondongo para recoger en el local');
    expect(h.cartRows().find((row) => row.id === 17)).toEqual(expect.objectContaining({ qty: 2 }));
    expect(h.cartRows().find((row) => row.id === 45)).toEqual(expect.objectContaining({ qty: 1 }));
    expect(h.conv.sessionData.orderType).toBe('pickup');
    expect(h.conv.sessionData.address || '').toMatch(/recoge en el local/i);
    expect(h.conv.sessionData.address || '').not.toMatch(/calle|carrera/i);
  });

  it('en otra carta recoger en el local tampoco es una calle', async () => {
    const h = harness(fiction, false);
    await h.send('quiero dos tacos al pastor y una sopa de la casa para recoger en el local');
    expect(h.cartRows().find((row) => row.id === 9701)).toEqual(expect.objectContaining({ qty: 2 }));
    expect(h.cartRows().find((row) => row.id === 9702)).toEqual(expect.objectContaining({ qty: 1 }));
    expect(h.conv.sessionData.orderType).toBe('pickup');
    expect(h.conv.sessionData.address || '').not.toMatch(/calle|carrera/i);
  });
});


describe('PDF segunda tanda — compra y dirección en catálogo alternativo',()=>{
  it.each(['Un bowl mediterraneo','Dos bowls mediterraneos'])('conserva plato con dirección en un turno: %s',async order=>{
    const menu=[{id:9101,code:9101,name:'Bowl Mediterraneo',price:17000,availableNow:true,attributes:[]}];
    const h=harness(menu,false);Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164});
    await h.sendQueued(`${order} para la calle 7 #20-30`);
    expect(h.cartRows()).toEqual([expect.objectContaining({id:9101,qty:order.startsWith('Dos')?2:1})]);
    expect(h.conv.sessionData.address).toMatch(/20-30/);
  });
});

describe('PDF 11/10 — cómo escribe la gente', () => {
  const bowl = { id: 9910, code: 9910, name: 'Bowl Andino', price: 18000, availableNow: true, attributes: [] };
  const soup = { id: 9911, code: 9911, name: 'Sopa De Lentejas', price: 8000, availableNow: true, attributes: [] };
  const ready = (h: ReturnType<typeof harness>) => {
    Object.assign(h.conv.sessionData, { phoneConfirmed: true, contactPhone: h.conv.phoneE164 });
  };

  it.each([
    { menu: products, text: 'Un arroz con pollo Cll6b74-21 torre 1 apto 402', id: 23 },
    { menu: [bowl], text: 'Un bowl andino Cll6b74-21 torre 1 apto 402', id: 9910 },
  ])('calle compacta no se mezcla con el plato: $id', async ({ menu, text, id }) => {
    const h = harness(menu, false);
    ready(h);
    await h.sendQueued(text);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id, qty: 1 })]);
    expect(h.conv.sessionData.address).toMatch(/6b/i);
    expect(h.conv.sessionData.address).toMatch(/402/);
    expect(h.conv.sessionData.address).not.toMatch(/arroz|bowl/i);
  });

  it.each([
    { menu: products, order: 'Me regalas un arroz con pollo', id: 23 },
    { menu: [bowl], order: 'Me regalas un bowl andino', id: 9910 },
  ])('conjunto, apto y entrada llegan en burbujas: $id', async ({ menu, order, id }) => {
    const h = harness(menu, false);
    ready(h);
    await h.sendQueued(order);
    await h.sendQueued('Para Villa galante');
    await h.sendQueued('Apartamento 239');
    await h.sendQueued('Entrada 20');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id, qty: 1 })]);
    const addr = h.conv.sessionData.address || '';
    expect(addr).toMatch(/villa galante/i);
    expect(addr).toMatch(/239/);
    expect(addr).toMatch(/entrada 20/i);
  });

  it.each([
    { menu: products, text: 'Me regalas 2 Aroz Paisa', id: 35 },
    { menu: [soup], text: 'Me regalas 2 sopas de lenteja', id: 9911 },
  ])('typo de nombre conserva la cantidad: $text', async ({ menu, text, id }) => {
    const h = harness(menu, false);
    await h.sendQueued(text);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id, qty: 2 })]);
  });

  it.each([
    { menu: products, first: 'Dos arroces chino porfavor', keep: 'No sólo el arroz', id: 26 },
    { menu: [bowl], first: 'Dos bowls andinos porfavor', keep: 'No sólo el bowl', id: 9910 },
  ])('negar el combo deja el plato suelto: $keep', async ({ menu, first, keep, id }) => {
    const h = harness(menu, false);
    await h.sendQueued(first);
    await h.sendQueued(keep);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id, qty: 2 })]);
  });

  it.each([
    {
      menu: products,
      text: 'Por favor\nMedio pollo frito\nUna sopa de ajiaco\nPara\nAdriana García\nCalle 6d 79a 56\nApto 470 interior 8\nCastilla reservado\nPagamos con un billete de 100mil',
      ids: [2, 38],
    },
    {
      menu: [bowl, soup],
      text: 'Por favor\nUn bowl andino\nUna sopa de lentejas\nPara\nAdriana García\nCalle 6d 79a 56\nApto 470 interior 8\nCastilla reservado\nPagamos con un billete de 100mil',
      ids: [9910, 9911],
    },
  ])('varias líneas separan platos, calle y billete', async ({ menu, text, ids }) => {
    const h = harness(menu, false);
    ready(h);
    await h.sendQueued(text);
    expect(h.cartRows()).toHaveLength(2);
    for (const id of ids) expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({ id, qty: 1 })]));
    expect(h.conv.sessionData.address).toMatch(/6d/i);
    expect(h.conv.sessionData.address).toMatch(/470/);
    expect(h.conv.sessionData.address).toMatch(/castilla/i);
    expect(h.conv.sessionData.address).not.toMatch(/ajiaco|lentejas|adriana|billete|bowl/i);
    expect(String(h.conv.sessionData.cashChangeFor)).toMatch(/100/);
  });

  it.each([
    { menu: products, order: 'Un arroz con pollo', id: 23 },
    { menu: [bowl], order: 'Un bowl andino', id: 9910 },
  ])('acá pagamos es efectivo y no agrega platos: $id', async ({ menu, order, id }) => {
    const h = harness(menu, false);
    ready(h);
    await h.sendQueued(order);
    await h.sendQueued('Calle 7f# 79c16 casa');
    await h.sendQueued('Acá pagamos gracias');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id, qty: 1 })]);
    expect(h.conv.sessionData.address).toMatch(/7f/i);
    expect(h.conv.sessionData.address).not.toMatch(/arroz|bowl|pagamos/i);
    expect(String(h.conv.sessionData.paymentMethod || '')).toMatch(/contraentrega|efectivo|cash/i);
  });

  it('medio pollo con ají y sin arepa no compra arepas aparte', async () => {
    const h = harness(products, false);
    await h.sendQueued('Para medio pollo frito con ají y sin arepa');
    expect(h.cartRows()).toEqual([expect.objectContaining({
      id: 2,
      qty: 1,
      attrs: expect.arrayContaining(['Arepas:sin arepas']),
      note: expect.stringMatching(/aj[ií]/i),
    })]);
    expect(h.cartRows()).toHaveLength(1);
  });

  it('otro menú guarda el ají y quita el pan sin una línea extra', async () => {
    const meal = { id: 9912, code: 9912, name: 'Wrap Andino', price: 16000, availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Pan', options: ['Integral', 'sin pan'] }] };
    const h = harness([meal], false);
    await h.sendQueued('Para un wrap andino con ají y sin pan');
    expect(h.cartRows()).toEqual([expect.objectContaining({
      id: 9912,
      qty: 1,
      attrs: expect.arrayContaining(['Pan:sin pan']),
      note: expect.stringMatching(/aj[ií]/i),
    })]);
  });

  it.each([
    { menu: products, ask: 'En combo a cuánto sale y sólo' },
    { menu: [bowl], ask: 'En combo a cuánto sale y sólo' },
  ])('preguntar combo o suelto no compra: $ask', async ({ menu, ask }) => {
    const h = harness(menu, false);
    await h.sendQueued(ask);
    expect(h.cartRows()).toEqual([]);
    expect(h.replies.at(-1)).not.toMatch(/no manejamos:\s*_?en combo/i);
  });

  it('qué sopa es no agrega otra sopa al ejecutivo', async () => {
    const h = harness(products, false);
    await h.sendQueued('Veci me regalas por favor un ejecutivo con pollo frito');
    const ids = h.cartRows().map((row) => row.id);
    await h.sendQueued('Que sopa es Veci?');
    expect(h.cartRows().map((row) => row.id)).toEqual(ids);
    expect(h.replies.at(-1)).toMatch(/ajiaco|menudencias|mondongo/i);
  });

  it('la lista copiada más el sabor no compra seis gaseosas', async () => {
    const h = harness(products, false);
    await h.sendQueued('Un combo de pollo frito');
    await h.sendQueued('Te ofrecemos colombiana, Manzana, ginger, uva, pepsi, 7up y coca cola\nGinger');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 99, qty: 1, attrs: expect.arrayContaining(['Bebida:Ginger']) })]);
  });

  it('repetir la cantidad no duplica el pedido', async () => {
    const h = harness(products, false);
    ready(h);
    await h.sendQueued('pedido porfa DoS Arroz con pollo');
    await h.sendQueued('CALle 6b#78c37');
    await h.sendQueued('2 arroces');
    await h.sendQueued('Con pollo');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 23, qty: 2 })]);
    expect(h.conv.sessionData.address).toMatch(/6b/i);
    expect(h.conv.sessionData.address).not.toMatch(/arroz|pollo/i);
  });

  it('dos ejecutivos se reparten presa y sopa', async () => {
    const h = harness(products, false);
    await h.sendQueued('Dos menu ejecutivo por favor');
    await h.sendQueued('Pollo frito');
    await h.sendQueued('Uno con presa pierna pernil y de sopa ajiaco y el otro con presa pechuga y de sopa mondongo');
    expect(h.cartRows()).toHaveLength(2);
    expect(h.cartRows().every((row) => row.id === 22 && row.qty === 1)).toBe(true);
    const attrs = h.cartRows().map((row) => row.attrs.join('|')).join(' || ');
    expect(attrs).toMatch(/Pierna Pernil/);
    expect(attrs).toMatch(/pechuga/i);
    expect(attrs).toMatch(/Ajiaco/);
    expect(attrs).toMatch(/Mondongo/);
  });
});


describe('Aclaración de cambio — referencia por posición',()=>{
  const alt=[{id:9971,code:71,name:'Bowl Mediterraneo',price:18000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Base',options:['Arroz','Quinoa']}]},{id:9972,code:72,name:'Bowl Andino',price:19000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Base',options:['Arroz','Quinoa']}]}];
  for(const f of [{menu:products,ids:[1,4],names:['1 Pollo Frito','1 Pollo Broaster'],attr:'Arepas',before:'Blancas',after:'Fritas',request:'Lo quiero con arepas fritas y bastante ají'},{menu:alt,ids:[9971,9972],names:['Bowl Mediterraneo','Bowl Andino'],attr:'Base',before:'Arroz',after:'Quinoa',request:'Lo quiero con quinoa y bastante ají'}]){
    const setup=()=>{const h=harness(f.menu,false);h.conv.sessionData.cart=f.ids.map((productId,index)=>({productId,code:productId,name:f.names[index],unitPrice:18000,quantity:index===0?2:1,attributes:[{attributeName:f.attr,attributeValue:f.before}]}));return h;};
    it.each([['el primero',0],['el segundo',1],['2',1]])('elige %s sin comprar otro producto en '+f.names[0],async(answer,index)=>{
      const h=setup();const before=structuredClone(h.cartRows());await h.sendQueued(f.request);expect(h.cartRows()).toEqual(before);
      await h.sendQueued(String(answer));
      expect(h.cartRows()).toHaveLength(2);expect(h.cartRows()[Number(index)]).toMatchObject({qty:before[Number(index)].qty,attrs:[f.attr+':'+f.after],note:expect.stringMatching(/bastante ají/i)});
      expect(h.cartRows()[1-Number(index)]).toEqual(before[1-Number(index)]);
      expect(h.conv.sessionData.pendingCartAttributeEdit).toBeUndefined();
    });
    it('posición inexistente conserva aclaración en '+f.names[0],async()=>{
      const h=setup();await h.sendQueued(f.request);const before=structuredClone(h.cartRows());await h.sendQueued('el tercero');
      expect(h.cartRows()).toEqual(before);expect(h.conv.sessionData.pendingCartAttributeEdit).toBeDefined();
    });
  }
});

describe('PDF pendiente — pedido dirección barrio en ráfaga',()=>{
  const bowl={id:9961,code:9961,name:'Bowl Mediterraneo',price:18000,availableNow:true,attributes:[]};
  for(const f of [{menu:products,id:23,dish:'arroz con pollo'},{menu:[bowl],id:9961,dish:'bowl mediterraneo'}]){
    it('conserva dos '+f.dish+' y dirección completa con una respuesta',async()=>{
      jest.useFakeTimers();try{
        const h=harness(f.menu,false);Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164});
        const texts=['Quiero dos '+f.dish,'Para la calle 12 #34-56 casa 8','Barrio Castilla'];
        const pending=texts.map((text,index)=>h.service.handleIncoming({waId:'customer',phoneE164:h.conv.phoneE164,messageId:'address-burst-'+index,messageType:'text',text,timestamp:index+1,raw:{}}));
        await jest.advanceTimersByTimeAsync(3000);await Promise.all(pending);
        expect(h.cartRows()).toEqual([expect.objectContaining({id:f.id,qty:2})]);
        expect(h.conv.sessionData.address).toMatch(/12.*34-56.*casa 8.*Castilla/is);expect(h.conv.sessionData.address).not.toMatch(/arroz|bowl/i);
        expect(h.replies).toHaveLength(1);expect(h.replies[0]).not.toMatch(/no entend[ií]|no manejamos/i);
      }finally{jest.useRealTimers();}
    });
  }
});

describe('Compuestos sin envoltorio — otros restaurantes',()=>{
  for(const [index,f] of [
    {name:'Hamburguesa Artesanal',attr:'Queso',option:'Cheddar',other:'Mozzarella',side:'Cheddar'},
    {name:'Pizza Campestre',attr:'Masa',option:'Delgada',other:'Gruesa',side:'Pan Delgada'},
    {name:'Bowl Tropical',attr:'Base',option:'Quinoa',other:'Arroz',side:'Quinoa'},
  ].entries()){
    const id=12000+index*10;
    const menu=[{id,code:id,name:f.name,price:21000,availableNow:true,hasAttributes:true,attributes:[{attributeName:f.attr,options:[f.other,f.option]}]},
      {id:id+1,code:id+1,name:f.side,price:4000,availableNow:true,attributes:[]}];
    it(f.name+' opción incluida no agrega SKU del componente',async()=>{
      const h=harness(menu,false);await h.sendQueued(`Quiero dos ${f.name} con ${f.option}, sin cebolla`);
      expect(h.cartRows()).toEqual([expect.objectContaining({id,qty:2,attrs:[f.attr+':'+f.option],note:expect.stringMatching(/sin cebolla/i)})]);
      expect(h.replies.at(-1)).not.toMatch(/no entend[ií]|no manejamos/i);
    });
    it.each(['; ','\n',' y '])(f.name+' pedido completo con adicional y dirección %j',async sep=>{
      const h=harness(menu,false);Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164});
      await h.sendQueued([`Por favor quiero dos ${f.name} con ${f.option} sin cebolla`,`un ${f.side} aparte`].join(sep)+'. Para la carrera 8 #15-20, pago por transferencia');
      expect(h.cartRows()).toHaveLength(2);
      expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id,qty:2,attrs:[f.attr+':'+f.option],note:expect.stringMatching(/sin cebolla/i)}),expect.objectContaining({id:id+1,qty:1})]));
      expect(h.conv.sessionData.address).toMatch(/8.*15-20/);expect(h.conv.sessionData.paymentMethod).toBe('transfer');
      expect(h.replies.at(-1)).not.toMatch(/no entend[ií]|no manejamos/i);
    });
    it(f.name+' aclara cambio compartido y respeta elección del segundo',async()=>{
      const second={...menu[0],id:id+2,code:id+2,name:f.name+' Premium'};
      const h=harness([...menu,second],false);
      h.conv.sessionData.cart=[menu[0],second].map(product=>({productId:product.id,code:product.code,name:product.name,unitPrice:product.price,quantity:2,note:'sin cebolla',attributes:[{attributeName:f.attr,attributeValue:f.option}]}));
      const before=structuredClone(h.conv.sessionData.cart);
      await h.sendQueued(`Mejor con ${f.other}`);
      expect(h.conv.sessionData.cart).toEqual(before);expect(h.replies.at(-1)).toMatch(/a cu[aá]l plato/i);
      await h.sendQueued('el segundo');
      expect(h.cartRows()).toEqual([
        expect.objectContaining({id,qty:2,attrs:[f.attr+':'+f.option],note:'sin cebolla'}),
        expect.objectContaining({id:id+2,qty:2,attrs:[f.attr+':'+f.other],note:'sin cebolla'}),
      ]);
      expect(h.replies.at(-1)).not.toMatch(/no entend[ií]|no manejamos/i);
    });
    it(f.name+' mencionar dos identidades explícitas conserva aclaración',async()=>{
      const second={...menu[0],id:id+2,code:id+2,name:f.name+' Premium'};
      const h=harness([...menu,second],false);
      h.conv.sessionData.cart=[menu[0],second].map(product=>({productId:product.id,code:product.code,name:product.name,unitPrice:product.price,quantity:2,attributes:[{attributeName:f.attr,attributeValue:f.option}]}));
      const before=structuredClone(h.conv.sessionData.cart);
      await h.sendQueued(`Mejor con ${f.other} para ${f.name} y ${second.name}`);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.replies.at(-1)).toMatch(/a cu[aá]l plato/i);
    });
    it(f.name+' adicional explícito conserva ambos productos',async()=>{
      const h=harness(menu,false);await h.sendQueued(`Quiero dos ${f.name} con ${f.option}; aparte un ${f.side}`);
      expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id,qty:2,attrs:[f.attr+':'+f.option]}),expect.objectContaining({id:id+1,qty:1})]));expect(h.cartRows()).toHaveLength(2);
    });
    it(f.name+' corrección y consulta conservan cantidad y nota',async()=>{
      const h=harness(menu,false);await h.sendQueued(`Quiero dos ${f.name} con ${f.option}, sin cebolla`);
      await h.sendQueued(`Mejor con ${f.other}`);
      const before=structuredClone(h.conv.sessionData.cart);
      await h.sendQueued(`Cuánto cuesta la ${f.name}?`);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.cartRows()).toEqual([expect.objectContaining({id,qty:2,attrs:[f.attr+':'+f.other],note:expect.stringMatching(/sin cebolla/i)})]);
      expect(h.replies.at(-1)).toMatch(/21[.,]?000/);
    });
  }
});

describe('Equivalencia por catálogo — sin porción inventada',()=>{
  const meal={id:16101,code:16101,name:'Arroz Chino Con Pollo Entero',price:30000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Pollo',options:['Frito','Broaster']}]};
  it('pedido sin tamaño usa la única presentación del catálogo y no añade medio',async()=>{
    const h=harness([meal],false);await h.sendQueued('Un arroz chino con pollo');await h.sendQueued('Broaster');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:16101,qty:1,attrs:['Pollo:Broaster']})]);
    expect(h.replies.at(-1)).not.toMatch(/medio pollo/i);
  });
  it('dos presentaciones no se convierten globalmente en medio pollo',async()=>{
    const h=harness([{...meal,name:'Arroz Chino Con Medio Pollo'},{...meal,id:16102,code:16102,name:'Arroz Chino Con Pollo Entero'}],false);
    await h.sendQueued('Un arroz chino con pollo');expect(h.cartRows()).toEqual([]);expect(h.replies.at(-1)).toMatch(/cu[aá]l|opci[oó]n|presentaci[oó]n|prefieres|escribe el n[uú]mero/i);
    expect(h.replies.at(-1)).toContain('Arroz Chino Con Medio Pollo');expect(h.replies.at(-1)).toContain('Arroz Chino Con Pollo Entero');
  });
});

describe('Para N personas no es la cantidad del plato', () => {
  const taco = { id: 11421, code: 11421, name: 'Taco Al Pastor', price: 12000, availableNow: true, hasAttributes: false, attributes: [] };
  it.each([
    ['Un churrasco para dos personas', products, 17, 1],
    ['Un churrasco para 4 personas', products, 17, 1],
    ['Somos tres personas, un churrasco', products, 17, 1],
    ['Dos churrascos para cuatro personas', products, 17, 2],
    ['Un taco al pastor para tres personas', [taco], 11421, 1],
    ['Dos tacos al pastor para cuatro personas', [taco], 11421, 2],
    ['Somos cuatro personas, un taco al pastor', [taco], 11421, 1],
  ] as const)('%s', async (text, menu, id, qty) => {
    const h = harness(menu as typeof products, false);
    await h.sendQueued(text);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id, qty })]);
  });
  it.each([
    [products, 'Un churrasco para dos personas y dos sopas de mondongo', 17, 45],
    [[taco, { id: 11422, code: 11422, name: 'Sopa De Lentejas', price: 8000, availableNow: true, hasAttributes: false, attributes: [] }], 'Un taco al pastor para dos personas y dos sopas de lentejas', 11421, 11422],
  ] as const)('cada plato conserva su cantidad junto a los comensales', async (menu, text, mainId, sideId) => {
    const h = harness(menu as typeof products, false);
    await h.sendQueued(text);
    expect(h.cartRows()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: mainId, qty: 1 }),
      expect.objectContaining({ id: sideId, qty: 2 }),
    ]));
    expect(h.cartRows()).toHaveLength(2);
  });
});

describe('Recargo de barrio, dos combos y el pago', () => {
  const plate = (id: number, name: string, extra: Record<string, unknown> = {}) => ({
    id, code: id, name, price: 18000, availableNow: true, hasAttributes: false, attributes: [], ...extra,
  });
  const pizza = [plate(11601, 'Combo De Pizza Margarita', {
    price: 28000, hasAttributes: true,
    attributes: [{ attributeName: 'Bebida', options: ['Cola', 'Limonada', 'Agua'] }],
  })];
  const sushi = [plate(11621, 'Roll De Salmon')];
  const ramen = [
    plate(11611, 'Ramen De Miso', { price: 22000 }),
    plate(11612, 'Gyoza', { price: 9000 }),
  ];

  const stubPayment = (h: ReturnType<typeof harness>) => {
    h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 9001, dailyOrderNumber: 21 });
    h.service.paymentsService.createPreference = jest.fn().mockResolvedValue({
      preferenceId: 'pref-test', initPoint: 'https://pay.test/pref-test',
    });
  };

  it.each([
    { menu: products, ask: 'La vez pasada en el barrio me cobraron un recargo de 4 mil, aún tienen el servicio?' },
    { menu: sushi, ask: 'Antes me cobraron recargo por el barrio, todavía lo cobran?' },
  ])('el recargo histórico no arma pedido ni inventa el valor', async ({ menu, ask }) => {
    const h = harness(menu as typeof products, true);
    const reply = await h.sendQueued(ask);
    expect(h.cartRows()).toHaveLength(0);
    expect(h.conv.sessionData.address || '').toBe('');
    expect(h.conv.sessionData.orderType).not.toBe('delivery');
    expect(reply || '').toMatch(/recargo/i);
    expect(reply || '').toMatch(/restaurante/i);
    expect(reply || '').not.toMatch(/\$\s*4[.\s]?000|4\s*mil/i);
    expect(reply || '').not.toMatch(/no manejamos/i);
  });

  it('con un plato ya pedido, el recargo no lo toca', async () => {
    const h = harness(products, false);
    await h.sendQueued('Un churrasco');
    const reply = await h.sendQueued('La vez pasada el recargo del barrio eran 4 mil, aún tienen el servicio?');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 17, qty: 1 })]);
    expect(reply || '').toMatch(/sigue igual/i);
    expect(reply || '').not.toMatch(/\$\s*4[.\s]?000/i);
  });

  it.each([
    {
      menu: products, agent: true,
      order: 'Dos combos de arroz paisa, uno con Colombia y el otro con Coca-Cola',
      id: 94, left: /Colombiana/i, right: /Coca Cola/i,
    },
    {
      menu: pizza, agent: false,
      order: 'Dos combos de pizza margarita, uno con cola y el otro con limonada',
      id: 11601, left: /Cola/i, right: /Limonada/i,
    },
  ])('dos combos del mismo plato quedan con bebidas distintas', async ({ menu, agent, order, id, left, right }) => {
    const h = harness(menu as typeof products, agent);
    await h.sendQueued(order);
    const rows = h.cartRows().filter((row) => row.id === id);
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.qty === 1)).toBe(true);
    const drinks = rows.map((row) => row.attrs.join('|')).join(' || ');
    expect(drinks).toMatch(left);
    expect(drinks).toMatch(right);
    expect(h.cartRows().filter((row) => row.id !== id)).toHaveLength(0);
  });

  it('dos combos, domicilio y nequi crean el pedido simulado', async () => {
    const h = harness(products, true);
    stubPayment(h);
    await h.sendQueued('Dos combos de arroz paisa, uno con Colombia y el otro con Coca-Cola');
    await h.sendQueued('Calle 48 sur 87 86');
    await h.sendQueued('Pago por nequi');
    if (h.conv.state === 'awaiting_final_confirm') await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const dto = h.service.ordersService.create.mock.calls[0][0];
    expect(dto.items).toHaveLength(2);
    expect(dto.items.every((item: { productId: number }) => item.productId === 94)).toBe(true);
    expect(dto.address || '').toMatch(/transferencia|nequi/i);
    expect(h.service.paymentsService.createPreference).not.toHaveBeenCalled();
    expect(h.replies.at(-1) || '').toMatch(/pedido|listo|#\s*21/i);
  });

  it('el link de mercado pago se pide al servicio de pagos y no crea la orden', async () => {
    const h = harness(pizza as typeof products, false);
    stubPayment(h);
    await h.sendQueued('Dos combos de pizza margarita, uno con cola y el otro con limonada');
    await h.sendQueued('Calle 48 sur 87 86');
    const reply = await h.sendQueued('Link de mercado pago');
    expect(h.service.paymentsService.createPreference).toHaveBeenCalledTimes(1);
    const items = h.service.paymentsService.createPreference.mock.calls[0][1];
    expect(items).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: expect.stringMatching(/pizza/i), quantity: 1 }),
    ]));
    expect(items).toHaveLength(2);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    expect(reply || '').toMatch(/pay\.test\/pref-test/);
    expect(h.conv.state).toBe('awaiting_mp_payment');
  });

  it('churrasco, mondongo y yuca se pagan en efectivo con el billete', async () => {
    const h = harness(products, false);
    stubPayment(h);
    await h.sendQueued('Un churrasco, una sopa de mondongo y una porcion de yuca frita');
    await h.sendQueued('Carrera 15 45 20');
    await h.sendQueued('Pago en efectivo con un billete de 50 mil');
    expect(h.conv.sessionData.paymentMethod).toBe('cash');
    expect(String(h.conv.sessionData.cashChangeFor || '')).toMatch(/50/);
    if (h.conv.state === 'awaiting_final_confirm') await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const dto = h.service.ordersService.create.mock.calls[0][0];
    expect(dto.items.map((item: { productId: number }) => item.productId).sort((a: number, b: number) => a - b)).toEqual([7, 17, 45]);
    expect(String(dto.address || '')).toMatch(/efectivo|contraentrega|50/);
  });

  it('ramen y gyoza se pagan por daviplata sin mezclar los platos', async () => {
    const h = harness(ramen as typeof products, true);
    stubPayment(h);
    await h.sendQueued('Un ramen de miso y una gyoza');
    await h.sendQueued('Avenida 68 20 15');
    await h.sendQueued('Pago por daviplata');
    if (h.conv.state === 'awaiting_final_confirm') await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const dto = h.service.ordersService.create.mock.calls[0][0];
    expect(dto.items.map((item: { productId: number }) => item.productId).sort()).toEqual([11611, 11612]);
    expect(dto.address || '').toMatch(/transferencia|daviplata/i);
    expect(h.replies.at(-1) || '').toMatch(/pedido|listo|#\s*21/i);
  });
});

describe('Sin coincidencias — no hay un resto para confirmar',()=>{
  const alt=[{id:12101,code:12101,name:'Taco Al Pastor',price:12000,availableNow:true,hasAttributes:false,attributes:[]}];
  it.each([{menu:products},{menu:alt}])('productos ajenos no piden confirmar un pedido vacío',async ({menu})=>{
    const h=harness(menu,false);
    const reply=await h.sendQueued('hola buenas noches me envias por favor una libra de arroz, dos aceites y un kilo de azúcar');
    expect(h.cartRows()).toEqual([]);
    expect(reply).toMatch(/arroz|aceite|az[uú]car/i);
    expect(reply).toMatch(/men[uú]/i);
    expect(reply).not.toMatch(/Entendí varios platos|El resto|escribe.*s[ií]|buenas noches|me envias/i);
  });
  it('la propuesta parcialmente reconocida conserva la confirmación útil',()=>{
    const h=harness(products,false);
    const reply=h.service.formatMultiOrderProposal({segments:['Un churrasco','un jabón'],confident:[{product:products.find(p=>p.id===17),segment:'Un churrasco',score:100}],ambiguous:[],needsAttributes:[],unresolved:['un jabón'],possibleCustomerNames:[]});
    expect(reply).toMatch(/Churrasco/);
    expect(reply).toMatch(/El resto.*s[ií]/i);
    expect(reply).toMatch(/jab[oó]n/);
  });
  it('pedir productos ajenos no borra un carrito existente',async()=>{
    const h=harness(alt,false);await h.sendQueued('Un taco al pastor');
    const before=structuredClone(h.conv.sessionData.cart);
    const reply=await h.sendQueued('Una libra de arroz, dos aceites y un kilo de azúcar');
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(reply).not.toMatch(/El resto|escribe.*s[ií]/i);
  });
});

describe('Otras cocinas — subconjunto incoherente no modifica carrito',()=>{
  for(const [index,name] of ['Crepe De Champiñones','Pad Thai De Tofu','Lomo Saltado'].entries())for(const agent of [false,true])for(const request of [
    'nueve de los ocho PLATO sin cilantro y los demás normales',
    'dos de los siete PLATO sin cilantro y los demás normales',
    'dos de los ocho PLATO sin cilantro y los otros cinco normales',
    'dos de los ocho plato inexistente sin cilantro y los demás normales',
  ]){
    it(name+' agent='+agent+' '+request,async()=>{
      const id=12700+index;
      const h=harness([{id,code:id,name,price:22000,availableNow:true,hasAttributes:false,attributes:[]}],false);
      await h.sendQueued('8 '+name);expect(h.cartRows()).toHaveLength(1);expect(h.cartRows()[0].qty).toBe(8);
      const before=structuredClone(h.cartRows());h.cfg.agentV1Enabled=agent;
      await h.sendQueued(request.replace('PLATO',name));
      expect(h.cartRows()).toEqual(before);
      expect(h.replies.at(-1)).toMatch(/cu[aá]ntas unidades|cu[aá]l producto/i);
    });
  }
});

describe('Básicos cotidianos — pregunta de servicio conserva pedido y paso',()=>{
  const questions=[
    {text:'¿Están atendiendo?',answer:/atendiendo|abiertos|horario/i},
    {text:'¿A qué hora cierran?',answer:/horario|23:59/i},
    {text:'¿Dónde queda el local?',answer:/Calle 20 30 40/i},
    {text:'¿Puedo recoger en el local?',answer:/recoger|recogida|local/i},
    {text:'¿Tienen domicilio?',answer:/domicilio/i},
  ];
  for(const name of ['Estofado Irlandes','Baguette De Jamon'])for(const agent of [false,true])for(const state of ['building_cart','awaiting_payment','awaiting_final_confirm'])for(const q of questions){
    it(name+' '+state+' agent='+agent+' '+q.text,async()=>{
      const h=harness([{id:13001,code:13001,name,price:14700,availableNow:true,hasAttributes:false,attributes:[]}],false);
      await h.sendQueued('2 '+name);expect(h.cartRows()).toEqual([expect.objectContaining({id:13001,qty:2})]);
      h.cfg.brandName='Local Ficticio';h.cfg.localContext={restaurantAddress:'Calle 20 30 40',restaurantCity:'Ciudad Ejemplo'};
      Object.assign(h.conv.sessionData,{orderType:'delivery',address:'Carrera 8 12 10',addressConfirmed:true,deliveryFeeCalculated:3500,paymentMethod:state==='awaiting_final_confirm'?'cash':undefined});
      h.cfg.agentV1Enabled=agent;h.conv.state=state;
      const before=structuredClone(h.conv.sessionData);
      const reply=await h.sendQueued(q.text);
      expect(h.conv.sessionData.cart).toEqual(before.cart);
      expect(h.conv.sessionData.address).toBe(before.address);
      expect(h.conv.sessionData.orderType).toBe(before.orderType);
      expect(h.conv.sessionData.paymentMethod).toBe(before.paymentMethod);
      expect(h.conv.state).toBe(state);
      expect(reply).toMatch(q.answer);
      expect(reply).not.toMatch(/no manejamos|no entend[ií]|direcci[oó]n actualizada|c[oó]mo pagas/i);
    });
  }
});

describe('Básicos cotidianos — precio consultado y recogida elegida',()=>{
  for(const name of ['Estofado Irlandes','Baguette De Jamon'])for(const agent of [false,true]){
    async function setup(){
      const h=harness([{id:13002,code:13002,name,price:14700,availableNow:true,hasAttributes:false,attributes:[]}],false);
      await h.sendQueued('2 '+name);expect(h.cartRows()).toEqual([expect.objectContaining({id:13002,qty:2})]);
      h.cfg.agentV1Enabled=agent;h.service.ordersService.create=jest.fn();return h;
    }
    for(const question of ['Cuánto cuesta PLATO?','Eso cuánto vale?','Me dices el precio?']){
      it(name+' precio agent='+agent+' '+question,async()=>{
        const h=await setup();const before=structuredClone(h.cartRows());
        const reply=await h.sendQueued(question.replace('PLATO',name));
        expect(h.cartRows()).toEqual(before);
        expect(reply).toMatch(/14[.,]700|29[.,]400/);
        expect(reply).not.toMatch(/agregu[eé]|no manejamos|no entend[ií]/i);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
      });
    }
    it(name+' consultar recogida y elegirla después agent='+agent,async()=>{
      const h=await setup();Object.assign(h.conv.sessionData,{orderType:'delivery',address:'Carrera 8 12 10',addressConfirmed:true,deliveryFeeCalculated:3500});
      const before=structuredClone(h.cartRows());
      await h.sendQueued('¿Puedo recoger en el local?');
      expect(h.conv.sessionData.orderType).toBe('delivery');
      await h.sendQueued('Paso a recoger');
      expect(h.cartRows()).toEqual(before);
      expect(h.conv.sessionData.orderType).toBe('pickup');
      expect(h.conv.sessionData.deliveryFeeCalculated).toBe(0);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
  }
});

describe('Pedido mixto — compra clara inmediata',()=>{
 const menu=[
 {id:15811,code:15811,name:'Hamburguesa Clasica',price:20000,availableNow:true,hasAttributes:false,attributes:[]},
 {id:15812,code:15812,name:'Trio De Tacos Al Pastor',price:39000,availableNow:true,hasAttributes:false,attributes:[]},
 {id:15813,code:15813,name:'Duo De Tacos Al Pastor',price:29000,availableNow:true,hasAttributes:false,attributes:[]}];
 it.each([false,true])('añade claro sin sí y conserva selección sin duplicar (agente %s)',async agent=>{
 const h=harness(menu,agent);
 const reply=await h.sendQueued('Quiero un pero caliente, una hamburguesa y un combo de tres tacos');
 expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:15811,qty:1})]));
 expect(reply).not.toMatch(/escribe.*s[ií].*✅|queda listo cuando/i);
 if(h.conv.sessionData.pendingMultiOrder?.ambiguous.length) await h.sendQueued('Trio De Tacos Al Pastor');
 expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:15812,qty:1})]));
 expect(h.cartRows().filter(r=>r.id===15811)).toHaveLength(1);
 });
});


describe('Opciones obligatorias — cantidad y cancelación durante selección',()=>{
 const families=[{drink:'Jugo Natural',flavors:['Mango','Lulo']},{drink:'Gaseosa Artesanal',flavors:['Mora','Durazno']}];
 function setup(drink:string,flavors:string[],agent:boolean){
 const menu=[{id:16021,code:16021,name:'Bowl Vegetal',price:16000,availableNow:true,hasAttributes:false,attributes:[]},
 {id:16022,code:16022,name:drink,price:8000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:flavors}]}];
 const h=harness(menu,agent);h.service.ordersService.create=jest.fn();return h;
 }
 it.each(families.flatMap(family=>[false,true].map(agent=>({...family,agent}))))('$drink cambia tres a cinco sin perder sabor pendiente (agente $agent)',async({drink,flavors,agent})=>{
 const h=setup(drink,flavors,agent);
 await h.sendQueued(`Quiero dos bowl vegetal y tres ${drink}`);
 const cart=h.cartRows();
 await h.sendQueued(`Mejor que sean cinco ${drink}`);
 expect(h.conv.sessionData.pendingAttribute?.quantity).toBe(5);
 const pending=structuredClone(h.conv.sessionData.pendingAttribute);
 const reply=await h.sendQueued('Me recuerdas los sabores?');
 expect(reply).toMatch(new RegExp(flavors.join('|'),'i'));
 expect(h.cartRows()).toEqual(cart);
 expect(h.conv.sessionData.pendingAttribute).toEqual(pending);
 await h.sendQueued(flavors[1]);
 expect(h.cartRows()).toContainEqual(expect.objectContaining({id:16022,qty:5,attrs:[`Sabor:${flavors[1]}`]}));
 expect(h.cartRows()).toHaveLength(2);
 expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it.each(families.flatMap(family=>[false,true].map(agent=>({...family,agent}))))('$drink se cancela conservando el plato (agente $agent)',async({drink,flavors,agent})=>{
 const h=setup(drink,flavors,agent);
 await h.sendQueued(`Quiero dos bowl vegetal y tres ${drink}`);
 const cart=h.cartRows();
 await h.sendQueued('Qué sabores hay?');
 await h.sendQueued('Olvida esa bebida');
 expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
 expect(h.conv.sessionData.pendingMultiOrder).toBeFalsy();
 expect(h.cartRows()).toEqual(cart);
 await h.sendQueued(flavors[0]);
 expect(h.cartRows()).toEqual(cart);
 expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});

describe('Pedido y redimir en el mismo mensaje', () => {
  const ramen = [{ id: 17501, code: 17501, name: 'Ramen De Miso', price: 24000, availableNow: true, hasAttributes: false, attributes: [] }];
  const pointsFor = () => {
    let balance = 9;
    const redeem = jest.fn(async () => {
      balance -= 9;
      return { code: 'ABCD2345EFGH', expiresAt: null };
    });
    return {
      redeem,
      service: new WhatsappPointsService({
        getAvailablePoints: async () => balance,
        redeemPointsForVoucher: redeem,
      } as never),
    };
  };

  it.each([
    { agent: false, menu: products, text: 'agrega un medio pollo broaster y quiero redimir mis puntos', id: 5 },
    { agent: true, menu: products, text: 'agrega un medio pollo broaster y quiero redimir mis puntos', id: 5 },
    { agent: false, menu: ramen, text: 'agrega un ramen de miso y quiero generar un premio', id: 17501 },
    { agent: true, menu: ramen, text: 'agrega un ramen de miso y quiero generar un premio', id: 17501 },
  ])('genera el premio una vez y no lo aplica al plato (agent $agent)', async ({ agent, menu, text, id }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    const points = pointsFor();
    h.service.pointsHandler = points.service;
    h.conv.sessionData.linkedUserId = 'test-account';
    await h.sendQueued(text);
    expect(h.cartRows().find((row) => row.id === id)).toMatchObject({ qty: 1 });
    expect(h.cartRows()).toHaveLength(1);
    expect(h.conv.sessionData.pendingRedemptionCode).toBeFalsy();
    expect(points.redeem).toHaveBeenCalledTimes(1);
    expect(h.replies.join(' ')).toMatch(/premio generado/i);
    expect(h.replies.join(' ')).toMatch(/no lo apliqué/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each([false, true])('sin cuenta anota el plato y no genera el premio (agent %s)', async (agent) => {
    const h = harness(products, agent);
    h.service.ordersService.create = jest.fn();
    const points = pointsFor();
    h.service.pointsHandler = points.service;
    const reply = await h.sendQueued('agrega un medio pollo broaster y quiero redimir mis puntos');
    expect(h.cartRows().find((row) => row.id === 5)).toMatchObject({ qty: 1 });
    expect(h.conv.sessionData.pendingRedemptionCode).toBeFalsy();
    expect(points.redeem).not.toHaveBeenCalled();
    expect(h.replies.join(' ')).toMatch(/no lo generé/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each([
    { agent: false, menu: products, item: { productId: 17, code: 17, name: 'Churrasco', unitPrice: 38000, quantity: 1, attributes: [] as [] } },
    { agent: true, menu: ramen, item: { productId: 17501, code: 17501, name: 'Ramen De Miso', unitPrice: 24000, quantity: 1, attributes: [] as [] } },
  ])('una consulta no genera el premio ni cambia el pedido (agent $agent)', async ({ agent, menu, item }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    const points = pointsFor();
    h.service.pointsHandler = points.service;
    h.conv.sessionData.linkedUserId = 'test-account';
    h.conv.sessionData.cart = [item];
    const before = structuredClone(h.cartRows());
    const reply = await h.sendQueued('¿agrego otro plato y quiero redimir mis puntos?');
    expect(h.cartRows()).toEqual(before);
    expect(h.conv.sessionData.pendingRedemptionCode).toBeFalsy();
    expect(points.redeem).not.toHaveBeenCalled();
    expect(reply || '').toMatch(/no generé el premio/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each([
    { agent: false, menu: products, text: 'agrega un medio pollo broaster, quiero redimir y aplicalo a este pedido', id: 5 },
    { agent: true, menu: products, text: 'agrega un medio pollo broaster, quiero redimir y aplicalo a este pedido', id: 5 },
    { agent: false, menu: ramen, text: 'agrega un ramen de miso, quiero generar un premio y aplicalo a este pedido', id: 17501 },
    { agent: true, menu: ramen, text: 'agrega un ramen de miso, quiero generar un premio y aplicalo a este pedido', id: 17501 },
  ])('solo lo anota si el mismo mensaje lo pide (agent $agent)', async ({ agent, menu, text, id }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    const points = pointsFor();
    h.service.pointsHandler = points.service;
    h.conv.sessionData.linkedUserId = 'test-account';
    await h.sendQueued(text);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id, qty: 1 })]);
    expect(h.conv.sessionData.pendingRedemptionCode).toBe('ABCD2345EFGH');
    expect(points.redeem).toHaveBeenCalledTimes(1);
    expect(h.replies.join(' ')).toMatch(/lo dejé anotado/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it.each([
    { agent: false, menu: products, first: 'agrega un medio pollo broaster y quiero redimir mis puntos', id: 5 },
    { agent: true, menu: ramen, first: 'agrega un ramen de miso y quiero generar un premio', id: 17501 },
  ])('un sí después no recupera el código de la respuesta anterior (agent $agent)', async ({ agent, menu, first, id }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    const points = pointsFor();
    h.service.pointsHandler = points.service;
    h.conv.sessionData.linkedUserId = 'test-account';
    await h.sendQueued(first);
    expect(h.conv.sessionData.pendingRedemptionCode).toBeFalsy();
    const reply = await h.sendQueued('sí, aplícalo');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id, qty: 1 })]);
    expect(h.conv.sessionData.pendingRedemptionCode).toBeFalsy();
    expect(points.redeem).toHaveBeenCalledTimes(1);
    expect(reply || '').toMatch(/no apliqué el premio/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('Corrección después del premio', () => {
  const bowls = [
    { id: 17801, code: 17801, name: 'Ramen De Miso', price: 24000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 17802, code: 17802, name: 'Ramen De Shoyu', price: 25000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 17803, code: 17803, name: 'Edamame', price: 8000, availableNow: true, hasAttributes: false, attributes: [] },
  ];
  const line = (id: number, name: string, price: number) => ({
    productId: id, code: id, name, unitPrice: price, quantity: 1, attributes: [] as { attributeName: string; attributeValue: string }[],
  });

  it.each([
    {
      agent: false,
      menu: products,
      cart: [line(5, '1/2 Pollo Broaster', 25000), line(7, 'Porcion De Yuca Frita', 7000)],
      text: 'cambia el medio broaster por el medio frito',
      gone: 5,
      next: 2,
      keep: 7,
    },
    {
      agent: true,
      menu: products,
      cart: [line(5, '1/2 Pollo Broaster', 25000), line(7, 'Porcion De Yuca Frita', 7000)],
      text: 'cambia el medio broaster por el medio frito',
      gone: 5,
      next: 2,
      keep: 7,
    },
    {
      agent: false,
      menu: bowls,
      cart: [line(17801, 'Ramen De Miso', 24000), line(17803, 'Edamame', 8000)],
      text: 'cambia el ramen de miso por el ramen de shoyu',
      gone: 17801,
      next: 17802,
      keep: 17803,
    },
    {
      agent: true,
      menu: bowls,
      cart: [line(17801, 'Ramen De Miso', 24000), line(17803, 'Edamame', 8000)],
      text: 'cambia el ramen de miso por el ramen de shoyu',
      gone: 17801,
      next: 17802,
      keep: 17803,
    },
  ])('cambia el plato y conserva el premio y el acompañamiento (agent $agent)', async ({ agent, menu, cart, text, gone, next, keep }) => {
    const h = harness(menu as typeof products, agent);
    h.service.ordersService.create = jest.fn();
    const redeem = jest.fn();
    h.service.pointsHandler = new WhatsappPointsService({ redeemPointsForVoucher: redeem } as never);
    h.conv.sessionData.cart = cart;
    h.conv.sessionData.pendingRedemptionCode = 'ABCD2345EFGH';
    await h.sendQueued(text);
    expect(h.cartRows().some((row) => row.id === gone)).toBe(false);
    expect(h.cartRows().find((row) => row.id === next)?.qty).toBe(1);
    expect(h.cartRows().find((row) => row.id === keep)?.qty).toBe(1);
    expect(h.cartRows()).toHaveLength(2);
    expect(h.conv.sessionData.pendingRedemptionCode).toBe('ABCD2345EFGH');
    expect(redeem).not.toHaveBeenCalled();
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

describe('Foto — conserva atributos y notas de la línea elegida', () => {
  it.each(['Pizza Vegetal','Bowl De Quinoa'].flatMap((name,index)=>[false,true].map(agent=>({name,index,agent}))))('conserva opciones de $name (agent $agent)',async({name,index,agent})=>{
    const id=19101+index;
    const product={id,code:id,name,price:18000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Salsa',options:['Suave','Picante']}]};
    const h=harness([product] as typeof products,agent);h.service.ordersService.create=jest.fn();
    h.conv.sessionData.cart=[{productId:id,code:id,name,unitPrice:18000,quantity:3,attributes:[{attributeName:'Salsa',attributeValue:'Picante'}],note:'sin cebolla'}];
    h.conv.sessionData.recentImageOrder=[{productId:id,name}];
    h.conv.state=agent?'awaiting_payment':'awaiting_address';
    h.conv.sessionData.address='Calle 12 #34-56';
    h.conv.sessionData.paymentMethod='cash';
    await h.sendQueued('de la foto solo el primero');
    expect(h.cartRows()).toEqual([expect.objectContaining({id,qty:3,note:'sin cebolla',attrs:['Salsa:Picante']})]);
    expect(h.conv.sessionData.address).toBe('Calle 12 #34-56');
    expect(h.conv.sessionData.paymentMethod).toBe('cash');
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
  it.each([false,true])('una opción retirada no se cambia silenciosamente (agent %s)',async(agent)=>{
    const product={id:19111,code:19111,name:'Wrap De Verduras',price:15000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Salsa',options:['Suave']}]};
    const h=harness([product] as typeof products,agent);h.service.ordersService.create=jest.fn();
    h.conv.sessionData.cart=[{productId:product.id,code:product.code,name:product.name,unitPrice:15000,quantity:2,attributes:[{attributeName:'Salsa',attributeValue:'Picante'}],note:'sin cebolla'}];
    h.conv.sessionData.recentImageOrder=[{productId:product.id,name:product.name}];
    const before=structuredClone(h.conv.sessionData.cart);
    const reply=await h.sendQueued('de la foto solo el primero');
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(reply||'').toMatch(/no pude|opción|opciones|aclar/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

});

describe('Negación de opción — sin frente a alternativa configurada',()=>{
 it.each(['Pizza De Setas','Bowl De Quinoa'].flatMap((name,index)=>[false,true].flatMap(agent=>[false,true].map(configured=>({name,index,agent,configured})))))('opción sin configurada=$configured agent=$agent',async({name,index,agent,configured})=>{
  const p={id:20601+index,code:1301+index,name,price:17000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Salsa',options:configured?['Suave','Picante','Sin Picante']:['Suave','Picante']}]};
  const h=harness([p] as typeof products,agent);h.service.ordersService.create=jest.fn();h.conv.state='awaiting_payment';h.conv.sessionData.address='Calle 12 #34-56';
  h.conv.sessionData.cart=[{productId:p.id,name:p.name,code:p.code,unitPrice:17000,quantity:2,attributes:[{attributeName:'Salsa',attributeValue:'Picante'}],note:'sin cebolla'}];
  const reply=await h.sendQueued('No con salsa picante, mejor sin picante');
  expect(h.cartRows()).toEqual([expect.objectContaining({id:p.id,qty:2,note:'sin cebolla',attrs:[`Salsa:${configured?'Sin Picante':'Picante'}`]})]);
  if(!configured){expect(reply||'').toMatch(/cuál|cual|opción|opciones|suave/i);expect(reply||'').not.toMatch(/listo|queda con.*picante/i);}
  expect(h.conv.sessionData.address).toBe('Calle 12 #34-56');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});


describe('Código con nota y producto por nombre — no consumir la otra compra',()=>{
 it.each([['Pizza De Setas','Agua Mineral'],['Bowl De Quinoa','Te Helado']].flatMap((names,index)=>[false,true].map(agent=>({names,index,agent}))))('segunda compra reconocida agent=$agent',async({names,index,agent})=>{
  const menu=names.map((name,offset)=>({id:20901+index*10+offset,code:1601+index*10+offset,name,price:17000,availableNow:true,hasAttributes:false,attributes:[]}));
  const h=harness(menu as typeof products,agent);h.service.ordersService.create=jest.fn();h.conv.state='awaiting_payment';
  await h.sendQueued(`Agrega dos #${menu[0].code} sin cebolla y un ${menu[1].name}`);
  expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:menu[0].id,qty:2,note:expect.stringMatching(/sin cebolla/i)}),expect.objectContaining({id:menu[1].id,qty:1})]));
  expect(h.cartRows()).toHaveLength(2);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});

describe('Opciones pendientes — precio y cantidad sin repetir el producto',()=>{
 const families=[{name:'Jugo Natural',flavors:['Mango','Lulo']},{name:'Gaseosa Artesanal',flavors:['Mora','Durazno']}];
 it.each(families.flatMap(family=>[false,true].flatMap(agent=>[false,true].flatMap(code=>['Mejor solo dos','Que sean dos por favor','En vez de tres quiero dos'].map(change=>({...family,agent,code,change}))))))('$name code=$code cambio=$change agent=$agent',async({name,flavors,agent,code,change})=>{
  const base={id:21001,code:1701,name:'Bowl Vegetal',price:16000,availableNow:true,hasAttributes:false,attributes:[]};
  const drink={id:21002,code:1702,name,price:8000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:flavors}]};
  const h=harness([base,drink] as typeof products,agent);h.service.ordersService.create=jest.fn();
  await h.sendQueued('Quiero dos Bowl Vegetal');
  await h.sendQueued(code?'Agrega tres #1702 sin hielo':`Quiero tres ${name} sin hielo`);
  expect(h.conv.sessionData.pendingAttribute?.productId).toBe(drink.id);expect(h.conv.sessionData.pendingAttribute?.quantity).toBe(3);
  const pending=structuredClone(h.conv.sessionData.pendingAttribute);const before=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued('¿Cuánto cuesta cada uno?');
  expect(reply||'').toMatch(/8\.000/);expect(h.conv.sessionData.pendingAttribute).toEqual(pending);expect(h.conv.sessionData.cart).toEqual(before);
  await h.sendQueued(change);
  expect(h.conv.sessionData.pendingAttribute?.quantity).toBe(2);expect(h.conv.sessionData.cart).toEqual(before);
  const optionsReply=await h.sendQueued('¿Qué sabores hay?');expect(optionsReply||'').toMatch(new RegExp(flavors.join('|'),'i'));
  await h.sendQueued(flavors[1]);
  expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({id:base.id,qty:2}),expect.objectContaining({id:drink.id,qty:2,attrs:[`Sabor:${flavors[1]}`],note:expect.stringMatching(/sin hielo/i)})]));
  expect(h.cartRows()).toHaveLength(2);expect(h.conv.sessionData.pendingAttribute).toBeFalsy();expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});


describe('Oferta estructurada — continuidad portable y controles', () => {
  for (const [i,name] of ['Pizza Rustica','Ramen De Miso','Bowl Andino','Tacos Vegetarianos'].entries()) {
    const product={...products[0],id:31000+i,code:910+i,name,price:19000+i*1000,hasAttributes:false,attributes:[]};
    it.each([true,false])(`${name} pregunta de rendimiento conserva oferta y cantidad agent=%s`, async enabled => {
      const h=harness([product],enabled);
      h.conv.sessionData.pendingAddOffer={productId:product.id,name,code:product.code,price:product.price,quantity:1,sourceText:name};
      h.conv.sessionData.productFocus={productId:product.id,name};
      const before=structuredClone(h.cartRows());
      await h.send('Para cuantas personas alcanza?');
      expect(h.cartRows()).toEqual(before);
      expect(h.conv.sessionData.pendingAddOffer?.productId).toBe(product.id);
      const reply=await h.send('De acuerdo entonces dame dos');
      expect(h.cartRows()).toEqual([expect.objectContaining({id:product.id,qty:2})]);
      expect(reply).not.toMatch(/no est[aá] en tu carrito|no manejamos/i);
      expect(h.conv.sessionData.pendingAddOffer).toBeUndefined();
    });
    it.each([true,false])(`${name} extra no multiplica plato ni agrega SKU agent=%s`,async enabled=>{
      const side={...product,id:32000+i,code:920+i,name:'Porcion De Ensalada',price:7000};
      const h=harness([product,side],enabled);
      h.conv.sessionData.pendingAddOffer={productId:product.id,name,code:product.code,price:product.price,quantity:2,sourceText:`Dos ${name} sin ensalada`};
      h.conv.sessionData.productFocus={productId:product.id,name};
      h.conv.sessionData.address='Calle 10 #20-30';
      const reply=await h.send('Lo quiero normal pero que le agreguen tres hojitas de ensalada como siempre');
      expect(h.cartRows()).toEqual([expect.objectContaining({id:product.id,qty:2})]);
      expect(h.conv.sessionData.customerNotes).toMatch(/revisar con el local.*tres hojitas/i);
      expect(h.conv.sessionData.address).toBe('Calle 10 #20-30');
      expect(reply).not.toMatch(/no manejamos|gratis/i);
    });
    it.each([true,false])(`${name} cantidad cambia línea enfocada conservando otra agent=%s`,async enabled=>{
      const h=harness([product],enabled);
      h.conv.sessionData.cart=[{productId:product.id,code:product.code,name,quantity:1,unitPrice:product.price,note:'sin cilantro',attributes:[]}];
      h.conv.sessionData.productFocus={productId:product.id,name};
      await h.send('Para cuantas personas alcanza?');
      await h.send('De acuerdo entonces dame dos');
      expect(h.cartRows()).toEqual([expect.objectContaining({id:product.id,qty:2,note:'sin cilantro'})]);
    });
  }
  it.each([true,false])('sin foco no inventa compra referencial agent=%s',async enabled=>{
    const h=harness(products,enabled);
    await h.send('De acuerdo entonces dame dos');
    expect(h.cartRows()).toEqual([]);
    expect(h.conv.state).not.toBe('completed');
  });
  it.each([true,false])('oferta múltiple no elige un producto por su cuenta agent=%s',async enabled=>{
    const h=harness(products,enabled);
    h.conv.sessionData.pendingAddOffer={productId:17,name:'Churrasco',code:17,price:38000,quantity:1,productIds:[17,23]};
    await h.send('De acuerdo entonces dame dos');
    expect(h.cartRows()).toEqual([]);
  });
  it('no reescribe un maduro que sí existe en otra carta',()=>{
    const catalog=new WhatsappCatalogService({} as never);
    const menu=[{...products[0],name:'Maduro Con Queso'}, {...products[0],id:33001,name:'Platano Con Queso'}];
    expect(catalog.resolveCatalogAliasText('Tienes maduro con queso',menu)).toBe('Tienes maduro con queso');
    expect(catalog.resolveCatalogAliasText('Tienes maduro con chocolate',products)).toBe('Tienes maduro con chocolate');
  });
});


describe('Corrección de bebida — no deshacer sin evidencia única',()=>{
 it.each([true,false].flatMap(agent=>['sin historial','carrito cambiado','dos combos'].map(kind=>({agent,kind}))))('$kind agent=$agent',async({agent,kind})=>{
  const h=harness(products,agent);
  const combo={productId:97,name:'Combo Arroz Chino Con Medio Pollo',code:97,unitPrice:50000,quantity:1,attributes:[{attributeName:'Bebida',attributeValue:'Colombiana'},{attributeName:'Pollo',attributeValue:'Broaster'}]};
  const before=[combo];
  if(kind==='dos combos')before.push({...combo,productId:98,name:'Combo De Pollo Broaster',code:98});
  h.conv.sessionData.cart=[...before,{productId:34,name:'Gaseosa Coca Cola 400ml',code:34,unitPrice:4500,quantity:1,attributes:[{attributeName:'Sabor',attributeValue:'Coca Cola'}]}];
  if(kind!=='sin historial')h.conv.sessionData.lastDrinkAddition={productId:34,beforeCart:structuredClone(before),cartSignature:kind==='carrito cambiado'?'old signature':JSON.stringify(h.conv.sessionData.cart)};
  const original=structuredClone(h.conv.sessionData);
  const reply=await h.sendQueued('Pero me refiero a la gaseosa del combo');
  expect(h.conv.sessionData).toEqual(original);
  expect(reply||'').toMatch(/aclar|qué sabor|cu[aá]l combo/i);
 });
});


describe('Fila inválida u otra lista — no consume dirección ni quita plato',()=>{
 it.each([true,false].flatMap(agent=>['Quita la 0','Quita la 99','otra lista'].map(text=>({agent,text}))))('$text agent=$agent',async({agent,text})=>{
  const h=harness(products,agent);h.conv.state='awaiting_address';h.conv.sessionData.address='Conjunto Prueba';
  h.conv.sessionData.cart=[{productId:97,name:'Combo Arroz Chino Con Medio Pollo',code:97,unitPrice:50000,quantity:1,attributes:[]}];
  if(text==='otra lista')h.conv.sessionData.pendingAttribute={productId:28,name:'Gaseosa 400ml',code:28,price:4000,attributes:[{attributeName:'Sabor',options:['Colombiana','Pepsi']}],selected:[],quantity:2};
  const before=structuredClone(h.conv.sessionData);
  const reply=await h.sendQueued(text==='otra lista'?'Quita la 1':text);
  expect(h.conv.sessionData).toEqual(before);expect(h.conv.state).toBe('awaiting_address');
  expect(reply||'').toMatch(/no existe|otra lista/i);
 });
});


describe('Reparto entre destinatarios conserva el pedido completo',()=>{
 it.each([
  {kind:'vegetal',menu:JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-alternate-menu.json'),'utf8')),soup:505,other:501,text:'Para Camila y Diego, una sopa de zapallo para cada uno. A la de Diego no le pongan cilantro; la de Camila normal. Además un bowl andino.'},
  {kind:'otra carta',menu:[{id:88001,code:88001,name:'Crema De Calabaza',price:8000,availableNow:true,hasAttributes:false,attributes:[]},{id:88002,code:88002,name:'Ensalada Campestre',price:13000,availableNow:true,hasAttributes:false,attributes:[]}],soup:88001,other:88002,text:'Para Laura y Pablo, una crema de calabaza para cada uno. A la de Pablo no le pongan cilantro; la de Laura normal. Además una ensalada campestre.'}
 ])('$kind no inventa dirección ni rechaza el último plato',async({menu,soup,other,text})=>{
  const h=harness(menu,true);h.conv.sessionData.orderType='delivery';h.service.ordersService.create=jest.fn();
  h.service.agentService=new WhatsappAgentService({getEffectiveConfig:async()=>({openaiApiKey:'offline-key',openaiModel:'gpt-4.1-2025-04-14',systemPrompt:'',localContext:{}})} as never,h.service.catalogService);
  const response=(message:unknown)=>({ok:true,json:async()=>({choices:[{message}]})});
  const args=[{productId:soup,quantity:1},{productId:soup,quantity:1,note:'sin cilantro'},{productId:other,quantity:1}];
  const original=globalThis.fetch;const fetchMock=jest.fn().mockResolvedValueOnce(response({content:null,tool_calls:args.map((arg,index)=>({id:'recipient-'+index,type:'function',function:{name:'add_item',arguments:JSON.stringify(arg)}}))})).mockResolvedValueOnce(response({content:'Listo, una normal y otra sin cilantro, más el otro plato.'}));globalThis.fetch=fetchMock;
  try{
   const reply=await h.sendQueued(text);
   expect(h.conv.sessionData.address).toBeUndefined();
   expect(h.conv.customerName).toBe('Wilmer');
   const rows=h.cartRows();expect(rows).toHaveLength(3);
   expect(rows.filter(row=>row.id===soup).map(row=>row.qty)).toEqual([1,1]);
   expect(rows.filter(row=>row.id===soup&&/cilantro/i.test(row.note||''))).toHaveLength(1);
   expect(rows.find(row=>row.id===other)).toEqual(expect.objectContaining({qty:1}));
   expect(rows.find(row=>row.id===other)?.note||'').not.toMatch(/cilantro/i);
   expect(reply||'').not.toMatch(/no tenemos|no manejamos|Camila|Diego|Laura|Pablo/i);
   expect(h.service.ordersService.create).not.toHaveBeenCalled();
  }finally{globalThis.fetch=original;}
 });
});


describe('Tamaño de paquete conserva ambigüedades reales',()=>{
 it.each([
  {name:'Trio De Tacos Al Pastor',query:'Un trio de tacos',other:'Duo De Tacos Al Pastor'},
  {name:'Duo De Onigiris De Salmon',query:'Un duo de onigiris',other:'Trio De Onigiris De Salmon'},
 ])('$query aclara solo si hay dos SKUs del mismo tamaño',({name,query,other})=>{
  const item=(id:number,name:string)=>({id,code:id,name,price:20000,hasAttributes:false,attributes:[],availableNow:true});
  const menu=[item(91001,name),item(91002,name),item(91003,other),item(91004,'Agua Mineral')];
  const h=harness(menu,true);const result=h.service.catalogService.resolveMultiProductOrder(query+' y un agua mineral',menu);
  expect(result.ambiguous).toHaveLength(1);expect(result.ambiguous[0].candidates.map(p=>p.id)).toEqual([91001,91002]);
  expect(result.confident.map(p=>p.product.id)).toEqual([91004]);
 });
 it.each([
  {name:'Duo De Tacos Al Pastor',query:'Un duo de tacos',other:'Trio De Tacos Al Pastor'},
  {name:'Trio De Onigiris De Salmon',query:'Un trio de onigiris',other:'Duo De Onigiris De Salmon'},
 ])('$query resuelve un único tamaño de paquete',({name,query,other})=>{
  const item=(id:number,name:string)=>({id,code:id,name,price:20000,hasAttributes:false,attributes:[],availableNow:true});
  const menu=[item(91001,name),item(91002,other),item(91004,'Agua Mineral')];const h=harness(menu,true);
  const result=h.service.catalogService.resolveMultiProductOrder(query+' y un agua mineral',menu);expect(result.ambiguous).toHaveLength(0);expect(result.confident.map(p=>p.product.id)).toEqual([91001,91004]);
 });
});

describe('Herramientas de edición durante checkout — conservar opciones y cantidades',()=>{
 for(const name of ['Combo De Falafel','Caja De Onigiris'])for(const state of ['awaiting_payment','awaiting_name','awaiting_phone','awaiting_final_confirm'])for(const edit of ['attribute','quantity']){
  it(name+' '+state+' '+edit,async()=>{
   const menu=[{id:8951,code:8951,name,description:'Con acompañamiento y bebida',price:29000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Limonada','Te Frio']}]},{id:8952,code:8952,name:'Hummus Clasico',price:9000,availableNow:true,hasAttributes:false,attributes:[]}];
   const h=harness(menu,true);h.conv.state=state;h.conv.customerName=state==='awaiting_name'?'':'Ana';
   h.conv.sessionData={cart:[{productId:8951,name,code:8951,unitPrice:29000,quantity:2,note:'sin tomate',attributes:[{attributeName:'Bebida',attributeValue:'Te Frio'}]},{productId:8952,name:'Hummus Clasico',code:8952,unitPrice:9000,quantity:1,attributes:[]}],orderType:'delivery',address:'Calle 18 sur 70 25',addressConfirmed:true,phoneConfirmed:true};
   const before=structuredClone(h.conv.sessionData);
   const actions=edit==='attribute'?{updateAttributes:[{productId:8951,cartLineIndex:0,attributeName:'Bebida',attributeValue:'Limonada'}]}:{updateCartLines:[{productId:8951,cartLineIndex:0,quantity:1}]};
   h.agent.runTurn.mockResolvedValue({reply:'Listo, ajustado.',actions,toolCalls:['get_cart',edit==='attribute'?'set_attribute':'update_item']});
   const reply=await h.send(edit==='attribute'?'Cámbiame la bebida de los dos combos por limonada, no agregues otra bebida':`Deja solo un ${name}, el hummus queda igual`);
   if(edit==='attribute')expect(h.agent.runTurn).toHaveBeenCalled();expect(h.conv.state).toBe(state);expect(h.conv.sessionData.cart).toHaveLength(2);
   expect(h.conv.sessionData.cart[0].quantity).toBe(edit==='quantity'?1:2);expect(h.conv.sessionData.cart[0].attributes).toEqual([{attributeName:'Bebida',attributeValue:edit==='attribute'?'Limonada':'Te Frio'}]);
   expect(h.conv.sessionData.cart[0].note).toBe('sin tomate');expect(h.conv.sessionData.cart[1]).toEqual(before.cart[1]);expect(h.conv.sessionData.address).toBe(before.address);expect(h.conv.sessionData.paymentMethod).toBeUndefined();expect(reply).toContain(name);
  });
 }
});

describe('Referencias cortas de composición — foco, ambigüedad y el otro',()=>{
 const menus=[
  [{id:9801,code:9801,name:'Bowl De Lentejas',description:'Con arroz',price:21000,availableNow:true,hasAttributes:false,attributes:[]},{id:9802,code:9802,name:'Pasta De Hongos',description:'Sin salsa de ajo',price:23000,availableNow:true,hasAttributes:false,attributes:[]}],
  [{id:9811,code:9811,name:'Caja De Dumplings',description:'Con ensalada',price:21000,availableNow:true,hasAttributes:false,attributes:[]},{id:9812,code:9812,name:'Pack De Onigiris',description:'Sin salsa de ajo',price:23000,availableNow:true,hasAttributes:false,attributes:[]}],
 ];
 function seed(menu:any[],agent:boolean,state='awaiting_payment',focus?:number){
  const h=harness(menu,agent);h.conv.state=state;h.conv.customerName='Ana';h.conv.sessionData={cart:menu.map(p=>({productId:p.id,name:p.name,code:p.code,unitPrice:p.price,quantity:1,note:'bolsa aparte',attributes:[]})),orderType:'delivery',address:'Calle 12 30 45',addressConfirmed:true,...(focus?{productFocus:{productId:focus,name:menu.find(p=>p.id===focus).name}}:{})};return h;
 }
 for(const menu of menus)for(const agent of [false,true]){
  for(const state of ['building_cart','awaiting_payment'])for(const text of ['Y ese trae salsa de ajo?','Ese incluye queso?']){
   it(menu[0].name+' '+state+' '+text+' agent='+agent,async()=>{
    const h=seed(menu,agent,state,menu[0].id);const before=structuredClone(h.conv.sessionData.cart);const reply=await h.send(text);
    expect(reply).toContain(menu[0].name);expect(reply).not.toContain(menu[1].name);expect(reply).toMatch(/no tengo ese detalle confirmado/i);expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.state).toBe(state);
   });
  }
  it(menu[0].name+' aclara y conserva consulta al elegir nombre agent='+agent,async()=>{
   const h=seed(menu,agent);const before=structuredClone(h.conv.sessionData.cart);const reply=await h.send('Y ese trae salsa de ajo?');
   expect(reply).toMatch(/de qu[eé] plato/i);expect(h.conv.sessionData.pendingCompositionAsk?.originalText).toContain('salsa');
   const answer=await h.send(menu[1].name);expect(answer).toContain(menu[1].name);expect(answer).toContain('Sin salsa de ajo');expect(answer).not.toMatch(/no tengo ese detalle confirmado/i);expect(h.conv.state).toBe('awaiting_payment');expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingCompositionAsk).toBeUndefined();
  });
  it(menu[0].name+' el otro se refiere al único distinto del foco agent='+agent,async()=>{
   const h=seed(menu,agent,'awaiting_payment',menu[0].id);const before=structuredClone(h.conv.sessionData.cart);const reply=await h.send('Y el otro trae salsa de ajo?');
   expect(reply).toContain(menu[1].name);expect(reply).toContain('Sin salsa de ajo');expect(reply).not.toContain(menu[0].name);expect(h.conv.state).toBe('awaiting_payment');expect(h.conv.sessionData.cart).toEqual(before);
  });
 }
 it.each([false,true])('el otro sin foco no adivina agent=%s',async agent=>{
  const h=seed(menus[0],agent);const reply=await h.send('Y el otro trae salsa de ajo?');expect(reply).toMatch(/de qu[eé] plato/i);expect(h.cartRows()).toHaveLength(2);expect(h.conv.state).toBe('awaiting_payment');
 });
});

describe('Listas sucesivas — nueva aclaración sustituye reemplazo sin aplicarlo', () => {
  for (const f of [
    { id: 21001, old: 'Pizza De Setas', next: 'Pizza Margarita', side: 'Bowl De Tofu', attr: 'Salsa', first: 'Soja', last: 'Teriyaki' },
    { id: 21011, old: 'Ramen De Miso', next: 'Ramen De Shoyu', side: 'Combo De Falafel', attr: 'Bebida', first: 'Te', last: 'Agua' },
  ]) for (const agent of [false, true]) for (const state of ['awaiting_address', 'awaiting_payment']) {
    for (const kind of ['cantidad', 'atributo', 'eliminación']) {
      it(`${f.old}, agente ${agent}, ${state}, segunda lista ${kind}`, async () => {
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
        const before = structuredClone(h.conv.sessionData.cart);
        await h.sendQueued(`Cambia ${f.old} por ${f.next}`);
        expect(h.conv.sessionData.pendingCartReplacement?.options).toHaveLength(2);
        await h.sendQueued(kind === 'cantidad' ? `Deja solo dos ${f.side}` : kind === 'atributo' ? `Cambia ${f.attr} a ${f.last}` : `Quita el ${f.side}`);
        expect(h.conv.sessionData.cart).toEqual(before);
        const clarification = h.replies.at(-1) || '';
        expect(h.conv.sessionData[kind === 'cantidad' ? 'pendingCartQuantity' : kind === 'atributo' ? 'pendingCartAttributeEdit' : 'pendingCartRemoval']).toBeTruthy();
        await h.sendQueued('2');
        expect(h.conv.sessionData.cart.slice(0, 2)).toEqual(before.slice(0, 2));
        expect(h.conv.sessionData.cart[2]).toEqual(before[2]);
        if (kind === 'atributo') expect(h.replies.at(-1)).toContain(f.last);
        expect(h.conv.sessionData.pendingCartReplacement).toBeUndefined();
        expect(clarification).toMatch(/reemplazo anterior.*sin aplicar/is);
        if (kind === 'eliminación') expect(h.conv.sessionData.cart).toHaveLength(3);
        else {
          expect(h.conv.sessionData.cart).toHaveLength(4);
          expect(h.conv.sessionData.cart[3]).toEqual(kind === 'cantidad' ? { ...before[3], quantity: 2 }
            : { ...before[3], attributes: [{ attributeName: f.attr, attributeValue: f.last }] });
        }
        expect(h.conv.sessionData.paymentMethod).toBeUndefined();
        expect(h.conv.state).toBe(state);
        expect(h.replies.at(-1)).toMatch(state === 'awaiting_address' ? /dirección/i : /pagas|pago/i);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
      });
    }
  }
});

describe('Catálogo sin conflicto — un número conserva su función', () => {
  for (const f of [
    { id: 21301, soup: 'Sopa De Calabaza', combo: 'Combo De Pizza', a: 'Pizza Personal', b: 'Pizza Mediana' },
    { id: 21311, soup: 'Sopa De Lentejas', combo: 'Combo De Bowl', a: 'Bowl Personal', b: 'Bowl Grande' },
  ]) for (const agent of [false, true]) for (const state of ['awaiting_address', 'awaiting_payment']) for (const mode of ['precio', 'variante']) {
    it(`${f.combo}, agente ${agent}, ${state}, solo lista ${mode}`, async () => {
      const menu = [f.soup, f.combo, f.a, f.b].map((name, index) => ({ id: f.id + index, code: f.id + index, name,
        price: 10000 + index * 3000, availableNow: true, hasAttributes: false, attributes: [] }));
      const h = harness(menu, agent);
      h.conv.state = state;
      h.service.ordersService.create = jest.fn();
      Object.assign(h.conv.sessionData, { orderType: 'delivery', address: state === 'awaiting_payment' ? 'Calle 12 30 45' : undefined,
        addressConfirmed: state === 'awaiting_payment', deliveryFeeCalculated: state === 'awaiting_payment' ? 3000 : null,
        phoneConfirmed: true, contactPhone: h.conv.phoneE164,
        cart: menu.slice(0, 2).map(p => ({ productId: p.id, code: p.code, name: p.name, unitPrice: p.price, quantity: 1, note: 'sin sal', attributes: [] })) });
      const before = structuredClone(h.conv.sessionData.cart);
      await h.sendQueued(mode === 'precio' ? 'Qué precio tiene?' : 'Lo quiero solo');
      const chosenId = mode === 'precio' ? h.conv.sessionData.pendingPriceInquiry?.productIds[1] : h.conv.sessionData.pendingMatch?.candidates[1]?.id;
      expect(chosenId).toBeTruthy();
      await h.sendQueued('2');
      if (mode === 'precio') {
        expect(h.conv.sessionData.cart).toEqual(before);
        expect(h.replies.at(-1)).toContain(menu.find(p => p.id === chosenId)!.name);
      } else {
        expect(h.conv.sessionData.cart[0]).toEqual(before[0]);
        expect(h.conv.sessionData.cart[1]).toMatchObject({ productId: chosenId, quantity: 1, note: 'sin sal' });
      }
      expect(h.conv.sessionData.paymentMethod).toBeUndefined();
      expect(h.replies.at(-1)).not.toMatch(/varias listas pendientes/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
  }
});


describe('catalog prefix families across fictional restaurants', () => {
  for (const family of ['Pizza', 'Bowl', 'Crepe', 'Ramen']) {
    for (const enabled of [true, false]) {
      const menu = [
        { id: 24101, code: 24101, name: 'Sopa De Calabaza', price: 10000, availableNow: true, hasAttributes: false, attributes: [] },
        ...['Personal', 'Mediana'].map((size, i) => ({ id: 24102+i, code: 24102+i, name: `${family} ${size}`, price: 16000+i*3000, availableNow: true, hasAttributes: false, attributes: [] })),
      ];
      for (const action of ['price', 'purchase']) {
        it(`${family} ${action} interrupts a pending replacement safely, agent ${enabled}`, async () => {
          const expandedMenu = [...menu, { ...menu[0], id: 24104, code: 24104, name: 'Sopa De Hongos', price: 13000 }];
          const h = harness(expandedMenu, enabled);
          h.conv.state = 'awaiting_payment';
          Object.assign(h.conv.sessionData, {
            orderType: 'delivery', address: 'Calle 12 30 45', addressConfirmed: true,
            phoneConfirmed: true, contactPhone: h.conv.phoneE164, deliveryFeeCalculated: 3000,
            cart: ['sin cebolla', 'sin sal'].map(note => ({ productId: 24101, code: 24101, name: menu[0].name, unitPrice: 10000, quantity: 2, note, attributes: [] })),
          });
          await h.sendQueued('Cambia Sopa De Calabaza por Sopa De Hongos');
          expect(h.conv.sessionData.pendingCartReplacement).toBeDefined();
          const before = structuredClone(h.conv.sessionData.cart);
          const offset = h.replies.length;
          await h.sendQueued(action === 'price' ? `Cuánto vale una ${family.toLowerCase()}?` : `Quiero una ${family.toLowerCase()}`);
          expect(h.replies.slice(offset).join(' ')).toContain(`${family} Personal`);
          expect(h.replies.slice(offset).join(' ')).toContain(`${family} Mediana`);
          expect(h.conv.sessionData.cart).toEqual(before);
          if (action === 'purchase') {
            await h.sendQueued('2');
            expect(h.conv.sessionData.cart).toEqual(before);
            expect(h.replies.at(-1)).toMatch(/nombre completo/);
            await h.sendQueued(`${family} Mediana`);
            expect(h.cartRows()).toEqual([
              expect.objectContaining({ id: 24101, qty: 2 }),
              expect.objectContaining({ id: 24101, qty: 2 }),
              expect.objectContaining({ id: 24103, qty: 1 }),
            ]);
            expect(h.conv.state).toBe('awaiting_payment');
          }
        });
      }
      it(`${family} order preserves three units and resolves selection, agent ${enabled}`, async () => {
        const h = harness(menu, enabled);
        await h.sendQueued(`Quiero tres ${family.toLowerCase()}`);
        expect(h.conv.sessionData.cart).toEqual([]);
        expect(h.replies.join(' ')).toContain(`${family} Personal`);
        expect(h.replies.join(' ')).toContain(`${family} Mediana`);
        expect(h.replies.join(' ')).not.toMatch(/no manejamos/i);
        await h.sendQueued('2');
        expect(h.cartRows()).toEqual([expect.objectContaining({ id: 24103, qty: 3 })]);
      });
      it(`${family} singular order opens presentations, agent ${enabled}`, async () => {
        const h = harness(menu, enabled);
        await h.sendQueued(`Quiero una ${family.toLowerCase()}`);
        expect(h.conv.sessionData.cart).toEqual([]);
        expect(h.replies.join(' ')).toContain(`${family} Personal`);
        expect(h.replies.join(' ')).toContain(`${family} Mediana`);
        await h.sendQueued('2');
        expect(h.cartRows()).toEqual([expect.objectContaining({ id: 24103, qty: 1 })]);
      });
      it(`${family} empty cart price remains a consultation, agent ${enabled}`, async () => {
        const h = harness(menu, enabled);
        await h.sendQueued(`Cuánto vale una ${family.toLowerCase()}?`);
        expect(h.replies.join(' ')).toMatch(new RegExp(`${family} Personal.*16[.,]000`, 's'));
        expect(h.replies.join(' ')).toMatch(new RegExp(`${family} Mediana.*19[.,]000`, 's'));
        expect(h.conv.sessionData.cart).toEqual([]);
      });
      it(`${family} checkout purchase resolves family and resumes payment, agent ${enabled}`, async () => {
        const h = harness(menu, enabled);
        h.conv.state = 'awaiting_payment';
        Object.assign(h.conv.sessionData, {
          orderType: 'delivery', address: 'Calle 12 30 45', addressConfirmed: true,
          phoneConfirmed: true, contactPhone: h.conv.phoneE164, deliveryFeeCalculated: 3000,
          cart: [{ productId: 24101, code: 24101, name: menu[0].name, unitPrice: 10000, quantity: 2, attributes: [] }],
        });
        await h.sendQueued(`Quiero una ${family.toLowerCase()}`);
        expect(h.cartRows()).toEqual([expect.objectContaining({ id: 24101, qty: 2 })]);
        expect(h.replies.join(' ')).toContain(`${family} Mediana`);
        await h.sendQueued(`${family} Mediana`);
        expect(h.cartRows()).toEqual([
          expect.objectContaining({ id: 24101, qty: 2 }),
          expect.objectContaining({ id: 24103, qty: 1 }),
        ]);
        expect(h.conv.state).toBe('awaiting_payment');
      });
      it(`${family} exact SKU and deictic price keep their scope, agent ${enabled}`, async () => {
        const h = harness(menu, enabled);
        await h.sendQueued(`Quiero una ${family} Mediana`);
        expect(h.cartRows()).toEqual([expect.objectContaining({ id: 24103, qty: 1 })]);
        await h.sendQueued('Cuánto vale?');
        expect(h.replies.at(-1)).toMatch(/19[.,]000/);
        expect(h.cartRows()).toEqual([expect.objectContaining({ id: 24103, qty: 1 })]);
      });
      it(`${family} explicit price subject overrides soup cart, agent ${enabled}`, async () => {
        const h = harness(menu, enabled);
        h.conv.state = 'awaiting_payment';
        Object.assign(h.conv.sessionData, {
          orderType: 'delivery', address: 'Calle 12 30 45', addressConfirmed: true,
          phoneConfirmed: true, contactPhone: h.conv.phoneE164, deliveryFeeCalculated: 3000,
          cart: [{ productId: 24101, code: 24101, name: menu[0].name, unitPrice: 10000, quantity: 2, attributes: [] }],
        });
        const before = structuredClone(h.conv.sessionData.cart);
        await h.sendQueued(`Cuánto vale una ${family.toLowerCase()}?`);
        const answer = h.replies.join(' ');
        expect(answer).toMatch(new RegExp(`${family} Personal.*16[.,]000`, 's'));
        expect(answer).toMatch(new RegExp(`${family} Mediana.*19[.,]000`, 's'));
        expect(h.conv.sessionData.cart).toEqual(before);
        expect(h.conv.state).toBe('awaiting_payment');
      });
    }
  }
});

describe('catalog attribute flavor is available before base selection', () => {
  for (const [root, bases, attribute, flavor, followup] of [
    ['Jugo Natural',['En Agua','En Leche'],'Sabor','Guanabana','Dame uno de guanabana en leche'],
    ['Helado',['En Vaso','En Copa'],'Sabor','Chocolate','Dame un helado en copa de chocolate'],
    ['Infusion',['Fria','Caliente'],'Sabor','Jazmin','Dame una infusion caliente de jazmin'],
  ] as const) {
    for (const enabled of [true,false]) {
      const menu=bases.map((base,index)=>({id:28101+index,code:28101+index,name:`${root} ${base}`,price:5000+index*1500,availableNow:true,hasAttributes:true,attributes:[{attributeName:attribute,options:[flavor,'Mango']}]}));
      it(`${root} with ${flavor}, agent ${enabled}`,async()=>{
        const h=harness(menu,enabled);
        await h.sendQueued(`Agregas un ${root.toLowerCase()} de ${flavor.toLowerCase()}`);
        expect(h.conv.sessionData.cart).toEqual([]);
        expect(h.replies.join(' ')).toContain(`${root} ${bases[0]}`);expect(h.replies.join(' ')).toContain(`${root} ${bases[1]}`);
        expect(h.replies.join(' ')).not.toMatch(/no tenemos|no manejamos/i);
        await h.sendQueued(followup);
        expect(h.cartRows()).toEqual([expect.objectContaining({id:28102,qty:1,attrs:[`${attribute}:${flavor}`]})]);
      });
      it(`${root} with base already named, agent ${enabled}`,async()=>{
        const h=harness(menu,enabled);
        await h.sendQueued(`Dame un ${root.toLowerCase()} ${bases[1].toLowerCase()} de ${flavor.toLowerCase()}`);
        expect(h.cartRows()).toEqual([expect.objectContaining({id:28102,qty:1,attrs:[`${attribute}:${flavor}`]})]);
        expect(h.replies.join(' ')).not.toContain(`${root} ${bases[0]}`);
      });
      it(`${root} with a flavor outside the menu, agent ${enabled}`,async()=>{
        const h=harness(menu,enabled);
        await h.sendQueued(`Agregas un ${root.toLowerCase()} de maracuya`);
        expect(h.conv.sessionData.cart).toEqual([]);
        expect(h.replies.join(' ')).not.toMatch(/maracuya\*?, ¿en cu[aá]l/i);
      });
    }
  }
  for (const enabled of [true,false]) {
    it(`PPP natural juice flavor before base, agent ${enabled}`,async()=>{
      const h=harness(products,enabled);
      await h.sendQueued('Agregas un jugo natural de guanabana');
      expect(h.conv.sessionData.cart).toEqual([]);
      expect(h.replies.join(' ')).toContain('Jugo Natural En Agua');expect(h.replies.join(' ')).toContain('Jugo Natural En Leche');
      expect(h.replies.join(' ')).not.toMatch(/no tenemos|no manejamos/i);
      await h.sendQueued('En leche');
      expect(h.cartRows()).toEqual([expect.objectContaining({id:51,qty:1,attrs:['Sabor:Guanabana']})]);
    });
  }
});

describe('an unpicked list is recalled before the final summary', () => {
  const fictional = [
    { id: 31601, code: 31601, name: 'Arepa Rellena', price: 9000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 31602, code: 31602, name: 'Batido De Fresa', price: 6000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 31603, code: 31603, name: 'Batido De Mango', price: 6000, availableNow: true, hasAttributes: false, attributes: [] },
  ];
  const cases = [
    { label: 'PPP', menu: products, dish: 35, list: [50, 51] },
    { label: 'fictional', menu: fictional, dish: 31601, list: [31602, 31603] },
  ];
  const ready = (menu: any[], dish: number, list: number[], enabled: boolean) => {
    const h = harness(menu as any, enabled);
    h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 999, orderNumber: 'X1' });
    const product = menu.find((p: any) => p.id === dish);
    h.conv.sessionData.cart = [{ productId: dish, code: dish, name: product.name, unitPrice: product.price, quantity: 1, attributes: [] }] as any;
    Object.assign(h.conv.sessionData, { orderType: 'delivery', fulfillmentChosen: true, address: 'Calle 9 20 30', addressConfirmed: true,
      phoneConfirmed: true, contactPhone: h.conv.phoneE164, paymentMethod: 'contraentrega', notesCollected: true, deliveryFeeCalculated: 2000,
      pendingMatch: { query: 'jugo', intent: 'order', candidates: menu.filter((p: any) => list.includes(p.id)) } });
    h.conv.customerName = 'Yordan silva';
    h.conv.state = 'building_cart';
    return h;
  };
  const names = (menu: any[], list: number[]) => list.map((id) => menu.find((p: any) => p.id === id).name);
  for (const enabled of [false, true]) {
    for (const c of cases) {
      it(`${c.label}: the summary lists the unpicked options and "confirmar" still confirms, agent ${enabled}`, async () => {
        const h = ready(c.menu as any, c.dish, c.list, enabled);
        await h.sendQueued('eso es todo');
        expect(h.conv.state).toBe('awaiting_final_confirm');
        expect(h.replies.at(-1)).toMatch(/Quedó sin elegir/);
        for (const name of names(c.menu as any, c.list)) expect(h.replies.at(-1)).toContain(name);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
        await h.sendQueued('confirmar');
        expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      });
      it(`${c.label}: a bare "si" asks which option instead of confirming, agent ${enabled}`, async () => {
        const h = ready(c.menu as any, c.dish, c.list, enabled);
        await h.sendQueued('eso es todo');
        await h.sendQueued('si');
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
        expect(h.replies.at(-1)).toMatch(/¿Cuál agrego\?/);
      });
      it(`${c.label}: "lo dejamos" drops the list and the next yes confirms, agent ${enabled}`, async () => {
        const h = ready(c.menu as any, c.dish, c.list, enabled);
        await h.sendQueued('eso es todo');
        await h.sendQueued('lo dejamos');
        expect(h.replies.at(-1)).toMatch(/Si está bien, escribe \*confirmar\*/);
        expect(h.cartRows().map((row) => row.id)).toEqual([c.dish]);
        await h.sendQueued('si');
        expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      });
      it(`${c.label}: a flavor shared by several options asks which one, agent ${enabled}`, async () => {
        if (c.label !== 'PPP') return;
        const h = ready(c.menu as any, c.dish, c.list, enabled);
        await h.sendQueued('eso es todo');
        await h.sendQueued('el de mango');
        expect(h.replies.at(-1)).toMatch(/¿En cuál\?/);
        expect(h.cartRows().map((row) => row.id)).toEqual([c.dish]);
      });
      it(`${c.label}: declining the list before closing leaves no reminder, agent ${enabled}`, async () => {
        const h = ready(c.menu as any, c.dish, c.list, enabled);
        await h.sendQueued('no gracias');
        await h.sendQueued('eso es todo');
        expect(h.replies.join('\n')).not.toMatch(/Quedó sin elegir/);
      });
    }
    it(`fictional: "2" adds that option and shows the summary again, agent ${enabled}`, async () => {
      const h = ready(fictional as any, 31601, [31602, 31603], enabled);
      await h.sendQueued('eso es todo');
      await h.sendQueued('2');
      expect(h.cartRows().map((row) => row.id)).toEqual([31601, 31603]);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      expect(h.replies.at(-1)).toMatch(/Si está bien, escribe \*confirmar\*/);
    });
    it(`fictional: a named option adds it, agent ${enabled}`, async () => {
      const h = ready(fictional as any, 31601, [31602, 31603], enabled);
      await h.sendQueued('eso es todo');
      await h.sendQueued('el de fresa');
      expect(h.cartRows().map((row) => row.id)).toEqual([31601, 31602]);
    });
    it(`PPP: "1" asks the juice flavor and the answer joins the order, agent ${enabled}`, async () => {
      const h = ready(products as any, 35, [50, 51], enabled);
      await h.sendQueued('eso es todo');
      await h.sendQueued('1');
      expect(h.conv.sessionData.pendingAttribute?.productId).toBe(50);
      await h.sendQueued('lulo');
      expect(h.cartRows()).toEqual(expect.arrayContaining([expect.objectContaining({ id: 50, attrs: ['Sabor:Lulo'] })]));
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
  }
});

describe('Basic greeting with menu request preserves the pending step',()=>{
 const menus=[products,[{id:62201,code:62201,name:'Menu Ejecutivo Vegetal',price:21000,availableNow:true,hasAttributes:false,attributes:[]}]];
 for(const menu of menus)for(const agent of [false,true])for(const state of ['building_cart','awaiting_name','awaiting_final_confirm'])for(const text of [
  'Hola buenas tardes tienes la carta por favor','Buenas tardes, me puedes pasar la carta por favor?',
  'Hola me regalas el menú completo por favor','Buenas noches vecino me compartes la carta gracias']){
  it(menu[0].name+' '+state+' '+text+' agent='+agent,async()=>{
   const h=harness(menu,agent);h.cfg.menuUrl='https://example.test/menu';h.conv.state=state;h.service.ordersService.create=jest.fn();
   const product=menu[0];Object.assign(h.conv.sessionData,{cart:[{productId:product.id,code:product.code,name:product.name,unitPrice:product.price,quantity:2,attributes:[],note:'bien empacado'}],orderType:'delivery',fulfillmentChosen:true,address:'Calle 12 34 56',addressConfirmed:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,paymentMethod:'contraentrega',notesCollected:true,deliveryFeeCalculated:2000});
   const before=structuredClone(h.conv.sessionData);const customerName=h.conv.customerName;
   await h.sendQueued(text);expect(h.replies.join(' ')).toContain('https://example.test/menu');expect(h.replies.join(' ')).not.toMatch(/no tenemos|no manejamos|productos de carta|no entend/i);
   expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBe(customerName);expect(h.conv.state).toBe(state);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
 }
});

describe('Compound approval keeps questions and quotes outside authorization',()=>{
 const families=[{name:'Bao De Hongos',attr:'Salsa',value:'Teriyaki'},{name:'Ensalada De Quinoa',attr:'Aderezo',value:'Limon'}];
 const cases:[string,boolean][]=[
  ['¿Confirmo el pedido? ¿Cuánto tarda?',false],['Confirmar el pedido? Cuanto tarda?',false],
  ['Me dijiste "confirmar". ¿Cuánto tarda?',false],['¿Puedo confirmar el pedido? ¿En cuánto llega?',false],
  ['Si yo lo confirmo, ¿cuánto demora?',false],['No lo confirmo todavía. ¿Cuánto tarda?',false],
  ['Si digo «confirmar», ¿cuánto tarda?',false],['¿Cuánto tarda? Estoy preguntando, no confirmando.',false],
  ['Lo confirmo. ¿Cuánto tarda?',true],['¿Cuánto tarda? Lo confirmo.',true],
  ['Confirmo el pedido, ¿cuánto tarda?',true],['Sí, confirmo el pedido. ¿En cuánto llega?',true],
 ];
 for(const f of families)for(const agent of [false,true])for(const [text,approval] of cases){
  it(f.name+' '+text+' agent='+agent,async()=>{
   const menu=[{id:62601,code:62601,name:f.name,price:18000,availableNow:true,hasAttributes:true,attributes:[{attributeName:f.attr,options:[f.value]}]},
    {id:62602,code:62602,name:'Agua Mineral',price:4000,availableNow:true,hasAttributes:false,attributes:[]}];
   const h=harness(menu,agent);h.conv.state='awaiting_final_confirm';h.service.ordersService.create=jest.fn().mockResolvedValue({id:6260,dailyOrderNumber:66});
   Object.assign(h.conv.sessionData,{cart:menu.map((p,i)=>({productId:p.id,code:p.code,name:p.name,unitPrice:p.price,quantity:i?1:2,attributes:i?[]:[{attributeName:f.attr,attributeValue:f.value}],note:i?'fria':'bien empacado'})),orderType:'delivery',fulfillmentChosen:true,address:'Calle 12 34 56',addressConfirmed:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,paymentMethod:'contraentrega',notesCollected:true,deliveryFeeCalculated:2000});
   const before=structuredClone(h.conv.sessionData);await h.sendQueued(text);expect(h.replies.join(' ')).toMatch(/suele demorar/i);
   expect(h.service.ordersService.create).toHaveBeenCalledTimes(approval?1:0);expect(h.conv.state).toBe(approval?'completed':'awaiting_final_confirm');
   if(!approval){expect(h.conv.sessionData).toEqual(before);await h.sendQueued('Confirmar');}
   expect(h.conv.state).toBe('completed');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
   expect(h.service.ordersService.create.mock.calls[0][0].items).toEqual(expect.arrayContaining([expect.objectContaining({productId:62601,note:'bien empacado',attributes:[{attributeName:f.attr,attributeValue:f.value}]}),expect.objectContaining({productId:62602,note:'fria'})]));expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(3);expect(h.service.ordersService.create.mock.calls[0][0].items.filter((item:any)=>item.productId===62601)).toHaveLength(2);
   await h.sendQueued('Gracias señor');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.conv.state).toBe('completed');
  });
 }
});

describe('Missing purchase offers respect ownership availability and quantity bounds',()=>{
 for(const kind of ['offer','category'])for(const agent of [false,true])it(kind+' agent='+agent,async()=>{
  const h=harness(products,agent);const p=products.find((p:any)=>p.id===22);
  if(kind==='offer')h.conv.sessionData.pendingAddOffer={productId:p.id,code:p.code,name:p.name,price:p.price,quantity:1};else h.conv.sessionData.pendingCategoryBrowse={categories:['Pollo','Sopas']};
  const before=structuredClone(h.conv.sessionData);const reply=await h.sendQueued('Quiero tres carnes a la plancha');expect(h.conv.sessionData).toEqual(before);expect(reply).toMatch(/No encontré/);expect((reply||'').split('Conservo')[0]).not.toMatch(/\n1\./);
 });
 it('never suggests an unavailable alternative',async()=>{
  const menu=products.map((p:any)=>p.name==='Churrasco'?{...p,availableNow:false}:p);const h=harness(menu,false);const reply=await h.sendQueued('Quiero tres carnes a la plancha');expect(reply).toMatch(/Sobrebarriga/);expect(reply).not.toMatch(/Churrasco/);expect(h.conv.sessionData.cart).toEqual([]);
 });
 for(const amount of [0,99])it('does not clamp requested units '+amount,async()=>{
  const h=harness(products,false);const before=structuredClone(h.conv.sessionData);const reply=await h.sendQueued(`Quiero ${amount} carnes a la plancha`);expect(h.conv.sessionData).toEqual(before);expect(reply).toMatch(/cantidad entre 1 y 30/);
 });
});

describe('Cross-restaurant intensity requests stay with their named product',()=>{
 const fixtures=[{name:'Flan Artesanal',note:'no tan dulce'},{name:'Café de la Casa',note:'que no venga tan dulce'},{name:'Ramen Vegetal',note:'que no esté tan salado'},{name:'Curry de Garbanzos',note:'no tan picante'},{name:'Limonada de Hierbabuena',note:'que no esté tan ácida'},{name:'Tostada Campesina',note:'que no venga tan grasosa'}];
 for(const f of fixtures)for(const enabled of [false,true])it(`${f.name} agent=${enabled}`,async()=>{
  const product={id:65501,code:65501,name:f.name,price:12000,availableNow:true,hasAttributes:false,attributes:[]};const h=harness([product],enabled);
  Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,address:'Calle 12 34 56',addressConfirmed:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,deliveryFeeCalculated:2000});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:6550,dailyOrderNumber:85});
  if(enabled)h.agent.runTurn.mockImplementationOnce(async input=>{
   const service=new WhatsappAgentService({} as never,h.service.catalogService) as any;const actions:any={};
   const result=JSON.parse(service.executeTool('add_item',{productId:product.id,quantity:2},{actions,cart:input.cart,products:[product],byId:new Map([[product.id,product]]),userMessage:input.userMessage,setNeedsAttr:()=>{}}));
   expect(result.ok).toBe(true);return {reply:'Listo',actions,toolCalls:['add_item'],purchaseAttempts:[{productId:product.id,accepted:true}]};
  });
  const reply=await h.sendQueued(`Quiero dos ${f.name} ${f.note} por favor`);
  expect(reply).not.toMatch(/no (?:manejamos|tenemos)|no pude añadir/i);expect(h.conv.sessionData.cart).toHaveLength(1);expect(h.conv.sessionData.cart[0]).toMatchObject({productId:product.id,quantity:2});
  const note=h.conv.sessionData.cart[0].note;expect(note).toContain(f.note);expect(reply).toContain(f.note);
  const cart=JSON.parse(JSON.stringify(h.conv.sessionData.cart));const state=h.conv.state;const priceReply=await h.sendQueued(`Cuánto cuesta ${f.name}`);expect(priceReply).toContain("12.000");expect(h.conv.sessionData.cart).toEqual(cart);expect(h.conv.state).toBe(state);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(h.conv.state==='building_cart')await h.sendQueued('Nada más');if(h.conv.state==='awaiting_payment')await h.sendQueued('1');await h.sendQueued('Confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);const items=h.service.ordersService.create.mock.calls[0][0].items;expect(items).toHaveLength(2);expect(items.every((item:any)=>item.productId===product.id&&item.note===note)).toBe(true);
 });
});

describe('Qualified canonical options in full purchase sentences retain their catalogue choice',()=>{
 for(const f of [{name:'Curry de Garbanzos',value:'No Tan Picante'},{name:'Flan Artesanal',value:'No Tan Dulce'},{name:'Ramen Vegetal',value:'No Tan Salado'}])for(const enabled of [false,true])it(`${f.name} agent=${enabled}`,async()=>{
  const product={id:65701,code:65701,name:f.name,price:18000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Estilo',options:['Natural',f.value]}]};const h=harness([product],enabled);
  Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,address:'Calle 12 34 56',addressConfirmed:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,deliveryFeeCalculated:2000});h.service.ordersService.create=jest.fn().mockResolvedValue({id:6570,dailyOrderNumber:87});
  const reply=await h.sendQueued(`Quiero dos ${f.name} con Estilo ${f.value} por favor`);expect(reply).not.toMatch(/no (?:manejamos|tenemos)/i);expect(h.conv.sessionData.cart).toHaveLength(1);const line=h.conv.sessionData.cart[0];expect(line.quantity).toBe(2);expect(line.attributes).toContainEqual({attributeName:'Estilo',attributeValue:f.value});
  const cart=JSON.parse(JSON.stringify(h.conv.sessionData.cart));const state=h.conv.state;await h.sendQueued(`Cuánto cuesta ${f.name}`);expect(h.conv.sessionData.cart).toEqual(cart);expect(h.conv.state).toBe(state);
  if(h.conv.state==='building_cart')await h.sendQueued('Nada más');if(h.conv.state==='awaiting_payment')await h.sendQueued('1');await h.sendQueued('Confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);const items=h.service.ordersService.create.mock.calls[0][0].items;expect(items).toHaveLength(2);expect(items.every((item:any)=>item.attributes.some((a:any)=>a.attributeValue===f.value))).toBe(true);
 });
});

describe('A requested separate box belongs to the combo before pickup checkout',()=>{
 for(const f of [{name:'Combo De Pollo Frito',part:'medio pollo'},{name:'Combo Vegetal',part:'la mitad'}])for(const enabled of [false,true])it(`${f.name} agent=${enabled}`,async()=>{
  const product={id:65831,code:65831,name:f.name,price:30000,availableNow:true,hasAttributes:false,attributes:[]};const half={id:65832,code:65832,name:'Medio Pollo Frito',price:15000,availableNow:true,hasAttributes:false,attributes:[]};const h=harness([product,half],enabled);h.cfg.paymentMethods=DEFAULT_PAYMENT_METHODS.map(m=>({...m,enabled:m.flow!=='mercadopago'}));h.service.ordersService.create=jest.fn().mockResolvedValue({id:6584,dailyOrderNumber:92});
  const added=await h.sendQueued(`Agradezco si me alistan un ${f.name} pero ${f.part} en caja diferente`);expect(h.conv.sessionData.cart).toHaveLength(1);expect(h.conv.sessionData.cart[0]).toMatchObject({productId:product.id,quantity:1,note:expect.stringMatching(/caja diferente/i)});expect(added).not.toMatch(/necesito aclarar|cu[aá]l|no manejamos/i);
  const pickup=await h.sendQueued('No, lo recojo en 15 minutos');expect(h.conv.sessionData.orderType).toBe('pickup');expect(h.conv.state).toBe('awaiting_payment');expect(pickup).not.toMatch(/algo m[aá]s|mercado pago/i);expect(h.conv.sessionData.cart).toHaveLength(1);
  await h.sendQueued('a nombre Cristina, contraentrega');expect(h.conv.customerName).toBe('Cristina');expect(h.service.ordersService.create).not.toHaveBeenCalled();await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.customerName).toBe('Cristina');expect(dto.orderType).toBe('pickup');expect(dto.items).toHaveLength(1);expect(dto.items[0].note).toMatch(/caja diferente/i);
 });
});

describe('Explicit drink with main and extras survives a later combo upgrade and contact correction',()=>{
 const cases=[{menu:products,source:'me das por favor, un pollo Broaster con Coca-Cola 1.5 orginal, extra 1 porción de papa Francesa 1 plátano con bocadillo y queso',main:4,drink:95,combo:98,extras:[9,53],correction:'el pollo damelo en combo con la coca cola',flavor:'Coca Cola'},
 {menu:[{id:65901,code:65901,name:'Sandwich Serrano',price:18000,availableNow:true,hasAttributes:false,attributes:[]},{id:65902,code:65902,name:'Te De Durazno 1.5L',categoryName:'Bebidas',price:6000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Original','Sin Azucar']}]},{id:65903,code:65903,name:'Combo De Sandwich Serrano',price:24000,description:'Incluye sandwich y té de 1.5L',availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Te De Durazno','Te De Limon']}]},{id:65904,code:65904,name:'Papas Rusticas',price:6000,availableNow:true,hasAttributes:false,attributes:[]},{id:65905,code:65905,name:'Flan De Coco',price:5000,availableNow:true,hasAttributes:false,attributes:[]}],source:'Me das un Sandwich Serrano con Te De Durazno 1.5L Original, extra 1 Papas Rusticas y 1 Flan De Coco',main:65901,drink:65902,combo:65903,extras:[65904,65905],correction:'el Sandwich Serrano damelo en combo con Te De Durazno',flavor:'Te De Durazno'}];
 for(const f of cases)for(const enabled of [false,true])it(`${f.main} agent=${enabled}`,async()=>{
  const h=harness(f.menu,enabled);h.cfg.paymentMethods=DEFAULT_PAYMENT_METHODS.map(m=>({...m,enabled:m.flow!=='mercadopago'}));h.service.ordersService.create=jest.fn().mockResolvedValue({id:6590,dailyOrderNumber:95});
  const reply=await h.sendQueued(f.source);const initial=h.conv.sessionData.cart;expect(initial.map((line:any)=>line.productId)).toEqual(expect.arrayContaining(f.extras));expect(initial.map((line:any)=>line.productId)).toEqual(expect.arrayContaining([f.drink]));expect(reply).toMatch(f.drink===95?/Coca.?Cola.*1[.,]5/i:/Te De Durazno/i);expect(reply).not.toMatch(/no (?:manejamos|tenemos)/i);
  await h.sendQueued(f.correction);expect(h.conv.sessionData.cart.map((line:any)=>line.productId).sort()).toEqual([...f.extras,f.combo].sort());expect(h.conv.sessionData.cart.find((line:any)=>line.productId===f.combo)?.attributes).toContainEqual({attributeName:'Bebida',attributeValue:f.flavor});
  await h.sendQueued('no mas');await h.sendQueued('cra 81 b # 6b 50 Terrazas de Castilla 2 casa 102');expect(h.conv.state).toBe('awaiting_payment');const cart=structuredClone(h.conv.sessionData.cart);
  const phone=await h.sendQueued('3000000007');expect(phone).toMatch(/tel[eé]fono.*actualizado|contacto.*actualizado/i);expect(phone).toMatch(/300 000 0007/);expect(phone).toMatch(/c[oó]mo pagas|m[eé]todo de pago/i);expect(h.conv.sessionData.cart).toEqual(cart);expect(h.conv.state).toBe('awaiting_payment');expect(h.conv.sessionData.contactPhone).toMatch(/3000000007/);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('1');expect(h.service.ordersService.create).not.toHaveBeenCalled();await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.phone).toMatch(/3000000007/);expect(dto.items).toHaveLength(3);
 });
});

describe('Paired meal attribute general menus and checkout',()=>{
 for(const f of [
  {head:'ramen',variants:['Miso','Shoyu'],size:'Grande',attribute:'Caldo',choices:['Vegetal','Cerdo'],drink:'Te'},
  {head:'bowl',variants:['Rojo','Verde'],size:'Grande',attribute:'Base',choices:['Quinoa','Arroz'],drink:'Agua'},
 ])for(const enabled of [false,true])for(const joined of [false,true])for(const state of ['building_cart','awaiting_payment'])it(`${f.head} agent=${enabled} joined=${joined} state=${state}`,async()=>{
  const menu=f.variants.map((v,index)=>({id:66501+index,code:66501+index,name:`${f.head} ${v}`,price:20000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Tamano',options:[f.size,'Chico']},{attributeName:f.attribute,options:f.choices},{attributeName:'Bebida',options:[f.drink]}]}));
  const h=harness(menu,enabled);h.conv.state=state;
  Object.assign(h.conv.sessionData,{orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
  const first=`Me regalas dos ${f.head} ${f.size} uno ${f.variants[0]} y otro ${f.variants[1]}, con ${f.drink}`;
  const follow=`${f.attribute}s. 1${f.choices[0]} y otra ${f.choices[1]}`;
  if(joined)await h.sendQueued(first+'\n'+follow);else{await h.sendQueued(first);await h.sendQueued(follow);}
  expect(h.cartRows()).toHaveLength(2);
  for(let index=0;index<2;index++)expect(h.cartRows()[index]).toMatchObject({id:menu[index].id,qty:1,attrs:expect.arrayContaining([`Tamano:${f.size}`,`${f.attribute}:${f.choices[index]}`,`Bebida:${f.drink}`])});
  expect(h.replies.at(-1)).not.toMatch(/no manejamos|necesito aclarar/i);
  expect(h.conv.state).toBe(state);
  const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued('cuánto suma mi pedido');expect(h.conv.sessionData.cart).toEqual(before);
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:6650,dailyOrderNumber:105});
  await h.sendQueued('nada más');await h.sendQueued('1');expect(h.service.ordersService.create).not.toHaveBeenCalled();await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toHaveLength(2);
  expect(dto.items.map((item:any)=>item.productId)).toEqual(menu.map(item=>item.id));
  for(let index=0;index<2;index++)expect(dto.items[index].attributes).toEqual(expect.arrayContaining([{attributeName:'Tamano',attributeValue:f.size},{attributeName:f.attribute,attributeValue:f.choices[index]},{attributeName:'Bebida',attributeValue:f.drink}]));
 });
});

describe('Combined contact updates keep missing payment and unrelated clauses pending',()=>{
 for(const enabled of [false,true])for(const separator of [', ','; ','\n'])it(`name and phone only agent=${enabled} separator=${JSON.stringify(separator)}`,async()=>{
  const h=harness([{id:67102,code:67102,name:'Tarta De Espinaca',price:18000,availableNow:true,attributes:[]}],enabled);
  h.conv.state='awaiting_payment';Object.assign(h.conv.sessionData,{cart:[{productId:67102,name:'Tarta De Espinaca',unitPrice:18000,quantity:1}],orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});h.service.ordersService.create=jest.fn();
  const before=structuredClone(h.conv.sessionData.cart);const reply=await h.sendQueued(['a nombre Cristina','celular 3000000004'].join(separator));
  expect(h.conv.customerName).toBe('Cristina');expect(h.conv.sessionData.contactPhone).toMatch(/3000000004/);expect(h.conv.state).toBe('awaiting_payment');expect(h.conv.sessionData.paymentMethod).toBeUndefined();expect(reply).toMatch(/c[oó]mo pagas|m[eé]todo de pago/i);expect(h.conv.sessionData.cart).toEqual(before);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 for(const tail of ['quita la segunda','sin cebolla','cuánto demora','celular 3000000004, celular 3000000005'])it(`contact handler declines unconsumed or conflicting clauses: ${tail}`,async()=>{
  const h=harness(products,false);const before=structuredClone(h.conv.sessionData);const name=h.conv.customerName;
  const handled=await (h.service as any).tryHandleExplicitCustomerNameLabel(h.conv,'customer',h.conv.sessionData,`a nombre Cristina, contraentrega, ${tail}`,h.cfg);
  expect(handled).toBe(false);expect(h.conv.customerName).toBe(name);expect(h.conv.sessionData).toEqual(before);expect(h.replies).toHaveLength(0);
 });
});

describe('PDF merchant payment details boundaries',()=>{
 for(const enabled of [false,true])for(const mode of ['missing','disabled','explicit_customer','payment_choice']){
  it(mode+' agent='+enabled,async()=>{
   const h=harness([{id:79912,code:79912,name:'Ravioles De Ricota',price:18000,availableNow:true,attributes:[]}],enabled);
   h.conv.state='awaiting_payment';Object.assign(h.conv.sessionData,{cart:[{productId:79912,name:'Ravioles De Ricota',quantity:1,unitPrice:18000,note:'Salsa aparte'}],orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});h.service.ordersService.create=jest.fn();
   if(mode==='disabled'){h.cfg.localContext={transferInfoNote:'Cuenta vieja 3000000008'};h.cfg.paymentMethods=DEFAULT_PAYMENT_METHODS.map(m=>({...m,enabled:m.id==='cash'}));}
   const before=structuredClone(h.conv.sessionData);
   const text=mode==='explicit_customer'?'a nombre de Cristina, teléfono 3000000004, contraentrega':mode==='payment_choice'?'Pago por Nequi':'¿A nombre de quién sale el pago?';
   const reply=await h.sendQueued(text);expect(h.service.ordersService.create).not.toHaveBeenCalled();expect(h.conv.sessionData.cart).toEqual(before.cart);
   if(mode==='missing'||mode==='disabled'){
    expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBe('Wilmer');expect(h.conv.state).toBe('awaiting_payment');
    expect(reply).toMatch(mode==='missing'?/no tengo.*confirmados/i:/no está habilitada/i);expect(reply).not.toContain('3000000008');
   }else if(mode==='explicit_customer'){
    expect(h.conv.customerName).toBe('Cristina');expect(h.conv.sessionData.contactPhone).toMatch(/3000000004/);expect(h.conv.sessionData.paymentMethod).toBe('cash');
   }else{expect(h.conv.sessionData.paymentMethod).toBe('transfer');expect(h.conv.customerName).toBe('Wilmer');}
  });
 }
});

describe('Merchant details helper does not consume mixed order requests',()=>{
 it.each(['Quiero una pizza y me pasas los datos para transferir','Cambia la dirección y me pasas los datos para transferir','Me regalas dos bowls, cuál es el Nequi','Mi teléfono es 3000000004, me pasas los datos para transferir','A nombre de Cristina, me pasas los datos para transferir'])('%s',async text=>{
  const h=harness(products,false);h.service.reply=jest.fn();const before=structuredClone(h.conv);
  expect(await h.service.tryHandleMerchantPaymentDetails(h.conv,'customer',text,h.cfg)).toBe(false);
  expect(h.conv).toEqual(before);expect(h.service.reply).not.toHaveBeenCalled();
 });
});

describe('Compound recipient replaces saved name only when explicitly supplied', () => {
 for (const clause of ['a nombre de Cristina', 'Nombre: Cristina', 'me llamo Cristina', 'a nombre Cristina']) {
  it(clause, async () => {
   const h=harness([{id:79992,code:79992,name:'Ravioles De Ricota',price:21000,availableNow:true,attributes:[]}],false);
   await h.sendQueued(`Quiero un Ravioles De Ricota; ${clause}; celular 3000000004`);
   expect(h.conv.customerName).toBe('Cristina');
   expect(h.conv.sessionData.contactPhone).toMatch(/3000000004/);
   expect(h.cartRows()).toEqual([expect.objectContaining({id:79992,qty:1})]);
  });
 }
 it('inferred leading name does not replace the saved recipient', async () => {
  const h=harness([{id:79992,code:79992,name:'Ravioles De Ricota',price:21000,availableNow:true,attributes:[]}],false);
  await h.sendQueued('Natalia quiero un Ravioles De Ricota; celular 3000000004');
  expect(h.conv.customerName).toBe('Wilmer');
  expect(h.cartRows()).toEqual([expect.objectContaining({id:79992,qty:1})]);
 });
});

describe('Delivery unit corrections replace previous values without confirming',()=>{
 for(const unit of [{before:'apartamento 304B',after:'apartamento 402',oldValue:'304B',newValue:'402'},{before:'interior 21',after:'interior 2',oldValue:'21',newValue:'2'}])for(const name of ['Ravioles De Ricota','Bowl De Garbanzos'])for(const enabled of [false,true])for(const final of [false,true])it(`${name} ${unit.after} final=${final} agent=${enabled}`,async()=>{
  const h=harness([{id:80011,code:80011,name,price:21000,availableNow:true,attributes:[]}],enabled);
  h.cfg.paymentMethods=DEFAULT_PAYMENT_METHODS.map(method=>({...method,enabled:method.flow!=='mercadopago'}));
  Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,notesCollected:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164});
  h.service.deliveryRouting={quoteDeliveryFee:jest.fn().mockResolvedValue({ok:true,fee:2000,distanceKm:1,source:'google_directions',customer:{lat:4.62,lng:-74.15}})};
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:8001,dailyOrderNumber:88});
  await h.sendQueued(`Quiero dos ${name}`);await h.sendQueued(`Calle 10 #81A-20 torre B ${unit.before}`);
  expect(h.conv.state).toBe('awaiting_payment');if(final)await h.sendQueued('contraentrega');
  const state=h.conv.state;const cart=structuredClone(h.conv.sessionData.cart);
  const reference=name.startsWith('Bowl')?`El ${unit.after.replace(' ', ' es ')}`:unit.after;
  for(let repeat=0;repeat<2;repeat++){
   const reply=await h.sendQueued(reference);
   expect(reply).toContain(unit.newValue);expect(reply).not.toMatch(/algo m[aá]s|qu[eé] se te antoja/i);
   expect(h.conv.state).toBe(state);expect(h.conv.sessionData.cart).toEqual(cart);
   expect(h.conv.sessionData.address).toMatch(new RegExp(`81A-20.*torre B.*${unit.newValue}`, 'i'));
   expect(h.conv.sessionData.address).not.toContain(unit.oldValue);
   expect(h.conv.sessionData.address!.match(new RegExp(`(?:apto|apartamento|int|interior)\\s+${unit.newValue}\\b`, 'gi'))).toHaveLength(1);
   expect(h.service.ordersService.create).not.toHaveBeenCalled();
  }
  const total=await h.sendQueued('Cuánto es el total');expect(total).toMatch(/44[.,]000/);
  if(!final)await h.sendQueued('contraentrega');
  expect(h.conv.state).toBe('awaiting_final_confirm');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toHaveLength(2);expect(dto.items.every((r:any)=>r.productId===80011)).toBe(true);
  expect(dto.address).not.toContain(unit.oldValue);expect(dto.address).toMatch(new RegExp(`81A-20.*torre B.*${unit.newValue}`, 'i'));expect(dto.deliveryFee).toBe(2000);
  expect(dto.phone).toMatch(/3000000001/);expect(dto.customerName).toBe('Wilmer');
 });
});
