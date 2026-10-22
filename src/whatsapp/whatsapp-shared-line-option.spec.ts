import { harness } from './whatsapp-accuracy.test-support';
import { WhatsappCatalogService } from './whatsapp-catalog.service';

type Attribute = { attributeName: string; options: string[] };
type Product = { id: number; code: number; name: string; price: number; categoryName: string; availableNow: boolean; hasAttributes: boolean; attributes: Attribute[] };
type Menu = {
  id: string; a: Product; b: Product; plain: Product; attribute: string;
  order: string; leadOrder: string; picked: string; change: string; changed: string; closingChange: string;
};

const product = (id: number, name: string, price: number, categoryName: string, attributes: Attribute[] = []): Product =>
  ({ id, code: id, name, price, categoryName, availableNow: true, hasAttributes: attributes.length > 0, attributes });

const menus: Menu[] = [
  { id: 'burgers with drink', attribute: 'Bebida',
    a: product(1601, 'Hamburguesa Clasica', 22000, 'Hamburguesas', [{ attributeName: 'Bebida', options: ['Pepsi', 'Uva', 'Ginger'] }]),
    b: product(1602, 'Hamburguesa Doble', 28000, 'Hamburguesas', [{ attributeName: 'Bebida', options: ['Pepsi', 'Uva', 'Ginger'] }]),
    plain: product(1603, 'Papas Fritas', 6000, 'Adicionales'),
    order: 'me das una hamburguesa clasica y una hamburguesa doble con uva las dos',
    leadOrder: 'una hamburguesa clasica y una hamburguesa doble, las dos con uva', picked: 'Uva',
    change: 'quiero que la gaseosa de las dos sea ginger', changed: 'Ginger',
    closingChange: 'nada mas pero quiero que la gaseosa de las dos sea ginger' },
  { id: 'pizzas with crust', attribute: 'Borde',
    a: product(1701, 'Pizza Hawaiana', 32000, 'Pizzas', [{ attributeName: 'Borde', options: ['Tradicional', 'Queso'] }]),
    b: product(1702, 'Pizza Pepperoni', 34000, 'Pizzas', [{ attributeName: 'Borde', options: ['Tradicional', 'Queso'] }]),
    plain: product(1703, 'Gaseosa Personal', 4000, 'Bebidas'),
    order: 'una pizza hawaiana y una pizza pepperoni con borde de queso las dos',
    leadOrder: 'una pizza hawaiana y una pizza pepperoni, ambas con borde de queso', picked: 'Queso',
    change: 'que el borde de las dos sea tradicional', changed: 'Tradicional',
    closingChange: 'eso es todo, pero que el borde de ambas sea tradicional' },
  { id: 'street food with sauce', attribute: 'Salsa',
    a: product(1801, 'Salchipapa', 15000, 'Comidas rapidas', [{ attributeName: 'Salsa', options: ['Rosada', 'Tartara', 'Pina'] }]),
    b: product(1802, 'Choripapa', 17000, 'Comidas rapidas', [{ attributeName: 'Salsa', options: ['Rosada', 'Tartara', 'Pina'] }]),
    plain: product(1803, 'Limonada', 5000, 'Bebidas'),
    order: 'una salchipapa y una choripapa con salsa tartara las dos',
    leadOrder: 'una salchipapa y una choripapa, las dos con salsa tartara', picked: 'Tartara',
    change: 'mejor la salsa de las dos rosada', changed: 'Rosada',
    closingChange: 'nada mas y la salsa de las dos rosada' },
];

const other = (m: Menu) => m.a.attributes[0].options.find(option => option !== m.changed)!;
const optionOf = (attrs: string[], attribute: string) => attrs.find(a => a.startsWith(`${attribute}:`))?.split(':')[1];

describe('sharedOrderModifier', () => {
  const catalog = new WhatsappCatalogService({} as never);
  it.each([
    ['un plato a y un plato b en combo con uva los dos', 'en combo con uva'],
    ['un plato a y un plato b, los dos en combo con uva', 'en combo con uva'],
    ['una arepa con queso y una empanada con aji las dos', 'con aji'],
    ['un jugo y un te sin azucar ambos', 'sin azucar'],
    ['un taco, una quesadilla y un burrito con guacamole los tres', 'con guacamole'],
    ['un taco y un burrito, todos con guacamole', 'con guacamole'],
  ])('%s → shared «%s»', (text, shared) => {
    expect(catalog.sharedOrderModifier(text)?.shared).toBe(shared);
    expect(catalog.sharedOrderModifier(text)?.body).not.toMatch(/\b(?:los|las) (?:dos|tres)\b|\bambos\b|\btodos\b/);
  });
  it.each([
    'un plato a y un plato b para los dos',
    'un plato a y un plato b los dos',
    'un plato a con uva los dos',
    'un taco y un burrito con guacamole los tres',
    'quiero los dos',
  ])('%s → no shared modifier', text => {
    expect(catalog.sharedOrderModifier(text)).toBeNull();
  });
});

