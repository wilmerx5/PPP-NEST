import {harness} from './whatsapp-accuracy.test-support';
async function start(dish:string,agent:boolean,checkout=false,otherName='Limonada Natural'){
 const h=harness([{id:94781,code:81,name:dish,price:18000,availableNow:true,attributes:[]},
 {id:94782,code:82,name:otherName,price:5000,availableNow:true,attributes:[]}],agent);
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Qué deseas?',actions:{}});
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:478,dailyOrderNumber:478});
 h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 await h.sendQueued(`quiero un ${dish} y una ${otherName}`);
 expect(h.cartRows().map(row=>row.qty)).toEqual([1,1]);
 if(checkout){await h.sendQueued('no más, recojo en el local');await h.sendQueued('en efectivo');expect(h.conv.state).toBe('awaiting_final_confirm');}
 return h;
}
for(const agent of [false,true])test(`explicit named quantity baseline ${agent}`,async()=>{
 const h=await start('Bowl Andino',agent);
 const reply=await h.sendQueued('cambia la cantidad de Bowl Andino a 2');
 expect(h.cartRows()).toEqual([expect.objectContaining({id:94781,qty:2}),expect.objectContaining({id:94782,qty:1})]);
 expect(reply).toMatch(/corregí la cantidad/);
 expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
const forms=[
 (d:string,n:string)=>`cambia la cantidad de ${d} a ${n}`,
 (d:string,n:string)=>`cámbiame la cantidad de ${d} a ${n}`,
 (d:string,n:string)=>`modifica la cantidad de ${d} a ${n}`,
 (d:string,n:string)=>`ajústame la cantidad de ${d} a ${n}`,
 (d:string,n:string)=>`cambia la cantidad de ${d} en ${n}`,
 (d:string,n:string)=>`cambia la cantidad del ${d} a ${n}`,
 (d:string,n:string)=>`cambia la cantidad de la ${d} a ${n} porfa`,
 (d:string,n:string)=>`cambia la cantidad de ${d} a ${n} unidades`,
];
for(const dish of ['Bowl Andino','Wrap Vegetal','Arroz Con Pollo'])for(const agent of [false,true])
for(const [formIndex,form] of forms.entries())for(const [word,quantity] of [['uno',1],['2',2],['tres',3]] as const)
for(const stage of ['cart','price','review']){
 test(`${dish}/${agent}/${formIndex}/${word}/${stage}: absolute quantity preserves other line and closes once`,async()=>{
  const h=await start(dish,agent,stage==='review');
  const other=structuredClone(h.conv.sessionData.cart[1]),address=h.conv.sessionData.address;
  if(stage==='price'){await h.sendQueued('qué precio tienen');expect(h.conv.sessionData.pendingPriceInquiry).toBeDefined();}
  const reply=await h.sendQueued(form(dish,word));
  expect(h.cartRows()).toEqual([expect.objectContaining({id:94781,qty:quantity}),expect.objectContaining({id:94782,qty:1})]);
  expect(h.conv.sessionData.cart[1]).toEqual(other);expect(h.conv.sessionData.address).toBe(address);
  expect(h.conv.sessionData.pendingPriceInquiry).toBeUndefined();expect(h.conv.sessionData.pendingCartQuantity).toBeUndefined();
  expect(reply).toMatch(quantity===1?/ya tiene 1/:/corregí la cantidad/);
  expect(reply).not.toMatch(/no.*dirección|varias listas/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(stage!=='review'){await h.sendQueued('no más, recojo en el local');await h.sendQueued('en efectivo');}
  await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toHaveLength(quantity+1);
  expect(dto.items.filter((item:any)=>item.productId===94781)).toHaveLength(quantity);
  expect(dto.items.filter((item:any)=>item.productId===94782)).toHaveLength(1);
 });
}
for(const agent of [false,true])for(const input of [
 '¿cambia la cantidad de Bowl Andino a 2?',
 'cambia la cantidad de Bowl Andino a 0',
 'cambia la cantidad de Bowl Andino a 31',
 'cambia la cantidad de Pasta Del Huerto a 2',
])test(`question/invalid/unordered target ${agent}/${input}: preserve cart`,async()=>{
 const h=await start('Bowl Andino',agent);const cart=structuredClone(h.conv.sessionData.cart),address=h.conv.sessionData.address;
 await h.sendQueued(input);expect(h.conv.sessionData.cart).toEqual(cart);expect(h.conv.sessionData.address).toBe(address);
 expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
for(const family of ['Bowl','Wrap'])for(const agent of [false,true])for(const choice of ['2','name','la segunda']){
 test(`ambiguous family ${family}/${agent}/${choice}: ask before changing one line`,async()=>{
  const h=await start(family+' Clásico',agent,true,family+' Especial');
  const before=structuredClone(h.conv.sessionData.cart),address=h.conv.sessionData.address;
  const question=await h.sendQueued(`cambia la cantidad de ${family} a 2`);
  expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingCartQuantity?.options).toHaveLength(2);
  expect(question).toMatch(/Cuál línea/);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  const reply=await h.sendQueued(choice==='name'?family+' Especial':choice);
  expect(h.cartRows()).toEqual([expect.objectContaining({id:94781,qty:1}),expect.objectContaining({id:94782,qty:2})]);
  expect(h.conv.sessionData.cart[0]).toEqual(before[0]);expect(h.conv.sessionData.address).toBe(address);
  expect(h.conv.sessionData.pendingCartQuantity).toBeUndefined();expect(reply).toMatch(/corregí la cantidad/);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toHaveLength(3);
  expect(dto.items.filter((i:any)=>i.productId===94782)).toHaveLength(2);
 });
}
