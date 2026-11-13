import {harness} from './whatsapp-accuracy.test-support';
for(const name of ['Helado Artesanal','Paleta Frutal','Sorbete Natural']) for(const agent of [false,true])
for(const finalState of ['completed','closed']) for(const idMode of ['distinct','same'])
for(const messages of [['confirmar','confirmar'],['confirmar','por favor'],['confirmar','confirmar','confirmar']]) {
 test(`${name}/${agent}/${finalState}/${idMode}/${messages.join('/')}: inbound confirmation burst after counted correction`,async()=>{
  const h=setup(name,agent);
  await h.sendQueued('quiero una Sopa Vegetal');await h.sendQueued(`quiero cuatro ${name}`);
  await h.sendQueued('dos con mango en vaso');await h.sendQueued('quita uno de los de mango');
  await h.sendQueued('los otros con lulo en botella');
  await h.sendQueued('no más, recojo en el local');await h.sendQueued('efectivo');
  expect(h.conv.state).toBe('awaiting_final_confirm');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  jest.useFakeTimers();
  try{
   const requests=messages.map((text,index)=>h.service.handleIncoming({waId:'customer',phoneE164:h.conv.phoneE164,
    messageId:`confirmation-510-${idMode==='same'?0:index}`,messageType:'text',text,timestamp:Date.now()/1000,raw:{}}));
   await jest.advanceTimersByTimeAsync(4000);await Promise.all(requests);
  }finally{jest.useRealTimers();}
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  expect(h.conv.state).toBe('completed');
  h.conv.state=finalState;
  const completedSession=structuredClone(h.conv.sessionData);
  await h.sendQueued('confirmar');
  expect(h.conv.state).toBe(finalState);
  expect(h.conv.sessionData).toEqual(completedSession);
  expect(h.service.conversationService.reopenForNewOrder).not.toHaveBeenCalled();
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items=h.service.ordersService.create.mock.calls[0][0].items;
  expect(items).toHaveLength(4);
  expect(items.filter((item:any)=>item.productId===95071&&item.attributes.some((a:any)=>a.attributeValue==='Mango'))).toHaveLength(1);
  expect(items.filter((item:any)=>item.productId===95071&&item.attributes.some((a:any)=>a.attributeValue==='Lulo'))).toHaveLength(2);
 });
}
function setup(name:string,agent:boolean){
 const h=harness([
  {id:95071,code:81,name,price:9000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mango','Lulo']},{attributeName:'Presentación',options:['Vaso','Botella']}]},
  {id:95072,code:82,name:'Sopa Vegetal',price:10000,availableNow:true,attributes:[]}
 ],agent);
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:507,dailyOrderNumber:507});
 h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 h.service.conversationService.reopenForNewOrder=jest.fn(async()=>{
  await h.service.conversationService.resetOrderSession(h.conv,'building_cart',{ignorePriorHistory:true});
  return h.conv;
 });
 return h;
}
