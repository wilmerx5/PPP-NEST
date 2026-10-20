import { harness } from './whatsapp-accuracy.test-support';
import { DEFAULT_PAYMENT_METHODS } from './whatsapp-payment-methods';

type Family = {
  id: string;
  drink: { name: string; ask: string; options: [string, string, string] };
  list: { ask: string; names: [string, string]; picks: [string, string] };
  side: { name: string; ask: string };
  main: string;
};

const families: Family[] = [
  {
    id: 'bowl-bar',
    drink: { name: 'Limonada Natural', ask: 'una limonada natural', options: ['Coco', 'Hierbabuena', 'Mango'] },
    list: { ask: 'un jugo', names: ['Jugo De Lulo', 'Jugo De Mora'], picks: ['lulo', 'mora'] },
    side: { name: 'Ensalada César', ask: 'una ensalada' },
    main: 'Bao De Hongos',
  },
  {
    id: 'burger-grill',
    drink: { name: 'Té Frío', ask: 'un té frío', options: ['Limón', 'Durazno', 'Frutos Rojos'] },
    list: { ask: 'una malteada', names: ['Malteada De Vainilla', 'Malteada De Chocolate'], picks: ['vainilla', 'chocolate'] },
    side: { name: 'Arepa De Queso', ask: 'una arepa de queso' },
    main: 'Hamburguesa Doble',
  },
  {
    id: 'street-kitchen',
    drink: { name: 'Soda Italiana', ask: 'una soda italiana', options: ['Frambuesa', 'Maracuyá', 'Kiwi'] },
    list: { ask: 'una empanada', names: ['Empanada De Pollo', 'Empanada De Carne'], picks: ['pollo', 'carne'] },
    side: { name: 'Papas Rústicas', ask: 'unas papas rústicas' },
    main: 'Wrap Vegetariano',
  },
];

const menuOf = (f: Family) => [
  { id: 1, code: 101, name: f.main, price: 18000, availableNow: true, hasAttributes: false, attributes: [] },
  { id: 2, code: 102, name: f.side.name, price: 9000, availableNow: true, hasAttributes: false, attributes: [] },
  { id: 3, code: 103, name: f.list.names[0], price: 7000, availableNow: true, hasAttributes: false, attributes: [] },
  { id: 4, code: 104, name: f.list.names[1], price: 7500, availableNow: true, hasAttributes: false, attributes: [] },
  { id: 5, code: 105, name: f.drink.name, price: 8000, availableNow: true, hasAttributes: true,
    attributes: [{ attributeName: 'Sabor', options: [...f.drink.options] }] },
];

type Rig = ReturnType<typeof harness> & { created: jest.Mock };

function rig(f: Family, agent: boolean): Rig {
  const h = harness(menuOf(f) as never, agent);
  h.cfg.paymentMethods = DEFAULT_PAYMENT_METHODS.map(method => ({ ...method, enabled: method.flow !== 'mercadopago' }));
  const created = jest.fn().mockResolvedValue({ id: 1, dailyOrderNumber: 1 });
  const orders = (h.service as unknown as { ordersService: Record<string, unknown> }).ordersService;
  orders.create = created;
  orders.findTodayOrdersByPhone = async () => [];
  return Object.assign(h, { created });
}

async function burst(h: Rig, texts: string[], gapMs = 0): Promise<string[]> {
  const start = h.replies.length;
  jest.useFakeTimers();
  try {
    const sent: Promise<void>[] = [];
    for (const [index, text] of texts.entries()) {
      sent.push(h.service.handleIncoming({
        waId: 'customer', phoneE164: h.conv.phoneE164, messageId: `burst-${index}-${text}`,
        messageType: 'text', text, timestamp: Date.now() / 1000, raw: {},
      }));
      if (gapMs) await jest.advanceTimersByTimeAsync(gapMs);
    }
    await jest.advanceTimersByTimeAsync(8000);
    await Promise.all(sent);
  } finally {
    jest.useRealTimers();
  }
  return h.replies.slice(start);
}

const rows = (h: Rig) => h.conv.sessionData.cart.map(line => ({
  name: line.name, qty: line.quantity, option: line.attributes?.[0]?.attributeValue, note: line.note || undefined,
}));

async function atDrinkChoice(f: Family, agent: boolean) {
  const h = rig(f, agent);
  const drink = menuOf(f)[4];
  h.conv.sessionData.pendingAttribute = {
    productId: drink.id, name: drink.name, code: drink.code, price: drink.price,
    attributes: drink.attributes, selected: [], sourceText: f.drink.ask,
  };
  h.conv.state = 'awaiting_attribute';
  return h;
}

async function atList(f: Family, agent: boolean) {
  const h = rig(f, agent);
  const candidates = menuOf(f).slice(2, 4);
  h.conv.sessionData.pendingMatch = { query: f.list.ask, candidates, intent: 'order' };
  return h;
}

