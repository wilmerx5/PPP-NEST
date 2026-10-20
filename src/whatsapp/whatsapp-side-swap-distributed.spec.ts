import { harness } from './whatsapp-accuracy.test-support';

type Family = {
  id: string;
  main: string;
  mains: string;
  mainAttr?: { name: string; options: string[] };
  sideA: string;
  sideB: string;
  big: string;
  small: string;
  smalls: string;
  smallAttr: string;
  opt1: string;
  opt2: string;
  other: string;
  one: string;
  bigSplit?: boolean;
};

const families: Family[] = [
  {
    id: 'fish', main: 'Mojarra', mains: 'mojarras', mainAttr: { name: 'Seleccion', options: ['Frita', 'Asada'] },
    sideA: 'papa salada', sideB: 'papa francesa', big: 'Sopa', small: 'Sopa pequeña', smalls: 'sopas pequeñas',
    smallAttr: 'Sopa', opt1: 'Ajiaco', opt2: 'Menudencias', other: 'Churrasco', one: 'una', bigSplit: true,
  },
  {
    id: 'burger', main: 'Hamburguesa', mains: 'hamburguesas',
    sideA: 'aros de cebolla', sideB: 'ensalada de repollo', big: 'Malteada', small: 'Malteada mini', smalls: 'malteadas mini',
    smallAttr: 'Sabor', opt1: 'Fresa', opt2: 'Vainilla', other: 'Salchipapa', one: 'una',
  },
  {
    id: 'arepa', main: 'Bandeja', mains: 'bandejas', mainAttr: { name: 'Carne', options: ['Res', 'Cerdo'] },
    sideA: 'yuca cocida', sideB: 'patacon', big: 'Tamal', small: 'Tamal mini', smalls: 'tamales mini',
    smallAttr: 'Estilo', opt1: 'Tolimense', opt2: 'Santandereano', other: 'Empanada', one: 'uno',
  },
];

const cap = (s: string) => s.replace(/(^|\s)(\p{L})/gu, (_m, sp, c) => sp + c.toUpperCase());

const menuOf = (f: Family, withSides: boolean) => [
  {
    id: 1, code: 1, name: f.main, price: 29500, availableNow: true,
    hasAttributes: !!f.mainAttr,
    attributes: f.mainAttr ? [{ attributeName: f.mainAttr.name, options: f.mainAttr.options }] : [],
  },
  { id: 2, code: 2, name: f.other, price: 31000, availableNow: true, hasAttributes: false, attributes: [] },
  ...(f.bigSplit
    ? [f.opt1, f.opt2].map((opt, i) => ({ id: 5 + i, code: 5 + i, name: `${f.big} De ${opt}`, price: 12000, availableNow: true, hasAttributes: false, attributes: [] }))
    : [{ id: 3, code: 3, name: f.big, price: 12000, availableNow: true, hasAttributes: true, attributes: [{ attributeName: f.smallAttr, options: [f.opt1, f.opt2] }] }]),
  { id: 4, code: 4, name: f.small, price: 7500, availableNow: true, hasAttributes: true, attributes: [{ attributeName: f.smallAttr, options: [f.opt1, f.opt2] }] },
  ...(withSides
    ? [
      { id: 8, code: 8, name: `Porcion De ${cap(f.sideA)}`, price: 7000, availableNow: true, hasAttributes: false, attributes: [] },
      { id: 9, code: 9, name: `Porcion De ${cap(f.sideB)}`, price: 7000, availableNow: true, hasAttributes: false, attributes: [] },
    ]
    : []),
];

const lines = (h: ReturnType<typeof harness>) =>
  h.conv.sessionData.cart.map((l: any) => ({
    name: l.name as string,
    qty: l.quantity as number,
    attr: ((l.attributes || []) as any[]).map(a => a.attributeValue).join('/'),
    note: (l.note || '') as string,
  }));

const art = (f: Family) => (f.one === 'uno' ? 'un' : 'una');
const pref = (f: Family) => (f.mainAttr ? ` ${f.mainAttr.options[0].toLowerCase()}` : '');

function expectSwap(h: ReturnType<typeof harness>, f: Family, note: RegExp) {
  const cart = lines(h);
  const main = cart.filter(l => l.name === f.main);
  expect(main).toHaveLength(1);
  expect(main[0].qty).toBe(2);
  expect(main[0].note).toMatch(note);
  expect(cart.filter(l => /^Porcion/.test(l.name))).toEqual([]);
}

const swapNote = (f: Family) => new RegExp(`sin ${f.sideB}.*con ${f.sideA}`, 'i');

