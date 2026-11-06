import {harness} from './whatsapp-accuracy.test-support';
const fields=['A nombre de Camila Rojas','Mi celular es 3000000002','La dirección es Calle 6B #81B-51 Torre 3 apto 510','Pago por Nequi'];
async function setup(name:string,agent:boolean,occupied:boolean){
 const menu=[{id:40801,code:1,name,price:20000,availableNow:true,hasAttributes:false,attributes:[]},
 {id:40802,code:2,name:'Sopa Del Dia',price:10000,availableNow:true,hasAttributes:false,attributes:[]}];
 const h=harness(menu,agent);
 Object.assign(h.conv.sessionData,{orderType:'delivery',address:'Calle 1 #2-3',addressConfirmed:true,fulfillmentChosen:true,
 deliveryFeeCalculated:2000,paymentMethod:'cash',contactPhone:h.conv.phoneE164,phoneConfirmed:true,notesCollected:true});
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:408,dailyOrderNumber:408});
 h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 await h.sendQueued(`Cuánto cuesta ${name}?`);
 expect(h.conv.sessionData.pendingAddOffer?.productId).toBe(40801);
 if(occupied)h.conv.sessionData.cart=[{productId:40802,code:2,name:'Sopa Del Dia',quantity:1,unitPrice:10000,attributes:[]}];
 return h;
}
for(const name of ['Arroz Con Pollo','Pasta Vegetal'])for(const agent of [false,true])for(const occupied of [false,true]){
 for(const decision of ['No','No gracias','No, gracias'])for(const separator of ['; ','\n',', '])it(`rejects quote and retains complete contact ${name}/${agent}/${occupied}/${decision}/${JSON.stringify(separator)}`,async()=>{
  const h=await setup(name,agent,occupied);const before=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued(decision+separator+fields.join(separator));
  expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingAddOffer).toBeUndefined();
  expect(h.conv.customerName).toBe('Camila Rojas');expect(h.conv.sessionData.contactPhone).toMatch(/3000000002$/);
  expect(h.conv.sessionData.address).toMatch(/6b.*81b.*51.*3.*510/i);expect(h.conv.sessionData.paymentMethod).toBe('transfer');
  expect(reply).toMatch(/no.*agrego/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('Por favor');expect(h.conv.sessionData.cart).toEqual(before);
  if(occupied){await h.sendQueued('no más');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
   const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toEqual([expect.objectContaining({productId:40802})]);
   expect(dto.customerName).toBe('Camila Rojas');expect(dto.phone).toMatch(/3000000002$/);
  }else {await h.sendQueued('confirmar');expect(h.service.ordersService.create).not.toHaveBeenCalled();}
 });
 for(const message of ['No; A nombre de Camila Rojas; Pago por Nequi si me descuentas',
  '"No"; A nombre de Camila Rojas; La dirección es Calle 6B #81B-51',
  '¿No?; A nombre de Camila Rojas; La dirección es Calle 6B #81B-51',
  'No; A nombre de Camila Rojas; La dirección es Calle 6B',
  'No; A nombre de Camila Rojas; A nombre de Otra Persona'])it(`keeps ambiguous rejection atomic ${name}/${agent}/${occupied}/${message}`,async()=>{
   const h=await setup(name,agent,occupied);const before=structuredClone(h.conv.sessionData);
   await h.sendQueued(message);expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBe('Wilmer');
   expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
}

for(const name of ['Arroz Con Pollo','Pasta Vegetal'])for(const agent of [false,true])for(const occupied of [false,true]){
 for(const [index,field] of fields.entries())it(`rejects quote with one contact field ${name}/${agent}/${occupied}/${index}`,async()=>{
  const h=await setup(name,agent,occupied);const cart=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('No, '+field);expect(h.conv.sessionData.cart).toEqual(cart);expect(h.conv.sessionData.pendingAddOffer).toBeUndefined();
  if(index===0)expect(h.conv.customerName).toBe('Camila Rojas');
  if(index===1)expect(h.conv.sessionData.contactPhone).toMatch(/3000000002$/);
  if(index===2)expect(h.conv.sessionData.address).toMatch(/6b.*81b.*51/i);
  if(index===3)expect(h.conv.sessionData.paymentMethod).toBe('transfer');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it(`rejects quote through a real five-message burst ${name}/${agent}/${occupied}`,async()=>{
  const h=await setup(name,agent,occupied);const cart=structuredClone(h.conv.sessionData.cart);jest.useFakeTimers();
  try{
   const requests=['No',...fields].map((text,i)=>h.service.handleIncoming({waId:'customer',phoneE164:h.conv.phoneE164,messageId:`quote-reject-408-${i}`,messageType:'text',text,timestamp:Date.now()/1000,raw:{}}));
   await jest.advanceTimersByTimeAsync(4000);await Promise.all(requests);
  }finally{jest.useRealTimers();}
  expect(h.conv.sessionData.cart).toEqual(cart);expect(h.conv.sessionData.pendingAddOffer).toBeUndefined();
  expect(h.conv.customerName).toBe('Camila Rojas');expect(h.conv.sessionData.paymentMethod).toBe('transfer');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it(`retains a plain courtesy rejection ${name}/${agent}/${occupied}`,async()=>{
  const h=await setup(name,agent,occupied);const cart=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('No, gracias');expect(h.conv.sessionData.cart).toEqual(cart);expect(h.conv.sessionData.pendingAddOffer).toBeUndefined();
  expect(h.conv.customerName).toBe('Wilmer');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
}
for(const state of ['awaiting_payment','awaiting_final_confirm'])for(const agent of [false,true])it(`resumes the interrupted checkout after rejection ${state}/${agent}`,async()=>{
 const h=await setup('Pasta Vegetal',agent,true);h.conv.state=state;
 const reply=await h.sendQueued('No; A nombre de Camila Rojas');
 expect(h.conv.state).toBe(state);expect(h.conv.sessionData.pendingAddOffer).toBeUndefined();
 expect(reply).toMatch(state==='awaiting_payment'?/método de pago/i:/escribe confirmar/i);
 expect(reply).not.toMatch(/¿Algo más\?/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
