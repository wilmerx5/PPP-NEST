import { harness } from './whatsapp-accuracy.test-support';

for (const [name, drink] of [
  ['Combo Pollo Dorado', 'Manzana'],
  ['Menu Hamburguesa Clasica', 'Limonada'],
  ['Plato Pasta Napolitana', 'Agua'],
]) for (const enabled of [false, true]) for (const mode of ['separate', 'together', 'correct']) {
  test(`${name}: empty cart, contacts interrupt included beverage, ${mode}, agent=${enabled}`, async () => {
    const h = harness([{ id: 89801, code: 81, name, price: 30000, availableNow: true,
      description: 'Incluye papa francesa y bebida', hasAttributes: true,
      attributes: [{ attributeName: 'Bebida', options: ['Colombiana', drink] }] }], enabled);
    h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
    h.service.aiService.generateTurn = jest.fn().mockResolvedValue({ reply: "¿Cuál prefieres?", actions: {} });
    h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 138, dailyOrderNumber: 138 });
    h.conv.customerName = '';
    Object.assign(h.conv.sessionData, { orderType: 'delivery', fulfillmentChosen: true });
    await h.sendQueued(`Quiero un ${name}, qué sabores tienes?`);
    expect(h.conv.sessionData.pendingAttribute).toMatchObject({ productId: 89801 });
    expect(h.conv.sessionData.cart).toEqual([]);
    const price = await h.sendQueued(mode === 'separate' ? 'cuánto cuesta ese plato?' : mode === 'together' ? 'qué precio tiene ese producto?' : 'cuánto vale este menú?');
    expect(price).toContain('30.000');
    expect(h.conv.sessionData.pendingAttribute).toMatchObject({ productId: 89801 });
    expect(h.conv.sessionData.cart).toEqual([]);
    const details = ['a nombre de Ana Torres', '3001112233', 'Calle 10 #20-30 torre 4 apto 502'];
    for (const text of mode === 'separate' ? details : [details.join('\n')]) {
      const reply = await h.sendQueued(text);
      expect(reply).toContain(drink);
      expect(h.conv.sessionData.pendingAttribute).toMatchObject({ productId: 89801 });
      expect(h.conv.sessionData.cart).toEqual([]);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    }
    if (mode === 'correct') {
      await h.sendQueued('a nombre de Luis Perez\n3012223344\nCarrera 12 #34-56 torre 2 apto 201');
      expect(h.conv.sessionData.pendingAttribute).toMatchObject({ productId: 89801 });
      expect(h.conv.sessionData.cart).toEqual([]);
    }
    await h.sendQueued('2');
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 89801, qty: 1, attrs: [`Bebida:${drink}`] })]);
    expect(h.conv.state).toBe('awaiting_payment');
    expect(h.conv.customerName).toBe(mode === 'correct' ? 'Luis Perez' : 'Ana Torres');
    await h.sendQueued('en efectivo');
    expect(h.conv.state).toBe('awaiting_final_confirm');
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const dto = h.service.ordersService.create.mock.calls[0][0];
    expect(dto.items).toHaveLength(1);
    expect(dto.items[0]).toMatchObject({ productId: 89801, attributes: [{ attributeName: 'Bebida', attributeValue: drink }] });
    expect(dto.customerName).toBe(mode === 'correct' ? 'Luis Perez' : 'Ana Torres');
    expect(dto.phone.replace(/\D/g, '')).toContain(mode === 'correct' ? '3012223344' : '3001112233');
    expect(dto.address).toMatch(mode === 'correct' ? /34-56.*201/ : /20-30.*502/);
  });
}
