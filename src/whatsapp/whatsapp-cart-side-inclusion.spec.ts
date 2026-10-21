import { harness } from './whatsapp-accuracy.test-support';

type Menu = {
  id: string;
  main: string; mainRef: string; description: string; included: [string, string]; head: string;
  other: string; otherRef: string; otherDescription: string;
  sides: [string, string]; extra: string; extraAsk: string;
  values: [string, string];
};

const menus: Menu[] = [
  { id: 'chicken-combos', main: 'Combo Pollo Dorado', mainRef: 'combo de pollo', description: 'Acompañado con papa criolla, arroz blanco y ensalada',
    included: ['papa criolla', 'arroz'], head: 'papa', other: 'Costilla BBQ', otherRef: 'costilla', otherDescription: 'Acompañado con papa rustica y mazorca',
    sides: ['Porcion Papa Criolla', 'Porcion Papa Rustica'], extra: 'Porcion Yuca', extraAsk: 'yuca', values: ['Limonada', 'Gaseosa'] },
  { id: 'burger-menus', main: 'Menu Burger Clasica', mainRef: 'burger', description: 'Incluye aros de cebolla, pepinillos y salsa de la casa',
    included: ['aros de cebolla', 'pepinillos'], head: 'aros', other: 'Hot Dog Especial', otherRef: 'hot dog', otherDescription: 'Incluye papas fritas y salsa de queso',
    sides: ['Aros De Cebolla', 'Aros De Calamar'], extra: 'Ensalada Verde', extraAsk: 'ensalada', values: ['Soda', 'Agua'] },
  { id: 'pasta-plates', main: 'Plato Pasta Napolitana', mainRef: 'plato de pasta', description: 'Trae pan de ajo, queso rallado y aceitunas',
    included: ['pan de ajo', 'queso'], head: 'pan', other: 'Lasagna De Carne', otherRef: 'lasagna', otherDescription: 'Trae pan integral y aceitunas',
    sides: ['Pan De Ajo', 'Pan Integral'], extra: 'Sopa Del Dia', extraAsk: 'sopa', values: ['Vino', 'Te'] },
];

const menuOf = (m: Menu) => [
  { id: 800, code: 40, name: m.main, price: 30000, categoryName: 'Platos fuertes', availableNow: true, hasAttributes: true, description: m.description,
    attributes: [{ attributeName: 'Bebida', options: m.values }] },
  { id: 801, code: 41, name: m.other, price: 34000, categoryName: 'Platos fuertes', availableNow: true, hasAttributes: true, description: m.otherDescription,
    attributes: [{ attributeName: 'Bebida', options: m.values }] },
  ...[...m.sides, m.extra].map((name, i) => ({ id: 820 + i, code: 60 + i, name, price: 7000 + i * 500, categoryName: 'Acompañamientos', availableNow: true, hasAttributes: false, attributes: [] })),
  { id: 830, code: 70, name: 'Agua Mineral', price: 5000, categoryName: 'Bebidas', availableNow: true, hasAttributes: false, attributes: [] },
];

const rows = (h: ReturnType<typeof harness>) => h.conv.sessionData.cart.map((l: any) => [l.name, l.quantity]);

