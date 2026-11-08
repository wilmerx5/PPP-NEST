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
const invalidForms=[
 ['A nombre de Camila Rojas','A nombre de Ana Perez'],
 ['Mi celular es 3000000002','Mi celular es 3000000003'],
 ['La dirección es Calle 6B #81B-51','La dirección es Calle 7 #2-3'],
 ['Pago por Nequi','Pago en efectivo'],
 ['A nombre de Camila Rojas','La dirección es Calle 6B'],
 ['A nombre de Camila Rojas','Mi celular es 123'],
];
for(const family of ['Hamburguesa','Pizza'])for(const agent of [false,true]){
 for(const choice of ['#1','código 2'])for(const [index,form] of invalidForms.entries())it(`invalid contact after explicit code stays atomic and recovers ${family}/${agent}/${choice}/${index}`,async()=>{
  const {h}=await populated(family,agent),before=structuredClone(h.conv.sessionData);const reply=await h.sendQueued(choice+'; '+form.join('; '));expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBe('Wilmer');expect(reply).toMatch(/No cambié/);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('#2; '+fields.join('; '));expect(h.conv.sessionData.cart).toEqual([...before.cart,expect.objectContaining({productId:41001,quantity:1})]);expect(h.conv.customerName).toBe('Camila Rojas');const cart=structuredClone(h.conv.sessionData.cart);await h.sendQueued('Por favor');expect(h.conv.sessionData.cart).toEqual(cart);await h.sendQueued('no más');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.service.ordersService.create.mock.calls[0][0].items.map(item=>item.productId)).toEqual([41009,41009,41001]);
 });
 for(const [index,form] of [invalidForms[0],invalidForms[3],invalidForms[4],invalidForms[5]].entries())it(`invalid contact burst after code stays atomic ${family}/${agent}/${index}`,async()=>{
  const {h}=await populated(family,agent),before=structuredClone(h.conv.sessionData);jest.useFakeTimers();try{const requests=['#1',...form].map((text,i)=>h.service.handleIncoming({waId:'customer',phoneE164:h.conv.phoneE164,messageId:`invalid-code-427-${i}`,messageType:'text',text,timestamp:Date.now()/1000,raw:{}}));await jest.advanceTimersByTimeAsync(4000);await Promise.all(requests);}finally{jest.useRealTimers();}expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBe('Wilmer');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
}
