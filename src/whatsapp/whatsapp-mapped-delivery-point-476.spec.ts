import {harness} from './whatsapp-accuracy.test-support';
async function start(dish='Bowl Andino',agent=false,place='Conjunto Los Pinos'){
 const h=harness([{id:94760,code:82,name:dish,price:18000,availableNow:true,attributes:[]}],agent);
 Object.assign(h.cfg,{deliveryFeeMode:'distance',restaurantLat:4.63,restaurantLng:-74.15});
 Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true});
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cómo prefieres pagar?',actions:{}});
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:476,dailyOrderNumber:476});
 h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 h.service.deliveryRouting={quoteDeliveryFee:jest.fn().mockResolvedValue({ok:true,fee:2000,distanceKm:1,source:'google_directions',customer:{lat:4.64,lng:-74.14}})};
 await h.sendQueued(`quiero dos ${dish}`);await h.sendQueued('nada más');
 await h.sendQueued(place);
 return h;
}
for(const dish of ['Arroz Con Pollo','Bowl Andino'])for(const agent of [false,true]) {
 test(`${dish}/${agent}: mapped name alone needs an explicit delivery point`,async()=>{
  const h=await start(dish,agent);const cart=structuredClone(h.conv.sessionData.cart);
  expect(h.replies.at(-1)).toMatch(/portería|recepción|apartamento/i);
  await h.sendQueued('en efectivo');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();expect(h.conv.sessionData.cart).toEqual(cart);
  await h.sendQueued('en portería');
  expect(h.conv.state).toBe('awaiting_final_confirm');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.address).toMatch(/portería/i);expect(dto.items).toHaveLength(2);
 });
}

