import { harness } from './whatsapp-accuracy.test-support';

type Menu = { id: string; first: string; second: string; family: string; firstShort: string; secondShort: string; drink: string; drop: string };

const menus: Menu[] = [
  { id: 'burger-bar', first: 'Hamburguesa Clasica', second: 'Hamburguesa Doble', family: 'la hamburguesa', firstShort: 'la clasica', secondShort: 'la doble', drink: 'Limonada', drop: 'cebolla' },
  { id: 'taco-stand', first: 'Taco Pastor', second: 'Taco Pollo', family: 'el taco', firstShort: 'el pastor', secondShort: 'el pollo', drink: 'Agua De Jamaica', drop: 'cilantro' },
  { id: 'pizza-place', first: 'Pizza Hawaiana', second: 'Pizza Pepperoni', family: 'la pizza', firstShort: 'la hawaiana', secondShort: 'la pepperoni', drink: 'Gaseosa Cola', drop: 'aceitunas' },
];

const menuOf = (m: Menu) => [
  { id: 900, code: 90, name: m.first, price: 15000, categoryName: 'Platos', availableNow: true, hasAttributes: false, attributes: [] },
  { id: 901, code: 91, name: m.second, price: 17000, categoryName: 'Platos', availableNow: true, hasAttributes: false, attributes: [] },
  { id: 902, code: 92, name: m.drink, price: 5000, categoryName: 'Bebidas', availableNow: true, hasAttributes: false, attributes: [] },
];

const rows = (h: ReturnType<typeof harness>) => h.conv.sessionData.cart.map((l: any) => [l.name, l.quantity, l.note || '']);

describe.each(menus)('$id: a note that names no dish asks which one', m => {
  describe.each([false, true])('agent %s', agent => {
    const rig = () => {
      const h = harness(menuOf(m) as never, agent);
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      return h;
    };
    const both = `una ${m.first.toLowerCase()} y una ${m.second.toLowerCase()}`;
    const plain = [[m.first, 1, ''], [m.second, 1, '']];

    it.each([`una sin ${m.drop}`, `sin ${m.drop}`, `una sin ${m.drop} por favor`])('«%s» lists the lines and changes nothing', async text => {
      const h = rig();
      await h.sendQueued(both);
      const reply = String(await h.sendQueued(text));
      expect(reply).toContain(`«sin ${m.drop}»`);
      expect(reply).toContain(`1. ${m.first}`);
      expect(reply).toContain(`2. ${m.second}`);
      expect(rows(h)).toEqual(plain);
    });

    it.each([
      ['2', 1], [m.secondShort, 1], [m.second.toLowerCase(), 1], ['1', 0], [m.firstShort, 0],
    ])('the answer «%s» notes only that line', async (answer, target) => {
      const h = rig();
      await h.sendQueued(both);
      await h.sendQueued(`una sin ${m.drop}`);
      await h.sendQueued(answer as string);
      const expected = plain.map((r, i) => i === target ? [r[0], 1, `sin ${m.drop}`] : r);
      expect(rows(h)).toEqual(expected);
      expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeUndefined();
    });

    it('a drink in the cart is listed, never silently noted', async () => {
      const h = rig();
      await h.sendQueued(`${both} y una ${m.drink.toLowerCase()}`);
      const reply = String(await h.sendQueued(`una sin ${m.drop}`));
      expect(reply).toContain(`3. ${m.drink}`);
      expect(rows(h).every((r: any) => !r[2])).toBe(true);
      await h.sendQueued(m.firstShort);
      expect(rows(h)).toEqual([[m.first, 1, `sin ${m.drop}`], [m.second, 1, ''], [m.drink, 1, '']]);
    });

    it('«<familia> sin X» with two family lines asks and the short name answers', async () => {
      const h = rig();
      await h.sendQueued(both);
      const reply = String(await h.sendQueued(`${m.family} sin ${m.drop}`));
      expect(reply).not.toMatch(/varias líneas/);
      expect(reply).toContain(`2. ${m.second}`);
      expect(rows(h)).toEqual(plain);
      await h.sendQueued(m.secondShort);
      expect(rows(h)).toEqual([[m.first, 1, ''], [m.second, 1, `sin ${m.drop}`]]);
    });

    it('a multi-unit line picked from the list splits one unit', async () => {
      const h = rig();
      await h.sendQueued(`dos ${m.first.toLowerCase()} y una ${m.second.toLowerCase()}`);
      await h.sendQueued(`una sin ${m.drop}`);
      await h.sendQueued(m.firstShort);
      expect(rows(h)).toEqual([[m.first, 1, ''], [m.first, 1, `sin ${m.drop}`], [m.second, 1, '']]);
    });

    it('«las dos sin X» covering every unit notes all lines without asking', async () => {
      const h = rig();
      await h.sendQueued(both);
      await h.sendQueued(`las dos sin ${m.drop}`);
      expect(rows(h)).toEqual([[m.first, 1, `sin ${m.drop}`], [m.second, 1, `sin ${m.drop}`]]);
      expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeUndefined();
    });

    it('«no apliques esa nota» drops the question and keeps the cart', async () => {
      const h = rig();
      await h.sendQueued(both);
      await h.sendQueued(`una sin ${m.drop}`);
      await h.sendQueued('no apliques esa nota');
      expect(rows(h)).toEqual(plain);
      expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeUndefined();
    });

    // Contrasts: a clear target is still noted directly.
    it('a single line takes «sin X» directly', async () => {
      const h = rig();
      await h.sendQueued(`una ${m.first.toLowerCase()}`);
      await h.sendQueued(`sin ${m.drop}`);
      expect(rows(h)).toEqual([[m.first, 1, `sin ${m.drop}`]]);
      expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeUndefined();
    });

    it('a single two-unit line still splits «una sin X»', async () => {
      const h = rig();
      await h.sendQueued(`dos ${m.first.toLowerCase()}`);
      await h.sendQueued(`una sin ${m.drop}`);
      expect(rows(h)).toEqual([[m.first, 1, ''], [m.first, 1, `sin ${m.drop}`]]);
    });

    it('naming the full dish with its article notes that line without asking', async () => {
      const h = rig();
      await h.sendQueued(both);
      await h.sendQueued(`${m.family.split(' ')[0]} ${m.second.toLowerCase()} sin ${m.drop}`);
      expect(rows(h)).toEqual([[m.first, 1, ''], [m.second, 1, `sin ${m.drop}`]]);
      expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeUndefined();
    });

    it('a count above the order total asks instead of guessing', async () => {
      const h = rig();
      await h.sendQueued(both);
      const reply = String(await h.sendQueued(`tres sin ${m.drop}`));
      expect(reply).toMatch(/2 unidades/);
      expect(rows(h)).toEqual(plain);
    });
  });
});
