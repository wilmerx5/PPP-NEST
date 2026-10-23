import { harness } from './whatsapp-accuracy.test-support';

for (const [name, choice] of [['Menu Arepa Rellena', 'Mora'], ['Combo Wrap Vegetal', 'Limonada'], ['Plato Ravioles', 'Agua']])
for (const enabled of [false, true]) for (const first of [false, true]) for (const mode of ['named', 'numeric', 'change']) {
  test(`${name}: price and choice in one turn, choiceFirst=${first}, mode=${mode}, agent=${enabled}`, async () => {
    const h = harness([{id:89901,code:81,name,price:30000,availableNow:true,hasAttributes:true,
      attributes:[{attributeName:'Bebida',options:['Colombiana',choice]}]}], enabled);
    h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
    h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
    h.service.ordersService.create=jest.fn().mockResolvedValue({id:139,dailyOrderNumber:139});
    await h.sendQueued(`Quiero un ${name}, qué sabores tienes?`);
    expect(h.conv.sessionData.pendingAttribute).toMatchObject({productId:89901});
    const selected = mode === 'numeric' ? '2' : choice;
    const separator = mode === 'numeric' ? '\n' : '; ';
    const reply=await h.sendQueued((first ? [selected, 'cuánto cuesta ese plato?'] : ['cuánto cuesta ese plato?', selected]).join(separator));
    expect(reply).toContain('30.000');
    expect(reply).toContain(choice);
    expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
    expect(h.cartRows()).toEqual([expect.objectContaining({id:89901,qty:1,attrs:[`Bebida:${choice}`]})]);
    if (mode === 'change') {
      const changed = await h.sendQueued('Mejor cambia la bebida a Colombiana');
      expect(changed).toMatch(/queda con/);
      expect(h.cartRows()).toEqual([expect.objectContaining({id:89901,qty:1,attrs:['Bebida:Colombiana']})]);
    }
    await h.sendQueued('no más, recojo en el local');
    expect(h.conv.state).toBe('awaiting_payment');
    await h.sendQueued('en efectivo');
    expect(h.conv.state).toBe('awaiting_final_confirm');
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const dto=h.service.ordersService.create.mock.calls[0][0];
    expect(dto.items).toHaveLength(1);
    expect(dto.items[0]).toMatchObject({productId:89901,attributes:[{attributeName:'Bebida',attributeValue:mode === 'change' ? 'Colombiana' : choice}]});
  });
}
