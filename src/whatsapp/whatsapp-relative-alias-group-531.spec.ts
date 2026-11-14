import { harness } from './whatsapp-accuracy.test-support';

function setup(state = 'building_cart', pending = true) {
  const products = [
    {
      id: 5311,
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
      id: 5312,
      code: 12,
      name: 'Porcion De Hummus',
      price: 7000,
      availableNow: true,
      hasAttributes: false,
      attributes: [],
    },
    {
      id: 5313,
      code: 13,
      name: 'Pan De Ajo',
      price: 3000,
      availableNow: true,
      hasAttributes: false,
      attributes: [],
    },
  ];
  const h = harness(products, true);
  h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
  h.service.ordersService.create = jest
    .fn()
    .mockResolvedValue({ id: 531, dailyOrderNumber: 531 });
  h.service.ordersService.findTodayOrdersByPhone = jest
    .fn()
    .mockResolvedValue([]);
  h.conv.state = state;
  Object.assign(h.conv.sessionData, {
    fulfillmentChosen: true,
    phoneConfirmed: true,
    contactPhone: h.conv.phoneE164,
    notesCollected: true,
    paymentMethod: 'cash',
    cart: [
      {
        productId: 5311,
        code: 11,
        name: products[0].name,
        unitPrice: 22000,
        quantity: 2,
        note: 'Sin sal',
        attributes: [{ attributeName: 'Bebida', attributeValue: 'Colombiana' }],
      },
      {
        productId: 5311,
        code: 11,
        name: products[0].name,
        unitPrice: 22000,
        quantity: 1,
        note: 'Salsa aparte',
        attributes: [{ attributeName: 'Bebida', attributeValue: 'Manzana' }],
      },
      {
        productId: 5313,
        code: 13,
        name: products[2].name,
        unitPrice: 3000,
        quantity: 1,
        note: 'Para compartir',
        attributes: [],
      },
    ],
  });
  if (pending)
    h.conv.sessionData.pendingReplacementClarification = {
      cartSignature: JSON.stringify(h.conv.sessionData.cart),
      ownerChoice: {
        tool: 'update_item',
        productId: 5311,
        quantity: 3,
        addItems: [
          { productId: 5312, quantity: 4 },
          { productId: 5313, quantity: 2 },
        ],
        sourceText:
          'Cambia el Combo De Tofu y agrega cuatro Porcion De Hummus y dos Pan De Ajo',
        cartLineIndices: [0, 1],
        catalogFingerprint: h.service.cartEditOwnerFingerprint(
          products,
          [5311, 5312, 5313],
        ),
        createdAt: Date.now(),
      },
    };
  return { h, products };
}

afterEach(() => jest.restoreAllMocks());

for (const state of ['building_cart', 'awaiting_final_confirm']) {
  for (const text of [
    'Quítale una a la Porcion De Hummus',
    'Resta una Porcion De Hummus',
    'De las compras pendientes baja una de las Porcion De Hummus',
  ]) {
    test(`relative pending decrement ${state} ${text}`, async () => {
      const { h } = setup(state);
      const cart = structuredClone(h.conv.sessionData.cart);
      await h.sendQueued(text);
      expect(h.conv.sessionData.cart).toEqual(cart);
      expect(
        h.conv.sessionData.pendingReplacementClarification?.ownerChoice
          ?.addItems,
      ).toEqual([
        { productId: 5312, quantity: 3 },
        { productId: 5313, quantity: 2 },
      ]);
      await h.sendQueued('2');
      expect(h.conv.sessionData.cart[0]).toEqual(cart[0]);
      expect(h.conv.sessionData.cart[1]).toEqual({ ...cart[1], quantity: 3 });
      expect(
        h.conv.sessionData.cart.find((line) => line.productId === 5312)
          ?.quantity,
      ).toBe(3);
      expect(h.conv.state).toBe(state);
      expect(h.agent.runTurn).not.toHaveBeenCalled();
    });
  }
}

