import {harness} from './whatsapp-accuracy.test-support';
import {WhatsappDeliveryRoutingService} from './whatsapp-delivery-routing.service';
const originalFetch=global.fetch;
afterEach(()=>{global.fetch=originalFetch;jest.restoreAllMocks();});
for(const dish of ['Arroz Con Pollo','Bowl Andino'])for(const agent of [false,true]) {
 test(`${dish}/agent=${agent}: choose between two covered places without selecting the first`,async()=>{
  const h=harness([{id:94743,code:77,name:dish,price:18000,availableNow:true,attributes:[]}],agent);
  Object.assign(h.cfg,{deliveryFeeMode:'distance',restaurantLat:4.63,restaurantLng:-74.15,deliveryFeeTiers:[{maxKm:5.5,fee:2000}]});
  Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true});
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cómo prefieres pagar?',actions:{}});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:474,dailyOrderNumber:474});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  const routing=new WhatsappDeliveryRoutingService({get:()=> 'test-key'} as never);
  jest.spyOn(routing as any,'directionsDistance').mockResolvedValue({distanceKm:1,durationMinutes:4});
  global.fetch=jest.fn().mockResolvedValue({status:200,json:async()=>({status:'OK',results:[1,2].map(n=>({
   formatted_address:`Plazuelas de San Esteban, Calle ${10+n} #80-20, Bogotá, Colombia`,types:['premise'],
   geometry:{location:{lat:4.63+n/1000,lng:-74.14}},address_components:[{short_name:'CO',types:['country']}]
  }))})});
  h.service.deliveryRouting=routing;
  await h.sendQueued(`quiero un ${dish}`);await h.sendQueued('nada más');
  const cart=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued('plazuelas de san esteban');
  expect(reply).toMatch(/2 lugares/);
  expect(reply).toContain('Calle 11');expect(reply).toContain('Calle 12');
  expect(h.conv.sessionData.cart).toEqual(cart);
  await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('2');
  expect(h.conv.sessionData.address).toContain('Calle 12');
  expect(h.conv.sessionData.cart).toEqual(cart);
  await h.sendQueued('en efectivo');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  expect(h.service.ordersService.create.mock.calls[0][0].address).toContain('Calle 12');
 });
}

for(const name of ['Plazuelas de San Esteban','Conjunto Los Pinos','Edificio Las Acacias'])
for(const dish of ['Arroz Con Pollo','Bowl Andino','Ensalada Campestre'])for(const agent of [false,true])
for(const answer of ['1','2','la 2','fullAddress'])for(const interruption of ['none','payment','badNumber']) for(const access of ['', ' torre 3 apto 402']) {
 test(`${name}/${dish}/${agent}/${answer}/${interruption}/unit=${!!access}: covered choices preserve cart and checkout`,async()=>{
  const h=harness([{id:94744,code:78,name:dish,price:18000,availableNow:true,attributes:[]}],agent);
  Object.assign(h.cfg,{deliveryFeeMode:'distance',restaurantLat:4.63,restaurantLng:-74.15,deliveryFeeTiers:[{maxKm:5.5,fee:2000}]});
  Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true});
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cómo prefieres pagar?',actions:{}});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:474,dailyOrderNumber:474});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  const routing=new WhatsappDeliveryRoutingService({get:()=> 'test-key'} as never);
  const route=jest.spyOn(routing as any,'directionsDistance').mockImplementation(async(_origin:any,destination:any)=>({distanceKm:destination.lat>4.635?8:1,durationMinutes:4}));
  const places=[{n:1,lat:4.631},{n:2,lat:4.632},{n:9,lat:4.639},{n:99,lat:40.4}];
  global.fetch=jest.fn().mockResolvedValue({status:200,json:async()=>({status:'OK',results:[...places,places[0]].map(({n,lat})=>({
   formatted_address:`${name}, Calle ${10+n} #80-20, ${n===99?'Madrid, España':'Bogotá, Colombia'}`,types:['premise'],
   geometry:{location:{lat,lng:n===99?-3.7:-74.14}},address_components:[{short_name:n===99?'ES':'CO',types:['country']}]
  }))})});
  h.service.deliveryRouting=routing;
  await h.sendQueued(`quiero dos ${dish}`);await h.sendQueued('nada más');
  const cart=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued(name+access);
  expect(reply).toMatch(/2 lugares/);expect(reply).toContain('Calle 11');expect(reply).toContain('Calle 12');
  expect(reply).not.toMatch(/Calle 19|Madrid|Calle 109/);
  expect(h.conv.sessionData.pendingDeliveryCandidates).toHaveLength(2);
  expect(route).toHaveBeenCalledTimes(3); // two covered + one excluded by actual route; foreign result never routed
  if(interruption==='payment') await h.sendQueued('por nequi');
  if(interruption==='badNumber') {await h.sendQueued('9');expect(h.conv.sessionData.pendingDeliveryCandidates).toHaveLength(2);}
  await h.sendQueued('confirmar');expect(h.service.ordersService.create).not.toHaveBeenCalled();
  expect(h.conv.sessionData.cart).toEqual(cart);
  const selected=answer==='1'?11:12;
  await h.sendQueued(answer==='fullAddress'?`${name}, Calle 12 #80-20, Bogotá, Colombia`:answer);
  expect(h.conv.sessionData.pendingDeliveryCandidates).toBeUndefined();
  expect(h.conv.sessionData.address).toContain(`Calle ${selected}`);
  if(access) expect(h.conv.sessionData.address).toContain('402');
  expect(h.conv.sessionData.cart).toEqual(cart);
  expect(route).toHaveBeenCalledTimes(4); // selection is quoted again
  if(h.conv.state!=='awaiting_final_confirm') await h.sendQueued('en efectivo');
  expect(h.conv.state).toBe('awaiting_final_confirm');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];
  expect(dto.items).toHaveLength(2);expect(dto.items.every((item:any)=>item.productId===94744)).toBe(true);
  if(access) expect(dto.address).toContain('402');
  expect(dto.address).toContain(`Calle ${selected}`);expect(dto.address).not.toContain(`Calle ${selected===11?12:11}`);
 });
}

