import {harness} from './whatsapp-accuracy.test-support';
for(const other of [false,true])for(const agent of [false,true])for(const partial of [false,true])for(const phrase of ['no quiero ese producto','cancela ese producto','cancela ese plato','cansela ese plato porfa','no quiero ese plato','cancela el pedido']){
 it(`cancel scope ${other} ${agent} ${partial} ${phrase}`,async()=>{
  const names=other?['Batido Natural','Smoothie Especial','Malteada Especial']:['Jugo En Agua','Jugo En Leche','Malteada Natural'];
  const menu=names.map((name,i)=>({id:98801+i,code:901+i,name,price:10000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mango','Lulo']}]}));
  const h=harness(menu,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:368,dailyOrderNumber:368});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  await h.sendQueued(`Cuánto cuestan 2 ${names[0]} y 3 ${names[1]} y 1 ${names[2]}?`);await h.sendQueued('sí');
  if(partial)await h.sendQueued('Mango');
  const before=structuredClone(h.conv.sessionData.cart);const active=partial?1:0;
  const reply=await h.sendQueued(phrase);
  if(phrase==='cancela el pedido'){
   expect(h.conv.sessionData.cart).toEqual([]);expect(h.conv.sessionData.pendingAttribute).toBeUndefined();expect(h.conv.sessionData.pendingMultiOrder).toBeUndefined();
   await h.sendQueued('Lulo');expect(h.conv.sessionData.cart).toEqual([]);expect(h.service.ordersService.create).not.toHaveBeenCalled();return;
  }
  expect(reply).toMatch(/cancel|retir/i);expect(h.conv.sessionData.cart).toEqual(before);
  for(let i=active+1;i<3;i++){
   expect(h.conv.sessionData.pendingAttribute?.productId).toBe(menu[i].id);expect(h.replies.at(-1)).toContain(names[i]);await h.sendQueued('Lulo');
  }
  const expected=menu.filter((_,i)=>i!==active);expect(h.conv.sessionData.cart.map(l=>l.productId)).toEqual(expected.map(p=>p.id));
  expect(h.conv.sessionData.pendingAttribute).toBeUndefined();expect(h.conv.sessionData.pendingMultiOrder).toBeUndefined();
  await h.sendQueued('no más');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items=h.service.ordersService.create.mock.calls[0][0].items;expect(items).toHaveLength(partial?3:4);for(const item of items)expect(item.productId).not.toBe(menu[active].id);
 });
}
