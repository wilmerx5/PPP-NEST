import { harness } from './whatsapp-accuracy.test-support';
import { isCondimentPacketNote, interpretProductNote } from './whatsapp-product-intent';

for(const dish of ['Arroz Con Pollo','Bowl Vegetal'])
for(const condiment of ['salsa de tomate','mostaza','mayonesa'])
for(const agent of [false,true])
for(const delivery of ['separate','inline']) {
  it(`${dish}: ${condiment}, ${delivery}, agent mock=${agent}`,async()=>{
    const h=harness([{id:94170,code:170,name:dish,price:18000,availableNow:true,attributes:[]}],agent);
    h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
    h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
    h.service.ordersService.create=jest.fn().mockResolvedValue({id:316,dailyOrderNumber:316});
    h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
    const note=`con sobres de ${condiment} porfa`;
    if(delivery==='inline') await h.sendQueued(`Veci me envías un ${dish} ${note}`);
    else { await h.sendQueued(`Veci me envías un ${dish}`); await h.sendQueued(note); }
    expect(h.conv.sessionData.cart).toHaveLength(1);
    expect(h.conv.sessionData.cart[0]).toMatchObject({productId:94170,quantity:1,note:expect.stringContaining(condiment)});
    expect(h.replies.at(-1)).toMatch(/algo m[aá]s/i);
    expect(h.conv.sessionData.pendingMatch).toBeFalsy();
    await h.sendQueued(note);
    expect(h.conv.sessionData.cart).toHaveLength(1);
    expect(h.conv.sessionData.cart[0].quantity).toBe(1);
    expect(h.conv.sessionData.cart[0].note?.split(condiment)).toHaveLength(2);
    await h.sendQueued('Solo eso porfa');await h.sendQueued('Contraentrega');
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    const receipt=await h.sendQueued('Confirmo');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const dto=h.service.ordersService.create.mock.calls[0][0];
    expect(dto.items).toHaveLength(1);expect(dto.items[0].note).toContain(condiment);
    expect(receipt).toContain(condiment);expect(receipt).toMatch(/18\.000/);
  });
}

it.each(['con sobres de salsa de tomate porfa','sobres de mostaza por favor','con hartos sobres de mayonesa','con sobre de ketchup gracias'])('bounded packet note: %s',text=>{
  expect(isCondimentPacketNote(text)).toBe(true);
});
it.each(['dos sobres de salsa','con sobres de salsa y dos jugos','¿con sobres de salsa?','sin sobres de salsa','con sobres de salsa si hay','con sobres de salsa para la calle 10','con sobres de salsa de tomate o mayonesa'])('not an uncounted standalone note: %s',text=>{
  expect(isCondimentPacketNote(text)).toBe(false);
});
it('exact longer catalog name owns the packet words',()=>{
  const products=[{id:1,name:'Bowl Vegetal'},{id:2,name:'Bowl Vegetal Con Sobres De Mostaza'}];
  expect(interpretProductNote('un Bowl Vegetal Con Sobres De Mostaza',products)).toBeNull();
});
