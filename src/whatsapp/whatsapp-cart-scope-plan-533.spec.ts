import { harness } from './whatsapp-accuracy.test-support';

function setup(state = 'building_cart', held = false) {
  const products = [
    {
      id: 5331,
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
      id: 5332,
      code: 12,
      name: 'Pan De Ajo',
      price: 3000,
      availableNow: true,
      hasAttributes: false,
      attributes: [],
    },
    {
      id: 5333,
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
    .mockResolvedValue({ id: 533, dailyOrderNumber: 533 });
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
        productId: 5331,
        code: 11,
        name: products[0].name,
        unitPrice: 22000,
        quantity: 2,
        note: 'Sin sal',
        attributes: [{ attributeName: 'Bebida', attributeValue: 'Colombiana' }],
      },
      {
        productId: 5331,
        code: 11,
        name: products[0].name,
        unitPrice: 22000,
        quantity: 1,
        note: 'Salsa aparte',
        attributes: [{ attributeName: 'Bebida', attributeValue: 'Manzana' }],
      },
      {
        productId: 5332,
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
        productId: 5331,
        quantity: 3,
        addItems: [
          { productId: 5332, quantity: 4 },
          { productId: 5333, quantity: 1 },
        ],
        sourceText:
          'Cambia el Combo De Tofu y agrega cuatro Pan De Ajo y una Porcion De Hummus',
        cartLineIndices: [0, 1],
        catalogFingerprint: h.service.cartEditOwnerFingerprint(
          products,
          [5331, 5332, 5333],
        ),
        createdAt: Date.now(),
      },
    };
  return { h, products };
}

afterEach(() => jest.restoreAllMocks());

for (const state of ['building_cart', 'awaiting_final_confirm'])
  for (const tool of ['update_item', 'remove_item'])
    test(`a current-cart reduction remains atomic with the held plan ${state} ${tool}`, async () => {
      const { h } = setup(state, true);
      h.conv.sessionData.pendingReplacementClarification!.ownerChoice!.tool =
        tool as any;
      const cart = structuredClone(h.conv.sessionData.cart);
      await h.sendQueued('Quítale una al Pan De Ajo');
      await h.sendQueued('del carrito');
      expect(h.conv.sessionData.cart).toEqual(cart);
      expect(
        h.conv.sessionData.pendingReplacementClarification?.ownerChoice
          ?.purchaseScope,
      ).toBeUndefined();
      expect(h.replies.at(-1)).toMatch(/retirar.*1.*Pan De Ajo/i);
      await h.sendQueued('2');
      expect(
        h.conv.sessionData.pendingReplacementClarification,
      ).toBeUndefined();
      expect(
        h.conv.sessionData.cart
          .filter((line) => line.productId === 5332)
          .map((line) => line.quantity),
      ).toEqual([4]);
      expect(
        h.conv.sessionData.cart
          .filter((line) => line.productId === 5331)
          .map((line) => line.quantity),
      ).toEqual(tool === 'update_item' ? [2, 3] : [2]);
      expect(h.conv.sessionData.cart[0]).toEqual(cart[0]);
      expect(h.conv.state).toBe(state);
    });

for (const answer of [
  'del carrito actual',
  'de lo que ya tengo',
  'de los que ya tengo',
  'del que ya tengo',
])
  test(`current scope accepts a specific reply ${answer}`, async () => {
    const { h } = setup('building_cart', true);
    h.conv.sessionData.cart[2].quantity = 6;
    h.conv.sessionData.pendingReplacementClarification!.cartSignature =
      JSON.stringify(h.conv.sessionData.cart);
    const cart = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('Réstale dos al Pan De Ajo');
    await h.sendQueued(answer);
    expect(h.conv.sessionData.cart).toEqual(cart);
    expect(
      h.conv.sessionData.pendingReplacementClarification?.ownerChoice
        ?.cartReductions,
    ).toEqual([{ productId: 5332, cartLineIndex: 2, quantity: 2 }]);
    h.conv.sessionData = JSON.parse(JSON.stringify(h.conv.sessionData));
    await h.sendQueued('Manzana');
    expect(h.conv.sessionData.cart[2]).toEqual({ ...cart[2], quantity: 4 });
    expect(
      h.conv.sessionData.cart
        .filter((line) => line.productId === 5332)
        .map((line) => line.quantity),
    ).toEqual([4, 4]);
    expect(h.conv.sessionData.cart[1]).toEqual({ ...cart[1], quantity: 3 });
  });

