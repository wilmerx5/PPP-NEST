import {harness} from './whatsapp-accuracy.test-support';
const fields=['A nombre de Camila Rojas','Mi celular es 3000000002','La dirección es Calle 6B #81B-51 Torre 3 apto 510','Pago por Nequi'];
function setup(family:string,agent:boolean,replacement:boolean){
 const quantity=2;
 const menu=[family+' Normal','Combo '+family].map((name,i)=>({id:41401+i,code:1+i,name,price:20000+5000*i,availableNow:true,hasAttributes:i>0,attributes:i?[{attributeName:'Bebida',options:['Limonada','Ginger','Manzana']}]:[]}));
 const h=harness(menu,agent);h.cfg.ignoreBusinessHours=false;
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:414,dailyOrderNumber:414});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 const original={productId:41401,code:1,name:menu[0].name,unitPrice:20000,quantity,note:'Sin cebolla',attributes:[]};
 Object.assign(h.conv.sessionData,{cart:replacement?[structuredClone(original)]:[],orderType:'delivery',address:'Calle 1 #2-3',addressConfirmed:true,fulfillmentChosen:true,deliveryFeeCalculated:2000,paymentMethod:'cash',contactPhone:h.conv.phoneE164,phoneConfirmed:true,notesCollected:true,
 pendingAttribute:{productId:41402,code:2,name:menu[1].name,price:25000,quantity,attributes:menu[1].attributes,selected:[],sourceText:'cambia a '+menu[1].name,...(replacement?{replacement:{originalLine:structuredClone(original)}}:{})}});h.conv.state='awaiting_attribute';
 return {h,menu,original};
}

