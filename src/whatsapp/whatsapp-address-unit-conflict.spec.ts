import {harness} from './whatsapp-accuracy.test-support';
for(const [dish,place] of [['Bagre','Conjunto Los Pinos'],['Bowl Vegetal','Condominio Los Cedros'],['Ravioles','Urbanización La Rivera']])
for(const agent of [false,true]) for(const conflict of [false,true]) {
 test(`${dish}: ${conflict?'conflicting':'repeated'} apartment labels while completing place; agent=${agent}`,async()=>{
  const h=harness([{id:94301,code:86,name:dish,price:20000,availableNow:true,attributes:[]}],agent);
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cómo prefieres pagar?',actions:{}});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:148,dailyOrderNumber:148});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  Object.assign(h.cfg,{deliveryFeeMode:'distance',restaurantLat:4.63,restaurantLng:-74.15});
  Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true});
  h.service.deliveryRouting={quoteDeliveryFee:jest.fn(async({customerAddress}:{customerAddress:string})=>customerAddress.includes('20-30')
   ?{ok:true,fee:2000,distanceKm:1,source:'google_directions',geocodedAddress:'Calle 10 #20-30, Bogotá',customer:{lat:4.64,lng:-74.14}}
   :{ok:false,reason:'address_ambiguous',message:'No pude ubicarla. Comparte calle y número.'})};
  await h.sendQueued(`Quiero un ${dish}`);await h.sendQueued('nada más');
  await h.sendQueued(`${place} torre 3 apto 402`);
  expect(h.conv.sessionData.address).toContain('402');
  const before=structuredClone(h.conv.sessionData);
  h.service.deliveryRouting.quoteDeliveryFee.mockClear();
  const response=await h.sendQueued(`Calle 10 #20-30 apto 708 apartamento ${conflict?'709':'708'}`);
  if(conflict) {
   expect(h.conv.sessionData).toEqual(before);
   expect(h.service.deliveryRouting.quoteDeliveryFee).not.toHaveBeenCalled();
   expect(response).toMatch(/cu[aá]l|confirma|dos/i);
   expect(response).toContain('708');expect(response).toContain('709');
   await h.sendQueued('Calle 10 #20-30 apto 708');
  }
  expect(h.conv.sessionData.address).toContain(place);
  expect(h.conv.sessionData.address).toMatch(/torre 3/);
  expect(h.conv.sessionData.address).toContain('708');
  expect(h.conv.sessionData.address).not.toMatch(/402|709/);
  await h.sendQueued('en efectivo');
  expect(h.conv.state).toBe('awaiting_final_confirm');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];
  expect(dto.address).toContain('20-30');
  expect(dto.address).not.toContain('402');
  expect(dto.address).toContain('708');
  expect(dto.address).toContain(place);expect(dto.address).toMatch(/torre 3/);
  expect(dto.items).toHaveLength(1);
 });
}
