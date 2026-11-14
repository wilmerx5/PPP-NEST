import { harness } from './whatsapp-accuracy.test-support';

function setup(state = 'building_cart', held = false) {
  const products = [
    {
      id: 5321,
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
      id: 5322,
      code: 12,
      name: 'Pan De Ajo',
      price: 3000,
      availableNow: true,
      hasAttributes: false,
      attributes: [],
    },
    {
      id: 5323,
      code: 13,
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
    .mockResolvedValue({ id: 532, dailyOrderNumber: 532 });
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
        productId: 5321,
        code: 11,
        name: products[0].name,
        unitPrice: 22000,
        quantity: 2,
        note: 'Sin sal',
        attributes: [{ attributeName: 'Bebida', attributeValue: 'Colombiana' }],
      },
      {
        productId: 5321,
        code: 11,
        name: products[0].name,
        unitPrice: 22000,
        quantity: 1,
        note: 'Salsa aparte',
        attributes: [{ attributeName: 'Bebida', attributeValue: 'Manzana' }],
      },
      {
        productId: 5322,
        code: 12,
        name: products[1].name,
        unitPrice: 3000,
        quantity: 1,
        note: 'Para compartir',
        attributes: [],
      },
    ],
  });
  if (held)
    h.conv.sessionData.pendingReplacementClarification = {
      cartSignature: JSON.stringify(h.conv.sessionData.cart),
      ownerChoice: {
        tool: 'update_item',
        productId: 5321,
        quantity: 3,
        addItems: [
          { productId: 5322, quantity: 4 },
          { productId: 5323, quantity: 1 },
        ],
        sourceText:
          'Cambia el Combo De Tofu y agrega cuatro Pan De Ajo y una Porcion De Hummus',
        cartLineIndices: [0, 1],
        catalogFingerprint: h.service.cartEditOwnerFingerprint(
          products,
          [5321, 5322, 5323],
        ),
        createdAt: Date.now(),
      },
    };
  return { h, products };
}

afterEach(() => jest.restoreAllMocks());

for (const state of ['building_cart', 'awaiting_final_confirm']) {
  test(`a partial note asks for a distribution and applies it atomically ${state}`, async () => {
    const { h } = setup(state);
    const cart = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('De los tres Combo De Tofu dos sin cebolla');
    expect(h.conv.sessionData.cart).toEqual(cart);
    expect(h.conv.sessionData.pendingSubsetKitchenNote).toMatchObject({
      quantity: 2,
      byUnits: true,
    });
    expect(h.replies.at(-1)).toMatch(/Colombiana/);
    expect(h.replies.at(-1)).toMatch(/Manzana/);
    await h.sendQueued('una de la 1 y una de la 2');
    expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeUndefined();
    const variants = h.conv.sessionData.cart.filter(
      (line) => line.productId === 5321,
    );
    expect(variants.map((line) => line.quantity)).toEqual([1, 1, 1]);
    expect(variants[0]).toEqual({ ...cart[0], quantity: 1 });
    expect(variants[1]).toEqual({
      ...cart[0],
      quantity: 1,
      note: expect.stringContaining('sin cebolla'),
    });
    expect(variants[2]).toEqual({
      ...cart[1],
      note: expect.stringContaining('sin cebolla'),
    });
    expect(h.conv.sessionData.cart.at(-1)).toEqual(cart[2]);
    expect(h.conv.state).toBe(state);
  });

  test(`a scope clarification resumes the held decrement ${state}`, async () => {
    const { h } = setup(state, true);
    const cart = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('Quítale una al Pan De Ajo');
    expect(h.conv.sessionData.cart).toEqual(cart);
    expect(h.replies.at(-1)).toMatch(/compra pendiente/i);
    await h.sendQueued('de las pendientes');
    expect(
      h.conv.sessionData.pendingReplacementClarification?.ownerChoice?.addItems,
    ).toEqual([
      { productId: 5322, quantity: 3 },
      { productId: 5323, quantity: 1 },
    ]);
    expect(h.conv.sessionData.cart).toEqual(cart);
    await h.sendQueued('2');
    expect(h.conv.sessionData.pendingReplacementClarification).toBeUndefined();
    expect(h.conv.sessionData.cart[2]).toEqual(cart[2]);
    expect(
      h.conv.sessionData.cart
        .filter((line) => line.productId === 5322)
        .map((line) => line.quantity),
    ).toEqual([1, 3]);
    expect(h.conv.state).toBe(state);
  });
}