for(const agent of [false,true])for(const exit of ['pickup','cancel','street','pin','routeFailed','coverageChanged','oneCovered','noneCovered']) {
 test(`place selection exit ${exit}/agent=${agent}: no stale place or unverified order`,async()=>{
  const h=harness([{id:94745,code:79,name:'Bowl Vegetal',price:18000,availableNow:true,attributes:[]}],agent);
  Object.assign(h.cfg,{deliveryFeeMode:'distance',restaurantLat:4.63,restaurantLng:-74.15,deliveryFeeTiers:[{maxKm:5.5,fee:2000}]});
  Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true});
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cómo prefieres pagar?',actions:{}});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:474,dailyOrderNumber:474});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  const routing=new WhatsappDeliveryRoutingService({get:()=> 'test-key'} as never);
  let selected=false;
  jest.spyOn(routing as any,'directionsDistance').mockImplementation(async(_origin:any,destination:any)=>{
   if(selected&&exit==='routeFailed')return null;
   return {distanceKm:exit==='noneCovered'||selected&&exit==='coverageChanged'||exit==='oneCovered'&&destination.lat>4.6315?8:1,durationMinutes:4};
  });
  global.fetch=jest.fn().mockImplementation(async(url:string)=>{
   const street=(new URL(url).searchParams.get('address')||'').startsWith('Calle 20');
   return {status:200,json:async()=>({status:'OK',results:street?[{formatted_address:'Calle 20 #80-20, Bogotá, Colombia',types:['street_address'],geometry:{location:{lat:4.631,lng:-74.14}},address_components:[{short_name:'CO',types:['country']}]}]:[1,2].map(n=>({formatted_address:`Conjunto Los Pinos, Calle ${10+n} #80-20, Bogotá, Colombia`,types:['premise'],geometry:{location:{lat:4.63+n/1000,lng:-74.14}},address_components:[{short_name:'CO',types:['country']}]}))})};
  });
  h.service.deliveryRouting=routing;
  await h.sendQueued('quiero un Bowl Vegetal');await h.sendQueued('nada más');
  const cart=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued('Conjunto Los Pinos');
  if(exit==='noneCovered') {
   expect(reply).not.toContain('Calle 11');expect(reply).not.toContain('Calle 12');
   expect(h.conv.sessionData.pendingDeliveryCandidates).toBeUndefined();
   await h.sendQueued('confirmar');expect(h.service.ordersService.create).not.toHaveBeenCalled();return;
  }
  if(exit==='oneCovered') {
   expect(reply).toContain('Calle 11');expect(reply).not.toContain('Calle 12');
   expect(h.conv.sessionData.pendingDeliveryCandidates).toHaveLength(1);
   await h.sendQueued('1');
  } else if(exit==='cancel') {
   await h.sendQueued('cancelar pedido');expect(h.conv.sessionData.cart).toEqual([]);
   expect(h.conv.sessionData.pendingDeliveryCandidates).toBeUndefined();expect(h.service.ordersService.create).not.toHaveBeenCalled();return;
  } else if(exit==='pickup') await h.sendQueued('mejor paso a recogerlo');
  else if(exit==='street') await h.sendQueued('Calle 20 #80-20 apto 402');
  else if(exit==='pin') await h.sendQueued('',{messageType:'location',latitude:4.631,longitude:-74.14});
  else {
   selected=true;await h.sendQueued('1');await h.sendQueued('confirmar');
   expect(h.service.ordersService.create).not.toHaveBeenCalled();
   expect(h.conv.sessionData.cart).toEqual(cart);return;
  }
  expect(h.conv.sessionData.pendingDeliveryCandidates).toBeUndefined();expect(h.conv.sessionData.cart).toEqual(cart);
  await h.sendQueued('en efectivo');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toHaveLength(1);
  if(exit==='street') {expect(dto.address).toContain('Calle 20');expect(dto.address).toContain('402');}
  if(exit==='pickup') expect(h.conv.sessionData.orderType).toBe('pickup');
 });
}

