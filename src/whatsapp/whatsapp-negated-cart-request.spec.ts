import { harness } from './whatsapp-accuracy.test-support';

type Family = { id: string; family: string; un: string; el: string; variants: [string, string]; target: string; other: string; absent: string };

const families: Family[] = [
  { id: 'rotisserie', family: 'pollo', un: 'un', el: 'el', variants: ['1 Pollo Frito', '1 Pollo Broaster'],
    target: 'Combo De Arroz Paisa', other: 'Churrasco', absent: 'mojarra' },
  { id: 'pizzeria', family: 'pizza', un: 'una', el: 'la', variants: ['Pizza Hawaiana', 'Pizza Pepperoni'],
    target: 'Calzone De Jamón', other: 'Pan De Ajo', absent: 'lasaña' },
  { id: 'juice bar', family: 'jugo', un: 'un', el: 'el', variants: ['Jugo De Mora', 'Jugo De Lulo'],
    target: 'Malteada De Vainilla', other: 'Empanada De Queso', absent: 'sandwich' },
];

const menuOf = (f: Family) => [
  { id: 1, code: 1, name: f.variants[0], price: 41000, availableNow: true, hasAttributes: false, attributes: [] },
  { id: 4, code: 4, name: f.variants[1], price: 43000, availableNow: true, hasAttributes: false, attributes: [] },
  { id: 9, code: 94, name: f.target, price: 42000, availableNow: true, hasAttributes: false, attributes: [] },
  { id: 7, code: 7, name: f.other, price: 9000, availableNow: true, hasAttributes: false, attributes: [] },
];

type Line = [number, string, number];

function rig(f: Family, agent: boolean, lines: Line[]) {
  const h = harness(menuOf(f) as never, agent);
  const menu = menuOf(f);
  h.conv.sessionData.cart = lines.map(([productId, name, quantity]) =>
    ({ productId, name, quantity, unitPrice: menu.find(p => p.id === productId)!.price }) as never);
  (h.conv as any).state = 'building_cart';
  return h;
}

const cart = (h: ReturnType<typeof harness>) => h.conv.sessionData.cart.map(line => [line.name, line.quantity]);

describe.each(families)('$id: negated cart requests', f => {
  const fried: Line = [1, f.variants[0], 1];

  describe.each([false, true])('agent %s', agent => {
    it.each([`no quiero ${f.un} ${f.family}`, `no quiero ${f.el} ${f.family}`, `ya no quiero ${f.el} ${f.family}`, `no queria ${f.family}`])(
      '«%s» removes the only matching line instead of keeping it', async text => {
        const h = rig(f, agent, [fried]);
        const reply = await h.sendQueued(text);
        expect(cart(h)).toEqual([]);
        expect(reply).not.toMatch(/Conservo/);
      });

    it.each([
      `no quieria ${f.un} ${f.family}, queria el ${f.target.toLowerCase()}`,
      `no quería ${f.el} ${f.family}, quería el ${f.target.toLowerCase()}`,
      `yo no pedí ${f.family}, pedí el ${f.target.toLowerCase()}`,
      `no queria ${f.el} ${f.family} queria era el ${f.target.toLowerCase()}`,
    ])('past-tense swap «%s» replaces the line without a variant question', async text => {
      const h = rig(f, agent, [fried]);
      const reply = await h.sendQueued(text);
      expect(cart(h)).toEqual([[f.target, 1]]);
      expect(h.conv.sessionData.pendingMatch).toBeFalsy();
      expect(reply).not.toMatch(/cómo lo quieres/i);
    });

    it('a removal while the family variant list is open drops the line and the list', async () => {
      const h = rig(f, agent, [fried]);
      const menu = menuOf(f);
      h.conv.sessionData.pendingMatch = { query: `1 ${f.family}`, candidates: [menu[1], menu[0]], intent: 'order' } as never;
      await h.sendQueued(`no quiero ${f.un} ${f.family}`);
      expect(cart(h)).toEqual([]);
      expect(h.conv.sessionData.pendingMatch).toBeFalsy();
    });

    it('with two units and another dish, «no quiero un/una …» removes one unit only', async () => {
      const h = rig(f, agent, [[1, f.variants[0], 2], [7, f.other, 1]]);
      await h.sendQueued(`no quiero ${f.un} ${f.family}`);
      expect(cart(h)).toEqual([[f.variants[0], 1], [f.other, 1]]);
    });

    it('with two units and another dish, «no quiero el/la …» removes that whole line only', async () => {
      const h = rig(f, agent, [[1, f.variants[0], 2], [7, f.other, 1]]);
      await h.sendQueued(`no quiero ${f.el} ${f.family}`);
      expect(cart(h)).toEqual([[f.other, 1]]);
    });

    it('contrast: «no, quiero 2 …» stays a quantity correction', async () => {
      const h = rig(f, agent, [fried]);
      await h.sendQueued(`no, quiero 2 ${f.variants[0].replace(/^\d+\s+/, '').toLowerCase()}`);
      expect(cart(h)).toEqual([[f.variants[0], 2]]);
    });

    it('contrast: the present-tense swap still replaces the line', async () => {
      const h = rig(f, agent, [fried]);
      await h.sendQueued(`no quiero ${f.family}, quiero el ${f.target.toLowerCase()}`);
      expect(cart(h)).toEqual([[f.target, 1]]);
    });

    it('a swap naming the full cart line replaces it instead of adding both', async () => {
      const h = rig(f, agent, [fried, [7, f.other, 1]]);
      const reply = await h.sendQueued(`no quiero ${f.el} ${f.variants[0].replace(/^\d+\s+/, '').toLowerCase()}, quiero el ${f.target.toLowerCase()}`);
      expect(cart(h)).toEqual([[f.other, 1], [f.target, 1]]);
      expect(reply).not.toMatch(/no manejamos/i);
    });

    it('contrast: a dish that is not in the cart removes nothing', async () => {
      const h = rig(f, agent, [fried, [7, f.other, 1]]);
      await h.sendQueued(`no quiero ${f.absent}`);
      expect(cart(h)).toEqual([[f.variants[0], 1], [f.other, 1]]);
    });

    it('contrast: two lines of the same family are not removed by the family word', async () => {
      const h = rig(f, agent, [fried, [4, f.variants[1], 1]]);
      await h.sendQueued(`no quiero ${f.el} ${f.family}`);
      expect(cart(h)).toHaveLength(2);
    });

    it('contrast: «no quiero cebolla» removes no dish', async () => {
      const h = rig(f, agent, [fried]);
      await h.sendQueued('no quiero cebolla');
      expect(cart(h)).toEqual([[f.variants[0], 1]]);
    });
  });
});
