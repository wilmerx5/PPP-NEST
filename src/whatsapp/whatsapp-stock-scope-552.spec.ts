import { harness } from './whatsapp-accuracy.test-support';
import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { isDeliveryEtaInquiry } from './whatsapp-session-intents';

const catalogues = [
  { name: 'Arepa De Setas', subject: 'setas', price: 15000 },
  { name: 'Tortilla De Espinaca', subject: 'espinaca', price: 17000 },
].map((fixture, index) => ({
  ...fixture,
  product: { id: 55201 + index, code: 55201 + index, name: fixture.name,
    price: fixture.price, availableNow: true, hasAttributes: false, attributes: [] },
}));
const catalog = new WhatsappCatalogService({} as never);

beforeEach(() => jest.spyOn(global, 'fetch').mockRejectedValue(new Error('No external network in stock-scope regressions')));
afterEach(() => jest.restoreAllMocks());

for (const fixture of catalogues) {
  for (const text of [
    `le queda ${fixture.subject}?`,
    `¿Les quedan ${fixture.subject}?`,
    `Todavía les queda ${fixture.subject} porfa`,
    `Buenas noches, le queda ${fixture.subject}?`,
    `Hola veci\n¿todavía te queda ${fixture.subject}?`,
    `Quedan ${fixture.subject}?`,
  ]) {
    it(`recognizes a complete stock question ${text}`, () => {
      expect(catalog.availabilitySubject(text)).toBe(fixture.subject);
      expect(catalog.isAvailabilityInquiry(text)).toBe(true);
    });
  }
  for (const text of [
    `Quita las ${fixture.name} y dime cuánto queda`,
    `El ${fixture.name} queda sin cebolla`,
    `Quiero que dos ${fixture.name} queden sin cebolla`,
    `le queda ${fixture.subject} y agrega una bebida`,
    `Todavía les queda ${fixture.subject}, cambia el pedido`,
    `Buenas noches, quiero un ${fixture.name}, ¿cuánto queda?`,
    '¿Con esto queda confirmado?',
    '¿Así queda bien?',
    '¿Le queda confirmado el pedido?',
    '¿Te queda bien con esto?',
    '¿Cuánto queda por pagar?',
    'Me queda pendiente pagar',
    '¿Cuánto le queda al domicilio?',
    'Todavía le queda tiempo?',
    '¿Quedan cinco minutos?',
    '¿Dónde queda el restaurante?',
  ]) {
    it(`remaining-state language stays outside stock intent ${fixture.subject}/${text}`, () => {
      expect(catalog.availabilitySubject(text)).toBeNull();
      expect(catalog.isAvailabilityInquiry(text)).toBe(false);
    });
  }

  for (const agent of [false, true]) {
    it(`ambiguous removal and total retain the pending line choice ${fixture.subject}/agent${agent}`, async () => {
      const h = harness([fixture.product], agent);
      h.conv.state = 'awaiting_payment';
      h.service.ordersService.create = jest.fn();
      Object.assign(h.conv.sessionData, {
        orderType: 'delivery', address: 'Calle 12 30 45', addressConfirmed: true,
        phoneConfirmed: true, contactPhone: h.conv.phoneE164, deliveryFeeCalculated: 3000,
        cart: ['sin cebolla', 'sin tomate'].map((note, index) => ({
          productId: fixture.product.id, code: fixture.product.code, name: fixture.name,
          unitPrice: fixture.price, quantity: index ? 2 : 3, note, attributes: [],
        })),
      });
      const before = structuredClone(h.conv.sessionData.cart);
      const question = await h.sendQueued(`Quita las ${fixture.name} y dime cuánto queda`);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.pendingCartRemoval?.options).toHaveLength(2);
      expect(question).toMatch(/cuál línea/i);
      expect(question).not.toMatch(/no tenemos|no manejamos|total/i);
      await h.sendQueued('2');
      expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({
        productId: fixture.product.id, quantity: 3, note: 'sin cebolla',
      })]);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });

    it(`a confirmation question preserves the draft until explicit approval ${fixture.subject}/agent${agent}`, async () => {
      const h = harness([fixture.product], agent);
      h.conv.state = 'awaiting_final_confirm';
      h.service.ordersService.create = jest.fn();
      Object.assign(h.conv.sessionData, {
        cart: [{productId:fixture.product.id,code:fixture.product.code,name:fixture.name,
          unitPrice:fixture.price,quantity:1,attributes:[]}],
        orderType:'delivery',fulfillmentChosen:true,address:'Calle 12 34 56',addressConfirmed:true,
        phoneConfirmed:true,contactPhone:h.conv.phoneE164,paymentMethod:'contraentrega',notesCollected:true,
        deliveryFeeCalculated:2000,
      });
      const before = structuredClone(h.conv.sessionData);
      const reply = await h.sendQueued('¿Con esto queda confirmado?');
      expect(h.conv.sessionData).toEqual(before);
      expect(h.conv.state).toBe('awaiting_final_confirm');
      expect(reply).not.toMatch(/no tenemos|no manejamos|pedido registrado/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      h.service.ordersService.create.mockResolvedValue({id:552,dailyOrderNumber:552});
      await h.sendQueued('Confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      expect(h.conv.state).toBe('completed');
    });
  }
}


for (const [text, expected] of [
  ['Quita las arepas y dime cuánto queda', false],
  ['Cuánto queda por pagar?', false],
  ['¿En cuánto queda el pedido?', false],
  ['¿Cuánto queda el domicilio?', false],
  ['Cuánto falta de la cuenta?', false],
  ['Cuánto le queda al pedido?', true],
  ['Cuánto tiempo falta?', true],
  ['Cuánto falta para que llegue?', true],
] as const) {
  it(`remaining-time classification preserves its scope ${text}`, () => {
    expect(isDeliveryEtaInquiry(text)).toBe(expected);
  });
}
