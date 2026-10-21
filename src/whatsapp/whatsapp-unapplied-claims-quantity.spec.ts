import { harness } from './whatsapp-accuracy.test-support';
import { correctionMatchesLine, parseCartQuantityCorrection } from './whatsapp-quantity-correction';
import { replyClaimsCartChange } from './whatsapp-session-intents';

type Product = { id: number; code: number; name: string; price: number; categoryName: string; availableNow: boolean; hasAttributes: boolean; attributes: never[] };
type Menu = { id: string; dish: Product; drink: Product; other: Product; order: string; dishPlural: string; drinkPlural: string; otherPlural: string };

const product = (id: number, name: string, price: number, categoryName: string): Product =>
  ({ id, code: id, name, price, categoryName, availableNow: true, hasAttributes: false, attributes: [] });

const menus: Menu[] = [
  { id: 'chicken', dish: product(610, 'Combo Pollo Apanado', 55000, 'Combos'), drink: product(611, 'Limonada Natural', 7000, 'Bebidas'),
    other: product(612, 'Jugo De Mora', 6000, 'Bebidas'), order: 'un combo pollo apanado y una limonada natural',
    dishPlural: 'combos', drinkPlural: 'limonadas naturales', otherPlural: 'jugos de mora' },
  { id: 'pizzas', dish: product(620, 'Pizza Mediana Hawaiana', 38000, 'Pizzas'), drink: product(621, 'Gaseosa Personal', 4000, 'Bebidas'),
    other: product(622, 'Pan De Ajo', 9000, 'Entradas'), order: 'una pizza mediana hawaiana y una gaseosa personal',
    dishPlural: 'pizzas hawaianas', drinkPlural: 'gaseosas personales', otherPlural: 'panes de ajo' },
  { id: 'sushi', dish: product(630, 'Roll Acevichado', 24000, 'Rolls'), drink: product(631, 'Jugo De Lulo', 6000, 'Bebidas'),
    other: product(632, 'Sopa Miso', 8000, 'Entradas'), order: 'un roll acevichado y un jugo de lulo',
    dishPlural: 'rolls acevichados', drinkPlural: 'jugos de lulo', otherPlural: 'sopas miso' },
];

const CLAIMS = ['Listo, cambié la cantidad a 3 ✅', 'Listo, quité la bebida ✅', 'Listo, actualicé tu pedido ✅',
  'Listo, eliminé el plato ✅', 'Listo, ya lo dejé en 2 ✅', 'Listo, he agregado otra unidad ✅'];

describe('claim and quantity helpers', () => {
  it.each([...CLAIMS, 'Listo, añadí una bebida', 'Te lo dejé sin cebolla', 'Dejé en 2 el combo'])('«%s» reports a cart change', reply => {
    expect(replyClaimsCartChange(reply)).toBe(true);
  });
  it.each(['¿Te lo agrego?', 'Te dejo el menú arriba', '¿Quieres cambiar algo?', 'El pedido sigue igual.', 'Abrimos mañana a las 11.'])(
    '«%s» does not report a cart change', reply => {
      expect(replyClaimsCartChange(reply)).toBe(false);
    });
  it.each([
    ['déjalo en 2 combos', { quantity: 2, query: 'combos' }],
    ['ponlos en 3 jugos de mora', { quantity: 3, query: 'jugos de mora' }],
    ['cámbiala a dos pizzas', { quantity: 2, query: 'pizzas' }],
  ])('«%s» is an absolute quantity correction', (text, expected) => {
    expect(parseCartQuantityCorrection(text)).toEqual(expected);
  });
  it.each(['mejor 2 combos', 'déjame 2 combos', '¿lo dejas en 2 combos?'])('«%s» is not parsed without the cart', text => {
    expect(parseCartQuantityCorrection(text)).toBeNull();
  });
  it.each([
    ['limonadas naturales', 'Limonada Natural'], ['panes de ajo', 'Pan De Ajo'], ['gaseosas personales', 'Gaseosa Personal'], ['postres', 'Postre'],
  ])('«%s» matches the line «%s»', (query, name) => {
    expect(correctionMatchesLine({ productId: 1, name, quantity: 1, unitPrice: 1000, attributes: [] } as never, query)).toBe(true);
  });
});

