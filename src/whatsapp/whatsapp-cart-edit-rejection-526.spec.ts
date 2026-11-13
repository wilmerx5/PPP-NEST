import { WhatsappAgentService } from './whatsapp-agent.service';
import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { harness } from './whatsapp-accuracy.test-support';

function setup(state = 'building_cart', model = 'gpt-4o-mini') {
  const products = [
    {
      id: 5261,
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
      id: 5262,
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
    .mockResolvedValue({ id: 526, dailyOrderNumber: 526 });
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
        productId: 5261,
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

const rejectedCases = [
  {
    name: 'update_item',
    args: { productId: 5261, cartLineIndex: 0, quantity: 0 },
    reason: 'invalid_quantity',
    text: 'Ayúdame a ajustar la cantidad del Combo De Tofu y agrega una Porcion De Hummus',
  },
  {
    name: 'update_item',
    args: { productId: 5261, cartLineIndex: 0 },
    reason: 'missing_change',
    text: 'Ayúdame a ajustar el Combo De Tofu y agrega una Porcion De Hummus',
  },
  {
    name: 'remove_item',
    args: { productId: 5261, cartLineIndex: 99 },
    reason: 'missing_or_ambiguous_cart_line',
    text: 'Ayúdame a quitar el Combo De Tofu y agrega una Porcion De Hummus',
  },
  {
    name: 'remove_item',
    args: { productId: 5261, cartLineIndex: 0 },
    reason: 'customer_requested_preserve_line',
    text: 'Conserva el Combo De Tofu y agrega una Porcion De Hummus',
  },
];

for (const state of ['building_cart', 'awaiting_final_confirm']) {
  for (const finish of ['acknowledgement', 'transport error']) {
    for (const edit of rejectedCases) {
      test(`rejected ${edit.reason} holds the mixed request ${state} ${finish}`, async () => {
        const s = setup(state);
        if (state === 'awaiting_final_confirm')
          s.h.conv.sessionData.paymentMethod = 'cash';
        let requests = 0;
        jest.spyOn(global, 'fetch').mockImplementation(async () => {
          if (++requests === 1)
            return response({
              content: null,
              tool_calls: [
                call(edit.name, edit.args),
                call('add_item', { productId: 5262, quantity: 1 }, 'purchase'),
              ],
            });
          if (finish === 'transport error')
            throw new Error('Synthetic transport error');
          return response({
            content: 'Listo, ya hice el cambio y agregué el hummus. ¿Algo más?',
          });
        });
        const before = structuredClone(s.h.conv.sessionData.cart);
        const handled = await s.h.service.tryHandleAgentV1({
          conv: s.h.conv,
          msg: {
            waId: 'customer',
            phoneE164: s.h.conv.phoneE164,
            messageId: 'edit',
            messageType: 'text',
            text: edit.text,
            raw: {},
          },
          session: s.h.conv.sessionData,
          text: edit.text,
          originalText: edit.text,
          products: s.products,
          cfg: s.h.cfg,
          status: { isOpen: true, message: 'Abierto' },
          businessOpenForBot: true,
          placedOrderOnly: state !== 'building_cart',
        });
        expect(handled).toBe(true);
        expect(s.h.conv.sessionData.cart).toEqual(before);
        expect(s.h.conv.state).toBe(state);
        expect(s.h.replies.at(-1)).not.toMatch(/ya hice|agregu[eé]|Algo más/i);
        expect((s.h.replies.at(-1)?.match(/\?/g) || []).length).toBe(1);
        expect(
          s.h.conv.sessionData.pendingReplacementClarification,
        ).toBeDefined();
        s.h.agent.runTurn.mockResolvedValue({
          reply: '',
          actions: {},
          toolCalls: [],
        });
        await s.h.sendQueued('sí');
        expect(s.h.service.ordersService.create).not.toHaveBeenCalled();
        expect(s.h.conv.sessionData.cart).toEqual(before);
        await s.h.sendQueued('cancela ese cambio');
        expect(
          s.h.conv.sessionData.pendingReplacementClarification,
        ).toBeUndefined();
        expect(s.h.conv.sessionData.cart).toEqual(before);
        await s.h.sendQueued('no más, recojo en el local');
        await s.h.sendQueued('efectivo');
        await s.h.sendQueued('confirmar');
        expect(s.h.service.ordersService.create).toHaveBeenCalledTimes(1);
      });
    }
  }
}

for (const name of ['update_item', 'remove_item']) {
  test(`a corrected ${name} retry clears its rejection`, async () => {
    const s = setup();
    let requests = 0;
    jest.spyOn(global, 'fetch').mockImplementation(async () => {
      if (++requests === 1)
        return response({
          content: null,
          tool_calls: [
            call(name, {
              productId: 5261,
              cartLineIndex: 0,
              ...(name === 'update_item'
                ? { quantity: 0 }
                : { cartLineIndex: 99 }),
            }),
          ],
        });
      if (requests === 2)
        return response({
          content: null,
          tool_calls: [
            call(
              name,
              {
                productId: 5261,
                cartLineIndex: 0,
                ...(name === 'update_item' ? { quantity: 3 } : {}),
              },
              'retry',
            ),
          ],
        });
      return response({ content: 'Listo.' });
    });
    const result = await s.agent.runTurn(
      input(
        s,
        name === 'remove_item'
          ? 'Quita el Combo De Tofu'
          : 'Deja tres Combo De Tofu',
      ),
    );
    expect(result.rejectedCartEdits).toBeUndefined();
    expect(
      name === 'remove_item'
        ? result.actions.removeCartLines
        : result.actions.updateCartLines,
    ).toHaveLength(1);
  });
}

test('a rejected quantity remains visible when another owner is edited', async () => {
  const s = setup();
  s.h.conv.sessionData.cart.push({
    ...structuredClone(s.h.conv.sessionData.cart[0]),
    note: 'Con sal',
  });
  let requests = 0;
  jest.spyOn(global, 'fetch').mockImplementation(async () =>
    ++requests === 1
      ? response({
          content: null,
          tool_calls: [
            call('update_item', {
              productId: 5261,
              cartLineIndex: 0,
              quantity: 0,
            }),
            call(
              'update_item',
              { productId: 5261, cartLineIndex: 1, quantity: 3 },
              'other',
            ),
          ],
        })
      : response({ content: 'Listo.' }),
  );
  const result = await s.agent.runTurn(
    input(s, 'Ajusta las cantidades de mis combos'),
  );
  expect(result.rejectedCartEdits).toEqual([
    {
      tool: 'update_item',
      productId: 5261,
      cartLineIndex: 0,
      reason: 'invalid_quantity',
    },
  ]);
});

test('a repeated successful removal does not invent an unresolved change', async () => {
  const s = setup();
  let requests = 0;
  jest.spyOn(global, 'fetch').mockImplementation(async () =>
    ++requests === 1
      ? response({
          content: null,
          tool_calls: [
            call('remove_item', { productId: 5261, cartLineIndex: 0 }),
            call(
              'remove_item',
              { productId: 5261, cartLineIndex: 0 },
              'repeat',
            ),
          ],
        })
      : response({ content: 'Listo.' }),
  );
  const result = await s.agent.runTurn(input(s, 'Quita el Combo De Tofu'));
  expect(result.rejectedCartEdits).toBeUndefined();
  expect(result.actions.removeCartLines).toHaveLength(1);
});

for (const name of ['update_item', 'remove_item']) {
  const args = {
    productId: 5261,
    cartLineIndex: 0,
    ...(name === 'update_item' ? { quantity: 0 } : { cartLineIndex: 99 }),
  };
  const reason =
    name === 'update_item'
      ? 'invalid_quantity'
      : 'missing_or_ambiguous_cart_line';
  test(`Responses preserves the rejected ${name} receipt`, async () => {
    const s = setup('building_cart', 'gpt-6-luna');
    let requests = 0;
    jest.spyOn(global, 'fetch').mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      expect(body.input).toBeDefined();
      if (++requests === 1)
        return new Response(
          JSON.stringify({
            status: 'completed',
            output: [
              {
                type: 'function_call',
                call_id: 'edit',
                name,
                arguments: JSON.stringify(args),
              },
            ],
          }),
        );
      const output = body.input.findLast(
        (item: { type: string }) => item.type === 'function_call_output',
      );
      expect(JSON.parse(output.output)).toMatchObject({
        ok: false,
        error: reason,
      });
      return new Response(
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
      );
    });
    const result = await s.agent.runTurn(
      input(s, 'Ayúdame a ajustar el Combo De Tofu'),
    );
    expect(result.rejectedCartEdits).toEqual([
      {
        tool: name,
        productId: 5261,
        cartLineIndex: args.cartLineIndex,
        reason,
      },
    ]);
  });

  for (const ending of ['http error', 'empty message', 'iteration limit']) {
    test(`${name} rejection survives ${ending}`, async () => {
      const s = setup();
      let requests = 0;
      jest.spyOn(global, 'fetch').mockImplementation(async () => {
        if (++requests === 1 || ending === 'iteration limit')
          return response({ content: null, tool_calls: [call(name, args)] });
        if (ending === 'http error')
          return new Response(
            JSON.stringify({ error: { code: 'synthetic_failure' } }),
            { status: 400 },
          );
        return new Response(JSON.stringify({ choices: [] }));
      });
      const result = await s.agent.runTurn(
        input(s, 'Ayúdame a ajustar el Combo De Tofu'),
      );
      expect(result.rejectedCartEdits).toEqual([
        {
          tool: name,
          productId: 5261,
          cartLineIndex: args.cartLineIndex,
          reason,
        },
      ]);
      expect(result.error).toBe(
        ending === 'http error'
          ? 'openai_400'
          : ending === 'empty message'
            ? 'empty_message'
            : 'max_iterations',
      );
    });
  }

  test(`corrected ${name} and purchase reach the final simulated order together`, async () => {
    const s = setup('building_cart');
    s.h.conv.sessionData.paymentMethod = 'cash';
    let requests = 0;
    jest.spyOn(global, 'fetch').mockImplementation(async () => {
      if (++requests === 1)
        return response({ content: null, tool_calls: [call(name, args)] });
      if (requests === 2)
        return response({
          content: null,
          tool_calls: [
            call(
              name,
              {
                productId: 5261,
                cartLineIndex: 0,
                ...(name === 'update_item' ? { quantity: 3 } : {}),
              },
              'retry',
            ),
            call('add_item', { productId: 5262, quantity: 1 }, 'purchase'),
          ],
        });
      return response({ content: 'Listo.' });
    });
    const text =
      name === 'update_item'
        ? 'Ayúdame a dejar tres Combo De Tofu y agrega una Porcion De Hummus'
        : 'Ayúdame a quitar el Combo De Tofu y agrega una Porcion De Hummus';
    await s.h.service.tryHandleAgentV1({
      conv: s.h.conv,
      msg: {
        waId: 'customer',
        phoneE164: s.h.conv.phoneE164,
        messageId: 'edit',
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
      placedOrderOnly: false,
    });
    expect(
      s.h.conv.sessionData.pendingReplacementClarification,
    ).toBeUndefined();
    expect(
      s.h.conv.sessionData.cart.find((line) => line.productId === 5262),
    ).toMatchObject({ quantity: 1 });
    if (name === 'update_item')
      expect(s.h.conv.sessionData.cart[0]).toMatchObject({
        productId: 5261,
        quantity: 3,
        note: 'Sin cebolla',
      });
    else
      expect(
        s.h.conv.sessionData.cart.some((line) => line.productId === 5261),
      ).toBe(false);
    s.h.agent.runTurn.mockResolvedValue({
      reply: '',
      actions: {},
      toolCalls: [],
    });
    await s.h.sendQueued('no más, recojo en el local');
    await s.h.sendQueued('efectivo');
    await s.h.sendQueued('confirmar');
    expect(s.h.service.ordersService.create).toHaveBeenCalledTimes(1);
  });
}

test('editing a new copy does not clear a rejected edit of the original owner', async () => {
  const s = setup();
  let requests = 0;
  jest.spyOn(global, 'fetch').mockImplementation(async () =>
    ++requests === 1
      ? response({
          content: null,
          tool_calls: [
            call('update_item', {
              productId: 5261,
              cartLineIndex: 0,
              quantity: 0,
            }),
            call('add_item', { productId: 5261, quantity: 1 }, 'purchase'),
            call(
              'update_item',
              { productId: 5261, cartLineIndex: 1, quantity: 3 },
              'other',
            ),
          ],
        })
      : response({ content: 'Listo.' }),
  );
  const result = await s.agent.runTurn(
    input(s, 'Agrega otro Combo De Tofu y ajusta las cantidades de mi pedido'),
  );
  expect(result.actions.addItems).toHaveLength(1);
  expect(result.actions.addItems![0].quantity).toBe(3);
  expect(result.rejectedCartEdits).toEqual([
    {
      tool: 'update_item',
      productId: 5261,
      cartLineIndex: 0,
      reason: 'invalid_quantity',
    },
  ]);
});

test('a successful update does not hide a later missing-owner update', async () => {
  const s = setup();
  let requests = 0;
  jest
    .spyOn(global, 'fetch')
    .mockImplementation(async () =>
      ++requests === 1
        ? response({
            content: null,
            tool_calls: [
              call('update_item', {
                productId: 5261,
                cartLineIndex: 0,
                quantity: 3,
              }),
              call(
                'update_item',
                { productId: 5261, cartLineIndex: 99, note: 'Salsa aparte' },
                'missing',
              ),
            ],
          })
        : response({ content: 'Listo.' }),
    );
  const result = await s.agent.runTurn(
    input(s, 'Deja tres Combo De Tofu con salsa aparte'),
  );
  expect(result.rejectedCartEdits).toEqual([
    {
      tool: 'update_item',
      productId: 5261,
      cartLineIndex: 99,
      reason: 'missing_or_ambiguous_cart_line',
    },
  ]);
});
