import {harness} from './whatsapp-accuracy.test-support';

for(const dish of ['Arroz Con Pollo','Bowl Vegetal','Pasta Del Huerto']) {
 for(const condiment of ['salsa de tomate','mostaza','mayonesa']) {
 for(const agent of [false,true]) {
  it(`${dish} ${condiment}: condiment request is a note, not another selection, agent=${agent}`,async()=>{
   const h=harness([{id:98401,code:84,name:dish,price:23000,availableNow:true,attributes:[]}],agent);
   h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
   const reply=await h.sendQueued(`Hola buenas tardes me das un ${dish} con artos sobre de ${condiment}`);
   expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:98401,quantity:1,note:expect.stringMatching(new RegExp(condiment,'i'))})]);
   expect(h.conv.sessionData.pendingMatch).toBeFalsy();
   expect(reply).toMatch(/algo m[aá]s/i);
   expect(reply).not.toMatch(/necesito aclarar|escribe.*1.*agregar/i);
   await complete(h,condiment);
  });
 }
 it(`${dish} ${condiment}: model note acknowledgement must retain next step`,async()=>{
  const h=harness([{id:98401,code:84,name:dish,price:23000,availableNow:true,attributes:[]}],true);
  h.conv.sessionData.cart=[{productId:98401,code:84,name:dish,quantity:1,unitPrice:23000,attributes:[]}];
  h.agent.runTurn.mockResolvedValue({reply:`Listo, anoté tu ${dish} con hartos sobres de ${condiment}.`,actions:{updateCartLines:[{productId:98401,cartLineIndex:0,note:`hartos sobres de ${condiment}`}]},toolCalls:['get_cart','update_item']});
  const reply=await h.sendQueued(`Artos sobre de ${condiment}`);
  expect(h.conv.sessionData.cart).toHaveLength(1);
  expect(h.conv.sessionData.cart[0].note).toMatch(new RegExp(condiment,'i'));
  expect(reply).toMatch(/algo m[aá]s/i);
  await complete(h,condiment);
 });
 }
 for(const located of [false,true]) {
  it(`${dish}: street completion must advance or ask location, located=${located}`,async()=>{
   const h=harness([{id:98401,code:84,name:dish,price:23000,availableNow:true,attributes:[]}],true);
   h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'Listo, tu dirección quedó actualizada.',actions:{}});
   Object.assign(h.cfg,{deliveryFeeMode:'distance',restaurantLat:4.63,restaurantLng:-74.15});
   Object.assign(h.conv.sessionData,{cart:[{productId:98401,code:84,name:dish,quantity:1,unitPrice:23000,attributes:[]}],orderType:'delivery',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
   h.conv.state='awaiting_address';
   h.service.deliveryRouting={quoteDeliveryFee:jest.fn(async({customerAddress}:any)=>located && /Carrera/i.test(customerAddress)?{ok:true,fee:2000,distanceKm:1,source:'google_directions',customer:{lat:4.64,lng:-74.14}}:{ok:false,reason:'address_ambiguous',message:'No pude identificar con seguridad esa dirección en el mapa. ¿Me compartes la ubicación de WhatsApp?'})};
   await h.sendQueued('Plazuelas De San Esteban torre 3 apt 345');
   const reply=await h.sendQueued('Cr 78 b 6 b 75');
   expect(h.conv.sessionData.address).toMatch(/78.*75/i);
   expect(h.conv.sessionData.address).toMatch(/345/);
   expect(reply).toMatch(located?/c[oó]mo.*pag|m[eé]todo de pago/i:/ubicaci[oó]n/i);
   expect(reply).not.toMatch(/algo m[aá]s/i);
   if(!located) {
    expect(h.conv.state).not.toBe('awaiting_final_confirm');
    expect(h.conv.sessionData.deliveryFeeCalculated).toBeNull();
    return; // Negative boundary: unresolved map must not reach an order.
   }
   await complete(h);
   const dto=h.service.ordersService.create.mock.calls[0][0];
   expect(dto.address).toMatch(/345/);
  });
 }
}

async function complete(h: ReturnType<typeof harness>, note?: string) {
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:984,dailyOrderNumber:98});
 Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
 if(h.conv.state==='building_cart') await h.sendQueued('nada más');
 await h.sendQueued('contraentrega');
 expect(h.service.ordersService.create).not.toHaveBeenCalled();
 await h.sendQueued('confirmar');
 expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
 const dto=h.service.ordersService.create.mock.calls[0][0];
 expect(dto.items).toHaveLength(1);
 expect(dto.items[0].productId).toBe(98401);
 if(note) expect(dto.items[0].note).toMatch(new RegExp(note,'i'));
}

for(const located of [false,true]) {
 it(`agent address acknowledgement goes through checkout, map located=${located}`,async()=>{
  const menu=[{id:98401,code:84,name:'Bowl Vegetal',price:23000,availableNow:true,attributes:[]}];
  const h=harness(menu,true);
  Object.assign(h.cfg,{deliveryFeeMode:'distance',restaurantLat:4.63,restaurantLng:-74.15});
  Object.assign(h.conv.sessionData,{cart:[{productId:98401,code:84,name:'Bowl Vegetal',quantity:1,unitPrice:23000,attributes:[]}],orderType:'delivery',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
  h.agent.runTurn.mockResolvedValue({reply:'Listo, tu dirección quedó actualizada.',actions:{setAddress:'Carrera 78B #6B-75 torre 3 apto 345'},toolCalls:['set_address']});
  h.service.deliveryRouting={quoteDeliveryFee:jest.fn(async()=>located?{ok:true,fee:2000,distanceKm:1,source:'google_directions',customer:{lat:4.64,lng:-74.14}}:{ok:false,reason:'address_ambiguous',message:'No pude identificar la dirección. ¿Me compartes la ubicación de WhatsApp?'})};
  const text='Cr 78 b 6 b 75 torre 3 apt 345';
  const handled=await h.service.tryHandleAgentV1({conv:h.conv,msg:{waId:'customer',phoneE164:h.conv.phoneE164,messageType:'text',text,raw:{}},session:h.conv.sessionData,text,originalText:text,products:menu,cfg:h.cfg,status:{isOpen:true},businessOpenForBot:true});
  expect(handled).toBe(true);
  expect(h.agent.runTurn).toHaveBeenCalledTimes(1);
  expect(h.replies.join('\n')).toMatch(located?/c[oó]mo.*pag|m[eé]todo de pago/i:/ubicaci[oó]n/i);
  expect(h.conv.sessionData.address).toContain('345');
  if(located)await complete(h);
  else expect(h.conv.state).not.toBe('awaiting_final_confirm');
 });
}
