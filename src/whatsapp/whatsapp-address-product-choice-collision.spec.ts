import {harness} from './whatsapp-accuracy.test-support';
for(const head of ['Bowl','Hamburguesa','Sandwich']) for(const agent of [false,true]) for(const answer of ['1','2']) for(const addressFirst of [false,true]) {
 test(`${head}: an additional ambiguous purchase preserves existing unit while choosing; agent=${agent}; answer=${answer}; addressFirst=${addressFirst}`,async()=>{
  const menu=['Vegetal','De Pollo'].map((suffix,index)=>({id:94501+index,code:81+index,name:`${head} ${suffix}`,price:20000+index*1000,availableNow:true,hasAttributes:true,
   attributes:[{attributeName:'Seleccion',options:['Asado','Frito']}]}));
  const h=harness(menu,agent);
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:150,dailyOrderNumber:150});
  await h.sendQueued(`Dame un ${head} Vegetal asado sin cebolla`);
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  Object.assign(h.cfg,{deliveryFeeMode:'distance',restaurantLat:4.63,restaurantLng:-74.15});
  h.service.deliveryRouting={quoteDeliveryFee:jest.fn().mockResolvedValue({ok:true,fee:2000,distanceKm:1,source:'google_directions',geocodedAddress:'Calle 10 #20-30, Bogotá',customer:{lat:4.64,lng:-74.14}})};
  const before=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued(`Agrega un ${head} frito sin arroz`);
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(reply).toMatch(/cu[aá]l|elige|prefieres/i);
  expect(reply).toMatch(/Vegetal/i);expect(reply).toMatch(/Pollo/i);
  await h.sendQueued('Calle 10 #20-30 apartamento 1 apartamento 2');
  expect(h.conv.sessionData.pendingAddressConflict).toBeDefined();
  expect(h.conv.sessionData.pendingMatch).toBeDefined();
  const pendingBefore=structuredClone(h.conv.sessionData);
  const ambiguous=await h.sendQueued(answer);
  expect(h.conv.sessionData).toEqual(pendingBefore);
  expect(ambiguous).toMatch(/apartamento/i);
  expect(ambiguous).toMatch(/producto|plato/i);
  expect(h.service.deliveryRouting.quoteDeliveryFee).not.toHaveBeenCalled();
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  const question=await h.sendQueued(`¿Cuánto cuesta el ${head} Vegetal?`);
  expect(question).toMatch(/20[.,]000/);
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(h.conv.sessionData.pendingMatch?.candidates.map((p:any)=>p.id)).toEqual([94501,94502]);
  if(addressFirst) {
   await h.sendQueued('El apartamento 2');
   expect(h.conv.sessionData.pendingAddressConflict).toBeUndefined();
   expect(h.conv.sessionData.pendingMatch).toBeDefined();
   expect(h.conv.sessionData.cart).toEqual(before);
  }
  await h.sendQueued(`${head} De Pollo`);
  expect(h.cartRows()).toEqual([
   expect.objectContaining({id:94501,qty:1,attrs:['Seleccion:Asado'],note:expect.stringMatching(/sin cebolla/i)}),
   expect.objectContaining({id:94502,qty:1,attrs:['Seleccion:Frito'],note:expect.stringMatching(/sin arroz/i)}),
  ]);
  if(!addressFirst) {
   expect(h.conv.sessionData.pendingAddressConflict).toBeDefined();
   await h.sendQueued('El apartamento 2');
  }
  expect(h.conv.sessionData.pendingAddressConflict).toBeUndefined();
  expect(h.conv.sessionData.address).toMatch(/apartamento 2/i);
  await h.sendQueued('nada más');await h.sendQueued('en efectivo');
  expect(h.conv.state).toBe('awaiting_final_confirm');expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  expect(h.service.ordersService.create.mock.calls[0][0].address).toMatch(/apartamento 2/i);
  expect(h.service.ordersService.create.mock.calls[0][0].items).toEqual([
   expect.objectContaining({productId:94501,attributes:[{attributeName:'Seleccion',attributeValue:'Asado'}],note:expect.stringMatching(/sin cebolla/i)}),
   expect.objectContaining({productId:94502,attributes:[{attributeName:'Seleccion',attributeValue:'Frito'}],note:expect.stringMatching(/sin arroz/i)}),
  ]);
 });
}
