import {harness} from './whatsapp-accuracy.test-support';
const fields=['A nombre de Camila Rojas','Mi celular es 3000000002','La dirección es Calle 6B #81B-51 Torre 3 apto 510','Pago por Nequi'];
async function setup(kind:string,agent:boolean){
 const juice=kind==='juice',attributeName=juice?'Sabor':'Bebida',options=juice?['Mango','Guanábana','Lulo']:['Colombiana','Ginger','Manzana'];
 const menu=[{id:41101,code:31,name:juice?'Jugo Natural En Agua':'Hamburguesa Clásica',categoryName:juice?'Jugos':'Hamburguesas',price:12000},
 {id:41102,code:42,name:juice?'Jugo Natural En Leche':'Hamburguesa Especial',categoryName:juice?'Jugos':'Hamburguesas',price:15000}]
 .map(p=>({...p,availableNow:true,hasAttributes:true,attributes:[{attributeName,options}]}));
 const h=harness(menu,agent);h.cfg.ignoreBusinessHours=false;
 Object.assign(h.conv.sessionData,{orderType:'delivery',address:'Calle 1 #2-3',addressConfirmed:true,fulfillmentChosen:true,
 deliveryFeeCalculated:2000,paymentMethod:'cash',contactPhone:h.conv.phoneE164,phoneConfirmed:true,notesCollected:true});
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:411,dailyOrderNumber:411});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 if(juice)await h.sendQueued('Quiero un jugo natural en agua');else {await h.sendQueued('Quiero una hamburguesa');await h.sendQueued('1');}
 expect(h.conv.sessionData.pendingAttribute?.productId).toBe(41101);expect(h.conv.sessionData.cart).toEqual([]);
 return {h,menu,attributeName,option:options[1]};
}
for(const kind of ['juice','meal'])for(const agent of [false,true]){
 for(const numeric of [false,true])for(const separator of ['; ','\n',', '])for(const [index,data] of [...fields,fields.join(separator)].entries())it(`answers one option with contact ${kind}/${agent}/${numeric}/${JSON.stringify(separator)}/${index}`,async()=>{
  const {h,attributeName,option,menu}=await setup(kind,agent);const reply=await h.sendQueued((numeric?'2':option)+separator+data);
  expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:41101,quantity:1,attributes:[{attributeName,attributeValue:option}]})]);
  expect(h.conv.sessionData.pendingAttribute).toBeUndefined();expect(reply).toContain(menu[0].name);expect(reply).toContain(option);
  expect(h.conv.sessionData.cart[0].note||'').not.toMatch(/Camila|Nequi|3000000002|81B/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(index===0||index===4)expect(h.conv.customerName).toBe('Camila Rojas');
  if(index===1||index===4)expect(h.conv.sessionData.contactPhone).toMatch(/3000000002$/);
  if(index===2||index===4)expect(h.conv.sessionData.address).toMatch(/6b.*81b.*51.*3.*510/i);
  if(index===3||index===4)expect(h.conv.sessionData.paymentMethod).toBe('transfer');
  const cart=structuredClone(h.conv.sessionData.cart);await h.sendQueued('Por favor');expect(h.conv.sessionData.cart).toEqual(cart);
  if(index===4){await h.sendQueued('no más');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
   const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toEqual([expect.objectContaining({productId:41101})]);expect(dto.customerName).toBe('Camila Rojas');expect(dto.phone).toMatch(/3000000002$/);expect(dto.address).toMatch(/6b.*81b.*51/i);
  }
 });
 for(const prefix of ['"2"','¿2?','-1','+2','8','Otra opción'])it(`does not authorize an unclear option form ${kind}/${agent}/${prefix}`,async()=>{
  const {h}=await setup(kind,agent);const before=structuredClone(h.conv.sessionData);
  const reply=await h.sendQueued(prefix+'; '+fields.join('; '));expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBe('Wilmer');expect(reply).toMatch(/No cambié|opción|elige|número/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 for(const tail of ['Pago por Nequi si me descuentas','La dirección es Calle 6B','A nombre de Otra Persona','agrega otro producto'])it(`keeps the entire attribute form atomic ${kind}/${agent}/${tail}`,async()=>{
  const {h,option}=await setup(kind,agent);const before=structuredClone(h.conv.sessionData);
  await h.sendQueued(option+'; '+fields[0]+'; '+tail);expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBe('Wilmer');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
}

for(const kind of ['juice','meal'])for(const agent of [false,true]){
 for(const numeric of [false,true])for(const invalid of [false,true])it(`validates an entire option and contact burst ${kind}/${agent}/${numeric}/${invalid}`,async()=>{
  const {h,option,attributeName}=await setup(kind,agent);const before=structuredClone(h.conv.sessionData);jest.useFakeTimers();
  try{const texts=[numeric?'2':option,...fields.slice(0,3),invalid?'Pago por Nequi si me descuentas':fields[3]];
   const requests=texts.map((text,i)=>h.service.handleIncoming({waId:'customer',phoneE164:h.conv.phoneE164,messageId:`attribute-contact-411-${i}`,messageType:'text',text,timestamp:Date.now()/1000,raw:{}}));
   await jest.advanceTimersByTimeAsync(4000);await Promise.all(requests);
  }finally{jest.useRealTimers();}
  if(invalid){expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBe('Wilmer');}
  else {expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:41101,quantity:1,attributes:[{attributeName,attributeValue:option}]})]);expect(h.conv.customerName).toBe('Camila Rojas');expect(h.conv.sessionData.paymentMethod).toBe('transfer');}
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 for(const numeric of [false,true])it(`does not consume an option before an incomplete address bubble ${kind}/${agent}/${numeric}`,async()=>{
  const {h,option}=await setup(kind,agent);const before=structuredClone(h.conv.sessionData);jest.useFakeTimers();
  try{const requests=[numeric?'2':option,'La dirección es Calle 6B'].map((text,i)=>h.service.handleIncoming({waId:'customer',phoneE164:h.conv.phoneE164,messageId:`attribute-address-411-${i}`,messageType:'text',text,timestamp:Date.now()/1000,raw:{}}));await jest.advanceTimersByTimeAsync(4000);await Promise.all(requests);}finally{jest.useRealTimers();}
  expect(h.conv.sessionData).toEqual(before);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 for(const change of ['price','stock','removed'])for(const contact of [false,true])it(`uses live catalog after an option response ${kind}/${agent}/${change}/${contact}`,async()=>{
  const {h,menu,option}=await setup(kind,agent);if(change==='price')menu[0].price=14000;else if(change==='stock')menu[0].availableNow=false;else menu.splice(0,1);
  const reply=await h.sendQueued(option+(contact?'; '+fields.join('; '):''));expect(h.conv.sessionData.cart).toEqual([]);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(contact)expect(h.conv.customerName).toBe('Camila Rojas');
  if(change==='price'){expect(reply).toMatch(/precio.*cambi/i);expect(h.conv.sessionData.pendingAttribute?.price).toBe(14000);await h.sendQueued(option);expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:41101,quantity:1,unitPrice:14000})]);}
  else expect(reply).toMatch(/no.*disponible|ya no.*carta/i);
 });
 it(`keeps the previously ordered item and its option ${kind}/${agent}`,async()=>{
  const {h,option,attributeName,menu}=await setup(kind,agent);const existing={productId:41102,code:42,name:menu[1].name,unitPrice:15000,quantity:1,attributes:[{attributeName,attributeValue:menu[1].attributes[0].options[0]}]};h.conv.sessionData.cart=[existing];
  await h.sendQueued(option+'; '+fields.join('; '));expect(h.conv.sessionData.cart).toEqual([existing,expect.objectContaining({productId:41101,quantity:1,attributes:[{attributeName,attributeValue:option}]})]);
  await h.sendQueued('no más');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.service.ordersService.create.mock.calls[0][0].items.map(item=>item.productId)).toEqual([41102,41101]);
 });
 it(`keeps two requested units separate from phone and address numbers ${kind}/${agent}`,async()=>{
  const {h,option,attributeName}=await setup(kind,agent);h.conv.sessionData.pendingAttribute!.quantity=2;
  await h.sendQueued('2; '+fields.join('; '));expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:41101,quantity:2,attributes:[{attributeName,attributeValue:option}]})]);
  await h.sendQueued('Por favor');expect(h.conv.sessionData.cart[0].quantity).toBe(2);await h.sendQueued('no más');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(2);
 });
 for(const future of [false,true])it(`does not apply the answer to another open attribute ${kind}/${agent}/${future}`,async()=>{
  const {h,menu,option,attributeName}=await setup(kind,agent);const extra={attributeName:'Tamaño',options:['Pequeño','Grande']};menu[0].attributes.push(extra);h.conv.sessionData.pendingAttribute!.requireExplicitOptions=true;
  const before=structuredClone(h.conv.sessionData);const reply=await h.sendQueued((future?'Grande':option)+'; '+fields.join('; '));
  expect(h.conv.sessionData.cart).toEqual([]);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(future){expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBe('Wilmer');}
  else {expect(h.conv.customerName).toBe('Camila Rojas');expect(h.conv.sessionData.pendingAttribute?.selected).toEqual([{attributeName,attributeValue:option}]);expect(reply).toContain('Tamaño');await h.sendQueued('2');expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:41101,quantity:1,attributes:[{attributeName,attributeValue:option},{attributeName:'Tamaño',attributeValue:'Grande'}]})]);}
 });
}