describe.each(menus)('$id: side questions and sides attached to a cart dish', m => {
  describe.each([false, true])('agent %s', agent => {
    const rig = async (dishes: string[] = [m.main]) => {
      const h = harness(menuOf(m) as never, agent);
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      (h.service as any).ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
      for (const dish of dishes) await h.sendQueued(`quiero un ${dish.toLowerCase()}`);
      expect(rows(h)).toEqual(dishes.map(dish => [dish, 1]));
      return h;
    };

    it.each([
      () => `Ese viene con ${m.included[0]} ?`,
      () => `trae ${m.head}?`,
      () => `el ${m.mainRef} trae ${m.included[1]}?`,
      () => `y viene con ${m.included[1]}?`,
    ])('an included side asked about the cart dish gets a yes, not the side card (%#)', async ask => {
      const h = await rig();
      const reply = String(await h.sendQueued(ask()));
      expect(reply).toMatch(new RegExp(`^Sí ✅ \\*${m.main}\\* trae `));
      expect(reply).toContain(m.description.replace(/^\S+(?: con)? /, ''));
      expect(reply).not.toContain(`*${m.sides[0]}* ·`);
      expect(rows(h)).toEqual([[m.main, 1]]);
      expect(h.conv.sessionData.pendingMatch).toBeFalsy();
    });

    it('a side the dish does not include gets a no and the separate side with its price', async () => {
      const h = await rig();
      const asked = m.sides[1].toLowerCase().replace(/^porcion /, '');
      const reply = String(await h.sendQueued(`viene con ${asked}?`));
      expect(reply).toMatch(new RegExp(`^No, \\*${m.main}\\* no trae ${asked}\\.`));
      expect(reply).toContain(`Si la quieres aparte: *${m.sides[1]}*`);
      expect(rows(h)).toEqual([[m.main, 1]]);
    });

    it('an unlisted menu side also gets a no with that side offered apart', async () => {
      const h = await rig();
      const reply = String(await h.sendQueued(`trae ${m.extraAsk}?`));
      expect(reply).toMatch(/^No, /);
      expect(reply).toContain(`*${m.extra}*`);
      expect(rows(h)).toEqual([[m.main, 1]]);
    });

    it('with two dishes the named one is answered and a bare question is left to the general flow', async () => {
      const h = await rig([m.main, m.other]);
      const named = String(await h.sendQueued(`la ${m.otherRef} trae ${m.included[0]}?`));
      expect(named).toMatch(new RegExp(`^No, \\*${m.other}\\* no trae `));
      const bare = String(await h.sendQueued(`ese trae ${m.included[0]}?`));
      expect(bare).not.toMatch(/^(?:Sí ✅|No, )\*/);
      expect(rows(h)).toEqual([[m.main, 1], [m.other, 1]]);
    });

    it('the question inside checkout answers and keeps the checkout step', async () => {
      const h = await rig();
      await h.sendQueued('no');
      const state = h.conv.state;
      expect(state).toMatch(/^awaiting_/);
      const reply = String(await h.sendQueued(`Ese viene con ${m.included[0]} ?`));
      expect(reply).toMatch(/^Sí ✅/);
      expect(h.conv.state).toBe(state);
      expect(rows(h)).toEqual([[m.main, 1]]);
    });

    it('contrast: a loose description is not enough to deny a side', async () => {
      const menu = menuOf(m).map(p => p.id === 800 ? { ...p, description: `Con ${m.included[0]}` } : p);
      const h = harness(menu as never, agent);
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      await h.sendQueued(`quiero un ${m.main.toLowerCase()}`);
      const confirmed = String(await h.sendQueued(`ese trae ${m.included[0]}?`));
      expect(confirmed).toContain(m.included[0]);
      expect(confirmed).not.toMatch(/^No, /);
      const denied = String(await h.sendQueued(`trae ${m.extraAsk}?`));
      expect(denied).not.toMatch(/^No, /);
      expect(rows(h)).toEqual([[m.main, 1]]);
    });

    it('contrast: with an empty cart the question is not answered as a cart dish', async () => {
      const h = harness(menuOf(m) as never, agent);
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      const reply = String(await h.sendQueued(`trae ${m.included[0]}?`));
      expect(reply).not.toMatch(/^(?:Sí ✅|No, )\*/);
      expect(rows(h)).toEqual([]);
    });

    it(`«Bueno dame una porción de ${m.head} con el ${m.mainRef}» lists the sides and keeps the dish`, async () => {
      const h = await rig();
      const reply = String(await h.sendQueued(`Bueno dame una porción de ${m.head} con el ${m.mainRef}`));
      expect(reply).toContain('sigue en el carrito');
      expect(h.conv.sessionData.pendingMatch?.candidates.map((c: any) => c.name)).toEqual(m.sides);
      expect(reply).not.toContain(`*${m.other}*`);
      expect(rows(h)).toEqual([[m.main, 1]]);
      await h.sendQueued('2');
      expect(rows(h)).toEqual([[m.main, 1], [m.sides[1], 1]]);
    });

    it('a fully named side with the cart dish as reference is added at once', async () => {
      const h = await rig();
      const side = m.sides[0].toLowerCase().replace(/^porcion /, '');
      const reply = String(await h.sendQueued(`dame una porción de ${side} con el ${m.mainRef} por favor`));
      expect(reply).toContain(`*${m.sides[0]}*`);
      expect(rows(h)).toEqual([[m.main, 1], [m.sides[0], 1]]);
    });

    it('contrast: a reference that is not in the cart does not use the cart-dish path', async () => {
      const h = await rig();
      const reply = String(await h.sendQueued(`dame una porción de ${m.head} con la ${m.otherRef}`));
      expect(reply).not.toContain('sigue en el carrito');
      expect(rows(h).slice(0, 1)).toEqual([[m.main, 1]]);
    });

    it('contrast: a drink question stays with the drink answer', async () => {
      const h = await rig();
      const reply = String(await h.sendQueued('trae gaseosa?'));
      expect(reply).not.toMatch(/^(?:Sí ✅|No, )\*.*Viene con/);
      expect(rows(h)).toEqual([[m.main, 1]]);
    });
  });
});
