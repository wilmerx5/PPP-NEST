import {harness} from './whatsapp-accuracy.test-support';
import {WhatsappDeliveryRoutingService} from './whatsapp-delivery-routing.service';
const savedFetch=global.fetch;
afterEach(()=>{global.fetch=savedFetch;jest.restoreAllMocks();});
async function start(agent:boolean,dish='Bowl Andino',quantity=1){
 const h=harness([
 {id:94811,code:81,name:dish,description:'Preparado con verduras del huerto.',categoryName:'Platos',price:18000,availableNow:true,attributes:[]},
 {id:94812,code:82,name:'Wrap Vegetal',categoryName:'Platos',price:15000,availableNow:true,attributes:[]},
 {id:94813,code:83,name:'Jugo Natural',categoryName:'Bebidas',price:6000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mango','Lulo']}]},
 ],agent);
 Object.assign(h.cfg,{deliveryFeeMode:'distance',restaurantLat:4.63,restaurantLng:-74.15,deliveryFeeTiers:[{maxKm:5.5,fee:2000}]});
 Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true});
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:481,dailyOrderNumber:481});
 h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 const routing=new WhatsappDeliveryRoutingService({get:()=> 'test-key'} as never);
 jest.spyOn(routing as any,'directionsDistance').mockResolvedValue({distanceKm:1,durationMinutes:4});
 global.fetch=jest.fn().mockResolvedValue({status:200,json:async()=>({status:'OK',results:[1,2].map(n=>({
 formatted_address:`Conjunto Los Pinos, Calle ${10+n} #80-20, Bogotá, Colombia`,types:['premise'],
 geometry:{location:{lat:4.63+n/1000,lng:-74.14}},address_components:[{short_name:'CO',types:['country']}]
 }))})});
 h.service.deliveryRouting=routing;
 await h.sendQueued(`quiero ${quantity} ${dish} y un Wrap Vegetal`);await h.sendQueued('nada más');
 await h.sendQueued('Conjunto Los Pinos torre 3 apto 402');expect(h.conv.sessionData.pendingDeliveryCandidates).toHaveLength(2);
 return h;
}
for(const agent of [false,true])for(const kind of ['category','composition'])test(`location and ${kind}/${agent}: short reply preserves destination`,async()=>{
 const h=await start(agent);
 if(kind==='composition')await h.sendQueued('cómo viene el Wrap Vegetal');
 const inquiry=await h.sendQueued(kind==='category'?'qué opciones tienen':'y el otro');
 expect(kind==='category'?h.conv.sessionData.pendingCategoryBrowse:h.conv.sessionData.pendingCompositionAsk).toBeDefined();
 const before=structuredClone(h.conv.sessionData),reply=await h.sendQueued('2');
 expect(h.conv.sessionData).toEqual(before);expect(reply).toMatch(/dirección completa/);
 expect(h.service.ordersService.create).not.toHaveBeenCalled();
 await h.sendQueued(kind==='category'?'Bebidas':'Bowl Andino');
 expect(h.conv.sessionData.cart).toEqual(before.cart);
 expect(h.conv.sessionData.pendingDeliveryCandidates).toEqual(before.pendingDeliveryCandidates);
 await h.sendQueued(before.pendingDeliveryCandidates![0].address);
 await h.sendQueued('nada más');await h.sendQueued('en efectivo');await h.sendQueued('confirmar');
 expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
 expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(2);
 expect(h.service.ordersService.create.mock.calls[0][0].address).toContain('Calle 11');

});
for(const dish of ['Bowl Andino','Arroz Con Pollo','Ensalada Campestre'])for(const agent of [false,true])
for(const short of ['1','2','el primero','la primera','el segundo','la segunda'])for(const kind of ['category','composition'])
for(const order of ['menuFirst','addressFirst'])for(const quantity of [1,2]){
 test(`${dish}/${agent}/${short}/${kind}/${order}/${quantity}: named owners recover without choosing a wrong location`,async()=>{
  const h=await start(agent,dish,quantity);
  if(kind==='composition')await h.sendQueued('cómo viene el Wrap Vegetal');
  await h.sendQueued(kind==='category'?'qué opciones tienen':'y el otro');
  expect(kind==='category'?h.conv.sessionData.pendingCategoryBrowse:h.conv.sessionData.pendingCompositionAsk).toBeDefined();
  const before=structuredClone(h.conv.sessionData),calls=(global.fetch as jest.Mock).mock.calls.length;
  const reply=await h.sendQueued(short);
  expect(h.conv.sessionData).toEqual(before);expect(reply).toMatch(/dirección completa/);
  expect((global.fetch as jest.Mock).mock.calls).toHaveLength(calls);
  const index=/2|segund/.test(short)?0:1,target=before.pendingDeliveryCandidates![index];
  const resolveMenu=async()=>{
   const response=await h.sendQueued(kind==='category'?'Bebidas':dish);
   expect(response).toMatch(kind==='category'?/Jugo Natural/:/verduras del huerto/);
   expect(h.conv.sessionData.cart).toEqual(before.cart);
  };
  if(order==='menuFirst'){
   await resolveMenu();expect(h.conv.sessionData.pendingDeliveryCandidates).toEqual(before.pendingDeliveryCandidates);
   await h.sendQueued(target.address);
  }else{
   await h.sendQueued(target.address);expect(h.conv.sessionData.pendingDeliveryCandidates).toBeUndefined();
   await resolveMenu();
  }
  expect(h.conv.sessionData.pendingDeliveryCandidates).toBeUndefined();expect(h.conv.sessionData.cart).toEqual(before.cart);
  expect(h.conv.sessionData.address).toContain(`Calle ${11+index}`);expect(h.conv.sessionData.address).toContain('402');
  expect(h.conv.sessionData.deliveryLat).toBe(target.lat);expect(h.conv.sessionData.deliveryLng).toBe(target.lng);
  expect(h.conv.sessionData.deliveryFeeCalculated).toBe(2000);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('nada más');await h.sendQueued('en efectivo');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toHaveLength(quantity+1);
  expect(dto.items.filter((item:any)=>item.productId===94811)).toHaveLength(quantity);
  expect(dto.address).toContain(`Calle ${11+index}`);expect(dto.address).toContain('402');
 });
}
for(const agent of [false,true])for(const payment of ['1','2'])test(`payment number after address keeps category informational ${agent}/${payment}`,async()=>{
 const h=await start(agent);await h.sendQueued('qué opciones tienen');
 const prior=structuredClone(h.conv.sessionData);await h.sendQueued(prior.pendingDeliveryCandidates![0].address);
 expect(h.conv.state).toBe('awaiting_payment');
 await h.sendQueued(payment);expect(h.conv.sessionData.cart).toEqual(prior.cart);
 expect(h.conv.sessionData.paymentMethod).toBe(payment==='1'?'cash':'transfer');
 expect(h.service.ordersService.create).not.toHaveBeenCalled();await h.sendQueued('confirmar');
 expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(2);
});
