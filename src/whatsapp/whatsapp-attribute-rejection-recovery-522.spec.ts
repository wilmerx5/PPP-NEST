import { WhatsappAgentService } from './whatsapp-agent.service';
import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { harness } from './whatsapp-accuracy.test-support';
import type { WhatsappTurnSummary } from './whatsapp-turn-observation';

const menu = () => [
  {
    id: 5221,
    code: 11,
    name: 'Combo De Tofu',
    price: 22000,
    availableNow: true,
    hasAttributes: true,
    attributes: [
      { attributeName: 'Bebida', options: ['Colombiana', 'Manzana', 'Pepsi'] },
      { attributeName: 'Salsa', options: ['Suave', 'Picante'] },
    ],
  },
];
function setup(state = 'building_cart', multiple = false) {
  const products = menu(),
    h = harness(products, true);
  h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
  h.service.ordersService.create = jest
    .fn()
    .mockResolvedValue({ id: 522, dailyOrderNumber: 522 });
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
        productId: 5221,
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
    ],
  });
  if (multiple)
    h.conv.sessionData.cart.push({
      ...structuredClone(h.conv.sessionData.cart[0]),
      quantity: 1,
      note: 'Salsa aparte',
      attributes: [
        { attributeName: 'Bebida', attributeValue: 'Manzana' },
        { attributeName: 'Salsa', attributeValue: 'Picante' },
      ],
    });
  h.conv.state = state;
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
const call = (args: object, id = 'choice') => ({
  id,
  type: 'function',
  function: { name: 'set_attribute', arguments: JSON.stringify(args) },
});
const response = (message: object) =>
  new Response(JSON.stringify({ choices: [{ message }] }));
const input = (
  products: ReturnType<typeof menu>,
  cart: any[],
  text: string,
) => ({
  userMessage: text,
  products,
  cart,
  sessionSummary: 'Carrito abierto',
  recentMessages: [],
  businessRulesBlock: '',
  brandName: 'Restaurante de prueba',
});
afterEach(() => jest.restoreAllMocks());

