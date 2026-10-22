import { harness } from './whatsapp-accuracy.test-support';

type Attribute = { attributeName: string; options: string[] };
type Product = { id: number; code: number; name: string; price: number; description: string | null; categoryName: string; availableNow: boolean; hasAttributes: boolean; attributes: Attribute[] };
type Menu = { id: string; dish: Product; own: Product; other: Product; base: Product; kept: [string, string]; drink: string; order: string };

const product = (id: number, name: string, price: number, description: string | null, attributes: Attribute[] = []): Product =>
  ({ id, code: id, name, price, description, categoryName: 'Platos', availableNow: true, hasAttributes: attributes.length > 0, attributes });
const drinks = { attributeName: 'Bebida', options: ['Limonada', 'Pepsi', 'Uva'] };

const menus: Menu[] = [
  { id: 'rice', kept: ['Pollo', 'Asado'], drink: 'Uva', order: 'un arroz especial con pollo asado',
    dish: product(1901, 'Arroz Especial Con Pollo', 30000, 'Con papa francesa', [{ attributeName: 'Pollo', options: ['Frito', 'Asado'] }]),
    own: product(1902, 'Combo Arroz Especial Con Pollo', 36000, 'Con papa francesa y bebida 1.5L', [drinks, { attributeName: 'Pollo', options: ['Frito', 'Asado'] }]),
    other: product(1903, 'Combo Arroz Especial Con Cerdo', 39000, 'Con papa francesa y bebida 1.5L', [drinks]),
    base: product(1904, 'Arroz Especial', 26000, 'Con papa francesa') },
  { id: 'burger', kept: ['Término', 'Bien Asado'], drink: 'Pepsi', order: 'una hamburguesa con tocineta bien asado',
    dish: product(2001, 'Hamburguesa Con Tocineta', 24000, 'Con papas', [{ attributeName: 'Término', options: ['Medio', 'Bien Asado'] }]),
    own: product(2002, 'Combo Hamburguesa Con Tocineta', 30000, 'Con papas y bebida personal', [{ attributeName: 'Término', options: ['Medio', 'Bien Asado'] }, drinks]),
    other: product(2003, 'Combo Hamburguesa Con Queso', 29000, 'Con papas y bebida personal', [drinks]),
    base: product(2004, 'Hamburguesa Sencilla', 20000, 'Con papas') },
  { id: 'street food', kept: ['Salsa', 'Tartara'], drink: 'Limonada', order: 'una salchipapa con chorizo con salsa tartara',
    dish: product(2101, 'Salchipapa Con Chorizo', 16000, 'Con papa y chorizo', [{ attributeName: 'Salsa', options: ['Rosada', 'Tartara'] }]),
    own: product(2102, 'Combo Salchipapa Con Chorizo', 21000, 'Con papa, chorizo y bebida', [drinks, { attributeName: 'Salsa', options: ['Rosada', 'Tartara'] }]),
    other: product(2103, 'Combo Salchipapa Con Pollo', 20000, 'Con papa, pollo y bebida', [drinks]),
    base: product(2104, 'Salchipapa Sencilla', 13000, 'Con papa y salchicha') },
];

const attr = (attrs: string[], name: string) => attrs.find(a => a.startsWith(`${name}:`))?.split(':')[1];

describe.each(menus)('$id: a drink question lists every related combo', m => {
  describe.each([false, true])('agent %s', agent => {
    const start = async (order = m.order) => {
      const h = harness([m.dish, m.own, m.other, m.base] as never, agent);
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      await h.send(order);
      return h;
    };

    it('lists the dish’s own combo first and the other combo too', async () => {
      const h = await start();
      expect(h.cartRows().map(r => r.id)).toEqual([m.dish.id]);
      const reply = (await h.send('eso lleva bebida?'))!;
      expect(reply).toContain(m.own.name);
      expect(reply).toContain(m.other.name);
      expect(reply.indexOf(m.own.name)).toBeLessThan(reply.indexOf(m.other.name));
      expect(reply).toContain(`cambiarlo a *${m.own.name}*`);
      expect(h.cartRows().map(r => r.id)).toEqual([m.dish.id]);
    });

    it('a drink name takes the own combo and keeps the dish’s choice', async () => {
      const h = await start();
      await h.send('eso lleva bebida?');
      await h.send(m.drink.toLowerCase());
      const rows = h.cartRows();
      expect(rows.map(r => r.id)).toEqual([m.own.id]);
      expect(attr(rows[0].attrs, 'Bebida')).toBe(m.drink);
      expect(attr(rows[0].attrs, m.kept[0])).toBe(m.kept[1]);
    });

    it('«sí» takes the own combo, keeps the dish’s choice and asks only the drink', async () => {
      const h = await start();
      await h.send('eso lleva bebida?');
      await h.send('si');
      expect(h.conv.sessionData.pendingAttribute?.productId).toBe(m.own.id);
      expect(h.conv.sessionData.pendingAttribute?.selected).toEqual([{ attributeName: m.kept[0], attributeValue: m.kept[1] }]);
      await h.send(m.drink.toLowerCase());
      const rows = h.cartRows();
      expect(rows.map(r => r.id)).toEqual([m.own.id]);
      expect(attr(rows[0].attrs, 'Bebida')).toBe(m.drink);
      expect(attr(rows[0].attrs, m.kept[0])).toBe(m.kept[1]);
    });

    it('the number of the other combo replaces the dish with that combo', async () => {
      const h = await start();
      await h.send('eso lleva bebida?');
      await h.send('2');
      const rows = h.cartRows();
      const chosen = h.conv.sessionData.pendingAttribute?.productId ?? rows[0]?.id;
      expect(chosen).toBe(m.other.id);
      expect(rows.map(r => r.id)).not.toContain(m.own.id);
    });

    it('declining keeps the dish', async () => {
      const h = await start();
      await h.send('eso lleva bebida?');
      await h.send('no');
      expect(h.cartRows().map(r => r.id)).toEqual([m.dish.id]);
      expect(h.conv.sessionData.pendingMatch ?? null).toBeNull();
    });

    it('contrast: a dish without a single own combo does not swap on a bare «sí»', async () => {
      const h = await start(`un ${m.base.name.toLowerCase()}`);
      expect(h.cartRows().map(r => r.id)).toEqual([m.base.id]);
      const reply = (await h.send('eso lleva bebida?'))!;
      expect(reply).not.toContain('cambiarlo a');
      await h.send('si');
      expect(h.cartRows().map(r => r.id)).toEqual([m.base.id]);
    });
  });
});
