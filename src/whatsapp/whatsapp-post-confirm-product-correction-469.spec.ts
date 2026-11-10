import {harness,products} from './whatsapp-accuracy.test-support';
for(const agent of [false,true])for(const correction of ['Era un combo de arroz chino con medio pollo','No era arroz chino, era un combo de arroz chino con medio pollo']) {
 it(`registered product correction ${agent}/${correction}`,async()=>{
  const h=harness(products,agent);
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:469,dailyOrderNumber:469});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  h.service.conversationService.reopenForNewOrder=jest.fn(async()=>{
   await h.service.conversationService.resetOrderSession(h.conv,'building_cart',{ignorePriorHistory:true});return h.conv;
  });
  Object.assign(h.conv.sessionData,{orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
  await h.sendQueued('Un Arroz Chino');await h.sendQueued('nada mas');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
  expect(h.conv.state).toBe('completed');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const before=structuredClone(h.conv.sessionData);
  await h.sendQueued(correction);
  expect({state:h.conv.state,session:h.conv.sessionData,reply:h.replies.at(-1)}).toMatchObject({state:'completed',session:before,reply:expect.stringMatching(/ya (?:está|quedó|se encuentra) registrado/i)});
  expect(h.replies.at(-1)).toMatch(/no (?:he |lo he )?modific|sin modificar/i);
  expect(h.service.conversationService.reopenForNewOrder).not.toHaveBeenCalled();expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
 });
}

const families=[{name:'Arroz Chino',menu:products,id:26},...['Bowl Andino','Ensalada Campestre'].map((name,i)=>({name,id:76900+i,menu:[{id:76900+i,code:76900+i,name,price:19000,hasAttributes:false,attributes:[]}]}))];
async function confirmed(f:typeof families[number],agent:boolean,state:string) {
 const h=harness(f.menu,agent);
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:469,dailyOrderNumber:469});
 h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 h.service.conversationService.reopenForNewOrder=jest.fn(async()=>{
  await h.service.conversationService.resetOrderSession(h.conv,'building_cart',{ignorePriorHistory:true});return h.conv;
 });
 Object.assign(h.conv.sessionData,{orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
 await h.sendQueued(`Un ${f.name}`);
 expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:f.id,quantity:1})]);
 await h.sendQueued('nada mas');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
 expect(h.conv.state).toBe('completed');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
 expect(h.service.ordersService.create.mock.calls[0][0].items).toEqual([expect.objectContaining({productId:f.id})]);
 // completed comes from the router; closed is a defensive persisted-state variant.
 h.conv.state=state;
 return h;
}
for(const f of families)for(const agent of [false,true])for(const state of ['completed','closed']) {
 for(const correction of [`Era un ${f.name}`,`No, era un ${f.name}`,`Yo pedí un ${f.name}`,`Había pedido un ${f.name}`,`Quiero cambiar el pedido por un ${f.name}`,`Cámbiame el pedido por un ${f.name}`,`Corrige mi pedido, era un ${f.name}`,`No era un ${f.name}, era un combo`]) {
  it(`catalog correction ${f.name}/${agent}/${state}/${correction}`,async()=>{
   const h=await confirmed(f,agent,state),before=structuredClone(h.conv.sessionData);
   await h.sendQueued(correction);
   expect(h.conv.state).toBe(state);expect(h.conv.sessionData).toEqual(before);
   expect(h.replies.at(-1)).toMatch(/ya está registrado/);expect(h.replies.at(-1)).toContain('No lo he modificado');
   expect(h.replies.at(-1)).not.toMatch(/Listo ✅|Algo más|Escribe el número/);
   await h.sendQueued('por favor');
   expect(h.conv.state).toBe(state);expect(h.conv.sessionData).toEqual(before);
   expect(h.service.conversationService.reopenForNewOrder).not.toHaveBeenCalled();expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  });
 }
 it(`explicit new purchase ${f.name}/${agent}/${state}`,async()=>{
  const h=await confirmed(f,agent,state);await h.sendQueued(`Un ${f.name}`);
  expect(h.service.conversationService.reopenForNewOrder).toHaveBeenCalledTimes(1);
  expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:f.id,quantity:1})]);
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
 });
}
