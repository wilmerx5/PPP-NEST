import { WhatsappAgentService } from './whatsapp-agent.service';
import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { harness } from './whatsapp-accuracy.test-support';

function setup(state = 'building_cart', model = 'gpt-4o-mini') {
  const products = [
    {
      id: 5271,
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
      id: 5272,
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
    .mockResolvedValue({ id: 527, dailyOrderNumber: 527 });
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
        productId: 5271,
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

function variants() {
  const s = setup();
  s.h.conv.sessionData.cart.push({
    ...structuredClone(s.h.conv.sessionData.cart[0]),
    quantity: 1,
    note: 'Con sal',
    attributes: [{ attributeName: 'Bebida', attributeValue: 'Manzana' }],
  });
  return s;
}

for (const tool of ['update_item', 'remove_item']) {
  for (const [text, index] of [
    ['Ayúdame a ajustar el Combo De Tofu', 0],
    ['Ayúdame a ajustar el Combo De Tofu', 1],
    ['Cambia el de Manzana', 0],
    ['Cambia el que lleva Colombiana', 1],
    ['Cambia la línea 2', 0],
    ['Cambia la línea 1 y la línea 2', 0],
    ['Cambia la línea 2, el de Colombiana', 1],
    ['Cambia el combo, dirección calle 2 número 1', 0],
    ['Cambia el combo, no quites el de Manzana', 1],
  ] as const) {
    test(`${tool} rejects an unproven owner ${index} ${text}`, async () => {
      const s = variants();
      let requests = 0;
      jest.spyOn(global, 'fetch').mockImplementation(async () =>
        ++requests === 1
          ? response({
              content: null,
              tool_calls: [
                call(tool, {
                  productId: 5271,
                  cartLineIndex: index,
                  ...(tool === 'update_item' ? { quantity: 3 } : {}),
                }),
              ],
            })
          : response({ content: 'Listo.' }),
      );
      const result = await s.agent.runTurn(input(s, text));
      expect(result.actions.updateCartLines).toBeUndefined();
      expect(result.actions.removeCartLines).toBeUndefined();
      expect(result.rejectedCartEdits).toEqual([
        {
          tool,
          productId: 5271,
          cartLineIndex: index,
          reason: 'ambiguous_cart_owner',
        },
      ]);
    });
  }
  for (const [text, index] of [
    ['Cambia el de Manzana', 1],
    ['Cambia el que lleva Colombiana', 0],
    ['Cambia la línea 2', 1],
    ['Cambia el que tiene Sin cebolla', 0],
    ['Cambia el de Manzana, no agregues otro', 1],
  ] as const) {
    test(`${tool} accepts the explicit source ${index} ${text}`, async () => {
      const s = variants();
      let requests = 0;
      jest.spyOn(global, 'fetch').mockImplementation(async () =>
        ++requests === 1
          ? response({
              content: null,
              tool_calls: [
                call(tool, {
                  productId: 5271,
                  cartLineIndex: index,
                  ...(tool === 'update_item' ? { quantity: 3 } : {}),
                }),
              ],
            })
          : response({ content: 'Listo.' }),
      );
      const result = await s.agent.runTurn(input(s, text));
      expect(result.rejectedCartEdits).toBeUndefined();
      expect(
        tool === 'update_item'
          ? result.actions.updateCartLines
          : result.actions.removeCartLines,
      ).toEqual([
        {
          productId: 5271,
          cartLineIndex: index,
          ...(tool === 'update_item' ? { quantity: 3 } : {}),
        },
      ]);
    });
  }
}

for (const tool of ['update_item', 'remove_item']) {
  test(`${tool} clears a mistaken index only after the customer source matches`, async () => {
    const s = variants();
    let requests = 0;
    jest.spyOn(global, 'fetch').mockImplementation(async () => {
      if (++requests < 3)
        return response({
          content: null,
          tool_calls: [
            call(tool, {
              productId: 5271,
              cartLineIndex: requests === 1 ? 0 : 1,
              ...(tool === 'update_item' ? { quantity: 3 } : {}),
            }),
          ],
        });
      return response({ content: 'Listo.' });
    });
    const result = await s.agent.runTurn(input(s, 'Cambia el de Manzana'));
    expect(result.rejectedCartEdits).toBeUndefined();
    expect(
      tool === 'update_item'
        ? result.actions.updateCartLines
        : result.actions.removeCartLines,
    ).toEqual([
      {
        productId: 5271,
        cartLineIndex: 1,
        ...(tool === 'update_item' ? { quantity: 3 } : {}),
      },
    ]);
  });
  for (const state of ['building_cart', 'awaiting_final_confirm']) {
    test(`${tool} protects the mixed plan and later confirmation in ${state}`, async () => {
      const s = variants();
      s.h.conv.state = state;
      s.h.conv.sessionData.paymentMethod = 'cash';
      let requests = 0;
      jest.spyOn(global, 'fetch').mockImplementation(async () =>
        ++requests === 1
          ? response({
              content: null,
              tool_calls: [
                call(tool, {
                  productId: 5271,
                  cartLineIndex: 0,
                  ...(tool === 'update_item' ? { quantity: 3 } : {}),
                }),
                call('add_item', { productId: 5272, quantity: 1 }, 'purchase'),
              ],
            })
          : response({
              content: 'Listo, cambié el pedido y agregué el hummus.',
            }),
      );
      const before = structuredClone(s.h.conv.sessionData.cart);
      const text =
        'Ayúdame a cambiar el Combo De Tofu y agrega una Porcion De Hummus';
      expect(
        await s.h.service.tryHandleAgentV1({
          conv: s.h.conv,
          msg: {
            waId: 'customer',
            phoneE164: s.h.conv.phoneE164,
            messageId: 'owner',
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
        }),
      ).toBe(true);
      expect(s.h.conv.sessionData.cart).toEqual(before);
      expect(s.h.replies.at(-1)).toMatch(/varias variantes/i);
      expect(s.h.replies.at(-1)).not.toMatch(/cambi[eé] el pedido|agregu[eé]/i);
      s.h.agent.runTurn.mockResolvedValue({
        reply: '',
        actions: {},
        toolCalls: [],
      });
      await s.h.sendQueued('cuánto llevo en total');
      await s.h.sendQueued('sí');
      expect(s.h.service.ordersService.create).not.toHaveBeenCalled();
      await s.h.sendQueued('cancela ese cambio');
      expect(
        s.h.conv.sessionData.pendingReplacementClarification,
      ).toBeUndefined();
      await s.h.sendQueued('no más, recojo en el local');
      await s.h.sendQueued('efectivo');
      await s.h.sendQueued('confirmar');
      expect(s.h.service.ordersService.create).toHaveBeenCalledTimes(1);
    });
  }
}

for (const index of [0, 1]) {
  test(`a requested new note does not select its matching beverage owner ${index}`, async () => {
    const s = variants();
    let requests = 0;
    jest.spyOn(global, 'fetch').mockImplementation(async () =>
      ++requests === 1
        ? response({
            content: null,
            tool_calls: [
              call('update_item', {
                productId: 5271,
                cartLineIndex: index,
                note: 'Manzana',
              }),
            ],
          })
        : response({ content: 'Listo.' }),
    );
    const result = await s.agent.runTurn(input(s, 'Pon la nota de Manzana'));
    expect(result.actions.updateCartLines).toBeUndefined();
    expect(result.rejectedCartEdits?.[0].reason).toBe('ambiguous_cart_owner');
  });
}

test('a previous option edit retains the original source for the later quantity edit', async () => {
  const s = variants();
  let requests = 0;
  jest
    .spyOn(global, 'fetch')
    .mockImplementation(async () =>
      ++requests === 1
        ? response({
            content: null,
            tool_calls: [
              call('set_attribute', {
                productId: 5271,
                cartLineIndex: 0,
                attributeName: 'Bebida',
                attributeValue: 'Pepsi',
              }),
              call(
                'update_item',
                { productId: 5271, cartLineIndex: 0, quantity: 3 },
                'quantity',
              ),
            ],
          })
        : response({ content: 'Listo.' }),
    );
  const result = await s.agent.runTurn(
    input(
      s,
      'Cambia la bebida del que lleva Colombiana a Pepsi y ajusta su cantidad a tres',
    ),
  );
  expect(result.rejectedCartEdits).toBeUndefined();
  expect(result.actions.updateCartLines).toEqual([
    { productId: 5271, cartLineIndex: 0, quantity: 3 },
  ]);
  expect(result.actions.updateAttributes?.[0].attributeValue).toBe('Pepsi');
});

test('removing a variant does not authorize redirecting its later edit to the remaining row', async () => {
  const s = variants();
  let requests = 0;
  jest
    .spyOn(global, 'fetch')
    .mockImplementation(async () =>
      ++requests === 1
        ? response({
            content: null,
            tool_calls: [
              call('remove_item', { productId: 5271, cartLineIndex: 1 }),
              call(
                'update_item',
                { productId: 5271, cartLineIndex: 0, quantity: 3 },
                'redirect',
              ),
            ],
          })
        : response({ content: 'Listo.' }),
    );
  const result = await s.agent.runTurn(
    input(s, 'Quita el de Manzana y cambia el de Manzana'),
  );
  expect(result.actions.updateCartLines).toBeUndefined();
  expect(result.rejectedCartEdits?.[0]).toMatchObject({
    tool: 'update_item',
    cartLineIndex: 0,
    reason: 'ambiguous_cart_owner',
  });
});
