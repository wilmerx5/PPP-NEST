import { WhatsappAgentService } from './whatsapp-agent.service';
import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { harness } from './whatsapp-accuracy.test-support';

function setup(state = 'building_cart', model = 'gpt-4o-mini') {
  const products = [
    {
      id: 5241,
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
      ],
    },
    {
      id: 5242,
      code: 12,
      name: 'Porcion De Hummus',
      price: 7000,
      availableNow: true,
      hasAttributes: false,
      attributes: [],
    },
  ];
  const h = harness(products, true);
  h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
  h.service.ordersService.create = jest
    .fn()
    .mockResolvedValue({ id: 524, dailyOrderNumber: 524 });
  h.service.ordersService.findTodayOrdersByPhone = jest
    .fn()
    .mockResolvedValue([]);
  h.conv.state = state;
  Object.assign(h.conv.sessionData, {
    fulfillmentChosen: true,
    phoneConfirmed: true,
    contactPhone: h.conv.phoneE164,
    notesCollected: true,
    cart: [
      {
        productId: 5241,
        code: 11,
        name: products[0].name,
        unitPrice: 22000,
        quantity: 2,
        note: 'Sin cebolla',
        attributes: [{ attributeName: 'Bebida', attributeValue: 'Colombiana' }],
      },
    ],
  });
  const agent = new WhatsappAgentService(
    {
      getEffectiveConfig: async () => ({
        openaiApiKey: 'synthetic-key',
        openaiModel: model,
        systemPrompt: '',
        localContext: {},
      }),
    } as never,
    new WhatsappCatalogService({} as never),
  );
  h.agent.runTurn.mockImplementation((input) => agent.runTurn(input));
  return { h, agent, products };
}
const replacement = (extra: object = {}) => ({
  productId: 5241,
  cartLineIndex: 0,
  newProductId: 5241,
  attributes: [{ attributeName: 'Bebida', attributeValue: 'Pepsi' }],
  ...extra,
});
const call = (name: string, args: object, id = 'change') => ({
  id,
  type: 'function',
  function: { name, arguments: JSON.stringify(args) },
});
const response = (message: object) =>
  new Response(JSON.stringify({ choices: [{ message }] }));
const input = (
  s: ReturnType<typeof setup>,
  text = 'Cambia la bebida del Combo De Tofu a Pepsi',
) => ({
  userMessage: text,
  products: s.products,
  cart: s.h.conv.sessionData.cart,
  sessionSummary: 'Carrito abierto',
  recentMessages: [],
  businessRulesBlock: '',
  brandName: 'Prueba',
});
afterEach(() => jest.restoreAllMocks());

for (const quantity of [0, -1, 1.5, 11, '2'])
  test(`same-product replacement is atomic with rejected quantity ${quantity}`, async () => {
    const s = setup();
    let requests = 0;
    jest.spyOn(global, 'fetch').mockImplementation(async (_url, init) => {
      if (++requests === 1)
        return response({
          content: null,
          tool_calls: [call('replace_item', replacement({ quantity }))],
        });
      const body = JSON.parse(String(init?.body));
      expect(JSON.parse(body.messages.at(-1).content)).toMatchObject({
        ok: false,
        error: 'invalid_quantity',
      });
      return response({ content: 'Listo, ya hice el cambio.' });
    });
    const before = structuredClone(s.h.conv.sessionData.cart);
    const result = await s.agent.runTurn(input(s));
    expect(result.actions).toEqual({});
    expect(s.h.conv.sessionData.cart).toEqual(before);
  });

for (const source of [
  'Quisiera cambiar la bebida',
  'Necesito ayuda con la bebida',
])
  test(`same-product replacement reports its nested option rejection for ${source}`, async () => {
    const s = setup();
    let requests = 0;
    jest.spyOn(global, 'fetch').mockImplementation(async (_url, init) => {
      if (++requests === 1)
        return response({
          content: null,
          tool_calls: [
            call('replace_item', replacement({ note: 'Salsa aparte' })),
          ],
        });
      const body = JSON.parse(String(init?.body));
      expect(JSON.parse(body.messages.at(-1).content)).toMatchObject({
        ok: false,
        error: 'missing_explicit_option_choice',
      });
      return response({ content: 'Listo, ya hice el cambio.' });
    });
    const result = await s.agent.runTurn(input(s, source));
    expect(result.actions).toEqual({});
    expect(result.rejectedAttributeChoices?.[0]).toMatchObject({
      productId: 5241,
    });
  });