for(const kind of ['juice','meal'])for(const agent of [false,true]){
 for(const prefix of ['con','label','con-label'])it(`accepts a bounded spoken option prefix ${kind}/${agent}/${prefix}`,async()=>{
  const {h,option,attributeName}=await setup(kind,agent);const choice=prefix==='con'?'con '+option:prefix==='label'?attributeName+' '+option:'con '+attributeName+' '+option;
  await h.sendQueued(choice+'; '+fields.join('; '));expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:41101,quantity:1,attributes:[{attributeName,attributeValue:option}]})]);expect(h.conv.customerName).toBe('Camila Rojas');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it(`normalizes only the option name case and accents ${kind}/${agent}`,async()=>{
  const {h,option,attributeName}=await setup(kind,agent);const choice=option.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
  await h.sendQueued(choice+'; '+fields.join('; '));expect(h.conv.sessionData.cart[0].attributes).toEqual([{attributeName,attributeValue:option}]);expect(h.conv.customerName).toBe('Camila Rojas');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 for(const quoted of [false,true])it(`keeps an uncertain option burst from consuming an address ${kind}/${agent}/${quoted}`,async()=>{
  const {h,option}=await setup(kind,agent);const before=structuredClone(h.conv.sessionData);jest.useFakeTimers();
  try{const requests=[quoted?'"'+option+'"':'¿'+option+'?','La dirección es Calle 6B #81B-51'].map((text,i)=>h.service.handleIncoming({waId:'customer',phoneE164:h.conv.phoneE164,messageId:`attribute-uncertain-411-${i}`,messageType:'text',text,timestamp:Date.now()/1000,raw:{}}));await jest.advanceTimersByTimeAsync(4000);await Promise.all(requests);}finally{jest.useRealTimers();}
  expect(h.conv.sessionData).toEqual(before);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it(`keeps a raw contact phone bubble out of option quantities ${kind}/${agent}`,async()=>{
  const {h,option}=await setup(kind,agent);jest.useFakeTimers();
  try{const requests=[option,'3000000002'].map((text,i)=>h.service.handleIncoming({waId:'customer',phoneE164:h.conv.phoneE164,messageId:`attribute-phone-411-${i}`,messageType:'text',text,timestamp:Date.now()/1000,raw:{}}));await jest.advanceTimersByTimeAsync(4000);await Promise.all(requests);}finally{jest.useRealTimers();}
  expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:41101,quantity:1})]);expect(h.conv.sessionData.contactPhone).toMatch(/3000000002$/);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 for(const separator of ['; ','\n',', '])for(const reverse of [false,true])it(`keeps contact order independent from the option ${kind}/${agent}/${JSON.stringify(separator)}/${reverse}`,async()=>{
  const {h,option}=await setup(kind,agent);const data=reverse?[...fields].reverse():[fields[3],fields[2],fields[0],fields[1]];
  await h.sendQueued(option+separator+data.join(separator));expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:41101,quantity:1})]);expect(h.conv.customerName).toBe('Camila Rojas');expect(h.conv.sessionData.paymentMethod).toBe('transfer');expect(h.conv.sessionData.contactPhone).toMatch(/3000000002$/);expect(h.conv.sessionData.address).toMatch(/6b.*81b.*51/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
}

