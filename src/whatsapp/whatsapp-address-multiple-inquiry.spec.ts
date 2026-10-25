import {harness} from './whatsapp-accuracy.test-support';

for (const dish of ['Bowl Vegetal','Pizza De Hongos','Ramen De Miso'])
for (const agent of [false,true])
for (const position of ['before','after'])
for (const located of [false,true]) {
 it(`${dish}: two questions and new address ${position}, located=${located}, agent=${agent}`,async()=>{
  const h=harness([{id:98701,code:87,name:dish,description:'Preparado con verduras.',price:23000,availableNow:true,attributes:[]}],agent);
  Object.assign(h.cfg,{deliveryFeeMode:'distance',restaurantLat:4.63,restaurantLng:-74.15});
  Object.assign(h.conv.sessionData,{cart:[{productId:98701,code:87,name:dish,quantity:2,unitPrice:23000,attributes:[],note:'sin cebolla'}],orderType:'delivery',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,address:'Calle 10 #20-30',addressConfirmed:true,deliveryFeeCalculated:2000});
  h.conv.customerName='Laura García';h.conv.state='awaiting_payment';
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:987,dailyOrderNumber:98});
  h.service.deliveryRouting={quoteDeliveryFee:jest.fn(async({customerCoords}:any)=>located||customerCoords
   ? {ok:true,fee:5000,distanceKm:3,source:'google_directions',geocodedAddress:'Carrera 12 #34-56',customer:customerCoords||{lat:4.64,lng:-74.14}}
   : {ok:false,reason:'address_ambiguous',message:'No pude identificar la dirección. ¿Me compartes la ubicación de WhatsApp?'})};
  const cart=structuredClone(h.conv.sessionData.cart);
  const questions=`¿Cuánto cuesta ${dish}? ¿Qué trae ${dish}?`;
  const change='La dirección es Carrera 12 #34-56 torre 3 apto 345';
  const start=h.replies.length;
  await h.sendQueued(position==='before'?`${questions} ${change}`:`${change}; ${questions}`);
  const reply=h.replies.slice(start).join('\n');
  expect(reply).toMatch(/23[.,]000/);expect(reply).toMatch(/verduras/i);
  expect(reply).toMatch(located?/pag[ao]|m[eé]todo/i:/no pude identificar/i);
  if(!located)expect(reply).not.toMatch(/direcci[oó]n lista|direcci[oó]n confirmada/i);
  expect(h.conv.sessionData.address).toContain('345');
  expect(h.conv.sessionData.address).toContain('34-56');
  expect(h.conv.sessionData.address).not.toContain('20-30');
  expect(h.conv.sessionData.deliveryFeeCalculated).toBe(located?5000:null);
  expect(h.conv.sessionData.cart).toEqual(cart);
  expect(h.conv.customerName).toBe('Laura García');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(!located)await h.sendQueued('',{messageType:'location',latitude:4.64,longitude:-74.14});
  await h.sendQueued('contraentrega');
  expect(h.conv.state).toBe('awaiting_final_confirm');
  await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];
  expect(dto.customerName).toBe('Laura García');
  expect(dto.address).toContain('345');expect(dto.deliveryFee).toBe(5000);
  expect(dto.address).not.toContain('20-30');
  expect(dto.items).toEqual(Array.from({length:2},()=>expect.objectContaining({productId:98701,note:'sin cebolla'})));
 });
}
