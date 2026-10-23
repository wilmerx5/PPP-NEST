import { harness } from './whatsapp-accuracy.test-support';

const normalizedNote = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const menus = [
  { name: 'Bao De Hongos', attr: 'Salsa', a: 'Teriyaki', b: 'Ponzu', price: 18000, note: 'sin cebolla' },
  { name: 'Pizza Del Huerto', attr: 'Masa', a: 'Fina', b: 'Gruesa', price: 26000, note: 'sin ajo' },
  { name: 'Batido De Mango', attr: 'Base', a: 'Leche', b: 'Agua', price: 9000, note: 'sin azúcar' },
];

for (const menu of menus) for (const enabled of [false, true]) for (const undo of [false, true]) {
  test(`${menu.name}: purchase, partial edit, contact, price and close; undo=${undo}, agent=${enabled}`, async () => {
    const product = {
      id: 89301, code: 89301, name: menu.name, price: menu.price,
      availableNow: true, hasAttributes: true,
      attributes: [{ attributeName: menu.attr, options: [menu.a, menu.b] }],
    };
    const h = harness([product], enabled);
    h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
    h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 133, dailyOrderNumber: 133 });
    expect(h.conv.sessionData.cart).toEqual([]);

    const purchase = await h.sendQueued(`Quiero dos ${menu.name} con ${menu.a}`);
    expect(purchase).toContain(menu.name);
    expect(h.cartRows()).toHaveLength(1);
    expect(h.cartRows()[0]).toMatchObject({ qty: 2, attrs: [`${menu.attr}:${menu.a}`] });
    const original = structuredClone(h.conv.sessionData.cart);

    await h.sendQueued(`Cambia la ${menu.attr} de una ${menu.name} a ${menu.b} ${menu.note}`);
    expect(h.cartRows().reduce((sum, row) => sum + row.qty, 0)).toBe(2);
    const changed = h.cartRows().filter(row => row.attrs.includes(`${menu.attr}:${menu.b}`));
    expect(changed).toEqual([expect.objectContaining({ qty: 1 })]);
    expect(normalizedNote(changed[0].note || '')).toContain(normalizedNote(menu.note));
    expect(normalizedNote(h.cartRows().find(row => row.attrs.includes(`${menu.attr}:${menu.a}`))?.note || '')).not.toContain(normalizedNote(menu.note));

    await h.sendQueued('no más, recojo en el local');
    expect(h.conv.state).toBe('awaiting_payment');
    const cart = structuredClone(h.conv.sessionData.cart);
    const price = await h.sendQueued('cuánto cuesta todo?');
    expect(price?.replace(/[.,]/g, '')).toContain(String(menu.price * 2));
    expect(h.conv.sessionData.cart).toEqual(cart);
    expect(h.conv.state).toBe('awaiting_payment');
    await h.sendQueued('a nombre de Ana Perez');
    expect(h.conv.customerName).toBe('Ana Perez');
    expect(h.conv.sessionData.cart).toEqual(cart);
    expect(h.conv.state).toBe('awaiting_payment');

    if (undo) {
      const answer = await h.sendQueued('deshaz el último cambio');
      expect(answer).toMatch(/deshecho/i);
      expect(h.conv.sessionData.cart).toEqual(original);
      expect(h.conv.state).toBe('awaiting_payment');
      expect(h.conv.customerName).toBe('Ana Perez');
    }
    const expected = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('contraentrega');
    expect(h.conv.state).toBe('awaiting_final_confirm');
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    expect(h.conv.state).toBe('completed');
    const dto = h.service.ordersService.create.mock.calls[0][0];
    expect(dto.items).toHaveLength(2);
    expect(dto.items.every(item => item.productId === product.id)).toBe(true);
    const expanded = expected.flatMap(line => Array.from({ length: line.quantity }, () => ({
      attrs: line.attributes, note: line.note || '',
    })));
    expect(dto.items.map(item => ({ attrs: item.attributes, note: item.note || '' }))).toEqual(expanded);
    await h.sendQueued('gracias');
    expect(h.conv.state).toBe('completed');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  });
}