for (const state of ['building_cart', 'awaiting_final_confirm'])
  for (const finish of ['acknowledgement', 'transport error'])
    test(`unresolved replacement protects the complete mixed request ${state} ${finish}`, async () => {
      const s = setup(state);
      let requests = 0;
      jest.spyOn(global, 'fetch').mockImplementation(async () => {
        if (++requests === 1)
          return response({
            content: null,
            tool_calls: [
              call('replace_item', replacement({ quantity: 0 })),
              call('add_item', { productId: 5242, quantity: 1 }, 'purchase'),
            ],
          });
        if (finish === 'transport error')
          throw new Error('Synthetic transport error');
        return response({
          content: 'Listo, ya hice el cambio y agregué el hummus. ¿Algo más?',
        });
      });
      const before = structuredClone(s.h.conv.sessionData.cart);
      const text =
        'Cambia la bebida del Combo De Tofu a Pepsi y agrega una Porcion De Hummus';
      const handled = await s.h.service.tryHandleAgentV1({
        conv: s.h.conv,
        msg: {
          waId: 'customer',
          phoneE164: s.h.conv.phoneE164,
          messageId: 'replacement',
          messageType: 'text',
          text,
          raw: {},
        },
        session: s.h.conv.sessionData,
        text,
        originalText: text,
        products: s.products,
        cfg: s.h.cfg,
        status: { isOpen: true, message: 'Abierto' },
        businessOpenForBot: true,
        placedOrderOnly: state !== 'building_cart',
      });
      expect(handled).toBe(true);
      expect(s.h.conv.sessionData.cart).toEqual(before);
      expect(s.h.conv.state).toBe(state);
      expect(s.h.replies.at(-1)).toMatch(/cantidad/i);
      expect(s.h.replies.at(-1)).not.toMatch(/ya hice|agregu[eé]|Algo más/i);
      expect((s.h.replies.at(-1)?.match(/\?/g) || []).length).toBe(1);
      expect(s.h.service.ordersService.create).not.toHaveBeenCalled();
      s.h.agent.runTurn.mockResolvedValue({
        reply: 'Listo.',
        actions: {
          updateAttributes: [
            {
              productId: 5241,
              cartLineIndex: 0,
              attributeName: 'Bebida',
              attributeValue: 'Pepsi',
            },
          ],
          addItems: [{ productId: 5242, quantity: 1 }],
        },
        toolCalls: ['set_attribute', 'add_item'],
        purchaseAttempts: [{ productId: 5242, accepted: true }],
      });
      const recoveredReply = await s.h.sendQueued(
        'Cambia el Combo De Tofu por Combo De Tofu con Pepsi y agrega una Porcion De Hummus',
      );
      expect(recoveredReply).toMatch(/Listo/);
      expect(s.h.conv.sessionData.cart).toHaveLength(2);
      expect(s.h.conv.sessionData.cart[0]).toMatchObject({
        productId: 5241,
        quantity: 2,
        note: 'Sin cebolla',
      });
      expect(s.h.conv.sessionData.cart[0].attributes).toContainEqual({
        attributeName: 'Bebida',
        attributeValue: 'Pepsi',
      });
      expect(s.h.conv.sessionData.cart[1]).toMatchObject({
        productId: 5242,
        quantity: 1,
      });
      await s.h.sendQueued('no más, recojo en el local');
      await s.h.sendQueued('efectivo');
      await s.h.sendQueued('confirmar');
      expect(s.h.service.ordersService.create).toHaveBeenCalledTimes(1);
    });