async function presaSetup(agent:boolean){
 const menu=[{id:41103,code:43,name:'Ejecutivo Con Pollo Frito',price:24000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Presa',options:['Pierna Pernil','Ala, pechuga','Muslo']}]}];
 const h=harness(menu,agent);h.cfg.ignoreBusinessHours=false;
 Object.assign(h.conv.sessionData,{orderType:'delivery',address:'Calle 1 #2-3',addressConfirmed:true,fulfillmentChosen:true,deliveryFeeCalculated:2000,paymentMethod:'cash',contactPhone:h.conv.phoneE164,phoneConfirmed:true,notesCollected:true,
 pendingAttribute:{productId:41103,code:43,name:menu[0].name,price:24000,attributes:menu[0].attributes,selected:[],quantity:1,requireExplicitOptions:true,sourceText:'Quiero un ejecutivo con pollo frito'}});
 h.conv.state='awaiting_attribute';h.service.ordersService.create=jest.fn().mockResolvedValue({id:411,dailyOrderNumber:411});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 return h;
}
for(const agent of [false,true])for(const choice of ['2','Ala, pechuga'])for(const separator of ['; ','\n',', '])for(const [index,data] of [...fields,fields.join(separator)].entries())it(`keeps punctuation inside the catalog option ${agent}/${choice}/${JSON.stringify(separator)}/${index}`,async()=>{
 const h=await presaSetup(agent);const reply=await h.sendQueued(choice+separator+data);
 expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:41103,quantity:1,attributes:[{attributeName:'Presa',attributeValue:'Ala, pechuga'}]})]);expect(reply).toContain('Ala, pechuga');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 if(index===0||index===4)expect(h.conv.customerName).toBe('Camila Rojas');if(index===1||index===4)expect(h.conv.sessionData.contactPhone).toMatch(/3000000002$/);if(index===2||index===4)expect(h.conv.sessionData.address).toMatch(/6b.*81b.*51/i);if(index===3||index===4)expect(h.conv.sessionData.paymentMethod).toBe('transfer');
 if(index===4){await h.sendQueued('no más');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.service.ordersService.create.mock.calls[0][0].items).toEqual([expect.objectContaining({productId:41103})]);}
});
for(const agent of [false,true])for(const separator of ['; ','\n',', '])it(`does not choose between two catalog values in the same form ${agent}/${JSON.stringify(separator)}`,async()=>{
 const h=await presaSetup(agent);const before=structuredClone(h.conv.sessionData);await h.sendQueued('Pierna Pernil, Ala, pechuga'+separator+fields.join(separator));expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBe('Wilmer');expect(h.service.ordersService.create).not.toHaveBeenCalled();
});

