import {harness} from './whatsapp-accuracy.test-support';

for(const [dish,side] of [['Arroz Chino','gaseosa'],['Bowl Vegetal','ensalada'],['Pasta Del Huerto','pan']])
 for(const enabled of [false,true]) for(const decision of ['prefiero por separado','no, solo el plato','1'])
 for(const contact of ['mi celular es 300 111 2233','a nombre de Ana Rivera','Calle 8 # 12-34']) {
 it(`${dish}: initial choice ${decision} after ${contact}, agent=${enabled}`,async()=>{
  const menu=[{id:98001,code:801,name:dish,price:15000,availableNow:true,attributes:[]},
   {id:98002,code:802,name:`Combo De ${dish}`,description:`Incluye ${side}`,price:22000,availableNow:true,attributes:[]},
   {id:98003,code:803,name:side,price:4000,availableNow:true,attributes:[]}];
  const h=harness(menu,enabled);
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:980,dailyOrderNumber:98});
  Object.assign(h.conv.sessionData,{fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
  await h.sendQueued(`Quiero un ${dish} con ${side}`);
  expect(h.conv.sessionData.pendingMatch?.includesRequestedAccompaniment).toBe(true);
  const pending=structuredClone(h.conv.sessionData.pendingMatch);
  const ack=await h.sendQueued(contact);
  expect(ack).toMatch(/anoté tus datos/i);
  expect(h.conv.sessionData.cart).toHaveLength(0);
  expect(h.conv.sessionData.pendingMatch).toEqual(pending);
  await h.sendQueued(contact);
  expect(h.conv.sessionData.cart).toHaveLength(0);
  expect(h.conv.sessionData.pendingMatch).toEqual(pending);
  const inquiry=await h.sendQueued('cuánto cuesta el combo?');
  expect(inquiry).toContain('22.000');
  expect(h.conv.sessionData.cart).toHaveLength(0);
  const reply=await h.sendQueued(decision);
  const expected=decision==='1'?[98002]:decision.includes('solo')?[98001]:[98001,98003];
  expect(h.conv.sessionData.cart.map(item=>item.productId).sort()).toEqual(expected.sort());
  expect(h.conv.sessionData.cart.every(item=>item.quantity===1)).toBe(true);
  expect(reply).not.toMatch(/no manejamos|no entend/i);
  expect(h.conv.sessionData.pendingMatch).toBeFalsy();
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(contact.startsWith('mi'))expect(h.conv.sessionData.contactPhone?.replace(/\D/g,'')).toContain('3001112233');
  if(contact.startsWith('a nombre'))expect(h.conv.customerName).toBe('Ana Rivera');
  if(contact.startsWith('Calle'))expect(h.conv.sessionData.address).toContain('Calle 8');
  if(h.conv.state==='building_cart')await h.sendQueued('no más, recojo en el local');
  if(h.conv.state==='awaiting_payment')await h.sendQueued('contraentrega');
  await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];
  expect(dto.items.map(item=>item.productId).sort()).toEqual(expected.sort());
  if(contact.startsWith('mi'))expect(dto.phone.replace(/\D/g,'')).toContain('3001112233');
  if(contact.startsWith('a nombre'))expect(dto.customerName).toBe('Ana Rivera');
  if(contact.startsWith('Calle'))expect(dto.address).toContain('Calle 8');
 });
}
