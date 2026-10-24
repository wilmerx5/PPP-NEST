import {harness} from './whatsapp-accuracy.test-support';
for(const head of ['Bowl','Hamburguesa','Sandwich']) for(const agent of [false,true]) for(const checkout of [false,true]) {
 test(`${head}: an additional ambiguous purchase preserves existing unit while choosing; agent=${agent}; checkout=${checkout}`,async()=>{
  const menu=['Vegetal','De Pollo'].map((suffix,index)=>({id:94501+index,code:81+index,name:`${head} ${suffix}`,price:20000+index*1000,availableNow:true,hasAttributes:true,
   attributes:[{attributeName:'Seleccion',options:['Asado','Frito']}]}));
  const h=harness(menu,agent);
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:150,dailyOrderNumber:150});
  await h.sendQueued(`Dame un ${head} Vegetal asado sin cebolla`);
  if(checkout) {await h.sendQueued('no más, recojo en el local');expect(h.conv.state).toBe('awaiting_payment');}
  const before=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued(`Agrega un ${head} frito sin arroz`);
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(reply).toMatch(/cu[aá]l|elige|prefieres/i);
  expect(reply).toMatch(/Vegetal/i);expect(reply).toMatch(/Pollo/i);
  const question=await h.sendQueued(`¿Cuánto cuesta el ${head} Vegetal?`);
  expect(question).toMatch(/20[.,]000/);
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(h.conv.sessionData.pendingMatch?.candidates.map((p:any)=>p.id)).toEqual([94501,94502]);
  await h.sendQueued(`${head} De Pollo`);
  expect(h.cartRows()).toEqual([
   expect.objectContaining({id:94501,qty:1,attrs:['Seleccion:Asado'],note:expect.stringMatching(/sin cebolla/i)}),
   expect.objectContaining({id:94502,qty:1,attrs:['Seleccion:Frito'],note:expect.stringMatching(/sin arroz/i)}),
  ]);
  await h.sendQueued('no más, recojo en el local');await h.sendQueued('en efectivo');
  expect(h.conv.state).toBe('awaiting_final_confirm');expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  expect(h.service.ordersService.create.mock.calls[0][0].items).toEqual([
   expect.objectContaining({productId:94501,attributes:[{attributeName:'Seleccion',attributeValue:'Asado'}],note:expect.stringMatching(/sin cebolla/i)}),
   expect.objectContaining({productId:94502,attributes:[{attributeName:'Seleccion',attributeValue:'Frito'}],note:expect.stringMatching(/sin arroz/i)}),
  ]);
 });
}
