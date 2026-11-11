import {harness} from './whatsapp-accuracy.test-support';
import {WhatsappDeliveryRoutingService} from './whatsapp-delivery-routing.service';

const originalFetch=global.fetch;
afterEach(()=>{global.fetch=originalFetch;jest.restoreAllMocks();});
for(const place of ['Conjunto Villagalante','Conjunto Altavista','Edificio Mirador Azul'])
for(const agent of [false,true]) for(const interrupt of ['no','esa no es','ninguna de esas','9','por nequi','confirmar'])
for(const recovery of ['street','place']) {
 test(`${place}/${agent}/${interrupt}/${recovery}: replace tentative destination without stale selection`,async()=>{
  const h=harness([{id:94900,code:90,name:'Bowl Andino',price:18000,availableNow:true,attributes:[]}],agent);
  Object.assign(h.cfg,{deliveryFeeMode:'distance',restaurantLat:4.63,restaurantLng:-74.15,deliveryFeeTiers:[{maxKm:5.5,fee:2000}]});
  Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true});
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cómo prefieres pagar?',actions:{}});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:490,dailyOrderNumber:490});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  const routing=new WhatsappDeliveryRoutingService({get:()=> 'test-key'} as never);
  jest.spyOn(routing as any,'directionsDistance').mockResolvedValue({distanceKm:1,durationMinutes:4});
  let revised=false;
  global.fetch=jest.fn().mockImplementation(async()=>({status:200,json:async()=>({status:'OK',results:[{
   formatted_address:revised?(recovery==='place'?'Conjunto Senderos del Roble, Calle 12 #80-20, Bogotá, Colombia':'Calle 12 #80-20, Bogotá, Colombia'):'Cl. 6b #79c-81, Bogotá, Colombia',
   place_id:'synthetic-place-id',types:revised?['premise']:['establishment','point_of_interest'],
   geometry:{location_type:'ROOFTOP',location:{lat:revised?4.632:4.63598,lng:-74.15014}},address_components:[{short_name:'CO',types:['country']}]
  }]})}));
  h.service.deliveryRouting=routing;
  await h.sendQueued('quiero dos Bowl Andino');await h.sendQueued('nada más');
  const cart=structuredClone(h.conv.sessionData.cart);
  expect(await h.sendQueued(`${place} torre 21 apto 442`)).toMatch(/posible lugar/);
  await h.sendQueued(interrupt);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  expect(h.conv.sessionData.pendingDeliveryCandidates).toHaveLength(1);
  expect(h.conv.sessionData.deliveryFeeCalculated).toBeNull();
  expect(h.conv.sessionData.cart).toEqual(cart);
  revised=true;
  const corrected=await h.sendQueued(recovery==='street'?'Calle 12 #80-20 torre 3 apto 502':'Conjunto Senderos del Roble torre 3 apto 502');
  expect(corrected).not.toMatch(/79c-81|442|No pude|no registr/);
  expect(h.conv.sessionData.pendingDeliveryCandidates?.length || 0).toBe(0);
  expect(h.conv.sessionData.addressConfirmed).toBe(true);
  expect(h.conv.sessionData.cart).toEqual(cart);
  await h.sendQueued('efectivo');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];
  expect(dto.items).toHaveLength(2);expect(dto.items.every((item:any)=>item.productId===94900)).toBe(true);
  expect(dto.address).toContain('502');expect(dto.address).not.toMatch(/79c-81|442/);
  expect(dto.address).toMatch(recovery==='street'?/12.*80-20/:/Senderos del Roble/);
  expect(h.conv.state).toBe('completed');
 });
}