for (const corrected of [false, true])
  test(`replacement recovery is scoped to a successful operation ${corrected}`, async () => {
    const s = setup();
    let requests = 0;
    jest.spyOn(global, 'fetch').mockImplementation(async () => {
      if (++requests === 1)
        return response({
          content: null,
          tool_calls: [call('replace_item', replacement({ quantity: 0 }))],
        });
      if (requests === 2)
        return response({
          content: null,
          tool_calls: [
            call(
              'replace_item',
              corrected
                ? replacement({ quantity: 1, note: 'Salsa aparte' })
                : replacement({ attributes: [] }),
              'retry',
            ),
          ],
        });
      return response({ content: 'Listo, ya hice el cambio.' });
    });
    const result = await s.agent.runTurn(input(s));
    if (corrected) {
      expect(result.rejectedReplacements).toBeUndefined();
      expect(result.actions.updateAttributes).toContainEqual({
        productId: 5241,
        cartLineIndex: 0,
        attributeName: 'Bebida',
        attributeValue: 'Pepsi',
      });
      expect(result.actions.updateCartLines).toContainEqual({
        productId: 5241,
        cartLineIndex: 0,
        quantity: 1,
        note: 'Salsa aparte',
      });
    } else {
      expect(result.rejectedReplacements?.[0]).toMatchObject({
        productId: 5241,
        reason: 'invalid_quantity',
      });
      expect(result.actions).toEqual({});
    }
  });

for (const quantity of [1, 2])
  test(`successful same-product replacement commits all requested fields ${quantity}`, async () => {
    const s = setup();
    let requests = 0;
    jest.spyOn(global, 'fetch').mockImplementation(async () =>
      ++requests === 1
        ? response({
            content: null,
            tool_calls: [
              call(
                'replace_item',
                replacement({ quantity, note: 'Salsa aparte' }),
              ),
            ],
          })
        : response({ content: 'Listo, ya hice el cambio.' }),
    );
    const result = await s.agent.runTurn(input(s));
    expect(result.rejectedReplacements).toBeUndefined();
    expect(result.rejectedAttributeChoices).toBeUndefined();
    expect(result.actions.updateAttributes).toContainEqual({
      productId: 5241,
      cartLineIndex: 0,
      attributeName: 'Bebida',
      attributeValue: 'Pepsi',
    });
    expect(result.actions.updateCartLines).toContainEqual({
      productId: 5241,
      cartLineIndex: 0,
      quantity,
      note: 'Salsa aparte',
    });
  });

for (const attributes of [
  [null],
  [{ attributeName: 123, attributeValue: 'Pepsi' }],
])
  test(`malformed replacement attributes fail atomically ${JSON.stringify(attributes)}`, async () => {
    const s = setup();
    let requests = 0;
    jest.spyOn(global, 'fetch').mockImplementation(async () =>
      ++requests === 1
        ? response({
            content: null,
            tool_calls: [
              call(
                'replace_item',
                replacement({ attributes, note: 'Salsa aparte' }),
              ),
            ],
          })
        : response({ content: 'Listo.' }),
    );
    const result = await s.agent.runTurn(input(s));
    expect(result.error).toBeUndefined();
    expect(result.actions).toEqual({});
    expect(result.rejectedReplacements?.[0]).toMatchObject({
      reason: 'invalid_attribute_option',
    });
  });

test('a rejected staged replacement cannot clear an earlier attribute rejection', async () => {
  const s = setup();
  let requests = 0;
  jest.spyOn(global, 'fetch').mockImplementation(async () =>
    ++requests === 1
      ? response({
          content: null,
          tool_calls: [
            call('set_attribute', {
              productId: 5241,
              cartLineIndex: 0,
              attributeName: 'Bebida',
              attributeValue: 'Inexistente',
            }),
            call('replace_item', replacement({ quantity: 0 }), 'replacement'),
          ],
        })
      : response({ content: 'Listo.' }),
  );
  const result = await s.agent.runTurn(input(s));
  expect(result.actions).toEqual({});
  expect(result.rejectedAttributeChoices?.[0]).toMatchObject({
    reason: 'unknown_option',
  });
  expect(result.rejectedReplacements?.[0]).toMatchObject({
    reason: 'invalid_quantity',
  });
});

