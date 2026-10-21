import { harness } from './whatsapp-accuracy.test-support';
import { dedupeKitchenNoteParts } from './whatsapp-product-intent';

type Menu = {
  id: string; family: string; members: [string, string];
  first: [string, string[]]; second: [string, string[]]; drinks: string[];
  alt: string; altProduct: string; drink: string; drinkProduct: string; drinkArticle: string; short: string; note: string; plainNote: string;
};

const menus: Menu[] = [
  { id: 'lunch-plates', family: 'almuerzo', members: ['Almuerzo Res Asada', 'Almuerzo Cerdo Asado'],
    first: ['Porcion', ['Grande', 'Mediana']], second: ['Sopa', ['Pasta', 'Verduras', 'Frijol']], drinks: ['Gaseosa', 'Limonada', 'Jugo De Mora', 'Agua'],
    alt: 'Verduras', altProduct: 'Sopa De Verduras', drink: 'Limonada', drinkProduct: 'Limonada Natural', drinkArticle: 'una', short: 'almuerzo res', note: 'sin azúcar', plainNote: 'sin azucar' },
  { id: 'rice-bowls', family: 'bowl', members: ['Bowl Pollo Oriental', 'Bowl Tofu Oriental'],
    first: ['Base', ['Arroz', 'Quinoa', 'Fideos']], second: ['Salsa', ['Teriyaki', 'Mani', 'Picante']], drinks: ['Agua', 'Soda', 'Te Verde'],
    alt: 'Mani', altProduct: 'Salsa De Mani', drink: 'Soda', drinkProduct: 'Soda Italiana', drinkArticle: 'una', short: 'bowl pollo', note: 'sin hielo', plainNote: 'sin hielo' },
  { id: 'breakfasts', family: 'desayuno', members: ['Desayuno Tipico', 'Desayuno Campesino'],
    first: ['Huevos', ['Pericos', 'Fritos', 'Revueltos']], second: ['Acompañante', ['Arepa', 'Pan', 'Calentado']], drinks: ['Chocolate', 'Cafe', 'Jugo De Naranja'],
    alt: 'Calentado', altProduct: 'Porcion De Calentado', drink: 'Jugo De Naranja', drinkProduct: 'Jugo De Naranja Natural', drinkArticle: 'un', short: 'desayuno tipico', note: 'sin azúcar', plainNote: 'sin azucar' },
];

const menuOf = (m: Menu) => [
  ...m.members.map((name, i) => ({ id: 900 + i, code: 30 + i, name, price: 22000 + i * 1000, categoryName: 'Platos del dia', availableNow: true, hasAttributes: true,
    attributes: [{ attributeName: m.first[0], options: m.first[1] }, { attributeName: m.second[0], options: m.second[1] }, { attributeName: 'Bebida', options: m.drinks }] })),
  { id: 910, code: 40, name: m.altProduct, price: 9000, categoryName: 'Adicionales', availableNow: true, hasAttributes: false, attributes: [] },
  { id: 911, code: 41, name: m.drinkProduct, price: 5000, categoryName: 'Bebidas', availableNow: true, hasAttributes: false, attributes: [] },
];

const rows = (h: ReturnType<typeof harness>) => h.conv.sessionData.cart.map((l: any) => [l.name, l.quantity, (l.attributes || []).map((a: any) => a.attributeValue).sort().join('/'), l.note || '']);
const values = (...v: string[]) => v.sort().join('/');

