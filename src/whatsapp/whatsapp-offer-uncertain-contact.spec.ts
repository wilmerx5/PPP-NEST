import {harness} from './whatsapp-accuracy.test-support';
for(const dish of ['Bowl Vegetal','Pasta Del Huerto','Arroz Chino'])for(const enabled of [false,true])for(const question of ['el primero o el segundo','1 o 2','cuánto cuestan?'])for(const separator of ['; ',' ']){
 it(`${dish} uncertain choice with contact: ${question} separator=${JSON.stringify(separator)}, agent=${enabled}`,async()=>{
  const menu=[dish,`Combo De ${dish}`,`Combo De ${dish} Familiar`].map((name,i)=>({id:98801+i,code:821+i,name,price:15000+i*7000,description:i?'Incluye bebida':'Sin bebida',availableNow:true,attributes:[]}));
  const h=harness(menu,enabled);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:988,dailyOrderNumber:102});
  Object.assign(h.conv.sessionData,{fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
  await h.sendQueued(`Quiero dos ${dish} sin cebolla`);
  const before=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('Trae bebida?');
  const pending=structuredClone(h.conv.sessionData.pendingMatch);
  const reply=await h.sendQueued(`${question}${separator}mi celular es 300 111 2233`);
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(h.conv.sessionData.pendingMatch).toEqual(pending);
  expect(h.conv.sessionData.contactPhone?.replace(/\D/g,'')).toContain('3001112233');
  expect(reply).toMatch(/elige|cuál|elegir/i);
  if(question.includes('cuestan')){expect(reply).toContain('22.000');expect(reply).toContain('29.000');}
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('2');
  expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:98803,quantity:2,note:before[0].note})]);
  if(h.conv.state==='building_cart')await h.sendQueued('no más, recojo en el local');
  if(h.conv.state==='awaiting_payment')await h.sendQueued('contraentrega');
  await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];
  expect(dto.items.map(item=>item.productId)).toEqual([98803,98803]);
  expect(dto.phone.replace(/\D/g,'')).toContain('3001112233');
 });
}

for(const dish of ['Bowl Vegetal','Pasta Del Huerto','Arroz Chino'])for(const enabled of [false,true]){
 it(`${dish} mixed price inquiry reads current availability agent=${enabled}`,async()=>{
  const menu=[dish,`Combo De ${dish}`,`Combo De ${dish} Familiar`].map((name,i)=>({id:98801+i,code:821+i,name,price:15000+i*7000,description:i?'Incluye bebida':'Sin bebida',availableNow:true,attributes:[]}));
  const h=harness(menu,enabled);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  await h.sendQueued(`Quiero dos ${dish} sin cebolla`);
  const before=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('Trae bebida?');
  menu[1]={...menu[1],price:26000};menu[2]={...menu[2],availableNow:false};
  const reply=await h.sendQueued('cuánto cuestan?; mi celular es 300 111 2233');
  expect(reply).toContain('26.000');
  expect(reply).toMatch(/no disponible/i);
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(h.conv.sessionData.contactPhone?.replace(/\D/g,'')).toContain('3001112233');
  expect(await h.sendQueued('1')).toMatch(/precio.*cambi/i);
  expect(h.conv.sessionData.cart).toEqual(before);
 });
}
