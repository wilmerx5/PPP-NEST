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

    it.each(['1', '2'])('numeric combo %s asks its drink before replacing the dish', async choice => {
      const h = await start();
      await h.send('eso lleva bebida?');
      const before = structuredClone(h.conv.sessionData.cart);
      const chosen = choice === '1' ? m.own : m.other;
      const response = await h.send(choice);
      expect(h.conv.sessionData.pendingAttribute?.productId).toBe(chosen.id);
      expect(response).toContain('Bebida');
      expect(h.conv.sessionData.cart).toEqual(before);
      if (choice === '1') expect(h.conv.sessionData.pendingAttribute?.selected).toContainEqual({ attributeName: m.kept[0], attributeValue: m.kept[1] });
      await h.send('3');
      const rows = h.cartRows();
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(chosen.id);
      expect(rows[0].qty).toBe(1);
      expect(attr(rows[0].attrs, 'Bebida')).toBe('Uva');
      if (choice === '1') expect(attr(rows[0].attrs, m.kept[0])).toBe(m.kept[1]);
      h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 110, dailyOrderNumber: 110 });
      await h.send('nada mas');
      await h.send('contraentrega');
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      await h.send('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const dto = h.service.ordersService.create.mock.calls[0][0];
      expect(dto.items).toHaveLength(1);
      expect(dto.items[0].productId).toBe(chosen.id);
      expect(JSON.stringify(dto.items[0])).toContain('Uva');
    });

    it.each([
      ['el combo 1 porfa', 'own'],
      ['el combo 2 por favor', 'other'],
      ['la opción 2 gracias', 'other'],
      ['quiero el número 1', 'own'],
    ])('textual selection %s replaces two units without interpreting the row as quantity', async (text, target) => {
      const h = await start(m.order.replace(/^(?:un|una) /, 'dos ') + ' sin cebolla');
      await h.send('eso lleva bebida?');
      const before = structuredClone(h.conv.sessionData.cart);
      const chosen = target === 'own' ? m.own : m.other;
      const reply = await h.send(text);
      expect(reply).toContain('Bebida');
      expect(h.conv.sessionData.pendingAttribute?.productId).toBe(chosen.id);
      expect(h.conv.sessionData.pendingAttribute?.quantity).toBe(2);
      expect(h.conv.sessionData.cart).toEqual(before);
      await h.send('Uva');
      expect(h.cartRows()).toEqual([expect.objectContaining({ id: chosen.id, qty: 2, note: before[0].note })]);
      expect(attr(h.cartRows()[0].attrs, 'Bebida')).toBe('Uva');
      if (target === 'own') expect(attr(h.cartRows()[0].attrs, m.kept[0])).toBe(m.kept[1]);
      h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 112, dailyOrderNumber: 112 });
      await h.send('nada mas');
      await h.send('contraentrega');
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      await h.send('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const dto = h.service.ordersService.create.mock.calls[0][0];
      expect(dto.items.map((i: any) => i.productId)).toEqual([chosen.id, chosen.id]);
      for (const item of dto.items) expect(JSON.stringify(item)).toContain('Uva');
    });

    it('a textual unoffered row does not silently select the preferred combo', async () => {
      const h = await start();
      await h.send('eso lleva bebida?');
      const before = structuredClone(h.conv.sessionData.cart);
      await h.send('el combo 9 porfa');
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
    });

    it.each(['el combo 2 con Uva porfa', 'la opción 2 con Pepsi', 'quiero el número 1 con Uva', 'la opción 2 con bebida Uva'])('selection plus drink: %s', async text => {
      const h = await start(m.order.replace(/^(?:un|una) /, 'dos ') + ' sin cebolla');
      await h.send('eso lleva bebida?');
      const note = h.cartRows()[0].note;
      const chosen = text.includes('1') ? m.own : m.other;
      const drink = text.includes('Pepsi') ? 'Pepsi' : 'Uva';
      const reply = await h.send(text);
      expect(reply).toContain(chosen.name);
      expect(h.cartRows()).toEqual([expect.objectContaining({ id: chosen.id, qty: 2, note })]);
      expect(attr(h.cartRows()[0].attrs, 'Bebida')).toBe(drink);
      if (chosen === m.own) expect(attr(h.cartRows()[0].attrs, m.kept[0])).toBe(m.kept[1]);
      expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
      h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 113, dailyOrderNumber: 113 });
      await h.send('nada mas');
      await h.send('contraentrega');
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      await h.send('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const dto = h.service.ordersService.create.mock.calls[0][0];
      expect(dto.items.map((i: any) => i.productId)).toEqual([chosen.id, chosen.id]);
      for (const item of dto.items) expect(JSON.stringify(item)).toContain(drink);
    });

    it.each(['el combo 9 con Uva', 'el combo 2 con bebida desconocida', 'el combo 2 con Uva y Pepsi'])('invalid compound selection preserves cart: %s', async text => {
      const h = await start();
      await h.send('eso lleva bebida?');
      const before = structuredClone(h.conv.sessionData.cart);
      const reply = await h.send(text);
      expect(reply).toMatch(/opción|bebida|Bebida/);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
      await h.send('el combo 2 con Uva');
      expect(h.cartRows()[0].id).toBe(m.other.id);
      expect(attr(h.cartRows()[0].attrs, 'Bebida')).toBe('Uva');
    });

    it.each(['removed', 'unavailable'])('the selected combo becoming %s never substitutes the preferred one', async kind => {
      const h = await start();
      await h.send('eso lleva bebida?');
      const before = structuredClone(h.conv.sessionData.cart);
      h.service.catalogService.getMenuProducts.mockResolvedValue([
        m.dish, m.own, m.base, ...(kind === 'removed' ? [] : [{ ...m.other, availableNow: false }]),
      ]);
      const reply = await h.send('el combo 2 con Uva');
      expect(reply).toMatch(/no está disponible/i);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
    });

    it('a changed price in the chosen second combo is requoted before applying its drink', async () => {
      const h = await start();
      await h.send('eso lleva bebida?');
      const before = structuredClone(h.conv.sessionData.cart);
      const changed = { ...m.other, price: m.other.price + 2000 };
      h.service.catalogService.getMenuProducts.mockResolvedValue([m.dish, m.own, changed, m.base]);
      const reply = await h.send('el combo 2 con Uva');
      expect(reply).toMatch(/precio.*cambi|cambi.*precio/i);
      expect(h.conv.sessionData.cart).toEqual(before);
      await h.send('el combo 2 con Uva');
      expect(h.cartRows()[0].id).toBe(changed.id);
      expect(h.conv.sessionData.cart[0].unitPrice).toBe(changed.price);
      expect(attr(h.cartRows()[0].attrs, 'Bebida')).toBe('Uva');
    });

    it.each([
      ['dos del combo 2 con Uva', 1, 2, false],
      ['uno de la opción 1 con Uva', 3, 1, true],
      ['dame 3 del combo 2 porfa', 1, 3, false],
    ])('explicit quantity and row: %s', async (text, initial, wanted, own) => {
      const h = await start(m.order.replace(/^(?:un|una) /, `${initial} `) + ' sin cebolla');
      await h.send('eso lleva bebida?');
      const before = structuredClone(h.conv.sessionData.cart);
      const selected = own ? m.own : m.other;
      const reply = await h.send(String(text));
      expect(reply).toContain(selected.name);
      if (!String(text).includes('con Uva')) {
        expect(h.conv.sessionData.cart).toEqual(before);
        expect(h.conv.sessionData.pendingAttribute?.quantity).toBe(wanted);
        await h.send('Uva');
      }
      expect(h.cartRows()).toEqual([expect.objectContaining({ id: selected.id, qty: wanted, note: before[0].note })]);
      expect(attr(h.cartRows()[0].attrs, 'Bebida')).toBe('Uva');
      if (own) expect(attr(h.cartRows()[0].attrs, m.kept[0])).toBe(m.kept[1]);
      h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 114, dailyOrderNumber: 114 });
      await h.send('nada mas');
      await h.send('contraentrega');
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      await h.send('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      expect(h.service.ordersService.create.mock.calls[0][0].items.map((i: any) => i.productId)).toEqual(Array(Number(wanted)).fill(selected.id));
    });

    it.each(['0 del combo 2 con Uva', '-2 del combo 2 con Uva', '31 del combo 2 con Uva', 'dos del combo 9 con Uva'])('invalid quantity or row preserves cart: %s', async text => {
      const h = await start();
      await h.send('eso lleva bebida?');
      const before = structuredClone(h.conv.sessionData.cart);
      await h.send(text);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
    });

    it('quantity survives a price re-quote before choosing the same row again', async () => {
      const h = await start();
      await h.send('eso lleva bebida?');
      const before = structuredClone(h.conv.sessionData.cart);
      const changed = { ...m.other, price: m.other.price + 2000 };
      h.service.catalogService.getMenuProducts.mockResolvedValue([m.dish, m.own, changed, m.base]);
      const reply = await h.send('dos del combo 2 con Uva');
      expect(reply).toMatch(/precio.*cambi|cambi.*precio/i);
      expect(h.conv.sessionData.cart).toEqual(before);
      await h.send('el combo 2 con Uva');
      expect(h.cartRows()).toEqual([expect.objectContaining({ id: changed.id, qty: 2 })]);
      expect(h.conv.sessionData.cart[0].unitPrice).toBe(changed.price);
    });

    it('numeric replacement preserves two units and their kitchen note', async () => {
      const h = await start(m.order.replace(/^(?:un|una) /, 'dos ') + ' sin cebolla');
      expect(h.cartRows()[0].qty).toBe(2);
      expect(h.cartRows()[0].note).toMatch(/sin cebolla/i);
      const before = structuredClone(h.conv.sessionData.cart);
      await h.send('eso lleva bebida?');
      await h.send('1');
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.pendingAttribute?.quantity).toBe(2);
      await h.send('Uva');
      expect(h.cartRows()).toEqual([expect.objectContaining({ id: m.own.id, qty: 2, note: before[0].note })]);
      expect(attr(h.cartRows()[0].attrs, m.kept[0])).toBe(m.kept[1]);
    });

    it.each(['1', 'el combo 1 porfa'])('changed combo price needs approval before asking the drink: %s', async selection => {
      const h = await start();
      await h.send('eso lleva bebida?');
      const before = structuredClone(h.conv.sessionData.cart);
      const changed = { ...m.own, price: m.own.price + 2000 };
      h.service.catalogService.getMenuProducts.mockResolvedValue([m.dish, changed, m.other, m.base]);
      const reply = await h.send(selection);
      expect(reply).toMatch(/precio.*cambi|cambi.*precio/i);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
      await h.send('1');
      expect(h.conv.sessionData.pendingAttribute?.productId).toBe(m.own.id);
      await h.send('Uva');
      expect(h.conv.sessionData.cart).toHaveLength(1);
      expect(h.conv.sessionData.cart[0].unitPrice).toBe(changed.price);
      expect(attr(h.cartRows()[0].attrs, m.kept[0])).toBe(m.kept[1]);
    });

    it('an unoffered number does not choose a combo or a drink', async () => {
      const h = await start();
      await h.send('eso lleva bebida?');
      const before = structuredClone(h.conv.sessionData.cart);
      await h.send('9');
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
    });

    it('a contents question about a numbered option is not a selection', async () => {
      const h = await start();
      await h.send('eso lleva bebida?');
      const before = structuredClone(h.conv.sessionData.cart);
      const reply = await h.send('¿qué trae la opción 2?');
      expect(reply).toContain(m.other.name);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
      await h.send('el combo 1 porfa');
      expect(h.conv.sessionData.pendingAttribute?.productId).toBe(m.own.id);
    });

    it('declining keeps the dish', async () => {
      const h = await start();
      await h.send('eso lleva bebida?');
      await h.send('no');
      expect(h.cartRows().map(r => r.id)).toEqual([m.dish.id]);
      expect(h.conv.sessionData.pendingMatch ?? null).toBeNull();
    });

    it.each(['name', 'phone', 'address'])('keeps a pending drink while storing %s', async field => {
      const h = await start();
      h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 115, dailyOrderNumber: 115 });
      await h.send('eso lleva bebida?');
      await h.send('1');
      const before = structuredClone(h.conv.sessionData.cart);
      const pending = structuredClone(h.conv.sessionData.pendingAttribute);
      expect(pending?.productId).toBe(m.own.id);
      const input = field === 'name' ? 'a nombre de Ana Torres'
        : field === 'phone' ? '3001112233' : 'Carrera 12 #34-56';
      const response = await h.send(input);
      expect(response).toMatch(/Bebida|bebida|Uva/);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.pendingAttribute).toEqual(pending);
      if (field === 'name') expect(h.conv.customerName).toBe('Ana Torres');
      if (field === 'phone') expect(h.conv.sessionData.contactPhone?.replace(/\D/g, '')).toContain('3001112233');
      if (field === 'address') expect(h.conv.sessionData.address).toContain('34-56');
      await h.send('Uva');
      expect(h.cartRows()).toHaveLength(1);
      expect(h.cartRows()[0].id).toBe(m.own.id);
      expect(h.cartRows()[0].qty).toBe(1);
      expect(attr(h.cartRows()[0].attrs, 'Bebida')).toBe('Uva');
      expect(attr(h.cartRows()[0].attrs, m.kept[0])).toBe(m.kept[1]);
      expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      await h.send('nada más');
      if (h.conv.state === 'awaiting_address') await h.send('sí');
      if (h.conv.state === 'awaiting_payment') await h.send('contraentrega');
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      await h.send('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const dto = h.service.ordersService.create.mock.calls[0][0];
      expect(dto.items.map(item => item.productId)).toEqual([m.own.id]);
      expect(dto.customerName).toBe(field === 'name' ? 'Ana Torres' : 'Wilmer');
      if (field === 'phone') expect(dto.phone.replace(/\D/g, '')).toContain('3001112233');
      if (field === 'address') expect(dto.address).toContain('34-56');
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
