import { harness } from './whatsapp-accuracy.test-support';

type Family = { id: string; a: string; b: string; other: string; plural: string; absent: string };

const families: Family[] = [
  { id: 'rotisserie', a: '1 Pollo Frito', b: '1 Pollo Broaster', other: 'Churrasco', plural: 'pollos', absent: 'mondongo' },
  { id: 'pizzeria', a: 'Pizza Hawaiana', b: 'Pizza Pepperoni', other: 'Pan De Ajo', plural: 'pizzas', absent: 'lasaña' },
  { id: 'sushi', a: 'Rollo California', b: 'Rollo Tempura', other: 'Sopa Miso', plural: 'rollos', absent: 'ramen' },
];

const menuOf = (f: Family) => [
  { id: 1, code: 1, name: f.a, price: 41000, availableNow: true, hasAttributes: false, attributes: [] },
  { id: 4, code: 4, name: f.b, price: 43000, availableNow: true, hasAttributes: false, attributes: [] },
  { id: 7, code: 7, name: f.other, price: 9000, availableNow: true, hasAttributes: false, attributes: [] },
];

function rig(f: Family, agent: boolean) {
  const h = harness(menuOf(f) as never, agent);
  h.conv.sessionData.cart = [
    { productId: 1, name: f.a, quantity: 2, unitPrice: 41000 },
    { productId: 4, name: f.b, quantity: 1, unitPrice: 43000 },
    { productId: 7, name: f.other, quantity: 3, unitPrice: 9000 },
  ] as never;
  (h.conv as any).state = 'building_cart';
  return h;
}

const cart = (h: ReturnType<typeof harness>) => h.conv.sessionData.cart.map(line => [line.name, line.quantity]);
const bare = (name: string) => name.replace(/^\d+\s+/, '').toLowerCase();

describe.each(families)('$id: «todo el …» removes one dish, not the cart', f => {
  describe.each([false, true])('agent %s', agent => {
    it.each(['quita todo el', 'elimina todo el', 'saca todo el', 'quítame todo el', 'borra todo el'])(
      '«%s <dish>» removes only that line', async verb => {
        const h = rig(f, agent);
        const reply = await h.sendQueued(`${verb} ${bare(f.a)}`);
        expect(cart(h)).toEqual([[f.b, 1], [f.other, 3]]);
        expect(reply).not.toMatch(/vaciamos/i);
      });

    it('«quita todo lo del <dish>» removes that line and adds nothing', async () => {
      const h = rig(f, agent);
      await h.sendQueued(`quítame todo lo del ${bare(f.other)}`);
      expect(cart(h)).toEqual([[f.a, 2], [f.b, 1]]);
    });

    it('«quita todos los <plural>» removes every matching line and keeps the rest', async () => {
      const h = rig(f, agent);
      const reply = await h.sendQueued(`quita todos los ${f.plural}`);
      expect(cart(h)).toEqual([[f.other, 3]]);
      expect(reply).not.toMatch(/No encontré/i);
    });

    it.each(['de', 'del'])('«quita una unidad %s <dish>» removes one unit', async prep => {
      const h = rig(f, agent);
      const reply = await h.sendQueued(`quita una unidad ${prep} ${bare(f.other)}`);
      expect(cart(h)).toEqual([[f.a, 2], [f.b, 1], [f.other, 2]]);
      expect(reply).not.toMatch(/No tienes/i);
    });

    it.each(['quita todo', 'borra todo', 'quita todo el pedido', 'quita todo de mi pedido', 'borra todo lo que llevo', 'quita todo lo del carrito', 'vaciar carrito'])(
      'contrast: «%s» still empties the cart', async text => {
        const h = rig(f, agent);
        await h.sendQueued(text);
        expect(cart(h)).toEqual([]);
      });

    it('contrast: «quita todo el <dish not in cart>» keeps the cart', async () => {
      const h = rig(f, agent);
      await h.sendQueued(`quita todo el ${f.absent}`);
      expect(cart(h)).toEqual([[f.a, 2], [f.b, 1], [f.other, 3]]);
    });

    it('contrast: «quita el <family>» without «todos» asks which line', async () => {
      const h = rig(f, agent);
      await h.sendQueued(`quita el ${f.plural.replace(/s$/, '')}`);
      expect(cart(h)).toEqual([[f.a, 2], [f.b, 1], [f.other, 3]]);
    });
  });
});