for(const family of ['Pollo','Hamburguesa'])for(const agent of [false,true])for(const replacement of [false,true]){
 for(const separator of ['; ','\n',', '])for(const contactAt of ['first','last','both'])it(`staged distribution/contact ${family}/${agent}/${replacement}/${JSON.stringify(separator)}/${contactAt}`,async()=>{
  const {h}=setup(family,agent,replacement),cart=structuredClone(h.conv.sessionData.cart);
  const first=await h.sendQueued('uno con Limonada'+(contactAt==='last'?'':separator+fields.join(separator)));
  expect(h.conv.sessionData.cart).toEqual(cart);expect(h.conv.sessionData.pendingAttribute?.distributionParts?.map(part=>part.toLowerCase())).toEqual(['1 con limonada']);expect(first).toMatch(/faltan.*1|falta.*1/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  const reply=await h.sendQueued('el otro con Ginger'+(contactAt==='first'?'':separator+fields.join(separator)));
  expect(h.conv.sessionData.cart.map(line=>line.quantity)).toEqual([1,1]);expect(h.conv.sessionData.cart.map(line=>line.attributes?.[0].attributeValue)).toEqual(['Limonada','Ginger']);expect(h.conv.sessionData.pendingAttribute).toBeUndefined();expect(reply).toContain('Limonada');expect(reply).toContain('Ginger');expect(h.conv.customerName).toBe('Camila Rojas');expect(h.conv.sessionData.paymentMethod).toBe('transfer');expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(replacement)for(const line of h.conv.sessionData.cart)expect(line.note).toMatch(/sin cebolla/i);
  if(contactAt==='both'){await h.sendQueued('no más');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toHaveLength(2);expect(dto.items.map(item=>item.attributes[0].attributeValue)).toEqual(['Limonada','Ginger']);}
 });
}

for(const family of ['Pollo','Hamburguesa'])for(const agent of [false,true])for(const replacement of [false,true]){
 for(const afterFirst of [false,true])for(const data of ['Pago por Nequi si me descuentas','La dirección es Calle 6B','Mi celular es 123','A nombre de Camila Rojas; A nombre de Otra Persona'])it(`invalid staged contact ${family}/${agent}/${replacement}/${afterFirst}/${data}`,async()=>{
  const {h}=setup(family,agent,replacement);if(afterFirst)await h.sendQueued('uno con Limonada');const before=structuredClone(h.conv.sessionData);
  await h.sendQueued((afterFirst?'el otro con Ginger':'uno con Limonada')+'; '+data);expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBe('Wilmer');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 for(const invalid of [false,true])it(`staged contact burst ${family}/${agent}/${replacement}/${invalid}`,async()=>{
  const {h}=setup(family,agent,replacement);await h.sendQueued('uno con Limonada');const before=structuredClone(h.conv.sessionData);
  jest.useFakeTimers();try{const parts=['el otro con Ginger','Por favor',...fields.slice(0,3),invalid?'Pago por Nequi si me descuentas':fields[3]];const requests=parts.map((text,i)=>h.service.handleIncoming({waId:'customer',phoneE164:h.conv.phoneE164,messageId:`staged-contact-414-${i}`,messageType:'text',text,timestamp:Date.now()/1000,raw:{}}));await jest.advanceTimersByTimeAsync(4000);await Promise.all(requests);}finally{jest.useRealTimers();}
  if(invalid){expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBe('Wilmer');}
  else{expect(h.conv.sessionData.cart.map(line=>line.quantity)).toEqual([1,1]);expect(h.conv.sessionData.cart.map(line=>line.attributes?.[0].attributeValue)).toEqual(['Limonada','Ginger']);expect(h.conv.customerName).toBe('Camila Rojas');}
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 for(const change of ['price','stock','removed','option'])it(`catalog between stages ${family}/${agent}/${replacement}/${change}`,async()=>{
  const {h,menu}=setup(family,agent,replacement);await h.sendQueued('uno con Limonada');const cart=structuredClone(h.conv.sessionData.cart);
  if(change==='price')menu[1].price=27000;else if(change==='stock')menu[1].availableNow=false;else if(change==='removed')menu.pop();else menu[1].attributes=[{attributeName:'Bebida',options:['Ginger','Manzana']}];
  const reply=await h.sendQueued('el otro con Ginger; '+fields.join('; '));expect(h.conv.sessionData.cart).toEqual(cart);expect(h.conv.customerName).toBe('Camila Rojas');expect(h.service.ordersService.create).not.toHaveBeenCalled();
  expect(reply).toMatch(change==='price'?/precio.*cambi/i:change==='option'?/ya no.*opciones/i:/no.*disponible|ya no.*carta/i);
  if(change==='price'){await h.sendQueued('el otro con Ginger; '+fields.join('; '));expect(h.conv.sessionData.cart.map(line=>line.unitPrice)).toEqual([27000,27000]);}
  if(change==='option'){await h.sendQueued('los quiero 1 con Ginger y 1 con Manzana; '+fields.join('; '));expect(h.conv.sessionData.cart.map(line=>line.attributes?.[0].attributeValue)).toEqual(['Ginger','Manzana']);}
 });
 it(`three separate stages/contact ${family}/${agent}/${replacement}`,async()=>{
  const {h}=setup(family,agent,replacement);h.conv.sessionData.pendingAttribute!.quantity=3;if(replacement){h.conv.sessionData.cart[0].quantity=3;h.conv.sessionData.pendingAttribute!.replacement!.originalLine.quantity=3;}const cart=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('uno con Limonada; '+fields.join('; '));expect(h.conv.sessionData.cart).toEqual(cart);
  const second=await h.sendQueued('el otro con Ginger; '+fields.join('; '));expect(h.conv.sessionData.cart).toEqual(cart);expect(second).toMatch(/faltan.*1|falta.*1/i);expect(h.conv.sessionData.pendingAttribute?.distributionParts).toHaveLength(2);
  await h.sendQueued('los restantes con Manzana; '+fields.join('; '));expect(h.conv.sessionData.cart.map(line=>line.quantity)).toEqual([1,1,1]);expect(h.conv.sessionData.cart.map(line=>line.attributes?.[0].attributeValue)).toEqual(['Limonada','Ginger','Manzana']);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('no más');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(3);
 });
}

for(const family of ['Pollo','Hamburguesa'])for(const agent of [false,true])for(const replacement of [false,true])for(const choice of ['0 con Ginger','2 con Ginger','2','el otro con Agua'])it(`invalid remaining choice/contact ${family}/${agent}/${replacement}/${choice}`,async()=>{
 const {h}=setup(family,agent,replacement);await h.sendQueued('uno con Limonada');const before=structuredClone(h.conv.sessionData);await h.sendQueued(choice+'; '+fields.join('; '));expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBe('Wilmer');expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
