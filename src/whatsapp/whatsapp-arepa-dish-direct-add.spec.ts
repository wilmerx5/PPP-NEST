import { harness } from './whatsapp-accuracy.test-support';

type Menu = { id: string; dish: string; spoken: string; side: string; products: Record<string, unknown>[] };

const plain = (id: number, name: string, categoryName: string, price = 10000) =>
  ({ id, code: id, name, price, categoryName, availableNow: true, hasAttributes: false, attributes: [] });

const menus: Menu[] = [
  { id: 'filled', dish: 'Arepa Rellena', spoken: 'arepa rellena', side: 'Arepas Fritas', products: [
    plain(800, 'Arepa Rellena', 'Arepas', 12000),
    plain(801, 'Arepas Fritas', 'Acompañantes', 3000),
    plain(802, 'Jugo De Lulo', 'Bebidas', 5000),
  ] },
  { id: 'protein', dish: 'Arepa De Pollo', spoken: 'arepa de pollo', side: 'Arepa Blanca', products: [
    plain(810, 'Arepa De Pollo', 'Platos', 14000),
    plain(811, 'Arepa Blanca', 'Adicionales', 2500),
    plain(812, 'Lasagna Mixta', 'Pastas', 26000),
    plain(813, 'Gaseosa Personal', 'Bebidas', 4000),
  ] },
  { id: 'mixed', dish: 'Arepa Mixta', spoken: 'arepa mixta', side: 'Arepa', products: [
    plain(820, 'Arepa Mixta', 'Arepas', 16000),
    plain(821, 'Arepa', 'Acompañantes', 2000),
    plain(822, 'Ceviche Clasico', 'Mariscos', 30000),
    plain(823, 'Limonada De Coco', 'Bebidas', 9000),
  ] },
];

describe.each(menus)('$id: a dish whose name starts with «arepa» is added directly', m => {
  const cartOf = (h: ReturnType<typeof harness>) =>
    (h.conv.sessionData.cart as { name: string; quantity: number }[]).map(l => [l.name, l.quantity]);

  it('the catalog treats the dish as a main and the plain arepa as a side', () => {
    const h = harness(m.products as never, false);
    const catalog = (h.service as never as { catalogService: { isLikelySideOnlyProduct(p: unknown): boolean } }).catalogService;
    const byName = (n: string) => m.products.find(p => p.name === n);
    expect(catalog.isLikelySideOnlyProduct(byName(m.dish))).toBe(false);
    expect(catalog.isLikelySideOnlyProduct(byName(m.side))).toBe(true);
  });

  describe.each([false, true])('agent %s', agent => {
    const start = () => {
      const h = harness(m.products as never, agent);
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      return h;
    };

    it.each(['quiero una {d}', 'quiero 1 {d}', 'me das una {d}', 'quiero pedir una {d}', 'una {d}', 'dame una {d}'])(
      '«%s» adds one dish', async phrasing => {
        const h = start();
        const reply = String(await h.sendQueued(phrasing.replace('{d}', m.spoken)));
        expect(cartOf(h)).toEqual([[m.dish, 1]]);
        expect(reply).toContain(`*${m.dish}*`);
        expect(reply).not.toContain('¿Cuál prefieres?');
      });

    it('a plural with a quantity adds that many', async () => {
      const h = start();
      const plural = m.spoken.replace(/^arepa/, 'arepas');
      await h.sendQueued(`quiero dos ${plural}`);
      expect(cartOf(h)).toEqual([[m.dish, 2]]);
    });

    it.each(['dame {s}', 'quiero {s}', 'dame una porción de {s}'])('the plain side arepa ordered alone, «%s», is added', async phrasing => {
      const h = start();
      await h.sendQueued(phrasing.replace('{s}', m.side.toLowerCase()));
      expect(cartOf(h)).toEqual([[m.side, 1]]);
    });

    it('contrast: «sin <side>» on a dish already in the cart does not add the side', async () => {
      const h = start();
      await h.sendQueued(`una ${m.spoken}`);
      await h.sendQueued(`sin ${m.side.toLowerCase()}`);
      expect(cartOf(h).map(([name]) => name)).not.toContain(m.side);
    });

    it('contrast: a question about the dish does not add it', async () => {
      const h = start();
      await h.sendQueued(`¿cuánto vale la ${m.spoken}?`);
      expect(cartOf(h)).toEqual([]);
    });
  });
});