for(const agent of [false,true])for(const numeric of [false,true])for(const invalid of [false,true])it(`preserves a comma-bearing option across a real burst ${agent}/${numeric}/${invalid}`,async()=>{
 const h=await presaSetup(agent);const before=structuredClone(h.conv.sessionData);jest.useFakeTimers();
 try{const texts=[numeric?'2':'Ala, pechuga',...fields.slice(0,3),invalid?'Pago por Nequi si me descuentas':fields[3]];const requests=texts.map((text,i)=>h.service.handleIncoming({waId:'customer',phoneE164:h.conv.phoneE164,messageId:`attribute-presa-411-${i}`,messageType:'text',text,timestamp:Date.now()/1000,raw:{}}));await jest.advanceTimersByTimeAsync(4000);await Promise.all(requests);}finally{jest.useRealTimers();}
 if(invalid){expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBe('Wilmer');}
 else {expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:41103,quantity:1,attributes:[{attributeName:'Presa',attributeValue:'Ala, pechuga'}]})]);expect(h.conv.customerName).toBe('Camila Rojas');}
 expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
for(const kind of ['juice','meal'])for(const agent of [false,true])it(`accepts a labelled option with colon without consuming the contact ${kind}/${agent}`,async()=>{
 const {h,attributeName,option}=await setup(kind,agent);await h.sendQueued(attributeName+': '+option+'; '+fields.join('; '));expect(h.conv.sessionData.cart[0].attributes).toEqual([{attributeName,attributeValue:option}]);expect(h.conv.customerName).toBe('Camila Rojas');expect(h.service.ordersService.create).not.toHaveBeenCalled();
});

for(const agent of [false,true])for(const choice of ['2','Ala, pechuga'])it(`keeps a plain unambiguous compound option out of the agent ${agent}/${choice}`,async()=>{
 const h=await presaSetup(agent);const reply=await h.sendQueued(choice);expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:41103,quantity:1,attributes:[{attributeName:'Presa',attributeValue:'Ala, pechuga'}]})]);expect(h.conv.customerName).toBe('Wilmer');expect(reply).toContain('Ala, pechuga');expect(h.service.ordersService.create).not.toHaveBeenCalled();
});

