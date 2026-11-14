import { harness } from './whatsapp-accuracy.test-support';
import { canonicalStreetAddress } from './whatsapp-address-parts';
function setup() {
  const p = {
    id: 5341,
    code: 14,
    name: 'Combo De Tofu',
    price: 22000,
    availableNow: true,
    hasAttributes: true,
    attributes: [
      {
        attributeName: 'Bebida',
        options: ['Colombiana', 'Coca cola', 'Manzana'],
      },
      { attributeName: 'Arepas', options: ['Blancas', 'Fritas'] },
    ],
  };
  const h = harness([p], true);
  h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
  h.conv.sessionData.cart = [
    {
      productId: p.id,
      code: p.code,
      name: p.name,
      unitPrice: p.price,
      quantity: 2,
      note: 'Sin sal',
      attributes: [
        { attributeName: 'Bebida', attributeValue: 'Colombiana' },
        { attributeName: 'Arepas', attributeValue: 'Blancas' },
      ],
    },
  ];
  return { h, p };
}
test('one grouped combo accepts the beverage for every unit', async () => {
  const { h } = setup();
  const cart = structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('Bebida coca cola');
  expect(h.conv.sessionData.cart[0]).toEqual({
    ...cart[0],
    attributes: [
      { attributeName: 'Bebida', attributeValue: 'Coca cola' },
      cart[0].attributes![1],
    ],
  });
  expect(h.agent.runTurn).not.toHaveBeenCalled();
});
test('no quiero cambiar cancels an active option clarification', async () => {
  const { h } = setup();
  await h.sendQueued('Cambio bebida');
  expect(h.conv.sessionData.pendingCartOptionChoice).toBeDefined();
  const cart = structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('No quiero cambiar');
  expect(h.conv.sessionData.pendingCartOptionChoice).toBeUndefined();
  expect(h.conv.sessionData.cart).toEqual(cart);
  expect(h.replies.at(-1)).not.toMatch(/qué plato.*cambiar/i);
});
test('the compact saved street retains both BIS letters and its door', () => {
  expect(
    canonicalStreetAddress(
      'Diagonal 7ABisC N 73B42 casa 10 (ref. mapa: Kennedy, Bogotá, Colombia)',
    ),
  ).toBe('Diagonal 7A Bis C # 73B-42');
});

for (const quantity of [1, 2, 3])
  for (const text of [
    'Bebida coca cola',
    'Gaseosa Coca-Cola',
    'El combo con coca cola',
  ])
    test(`an included choice covers the grouped line ${quantity} ${text}`, async () => {
      const { h } = setup();
      h.conv.sessionData.cart[0].quantity = quantity;
      const cart = structuredClone(h.conv.sessionData.cart);
      await h.sendQueued(text);
      expect(h.conv.sessionData.cart[0]).toMatchObject({
        ...cart[0],
        attributes: [
          { attributeName: 'Bebida', attributeValue: 'Coca cola' },
          cart[0].attributes![1],
        ],
      });
      const changed = structuredClone(h.conv.sessionData.cart);
      await h.sendQueued('Para cada combo');
      expect(h.conv.sessionData.cart).toEqual(changed);
      expect(h.replies.at(-1)).toMatch(/Coca cola/i);
      expect(h.agent.runTurn).not.toHaveBeenCalled();
    });

for (const state of ['building_cart', 'awaiting_final_confirm'])
  test(`an included beverage preserves unrelated purchases ${state}`, async () => {
    const { h, p } = setup();
    const extra = {
      id: 5342,
      code: 15,
      name: 'Agua Embotellada',
      price: 3000,
      availableNow: true,
      hasAttributes: false,
      attributes: [],
    };
    h.service.catalogService.getMenuProducts.mockResolvedValue([p, extra]);
    h.conv.state = state;
    h.conv.sessionData.cart.push({
      productId: extra.id,
      code: extra.code,
      name: extra.name,
      unitPrice: extra.price,
      quantity: 1,
      attributes: [],
      note: 'Fría',
    });
    const cart = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('Bebida coca cola');
    expect(h.conv.sessionData.cart[0].attributes).toContainEqual({
      attributeName: 'Bebida',
      attributeValue: 'Coca cola',
    });
    expect(h.conv.sessionData.cart[1]).toEqual(cart[1]);
    expect(h.conv.sessionData.cart[0].quantity).toBe(2);
    expect(h.conv.state).toBe(state);
  });

