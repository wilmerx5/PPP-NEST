import {harness,products} from './whatsapp-accuracy.test-support';
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
for(const f of families) for(const agent of [false,true]) for(const state of ['completed','closed'])
for(const interruption of ['por favor','gracias','precio']) {
 it(`extra purchase trailing interruption ${f.name}/${agent}/${state}/${interruption}`,async()=>{
  const h=await confirmed(f,agent,state);
  const originalOrder=structuredClone(h.service.ordersService.create.mock.calls[0][0]);
  await h.sendQueued(`Cambia la dirección a Calle 7b #78c-79; y aparte quiero dos ${f.name}`);
  expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:f.id,quantity:2})]);
  const cart=structuredClone(h.conv.sessionData.cart);
  for(let repeat=0;repeat<2;repeat++){
   await h.sendQueued(interruption==='precio'?`cuanto cuesta ${f.name}`:interruption);
   expect(h.conv.sessionData.cart).toEqual(cart);
   expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  }
  await h.sendQueued('no más, recojo en el local');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(2);
  expect(h.service.ordersService.create.mock.calls[0][0]).toEqual(originalOrder);
  expect(h.service.ordersService.create.mock.calls[1][0].items).toHaveLength(2);
  expect(h.service.conversationService.reopenForNewOrder).toHaveBeenCalledTimes(1);
 });
}