describe.each(menus)('$id: answers to a pending option and address wording', m => {
  describe.each([false, true])('agent %s', agent => {
    const rig = () => {
      const h = harness(menuOf(m) as never, agent);
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      (h.service as any).ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
      return h;
    };
    // A list pick fills the non-drink options by default and asks only for the drink.
    const toDrinkPrompt = async (h: ReturnType<typeof harness>) => {
      await h.sendQueued(`quiero un ${m.family}`);
      await h.sendQueued('1');
      expect(h.conv.sessionData.pendingAttribute?.productId).toBe(900);
      expect(h.conv.sessionData.pendingAttribute?.selected.map((s: any) => s.attributeValue)).toEqual([m.first[1][0], m.second[1][0]]);
    };

    it(`«${m.alt.toLowerCase()}» at the drink prompt changes the default option instead of adding *${m.altProduct}*`, async () => {
      const h = rig();
      await toDrinkPrompt(h);
      const reply = String(await h.sendQueued(m.alt.toLowerCase()));
      expect(reply).toContain(`${m.second[0]}: ${m.alt}`);
      expect(rows(h)).toEqual([]);
      expect(h.conv.sessionData.pendingAttribute?.selected.map((s: any) => s.attributeValue)).toEqual([m.first[1][0], m.alt]);
      await h.sendQueued(`${m.drink} ${m.note}`);
      expect(rows(h)).toEqual([[m.members[0], 1, values(m.first[1][0], m.alt, m.drink), m.note]]);
    });

    it('a note in the drink answer stays on the dish', async () => {
      const h = rig();
      await toDrinkPrompt(h);
      const reply = String(await h.sendQueued(`${m.drink} ${m.note}`));
      expect(rows(h)).toEqual([[m.members[0], 1, values(m.first[1][0], m.second[1][0], m.drink), m.note]]);
      expect(reply).toContain(m.note);
    });

    it('one answer naming every option, with a note, changes the defaults and keeps the note', async () => {
      const h = rig();
      await toDrinkPrompt(h);
      await h.sendQueued(`${m.first[1][1].toLowerCase()}, ${m.alt.toLowerCase()}, ${m.drink.toLowerCase()} ${m.note}`);
      expect(rows(h)).toEqual([[m.members[0], 1, values(m.first[1][1], m.alt, m.drink), m.note]]);
    });

    it('contrast: a separate purchase at the drink prompt does not change the pending option', async () => {
      const h = rig();
      await toDrinkPrompt(h);
      await h.sendQueued(`y una ${m.altProduct.toLowerCase()} aparte`);
      const pending = h.conv.sessionData.pendingAttribute;
      if (pending) expect(pending.selected.map((s: any) => s.attributeValue)).toEqual([m.first[1][0], m.second[1][0]]);
      expect(rows(h).filter(row => row[0] === m.members[0] && String(row[2]).includes(m.alt))).toEqual([]);
    });

    it('a comma list that names the drink option keeps it inside the dish, not as a separate drink', async () => {
      const h = rig();
      await h.sendQueued(`${m.members[0]}, ${m.first[1][1].toLowerCase()}, ${m.altProduct.toLowerCase()}, ${m.drink} ${m.note}`);
      expect(rows(h)).toEqual([[m.members[0], 1, values(m.first[1][1], m.alt, m.drink), m.note]]);
    });

    it('«<dish> con <soup product> y <drink>» keeps the drink as the dish option', async () => {
      const h = rig();
      await h.sendQueued(`${m.members[0]} con ${m.altProduct.toLowerCase()} y ${m.drink.toLowerCase()}`);
      expect(rows(h).map(row => row.slice(0, 3))).toEqual([[m.members[0], 1, values(m.first[1][0], m.alt, m.drink)]]);
    });

    it('a repeated note in the same burst is kept once', async () => {
      const h = rig();
      await h.sendQueued(`un ${m.members[0].toLowerCase()} ${m.first[1][1].toLowerCase()} ${m.alt.toLowerCase()} ${m.drink.toLowerCase()} ${m.note}\n${m.plainNote}`);
      expect(rows(h)).toEqual([[m.members[0], 1, values(m.first[1][1], m.alt, m.drink), m.note]]);
    });

    it('contrast: a drink ordered with an article stays a separate product', async () => {
      const h = rig();
      await h.sendQueued(`${m.members[0]} y ${m.drinkArticle} ${m.drinkProduct.toLowerCase()}`);
      expect(rows(h).map(row => row[0]).sort()).toEqual([m.drinkProduct, m.members[0]].sort());
    });

    it.each(['Quiero cambiar mi dirección', 'Quiero cambiar mi direction', 'cambiar mi domicilio'])(
      '«%s» during payment asks for the new address and applies it', async ask => {
        const h = rig();
        await h.sendQueued(`un ${m.members[0].toLowerCase()}`);
        await h.sendQueued('no');
        await h.sendQueued('calle 10 # 20-30');
        expect(h.conv.state).toBe('awaiting_payment');
        const reply = String(await h.sendQueued(ask));
        expect(reply).toMatch(/nueva dirección/i);
        expect(h.conv.state).toBe('awaiting_address');
        await h.sendQueued('carrera 45 # 12-10');
        expect(h.conv.sessionData.address).toMatch(/^carrera 45 # 12-10/);
        expect(rows(h)).toHaveLength(1);
      });

    it('contrast: «quiero cambiar mi bebida» is not an address change', async () => {
      const h = rig();
      await h.sendQueued(`un ${m.members[0].toLowerCase()}`);
      await h.sendQueued('no');
      await h.sendQueued('calle 10 # 20-30');
      await h.sendQueued('quiero cambiar mi bebida');
      expect(h.conv.state).not.toBe('awaiting_address');
      expect(h.conv.sessionData.address).toMatch(/^calle 10 # 20-30/);
    });

    it.each([
      ['Me lo envias a la calle 45 # 12-10', 'calle 45 # 12-10'],
      ['me la mandas al conjunto Prados del Norte torre 3 apto 402', 'conjunto Prados del Norte torre 3 apto 402'],
      ['nos lo traes al edificio Mirador apto 301', 'edificio Mirador apto 301'],
    ])('«%s» saves only the destination as the address', async (said, place) => {
        const h = rig();
        await h.sendQueued(`un ${m.members[0].toLowerCase()}`);
        await h.sendQueued('no');
        await h.sendQueued(said);
        expect(h.conv.sessionData.address).toBe(place);
        expect(h.conv.sessionData.orderType).toBe('delivery');
      });
  });
});

describe('dedupeKitchenNoteParts', () => {
  it.each([
    ['Limonada sin azúcar, sin azucar', 'Limonada sin azúcar'],
    ['sin azúcar\nsin azucar', 'sin azúcar'],
    ['harto ají, con quinoa y harto aji', 'con quinoa y harto ají'],
    ['sin cebolla, sin tomate', 'sin cebolla, sin tomate'],
    ['sin hielo', 'sin hielo'],
  ])('%j → %j', (note, expected) => expect(dedupeKitchenNoteParts(note)).toBe(expected));
});
