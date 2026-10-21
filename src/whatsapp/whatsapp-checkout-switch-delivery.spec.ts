import { harness } from './whatsapp-accuracy.test-support';

type Menu = { id: string; order: string; products: Record<string, unknown>[] };

const menus: Menu[] = [
  { id: 'arepas', order: 'una arepa rellena', products: [
    { id: 700, code: 10, name: 'Arepa Rellena', price: 12000, categoryName: 'Arepas', availableNow: true, hasAttributes: false, attributes: [] },
    { id: 701, code: 11, name: 'Jugo De Lulo', price: 5000, categoryName: 'Bebidas', availableNow: true, hasAttributes: false, attributes: [] },
  ] },
  { id: 'pastas', order: 'una lasagna mixta', products: [
    { id: 710, code: 20, name: 'Lasagna Mixta', price: 26000, categoryName: 'Pastas', availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Tamaño', options: ['Personal', 'Familiar'] }] },
    { id: 711, code: 21, name: 'Pan De Ajo', price: 6000, categoryName: 'Entradas', availableNow: true, hasAttributes: false, attributes: [] },
  ] },
  { id: 'seafood', order: 'dos ceviches clasicos', products: [
    { id: 720, code: 30, name: 'Ceviche Clasico', price: 30000, categoryName: 'Mariscos', availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Picante', options: ['Suave', 'Medio', 'Fuerte'] }] },
    { id: 721, code: 31, name: 'Patacones', price: 8000, categoryName: 'Acompañantes', availableNow: true, hasAttributes: false, attributes: [] },
    { id: 722, code: 32, name: 'Limonada De Coco', price: 9000, categoryName: 'Bebidas', availableNow: true, hasAttributes: false, attributes: [] },
  ] },
];

describe.each(menus)('$id: switching a pickup order to delivery during checkout', m => {
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

    it.each(['domicilio', 'es a domicilio', 'mejor a domicilio por favor', 'no, lo quiero a domicilio', 'envíamelo', 'mándamelo', 'me lo llevas'])(
      '«%s» switches to delivery, asks the address and then quotes it', async said => {
        const h = await toPickupPayment();
        const cart = cartOf(h);
        const reply = String(await h.sendQueued(said));
        expect(reply).toContain('cambiamos a *domicilio*');
        expect(h.conv.state).toBe('awaiting_address');
        expect(h.conv.sessionData.orderType).toBe('delivery');
        expect(h.conv.sessionData.address).toBeFalsy();
        await h.sendQueued('calle 45 # 12-10');
        expect(h.conv.sessionData.address).toMatch(/^calle 45 # 12-10/);
        expect(h.conv.sessionData.orderType).toBe('delivery');
        expect(h.conv.state).not.toBe('awaiting_address');
        expect(cartOf(h)).toBe(cart);
      });

    it('«me lo envías a <place>» without a street switches and asks for the full address', async () => {
      const h = await toPickupPayment();
      const reply = String(await h.sendQueued('Me lo envias a Villa Clara'));
      expect(reply).toContain('*Villa Clara*');
      expect(reply).toMatch(/dirección completa/);
      expect(h.conv.state).toBe('awaiting_address');
      expect(h.conv.sessionData.orderType).toBe('delivery');
    });

    it('contrast: a destination that can be quoted keeps the existing direct path', async () => {
      const h = await toPickupPayment();
      const reply = String(await h.sendQueued('me lo traes a la calle 80 # 15-20'));
      expect(reply).not.toContain('cambiamos a *domicilio*');
      expect(h.conv.sessionData.orderType).toBe('delivery');
      expect(h.conv.sessionData.address).toMatch(/^calle 80 # 15-20/);
    });

    it('contrast: «domicilio» on an order already for delivery keeps its address', async () => {
      const h = await toPickupPayment();
      await h.sendQueued('calle 10 # 20-30');
      expect(h.conv.sessionData.orderType).toBe('delivery');
      await h.sendQueued('domicilio');
      expect(h.conv.sessionData.address).toMatch(/^calle 10 # 20-30/);
      expect(h.conv.state).not.toBe('awaiting_address');
    });

    it('contrast: a question about delivery does not switch the order', async () => {
      const h = await toPickupPayment();
      await h.sendQueued('¿hacen domicilio?');
      expect(h.conv.sessionData.orderType).toBe('pickup');
      expect(h.conv.state).not.toBe('awaiting_address');
    });

    it('contrast: a payment answer still picks the payment method', async () => {
      const h = await toPickupPayment();
      await h.sendQueued('contraentrega');
      expect(h.conv.sessionData.orderType).toBe('pickup');
      expect(h.conv.state).not.toBe('awaiting_payment');
    });
  });
});
