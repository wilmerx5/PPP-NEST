import {harness} from './whatsapp-accuracy.test-support';
import {WhatsappDeliveryRoutingService} from './whatsapp-delivery-routing.service';

const originalFetch=global.fetch;
afterEach(()=>{global.fetch=originalFetch;jest.restoreAllMocks();});
const names=[['Conjunto Villagalante','Conjunto Residencial Villa Galante'],['Conjunto Villa Galante','Conjunto Residencial Villagalante'],['Conjunto Altavista','Conjunto Residencial Alta Vista'],['Conjunto Alta Vista','Conjunto Residencial Altavista']];
const result=(name:string)=>({name,formatted_address:`${name}, Bogotá, Colombia`,types:['premise'],geometry:{location:{lat:4.64,lng:-74.14}},address_components:[{short_name:'CO',types:['country']}]});
for(const [query,name] of names) for(const agent of [false,true]) {
 test(`${query}/${name}/agent=${agent}: resolve exact name across word boundaries and close`,async()=>{
  const h=harness([{id:94890,code:89,name:'Bowl Andino',price:18000,availableNow:true,attributes:[]}],agent);
  Object.assign(h.cfg,{deliveryFeeMode:'distance',restaurantLat:4.63,restaurantLng:-74.15,deliveryFeeTiers:[{maxKm:5.5,fee:2000}]});
  Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true});
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cómo prefieres pagar?',actions:{}});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:489,dailyOrderNumber:489});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  const routing=new WhatsappDeliveryRoutingService({get:()=> 'test-key'} as never);
  jest.spyOn(routing as any,'directionsDistance').mockResolvedValue({distanceKm:1,durationMinutes:4});
  global.fetch=jest.fn().mockResolvedValue({status:200,json:async()=>({status:'OK',results:[result(name)]})});
  h.service.deliveryRouting=routing;
  await h.sendQueued('quiero un Bowl Andino');await h.sendQueued('nada más');
  const cart=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued(`${query} torre 21 apto 442`);
  expect(reply).toMatch(/2\.000|2,000/);
  expect(reply).not.toMatch(/No pude|calle y|ubicación de WhatsApp/);
  expect(h.conv.sessionData.cart).toEqual(cart);
  await h.sendQueued('efectivo');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];
  expect(dto.items).toHaveLength(1);expect(dto.items[0].productId).toBe(94890);
  expect(dto.address).toMatch(/442/);expect(h.conv.state).toBe('completed');
 });
}
for(const [label,candidate] of [
 ['different name',result('Villa Elegante')],['substring',result('Villagalanteextra')],
 ['centroid',{...result('Villa Galante'),types:['neighborhood','political']}],
 ['partial',{...result('Villa Galante'),partial_match:true}],
 ['different city',{...result('Villa Galante'),geometry:{location:{lat:6.24,lng:-75.58}}}],
 ['foreign',{...result('Villa Galante'),address_components:[{short_name:'MX',types:['country']}]}],
 ['cross fields',{...result('Villa'),formatted_address:'Galante, Bogotá, Colombia'}],
 ['cross locality',{...result('Other'),formatted_address:'Villa, Galante, Colombia'}],
] as const){
 test(`Villagalante rejects ${label}`,async()=>{
  const routing=new WhatsappDeliveryRoutingService({get:()=> 'test-key'} as never);
  const route=jest.spyOn(routing as any,'directionsDistance').mockResolvedValue({distanceKm:1,durationMinutes:4});
  global.fetch=jest.fn().mockResolvedValue({status:200,json:async()=>({status:'OK',results:[candidate]})});
  const quote=await routing.quoteDeliveryFee({customerAddress:'Conjunto Villagalante',restaurant:{lat:4.63,lng:-74.15},tiers:[{maxKm:5.5,fee:2000}],maxKm:5.5,fallbackFee:2000});
  expect(quote.ok).toBe(false);expect(route).not.toHaveBeenCalled();
 });
}
for(const query of ['Conjunto Villagalante','Conjunto Altavista']) for(const agent of [false,true]) {
 test(`${query}/agent=${agent}: joined spelling still requires selection among covered places`,async()=>{
  const name=query.includes('Villagalante')?'Villa Galante':'Alta Vista';
  const h=harness([{id:94890,code:89,name:'Bowl Andino',price:18000,availableNow:true,attributes:[]}],agent);
  Object.assign(h.cfg,{deliveryFeeMode:'distance',restaurantLat:4.63,restaurantLng:-74.15,deliveryFeeTiers:[{maxKm:5.5,fee:2000}]});
  Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true});
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cómo prefieres pagar?',actions:{}});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:489,dailyOrderNumber:489});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  const routing=new WhatsappDeliveryRoutingService({get:()=> 'test-key'} as never);
  jest.spyOn(routing as any,'directionsDistance').mockImplementation(async(_origin:any,destination:any)=>({distanceKm:destination.lat>4.635?8:1,durationMinutes:4}));
  global.fetch=jest.fn().mockResolvedValue({status:200,json:async()=>({status:'OK',results:[1,2,9].map(n=>({
   ...result(name),formatted_address:`${name}, Calle ${10+n} #80-20, Bogotá, Colombia`,geometry:{location:{lat:4.63+n/1000,lng:-74.14}}
  }))})});
  h.service.deliveryRouting=routing;
  await h.sendQueued('quiero un Bowl Andino');await h.sendQueued('nada más');
  const cart=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued(`${query} torre 21 apto 442`);
  expect(reply).toMatch(/2 lugares/);expect(reply).toContain('Calle 11');expect(reply).toContain('Calle 12');expect(reply).not.toContain('Calle 19');
  await h.sendQueued('confirmar');expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('2');expect(h.conv.sessionData.cart).toEqual(cart);
  await h.sendQueued('efectivo');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];
  expect(dto.items).toHaveLength(1);expect(dto.address).toContain('Calle 12');expect(dto.address).toContain('442');
 });
}
for(const place of ['Conjunto Villagalante','Conjunto Villa Galante','Conjunto Senderos del Roble','Edificio Mirador Azul']) for(const agent of [false,true]) {
 test(`${place}/agent=${agent}: nameless rooftop POI requires explicit covered destination selection`,async()=>{
  const h=harness([{id:94890,code:89,name:'Bowl Andino',price:18000,availableNow:true,attributes:[]}],agent);
  Object.assign(h.cfg,{deliveryFeeMode:'distance',restaurantLat:4.63,restaurantLng:-74.15,deliveryFeeTiers:[{maxKm:5.5,fee:2000}]});
  Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true});
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cómo prefieres pagar?',actions:{}});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:489,dailyOrderNumber:489});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  const routing=new WhatsappDeliveryRoutingService({get:()=> 'test-key'} as never);
  jest.spyOn(routing as any,'directionsDistance').mockResolvedValue({distanceKm:1,durationMinutes:4});
  global.fetch=jest.fn().mockResolvedValue({status:200,json:async()=>({status:'OK',results:[{
   formatted_address:'Cl. 6b #79c-81, Bogotá, Colombia',place_id:'synthetic-place-id',types:['establishment','point_of_interest'],
   geometry:{location_type:'ROOFTOP',location:{lat:4.63598,lng:-74.15014}},address_components:[
    {long_name:'79c-81',types:['street_number']},{long_name:'Calle 6b',types:['route']},
    {long_name:'Pio XII',types:['neighborhood','political']},{long_name:'Bogotá',types:['locality']},{short_name:'CO',types:['country']}
   ]
  }]})});
  h.service.deliveryRouting=routing;
  await h.sendQueued('quiero un Bowl Andino');await h.sendQueued('nada más');
  const cart=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued(`${place} torre 21 apto 442`);
  expect(reply).toMatch(/posible lugar/);expect(reply).toContain('79c-81');
  expect(h.conv.sessionData.pendingDeliveryCandidates).toHaveLength(1);
  expect(h.conv.sessionData.pendingDeliveryCandidates?.[0].tentative).toBe(true);
  await h.sendQueued('por nequi');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();expect(h.conv.sessionData.cart).toEqual(cart);
  await h.sendQueued('1');
  if(h.conv.state!=='awaiting_final_confirm') await h.sendQueued('efectivo');
  await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];
  expect(dto.items).toHaveLength(1);expect(dto.address).toContain('79c-81');expect(dto.address).toContain('442');
 });
}
for(const mode of ['approximate','streetOnly','noProviderId','namedOtherPremise','farRoad','numberedQuery']) {
 test(`nameless provider fallback remains bounded: ${mode}`,async()=>{
  const routing=new WhatsappDeliveryRoutingService({get:()=> 'test-key'} as never);
  const route=jest.spyOn(routing as any,'directionsDistance').mockResolvedValue({distanceKm:mode==='farRoad'?12:1,durationMinutes:4});
  global.fetch=jest.fn().mockResolvedValue({status:200,json:async()=>({status:'OK',results:[{
   formatted_address:'Cl. 6b #79c-81, Bogotá, Colombia',place_id:mode==='noProviderId'?undefined:'synthetic',
   types:mode==='streetOnly'?['street_address']:['establishment','point_of_interest'],
   geometry:{location_type:mode==='approximate'?'APPROXIMATE':'ROOFTOP',location:{lat:4.63598,lng:-74.15014}},
   address_components:[{short_name:'CO',types:['country']},...(mode==='namedOtherPremise'?[{long_name:'Other Building',types:['premise']}]:[])]
  }]})});
  const quote=await routing.quoteDeliveryFee({customerAddress:mode==='numberedQuery'?'Calle 10 #81F-20':'Conjunto Villagalante',restaurant:{lat:4.63,lng:-74.15},tiers:[{maxKm:5.5,fee:2000}],maxKm:5.5,fallbackFee:2000});
  expect(quote.ok).toBe(false);
  if(!quote.ok) expect(quote.candidates || []).toHaveLength(0);
  if(mode!=='farRoad') expect(route).not.toHaveBeenCalled();
 });
}
