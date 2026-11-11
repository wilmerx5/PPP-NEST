import { harness } from './whatsapp-accuracy.test-support';

const menus = [
  { name: 'Helado Artesanal', categoryName: 'Postres', categoryNames: ['Postres'] },
  { name: 'Especial Frutal', categoryName: 'Paletas', categoryNames: ['Paletas'] },
  { name: 'Especial Tropical', categoryName: 'Especiales', categoryNames: ['Especiales', 'Sorbetes'] },
];
function start(menu: typeof menus[number], agent: boolean) {
  const h = harness([
    { id: 94861, code: 81, ...menu, price: 9000, availableNow: true, hasAttributes: true,
      attributes: [{ attributeName: 'Sabor', options: ['Mango', 'Lulo'] }] },
    { id: 94862, code: 82, name: 'Sopa Vegetal', price: 10000, availableNow: true, attributes: [] },
  ], agent);
  h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
  h.service.aiService.generateTurn = jest.fn().mockResolvedValue({ reply: '¿Cuál prefieres?', actions: {} });
  h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 486, dailyOrderNumber: 486 });
  h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
  return h;
}
for (const menu of menus) for (const agent of [false, true]) {
  for (const quantity of [1, 2]) for (const interruption of ['price', 'invalid', 'recipient']) {
    test(`${menu.name}/${agent}/${quantity}/${interruption}: pending flavor resumes exactly once`, async () => {
      const h = start(menu, agent);
      await h.sendQueued('quiero una Sopa Vegetal');
      const soup = structuredClone(h.conv.sessionData.cart);
      const prompt = await h.sendQueued(`quiero ${quantity} ${menu.name}`);
      expect(prompt).toMatch(/Sabor/);
      expect(prompt).toContain('Mango'); expect(prompt).toContain('Lulo');
      expect(h.conv.sessionData.cart).toEqual(soup);
      expect(h.conv.sessionData.pendingAttribute?.productId).toBe(94861);
      const pending = structuredClone(h.conv.sessionData.pendingAttribute);
      const reply = await h.sendQueued(interruption === 'price' ? `cuánto cuesta ${menu.name}`
        : interruption === 'invalid' ? '9' : 'a nombre de Ana Torres');
      expect(reply).toMatch(interruption === 'price' ? /9[.,]000/
        : interruption === 'invalid' ? /Sabor|opci[oó]n|prefieres/i : /Ana Torres/);
      expect(h.conv.sessionData.pendingAttribute).toEqual(pending);
      expect(h.conv.sessionData.cart).toEqual(soup);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      await h.sendQueued('2');
      expect(h.conv.sessionData.pendingAttribute).toBeUndefined();
      expect(h.cartRows()).toEqual([
        expect.objectContaining({ id: 94862, qty: 1 }),
        expect.objectContaining({ id: 94861, qty: quantity, attrs: ['Sabor:Lulo'] }),
      ]);
      await h.sendQueued('no más, recojo en el local');
      await h.sendQueued('en efectivo');
      expect(h.conv.state).toBe('awaiting_final_confirm');
      expect(h.replies.at(-1)).toContain('Lulo');
      await h.sendQueued('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const dto = h.service.ordersService.create.mock.calls[0][0];
      expect(dto.items).toHaveLength(quantity + 1);
      expect(dto.items.filter((item: any) => item.productId === 94861)).toHaveLength(quantity);
      expect(JSON.stringify(dto.items)).toContain('Lulo');
      if (interruption === 'recipient') expect(dto.customerName).toBe('Ana Torres');
    });
  }
  test(`${menu.name}/${agent}: cancel pending order and start a new purchase`, async () => {
    const h = start(menu, agent);
    await h.sendQueued('quiero una Sopa Vegetal');
    await h.sendQueued(`quiero 2 ${menu.name}`);
    expect(h.conv.sessionData.pendingAttribute).toBeDefined();
    const cancellation = await h.sendQueued('cancelar pedido');
    expect(cancellation).toMatch(/cancelad|vaci/i);
    expect(h.conv.sessionData.pendingAttribute).toBeUndefined();
    expect(h.cartRows()).toEqual([]);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    await h.sendQueued('quiero una Sopa Vegetal');
    await h.sendQueued('no más, recojo en el local');
    await h.sendQueued('en efectivo');
    await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    expect(h.service.ordersService.create.mock.calls[0][0].items)
      .toEqual([expect.objectContaining({ productId: 94862 })]);
  });
}
