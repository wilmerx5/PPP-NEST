import { harness } from './whatsapp-accuracy.test-support';

type Family = {
  id: string;
  dish: string;
  dishPlain: string;
  optioned: string;
  attr: string;
  options: [string, string];
  low: [string, string, string];
  pair: [string, string];
};

const families: Family[] = [
  { id: 'rotisserie', dish: 'Bandeja Paisa', dishPlain: 'la bandeja paisa', optioned: 'Mojarra', attr: 'Seleccion', options: ['Frita', 'Asada'], low: ['Arepa Sola', 'Gaseosa', 'Tinto'], pair: ['Pollo Asado', 'Pollo Broaster'] },
  { id: 'burger', dish: 'Hamburguesa Doble', dishPlain: 'la hamburguesa doble', optioned: 'Malteada', attr: 'Sabor', options: ['Fresa', 'Vainilla'], low: ['Papas', 'Agua', 'Salsa Extra'], pair: ['Perro Sencillo', 'Perro Especial'] },
  { id: 'pizzeria', dish: 'Lasagna Bolognesa', dishPlain: 'la lasagna bolognesa', optioned: 'Pizza Familiar', attr: 'Sabor', options: ['Hawaiana', 'Pepperoni'], low: ['Pan De Ajo', 'Limonada', 'Brownie'], pair: ['Calzone Pollo', 'Calzone Carne'] },
];

const menuOf = (f: Family) => [
  ...f.low.map((name, i) => ({ id: i + 1, code: i + 1, name, price: 3000 + i * 1000, availableNow: true, hasAttributes: false, attributes: [] })),
  { id: 40, code: 40, name: f.dish, price: 32000, availableNow: true, hasAttributes: false, attributes: [] },
  { id: 41, code: 41, name: f.optioned, price: 29000, availableNow: true, hasAttributes: true, attributes: [{ attributeName: f.attr, options: f.options }] },
  { id: 42, code: 42, name: f.pair[0], price: 25000, availableNow: true, hasAttributes: false, attributes: [] },
  { id: 43, code: 43, name: f.pair[1], price: 27000, availableNow: true, hasAttributes: false, attributes: [] },
];

const rows = (h: ReturnType<typeof harness>) => h.conv.sessionData.cart.map((l: any) => [l.name, l.quantity]);

describe.each(families)('$id: a bare number after a quote is a quantity, not a code', f => {
  describe.each([false, true])('agent %s', agent => {
    const rig = () => harness(menuOf(f) as never, agent);

    it.each([['2', 2], ['dos', 2], ['3 porfa', 3], ['1', 1]])('«¿cuánto vale X?» → «%s» adds X ×%s', async (answer, qty) => {
      const h = rig();
      await h.sendQueued(`cuánto vale ${f.dishPlain}?`);
      await h.sendQueued(answer as string);
      expect(rows(h)).toEqual([[f.dish, qty]]);
    });

    it('«qué trae X?» → «2» adds X ×2', async () => {
      const h = rig();
      await h.sendQueued(`qué trae ${f.dishPlain}?`);
      await h.sendQueued('2');
      expect(rows(h)).toEqual([[f.dish, 2]]);
    });

    it('price of a dish with options → «2» takes that dish ×2', async () => {
      const h = rig();
      await h.sendQueued(`qué precio tiene ${f.optioned.toLowerCase()}`);
      await h.sendQueued('2');
      expect(rows(h)).toEqual([[f.optioned, 2]]);
    });

    it('contrast: «¿cuánto vale X?» → «sí» still adds one X', async () => {
      const h = rig();
      await h.sendQueued(`cuánto vale ${f.dishPlain}?`);
      await h.sendQueued('sí');
      expect(rows(h)).toEqual([[f.dish, 1]]);
    });

    it('contrast: after the greeting («dime el plato o el código») «2» is still code 2', async () => {
      const h = rig();
      await h.sendQueued('hola');
      await h.sendQueued('2');
      expect(rows(h)).toEqual([[f.low[1], 1]]);
    });

    it('contrast: with a two-row list open, «2» picks the second row', async () => {
      const h = rig();
      h.conv.sessionData.pendingMatch = {
        query: f.pair[0].split(' ')[0].toLowerCase(), intent: 'order',
        candidates: [42, 43].map(id => { const p = menuOf(f).find(x => x.id === id)!; return { id: p.id, code: p.code, name: p.name, price: p.price }; }),
      } as never;
      await h.sendQueued('2');
      expect(rows(h)).toEqual([[f.pair[1], 1]]);
    });

    it('contrast: «2» after adding X with «¿Algo más?» does not add code 2', async () => {
      const h = rig();
      await h.sendQueued(`una ${f.dishPlain.replace(/^la\s+/, '')}`);
      await h.sendQueued('2');
      expect(rows(h).some(([name]) => name === f.low[1])).toBe(false);
    });
  });
});
