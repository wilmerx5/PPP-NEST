import {harness} from './whatsapp-accuracy.test-support';
const fields=['A nombre de Camila Rojas','Mi celular es 3000000002','La dirección es Calle 6B #81B-51 Torre 3 apto 510','Pago por Nequi'];
function setup(family:string,agent:boolean,replacement:boolean){
 const quantity=2;
 const menu=[family+' Normal','Combo '+family].map((name,i)=>({id:41301+i,code:1+i,name,price:20000+5000*i,availableNow:true,hasAttributes:i>0,attributes:i?[{attributeName:'Bebida',options:['Limonada','Ginger','Manzana']}]:[]}));
 const h=harness(menu,agent);h.cfg.ignoreBusinessHours=false;
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:413,dailyOrderNumber:413});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 const original={productId:41301,code:1,name:menu[0].name,unitPrice:20000,quantity,note:'Sin cebolla',attributes:[]};
 Object.assign(h.conv.sessionData,{cart:replacement?[structuredClone(original)]:[],orderType:'delivery',address:'Calle 1 #2-3',addressConfirmed:true,fulfillmentChosen:true,deliveryFeeCalculated:2000,paymentMethod:'cash',contactPhone:h.conv.phoneE164,phoneConfirmed:true,notesCollected:true,
 pendingAttribute:{productId:41302,code:2,name:menu[1].name,price:25000,quantity,attributes:menu[1].attributes,selected:[],sourceText:'cambia a '+menu[1].name,...(replacement?{replacement:{originalLine:structuredClone(original)}}:{})}});h.conv.state='awaiting_attribute';
 return {h,menu,original};
}

