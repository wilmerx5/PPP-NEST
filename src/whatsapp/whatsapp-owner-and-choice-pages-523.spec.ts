import { WhatsappAgentService } from './whatsapp-agent.service';
import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { harness } from './whatsapp-accuracy.test-support';

function setup(distinct = false) {
  const products = [
    {
      id: 5231,
      code: 11,
      name: 'Combo De Tofu',
      price: 22000,
      availableNow: true,
      hasAttributes: true,
      attributes: [
        {
          attributeName: 'Bebida',
          options: ['Colombiana', 'Manzana', 'Pepsi'],
        },
        { attributeName: 'Salsa', options: ['Suave', 'Picante'] },
      ],
    },
    {
      id: 5232,
      code: 12,
      name: 'Combo De Lentejas',
      price: 24000,
      availableNow: true,
      hasAttributes: true,
      attributes: [
        {
          attributeName: 'Bebida',
          options: ['Colombiana', 'Manzana', 'Pepsi'],
        },
        { attributeName: 'Salsa', options: ['Suave', 'Picante'] },
      ],
    },
  ];
  const h = harness(products, true);
  h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
  h.service.ordersService.create = jest
    .fn()
    .mockResolvedValue({ id: 523, dailyOrderNumber: 523 });
  h.service.ordersService.findTodayOrdersByPhone = jest
    .fn()
    .mockResolvedValue([]);
  Object.assign(h.conv.sessionData, {
    fulfillmentChosen: true,
    phoneConfirmed: true,
    contactPhone: h.conv.phoneE164,
    notesCollected: true,
    cart: [
      {
        productId: 5231,
        code: 11,
        name: products[0].name,
        unitPrice: 22000,
        quantity: 2,
        note: 'Sin cebolla',
        attributes: [
          { attributeName: 'Bebida', attributeValue: 'Colombiana' },
          { attributeName: 'Salsa', attributeValue: 'Suave' },
        ],
      },
      {
        productId: distinct ? 5232 : 5231,
        code: distinct ? 12 : 11,
        name: products[distinct ? 1 : 0].name,
        unitPrice: distinct ? 24000 : 22000,
        quantity: 1,
        note: 'Salsa aparte',
        attributes: [
          { attributeName: 'Bebida', attributeValue: 'Manzana' },
          { attributeName: 'Salsa', attributeValue: 'Picante' },
        ],
      },
    ],
  });
  const agent = new WhatsappAgentService(
    {
      getEffectiveConfig: async () => ({
        openaiApiKey: 'synthetic-key',
        openaiModel: 'gpt-4o-mini',
        systemPrompt: '',
        localContext: {},
      }),
    } as never,
    new WhatsappCatalogService({} as never),
  );
  h.agent.runTurn.mockImplementation((input) => agent.runTurn(input));
  return { h, agent, products };
}
const response = (message: object) =>
  new Response(JSON.stringify({ choices: [{ message }] }));
afterEach(() => jest.restoreAllMocks());

for (const distinct of [false, true])
  for (const index of [0, 1])
    test(`a model-supplied index needs owner evidence ${distinct} ${index}`, async () => {
      const { h, agent, products } = setup(distinct);
      let requests = 0;
      jest.spyOn(global, 'fetch').mockImplementation(async () => {
        requests++;
        return requests === 1
          ? response({
              content: null,
              tool_calls: [
                {
                  id: 'choice',
                  type: 'function',
                  function: {
                    name: 'set_attribute',
                    arguments: JSON.stringify({
                      productId: h.conv.sessionData.cart[index].productId,
                      cartLineIndex: index,
                      attributeName: 'Bebida',
                      attributeValue: 'Pepsi',
                    }),
                  },
                },
              ],
            })
          : response({ content: 'Listo, ya cambié la bebida.' });
      });
      const result = await agent.runTurn({
        userMessage:
          'Necesito ayuda para ajustar la bebida a Pepsi en mi pedido',
        cart: h.conv.sessionData.cart,
        products,
        sessionSummary: 'Carrito abierto',
        recentMessages: [],
        businessRulesBlock: '',
        brandName: 'Prueba',
      });
      expect(requests).toBe(2);
      expect(result.actions).toEqual({});
      expect(result.rejectedAttributeChoices?.[0]).toMatchObject({
        reason: 'ambiguous_cart_line',
      });
    });

