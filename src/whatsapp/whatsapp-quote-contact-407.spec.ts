import {harness} from './whatsapp-accuracy.test-support';
const fields=['A nombre de Camila Rojas','Mi celular es 3000000002','La dirección es Calle 6B #81B-51 Torre 3 apto 510','Pago por Nequi'];
async function setup(name:string,agent:boolean){
 const menu=[{id:40701,code:1,name,price:20000,availableNow:true,hasAttributes:false,attributes:[]}];
 const h=harness(menu,agent);
 Object.assign(h.conv.sessionData,{orderType:'delivery',address:'Calle 1 #2-3',addressConfirmed:true,fulfillmentChosen:true,
  deliveryFeeCalculated:2000,paymentMethod:'cash',contactPhone:h.conv.phoneE164,phoneConfirmed:true,notesCollected:true});
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:407,dailyOrderNumber:407});
 h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 await h.sendQueued(`Cuánto cuesta ${name}?`);
 expect(h.conv.sessionData.pendingAddOffer?.productId).toBe(40701);expect(h.conv.sessionData.cart).toEqual([]);
 return {h,menu};
}
for(const name of ['Arroz Con Pollo','Pasta Vegetal'])for(const agent of [false,true])for(const separator of ['; ','\n',', ']){
 for(const [index,data] of [...fields,fields.join(separator)].entries())it(`accepts quote with contact ${name}/${agent}/${JSON.stringify(separator)}/${index}`,async()=>{
  const {h}=await setup(name,agent);const reply=await h.sendQueued('Sí'+separator+data);
  expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:40701,quantity:1})]);
  expect(h.conv.sessionData.pendingAddOffer).toBeUndefined();expect(reply).toContain(name);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(index===0||index===4)expect(h.conv.customerName).toBe('Camila Rojas');
  if(index===1||index===4)expect(h.conv.sessionData.contactPhone).toMatch(/3000000002$/);
  if(index===2||index===4)expect(h.conv.sessionData.address).toMatch(/6b.*81b.*51.*3.*510/i);
  if(index===3||index===4)expect(h.conv.sessionData.paymentMethod).toBe('transfer');
  await h.sendQueued('Por favor');expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:40701,quantity:1})]);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('no más');if(h.conv.state==='awaiting_payment')await h.sendQueued('contraentrega');
  await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toEqual([expect.objectContaining({productId:40701})]);
  if(index===0||index===4)expect(dto.customerName).toBe('Camila Rojas');
  if(index===1||index===4)expect(dto.phone).toMatch(/3000000002$/);
  if(index===2||index===4)expect(dto.address).toMatch(/6b.*81b.*51.*3.*510/i);
 });
 for(const message of [
  'Sí; A nombre de Camila Rojas; Pago por Nequi si me descuentas',
  '"Sí"; A nombre de Camila Rojas; La dirección es Calle 6B #81B-51',
  '¿Sí?; A nombre de Camila Rojas; La dirección es Calle 6B #81B-51',
 ])it(`does not authorize a quote with ambiguous contact ${name}/${agent}/${JSON.stringify(separator)}/${message}`,async()=>{
  const {h}=await setup(name,agent);const before=structuredClone(h.conv.sessionData);
  await h.sendQueued(message.replace(/; /g,separator));expect(h.conv.sessionData.cart).toEqual([]);
  expect(h.conv.customerName).toBe('Wilmer');expect(h.conv.sessionData.paymentMethod).toBe('cash');
  expect(h.conv.sessionData.pendingAddOffer).toEqual(before.pendingAddOffer);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
}

for(const name of ['Arroz Con Pollo','Pasta Vegetal'])for(const agent of [false,true]) {
 it(`keeps quoted product options outside the contact route ${name}/${agent}`,async()=>{
  const {h,menu}=await setup(name,agent);
  Object.assign(menu[0],{hasAttributes:true,attributes:[{attributeName:'Arepas',options:['Blancas','Fritas']}]});
  await h.sendQueued('Sí, arepas fritas');
  expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:40701,quantity:1,attributes:expect.arrayContaining([{attributeName:'Arepas',attributeValue:'Fritas'}])})]);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 for(const changed of ['price','stock'])for(const separator of ['; ','\n',', '])it(`rechecks quote before addition and keeps valid contact ${name}/${agent}/${changed}/${JSON.stringify(separator)}`,async()=>{
  const {h,menu}=await setup(name,agent);
  if(changed==='price')menu[0].price=21000;else menu[0].availableNow=false;
  const reply=await h.sendQueued('Sí'+separator+fields.join(separator));
  expect(h.conv.sessionData.cart).toEqual([]);expect(h.conv.customerName).toBe('Camila Rojas');
  expect(h.conv.sessionData.paymentMethod).toBe('transfer');expect(h.conv.sessionData.contactPhone).toMatch(/3000000002$/);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(changed==='price'){expect(reply).toMatch(/precio.*cambi/i);expect(h.conv.sessionData.pendingAddOffer?.price).toBe(21000);}
  else expect(reply).toMatch(/no.*disponible/i);
 });
 it(`accepts quote plus a real contact burst once ${name}/${agent}`,async()=>{
  const {h}=await setup(name,agent);jest.useFakeTimers();
  try {
   const requests=['Sí',...fields].map((text,i)=>h.service.handleIncoming({waId:'customer',phoneE164:h.conv.phoneE164,messageId:`quote-contact-407-${i}`,messageType:'text',text,timestamp:Date.now()/1000,raw:{}}));
   await jest.advanceTimersByTimeAsync(4000);await Promise.all(requests);
  } finally {jest.useRealTimers();}
  expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:40701,quantity:1})]);
  expect(h.conv.customerName).toBe('Camila Rojas');expect(h.conv.sessionData.paymentMethod).toBe('transfer');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('no más');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toEqual([expect.objectContaining({productId:40701})]);
  expect(dto.customerName).toBe('Camila Rojas');expect(dto.phone).toMatch(/3000000002$/);expect(dto.address).toMatch(/6b.*81b.*51.*3.*510/i);
 });
 it(`accepts a multi-product quote with contact once ${name}/${agent}`,async()=>{
  const {h,menu}=await setup(name,agent);menu.push({...menu[0],id:40702,code:2,name:'Sopa Del Dia',price:10000});
  await h.sendQueued(`Cuánto cuesta ${name} y Sopa Del Dia?`);
  expect(h.conv.sessionData.pendingAddOffer?.productIds).toHaveLength(2);
  await h.sendQueued('Sí; '+fields.join('; '));
  expect(h.conv.sessionData.cart.map(line=>[line.productId,line.quantity])).toEqual([[40701,1],[40702,1]]);
  expect(h.conv.customerName).toBe('Camila Rojas');expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('no más');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items.map(item=>item.productId)).toEqual([40701,40702]);
  expect(dto.customerName).toBe('Camila Rojas');expect(dto.phone).toMatch(/3000000002$/);
 });
}
