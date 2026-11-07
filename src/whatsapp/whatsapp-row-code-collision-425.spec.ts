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
for(const family of ['Hamburguesa','Pizza'])for(const agent of [false,true])for(const quantity of [1,2])for(const [choice,index] of [['1',0],['2',1],['el primero',0],['la segunda',1],['#1',1],['#2',0],['el #1',1],['el #2',0],['código 1',1],['código 2',0]] as const)it(`colliding row and code retain explicit meaning ${family}/${agent}/${quantity}/${choice}`,async()=>{
 const {h,menu}=await setup(family,agent);const existing={productId:41009,code:90,name:'Porción Del Huerto',unitPrice:7000,quantity,attributes:[],note:'Sin sal'};h.conv.sessionData.cart=[existing];const before=structuredClone(h.conv.sessionData.cart);
 const explicitCode=/#|código/.test(choice);const reply=await h.sendQueued(choice+(explicitCode?'':'; '+fields.join('; ')));
 expect(h.conv.sessionData.cart).toEqual([...before,expect.objectContaining({productId:menu[index].id,quantity:1})]);expect(reply).toContain(menu[index].name);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 const cart=structuredClone(h.conv.sessionData.cart);await h.sendQueued('Por favor');expect(h.conv.sessionData.cart).toEqual(cart);
 await h.sendQueued('no más');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items.filter(item=>item.productId===41009)).toHaveLength(quantity);expect(dto.items.filter(item=>item.productId===menu[index].id)).toHaveLength(1);expect(dto.items).toHaveLength(quantity+1);if(!explicitCode)expect(dto.customerName).toBe('Camila Rojas');
});