describe.each(families)('$id: side swap and distributed attribute without colon', f => {
  describe.each([false, true])('side portions on menu %s', withSides => {
    describe.each([false, true])('agent %s', agent => {
      const rig = () => harness(menuOf(f, withSides) as never, agent);

      it('«dos X a cambio de la A, B» → B replaced by A, no separate portion', async () => {
        const h = rig();
        await h.sendQueued(`dos ${f.mains}${pref(f)} a cambio de la ${f.sideA}, ${f.sideB}`);
        expectSwap(h, f, swapNote(f));
      });

      it('«dos X con A en vez de B» → same note', async () => {
        const h = rig();
        await h.sendQueued(`dos ${f.mains}${pref(f)} con ${f.sideA} en vez de ${f.sideB}`);
        expectSwap(h, f, swapNote(f));
      });

      it('«dos X cambiando la B por A» → same note', async () => {
        const h = rig();
        await h.sendQueued(`dos ${f.mains}${pref(f)} cambiando la ${f.sideB} por ${f.sideA}`);
        expectSwap(h, f, swapNote(f));
      });

      it('«dos X a cambio de A» (single side) → note «con A»', async () => {
        const h = rig();
        await h.sendQueued(`dos ${f.mains}${pref(f)} a cambio de ${f.sideA}`);
        expectSwap(h, f, new RegExp(`con ${f.sideA}`, 'i'));
      });

      it.each(['', ','])('«dos <small plural>%s una de o1 y una de o2» → one of each small', async comma => {
        const h = rig();
        await h.sendQueued(`dos ${f.smalls}${comma} ${f.one} de ${f.opt1.toLowerCase()} y ${f.one} de ${f.opt2.toLowerCase()}`);
        expect(lines(h).map(l => [l.name, l.qty, l.attr])).toEqual([[f.small, 1, f.opt1], [f.small, 1, f.opt2]]);
      });

      it('«una <small> de o1 y una de o2» (ellipsis) → one of each small', async () => {
        const h = rig();
        await h.sendQueued(`${art(f)} ${f.small.toLowerCase()} de ${f.opt1.toLowerCase()} y ${f.one} de ${f.opt2.toLowerCase()}`);
        expect(lines(h).map(l => [l.name, l.qty, l.attr])).toEqual([[f.small, 1, f.opt1], [f.small, 1, f.opt2]]);
      });

      it.each(['quiero','uiero'])('full message %s: swap + distributed smalls + address', async verb => {
        const h = rig();
        (h.conv as any).customerName = '';
        await h.sendQueued(
          `${verb} dos ${f.mains}${verb === 'uiero' ? '' : pref(f)} a cambio de la ${f.sideA}, ${f.sideB}, dos ${f.smalls} ${f.one} de ${f.opt1.toLowerCase()} y ${f.one} de ${f.opt2.toLowerCase()}, para la cll 9 12b 34`,
        );
        expectSwap(h, f, swapNote(f));
        const smalls = lines(h).filter(l => l.name === f.small).map(l => [l.qty, l.attr]).sort();
        expect(smalls).toEqual([[1, f.opt1], [1, f.opt2]].sort());
        expect(lines(h).some(l => l.name.startsWith(`${f.big} De`) || l.name === f.big)).toBe(false);
        expect((h.conv as any).customerName || '').toBe('');
      });

      it('contrast: «una <big> de o1 y una de o2» stays on the big product', async () => {
        const h = rig();
        await h.sendQueued(`${art(f)} ${f.big.toLowerCase()} de ${f.opt1.toLowerCase()} y ${f.one} de ${f.opt2.toLowerCase()}`);
        expect(lines(h).map(l => [l.name, l.qty, l.attr])).toEqual(f.bigSplit
          ? [[`${f.big} De ${f.opt1}`, 1, ''], [`${f.big} De ${f.opt2}`, 1, '']]
          : [[f.big, 1, f.opt1], [f.big, 1, f.opt2]]);
      });

      it('contrast: «dos <small plural>» is not taken as the customer name', async () => {
        const h = rig();
        (h.conv as any).customerName = '';
        await h.sendQueued(`dos ${f.smalls} ${f.one} de ${f.opt1.toLowerCase()} y ${f.one} de ${f.opt2.toLowerCase()}, para la cll 9 12b 34`);
        expect((h.conv as any).customerName || '').toBe('');
      });

      it('contrast: «cambia el X por un Y» with X in cart is still a dish swap', async () => {
        const h = rig();
        h.conv.sessionData.cart = [{ productId: 2, name: f.other, quantity: 1, unitPrice: 31000 }] as never;
        (h.conv as any).state = 'building_cart';
        await h.sendQueued(`cambia el ${f.other.toLowerCase()} por una ${f.main.toLowerCase()}${pref(f)}`);
        expect(lines(h).map(l => [l.name, l.qty, l.attr])).toEqual([[f.main, 1, f.mainAttr?.options[0] ?? '']]);
      });

      it('contrast: «sin B» alone adds nothing', async () => {
        const h = rig();
        await h.sendQueued(`sin ${f.sideB}`);
        expect(lines(h)).toEqual([]);
      });
    });
  });
});
