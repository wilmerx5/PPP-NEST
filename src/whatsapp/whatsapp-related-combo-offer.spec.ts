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

    it.each(['first', 'last', 'commas', 'counted'])('stores all contact fields with combo and drink: %s', async style => {
      const h = await start(`${m.order} sin cebolla`);
      h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 116, dailyOrderNumber: 116 });
      await h.send('eso lleva bebida?');
      const selection = style === 'counted' ? 'dos del combo 2 con Uva' : 'el combo 2 con Uva';
      const details = 'a nombre de Ana Torres\n3001112233\nCarrera 12 #34-56';
      const input = style === 'last' ? `${details}\n${selection}`
        : style === 'commas' ? `${selection}, ${details.replace(/\n/g, ', ')}` : `${selection}\n${details}`;
      const response = await h.send(input);
      const quantity = style === 'counted' ? 2 : 1;
      expect(h.cartRows()).toHaveLength(1);
      expect(h.cartRows()[0]).toMatchObject({ id: m.other.id, qty: quantity, note: expect.stringMatching(/sin cebolla/i) });
      expect(attr(h.cartRows()[0].attrs, 'Bebida')).toBe('Uva');
      expect(response).toContain(m.other.name);
      expect(h.conv.customerName).toBe('Ana Torres');
      expect(h.conv.sessionData.contactPhone?.replace(/\D/g, '')).toContain('3001112233');
      expect(h.conv.sessionData.address).toContain('34-56');
      expect(h.conv.sessionData.pendingMatch).toBeFalsy();
      expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      await h.send('nada más');
      if (h.conv.state === 'awaiting_address') await h.send('sí');
      if (h.conv.state === 'awaiting_payment') await h.send('contraentrega');
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      await h.send('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const dto = h.service.ordersService.create.mock.calls[0][0];
      expect(dto.items.map(item => item.productId)).toEqual(Array(quantity).fill(m.other.id));
      for (const item of dto.items) {
        expect(item.attributes).toContainEqual({ attributeName: 'Bebida', attributeValue: 'Uva' });
        expect(item.note).toMatch(/sin cebolla/i);
      }
      expect(dto.customerName).toBe('Ana Torres');
      expect(dto.phone.replace(/\D/g, '')).toContain('3001112233');
      expect(dto.address).toContain('34-56');
    });

    it.each(['el combo 9 con Uva', 'el combo 2 con Tamarindo', 'cero del combo 2 con Uva', 'el combo 2 con Uva y Pepsi'])('contact does not authorize an unresolved selection: %s', async raw => {
      const h = await start(`${m.order} sin cebolla`);
      await h.send('eso lleva bebida?');
      const before = structuredClone(h.conv.sessionData.cart);
      // Numeric zero uses the same quantity validation as a standalone choice.
      const selection = raw.replace(/^cero /, '0 ');
      const response = await h.send(`${selection}\na nombre de Ana Torres\n3001112233\nCarrera 12 #34-56`);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.pendingMatch?.replacement).toBeTruthy();
      expect(h.conv.customerName).toBe('Ana Torres');
      expect(h.conv.sessionData.contactPhone?.replace(/\D/g, '')).toContain('3001112233');
      expect(h.conv.sessionData.address).toContain('34-56');
      expect(response).toMatch(/opción|bebida|cantidad/i);
      expect(response).not.toMatch(/lo cambié|pedido quedó registrado/i);
    });

    it.each(['price', 'removed', 'unavailable', 'unknownDrink'])('recovers %s with contact details preserved through checkout', async scenario => {
      const h = await start(m.order.replace(/^(?:un|una) /, 'dos ') + ' sin cebolla');
      h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 117, dailyOrderNumber: 117 });
      await h.send('eso lleva bebida?');
      const before = structuredClone(h.conv.sessionData.cart);
      const changed = { ...m.other, price: scenario === 'price' ? m.other.price + 2000 : m.other.price,
        availableNow: scenario !== 'unavailable' };
      h.service.catalogService.getMenuProducts.mockResolvedValue([m.dish, m.own, m.base, ...(scenario === 'removed' ? [] : [changed])]);
      const reply = await h.send(`el combo 2 con ${scenario === 'unknownDrink' ? 'Tamarindo' : 'Uva'}\na nombre de Ana Torres\n3001112233\nCarrera 12 #34-56`);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(reply).toMatch(scenario === 'price' ? /precio.*cambi|cambi.*precio/i : scenario === 'unknownDrink' ? /bebida/i : /no está disponible/i);
      expect(h.conv.customerName).toBe('Ana Torres');
      expect(h.conv.sessionData.contactPhone?.replace(/\D/g, '')).toContain('3001112233');
      expect(h.conv.sessionData.address).toContain('34-56');
      const alternative = scenario === 'removed' || scenario === 'unavailable';
      const chosen = alternative ? m.own : changed;
      await h.send(`el combo ${alternative ? 1 : 2} con Uva`);
      expect(h.cartRows()).toEqual([expect.objectContaining({ id: chosen.id, qty: 2, note: expect.stringMatching(/sin cebolla/i) })]);
      expect(attr(h.cartRows()[0].attrs, 'Bebida')).toBe('Uva');
      expect(h.conv.sessionData.cart[0].unitPrice).toBe(chosen.price);
      if (alternative) expect(attr(h.cartRows()[0].attrs, m.kept[0])).toBe(m.kept[1]);
      await h.send('nada más');
      if (h.conv.state === 'awaiting_address') await h.send('sí');
      if (h.conv.state === 'awaiting_payment') await h.send('contraentrega');
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      await h.send('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const dto = h.service.ordersService.create.mock.calls[0][0];
      expect(dto.items.map(item => item.productId)).toEqual([chosen.id, chosen.id]);
      expect(dto.customerName).toBe('Ana Torres');
      expect(dto.phone.replace(/\D/g, '')).toContain('3001112233');
      expect(dto.address).toContain('34-56');
      for (const item of dto.items) {
        expect(item.attributes).toContainEqual({ attributeName: 'Bebida', attributeValue: 'Uva' });
        expect(item.note).toMatch(/sin cebolla/i);
      }
    });

    describe.each(['shopping', 'payment', 'confirmation'])('split drinks during %s', phase => {
      it.each(['explicitLine', 'clarifiedLine'])('changes only one of the remaining units: %s', async style => {
        const h = await start(m.order.replace(/^(?:un|una) /, 'cuatro ') + ' sin cebolla');
        h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 118, dailyOrderNumber: 118 });
        await h.send('eso lleva bebida?');
        await h.send('el combo 1 con Uva');
        expect(h.cartRows()).toEqual([expect.objectContaining({id:m.own.id,qty:4})]);
        if (phase !== 'shopping') await h.send('no más, recojo en el local');
        if (phase === 'confirmation') await h.send('contraentrega');
        const state = h.conv.state;
        const first = await h.send('cambia dos bebidas por Pepsi');
        expect(first).toContain('Pepsi');
        const counts = () => Object.fromEntries(h.cartRows().map(row => [attr(row.attrs,'Bebida'),row.qty]));
        expect(counts()).toEqual({Uva:2,Pepsi:2});
        expect(h.conv.state).toBe(state);
        const before = structuredClone(h.conv.sessionData.cart);
        const index = h.cartRows().findIndex(row => attr(row.attrs,'Bebida') === 'Uva');
        if (style === 'clarifiedLine') {
          const question = await h.send('cambia una bebida por Limonada');
          expect(question).toMatch(/cuál línea/i);
          expect(h.conv.sessionData.cart).toEqual(before);
          const candidates = h.conv.sessionData.pendingCartAttributeEdit?.candidates || [];
          const choice = candidates.findIndex(candidate => candidate.cartIndex === index) + 1;
          expect(choice).toBeGreaterThan(0);
          await h.send(String(choice));
        } else await h.send(`cambia una de la linea ${index + 1} por Limonada`);
        expect(counts()).toEqual({Uva:1,Pepsi:2,Limonada:1});
        expect(h.conv.state).toBe(state);
        for (const row of h.cartRows()) {
          expect(row.id).toBe(m.own.id);
          expect(row.note).toMatch(/sin cebolla/i);
          expect(attr(row.attrs,m.kept[0])).toBe(m.kept[1]);
        }
        if (phase === 'shopping') await h.send('no más, recojo en el local');
        if (h.conv.state === 'awaiting_payment') await h.send('contraentrega');
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
        await h.send('confirmar');
        expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
        const dto = h.service.ordersService.create.mock.calls[0][0];
        expect(dto.items).toHaveLength(4);
        expect(dto.items.map(item => item.attributes.find(a => a.attributeName === 'Bebida')?.attributeValue).sort()).toEqual(['Limonada','Pepsi','Pepsi','Uva']);
        for (const item of dto.items) {
          expect(item.productId).toBe(m.own.id);
          expect(item.note).toMatch(/sin cebolla/i);
        }
      });
    });

    it.each(['complete', 'turns', 'revise', 'nameInterruption', 'wrongTotal', 'incompleteOptions', 'question'])('distributes several attributes with scoped notes: %s', async scenario => {
      const h = await start(m.order.replace(/^(?:un|una) /, 'cuatro ') + ' sin cebolla');
      h.service.ordersService.create = jest.fn().mockResolvedValue({id:122,dailyOrderNumber:122});
      await h.send('eso lleva bebida?');
      await h.send('1');
      const before = structuredClone(h.conv.sessionData.cart);
      const otherValue = m.own.attributes.find(a => a.attributeName === m.kept[0])!.options.find(v => v !== m.kept[1])!;
      const first = `2 con Uva y ${m.kept[0]} ${otherValue} y sin tomate`;
      const second = `2 con Pepsi y ${m.kept[0]} ${m.kept[1]} y con ají`;
      if (scenario === 'complete') await h.send(`los quiero ${first} y ${second}`);
      else {
        const response = await h.send(first);
        expect(response).toMatch(/faltan 2/i);
        expect(h.conv.sessionData.cart).toEqual(before);
        expect(h.conv.sessionData.pendingAttribute?.productId).toBe(m.own.id);
        if (scenario === 'nameInterruption') {
          await h.send('a nombre de Ana Torres');
          expect(h.conv.customerName).toBe('Ana Torres');
          expect(h.conv.sessionData.cart).toEqual(before);
          expect(h.conv.sessionData.pendingAttribute?.distributionParts).toHaveLength(1);
        }
        if (scenario === 'question') {
          const response = await h.send('qué sabores tienes?');
          expect(response).toMatch(/Pepsi/);
          expect(h.conv.sessionData.cart).toEqual(before);
          expect(h.conv.sessionData.pendingAttribute?.distributionParts).toHaveLength(1);
        }
        if (scenario === 'wrongTotal' || scenario === 'incompleteOptions') {
          const pending = structuredClone(h.conv.sessionData.pendingAttribute);
          const response = await h.send(scenario === 'wrongTotal' ? second.replace(/^2 /, '3 ') : 'los otros con Pepsi y con ají');
          expect(response).toMatch(/opciones|cantidad|unidades|repart/i);
          expect(h.conv.sessionData.cart).toEqual(before);
          expect(h.conv.sessionData.pendingAttribute).toEqual(pending);
          expect(h.service.ordersService.create).not.toHaveBeenCalled();
        }
        if (scenario === 'revise') await h.send(`los quiero 1 con Uva y ${m.kept[0]} ${otherValue} y sin tomate y 3 con Pepsi y ${m.kept[0]} ${m.kept[1]} y con ají`);
        else await h.send(second);
      }
      const rows = h.cartRows();
      expect(rows).toHaveLength(2);
      const uva = rows.find(row => attr(row.attrs,'Bebida') === 'Uva')!;
      const pepsi = rows.find(row => attr(row.attrs,'Bebida') === 'Pepsi')!;
      expect(uva.qty).toBe(scenario === 'revise' ? 1 : 2);
      expect(pepsi.qty).toBe(scenario === 'revise' ? 3 : 2);
      expect(attr(uva.attrs,m.kept[0])).toBe(otherValue);
      expect(attr(pepsi.attrs,m.kept[0])).toBe(m.kept[1]);
      expect(uva.note).toMatch(/sin tomate/i);
      expect(uva.note).not.toMatch(/ají|aji/i);
      expect(pepsi.note).toMatch(/ají|aji/i);
      expect(pepsi.note).not.toMatch(/sin tomate/i);
      for (const row of rows) { expect(row.id).toBe(m.own.id); expect(row.note).toMatch(/sin cebolla/i); }
      expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
      const expected = h.conv.sessionData.cart.flatMap(row => Array.from({length:row.quantity}, () => ({productId:row.productId,note:row.note,attributes:row.attributes})));
      await h.send('no más, recojo en el local');
      await h.send('contraentrega');
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      await h.send('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const dto = h.service.ordersService.create.mock.calls[0][0];
      expect(dto.items).toHaveLength(4);
      expect(dto.items.map(item => ({productId:item.productId,note:item.note,attributes:item.attributes}))).toEqual(expected);
      expect(dto.customerName).toBe(scenario === 'nameInterruption' ? 'Ana Torres' : 'Wilmer');
    });

    it.each(['con cubiertos', 'con salsa aparte', 'sin hielo'])('keeps a trailing group instruction without a conjunction: %s', async note => {
      const h = await start(m.order.replace(/^(?:un|una) /, 'cuatro ') + ' sin cebolla');
      h.service.ordersService.create = jest.fn().mockResolvedValue({id:121,dailyOrderNumber:121});
      await h.send('eso lleva bebida?');
      await h.send('1');
      await h.send(`dos con Uva ${note}`);
      const response = await h.send('los otros con Pepsi');
      expect(response?.toLowerCase()).toContain(note);
      const rows = h.cartRows();
      expect(rows).toHaveLength(2);
      expect(rows.find(row => attr(row.attrs,'Bebida') === 'Uva')?.note?.toLowerCase()).toContain(note);
      expect(rows.find(row => attr(row.attrs,'Bebida') === 'Pepsi')?.note?.toLowerCase()).not.toContain(note);
      expect(rows.map(row => row.qty)).toEqual([2,2]);
      await h.send('no más, recojo en el local');
      await h.send('contraentrega');
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      await h.send('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const items = h.service.ordersService.create.mock.calls[0][0].items;
      expect(items).toHaveLength(4);
      for (const item of items) {
        expect(item.productId).toBe(m.own.id);
        expect(item.note).toMatch(/sin cebolla/i);
        expect(item.attributes).toContainEqual({attributeName:m.kept[0],attributeValue:m.kept[1]});
        const drink = item.attributes.find(a => a.attributeName === 'Bebida')?.attributeValue;
        if (drink === 'Uva') expect(item.note.toLowerCase()).toContain(note);
        else { expect(drink).toBe('Pepsi'); expect(item.note.toLowerCase()).not.toContain(note); }
      }
    });

    it.each(['complete', 'turns', 'threeGroups', 'paymentEdit', 'confirmationEdit', 'unknownRecovery', 'noConnector', 'commas', 'sameFlavor'])('keeps scoped notes in option groups: %s', async scenario => {
      const h = await start(m.order.replace(/^(?:un|una) /, 'cuatro ') + ' sin cebolla');
      h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 121, dailyOrderNumber: 121 });
      await h.send('eso lleva bebida?');
      await h.send('1');
      const before = structuredClone(h.conv.sessionData.cart);
      if (scenario === 'commas') {
        await h.send('dos con Uva sin tomate, dos con Pepsi con ají');
      } else if (scenario === 'complete') {
        await h.send('los quiero 2 con Uva y sin tomate y 2 con Pepsi y con ají');
      } else {
        const first = await h.send(scenario === 'noConnector' ? 'dos con Uva sin tomate' : 'dos con Uva y sin tomate');
        expect(first).toMatch(/faltan 2/i);
        expect(h.conv.sessionData.cart).toEqual(before);
        if (scenario === 'unknownRecovery') {
          await h.send('los otros con Tamarindo y con ají');
          expect(h.conv.sessionData.cart).toEqual(before);
          expect(h.conv.sessionData.pendingAttribute).toBeTruthy();
        }
        if (scenario === 'threeGroups') {
          await h.send('uno con Pepsi y con ají');
          expect(h.conv.sessionData.cart).toEqual(before);
          await h.send('el otro con Limonada y sin sal');
        } else await h.send(scenario === 'sameFlavor' ? 'los otros con Uva y con ají' : scenario === 'noConnector' ? 'los otros con Pepsi con ají' : 'los otros con Pepsi y con ají');
      }
      const initial = h.cartRows();
      expect(initial).toHaveLength(scenario === 'threeGroups' ? 3 : 2);
      expect(initial.reduce((sum,row) => sum + row.qty,0)).toBe(4);
      const uva = initial.find(row => attr(row.attrs,'Bebida') === 'Uva' && /sin tomate/i.test(row.note || ''));
      const pepsi = initial.find(row => attr(row.attrs,'Bebida') === (scenario === 'sameFlavor' ? 'Uva' : 'Pepsi') && /ají|aji/i.test(row.note || ''));
      expect(uva?.qty).toBe(2);
      expect(uva?.note).toMatch(/sin tomate/i);
      expect(uva?.note).not.toMatch(/ají|aji|sin sal/i);
      expect(pepsi?.qty).toBe(scenario === 'threeGroups' ? 1 : 2);
      expect(pepsi?.note).toMatch(/ají|aji/i);
      expect(pepsi?.note).not.toMatch(/sin tomate|sin sal/i);
      if (scenario === 'threeGroups') {
        const lime = initial.find(row => attr(row.attrs,'Bebida') === 'Limonada');
        expect(lime?.qty).toBe(1);
        expect(lime?.note).toMatch(/sin sal/i);
        expect(lime?.note).not.toMatch(/sin tomate|ají|aji/i);
      }
      expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
      await h.send('no más, recojo en el local');
      if (scenario === 'confirmationEdit') await h.send('contraentrega');
      if (scenario === 'paymentEdit' || scenario === 'confirmationEdit') {
        const state = h.conv.state;
        const index = h.cartRows().findIndex(row => attr(row.attrs,'Bebida') === 'Uva');
        const reply = await h.send(`cambia una de la linea ${index + 1} por Limonada`);
        expect(reply).toMatch(/Limonada/);
        expect(h.conv.state).toBe(state);
        const changed = h.cartRows().find(row => attr(row.attrs,'Bebida') === 'Limonada');
        expect(changed?.qty).toBe(1);
        expect(changed?.note).toMatch(/sin tomate/i);
        expect(changed?.note).not.toMatch(/ají|aji/i);
      }
      for (const row of h.cartRows()) {
        expect(row.id).toBe(m.own.id);
        expect(row.note).toMatch(/sin cebolla/i);
        expect(attr(row.attrs,m.kept[0])).toBe(m.kept[1]);
      }
      const expected = h.conv.sessionData.cart.flatMap(row => Array.from({length:row.quantity}, () => ({
        productId:row.productId, note:row.note, attributes:row.attributes,
      })));
      if (h.conv.state === 'awaiting_payment') await h.send('contraentrega');
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      await h.send('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const dto = h.service.ordersService.create.mock.calls[0][0];
      expect(dto.items).toHaveLength(4);
      expect(dto.items.map(item => ({productId:item.productId,note:item.note,attributes:item.attributes}))).toEqual(expected);
    });

    it.each(['remainder', 'explicit', 'question', 'unknown', 'overflow', 'restart', 'revise', 'stale', 'bare', 'index', 'courtesy'])('stages a drink split across turns: %s', async scenario => {
      const h = await start(m.order.replace(/^(?:un|una) /, 'cuatro ') + ' sin cebolla');
      h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 120, dailyOrderNumber: 120 });
      await h.send('eso lleva bebida?');
      await h.send('1');
      const before = structuredClone(h.conv.sessionData.cart);
      const first = await h.send('dos con Uva');
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.pendingAttribute?.productId).toBe(m.own.id);
      expect(first).toMatch(/faltan 2|otras 2/i);
      if (scenario === 'restart') {
        await h.send('reiniciar');
        expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
        expect(h.cartRows()).toEqual([]);
        return;
      }
      if (scenario === 'question') {
        const response = await h.send('qué sabores tienes?');
        expect(response).toMatch(/Pepsi/);
        expect(h.conv.sessionData.cart).toEqual(before);
      }
      if (scenario === 'unknown' || scenario === 'overflow') {
        const response = await h.send(scenario === 'unknown' ? 'los otros con Tamarindo' : 'tres con Pepsi');
        expect(h.conv.sessionData.cart).toEqual(before);
        expect(h.conv.sessionData.pendingAttribute?.productId).toBe(m.own.id);
        expect(response).toMatch(/opciones|cantidad|repart|sigue igual/i);
      }
      if (scenario === 'index') {
        const response = await h.send('2');
        expect(response).toMatch(/restantes/);
        expect(h.conv.sessionData.cart).toEqual(before);
      }
      if (scenario === 'stale') {
        h.conv.sessionData.cart[0].note = 'sin tomate';
        const changed = structuredClone(h.conv.sessionData.cart);
        const response = await h.send('los otros con Pepsi');
        expect(response).toMatch(/original cambió/i);
        expect(h.conv.sessionData.cart).toEqual(changed);
        expect(h.conv.sessionData.pendingAttribute?.productId).toBe(m.own.id);
        return;
      }
      const response = await h.send(scenario === 'revise' ? 'los quiero 1 con Uva y 3 con Pepsi'
        : scenario === 'explicit' ? 'dos con Pepsi' : scenario === 'bare' ? 'Pepsi' : scenario === 'courtesy' ? 'Pepsi, por favor' : 'los otros con Pepsi');
      expect(response).toMatch(/Uva/);
      expect(response).toMatch(/Pepsi/);
      expect(h.cartRows().map(row => [attr(row.attrs,'Bebida'),row.qty]).sort()).toEqual(scenario === 'revise' ? [['Pepsi',3],['Uva',1]] : [['Pepsi',2],['Uva',2]]);
      for (const row of h.cartRows()) {
        expect(row.id).toBe(m.own.id);
        expect(row.note).toMatch(/sin cebolla/i);
        expect(attr(row.attrs,m.kept[0])).toBe(m.kept[1]);
      }
      expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
      await h.send('no más, recojo en el local');
      await h.send('contraentrega');
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      await h.send('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const dto = h.service.ordersService.create.mock.calls[0][0];
      expect(dto.items).toHaveLength(4);
      expect(dto.items.map(item => item.productId)).toEqual(Array(4).fill(m.own.id));
      expect(dto.items.map(item => item.attributes.find(a => a.attributeName === 'Bebida')?.attributeValue).sort()).toEqual(scenario === 'revise' ? ['Pepsi','Pepsi','Pepsi','Uva'] : ['Pepsi','Pepsi','Uva','Uva']);
      for (const item of dto.items) expect(item.note).toMatch(/sin cebolla/i);
    });

    it.each(['valid', 'validBare', 'validCommas', 'wrongTotal', 'unknownFlavor', 'staleCart'])('distributes drinks during replacement selection: %s', async scenario => {
      const h = await start(m.order.replace(/^(?:un|una) /, 'cuatro ') + ' sin cebolla');
      h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 119, dailyOrderNumber: 119 });
      await h.send('eso lleva bebida?');
      await h.send('1');
      expect(h.conv.sessionData.pendingAttribute?.productId).toBe(m.own.id);
      if (scenario === 'staleCart') h.conv.sessionData.cart[0].note = 'sin tomate';
      const before = structuredClone(h.conv.sessionData.cart);
      const pending = structuredClone(h.conv.sessionData.pendingAttribute);
      const input = scenario === 'wrongTotal' ? 'los quiero 2 con Uva y 1 con Pepsi'
        : scenario === 'unknownFlavor' ? 'los quiero 2 con Uva y 2 con Tamarindo'
        : scenario === 'validBare' ? 'dos con Uva y dos con Pepsi'
        : scenario === 'validCommas' ? 'dos con Uva, dos con Pepsi' : 'los quiero 2 con Uva y 2 con Pepsi';
      const response = await h.send(input);
      if (!scenario.startsWith('valid')) {
        expect(h.conv.sessionData.cart).toEqual(before);
        expect(h.conv.sessionData.pendingAttribute).toEqual(pending);
        expect(response).toMatch(/sigue igual|sin cambiar|cambió/i);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
        return;
      }
      expect(response).toContain('Uva');
      expect(response).toContain('Pepsi');
      expect(h.cartRows()).toHaveLength(2);
      expect(h.cartRows().map(row => [attr(row.attrs,'Bebida'),row.qty]).sort()).toEqual([['Pepsi',2],['Uva',2]]);
      for (const row of h.cartRows()) {
        expect(row.id).toBe(m.own.id);
        expect(row.note).toMatch(/sin cebolla/i);
        expect(attr(row.attrs,m.kept[0])).toBe(m.kept[1]);
      }
      expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
      await h.send('no más, recojo en el local');
      await h.send('contraentrega');
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      await h.send('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const dto = h.service.ordersService.create.mock.calls[0][0];
      expect(dto.items).toHaveLength(4);
      expect(dto.items.map(item => item.productId)).toEqual(Array(4).fill(m.own.id));
      expect(dto.items.map(item => item.attributes.find(a => a.attributeName === 'Bebida')?.attributeValue).sort()).toEqual(['Pepsi','Pepsi','Uva','Uva']);
      for (const item of dto.items) expect(item.note).toMatch(/sin cebolla/i);
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
