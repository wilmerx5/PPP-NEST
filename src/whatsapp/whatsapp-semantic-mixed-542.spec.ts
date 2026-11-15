import { harness } from './whatsapp-accuracy.test-support';
import { WhatsappAgentService } from './whatsapp-agent.service';
import type { WhatsappCatalogProduct } from './whatsapp-catalog.service';
import { parseSemanticIntent } from './whatsapp-semantic-intent';

const families = [
  ['Ejecutivo Con Pollo Frito', 'Ejecutivo Con Pollo Broaster', 'Sopa De Ajiaco', 'Sopa De Menudencias', 'Limonada Natural', 'Porción De Papa Francesa'],
  ['Lasaña Vegetal', 'Lasaña De Hongos', 'Crema De Tomate', 'Crema De Calabaza', 'Jugo De Mango', 'Pan De Ajo'],
];
const states = ['building_cart', 'awaiting_payment', 'awaiting_final_confirm'];

type ToolCall = { name: string; args: Record<string, unknown> };
type Segment = { text: string; role: string; productIds: number[] };

function response(calls: ToolCall[] = [], content = '') {
  return new Response(JSON.stringify({ choices: [{ message: {
    content,
    ...(calls.length ? { tool_calls: calls.map((call, index) => ({
      id: `tool-${index}-${call.name}`, type: 'function',
      function: { name: call.name, arguments: JSON.stringify(call.args) },
    })) } : {}),
  } }] }), { status: 200 });
}

function plan(segments: Segment[], calls: ToolCall[], reply = '') {
  jest.spyOn(global, 'fetch')
    .mockRejectedValue(new Error('Unexpected network request in isolated model fixture'))
    .mockResolvedValueOnce(response([{ name: 'interpret_message', args: { segments } }]))
    .mockResolvedValueOnce(response(calls))
    .mockResolvedValueOnce(response([], reply));
}

function setup(names: string[], state = 'building_cart') {
  const menu: WhatsappCatalogProduct[] = names.map((name, index) => ({
    id: 54201 + index, code: 11 + index, name, price: [24000, 25000, 12000, 13000, 5000, 8000][index],
    availableNow: true, hasAttributes: false, attributes: [],
  }));
  menu.push({id:54207,code:17,name:names[0].includes('Pollo') ? '1 Pollo Broaster' : 'Pizza De Hongos',
    price:46000,availableNow:true,hasAttributes:false,attributes:[]});
  const h = harness(menu, true);
  h.conv.state = state;
  h.service.settingsService.semanticRoutingEnabled = () => true;
  h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
  h.service.conversationService.saveSemanticSession = jest.fn(async (_conv, expected, session, nextState, name) => {
    if (h.conv.state !== expected.state || JSON.stringify(h.conv.sessionData) !== JSON.stringify(expected.session)) return false;
    h.conv.sessionData = structuredClone(session);
    h.conv.state = nextState;
    if (name) h.conv.customerName = name;
    return true;
  });
  Object.assign(h.conv.sessionData, {
    fulfillmentChosen: true, phoneConfirmed: true, contactPhone: h.conv.phoneE164, notesCollected: true,
    ...(state === 'awaiting_final_confirm' ? { paymentMethod: 'contraentrega' } : {}),
  });
  h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 542, dailyOrderNumber: 542 });
  h.service.agentService = new WhatsappAgentService({ getEffectiveConfig: async () => ({
    ...h.cfg, openaiApiKey: 'synthetic-offline-key', openaiModel: 'gpt-4o-mini',
    systemPrompt: 'Atiende usando el catálogo y conserva la intención completa.', aiTemperature: 0.2,
  }) } as never, h.service.catalogService);
  const agent = jest.spyOn(h.service.agentService, 'runTurn');
  const line = (index: number, quantity = 1, note?: string) => ({
    productId: menu[index].id, code: menu[index].code, name: menu[index].name,
    quantity, unitPrice: menu[index].price, attributes: [], ...(note ? { note } : {}),
  });
  return { ...h, menu, agent, line };
}

afterEach(() => jest.restoreAllMocks());

