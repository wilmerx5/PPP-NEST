import { harness } from './whatsapp-accuracy.test-support';
import { WhatsappAgentService } from './whatsapp-agent.service';
import type { WhatsappCatalogProduct } from './whatsapp-catalog.service';

const catalogues = [
  ['Combo De Pollo Frito', 'Limonada Natural'],
  ['Bowl Vegetal', 'Pan De Ajo'],
];
const states = ['building_cart', 'awaiting_payment', 'awaiting_final_confirm'];
type Call = { name: string; args: Record<string, unknown> };
function response(calls: Call[] = [], content = '') {
  return new Response(JSON.stringify({ choices: [{ message: { content,
    ...(calls.length ? { tool_calls: calls.map((call, index) => ({ id: `543-${index}-${call.name}`, type: 'function',
      function: { name: call.name, arguments: JSON.stringify(call.args) } })) } : {}),
  } }] }), { status: 200 });
}
function setup(names: string[], state = 'building_cart') {
  const menu: WhatsappCatalogProduct[] = [
    { id: 54301, code: 1, name: names[0], price: 30000, availableNow: true, categoryName: 'Platos', hasAttributes: true,
      attributes: [{ attributeName: 'Bebida', options: ['Colombiana', 'Coca Cola'] }] },
    { id: 54302, code: 2, name: names[1], price: 5000, availableNow: true, categoryName: 'Adicionales', hasAttributes: false, attributes: [] },
  ];
  const h = harness(menu, true);
  h.conv.state = state;
  h.service.settingsService.semanticRoutingEnabled = () => true;
  h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
  Object.assign(h.conv.sessionData, { cart: [{ productId: 54301, code: 1, name: names[0], quantity: 4, unitPrice: 29000,
    note: 'Salsa aparte', attributes: [{ attributeName: 'Bebida', attributeValue: 'Colombiana' }] }],
    orderType: 'pickup', fulfillmentChosen: true, phoneConfirmed: true, notesCollected: true,
    ...(state === 'awaiting_final_confirm' ? { paymentMethod: 'contraentrega' } : {}),
  });
  h.service.conversationService.saveSemanticSession = jest.fn(async (_conv, expected, next, nextState) => {
    if (h.conv.state !== expected.state || JSON.stringify(h.conv.sessionData) !== JSON.stringify(expected.session)) return false;
    h.conv.sessionData = structuredClone(next); h.conv.state = nextState; return true;
  });
  h.service.ordersService.create = jest.fn();
  h.service.agentService = new WhatsappAgentService({ getEffectiveConfig: async () => ({ ...h.cfg,
    openaiApiKey: 'offline-fixture', openaiModel: 'gpt-4o-mini', aiTemperature: 0.2, systemPrompt: 'Usa el catálogo.' }) } as never,
    h.service.catalogService);
  const agent = jest.spyOn(h.service.agentService, 'runTurn');
  return { ...h, menu, agent };
}
function plan(edit: string, buy: string, calls: Call[], purchaseId = 54302) {
  jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Unexpected network request'))
    .mockResolvedValueOnce(response([{ name: 'interpret_message', args: { segments: [
      { text: edit, role: 'edit', productIds: [54301] }, { text: buy, role: 'purchase', productIds: [purchaseId] },
    ] } }]))
    .mockResolvedValueOnce(response(calls))
    .mockResolvedValueOnce(response([], 'Listo'));
}
afterEach(() => jest.restoreAllMocks());

