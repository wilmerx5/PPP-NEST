import { harness } from './whatsapp-accuracy.test-support';
import { DEFAULT_PAYMENT_METHODS } from './whatsapp-payment-methods';
import { WhatsappAgentService } from './whatsapp-agent.service';
import { WhatsappCatalogService } from './whatsapp-catalog.service';

type Family = { id: string; one: string; combo: string; comboCode: number; drinks: string[]; main: string; request: string };

const families: Family[] = [
  { id: 'rotisserie', one: 'Pollo Entero Asado', combo: 'Combo De Arroz Ranchero', comboCode: 94,
    drinks: ['Cola', 'Naranja', 'Limón'], main: 'Arepa Rellena', request: 'uenas tardes me das este combo de arroz ranchero' },
  { id: 'burger', one: 'Hamburguesa Sencilla', combo: 'Combo Doble Queso', comboCode: 57,
    drinks: ['Té Frío', 'Kola', 'Agua'], main: 'Papas Rústicas', request: 'buenas noches me regalas este combo doble queso porfa' },
  { id: 'sushi', one: 'Rollo Clásico', combo: 'Combo Tempura Mixto', comboCode: 312,
    drinks: ['Té Verde', 'Ramune', 'Soda'], main: 'Gyozas De Cerdo', request: 'hola me envías este combo tempura mixto' },
];

const menuOf = (f: Family) => [
  { id: 1, code: 1, name: f.one, price: 30000, availableNow: true, hasAttributes: false, attributes: [] },
  { id: 2, code: f.comboCode, name: f.combo, price: 42000, availableNow: true, hasAttributes: true,
    attributes: [{ attributeName: 'Bebida', options: [...f.drinks] }] },
  { id: 3, code: 203, name: f.main, price: 9000, availableNow: true, hasAttributes: false, attributes: [] },
];

const contact = ['Ana Torres', 'Conjunto Los Robles', 'Diagonal 3 #83-02', 'Torre 3 apto 102', '3001234567'];

function rig(f: Family, agent: boolean, vision: string) {
  const h = harness(menuOf(f) as never, agent) as ReturnType<typeof harness> & { service: any };
  h.cfg.paymentMethods = DEFAULT_PAYMENT_METHODS.map(method => ({ ...method, enabled: method.flow !== 'mercadopago' }));
  h.service.ordersService.findTodayOrdersByPhone = async () => [];
  h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 1, dailyOrderNumber: 1 });
  h.service.metaService.downloadMedia = jest.fn().mockResolvedValue({ buffer: Buffer.from('card'), mimeType: 'image/jpeg' });
  h.service.catalogService.getMenuDetailedText = jest.fn().mockResolvedValue(`${f.combo} #${f.comboCode}`);
  h.service.conversationService.updateMessageBody = jest.fn().mockResolvedValue(undefined);
  h.service.aiService.analyzeOrderImage = jest.fn().mockResolvedValue({ kind: 'order', textForBot: vision });
  (h.conv as any).customerName = null;
  return h;
}

const names = (h: ReturnType<typeof harness>) => h.conv.sessionData.cart.map(line => line.name);