for (const state of ['building_cart', 'awaiting_final_confirm'])
  for (const kind of [
    'unknown_option',
    'unknown_attribute',
    'ambiguous_cart_line',
  ] as const) {
    test(`${kind} ${state} persists a useful clarification and preserves the cart`, async () => {
      const { h, agent, products } = setup(
        state,
        kind === 'ambiguous_cart_line',
      );
      const before = structuredClone(h.conv.sessionData.cart);
      let requests = 0;
      jest.spyOn(global, 'fetch').mockImplementation(async (_url, init) => {
        requests++;
        const body = JSON.parse(String(init?.body));
        if (requests === 1)
          return response({
            content: null,
            tool_calls: [
              call({
                productId: 5221,
                ...(kind === 'ambiguous_cart_line' ? {} : { cartLineIndex: 0 }),
                attributeName:
                  kind === 'unknown_attribute' ? 'Tamaño' : 'Bebida',
                attributeValue:
                  kind === 'unknown_option'
                    ? 'Naranja'
                    : kind === 'unknown_attribute'
                      ? 'Grande'
                      : 'Pepsi',
              }),
            ],
          });
        expect(JSON.parse(body.messages.at(-1).content).ok).toBe(false);
        return response({ content: 'Listo, ya hice el cambio.' });
      });
      // A general request reaches the agent and lets the forced rejection exercise the host.
      let observed: Awaited<ReturnType<typeof agent.runTurn>> | undefined;
      const summaries: WhatsappTurnSummary[] = [];
      jest
        .spyOn(h.service.turnTelemetry, 'recordSummary')
        .mockImplementation((summary: WhatsappTurnSummary) =>
          summaries.push(summary),
        );
      h.agent.runTurn.mockImplementation(async (request) => {
        observed = await agent.runTurn(request);
        return observed;
      });
      const reply = await h.sendQueued('Ayúdame a ajustar mi pedido por favor');
      expect(observed?.rejectedAttributeChoices?.[0]).toMatchObject({
        productId: 5221,
        reason: kind,
      });
      expect(summaries).toHaveLength(1);
      expect(summaries[0]).toMatchObject({
        guardRejections: 1,
        inferenceAttempts: 2,
      });
      expect(h.agent.runTurn).toHaveBeenCalled();
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(reply).not.toMatch(/ya hice|Algo más/i);
      expect(h.conv.sessionData.pendingCartOptionChoice).toBeDefined();
      if (kind === 'unknown_attribute') {
        expect(reply).toMatch(/Bebida/);
        expect(reply).toMatch(/Salsa/);
        await h.sendQueued('1');
      } else if (kind === 'ambiguous_cart_line') {
        expect(reply).toMatch(/Salsa aparte/);
        await h.sendQueued('2');
      }
      const choice = await h.sendQueued('3');
      const target = kind === 'ambiguous_cart_line' ? 1 : 0;
      expect(h.conv.sessionData.cart[target].attributes).toContainEqual({
        attributeName: 'Bebida',
        attributeValue: 'Pepsi',
      });
      expect(h.conv.sessionData.cart[target]).toMatchObject({
        quantity: before[target].quantity,
        note: before[target].note,
      });
      if (target === 1) expect(h.conv.sessionData.cart[0]).toEqual(before[0]);
      expect(choice).toMatch(/Pepsi/);
      expect(requests).toBe(2);
      await h.sendQueued('no más, recojo en el local');
      await h.sendQueued('efectivo');
      await h.sendQueued('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    });
  }

for (const reason of ['unknown_option', 'unknown_attribute'] as const)
  test(`a supported recovery clears ${reason}`, async () => {
    const { agent, h, products } = setup();
    let requests = 0;
    jest.spyOn(global, 'fetch').mockImplementation(async () => {
      requests++;
      return requests < 3
        ? response({
            content: null,
            tool_calls: [
              call(
                {
                  productId: 5221,
                  cartLineIndex: 0,
                  attributeName:
                    requests === 1 && reason === 'unknown_attribute'
                      ? 'Flavor'
                      : 'Bebida',
                  attributeValue:
                    requests === 1 && reason === 'unknown_option'
                      ? 'Naranja'
                      : 'Pepsi',
                },
                String(requests),
              ),
            ],
          })
        : response({ content: 'Listo, queda Pepsi.' });
    });
    const result = await agent.runTurn(
      input(
        products,
        h.conv.sessionData.cart,
        'Por favor cambia la bebida por Pepsi para acompañar mi pedido',
      ),
    );
    expect(requests).toBe(3);
    expect(result.rejectedAttributeChoices).toBeUndefined();
    expect(result.actions.updateAttributes).toEqual([
      {
        productId: 5221,
        cartLineIndex: 0,
        attributeName: 'Bebida',
        attributeValue: 'Pepsi',
      },
    ]);
  });

for (const explicit of [false, true])
  test(`ambiguous ownership needs source evidence before recovery ${explicit}`, async () => {
    const { agent, h, products } = setup('building_cart', true);
    let requests = 0;
    jest.spyOn(global, 'fetch').mockImplementation(async () => {
      requests++;
      return requests < 3
        ? response({
            content: null,
            tool_calls: [
              call(
                {
                  productId: 5221,
                  ...(requests === 1 ? {} : { cartLineIndex: 1 }),
                  attributeName: 'Bebida',
                  attributeValue: 'Pepsi',
                },
                String(requests),
              ),
            ],
          })
        : response({ content: 'Listo, cambié la bebida.' });
    });
    const result = await agent.runTurn(
      input(
        products,
        h.conv.sessionData.cart,
        explicit
          ? 'Cambia la bebida de la fila 2 a Pepsi para acompañar el pedido'
          : 'Quiero cambiar la bebida a Pepsi para acompañar mi pedido',
      ),
    );
    expect(requests).toBe(3);
    if (explicit) expect(result.rejectedAttributeChoices).toBeUndefined();
    else
      expect(result.rejectedAttributeChoices?.[0]).toMatchObject({
        reason: 'ambiguous_cart_line',
      });
  });

for (const target of ['Pepsi', 'Colombiana'])
  test(`a guessed ${target} keeps the unavailable-option reason`, async () => {
    const { agent, h, products } = setup();
    let requests = 0;
    jest.spyOn(global, 'fetch').mockImplementation(async () => {
      requests++;
      return requests < 3
        ? response({
            content: null,
            tool_calls: [
              call(
                {
                  productId: 5221,
                  cartLineIndex: 0,
                  attributeName: 'Bebida',
                  attributeValue: requests === 1 ? 'Naranja' : target,
                },
                String(requests),
              ),
            ],
          })
        : response({ content: 'Listo, ya cambié la bebida.' });
    });
    const result = await agent.runTurn(
      input(
        products,
        h.conv.sessionData.cart,
        'Por favor cambia la bebida a Naranja para acompañar el pedido',
      ),
    );
    expect(result.rejectedAttributeChoices?.[0]).toMatchObject({
      reason: 'unknown_option',
      attributeValue: 'Naranja',
    });
    expect(result.actions).toEqual({});
  });

test('identical variants show notes before the customer chooses the owner', async () => {
  const { h } = setup('building_cart', true);
  h.conv.sessionData.cart[1].attributes = structuredClone(
    h.conv.sessionData.cart[0].attributes,
  );
  h.conv.sessionData.cart[1].quantity = 2;
  h.agent.runTurn.mockResolvedValue({
    reply: 'Listo, cambié la bebida.',
    actions: {},
    toolCalls: ['set_attribute'],
    rejectedAttributeChoices: [
      {
        productId: 5221,
        attributeName: 'Bebida',
        attributeValue: 'Pepsi',
        reason: 'ambiguous_cart_line',
      },
    ],
  });
  const before = structuredClone(h.conv.sessionData.cart);
  const reply = await h.sendQueued('Ayúdame a ajustar mi pedido por favor');
  expect(reply).toMatch(/Sin cebolla/);
  expect(reply).toMatch(/Salsa aparte/);
  expect(h.conv.sessionData.cart).toEqual(before);
  await h.sendQueued('2');
  await h.sendQueued('3');
  expect(h.conv.sessionData.cart[0]).toEqual(before[0]);
  expect(h.conv.sessionData.cart[1]).toMatchObject({
    quantity: 2,
    note: 'Salsa aparte',
  });
  expect(h.conv.sessionData.cart[1].attributes).toContainEqual({
    attributeName: 'Bebida',
    attributeValue: 'Pepsi',
  });
});

for (const interruption of [
  'price',
  'cancel',
  'expired',
  'cart changed',
  'catalog changed',
])
  test(`unavailable-option clarification survives ${interruption}`, async () => {
    const { h, products } = setup();
    h.agent.runTurn.mockResolvedValue({
      reply: 'Listo, ya cambié la bebida.',
      actions: {},
      toolCalls: ['set_attribute'],
      rejectedAttributeChoices: [
        {
          productId: 5221,
          cartLineIndex: 0,
          attributeName: 'Bebida',
          attributeValue: 'Naranja',
          reason: 'unknown_option',
        },
      ],
    });
    const before = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('Ayúdame a ajustar mi pedido por favor');
    expect(h.conv.sessionData.pendingCartOptionChoice?.selected).toBe(0);
    if (interruption === 'price') {
      const reply = await h.sendQueued('Cuánto vale el combo?');
      expect(reply).toMatch(/22.000/);
      expect(h.conv.sessionData.cart).toEqual(before);
      await h.sendQueued('3');
      expect(h.conv.sessionData.cart[0].attributes).toContainEqual({
        attributeName: 'Bebida',
        attributeValue: 'Pepsi',
      });
      return;
    }
    if (interruption === 'expired')
      h.conv.sessionData.pendingCartOptionChoice!.createdAt -= 11 * 60 * 1000;
    if (interruption === 'cart changed')
      h.conv.sessionData.cart[0].quantity = 3;
    if (interruption === 'catalog changed') products[0].price = 25000;
    const snapshot = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued(interruption === 'cancel' ? 'mejor no' : '3');
    expect(h.conv.sessionData.cart).toEqual(snapshot);
    expect(h.conv.sessionData.pendingCartOptionChoice).toBeUndefined();
  });

for (const named of [false, true])
  test(`multiple products require a grounded owner ${named}`, async () => {
    const { h, products } = setup();
    products.push({
      ...structuredClone(products[0]),
      id: 5222,
      code: 12,
      name: 'Combo De Lentejas',
    });
    h.conv.sessionData.cart.push({
      ...structuredClone(h.conv.sessionData.cart[0]),
      productId: 5222,
      code: 12,
      name: 'Combo De Lentejas',
      quantity: 1,
      note: 'Sin sal',
    });
    h.agent.runTurn.mockResolvedValue({
      reply: 'Listo, ya cambié la bebida.',
      actions: {},
      toolCalls: ['set_attribute'],
      rejectedAttributeChoices: [
        {
          productId: 5221,
          cartLineIndex: 0,
          attributeName: 'Bebida',
          attributeValue: 'Naranja',
          reason: 'unknown_option',
        },
      ],
    });
    const before = structuredClone(h.conv.sessionData.cart);
    const text = named
      ? 'Ayúdame a ajustar las opciones de mi Combo De Lentejas por favor'
      : 'Ayúdame a ajustar mi pedido por favor';
    const reply = await h.sendQueued(text);
    expect(h.agent.runTurn).toHaveBeenCalled();
    expect(h.conv.sessionData.cart).toEqual(before);
    if (named) {
      expect(reply).not.toMatch(/Combo De Tofu/);
      expect(h.conv.sessionData.pendingCartOptionChoice?.selected).toBe(0);
    } else {
      expect(reply).toMatch(/Combo De Tofu/);
      expect(reply).toMatch(/Combo De Lentejas/);
      await h.sendQueued('3');
    }
    await h.sendQueued('3');
    expect(h.conv.sessionData.cart[0]).toEqual(before[0]);
    expect(h.conv.sessionData.cart[1].attributes).toContainEqual({
      attributeName: 'Bebida',
      attributeValue: 'Pepsi',
    });
  });

for (const reason of [
  'unknown_option',
  'unknown_attribute',
  'ambiguous_cart_line',
] as const)
  for (const mode of ['exception', 'max_iterations'])
    test(`${reason} survives ${mode}`, async () => {
      const { agent, h, products } = setup(
        'building_cart',
        reason === 'ambiguous_cart_line',
      );
      let requests = 0;
      jest.spyOn(global, 'fetch').mockImplementation(async () => {
        requests++;
        if (mode === 'exception' && requests > 1)
          throw new Error('synthetic transport failure');
        return response({
          content: null,
          tool_calls: [
            call(
              {
                productId: 5221,
                ...(reason === 'ambiguous_cart_line'
                  ? {}
                  : { cartLineIndex: 0 }),
                attributeName:
                  reason === 'unknown_attribute' ? 'Tamaño' : 'Bebida',
                attributeValue:
                  reason === 'unknown_option' ? 'Naranja' : 'Pepsi',
              },
              String(requests),
            ),
          ],
        });
      });
      const result = await agent.runTurn(
        input(
          products,
          h.conv.sessionData.cart,
          'Ayúdame a ajustar mi pedido por favor',
        ),
      );
      expect(result.error).toBe(mode);
      expect(result.actions).toEqual({});
      expect(result.rejectedAttributeChoices?.[0]).toMatchObject({ reason });
    });

test('an open purchase offer survives an unrelated rejected option', async () => {
  const { h, products } = setup();
  const offer = {
    productId: 5221,
    code: 11,
    name: products[0].name,
    price: 22000,
    quantity: 1,
    createdAt: Date.now(),
  };
  h.conv.sessionData.pendingAddOffer = offer;
  h.agent.runTurn.mockResolvedValue({
    reply: 'Listo, ya cambié la bebida.',
    actions: {},
    toolCalls: ['set_attribute'],
    rejectedAttributeChoices: [
      {
        productId: 5221,
        cartLineIndex: 0,
        attributeName: 'Bebida',
        attributeValue: 'Naranja',
        reason: 'unknown_option',
      },
    ],
  });
  const before = structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('Ayúdame a ajustar mi pedido por favor');
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(h.conv.sessionData.pendingAddOffer).toEqual(offer);
  expect(h.conv.sessionData.pendingCartOptionChoice).toBeUndefined();
});

test('a product without attributes explains the catalog limitation', async () => {
  const { h, products } = setup();
  products[0].attributes = [];
  products[0].hasAttributes = false;
  h.conv.sessionData.cart[0].attributes = [];
  h.agent.runTurn.mockResolvedValue({
    reply: 'Listo, ya hice el cambio.',
    actions: {},
    toolCalls: ['set_attribute'],
    rejectedAttributeChoices: [
      {
        productId: 5221,
        cartLineIndex: 0,
        attributeName: 'Tamaño',
        attributeValue: 'Grande',
        reason: 'unknown_attribute',
      },
    ],
  });
  const before = structuredClone(h.conv.sessionData.cart);
  const reply = await h.sendQueued('Ayúdame a ajustar mi pedido por favor');
  expect(reply).toMatch(/carta.*opciones configuradas/i);
  expect(reply).not.toMatch(/ya hice/);
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(h.conv.sessionData.pendingCartOptionChoice).toBeUndefined();
});

for (const reason of [
  'unknown_option',
  'unknown_attribute',
  'ambiguous_cart_line',
] as const)
  test(`Responses forwards the ${reason} receipt`, async () => {
    const { h, products } = setup(
      'building_cart',
      reason === 'ambiguous_cart_line',
    );
    let requests = 0;
    const agent = new WhatsappAgentService(
      {
        getEffectiveConfig: async () => ({
          openaiApiKey: 'synthetic-key',
          openaiModel: 'gpt-6-luna',
          systemPrompt: '',
          localContext: {},
        }),
      } as never,
      new WhatsappCatalogService({} as never),
    );
    jest.spyOn(global, 'fetch').mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      requests++;
      expect(body.input).toBeDefined();
      if (requests === 1)
        return new Response(
          JSON.stringify({
            status: 'completed',
            output: [
              {
                type: 'function_call',
                call_id: 'choice',
                name: 'set_attribute',
                arguments: JSON.stringify({
                  productId: 5221,
                  ...(reason === 'ambiguous_cart_line'
                    ? {}
                    : { cartLineIndex: 0 }),
                  attributeName:
                    reason === 'unknown_attribute' ? 'Tamaño' : 'Bebida',
                  attributeValue:
                    reason === 'unknown_option' ? 'Naranja' : 'Pepsi',
                }),
              },
            ],
          }),
        );
      const receipt = body.input.findLast(
        (item: any) => item.type === 'function_call_output',
      );
      expect(receipt.call_id).toBe('choice');
      expect(JSON.parse(receipt.output).ok).toBe(false);
      return new Response(
        JSON.stringify({
          status: 'completed',
          output: [
            {
              type: 'message',
              role: 'assistant',
              content: [
                { type: 'output_text', text: 'Listo, ya hice el cambio.' },
              ],
            },
          ],
        }),
      );
    });
    const result = await agent.runTurn(
      input(
        products,
        h.conv.sessionData.cart,
        'Ayúdame a ajustar mi pedido por favor',
      ),
    );
    expect(requests).toBe(2);
    expect(result.rejectedAttributeChoices?.[0]).toMatchObject({ reason });
    expect(result.actions).toEqual({});
  });
