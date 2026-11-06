import {harness} from './whatsapp-accuracy.test-support';

for (const agent of [false,true]) for (const family of ['Hamburguesa','Pizza']) {
 for (const phrase of ['Para','Quiero una','Me das una']) {
  it(`offers catalog choices ${agent}/${family}/${phrase}`,async()=>{
   const menu=[
    {id:40301,code:1,name:`Mini ${family}`,categoryName:'Infantil',price:10000},
    {id:40302,code:2,name:'Clásica',categoryName:family+'s',price:22000},
    {id:40303,code:3,name:'Especial',categoryName:family+'s',price:28000},
   ].map(p=>({...p,availableNow:true,hasAttributes:false,attributes:[]}));
   const h=harness(menu,agent);
   const reply=await h.sendQueued(`${phrase} ${family.toLowerCase()}`);
   expect(h.conv.sessionData.cart).toEqual([]);
   expect(reply).toContain('Clásica');expect(reply).toContain('Especial');
   expect(h.conv.sessionData.pendingMatch?.candidates.map(p=>p.id)).toEqual([40302,40303]);
   await h.sendQueued('2');
   expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:40303,quantity:1})]);
  });
 }
 for (const question of ['Que precio tienen','Cuánto vale','Qué precio tiene']) {
  it(`resumes purchase after price ${agent}/${family}/${question}`,async()=>{
   const menu=[{id:40302,code:2,name:family+' Clásica',price:22000,availableNow:true,hasAttributes:false,attributes:[]}];
   const h=harness(menu,agent);
   h.service.ordersService.create=jest.fn().mockResolvedValue({id:403,dailyOrderNumber:403});
   h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
   await h.sendQueued(`Una ${family.toLowerCase()} clásica`);
   const before=structuredClone(h.conv.sessionData.cart);
   const reply=await h.sendQueued(question);
   expect(reply).toMatch(/22\.000/);expect(h.conv.sessionData.cart).toEqual(before);
   // The question remains answerable with an ordinary closing reply.
   expect(reply).toMatch(/Algo m[aá]s|agregar|confirmar/i);
   expect(h.service.ordersService.create).not.toHaveBeenCalled();
   await h.sendQueued('no');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
   expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
   expect(h.service.ordersService.create.mock.calls[0][0].items).toEqual([expect.objectContaining({productId:40302})]);
  });
 }
}

for (const agent of [false,true]) for (const state of ['awaiting_name','awaiting_address','awaiting_phone','awaiting_payment','awaiting_final_confirm']) {
 it(`price preserves the checkout step ${agent}/${state}`,async()=>{
  const h=harness([{id:40302,code:2,name:'Hamburguesa Clásica',price:22000,availableNow:true,hasAttributes:false,attributes:[]}],agent);
  await h.sendQueued('Una hamburguesa clásica');
  h.conv.state=state as typeof h.conv.state;
  const before=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued('Que precio tienen');
  expect(h.conv.state).toBe(state);expect(h.conv.sessionData.cart).toEqual(before);
  expect(reply).toMatch(/22\.000/);expect(reply).not.toMatch(/Algo m[aá]s/i);
  const reminders={awaiting_name:/a nombre/i,awaiting_address:/direcci[oó]n/i,awaiting_phone:/tel[eé]fono/i,awaiting_payment:/m[eé]todo de pago/i,awaiting_final_confirm:/confirmar/i};
  expect(reply).toMatch(reminders[state]);
 });
}

for (const agent of [false,true]) for (const text of ['¿Para hamburguesa?', 'Para hamburguesa sin cebolla', 'Para la Calle 6 #8-10']) {
 it(`does not interpret a longer or interrogative para phrase as category approval ${agent}/${text}`,async()=>{
  const h=harness([
   {id:40301,code:1,name:'Mini hamburguesa',categoryName:'Infantil',price:10000},
   {id:40302,code:2,name:'Clásica',categoryName:'Hamburguesas',price:22000},
   {id:40303,code:3,name:'Especial',categoryName:'Hamburguesas',price:28000},
  ].map(p=>({...p,availableNow:true,hasAttributes:false,attributes:[]})),agent);
  await h.sendQueued(text);
  expect(h.conv.sessionData.cart).toEqual([]);
 });
}

for (const agent of [false,true]) for (const family of ['Hamburguesa','Pizza']) {
 it(`keeps an unambiguous single product selectable ${agent}/${family}`,async()=>{
  const h=harness([{id:40302,code:2,name:family+' Clásica',categoryName:family+'s',price:22000,availableNow:true,hasAttributes:false,attributes:[]}],agent);
  const reply=await h.sendQueued(`Una ${family.toLowerCase()}`);
  expect(reply).toContain(family+' Clásica');
  expect(h.conv.sessionData.pendingMatch?.candidates.map(p=>p.id)).toEqual([40302]);
  await h.sendQueued('1');
  expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:40302,quantity:1})]);
 });
}
