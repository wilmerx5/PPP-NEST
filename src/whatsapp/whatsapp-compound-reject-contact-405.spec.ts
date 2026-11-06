import {harness} from './whatsapp-accuracy.test-support';

const fields=['A nombre de Camila Rojas','Mi celular es 3000000002','La dirección es Calle 6B #81B-51 Torre 3 apto 510','Pago por Nequi'];
async function setup(family:string,agent:boolean) {
 const menu=[{id:40501,code:1,name:family,price:38000},{id:40502,code:2,name:'Costillas De Cerdo',price:30000},
  {id:40503,code:3,name:family+' Con Costillas De Cerdo',price:50000}].map(p=>({...p,availableNow:true,hasAttributes:false,attributes:[]}));
 const h=harness(menu,agent);h.conv.state='awaiting_final_confirm';
 Object.assign(h.conv.sessionData,{orderType:'delivery',address:'Calle 1 #2-3',addressConfirmed:true,fulfillmentChosen:true,
  deliveryFeeCalculated:2000,paymentMethod:'cash',contactPhone:h.conv.phoneE164,phoneConfirmed:true,notesCollected:true});
 h.conv.sessionData.cart=menu.slice(0,2).map((p,i)=>({productId:p.id,code:p.code,name:p.name,unitPrice:p.price,quantity:1,...(i?{note:'sin gaseosa'}:{})}));
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:405,dailyOrderNumber:405});
 h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 await h.sendQueued('En combo');return {h,menu};
}
for(const family of ['Arroz Chino','Pasta Artesanal'])for(const agent of [false,true]) {
 for(const prefix of ['No, déjalos separados','No, mejor separados','Déjalos separados'])for(const separator of ['; ', '\n', ', ']) {
  it(`rejects only the replacement and captures contact ${family}/${agent}/${prefix}/${JSON.stringify(separator)}`,async()=>{
   const {h}=await setup(family,agent);
   const reply=await h.sendQueued(prefix+separator+fields.join(separator));
   expect(h.conv.sessionData.cart.map(line=>[line.productId,line.quantity])).toEqual([[40501,1],[40502,1]]);
   expect(h.conv.sessionData.pendingComposedDishRecovery).toBeUndefined();
   expect(h.conv.customerName).toBe('Camila Rojas');
   expect(h.conv.sessionData.contactPhone).toMatch(/3000000002$/);
   expect(h.conv.sessionData.address).toMatch(/6b.*81b.*51.*3.*510/i);
   expect(h.conv.sessionData.paymentMethod).toBe('transfer');
   expect(reply).toMatch(/conservé.*separados/i);expect(reply).toMatch(/confirmar/i);
   expect(h.service.ordersService.create).not.toHaveBeenCalled();
   await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
   const dto=h.service.ordersService.create.mock.calls[0][0];
   expect(dto.items).toEqual([expect.objectContaining({productId:40501}),expect.objectContaining({productId:40502,note:'sin gaseosa'})]);
   expect(dto.customerName).toBe('Camila Rojas');expect(dto.phone).toMatch(/3000000002$/);
   expect(dto.address).toMatch(/6b.*81b.*51.*3.*510/i);expect(h.conv.state).toBe('completed');
  });
 }
 for(const [index,field] of [...fields,'3000000002','Calle 6B #81B-51 Torre 3 apto 510','Nequi'].entries())it(`captures a single field with explicit rejection ${family}/${agent}/${index}`,async()=>{
  const {h}=await setup(family,agent);await h.sendQueued('No, déjalos separados; '+field);
  expect(h.conv.sessionData.cart.map(line=>[line.productId,line.quantity])).toEqual([[40501,1],[40502,1]]);
  if(index===0)expect(h.conv.customerName).toBe('Camila Rojas');
  if(index===1 || index===4)expect(h.conv.sessionData.contactPhone).toMatch(/3000000002$/);
  if(index===2 || index===5)expect(h.conv.sessionData.address).toMatch(/6b.*81b.*51/i);
  if(index===3 || index===6)expect(h.conv.sessionData.paymentMethod).toBe('transfer');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
 });
 for(const message of [
  'No, déjalos separados; A nombre de Camila Rojas; Pago por Nequi si me descuentas',
  '¿No, déjalos separados?; A nombre de Camila Rojas; Pago por Nequi',
  '"No, déjalos separados"; A nombre de Camila Rojas; Pago por Nequi',
  'No, déjalos separados; Mi celular es 3000000002; Mi celular es 3000000003',
  'No, déjalos separados; A nombre de Camila Rojas; Agrega otro plato',
  'No, déjalos separados; A nombre de Camila Rojas; La dirección es Calle 7',
  "No, déjalos separados; A nombre de 'Camila Rojas'",
 ])for(const separator of ['; ', '\n', ', '])it(`does not partially apply ambiguous rejection ${family}/${agent}/${JSON.stringify(separator)}/${message}`,async()=>{
  const {h}=await setup(family,agent);const before=structuredClone(h.conv.sessionData);
  await h.sendQueued(message.replace(/; /g,separator));expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBe('Wilmer');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 for(const changed of ['price','expired','cart'])for(const separator of ['; ', '\n', ', '])it(`rejects a stale proposal without changing the current cart ${family}/${agent}/${changed}/${JSON.stringify(separator)}`,async()=>{
  const {h,menu}=await setup(family,agent);
  if(changed==='price')menu[2].price=51000;
  if(changed==='expired')h.conv.sessionData.pendingComposedDishRecovery!.createdAt=Date.now()-301000;
  if(changed==='cart')h.conv.sessionData.cart[0].quantity=2;
  const before=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('No, déjalos separados'+separator+fields.join(separator));
  expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.customerName).toBe('Camila Rojas');
  expect(h.conv.sessionData.pendingComposedDishRecovery).toBeUndefined();
  expect(h.conv.sessionData.paymentMethod).toBe('transfer');expect(h.conv.sessionData.contactPhone).toMatch(/3000000002$/);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
}

for(const family of ['Arroz Chino','Pasta Artesanal'])for(const agent of [false,true]) {
 it(`rejects the proposal with a real coalesced contact burst ${family}/${agent}`,async()=>{
  const {h}=await setup(family,agent);
  jest.useFakeTimers();
  try {
   const requests=['No, déjalos separados',...fields].map((text,i)=>h.service.handleIncoming({
    waId:'customer',phoneE164:h.conv.phoneE164,messageId:`accept-contact-405-${i}`,messageType:'text',text,timestamp:Date.now()/1000,raw:{},
   }));
   await jest.advanceTimersByTimeAsync(4000);await Promise.all(requests);
  } finally {jest.useRealTimers();}
  expect(h.conv.sessionData.cart.map(line=>[line.productId,line.quantity])).toEqual([[40501,1],[40502,1]]);
  expect(h.conv.sessionData.pendingComposedDishRecovery).toBeUndefined();expect(h.conv.customerName).toBe('Camila Rojas');
  expect(h.conv.sessionData.paymentMethod).toBe('transfer');expect(h.conv.sessionData.contactPhone).toMatch(/3000000002$/);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.customerName).toBe('Camila Rojas');
  expect(dto.phone).toMatch(/3000000002$/);expect(dto.address).toMatch(/6b.*81b.*51.*3.*510/i);
  expect(dto.items).toEqual([expect.objectContaining({productId:40501}),expect.objectContaining({productId:40502,note:'sin gaseosa'})]);
 });
}

for(const family of ['Arroz Chino','Pasta Artesanal'])for(const agent of [false,true]) {
 it(`plain rejection also resumes checkout ${family}/${agent}`,async()=>{
  const {h}=await setup(family,agent);const before=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued('Déjalos separados');
  expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingComposedDishRecovery).toBeUndefined();
  expect(reply).toMatch(/conservé.*separados/i);expect(reply).toMatch(/confirmar/i);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
 });
}
