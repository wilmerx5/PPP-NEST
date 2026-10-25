import {harness} from './whatsapp-accuracy.test-support';

for(const dish of ['Arroz Con Pollo','Bowl Vegetal','Pasta Del Huerto'])
for(const agent of [false,true]) for(const exit of ['Mejor lo recojo en el local','Cancela ya lo pedí por teléfono','reiniciar'])
for(const reason of ['address_ambiguous','out_of_coverage']) {
 it(`${dish}: ${exit} after ${reason}; agent=${agent}`,async()=>{
  const h=harness([{id:98801,code:88,name:dish,price:23000,availableNow:true,attributes:[]}],agent);
  Object.assign(h.cfg,{deliveryFeeMode:'distance',restaurantLat:4.63,restaurantLng:-74.15});
  Object.assign(h.conv.sessionData,{cart:[{productId:98801,code:88,name:dish,quantity:2,unitPrice:23000,attributes:[],note:'sin cebolla'}],orderType:'delivery',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
  h.conv.customerName='Laura García';h.conv.state='awaiting_address';
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:988,dailyOrderNumber:98});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  h.service.deliveryRouting={quoteDeliveryFee:jest.fn().mockResolvedValue({ok:false,reason,message:reason==='address_ambiguous'?'No pude identificar la dirección. ¿Me compartes la ubicación de WhatsApp?':'Fuera de cobertura. ¿Prefieres recoger?',distanceKm:reason==='out_of_coverage'?12:undefined})};
  await h.sendQueued('Conjunto Los Pinos torre 3 apto 345');
  const cart=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued(exit);
  expect(reply).not.toMatch(/no pude identificar|fuera de cobertura|comparte.*ubicaci[oó]n/i);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(exit.startsWith('Mejor')) {
   expect(reply).toMatch(/recog|local/i);
   expect(h.conv.sessionData.cart).toEqual(cart);
  } else {
   expect(reply).toMatch(/cancel|vaci|reinici/i);
   expect(h.conv.sessionData.cart).toHaveLength(0);
   await h.sendQueued(`Quiero un ${dish}`);
   await h.sendQueued('Lo recojo en el local');
  }
  expect(h.conv.sessionData.orderType).toBe('pickup');
  expect(h.conv.sessionData.deliveryFeeCalculated??0).toBe(0);
  await h.sendQueued('contraentrega');
  expect(h.conv.state).toBe('awaiting_final_confirm');
  await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];
  expect(dto.orderType).toBe('pickup');
  expect(dto.address).not.toMatch(/345|Los Pinos/);
  expect(dto.deliveryFee??0).toBe(0);
  expect(dto.items).toHaveLength(exit.startsWith('Mejor')?2:1);
  expect(dto.items.every((item:any)=>item.productId===98801)).toBe(true);
  if(exit.startsWith('Mejor'))expect(dto.items.every((item:any)=>item.note==='sin cebolla')).toBe(true);
 });
}
