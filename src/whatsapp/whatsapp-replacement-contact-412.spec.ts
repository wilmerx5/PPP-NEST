import {harness} from './whatsapp-accuracy.test-support';
const fields=['A nombre de Camila Rojas','Mi celular es 3000000002','La dirección es Calle 6B #81B-51 Torre 3 apto 510','Pago por Nequi'];
function setup(family:string,agent:boolean,quantity:number){
 const menu=[family+' Normal','Combo '+family].map((name,i)=>({id:41201+i,code:1+i,name,price:20000+5000*i,availableNow:true,hasAttributes:i>0,attributes:i?[{attributeName:'Bebida',options:['Limonada','Ginger','Manzana']}]:[]}));
 const h=harness(menu,agent);h.cfg.ignoreBusinessHours=false;
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:412,dailyOrderNumber:412});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 const original={productId:41201,code:1,name:menu[0].name,unitPrice:20000,quantity,note:'Sin cebolla',attributes:[]};
 Object.assign(h.conv.sessionData,{cart:[structuredClone(original)],orderType:'delivery',address:'Calle 1 #2-3',addressConfirmed:true,fulfillmentChosen:true,deliveryFeeCalculated:2000,paymentMethod:'cash',contactPhone:h.conv.phoneE164,phoneConfirmed:true,notesCollected:true,
 pendingAttribute:{productId:41202,code:2,name:menu[1].name,price:25000,quantity,attributes:menu[1].attributes,selected:[],sourceText:'cambia a '+menu[1].name,replacement:{originalLine:structuredClone(original)}}});h.conv.state='awaiting_attribute';
 return {h,menu,original};
}
for(const family of ['Pollo','Hamburguesa'])for(const agent of [false,true])for(const quantity of [1,2]){
 for(const separator of ['; ','\n',', '])for(const [index,data] of [...fields,fields.join(separator)].entries())it(`replacement/contact ${family}/${agent}/${quantity}/${JSON.stringify(separator)}/${index}`,async()=>{
  const {h}=setup(family,agent,quantity);const reply=await h.sendQueued('Ginger'+separator+data);
  expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:41202,quantity,unitPrice:25000,note:expect.stringMatching(/sin cebolla/i),attributes:[{attributeName:'Bebida',attributeValue:'Ginger'}]})]);
  expect(h.conv.sessionData.pendingAttribute).toBeUndefined();expect(reply).toContain('Ginger');expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(index===0||index===4)expect(h.conv.customerName).toBe('Camila Rojas');if(index===1||index===4)expect(h.conv.sessionData.contactPhone).toMatch(/3000000002$/);if(index===2||index===4)expect(h.conv.sessionData.address).toMatch(/81b/i);if(index===3||index===4)expect(h.conv.sessionData.paymentMethod).toBe('transfer');
  if(index===4){await h.sendQueued('no más');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toHaveLength(quantity);expect(dto.items.every(item=>item.productId===41202)).toBe(true);expect(dto.address).toMatch(/81b/i);}
 });
 for(const text of ['Ginger; A nombre de Camila Rojas; Pago por Nequi si me descuentas','¿Ginger?; '+fields.join('; '),'Ginger; La dirección es Calle 6B','-1; '+fields.join('; '),'Ginger; A nombre de Camila Rojas; A nombre de Otra Persona'])it(`invalid replacement/contact ${family}/${agent}/${quantity}/${text}`,async()=>{
  const {h}=setup(family,agent,quantity);const before=structuredClone(h.conv.sessionData);await h.sendQueued(text);expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBe('Wilmer');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
}

for(const family of ['Pollo','Hamburguesa'])for(const agent of [false,true])for(const quantity of [1,2]){
 for(const invalid of [false,true])it(`replacement contact burst ${family}/${agent}/${quantity}/${invalid}`,async()=>{
  const {h}=setup(family,agent,quantity),before=structuredClone(h.conv.sessionData);
  jest.useFakeTimers();try{
   const parts=['2','Por favor',...fields.slice(0,3),invalid?'Pago por Nequi si me descuentas':fields[3]];
   const requests=parts.map((text,i)=>h.service.handleIncoming({waId:'customer',phoneE164:h.conv.phoneE164,messageId:`replacement-contact-412-${i}`,messageType:'text',text,timestamp:Date.now()/1000,raw:{}}));
   await jest.advanceTimersByTimeAsync(4000);await Promise.all(requests);
  }finally{jest.useRealTimers();}
  if(invalid){expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBe('Wilmer');}
  else {expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:41202,quantity,attributes:[{attributeName:'Bebida',attributeValue:'Ginger'}]})]);expect(h.conv.customerName).toBe('Camila Rojas');expect(h.conv.sessionData.paymentMethod).toBe('transfer');}
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 for(const change of ['price','stock','removed','option'])it(`live replacement/contact ${family}/${agent}/${quantity}/${change}`,async()=>{
  const {h,menu,original}=setup(family,agent,quantity);
  if(change==='price')menu[1].price=27000;else if(change==='stock')menu[1].availableNow=false;else if(change==='removed')menu.pop();else menu[1].attributes=[{attributeName:'Bebida',options:['Limonada','Manzana']}];
  const reply=await h.sendQueued('Ginger; '+fields.join('; '));expect(h.conv.sessionData.cart).toEqual([original]);expect(h.conv.customerName).toBe('Camila Rojas');expect(h.service.ordersService.create).not.toHaveBeenCalled();
  expect(reply).toMatch(change==='price'?/precio.*cambi/i:change==='option'?/ya no.*opciones/i:/no.*disponible|ya no.*carta/i);
  if(change==='price'){await h.sendQueued('Ginger');expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:41202,quantity,unitPrice:27000})]);}
 });
 for(const stale of ['changed','duplicate'])it(`rejects stale replacement target ${family}/${agent}/${quantity}/${stale}`,async()=>{
  const {h,original}=setup(family,agent,quantity);
  if(stale==='changed')h.conv.sessionData.cart[0].note='Sin tomate';else h.conv.sessionData.cart.push(structuredClone(original));
  const cart=structuredClone(h.conv.sessionData.cart);const reply=await h.sendQueued('Ginger; '+fields.join('; '));
  expect(h.conv.sessionData.cart).toEqual(cart);expect(reply).toMatch(/original cambi[oó]|cancela.*cambio/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it(`preserves another cart item during replacement/contact ${family}/${agent}/${quantity}`,async()=>{
  const {h,menu}=setup(family,agent,quantity);const other={productId:41203,code:3,name:'Ensalada Verde',unitPrice:7000,quantity:1,attributes:[]};
  menu.push({id:41203,code:3,name:other.name,price:7000,availableNow:true,hasAttributes:false,attributes:[]});h.conv.sessionData.cart.push(other);
  await h.sendQueued('2; '+fields.join('; '));expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:41202,quantity}),other]);
  await h.sendQueued('no más');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toHaveLength(quantity+1);expect(dto.items.filter(item=>item.productId===41202)).toHaveLength(quantity);expect(dto.items.filter(item=>item.productId===41203)).toHaveLength(1);
 });
}
