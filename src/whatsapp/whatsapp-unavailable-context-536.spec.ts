import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { harness } from './whatsapp-accuracy.test-support';

const menu = [
  {
    id: 5361,
    code: 11,
    name: 'Ejecutivo Con Pollo Frito',
    price: 24000,
    availableNow: true,
    hasAttributes: false,
    attributes: [],
  },
  {
    id: 5362,
    code: 12,
    name: 'Sopa De Ajiaco',
    price: 12000,
    availableNow: true,
    hasAttributes: false,
    attributes: [],
  },
  {
    id: 5363,
    code: 13,
    name: 'Combo De Pollo Broaster',
    price: 55000,
    availableNow: true,
    hasAttributes: false,
    attributes: [],
  },
  {
    id: 5364,
    code: 14,
    name: '1/2 Pollo Broaster',
    price: 26000,
    availableNow: true,
    hasAttributes: false,
    attributes: [],
  },
];
const incident =
  'Buenas tardes por favor me envía un ejecutivo de pollo frito y un ajiaco\nPara Castilla reservado torre 13 apto 5010';
function setup() {
  const h = harness(menu, true);
  h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
  h.conv.state = 'awaiting_payment';
  Object.assign(h.conv.sessionData, {
    fulfillmentChosen: true,
    orderType: 'delivery',
    address: 'Calle 10 #20-30',
    addressConfirmed: true,
    deliveryFeeCalculated: 2000,
    phoneConfirmed: true,
    contactPhone: h.conv.phoneE164,
    notesCollected: true,
    cart: [
      {
        productId: 5363,
        name: menu[2].name,
        code: 13,
        unitPrice: 55000,
        quantity: 1,
        attributes: [],
      },
    ],
    recentUnavailableOrder: {
      items: ['lo que quiero es'],
      expiresAt: Date.now() + 900000,
    },
  });
  return h;
}

test('the production message reaches purchase processing despite stale conversational framing', async () => {
  const h = setup();
  const before = structuredClone(h.conv.sessionData.cart);
  await h.sendQueued(incident);
  expect(h.replies.at(-1)).not.toMatch(/no tenemos \*lo que quiero es\*/i);
  expect(h.conv.sessionData.pendingOrderBoundary).toBeDefined();
  expect(h.conv.sessionData.cart).toEqual(before);
  await h.sendQueued('continuar pedido');
  expect(h.conv.sessionData.cart).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ productId: 5361, quantity: 1 }),
      expect.objectContaining({ productId: 5362, quantity: 1 }),
    ]),
  );
});

test('a complaint quoting bogus unavailable framing reaches the agent', async () => {
  const h = setup();
  const cart = structuredClone(h.conv.sessionData.cart);
  h.agent.runTurn.mockResolvedValue({
    reply: 'Tengo un combo en el carrito. ¿Qué necesitas corregir?',
    actions: {},
    toolCalls: [],
  });
  await h.sendQueued('que esta pasaando contigo, como que *lo que quiero es*');
  expect(h.agent.runTurn).toHaveBeenCalled();
  expect(h.replies.at(-1)).not.toMatch(/no tenemos \*lo que quiero es\*/i);
  expect(h.conv.sessionData.cart).toEqual(cart);
});

for (const prefix of [
  'lo que quiero es',
  'lo que quieor es',
  'Lo que deseo es',
  'lo que necesito es',
])
  test(`a purchase preamble never becomes a missing dish ${prefix}`, () => {
    const catalog = new WhatsappCatalogService({} as any);
    const result = catalog.resolveMultiProductOrder(
      `${prefix} un combo de pollo broaster y medio broaster`,
      menu,
    );
    expect(result?.unresolved).toEqual([]);
    const items = [
      ...(result?.confident || []),
      ...(result?.needsAttributes || []),
      ...(result?.ambiguous || []).flatMap(item => item.candidates.map(product => ({product}))),
    ];
    expect(items.map((item) => item.product.id)).toEqual(
      expect.arrayContaining([5363, 5364]),
    );
  });

for (const text of [
  incident,
  'quiero una sopa',
  'por favor me envías dos platos',
  'como que lo que quiero es',
])
  test(`stale framing cannot claim an unrelated turn ${text}`, () => {
    const catalog = new WhatsappCatalogService({} as any);
    expect(catalog.followUpDishClaim(text, ['lo que quiero es'])).toBeNull();
  });

test('real unavailable dish follow-ups retain typo tolerance without matching only a shared dish word', () => {
  const catalog = new WhatsappCatalogService({} as any);
  expect(
    catalog.followUpDishClaim('vi milanea en el menu', ['una milanesa']),
  ).toBe('una milanesa');
  expect(
    catalog.followUpDishClaim('quiero pollo frito y un ajiaco', [
      'pollo teriyaki',
    ]),
  ).toBeNull();
  expect(
    catalog.followUpDishClaim('el pollo teriyaki si esta en la carta', [
      'pollo teriyaki',
    ]),
  ).toBe('pollo teriyaki');
});

for (const prefix of ['lo que quieor es', 'lo que deseo es'])
  test(`the complete router does not store a conversational prefix as unavailable ${prefix}`, async () => {
    const h = harness(menu, true);
    h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
    await h.sendQueued(`${prefix} un combo de pollo broaster y medio broaster`);
    expect(h.replies.join(' ')).not.toMatch(/no manejamos: _lo que/i);
    expect(
      h.conv.sessionData.recentUnavailableOrder?.items || [],
    ).not.toContain(prefix);
  });