const phrases = [
  (count: string, change: string) => `De los cuatro, cambia ${count} ${change}`,
  (count: string, change: string) => `Veci, ${count} de los que ya pedí los quiero ${change}`,
  (count: string, change: string) => `Lo que quiero es que ${count} queden ${change}`,
  (count: string, change: string) => `Para aclarar mi pedido, pon ${count} ${change}`,
];
for (const names of catalogues) for (const state of states) for (const noteOnly of [false, true]) {
  for (const affected of [1, 2]) for (const buyQuantity of [1, 2]) for (const buyFirst of [false, true]) {
    for (const phrase of phrases) {
      it(`atomic subset and purchase ${names[0]}/${state}/note${noteOnly}/subset${affected}/buy${buyQuantity}/first${buyFirst}/${phrases.indexOf(phrase)}`, async () => {
        const h = setup(names, state);
        const original = structuredClone(h.conv.sessionData.cart[0]);
        const edit = phrase(affected === 1 ? 'uno' : 'dos', noteOnly ? 'sin arroz y más ensalada' : 'con Coca Cola');
        const buy = `y agrega ${buyQuantity === 1 ? 'una' : 'dos'} ${names[1]}`;
        const partition: Call = { name: 'set_unit_attributes', args: { productId: 54301, cartLineIndex: 0, affectedQuantity: affected,
          attributes: noteOnly ? [] : [{ attributeName: 'Bebida', attributeValue: 'Coca Cola' }],
          ...(noteOnly ? { note: 'Sin arroz, más ensalada' } : {}), sourceText: edit } };
        const purchase: Call = { name: 'add_item', args: { productId: 54302, quantity: buyQuantity, sourceText: buy } };
        plan(edit, buy, [{ name: 'get_cart', args: {} }, ...(buyFirst ? [purchase, partition] : [partition, purchase]),
          { name: 'get_cart', args: {} }]);
        const reply = await h.sendQueued(`${edit}, ${buy}`);
        expect((await h.agent.mock.results[0].value).error).toBeUndefined();
        const rows = h.conv.sessionData.cart;
        expect(rows).toHaveLength(3);
        const unchanged = rows.find(row => row.productId === 54301 && row.note === original.note &&
          row.attributes?.some(attribute => attribute.attributeValue === 'Colombiana'))!;
        expect(unchanged.quantity).toBe(4 - affected);
        const changed = rows.find(row => row.productId === 54301 && row !== unchanged)!;
        expect(changed.quantity).toBe(affected);
        expect(changed.unitPrice).toBe(original.unitPrice);
        expect(changed.note).toContain('Salsa aparte');
        if (noteOnly) expect(changed.note).toContain('Sin arroz, más ensalada');
        else expect(changed.attributes).toEqual([{ attributeName: 'Bebida', attributeValue: 'Coca Cola' }]);
        expect(rows.find(row => row.productId === 54302)?.quantity).toBe(buyQuantity);
        expect(reply).toContain(names[1]);
        expect(reply).not.toMatch(/aclaras|no pude/i);
        expect(h.service.conversationService.saveSemanticSession).toHaveBeenCalledTimes(1);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
      });
    }
  }
}

