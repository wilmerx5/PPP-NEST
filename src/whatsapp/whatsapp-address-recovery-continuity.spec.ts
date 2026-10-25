import {harness} from './whatsapp-accuracy.test-support';

for (const dish of ['Arroz Con Pollo','Bowl Vegetal','Pasta Del Huerto']) {
 for (const agent of [false,true]) {
  for (const payment of ['contraentrega','en efectivo','por transferencia']) {
   it(`${dish} agent=${agent}: ambiguous street repetition preserves units and ${payment} is not an address`,async()=>{
    const h=harness([{id:98501,code:85,name:dish,price:23000,availableNow:true,attributes:[]}],agent);
    Object.assign(h.cfg,{deliveryFeeMode:'distance',restaurantLat:4.63,restaurantLng:-74.15});
    Object.assign(h.conv.sessionData,{cart:[{productId:98501,code:85,name:dish,quantity:1,unitPrice:23000,attributes:[]}],orderType:'delivery',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
    h.conv.state='awaiting_address';
    h.service.ordersService.create=jest.fn().mockResolvedValue({id:985,dailyOrderNumber:98});
    h.service.deliveryRouting={quoteDeliveryFee:jest.fn().mockResolvedValue({ok:false,reason:'address_ambiguous',message:'No pude identificar la dirección. ¿Me compartes la ubicación de WhatsApp?'})};
    await h.sendQueued('Carrera 78B #6B-75 torre 3 apto 345');
    await h.sendQueued('Carrera 78B #6B-75');
    expect(h.conv.sessionData.address).toContain('345');
    const before=h.conv.sessionData.address;
    const reply=await h.sendQueued(payment);
    expect(h.conv.sessionData.address).toBe(before);
    expect(h.conv.sessionData.paymentMethod).toBeTruthy();
    expect(reply).toMatch(/ubicaci[oó]n/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    h.service.deliveryRouting.quoteDeliveryFee.mockResolvedValue({ok:true,fee:2000,distanceKm:1,source:'google_directions',customer:{lat:4.64,lng:-74.14}});
    await h.sendQueued('Carrera 78B #6B-75');
    expect(h.conv.sessionData.address).toContain('345');
    await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const dto=h.service.ordersService.create.mock.calls[0][0];
    expect(dto.address).toContain('345');
    // The legacy order DTO deliberately appends payment; the session address must stay clean.
    expect(dto.address.split(' / ')[0]).toBe(before);
    expect(dto.items).toEqual([expect.objectContaining({productId:98501})]);
   });
  }
 }
}

for (const next of ['Carrera 78B #6B-75 torre 4 apto 900','Calle 10 #20-30 torre 4 apto 900','Cambia la dirección a Calle 10 #20-30']) {
 for (const agent of [false,true]) {
  it(`explicit destination/unit replacement does not inherit old apartment: ${next} agent=${agent}`,async()=>{
   const h=harness([{id:98501,code:85,name:'Bowl Vegetal',price:23000,availableNow:true,attributes:[]}],agent);
   Object.assign(h.cfg,{deliveryFeeMode:'distance',restaurantLat:4.63,restaurantLng:-74.15});
   Object.assign(h.conv.sessionData,{cart:[{productId:98501,code:85,name:'Bowl Vegetal',quantity:1,unitPrice:23000,attributes:[]}],orderType:'delivery',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
   h.conv.state='awaiting_address';
   h.service.deliveryRouting={quoteDeliveryFee:jest.fn().mockResolvedValue({ok:false,reason:'address_ambiguous',message:'No pude identificar la dirección. ¿Me compartes la ubicación de WhatsApp?'})};
   await h.sendQueued('Carrera 78B #6B-75 torre 3 apto 345');
   await h.sendQueued(next);
   expect(h.conv.sessionData.address).not.toContain('345');
   expect(h.conv.sessionData.address).toMatch(next.includes('900')?/900/:/20.*30/);
   expect(h.conv.sessionData.cart).toHaveLength(1);
   expect(h.conv.state).not.toBe('completed');
  });
 }
}