for(const dish of ['Arroz Con Pollo','Bowl Andino','Ensalada Campestre'])for(const agent of [false,true])
for(const place of ['Conjunto Los Pinos','Residencial La Rivera','Senderos del Lago'])
for(const point of ['en portería','dejar en recepción','torre 3 apto 402','apto 402','towerThenApt','lo recojo en portería','sí en la portería','portería principal','torre 3 apto 402, pago por Nequi','pago en efectivo, en portería'])
for(const interruption of ['none','payment','confirm']) {
 test(`${dish}/${agent}/${place}/${point}/${interruption}: complete mapped destination without losing cart or quote`,async()=>{
  const h=await start(dish,agent,place);const cart=structuredClone(h.conv.sessionData.cart);
  const before=h.conv.sessionData;
  expect(before.pendingMappedDeliveryPoint).toBe(true);
  const quoteCalls=h.service.deliveryRouting.quoteDeliveryFee.mock.calls.length;
  const coordinates=[before.deliveryLat,before.deliveryLng];
  if(interruption==='payment')await h.sendQueued('por nequi');
  if(interruption==='confirm')await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(point==='towerThenApt') {
   const reply=await h.sendQueued('torre 3');
   expect(reply).toMatch(/apartamento/);expect(h.conv.sessionData.pendingMappedDeliveryPoint).toBe(true);
   expect(h.conv.sessionData.address).toMatch(/torre 3/i);
   await h.sendQueued('apto 402');
  } else await h.sendQueued(point);
  expect(h.conv.sessionData.pendingMappedDeliveryPoint).toBeUndefined();
  expect(h.conv.sessionData.cart).toEqual(cart);
  expect([h.conv.sessionData.deliveryLat,h.conv.sessionData.deliveryLng]).toEqual(coordinates);
  expect(h.conv.sessionData.deliveryFeeCalculated).toBe(2000);
  expect(h.service.deliveryRouting.quoteDeliveryFee).toHaveBeenCalledTimes(quoteCalls);
  expect(h.conv.sessionData.orderType).toBe('delivery');
  if(point.includes('Nequi'))expect(h.conv.sessionData.paymentMethod).toBe('transfer');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(h.conv.state!=='awaiting_final_confirm')await h.sendQueued('en efectivo');
  expect(h.conv.state).toBe('awaiting_final_confirm');
  await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];
  expect(dto.address).toContain(place);expect(dto.items).toHaveLength(2);
  expect(dto.items.every((item:any)=>item.productId===94760)).toBe(true);
  if(point==='portería principal')expect(dto.address).toMatch(/portería principal/);
  if(/portería/.test(point))expect(dto.address).toMatch(/portería/);
  else if(/recepción/.test(point))expect(dto.address).toMatch(/recepción/);
  else expect(dto.address).toContain('402');
 });
}
for(const agent of [false,true])for(const detail of ['torre 3 apto 402','casa 14','local 4','Entregar en portería','Calle 10 #20-30']) {
 test(`already supplied ${detail}/${agent}: no repeat delivery-point question`,async()=>{
  const h=await start('Bowl Andino',agent,'Conjunto Los Pinos, '+detail);
  expect(h.conv.sessionData.pendingMappedDeliveryPoint).toBeFalsy();
  expect(h.conv.state).toBe('awaiting_payment');
  await h.sendQueued('en efectivo');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  expect(h.service.ordersService.create.mock.calls[0][0].address).toContain('Los Pinos');
 });
}
for(const agent of [false,true])for(const answer of ['¿en portería?','no en portería','no entregar en portería','sí','no','confirmar']) {
 test(`no approval from ${answer}/${agent}: keep mapped place and cart`,async()=>{
  const h=await start('Bowl Andino',agent);const snapshot=structuredClone(h.conv.sessionData);
  const reply=await h.sendQueued(answer);
  expect(reply).toMatch(/portería|recepción/);
  expect(h.conv.sessionData).toEqual(snapshot);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
}
for(const agent of [false,true])for(const exit of ['cancel','pickup','street','pin']) {
 test(`mapped delivery-point exit ${exit}/${agent}: clear pending requirement`,async()=>{
  const h=await start('Bowl Andino',agent);const cart=structuredClone(h.conv.sessionData.cart);
  if(exit==='cancel') {await h.sendQueued('cancelar pedido');expect(h.conv.sessionData.cart).toEqual([]);}
  if(exit==='pickup')await h.sendQueued('mejor paso a recogerlo');
  if(exit==='street')await h.sendQueued('Calle 10 #20-30 apto 402');
  if(exit==='pin')await h.sendQueued('',{messageType:'location',latitude:4.64,longitude:-74.14});
  expect(h.conv.sessionData.pendingMappedDeliveryPoint).toBeUndefined();
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(exit!=='cancel') {
   expect(h.conv.sessionData.cart).toEqual(cart);
   if(h.conv.state!=='awaiting_final_confirm')await h.sendQueued('en efectivo');
   await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  }
 });
}
for(const agent of [false,true])for(const text of [
 'torre 3 apto 402, a nombre de Luisa Rojas, pago por Nequi',
 'en portería y agrega una bebida, pago por Nequi',
]) {
 test(`delegate richer envelope/${agent}/${text}: point helper never discards other fields`,async()=>{
  const h=await start('Bowl Andino',agent);const snapshot=structuredClone(h.conv.sessionData);const name=h.conv.customerName;
  // Helper-level boundary test; the full richer-envelope router journey is outside this fixture.
  expect(await h.service.tryResolveMappedDeliveryPoint(h.conv,'customer',text)).toBe(false);
  expect(h.conv.sessionData).toEqual(snapshot);expect(h.conv.customerName).toBe(name);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
}
for(const agent of [false,true])for(const address of ['48 sur 87 86','para la 48 sur 87 86','d2 b 79 a. 86','2 b 79 a 86']) {
 test(`numeric external address ${address}/${agent}: not a name-only place`,async()=>{
  const h=await start('Bowl Andino',agent,address);
  expect(h.conv.sessionData.pendingMappedDeliveryPoint).toBeFalsy();
  expect(h.conv.state).toBe('awaiting_payment');
  await h.sendQueued('en efectivo');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(2);
 });
}
for(const agent of [false,true]) {
 test(`hotel named destination/${agent}: ask reception, then review without moving coordinates`,async()=>{
  const h=await start('Bowl Andino',agent,'Hotel Los Cedros');
  expect(h.conv.sessionData.pendingMappedDeliveryPoint).toBe(true);
  const coordinates=[h.conv.sessionData.deliveryLat,h.conv.sessionData.deliveryLng];
  await h.sendQueued('en recepción');
  expect([h.conv.sessionData.deliveryLat,h.conv.sessionData.deliveryLng]).toEqual(coordinates);
  expect(h.conv.sessionData.pendingMappedDeliveryPoint).toBeUndefined();
  await h.sendQueued('en efectivo');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  expect(h.service.ordersService.create.mock.calls[0][0].address).toMatch(/recepción/);
 });
}
