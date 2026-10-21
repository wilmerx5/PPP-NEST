import { harness } from './whatsapp-accuracy.test-support';
import { looksLikeAddressOnlyMessage } from './whatsapp-intent';

type Menu = {
  id: string; order: string; optionAnswer: string; complex: string; street: string;
  names: string[]; products: Record<string, unknown>[];
};

const plain = (id: number, name: string, price: number, categoryName: string) =>
  ({ id, code: id, name, price, categoryName, availableNow: true, hasAttributes: false, attributes: [] });

const menus: Menu[] = [
  { id: 'chicken', order: 'un medio pollo asado', optionAnswer: 'Combo Familiar',
    complex: 'Agrupación bosques de Castilla', street: 'calle 45 # 12-10',
    names: ['Mariana Rojas Torres', 'Julian Plaza Rios'], products: [
      plain(960, 'Medio Pollo Asado', 25000, 'Pollo'),
      plain(962, 'Combo Personal', 30000, 'Combos'),
      { id: 961, code: 961, name: 'Combo Familiar', price: 53000, categoryName: 'Combos', availableNow: true, hasAttributes: true,
        attributes: [{ attributeName: 'Arepas', options: ['Blancas', 'Fritas'] }, { attributeName: 'Bebida', options: ['Colombiana', 'Manzana', 'Uva', 'Pepsi', 'Sprite', 'Ginger'] }] },
    ] },
  { id: 'pastas', order: 'una lasagna mixta', optionAnswer: 'Pasta Carbonara',
    complex: 'Conjunto Torres del Parque', street: 'carrera 7 # 20-30 apto 301',
    names: ['Pedro San Martin', 'Camila Santa Maria'], products: [
      plain(970, 'Lasagna Mixta', 26000, 'Pastas'),
      plain(972, 'Pasta Bolognesa', 22000, 'Pastas'),
      { id: 971, code: 971, name: 'Pasta Carbonara', price: 24000, categoryName: 'Pastas', availableNow: true, hasAttributes: true,
        attributes: [{ attributeName: 'Tamaño', options: ['Personal', 'Familiar'] }, { attributeName: 'Salsa', options: ['Blanca', 'Roja', 'Pesto', 'Alfredo', 'Napolitana'] }] },
    ] },
  { id: 'seafood', order: 'un ceviche clasico', optionAnswer: 'Cazuela De Mariscos',
    complex: 'Edificio Mirador del Lago', street: 'diagonal 32 # 8-15 torre 2',
    names: ['Andres Iglesias Mora', 'Laura Toledo Ruiz'], products: [
      plain(980, 'Ceviche Clasico', 30000, 'Mariscos'),
      plain(982, 'Cazuela De Pescado', 38000, 'Mariscos'),
      { id: 981, code: 981, name: 'Cazuela De Mariscos', price: 42000, categoryName: 'Mariscos', availableNow: true, hasAttributes: true,
        attributes: [{ attributeName: 'Picante', options: ['Suave', 'Medio', 'Fuerte'] }, { attributeName: 'Acompañante', options: ['Arroz', 'Patacon', 'Yuca', 'Ensalada', 'Papas'] }] },
    ] },
];

const PIN = { messageType: 'location', latitude: 4.6368, longitude: -74.1486 };

