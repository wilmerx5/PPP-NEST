import {harness} from './whatsapp-accuracy.test-support';
const fields=['A nombre de Camila Rojas','Mi celular es 3000000002','La dirección es Calle 6B #81B-51 Torre 3 apto 510','Pago por Nequi'];
async function setup(family:string,agent:boolean){
 const menu=[{id:40901,code:31,name:family+' Clásica',categoryName:family+'s',price:20000,availableNow:true,hasAttributes:false,attributes:[]},
 {id:40902,code:42,name:family+' Especial',categoryName:family+'s',price:25000,availableNow:true,hasAttributes:false,attributes:[]}];
 const h=harness(menu,agent);h.cfg.ignoreBusinessHours=false;
 Object.assign(h.conv.sessionData,{orderType:'delivery',address:'Calle 1 #2-3',addressConfirmed:true,fulfillmentChosen:true,
 deliveryFeeCalculated:2000,paymentMethod:'cash',contactPhone:h.conv.phoneE164,phoneConfirmed:true,notesCollected:true});
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:409,dailyOrderNumber:409});
 h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 await h.sendQueued('Quiero una '+family.toLowerCase());
 expect(h.conv.sessionData.pendingMatch?.candidates.map(p=>p.id)).toEqual([40901,40902]);expect(h.conv.sessionData.cart).toEqual([]);
 return {h,menu};
}
for(const family of ['Hamburguesa','Pizza'])for(const agent of [false,true]){
 for(const pick of ['1','2'])for(const separator of ['; ','\n',', '])for(const [index,data] of [...fields,fields.join(separator)].entries())it(`selects a listed item with contact ${family}/${agent}/${pick}/${JSON.stringify(separator)}/${index}`,async()=>{
  const {h}=await setup(family,agent);const reply=await h.sendQueued(pick+separator+data);
  expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:40900+Number(pick),quantity:1})]);
  expect(reply).toContain(pick==='1'?family+' Clásica':family+' Especial');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(index===0||index===4)expect(h.conv.customerName).toBe('Camila Rojas');
  if(index===1||index===4)expect(h.conv.sessionData.contactPhone).toMatch(/3000000002$/);
  if(index===2||index===4)expect(h.conv.sessionData.address).toMatch(/6b.*81b.*51.*3.*510/i);
  if(index===3||index===4)expect(h.conv.sessionData.paymentMethod).toBe('transfer');
  const cart=structuredClone(h.conv.sessionData.cart);await h.sendQueued('Por favor');expect(h.conv.sessionData.cart).toEqual(cart);
  if(index===4){await h.sendQueued('no más');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
   const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toEqual([expect.objectContaining({productId:40900+Number(pick)})]);
   expect(dto.customerName).toBe('Camila Rojas');expect(dto.phone).toMatch(/3000000002$/);expect(dto.address).toMatch(/6b.*81b.*51/i);
  }
 });
 for(const message of ['2; A nombre de Camila Rojas; Pago por Nequi si me descuentas',
  '"2"; A nombre de Camila Rojas; La dirección es Calle 6B #81B-51',
  '¿2?; A nombre de Camila Rojas; La dirección es Calle 6B #81B-51',
  '2; A nombre de Camila Rojas; La dirección es Calle 6B',
  '2; A nombre de Camila Rojas; A nombre de Otra Persona',
  '8; A nombre de Camila Rojas; Pago por Nequi',
  '2; A nombre de Camila Rojas; agrega otra cosa',
  '2; Mi celular es 3000000002; Pago por Nequi si no hay recargo'])it(`keeps an unclear selection form atomic ${family}/${agent}/${message}`,async()=>{
  const {h}=await setup(family,agent);const before=structuredClone(h.conv.sessionData);
  const reply=await h.sendQueued(message);expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBe('Wilmer');
  expect(reply).toMatch(/No cambié|aclar|número|opción/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
}

for(const family of ['Hamburguesa','Pizza'])for(const agent of [false,true]){
 it(`selects through a real five-message burst ${family}/${agent}`,async()=>{
  const {h}=await setup(family,agent);jest.useFakeTimers();
  try{const requests=['2',...fields].map((text,i)=>h.service.handleIncoming({waId:'customer',phoneE164:h.conv.phoneE164,messageId:`list-contact-409-${i}`,messageType:'text',text,timestamp:Date.now()/1000,raw:{}}));
   await jest.advanceTimersByTimeAsync(4000);await Promise.all(requests);
  }finally{jest.useRealTimers();}
  expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:40902,quantity:1})]);
  expect(h.conv.customerName).toBe('Camila Rojas');expect(h.conv.sessionData.paymentMethod).toBe('transfer');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it(`selects an offered menu code without treating it as quantity ${family}/${agent}`,async()=>{
  const {h}=await setup(family,agent);await h.sendQueued('42; '+fields.join('; '));
  expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:40902,quantity:1})]);
  expect(h.conv.customerName).toBe('Camila Rojas');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 for(const change of ['price','stock','removed'])for(const contact of [false,true])it(`revalidates current catalog before list purchase ${family}/${agent}/${change}/${contact}`,async()=>{
  const {h,menu}=await setup(family,agent);
  if(change==='price')menu[1].price=27000;else if(change==='stock')menu[1].availableNow=false;else menu.splice(1,1);
  const reply=await h.sendQueued(contact?'2; '+fields.join('; '):'2');
  expect(h.conv.sessionData.cart).toEqual([]);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(contact)expect(h.conv.customerName).toBe('Camila Rojas');
  if(change==='price'){
   expect(reply).toMatch(/precio.*cambi/i);expect(h.conv.sessionData.pendingMatch?.candidates[1].price).toBe(27000);
   await h.sendQueued('2');expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:40902,quantity:1,unitPrice:27000})]);
  }else expect(reply).toMatch(/no.*disponible/i);
 });
 it(`retains a pending product attribute while saving the selected contact ${family}/${agent}`,async()=>{
  const {h,menu}=await setup(family,agent);
  Object.assign(menu[1],{hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Agua','Jugo']}]});
  const reply=await h.sendQueued('2; '+fields.join('; '));
  expect(h.conv.sessionData.pendingAttribute?.productId).toBe(40902);expect(h.conv.sessionData.cart).toEqual([]);
  expect(reply).toMatch(/Bebida/);expect(h.conv.customerName).toBe('Camila Rojas');
  await h.sendQueued('2');expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:40902,quantity:1,attributes:expect.arrayContaining([{attributeName:'Bebida',attributeValue:'Jugo'}])})]);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
}

