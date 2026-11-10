import {harness} from './whatsapp-accuracy.test-support';
import {WhatsappDeliveryRoutingService} from './whatsapp-delivery-routing.service';
const originalFetch=global.fetch;
afterEach(()=>{global.fetch=originalFetch;jest.restoreAllMocks();});
async function start(dish='Bowl Andino',agent=false,sameStreet=false,count=3){
 const h=harness([{id:94750,code:81,name:dish,price:18000,availableNow:true,attributes:[]}],agent);
 Object.assign(h.cfg,{deliveryFeeMode:'distance',restaurantLat:4.63,restaurantLng:-74.15,deliveryFeeTiers:[{maxKm:5.5,fee:2000}]});
 Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true});
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cómo prefieres pagar?',actions:{}});
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:475,dailyOrderNumber:475});
 h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 const routing=new WhatsappDeliveryRoutingService({get:()=> 'test-key'} as never);
 jest.spyOn(routing as any,'directionsDistance').mockResolvedValue({distanceKm:1,durationMinutes:4});
 global.fetch=jest.fn().mockResolvedValue({status:200,json:async()=>({status:'OK',results:[1,2,3].slice(0,count).map(n=>({
  formatted_address:`Conjunto Los Pinos, Calle ${sameStreet?11:10+n} #80-${sameStreet?n*10:20}, Bogotá, Colombia`,types:['premise'],
  geometry:{location:{lat:4.63+n/1000,lng:-74.14}},address_components:[{short_name:'CO',types:['country']}]
 }))})});
 h.service.deliveryRouting=routing;
 await h.sendQueued(`quiero dos ${dish}`);await h.sendQueued('nada más');
 await h.sendQueued('Conjunto Los Pinos torre 3 apto 402');
 expect(h.conv.sessionData.pendingDeliveryCandidates).toHaveLength(count);
 return h;
}
for(const agent of [false,true])for(const [answer,street] of [['la primera',11],['la segunda',12]] as const){
 test(`natural location baseline ${answer}/agent=${agent}`,async()=>{
  const h=await start('Bowl Andino',agent);const cart=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued(answer);
  expect(h.conv.sessionData.pendingDeliveryCandidates).toBeUndefined();
  expect(h.conv.sessionData.address).toContain(`Calle ${street}`);
  expect(h.conv.sessionData.address).toContain('402');expect(h.conv.sessionData.cart).toEqual(cart);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('en efectivo');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  expect(h.service.ordersService.create.mock.calls[0][0].address).toContain(`Calle ${street}`);
 });
}

const answers:Array<[string,number]>=[
 ['la primera',11],['el primero',11],['la primera porfa',11],['primera opción',11],['opción uno',11],
 ['la segunda',12],['el segundo lugar',12],['la opción segunda',12],['dos',12],['la segunda por favor',12],
 ['la tercera',13],['tercer lugar',13],['opción tres',13],['la tercera gracias',13],
 ['la de la calle 12',12],['la de la cl 12',12],['la de la calle12',12],['la dirección de la calle 13 #80-20',13]
];
for(const dish of ['Arroz Con Pollo','Bowl Andino','Ensalada Campestre'])for(const agent of [false,true])
for(const [answer,street] of answers)for(const interruption of ['none','payment','confirm']) {
 test(`${dish}/${agent}/${answer}/${interruption}: natural location choice closes the same cart`,async()=>{
  const h=await start(dish,agent);const cart=structuredClone(h.conv.sessionData.cart);
  if(interruption==='payment') await h.sendQueued('por nequi');
  if(interruption==='confirm') {await h.sendQueued('confirmar');expect(h.service.ordersService.create).not.toHaveBeenCalled();}
  const reply=await h.sendQueued(answer);
  expect(h.conv.sessionData.pendingDeliveryCandidates).toBeUndefined();
  expect(h.conv.sessionData.address).toContain(`Calle ${street}`);
  expect(h.conv.sessionData.address).toContain('402');expect(h.conv.sessionData.cart).toEqual(cart);
  expect(reply).toMatch(/pag|confirmar/i);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(h.conv.state!=='awaiting_final_confirm')await h.sendQueued('en efectivo');
  await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];
  expect(dto.address).toContain(`Calle ${street}`);expect(dto.address).toContain('402');
  expect(dto.items).toHaveLength(2);expect(dto.items.every((item:any)=>item.productId===94750)).toBe(true);
 });
}
for(const agent of [false,true])for(const answer of ['¿la segunda?','2?','la primera o la segunda','la primera y la tercera','la de la calle 99','la de la calle 11']) {
 test(`non-unique or questioning ${answer}/${agent}: keep candidates and cart`,async()=>{
  const h=await start('Bowl Andino',agent,answer==='la de la calle 11');
  const session=structuredClone(h.conv.sessionData);const reply=await h.sendQueued(answer);
  expect(h.conv.sessionData.cart).toEqual(session.cart);
  expect(h.conv.sessionData.pendingDeliveryCandidates).toEqual(session.pendingDeliveryCandidates);
  expect(h.conv.sessionData.address).toBe(session.address);
  expect(reply).toMatch(/Cuál es tu dirección/);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
}
for(const agent of [false,true])for(const pending of ['pendingMatch','pendingAttribute','pendingAddOffer']) {
 test(`ordinal with competing ${pending}/${agent}: explicit address required`,async()=>{
  const h=await start('Bowl Andino',agent);
  // Defensive competing-selector state; normal location journey above is router-derived.
  (h.conv.sessionData as any)[pending]={productId:999,name:'Otra selección',candidates:[],attributes:[]};
  const snapshot=structuredClone(h.conv.sessionData);
  const reply=await h.sendQueued('la segunda');
  expect(reply).toMatch(/dirección completa/);
  expect(h.conv.sessionData).toEqual(snapshot);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
}
for(const agent of [false,true])for(const answer of ['la tercera','opción tres']) {
 test(`unavailable ordinal ${answer}/${agent}: no nonexistent candidate`,async()=>{
  const h=await start('Bowl Andino',agent,false,2);const snapshot=structuredClone(h.conv.sessionData);
  const reply=await h.sendQueued(answer);
  expect(reply).toMatch(/Cuál es tu dirección/);expect(h.conv.sessionData).toEqual(snapshot);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
}