test('a repeated completed replacement uses its existing successful receipt', async () => {
  const s = setup();
  let requests = 0;
  const args = replacement({ newProductId: 5242, attributes: [], quantity: 2 });
  jest.spyOn(global, 'fetch').mockImplementation(async () =>
    ++requests === 1
      ? response({
          content: null,
          tool_calls: [
            call('replace_item', args),
            call('replace_item', args, 'repeat'),
          ],
        })
      : response({ content: 'Listo.' }),
  );
  const result = await s.agent.runTurn(
    input(s, 'Cambia el Combo De Tofu por dos Porcion De Hummus'),
  );
  expect(result.rejectedReplacements).toBeUndefined();
  expect(result.actions.addItems).toHaveLength(1);
  expect(result.actions.addItems?.[0]).toMatchObject({
    productId: 5242,
    quantity: 2,
    note: 'Sin cebolla',
  });
  expect(result.actions.removeCartLines).toEqual([
    { productId: 5241, cartLineIndex: 0 },
  ]);
});

for (const model of ['gpt-4o-mini', 'gpt-6-luna'])
  test(`replacement rejection survives ${model} tool transport`, async () => {
    const s = setup('building_cart', model);
    let requests = 0;
    jest.spyOn(global, 'fetch').mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      if (++requests === 1)
        return body.input
          ? new Response(
              JSON.stringify({
                status: 'completed',
                output: [
                  {
                    type: 'function_call',
                    call_id: 'replacement',
                    name: 'replace_item',
                    arguments: JSON.stringify(replacement({ quantity: 0 })),
                  },
                ],
              }),
            )
          : response({
              content: null,
              tool_calls: [call('replace_item', replacement({ quantity: 0 }))],
            });
      const output = body.input
        ? body.input.findLast(
            (message: any) => message.type === 'function_call_output',
          ).output
        : body.messages.at(-1).content;
      expect(JSON.parse(output)).toMatchObject({
        ok: false,
        error: 'invalid_quantity',
      });
      return body.input
        ? new Response(
            JSON.stringify({
              status: 'completed',
              output: [
                {
                  type: 'message',
                  role: 'assistant',
                  content: [{ type: 'output_text', text: 'Listo.' }],
                },
              ],
            }),
          )
        : response({ content: 'Listo.' });
    });
    const result = await s.agent.runTurn(input(s));
    expect(result.actions).toEqual({});
    expect(result.rejectedReplacements?.[0]).toMatchObject({
      productId: 5241,
      cartLineIndex: 0,
      reason: 'invalid_quantity',
    });
    expect(requests).toBe(2);
  });

test('a rejected expansion after a valid unit partition leaves its owner in control', async () => {
  const s = setup();
  let requests = 0;
  jest.spyOn(global, 'fetch').mockImplementation(async () =>
    ++requests === 1
      ? response({
          content: null,
          tool_calls: [
            call('set_unit_attributes', {
              productId: 5241,
              cartLineIndex: 0,
              affectedQuantity: 1,
              attributes: [
                { attributeName: 'Bebida', attributeValue: 'Pepsi' },
              ],
            }),
            call('replace_item', replacement(), 'expansion'),
          ],
        })
      : response({ content: 'Listo.' }),
  );
  const result = await s.agent.runTurn(
    input(s, 'Uno de los dos Combo De Tofu con Pepsi, el otro igual'),
  );
  expect(result.rejectedReplacements).toBeUndefined();
  expect(result.actions.updateUnitOptions).toHaveLength(1);
  expect(result.actions.updateAttributes).toBeUndefined();
});

