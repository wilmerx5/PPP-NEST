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
for(const other of [false,true])for(const agent of [false,true])for(const checkout of [false,true])for(const repair of ['no, el otro','perdón, el segundo','mejor el segundo']){
 it(`redirect whole selected line ${other} ${agent} ${checkout} ${repair}`,async()=>{
  const h=setup(other,agent,checkout),before=structuredClone(h.conv.sessionData.cart),state=h.conv.state;
  await h.sendQueued('El broaster sin arroz');await h.sendQueued('1');
  expect(h.conv.sessionData.cart[1].note).toMatch(/sin arroz/i);
  const reply=await h.sendQueued(repair);
  expect(h.conv.sessionData.cart[0]).toEqual(before[0]);expect(h.conv.sessionData.cart[1]).toEqual(before[1]);
  expect(h.conv.sessionData.cart[2]).toMatchObject({...before[2],note:expect.stringMatching(/sin arroz/i)});
  expect(h.conv.sessionData.cart[2].note).toMatch(/sin sal/i);
  expect(h.conv.sessionData.cart.reduce((n,l)=>n+l.quantity,0)).toBe(4);
  expect(h.conv.state).toBe(state);expect(reply).toMatch(/pas[eé].*nota/i);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(!checkout){await h.sendQueued('no más');await h.sendQueued('contraentrega');}
  const receipt=await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items=h.service.ordersService.create.mock.calls[0][0].items;expect(items).toHaveLength(4);
  expect(items.filter(i=>/sin arroz/i.test(i.note||''))).toHaveLength(1);
  expect(items.filter(i=>i.note==='Salsa aparte')).toHaveLength(2);expect(receipt).toContain('78.000');
 });
}

for(const agent of [false,true])for(const scenario of ['expired','quantity changed','note changed','payment','pending choice','conflict','invalid scope','interrupted','repeat','original note','unrelated product','question','same line']){
 it(`whole line redirect guard ${agent} ${scenario}`,async()=>{
  const h=setup(false,agent,true);
  if(scenario==='conflict')h.conv.sessionData.cart[2].note='Con arroz';
  if(scenario==='original note')h.conv.sessionData.cart[1].note='Salsa aparte; sin arroz';
  await h.sendQueued('El broaster sin arroz');await h.sendQueued('1');
  if(scenario==='expired')h.conv.sessionData.lastKitchenNoteSelection!.createdAt-=11*60*1000;
  if(scenario==='quantity changed')h.conv.sessionData.cart[2].quantity++;
  if(scenario==='note changed')h.conv.sessionData.cart[0].note='Al clima';
  if(scenario==='payment')h.conv.sessionData.mpPreferenceId='synthetic-only';
  if(scenario==='pending choice')h.conv.sessionData.pendingMatch={query:'otro',quantity:1,candidates:[{id:97901,code:1,name:'Ejecutivo Con Pollo Broaster',price:25000,availableNow:true,attributes:[]}],intent:'order'};
  if(scenario==='invalid scope')h.conv.sessionData.lastKitchenNoteSelection!.lineIndices=[1,99];
  if(scenario==='interrupted')await h.sendQueued('gracias');
  if(scenario==='repeat')await h.sendQueued('no, el otro');
  const before=structuredClone(h.conv.sessionData.cart);
  const phrase=scenario==='unrelated product'?'no, el Agua Mineral':scenario==='question'?'¿no, el otro?':scenario==='same line'?'no, el primero':'no, el otro';
  const reply=await h.sendQueued(phrase);
  expect(h.conv.sessionData.cart).toEqual(before);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  expect(reply?.length).toBeGreaterThan(0);
 });
}
for(const agent of [false,true])for(const answer of ['2','el de Cubos','sin sal']){
 it(`three candidates require destination ${agent} ${answer}`,async()=>{
  const h=setup(true,agent,true);
  h.conv.sessionData.cart.push({...structuredClone(h.conv.sessionData.cart[2]),attributes:[{attributeName:'Corte',attributeValue:'Tiras'}],note:'Sin cilantro'});
  const original=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('El broaster sin arroz');await h.sendQueued('1');
  const selected=structuredClone(h.conv.sessionData.cart);
  const question=await h.sendQueued('no, el otro');
  expect(h.conv.sessionData.cart).toEqual(selected);expect(question).toContain('Cubos');expect(question).toContain('Tiras');
  expect(question).not.toContain('Agua Mineral');
  await h.sendQueued(answer);
  expect(h.conv.sessionData.cart[0]).toEqual(original[0]);expect(h.conv.sessionData.cart[1]).toEqual(original[1]);expect(h.conv.sessionData.cart[3]).toEqual(original[3]);
  expect(h.conv.sessionData.cart[2]).toMatchObject({...original[2],note:expect.stringMatching(/sin arroz/i)});
  expect(h.conv.sessionData.cart[2].note).toMatch(/sin sal/i);expect(h.conv.state).toBe('awaiting_final_confirm');
 });
}
