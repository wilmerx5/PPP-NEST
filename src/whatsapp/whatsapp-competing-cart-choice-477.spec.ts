import {harness} from './whatsapp-accuracy.test-support';
async function start(family:string,agent:boolean,checkout=false,quantity=1){
 const names=[family+' Clásico',family+' Especial'];
 const h=harness(names.map((name,i)=>({id:94771+i,code:81+i,name,price:30000+i*5000,availableNow:true,attributes:[]})),agent);
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Qué deseas?',actions:{}});
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:477,dailyOrderNumber:477});
 h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 await h.sendQueued(`quiero ${quantity} ${names[0]} y ${quantity} ${names[1]}`);
 expect(h.cartRows().map(row=>row.id)).toEqual([94771,94772]);
 if(checkout){await h.sendQueued('no más, recojo en el local');await h.sendQueued('en efectivo');expect(h.conv.state).toBe('awaiting_final_confirm');}
 return {h,names};
}
for(const agent of [false,true])test(`price then restrictive correction has one owner and honest no-op ${agent}`,async()=>{
 const {h,names}=await start('Combo',agent);
 const cart=structuredClone(h.conv.sessionData.cart),address=h.conv.sessionData.address;
 await h.sendQueued('qué precio tienen');expect(h.conv.sessionData.pendingPriceInquiry).toBeDefined();
 await h.sendQueued('es solo un combo');
 expect(h.conv.sessionData.pendingPriceInquiry).toBeUndefined();expect(h.conv.sessionData.pendingCartQuantity).toBeDefined();
 const reply=await h.sendQueued('1');
 expect(reply).toMatch(/ya tiene 1/);expect(reply).toMatch(/dime cuál quitamos/);expect(reply).not.toMatch(/corregí la cantidad|varias listas|dirección/i);
 expect(h.conv.sessionData.cart).toEqual(cart);expect(h.conv.sessionData.address).toBe(address);
 expect(h.conv.sessionData.pendingCartQuantity).toBeUndefined();
 await h.sendQueued(`quita el ${names[1]}`);
 expect(h.cartRows()).toEqual([expect.objectContaining({id:94771,qty:1})]);
 await h.sendQueued('no más, recojo en el local');await h.sendQueued('en efectivo');await h.sendQueued('confirmar');
 expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
 expect(h.service.ordersService.create.mock.calls[0][0].items).toEqual([expect.objectContaining({productId:94771})]);
});

for(const family of ['Combo','Wrap','Bowl'])for(const agent of [false,true])
for(const prefix of ['es solo','solo','solamente'])for(const choice of ['number','name','ordinal'])
for(const checkout of [false,true])for(const quantity of [1,2]){
 test(`${family}/${agent}/${prefix}/${choice}/checkout=${checkout}/qty=${quantity}: correction resumes without changing unrelated rows`,async()=>{
  const {h,names}=await start(family,agent,checkout,quantity);
  expect(h.cartRows().map(row=>row.qty)).toEqual([quantity,quantity]);
  const before=structuredClone(h.conv.sessionData.cart),address=h.conv.sessionData.address;
  await h.sendQueued('qué precio tienen');expect(h.conv.sessionData.pendingPriceInquiry).toBeDefined();
  const clarification=await h.sendQueued(`${prefix} ${quantity===1?'un':'dos'} ${family}${quantity===2?'s':''}`);
  expect(clarification).toMatch(/Cuál línea/);expect(h.conv.sessionData.pendingPriceInquiry).toBeUndefined();
  expect(h.conv.sessionData.pendingCartQuantity).toBeDefined();
  const reply=await h.sendQueued(choice==='number'?'1':choice==='name'?names[0]:'el primero');
  expect(reply).toContain(`ya tiene ${quantity}`);expect(reply).toMatch(/demás líneas se conservan/);
  expect(reply).not.toMatch(/corregí la cantidad|varias listas|no me quedó clara la dirección/i);
  expect(h.conv.sessionData.pendingCartQuantity).toBeUndefined();expect(h.conv.sessionData.pendingPriceInquiry).toBeUndefined();
  expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.address).toBe(address);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued(`quita el ${names[1]}`);
  expect(h.cartRows()).toEqual([expect.objectContaining({id:94771,qty:quantity})]);
  if(!checkout){await h.sendQueued('no más, recojo en el local');await h.sendQueued('en efectivo');}
  await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];
  expect(dto.items).toHaveLength(quantity);expect(dto.items.every((item:any)=>item.productId===94771)).toBe(true);
 });
}
