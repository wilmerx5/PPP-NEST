import {harness} from './whatsapp-accuracy.test-support';
const fields=['A nombre de Camila Rojas','Mi celular es 3000000002','La dirección es Calle 6B #81B-51 Torre 3 apto 510','Pago por Nequi'];
async function setup(family:string,agent:boolean){
 const menu=[{id:41001,code:31,name:family+' Clásica',categoryName:family+'s',price:20000,availableNow:true,hasAttributes:false,attributes:[]},
 {id:41002,code:42,name:family+' Especial',categoryName:family+'s',price:25000,availableNow:true,hasAttributes:false,attributes:[]}];
 const h=harness(menu,agent);h.cfg.ignoreBusinessHours=false;
 Object.assign(h.conv.sessionData,{orderType:'delivery',address:'Calle 1 #2-3',addressConfirmed:true,fulfillmentChosen:true,
 deliveryFeeCalculated:2000,paymentMethod:'cash',contactPhone:h.conv.phoneE164,phoneConfirmed:true,notesCollected:true});
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:410,dailyOrderNumber:410});
 h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 await h.sendQueued('Quiero una '+family.toLowerCase());
 expect(h.conv.sessionData.pendingMatch?.candidates.map(p=>p.id)).toEqual([41001,41002]);expect(h.conv.sessionData.cart).toEqual([]);
 return {h,menu};
}
for(const family of ['Hamburguesa','Pizza'])for(const agent of [false,true]){
 for(const [choice,id] of [['el primero',41001],['la segunda',41002],[family+' Clásica',41001],[family+' Especial',41002]] as const)
 for(const separator of ['; ','\n',', '])for(const [index,data] of [...fields,fields.join(separator)].entries())it(`selects named or ordinal item with contact ${family}/${agent}/${choice}/${JSON.stringify(separator)}/${index}`,async()=>{
  const {h}=await setup(family,agent);const reply=await h.sendQueued(choice+separator+data);
  expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:id,quantity:1})]);expect(reply).toContain(id===41001?family+' Clásica':family+' Especial');
  if(index===0||index===4)expect(h.conv.customerName).toBe('Camila Rojas');
  if(index===1||index===4)expect(h.conv.sessionData.contactPhone).toMatch(/3000000002$/);
  if(index===2||index===4)expect(h.conv.sessionData.address).toMatch(/6b.*81b.*51.*3.*510/i);
  if(index===3||index===4)expect(h.conv.sessionData.paymentMethod).toBe('transfer');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();const cart=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('Por favor');expect(h.conv.sessionData.cart).toEqual(cart);
  if(index===4){await h.sendQueued('no más');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
   const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toEqual([expect.objectContaining({productId:id})]);expect(dto.customerName).toBe('Camila Rojas');expect(dto.phone).toMatch(/3000000002$/);expect(dto.address).toMatch(/6b.*81b.*51/i);
  }
 });
 for(const message of [
  'el segundo; A nombre de Camila Rojas; Pago por Nequi si me descuentas',
  '"el segundo"; A nombre de Camila Rojas; La dirección es Calle 6B #81B-51',
  '¿el segundo?; A nombre de Camila Rojas; La dirección es Calle 6B #81B-51',
  family+' Especial; A nombre de Camila Rojas; La dirección es Calle 6B',
  family+' Especial; A nombre de Camila Rojas; A nombre de Otra Persona',
  'el quinto; A nombre de Camila Rojas; Pago por Nequi',
  family+' Especial y otro plato; A nombre de Camila Rojas; Pago por Nequi',
  'la segunda; Mi celular es 3000000002; Pago por Nequi si no hay recargo',
 ])it(`keeps named selection and invalid form atomic ${family}/${agent}/${message}`,async()=>{
  const {h}=await setup(family,agent);const before=structuredClone(h.conv.sessionData);
  const reply=await h.sendQueued(message);expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBe('Wilmer');
  expect(reply).toMatch(/No cambié|aclar|número|opción/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
}

for(const family of ['Hamburguesa','Pizza'])for(const agent of [false,true]){
 for(const choice of ['el segundo',family+' Especial']){
  for(const invalid of [false,true])it(`keeps named choice burst atomic ${family}/${agent}/${choice}/${invalid}`,async()=>{
   const {h}=await setup(family,agent);const before=structuredClone(h.conv.sessionData);jest.useFakeTimers();
   try{const texts=[choice,...fields.slice(0,3),invalid?'Pago por Nequi si me descuentas':fields[3]];
    const requests=texts.map((text,i)=>h.service.handleIncoming({waId:'customer',phoneE164:h.conv.phoneE164,messageId:`list-named-410-${i}`,messageType:'text',text,timestamp:Date.now()/1000,raw:{}}));
    await jest.advanceTimersByTimeAsync(4000);await Promise.all(requests);
   }finally{jest.useRealTimers();}
   if(invalid){expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBe('Wilmer');}
   else{expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:41002,quantity:1})]);expect(h.conv.customerName).toBe('Camila Rojas');expect(h.conv.sessionData.paymentMethod).toBe('transfer');}
   expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
  for(const change of ['price','stock','removed'])it(`rechecks live catalog on a named choice ${family}/${agent}/${choice}/${change}`,async()=>{
   const {h,menu}=await setup(family,agent);
   if(change==='price')menu[1].price=27000;else if(change==='stock')menu[1].availableNow=false;else menu.splice(1,1);
   const reply=await h.sendQueued(choice+'; '+fields.join('; '));expect(h.conv.sessionData.cart).toEqual([]);expect(h.conv.customerName).toBe('Camila Rojas');expect(h.service.ordersService.create).not.toHaveBeenCalled();
   if(change==='price'){expect(reply).toMatch(/precio.*cambi/i);await h.sendQueued(choice);expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:41002,quantity:1,unitPrice:27000})]);}
   else expect(reply).toMatch(/no.*disponible/i);
  });
 }
 it(`requires a row when an exact catalog name is duplicated ${family}/${agent}`,async()=>{
  const {h,menu}=await setup(family,agent);const duplicate={...menu[1],id:41003,code:43};menu.push(duplicate);h.conv.sessionData.pendingMatch!.candidates.push(duplicate);
  const before=structuredClone(h.conv.sessionData);const reply=await h.sendQueued(family+' Especial; '+fields.join('; '));
  expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBe('Wilmer');expect(reply).toMatch(/No cambié|número/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it(`accepts a unique exact name regardless of letter case and accents ${family}/${agent}`,async()=>{
  const {h}=await setup(family,agent);await h.sendQueued((family+' CLASICA').toUpperCase()+'; '+fields.join('; '));
  expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:41001,quantity:1})]);expect(h.conv.customerName).toBe('Camila Rojas');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it(`keeps pending quantity with a bare ordinal and contact ${family}/${agent}`,async()=>{
  const {h}=await setup(family,agent);h.conv.sessionData.pendingMatch!.quantity=2;
  await h.sendQueued('segunda; '+fields.join('; '));expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:41002,quantity:2})]);
  await h.sendQueued('Por favor');expect(h.conv.sessionData.cart[0].quantity).toBe(2);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
}

for(const family of ['Hamburguesa','Pizza'])for(const agent of [false,true])for(const choice of ['-1','+2'])it(`does not normalize a signed number into list consent ${family}/${agent}/${choice}`,async()=>{
 const {h}=await setup(family,agent);const before=structuredClone(h.conv.sessionData);
 const reply=await h.sendQueued(choice+'; '+fields.join('; '));
 expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBe('Wilmer');expect(reply).toMatch(/No cambié|número/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