for (const text of [
  'No agregues el hummus',
  'No añadas las porciones de hummus',
  'No agregues los panes de ajo',
]) {
  test(`pending withdrawal uses an unambiguous alias ${text}`, async () => {
    const { h } = setup();
    const cart = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued(text);
    expect(h.conv.sessionData.cart).toEqual(cart);
    expect(
      h.conv.sessionData.pendingReplacementClarification?.ownerChoice?.addItems,
    ).toEqual(
      text.includes('panes')
        ? [{ productId: 5312, quantity: 4 }]
        : [{ productId: 5313, quantity: 2 }],
    );
    expect(h.replies.at(-1)).toMatch(/varias variantes/i);
  });
}

for (const state of ['building_cart', 'awaiting_final_confirm']) {
  test(`all-unit correction preserves different existing variants ${state}`, async () => {
    const { h } = setup(state, false);
    const cart = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('De los tres Combo De Tofu tres sin cebolla');
    expect(h.conv.sessionData.cart).toHaveLength(3);
    for (const index of [0, 1]) {
      expect(h.conv.sessionData.cart[index]).toEqual({
        ...cart[index],
        note: expect.stringContaining('sin cebolla'),
      });
      expect(h.conv.sessionData.cart[index].note).toContain(cart[index].note!);
    }
    expect(h.conv.sessionData.cart[2]).toEqual(cart[2]);
    const changed = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('De los tres Combo De Tofu tres sin cebolla');
    expect(h.conv.sessionData.cart).toEqual(changed);
    expect(h.conv.state).toBe(state);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
}

for (const value of ['0', '5', '999', '-1', '−1', '1.5']) {
  test(`invalid relative decrement retains the complete proposal ${value}`, async () => {
    const { h } = setup();
    const cart = structuredClone(h.conv.sessionData.cart);
    const purchases = structuredClone(
      h.conv.sessionData.pendingReplacementClarification!.ownerChoice!.addItems,
    );
    await h.sendQueued(`Quita ${value} Porcion De Hummus`);
    expect(h.conv.sessionData.cart).toEqual(cart);
    expect(
      h.conv.sessionData.pendingReplacementClarification?.ownerChoice?.addItems,
    ).toEqual(purchases);
    expect(
      h.conv.sessionData.pendingReplacementClarification?.ownerChoice
        ?.invalidated,
    ).toBe(true);
    await h.sendQueued('2');
    expect(h.conv.sessionData.cart).toEqual(cart);
  });
}

test('a decrement reaching zero withdraws only that proposed purchase', async () => {
  const { h } = setup();
  await h.sendQueued('Quítale cuatro al hummus');
  expect(
    h.conv.sessionData.pendingReplacementClarification?.ownerChoice?.addItems,
  ).toEqual([{ productId: 5313, quantity: 2 }]);
  await h.sendQueued('2');
  expect(h.conv.sessionData.cart.some((line) => line.productId === 5312)).toBe(
    false,
  );
});

for (const explicit of [false, true]) {
  test(`relative scope distinguishes existing and proposed purchases ${explicit}`, async () => {
    const { h } = setup();
    const cart = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued(
      (explicit ? 'De las compras pendientes ' : '') + 'resta una Pan De Ajo',
    );
    expect(h.conv.sessionData.cart).toEqual(cart);
    expect(
      h.conv.sessionData.pendingReplacementClarification?.ownerChoice
        ?.addItems[1].quantity,
    ).toBe(explicit ? 1 : 2);
    if (!explicit) {
      expect(
        h.conv.sessionData.pendingReplacementClarification?.ownerChoice
          ?.invalidated,
      ).toBe(true);
      return;
    }
    await h.sendQueued('2');
    expect(h.conv.sessionData.cart[2]).toEqual(cart[2]);
    expect(
      h.conv.sessionData.cart
        .filter((line) => line.productId === 5313)
        .map((line) => line.quantity),
    ).toEqual([1, 1]);
  });
}

test('separate relative instructions each subtract their requested units', async () => {
  const { h } = setup();
  await h.sendQueued('Quítale una al hummus');
  await h.sendQueued('Quítale una al hummus');
  expect(
    h.conv.sessionData.pendingReplacementClarification?.ownerChoice?.addItems[0]
      .quantity,
  ).toBe(2);
});

test('redelivery of one provider message cannot decrement twice', async () => {
  const { h } = setup();
  const original = h.service.conversationService.claimInboundMessage;
  const seen = new Set<string>();
  h.service.conversationService.claimInboundMessage = jest.fn(
    async (request) => {
      if (seen.has(request.waMessageId)) return null;
      seen.add(request.waMessageId);
      return original(request);
    },
  );
  await h.sendQueued('Quítale una al hummus', { messageId: 'relative-one' });
  await h.sendQueued('Quítale una al hummus', { messageId: 'relative-one' });
  expect(
    h.conv.sessionData.pendingReplacementClarification?.ownerChoice?.addItems[0]
      .quantity,
  ).toBe(3);
});

for (const changed of ['question', 'expiry', 'cart', 'catalog']) {
  test(`relative revision honors the existing guard ${changed}`, async () => {
    const { h, products } = setup();
    if (changed === 'expiry')
      h.conv.sessionData.pendingReplacementClarification!.ownerChoice!.createdAt = 0;
    if (changed === 'cart') h.conv.sessionData.cart[0].quantity += 1;
    if (changed === 'catalog') products[1].price += 1000;
    const cart = structuredClone(h.conv.sessionData.cart);
    const purchases = structuredClone(
      h.conv.sessionData.pendingReplacementClarification!.ownerChoice!.addItems,
    );
    await h.sendQueued(
      'Quítale una al hummus' + (changed === 'question' ? '?' : ''),
    );
    expect(h.conv.sessionData.cart).toEqual(cart);
    expect(
      h.conv.sessionData.pendingReplacementClarification?.ownerChoice?.addItems,
    ).toEqual(purchases);
    expect(
      h.conv.sessionData.pendingReplacementClarification?.ownerChoice
        ?.invalidated,
    ).toBe(changed === 'question' ? undefined : true);
  });
}

test('an alias with two catalog owners requires clarification', async () => {
  const { h, products } = setup();
  products.push({ ...products[1], id: 5314, code: 14, name: 'Hummus' });
  const cart = structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('No agregues hummus');
  expect(h.conv.sessionData.cart).toEqual(cart);
  expect(
    h.conv.sessionData.pendingReplacementClarification?.ownerChoice?.addItems,
  ).toHaveLength(2);
  expect(
    h.conv.sessionData.pendingReplacementClarification?.ownerChoice
      ?.invalidated,
  ).toBe(true);
});

for (const name of ['Porcion De Papa Francesa', 'Racion De Papa Francesa']) {
  test(`existing culinary aliases retain catalog qualifiers ${name}`, () => {
    const { h, products } = setup();
    const menu = [
      { ...products[1], name },
      { ...products[1], id: 5314, name: name + ' Grande' },
    ];
    const query = name.startsWith('Porcion')
      ? 'papas fritas'
      : 'raciones de papas fritas';
    expect(
      h.service.catalogService
        .findProductsByExactAlias(query, menu)
        .map((item) => item.id),
    ).toEqual([5312]);
    expect(
      h.service.catalogService
        .findProductsByExactAlias(query + ' grandes', menu)
        .map((item) => item.id),
    ).toEqual([5314]);
  });
}

for (const failure of ['conflict', 'length', 'partial', 'question', 'count']) {
  test(`a multi-line correction is atomic ${failure}`, async () => {
    const { h } = setup('building_cart', false);
    if (failure === 'conflict') h.conv.sessionData.cart[1].note = 'Con cebolla';
    if (failure === 'length') h.conv.sessionData.cart[1].note = 'x'.repeat(195);
    const cart = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued(
      `De los ${failure === 'count' ? 'cuatro' : 'tres'} Combo De Tofu ${failure === 'partial' ? 'dos' : 'tres'} sin cebolla${failure === 'question' ? '?' : ''}`,
    );
    expect(h.conv.sessionData.cart).toEqual(cart);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
}

for (const state of ['building_cart', 'awaiting_final_confirm']) {
  test(`an option correction covers several named products ${state}`, async () => {
    const { h, products } = setup(state, false);
    products.push({
      ...products[0],
      id: 5314,
      code: 14,
      name: 'Combo De Seitan',
    });
    h.conv.sessionData.cart.push({
      ...structuredClone(h.conv.sessionData.cart[0]),
      productId: 5314,
      code: 14,
      name: 'Combo De Seitan',
      quantity: 1,
    });
    const cart = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('La bebida de todos los combos que sea Pepsi');
    for (const index of [0, 1, 3])
      expect(h.conv.sessionData.cart[index]).toEqual({
        ...cart[index],
        attributes: [{ attributeName: 'Bebida', attributeValue: 'Pepsi' }],
      });
    expect(h.conv.sessionData.cart[2]).toEqual(cart[2]);
    expect(h.conv.state).toBe(state);
  });
}

for (const scenario of ['relative', 'group']) {
  test(`the corrected plan reaches one order ${scenario}`, async () => {
    const { h } = setup('awaiting_final_confirm', scenario === 'relative');
    if (scenario === 'relative') {
      await h.sendQueued('Quítale una al hummus');
      h.conv.sessionData = JSON.parse(JSON.stringify(h.conv.sessionData));
      await h.sendQueued('2');
    } else {
      await h.sendQueued('De los tres Combo De Tofu tres sin cebolla');
    }
    const cart = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('no más, recojo en el local');
    await h.sendQueued('efectivo');
    await h.sendQueued('confirmar');
    if (!h.service.ordersService.create.mock.calls.length)
      await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(
      cart.reduce((sum, line) => sum + line.quantity, 0),
    );
    expect(h.conv.state).toBe('completed');
  });
}

for (const text of ['Quítale-1 al hummus', 'Agrega solo-2 hummus']) {
  test(`a sign cannot become a positive quantity after normalization ${text}`, async () => {
    const { h } = setup();
    const cart = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued(text);
    expect(h.conv.sessionData.cart).toEqual(cart);
    expect(
      h.conv.sessionData.pendingReplacementClarification?.ownerChoice
        ?.addItems[0].quantity,
    ).toBe(4);
    expect(
      h.conv.sessionData.pendingReplacementClarification?.ownerChoice
        ?.invalidated,
    ).toBe(true);
  });
}

test('a persisted purchase without quantity retains the supported one-unit default', async () => {
  const { h } = setup();
  delete h.conv.sessionData.pendingReplacementClarification!.ownerChoice!
    .addItems[0].quantity;
  await h.sendQueued('Quítale una al hummus');
  expect(
    h.conv.sessionData.pendingReplacementClarification?.ownerChoice?.addItems,
  ).toEqual([{ productId: 5313, quantity: 2 }]);
});

test('a malformed persisted fractional quantity cannot be decremented', async () => {
  const { h } = setup();
  h.conv.sessionData.pendingReplacementClarification!.ownerChoice!.addItems[0].quantity = 2.5;
  const cart = structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('Quítale una al hummus');
  expect(h.conv.sessionData.cart).toEqual(cart);
  expect(
    h.conv.sessionData.pendingReplacementClarification?.ownerChoice
      ?.invalidated,
  ).toBe(true);
});

test('a single grouped line cannot truncate an existing note either', async () => {
  const { h } = setup('building_cart', false);
  h.conv.sessionData.cart = [h.conv.sessionData.cart[0]];
  h.conv.sessionData.cart[0].quantity = 3;
  h.conv.sessionData.cart[0].note = 'x'.repeat(195);
  const cart = structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('De los tres Combo De Tofu dos sin cebolla');
  expect(h.conv.sessionData.cart).toEqual(cart);
});

test('a grouped note cannot bypass a held cart-edit plan', async () => {
  const { h } = setup();
  const cart = structuredClone(h.conv.sessionData.cart);
  const pending = structuredClone(
    h.conv.sessionData.pendingReplacementClarification,
  );
  await h.sendQueued('De los tres Combo De Tofu tres sin cebolla');
  expect(h.conv.sessionData.cart).toEqual(cart);
  expect(h.conv.sessionData.pendingReplacementClarification).toEqual(pending);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