for (const change of ['cart', 'catalog', 'expiry', 'unavailable'])
  test(`a queued cart reduction is checked again before commit ${change}`, async () => {
    const { h, products } = setup('building_cart', true);
    await h.sendQueued('Quítale una al Pan De Ajo');
    await h.sendQueued('del carrito');
    if (change === 'cart') h.conv.sessionData.cart[2].note = 'Cambio externo';
    if (change === 'catalog') products[1].price += 500;
    if (change === 'unavailable') products[1].availableNow = false;
    if (change === 'expiry')
      h.conv.sessionData.pendingReplacementClarification!.ownerChoice!.createdAt = 0;
    const cart = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('2');
    expect(h.conv.sessionData.cart).toEqual(cart);
    expect(
      h.conv.sessionData.pendingReplacementClarification?.ownerChoice
        ?.invalidated,
    ).toBe(true);
    expect(h.replies.at(-1)).toMatch(/venció o cambió/i);
  });

for (const answer of ['del carrito?', 'confirmar', '1'])
  test(`the scope question retains priority ${answer}`, async () => {
    const { h } = setup('awaiting_final_confirm', true);
    const cart = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('Quítale una al Pan De Ajo');
    await h.sendQueued(answer);
    expect(h.conv.sessionData.cart).toEqual(cart);
    expect(
      h.conv.sessionData.pendingReplacementClarification?.ownerChoice
        ?.purchaseScope,
    ).toBeDefined();
    expect(
      h.conv.sessionData.pendingReplacementClarification?.ownerChoice
        ?.cartReductions,
    ).toBeUndefined();
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    expect(h.replies.at(-1)).toMatch(/del carrito/);
  });

