import {harness} from './whatsapp-accuracy.test-support';
const fields=['A nombre de Camila Rojas','Mi celular es 3000000002','La dirección es Calle 6B #81B-51 Torre 3 apto 510','Pago por Nequi'];
async function setup(name:string,agent:boolean){
 const options=name==='Jugo Natural'?['Mango','Lulo']:['Guanabana','Fresa'];
 const menu=[{id:41701,code:1,name:options[0],price:19000,availableNow:true,hasAttributes:false,attributes:[]},
 {id:41702,code:2,name:'Pasta Del Huerto',price:27000,availableNow:true,hasAttributes:false,attributes:[]},
 {id:41703,code:3,name,price:6000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options}]}];
 const h=harness(menu,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);h.service.ordersService.create=jest.fn().mockResolvedValue({id:417,dailyOrderNumber:417});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 Object.assign(h.conv.sessionData,{cart:menu.slice(0,2).map(product=>({productId:product.id,code:product.code,name:product.name,unitPrice:product.price,quantity:1,attributes:[],note:'Sin sal'})),orderType:'delivery',fulfillmentChosen:true,address:'Calle 1 #2-3',addressConfirmed:true,deliveryFeeCalculated:2000,paymentMethod:'cash',contactPhone:h.conv.phoneE164,phoneConfirmed:true,notesCollected:true});
 await h.sendQueued('Quiero un '+name);expect(h.conv.sessionData.pendingAttribute?.productId).toBe(41703);
 await h.sendQueued('Que precio tiene');expect(h.conv.sessionData.pendingPriceInquiry).toBeDefined();expect(h.conv.sessionData.pendingAttribute).toBeDefined();return{h,options,menu};
}
for(const name of ['Jugo Natural','Batido Natural'])for(const agent of [false,true]){
 for(const sep of ['; ','\n',', '])for(const answer of ['1','2','sí','no'])it(`ambiguous contact choice ${name}/${agent}/${JSON.stringify(sep)}/${answer}`,async()=>{
  const {h}=await setup(name,agent),before=structuredClone(h.conv.sessionData);const reply=await h.sendQueued(answer+sep+fields.join(sep));expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBe('Wilmer');expect(reply).toMatch(/precio/i);expect(reply).toMatch(/sabor|opci[oó]n/i);expect(((reply || '').match(/¿/g)||[]).length).toBe(1);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 for(const sep of ['; ','\n',', '])for(const index of [0,1])it(`qualified attribute contact ownership ${name}/${agent}/${JSON.stringify(sep)}/${index}`,async()=>{
  const {h,options}=await setup(name,agent);const cart=structuredClone(h.conv.sessionData.cart);await h.sendQueued('2'+sep+fields.join(sep));expect(h.conv.sessionData.cart).toEqual(cart);
  const reply=await h.sendQueued('Sabor: '+options[index]+sep+fields.join(sep));expect(h.conv.sessionData.cart).toEqual([...cart,expect.objectContaining({productId:41703,quantity:1,attributes:[{attributeName:'Sabor',attributeValue:options[index]}]})]);expect(h.conv.sessionData.pendingAttribute).toBeUndefined();expect(h.conv.sessionData.pendingPriceInquiry).toBeUndefined();expect(h.conv.customerName).toBe('Camila Rojas');expect(h.conv.sessionData.paymentMethod).toBe('transfer');expect(reply).toContain(options[index]);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('no más');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items.map(item=>item.productId)).toEqual([41701,41702,41703]);expect(dto.address).toMatch(/81b/i);
 });
}
for(const agent of [false,true]){
 for(const invalid of ['Sabor: Inexistente; '+fields.join('; '),'Sabor: Mango; '+fields.slice(0,3).join('; ')+'; Pago por Nequi si me descuentas','Sabor: Mango; La dirección es Calle 6B'])it(`invalid explicit form preserves both decisions ${agent}/${invalid}`,async()=>{
  const {h}=await setup('Jugo Natural',agent),before=structuredClone(h.conv.sessionData);await h.sendQueued(invalid);expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBe('Wilmer');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 for(const choice of ['2','sí','no','Sabor: Mango'])it(`real coalesced contact burst ${agent}/${choice}`,async()=>{
  const {h}=await setup('Jugo Natural',agent),before=structuredClone(h.conv.sessionData);jest.useFakeTimers();
  try{const requests=[choice,...fields].map((text,i)=>h.service.handleIncoming({waId:'customer',phoneE164:h.conv.phoneE164,messageId:`competing-417-${i}`,messageType:'text',text,timestamp:Date.now()/1000,raw:{}}));await jest.advanceTimersByTimeAsync(4000);await Promise.all(requests);}finally{jest.useRealTimers();}
  if(choice==='Sabor: Mango'){expect(h.conv.sessionData.cart).toHaveLength(3);expect(h.conv.sessionData.pendingPriceInquiry).toBeUndefined();expect(h.conv.customerName).toBe('Camila Rojas');}
  else{expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBe('Wilmer');}expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it(`explicit price stays separate from contact and attribute ${agent}`,async()=>{
  const {h}=await setup('Jugo Natural',agent),before=structuredClone(h.conv.sessionData);await h.sendQueued('precio 2; '+fields.join('; '));expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBe('Wilmer');const reply=await h.sendQueued('precio 2');expect(reply).toMatch(/27[.,]000/);expect(h.conv.sessionData.pendingAttribute).toBeDefined();expect(h.conv.sessionData.cart).toEqual(before.cart);await h.sendQueued('Sabor: Mango; '+fields.join('; '));expect(h.conv.sessionData.cart).toHaveLength(3);
 });
}
