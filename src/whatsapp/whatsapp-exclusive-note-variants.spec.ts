import {harness} from './whatsapp-accuracy.test-support';

for(const dish of ['Bagre','Tofu','Berenjena']) for(const agent of [false,true]) for(const difference of ['option','note']) {
 test(`${dish}: exclusive quantity must clarify ${difference} before discarding variants; agent=${agent}`,async()=>{
  const h=harness([{id:94201,code:85,name:dish,price:29000,availableNow:true,hasAttributes:true,
   attributes:[{attributeName:'Seleccion',options:['Asado','Frito']}]}],agent);
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:148,dailyOrderNumber:148});
  await h.sendQueued(`Dame un ${dish} asado sin cebolla`);
  await h.sendQueued(`Agrega un ${dish} ${difference==='option'?'frito':'asado'} sin arroz`);
  expect(h.cartRows()).toHaveLength(2);
  const before=structuredClone(h.conv.sessionData.cart);
  const question=await h.sendQueued(`Solo quiero un ${dish} y que lleve las papas sudadas`);
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(question).toMatch(/cu[aá]l|opciones|l[ií]neas/i);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued(`Solo quiero un ${dish} sin cebolla y que lleve las papas sudadas`);
  expect(h.cartRows()).toEqual([expect.objectContaining({id:94201,qty:1,attrs:['Seleccion:Asado'],note:expect.stringMatching(/sin cebolla.*papas sudadas/i)})]);
  expect(h.cartRows()[0].note).not.toMatch(/sin arroz/i);
  await h.sendQueued('no más, recojo en el local');await h.sendQueued('en efectivo');
  expect(h.conv.state).toBe('awaiting_final_confirm');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('confirmar');
  const dto=h.service.ordersService.create.mock.calls[0][0];
  expect(dto.items).toHaveLength(1);
  expect(dto.items[0]).toMatchObject({productId:94201,attributes:[{attributeName:'Seleccion',attributeValue:'Asado'}],note:expect.stringMatching(/sin cebolla.*papas sudadas/i)});
 });
}
