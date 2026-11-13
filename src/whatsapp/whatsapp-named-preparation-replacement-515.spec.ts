import { harness } from './whatsapp-accuracy.test-support';
import type { WhatsappProductCandidate } from './types/whatsapp-session.types';

function menu(): WhatsappProductCandidate[] {
  const attributes = [
    { attributeName: 'Arepas', options: ['Blancas', 'Fritas'] },
    { attributeName: 'Bebida', options: ['Manzana', 'Colombiana'] },
  ];
  return [
    {
      id: 701,
      code: 11,
      name: '1 Pollo Frito',
      price: 20000,
      availableNow: true,
      comboBaseProductId: null,
      hasAttributes: true,
      attributes,
    },
    {
      id: 702,
      code: 12,
      name: '1 Pollo Broaster',
      price: 23000,
      availableNow: true,
      comboBaseProductId: null,
      hasAttributes: true,
      attributes,
    },
    {
      id: 703,
      code: 13,
      name: 'Combo De Pollo Frito',
      price: 27000,
      availableNow: true,
      comboBaseProductId: 701,
      hasAttributes: true,
      attributes,
    },
    {
      id: 704,
      code: 14,
      name: 'Combo De Pollo Broaster',
      price: 31000,
      availableNow: true,
      comboBaseProductId: 702,
      hasAttributes: true,
      attributes,
    },
    {
      id: 705,
      code: 15,
      name: 'Mojarra Frita',
      price: 18000,
      availableNow: true,
      hasAttributes: true,
      attributes,
    },
    {
      id: 706,
      code: 16,
      name: 'Mojarra Asada',
      price: 22000,
      availableNow: true,
      hasAttributes: true,
      attributes,
    },
    {
      id: 707,
      code: 17,
      name: '1/2 Pollo Frito',
      price: 14000,
      availableNow: true,
      hasAttributes: true,
      attributes,
    },
    {
      id: 708,
      code: 18,
      name: '1/2 Pollo Broaster',
      price: 16000,
      availableNow: true,
      hasAttributes: true,
      attributes,
    },
    {
      id: 712,
      code: 21,
      name: '1/4 Pollo Frito',
      price: 9000,
      availableNow: true,
      hasAttributes: true,
      attributes,
    },
    {
      id: 713,
      code: 22,
      name: '1/4 Pollo Broaster',
      price: 11000,
      availableNow: true,
      hasAttributes: true,
      attributes,
    },
    {
      id: 714,
      code: 23,
      name: 'Arroz Chino Con Medio Pollo',
      price: 40000,
      availableNow: true,
      hasAttributes: true,
      attributes: [
        ...attributes,
        { attributeName: 'Pollo', options: ['Frito', 'Broaster'] },
      ],
    },
    {
      id: 709,
      code: 19,
      name: 'Sopa Casera',
      price: 5000,
      availableNow: true,
      attributes: [],
    },
  ];
}
function setup(
  sourceId: number,
  quantity = 1,
  agent = false,
  products = menu(),
) {
  const h = harness(products, agent);
  h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
  h.service.ordersService.create = jest
    .fn()
    .mockResolvedValue({ id: 515, dailyOrderNumber: 515 });
  h.service.ordersService.findTodayOrdersByPhone = jest
    .fn()
    .mockResolvedValue([]);
  const source = products.find((product) => product.id === sourceId)!;
  Object.assign(h.conv.sessionData, {
    orderType: 'pickup',
    fulfillmentChosen: true,
    phoneConfirmed: true,
    contactPhone: h.conv.phoneE164,
    notesCollected: true,
  });
  h.conv.sessionData.cart = [
    {
      productId: source.id,
      code: source.code,
      name: source.name,
      unitPrice: source.price,
      quantity,
      attributes: [
        { attributeName: 'Arepas', attributeValue: 'Fritas' },
        { attributeName: 'Bebida', attributeValue: 'Manzana' },
      ],
      note: 'Sin sal',
    },
    {
      productId: 709,
      code: 19,
      name: 'Sopa Casera',
      unitPrice: 5000,
      quantity: 1,
      note: 'Bien caliente',
    },
  ];
  h.conv.sessionData.productFocus = { productId: source.id, name: source.name };
  return h;
}
for (const [sourceId, targetId, text] of [
  [701, 702, 'cambia el pollo a broaster'],
  [702, 701, 'cambia el pollo a frito'],
] as const) {
  test(`original ${text} replaces the existing units`, async () => {
    const h = setup(sourceId, 2);
    const original = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued(text);
    expect(h.conv.sessionData.cart).toEqual([
      expect.objectContaining({
        productId: targetId,
        quantity: 2,
        attributes: original[0].attributes,
        note: 'Sin sal',
      }),
      original[1],
    ]);
    expect(h.replies.at(-1)).toMatch(/cambi[eé]/i);
  });
}