for (const [distinct, index, source] of [
  [
    false,
    1,
    'Por favor cambia la bebida de la fila 2 a Pepsi para acompañar el pedido',
  ],
  [
    false,
    1,
    'Por favor cambia la bebida del de Manzana a Pepsi para acompañar el pedido',
  ],
  [
    false,
    0,
    'Por favor cambia la bebida del de sin cebolla a Pepsi para acompañar el pedido',
  ],
  [
    true,
    0,
    'Por favor cambia la bebida del Combo De Tofu a Pepsi para acompañar el pedido',
  ],
] as const)
  test(`explicit source remains supported for ${source}`, async () => {
    const { h, agent, products } = setup(distinct);
    let requests = 0;
    const edit = {
      productId: h.conv.sessionData.cart[index].productId,
      cartLineIndex: index,
      attributeName: 'Bebida',
      attributeValue: 'Pepsi',
    };
    jest.spyOn(global, 'fetch').mockImplementation(async () => {
      requests++;
      return requests === 1
        ? response({
            content: null,
            tool_calls: [
              {
                id: 'choice',
                type: 'function',
                function: {
                  name: 'set_attribute',
                  arguments: JSON.stringify(edit),
                },
              },
            ],
          })
        : response({ content: 'Listo, queda Pepsi.' });
    });
    const result = await agent.runTurn({
      userMessage: source,
      cart: h.conv.sessionData.cart,
      products,
      sessionSummary: 'Carrito abierto',
      recentMessages: [],
      businessRulesBlock: '',
      brandName: 'Prueba',
    });
    expect(result.actions.updateAttributes).toEqual([edit]);
    expect(result.rejectedAttributeChoices).toBeUndefined();
  });

for (const state of ['building_cart', 'awaiting_final_confirm'])
  test(`long option lists keep global numbers and selection in ${state}`, async () => {
    const { h, products } = setup();
    h.conv.state = state;
    h.conv.sessionData.cart.splice(1, 1);
    products[0].attributes[0].options = Array.from(
      { length: 28 },
      (_, index) => `Sabor ${index + 1} ${'mango fresco '.repeat(15)}`,
    );
    h.conv.sessionData.cart[0].attributes![0].attributeValue =
      products[0].attributes[0].options[0];
    h.agent.runTurn.mockResolvedValue({
      reply: 'Listo, ya hice el cambio.',
      actions: {},
      toolCalls: ['set_attribute'],
      rejectedAttributeChoices: [
        {
          productId: 5231,
          cartLineIndex: 0,
          attributeName: 'Bebida',
          attributeValue: 'Inexistente',
          reason: 'unknown_option',
        },
      ],
    });
    const before = structuredClone(h.conv.sessionData.cart);
    let reply =
      (await h.sendQueued('Ayúdame a ajustar mi pedido por favor')) || '';
    expect(reply.length).toBeLessThanOrEqual(3800);
    expect(reply).toMatch(/siguientes/);
    expect(h.conv.sessionData.cart).toEqual(before);
    const first = reply;
    reply = (await h.sendQueued('siguientes')) || '';
    expect(reply.length).toBeLessThanOrEqual(3800);
    expect(reply).toMatch(/anteriores/);
    expect(reply).not.toBe(first);
    expect(h.conv.sessionData.cart).toEqual(before);
    reply = (await h.sendQueued('anteriores')) || '';
    expect(reply).toContain('1. Sabor 1 ');
    const target = 27;
    await h.sendQueued(String(target + 1));
    expect(h.conv.sessionData.cart[0]).toMatchObject({
      quantity: 2,
      note: 'Sin cebolla',
    });
    expect(h.conv.sessionData.cart[0].attributes).toContainEqual({
      attributeName: 'Bebida',
      attributeValue: products[0].attributes[0].options[target],
    });
    await h.sendQueued('no más, recojo en el local');
    await h.sendQueued('efectivo');
    await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  });

