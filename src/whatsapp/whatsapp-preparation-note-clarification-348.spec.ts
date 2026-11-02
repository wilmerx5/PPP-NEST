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
for(const other of [false,true])for(const agent of [false,true])for(const checkout of [false,true])for(const answer of ['number','option','note']){
 it(`clarification journey ${other} ${agent} ${checkout} ${answer}`,async()=>{
  const {h,choice}=setup(other,agent,checkout),before=structuredClone(h.conv.sessionData.cart),state=h.conv.state;
  const question=await h.sendQueued('El broaster sin arroz');
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(question).toMatch(/sin arroz/i);expect(question).toContain(choice);expect(question).toContain('Cubos');
  const reply=await h.sendQueued(answer==='number'?'1':answer==='option'?`el de ${choice}`:'salsa aparte');
  expect(h.conv.sessionData.cart[0]).toMatchObject({...before[0],note:expect.stringMatching(/sin arroz/i)});
  expect(h.conv.sessionData.cart[0].note).toMatch(/salsa aparte/i);
  expect(h.conv.sessionData.cart[1]).toEqual(before[1]);
  expect(h.conv.sessionData.cart.reduce((n,l)=>n+l.quantity,0)).toBe(3);
  expect(h.conv.state).toBe(state);expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeUndefined();
  expect(reply).toMatch(/sin arroz/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(!checkout){await h.sendQueued('no más');await h.sendQueued('contraentrega');}
  const receipt=await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items=h.service.ordersService.create.mock.calls[0][0].items;
  expect(items).toHaveLength(3);expect(items.filter(i=>/sin arroz/i.test(i.note||''))).toHaveLength(2);
  expect(items.find(i=>i.note==='Sin sal')).toMatchObject({attributes:before[1].attributes});
  expect(receipt).toContain('75.000');
 });
}

for(const agent of [false,true])for(const scenario of ['yes','confirm','invalid number','several','question','repeat','unknown','cancel note','expired','changed cart','reordered','conflict','payment']){
 it(`clarification guard ${agent} ${scenario}`,async()=>{
  const {h}=setup(false,agent,true);
  if(scenario==='conflict')h.conv.sessionData.cart[0].note='Con arroz';
  await h.sendQueued('El broaster sin arroz');
  expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeDefined();
  const pending=h.conv.sessionData.pendingSubsetKitchenNote!;
  if(scenario==='expired')pending.preparationScope!.createdAt-=11*60*1000;
  if(scenario==='changed cart')h.conv.sessionData.cart[0].quantity++;
  if(scenario==='reordered')h.conv.sessionData.cart.reverse();
  if(scenario==='payment')h.conv.sessionData.mpPreferenceId='synthetic-only';
  const before=structuredClone(h.conv.sessionData.cart);
  const answers:Record<string,string>={yes:'sí',confirm:'confirmar','invalid number':'9',several:'1 y 2',question:'¿el de pechuga?',repeat:'El broaster sin arroz',unknown:'el azul','cancel note':'no apliques esa nota'};
  const reply=await h.sendQueued(answers[scenario]||'1');
  expect(h.conv.sessionData.cart).toEqual(before);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  expect(h.conv.state).toBe('awaiting_final_confirm');
  expect(reply).toMatch(/igual|pendiente|nota|selecci[oó]n/i);
  if(['expired','changed cart','reordered','cancel note'].includes(scenario))expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeUndefined();
  else expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeDefined();
 });
}
for(const agent of [false,true])it(`selection names a different dish ${agent}`,async()=>{
 const {h}=setup(true,agent,true);
 h.conv.sessionData.cart[1]={...h.conv.sessionData.cart[1],productId:97802,name:'Plato Con Pescado Broaster'};
 const before=structuredClone(h.conv.sessionData.cart);
 await h.sendQueued('El broaster sin arroz');
 const reply=await h.sendQueued('Plato Con Pescado Broaster');
 expect(h.conv.sessionData.cart[0]).toEqual(before[0]);
 expect(h.conv.sessionData.cart[1]).toMatchObject({...before[1],note:expect.stringMatching(/sin arroz/i)});
 expect(h.conv.sessionData.cart[1].note).toMatch(/sin sal/i);expect(reply).toMatch(/pescado/i);
 expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeUndefined();expect(h.conv.state).toBe('awaiting_final_confirm');
});

for(const agent of [false,true])for(const command of ['Cancelar.','reiniciar'])it(`cancel draft during note clarification ${agent} ${command}`,async()=>{
 const {h}=setup(false,agent,true);await h.sendQueued('El broaster sin arroz');
 expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeDefined();
 const reply=await h.sendQueued(command);
 expect(h.conv.sessionData.cart).toEqual([]);expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeUndefined();
 expect(h.service.ordersService.create).not.toHaveBeenCalled();expect(reply).toMatch(/cancel|vaci|descart/i);
});
