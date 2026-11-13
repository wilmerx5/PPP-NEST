import { WhatsappAgentService } from './whatsapp-agent.service';
import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { harness } from './whatsapp-accuracy.test-support';

function setup(state = 'building_cart', model = 'gpt-4o-mini') {
  const products = [
    {
      id: 5281,
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
      id: 5282,
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
    .mockResolvedValue({ id: 528, dailyOrderNumber: 528 });
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
        productId: 5281,
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

async function openChoice(
  state = 'building_cart',
  tool = 'update_item',
  edit: object = { quantity: 3 },
  configure?: (s: ReturnType<typeof variants>) => void,
  options: {
    includePurchase?: boolean;
    cartLineIndex?: number | null;
    sourceText?: string;
  } = {},
) {
  const s = variants();
  const includePurchase = options.includePurchase !== false;
  const cartLineIndex =
    options.cartLineIndex === null ? undefined : (options.cartLineIndex ?? 0);
  configure?.(s);
  s.h.conv.state = state;
  s.h.conv.sessionData.paymentMethod = 'cash';
  let requests = 0;
  jest.spyOn(global, 'fetch').mockImplementation(async () =>
    ++requests === 1
      ? response({
          content: null,
          tool_calls: [
            call(tool, {
              productId: 5281,
              cartLineIndex,
              ...(tool === 'update_item' ? edit : {}),
            }),
            ...(includePurchase
              ? [call('add_item', { productId: 5282, quantity: 1 }, 'purchase')]
              : []),
          ],
        })
      : response({ content: 'Listo, cambié el pedido y agregué el hummus.' }),
  );
  const text =
    options.sourceText ??
    'Ayúdame a cambiar el Combo De Tofu' +
      (includePurchase ? ' y agrega una Porcion De Hummus' : '');
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
  });
  s.h.agent.runTurn.mockResolvedValue({
    reply: '',
    actions: {},
    toolCalls: [],
  });
  return s;
}

for (const state of ['building_cart', 'awaiting_final_confirm']) {
  for (const tool of ['update_item', 'remove_item']) {
    test(`a numeric owner choice commits the complete plan ${state} ${tool}`, async () => {
      const { h } = await openChoice(state, tool);
      const before = structuredClone(h.conv.sessionData.cart);
      expect(
        h.conv.sessionData.pendingReplacementClarification?.ownerChoice,
      ).toBeDefined();
      expect(h.replies.at(-1)).toMatch(/varias variantes/i);
      expect(h.replies.join(' ')).toMatch(/Hummus/);
      await h.sendQueued('2');
      expect(
        h.conv.sessionData.pendingReplacementClarification,
      ).toBeUndefined();
      expect(h.conv.sessionData.cart[0]).toEqual(before[0]);
      if (tool === 'update_item')
        expect(h.conv.sessionData.cart[1]).toMatchObject({
          ...before[1],
          quantity: 3,
        });
      else
        expect(
          h.conv.sessionData.cart.some((line) =>
            line.attributes?.some((a) => a.attributeValue === 'Manzana'),
          ),
        ).toBe(false);
      expect(
        h.conv.sessionData.cart.find((line) => line.productId === 5282),
      ).toMatchObject({ quantity: 1 });
      expect(h.conv.state).toBe(state);
      expect(h.agent.runTurn).toHaveBeenCalledTimes(1);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      await h.sendQueued('no más, recojo en el local');
      await h.sendQueued('efectivo');
      await h.sendQueued('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    });
  }
}

for (const state of ['building_cart', 'awaiting_final_confirm']) {
  for (const note of ['Salsa aparte', '']) {
    test(`the selected note is complete and scoped ${state} ${JSON.stringify(note)}`, async () => {
      const { h } = await openChoice(state, 'update_item', { note });
      const before = structuredClone(h.conv.sessionData.cart);
      await h.sendQueued('2');
      expect(h.conv.sessionData.cart[0]).toEqual(before[0]);
      expect(h.conv.sessionData.cart[1].note || '').toBe(note);
      expect(h.conv.sessionData.cart[1].quantity).toBe(1);
      expect(h.conv.sessionData.cart[1].attributes).toEqual(
        before[1].attributes,
      );
      expect(
        h.conv.sessionData.cart.find((line) => line.productId === 5282)
          ?.quantity,
      ).toBe(1);
      expect(
        h.conv.sessionData.pendingReplacementClarification,
      ).toBeUndefined();
    });
  }
}

for (const query of [
  'cuánto llevo en total',
  'cuánto vale la Porcion De Hummus',
  'qué trae el Combo De Tofu',
]) {
  test(`an intermediate query preserves the complete choice ${query}`, async () => {
    const { h } = await openChoice();
    const before = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued(query);
    expect(h.conv.sessionData.pendingAddOffer).toBeUndefined();
    expect(h.conv.sessionData.pendingCatalogInquiry).toBeUndefined();
    expect((h.replies.at(-1)?.match(/\?/g) || []).length).toBe(1);
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(
      h.conv.sessionData.pendingReplacementClarification?.ownerChoice,
    ).toBeDefined();
    await h.sendQueued('2');
    expect(h.conv.sessionData.cart[1].quantity).toBe(3);
    expect(
      h.conv.sessionData.cart.find((line) => line.productId === 5282)?.quantity,
    ).toBe(1);
  });
}

for (const answer of ['opción 2', 'la 2', '2 porfa', 'dos']) {
  test(`a customer choice phrase selects the row ${answer}`, async () => {
    const { h } = await openChoice();
    await h.sendQueued(answer);
    expect(h.conv.sessionData.cart[1].quantity).toBe(3);
    expect(h.conv.sessionData.pendingReplacementClarification).toBeUndefined();
  });
}

for (const answer of [
  'sí',
  '99',
  '2?',
  '0',
  '-1',
  'la -1',
  '-1 porfa',
  '−1',
  '(-1)',
]) {
  test(`an acknowledgement or invalid choice preserves the plan ${answer}`, async () => {
    const { h } = await openChoice('awaiting_final_confirm');
    const before = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued(answer);
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(
      h.conv.sessionData.pendingReplacementClarification?.ownerChoice,
    ).toBeDefined();
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    expect(h.replies.at(-1)).toMatch(/variantes/i);
  });
}

for (const changed of ['expired', 'cart', 'price', 'options']) {
  test(`a changed selection cannot replay later ${changed}`, async () => {
    const { h, products } = await openChoice();
    h.service.catalogService.getMenuProducts.mockResolvedValue(products);
    if (changed === 'expired')
      h.conv.sessionData.pendingReplacementClarification!.ownerChoice!.createdAt -=
        16 * 60 * 1000;
    if (changed === 'cart') h.conv.sessionData.cart[0].quantity += 1;
    if (changed === 'price') products[0].price += 1000;
    if (changed === 'options') products[0].attributes[0].options.push('Uva');
    const before = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('2');
    await h.sendQueued('2');
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(
      h.conv.sessionData.pendingReplacementClarification?.ownerChoice
        ?.invalidated,
    ).toBe(true);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    expect(h.replies.at(-1)).toMatch(/venció|cambió/i);
  });
}

for (const answer of ['no', 'cancela ese cambio', 'reiniciar']) {
  test(`the customer can discard the complete pending plan ${answer}`, async () => {
    const { h } = await openChoice();
    const before = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued(answer);
    expect(h.conv.sessionData.pendingReplacementClarification).toBeUndefined();
    expect(h.conv.sessionData.cart).toEqual(
      answer === 'reiniciar' ? [] : before,
    );
    expect(
      h.conv.sessionData.cart.some((line) => line.productId === 5282),
    ).toBe(false);
  });
}

for (const limits of [{ maxUnitsPerItem: 4 }, { maxCartLines: 2 }]) {
  test(`a late cart limit preserves both parts of the plan ${JSON.stringify(limits)}`, async () => {
    const { h } = await openChoice();
    Object.assign(h.cfg, limits);
    const before = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('2');
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(
      h.conv.sessionData.pendingReplacementClarification?.ownerChoice
        ?.invalidated,
    ).toBe(true);
    expect(h.replies.at(-1)).toMatch(/límites/i);
  });
}

test('closed hours retain the plan for a later allowed choice', async () => {
  const { h } = await openChoice();
  h.cfg.ignoreBusinessHours = false;
  h.service.businessService.getStatus = jest
    .fn()
    .mockResolvedValue({ isOpen: false, message: 'Cerrado' });
  const before = structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('2');
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(
    h.conv.sessionData.pendingReplacementClarification?.ownerChoice,
  ).toBeDefined();
  expect(h.replies.at(-1)).toMatch(/cerrad/i);
});

test('the choice survives persisted JSON without another model turn', async () => {
  const { h } = await openChoice();
  h.conv.sessionData = JSON.parse(JSON.stringify(h.conv.sessionData));
  await h.sendQueued('2');
  expect(h.conv.sessionData.cart[1].quantity).toBe(3);
  expect(
    h.conv.sessionData.cart.find((line) => line.productId === 5282)?.quantity,
  ).toBe(1);
  expect(h.agent.runTurn).toHaveBeenCalledTimes(1);
});

test('repeating the number after success does not repeat the purchase', async () => {
  const { h } = await openChoice('awaiting_final_confirm');
  await h.sendQueued('2');
  const after = structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('2');
  expect(h.conv.sessionData.cart).toEqual(after);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
});

test('different proposed quantities require a complete clarification', async () => {
  const { h } = await openChoice(
    'building_cart',
    'update_item',
    { quantity: 3 },
    (s) => {
      s.agent.runTurn = jest.fn().mockResolvedValue({
        reply: 'Listo.',
        actions: {},
        toolCalls: ['update_item'],
        rejectedCartEdits: [
          {
            tool: 'update_item',
            productId: 5281,
            cartLineIndex: 0,
            reason: 'ambiguous_cart_owner',
            quantity: 3,
          },
          {
            tool: 'update_item',
            productId: 5281,
            cartLineIndex: 1,
            reason: 'ambiguous_cart_owner',
            quantity: 4,
          },
        ],
      });
    },
  );
  expect(
    h.conv.sessionData.pendingReplacementClarification?.ownerChoice,
  ).toBeUndefined();
  expect(h.conv.sessionData.cart).toHaveLength(2);
});

test('an existing option selection keeps its original ownership', async () => {
  const { h } = await openChoice(
    'building_cart',
    'update_item',
    { quantity: 3 },
    (s) => {
      Object.assign(s.h.conv.sessionData, {
        pendingAttribute: {
          productId: 5282,
          name: 'Porcion De Hummus',
          code: 12,
          price: 7000,
          attributes: [{ attributeName: 'Sabor', options: ['Mango', 'Lulo'] }],
          selected: [],
          sourceText: 'Hummus',
        },
      });
    },
  );
  expect(
    h.conv.sessionData.pendingReplacementClarification?.ownerChoice,
  ).toBeUndefined();
  expect(h.conv.sessionData.pendingAttribute).toBeDefined();
});

test('a completed order does not open a cart-edit choice', async () => {
  const { h } = await openChoice('completed');
  expect(
    h.conv.sessionData.pendingReplacementClarification?.ownerChoice,
  ).toBeUndefined();
});

test('paused products invalidate the retained plan', async () => {
  const { h, products } = await openChoice();
  h.service.catalogService.getMenuProducts.mockResolvedValue(
    products.map((product) => ({ ...product, availableNow: false })),
  );
  const before = structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('2');
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(
    h.conv.sessionData.pendingReplacementClarification?.ownerChoice
      ?.invalidated,
  ).toBe(true);
});

test('long variant lists can be paged before applying a selected owner', async () => {
  const { h } = await openChoice(
    'building_cart',
    'update_item',
    { quantity: 3 },
    (s) => {
      s.h.conv.sessionData.cart = Array.from({ length: 20 }, (_, index) => ({
        ...structuredClone(s.h.conv.sessionData.cart[0]),
        quantity: 1,
        note: `${index + 1} ${'Empaque individual '.repeat(12)}`,
      }));
    },
  );
  expect(h.replies.at(-1)).toMatch(/siguientes/);
  await h.sendQueued('siguientes');
  expect(h.replies.at(-1)).toMatch(/anteriores/);
  expect(h.replies.every((reply) => reply.length <= 3800)).toBe(true);
  for (
    let page = 0;
    page < 10 && !/^20\./m.test(h.replies.at(-1) || '');
    page++
  )
    await h.sendQueued('siguientes');
  expect(h.replies.at(-1)).toMatch(/^20\./m);
  await h.sendQueued('20');
  expect(h.conv.sessionData.cart.some((line) => line.productId === 5282)).toBe(
    true,
  );
  expect(h.conv.sessionData.cart[19].quantity).toBe(3);
});

for (const tool of ['update_item', 'remove_item']) {
  test(`an edit without new purchases can select its owner ${tool}`, async () => {
    const { h } = await openChoice(
      'building_cart',
      tool,
      { quantity: 3 },
      undefined,
      { includePurchase: false },
    );
    expect(
      h.conv.sessionData.pendingReplacementClarification?.ownerChoice,
    ).toBeDefined();
    await h.sendQueued('2');
    expect(h.conv.sessionData.pendingReplacementClarification).toBeUndefined();
    expect(h.conv.sessionData.cart).toHaveLength(
      tool === 'remove_item' ? 1 : 2,
    );
    expect(
      h.conv.sessionData.cart.some((line) => line.productId === 5282),
    ).toBe(false);
  });
}

test('a menu code cannot select the same numbered cart variant', async () => {
  const { h } = await openChoice();
  const before = structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('#2');
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(
    h.conv.sessionData.pendingReplacementClarification?.ownerChoice,
  ).toBeDefined();
});

for (const [answer, index] of [
  ['el de Manzana', 1],
  ['Manzana', 1],
  ['el que lleva Colombiana', 0],
  ['la de Con sal', 1],
] as const) {
  test(`an explicit current option or note selects its owner ${answer}`, async () => {
    const { h } = await openChoice();
    const before = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued(answer);
    expect(h.conv.sessionData.cart[index].quantity).toBe(3);
    expect(h.conv.sessionData.cart[1 - index]).toEqual(before[1 - index]);
    expect(
      h.conv.sessionData.cart.find((line) => line.productId === 5282)?.quantity,
    ).toBe(1);
    expect(h.conv.sessionData.pendingReplacementClarification).toBeUndefined();
  });
}

test('a negative reply after a cart change keeps the stale selection inactive', async () => {
  const { h } = await openChoice();
  h.conv.sessionData.cart.pop();
  const before = structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('-1');
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(
    h.conv.sessionData.pendingReplacementClarification?.ownerChoice
      ?.invalidated,
  ).toBe(true);
});

test('a configured destination that is not a current variant cannot choose an owner', async () => {
  const { h } = await openChoice();
  const before = structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('Pepsi');
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(
    h.conv.sessionData.pendingReplacementClarification?.ownerChoice,
  ).toBeDefined();
  expect(h.replies.at(-1)).toMatch(/variantes/i);
});

test('another active option keeps ownership of its numeric reply', async () => {
  const { h, products } = await openChoice();
  const side = {
    ...products[1],
    hasAttributes: true,
    attributes: [{ attributeName: 'Sabor', options: ['Mango', 'Lulo'] }],
  };
  h.service.catalogService.getMenuProducts.mockResolvedValue([
    products[0],
    side,
  ]);
  h.conv.sessionData.pendingAttribute = {
    productId: side.id,
    name: side.name,
    code: side.code,
    price: side.price,
    attributes: side.attributes,
    selected: [],
    sourceText: side.name,
  };
  h.conv.state = 'awaiting_attribute';
  const before = structuredClone(h.conv.sessionData.cart);
  expect(
    await h.service.tryHandleRejectedReplacementFollowup(
      h.conv,
      'customer',
      h.conv.sessionData,
      'no',
      h.cfg,
    ),
  ).toBe(false);
  expect(h.conv.sessionData.pendingAttribute).toBeDefined();
  const handled = await h.service.tryHandleRejectedReplacementFollowup(
    h.conv,
    'customer',
    h.conv.sessionData,
    '2',
    h.cfg,
  );
  expect(handled).toBe(false);
  expect(
    h.conv.sessionData.pendingReplacementClarification?.ownerChoice
      ?.invalidated,
  ).toBe(true);
  expect(h.conv.sessionData.cart).toEqual(before);
  await h.sendQueued('2');
  expect(h.conv.sessionData.cart[0]).toEqual(before[0]);
  expect(h.conv.sessionData.cart[1]).toEqual(before[1]);
  expect(
    h.conv.sessionData.cart.find((line) => line.productId === side.id)
      ?.attributes,
  ).toContainEqual({ attributeName: 'Sabor', attributeValue: 'Lulo' });
});

for (const tool of ['update_item', 'remove_item']) {
  for (const index of [null, 99]) {
    test(`an omitted or invalid model index can be clarified ${tool} ${index}`, async () => {
      const { h } = await openChoice(
        'building_cart',
        tool,
        { quantity: 3 },
        undefined,
        { cartLineIndex: index },
      );
      expect(
        h.conv.sessionData.pendingReplacementClarification?.ownerChoice,
      ).toBeDefined();
      const first = structuredClone(h.conv.sessionData.cart[0]);
      await h.sendQueued('2');
      expect(h.conv.sessionData.cart[0]).toEqual(first);
      expect(
        h.conv.sessionData.cart.find((line) => line.productId === 5282)
          ?.quantity,
      ).toBe(1);
      expect(
        h.conv.sessionData.pendingReplacementClarification,
      ).toBeUndefined();
    });
  }
  test(`a source-proven retry resolves an initially omitted index ${tool}`, async () => {
    const s = variants();
    let requests = 0;
    jest.spyOn(global, 'fetch').mockImplementation(async () => {
      if (++requests < 3)
        return response({
          content: null,
          tool_calls: [
            call(tool, {
              productId: 5281,
              ...(requests === 2 ? { cartLineIndex: 1 } : {}),
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
        productId: 5281,
        cartLineIndex: 1,
        ...(tool === 'update_item' ? { quantity: 3 } : {}),
      },
    ]);
  });
}

test('a missing owner with an invalid quantity cannot offer a partial note edit', async () => {
  const { h } = await openChoice(
    'building_cart',
    'update_item',
    { quantity: 0, note: 'Salsa aparte' },
    undefined,
    { cartLineIndex: null },
  );
  expect(
    h.conv.sessionData.pendingReplacementClarification?.ownerChoice,
  ).toBeUndefined();
  expect(h.conv.sessionData.cart[0].note).toBe('Sin cebolla');
});

for (const rejectedPurchase of [true, false]) {
  test(`an incomplete extra purchase keeps the full clarification ${rejectedPurchase}`, async () => {
    const { h } = await openChoice(
      'building_cart',
      'update_item',
      { quantity: 3 },
      (s) => {
        s.agent.runTurn = jest.fn().mockResolvedValue({
          reply: 'Listo.',
          actions: {},
          toolCalls: ['update_item'],
          rejectedCartEdits: [
            {
              tool: 'update_item',
              productId: 5281,
              cartLineIndex: 0,
              reason: 'ambiguous_cart_owner',
              quantity: 3,
            },
          ],
          ...(rejectedPurchase
            ? {
                purchaseAttempts: [
                  { productId: 9999, accepted: false, reason: 'unavailable' },
                ],
              }
            : {}),
        });
      },
      {
        sourceText: rejectedPurchase
          ? 'Cambia el Combo De Tofu y una pizza'
          : 'Cambia el Combo De Tofu y agrega algo más',
      },
    );
    expect(
      h.conv.sessionData.pendingReplacementClarification?.ownerChoice,
    ).toBeUndefined();
    expect(h.conv.sessionData.cart).toHaveLength(2);
  });
}