test('long owner lists paginate without choosing a product or field', async () => {
  const { h, products } = setup();
  products[0].attributes = Array.from({ length: 25 }, (_, index) => ({
    attributeName: `Opción ${index + 1} ${'personalizada '.repeat(8)}`,
    options: ['Suave', 'Picante'],
  }));
  h.conv.sessionData.cart.splice(1, 1);
  h.conv.sessionData.cart[0].attributes = products[0].attributes.map(
    (attribute) => ({
      attributeName: attribute.attributeName,
      attributeValue: 'Suave',
    }),
  );
  h.agent.runTurn.mockResolvedValue({
    reply: 'Listo, ya hice el cambio.',
    actions: {},
    toolCalls: ['set_attribute'],
    rejectedAttributeChoices: [
      {
        productId: 5231,
        cartLineIndex: 0,
        attributeName: 'Tamaño',
        attributeValue: 'Grande',
        reason: 'unknown_attribute',
      },
    ],
  });
  const before = structuredClone(h.conv.sessionData.cart);
  let reply =
    (await h.sendQueued('Ayúdame a ajustar mi pedido por favor')) || '';
  expect(reply.length).toBeLessThanOrEqual(3800);
  expect(reply).toMatch(/siguientes/);
  const first = reply;
  reply = (await h.sendQueued('siguientes')) || '';
  expect(reply.length).toBeLessThanOrEqual(3800);
  expect(reply).not.toBe(first);
  expect(h.conv.sessionData.pendingCartOptionChoice?.selected).toBeUndefined();
  expect(h.conv.sessionData.cart).toEqual(before);
  await h.sendQueued('25');
  await h.sendQueued('2');
  expect(h.conv.sessionData.cart[0].attributes).toContainEqual({
    attributeName: products[0].attributes[24].attributeName,
    attributeValue: 'Picante',
  });
  expect(h.conv.sessionData.cart[0]).toMatchObject({
    quantity: 2,
    note: 'Sin cebolla',
  });
});

for (const distinct of [false, true])
  test(`a drink request keeps owner clarification fluid through the normal router ${distinct}`, async () => {
    const { h } = setup(distinct);
    let requests = 0;
    jest.spyOn(global, 'fetch').mockImplementation(async () => {
      requests++;
      return requests === 1
        ? response({
            content: null,
            tool_calls: [
              {
                id: 'choice',
                type: 'function',
                function: {
                  name: 'set_attribute',
                  arguments: JSON.stringify({
                    productId: 5231,
                    cartLineIndex: 0,
                    attributeName: 'Bebida',
                    attributeValue: 'Pepsi',
                  }),
                },
              },
            ],
          })
        : response({ content: 'Listo, ya cambié la bebida.' });
    });
    const before = structuredClone(h.conv.sessionData.cart);
    const reply = await h.sendQueued(
      'Quisiera hacer un cambio de bebida a Pepsi en el pedido',
    );
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(reply).not.toMatch(/ya cambi[eé]/);
    const pending = h.conv.sessionData.pendingCartOptionChoice;
    expect(!!pending || !!h.conv.sessionData.pendingCartAttributeEdit).toBe(
      true,
    );
    if (pending) {
      const target = pending.candidates.findIndex(
        (candidate) =>
          candidate.cartIndex === 1 && candidate.attributeName === 'Bebida',
      );
      expect(target).toBeGreaterThanOrEqual(0);
      await h.sendQueued(String(target + 1));
      await h.sendQueued('3');
    } else await h.sendQueued('2');
    expect(h.conv.sessionData.cart[0]).toEqual(before[0]);
    expect(h.conv.sessionData.cart[1].attributes).toContainEqual({
      attributeName: 'Bebida',
      attributeValue: 'Pepsi',
    });
    await h.sendQueued('no más, recojo en el local');
    await h.sendQueued('efectivo');
    await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  });

for (const source of [
  'Necesito ajustar la bebida a Pepsi para este pedido',
  'Cambia la bebida del de Pepsi a Pepsi para este pedido',
  'No cambies la fila 1, deja las bebidas Pepsi para este pedido',
])
  test(`ambiguous or negated references keep the owner unresolved for ${source}`, async () => {
    const { h, agent, products } = setup();
    if (source.includes('del de Pepsi'))
      for (const line of h.conv.sessionData.cart)
        line.attributes![0].attributeValue = 'Pepsi';
    let requests = 0;
    jest.spyOn(global, 'fetch').mockImplementation(async () => {
      requests++;
      return requests === 1
        ? response({
            content: null,
            tool_calls: [
              {
                id: 'choice',
                type: 'function',
                function: {
                  name: 'set_attribute',
                  arguments: JSON.stringify({
                    productId: 5231,
                    cartLineIndex: 0,
                    attributeName: 'Bebida',
                    attributeValue: 'Pepsi',
                  }),
                },
              },
            ],
          })
        : response({ content: 'Listo, ya hice el cambio.' });
    });
    const result = await agent.runTurn({
      userMessage: source,
      cart: h.conv.sessionData.cart,
      products,
      sessionSummary: 'Carrito abierto',
      recentMessages: [],
      businessRulesBlock: '',
      brandName: 'Prueba',
    });
    expect(result.actions).toEqual({});
    expect(result.rejectedAttributeChoices?.[0]).toMatchObject({
      reason: 'ambiguous_cart_line',
    });
  });