for (const names of catalogues) for (const fault of ['excess', 'unknown-option', 'overlap', 'missing-stock', 'stale']) {
  for (const buyFirst of [false, true]) {
    it(`the entire mixed plan is rejected on ${fault}/${names[0]}/${buyFirst}`, async () => {
      const h = setup(names);
      const before = structuredClone(h.conv.sessionData);
      const edit = 'De los cuatro cambia dos con Coca Cola';
      const buy = `y agrega una ${names[1]}`;
      if (fault === 'missing-stock') h.menu[1].availableNow = false;
      if (fault === 'stale') h.service.conversationService.saveSemanticSession.mockResolvedValue(false);
      const partition: Call = { name: 'set_unit_attributes', args: { productId: 54301, cartLineIndex: 0,
        affectedQuantity: fault === 'excess' ? 5 : 2, attributes: [{ attributeName: 'Bebida', attributeValue: fault === 'unknown-option' ? 'Caviar' : 'Coca Cola' }], sourceText: edit } };
      const purchase: Call = { name: 'add_item', args: { productId: 54302, quantity: 1, sourceText: buy } };
      plan(edit, buy, [...(buyFirst ? [purchase, partition] : [partition, purchase]), ...(fault === 'overlap' ? [
        { ...partition, args: { ...partition.args, affectedQuantity: 1 } },
      ] : [])]);
      await h.sendQueued(`${edit} ${buy}`);
      expect(h.conv.sessionData).toEqual(before);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
  }
}

for (const quantity of [1, 2, 3, 5]) {
  it(`whole-line replacement cannot reinterpret ${quantity} units of a four-unit line`, async () => {
    const h = setup(catalogues[0]);
    h.menu.push({ ...h.menu[0], id: 54303, code: 3, name: 'Combo De Pollo Broaster' });
    const before = structuredClone(h.conv.sessionData);
    const edit = `De los cuatro cambia solo ${quantity} a broaster`;
    const buy = `y agrega una ${catalogues[0][1]}`;
    plan(edit, buy, [
      { name: 'search_menu', args: { query: 'Combo De Pollo Broaster', sourceText: edit } },
      { name: 'replace_item', args: { productId: 54301, newProductId: 54303, cartLineIndex: 0,
        targetText: 'a broaster', quantity, sourceText: edit } },
      { name: 'add_item', args: { productId: 54302, quantity: 1, sourceText: buy } },
    ]);
    await h.sendQueued(`${edit} ${buy}`);
    expect(h.conv.sessionData).toEqual(before);
  });
}

for (const wrongOwner of [false, true]) {
  it(`a replacement binds to the specified original variant wrongOwner=${wrongOwner}`, async () => {
    const h = setup(catalogues[0]);
    h.menu.push({ ...h.menu[0], id: 54303, code: 3, name: 'Combo De Pollo Broaster' });
    const first = structuredClone(h.conv.sessionData.cart[0]);
    const second = { ...structuredClone(first), quantity: 2, attributes: [{ attributeName: 'Bebida', attributeValue: 'Coca Cola' }] };
    h.conv.sessionData.cart = [first, second];
    const before = structuredClone(h.conv.sessionData);
    const edit = 'Cambia el de Colombiana por Combo De Pollo Broaster';
    const buy = `y agrega una ${catalogues[0][1]}`;
    plan(edit, buy, [
      { name: 'search_menu', args: { query: 'Combo De Pollo Broaster', sourceText: edit } },
      { name: 'replace_item', args: { productId: 54301, newProductId: 54303, cartLineIndex: wrongOwner ? 1 : 0,
        targetText: 'Combo De Pollo Broaster', quantity: wrongOwner ? 2 : 4, sourceText: edit } },
      { name: 'add_item', args: { productId: 54302, quantity: 1, sourceText: buy } },
    ]);
    await h.sendQueued(`${edit} ${buy}`);
    if (wrongOwner) expect(h.conv.sessionData).toEqual(before);
    else {
      expect((await h.agent.mock.results[0].value).error).toBeUndefined();
      expect(h.conv.sessionData.cart).toHaveLength(3);
      expect(h.conv.sessionData.cart).toContainEqual(second);
      expect(h.conv.sessionData.cart.find(row => row.productId === 54303)?.quantity).toBe(4);
    }
  });
}

for (const names of catalogues) for (const buyFirst of [false, true]) for (const quantity of [1, 2]) {
  it(`a fresh purchase of the partitioned SKU adds only its requested units ${names[0]}/${buyFirst}/${quantity}`, async () => {
    const h = setup(names);
    const edit = 'De los cuatro cambia dos con Coca Cola';
    const buy = `y agrega ${quantity} ${names[0]} más con Colombiana`;
    const partition: Call = { name: 'set_unit_attributes', args: { productId: 54301, cartLineIndex: 0,
      affectedQuantity: 2, attributes: [{ attributeName: 'Bebida', attributeValue: 'Coca Cola' }], sourceText: edit } };
    const purchase: Call = { name: 'add_item', args: { productId: 54301, quantity,
      attributes: [{ attributeName: 'Bebida', attributeValue: 'Colombiana' }], sourceText: buy } };
    plan(edit, buy, buyFirst ? [purchase, partition] : [partition, purchase], 54301);
    await h.sendQueued(`${edit} ${buy}`);
    expect((await h.agent.mock.results[0].value).error).toBeUndefined();
    expect(h.conv.sessionData.cart.reduce((total, row) => total + row.quantity, 0)).toBe(4 + quantity);
    expect(h.conv.sessionData.cart.filter(row => row.note === 'Salsa aparte').reduce((total, row) => total + row.quantity, 0)).toBe(4);
    expect(h.conv.sessionData.cart.filter(row => row.unitPrice === 30000).reduce((total, row) => total + row.quantity, 0)).toBe(quantity);
  });
}

for (const mode of ['clear', 'replace']) for (const buyFirst of [false, true]) {
  it(`only the counted group's note is ${mode} with a purchase first=${buyFirst}`, async () => {
    const h = setup(catalogues[1]);
    const edit = mode === 'clear' ? 'A dos bórrales toda la nota' : 'A dos cámbiales la nota por sin sal';
    const buy = `y agrega una ${catalogues[1][1]}`;
    const partition: Call = { name: 'set_unit_attributes', args: { productId: 54301, cartLineIndex: 0,
      affectedQuantity: 2, attributes: [], noteMode: mode, ...(mode === 'replace' ? { note: 'Sin sal' } : {}), sourceText: edit } };
    const purchase: Call = { name: 'add_item', args: { productId: 54302, quantity: 1, sourceText: buy } };
    plan(edit, buy, buyFirst ? [purchase, partition] : [partition, purchase]);
    await h.sendQueued(`${edit} ${buy}`);
    expect((await h.agent.mock.results[0].value).error).toBeUndefined();
    const rows = h.conv.sessionData.cart.filter(row => row.productId === 54301);
    expect(rows).toHaveLength(2);
    expect(rows.find(row => row.note === 'Salsa aparte')?.quantity).toBe(2);
    expect(rows.find(row => row.note !== 'Salsa aparte')?.note).toBe(mode === 'clear' ? undefined : 'Sin sal');
    expect(rows.every(row => row.quantity === 2)).toBe(true);
  });
}

it('a current kitchen note can identify the original variant of a note-only edit', async () => {
  const h = setup(catalogues[1]);
  h.conv.sessionData.cart[0].note = 'Sin arroz';
  h.conv.sessionData.cart.push({ ...structuredClone(h.conv.sessionData.cart[0]), note: 'Sin sal', quantity: 2 });
  const beforeSecond = structuredClone(h.conv.sessionData.cart[1]);
  const edit = 'De los sin arroz cambia dos y ponles más ensalada';
  const buy = `y agrega una ${catalogues[1][1]}`;
  plan(edit, buy, [
    { name: 'set_unit_attributes', args: { productId: 54301, cartLineIndex: 0, affectedQuantity: 2,
      attributes: [], note: 'Más ensalada', sourceText: edit } },
    { name: 'add_item', args: { productId: 54302, quantity: 1, sourceText: buy } },
  ]);
  await h.sendQueued(`${edit} ${buy}`);
  expect((await h.agent.mock.results[0].value).error).toBeUndefined();
  expect(h.conv.sessionData.cart).toContainEqual(beforeSecond);
  expect(h.conv.sessionData.cart.find(row => row.note?.includes('Más ensalada'))?.quantity).toBe(2);
});

for (const names of catalogues) {
  it(`partition plus purchase completes checkout with exactly the intended units ${names[0]}`, async () => {
    const h = setup(names);
    h.conv.sessionData.cart[0].unitPrice = h.menu[0].price;
    h.service.ordersService.create.mockResolvedValue({ id: 543, dailyOrderNumber: 543 });
    const edit = 'De los cuatro cambia dos con Coca Cola';
    const buy = `y agrega una ${names[1]}`;
    plan(edit, buy, [
      { name: 'set_unit_attributes', args: { productId: 54301, cartLineIndex: 0, affectedQuantity: 2,
        attributes: [{ attributeName: 'Bebida', attributeValue: 'Coca Cola' }], sourceText: edit } },
      { name: 'add_item', args: { productId: 54302, quantity: 1, sourceText: buy } },
    ]);
    await h.sendQueued(`${edit} ${buy}`);
    await h.sendQueued('no');
    await h.sendQueued('contraentrega');
    const reply = await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const order = h.service.ordersService.create.mock.calls[0][0];
    expect(order.items).toHaveLength(5);
    expect(order.items.filter(item => item.productId === 54301)).toHaveLength(4);
    expect(order.items.filter(item => item.productId === 54302)).toHaveLength(1);
    expect(h.conv.state).toBe('completed');
    expect(reply).toMatch(/543/);
    await h.sendQueued('gracias');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  });
}

for (const names of catalogues) for (const buyFirst of [false, true]) {
  it(`a mixed purchase keeps its own quantity while awaiting flavor ${names[0]}/${buyFirst}`, async () => {
    const h = setup(names);
    Object.assign(h.menu[1], { name: 'Jugo Natural', hasAttributes: true,
      attributes: [{ attributeName: 'Sabor', options: ['Mango', 'Mora'] }] });
    const edit = 'De los cuatro cambia dos con Coca Cola';
    const buy = 'y agrega dos jugos naturales';
    const partition: Call = { name: 'set_unit_attributes', args: { productId: 54301, cartLineIndex: 0, affectedQuantity: 2,
      attributes: [{ attributeName: 'Bebida', attributeValue: 'Coca Cola' }], sourceText: edit } };
    const purchase: Call = { name: 'add_item', args: { productId: 54302, quantity: 2, sourceText: buy } };
    plan(edit, buy, buyFirst ? [purchase, partition] : [partition, purchase]);
    await h.sendQueued(`${edit} ${buy}`);
    expect((await h.agent.mock.results[0].value).error).toBeUndefined();
    expect(h.conv.sessionData.pendingAttribute).toMatchObject({ productId: 54302, quantity: 2 });
    const prior = structuredClone(h.conv.sessionData.cart.filter(row => row.productId === 54301));
    await h.sendQueued('Mora');
    expect(h.conv.sessionData.cart.filter(row => row.productId === 54301)).toEqual(prior);
    expect(h.conv.sessionData.cart.find(row => row.productId === 54302)?.quantity).toBe(2);
    expect(h.conv.sessionData.cart.find(row => row.productId === 54302)?.attributes).toEqual([{ attributeName: 'Sabor', attributeValue: 'Mora' }]);
    expect(h.conv.sessionData.pendingAttribute).toBeUndefined();
  });
}

for (const reference of ['pechuga', 'pierna', 'pernil']) for (const wrongOwner of [false, true]) {
  it(`a unique shortened current option identifies the replacement owner ${reference}/${wrongOwner}`, async () => {
    const h = setup(catalogues[0]);
    const definitions = [{ attributeName: 'Presa', options: ['Pierna Pernil', 'Ala pechuga'] }];
    h.menu[0].attributes = definitions;
    h.menu.push({ ...h.menu[0], id: 54303, code: 3, name: 'Combo De Pollo Broaster' });
    const original = structuredClone(h.conv.sessionData.cart[0]);
    h.conv.sessionData.cart = [
      { ...structuredClone(original), attributes: [{ attributeName: 'Presa', attributeValue: 'Pierna Pernil' }] },
      { ...structuredClone(original), attributes: [{ attributeName: 'Presa', attributeValue: 'Ala pechuga' }] },
    ];
    const before = structuredClone(h.conv.sessionData);
    const owner = reference === 'pechuga' ? 1 : 0;
    const edit = `El de ${reference} cámbialo por Combo De Pollo Broaster`;
    const buy = `y agrega una ${catalogues[0][1]}`;
    plan(edit, buy, [
      { name: 'search_menu', args: { query: 'Combo De Pollo Broaster', sourceText: edit } },
      { name: 'replace_item', args: { productId: 54301, newProductId: 54303, cartLineIndex: wrongOwner ? 1 - owner : owner,
        targetText: 'Combo De Pollo Broaster', quantity: 4, sourceText: edit } },
      { name: 'add_item', args: { productId: 54302, quantity: 1, sourceText: buy } },
    ]);
    await h.sendQueued(`${edit} ${buy}`);
    if (wrongOwner) expect(h.conv.sessionData).toEqual(before);
    else {
      expect((await h.agent.mock.results[0].value).error).toBeUndefined();
      expect(h.conv.sessionData.cart.find(row => row.productId === 54301)?.attributes).toEqual(before.cart[1 - owner].attributes);
      expect(h.conv.sessionData.cart.find(row => row.productId === 54303)?.attributes).toEqual(before.cart[owner].attributes);
    }
  });
}

for (const values of [['Agua Fría', 'Agua Caliente'], ['Sin Bebida', 'Con Bebida']]) {
  it(`a shared shortened option cannot choose a replacement variant ${values.join('/')}`, async () => {
    const h = setup(catalogues[0]);
    h.menu[0].attributes = [{ attributeName: 'Bebida', options: values }];
    h.menu.push({ ...h.menu[0], id: 54303, code: 3, name: 'Combo De Pollo Broaster' });
    const original = structuredClone(h.conv.sessionData.cart[0]);
    h.conv.sessionData.cart = values.map(value => ({ ...structuredClone(original), attributes: [{ attributeName: 'Bebida', attributeValue: value }] }));
    const before = structuredClone(h.conv.sessionData);
    const edit = `El de ${values[0].startsWith('Agua') ? 'agua' : 'bebida'} cámbialo por Combo De Pollo Broaster`;
    const buy = `y agrega una ${catalogues[0][1]}`;
    plan(edit, buy, [
      { name: 'search_menu', args: { query: 'Combo De Pollo Broaster', sourceText: edit } },
      { name: 'replace_item', args: { productId: 54301, newProductId: 54303, cartLineIndex: 0,
        targetText: 'Combo De Pollo Broaster', quantity: 4, sourceText: edit } },
      { name: 'add_item', args: { productId: 54302, quantity: 1, sourceText: buy } },
    ]);
    await h.sendQueued(`${edit} ${buy}`);
    expect(h.conv.sessionData).toEqual(before);
  });
}
