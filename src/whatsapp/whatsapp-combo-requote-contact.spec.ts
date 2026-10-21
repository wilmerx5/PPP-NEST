import {harness} from './whatsapp-accuracy.test-support';
for(const dish of ['Bowl Vegetal','Pasta Del Huerto','Arroz Chino']) for(const enabled of [false,true]) for(const row of [1,2]) for(const label of ['mi celular es','teléfono:','whatsapp:']) {
 it(`${dish} quote row ${row}, ${label}, yes agent=${enabled}`,async()=>{
  const menu=[dish,`Combo De ${dish}`,`Combo De ${dish} Familiar`].map((name,i)=>({id:98701+i,code:701+i,name,price:15000+i*7000,description:i?'Incluye bebida':'Sin bebida',availableNow:true,attributes:[]}));
  const h=harness(menu,enabled);h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:987,dailyOrderNumber:98});
  Object.assign(h.conv.sessionData,{fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
  await h.sendQueued(`Quiero dos ${dish} sin cebolla`);
  const before=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('Trae bebida?');
  menu[row]={...menu[row],price:31000};
  expect(await h.sendQueued(String(row))).toMatch(/precio.*cambi/i);
  expect(h.conv.sessionData.cart).toEqual(before);
  const reply=await h.sendQueued(`${label} 300 111 2233`);
  expect(reply).toContain('300');
  expect(h.conv.sessionData.contactPhone?.replace(/\D/g,'')).toContain('3001112233');
  expect(h.conv.sessionData.cart).toEqual(before);
  await h.sendQueued('sí');
  expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:98701+row,quantity:2,unitPrice:31000,note:before[0].note})]);
  if(h.conv.state==='building_cart')await h.sendQueued('no más, recojo en el local');
  if(h.conv.state==='awaiting_payment')await h.sendQueued('contraentrega');
  await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];
  expect(dto.items.map(item=>item.productId)).toEqual([98701+row,98701+row]);
  expect(dto.phone.replace(/\D/g,'')).toContain('3001112233');
 });
}

for(const dish of ['Bowl Vegetal','Pasta Del Huerto','Arroz Chino']) for(const enabled of [false,true]) for(const change of ['price','removed','unavailable']) {
 it(`${dish} acceptance rechecks ${change} agent=${enabled}`,async()=>{
  const menu=[dish,`Combo De ${dish}`,`Combo De ${dish} Familiar`].map((name,i)=>({id:98701+i,code:701+i,name,price:15000+i*7000,description:i?'Incluye bebida':'Sin bebida',availableNow:true,attributes:[]}));
  const h=harness(menu,enabled);h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
  await h.sendQueued(`Quiero dos ${dish} sin cebolla`);
  const before=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('Trae bebida?');
  menu[1]={...menu[1],price:31000};
  expect(await h.sendQueued('1')).toMatch(/precio.*cambi/i);
  await h.sendQueued('mi celular es 300 111 2233');
  if(change==='price')menu[1]={...menu[1],price:32000};
  if(change==='removed')menu.splice(1,1);
  if(change==='unavailable')menu[1]={...menu[1],availableNow:false};
  const reply=await h.sendQueued('sí');
  expect(reply).toMatch(change==='price'?/precio.*cambi/i:/no.*disponible/i);
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(h.conv.sessionData.pendingMatch).toBeDefined();
  if(change==='price'){
   await h.sendQueued('sí');
   expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:98702,quantity:2,unitPrice:32000,note:before[0].note})]);
  }
 });
}