test('an explicit row conflicting with the model index is rejected even if only one item accepts the value', async () => {
  const { h, agent, products } = setup(true);
  products[1].attributes = [];
  products[1].hasAttributes = false;
  h.conv.sessionData.cart[1].attributes = [];
  let requests = 0;
  jest.spyOn(global, 'fetch').mockImplementation(async () => {
    requests++;
    return requests === 1
      ? response({
          content: null,
          tool_calls: [
            {
              id: 'choice',
              type: 'function',
              function: {
                name: 'set_attribute',
                arguments: JSON.stringify({
                  productId: 5231,
                  cartLineIndex: 0,
                  attributeName: 'Bebida',
                  attributeValue: 'Pepsi',
                }),
              },
            },
          ],
        })
      : response({ content: 'Listo, ya hice el cambio.' });
  });
  const result = await agent.runTurn({
    userMessage: 'Cambia la bebida de la fila 2 a Pepsi para este pedido',
    cart: h.conv.sessionData.cart,
    products,
    sessionSummary: 'Carrito abierto',
    recentMessages: [],
    businessRulesBlock: '',
    brandName: 'Prueba',
  });
  expect(result.actions).toEqual({});
  expect(result.rejectedAttributeChoices?.[0]).toMatchObject({
    reason: 'ambiguous_cart_line',
  });
});

for (const interruption of [
  'price',
  'expired',
  'cart changed',
  'catalog changed',
  'cancel',
])
  test(`paged choices preserve validation during ${interruption}`, async () => {
    const { h, products } = setup();
    h.conv.sessionData.cart.splice(1, 1);
    products[0].attributes[0].options = Array.from(
      { length: 30 },
      (_, i) => `Sabor ${i + 1} ${'mango '.repeat(30)}`,
    );
    h.conv.sessionData.cart[0].attributes![0].attributeValue =
      products[0].attributes[0].options[0];
    h.agent.runTurn.mockResolvedValue({
      reply: 'Listo, ya hice el cambio.',
      actions: {},
      toolCalls: ['set_attribute'],
      rejectedAttributeChoices: [
        {
          productId: 5231,
          attributeName: 'Bebida',
          attributeValue: 'Inexistente',
          reason: 'unknown_option',
        },
      ],
    });
    await h.sendQueued('Ayúdame a ajustar mi pedido por favor');
    await h.sendQueued('siguientes');
    const before = structuredClone(h.conv.sessionData.cart);
    if (interruption === 'price') {
      const reply = await h.sendQueued('Cuánto vale el combo?');
      expect(reply).toMatch(/22.000/);
      expect(h.conv.sessionData.cart).toEqual(before);
      await h.sendQueued('anteriores');
      expect(h.conv.sessionData.pendingCartOptionChoice?.optionPageStart).toBe(
        0,
      );
      return;
    }
    if (interruption === 'expired')
      h.conv.sessionData.pendingCartOptionChoice!.createdAt -= 11 * 60 * 1000;
    if (interruption === 'cart changed')
      h.conv.sessionData.cart[0].quantity = 3;
    if (interruption === 'catalog changed') products[0].price = 25000;
    const snapshot = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued(interruption === 'cancel' ? 'mejor no' : 'siguientes');
    expect(h.conv.sessionData.cart).toEqual(snapshot);
    expect(h.conv.sessionData.pendingCartOptionChoice).toBeUndefined();
  });

test('a request applying to both owners remains supported', async () => {
  const { h, agent, products } = setup();
  let requests = 0;
  jest.spyOn(global, 'fetch').mockImplementation(async () => {
    requests++;
    return requests === 1
      ? response({
          content: null,
          tool_calls: h.conv.sessionData.cart.map((line, index) => ({
            id: `choice-${index}`,
            type: 'function',
            function: {
              name: 'set_attribute',
              arguments: JSON.stringify({
                productId: line.productId,
                cartLineIndex: index,
                attributeName: 'Bebida',
                attributeValue: 'Pepsi',
              }),
            },
          })),
        })
      : response({ content: 'Listo, quedan ambas con Pepsi.' });
  });
  const result = await agent.runTurn({
    userMessage:
      'Por favor cambia ambas bebidas a Pepsi para acompañar este pedido',
    cart: h.conv.sessionData.cart,
    products,
    sessionSummary: 'Carrito abierto',
    recentMessages: [],
    businessRulesBlock: '',
    brandName: 'Prueba',
  });
  expect(result.rejectedAttributeChoices).toBeUndefined();
  expect(result.actions.updateAttributes).toHaveLength(2);
});

