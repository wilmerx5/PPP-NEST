import { harness } from './whatsapp-accuracy.test-support';
import { WhatsappPointsService } from './whatsapp-points.service';

type Family = { id: string; word: string; plural: string; members: [string, string, string]; single: string; singlePlural: string; drink: string };

const families: Family[] = [
  { id: 'burger-bar', word: 'hamburguesa', plural: 'hamburguesas', members: ['Hamburguesa Clasica', 'Hamburguesa Doble', 'Hamburguesa Pollo'], single: 'Papas Fritas', singlePlural: 'papas', drink: 'Limonada' },
  { id: 'pasta-place', word: 'lasagna', plural: 'lasagnas', members: ['Lasagna Mixta', 'Lasagna Pollo', 'Lasagna Vegetal'], single: 'Pan De Ajo', singlePlural: 'panes', drink: 'Jugo Mora' },
  { id: 'arepa-house', word: 'arepa', plural: 'arepas', members: ['Arepa Queso', 'Arepa Carne', 'Arepa Mixta'], single: 'Tamal Tolimense', singlePlural: 'tamales', drink: 'Cafe Tinto' },
];

const menuOf = (f: Family) => [
  ...f.members.map((name, i) => ({ id: 600 + i, code: 60 + i, name, price: 10000 + i * 1000, categoryName: 'Platos', availableNow: true, hasAttributes: false, attributes: [] })),
  { id: 610, code: 70, name: f.single, price: 6000, categoryName: 'Acompañantes', availableNow: true, hasAttributes: false, attributes: [] },
  { id: 611, code: 71, name: f.drink, price: 4000, categoryName: 'Bebidas', availableNow: true, hasAttributes: false, attributes: [] },
];

const rows = (h: ReturnType<typeof harness>) => h.conv.sessionData.cart.map((l: any) => [l.name, l.quantity]);

describe.each(families)('$id: a family question lists the family', f => {
  describe.each([false, true])('agent %s', agent => {
    const rig = () => {
      const h = harness(menuOf(f) as never, agent);
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      return h;
    };
    const questions = [`qué ${f.plural} tienen?`, `que ${f.plural} manejan`, `tienen ${f.plural}?`, `quiero ver las ${f.plural}`, `muéstrame las ${f.plural}`, f.plural, `buenas, qué ${f.plural} hay?`];

    it.each(questions)('«%s» lists every member and adds nothing', async question => {
      const h = rig();
      const reply = String(await h.sendQueued(question));
      for (const name of f.members) expect(reply).toContain(`*${name}*`);
      expect(reply).not.toContain(f.single);
      expect(rows(h)).toEqual([]);
      expect(h.conv.sessionData.pendingMatch?.candidates.map((c: any) => c.name)).toEqual(f.members);
    });

    it('the row number then orders that member', async () => {
      const h = rig();
      await h.sendQueued(`qué ${f.plural} tienen?`);
      await h.sendQueued('2');
      expect(rows(h)).toEqual([[f.members[1], 1]]);
    });

    it('contrast: naming one member still orders it', async () => {
      const h = rig();
      const reply = String(await h.sendQueued(`quiero una ${f.members[1].toLowerCase()}`));
      expect(reply).not.toMatch(/📋/);
      if (!agent || rows(h).length) expect(rows(h)).toEqual([[f.members[1], 1]]);
      else expect(h.agent.runTurn).toHaveBeenCalled();
    });

    it('contrast: a word with a single product is not a family list', async () => {
      const h = rig();
      const reply = String(await h.sendQueued(`tienen ${f.singlePlural}?`));
      expect(reply).not.toMatch(new RegExp(`📋 \\*${f.singlePlural}`, 'i'));
      for (const name of f.members) expect(reply).not.toContain(`*${name}*`);
    });

    it('contrast: a category word still answers with the category', async () => {
      const h = rig();
      const reply = String(await h.sendQueued('qué bebidas tienen?'));
      expect(reply.includes(f.drink) || (agent && h.agent.runTurn.mock.calls.length > 0)).toBe(true);
      for (const name of f.members) expect(reply).not.toContain(`*${name}*`);
      expect(rows(h)).toEqual([]);
    });
  });
});

describe('points: a twelve-letter word is not an invoice code', () => {
  const points = new WhatsappPointsService({} as never);
  it.each(['hamburguesas', 'Hamburguesas'])('«%s» → no code', text => expect(points.extractPointCodeCandidate(text)).toBeNull());
  it.each([['A3F9K2M8PQ75', 'A3F9K2M8PQ75'], ['a3f9k2m8pq75', 'A3F9K2M8PQ75'], ['ABCDEFGHJKMN', 'ABCDEFGHJKMN']])('«%s» → %s', (text, code) =>
    expect(points.extractPointCodeCandidate(text)).toBe(code));
});
