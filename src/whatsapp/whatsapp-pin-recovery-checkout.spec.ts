import {harness} from './whatsapp-accuracy.test-support';

for (const [dish,place] of [['Arroz Con Pollo','Conjunto Los Pinos'],['Bowl Vegetal','Condominio Los Cedros'],['Pasta Del Huerto','Urbanización La Rivera']])
for (const agent of [false,true]) for (const pin of ['native','link','replacement']) for (const covered of [false,true]) {
 it(`${dish}: ${pin} after ambiguous destination, covered=${covered}, agent=${agent}`,async()=>{
  const h=harness([{id:98601,code:86,name:dish,price:23000,availableNow:true,attributes:[]}],agent);
  Object.assign(h.cfg,{deliveryFeeMode:'distance',restaurantLat:4.63,restaurantLng:-74.15});
  Object.assign(h.conv.sessionData,{cart:[{productId:98601,code:86,name:dish,quantity:2,unitPrice:23000,attributes:[],note:'sin cebolla'}],orderType:'delivery',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
  h.conv.customerName='Laura García';
  h.conv.state='awaiting_address';
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:986,dailyOrderNumber:98});
  h.service.deliveryRouting={quoteDeliveryFee:jest.fn(async({customerCoords}:any)=>customerCoords
   ? covered ? {ok:true,fee:2000,distanceKm:1,source:'google_directions',geocodedAddress:'Calle 10 #20-30',customer:customerCoords}
    : {ok:false,reason:'out_of_coverage',message:'Fuera de cobertura. ¿Prefieres recoger en el local?',distanceKm:12}
   : {ok:false,reason:'address_ambiguous',message:'No pude identificar la dirección. ¿Me compartes la ubicación de WhatsApp?'})};
  const ambiguous=await h.sendQueued(`${place} torre 3 apto 345`);
  expect(ambiguous).toMatch(/ubicaci[oó]n/i);
  const cart=structuredClone(h.conv.sessionData.cart);
  const reply=pin==='link'
   ? await h.sendQueued('https://maps.google.com/?q=4.64,-74.14')
   : await h.sendQueued('',{messageType:'location',latitude:4.64,longitude:-74.14,...(pin==='replacement'?{locationName:'Edificio Horizonte',locationAddress:'Calle 10 #20-30'}:{})});
  expect(h.conv.customerName).toBe('Laura García');
  expect(h.conv.sessionData.cart).toEqual(cart);
  expect(h.conv.sessionData.deliveryLat).toBe(4.64);
  if(pin==='replacement')expect(h.conv.sessionData.address).not.toMatch(/345|Los Pinos|Los Cedros|La Rivera/);
  else {
   expect(h.conv.sessionData.address).toContain(place);
   expect(h.conv.sessionData.address).toContain('345');
  }
  expect(reply).toMatch(covered?/c[oó]mo.*pag|m[eé]todo de pago/i:/cobertura/i);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(!covered){
   await h.sendQueued('confirmar');
   expect(h.service.ordersService.create).not.toHaveBeenCalled();
   return;
  }
  expect(h.conv.sessionData.deliveryFeeCalculated).toBe(2000);
  await h.sendQueued('contraentrega');
  await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];
  expect(dto.customerName).toBe('Laura García');
  expect(dto.items).toEqual(Array.from({length:2},()=>expect.objectContaining({productId:98601,note:'sin cebolla'})));
  expect(dto.deliveryFee).toBe(2000);
  if(pin!=='replacement')expect(dto.address).toContain('345');
 });
}
