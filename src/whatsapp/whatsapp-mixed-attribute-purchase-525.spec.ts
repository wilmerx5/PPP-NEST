import { harness } from './whatsapp-accuracy.test-support';

function setup(state = 'building_cart', multiple = false) {
  const products = [
    {
      id: 5251,
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
        { attributeName: 'Grado de tostado', options: ['Claro', 'Oscuro'] },
      ],
    },
    {
      id: 5252,
      code: 12,
      name: 'Porcion De Hummus',
      price: 7000,
      availableNow: true,
      hasAttributes: false,
      attributes: [],
    },
  ];
  const h = harness(products, false);
  h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
  h.service.ordersService.create = jest
    .fn()
    .mockResolvedValue({ id: 525, dailyOrderNumber: 525 });
  h.service.ordersService.findTodayOrdersByPhone = jest
    .fn()
    .mockResolvedValue([]);
  h.conv.state = state;
  Object.assign(h.conv.sessionData, {
    fulfillmentChosen: true,
    notesCollected: true,
    phoneConfirmed: true,
    contactPhone: h.conv.phoneE164,
    cart: [
      {
        productId: 5251,
        code: 11,
        name: products[0].name,
        quantity: 2,
        unitPrice: 22000,
        note: 'Sin sal',
        attributes: products[0].attributes.map((attribute) => ({
          attributeName: attribute.attributeName,
          attributeValue: attribute.options[0],
        })),
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
        { attributeName: 'Salsa', attributeValue: 'Suave' },
        { attributeName: 'Grado de tostado', attributeValue: 'Claro' },
      ],
    });
  return { h, products };
}

for (const state of ['building_cart', 'awaiting_final_confirm'])
  for (const reversed of [false, true])
    for (const [field, value] of [
      ['bebida', 'Pepsi'],
      ['salsa', 'Picante'],
      ['grado de tostado', 'Oscuro'],
    ])
      test(`field change and purchase commit together ${state} ${reversed} ${field}`, async () => {
        const { h } = setup(state);
        const change = `cámbiame la ${field} del Combo De Tofu a ${value}`;
        const purchase = 'una Porcion De Hummus';
        const reply = await h.sendQueued(
          reversed
            ? `agrega ${purchase} y ${change}`
            : `${change} y agrega ${purchase}`,
        );
        expect(h.conv.sessionData.cart).toHaveLength(2);
        expect(h.conv.sessionData.cart[0]).toMatchObject({
          productId: 5251,
          quantity: 2,
          note: 'Sin sal',
        });
        expect(h.conv.sessionData.cart[0].attributes).toContainEqual({
          attributeName:
            field === 'grado de tostado'
              ? 'Grado de tostado'
              : field === 'bebida'
                ? 'Bebida'
                : 'Salsa',
          attributeValue: value,
        });
        expect(h.conv.sessionData.cart[1]).toMatchObject({
          productId: 5252,
          quantity: 1,
        });
        expect(reply).toMatch(/agregu[eé]/i);
        expect(reply).toContain(value);
        expect(h.conv.state).toBe(state);
        await h.sendQueued('no más, recojo en el local');
        await h.sendQueued('efectivo');
        await h.sendQueued('confirmar');
        expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      });

for (const state of ['building_cart', 'awaiting_final_confirm'])
  test(`owner selection retains attribute and purchases ${state}`, async () => {
    const { h } = setup(state, true),
      before = structuredClone(h.conv.sessionData.cart);
    const reply = await h.sendQueued(
      'cambia la bebida del Combo De Tofu por Pepsi y agrega una Porcion De Hummus',
    );
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(
      h.conv.sessionData.pendingCartReplacement?.mixedSourceRequest,
    ).toBeDefined();
    expect(reply).toMatch(/cu[aá]l l[ií]nea/i);
    await h.sendQueued('Cuánto vale el Combo De Tofu?');
    expect(h.conv.sessionData.cart).toEqual(before);
    await h.sendQueued('2');
    expect(h.conv.sessionData.cart).toHaveLength(3);
    expect(h.conv.sessionData.cart[0]).toEqual(before[0]);
    expect(h.conv.sessionData.cart[1]).toMatchObject({
      quantity: 1,
      note: 'Salsa aparte',
    });
    expect(h.conv.sessionData.cart[1].attributes).toContainEqual({
      attributeName: 'Bebida',
      attributeValue: 'Pepsi',
    });
    expect(h.conv.sessionData.cart[2]).toMatchObject({
      productId: 5252,
      quantity: 1,
    });
    await h.sendQueued('no más, recojo en el local');
    await h.sendQueued('efectivo');
    await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  });

