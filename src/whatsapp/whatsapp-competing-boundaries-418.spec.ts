import {harness} from './whatsapp-accuracy.test-support';
const fields=['A nombre de Camila Rojas','Mi celular es 3000000002','La dirección es Calle 6B #81B-51 Torre 3 apto 510','Pago por Nequi'];
async function setup(name:string,agent:boolean){
 const options=name==='Jugo Natural'?['Mango','Lulo']:['Guanabana','Fresa'];
 const menu=[{id:41801,code:1,name:options[0],price:19000,availableNow:true,hasAttributes:false,attributes:[]},
 {id:41802,code:2,name:'Pasta Del Huerto',price:27000,availableNow:true,hasAttributes:false,attributes:[]},
 {id:41803,code:3,name,price:6000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options}]}];
 const h=harness(menu,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);h.service.ordersService.create=jest.fn().mockResolvedValue({id:418,dailyOrderNumber:418});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 Object.assign(h.conv.sessionData,{cart:menu.slice(0,2).map(product=>({productId:product.id,code:product.code,name:product.name,unitPrice:product.price,quantity:1,attributes:[],note:'Sin sal'})),orderType:'delivery',fulfillmentChosen:true,address:'Calle 1 #2-3',addressConfirmed:true,deliveryFeeCalculated:2000,paymentMethod:'cash',contactPhone:h.conv.phoneE164,phoneConfirmed:true,notesCollected:true});
 await h.sendQueued('Quiero un '+name);expect(h.conv.sessionData.pendingAttribute?.productId).toBe(41803);
 await h.sendQueued('Que precio tiene');expect(h.conv.sessionData.pendingPriceInquiry).toBeDefined();expect(h.conv.sessionData.pendingAttribute).toBeDefined();return{h,options,menu};
}

for(const name of ['Jugo Natural','Batido Natural'])for(const agent of [false,true]){
 for(const tail of [
  'A nombre de Camila Rojas; A nombre de Ana Perez',
  'Mi celular es 3000000002; Mi celular es 3000000003',
  'Pago por Nequi; Pago en efectivo',
  'La dirección es Calle 6B #81B-51; La dirección es Calle 7 #2-3',
  'La dirección es Calle 6B',
  'A nombre de Camila Rojas; Pago por Nequi si me descuentas',
  'Mi celular es 123',
  'A nombre de Camila Rojas; además agrega otro plato',
 ])it(`invalid competing form stays atomic ${name}/${agent}/${tail}`,async()=>{
  const {h,options}=await setup(name,agent),before=structuredClone(h.conv.sessionData);
  await h.sendQueued('Sabor: '+options[0]+'; '+tail);
  expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBe('Wilmer');expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('Sabor: '+options[1]+'; '+fields.join('; '));
  expect(h.conv.sessionData.cart).toHaveLength(3);expect(h.conv.sessionData.cart[2]).toEqual(expect.objectContaining({productId:41803,quantity:1,attributes:[{attributeName:'Sabor',attributeValue:options[1]}]}));expect(h.conv.sessionData.pendingPriceInquiry).toBeUndefined();
 });
 for(const tail of ['Pago por Nequi si me descuentas','La dirección es Calle 6B'])it(`invalid competing burst preserves both questions ${name}/${agent}/${tail}`,async()=>{
  const {h,options}=await setup(name,agent),before=structuredClone(h.conv.sessionData);jest.useFakeTimers();
  try{const requests=['Sabor: '+options[0],'A nombre de Camila Rojas',tail].map((text,i)=>h.service.handleIncoming({waId:'customer',phoneE164:h.conv.phoneE164,messageId:`competing-418-${i}`,messageType:'text',text,timestamp:Date.now()/1000,raw:{}}));await jest.advanceTimersByTimeAsync(4000);await Promise.all(requests);}finally{jest.useRealTimers();}
  expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBe('Wilmer');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it(`price interruption resumes selected dish and closes once ${name}/${agent}`,async()=>{
  const {h,options}=await setup(name,agent),cart=structuredClone(h.conv.sessionData.cart);
  const price=await h.sendQueued('precio 2');expect(price).toMatch(/27[.,]000/);expect(h.conv.sessionData.cart).toEqual(cart);expect(h.conv.sessionData.pendingAttribute).toBeDefined();
  await h.sendQueued('Sabor: '+options[0]+'; '+fields.join('; '));await h.sendQueued('no más');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.service.ordersService.create.mock.calls[0][0].items.map(item=>item.productId)).toEqual([41801,41802,41803]);
 });
}
