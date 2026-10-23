import { harness } from './whatsapp-accuracy.test-support';

for (const [name, option] of [['Menu Crepe Vegetal', 'Mora'], ['Combo Sandwich Asado', 'Limonada'], ['Plato Pasta Verde', 'Agua']])
for (const enabled of [false, true]) for (const mode of ['conditionFirst', 'conditionLast', 'surcharge', 'invalid']) {
  test(`${name}: ${mode}, recover pending choice and close, agent=${enabled}`, async () => {
    const h=harness([{id:90001,code:81,name,price:30000,availableNow:true,hasAttributes:true,
      attributes:[{attributeName:'Bebida',options:['Colombiana',option]}]}],enabled);
    h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
    h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
    h.service.ordersService.create=jest.fn().mockResolvedValue({id:140,dailyOrderNumber:140});
    await h.sendQueued(`Quiero un ${name}, qué sabores tienes?`);
    expect(h.conv.sessionData.pendingAttribute).toMatchObject({productId:90001,quantity:1});
    const pending=structuredClone(h.conv.sessionData.pendingAttribute);
    const request=mode==='conditionFirst' ? `Si no cuesta más, ponle ${option}` : mode==='conditionLast' ? `${option} si no vale más` : mode==='surcharge' ? `Cambia la bebida a ${option} si no hay recargo` : '9';
    const response=await h.sendQueued(request);
    expect(h.conv.sessionData.cart).toEqual([]);
    expect(h.conv.sessionData.pendingAttribute).toEqual(pending);
    expect(response).toMatch(mode==='invalid' ? /opci[oó]n|elige|prefieres|Bebida/ : /costo|recargo|condicionad/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    const price=await h.sendQueued('cuánto cuesta ese plato?');
    expect(price).toContain('30.000');
    expect(h.conv.sessionData.pendingAttribute).toEqual(pending);
    const contact=await h.sendQueued('a nombre de Ana Torres');
    expect(contact).toContain('Ana Torres');
    expect(h.conv.customerName).toBe('Ana Torres');
    expect(h.conv.sessionData.cart).toEqual([]);
    await h.sendQueued('2');
    expect(h.cartRows()).toEqual([expect.objectContaining({id:90001,qty:1,attrs:[`Bebida:${option}`]})]);
    expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
    await h.sendQueued('no más, recojo en el local');
    expect(h.conv.state).toBe('awaiting_payment');
    await h.sendQueued('en efectivo');
    expect(h.conv.state).toBe('awaiting_final_confirm');
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const dto=h.service.ordersService.create.mock.calls[0][0];
    expect(dto.customerName).toBe('Ana Torres');
    expect(dto.items).toHaveLength(1);
    expect(dto.items[0]).toMatchObject({productId:90001,attributes:[{attributeName:'Bebida',attributeValue:option}]});
  });
}
