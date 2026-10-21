import {harness} from './whatsapp-accuracy.test-support';
for(const mode of ['replacement','purchase']) for(const dish of ['Bowl Vegetal','Pasta Del Huerto','Arroz Chino']) for(const enabled of [false,true]) for(const field of ['name','phone','address','all','allComma','allSemicolon']) {
 it(`${mode} ${dish} combo choice interrupted by ${field} agent=${enabled}`,async()=>{
  const menu=[dish,`Combo De ${dish}`].map((name,i)=>({id:96701+i,code:701+i,name,price:i?22000:15000,description:i?'Incluye bebida':'Sin bebida',availableNow:true,attributes:[]}));
  const h=harness(menu,enabled);h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:967,dailyOrderNumber:96});
  await h.sendQueued(mode==='replacement'?`Quiero dos ${dish} sin cebolla`:`Quiero dos ${dish} con bebida`);
  const before=structuredClone(h.conv.sessionData.cart);
  if(mode==='replacement')await h.sendQueued('Trae bebida?');
  const pending=structuredClone(h.conv.sessionData.pendingMatch);
  if(mode==='replacement')expect(pending?.replacement?.originalLine).toEqual(before[0]);
  else expect(pending?.includesRequestedAccompaniment).toBe(true);
  Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,address:'Calle 10 #20-30',addressConfirmed:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,deliveryFeeCalculated:2000});
  const rawInput=field==='name'?'a nombre de Ana Torres':field==='phone'?'3001112233':field==='address'?'Carrera 12 #34-56':'a nombre de Ana Torres\n3001112233\nCarrera 12 #34-56';
  const input=field==='allComma'?rawInput.replace(/\n/g,', '):field==='allSemicolon'?rawInput.replace(/\n/g,'; '):rawInput;
  const reply=await h.sendQueued(input);
  expect(reply).toContain(menu[1].name);
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(h.conv.sessionData.pendingMatch).toEqual(pending);
  if(field==='name'||field.startsWith('all'))expect(h.conv.customerName).toBe('Ana Torres');
  if(field==='phone'||field.startsWith('all'))expect(h.conv.sessionData.contactPhone?.replace(/\D/g,'')).toContain('3001112233');
  if(field==='address'||field.startsWith('all'))expect(h.conv.sessionData.address).toContain('34-56');
  await h.sendQueued(input);
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(h.conv.sessionData.pendingMatch).toEqual(pending);
  await h.sendQueued('1');
  expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:96702,quantity:2,note:before[0]?.note})]);
  await h.sendQueued('nada más');
  if(h.conv.state==='awaiting_address')await h.sendQueued('sí');
  if(h.conv.state==='awaiting_payment')await h.sendQueued('contraentrega');
  await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];
  expect(dto.items.map(item=>item.productId)).toEqual([96702,96702]);
  expect(dto.customerName).toBe(field==='name'||field.startsWith('all')?'Ana Torres':'Wilmer');
  expect(dto.phone.replace(/\D/g,'')).toContain(field==='phone'||field.startsWith('all')?'3001112233':'3000000001');
  expect(dto.address).toContain(field==='address'||field.startsWith('all')?'34-56':'20-30');
 });
}
