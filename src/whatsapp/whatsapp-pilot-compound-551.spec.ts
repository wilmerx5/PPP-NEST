import { harness } from './whatsapp-accuracy.test-support';
import { WhatsappAgentService } from './whatsapp-agent.service';
import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { isDeliveryEtaInquiry } from './whatsapp-session-intents';
import { DEFAULT_PAYMENT_METHODS } from './whatsapp-payment-methods';
const call = (name: string, args: unknown) => ({
  id: 'call-' + name,
  type: 'function',
  function: { name, arguments: JSON.stringify(args) },
});
const answer = (content: string | null, calls?: unknown[]) =>
  new Response(
    JSON.stringify({ choices: [{ message: { content, tool_calls: calls } }] }),
    { status: 200 },
  );
const menus = [
  {
    subject: 'menudencia',
    plural: 'menudencias',
    dish: 'Sopa De Menudencias',
    combo: 'Combo De Pollo Frito',
  },
  {
    subject: 'vegetales',
    plural: 'vegetales',
    dish: 'Caldo De Vegetales',
    combo: 'Combo De Tofu',
  },
].map((data, index) => ({
  data,
  products: [
    {
      id: 55001 + index * 10,
      code: 1,
      name: data.dish,
      price: 12000,
      availableNow: true,
      attributes: [],
    },
    {
      id: 55002 + index * 10,
      code: 2,
      name: data.dish + ' Pequeña',
      price: 10000,
      availableNow: true,
      attributes: [],
    },
    {
      id: 55003 + index * 10,
      code: 3,
      name: data.combo,
      price: 53000,
      availableNow: true,
      hasAttributes: true,
      attributes: [
        { attributeName: 'Bebida', options: ['Colombiana', 'Ginger'] },
        { attributeName: 'Arepas', options: ['Blancas', 'Fritas'] },
      ],
    },
  ],
}));
const cfg = {
  openaiApiKey: 'synthetic',
  openaiModel: 'gpt-4o-mini',
  systemPrompt: '',
  aiTemperature: 0.2,
  localContext: {},
  paymentMethods: DEFAULT_PAYMENT_METHODS,
};
function setup(products = menus[0].products) {
  const h = harness(products, true);
  h.conv.customerName = 'Camila Rojas';
  h.conv.sessionData = { cart: [], orderType: 'delivery' };
  h.service.settingsService.semanticRoutingEnabled = () => true;
  h.service.agentService = {
    runTurn: jest
      .fn()
      .mockRejectedValue(
        new Error('A closed stock question requires no inference'),
      ),
  };
  h.service.conversationService.saveSemanticSession = jest.fn(
    async (_conv, expected, next, state, name) => {
      if (
        h.conv.state !== expected.state ||
        JSON.stringify(h.conv.sessionData) !== JSON.stringify(expected.session)
      )
        return false;
      h.conv.sessionData = structuredClone(next);
      h.conv.state = state;
      if (name) h.conv.customerName = name;
      return true;
    },
  );
  return h;
}
beforeEach(() =>
  jest
    .spyOn(global, 'fetch')
    .mockRejectedValue(new Error('Unexpected network in free regression')),
);
afterEach(() => jest.restoreAllMocks());

const timings = [
  'cuánto te demoras?',
  'qué tanto te demoras?',
  'Cuánto tardas?',
  'cuánto se demoran?',
  'cuánto tiempo tardarían?',
];
for (const text of timings)
  it(`delivery inquiry understands the human verb ${text}`, () => {
    expect(isDeliveryEtaInquiry(text)).toBe(true);
  });
