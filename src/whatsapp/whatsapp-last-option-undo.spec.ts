import {harness} from './whatsapp-accuracy.test-support';
const menus=[{name:'Bao De Hongos',attr:'Salsa',a:'Teriyaki',b:'Ponzu'}, {name:'Pizza Del Huerto',attr:'Masa',a:'Fina',b:'Gruesa'}, {name:'Batido De Mango',attr:'Base',a:'Leche',b:'Agua'}];
for(const f of menus)for(const enabled of [false,true])for(const scenario of ['direct','price','contact','later-note','expired','missing','repeat','withdrawn-option','pending']){
 test(`${f.name} undo last applied option ${scenario} agent=${enabled}`,async()=>{
  const p={id:89101,code:89101,name:f.name,price:18000,availableNow:true,hasAttributes:true,attributes:[{attributeName:f.attr,options:[f.a,f.b]}]};
  const h=harness([p],enabled);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:131,dailyOrderNumber:131});
  h.conv.state='awaiting_final_confirm';
  Object.assign(h.conv.sessionData,{cart:[{productId:p.id,code:p.code,name:p.name,quantity:3,unitPrice:p.price,attributes:[{attributeName:f.attr,attributeValue:f.a}],note:'bien empacado'}],orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,paymentMethod:'contraentrega'});
  const original=structuredClone(h.conv.sessionData.cart);
  if(scenario!=='missing')await h.sendQueued(`Cambia la ${f.attr} de dos ${f.name} a ${f.b}`);
  if(scenario==='price')await h.sendQueued('cuánto cuesta todo');
  if(scenario==='contact')await h.sendQueued('a nombre de Ana Perez');
  if(scenario==='later-note')await h.sendQueued('a la primera ponle como nota sin ajo');
  if(scenario==='expired')(h.conv.sessionData.lastUnitOptionEdit as any).createdAt=Date.now()-11*60*1000;
  if(scenario==='withdrawn-option')p.attributes[0].options=[f.b];
  if(scenario==='pending')h.conv.sessionData.pendingMatch={query:f.name,candidates:[p],createdAt:Date.now()} as any;
  const before=structuredClone(h.conv.sessionData.cart);
  const state=h.conv.state;
  const reply=await h.sendQueued(scenario==='price'?'deshaz eso':scenario==='contact'?'revierte el último cambio':'deshaz el último cambio');
  const blocked=['later-note','expired','missing','withdrawn-option','pending'].includes(scenario);
  expect(h.conv.sessionData.cart).toEqual(blocked?before:original);
  expect(reply).toMatch(blocked?/cu[aá]l|aclar|indica/i:/deshecho|revert|restaur/i);
  expect(h.conv.state).toBe(state);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(scenario==='contact')expect(h.conv.customerName).toBe('Ana Perez');
  if(scenario==='repeat'){
   const again=await h.sendQueued('deshaz el último cambio');expect(again).toMatch(/cu[aá]l|aclar|indica/i);expect(h.conv.sessionData.cart).toEqual(original);
  }
  if(!blocked){
   await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
   const items=h.service.ordersService.create.mock.calls[0][0].items;expect(items).toHaveLength(3);
   for(const item of items){expect(item.note).toBe('bien empacado');expect(item.attributes[0].attributeValue).toBe(f.a);}
  }
 });
}

