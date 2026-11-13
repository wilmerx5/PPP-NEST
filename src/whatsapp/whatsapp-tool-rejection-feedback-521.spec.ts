import { WhatsappAgentService } from './whatsapp-agent.service';
import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { harness } from './whatsapp-accuracy.test-support';

const products = [
  {
    id: 5211,
    code: 11,
    name: 'Combo De Falafel',
    price: 24000,
    availableNow: true,
    hasAttributes: true,
    attributes: [
      { attributeName: 'Bebida', options: ['Colombiana', 'Manzana', 'Pepsi'] },
      { attributeName: 'Salsa', options: ['Suave', 'Picante'] },
    ],
  },
];
const cart = () => [
  {
    productId: 5211,
    name: 'Combo De Falafel',
    quantity: 2,
    note: 'Sin cebolla',
    attributes: [
      { attributeName: 'Bebida', attributeValue: 'Colombiana' },
      { attributeName: 'Salsa', attributeValue: 'Suave' },
    ],
  },
];
const service = (model = 'gpt-4o-mini') =>
  new WhatsappAgentService(
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
const call = (name: string, args: object, id = 'choice') => ({
  id,
  type: 'function',
  function: { name, arguments: JSON.stringify(args) },
});
const response = (message: object) =>
  new Response(JSON.stringify({ choices: [{ message }] }));
const input = (userMessage: string) => ({
  userMessage,
  sessionSummary: 'Carrito abierto',
  recentMessages: [],
  businessRulesBlock: '',
  brandName: 'Restaurante de prueba',
  products,
  cart: cart(),
});

afterEach(() => jest.restoreAllMocks());

for (const model of ['gpt-4o-mini', 'gpt-6-luna']) {
  for (const [message, field, value] of [
    ['¿Podemos cambiar la bebida?', 'Bebida', 'Manzana'],
    ['Qué otro sabor de gaseosa tienes?', 'Bebida', 'Pepsi'],
    ['Cambio de gaseosa', 'Bebida', 'Pepsi'],
    ['Quiero cambiar la salsa', 'Salsa', 'Picante'],
    ['Si', 'Bebida', 'Manzana'],
  ])
    test(`${model} reports unchosen ${field} before the next inference for ${message}`, async () => {
      const agent = service(model);
      const snapshot = input(message);
      const original = structuredClone(snapshot.cart);
      const requests: any[] = [];
      jest.spyOn(global, 'fetch').mockImplementation(async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        requests.push(body);
        if (requests.length === 1) {
          const args = {
            productId: 5211,
            cartLineIndex: 0,
            attributeName: field,
            attributeValue: value,
          };
          return body.input
            ? new Response(
                JSON.stringify({
                  status: 'completed',
                  output: [
                    {
                      type: 'function_call',
                      call_id: 'choice',
                      name: 'set_attribute',
                      arguments: JSON.stringify(args),
                    },
                  ],
                }),
              )
            : response({
                content: null,
                tool_calls: [call('set_attribute', args)],
              });
        }
        const output = body.input
          ? body.input.findLast((m: any) => m.type === 'function_call_output')
              .output
          : body.messages.findLast((m: any) => m.role === 'tool').content;
        expect(JSON.parse(output)).toMatchObject({
          ok: false,
          error: 'missing_explicit_option_choice',
          productId: 5211,
          cartLineIndex: 0,
          attributeName: field,
          options: products[0].attributes.find(
            (a) => a.attributeName === field,
          )!.options,
        });
        const text = `¿Cuál ${field.toLowerCase()} prefieres?`;
        return body.input
          ? new Response(
              JSON.stringify({
                status: 'completed',
                output: [
                  {
                    type: 'message',
                    role: 'assistant',
                    content: [{ type: 'output_text', text }],
                  },
                ],
              }),
            )
          : response({ content: text });
      });
      const result = await agent.runTurn(snapshot);
      expect(requests).toHaveLength(2);
      expect(result.actions).toEqual({});
      expect(result.error).toBeUndefined();
      expect(result.reply).toMatch(/prefieres/);
      expect(snapshot.cart).toEqual(original);
    });
}

for (const [field, value] of [
  ['Bebida', 'Pepsi'],
  ['Salsa', 'Picante'],
]) {
  test(`explicit ${value} remains accepted for ${field}`, async () => {
    const agent = service();
    let requests = 0;
    jest.spyOn(global, 'fetch').mockImplementation(async () => {
      requests++;
      return requests === 1
        ? response({
            content: null,
            tool_calls: [
              call('set_attribute', {
                productId: 5211,
                cartLineIndex: 0,
                attributeName: field,
                attributeValue: value,
              }),
            ],
          })
        : response({ content: 'Listo, cambié la opción.' });
    });
    const result = await agent.runTurn(
      input(
        `¿Podemos cambiar la ${field.toLowerCase()}? Con ${value}, por favor`,
      ),
    );
    expect(result.actions.updateAttributes).toEqual([
      {
        productId: 5211,
        cartLineIndex: 0,
        attributeName: field,
        attributeValue: value,
      },
    ]);
  });
}