function atFinalStep(f: Family, agent: boolean) {
  const h = rig(f, agent);
  Object.assign(h.conv.sessionData, {
    orderType: 'delivery', fulfillmentChosen: true, address: 'Calle 10 #20-30', addressConfirmed: true,
    phoneConfirmed: true, contactPhone: h.conv.phoneE164, notesCollected: true, paymentMethod: 'contraentrega',
    deliveryFeeCalculated: 2000,
    cart: [{ productId: 1, code: 101, name: f.main, unitPrice: 18000, quantity: 2, attributes: [] }],
  });
  h.conv.state = 'awaiting_final_confirm';
  return h;
}

/** With the agent on, a bubble the router hands to the agent must reach it alone. */
function expectRows(h: Rig, agent: boolean, expected: object[], restWord: string, answer: string) {
  const got = rows(h);
  if (agent && got.length < expected.length) {
    expect(got).toEqual(expected.slice(0, got.length));
    const message = String(h.agent.runTurn.mock.calls.at(-1)?.[0]?.userMessage || '');
    expect(message.toLowerCase()).toContain(restWord.toLowerCase());
    expect(message.toLowerCase()).not.toContain(answer.toLowerCase());
    return;
  }
  expect(got).toEqual(expected);
}

const noPending = (h: Rig) => {
  expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
  expect(h.created).not.toHaveBeenCalled();
};

const cases = families.flatMap(family => [false, true].map(agent => ({ family, agent })));

