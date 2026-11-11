import {harness} from './whatsapp-accuracy.test-support';
import {WhatsappDeliveryRoutingService} from './whatsapp-delivery-routing.service';
const originalFetch=global.fetch;
afterEach(()=>{global.fetch=originalFetch;jest.restoreAllMocks();});
function start(agent:boolean){
 const h=harness([{id:94910,code:91,name:'Bowl Andino',price:18000,availableNow:true,attributes:[]}],agent);
 Object.assign(h.cfg,{deliveryFeeMode:'distance',restaurantLat:4.63,restaurantLng:-74.15,deliveryFeeTiers:[{maxKm:5.5,fee:2000}]});
 Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true});
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cómo prefieres pagar?',actions:{}});
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:491,dailyOrderNumber:491});
 h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 const routing=new WhatsappDeliveryRoutingService({get:()=> 'test-key'} as never);
 const route=jest.spyOn(routing as any,'directionsDistance').mockResolvedValue({distanceKm:1,durationMinutes:4});
 let pin=false;
 global.fetch=jest.fn().mockImplementation(async()=>({status:200,json:async()=>({status:'OK',results:[{
  formatted_address:pin?'Calle 12 #80-20, Bogotá, Colombia':'Cl. 6b #79c-81, Bogotá, Colombia',place_id:'synthetic-place-id',
  types:pin?['street_address']:['establishment','point_of_interest'],geometry:{location_type:'ROOFTOP',location:{lat:pin?4.632:4.63598,lng:-74.15014}},address_components:[{short_name:'CO',types:['country']}]
 }]})}));
 h.service.deliveryRouting=routing;
 return {h,route,usePin:()=>{pin=true;}};
}
for(const place of ['Conjunto Villagalante','Conjunto Altavista','Edificio Mirador Azul']) for(const agent of [false,true]) {
 for(const interruption of ['none','no','por nequi']) test(`${place}/${agent}/${interruption}: WhatsApp pin replaces tentative candidate`,async()=>{
  const {h,route,usePin}=start(agent);
  await h.sendQueued('quiero dos Bowl Andino');await h.sendQueued('nada más');
  expect(await h.sendQueued(`${place} torre 3 apto 502`)).toMatch(/posible lugar/);
  const cart=structuredClone(h.conv.sessionData.cart);
  if(interruption!=='none')await h.sendQueued(interruption);
  expect(h.conv.sessionData.pendingDeliveryCandidates).toHaveLength(1);
  usePin();
  await h.sendQueued('',{messageType:'location',latitude:4.632,longitude:-74.15014});
  expect(h.conv.sessionData.pendingDeliveryCandidates?.length || 0).toBe(0);
  expect(h.conv.sessionData.cart).toEqual(cart);
  expect(h.conv.sessionData.deliveryLat).toBe(4.632);
  expect(h.conv.sessionData.deliveryLng).toBe(-74.15014);
  expect(h.conv.sessionData.deliveryFeeCalculated).toBe(2000);
  expect(h.conv.sessionData.address).toContain('502');
  expect(h.conv.sessionData.address).not.toContain('79c-81');
  expect(route.mock.calls.some((call:any)=>call[1].lat===4.632)).toBe(true);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(h.conv.state!=='awaiting_final_confirm')await h.sendQueued('efectivo');
  await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];
  expect(dto.items).toHaveLength(2);expect(dto.items.every((item:any)=>item.productId===94910)).toBe(true);
  expect(dto.address).toContain('502');expect(dto.address).not.toContain('79c-81');
  expect(h.conv.state).toBe('completed');
 });
 for(const cancel of ['cancelar pedido','cancela el pedido','por favor cancelar pedido']) test(`${place}/${agent}/${cancel}: cancel candidate and start fresh purchase`,async()=>{
  const {h}=start(agent);
  await h.sendQueued('quiero dos Bowl Andino');await h.sendQueued('nada más');
  expect(await h.sendQueued(`${place} torre 3 apto 502`)).toMatch(/posible lugar/);
  expect(h.conv.sessionData.pendingDeliveryCandidates).toHaveLength(1);
  expect(await h.sendQueued(cancel)).toMatch(/cancelad|vaci/i);
  expect(h.conv.sessionData.pendingDeliveryCandidates?.length || 0).toBe(0);
  expect(h.cartRows()).toEqual([]);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('quiero un Bowl Andino');await h.sendQueued('no más, recojo en el local');await h.sendQueued('efectivo');
  expect(h.conv.sessionData.pendingDeliveryCandidates?.length || 0).toBe(0);
  await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  expect(h.service.ordersService.create.mock.calls[0][0].items).toEqual([expect.objectContaining({productId:94910})]);
  expect(h.conv.state).toBe('completed');
 });
}
for(const place of ['Conjunto Villagalante','Conjunto Altavista','Edificio Mirador Azul']) for(const agent of [false,true])
for(const failure of ['routeUnavailable','outOfCoverage']) test(`${place}/${agent}/${failure}: revalidate selected candidate then recover by pin`,async()=>{
 const {h,route,usePin}=start(agent);
 await h.sendQueued('quiero dos Bowl Andino');await h.sendQueued('nada más');
 expect(await h.sendQueued(`${place} torre 3 apto 502`)).toMatch(/posible lugar/);
 const cart=structuredClone(h.conv.sessionData.cart);
 route.mockResolvedValueOnce(failure==='routeUnavailable'?null:{distanceKm:12,durationMinutes:30});
 const blocked=await h.sendQueued('1');
 expect(blocked).toMatch(/No pude volver a validar la ruta/);
 expect(h.service.ordersService.create).not.toHaveBeenCalled();
 expect(h.conv.sessionData.cart).toEqual(cart);
 expect(h.conv.sessionData.deliveryFeeCalculated == null).toBe(true);
 expect(h.conv.sessionData.addressConfirmed).toBe(false);
 usePin();await h.sendQueued('',{messageType:'location',latitude:4.632,longitude:-74.15014});
 expect(h.conv.sessionData.deliveryLat).toBe(4.632);
 expect(h.conv.sessionData.deliveryFeeCalculated).toBe(2000);
 expect(h.conv.sessionData.pendingDeliveryCandidates?.length || 0).toBe(0);
 expect(h.conv.sessionData.cart).toEqual(cart);
 await h.sendQueued('efectivo');await h.sendQueued('confirmar');
 expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
 const dto=h.service.ordersService.create.mock.calls[0][0];
 expect(dto.items).toHaveLength(2);expect(dto.address).toContain('502');
 expect(h.conv.state).toBe('completed');
});
