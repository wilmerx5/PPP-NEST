import {harness,products} from './whatsapp-accuracy.test-support';
for(const inclusionFirst of [false,true])for(const enabled of [false,true])for(const quantity of [1,2])for(const dish of ['Bowl Vegetal','Hamburguesa Clasica']){
 it(`${dish} inclusionFirst=${inclusionFirst} quantity=${quantity} agent=${enabled} inquiry-to-replacement-to-order`,async()=>{
  const menu=[dish,`Combo De ${dish}`].map((name,i)=>({id:99901+i,code:99901+i,name,price:18000+i*5000,description:i ? "Incluye bebida de 1.5L" : "Sin bebida",availableNow:true,attributes:[]}));
  const h=harness(menu,enabled);h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
  Object.assign(h.conv.sessionData,{fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:999,dailyOrderNumber:99});
  await h.sendQueued(`Quiero ${quantity} ${dish} sin cebolla`);
  const before=structuredClone(h.conv.sessionData.cart);
  expect(before).toHaveLength(1);expect(before[0].quantity).toBe(quantity);
  if(inclusionFirst){
  const inclusion=await h.sendQueued('Viene con gaseosa?');
  expect(inclusion).toContain(menu[1].name);
  expect(inclusion).toMatch(/bebida/i);
  expect(h.conv.sessionData.pendingMatch?.replacement?.originalLine).toEqual(before[0]);
  }
  const reply=await h.sendQueued('No hay algun combo?');
  expect(h.conv.sessionData.cart).toEqual(before);
  const pending=h.conv.sessionData.pendingMatch;
  expect(pending?.replacement?.originalLine).toEqual(before[0]);
  const index=pending!.candidates.findIndex(p=>p.id===99902)+1;
  expect(index).toBeGreaterThan(0);expect(reply).toContain(menu[1].name);
  await h.sendQueued(String(index));
  expect(h.conv.sessionData.cart).toHaveLength(1);
  expect(h.conv.sessionData.cart[0]).toEqual(expect.objectContaining({productId:99902,quantity,note:before[0].note}));
  await h.sendQueued('no más, recojo en el local');if(h.conv.state==='awaiting_payment')await h.sendQueued('1');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toHaveLength(quantity);
  for(const item of dto.items)expect(item).toEqual(expect.objectContaining({productId:99902,note:before[0].note}));
 });
}
for(const enabled of [false,true])it(`reported PPP conversation agent=${enabled}`,async()=>{
 const h=harness(products,enabled);h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
 await h.sendQueued('Quiero Un Pollo con arta papa');await h.sendQueued('1');
 expect(h.conv.sessionData.cart[0].name).toMatch(/Broaster/i);
 const before=structuredClone(h.conv.sessionData.cart);
 const inclusion=await h.sendQueued('Viene con gaseosa?');
 expect(inclusion).toMatch(/Combo.*Broaster/i);expect(inclusion).toMatch(/bebida/i);
 await h.sendQueued('No hay algun combo?');
 expect(h.conv.sessionData.cart).toEqual(before);
 expect(h.conv.sessionData.pendingMatch?.replacement?.originalLine).toEqual(before[0]);
 await h.sendQueued('1');
 expect(h.conv.sessionData.cart).toHaveLength(1);expect(h.conv.sessionData.cart[0].name).toMatch(/Combo.*Broaster/i);
 expect(h.conv.sessionData.cart[0].note).toContain('arta papa');
});

for (const enabled of [false, true]) for (const dish of ['Pollo Frito', 'Bowl Vegetal', 'Hamburguesa Clasica']) for (const question of ['Trae bebida?', 'Trae gaseosa?']) {
 it(`consumed list focuses chosen ${dish}: ${question} agent=${enabled}`, async () => {
  const menu = [dish, `${dish} Especial`, `Combo De ${dish}`].map((name, i) => ({id: 98801+i, code: 98801+i, name, price: 18000+i*5000, description: i === 2 ? 'Incluye bebida de 1.5L' : 'Sin bebida', availableNow: true, attributes: []}));
  const h = harness(menu, enabled);
  h.service.aiService.generateTurn = jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?', actions:{}});
  Object.assign(h.conv.sessionData, {fulfillmentChosen:true, phoneConfirmed:true, contactPhone:h.conv.phoneE164, notesCollected:true});
  h.service.ordersService.create = jest.fn().mockResolvedValue({id:988, dailyOrderNumber:98});
  // Retained browse lists are valid router state after a numbered selection.
  h.conv.sessionData.pendingMatch = {query:dish, intent:'order', candidates:menu.slice(0,2)};
  await h.sendQueued('1');
  expect(h.conv.sessionData.pendingMatch?.selectionAdded).toBe(true);
  const before = structuredClone(h.conv.sessionData.cart);
  expect(before).toHaveLength(1);
  const reply = await h.sendQueued(question);
  expect(reply).toContain(menu[2].name);
  expect(reply).not.toContain(menu[1].name);
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(h.conv.sessionData.pendingMatch?.replacement?.originalLine).toEqual(before[0]);
  await h.sendQueued(question === 'Trae bebida?' ? 'Trae gaseosa?' : 'Trae bebida?');
  expect(h.conv.sessionData.pendingMatch?.replacement?.originalLine).toEqual(before[0]);
  expect(h.conv.sessionData.cart).toEqual(before);
  await h.sendQueued('1');
  expect(h.conv.sessionData.cart).toHaveLength(1);
  expect(h.conv.sessionData.cart[0].productId).toBe(98803);
  await h.sendQueued('no más, recojo en el local');
  if(h.conv.state==='awaiting_payment') await h.sendQueued('1');
  await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  expect(h.service.ordersService.create.mock.calls[0][0].items.map(item=>item.productId)).toEqual([98803]);
 });
}

for (const enabled of [false,true]) for (const dish of ['Pollo Frito','Bowl Vegetal','Hamburguesa Clasica']) {
 it(`unresolved list remains plural ${dish} agent=${enabled}`, async()=>{
  const menu=[dish,`${dish} Especial`].map((name,i)=>({id:98701+i,code:98701+i,name,price:18000,description:'Sin bebida',availableNow:true,attributes:[]}));
  const h=harness(menu,enabled);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
  h.conv.sessionData.pendingMatch={query:dish,intent:'order',candidates:menu};
  const before=structuredClone(h.conv.sessionData.pendingMatch);
  const reply=await h.sendQueued('Trae bebida?');
  for(const product of menu) expect(reply).toContain(product.name);
  expect(h.conv.sessionData.cart).toEqual([]);
  expect(h.conv.sessionData.pendingMatch).toEqual(before);
 });
}