for(const family of ['Hamburguesa','Pizza'])for(const agent of [false,true]){
 it(`does not split an invalid contact burst into a purchase ${family}/${agent}`,async()=>{
  const {h}=await setup(family,agent);const before=structuredClone(h.conv.sessionData);jest.useFakeTimers();
  try{const texts=['2',fields[0],fields[1],fields[2],'Pago por Nequi si me descuentas'];
   const requests=texts.map((text,i)=>h.service.handleIncoming({waId:'customer',phoneE164:h.conv.phoneE164,messageId:`list-contact-invalid-409-${i}`,messageType:'text',text,timestamp:Date.now()/1000,raw:{}}));
   await jest.advanceTimersByTimeAsync(4000);await Promise.all(requests);
  }finally{jest.useRealTimers();}
  expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBe('Wilmer');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it(`preserves existing cart lines when picking with contact ${family}/${agent}`,async()=>{
  const {h}=await setup(family,agent);
  h.conv.sessionData.cart=[{productId:40901,code:31,name:family+' Clásica',quantity:1,unitPrice:20000,attributes:[]}];
  const existing=structuredClone(h.conv.sessionData.cart[0]);await h.sendQueued('2; '+fields.join('; '));
  expect(h.conv.sessionData.cart).toEqual([existing,expect.objectContaining({productId:40902,quantity:1})]);
  await h.sendQueued('no más');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  expect(h.service.ordersService.create.mock.calls[0][0].items.map(item=>item.productId)).toEqual([40901,40902]);
 });
 it(`preserves the quantity owned by the pending list ${family}/${agent}`,async()=>{
  const {h}=await setup(family,agent);h.conv.sessionData.pendingMatch!.quantity=2;
  await h.sendQueued('2; '+fields.join('; '));expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:40902,quantity:2})]);
  await h.sendQueued('Por favor');expect(h.conv.sessionData.cart[0].quantity).toBe(2);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
}