for(const kind of ['juice','meal'])for(const agent of [false,true]){
 for(const numeric of [false,true])for(const courtesy of ['por favor','porfa','gracias'])it(`keeps a courtesy bubble inside the option and contact decision ${kind}/${agent}/${numeric}/${courtesy}`,async()=>{
  const {h,option,attributeName}=await setup(kind,agent);jest.useFakeTimers();
  try{const texts=[numeric?'2':option,courtesy,...fields];const requests=texts.map((text,i)=>h.service.handleIncoming({waId:'customer',phoneE164:h.conv.phoneE164,messageId:`attribute-courtesy-411-${i}`,messageType:'text',text,timestamp:Date.now()/1000,raw:{}}));await jest.advanceTimersByTimeAsync(4000);await Promise.all(requests);}finally{jest.useRealTimers();}
  expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:41101,quantity:1,attributes:[{attributeName,attributeValue:option}]})]);expect(h.conv.customerName).toBe('Camila Rojas');expect(h.conv.sessionData.paymentMethod).toBe('transfer');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it(`does not broadcast the offered value to a second required attribute ${kind}/${agent}`,async()=>{
  const {h,menu,option,attributeName}=await setup(kind,agent);const extra={attributeName:'Aderezo',options:[option,'Otra opción']};menu[0].attributes.push(extra);h.conv.sessionData.pendingAttribute!.requireExplicitOptions=true;
  const reply=await h.sendQueued(option+'; '+fields.join('; '));expect(h.conv.sessionData.cart).toEqual([]);expect(h.conv.sessionData.pendingAttribute?.selected).toEqual([{attributeName,attributeValue:option}]);expect(reply).toContain('Aderezo');expect(h.conv.customerName).toBe('Camila Rojas');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
}

for(const kind of ['juice','meal'])for(const agent of [false,true]){
 it(`preserves a previous attribute even when it shares the new option value ${kind}/${agent}`,async()=>{
  const {h,menu,option,attributeName}=await setup(kind,agent);const prior={attributeName:'Salsa',options:['Otra',option]};menu[0].attributes.unshift(prior);h.conv.sessionData.pendingAttribute!.attributes.unshift(prior);h.conv.sessionData.pendingAttribute!.selected=[{attributeName:'Salsa',attributeValue:'Otra'}];h.conv.sessionData.pendingAttribute!.requireExplicitOptions=true;
  await h.sendQueued(option+'; '+fields.join('; '));expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:41101,quantity:1,attributes:[{attributeName:'Salsa',attributeValue:'Otra'},{attributeName,attributeValue:option}]})]);expect(h.conv.customerName).toBe('Camila Rojas');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it(`rejects a withdrawn option and retains valid contact ${kind}/${agent}`,async()=>{
  const {h,menu,option,attributeName}=await setup(kind,agent);menu[0].attributes[0].options.splice(1,1);
  const reply=await h.sendQueued(option+'; '+fields.join('; '));expect(h.conv.sessionData.cart).toEqual([]);expect(h.conv.customerName).toBe('Camila Rojas');expect(reply).toMatch(/ya no|no.*disponible/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('1');expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:41101,quantity:1,attributes:[{attributeName,attributeValue:menu[0].attributes[0].options[0]}]})]);
 });
 it(`refreshes the option snapshot with a changed catalog price ${kind}/${agent}`,async()=>{
  const {h,menu,option,attributeName}=await setup(kind,agent);menu[0].price=14000;menu[0].attributes[0].options[1]='Piña';
  const reply=await h.sendQueued(option+'; '+fields.join('; '));expect(h.conv.sessionData.cart).toEqual([]);expect(h.conv.customerName).toBe('Camila Rojas');expect(reply).toMatch(/precio.*cambi/i);expect(h.conv.sessionData.pendingAttribute?.attributes[0].options[1]).toBe('Piña');
  await h.sendQueued('Piña');expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:41101,quantity:1,unitPrice:14000,attributes:[{attributeName,attributeValue:'Piña'}]})]);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
}

for(const kind of ['juice','meal'])for(const agent of [false,true])it(`binds the number to the question actually shown rather than raw catalog order ${kind}/${agent}`,async()=>{
 const {h,menu,attributeName,option}=await setup(kind,agent);const extra={attributeName:'Tamaño',options:['Pequeño','Grande']};menu[0].attributes.push(extra);h.conv.sessionData.pendingAttribute!.attributes.push(extra);h.conv.sessionData.pendingAttribute!.requireExplicitOptions=true;
 const prompt=h.service.catalogService.formatProductOptionsPrompt(menu[0],[]);expect(prompt).toContain('Tamaño');
 const reply=await h.sendQueued('2; '+fields.join('; '));expect(h.conv.sessionData.cart).toEqual([]);expect(h.conv.sessionData.pendingAttribute?.selected).toEqual([{attributeName:'Tamaño',attributeValue:'Grande'}]);expect(reply).toContain(attributeName);
 await h.sendQueued('2');expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:41101,quantity:1,attributes:[{attributeName:'Tamaño',attributeValue:'Grande'},{attributeName,attributeValue:option}]})]);expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
