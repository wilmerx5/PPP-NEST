import {harness} from './whatsapp-accuracy.test-support';
const fields=['A nombre de Camila Rojas','Mi celular es 3000000002','La dirección es Calle 6B #81B-51 Torre 3 apto 510','Pago por Nequi'];
async function setup(family:string,agent:boolean){
 const menu=[{id:41001,code:2,name:family+' Clásica',categoryName:family+'s',price:20000,availableNow:true,hasAttributes:false,attributes:[]},
 {id:41002,code:1,name:family+' Especial',categoryName:family+'s',price:25000,availableNow:true,hasAttributes:false,attributes:[]}];
 menu.push({id:41009,code:90,name:'Porción Del Huerto',categoryName:'Acompañamientos',price:7000,availableNow:true,hasAttributes:false,attributes:[]});
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
const codes=[['#1',1],['#2',0],['el #1',1],['la #2',0],['código 1',1],['código 2',0]] as const;
async function populated(family:string,agent:boolean){const f=await setup(family,agent);f.h.conv.sessionData.cart=[{productId:41009,code:90,name:'Porción Del Huerto',unitPrice:7000,quantity:2,attributes:[],note:'Sin sal'}];return f;}
for(const family of ['Hamburguesa','Pizza'])for(const agent of [false,true]){
 for(const [choice,index] of codes)for(const separator of ['; ','\n',', '])it(`explicit code and contact are one decision ${family}/${agent}/${choice}/${JSON.stringify(separator)}`,async()=>{
  const {h,menu}=await populated(family,agent),before=structuredClone(h.conv.sessionData.cart);const reply=await h.sendQueued(choice+separator+fields.join(separator));expect(h.conv.sessionData.cart).toEqual([...before,expect.objectContaining({productId:menu[index].id,quantity:1})]);expect(reply).toContain(menu[index].name);expect(h.conv.customerName).toBe('Camila Rojas');expect(h.conv.sessionData.paymentMethod).toBe('transfer');expect(h.service.ordersService.create).not.toHaveBeenCalled();
  const cart=structuredClone(h.conv.sessionData.cart);await h.sendQueued('Por favor');expect(h.conv.sessionData.cart).toEqual(cart);await h.sendQueued('no más');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items.map(item=>item.productId)).toEqual([41009,41009,menu[index].id]);expect(dto.customerName).toBe('Camila Rojas');expect(dto.phone).toMatch(/3000000002$/);expect(dto.address).toMatch(/81b/i);
 });
 for(const choice of ['#999','código 999','"#1"','¿#1?','#-1','+1','##1','#1 y otro plato'])it(`unknown or decorated code form is atomic ${family}/${agent}/${choice}`,async()=>{
  const {h}=await populated(family,agent),before=structuredClone(h.conv.sessionData);await h.sendQueued(choice+'; '+fields.join('; '));expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBe('Wilmer');expect(h.service.ordersService.create).not.toHaveBeenCalled();await h.sendQueued('#1; '+fields.join('; '));expect(h.conv.sessionData.cart).toEqual([...before.cart,expect.objectContaining({productId:41002,quantity:1})]);
 });
 for(const [choice] of codes)it(`conditional explicit code form is atomic ${family}/${agent}/${choice}`,async()=>{
  const {h}=await populated(family,agent),before=structuredClone(h.conv.sessionData);await h.sendQueued(choice+'; '+fields.slice(0,3).join('; ')+'; Pago por Nequi si me descuentas');expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBe('Wilmer');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 for(const [choice,index] of codes)for(const invalid of [false,true])it(`real explicit code contact burst ${family}/${agent}/${choice}/${invalid}`,async()=>{
  const {h,menu}=await populated(family,agent),before=structuredClone(h.conv.sessionData);jest.useFakeTimers();try{const texts=[choice,...fields.slice(0,3),invalid?'Pago por Nequi si me descuentas':fields[3]];const requests=texts.map((text,i)=>h.service.handleIncoming({waId:'customer',phoneE164:h.conv.phoneE164,messageId:`code-form-426-${i}`,messageType:'text',text,timestamp:Date.now()/1000,raw:{}}));await jest.advanceTimersByTimeAsync(4000);await Promise.all(requests);}finally{jest.useRealTimers();}
  if(invalid){expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBe('Wilmer');}else{expect(h.conv.sessionData.cart).toEqual([...before.cart,expect.objectContaining({productId:menu[index].id,quantity:1})]);expect(h.conv.customerName).toBe('Camila Rojas');expect(h.conv.sessionData.paymentMethod).toBe('transfer');}expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
}