for (const text of [
  'una de cada variante',
  'una de Colombiana y una de Manzana',
  'una de la primera y el resto de la segunda',
]) {
  test(`a complete partial distribution preserves all variants ${text}`, async () => {
    const { h } = setup();
    const cart = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('De los tres Combo De Tofu dos sin cebolla');
    await h.sendQueued(text);
    expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeUndefined();
    expect(
      h.conv.sessionData.cart
        .filter((line) => line.note?.includes('sin cebolla'))
        .reduce((sum, line) => sum + line.quantity, 0),
    ).toBe(2);
    expect(
      h.conv.sessionData.cart
        .filter((line) => line.productId === 5321)
        .reduce((sum, line) => sum + line.quantity, 0),
    ).toBe(3);
    expect(h.conv.sessionData.cart.at(-1)).toEqual(cart[2]);
    const changed = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('De los tres Combo De Tofu dos sin cebolla');
    expect(h.conv.sessionData.cart).toEqual(changed);
    expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeUndefined();
  });
}

for (const text of [
  'tres de la 1',
  'una de la 1 y dos de la 2',
  'una de la 1 y una de la 9',
  '-1 de la 1 y tres de la 2',
  'una de Combo De Tofu y una de la 2',
  'confirmar',
  'no más',
]) {
  test(`an invalid or incomplete distribution stays held ${text}`, async () => {
    const { h } = setup('awaiting_final_confirm');
    const cart = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('De los tres Combo De Tofu dos sin cebolla');
    await h.sendQueued(text);
    expect(h.conv.sessionData.cart).toEqual(cart);
    expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeDefined();
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
}

for (const changed of ['cart', 'expiry']) {
  test(`a counted note validates its persisted scope ${changed}`, async () => {
    const { h } = setup();
    await h.sendQueued('De los tres Combo De Tofu dos sin cebolla');
    if (changed === 'cart') h.conv.sessionData.cart.splice(0, 1);
    else
      h.conv.sessionData.pendingSubsetKitchenNote!.countedScope!.createdAt = 0;
    const cart = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('una de cada variante');
    expect(h.conv.sessionData.cart).toEqual(cart);
    expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeUndefined();
    expect(h.replies.at(-1)).toMatch(/cambió o venció/i);
  });
}

for (const failure of ['conflict', 'length', 'limit']) {
  test(`a partial distribution validates every result before saving ${failure}`, async () => {
    const { h } = setup();
    if (failure === 'conflict') h.conv.sessionData.cart[1].note = 'Con cebolla';
    if (failure === 'length') h.conv.sessionData.cart[1].note = 'x'.repeat(195);
    const cart = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('De los tres Combo De Tofu dos sin cebolla');
    if (failure === 'limit') Object.assign(h.cfg, { maxCartLines: 3 });
    await h.sendQueued('una de cada variante');
    expect(h.conv.sessionData.cart).toEqual(cart);
    expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeDefined();
    await h.sendQueued('no apliques esa nota');
    expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeUndefined();
    expect(h.conv.sessionData.cart).toEqual(cart);
  });
}

test('a split must include units already carrying the counted note', async () => {
  const { h } = setup();
  h.conv.sessionData.cart[1].note = 'sin cebolla';
  const cart = structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('De los tres Combo De Tofu dos sin cebolla');
  await h.sendQueued('1');
  expect(h.conv.sessionData.cart).toEqual(cart);
  await h.sendQueued('una de cada variante');
  expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeUndefined();
  expect(
    h.conv.sessionData.cart
      .filter((line) => line.note?.includes('sin cebolla'))
      .reduce((sum, line) => sum + line.quantity, 0),
  ).toBe(2);
});

test('a partial note survives serialization and a total question', async () => {
  const { h } = setup();
  await h.sendQueued('De los tres Combo De Tofu dos sin cebolla');
  const cart = structuredClone(h.conv.sessionData.cart);
  h.conv.sessionData = JSON.parse(JSON.stringify(h.conv.sessionData));
  await h.sendQueued('cuánto vale todo?');
  expect(h.conv.sessionData.cart).toEqual(cart);
  expect(h.replies.join(' ')).toMatch(/69.000/);
  await h.sendQueued('una de cada variante');
  expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeUndefined();
});

for (const answer of ['sí', 'de las pendientes', 'la compra pendiente']) {
  test(`a scope answer cannot select the old numeric owner ${answer}`, async () => {
    const { h } = setup('awaiting_final_confirm', true);
    const cart = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('Quítale una al Pan De Ajo');
    await h.sendQueued('1');
    await h.sendQueued('confirmar');
    expect(h.conv.sessionData.cart).toEqual(cart);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    h.conv.sessionData = JSON.parse(JSON.stringify(h.conv.sessionData));
    await h.sendQueued(answer);
    expect(
      h.conv.sessionData.pendingReplacementClarification?.ownerChoice
        ?.addItems[0].quantity,
    ).toBe(3);
    expect(
      h.conv.sessionData.pendingReplacementClarification?.ownerChoice
        ?.purchaseScope,
    ).toBeUndefined();
  });
}

for (const answer of ['no', 'cancelar esta reducción']) {
  test(`declining a scope question preserves the complete earlier plan ${answer}`, async () => {
    const { h } = setup('building_cart', true);
    const purchases = structuredClone(
      h.conv.sessionData.pendingReplacementClarification!.ownerChoice!.addItems,
    );
    await h.sendQueued('Quítale una al Pan De Ajo');
    await h.sendQueued(answer);
    expect(
      h.conv.sessionData.pendingReplacementClarification?.ownerChoice
        ?.purchaseScope,
    ).toBeUndefined();
    expect(
      h.conv.sessionData.pendingReplacementClarification?.ownerChoice?.addItems,
    ).toEqual(purchases);
    await h.sendQueued('2');
    expect(
      h.conv.sessionData.cart
        .filter((line) => line.productId === 5322)
        .map((line) => line.quantity),
    ).toEqual([1, 4]);
  });
}

for (const changed of ['cart', 'expiry', 'catalog']) {
  test(`scope confirmation cannot replay a stale decrement ${changed}`, async () => {
    const { h, products } = setup('building_cart', true);
    await h.sendQueued('Quítale una al Pan De Ajo');
    if (changed === 'cart') h.conv.sessionData.cart[0].quantity += 1;
    if (changed === 'expiry')
      h.conv.sessionData.pendingReplacementClarification!.ownerChoice!.createdAt = 0;
    if (changed === 'catalog') products[1].price += 1000;
    const cart = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('de las pendientes');
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

test('an unrelated purchase revision preserves the pending scope question', async () => {
  const { h } = setup('building_cart', true);
  await h.sendQueued('Quítale una al Pan De Ajo');
  await h.sendQueued('Agrega solo dos hummus');
  expect(
    h.conv.sessionData.pendingReplacementClarification?.ownerChoice?.addItems,
  ).toEqual([
    { productId: 5322, quantity: 4 },
    { productId: 5323, quantity: 2 },
  ]);
  expect(
    h.conv.sessionData.pendingReplacementClarification?.ownerChoice
      ?.purchaseScope,
  ).toMatchObject({ productId: 5322, quantity: 1 });
  await h.sendQueued('de las pendientes');
  expect(
    h.conv.sessionData.pendingReplacementClarification?.ownerChoice?.addItems,
  ).toEqual([
    { productId: 5322, quantity: 3 },
    { productId: 5323, quantity: 2 },
  ]);
});

test('a new absolute revision of the same purchase replaces the reduction question', async () => {
  const { h } = setup('building_cart', true);
  await h.sendQueued('Quítale una al Pan De Ajo');
  await h.sendQueued('Agrega solo cuatro Pan De Ajo');
  expect(
    h.conv.sessionData.pendingReplacementClarification?.ownerChoice
      ?.purchaseScope,
  ).toBeUndefined();
  expect(
    h.conv.sessionData.pendingReplacementClarification?.ownerChoice?.addItems[0]
      .quantity,
  ).toBe(4);
});

for (const requested of [1, 14])
  test(`a long variant list keeps global row indexes while paging ${requested}`, async () => {
    const { h, products } = setup();
    const options = Array.from(
      { length: 14 },
      (_, index) => `Bebida ${index + 1}`,
    );
    products[0].attributes[0].options = options;
    const control = structuredClone(h.conv.sessionData.cart[2]);
    const base = h.conv.sessionData.cart[0];
    h.conv.sessionData.cart = [
      ...options.map((value) => ({
        ...structuredClone(base),
        attributes: [{ attributeName: 'Bebida', attributeValue: value }],
      })),
      control,
    ];
    Object.assign(h.cfg, { maxCartLines: 30 });
    await h.sendQueued(`De los 28 Combo De Tofu ${requested} sin cebolla`);
    expect(h.replies.at(-1)).toMatch(/siguientes/);
    await h.sendQueued('siguientes');
    expect(h.replies.at(-1)).toMatch(/13\./);
    expect(h.replies.at(-1)).toMatch(/14\./);
    expect(h.replies.every((reply) => reply.length <= 4096)).toBe(true);
    await h.sendQueued(requested === 1 ? '14' : 'una de cada variante');
    expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeUndefined();
    expect(
      h.conv.sessionData.cart
        .filter((line) => line.note?.includes('sin cebolla'))
        .reduce((sum, line) => sum + line.quantity, 0),
    ).toBe(requested);
    expect(h.conv.sessionData.cart.at(-1)).toEqual(control);
  });

test('an excessive implicit decrement cannot create an impossible scope question', async () => {
  const { h } = setup('building_cart', true);
  const cart = structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('Quítale cinco al Pan De Ajo');
  expect(h.conv.sessionData.cart).toEqual(cart);
  expect(
    h.conv.sessionData.pendingReplacementClarification?.ownerChoice
      ?.purchaseScope,
  ).toBeUndefined();
  expect(
    h.conv.sessionData.pendingReplacementClarification?.ownerChoice
      ?.invalidated,
  ).toBe(true);
});

test('a second ambiguous reduction cannot overwrite the active question', async () => {
  const { h, products } = setup('building_cart', true);
  h.conv.sessionData.cart.push({
    productId: 5323,
    code: 13,
    name: products[2].name,
    unitPrice: 7000,
    quantity: 1,
    attributes: [],
  });
  h.conv.sessionData.pendingReplacementClarification!.cartSignature =
    JSON.stringify(h.conv.sessionData.cart);
  await h.sendQueued('Quítale una al Pan De Ajo');
  await h.sendQueued('Quítale una al hummus');
  expect(
    h.conv.sessionData.pendingReplacementClarification?.ownerChoice
      ?.purchaseScope,
  ).toMatchObject({ productId: 5322, quantity: 1 });
  expect(
    h.conv.sessionData.pendingReplacementClarification?.ownerChoice?.addItems,
  ).toEqual([
    { productId: 5322, quantity: 4 },
    { productId: 5323, quantity: 1 },
  ]);
  expect(h.replies.at(-1)).toMatch(/Pan De Ajo/);
});

test('scope clarification survives intermediate total and price queries', async () => {
  const { h } = setup('building_cart', true);
  const cart = structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('Quítale una al Pan De Ajo');
  const question = structuredClone(
    h.conv.sessionData.pendingReplacementClarification?.ownerChoice
      ?.purchaseScope,
  );
  await h.sendQueued('cuánto vale todo?');
  await h.sendQueued('cuánto vale Pan De Ajo?');
  expect(h.conv.sessionData.cart).toEqual(cart);
  expect(
    h.conv.sessionData.pendingReplacementClarification?.ownerChoice
      ?.purchaseScope,
  ).toEqual(question);
  expect(h.conv.sessionData.pendingAddOffer).toBeUndefined();
  expect(h.replies.join(' ')).toMatch(/3.000/);
  await h.sendQueued('de las pendientes');
  expect(
    h.conv.sessionData.pendingReplacementClarification?.ownerChoice?.addItems[0]
      .quantity,
  ).toBe(3);
});

for (const command of [
  'reiniciar',
  'cancelar el pedido',
  'cancela ese cambio',
]) {
  test(`a scope question respects explicit cancellation ${command}`, async () => {
    const { h } = setup('building_cart', true);
    const cart = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('Quítale una al Pan De Ajo');
    await h.sendQueued(command);
    expect(h.conv.sessionData.pendingReplacementClarification).toBeUndefined();
    expect(h.conv.sessionData.cart).toEqual(
      command === 'cancela ese cambio' ? cart : [],
    );
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
}

for (const scenario of ['partial', 'scope']) {
  test(`the resolved clarification reaches one complete order ${scenario}`, async () => {
    const { h } = setup('awaiting_final_confirm', scenario === 'scope');
    if (scenario === 'partial') {
      await h.sendQueued('De los tres Combo De Tofu dos sin cebolla');
      await h.sendQueued('una de cada variante');
    } else {
      await h.sendQueued('Quítale una al Pan De Ajo');
      await h.sendQueued('de las pendientes');
      await h.sendQueued('2');
    }
    const cart = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('no más, recojo en el local');
    await h.sendQueued('efectivo');
    await h.sendQueued('confirmar');
    if (!h.service.ordersService.create.mock.calls.length)
      await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const items = h.service.ordersService.create.mock.calls[0][0].items;
    expect(items).toHaveLength(
      cart.reduce((sum, line) => sum + line.quantity, 0),
    );
    for (const line of cart)
      expect(
        items.filter(
          (item) =>
            item.productId === line.productId && item.note === line.note,
        ),
      ).toHaveLength(line.quantity);
    expect(h.conv.state).toBe('completed');
  });
}