const choices=['uno con Limonada y el otro con Ginger','los quiero 1 con Limonada y 1 con Ginger'];
for(const family of ['Pollo','Hamburguesa'])for(const agent of [false,true])for(const replacement of [false,true]){
 for(const separator of ['; ','\n',', '])for(const [index,data] of [...fields,fields.join(separator)].entries())it(`distribution/contact ${family}/${agent}/${replacement}/${JSON.stringify(separator)}/${index}`,async()=>{
  const {h}=setup(family,agent,replacement);const reply=await h.sendQueued(choices[index%2]+separator+data);
  expect(h.conv.sessionData.cart).toHaveLength(2);
  for(const [i,value] of ['Limonada','Ginger'].entries())expect(h.conv.sessionData.cart[i]).toMatchObject({productId:41302,quantity:1,unitPrice:25000,attributes:[{attributeName:'Bebida',attributeValue:value}]});
  expect(h.conv.sessionData.pendingAttribute).toBeUndefined();expect(reply).toContain('Limonada');expect(reply).toContain('Ginger');expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(replacement)for(const line of h.conv.sessionData.cart)expect(line.note).toMatch(/sin cebolla/i);
  if(index===0||index===4)expect(h.conv.customerName).toBe('Camila Rojas');if(index===1||index===4)expect(h.conv.sessionData.contactPhone).toMatch(/3000000002$/);if(index===2||index===4)expect(h.conv.sessionData.address).toMatch(/81b/i);if(index===3||index===4)expect(h.conv.sessionData.paymentMethod).toBe('transfer');
  if(index===4){await h.sendQueued('no más');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toHaveLength(2);expect(dto.items.map(item=>item.attributes[0].attributeValue)).toEqual(['Limonada','Ginger']);}
 });
 for(const choice of ['uno con Limonada y el otro con Agua','uno con Limonada y el otro con Ginger si me descuentas','¿uno con Limonada y el otro con Ginger?','los quiero 2 con Limonada y 1 con Ginger','los quiero 0 con Limonada y 1 con Ginger'])it(`invalid distribution/contact ${family}/${agent}/${replacement}/${choice}`,async()=>{
  const {h}=setup(family,agent,replacement),before=structuredClone(h.conv.sessionData);const reply=await h.sendQueued(choice+'; '+fields.join('; '));expect(reply).toMatch(/repart|grupo/i);expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBe('Wilmer');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
}

for(const family of ['Pollo','Hamburguesa'])for(const agent of [false,true])for(const replacement of [false,true]){
 for(const invalid of [false,true])it(`distribution contact burst ${family}/${agent}/${replacement}/${invalid}`,async()=>{
  const {h}=setup(family,agent,replacement),before=structuredClone(h.conv.sessionData);
  jest.useFakeTimers();try{
   const parts=[choices[0],'Por favor',...fields.slice(0,3),invalid?'Pago por Nequi si me descuentas':fields[3]];
   const requests=parts.map((text,i)=>h.service.handleIncoming({waId:'customer',phoneE164:h.conv.phoneE164,messageId:`distribution-contact-413-${i}`,messageType:'text',text,timestamp:Date.now()/1000,raw:{}}));
   await jest.advanceTimersByTimeAsync(4000);await Promise.all(requests);
  }finally{jest.useRealTimers();}
  if(invalid){expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBe('Wilmer');}
  else {expect(h.conv.sessionData.cart.map(line=>line.attributes?.[0].attributeValue)).toEqual(['Limonada','Ginger']);expect(h.conv.sessionData.cart.map(line=>line.quantity)).toEqual([1,1]);expect(h.conv.customerName).toBe('Camila Rojas');expect(h.conv.sessionData.paymentMethod).toBe('transfer');}
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 for(const change of ['price','stock','removed','option'])it(`live distribution/contact ${family}/${agent}/${replacement}/${change}`,async()=>{
  const {h,menu}=setup(family,agent,replacement),cart=structuredClone(h.conv.sessionData.cart);
  if(change==='price')menu[1].price=27000;else if(change==='stock')menu[1].availableNow=false;else if(change==='removed')menu.pop();else menu[1].attributes=[{attributeName:'Bebida',options:['Limonada','Manzana']}];
  const reply=await h.sendQueued(choices[0]+'; '+fields.join('; '));expect(h.conv.sessionData.cart).toEqual(cart);expect(h.conv.customerName).toBe('Camila Rojas');expect(h.service.ordersService.create).not.toHaveBeenCalled();
  expect(reply).toMatch(change==='price'?/precio.*cambi/i:change==='option'?/ya no.*opciones/i:/no.*disponible|ya no.*carta/i);
  if(change==='price'){await h.sendQueued(choices[1]);expect(h.conv.sessionData.cart.map(line=>line.unitPrice)).toEqual([27000,27000]);}
 });
 for(const data of ['A nombre de Camila Rojas; Pago por Nequi si me descuentas','La dirección es Calle 6B','Mi celular es 123','A nombre de Camila Rojas; A nombre de Otra Persona'])it(`invalid distribution form ${family}/${agent}/${replacement}/${data}`,async()=>{
  const {h}=setup(family,agent,replacement),before=structuredClone(h.conv.sessionData);await h.sendQueued(choices[0]+'; '+data);expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBe('Wilmer');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it(`keeps another cart item during distribution/contact ${family}/${agent}/${replacement}`,async()=>{
  const {h,menu}=setup(family,agent,replacement);const other={productId:41303,code:3,name:'Ensalada Verde',unitPrice:7000,quantity:1,attributes:[]};
  menu.push({id:41303,code:3,name:other.name,price:7000,availableNow:true,hasAttributes:false,attributes:[]});h.conv.sessionData.cart.push(other);
  await h.sendQueued(choices[0]+'; '+fields.join('; '));expect(h.conv.sessionData.cart).toContainEqual(other);expect(h.conv.sessionData.cart).toHaveLength(3);
  await h.sendQueued('no más');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toHaveLength(3);expect(dto.items.filter(item=>item.productId===41303)).toHaveLength(1);
 });
}

for(const family of ['Pollo','Hamburguesa'])for(const agent of [false,true])for(const replacement of [false,true])it(`unequal three-unit distribution/contact ${family}/${agent}/${replacement}`,async()=>{
 const {h}=setup(family,agent,replacement);h.conv.sessionData.pendingAttribute!.quantity=3;
 if(replacement){h.conv.sessionData.cart[0].quantity=3;h.conv.sessionData.pendingAttribute!.replacement!.originalLine.quantity=3;}
 const reply=await h.sendQueued('los quiero 1 con Limonada y 2 con Ginger; '+fields.join('; '));
 expect(h.conv.sessionData.cart.map(line=>line.quantity)).toEqual([1,2]);expect(h.conv.sessionData.cart.map(line=>line.attributes?.[0].attributeValue)).toEqual(['Limonada','Ginger']);expect(reply).toContain('Limonada');expect(reply).toContain('Ginger');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 await h.sendQueued('no más');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
 const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toHaveLength(3);expect(dto.items.map(item=>item.attributes[0].attributeValue)).toEqual(['Limonada','Ginger','Ginger']);
});
