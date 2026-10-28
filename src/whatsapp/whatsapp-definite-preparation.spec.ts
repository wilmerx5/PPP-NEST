import {harness} from './whatsapp-accuracy.test-support';
const menus=[['Mojarra Frita','Mojarra Asada'],['Bowl De Vegetales Asados','Bowl De Vegetales Gratinados'],['Pasta Con Champinones Fritos','Pasta Con Champinones Gratinados']];
for(const [oldName,newName] of menus)for(const agent of [false,true]){
 const start=async()=>{
  const menu=[oldName,newName].map((name,i)=>({id:8810+i,code:8810+i,name,price:20000+i*1000,availableNow:true,hasAttributes:false,attributes:[]}));
  const h=harness(menu as never,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:999,dailyOrderNumber:99});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
  await h.sendQueued(`Dos ${oldName}`);return h;
 };
 for(const state of ['building_cart','awaiting_payment','awaiting_final_confirm'])it(`${oldName}/${agent}/${state}: definite preparation replaces the existing units`,async()=>{
  const h=await start();h.conv.state=state;h.conv.sessionData.paymentMethod='cash';
  await h.sendQueued(`El ${newName}`);
  expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:8811,quantity:2,unitPrice:21000})]);
  expect(h.conv.state).toBe(state);expect(h.replies.at(-1)).toMatch(/cambi[eé]/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it(`${oldName}/${agent}: an explicit addition keeps both preparations`,async()=>{const h=await start();await h.sendQueued(`Agrega un ${newName}`);expect(h.conv.sessionData.cart.map(l=>[l.productId,l.quantity])).toEqual([[8810,2],[8811,1]]);});
 it(`${oldName}/${agent}: a question preserves the existing preparation`,async()=>{const h=await start();const cart=structuredClone(h.conv.sessionData.cart);await h.sendQueued(`¿El ${newName}?`);expect(h.conv.sessionData.cart).toEqual(cart);expect(h.service.ordersService.create).not.toHaveBeenCalled();});
}

for(const agent of [false,true])it(`original executive changes preparation without an additional unit ${agent}`,async()=>{
 const h=harness(undefined,agent);await h.sendQueued('un ejecutivo con pollo frito');const old=structuredClone(h.conv.sessionData.cart[0]);
 await h.sendQueued('El ejecutivo con pollo brooster');
 expect(h.conv.sessionData.cart).toHaveLength(1);expect(h.conv.sessionData.cart[0]).toMatchObject({code:18,quantity:old.quantity,attributes:old.attributes});
});
for(const agent of [false,true])it(`repeat and order DTO retain count and compatible choices ${agent}`,async()=>{
 const menu=['Mojarra Frita','Mojarra Asada'].map((name,i)=>({id:8820+i,code:8820+i,name,price:20000+i*1000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Agua','Limonada']}]}));
 const h=harness(menu as never,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:999,dailyOrderNumber:99});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
 await h.sendQueued('Dos Mojarra Frita con Limonada');
 await h.sendQueued('La Mojarra Asada');
 const expected=structuredClone(h.conv.sessionData.cart);
 expect(expected).toEqual([expect.objectContaining({productId:8821,quantity:2,attributes:expect.arrayContaining([{attributeName:'Bebida',attributeValue:'Limonada'}])})]);
 await h.sendQueued('La Mojarra Asada');expect(h.conv.sessionData.cart).toEqual(expected);
 await h.sendQueued('contraentrega');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
 const items=h.service.ordersService.create.mock.calls[0][0].items;
 expect(items).toHaveLength(2);expect(items.every((i:any)=>i.productId===8821&&i.attributes.some((a:any)=>a.attributeValue==='Limonada'))).toBe(true);
});
