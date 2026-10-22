import { harness } from './whatsapp-accuracy.test-support';
import { drinkInclusion, sodaBrandIn } from './whatsapp-drink-inclusion';
import { applyLocalGlossary } from './whatsapp-local-glossary';

type Attribute = { attributeName: string; options: string[] };
type Product = { id: number; code: number; name: string; price: number; categoryName: string; availableNow: boolean; hasAttributes: boolean; attributes: Attribute[]; description?: string };
type Menu = { id: string; dish: Product; combo: Product; drinks: Product[]; order: string; sizedDrink: [string, number]; options: string[] };

const product = (id: number, name: string, price: number, categoryName: string, attributes: Attribute[] = [], description?: string): Product =>
  ({ id, code: id, name, price, categoryName, availableNow: true, hasAttributes: attributes.length > 0, attributes, description });

const menus: Menu[] = [
  { id: 'fried rice',
    dish: product(810, 'Arroz Chino Con Camarones', 30000, 'Arroz Chino'),
    combo: product(811, 'Combo Arroz Chino Con Camarones', 35000, 'Combos', [{ attributeName: 'Bebida', options: ['Coca Cola', 'Sprite', 'Kola'] }]),
    drinks: [product(812, 'Gaseosa 1.5L', 7000, 'Bebidas'), product(813, 'Gaseosa 2.5L', 9000, 'Bebidas')],
    order: 'un arroz chino con camarones', sizedDrink: ['una gaseosa 1.5 litros', 812], options: ['Coca Cola', 'Sprite', 'Kola'] },
  { id: 'burger',
    dish: product(820, 'Hamburguesa Doble', 26000, 'Hamburguesas'),
    combo: product(821, 'Combo Hamburguesa Doble', 32000, 'Combos', [{ attributeName: 'Gaseosa', options: ['Pepsi', 'Uva', 'Manzana'] }]),
    drinks: [product(822, 'Gaseosa 400ml', 4000, 'Bebidas'), product(823, 'Agua 600ml', 3000, 'Bebidas')],
    order: 'una hamburguesa doble', sizedDrink: ['una gaseosa 400 ml', 822], options: ['Pepsi', 'Uva', 'Manzana'] },
  { id: 'grill',
    dish: product(830, 'Pechuga A La Plancha', 24000, 'Asados'),
    combo: product(831, 'Combo Pechuga A La Plancha', 29000, 'Combos', [{ attributeName: 'Bebida', options: ['Limonada', 'Jugo De Mora', 'Coca Cola'] }], 'Incluye bebida'),
    drinks: [product(832, 'Coca Cola 1.5L', 8000, 'Bebidas'), product(833, 'Jugo De Lulo', 6000, 'Bebidas')],
    order: 'una pechuga a la plancha', sizedDrink: ['una coca cola 1.5 litros', 832], options: ['Limonada', 'Jugo De Mora', 'Coca Cola'] },
];

describe('drink helpers', () => {
  it.each([['una coca cola fria', 'coca cola'], ['Pepsi por favor', 'pepsi'], ['un jugo de mora', null], ['gaseosa 1.5', null]])(
    '«%s» names the soda brand %p', (text, brand) => {
      expect(sodaBrandIn(text)).toBe(brand);
    });
  it('drink options prove a drink, not that it is soda', () => {
    expect(drinkInclusion({ attributes: [{ attributeName: 'Bebida', options: ['Coca Cola', 'Sprite'] }] }, 'bebida')).toBe('yes');
    expect(drinkInclusion({ attributes: [{ attributeName: 'Bebida', options: ['Coca Cola', 'Sprite'] }] }, 'gaseosa')).toBe('unknown');
    expect(drinkInclusion({ attributes: [{ attributeName: 'Bebida', options: ['Sin bebida', 'Coca Cola'] }] }, 'bebida')).toBe('unknown');
  });
  it.each([['una gaseosa 1.5 litros', 'una gaseosa 1.5 litros'], ['gaseosa 1.5l', 'gaseosa 1.5l'], ['una gaseosa 1.5', 'una gaseosa 1.5 litros'], ['2 colombiana 1,5', '2 colombiana 1.5 litros']])(
    'the glossary reads «%s» as «%s»', (text, expected) => {
      expect(applyLocalGlossary(text)).toBe(expected);
    });
});

