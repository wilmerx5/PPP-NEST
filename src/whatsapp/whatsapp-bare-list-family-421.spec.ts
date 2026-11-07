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
for(const family of ['Hamburguesa','Pizza'])for(const agent of [false,true])for(const snapshot of [false,true])for(const inquiry of [false,true])it(`bare family stays ambiguous and recovers ${family}/${agent}/${snapshot}/${inquiry}`,async()=>{
 const {h,menu}=await setup(family,agent);
 if(inquiry)await h.sendQueued('Cuánto cuesta '+menu[1].name);
 if(snapshot)h.conv.sessionData.pendingMatch!.query=family;
 const before=structuredClone(h.conv.sessionData.cart);const reply=await h.sendQueued(family);
 expect(h.conv.sessionData.cart).toEqual(before);expect(reply).toMatch(/opci[oó]n|n[uú]mero|cu[aá]l/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 await h.sendQueued(menu[1].name+'; '+fields.join('; '));expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:41002,quantity:1})]);await h.sendQueued('no más');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.service.ordersService.create.mock.calls[0][0].items).toEqual([expect.objectContaining({productId:41002})]);
});
for(const family of ['Hamburguesa','Pizza']){
 it(`exact name takes priority over a longer variant ${family}`,()=>{
  const menu=[{id:1,code:1,name:family+' Especial Familiar',price:30000,hasAttributes:false,attributes:[]},{id:2,code:2,name:family+' Especial',price:20000,hasAttributes:false,attributes:[]}];
  const h=harness(menu,false);expect(h.service.catalogService.pickFromCandidateList(menu[1].name,menu)?.id).toBe(2);
 });
 it(`unique partial is retained ${family}`,()=>{
  const menu=[{id:1,code:1,name:family+' Especial Familiar',price:30000,hasAttributes:false,attributes:[]},{id:2,code:2,name:family+' Clásica',price:20000,hasAttributes:false,attributes:[]}];
  const h=harness(menu,false);expect(h.service.catalogService.pickFromCandidateList('Especial Familiar',menu)?.id).toBe(1);
 });
 it(`duplicate exact names remain ambiguous ${family}`,()=>{
  const menu=[{id:1,code:1,name:family+' Especial',price:30000,hasAttributes:false,attributes:[]},{id:2,code:2,name:family+' Especial',price:20000,hasAttributes:false,attributes:[]}];
  const h=harness(menu,false);expect(h.service.catalogService.pickFromCandidateList(menu[0].name,menu)).toBeNull();
 });
}
