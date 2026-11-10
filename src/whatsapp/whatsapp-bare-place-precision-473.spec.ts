import {harness} from './whatsapp-accuracy.test-support';
import {WhatsappDeliveryRoutingService} from './whatsapp-delivery-routing.service';

const originalFetch = global.fetch;
afterEach(() => {global.fetch = originalFetch; jest.restoreAllMocks();});

for (const dish of ['Arroz Con Pollo','Bowl Andino']) for (const agent of [false,true]) {
 test(`${dish}: bare complex name cannot close against neighborhood centroid; agent=${agent}`,async()=>{
  const h=harness([{id:94730,code:73,name:dish,price:18000,availableNow:true,attributes:[]}],agent);
  Object.assign(h.cfg,{deliveryFeeMode:'distance',restaurantLat:4.63,restaurantLng:-74.15,deliveryFeeTiers:[{maxKm:5.5,fee:2000}]});
  Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true});
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cómo prefieres pagar?',actions:{}});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:473,dailyOrderNumber:473});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  const routing=new WhatsappDeliveryRoutingService({get:()=> 'test-key'} as never);
  const route=jest.spyOn(routing as any,'directionsDistance').mockResolvedValue({distanceKm:1,durationMinutes:4});
  global.fetch=jest.fn().mockResolvedValue({status:200,json:async()=>({status:'OK',results:[{
   formatted_address:'Kennedy, Bogotá, Colombia',types:['sublocality','political'],
   geometry:{location:{lat:4.64,lng:-74.14}},address_components:[{long_name:'Kennedy',types:['sublocality']},{short_name:'CO',types:['country']}]
  }]})});
  h.service.deliveryRouting=routing;
  await h.sendQueued(`quiero un ${dish}`); await h.sendQueued('nada más');
  const cart=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued('Castilla Reservado');
  expect(reply).toMatch(/ubicación|calle|número/i);
  await h.sendQueued('por nequi'); await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  expect(route).not.toHaveBeenCalled();
  expect(h.conv.sessionData.cart).toEqual(cart);
 });
}

for (const dish of ['Arroz Con Pollo','Bowl Andino','Ensalada Campestre'])
for (const agent of [false,true]) for (const place of ['Castilla Reservado','Parques del Lago','Senderos del Río'])
for (const mapMode of ['unrelated','sameNeighborhood','partial','wrongPremise'])
for (const recovery of ['street','pin']) {
 test(`${dish}/${place}/${mapMode}/${recovery}/agent=${agent}: clarify destination then close once`,async()=>{
  const h=harness([{id:94731,code:74,name:dish,price:18000,availableNow:true,attributes:[]}],agent);
  Object.assign(h.cfg,{deliveryFeeMode:'distance',restaurantLat:4.63,restaurantLng:-74.15,deliveryFeeTiers:[{maxKm:5.5,fee:2000}]});
  Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true});
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cómo prefieres pagar?',actions:{}});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:473,dailyOrderNumber:473});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  const routing=new WhatsappDeliveryRoutingService({get:()=> 'test-key'} as never);
  const route=jest.spyOn(routing as any,'directionsDistance').mockResolvedValue({distanceKm:1,durationMinutes:4});
  let precise=false;
  global.fetch=jest.fn().mockImplementation(async()=>({status:200,json:async()=>({status:'OK',results:[{
   formatted_address:precise?'Calle 10 #20-30, Bogotá, Colombia':
    mapMode==='unrelated'?'Kennedy, Bogotá, Colombia':mapMode==='wrongPremise'?'Edificio Las Acacias, Bogotá, Colombia':`${place}, Bogotá, Colombia`,
   partial_match:!precise && mapMode==='partial',
   types:precise?['street_address']:mapMode==='sameNeighborhood'?['neighborhood','political']:['premise'],
   geometry:{location:{lat:4.64,lng:-74.14}},address_components:[{short_name:'CO',types:['country']}]
  }]})}));
  h.service.deliveryRouting=routing;
  await h.sendQueued(`quiero dos ${dish}`);await h.sendQueued('nada más');
  const cart=structuredClone(h.conv.sessionData.cart);
  const clarification=await h.sendQueued(place);
  expect(clarification).toMatch(/ubicación|calle|número/i);
  expect(clarification).not.toMatch(/¿Cómo pagas|Si está bien, escribe/);
  expect(route).not.toHaveBeenCalled();
  await h.sendQueued('por nequi');await h.sendQueued('confirmar');
  expect(h.conv.sessionData.cart).toEqual(cart);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  expect(route).not.toHaveBeenCalled();
  precise=true;
  if(recovery==='street') await h.sendQueued('Calle 10 #20-30 torre 3 apto 402');
  else {
   await h.sendQueued('torre 3 apto 402');
   await h.sendQueued('',{messageType:'location',latitude:4.64,longitude:-74.14});
  }
  expect(h.conv.sessionData.cart).toEqual(cart);
  expect(h.conv.sessionData.address).toMatch(/402/);
  expect(h.conv.sessionData.deliveryFeeCalculated).toBe(2000);
  if(h.conv.state!=='awaiting_final_confirm') await h.sendQueued('por nequi');
  expect(h.conv.state).toBe('awaiting_final_confirm');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];
  expect(dto.items).toHaveLength(2);
  expect(dto.items.every((item:any)=>item.productId===94731)).toBe(true);
  expect(dto.address).toMatch(/402/);
  expect(h.conv.state).toBe('completed');
 });
}

for(const place of ['Castilla Reservado','Parques del Lago','Senderos del Río'])
for(const kind of ['premise','point_of_interest','street_address']) {
 test(`${place}/${kind}: exact landmark is accepted without requiring a street`,async()=>{
  const routing=new WhatsappDeliveryRoutingService({get:()=> 'test-key'} as never);
  const route=jest.spyOn(routing as any,'directionsDistance').mockResolvedValue({distanceKm:1,durationMinutes:4});
  global.fetch=jest.fn().mockResolvedValue({status:200,json:async()=>({status:'OK',results:[{
   formatted_address:`${place}, Bogotá, Colombia`,types:[kind],geometry:{location:{lat:4.64,lng:-74.14}},address_components:[{short_name:'CO',types:['country']}]
  }]})});
  expect(await routing.quoteDeliveryFee({customerAddress:place,restaurant:{lat:4.63,lng:-74.15},tiers:[{maxKm:5.5,fee:2000}],maxKm:5.5,fallbackFee:2000})).toMatchObject({ok:true,fee:2000});
  expect(route).toHaveBeenCalledTimes(1);
 });
}
