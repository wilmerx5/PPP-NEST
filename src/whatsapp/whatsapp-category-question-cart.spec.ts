import { harness } from './whatsapp-accuracy.test-support';

type Product = { id: number; code: number; name: string; price: number; description: string | null; categoryName: string; availableNow: boolean; hasAttributes: boolean; attributes: [] };
type Menu = { id: string; main: Product; category: string; word: string; plural: string; items: Product[]; order: string; pick: string };

const product = (id: number, name: string, price: number, categoryName: string, description: string | null = null): Product =>
  ({ id, code: id, name, price, description, categoryName, availableNow: true, hasAttributes: false, attributes: [] });

const menus: Menu[] = [
  { id: 'home cooking', category: 'Sopas', word: 'sopa', plural: 'sopas', order: 'un pollo asado entero', pick: 'una sopa de pasta',
    main: product(3101, 'Pollo Asado Entero', 42000, 'Pollos', 'Con arepas y papa'),
    items: [product(3102, 'Sopa De Pasta', 9000, 'Sopas', 'Con arroz'), product(3103, 'Sopa De Lentejas', 9500, 'Sopas'), product(3104, 'Crema De Ahuyama', 8000, 'Sopas')] },
  { id: 'burger joint', category: 'Jugos', word: 'jugo', plural: 'jugos', order: 'una hamburguesa doble', pick: 'un jugo de mora',
    main: product(3201, 'Hamburguesa Doble', 26000, 'Hamburguesas', 'Doble carne y queso'),
    items: [product(3202, 'Jugo De Mora', 6000, 'Jugos'), product(3203, 'Jugo De Mango', 6000, 'Jugos'), product(3204, 'Jugo De Lulo', 6500, 'Jugos')] },
  { id: 'pizzeria', category: 'Postres', word: 'postre', plural: 'postres', order: 'una pizza hawaiana', pick: 'un brownie con helado',
    main: product(3301, 'Pizza Hawaiana', 35000, 'Pizzas', 'Jamón y piña'),
    items: [product(3302, 'Brownie Con Helado', 9000, 'Postres'), product(3303, 'Torta De Chocolate', 8500, 'Postres'), product(3304, 'Flan De Caramelo', 7000, 'Postres')] },
];

describe.each(menus)('$id: a category question with a cart line lists the category', m => {
  describe.each([false, true])('agent %s', agent => {
    const start = async () => {
      const h = harness([m.main, ...m.items] as never, agent);
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      await h.send(m.order);
      expect(h.cartRows().map(r => r.id)).toEqual([m.main.id]);
      return h;
    };
    const expectList = (reply: string | undefined) => {
      for (const item of m.items) expect(reply).toContain(item.name);
      expect(reply).not.toMatch(/ya lo tienes/i);
      expect(reply).not.toMatch(/no tenemos productos de/i);
    };

    it.each([
      () => `de que ${m.word} hay?`,
      () => `que ${m.plural} tienen`,
      () => `y de que ${m.plural} hay?`,
      () => `si pero quiero saber de que ${m.word} hay quiero una ${m.word}`,
      () => `quisiera saber que ${m.plural} tienen`,
      () => `que ${m.plural} venden?`,
      () => `que tienen de ${m.plural}?`,
    ])('lists every item of the category and leaves the cart alone (%#)', async ask => {
      const h = await start();
      expectList(await h.send(ask()));
      expect(h.cartRows().map(r => r.id)).toEqual([m.main.id]);
    });

    it('a pick right after the list adds that item next to the cart line', async () => {
      const h = await start();
      await h.send(`de que ${m.word} hay?`);
      await h.send(m.pick);
      expect(h.cartRows().map(r => r.id)).toEqual([m.main.id, m.items[0].id]);
    });

    it('contrast: ordering an item of the category adds it instead of listing', async () => {
      const h = await start();
      await h.send(`quiero ${m.pick}`);
      expect(h.cartRows().map(r => r.id)).toEqual([m.main.id, m.items[0].id]);
    });

    it('contrast: a category the menu does not have lists nothing and keeps the cart', async () => {
      const h = await start();
      const reply = await h.send('de que mariscos hay?');
      for (const item of m.items) expect(reply).not.toContain(`${item.name}* · $`);
      expect(h.cartRows().map(r => r.id)).toEqual([m.main.id]);
    });
  });

  it('contrast: a question about the cart dish is not answered with the category list', async () => {
    const h = harness([m.main, ...m.items] as never, false);
    h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
    await h.send(m.order);
    const reply = await h.send(`que trae ${m.main.name.toLowerCase()}?`);
    expect(reply).not.toContain(m.items[1].name);
    expect(h.cartRows().map(r => r.id)).toEqual([m.main.id]);
  });
});