for (const unavailable of [false, true])
  test(`the normal router explains a rejected replacement target ${unavailable}`, async () => {
    const s = setup();
    let requests = 0;
    if (unavailable) s.products[1].availableNow = false;
    let observed: Awaited<ReturnType<typeof s.agent.runTurn>> | undefined;
    s.h.agent.runTurn.mockImplementation(async (request) => {
      observed = await s.agent.runTurn(request);
      return observed;
    });
    jest.spyOn(global, 'fetch').mockImplementation(async () =>
      ++requests === 1
        ? response({
            content: null,
            tool_calls: [
              call(
                'replace_item',
                replacement({
                  newProductId: unavailable ? 5242 : 99999,
                  attributes: [],
                }),
              ),
            ],
          })
        : response({ content: 'Listo, ya hice el cambio. ¿Algo más?' }),
    );
    const before = structuredClone(s.h.conv.sessionData.cart);
    const reply = await s.h.sendQueued('Ayúdame a ajustar mi pedido por favor');
    expect(requests).toBe(2);
    if (unavailable) expect(observed?.actions.removeCartLines).toHaveLength(1);
    else expect(observed?.rejectedReplacements).toHaveLength(1);
    expect(s.h.conv.sessionData.cart).toEqual(before);
    expect(reply).toMatch(/validar|aclarar el cambio/i);
    expect(reply).not.toMatch(/ya hice|Algo más|99999/);
    expect((reply?.match(/\?/g) || []).length).toBe(1);
    expect(s.h.service.ordersService.create).not.toHaveBeenCalled();
  });

for (const ambiguous of [false, true])
  test(`success on another owner keeps an unresolved replacement ${ambiguous}`, async () => {
    const s = setup();
    let requests = 0;
    s.h.conv.sessionData.cart.push({
      ...structuredClone(s.h.conv.sessionData.cart[0]),
      quantity: 1,
      note: 'Salsa aparte',
      attributes: [{ attributeName: 'Bebida', attributeValue: 'Manzana' }],
    });
    jest.spyOn(global, 'fetch').mockImplementation(async () =>
      ++requests === 1
        ? response({
            content: null,
            tool_calls: [
              call(
                'replace_item',
                replacement({
                  ...(ambiguous ? { cartLineIndex: undefined } : {}),
                  quantity: 0,
                }),
              ),
              call(
                'replace_item',
                replacement({ cartLineIndex: 1, quantity: 1 }),
                'other',
              ),
            ],
          })
        : response({ content: 'Listo.' }),
    );
    const result = await s.agent.runTurn(
      input(s, 'Cambia todas las bebidas a Pepsi'),
    );
    expect(result.rejectedReplacements).toHaveLength(1);
    expect(result.rejectedReplacements?.[0]).toMatchObject({
      productId: 5241,
      reason: ambiguous ? 'missing_or_ambiguous_cart_line' : 'invalid_quantity',
    });
    expect(result.actions.updateAttributes).toEqual([
      {
        productId: 5241,
        cartLineIndex: 1,
        attributeName: 'Bebida',
        attributeValue: 'Pepsi',
      },
    ]);
  });

test('a uniquely owned omitted index can recover with its explicit index', async () => {
  const s = setup();
  let requests = 0;
  jest.spyOn(global, 'fetch').mockImplementation(async () =>
    ++requests === 1
      ? response({
          content: null,
          tool_calls: [
            call(
              'replace_item',
              replacement({ cartLineIndex: undefined, quantity: 0 }),
            ),
            call('replace_item', replacement({ quantity: 1 }), 'retry'),
          ],
        })
      : response({ content: 'Listo.' }),
  );
  const result = await s.agent.runTurn(input(s));
  expect(result.rejectedReplacements).toBeUndefined();
  expect(result.actions.updateCartLines).toEqual([
    { productId: 5241, cartLineIndex: 0, quantity: 1 },
  ]);
});

for (const suffix of [
  'con Inexistente',
  'con Pepsi gratis',
  'con Pepsi y bebida ilimitada',
  'sin cebolla',
])
  test(`an unresolved destination keeps the combined request intact for ${suffix}`, async () => {
    const s = setup();
    s.h.agent.runTurn.mockResolvedValue({
      reply: '',
      actions: {},
      toolCalls: [],
    });
    const before = structuredClone(s.h.conv.sessionData.cart);
    await s.h.sendQueued(
      `Cambia el Combo De Tofu por Combo De Tofu ${suffix} y agrega una Porcion De Hummus`,
    );
    expect(s.h.conv.sessionData.cart).toEqual(before);
    expect(s.h.service.ordersService.create).not.toHaveBeenCalled();
  });

