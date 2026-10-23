import { harness } from './whatsapp-accuracy.test-support';
import { WhatsappDeliveryRoutingService } from './whatsapp-delivery-routing.service';

for(const [dish,name,place] of [['Bagre','Laura García','Plazuelas de San Esteban'],['Bowl Vegetal','Camila Rojas','Conjunto Los Pinos'],['Ravioles','Daniela Ruiz','Urbanización Los Cedros']])
for(const agent of [false,true]) for(const phrase of ['Mi nombre es : NAME','Ya te dije que era NAME','NAME es mi nombre real 😒']) {
 test(`${dish}: name after unresolved place; ${phrase}; agent=${agent}`,async()=>{
  const h=harness([{id:94101,code:84,name:dish,price:29000,availableNow:true,attributes:[]}],agent);
  h.conv.customerName='';
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cómo prefieres pagar?',actions:{}});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:147,dailyOrderNumber:147});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  Object.assign(h.cfg,{deliveryFeeMode:'distance',restaurantLat:4.63,restaurantLng:-74.15});
  Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true});
  h.service.deliveryRouting={quoteDeliveryFee:jest.fn(async({customerAddress}:{customerAddress:string})=>customerAddress.includes('20-30')
   ?{ok:true,fee:2000,distanceKm:1,source:'google_directions',customer:{lat:4.64,lng:-74.14}}
   :{ok:false,reason:'address_ambiguous',message:'No pude ubicarla. Comparte calle y número.'})};
  await h.sendQueued(`Quiero un ${dish}`);await h.sendQueued('nada más');
  expect(h.conv.state).toBe('awaiting_name');
  await h.sendQueued(`Envíalo a ${place}`);
  const named=await h.sendQueued(phrase.replace('NAME',name));
  expect(named).not.toMatch(/necesito tu.*nombre real|escribe tu.*nombre/i);
  expect(h.conv.customerName).toBe(name);
  await h.sendQueued('Contra entrega');
  expect(h.conv.customerName).toBe(name);
  expect(h.conv.state).not.toBe('awaiting_name');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('Calle 10 #20-30');
  await h.sendQueued('en efectivo');
  await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];
  expect(dto.customerName).toBe(name);
  expect(dto.items).toHaveLength(1);
 });
}

for(const place of ['Plazuela de San Esteban','Los Pinos','Los Cedros']) for(const prefix of ['Condominio','Condómino']) {
 test(`${prefix} ${place}: descriptor does not change place identity`,()=>{
  const routing=new WhatsappDeliveryRoutingService({get:()=>undefined} as never) as any;
  expect(routing.resultMatchesNamedPlace(`${prefix} ${place}`,{name:place,formatted_address:'Bogotá, Colombia'})).toBe(true);
  expect(routing.resultMatchesNamedPlace(`${prefix} ${place}`,{name:'Otro edificio',formatted_address:'Bogotá, Colombia'})).toBe(false);
  expect(routing.resultMatchesNamedPlace(`${prefix} ${place}`,{name:place,partial_match:true})).toBe(false);
 });
}