describe.each(menus)('$id: names, pin references and fee questions during checkout', m => {
  describe.each([false, true])('agent %s', agent => {
    const start = () => {
      const h = harness(m.products as never, agent);
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      h.service.aiService.generateTurn = jest.fn().mockResolvedValue({ reply: '¿Cuál prefieres?', actions: {} });
      // Mirrors the agent's own shortcut: a message that reads as a place becomes set_address.
      h.agent.runTurn.mockImplementation(async (input: { userMessage: string }) => looksLikeAddressOnlyMessage(input.userMessage.trim())
        ? { reply: 'Listo, anoté esa dirección.', actions: { setAddress: input.userMessage.trim(), setOrderType: 'delivery' }, toolCalls: [] }
        : { reply: '¿Cuál prefieres?', actions: {}, toolCalls: [] });
      (h.conv as { customerName: string | null }).customerName = null;
      Object.assign(h.cfg, { deliveryFeeMode: 'distance', deliveryFeeTiers: [], restaurantLat: 4.63, restaurantLng: -74.15 });
      const quote = jest.fn(async (q: { customerAddress: string; customerCoords: unknown }) => q.customerCoords
        ? { ok: true, fee: 2000, distanceKm: 0.7, source: 'google_directions', customer: q.customerCoords }
        : { ok: true, fee: 5000, distanceKm: 3.0, source: 'google_directions', customer: { lat: 4.66, lng: -74.12 } });
      (h.service as unknown as { deliveryRouting: unknown }).deliveryRouting = { quoteDeliveryFee: quote };
      return { h, quote };
    };
    const toNameStep = async (h: ReturnType<typeof harness>) => {
      await h.sendQueued('para un domicilio');
      await h.sendQueued(m.order);
      await h.sendQueued('así está bien gracias');
      expect(h.conv.state).toBe('awaiting_name');
    };

    it.each(m.names)('the name «%s» at the name step stays a name after a pin and a reference', async name => {
      const { h } = start();
      await toNameStep(h);
      await h.sendQueued('', PIN);
      await h.sendQueued(m.complex);
      const address = h.conv.sessionData.address;
      await h.sendQueued(name);
      expect(h.conv.customerName).toBe(name);
      expect(h.conv.sessionData.address).toBe(address);
      expect(h.conv.sessionData.deliveryFeeCalculated).toBe(2000);
      expect(h.conv.state).toBe('awaiting_payment');
    });

    it.each(m.names)('«%s» sent while a dish option is open is not saved as the address', async name => {
      const { h } = start();
      await h.sendQueued('para un domicilio');
      const dish = m.products.find(p => p.name === m.optionAnswer) as { id: number; code: number; name: string; price: number; attributes: Array<{ attributeName: string; options: string[] }> };
      h.conv.sessionData = { ...h.conv.sessionData, pendingAttribute: { productId: dish.id, name: dish.name, code: dish.code, price: dish.price,
        quantity: 1, attributes: dish.attributes, selected: [{ attributeName: dish.attributes[0].attributeName, attributeValue: dish.attributes[0].options[0] }] } };
      h.conv.state = 'awaiting_attribute';
      expect(h.conv.sessionData.pendingAttribute).toBeTruthy();
      const reply = String(await h.sendQueued(name));
      expect(reply).not.toContain(`Domicilio anotado: _${name}_`);
      expect(h.conv.sessionData.address || '').not.toContain(name);
    });

    it('a complex name after the pin is kept as a reference with the pin and its fee', async () => {
      const { h, quote } = start();
      await toNameStep(h);
      await h.sendQueued('', PIN);
      const pinAddress = String(h.conv.sessionData.address);
      const calls = quote.mock.calls.length;
      const reply = String(await h.sendQueued(m.complex));
      expect(reply).toContain(`Anoté la referencia _${m.complex}_ junto a tu ubicación`);
      expect(h.conv.sessionData.address).toBe(`${pinAddress} — ${m.complex}`);
      expect(h.conv.sessionData.deliveryLat).toBe(PIN.latitude);
      expect(h.conv.sessionData.deliveryFeeCalculated).toBe(2000);
      expect(quote.mock.calls.length).toBe(calls);
      expect(h.conv.state).toBe('awaiting_name');
    });

    it('contrast: a street with a number after the pin replaces it and is quoted again', async () => {
      const { h } = start();
      await toNameStep(h);
      await h.sendQueued('', PIN);
      await h.sendQueued(m.street);
      expect(String(h.conv.sessionData.address)).toMatch(new RegExp(`^${m.street.replace(/#/g, '\\#')}`));
      expect(h.conv.sessionData.deliveryFeeCalculated).toBe(5000);
    });

    it('contrast: the complex name without a pin is still taken as the address', async () => {
      const { h } = start();
      await toNameStep(h);
      await h.sendQueued(m.complex);
      expect(h.conv.sessionData.address).toBe(m.complex);
      expect(h.conv.sessionData.orderType).toBe('delivery');
    });

    it.each(['Porque le sube 5 el domicilio si primero dice 2 mil', 'No entiendo porque sube todo eso', '¿por qué cobran tanto de domicilio?'])(
      '«%s» at the name step explains the fee and keeps asking the name', async said => {
        const { h } = start();
        await toNameStep(h);
        await h.sendQueued('', PIN);
        await h.sendQueued(m.complex);
        const reply = String(await h.sendQueued(said));
        expect(reply).toContain('El domicilio se calcula por la distancia');
        expect(reply).toContain(m.complex);
        expect(reply).toContain('$2.000');
        expect(reply).toContain('ruta ~0.7 km');
        expect(h.conv.customerName).toBeNull();
        expect(h.conv.state).toBe('awaiting_name');
        await h.sendQueued(m.names[0]);
        expect(h.conv.customerName).toBe(m.names[0]);
      });

    it('a fee question at the payment step explains it and payment still works', async () => {
      const { h } = start();
      await toNameStep(h);
      await h.sendQueued(m.street);
      await h.sendQueued(m.names[0]);
      expect(h.conv.state).toBe('awaiting_payment');
      const reply = String(await h.sendQueued('no entiendo por qué subió el domicilio'));
      expect(reply).toContain('$5.000');
      expect(reply).toMatch(/método de pago/);
      expect(h.conv.state).toBe('awaiting_payment');
      await h.sendQueued('contraentrega');
      expect(h.conv.sessionData.paymentMethod).toBeTruthy();
    });

    it('contrast: a product price question is not a fee question', async () => {
      const { h } = start();
      await toNameStep(h);
      await h.sendQueued(m.street);
      await h.sendQueued(m.names[0]);
      const reply = String(await h.sendQueued('¿cuánto es el total?'));
      expect(reply).not.toContain('El domicilio se calcula');
    });
  });
});

describe('a full name with a place word is not a place; a place stays a place', () => {
  const h = harness([] as never, false);
  const plausible = (text: string) => (h.service as unknown as { isPlausibleDeliveryAddress(t: string): boolean }).isPlausibleDeliveryAddress(text);

  it.each(['Mariana Rojas Torres', 'Julian Plaza Rios', 'Pedro San Martin', 'Camila Santa Maria', 'Andres Iglesias Mora', 'Laura Toledo Ruiz'])(
    '«%s» is neither an address-only message nor a plausible address', name => {
      expect(looksLikeAddressOnlyMessage(name)).toBe(false);
      expect(plausible(name)).toBe(false);
    });

  it.each(['Torres del Parque', 'Conjunto Torres de Castilla', 'San Martin', 'Plaza de las Americas', 'Castilla reservado', 'Hospital de Kennedy', 'Santa Isabel'])(
    'contrast: «%s» is still a plausible place', place => {
      expect(plausible(place)).toBe(true);
    });
});
