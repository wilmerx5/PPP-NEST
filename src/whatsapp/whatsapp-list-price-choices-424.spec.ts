import {harness} from './whatsapp-accuracy.test-support';
const fields=['A nombre de Camila Rojas','Mi celular es 3000000002','La dirección es Calle 6B #81B-51 Torre 3 apto 510','Pago por Nequi'];
async function setup(family:string,agent:boolean){
 const menu=[{id:41001,code:31,name:family+' Clásica',categoryName:family+'s',price:20000,availableNow:true,hasAttributes:false,attributes:[]},
 {id:41002,code:42,name:family+' Especial',categoryName:family+'s',price:25000,availableNow:true,hasAttributes:false,attributes:[]}];
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
for(const family of ['Hamburguesa','Pizza'])for(const agent of [false,true])for(const quantity of [1,2])for(const [choice,index] of [['1',0],['2',1],['el primero',0],['la segunda',1],['31',0],['42',1]] as const)it(`price interruption then row ordinal or code preserves existing cart ${family}/${agent}/${quantity}/${choice}`,async()=>{
 const {h,menu}=await setup(family,agent);const existing={productId:41009,code:90,name:'Porción Del Huerto',unitPrice:7000,quantity,attributes:[],note:'Sin sal'};h.conv.sessionData.cart=[existing];const before=structuredClone(h.conv.sessionData.cart);
 const price=await h.sendQueued('Cuánto cuesta '+menu[1-index].name);expect(price).toContain(menu[1-index].name);expect(price).toMatch(index===0?/25[.,]000/:/20[.,]000/);expect(h.conv.sessionData.cart).toEqual(before);
 const clarification=await h.sendQueued(family);expect(h.conv.sessionData.cart).toEqual(before);expect(clarification).toMatch(/opci[oó]n|n[uú]mero|cu[aá]l/i);
 await h.sendQueued(choice+'; '+fields.join('; '));expect(h.conv.sessionData.cart).toEqual([...before,expect.objectContaining({productId:menu[index].id,quantity:1})]);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 const cart=structuredClone(h.conv.sessionData.cart);await h.sendQueued('Por favor');expect(h.conv.sessionData.cart).toEqual(cart);
 await h.sendQueued('no más');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items.filter(item=>item.productId===41009)).toHaveLength(quantity);expect(dto.items.filter(item=>item.productId===menu[index].id)).toHaveLength(1);expect(dto.items).toHaveLength(quantity+1);expect(dto.customerName).toBe('Camila Rojas');expect(dto.phone).toMatch(/3000000002$/);expect(dto.address).toMatch(/81b/i);
});