for (const state of ['building_cart', 'awaiting_final_confirm'])
  test(`full router persists choice and closes once in ${state}`, async () => {
    const h = harness(products, true);
    h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
    h.service.ordersService.create = jest
      .fn()
      .mockResolvedValue({ id: 521, dailyOrderNumber: 521 });
    h.service.ordersService.findTodayOrdersByPhone = jest
      .fn()
      .mockResolvedValue([]);
    Object.assign(h.conv.sessionData, {
      cart: cart().map((line) => ({ ...line, code: 11, unitPrice: 24000 })),
      fulfillmentChosen: true,
      phoneConfirmed: true,
      contactPhone: h.conv.phoneE164,
      notesCollected: true,
    });
    h.conv.state = state;
    const agent = service();
    h.agent.runTurn.mockImplementation((value) => agent.runTurn(value));
    let requests = 0;
    jest.spyOn(global, 'fetch').mockImplementation(async () => {
      requests++;
      return requests === 1
        ? response({
            content: null,
            tool_calls: [
              call('set_attribute', {
                productId: 5211,
                cartLineIndex: 0,
                attributeName: 'Bebida',
                attributeValue: 'Manzana',
              }),
            ],
          })
        : response({ content: '¿Cuál bebida prefieres?' });
    });
    const before = structuredClone(h.conv.sessionData.cart);
    const reply = await h.sendQueued('¿Podemos cambiar la bebida?');
    expect(reply).toMatch(/Pepsi/);
    expect(reply).not.toMatch(/Algo más|qué plato/i);
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.conv.sessionData.pendingCartOptionChoice?.selected).toBe(0);
    await h.sendQueued('3');
    expect(h.conv.sessionData.cart[0]).toMatchObject({
      quantity: 2,
      note: 'Sin cebolla',
    });
    expect(h.conv.sessionData.cart[0].attributes).toContainEqual({
      attributeName: 'Bebida',
      attributeValue: 'Pepsi',
    });
    await h.sendQueued('no más, recojo en el local');
    await h.sendQueued('efectivo');
    await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    expect(requests).toBe(2);
  });

test('repeated rejected tools and get_cart preserve the original projection', async () => {
  const agent = service();
  let requests = 0;
  jest.spyOn(global, 'fetch').mockImplementation(async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    requests++;
    if (requests <= 2) {
      if (requests === 2)
        expect(
          JSON.parse(
            body.messages.findLast(
              (message: any) => message.name === 'set_attribute',
            ).content,
          ).ok,
        ).toBe(false);
      return response({
        content: null,
        tool_calls: [
          call(
            'set_attribute',
            {
              productId: 5211,
              cartLineIndex: 0,
              attributeName: 'Bebida',
              attributeValue: 'Manzana',
            },
            `bad-${requests}`,
          ),
          call('get_cart', {}, `cart-${requests}`),
        ],
      });
    }
    const results = body.messages.filter((m: any) => m.name === 'get_cart');
    expect(results).toHaveLength(2);
    for (const result of results) {
      expect(result.content).toContain('Colombiana');
      expect(result.content).not.toContain('Manzana');
    }
    return response({ content: '¿Cuál bebida prefieres?' });
  });
  const result = await agent.runTurn(input('¿Podemos cambiar la bebida?'));
  expect(requests).toBe(3);
  expect(result.actions).toEqual({});
  expect(result.error).toBeUndefined();
});

test('an address cannot authorize the model drink tool', () => {
  const agent = service();
  const actions = {};
  const result = JSON.parse(
    (agent as any).executeTool(
      'set_attribute',
      {
        productId: 5211,
        cartLineIndex: 0,
        attributeName: 'Bebida',
        attributeValue: 'Manzana',
      },
      {
        products,
        byId: new Map(products.map((product) => [product.id, product])),
        actions,
        diagnosticOrigin: 'model_call',
        userMessage: 'Manzana 4 casa 8 torre 2',
        cart: cart(),
        setNeedsAttr: () => undefined,
      },
    ),
  );
  expect(result).toMatchObject({
    ok: false,
    error: 'missing_explicit_option_choice',
  });
  expect(actions).toEqual({});
});

for (const [args, expected] of [
  [
    { attributeName: 'Bebida', attributeValue: 'Naranja' },
    'opción no existe en ese atributo',
  ],
  [
    { attributeName: 'Tamaño', attributeValue: 'Grande' },
    'ese producto no tiene ese atributo',
  ],
] as const)
  test(`existing catalog rejection remains available to the model for ${expected}`, async () => {
    const agent = service();
    let requests = 0;
    jest.spyOn(global, 'fetch').mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      requests++;
      if (requests === 1)
        return response({
          content: null,
          tool_calls: [
            call('set_attribute', {
              productId: 5211,
              cartLineIndex: 0,
              ...args,
            }),
          ],
        });
      expect(JSON.parse(body.messages.at(-1).content)).toMatchObject({
        ok: false,
        error: expected,
      });
      return response({ content: '¿Cuál opción prefieres?' });
    });
    const result = await agent.runTurn(
      input('Quiero cambiar una opción del combo'),
    );
    expect(requests).toBe(2);
    expect(result.actions).toEqual({});
  });

