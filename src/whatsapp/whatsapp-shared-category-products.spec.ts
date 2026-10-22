import { harness } from './whatsapp-accuracy.test-support';
import { WhatsappCatalogService, type WhatsappCatalogProduct } from './whatsapp-catalog.service';

type Attribute = { attributeName: string; options: string[] };
type Raw = { id: number; code: number; name: string; price: number; description: null; hasAttributes: boolean; attributes: Attribute[]; availableNow: boolean };
type Menu = { id: string; word: string; pair: [Raw, Raw]; categories: [string, string]; other: Raw; otherCategory: string; named: string };

const raw = (id: number, name: string, price: number, attributes: Attribute[] = []): Raw =>
  ({ id, code: id, name, price, description: null, hasAttributes: attributes.length > 0, attributes, availableNow: true });

const menus: Menu[] = [
  { id: 'lunch plates', word: 'ejecutivo',
    pair: [raw(1301, 'Ejecutivo Con Res', 21000, [{ attributeName: 'Sopa', options: ['Verduras', 'Frijol'] }, { attributeName: 'Bebida', options: ['Limonada', 'Agua'] }]),
      raw(1302, 'Ejecutivo Con Cerdo', 20000, [{ attributeName: 'Sopa', options: ['Verduras', 'Frijol'] }, { attributeName: 'Bebida', options: ['Limonada', 'Agua'] }])],
    categories: ['Platos a la carta', 'Almuerzos del dia'], other: raw(1303, 'Limonada Natural', 5000), otherCategory: 'Bebidas',
    named: 'un ejecutivo con cerdo' },
  { id: 'burgers', word: 'hamburguesa',
    pair: [raw(1401, 'Hamburguesa Clasica', 18000), raw(1402, 'Hamburguesa Doble', 24000)],
    categories: ['Hamburguesas', 'Promociones'], other: raw(1403, 'Papas Fritas', 6000), otherCategory: 'Adicionales',
    named: 'una hamburguesa doble' },
  { id: 'wraps', word: 'wrap',
    pair: [raw(1501, 'Wrap De Pollo', 16000, [{ attributeName: 'Salsa', options: ['Ajo', 'Miel Mostaza'] }]), raw(1502, 'Wrap Vegetal', 15000, [{ attributeName: 'Salsa', options: ['Ajo', 'Miel Mostaza'] }])],
    categories: ['Wraps', 'Saludables'], other: raw(1503, 'Jugo De Mango', 7000), otherCategory: 'Jugos',
    named: 'un wrap vegetal' },
];

const grouped = (m: Menu) => [
  { categoryName: m.categories[0], products: [...m.pair] },
  { categoryName: m.otherCategory, products: [m.other] },
  { categoryName: m.categories[1], products: [m.pair[1], m.pair[0]] },
];

const loadMenu = (m: Menu) =>
  new WhatsappCatalogService({ findProductsGroupedByCategory: async () => grouped(m) } as never).getMenuProducts();

const occurrences = (text: string, name: string) => text.split(name).length - 1;

describe.each(menus)('$id: a product listed in two menu categories', m => {
  it('the catalog keeps one entry per product with both categories', async () => {
    const menu = await loadMenu(m);
    expect(menu.map(p => p.id).sort()).toEqual([m.pair[0].id, m.pair[1].id, m.other.id].sort());
    for (const p of m.pair) {
      const listed = menu.find(x => x.id === p.id)!;
      expect(listed.categoryName).toBe(m.categories[0]);
      expect(listed.categoryNames).toEqual(m.categories);
    }
    expect(menu.find(x => x.id === m.other.id)!.categoryNames).toEqual([m.otherCategory]);
  });

  it('category browsing still finds the product under its second category', async () => {
    const catalog = new WhatsappCatalogService({ findProductsGroupedByCategory: async () => grouped(m) } as never);
    const menu = await catalog.getMenuProducts();
    const grouping = catalog.groupProductsByCategory(menu);
    for (const category of m.categories) expect(grouping.get(category)!.map(p => p.id).sort()).toEqual(m.pair.map(p => p.id).sort());
    const hit = catalog.findByCategory(m.categories[1].toLowerCase(), menu);
    expect(hit?.products.map(p => p.id).sort()).toEqual(m.pair.map(p => p.id).sort());
  });

  it('a product that is unavailable in one category but available in another stays available', async () => {
    const catalog = new WhatsappCatalogService({ findProductsGroupedByCategory: async () => [
      { categoryName: m.categories[0], products: [{ ...m.pair[0], availableNow: false }] },
      { categoryName: m.categories[1], products: [m.pair[0]] },
    ] } as never);
    const [only] = await catalog.getMenuProducts();
    expect(only.availableNow).toBe(true);
  });

  describe.each([false, true])('agent %s', agent => {
    const start = async () => {
      const menu = await loadMenu(m);
      const h = harness(menu as never, agent);
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      return h;
    };
    const expectSingleList = (reply: string) => {
      for (const p of m.pair) expect(occurrences(reply, p.name)).toBe(1);
      expect(reply).not.toMatch(/Pediste \*?1\*?\./);
    };

    it.each([
      (w: string) => `hola buenas tardes me das un ${w}`,
      (w: string) => `ola buenas tardes me das un ${w}`,
      (w: string) => `buenas noches, quiero un ${w}`,
    ])('a greeting plus an order for the shared word lists each option once (%#)', async phrase => {
      const h = await start();
      const reply = (await h.send(phrase(m.word)))!;
      expectSingleList(reply);
      expect(h.cartRows()).toEqual([]);
      expect(h.conv.sessionData.pendingMatch?.candidates.map((p: WhatsappCatalogProduct) => p.id).sort()).toEqual(m.pair.map(p => p.id).sort());
    });

    it('choosing a number from the list takes that product, not the first one', async () => {
      const h = await start();
      const reply = (await h.send(`me das un ${m.word}`))!;
      const second = [...m.pair].sort((a, b) => reply.indexOf(a.name) - reply.indexOf(b.name))[1];
      await h.send('2');
      const chosen = h.conv.sessionData.pendingAttribute?.productId ?? h.cartRows()[0]?.id;
      expect(chosen).toBe(second.id);
      expect(h.cartRows().every(row => row.id === second.id)).toBe(true);
    });

    it('naming the variant adds it directly', async () => {
      const h = await start();
      await h.send(m.named);
      const chosen = h.conv.sessionData.pendingAttribute?.productId ?? h.cartRows()[0]?.id;
      expect(chosen).toBe(m.pair[1].id);
      expect(h.conv.sessionData.pendingMatch ?? null).toBeNull();
    });

    it('contrast: an explicit quantity is still echoed', async () => {
      const h = await start();
      const reply = (await h.send(`quiero 2 ${m.word}s`))!;
      expect(reply).toMatch(/Pediste \*2\*/);
      for (const p of m.pair) expect(occurrences(reply, p.name)).toBe(1);
      expect(h.cartRows()).toEqual([]);
    });
  });

  it('agent off: the bare shared word asks instead of adding the first tied product', async () => {
    const h = harness((await loadMenu(m)) as never, false);
    h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
    const reply = (await h.send(`un ${m.word}`))!;
    for (const p of m.pair) expect(occurrences(reply, p.name)).toBe(1);
    expect(h.cartRows()).toEqual([]);
  });
});