describe.each(menus)('$id: unapplied claims and quantity corrections', m => {
  describe.each([false, true])('agent %s', agent => {
    const start = async (lines: 'two' | 'one' = 'two') => {
      const h = harness([m.dish, m.drink, m.other] as never, agent);
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      h.service.aiService.generateTurn = jest.fn().mockResolvedValue({ reply: '¿Algo más?', actions: {} });
      h.agent.runTurn.mockResolvedValue({ reply: '¿Algo más?', actions: {}, toolCalls: [] });
      await h.sendQueued('para un domicilio');
      await h.sendQueued(lines === 'two' ? m.order : m.order.replace(/\s+y\s+.*$/, ''));
      expect(h.cartRows()).toHaveLength(lines === 'two' ? 2 : 1);
      return h;
    };
    const qty = (h: ReturnType<typeof harness>, id: number) => (h.cartRows() as Array<{ id: number; qty: number }>).find(row => row.id === id)?.qty;
    const claim = (h: ReturnType<typeof harness>, reply: string, actions: Record<string, unknown> = {}) => {
      h.agent.runTurn.mockResolvedValue({ reply, actions, toolCalls: [] });
      h.service.aiService.generateTurn = jest.fn().mockResolvedValue({ reply, actions });
    };

    it.each(CLAIMS)('chit-chat never relays «%s» when nothing was applied', async text => {
      const h = await start();
      const before = JSON.stringify(h.cartRows());
      claim(h, text);
      const reply = String(await h.sendQueued('jajaja'));
      expect(JSON.stringify(h.cartRows())).toBe(before);
      expect(replyClaimsCartChange(reply)).toBe(false);
    });

    it.each(CLAIMS)('an unrelated question never relays «%s»', async text => {
      const h = await start();
      const before = JSON.stringify(h.cartRows());
      claim(h, text);
      const reply = String(await h.sendQueued('ustedes abren mañana?'));
      expect(JSON.stringify(h.cartRows())).toBe(before);
      expect(replyClaimsCartChange(reply)).toBe(false);
    });

    it('a removal backed by the action is still confirmed', async () => {
      const h = await start();
      claim(h, `Listo, quité *${m.drink.name}* ✅`, { removeProductIds: [m.drink.id] });
      const reply = String(await h.sendQueued(`quita la ${m.drink.name.toLowerCase()}`));
      expect(qty(h, m.drink.id)).toBeUndefined();
      expect(qty(h, m.dish.id)).toBe(1);
      expect(reply).toMatch(/quit/i);
    });

    it.each([
      (x: Menu) => `déjalo en 2 ${x.dishPlural}`,
      (x: Menu) => `ponlo en 2 ${x.dishPlural}`,
      (x: Menu) => `cámbialo a 2 ${x.dishPlural}`,
      (x: Menu) => `mejor 2 ${x.dishPlural}`,
    ])('a quantity phrase sets the dish to 2 instead of adding (%#)', async build => {
      const h = await start();
      const reply = String(await h.sendQueued(build(m)));
      expect(qty(h, m.dish.id)).toBe(2);
      expect(qty(h, m.drink.id)).toBe(1);
      expect(reply).toContain('corregí la cantidad');
    });

    it('«mejor N» with a plural drink name sets that line', async () => {
      const h = await start();
      await h.sendQueued(`mejor 3 ${m.drinkPlural}`);
      expect(qty(h, m.drink.id)).toBe(3);
      expect(qty(h, m.dish.id)).toBe(1);
    });

    it('«déjalo en 3» with a single line sets it', async () => {
      const h = await start('one');
      await h.sendQueued('déjalo en 3');
      expect(qty(h, m.dish.id)).toBe(3);
    });

    it('«déjalo en 3» with two lines asks which line and keeps the cart', async () => {
      const h = await start();
      const reply = String(await h.sendQueued('déjalo en 3'));
      expect(qty(h, m.dish.id)).toBe(1);
      expect(qty(h, m.drink.id)).toBe(1);
      expect(reply).toContain('¿De cuál plato');
    });

    it('«mejor N» of a product not in the cart is not a quantity correction', async () => {
      const h = await start();
      const reply = String(await h.sendQueued(`mejor 2 ${m.otherPlural}`));
      expect(reply).not.toContain('corregí la cantidad');
      expect(qty(h, m.dish.id)).toBe(1);
      expect(qty(h, m.drink.id)).toBe(1);
    });

    it('«mejor N … y …» is not read as a single-line correction', async () => {
      const h = await start();
      const reply = String(await h.sendQueued(`mejor 2 ${m.dishPlural} y una ${m.other.name.toLowerCase()}`));
      expect(reply).not.toContain('corregí la cantidad');
    });
  });
});
