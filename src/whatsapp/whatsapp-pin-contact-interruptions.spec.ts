import {harness} from './whatsapp-accuracy.test-support';

for (const dish of ['Arroz Con Pollo','Bowl Vegetal','Pasta Del Huerto'])
for (const agent of [false,true]) for (const moment of ['beforePin','afterPin']) for (const contact of ['name','phone']) {
 it(`${dish}: price plus ${contact} ${moment}, agent=${agent}`,async()=>{
  const h=harness([{id:98701,code:87,name:dish,description:'Acompañado con arroz y ensalada',price:23000,availableNow:true,attributes:[]}],agent);
  Object.assign(h.cfg,{deliveryFeeMode:'distance',restaurantLat:4.63,restaurantLng:-74.15});
  Object.assign(h.conv.sessionData,{cart:[{productId:98701,code:87,name:dish,quantity:2,unitPrice:23000,attributes:[],note:'sin cebolla'}],orderType:'delivery',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
  h.conv.customerName='Laura García';h.conv.state='awaiting_address';
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:987,dailyOrderNumber:98});
  h.service.deliveryRouting={quoteDeliveryFee:jest.fn(async({customerCoords}:any)=>customerCoords
   ? {ok:true,fee:2000,distanceKm:1,source:'google_directions',geocodedAddress:'Calle 10 #20-30',customer:customerCoords}
   : {ok:false,reason:'address_ambiguous',message:'No pude identificar la dirección. ¿Me compartes la ubicación de WhatsApp?'})};
  await h.sendQueued('Conjunto Los Pinos torre 3 apto 345');
  const cart=structuredClone(h.conv.sessionData.cart);
  const pin=()=>h.sendQueued('',{messageType:'location',latitude:4.64,longitude:-74.14});
  if(moment==='afterPin')await pin();
  const reply=await h.sendQueued(`${contact==='name'?'A nombre de Cristina López':'Mi teléfono es 3000000007'}. ¿Cuánto cuesta ${dish}?`);
  expect(reply?.replace(/[.,]/g,'')).toContain('23000');
  expect(reply).toMatch(moment==='beforePin'?/direcci[oó]n|ubicaci[oó]n/i:/pag[ao]|m[eé]todo/i);
  expect(h.conv.state).not.toBe('completed');
  expect(h.conv.sessionData.cart).toEqual(cart);
  expect(h.conv.sessionData.address).toContain('345');
  if(contact==='name')expect(h.conv.customerName).toBe('Cristina López');
  else expect(h.conv.sessionData.contactPhone?.replace(/\D/g,'')).toContain('3000000007');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(moment==='beforePin')await pin();
  await h.sendQueued('contraentrega');
  expect(h.conv.state).toBe('awaiting_final_confirm');
  await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];
  expect(dto.customerName).toBe(contact==='name'?'Cristina López':'Laura García');
  if(contact==='phone')expect(dto.phone.replace(/\D/g,'')).toContain('3000000007');
  expect(dto.address).toContain('345');expect(dto.deliveryFee).toBe(2000);
  expect(dto.items).toEqual(Array.from({length:2},()=>expect.objectContaining({productId:98701,note:'sin cebolla'})));
 });
}
