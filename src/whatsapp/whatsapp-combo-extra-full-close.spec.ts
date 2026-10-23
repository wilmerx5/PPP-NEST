import { harness } from './whatsapp-accuracy.test-support';

const menus = [
  { name: 'Combo Pollo Dorado', side: 'Porcion Papa Francesa', ask: 'papa francesa', drink: 'Manzana' },
  { name: 'Menu Hamburguesa Clasica', side: 'Aros De Cebolla', ask: 'aros de cebolla', drink: 'Limonada' },
  { name: 'Plato Pasta Napolitana', side: 'Pan De Ajo', ask: 'pan de ajo', drink: 'Agua' },
];
for (const menu of menus) for (const enabled of [false, true]) for (const catalogWording of [false, true]) for (const extraDrink of [false, true]) {
  test(`${menu.name}: pending included drink, contents, extra and complete order; catalogWording=${catalogWording}, extraDrink=${extraDrink}, agent=${enabled}`, async () => {
    const h = harness([
      { id: 89501, code: 81, name: menu.name, price: 30000, availableNow: true,
        description: `Incluye ${menu.ask} y bebida`, hasAttributes: true,
        attributes: [{ attributeName: 'Bebida', options: ['Colombiana', menu.drink] }] },
      { id: 89502, code: 82, name: menu.side, price: 7000, availableNow: true, hasAttributes: false, attributes: [] },
      { id: 89503, code: 83, name: menu.drink, price: 5000, availableNow: true, hasAttributes: false, attributes: [] },
    ], enabled);
    h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
    h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 135, dailyOrderNumber: 135 });
    expect(h.conv.sessionData.cart).toEqual([]);
    const offered = await h.sendQueued(`Quiero un ${menu.name}, qué sabores tienes?`);
    expect(offered).toContain(menu.drink);
    expect(h.conv.sessionData.pendingAttribute).toMatchObject({ productId: 89501 });
    expect(h.conv.sessionData.cart).toEqual([]);
    const question = await h.sendQueued(`ese viene con ${menu.ask}?`);
    expect(question).toContain(menu.ask);
    expect(question).toMatch(/sí|incluye/i);
    expect(h.conv.sessionData.pendingAttribute).toMatchObject({ productId: 89501 });
    expect(h.conv.sessionData.cart).toEqual([]);
    await h.sendQueued(extraDrink ? '2' : menu.drink);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 89501, qty: 1, attrs: [`Bebida:${menu.drink}`] })]);
    await h.sendQueued(catalogWording ? `Agrega una ${menu.side} adicional` : `Agrega una porción de ${menu.ask} adicional`);
    expect(h.cartRows().map(row => [row.id, row.qty])).toEqual([[89501, 1], [89502, 1]]);
    if (extraDrink) {
      await h.sendQueued(`Agrega una ${menu.drink} aparte`);
      expect(h.cartRows().map(row => [row.id, row.qty])).toEqual([[89501, 1], [89502, 1], [89503, 1]]);
      expect(h.cartRows()[0].attrs).toEqual([`Bebida:${menu.drink}`]);
    }
    const cart = structuredClone(h.conv.sessionData.cart);
    const total = await h.sendQueued('cuánto cuesta todo?');
    expect(total?.replace(/[.,]/g, '')).toContain(extraDrink ? '42000' : '37000');
    expect(h.conv.sessionData.cart).toEqual(cart);
    await h.sendQueued('no más, recojo en el local');
    expect(h.conv.state).toBe('awaiting_payment');
    await h.sendQueued('contraentrega');
    expect(h.conv.state).toBe('awaiting_final_confirm');
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const items = h.service.ordersService.create.mock.calls[0][0].items;
    expect(items.map(item => item.productId)).toEqual(extraDrink ? [89501, 89502, 89503] : [89501, 89502]);
    expect(items[0].attributes).toEqual([{ attributeName: 'Bebida', attributeValue: menu.drink }]);
    expect(h.conv.state).toBe('completed');
  });
}