describe.each(menus)('$id: one option for both lines', m => {
  describe.each([false, true])('agent %s', agent => {
    const line = (p: Product, option: string) => ({ productId: p.id, code: p.code, name: p.name, quantity: 1, unitPrice: p.price,
      attributes: [{ attributeName: m.attribute, attributeValue: option }] });
    const start = (cart: ReturnType<typeof line>[] = []) => {
      const h = harness([m.a, m.b, m.plain] as never, agent);
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      h.conv.sessionData.cart = cart as never;
      return h;
    };

    it.each(['order', 'leadOrder'] as const)('%s: the trailing «los dos / ambas» applies the option to both items', async key => {
      const h = start();
      const reply = (await h.send(m[key]))!;
      expect(reply).not.toMatch(/no manejamos/i);
      const rows = h.cartRows();
      expect(rows.map(r => r.id).sort()).toEqual([m.a.id, m.b.id].sort());
      for (const row of rows) expect(optionOf(row.attrs, m.attribute)).toBe(m.picked);
    });

    it('contrast: two dishes where only the second names an option keep both lines', async () => {
      const h = start();
      await h.send(m.order.replace(/\s+(?:las|los) dos$/, ''));
      const rows = h.cartRows();
      const pending = h.conv.sessionData.pendingAttribute?.productId;
      expect([...rows.map(r => r.id), ...(pending ? [pending] : [])].sort()).toEqual([m.a.id, m.b.id].sort());
      expect(optionOf(rows.find(r => r.id === m.b.id)?.attrs || [], m.attribute)).toBe(m.picked);
    });

    it('each dish keeps the option written next to it', async () => {
      const [first, second] = m.a.attributes[0].options.filter(option => option !== m.picked).concat(m.picked).slice(-2);
      const h = start();
      const name = (p: Product) => p.name.toLowerCase();
      const with_ = (option: string) => m.attribute === 'Bebida' ? `con ${option.toLowerCase()}` : `con ${m.attribute.toLowerCase()} ${option.toLowerCase()}`;
      await h.send(`una ${name(m.a)} ${with_(first)} y una ${name(m.b)} ${with_(second)}`);
      const rows = h.cartRows();
      expect(optionOf(rows.find(r => r.id === m.a.id)!.attrs, m.attribute)).toBe(first);
      expect(optionOf(rows.find(r => r.id === m.b.id)!.attrs, m.attribute)).toBe(second);
    });

    it('a follow-up for both lines changes both and keeps shopping', async () => {
      const h = start([line(m.a, other(m)), line(m.b, other(m))]);
      const reply = (await h.send(m.change))!;
      for (const row of h.cartRows()) expect(optionOf(row.attrs, m.attribute)).toBe(m.changed);
      expect(reply).toContain(m.a.name);
      expect(reply).toContain(m.b.name);
      expect(h.cartRows()).toHaveLength(2);
      expect(h.conv.state).toBe('building_cart');
    });

    it('«nada más pero …» changes both lines and moves on to checkout', async () => {
      const h = start([line(m.a, other(m)), line(m.b, other(m))]);
      await h.send(m.closingChange);
      for (const row of h.cartRows()) expect(optionOf(row.attrs, m.attribute)).toBe(m.changed);
      expect(h.cartRows()).toHaveLength(2);
      expect(h.conv.state).not.toBe('building_cart');
    });

    it('contrast: «los tres» with two matching lines changes nothing', async () => {
      const original = other(m);
      const h = start([line(m.a, original), line(m.b, original)]);
      await h.send(m.change.replace(/\b(?:las|los) dos\b|\bambas\b/, 'los tres'));
      expect(h.cartRows().filter(row => optionOf(row.attrs, m.attribute) === m.changed)).not.toHaveLength(2);
    });

    it('contrast: a line without that option is not touched', async () => {
      const h = start([line(m.a, other(m))]);
      h.conv.sessionData.cart.push({ productId: m.plain.id, code: m.plain.code, name: m.plain.name, quantity: 1, unitPrice: m.plain.price } as never);
      await h.send(m.change);
      const plain = h.cartRows().find(row => row.id === m.plain.id)!;
      expect(plain.attrs).toEqual([]);
    });
  });
});