describe.each(cases)('ráfaga durante una duda pendiente — $family.id agent=$agent', ({ family: f, agent }) => {
  const [o1, o2, o3] = f.drink.options;

  it('opción + otro plato: la respuesta y el plato quedan, sin doble «¿Algo más?»', async () => {
    const h = await atDrinkChoice(f, agent);
    const replies = await burst(h, [o1.toLowerCase(), `y agrega ${f.side.ask}`]);
    expectRows(h, agent, [{ name: f.drink.name, qty: 1, option: o1 }, { name: f.side.name, qty: 1 }], f.side.name.split(' ')[0], o1);
    if (rows(h).length === 2) {
      expect(replies.filter(reply => /¿\*Algo más\*\?/.test(reply))).toHaveLength(1);
      expect(replies.at(-1)).toMatch(/¿\*Algo más\*\?/);
    }
    noPending(h);
  });

  it('número de opción + otro plato', async () => {
    const h = await atDrinkChoice(f, agent);
    await burst(h, ['2', `y ${f.side.ask}`]);
    expectRows(h, agent, [{ name: f.drink.name, qty: 1, option: o2 }, { name: f.side.name, qty: 1 }], f.side.name.split(' ')[0], o2);
    noPending(h);
  });

  it('opción + nota de cocina va a la bebida elegida', async () => {
    const h = await atDrinkChoice(f, agent);
    await burst(h, [o1.toLowerCase(), 'sin hielo']);
    expect(rows(h)).toEqual([{ name: f.drink.name, qty: 1, option: o1, note: 'sin hielo' }]);
    noPending(h);
  });

  it('opción + «y otra de <opción>» agrega una segunda unidad con esa opción', async () => {
    const h = await atDrinkChoice(f, agent);
    const replies = await burst(h, [o1.toLowerCase(), `y otra de ${o3.toLowerCase()}`]);
    expect(rows(h)).toEqual([{ name: f.drink.name, qty: 1, option: o1 }, { name: f.drink.name, qty: 1, option: o3 }]);
    expect(replies.at(-1)).toContain(`Sabor: ${o3}`);
    noPending(h);
  });

  it('contraste: «perdón, <opción>» corrige en vez de agregar', async () => {
    const h = await atDrinkChoice(f, agent);
    await burst(h, [o1.toLowerCase(), `perdón, ${o3.toLowerCase()}`]);
    expect(rows(h)).toEqual([{ name: f.drink.name, qty: 1, option: o3 }]);
    noPending(h);
  });

  it('contraste: una respuesta partida en dos burbujas se une', async () => {
    const h = await atDrinkChoice(f, agent);
    await burst(h, ['dame la', `de ${o1.toLowerCase()}`]);
    expect(rows(h)).toEqual([{ name: f.drink.name, qty: 1, option: o1 }]);
    noPending(h);
  });

  it('contraste: la misma opción repetida no duplica la bebida', async () => {
    const h = await atDrinkChoice(f, agent);
    const replies = await burst(h, [o3.toLowerCase(), o3.toLowerCase()]);
    expect(rows(h)).toEqual([{ name: f.drink.name, qty: 1, option: o3 }]);
    expect(replies).toHaveLength(1);
    noPending(h);
  });

  it('contraste: una sola burbuja conserva la respuesta habitual', async () => {
    const h = await atDrinkChoice(f, agent);
    const replies = await burst(h, [o2.toLowerCase()]);
    expect(rows(h)).toEqual([{ name: f.drink.name, qty: 1, option: o2 }]);
    expect(replies).toHaveLength(1);
    expect(replies[0]).toMatch(/¿\*Algo más\*\?/);
    noPending(h);
  });

  it('contraste: burbujas separadas por más tiempo que la espera dan el mismo carrito', async () => {
    const h = await atDrinkChoice(f, agent);
    await burst(h, [o1.toLowerCase(), `y ${f.side.ask}`], 2500);
    expectRows(h, agent, [{ name: f.drink.name, qty: 1, option: o1 }, { name: f.side.name, qty: 1 }], f.side.name.split(' ')[0], o1);
    noPending(h);
  });

  it('lista: número + otro plato elige la fila y agrega el plato', async () => {
    const h = await atList(f, agent);
    await burst(h, ['2', `y ${f.side.ask}`]);
    expectRows(h, agent, [{ name: f.list.names[1], qty: 1 }, { name: f.side.name, qty: 1 }], f.side.name.split(' ')[0], f.list.picks[1]);
    expect(h.created).not.toHaveBeenCalled();
  });

  it('lista: nombre + otro plato', async () => {
    const h = await atList(f, agent);
    await burst(h, [`el de ${f.list.picks[1]}`, `y ${f.side.ask}`]);
    expectRows(h, agent, [{ name: f.list.names[1], qty: 1 }, { name: f.side.name, qty: 1 }], f.side.name.split(' ')[0], f.list.picks[1]);
    expect(h.created).not.toHaveBeenCalled();
  });

  it('lista: nombre + «y otro de <fila>» agrega ambas filas sin saltar al cierre', async () => {
    const h = await atList(f, agent);
    await burst(h, [f.list.picks[0], `y otro de ${f.list.picks[1]}`]);
    expect(rows(h)).toEqual([{ name: f.list.names[0], qty: 1 }, { name: f.list.names[1], qty: 1 }]);
    expect(h.conv.state).toBe('building_cart');
    expect(h.created).not.toHaveBeenCalled();
  });

  it('contraste lista: «1» + «mejor el 2» deja solo la corrección', async () => {
    const h = await atList(f, agent);
    await burst(h, ['1', 'mejor el 2']);
    expect(rows(h)).toEqual([{ name: f.list.names[1], qty: 1 }]);
    expect(h.created).not.toHaveBeenCalled();
  });

  it('paso final: agregar + «confirmar» no crea la orden sin ver el resumen nuevo', async () => {
    const h = atFinalStep(f, agent);
    const replies = await burst(h, [`agrega ${f.side.ask}`, 'confirmar']);
    expect(rows(h)).toEqual([{ name: f.main, qty: 2 }, { name: f.side.name, qty: 1 }]);
    expect(h.conv.state).toBe('awaiting_final_confirm');
    expect(replies.at(-1)).toMatch(/Aún no confirmé el pedido/);
    expect(h.created).not.toHaveBeenCalled();
  });

  it('paso final: nota + «confirmar» guarda solo la nota', async () => {
    const h = atFinalStep(f, agent);
    await burst(h, ['sin cebolla', 'confirmar']);
    expect(rows(h)).toEqual([{ name: f.main, qty: 2, note: 'sin cebolla' }]);
    expect(h.conv.state).toBe('awaiting_final_confirm');
    expect(h.created).not.toHaveBeenCalled();
  });

  it('contraste final: un cambio que no se pudo aplicar + «confirmar» tampoco crea la orden', async () => {
    const h = atFinalStep(f, agent);
    const replies = await burst(h, ['agrega un mojito', 'confirmar']);
    expect(rows(h)).toEqual([{ name: f.main, qty: 2 }]);
    expect(h.conv.state).toBe('awaiting_final_confirm');
    expect(replies.at(-1)).toMatch(/Aún no confirmé el pedido/);
    expect(h.created).not.toHaveBeenCalled();
  });

  it('contraste final: «gracias» + «confirmar» crea la orden una vez', async () => {
    const h = atFinalStep(f, agent);
    await burst(h, ['gracias', 'confirmar']);
    expect(h.created).toHaveBeenCalledTimes(1);
    expect(h.conv.state).toBe('completed');
  });

  it('contraste final: «confirmar» + «espera, sin cebolla» no crea la orden', async () => {
    const h = atFinalStep(f, agent);
    await burst(h, ['confirmar', 'espera, sin cebolla']);
    expect(rows(h)).toEqual([{ name: f.main, qty: 2, note: 'sin cebolla' }]);
    expect(h.created).not.toHaveBeenCalled();
  });

  it('contraste final: «confirmar» repetido crea una sola orden', async () => {
    const h = atFinalStep(f, agent);
    await burst(h, ['confirmar', 'confirmar']);
    expect(h.created).toHaveBeenCalledTimes(1);
    const dto = h.created.mock.calls[0][0] as { items: unknown[] };
    expect(dto.items).toHaveLength(2);
  });
});
