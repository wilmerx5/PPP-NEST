import {harness} from './whatsapp-accuracy.test-support';
function setup(other:boolean,agent:boolean,checkout:boolean){
 const name=other?'Bandeja Con Tofu Broaster':'Ejecutivo Con Pollo Broaster';
 const key=other?'Corte':'Presa',choice=other?'Filete':'Pechuga';
 const menu=[{id:97801,code:1,name,price:25000,availableNow:true,hasAttributes:true,attributes:[{attributeName:key,options:[choice,'Cubos']},{attributeName:'Bebida',options:['Limonada','Cola']}]}];
 const h=harness(menu,agent);
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'Aclaremos el pedido',actions:{}});
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:348,dailyOrderNumber:348});
 h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 h.conv.sessionData.cart=[{productId:97801,code:1,name,quantity:2,unitPrice:25000,attributes:[{attributeName:key,attributeValue:choice},{attributeName:'Bebida',attributeValue:'Limonada'}],note:'Salsa aparte'},
 {productId:97801,code:1,name,quantity:1,unitPrice:25000,attributes:[{attributeName:key,attributeValue:'Cubos'},{attributeName:'Bebida',attributeValue:'Cola'}],note:'Sin sal'}];
 h.conv.state=checkout?'awaiting_final_confirm':'building_cart';if(checkout)h.conv.sessionData.paymentMethod='contraentrega';
 return {h,choice};
}

const queries=['¿Cuánto es el total?','cuanto llevo','Antes de seguir, cuánto vale todo','de todo lo que pedi','no mas, cuanto es?','me regalas el total porfa'];
for(const other of [false,true])for(const agent of [false,true])for(const checkout of [false,true])for(const query of queries){
 it(`total and resume ${other} ${agent} ${checkout} ${query}`,async()=>{
  const {h,choice}=setup(other,agent,checkout);
  await h.sendQueued('El broaster sin arroz');
  const before=structuredClone(h.conv.sessionData.cart),pending=structuredClone(h.conv.sessionData.pendingSubsetKitchenNote),state=h.conv.state;
  const reply=await h.sendQueued(query);
  expect(reply).toMatch(/75[.,]000/);expect(reply).toMatch(/cu[aá]l l[ií]nea/i);
  expect(reply).toContain(choice);expect(reply).toContain('Cubos');expect(reply).toMatch(/sin arroz/i);
  expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingSubsetKitchenNote).toEqual(pending);
  expect(h.conv.state).toBe(state);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('2');
  expect(h.conv.sessionData.cart[0]).toEqual(before[0]);
  expect(h.conv.sessionData.cart[1]).toMatchObject({...before[1],note:expect.stringMatching(/sin arroz/i)});
  expect(h.conv.sessionData.cart[1].note).toMatch(/sin sal/i);
  expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeUndefined();
  if(!checkout){await h.sendQueued('no más');await h.sendQueued('contraentrega');}
  const receipt=await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items=h.service.ordersService.create.mock.calls[0][0].items;
  expect(items).toHaveLength(3);expect(items.filter(i=>/sin arroz/i.test(i.note||''))).toHaveLength(1);
  expect(receipt).toContain('75.000');
 });
}
for(const agent of [false,true])for(const scenario of ['expired','changed','repeat','cancel','confirm','conditional','product price','mixed']){
 it(`total clarification guard ${agent} ${scenario}`,async()=>{
  const {h}=setup(false,agent,true);await h.sendQueued('El broaster sin arroz');
  if(scenario==='expired')h.conv.sessionData.pendingSubsetKitchenNote!.preparationScope!.createdAt-=11*60*1000;
  if(scenario==='changed')h.conv.sessionData.cart[0].quantity++;
  const before=structuredClone(h.conv.sessionData.cart);
  const queries:Record<string,string>={conditional:'cuánto sería el total si quito uno', 'product price':'cuánto vale el de pechuga',mixed:'cuánto es el total y agrega dos más'};
  const reply=await h.sendQueued(queries[scenario]||'cuanto es el total');
  expect(h.conv.sessionData.cart).toEqual(before);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(['expired','changed'].includes(scenario)){
   expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeUndefined();expect(reply).toMatch(/cambi[oó]|venci[oó]/i);
  }else{
   expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeDefined();
   if(['conditional','product price','mixed'].includes(scenario))expect(reply).not.toMatch(/Total.*75[.,]000/i);
   if(scenario==='repeat'){const again=await h.sendQueued('cuanto es el total');expect(again).toMatch(/75[.,]000/);expect(h.conv.sessionData.cart).toEqual(before);}
   if(scenario==='cancel'){await h.sendQueued('no apliques esa nota');expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeUndefined();expect(h.conv.sessionData.cart).toEqual(before);}
   if(scenario==='confirm'){await h.sendQueued('confirmar');expect(h.service.ordersService.create).not.toHaveBeenCalled();expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeDefined();}
  }
 });
}

for(const agent of [false,true])for(const fee of [undefined,4000])it(`delivery total preserves clarification ${agent} ${fee}`,async()=>{
 const {h}=setup(false,agent,false);
 h.conv.sessionData.orderType='delivery';h.conv.sessionData.deliveryFeeCalculated=fee;
 await h.sendQueued('El broaster sin arroz');
 const pending=structuredClone(h.conv.sessionData.pendingSubsetKitchenNote),before=structuredClone(h.conv.sessionData.cart);
 const reply=await h.sendQueued('cuál es el total con el domicilio');
 expect(reply).toMatch(fee===undefined?/75[.,]000/:/79[.,]000/);
 if(fee===undefined)expect(reply).toMatch(/pendiente|provisional/i);
 expect(h.conv.sessionData.pendingSubsetKitchenNote).toEqual(pending);expect(h.conv.sessionData.cart).toEqual(before);
 expect(h.service.ordersService.create).not.toHaveBeenCalled();
 await h.sendQueued('2');expect(h.conv.sessionData.cart[0]).toEqual(before[0]);expect(h.conv.sessionData.cart[1].note).toMatch(/sin arroz/i);
});