test('a pending beverage retains its value until every offered combo is selected', async () => {
  const { h } = setup();
  h.conv.sessionData.cart.push({
    ...structuredClone(h.conv.sessionData.cart[0]),
    quantity: 1,
    note: 'Salsa aparte',
    attributes: [
      { attributeName: 'Bebida', attributeValue: 'Manzana' },
      { attributeName: 'Arepas', attributeValue: 'Fritas' },
    ],
  });
  const cart = structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('Bebida coca cola');
  expect(h.conv.sessionData.cart).toEqual(cart);
  expect(h.conv.sessionData.pendingCartAttributeEdit).toBeDefined();
  h.conv.sessionData = JSON.parse(JSON.stringify(h.conv.sessionData));
  await h.sendQueued('cuánto vale todo?');
  await h.sendQueued('Para cada combo');
  expect(h.conv.sessionData.pendingCartAttributeEdit).toBeUndefined();
  for (let index = 0; index < 2; index++)
    expect(h.conv.sessionData.cart[index]).toEqual({
      ...cart[index],
      attributes: [
        { attributeName: 'Bebida', attributeValue: 'Coca cola' },
        cart[index].attributes![1],
      ],
    });
});

for (const command of [
  'No quiero cambiar',
  'No quiero cambiar nada',
  'No quiero cambios',
])
  for (const pending of ['options', 'owner', 'none'])
    test(`a negative change request preserves the cart ${command} ${pending}`, async () => {
      const { h } = setup();
      if (pending === 'options') await h.sendQueued('Cambio bebida');
      if (pending === 'owner') {
        h.conv.sessionData.cart.push({
          ...structuredClone(h.conv.sessionData.cart[0]),
          quantity: 1,
          note: 'Salsa aparte',
        });
        await h.sendQueued('Bebida coca cola');
        expect(h.conv.sessionData.pendingCartAttributeEdit).toBeDefined();
      }
      const cart = structuredClone(h.conv.sessionData.cart);
      await h.sendQueued(command);
      expect(h.conv.sessionData.cart).toEqual(cart);
      expect(h.conv.sessionData.pendingCartOptionChoice).toBeUndefined();
      expect(h.conv.sessionData.pendingCartAttributeEdit).toBeUndefined();
      expect(h.replies.at(-1)).not.toMatch(/qué plato.*cambiar/i);
    });

for (const text of [
  '¿No quiero cambiar?',
  '«No quiero cambiar»',
  'No quiero cambiar si cuesta más',
])
  test(`a question, quote or condition preserves the active selection ${text}`, async () => {
    const { h } = setup();
    await h.sendQueued('Cambio bebida');
    const cart = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued(text);
    expect(h.conv.sessionData.cart).toEqual(cart);
    expect(h.conv.sessionData.pendingCartOptionChoice).toBeDefined();
    expect(h.replies.at(-1)).not.toMatch(/Cancelé ese cambio/);
  });

for (const input of [
  'Diagonal 7ABisC N 73B42 casa 10',
  'Dg. 7ABISC #73B42',
  'Diagonal 7A bis C N° 73B-42',
  'Diagonal 7A Bis C No. 73B42',
])
  test(`compact street lookup preserves identity ${input}`, () => {
    expect(canonicalStreetAddress(input)).toBe('Diagonal 7A Bis C # 73B-42');
  });

import { WhatsappDeliveryRoutingService } from './whatsapp-delivery-routing.service';
import { WhatsappOrchestratorService } from './whatsapp-orchestrator.service';

afterEach(() => jest.restoreAllMocks());

