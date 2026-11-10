import {harness} from './whatsapp-accuracy.test-support';
async function start(drink:string,agent:boolean,quantity=1){
 const h=harness([
 {id:94791,code:81,name:'Bowl Andino',price:18000,availableNow:true,attributes:[]},
 {id:94792,code:82,name:'Wrap Vegetal',price:15000,availableNow:true,attributes:[]},
 {id:94793,code:83,name:drink,price:6000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mango','Lulo']}]},
 ],agent);
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:479,dailyOrderNumber:479});
 h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 await h.sendQueued('quiero un Bowl Andino y un Wrap Vegetal');
 await h.sendQueued(`quiero ${quantity} ${drink}`);expect(h.conv.sessionData.pendingAttribute?.productId).toBe(94793);
 await h.sendQueued('qué precio tiene');expect(h.conv.sessionData.pendingPriceInquiry).toBeDefined();
 expect(h.conv.sessionData.pendingAttribute).toBeDefined();return h;
}
for(const agent of [false,true])test(`real competing option/price journey ${agent}`,async()=>{
 const h=await start('Jugo Natural',agent),before=structuredClone(h.conv.sessionData);
 const reply=await h.sendQueued('2');expect(h.conv.sessionData).toEqual(before);expect(reply).toMatch(/precio/);expect(reply).toMatch(/opción|opciones|sabor/i);
 await h.sendQueued('Sabor: Mango');
 expect(h.conv.sessionData.pendingAttribute).toBeUndefined();expect(h.conv.sessionData.pendingPriceInquiry).toBeUndefined();
 expect(h.cartRows()).toEqual([expect.objectContaining({id:94791,qty:1}),expect.objectContaining({id:94792,qty:1}),expect.objectContaining({id:94793,qty:1,attrs:['Sabor:Mango']})]);
 await h.sendQueued('no más, recojo en el local');await h.sendQueued('en efectivo');await h.sendQueued('confirmar');
 expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(3);
});
for(const drink of ['Jugo Natural','Batido Natural','Refresco Natural'])for(const agent of [false,true])
for(const short of ['1','2','el primero','la primera','el segundo','la segunda'])for(const quantity of [1,2])
for(const resolution of ['flavor','priceThenFlavor'])for(const flavor of ['Mango','Lulo']){
 test(`${drink}/${agent}/${short}/${quantity}/${resolution}/${flavor}: distinct owners preserve cart and close once`,async()=>{
  const h=await start(drink,agent,quantity),before=structuredClone(h.conv.sessionData);
  const reply=await h.sendQueued(short);
  expect(h.conv.sessionData).toEqual(before);expect(reply).toMatch(/precio/i);expect(reply).toMatch(/opción|opciones|sabor/i);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(resolution==='priceThenFlavor'){
   const price=await h.sendQueued('precio 2');expect(price).toMatch(/15[.,]000/);
   expect(h.conv.sessionData.cart).toEqual(before.cart);expect(h.conv.sessionData.pendingAttribute).toEqual(before.pendingAttribute);
   expect(h.conv.sessionData.pendingPriceInquiry).toBeUndefined();
  }
  await h.sendQueued(`Sabor: ${flavor}`);
  expect(h.conv.sessionData.pendingAttribute).toBeUndefined();expect(h.conv.sessionData.pendingPriceInquiry).toBeUndefined();
  expect(h.conv.sessionData.cart.slice(0,2)).toEqual(before.cart);
  expect(h.cartRows()[2]).toMatchObject({id:94793,qty:quantity,attrs:[`Sabor:${flavor}`]});
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('no más, recojo en el local');await h.sendQueued('en efectivo');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toHaveLength(quantity+2);
  expect(dto.items.filter((i:any)=>i.productId===94793)).toHaveLength(quantity);
  expect(dto.items.filter((i:any)=>i.productId===94793).every((i:any)=>i.attributes.some((a:any)=>a.attributeName==='Sabor'&&a.attributeValue===flavor))).toBe(true);
 });
}
