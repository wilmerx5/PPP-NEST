import { harness } from './whatsapp-accuracy.test-support';

type Attribute = { attributeName: string; options: string[] };
type Product = { id: number; code: number; name: string; price: number; categoryName: string; availableNow: boolean; hasAttributes: boolean; attributes: Attribute[] };
type Menu = {
  id: string; dish: Product; side: Product; start: Array<[string, string]>;
  attribute: string; from: string; to: string; asks: string[]; unknown: string; purchase: string;
};

const product = (id: number, name: string, price: number, categoryName: string, attributes: Attribute[] = []): Product =>
  ({ id, code: id, name, price, categoryName, availableNow: true, hasAttributes: attributes.length > 0, attributes });

const menus: Menu[] = [
  { id: 'chicken combo',
    dish: product(910, 'Combo Pollo Broaster', 48000, 'Combos', [{ attributeName: 'Arepas', options: ['Blancas', 'Fritas'] }, { attributeName: 'Bebida', options: ['Pepsi', 'Uva'] }]),
    side: product(911, 'Porcion De Arepas', 3500, 'Adicionales', [{ attributeName: 'Arepas', options: ['Blancas', 'Fritas'] }]),
    start: [['Arepas', 'Blancas'], ['Bebida', 'Pepsi']], attribute: 'Arepas', from: 'Blancas', to: 'Fritas',
    asks: ['Las arepas se pueden fritas ?', 'las arepas pueden ser fritas?', 'y la arepa puede venir frita?'],
    unknown: 'las arepas se pueden asadas?', purchase: 'quiero una porcion de arepas fritas' },
  { id: 'burger',
    dish: product(920, 'Hamburguesa Clasica', 22000, 'Hamburguesas', [{ attributeName: 'Término', options: ['Medio', 'Tres Cuartos', 'Bien Asado'] }, { attributeName: 'Pan', options: ['Brioche', 'Integral'] }]),
    side: product(921, 'Pan Integral', 3000, 'Adicionales'),
    start: [['Término', 'Medio'], ['Pan', 'Brioche']], attribute: 'Pan', from: 'Brioche', to: 'Integral',
    asks: ['el pan puede ser integral?', 'el pan se puede integral?', 'disculpa, el pan podría ser integral?'],
    unknown: 'el pan puede ser de ajo?', purchase: 'agrega un pan integral aparte' },
  { id: 'pasta',
    dish: product(930, 'Pasta Carbonara', 26000, 'Pastas', [{ attributeName: 'Tamaño', options: ['Personal', 'Familiar'] }, { attributeName: 'Salsa', options: ['Blanca', 'Roja'] }]),
    side: product(931, 'Salsa Roja Extra', 2500, 'Adicionales'),
    start: [['Tamaño', 'Personal'], ['Salsa', 'Blanca']], attribute: 'Salsa', from: 'Blanca', to: 'Roja',
    asks: ['la salsa se puede roja?', 'la salsa puede ser roja por favor?', 'la salsa podria ser roja?'],
    unknown: 'la salsa puede ser pesto?', purchase: 'dame una salsa roja extra' },
];

describe.each(menus)('$id: «¿se puede …?» about an option of a cart line', m => {
  describe.each([false, true])('agent %s', agent => {
    const line = (attrs: Array<[string, string]>) => ({ productId: m.dish.id, code: m.dish.code, name: m.dish.name, quantity: 1, unitPrice: m.dish.price,
      attributes: attrs.map(([attributeName, attributeValue]) => ({ attributeName, attributeValue })) });
    const start = async (lines = [line(m.start)]) => {
      const h = harness([m.dish, m.side] as never, agent);
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      h.service.aiService.generateTurn = jest.fn().mockResolvedValue({ reply: '¿Algo más?', actions: {} });
      h.agent.runTurn.mockResolvedValue({ reply: '¿Algo más?', actions: {}, toolCalls: [] });
      await h.sendQueued('para un domicilio');
      h.conv.sessionData.cart = structuredClone(lines);
      return h;
    };
    const attrsOf = (h: ReturnType<typeof harness>, index = 0) =>
      (h.conv.sessionData.cart[index]?.attributes || []).map((attr: { attributeName: string; attributeValue: string }) => `${attr.attributeName}:${attr.attributeValue}`);
    const expected = m.start.map(([name, value]) => `${name}:${name === m.attribute ? m.to : value}`);

    it.each(m.asks)('«%s» changes that option in place', async ask => {
      const h = await start();
      const reply = String(await h.sendQueued(ask));
      expect(h.conv.sessionData.cart).toHaveLength(1);
      expect(attrsOf(h)).toEqual(expected);
      expect(reply).toContain(`${m.attribute}: ${m.to}`);
    });

    it('during checkout the change applies and the pending step is asked again', async () => {
      const h = await start();
      await h.sendQueued('así está bien gracias');
      const state = h.conv.state;
      expect(state).toMatch(/^awaiting_/);
      const reply = String(await h.sendQueued(m.asks[0]));
      expect(attrsOf(h)).toEqual(expected);
      expect(h.conv.state).toBe(state);
      expect(reply).toContain(`${m.attribute}: ${m.to}`);
    });

    it('an option already chosen is confirmed without changes', async () => {
      const h = await start([line(m.start.map(([name, value]) => [name, name === m.attribute ? m.to : value]))]);
      const reply = String(await h.sendQueued(m.asks[0]));
      expect(attrsOf(h)).toEqual(expected);
      expect(reply).toMatch(/ya está/);
    });

    it('an option that is not on the menu is never written into the line', async () => {
      const h = await start();
      await h.sendQueued(m.unknown);
      expect(attrsOf(h)).toEqual(m.start.map(([name, value]) => `${name}:${value}`));
    });

    it('a separate purchase does not edit the dish option', async () => {
      const h = await start();
      await h.sendQueued(m.purchase);
      expect(attrsOf(h)).toEqual(m.start.map(([name, value]) => `${name}:${value}`));
    });

    it('two lines with that option are not both changed silently', async () => {
      const h = await start([line(m.start), { ...line(m.start), quantity: 2 }]);
      await h.sendQueued(m.asks[0]);
      const changed = [0, 1].filter(index => attrsOf(h, index).includes(`${m.attribute}:${m.to}`));
      expect(changed.length).toBeLessThan(2);
    });
  });
});