for (const [sourceId, targetId, reference, preparation] of [
  [701, 702, 'pollo', 'broaster'],
  [702, 701, 'pollo', 'frito'],
  [705, 706, 'mojarra', 'asada'],
  [706, 705, 'mojarra', 'frita'],
] as const) {
  for (const agent of [false, true]) {
    for (const state of [
      'building_cart',
      'awaiting_payment',
      'awaiting_final_confirm',
    ]) {
      for (const quantity of [1, 2]) {
        test(`${reference} to ${preparation}, agent ${agent}, ${state}, quantity ${quantity} closes without an extra dish`, async () => {
          const products = menu();
          const target = products.find((product) => product.id === targetId)!;
          const h = setup(sourceId, quantity, agent, products);
          h.conv.state = state;
          h.conv.sessionData.paymentMethod = 'cash';
          const original = structuredClone(h.conv.sessionData.cart);
          const text = `cámbiame ${reference === 'mojarra' ? 'la' : 'el'} ${reference} a ${preparation}`;
          await h.sendQueued(text);
          expect(h.conv.sessionData.cart).toEqual([
            {
              ...original[0],
              productId: target.id,
              code: target.code,
              name: target.name,
              unitPrice: target.price,
            },
            original[1],
          ]);
          expect(h.conv.state).toBe(state);
          expect(h.replies.at(-1)).toContain(target.name);
          expect(h.replies.at(-1)).toContain(
            (target.price * quantity + 5000).toLocaleString('es-CO'),
          );
          const changed = structuredClone(h.conv.sessionData.cart);
          await h.sendQueued(text);
          expect(h.conv.sessionData.cart).toEqual(changed);
          await h.sendQueued('no más, recojo en el local');
          await h.sendQueued('efectivo');
          await h.sendQueued('confirmar');
          expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
          const items = h.service.ordersService.create.mock.calls[0][0].items;
          expect(
            items.filter(
              (item: { productId: number }) => item.productId === targetId,
            ),
          ).toHaveLength(quantity);
          expect(
            items.filter(
              (item: { productId: number }) => item.productId === 709,
            ),
          ).toHaveLength(1);
          expect(items).toHaveLength(quantity + 1);
          expect(
            items
              .filter(
                (item: { productId: number; note?: string }) =>
                  item.productId === targetId,
              )
              .every((item: { note?: string }) => item.note === 'Sin sal'),
          ).toBe(true);
        });
      }
    }
  }
}
for (const [sourceId, targetId, preparation] of [
  [703, 704, 'broaster'],
  [704, 703, 'frito'],
] as const) {
  for (const agent of [false, true]) {
    test(`a combo remains a combo when changing to ${preparation}, agent ${agent}`, async () => {
      const h = setup(sourceId, 2, agent);
      const original = structuredClone(h.conv.sessionData.cart);
      await h.sendQueued(`cambia el combo de pollo por ${preparation}`);
      expect(h.conv.sessionData.cart).toEqual([
        expect.objectContaining({
          productId: targetId,
          quantity: 2,
          attributes: original[0].attributes,
          note: 'Sin sal',
        }),
        original[1],
      ]);
    });
  }
}
for (const scenario of [
  'unavailable',
  'ambiguous target',
  'missing source',
  'payment link',
  'pending choice',
  'question',
  'extra instruction',
]) {
  test(`named preparation guard ${scenario} retains the original cart`, async () => {
    const products = menu();
    if (scenario === 'unavailable') products[1].availableNow = false;
    if (scenario === 'ambiguous target')
      products.push({ ...products[1], id: 710, code: 20 });
    const h = setup(701, 2, false, products);
    if (scenario === 'missing source') products.splice(0, 1);
    if (scenario === 'payment link')
      h.conv.sessionData.mpPreferenceId = 'synthetic-payment';
    if (scenario === 'pending choice')
      h.conv.sessionData.pendingMatch = {
        query: 'sopa',
        candidates: [products[products.length - 1]],
        intent: 'order',
      };
    const before = structuredClone(h.conv.sessionData.cart);
    const text =
      scenario === 'question'
        ? '¿Cambia el pollo a broaster?'
        : scenario === 'extra instruction'
          ? 'cambia el pollo a broaster y agrega otra sopa'
          : 'cambia el pollo a broaster';
    await h.sendQueued(text);
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    expect(h.replies.at(-1)).toMatch(/igual|cambio|pendiente/i);
  });
}
test('an explicit addition still adds the other preparation', async () => {
  const h = setup(701);
  await h.sendQueued('agrega un pollo broaster');
  expect(
    h.conv.sessionData.cart.map((line) => [line.productId, line.quantity]),
  ).toEqual([
    [701, 1],
    [709, 1],
    [702, 1],
  ]);
});
test('ambiguous chicken lines require an owner and the follow-up replaces only that line', async () => {
  const h = setup(701);
  const other = {
    ...structuredClone(h.conv.sessionData.cart[0]),
    attributes: [
      { attributeName: 'Arepas', attributeValue: 'Blancas' },
      { attributeName: 'Bebida', attributeValue: 'Manzana' },
    ],
    note: 'Salsa aparte',
  };
  h.conv.sessionData.cart.push(other);
  const before = structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('cambia el pollo a broaster');
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(h.replies.at(-1)).toMatch(/dime|identificar/i);
  await h.sendQueued('cambia el de Blancas a broaster');
  expect(h.conv.sessionData.cart).toEqual([
    before[0],
    before[1],
    expect.objectContaining({
      productId: 702,
      quantity: 1,
      attributes: other.attributes,
      note: 'Salsa aparte',
    }),
  ]);
});
for (const [sourceId, targetId, text] of [
  [701, 702, 'cámbialo a broaster'],
  [702, 701, 'pásalo a frito'],
  [701, 702, 'cambia el pollo por broster'],
  [701, 702, 'cambiame los pollos a broaster'],
  [701, 702, 'cambia el pollo a la broaster'],
] as const) {
  test(`short preparation request preserves two units ${text}`, async () => {
    const h = setup(sourceId, 2);
    await h.sendQueued(text);
    expect(h.conv.sessionData.cart).toEqual([
      expect.objectContaining({
        productId: targetId,
        quantity: 2,
        note: 'Sin sal',
      }),
      expect.objectContaining({
        productId: 709,
        quantity: 1,
        note: 'Bien caliente',
      }),
    ]);
  });
}
for (const scenario of ['no focus', 'stale focus', 'two matching lines']) {
  test(`a pronoun requires a unique cart owner ${scenario}`, async () => {
    const h = setup(701, 2);
    if (scenario === 'no focus') h.conv.sessionData.productFocus = undefined;
    if (scenario === 'stale focus')
      h.conv.sessionData.productFocus = { productId: 999, name: 'Otro plato' };
    if (scenario === 'two matching lines')
      h.conv.sessionData.cart.push({
        ...structuredClone(h.conv.sessionData.cart[0]),
        note: 'Sin cebolla',
      });
    const before = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('cámbialo a broaster');
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.replies.at(-1)).toMatch(/dime|identificar/i);
  });
}
test('new destination options follow the existing catalog defaults', async () => {
  const products = menu();
  products[1].attributes = [
    ...products[1].attributes!,
    { attributeName: 'Salsa', options: ['Verde', 'Roja'] },
  ];
  const h = setup(701, 2, false, products);
  const before = structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('cambia el pollo a broaster');
  expect(h.conv.sessionData.cart).toEqual([
    expect.objectContaining({
      productId: 702,
      quantity: 2,
      note: 'Sin sal',
      attributes: expect.arrayContaining([
        ...before[0].attributes!,
        { attributeName: 'Salsa', attributeValue: 'Verde' },
      ]),
    }),
    before[1],
  ]);
});
for (const cancel of [false, true]) {
  test(`a pending combo conversion keeps ownership of its options, cancel ${cancel}`, async () => {
    const products = menu();
    products[2].attributes = [
      ...products[2].attributes!,
      { attributeName: 'Salsa', options: ['Verde', 'Roja'] },
    ];
    const h = setup(701, 2, false, products);
    const before = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('pásalo a combo con manzana');
    expect(h.conv.sessionData.pendingAttribute).toMatchObject({
      productId: 703,
      quantity: 2,
    });
    await h.sendQueued('cambia el pollo a broaster');
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.conv.sessionData.pendingAttribute?.productId).toBe(703);
    await h.sendQueued(cancel ? 'cancela ese cambio' : 'Roja');
    if (cancel) expect(h.conv.sessionData.cart).toEqual(before);
    else
      expect(h.conv.sessionData.cart).toEqual([
        expect.objectContaining({
          productId: 703,
          quantity: 2,
          note: 'Sin sal',
          attributes: expect.arrayContaining([
            ...before[0].attributes!,
            { attributeName: 'Salsa', attributeValue: 'Roja' },
          ]),
        }),
        before[1],
      ]);
    expect(h.conv.sessionData.pendingAttribute).toBeUndefined();
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
}
test('a replacement that exceeds the amount limit retains the original two units', async () => {
  const h = setup(701, 2);
  Object.assign(h.cfg, { maxOrderAmount: 50000 });
  const before = structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('cambia el pollo a broaster');
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
test('replacing at the line limit uses the existing line', async () => {
  const h = setup(701, 2);
  Object.assign(h.cfg, { maxCartLines: 2 });
  await h.sendQueued('cambia el pollo a broaster');
  expect(
    h.conv.sessionData.cart.map((line) => [line.productId, line.quantity]),
  ).toEqual([
    [702, 2],
    [709, 1],
  ]);
});
test('existing destination units are retained and the source is replaced', async () => {
  const h = setup(701, 2);
  h.conv.sessionData.cart.push({
    ...structuredClone(h.conv.sessionData.cart[0]),
    productId: 702,
    code: 12,
    name: '1 Pollo Broaster',
    unitPrice: 23000,
    quantity: 1,
  });
  await h.sendQueued('cambia el pollo frito a broaster');
  expect(h.conv.sessionData.cart.some((line) => line.productId === 701)).toBe(
    false,
  );
  expect(
    h.conv.sessionData.cart
      .filter((line) => line.productId === 702)
      .reduce((quantity, line) => quantity + line.quantity, 0),
  ).toBe(3);
  expect(
    h.conv.sessionData.cart.filter((line) => line.productId === 709),
  ).toHaveLength(1);
});
test('an explicit replacement quantity still controls the requested count', async () => {
  const h = setup(701, 2);
  await h.sendQueued('cambia el pollo por 1 Pollo Broaster');
  expect(
    h.conv.sessionData.cart
      .map((line) => [line.productId, line.quantity])
      .sort(),
  ).toEqual([
    [702, 1],
    [709, 1],
  ]);
});

for (const [sourceId, targetId, text] of [
  [707, 708, 'cambia el medio frito a broaster'],
  [708, 707, 'cambia el medio broaster por el medio frito'],
  [712, 713, 'cambia el cuarto frito a broaster'],
  [713, 712, 'cambia el cuarto broaster por el cuarto frito'],
] as const) {
  test(`portion identity and quantity are preserved ${text}`, async () => {
    const h = setup(sourceId, 2);
    const before = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued(text);
    expect(h.conv.sessionData.cart).toHaveLength(2);
    expect(
      h.conv.sessionData.cart.find((line) => line.productId === targetId),
    ).toMatchObject({
      quantity: 2,
      attributes: before[0].attributes,
      note: 'Sin sal',
    });
    expect(
      h.conv.sessionData.cart.find((line) => line.productId === 709),
    ).toEqual(before[1]);
    expect(
      h.conv.sessionData.cart.some((line) => line.productId === sourceId),
    ).toBe(false);
  });
}

for (const agent of [false, true]) {
  test(`an explicitly named different dish retains the catalog replacement flow, agent ${agent}`, async () => {
    const h = setup(705, 2, agent);
    const before = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('cambia la mojarra por el Combo De Pollo Broaster');
    expect(h.conv.sessionData.cart).toHaveLength(2);
    expect(
      h.conv.sessionData.cart.find((line) => line.productId === 704),
    ).toMatchObject({
      quantity: 2,
      attributes: before[0].attributes,
      note: 'Sin sal',
    });
    expect(
      h.conv.sessionData.cart.find((line) => line.productId === 709),
    ).toEqual(before[1]);
    expect(h.conv.sessionData.cart.some((line) => line.productId === 705)).toBe(
      false,
    );
  });
}

test('an explicitly named unavailable destination cannot replace the source', async () => {
  const products = menu();
  products[3].availableNow = false;
  const h = setup(705, 2, false, products);
  const before = structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('cambia la mojarra por el Combo De Pollo Broaster');
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
});

for (const agent of [false, true]) {
  test(`preparation stored as an attribute changes the existing meal, agent ${agent}`, async () => {
    const h = setup(714, 2, agent);
    h.conv.sessionData.cart[0].attributes!.push({
      attributeName: 'Pollo',
      attributeValue: 'Frito',
    });
    const before = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('cambia el arroz chino con medio pollo a broaster');
    const expected = {
      ...before[0],
      attributes: [
        ...before[0].attributes!.slice(0, -1),
        { attributeName: 'Pollo', attributeValue: 'Broaster' },
      ],
    };
    expect(h.conv.sessionData.cart).toEqual([expected, before[1]]);
    await h.sendQueued('cámbialo a broaster');
    expect(h.conv.sessionData.cart).toEqual([expected, before[1]]);
    await h.sendQueued('pásalo a frito');
    expect(h.conv.sessionData.cart).toEqual(before);
    await h.sendQueued('no más, recojo en el local');
    await h.sendQueued('efectivo');
    await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const items = h.service.ordersService.create.mock.calls[0][0].items;
    expect(
      items.filter((item: { productId: number }) => item.productId === 714),
    ).toHaveLength(2);
    expect(items).toHaveLength(3);
  });
}
test('mentioning chicken alone does not select rice containing chicken as its owner', async () => {
  const h = setup(714, 2);
  h.conv.sessionData.cart[0].attributes!.push({
    attributeName: 'Pollo',
    attributeValue: 'Frito',
  });
  const before = structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('cambia el pollo a broaster');
  expect(h.conv.sessionData.cart).toEqual(before);
});

test('an unavailable preparation option does not add a separate chicken', async () => {
  const products = menu();
  const rice = products.find((product) => product.id === 714)!;
  rice.attributes = rice.attributes!.map((attribute) =>
    attribute.attributeName === 'Pollo'
      ? { ...attribute, options: ['Frito'] }
      : attribute,
  );
  const h = setup(714, 2, false, products);
  h.conv.sessionData.cart[0].attributes!.push({
    attributeName: 'Pollo',
    attributeValue: 'Frito',
  });
  const before = structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('cambia el arroz chino con medio pollo a broaster');
  expect(h.conv.sessionData.cart).toEqual(before);
});

for (const [sourceId,targetId,style] of [[701,703,'frito'],[702,704,'broaster']] as const) {
 for (const text of [`pásalo a combo de pollo ${style}`,`cambia el pollo a combo ${style}`]) {
  test(`combo route ownership ${text}`,async()=>{
   const h=setup(sourceId,2);
   await h.sendQueued(text);
   expect(h.conv.sessionData.cart).toHaveLength(2);
   expect(h.conv.sessionData.cart.find(line=>line.productId===targetId)).toMatchObject({quantity:2,note:'Sin sal'});
   expect(h.conv.sessionData.cart.some(line=>line.productId===sourceId)).toBe(false);
  });
 }
}
