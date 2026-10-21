import {harness} from './whatsapp-accuracy.test-support';
for(const mode of ['replacement','purchase']) for(const dish of ['Bowl Vegetal','Pasta Del Huerto','Arroz Chino']) for(const enabled of [false,true]) for(const row of [1,2]) for(const style of ['numberFirst','ordinalFirst','codeLast']) {
 it(`${mode} ${dish} row=${row} ${style} agent=${enabled}`,async()=>{
  const menu=[dish,`Combo De ${dish}`,`Combo De ${dish} Familiar`].map((name,i)=>({id:97701+i,code:701+i,name,price:15000+i*7000,description:i?'Incluye bebida':'Sin bebida',availableNow:true,attributes:[]}));
  const h=harness(menu,enabled);h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:977,dailyOrderNumber:97});
  await h.sendQueued(mode==='replacement'?`Quiero dos ${dish} sin cebolla`:`Quiero dos ${dish} con bebida`);
  const before=structuredClone(h.conv.sessionData.cart);
  if(mode==='replacement')await h.sendQueued('Trae bebida?');
  expect(h.conv.sessionData.pendingMatch?.candidates).toHaveLength(2);
  Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,notesCollected:true});
  const details='a nombre de Ana Torres\n3001112233\nCarrera 12 #34-56';
  const input=style==='numberFirst'?`${row}\n${details}`:style==='ordinalFirst'?`${row===1?'el primero':'el segundo'}, ${details.replace(/\n/g,', ')}`:`${details}\ncódigo ${701+row}`;
  const reply=await h.sendQueued(input);
  expect(reply).toContain(menu[row].name);
  expect(reply).toContain('Ana Torres');
  expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:97701+row,quantity:2,note:before[0]?.note})]);
  expect(h.conv.customerName).toBe('Ana Torres');
  expect(h.conv.sessionData.contactPhone?.replace(/\D/g,'')).toContain('3001112233');
  expect(h.conv.sessionData.address).toContain('34-56');
  expect(h.conv.sessionData.pendingMatch).toBeFalsy();
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(h.conv.state==='awaiting_address')await h.sendQueued('sí');
  if(h.conv.state==='awaiting_payment')await h.sendQueued('contraentrega');
  await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];
  expect(dto.items.map(item=>item.productId)).toEqual([97701+row,97701+row]);
  expect(dto.customerName).toBe('Ana Torres');expect(dto.phone.replace(/\D/g,'')).toContain('3001112233');expect(dto.address).toContain('34-56');
 });
}

for(const dish of ['Bowl Vegetal','Pasta Del Huerto','Arroz Chino']) for(const enabled of [false,true]) for(const change of ['removed','price']) {
 it(`${dish} combined details preserve ${change} guard agent=${enabled}`,async()=>{
  const menu=[dish,`Combo De ${dish}`,`Combo De ${dish} Familiar`].map((name,i)=>({id:97801+i,code:801+i,name,price:15000+i*7000,description:i?'Incluye bebida':'Sin bebida',availableNow:true,attributes:[]}));
  const h=harness(menu,enabled);h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
  await h.sendQueued(`Quiero dos ${dish} sin cebolla`);
  const before=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('Trae bebida?');
  if(change==='removed')menu.splice(1,1);else menu[1]={...menu[1],price:26000};
  const reply=await h.sendQueued('1\na nombre de Ana Torres\n3001112233\nCarrera 12 #34-56');
  expect(reply).toMatch(change==='removed'?/no.*disponible/i:/precio.*cambi/i);
  expect(h.conv.customerName).toBe('Ana Torres');
  expect(h.conv.sessionData.contactPhone?.replace(/\D/g,'')).toContain('3001112233');
  expect(h.conv.sessionData.address).toContain('34-56');
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(h.conv.sessionData.pendingMatch?.replacement?.originalLine).toEqual(before[0]);
  await h.sendQueued(change==='removed'?'2':'1');
  expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:change==='removed'?97803:97802,quantity:2,note:before[0].note})]);
 });
}
