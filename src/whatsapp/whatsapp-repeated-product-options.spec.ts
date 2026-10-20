import { harness } from './whatsapp-accuracy.test-support';

type Family = {
  id: string;
  big: string;
  bigs: string;
  small: string;
  attr: string;
  options: [string, string, string];
  other: string;
  one: 'un' | 'una';
};

const families: Family[] = [
  { id: 'soups', big: 'Sopa', bigs: 'sopas', small: 'Sopa pequeña', attr: 'Sopa', options: ['Ajiaco', 'Menudencias', 'Pasta'], other: 'Churrasco', one: 'una' },
  { id: 'juices', big: 'Jugo', bigs: 'jugos', small: 'Jugo pequeño', attr: 'Fruta', options: ['Mora', 'Lulo', 'Mango'], other: 'Empanada', one: 'un' },
  { id: 'pizzas', big: 'Pizza', bigs: 'pizzas', small: 'Pizza personal', attr: 'Sabor', options: ['Hawaiana', 'Pepperoni', 'Vegetariana'], other: 'Lasagna', one: 'una' },
];

const menuOf = (f: Family) => [
  { id: 1, code: 1, name: f.big, price: 12000, availableNow: true, hasAttributes: true, attributes: [{ attributeName: f.attr, options: f.options }] },
  { id: 2, code: 2, name: f.small, price: 7000, availableNow: true, hasAttributes: true, attributes: [{ attributeName: f.attr, options: f.options }] },
  { id: 3, code: 3, name: f.other, price: 15000, availableNow: true, hasAttributes: false, attributes: [] },
];

const rows = (h: ReturnType<typeof harness>) =>
  h.conv.sessionData.cart.map((l: any) => [l.name, l.quantity, ((l.attributes || []) as any[]).map(a => a.attributeValue).join('/')]);

describe.each(families)('$id: same product with different options in one message', f => {
  const [a, b, c] = f.options;
  const low = (s: string) => s.toLowerCase();
  describe.each([false, true])('agent %s', agent => {
    const rig = () => harness(menuOf(f) as never, agent);

    it('«1 X de A y 1 X de B» → two lines', async () => {
      const h = rig();
      await h.sendQueued(`1 ${low(f.big)} de ${low(a)} y 1 ${low(f.big)} de ${low(b)}`);
      expect(rows(h)).toEqual([[f.big, 1, a], [f.big, 1, b]]);
    });

    it('«una X de A y una X de B» → two lines', async () => {
      const h = rig();
      await h.sendQueued(`${f.one} ${low(f.big)} de ${low(a)} y ${f.one} ${low(f.big)} de ${low(b)}`);
      expect(rows(h)).toEqual([[f.big, 1, a], [f.big, 1, b]]);
    });

    it('«1 X de A, 1 X de B y 1 X de C» → three lines', async () => {
      const h = rig();
      await h.sendQueued(`1 ${low(f.big)} de ${low(a)}, 1 ${low(f.big)} de ${low(b)} y 1 ${low(f.big)} de ${low(c)}`);
      expect(rows(h)).toEqual([[f.big, 1, a], [f.big, 1, b], [f.big, 1, c]]);
    });

    it('«1 <small> de A y 1 <small> de B» keeps the small size on both lines', async () => {
      const h = rig();
      await h.sendQueued(`1 ${low(f.small)} de ${low(a)} y 1 ${low(f.small)} de ${low(b)}`);
      expect(rows(h)).toEqual([[f.small, 1, a], [f.small, 1, b]]);
    });

    it('«2 Xs de A y 1 X de B» → quantities per line, and the reply says ×2 only once', async () => {
      const h = rig();
      const reply = await h.sendQueued(`2 ${f.bigs} de ${low(a)} y 1 ${low(f.big)} de ${low(b)}`);
      expect(rows(h)).toEqual([[f.big, 2, a], [f.big, 1, b]]);
      expect((reply || '').match(/×2/g) || []).toHaveLength(1);
    });

    it('with A already in the cart, «1 X de B y 1 X de C» adds both', async () => {
      const h = rig();
      h.conv.sessionData.cart = [{ productId: 1, name: f.big, quantity: 1, unitPrice: 12000, attributes: [{ attributeName: f.attr, attributeValue: a }] }] as never;
      (h.conv as any).state = 'building_cart';
      await h.sendQueued(`1 ${low(f.big)} de ${low(b)} y 1 ${low(f.big)} de ${low(c)}`);
      expect(rows(h)).toEqual([[f.big, 1, a], [f.big, 1, b], [f.big, 1, c]]);
    });

    it('contrast: «1 X de A y 1 <other>» → two different products', async () => {
      const h = rig();
      await h.sendQueued(`1 ${low(f.big)} de ${low(a)} y 1 ${low(f.other)}`);
      expect(rows(h)).toEqual([[f.big, 1, a], [f.other, 1, '']]);
    });

    it('contrast: «1 X de A» alone still asks the size instead of guessing', async () => {
      const h = rig();
      const reply = await h.sendQueued(`1 ${low(f.big)} de ${low(a)}`);
      if (rows(h).length) expect(rows(h)).toEqual([[f.big, 1, a]]);
      else if (!agent) {
        expect(reply).toContain(f.small);
        expect(reply).toContain(`*${f.big}*`);
      }
    });

    it('contrast: «1 <small> de A» alone keeps the small size', async () => {
      const h = rig();
      await h.sendQueued(`1 ${low(f.small)} de ${low(a)}`);
      expect(rows(h)).toEqual([[f.small, 1, a]]);
    });
  });
});
