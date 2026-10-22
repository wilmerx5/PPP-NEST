import { harness } from './whatsapp-accuracy.test-support';

type Menu = { id: string; family: string; word: string; plural: string; members: [string, string, string]; option: string; values: [string, string, string]; drink: string };

const menus: Menu[] = [
  { id: 'chicken-combos', family: 'combo pollo', word: 'combo', plural: 'combos', members: ['Combo Pollo Asado', 'Combo Pollo Crispy', 'Combo Pollo Picante'], option: 'Bebida', values: ['Limonada', 'Gaseosa', 'Te Frio'], drink: 'Agua Mineral' },
  { id: 'burger-menus', family: 'menu hamburguesa', word: 'hamburguesa', plural: 'hamburguesas', members: ['Menu Hamburguesa Res', 'Menu Hamburguesa Pollo', 'Menu Hamburguesa Doble'], option: 'Bebida', values: ['Soda', 'Agua', 'Cafe'], drink: 'Malteada Vainilla' },
  { id: 'pasta-plates', family: 'plato pasta', word: 'pasta', plural: 'pastas', members: ['Plato Pasta Bolonesa', 'Plato Pasta Carbonara', 'Plato Pasta Pesto'], option: 'Bebida', values: ['Vino', 'Te', 'Soda'], drink: 'Jugo Naranja' },
];

const menuOf = (m: Menu) => [
  ...m.members.map((name, i) => ({ id: 800 + i, code: 40 + i, name, price: 30000 + i * 2000, categoryName: 'Platos fuertes', availableNow: true, hasAttributes: true,
    attributes: [{ attributeName: m.option, options: m.values }] })),
  { id: 810, code: 50, name: m.drink, price: 6000, categoryName: 'Bebidas', availableNow: true, hasAttributes: false, attributes: [] },
];

const rows = (h: ReturnType<typeof harness>) => h.conv.sessionData.cart.map((l: any) => [l.name, l.quantity, (l.attributes || []).map((a: any) => a.attributeValue).join('/')]);