test('a later explicitly supported choice clears only its unresolved rejection', async () => {
  const agent = service();
  let requests = 0;
  jest.spyOn(global, 'fetch').mockImplementation(async () => {
    requests++;
    if (requests < 3)
      return response({
        content: null,
        tool_calls: [
          call(
            'set_attribute',
            {
              productId: 5211,
              cartLineIndex: 0,
              attributeName: 'Bebida',
              attributeValue: requests === 1 ? 'Manzana' : 'Pepsi',
            },
            `choice-${requests}`,
          ),
        ],
      });
    return response({ content: 'Listo, queda Pepsi.' });
  });
  const result = await agent.runTurn(
    input('Por favor cambia la bebida por Pepsi para acompañar el pedido'),
  );
  expect(requests).toBe(3);
  expect(result.error).toBeUndefined();
  expect(result.rejectedAttributeChoices).toBeUndefined();
  expect(result.actions.updateAttributes).toEqual([
    {
      productId: 5211,
      cartLineIndex: 0,
      attributeName: 'Bebida',
      attributeValue: 'Pepsi',
    },
  ]);
});

test('the router suppresses a false acknowledgement even after rejected actions were removed', async () => {
  const h = harness(products, true);
  h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
  h.conv.sessionData.cart = cart().map((line) => ({
    ...line,
    code: 11,
    unitPrice: 24000,
  }));
  const before = structuredClone(h.conv.sessionData.cart);
  h.agent.runTurn.mockResolvedValue({
    reply: 'Listo, cambié tu bebida a Manzana.',
    actions: {},
    toolCalls: ['set_attribute'],
    rejectedAttributeChoices: [
      {
        productId: 5211,
        cartLineIndex: 0,
        attributeName: 'Bebida',
        attributeValue: 'Manzana',
      },
    ],
  });
  const reply = await h.sendQueued(
    'Puedes ayudarme a ajustar mi pedido por favor',
  );
  expect(h.agent.runTurn).toHaveBeenCalled();
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(reply).not.toMatch(/Listo|cambi[eé].*Manzana/i);
  expect(reply).toMatch(/cambio|opci[oó]n/);
});

for (const failure of ['exception', 'max_iterations'])
  test(`unresolved choice survives ${failure}`, async () => {
    const agent = service();
    let requests = 0;
    jest.spyOn(global, 'fetch').mockImplementation(async () => {
      requests++;
      if (failure === 'exception' && requests > 1)
        throw new Error('synthetic transport failure');
      return response({
        content: null,
        tool_calls: [
          call(
            'set_attribute',
            {
              productId: 5211,
              cartLineIndex: 0,
              attributeName: 'Bebida',
              attributeValue: 'Manzana',
            },
            `choice-${requests}`,
          ),
        ],
      });
    });
    const result = await agent.runTurn(input('¿Podemos cambiar la bebida?'));
    expect(result.error).toBe(failure);
    expect(result.actions).toEqual({});
    expect(result.rejectedAttributeChoices).toEqual([
      {
        productId: 5211,
        cartLineIndex: 0,
        attributeName: 'Bebida',
        attributeValue: 'Manzana',
      },
    ]);
  });

test('a different accepted field leaves the drink rejection unresolved', async () => {
  const agent = service();
  let requests = 0;
  jest.spyOn(global, 'fetch').mockImplementation(async () => {
    requests++;
    return requests === 1
      ? response({
          content: null,
          tool_calls: [
            call(
              'set_attribute',
              {
                productId: 5211,
                cartLineIndex: 0,
                attributeName: 'Bebida',
                attributeValue: 'Manzana',
              },
              'drink',
            ),
            call(
              'set_attribute',
              {
                productId: 5211,
                cartLineIndex: 0,
                attributeName: 'Salsa',
                attributeValue: 'Picante',
              },
              'sauce',
            ),
          ],
        })
      : response({ content: '¿Cuál bebida prefieres?' });
  });
  const result = await agent.runTurn(
    input(
      'Necesito cambiar la salsa por Picante y revisar la bebida del pedido',
    ),
  );
  expect(result.actions.updateAttributes).toEqual([
    {
      productId: 5211,
      cartLineIndex: 0,
      attributeName: 'Salsa',
      attributeValue: 'Picante',
    },
  ]);
  expect(result.rejectedAttributeChoices).toEqual([
    {
      productId: 5211,
      cartLineIndex: 0,
      attributeName: 'Bebida',
      attributeValue: 'Manzana',
    },
  ]);
});