for (const change of ['renamed', 'unavailable'])
  test(`basket names still identify the owner when the catalog is ${change}`, async () => {
    const { h, agent, products } = setup(true);
    let requests = 0;
    if (change === 'renamed') products[0].name = 'Combo De Tofu Nuevo';
    else products[0].availableNow = false;
    jest.spyOn(global, 'fetch').mockImplementation(async () => {
      requests++;
      return requests === 1
        ? response({
            content: null,
            tool_calls: [
              {
                id: 'choice',
                type: 'function',
                function: {
                  name: 'set_attribute',
                  arguments: JSON.stringify({
                    productId: 5232,
                    cartLineIndex: 1,
                    attributeName: 'Bebida',
                    attributeValue: 'Pepsi',
                  }),
                },
              },
            ],
          })
        : response({ content: 'Listo, ya cambié la bebida.' });
    });
    const result = await agent.runTurn({
      userMessage:
        'Por favor cambia la bebida del Combo De Tofu a Pepsi para acompañar este pedido',
      cart: h.conv.sessionData.cart,
      products,
      sessionSummary: 'Carrito abierto',
      recentMessages: [],
      businessRulesBlock: '',
      brandName: 'Prueba',
    });
    expect(result.actions).toEqual({});
    expect(result.rejectedAttributeChoices?.[0]).toMatchObject({
      reason: 'ambiguous_cart_line',
    });
  });

test('legacy pending choices can navigate without pagination fields', async () => {
  const { h, products } = setup();
  h.conv.sessionData.cart.splice(1, 1);
  products[0].attributes[0].options = Array.from(
    { length: 30 },
    (_, i) => `Sabor ${i + 1} ${'fruta '.repeat(30)}`,
  );
  h.conv.sessionData.cart[0].attributes![0].attributeValue =
    products[0].attributes[0].options[0];
  h.conv.sessionData.pendingCartOptionChoice = {
    cartSignature: JSON.stringify(h.conv.sessionData.cart),
    createdAt: Date.now(),
    candidates: [{ cartIndex: 0, attributeName: 'Bebida' }],
    selected: 0,
    catalogFingerprint: JSON.stringify([
      5231,
      22000,
      products[0].attributes[0],
    ]),
  };
  const before = structuredClone(h.conv.sessionData.cart);
  const reply = await h.sendQueued('siguientes');
  expect(reply).toMatch(/anteriores/);
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(
    h.conv.sessionData.pendingCartOptionChoice?.optionPageStart,
  ).toBeGreaterThan(0);
  await h.sendQueued('30');
  expect(h.conv.sessionData.cart[0].attributes).toContainEqual({
    attributeName: 'Bebida',
    attributeValue: products[0].attributes[0].options[29],
  });
});

test('empty configured options explain the catalog problem without an empty pending list', async () => {
  const { h, products } = setup();
  h.conv.sessionData.cart.splice(1, 1);
  products[0].attributes[0].options = [];
  h.agent.runTurn.mockResolvedValue({
    reply: 'Listo, ya hice el cambio.',
    actions: {},
    toolCalls: ['set_attribute'],
    rejectedAttributeChoices: [
      {
        productId: 5231,
        attributeName: 'Bebida',
        attributeValue: 'Pepsi',
        reason: 'unknown_option',
      },
    ],
  });
  const before = structuredClone(h.conv.sessionData.cart);
  const reply = await h.sendQueued('Ayúdame a ajustar mi pedido por favor');
  expect(reply).toMatch(/sin opciones disponibles/);
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(h.conv.sessionData.pendingCartOptionChoice).toBeUndefined();
});

for (const owner of [false, true])
  test(`long context is delivered once before the ${owner ? 'owner' : 'value'} question`, async () => {
    const { h } = setup();
    if (!owner) h.conv.sessionData.cart.splice(1, 1);
    const intro = 'Inicio ' + 'Dato '.repeat(1400) + 'Fin';
    const before = structuredClone(h.conv.sessionData.cart);
    const cfg = await h.service.settingsService.getEffectiveConfig();
    await h.service.tryHandleUnspecifiedCartOption(
      h.conv,
      h.conv.waId,
      structuredClone(h.conv.sessionData),
      'revisar',
      cfg,
      'Bebida',
      { intro, productId: 5231 },
    );
    expect(h.replies).toHaveLength(4);
    for (const reply of h.replies)
      expect(reply.length).toBeLessThanOrEqual(3800);
    expect(h.replies.filter((reply) => reply.includes('Inicio'))).toHaveLength(
      1,
    );
    expect(h.replies.filter((reply) => reply.includes('Fin'))).toHaveLength(1);
    expect(h.replies.at(-1)).toMatch(/¿/);
    expect(h.conv.sessionData.cart).toEqual(before);
  });
