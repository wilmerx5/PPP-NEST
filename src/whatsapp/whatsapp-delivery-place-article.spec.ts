import { harness } from './whatsapp-accuracy.test-support';

type Menu = { id: string; order: string; place: string; street: string; products: Record<string, unknown>[] };

const menus: Menu[] = [
  { id: 'arepas', order: 'una arepa rellena', place: 'Los Almendros', street: 'calle 45 # 12-10', products: [
    { id: 930, code: 10, name: 'Arepa Rellena', price: 12000, categoryName: 'Arepas', availableNow: true, hasAttributes: false, attributes: [] },
    { id: 931, code: 11, name: 'Jugo De Lulo', price: 5000, categoryName: 'Bebidas', availableNow: true, hasAttributes: false, attributes: [] },
  ] },
  { id: 'pastas', order: 'una lasagna mixta personal', place: 'La Esperanza', street: 'carrera 7 # 20-30 apto 301', products: [
    { id: 940, code: 20, name: 'Lasagna Mixta', price: 26000, categoryName: 'Pastas', availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Tamaño', options: ['Personal', 'Familiar'] }] },
    { id: 941, code: 21, name: 'Pan De Ajo', price: 6000, categoryName: 'Entradas', availableNow: true, hasAttributes: false, attributes: [] },
  ] },
  { id: 'seafood', order: 'dos ceviches clasicos suaves', place: 'El Recreo', street: 'diagonal 32 # 8-15 torre 2', products: [
    { id: 950, code: 30, name: 'Ceviche Clasico', price: 30000, categoryName: 'Mariscos', availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Picante', options: ['Suave', 'Medio', 'Fuerte'] }] },
    { id: 951, code: 31, name: 'Patacones', price: 8000, categoryName: 'Acompañantes', availableNow: true, hasAttributes: false, attributes: [] },
  ] },
];

describe.each(menus)('$id: a place whose name starts with an article keeps it', m => {
  describe.each([false, true])('agent %s', agent => {
    // In this harness closing the cart without an address leaves the order for pickup at the payment step.
    const toPickupPayment = async () => {
      const h = harness(m.products as never, agent);
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      await h.sendQueued(m.order);
      await h.sendQueued('no');
      expect(h.conv.state).toBe('awaiting_payment');
      return h;
    };

    it.each(['{p}', 'en {p}'])('answering the address question with «%s» notes the full name and joins it to the street', async said => {
      const h = await toPickupPayment();
      await h.sendQueued('domicilio');
      const noted = String(await h.sendQueued(said.replace('{p}', m.place)));
      expect(noted).toContain(`Anoté la referencia: _${m.place}_`);
      await h.sendQueued(m.street);
      expect(h.conv.sessionData.address).toBe(`${m.street}, ${m.place}`);
    });

    it.each(['Me lo envias a {p}', 'me lo mandas para {p}'])('«%s» names the full place and joins it to the street', async said => {
      const h = await toPickupPayment();
      const reply = String(await h.sendQueued(said.replace('{p}', m.place)));
      expect(reply).toContain(`Anoté *${m.place}*`);
      expect(h.conv.state).toBe('awaiting_address');
      await h.sendQueued(m.street);
      expect(h.conv.sessionData.address).toBe(`${m.street}, ${m.place}`);
      expect(h.conv.sessionData.orderType).toBe('delivery');
    });

    it('contrast: an article before a street is still dropped', async () => {
      const h = await toPickupPayment();
      await h.sendQueued('domicilio');
      await h.sendQueued(`la ${m.street}`);
      expect(h.conv.sessionData.address).toBe(m.street);
      expect(h.conv.state).not.toBe('awaiting_address');
    });

    it('contrast: «me lo envías a la <street>» quotes the street without the article', async () => {
      const h = await toPickupPayment();
      await h.sendQueued(`me lo envias a la ${m.street}`);
      expect(h.conv.sessionData.address).toMatch(new RegExp(`^${m.street.replace(/#/g, '\\#')}`));
      expect(h.conv.sessionData.orderType).toBe('delivery');
      expect(h.conv.sessionData.pendingDeliveryPlace).toBeUndefined();
    });

    it('contrast: «al conjunto <name>» keeps the complex and drops the contraction', async () => {
      const h = await toPickupPayment();
      await h.sendQueued('domicilio');
      await h.sendQueued(`al conjunto ${m.place}`);
      expect(h.conv.sessionData.address).toBe(`conjunto ${m.place}`);
    });
  });
});
