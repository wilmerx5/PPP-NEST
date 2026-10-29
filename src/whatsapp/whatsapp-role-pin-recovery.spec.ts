import {harness} from './whatsapp-accuracy.test-support';
for(const dish of ['Bowl Vegetal','Pasta Del Huerto','Arroz Con Pollo'])
for(const agent of [false,true]) describe(`Role pin ${dish} agent=${agent}`,()=>{
 function rig(covered=true){
  const h=harness([{id:87201,code:87201,name:dish,price:18000,availableNow:true,attributes:[]}],agent);
  h.conv.customerName=null as never;h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  Object.assign(h.cfg,{deliveryFeeMode:'distance',restaurantLat:4.63,restaurantLng:-74.15});
  Object.assign(h.conv.sessionData,{cart:[{productId:87201,name:dish,quantity:1,unitPrice:18000,note:'Sin cebolla'}],orderType:'delivery',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:65,dailyOrderNumber:65});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  h.service.deliveryRouting={quoteDeliveryFee:jest.fn(async({customerCoords}:any)=>customerCoords
    ? covered?{ok:true,fee:2000,distanceKm:1,source:'google_directions',geocodedAddress:'Calle 10 #20-30',customer:customerCoords}:{ok:false,reason:'out_of_coverage',message:'Fuera de cobertura',distanceKm:12}
    : {ok:false,reason:'address_ambiguous',message:'Comparte la ubicación'})};return h;
 }
 const pin=(h:ReturnType<typeof rig>)=>h.sendQueued('',{messageType:'location',latitude:4.64,longitude:-74.14});
 it.each([false,true])('preserves the new pin and optional unit through DTO, unit=%s',async unit=>{
  const h=rig();await h.sendQueued('Solo eso porfa\nLos Cedros');await pin(h);if(unit)await h.sendQueued('Apto 502');
  const fee=h.conv.sessionData.deliveryFeeCalculated;await h.sendQueued('es el conjunto');
  expect(h.conv.sessionData.deliveryLat).toBe(4.64);expect(h.conv.sessionData.address).toContain('Los Cedros');expect(h.conv.sessionData.address).toContain('?q=4.64,-74.14');expect(h.conv.sessionData.deliveryFeeCalculated).toBe(fee);
  expect(h.replies.at(-1)).toMatch(/nombre/i);await h.sendQueued('Natalia');expect(h.conv.state).toBe('awaiting_payment');await h.sendQueued('contraentrega');expect(h.service.ordersService.create).not.toHaveBeenCalled();await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.address).toContain('Los Cedros');expect(dto.address).toContain('?q=4.64,-74.14');if(unit)expect(dto.address).toContain('502');expect(dto.deliveryFee).toBe(2000);expect(dto.items[0].note).toBe('Sin cebolla');
 });
 it('preserves coverage rejection after role clarification',async()=>{
  const h=rig(false);await h.sendQueued('Solo eso porfa\nLos Cedros');await pin(h);await h.sendQueued('es el conjunto');expect(h.conv.sessionData.deliveryOutOfCoverage).toBe(true);
  await h.sendQueued('Natalia');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it('does not adopt a pin saved before the role question',async()=>{
  const h=rig();Object.assign(h.conv.sessionData,{address:'Ubicación anterior — https://maps.google.com/?q=4.64,-74.14',deliveryLat:4.64,deliveryLng:-74.14,addressConfirmed:true,deliveryFeeCalculated:2000});await h.sendQueued('Solo eso porfa\nLos Cedros');await h.sendQueued('es el conjunto');expect(h.conv.sessionData.deliveryLat).toBeUndefined();expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it('pickup clears pin tracking and the role doubt',async()=>{
  const h=rig();await h.sendQueued('Solo eso porfa\nLos Cedros');await pin(h);await h.sendQueued('lo recojo en el local');expect(h.conv.sessionData.pendingRecipientOrPlacePin).toBeUndefined();expect(h.conv.sessionData.pendingRecipientOrPlace).toBeUndefined();expect(h.conv.sessionData.orderType).toBe('pickup');
 });
 it('a second pin replaces the first before place clarification',async()=>{
  const h=rig();await h.sendQueued('Solo eso porfa\nLos Cedros');await pin(h);await h.sendQueued('',{messageType:'location',latitude:4.65,longitude:-74.13});await h.sendQueued('es el conjunto');
  expect(h.conv.sessionData.deliveryLat).toBe(4.65);expect(h.conv.sessionData.address).toContain('?q=4.65,-74.13');expect(h.conv.sessionData.address).not.toContain('?q=4.64,-74.14');
 });
 it('a full street replacement cannot resurrect the pin',async()=>{
  const h=rig();await h.sendQueued('Solo eso porfa\nLos Cedros');await pin(h);await h.sendQueued('Cambia la dirección a Calle 15 #30-40');await h.sendQueued('es el conjunto');
  expect(h.conv.sessionData.pendingRecipientOrPlacePin).toBeUndefined();expect(h.conv.sessionData.address).toContain('30-40');expect(h.conv.sessionData.address).not.toContain('?q=4.64,-74.14');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it('the name-role answer retains the pin without adding a place',async()=>{
  const h=rig();await h.sendQueued('Solo eso porfa\nLos Cedros');await pin(h);await h.sendQueued('es mi nombre');
  expect(h.conv.customerName).toBe('Los Cedros');expect(h.conv.sessionData.deliveryLat).toBe(4.64);expect(h.conv.sessionData.pendingRecipientOrPlacePin).toBeUndefined();expect(h.conv.sessionData.address).not.toContain('Los Cedros');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it('a question about the place preserves the pending role and pin',async()=>{
  const h=rig();await h.sendQueued('Solo eso porfa\nLos Cedros');await pin(h);const before=structuredClone(h.conv.sessionData);await h.sendQueued('¿es el conjunto?');expect(h.conv.sessionData).toEqual(before);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});
