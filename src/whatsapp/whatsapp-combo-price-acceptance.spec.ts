import {harness} from './whatsapp-accuracy.test-support';

for(const dish of ['Bowl Vegetal','Pasta Del Huerto','Arroz Chino']) for(const enabled of [false,true]) for(const price of [19000,27000]) {
 it(`${dish} changed quote ${price} agent=${enabled}`,async()=>{
  const menu=[dish,`Combo De ${dish}`].map((name,i)=>({id:95701+i,code:701+i,name,price:i?22000:15000,description:i?'Incluye bebida':'Sin bebida',availableNow:true,attributes:[]}));
  const h=harness(menu,enabled);h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
  Object.assign(h.conv.sessionData,{fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:957,dailyOrderNumber:95});
  await h.sendQueued(`Quiero dos ${dish} sin cebolla`);
  const before=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('Trae bebida?');
  menu[1]={...menu[1],price};
  const reply=await h.sendQueued('1');
  expect(reply).toMatch(/precio.*cambi|cambi.*precio/i);
  expect(reply).toContain(price===19000?'19.000':'27.000');
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(h.conv.sessionData.pendingMatch?.replacement?.originalLine).toEqual(before[0]);
  await h.sendQueued('1');
  expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:95702,quantity:2,unitPrice:price,note:before[0].note})]);
  await h.sendQueued('no más, recojo en el local');if(h.conv.state==='awaiting_payment')await h.sendQueued('1');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  expect(h.service.ordersService.create.mock.calls[0][0].items.map(item=>item.productId)).toEqual([95702,95702]);
 });
}
for(const [dish,side] of [['Bowl Vegetal','ensalada'],['Pasta Del Huerto','pan'],['Arroz Chino','gaseosa']]) for(const enabled of [false,true]) for(const change of ['removed','sold-out']) {
 it(`${dish} price inquiry after all offers ${change} agent=${enabled}`,async()=>{
  const menu=[{id:95801,code:801,name:dish,price:15000,availableNow:true,attributes:[]},
   {id:95802,code:802,name:`Combo De ${dish}`,price:22000,description:`Incluye ${side}`,availableNow:true,attributes:[]},
   {id:95803,code:803,name:side,price:4000,availableNow:true,attributes:[]}];
  const h=harness(menu,enabled);h.cfg.ignoreBusinessHours=false;
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
  await h.sendQueued(`Quiero un ${dish} con ${side}`);
  expect(h.conv.sessionData.pendingMatch?.includesRequestedAccompaniment).toBe(true);
  if(change==='removed')menu.splice(1,1);else menu[1].availableNow=false;
  const reply=await h.sendQueued('cuánto cuesta el combo?');
  expect(reply).toMatch(/ya no.*disponible|no.*disponible/i);
  expect(reply).not.toContain('Elige una presentación');
  expect(h.conv.sessionData.cart).toEqual([]);
  await h.sendQueued('prefiero por separado');
  expect(h.conv.sessionData.cart.map(item=>item.productId).sort()).toEqual([95801,95803]);
  expect(h.conv.sessionData.pendingMatch).toBeFalsy();
 });
}

for(const [dish,side] of [['Bowl Vegetal','ensalada'],['Pasta Del Huerto','pan'],['Arroz Chino','gaseosa']]) for(const enabled of [false,true]) for(const price of [19000,27000]) {
 it(`${dish} first purchase re-quote ${price} agent=${enabled}`,async()=>{
  const menu=[{id:95901,code:901,name:dish,price:15000,availableNow:true,attributes:[]},
   {id:95902,code:902,name:`Combo De ${dish}`,price:22000,description:`Incluye ${side}`,availableNow:true,attributes:[]}];
  const h=harness(menu,enabled);h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
  await h.sendQueued(`Quiero dos ${dish} con ${side}`);
  expect(h.conv.sessionData.pendingMatch?.includesRequestedAccompaniment).toBe(true);
  menu[1]={...menu[1],price};
  const reply=await h.sendQueued('1');
  expect(reply).toMatch(/precio.*cambi/i);expect(h.conv.sessionData.cart).toEqual([]);
  await h.sendQueued('1');
  expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:95902,quantity:2,unitPrice:price})]);
  expect(h.conv.sessionData.pendingMatch).toBeFalsy();
 });
}
