import { harness } from './whatsapp-accuracy.test-support';

for (const [name, option, side] of [
  ['Combo Sandwich Vegetal', 'Mora', 'Porcion De Papas'],
  ['Menu Crepe', 'Limonada', 'Porcion De Yuca'],
  ['Plato Pasta', 'Agua', 'Pan De Ajo'],
]) for (const agent of [false, true]) for (const mode of ['first', 'last', 'conditionOnly', 'bothConditional']) {
  test(`${name}: conditional choice and ${mode}, agent=${agent}`, async () => {
    const h = harness([
      { id: 93001, code: 81, name, price: 30000, availableNow: true, hasAttributes: true,
        attributes: [{ attributeName: 'Bebida', options: ['Colombiana', option] }] },
      { id: 93002, code: 82, name: side, price: 5000, availableNow: true, hasAttributes: false, attributes: [] },
    ], agent);
    h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
    h.service.aiService.generateTurn = jest.fn().mockResolvedValue({ reply: '¿Cuál prefieres?', actions: {} });
    h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 143, dailyOrderNumber: 143 });
    await h.sendQueued(`Quiero un ${side}`);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 93002, qty: 1 })]);
    await h.sendQueued(`Quiero un ${name}, qué sabores tienes?`);
    const pending = structuredClone(h.conv.sessionData.pendingAttribute);
    expect(pending).toMatchObject({ productId: 93001, quantity: 1 });
    const keepSide = mode === 'conditionOnly' || mode === 'bothConditional';
    const condition = `Cambia la bebida a ${option} si no cuesta más`;
    const remove = `quita el ${side}`;
    const replyStart = h.replies.length;
    await h.sendQueued(mode === 'first' ? `${condition}; aparte ${remove}` :
      mode === 'last' ? `${remove}; aparte ${condition}` :
      mode === 'bothConditional' ? `${condition}; aparte ${remove} si no hay recargo` : condition);
    const reply = h.replies.slice(replyStart).join('\n');
    expect(reply).toMatch(/costo|recargo|condicionado/i);
    expect(h.conv.sessionData.pendingAttribute).toEqual(pending);
    expect(h.cartRows()).toEqual(keepSide ? [expect.objectContaining({ id: 93002, qty: 1 })] : []);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    const selected = await h.sendQueued('2');
    expect(selected).toContain(option);
    expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
    expect(h.cartRows().filter(row => row.id === 93001)).toEqual([
      expect.objectContaining({ id: 93001, qty: 1, attrs: [`Bebida:${option}`] }),
    ]);
    await h.sendQueued('no más, recojo en el local');
    expect(h.conv.state).toBe('awaiting_payment');
    await h.sendQueued('en efectivo');
    expect(h.conv.state).toBe('awaiting_final_confirm');
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const dto = h.service.ordersService.create.mock.calls[0][0];
    expect(dto.items).toHaveLength(keepSide ? 2 : 1);
    expect(dto.items.filter((item: any) => item.productId === 93001)).toEqual([
      expect.objectContaining({ productId: 93001, attributes: [{ attributeName: 'Bebida', attributeValue: option }] }),
    ]);
    expect(dto.items.filter((item: any) => item.productId === 93002)).toHaveLength(keepSide ? 1 : 0);
  });
}
