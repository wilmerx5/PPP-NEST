import { harness, products } from './whatsapp-accuracy.test-support';
for (const other of [false, true]) for (const agent of [false, true]) {
  it(`quote compound product other=${other} agent=${agent}`, async () => {
    const menu = other ? [
      { id: 97001, code: 1, name: 'Pasta', price: 18000 },
      { id: 97002, code: 2, name: 'Setas', price: 9000 },
      { id: 97003, code: 3, name: 'Pasta Con Setas Del Bosque', price: 23000 },
    ].map(p => ({ ...p, availableNow: true, hasAttributes: false, attributes: [] })) : structuredClone(products);
    const h = harness(menu, agent);
    h.service.ordersService.create=jest.fn().mockResolvedValue({id:343,dailyOrderNumber:343});
    h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
    h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
    h.service.aiService.generateTurn = jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
    const reply = await h.sendQueued(other ? 'Me confirmas por fa el valor de la pasta con setas' : 'Me confirmas por fa el valor del arroz chino con costillas');
    expect(h.conv.sessionData.cart).toEqual([]);
    expect(reply).toContain(other ? '23.000' : '48.000');
    expect(reply).toContain(other ? 'Pasta Con Setas Del Bosque' : 'Arroz Chino Con Costillas De Cerdo');
    expect(reply).not.toMatch(/Estimado|Cotización/);
    await h.sendQueued('sí');
    expect(h.conv.sessionData.cart.map(line=>[line.productId,line.quantity])).toEqual([[other ? 97003 : 84,1]]);
    await h.sendQueued('no mas');await h.sendQueued('contraentrega');
    const receipt=await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    expect(h.service.ordersService.create.mock.calls[0][0].items.map(item=>item.productId)).toEqual([other ? 97003 : 84]);
    expect(receipt).toContain(other ? '23.000' : '48.000');
  });
}

for(const agent of [false,true]) for(const query of [
 'Cuánto vale el arroz chino y las costillas de cerdo',
 'Precio del arroz chino con costillas de cerdo',
 'Cuánto vale el arroz chino con costillas',
 'Me confirmas el valor del arroz chino con costillas',
]) it('quote identity '+agent+' '+query,async()=>{
 const h=harness(structuredClone(products),agent);
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 const reply=await h.sendQueued(query);
 expect(h.conv.sessionData.cart).toEqual([]);
 if(query.includes(' y ')) {
   expect(reply).toContain('63.500');
   await h.sendQueued('sí');
   expect(h.conv.sessionData.cart.map(line=>line.productId).sort((a,b)=>a-b)).toEqual([26,60]);
 } else {
   expect(reply).toContain('48.000');
   expect(reply).not.toMatch(/Estimado|Cotización/);
 }
});