async function rejectedReadyOrder() {
  const s = setup('awaiting_final_confirm');
  Object.assign(s.h.conv.sessionData, { paymentMethod: 'cash' });
  s.h.agent.runTurn.mockResolvedValue({
    reply: 'Listo.',
    actions: { addItems: [{ productId: 5252, quantity: 1 }] },
    toolCalls: ['replace_item', 'add_item'],
    rejectedReplacements: [
      { productId: 5251, cartLineIndex: 0, reason: 'invalid_quantity' },
    ],
  });
  const text = 'Ayúdame a ajustar mi pedido por favor';
  expect(
    await s.h.service.tryHandleAgentV1({
      conv: s.h.conv,
      msg: {
        waId: 'customer',
        phoneE164: s.h.conv.phoneE164,
        messageId: 'rejected',
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
      placedOrderOnly: true,
    }),
  ).toBe(true);
  s.h.agent.runTurn.mockResolvedValue({
    reply: '',
    actions: {},
    toolCalls: [],
  });
  return s;
}

for (const answer of ['sí', 'yes', 'confirmar'])
  test(`a rejected replacement cannot confirm the old cart through ${answer}`, async () => {
    const { h } = await rejectedReadyOrder(),
      before = structuredClone(h.conv.sessionData.cart);
    const reply = await h.sendQueued(answer);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.conv.state).toBe('awaiting_final_confirm');
    expect(reply).toMatch(/cambio.*pendiente/i);
    await h.sendQueued(answer);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

test('a total inquiry keeps the rejected replacement unresolved', async () => {
  const { h } = await rejectedReadyOrder();
  const reply = await h.sendQueued('¿Cuánto llevo en total?');
  expect(reply).toMatch(/44.000/);
  expect((reply?.match(/\?/g) || []).length).toBeLessThanOrEqual(1);
  await h.sendQueued('sí');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
});

test('declining the rejected change shows the current cart before confirmation', async () => {
  const { h } = await rejectedReadyOrder();
  const reply = await h.sendQueued('cancela ese cambio');
  expect(reply).toMatch(/cancel[eé].*cambio/i);
  expect(reply).toMatch(/44.000/);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
});

test('a complete field change and purchase resolves the rejection before confirmation', async () => {
  const { h } = await rejectedReadyOrder();
  await h.sendQueued(
    'cambia la bebida del Combo De Tofu a Pepsi y agrega una Porcion De Hummus',
  );
  expect(h.conv.sessionData.cart).toHaveLength(2);
  expect(h.conv.sessionData.cart[0].attributes).toContainEqual({
    attributeName: 'Bebida',
    attributeValue: 'Pepsi',
  });
  await h.sendQueued('sí');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
});

for (const state of ['building_cart', 'awaiting_final_confirm'])
  test(`drink alias uses the configured field ${state}`, async () => {
    const { h } = setup(state);
    await h.sendQueued(
      'cambia la gaseosa del Combo De Tofu por Pepsi y agrega una Porcion De Hummus',
    );
    expect(h.conv.sessionData.cart).toHaveLength(2);
    expect(h.conv.sessionData.cart[0].attributes).toContainEqual({
      attributeName: 'Bebida',
      attributeValue: 'Pepsi',
    });
  });

test('a current option identifies the source owner', async () => {
  const { h } = setup('building_cart', true),
    before = structuredClone(h.conv.sessionData.cart);
  await h.sendQueued(
    'cambia la bebida del Combo De Tofu de Manzana a Pepsi y agrega una Porcion De Hummus',
  );
  expect(h.conv.sessionData.cart).toHaveLength(3);
  expect(h.conv.sessionData.cart[0]).toEqual(before[0]);
  expect(h.conv.sessionData.cart[1].attributes).toContainEqual({
    attributeName: 'Bebida',
    attributeValue: 'Pepsi',
  });
});

test('a bare field keeps both owners available until the customer chooses', async () => {
  const { h } = setup('building_cart', true),
    before = structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('cambia la bebida a Pepsi y agrega una Porcion De Hummus');
  expect(h.conv.sessionData.cart).toEqual(before);
  await h.sendQueued('1');
  expect(h.conv.sessionData.cart).toHaveLength(3);
  expect(h.conv.sessionData.cart[1]).toEqual(before[1]);
  expect(h.conv.sessionData.cart[0].attributes).toContainEqual({
    attributeName: 'Bebida',
    attributeValue: 'Pepsi',
  });
});

for (const value of [
  'Pepsi y Manzana',
  'Pepsi si sale gratis',
  'no Pepsi',
  'Inexistente',
])
  test(`unresolved option keeps all changes pending for ${value}`, async () => {
    const { h } = setup(),
      before = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued(
      `cambia la bebida del Combo De Tofu a ${value} y agrega una Porcion De Hummus`,
    );
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

test('legacy field casing is replaced once', async () => {
  const { h } = setup();
  h.conv.sessionData.cart[0].attributes![0].attributeName = 'bebida';
  await h.sendQueued(
    'cambia la bebida del Combo De Tofu a Pepsi y agrega una Porcion De Hummus',
  );
  expect(h.conv.sessionData.cart).toHaveLength(2);
  expect(
    h.conv.sessionData.cart[0].attributes!.filter(
      (attribute) => attribute.attributeName.toLowerCase() === 'bebida',
    ),
  ).toEqual([{ attributeName: 'Bebida', attributeValue: 'Pepsi' }]);
});

test('an alias matching two fields requires the canonical field name', async () => {
  const { h, products } = setup();
  products[0].attributes.push({
    attributeName: 'Sabor',
    options: ['Colombiana', 'Pepsi'],
  });
  const before = structuredClone(h.conv.sessionData.cart);
  await h.sendQueued(
    'cambia la gaseosa del Combo De Tofu a Pepsi y agrega una Porcion De Hummus',
  );
  expect(h.conv.sessionData.cart).toEqual(before);
});

for (const interruption of ['cancel', 'cart changed', 'catalog changed'])
  test(`field owner selection is safe after ${interruption}`, async () => {
    const { h, products } = setup('building_cart', true);
    await h.sendQueued(
      'cambia la bebida del Combo De Tofu a Pepsi y agrega una Porcion De Hummus',
    );
    if (interruption === 'cart changed')
      h.conv.sessionData.cart[0].quantity = 3;
    if (interruption === 'catalog changed')
      products[0].attributes[0].options = ['Colombiana', 'Manzana'];
    const before = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued(interruption === 'cancel' ? 'cancela ese cambio' : '2');
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

for (const decline of ['no', 'mejor no'])
  test(`a decline clears only the rejected change through ${decline}`, async () => {
    const { h } = await rejectedReadyOrder(),
      before = structuredClone(h.conv.sessionData.cart);
    const reply = await h.sendQueued(decline);
    expect(reply).toMatch(/cancel[eé].*cambio/i);
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.conv.sessionData.pendingReplacementClarification).toBeUndefined();
    await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  });

test('whole-order cancellation remains available after a rejected change', async () => {
  const { h } = await rejectedReadyOrder();
  await h.sendQueued('cancela el pedido');
  expect(h.conv.sessionData.cart).toEqual([]);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
});

test('an unrelated purchase does not implicitly resolve the rejected change', async () => {
  const { h } = await rejectedReadyOrder();
  await h.sendQueued('agrega una Porcion De Hummus');
  expect(h.conv.sessionData.cart).toHaveLength(2);
  await h.sendQueued('sí');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  expect(h.conv.sessionData.pendingReplacementClarification).toBeDefined();
  await h.sendQueued('cancela ese cambio');
  await h.sendQueued('no más, recojo en el local');
  await h.sendQueued('efectivo');
  await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
});

test('restart clears the abandoned replacement context', async () => {
  const { h } = await rejectedReadyOrder();
  await h.sendQueued('reiniciar');
  expect(h.conv.sessionData.cart).toEqual([]);
  await h.sendQueued('una Porcion De Hummus');
  expect(h.conv.sessionData.cart).toHaveLength(1);
  await h.sendQueued('no más, recojo en el local');
  await h.sendQueued('efectivo');
  await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
});

for (const outcome of ['expired', 'declined', 'completed'])
  test(`a reformulated owner selection keeps the rejection safe when ${outcome}`, async () => {
    const { h } = await rejectedReadyOrder();
    h.conv.sessionData.cart.push({
      ...structuredClone(h.conv.sessionData.cart[0]),
      quantity: 1,
      note: 'Salsa aparte',
    });
    await h.sendQueued(
      'cambia la bebida del Combo De Tofu a Pepsi y agrega una Porcion De Hummus',
    );
    expect(
      h.conv.sessionData.pendingCartReplacement?.mixedSourceRequest,
    ).toBeDefined();
    if (outcome === 'expired') {
      h.conv.sessionData.pendingCartReplacement!.mixedSourceRequest!.createdAt -=
        11 * 60 * 1000;
      await h.sendQueued('2');
      await h.sendQueued('sí');
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      expect(h.conv.sessionData.pendingReplacementClarification).toBeDefined();
    } else if (outcome === 'declined') {
      await h.sendQueued('cancela ese cambio');
      expect(h.conv.sessionData.pendingCartReplacement).toBeUndefined();
      expect(
        h.conv.sessionData.pendingReplacementClarification,
      ).toBeUndefined();
      await h.sendQueued('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    } else {
      await h.sendQueued('2');
      expect(h.conv.sessionData.cart).toHaveLength(3);
      expect(
        h.conv.sessionData.pendingReplacementClarification,
      ).toBeUndefined();
      await h.sendQueued('sí');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    }
  });

test('a normalized acknowledgement cannot bypass the rejected change', async () => {
  const { h } = await rejectedReadyOrder();
  await h.sendQueued('sí, confirmar');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
});

test('the order confirmation entry point enforces the unresolved replacement', async () => {
  const { h } = await rejectedReadyOrder();
  await h.service.tryConfirmOrder(h.conv, 'customer', h.conv.sessionData, {
    skipFinalConfirm: true,
  });
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  expect(h.replies.at(-1)).toMatch(/cambio.*pendiente/i);
});

test('a configured negative option is a field choice within the combined request', async () => {
  const { h, products } = setup();
  products[0].attributes.push({
    attributeName: 'Arepas',
    options: ['Blancas', 'Fritas', 'Sin arepas'],
  });
  h.conv.sessionData.cart[0].attributes!.push({
    attributeName: 'Arepas',
    attributeValue: 'Blancas',
  });
  await h.sendQueued(
    'cambia las arepas del Combo De Tofu por Sin arepas y agrega una Porcion De Hummus',
  );
  expect(h.conv.sessionData.cart).toHaveLength(2);
  expect(h.conv.sessionData.cart[0].attributes).toContainEqual({
    attributeName: 'Arepas',
    attributeValue: 'Sin arepas',
  });
  expect(h.conv.sessionData.cart[0]).toMatchObject({
    quantity: 2,
    note: 'Sin sal',
  });
});

for (const failure of ['invalid option', 'expired owner'])
  test(`a deterministic mixed rejection also protects confirmation after ${failure}`, async () => {
    const { h } = setup('awaiting_final_confirm', failure === 'expired owner');
    Object.assign(h.conv.sessionData, { paymentMethod: 'cash' });
    if (failure === 'invalid option')
      await h.sendQueued(
        'cambia la bebida del Combo De Tofu a Inexistente y agrega una Porcion De Hummus',
      );
    else {
      await h.sendQueued(
        'cambia la bebida del Combo De Tofu a Pepsi y agrega una Porcion De Hummus',
      );
      h.conv.sessionData.pendingCartReplacement!.mixedSourceRequest!.createdAt -=
        11 * 60 * 1000;
      await h.sendQueued('2');
    }
    await h.sendQueued('sí');
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    expect(h.conv.sessionData.pendingReplacementClarification).toBeDefined();
  });

test('large-cart clarification keeps its question within the transport limit', async () => {
  const { h } = await rejectedReadyOrder();
  h.conv.sessionData.cart = Array.from({ length: 20 }, (_, index) => ({
    ...structuredClone(h.conv.sessionData.cart[0]),
    quantity: 1,
    note: `Entrega ${index} ${'x'.repeat(180)}`,
  }));
  const before = structuredClone(h.conv.sessionData.cart),
    start = h.replies.length;
  await h.sendQueued('sí');
  const replies = h.replies.slice(start);
  expect(replies.length).toBeGreaterThan(1);
  for (const reply of replies) expect(reply.length).toBeLessThanOrEqual(3800);
  expect(replies.join('\n')).toMatch(/Entrega 19/);
  expect(replies.at(-1)).toMatch(/cambio.*pendiente/i);
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
});

for (const state of ['building_cart', 'awaiting_final_confirm'])
  test(`a product reference takes precedence over an ingredient field ${state}`, async () => {
    const { h, products } = setup(state);
    const source = {
      id: 5253,
      code: 13,
      name: 'Pollo Frito',
      price: 22000,
      availableNow: true,
      hasAttributes: false,
      attributes: [],
    };
    const target = {
      ...source,
      id: 5254,
      code: 14,
      name: 'Pollo Broaster',
      price: 24000,
    };
    const rice = {
      ...source,
      id: 5255,
      code: 15,
      name: 'Arroz Con Medio Pollo',
      hasAttributes: true,
      attributes: [{ attributeName: 'Pollo', options: ['Frito', 'Broaster'] }],
    };
    products.push(source, target, rice);
    h.conv.sessionData.cart = [
      {
        productId: source.id,
        code: source.code,
        name: source.name,
        unitPrice: source.price,
        quantity: 2,
        note: 'Sin sal',
        attributes: [],
      },
      {
        productId: rice.id,
        code: rice.code,
        name: rice.name,
        unitPrice: rice.price,
        quantity: 1,
        note: 'Salsa aparte',
        attributes: [{ attributeName: 'Pollo', attributeValue: 'Frito' }],
      },
    ];
    const before = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued(
      'cambia el pollo a broaster y agrega una Porcion De Hummus',
    );
    expect(h.conv.sessionData.cart).toHaveLength(3);
    expect(h.conv.sessionData.cart[0]).toMatchObject({
      productId: target.id,
      quantity: 2,
      note: 'Sin sal',
    });
    expect(h.conv.sessionData.cart[1]).toEqual(before[1]);
    expect(h.conv.sessionData.cart[2]).toMatchObject({
      productId: 5252,
      quantity: 1,
    });
  });

it('a rejected replacement owns its nested attribute rejection and new purchase', async () => {
  const { h, products } = setup('awaiting_final_confirm');
  h.conv.sessionData.paymentMethod = 'cash';
  const before = structuredClone(h.conv.sessionData.cart);
  h.agent.runTurn.mockResolvedValue({
    reply: '',
    actions: { addItems: [{ productId: 5252, quantity: 1 }] },
    toolCalls: ['replace_item', 'add_item'],
    rejectedReplacements: [
      {
        productId: 5251,
        cartLineIndex: 0,
        reason: 'missing_explicit_option_choice',
      },
    ],
    rejectedAttributeChoices: [
      {
        productId: 5251,
        cartLineIndex: 0,
        attributeName: 'Bebida',
        attributeValue: 'Pepsi',
      },
    ],
  });
  const text =
    'Quisiera cambiar la bebida del Combo De Tofu y agregar una Porcion De Hummus';
  await h.service.tryHandleAgentV1({
    conv: h.conv,
    msg: {
      waId: 'customer',
      phoneE164: h.conv.phoneE164,
      messageId: 'parent',
      messageType: 'text',
      text,
      raw: {},
    },
    session: h.conv.sessionData,
    text: 'Quisiera cambiar la bebida del Combo De Tofu y agregar una Porcion De Hummus',
    originalText:
      'Quisiera cambiar la bebida del Combo De Tofu y agregar una Porcion De Hummus',
    products,
    cfg: h.cfg,
    status: { isOpen: true, message: 'Abierto' },
    businessOpenForBot: true,
    placedOrderOnly: true,
  });
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(h.conv.sessionData.pendingCartOptionChoice).toBeUndefined();

  h.agent.runTurn.mockResolvedValue({ reply: '', actions: {}, toolCalls: [] });
  await h.sendQueued('sí');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  expect(h.conv.sessionData.pendingReplacementClarification).toBeDefined();
  await h.sendQueued(
    'cambia la bebida del Combo De Tofu a Pepsi y agrega una Porcion De Hummus',
  );
  expect(h.conv.sessionData.pendingReplacementClarification).toBeUndefined();
  expect(h.conv.sessionData.cart).toHaveLength(2);
  expect(h.conv.sessionData.cart[0]).toMatchObject({
    quantity: 2,
    note: 'Sin sal',
    attributes: expect.arrayContaining([
      { attributeName: 'Bebida', attributeValue: 'Pepsi' },
    ]),
  });
  expect(h.conv.sessionData.cart[1]).toMatchObject({
    productId: 5252,
    quantity: 1,
  });
  await h.sendQueued('no más, recojo en el local');
  await h.sendQueued('efectivo');
  await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
});