describe.each(menus)('$id: drink question about a cart line', m => {
  describe.each([false, true])('agent %s', agent => {
    const start = async (catalog: Product[] = [m.dish, m.combo, ...m.drinks], order = m.order) => {
      const h = harness(catalog as never, agent);
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      h.service.aiService.generateTurn = jest.fn().mockResolvedValue({ reply: '¿Algo más?', actions: {} });
      h.agent.runTurn.mockResolvedValue({ reply: '¿Algo más?', actions: {}, toolCalls: [] });
      await h.sendQueued('para domicilio');
      await h.sendQueued(order);
      expect(h.cartRows()).toHaveLength(1);
      return h;
    };
    const rows = (h: ReturnType<typeof harness>) => h.cartRows() as Array<{ id: number; qty: number; attrs: string[]; note?: string }>;
    const attrName = m.combo.attributes[0].attributeName;
    const offer = async (h: ReturnType<typeof harness>, ask = 'Ese viene con gaseosa?') => {
      const reply = String(await h.sendQueued(ask));
      expect(reply).toContain(m.combo.name);
      expect(reply).toContain('cambiar ese plato al combo');
      expect(reply).not.toMatch(/ingredientes/i);
      expect(rows(h).map(row => row.id)).toEqual([m.dish.id]);
      return reply;
    };

    it.each(['Ese viene con gaseosa?', 'y eso trae bebida?', 'esto incluye gaseosa?', 'viene con bebida?'])('«%s» offers the combo of the cart line', async ask => {
      const h = await start();
      const reply = await offer(h, ask);
      expect(reply).toContain(m.options.at(-1)!);
    });

    it('«sí» asks the combo drink, then the answer replaces the line', async () => {
      const h = await start();
      await offer(h);
      const asked = String(await h.sendQueued('sí'));
      expect(asked).toContain(attrName);
      expect(rows(h).map(row => row.id)).toEqual([m.dish.id]);
      await h.sendQueued(m.options[1]);
      expect(rows(h)).toEqual([expect.objectContaining({ id: m.combo.id, qty: 1, attrs: [`${attrName}:${m.options[1]}`] })]);
    });

    it('naming a combo drink option replaces the line with that drink', async () => {
      const h = await start();
      await offer(h);
      const reply = String(await h.sendQueued(`${m.options[2].toLowerCase()} por favor`));
      expect(rows(h)).toEqual([expect.objectContaining({ id: m.combo.id, attrs: [`${attrName}:${m.options[2]}`] })]);
      expect(reply).toContain('lo cambié');
    });

    it('«no gracias» keeps the dish and closes the offer', async () => {
      const h = await start();
      await offer(h);
      const reply = String(await h.sendQueued('no gracias'));
      expect(rows(h).map(row => row.id)).toEqual([m.dish.id]);
      expect(reply).toContain('como está');
      await h.sendQueued('1');
      expect(rows(h).some(row => row.id === m.combo.id)).toBe(false);
    });

    it('a sized standalone drink is added apart and the dish stays', async () => {
      const h = await start();
      await offer(h);
      const reply = String(await h.sendQueued(m.sizedDrink[0]));
      expect(rows(h).map(row => row.id)).toEqual([m.dish.id, m.sizedDrink[1]]);
      expect(reply).toContain('sin combo');
    });

    it('a sized drink matching the combo drink size switches to the combo with the named soda', async () => {
      const [, size] = m.sizedDrink[0].match(/(\d+(?:\.\d+)?)\s*(ml|litros)/)!;
      const unit = m.sizedDrink[0].includes('ml') ? 'ml' : 'L';
      const combo = { ...m.combo, description: `Incluye bebida de ${size}${unit}` };
      const soda = m.options.find(option => /coca|pepsi|sprite/i.test(option))!;
      const h = await start([m.dish, combo, ...m.drinks]);
      await offer(h);
      await h.sendQueued(`${m.sizedDrink[0]} ${soda.toLowerCase()}`);
      expect(rows(h)).toEqual([expect.objectContaining({ id: m.combo.id, attrs: [`${attrName}:${soda}`] })]);
    });

    it('a combo already in the cart is not offered again', async () => {
      const h = await start(undefined, `un ${m.combo.name.toLowerCase()} con ${m.options[0].toLowerCase()}`);
      const reply = String(await h.sendQueued('Ese viene con gaseosa?'));
      expect(reply).not.toContain('cambiar ese plato al combo');
      expect(rows(h)).toEqual([expect.objectContaining({ id: m.combo.id })]);
    });

    it('without a combo on the menu the question still is about the dish, not drink ingredients', async () => {
      const h = await start([m.dish, ...m.drinks]);
      const reply = String(await h.sendQueued('Ese viene con gaseosa?'));
      expect(reply).not.toMatch(/ingredientes/i);
      expect(reply).not.toContain('cambiar ese plato al combo');
      expect(rows(h).map(row => row.id)).toEqual([m.dish.id]);
    });
  });
});

describe.each([false, true])('agent %s: a family with combos of other dishes', agent => {
  it('lists the same dish’s combo first, keeps the other combo visible, and the named soda goes into the first', async () => {
    const m = menus[0];
    const other = product(815, 'Combo Arroz Chino Con Pollo', 33000, 'Combos', [{ attributeName: 'Bebida', options: ['Coca Cola', 'Sprite', 'Kola'] }]);
    const plain = product(816, 'Arroz Chino Con Pollo', 27000, 'Arroz Chino');
    const h = harness([m.dish, m.combo, plain, other, ...m.drinks] as never, agent);
    h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
    h.service.aiService.generateTurn = jest.fn().mockResolvedValue({ reply: '¿Algo más?', actions: {} });
    h.agent.runTurn.mockResolvedValue({ reply: '¿Algo más?', actions: {}, toolCalls: [] });
    await h.sendQueued('para domicilio');
    await h.sendQueued(m.order);
    const reply = String(await h.sendQueued('Ese viene con gaseosa?'));
    expect(reply).toContain(m.combo.name);
    expect(reply).toContain(other.name);
    expect(reply.indexOf(m.combo.name)).toBeLessThan(reply.indexOf(other.name));
    await h.sendQueued('sprite');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: m.combo.id, attrs: ['Bebida:Sprite'] })]);
  });
});