test('a saved compact street can be reused through checkout with the new quote', async () => {
  const { h } = setup();
  h.conv.state = 'awaiting_address';
  Object.assign(h.cfg, {
    deliveryFeeMode: 'distance',
    restaurantLat: 4.63,
    restaurantLng: -74.15,
  });
  Object.assign(h.conv.sessionData, {
    orderType: 'delivery',
    lastDeliveryAddress:
      'Diagonal 7ABisC N 73B42 casa 10 (ref. mapa: Kennedy, Bogotá, Colombia)',
    fulfillmentChosen: true,
    phoneConfirmed: true,
    contactPhone: h.conv.phoneE164,
    notesCollected: true,
  });
  h.service.deliveryRouting = {
    quoteDeliveryFee: jest
      .fn()
      .mockImplementation(async ({ customerAddress }) => {
        expect(canonicalStreetAddress(customerAddress)).toBe(
          'Diagonal 7A Bis C # 73B-42',
        );
        return {
          ok: true,
          fee: 2000,
          distanceKm: 0.9,
          source: 'google_directions',
          customer: { lat: 4.6349823, lng: -74.1418366 },
        };
      }),
  };
  h.service.ordersService.create = jest
    .fn()
    .mockResolvedValue({ id: 534, dailyOrderNumber: 534 });
  h.service.ordersService.findTodayOrdersByPhone = jest
    .fn()
    .mockResolvedValue([]);
  await h.sendQueued('A esta misma');
  expect(h.conv.sessionData.address).toContain('73B42 casa 10');
  expect(h.conv.sessionData.addressConfirmed).toBe(true);
  expect(h.conv.state).toBe('awaiting_payment');
  await h.sendQueued('transferencia');
  await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  expect(h.service.ordersService.create.mock.calls[0][0].address).toContain(
    '73B42 casa 10',
  );
});

test('the routing provider receives an identifiable compact street', async () => {
  const service = new WhatsappDeliveryRoutingService({
    get: () => 'synthetic-key',
  } as never);
  const queries: string[] = [];
  jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
    const query = new URL(String(url)).searchParams.get('address') || '';
    queries.push(query);
    return {
      status: 200,
      json: async () => ({
        status: 'OK',
        results: [
          {
            formatted_address: 'Dg. 7A Bis C #73B-42, Bogotá, Colombia',
            geometry: { location: { lat: 4.6349823, lng: -74.1418366 } },
            address_components: [{ short_name: 'CO', types: ['country'] }],
          },
        ],
      }),
    } as any;
  });
  jest
    .spyOn(service as any, 'directionsDistance')
    .mockResolvedValue({ distanceKm: 0.9, durationMinutes: 4 });
  const quote = await service.quoteDeliveryFee({
    customerAddress: 'Diagonal 7ABisC N 73B42 casa 10',
    restaurant: { lat: 4.63, lng: -74.15 },
    tiers: [{ maxKm: 5, fee: 2000 }],
    maxKm: 5,
    fallbackFee: 2000,
  });
  expect(quote).toMatchObject({ ok: true, fee: 2000 });
  expect(queries.length).toBeGreaterThan(0);
});