for (const differentProduct of [false, true])
  test(`configured options resolve a complete replacement with another purchase ${differentProduct}`, async () => {
    const s = setup();
    s.products[0].attributes.push({
      attributeName: 'Salsa',
      options: ['Suave', 'Picante'],
    });
    if (differentProduct)
      s.products.push({
        ...structuredClone(s.products[0]),
        id: 5243,
        code: 13,
        name: 'Bowl De Lentejas',
        price: 26000,
      });
    const target = s.products[differentProduct ? 2 : 0];
    s.h.agent.runTurn.mockResolvedValue({
      reply: '',
      actions: {},
      toolCalls: [],
    });
    const reply = await s.h.sendQueued(
      `Cambia el Combo De Tofu por ${target.name} con Salsa Picante y agrega una Porcion De Hummus`,
    );
    expect(reply).toMatch(/cambi[eé].*agregu[eé]/i);
    expect(s.h.conv.sessionData.cart).toHaveLength(2);
    expect(s.h.conv.sessionData.cart[0]).toMatchObject({
      productId: target.id,
      quantity: 2,
      note: 'Sin cebolla',
    });
    expect(s.h.conv.sessionData.cart[0].attributes).toEqual(
      expect.arrayContaining([
        { attributeName: 'Bebida', attributeValue: 'Colombiana' },
        { attributeName: 'Salsa', attributeValue: 'Picante' },
      ]),
    );
    expect(s.h.conv.sessionData.cart[1]).toMatchObject({
      productId: 5242,
      quantity: 1,
    });
    await s.h.sendQueued('no más, recojo en el local');
    await s.h.sendQueued('efectivo');
    await s.h.sendQueued('confirmar');
    expect(s.h.service.ordersService.create).toHaveBeenCalledTimes(1);
  });

for (const failure of ['limit', 'required option'])
  test(`host rejection preserves the source replacement after ${failure}`, async () => {
    const s = setup();
    let requests = 0;
    if (failure === 'limit') {
      s.products[1].price = 50000;
      Object.assign(s.h.cfg, {
        maxOrderAmount: 60000,
        handoffWhenMaxExceeded: false,
      });
    } else {
      s.products[1].name = 'Jugo Natural';
      s.products[1].hasAttributes = true;
      s.products[1].attributes = [
        { attributeName: 'Sabor', options: ['Mango', 'Lulo'] },
      ];
    }
    jest.spyOn(global, 'fetch').mockImplementation(async () =>
      ++requests === 1
        ? response({
            content: null,
            tool_calls: [
              call(
                'replace_item',
                replacement({
                  newProductId: 5242,
                  quantity: 2,
                  attributes: [],
                }),
              ),
            ],
          })
        : response({ content: 'Listo, ya hice el cambio.' }),
    );
    const before = structuredClone(s.h.conv.sessionData.cart);
    const text = `Cambia el Combo De Tofu por dos ${s.products[1].name}`;
    const handled = await s.h.service.tryHandleAgentV1({
      conv: s.h.conv,
      msg: {
        waId: 'customer',
        phoneE164: s.h.conv.phoneE164,
        messageId: 'replacement',
        messageType: 'text',
        text,
        raw: {},
      },
      session: s.h.conv.sessionData,
      text,
      originalText: text,
      products: s.products,
      cfg: s.h.cfg,
      status: { isOpen: true, message: 'Abierto' },
      businessOpenForBot: true,
    });
    expect(handled).toBe(true);
    expect(s.h.conv.sessionData.cart).toEqual(before);
    expect(s.h.conv.state).toBe('building_cart');
    expect(s.h.conv.sessionData.pendingAttribute).toBeUndefined();
    expect(s.h.replies.at(-1)).not.toMatch(/ya hice/);
    expect(s.h.service.ordersService.create).not.toHaveBeenCalled();
  });
