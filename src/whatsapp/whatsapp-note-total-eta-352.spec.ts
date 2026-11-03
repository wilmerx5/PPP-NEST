import {harness} from './whatsapp-accuracy.test-support';
function setup(other:boolean,agent:boolean,checkout:boolean){
 const name=other?'Bandeja Con Tofu Broaster':'Ejecutivo Con Pollo Broaster',key=other?'Corte':'Presa',choice=other?'Filete':'Pechuga';
 const menu=[{id:97901,code:1,name,price:25000,availableNow:true,hasAttributes:true,attributes:[{attributeName:key,options:[choice,'Cubos']},{attributeName:'Bebida',options:['Limonada','Cola']}]},
 {id:97902,code:2,name:'Agua Mineral',price:3000,availableNow:true,hasAttributes:false,attributes:[]}];
 const h=harness(menu,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'Aclaremos el pedido',actions:{}});
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:349,dailyOrderNumber:349});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 h.conv.sessionData.cart=[{productId:97902,code:2,name:'Agua Mineral',quantity:1,unitPrice:3000,attributes:[],note:'Fría'},
 {productId:97901,code:1,name,quantity:2,unitPrice:25000,attributes:[{attributeName:key,attributeValue:choice},{attributeName:'Bebida',attributeValue:'Limonada'}],note:'Salsa aparte'},
 {productId:97901,code:1,name,quantity:1,unitPrice:25000,attributes:[{attributeName:key,attributeValue:'Cubos'},{attributeName:'Bebida',attributeValue:'Cola'}],note:'Sin sal'}];
 h.conv.state=checkout?'awaiting_final_confirm':'building_cart';if(checkout)h.conv.sessionData.paymentMethod='contraentrega';
 return h;
}
const queries=['cuánto es y cuánto demora?','cuánto tarda y cuánto es todo?','la cuenta por favor y en cuánto llega?','me confirmas tiempo y valor'];
for(const other of [false,true])for(const agent of [false,true])for(const checkout of [false,true])for(const configured of [false,true])for(const query of queries){
 it(`combined inquiry and redirect ${other} ${agent} ${checkout} ${configured} ${query}`,async()=>{
  const h=setup(other,agent,checkout),before=structuredClone(h.conv.sessionData.cart),state=h.conv.state;
  if(configured)Object.assign(h.cfg.localContext,{deliveryTimeNote:'25-35'});
  await h.sendQueued('El broaster sin arroz');const pending=structuredClone(h.conv.sessionData.pendingSubsetKitchenNote);
  const reply=await h.sendQueued(query);expect(reply).toContain('78.000');
  if(configured)expect(reply).toMatch(/25-35 minutos/);else {expect(reply).toMatch(/confirmar el tiempo/);expect(reply).not.toMatch(/35.?45/);}
  expect(reply).toMatch(/cu[aá]l l[ií]nea/i);expect(reply).toMatch(/sin arroz/i);expect(reply).toContain('Cubos');
  expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.state).toBe(state);expect(h.conv.sessionData.pendingSubsetKitchenNote).toEqual(pending);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('1');expect(h.conv.sessionData.cart[1].note).toMatch(/sin arroz/i);
  await h.sendQueued('no, el otro');
  expect(h.conv.sessionData.cart[0]).toEqual(before[0]);expect(h.conv.sessionData.cart[1]).toEqual(before[1]);
  expect(h.conv.sessionData.cart[2]).toMatchObject({...before[2],note:expect.stringMatching(/sin arroz/i)});expect(h.conv.sessionData.cart[2].note).toMatch(/sin sal/i);
  expect(h.conv.state).toBe(state);expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeUndefined();
  if(!checkout){await h.sendQueued('no más');await h.sendQueued('contraentrega');}
  const receipt=await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items=h.service.ordersService.create.mock.calls[0][0].items;expect(items).toHaveLength(4);
  expect(items.filter(i=>/sin arroz/i.test(i.note||''))).toHaveLength(1);expect(items.filter(i=>i.note==='Salsa aparte')).toHaveLength(2);expect(receipt).toContain('78.000');
 });
}
for(const agent of [false,true])for(const scenario of ['expired','changed','payment','repeat','confirm','conditional','mixed','cancel'])it(`combined inquiry guard ${agent} ${scenario}`,async()=>{
 const h=setup(false,agent,true);Object.assign(h.cfg.localContext,{deliveryTimeNote:'25-35'});await h.sendQueued('El broaster sin arroz');
 if(scenario==='expired')h.conv.sessionData.pendingSubsetKitchenNote!.preparationScope!.createdAt-=11*60*1000;
 if(scenario==='changed')h.conv.sessionData.cart[1].quantity++;
 if(scenario==='payment')h.conv.sessionData.mpPreferenceId='synthetic-only';
 const before=structuredClone(h.conv.sessionData.cart),pending=structuredClone(h.conv.sessionData.pendingSubsetKitchenNote);
 const query=scenario==='conditional'?'si cambio uno cuánto es y cuánto demora':scenario==='mixed'?'cuánto es y cuánto demora y confirmar':'cuánto es y cuánto demora';
 const reply=await h.sendQueued(query);expect(h.conv.sessionData.cart).toEqual(before);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 if(['expired','changed'].includes(scenario))expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeUndefined();else expect(h.conv.sessionData.pendingSubsetKitchenNote).toEqual(pending);
 if(['expired','changed','payment','conditional','mixed'].includes(scenario))expect(reply).not.toMatch(/25-35/);
 if(scenario==='repeat'){expect(await h.sendQueued(query)).toMatch(/25-35 minutos/);expect(h.conv.sessionData.pendingSubsetKitchenNote).toEqual(pending);}
 if(scenario==='confirm'){await h.sendQueued('confirmar');expect(h.service.ordersService.create).not.toHaveBeenCalled();expect(h.conv.sessionData.pendingSubsetKitchenNote).toEqual(pending);}
 if(scenario==='cancel'){await h.sendQueued('no apliques esa nota');expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeUndefined();expect(h.conv.sessionData.cart).toEqual(before);}
});

for(const agent of [false,true])for(const fee of [undefined,4000])it(`combined delivery total ${agent} ${fee}`,async()=>{
 const h=setup(false,agent,false);h.conv.sessionData.orderType='delivery';h.conv.sessionData.deliveryFeeCalculated=fee;
 Object.assign(h.cfg.localContext,{deliveryTimeNote:'40-50 minutos'});await h.sendQueued('El broaster sin arroz');
 const before=structuredClone(h.conv.sessionData.cart),pending=structuredClone(h.conv.sessionData.pendingSubsetKitchenNote);
 const reply=await h.sendQueued('cuál es el total con domicilio y cuánto demora');
 expect(reply).toContain(fee===undefined?'78.000':'82.000');expect(reply).toMatch(/40-50 minutos/);
 if(fee===undefined)expect(reply).toMatch(/pendiente|provisional/i);
 expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingSubsetKitchenNote).toEqual(pending);
 expect(h.service.ordersService.create).not.toHaveBeenCalled();
 await h.sendQueued('2');expect(h.conv.sessionData.cart[1]).toEqual(before[1]);expect(h.conv.sessionData.cart[2].note).toMatch(/sin arroz/i);
});
