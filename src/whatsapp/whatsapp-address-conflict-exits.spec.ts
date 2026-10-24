import {harness} from './whatsapp-accuracy.test-support';
for(const [dish,place] of [['Bagre','Conjunto Los Pinos'],['Bowl Vegetal','Condominio Los Cedros'],['Ravioles','Urbanización La Rivera']])
for(const agent of [false,true]) for(const exit of ['pickup','reset','pin']) {
 test(`${dish}: exit from conflicting apartment ${exit}; agent=${agent}`,async()=>{
  const h=harness([{id:94301,code:86,name:dish,price:20000,availableNow:true,attributes:[]}],agent);
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cómo prefieres pagar?',actions:{}});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:148,dailyOrderNumber:148});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  Object.assign(h.cfg,{deliveryFeeMode:'distance',restaurantLat:4.63,restaurantLng:-74.15});
  Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true});
  h.service.deliveryRouting={quoteDeliveryFee:jest.fn(async({customerAddress,customerCoords}:{customerAddress:string;customerCoords?:{lat:number;lng:number}})=>customerCoords || customerAddress.includes('20-30')
   ?{ok:true,fee:2000,distanceKm:1,source:'google_directions',geocodedAddress:'Calle 10 #20-30, Bogotá',customer:customerCoords || {lat:4.64,lng:-74.14}}
   :{ok:false,reason:'address_ambiguous',message:'No pude ubicarla. Comparte calle y número.'})};
  await h.sendQueued(`Quiero un ${dish}`);await h.sendQueued('nada más');
  await h.sendQueued(`${place} torre 3 apto 402`);
  expect(h.conv.sessionData.address).toContain('402');
  await h.sendQueued('Calle 10 #20-30 apto 708 apartamento 709');
  expect(h.conv.sessionData.pendingAddressConflict).toBeDefined();
  const cart=structuredClone(h.conv.sessionData.cart);
  if (exit === 'reset') {
   await h.sendQueued('reiniciar');
   expect(h.conv.sessionData.pendingAddressConflict).toBeUndefined();
   expect(h.conv.sessionData.cart).toHaveLength(0);
   expect(h.service.ordersService.create).not.toHaveBeenCalled();
   await h.sendQueued(`Quiero un ${dish}`);
   await h.sendQueued('Lo recojo en el local');
  } else if (exit === 'pickup') {
   const reply=await h.sendQueued('Mejor lo recojo en el local');
   expect(reply).not.toMatch(/falta aclarar|708.*709/i);
   expect(h.conv.sessionData.cart).toEqual(cart);
   expect(h.conv.sessionData.pendingAddressConflict).toBeUndefined();
  } else {
   await h.sendQueued('',{messageType:'location',latitude:4.65,longitude:-74.14});
   expect(h.conv.sessionData.pendingAddressConflict).toBeDefined();
   expect(h.conv.sessionData.deliveryLat).toBe(4.65);
   await h.sendQueued('confirmar');
   expect(h.service.ordersService.create).not.toHaveBeenCalled();
   expect(h.conv.sessionData.cart).toEqual(cart);
   await h.sendQueued('Calle 10 #20-30 apto 708');
   expect(h.conv.sessionData.pendingAddressConflict).toBeUndefined();
  }
  await h.sendQueued('en efectivo');
  expect(h.conv.state).toBe('awaiting_final_confirm');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(exit!=='pin') expect(h.conv.sessionData.deliveryFeeCalculated ?? 0).toBe(0);
  await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];
  expect(dto.items).toHaveLength(1);
  if(exit==='pin') expect(dto.address).toContain('708');
  else {
   expect(h.conv.sessionData.orderType).toBe('pickup');

   expect(dto.address).not.toMatch(/708|709|402/);
  }
 });
}