describe.each(families)('$id: product card photo with the order in its caption', f => {
  const caption = [f.request, ...contact].join(' \n');

  it.each([`${f.combo} (código ${f.comboCode})`, `código ${f.comboCode} ${f.combo}`, f.combo])(
    'agent off, vision «%s»: adds the combo and keeps name, address and phone', async vision => {
      const h = rig(f, false, vision);
      await h.sendQueued(caption, { messageType: 'image', mediaId: 'card' } as never);
      expect(names(h)).toEqual([f.combo]);
      expect((h.conv as any).customerName).toBe('Ana Torres');
      expect(h.conv.sessionData.address).toMatch(/Diagonal 3 #83-02/);
      expect(h.conv.sessionData.address).toMatch(/Los Robles/);
      expect(h.conv.sessionData.address).toMatch(/apto 102/i);
      expect(h.conv.sessionData.contactPhone).toMatch(/3001234567/);
      await h.sendQueued('1');
      expect(names(h)).toEqual([f.combo]);
      expect(names(h)).not.toContain(f.one);
    });

  it('agent off: the order text sent to the router carries the caption contact lines', async () => {
    const h = rig(f, false, `${f.combo} (código ${f.comboCode})`);
    await h.sendQueued(caption, { messageType: 'image', mediaId: 'card' } as never);
    const body = String(h.service.conversationService.updateMessageBody.mock.calls[0]?.[1] || '');
    expect(body).toContain('Diagonal 3 #83-02');
    expect(body).not.toMatch(new RegExp(f.request.split(' ')[0], 'i'));
  });

  it('contrast: a vague caption adds nothing beyond the recognised product', async () => {
    const h = rig(f, false, `${f.combo} (código ${f.comboCode})`);
    await h.sendQueued('este por favor', { messageType: 'image', mediaId: 'card' } as never);
    expect(names(h)).toEqual([f.combo]);
    expect(h.conv.sessionData.address).toBeFalsy();
    expect(String(h.service.conversationService.updateMessageBody.mock.calls[0]?.[1] || '')).not.toMatch(/\n/);
  });

  describe.each(['text', 'photo'])('agent on, %s: purchase rejected by validation', source => {
    it('lists the named product and a bare «1» picks it, not catalog code #1', async () => {
      const h = rig(f, true, `${f.combo} (código ${f.comboCode})`);
      h.agent.runTurn.mockResolvedValue({ reply: 'Necesito aclarar.', actions: {}, toolCalls: ['add_item'],
        purchaseAttempts: [{ productId: 2, accepted: false, reason: 'dish_not_on_menu' }] });
      const reply = source === 'text'
        ? await h.sendQueued(`me das un ${f.combo.toLowerCase()} sin papas pero con yuca`)
        : await h.sendQueued(caption, { messageType: 'image', mediaId: 'card' } as never);
      expect(names(h)).toEqual([]);
      expect(reply).toMatch(new RegExp(`1\\. \\*${f.combo}\\*`));
      expect(h.conv.sessionData.pendingMatch?.candidates.map(c => c.id)).toEqual([2]);
      h.agent.runTurn.mockResolvedValue({ reply: '¿Cuál prefieres?', actions: {}, toolCalls: [] });
      await h.sendQueued('1');
      expect(names(h)).not.toContain(f.one);
      expect(names(h).length ? names(h) : [h.conv.sessionData.pendingAttribute?.name]).toEqual([f.combo]);
    });
  });

  it('contrast: a rejected purchase during checkout keeps the session unchanged', async () => {
    const h = rig(f, true, f.combo);
    h.conv.state = 'awaiting_payment';
    Object.assign(h.conv.sessionData, { cart: [{ productId: 3, code: 203, name: f.main, unitPrice: 9000, quantity: 1, attributes: [] }],
      orderType: 'delivery', fulfillmentChosen: true, address: 'Calle 1 # 2-3', addressConfirmed: true, phoneConfirmed: true, contactPhone: h.conv.phoneE164 });
    const before = structuredClone(h.conv.sessionData);
    h.agent.runTurn.mockResolvedValue({ reply: 'Necesito aclarar.', actions: {}, toolCalls: ['add_item'],
      purchaseAttempts: [{ productId: 2, accepted: false, reason: 'dish_not_on_menu' }] });
    await h.sendQueued(`agrégame un ${f.combo.toLowerCase()} sin papas pero con yuca`);
    expect(h.conv.sessionData.pendingMatch).toBeFalsy();
    expect(h.conv.sessionData.cart).toEqual(before.cart);
  });
});

describe.each(families)('$id: agent purchase validation and catalog code markers', f => {
  const agent = new WhatsappAgentService({} as never, new WhatsappCatalogService({} as never));
  const menu = menuOf(f);
  const add = (userMessage: string) => JSON.parse((agent as any).executeTool('add_item', { productId: 2, quantity: 1 }, {
    products: menu, byId: new Map(menu.map(p => [p.id, p])), actions: {}, userMessage, setNeedsAttr: () => undefined,
  }));

  it.each([
    `${f.combo} (código ${f.comboCode})`, `código ${f.comboCode} ${f.combo}`, `${f.combo} #${f.comboCode}`,
    `${f.combo} (cod. ${f.comboCode})`, `quiero un ${f.combo.toLowerCase()} código ${f.comboCode}`,
  ])('accepts «%s»', text => {
    expect(add(text).ok).toBe(true);
  });

  it('contrast: another product code next to the name is still not this product', () => {
    expect(add(`${f.combo} (código 9${f.comboCode})`).ok).toBe(false);
  });

  it('contrast: an unknown ingredient is still rejected', () => {
    expect(add(`${f.combo} con langosta`).ok).toBe(false);
  });
});
