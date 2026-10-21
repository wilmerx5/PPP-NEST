import {harness} from './whatsapp-accuracy.test-support';
for(const dish of ['Bowl Vegetal','Pasta Del Huerto','Arroz Chino']) for(const enabled of [false,true]) for(const row of [1,2]) for(const answer of ['sí, mi celular es 300 111 2233','Sí por favor; teléfono: 300 111 2233','sí!\nwhatsapp: 300 111 2233']) {
 it(`${dish} quote row ${row}, ${answer}, mixed acceptance agent=${enabled}`,async()=>{
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
  const reply=await h.sendQueued(answer);
  expect(reply).not.toMatch(/no manejamos|no entend/i);
  expect(h.conv.sessionData.contactPhone?.replace(/\D/g,'')).toContain('3001112233');
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

for(const dish of ['Bowl Vegetal','Pasta Del Huerto','Arroz Chino']) for(const enabled of [false,true]) for(const mode of ['ambiguous','different-choice','price-again']) {
 it(`${dish} mixed contact safeguards ${mode} agent=${enabled}`,async()=>{
  const menu=[dish,`Combo De ${dish}`,`Combo De ${dish} Familiar`].map((name,i)=>({id:98701+i,code:701+i,name,price:15000+i*7000,description:i?'Incluye bebida':'Sin bebida',availableNow:true,attributes:[]}));
  const h=harness(menu,enabled);h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
  await h.sendQueued(`Quiero dos ${dish} sin cebolla`);
  const before=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('Trae bebida?');
  if(mode!=='ambiguous'){
   menu[1]={...menu[1],price:31000};
   expect(await h.sendQueued('1')).toMatch(/precio.*cambi/i);
  }
  if(mode==='price-again')menu[1]={...menu[1],price:32000};
  const reply=await h.sendQueued(mode==='different-choice'?'el segundo, mi celular es 300 111 2233':'sí, mi celular es 300 111 2233');
  if(mode==='different-choice'){
   expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:98703,quantity:2,unitPrice:29000,note:before[0].note})]);
   expect(h.conv.sessionData.contactPhone?.replace(/\D/g,'')).toContain('3001112233');
  }else{
   expect(h.conv.sessionData.cart).toEqual(before);
   expect(h.conv.sessionData.pendingMatch).toBeDefined();
   if(mode==='price-again')expect(reply).toMatch(/precio.*cambi/i);
   if(mode==='ambiguous'){
    expect(reply).toMatch(/falta elegir/i);
    expect(h.conv.sessionData.contactPhone?.replace(/\D/g,'')).toContain('3001112233');
    await h.sendQueued('2');
    expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:98703,quantity:2,unitPrice:29000,note:before[0].note})]);
   }
  }
 });
}