for (const names of families) for (const state of states) for (const reverse of [false, true]) {
  it(`removes several original lines and buys once ${names[0]} ${state} ${reverse}`, async () => {
    const h = setup(names, state);
    h.conv.sessionData.cart = [h.line(0), h.line(2), h.line(3), h.line(4)];
    const remove = `Quita ${names[0]} y ${names[4]}`;
    const add = `y agrégame una ${names[5]}`;
    const calls: ToolCall[] = [
      { name: 'remove_item', args: { productId: 54201, cartLineIndex: 0, sourceText: remove } },
      { name: 'remove_item', args: { productId: 54205, cartLineIndex: 3, sourceText: remove } },
      { name: 'add_item', args: { productId: 54206, quantity: 1, sourceText: add } },
    ];
    plan([{ text: remove, role: 'remove', productIds: [54201, 54205] },
      { text: add, role: 'purchase', productIds: [54206] }], reverse ? calls.reverse() : calls);
    const reply = await h.sendQueued(`${remove} ${add}`);
    expect((await h.agent.mock.results[0].value).error).toBeUndefined();
    expect(h.conv.sessionData.cart).toEqual([h.line(2), h.line(3), h.line(5)]);
    expect(reply).toContain(names[5]);
    expect(reply).not.toMatch(/aclaras|no (?:tenemos|manejamos)/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it(`edits two quantities and a note while adding a new item ${names[0]} ${state} ${reverse}`, async () => {
    const h = setup(names, state);
    h.conv.sessionData.cart = [h.line(0, 3, 'Bien empacado'), h.line(2, 2), h.line(3)];
    const editMain = `De ${names[0]} deja dos sin arroz y más ensalada`;
    const editSoup = `de ${names[2]} deja una`;
    const add = `y agrega una ${names[4]}`;
    const calls: ToolCall[] = [
      { name: 'update_item', args: { productId: 54201, cartLineIndex: 0, quantity: 2,
        note: 'Bien empacado, sin arroz, más ensalada', sourceText: editMain } },
      { name: 'update_item', args: { productId: 54203, cartLineIndex: 1, quantity: 1, sourceText: editSoup } },
      { name: 'add_item', args: { productId: 54205, quantity: 1, sourceText: add } },
    ];
    plan([{ text: editMain, role: 'edit', productIds: [54201] },
      { text: editSoup, role: 'edit', productIds: [54203] },
      { text: add, role: 'purchase', productIds: [54205] }], reverse ? calls.reverse() : calls);
    await h.sendQueued(`${editMain}, ${editSoup} ${add}`);
    expect((await h.agent.mock.results[0].value).error).toBeUndefined();
    expect(h.conv.sessionData.cart).toEqual([
      h.line(0, 2, 'Bien empacado, sin arroz, más ensalada'), h.line(2), h.line(3), h.line(4),
    ]);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

  it(`replaces an existing product and adds an unrelated purchase ${names[0]} ${state} ${reverse}`, async () => {
    const h = setup(names, state);
    h.conv.sessionData.cart = [h.line(0, 2, 'Salsa aparte'), h.line(2)];
    const edit = `Cambia los dos ${names[0]} por ${names[1]}`;
    const add = `y agrega una ${names[5]}`;
    const calls: ToolCall[] = [
      { name: 'replace_item', args: { productId: 54201, newProductId: 54202, cartLineIndex: 0, sourceText: edit } },
      { name: 'add_item', args: { productId: 54206, quantity: 1, sourceText: add } },
    ];
    plan([{ text: edit, role: 'edit', productIds: [54201, 54202] },
      { text: add, role: 'purchase', productIds: [54206] }], reverse ? calls.reverse() : calls);
    await h.sendQueued(`${edit} ${add}`);
    expect((await h.agent.mock.results[0].value).error).toBeUndefined();
    expect(h.conv.sessionData.cart).toEqual(expect.arrayContaining([h.line(1, 2, 'Salsa aparte'), h.line(2), h.line(5)]));
    expect(h.conv.sessionData.cart).toHaveLength(3);
  });
}

for (const names of families) for (const state of states) {
  it(`a soup-only correction retires unwanted products ${names[0]} ${state}`, async () => {
    const h = setup(names, state);
    h.conv.sessionData.cart = [h.line(0), h.line(2), h.line(3)];
    const keep = 'Solo quiero las dos sopas';
    const remove = `el ${names[0]} no`;
    plan([{ text: keep, role: 'conversation', productIds: [54203, 54204] },
      { text: remove, role: 'remove', productIds: [54201] }], [
      { name: 'remove_item', args: { productId: 54201, cartLineIndex: 0, sourceText: remove } },
    ]);
    const reply = await h.sendQueued(`${keep}, ${remove}`);
    expect((await h.agent.mock.results[0].value).error).toBeUndefined();
    expect(h.conv.sessionData.cart).toEqual([h.line(2), h.line(3)]);
    expect(reply).toContain(names[2]); expect(reply).toContain(names[3]);
    expect(h.conv.customerName).toBe('Wilmer');
  });

  it(`a query interrupting a mixed edit never repeats the purchase ${names[0]} ${state}`, async () => {
    const h = setup(names, state);
    h.conv.sessionData.cart = [h.line(0), h.line(2)];
    const remove = `La ${names[2]} ya no la quiero`;
    const add = `y súmale una ${names[4]}`;
    plan([{ text: remove, role: 'remove', productIds: [54203] },
      { text: add, role: 'purchase', productIds: [54205] }], [
      { name: 'remove_item', args: { productId: 54203, cartLineIndex: 1, sourceText: remove } },
      { name: 'add_item', args: { productId: 54205, quantity: 1, sourceText: add } },
    ]);
    await h.sendQueued(`${remove} ${add}`);
    const before = structuredClone(h.conv.sessionData.cart);
    const query = `¿Qué trae ${names[0]}? Solo estoy preguntando`;
    plan([{ text: query, role: 'inquiry', productIds: [54201] }], [
      { name: 'search_menu', args: { query: names[0], sourceText: query } },
    ], `${names[0]} conserva la presentación de la carta. ¿Algo más?`);
    const reply = await h.sendQueued(query);
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(reply).not.toMatch(/agregué|aclaras/i);
    await h.sendQueued('no');
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.conv.customerName).toBe('Wilmer');
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
}

for (const names of families) for (const fault of ['unknown destination', 'unavailable destination', 'negated destination', 'invalid option']) {
  it(`rejects the complete mixed plan for ${fault} ${names[0]}`, async () => {
    const h = setup(names);
    h.conv.sessionData.cart = [h.line(0, 2, 'Salsa aparte'), h.line(2)];
    const original = structuredClone(h.conv.sessionData);
    let destination = names[1];
    if (fault === 'unknown destination') destination = `${names[1]} con caviar`;
    if (fault === 'negated destination') destination = `no quiero ${names[1]}`;
    if (fault === 'unavailable destination') h.menu[1].availableNow = false;
    const edit = `Cambia ${names[0]} por ${destination}`;
    const add = `y agrega una ${names[5]}`;
    plan([{ text: edit, role: 'edit', productIds: [54201, 54202] },
      { text: add, role: 'purchase', productIds: [54206] }], [
      { name: 'replace_item', args: { productId: 54201, newProductId: 54202, cartLineIndex: 0,
        sourceText: edit, ...(fault === 'invalid option' ? { attributes: [{ attributeName: 'Sabor', attributeValue: 'Inventado' }] } : {}) } },
      { name: 'add_item', args: { productId: 54206, quantity: 1, sourceText: add } },
    ]);
    const reply = await h.sendQueued(`${edit} ${add}`);
    expect(h.conv.sessionData).toEqual(original);
    expect(reply).toMatch(/aclaras/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
}

for (const names of families) for (const state of states) {
  it(`edits the selected preparation variant and preserves the other line ${names[0]} ${state}`, async () => {
    const h = setup(names, state);
    const attributes = [{ attributeName: 'Presa', options: ['Pierna Pernil', 'Pechuga'] },
      { attributeName: 'Bebida', options: ['Limonada', 'Colombiana', 'Coca Cola'] }];
    h.menu[0].hasAttributes = h.menu[1].hasAttributes = true;
    h.menu[0].attributes = h.menu[1].attributes = attributes;
    const pierna = { ...h.line(0), attributes: [{ attributeName: 'Presa', attributeValue: 'Pierna Pernil' },
      { attributeName: 'Bebida', attributeValue: 'Limonada' }], note: 'Poca azúcar' };
    const pechuga = { ...h.line(0), attributes: [{ attributeName: 'Presa', attributeValue: 'Pechuga' },
      { attributeName: 'Bebida', attributeValue: 'Coca Cola' }], note: 'Bebida sin hielo' };
    h.conv.sessionData.cart = [pierna, pechuga, h.line(2)];
    const edit = `Cambia ${names[0]} de pechuga por ${names[1]}`;
    const add = `y agrega una ${names[5]}`;
    plan([{ text: edit, role: 'edit', productIds: [54201, 54202] },
      { text: add, role: 'purchase', productIds: [54206] }], [
      { name: 'replace_item', args: { productId: 54201, newProductId: 54202, cartLineIndex: 1,
        attributes: pechuga.attributes, sourceText: edit } },
      { name: 'add_item', args: { productId: 54206, quantity: 1, sourceText: add } },
    ]);
    await h.sendQueued(`${edit} ${add}`);
    expect((await h.agent.mock.results[0].value).error).toBeUndefined();
    expect(h.conv.sessionData.cart).toEqual(expect.arrayContaining([
      pierna, { ...h.line(1), attributes: pechuga.attributes, note: pechuga.note }, h.line(2), h.line(5),
    ]));
    expect(h.conv.sessionData.cart).toHaveLength(4);
  });

  it(`a beverage inquiry preserves a grouped line and an explicit change affects both units ${names[0]} ${state}`, async () => {
    const h = setup(names, state);
    h.menu[0].hasAttributes = true;
    h.menu[0].attributes = [{ attributeName: 'Bebida', options: ['Colombiana', 'Coca Cola', 'Pepsi'] }];
    const original = { ...h.line(0, 2, 'Arepas fritas'), attributes: [{ attributeName: 'Bebida', attributeValue: 'Colombiana' }] };
    h.conv.sessionData.cart = [original, h.line(2)];
    const inquiry = '¿Qué otro sabor de gaseosa tienes?';
    plan([{ text: inquiry, role: 'inquiry', productIds: [54201] }], [
      { name: 'search_menu', args: { query: names[0], sourceText: inquiry } },
    ], 'Puedes elegir Colombiana, Coca Cola o Pepsi. ¿Cuál prefieres?');
    await h.sendQueued(inquiry);
    expect(h.conv.sessionData.cart).toEqual([original, h.line(2)]);
    const change = `Quiero Coca Cola para cada ${names[0]}`;
    plan([{ text: change, role: 'edit', productIds: [54201] }], [
      { name: 'set_attribute', args: { productId: 54201, cartLineIndex: 0, attributeName: 'Bebida',
        attributeValue: 'Coca Cola', sourceText: change } },
    ]);
    await h.sendQueued(change);
    expect((await h.agent.mock.results[1].value).error).toBeUndefined();
    expect(h.conv.sessionData.cart).toEqual([
      { ...original, attributes: [{ attributeName: 'Bebida', attributeValue: 'Coca Cola' }] }, h.line(2),
    ]);
  });
}

for (const state of states) for (const toCombo of [false, true]) {
  it(`uses the requested paired product in a mixed purchase ${state} combo=${toCombo}`, async () => {
    const names = ['1 Pollo Broaster', 'Combo De Pollo Broaster', 'Sopa De Ajiaco', 'Sopa De Menudencias', 'Limonada Natural', 'Porción De Papa Francesa'];
    const h = setup(names, state);
    const sourceIndex = toCombo ? 0 : 1;
    const targetIndex = toCombo ? 1 : 0;
    h.conv.sessionData.cart = [h.line(sourceIndex, 2, 'Salsa aparte'), h.line(2)];
    const edit = `Cambia ${names[sourceIndex]} por ${names[targetIndex]}${toCombo ? '' : ' sin combo'}`;
    const add = `y agrega una ${names[4]}`;
    plan([{ text: edit, role: 'edit', productIds: [54201, 54202] },
      { text: add, role: 'purchase', productIds: [54205] }], [
      { name: 'replace_item', args: { productId: h.menu[sourceIndex].id, newProductId: h.menu[targetIndex].id,
        cartLineIndex: 0, sourceText: edit } },
      { name: 'add_item', args: { productId: 54205, quantity: 1, sourceText: add } },
    ]);
    await h.sendQueued(`${edit} ${add}`);
    expect((await h.agent.mock.results[0].value).error).toBeUndefined();
    expect(h.conv.sessionData.cart).toEqual(expect.arrayContaining([
      { ...h.line(targetIndex, 2), note: expect.stringContaining('Salsa aparte') }, h.line(2), h.line(4),
    ]));
    expect(h.conv.sessionData.cart).toHaveLength(3);
  });
}

for (const names of families) for (const choice of ['omitted', 'invented', 'explicit']) {
  it(`replacement carries compatible options when a choice is ${choice} ${names[0]}`, async () => {
    const h = setup(names);
    const definitions = [{ attributeName: 'Bebida', options: ['Colombiana', 'Coca Cola', 'Limonada'] }];
    h.menu[0].hasAttributes = h.menu[1].hasAttributes = true;
    h.menu[0].attributes = h.menu[1].attributes = definitions;
    const original = { ...h.line(0, 2, 'Sin hielo'), attributes: [{ attributeName: 'Bebida', attributeValue: 'Coca Cola' }] };
    h.conv.sessionData.cart = [original, h.line(2)];
    const edit = `Cambia ${names[0]} por ${names[1]}${choice === 'explicit' ? ' con Limonada' : ''}`;
    plan([{ text: edit, role: 'edit', productIds: [54201, 54202] }], [
      { name: 'replace_item', args: { productId: 54201, newProductId: 54202, cartLineIndex: 0,
        sourceText: edit, ...(choice !== 'omitted' ? { attributes: [{ attributeName: 'Bebida', attributeValue: 'Limonada' }] } : {}) } },
    ]);
    await h.sendQueued(edit);
    expect((await h.agent.mock.results[0].value).error).toBeUndefined();
    expect(h.conv.sessionData.cart).toEqual(expect.arrayContaining([
      { ...h.line(1, 2, 'Sin hielo'), attributes: [{ attributeName: 'Bebida', attributeValue: choice === 'explicit' ? 'Limonada' : 'Coca Cola' }] },
      h.line(2),
    ]));
    expect(h.conv.sessionData.cart).toHaveLength(2);
  });
}

for (const names of families) {
  it(`accepting an offered item and a later courtesy creates one line ${names[0]}`, async () => {
    const h = setup(names);
    h.conv.sessionData.pendingAddOffer = { productId: 54201, name: names[0], code: 11,
      price: 24000, quantity: 1, sourceText: names[0] };
    const text = 'Sí, por favor, con salsa aparte';
    plan([{ text, role: 'purchase', productIds: [54201] }], [
      { name: 'add_item', args: { productId: 54201, quantity: 1, note: 'Salsa aparte', sourceText: text } },
    ]);
    await h.sendQueued(text);
    expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({
      ...h.line(0), note: expect.stringContaining('salsa aparte'),
    })]);
    const before = structuredClone(h.conv.sessionData.cart);
    expect(h.conv.sessionData.pendingAddOffer).toBeUndefined();
    const courtesy = 'Por favor';
    plan([{ text: courtesy, role: 'conversation', productIds: [] }], [
      { name: 'get_cart', args: {} },
    ], 'Con gusto. ¿Algo más?');
    const reply = await h.sendQueued(courtesy);
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(reply).toContain('Con gusto');
    expect(h.conv.sessionData.pendingAddOffer).toBeUndefined();
  });
}

for (const names of families) for (const searchedFirst of [false, true]) {
  it(`a replacement destination is bound to its own verified lookup ${names[0]} searched=${searchedFirst}`, async () => {
    const h = setup(names);
    h.conv.sessionData.cart = [h.line(0, 2, 'Salsa aparte'), h.line(2)];
    const before = structuredClone(h.conv.sessionData);
    const text = `Cambia ${names[0]} por ${names[1]}`;
    const search: ToolCall = { name: 'search_menu', args: { query: names[1], sourceText: text } };
    const replace: ToolCall = { name: 'replace_item', args: { productId: 54201, newProductId: 54202,
      cartLineIndex: 0, sourceText: text } };
    plan([{ text, role: 'edit', productIds: [54201] }], searchedFirst ? [search, replace] : [replace, search]);
    const reply = await h.sendQueued(text);
    if (searchedFirst) {
      expect((await h.agent.mock.results[0].value).error).toBeUndefined();
      expect(h.conv.sessionData.cart).toEqual(expect.arrayContaining([h.line(1, 2, 'Salsa aparte'), h.line(2)]));
      expect(h.conv.sessionData.cart).toHaveLength(2);
    } else {
      expect(h.conv.sessionData).toEqual(before);
      expect(reply).toMatch(/aclaras/i);
    }
  });
}

it('a lookup for an inquiry cannot authorize a destination in a different edit clause', async () => {
  const h = setup(families[1]);
  h.conv.sessionData.cart = [h.line(0), h.line(2)];
  const before = structuredClone(h.conv.sessionData);
  const query = `Cuánto vale ${families[1][1]}`;
  const edit = 'y cambia la lasaña';
  plan([{ text: query, role: 'inquiry', productIds: [] },
    { text: edit, role: 'edit', productIds: [54201] }], [
    { name: 'search_menu', args: { query: families[1][1], sourceText: query } },
    { name: 'replace_item', args: { productId: 54201, newProductId: 54202, cartLineIndex: 0, sourceText: edit } },
  ]);
  await h.sendQueued(`${query} ${edit}`);
  expect((await h.agent.mock.results[0].value).error).toBe('semantic_contract_rejected');
  expect(h.conv.sessionData).toEqual(before);
});

for (const gap of [' y ', ', y ', ' e ']) {
  it(`an additive separator between complete clauses preserves both operations ${JSON.stringify(gap)}`, async () => {
    const h = setup(families[1]);
    h.conv.sessionData.cart = [h.line(0)];
    const edit = `Cambia ${families[1][0]} por ${families[1][1]}`;
    const add = `agrega una ${families[1][4]}`;
    plan([{ text: edit, role: 'edit', productIds: [54201, 54202] },
      { text: add, role: 'purchase', productIds: [54205] }], [
      { name: 'replace_item', args: { productId: 54201, newProductId: 54202, cartLineIndex: 0, sourceText: edit } },
      { name: 'add_item', args: { productId: 54205, quantity: 1, sourceText: add } },
    ]);
    await h.sendQueued(`${edit}${gap}${add}`);
    expect((await h.agent.mock.results[0].value).error).toBeUndefined();
    expect(h.conv.sessionData.cart).toEqual([h.line(1), h.line(4)]);
  });
}

for (const gap of [' o ', ' y no ', ' y sin ', ' y dos ', ' pero ']) {
  it(`a missing meaningful connector or preference is rejected ${JSON.stringify(gap)}`, () => {
    expect(parseSemanticIntent({ segments: [
      { text: 'una sopa', role: 'purchase', productIds: [54203] },
      { text: 'un jugo', role: 'purchase', productIds: [54205] },
    ] }, `una sopa${gap}un jugo`)).toBeNull();
  });
}

const completeCorrections = [
  (owner: string, destination: string) => `El que tiene ${owner} cámbiamelo a ${destination}`,
  (owner: string, destination: string) => `Por favor, el de ${owner} me lo cambias por ${destination}`,
  (owner: string, destination: string) => `Veci, pásame el de ${owner} a ${destination}`,
  (owner: string, destination: string) => `Quisiera que el de ${owner} quedara como ${destination}`,
  (owner: string, destination: string) => `Lo que quiero es que el de ${owner} sea ${destination}`,
  (owner: string, destination: string) => `Para aclarar el pedido, el de ${owner} lo quiero ${destination}`,
  (owner: string, destination: string) => `De los que ya están, el de ${owner} ponlo en ${destination}`,
  (owner: string, destination: string) => `Hagamos este cambio, el que lleva ${owner} ahora va ${destination}`,
];

for (const [familyIndex, names] of families.entries()) for (const state of states) {
  for (const [phraseIndex, phrase] of completeCorrections.entries()) for (const changedQuantity of [1, 2]) {
    for (const newQuantity of [1, 2]) for (const buyFirst of [false, true]) {
      it(`complete mixed conversation ${familyIndex}/${state}/phrase${phraseIndex}/existing${changedQuantity}/new${newQuantity}/buyFirst${buyFirst}`, async () => {
        const h = setup(names, state);
        const attributeName = familyIndex === 0 ? 'Presa' : 'Tamaño';
        const options = familyIndex === 0 ? ['Pierna Pernil', 'Ala pechuga'] : ['Individual', 'Familiar'];
        const owner = options[1];
        const definitions = [{ attributeName, options },
          { attributeName: 'Bebida', options: ['Colombiana', 'Coca Cola', 'Limonada'] }];
        h.menu[0].hasAttributes = h.menu[1].hasAttributes = true;
        h.menu[0].attributes = h.menu[1].attributes = definitions;
        h.menu[1].description = 'Acompañado de ensalada y una bebida de la carta.';
        const unchanged = { ...h.line(0, 1, 'Poca azúcar'), attributes: [
          { attributeName, attributeValue: options[0] }, { attributeName: 'Bebida', attributeValue: 'Limonada' },
        ] };
        const selected = { ...h.line(0, changedQuantity, 'Bebida sin hielo'), attributes: [
          { attributeName, attributeValue: owner }, { attributeName: 'Bebida', attributeValue: 'Coca Cola' },
        ] };
        h.conv.sessionData.cart = [unchanged, selected, h.line(2)];
        h.conv.sessionData.address = 'Calle 10 #20-30, torre 2 apto 302';
        const contact = { name: h.conv.customerName, phone: h.conv.sessionData.contactPhone,
          address: h.conv.sessionData.address, payment: h.conv.sessionData.paymentMethod };
        const destination = phraseIndex % 2 === 0 ? names[1] : familyIndex === 0 ? 'broaster' : 'de hongos';
        const edit = phrase(owner, destination);
        const add = `y agrega ${newQuantity === 1 ? 'una' : 'dos'} ${names[4]}`;
        const message = `${edit}, ${add}.`;
        const replacement: ToolCall = { name: 'replace_item', args: { productId: 54201, newProductId: 54202,
          cartLineIndex: 1, targetText: destination, sourceText: phraseIndex % 2 ? message : edit } };
        const purchase: ToolCall = { name: 'add_item', args: { productId: 54205, quantity: newQuantity,
          sourceText: phraseIndex % 3 === 0 ? message : add } };
        plan([{ text: edit, role: 'edit', productIds: [54201] },
          { text: add, role: 'purchase', productIds: [54205] }], [
          { name: 'search_menu', args: { query: names[1], sourceText: edit } },
          ...(buyFirst ? [purchase, replacement] : [replacement, purchase]),
        ]);
        const updated = await h.sendQueued(message);
        expect((await h.agent.mock.results[0].value).error).toBeUndefined();
        expect(h.conv.sessionData.cart).toEqual(expect.arrayContaining([
          unchanged, { ...h.line(1, changedQuantity, selected.note), attributes: selected.attributes },
          h.line(2), h.line(4, newQuantity),
        ]));
        expect(h.conv.sessionData.cart).toHaveLength(4);
        expect(updated).toContain(names[1]);
        expect(updated).not.toMatch(/aclaras|no (?:tenemos|manejamos)/i);
        const beforeQuery = structuredClone(h.conv.sessionData.cart);
        const query = `¿Me cuentas qué trae ${names[1]}? Solo quiero saber, no agregues otro.`;
        plan([{ text: query, role: 'inquiry', productIds: [54202] }], [
          { name: 'search_menu', args: { query: names[1], sourceText: query } },
        ], `${names[1]} viene con ensalada y una bebida de la carta. ¿Algo más?`);
        const detail = await h.sendQueued(query);
        expect(detail).toContain('ensalada');
        expect(h.conv.sessionData.cart).toEqual(beforeQuery);
        await h.sendQueued('no');
        expect(h.conv.sessionData.cart).toEqual(beforeQuery);
        expect(h.conv.state).toBe(state === 'awaiting_final_confirm' ? 'awaiting_final_confirm' : 'awaiting_payment');
        expect({ name: h.conv.customerName, phone: h.conv.sessionData.contactPhone,
          address: h.conv.sessionData.address, payment: h.conv.sessionData.paymentMethod }).toEqual(contact);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
      });
    }
  }
}

for (const evidence of ['', 'nombre inventado', 'aster', 18]) {
  it(`an invalid destination quote cannot change the cart ${JSON.stringify(evidence)}`, async () => {
    const h = setup(families[0]);
    h.conv.sessionData.cart = [h.line(0)];
    const before = structuredClone(h.conv.sessionData);
    const text = 'Cámbialo a broaster';
    plan([{ text, role: 'edit', productIds: [54201, 54202] }], [
      { name: 'replace_item', args: { productId: 54201, newProductId: 54202, cartLineIndex: 0,
        targetText: evidence, sourceText: text } },
    ]);
    await h.sendQueued(text);
    expect(h.conv.sessionData).toEqual(before);
  });
}

it('preferences after the quoted destination remain part of validation', async () => {
  const h = setup(families[1]);
  h.conv.sessionData.cart = [h.line(0)];
  const before = structuredClone(h.conv.sessionData);
  const text = 'Cámbialo a Lasaña De Hongos con caviar';
  plan([{ text, role: 'edit', productIds: [54201, 54202] }], [
    { name: 'replace_item', args: { productId: 54201, newProductId: 54202, cartLineIndex: 0,
      targetText: 'Lasaña De Hongos', sourceText: text } },
  ]);
  await h.sendQueued(text);
  expect(h.conv.sessionData).toEqual(before);
});

it('the recorded executive correction keeps the piece, soup and beverage with a short destination quote', async () => {
  const h = setup(families[0]);
  const definitions = [{ attributeName: 'Presa', options: ['Pierna Pernil', 'Ala pechuga'] },
    { attributeName: 'Sopa', options: ['Ajiaco', 'Menudencias'] },
    { attributeName: 'Bebida', options: ['Limonada', 'Colombiana', 'Coca Cola'] }];
  h.menu[0].hasAttributes = h.menu[1].hasAttributes = true;
  h.menu[0].attributes = h.menu[1].attributes = definitions;
  const pierna = { ...h.line(0, 1, 'Poca azúcar'), attributes: [
    { attributeName: 'Presa', attributeValue: 'Pierna Pernil' }, { attributeName: 'Sopa', attributeValue: 'Ajiaco' },
    { attributeName: 'Bebida', attributeValue: 'Limonada' },
  ] };
  const pechuga = { ...h.line(0, 1, 'Bebida sin hielo'), attributes: [
    { attributeName: 'Presa', attributeValue: 'Ala pechuga' }, { attributeName: 'Sopa', attributeValue: 'Ajiaco' },
    { attributeName: 'Bebida', attributeValue: 'Coca Cola' },
  ] };
  h.conv.sessionData.cart = [pierna, pechuga, h.line(3)];
  const edit = 'El ejecutivo que tiene ala pechuga cámbiamelo a broaster';
  const add = 'agrégame una limonada';
  plan([{ text: edit, role: 'edit', productIds: [54201] },
    { text: add, role: 'purchase', productIds: [54205] }], [
    { name: 'get_cart', args: {} },
    { name: 'search_menu', args: { query: families[0][1], sourceText: edit } },
    { name: 'replace_item', args: { productId: 54201, newProductId: 54202, cartLineIndex: 1,
      targetText: 'a broaster', attributes: pechuga.attributes, note: pechuga.note, sourceText: edit } },
    { name: 'add_item', args: { productId: 54205, quantity: 1, sourceText: add } },
  ]);
  await h.sendQueued(`${edit} y ${add}.`);
  expect((await h.agent.mock.results[0].value).error).toBeUndefined();
  expect(h.conv.sessionData.cart).toEqual(expect.arrayContaining([
    pierna, { ...h.line(1, 1, pechuga.note), attributes: pechuga.attributes }, h.line(3), h.line(4),
  ]));
  expect(h.conv.sessionData.cart).toHaveLength(4);
});

for (const preference of ['sin combo', 'asado']) {
  it(`resolved catalog identity still enforces the actual destination preference ${preference}`, async () => {
    const h = setup(families[0]);
    if (preference === 'sin combo') h.menu[1].name = 'Combo De Pollo Broaster';
    h.conv.sessionData.cart = [h.line(0)];
    const before = structuredClone(h.conv.sessionData);
    const text = preference === 'sin combo' ? 'Cámbialo a broaster sin combo' : 'Cámbialo a asado';
    plan([{ text, role: 'edit', productIds: [54201, 54202] }], [
      { name: 'replace_item', args: { productId: 54201, newProductId: 54202, cartLineIndex: 0,
        targetText: preference === 'sin combo' ? 'a broaster' : 'a asado', sourceText: text } },
    ]);
    await h.sendQueued(text);
    expect(h.conv.sessionData).toEqual(before);
  });
}

it('an ambiguous whole-message citation cannot choose between edits of the same SKU', async () => {
  const h = setup(families[1]);
  h.conv.sessionData.cart = [h.line(0, 1, 'Sin sal'), h.line(0, 1, 'Sin queso')];
  const before = structuredClone(h.conv.sessionData);
  const first = `Cambia ${families[1][0]} sin sal por ${families[1][1]}`;
  const second = `y cambia ${families[1][0]} sin queso por ${families[1][1]}`;
  const message = `${first} ${second}`;
  plan([{ text: first, role: 'edit', productIds: [54201, 54202] },
    { text: second, role: 'edit', productIds: [54201, 54202] }], [
    { name: 'replace_item', args: { productId: 54201, newProductId: 54202, cartLineIndex: 0,
      targetText: families[1][1], sourceText: message } },
  ]);
  await h.sendQueued(message);
  expect((await h.agent.mock.results[0].value).error).toBe('semantic_contract_rejected');
  expect(h.conv.sessionData).toEqual(before);
});

for (const suppliedSource of ['Quiero agregar una bebida', 'agrega una limonada']) {
  it(`an unrelated or incomplete source cannot acquire whole-message authority ${suppliedSource}`, async () => {
    const h = setup(families[0]);
    h.conv.sessionData.cart = [h.line(0)];
    const before = structuredClone(h.conv.sessionData);
    const text = 'No agregues una limonada, estoy preguntando por ella';
    plan([{ text, role: 'inquiry', productIds: [54205] }], [
      { name: 'add_item', args: { productId: 54205, quantity: 1, sourceText: suppliedSource } },
    ]);
    await h.sendQueued(text);
    expect(h.conv.sessionData).toEqual(before);
  });
}

it('a complete seven-round edit reaches its final response before committing once', async () => {
  const h = setup(families[1]);
  h.conv.sessionData.cart = [h.line(0, 2), h.line(2)];
  const edit = `Cambia ${families[1][0]} por ${families[1][1]}`;
  const add = `y agrega una ${families[1][4]}`;
  const batches: ToolCall[][] = [
    [{ name: 'interpret_message', args: { segments: [{ text: edit, role: 'edit', productIds: [54201] },
      { text: add, role: 'purchase', productIds: [54205] }] } }],
    [{ name: 'get_cart', args: {} }],
    [{ name: 'search_menu', args: { query: families[1][1], sourceText: edit } }],
    [{ name: 'search_menu', args: { query: families[1][4], sourceText: add } }],
    [{ name: 'replace_item', args: { productId: 54201, newProductId: 54202, cartLineIndex: 0,
      targetText: families[1][1], sourceText: edit } }],
    [{ name: 'add_item', args: { productId: 54205, quantity: 1, sourceText: add } }],
  ];
  const fetchMock = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Unexpected extra model request'));
  for (const calls of batches) fetchMock.mockResolvedValueOnce(response(calls));
  fetchMock.mockResolvedValueOnce(response([], 'Listo'));
  await h.sendQueued(`${edit} ${add}`);
  expect((await h.agent.mock.results[0].value).error).toBeUndefined();
  expect(fetchMock).toHaveBeenCalledTimes(7);
  expect(h.conv.sessionData.cart).toEqual(expect.arrayContaining([h.line(1, 2), h.line(2), h.line(4)]));
  expect(h.conv.sessionData.cart).toHaveLength(3);
  expect(h.service.conversationService.saveSemanticSession).toHaveBeenCalledTimes(1);
});

it('the expanded semantic protocol still stops without partial changes at its iteration limit', async () => {
  const h = setup(families[1]);
  h.conv.sessionData.cart = [h.line(0)];
  const before = structuredClone(h.conv.sessionData);
  const text = 'Quiero revisar el pedido';
  const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async () => response([{ name: 'get_cart', args: {} }]));
  fetchMock.mockResolvedValueOnce(response([{ name: 'interpret_message', args: {
    segments: [{ text, role: 'inquiry', productIds: [54201] }],
  } }]));
  await h.sendQueued(text);
  expect(fetchMock).toHaveBeenCalledTimes(8);
  expect((await h.agent.mock.results[0].value).error).toBeDefined();
  expect(h.conv.sessionData).toEqual(before);
});

it('a preservation clause is explicitly verified before a mixed correction commits', async () => {
  const h = setup(families[1]);
  h.conv.sessionData.cart = [h.line(0), h.line(2), h.line(3), h.line(4)];
  const before = structuredClone(h.conv.sessionData.cart);
  const keep = 'Solo déjame las dos sopas';
  const remove = `quita ${families[1][0]} y ${families[1][4]}`;
  const add = `y agrega una ${families[1][5]}`;
  const outputs = [
    response([{ name: 'interpret_message', args: { segments: [
      { text: keep, role: 'edit', productIds: [54203, 54204] },
      { text: remove, role: 'remove', productIds: [54201, 54205] },
      { text: add, role: 'purchase', productIds: [54206] },
    ] } }]),
    response([
      { name: 'remove_item', args: { productId: 54201, cartLineIndex: 0, sourceText: remove } },
      { name: 'remove_item', args: { productId: 54205, cartLineIndex: 3, sourceText: remove } },
      { name: 'add_item', args: { productId: 54206, quantity: 1, sourceText: add } },
    ]),
    response([], 'Quedan las sopas y el acompañamiento'),
    response([
      { name: 'update_item', args: { productId: 54203, cartLineIndex: 1, quantity: 1, sourceText: keep } },
      { name: 'update_item', args: { productId: 54204, cartLineIndex: 2, quantity: 1, sourceText: keep } },
    ]),
    response([], 'Listo'),
  ];
  const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async () => {
    expect(h.conv.sessionData.cart).toEqual(before);
    const next = outputs.shift();
    if (!next) throw new Error('Unexpected extra request');
    return next;
  });
  await h.sendQueued(`${keep}, ${remove} ${add}`);
  expect((await h.agent.mock.results[0].value).error).toBeUndefined();
  expect(fetchMock).toHaveBeenCalledTimes(5);
  expect(h.conv.sessionData.cart).toEqual([h.line(2), h.line(3), h.line(5)]);
  expect(h.service.conversationService.saveSemanticSession).toHaveBeenCalledTimes(1);
});

it('preservation recovery is bounded and never credits an edit that is still missing', async () => {
  const h = setup(families[1]);
  h.conv.sessionData.cart = [h.line(0)];
  const before = structuredClone(h.conv.sessionData);
  const edit = `Cambia la nota de ${families[1][0]} a sin sal`;
  const add = `y agrega una ${families[1][4]}`;
  plan([{ text: edit, role: 'edit', productIds: [54201] },
    { text: add, role: 'purchase', productIds: [54205] }], [
    { name: 'add_item', args: { productId: 54205, quantity: 1, sourceText: add } },
  ], 'Listo');
  (global.fetch as jest.Mock).mockResolvedValueOnce(response([], 'Listo'));
  await h.sendQueued(`${edit} ${add}`);
  expect((await h.agent.mock.results[0].value).error).toBe('incomplete_semantic_plan');
  expect(global.fetch).toHaveBeenCalledTimes(4);
  expect(h.conv.sessionData).toEqual(before);
  expect(h.service.conversationService.saveSemanticSession).not.toHaveBeenCalled();
});

for (const state of states) for (const reverse of [false, true]) {
  it(`two sentences describing one composite-dish correction remain one edit ${state} ${reverse}`, async () => {
    const h = setup(families[0], state);
    Object.assign(h.menu[0], { name: 'Arroz Chino' });
    Object.assign(h.menu[2], { name: 'Costillas De Cerdo' });
    Object.assign(h.menu[1], { name: 'Arroz Chino Con Costillas De Cerdo' });
    h.conv.sessionData.cart = [h.line(0), h.line(2), h.line(3)];
    const text = 'Lo que quiero es un solo arroz chino con costillas de cerdo, sin gaseosa. Corrige esos dos productos para que quede ese plato.';
    const outputs = [
      response([{ name: 'interpret_message', args: { segments: [{ text, role: 'edit', productIds: [54201, 54203] }] } }]),
      response([{ name: 'search_menu', args: { query: 'arroz chino con costillas de cerdo', sourceText: text } }]),
      response((reverse ? [
        { name: 'remove_item', args: { productId: 54203, cartLineIndex: 1, sourceText: text } },
        { name: 'replace_item', args: { productId: 54201, newProductId: 54202, cartLineIndex: 0,
          targetText: 'arroz chino con costillas de cerdo, sin gaseosa', sourceText: text } },
      ] : [
        { name: 'replace_item', args: { productId: 54201, newProductId: 54202, cartLineIndex: 0,
          targetText: 'arroz chino con costillas de cerdo, sin gaseosa', sourceText: text } },
        { name: 'remove_item', args: { productId: 54203, cartLineIndex: 1, sourceText: text } },
      ])),
      response([], 'Listo'),
    ];
    jest.spyOn(global, 'fetch').mockImplementation(async () => {
      const next = outputs.shift();
      if (!next) throw new Error('Unexpected extra request');
      return next;
    });
    await h.sendQueued(text);
    expect((await h.agent.mock.results[0].value).error).toBeUndefined();
    expect(h.conv.sessionData.cart).toHaveLength(2);
    expect(h.conv.sessionData.cart).toEqual(expect.arrayContaining([h.line(3)]));
    expect(h.conv.sessionData.cart.find(line => line.productId === 54202)?.quantity).toBe(1);
    expect(h.conv.sessionData.cart.find(line => line.productId === 54202)?.note).toMatch(/sin gaseosa/i);
    expect(h.service.conversationService.saveSemanticSession).toHaveBeenCalledTimes(1);
  });
}