test('a pin retains the written door and identifies the nearby map label separately', async () => {
  const { h } = setup();
  h.service.reply = (WhatsappOrchestratorService.prototype as any).reply.bind(
    h.service,
  );
  Object.assign(h.cfg, {
    deliveryFeeMode: 'distance',
    restaurantLat: 4.63,
    restaurantLng: -74.15,
    deliveryFeeTiers: [{ maxKm: 5, fee: 2000 }],
  });
  Object.assign(h.conv.sessionData, {
    orderType: 'delivery',
    fulfillmentChosen: true,
    phoneConfirmed: true,
    contactPhone: h.conv.phoneE164,
    notesCollected: true,
    address: 'Diagonal 7ABisC N 73B42 casa 10',
    addressConfirmed: false,
    deliveryFeeCalculated: null,
    deliveryLat: null,
    deliveryLng: null,
  });
  h.service.deliveryRouting = new WhatsappDeliveryRoutingService({
    get: () => 'synthetic-key',
  } as never);
  jest.spyOn(global, 'fetch').mockResolvedValue({
    status: 200,
    json: async () => ({
      status: 'OK',
      routes: [
        {
          legs: [
            {
              end_address: 'Dg. 7a Bis C #73B-74, Bogotá, Colombia',
              distance: { value: 900 },
              duration: { value: 300 },
            },
          ],
        },
      ],
    }),
  } as any);
  h.service.ordersService.create = jest
    .fn()
    .mockResolvedValue({ id: 534, dailyOrderNumber: 534 });
  h.service.ordersService.findTodayOrdersByPhone = jest
    .fn()
    .mockResolvedValue([]);
  await h.sendQueued('', {
    messageType: 'location',
    latitude: 4.6349823,
    longitude: -74.1418366,
  });
  expect(h.conv.sessionData.address).toContain(
    'Dirección escrita: Diagonal 7ABisC N 73B42 casa 10',
  );
  expect(h.conv.sessionData.address).toContain(
    'Referencia de mapa: Dg. 7a Bis C #73B-74',
  );
  expect(h.conv.sessionData.address).toContain(
    'https://maps.google.com/?q=4.6349823,-74.1418366',
  );
  expect(h.conv.sessionData.deliveryLat).toBe(4.6349823);
  expect(h.conv.sessionData.deliveryLng).toBe(-74.1418366);
  await h.sendQueued('transferencia');
  await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto = h.service.ordersService.create.mock.calls[0][0];
  expect(dto.address).toContain(
    'Dirección escrita: Diagonal 7ABisC N 73B42 casa 10',
  );
  expect(dto.address).toContain(
    'https://maps.google.com/?q=4.6349823,-74.1418366',
  );
});

for (const [input, expected] of [
  ['Carrera 82ABisB N 6C17 apto 1101', 'Carrera 82A Bis B # 6C-17'],
  ['Calle 10BisA N 81F20', 'Calle 10 Bis A # 81F-20'],
  ['Diagonal 7ABisC #73B-74', 'Diagonal 7A Bis C # 73B-74'],
])
  test(`compact BIS parsing works independently of the restaurant ${input}`, () => {
    expect(canonicalStreetAddress(input)).toBe(expected);
  });

test('a nearby map door cannot replace the compact written door during address lookup', async () => {
  const service = new WhatsappDeliveryRoutingService({
    get: () => 'synthetic-key',
  } as never);
  jest
    .spyOn(global, 'fetch')
    .mockResolvedValue({
      status: 200,
      json: async () => ({
        status: 'OK',
        results: [
          {
            formatted_address: 'Dg. 7A Bis C #73B-74, Bogotá, Colombia',
            geometry: { location: { lat: 4.6349823, lng: -74.1418366 } },
            address_components: [{ short_name: 'CO', types: ['country'] }],
          },
        ],
      }),
    } as any);
  const route = jest.spyOn(service as any, 'directionsDistance');
  const quote = await service.quoteDeliveryFee({
    customerAddress: 'Diagonal 7ABisC N 73B42 casa 10',
    restaurant: { lat: 4.63, lng: -74.15 },
    tiers: [{ maxKm: 5, fee: 2000 }],
    maxKm: 5,
    fallbackFee: 2000,
  });
  expect(quote).toMatchObject({ ok: false, reason: 'address_ambiguous' });
  expect(route).not.toHaveBeenCalled();
});

test('each combo cannot authorize changes to a different offered dish', async () => {
  const { h, p } = setup();
  const other = { ...p, id: 5343, code: 16, name: 'Bowl Vegetal' };
  h.service.catalogService.getMenuProducts.mockResolvedValue([p, other]);
  h.conv.sessionData.cart.push({
    ...structuredClone(h.conv.sessionData.cart[0]),
    productId: other.id,
    code: other.code,
    name: other.name,
    quantity: 1,
  });
  const cart = structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('Bebida coca cola');
  expect(h.conv.sessionData.pendingCartAttributeEdit).toBeDefined();
  await h.sendQueued('Para cada combo');
  expect(h.conv.sessionData.cart).toEqual(cart);
  expect(h.conv.sessionData.pendingCartAttributeEdit).toBeDefined();
});