// Public destination responses observed in a bounded read-only Geocoding diagnostic, 2026-11-10.
for(const dish of ['Arroz Con Pollo','Bowl Andino','Ensalada Campestre'])for(const agent of [false,true])for(const coverage of ['both','firstOnly','none'])
 test(`observed partial rooftop places/${dish}/${agent}/${coverage}: offer tentative covered choices, never auto-select`,async()=>{
  const h=harness([{id:94746,code:80,name:dish,price:18000,availableNow:true,attributes:[]}],agent);
  Object.assign(h.cfg,{deliveryFeeMode:'distance',restaurantLat:4.63,restaurantLng:-74.15,deliveryFeeTiers:[{maxKm:5.5,fee:2000}]});
  Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true});
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cómo prefieres pagar?',actions:{}});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:474,dailyOrderNumber:474});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  const routing=new WhatsappDeliveryRoutingService({get:()=> 'test-key'} as never);
  jest.spyOn(routing as any,'directionsDistance').mockImplementation(async(_origin:any,destination:any)=>({distanceKm:coverage==='none'||coverage==='firstOnly'&&destination.lat<4.633?8:1,durationMinutes:4}));
  global.fetch=jest.fn().mockResolvedValue({status:200,json:async()=>({status:'OK',results:[
   {formatted_address:'Plazuelas de San Esteban, Tv. 78b #6d40 #6d- a, Bogotá, Colombia',partial_match:true,types:['establishment','park','point_of_interest'],geometry:{location:{lat:4.6334187,lng:-74.1444932},location_type:'ROOFTOP'},address_components:[{short_name:'CO',types:['country']}]},
   {formatted_address:'Cra. 78a #6b-28, Bogotá, Colombia',partial_match:true,types:['establishment','point_of_interest'],geometry:{location:{lat:4.6323686,lng:-74.145203},location_type:'ROOFTOP'},address_components:[{short_name:'CO',types:['country']}]}
  ]})});
  h.service.deliveryRouting=routing;
  await h.sendQueued(`quiero un ${dish}`);await h.sendQueued('nada más');
  const reply=await h.sendQueued('plazuelas de san esteban torre 3 apto 402');
  if(coverage==='none') {
   expect(h.conv.sessionData.pendingDeliveryCandidates).toBeUndefined();
   expect(reply).not.toContain('Tv. 78b');expect(reply).not.toContain('Cra. 78a');
   await h.sendQueued('confirmar');expect(h.service.ordersService.create).not.toHaveBeenCalled();return;
  }
  expect(reply).toMatch(coverage==='both'?/2 posibles lugares/:/este posible lugar/);
  expect(reply).toContain('Tv. 78b');
  if(coverage==='both')expect(reply).toContain('Cra. 78a');else expect(reply).not.toContain('Cra. 78a');
  expect(h.conv.sessionData.pendingDeliveryCandidates).toHaveLength(coverage==='both'?2:1);
  await h.sendQueued('confirmar');expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued(coverage==='both'?'2':'1');expect(h.conv.sessionData.address).toContain(coverage==='both'?'6b-28':'Tv. 78b');
  expect(h.conv.sessionData.address).toContain('402');
  await h.sendQueued('en efectivo');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  expect(h.service.ordersService.create.mock.calls[0][0].address).toContain(coverage==='both'?'6b-28':'Tv. 78b');
 });

for(const place of ['Plazuelas de San Esteban','Conjunto Los Pinos'])for(const kind of ['partialStreet','centroid','interpolated','foreign','outside'])
 test(`${place}/${kind}: partial candidates never bypass street, country or precision checks`,async()=>{
  const routing=new WhatsappDeliveryRoutingService({get:()=> 'test-key'} as never);
  const route=jest.spyOn(routing as any,'directionsDistance').mockResolvedValue({distanceKm:1,durationMinutes:4});
  global.fetch=jest.fn().mockResolvedValue({status:200,json:async()=>({status:'OK',results:[{
   formatted_address:kind==='partialStreet'?'Calle 10 #81F-20, Bogotá, Colombia':place+', Bogotá, Colombia',partial_match:true,
   types:kind==='centroid'?['neighborhood','political']:['establishment','point_of_interest'],
   geometry:{location:{lat:kind==='outside'?8:4.63,lng:-74.15},location_type:kind==='interpolated'?'GEOMETRIC_CENTER':'ROOFTOP'},
   address_components:[{short_name:kind==='foreign'?'ES':'CO',types:['country']}]
  }]})});
  const quote=await routing.quoteDeliveryFee({customerAddress:kind==='partialStreet'?'Calle 10 #81F-20':place,restaurant:{lat:4.63,lng:-74.15},tiers:[{maxKm:5.5,fee:2000}],maxKm:5.5,fallbackFee:2000});
  expect(quote.ok).toBe(false);
  if(!quote.ok)expect(quote.candidates||[]).toHaveLength(0);
  expect(route).not.toHaveBeenCalled();
 });
