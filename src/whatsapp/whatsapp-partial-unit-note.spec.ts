import { harness } from './whatsapp-accuracy.test-support';
import { parsePartialNote } from './whatsapp-partial-note';

type Menu = { id: string; dish: string; plural: string; sibling: string; siblingWord: string; drink: string; drop: string; other: string };

const menus: Menu[] = [
  { id: 'burger-bar', dish: 'Hamburguesa Clasica', plural: 'hamburguesas clasicas', sibling: 'Hamburguesa Doble', siblingWord: 'hamburguesa', drink: 'Limonada', drop: 'cebolla', other: 'tomate' },
  { id: 'taco-stand', dish: 'Taco Pastor', plural: 'tacos pastor', sibling: 'Taco Pollo', siblingWord: 'taco', drink: 'Agua De Jamaica', drop: 'cilantro', other: 'piña' },
  { id: 'soup-kitchen', dish: 'Sopa Ajiaco', plural: 'sopas ajiaco', sibling: 'Sopa Pollo', siblingWord: 'sopa', drink: 'Jugo Mora', drop: 'alcaparras', other: 'crema' },
];

const menuOf = (m: Menu) => [
  { id: 700, code: 80, name: m.dish, price: 15000, categoryName: 'Platos', availableNow: true, hasAttributes: false, attributes: [] },
  { id: 701, code: 81, name: m.sibling, price: 17000, categoryName: 'Platos', availableNow: true, hasAttributes: false, attributes: [] },
  { id: 702, code: 82, name: m.drink, price: 5000, categoryName: 'Bebidas', availableNow: true, hasAttributes: false, attributes: [] },
];

const rows = (h: ReturnType<typeof harness>) =>
  h.conv.sessionData.cart.map((l: any) => [l.name, l.quantity, l.note || '']).sort((a: any, b: any) => String(a).localeCompare(String(b)));

describe('parsePartialNote implied remainder', () => {
  it.each([
    ['una sin cebolla', 1, 'sin cebolla'],
    ['y una de ellas sin cilantro', 1, 'sin cilantro'],
    ['dos sin tomate por favor', 2, 'sin tomate'],
    ['una poca salsa', 1, 'poca salsa'],
  ])('«%s» is an implied split', (text, quantity, note) => {
    expect(parsePartialNote(text)).toMatchObject({ quantity, note, implied: true });
  });
  it.each(['una más sin cebolla', 'una sin cebolla y otra sin tomate', 'otra sin cebolla', 'una sin cebolla adicional'])('«%s» is not an implied split', text => {
    expect((parsePartialNote(text) as any)?.implied).toBeFalsy();
  });
});

describe.each(menus)('$id: a note for some units keeps the rest plain', m => {
  describe.each([false, true])('agent %s', agent => {
    const rig = () => {
      const h = harness(menuOf(m) as never, agent);
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      return h;
    };

    it.each([
      [`dos ${m.plural}, una sin ${m.drop}`, 1, 1],
      [`quiero 3 ${m.plural}, dos sin ${m.drop}`, 1, 2],
      [`4 ${m.plural}, y una sin ${m.drop}`, 3, 1],
      [`tres ${m.plural}, una de ellas sin ${m.drop}`, 2, 1],
    ])('same message «%s» splits the line', async (text, plain, noted) => {
      const h = rig();
      const reply = String(await h.sendQueued(text));
      expect(rows(h)).toEqual([[m.dish, plain, ''], [m.dish, noted, `sin ${m.drop}`]].sort((a, b) => String(a).localeCompare(String(b))));
      expect(reply).toContain(`sin ${m.drop}`);
    });

    it.each([`una sin ${m.drop}`, `una de ellas sin ${m.drop}`])('after ordering, «%s» notes only one unit', async text => {
      const h = rig();
      await h.sendQueued(`dos ${m.plural}`);
      const reply = String(await h.sendQueued(text));
      expect(rows(h)).toEqual([[m.dish, 1, ''], [m.dish, 1, `sin ${m.drop}`]]);
      expect(reply).toContain(`sin ${m.drop}`);
    });

    it('after three units, «dos sin X» notes two and leaves one plain', async () => {
      const h = rig();
      await h.sendQueued(`3 ${m.plural}`);
      await h.sendQueued(`dos sin ${m.drop}`);
      expect(rows(h)).toEqual([[m.dish, 1, ''], [m.dish, 2, `sin ${m.drop}`]]);
    });

    // Contrasts: forms that already meant something else keep their meaning.
    it('one unit line: «una sin X» still notes that line', async () => {
      const h = rig();
      await h.sendQueued(`una ${m.dish.toLowerCase()}`);
      await h.sendQueued(`una sin ${m.drop}`);
      expect(rows(h)).toEqual([[m.dish, 1, `sin ${m.drop}`]]);
    });

    it('«las dos sin X» notes both units', async () => {
      const h = rig();
      await h.sendQueued(`dos ${m.plural}`);
      await h.sendQueued(`las dos sin ${m.drop}`);
      expect(rows(h)).toEqual([[m.dish, 2, `sin ${m.drop}`]]);
    });

    it('explicit «y la otra normal» still splits', async () => {
      const h = rig();
      await h.sendQueued(`dos ${m.plural}`);
      await h.sendQueued(`una sin ${m.drop} y la otra normal`);
      expect(rows(h)).toEqual([[m.dish, 1, ''], [m.dish, 1, `sin ${m.drop}`]]);
    });

    it('«una sin X y la otra sin Y» in the same message gives each its note', async () => {
      const h = rig();
      await h.sendQueued(`2 ${m.plural}, una sin ${m.drop} y la otra sin ${m.other}`);
      expect(rows(h)).toEqual([[m.dish, 1, `sin ${m.drop}`], [m.dish, 1, `sin ${m.other}`]]);
    });

    it('two different one-unit lines: «una sin X» splits nothing', async () => {
      const h = rig();
      await h.sendQueued(`una ${m.dish.toLowerCase()} y una ${m.sibling.toLowerCase()}`);
      await h.sendQueued(`una sin ${m.drop}`);
      expect(rows(h).map((r: any) => [r[0], r[1]])).toEqual([[m.dish, 1], [m.sibling, 1]]);
      expect(rows(h).filter((r: any) => r[2]).length).toBeLessThanOrEqual(1);
    });

    it('a line that already has a note is not split by an implied note', async () => {
      const h = rig();
      await h.sendQueued(`dos ${m.plural} sin ${m.other}`);
      await h.sendQueued(`una sin ${m.drop}`);
      const noted = rows(h).filter((r: any) => r[2] === `sin ${m.drop}`);
      expect(noted).toEqual([]);
    });

    it('the same-message count cannot exceed the total', async () => {
      const h = rig();
      await h.sendQueued(`dos ${m.plural}, tres sin ${m.drop}`);
      expect(rows(h).filter((r: any) => r[1] === 1 && r[2] === '')).toEqual([]);
    });
  });
});
