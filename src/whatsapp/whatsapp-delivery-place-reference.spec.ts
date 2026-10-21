import { harness } from './whatsapp-accuracy.test-support';

type Menu = { id: string; order: string; place: string; street: string; products: Record<string, unknown>[] };

const menus: Menu[] = [
  { id: 'arepas', order: 'una arepa rellena', place: 'Villa Clara', street: 'calle 45 # 12-10', products: [
    { id: 900, code: 10, name: 'Arepa Rellena', price: 12000, categoryName: 'Arepas', availableNow: true, hasAttributes: false, attributes: [] },
    { id: 901, code: 11, name: 'Jugo De Lulo', price: 5000, categoryName: 'Bebidas', availableNow: true, hasAttributes: false, attributes: [] },
  ] },
  { id: 'pastas', order: 'una lasagna mixta personal', place: 'Prado Alto', street: 'carrera 7 # 20-30 apto 301', products: [
    { id: 910, code: 20, name: 'Lasagna Mixta', price: 26000, categoryName: 'Pastas', availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Tamaño', options: ['Personal', 'Familiar'] }] },
    { id: 911, code: 21, name: 'Pan De Ajo', price: 6000, categoryName: 'Entradas', availableNow: true, hasAttributes: false, attributes: [] },
  ] },
  { id: 'seafood', order: 'dos ceviches clasicos suaves', place: 'Monteverde', street: 'diagonal 32 # 8-15 torre 2', products: [
    { id: 920, code: 30, name: 'Ceviche Clasico', price: 30000, categoryName: 'Mariscos', availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Picante', options: ['Suave', 'Medio', 'Fuerte'] }] },
    { id: 921, code: 31, name: 'Patacones', price: 8000, categoryName: 'Acompañantes', availableNow: true, hasAttributes: false, attributes: [] },
  ] },
];

describe.each(menus)('$id: a place named before the street stays with the address', m => {
  describe.each([false, true])('agent %s', agent => {
    // In this harness closing the cart without an address leaves the order for pickup at the payment step.
    const toPickupPayment = async () => {
      const h = harness(m.products as never, agent);
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      await h.sendQueued(m.order);
      await h.sendQueued('no');
      expect(h.conv.state).toBe('awaiting_payment');
      expect(h.conv.sessionData.orderType).toBe('pickup');
      return h;
    };
    const cartOf = (h: ReturnType<typeof harness>) => JSON.stringify(h.conv.sessionData.cart);
    const occurrences = (text: string, part: string) => text.toLowerCase().split(part.toLowerCase()).length - 1;

    it('«me lo envías a <place>» and then the street keeps both', async () => {
      const h = await toPickupPayment();
      const cart = cartOf(h);
      await h.sendQueued(`Me lo envias a ${m.place}`);
      expect(h.conv.state).toBe('awaiting_address');
      const reply = String(await h.sendQueued(m.street));
      const address = String(h.conv.sessionData.address);
      expect(address.startsWith(m.street)).toBe(true);
      expect(occurrences(address, m.place)).toBe(1);
      expect(reply).toContain(m.place);
      expect(h.conv.sessionData.orderType).toBe('delivery');
      expect(h.conv.sessionData.pendingDeliveryPlace).toBeUndefined();
      expect(cartOf(h)).toBe(cart);
    });

    it.each(['{p}', 'en {p}'])('answering the address question with «%s» and then the street keeps both', async said => {
      const h = await toPickupPayment();
      await h.sendQueued('domicilio');
      const noted = String(await h.sendQueued(said.replace('{p}', m.place)));
      expect(noted).toContain('Anoté la referencia');
      expect(h.conv.state).toBe('awaiting_address');
      await h.sendQueued(m.street);
      const address = String(h.conv.sessionData.address);
      expect(address.startsWith(m.street)).toBe(true);
      expect(occurrences(address, m.place)).toBe(1);
      expect(address).not.toMatch(/,\s*en\s/i);
    });

    it('a location pin after the place keeps the place next to the pin', async () => {
      const h = await toPickupPayment();
      await h.sendQueued(`Me lo envias a ${m.place}`);
      await h.sendQueued('', { messageType: 'location', latitude: 4.65, longitude: -74.05 });
      expect(h.conv.sessionData.addressConfirmed).toBe(true);
      expect(occurrences(String(h.conv.sessionData.address), m.place)).toBe(1);
      expect(h.conv.sessionData.pendingDeliveryPlace).toBeUndefined();
    });

    it('contrast: a street that already names the place does not repeat it', async () => {
      const h = await toPickupPayment();
      await h.sendQueued(`Me lo envias a ${m.place}`);
      await h.sendQueued(`${m.street} ${m.place}`);
      expect(occurrences(String(h.conv.sessionData.address), m.place)).toBe(1);
    });

    it('contrast: a bare «domicilio» switch adds nothing to the street', async () => {
      const h = await toPickupPayment();
      await h.sendQueued('domicilio');
      await h.sendQueued(m.street);
      expect(h.conv.sessionData.address).toMatch(new RegExp(`^${m.street.replace(/[#]/g, '\\$&')}\\s*$`));
    });

    it('contrast: going back to pickup drops the place', async () => {
      const h = await toPickupPayment();
      await h.sendQueued(`Me lo envias a ${m.place}`);
      await h.sendQueued('mejor paso a recogerlo');
      expect(h.conv.sessionData.orderType).toBe('pickup');
      expect(h.conv.sessionData.pendingDeliveryPlace).toBeUndefined();
    });
  });
});
