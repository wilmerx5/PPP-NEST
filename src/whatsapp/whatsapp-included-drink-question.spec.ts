import { harness } from './whatsapp-accuracy.test-support';

type Family = {
  id: string;
  word: string;
  item: string;
  plain: [string, string];
  plainDesc: string;
  variant: { name: string; description: string; attributes: { attributeName: string; options: string[] }[] };
  bundled?: { name: string; description: string };
  drinks: [string, string];
};

const families: Family[] = [
  {
    id: 'rice-house', word: 'arroz', item: 'gaseosa',
    plain: ['Arroz Paisa', 'Arroz Marinero'], plainDesc: 'Acompañado con papa francesa',
    variant: { name: 'Combo Arroz Paisa', description: 'Arroz paisa con papa y bebida de 1.5L', attributes: [] },
    drinks: ['Gaseosa 1.5L', 'Jugo Natural'],
  },
  {
    id: 'burger-bar', word: 'hamburguesa', item: 'gaseosa',
    plain: ['Hamburguesa Ranchera', 'Hamburguesa Clasica'], plainDesc: 'Pan brioche y papas',
    variant: { name: 'Hamburguesa Ranchera En Combo', description: 'Con papas grandes', attributes: [{ attributeName: 'Bebida', options: ['Gaseosa', 'Limonada'] }] },
    drinks: ['Gaseosa 400ml', 'Malteada'],
  },
  {
    id: 'pasta-place', word: 'lasagna', item: 'refresco',
    plain: ['Lasagna Pollo', 'Lasagna Vegetal'], plainDesc: 'Gratinada con pan de ajo',
    variant: { name: 'Lasagna Pollo Con Refresco', description: 'Lasagna de pollo con refresco natural', attributes: [] },
    bundled: { name: 'Lasagna Mixta', description: 'Incluye refresco natural' },
    drinks: ['Refresco Natural', 'Agua'],
  },
];

const menuOf = (f: Family) => [
  ...f.drinks.map((name, i) => ({
    id: i + 1, code: i + 1, name, price: 4000 + i * 1000, availableNow: true, categoryName: 'Bebidas',
    hasAttributes: i === 0, attributes: i === 0 ? [{ attributeName: 'Sabor', options: ['Cola', 'Naranja'] }] : [],
  })),
  ...f.plain.map((name, i) => ({ id: 20 + i, code: 20 + i, name, price: 28000 + i * 2000, description: f.plainDesc, availableNow: true, hasAttributes: false, attributes: [] })),
  {
    id: 30, code: 30, name: f.variant.name, price: 36000, description: f.variant.description, availableNow: true,
    hasAttributes: f.variant.attributes.length > 0, attributes: f.variant.attributes,
  },
  ...(f.bundled ? [{ id: 31, code: 31, name: f.bundled.name, price: 33000, description: f.bundled.description, availableNow: true, hasAttributes: false, attributes: [] }] : []),
];

const rows = (h: ReturnType<typeof harness>) => h.conv.sessionData.cart.map((l: any) => [l.name, l.quantity]);
const money = (n: number) => `$${n.toLocaleString('es-CO')}`;

describe.each(families)('$id: «¿traen <bebida>?» after listing dishes asks about those dishes', f => {
  describe.each([false, true])('agent %s', agent => {
    const rig = () => harness(menuOf(f) as never, agent);
    const listing = `Tenemos ${f.plain.map((name, i) => `${name.toLowerCase()} a ${money(28000 + i * 2000)}`).join(' y ')}. ¿Cuál te gustaría pedir?`;
    const listDishes = async (h: ReturnType<typeof harness>) => {
      if (agent) h.agent.runTurn.mockResolvedValueOnce({ reply: listing, actions: {}, toolCalls: [] } as never);
      await h.sendQueued(agent ? `qué opciones de ${f.word} hay?` : `qué ${f.word}s tienen?`);
      expect(rows(h)).toEqual([]);
    };

    it.each([`Traen ${f.item}?`, `vienen con ${f.item}?`, `y traen ${f.item}`])('«%s» answers about the listed dishes and offers the variant with it', async question => {
      const h = rig();
      await listDishes(h);
      const reply = String(await h.sendQueued(question));
      expect(reply).toMatch(new RegExp(`No traen? ${f.item}:[^\\n]*\\*${f.plain[0]}\\*`));
      expect(reply).toContain(`*${f.variant.name}*`);
      expect(reply).not.toContain(`*${f.drinks[0]}*`);
      expect(rows(h)).toEqual([]);
    });

    it('the number then orders the variant that includes it', async () => {
      const h = rig();
      await listDishes(h);
      const reply = String(await h.sendQueued(`Traen ${f.item}?`));
      const n = reply.split('\n').find(line => line.includes(`*${f.variant.name}*`))!.match(/^(\d)/)![1];
      await h.sendQueued(n);
      if (f.variant.attributes.length) await h.sendQueued(f.variant.attributes[0].options[0].toLowerCase());
      expect(rows(h)).toEqual([[f.variant.name, 1]]);
    });

    it('«el <plato> trae <bebida>?» answers only that dish', async () => {
      const h = rig();
      await listDishes(h);
      const reply = String(await h.sendQueued(`el ${f.plain[0].toLowerCase()} trae ${f.item}?`));
      expect(reply).toContain(`No trae ${f.item}: *${f.plain[0]}*.`);
      expect(reply).toContain(`*${f.variant.name}*`);
      expect(reply).not.toContain(`*${f.plain[1]}*`);
    });

    if (f.bundled) {
      it('a dish whose description includes it is answered as yes', async () => {
        const h = rig();
        const reply = String(await h.sendQueued(`la ${f.bundled!.name.toLowerCase()} trae ${f.item}?`));
        expect(reply).toContain(`Sí trae ${f.item}:`);
        expect(reply).toContain(`*${f.bundled!.name}*`);
      });
    }

    it('contrast: with no dish in context «¿traen <bebida>?» is not answered as an inclusion question', async () => {
      const h = rig();
      const reply = String(await h.sendQueued(`traen ${f.item}?`));
      expect(reply).not.toMatch(/No traen?\s|Con \S+ vienen?:/);
    });

    it('contrast: ordering the drink after the listing still orders the drink', async () => {
      const h = rig();
      await listDishes(h);
      const reply = String(await h.sendQueued(`quiero una ${f.drinks[0].split(' ')[0].toLowerCase()}`));
      expect(reply).not.toMatch(/No traen?\s/);
    });
  });
});