for(const f of menus)for(const enabled of [false,true])for(const scenario of ['second-edit','second-after-price','reset','confirmed','closed']){
 test(`${f.name} undo lifecycle ${scenario} agent=${enabled}`,async()=>{
  const p={id:89101,code:89101,name:f.name,price:18000,availableNow:true,hasAttributes:true,attributes:[{attributeName:f.attr,options:[f.a,f.b]}]};
  const h=harness([p],enabled);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:132,dailyOrderNumber:132});h.conv.state='awaiting_final_confirm';
  h.service.conversationService.reopenForNewOrder=jest.fn(async()=>h.service.conversationService.resetOrderSession(h.conv,'building_cart',{ignorePriorHistory:true}));
  Object.assign(h.conv.sessionData,{cart:[{productId:p.id,code:p.code,name:p.name,quantity:3,unitPrice:p.price,attributes:[{attributeName:f.attr,attributeValue:f.a}],note:'bien empacado'}],orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,paymentMethod:'contraentrega'});
  await h.sendQueued(`Cambia la ${f.attr} de dos ${f.name} a ${f.b} sin cebolla`);
  const first=structuredClone(h.conv.sessionData.cart);
  expect(first.find(l=>l.attributes?.some(a=>a.attributeValue===f.b))).toMatchObject({quantity:2});
  if(scenario.startsWith('second')){
   if(scenario==='second-after-price'){await h.sendQueued('cuánto cuesta todo');expect(h.conv.sessionData.cart).toEqual(first);}
   await h.sendQueued(`Cambia la ${f.attr} de una ${f.name} con ${f.b} a ${f.a} sin ajo`);
   expect(h.conv.sessionData.cart).not.toEqual(first);
   const reply=await h.sendQueued('deshaz el último cambio');expect(reply).toMatch(/deshecho|restaur/i);
   expect(h.conv.sessionData.cart).toEqual(first);expect(h.conv.state).toBe('awaiting_final_confirm');
   expect(h.service.ordersService.create).not.toHaveBeenCalled();await h.sendQueued('confirmar');
   const items=h.service.ordersService.create.mock.calls[0][0].items;expect(items).toHaveLength(3);
   expect(items.filter(i=>i.attributes.some(a=>a.attributeValue===f.b))).toHaveLength(2);
   expect(items.filter(i=>i.note?.includes('sin cebolla'))).toHaveLength(2);
   expect(items.some(i=>i.note?.includes('sin ajo'))).toBe(false);
  }else{
   if(scenario==='closed'){h.conv.state='closed';h.conv.sessionData.cart=[];}
   else await h.sendQueued(scenario==='reset'?'reiniciar':'confirmar');
   const before=structuredClone(h.conv.sessionData.cart);
   const calls=h.service.ordersService.create.mock.calls.length;
   const reply=await h.sendQueued('deshaz el último cambio');
   expect(h.conv.sessionData.cart).toEqual(before);if(scenario!=='closed')expect(reply).not.toMatch(/deshecho|restaurado/i);
   expect(h.service.ordersService.create).toHaveBeenCalledTimes(calls);
   if(scenario==='closed'){expect(calls).toBe(0);expect(h.conv.state).toBe('closed');expect(h.service.conversationService.reopenForNewOrder).not.toHaveBeenCalled();expect(reply).toMatch(/conversaci[oó]n.*cerrada/i);expect(reply).not.toMatch(/pedido.*registrado/i);}
   else if(scenario==='reset')expect(h.conv.sessionData.cart).toEqual([]);
   else {expect(calls).toBe(1);expect(h.conv.state).toBe('completed');expect(h.service.conversationService.reopenForNewOrder).not.toHaveBeenCalled();expect(reply).toMatch(/registrado|confirmado/i);}
  }
 });
}

for(const f of menus)for(const enabled of [false,true]){
 test(`${f.name} undo after choosing a previously ambiguous row agent=${enabled}`,async()=>{
  const p={id:89101,code:89101,name:f.name,price:18000,availableNow:true,hasAttributes:true,attributes:[{attributeName:f.attr,options:[f.a,f.b]}]};
  const h=harness([p],enabled);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:132,dailyOrderNumber:132});h.conv.state='awaiting_final_confirm';
  const line=(note:string)=>({productId:p.id,code:p.code,name:p.name,quantity:2,unitPrice:p.price,attributes:[{attributeName:f.attr,attributeValue:f.a}],note});
  Object.assign(h.conv.sessionData,{cart:[line('sin cebolla'),line('bien empacado')],orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,paymentMethod:'contraentrega'});
  const original=structuredClone(h.conv.sessionData.cart);
  const question=await h.sendQueued(`Cambia la ${f.attr} de una ${f.name} a ${f.b}`);
  expect(question).toMatch(/cu[aá]l|línea/i);expect(h.conv.sessionData.cart).toEqual(original);
  expect(h.conv.sessionData.pendingCartAttributeEdit?.unitChanges).toHaveLength(2);
  await h.sendQueued('2');expect(h.conv.sessionData.cart).not.toEqual(original);
  const reply=await h.sendQueued('deshaz el último cambio');expect(reply).toMatch(/deshecho/i);expect(h.conv.sessionData.cart).toEqual(original);
  expect(h.conv.sessionData.pendingCartAttributeEdit).toBeFalsy();
  expect(h.service.ordersService.create).not.toHaveBeenCalled();await h.sendQueued('confirmar');
  const items=h.service.ordersService.create.mock.calls[0][0].items;expect(items).toHaveLength(4);
  expect(items.filter(i=>i.note==='sin cebolla')).toHaveLength(2);expect(items.filter(i=>i.note==='bien empacado')).toHaveLength(2);
  expect(items.every(i=>i.attributes[0].attributeValue===f.a)).toBe(true);
 });
}