describe.each(menus)('$id: list rows, disputed counts and cancel reasons', m => {
  describe.each([false, true])('agent %s', agent => {
    const rig = (orders: unknown[] = []) => {
      const h = harness(menuOf(m) as never, agent);
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      (h.service as any).ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue(orders);
      return h;
    };
    // Naming the dish keeps its first option; a list pick asks for it.
    const order = async (h: ReturnType<typeof harness>, name: string, count = 'un') => {
      await h.sendQueued(`quiero ${count} ${name.toLowerCase()}`);
    };
    const rowOf = (h: ReturnType<typeof harness>, name: string) =>
      (h.conv.sessionData.pendingMatch?.candidates || []).findIndex((c: any) => c.name === name) + 1;
    const pickFromList = async (h: ReturnType<typeof harness>, name: string, option: number) => {
      await h.sendQueued(`qué ${m.plural} tienen?`);
      await h.sendQueued(`el ${m.word} ${rowOf(h, name)}`);
      await h.sendQueued(String(option));
    };

    it(`«el ${m.word} 2 por fa» on the list picks row two as one unit`, async () => {
      const h = rig();
      await h.sendQueued(`qué ${m.plural} tienen?`);
      expect(h.conv.sessionData.pendingMatch?.candidates.map((c: any) => c.name)).toEqual(m.members);
      await h.sendQueued(`El ${m.word} 2 por fa`);
      await h.sendQueued('2');
      expect(rows(h)).toEqual([[m.members[1], 1, m.values[1]]]);
    });

    it(`«la opción 3» and «${m.word} número 3» name the row, not three units`, async () => {
      for (const pick of ['la opción 3', `${m.word} número 3`]) {
        const h = rig();
        await h.sendQueued(`qué ${m.plural} tienen?`);
        await h.sendQueued(pick);
        await h.sendQueued('1');
        expect(rows(h)).toEqual([[m.members[2], 1, m.values[0]]]);
      }
    });

    it('a second unit with another option is its own line and the reply shows the new option', async () => {
      const h = rig();
      await order(h, m.members[1]);
      await h.sendQueued(`qué ${m.plural} tienen?`);
      await h.sendQueued(`El ${m.word} ${rowOf(h, m.members[1])} por fa`);
      const reply = String(await h.sendQueued('3'));
      expect(rows(h)).toEqual([[m.members[1], 1, m.values[0]], [m.members[1], 1, m.values[2]]]);
      expect(reply).toContain(m.values[2]);
      expect(reply).not.toContain(`${m.option}: ${m.values[0]}`);
    });

    it('a bare row number on the list is still one unit of that row', async () => {
      const h = rig();
      await h.sendQueued(`qué ${m.plural} tienen?`);
      await h.sendQueued('2');
      await h.sendQueued('1');
      expect(rows(h)).toEqual([[m.members[1], 1, m.values[0]]]);
    });

    it.each([`Solo pedí un ${m.word}`, `yo solo te pedí un ${m.word}`, `pedí solo un ${m.word}`, `Dame solo el ${m.family} número 2`])(
      '«%s» with three units of that dish leaves one', async text => {
        const h = rig();
        await order(h, m.members[1], 'tres');
        expect(rows(h)).toEqual([[m.members[1], 3, m.values[0]]]);
        const reply = String(await h.sendQueued(text));
        expect(rows(h)).toEqual([[m.members[1], 1, m.values[0]]]);
        expect(reply).not.toMatch(/no manejamos/i);
      });

    it('the disputed count is fixed inside checkout and the step continues', async () => {
      const h = rig();
      await order(h, m.members[0], 'tres');
      await h.sendQueued('no');
      const state = h.conv.state;
      expect(state).toMatch(/^awaiting_/);
      await h.sendQueued(`Solo pedí un ${m.word}`);
      expect(rows(h)).toEqual([[m.members[0], 1, m.values[0]]]);
      expect(h.conv.state).toBe(state);
    });

    // Contrasts for the disputed count.
    it('the count already matching changes nothing', async () => {
      const h = rig();
      await order(h, m.members[0]);
      const reply = String(await h.sendQueued(`solo pedí un ${m.word}`));
      expect(rows(h)).toEqual([[m.members[0], 1, m.values[0]]]);
      expect(reply).toMatch(/no hay de más/);
    });

    it('units on lines with different options are listed, not guessed', async () => {
      const h = rig();
      await order(h, m.members[0]);
      await pickFromList(h, m.members[0], 2);
      const reply = String(await h.sendQueued(`solo pedí un ${m.word}`));
      expect(rows(h)).toEqual([[m.members[0], 1, m.values[0]], [m.members[0], 1, m.values[1]]]);
      expect(reply).toMatch(/cuál quitamos/);
    });

    it('a quantity dispute corrects the named dish and preserves the unrelated drink', async () => {
      const h = rig();
      await order(h, m.members[0], 'dos');
      await h.sendQueued(`una ${m.drink.toLowerCase()}`);
      const drinkBefore = structuredClone(h.conv.sessionData.cart.find((line: any) => line.name === m.drink));
      await h.sendQueued(`solo pedí un ${m.word}`);
      expect(h.conv.sessionData.cart).toHaveLength(2);
      expect(h.conv.sessionData.cart.find((line: any) => line.name === m.members[0])?.quantity).toBe(1);
      expect(h.conv.sessionData.cart.find((line: any) => line.name === m.drink)).toEqual(drinkBefore);
    });

    // Cancel with a reason.
    it.each(['Cancela ya lo pedí por llamada', 'cancela, ya no lo quiero', 'Cancelalo que ya lo pedí por teléfono'])(
      '«%s» clears the unsent cart', async text => {
        const h = rig();
        await order(h, m.members[0]);
        const reply = String(await h.sendQueued(text));
        expect(rows(h)).toEqual([]);
        expect(reply).toMatch(/cancelado/);
        expect(reply).not.toMatch(/No encontré/);
      });

    it('with an order already registered today, the unsent chat cart is dropped and the order is named', async () => {
      const h = rig([{ orderStatus: 'cooking', dailyOrderNumber: 7 }]);
      await order(h, m.members[0]);
      const reply = String(await h.sendQueued('Cancela ya lo pedí por llamada'));
      expect(rows(h)).toEqual([]);
      expect(reply).toContain('#07');
      expect(reply).not.toMatch(/No entendí/);
    });

    it('with a registered order and no chat cart, cancel is refused without «No entendí»', async () => {
      const h = rig([{ orderStatus: 'cooking', dailyOrderNumber: 7 }]);
      const reply = String(await h.sendQueued('Cancela el pedido'));
      expect(reply).toMatch(/no puedo cancelártelo/);
      expect(reply).not.toMatch(/No entendí/);
    });

    it('«no canceles el pedido» keeps the cart', async () => {
      const h = rig();
      await order(h, m.members[0]);
      await h.sendQueued('no canceles el pedido');
      expect(rows(h)).toEqual([[m.members[0], 1, m.values[0]]]);
    });
  });
});
