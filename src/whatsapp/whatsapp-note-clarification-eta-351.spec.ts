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

const queries=['¿Y cuánto se demora?','Cuánto tarda el domicilio','en cuánto llega','más o menos cuánto demora'];
for(const other of [false,true])for(const agent of [false,true])for(const checkout of [false,true])for(const configured of [false,true])for(const query of queries){
 it(`ETA and resume ${other} ${agent} ${checkout} ${configured} ${query}`,async()=>{
  const {h,choice}=setup(other,agent,checkout);
  if(configured)Object.assign(h.cfg.localContext,{deliveryTimeNote:'25-35'});
  await h.sendQueued('El broaster sin arroz');
  const before=structuredClone(h.conv.sessionData.cart),pending=structuredClone(h.conv.sessionData.pendingSubsetKitchenNote),state=h.conv.state;
  const reply=await h.sendQueued(query);
  if(configured)expect(reply).toMatch(/25-35 minutos/);
  else {expect(reply).toMatch(/confirmar el tiempo/i);expect(reply).not.toMatch(/35.?45|\d+ minutos/);}
  expect(reply).toMatch(/cu[aá]l l[ií]nea/i);expect(reply).toContain(choice);expect(reply).toContain('Cubos');
  expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingSubsetKitchenNote).toEqual(pending);
  expect(h.conv.state).toBe(state);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('2');
  expect(h.conv.sessionData.cart[0]).toEqual(before[0]);expect(h.conv.sessionData.cart[1].note).toMatch(/sin arroz/i);
  expect(h.conv.sessionData.cart[1].note).toMatch(/sin sal/i);expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeUndefined();
  if(!checkout){await h.sendQueued('no más');await h.sendQueued('contraentrega');}
  const receipt=await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items=h.service.ordersService.create.mock.calls[0][0].items;
  expect(items).toHaveLength(3);expect(items.filter(i=>/sin arroz/i.test(i.note||''))).toHaveLength(1);
  expect(receipt).toContain('75.000');
 });
}
for(const agent of [false,true])for(const scenario of ['expired','changed','payment','repeat','confirm','conditional','mixed','specific']){
 it(`ETA guard ${agent} ${scenario}`,async()=>{
  const {h}=setup(false,agent,true);Object.assign(h.cfg.localContext,{deliveryTimeNote:'25-35'});
  await h.sendQueued('El broaster sin arroz');
  if(scenario==='expired')h.conv.sessionData.pendingSubsetKitchenNote!.preparationScope!.createdAt-=11*60*1000;
  if(scenario==='changed')h.conv.sessionData.cart[0].quantity++;
  if(scenario==='payment')h.conv.sessionData.mpPreferenceId='synthetic-only';
  const before=structuredClone(h.conv.sessionData.cart);
  const messages:Record<string,string>={conditional:'si cambio uno cuánto demora',mixed:'cuánto demora y confirmar',specific:'cuándo llega mi orden #60'};
  const reply=await h.sendQueued(messages[scenario]||'cuánto demora');
  expect(h.conv.sessionData.cart).toEqual(before);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(['expired','changed'].includes(scenario))expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeUndefined();
  else expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeDefined();
  if(['expired','changed','payment','conditional','mixed','specific'].includes(scenario))expect(reply).not.toMatch(/25-35/);
  if(scenario==='repeat'){const pending=structuredClone(h.conv.sessionData.pendingSubsetKitchenNote);expect(await h.sendQueued('cuánto demora')).toMatch(/25-35 minutos/);expect(h.conv.sessionData.pendingSubsetKitchenNote).toEqual(pending);}
  if(scenario==='confirm'){await h.sendQueued('confirmar');expect(h.service.ordersService.create).not.toHaveBeenCalled();expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeDefined();}
 });
}

for(const agent of [false,true])for(const query of ['veci cuánto se demoran porfa','cuál es el tiempo de entrega','en cuánto llegaría el domicilio','cuánto tarda el envío'])it(`courtesy ETA and cancel ${agent} ${query}`,async()=>{
 const {h}=setup(false,agent,true);Object.assign(h.cfg.localContext,{deliveryTimeNote:'40-50 minutos'});
 await h.sendQueued('El broaster sin arroz');const before=structuredClone(h.conv.sessionData.cart),pending=structuredClone(h.conv.sessionData.pendingSubsetKitchenNote);
 const reply=await h.sendQueued(query);expect(reply).toMatch(/40-50 minutos/);expect(reply).toMatch(/cu[aá]l l[ií]nea/i);
 expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingSubsetKitchenNote).toEqual(pending);
 await h.sendQueued('no apliques esa nota');expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeUndefined();expect(h.conv.sessionData.cart).toEqual(before);
 expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