for (const command of [
  'no',
  'cancela ese cambio',
  'reiniciar',
  'cancelar el pedido',
])
  test(`canceling a queued reduction plan preserves its atomic boundary ${command}`, async () => {
    const { h } = setup('building_cart', true);
    const cart = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('Quítale una al Pan De Ajo');
    await h.sendQueued('del carrito');
    await h.sendQueued(command);
    expect(h.conv.sessionData.pendingReplacementClarification).toBeUndefined();
    expect(h.conv.sessionData.cart).toEqual(
      ['reiniciar', 'cancelar el pedido'].includes(command) ? [] : cart,
    );
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

test('a revision of the pending purchase preserves the separate current-cart reduction', async () => {
  const { h } = setup('building_cart', true);
  await h.sendQueued('Quítale una al Pan De Ajo');
  await h.sendQueued('del carrito');
  await h.sendQueued('Agrega solo dos Pan De Ajo');
  await h.sendQueued('2');
  expect(h.conv.sessionData.pendingReplacementClarification).toBeUndefined();
  expect(
    h.conv.sessionData.cart
      .filter((line) => line.productId === 5332)
      .map((line) => line.quantity),
  ).toEqual([2]);
});

test('withdrawing the pending purchase preserves its current-cart reduction and catalog guard', async () => {
  const { h, products } = setup('building_cart', true);
  await h.sendQueued('Quítale una al Pan De Ajo');
  await h.sendQueued('del carrito');
  await h.sendQueued('No agregues Pan De Ajo');
  expect(
    h.conv.sessionData.pendingReplacementClarification?.ownerChoice?.addItems,
  ).toEqual([{ productId: 5333, quantity: 1 }]);
  const cart = structuredClone(h.conv.sessionData.cart);
  products[1].price += 500;
  await h.sendQueued('2');
  expect(h.conv.sessionData.cart).toEqual(cart);
  expect(
    h.conv.sessionData.pendingReplacementClarification?.ownerChoice
      ?.invalidated,
  ).toBe(true);
});

test('withdrawing all purchases keeps the current-cart edit for the final owner selection', async () => {
  const { h } = setup('building_cart', true);
  await h.sendQueued('Quítale una al Pan De Ajo');
  await h.sendQueued('del carrito');
  await h.sendQueued('No agregues nada');
  await h.sendQueued('2');
  expect(h.conv.sessionData.pendingReplacementClarification).toBeUndefined();
  expect(h.conv.sessionData.cart.map((line) => line.productId)).toEqual([
    5331, 5331,
  ]);
  expect(h.conv.sessionData.cart.map((line) => line.quantity)).toEqual([2, 3]);
});

test('total and product questions retain every part of the queued plan', async () => {
  const { h } = setup('building_cart', true);
  const cart = structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('Quítale una al Pan De Ajo');
  await h.sendQueued('del carrito');
  const pending = structuredClone(
    h.conv.sessionData.pendingReplacementClarification,
  );
  await h.sendQueued('cuánto vale todo?');
  await h.sendQueued('cuánto vale Pan De Ajo?');
  expect(h.conv.sessionData.cart).toEqual(cart);
  expect(h.conv.sessionData.pendingReplacementClarification).toEqual(pending);
  expect(h.replies.join(' ')).toMatch(/69.000/);
  expect(h.replies.at(-1)).toMatch(/retirar.*1.*Pan De Ajo/i);
  expect(h.conv.sessionData.pendingAddOffer).toBeUndefined();
  await h.sendQueued('2');
  expect(h.conv.sessionData.pendingReplacementClarification).toBeUndefined();
});

test('successive current-cart reductions accumulate against the original snapshot', async () => {
  const { h } = setup('building_cart', true);
  h.conv.sessionData.cart[2].quantity = 3;
  h.conv.sessionData.pendingReplacementClarification!.cartSignature =
    JSON.stringify(h.conv.sessionData.cart);
  const cart = structuredClone(h.conv.sessionData.cart);
  for (let count = 0; count < 2; count++) {
    await h.sendQueued('Quítale una al Pan De Ajo');
    await h.sendQueued('del carrito');
  }
  expect(h.conv.sessionData.cart).toEqual(cart);
  expect(
    h.conv.sessionData.pendingReplacementClarification?.ownerChoice
      ?.cartReductions,
  ).toEqual([{ productId: 5332, cartLineIndex: 2, quantity: 2 }]);
  await h.sendQueued('2');
  expect(h.conv.sessionData.cart[2]).toEqual({ ...cart[2], quantity: 1 });
});

test('an excessive current reduction keeps the previous plan available', async () => {
  const { h } = setup('building_cart', true);
  const cart = structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('Quítale una al Pan De Ajo');
  await h.sendQueued('del carrito');
  await h.sendQueued('Quítale una al Pan De Ajo');
  await h.sendQueued('del carrito');
  expect(h.conv.sessionData.cart).toEqual(cart);
  expect(
    h.conv.sessionData.pendingReplacementClarification?.ownerChoice
      ?.purchaseScope,
  ).toBeDefined();
  expect(
    h.conv.sessionData.pendingReplacementClarification?.ownerChoice
      ?.cartReductions,
  ).toEqual([{ productId: 5332, cartLineIndex: 2, quantity: 1 }]);
  expect(h.replies.join(' ')).toMatch(/supera las unidades actuales/);
  await h.sendQueued('cancelar esta reducción');
  await h.sendQueued('2');
  expect(
    h.conv.sessionData.cart
      .filter((line) => line.productId === 5332)
      .map((line) => line.quantity),
  ).toEqual([4]);
});

test('several current variants retain the question and allow choosing the pending purchase instead', async () => {
  const { h } = setup('building_cart', true);
  h.conv.sessionData.cart.push({
    ...structuredClone(h.conv.sessionData.cart[2]),
    note: 'Bien tostado',
  });
  h.conv.sessionData.pendingReplacementClarification!.cartSignature =
    JSON.stringify(h.conv.sessionData.cart);
  const cart = structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('Quítale una al Pan De Ajo');
  await h.sendQueued('del carrito');
  expect(h.conv.sessionData.cart).toEqual(cart);
  expect(
    h.conv.sessionData.pendingReplacementClarification?.ownerChoice
      ?.purchaseScope,
  ).toBeDefined();
  expect(h.replies.join(' ')).toMatch(/varias variantes en el carrito/);
  await h.sendQueued('de las pendientes');
  await h.sendQueued('2');
  expect(h.conv.sessionData.cart.slice(2, 4)).toEqual(cart.slice(2, 4));
  expect(
    h.conv.sessionData.cart
      .filter((line) => line.productId === 5332)
      .map((line) => line.quantity),
  ).toEqual([1, 1, 3]);
});

test('the transaction preserves original indexes when an earlier row is removed', async () => {
  const { h } = setup('building_cart', true);
  const cart = structuredClone(h.conv.sessionData.cart);
  h.conv.sessionData.cart = [cart[2], cart[0], cart[1]];
  const pending = h.conv.sessionData.pendingReplacementClarification!;
  pending.cartSignature = JSON.stringify(h.conv.sessionData.cart);
  pending.ownerChoice!.cartLineIndices = [1, 2];
  await h.sendQueued('Quítale una al Pan De Ajo');
  await h.sendQueued('del carrito');
  await h.sendQueued('2');
  expect(h.conv.sessionData.pendingReplacementClarification).toBeUndefined();
  expect(h.conv.sessionData.cart[0]).toEqual(cart[0]);
  expect(h.conv.sessionData.cart[1]).toEqual({ ...cart[1], quantity: 3 });
});

test('a cart limit failure rolls back edits and additions together', async () => {
  const { h } = setup('building_cart', true);
  const cart = structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('Quítale una al Pan De Ajo');
  await h.sendQueued('del carrito');
  Object.assign(h.cfg, { maxUnitsPerItem: 3 });
  await h.sendQueued('2');
  expect(h.conv.sessionData.cart).toEqual(cart);
  expect(
    h.conv.sessionData.pendingReplacementClarification?.ownerChoice
      ?.invalidated,
  ).toBe(true);
});

test('closed hours retain the complete queued plan', async () => {
  const { h } = setup('building_cart', true);
  const cart = structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('Quítale una al Pan De Ajo');
  await h.sendQueued('del carrito');
  h.cfg.ignoreBusinessHours = false;
  h.service.businessService.getStatus = jest
    .fn()
    .mockResolvedValue({ isOpen: false });
  await h.sendQueued('2');
  expect(h.conv.sessionData.cart).toEqual(cart);
  expect(
    h.conv.sessionData.pendingReplacementClarification?.ownerChoice
      ?.cartReductions,
  ).toBeDefined();
  h.cfg.ignoreBusinessHours = true;
  await h.sendQueued('2');
  expect(h.conv.sessionData.pendingReplacementClarification).toBeUndefined();
});

test('the resolved plan reaches one complete order', async () => {
  const { h } = setup('awaiting_final_confirm', true);
  await h.sendQueued('Quítale una al Pan De Ajo');
  await h.sendQueued('del carrito');
  await h.sendQueued('2');
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
  expect(items.filter((item) => item.productId === 5332)).toHaveLength(4);
  expect(items.filter((item) => item.note === 'Para compartir')).toHaveLength(
    0,
  );
  expect(h.conv.state).toBe('completed');
});

test('two reductions from different current products retain all purchases and the original edit', async () => {
  const { h, products } = setup('building_cart', true);
  h.conv.sessionData.cart.push({
    productId: 5333,
    code: 13,
    name: products[2].name,
    quantity: 1,
    unitPrice: 7000,
    note: 'Sin picante',
    attributes: [],
  });
  h.conv.sessionData.pendingReplacementClarification!.cartSignature =
    JSON.stringify(h.conv.sessionData.cart);
  const cart = structuredClone(h.conv.sessionData.cart);
  for (const product of ['Pan De Ajo', 'hummus']) {
    await h.sendQueued(`Quítale una al ${product}`);
    await h.sendQueued('del carrito');
  }
  expect(h.conv.sessionData.cart).toEqual(cart);
  expect(
    h.conv.sessionData.pendingReplacementClarification?.ownerChoice
      ?.cartReductions,
  ).toHaveLength(2);
  await h.sendQueued('2');
  expect(h.conv.sessionData.pendingReplacementClarification).toBeUndefined();
  expect(
    h.conv.sessionData.cart
      .filter((line) => line.productId === 5332)
      .map((line) => line.quantity),
  ).toEqual([4]);
  expect(
    h.conv.sessionData.cart
      .filter((line) => line.productId === 5333)
      .map((line) => line.quantity),
  ).toEqual([1]);
  expect(h.conv.sessionData.cart[0]).toEqual(cart[0]);
});

test('a duplicated provider reply cannot queue another current reduction', async () => {
  const { h } = setup('building_cart', true);
  const original = h.service.conversationService.claimInboundMessage;
  const seen = new Set<string>();
  h.service.conversationService.claimInboundMessage = jest.fn(
    async (request) => {
      if (seen.has(request.waMessageId)) return null;
      seen.add(request.waMessageId);
      return original(request);
    },
  );
  await h.sendQueued('Quítale una al Pan De Ajo', { messageId: '533-scope' });
  await h.sendQueued('del carrito', { messageId: '533-answer' });
  await h.sendQueued('del carrito', { messageId: '533-answer' });
  expect(
    h.conv.sessionData.pendingReplacementClarification?.ownerChoice
      ?.cartReductions,
  ).toEqual([{ productId: 5332, cartLineIndex: 2, quantity: 1 }]);
  await h.sendQueued('2', { messageId: '533-owner' });
  const cart = structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('2', { messageId: '533-owner' });
  expect(h.conv.sessionData.cart).toEqual(cart);
});

test('a fresh one-edit model reply cannot drop the queued current reduction', async () => {
  const { h } = setup('building_cart', true);
  await h.sendQueued('Quítale una al Pan De Ajo');
  await h.sendQueued('del carrito');
  const cart = structuredClone(h.conv.sessionData.cart);
  h.agent.runTurn.mockResolvedValue({
    reply: 'Listo.',
    actions: {
      updateCartLines: [{ productId: 5331, cartLineIndex: 1, quantity: 4 }],
      addItems: [
        { productId: 5332, quantity: 4 },
        { productId: 5333, quantity: 1 },
      ],
    },
    toolCalls: ['update_item', 'add_item'],
    purchaseAttempts: [
      { productId: 5332, accepted: true },
      { productId: 5333, accepted: true },
    ],
  });
  await h.sendQueued(
    'Ayúdame a dejar cuatro Combo De Tofu de Manzana y agrega cuatro Pan De Ajo y una Porcion De Hummus',
  );
  expect(h.conv.sessionData.cart).toEqual(cart);
  expect(
    h.conv.sessionData.pendingReplacementClarification?.ownerChoice
      ?.cartReductions,
  ).toBeDefined();
  await h.sendQueued('2');
  expect(h.conv.sessionData.pendingReplacementClarification).toBeUndefined();
  expect(
    h.conv.sessionData.cart
      .filter((line) => line.productId === 5332)
      .map((line) => line.quantity),
  ).toEqual([4]);
});

for (const secondary of ['update', 'remove'])
  test(`a complete explicit reformulation preserves all edits and purchases ${secondary}`, async () => {
    const { h } = setup('building_cart', true);
    h.conv.sessionData.cart[2].quantity = 3;
    h.conv.sessionData.pendingReplacementClarification!.cartSignature =
      JSON.stringify(h.conv.sessionData.cart);
    await h.sendQueued(
      secondary === 'remove'
        ? 'Quítale tres al Pan De Ajo'
        : 'Quítale una al Pan De Ajo',
    );
    await h.sendQueued('del carrito');
    h.agent.runTurn.mockResolvedValue({
      reply: 'Listo.',
      actions: {
        ...(secondary === 'remove'
          ? { removeCartLines: [{ productId: 5332, cartLineIndex: 2 }] }
          : {}),
        updateCartLines: [
          { productId: 5331, cartLineIndex: 1, quantity: 4 },
          ...(secondary === 'update'
            ? [{ productId: 5332, cartLineIndex: 2, quantity: 2 }]
            : []),
        ],
        addItems: [
          { productId: 5332, quantity: 4 },
          { productId: 5333, quantity: 1 },
        ],
      },
      toolCalls: ['update_item', 'remove_item', 'add_item'],
      purchaseAttempts: [
        { productId: 5332, accepted: true },
        { productId: 5333, accepted: true },
      ],
    });
    await h.sendQueued(
      `Ayúdame a dejar cuatro Combo De Tofu de Manzana, ${secondary === 'remove' ? 'retira el Pan De Ajo actual' : 'deja dos Pan De Ajo actuales'} y agrega cuatro Pan De Ajo y una Porcion De Hummus`,
    );
    expect(h.conv.sessionData.pendingReplacementClarification).toBeUndefined();
    expect(h.conv.sessionData.cart[1].quantity).toBe(4);
    expect(
      h.conv.sessionData.cart
        .filter((line) => line.productId === 5332)
        .map((line) => line.quantity),
    ).toEqual(secondary === 'update' ? [2, 4] : [4]);
    expect(
      h.conv.sessionData.cart
        .filter((line) => line.productId === 5333)
        .map((line) => line.quantity),
    ).toEqual([1]);
  });

for (const extra of ['quantity', 'note', 'missing-tool', 'wrong-index'])
  test(`reformulation cannot replace the confirmed secondary reduction ${extra}`, async () => {
    const { h } = setup('building_cart', true);
    h.conv.sessionData.cart[2].quantity = 3;
    h.conv.sessionData.pendingReplacementClarification!.cartSignature =
      JSON.stringify(h.conv.sessionData.cart);
    await h.sendQueued('Quítale una al Pan De Ajo');
    await h.sendQueued('del carrito');
    const cart = structuredClone(h.conv.sessionData.cart);
    h.agent.runTurn.mockResolvedValue({
      reply: 'Listo.',
      actions: {
        removeCartLines:
          extra === 'missing-tool'
            ? [{ productId: 5331, cartLineIndex: 1 }]
            : undefined,
        updateCartLines: [
          ...(extra === 'missing-tool'
            ? []
            : [{ productId: 5331, cartLineIndex: 1, quantity: 4 }]),
          {
            productId: 5332,
            cartLineIndex: extra === 'wrong-index' ? 0 : 2,
            quantity: extra === 'quantity' ? 1 : 2,
            ...(extra === 'note' ? { note: 'Cambio inventado' } : {}),
          },
        ],
        addItems: [
          { productId: 5332, quantity: 4 },
          { productId: 5333, quantity: 1 },
        ],
      },
      toolCalls: ['update_item', 'add_item'],
      purchaseAttempts: [
        { productId: 5332, accepted: true },
        { productId: 5333, accepted: true },
      ],
    });
    await h.sendQueued(
      'Ayúdame a dejar cuatro Combo De Tofu de Manzana, deja dos Pan De Ajo actuales y agrega cuatro Pan De Ajo y una Porcion De Hummus',
    );
    expect(h.conv.sessionData.cart).toEqual(cart);
    expect(
      h.conv.sessionData.pendingReplacementClarification?.ownerChoice
        ?.cartReductions,
    ).toBeDefined();
  });

for (const corrupt of ['negative', 'foreign', 'duplicate'])
  test(`persisted reductions are validated before replay ${corrupt}`, async () => {
    const { h } = setup('building_cart', true);
    await h.sendQueued('Quítale una al Pan De Ajo');
    await h.sendQueued('del carrito');
    const choice =
      h.conv.sessionData.pendingReplacementClarification!.ownerChoice!;
    if (corrupt === 'negative') choice.cartReductions![0].quantity = -1;
    if (corrupt === 'foreign') choice.cartReductions![0].cartLineIndex = 0;
    if (corrupt === 'duplicate')
      choice.cartReductions!.push({ ...choice.cartReductions![0] });
    const cart = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('2');
    expect(h.conv.sessionData.cart).toEqual(cart);
    expect(
      h.conv.sessionData.pendingReplacementClarification?.ownerChoice
        ?.invalidated,
    ).toBe(true);
  });

test('removing the secondary product requires the remove tool receipt', async () => {
  const { h } = setup('building_cart', true);
  await h.sendQueued('Quítale una al Pan De Ajo');
  await h.sendQueued('del carrito');
  const cart = structuredClone(h.conv.sessionData.cart);
  h.agent.runTurn.mockResolvedValue({
    reply: 'Listo.',
    actions: {
      removeCartLines: [{ productId: 5332, cartLineIndex: 2 }],
      updateCartLines: [{ productId: 5331, cartLineIndex: 1, quantity: 4 }],
      addItems: [
        { productId: 5332, quantity: 4 },
        { productId: 5333, quantity: 1 },
      ],
    },
    toolCalls: ['update_item', 'add_item'],
    purchaseAttempts: [
      { productId: 5332, accepted: true },
      { productId: 5333, accepted: true },
    ],
  });
  await h.sendQueued(
    'Ayúdame a dejar cuatro Combo De Tofu de Manzana, retira el Pan De Ajo actual y agrega cuatro Pan De Ajo y una Porcion De Hummus',
  );
  expect(h.conv.sessionData.cart).toEqual(cart);
  expect(h.conv.sessionData.pendingReplacementClarification).toBeDefined();
});

for (const quantity of [-1, 0.5])
  test(`a fresh reformulation cannot replay an invalid persisted reduction ${quantity}`, async () => {
    const { h } = setup('building_cart', true);
    await h.sendQueued('Quítale una al Pan De Ajo');
    await h.sendQueued('del carrito');
    h.conv.sessionData.pendingReplacementClarification!.ownerChoice!.cartReductions![0].quantity =
      quantity;
    const cart = structuredClone(h.conv.sessionData.cart);
    h.agent.runTurn.mockResolvedValue({
      reply: 'Listo.',
      actions: {
        updateCartLines: [
          { productId: 5331, cartLineIndex: 1, quantity: 4 },
          { productId: 5332, cartLineIndex: 2, quantity: 1 - quantity },
        ],
        addItems: [
          { productId: 5332, quantity: 4 },
          { productId: 5333, quantity: 1 },
        ],
      },
      toolCalls: ['update_item', 'add_item'],
      purchaseAttempts: [
        { productId: 5332, accepted: true },
        { productId: 5333, accepted: true },
      ],
    });
    await h.sendQueued(
      'Ayúdame a dejar cuatro Combo De Tofu de Manzana, deja dos Pan De Ajo actuales y agrega cuatro Pan De Ajo y una Porcion De Hummus',
    );
    expect(h.conv.sessionData.cart).toEqual(cart);
    expect(h.conv.sessionData.pendingReplacementClarification).toBeDefined();
  });