for (const { data, products } of menus)
  for (const state of ['building_cart', 'awaiting_name', 'awaiting_payment'])
    for (const timing of timings.slice(0, 3))
      it(`whole purchase preserves every intent ${data.subject}/${state}/${timing}`, async () => {
        const h = setup(products);
        h.conv.state = state;
        const buy = `por favor un ${data.combo} con Ginger y arepas fritas y un ${data.dish}`;
        const destination = 'Calle 6B #78C-36 apto 302';
        const text = `Buenas tardes, ${buy}. Para ${destination}. Por favor ${timing}`;
        h.service.agentService = new WhatsappAgentService(
          { getEffectiveConfig: async () => cfg } as never,
          new WhatsappCatalogService({} as never),
        );
        const purchase = [
          { attributeName: 'Bebida', attributeValue: 'Ginger' },
          { attributeName: 'Arepas', attributeValue: 'Fritas' },
        ];
        jest
          .spyOn(global, 'fetch')
          .mockResolvedValueOnce(
            answer(null, [
              call('interpret_message', {
                segments: [
                  {
                    text: 'Buenas tardes,',
                    role: 'conversation',
                    productIds: [],
                  },
                  {
                    text: buy + '.',
                    role: 'purchase',
                    productIds: [products[2].id, products[0].id],
                  },
                  {
                    text: 'Para ' + destination + '.',
                    role: 'checkout',
                    productIds: [],
                  },
                  {
                    text: 'Por favor ' + timing,
                    role: 'inquiry',
                    productIds: [],
                  },
                ],
              }),
            ]),
          )
          .mockResolvedValueOnce(
            answer(null, [
              call('add_item', {
                sourceText: buy + '.',
                productId: products[2].id,
                quantity: 1,
                attributes: purchase,
              }),
              call('add_item', {
                sourceText: buy + '.',
                productId: products[0].id,
                quantity: 1,
              }),
              call('set_address', {
                sourceText: 'Para ' + destination + '.',
                address: destination,
              }),
              call('delivery_time', { sourceText: 'Por favor ' + timing }),
            ]),
          )
          .mockResolvedValueOnce(answer('Listo'));
        const reply = await h.sendQueued(text);
        expect(reply).toMatch(/35[-–]45/);
        expect(reply).toMatch(/c[oó]mo pagas/i);
        expect(reply).not.toMatch(/aclaras qué quieres|no entend/i);
        expect(h.conv.sessionData.cart).toHaveLength(2);
        expect(h.conv.sessionData.cart).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              productId: products[2].id,
              quantity: 1,
              attributes: purchase,
            }),
            expect.objectContaining({ productId: products[0].id, quantity: 1 }),
          ]),
        );
        expect(h.conv.sessionData.address).toContain(destination);
        h.service.ordersService.create = jest
          .fn()
          .mockResolvedValue({ id: 551, dailyOrderNumber: 551 });
        await h.sendQueued('319 7724400');
        await h.sendQueued('1');
        await h.sendQueued('confirmar');
        expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
        expect(h.conv.state).toBe('completed');
        expect(
          h.service.ordersService.create.mock.calls[0][0].items,
        ).toHaveLength(2);
      });

for (const { data, products } of menus) {
  for (const repeatAcceptedPurchase of [false, true]) {
    it(`repairs omitted checkout without adding a second purchase ${data.subject}/${repeatAcceptedPurchase}`, async () => {
      const h = setup(products);
      const purchase = `un ${data.dish}`;
      const address = 'Calle 6B #78C-36 apto 302';
      const checkout = `para ${address}`;
      const text = `${purchase}, ${checkout}`;
      h.service.agentService = new WhatsappAgentService(
        { getEffectiveConfig: async () => cfg } as never,
        new WhatsappCatalogService({} as never),
      );
      const add = call('add_item', {
        sourceText: purchase,
        productId: products[0].id,
        quantity: 1,
      });
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          answer(null, [
            call('interpret_message', {
              segments: [
                {
                  text: purchase,
                  role: 'purchase',
                  productIds: [products[0].id],
                },
                { text: checkout, role: 'checkout', productIds: [] },
              ],
            }),
          ]),
        )
        .mockResolvedValueOnce(answer(null, [add]))
        .mockResolvedValueOnce(answer('Listo'))
        .mockResolvedValueOnce(
          answer(null, [
            ...(repeatAcceptedPurchase ? [add] : []),
            call('set_address', { sourceText: checkout, address }),
          ]),
        )
        .mockResolvedValueOnce(answer('Completado'));
      const reply = await h.sendQueued(text);
      expect(reply).not.toMatch(/aclaras qué quieres|no entend/i);
      expect(reply).toMatch(/c[oó]mo pagas/i);
      expect(h.conv.sessionData.cart).toEqual([
        expect.objectContaining({ productId: products[0].id, quantity: 1 }),
      ]);
      expect(h.conv.sessionData.address).toBe(address);
      expect(global.fetch).toHaveBeenCalledTimes(5);
    });
  }
}
