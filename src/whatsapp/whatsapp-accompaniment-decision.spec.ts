import {harness} from './whatsapp-accuracy.test-support';
const menus=[['Arroz Chino','gaseosa'],['Bowl Vegetal','ensalada'],['Pasta Del Huerto','pan']];
for(const [dish,side] of menus)for(const agent of [false,true])for(const decision of ['prefiero por separado','mejor aparte','por separado por favor','no, solo el plato','cuánto cuesta el combo?','¿y el precio?','cuanto vale?'])it(`${dish}: ${decision} agent=${agent}`,async()=>{
 const menu=[{id:93001,code:93001,name:dish,price:15000,availableNow:true,attributes:[]},
 {id:93002,code:93002,name:`Combo De ${dish}`,description:`Incluye ${side}`,price:22000,availableNow:true,attributes:[]},
 {id:93003,code:93003,name:side,price:4000,availableNow:true,attributes:[]}];
 const h=harness(menu,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
 Object.assign(h.conv.sessionData,{fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:930,dailyOrderNumber:93});
 await h.sendQueued(`Quiero un ${dish} con ${side}`);
 expect(h.conv.sessionData.pendingMatch?.includesRequestedAccompaniment).toBe(true);
 const reply=await h.sendQueued(decision);
 let expected:number[];
 if(decision.includes('?')){
  expect(reply).toContain('22.000');expect(h.conv.sessionData.cart).toHaveLength(0);expect(h.conv.sessionData.pendingMatch?.candidates[0].id).toBe(93002);
  await h.sendQueued('1');expected=[93002];
 }else{
  expect(reply).toContain(dish);expected=decision.includes('solo')?[93001]:[93001,93003];
 }
 expect(h.conv.sessionData.cart.map(item=>item.productId).sort()).toEqual(expected.sort());
 expect(h.conv.sessionData.cart.every(item=>item.quantity===1)).toBe(true);
 expect(h.conv.sessionData.pendingMatch).toBeFalsy();
 await h.sendQueued('no más, recojo en el local');if(h.conv.state==='awaiting_payment')await h.sendQueued('1');await h.sendQueued('confirmar');
 expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
 const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items.map(item=>item.productId).sort()).toEqual(expected.sort());
});
