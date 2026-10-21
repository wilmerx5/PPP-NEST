import { harness } from './whatsapp-accuracy.test-support';
import { isCartChargeQuestion, statedOrderTotals } from './whatsapp-session-intents';

type Product = { id: number; code: number; name: string; price: number; categoryName: string; availableNow: boolean; hasAttributes: boolean; attributes: never[] };
type Menu = { id: string; dish: Product; drink: Product; other: Product; order: string };

const product = (id: number, name: string, price: number, categoryName: string): Product =>
  ({ id, code: id, name, price, categoryName, availableNow: true, hasAttributes: false, attributes: [] });
const money = (n: number) => `$${n.toLocaleString('de-DE')}`;
const FEE = 2000;

const menus: Menu[] = [
  { id: 'chicken', dish: product(710, 'Combo Pollo Apanado', 55000, 'Combos'), drink: product(711, 'Limonada Natural', 7000, 'Bebidas'),
    other: product(712, 'Jugo De Mora', 6000, 'Bebidas'), order: 'un combo pollo apanado y una limonada natural' },
  { id: 'pizzas', dish: product(720, 'Pizza Mediana Hawaiana', 38000, 'Pizzas'), drink: product(721, 'Gaseosa Personal', 4000, 'Bebidas'),
    other: product(722, 'Pan De Ajo', 9000, 'Entradas'), order: 'una pizza mediana hawaiana y una gaseosa personal' },
  { id: 'sushi', dish: product(730, 'Roll Acevichado', 24000, 'Rolls'), drink: product(731, 'Jugo De Lulo', 6000, 'Bebidas'),
    other: product(732, 'Sopa Miso', 8000, 'Entradas'), order: 'un roll acevichado y un jugo de lulo' },
];

const WRONG = ['Listo, el total es $99.000 ✅', 'Llevas $10.000 en total', 'Jaja, por cierto el total es $99.000', 'Vamos en 123.000 por ahora'];

describe('total helpers', () => {
  it.each([
    ['Listo, el total es $99.000', [99000]],
    ['Llevas $10.000 en total', [10000]],
    ['Tu pedido es de 45.500 más domicilio', [45500]],
    ['Subtotal $40.000, total $42.000', [42000]],
  ])('«%s» states %p as a total', (reply, amounts) => {
    expect(statedOrderTotals(reply)).toEqual(amounts);
  });
  it.each(['Si quieres, un jugo sale en $6.000', 'La limonada cuesta $7.000', '¿Algo más?', 'Abrimos a las 11:30'])(
    '«%s» states no total', reply => {
      expect(statedOrderTotals(reply)).toEqual([]);
    });
  it.each(['cuanto llevo', 'cuánto vamos?', 'y cuánto llevo hasta ahora?', 'bueno, cuanto va en total porfa'])('«%s» asks the cart total', text => {
    expect(isCartChargeQuestion(text)).toBe(true);
  });
  it.each(['cuanto vale la limonada', 'cuánto llevo esperando?', 'cuanto se demora', 'cuánto vale el domicilio'])('«%s» is not a cart total question', text => {
    expect(isCartChargeQuestion(text)).toBe(false);
  });
});

describe.each(menus)('$id: agent totals', m => {
  const total = m.dish.price + m.drink.price + FEE;
  describe.each([false, true])('agent %s', agent => {
    const start = async (withCart = true) => {
      const h = harness([m.dish, m.drink, m.other] as never, agent);
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      h.service.aiService.generateTurn = jest.fn().mockResolvedValue({ reply: '¿Algo más?', actions: {} });
      h.agent.runTurn.mockResolvedValue({ reply: '¿Algo más?', actions: {}, toolCalls: [] });
      await h.sendQueued('para un domicilio');
      if (withCart) await h.sendQueued(m.order);
      expect(h.cartRows()).toHaveLength(withCart ? 2 : 0);
      return h;
    };
    const say = (h: ReturnType<typeof harness>, reply: string) => {
      h.agent.runTurn.mockResolvedValue({ reply, actions: {}, toolCalls: [] });
      h.service.aiService.generateTurn = jest.fn().mockResolvedValue({ reply, actions: {} });
    };

    it.each(WRONG)('chit-chat never relays the wrong total «%s»', async wrong => {
      const h = await start();
      const before = JSON.stringify(h.cartRows());
      say(h, wrong);
      const reply = String(await h.sendQueued('jajaja'));
      expect(JSON.stringify(h.cartRows())).toBe(before);
      expect(statedOrderTotals(reply).every(n => n === total || n === total - FEE)).toBe(true);
      expect(reply).not.toContain(wrong);
    });

    it.each(WRONG)('an unrelated question never relays the wrong total «%s»', async wrong => {
      const h = await start();
      say(h, wrong);
      const reply = String(await h.sendQueued('ustedes abren mañana?'));
      expect(reply).not.toContain(wrong);
      expect(h.cartRows()).toHaveLength(2);
    });

    it('a wrong total is never relayed with an empty cart', async () => {
      const h = await start(false);
      say(h, 'Llevas $10.000 en total');
      const reply = String(await h.sendQueued('jajaja'));
      expect(reply).not.toContain('$10.000');
      expect(h.cartRows()).toHaveLength(0);
    });

    it.each(['cuanto llevo', 'cuánto vamos?', 'y cuánto llevo hasta ahora?'])('«%s» shows the real total without touching the cart', async text => {
      const h = await start();
      const before = JSON.stringify(h.cartRows());
      say(h, 'Llevas $10.000 en total');
      const reply = String(await h.sendQueued(text));
      expect(JSON.stringify(h.cartRows())).toBe(before);
      expect(reply).toContain(`Total ${money(total - FEE)}`);
      expect(reply).not.toContain('$10.000');
      expect(reply).not.toMatch(/de cu[aá]l producto/i);
    });

    it('a product price question still answers the price, not the cart total', async () => {
      const h = await start();
      const reply = String(await h.sendQueued(`cuanto vale ${m.other.name.toLowerCase()}`));
      expect(reply).toContain(money(m.other.price));
      expect(h.cartRows()).toHaveLength(2);
    });

    if (agent) {
      it('a correct total from the agent is kept', async () => {
        const h = await start();
        say(h, `Jaja, por cierto vas en ${money(total)} con domicilio`);
        const reply = String(await h.sendQueued('jajaja'));
        expect(reply).toContain(`vas en ${money(total)}`);
      });

      it('a product price mention is not treated as a total', async () => {
        const h = await start();
        say(h, `Jaja. Si quieres, un *${m.other.name}* sale en ${money(m.other.price)}`);
        const reply = String(await h.sendQueued('jajaja'));
        expect(reply).toContain(`sale en ${money(m.other.price)}`);
      });
    }
  });
});
