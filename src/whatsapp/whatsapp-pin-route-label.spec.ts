import {harness} from './whatsapp-accuracy.test-support';
import {WhatsappOrchestratorService} from './whatsapp-orchestrator.service';
import {WhatsappDeliveryRoutingService} from './whatsapp-delivery-routing.service';
const originalFetch=global.fetch;
afterEach(()=>global.fetch=originalFetch);
for(const named of [false,true]) for(const label of ['Calle 12 #34-56, Bogotá','']) for(const kind of ['native','link']) {
 it(`pin label to receipt and courier, named=${named}, label=${!!label}, ${kind}`,async()=>{
  const h=harness();
  h.service.reply=(WhatsappOrchestratorService.prototype as any).reply.bind(h.service);
  Object.assign(h.cfg,{deliveryFeeMode:'distance',restaurantLat:4.63,restaurantLng:-74.15,deliveryFeeTiers:[{maxKm:5.5,fee:2000}]});
  h.service.deliveryRouting=new WhatsappDeliveryRoutingService({get:()=> 'fake-key'} as never);
  global.fetch=jest.fn().mockResolvedValue({status:200,json:async()=>({status:'OK',routes:[{legs:[{end_address:label,distance:{value:1000},duration:{value:300}}]}]})});
  Object.assign(h.conv.sessionData,{cart:[{productId:23,code:23,name:'Arroz Con Pollo',unitPrice:29500,quantity:1,attributes:[],note:'sin ensalada'}],orderType:'delivery',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,pendingDeliveryUnit:'torre 3 apto 402'});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:987,dailyOrderNumber:98});
  await h.sendQueued(kind==='link'?'https://maps.google.com/?q=4.64,-74.14':'',{...(kind==='native'?{messageType:'location',latitude:4.64,longitude:-74.14,...(named?{locationName:'Edificio Aurora',locationAddress:'Calle 12 #34-50'}:{})}:{})});
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(h.conv.sessionData.deliveryLat).toBe(4.64);
  expect(h.conv.sessionData.deliveryLng).toBe(-74.14);
  const expected=named&&kind==='native'?'Edificio Aurora':label||'Ubicación compartida';
  expect(h.replies.join('\n')).toContain(expected);
  expect(h.replies.join('\n')).not.toMatch(/4\.64|-74\.14/);
  expect(h.conv.sessionData.address).toContain('torre 3 apto 402');
  expect(h.conv.sessionData.address).toContain('https://maps.google.com/?q=4.64,-74.14');
  expect(h.conv.sessionData.address).not.toContain('📍 4.64, -74.14');
  await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];
  expect(dto.address).toContain(expected);expect(dto.address).toContain('torre 3 apto 402');
  expect(dto.address).toContain('https://maps.google.com/?q=4.64,-74.14');
  expect(dto.items).toHaveLength(1);expect(dto.items[0].note).toBe('sin ensalada');
 });
}
