import {harness} from './whatsapp-accuracy.test-support';
const fields=['A nombre de Camila Rojas','Mi celular es 3000000002','La dirección es Calle 6B #81B-51 Torre 3 apto 510','Pago por Nequi'];
async function setup(family:string,agent:boolean){
 const menu=[{id:41001,code:31,name:family+' Clásica',categoryName:family+'s',price:20000,availableNow:true,hasAttributes:false,attributes:[]},
 {id:41002,code:42,name:family+' Especial',categoryName:family+'s',price:25000,availableNow:true,hasAttributes:false,attributes:[]}];
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
for(const family of ['Hamburguesa','Pizza'])for(const agent of [false,true])for(const index of [0,1])for(const kind of ['price','description'])it(`inquiry interrupts product list without purchasing ${family}/${agent}/${index}/${kind}`,async()=>{
 const {h,menu}=await setup(family,agent);const product=menu[index];
 const question=kind==='price'?'Cuánto cuesta '+product.name:'Cómo viene '+product.name;
 const reply=await h.sendQueued(question);expect(h.conv.sessionData.cart).toEqual([]);expect(h.service.ordersService.create).not.toHaveBeenCalled();expect(reply).toContain(product.name);if(kind==='price')expect(reply).toMatch(index===0?/20[.,]000/:/25[.,]000/);
 await h.sendQueued('Quiero una '+family.toLowerCase());expect(h.conv.sessionData.cart).toEqual([]);await h.sendQueued(product.name+'; '+fields.join('; '));
 expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:product.id,quantity:1})]);await h.sendQueued('no más');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.service.ordersService.create.mock.calls[0][0].items).toEqual([expect.objectContaining({productId:product.id})]);
});
